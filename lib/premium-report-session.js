import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const PREMIUM_REPORT_COOKIE = "kbeauty_premium_report";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PREMIUM_REPORT_TTL_MS =
  process.env.NODE_ENV === "development" ? 7 * ONE_DAY_MS : ONE_DAY_MS;
const PREMIUM_REPORT_SESSIONS_TABLE = "premium_report_sessions";

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

async function pruneExpiredSessions(supabase, now = new Date()) {
  const { error } = await supabase
    .from(PREMIUM_REPORT_SESSIONS_TABLE)
    .delete()
    .lt("expires_at", now.toISOString());

  if (error && process.env.NODE_ENV !== "production") {
    console.warn("[premium-report-session] prune failed", error);
  }
}

export async function createPremiumReportSession(payload, options = {}) {
  const secret = getSecret();

  if (!secret) {
    return null;
  }

  if (!payload?.premiumReport) {
    return null;
  }

  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[premium-report-session] Supabase admin client is not configured");
    }
    return null;
  }

  const exp = Date.now() + (options.ttlMs || DEFAULT_PREMIUM_REPORT_TTL_MS);
  const sessionId = randomBytes(16).toString("base64url");
  const expiresAt = new Date(exp).toISOString();

  await pruneExpiredSessions(supabase).catch(() => {});

  const { error } = await supabase
    .from(PREMIUM_REPORT_SESSIONS_TABLE)
    .insert({
      session_id: sessionId,
      premium_report: payload.premiumReport,
      locale: payload.locale === "en" ? "en" : "ko",
      expires_at: expiresAt,
      updated_at: new Date().toISOString()
    });

  if (error) {
    console.error("[premium-report-session] failed to create session", error);
    return null;
  }

  const wrapped = {
    scope: "premium-report",
    exp,
    sid: sessionId
  };
  const encodedPayload = Buffer.from(JSON.stringify(wrapped), "utf8").toString("base64url");
  const signature = signValue(encodedPayload, secret);

  return `${encodedPayload}.${signature}`;
}

export async function verifyPremiumReportSession(token) {
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

    if (payload.sid) {
      const supabase = createSupabaseAdminClient();

      if (!supabase) {
        return { ok: false, code: "store_misconfigured" };
      }

      await pruneExpiredSessions(supabase).catch(() => {});

      const { data, error } = await supabase
        .from(PREMIUM_REPORT_SESSIONS_TABLE)
        .select("premium_report, locale, expires_at")
        .eq("session_id", payload.sid)
        .maybeSingle();

      if (error) {
        console.error("[premium-report-session] failed to read session", error);
        return { ok: false, code: "store_error" };
      }

      if (!data) {
        return { ok: false, code: "missing_session" };
      }

      if (!data.expires_at || Date.now() > new Date(data.expires_at).getTime()) {
        await supabase
          .from(PREMIUM_REPORT_SESSIONS_TABLE)
          .delete()
          .eq("session_id", payload.sid);
        return { ok: false, code: "expired" };
      }

      return {
        ok: true,
        payload: {
          premiumReport: data.premium_report || null,
          locale: data.locale || null,
          sessionId: payload.sid
        }
      };
    }

    return { ok: true, payload: payload.data || null };
  } catch {
    return { ok: false, code: "invalid_payload" };
  }
}

export async function updatePremiumReportSession(token, premiumReport) {
  if (!premiumReport || typeof premiumReport !== "object") {
    return { ok: false, code: "missing_report" };
  }

  const verified = await verifyPremiumReportSession(token);
  const sessionId = verified.payload?.sessionId;

  if (!verified.ok || !sessionId) {
    return { ok: false, code: verified.code || "missing_session" };
  }

  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return { ok: false, code: "store_misconfigured" };
  }

  const { error } = await supabase
    .from(PREMIUM_REPORT_SESSIONS_TABLE)
    .update({
      premium_report: premiumReport,
      updated_at: new Date().toISOString()
    })
    .eq("session_id", sessionId);

  if (error) {
    console.error("[premium-report-session] failed to update session", error);
    return { ok: false, code: "store_error" };
  }

  return { ok: true };
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
