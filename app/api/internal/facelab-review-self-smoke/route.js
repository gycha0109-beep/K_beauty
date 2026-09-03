const PROBE_EXPIRES_AT = Date.parse("2026-09-03T18:15:00.000Z");
const PROBE_HEADER = "x-facelab-review-self-smoke";
const PRODUCTION_ORIGIN = "https://k-beauty-two.vercel.app";
const AUTHORIZED_MARKER = "얼굴 수 중립 평가";
const INVALID_MARKER = "유효한 평가 링크가 아닙니다.";
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,256}$/;

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

export async function POST(request) {
  if (
    Date.now() >= PROBE_EXPIRES_AT ||
    request.headers.get(PROBE_HEADER) !== "1"
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

  return Response.json(
    {
      ok: positivePass && negativePass,
      positiveSmoke: positivePass ? "PASS" : "FAIL",
      negativeSmoke: negativePass ? "PASS" : "FAIL",
      positiveStatus: positive.status,
      negativeStatus: negative.status
    },
    {
      status: positivePass && negativePass ? 200 : 503,
      headers: { "Cache-Control": "private, no-store, max-age=0" }
    }
  );
}
