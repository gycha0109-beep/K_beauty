import "server-only";

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createRouteSupabaseAuthClient } from "@/lib/supabase/server-client";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  ANALYSIS_GUARD_COOKIE_MAX_AGE_SECONDS,
  ANALYSIS_GUARD_COOKIE_NAME,
  ANALYSIS_GUARD_SECRET_ENV,
  buildWindowKey,
  createIdempotencyKeyHash,
  createPrincipalHash,
  createRequestFingerprintHash,
  createSignedAnonymousCookie,
  getAnalysisGuardPolicy,
  IDEMPOTENCY_HEADER,
  validateIdempotencyKey,
  verifySignedAnonymousCookie
} from "@/lib/security/analysis-request-guard-core";

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const IDEMPOTENCY_IN_PROGRESS_TIMEOUT_SECONDS = 10 * 60;
const IDEMPOTENCY_FAILURE_RETRY_SECONDS = 10 * 60;

const GUARD_MESSAGES = {
  ko: {
    unavailable: "분석 요청을 잠시 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.",
    rateLimited: "분석 요청이 잠시 제한되었습니다. 잠시 후 다시 시도해 주세요.",
    inProgress: "이미 분석 요청을 처리 중입니다. 잠시 후 다시 확인해 주세요.",
    conflict: "이전 요청과 다른 분석 입력입니다. 새 분석을 시작해 주세요.",
    completed: "이미 처리된 분석 요청입니다. 새 분석을 시작해 주세요.",
    failed: "이전 분석 요청이 실패했습니다. 새 분석을 시작해 주세요.",
    invalidKey: "분석 요청 형식이 올바르지 않습니다. 새 분석을 시작해 주세요."
  },
  en: {
    unavailable: "We cannot process analysis requests right now. Please try again shortly.",
    rateLimited: "Analysis requests are temporarily limited. Please try again shortly.",
    inProgress: "This analysis request is already being processed. Please check again shortly.",
    conflict: "This request key was used with different analysis input. Please start a new analysis.",
    completed: "This analysis request was already processed. Please start a new analysis.",
    failed: "The previous analysis request failed. Please start a new analysis.",
    invalidKey: "The analysis request format is invalid. Please start a new analysis."
  }
};

function getMessages(locale) {
  return locale === "en" ? GUARD_MESSAGES.en : GUARD_MESSAGES.ko;
}

function getGuardSecret() {
  const secret = process.env[ANALYSIS_GUARD_SECRET_ENV];

  return typeof secret === "string" && secret.trim() ? secret.trim() : null;
}

function getBearerToken(request) {
  const authorizationHeader = request.headers.get("authorization");

  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(" ");

  return scheme?.toLowerCase() === "bearer" && token ? token.trim() : null;
}

function isAccountUser(user) {
  return Boolean(user) && !user.is_anonymous && user.app_metadata?.provider !== "anonymous";
}

async function resolveAccountUser(request) {
  const bearerToken = getBearerToken(request);

  if (bearerToken) {
    const routeClient = createRouteSupabaseAuthClient(bearerToken);

    if (routeClient) {
      const {
        data: { user },
        error
      } = await routeClient.auth.getUser();

      if (!error && isAccountUser(user)) {
        return user;
      }
    }
  }

  try {
    const serverClient = await createServerSupabaseClient();
    const {
      data: { user },
      error
    } = await serverClient.auth.getUser();

    return !error && isAccountUser(user) ? user : null;
  } catch {
    return null;
  }
}

function getRequestCookie(request, name) {
  const cookieValue = request.cookies?.get?.(name)?.value;

  if (cookieValue) {
    return cookieValue;
  }

  const cookieHeader = request.headers.get("cookie") || "";
  const matched = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  return matched ? decodeURIComponent(matched.slice(name.length + 1)) : null;
}

function getCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ANALYSIS_GUARD_COOKIE_MAX_AGE_SECONDS
  };
}

function getTrustedClientIp(request) {
  const headers = [
    "x-forwarded-for",
    "x-real-ip",
    "cf-connecting-ip",
    "fly-client-ip"
  ];

  for (const headerName of headers) {
    const value = request.headers.get(headerName);

    if (!value) {
      continue;
    }

    const candidate = value
      .split(",")
      .map((item) => item.trim())
      .find(Boolean);

    if (candidate) {
      return candidate.toLowerCase();
    }
  }

  return process.env.NODE_ENV === "development" ? "local-development" : "unknown";
}

