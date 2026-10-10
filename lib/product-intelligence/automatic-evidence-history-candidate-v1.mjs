import { createHash } from "node:crypto";
import { AUTOMATIC_SUNSCREEN_FIELD_NAMES } from "./automatic-product-evidence-evaluator-v1.mjs";

export const AUTOMATIC_EVIDENCE_HISTORY_CONTRACT_VERSION =
  "automatic-evidence-history-candidate-v1";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/i;
const STATES = new Set(["verified_fact", "review_signal", "insufficient"]);

function fail(code) { throw new Error(code); }
function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (record(value)) return Object.fromEntries(
    Object.keys(value).sort().map(key => [key, stable(value[key])]));
  return value;
}
function sha(value) {
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}
function sorted(values) { return [...new Set(values)].sort(); }
function validateDate(date) {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(date) ||
      !Number.isFinite(Date.parse(date)) || new Date(date).toISOString() !== date)
    fail("HISTORY_INVALID_EVALUATION_TIME");
}
function normaliseFields(evaluation) {
  if (!record(evaluation.fields) ||
      Object.keys(evaluation.fields).length !== AUTOMATIC_SUNSCREEN_FIELD_NAMES.length)
    fail("HISTORY_INVALID_FIELDS");
  return Object.fromEntries(AUTOMATIC_SUNSCREEN_FIELD_NAMES.map(field => {
    const value = evaluation.fields[field];
    if (!record(value) || value.field !== field || !STATES.has(value.status) ||
        (value.status === "verified_fact" && typeof value.value !== "string") ||
        (value.status !== "verified_fact" && value.value !== null) ||
        !Array.isArray(value.evidenceRefs))
      fail("HISTORY_INVALID_FIELD:" + field);
    return [field, {
      status:value.status,
      value:value.value,
      trend:value.trend,
      uncertainty:value.uncertainty,
      evidenceRefs:sorted(value.evidenceRefs),
      reviewObservationCounts:value.reviewObservationCounts,
      claimsDigest:sha(value.claims ?? []),
    }];
  }));
}
function scopedProvenance(rows, evaluation, diagnostics) {
  const productId = evaluation.productId;
  const subjectId = evaluation.subjectId;
  const accepted = diagnostics.protectedSunscreenFacts;
  if (!Array.isArray(accepted) || !Array.isArray(rows.factEvidenceLinks) ||
      !Array.isArray(rows.evidenceRecords) || !Array.isArray(rows.evidenceBindings) ||
      !Array.isArray(rows.evidenceSources) || !Array.isArray(rows.taxonomy))
    fail("HISTORY_SOURCE_SNAPSHOT_INCOMPLETE");
  const official = [];
  for (const fact of accepted) {
    if (!UUID.test(fact.factInstanceId)) fail("HISTORY_INVALID_FACT_ID");
    const linked = rows.factEvidenceLinks.filter(l =>
      l.fact_instance_id === fact.factInstanceId &&
      l.subject_id === subjectId && l.link_role === "supporting");
    const matched = [];
    for (const link of linked) {
      const e = rows.evidenceRecords.find(e =>
        e.evidence_id === link.evidence_id && e.subject_id === subjectId &&
        e.fact_key === fact.key && e.registry_version === fact.registryVersion &&
        e.proposition_key === link.proposition_key &&
        e.binding_state === "exact_subject_match" &&
        e.evidence_authority === "product_specific_primary" &&
        e.support_direction === "supports");
      if (!e) continue;
      const b = rows.evidenceBindings.find(b =>
        b.binding_id === e.binding_id && b.source_id === e.source_id &&
        b.product_id === productId && b.subject_id === subjectId &&
        b.binding_state === "exact_subject_match" && b.scope_relation === "equivalent");
      const s = rows.evidenceSources.find(s =>
        s.source_id === e.source_id && SHA256.test(String(s.content_digest ?? "")) &&
        ["official_product_page", "brand_official_product_page"].includes(s.source_kind));
      if (!b || !s) continue;
      matched.push({
        factKey:fact.key, factInstanceId:fact.factInstanceId, evidenceId:e.evidence_id,
        sourceId:s.source_id, contentDigest:s.content_digest.toLowerCase(),
        registryVersion:fact.registryVersion, value:fact.value,
      });
    }
    if (!matched.length) fail("HISTORY_MISSING_ACCEPTED_FACT_PROVENANCE:" + fact.key);
    official.push(...matched);
  }
  const tax = rows.taxonomy.filter(x => x.product_id === productId &&
    x.taxonomy_version === "catalog-taxonomy-v1" &&
    x.category_term_id === "catalog-taxonomy-v1:category:sunscreen" &&
    x.assignment_state === "shadow" && x.assignment_method === "source_classification");
  const taxonomy = evaluation.fields.category_slot.status === "verified_fact" ?
    (tax.length === 1 ? tax.map(x=>({
      taxonomyVersion:x.taxonomy_version,categoryTermId:x.category_term_id,
      assignmentState:x.assignment_state,assignmentMethod:x.assignment_method,
    })) : fail("HISTORY_TAXONOMY_AUTHORITY_MISSING")) : [];
  const verifiedReview = diagnostics.reviewSourceTrusted === true;
  const reviewSource = verifiedReview ?
    { source:"hwahae_ai_review", sourceDigest:sha(rows.product.review_signals) } :
    { source:"unavailable" };
  return {
    official:official.sort((a,b)=>
      (a.factInstanceId+"|"+a.evidenceId).localeCompare(b.factInstanceId+"|"+b.evidenceId)),
    taxonomy,
    reviewSource,
  };
}

