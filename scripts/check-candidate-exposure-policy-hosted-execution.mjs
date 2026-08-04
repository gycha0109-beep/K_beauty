import assert from "node:assert/strict";
import {
  APPROVAL_SCHEMA,
  DIVERGENCES,
  EXPOSURES,
  FIXTURE_SCHEMA,
  LANES,
  OPERATIONS,
  PRODUCT_RUNTIME_SHA,
  REFS_SCHEMA,
  SCENARIOS,
  TELEMETRY_SCHEMA,
  sha256,
  stable,
  validateApproval,
  validateFixtureManifest
} from "../lib/candidate-exposure-policy-hosted-execution-contract.js";
import {
  deriveExecutionGrant,
  validateExecutionGrant
} from "../lib/candidate-exposure-policy-hosted-execution-grant.js";
import {
  CURRENT_ANALYZE_ROUTE_CAPABILITY,
  DIAGNOSTIC_ROUTE_SCHEMA,
  createReadOnlyHostedAdapter,
  normalizeDeploymentMetadata,
  withTimeout
} from "../lib/candidate-exposure-policy-read-only-hosted-adapter.js";
import {
  buildEvidence,
  buildExecutionPlan,
  executeApproved,
  validateEvidence
} from "../lib/candidate-exposure-policy-hosted-execution-v2.js";

let assertions = 0;
function ok(value, message) {
  assertions += 1;
  assert.ok(value, message);
}
function eq(actual, expected, message) {
  assertions += 1;
  assert.equal(actual, expected, message);
}
async function rejects(fn, pattern, message) {
  assertions += 1;
  await assert.rejects(fn, pattern, message);
}

const sourceSha = "a".repeat(40);
const approvalNow = new Date("2026-08-02T09:20:00.000+09:00");
const receipt = {
  schemaVersion: APPROVAL_SCHEMA,
  approvalId: "approval_12345678",
  approvedAt: "2026-08-02T09:00:00.000+09:00",
  expiresAt: "2026-08-02T10:00:00.000+09:00",
  targetBranch: "codex/candidate-exposure-policy-read-only-hosted-adapter",
  approvedSourceSha: sourceSha,
  productRuntimeAuthoritySha: PRODUCT_RUNTIME_SHA,
  allowedOperations: [...OPERATIONS],
  maxPreviewDeployments: 2,
  maxAnalyzeRequests: 16,
  productionAllowed: false
};
const deploymentRefs = {
  schemaVersion: REFS_SCHEMA,
  approvedSourceSha: sourceSha,
  productRuntimeAuthoritySha: PRODUCT_RUNTIME_SHA,
  controlDeploymentId: "dpl_Control12345678",
  canaryDeploymentId: "dpl_Canary12345678"
};
const runtimeAttestation = {
  schemaVersion: "candidate-exposure-policy-runtime-closure-attestation-v1",
  productRuntimeAuthoritySha: PRODUCT_RUNTIME_SHA,
  closureFileCount: 16,
  changedRuntimeFileCount: 0,
  match: true
};
const fixtureManifest = {
  schemaVersion: FIXTURE_SCHEMA,
  runtimeImplementationSha: PRODUCT_RUNTIME_SHA,
  actualUserData: false,
  scenarios: SCENARIOS.map((scenario) => ({
    scenario,
    semanticVersion: `${scenario}-v1`,
    expectedReasonCodes: ["canonical_goal_match"],
    canonicalState: { version: `${scenario}-canonical-v1` },
    candidates: [{ id: `synthetic-${scenario}-1` }, { id: `synthetic-${scenario}-2` }]
  }))
};
const fixtureReview = validateFixtureManifest(fixtureManifest);
const derived = deriveExecutionGrant({
  receipt,
  deploymentRefs,
  issuedAt: "2026-08-02T09:10:00.000+09:00",
  expiresAt: "2026-08-02T10:00:00.000+09:00",
  approvedProjectId: "prj_kbeauty",
  approvedTeamId: null,
  now: approvalNow
});
const grant = derived.grant;

ok(validateApproval(receipt, { now: approvalNow }).valid, "approval v1 remains valid");
ok(derived.valid, "execution grant v2 derives from approval and exact deployment refs");
ok(validateExecutionGrant(grant, { now: approvalNow }).valid, "execution grant validates");
eq(grant.allowedOperations.length, 4, "grant has exact read-only operation set");
eq(grant.maxDeploymentMetadataReads, 2, "metadata budget frozen");
eq(grant.maxAnalyzeRequests, 16, "probe budget frozen");
eq(grant.runtimeLogReadsAllowed, false, "runtime logs prohibited");
eq(grant.productionAllowed, false, "production prohibited");

