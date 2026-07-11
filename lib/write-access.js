import "server-only";
const RATE_LIMIT_STORE_KEY = "__kbeautyRateLimitStore";

function getRateLimitStore() {
  if (!globalThis[RATE_LIMIT_STORE_KEY]) {
    globalThis[RATE_LIMIT_STORE_KEY] = new Map();
  }

  return globalThis[RATE_LIMIT_STORE_KEY];
}

export function getRequestClientKey(request) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();

    if (firstIp) {
      return firstIp;
    }
  }

  return request.headers.get("x-real-ip") || "local";
}

export function consumeRateLimit({ key, limit, windowMs }) {
  const store = getRateLimitStore();
  const now = Date.now();
  const entry = store.get(key) || [];
  const recentAttempts = entry.filter((timestamp) => now - timestamp < windowMs);

  if (recentAttempts.length >= limit) {
    store.set(key, recentAttempts);

    return {
      allowed: false,
      retryAfterMs: Math.max(windowMs - (now - recentAttempts[0]), 1000)
    };
  }

  recentAttempts.push(now);
  store.set(key, recentAttempts);

  return {
    allowed: true,
    retryAfterMs: 0
  };
}
