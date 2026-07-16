import { createHash } from "node:crypto";
import {
  normalizeProductCategory,
  resolveProductCategorySemantics
} from "./product-category-normalizer.js";
import { resolveProductFunctionalProfile } from "./product-functional-profile.js";

export const PRODUCT_DATA_SUFFICIENCY_AUDIT_VERSION =
  "product-data-sufficiency-audit-v1";

const SOURCE_FIELDS = [
  "id", "brand", "name", "category", "product_form",
  "skin_types", "concerns", "texture", "finish",
  "irritation_risk", "sensitivity_safe",
  "spf_value", "uva_label", "uv_filter_type",
  "tone_up", "white_cast", "eye_sting", "pilling_risk",
  "ingredient_signals", "review_signals", "market_signals",
  "source_url", "hwahae_url", "buy_link", "image_url",
  "price_min", "price_max"
];

const RECOMMENDATION_FIELDS = new Set([
  "id", "brand", "name", "category", "product_form",
  "skin_types", "concerns", "texture", "finish",
  "irritation_risk", "sensitivity_safe",
  "uv_filter_type", "tone_up", "white_cast", "eye_sting", "pilling_risk",
  "ingredient_signals", "review_signals", "market_signals",
  "buy_link", "image_url", "price_min", "price_max"
]);

const CURRENT_SNAPSHOT_FIELDS = new Set([
  "id", "brand", "name", "category", "product_form", "image_url",
  "skin_types", "concerns", "texture", "finish",
  "irritation_risk", "sensitivity_safe",
  "ingredient_signals", "review_signals", "market_signals",
  "price_min", "price_max"
]);

const RECOMMENDATION_RELEVANT_FIELDS = new Set([
  "id", "brand", "name", "category", "product_form",
  "skin_types", "concerns", "texture", "finish",
  "irritation_risk", "sensitivity_safe", "uv_filter_type",
  "tone_up", "white_cast", "eye_sting", "pilling_risk",
  "ingredient_signals", "review_signals", "market_signals",
  "buy_link", "image_url", "price_min", "price_max"
]);

const CURRENT_SNAPSHOT_RELEVANT_FIELDS = new Set([
  "id", "brand", "name", "category", "product_form",
  "irritation_risk", "sensitivity_safe", "ingredient_signals",
  "spf_value", "uva_label", "uv_filter_type",
  "tone_up", "white_cast", "eye_sting", "pilling_risk",
  "texture", "finish", "image_url"
]);

const SUNSCREEN_PROTECTION_FIELDS = ["spf_value", "uva_label", "uv_filter_type"];
const SUNSCREEN_PREFERENCE_FIELDS = [
  "tone_up", "white_cast", "eye_sting", "pilling_risk", "texture", "finish"
];
const SAFETY_VALUES = new Set(["low", "medium", "high"]);
const DUPLICATE_ROLES = new Set(["functional_leave_on", "hydration_base"]);
const LEGACY_CATEGORIES = new Set(["serum", "ampoule", "essence"]);
const SEVERITY_RANK = { critical: 0, important: 1, quality: 2 };

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value || {}, key);
}

function isPresent(value) {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((result, key) => {
      if (value[key] !== undefined) result[key] = stable(value[key]);
      return result;
    }, {});
  }
  return value;
}

function canonicalRows(products) {
  return products.map((product) => stable(SOURCE_FIELDS.reduce((row, field) => {
    if (hasOwn(product, field)) row[field] = product[field];
    return row;
  }, {}))).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

function datasetHash(products) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalRows(products)))
    .digest("hex");
}

function sourceStatus(product, field, applicable = true) {
  if (!applicable) return { state: "not_applicable" };
  if (!hasOwn(product, field) || !isPresent(product[field])) return { state: "missing" };
  if (["ingredient_signals", "review_signals", "market_signals"].includes(field) &&
      (typeof product[field] !== "object" || Array.isArray(product[field]))) {
    return { state: "malformed" };
  }
  return { state: "present" };
}

