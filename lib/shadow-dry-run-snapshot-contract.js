import { createHash } from "node:crypto";

export const SHADOW_DRY_RUN_SNAPSHOT_CONTRACT_VERSION = "2026-07-10.phase34";

export const ALLOWED_SNAPSHOT_FIELDS = {
  baselineResponseShapeSnapshot: [
    "snapshotType",
    "contractVersion",
    "runtimeConnected",
    "routeInvoked",
    "supabaseWriteExecuted",
    "runtimeMutation",
    "topLevelKeys",
    "responseShapeHash",
    "valueDumped"
  ],
  baselineRecommendationSnapshot: [
    "snapshotType",
    "contractVersion",
    "runtimeConnected",
    "routeInvoked",
    "supabaseWriteExecuted",
    "runtimeMutation",
    "topPickId",
    "supportingProductIdsInOrder",
    "budgetAlternativeIdsInOrder"
  ],
  shadowBoundaryHintSnapshot: [
    "snapshotType",
    "contractVersion",
    "runtimeConnected",
    "routeInvoked",
    "supabaseWriteExecuted",
    "runtimeMutation",
    "boundaryHints"
  ],
  shadowReceiverSnapshot: [
    "snapshotType",
    "contractVersion",
    "runtimeConnected",
    "routeInvoked",
    "supabaseWriteExecuted",
    "runtimeMutation",
    "receivers",
    "aggregate"
  ],
  comparisonSnapshot: [
    "snapshotType",
    "contractVersion",
    "runtimeConnected",
    "routeInvoked",
    "supabaseWriteExecuted",
    "runtimeMutation",
    "responseShapeChanged",
    "recommendationChanged",
    "topPickChanged",
    "supportingProductsChanged",
    "budgetAlternativesChanged",
    "hiddenToCollapsedDelta",
    "collapsedToHiddenRegression",
    "highRiskCollapsedReceiverCount",
    "sensitivityUnsafeCollapsedReceiverCount",
    "metadataIncompleteCollapsedReceiverCount",
    "strongCautionCollapsedReceiverCount",
    "dbWriteCount",
    "forbiddenFieldDetected",
    "boundaryHintRowsCompared",
    "killConditionTriggered",
    "killConditionReasons"
  ]
};

export const FORBIDDEN_SNAPSHOT_FIELDS = [
  "product_name",
  "productName",
  "name",
  "brand",
  "purchase_url",
  "purchaseUrl",
  "buy_link",
  "buyLink",
  "review_text",
  "reviewText",
  "raw_form",
  "rawForm",
  "image",
  "image_url",
  "imageUrl",
  "base64",
  "pii",
  "email",
  "cookie",
  "user_agent",
  "userAgent",
  "env",
  "secret",
  "token",
  "apiKey",
  "full_api_response_body",
  "fullApiResponseBody",
  "apiResponseBody",
  "responseBody"
];

