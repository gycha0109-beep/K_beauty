export const CANDIDATE_EXPOSURE_POLICY_ISOLATED_CANARY_DESIGN_VERSION =
  "candidate-exposure-policy-isolated-preview-canary-harness-design-v1";

export const CANDIDATE_EXPOSURE_POLICY_ISOLATED_CANARY_DESIGN_STATUSES = Object.freeze([
  "design_ready_for_implementation_review",
  "blocked_design_gap",
  "blocked_boundary_violation"
]);

export const CANDIDATE_EXPOSURE_POLICY_ISOLATED_CANARY_CONTROL_STATES = Object.freeze([
  "disabled",
  "eligible",
  "running",
  "stopped",
  "completed",
  "invalid_configuration"
]);

export const CANDIDATE_EXPOSURE_POLICY_ISOLATED_CANARY_SCENARIOS = Object.freeze([
  "standard_goal_alignment",
  "stabilization_active_block",
  "current_product_semantics",
  "metadata_incomplete"
]);

export const CANDIDATE_EXPOSURE_POLICY_ISOLATED_CANARY_LOCALES = Object.freeze([
  "ko",
  "en"
]);

export const CANDIDATE_EXPOSURE_POLICY_ISOLATED_CANARY_MODES = Object.freeze([
  "control",
  "canary"
]);