function transportStatus(product, field, destination) {
  const preserved = destination === "recommendation" ? RECOMMENDATION_FIELDS : CURRENT_SNAPSHOT_FIELDS;
  const relevant = destination === "recommendation"
    ? RECOMMENDATION_RELEVANT_FIELDS
    : CURRENT_SNAPSHOT_RELEVANT_FIELDS;

  if (!relevant.has(field)) return "not_applicable";

  if (destination === "recommendation" && field === "sensitivity_safe" &&
      typeof product[field] !== "boolean") {
    return "coerced";
  }

  if (destination === "recommendation" && ["skin_types", "concerns"].includes(field)) {
    if (!isPresent(product[field])) return "defaulted";
    return "normalized";
  }

  if (destination === "recommendation" && ["texture", "finish", "irritation_risk"].includes(field)) {
    if (!isPresent(product[field])) return "defaulted";
    return "normalized";
  }

  if (!isPresent(product[field])) return "not_applicable";
  return preserved.has(field) ? "preserved" : "dropped";
}

function gap(code, severity, fieldPaths, stage, remediation) {
  return { code, severity, fieldPaths: [...new Set(fieldPaths)].sort(), stage, remediation };
}

function addGap(gaps, item) {
  const key = `${item.code}|${item.stage}|${item.fieldPaths.join(",")}`;
  if (!gaps.some((existing) =>
    `${existing.code}|${existing.stage}|${existing.fieldPaths.join(",")}` === key)) {
    gaps.push(item);
  }
}

function sortGaps(gaps) {
  return gaps.sort((left, right) =>
    (SEVERITY_RANK[left.severity] - SEVERITY_RANK[right.severity]) ||
    left.code.localeCompare(right.code) ||
    left.stage.localeCompare(right.stage) ||
    left.fieldPaths.join(",").localeCompare(right.fieldPaths.join(","))
  );
}

function auditIdentity(product, semantics, duplicate, gaps) {
  if (!isPresent(product.id)) addGap(gaps, gap("PRODUCT_ID_MISSING", "critical", ["id"], "source", "data_backfill"));
  if (!isPresent(product.brand)) addGap(gaps, gap("PRODUCT_BRAND_MISSING", "critical", ["brand"], "source", "data_backfill"));
  if (!isPresent(product.name)) addGap(gaps, gap("PRODUCT_NAME_MISSING", "critical", ["name"], "source", "data_backfill"));
  if (duplicate) addGap(gaps, gap("PRODUCT_ID_DUPLICATE", "critical", ["id"], "source", "manual_review"));

  const category = normalizeText(product.category);
  if (LEGACY_CATEGORIES.has(category)) {
    addGap(gaps, gap("CATEGORY_LEGACY", "critical", ["category"], "source", "schema_contract_review"));
  } else if (semantics.unresolvedReason === "missing_product_form") {
    addGap(gaps, gap("TREATMENT_FORM_MISSING", "critical", ["product_form"], "source", "data_backfill"));
  } else if (semantics.unresolvedReason === "invalid_product_form") {
    addGap(gaps, gap("TREATMENT_FORM_INVALID", "critical", ["product_form"], "source", "manual_review"));
  } else if (semantics.unresolvedReason === "non_treatment_product_form") {
    addGap(gaps, gap("NON_TREATMENT_FORM_PRESENT", "critical", ["product_form"], "source", "manual_review"));
  } else if (semantics.unresolved) {
    addGap(gaps, gap("CATEGORY_UNSUPPORTED", "critical", ["category"], "source", "schema_contract_review"));
  }
}

