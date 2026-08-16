import {
  runExfoliationNormativeProductionPolicyShadowDualRun,
  EXFOLIATION_NORMATIVE_PRODUCTION_POLICY_DUAL_RUN_VERSION
} from "./exfoliation-non-numeric-pda-normative-production-policy-dual-run.js";

export const EXFOLIATION_NORMATIVE_PRODUCTION_POLICY_OBSERVATION_VERSION =
  "exfoliation-non-numeric-pda-normative-production-policy-observation-v1";

export function runExfoliationNormativeProductionPolicyShadowObservation(input = {}) {
  const result = runExfoliationNormativeProductionPolicyShadowDualRun(input);
  return {
    ...result,
    observation_entrypoint_version:
      EXFOLIATION_NORMATIVE_PRODUCTION_POLICY_OBSERVATION_VERSION,
    dual_run_version: EXFOLIATION_NORMATIVE_PRODUCTION_POLICY_DUAL_RUN_VERSION,
    runtime_shadow_wired: true,
    wiring_boundary: "ADDITIVE_SHADOW_OBSERVATION_ENTRYPOINT",
    production_authority: false,
    production_activation: false
  };
}
