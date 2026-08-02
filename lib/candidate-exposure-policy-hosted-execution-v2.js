import {
  PRODUCT_RUNTIME_SHA,
  STOP_CONDITIONS,
  SHA40,
  deepFreeze,
  exactKeys,
  hasForbiddenKey,
  nonNegative,
  stopMap,
  unique,
  validIso,
  validateFixtureManifest,
  validateRuntimeAttestation,
  validateStopConditions
} from "./candidate-exposure-policy-hosted-execution-contract.js";
import { validateExecutionGrant } from "./candidate-exposure-policy-hosted-execution-grant.js";
import {
  NORMALIZED_DEPLOYMENT_SCHEMA,
  READ_ONLY_ADAPTER_SCHEMA
} from "./candidate-exposure-policy-read-only-hosted-adapter.js";
import { buildMatrix, validateTelemetry } from "./candidate-exposure-policy-hosted-execution.js";
import { HOSTED_DIAGNOSTIC_PLAN_VERSION } from "./candidate-exposure-policy-hosted-diagnostic-contract.js";

export const HOSTED_EVIDENCE_SCHEMA_V2 =
  "candidate-exposure-policy-hosted-diagnostic-execution-evidence-v2";

const ROUTE_KEYS = [
  "schemaVersion", "supportsSyntheticFixtureInjection",
  "emitsHostedDiagnosticEnvelope", "readyForHostedExecution", "blocker"
];
const ADAPTER_KEYS = [
  "contract", "routeReadiness", "getDeploymentMetadata",
  "probeCandidatePolicyDiagnostic", "cleanup", "implementationDigest"
];
const CONTRACT_KEYS = [
  "schemaVersion", "deploymentMutationAllowed", "environmentReadAllowed",
  "environmentMutationAllowed", "runtimeLogReadAllowed", "bypassMutationAllowed",
  "productionAllowed", "automaticRetryAllowed", "maxDeploymentMetadataReads",
  "maxDiagnosticRequests", "perRequestTimeoutMs", "maxResponseBytes"
];
const PROBE_KEYS = [
  "httpStatus", "sourceSha", "finalDiagnosticStage", "shadowExecution",
  "runtimeImplementationShaMatch", "telemetry", "responseFingerprintMatch",
  "snapshotFingerprintMatch", "candidateOrderMatch", "unexpectedDivergenceCount",
  "unclassifiedDivergenceCount", "shadowExceptionCount", "fallbackCount",
  "invalidContextCount", "candidateLevelTelemetryDetected",
  "productionOrProjectConfigurationChange"
];

function routeReady(value) {
  return exactKeys(value, ROUTE_KEYS) && value.readyForHostedExecution === true &&
    value.supportsSyntheticFixtureInjection === true &&
    value.emitsHostedDiagnosticEnvelope === true && value.blocker === null;
}

function safeAdapter(value) {
  const contract = value?.contract;
  return exactKeys(value, ADAPTER_KEYS) && exactKeys(contract, CONTRACT_KEYS) &&
    contract.schemaVersion === READ_ONLY_ADAPTER_SCHEMA &&
    contract.deploymentMutationAllowed === false && contract.environmentReadAllowed === false &&
    contract.environmentMutationAllowed === false && contract.runtimeLogReadAllowed === false &&
    contract.bypassMutationAllowed === false && contract.productionAllowed === false &&
    contract.automaticRetryAllowed === false && contract.maxDeploymentMetadataReads === 2 &&
    contract.maxDiagnosticRequests === 16 && contract.perRequestTimeoutMs === 90_000 &&
    contract.maxResponseBytes === 65_536 &&
    typeof value.getDeploymentMetadata === "function" &&
    typeof value.probeCandidatePolicyDiagnostic === "function" &&
    typeof value.cleanup === "function";
}

function metadataValid(value, id, sha) {
  return value?.schemaVersion === NORMALIZED_DEPLOYMENT_SCHEMA &&
    value.deploymentId === id && value.environmentClass === "preview" &&
    (value.rawTarget === null || value.rawTarget === "preview") &&
    value.projectIdentityMatch === true && value.teamIdentityMatch === true &&
    value.sourceSha === sha && value.sourceShaMatch === true && value.ready === true &&
    typeof value.immutableHost === "string" && value.immutableHost.endsWith(".vercel.app") &&
    value.productionAliasPresent === false && value.deploymentMutationCount === 0 &&
    value.environmentReadCount === 0 && value.environmentMutationCount === 0 &&
    value.runtimeLogReadCount === 0 && value.valid === true &&
    Array.isArray(value.errors) && value.errors.length === 0;
}

