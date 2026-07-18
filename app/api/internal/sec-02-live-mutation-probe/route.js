import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { POST as analyzePost } from "@/app/api/analyze/route";
import { POST as resultsPost } from "@/app/api/results/route";
import { GET as resultReadGet } from "@/app/api/results/[shareId]/route";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  ANALYSIS_GUARD_COOKIE_NAME,
  createGuardHmac,
  createPrincipalHash,
  verifySignedAnonymousCookie
} from "@/lib/security/analysis-request-guard-core";
import { createResultReadSubjectHash } from "@/lib/security/public-result-read-guard-core";
import { ANONYMOUS_RESULT_WRITE_HEADER } from "@/lib/security/anonymous-write-grant";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PROBE_NONCE = "sec02-594a3936-20260718";
const EXPECTED_BRANCH = "feature/premium-beta-flow";
const ANALYZE_IP = "198.51.100.77";
const RESULT_READ_IP = "203.0.113.77";
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2n3sAAAAASUVORK5CYII=",
  "base64"
);

function allowed(request) {
  const url = new URL(request.url);
  return process.env.VERCEL_ENV === "preview"
    && process.env.VERCEL_GIT_COMMIT_REF === EXPECTED_BRANCH
    && url.searchParams.get("run") === PROBE_NONCE;
}

function makeForm(overrides = {}) {
  const values = {
    skinType: "combination",
    sensitivityLevel: "medium",
    mainConcern: "acne",
    mainConcerns: JSON.stringify(["acne"]),
    cleansingFrequency: "twice_daily",
    texturePreference: "lightweight",
    postCleanseFeel: "tight",
    afternoonState: "oily",
    environmentExposure: JSON.stringify(["outdoor"]),
    dislikedFeel: "sticky",
    genderPreference: "unspecified",
    whiteCastHate: "true",
    toneUpWanted: "false",
    makeupUse: "false",
    eyeSensitive: "true",
    outdoorExposure: "true",
    verySensitivePeriod: "false",
    locale: "ko",
    ...overrides
  };
  const form = new FormData();
  form.set("image", new File([TINY_PNG], "sec02-probe.png", { type: "image/png" }));
  Object.entries(values).forEach(([key, value]) => form.set(key, String(value)));
  return { form, values };
}

function makeAnalyzeRequest({ key, cookie = "", overrides = {} }) {
  const { form, values } = makeForm(overrides);
  const headers = new Headers({
    "Idempotency-Key": key,
    "x-forwarded-for": ANALYZE_IP,
    "x-real-ip": ANALYZE_IP
  });
  if (cookie) headers.set("cookie", cookie);
  return {
    request: new Request("https://sec02.invalid/api/analyze", {
      method: "POST",
      headers,
      body: form
    }),
    values
  };
}

function extractCookie(response) {
  const raw = response.headers.get("set-cookie") || "";
  const match = raw.match(new RegExp(`${ANALYSIS_GUARD_COOKIE_NAME}=([^;]+)`));
  return match ? `${ANALYSIS_GUARD_COOKIE_NAME}=${match[1]}` : "";
}

async function jsonOrNull(response) {
  try {
    return await response.clone().json();
  } catch {
    return null;
  }
}

function statusCheck(actual, expected, body = null, expectedError = null) {
  return {
    passed: actual === expected && (!expectedError || body?.error === expectedError),
    status: actual,
    error: typeof body?.error === "string" ? body.error : null
  };
}

async function cleanup(admin, state) {
  const cleanup = [];
  const push = (name, error) => cleanup.push({ name, passed: !error });

  for (const shareId of state.shareIds) {
    const { data: rows, error: lookupError } = await admin
      .from("analysis_results")
      .select("id, request_id")
      .eq("share_id", shareId);
    push(`lookup-result:${shareId.length}`, lookupError);
    const requestIds = (rows || []).map((row) => row.request_id).filter(Boolean);
    const resultDelete = await admin.from("analysis_results").delete().eq("share_id", shareId);
    push(`delete-result:${shareId.length}`, resultDelete.error);
    for (const requestId of requestIds) {
      const requestDelete = await admin.from("analysis_requests").delete().eq("id", requestId);
      push("delete-request", requestDelete.error);
    }
  }

  if (state.analysisRunIds.length) {
    const { data: grants, error: grantLookupError } = await admin
      .from("anonymous_write_grants")
      .select("id")
      .in("resource_id", state.analysisRunIds);
    push("lookup-grants", grantLookupError);
    const grantIds = (grants || []).map((row) => row.id);
    if (grantIds.length) {
      const useDelete = await admin.from("anonymous_write_grant_uses").delete().in("grant_id", grantIds);
      push("delete-grant-uses", useDelete.error);
    }
    const grantDelete = await admin
      .from("anonymous_write_grants")
      .delete()
      .in("resource_id", state.analysisRunIds);
    push("delete-grants", grantDelete.error);
  }

  if (state.subjectHashes.length) {
    const rateDelete = await admin
      .from("analysis_request_rate_windows")
      .delete()
      .in("subject_hash", state.subjectHashes);
    push("delete-rate-windows", rateDelete.error);
    const idempotencyDelete = await admin
      .from("analysis_request_idempotency")
      .delete()
      .in("subject_hash", state.subjectHashes);
    push("delete-idempotency", idempotencyDelete.error);
  }

  if (state.authUserId) {
    const { error } = await admin.auth.admin.deleteUser(state.authUserId);
    push("delete-auth-user", error);
  }

  return cleanup;
}

