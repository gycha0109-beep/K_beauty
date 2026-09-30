import "server-only";

import {
  readRecommendationSunscreenProtectionAuthorities,
} from "@/lib/recommendation-sunscreen-protection-authority-reader";
import {
  RECOMMENDATION_SUNSCREEN_PROTECTION_AUTHORITY_STATUS,
} from "@/lib/recommendation-sunscreen-protection-authority-contract.mjs";

export const PROTECTION_BOUNDED_RETRY_VERSION =
  "data-ai29c-d5d-r1-protection-bounded-retry-v1";

const RETRY_DELAY_MS = 75;
const TRANSIENT_REASONS = new Set([
  "PF_PROTECTION_AUTHORITY_READ_TIMEOUT",
  "PF_PROTECTION_AUTHORITY_READ_FAILED",
]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasTransientTransportFailure(records) {
  return (Array.isArray(records) ? records : []).some((record) => {
    const authority = record?.authority;
    return (
      authority?.status ===
        RECOMMENDATION_SUNSCREEN_PROTECTION_AUTHORITY_STATUS.NONE &&
      TRANSIENT_REASONS.has(authority?.reason)
    );
  });
}

export async function readRecommendationSunscreenProtectionAuthoritiesWithBoundedRetry(
  productIds,
  options = {},
) {
  const first =
    await readRecommendationSunscreenProtectionAuthorities(
      productIds,
      options,
    );

  if (!hasTransientTransportFailure(first)) {
    return Object.freeze({
      records: first,
      attempts: 1,
      retried: false,
    });
  }

  await sleep(RETRY_DELAY_MS);
  const second =
    await readRecommendationSunscreenProtectionAuthorities(
      productIds,
      options,
    );

  return Object.freeze({
    records: second,
    attempts: 2,
    retried: true,
  });
}
