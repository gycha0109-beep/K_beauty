import {
  getHostedHumanCueAuthority,
  isValidHostedHumanCueAccessToken
} from "@/lib/face-lab-hosted-intake";
import { renderHostedHumanCueReviewHtml } from "@/lib/face-lab-hosted-review-html";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NONCE_PATTERN = /^[A-Za-z0-9+/]{22}==$/;

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store, max-age=0",
      "CDN-Cache-Control": "no-store",
      "Vercel-CDN-Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow, noarchive"
    }
  });
}

export async function GET(request) {
  const url = new URL(request.url);
  const accessToken = url.searchParams.get("t") || "";
  const nonce = request.headers.get("x-nonce") || "";
  if (!isValidHostedHumanCueAccessToken(accessToken)) {
    return html("<!doctype html><html lang=\"ko\"><meta charset=\"utf-8\"><title>접근할 수 없음</title><p>유효한 평가 링크가 아닙니다.</p></html>", 404);
  }
  if (!NONCE_PATTERN.test(nonce)) {
    return html("<!doctype html><html lang=\"ko\"><meta charset=\"utf-8\"><title>일시적 오류</title><p>잠시 후 다시 시도해 주세요.</p></html>", 503);
  }
  const testMode =
    url.searchParams.get("smoke") === "1" &&
    process.env.FACE_LAB_HOSTED_REVIEW_ALLOW_TEST_SUBMISSION === "1";
  return html(
    renderHostedHumanCueReviewHtml({
      authority: getHostedHumanCueAuthority(),
      accessToken,
      nonce,
      testMode
    })
  );
}