function stopFromProbe(entry, probe) {
  if (!probe.runtimeImplementationShaMatch) return "runtimeShaMismatch";
  if (entry.mode === "control" && probe.shadowExecution) return "defaultOffShadowExecution";
  if (entry.mode === "canary" && !probe.shadowExecution) return "unclassifiedDivergence";
  if (probe.unexpectedDivergenceCount) return "unexpectedDivergence";
  if (probe.unclassifiedDivergenceCount) return "unclassifiedDivergence";
  if (probe.shadowExceptionCount) return "shadowException";
  if (probe.fallbackCount) return "fallback";
  if (probe.invalidContextCount) return "invalidContext";
  if (entry.mode === "canary" && !probe.responseFingerprintMatch) return "responseFingerprintMismatch";
  if (entry.mode === "canary" && !probe.snapshotFingerprintMatch) return "snapshotFingerprintMismatch";
  if (entry.mode === "canary" && !probe.candidateOrderMatch) return "candidateOrderMismatch";
  if (probe.candidateLevelTelemetryDetected) return "candidateLevelTelemetryDetected";
  if (probe.productionOrProjectConfigurationChange) return "productionOrProjectConfigurationChange";
  return null;
}

function errorStop(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (message === "execution_grant_expired") return "approvalExpired";
  if (message.includes("budget")) return "requestBudgetExceeded";
  if (message === "request_timeout") return "timeBudgetExceeded";
  return "evidenceSerializationFailure";
}

function cleanupValid(value) {
  const keys = [
    "temporaryBypassCreatedCount", "temporaryBypassRevokedCount",
    "temporaryFileResidue", "projectEnvironmentMutationCount", "productionChangeCount",
    "deploymentMetadataReadCount", "diagnosticRequestCount", "runtimeLogReadCount",
    "environmentReadCount", "deploymentMutationCount", "accessMaterialUseCount",
    "setCookieDiscardCount", "routeContractReady"
  ];
  return exactKeys(value, keys) && keys.filter((key) => key.endsWith("Count"))
    .every((key) => nonNegative(value[key])) &&
    value.temporaryBypassCreatedCount === 0 && value.temporaryBypassRevokedCount === 0 &&
    value.temporaryFileResidue === 0 && value.projectEnvironmentMutationCount === 0 &&
    value.productionChangeCount === 0 && value.runtimeLogReadCount === 0 &&
    value.environmentReadCount === 0 && value.deploymentMutationCount === 0 &&
    value.routeContractReady === true;
}

export function buildExecutionPlan({
  executionGrant,
  runtimeAttestation,
  fixtureManifest,
  routeReadiness,
  now
} = {}) {
  const grant = validateExecutionGrant(executionGrant, { now });
  const fixtures = validateFixtureManifest(fixtureManifest);
  const runtimeValid = validateRuntimeAttestation(runtimeAttestation);
  const blockers = unique([
    ...(grant.valid ? [] : ["execution_grant_invalid"]),
    ...(fixtures.valid ? [] : ["fixture_manifest_invalid"]),
    ...(runtimeValid ? [] : ["runtime_attestation_invalid"]),
    ...(routeReady(routeReadiness) ? [] : ["diagnostic_route_contract_unsupported"]),
    ...(validateStopConditions(stopMap()) ? [] : ["stop_conditions_invalid"])
  ]);
  return deepFreeze({
    schemaVersion: "candidate-exposure-policy-hosted-diagnostic-execution-plan-v2",
    planVersion: HOSTED_DIAGNOSTIC_PLAN_VERSION,
    status: blockers.length
      ? "blocked_before_execution"
      : "plan_ready_for_approved_hosted_diagnostic_execution",
    executionGrantDigest: grant.grantDigest,
    approvedSourceSha: executionGrant?.approvedSourceSha || null,
    productRuntimeAuthoritySha: executionGrant?.productRuntimeAuthoritySha || null,
    controlDeploymentId: executionGrant?.controlDeploymentId || null,
    canaryDeploymentId: executionGrant?.canaryDeploymentId || null,
    diagnosticRequestCount: 16,
    metadataReadCount: 2,
    matrix: buildMatrix(),
    fixtureSemanticFingerprints: fixtures.fingerprints,
    runtimeImplementationShaMatch: runtimeValid,
    stopConditions: stopMap(),
    blockers
  });
}