function auditFunctional(product, profile, gaps) {
  const signals = product?.ingredient_signals;
  if (signals == null) {
    addGap(gaps, gap("FUNCTIONAL_SIGNAL_MISSING", "important", ["ingredient_signals.functional"], "source", "data_backfill"));
    return false;
  }
  if (typeof signals !== "object" || Array.isArray(signals)) {
    addGap(gaps, gap("SOURCE_JSON_MALFORMED", "critical", ["ingredient_signals"], "source", "manual_review"));
    return false;
  }
  if (!Array.isArray(signals.functional)) {
    addGap(gaps, gap("FUNCTIONAL_SIGNAL_MISSING", "important", ["ingredient_signals.functional"], "source", "data_backfill"));
    return false;
  }

  let validCount = 0;
  for (const entry of signals.functional) {
    const label = typeof entry?.label === "string" ? entry.label.trim() : "";
    const count = Number.parseInt(String(entry?.count ?? "").replace(/[^\d]/g, ""), 10);
    if (!label || !Number.isFinite(count) || count <= 0) {
      addGap(gaps, gap("FUNCTIONAL_ENTRY_INVALID", "important", ["ingredient_signals.functional"], "source", "manual_review"));
    } else {
      validCount += 1;
    }
  }

  if ((profile.unknownFunctionalLabels || []).length) {
    addGap(gaps, gap("FUNCTIONAL_LABEL_UNKNOWN", "important", ["ingredient_signals.functional.label"], "functional_profile", "label_registry_review"));
  }
  if (validCount > 0 && !profile.evaluable) {
    addGap(gaps, gap("FUNCTIONAL_AXIS_UNRECOGNIZED", "important", ["ingredient_signals.functional"], "functional_profile", "label_registry_review"));
  }
  return validCount > 0;
}

function auditSafety(product, role, gaps) {
  const riskPresent = isPresent(product.irritation_risk);
  const riskValid = riskPresent && SAFETY_VALUES.has(normalizeText(product.irritation_risk));
  const safeExplicit = typeof product.sensitivity_safe === "boolean";

  if (riskPresent && !riskValid) {
    addGap(gaps, gap("SAFETY_VALUE_INVALID", "important", ["irritation_risk"], "source", "manual_review"));
  }
  if (!safeExplicit) {
    addGap(gaps, gap("SAFETY_UNKNOWN_COERCED", "critical", ["sensitivity_safe"], "recommendation_mapping", "adapter_fix"));
  }
  if (role === "functional_leave_on" && (!riskValid || !safeExplicit)) {
    addGap(gaps, gap("ACTIVE_PRODUCT_SAFETY_MISSING", "important", ["irritation_risk", "sensitivity_safe"], "source", "data_backfill"));
  }
  return {
    present: riskPresent || safeExplicit,
    valid: (!riskPresent || riskValid) && (!hasOwn(product, "sensitivity_safe") || safeExplicit),
    ready: riskValid && safeExplicit
  };
}

function auditSunscreen(product, profile, gaps) {
  if (profile.categoryRole !== "protection") return { protectionReady: false, preferenceReady: false };

  const uvAxis = profile.functionalAxes.some((axis) => axis.axis === "sunscreen_protection");
  const protectionCount = SUNSCREEN_PROTECTION_FIELDS.filter((field) => isPresent(product[field])).length;
  const preferenceCount = SUNSCREEN_PREFERENCE_FIELDS.filter((field) => isPresent(product[field])).length;

  if (!uvAxis) addGap(gaps, gap("SUNSCREEN_PROTECTION_SIGNAL_MISSING", "important", ["ingredient_signals.functional"], "functional_profile", "data_backfill"));
  if (protectionCount === 0) {
    addGap(gaps, gap("SUNSCREEN_METADATA_MISSING", "important", SUNSCREEN_PROTECTION_FIELDS, "source", "data_backfill"));
  } else if (protectionCount < SUNSCREEN_PROTECTION_FIELDS.length) {
    addGap(gaps, gap("SUNSCREEN_METADATA_PARTIAL", "important", SUNSCREEN_PROTECTION_FIELDS, "source", "data_backfill"));
  }
  if (preferenceCount < SUNSCREEN_PREFERENCE_FIELDS.length) {
    addGap(gaps, gap("SUNSCREEN_PREFERENCE_METADATA_MISSING", "important", SUNSCREEN_PREFERENCE_FIELDS, "source", "data_backfill"));
  }
  return {
    protectionReady: uvAxis && protectionCount === SUNSCREEN_PROTECTION_FIELDS.length,
    preferenceReady: preferenceCount === SUNSCREEN_PREFERENCE_FIELDS.length
  };
}

