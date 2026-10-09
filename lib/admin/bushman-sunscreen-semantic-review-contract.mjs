export const BUSHMAN_SEMANTIC_ADMIN_REVIEW_TARGET = Object.freeze({
  productId: "4608b3b4-8b51-4464-b46e-380b05c1a3d7",
  subjectId: "0b5963bb-67d6-4738-a620-32ec86c1e3d0",
  sourceDecision: "WEB_REVIEW_EVIDENCE_CROSSCHECK_COMPLETE_ADMIN_REVIEW_NOT_EXECUTED",
});
export const BUSHMAN_SEMANTIC_REVIEW_FIELDS = Object.freeze([
  "category_slot", "skin_types", "concerns", "texture", "finish", "uv_filter_type",
  "sensitivity_safe", "irritation_risk", "tone_up", "white_cast", "eye_sting", "pilling_risk",
]);
const CORE = Object.freeze({ category_slot: "sunscreen", uv_filter_type: "hybrid" });
const EVIDENCE_TYPES = new Set([
  "canonical_taxonomy", "product_fact_current", "official_product_page",
  "hwahae_review_signal", "hwahae_review_sample",
]);
const KEYSET = Object.freeze([
  "product_id", "subject_id", "field_name", "review_state", "field_value",
  "confidence", "evidence_records", "supersedes_review_id",
]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function same(a,b) { return JSON.stringify(a) === JSON.stringify(b); }

export function evaluateBushmanSemanticReviewReadiness(evidence, live, fieldName) {
  const target = BUSHMAN_SEMANTIC_ADMIN_REVIEW_TARGET;
  const blocked = (reason) => Object.freeze({ status: "hold", reason, payload: null });
  if (!isRecord(evidence) ||
      evidence.stage !== "DATA-AI29C-FILTER-R4-D-S2" ||
      evidence.decision !== target.sourceDecision ||
      evidence.scope?.productId !== target.productId ||
      evidence.scope?.subjectId !== target.subjectId ||
      evidence.independence?.ownerAssumesSameProductForInternalCatalog !== true ||
      evidence.independence?.manufacturerSignedSkuEquivalence !== false ||
      evidence.execution?.adminRpcExecuted !== false ||
      evidence.execution?.productionWrites !== 0 ||
      evidence.resultCounts?.reviewedProposed !== 12 ||
      evidence.resultCounts?.establishedProposed !== 2 ||
      evidence.resultCounts?.unresolvedProposed !== 10 ||
      !Array.isArray(evidence.rpcPayloadPreview) ||
      evidence.rpcPayloadPreview.length !== 12 ||
      new Set(evidence.rpcPayloadPreview.map(x => x.field_name)).size !== 12) {
    return blocked("FROZEN_S2_EVIDENCE_MISMATCH");
  }
  if (typeof fieldName !== "string" || !BUSHMAN_SEMANTIC_REVIEW_FIELDS.includes(fieldName)) {
    return blocked("FIELD_NOT_IN_S2_SCOPE");
  }
  if (!isRecord(live) ||
      live.productId !== target.productId ||
      live.subjectId !== target.subjectId ||
      live.subjectCount !== 1 ||
      live.contractVersion !== "sunscreen-recommendation-semantic-bundle-v1") {
    return blocked("LIVE_EXACT_SUBJECT_MISMATCH");
  }
  if (!isRecord(live.fields) ||
      !same(Object.keys(live.fields).sort(), [...BUSHMAN_SEMANTIC_REVIEW_FIELDS].sort())) {
    return blocked("LIVE_FIELD_SET_MISMATCH");
  }
  const allPayloads = evidence.rpcPayloadPreview;
  for (const name of BUSHMAN_SEMANTIC_REVIEW_FIELDS) {
    const p = allPayloads.find(x => x.field_name === name);
    const established = Object.hasOwn(CORE, name);
    if (!isRecord(p) || !same(Object.keys(p).sort(), [...KEYSET].sort()) ||
        p.product_id !== target.productId || p.subject_id !== target.subjectId ||
        p.review_state !== (established ? "established" : "reviewed_not_established") ||
        !same(p.field_value, established ? CORE[name] : null) ||
        p.confidence !== (established ? "high" : "unknown") ||
        p.supersedes_review_id !== null ||
        !Array.isArray(p.evidence_records) || p.evidence_records.length === 0 ||
        p.evidence_records.length > 32 ||
        p.evidence_records.some(r =>
          !isRecord(r) ||
          !EVIDENCE_TYPES.has(r.source_type) ||
          typeof r.source_ref !== "string" ||
          r.source_ref.length < 3 || r.source_ref.length > 1000 ||
          (["canonical_taxonomy", "product_fact_current"].includes(r.source_type)
            ? !r.source_ref.startsWith("db:")
            : !r.source_ref.startsWith("https://"))
        ) ||
        (name === "category_slot" && !p.evidence_records.some(r => r.source_type === "canonical_taxonomy")) ||
        (name === "uv_filter_type" && !p.evidence_records.some(r => r.source_type === "product_fact_current"))) {
      return blocked("S2_PAYLOAD_CONTRACT_MISMATCH");
    }
  }
  const current = live.fields[fieldName];
  if (!isRecord(current)) return blocked("CURRENT_FIELD_MISSING");
  if (current.state !== "not_reviewed" || current.reviewId !== null) {
    return blocked("CURRENT_FIELD_ALREADY_REVIEWED_RECHECK_REQUIRED");
  }
  const proposal = allPayloads.find(p => p.field_name === fieldName);
  return Object.freeze({ status: "ready", reason: null, payload: structuredClone(proposal) });
}

export function isBushmanSemanticReviewRequestId(value, fieldName) {
  return typeof value === "string" &&
    typeof fieldName === "string" &&
    BUSHMAN_SEMANTIC_REVIEW_FIELDS.includes(fieldName) &&
    new RegExp(`^data-ai29c-r4ds3-${fieldName}-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`, "i").test(value) &&
    value.length <= 120;
}