const futureRouteContract = Object.freeze({
  schemaVersion: DIAGNOSTIC_ROUTE_SCHEMA,
  path: "/api/analyze",
  method: "POST",
  requestEncoding: "multipart/form-data",
  supportsSyntheticFixtureInjection: true,
  emitsHostedDiagnosticEnvelope: true
});

function rawDeployment(id, { target = null, aliases = [], source = sourceSha, projectId = "prj_kbeauty", teamId = null } = {}) {
  return {
    id,
    projectId,
    teamId,
    readyState: "READY",
    target,
    url: id === deploymentRefs.controlDeploymentId
      ? "k-beauty-control-immutable.vercel.app"
      : "k-beauty-canary-immutable.vercel.app",
    aliases,
    sourceSha: source,
    meta: {}
  };
}

const nullTarget = normalizeDeploymentMetadata(
  rawDeployment(deploymentRefs.controlDeploymentId, { target: null }),
  {
    expectedDeploymentId: deploymentRefs.controlDeploymentId,
    approvedSourceSha: sourceSha,
    expectedProjectId: "prj_kbeauty",
    expectedTeamId: null
  }
);
ok(nullTarget.valid, "target=null Preview is valid when all proofs match");
eq(nullTarget.rawTarget, null, "null target retained in normalized evidence");

for (const [name, raw, expectedError] of [
  ["production target", rawDeployment(deploymentRefs.controlDeploymentId, { target: "production" }), "production_target"],
  ["production/custom alias", rawDeployment(deploymentRefs.controlDeploymentId, { aliases: ["www.bejewely.example"] }), "alias_present"],
  ["missing source", { ...rawDeployment(deploymentRefs.controlDeploymentId), sourceSha: null }, "source_sha_evidence"],
  ["wrong project", rawDeployment(deploymentRefs.controlDeploymentId, { projectId: "prj_other" }), "project_identity"],
  ["wrong team", rawDeployment(deploymentRefs.controlDeploymentId, { teamId: "team_other" }), "team_identity"],
  ["non immutable host", { ...rawDeployment(deploymentRefs.controlDeploymentId), url: "preview.example.com" }, "immutable_host"]
]) {
  const normalized = normalizeDeploymentMetadata(raw, {
    expectedDeploymentId: deploymentRefs.controlDeploymentId,
    approvedSourceSha: sourceSha,
    expectedProjectId: "prj_kbeauty",
    expectedTeamId: name === "wrong team" ? "team_expected" : null
  });
  ok(!normalized.valid && normalized.errors.includes(expectedError), `${name} rejected`);
}
const conflictingSource = rawDeployment(deploymentRefs.controlDeploymentId);
conflictingSource.meta.githubCommitSha = "b".repeat(40);
const conflictingNormalized = normalizeDeploymentMetadata(conflictingSource, {
  expectedDeploymentId: deploymentRefs.controlDeploymentId,
  approvedSourceSha: sourceSha,
  expectedProjectId: "prj_kbeauty",
  expectedTeamId: null
});
ok(!conflictingNormalized.valid && conflictingNormalized.errors.includes("source_sha_evidence"), "conflicting source SHA fields rejected");

function makeTelemetry(input, overrides = {}) {
  const isCanary = input.mode === "canary";
  const candidateCount = isCanary ? 2 : 0;
  return {
    schemaVersion: TELEMETRY_SCHEMA,
    planVersion: "candidate-exposure-policy-limited-preview-canary-plan-v1",
    approvalIdHash: grant.approvalIdHash,
    runtimeImplementationShaMatch: true,
    fixtureScenario: input.fixtureScenario,
    fixtureSemanticFingerprint: input.fixtureSemanticFingerprint,
    locale: input.locale,
    mode: input.mode,
    executionStatus: "executed",
    candidateCount,
    exposureCounts: Object.fromEntries(EXPOSURES.map((key) => [
      key,
      isCanary && ["primary", "hidden"].includes(key) ? 1 : 0
    ])),
    laneEligibilityCounts: Object.fromEntries(LANES.map((key) => [
      key,
      isCanary && key === "topPick" ? 1 : 0
    ])),
    divergenceCategoryCounts: Object.fromEntries(DIVERGENCES.map((key) => [
      key,
      isCanary && key === "equivalent" ? 2 : 0
    ])),
    responseFingerprintMatch: true,
    snapshotFingerprintMatch: true,
    candidateOrderMatch: true,
    projectionFingerprintPresent: isCanary,
    unexpectedDivergenceCount: 0,
    unclassifiedDivergenceCount: 0,
    shadowExceptionCount: 0,
    fallbackCount: 0,
    invalidContextCount: 0,
    stopCondition: null,
    ...overrides
  };
}

