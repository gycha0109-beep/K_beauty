#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PRODUCT_QUERY_OPERATIONAL_OBSERVABILITY,
  PRODUCT_QUERY_OPERATIONAL_OBSERVABILITY_CONTRACT_VERSION,
  bucketProductQueryCount,
  bucketProductQueryLatency,
  classifyProductQueryOperationalOutcome,
  classifyProductQueryProviderProtocolFailure,
  createProductQueryOperationalObservation,
  writeProductQueryOperationalObservation,
  writeProductQueryProviderProtocolDiagnostic
} from "../lib/product-query-operational-observability.mjs";

let assertions = 0;
function check(condition, message) {
  assert.ok(condition, message);
  assertions += 1;
}

check(
  PRODUCT_QUERY_OPERATIONAL_OBSERVABILITY_CONTRACT_VERSION ===
    "product-query-beta-observability-v1" &&
    PRODUCT_QUERY_OPERATIONAL_OBSERVABILITY.phase === "DATA-AI24" &&
    PRODUCT_QUERY_OPERATIONAL_OBSERVABILITY.persistence === "none" &&
    PRODUCT_QUERY_OPERATIONAL_OBSERVABILITY.oneCanonicalObservationPerEligibleRequest === true,
  "DATA-AI24 observability contract must be frozen and non-persistent"
);

for (const field of [
  "rawQuery",
  "normalizedQuery",
  "userIdentity",
  "accountHash",
  "email",
  "ipAddress",
  "userAgent",
  "fingerprint",
  "sessionIdentity",
  "skinOrPreferenceValues",
  "providerPayload",
  "recommendationResultIdentity",
  "profileOrHistorySnapshot",
  "crossRequestCorrelationIdentity",
  "clickOrCtrAnalytics",
  "cohortExpansion",
  "publicCutover",
  "rankingAuthorityChange",
  "scoringChange",
  "providerOrModelChange"
]) {
  check(
    PRODUCT_QUERY_OPERATIONAL_OBSERVABILITY[field] === false,
    `forbidden DATA-AI24 authority/data field must stay false: ${field}`
  );
}

check(
  bucketProductQueryLatency(0) === "lt_1s" &&
    bucketProductQueryLatency(999) === "lt_1s" &&
    bucketProductQueryLatency(1000) === "1_3s" &&
    bucketProductQueryLatency(2999) === "1_3s" &&
    bucketProductQueryLatency(3000) === "3_5s" &&
    bucketProductQueryLatency(5000) === "5_8s" &&
    bucketProductQueryLatency(8000) === "gte_8s" &&
    bucketProductQueryLatency(-1) === "unknown",
  "latency buckets must be bounded"
);

check(
  bucketProductQueryCount(0) === "0" &&
    bucketProductQueryCount(1) === "1_2" &&
    bucketProductQueryCount(2) === "1_2" &&
    bucketProductQueryCount(3) === "3_5" &&
    bucketProductQueryCount(5) === "3_5" &&
    bucketProductQueryCount(6) === "6_plus" &&
    bucketProductQueryCount(-1) === "unknown",
  "count buckets must be bounded"
);

check(
  classifyProductQueryOperationalOutcome({
    status: "ranked",
    constraintStatus: "resolved",
    resultCount: 5
  }) === "success" &&
    classifyProductQueryOperationalOutcome({
      status: "ranked",
      constraintStatus: "partial",
      resultCount: 3
    }) === "partial" &&
    classifyProductQueryOperationalOutcome({
      status: "no_safe_candidates",
      constraintStatus: "resolved",
      resultCount: 0
    }) === "no_result" &&
    classifyProductQueryOperationalOutcome({
      status: "insufficient_supported_intent",
      constraintStatus: "partial",
      resultCount: 0
    }) === "insufficient_intent",
  "runtime outcomes must map only from bounded execution state"
);

const malicious = createProductQueryOperationalObservation({
  outcome: "success",
  confidence: "high",
  constraintStatus: "resolved",
  latencyBucket: "1_3s",
  providerLatencyBucket: "1_3s",
  recommendationLatencyBucket: "lt_1s",
  resultCountBucket: "3_5",
  unresolvedCountBucket: "0",
  provider: "openai",
  model: "gpt-5.6-luna",
  providerSucceeded: true,
  fallbackUsed: false,
  deploymentSha: "ABCDEF0123456789ABCDEF0123456789ABCDEF01",
  rawQuery: "test@example.com Bearer secret sk-supersecret",
  normalizedQuery: "oily sensitive sunscreen",
  userId: "user-123",
  accountHash: "deadbeef",
  ip: "127.0.0.1",
  productIds: ["product-1"],
  results: [{ id: "product-1", name: "secret product" }],
  providerResponse: { output_text: "secret" },
  profile: { skinType: "oily" }
});

