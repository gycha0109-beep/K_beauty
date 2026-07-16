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

const RECOMMENDATION_PRESERVED_FIELDS = new Set([
  "id", "brand", "name", "category", "product_form",
  "skin_types", "concerns", "texture", "finish",
  "irritation_risk", "sensitivity_safe",
  "uv_filter_type", "tone_up", "white_cast", "eye_sting", "pilling_risk",
  "ingredient_signals", "review_signals", "market_signals",
  "buy_link", "image_url", "price_min", "price_max"
]);

const CURRENT_SNAPSHOT_PRESERVED_FIELDS = new Set([
  "id", "brand", "name", "category", "product_form",
  "skin_types", "concerns", "texture", "finish",
  "irritation_risk", "sensitivity_safe",
  "ingredient_signals", "review_signals", "market_signals",
  "price_min", "price_max"
]);

const RECOGNIZED_SAFETY_VALUES = new Set(["low", "medium", "high"]);
const SUNSCREEN_PROTECTION_FIELDS = ["spf_value", "uva_label", "uv_filter_type"];
const SUNSCREEN_PREFERENCE_FIELDS = [
  "tone_up", "white_cast", "eye_sting", "pilling_risk", "texture", "finish"
];
const ACTIVE_ROLES = new Set(["functional_leave_on"]);
const SEVERITY_RANK = { critical: 0, important: 1, quality: 2 };
const LEGACY_CATEGORIES = new Set(["serum", "ampoule", "essence"]);

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function isPresent(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function stableClone(value) {
  if (Array.isArray(value)) {
    return value.map(stableClone);
  }
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        if (value[key] !== undefined) result[key] = stableClone(value[key]);
        return result;
      }, {});
  }
  return value;
}

function canonicalRows(products) {
  return products
    .map((product) => stableClone(
      SOURCE_FIELDS.reduce((row, field) => {
        if (hasOwn(product, field)) row[field] = product[field];
        return row;
      }, {})
    ))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

function hashDataset(products) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalRows(products)))
    .digest("hex");
}

function sourceState(product, field, applicable = true) {
  if (!applicable) return { state: "not_applicable" };
  if (!hasOwn(product, field) || product[field] === undefined || product[field] === null) {
    return { state: "missing" };
  }
  if (typeof product[field] === "string" && !product[field].trim()) {
    return { state: "missing" };
  }
  return { state: "present" };
}

function transportState(product, field, destination) {
  const applicable = destination === "recommendation"
    ? RECOMMENDATION_PRESERVED_FIELDS
    : CURRENT_SNAPSHOT_PRESERVED_FIELDS;
  if (!hasOwn(product, field) || !isPresent(product[field])) return "not_applicable";
  if (!applicable.has(field)) return "dropped";
  if (field === "sensitivity_safe" && typeof product[field] !== "boolean") return "coerced";
  if (["skin_types", "concerns"].includes(field) && !Array.isArray(product[field])) return "normalized";
  return "preserved";
}

function makeGap(code, severity, fieldPaths, stage, remediation) {
  return { code, severity, fieldPaths: [...new Set(fieldPaths)].sort(), stage, remediation };
}

function addGap(gaps, gap) {
  const key = `${gap.code}|${gap.stage}|${gap.fieldPaths.join(",")}`;
  if (!gaps.some((item) => `${item.code}|${item.stage}|${item.fieldPaths.join(",")}` === key)) {
    gaps.push(gap);
  }
}

