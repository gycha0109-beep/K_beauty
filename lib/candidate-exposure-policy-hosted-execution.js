import {
  DIVERGENCES, EVIDENCE_SCHEMA, EXPOSURES, LANES, LOCALES, MODES,
  PRODUCT_RUNTIME_SHA, SCENARIOS, SHA40, STOP_CONDITIONS, TELEMETRY_FIELDS, TELEMETRY_SCHEMA,
  FORBIDDEN_ADAPTER_KEYS, deepFreeze, exactKeys, hasForbiddenKey, nonNegative, sha256,
  stable, stopMap, sum, unique, validCountMap, validIso, validateApproval, validateDeploymentRefs,
  validateFixtureManifest, validateRuntimeAttestation, validateStopConditions
} from "./candidate-exposure-policy-hosted-execution-contract.js";

export function buildMatrix() {
  const result = [];
  let sequence = 1;
  for (const locale of LOCALES) for (const scenario of SCENARIOS) for (const mode of MODES) result.push(deepFreeze({ sequence: sequence++, locale, scenario, mode, executeAfterStop: false }));
  return Object.freeze(result);
}

export function validateTelemetry(record) {
  const errors = [];
  if (!exactKeys(record, TELEMETRY_FIELDS)) errors.push("field_set");
  if (record?.schemaVersion !== TELEMETRY_SCHEMA || hasForbiddenKey(record)) errors.push("schema_or_forbidden");
  if (!SCENARIOS.includes(record?.fixtureScenario) || !LOCALES.includes(record?.locale) || !MODES.includes(record?.mode)) errors.push("matrix");
  if (!/^[0-9a-f]{64}$/.test(String(record?.approvalIdHash || "")) || !/^[0-9a-f]{64}$/.test(String(record?.fixtureSemanticFingerprint || ""))) errors.push("hash");
  if (record?.runtimeImplementationShaMatch !== true || !nonNegative(record?.candidateCount)) errors.push("runtime_or_count");
  if (!validCountMap(record?.exposureCounts, EXPOSURES) || !validCountMap(record?.laneEligibilityCounts, LANES) || !validCountMap(record?.divergenceCategoryCounts, DIVERGENCES)) errors.push("count_map");
  if (sum(record?.exposureCounts) !== record?.candidateCount || sum(record?.divergenceCategoryCounts) !== record?.candidateCount || Object.values(record?.laneEligibilityCounts || {}).some((count) => count > record?.candidateCount)) errors.push("count_total");
  for (const key of ["unexpectedDivergenceCount", "unclassifiedDivergenceCount", "shadowExceptionCount", "fallbackCount", "invalidContextCount"]) if (!nonNegative(record?.[key])) errors.push(key);
  for (const key of ["responseFingerprintMatch", "snapshotFingerprintMatch", "candidateOrderMatch", "projectionFingerprintPresent"]) if (typeof record?.[key] !== "boolean") errors.push(key);
  if (record?.unexpectedDivergenceCount !== (record?.divergenceCategoryCounts?.unexpected_divergence || 0)) errors.push("unexpected_total");
  if (record?.stopCondition !== null && !STOP_CONDITIONS.includes(record.stopCondition)) errors.push("stop_condition");
  if (record?.mode === "control" && record?.projectionFingerprintPresent) errors.push("control_projection");
  if (record?.mode === "canary" && (!record?.responseFingerprintMatch || !record?.snapshotFingerprintMatch || !record?.candidateOrderMatch || !record?.projectionFingerprintPresent)) errors.push("canary_invariance");
  return deepFreeze({ valid: errors.length === 0, errors: unique(errors) });
}