/**
 * Pure, server-side candidate for future governed history persistence.
 * Does not insert, confirm, mutate recommendation admission, or create admin tasks.
 */
export function buildAutomaticEvidenceHistoryCandidate(rows, result, evaluatedAt) {
  validateDate(evaluatedAt);
  if (!record(rows) || !record(result) || result.dataOrigin !== "SERVER_READ_ONLY" ||
      result.databaseWrites !== 0 || result.adminReviewWrites !== 0 ||
      result.recommendationWrites !== 0)
    fail("HISTORY_UNTRUSTED_READ_RESULT");
  const evaluation = result.evaluation;
  if (!record(evaluation) || !UUID.test(String(evaluation.productId)) ||
      !UUID.test(String(evaluation.subjectId)) ||
      !record(result.diagnostics) ||
      evaluation.admissionGranted !== false ||
      evaluation.adminReviewsCreated !== 0 ||
      evaluation.productionWrites !== 0 || evaluation.rankingChanged !== false ||
      evaluation.publicActivation !== false)
    fail("HISTORY_AUTHORITY_BOUNDARY_VIOLATION");
  const fields = normaliseFields(evaluation);
  const sourceSnapshot = scopedProvenance(rows,evaluation,result.diagnostics);
  const sourceDigest = sha(sourceSnapshot);
  const decision = {
    fields, evidenceReady:evaluation.evidenceReady,
    researchNeeds:sorted(evaluation.researchNeeds),
    exceptions:[...evaluation.exceptions].map(x=>({code:x.code,field:x.field}))
      .sort((a,b)=>(a.code+"|"+a.field).localeCompare(b.code+"|"+b.field)),
    contextCautions:sorted(evaluation.contextCautions),
  };
  const decisionDigest = sha(decision);
  const versions = {
    evaluator:evaluation.version, adapter:result.adapterVersion,
    historyContract:AUTOMATIC_EVIDENCE_HISTORY_CONTRACT_VERSION,
  };
  const idempotencyKey = sha({
    productId:evaluation.productId,subjectId:evaluation.subjectId,
    versions,sourceDigest,decisionDigest,
  });
  return Object.freeze({
    contractVersion:AUTOMATIC_EVIDENCE_HISTORY_CONTRACT_VERSION,
    writeState:"NOT_SAVED",
    actorType:"automatic_evidence_system",
    productId:evaluation.productId,subjectId:evaluation.subjectId,
    evaluatedAt,versions,sourceDigest,decisionDigest,idempotencyKey,
    sourceEvidenceDigests:sorted(sourceSnapshot.official.map(x=>x.contentDigest)),
    fields, evidenceReady:evaluation.evidenceReady,
    researchNeeds:decision.researchNeeds,
    exceptions:decision.exceptions,
    contextCautions:decision.contextCautions,
    databaseWrites:0,adminReviewWrites:0,recommendationWrites:0,
  });
}

export function compareAutomaticEvidenceHistoryCandidates(previous, current) {
  if (!record(current) || current.contractVersion !== AUTOMATIC_EVIDENCE_HISTORY_CONTRACT_VERSION ||
      current.writeState !== "NOT_SAVED" ||
      !SHA256.test(String(current.idempotencyKey ?? "")))
    fail("HISTORY_INVALID_CURRENT_CANDIDATE");
  if (previous === null) return Object.freeze({kind:"first_observation",changedFields:[]});
  if (!record(previous) || previous.contractVersion !== current.contractVersion ||
      previous.productId !== current.productId || previous.subjectId !== current.subjectId)
    fail("HISTORY_PREVIOUS_SCOPE_MISMATCH");
  if (!SHA256.test(String(previous.idempotencyKey ?? "")) ||
      !SHA256.test(String(previous.decisionDigest ?? "")) ||
      !SHA256.test(String(previous.sourceDigest ?? "")) ||
      !record(previous.fields) || !record(current.fields))
    fail("HISTORY_INVALID_PREVIOUS_CANDIDATE");
  if (previous.idempotencyKey === current.idempotencyKey)
    return Object.freeze({kind:"duplicate",changedFields:[]});
  const changedFields = AUTOMATIC_SUNSCREEN_FIELD_NAMES.filter(name =>
    sha(previous.fields?.[name]) !== sha(current.fields?.[name]));
  if (previous.decisionDigest === current.decisionDigest) {
    const kind = previous.sourceDigest === current.sourceDigest ?
      "evaluation_version_change" : "evidence_refresh";
    return Object.freeze({kind,changedFields:[]});
  }
  return Object.freeze({kind:"assessment_changed",changedFields});
}
