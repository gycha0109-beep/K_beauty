import {
  getHostedHumanCueAuthority,
  isValidHostedHumanCueAccessToken
} from "@/lib/face-lab-hosted-intake";
import { renderHostedHumanCueReviewHtml } from "@/lib/face-lab-hosted-review-html";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NONCE_PATTERN = /^[A-Za-z0-9+/]{22}==$/;

const MOBILE_UX_SOURCE =
  "@media(max-width:900px){.shell{padding:12px}.app-grid{grid-template-columns:1fr}.visual{position:static}.visual img{max-height:55vh}.reasons{grid-template-columns:1fr}.start{padding:24px;margin:8px auto}}";
const MOBILE_UX_TARGET =
  "@media(max-width:900px){.shell{padding:0 12px 12px}.app-grid{grid-template-columns:1fr;gap:12px}.visual{position:sticky;top:0;z-index:20;padding:8px 10px;border-radius:0 0 14px 14px}.visual-head{font-size:13px}.visual img{max-height:36vh;margin:6px 0}.visual .reminder{display:none}.panel{padding:18px 14px}.reasons{grid-template-columns:1fr}.start{padding:22px 18px;margin:8px auto}}";

const START_FLOW_PATTERN =
  /const rules=el\("div",undefined,"rules"\);.*?root\.append\(button\);if\(Object\.keys\(state\.judgments\)\.length>0\)/s;
const START_FLOW_REPLACEMENT =
  'addHeading(root,2,"독립 평가 확인");root.append(el("p","아래 내용을 확인한 뒤 한 번에 동의하고 시작할 수 있습니다. 실명은 수집하지 않습니다."));const consent=el("div",undefined,"rules");consent.append(el("p",Object.values(DATA.attestationCopy).join(" ")));const box=el("div",undefined,"attest");const label=el("label");const input=el("input");input.type="checkbox";input.id="attest-all";label.append(input,el("span","위 내용을 모두 확인했고 독립적으로 평가하겠습니다."));box.append(label);consent.append(box);root.append(consent);const button=el("button","평가 시작","primary");button.type="button";button.disabled=true;input.addEventListener("change",()=>{button.disabled=!input.checked});button.addEventListener("click",()=>{if(!input.checked)return;state.attested=true;saveState();showReview()});root.append(button);if(Object.keys(state.judgments).length>0)';

function applyHostedReviewUx(body) {
  return body
    .replace(MOBILE_UX_SOURCE, MOBILE_UX_TARGET)
    .replace(
      ".rules{padding:18px 22px;background:var(--soft);border-radius:14px}",
      ".rules{padding:18px 22px;background:var(--soft);border-radius:14px}.rules p{margin:0;color:#475467;font-size:14px}"
    )
    .replace(START_FLOW_PATTERN, START_FLOW_REPLACEMENT);
}

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
  const body = renderHostedHumanCueReviewHtml({
    authority: getHostedHumanCueAuthority(),
    accessToken,
    nonce,
    testMode
  });
  return html(applyHostedReviewUx(body));
}
