import {
  BUSHMAN_SEMANTIC_ADMIN_REVIEW_TARGET,
  BUSHMAN_SEMANTIC_REVIEW_FIELDS,
} from "./bushman-sunscreen-semantic-review-contract.mjs";

export const BUSHMAN_SEMANTIC_S4_VERSION =
  "data-ai29c-filter-r4-d-s4-semantic-audit-readiness-v1";
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX64 = /^[0-9a-f]{64}$/i;
const READY_SUBJECT_LINEAGE = "trust-phase5-admin-subject-review-v1";
const AUDIT_ACTION = "admin.sunscreen_recommendation_semantic_field_reviewed";
const AUDIT_TARGET = "sunscreen_recommendation_semantic_field_review";

export function evaluateBushmanSemanticS4Audit(evidence, live, audits, subjectLineage) {
  const blockers = new Set();
  let audited = 0;
  const target = BUSHMAN_SEMANTIC_ADMIN_REVIEW_TARGET;
  const proposed = evidence?.rpcPayloadPreview;
  if (evidence?.stage !== "DATA-AI29C-FILTER-R4-D-S2" ||
      evidence?.decision !== target.sourceDecision ||
      evidence?.scope?.productId !== target.productId ||
      evidence?.scope?.subjectId !== target.subjectId ||
      !Array.isArray(proposed) || proposed.length !== 12 ||
      new Set(proposed.map(p => p.field_name)).size !== 12) {
    blockers.add("FROZEN_S2_PROPOSAL_MISMATCH");
  }
  if (live?.productId !== target.productId ||
      live?.subjectId !== target.subjectId ||
      live?.subjectCount !== 1 ||
      live?.contractVersion !== "sunscreen-recommendation-semantic-bundle-v1" ||
      !live.fields ||
      JSON.stringify(Object.keys(live.fields).sort()) !==
        JSON.stringify([...BUSHMAN_SEMANTIC_REVIEW_FIELDS].sort())) {
    blockers.add("LIVE_EXACT_SUBJECT_OR_FIELDS_MISMATCH");
  }
  if (!Array.isArray(audits)) blockers.add("AUDIT_ROWS_UNAVAILABLE");
  const expected = new Map((proposed || []).map(p => [p.field_name, p]));
  const rows = Array.isArray(audits) ? audits : [];
  const ids = new Set();
  for (const name of BUSHMAN_SEMANTIC_REVIEW_FIELDS) {
    const f = live?.fields?.[name];
    const p = expected.get(name);
    if (!f || !p || p.product_id !== target.productId ||
        p.subject_id !== target.subjectId ||
        f.state !== p.review_state ||
        JSON.stringify(f.value) !== JSON.stringify(p.field_value) ||
        f.confidence !== p.confidence) {
      blockers.add("REVIEW_VALUE_OR_STATE_MISMATCH:" + name);
      continue;
    }
    if (!ID.test(String(f.reviewId)) ||
        !HEX64.test(String(f.evidenceDigest)) ||
        typeof f.reviewedAt !== "string" ||
        Number.isNaN(Date.parse(f.reviewedAt)) ||
        ids.has(f.reviewId)) {
      blockers.add("REVIEW_PROVENANCE_INVALID:" + name);
      continue;
    }
    ids.add(f.reviewId);
    const matched = rows.filter(a => a?.target_id === f.reviewId);
    if (matched.length !== 1) {
      blockers.add("AUDIT_CARDINALITY_INVALID:" + name);
      continue;
    }
    const a = matched[0], after = a?.after_value;
    if (!ID.test(String(a?.id)) ||
        a?.action !== AUDIT_ACTION ||
        a?.target_type !== AUDIT_TARGET ||
        after?.product_id !== target.productId ||
        after?.subject_id !== target.subjectId ||
        after?.field_name !== name ||
        after?.review_state !== p.review_state ||
        JSON.stringify(after?.field_value ?? null) !==
          JSON.stringify(p.field_value) ||
        after?.confidence !== p.confidence ||
        after?.evidence_digest !== f.evidenceDigest ||
        a?.metadata?.product_row_mutated !== false ||
        a?.metadata?.recommendation_admission_mutated !== false ||
        a?.metadata?.production_ranking_changed !== false) {
      blockers.add("AUDIT_FACT_OR_MUTATION_MISMATCH:" + name);
      continue;
    }
    audited += 1;
  }

  if (live?.requiredFieldCount !== 12 ||
      live?.reviewedFieldCount !== 12 ||
      live?.establishedFieldCount !== 2 ||
      live?.reviewedNotEstablishedFieldCount !== 10 ||
      live?.notReviewedFieldCount !== 0 ||
      live?.conflictFieldCount !== 0) {
    blockers.add("SEMANTIC_12_OF_12_NOT_CURRENT");
  }
  if (audited !== 12) blockers.add("AUDIT_12_OF_12_NOT_VERIFIED");
  const reviewReady = blockers.size === 0 && audited === 12;
  const subjectAuthorityReady = subjectLineage === READY_SUBJECT_LINEAGE;
  if (!subjectAuthorityReady) blockers.add("SUBJECT_AUTHORITY_NOT_GOVERNED");
  const allBlockers = [...blockers].sort();
  return Object.freeze({
    version: BUSHMAN_SEMANTIC_S4_VERSION,
    reviewed: live?.reviewedFieldCount ?? 0,
    established: live?.establishedFieldCount ?? 0,
    audited,
    required: 12,
    reviewReady,
    subjectAuthorityReady,
    readyForAdmissionPreflight: reviewReady && subjectAuthorityReady,
    admissionGranted: false,
    productionRankingChanged: false,
    recommendationsChanged: false,
    blockers: Object.freeze(allBlockers),
  });
}
