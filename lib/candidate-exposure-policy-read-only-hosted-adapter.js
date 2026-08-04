import {
  deepFreeze,
  exactKeys,
  sha256,
  stable
} from "./candidate-exposure-policy-hosted-execution-contract.js";
import {
  EXECUTION_GRANT_SCHEMA,
  validateExecutionGrant
} from "./candidate-exposure-policy-hosted-execution-grant.js";

export const READ_ONLY_ADAPTER_SCHEMA =
  "candidate-exposure-policy-read-only-hosted-adapter-v2";
export const NORMALIZED_DEPLOYMENT_SCHEMA =
  "candidate-exposure-policy-read-only-deployment-metadata-v2";
export const DIAGNOSTIC_ROUTE_SCHEMA =
  "candidate-exposure-policy-hosted-diagnostic-route-v2";

export const CURRENT_ANALYZE_ROUTE_CAPABILITY = Object.freeze({
  schemaVersion: DIAGNOSTIC_ROUTE_SCHEMA,
  path: "/api/analyze",
  method: "POST",
  requestEncoding: "multipart/form-data",
  supportsSyntheticFixtureInjection: false,
  emitsHostedDiagnosticEnvelope: false
});

const SHA40 = /^[0-9a-f]{40}$/;
const DEPLOYMENT_ID = /^dpl_[A-Za-z0-9]{8,128}$/;
const IDENTITY = /^[A-Za-z0-9_-]{3,160}$/;
const IMMUTABLE_VERCEL_HOST =
  /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.vercel\.app$/;
const FORBIDDEN_CAPABILITY_KEYS = new Set([
  "deploy",
  "redeploy",
  "promote",
  "createdeployment",
  "deletedeployment",
  "canceldeployment",
  "setalias",
  "setproductionalias",
  "getenvironment",
  "listenvironment",
  "updateenvironment",
  "getruntimelogs",
  "getlogs",
  "listdeployments",
  "getlatestdeployment",
  "client",
  "sdk",
  "vercel",
  "shell",
  "exec",
  "fetch"
]);
const CAPABILITY_KEYS = Object.freeze([
  "getDeploymentById",
  "postAnalyzeDiagnostic",
  "getAccessMaterial"
]);
const ROUTE_KEYS = Object.freeze([
  "schemaVersion",
  "path",
  "method",
  "requestEncoding",
  "supportsSyntheticFixtureInjection",
  "emitsHostedDiagnosticEnvelope"
]);
const ADAPTER_CONTRACT_KEYS = Object.freeze([
  "schemaVersion",
  "deploymentMutationAllowed",
  "environmentReadAllowed",
  "environmentMutationAllowed",
  "runtimeLogReadAllowed",
  "bypassMutationAllowed",
  "productionAllowed",
  "automaticRetryAllowed",
  "maxDeploymentMetadataReads",
  "maxAnalyzeRequests",
  "perRequestTimeoutMs",
  "maxResponseBytes"
]);

function normalizedKey(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function containsForbiddenCapability(value, depth = 0) {
  if (!value || typeof value !== "object" || depth > 8) return false;
  return Object.entries(value).some(([key, nested]) =>
    FORBIDDEN_CAPABILITY_KEYS.has(normalizedKey(key)) ||
    (typeof nested === "object" && containsForbiddenCapability(nested, depth + 1))
  );
}

function exactAdapterContract(contract) {
  return exactKeys(contract, ADAPTER_CONTRACT_KEYS) &&
    contract.schemaVersion === READ_ONLY_ADAPTER_SCHEMA &&
    contract.deploymentMutationAllowed === false &&
    contract.environmentReadAllowed === false &&
    contract.environmentMutationAllowed === false &&
    contract.runtimeLogReadAllowed === false &&
    contract.bypassMutationAllowed === false &&
    contract.productionAllowed === false &&
    contract.automaticRetryAllowed === false &&
    contract.maxDeploymentMetadataReads === 2 &&
    contract.maxAnalyzeRequests === 16 &&
    contract.perRequestTimeoutMs === 90_000 &&
    contract.maxResponseBytes === 2_097_152;
}

function validRouteContract(routeContract) {
  return exactKeys(routeContract, ROUTE_KEYS) &&
    routeContract.schemaVersion === DIAGNOSTIC_ROUTE_SCHEMA &&
    routeContract.path === "/api/analyze" &&
    routeContract.method === "POST" &&
    routeContract.requestEncoding === "multipart/form-data" &&
    typeof routeContract.supportsSyntheticFixtureInjection === "boolean" &&
    typeof routeContract.emitsHostedDiagnosticEnvelope === "boolean";
}

function sourceCandidates(raw) {
  const candidates = [
    raw?.sourceSha,
    raw?.gitSourceSha,
    raw?.meta?.githubCommitSha,
    raw?.meta?.gitCommitSha,
    raw?.meta?.commitSha
  ]
    .filter((value) => typeof value === "string" && value.trim())
    .map((value) => value.trim().toLowerCase());
  return [...new Set(candidates)];
}

function normalizeAliases(raw) {
  const aliases = Array.isArray(raw?.aliases)
    ? raw.aliases
    : Array.isArray(raw?.alias)
      ? raw.alias
      : [];
  return aliases
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean);
}

