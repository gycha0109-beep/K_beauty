import { buildFunctionalPolicy, FUNCTIONAL_POLICY_VERSION } from "./functional-policy.js";
import { buildCrossDomainConsistency, CROSS_DOMAIN_CONSISTENCY_VERSION } from "./cross-domain-consistency.js";
import { buildEffectivePolicySet, EFFECTIVE_POLICY_SET_VERSION } from "./effective-policy-set.js";
import { buildConditionPolicy, CONDITION_POLICY_VERSION } from "./condition-policy.js";
import {
  buildPremiumConditionProjection,
  PREMIUM_CONDITION_PROJECTION_VERSION
} from "./premium-condition-projection.js";
import {
  buildPremiumFunctionalDecisions,
  PREMIUM_FUNCTIONAL_DECISIONS_ADAPTER_VERSION
} from "./premium-functional-decisions.js";
import {
  buildPremiumFunctionalProjection,
  PREMIUM_FUNCTIONAL_PROJECTION_VERSION
} from "./premium-functional-projection.js";
import {
  buildSharedSkinDecisionContext,
  SHARED_SKIN_DECISION_CONTEXT_VERSION
} from "./shared-skin-decision-context.js";
import { buildRoutinePolicy, ROUTINE_POLICY_VERSION } from "./routine-policy.js";
import {
  buildPremiumRoutineProjection,
  PREMIUM_ROUTINE_PROJECTION_VERSION
} from "./premium-routine-projection.js";

const DECISION_BUNDLE_VERSION = "premium-decision-bundle-v5";
const POLICY_VERSIONS = Object.freeze({
  functional: FUNCTIONAL_POLICY_VERSION,
  functionalLegacyAdapter: PREMIUM_FUNCTIONAL_DECISIONS_ADAPTER_VERSION,
  functionalProjection: PREMIUM_FUNCTIONAL_PROJECTION_VERSION,
  routine: ROUTINE_POLICY_VERSION,
  routineProjection: PREMIUM_ROUTINE_PROJECTION_VERSION,
  condition: CONDITION_POLICY_VERSION,
  conditionProjection: PREMIUM_CONDITION_PROJECTION_VERSION,
  consistency: CROSS_DOMAIN_CONSISTENCY_VERSION,
  effectivePolicySet: EFFECTIVE_POLICY_SET_VERSION
});

function normalizeLocale(locale) {
  return locale === "en" ? "en" : "ko";
}

function buildScoreCard(concernScores = {}) {
  return Object.fromEntries(
    Object.entries(concernScores).map(([axis, total]) => [
      axis,
      { total: Number.isFinite(Number(total)) ? Number(total) : 0 }
    ])
  );
}

function buildPolicyContext(sharedContext, locale) {
  return {
    locale: normalizeLocale(locale),
    answers: sharedContext?.survey?.answers || {},
    priorityAxis: sharedContext?.skinState?.priorityAxis || "",
    scoreCard: buildScoreCard(sharedContext?.skinState?.concernScores || {}),
    safetyState: sharedContext?.safetyState || null,
    productExposureState: sharedContext?.productExposureState || null,
    sharedContext
  };
}

function buildDecisionBundle({
  locale,
  context,
  contextHash,
  contextRevision,
  functionalPolicy,
  functionalDecisions,
  functionalProjection,
  routinePolicy,
  routineProjection,
  rawPolicies,
  consistency,
  effectivePolicySource,
  conditionPolicy,
  conditionProjection
}) {
  return {
    version: DECISION_BUNDLE_VERSION,
    locale: normalizeLocale(locale),
    contextVersion: SHARED_SKIN_DECISION_CONTEXT_VERSION,
    contextRevision,
    contextHash,
    policyVersions: { ...POLICY_VERSIONS },
    dependencies: {
      currentProducts: true,
      routineStructure: false,
      currentProductVerdicts: false,
      functionalPolicyResult: false,
      routinePolicyResult: false,
      photoObservations: true,
      surveyAnswers: context?.survey?.completeness === "available"
    },
    context,
    rawPolicies,
    consistency,
    effectivePolicySource,
    functionalPolicy,
    functionalDecisions,
    functionalPlan: functionalProjection.functionalPlan,
    currentProductFindings: functionalProjection.currentProductFindings,
    functionalRoutineAudit: functionalProjection.functionalRoutineAudit,
    routinePolicy,
    routinePlan: routineProjection.routinePlan,
    routineProductActions: routinePolicy.productActions,
    conditionPolicy,
    conditionPlan: conditionProjection.conditionPlan,
    conditionResponses: conditionProjection.conditionResponses
  };
}

