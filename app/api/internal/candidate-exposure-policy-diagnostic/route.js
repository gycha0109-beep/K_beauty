import { createRequire } from "node:module";
import {
  HOSTED_DIAGNOSTIC_AUTH_HEADERS,
  HOSTED_DIAGNOSTIC_CONTENT_TYPE,
  HOSTED_DIAGNOSTIC_PATH,
  verifyDiagnosticAuthentication
} from "../../../../lib/candidate-exposure-policy-hosted-diagnostic-auth.js";
import {
  HOSTED_DIAGNOSTIC_ENVELOPE_SCHEMA,
  diagnosticSha256,
  parseStrictHostedDiagnosticRequest,
  stableDiagnosticStringify,
  validateHostedDiagnosticEnvelope,
  validateHostedDiagnosticRequest
} from "../../../../lib/candidate-exposure-policy-hosted-diagnostic-contract.js";
import {
  executeHostedCandidatePolicyDiagnostic
} from "../../../../lib/candidate-exposure-policy-hosted-diagnostic-execution.js";

export const runtime = "nodejs";
export const maxDuration = 10;

const require = createRequire(import.meta.url);
const fixtureManifest = require(
  "../../../../fixtures/candidate-exposure-policy-isolated-canary/manifest.v1.json"
);
const SHA40 = /^[0-9a-f]{40}$/;
const SHA64 = /^[0-9a-f]{64}$/;
const DEPLOYMENT_ID = /^dpl_[A-Za-z0-9]{8,128}$/;
const REQUEST_LIMIT_BYTES = 8 * 1024;
const RESPONSE_LIMIT_BYTES = 64 * 1024;
const REJECTED_HEADERS = Object.freeze([
  "cookie",
  "authorization",
  "origin",
  "sec-fetch-site",
  "sec-fetch-mode",
  "sec-fetch-dest"
]);
const AUTHENTICATED_ERROR_CODES = new Set([
  "request_contract_invalid",
  "source_sha_mismatch",
  "fixture_contract_invalid",
  "fixture_fingerprint_mismatch",
  "deployment_mode_mismatch",
  "kill_switch_active",
  "policy_evaluation_failed",
  "aggregate_validation_failed",
  "response_serialization_failed",
  "unexpected_divergence",
  "unclassified_divergence",
  "invalid_context",
  "mutation_fingerprint_mismatch"
]);

function responseHeaders() {
  return {
    "content-type": "application/json",
    "cache-control": "no-store, private, max-age=0",
    pragma: "no-cache",
    "x-content-type-options": "nosniff"
  };
}

function jsonResponse(body, status) {
  const serialized = JSON.stringify(body);
  if (Buffer.byteLength(serialized, "utf8") > RESPONSE_LIMIT_BYTES) {
    return new Response(JSON.stringify({ error: "response_serialization_failed" }), {
      status: 500,
      headers: responseHeaders()
    });
  }
  return new Response(serialized, { status, headers: responseHeaders() });
}

function notFound() {
  return jsonResponse({ error: "not_found" }, 404);
}

function authenticatedFailure(code) {
  const safeCode = AUTHENTICATED_ERROR_CODES.has(code)
    ? code
    : "request_contract_invalid";
  return jsonResponse({ error: safeCode }, 400);
}

function environmentReady(env) {
  return env?.VERCEL_ENV === "preview" &&
    env?.NODE_ENV === "production" &&
    SHA40.test(String(env?.VERCEL_GIT_COMMIT_SHA || "")) &&
    DEPLOYMENT_ID.test(String(env?.VERCEL_DEPLOYMENT_ID || "")) &&
    SHA64.test(String(env?.CANDIDATE_EXPOSURE_POLICY_DIAGNOSTIC_GRANT_DIGEST || "")) &&
    typeof env?.VERCEL_AUTOMATION_BYPASS_SECRET === "string" &&
    env.VERCEL_AUTOMATION_BYPASS_SECRET.length >= 8;
}

async function readBodyBytesCapped(request, maxBytes) {
  if (!request.body || typeof request.body.getReader !== "function") {
    const bytes = Buffer.from(await request.arrayBuffer());
    if (bytes.length > maxBytes) throw new Error("request_body_too_large");
    return bytes;
  }
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = Buffer.from(value);
      total += chunk.length;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new Error("request_body_too_large");
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total);
}