check(
  Object.keys(malicious).sort().join(",") === [
    "confidence",
    "constraintStatus",
    "deploymentSha",
    "diagnosticVersion",
    "fallbackUsed",
    "latencyBucket",
    "model",
    "outcome",
    "provider",
    "providerLatencyBucket",
    "providerSucceeded",
    "recommendationLatencyBucket",
    "resultCountBucket",
    "unresolvedCountBucket"
  ].sort().join(","),
  "observation builder must expose only the fixed privacy-safe schema"
);

check(
  malicious.deploymentSha === "abcdef0123456789abcdef0123456789abcdef01",
  "deployment SHA must be normalized only after strict validation"
);

const sinkEvents = [];
const sink = {
  info(prefix, payload) {
    sinkEvents.push({ prefix, payload });
  }
};

const emitted = writeProductQueryOperationalObservation({
  ...malicious,
  rawQuery: "test@example.com Bearer abc sk-123456789",
  userId: "user-secret",
  productName: "secret-product",
  providerResponse: "secret-response"
}, sink);

check(sinkEvents.length === 1, "one observation write must emit exactly one safe event");
check(
  emitted.event === "provider_runtime" &&
    emitted.category === "runtime_state" &&
    emitted.operation === "product_query_beta" &&
    emitted.diagnosticVersion ===
      PRODUCT_QUERY_OPERATIONAL_OBSERVABILITY_CONTRACT_VERSION &&
    emitted.outcome === "success" &&
    emitted.provider === "openai" &&
    emitted.model === "gpt-5.6-luna",
  "safe logger must preserve only the DATA-AI24 operational dimensions"
);

const serialized = JSON.stringify(emitted);
for (const forbidden of [
  "test@example.com",
  "Bearer",
  "sk-123456789",
  "user-secret",
  "secret-product",
  "secret-response",
  "rawQuery",
  "userId",
  "accountHash",
  "productIds",
  "providerResponse",
  "profile"
]) {
  check(!serialized.includes(forbidden), `safe event leaked forbidden material: ${forbidden}`);
}


const protocolCases = [
  ["PRODUCT_QUERY_AI_RESPONSE_INCOMPLETE", "incomplete", "not_applicable", "max_output_tokens"],
  ["PRODUCT_QUERY_AI_RESPONSE_INVALID", "invalid_output", "not_applicable", "not_applicable"],
  ["PRODUCT_QUERY_AI_REFUSED", "refusal", "not_applicable", "not_applicable"],
  ["PRODUCT_QUERY_AI_SCHEMA_REJECTED", "schema_rejected", "invalid_dimension", "not_applicable"]
];

for (const [code, expectedKind, expectedReason, expectedIncompleteReason] of protocolCases) {
  const error = {
    code,
    incompleteReason:
      code === "PRODUCT_QUERY_AI_RESPONSE_INCOMPLETE"
        ? "max_output_tokens"
        : undefined,
    details:
      code === "PRODUCT_QUERY_AI_SCHEMA_REJECTED"
        ? ["preferred_finish_invalid"]
        : ["raw schema details must never be logged"]
  };
  const classified = classifyProductQueryProviderProtocolFailure(error);
  check(
    classified?.protocolFailureKind === expectedKind &&
      classified?.schemaFailureReason === expectedReason &&
      classified?.incompleteReason === expectedIncompleteReason,
    `protocol failure classification must stay bounded: ${code}`
  );
}

check(
  classifyProductQueryProviderProtocolFailure({
    code: "PRODUCT_QUERY_AI_REQUEST_FAILED"
  }) === null,
  "transport/provider availability failures must not be mislabeled as protocol failures"
);

const protocolSinkEvents = [];
const protocolSink = {
  info(prefix, payload) {
    protocolSinkEvents.push({ prefix, payload });
  }
};
const protocolDiagnostic = writeProductQueryProviderProtocolDiagnostic(
  {
    code: "PRODUCT_QUERY_AI_SCHEMA_REJECTED",
    details: ["intent_keys_mismatch"],
    rawQuery: "private user query",
    providerResponse: "private provider payload",
    userId: "private-user"
  },
  protocolSink
);
check(
  protocolSinkEvents.length === 1 &&
    protocolDiagnostic.event === "product_query_provider_protocol_failed" &&
    protocolDiagnostic.category === "response_shape_invalid" &&
    protocolDiagnostic.operation === "product_query_beta" &&
    protocolDiagnostic.dependency === "provider" &&
    protocolDiagnostic.status === 502 &&
    protocolDiagnostic.protocolFailureKind === "schema_rejected" &&
    protocolDiagnostic.schemaFailureReason === "keys_mismatch" &&
    protocolDiagnostic.incompleteReason === "not_applicable",
  "protocol diagnostic must emit only the bounded provider failure classification"
);

