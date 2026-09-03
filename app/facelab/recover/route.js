import { createHash, timingSafeEqual } from "node:crypto";

const RECOVERY_EXPIRES_AT = Date.parse("2026-09-03T18:30:00.000Z");
const STALE_HANDOFF_SHA256 =
  "d4f1c8327b13bafa25b1155b49cf6ace5189de544a235bc69615348467740ee8";
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function notFound() {
  return new Response(null, {
    status: 404,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Referrer-Policy": "no-referrer"
    }
  });
}

function tokenHash(token) {
  return createHash("sha256").update(token, "utf8").digest();
}

export async function GET(request) {
  if (Date.now() >= RECOVERY_EXPIRES_AT) {
    return notFound();
  }

  const candidate = new URL(request.url).searchParams.get("t") || "";
  if (!TOKEN_PATTERN.test(candidate)) {
    return notFound();
  }

  const candidateHash = tokenHash(candidate);
  const expectedHash = Buffer.from(STALE_HANDOFF_SHA256, "hex");
  if (
    candidateHash.length !== expectedHash.length ||
    !timingSafeEqual(candidateHash, expectedHash)
  ) {
    return notFound();
  }

  const currentToken = String(
    process.env.FACE_LAB_HOSTED_REVIEW_ACCESS_TOKEN || ""
  );
  if (!TOKEN_PATTERN.test(currentToken)) {
    return new Response(null, {
      status: 503,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Referrer-Policy": "no-referrer"
      }
    });
  }

  const target = new URL("/facelab/review", request.url);
  target.searchParams.set("t", currentToken);
  return new Response(null, {
    status: 307,
    headers: {
      Location: target.toString(),
      "Cache-Control": "private, no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow, noarchive"
    }
  });
}
