import {
  EXFOLIATION_NORMATIVE_POLICY_ACTIVATION_VERSION,
  EXFOLIATION_NORMATIVE_POLICY_CONTRACT_VERSION,
  EXFOLIATION_NORMATIVE_POLICY_EXPECTED_UPSTREAM_VERSIONS,
  EXFOLIATION_NORMATIVE_POLICY_RUNTIME_VERSION,
  resolveExfoliationNormativePolicyActivationControl,
  runExfoliationNormativePolicyRuntime
} from "./exfoliation-normative-policy-activation-runtime.js";
import {
  buildExfoliationNormativePolicyRuntimeTelemetry,
  emitExfoliationNormativePolicyRuntimeTelemetry
} from "./exfoliation-normative-policy-runtime-observability.js";
import {
  evaluateExfoliationNormativeProductionPolicyShadow
} from "./exfoliation-non-numeric-pda-normative-production-policy-shadow.js";
import {
  buildExfoliationNormativePolicySkinMatchContext
} from "./exfoliation-normative-policy-skin-match-context-adapter.js";
import { buildRoutinePolicy } from "./routine-policy.js";
import { resolveRecentInstabilityGuardPolicy } from "./recent-instability-guard-policy.js";
import { resolveProductFunctionalProfile } from "./product-functional-profile.js";
import { buildSurveyInputContract } from "./survey-input-contract.js";
import { resolveFunctionalGoalPolicy } from "./functional-goal-policy.js";
import {
  buildExfoliationNormativePolicyAuthorityGapEnvelope,
  getExfoliationNormativePolicyGovernedRuntimeEnvelope
} from "./exfoliation-normative-policy-governed-runtime-authority.js";

export const EXFOLIATION_NORMATIVE_POLICY_PRODUCTION_SHADOW_OBSERVER_VERSION =
  "exfoliation-normative-policy-production-shadow-observer-v1";

function text(value) {
  return String(value ?? "").trim();
}