async function resolvePrincipal(request, secret) {
  const accountUser = await resolveAccountUser(request);
  const cookiesToSet = [];

  if (accountUser?.id) {
    return {
      scope: "user",
      subjectHash: createPrincipalHash({
        scope: "user",
        value: String(accountUser.id),
        secret
      }),
      cookiesToSet
    };
  }

  const cookieValue = getRequestCookie(request, ANALYSIS_GUARD_COOKIE_NAME);
  let anonymousPayload = null;
  const verification = verifySignedAnonymousCookie(cookieValue, secret);

  if (verification.ok) {
    anonymousPayload = verification.payload;
  } else {
    const nextCookieValue = createSignedAnonymousCookie(secret);
    const nextVerification = verifySignedAnonymousCookie(nextCookieValue, secret);
    anonymousPayload = nextVerification.payload;
    cookiesToSet.push({
      name: ANALYSIS_GUARD_COOKIE_NAME,
      value: nextCookieValue,
      options: getCookieOptions()
    });
  }

  return {
    scope: "anonymous",
    subjectHash: createPrincipalHash({
      scope: "anonymous",
      value: anonymousPayload,
      secret
    }),
    anonymousPayload,
    cookiesToSet
  };
}

export function resolveExistingAnonymousCookiePayload(request) {
  const secret = getGuardSecret();

  if (!secret) {
    return { ok: false, code: "unavailable" };
  }

  const verification = verifySignedAnonymousCookie(
    getRequestCookie(request, ANALYSIS_GUARD_COOKIE_NAME),
    secret
  );

  if (!verification.ok) {
    return { ok: false, code: verification.code };
  }

  return {
    ok: true,
    payload: verification.payload
  };
}

function buildRateLimitItems({ endpoint, policy, principal, ipHash, nowMs }) {
  const items = [];
  const primaryLimits = policy.limits[principal.scope] || [];

  primaryLimits.forEach((limitPolicy) => {
    const window = buildWindowKey(nowMs, limitPolicy.name, limitPolicy.windowMs);

    items.push({
      scope: principal.scope,
      subject_hash: principal.subjectHash,
      endpoint,
      window_key: window.windowKey,
      window_started_at: window.windowStartedAt,
      window_reset_at: window.windowResetAt,
      request_limit: limitPolicy.limit
    });
  });

  policy.limits.ip.forEach((limitPolicy) => {
    const window = buildWindowKey(nowMs, `ip-${limitPolicy.name}`, limitPolicy.windowMs);

    items.push({
      scope: "ip",
      subject_hash: ipHash,
      endpoint,
      window_key: window.windowKey,
      window_started_at: window.windowStartedAt,
      window_reset_at: window.windowResetAt,
      request_limit: limitPolicy.limit
    });
  });

  return items;
}

function normalizeRpcJson(data) {
  if (!data) {
    return null;
  }

  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  return data;
}

function createDeniedResult(code, options = {}) {
  return {
    ok: false,
    code,
    httpStatus: options.httpStatus || 503,
    retryAfterSeconds: options.retryAfterSeconds || null,
    cookiesToSet: options.cookiesToSet || []
  };
}

export function createAnalysisGuardResponse(guardResult, locale = "ko") {
  const messages = getMessages(locale);
  const status = guardResult.httpStatus || 503;
  const bodyByCode = {
    analysis_rate_limited: {
      error: "analysis_rate_limited",
      retryAfterSeconds: guardResult.retryAfterSeconds || 60,
      message: messages.rateLimited
    },
    analysis_request_in_progress: {
      error: "analysis_request_in_progress",
      message: messages.inProgress
    },
    analysis_idempotency_conflict: {
      error: "analysis_idempotency_conflict",
      message: messages.conflict
    },
    analysis_request_already_completed: {
      error: "analysis_request_already_completed",
      message: messages.completed
    },
    analysis_request_failed: {
      error: "analysis_request_failed",
      message: messages.failed
    },
    invalid_idempotency_key: {
      error: "invalid_idempotency_key",
      message: messages.invalidKey
    },
    analysis_guard_unavailable: {
      error: "analysis_guard_unavailable",
      message: messages.unavailable
    }
  };
  const response = NextResponse.json(
    bodyByCode[guardResult.code] || bodyByCode.analysis_guard_unavailable,
    {
      status,
      headers: guardResult.retryAfterSeconds
        ? { "Retry-After": String(guardResult.retryAfterSeconds) }
        : undefined
    }
  );

  applyAnalysisGuardCookies(response, guardResult);

  return response;
}

export function applyAnalysisGuardCookies(response, guardResult) {
  (guardResult?.cookiesToSet || []).forEach((cookie) => {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  });

  return response;
}

