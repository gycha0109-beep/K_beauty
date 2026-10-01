#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PRODUCT_QUERY_PROVIDER_RETRY_POLICY,
  executeBoundedProductQueryProviderRetry,
  isRetryableProductQueryIncomplete,
  isRetryableProductQueryTransientFailure
} from "../lib/product-query-provider-retry-policy.mjs";

let assertions = 0;
function check(condition, message) {
  assert.ok(condition, message);
  assertions += 1;
}

function providerError(code, incompleteReason, providerHttpStatus) {
  const error = new Error(code);
  error.code = code;
  if (incompleteReason) error.incompleteReason = incompleteReason;
  if (Number.isInteger(providerHttpStatus)) {
    error.providerHttpStatus = providerHttpStatus;
  }
  return error;
}

check(
  PRODUCT_QUERY_PROVIDER_RETRY_POLICY.maxAttempts === 2 &&
    PRODUCT_QUERY_PROVIDER_RETRY_POLICY.totalDeadlineMs === 14000 &&
    PRODUCT_QUERY_PROVIDER_RETRY_POLICY.perAttemptTimeoutMs === 8000 &&
    PRODUCT_QUERY_PROVIDER_RETRY_POLICY.minimumRetryBudgetMs === 1000 &&
    PRODUCT_QUERY_PROVIDER_RETRY_POLICY.retryDelayMs === 0,
  "retry policy must stay one-retry, no-delay, and deadline bounded"
);

check(
  JSON.stringify(
    [...PRODUCT_QUERY_PROVIDER_RETRY_POLICY.retryableTransientFailureCodes].sort()
  ) ===
    JSON.stringify(
      [
        "PRODUCT_QUERY_AI_REQUEST_FAILED",
        "PRODUCT_QUERY_AI_TIMEOUT",
        "PRODUCT_QUERY_AI_TRANSIENT_PROVIDER_FAILURE"
      ].sort()
    ),
  "transient retry codes must remain explicitly bounded"
);

for (const reason of ["max_output_tokens", "other", "unknown"]) {
  check(
    isRetryableProductQueryIncomplete(
      providerError("PRODUCT_QUERY_AI_RESPONSE_INCOMPLETE", reason)
    ),
    `retryable incomplete reason must remain bounded: ${reason}`
  );
}

check(
  !isRetryableProductQueryIncomplete(
    providerError("PRODUCT_QUERY_AI_RESPONSE_INCOMPLETE", "content_filter")
  ),
  "content-filter incomplete must never retry"
);

for (const code of [
  "PRODUCT_QUERY_AI_TRANSIENT_PROVIDER_FAILURE",
  "PRODUCT_QUERY_AI_REQUEST_FAILED",
  "PRODUCT_QUERY_AI_TIMEOUT"
]) {
  check(
    isRetryableProductQueryTransientFailure(providerError(code)),
    `transient provider failure must be retryable: ${code}`
  );
}

for (const code of [
  "PRODUCT_QUERY_AI_PROVIDER_REJECTED",
  "PRODUCT_QUERY_AI_UNAVAILABLE",
  "PRODUCT_QUERY_AI_RESPONSE_INVALID",
  "PRODUCT_QUERY_AI_REFUSED",
  "PRODUCT_QUERY_AI_SCHEMA_REJECTED"
]) {
  check(
    !isRetryableProductQueryTransientFailure(providerError(code)),
    `non-transient provider failure must not retry: ${code}`
  );
}

let incompleteAttempts = 0;
const incompleteRecovered = await executeBoundedProductQueryProviderRetry(
  async () => {
    incompleteAttempts += 1;
    if (incompleteAttempts === 1) {
      throw providerError(
        "PRODUCT_QUERY_AI_RESPONSE_INCOMPLETE",
        "max_output_tokens"
      );
    }
    return "ok";
  }
);
check(
  incompleteRecovered.value === "ok" &&
    incompleteRecovered.providerAttempts === 2 &&
    incompleteRecovered.providerRetryUsed === true &&
    incompleteAttempts === 2,
  "one transient incomplete must recover with exactly one retry"
);

