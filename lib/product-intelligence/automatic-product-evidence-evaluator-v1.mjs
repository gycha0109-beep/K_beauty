import {
  SUNSCREEN_SEMANTIC_CORE_FIELDS,
  SUNSCREEN_SEMANTIC_CONTEXT_GATES,
} from "../sunscreen-recommendation-semantic-projection.mjs";

export const AUTOMATIC_PRODUCT_EVIDENCE_EVALUATOR_VERSION =
  "automatic-product-evidence-evaluator-v1";

export const AUTOMATIC_SUNSCREEN_FIELD_NAMES = Object.freeze([
  "category_slot", "skin_types", "concerns", "texture", "finish", "uv_filter_type",
  "sensitivity_safe", "irritation_risk", "tone_up", "white_cast", "eye_sting", "pilling_risk",
]);

const FIELD_SET = new Set(AUTOMATIC_SUNSCREEN_FIELD_NAMES);
const CORE = new Set(SUNSCREEN_SEMANTIC_CORE_FIELDS);
const ACCEPTED_VERIFIED = Object.freeze({
  category_slot: Object.freeze(["sunscreen"]),
  uv_filter_type: Object.freeze(["mineral", "organic", "hybrid"]),
});
const VERIFIED_SOURCE_KINDS = new Set(["governed_product_fact", "canonical_taxonomy"]);
const TREND_DIRECTIONS = new Set(["favorable", "unfavorable"]);
const REVIEW_SOURCE_KINDS = new Set(["individual_review", "aggregate_tag"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function record(x) { return x !== null && typeof x === "object" && !Array.isArray(x); }
function nonempty(s) { return typeof s === "string" && s.trim().length > 0; }
function strict(x, predicate, message) { if (!predicate) throw new TypeError(message); return x; }
function safeUrl(value) {
  if (!nonempty(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch { return false; }
}
function stableSort(items, key) {
  return [...items].sort((a,b) => key(a).localeCompare(key(b)));
}
function freezeRow(row) {
  return Object.freeze({
    ...row,
    evidenceRefs: Object.freeze([...row.evidenceRefs]),
    claims: Object.freeze([...row.claims]),
    reviewObservationCounts: Object.freeze({ ...row.reviewObservationCounts }),
  });
}

export function evaluateAutomaticProductEvidence(input, context = {}) {
  strict(input, record(input), "AUTO_EVIDENCE_INPUT_OBJECT_REQUIRED");
  strict(input.category, input.category === "sunscreen", "AUTO_EVIDENCE_CATEGORY_POLICY_UNREGISTERED");
  strict(input.productId, UUID.test(String(input.productId)), "AUTO_EVIDENCE_PRODUCT_ID_INVALID");
  const subject = input.subject;
  strict(subject, record(subject) && UUID.test(String(subject.subjectId)), "AUTO_EVIDENCE_SUBJECT_ID_INVALID");
  const verifiedFacts = input.verifiedFacts ?? [];
  const manufacturerClaims = input.manufacturerClaims ?? [];
  const reviewObservations = input.reviewObservations ?? [];
  for (const [name,items] of Object.entries({verifiedFacts,manufacturerClaims,reviewObservations})) {
    strict(items, Array.isArray(items) && items.length <= 2000, "AUTO_EVIDENCE_INVALID_COLLECTION:" + name);
  }

  // The trusted server adapter must validate current DB facts and scope. This
  // pure evaluator cannot authenticate claimed confirmed values by itself.
  for(const f of verifiedFacts) {
    strict(f, record(f) && FIELD_SET.has(f.field) &&
      f.confirmed === true && VERIFIED_SOURCE_KINDS.has(f.sourceKind) &&
      nonempty(f.sourceRef) && f.sourceRef.startsWith("db:") &&
      nonempty(f.subjectId) && typeof f.value === "string" &&
      Object.hasOwn(ACCEPTED_VERIFIED, f.field) &&
      ACCEPTED_VERIFIED[f.field].includes(f.value) &&
      (f.field !== "uv_filter_type" || f.sourceKind === "governed_product_fact") &&
      (f.field !== "category_slot" || f.sourceKind === "canonical_taxonomy"),
      "AUTO_EVIDENCE_UNVERIFIED_OR_OUT_OF_POLICY_FACT");
  }
  for(const c of manufacturerClaims) {
    strict(c, record(c) && FIELD_SET.has(c.field) &&
      nonempty(c.statement) && c.statement.length <= 500 &&
      nonempty(c.sourceId) && safeUrl(c.sourceRef),
      "AUTO_EVIDENCE_INVALID_MANUFACTURER_CLAIM");
  }
  for(const r of reviewObservations) {
    strict(r, record(r) && FIELD_SET.has(r.field) &&
      TREND_DIRECTIONS.has(r.direction) &&
      REVIEW_SOURCE_KINDS.has(r.sourceKind) &&
      nonempty(r.sourceId) && safeUrl(r.sourceRef) &&
      (r.context == null || typeof r.context === "string") &&
      (r.mentionCount == null ||
        (Number.isInteger(r.mentionCount) && r.mentionCount >= 1 && r.mentionCount <= 1000000)),
      "AUTO_EVIDENCE_INVALID_REVIEW_OBSERVATION");
  }

  const exceptions = [];
  const subjectUsable = subject.identityStatus === "resolved" &&
    subject.currentState === "current";
  if (!subjectUsable) {
    exceptions.push(Object.freeze({code:"SUBJECT_IDENTITY_UNRESOLVED",field:null}));
  }
  // Exact subject binding is required even when the conflicting input is
  // otherwise a valid governed-looking fact.
  const mismatchedFacts = verifiedFacts.filter(f => f.subjectId !== subject.subjectId);
  const mismatchedClaims = manufacturerClaims.filter(c => c.subjectId && c.subjectId !== subject.subjectId);
  const mismatchedReviews = reviewObservations.filter(r => r.subjectId && r.subjectId !== subject.subjectId);
  if (mismatchedFacts.length || mismatchedClaims.length || mismatchedReviews.length) {
    exceptions.push(Object.freeze({code:"EVIDENCE_IDENTITY_SCOPE_MISMATCH",field:null}));
  }
  const validFacts = verifiedFacts.filter(f => f.subjectId === subject.subjectId);
  const validClaims = manufacturerClaims.filter(c => !c.subjectId || c.subjectId === subject.subjectId);
  const validReviews = reviewObservations.filter(r => !r.subjectId || r.subjectId === subject.subjectId);
  const fields = {};
  const researchNeeds = [];

  for(const field of AUTOMATIC_SUNSCREEN_FIELD_NAMES) {
    const facts = stableSort(validFacts.filter(f => f.field === field),
      f => [f.value,f.sourceRef].join("|"));
    const uniqueFactValues = [...new Set(facts.map(f => f.value))];
    const claims = stableSort(validClaims.filter(c => c.field === field),
      c => [c.sourceId,c.statement].join("|"));
    const uniqueClaims = [...new Map(claims.map(c =>
      [[c.sourceId,c.statement].join("|"), Object.freeze({
        sourceId:c.sourceId,sourceRef:c.sourceRef,statement:c.statement,
      })])).values()];
    const reviews = stableSort(validReviews.filter(r => r.field === field),
      r => [r.sourceId,r.direction,r.context ?? "",r.sourceRef].join("|"));
    const uniqueReviews = [...new Map(reviews.map(r =>
      [[r.sourceId,r.direction,r.context ?? "",r.sourceRef].join("|"),r])).values()];
    const favorable = uniqueReviews.filter(r => r.direction === "favorable");
    const unfavorable = uniqueReviews.filter(r => r.direction === "unfavorable");
    const trend = favorable.length && unfavorable.length ? "mixed" :
      favorable.length ? "favorable_signal" :
      unfavorable.length ? "unfavorable_signal" : "none";
    const evidenceRefs = [...new Set([
      ...facts.map(x => x.sourceRef),
      ...uniqueClaims.map(x => x.sourceRef),
      ...uniqueReviews.map(x => x.sourceRef),
    ])].sort();

    if (uniqueFactValues.length > 1) {
      exceptions.push(Object.freeze({code:"AUTHORITATIVE_FACT_CONFLICT",field}));
    }
    const verified = subjectUsable &&
      !mismatchedFacts.length && !mismatchedClaims.length && !mismatchedReviews.length &&
      uniqueFactValues.length === 1;
    // Review observations never turn into verified facts, and unsupported
    // categories/optional values never become authority in this first release.
    const status = verified ? "verified_fact" :
      uniqueReviews.length ? "review_signal" : "insufficient";
    fields[field] = freezeRow({
      field,status,value:verified ? uniqueFactValues[0] : null,
      trend,claims:uniqueClaims,
      reviewObservationCounts:{
        favorableSignals:favorable.length,
        unfavorableSignals:unfavorable.length,
        aggregateTagSources:new Set(uniqueReviews.filter(r=>r.sourceKind==="aggregate_tag").map(r=>r.sourceId)).size,
      },
      evidenceRefs,
      uncertainty:status !== "verified_fact",
      incidenceEstimated:false,
      administratorApproved:false,
    });
    if (!verified && (CORE.has(field) || (!claims.length && !uniqueReviews.length))) {
      researchNeeds.push(field);
    }
  }
  const exceptionKey = x => x.code+"|"+(x.field ?? "");
  const finalExceptions = [...new Map(stableSort(exceptions,exceptionKey).map(x => [exceptionKey(x),x])).values()];
  const evidenceReady = subjectUsable && !finalExceptions.length &&
    SUNSCREEN_SEMANTIC_CORE_FIELDS.every(name => fields[name].status === "verified_fact");
  const cautions = [];
  for(const [contextKey,required] of Object.entries(SUNSCREEN_SEMANTIC_CONTEXT_GATES)) {
    if(context?.[contextKey] !== true) continue;
    if(required.some(field => fields[field].status !== "verified_fact")) cautions.push(contextKey);
  }

  return Object.freeze({
    version:AUTOMATIC_PRODUCT_EVIDENCE_EVALUATOR_VERSION,
    category:input.category,productId:input.productId,subjectId:subject.subjectId,
    fields:Object.freeze(fields),
    evidenceReady,
    researchNeeds:Object.freeze(researchNeeds),
    exceptions:Object.freeze(finalExceptions),
    contextCautions:Object.freeze(cautions),
    independentReviewSamplesVerified:false,
    incidenceEstimated:false,
    operatorReviewsRequired:finalExceptions.length,
    adminReviewsCreated:0,
    admissionGranted:false,
    productionWrites:0,
    rankingChanged:false,
    publicActivation:false,
  });
}
