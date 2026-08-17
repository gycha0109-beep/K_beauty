export const EXFOLIATION_NORMATIVE_POLICY_ACTIVATION_VERSION = "exfoliation-non-numeric-pda-normative-production-policy-activation-v1";
export const EXFOLIATION_NORMATIVE_POLICY_AUTHORIZATION_VERSION = "exfoliation-normative-production-policy-staged-shadow-authorization-v1";
export const EXFOLIATION_NORMATIVE_POLICY_CONTRACT_VERSION = "exfoliation-non-numeric-pda-normative-production-policy-decision-contract-v1";
export const EXFOLIATION_NORMATIVE_POLICY_RUNTIME_VERSION = "exfoliation-non-numeric-pda-normative-production-policy-shadow-v1";
export const EXFOLIATION_NORMATIVE_POLICY_BOUNDARY = "POST_SCORE_POST_SORT_ELIGIBILITY_OVERLAY_BEFORE_RESULT_ASSEMBLY";
export const EXFOLIATION_NORMATIVE_POLICY_FALLBACK = "FAIL_CLOSED_TO_POLICY_DEFER_PRESERVE_EXISTING_LEGACY_PRODUCTION_PATH";
export const EXFOLIATION_NORMATIVE_POLICY_ROLLBACK_TARGET = "LEGACY_ONLY";
export const EXFOLIATION_NORMATIVE_POLICY_AUTHORIZED_MODE = "SHADOW";
export const EXFOLIATION_NORMATIVE_POLICY_MODES = Object.freeze(["OFF", "SHADOW", "ENFORCE"]);
export const EXFOLIATION_NORMATIVE_POLICY_ACTIONS = Object.freeze(["ALLOW", "CAUTION", "RESTRICT", "DEFER", "NOT_APPLICABLE"]);
export const EXFOLIATION_NORMATIVE_POLICY_EXPECTED_UPSTREAM_VERSIONS = Object.freeze({
  candidate_exposure_policy_version: "candidate-exposure-policy-v1",
  routine_policy_version: "routine-policy-v1",
  upstream_neutral_contract_version: "exfoliation-non-numeric-pda-production-consumption-contract-v1",
  upstream_neutral_shadow_version: "exfoliation-non-numeric-pda-production-consumption-shadow-v1"
});

function text(value) { return String(value ?? "").trim(); }
function bool1(value) { return text(value) === "1"; }
function uniqueSorted(values) { return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "en")); }

export function resolveExfoliationNormativePolicyActivationControl(envLike = {}) {
  const enabled = bool1(envLike.EXFOLIATION_NORMATIVE_POLICY_ENABLED);
  const killSwitchRequested = bool1(envLike.EXFOLIATION_NORMATIVE_POLICY_KILL_SWITCH);
  const requestedMode = text(envLike.EXFOLIATION_NORMATIVE_POLICY_MODE).toUpperCase() || "OFF";
  const modeValid = EXFOLIATION_NORMATIVE_POLICY_MODES.includes(requestedMode);
  const versions = {
    activation_version: text(envLike.EXFOLIATION_NORMATIVE_POLICY_ACTIVATION_VERSION),
    policy_contract_version: text(envLike.EXFOLIATION_NORMATIVE_POLICY_CONTRACT_VERSION),
    runtime_version: text(envLike.EXFOLIATION_NORMATIVE_POLICY_RUNTIME_VERSION)
  };
  const scope = text(envLike.EXFOLIATION_NORMATIVE_POLICY_SCOPE);
  const versionCompatible =
    versions.activation_version === EXFOLIATION_NORMATIVE_POLICY_ACTIVATION_VERSION &&
    versions.policy_contract_version === EXFOLIATION_NORMATIVE_POLICY_CONTRACT_VERSION &&
    versions.runtime_version === EXFOLIATION_NORMATIVE_POLICY_RUNTIME_VERSION;
  const scopeValid = scope === EXFOLIATION_NORMATIVE_POLICY_BOUNDARY;
  const reasons = [];
  let effectiveMode = "OFF";

  if (killSwitchRequested) reasons.push("kill_switch_override");
  else if (!enabled) reasons.push("activation_disabled_default_off");
  else if (!modeValid) reasons.push("invalid_activation_mode");
  else if (requestedMode === "OFF") reasons.push("requested_off");
  else if (!versionCompatible) reasons.push("version_mismatch");
  else if (!scopeValid) reasons.push("unsupported_activation_scope");
  else if (requestedMode === "ENFORCE") reasons.push("enforce_not_authorized_by_v21_9d");
  else effectiveMode = "SHADOW";

  return Object.freeze({
    version: EXFOLIATION_NORMATIVE_POLICY_AUTHORIZATION_VERSION,
    requestedMode,
    effectiveMode,
    enabledRequested: enabled,
    killSwitchRequested,
    modeValid,
    versionCompatible,
    scope,
    scopeValid,
    runtimeAllowed: effectiveMode === "SHADOW",
    enforcementAllowed: false,
    authorizedMode: EXFOLIATION_NORMATIVE_POLICY_AUTHORIZED_MODE,
    fallbackMode: EXFOLIATION_NORMATIVE_POLICY_FALLBACK,
    rollbackTarget: EXFOLIATION_NORMATIVE_POLICY_ROLLBACK_TARGET,
    versions: Object.freeze(versions),
    reasonCodes: Object.freeze(uniqueSorted(reasons.length ? reasons : ["staged_shadow_runtime_allowed"]))
  });
}