export function buildPremiumDecisionState(report = {}, options = {}) {
  const locale = normalizeLocale(options.locale);
  const { context, contextHash, contextRevision } = buildSharedSkinDecisionContext(report, {
    source: options.source || "premium_decision_state"
  });
  const policyContext = buildPolicyContext(context, locale);
  const rawFunctionalPolicy = buildFunctionalPolicy(policyContext);
  const rawRoutinePolicy = buildRoutinePolicy({ sharedContext: context });
  const rawConditionPolicy = buildConditionPolicy({ sharedContext: context });
  const rawPolicies = {
    functional: rawFunctionalPolicy,
    routine: rawRoutinePolicy,
    condition: rawConditionPolicy
  };
  const consistency = buildCrossDomainConsistency({
    sharedContext: context,
    functionalPolicy: rawFunctionalPolicy,
    routinePolicy: rawRoutinePolicy,
    conditionPolicy: rawConditionPolicy
  });
  const effectivePolicySet = buildEffectivePolicySet({
    sharedContext: context,
    functionalPolicy: rawFunctionalPolicy,
    routinePolicy: rawRoutinePolicy,
    conditionPolicy: rawConditionPolicy,
    consistency
  });
  const functionalPolicy = effectivePolicySet.functionalPolicy;
  const routinePolicy = effectivePolicySet.routinePolicy;
  const conditionPolicy = effectivePolicySet.conditionPolicy;
  const functionalDecisions = buildPremiumFunctionalDecisions({
    ...policyContext,
    functionalPolicy
  });
  const functionalProjection = buildPremiumFunctionalProjection({
    report,
    functionalPolicy,
    locale
  });
  const routineProjection = buildPremiumRoutineProjection({
    report,
    routinePolicy,
    locale
  });
  const conditionProjection = buildPremiumConditionProjection({
    report,
    conditionPolicy,
    locale,
    allowLegacyFallback: effectivePolicySet.source === "raw"
  });
  const decisionBundle = buildDecisionBundle({
    locale,
    context,
    contextHash,
    contextRevision,
    functionalPolicy,
    functionalDecisions,
    functionalProjection,
    routinePolicy,
    routineProjection,
    rawPolicies,
    consistency,
    effectivePolicySource: effectivePolicySet.source,
    conditionPolicy,
    conditionProjection
  });

  return {
    decisionBundle,
    rawPolicies,
    consistency,
    effectivePolicySource: effectivePolicySet.source,
    functionalPolicy,
    functionalDecisions,
    functionalPlan: functionalProjection.functionalPlan,
    currentProductFindings: functionalProjection.currentProductFindings,
    functionalRoutineAudit: functionalProjection.functionalRoutineAudit,
    routinePolicy,
    routinePlan: routineProjection.routinePlan,
    routineProductActions: routinePolicy.productActions,
    routineStructure: routineProjection.routineStructure,
    fullRoutine: routineProjection.fullRoutine,
    currentProductVerdicts: routineProjection.currentProductVerdicts,
    avoidCombinations: routineProjection.avoidCombinations,
    conditionPolicy,
    conditionPlan: conditionProjection.conditionPlan,
    conditionResponses: conditionProjection.conditionResponses
  };
}

export function rebuildPremiumDecisionState(report = {}, options = {}) {
  if (!report || typeof report !== "object" || Array.isArray(report)) return report;
  return { ...report, ...buildPremiumDecisionState(report, options) };
}

export function applyPremiumDecisionState(targetReport, options = {}) {
  if (!targetReport || typeof targetReport !== "object" || Array.isArray(targetReport)) return targetReport;
  const decisionState = buildPremiumDecisionState(targetReport, options);
  Object.assign(targetReport, decisionState);
  return targetReport;
}

export const PREMIUM_DECISION_BUNDLE_VERSION = DECISION_BUNDLE_VERSION;
export const PREMIUM_DECISION_POLICY_VERSIONS = POLICY_VERSIONS;