function auditFunctionalSource(product, profile, gaps) {
  const signals = product?.ingredient_signals;
  if (signals == null) {
    addGap(gaps, makeGap(
      "FUNCTIONAL_SIGNAL_MISSING", "important", ["ingredient_signals.functional"],
      "source", "data_backfill"
    ));
    return { present: false, malformed: false };
  }
  if (typeof signals !== "object" || Array.isArray(signals)) {
    addGap(gaps, makeGap(
      "SOURCE_JSON_MALFORMED", "critical", ["ingredient_signals"],
      "source", "manual_review"
    ));
    return { present: false, malformed: true };
  }
  if (!Array.isArray(signals.functional)) {
    addGap(gaps, makeGap(
      "FUNCTIONAL_SIGNAL_MISSING", "important", ["ingredient_signals.functional"],
      "source", "data_backfill"
    ));
    return { present: false, malformed: false };
  }
  let validCount = 0;
  for (const entry of signals.functional) {
    const label = typeof entry?.label === "string" ? entry.label.trim() : "";
    const count = Number.parseInt(String(entry?.count ?? "").replace(/[^\d]/g, ""), 10);
    if (!label || !Number.isFinite(count) || count <= 0) {
      addGap(gaps, makeGap(
        "FUNCTIONAL_ENTRY_INVALID", "important", ["ingredient_signals.functional"],
        "source", "manual_review"
      ));
      continue;
    }
    validCount += 1;
  }
  for (const label of profile.unknownFunctionalLabels || []) {
    addGap(gaps, makeGap(
      "FUNCTIONAL_LABEL_UNKNOWN", "important", ["ingredient_signals.functional.label"],
      "functional_profile", "label_registry_review"
    ));
  }
  if (validCount > 0 && !profile.evaluable) {
    addGap(gaps, makeGap(
      "FUNCTIONAL_AXIS_UNRECOGNIZED", "important", ["ingredient_signals.functional"],
      "functional_profile", "label_registry_review"
    ));
  }
  return { present: validCount > 0, malformed: false };
}

function auditIdentityAndCategory(product, semantics, gaps) {
  if (!isPresent(product.id)) {
    addGap(gaps, makeGap("PRODUCT_ID_MISSING", "critical", ["id"], "source", "data_backfill"));
  }
  if (!isPresent(product.brand)) {
    addGap(gaps, makeGap("PRODUCT_BRAND_MISSING", "critical", ["brand"], "source", "data_backfill"));
  }
  if (!isPresent(product.name)) {
    addGap(gaps, makeGap("PRODUCT_NAME_MISSING", "critical", ["name"], "source", "data_backfill"));
  }

  const category = normalizeText(product.category);
  if (LEGACY_CATEGORIES.has(category)) {
    addGap(gaps, makeGap(
      "CATEGORY_LEGACY", "critical", ["category"], "source", "schema_contract_review"
    ));
  } else if (semantics.unresolvedReason === "missing_product_form") {
    addGap(gaps, makeGap(
      "TREATMENT_FORM_MISSING", "critical", ["product_form"], "source", "data_backfill"
    ));
  } else if (semantics.unresolvedReason === "invalid_product_form") {
    addGap(gaps, makeGap(
      "TREATMENT_FORM_INVALID", "critical", ["product_form"], "source", "manual_review"
    ));
  } else if (semantics.unresolvedReason === "non_treatment_product_form") {
    addGap(gaps, makeGap(
      "NON_TREATMENT_FORM_PRESENT", "critical", ["product_form"], "source", "manual_review"
    ));
  } else if (semantics.unresolved) {
    addGap(gaps, makeGap(
      "CATEGORY_UNSUPPORTED", "critical", ["category"], "source", "schema_contract_review"
    ));
  }
}

function auditSafety(product, role, gaps) {
  const hasRisk = isPresent(product.irritation_risk);
  const validRisk = hasRisk && RECOGNIZED_SAFETY_VALUES.has(normalizeText(product.irritation_risk));
  const hasSafe = typeof product.sensitivity_safe === "boolean";

  if (hasRisk && !validRisk) {
    addGap(gaps, makeGap(
      "SAFETY_VALUE_INVALID", "important", ["irritation_risk"],
      "source", "manual_review"
    ));
  }
  if (hasOwn(product, "sensitivity_safe") && product.sensitivity_safe == null) {
    addGap(gaps, makeGap(
      "SAFETY_UNKNOWN_COERCED", "critical", ["sensitivity_safe"],
      "recommendation_mapping", "adapter_fix"
    ));
  }
  if (ACTIVE_ROLES.has(role) && (!validRisk || !hasSafe)) {
    addGap(gaps, makeGap(
      "ACTIVE_PRODUCT_SAFETY_MISSING", "important",
      ["irritation_risk", "sensitivity_safe"], "source", "data_backfill"
    ));
  }
  return {
    present: hasRisk || hasSafe,
    valid: (!hasRisk || validRisk) && (!hasOwn(product, "sensitivity_safe") || hasSafe),
    ready: validRisk && hasSafe
  };
}