export function validateNormativePolicyResult(result) {
  const errors = [];
  if (!result || typeof result !== "object" || Array.isArray(result)) return { valid: false, errors: ["malformed_normative_output"] };
  if (result.version !== EXFOLIATION_NORMATIVE_POLICY_RUNTIME_VERSION) errors.push("runtime_version_mismatch");
  if (result.contract_version !== EXFOLIATION_NORMATIVE_POLICY_CONTRACT_VERSION) errors.push("contract_version_mismatch");
  if (!EXFOLIATION_NORMATIVE_POLICY_ACTIONS.includes(result.policy_action)) errors.push("unsupported_policy_action");
  if (!Array.isArray(result.reason_codes) || result.reason_codes.length === 0) errors.push("missing_reason_codes");
  if (!Array.isArray(result.authority_sources) || result.authority_sources.length === 0) errors.push("missing_authority_sources");
  if (!result.provenance || typeof result.provenance !== "object" || Array.isArray(result.provenance)) errors.push("missing_provenance");
  else {
    if (result.provenance.contract_version !== EXFOLIATION_NORMATIVE_POLICY_CONTRACT_VERSION) errors.push("provenance_contract_version_mismatch");
    if (result.provenance.shadow_runtime_version !== EXFOLIATION_NORMATIVE_POLICY_RUNTIME_VERSION) errors.push("provenance_runtime_version_mismatch");
  }
  return { valid: errors.length === 0, errors: uniqueSorted(errors) };
}

export function validateRuntimePrerequisites({ control, upstreamVersions = {} } = {}) {
  const errors = [];
  if (!control || control.version !== EXFOLIATION_NORMATIVE_POLICY_AUTHORIZATION_VERSION) errors.push("activation_gate_mismatch");
  if (control?.effectiveMode !== "SHADOW" || control?.runtimeAllowed !== true) errors.push("runtime_not_allowed");
  for (const [key, expected] of Object.entries(EXFOLIATION_NORMATIVE_POLICY_EXPECTED_UPSTREAM_VERSIONS)) {
    if (upstreamVersions?.[key] !== expected) errors.push(`upstream_version_mismatch:${key}`);
  }
  return { valid: errors.length === 0, errors: uniqueSorted(errors) };
}

export function buildNormativePolicyFallback(reasonCodes = []) {
  return Object.freeze({
    policy_action: "DEFER",
    fallback: true,
    fallback_mode: EXFOLIATION_NORMATIVE_POLICY_FALLBACK,
    reason_codes: Object.freeze(uniqueSorted(["policy_runtime_failure_defer", "legacy_path_preserved", ...reasonCodes])),
    apply_policy_exclusion: false,
    legacy_path_preserved: true,
    canonical_eligibility_mutated: false,
    canonical_score_mutated: false,
    canonical_rank_mutated: false,
    canonical_top_k_mutated: false
  });
}