function auditQuality(product, gaps) {
  const checks = [
    ["skin_types", "SKIN_TYPE_MISSING"], ["concerns", "CONCERN_MISSING"],
    ["texture", "TEXTURE_MISSING"], ["finish", "FINISH_MISSING"],
    ["review_signals", "REVIEW_SIGNAL_MISSING"], ["market_signals", "MARKET_SIGNAL_MISSING"],
    ["buy_link", "BUY_LINK_MISSING"], ["image_url", "IMAGE_MISSING"]
  ];
  for (const [field, code] of checks) {
    if (!isPresent(product[field])) addGap(gaps, gap(code, "quality", [field], "source", "data_backfill"));
  }
  if (!isPresent(product.price_min) && !isPresent(product.price_max)) {
    addGap(gaps, gap("PRICE_MISSING", "quality", ["price_min", "price_max"], "source", "data_backfill"));
  }
  const provenance = [
    product.source_url, product.hwahae_url,
    product?.ingredient_signals?.source,
    product?.review_signals?.source,
    product?.market_signals?.source
  ].some(isPresent);
  if (!provenance) addGap(gaps, gap("PROVENANCE_MISSING", "quality", ["source_url", "hwahae_url", "ingredient_signals.source"], "source", "manual_review"));
  return provenance;
}

function auditTransport(product, gaps) {
  const result = {};
  for (const field of SOURCE_FIELDS) {
    const recommendation = transportStatus(product, field, "recommendation");
    const currentSnapshot = transportStatus(product, field, "currentSnapshot");
    result[field] = { recommendation, currentSnapshot };

    if (recommendation === "dropped") {
      addGap(gaps, gap("RECOMMENDATION_FIELD_DROPPED", "critical", [field], "recommendation_mapping", "adapter_fix"));
    }
    if (currentSnapshot === "dropped") {
      addGap(gaps, gap("SNAPSHOT_FIELD_DROPPED", "critical", [field], "current_snapshot", "adapter_fix"));
    }
    if (recommendation === "defaulted") {
      addGap(gaps, gap("RUNTIME_DEFAULT_MASKING", "important", [field], "recommendation_mapping", "data_backfill"));
    }
  }
  return result;
}

function rowKey(product, index, duplicate) {
  const id = String(product?.id ?? "").trim();
  if (id && !duplicate) return id;
  const prefix = id || `${normalizeText(product?.brand)}::${normalizeText(product?.name)}`;
  return `${prefix}::${index}`;
}