export async function executeApproved({
  executionGrant,
  runtimeAttestation,
  fixtureManifest,
  adapters,
  now = new Date(),
  wallClockNow = () => new Date(),
  monotonicNow = () => Date.now()
} = {}) {
  if (!safeAdapter(adapters)) throw new Error("safe_read_only_adapter_required");
  const plan = buildExecutionPlan({
    executionGrant,
    runtimeAttestation,
    fixtureManifest,
    routeReadiness: adapters.routeReadiness,
    now
  });
  const empty = (stopCondition, blocker, cleanup = null) => deepFreeze({
    status: "blocked_before_execution",
    completedRequestCount: 0,
    networkRequestCount: 0,
    http200Count: 0,
    finalDiagnosticStageCount: 0,
    stopCondition,
    blocker,
    telemetry: [],
    cleanup
  });
  if (plan.status !== "plan_ready_for_approved_hosted_diagnostic_execution") {
    const blocker = plan.blockers[0] || "unapproved_operation";
    return empty(
      blocker === "diagnostic_route_contract_unsupported"
        ? "unapprovedOperation"
        : blocker === "execution_grant_invalid"
          ? "approvalMissing"
          : "evidenceSerializationFailure",
      blocker
    );
  }

  const cleanupContext = {
    approvalIdHash: executionGrant.approvalIdHash,
    controlDeploymentId: executionGrant.controlDeploymentId,
    canaryDeploymentId: executionGrant.canaryDeploymentId
  };
  let controlMeta;
  let canaryMeta;
  try {
    controlMeta = await adapters.getDeploymentMetadata(executionGrant.controlDeploymentId);
    if (!metadataValid(controlMeta, executionGrant.controlDeploymentId, executionGrant.approvedSourceSha)) {
      return empty(
        "controlDeploymentMismatch",
        "control_deployment_metadata_mismatch",
        await adapters.cleanup(cleanupContext)
      );
    }
    canaryMeta = await adapters.getDeploymentMetadata(executionGrant.canaryDeploymentId);
    if (!metadataValid(canaryMeta, executionGrant.canaryDeploymentId, executionGrant.approvedSourceSha)) {
      return empty(
        "canaryDeploymentMismatch",
        "canary_deployment_metadata_mismatch",
        await adapters.cleanup(cleanupContext)
      );
    }
  } catch (error) {
    let cleanup = null;
    try { cleanup = await adapters.cleanup(cleanupContext); } catch {}
    return empty(
      "evidenceSerializationFailure",
      error instanceof Error ? error.message : String(error),
      cleanup
    );
  }

  const fixtureReview = validateFixtureManifest(fixtureManifest);
  const fixtureByScenario = new Map(
    fixtureManifest.scenarios.map((entry) => [entry.scenario, deepFreeze(structuredClone(entry))])
  );
  const telemetry = [];
  let stopCondition = null;
  let blocker = null;
  let networkRequestCount = 0;
  let http200Count = 0;
  let finalDiagnosticStageCount = 0;
  let cleanup = null;
  const started = monotonicNow();
  const expiresAt = Date.parse(executionGrant.expiresAt);

  try {
    for (const entry of buildMatrix()) {
      if (Date.parse(wallClockNow()) >= expiresAt) {
        stopCondition = "approvalExpired";
        blocker = "execution_grant_expired";
        break;
      }
      if (monotonicNow() - started > 1_800_000) {
        stopCondition = "timeBudgetExceeded";
        blocker = "execution_time_budget_exceeded";
        break;
      }
      const fixture = fixtureByScenario.get(entry.scenario);
      const expectedFingerprint = fixtureReview.fingerprints[entry.scenario];
      networkRequestCount += 1;
      let probe;
      try {
        probe = await adapters.probeCandidatePolicyDiagnostic({
          ...entry,
          deploymentId: entry.mode === "control"
            ? executionGrant.controlDeploymentId
            : executionGrant.canaryDeploymentId,
          fixture,
          expectedFixtureSemanticFingerprint: expectedFingerprint,
          approvedSourceSha: executionGrant.approvedSourceSha,
          approvalIdHash: executionGrant.approvalIdHash,
          executionGrantDigest: plan.executionGrantDigest,
          runtimeImplementationShaMatch: true
        });
      } catch (error) {
        stopCondition = errorStop(error);
        blocker = error instanceof Error ? error.message : String(error);
        break;
      }
      if (probe?.httpStatus === 200) http200Count += 1;
      if (probe?.finalDiagnosticStage === true) finalDiagnosticStageCount += 1;
      const valid = exactKeys(probe, PROBE_KEYS) && probe.httpStatus === 200 &&
        probe.sourceSha === executionGrant.approvedSourceSha &&
        probe.finalDiagnosticStage === true && typeof probe.shadowExecution === "boolean" &&
        probe.telemetry?.fixtureScenario === entry.scenario &&
        probe.telemetry?.locale === entry.locale && probe.telemetry?.mode === entry.mode &&
        probe.telemetry?.fixtureSemanticFingerprint === expectedFingerprint &&
        validateTelemetry(probe.telemetry).valid;
      if (!valid) {
        stopCondition = "evidenceSerializationFailure";
        blocker = "probe_contract_invalid";
        break;
      }
      stopCondition = stopFromProbe(entry, probe);
      if (stopCondition) {
        blocker = `probe_stop:${stopCondition}`;
        break;
      }
      telemetry.push(deepFreeze({ ...probe.telemetry }));
    }
  } finally {
    try { cleanup = await adapters.cleanup(cleanupContext); } catch { cleanup = null; }
  }

  if (!cleanupValid(cleanup)) {
    return deepFreeze({
      status: "cleanup_failed",
      completedRequestCount: telemetry.length,
      networkRequestCount,
      http200Count,
      finalDiagnosticStageCount,
      stopCondition: "protectionCleanupFailure",
      blocker: "local_cleanup_contract_invalid",
      telemetry,
      cleanup
    });
  }
  return deepFreeze({
    status: !stopCondition && telemetry.length === 16
      ? "completed_pass"
      : "stopped_on_contract_violation",
    completedRequestCount: telemetry.length,
    networkRequestCount,
    http200Count,
    finalDiagnosticStageCount,
    stopCondition: stopCondition || "none",
    blocker,
    telemetry,
    cleanup
  });
}