const protocolSerialized = JSON.stringify(protocolDiagnostic);
for (const forbidden of [
  "private user query",
  "private provider payload",
  "private-user",
  "rawQuery",
  "providerResponse",
  "userId",
  "intent_keys_mismatch"
]) {
  check(
    !protocolSerialized.includes(forbidden),
    `protocol diagnostic leaked forbidden material: ${forbidden}`
  );
}

check(
  writeProductQueryProviderProtocolDiagnostic(
    { code: "PRODUCT_QUERY_AI_REQUEST_FAILED" },
    protocolSink
  ) === null,
  "non-protocol failures must not emit the protocol diagnostic event"
);

const incompleteDiagnostic = writeProductQueryProviderProtocolDiagnostic(
  {
    code: "PRODUCT_QUERY_AI_RESPONSE_INCOMPLETE",
    incompleteReason: "max_output_tokens",
    providerResponse: "must not leak"
  },
  protocolSink
);
check(
  incompleteDiagnostic.protocolFailureKind === "incomplete" &&
    incompleteDiagnostic.incompleteReason === "max_output_tokens" &&
    !JSON.stringify(incompleteDiagnostic).includes("must not leak"),
  "incomplete provider diagnostics must expose only the bounded incomplete reason"
);

const route = readFileSync("app/api/my/product-query-beta/route.js", "utf8");
check(
  route.includes("let observationWritten = false") &&
    route.includes("if (observationWritten) return;") &&
    route.includes("writeProductQueryOperationalObservation") &&
    route.includes("VERCEL_GIT_COMMIT_SHA"),
  "eligible beta route must enforce at most one canonical observation"
);
check(
  route.indexOf("if (!runtimePolicy.allowed) return notFound();") <
    route.indexOf("const observationStartedAt = Date.now();"),
  "ineligible requests must remain outside Product Query operational observation scope"
);
check(
  route.includes("onOperationalObservation(observation)") &&
    route.includes("classifyProductQueryOperationalOutcome") &&
    route.includes('outcome: "invalid_request"') &&
    route.includes('"provider_error"') &&
    route.includes("writeProductQueryProviderProtocolDiagnostic(error)"),
  "route must classify success/invalid/provider failure paths and emit bounded protocol diagnostics"
);

const shadow = readFileSync("lib/server/product-query-shadow-service.js", "utf8");
check(
  shadow.includes("providerLatencyMs") &&
    shadow.includes("recommendationLatencyMs") &&
    shadow.includes("onOperationalObservation") &&
    shadow.includes("Operational observability must never alter Product Query behavior."),
  "runtime timing capture must be bounded and non-blocking"
);

const redaction = readFileSync("lib/security/error-redaction.js", "utf8");
check(
  redaction.includes('"product_query_beta"') &&
    redaction.includes("OPENAI_RUNTIME_MODELS") &&
    redaction.includes("PRODUCT_QUERY_OBSERVABILITY_VERSION") &&
    redaction.includes("PRODUCT_QUERY_OUTCOME_SET") &&
    redaction.includes("PRODUCT_QUERY_LATENCY_BUCKET_SET") &&
    redaction.includes("PRODUCT_QUERY_COUNT_BUCKET_SET") &&
    redaction.includes("PRODUCT_QUERY_PROTOCOL_FAILURE_KIND_SET") &&
    redaction.includes("PRODUCT_QUERY_SCHEMA_FAILURE_REASON_SET") &&
    redaction.includes("PRODUCT_QUERY_INCOMPLETE_REASON_SET"),
  "central safe logger must explicitly allowlist DATA-AI24 dimensions and protocol diagnostic enums"
);

for (const forbiddenSource of [
  "query: readValue(input",
  "rawQuery: readValue(input",
  "userId: readValue(input",
  "accountHash: readValue(input",
  "productId: readValue(input",
  "productName: readValue(input"
]) {
  check(
    !redaction.includes(forbiddenSource),
    `central safe logger must not accept forbidden Product Query field: ${forbiddenSource}`
  );
}

console.log(
  `DATA-AI24 privacy-safe operational observability verifier: PASS (${assertions} assertions)`
);