function buildRow(product, index, duplicateIds) {
  const gaps = [];
  const strict = resolveProductCategorySemantics(product);
  const loose = normalizeProductCategory(product.category);
  const profile = resolveProductFunctionalProfile(product);
  const duplicate = isPresent(product.id) && duplicateIds.has(String(product.id).trim());

  auditIdentity(product, strict, duplicate, gaps);
  const functionalSignalPresent = auditFunctional(product, profile, gaps);
  const safety = auditSafety(product, profile.categoryRole, gaps);
  const sunscreen = auditSunscreen(product, profile, gaps);
  const provenanceReady = auditQuality(product, gaps);
  const transport = auditTransport(product, gaps);
  const transportComplete = Object.values(transport).every((state) =>
    !["dropped", "coerced", "defaulted"].includes(state.recommendation) &&
    !["dropped", "coerced", "defaulted"].includes(state.currentSnapshot)
  );

  const key = rowKey(product, index, duplicate);
  const source = Object.fromEntries(SOURCE_FIELDS.map((field) => [
    field,
    sourceStatus(product, field, profile.categoryRole === "protection" ||
      !SUNSCREEN_PROTECTION_FIELDS.concat(SUNSCREEN_PREFERENCE_FIELDS).includes(field))
  ]));
  const rankingReady = Array.isArray(product.skin_types) && product.skin_types.length > 0 &&
    Array.isArray(product.concerns) && product.concerns.length > 0 &&
    isPresent(product.texture) && isPresent(product.finish);
  const duplicateAxisReady = DUPLICATE_ROLES.has(profile.categoryRole) &&
    !profile.cautionTags.includes("rinse_off_limit") &&
    profile.functionalAxes.some((axis) =>
      ["medium", "high"].includes(axis.confidence) &&
      ["medium", "high"].includes(axis.strength));

  return {
    rowKey: key,
    productId: isPresent(product.id) ? String(product.id).trim() : null,
    brand: isPresent(product.brand) ? String(product.brand).trim() : null,
    name: isPresent(product.name) ? String(product.name).trim() : null,
    rawCategory: isPresent(product.category) ? String(product.category).trim() : null,
    canonicalCategory: strict.canonicalCategory || loose.canonicalCategory,
    productForm: isPresent(product.product_form) ? String(product.product_form).trim() : null,
    categorySemantics: {
      recommendationEligible: strict.authorizesRecommendationCategory === true,
      currentProductCategoryUsable: profile.categoryRole !== "unknown",
      unresolvedReason: strict.unresolvedReason || null
    },
    capabilities: {
      identityReady: [product.id, product.brand, product.name].every(isPresent),
      recommendationCategoryReady: strict.authorizesRecommendationCategory === true,
      currentProductCategoryReady: profile.categoryRole !== "unknown",
      routineRoleReady: profile.categoryRole !== "unknown",
      functionalSignalPresent,
      recognizedAxisPresent: profile.functionalAxes.length > 0,
      functionalProfileEvaluable: profile.evaluable === true,
      directGoalSupportEvaluable: profile.evaluable === true && !profile.cautionTags.includes("rinse_off_limit"),
      duplicateAxisEvaluable: duplicateAxisReady,
      safetyValuePresent: safety.present,
      safetyValueValid: safety.valid,
      safetyDecisionReady: safety.ready,
      safetyProvenanceReady: provenanceReady && safety.present,
      sunscreenProtectionReady: sunscreen.protectionReady,
      sunscreenPreferenceReady: sunscreen.preferenceReady,
      rankingEvidenceReady: rankingReady,
      commerceMetadataReady: (isPresent(product.price_min) || isPresent(product.price_max)) && isPresent(product.image_url),
      provenanceReady,
      transportComplete
    },
    functionalAxes: profile.functionalAxes.map(({ axis, strength, confidence }) => ({ axis, strength, confidence })),
    unknownFunctionalLabels: [...new Set(profile.unknownFunctionalLabels || [])]
      .map(normalizeText).filter(Boolean).sort(),
    sourceStatus: source,
    transportStatus: transport,
    gaps: sortGaps(gaps)
  };
}

function count(rows, predicate) {
  return rows.filter(predicate).length;
}

function summarizeGaps(rows) {
  const gaps = rows.flatMap((row) => row.gaps);
  return {
    criticalGapCount: count(gaps, (item) => item.severity === "critical"),
    importantGapCount: count(gaps, (item) => item.severity === "important"),
    qualityGapCount: count(gaps, (item) => item.severity === "quality")
  };
}

function byCategory(rows) {
  const result = {};
  for (const row of rows) {
    const key = row.canonicalCategory || row.rawCategory || "unknown";
    const bucket = result[key] || {
      total: 0, recommendationEligible: 0, currentProductEvaluable: 0,
      functionalProfileEvaluable: 0, safetyDecisionReady: 0, transportComplete: 0,
      criticalGapCount: 0, importantGapCount: 0, qualityGapCount: 0
    };
    bucket.total += 1;
    bucket.recommendationEligible += Number(row.capabilities.recommendationCategoryReady);
    bucket.currentProductEvaluable += Number(row.capabilities.currentProductCategoryReady);
    bucket.functionalProfileEvaluable += Number(row.capabilities.functionalProfileEvaluable);
    bucket.safetyDecisionReady += Number(row.capabilities.safetyDecisionReady);
    bucket.transportComplete += Number(row.capabilities.transportComplete);
    for (const item of row.gaps) bucket[`${item.severity}GapCount`] += 1;
    result[key] = bucket;
  }
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
}

