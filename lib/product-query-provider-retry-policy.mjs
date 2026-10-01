export const PRODUCT_QUERY_PROVIDER_RETRY_POLICY = Object.freeze({
  maxAttempts: 2,
  totalDeadlineMs: 14000,
  perAttemptTimeoutMs: 8000,
  minimumRetryBudgetMs: 1000,
  retryableIncompleteReasons: Object.freeze([
    "max_output_tokens",
    "other",
    "unknown"
  ]),
  retryableTransientFailureCodes: Object.freeze([
    "PRODUCT_QUERY_AI_TRANSIENT_PROVIDER_FAILURE",
    "PRODUCT_QUERY_AI_REQUEST_FAILED",
    "PRODUCT_QUERY_AI_TIMEOUT"
  ]),
  retryDelayMs: 0
});

const RETRYABLE_INCOMPLETE_REASONS = new Set(
  PRODUCT_QUERY_PROVIDER_RETRY_POLICY.retryableIncompleteReasons
);
const RETRYABLE_TRANSIENT_FAILURE_CODES = new Set(
  PRODUCT_QUERY_PROVIDER_RETRY_POLICY.retryableTransientFailureCodes
);

export function isRetryableProductQueryIncomplete(error) {
  return (
    error?.code === "PRODUCT_QUERY_AI_RESPONSE_INCOMPLETE" &&
    RETRYABLE_INCOMPLETE_REASONS.has(error?.incompleteReason || "unknown")
  );
}

export function isRetryableProductQueryTransientFailure(error) {
  return RETRYABLE_TRANSIENT_FAILURE_CODES.has(error?.code || "");
}

export async function executeBoundedProductQueryProviderRetry(
  operation,
  options = {}
) {
  if (typeof operation !== "function") {
    throw new TypeError("operation must be a function");
  }

  const now = typeof options.now === "function" ? options.now : Date.now;
  const maxAttempts = PRODUCT_QUERY_PROVIDER_RETRY_POLICY.maxAttempts;
  const totalDeadlineMs = PRODUCT_QUERY_PROVIDER_RETRY_POLICY.totalDeadlineMs;
  const perAttemptTimeoutMs =
    PRODUCT_QUERY_PROVIDER_RETRY_POLICY.perAttemptTimeoutMs;
  const minimumRetryBudgetMs =
    PRODUCT_QUERY_PROVIDER_RETRY_POLICY.minimumRetryBudgetMs;
  const retryGloballyEnabled = options.retryEnabled !== false;
  const retryIncompleteEnabled =
    retryGloballyEnabled && options.retryIncompleteEnabled !== false;
  const retryTransientEnabled =
    retryGloballyEnabled && options.retryTransientEnabled !== false;
  const startedAt = now();

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const elapsedMs = Math.max(0, now() - startedAt);
    const remainingMs = Math.max(0, totalDeadlineMs - elapsedMs);

    if (remainingMs <= 0) {
      const error = new Error("PRODUCT_QUERY_AI_TIMEOUT");
      error.code = "PRODUCT_QUERY_AI_TIMEOUT";
      error.providerAttempts = attempt - 1;
      throw error;
    }

    const attemptTimeoutMs = Math.min(perAttemptTimeoutMs, remainingMs);

    try {
      const value = await operation(
        Object.freeze({ attempt, attemptTimeoutMs, remainingMs })
      );
      return Object.freeze({
        value,
        providerAttempts: attempt,
        providerRetryUsed: attempt > 1
      });
    } catch (error) {
      error.providerAttempts = attempt;

      const retryableIncomplete =
        retryIncompleteEnabled && isRetryableProductQueryIncomplete(error);
      const retryableTransient =
        retryTransientEnabled &&
        isRetryableProductQueryTransientFailure(error);
      const retryable =
        attempt < maxAttempts && (retryableIncomplete || retryableTransient);

      if (!retryable) throw error;

      const retryElapsedMs = Math.max(0, now() - startedAt);
      const retryRemainingMs = Math.max(0, totalDeadlineMs - retryElapsedMs);
      if (retryRemainingMs < minimumRetryBudgetMs) throw error;
    }
  }

  const error = new Error("PRODUCT_QUERY_AI_REQUEST_FAILED");
  error.code = "PRODUCT_QUERY_AI_REQUEST_FAILED";
  error.providerAttempts = maxAttempts;
  throw error;
}
