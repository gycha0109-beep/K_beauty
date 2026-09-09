export const PRODUCT_EVIDENCE_PRESENTATION_POLICY_VERSION = "product-evidence-presentation-v1";
export const PRODUCT_EVIDENCE_ADMISSION_POLICY_VERSION = "product-evidence-admission-v1-explanation-only";

export const PRODUCT_EVIDENCE_KNOWLEDGE_STATES = Object.freeze([
  "supported",
  "reviewed_not_established",
  "not_reviewed",
  "evidence_insufficient",
  "evidence_conflict"
]);

export const PRODUCT_EVIDENCE_FAMILIES = Object.freeze([
  "official",
  "measurement",
  "review_experience",
  "ingredient_basis",
  "mixed",
  "none"
]);

export const PRODUCT_EVIDENCE_INDEPENDENT_SUPPORT = Object.freeze([
  "multiple",
  "single",
  "unresolved"
]);

export const PRODUCT_EVIDENCE_RECENCY = Object.freeze(["current", "aging", "unknown"]);
export const PRODUCT_EVIDENCE_AGREEMENT = Object.freeze(["consistent", "mixed", "unknown"]);
export const PRODUCT_EVIDENCE_RECOMMENDATION_USE = Object.freeze([
  "constraint_eligible",
  "utility_eligible",
  "bounded_utility",
  "tie_break_only",
  "explanation_only",
  "blocked"
]);
export const PRODUCT_EVIDENCE_PRESENTATION_TONES = Object.freeze([
  "plain",
  "supported",
  "mixed",
  "limited"
]);

const KNOWLEDGE_STATE_SET = new Set(PRODUCT_EVIDENCE_KNOWLEDGE_STATES);
const FAMILY_SET = new Set(PRODUCT_EVIDENCE_FAMILIES);
const INDEPENDENT_SUPPORT_SET = new Set(PRODUCT_EVIDENCE_INDEPENDENT_SUPPORT);
const RECENCY_SET = new Set(PRODUCT_EVIDENCE_RECENCY);
const AGREEMENT_SET = new Set(PRODUCT_EVIDENCE_AGREEMENT);
const RECOMMENDATION_USE_SET = new Set(PRODUCT_EVIDENCE_RECOMMENDATION_USE);
const PRESENTATION_TONE_SET = new Set(PRODUCT_EVIDENCE_PRESENTATION_TONES);

function normalizeOptionalRef(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeEvidenceRefs(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()))];
}

function hasTraceableAuthority({ factRef, axisRef, evidenceRefs }) {
  return Boolean((factRef || axisRef) && evidenceRefs.length > 0);
}

function derivePresentation({ knowledgeState, dominantFamily, independentSupport, agreement, traceable }) {
  if (knowledgeState === null) {
    return Object.freeze({ tone: "plain", copyKey: "product_evidence_missing" });
  }
  if (knowledgeState === "evidence_conflict") {
    return Object.freeze({ tone: "mixed", copyKey: "product_evidence_mixed" });
  }
  if (knowledgeState === "evidence_insufficient" || knowledgeState === "reviewed_not_established") {
    return Object.freeze({ tone: "limited", copyKey: "product_evidence_limited" });
  }
  if (knowledgeState === "not_reviewed") {
    return Object.freeze({ tone: "plain", copyKey: "product_evidence_not_reviewed" });
  }
  if (!traceable) {
    return Object.freeze({ tone: "limited", copyKey: "product_evidence_traceability_incomplete" });
  }
  if (agreement === "mixed") {
    return Object.freeze({ tone: "mixed", copyKey: "product_evidence_mixed" });
  }
  if (independentSupport === "multiple" && agreement === "consistent") {
    return Object.freeze({
      tone: "supported",
      copyKey:
        dominantFamily === "review_experience"
          ? "product_review_pattern_repeated"
          : "product_evidence_repeated_consistent"
    });
  }
  return Object.freeze({
    tone: "plain",
    copyKey:
      dominantFamily === "review_experience"
        ? "product_review_pattern_observed"
        : "product_evidence_supported"
  });
}

/**
 * Read-only presentation/admission projection over already-established Product Fact / Decision Axis semantics.
 *
 * This function does not establish Product Facts, infer independent support from source counts,
 * compute recommendation scores, or select products. In the v1 explanation-only phase,
 * even a supported and traceable signal may only be used for explanation.
 *
 * `knowledgeState: null` deliberately represents absence of a canonical state. It must not be
 * coerced to `not_reviewed`, `false`, or a safety conclusion.
 */
