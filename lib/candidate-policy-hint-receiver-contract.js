const RECEIVED_HINTS = new Set([
  "collapsed_candidate_hint",
  "hidden_candidate_hint",
  "insufficient_evidence_hint",
  "none"
]);

const RECEIVER_DECISIONS = new Set([
  "accept_collapsed_candidate_hint",
  "preserve_hidden_candidate",
  "route_to_insufficient_evidence",
  "keep_existing_exposure",
  "not_applicable"
]);

const FUTURE_EXPOSURE_GROUPS = new Set([
  "collapsed_candidate",
  "hidden_candidate",
  "insufficient_evidence_candidate",
  "unchanged"
]);

const VISIBILITY_PRIORITIES = new Set(["collapsed", "hidden", "reduced", "normal"]);
const USER_MESSAGE_TYPES = new Set([
  "stabilize_first_notice",
  "hard_safety_guard_notice",
  "insufficient_evidence_notice",
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

function currentExposureGroup(currentExposureDecision = {}) {
  return currentExposureDecision.exposureStatus ||
    currentExposureDecision.futureExposureGroup ||
    currentExposureDecision.visibility ||
    "unchanged";
}

function getReceivedHint(collapsedHintResult = {}) {
  const hint = collapsedHintResult.candidatePolicyHint || "none";
  return RECEIVED_HINTS.has(hint) ? hint : "none";
}

function safetyContext({ collapsedHintResult = {}, guardExposurePolicy = {} }) {
  const integrationContext = collapsedHintResult.integrationContext || {};
  const guardContext = guardExposurePolicy.policyContext || {};
  const safetyMetadataProfile =
    integrationContext.safetyMetadataProfile ||
    guardExposurePolicy.safetyMetadataProfile ||
    guardContext.safetyMetadataProfile ||
    null;

  return {
    safetyMetadataProfile,
    boundaryDecision: collapsedHintResult.boundaryDecision || null,
    futureEvaluatorAction: collapsedHintResult.futureEvaluatorAction || null,
    category: integrationContext.category || guardContext.category || null,
    sensitivitySafe: integrationContext.sensitivitySafe ?? guardContext.sensitivitySafe ?? null,
    irritationRisk: integrationContext.irritationRisk || guardContext.irritationRisk || null,
    strongCautionSignal: integrationContext.strongCautionSignal === true ||
      guardContext.strongCautionSignal === true ||
      guardExposurePolicy.strongCautionSignal === true
  };
}

function hasCollapsedGuardrailViolation(context = {}) {
  return context.safetyMetadataProfile === "unsafe_high_risk" ||
    context.safetyMetadataProfile === "metadata_incomplete" ||
    context.irritationRisk === "high" ||
    context.sensitivitySafe === false ||
    context.strongCautionSignal === true;
}

function collapsedHintIsEligible(context = {}) {
  return context.boundaryDecision === "downgrade_to_collapsed_candidate" &&
    context.futureEvaluatorAction === "future_pass_with_collapsed_hint" &&
    ["safe_low_risk", "safe_medium_risk"].includes(context.safetyMetadataProfile) &&
    !hasCollapsedGuardrailViolation(context);
}

function makeResult({
  applies,
  receivedHint,
  receiverDecision,
  futureExposureGroup,
  visibilityPriority,
  userMessageType,
  reasons,
  receiverContext
}) {
  if (!RECEIVED_HINTS.has(receivedHint)) {
    throw new Error(`Invalid receivedHint: ${receivedHint}`);
  }

  if (!RECEIVER_DECISIONS.has(receiverDecision)) {
    throw new Error(`Invalid receiverDecision: ${receiverDecision}`);
  }

  if (!FUTURE_EXPOSURE_GROUPS.has(futureExposureGroup)) {
    throw new Error(`Invalid futureExposureGroup: ${futureExposureGroup}`);
  }

  if (!VISIBILITY_PRIORITIES.has(visibilityPriority)) {
    throw new Error(`Invalid visibilityPriority: ${visibilityPriority}`);
  }

  if (!USER_MESSAGE_TYPES.has(userMessageType)) {
    throw new Error(`Invalid userMessageType: ${userMessageType}`);
  }

  return {
    applies,
    receivedHint,
    receiverDecision,
    futureExposureGroup,
    visibilityPriority,
    userMessageType,
    reasons: normalizeReasons(reasons),
    receiverContext,
    runtimeConnected: false
  };
}

export function resolveCandidatePolicyHintReceiver({
  candidateEvaluation = {},
  collapsedHintResult = {},
  currentExposureDecision = {},
  guardExposurePolicy = {}
} = {}) {
  const receivedHint = getReceivedHint(collapsedHintResult);
  const context = safetyContext({ collapsedHintResult, guardExposurePolicy });
  const receiverContext = {
    currentExposureGroup: currentExposureGroup(currentExposureDecision),
    candidateHardFilterStatus: candidateEvaluation.hardFilterStatus || null,
    candidateConfidence: candidateEvaluation.confidence || null,
    receivedHint,
    boundaryDecision: context.boundaryDecision,
    futureEvaluatorAction: context.futureEvaluatorAction,
    safetyMetadataProfile: context.safetyMetadataProfile,
    category: context.category,
    irritationRisk: context.irritationRisk,
    sensitivitySafe: context.sensitivitySafe,
    strongCautionSignal: context.strongCautionSignal
  };

  if (receivedHint === "collapsed_candidate_hint") {
    if (collapsedHintIsEligible(context)) {
      return makeResult({
        applies: true,
        receivedHint,
        receiverDecision: "accept_collapsed_candidate_hint",
        futureExposureGroup: "collapsed_candidate",
        visibilityPriority: "collapsed",
        userMessageType: "stabilize_first_notice",
        reasons: [
          "received_collapsed_candidate_hint",
          "boundary_downgrade_confirmed",
          "safe_metadata_confirmed"
        ],
        receiverContext
      });
    }

    if (context.safetyMetadataProfile === "metadata_incomplete") {
      return makeResult({
        applies: true,
        receivedHint,
        receiverDecision: "route_to_insufficient_evidence",
        futureExposureGroup: "insufficient_evidence_candidate",
        visibilityPriority: "reduced",
        userMessageType: "insufficient_evidence_notice",
        reasons: [
          "collapsed_hint_rejected",
          "metadata_incomplete_requires_review"
        ],
        receiverContext
      });
    }

    return makeResult({
      applies: true,
      receivedHint,
      receiverDecision: "preserve_hidden_candidate",
      futureExposureGroup: "hidden_candidate",
      visibilityPriority: "hidden",
      userMessageType: "hard_safety_guard_notice",
      reasons: [
        "collapsed_hint_rejected",
        "safety_guardrail_preserves_hidden"
      ],
      receiverContext
    });
  }

  if (receivedHint === "hidden_candidate_hint") {
    return makeResult({
      applies: true,
      receivedHint,
      receiverDecision: "preserve_hidden_candidate",
      futureExposureGroup: "hidden_candidate",
      visibilityPriority: "hidden",
      userMessageType: "hard_safety_guard_notice",
      reasons: [
        "received_hidden_candidate_hint",
        "preserve_hidden_candidate"
      ],
      receiverContext
    });
  }

  if (receivedHint === "insufficient_evidence_hint") {
    return makeResult({
      applies: true,
      receivedHint,
      receiverDecision: "route_to_insufficient_evidence",
      futureExposureGroup: "insufficient_evidence_candidate",
      visibilityPriority: "reduced",
      userMessageType: "insufficient_evidence_notice",
      reasons: [
        "received_insufficient_evidence_hint",
        "metadata_or_evidence_review_required"
      ],
      receiverContext
    });
  }

  return makeResult({
    applies: false,
    receivedHint,
    receiverDecision: "keep_existing_exposure",
    futureExposureGroup: "unchanged",
    visibilityPriority: "normal",
    userMessageType: "none",
    reasons: ["no_candidate_policy_hint_received"],
    receiverContext
  });
}

export const CANDIDATE_POLICY_HINT_RECEIVER_CONTRACT_VALUES = {
  receivedHints: Array.from(RECEIVED_HINTS),
  receiverDecisions: Array.from(RECEIVER_DECISIONS),
  futureExposureGroups: Array.from(FUTURE_EXPOSURE_GROUPS),
  visibilityPriorities: Array.from(VISIBILITY_PRIORITIES),
  userMessageTypes: Array.from(USER_MESSAGE_TYPES)
};