export function normalizeDeploymentMetadata(raw, {
  expectedDeploymentId,
  approvedSourceSha,
  expectedProjectId,
  expectedTeamId = null
} = {}) {
  const errors = [];
  const deploymentId = String(raw?.id || raw?.deploymentId || "").trim();
  const projectId = String(raw?.projectId || raw?.project?.id || "").trim();
  const teamIdValue = raw?.teamId ?? raw?.team?.id ?? null;
  const teamId = teamIdValue == null ? null : String(teamIdValue).trim();
  const state = String(raw?.readyState || raw?.state || "").trim().toUpperCase();
  const target = raw?.target == null ? null : String(raw.target).trim().toLowerCase();
  const immutableHost = String(raw?.url || raw?.immutableHost || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  const aliases = normalizeAliases(raw);
  const sources = sourceCandidates(raw);

  if (!DEPLOYMENT_ID.test(deploymentId) || deploymentId !== expectedDeploymentId) {
    errors.push("deployment_id");
  }
  if (!IDENTITY.test(projectId) || projectId !== expectedProjectId) errors.push("project_identity");
  if (expectedTeamId === null) {
    if (teamId !== null && teamId !== "") errors.push("team_identity");
  } else if (!IDENTITY.test(String(expectedTeamId)) || teamId !== expectedTeamId) {
    errors.push("team_identity");
  }
  if (state !== "READY") errors.push("not_ready");
  if (target !== null && target !== "preview") errors.push("target");
  if (target === "production") errors.push("production_target");
  if (!IMMUTABLE_VERCEL_HOST.test(immutableHost)) errors.push("immutable_host");
  if (aliases.length > 0 || raw?.productionAliasPresent === true) errors.push("alias_present");
  if (sources.length !== 1 || !SHA40.test(sources[0] || "")) errors.push("source_sha_evidence");
  if (sources.length === 1 && sources[0] !== approvedSourceSha) errors.push("source_sha_mismatch");

  const normalized = {
    schemaVersion: NORMALIZED_DEPLOYMENT_SCHEMA,
    deploymentId,
    environmentClass: "preview",
    rawTarget: target,
    projectIdentityMatch: projectId === expectedProjectId,
    teamIdentityMatch: expectedTeamId === null
      ? teamId === null || teamId === ""
      : teamId === expectedTeamId,
    sourceSha: sources.length === 1 ? sources[0] : null,
    sourceShaMatch: sources.length === 1 && sources[0] === approvedSourceSha,
    ready: state === "READY",
    immutableHost: IMMUTABLE_VERCEL_HOST.test(immutableHost) ? immutableHost : null,
    productionAliasPresent: aliases.length > 0 || raw?.productionAliasPresent === true,
    deploymentMutationCount: 0,
    environmentReadCount: 0,
    environmentMutationCount: 0,
    runtimeLogReadCount: 0,
    valid: errors.length === 0,
    errors: [...new Set(errors)].sort()
  };

  return deepFreeze(normalized);
}

function validateCapabilities(capabilities) {
  if (!exactKeys(capabilities, CAPABILITY_KEYS) || containsForbiddenCapability(capabilities)) {
    return false;
  }
  return typeof capabilities.getDeploymentById === "function" &&
    typeof capabilities.postAnalyzeDiagnostic === "function" &&
    (capabilities.getAccessMaterial === null ||
      typeof capabilities.getAccessMaterial === "function");
}


export async function withTimeout(task, timeoutMs) {
  if (typeof task !== "function" || !Number.isInteger(timeoutMs) || timeoutMs < 1) {
    throw new Error("timeout_contract_invalid");
  }
  let timer = null;
  try {
    return await Promise.race([
      Promise.resolve().then(task),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("request_timeout")), timeoutMs);
      })
    ]);
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}