function auditSunscreen(product, profile, gaps) {
  if (profile.categoryRole !== "protection") {
    return { protectionReady: false, preferenceReady: false };
  }

  const uvAxis = profile.functionalAxes.some((axis) => axis.axis === "sunscreen_protection");
  const protectionPresent = SUNSCREEN_PROTECTION_FIELDS.filter((field) => isPresent(product[field]));
  const preferencePresent = SUNSCREEN_PREFERENCE_FIELDS.filter((field) => isPresent(product[field]));

  if (!uvAxis) {
    addGap(gaps, makeGap(
      "SUNSCREEN_PROTECTION_SIGNAL_MISSING", "important",
      ["ingredient_signals.functional"], "functional_profile", "data_backfill"
    ));
  }
  if (protectionPresent.length === 0) {
    addGap(gaps, makeGap(
      "SUNSCREEN_METADATA_MISSING", "important", SUNSCREEN_PROTECTION_FIELDS,
      "source", "data_backfill"
    ));
  } else if (protectionPresent.length < SUNSCREEN_PROTECTION_FIELDS.length) {
    addGap(gaps, makeGap(
      "SUNSCREEN_METADATA_PARTIAL", "important", SUNSCREEN_PROTECTION_FIELDS,
      "source", "data_backfill"
    ));
  }
  if (preferencePresent.length < SUNSCREEN_PREFERENCE_FIELDS.length) {
    addGap(gaps, makeGap(
      "SUNSCREEN_PREFERENCE_METADATA_MISSING", "important",
      SUNSCREEN_PREFERENCE_FIELDS, "source", "data_backfill"
    ));
  }

  return {
    protectionReady: uvAxis && protectionPresent.length === SUNSCREEN_PROTECTION_FIELDS.length,
    preferenceReady: preferencePresent.length === SUNSCREEN_PREFERENCE_FIELDS.length
  };
}

function auditQuality(product, gaps) {
  const checks = [
    ["skin_types", "SKIN_TYPE_MISSING"],
    ["concerns", "CONCERN_MISSING"],
    ["texture", "TEXTURE_MISSING"],
    ["finish", "FINISH_MISSING"],
    ["review_signals", "REVIEW_SIGNAL_MISSING"],
    ["market_signals", "MARKET_SIGNAL_MISSING"],
    ["buy_link", "BUY_LINK_MISSING"],
    ["image_url", "IMAGE_MISSING"]
  ];
  for (const [field, code] of checks) {
    if (!isPresent(product[field]) && !(Array.isArray(product[field]) && product[field].length)) {
      addGap(gaps, makeGap(code, "quality", [field], "source", "data_backfill"));
    }
  }
  if (!isPresent(product.price_min) && !isPresent(product.price_max)) {
    addGap(gaps, makeGap("PRICE_MISSING", "quality", ["price_min", "price_max"], "source", "data_backfill"));
  }
  const provenance = [
    product.source_url,
    product.hwahae_url,
    product?.ingredient_signals?.source,
    product?.review_signals?.source,
    product?.market_signals?.source
  ].some(isPresent);
  if (!provenance) {
    addGap(gaps, makeGap(
      "PROVENANCE_MISSING", "quality",
      ["source_url", "hwahae_url", "ingredient_signals.source"],
      "source", "manual_review"
    ));
  }
  return provenance;
}

function auditTransport(product, gaps) {
  const result = {};
  for (const field of SOURCE_FIELDS) {
    const recommendation = transportState(product, field, "recommendation");
    const currentSnapshot = transportState(product, field, "currentSnapshot");
    result[field] = { recommendation, currentSnapshot };
    if (recommendation === "dropped") {
      addGap(gaps, makeGap(
        "RECOMMENDATION_FIELD_DROPPED", "critical", [field],
        "recommendation_mapping", "adapter_fix"
      ));
    }
    if (currentSnapshot === "dropped") {
      addGap(gaps, makeGap(
        "SNAPSHOT_FIELD_DROPPED", "critical", [field],
        "current_snapshot", "adapter_fix"
      ));
    }
  }
  return result;
}