export function buildProductEvidencePresentationProjection({
  featureKey,
  factRef = null,
  axisRef = null,
  knowledgeState = null,
  dominantFamily = "none",
  independentSupport = "unresolved",
  recency = "unknown",
  agreement = "unknown",
  evidenceRefs = []
} = {}) {
  if (typeof featureKey !== "string" || !featureKey.trim()) {
    throw new TypeError("featureKey must be a non-empty string");
  }
  if (knowledgeState !== null && !KNOWLEDGE_STATE_SET.has(knowledgeState)) {
    throw new TypeError(`unsupported knowledgeState: ${String(knowledgeState)}`);
  }
  if (!FAMILY_SET.has(dominantFamily)) {
    throw new TypeError(`unsupported dominantFamily: ${String(dominantFamily)}`);
  }
  if (!INDEPENDENT_SUPPORT_SET.has(independentSupport)) {
    throw new TypeError(`unsupported independentSupport: ${String(independentSupport)}`);
  }
  if (!RECENCY_SET.has(recency)) {
    throw new TypeError(`unsupported recency: ${String(recency)}`);
  }
  if (!AGREEMENT_SET.has(agreement)) {
    throw new TypeError(`unsupported agreement: ${String(agreement)}`);
  }

  const normalizedFactRef = normalizeOptionalRef(factRef);
  const normalizedAxisRef = normalizeOptionalRef(axisRef);
  const normalizedEvidenceRefs = normalizeEvidenceRefs(evidenceRefs);
  const traceable = hasTraceableAuthority({
    factRef: normalizedFactRef,
    axisRef: normalizedAxisRef,
    evidenceRefs: normalizedEvidenceRefs
  });

  const recommendationUse = knowledgeState === "supported" && traceable ? "explanation_only" : "blocked";
  const presentation = derivePresentation({
    knowledgeState,
    dominantFamily,
    independentSupport,
    agreement,
    traceable
  });

  return Object.freeze({
    featureKey: featureKey.trim(),
    factRef: normalizedFactRef,
    axisRef: normalizedAxisRef,
    knowledgeState,
    evidenceView: Object.freeze({
      dominantFamily,
      independentSupport,
      recency,
      agreement
    }),
    recommendationUse,
    presentation,
    evidenceRefs: Object.freeze(normalizedEvidenceRefs),
    presentationPolicyVersion: PRODUCT_EVIDENCE_PRESENTATION_POLICY_VERSION,
    admissionPolicyVersion: PRODUCT_EVIDENCE_ADMISSION_POLICY_VERSION
  });
}

export function validateProductEvidencePresentationProjection(projection) {
  const errors = [];

  if (!projection || typeof projection !== "object" || Array.isArray(projection)) {
    return { valid: false, errors: ["projection_not_object"] };
  }
  if (typeof projection.featureKey !== "string" || !projection.featureKey) {
    errors.push("invalid_feature_key");
  }
  if (projection.factRef !== null && (typeof projection.factRef !== "string" || !projection.factRef)) {
    errors.push("invalid_fact_ref");
  }
  if (projection.axisRef !== null && (typeof projection.axisRef !== "string" || !projection.axisRef)) {
    errors.push("invalid_axis_ref");
  }
  if (projection.knowledgeState !== null && !KNOWLEDGE_STATE_SET.has(projection.knowledgeState)) {
    errors.push("invalid_knowledge_state");
  }
  if (
    !projection.evidenceView ||
    !FAMILY_SET.has(projection.evidenceView.dominantFamily) ||
    !INDEPENDENT_SUPPORT_SET.has(projection.evidenceView.independentSupport) ||
    !RECENCY_SET.has(projection.evidenceView.recency) ||
    !AGREEMENT_SET.has(projection.evidenceView.agreement)
  ) {
    errors.push("invalid_evidence_view");
  }
  if (!RECOMMENDATION_USE_SET.has(projection.recommendationUse)) {
    errors.push("invalid_recommendation_use");
  }
  if (
    !projection.presentation ||
    !PRESENTATION_TONE_SET.has(projection.presentation.tone) ||
    typeof projection.presentation.copyKey !== "string" ||
    !projection.presentation.copyKey
  ) {
    errors.push("invalid_presentation");
  }
  if (
    !Array.isArray(projection.evidenceRefs) ||
    projection.evidenceRefs.some((ref) => typeof ref !== "string" || !ref) ||
    new Set(projection.evidenceRefs).size !== projection.evidenceRefs.length
  ) {
    errors.push("invalid_evidence_refs");
  }
  if (projection.presentationPolicyVersion !== PRODUCT_EVIDENCE_PRESENTATION_POLICY_VERSION) {
    errors.push("invalid_presentation_policy_version");
  }
  if (projection.admissionPolicyVersion !== PRODUCT_EVIDENCE_ADMISSION_POLICY_VERSION) {
    errors.push("invalid_admission_policy_version");
  }

  const traceable = hasTraceableAuthority({
    factRef: projection.factRef,
    axisRef: projection.axisRef,
    evidenceRefs: Array.isArray(projection.evidenceRefs) ? projection.evidenceRefs : []
  });
  const expectedUse = projection.knowledgeState === "supported" && traceable ? "explanation_only" : "blocked";
  if (projection.recommendationUse !== expectedUse) {
    errors.push("admission_policy_violation");
  }
  if (projection.knowledgeState === "supported" && !traceable && projection.presentation?.tone !== "limited") {
    errors.push("untraceable_supported_claim_not_limited");
  }

  return { valid: errors.length === 0, errors };
}
