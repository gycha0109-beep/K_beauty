import assert from "node:assert/strict";
import {
  APPROVAL_SCHEMA, DIVERGENCES, EXPOSURES, FIXTURE_SCHEMA, LANES,
  OPERATIONS, PRODUCT_RUNTIME_SHA, REFS_SCHEMA, SCENARIOS, TELEMETRY_SCHEMA,
  validateApproval, validateDeploymentRefs, validateFixtureManifest,
  validateRuntimeAttestation
} from "../lib/candidate-exposure-policy-hosted-execution-contract.js";
import {
  buildEvidence, buildMatrix, buildPlan, executeApproved, validateEvidence
} from "../lib/candidate-exposure-policy-hosted-execution.js";

async function selfTest() {
  let count = 0;
  const ok = (value, message) => { count += 1; assert.ok(value, message); };
  const eq = (a, b, message) => { count += 1; assert.equal(a, b, message); };
  const sourceSha = "a".repeat(40);
  const receipt = { schemaVersion: APPROVAL_SCHEMA, approvalId: "approval_12345678", approvedAt: "2026-08-02T00:00:00.000Z", expiresAt: "2026-08-02T01:00:00.000Z", targetBranch: "codex/candidate-exposure-policy-hosted-execution-runner", approvedSourceSha: sourceSha, productRuntimeAuthoritySha: PRODUCT_RUNTIME_SHA, allowedOperations: [...OPERATIONS], maxPreviewDeployments: 2, maxAnalyzeRequests: 16, productionAllowed: false };
  const refs = { schemaVersion: REFS_SCHEMA, approvedSourceSha: sourceSha, productRuntimeAuthoritySha: PRODUCT_RUNTIME_SHA, controlDeploymentId: "dpl_Control12345678", canaryDeploymentId: "dpl_Canary12345678" };
  const runtimeAttestation = { schemaVersion: "candidate-exposure-policy-runtime-closure-attestation-v1", productRuntimeAuthoritySha: PRODUCT_RUNTIME_SHA, closureFileCount: 16, changedRuntimeFileCount: 0, match: true };
  const fixtureManifest = { schemaVersion: FIXTURE_SCHEMA, runtimeImplementationSha: PRODUCT_RUNTIME_SHA, actualUserData: false, scenarios: SCENARIOS.map((scenario) => ({ scenario, semanticVersion: `${scenario}-v1`, expectedReasonCodes: ["canonical_goal_match"], canonicalState: { version: `${scenario}-canonical-v1` }, candidates: [{ id: `synthetic-${scenario}` }] })) };
  const now = new Date("2026-08-02T00:30:00.000Z");
  ok(validateApproval(receipt, { now }).valid, "approval");
  const offsetReceipt = { ...receipt, approvedAt: "2026-08-02T09:00:00.000+09:00", expiresAt: "2026-08-02T10:00:00.000+09:00" };
  ok(validateApproval(offsetReceipt, { now }).valid, "offset approval");
  const impossibleDate = { ...receipt, approvedAt: "2026-02-30T00:00:00.000Z", expiresAt: "2026-02-30T00:30:00.000Z" };
  ok(!validateApproval(impossibleDate, { now: new Date("2026-03-02T00:10:00.000Z") }).valid, "impossible date rejected");
  ok(validateDeploymentRefs(refs, receipt).valid, "refs");
  ok(validateRuntimeAttestation(runtimeAttestation), "attestation");
  ok(validateFixtureManifest(fixtureManifest).valid, "fixtures");
  eq(buildMatrix().length, 16, "matrix");
  eq(buildPlan({ receipt, runtimeAttestation, fixtureManifest, now }).status, "plan_ready_for_manual_provisioning");
  eq(buildPlan({ receipt, deploymentRefs: refs, runtimeAttestation, fixtureManifest, now }).status, "plan_ready_for_execution_review");
  for (const mutate of [(value) => { value.productionAllowed = true; }, (value) => { value.maxAnalyzeRequests = 17; }, (value) => { value.approvedSourceSha = "short"; }, (value) => { value.expiresAt = "2026-08-02T02:00:00.000Z"; }, (value) => { value.secret = "x"; }]) { const copy = structuredClone(receipt); mutate(copy); ok(!validateApproval(copy, { now }).valid, "negative approval"); }
  const fixtureReview = validateFixtureManifest(fixtureManifest);
  const makeTelemetry = (entry) => ({ schemaVersion: TELEMETRY_SCHEMA, planVersion: "candidate-exposure-policy-limited-preview-canary-plan-v1", approvalIdHash: validateApproval(receipt, { now }).approvalIdHash, runtimeImplementationShaMatch: true, fixtureScenario: entry.scenario, fixtureSemanticFingerprint: fixtureReview.fingerprints[entry.scenario], locale: entry.locale, mode: entry.mode, executionStatus: "executed", candidateCount: entry.mode === "canary" ? 2 : 0, exposureCounts: Object.fromEntries(EXPOSURES.map((key) => [key, entry.mode === "canary" && ["primary", "hidden"].includes(key) ? 1 : 0])), laneEligibilityCounts: Object.fromEntries(LANES.map((key) => [key, entry.mode === "canary" && key === "topPick" ? 1 : 0])), divergenceCategoryCounts: Object.fromEntries(DIVERGENCES.map((key) => [key, entry.mode === "canary" && key === "equivalent" ? 2 : 0])), responseFingerprintMatch: true, snapshotFingerprintMatch: true, candidateOrderMatch: true, projectionFingerprintPresent: entry.mode === "canary", unexpectedDivergenceCount: 0, unclassifiedDivergenceCount: 0, shadowExceptionCount: 0, fallbackCount: 0, invalidContextCount: 0, stopCondition: null });
  let clock = Date.parse(receipt.approvedAt);
  const adapters = { contract: { schemaVersion: "candidate-exposure-policy-hosted-adapter-v1", deploymentMutationAllowed: false, productionAllowed: false, automaticRetryAllowed: false, maxAnalyzeRequests: 16 }, async getDeploymentMetadata(id) { return { deploymentId: id, target: "preview", sourceSha, ready: true, productionAliasPresent: false, projectEnvironmentMutationCount: 0, branchEnvironmentMutationCount: 0, shadowOptIn: id === refs.canaryDeploymentId }; }, async probeAnalyze(entry) { return { httpStatus: 200, sourceSha, finalDiagnosticStage: true, shadowExecution: entry.mode === "canary", runtimeImplementationShaMatch: true, telemetry: makeTelemetry(entry), responseFingerprintMatch: true, snapshotFingerprintMatch: true, candidateOrderMatch: true, unexpectedDivergenceCount: 0, unclassifiedDivergenceCount: 0, shadowExceptionCount: 0, fallbackCount: 0, invalidContextCount: 0, candidateLevelTelemetryDetected: false, productionOrProjectConfigurationChange: false }; }, async cleanup() { return { temporaryBypassCreatedCount: 1, temporaryBypassRevokedCount: 1, temporaryFileResidue: 0, projectEnvironmentMutationCount: 0, productionChangeCount: 0 }; } };
  const result = await executeApproved({ receipt, deploymentRefs: refs, runtimeAttestation, fixtureManifest, adapters, now, monotonicNow: () => (clock += 100) });
  eq(result.status, "completed_pass");
  eq(result.completedRequestCount, 16);
  eq(result.networkRequestCount, 16);
  const evidence = buildEvidence({ receipt, deploymentRefs: refs, harnessImplementationSha: "b".repeat(40), startedAt: "2026-08-02T00:30:00.000Z", completedAt: "2026-08-02T00:31:00.000Z", result });
  ok(validateEvidence(evidence).valid, "evidence");
  await assert.rejects(() => executeApproved({ receipt, deploymentRefs: refs, runtimeAttestation, fixtureManifest, adapters: { ...adapters, deploy() {} }, now }), /safe_adapter_required/); count += 1;
  const badCanaryAdapters = { ...adapters, async getDeploymentMetadata(id) { const value = await adapters.getDeploymentMetadata(id); return id === refs.canaryDeploymentId ? { ...value, shadowOptIn: false } : value; } };
  eq((await executeApproved({ receipt, deploymentRefs: refs, runtimeAttestation, fixtureManifest, adapters: badCanaryAdapters, now })).stopCondition, "canaryDeploymentMismatch");
  const badCleanup = { ...adapters, async cleanup() { return { temporaryBypassCreatedCount: 1, temporaryBypassRevokedCount: 0, temporaryFileResidue: 0, projectEnvironmentMutationCount: 0, productionChangeCount: 0 }; } };
  clock = Date.parse(receipt.approvedAt);
  eq((await executeApproved({ receipt, deploymentRefs: refs, runtimeAttestation, fixtureManifest, adapters: badCleanup, now, monotonicNow: () => (clock += 100) })).status, "cleanup_failed");
  let wallCalls = 0;
  const expiring = await executeApproved({ receipt, deploymentRefs: refs, runtimeAttestation, fixtureManifest, adapters, now, wallClockNow: () => new Date(wallCalls++ === 0 ? "2026-08-02T00:30:00.000Z" : "2026-08-02T01:00:00.000Z") });
  eq(expiring.stopCondition, "approvalExpired");
  eq(expiring.networkRequestCount, 1);
  console.log(`candidate-exposure-policy-hosted-execution: PASS (${count} assertions, exact 16-entry orchestration)`);
}

await selfTest();
