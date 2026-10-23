import {buildFaceLabV2TargetSweepCohort} from "../lib/face-lab-v2/evaluation/target-responsiveness.js";
import {buildFaceLabV2Canonical} from "../lib/face-lab-v2/canonical-composer.js";
import {buildStyleCheckGroundedExplanation} from "../lib/face-lab-v2/evaluation/style-check-grounded-explanation-sc06h.js";
import {auditStyleCheckExplanation} from "../lib/face-lab-v2/evaluation/style-check-explanation-audit-sc06j.js";
import {writeFileSync,existsSync} from "node:fs";
import {resolve} from "node:path";
export const STYLE_CHECK_REVIEW_PREVIEW_VERSION="face-lab-style-check-explanation-review-sc06j-v1";
export function buildStyleCheckExplanationPreview({faceCount=1}={}){
 const cohort=buildFaceLabV2TargetSweepCohort({faceCount});
 const examples=[],stats={cases:0,routes:0,pass:0,fail:0,missingActions:0,faceLinked:0};
 for(const item of cohort.cases){
  const canonical=buildFaceLabV2Canonical({analysis:item.analysis,surveyAnswers:item.surveyAnswers,locale:"ko"});
  const routes=[];
  for(const route of canonical?.routes?.routes||[]){
   const text=buildStyleCheckGroundedExplanation({canonical,targetKey:item.targetKey,routeId:route.routeId});
   const audit=auditStyleCheckExplanation({canonical,explanation:text,targetKey:item.targetKey,routeId:route.routeId});
   stats.routes++;stats[audit.status]++;stats.missingActions+=audit.unexplainedActionCount;stats.faceLinked+=audit.faceLinkedCount;
   routes.push({id:route.routeId,strategy:route.strategy,explanation:text,audit});
  }
  examples.push({target:item.targetKey,faceRef:item.faceGroupId,defaultRoute:canonical?.routes?.defaultRouteId||null,routes});
  stats.cases++;
 }
 return {version:STYLE_CHECK_REVIEW_PREVIEW_VERSION,source:"synthetic_observation_fixture_not_real_photo",accuracyValidated:false,providerInvoked:false,productionActive:false,stats,examples};
}
export function renderStyleCheckExplanationPreviewHtml(payload){
 if(payload?.version!==STYLE_CHECK_REVIEW_PREVIEW_VERSION||!Array.isArray(payload.examples))throw Error("preview_data_invalid");
 const raw=JSON.stringify(payload).replace(/</g,"\\u003c");
 return TEMPLATE.replace("/* DATA_SLOT */",raw);
}
const TEMPLATE=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; img-src 'none'">
<title>Face Lab · 설명 품질 검토</title><style>
:root{font-family:system-ui, sans-serif;color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#f3f5f4;color:#192d2a}
main{max-width:1010px;margin:auto;padding:20px 16px 65px}h1{font-size:26px;margin:10px 0 4px}p{line-height:1.65}
.muted{color:#5c716b;font-size:13px}.alert{background:#fff5de;padding:14px 18px;border:1px solid #efd8a8;border-radius:12px;margin:16px 0;font-size:13px}
.wrap{display:grid;grid-template-columns:230px minmax(0,1fr);gap:16px;margin-top:16px}aside{background:#fff;border:1px solid #e0e6e4;border-radius:14px;padding:12px}
button{font:inherit;cursor:pointer}aside button{display:block;width:100%;padding:10px 12px;margin:4px 0;text-align:left;background:transparent;border:0;border-radius:9px}
aside button[aria-current=true]{background:#dbece5;color:#136c55;font-weight:700}
.panel{border-radius:15px;background:#fff;border:1px solid #e0e6e4;padding:22px}h2{font-size:23px;margin:6px 0 10px}
#routes{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px}#routes button{border-radius:100px;background:#f1f5f3;border:1px solid #d9e1dd;padding:8px 12px;font-size:13px}
#routes button[aria-pressed=true]{background:#1b7661;color:#fff;border-color:#1b7661}
.card{padding:15px 0;border-top:1px solid #e9edeb}h3{margin:5px 0 8px;font-size:17px}.step{color:#26715d;font-weight:700;font-size:12px}
details{font-size:12px;color:#617570;margin-top:9px}summary{cursor:pointer}pre{overflow-wrap:anywhere;white-space:pre-wrap;font-size:12px}
.tag{display:inline-block;padding:4px 9px;border-radius:100px;background:#edf4f0;color:#256550;font-size:12px;margin:6px 0}
#meta{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}footer{margin-top:30px;color:#617570;font-size:12px}
@media(max-width:720px){.wrap{grid-template-columns:1fr}aside{display:flex;overflow-x:auto;gap:6px}aside button{flex:0 0 auto;width:auto;white-space:nowrap}.panel{padding:17px}main{padding:16px 12px}}
</style></head><body><main><small class="muted">BEJEWELY / FACE LAB — EXPERIMENTAL</small><h1>추천 설명 품질 검토</h1>
<div class="alert"><strong>합성 테스트 전용</strong><div>실제 사용자 얼굴을 분석한 결과가 아닙니다. 추천 정확도·미적 적합성 검증이나 운영 서비스 반영을 뜻하지 않습니다. 사진 및 외부 전송은 없습니다.</div></div>
<div class="wrap"><aside aria-label="추구미 선택" id="targets"></aside><section class="panel"><div class="muted" id="label"></div><h2 id="headline"></h2><p id="intro"></p><div id="routes"></div><p id="reason"></p><p class="muted" id="caveat"></p><div id="meta"></div><div id="cards"></div></section></div><footer>Face Lab · Research preview · canonical routes unchanged</footer></main>
<script>const data=/* DATA_SLOT */;let targetIndex=0,routeIndex=0;
const el=id=>document.getElementById(id);
function node(tag,text,className){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;}
function show(){
 const item=data.examples[targetIndex],route=item.routes[routeIndex],report=route.explanation,audit=route.audit;
 el("targets").replaceChildren();for(const [i,t] of data.examples.entries()){const b=node("button",t.target);b.setAttribute("aria-current",String(i===targetIndex));b.onclick=()=>{targetIndex=i;routeIndex=Math.max(0,t.routes.findIndex(r=>r.id===t.defaultRoute));show()};el("targets").append(b)}
 el("routes").replaceChildren();for(const [i,r] of item.routes.entries()){const b=node("button",r.strategy);b.setAttribute("aria-pressed",String(i===routeIndex));b.onclick=()=>{routeIndex=i;show()};el("routes").append(b)}
 el("label").textContent=item.target+" · "+item.faceRef+" · synthetic";
 el("headline").textContent=report.headline||"설명을 생성할 수 없습니다";
 el("intro").textContent=report.summary||"근거 확인 필요";
 el("reason").textContent=report.rationale||"판단 보류";
 el("caveat").textContent=report.caveat||"";
 el("meta").replaceChildren();
 for(const str of [audit.status==="pass"?"출처 연결 PASS":"출처 확인 필요","행동 "+audit.explainedActionCount+"/"+audit.routeActionCount,"얼굴 직접 연결 "+audit.faceLinkedCount])el("meta").append(node("span",str,"tag"));
 el("cards").replaceChildren();for(const [i,c] of (report.cards||[]).entries()){const card=node("article",undefined,"card");card.append(node("span","STEP "+(i+1),"step"),node("h3",c.title),node("p",c.how),node("div",c.scope==="face_and_target"?"얼굴 + 추구미 근거":"추구미 근거","muted"));const more=node("details");more.append(node("summary","추천 출처 확인"),node("pre",JSON.stringify(c.source,null,2)));card.append(more);el("cards").append(card)}
}
show();</script></body></html>`;
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname.slice(1))){
 const outfile=process.argv.find(x=>x.startsWith("--out="))?.slice(6);
 if(!outfile||existsSync(outfile))throw Error("output_required_or_exists");
 const report=buildStyleCheckExplanationPreview({faceCount:1});
 writeFileSync(outfile,renderStyleCheckExplanationPreviewHtml(report),{flag:"wx"});
 console.log(JSON.stringify({output:outfile,...report.stats,source:report.source}));
}
