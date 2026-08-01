export const ISOLATED_CANARY_IMPLEMENTATION_EVIDENCE_SCHEMA_VERSION =
  "candidate-exposure-policy-isolated-canary-implementation-readiness-v1";

export const ISOLATED_CANARY_IMPLEMENTATION_EVIDENCE_STATUSES = Object.freeze([
  "implementation_ready_for_hosted_execution_review",
  "blocked_implementation_contract",
  "blocked_runtime_attestation",
  "blocked_boundary_violation",
  "cleanup_failed",
  "evidence_invalid"
]);

export const ISOLATED_CANARY_IMPLEMENTATION_AUTHORIZATION = Object.freeze({
  harnessImplemented: true,
  hostedExecutionImplemented: false,
  hostedExecutionAuthorized: false,
  runtimeActivationAuthorized: false,
  runtimeFilterConnectionAuthorized: false,
  recommendationMutationAuthorized: false,
  responseMutationAuthorized: false,
  storageMutationAuthorized: false,
  uiMutationAuthorized: false,
  publicTrafficAuthorized: false,
  projectEnvironmentMutationAuthorized: false,
  productionActivationAuthorized: false
});

const EVIDENCE_FIELDS = Object.freeze([
  "schemaVersion",
  "designVersion",
  "planVersion",
  "stage11eDesignBaseSha",
  "runtimeImplementationSha",
  "harnessImplementationSha",
  "mode",
  "plannedEntryCount",
  "completedEntryCount",
  "controlEntryCount",
  "canaryEntryCount",
  "fixtureScenarioCount",
  "localeCount",
  "runtimeAttestation",
  "implementationScope",
  "matrix",
  "telemetrySummary",
  "cleanup",
  "status",
  "authorization"
]);

const FORBIDDEN_KEYS = new Set([
  "candidateref",
  "candidateid",
  "productid",
  "productname",
  "producturl",
  "brandid",
  "userid",
  "accountid",
  "email",
  "sessionid",
  "reportid",
  "cookie",
  "token",
  "secret",
  "rawrequest",
  "rawresponse",
  "providerprompt",
  "provideroutput",
  "controldeploymentid",
  "canarydeploymentid",
  "deploymenturl",
  "http200count",
  "bypasssecret"
]);

function normalizedKey(value) {
  return String(value || "").normalize("NFKC").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort((left, right) => left.localeCompare(right, "en"))
      .map((key) => [key, stableValue(value[key])])
  );
}

function exactKeySet(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value);
  return actual.length === keys.length &&
    new Set(actual).size === actual.length &&
    keys.every((key) => Object.hasOwn(value, key));
}

function containsForbiddenKey(value) {
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, nested]) =>
    FORBIDDEN_KEYS.has(normalizedKey(key)) || containsForbiddenKey(nested)
  );
}

function nonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function exactAuthorization(value) {
  return exactKeySet(value, Object.keys(ISOLATED_CANARY_IMPLEMENTATION_AUTHORIZATION)) &&
    Object.entries(ISOLATED_CANARY_IMPLEMENTATION_AUTHORIZATION)
      .every(([key, expected]) => value[key] === expected);
}

export function createIsolatedCanaryImplementationEvidence(input = {}) {
  return {
    schemaVersion: ISOLATED_CANARY_IMPLEMENTATION_EVIDENCE_SCHEMA_VERSION,
    designVersion: input.designVersion,
    planVersion: input.planVersion,
    stage11eDesignBaseSha: input.stage11eDesignBaseSha,
    runtimeImplementationSha: input.runtimeImplementationSha,
    harnessImplementationSha: input.harnessImplementationSha,
    mode: input.mode,
    plannedEntryCount: input.plannedEntryCount,
    completedEntryCount: input.completedEntryCount,
    controlEntryCount: input.controlEntryCount,
    canaryEntryCount: input.canaryEntryCount,
    fixtureScenarioCount: input.fixtureScenarioCount,
    localeCount: input.localeCount,
    runtimeAttestation: input.runtimeAttestation,
    implementationScope: input.implementationScope,
    matrix: input.matrix,
    telemetrySummary: input.telemetrySummary,
    cleanup: input.cleanup,
    status: input.status,
    authorization: { ...ISOLATED_CANARY_IMPLEMENTATION_AUTHORIZATION }
  };
}