function makeCapabilities(options = {}) {
  const calls = { metadata: 0, probes: 0, access: 0, lastRequest: null };
  const secret = options.secret || "memory-only-access-material-123456";
  const capabilities = {
    async getDeploymentById(id) {
      calls.metadata += 1;
      const base = rawDeployment(id, {
        target: id === deploymentRefs.controlDeploymentId ? null : "preview"
      });
      return options.metadataMutator ? options.metadataMutator(base, id) : base;
    },
    async postAnalyzeDiagnostic(request) {
      calls.probes += 1;
      calls.lastRequest = request;
      if (options.throwOnce && calls.probes === 1) throw new Error("transport_failure");
      const input = request.diagnosticInput;
      const mode = input.mode;
      const telemetryOverrides = options.telemetryMutator
        ? options.telemetryMutator({}, input)
        : {};
      const envelope = {
        schemaVersion: "candidate-exposure-policy-hosted-diagnostic-envelope-v1",
        approvedSourceSha: sourceSha,
        fixtureScenario: input.fixtureScenario,
        fixtureSemanticFingerprint: options.fingerprintMismatch
          ? "f".repeat(64)
          : input.fixtureSemanticFingerprint,
        locale: input.locale,
        mode,
        finalDiagnosticStage: true,
        shadowExecution: options.shadowMutator
          ? options.shadowMutator(mode)
          : mode === "canary",
        runtimeImplementationShaMatch: true,
        telemetry: makeTelemetry({
          fixtureScenario: input.fixtureScenario,
          fixtureSemanticFingerprint: input.fixtureSemanticFingerprint,
          locale: input.locale,
          mode
        }, telemetryOverrides),
        responseFingerprintMatch: true,
        snapshotFingerprintMatch: true,
        candidateOrderMatch: true,
        unexpectedDivergenceCount: 0,
        unclassifiedDivergenceCount: 0,
        shadowExceptionCount: 0,
        fallbackCount: 0,
        invalidContextCount: 0,
        candidateLevelTelemetryDetected: false,
        productionOrProjectConfigurationChange: false
      };
      const body = options.missingEnvelope
        ? { status: "ok" }
        : {
            candidateExposurePolicyHostedDiagnostic: envelope,
            ...(options.oversizedBody ? { padding: "x".repeat(2_097_152) } : {})
          };
      return {
        httpStatus: 200,
        redirected: options.redirected === true,
        responseBytes: Buffer.byteLength(JSON.stringify(body), "utf8"),
        headers: { "set-cookie": "discard-me=1; Secure" },
        body
      };
    },
    async getAccessMaterial() {
      calls.access += 1;
      return options.noAccess ? null : {
        headerName: "x-vercel-protection-bypass",
        headerValue: secret
      };
    }
  };
  return { capabilities, calls, secret };
}

function makeAdapter(options = {}) {
  const built = makeCapabilities(options);
  const adapter = createReadOnlyHostedAdapter({
    executionGrant: grant,
    routeContract: options.routeContract || futureRouteContract,
    capabilities: built.capabilities,
    now: () => approvalNow
  });
  return { ...built, adapter };
}