export function buildPlan({ receipt, deploymentRefs = null, runtimeAttestation, fixtureManifest, now } = {}) {
  const approval = validateApproval(receipt, { now });
  const refs = deploymentRefs ? validateDeploymentRefs(deploymentRefs, receipt) : { valid: true, errors: [] };
  const fixtures = validateFixtureManifest(fixtureManifest);
  const blockers = unique([...(approval.valid ? [] : ["approval_invalid"]), ...(refs.valid ? [] : ["deployment_refs_invalid"]), ...(fixtures.valid ? [] : ["fixture_manifest_invalid"]), ...(validateRuntimeAttestation(runtimeAttestation) ? [] : ["runtime_attestation_invalid"]), ...(validateStopConditions(stopMap()) ? [] : ["stop_conditions_invalid"])]);
  return deepFreeze({
    schemaVersion: "candidate-exposure-policy-hosted-plan-v1",
    status: blockers.length ? "blocked_before_execution" : deploymentRefs ? "plan_ready_for_execution_review" : "plan_ready_for_manual_provisioning",
    approvalIdHash: approval.approvalIdHash,
    approvalReceiptDigest: approval.receiptDigest,
    approvedSourceSha: receipt?.approvedSourceSha || null,
    productRuntimeAuthoritySha: receipt?.productRuntimeAuthoritySha || null,
    controlDeploymentId: deploymentRefs?.controlDeploymentId || null,
    canaryDeploymentId: deploymentRefs?.canaryDeploymentId || null,
    requestCount: 16,
    matrix: buildMatrix(),
    fixtureSemanticFingerprints: fixtures.fingerprints,
    stopConditions: stopMap(),
    networkOperationCount: 0,
    deploymentOperationCount: 0,
    productionChangeCount: 0,
    blockers
  });
}

const safeAdapters = (adapters) => {
  if (!adapters || Object.keys(adapters).some((key) => FORBIDDEN_ADAPTER_KEYS.has(key))) return false;
  const contract = adapters.contract;
  return exactKeys(contract, ["schemaVersion", "deploymentMutationAllowed", "productionAllowed", "automaticRetryAllowed", "maxAnalyzeRequests"]) &&
    contract.schemaVersion === "candidate-exposure-policy-hosted-adapter-v1" && contract.deploymentMutationAllowed === false && contract.productionAllowed === false && contract.automaticRetryAllowed === false && contract.maxAnalyzeRequests === 16 &&
    typeof adapters.getDeploymentMetadata === "function" && typeof adapters.probeAnalyze === "function" && typeof adapters.cleanup === "function";
};
const metadataValid = (value, id, sourceSha, shadowOptIn) => exactKeys(value, ["deploymentId", "target", "sourceSha", "ready", "productionAliasPresent", "projectEnvironmentMutationCount", "branchEnvironmentMutationCount", "shadowOptIn"]) && value.deploymentId === id && value.target === "preview" && value.sourceSha === sourceSha && value.ready === true && value.productionAliasPresent === false && value.projectEnvironmentMutationCount === 0 && value.branchEnvironmentMutationCount === 0 && value.shadowOptIn === shadowOptIn;
const stopFromProbe = (entry, probe) => !probe.runtimeImplementationShaMatch ? "runtimeShaMismatch" : entry.mode === "control" && probe.shadowExecution ? "defaultOffShadowExecution" : probe.unexpectedDivergenceCount ? "unexpectedDivergence" : probe.unclassifiedDivergenceCount ? "unclassifiedDivergence" : probe.shadowExceptionCount ? "shadowException" : probe.fallbackCount ? "fallback" : probe.invalidContextCount ? "invalidContext" : entry.mode === "canary" && !probe.responseFingerprintMatch ? "responseFingerprintMismatch" : entry.mode === "canary" && !probe.snapshotFingerprintMatch ? "snapshotFingerprintMismatch" : entry.mode === "canary" && !probe.candidateOrderMatch ? "candidateOrderMismatch" : probe.candidateLevelTelemetryDetected ? "candidateLevelTelemetryDetected" : probe.productionOrProjectConfigurationChange ? "productionOrProjectConfigurationChange" : null;