for (const [code, providerHttpStatus] of [
  ["PRODUCT_QUERY_AI_TRANSIENT_PROVIDER_FAILURE", 503],
  ["PRODUCT_QUERY_AI_TRANSIENT_PROVIDER_FAILURE", 429],
  ["PRODUCT_QUERY_AI_REQUEST_FAILED", undefined],
  ["PRODUCT_QUERY_AI_TIMEOUT", undefined]
]) {
  let attempts = 0;
  const recovered = await executeBoundedProductQueryProviderRetry(async () => {
    attempts += 1;
    if (attempts === 1) {
      throw providerError(code, undefined, providerHttpStatus);
    }
    return "recovered";
  });
  check(
    recovered.value === "recovered" &&
      recovered.providerAttempts === 2 &&
      recovered.providerRetryUsed === true &&
      attempts === 2,
    `transient provider failure must recover with one bounded retry: ${code}:${providerHttpStatus ?? "transport"}`
  );
}

for (const code of [
  "PRODUCT_QUERY_AI_PROVIDER_REJECTED",
  "PRODUCT_QUERY_AI_UNAVAILABLE",
  "PRODUCT_QUERY_AI_RESPONSE_INVALID",
  "PRODUCT_QUERY_AI_REFUSED",
  "PRODUCT_QUERY_AI_SCHEMA_REJECTED"
]) {
  let count = 0;
  await assert.rejects(
    executeBoundedProductQueryProviderRetry(async () => {
      count += 1;
      throw providerError(code);
    }),
    (error) => error.code === code && error.providerAttempts === 1
  );
  check(count === 1, `non-transient failure must not retry: ${code}`);
}

let contentFilterAttempts = 0;
await assert.rejects(
  executeBoundedProductQueryProviderRetry(async () => {
    contentFilterAttempts += 1;
    throw providerError(
      "PRODUCT_QUERY_AI_RESPONSE_INCOMPLETE",
      "content_filter"
    );
  }),
  (error) =>
    error.code === "PRODUCT_QUERY_AI_RESPONSE_INCOMPLETE" &&
    error.providerAttempts === 1
);
check(
  contentFilterAttempts === 1,
  "content-filter incomplete must fail closed without retry"
);

let doubleTransientAttempts = 0;
await assert.rejects(
  executeBoundedProductQueryProviderRetry(async () => {
    doubleTransientAttempts += 1;
    throw providerError("PRODUCT_QUERY_AI_TRANSIENT_PROVIDER_FAILURE", undefined, 503);
  }),
  (error) =>
    error.code === "PRODUCT_QUERY_AI_TRANSIENT_PROVIDER_FAILURE" &&
    error.providerAttempts === 2
);
check(
  doubleTransientAttempts === 2,
  "second transient provider failure must fail closed after exactly two attempts"
);

let transientDisabledAttempts = 0;
await assert.rejects(
  executeBoundedProductQueryProviderRetry(
    async () => {
      transientDisabledAttempts += 1;
      throw providerError("PRODUCT_QUERY_AI_TRANSIENT_PROVIDER_FAILURE", undefined, 503);
    },
    { retryTransientEnabled: false }
  ),
  (error) =>
    error.code === "PRODUCT_QUERY_AI_TRANSIENT_PROVIDER_FAILURE" &&
    error.providerAttempts === 1
);
check(
  transientDisabledAttempts === 1,
  "transient retry can be explicitly disabled without changing incomplete policy"
);

let incompleteDisabledAttempts = 0;
await assert.rejects(
  executeBoundedProductQueryProviderRetry(
    async () => {
      incompleteDisabledAttempts += 1;
      throw providerError("PRODUCT_QUERY_AI_RESPONSE_INCOMPLETE", "other");
    },
    { retryIncompleteEnabled: false }
  ),
  (error) =>
    error.code === "PRODUCT_QUERY_AI_RESPONSE_INCOMPLETE" &&
    error.providerAttempts === 1
);
check(
  incompleteDisabledAttempts === 1,
  "incomplete retry can be disabled independently from transient retry"
);

