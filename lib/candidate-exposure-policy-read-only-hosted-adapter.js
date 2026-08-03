import { randomBytes } from "node:crypto";
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
import {
  HOSTED_DIAGNOSTIC_AUTH_HEADERS,
  HOSTED_DIAGNOSTIC_CONTENT_TYPE,
  HOSTED_DIAGNOSTIC_PATH,
  buildDiagnosticCanonicalBytes
} from "./candidate-exposure-policy-hosted-diagnostic-auth.js";
import {
  HOSTED_DIAGNOSTIC_PLAN_VERSION,
  HOSTED_DIAGNOSTIC_REQUEST_SCHEMA,
  diagnosticSha256,
  stableDiagnosticStringify,
  validateHostedDiagnosticEnvelope
} from "./candidate-exposure-policy-hosted-diagnostic-contract.js";

export const READ_ONLY_ADAPTER_SCHEMA =
  "candidate-exposure-policy-read-only-hosted-adapter-v3";
export const NORMALIZED_DEPLOYMENT_SCHEMA =
  "candidate-exposure-policy-read-only-deployment-metadata-v2";
export const DIAGNOSTIC_ROUTE_SCHEMA =
  "candidate-exposure-policy-hosted-diagnostic-route-v3";

export const CURRENT_CANDIDATE_POLICY_DIAGNOSTIC_ROUTE_CAPABILITY = Object.freeze({
  schemaVersion: DIAGNOSTIC_ROUTE_SCHEMA,
  path: HOSTED_DIAGNOSTIC_PATH,
  method: "POST",
  requestEncoding: HOSTED_DIAGNOSTIC_CONTENT_TYPE,
  supportsSyntheticFixtureInjection: true,
  emitsHostedDiagnosticEnvelope: true,
  hostedPlanVersion: HOSTED_DIAGNOSTIC_PLAN_VERSION
});

export const CURRENT_ANALYZE_ROUTE_CAPABILITY = Object.freeze({
  schemaVersion: DIAGNOSTIC_ROUTE_SCHEMA,
  path: "/api/analyze",
  method: "POST",
  requestEncoding: "multipart/form-data",
  supportsSyntheticFixtureInjection: false,
  emitsHostedDiagnosticEnvelope: false,
  hostedPlanVersion: null
});

const SHA40 = /^[0-9a-f]{40}$/;
const SHA64 = /^[0-9a-f]{64}$/;
const DEPLOYMENT_ID = /^dpl_[A-Za-z0-9]{8,128}$/;
const IDENTITY = /^[A-Za-z0-9_-]{3,160}$/;
const IMMUTABLE_VERCEL_HOST =
  /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.vercel\.app$/;
const FORBIDDEN_CAPABILITY_KEYS = new Set([
  "deploy", "redeploy", "promote", "createdeployment", "deletedeployment",
  "canceldeployment", "setalias", "setproductionalias", "getenvironment",
  "listenvironment", "updateenvironment", "getruntimelogs", "getlogs",
  "listdeployments", "getlatestdeployment", "client", "sdk", "vercel",
  "shell", "exec", "fetch"
]);
const CAPABILITY_KEYS = Object.freeze([
  "getDeploymentById",
  "postCandidatePolicyDiagnostic",
  "getAccessMaterial"
]);
const ROUTE_KEYS = Object.freeze([
  "schemaVersion", "path", "method", "requestEncoding",
  "supportsSyntheticFixtureInjection", "emitsHostedDiagnosticEnvelope",
  "hostedPlanVersion"
]);
const ADAPTER_CONTRACT_KEYS = Object.freeze([
  "schemaVersion", "deploymentMutationAllowed", "environmentReadAllowed",
  "environmentMutationAllowed", "runtimeLogReadAllowed", "bypassMutationAllowed",
  "productionAllowed", "automaticRetryAllowed", "maxDeploymentMetadataReads",
  "maxDiagnosticRequests", "perRequestTimeoutMs", "maxResponseBytes"
]);
const ACCESS_MATERIAL_KEYS = Object.freeze([
  "mode", "getProtectionHeaders", "signDiagnosticRequest", "expiresAt"
]);