export async function GET(request) {
  if (!allowed(request)) return new NextResponse(null, { status: 404 });

  const admin = createSupabaseAdminClient();
  const guardSecret = process.env.ANALYSIS_REQUEST_GUARD_SECRET || "";
  const grantSecret = process.env.ANONYMOUS_WRITE_GRANT_SECRET || "";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!admin || !guardSecret || !grantSecret || !supabaseUrl || !anonKey) {
    return NextResponse.json({ passed: false, blocker: "required_runtime_configuration_missing" }, { status: 503 });
  }

  const state = {
    analysisRunIds: [],
    shareIds: [],
    subjectHashes: [],
    authUserId: null
  };
  const checks = {};
  const previousOpenAiKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "";

  try {
    const key1 = `sec02-${randomUUID()}`;
    const firstInput = makeAnalyzeRequest({ key: key1 });
    const firstResponse = await analyzePost(firstInput.request);
    const firstBody = await jsonOrNull(firstResponse);
    const cookie = extractCookie(firstResponse);
    checks.anonymousAnalyze = {
      passed: firstResponse.status === 200
        && Boolean(firstBody?.analysisRunId)
        && Boolean(firstResponse.headers.get(ANONYMOUS_RESULT_WRITE_HEADER))
        && Boolean(cookie),
      status: firstResponse.status,
      grantIssued: Boolean(firstResponse.headers.get(ANONYMOUS_RESULT_WRITE_HEADER)),
      cookieIssued: Boolean(cookie)
    };

    if (!checks.anonymousAnalyze.passed) {
      throw new Error("anonymous_analyze_failed");
    }

    state.analysisRunIds.push(firstBody.analysisRunId);
    const cookieValue = cookie.split("=").slice(1).join("=");
    const cookieVerification = verifySignedAnonymousCookie(cookieValue, guardSecret);
    if (!cookieVerification.ok) throw new Error("anonymous_cookie_verification_failed");
    const analyzePrincipalHash = createPrincipalHash({
      scope: "anonymous",
      value: cookieVerification.payload,
      secret: guardSecret
    });
    const analyzeIpHash = createPrincipalHash({ scope: "ip", value: ANALYZE_IP, secret: guardSecret });
    state.subjectHashes.push(analyzePrincipalHash, analyzeIpHash);

    const duplicateInput = makeAnalyzeRequest({ key: key1, cookie });
    const duplicateResponse = await analyzePost(duplicateInput.request);
    const duplicateBody = await jsonOrNull(duplicateResponse);
    checks.idempotentDuplicate = statusCheck(
      duplicateResponse.status,
      409,
      duplicateBody,
      "analysis_request_already_completed"
    );

    const conflictInput = makeAnalyzeRequest({
      key: key1,
      cookie,
      overrides: { mainConcern: "dryness", mainConcerns: JSON.stringify(["dryness"]) }
    });
    const conflictResponse = await analyzePost(conflictInput.request);
    const conflictBody = await jsonOrNull(conflictResponse);
    checks.idempotencyConflict = statusCheck(
      conflictResponse.status,
      409,
      conflictBody,
      "analysis_idempotency_conflict"
    );

    const key2 = `sec02-${randomUUID()}`;
    const secondInput = makeAnalyzeRequest({ key: key2, cookie });
    const secondResponse = await analyzePost(secondInput.request);
    const secondBody = await jsonOrNull(secondResponse);
    checks.secondAllowedAnalyze = {
      passed: secondResponse.status === 200 && Boolean(secondBody?.analysisRunId),
      status: secondResponse.status
    };
    if (secondBody?.analysisRunId) state.analysisRunIds.push(secondBody.analysisRunId);

    const key3 = `sec02-${randomUUID()}`;
    const limitedInput = makeAnalyzeRequest({ key: key3, cookie });
    const limitedResponse = await analyzePost(limitedInput.request);
    const limitedBody = await jsonOrNull(limitedResponse);
    checks.analyzeRateLimit = statusCheck(limitedResponse.status, 429, limitedBody, "analysis_rate_limited");

    const resultToken = firstResponse.headers.get(ANONYMOUS_RESULT_WRITE_HEADER);
    const savePayload = {
      result: firstBody,
      submission: { form: firstInput.values },
      locale: "ko",
      share: true,
      analysisRunId: firstBody.analysisRunId
    };
    const saveHeaders = new Headers({
      "content-type": "application/json",
      cookie,
      [ANONYMOUS_RESULT_WRITE_HEADER]: resultToken,
      "x-forwarded-for": ANALYZE_IP
    });
    const saveResponse = await resultsPost(new Request("https://sec02.invalid/api/results", {
      method: "POST",
      headers: saveHeaders,
      body: JSON.stringify(savePayload)
    }));
    const saveBody = await jsonOrNull(saveResponse);
    checks.anonymousGrantUse = {
      passed: saveResponse.status === 200 && Boolean(saveBody?.shareId),
      status: saveResponse.status
    };
    if (!checks.anonymousGrantUse.passed) throw new Error("anonymous_grant_use_failed");
    state.shareIds.push(saveBody.shareId);

    const replayResponse = await resultsPost(new Request("https://sec02.invalid/api/results", {
      method: "POST",
      headers: saveHeaders,
      body: JSON.stringify(savePayload)
    }));
    const replayBody = await jsonOrNull(replayResponse);
    checks.anonymousGrantReplay = {
      passed: replayResponse.status === 200 && replayBody?.replayed === true && replayBody?.shareId === saveBody.shareId,
      status: replayResponse.status,
      replayed: replayBody?.replayed === true
    };

    const forgedPayload = {
      ...savePayload,
      result: { ...firstBody, summary: `${firstBody.summary || ""} forged` }
    };
    const forgedResponse = await resultsPost(new Request("https://sec02.invalid/api/results", {
      method: "POST",
      headers: saveHeaders,
      body: JSON.stringify(forgedPayload)
    }));
    const forgedBody = await jsonOrNull(forgedResponse);
    checks.anonymousGrantForgeryBlocked = {
      passed: [403, 409].includes(forgedResponse.status)
        && ["anonymous_write_resource_mismatch", "anonymous_write_replayed"].includes(forgedBody?.error),
      status: forgedResponse.status,
      error: forgedBody?.error || null
    };

    const resultReadPrincipalHash = createGuardHmac(
      guardSecret,
      "result-read:anonymous",
      cookieVerification.payload
    );
    const resultReadIpHash = createResultReadSubjectHash(guardSecret, "ip", RESULT_READ_IP);
    const repeatHash = createResultReadSubjectHash(
      guardSecret,
      "repeat",
      `${resultReadPrincipalHash}:${saveBody.shareId}`
    );
    state.subjectHashes.push(resultReadPrincipalHash, resultReadIpHash, repeatHash);

    const readStatuses = [];
    for (let index = 0; index < 13; index += 1) {
      const readRequest = new Request(`https://sec02.invalid/api/results/${saveBody.shareId}`, {
        headers: {
          cookie,
          "x-vercel-forwarded-for": RESULT_READ_IP
        }
      });
      const readResponse = await resultReadGet(readRequest, { params: { shareId: saveBody.shareId } });
      readStatuses.push(readResponse.status);
    }
    checks.resultReadRateLimit = {
      passed: readStatuses.slice(0, 12).every((status) => status === 200) && readStatuses[12] === 429,
      statuses: readStatuses
    };

    const email = `sec02-${randomUUID()}@example.invalid`;
    const password = `S2!${randomUUID()}aA`;
    const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });
    if (createUserError || !createdUser?.user?.id) throw createUserError || new Error("auth_user_create_failed");
    state.authUserId = createdUser.user.id;

    const loginClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
    const { data: signInData, error: signInError } = await loginClient.auth.signInWithPassword({ email, password });
    if (signInError || !signInData?.session?.access_token) throw signInError || new Error("auth_sign_in_failed");
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${signInData.session.access_token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
    const premiumSourceSessionId = `sec02-${randomUUID()}`;
    const { data: premiumWriteData, error: premiumWriteError } = await userClient
      .from("saved_reports")
      .insert({
        user_id: state.authUserId,
        report_type: "premium",
        source_type: "premium_report_session",
        source_session_id: premiumSourceSessionId,
        title: "SEC-02 probe",
        report_version: "premium-probe-v1",
        free_result: {},
        premium_report: { probe: true }
      })
      .select("id");
    const { count: premiumRowCount, error: premiumLookupError } = await admin
      .from("saved_reports")
      .select("id", { count: "exact", head: true })
      .eq("user_id", state.authUserId)
      .eq("source_session_id", premiumSourceSessionId);
    checks.premiumDirectWriteBlocked = {
      passed: Boolean(premiumWriteError) && !premiumWriteData && !premiumLookupError && premiumRowCount === 0,
      errorCode: premiumWriteError?.code || null,
      rowCount: premiumRowCount
    };

    const cleanup = await cleanup(admin, state);
    const cleanupPassed = cleanup.every((item) => item.passed);
    const required = Object.values(checks).every((check) => check.passed === true);
    return NextResponse.json({
      passed: required && cleanupPassed,
      exactSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
      branch: process.env.VERCEL_GIT_COMMIT_REF || null,
      checks,
      cleanup: {
        passed: cleanupPassed,
        checks: cleanup
      }
    }, {
      status: required && cleanupPassed ? 200 : 500,
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    const cleanup = await cleanup(admin, state);
    return NextResponse.json({
      passed: false,
      blocker: error instanceof Error ? error.message : "unknown_probe_failure",
      checks,
      cleanup: {
        passed: cleanup.every((item) => item.passed),
        checks: cleanup
      }
    }, {
      status: 500,
      headers: { "Cache-Control": "no-store" }
    });
  } finally {
    if (previousOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousOpenAiKey;
  }
}
