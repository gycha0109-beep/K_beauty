#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PRODUCT_QUERY_PROVIDER_RETRY_POLICY,
  executeBoundedProductQueryProviderRetry,
  isRetryableProductQueryIncomplete
} from "../lib/product-query-provider-retry-policy.mjs";

let assertions = 0;
function check(condition, message) {
  assert.ok(condition, message);
  assertions += 1;
}

function providerError(code, incompleteReason) {
  const error = new Error(code);
  error.code = code;
  if (incompleteReason) error.incompleteReason = incompleteReason;
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

let attempts = 0;
const recovered = await executeBoundedProductQueryProviderRetry(async () => {
  attempts += 1;
  if (attempts === 1) {
    throw providerError(
      "PRODUCT_QUERY_AI_RESPONSE_INCOMPLETE",
      "max_output_tokens"
    );
  }
  return "ok";
});
check(
  recovered.value === "ok" &&
    recovered.providerAttempts === 2 &&
    recovered.providerRetryUsed === true &&
    attempts === 2,
  "one transient incomplete must recover with exactly one retry"
);

for (const code of [
  "PRODUCT_QUERY_AI_RESPONSE_INVALID",
  "PRODUCT_QUERY_AI_REFUSED",
  "PRODUCT_QUERY_AI_SCHEMA_REJECTED",
  "PRODUCT_QUERY_AI_REQUEST_FAILED",
  "PRODUCT_QUERY_AI_TIMEOUT"
]) {
  let count = 0;
  await assert.rejects(
    executeBoundedProductQueryProviderRetry(async () => {
      count += 1;
      throw providerError(code);
    }),
    (error) => error.code === code && error.providerAttempts === 1
  );
  check(count === 1, `non-incomplete failure must not retry: ${code}`);
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

let doubleIncompleteAttempts = 0;
await assert.rejects(
  executeBoundedProductQueryProviderRetry(async () => {
    doubleIncompleteAttempts += 1;
    throw providerError(
      "PRODUCT_QUERY_AI_RESPONSE_INCOMPLETE",
      "unknown"
    );
  }),
  (error) =>
    error.code === "PRODUCT_QUERY_AI_RESPONSE_INCOMPLETE" &&
    error.providerAttempts === 2
);
check(
  doubleIncompleteAttempts === 2,
  "second incomplete must fail closed after exactly two provider attempts"
);

let clock = 0;
const timeoutBudgets = [];
const deadlineRecovered = await executeBoundedProductQueryProviderRetry(
  async ({ attempt, attemptTimeoutMs }) => {
    timeoutBudgets.push(attemptTimeoutMs);
    if (attempt === 1) {
      clock = 7000;
      throw providerError(
        "PRODUCT_QUERY_AI_RESPONSE_INCOMPLETE",
        "other"
      );
    }
    return "bounded";
  },
  { now: () => clock }
);
check(
  deadlineRecovered.providerAttempts === 2 &&
    timeoutBudgets[0] === 8000 &&
    timeoutBudgets[1] === 7000,
  "retry timeout must shrink to the remaining total deadline"
);

let insufficientClock = 0;
let insufficientAttempts = 0;
await assert.rejects(
  executeBoundedProductQueryProviderRetry(
    async () => {
      insufficientAttempts += 1;
      insufficientClock = 13500;
      throw providerError(
        "PRODUCT_QUERY_AI_RESPONSE_INCOMPLETE",
        "unknown"
      );
    },
    { now: () => insufficientClock }
  ),
  (error) =>
    error.code === "PRODUCT_QUERY_AI_RESPONSE_INCOMPLETE" &&
    error.providerAttempts === 1
);
check(
  insufficientAttempts === 1,
  "retry must not start when less than the minimum deadline budget remains"
);

const service = readFileSync(
  "lib/server/product-query-intent-service.js",
  "utf8"
);
const providerShadow = readFileSync(
  "lib/server/product-query-provider-shadow-service.js",
  "utf8"
);

check(
  service.includes("executeBoundedProductQueryProviderRetry") &&
    service.includes("const DEFAULT_MAX_OUTPUT_TOKENS = 600;") &&
    service.includes("providerAttempts: providerResult.providerAttempts") &&
    service.includes("providerRetryUsed: providerResult.providerRetryUsed"),
  "production intent extraction must use bounded retry while preserving the 600-token budget"
);

check(
  providerShadow.includes("incompleteRetry:") &&
    providerShadow.includes("? false") &&
    providerShadow.includes("providerAttempts: Number(shadow.providerAttempts || 1)") &&
    providerShadow.includes("providerRetryUsed: shadow.providerRetryUsed === true"),
  "fixed explicit-budget probes must stay single-attempt while default-path probes expose retry evidence"
);

console.log(
  `DATA-AI28E bounded incomplete retry verifier: PASS (${assertions} assertions)`
);
