export const CANDIDATE_EXPOSURE_POLICY_VERSION = "candidate-exposure-policy-v1";

export const CANDIDATE_EXPOSURES = Object.freeze([
  "primary",
  "contextual",
  "collapsed",
  "hidden",
  "insufficient_evidence"
]);

export const CANDIDATE_EXPOSURE_REASON_CODES = Object.freeze([
  "canonical_goal_match",
  "already_using",
  "replacement_intent_unknown",
  "stabilization_active_block",
  "expansion_prohibited",
  "protection_maintained",
  "protection_evidence_incomplete",
  "irritation_risk",
  "missing_step",
  "usage_unknown",
  "partial_context",
  "product_not_evaluable",
  "invalid_context",
  "duplicate_axis",
  "metadata_incomplete",
  "current_findings_missing",
  "current_findings_invalid"
]);

export const CANDIDATE_EXPOSURE_LANES = Object.freeze([
  "topPick",
  "supporting",
  "budget",
  "routine",
  "treatment"
]);

const EXPOSURE_SET = new Set(CANDIDATE_EXPOSURES);
const REASON_SET = new Set(CANDIDATE_EXPOSURE_REASON_CODES);
const RELATIONS = new Set([
  "none",
  "same_product",
  "same_axis",
  "different_axis",
  "empty_slot",
  "unknown_usage",
  "not_evaluable"
]);
const EVIDENCE_STATES = new Set(["complete", "partial", "insufficient", "invalid"]);

export function buildCandidateLaneEligibility(exposure, { treatmentEligible = false } = {}) {
  if (exposure === "primary") {
    return Object.freeze({
      topPick: true,
      supporting: true,
      budget: true,
      routine: true,
      treatment: treatmentEligible === true
    });
  }

  if (exposure === "contextual") {
    return Object.freeze({
      topPick: false,
      supporting: true,
      budget: true,
      routine: true,
      treatment: false
    });
  }

  return Object.freeze({
    topPick: false,
    supporting: false,
    budget: false,
    routine: false,
    treatment: false
  });
}

export function validateCandidateExposureDecision(decision) {
  const errors = [];

  if (!decision || typeof decision !== "object" || Array.isArray(decision)) {
    return { valid: false, errors: ["decision_not_object"] };
  }
  if (decision.policyVersion !== CANDIDATE_EXPOSURE_POLICY_VERSION) {
    errors.push("invalid_policy_version");
  }
  if (typeof decision.candidateRef !== "string" || !decision.candidateRef) {
    errors.push("invalid_candidate_ref");
  }
  if (!EXPOSURE_SET.has(decision.exposure)) {
    errors.push("invalid_exposure");
  }
  if (
    !Array.isArray(decision.reasonCodes) ||
    decision.reasonCodes.some((reason) => !REASON_SET.has(reason)) ||
    new Set(decision.reasonCodes).size !== decision.reasonCodes.length
  ) {
    errors.push("invalid_reason_codes");
  }
  if (!RELATIONS.has(decision.currentProductRelation)) {
    errors.push("invalid_current_product_relation");
  }
  if (!EVIDENCE_STATES.has(decision.evidenceState)) {
    errors.push("invalid_evidence_state");
  }
  if (
    !decision.laneEligibility ||
    CANDIDATE_EXPOSURE_LANES.some((lane) => typeof decision.laneEligibility[lane] !== "boolean") ||
    Object.keys(decision.laneEligibility).some((lane) => !CANDIDATE_EXPOSURE_LANES.includes(lane))
  ) {
    errors.push("invalid_lane_eligibility");
  }
  if (
    !decision.provenance ||
    decision.provenance.policy !== CANDIDATE_EXPOSURE_POLICY_VERSION ||
    !EXPOSURE_SET.has(decision.provenance.adapterExposure) ||
    typeof decision.provenance.contextVersion !== "string" ||
    typeof decision.provenance.functionalPolicyVersion !== "string" ||
    typeof decision.provenance.consistencyVersion !== "string"
  ) {
    errors.push("invalid_provenance");
  }

  return { valid: errors.length === 0, errors };
}
