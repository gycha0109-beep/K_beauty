import {
  buildCandidatePolicyCurrentFindingsContext,
  validateCandidatePolicyCurrentFindingsContext
} from "./candidate-policy-current-findings-context.js";
import {
  FUNCTIONAL_POLICY_TAXONOMY,
  FUNCTIONAL_POLICY_VERSION
} from "./functional-policy.js";
import {
  SHARED_SKIN_DECISION_CONTEXT_VERSION
} from "./shared-skin-decision-context.js";
import {
  validateCandidatePolicyRuntimeSafetyContext
} from "./candidate-policy-runtime-safety.js";

export const CANDIDATE_POLICY_GOAL_CONTEXT_VERSION =
  "candidate-policy-goal-context-v1";

const GOAL_CONTEXT_SOURCE = "canonical_shared_context_functional_policy";
const RANKING_GOAL_SOURCE = "canonical_functional_policy_priority_axis";
const VALID_GOALS = new Set(FUNCTIONAL_POLICY_TAXONOMY.CONCERN_AXES);
const VALID_EFFECTIVE_SOURCES = new Set(["raw", "stabilization_fallback"]);
const REASON_PATTERN = /^[a-z0-9][a-z0-9_:.-]{0,79}$/;

function normalizeGoal(value) {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFKC").trim().toLowerCase();
  return VALID_GOALS.has(normalized) ? normalized : null;
}

function unique(values = []) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

export function validateCandidatePolicyGoalContext(context) {
  const errors = [];
  if (!context || typeof context !== "object" || Array.isArray(context)) {
    return { valid: false, errors: ["canonical_goal_context_missing"] };
  }
  if (context.version !== CANDIDATE_POLICY_GOAL_CONTEXT_VERSION) {
    errors.push("candidate_goal_context_version_invalid");
  }
  if (context.source !== GOAL_CONTEXT_SOURCE) {
    errors.push("candidate_goal_context_source_invalid");
  }
  if (context.sharedContextVersion !== SHARED_SKIN_DECISION_CONTEXT_VERSION) {
    errors.push("candidate_goal_shared_context_version_invalid");
  }
  if (context.policyVersion !== FUNCTIONAL_POLICY_VERSION) {
    errors.push("candidate_goal_policy_version_invalid");
  }
  if (!VALID_EFFECTIVE_SOURCES.has(context.effectivePolicySource)) {
    errors.push("candidate_goal_effective_policy_source_invalid");
  }
  if (context.requestedGoal !== null && !VALID_GOALS.has(context.requestedGoal)) {
    errors.push("candidate_goal_requested_invalid");
  }
  if (!VALID_GOALS.has(context.detectedPriority)) {
    errors.push("candidate_goal_detected_priority_invalid");
  }
  if (!VALID_GOALS.has(context.rankingGoal)) {
    errors.push("candidate_goal_ranking_invalid");
  }
  if (
    VALID_GOALS.has(context.detectedPriority) &&
    VALID_GOALS.has(context.rankingGoal) &&
    context.detectedPriority !== context.rankingGoal
  ) {
    errors.push("candidate_goal_canonical_priority_mismatch");
  }
  if (typeof context.goalTension !== "boolean") {
    errors.push("candidate_goal_tension_invalid");
  } else {
    const expectedTension = Boolean(
      context.requestedGoal &&
      context.rankingGoal &&
      context.requestedGoal !== context.rankingGoal
    );
    if (context.goalTension !== expectedTension) {
      errors.push("candidate_goal_tension_mismatch");
    }
  }
  if (context.rankingGoalSource !== RANKING_GOAL_SOURCE) {
    errors.push("candidate_goal_ranking_source_invalid");
  }
  if (
    !Array.isArray(context.reasonCodes) ||
    context.reasonCodes.some((reason) => !REASON_PATTERN.test(String(reason)))
  ) {
    errors.push("candidate_goal_reason_codes_invalid");
  }
  const currentFindingsValidation =
    validateCandidatePolicyCurrentFindingsContext(context.currentFindingsContext);
  if (!currentFindingsValidation.valid) {
    errors.push(...currentFindingsValidation.errors);
  }
  return { valid: errors.length === 0, errors: unique(errors) };
}