export function buildEvidence({
  executionGrant,
  harnessImplementationSha,
  startedAt,
  completedAt,
  result
} = {}) {
  const grant = validateExecutionGrant(executionGrant, {
    now: new Date(executionGrant?.issuedAt || 0)
  });
  const telemetry = result?.telemetry || [];
  const count = (key) => telemetry.reduce((sum, entry) => sum + entry[key], 0);
  return deepFreeze({
    schemaVersion: HOSTED_EVIDENCE_SCHEMA_V2,
    planVersion: HOSTED_DIAGNOSTIC_PLAN_VERSION,
    approvalIdHash: executionGrant?.approvalIdHash,
    provisioningReceiptDigest: executionGrant?.provisioningReceiptDigest,
    executionGrantDigest: grant.grantDigest,
    approvedSourceSha: executionGrant?.approvedSourceSha,
    productRuntimeAuthoritySha: executionGrant?.productRuntimeAuthoritySha,
    harnessImplementationSha,
    controlDeploymentId: executionGrant?.controlDeploymentId,
    canaryDeploymentId: executionGrant?.canaryDeploymentId,
    startedAt,
    completedAt,
    plannedRequestCount: 16,
    completedRequestCount: result?.completedRequestCount || 0,
    http200Count: result?.http200Count || 0,
    runtimeShaMatchCount: telemetry.filter((entry) => entry.runtimeImplementationShaMatch).length,
    finalDiagnosticStageCount: result?.finalDiagnosticStageCount || 0,
    defaultOffExecutionCount: telemetry.filter((entry) => entry.mode === "control").length,
    canaryExecutionCount: telemetry.filter((entry) => entry.mode === "canary").length,
    validTelemetryCount: telemetry.filter((entry) => validateTelemetry(entry).valid).length,
    mutationFingerprintMatchCount: telemetry.filter((entry) =>
      entry.mode === "canary" && entry.responseFingerprintMatch &&
      entry.snapshotFingerprintMatch && entry.candidateOrderMatch
    ).length,
    unexpectedDivergenceCount: count("unexpectedDivergenceCount"),
    unclassifiedDivergenceCount: count("unclassifiedDivergenceCount"),
    shadowExceptionCount: count("shadowExceptionCount"),
    fallbackCount: count("fallbackCount"),
    invalidContextCount: count("invalidContextCount"),
    candidateLevelTelemetryIncidentCount:
      result?.stopCondition === "candidateLevelTelemetryDetected" ? 1 : 0,
    networkRequestCount: result?.networkRequestCount || 0,
    deploymentMetadataReadCount: result?.cleanup?.deploymentMetadataReadCount || 0,
    diagnosticRequestCount: result?.cleanup?.diagnosticRequestCount || 0,
    temporaryBypassCreatedCount: result?.cleanup?.temporaryBypassCreatedCount || 0,
    temporaryBypassRevokedCount: result?.cleanup?.temporaryBypassRevokedCount || 0,
    runtimeLogReadCount: result?.cleanup?.runtimeLogReadCount || 0,
    environmentReadCount: result?.cleanup?.environmentReadCount || 0,
    deploymentMutationCount: result?.cleanup?.deploymentMutationCount || 0,
    projectEnvironmentMutationCount:
      result?.cleanup?.projectEnvironmentMutationCount || 0,
    productionChangeCount: result?.cleanup?.productionChangeCount || 0,
    accessMaterialUseCount: result?.cleanup?.accessMaterialUseCount || 0,
    setCookieDiscardCount: result?.cleanup?.setCookieDiscardCount || 0,
    stopCondition: result?.stopCondition || "none",
    cleanupStatus: result?.status === "cleanup_failed" ? "failed" : "completed",
    status: result?.status,
    authorization: {
      runtimeActivationAuthorized: false,
      publicTrafficAuthorized: false,
      productionActivationAuthorized: false
    }
  });
}