const currentRoute = makeAdapter({ routeContract: CURRENT_ANALYZE_ROUTE_CAPABILITY });
eq(currentRoute.adapter.routeReadiness.readyForHostedExecution, false, "current route fails closed");
eq(currentRoute.adapter.routeReadiness.blocker, "diagnostic_route_contract_unsupported", "current route blocker classified");
const blockedPlan = buildExecutionPlan({
  executionGrant: grant,
  runtimeAttestation,
  fixtureManifest,
  routeReadiness: currentRoute.adapter.routeReadiness,
  now: approvalNow
});
eq(blockedPlan.status, "blocked_before_execution", "execution plan blocked on current route contract");
ok(blockedPlan.blockers.includes("diagnostic_route_contract_unsupported"), "route blocker retained");
const blockedResult = await executeApproved({
  executionGrant: grant,
  runtimeAttestation,
  fixtureManifest,
  adapters: currentRoute.adapter,
  now: approvalNow
});
eq(blockedResult.status, "blocked_before_execution", "current route performs no Hosted execution");
eq(currentRoute.calls.metadata, 0, "route blocker stops before Vercel metadata read");
eq(currentRoute.calls.probes, 0, "route blocker stops before analyze probe");

const successful = makeAdapter();
let monotonic = 0;
const passResult = await executeApproved({
  executionGrant: grant,
  runtimeAttestation,
  fixtureManifest,
  adapters: successful.adapter,
  now: approvalNow,
  wallClockNow: () => approvalNow,
  monotonicNow: () => (monotonic += 10)
});
eq(passResult.status, "completed_pass", "future diagnostic contract simulation completes");
eq(passResult.completedRequestCount, 16, "exact 16 entries complete");
eq(passResult.networkRequestCount, 16, "exact 16 bounded probes");
eq(passResult.cleanup.deploymentMetadataReadCount, 2, "exact two metadata reads");
eq(passResult.cleanup.analyzeRequestCount, 16, "cleanup records exact probe count");
eq(passResult.cleanup.runtimeLogReadCount, 0, "runtime logs remain zero");
eq(passResult.cleanup.environmentReadCount, 0, "environment reads remain zero");
eq(passResult.cleanup.deploymentMutationCount, 0, "deployment mutations remain zero");
eq(passResult.cleanup.temporaryBypassCreatedCount, 0, "adapter creates no bypass");
eq(passResult.cleanup.temporaryBypassRevokedCount, 0, "adapter revokes no bypass");
eq(passResult.cleanup.setCookieDiscardCount, 16, "Set-Cookie discarded for every probe");
eq(successful.calls.metadata, 2, "control-plane read budget exact");
eq(successful.calls.probes, 16, "application-plane probe budget exact");
eq(successful.calls.access, 16, "memory-only access material used per probe");
eq(successful.calls.lastRequest.path, "/api/analyze", "path is fixed");
eq(successful.calls.lastRequest.redirect, "manual", "redirect mode is manual");
eq(successful.calls.lastRequest.credentials, "omit", "cookie credentials omitted");
eq(successful.calls.lastRequest.timeoutMs, 90_000, "per-request timeout is fixed");
eq(successful.calls.lastRequest.maxResponseBytes, 2_097_152, "response cap is fixed");
ok(!Object.hasOwn(successful.calls.lastRequest.headers, "cookie"), "outgoing Cookie header absent");

const evidence = buildEvidence({
  executionGrant: grant,
  harnessImplementationSha: "b".repeat(40),
  startedAt: "2026-08-02T09:20:00.000+09:00",
  completedAt: "2026-08-02T09:22:00.000+09:00",
  result: passResult
});
ok(validateEvidence(evidence).valid, "aggregate-only evidence validates");
const serialized = JSON.stringify({ passResult, evidence, adapter: successful.adapter });
ok(!serialized.includes(successful.secret), "access material is not serialized");
ok(!serialized.toLowerCase().includes("set-cookie"), "Set-Cookie value is not serialized");

await rejects(
  async () => createReadOnlyHostedAdapter({
    executionGrant: grant,
    capabilities: {
      ...makeCapabilities().capabilities,
      listDeployments() {}
    },
    routeContract: futureRouteContract,
    now: () => approvalNow
  }),
  /minimal_capabilities_required/,
  "latest-deployment discovery capability rejected"
);
await rejects(
  async () => createReadOnlyHostedAdapter({
    executionGrant: grant,
    capabilities: {
      getDeploymentById: makeCapabilities().capabilities.getDeploymentById,
      postAnalyzeDiagnostic: makeCapabilities().capabilities.postAnalyzeDiagnostic,
      getAccessMaterial: null,
      client: { deploy() {} }
    },
    routeContract: futureRouteContract,
    now: () => approvalNow
  }),
  /minimal_capabilities_required/,
  "generic nested Vercel client rejected"
);

