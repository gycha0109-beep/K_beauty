import { buildFunctionalPolicy, FUNCTIONAL_POLICY_VERSION } from "./functional-policy.js";
import { buildPremiumConditionResponses } from "./premium-condition-responses.js";
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

const DECISION_BUNDLE_VERSION = "premium-decision-bundle-v3";
const POLICY_VERSIONS = Object.freeze({
  functional: FUNCTIONAL_POLICY_VERSION,
  functionalLegacyAdapter: PREMIUM_FUNCTIONAL_DECISIONS_ADAPTER_VERSION,
  functionalProjection: PREMIUM_FUNCTIONAL_PROJECTION_VERSION,
  routine: ROUTINE_POLICY_VERSION,
  routineProjection: PREMIUM_ROUTINE_PROJECTION_VERSION,
  condition: "premium-condition-responses-v2"
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

function buildPolicyContext(report, sharedContext, locale) {
  return {
    locale: normalizeLocale(locale),
    answers: sharedContext?.survey?.answers || {},
    priorityAxis: sharedContext?.skinState?.priorityAxis || "",
    scoreCard: buildScoreCard(sharedContext?.skinState?.concernScores || {}),
    routineStructure: report?.routineStructure || null,
    currentProductVerdicts: Array.isArray(report?.currentProductVerdicts)
      ? report.currentProductVerdicts
      : [],
    safetyState: sharedContext?.safetyState || null,
    productExposureState: sharedContext?.productExposureState || null,
    sharedContext
  };
}

const SURVEY_DEPENDENT_CONDITION_KEYS = new Set([
  "hydration_barrier",
  "cleansing_load",
  "environment_recovery"
]);

function mergeConditionResponses(report, context, computedResponses) {
  if (context?.survey?.completeness === "available") return computedResponses;

  const existingByKey = new Map(
    (Array.isArray(report?.conditionResponses) ? report.conditionResponses : [])
      .filter((item) => item?.responseKey)
      .map((item) => [item.responseKey, item])
  );

  return computedResponses.map((item) => {
    if (!SURVEY_DEPENDENT_CONDITION_KEYS.has(item.responseKey)) return item;
    return existingByKey.get(item.responseKey) || item;
  });
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
  conditionResponses
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
      photoObservations: true,
      surveyAnswers: context?.survey?.completeness === "available"
    },
    context,
    functionalPolicy,
    functionalDecisions,
    functionalPlan: functionalProjection.functionalPlan,
    currentProductFindings: functionalProjection.currentProductFindings,
    functionalRoutineAudit: functionalProjection.functionalRoutineAudit,
    routinePolicy,
    routinePlan: routineProjection.routinePlan,
    routineProductActions: routinePolicy.productActions,
    conditionResponses
  };
}

export function buildPremiumDecisionState(report = {}, options = {}) {
  const locale = normalizeLocale(options.locale);
  const { context, contextHash, contextRevision } = buildSharedSkinDecisionContext(report, {
    source: options.source || "premium_decision_state"
  });
  const policyContext = buildPolicyContext(report, context, locale);
  const functionalPolicy = buildFunctionalPolicy(policyContext);
  const functionalDecisions = buildPremiumFunctionalDecisions({
    ...policyContext,
    functionalPolicy
  });
  const computedConditionResponses = buildPremiumConditionResponses(policyContext);
  const conditionResponses = mergeConditionResponses(report, context, computedConditionResponses);
  const functionalProjection = buildPremiumFunctionalProjection({
    report,
    functionalPolicy,
    locale
  });
  const routinePolicy = buildRoutinePolicy({ sharedContext: context });
  const routineProjection = buildPremiumRoutineProjection({
    report,
    routinePolicy,
    locale
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
    conditionResponses
  });

  return {
    decisionBundle,
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
    conditionResponses
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