function sortGaps(gaps) {
  return gaps.sort((left, right) =>
    (SEVERITY_RANK[left.severity] - SEVERITY_RANK[right.severity]) ||
    left.code.localeCompare(right.code) ||
    left.stage.localeCompare(right.stage) ||
    left.fieldPaths.join(",").localeCompare(right.fieldPaths.join(","))
  );
}

function makeRowKey(product, index) {
  const id = String(product?.id ?? "").trim();
  if (id) return id;
  return `${normalizeText(product?.brand)}::${normalizeText(product?.name)}::${index}`;
}

function buildRow(product, index, duplicateIds) {
  const gaps = [];
  const strictSemantics = resolveProductCategorySemantics(product);
  const looseSemantics = normalizeProductCategory(product.category);
  const profile = resolveProductFunctionalProfile(product);

  auditIdentityAndCategory(product, strictSemantics, gaps);
  if (isPresent(product.id) && duplicateIds.has(String(product.id).trim())) {
    addGap(gaps, makeGap("PRODUCT_ID_DUPLICATE", "critical", ["id"], "source", "manual_review"));
  }

  const functional = auditFunctionalSource(product, profile, gaps);
  const safety = auditSafety(product, profile.categoryRole, gaps);
  const sunscreen = auditSunscreen(product, profile, gaps);
  const provenanceReady = auditQuality(product, gaps);
  const transportStatus = auditTransport(product, gaps);
  const transportComplete = Object.values(transportStatus).every(
    (state) => !["dropped", "coerced"].includes(state.recommendation) &&
      !["dropped", "coerced"].includes(state.currentSnapshot)
  );

  const sourceStatus = {};
  for (const field of SOURCE_FIELDS) {
    sourceStatus[field] = sourceState(
      product,
      field,
      profile.categoryRole === "protection" ||
        !SUNSCREEN_PROTECTION_FIELDS.concat(SUNSCREEN_PREFERENCE_FIELDS).includes(field)
    );
  }

  const identityReady = [product.id, product.brand, product.name].every(isPresent);
  const rankingEvidenceReady =
    Array.isArray(product.skin_types) && product.skin_types.length > 0 &&
    Array.isArray(product.concerns) && product.concerns.length > 0 &&
    isPresent(product.texture) && isPresent(product.finish);
  const commerceMetadataReady =
    (isPresent(product.price_min) || isPresent(product.price_max)) &&
    isPresent(product.image_url);

  return {
    rowKey: makeRowKey(product, index),
    productId: isPresent(product.id) ? String(product.id).trim() : null,
    brand: isPresent(product.brand) ? String(product.brand).trim() : null,
    name: isPresent(product.name) ? String(product.name).trim() : null,
    rawCategory: isPresent(product.category) ? String(product.category).trim() : null,
    canonicalCategory: strictSemantics.canonicalCategory || looseSemantics.canonicalCategory,
    productForm: isPresent(product.product_form) ? String(product.product_form).trim() : null,
    categorySemantics: {
      recommendationEligible: strictSemantics.authorizesRecommendationCategory === true,
      currentProductCategoryUsable: profile.categoryRole !== "unknown",
      unresolvedReason: strictSemantics.unresolvedReason || null
    },
    capabilities: {
      identityReady,
      recommendationCategoryReady: strictSemantics.authorizesRecommendationCategory === true,
      currentProductCategoryReady: profile.categoryRole !== "unknown",
      routineRoleReady: profile.categoryRole !== "unknown",
      functionalSignalPresent: functional.present,
      recognizedAxisPresent: profile.functionalAxes.length > 0,
      functionalProfileEvaluable: profile.evaluable === true,
      directGoalSupportEvaluable: profile.evaluable === true && !profile.cautionTags.includes("rinse_off_limit"),
      duplicateAxisEvaluable: profile.functionalAxes.some(
        (axis) => ["medium", "high"].includes(axis.confidence) &&
          ["medium", "high"].includes(axis.strength)
      ),
      safetyValuePresent: safety.present,
      safetyValueValid: safety.valid,
      safetyDecisionReady: safety.ready,
      safetyProvenanceReady: provenanceReady && safety.present,
      sunscreenProtectionReady: sunscreen.protectionReady,
      sunscreenPreferenceReady: sunscreen.preferenceReady,
      rankingEvidenceReady,
      commerceMetadataReady,
      provenanceReady,
      transportComplete
    },
    functionalAxes: profile.functionalAxes.map(({ axis, strength, confidence }) => ({
      axis, strength, confidence
    })),
    unknownFunctionalLabels: [...new Set(profile.unknownFunctionalLabels || [])]
      .map((label) => normalizeText(label))
      .filter(Boolean)
      .sort(),
    sourceStatus,
    transportStatus,
    gaps: sortGaps(gaps)
  };
}