function cloneForShadow(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function candidateId(candidate) {
  return text(candidate?.id || candidate?.productId || candidate?.product_id) || null;
}

function candidateCanonicalSnapshot(candidates = []) {
  return candidates.map((candidate) => ({
    id: candidateId(candidate),
    engine_score: candidate?.engine_score ?? null,
    score: candidate?.score ?? null,
    rank: candidate?.rank ?? null
  }));
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function normalizeRoutineAction(value) {
  const normalized = text(value || "keep").toLowerCase();
  return normalized === "maintain" ? "keep" : normalized;
}

function routineProductAction(routinePolicy, id) {
  const exact = Array.isArray(routinePolicy?.productActions)
    ? routinePolicy.productActions.find(
        (row) => String(row?.productId || "") === String(id || "")
      )
    : null;
  if (exact?.action) return normalizeRoutineAction(exact.action);

  const treatment = routinePolicy?.windows?.evening?.steps?.find(
    (step) => step?.stepKey === "pm.treatment"
  );
  return normalizeRoutineAction(treatment?.action || "keep");
}

function sameWindowSeverity(routinePolicy) {
  const rows = Array.isArray(routinePolicy?.prohibitedSameWindow)
    ? routinePolicy.prohibitedSameWindow
    : [];
  if (rows.some((row) => row?.severity === "blocked")) return "blocked";
  if (rows.some((row) => row?.severity === "warning")) return "warning";
  return "none";
}

function recentSafetyFlags(recentGuard) {
  const reasons = Array.isArray(recentGuard?.reasons) ? recentGuard.reasons : [];
  return {
    sensitivity_context: reasons.includes("high_sensitivity_detected"),
    recent_reaction_or_instability: reasons.includes("recent_instability_detected")
  };
}

function buildGovernedContext(envelope) {
  const activeIdentities = Array.isArray(envelope?.active_identities)
    ? envelope.active_identities
    : [];
  const hasMissingConcentration = activeIdentities.some(
    (row) => row?.concentration_state === null || row?.concentration_state === "MISSING"
  );
  return {
    signal_status: envelope?.signal_status || "UNKNOWN",
    active_identities: activeIdentities.map((row) => row?.identity).filter(Boolean),
    multi_active_status: activeIdentities.length > 1 ? "MULTIPLE" : "SINGLE",
    coverage: envelope?.coverage_state || "UNKNOWN",
    uncertainty:
      envelope?.uncertainty ||
      (hasMissingConcentration || envelope?.signal_status === "GOVERNED_SIGNAL_NOT_ESTABLISHED"
        ? "HIGH"
        : "LOW"),
    concentration_state: hasMissingConcentration
      ? "MISSING"
      : "AVAILABLE_OR_NOT_REQUIRED",
    legacy_strength_comparable: "NOT_RELEVANT",
    governed_identity_overlap: envelope?.identity_overlap_state === "present"
  };
}

function buildCanonicalDecisionContext({
  input,
  priorityAxis,
  scoreCard,
  currentProductsReport
}) {
  return buildExfoliationNormativePolicySkinMatchContext({
    freeResult: {
      answers: input && typeof input === "object" ? input : {},
      priority: { axis: priorityAxis || null },
      scoring: { concernScores: scoreCard || {} }
    },
    currentProducts: currentProductsReport || null
  });
}

function buildResolvedExternalPolicyContext({
  context,
  candidate,
  surveySafety,
  goalPolicy
}) {
  const routinePolicy = buildRoutinePolicy({ context });
  const shadowCandidate = cloneForShadow(candidate) || {};
  const profile = resolveProductFunctionalProfile(shadowCandidate);
  const recentGuard = resolveRecentInstabilityGuardPolicy({
    surveySafety: surveySafety || {},
    goalPolicy: goalPolicy || {},
    product: shadowCandidate,
    productProfile: profile
  });
  const flags = recentSafetyFlags(recentGuard);

  return {
    recent_instability_guard_decision: recentGuard.decision,
    routine_action: routineProductAction(routinePolicy, candidateId(shadowCandidate)),
    same_window_severity: sameWindowSeverity(routinePolicy),
    duplicate_exfoliation: false,
    sensitivity_context: flags.sensitivity_context,
    recent_reaction_or_instability: flags.recent_reaction_or_instability,
    preference_ranking_benefit: false,
    governed_identity_overlap: false,
    provenance: {
      source: "v21_9e_existing_policy_composition",
      recent_instability_guard_policy_version: "recent-instability-guard-policy-v1",
      routine_policy_version: EXFOLIATION_NORMATIVE_POLICY_EXPECTED_UPSTREAM_VERSIONS.routine_policy_version,
      duplicate_relation: "NOT_RESOLVED_AT_THIS_BOUNDARY"
    }
  };
}

function buildRuntimeEvent({ runtimeResult, latencyMs }) {
  const fallbackReasons = runtimeResult?.fallback?.reason_codes || [];
  const policyReasons = runtimeResult?.policyResult?.reason_codes || [];
  return {
    runtimeExecuted: runtimeResult?.runtimeExecuted === true,
    runtimeError: fallbackReasons.includes("evaluator_exception"),
    invalidPolicyOutput: fallbackReasons.includes("invalid_policy_output"),
    fallback: Boolean(runtimeResult?.fallback),
    legacyPathPreserved: runtimeResult?.legacyPathPreserved === true,
    policyAction:
      runtimeResult?.policyResult?.policy_action ||
      runtimeResult?.fallback?.policy_action ||
      null,
    existingEligibility: true,
    actualNormativeExclusion: false,
    candidateCountBefore: 1,
    candidateCountAfter: 1,
    topKChanged: false,
    latencyMs,
    reasonCodes: [...policyReasons, ...fallbackReasons]
  };
}

function buildOffEvents(candidateCount, control) {
  return Array.from({ length: candidateCount }, () => ({
    runtimeExecuted: false,
    runtimeError: false,
    invalidPolicyOutput: false,
    fallback: false,
    legacyPathPreserved: true,
    policyAction: null,
    existingEligibility: true,
    actualNormativeExclusion: false,
    candidateCountBefore: 1,
    candidateCountAfter: 1,
    topKChanged: false,
    latencyMs: 0,
    reasonCodes: Array.isArray(control?.reasonCodes) ? [...control.reasonCodes] : []
  }));
}

export async function observeExfoliationNormativePolicyProductionShadow({
  input = {},
  candidates = [],
  priorityAxis = null,
  scoreCard = {},
  currentProductsReport = null,
  envLike = process.env,
  telemetrySink = console.info
} = {}) {
  const canonicalCandidates = Array.isArray(candidates) ? candidates : [];
  const before = candidateCanonicalSnapshot(canonicalCandidates);
  const beforeTop1 = before.slice(0, 1).map((row) => row.id);
  const beforeTop3 = before.slice(0, 3).map((row) => row.id);
  const control = resolveExfoliationNormativePolicyActivationControl(envLike);
  let runtimeEvents = [];

  if (control.effectiveMode === "SHADOW" && control.runtimeAllowed === true) {
    const context = buildCanonicalDecisionContext({
      input,
      priorityAxis,
      scoreCard,
      currentProductsReport
    });
    const surveyContract = buildSurveyInputContract(input, {
      source: "v21_9e_normative_policy_production_shadow"
    });
    const goalPolicy = resolveFunctionalGoalPolicy({
      surveyContract,
      freeResultPriority: { axis: priorityAxis || null },
      safety: surveyContract.safety
    });

    runtimeEvents = [];
    for (const candidate of canonicalCandidates) {
      const startedAt = Date.now();
      const id = candidateId(candidate);
      const governedEnvelope =
        getExfoliationNormativePolicyGovernedRuntimeEnvelope(id) ||
        buildExfoliationNormativePolicyAuthorityGapEnvelope(id);
      const externalPolicyContext = buildResolvedExternalPolicyContext({
        context,
        candidate,
        surveySafety: surveyContract.safety,
        goalPolicy
      });
      const governedContext = buildGovernedContext(governedEnvelope);
      const runtimeResult = await runExfoliationNormativePolicyRuntime({
        control,
        upstreamVersions: EXFOLIATION_NORMATIVE_POLICY_EXPECTED_UPSTREAM_VERSIONS,
        evaluator: evaluateExfoliationNormativeProductionPolicyShadow,
        evaluationInput: {
          productionConsumptionEnvelope: governedEnvelope,
          externalPolicyContext,
          governedContext,
          uncertainty: governedContext.uncertainty,
          provenance: {
            stage: "V2.1-9E",
            observer_version: EXFOLIATION_NORMATIVE_POLICY_PRODUCTION_SHADOW_OBSERVER_VERSION,
            authority_gap_fallback: getExfoliationNormativePolicyGovernedRuntimeEnvelope(id) === null
          }
        },
        existingEligibility: true
      });
      runtimeEvents.push(
        buildRuntimeEvent({ runtimeResult, latencyMs: Date.now() - startedAt })
      );
    }
  } else {
    runtimeEvents = buildOffEvents(canonicalCandidates.length, control);
  }

  const after = candidateCanonicalSnapshot(canonicalCandidates);
  const afterTop1 = after.slice(0, 1).map((row) => row.id);
  const afterTop3 = after.slice(0, 3).map((row) => row.id);
  const comparison = {
    canonicalEligibilityDelta: false,
    scoreDelta: !sameJson(
      before.map((row) => [row.id, row.engine_score, row.score]),
      after.map((row) => [row.id, row.engine_score, row.score])
    ),
    rankingDelta: !sameJson(before.map((row) => row.id), after.map((row) => row.id)),
    top1Delta: !sameJson(beforeTop1, afterTop1),
    top3Delta: !sameJson(beforeTop3, afterTop3),
    persistenceDelta: false,
    publicResponseDelta: false,
    responseSchemaChanged: false,
    dbMutationDelta: false,
    storageMutationDelta: false
  };
  const telemetry = buildExfoliationNormativePolicyRuntimeTelemetry({
    control,
    runtimeEvents,
    comparison,
    versions: {
      policyContractVersion: EXFOLIATION_NORMATIVE_POLICY_CONTRACT_VERSION,
      runtimeVersion: EXFOLIATION_NORMATIVE_POLICY_RUNTIME_VERSION,
      activationVersion: EXFOLIATION_NORMATIVE_POLICY_ACTIVATION_VERSION
    }
  });
  const emission = emitExfoliationNormativePolicyRuntimeTelemetry(telemetry, telemetrySink);

  return Object.freeze({
    observerVersion: EXFOLIATION_NORMATIVE_POLICY_PRODUCTION_SHADOW_OBSERVER_VERSION,
    effectiveMode: control.effectiveMode,
    runtimeActive: control.effectiveMode === "SHADOW" && control.runtimeAllowed === true,
    canonicalMutationApplied: false,
    legacyPathPreserved: true,
    restrictCanonicalExclusionCount: 0,
    telemetry,
    telemetryEmitted: emission.emitted === true
  });
}
