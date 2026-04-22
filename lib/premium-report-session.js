import { createHmac, timingSafeEqual } from "crypto";

export const PREMIUM_REPORT_COOKIE = "kbeauty_premium_report";

const DEFAULT_PREMIUM_REPORT_TTL_MS = 45 * 60 * 1000;

function getSecret() {
  return (
    process.env.WRITE_ACCESS_TOKEN_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    (process.env.NODE_ENV === "development" ? "local-dev-write-access-secret" : null)
  );
}

function signValue(value, secret) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function createPremiumReportSession(payload, options = {}) {
  const secret = getSecret();

  if (!secret) {
    return null;
  }

  const wrapped = {
    scope: "premium-report",
    exp: Date.now() + (options.ttlMs || DEFAULT_PREMIUM_REPORT_TTL_MS),
    data: payload
  };
  const encodedPayload = Buffer.from(JSON.stringify(wrapped), "utf8").toString("base64url");
  const signature = signValue(encodedPayload, secret);

  return `${encodedPayload}.${signature}`;
}

export function verifyPremiumReportSession(token) {
  const secret = getSecret();

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

    if (payload.scope !== "premium-report") {
      return { ok: false, code: "invalid_scope" };
    }

    return { ok: true, payload: payload.data || null };
  } catch {
    return { ok: false, code: "invalid_payload" };
  }
}

export function getPremiumReportCookieOptions(options = {}) {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: options.path || "/api/full-report",
    maxAge: Math.floor((options.ttlMs || DEFAULT_PREMIUM_REPORT_TTL_MS) / 1000)
  };
}
