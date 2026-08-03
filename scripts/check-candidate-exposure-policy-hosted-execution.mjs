import { createHmac } from "node:crypto";
import { createRequire } from "node:module";
import {
  PRODUCT_RUNTIME_SHA
} from "../lib/candidate-exposure-policy-hosted-execution-contract.js";
import {
  EXECUTION_GRANT_SCHEMA,
  validateExecutionGrant
} from "../lib/candidate-exposure-policy-hosted-execution-grant.js";
import {
  CURRENT_CANDIDATE_POLICY_DIAGNOSTIC_ROUTE_CAPABILITY,
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
import {
  createHostedDiagnosticRouteHandler
} from "../app/api/internal/candidate-exposure-policy-diagnostic/route.js";

const require = createRequire(import.meta.url);
const manifest = require("../fixtures/candidate-exposure-policy-isolated-canary/manifest.v1.json");
const NOW_ISO = "2026-08-02T08:30:00.000Z";
const NOW_MS = Date.parse(NOW_ISO);
const SOURCE_SHA = "a".repeat(40);
const CONTROL_ID = "dpl_control12345678";
const CANARY_ID = "dpl_canary12345678";
const CONTROL_HOST = "stage11k-control-abc123.vercel.app";
const CANARY_HOST = "stage11k-canary-def456.vercel.app";
const SECRET = "stage11k-local-test-secret";
let assertions = 0;

function assert(condition, message) {
  assertions += 1;
  if (!condition) throw new Error(`assertion_failed:${message}`);
}

async function expectThrow(task, message) {
  let thrown = null;
  try { await task(); } catch (error) { thrown = error; }
  assert(Boolean(thrown), `${message}:not_thrown`);
  return thrown;
}

const grant = {
  schemaVersion: EXECUTION_GRANT_SCHEMA,
  approvalIdHash: "c".repeat(64),
  provisioningReceiptDigest: "d".repeat(64),
  issuedAt: "2026-08-02T08:00:00.000Z",
  expiresAt: "2026-08-02T09:00:00.000Z",
  approvedSourceSha: SOURCE_SHA,
  approvedProjectId: "prj_stage11k",
  approvedTeamId: null,
  productRuntimeAuthoritySha: PRODUCT_RUNTIME_SHA,
  controlDeploymentId: CONTROL_ID,
  canaryDeploymentId: CANARY_ID,
  allowedOperations: [
    "approved_deployment_metadata_read",
    "approved_preview_probe",
    "memory_only_access_material_use",
    "mandatory_local_cleanup"
  ],
  maxDeploymentMetadataReads: 2,
  maxAnalyzeRequests: 16,
  runtimeLogReadsAllowed: false,
  productionAllowed: false
};
const grantReview = validateExecutionGrant(grant, { now: new Date(NOW_MS) });
assert(grantReview.valid, "execution_grant_valid");

const runtimeAttestation = {
  schemaVersion: "candidate-exposure-policy-runtime-closure-attestation-v1",
  productRuntimeAuthoritySha: PRODUCT_RUNTIME_SHA,
  closureFileCount: 16,
  changedRuntimeFileCount: 0,
  match: true
};

const controlEnv = {
  VERCEL_ENV: "preview",
  NODE_ENV: "production",
  VERCEL_URL: CONTROL_HOST,
  VERCEL_GIT_COMMIT_SHA: SOURCE_SHA,
  VERCEL_DEPLOYMENT_ID: CONTROL_ID,
  CANDIDATE_EXPOSURE_POLICY_DIAGNOSTIC_GRANT_DIGEST: grantReview.grantDigest,
  VERCEL_AUTOMATION_BYPASS_SECRET: SECRET,
  DEV_ONLY_CANDIDATE_EXPOSURE_POLICY_SHADOW: "0",
  DISABLE_CANDIDATE_EXPOSURE_POLICY_SHADOW: "0"
};
const canaryEnv = {
  ...controlEnv,
  VERCEL_URL: CANARY_HOST,
  VERCEL_DEPLOYMENT_ID: CANARY_ID,
  DEV_ONLY_CANDIDATE_EXPOSURE_POLICY_SHADOW: "1"
};
const handlers = new Map([
  [CONTROL_HOST, createHostedDiagnosticRouteHandler({ env: controlEnv, manifest, nowMs: () => NOW_MS })],
  [CANARY_HOST, createHostedDiagnosticRouteHandler({ env: canaryEnv, manifest, nowMs: () => NOW_MS })]
]);

let metadataReads = 0;
let diagnosticPosts = 0;
let transportAttempts = 0;
let protectionHeaderReads = 0;
let signatures = 0;
const capabilities = {
  async getDeploymentById(deploymentId) {
    metadataReads += 1;
    const control = deploymentId === CONTROL_ID;
    return {
      id: deploymentId,
      projectId: "prj_stage11k",
      teamId: null,
      readyState: "READY",
      target: null,
      url: control ? CONTROL_HOST : CANARY_HOST,
      aliases: [control ? "stage11k-control-branch.vercel.app" : "stage11k-canary-branch.vercel.app"],
      productionAliasPresent: false,
      sourceSha: SOURCE_SHA
    };
  },
  async postCandidatePolicyDiagnostic({ hostname, path, method, headers, bodyBytes, redirect }) {
    transportAttempts += 1;
    diagnosticPosts += 1;
    assert(path === "/api/internal/candidate-exposure-policy-diagnostic", "transport_path_exact");
    assert(method === "POST", "transport_method_exact");
    assert(redirect === "manual", "transport_redirect_manual");
    assert(!path.includes("/api/analyze"), "transport_never_calls_analyze");
    const handler = handlers.get(hostname);
    if (!handler) throw new Error("unknown_host");
    const response = await handler(new Request(`https://${hostname}${path}`, {
      method,
      headers,
      body: bodyBytes
    }));
    const text = await response.text();
    const body = JSON.parse(text);
    return {
      httpStatus: response.status,
      redirected: false,
      responseBytes: Buffer.byteLength(JSON.stringify(body), "utf8"),
      headers: Object.fromEntries(response.headers.entries()),
      body
    };
  },
  async getAccessMaterial() {
    return {
      mode: "automation_bypass_hmac_v1",
      async getProtectionHeaders() {
        protectionHeaderReads += 1;
        return { "x-vercel-protection-bypass": SECRET };
      },
      async signDiagnosticRequest(canonicalBytes) {
        signatures += 1;
        return createHmac("sha256", SECRET).update(canonicalBytes).digest("hex");
      },
      expiresAt: grant.expiresAt
    };
  }
};

const validNullTarget = normalizeDeploymentMetadata({
  id: CONTROL_ID, projectId: "prj_stage11k", teamId: null, readyState: "READY",
  target: null, url: CONTROL_HOST, aliases: ["stage11k-control-branch.vercel.app"],
  productionAliasPresent: false, sourceSha: SOURCE_SHA
}, {
  expectedDeploymentId: CONTROL_ID, approvedSourceSha: SOURCE_SHA,
  expectedProjectId: "prj_stage11k", expectedTeamId: null
});
assert(validNullTarget.valid, "target_null_preview_valid");
assert(normalizeDeploymentMetadata({
  id: CONTROL_ID, projectId: "prj_stage11k", teamId: null, readyState: "READY",
  target: "preview", url: CONTROL_HOST, aliases: ["stage11k-control-branch.vercel.app"],
  productionAliasPresent: false, sourceSha: SOURCE_SHA
}, {
  expectedDeploymentId: CONTROL_ID, approvedSourceSha: SOURCE_SHA,
  expectedProjectId: "prj_stage11k", expectedTeamId: null
}).valid, "target_preview_valid");
for (const [name, raw] of [
  ["production_target", { id: CONTROL_ID, projectId: "prj_stage11k", readyState: "READY", target: "production", url: CONTROL_HOST, aliases: [], productionAliasPresent: false, sourceSha: SOURCE_SHA }],
  ["production_alias", { id: CONTROL_ID, projectId: "prj_stage11k", readyState: "READY", target: null, url: CONTROL_HOST, aliases: ["production.example.com"], productionAliasPresent: true, sourceSha: SOURCE_SHA }],
  ["alias_evidence_missing", { id: CONTROL_ID, projectId: "prj_stage11k", readyState: "READY", target: null, url: CONTROL_HOST, aliases: [], sourceSha: SOURCE_SHA }],
  ["source_conflict", { id: CONTROL_ID, projectId: "prj_stage11k", readyState: "READY", target: null, url: CONTROL_HOST, aliases: [], productionAliasPresent: false, sourceSha: SOURCE_SHA, gitSourceSha: "f".repeat(40) }],
  ["project", { id: CONTROL_ID, projectId: "prj_wrong", readyState: "READY", target: null, url: CONTROL_HOST, aliases: [], productionAliasPresent: false, sourceSha: SOURCE_SHA }],
  ["host", { id: CONTROL_ID, projectId: "prj_stage11k", readyState: "READY", target: null, url: "example.com", aliases: [], productionAliasPresent: false, sourceSha: SOURCE_SHA }]
]) {
  const review = normalizeDeploymentMetadata(raw, {
    expectedDeploymentId: CONTROL_ID, approvedSourceSha: SOURCE_SHA,
    expectedProjectId: "prj_stage11k", expectedTeamId: null
  });
  assert(!review.valid, `metadata_negative:${name}`);
}
await expectThrow(() => withTimeout(() => new Promise(() => {}), 5), "adapter_timeout_owned");

const adapter = createReadOnlyHostedAdapter({
  executionGrant: grant,
  routeContract: CURRENT_CANDIDATE_POLICY_DIAGNOSTIC_ROUTE_CAPABILITY,
  capabilities,
  now: () => new Date(NOW_MS)
});
const plan = buildExecutionPlan({
  executionGrant: grant,
  runtimeAttestation,
  fixtureManifest: manifest,
  routeReadiness: adapter.routeReadiness,
  now: new Date(NOW_MS)
});
assert(plan.status === "plan_ready_for_approved_hosted_diagnostic_execution", "plan_ready");
assert(plan.planVersion === "candidate-exposure-policy-hosted-diagnostic-plan-v2", "plan_version_v2");
assert(plan.diagnosticRequestCount === 16, "plan_request_budget");

const result = await executeApproved({
  executionGrant: grant,
  runtimeAttestation,
  fixtureManifest: manifest,
  adapters: adapter,
  now: new Date(NOW_MS),
  wallClockNow: () => new Date(NOW_MS),
  monotonicNow: (() => { let tick = 0; return () => tick += 10; })()
});
assert(result.status === "completed_pass", "execution_completed_pass");
assert(result.completedRequestCount === 16, "completed_16");
assert(result.networkRequestCount === 16, "network_16");
assert(result.http200Count === 16, "http_16");
assert(result.finalDiagnosticStageCount === 16, "final_stage_16");
assert(result.telemetry.filter((entry) => entry.mode === "control").length === 8, "control_8");
assert(result.telemetry.filter((entry) => entry.mode === "canary").length === 8, "canary_8");
assert(result.telemetry.every((entry) => entry.planVersion === "candidate-exposure-policy-hosted-diagnostic-plan-v2"), "telemetry_plan_v2");
assert(metadataReads === 2, "metadata_reads_2");
assert(diagnosticPosts === 16, "diagnostic_posts_16");
assert(transportAttempts === 16, "retry_zero");
assert(protectionHeaderReads === 16, "access_headers_16");
assert(signatures === 16, "signatures_16");
assert(result.cleanup.deploymentMetadataReadCount === 2, "cleanup_metadata_2");
assert(result.cleanup.diagnosticRequestCount === 16, "cleanup_diagnostic_16");
assert(result.cleanup.runtimeLogReadCount === 0, "runtime_logs_zero");
assert(result.cleanup.environmentReadCount === 0, "environment_reads_zero");
assert(result.cleanup.deploymentMutationCount === 0, "deployment_mutations_zero");
assert(result.cleanup.projectEnvironmentMutationCount === 0, "project_mutations_zero");
assert(result.cleanup.productionChangeCount === 0, "production_changes_zero");
assert(result.cleanup.temporaryBypassCreatedCount === 0, "bypass_create_zero");
assert(result.cleanup.temporaryBypassRevokedCount === 0, "bypass_revoke_zero");
assert(result.cleanup.setCookieDiscardCount === 0, "set_cookie_zero");
assert(!JSON.stringify(result).includes(CONTROL_HOST), "raw_host_not_serialized");
assert(!JSON.stringify(result).includes(SECRET), "secret_not_serialized");
assert(!JSON.stringify(result).includes("candidateRef"), "candidate_ref_not_serialized");

const evidence = buildEvidence({
  executionGrant: grant,
  harnessImplementationSha: "e".repeat(40),
  startedAt: "2026-08-02T08:30:00.000Z",
  completedAt: "2026-08-02T08:31:00.000Z",
  result
});
const evidenceReview = validateEvidence(evidence);
assert(evidenceReview.valid, `evidence_valid:${evidenceReview.errors.join(",")}`);
assert(evidence.planVersion === "candidate-exposure-policy-hosted-diagnostic-plan-v2", "evidence_plan_v2");
assert(evidence.diagnosticRequestCount === 16, "evidence_diagnostic_16");
assert(evidence.setCookieDiscardCount === 0, "evidence_set_cookie_zero");
assert(!Object.hasOwn(evidence, "analyzeRequestCount"), "analyze_counter_removed");

await expectThrow(
  () => Promise.resolve(createReadOnlyHostedAdapter({
    executionGrant: grant,
    capabilities: {
      ...capabilities,
      postAnalyzeDiagnostic: async () => null
    },
    now: () => new Date(NOW_MS)
  })),
  "old_capability_rejected"
);
await expectThrow(
  () => Promise.resolve(createReadOnlyHostedAdapter({
    executionGrant: grant,
    capabilities: {
      getDeploymentById: capabilities.getDeploymentById,
      postCandidatePolicyDiagnostic: capabilities.postCandidatePolicyDiagnostic,
      getAccessMaterial: capabilities.getAccessMaterial,
      client: { deploy() {} }
    },
    now: () => new Date(NOW_MS)
  })),
  "generic_client_rejected"
);

console.log(`candidate-exposure-policy-hosted-execution-v2: PASS (${assertions} assertions)`);