const SNAPSHOT_TYPES = new Set(Object.keys(ALLOWED_SNAPSHOT_FIELDS));
const FORBIDDEN_KEY_NORMALIZED = new Set(FORBIDDEN_SNAPSHOT_FIELDS.map(normalizeKey));
const FORBIDDEN_VALUE_PATTERNS = [
  /data:image\//i,
  /base64,[A-Za-z0-9+/=]{20,}/i,
  /https?:\/\/[^\s")]+/i,
  /Bearer\s+[A-Za-z0-9._-]+/i,
  /SUPABASE_[A-Z_]*=\S+/i,
  /NEXT_PUBLIC_SUPABASE_[A-Z_]*=\S+/i,
  /(?:secret|token|api[_-]?key)\s*[:=]\s*[A-Za-z0-9._-]{8,}/i
];

function normalizeKey(value) {
  return String(value || "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function addError(errors, code, path, message) {
  errors.push({ code, path, message });
}

function walk(value, path, visitor) {
  visitor(value, path);
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${path}[${index}]`, visitor));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      walk(child, path ? `${path}.${key}` : key, visitor);
    }
  }
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function shapeOf(value, depth = 0) {
  if (depth > 2) {
    return "object";
  }
  if (Array.isArray(value)) {
    return { type: "array", itemShape: value.length > 0 ? shapeOf(value[0], depth + 1) : "empty" };
  }
  if (value && typeof value === "object") {
    return {
      type: "object",
      keys: Object.keys(value).sort()
    };
  }
  if (value === null) {
    return "null";
  }
  return typeof value;
}

function hashShape(value) {
  return createHash("sha256").update(stableStringify(shapeOf(value))).digest("hex");
}

function baseSnapshot(snapshotType) {
  return {
    snapshotType,
    contractVersion: SHADOW_DRY_RUN_SNAPSHOT_CONTRACT_VERSION,
    runtimeConnected: false,
    routeInvoked: false,
    supabaseWriteExecuted: false,
    runtimeMutation: false
  };
}

function idOf(item) {
  if (!item || typeof item !== "object") {
    return item == null ? null : String(item);
  }
  return item.id == null ? null : String(item.id);
}

function idsOf(items) {
  return Array.isArray(items) ? items.map(idOf).filter(Boolean) : [];
}

function compactReasonKeys(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item)).filter(Boolean).sort();
}

function countReceivers(receivers, predicate) {
  return receivers.filter(predicate).length;
}

export function buildBaselineResponseShapeSnapshot(responseLike = {}) {
  const response = responseLike && typeof responseLike === "object" ? responseLike : {};
  return {
    ...baseSnapshot("baselineResponseShapeSnapshot"),
    topLevelKeys: Object.keys(response).sort(),
    responseShapeHash: hashShape(response),
    valueDumped: false
  };
}

export function buildBaselineRecommendationSnapshot(recommendationLike = {}) {
  const recommendation = recommendationLike && typeof recommendationLike === "object" ? recommendationLike : {};
  return {
    ...baseSnapshot("baselineRecommendationSnapshot"),
    topPickId: idOf(recommendation.topPick),
    supportingProductIdsInOrder: idsOf(recommendation.supportingProducts),
    budgetAlternativeIdsInOrder: idsOf(recommendation.budgetAlternatives)
  };
}

export function buildShadowBoundaryHintSnapshot(boundaryHintLike = []) {
  const rows = Array.isArray(boundaryHintLike) ? boundaryHintLike : [boundaryHintLike].filter(Boolean);
  return {
    ...baseSnapshot("shadowBoundaryHintSnapshot"),
    boundaryHints: rows.map((row) => ({
      productId: idOf(row.productId ?? row.product),
      category: row.category == null ? null : String(row.category),
      sourceHardFilterReason: row.sourceHardFilterReason == null ? null : String(row.sourceHardFilterReason),
      boundaryDecision: row.boundaryDecision == null ? null : String(row.boundaryDecision),
      futureEvaluatorAction: row.futureEvaluatorAction == null ? null : String(row.futureEvaluatorAction),
      candidatePolicyHint: row.candidatePolicyHint == null ? null : String(row.candidatePolicyHint),
      safetyMetadataClass: row.safetyMetadataClass == null ? null : String(row.safetyMetadataClass),
      reasonKeys: compactReasonKeys(row.reasonKeys || row.reasons)
    }))
  };
}

export function buildShadowReceiverSnapshot(receiverLike = []) {
  const rows = Array.isArray(receiverLike) ? receiverLike : [receiverLike].filter(Boolean);
  const receivers = rows.map((row) => ({
    productId: idOf(row.productId ?? row.product),
    category: row.category == null ? null : String(row.category),
    receivedHint: row.receivedHint == null ? null : String(row.receivedHint),
    receiverDecision: row.receiverDecision == null ? null : String(row.receiverDecision),
    futureExposureGroup: row.futureExposureGroup == null ? null : String(row.futureExposureGroup),
    visibilityPriority: row.visibilityPriority == null ? null : String(row.visibilityPriority),
    userMessageType: row.userMessageType == null ? null : String(row.userMessageType),
    safetyMetadataClass: row.safetyMetadataClass == null ? null : String(row.safetyMetadataClass),
    reasonKeys: compactReasonKeys(row.reasonKeys || row.reasons)
  }));

  return {
    ...baseSnapshot("shadowReceiverSnapshot"),
    receivers,
    aggregate: {
      highRiskCollapsedReceiverCount: countReceivers(
        receivers,
        (row) => row.futureExposureGroup === "collapsed_candidate" && row.safetyMetadataClass === "unsafe_high_risk"
      ),
      metadataIncompleteCollapsedReceiverCount: countReceivers(
        receivers,
        (row) => row.futureExposureGroup === "collapsed_candidate" && row.safetyMetadataClass === "metadata_incomplete"
      ),
      strongCautionCollapsedReceiverCount: countReceivers(
        receivers,
        (row) => row.futureExposureGroup === "collapsed_candidate" && row.safetyMetadataClass === "strong_caution"
      )
    }
  };
}

function sameOrdered(left = [], right = []) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function buildShadowComparisonSnapshot({
  baselineResponseShapeSnapshot,
  baselineRecommendationSnapshot,
  shadowBoundaryHintSnapshot,
  shadowReceiverSnapshot,
  shadowResponseShapeSnapshot = baselineResponseShapeSnapshot,
  shadowRecommendationSnapshot = baselineRecommendationSnapshot,
  dbWriteCount = 0,
  forbiddenFieldDetected = false
} = {}) {
  const responseShapeChanged =
    baselineResponseShapeSnapshot?.responseShapeHash !== shadowResponseShapeSnapshot?.responseShapeHash;
  const topPickChanged = baselineRecommendationSnapshot?.topPickId !== shadowRecommendationSnapshot?.topPickId;
  const supportingProductsChanged = !sameOrdered(
    baselineRecommendationSnapshot?.supportingProductIdsInOrder || [],
    shadowRecommendationSnapshot?.supportingProductIdsInOrder || []
  );
  const budgetAlternativesChanged = !sameOrdered(
    baselineRecommendationSnapshot?.budgetAlternativeIdsInOrder || [],
    shadowRecommendationSnapshot?.budgetAlternativeIdsInOrder || []
  );
  const receivers = shadowReceiverSnapshot?.receivers || [];
  const boundaryHints = shadowBoundaryHintSnapshot?.boundaryHints || [];
  const hiddenToCollapsedDelta = receivers.filter((row) => row.futureExposureGroup === "collapsed_candidate").length;
  const collapsedToHiddenRegression = receivers.filter((row) => row.futureExposureGroup === "hidden_candidate").length;
  const aggregate = shadowReceiverSnapshot?.aggregate || {};

  const highRiskCollapsedReceiverCount = Number(aggregate.highRiskCollapsedReceiverCount || 0);
  const metadataIncompleteCollapsedReceiverCount = Number(aggregate.metadataIncompleteCollapsedReceiverCount || 0);
  const strongCautionCollapsedReceiverCount = Number(aggregate.strongCautionCollapsedReceiverCount || 0);
  const sensitivityUnsafeCollapsedReceiverCount = receivers.filter(
    (row) => row.futureExposureGroup === "collapsed_candidate" && row.safetyMetadataClass === "sensitivity_unsafe"
  ).length;

  const killConditionReasons = [
    highRiskCollapsedReceiverCount > 0 ? "high_risk_collapsed_receiver_count_not_zero" : null,
    sensitivityUnsafeCollapsedReceiverCount > 0 ? "sensitivity_unsafe_collapsed_receiver_count_not_zero" : null,
    metadataIncompleteCollapsedReceiverCount > 0 ? "metadata_incomplete_collapsed_receiver_count_not_zero" : null,
    strongCautionCollapsedReceiverCount > 0 ? "strong_caution_collapsed_receiver_count_not_zero" : null,
    Number(dbWriteCount || 0) > 0 ? "db_write_count_not_zero" : null,
    forbiddenFieldDetected ? "forbidden_field_detected" : null,
    responseShapeChanged ? "response_shape_changed" : null,
    topPickChanged || supportingProductsChanged || budgetAlternativesChanged ? "recommendation_changed" : null
  ].filter(Boolean);

  return {
    ...baseSnapshot("comparisonSnapshot"),
    responseShapeChanged,
    recommendationChanged: topPickChanged || supportingProductsChanged || budgetAlternativesChanged,
    topPickChanged,
    supportingProductsChanged,
    budgetAlternativesChanged,
    hiddenToCollapsedDelta,
    collapsedToHiddenRegression,
    highRiskCollapsedReceiverCount,
    sensitivityUnsafeCollapsedReceiverCount,
    metadataIncompleteCollapsedReceiverCount,
    strongCautionCollapsedReceiverCount,
    dbWriteCount: Number(dbWriteCount || 0),
    forbiddenFieldDetected: Boolean(forbiddenFieldDetected),
    boundaryHintRowsCompared: boundaryHints.length,
    killConditionTriggered: killConditionReasons.length > 0,
    killConditionReasons
  };
}

function scanForbidden(snapshot, errors) {
  walk(snapshot, "", (value, currentPath) => {
    const key = currentPath.split(".").pop()?.replace(/\[\d+\]$/g, "") || "";
    const normalized = normalizeKey(key);
    if (FORBIDDEN_KEY_NORMALIZED.has(normalized)) {
      addError(errors, "forbidden_field_present", currentPath, "Forbidden snapshot field is present.");
    }
    if (typeof value === "string") {
      for (const pattern of FORBIDDEN_VALUE_PATTERNS) {
        if (pattern.test(value)) {
          addError(errors, "forbidden_value_present", currentPath, "Forbidden snapshot value pattern is present.");
          break;
        }
      }
    }
  });
}

function validateCommon(snapshot, errors) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    addError(errors, "snapshot_not_object", "", "Snapshot must be an object.");
    return;
  }
  if (!SNAPSHOT_TYPES.has(snapshot.snapshotType)) {
    addError(errors, "invalid_snapshot_type", "snapshotType", "Snapshot type is not allowed.");
    return;
  }
  for (const field of ["contractVersion", "runtimeConnected", "routeInvoked", "supabaseWriteExecuted", "runtimeMutation"]) {
    if (!Object.prototype.hasOwnProperty.call(snapshot, field)) {
      addError(errors, "missing_required_field", field, "Required snapshot field is missing.");
    }
  }
  if (snapshot.runtimeConnected !== false) {
    addError(errors, "runtime_connected_not_false", "runtimeConnected", "Snapshot is design-only and must not be runtime connected.");
  }
  if (snapshot.routeInvoked !== false) {
    addError(errors, "route_invoked_not_false", "routeInvoked", "Snapshot helper must not invoke route.");
  }
  if (snapshot.supabaseWriteExecuted !== false) {
    addError(errors, "supabase_write_executed_not_false", "supabaseWriteExecuted", "Snapshot helper must not write to Supabase.");
  }
  if (snapshot.runtimeMutation !== false) {
    addError(errors, "runtime_mutation_not_false", "runtimeMutation", "Snapshot helper must not mutate runtime state.");
  }
}

function validateByType(snapshot, errors) {
  const allowed = new Set(ALLOWED_SNAPSHOT_FIELDS[snapshot.snapshotType] || []);
  for (const key of Object.keys(snapshot)) {
    if (!allowed.has(key)) {
      addError(errors, "field_not_allowed_for_snapshot_type", key, "Field is not allowed for this snapshot type.");
    }
  }

  if (snapshot.snapshotType === "baselineResponseShapeSnapshot") {
    if (!Array.isArray(snapshot.topLevelKeys) && typeof snapshot.responseShapeHash !== "string") {
      addError(errors, "missing_response_shape_summary", "responseShapeHash", "Response shape summary is required.");
    }
    if (snapshot.valueDumped !== false) {
      addError(errors, "response_value_dumped", "valueDumped", "Response values must not be dumped.");
    }
  }

  if (snapshot.snapshotType === "baselineRecommendationSnapshot") {
    if (!Object.prototype.hasOwnProperty.call(snapshot, "topPickId")) {
      addError(errors, "missing_required_field", "topPickId", "topPickId is required.");
    }
    if (!Array.isArray(snapshot.supportingProductIdsInOrder)) {
      addError(errors, "missing_supporting_product_ids", "supportingProductIdsInOrder", "Supporting product ids are required.");
    }
    if (!Array.isArray(snapshot.budgetAlternativeIdsInOrder)) {
      addError(errors, "missing_budget_alternative_ids", "budgetAlternativeIdsInOrder", "Budget alternative ids are required.");
    }
  }

  if (snapshot.snapshotType === "shadowBoundaryHintSnapshot" && !Array.isArray(snapshot.boundaryHints)) {
    addError(errors, "missing_boundary_hints", "boundaryHints", "Boundary hints are required.");
  }

  if (snapshot.snapshotType === "shadowReceiverSnapshot") {
    if (!Array.isArray(snapshot.receivers)) {
      addError(errors, "missing_receivers", "receivers", "Receiver rows are required.");
    }
    if (!snapshot.aggregate || typeof snapshot.aggregate !== "object") {
      addError(errors, "missing_receiver_aggregate", "aggregate", "Receiver aggregate is required.");
    }
  }

  if (snapshot.snapshotType === "comparisonSnapshot") {
    for (const field of [
      "responseShapeChanged",
      "recommendationChanged",
      "topPickChanged",
      "supportingProductsChanged",
      "budgetAlternativesChanged",
      "highRiskCollapsedReceiverCount",
      "metadataIncompleteCollapsedReceiverCount",
      "strongCautionCollapsedReceiverCount",
      "dbWriteCount",
      "forbiddenFieldDetected"
    ]) {
      if (!Object.prototype.hasOwnProperty.call(snapshot, field)) {
        addError(errors, "missing_required_field", field, "Comparison field is required.");
      }
    }
  }
}

export function validateShadowDryRunSnapshot(snapshot = {}) {
  const errors = [];
  validateCommon(snapshot, errors);
  if (errors.some((error) => error.code === "snapshot_not_object" || error.code === "invalid_snapshot_type")) {
    return {
      valid: false,
      errors,
      contractVersion: SHADOW_DRY_RUN_SNAPSHOT_CONTRACT_VERSION
    };
  }
  validateByType(snapshot, errors);
  scanForbidden(snapshot, errors);

  return {
    valid: errors.length === 0,
    errors,
    contractVersion: SHADOW_DRY_RUN_SNAPSHOT_CONTRACT_VERSION,
    summary: {
      snapshotType: snapshot.snapshotType,
      runtimeConnected: snapshot.runtimeConnected ?? null,
      routeInvoked: snapshot.routeInvoked ?? null,
      supabaseWriteExecuted: snapshot.supabaseWriteExecuted ?? null,
      runtimeMutation: snapshot.runtimeMutation ?? null,
      killConditionTriggered: snapshot.killConditionTriggered ?? false,
      killConditionReasons: snapshot.killConditionReasons || []
    }
  };
}