export function buildCandidatePolicyGoalContext({
  surveyContract = {},
  sharedContext = {},
  functionalPolicy = {},
  effectivePolicySource = "raw"
} = {}) {
  const requestedGoal = normalizeGoal(surveyContract?.goals?.primaryConcern);
  const detectedPriority = normalizeGoal(sharedContext?.skinState?.priorityAxis);
  const rankingGoal = normalizeGoal(functionalPolicy?.priorityAxis);
  const currentFindingsContext = buildCandidatePolicyCurrentFindingsContext({
    sharedContext,
    functionalPolicy
  });
  const context = {
    version: CANDIDATE_POLICY_GOAL_CONTEXT_VERSION,
    source: GOAL_CONTEXT_SOURCE,
    sharedContextVersion: String(sharedContext?.version || ""),
    policyVersion: String(functionalPolicy?.version || ""),
    effectivePolicySource: String(effectivePolicySource || ""),
    requestedGoal,
    detectedPriority,
    rankingGoal,
    goalTension: Boolean(
      requestedGoal && rankingGoal && requestedGoal !== rankingGoal
    ),
    rankingGoalSource: RANKING_GOAL_SOURCE,
    currentFindingsContext,
    reasonCodes: unique([
      requestedGoal ? "requested_goal_present" : "requested_goal_missing",
      detectedPriority ? "detected_priority_present" : "detected_priority_missing",
      rankingGoal ? "ranking_goal_from_canonical_functional_policy" : "ranking_goal_missing",
      requestedGoal && rankingGoal && requestedGoal !== rankingGoal
        ? "requested_detected_goal_tension"
        : "requested_detected_goal_aligned",
      `current_findings:${currentFindingsContext.exposureState}`
    ])
  };
  const validation = validateCandidatePolicyGoalContext(context);
  if (!validation.valid) {
    throw new Error(`Candidate goal context invalid: ${validation.errors.join(",")}`);
  }
  return deepFreeze(context);
}

export function resolveCandidatePolicyGoalPolicy({
  candidateGoalContext = null,
  candidateSafetyContext = null,
  legacyGoalPolicy = {}
} = {}) {
  const validation = validateCandidatePolicyGoalContext(candidateGoalContext);
  const safetyValidation =
    validateCandidatePolicyRuntimeSafetyContext(candidateSafetyContext);
  if (!validation.valid) {
    const missing = validation.errors.includes("canonical_goal_context_missing");
    return deepFreeze({
      valid: false,
      stopReason: missing
        ? "canonical_goal_context_missing"
        : "canonical_goal_context_invalid",
      legacyFallbackUsed: false,
      goalPolicy: {
        requestedConcern: null,
        detectedPriority: null,
        hasTension: false,
        tensionType: "unavailable",
        rankingGoal: null,
        safetyGoal: null,
        currentProductFindings: null,
        copyStrategy: {
          leadWith: "unknown",
          cautionWith: "unknown",
          explainAs: "unavailable"
        },
        recommendationGuard: "stabilize_first",
        warnings: unique(validation.errors)
      }
    });
  }

  const requestedConcern = candidateGoalContext.requestedGoal;
  const detectedPriority = candidateGoalContext.detectedPriority;
  const hasTension = candidateGoalContext.goalTension;
  const safetyUnavailable = !safetyValidation.valid;
  const stabilizationMode = safetyUnavailable ||
    candidateSafetyContext.stabilizationMode === true ||
    candidateSafetyContext.recommendationSuppressed === true ||
    candidateSafetyContext.activeExpansionAllowed === false;
  const warnings = unique([
    ...(Array.isArray(legacyGoalPolicy?.warnings) ? legacyGoalPolicy.warnings : []),
    ...(safetyUnavailable ? ["canonical_safety_context_unavailable"] : [])
  ]);

  return deepFreeze({
    valid: true,
    stopReason: null,
    legacyFallbackUsed: false,
    goalPolicy: {
      requestedConcern,
      detectedPriority,
      hasTension,
      tensionType: hasTension
        ? stabilizationMode
          ? "requested_goal_vs_safety_priority"
          : "requested_goal_vs_detected_priority"
        : "none",
      rankingGoal: candidateGoalContext.rankingGoal,
      safetyGoal: detectedPriority || requestedConcern || null,
      currentProductFindings: candidateGoalContext.currentFindingsContext,
      copyStrategy: {
        leadWith: requestedConcern
          ? "requestedConcern"
          : detectedPriority
            ? "detectedPriority"
            : "unknown",
        cautionWith: detectedPriority ? "safetyGoal" : "unknown",
        explainAs: hasTension ? "tension" : "aligned"
      },
      recommendationGuard: stabilizationMode ? "stabilize_first" : "normal",
      warnings,
      candidateGoalContext
    }
  });
}
