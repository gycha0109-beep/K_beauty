const EXPOSURE_STATUS = [
  "primary_candidate",
  "contextual_candidate",
  "collapsed_candidate",
  "hidden_candidate",
  "insufficient_evidence_candidate"
];

const VISIBILITY_PRIORITY = ["high", "normal", "reduced", "collapsed", "hidden"];
const USER_MESSAGE_TYPE = [
  "none",
  "stabilize_first_notice",
  "contextual_caution",
  "insufficient_evidence_notice",
  "hard_safety_guard_notice"
];
const IMPLEMENTATION_BOUNDARY = [
  "policy_only",
  "future_candidate_policy_integration",
  "future_ui_grouping",
  "future_evaluator_change_not_required"
];

function addReason(reasons, reason) {
  if (reason && !reasons.includes(reason)) {
    reasons.push(reason);
  }
}

function normalizeFinding(input) {
  if (Array.isArray(input)) {
    return input.find((item) => item && typeof item === "object") || null;
  }

  return input && typeof input === "object" ? input : null;
}

function buildPolicyContext({ candidateEvaluation, recentInstabilityGuardPolicy, goalPolicy, currentProductFinding }) {
  const finding = normalizeFinding(currentProductFinding);

  return {
    productId: candidateEvaluation?.productId || null,
    candidateHardFilterStatus: candidateEvaluation?.hardFilterStatus || null,
    candidateEligible: candidateEvaluation?.eligible ?? null,
    candidateConfidence: candidateEvaluation?.confidence || null,
    guardDecision: recentInstabilityGuardPolicy?.decision || null,
    guardLevel: recentInstabilityGuardPolicy?.guardLevel || null,
    guardImplementationHint: recentInstabilityGuardPolicy?.implementationHint || null,
    rankingGoal: goalPolicy?.rankingGoal || candidateEvaluation?.rankingContext?.rankingGoal || null,
    safetyGoal: goalPolicy?.safetyGoal || candidateEvaluation?.rankingContext?.safetyGoal || null,
    recommendationGuard: goalPolicy?.recommendationGuard ||
      candidateEvaluation?.rankingContext?.recommendationGuard ||
      null,
    hasTension: Boolean(goalPolicy?.hasTension || candidateEvaluation?.rankingContext?.hasTension),
    currentProductRelation: finding?.relationToPlan || null,
    currentProductSourceState: finding?.sourceState || null
  };
}

function makeResult({
  exposureStatus,
  includeInPrimaryCandidates,
  includeInCollapsedCandidates,
  includeInHiddenCandidates,
  visibilityPriority,
  userMessageType,
  reasons,
  policyContext,
  implementationBoundary
}) {
  if (!EXPOSURE_STATUS.includes(exposureStatus)) {
    throw new Error(`Invalid exposureStatus: ${exposureStatus}`);
  }

  if (!VISIBILITY_PRIORITY.includes(visibilityPriority)) {
    throw new Error(`Invalid visibilityPriority: ${visibilityPriority}`);
  }

  if (!USER_MESSAGE_TYPE.includes(userMessageType)) {
    throw new Error(`Invalid userMessageType: ${userMessageType}`);
  }

  if (!IMPLEMENTATION_BOUNDARY.includes(implementationBoundary)) {
    throw new Error(`Invalid implementationBoundary: ${implementationBoundary}`);
  }

  return {
    exposureStatus,
    includeInPrimaryCandidates: Boolean(includeInPrimaryCandidates),
    includeInCollapsedCandidates: Boolean(includeInCollapsedCandidates),
    includeInHiddenCandidates: Boolean(includeInHiddenCandidates),
    visibilityPriority,
    userMessageType,
    reasons,
    policyContext,
    implementationBoundary
  };
}

function appendCurrentProductContext(reasons, finding) {
  if (!finding || typeof finding !== "object") {
    return;
  }

  if (finding.relationToPlan === "duplicate_axis") {
    addReason(reasons, "current_duplicate_axis_context");
  }

  if (finding.relationToPlan === "supports_goal") {
    addReason(reasons, "current_supports_goal_context");
  }

  if (finding.sourceState === "not_in_db" || finding.sourceState === "unanswered") {
    addReason(reasons, "current_product_context_neutral");
  }

  if (finding.sourceState === "not_using" || finding.relationToPlan === "empty_slot") {
    addReason(reasons, "current_category_gap_context");
  }
}

