const escapeEmbeddedJson = (value) =>
  JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026");

export function renderNeutralFaceCountReviewHtml({
  model,
  accessToken,
  nonce
}) {
  const embedded = escapeEmbeddedJson({ ...model, accessToken });
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer">
<meta name="robots" content="noindex,nofollow,noarchive">
<title>얼굴 이미지 평가</title>
<style nonce="${nonce}">
:root{color-scheme:light;--ink:#17202a;--muted:#667085;--line:#d9dee7;--paper:#fff;--soft:#f5f7fa;--brand:#0f766e;--brand2:#115e59;--warn:#b42318;--focus:#2563eb}*{box-sizing:border-box}body{margin:0;background:#eef2f5;color:var(--ink);font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","Malgun Gothic",sans-serif;line-height:1.55}button,input{font:inherit}button{min-height:44px}.shell{max-width:900px;margin:auto;padding:24px}.card{background:var(--paper);border:1px solid var(--line);border-radius:18px;box-shadow:0 10px 30px rgba(16,24,40,.06);padding:26px}.hidden{display:none!important}.eyebrow{color:var(--brand);font-weight:800;letter-spacing:.04em}.head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.head h1,.start h1{font-size:clamp(28px,4vw,40px);line-height:1.2;margin:6px 0 10px}.lead{font-size:17px;color:#475467}.rules{padding:18px;background:var(--soft);border-radius:14px;margin:18px 0}.attest{display:grid;gap:9px;margin:16px 0}.attest-row{display:flex;gap:10px;align-items:flex-start}.attest-row span{flex:1}.confirm{display:flex;gap:10px;align-items:flex-start;padding:12px;border:1px solid var(--line);border-radius:12px;margin:16px 0;cursor:pointer}.confirm input{width:20px;height:20px;flex:0 0 auto}.image{display:block;width:100%;max-height:58vh;object-fit:contain;background:#e8ecef;border-radius:14px;margin:18px 0}.options{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.chip,.primary,.secondary{border-radius:12px;padding:10px 14px;font-weight:800;cursor:pointer}.chip{border:1px solid #aeb7c2;background:#fff}.chip[aria-pressed="true"]{background:var(--brand);border-color:var(--brand);color:#fff}.primary{border:0;color:#fff;background:var(--brand)}.primary:hover{background:var(--brand2)}.primary:disabled{background:#aab4c0;cursor:not-allowed}.secondary{border:0;background:#e8eeef;color:#24323a}.nav{display:flex;justify-content:space-between;gap:12px;margin-top:20px;padding-top:18px;border-top:1px solid var(--line)}.progress{color:var(--muted);font-weight:800;white-space:nowrap}.error{min-height:24px;color:var(--warn);font-weight:800;margin:12px 0 0}.status{padding:12px 14px;background:#f0fdfa;border-left:4px solid var(--brand);border-radius:10px;margin:14px 0}.chip:focus-visible,.primary:focus-visible,.secondary:focus-visible,.confirm:focus-within{outline:3px solid var(--focus);outline-offset:2px}@media(max-width:700px){.shell{padding:8px}.card{padding:18px 14px;border-radius:14px}.head{display:block}.progress{margin-top:6px}.image{max-height:48vh}.options{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
</head>
<body>
<main class="shell">
<section id="start" class="card start"></section>
<section id="review" class="card hidden">
  <div class="head"><div><div class="eyebrow">1단계 · 중립 관찰</div><h1 id="title"></h1></div><div id="progress" class="progress"></div></div>
  <p id="instruction" class="lead"></p>
  <div class="status">사진의 분위기나 인상을 평가하지 말고, 눈·코·입 등 얼굴의 정확한 특징을 판별할 수 있는 정도만 기준으로 확인해 주세요.</div>
  <img id="image" class="image" alt="얼굴 특징을 판별할 수 있는 사람 수를 확인할 사진">
  <div id="options" class="options"></div>
  <div id="error" class="error" role="alert"></div>
  <nav class="nav"><button id="prev" class="secondary" type="button">이전 사진</button><button id="next" class="primary" type="button">다음 사진</button></nav>
</section>
</main>
<script nonce="${nonce}">
"use strict";
const DATA=${embedded};
const STORAGE_KEY=["face-lab-neutral-count",DATA.authorityDigest].join("::");
const byId=(id)=>document.getElementById(id);
const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node};
const makeState=()=>({authorityDigest:DATA.authorityDigest,sessionId:"hsi_"+crypto.randomUUID(),startedAt:new Date().toISOString(),attested:false,imageIndex:0,responses:{}});
function loadState(){try{const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY));if(parsed&&parsed.authorityDigest===DATA.authorityDigest&&typeof parsed.sessionId==="string"&&parsed.responses)return parsed}catch{}return makeState()}
let state=loadState();
function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}
function renderStart(){const root=byId("start");root.replaceChildren();root.append(el("div","공용 평가 · 1단계","eyebrow"));root.append(el("h1","얼굴 수 중립 평가"));root.append(el("p","먼저 8장의 이미지에서 얼굴 특징을 판별할 수 있을 정도로 보이는 사람 수를 독립적으로 판단합니다. 이 응답은 뒤의 Face Lab 세부 평가와 별도로 저장됩니다.","lead"));const rules=el("div",undefined,"rules");Object.values(DATA.attestationCopy).forEach((text)=>{const row=el("div",undefined,"attest-row");row.append(el("span","• "+text));rules.append(row)});root.append(rules);const confirm=el("label",undefined,"confirm");const input=el("input");input.type="checkbox";input.checked=state.attested===true;confirm.append(input,el("span","위 내용을 모두 확인했고, 다른 정보에 의존하지 않고 독립적으로 평가하겠습니다."));root.append(confirm);const button=el("button","1단계 시작","primary");button.type="button";button.disabled=!input.checked;input.addEventListener("change",()=>{button.disabled=!input.checked});button.addEventListener("click",()=>{if(!input.checked)return;state.attested=true;saveState();showReview()});root.append(button)}
function item(){return DATA.items[state.imageIndex]}
function render(){const current=item();byId("title").textContent=DATA.title;byId("instruction").textContent=DATA.instruction;byId("progress").textContent=(state.imageIndex+1)+" / "+DATA.items.length;const image=byId("image");if(image.getAttribute("src")!==current.assetPath)image.src=current.assetPath;const options=byId("options");options.replaceChildren();DATA.responseTokens.forEach((token)=>{const button=document.createElement("button");button.type="button";button.className="chip";button.textContent=DATA.responseLabels[token];button.setAttribute("aria-pressed",String(state.responses[current.reviewItemId]===token));button.addEventListener("click",()=>{state.responses[current.reviewItemId]=token;saveState();render()});options.append(button)});byId("prev").disabled=state.imageIndex===0;byId("next").textContent=state.imageIndex===DATA.items.length-1?"1단계 제출":"다음 사진";byId("error").textContent=""}
function previous(){if(state.imageIndex>0){state.imageIndex-=1;saveState();render();window.scrollTo(0,0)}}
async function submit(){if(state.attested!==true){byId("error").textContent="독립 평가 확인이 필요합니다.";return}const responses=DATA.items.map((entry)=>({reviewItemId:entry.reviewItemId,response:state.responses[entry.reviewItemId]}));if(responses.some((entry)=>!DATA.responseTokens.includes(entry.response))){byId("error").textContent="8장의 사진 모두에서 하나씩 선택해 주세요.";return}const next=byId("next");next.disabled=true;next.textContent="제출 중…";const payload={schemaVersion:"face-count-neutral-submission-v1",campaignKey:DATA.campaignKey,intakeVersion:DATA.intakeVersion,authorityDigest:DATA.authorityDigest,sessionId:state.sessionId,startedAt:state.startedAt,clientSubmittedAt:new Date().toISOString(),independenceAttestation:DATA.attestationValue,responses,completion:{completed:true,imageCount:DATA.items.length,responseCount:responses.length}};try{const response=await fetch(DATA.submitEndpoint,{method:"POST",headers:{"Content-Type":"application/json","x-face-lab-review-token":DATA.accessToken},body:JSON.stringify(payload),credentials:"same-origin",cache:"no-store"});const result=await response.json();if(!response.ok||!result.ok)throw new Error(result.error||"submit_failed");localStorage.removeItem(STORAGE_KEY);window.location.reload()}catch{next.disabled=false;next.textContent="1단계 제출";byId("error").textContent="응답을 저장하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요."}}
function next(){const current=item();if(!DATA.responseTokens.includes(state.responses[current.reviewItemId])){byId("error").textContent="현재 사진에서 하나를 선택해 주세요.";return}if(state.imageIndex<DATA.items.length-1){state.imageIndex+=1;saveState();render();window.scrollTo(0,0)}else{submit()}}
function showReview(){byId("start").classList.add("hidden");byId("review").classList.remove("hidden");render()}
byId("prev").addEventListener("click",previous);byId("next").addEventListener("click",next);renderStart();if(state.attested)showReview();
</script>
</body>
</html>`;
}