export function composeDormantNormativeEligibility({ existingEligibility, policyResult } = {}) {
  if (typeof existingEligibility !== "boolean") {
    return { valid: false, reasonCode: "eligibility_materialization_failure", existingEligibility: null, normativePolicyEligibility: null, effectiveEligibility: null, scoreRecomputed: false, rankRecomputed: false };
  }
  const validation = validateNormativePolicyResult(policyResult);
  if (!validation.valid) {
    return { valid: false, reasonCode: "invalid_normative_result", existingEligibility, normativePolicyEligibility: null, effectiveEligibility: existingEligibility, scoreRecomputed: false, rankRecomputed: false };
  }
  const normativePolicyEligibility = policyResult.policy_action !== "RESTRICT";
  return {
    valid: true,
    reasonCode: policyResult.policy_action === "RESTRICT" ? "restrict_normative_ineligible" : "non_restrict_preserve_existing",
    existingEligibility,
    normativePolicyEligibility,
    effectiveEligibility: existingEligibility && normativePolicyEligibility,
    scoreRecomputed: false,
    rankRecomputed: false
  };
}

export function simulateDormantStableOverlay(candidates = [], policyResultsByKey = new Map()) {
  const before = Array.isArray(candidates) ? candidates : [];
  const rows = before.map((candidate, index) => {
    const key = String(candidate?.key ?? candidate?.id ?? index);
    const policyResult = policyResultsByKey instanceof Map ? policyResultsByKey.get(key) : policyResultsByKey?.[key];
    return { key, candidate, decision: composeDormantNormativeEligibility({ existingEligibility: candidate?.existingEligibility, policyResult }) };
  });
  const invalid = rows.find((row) => !row.decision.valid);
  if (invalid) {
    return { valid: false, fallback: buildNormativePolicyFallback([invalid.decision.reasonCode]), beforeCount: before.length, afterCount: before.length, excludedKeys: [], candidates: before, orderPreserved: true, scoreRecomputed: false, rankRecomputed: false };
  }
  const survivors = rows.filter((row) => row.decision.effectiveEligibility).map((row) => row.candidate);
  const excludedKeys = rows.filter((row) => !row.decision.effectiveEligibility && row.decision.existingEligibility).map((row) => row.key);
  return { valid: true, fallback: null, beforeCount: before.length, afterCount: survivors.length, excludedKeys, candidates: survivors, orderPreserved: true, scoreRecomputed: false, rankRecomputed: false };
}

export async function runExfoliationNormativePolicyRuntime({ control, upstreamVersions, evaluator, evaluationInput, existingEligibility = true } = {}) {
  if (!control || control.effectiveMode === "OFF" || control.runtimeAllowed !== true) {
    return { mode: "OFF", runtimeExecuted: false, policyResult: null, policyDecision: null, fallback: null, canonicalMutationApplied: false, legacyPathPreserved: true };
  }
  const prerequisite = validateRuntimePrerequisites({ control, upstreamVersions });
  if (!prerequisite.valid) {
    return { mode: "SHADOW", runtimeExecuted: false, policyResult: null, policyDecision: null, fallback: buildNormativePolicyFallback(["missing_runtime_prerequisite", ...prerequisite.errors]), canonicalMutationApplied: false, legacyPathPreserved: true };
  }
  if (typeof evaluator !== "function") {
    return { mode: "SHADOW", runtimeExecuted: false, policyResult: null, policyDecision: null, fallback: buildNormativePolicyFallback(["evaluator_missing"]), canonicalMutationApplied: false, legacyPathPreserved: true };
  }
  try {
    const policyResult = await evaluator(evaluationInput);
    const validation = validateNormativePolicyResult(policyResult);
    if (!validation.valid) {
      return { mode: "SHADOW", runtimeExecuted: true, policyResult: null, policyDecision: null, fallback: buildNormativePolicyFallback(["invalid_policy_output", ...validation.errors]), canonicalMutationApplied: false, legacyPathPreserved: true };
    }
    const policyDecision = composeDormantNormativeEligibility({ existingEligibility, policyResult });
    if (!policyDecision.valid) {
      return { mode: "SHADOW", runtimeExecuted: true, policyResult: null, policyDecision: null, fallback: buildNormativePolicyFallback([policyDecision.reasonCode]), canonicalMutationApplied: false, legacyPathPreserved: true };
    }
    return { mode: "SHADOW", runtimeExecuted: true, policyResult, policyDecision, fallback: null, canonicalMutationApplied: false, legacyPathPreserved: true };
  } catch {
    return { mode: "SHADOW", runtimeExecuted: true, policyResult: null, policyDecision: null, fallback: buildNormativePolicyFallback(["evaluator_exception"]), canonicalMutationApplied: false, legacyPathPreserved: true };
  }
}
