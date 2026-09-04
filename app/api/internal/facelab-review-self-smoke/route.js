const PROBE_EXPIRES_AT = Date.parse("2026-09-04T18:30:00.000Z");
const PRODUCTION_ORIGIN = "https://k-beauty-two.vercel.app";
const AUTHORIZED_MARKER = "얼굴 수 중립 평가";
const INVALID_MARKER = "유효한 평가 링크가 아닙니다.";
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,256}$/;
const REDACTED_BROWSER_TOKEN = "FACE_LAB_BROWSER_SMOKE_REDACTED";

function notFound() {
  return new Response(null, {
    status: 404,
    headers: { "Cache-Control": "private, no-store, max-age=0" }
  });
}

function invalidTokenFor(token) {
  const final = token.at(-1);
  return `${token.slice(0, -1)}${final === "A" ? "B" : "A"}`;
}

async function fetchReview(token) {
  const url = new URL("/facelab/review", PRODUCTION_ORIGIN);
  url.searchParams.set("t", token);
  const response = await fetch(url, {
    method: "GET",
    headers: {
      accept: "text/html",
      "user-agent": "FaceLabRuntimeSelfSmoke/1"
    },
    cache: "no-store",
    redirect: "follow"
  });
  return {
    status: response.status,
    body: await response.text()
  };
}

function sourceSha() {
  const value = String(process.env.VERCEL_GIT_COMMIT_SHA || "").trim();
  return /^[0-9a-f]{40}$/i.test(value) ? value : "unknown";
}

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const probe = requestUrl.searchParams.get("probe");
  if (
    Date.now() >= PROBE_EXPIRES_AT ||
    !["1", "browser"].includes(probe)
  ) {
    return notFound();
  }

  const token = String(
    process.env.FACE_LAB_HOSTED_REVIEW_ACCESS_TOKEN || ""
  );
  if (!TOKEN_PATTERN.test(token)) {
    return Response.json(
      { ok: false, error: "review_access_unavailable" },
      {
        status: 503,
        headers: { "Cache-Control": "private, no-store, max-age=0" }
      }
    );
  }

  const [positive, negative] = await Promise.all([
    fetchReview(token),
    fetchReview(invalidTokenFor(token))
  ]);

  const positivePass =
    positive.status === 200 &&
    positive.body.includes(AUTHORIZED_MARKER) &&
    !positive.body.includes(INVALID_MARKER);
  const negativePass =
    negative.status === 404 &&
    negative.body.includes(INVALID_MARKER) &&
    !negative.body.includes(AUTHORIZED_MARKER);

  if (probe === "browser") {
    if (!positivePass || !negativePass) {
      return new Response("production_review_smoke_failed", {
        status: 503,
        headers: { "Cache-Control": "private, no-store, max-age=0" }
      });
    }
    const sanitized = positive.body.split(token).join(REDACTED_BROWSER_TOKEN);
    if (sanitized.includes(token) || !sanitized.includes(REDACTED_BROWSER_TOKEN)) {
      return new Response("production_review_token_redaction_failed", {
        status: 503,
        headers: { "Cache-Control": "private, no-store, max-age=0" }
      });
    }
    return new Response(sanitized, {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Type": "text/html; charset=utf-8",
        "X-FaceLab-Smoke-Source-Sha": sourceSha(),
        "X-Robots-Tag": "noindex, nofollow, noarchive"
      }
    });
  }

  return Response.json(
    {
      ok: positivePass && negativePass,
      positiveSmoke: positivePass ? "PASS" : "FAIL",
      negativeSmoke: negativePass ? "PASS" : "FAIL",
      positiveStatus: positive.status,
      negativeStatus: negative.status,
      sourceGitSha: sourceSha()
    },
    {
      status: positivePass && negativePass ? 200 : 503,
      headers: { "Cache-Control": "private, no-store, max-age=0" }
    }
  );
}
