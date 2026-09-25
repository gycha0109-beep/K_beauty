import {
  PRODUCT_QUERY_BETA_OPERATIONAL_READINESS_CONTRACT_VERSION,
  DATA_AI25_EXPECTED_MODEL,
  DATA_AI25_EXPECTED_PROVIDER
} from "./product-query-beta-operational-readiness-contract.mjs";

const EXPECTED_DIAGNOSTIC_VERSION = "product-query-beta-observability-v1";
const ALLOWED_OUTCOMES = Object.freeze([
  "success",
  "partial",
  "no_result",
  "insufficient_intent",
  "provider_error",
  "runtime_error",
  "invalid_request"
]);
const ALLOWED_CONFIDENCE = Object.freeze(["high", "medium", "low", "unknown"]);
const ALLOWED_CONSTRAINT_STATUS = Object.freeze([
  "resolved",
  "partial",
  "unknown"
]);
const ALLOWED_LATENCY_BUCKETS = Object.freeze([
  "lt_1s",
  "1_3s",
  "3_5s",
  "5_8s",
  "gte_8s",
  "unknown"
]);
const ALLOWED_COUNT_BUCKETS = Object.freeze([
  "0",
  "1_2",
  "3_5",
  "6_plus",
  "unknown"
]);
const ALLOWED_EVENT_KEYS = new Set([
  "timestamp",
  "event",
  "category",
  "operation",
  "dependency",
  "environment",
  "provider",
  "model",
  "diagnosticVersion",
  "outcome",
  "confidence",
  "constraintStatus",
  "latencyBucket",
  "providerLatencyBucket",
  "recommendationLatencyBucket",
  "resultCountBucket",
  "unresolvedCountBucket",
  "providerSucceeded",
  "fallbackUsed",
  "deploymentSha"
]);
const SHA_PATTERN = /^[0-9a-f]{40}$/i;

function createCounter(values) {
  return Object.fromEntries(values.map((value) => [value, 0]));
}

function rate(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : null;
}

function isAllowed(value, allowed) {
  return typeof value === "string" && allowed.includes(value);
}

function isCandidateObservation(event) {
  return (
    event &&
    typeof event === "object" &&
    !Array.isArray(event) &&
    event.operation === "product_query_beta"
  );
}

function validateObservation(event) {
  const unexpectedKeys = Object.keys(event).filter(
    (key) => !ALLOWED_EVENT_KEYS.has(key)
  );
  if (unexpectedKeys.length > 0) {
    return Object.freeze({ valid: false, reason: "unexpected_field" });
  }

  if (
    event.event !== "provider_runtime" ||
    event.category !== "runtime_state" ||
    event.operation !== "product_query_beta" ||
    event.environment !== "production" ||
    event.diagnosticVersion !== EXPECTED_DIAGNOSTIC_VERSION
  ) {
    return Object.freeze({ valid: false, reason: "contract_mismatch" });
  }

  if (
    !isAllowed(event.outcome, ALLOWED_OUTCOMES) ||
    !isAllowed(event.confidence, ALLOWED_CONFIDENCE) ||
    !isAllowed(event.constraintStatus, ALLOWED_CONSTRAINT_STATUS) ||
    !isAllowed(event.latencyBucket, ALLOWED_LATENCY_BUCKETS) ||
    !isAllowed(event.providerLatencyBucket, ALLOWED_LATENCY_BUCKETS) ||
    !isAllowed(event.recommendationLatencyBucket, ALLOWED_LATENCY_BUCKETS) ||
    !isAllowed(event.resultCountBucket, ALLOWED_COUNT_BUCKETS) ||
    !isAllowed(event.unresolvedCountBucket, ALLOWED_COUNT_BUCKETS) ||
    typeof event.providerSucceeded !== "boolean" ||
    typeof event.fallbackUsed !== "boolean" ||
    (event.providerSucceeded === true &&
      (typeof event.provider !== "string" || typeof event.model !== "string"))
  ) {
    return Object.freeze({ valid: false, reason: "invalid_dimension" });
  }

  if (
    event.deploymentSha !== null &&
    event.deploymentSha !== undefined &&
    (typeof event.deploymentSha !== "string" ||
      !SHA_PATTERN.test(event.deploymentSha))
  ) {
    return Object.freeze({ valid: false, reason: "invalid_deployment_sha" });
  }

  return Object.freeze({ valid: true, reason: null });
}

