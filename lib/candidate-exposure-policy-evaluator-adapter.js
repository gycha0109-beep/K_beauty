import { buildEvaluatorBoundaryPolicyExecution } from "./evaluator-boundary-policy-shadow.js";

const LEGACY_EXPOSURE_MAP = Object.freeze({
  primary_candidate: "primary",
  contextual_candidate: "contextual",
  collapsed_candidate: "collapsed",
  hidden_candidate: "hidden",
  insufficient_evidence_candidate: "insufficient_evidence",
  unchanged: "primary"
});

function canonicalSurveyContract(sharedContext = {}) {
  const answers = sharedContext?.survey?.answers || {};
  const safety = sharedContext?.safetyState || {};

  return {
    skinState: {
      skinType: answers.skinType || "unknown",
      sensitivity: answers.sensitivity || "unknown",
      postWashFeeling: answers.postWashFeeling || "unknown",
      afternoonSkinChange: answers.afternoonSkinChange || "unknown"
    },
    goals: {
      primaryConcern: sharedContext?.skinState?.priorityAxis || null,
      secondaryConcerns: []
    },
    safety: {
      sensitivityRisk: safety.sensitiveBurden ? "high" : "low",
      drynessRisk: answers.postWashFeeling === "tight" ? "high" : "unknown",
      rednessRisk: safety.sensitiveBurden ? "high" : "unknown",
      recentSkinChange: safety.recentSkinChange || "unknown",
      recentlyChangedProduct: safety.recentlyChangedProduct || "unknown"
    },
    sunscreen: {
      sourceCompleteness: Object.keys(answers).length ? "answered" : "unknown"
    },
    source: "canonical_shared_skin_decision_context"
  };
}

function canonicalGoalPolicy(functionalPolicy = {}, sharedContext = {}) {
  return {
    requestedConcern: functionalPolicy.priorityAxis || null,
    detectedPriority: sharedContext?.skinState?.priorityAxis || null,
    hasTension: false,
    tensionType: "none",
    rankingGoal: functionalPolicy.priorityAxis || null,
    safetyGoal: functionalPolicy.safety?.level === "stable"
      ? functionalPolicy.priorityAxis || null
      : sharedContext?.skinState?.priorityAxis || functionalPolicy.priorityAxis || null,
    recommendationGuard: functionalPolicy.safety?.activeExpansionAllowed === false
      ? "stabilize_first"
      : "normal",
    functionalDirection: functionalPolicy.functionalDirection || null,
    warnings: []
  };
}

export function runCandidateExposureEvaluatorAdapter({
  products,
  sharedContext,
  functionalPolicy,
  currentProductFindings
} = {}) {
  const execution = buildEvaluatorBoundaryPolicyExecution({
    products,
    surveyContract: canonicalSurveyContract(sharedContext),
    goalPolicy: canonicalGoalPolicy(functionalPolicy, sharedContext),
    currentProductFindings,
    runtimeConnected: false
  });
  const receiversById = new Map(
    execution.receivers.map((receiver) => [String(receiver.productId || ""), receiver])
  );

  return {
    execution,
    rows: (Array.isArray(products) ? products : []).map((product) => {
      const candidateRef = String(product?.id || product?.productId || product?.product_id || "").trim();
      const receiver = receiversById.get(candidateRef);
      const sourceExposure = receiver?.futureExposureGroup === "unchanged"
        ? receiver?.baselineExposureGroup
        : receiver?.futureExposureGroup;

      return {
        candidateRef,
        exposure: LEGACY_EXPOSURE_MAP[sourceExposure] || "insufficient_evidence",
        receiver
      };
    })
  };
}

export function mapLegacyEvaluatorExposure(receiver) {
  const sourceExposure = receiver?.futureExposureGroup === "unchanged"
    ? receiver?.baselineExposureGroup
    : receiver?.futureExposureGroup;
  return LEGACY_EXPOSURE_MAP[sourceExposure] || "insufficient_evidence";
}