export function validateEvidence(evidence) {
  const errors = [];
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    return deepFreeze({ valid: false, errors: ["evidence_not_object"] });
  }
  if (evidence.schemaVersion !== HOSTED_EVIDENCE_SCHEMA_V2) errors.push("schema");
  if (evidence.planVersion !== HOSTED_DIAGNOSTIC_PLAN_VERSION) errors.push("plan");
  if (!SHA40.test(String(evidence.approvedSourceSha || "")) ||
      evidence.productRuntimeAuthoritySha !== PRODUCT_RUNTIME_SHA ||
      !SHA40.test(String(evidence.harnessImplementationSha || ""))) errors.push("sha");
  if (!validIso(evidence.startedAt) || !validIso(evidence.completedAt)) errors.push("timestamp");
  for (const key of [
    "plannedRequestCount", "completedRequestCount", "http200Count", "runtimeShaMatchCount",
    "finalDiagnosticStageCount", "defaultOffExecutionCount", "canaryExecutionCount",
    "validTelemetryCount", "mutationFingerprintMatchCount", "unexpectedDivergenceCount",
    "unclassifiedDivergenceCount", "shadowExceptionCount", "fallbackCount",
    "invalidContextCount", "candidateLevelTelemetryIncidentCount", "networkRequestCount",
    "deploymentMetadataReadCount", "diagnosticRequestCount", "temporaryBypassCreatedCount",
    "temporaryBypassRevokedCount", "runtimeLogReadCount", "environmentReadCount",
    "deploymentMutationCount", "projectEnvironmentMutationCount", "productionChangeCount",
    "accessMaterialUseCount", "setCookieDiscardCount"
  ]) {
    if (!nonNegative(evidence[key])) errors.push(key);
  }
  if (hasForbiddenKey(evidence)) errors.push("forbidden_key");
  if (evidence.status === "completed_pass") {
    if (evidence.plannedRequestCount !== 16 || evidence.completedRequestCount !== 16 ||
        evidence.http200Count !== 16 || evidence.runtimeShaMatchCount !== 16 ||
        evidence.finalDiagnosticStageCount !== 16 || evidence.defaultOffExecutionCount !== 8 ||
        evidence.canaryExecutionCount !== 8 ||
        evidence.validTelemetryCount !== 16 || evidence.mutationFingerprintMatchCount !== 8 ||
        evidence.unexpectedDivergenceCount !== 0 || evidence.unclassifiedDivergenceCount !== 0 ||
        evidence.shadowExceptionCount !== 0 || evidence.fallbackCount !== 0 ||
        evidence.invalidContextCount !== 0 || evidence.candidateLevelTelemetryIncidentCount !== 0 ||
        evidence.networkRequestCount !== 16 || evidence.deploymentMetadataReadCount !== 2 ||
        evidence.diagnosticRequestCount !== 16 || evidence.temporaryBypassCreatedCount !== 0 ||
        evidence.temporaryBypassRevokedCount !== 0 || evidence.runtimeLogReadCount !== 0 ||
        evidence.environmentReadCount !== 0 || evidence.deploymentMutationCount !== 0 ||
        evidence.projectEnvironmentMutationCount !== 0 || evidence.productionChangeCount !== 0 ||
        evidence.stopCondition !== "none" || evidence.cleanupStatus !== "completed") {
      errors.push("pass_contract");
    }
  }
  return deepFreeze({ valid: errors.length === 0, errors: unique(errors) });
}
