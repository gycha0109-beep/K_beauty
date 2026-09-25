import { writeSafeLog } from "./security/error-redaction.js";

export const PRODUCT_QUERY_OPERATIONAL_OBSERVABILITY_CONTRACT_VERSION =
  "product-query-beta-observability-v1";

export const PRODUCT_QUERY_OPERATIONAL_OBSERVABILITY = Object.freeze({
  phase: "DATA-AI24",
  contractVersion: PRODUCT_QUERY_OPERATIONAL_OBSERVABILITY_CONTRACT_VERSION,
  scope: "eligible_authenticated_beta_requests_only",
  persistence: "none",
  oneCanonicalObservationPerEligibleRequest: true,
  rawQuery: false,
  normalizedQuery: false,
  userIdentity: false,
  accountHash: false,
  email: false,
  ipAddress: false,
  userAgent: false,
  fingerprint: false,
  sessionIdentity: false,
  skinOrPreferenceValues: false,
  providerPayload: false,
  recommendationResultIdentity: false,
  profileOrHistorySnapshot: false,
  crossRequestCorrelationIdentity: false,
  clickOrCtrAnalytics: false,
  cohortExpansion: false,
  publicCutover: false,
  rankingAuthorityChange: false,
  scoringChange: false,
  providerOrModelChange: false
});

const OUTCOMES = new Set([
  "success",
  "partial",
  "no_result",
  "insufficient_intent",
  "provider_error",
  "runtime_error",
  "invalid_request"
]);
const CONFIDENCE = new Set(["high", "medium", "low", "unknown"]);
const CONSTRAINT_STATUS = new Set(["resolved", "partial", "unknown"]);
const LATENCY_BUCKETS = new Set([
  "lt_1s",
  "1_3s",
  "3_5s",
  "5_8s",
  "gte_8s",
  "unknown"
]);
const COUNT_BUCKETS = new Set(["0", "1_2", "3_5", "6_plus", "unknown"]);
const SAFE_PROVIDERS = new Set(["openai", "provider", "unknown"]);
const SAFE_MODELS = new Set(["gpt-5.6-luna", "unknown"]);
const SHA_PATTERN = /^[0-9a-f]{40}$/i;

function allow(value, allowed, fallback) {
  return typeof value === "string" && allowed.has(value) ? value : fallback;
}

export function bucketProductQueryLatency(value) {
  if (!Number.isFinite(value) || value < 0) return "unknown";
  if (value < 1000) return "lt_1s";
  if (value < 3000) return "1_3s";
  if (value < 5000) return "3_5s";
  if (value < 8000) return "5_8s";
  return "gte_8s";
}

export function bucketProductQueryCount(value) {
  if (!Number.isInteger(value) || value < 0) return "unknown";
  if (value === 0) return "0";
  if (value <= 2) return "1_2";
  if (value <= 5) return "3_5";
  return "6_plus";
}

export function classifyProductQueryOperationalOutcome({
  status,
  constraintStatus,
  resultCount
} = {}) {
  if (status === "ranked") {
    if (constraintStatus === "partial") return "partial";
    return Number.isInteger(resultCount) && resultCount > 0 ? "success" : "no_result";
  }
  if (status === "insufficient_supported_intent") return "insufficient_intent";
  if (status === "no_candidates" || status === "no_safe_candidates") return "no_result";
  return "runtime_error";
}

export function createProductQueryOperationalObservation(input = {}) {
  const deploymentSha =
    typeof input.deploymentSha === "string" && SHA_PATTERN.test(input.deploymentSha)
      ? input.deploymentSha.toLowerCase()
      : null;

  return Object.freeze({
    diagnosticVersion: PRODUCT_QUERY_OPERATIONAL_OBSERVABILITY_CONTRACT_VERSION,
    outcome: allow(input.outcome, OUTCOMES, "runtime_error"),
    confidence: allow(input.confidence, CONFIDENCE, "unknown"),
    constraintStatus: allow(
      input.constraintStatus,
      CONSTRAINT_STATUS,
      "unknown"
    ),
    latencyBucket: allow(input.latencyBucket, LATENCY_BUCKETS, "unknown"),
    providerLatencyBucket: allow(
      input.providerLatencyBucket,
      LATENCY_BUCKETS,
      "unknown"
    ),
    recommendationLatencyBucket: allow(
      input.recommendationLatencyBucket,
      LATENCY_BUCKETS,
      "unknown"
    ),
    resultCountBucket: allow(
      input.resultCountBucket,
      COUNT_BUCKETS,
      "unknown"
    ),
    unresolvedCountBucket: allow(
      input.unresolvedCountBucket,
      COUNT_BUCKETS,
      "unknown"
    ),
    provider: allow(input.provider, SAFE_PROVIDERS, "unknown"),
    model: allow(input.model, SAFE_MODELS, "unknown"),
    providerSucceeded: input.providerSucceeded === true,
    fallbackUsed: input.fallbackUsed === true,
    deploymentSha
  });
}

export function writeProductQueryOperationalObservation(input, sink = console) {
  const observation = createProductQueryOperationalObservation(input);
  return writeSafeLog("info", {
    event: "provider_runtime",
    category: "runtime_state",
    operation: "product_query_beta",
    dependency: "application",
    environment:
      process.env.VERCEL_ENV === "production"
        ? "production"
        : process.env.VERCEL_ENV === "preview"
          ? "preview"
          : process.env.NODE_ENV === "test"
            ? "test"
            : "development",
    provider: observation.provider === "unknown" ? "provider" : observation.provider,
    model: observation.model === "unknown" ? undefined : observation.model,
    diagnosticVersion: observation.diagnosticVersion,
    outcome: observation.outcome,
    confidence: observation.confidence,
    constraintStatus: observation.constraintStatus,
    latencyBucket: observation.latencyBucket,
    providerLatencyBucket: observation.providerLatencyBucket,
    recommendationLatencyBucket: observation.recommendationLatencyBucket,
    resultCountBucket: observation.resultCountBucket,
    unresolvedCountBucket: observation.unresolvedCountBucket,
    providerSucceeded: observation.providerSucceeded,
    fallbackUsed: observation.fallbackUsed,
    deploymentSha: observation.deploymentSha
  }, sink);
}
