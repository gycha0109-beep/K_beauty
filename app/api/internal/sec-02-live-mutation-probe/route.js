import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
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
  "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAZUlEQVR4nO3PQQ3AIADAQMC/CEQgBzETweOypKegnffs8WdLB7xqQGtAa0BrQGtAa0BrQGtAa0BrQGtAa0BrQGtAa0BrQGtAa0BrQGtAa0BrQGtAa0BrQGtAa0BrQGtAa0BrQPsAzvcCsCwgxscAAAAASUVORK5CYII=",
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
  const body = new FormData();
  body.set("image", new File([TINY_PNG], "sec02-probe.png", { type: "image/png" }));
  for (const [key, value] of Object.entries(values)) body.set(key, String(value));
  return { body, values };
}

function makeAnalyzeRequest({ key, cookie = "", overrides = {} }) {
  const form = makeForm(overrides);
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
      body: form.body
    }),
    values: form.values
  };
}

function extractCookie(response) {
  const raw = response.headers.get("set-cookie") || "";
  const match = raw.match(new RegExp(`${ANALYSIS_GUARD_COOKIE_NAME}=([^;]+)`));
  return match ? `${ANALYSIS_GUARD_COOKIE_NAME}=${match[1]}` : "";
}

async function json(response) {
  try {
    return await response.clone().json();
  } catch {
    return null;
  }
}

function check(status, expectedStatus, body = null, expectedError = null) {
  return {
    passed: status === expectedStatus && (!expectedError || body?.error === expectedError),
    status,
    error: typeof body?.error === "string" ? body.error : null
  };
}

