export const VISION_PROVIDER_MAX_ATTEMPTS =
  2;

export const VISION_PROVIDER_FALLBACK_BACKOFF_MS =
  30_000;

export const VISION_PROVIDER_MAX_BACKOFF_MS =
  60_000;

function boundedBackoffMs(
  value
) {
  const parsed =
    typeof value === "number" ||
    (
      typeof value === "string" &&
      value.trim()
    )
      ? Number(value)
      : Number.NaN;

  if (
    Number.isFinite(parsed) &&
    parsed >= 0
  ) {
    return Math.min(
      Math.ceil(parsed),
      VISION_PROVIDER_MAX_BACKOFF_MS
    );
  }

  return VISION_PROVIDER_FALLBACK_BACKOFF_MS;
}

export function isVisionProviderRateLimit(
  error
) {
  const isRateLimit =
    error?.providerStatus === 429 ||
    error?.message ===
      "provider_http_429";

  return (
    isRateLimit &&
    error?.providerRetryable !== false
  );
}

export function resolveVisionProviderBackoffMs(
  error
) {
  return boundedBackoffMs(
    error?.providerBackoffMs
  );
}

export function waitVisionProviderBackoff(
  delayMs
) {
  if (
    !Number.isFinite(delayMs) ||
    delayMs <= 0
  ) {
    return Promise.resolve();
  }

  return new Promise(
    (resolve) => {
      setTimeout(
        resolve,
        delayMs
      );
    }
  );
}

export async function executeVisionProviderWithRetry({
  run,
  waitImpl =
    waitVisionProviderBackoff
} = {}) {
  if (
    typeof run !== "function" ||
    typeof waitImpl !== "function"
  ) {
    throw new Error(
      "vision_provider_retry_dependency_invalid"
    );
  }

  let attemptCount = 0;

  while (
    attemptCount <
    VISION_PROVIDER_MAX_ATTEMPTS
  ) {
    attemptCount += 1;

    try {
      return {
        runtime:
          await run({
            attemptCount
          }),
        attemptCount
      };
    } catch (error) {
      if (
        !isVisionProviderRateLimit(
          error
        ) ||
        attemptCount >=
          VISION_PROVIDER_MAX_ATTEMPTS
      ) {
        throw error;
      }

      await waitImpl(
        resolveVisionProviderBackoffMs(
          error
        )
      );
    }
  }

  throw new Error(
    "vision_provider_retry_exhausted"
  );
}
