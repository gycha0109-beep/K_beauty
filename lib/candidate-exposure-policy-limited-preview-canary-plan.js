export const CANDIDATE_EXPOSURE_POLICY_LIMITED_PREVIEW_CANARY_PLAN_VERSION =
  "candidate-exposure-policy-limited-preview-canary-plan-v1";

export const CANDIDATE_EXPOSURE_POLICY_LIMITED_PREVIEW_CANARY_PLAN_STATUSES = Object.freeze([
  "plan_ready",
  "blocked_evidence_stale",
  "blocked_contract_violation"
]);

export const CANDIDATE_EXPOSURE_POLICY_LIMITED_PREVIEW_CANARY_SCENARIOS = Object.freeze([
  "standard_goal_alignment",
  "stabilization_active_block",
  "current_product_semantics",
  "metadata_incomplete"
]);

export const CANDIDATE_EXPOSURE_POLICY_LIMITED_PREVIEW_CANARY_STOP_CONDITIONS = Object.freeze([
  "runtimeShaMismatch",
  "defaultOffShadowExecution",
  "unexpectedDivergence",
  "unclassifiedDivergence",
  "shadowException",
  "fallback",
  "invalidContext",
  "responseFingerprintMismatch",
  "snapshotFingerprintMismatch",
  "candidateOrderMismatch",
  "candidateLevelTelemetryDetected",
  "productionOrProjectConfigurationChange"
]);

function exactTrue(value) {
  return value === true;
}

function exactFalse(value) {
  return value === false;
}

function exactStringSet(value, expected) {
  return Array.isArray(value) &&
    value.length === expected.length &&
    expected.every((entry) => value.includes(entry)) &&
    new Set(value).size === value.length;
}

function addBlocker(blockers, condition, code) {
  if (!condition) blockers.push(code);
}

export function reviewCandidateExposurePolicyLimitedPreviewCanaryPlan({
  eligibility = {},
  plan = {}
} = {}) {
  const evidenceBlockers = [];
  const contractBlockers = [];

  addBlocker(
    evidenceBlockers,
    eligibility.status === "eligible_for_limited_preview_canary_plan",
    "eligibility_status_not_ready"
  );
  addBlocker(
    evidenceBlockers,
    Array.isArray(eligibility.blockers) && eligibility.blockers.length === 0,
    "eligibility_blockers_present"
  );
  addBlocker(
    evidenceBlockers,
    exactFalse(eligibility.runtimeActivationAuthorized),
    "eligibility_runtime_activation_authorized"
  );
  addBlocker(
    evidenceBlockers,
    exactFalse(eligibility.productionActivationAuthorized),
    "eligibility_production_activation_authorized"
  );
  addBlocker(
    evidenceBlockers,
    typeof eligibility.implementationSha === "string" &&
      eligibility.implementationSha.length >= 7,
    "eligibility_implementation_sha_missing"
  );
  addBlocker(
    evidenceBlockers,
    plan.implementationSha === eligibility.implementationSha,
    "plan_implementation_sha_stale"
  );

  addBlocker(
    contractBlockers,
    plan.version === CANDIDATE_EXPOSURE_POLICY_LIMITED_PREVIEW_CANARY_PLAN_VERSION,
    "invalid_plan_version"
  );
  addBlocker(contractBlockers, plan.environment === "preview", "environment_not_preview");
  addBlocker(
    contractBlockers,
    plan.deploymentScope === "two_deployment_exact_sha_pair",
    "invalid_deployment_scope"
  );
  addBlocker(
    contractBlockers,
    plan.trafficSource === "authorized_diagnostic_fixture_only",
    "invalid_traffic_source"
  );
  addBlocker(
    contractBlockers,
    plan.runtimeConnectionMode === "isolated_candidate_projection_only",
    "invalid_runtime_connection_mode"
  );
  addBlocker(
    contractBlockers,
    Number.isInteger(plan.maxAnalyzeRequests) &&
      plan.maxAnalyzeRequests === 16,
    "invalid_analyze_request_budget"
  );
  addBlocker(
    contractBlockers,
    Number.isInteger(plan.maxDurationMinutes) &&
      plan.maxDurationMinutes > 0 &&
      plan.maxDurationMinutes <= 60,
    "invalid_duration_budget"
  );
  addBlocker(
    contractBlockers,
    exactStringSet(plan.locales, ["ko", "en"]),
    "invalid_locale_set"
  );
  addBlocker(
    contractBlockers,
    exactStringSet(
      plan.scenarios,
      CANDIDATE_EXPOSURE_POLICY_LIMITED_PREVIEW_CANARY_SCENARIOS
    ),
    "invalid_scenario_set"
  );
  addBlocker(
    contractBlockers,
    plan.pairedRequestsPerScenario === 2,
    "invalid_pairing_contract"
  );
  addBlocker(
    contractBlockers,
    plan.maxAnalyzeRequests ===
      plan.locales?.length * plan.scenarios?.length * plan.pairedRequestsPerScenario,
    "request_budget_does_not_match_matrix"
  );
  addBlocker(
    contractBlockers,
    exactStringSet(
      Object.keys(plan.stopConditions || {}).filter((key) => plan.stopConditions[key] === true),
      CANDIDATE_EXPOSURE_POLICY_LIMITED_PREVIEW_CANARY_STOP_CONDITIONS
    ),
    "invalid_stop_conditions"
  );

  for (const [key, expected] of Object.entries({
    defaultOffControlRequired: true,
    deploymentScopedOptInRequired: true,
    killSwitchRequired: true,
    syntheticOrAuthorizedFixtureOnly: true,
    aggregateTelemetryOnly: true,
    isolatedCandidateProjectionOnly: true,
    publicTrafficAllowed: false,
    candidateLevelTelemetryAllowed: false,
    runtimeFilterConnectionAllowed: false,
    recommendationMutationAllowed: false,
    responseMutationAllowed: false,
    storageMutationAllowed: false,
    uiMutationAllowed: false,
    projectEnvironmentMutationAllowed: false,
    productionAllowed: false
  })) {
    const valid = expected ? exactTrue(plan[key]) : exactFalse(plan[key]);
    addBlocker(contractBlockers, valid, `invalid_${key}`);
  }

  const uniqueEvidenceBlockers = Array.from(new Set(evidenceBlockers)).sort();
  const uniqueContractBlockers = Array.from(new Set(contractBlockers)).sort();
  const blockers = [...uniqueEvidenceBlockers, ...uniqueContractBlockers];
  const status = uniqueEvidenceBlockers.length > 0
    ? "blocked_evidence_stale"
    : uniqueContractBlockers.length > 0
      ? "blocked_contract_violation"
      : "plan_ready";

  return Object.freeze({
    version: CANDIDATE_EXPOSURE_POLICY_LIMITED_PREVIEW_CANARY_PLAN_VERSION,
    status,
    blockers,
    runtimeActivationAuthorized: false,
    productionActivationAuthorized: false,
    publicTrafficAuthorized: false,
    recommendedNextStage: status === "plan_ready"
      ? "stage_11e_isolated_preview_canary_harness"
      : "stage_11d_plan_remediation"
  });
}