let clock = 0;
const timeoutBudgets = [];
const deadlineRecovered = await executeBoundedProductQueryProviderRetry(
  async ({ attempt, attemptTimeoutMs }) => {
    timeoutBudgets.push(attemptTimeoutMs);
    if (attempt === 1) {
      clock = 7000;
      throw providerError("PRODUCT_QUERY_AI_TRANSIENT_PROVIDER_FAILURE", undefined, 503);
    }
    return "bounded";
  },
  { now: () => clock }
);
check(
  deadlineRecovered.providerAttempts === 2 &&
    timeoutBudgets[0] === 8000 &&
    timeoutBudgets[1] === 7000,
  "transient retry timeout must shrink to the remaining total deadline"
);

let insufficientClock = 0;
let insufficientAttempts = 0;
await assert.rejects(
  executeBoundedProductQueryProviderRetry(
    async () => {
      insufficientAttempts += 1;
      insufficientClock = 13500;
      throw providerError("PRODUCT_QUERY_AI_TRANSIENT_PROVIDER_FAILURE", undefined, 503);
    },
    { now: () => insufficientClock }
  ),
  (error) =>
    error.code === "PRODUCT_QUERY_AI_TRANSIENT_PROVIDER_FAILURE" &&
    error.providerAttempts === 1
);
check(
  insufficientAttempts === 1,
  "transient retry must not start when less than minimum deadline budget remains"
);

const service = readFileSync(
  "lib/server/product-query-intent-service.js",
  "utf8"
);
const providerShadow = readFileSync(
  "lib/server/product-query-provider-shadow-service.js",
  "utf8"
);
const workflow = readFileSync(
  ".github/workflows/data-ai4-provider-shadow.yml",
  "utf8"
);
const classifier = readFileSync(
  "scripts/classify-data-ai28-output-budget-probe.mjs",
  "utf8"
);

check(
  service.includes("executeBoundedProductQueryProviderRetry") &&
    service.includes("const DEFAULT_MAX_OUTPUT_TOKENS = 600;") &&
    service.includes("RETRYABLE_PROVIDER_HTTP_STATUSES") &&
    service.includes("PRODUCT_QUERY_AI_TRANSIENT_PROVIDER_FAILURE") &&
    service.includes("PRODUCT_QUERY_AI_PROVIDER_REJECTED") &&
    service.includes("retryIncompleteEnabled") &&
    service.includes("retryTransientEnabled") &&
    service.includes("providerAttempts: providerResult.providerAttempts") &&
    service.includes("providerRetryUsed: providerResult.providerRetryUsed"),
  "production intent extraction must classify and bounded-retry transient provider failures"
);

check(
  providerShadow.includes("incompleteRetry:") &&
    providerShadow.includes("? false") &&
    providerShadow.includes("providerAttempts: Number(shadow.providerAttempts || 1)") &&
    providerShadow.includes("providerRetryUsed: shadow.providerRetryUsed === true"),
  "fixed explicit-budget probes must disable incomplete retry only while preserving provider evidence"
);

check(
  classifier.includes('"transient_exhausted"') &&
    classifier.includes('"nonretryable_provider_failure"') &&
    classifier.includes("payload.providerAttempts !== 2"),
  "runtime classifier must distinguish exhausted bounded transient failures from nonretryable failures"
);

check(
  workflow.includes('transient_exhausted=0') &&
    workflow.includes('nonretryable_provider_failure=0') &&
    workflow.includes('test "$completed" -ge 18') &&
    workflow.includes('test "$transient_exhausted" -le 2') &&
    workflow.includes('test "$other_failure" -eq 0'),
  "provider shadow gate must tolerate at most two exhausted transients while hard-failing contract failures"
);

console.log(
  `DATA-AI28E-R1 bounded provider retry verifier: PASS (${assertions} assertions)`
);