export async function guardAnalysisRequest({ request, endpoint, fingerprintInput }) {
  const policy = getAnalysisGuardPolicy(endpoint);

  if (!policy) {
    return createDeniedResult("analysis_guard_unavailable", { httpStatus: 503 });
  }

  const secret = getGuardSecret();

  if (!secret) {
    return createDeniedResult("analysis_guard_unavailable", { httpStatus: 503 });
  }

  const idempotencyValidation = validateIdempotencyKey(request.headers.get(IDEMPOTENCY_HEADER));

  if (!idempotencyValidation.ok) {
    return createDeniedResult("invalid_idempotency_key", { httpStatus: 400 });
  }

  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return createDeniedResult("analysis_guard_unavailable", { httpStatus: 503 });
  }

  let principal = null;

  try {
    principal = await resolvePrincipal(request, secret);
  } catch {
    return createDeniedResult("analysis_guard_unavailable", { httpStatus: 503 });
  }

  const requestFingerprintHash = createRequestFingerprintHash({
    endpoint,
    input: fingerprintInput,
    secret
  });
  const cookiesToSet = principal.cookiesToSet || [];
  let idempotency = null;

  if (!idempotencyValidation.missing) {
    const idempotencyKeyHash = createIdempotencyKeyHash({
      key: idempotencyValidation.key,
      secret
    });
    let claimResponse = null;

    try {
      claimResponse = await supabase.rpc("claim_analysis_idempotency", {
        p_scope: principal.scope,
        p_subject_hash: principal.subjectHash,
        p_endpoint: endpoint,
        p_idempotency_key_hash: idempotencyKeyHash,
        p_request_fingerprint_hash: requestFingerprintHash,
        p_expires_at: new Date(Date.now() + IDEMPOTENCY_TTL_MS).toISOString(),
        p_in_progress_timeout_seconds: IDEMPOTENCY_IN_PROGRESS_TIMEOUT_SECONDS
      });
    } catch {
      return createDeniedResult("analysis_guard_unavailable", { httpStatus: 503, cookiesToSet });
    }

    const { data, error } = claimResponse;

    if (error) {
      return createDeniedResult("analysis_guard_unavailable", { httpStatus: 503, cookiesToSet });
    }

    const claim = normalizeRpcJson(data);

    if (claim?.state === "in_progress") {
      return createDeniedResult("analysis_request_in_progress", {
        httpStatus: 409,
        cookiesToSet
      });
    }

    if (claim?.state === "conflict") {
      return createDeniedResult("analysis_idempotency_conflict", {
        httpStatus: 409,
        cookiesToSet
      });
    }

    if (claim?.state === "completed") {
      return createDeniedResult("analysis_request_already_completed", {
        httpStatus: 409,
        cookiesToSet
      });
    }

    if (claim?.state === "failed") {
      return createDeniedResult("analysis_request_failed", {
        httpStatus: 409,
        cookiesToSet
      });
    }

    if (claim?.state !== "claimed") {
      return createDeniedResult("analysis_guard_unavailable", { httpStatus: 503, cookiesToSet });
    }

    idempotency = {
      claimed: true,
      keyHash: idempotencyKeyHash,
      requestFingerprintHash
    };
  }

  const ipHash = createPrincipalHash({
    scope: "ip",
    value: getTrustedClientIp(request),
    secret
  });
  let consumeResponse = null;

  try {
    consumeResponse = await supabase.rpc("consume_analysis_rate_limits", {
      p_limits: buildRateLimitItems({
        endpoint,
        policy,
        principal,
        ipHash,
        nowMs: Date.now()
      })
    });
  } catch {
    return createDeniedResult("analysis_guard_unavailable", { httpStatus: 503, cookiesToSet });
  }

  const { data, error } = consumeResponse;

  if (error) {
    return createDeniedResult("analysis_guard_unavailable", { httpStatus: 503, cookiesToSet });
  }

  const consumed = normalizeRpcJson(data);

  if (!consumed?.allowed) {
    return createDeniedResult("analysis_rate_limited", {
      httpStatus: 429,
      retryAfterSeconds: Number(consumed?.retry_after_seconds) || 60,
      cookiesToSet
    });
  }

  return {
    ok: true,
    endpoint,
    supabase,
    principal,
    idempotency,
    cookiesToSet
  };
}

export async function completeAnalysisRequestGuard(guardResult, resultReference = null) {
  if (!guardResult?.ok || !guardResult.idempotency?.claimed) {
    return { ok: true, skipped: true };
  }

  try {
    const { error } = await guardResult.supabase.rpc("complete_analysis_idempotency", {
      p_scope: guardResult.principal.scope,
      p_subject_hash: guardResult.principal.subjectHash,
      p_endpoint: guardResult.endpoint,
      p_idempotency_key_hash: guardResult.idempotency.keyHash,
      p_request_fingerprint_hash: guardResult.idempotency.requestFingerprintHash,
      p_result_reference: resultReference
    });

    return { ok: !error };
  } catch {
    return { ok: false };
  }
}

export async function failAnalysisRequestGuard(guardResult) {
  if (!guardResult?.ok || !guardResult.idempotency?.claimed) {
    return { ok: true, skipped: true };
  }

  try {
    const { error } = await guardResult.supabase.rpc("fail_analysis_idempotency", {
      p_scope: guardResult.principal.scope,
      p_subject_hash: guardResult.principal.subjectHash,
      p_endpoint: guardResult.endpoint,
      p_idempotency_key_hash: guardResult.idempotency.keyHash,
      p_request_fingerprint_hash: guardResult.idempotency.requestFingerprintHash,
      p_retry_after_seconds: IDEMPOTENCY_FAILURE_RETRY_SECONDS
    });

    return { ok: !error };
  } catch {
    return { ok: false };
  }
}