export function resolveFunctionalGuardExposurePolicy({
  candidateEvaluation = {},
  recentInstabilityGuardPolicy = {},
  goalPolicy = {},
  currentProductFinding
} = {}) {
  const reasons = [];
  const finding = normalizeFinding(currentProductFinding);
  const policyContext = buildPolicyContext({
    candidateEvaluation,
    recentInstabilityGuardPolicy,
    goalPolicy,
    currentProductFinding: finding
  });
  const hardFilterStatus = candidateEvaluation?.hardFilterStatus || null;
  const guardDecision = recentInstabilityGuardPolicy?.decision || "no_guard";

  appendCurrentProductContext(reasons, finding);

  if (hardFilterStatus === "blocked" || guardDecision === "hard_block_candidate") {
    addReason(reasons, hardFilterStatus === "blocked"
      ? "candidate_evaluator_blocked"
      : "guard_policy_hard_block_candidate");

    return makeResult({
      exposureStatus: "hidden_candidate",
      includeInPrimaryCandidates: false,
      includeInCollapsedCandidates: false,
      includeInHiddenCandidates: true,
      visibilityPriority: "hidden",
      userMessageType: "hard_safety_guard_notice",
      reasons,
      policyContext,
      implementationBoundary: "future_evaluator_change_not_required"
    });
  }

  if (hardFilterStatus === "insufficient_data" || guardDecision === "insufficient_data") {
    addReason(reasons, hardFilterStatus === "insufficient_data"
      ? "candidate_evaluator_insufficient_data"
      : "guard_policy_insufficient_data");

    return makeResult({
      exposureStatus: "insufficient_evidence_candidate",
      includeInPrimaryCandidates: false,
      includeInCollapsedCandidates: false,
      includeInHiddenCandidates: false,
      visibilityPriority: "reduced",
      userMessageType: "insufficient_evidence_notice",
      reasons,
      policyContext,
      implementationBoundary: "future_candidate_policy_integration"
    });
  }

  if (
    guardDecision === "collapsed_exposure_candidate" &&
    hardFilterStatus !== "blocked" &&
    candidateEvaluation?.confidence !== "low" &&
    recentInstabilityGuardPolicy?.policyContext?.productSafetyMetadataComplete !== false
  ) {
    addReason(reasons, "guard_policy_collapsed_exposure_candidate");

    return makeResult({
      exposureStatus: "collapsed_candidate",
      includeInPrimaryCandidates: false,
      includeInCollapsedCandidates: true,
      includeInHiddenCandidates: false,
      visibilityPriority: "collapsed",
      userMessageType: "stabilize_first_notice",
      reasons,
      policyContext,
      implementationBoundary: "future_candidate_policy_integration"
    });
  }

  if (
    guardDecision === "allow_with_context" ||
    recentInstabilityGuardPolicy?.guardLevel === "low" ||
    recentInstabilityGuardPolicy?.guardLevel === "medium" ||
    guardDecision === "soft_penalty_candidate"
  ) {
    addReason(reasons, guardDecision === "soft_penalty_candidate"
      ? "guard_policy_soft_penalty_candidate"
      : "guard_policy_contextual_caution");

    return makeResult({
      exposureStatus: "contextual_candidate",
      includeInPrimaryCandidates: candidateEvaluation?.eligible === true,
      includeInCollapsedCandidates: false,
      includeInHiddenCandidates: false,
      visibilityPriority: guardDecision === "allow_with_context" ? "normal" : "reduced",
      userMessageType: "contextual_caution",
      reasons,
      policyContext,
      implementationBoundary: "policy_only"
    });
  }

  addReason(reasons, "guard_policy_no_guard");

  return makeResult({
    exposureStatus: "primary_candidate",
    includeInPrimaryCandidates: candidateEvaluation?.eligible === true,
    includeInCollapsedCandidates: false,
    includeInHiddenCandidates: false,
    visibilityPriority: candidateEvaluation?.confidence === "high" ? "high" : "normal",
    userMessageType: "none",
    reasons,
    policyContext,
    implementationBoundary: "policy_only"
  });
}

export const FUNCTIONAL_GUARD_EXPOSURE_POLICY_VALUES = {
  exposureStatus: EXPOSURE_STATUS,
  visibilityPriority: VISIBILITY_PRIORITY,
  userMessageType: USER_MESSAGE_TYPE,
  implementationBoundary: IMPLEMENTATION_BOUNDARY
};
