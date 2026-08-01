export const CANDIDATE_EXPOSURE_POLICY_SHADOW_ELIGIBILITY_VERSION =
  "candidate-exposure-policy-shadow-eligibility-v1";

export const CANDIDATE_EXPOSURE_POLICY_SHADOW_ELIGIBILITY_STATUSES = Object.freeze([
  "eligible_for_limited_preview_canary_plan",
  "blocked_pending_exact_sha_hosted_revalidation",
  "blocked_remediation_required"
]);

function exactTrue(value) {
  return value === true;
}

function nonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function atLeast(value, minimum) {
  return Number.isInteger(value) && value >= minimum;
}

function addBlocker(blockers, condition, code) {
  if (!condition) blockers.push(code);
}

export function reviewCandidateExposurePolicyShadowEligibility({
  implementation = {},
  local = {},
  catalog = {},
  hosted = {}
} = {}) {
  const blockers = [];

  addBlocker(blockers, exactTrue(implementation.productionHardDisabled), "production_hard_disable_unproven");
  addBlocker(
    blockers,
    exactTrue(implementation.selfHostedProductionHardDisabled),
    "self_hosted_production_hard_disable_unproven"
  );
  addBlocker(blockers, exactTrue(implementation.killSwitchPrecedence), "kill_switch_precedence_unproven");
  addBlocker(
    blockers,
    exactTrue(implementation.malformedEnvironmentDisabled),
    "malformed_environment_disable_unproven"
  );
  addBlocker(blockers, exactTrue(implementation.telemetryContractStrict), "telemetry_contract_not_strict");
  addBlocker(blockers, exactTrue(implementation.divergenceClassifierStrict), "divergence_classifier_not_strict");
  addBlocker(blockers, implementation.runtimeFilterConnected === false, "runtime_filter_connected");
  addBlocker(blockers, implementation.responseMutationConnected === false, "response_mutation_connected");
  addBlocker(blockers, implementation.storageMutationConnected === false, "storage_mutation_connected");
  addBlocker(blockers, implementation.productionConfigurationChanged === false, "production_configuration_changed");

  addBlocker(blockers, exactTrue(local.shadowVerifierPass), "shadow_verifier_failed");
  addBlocker(blockers, atLeast(local.assertions, 193), "shadow_assertion_floor_not_met");
  addBlocker(blockers, atLeast(local.currentProductFixtures, 12), "current_product_fixture_floor_not_met");
  addBlocker(blockers, atLeast(local.safetyFixtures, 13), "safety_fixture_floor_not_met");
  addBlocker(blockers, exactTrue(local.securityCloseoutPass), "security_closeout_failed");
  addBlocker(blockers, exactTrue(local.architectureGuardPass), "architecture_guard_failed");
  addBlocker(blockers, exactTrue(local.productionBuildPass), "production_build_failed");

  addBlocker(blockers, atLeast(catalog.loadedRows, 164), "catalog_row_floor_not_met");
  addBlocker(blockers, catalog.scorerCompatibleRows === catalog.loadedRows, "catalog_scorer_coverage_incomplete");
  addBlocker(blockers, atLeast(catalog.scenarios, 4), "catalog_scenario_floor_not_met");
  addBlocker(blockers, atLeast(catalog.candidateRows, 656), "catalog_candidate_floor_not_met");
  addBlocker(blockers, catalog.highRiskCollapsedCount === 0, "catalog_high_risk_collapsed_nonzero");

  const hostedShaPresent = typeof hosted.implementationSha === "string" && hosted.implementationSha.length >= 7;
  const currentShaPresent = typeof hosted.currentImplementationSha === "string" &&
    hosted.currentImplementationSha.length >= 7;
  const exactShaMatch = hostedShaPresent && currentShaPresent &&
    hosted.implementationSha === hosted.currentImplementationSha;

  addBlocker(blockers, exactTrue(hosted.workflowPass), "hosted_workflow_failed");
  addBlocker(blockers, exactShaMatch, "hosted_exact_sha_revalidation_required");
  addBlocker(blockers, hosted.analyzeCallCount === 4, "hosted_analyze_call_count_invalid");
  addBlocker(blockers, hosted.http200Count === 4, "hosted_http_200_count_invalid");
  addBlocker(blockers, hosted.runtimeCommitMatchCount === 4, "hosted_runtime_commit_count_invalid");
  addBlocker(blockers, hosted.premiumFinalStageCount === 4, "hosted_premium_final_stage_count_invalid");
  addBlocker(blockers, hosted.defaultOffShadowExecutionCount === 0, "default_off_shadow_executed");
  addBlocker(blockers, hosted.responseFingerprintMatchCount === 2, "hosted_response_fingerprint_mismatch");
  addBlocker(blockers, hosted.snapshotFingerprintMatchCount === 2, "hosted_snapshot_fingerprint_mismatch");
  addBlocker(blockers, hosted.candidateOrderMatchCount === 2, "hosted_candidate_order_mismatch");
  addBlocker(blockers, hosted.unexpectedDivergenceCount === 0, "hosted_unexpected_divergence_nonzero");
  addBlocker(blockers, hosted.unclassifiedDivergenceCount === 0, "hosted_unclassified_divergence_nonzero");
  addBlocker(blockers, hosted.shadowExceptionCount === 0, "hosted_shadow_exception_nonzero");
  addBlocker(blockers, hosted.fallbackCount === 0, "hosted_fallback_nonzero");
  addBlocker(blockers, hosted.invalidContextCount === 0, "hosted_invalid_context_nonzero");

  for (const key of [
    "analyzeCallCount",
    "http200Count",
    "runtimeCommitMatchCount",
    "premiumFinalStageCount",
    "defaultOffShadowExecutionCount",
    "responseFingerprintMatchCount",
    "snapshotFingerprintMatchCount",
    "candidateOrderMatchCount",
    "unexpectedDivergenceCount",
    "unclassifiedDivergenceCount",
    "shadowExceptionCount",
    "fallbackCount",
    "invalidContextCount"
  ]) {
    addBlocker(blockers, nonNegativeInteger(hosted[key]), `hosted_${key}_not_non_negative_integer`);
  }

  const uniqueBlockers = Array.from(new Set(blockers)).sort((left, right) =>
    left.localeCompare(right, "en")
  );
  const onlyExactShaBlocker = uniqueBlockers.length === 1 &&
    uniqueBlockers[0] === "hosted_exact_sha_revalidation_required";
  const status = uniqueBlockers.length === 0
    ? "eligible_for_limited_preview_canary_plan"
    : onlyExactShaBlocker
      ? "blocked_pending_exact_sha_hosted_revalidation"
      : "blocked_remediation_required";

  return Object.freeze({
    version: CANDIDATE_EXPOSURE_POLICY_SHADOW_ELIGIBILITY_VERSION,
    status,
    blockers: uniqueBlockers,
    runtimeActivationAuthorized: false,
    productionActivationAuthorized: false,
    recommendedNextStage: status === "eligible_for_limited_preview_canary_plan"
      ? "stage_11d_limited_preview_canary_plan"
      : status === "blocked_pending_exact_sha_hosted_revalidation"
        ? "stage_11c_exact_sha_hosted_revalidation"
        : "stage_11c_remediation"
  });
}