function validateTransportResponse(response, maxResponseBytes) {
  if (!exactKeys(response, [
    "httpStatus",
    "redirected",
    "responseBytes",
    "headers",
    "body"
  ])) return { valid: false, error: "transport_shape" };
  if (!Number.isInteger(response.httpStatus) || response.httpStatus < 100 || response.httpStatus > 599) {
    return { valid: false, error: "http_status" };
  }
  if (response.redirected !== false) return { valid: false, error: "redirect" };
  const actualResponseBytes = Buffer.byteLength(
    JSON.stringify(response.body ?? null),
    "utf8"
  );
  if (!Number.isInteger(response.responseBytes) || response.responseBytes < 0 ||
      response.responseBytes !== actualResponseBytes ||
      actualResponseBytes > maxResponseBytes) {
    return { valid: false, error: "response_size" };
  }
  if (!response.headers || typeof response.headers !== "object" || Array.isArray(response.headers)) {
    return { valid: false, error: "headers" };
  }
  if (!response.body || typeof response.body !== "object" || Array.isArray(response.body)) {
    return { valid: false, error: "body" };
  }
  return { valid: true, error: null };
}

function extractDiagnosticEnvelope(response, expected) {
  const envelope = response?.body?.candidateExposurePolicyHostedDiagnostic;
  const required = [
    "schemaVersion",
    "approvedSourceSha",
    "fixtureScenario",
    "fixtureSemanticFingerprint",
    "locale",
    "mode",
    "finalDiagnosticStage",
    "shadowExecution",
    "runtimeImplementationShaMatch",
    "telemetry",
    "responseFingerprintMatch",
    "snapshotFingerprintMatch",
    "candidateOrderMatch",
    "unexpectedDivergenceCount",
    "unclassifiedDivergenceCount",
    "shadowExceptionCount",
    "fallbackCount",
    "invalidContextCount",
    "candidateLevelTelemetryDetected",
    "productionOrProjectConfigurationChange"
  ];
  if (!exactKeys(envelope, required)) return null;
  if (envelope.schemaVersion !== "candidate-exposure-policy-hosted-diagnostic-envelope-v1") {
    return null;
  }
  if (envelope.approvedSourceSha !== expected.approvedSourceSha ||
      envelope.fixtureScenario !== expected.scenario ||
      envelope.fixtureSemanticFingerprint !== expected.expectedFixtureSemanticFingerprint ||
      envelope.locale !== expected.locale || envelope.mode !== expected.mode) {
    return null;
  }
  return envelope;
}