export async function executeApproved({ receipt, deploymentRefs, runtimeAttestation, fixtureManifest, adapters, now = new Date(), wallClockNow = () => new Date(), monotonicNow = () => Date.now() } = {}) {
  if (!safeAdapters(adapters)) throw new Error("safe_adapter_required");
  const approvalReview = validateApproval(receipt, { now });
  const refsReview = deploymentRefs ? validateDeploymentRefs(deploymentRefs, receipt) : { valid: false };
  const plan = buildPlan({ receipt, deploymentRefs, runtimeAttestation, fixtureManifest, now });
  if (plan.status !== "plan_ready_for_execution_review") {
    const stopCondition = approvalReview.errors.includes("expired")
      ? "approvalExpired"
      : !approvalReview.valid
        ? "approvalMissing"
        : !refsReview.valid
          ? "approvalTargetMismatch"
          : "unapprovedOperation";
    return deepFreeze({ status: "blocked_before_execution", completedRequestCount: 0, networkRequestCount: 0, http200Count: 0, finalDiagnosticStageCount: 0, stopCondition, telemetry: [], cleanup: null });
  }
  const controlMeta = await adapters.getDeploymentMetadata(deploymentRefs.controlDeploymentId);
  if (!metadataValid(controlMeta, deploymentRefs.controlDeploymentId, receipt.approvedSourceSha, false)) return deepFreeze({ status: "blocked_before_execution", completedRequestCount: 0, networkRequestCount: 0, http200Count: 0, finalDiagnosticStageCount: 0, stopCondition: "controlDeploymentMismatch", telemetry: [], cleanup: null });
  const canaryMeta = await adapters.getDeploymentMetadata(deploymentRefs.canaryDeploymentId);
  if (!metadataValid(canaryMeta, deploymentRefs.canaryDeploymentId, receipt.approvedSourceSha, true)) return deepFreeze({ status: "blocked_before_execution", completedRequestCount: 0, networkRequestCount: 0, http200Count: 0, finalDiagnosticStageCount: 0, stopCondition: "canaryDeploymentMismatch", telemetry: [], cleanup: null });
  const fixtureReview = validateFixtureManifest(fixtureManifest);
  const fixtureByScenario = new Map(fixtureManifest.scenarios.map((entry) => [entry.scenario, deepFreeze(structuredClone(entry))]));
  const telemetry = [];
  let stopCondition = null;
  const started = monotonicNow();
  const expiresAt = Date.parse(receipt.expiresAt);
  let networkRequestCount = 0;
  let http200Count = 0;
  let finalDiagnosticStageCount = 0;
  let cleanup = null;
  try {
    for (const entry of buildMatrix()) {
      if (Date.parse(wallClockNow()) >= expiresAt) { stopCondition = "approvalExpired"; break; }
      if (monotonicNow() - started > 1_800_000) { stopCondition = "timeBudgetExceeded"; break; }
      const fixture = fixtureByScenario.get(entry.scenario);
      const expectedFingerprint = fixtureReview.fingerprints[entry.scenario];
      networkRequestCount += 1;
      const probe = await adapters.probeAnalyze({ ...entry, deploymentId: entry.mode === "control" ? deploymentRefs.controlDeploymentId : deploymentRefs.canaryDeploymentId, fixture, expectedFixtureSemanticFingerprint: expectedFingerprint, approvedSourceSha: receipt.approvedSourceSha, approvalIdHash: plan.approvalIdHash });
      if (probe?.httpStatus === 200) http200Count += 1;
      if (probe?.finalDiagnosticStage === true) finalDiagnosticStageCount += 1;
      const validProbe = exactKeys(probe, ["httpStatus", "sourceSha", "finalDiagnosticStage", "shadowExecution", "runtimeImplementationShaMatch", "telemetry", "responseFingerprintMatch", "snapshotFingerprintMatch", "candidateOrderMatch", "unexpectedDivergenceCount", "unclassifiedDivergenceCount", "shadowExceptionCount", "fallbackCount", "invalidContextCount", "candidateLevelTelemetryDetected", "productionOrProjectConfigurationChange"]) && probe.httpStatus === 200 && probe.sourceSha === receipt.approvedSourceSha && probe.finalDiagnosticStage === true && probe.shadowExecution === (entry.mode === "canary") && probe.telemetry?.fixtureScenario === entry.scenario && probe.telemetry?.locale === entry.locale && probe.telemetry?.mode === entry.mode && probe.telemetry?.fixtureSemanticFingerprint === expectedFingerprint && validateTelemetry(probe.telemetry).valid;
      if (!validProbe) { stopCondition = "evidenceSerializationFailure"; break; }
      stopCondition = stopFromProbe(entry, probe);
      if (stopCondition) break;
      telemetry.push(deepFreeze({ ...probe.telemetry }));
    }
  } finally {
    try { cleanup = await adapters.cleanup({ approvalIdHash: plan.approvalIdHash, controlDeploymentId: deploymentRefs.controlDeploymentId, canaryDeploymentId: deploymentRefs.canaryDeploymentId }); }
    catch { cleanup = null; }
  }
  const cleanupValid = exactKeys(cleanup, ["temporaryBypassCreatedCount", "temporaryBypassRevokedCount", "temporaryFileResidue", "projectEnvironmentMutationCount", "productionChangeCount"]) && Object.values(cleanup).every(nonNegative) && cleanup.temporaryBypassCreatedCount === cleanup.temporaryBypassRevokedCount && cleanup.temporaryFileResidue === 0 && cleanup.projectEnvironmentMutationCount === 0 && cleanup.productionChangeCount === 0;
  const counters = { networkRequestCount, http200Count, finalDiagnosticStageCount };
  if (!cleanupValid) return deepFreeze({ status: "cleanup_failed", completedRequestCount: telemetry.length, ...counters, stopCondition: "protectionCleanupFailure", telemetry, cleanup });
  return deepFreeze({ status: !stopCondition && telemetry.length === 16 ? "completed_pass" : "stopped_on_contract_violation", completedRequestCount: telemetry.length, ...counters, stopCondition: stopCondition || "none", telemetry, cleanup });
}

