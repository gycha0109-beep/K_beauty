import {
  EXFOLIATION_NORMATIVE_POLICY_ACTIVATION_VERSION,
  EXFOLIATION_NORMATIVE_POLICY_AUTHORIZED_MODE,
  EXFOLIATION_NORMATIVE_POLICY_BOUNDARY,
  EXFOLIATION_NORMATIVE_POLICY_CONTRACT_VERSION,
  EXFOLIATION_NORMATIVE_POLICY_RUNTIME_VERSION,
  resolveExfoliationNormativePolicyActivationControl
} from "./exfoliation-normative-policy-activation-runtime.js";

export const EXFOLIATION_NORMATIVE_POLICY_RUNTIME_STATE_READBACK_VERSION =
  "exfoliation-normative-policy-runtime-state-readback-v1";

export function buildExfoliationNormativePolicyRuntimeStateReadback(envLike = {}) {
  const control = resolveExfoliationNormativePolicyActivationControl(envLike);

  return Object.freeze({
    stage: "V2.1-9E",
    readbackVersion: EXFOLIATION_NORMATIVE_POLICY_RUNTIME_STATE_READBACK_VERSION,
    deploymentSha: String(envLike.VERCEL_GIT_COMMIT_SHA || "").trim() || null,
    deploymentRef: String(envLike.VERCEL_GIT_COMMIT_REF || "").trim() || null,
    vercelEnvironment: String(envLike.VERCEL_ENV || "").trim() || null,
    configSource: "VERCEL_PRODUCTION_ENVIRONMENT_VARIABLES",
    requestedMode: control.requestedMode,
    effectiveMode: control.effectiveMode,
    enabledRequested: control.enabledRequested,
    killSwitchRequested: control.killSwitchRequested,
    runtimeAllowed: control.runtimeAllowed,
    runtimeActive: control.effectiveMode === "SHADOW" && control.runtimeAllowed === true,
    enforcementAllowed: false,
    enforceActive: false,
    authorizedMode: EXFOLIATION_NORMATIVE_POLICY_AUTHORIZED_MODE,
    versionCompatible: control.versionCompatible,
    scope: control.scope,
    scopeValid: control.scopeValid,
    activationVersion: control.versions.activation_version,
    policyContractVersion: control.versions.policy_contract_version,
    runtimeVersion: control.versions.runtime_version,
    expectedActivationVersion: EXFOLIATION_NORMATIVE_POLICY_ACTIVATION_VERSION,
    expectedPolicyContractVersion: EXFOLIATION_NORMATIVE_POLICY_CONTRACT_VERSION,
    expectedRuntimeVersion: EXFOLIATION_NORMATIVE_POLICY_RUNTIME_VERSION,
    expectedScope: EXFOLIATION_NORMATIVE_POLICY_BOUNDARY,
    reasonCodes: [...control.reasonCodes],
    restrictCanonicalExclusionActive: false
  });
}
