import {
  HOSTED_HUMAN_CUE_CAMPAIGN_KEY,
  HOSTED_HUMAN_CUE_DISTRIBUTION_MODE,
  HOSTED_HUMAN_CUE_INTAKE_VERSION,
  HOSTED_HUMAN_CUE_REQUIRED_ATTESTATION,
  HOSTED_HUMAN_CUE_SUBMISSION_SCHEMA_VERSION
} from "@bejewely/face-contracts";

const escapeEmbeddedJson = (value) =>
  JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026");

export function renderHostedHumanCueReviewHtml({
  authority,
  accessToken,
  nonce,
  testMode = false,
  submitEndpoint = "/api/facelab/review/submit"
}) {
  const model = {
    schemaVersion: HOSTED_HUMAN_CUE_SUBMISSION_SCHEMA_VERSION,
    intakeVersion: HOSTED_HUMAN_CUE_INTAKE_VERSION,
    campaignKey: HOSTED_HUMAN_CUE_CAMPAIGN_KEY,
    distributionMode: HOSTED_HUMAN_CUE_DISTRIBUTION_MODE,
    protocolVersion: "face-lab-independent-human-cue-audit-20260814-v1",
    uiVersion: authority.ui.uiVersion,
    sourceAuthorityDigest: authority.sourceAuthorities.d2dPPacketAuthorityDigest,
    targetAxisDefinitionDigest:
      authority.sourceAuthorities.d2cFDefinitionContractDigest,
    hostedSetAuthorityDigest: authority.authorityDigest,
    accessToken,
    testMode,
    submitEndpoint,
    items: authority.orderedItems.map((item) => ({
      reviewItemId: item.reviewItemId,
      assetPath: item.assetPath
    })),
    axes: [...authority.primaryAxes, ...authority.validationAxes],
    tokenLabels: authority.ui.tokenLabels,
    reasonLabels: authority.ui.reasonLabels,
    attestationCopy: authority.ui.attestationCopy,
    attestationValue: HOSTED_HUMAN_CUE_REQUIRED_ATTESTATION
  };
  const embedded = escapeEmbeddedJson(model);

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer">
<meta name="robots" content="noindex,nofollow,noarchive">
<title>얼굴 특징 판별 테스트</title>
<style nonce="${nonce}">
:root{color-scheme:light;--ink:#17202a;--muted:#667085;--line:#d9dee7;--paper:#fff;--soft:#f5f7fa;--brand:#0f766e;--brand2:#115e59;--warn:#b42318;--focus:#2563eb}*{box-sizing:border-box}body{margin:0;background:#eef2f5;color:var(--ink);font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","Malgun Gothic",sans-serif;line-height:1.55}button,input{font:inherit}button{min-height:44px}.shell{max-width:1480px;margin:auto;padding:24px}.card{background:var(--paper);border:1px solid var(--line);border-radius:18px;box-shadow:0 10px 30px rgba(16,24,40,.06)}.start{max-width:850px;margin:28px auto;padding:36px}.eyebrow{color:var(--brand);font-weight:800;letter-spacing:.04em}.start h1{font-size:clamp(28px,4vw,42px);line-height:1.2;margin:6px 0 18px}.lead{font-size:18px}.rules{padding:18px 22px;background:var(--soft);border-radius:14px}.attest{display:grid;gap:10px;margin:20px 0}.attest label,.reason{display:flex;gap:10px;align-items:flex-start;padding:12px;border:1px solid var(--line);border-radius:12px;cursor:pointer}.attest input,.reason input{width:20px;height:20px;flex:0 0 auto}.primary,.secondary{border:0;border-radius:12px;padding:11px 18px;font-weight:800;cursor:pointer}.primary{color:#fff;background:var(--brand)}.primary:hover{background:var(--brand2)}.primary:disabled{background:#aab4c0;cursor:not-allowed}.secondary{background:#e8eeef;color:#24323a}.app-grid{display:grid;grid-template-columns:minmax(380px,44%) minmax(0,56%);gap:22px;align-items:start}.visual{position:sticky;top:18px;padding:20px}.visual-head,.panel-head,.nav{display:flex;justify-content:space-between;gap:12px;align-items:center}.visual img{display:block;width:100%;max-height:70vh;object-fit:contain;background:#e8ecef;border-radius:14px;margin:14px 0}.reminder{padding:14px;background:#f0fdfa;border-left:4px solid var(--brand);border-radius:10px}.panel{padding:22px;min-width:0}.progress-track{height:10px;background:#e5e7eb;border-radius:99px;overflow:hidden;margin:12px 0 20px}.progress-bar{height:100%;background:var(--brand);transition:width .2s}.axis-list{display:grid;gap:16px}.axis-card{padding:18px;border:1px solid var(--line);border-radius:15px}.axis-card h2{font-size:20px;margin:0 0 4px}.axis-card p{margin:0 0 12px;color:#475467}.axis-kind{font-size:13px;color:var(--brand);font-weight:800}.label{font-size:14px;font-weight:800;margin:14px 0 7px}.chips{display:flex;flex-wrap:wrap;gap:8px}.chip{border:1px solid #aeb7c2;border-radius:999px;background:#fff;padding:8px 14px;cursor:pointer}.chip[aria-pressed="true"]{background:var(--brand);border-color:var(--brand);color:#fff;font-weight:800}.chip:focus-visible,.primary:focus-visible,.secondary:focus-visible,summary:focus-visible{outline:3px solid var(--focus);outline-offset:2px}.reasons{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}.reason{padding:9px;font-size:14px}.details{margin-top:14px;padding-top:12px;border-top:1px dashed var(--line)}summary{cursor:pointer;color:var(--brand2);font-weight:800}.detail-block{margin-top:12px;padding:14px;background:var(--soft);border-radius:12px}.detail-block h3{font-size:15px;margin:12px 0 5px}.detail-block ul{margin:5px 0;padding-left:22px}.value-def{margin:7px 0}.error{min-height:24px;color:var(--warn);font-weight:800;margin:12px 0}.nav{margin-top:20px;padding-top:18px;border-top:1px solid var(--line)}.hidden{display:none!important}.done{text-align:center;padding:36px}.done h1{font-size:32px}.status{color:var(--muted)}@media(max-width:900px){.shell{padding:12px}.app-grid{grid-template-columns:1fr}.visual{position:static}.visual img{max-height:55vh}.reasons{grid-template-columns:1fr}.start{padding:24px;margin:8px auto}}
</style>
</head>
<body>
<main class="shell"><section id="start" class="card start"></section><section id="review" class="app-grid hidden"><aside class="card visual"><div class="visual-head"><strong id="photo-count"></strong><span id="item-label"></span></div><img id="review-image" alt="평가할 얼굴 사진"><div class="reminder">전체 인상이나 닮은꼴이 아니라, 각 문항에서 지정한 얼굴 부분과 기준만 보고 판단해 주세요.</div></aside><section class="card panel"><div class="panel-head"><strong>얼굴 특징 평가</strong><span id="progress-label"></span></div><div class="progress-track" aria-hidden="true"><div id="progress-bar" class="progress-bar"></div></div><div id="axis-list" class="axis-list"></div><div id="error" class="error" role="alert"></div><nav class="nav"><button id="prev" class="secondary" type="button">이전 사진</button><button id="next" class="primary" type="button">다음 사진</button></nav></section></section><section id="done" class="card done hidden"></section></main>
<script nonce="${nonce}">
"use strict";
const DATA=${embedded};
const AXES=DATA.axes;
const STORAGE_KEY=["face-lab-hosted-review",DATA.uiVersion,DATA.hostedSetAuthorityDigest].join("::");
const byId=(id)=>document.getElementById(id);
const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node};
const addHeading=(parent,level,text)=>parent.append(el("h"+level,text));
const makeSessionId=()=>"hsi_"+crypto.randomUUID();
const blankState=()=>({uiVersion:DATA.uiVersion,authorityDigest:DATA.hostedSetAuthorityDigest,sessionId:makeSessionId(),startedAt:new Date().toISOString(),attested:false,imageIndex:0,judgments:{}});
function loadState(){try{const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY));if(parsed&&parsed.uiVersion===DATA.uiVersion&&parsed.authorityDigest===DATA.hostedSetAuthorityDigest&&parsed.judgments)return parsed}catch{}return blankState()}
let state=loadState();
function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}
function judgmentKey(itemId,axisPath){return itemId+"|"+axisPath}
function getJudgment(itemId,axis){const key=judgmentKey(itemId,axis.axisPath);if(!state.judgments[key])state.judgments[key]={reviewItemId:itemId,axisPath:axis.axisPath,response:null,confidence:null,evidenceTags:[],notAssessableReasonCodes:[]};return state.judgments[key]}
function isValid(j,axis){if(j.response==="not_assessable")return j.confidence==="not_applicable"&&j.notAssessableReasonCodes.length>0;if(j.response==="uncertain")return ["low","medium"].includes(j.confidence)&&j.notAssessableReasonCodes.length===0;return axis.enumOptions.includes(j.response)&&["low","medium","high"].includes(j.confidence)&&j.notAssessableReasonCodes.length===0}
function renderStart(){const root=byId("start");root.replaceChildren();root.append(el("div","독립 블라인드 평가","eyebrow"));addHeading(root,1,"얼굴 특징 판별 테스트");root.append(el("p","약 5분 동안 얼굴 사진 14장을 보고, 각 사진의 정해진 얼굴 특징 축을 평가합니다.","lead"));root.append(el("p","정답을 맞히는 시험이 아니며 파일 다운로드나 별도 제출 절차는 없습니다. 마지막 화면에서 제출 버튼을 눌러 주세요."));const rules=el("div",undefined,"rules");addHeading(rules,2,"평가 원칙");const list=el("ul");["성격이나 분위기를 추측하지 않습니다.","나이, 성별, 인종 등의 외모 평가를 하지 않습니다.","고정관념이나 이상형을 판단 기준으로 사용하지 않습니다.","다른 참여자의 답을 보거나 상의하지 않습니다.","불확실하면 억지로 범주를 고르지 않습니다."].forEach((text)=>list.append(el("li",text)));rules.append(list);addHeading(rules,3,"판단 애매");rules.append(el("p","얼굴 특징은 보이지만 인접한 범주 중 하나를 신뢰성 있게 고르기 어려운 경우입니다."));addHeading(rules,3,"판단 불가");rules.append(el("p","가림, 각도, 조명, 화질 등의 이유로 해당 특징 자체를 충분히 볼 수 없는 경우입니다."));root.append(rules);addHeading(root,2,"독립 평가 확인");root.append(el("p","아래 내용을 모두 확인해야 시작할 수 있습니다. 실명은 수집하지 않습니다."));const box=el("div",undefined,"attest");Object.entries(DATA.attestationCopy).forEach(([key,text])=>{const label=el("label");const input=el("input");input.type="checkbox";input.dataset.attestation=key;label.append(input,el("span",text));box.append(label)});root.append(box);const button=el("button","평가 시작","primary");button.type="button";button.disabled=true;box.addEventListener("change",()=>{button.disabled=!Array.from(box.querySelectorAll("input")).every((input)=>input.checked)});button.addEventListener("click",()=>{state.attested=true;saveState();showReview()});root.append(button);if(Object.keys(state.judgments).length>0)root.append(el("p","이 브라우저에 저장된 진행 상황이 있습니다. 평가 시작을 누르면 이어서 진행합니다.","status"))}
function appendDetails(card,axis){const details=el("details",undefined,"details");details.append(el("summary","기준 자세히 보기"));const body=el("div",undefined,"detail-block");addHeading(body,3,"무엇을 보는지");body.append(el("p",axis.content.observableTarget));addHeading(body,3,"얼굴 안 기준");body.append(el("p",axis.content.referenceFrame));addHeading(body,3,"선택지 기준");Object.entries(axis.content.valueDefinitions).forEach(([token,text])=>{const p=el("p",undefined,"value-def");const strong=el("strong",DATA.tokenLabels[token]+": ");p.append(strong,document.createTextNode(text));body.append(p)});addHeading(body,3,"비슷한 선택지 구분");const contrast=el("ul");axis.content.neighborContrasts.forEach((text)=>contrast.append(el("li",text)));body.append(contrast);addHeading(body,3,"판단 애매 기준");const ambiguous=el("ul");axis.content.ambiguityRules.forEach((text)=>ambiguous.append(el("li",text)));body.append(ambiguous);addHeading(body,3,"판단 불가 기준");const impossible=el("ul");axis.content.notAssessableConditions.forEach((text)=>impossible.append(el("li",text)));body.append(impossible);addHeading(body,3,"주의할 이미지 조건");body.append(el("p",axis.content.imageConditionWarnings.join(", ")));addHeading(body,3,"검토 안내");body.append(el("p",axis.content.humanReviewerInstruction));details.append(body);card.append(details)}
function responseButton(j,token){const button=el("button",DATA.tokenLabels[token],"chip");button.type="button";button.dataset.response=token;button.setAttribute("aria-pressed",String(j.response===token));button.addEventListener("click",()=>{j.response=token;j.notAssessableReasonCodes=[];if(token==="not_assessable")j.confidence="not_applicable";else if(token==="uncertain"&&j.confidence==="high")j.confidence=null;else if(j.confidence==="not_applicable")j.confidence=null;saveState();renderPage()});return button}
function renderAxis(axis,index,item){const j=getJudgment(item.reviewItemId,axis);const card=el("article",undefined,"axis-card");card.dataset.axisPath=axis.axisPath;card.append(el("div",index<8?"주요 축":"검증 축","axis-kind"));addHeading(card,2,(index+1)+". "+axis.content.title);card.append(el("p",axis.content.shortInstruction));card.append(el("div","응답","label"));const responses=el("div",undefined,"chips");[...axis.enumOptions,"uncertain","not_assessable"].forEach((token)=>responses.append(responseButton(j,token)));card.append(responses);if(j.response&&j.response!=="not_assessable"){card.append(el("div","확신도","label"));const confidence=el("div",undefined,"chips");const levels=j.response==="uncertain"?["low","medium"]:["low","medium","high"];levels.forEach((token)=>{const button=el("button",DATA.tokenLabels[token],"chip");button.type="button";button.dataset.confidence=token;button.setAttribute("aria-pressed",String(j.confidence===token));button.addEventListener("click",()=>{j.confidence=token;saveState();renderPage()});confidence.append(button)});card.append(confidence)}if(j.response==="not_assessable"){card.append(el("div","판단 불가 이유(하나 이상 선택)","label"));const reasons=el("div",undefined,"reasons");Object.entries(DATA.reasonLabels).forEach(([code,text])=>{const label=el("label",undefined,"reason");const input=el("input");input.type="checkbox";input.dataset.reason=code;input.checked=j.notAssessableReasonCodes.includes(code);input.addEventListener("change",()=>{j.notAssessableReasonCodes=input.checked?[...j.notAssessableReasonCodes,code]:j.notAssessableReasonCodes.filter((value)=>value!==code);saveState();renderPage()});label.append(input,el("span",text));reasons.append(label)});card.append(reasons)}appendDetails(card,axis);return card}
function currentItem(){return DATA.items[state.imageIndex]}
function renderPage(){const item=currentItem();byId("photo-count").textContent="사진 "+(state.imageIndex+1)+" / "+DATA.items.length;byId("item-label").textContent="항목 "+String(state.imageIndex+1).padStart(2,"0");byId("progress-label").textContent=(state.imageIndex+1)+" / "+DATA.items.length;byId("progress-bar").style.width=(((state.imageIndex+1)/DATA.items.length)*100)+"%";const image=byId("review-image");if(image.getAttribute("src")!==item.assetPath)image.src=item.assetPath;byId("axis-list").replaceChildren(...AXES.map((axis,index)=>renderAxis(axis,index,item)));byId("error").textContent="";byId("prev").disabled=state.imageIndex===0;const next=byId("next");next.textContent=state.imageIndex===DATA.items.length-1?"최종 제출":"다음 사진";next.disabled=false}
function validateCurrent(){const item=currentItem();return AXES.every((axis)=>isValid(getJudgment(item.reviewItemId,axis),axis))}
function previous(){if(state.imageIndex>0){state.imageIndex-=1;saveState();renderPage();window.scrollTo(0,0)}}
function orderedJudgments(){return DATA.items.flatMap((item)=>AXES.map((axis)=>getJudgment(item.reviewItemId,axis)))}
async function submit(){const judgments=orderedJudgments();if(!judgments.every((judgment,index)=>isValid(judgment,AXES[index%AXES.length]))){byId("error").textContent="아직 완료되지 않은 문항이 있습니다.";return}const next=byId("next");next.disabled=true;next.textContent="제출 중…";const payload={schemaVersion:DATA.schemaVersion,intakeVersion:DATA.intakeVersion,campaignKey:DATA.campaignKey,distributionMode:DATA.distributionMode,sessionId:state.sessionId,sourceAuthorityDigest:DATA.sourceAuthorityDigest,targetAxisDefinitionDigest:DATA.targetAxisDefinitionDigest,hostedSetAuthorityDigest:DATA.hostedSetAuthorityDigest,protocolVersion:DATA.protocolVersion,uiVersion:DATA.uiVersion,startedAt:state.startedAt,clientSubmittedAt:new Date().toISOString(),independenceAttestation:DATA.attestationValue,judgments,completion:{completed:true,imageCount:DATA.items.length,judgmentCount:judgments.length,primaryAxisCount:8,validationAxisCount:2}};try{const headers={"Content-Type":"application/json","x-face-lab-review-token":DATA.accessToken};if(DATA.testMode)headers["x-face-lab-test-submission"]="1";const response=await fetch(DATA.submitEndpoint,{method:"POST",headers,body:JSON.stringify(payload),credentials:"same-origin",cache:"no-store"});const result=await response.json();if(!response.ok||!result.ok)throw new Error(result.error||"submit_failed");localStorage.removeItem(STORAGE_KEY);byId("review").classList.add("hidden");const done=byId("done");done.classList.remove("hidden");done.replaceChildren(el("h1","제출이 완료되었습니다."),el("p","응답이 안전하게 저장되었습니다. 이제 이 창을 닫아도 됩니다."))}catch{next.disabled=false;next.textContent="최종 제출";byId("error").textContent="제출하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요."}}
function next(){if(!validateCurrent()){byId("error").textContent="현재 사진의 모든 문항에서 응답과 필요한 확신도 또는 이유를 선택해 주세요.";return}if(state.imageIndex<DATA.items.length-1){state.imageIndex+=1;saveState();renderPage();window.scrollTo(0,0)}else{submit()}}
function showReview(){byId("start").classList.add("hidden");byId("review").classList.remove("hidden");renderPage()}
byId("prev").addEventListener("click",previous);byId("next").addEventListener("click",next);renderStart();if(state.attested)showReview();
</script>
</body>
</html>\n`;
}