function countBy(rows, predicate) {
  return rows.filter(predicate).length;
}

function summarizeGaps(rows) {
  const all = rows.flatMap((row) => row.gaps);
  return {
    criticalGapCount: countBy(all, (gap) => gap.severity === "critical"),
    importantGapCount: countBy(all, (gap) => gap.severity === "important"),
    qualityGapCount: countBy(all, (gap) => gap.severity === "quality")
  };
}

function buildCategorySummary(rows) {
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
    for (const gap of row.gaps) bucket[`${gap.severity}GapCount`] += 1;
    result[key] = bucket;
  }
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
}

function buildAxisSummary(rows) {
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

function buildFieldSummary(rows) {
  const result = {};
  for (const field of SOURCE_FIELDS) {
    const applicable = rows.filter((row) => row.sourceStatus[field].state !== "not_applicable");
    result[field] = {
      applicableCount: applicable.length,
      presentCount: countBy(applicable, (row) => row.sourceStatus[field].state === "present"),
      usableCount: countBy(applicable, (row) => row.sourceStatus[field].state === "present"),
      defaultedCount: countBy(rows, (row) =>
        row.transportStatus[field].recommendation === "defaulted" ||
        row.transportStatus[field].currentSnapshot === "defaulted"
      ),
      coercedCount: countBy(rows, (row) =>
        row.transportStatus[field].recommendation === "coerced" ||
        row.transportStatus[field].currentSnapshot === "coerced"
      ),
      droppedFromRecommendationCount: countBy(
        rows, (row) => row.transportStatus[field].recommendation === "dropped"
      ),
      droppedFromCurrentSnapshotCount: countBy(
        rows, (row) => row.transportStatus[field].currentSnapshot === "dropped"
      )
    };
  }
  return result;
}

function buildUnknownLabels(rows) {
  const labels = new Map();
  for (const row of rows) {
    for (const label of row.unknownFunctionalLabels) {
      const bucket = labels.get(label) || new Set();
      bucket.add(row.productId || row.rowKey);
      labels.set(label, bucket);
    }
  }
  return [...labels.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, ids]) => ({
      label,
      productCount: ids.size,
      sampleProductIds: [...ids].sort().slice(0, 5)
    }));
}

function buildTransportGaps(rows) {
  const map = new Map();
  for (const row of rows) {
    for (const [field, states] of Object.entries(row.transportStatus)) {
      for (const [destination, state] of Object.entries(states)) {
        if (state !== "dropped") continue;
        const normalizedDestination = destination === "recommendation"
          ? "recommendation_product"
          : "current_product_snapshot";
        const key = `${field}|${normalizedDestination}`;
        const bucket = map.get(key) || new Set();
        bucket.add(row.productId || row.rowKey);
        map.set(key, bucket);
      }
    }
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, ids]) => {
      const [fieldPath, destination] = key.split("|");
      return {
        fieldPath,
        destination,
        affectedCount: ids.size,
        sampleProductIds: [...ids].sort().slice(0, 5)
      };
    });
}

