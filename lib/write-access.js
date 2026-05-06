import { createHmac, randomBytes, timingSafeEqual } from "crypto";

export const WRITE_ACCESS_HEADER = "x-kbeauty-write-token";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_WRITE_ACCESS_TTL_MS =
  process.env.NODE_ENV === "development" ? 7 * ONE_DAY_MS : ONE_DAY_MS;
const RATE_LIMIT_STORE_KEY = "__kbeautyRateLimitStore";

function getRateLimitStore() {
  if (!globalThis[RATE_LIMIT_STORE_KEY]) {
    globalThis[RATE_LIMIT_STORE_KEY] = new Map();
  }

  return globalThis[RATE_LIMIT_STORE_KEY];
}

function getWriteAccessSecret() {
  return (
    process.env.WRITE_ACCESS_TOKEN_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    (process.env.NODE_ENV === "development" ? "local-dev-write-access-secret" : null)
  );
}

function signValue(value, secret) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function createWriteAccessToken(options = {}) {
  const secret = getWriteAccessSecret();

  if (!secret) {
    return null;
  }

  const payload = {
    scope: options.scope || "analysis-write",
    exp: Date.now() + (options.ttlMs || DEFAULT_WRITE_ACCESS_TTL_MS),
    nonce: randomBytes(12).toString("base64url")
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = signValue(encodedPayload, secret);

  return `${encodedPayload}.${signature}`;
}

export function verifyWriteAccessToken(token, options = {}) {
  const secret = getWriteAccessSecret();
  const expectedScope = options.scope || "analysis-write";

  if (!secret) {
    return { ok: false, code: "misconfigured" };
  }

  if (typeof token !== "string" || !token.includes(".")) {
    return { ok: false, code: "missing" };
  }

  const [encodedPayload, signature] = token.split(".", 2);

  if (!encodedPayload || !signature) {
    return { ok: false, code: "malformed" };
  }

  const expectedSignature = signValue(encodedPayload, secret);
  const receivedBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");

  if (
    receivedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(receivedBuffer, expectedBuffer)
  ) {
    return { ok: false, code: "invalid_signature" };
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));

    if (!payload?.exp || Date.now() > payload.exp) {
      return { ok: false, code: "expired" };
    }

    if (payload.scope !== expectedScope) {
      return { ok: false, code: "invalid_scope" };
    }

    return { ok: true, payload };
  } catch {
    return { ok: false, code: "invalid_payload" };
  }
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