function byAxis(rows) {
  const result = {};
  for (const row of rows) {
    for (const axis of row.functionalAxes) {
      const bucket = result[axis.axis] || {
        productCount: 0, highConfidenceCount: 0,
        mediumOrHigherConfidenceCount: 0, duplicateAxisEvaluableCount: 0
      };
      bucket.productCount += 1;
      bucket.highConfidenceCount += Number(axis.confidence === "high");
      bucket.mediumOrHigherConfidenceCount += Number(["medium", "high"].includes(axis.confidence));
      bucket.duplicateAxisEvaluableCount += Number(row.capabilities.duplicateAxisEvaluable);
      result[axis.axis] = bucket;
    }
  }
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
}

function byField(rows) {
  return Object.fromEntries(SOURCE_FIELDS.map((field) => {
    const applicable = rows.filter((row) => row.sourceStatus[field].state !== "not_applicable");
    return [field, {
      applicableCount: applicable.length,
      presentCount: count(applicable, (row) => row.sourceStatus[field].state === "present"),
      usableCount: count(applicable, (row) => row.sourceStatus[field].state === "present"),
      defaultedCount: count(rows, (row) => Object.values(row.transportStatus[field]).includes("defaulted")),
      coercedCount: count(rows, (row) => Object.values(row.transportStatus[field]).includes("coerced")),
      droppedFromRecommendationCount: count(rows, (row) => row.transportStatus[field].recommendation === "dropped"),
      droppedFromCurrentSnapshotCount: count(rows, (row) => row.transportStatus[field].currentSnapshot === "dropped")
    }];
  }));
}

function unknownLabels(rows) {
  const map = new Map();
  for (const row of rows) {
    for (const label of row.unknownFunctionalLabels) {
      const ids = map.get(label) || new Set();
      ids.add(row.rowKey);
      map.set(label, ids);
    }
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([label, ids]) => ({
    label, productCount: ids.size, sampleProductIds: [...ids].sort().slice(0, 5)
  }));
}

function transportGaps(rows) {
  const map = new Map();
  for (const row of rows) {
    for (const [field, states] of Object.entries(row.transportStatus)) {
      for (const [destination, state] of Object.entries(states)) {
        if (state !== "dropped") continue;
        const target = destination === "recommendation" ? "recommendation_product" : "current_product_snapshot";
        const key = `${field}|${target}`;
        const ids = map.get(key) || new Set();
        ids.add(row.rowKey);
        map.set(key, ids);
      }
    }
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, ids]) => {
    const [fieldPath, destination] = key.split("|");
    return { fieldPath, destination, affectedCount: ids.size, sampleProductIds: [...ids].sort().slice(0, 5) };
  });
}

