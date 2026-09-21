import {
  PRODUCT_QUERY_PRODUCTION_ACTIVATION_MAX_SAMPLE_BPS,
  PRODUCT_QUERY_PRODUCTION_ACTIVATION_POLICY_LIMITS,
  PRODUCT_QUERY_PRODUCTION_ACTIVATION_POLICY_VERSION
} from "./product-query-production-activation-policy.mjs";
import {
  PRODUCT_QUERY_POST_PREVIEW_READINESS
} from "./product-query-post-preview-readiness-contract.mjs";

export const PRODUCT_QUERY_PRODUCTION_ACTIVATION_SAFETY_CONTRACT_VERSION =
  "product-query-production-activation-safety-v1";

export const PRODUCT_QUERY_PRODUCTION_ACTIVATION_SAFETY = Object.freeze({
  contractVersion: PRODUCT_QUERY_PRODUCTION_ACTIVATION_SAFETY_CONTRACT_VERSION,
  policyVersion: PRODUCT_QUERY_PRODUCTION_ACTIVATION_POLICY_VERSION,
  phase: "DATA-AI11",
  scope: "production_activation_design_only",
  readinessState: "production_activation_safety_contract_ready",
  prerequisiteReadinessState:
    PRODUCT_QUERY_POST_PREVIEW_READINESS.readinessState,
  activationDecision: "not_authorized",
  effectiveSampleBps: 0,
  maximumFutureCanarySampleBps:
    PRODUCT_QUERY_PRODUCTION_ACTIVATION_MAX_SAMPLE_BPS,
  initialCanarySampleBps: null,
  initialCanarySampleDecision: "deferred_to_data_ai12",
  allowedFutureCohort: "authenticated_bounded",
  failureBehavior: Object.freeze({
    failClosedOnInvalidConfiguration: true,
    failClosedOnProviderUnavailable: true,
    failClosedOnProviderProtocolError: true,
    failClosedOnInternalExecutionError: true,
    fallbackMode: "existing_path"
  }),
  limits: PRODUCT_QUERY_PRODUCTION_ACTIVATION_POLICY_LIMITS,
  nextRequiredPhase: "data_ai12_controlled_production_canary",
  futureActivationRequiresSeparateExplicitPhase: true
});