async function runFailure(options) {
  const test = makeAdapter(options);
  let clock = 0;
  const result = await executeApproved({
    executionGrant: grant,
    runtimeAttestation,
    fixtureManifest,
    adapters: test.adapter,
    now: approvalNow,
    wallClockNow: () => approvalNow,
    monotonicNow: () => (clock += 10)
  });
  return { ...test, result };
}

const redirected = await runFailure({ redirected: true });
eq(redirected.result.status, "stopped_on_contract_violation", "redirect fails closed");
eq(redirected.calls.probes, 1, "redirect is not retried");
const oversized = await runFailure({ oversizedBody: true });
eq(oversized.result.status, "stopped_on_contract_violation", "oversized response fails closed");
eq(oversized.calls.probes, 1, "oversized response is not retried");
const missingEnvelope = await runFailure({ missingEnvelope: true });
eq(missingEnvelope.result.blocker, "diagnostic_envelope_invalid", "missing diagnostic envelope rejected");
const controlShadow = await runFailure({ shadowMutator: () => true });
eq(controlShadow.result.stopCondition, "defaultOffShadowExecution", "control shadow execution rejected");
const canaryOff = await runFailure({ shadowMutator: (mode) => mode === "control" ? false : false });
eq(canaryOff.result.stopCondition, "unclassifiedDivergence", "canary non-execution rejected");
const fingerprintMismatch = await runFailure({ fingerprintMismatch: true });
eq(fingerprintMismatch.result.blocker, "diagnostic_envelope_invalid", "fixture fingerprint mismatch rejected");
const invalidTelemetry = await runFailure({ telemetryMutator: () => ({ candidateCount: -1 }) });
eq(invalidTelemetry.result.blocker, "probe_contract_invalid", "invalid aggregate telemetry rejected");
const transportFailure = await runFailure({ throwOnce: true });
eq(transportFailure.calls.probes, 1, "transport failure is not retried");
await rejects(
  () => withTimeout(() => new Promise(() => {}), 5),
  /request_timeout/,
  "adapter-owned timeout rejects stalled transport"
);

const metadataFailure = makeAdapter({
  metadataMutator: (raw, id) => id === deploymentRefs.controlDeploymentId
    ? { ...raw, target: "production" }
    : raw
});
const metadataFailureResult = await executeApproved({
  executionGrant: grant,
  runtimeAttestation,
  fixtureManifest,
  adapters: metadataFailure.adapter,
  now: approvalNow
});
eq(metadataFailureResult.stopCondition, "controlDeploymentMismatch", "invalid control metadata rejected");
eq(metadataFailureResult.cleanup.deploymentMetadataReadCount, 1, "metadata failure still performs local cleanup");
eq(metadataFailureResult.cleanup.deploymentMutationCount, 0, "metadata failure cleanup remains read-only");

const badGrant = structuredClone(grant);
badGrant.allowedOperations = [...grant.allowedOperations, "manual_preview_provisioning"];
ok(!validateExecutionGrant(badGrant, { now: approvalNow }).valid, "provisioning authority cannot enter execution grant");
const secretGrant = { ...grant, token: "forbidden" };
ok(!validateExecutionGrant(secretGrant, { now: approvalNow }).valid, "token-bearing grant rejected");
const longGrant = {
  ...grant,
  expiresAt: "2026-08-02T10:11:00.000+09:00"
};
ok(!validateExecutionGrant(longGrant, { now: approvalNow }).valid, "grant window over 60 minutes rejected");
const extendedDerivation = deriveExecutionGrant({
  receipt,
  deploymentRefs,
  issuedAt: "2026-08-02T09:20:00.000+09:00",
  expiresAt: "2026-08-02T10:05:00.000+09:00",
  approvedProjectId: "prj_kbeauty",
  approvedTeamId: null,
  now: approvalNow
});
ok(!extendedDerivation.valid && extendedDerivation.errors.includes("extends_approval_window"), "execution grant cannot extend original approval expiry");
const wrongProjectGrant = { ...grant, approvedProjectId: "prj_other" };
ok(validateExecutionGrant(wrongProjectGrant, { now: approvalNow }).valid, "project identity is structurally valid but remains grant-bound");

eq(sha256(stable(grant)), derived.grantDigest, "grant digest deterministic");

console.log(`candidate-exposure-policy-read-only-hosted-adapter: PASS (${assertions} assertions; current route blocked; simulated future contract 16/16)`);