export function validateIsolatedCanaryImplementationEvidence(evidence) {
  const errors = [];
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    return { valid: false, errors: ["evidence_not_object"] };
  }
  if (!exactKeySet(evidence, EVIDENCE_FIELDS)) errors.push("evidence_field_set_invalid");
  if (containsForbiddenKey(evidence)) errors.push("evidence_forbidden_field");
  if (evidence.schemaVersion !== ISOLATED_CANARY_IMPLEMENTATION_EVIDENCE_SCHEMA_VERSION) {
    errors.push("evidence_schema_version_invalid");
  }
  for (const key of [
    "designVersion",
    "planVersion",
    "stage11eDesignBaseSha",
    "runtimeImplementationSha",
    "harnessImplementationSha",
    "mode"
  ]) {
    if (typeof evidence[key] !== "string" || !evidence[key]) errors.push(`evidence_${key}_invalid`);
  }
  if (evidence.mode !== "validate-only") errors.push("evidence_mode_invalid");
  if (!ISOLATED_CANARY_IMPLEMENTATION_EVIDENCE_STATUSES.includes(evidence.status)) {
    errors.push("evidence_status_invalid");
  }
  for (const key of [
    "plannedEntryCount",
    "completedEntryCount",
    "controlEntryCount",
    "canaryEntryCount",
    "fixtureScenarioCount",
    "localeCount"
  ]) {
    if (!nonNegativeInteger(evidence[key])) errors.push(`evidence_${key}_invalid`);
  }

  if (!exactKeySet(evidence.runtimeAttestation, [
    "match",
    "closureFileCount",
    "changedRuntimeFileCount"
  ])) errors.push("evidence_runtime_attestation_shape_invalid");
  if (typeof evidence.runtimeAttestation?.match !== "boolean") {
    errors.push("evidence_runtime_attestation_match_invalid");
  }
  for (const key of ["closureFileCount", "changedRuntimeFileCount"]) {
    if (!nonNegativeInteger(evidence.runtimeAttestation?.[key])) {
      errors.push(`evidence_runtime_attestation_${key}_invalid`);
    }
  }

  if (!exactKeySet(evidence.implementationScope, [
    "allowed",
    "changedFileCount",
    "disallowedPaths"
  ])) errors.push("evidence_implementation_scope_shape_invalid");
  if (typeof evidence.implementationScope?.allowed !== "boolean") {
    errors.push("evidence_implementation_scope_allowed_invalid");
  }
  if (!nonNegativeInteger(evidence.implementationScope?.changedFileCount)) {
    errors.push("evidence_implementation_scope_count_invalid");
  }
  if (!Array.isArray(evidence.implementationScope?.disallowedPaths) ||
      evidence.implementationScope.disallowedPaths.some((path) => typeof path !== "string")) {
    errors.push("evidence_implementation_scope_paths_invalid");
  }

  if (!exactKeySet(evidence.matrix, [
    "exact",
    "sequenceCount",
    "scenarioCount",
    "localeCount",
    "modeCount"
  ])) errors.push("evidence_matrix_shape_invalid");
  if (typeof evidence.matrix?.exact !== "boolean") errors.push("evidence_matrix_exact_invalid");
  for (const key of ["sequenceCount", "scenarioCount", "localeCount", "modeCount"]) {
    if (!nonNegativeInteger(evidence.matrix?.[key])) errors.push(`evidence_matrix_${key}_invalid`);
  }

  if (!exactKeySet(evidence.telemetrySummary, [
    "recordCount",
    "validRecordCount",
    "unexpectedDivergenceCount",
    "unclassifiedDivergenceCount",
    "shadowExceptionCount",
    "fallbackCount",
    "invalidContextCount",
    "mutationMismatchCount"
  ])) errors.push("evidence_telemetry_summary_shape_invalid");
  for (const key of [
    "recordCount",
    "validRecordCount",
    "unexpectedDivergenceCount",
    "unclassifiedDivergenceCount",
    "shadowExceptionCount",
    "fallbackCount",
    "invalidContextCount",
    "mutationMismatchCount"
  ]) {
    if (!nonNegativeInteger(evidence.telemetrySummary?.[key])) {
      errors.push(`evidence_telemetry_${key}_invalid`);
    }
  }

  if (!exactKeySet(evidence.cleanup, [
    "temporaryFileResidue",
    "networkOperationCount",
    "hostedOperationCount",
    "productionChangeCount"
  ])) errors.push("evidence_cleanup_shape_invalid");
  for (const key of [
    "temporaryFileResidue",
    "networkOperationCount",
    "hostedOperationCount",
    "productionChangeCount"
  ]) {
    if (!nonNegativeInteger(evidence.cleanup?.[key])) errors.push(`evidence_cleanup_${key}_invalid`);
  }
  if (!exactAuthorization(evidence.authorization)) errors.push("evidence_authorization_invalid");

  if (evidence.plannedEntryCount !== 16) errors.push("evidence_planned_entry_count_invalid");
  if (evidence.controlEntryCount !== 8 || evidence.canaryEntryCount !== 8) {
    errors.push("evidence_mode_entry_count_invalid");
  }
  if (evidence.fixtureScenarioCount !== 4 || evidence.localeCount !== 2) {
    errors.push("evidence_fixture_matrix_count_invalid");
  }

  if (evidence.status === "implementation_ready_for_hosted_execution_review") {
    if (evidence.completedEntryCount !== evidence.plannedEntryCount) errors.push("evidence_ready_incomplete");
    if (!evidence.runtimeAttestation?.match || evidence.runtimeAttestation?.changedRuntimeFileCount !== 0) {
      errors.push("evidence_ready_runtime_attestation_failed");
    }
    if (!evidence.implementationScope?.allowed || evidence.implementationScope?.disallowedPaths?.length !== 0) {
      errors.push("evidence_ready_scope_failed");
    }
    if (!evidence.matrix?.exact || evidence.matrix?.sequenceCount !== 16) {
      errors.push("evidence_ready_matrix_failed");
    }
    if (
      evidence.telemetrySummary?.recordCount !== 16 ||
      evidence.telemetrySummary?.validRecordCount !== 16 ||
      evidence.telemetrySummary?.unexpectedDivergenceCount !== 0 ||
      evidence.telemetrySummary?.unclassifiedDivergenceCount !== 0 ||
      evidence.telemetrySummary?.shadowExceptionCount !== 0 ||
      evidence.telemetrySummary?.fallbackCount !== 0 ||
      evidence.telemetrySummary?.invalidContextCount !== 0 ||
      evidence.telemetrySummary?.mutationMismatchCount !== 0
    ) errors.push("evidence_ready_telemetry_failed");
    if (
      evidence.cleanup?.temporaryFileResidue !== 0 ||
      evidence.cleanup?.networkOperationCount !== 0 ||
      evidence.cleanup?.hostedOperationCount !== 0 ||
      evidence.cleanup?.productionChangeCount !== 0
    ) errors.push("evidence_ready_cleanup_failed");
  }
  if (evidence.status === "cleanup_failed" &&
      evidence.cleanup?.temporaryFileResidue === 0 &&
      evidence.cleanup?.networkOperationCount === 0 &&
      evidence.cleanup?.hostedOperationCount === 0 &&
      evidence.cleanup?.productionChangeCount === 0) {
    errors.push("evidence_cleanup_failed_without_residue");
  }

  return { valid: errors.length === 0, errors: Array.from(new Set(errors)).sort() };
}

export function finalizeIsolatedCanaryImplementationEvidence(evidence) {
  const validation = validateIsolatedCanaryImplementationEvidence(evidence);
  if (!validation.valid) {
    return {
      ...evidence,
      status: "evidence_invalid",
      validationErrors: validation.errors
    };
  }
  return evidence;
}

export function serializeIsolatedCanaryImplementationEvidence(evidence) {
  const validation = validateIsolatedCanaryImplementationEvidence(evidence);
  if (!validation.valid) {
    throw new Error(`isolated_canary_evidence_invalid:${validation.errors.join(",")}`);
  }
  return JSON.stringify(stableValue(evidence), null, 2) + "\n";
}