export function aggregateProductQueryOperationalBaseline(events = []) {
  if (!Array.isArray(events)) {
    throw new TypeError("DATA-AI25 baseline input must be an array");
  }

  const outcomes = createCounter(ALLOWED_OUTCOMES);
  const confidence = createCounter(ALLOWED_CONFIDENCE);
  const latency = createCounter(ALLOWED_LATENCY_BUCKETS);
  const providerLatency = createCounter(ALLOWED_LATENCY_BUCKETS);
  const recommendationLatency = createCounter(ALLOWED_LATENCY_BUCKETS);
  const resultCount = createCounter(ALLOWED_COUNT_BUCKETS);
  const unresolvedCount = createCounter(ALLOWED_COUNT_BUCKETS);
  const deploymentShas = new Set();

  let candidateObservationCount = 0;
  let validObservationCount = 0;
  let telemetryContractViolationCount = 0;
  let validRuntimeObservationCount = 0;
  let runtimeSuccessCount = 0;
  let fallbackCount = 0;
  let providerModelDriftCount = 0;

  for (const event of events) {
    if (!isCandidateObservation(event)) continue;
    candidateObservationCount += 1;

    const validation = validateObservation(event);
    if (!validation.valid) {
      telemetryContractViolationCount += 1;
      continue;
    }

    validObservationCount += 1;
    outcomes[event.outcome] += 1;
    confidence[event.confidence] += 1;
    latency[event.latencyBucket] += 1;
    providerLatency[event.providerLatencyBucket] += 1;
    recommendationLatency[event.recommendationLatencyBucket] += 1;
    resultCount[event.resultCountBucket] += 1;
    unresolvedCount[event.unresolvedCountBucket] += 1;

    if (event.deploymentSha) deploymentShas.add(event.deploymentSha.toLowerCase());

    if (event.outcome === "invalid_request") continue;

    validRuntimeObservationCount += 1;
    if (
      event.providerSucceeded === true &&
      event.outcome !== "provider_error" &&
      event.outcome !== "runtime_error"
    ) {
      runtimeSuccessCount += 1;
    }
    if (event.fallbackUsed === true) fallbackCount += 1;

    if (
      event.providerSucceeded === true &&
      (event.provider !== DATA_AI25_EXPECTED_PROVIDER ||
        event.model !== DATA_AI25_EXPECTED_MODEL)
    ) {
      providerModelDriftCount += 1;
    }
  }

  const successLikeCount =
    outcomes.success +
    outcomes.partial +
    outcomes.no_result +
    outcomes.insufficient_intent;

  return Object.freeze({
    baselineVersion: PRODUCT_QUERY_BETA_OPERATIONAL_READINESS_CONTRACT_VERSION,
    sourceDiagnosticVersion: EXPECTED_DIAGNOSTIC_VERSION,
    candidateObservationCount,
    validObservationCount,
    telemetryContractViolationCount,
    validRuntimeObservationCount,
    runtimeSuccessCount,
    runtimeSuccessRate: rate(runtimeSuccessCount, validRuntimeObservationCount),
    fallbackCount,
    fallbackRate: rate(fallbackCount, validRuntimeObservationCount),
    providerModelDriftCount,
    successLikeCount,
    outcomeDistribution: Object.freeze(outcomes),
    confidenceDistribution: Object.freeze(confidence),
    latencyBucketDistribution: Object.freeze(latency),
    providerLatencyBucketDistribution: Object.freeze(providerLatency),
    recommendationLatencyBucketDistribution: Object.freeze(
      recommendationLatency
    ),
    resultCountBucketDistribution: Object.freeze(resultCount),
    unresolvedCountBucketDistribution: Object.freeze(unresolvedCount),
    baselineRates: Object.freeze({
      zeroResultRate: rate(outcomes.no_result, validRuntimeObservationCount),
      partialRate: rate(outcomes.partial, validRuntimeObservationCount),
      lowConfidenceRate: rate(confidence.low, validObservationCount),
      insufficientIntentRate: rate(
        outcomes.insufficient_intent,
        validRuntimeObservationCount
      ),
      slowRate: rate(
        latency["5_8s"] + latency.gte_8s,
        validObservationCount
      ),
      verySlowRate: rate(latency.gte_8s, validObservationCount)
    }),
    deploymentShas: Object.freeze(Array.from(deploymentShas).sort()),
    rawEventsPersisted: false,
    userIdentityPresent: false,
    queryContentPresent: false,
    productIdentityPresent: false
  });
}