function backlog(rows) {
  const names = {
    adapter_fix: "adapterFixes", data_backfill: "dataBackfills",
    manual_review: "manualReviews", schema_contract_review: "schemaContractReviews",
    label_registry_review: "labelRegistryReviews"
  };
  const result = {
    adapterFixes: [], dataBackfills: [], manualReviews: [],
    schemaContractReviews: [], labelRegistryReviews: []
  };
  const map = new Map();
  for (const row of rows) {
    for (const item of row.gaps) {
      const key = `${item.remediation}|${item.code}|${item.severity}`;
      const current = map.get(key) || { code: item.code, severity: item.severity, fields: new Set(), ids: new Set() };
      item.fieldPaths.forEach((field) => current.fields.add(field));
      current.ids.add(row.rowKey);
      map.set(key, current);
    }
  }
  for (const [key, item] of [...map.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    result[names[key.split("|")[0]]].push({
      code: item.code, severity: item.severity, affectedCount: item.ids.size,
      fieldPaths: [...item.fields].sort(), sampleProductIds: [...item.ids].sort().slice(0, 5)
    });
  }
  return result;
}

function emptyResult(sourceType) {
  return {
    version: PRODUCT_DATA_SUFFICIENCY_AUDIT_VERSION,
    dataset: { sourceType, datasetHash: "", rowCount: 0 },
    status: "input_invalid",
    summary: { totalProducts: 0, criticalGapCount: 0, importantGapCount: 0, qualityGapCount: 0 },
    byCategory: {}, byFunctionalAxis: {}, byField: {},
    unknownFunctionalLabels: [], transportGaps: [],
    remediationBacklog: {
      adapterFixes: [], dataBackfills: [], manualReviews: [],
      schemaContractReviews: [], labelRegistryReviews: []
    },
    rows: []
  };
}

export function buildProductDataSufficiencyAudit(rawProducts, options = {}) {
  const sourceType = options.sourceType === "raw_export" ? "raw_export" : "fixture";
  if (!Array.isArray(rawProducts)) return emptyResult(sourceType);

  const products = [...rawProducts].sort((left, right) =>
    JSON.stringify(stable(left)).localeCompare(JSON.stringify(stable(right))));
  const counts = new Map();
  for (const product of products) {
    const id = String(product?.id ?? "").trim();
    if (id) counts.set(id, (counts.get(id) || 0) + 1);
  }
  const duplicates = new Set([...counts.entries()].filter(([, value]) => value > 1).map(([id]) => id));
  const rows = products.map((product, index) => buildRow(product, index, duplicates)).sort((left, right) =>
    String(left.canonicalCategory || "").localeCompare(String(right.canonicalCategory || "")) ||
    String(left.brand || "").localeCompare(String(right.brand || "")) ||
    String(left.name || "").localeCompare(String(right.name || "")) ||
    left.rowKey.localeCompare(right.rowKey));

  const gapSummary = summarizeGaps(rows);
  const capability = (name) => count(rows, (row) => row.capabilities[name]);
  return {
    version: PRODUCT_DATA_SUFFICIENCY_AUDIT_VERSION,
    dataset: { sourceType, datasetHash: datasetHash(rawProducts), rowCount: rawProducts.length },
    status: gapSummary.criticalGapCount ? "critical_gaps" : "audit_complete",
    summary: {
      totalProducts: rows.length,
      identityReadyCount: capability("identityReady"),
      recommendationEligibleCount: capability("recommendationCategoryReady"),
      currentProductCategoryReadyCount: capability("currentProductCategoryReady"),
      routineRoleReadyCount: capability("routineRoleReady"),
      functionalSignalPresentCount: capability("functionalSignalPresent"),
      functionalProfileEvaluableCount: capability("functionalProfileEvaluable"),
      directGoalSupportEvaluableCount: capability("directGoalSupportEvaluable"),
      duplicateAxisEvaluableCount: capability("duplicateAxisEvaluable"),
      safetyDecisionReadyCount: capability("safetyDecisionReady"),
      sunscreenProtectionReadyCount: capability("sunscreenProtectionReady"),
      sunscreenPreferenceReadyCount: capability("sunscreenPreferenceReady"),
      rankingEvidenceReadyCount: capability("rankingEvidenceReady"),
      commerceMetadataReadyCount: capability("commerceMetadataReady"),
      provenanceReadyCount: capability("provenanceReady"),
      transportCompleteCount: capability("transportComplete"),
      ...gapSummary
    },
    byCategory: byCategory(rows),
    byFunctionalAxis: byAxis(rows),
    byField: byField(rows),
    unknownFunctionalLabels: unknownLabels(rows),
    transportGaps: transportGaps(rows),
    remediationBacklog: backlog(rows),
    rows
  };
}
