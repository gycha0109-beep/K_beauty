import { buildFunctionalPolicy, FUNCTIONAL_POLICY_VERSION } from "./functional-policy.js";

const ADAPTER_VERSION = "premium-functional-decisions-v3";

export function buildPremiumFunctionalDecisions(context = {}) {
  const functionalPolicy = context?.functionalPolicy && typeof context.functionalPolicy === "object"
    ? context.functionalPolicy
    : buildFunctionalPolicy(context);

  return (Array.isArray(functionalPolicy?.goals) ? functionalPolicy.goals : [])
    .slice(0, 5)
    .map((goal) => ({
      goalKey: goal.goalKey,
      status: goal.status,
      title: goal.title,
      summary: goal.summary,
      reasons: Array.isArray(goal.reasons) ? goal.reasons.slice(0, 2) : [],
      nextAction: goal.nextAction || null,
      planMode: functionalPolicy.planMode,
      primaryGoal: functionalPolicy.primaryGoal,
      secondaryGoal: functionalPolicy.secondaryGoal,
      functionalDirection: functionalPolicy.functionalDirection,
      allowedIntensity: functionalPolicy.allowedIntensity,
      reviewCondition: functionalPolicy.reviewCondition,
      policyVersion: functionalPolicy.version || FUNCTIONAL_POLICY_VERSION,
      adapterVersion: ADAPTER_VERSION
    }));
}

export const PREMIUM_FUNCTIONAL_DECISIONS_ADAPTER_VERSION = ADAPTER_VERSION;