export async function GET(request) {
  if (!allowed(request)) return new NextResponse(null, { status: 404 });

  const guardSecret = process.env.ANALYSIS_REQUEST_GUARD_SECRET || "";
  const grantSecret = process.env.ANONYMOUS_WRITE_GRANT_SECRET || "";
  if (!guardSecret || !grantSecret) {
    return NextResponse.json({ passed: false, blocker: "required_runtime_configuration_missing" }, { status: 503 });
  }

  const evidence = {
    analysisRunIds: [],
    shareId: null,
    subjectHashes: []
  };
  const checks = {};
  const previousOpenAiKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "";

  try {
    const analyzePost = (await import("@/app/api/analyze/route")).POST;
    const resultsPost = (await import("@/app/api/results/route")).POST;
    const resultReadGet = (await import("@/app/api/results/[shareId]/route")).GET;

    const key1 = `sec02-${randomUUID()}`;
    const firstInput = makeAnalyzeRequest({ key: key1 });
    const firstResponse = await analyzePost(firstInput.request);
    const firstBody = await json(firstResponse);
    const cookie = extractCookie(firstResponse);
    const resultToken = firstResponse.headers.get(ANONYMOUS_RESULT_WRITE_HEADER);
    checks.anonymousAnalyze = {
      passed: firstResponse.status === 200
        && Boolean(firstBody?.analysisRunId)
        && Boolean(resultToken)
        && Boolean(cookie),
      status: firstResponse.status,
      error: firstBody?.error || null,
      grantIssued: Boolean(resultToken),
      cookieIssued: Boolean(cookie)
    };
    if (!checks.anonymousAnalyze.passed) throw new Error("anonymous_analyze_failed");
    evidence.analysisRunIds.push(firstBody.analysisRunId);

    const cookieValue = cookie.split("=").slice(1).join("=");
    const verifiedCookie = verifySignedAnonymousCookie(cookieValue, guardSecret);
    if (!verifiedCookie.ok) throw new Error("anonymous_cookie_verification_failed");
    const analyzePrincipalHash = createPrincipalHash({
      scope: "anonymous",
      value: verifiedCookie.payload,
      secret: guardSecret
    });
    const analyzeIpHash = createPrincipalHash({
      scope: "ip",
      value: ANALYZE_IP,
      secret: guardSecret
    });
    evidence.subjectHashes.push(analyzePrincipalHash, analyzeIpHash);

    const duplicateResponse = await analyzePost(makeAnalyzeRequest({ key: key1, cookie }).request);
    const duplicateBody = await json(duplicateResponse);
    checks.idempotentDuplicate = check(
      duplicateResponse.status,
      409,
      duplicateBody,
      "analysis_request_already_completed"
    );

    const conflictResponse = await analyzePost(makeAnalyzeRequest({
      key: key1,
      cookie,
      overrides: { mainConcern: "dryness", mainConcerns: JSON.stringify(["dryness"]) }
    }).request);
    const conflictBody = await json(conflictResponse);
    checks.idempotencyConflict = check(
      conflictResponse.status,
      409,
      conflictBody,
      "analysis_idempotency_conflict"
    );

    const secondResponse = await analyzePost(makeAnalyzeRequest({
      key: `sec02-${randomUUID()}`,
      cookie
    }).request);
    const secondBody = await json(secondResponse);
    checks.secondAllowedAnalyze = {
      passed: secondResponse.status === 200 && Boolean(secondBody?.analysisRunId),
      status: secondResponse.status,
      error: secondBody?.error || null
    };
    if (secondBody?.analysisRunId) evidence.analysisRunIds.push(secondBody.analysisRunId);

    const limitedResponse = await analyzePost(makeAnalyzeRequest({
      key: `sec02-${randomUUID()}`,
      cookie
    }).request);
    const limitedBody = await json(limitedResponse);
    checks.analyzeRateLimit = check(
      limitedResponse.status,
      429,
      limitedBody,
      "analysis_rate_limited"
    );

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
    const saveRequest = (payload) => new Request("https://sec02.invalid/api/results", {
      method: "POST",
      headers: saveHeaders,
      body: JSON.stringify(payload)
    });

    const saveResponse = await resultsPost(saveRequest(savePayload));
    const saveBody = await json(saveResponse);
    checks.anonymousGrantUse = {
      passed: saveResponse.status === 200 && Boolean(saveBody?.shareId),
      status: saveResponse.status,
      error: saveBody?.error || null
    };
    if (!checks.anonymousGrantUse.passed) throw new Error("anonymous_grant_use_failed");
    evidence.shareId = saveBody.shareId;

    const replayResponse = await resultsPost(saveRequest(savePayload));
    const replayBody = await json(replayResponse);
    checks.anonymousGrantReplay = {
      passed: replayResponse.status === 200
        && replayBody?.replayed === true
        && replayBody?.shareId === saveBody.shareId,
      status: replayResponse.status,
      replayed: replayBody?.replayed === true
    };

    const forgedResponse = await resultsPost(saveRequest({
      ...savePayload,
      result: { ...firstBody, summary: `${firstBody.summary || ""} forged` }
    }));
    const forgedBody = await json(forgedResponse);
    checks.anonymousGrantForgeryBlocked = {
      passed: [403, 409].includes(forgedResponse.status)
        && ["anonymous_write_resource_mismatch", "anonymous_write_replayed"].includes(forgedBody?.error),
      status: forgedResponse.status,
      error: forgedBody?.error || null
    };

    const resultReadPrincipalHash = createGuardHmac(
      guardSecret,
      "result-read:anonymous",
      verifiedCookie.payload
    );
    const resultReadIpHash = createResultReadSubjectHash(guardSecret, "ip", RESULT_READ_IP);
    const repeatHash = createResultReadSubjectHash(
      guardSecret,
      "repeat",
      `${resultReadPrincipalHash}:${saveBody.shareId}`
    );
    evidence.subjectHashes.push(resultReadPrincipalHash, resultReadIpHash, repeatHash);

    const readStatuses = [];
    for (let index = 0; index < 13; index += 1) {
      const readResponse = await resultReadGet(
        new Request(`https://sec02.invalid/api/results/${saveBody.shareId}`, {
          headers: { cookie, "x-vercel-forwarded-for": RESULT_READ_IP }
        }),
        { params: { shareId: saveBody.shareId } }
      );
      readStatuses.push(readResponse.status);
    }
    checks.resultReadRateLimit = {
      passed: readStatuses.slice(0, 12).every((status) => status === 200)
        && readStatuses[12] === 429,
      statuses: readStatuses
    };

    const passed = Object.values(checks).every((item) => item.passed === true);
    return NextResponse.json({
      passed,
      exactSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
      branch: process.env.VERCEL_GIT_COMMIT_REF || null,
      checks,
      evidence
    }, {
      status: passed ? 200 : 500,
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    return NextResponse.json({
      passed: false,
      blocker: error instanceof Error ? error.message : "unknown_probe_failure",
      checks,
      evidence
    }, {
      status: 500,
      headers: { "Cache-Control": "no-store" }
    });
  } finally {
    if (previousOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousOpenAiKey;
  }
}
