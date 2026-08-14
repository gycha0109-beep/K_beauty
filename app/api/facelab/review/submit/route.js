import { NextResponse } from "next/server";
import {
  HostedHumanCueIntakeError,
  isValidHostedHumanCueAccessToken,
  persistHostedHumanCueSubmission
} from "@/lib/face-lab-hosted-intake";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 262_144;

function json(body, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "CDN-Cache-Control": "no-store",
      "Vercel-CDN-Cache-Control": "no-store"
    }
  });
}

function isSameOriginRequest(request) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && !["same-origin", "none"].includes(fetchSite)) return false;
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

async function readJsonBody(request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new HostedHumanCueIntakeError("hosted_submission_invalid", 415);
  }
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    throw new HostedHumanCueIntakeError("hosted_submission_invalid", 413);
  }
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    throw new HostedHumanCueIntakeError("hosted_submission_invalid", 413);
  }
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value;
  } catch {
    throw new HostedHumanCueIntakeError("hosted_submission_invalid", 400);
  }
}

export async function POST(request) {
  if (!isSameOriginRequest(request)) {
    return json({ ok: false, error: "invalid_request_origin" }, 403);
  }
  const accessToken = request.headers.get("x-face-lab-review-token") || "";
  if (!isValidHostedHumanCueAccessToken(accessToken)) {
    return json({ ok: false, error: "review_access_denied" }, 403);
  }

  try {
    const payload = await readJsonBody(request);
    const requestedTestSubmission =
      request.headers.get("x-face-lab-test-submission") === "1";
    const testSubmission =
      requestedTestSubmission &&
      process.env.FACE_LAB_HOSTED_REVIEW_ALLOW_TEST_SUBMISSION === "1";
    if (requestedTestSubmission && !testSubmission) {
      return json({ ok: false, error: "review_test_mode_denied" }, 403);
    }
    const result = await persistHostedHumanCueSubmission({
      payload,
      testSubmission
    });
    return json({ ok: true, result }, 201);
  } catch (error) {
    if (error instanceof HostedHumanCueIntakeError) {
      return json({ ok: false, error: error.code }, error.status);
    }
    return json({ ok: false, error: "hosted_intake_write_failed" }, 503);
  }
}