function buildBacklog(rows) {
  const buckets = {
    adapter_fix: "adapterFixes",
    data_backfill: "dataBackfills",
    manual_review: "manualReviews",
    schema_contract_review: "schemaContractReviews",
    label_registry_review: "labelRegistryReviews"
  };
  const map = new Map();
  for (const row of rows) {
    for (const gap of row.gaps) {
      const key = `${gap.remediation}|${gap.code}|${gap.severity}`;
      const item = map.get(key) || {
        code: gap.code,
        severity: gap.severity,
        fieldPaths: new Set(),
        productIds: new Set()
      };
      gap.fieldPaths.forEach((field) => item.fieldPaths.add(field));
      item.productIds.add(row.productId || row.rowKey);
      map.set(key, item);
    }
  }
  const result = {
    adapterFixes: [], dataBackfills: [], manualReviews: [],
    schemaContractReviews: [], labelRegistryReviews: []
  };
  for (const [key, item] of [...map.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const remediation = key.split("|")[0];
    result[buckets[remediation]].push({
      code: item.code,
      severity: item.severity,
      affectedCount: item.productIds.size,
      fieldPaths: [...item.fieldPaths].sort(),
      sampleProductIds: [...item.productIds].sort().slice(0, 5)
    });
  }
  return result;
}

export function buildProductDataSufficiencyAudit(rawProducts, options = {}) {
  if (!Array.isArray(rawProducts)) {
    return {
      version: PRODUCT_DATA_SUFFICIENCY_AUDIT_VERSION,
      dataset: { sourceType: options.sourceType || "fixture", datasetHash: "", rowCount: 0 },
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

  const sortedProducts = [...rawProducts].sort((left, right) =>
    JSON.stringify(stableClone(left)).localeCompare(JSON.stringify(stableClone(right)))
  );
  const idCounts = new Map();
  for (const product of sortedProducts) {
    const id = String(product?.id ?? "").trim();
    if (id) idCounts.set(id, (idCounts.get(id) || 0) + 1);
  }
  const duplicateIds = new Set([...idCounts.entries()].filter(([, count]) => count > 1).map(([id]) => id));
  const rows = sortedProducts
    .map((product, index) => buildRow(product, index, duplicateIds))
    .sort((left, right) =>
      String(left.canonicalCategory || "").localeCompare(String(right.canonicalCategory || "")) ||
      String(left.brand || "").localeCompare(String(right.brand || "")) ||
      String(left.name || "").localeCompare(String(right.name || "")) ||
      String(left.productId || "").localeCompare(String(right.productId || "")) ||
      left.rowKey.localeCompare(right.rowKey)
    );

  const gapSummary = summarizeGaps(rows);
  const capabilityCount = (name) => countBy(rows, (row) => row.capabilities[name]);

  return {
    version: PRODUCT_DATA_SUFFICIENCY_AUDIT_VERSION,
    dataset: {
      sourceType: options.sourceType === "raw_export" ? "raw_export" : "fixture",
      datasetHash: hashDataset(rawProducts),
      rowCount: rawProducts.length
    },
    status: gapSummary.criticalGapCount > 0 ? "critical_gaps" : "audit_complete",
    summary: {
      totalProducts: rows.length,
      identityReadyCount: capabilityCount("identityReady"),
      recommendationEligibleCount: capabilityCount("recommendationCategoryReady"),
      currentProductCategoryReadyCount: capabilityCount("currentProductCategoryReady"),
      routineRoleReadyCount: capabilityCount("routineRoleReady"),
      functionalSignalPresentCount: capabilityCount("functionalSignalPresent"),
      functionalProfileEvaluableCount: capabilityCount("functionalProfileEvaluable"),
      directGoalSupportEvaluableCount: capabilityCount("directGoalSupportEvaluable"),
      duplicateAxisEvaluableCount: capabilityCount("duplicateAxisEvaluable"),
      safetyDecisionReadyCount: capabilityCount("safetyDecisionReady"),
      sunscreenProtectionReadyCount: capabilityCount("sunscreenProtectionReady"),
      sunscreenPreferenceReadyCount: capabilityCount("sunscreenPreferenceReady"),
      rankingEvidenceReadyCount: capabilityCount("rankingEvidenceReady"),
      commerceMetadataReadyCount: capabilityCount("commerceMetadataReady"),
      provenanceReadyCount: capabilityCount("provenanceReady"),
      transportCompleteCount: capabilityCount("transportComplete"),
      ...gapSummary
    },
    byCategory: buildCategorySummary(rows),
    byFunctionalAxis: buildAxisSummary(rows),
    byField: buildFieldSummary(rows),
    unknownFunctionalLabels: buildUnknownLabels(rows),
    transportGaps: buildTransportGaps(rows),
    remediationBacklog: buildBacklog(rows),
    rows
  };
}
