const BOUNDARY_DECISIONS = new Set([
  "preserve_hard_block",
  "downgrade_to_collapsed_candidate",
  "requires_metadata_review",
  "not_applicable"
]);

const FUTURE_EVALUATOR_ACTIONS = new Set([
  "preserve_hard_block",
  "future_pass_with_collapsed_hint",
  "requires_metadata_review",
  "not_applicable"
]);

const CANDIDATE_POLICY_HINTS = new Set([
  "collapsed_candidate_hint",
  "hidden_candidate_hint",
  "insufficient_evidence_hint",
  "none"
]);

function normalizeText(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeReasons(reasons = []) {
  return Array.from(new Set((Array.isArray(reasons) ? reasons : [])
    .map((reason) => normalizeText(reason))
    .filter(Boolean))).sort();
}

function containsRecentInstabilityReason(candidateEvaluation = {}, boundaryPolicyResult = {}) {
  const candidateReasons = normalizeReasons(candidateEvaluation.hardFilterReasons);
  const policyReasons = normalizeReasons(boundaryPolicyResult.reasons);
  const contextReasons = normalizeReasons(boundaryPolicyResult.policyContext?.hardFilterReasons);
  return [...candidateReasons, ...policyReasons, ...contextReasons].includes("recent_instability_active_limited") ||
    policyReasons.includes("recent_instability_active_limited_block");
}

function unsafeForCollapsedHint(boundaryPolicyResult = {}, exposureContext = {}) {
  const context = boundaryPolicyResult.policyContext || {};
  return context.irritationRisk === "high" ||
    context.sensitivitySafe === false ||
    context.strongCautionSignal === true ||
    exposureContext.safetyMetadataProfile === "unsafe_high_risk" ||
    exposureContext.strongCautionSignal === true;
}

function makeResult({
  applies,
  sourceHardFilterReason,
  boundaryDecision,
  futureEvaluatorAction,
  candidatePolicyHint,
  reasons,
  integrationContext
}) {
  if (!BOUNDARY_DECISIONS.has(boundaryDecision)) {
    throw new Error(`Invalid boundaryDecision: ${boundaryDecision}`);
  }

  if (!FUTURE_EVALUATOR_ACTIONS.has(futureEvaluatorAction)) {
    throw new Error(`Invalid futureEvaluatorAction: ${futureEvaluatorAction}`);
  }

  if (!CANDIDATE_POLICY_HINTS.has(candidatePolicyHint)) {
    throw new Error(`Invalid candidatePolicyHint: ${candidatePolicyHint}`);
  }

  return {
    applies,
    sourceHardFilterReason,
    boundaryDecision,
    futureEvaluatorAction,
    candidatePolicyHint,
    reasons: normalizeReasons(reasons),
    integrationContext,
    runtimeConnected: false
  };
}

export function resolveEvaluatorBoundaryCollapsedHint({
  candidateEvaluation = {},
  boundaryPolicyResult = {},
  exposureContext = {}
} = {}) {
  const boundaryDecision = boundaryPolicyResult.boundaryDecision || "not_applicable";
  const sourceHardFilterReason = containsRecentInstabilityReason(candidateEvaluation, boundaryPolicyResult)
    ? "recent_instability_active_limited"
    : null;
  const integrationContext = {
    currentExposureStatus: exposureContext.currentExposureStatus || exposureContext.exposureStatus || null,
    safetyMetadataProfile: exposureContext.safetyMetadataProfile || null,
    functionalProfile: exposureContext.functionalProfile || null,
    category: exposureContext.category || boundaryPolicyResult.policyContext?.category || null,
    boundaryApplies: boundaryPolicyResult.applies === true,
    boundaryConfidence: boundaryPolicyResult.confidence || null,
    futureIntegrationHint: boundaryPolicyResult.futureIntegrationHint || null
  };

  if (!BOUNDARY_DECISIONS.has(boundaryDecision)) {
    return makeResult({
      applies: false,
      sourceHardFilterReason,
      boundaryDecision: "not_applicable",
      futureEvaluatorAction: "not_applicable",
      candidatePolicyHint: "none",
      reasons: ["invalid_boundary_decision"],
      integrationContext
    });
  }

  if (boundaryDecision === "downgrade_to_collapsed_candidate") {
    if (unsafeForCollapsedHint(boundaryPolicyResult, exposureContext)) {
      return makeResult({
        applies: true,
        sourceHardFilterReason,
        boundaryDecision,
        futureEvaluatorAction: "preserve_hard_block",
        candidatePolicyHint: "hidden_candidate_hint",
        reasons: [
          "collapsed_hint_blocked_by_safety_guardrail",
          "unsafe_or_strong_caution_context"
        ],
        integrationContext
      });
    }

    return makeResult({
      applies: true,
      sourceHardFilterReason,
      boundaryDecision,
      futureEvaluatorAction: "future_pass_with_collapsed_hint",
      candidatePolicyHint: "collapsed_candidate_hint",
      reasons: [
        "boundary_policy_downgrade_to_collapsed_candidate",
        "runtime_not_connected",
        "candidate_policy_hint_only"
      ],
      integrationContext
    });
  }

  if (boundaryDecision === "preserve_hard_block") {
    return makeResult({
      applies: boundaryPolicyResult.applies === true,
      sourceHardFilterReason,
      boundaryDecision,
      futureEvaluatorAction: "preserve_hard_block",
      candidatePolicyHint: "hidden_candidate_hint",
      reasons: [
        "boundary_policy_preserve_hard_block",
        "candidate_should_remain_hidden"
      ],
      integrationContext
    });
  }

  if (boundaryDecision === "requires_metadata_review") {
    return makeResult({
      applies: boundaryPolicyResult.applies === true,
      sourceHardFilterReason,
      boundaryDecision,
      futureEvaluatorAction: "requires_metadata_review",
      candidatePolicyHint: "insufficient_evidence_hint",
      reasons: [
        "boundary_policy_requires_metadata_review",
        "do_not_treat_as_collapsed_or_hard_block"
      ],
      integrationContext
    });
  }

  return makeResult({
    applies: false,
    sourceHardFilterReason,
    boundaryDecision,
    futureEvaluatorAction: "not_applicable",
    candidatePolicyHint: "none",
    reasons: ["boundary_policy_not_applicable"],
    integrationContext
  });
}

export const EVALUATOR_BOUNDARY_COLLAPSED_HINT_CONTRACT_VALUES = {
  boundaryDecisions: Array.from(BOUNDARY_DECISIONS),
  futureEvaluatorActions: Array.from(FUTURE_EVALUATOR_ACTIONS),
  candidatePolicyHints: Array.from(CANDIDATE_POLICY_HINTS)
};