export function createReadOnlyHostedAdapter({
  executionGrant,
  routeContract = CURRENT_ANALYZE_ROUTE_CAPABILITY,
  capabilities,
  contract = {
    schemaVersion: READ_ONLY_ADAPTER_SCHEMA,
    deploymentMutationAllowed: false,
    environmentReadAllowed: false,
    environmentMutationAllowed: false,
    runtimeLogReadAllowed: false,
    bypassMutationAllowed: false,
    productionAllowed: false,
    automaticRetryAllowed: false,
    maxDeploymentMetadataReads: 2,
    maxAnalyzeRequests: 16,
    perRequestTimeoutMs: 90_000,
    maxResponseBytes: 2_097_152
  },
  now = () => new Date()
} = {}) {
  const grantReview = validateExecutionGrant(executionGrant, { now: now() });
  if (!grantReview.valid) throw new Error("execution_grant_invalid");
  if (!validRouteContract(routeContract)) throw new Error("route_contract_invalid");
  if (!exactAdapterContract(contract)) throw new Error("adapter_contract_invalid");
  if (!validateCapabilities(capabilities)) throw new Error("minimal_capabilities_required");

  const approvedIds = new Set([
    executionGrant.controlDeploymentId,
    executionGrant.canaryDeploymentId
  ]);
  const metadataById = new Map();
  let deploymentMetadataReadCount = 0;
  let analyzeRequestCount = 0;
  let accessMaterialUseCount = 0;
  let setCookieDiscardCount = 0;
  let cleaned = false;

  async function getDeploymentMetadata(deploymentId) {
    if (cleaned) throw new Error("adapter_cleaned");
    if (!approvedIds.has(deploymentId)) throw new Error("unapproved_deployment_id");
    if (metadataById.has(deploymentId)) return metadataById.get(deploymentId);
    if (deploymentMetadataReadCount >= contract.maxDeploymentMetadataReads) {
      throw new Error("deployment_metadata_read_budget_exceeded");
    }
    deploymentMetadataReadCount += 1;
    const raw = await capabilities.getDeploymentById(deploymentId);
    const normalized = normalizeDeploymentMetadata(raw, {
      expectedDeploymentId: deploymentId,
      approvedSourceSha: executionGrant.approvedSourceSha,
      expectedProjectId: executionGrant.approvedProjectId,
      expectedTeamId: executionGrant.approvedTeamId
    });
    metadataById.set(deploymentId, normalized);
    return normalized;
  }

  async function probeAnalyze(entry) {
    if (cleaned) throw new Error("adapter_cleaned");
    if (!routeContract.supportsSyntheticFixtureInjection ||
        !routeContract.emitsHostedDiagnosticEnvelope) {
      throw new Error("diagnostic_route_contract_unsupported");
    }
    if (Date.parse(now()) >= Date.parse(executionGrant.expiresAt)) {
      throw new Error("execution_grant_expired");
    }
    if (!entry || typeof entry !== "object") throw new Error("probe_entry_invalid");
    const deploymentId = entry.mode === "control"
      ? executionGrant.controlDeploymentId
      : entry.mode === "canary"
        ? executionGrant.canaryDeploymentId
        : null;
    if (!deploymentId || entry.deploymentId !== deploymentId) {
      throw new Error("probe_deployment_mismatch");
    }
    const metadata = metadataById.get(deploymentId);
    if (!metadata?.valid || !metadata.immutableHost) {
      throw new Error("deployment_metadata_not_verified");
    }
    if (analyzeRequestCount >= contract.maxAnalyzeRequests) {
      throw new Error("analyze_request_budget_exceeded");
    }

    let accessHeader = null;
    if (capabilities.getAccessMaterial) {
      const material = await capabilities.getAccessMaterial({
        deploymentId,
        approvalIdHash: executionGrant.approvalIdHash
      });
      if (material !== null) {
        if (!exactKeys(material, ["headerName", "headerValue"]) ||
            String(material.headerName || "").toLowerCase() !==
              "x-vercel-protection-bypass" ||
            typeof material.headerValue !== "string" ||
            material.headerValue.length < 8 || material.headerValue.length > 2048) {
          throw new Error("access_material_invalid");
        }
        accessHeader = {
          headerName: "x-vercel-protection-bypass",
          headerValue: material.headerValue
        };
        accessMaterialUseCount += 1;
      }
    }

    analyzeRequestCount += 1;
    const response = await withTimeout(
      () => capabilities.postAnalyzeDiagnostic({
      hostname: metadata.immutableHost,
      path: routeContract.path,
      method: routeContract.method,
      requestEncoding: routeContract.requestEncoding,
      redirect: "manual",
      credentials: "omit",
      timeoutMs: contract.perRequestTimeoutMs,
      maxResponseBytes: contract.maxResponseBytes,
      headers: accessHeader
        ? { [accessHeader.headerName]: accessHeader.headerValue }
        : {},
      diagnosticInput: {
        schemaVersion: "candidate-exposure-policy-hosted-diagnostic-input-v1",
        approvedSourceSha: executionGrant.approvedSourceSha,
        approvalIdHash: executionGrant.approvalIdHash,
        fixtureScenario: entry.scenario,
        fixtureSemanticFingerprint: entry.expectedFixtureSemanticFingerprint,
        locale: entry.locale,
        mode: entry.mode,
        fixture: entry.fixture
      }
      }),
      contract.perRequestTimeoutMs
    );
    accessHeader = null;

    const transportReview = validateTransportResponse(
      response,
      contract.maxResponseBytes
    );
    if (!transportReview.valid) throw new Error(transportReview.error);
    const lowerHeaders = Object.fromEntries(
      Object.entries(response.headers).map(([key, value]) => [
        String(key).toLowerCase(),
        value
      ])
    );
    if (Object.hasOwn(lowerHeaders, "set-cookie")) setCookieDiscardCount += 1;
    const envelope = extractDiagnosticEnvelope(response, entry);
    if (!envelope) throw new Error("diagnostic_envelope_invalid");

    return deepFreeze({
      httpStatus: response.httpStatus,
      sourceSha: envelope.approvedSourceSha,
      finalDiagnosticStage: envelope.finalDiagnosticStage,
      shadowExecution: envelope.shadowExecution,
      runtimeImplementationShaMatch: envelope.runtimeImplementationShaMatch,
      telemetry: envelope.telemetry,
      responseFingerprintMatch: envelope.responseFingerprintMatch,
      snapshotFingerprintMatch: envelope.snapshotFingerprintMatch,
      candidateOrderMatch: envelope.candidateOrderMatch,
      unexpectedDivergenceCount: envelope.unexpectedDivergenceCount,
      unclassifiedDivergenceCount: envelope.unclassifiedDivergenceCount,
      shadowExceptionCount: envelope.shadowExceptionCount,
      fallbackCount: envelope.fallbackCount,
      invalidContextCount: envelope.invalidContextCount,
      candidateLevelTelemetryDetected: envelope.candidateLevelTelemetryDetected,
      productionOrProjectConfigurationChange:
        envelope.productionOrProjectConfigurationChange
    });
  }

  async function cleanup() {
    const result = {
      temporaryBypassCreatedCount: 0,
      temporaryBypassRevokedCount: 0,
      temporaryFileResidue: 0,
      projectEnvironmentMutationCount: 0,
      productionChangeCount: 0,
      deploymentMetadataReadCount,
      analyzeRequestCount,
      runtimeLogReadCount: 0,
      environmentReadCount: 0,
      deploymentMutationCount: 0,
      accessMaterialUseCount,
      setCookieDiscardCount,
      routeContractReady:
        routeContract.supportsSyntheticFixtureInjection === true &&
        routeContract.emitsHostedDiagnosticEnvelope === true
    };
    metadataById.clear();
    cleaned = true;
    return deepFreeze(result);
  }

  return deepFreeze({
    contract: deepFreeze({ ...contract }),
    routeReadiness: deepFreeze({
      schemaVersion: routeContract.schemaVersion,
      supportsSyntheticFixtureInjection:
        routeContract.supportsSyntheticFixtureInjection,
      emitsHostedDiagnosticEnvelope:
        routeContract.emitsHostedDiagnosticEnvelope,
      readyForHostedExecution:
        routeContract.supportsSyntheticFixtureInjection === true &&
        routeContract.emitsHostedDiagnosticEnvelope === true,
      blocker: routeContract.supportsSyntheticFixtureInjection === true &&
        routeContract.emitsHostedDiagnosticEnvelope === true
        ? null
        : "diagnostic_route_contract_unsupported"
    }),
    getDeploymentMetadata,
    probeAnalyze,
    cleanup,
    implementationDigest: sha256(stable({
      adapterSchema: READ_ONLY_ADAPTER_SCHEMA,
      executionGrantSchema: EXECUTION_GRANT_SCHEMA,
      routeContract
    }))
  });
}