export const CANDIDATE_EXPOSURE_POLICY_ISOLATED_CANARY_STOP_CONDITIONS = Object.freeze([
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

export const CANDIDATE_EXPOSURE_POLICY_ISOLATED_CANARY_EVIDENCE_STATUSES = Object.freeze([
  "completed_pass",
  "stopped_on_contract_violation",
  "blocked_before_execution",
  "cleanup_failed",
  "evidence_invalid"
]);

const FORBIDDEN_AUTHORIZATIONS = Object.freeze([
  "harnessImplementationAuthorized",
  "runtimeActivationAuthorized",
  "runtimeFilterConnectionAuthorized",
  "recommendationMutationAuthorized",
  "responseMutationAuthorized",
  "storageMutationAuthorized",
  "uiMutationAuthorized",
  "publicTrafficAuthorized",
  "projectEnvironmentMutationAuthorized",
  "productionActivationAuthorized"
]);

function exactSet(value, expected) {
  return Array.isArray(value) &&
    value.length === expected.length &&
    new Set(value).size === value.length &&
    expected.every((entry) => value.includes(entry));
}

function exactKeySet(value, expected) {
  return Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    exactSet(Object.keys(value), expected);
}

function add(blockers, condition, code) {
  if (!condition) blockers.push(code);
}

function matrixIsExact(matrix) {
  if (!Array.isArray(matrix) || matrix.length !== 16) return false;
  const expected = [];
  let sequence = 1;
  for (const locale of CANDIDATE_EXPOSURE_POLICY_ISOLATED_CANARY_LOCALES) {
    for (const scenario of CANDIDATE_EXPOSURE_POLICY_ISOLATED_CANARY_SCENARIOS) {
      for (const mode of CANDIDATE_EXPOSURE_POLICY_ISOLATED_CANARY_MODES) {
        expected.push(`${sequence}:${locale}:${scenario}:${mode}`);
        sequence += 1;
      }
    }
  }
  const actual = matrix.map((entry) =>
    `${entry?.sequence}:${entry?.locale}:${entry?.scenario}:${entry?.mode}`
  );
  return expected.every((entry, index) => entry === actual[index]);
}

function fixtureContractsAreComplete(fixtures) {
  if (!Array.isArray(fixtures) || fixtures.length !== 4) return false;
  if (!exactSet(fixtures.map((fixture) => fixture?.scenario), CANDIDATE_EXPOSURE_POLICY_ISOLATED_CANARY_SCENARIOS)) {
    return false;
  }
  return fixtures.every((fixture) =>
    typeof fixture.purpose === "string" && fixture.purpose.length > 0 &&
    Array.isArray(fixture.canonicalConditions) && fixture.canonicalConditions.length > 0 &&
    Array.isArray(fixture.allowedInputFields) && fixture.allowedInputFields.length > 0 &&
    Array.isArray(fixture.forbiddenInputs) && fixture.forbiddenInputs.length > 0 &&
    typeof fixture.currentProductsState === "string" && fixture.currentProductsState.length > 0 &&
    Array.isArray(fixture.expectedReasonCategories) && fixture.expectedReasonCategories.length > 0 &&
    Array.isArray(fixture.forbiddenErrors) && fixture.forbiddenErrors.length > 0 &&
    Array.isArray(fixture.localeInvariantProperties) && fixture.localeInvariantProperties.length > 0 &&
    Array.isArray(fixture.localeVariableProperties) && fixture.localeVariableProperties.length > 0 &&
    fixture.actualUserDataAllowed === false
  );
}

function stopConditionsAreComplete(stopConditions) {
  if (!exactKeySet(stopConditions, CANDIDATE_EXPOSURE_POLICY_ISOLATED_CANARY_STOP_CONDITIONS)) {
    return false;
  }
  return CANDIDATE_EXPOSURE_POLICY_ISOLATED_CANARY_STOP_CONDITIONS.every((key) => {
    const value = stopConditions[key];
    return value &&
      typeof value === "object" &&
      typeof value.detectionLocation === "string" && value.detectionLocation.length > 0 &&
      typeof value.detectionTiming === "string" && value.detectionTiming.length > 0 &&
      value.stopRemainingRequests === true &&
      value.automaticRetryAllowed === false &&
      value.cleanupRequired === true &&
      Array.isArray(value.aggregateEvidenceFields) && value.aggregateEvidenceFields.length > 0 &&
      CANDIDATE_EXPOSURE_POLICY_ISOLATED_CANARY_EVIDENCE_STATUSES.includes(value.finalStatus);
  });
}

function telemetryContractIsStrict(telemetry) {
  const allowed = telemetry?.allowedFields;
  const forbidden = telemetry?.forbiddenFields;
  return Array.isArray(allowed) && allowed.length > 0 && new Set(allowed).size === allowed.length &&
    Array.isArray(forbidden) && forbidden.length > 0 && new Set(forbidden).size === forbidden.length &&
    allowed.every((field) => !forbidden.includes(field)) &&
    telemetry.unknownFieldsRejected === true &&
    telemetry.missingRequiredFieldsRejected === true &&
    telemetry.invalidCountTotalsRejected === true &&
    telemetry.negativeCountsRejected === true &&
    telemetry.contradictoryExecutionStateRejected === true &&
    telemetry.candidateLevelRecordsAllowed === false &&
    telemetry.rawRequestAllowed === false &&
    telemetry.rawResponseAllowed === false;
}

function fingerprintContractIsComplete(fingerprints) {
  return fingerprints?.sameRequestMutationChecks === true &&
    fingerprints?.independentProviderResponseEqualityRequired === false &&
    fingerprints?.controlCanaryComparisonUsesAggregateProjection === true &&
    Array.isArray(fingerprints?.types) && exactSet(fingerprints.types, [
      "response_pre_post",
      "snapshot_pre_post",
      "candidate_order_pre_post",
      "isolated_projection",
      "runtime_implementation_sha",
      "fixture_semantic"
    ]) &&
    Array.isArray(fingerprints?.excludedNondeterministicFields) &&
    fingerprints.excludedNondeterministicFields.length > 0 &&
    Array.isArray(fingerprints?.neverExcludedMutationSensitiveFields) &&
    fingerprints.neverExcludedMutationSensitiveFields.length > 0 &&
    fingerprints.normalizationNegativeControlsRequired === true;
}

function projectionContractIsIsolated(projection) {
  return projection?.input === "immutable_candidates_and_policy_decisions" &&
    projection?.output === "memory_only_aggregate_and_fingerprint" &&
    projection?.sourceCandidatesCloned === true &&
    projection?.sourceCandidateMutationAllowed === false &&
    projection?.sourceCandidateReorderAllowed === false &&
    projection?.recommendationPoolReplacementAllowed === false &&
    projection?.responseConsumptionAllowed === false &&
    projection?.storageConsumptionAllowed === false &&
    projection?.uiConsumptionAllowed === false &&
    projection?.candidateReferencesMemoryOnly === true &&
    projection?.candidateReferencesTelemetryAllowed === false &&
    projection?.orderedExposureVectorMemoryOnly === true &&
    projection?.orderedExposureVectorEvidenceAllowed === false &&
    projection?.aggregateCountsAllowed === true &&
    projection?.aggregateFingerprintAllowed === true;
}

function evidenceContractIsComplete(evidence) {
  const required = [
    "schemaVersion",
    "planVersion",
    "implementationSha",
    "controlDeploymentId",
    "canaryDeploymentId",
    "startedAt",
    "completedAt",
    "plannedRequestCount",
    "completedRequestCount",
    "http200Count",
    "runtimeShaMatchCount",
    "defaultOffExecutionCount",
    "canaryExecutionCount",
    "scenarioResults",
    "aggregateDivergenceCounts",
    "aggregateMutationChecks",
    "cleanup",
    "stopCondition",
    "status",
    "authorization"
  ];
  return exactSet(evidence?.requiredFields, required) &&
    exactSet(evidence?.statuses, CANDIDATE_EXPOSURE_POLICY_ISOLATED_CANARY_EVIDENCE_STATUSES) &&
    evidence?.deploymentUrlStored === false &&
    evidence?.bypassSecretStored === false &&
    evidence?.candidateIdentifiersStored === false &&
    evidence?.productIdentifiersStored === false &&
    evidence?.userIdentifiersStored === false &&
    evidence?.rawRequestStored === false &&
    evidence?.rawResponseStored === false &&
    evidence?.cleanupFailureCanPass === false;
}

export function reviewCandidateExposurePolicyIsolatedCanaryHarnessDesign({
  stage11d = {},
  design = {}
} = {}) {
  const designGaps = [];
  const boundaryViolations = [];

  add(designGaps, stage11d.status === "plan_ready", "stage11d_plan_not_ready");
  add(designGaps, Array.isArray(stage11d.blockers) && stage11d.blockers.length === 0, "stage11d_blockers_present");
  add(designGaps, typeof stage11d.implementationSha === "string" && stage11d.implementationSha.length >= 7, "stage11d_sha_missing");
  add(designGaps, design.implementationSha === stage11d.implementationSha, "design_sha_stale");
  add(designGaps, design.version === CANDIDATE_EXPOSURE_POLICY_ISOLATED_CANARY_DESIGN_VERSION, "invalid_design_version");
  add(designGaps, design.status === "design_ready_for_implementation_review", "invalid_design_status");
  add(designGaps, exactSet(design.controlStates, CANDIDATE_EXPOSURE_POLICY_ISOLATED_CANARY_CONTROL_STATES), "invalid_control_states");
  add(designGaps, design.maxAnalyzeRequests === 16, "invalid_request_budget");
  add(designGaps, Number.isInteger(design.maxDurationMinutes) && design.maxDurationMinutes > 0 && design.maxDurationMinutes <= 60, "invalid_duration_budget");
  add(designGaps, exactSet(design.locales, CANDIDATE_EXPOSURE_POLICY_ISOLATED_CANARY_LOCALES), "invalid_locales");
  add(designGaps, exactSet(design.scenarios, CANDIDATE_EXPOSURE_POLICY_ISOLATED_CANARY_SCENARIOS), "invalid_scenarios");
  add(designGaps, exactSet(design.modes, CANDIDATE_EXPOSURE_POLICY_ISOLATED_CANARY_MODES), "invalid_modes");
  add(designGaps, matrixIsExact(design.requestMatrix), "invalid_request_matrix");
  add(designGaps, fixtureContractsAreComplete(design.fixtures), "incomplete_fixture_contracts");
  add(designGaps, stopConditionsAreComplete(design.stopConditions), "incomplete_stop_conditions");
  add(designGaps, telemetryContractIsStrict(design.telemetry), "invalid_telemetry_contract");
  add(designGaps, fingerprintContractIsComplete(design.fingerprints), "invalid_fingerprint_contract");
  add(designGaps, projectionContractIsIsolated(design.projection), "invalid_projection_contract");
  add(designGaps, evidenceContractIsComplete(design.evidence), "invalid_evidence_contract");
  add(designGaps, design.cleanup?.finallyRequired === true, "cleanup_finally_not_required");
  add(designGaps, design.cleanup?.bypassResidueRequired === 0, "cleanup_bypass_residue_not_zero");
  add(designGaps, design.cleanup?.temporaryFileResidueRequired === 0, "cleanup_file_residue_not_zero");
  add(designGaps, design.cleanup?.projectEnvironmentMutationRequired === 0, "cleanup_project_environment_not_zero");
  add(designGaps, design.cleanup?.productionChangeRequired === 0, "cleanup_production_change_not_zero");
  add(designGaps, design.cleanup?.cleanupFailureStatus === "cleanup_failed", "cleanup_failure_status_invalid");
  add(designGaps, design.execution?.hostedLane === "exact_sha_response_invariance_and_shadow_aggregate", "invalid_hosted_lane");
  add(designGaps, design.execution?.projectionLane === "same_sha_checkout_deterministic_projection_replay", "invalid_projection_lane");
  add(designGaps, design.execution?.lanesShareFixtureSemanticFingerprint === true, "lane_fixture_correlation_missing");
  add(designGaps, design.execution?.hostedLaneExposesPolicyDecisions === false, "hosted_lane_exposes_decisions");
  add(designGaps, design.execution?.projectionLaneUsesActualUserData === false, "projection_lane_uses_user_data");
  add(designGaps, design.execution?.automaticRetryAllowed === false, "automatic_retry_allowed");
  add(designGaps, design.execution?.warmupRequestsAllowed === false, "warmup_requests_allowed");
  add(designGaps, design.execution?.quotaProbeAllowed === false, "quota_probe_allowed");
  add(designGaps, design.execution?.exploratoryRequestsAllowed === false, "exploratory_requests_allowed");

  for (const key of FORBIDDEN_AUTHORIZATIONS) {
    add(boundaryViolations, design.authorization?.[key] === false, `${key}_must_be_false`);
  }
  add(boundaryViolations, design.authorization?.designOnly === true, "design_only_authorization_missing");
  add(boundaryViolations, design.runtimeImportsAllowed === false, "runtime_imports_allowed");
  add(boundaryViolations, design.hostedDeploymentExecutionAllowed === false, "hosted_execution_allowed");
  add(boundaryViolations, design.hostedAnalyzeExecutionAllowed === false, "hosted_analyze_allowed");
  add(boundaryViolations, design.vercelMutationAllowed === false, "vercel_mutation_allowed");
  add(boundaryViolations, design.productionMutationAllowed === false, "production_mutation_allowed");

  const uniqueDesignGaps = Array.from(new Set(designGaps)).sort();
  const uniqueBoundaryViolations = Array.from(new Set(boundaryViolations)).sort();
  const blockers = [...uniqueBoundaryViolations, ...uniqueDesignGaps];
  const status = uniqueBoundaryViolations.length > 0
    ? "blocked_boundary_violation"
    : uniqueDesignGaps.length > 0
      ? "blocked_design_gap"
      : "design_ready_for_implementation_review";

  return Object.freeze({
    version: CANDIDATE_EXPOSURE_POLICY_ISOLATED_CANARY_DESIGN_VERSION,
    status,
    blockers,
    harnessImplementationAuthorized: false,
    runtimeActivationAuthorized: false,
    publicTrafficAuthorized: false,
    productionActivationAuthorized: false,
    recommendedNextStage: status === "design_ready_for_implementation_review"
      ? "stage_11f_isolated_preview_canary_harness_implementation_review"
      : "stage_11e_design_remediation"
  });
}