export function buildEvidence({ receipt, deploymentRefs, harnessImplementationSha, startedAt, completedAt, result } = {}) {
  const approval = validateApproval(receipt, { now: new Date(receipt?.approvedAt || 0) });
  const telemetry = result?.telemetry || [];
  return deepFreeze({
    schemaVersion: EVIDENCE_SCHEMA,
    planVersion: "candidate-exposure-policy-limited-preview-canary-plan-v1",
    approvalIdHash: approval.approvalIdHash,
    approvalReceiptDigest: approval.receiptDigest,
    approvedSourceSha: receipt?.approvedSourceSha,
    productRuntimeAuthoritySha: receipt?.productRuntimeAuthoritySha,
    harnessImplementationSha,
    controlDeploymentId: deploymentRefs?.controlDeploymentId,
    canaryDeploymentId: deploymentRefs?.canaryDeploymentId,
    startedAt,
    completedAt,
    plannedRequestCount: 16,
    completedRequestCount: result?.completedRequestCount || 0,
    http200Count: result?.http200Count || 0,
    runtimeShaMatchCount: telemetry.filter((entry) => entry.runtimeImplementationShaMatch).length,
    finalDiagnosticStageCount: result?.finalDiagnosticStageCount || 0,
    defaultOffExecutionCount: result?.stopCondition === "defaultOffShadowExecution" ? 1 : 0,
    canaryExecutionCount: telemetry.filter((entry) => entry.mode === "canary").length,
    validTelemetryCount: telemetry.filter((entry) => validateTelemetry(entry).valid).length,
    mutationFingerprintMatchCount: telemetry.filter((entry) => entry.mode === "canary" && entry.responseFingerprintMatch && entry.snapshotFingerprintMatch && entry.candidateOrderMatch).length,
    unexpectedDivergenceCount: telemetry.reduce((n, entry) => n + entry.unexpectedDivergenceCount, 0),
    unclassifiedDivergenceCount: telemetry.reduce((n, entry) => n + entry.unclassifiedDivergenceCount, 0),
    shadowExceptionCount: telemetry.reduce((n, entry) => n + entry.shadowExceptionCount, 0),
    fallbackCount: telemetry.reduce((n, entry) => n + entry.fallbackCount, 0),
    invalidContextCount: telemetry.reduce((n, entry) => n + entry.invalidContextCount, 0),
    candidateLevelTelemetryIncidentCount: result?.stopCondition === "candidateLevelTelemetryDetected" ? 1 : 0,
    networkRequestCount: result?.networkRequestCount || 0,
    temporaryBypassCreatedCount: result?.cleanup?.temporaryBypassCreatedCount || 0,
    temporaryBypassRevokedCount: result?.cleanup?.temporaryBypassRevokedCount || 0,
    projectEnvironmentMutationCount: result?.cleanup?.projectEnvironmentMutationCount || 0,
    productionChangeCount: result?.cleanup?.productionChangeCount || 0,
    stopCondition: result?.stopCondition || "none",
    cleanupStatus: result?.status === "cleanup_failed" ? "failed" : "completed",
    status: result?.status,
    authorization: { runtimeActivationAuthorized: false, publicTrafficAuthorized: false, productionActivationAuthorized: false }
  });
}