function requestHasBrowserState(request) {
  return REJECTED_HEADERS.some((header) => request.headers.has(header));
}

function requestHost(request) {
  try {
    return new URL(request.url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function errorCode(error) {
  const code = error instanceof Error ? error.message : String(error);
  return AUTHENTICATED_ERROR_CODES.has(code)
    ? code
    : code.startsWith("fixture_")
      ? "fixture_contract_invalid"
      : code.startsWith("policy_")
        ? "policy_evaluation_failed"
        : "request_contract_invalid";
}

export function createHostedDiagnosticRouteHandler({
  env = process.env,
  manifest = fixtureManifest,
  nowMs = () => Date.now(),
  executeDiagnostic = executeHostedCandidatePolicyDiagnostic
} = {}) {
  return async function POST(request) {
    if (!environmentReady(env)) return notFound();
    if (!request || request.method !== "POST") return notFound();
    if (requestHasBrowserState(request)) return notFound();
    const contentType = String(request.headers.get("content-type") || "").toLowerCase();
    if (contentType !== HOSTED_DIAGNOSTIC_CONTENT_TYPE) return notFound();
    const contentLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > REQUEST_LIMIT_BYTES) return notFound();

    let bodyBytes;
    try {
      bodyBytes = await readBodyBytesCapped(request, REQUEST_LIMIT_BYTES);
    } catch {
      return notFound();
    }

    const timestamp = request.headers.get(HOSTED_DIAGNOSTIC_AUTH_HEADERS.timestamp);
    const nonce = request.headers.get(HOSTED_DIAGNOSTIC_AUTH_HEADERS.nonce);
    const signature = request.headers.get(HOSTED_DIAGNOSTIC_AUTH_HEADERS.signature);
    const auth = verifyDiagnosticAuthentication({
      method: request.method,
      path: HOSTED_DIAGNOSTIC_PATH,
      host: requestHost(request),
      contentType,
      timestamp,
      nonce,
      signature,
      bodyBytes,
      secret: env.VERCEL_AUTOMATION_BYPASS_SECRET,
      nowMs: nowMs()
    });
    if (!auth.valid) return notFound();

    let requestRecord;
    try {
      requestRecord = parseStrictHostedDiagnosticRequest(bodyBytes.toString("utf8"));
    } catch {
      return authenticatedFailure("request_contract_invalid");
    }
    const requestReview = validateHostedDiagnosticRequest(requestRecord);
    if (!requestReview.valid) return authenticatedFailure("request_contract_invalid");
    if (requestRecord.approvedSourceSha !== env.VERCEL_GIT_COMMIT_SHA) {
      return authenticatedFailure("source_sha_mismatch");
    }
    if (requestRecord.deploymentId !== env.VERCEL_DEPLOYMENT_ID ||
        requestRecord.executionGrantDigest !==
          env.CANDIDATE_EXPOSURE_POLICY_DIAGNOSTIC_GRANT_DIGEST) {
      return authenticatedFailure("request_contract_invalid");
    }

    let result;
    try {
      result = executeDiagnostic({
        requestRecord,
        fixtureManifest: manifest,
        env
      });
    } catch (error) {
      return authenticatedFailure(errorCode(error));
    }

    const envelope = {
      schemaVersion: HOSTED_DIAGNOSTIC_ENVELOPE_SCHEMA,
      status: "completed",
      sourceSha: env.VERCEL_GIT_COMMIT_SHA,
      environmentClass: "preview",
      deploymentIdHash: diagnosticSha256(requestRecord.deploymentId),
      executionGrantDigest: requestRecord.executionGrantDigest,
      sequence: requestRecord.sequence,
      finalDiagnosticStage: "candidate_policy_diagnostic_complete",
      shadowExecution: result.shadowExecution,
      aggregate: result.aggregate
    };
    const envelopeReview = validateHostedDiagnosticEnvelope(envelope);
    if (!envelopeReview.valid) {
      return authenticatedFailure("response_serialization_failed");
    }
    const serialized = stableDiagnosticStringify(envelope);
    if (Buffer.byteLength(serialized, "utf8") > RESPONSE_LIMIT_BYTES) {
      return authenticatedFailure("response_serialization_failed");
    }
    return new Response(serialized, { status: 200, headers: responseHeaders() });
  };
}

export const POST = createHostedDiagnosticRouteHandler();