function normalizedKey(value) {
  return String(value || "").normalize("NFKC").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function containsForbiddenCapability(value, depth = 0) {
  if (!value || typeof value !== "object" || depth > 8) return false;
  return Object.entries(value).some(([key, nested]) =>
    FORBIDDEN_CAPABILITY_KEYS.has(normalizedKey(key)) ||
    (nested && typeof nested === "object" && containsForbiddenCapability(nested, depth + 1))
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
    contract.maxDiagnosticRequests === 16 &&
    contract.perRequestTimeoutMs === 90_000 &&
    contract.maxResponseBytes === 65_536;
}

function validRouteContract(routeContract) {
  return exactKeys(routeContract, ROUTE_KEYS) &&
    routeContract.schemaVersion === DIAGNOSTIC_ROUTE_SCHEMA &&
    routeContract.path === HOSTED_DIAGNOSTIC_PATH &&
    routeContract.method === "POST" &&
    routeContract.requestEncoding === HOSTED_DIAGNOSTIC_CONTENT_TYPE &&
    routeContract.supportsSyntheticFixtureInjection === true &&
    routeContract.emitsHostedDiagnosticEnvelope === true &&
    routeContract.hostedPlanVersion === HOSTED_DIAGNOSTIC_PLAN_VERSION;
}

function sourceCandidates(raw) {
  return [...new Set([
    raw?.sourceSha,
    raw?.gitSourceSha,
    raw?.meta?.githubCommitSha,
    raw?.meta?.gitCommitSha,
    raw?.meta?.commitSha
  ].filter((value) => typeof value === "string" && value.trim())
    .map((value) => value.trim().toLowerCase()))];
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
  const teamRaw = raw?.teamId ?? raw?.team?.id ?? null;
  const teamId = teamRaw == null ? null : String(teamRaw).trim();
  const state = String(raw?.readyState || raw?.state || "").trim().toUpperCase();
  const target = raw?.target == null ? null : String(raw.target).trim().toLowerCase();
  const immutableHost = String(raw?.url || raw?.immutableHost || "")
    .trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
  const productionAliasPresent = raw?.productionAliasPresent;
  const sources = sourceCandidates(raw);

  if (!DEPLOYMENT_ID.test(deploymentId) || deploymentId !== expectedDeploymentId) errors.push("deployment_id");
  if (!IDENTITY.test(projectId) || projectId !== expectedProjectId) errors.push("project_identity");
  if (expectedTeamId === null) {
    if (teamId !== null && teamId !== "") errors.push("team_identity");
  } else if (!IDENTITY.test(String(expectedTeamId)) || teamId !== expectedTeamId) {
    errors.push("team_identity");
  }
  if (state !== "READY") errors.push("not_ready");
  if (target !== null && target !== "preview") errors.push("target");
  if (!IMMUTABLE_VERCEL_HOST.test(immutableHost)) errors.push("immutable_host");
  if (productionAliasPresent !== false) errors.push("production_alias_evidence");
  if (sources.length !== 1 || !SHA40.test(sources[0] || "")) errors.push("source_sha_evidence");
  if (sources.length === 1 && sources[0] !== approvedSourceSha) errors.push("source_sha_mismatch");

  return deepFreeze({
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
    productionAliasPresent: productionAliasPresent !== false,
    deploymentMutationCount: 0,
    environmentReadCount: 0,
    environmentMutationCount: 0,
    runtimeLogReadCount: 0,
    valid: errors.length === 0,
    errors: [...new Set(errors)].sort()
  });
}

function validateCapabilities(capabilities) {
  return exactKeys(capabilities, CAPABILITY_KEYS) &&
    !containsForbiddenCapability(capabilities) &&
    typeof capabilities.getDeploymentById === "function" &&
    typeof capabilities.postCandidatePolicyDiagnostic === "function" &&
    (capabilities.getAccessMaterial === null || typeof capabilities.getAccessMaterial === "function");
}

function epoch(value) {
  if (value instanceof Date) return value.getTime();
  return Date.parse(value);
}

function validateAccessMaterial(material, executionGrant, now) {
  if (!exactKeys(material, ACCESS_MATERIAL_KEYS) ||
      material.mode !== "automation_bypass_hmac_v1" ||
      typeof material.getProtectionHeaders !== "function" ||
      typeof material.signDiagnosticRequest !== "function" ||
      typeof material.expiresAt !== "string") {
    return false;
  }
  const expiresAt = Date.parse(material.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt > epoch(now) &&
    expiresAt <= Date.parse(executionGrant.expiresAt);
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
  if (!exactKeys(response, ["httpStatus", "redirected", "responseBytes", "headers", "body"])) {
    return { valid: false, error: "transport_shape" };
  }
  if (!Number.isInteger(response.httpStatus) || response.httpStatus < 100 || response.httpStatus > 599) {
    return { valid: false, error: "http_status" };
  }
  if (response.redirected !== false) return { valid: false, error: "redirect" };
  const actualBytes = Buffer.byteLength(JSON.stringify(response.body ?? null), "utf8");
  if (!Number.isInteger(response.responseBytes) || response.responseBytes !== actualBytes ||
      actualBytes > maxResponseBytes) return { valid: false, error: "response_size" };
  if (!response.headers || typeof response.headers !== "object" || Array.isArray(response.headers)) {
    return { valid: false, error: "headers" };
  }
  if (!response.body || typeof response.body !== "object" || Array.isArray(response.body)) {
    return { valid: false, error: "body" };
  }
  return { valid: true, error: null };
}

function normalizedHostedTelemetry(envelope, entry, executionGrant) {
  const aggregate = envelope.aggregate;
  return deepFreeze({
    schemaVersion: "candidate-exposure-policy-hosted-aggregate-v1",
    planVersion: HOSTED_DIAGNOSTIC_PLAN_VERSION,
    approvalIdHash: executionGrant.approvalIdHash,
    runtimeImplementationShaMatch: entry.runtimeImplementationShaMatch === true,
    fixtureScenario: aggregate.fixtureScenario,
    fixtureSemanticFingerprint: aggregate.fixtureSemanticFingerprint,
    locale: aggregate.locale,
    mode: aggregate.mode,
    executionStatus: aggregate.executionStatus,
    candidateCount: aggregate.candidateCount,
    exposureCounts: aggregate.exposureCounts,
    laneEligibilityCounts: aggregate.laneEligibilityCounts,
    divergenceCategoryCounts: aggregate.divergenceCategoryCounts,
    responseFingerprintMatch: aggregate.responseFingerprintMatch,
    snapshotFingerprintMatch: aggregate.snapshotFingerprintMatch,
    candidateOrderMatch: aggregate.candidateOrderMatch,
    projectionFingerprintPresent: aggregate.projectionFingerprintPresent,
    unexpectedDivergenceCount: aggregate.unexpectedDivergenceCount,
    unclassifiedDivergenceCount: aggregate.unclassifiedDivergenceCount,
    shadowExceptionCount: aggregate.shadowExceptionCount,
    fallbackCount: aggregate.fallbackCount,
    invalidContextCount: aggregate.invalidContextCount,
    stopCondition: null
  });
}

export function createReadOnlyHostedAdapter({
  executionGrant,
  routeContract = CURRENT_CANDIDATE_POLICY_DIAGNOSTIC_ROUTE_CAPABILITY,
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
    maxDiagnosticRequests: 16,
    perRequestTimeoutMs: 90_000,
    maxResponseBytes: 65_536
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
  let diagnosticRequestCount = 0;
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

  async function probeCandidatePolicyDiagnostic(entry) {
    if (cleaned) throw new Error("adapter_cleaned");
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
    if (diagnosticRequestCount >= contract.maxDiagnosticRequests) {
      throw new Error("diagnostic_request_budget_exceeded");
    }
    const material = capabilities.getAccessMaterial
      ? await capabilities.getAccessMaterial({
        deploymentId,
        approvalIdHash: executionGrant.approvalIdHash
      })
      : null;
    if (!material || !validateAccessMaterial(material, executionGrant, now())) {
      throw new Error("access_material_invalid");
    }
    accessMaterialUseCount += 1;

    const requestRecord = {
      schemaVersion: HOSTED_DIAGNOSTIC_REQUEST_SCHEMA,
      executionGrantDigest: entry.executionGrantDigest,
      approvalIdHash: executionGrant.approvalIdHash,
      approvedSourceSha: executionGrant.approvedSourceSha,
      deploymentId,
      sequence: entry.sequence,
      locale: entry.locale,
      scenario: entry.scenario,
      expectedMode: entry.mode,
      fixtureSemanticFingerprint: entry.expectedFixtureSemanticFingerprint
    };
    const bodyBytes = Buffer.from(stableDiagnosticStringify(requestRecord), "utf8");
    const timestamp = String(epoch(now()));
    const nonce = randomBytes(32).toString("base64url");
    const canonicalBytes = buildDiagnosticCanonicalBytes({
      host: metadata.immutableHost,
      timestamp,
      nonce,
      bodyBytes
    });
    const signature = await material.signDiagnosticRequest(canonicalBytes);
    if (!SHA64.test(String(signature || ""))) throw new Error("access_signature_invalid");
    const protectionHeaders = await material.getProtectionHeaders();
    if (!exactKeys(protectionHeaders, ["x-vercel-protection-bypass"]) ||
        typeof protectionHeaders["x-vercel-protection-bypass"] !== "string" ||
        protectionHeaders["x-vercel-protection-bypass"].length < 8) {
      throw new Error("protection_headers_invalid");
    }

    diagnosticRequestCount += 1;
    let response;
    try {
      response = await withTimeout(
        () => capabilities.postCandidatePolicyDiagnostic({
          hostname: metadata.immutableHost,
          path: routeContract.path,
          method: routeContract.method,
          requestEncoding: routeContract.requestEncoding,
          redirect: "manual",
          credentials: "omit",
          timeoutMs: contract.perRequestTimeoutMs,
          maxResponseBytes: contract.maxResponseBytes,
          headers: {
            ...protectionHeaders,
            "content-type": HOSTED_DIAGNOSTIC_CONTENT_TYPE,
            [HOSTED_DIAGNOSTIC_AUTH_HEADERS.timestamp]: timestamp,
            [HOSTED_DIAGNOSTIC_AUTH_HEADERS.nonce]: nonce,
            [HOSTED_DIAGNOSTIC_AUTH_HEADERS.signature]: signature
          },
          bodyBytes
        }),
        contract.perRequestTimeoutMs
      );
    } finally {
      bodyBytes.fill(0);
      canonicalBytes.fill(0);
    }

    const transportReview = validateTransportResponse(response, contract.maxResponseBytes);
    if (!transportReview.valid) throw new Error(transportReview.error);
    const lowerHeaders = Object.fromEntries(
      Object.entries(response.headers).map(([key, value]) => [String(key).toLowerCase(), value])
    );
    const responseContentType = String(lowerHeaders["content-type"] || "")
      .split(";", 1)[0].trim().toLowerCase();
    if (responseContentType !== HOSTED_DIAGNOSTIC_CONTENT_TYPE) {
      throw new Error("response_content_type_invalid");
    }
    const cacheDirectives = String(lowerHeaders["cache-control"] || "")
      .toLowerCase().split(",").map((value) => value.trim());
    if (!cacheDirectives.includes("no-store")) {
      throw new Error("response_cache_control_invalid");
    }
    if (Object.hasOwn(lowerHeaders, "set-cookie")) {
      setCookieDiscardCount += 1;
      throw new Error("set_cookie_detected");
    }
    const envelopeReview = validateHostedDiagnosticEnvelope(response.body);
    if (!envelopeReview.valid) throw new Error("diagnostic_envelope_invalid");
    const envelope = response.body;
    if (response.httpStatus !== 200 || envelope.sourceSha !== executionGrant.approvedSourceSha ||
        envelope.deploymentIdHash !== diagnosticSha256(deploymentId) ||
        envelope.executionGrantDigest !== entry.executionGrantDigest ||
        envelope.sequence !== entry.sequence ||
        envelope.aggregate.fixtureScenario !== entry.scenario ||
        envelope.aggregate.fixtureSemanticFingerprint !== entry.expectedFixtureSemanticFingerprint ||
        envelope.aggregate.locale !== entry.locale || envelope.aggregate.mode !== entry.mode) {
      throw new Error("diagnostic_envelope_mismatch");
    }

    const telemetry = normalizedHostedTelemetry(envelope, entry, executionGrant);
    return deepFreeze({
      httpStatus: response.httpStatus,
      sourceSha: envelope.sourceSha,
      finalDiagnosticStage: envelope.finalDiagnosticStage ===
        "candidate_policy_diagnostic_complete",
      shadowExecution: envelope.shadowExecution,
      runtimeImplementationShaMatch: entry.runtimeImplementationShaMatch === true,
      telemetry,
      responseFingerprintMatch: envelope.aggregate.responseFingerprintMatch,
      snapshotFingerprintMatch: envelope.aggregate.snapshotFingerprintMatch,
      candidateOrderMatch: envelope.aggregate.candidateOrderMatch,
      unexpectedDivergenceCount: envelope.aggregate.unexpectedDivergenceCount,
      unclassifiedDivergenceCount: envelope.aggregate.unclassifiedDivergenceCount,
      shadowExceptionCount: envelope.aggregate.shadowExceptionCount,
      fallbackCount: envelope.aggregate.fallbackCount,
      invalidContextCount: envelope.aggregate.invalidContextCount,
      candidateLevelTelemetryDetected: false,
      productionOrProjectConfigurationChange: false
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
      diagnosticRequestCount,
      runtimeLogReadCount: 0,
      environmentReadCount: 0,
      deploymentMutationCount: 0,
      accessMaterialUseCount,
      setCookieDiscardCount,
      routeContractReady: true
    };
    metadataById.clear();
    cleaned = true;
    return deepFreeze(result);
  }

  return deepFreeze({
    contract: deepFreeze({ ...contract }),
    routeReadiness: deepFreeze({
      schemaVersion: routeContract.schemaVersion,
      supportsSyntheticFixtureInjection: true,
      emitsHostedDiagnosticEnvelope: true,
      readyForHostedExecution: true,
      blocker: null
    }),
    getDeploymentMetadata,
    probeCandidatePolicyDiagnostic,
    cleanup,
    implementationDigest: sha256(stable({
      adapterSchema: READ_ONLY_ADAPTER_SCHEMA,
      executionGrantSchema: EXECUTION_GRANT_SCHEMA,
      routeContract
    }))
  });
}