export function validateEvidence(evidence) {
  const keys = ["schemaVersion", "planVersion", "approvalIdHash", "approvalReceiptDigest", "approvedSourceSha", "productRuntimeAuthoritySha", "harnessImplementationSha", "controlDeploymentId", "canaryDeploymentId", "startedAt", "completedAt", "plannedRequestCount", "completedRequestCount", "http200Count", "runtimeShaMatchCount", "finalDiagnosticStageCount", "defaultOffExecutionCount", "canaryExecutionCount", "validTelemetryCount", "mutationFingerprintMatchCount", "unexpectedDivergenceCount", "unclassifiedDivergenceCount", "shadowExceptionCount", "fallbackCount", "invalidContextCount", "candidateLevelTelemetryIncidentCount", "networkRequestCount", "temporaryBypassCreatedCount", "temporaryBypassRevokedCount", "projectEnvironmentMutationCount", "productionChangeCount", "stopCondition", "cleanupStatus", "status", "authorization"];
  const errors = [];
  if (!exactKeys(evidence, keys) || evidence?.schemaVersion !== EVIDENCE_SCHEMA || hasForbiddenKey(evidence)) errors.push("shape");
  if (!SHA40.test(String(evidence?.approvedSourceSha || "")) || evidence?.productRuntimeAuthoritySha !== PRODUCT_RUNTIME_SHA || !SHA40.test(String(evidence?.harnessImplementationSha || ""))) errors.push("sha");
  if (!validIso(evidence?.startedAt) || !validIso(evidence?.completedAt)) errors.push("time");
  for (const key of keys.filter((key) => key.endsWith("Count"))) if (!nonNegative(evidence?.[key])) errors.push(key);
  if (!exactKeys(evidence?.authorization, ["runtimeActivationAuthorized", "publicTrafficAuthorized", "productionActivationAuthorized"]) || Object.values(evidence?.authorization || {}).some(Boolean)) errors.push("authorization");
  if (evidence?.status === "completed_pass" && (evidence.completedRequestCount !== 16 || evidence.networkRequestCount !== 16 || evidence.http200Count !== 16 || evidence.runtimeShaMatchCount !== 16 || evidence.finalDiagnosticStageCount !== 16 || evidence.defaultOffExecutionCount !== 0 || evidence.canaryExecutionCount !== 8 || evidence.validTelemetryCount !== 16 || evidence.mutationFingerprintMatchCount !== 8 || evidence.unexpectedDivergenceCount !== 0 || evidence.unclassifiedDivergenceCount !== 0 || evidence.shadowExceptionCount !== 0 || evidence.fallbackCount !== 0 || evidence.invalidContextCount !== 0 || evidence.candidateLevelTelemetryIncidentCount !== 0 || evidence.projectEnvironmentMutationCount !== 0 || evidence.productionChangeCount !== 0 || evidence.temporaryBypassCreatedCount !== evidence.temporaryBypassRevokedCount || evidence.stopCondition !== "none" || evidence.cleanupStatus !== "completed")) errors.push("completed_pass_contract");
  return deepFreeze({ valid: errors.length === 0, errors: unique(errors) });
}
