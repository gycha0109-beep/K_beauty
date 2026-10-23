import {readFileSync,writeFileSync,existsSync,realpathSync} from "node:fs";
import {resolve,dirname,relative,sep,extname,basename} from "node:path";
import {fileURLToPath} from "node:url";
import {FACE_LAB_OBSERVATION_DEFINITIONS} from "../lib/face-lab-observation-contract.js";

export const LOCAL_OBSERVATION_REVIEW_VERSION="face-lab-sc06f-local-observation-draft-v1";
export function buildStyleCheckLocalObservationReviewHtml(preflight){
  if(preflight?.status!=="preflight_only_not_style_validation"||
     preflight.photoCount!==preflight.photos?.length||
     preflight.photos.length===0||
     preflight.photos.some(p=>typeof p.fileName!=="string"||/[\\/]/.test(p.fileName)||
       typeof p.headerReadable!=="boolean"))
    throw Error("sc06e_preflight_invalid");
  const definitions=Object.entries(FACE_LAB_OBSERVATION_DEFINITIONS)
    .flatMap(([group,fields])=>Object.entries(fields).map(([key,values])=>({
      group,key,values,multi:key==="focalFeatures"
    })));
  if(definitions.length!==22)throw Error("unexpected_observation_field_count");
  const model={schemaVersion:LOCAL_OBSERVATION_REVIEW_VERSION,
    photos:preflight.photos.map((p,i)=>({
      sampleRef:"P"+String(i+1).padStart(2,"0"),fileName:p.fileName,
      headerReadable:p.headerReadable
    })),definitions};
  return HTML.replace("__REVIEW_DATA__",JSON.stringify(model).replace(/</g,"\\u003c"));
}
const HTML=String.raw`<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src blob:; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'">
<title>Face Lab · 로컬 얼굴 관찰 검토</title>
<style>
:root{font-family:system-ui,"Segoe UI",sans-serif;color-scheme:light}
*{box-sizing:border-box} body{margin:0;background:#eef3f5;color:#21323b}
main{max-width:1150px;margin:auto;padding:24px 18px 65px}
h1{font-size:clamp(24px,3vw,33px);margin:4px 0 8px}
p{line-height:1.55;color:#536977}
header{display:flex;justify-content:space-between;gap:18px;align-items:center}
.panel{background:#fff;border:1px solid #dae3e7;border-radius:16px;padding:19px;margin:16px 0}
.warn{background:#fff7e8;border-color:#e9d2a5;font-size:14px;line-height:1.65}
.progress{font-size:14px;color:#27695c;font-weight:750;white-space:nowrap}
.columns{display:grid;grid-template-columns:minmax(240px,.78fr) minmax(0,1.4fr);gap:18px;align-items:start}
.side{position:sticky;top:14px} img{display:block;width:100%;max-height:480px;object-fit:contain;background:#e6ecf0;border-radius:12px}
#empty{padding:90px 10px;text-align:center;color:#697d8c;background:#e6ecf0;border-radius:12px}
input[type=file]{width:100%;margin:12px 0} select,input[type=text],textarea{font:inherit;border:1px solid #cbd7dc;border-radius:8px;padding:9px;width:100%;background:#fff}
.field{display:grid;grid-template-columns:minmax(140px,.8fr) minmax(140px,1fr);gap:10px;align-items:center;border-bottom:1px solid #ecf0f2;padding:12px 0}
.field strong{display:block;font-size:13px}.field small{font-size:11px;color:#607887}
.field input{grid-column:1/-1;font-size:12px}
section.group{padding-top:5px} .group h2{font-size:16px;margin:12px 0 4px}
button{cursor:pointer;border:1px solid #bdd3cf;border-radius:10px;padding:11px 16px;background:#f4faf8;font-weight:750}
button.primary{background:#1e7767;color:#fff}button:disabled{opacity:.4;cursor:not-allowed}
footer{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:15px}
#status{font-size:13px;color:#486275}
@media(max-width:790px){.columns{grid-template-columns:1fr}.side{position:static}header{align-items:flex-start} img{max-height:360px}}
@media(max-width:480px){main{padding:15px 10px 42px}.panel{padding:13px}.field{grid-template-columns:1fr}.field input{grid-column:auto}}
</style></head><body><main>
<header><div><small>BEJEWELY / FACE LAB · LOCAL RESEARCH</small><h1>얼굴 관찰값 검토</h1><p>사진별 22개 관찰 항목을 독립적으로 검토하는 로컬 초안입니다.</p></div><div id="counter" class="progress">1 / 12</div></header>
<div class="panel warn"><b>연구용 초안 · 품질 및 권리 미확정</b><div>사진의 사용 권한과 실제 관찰값은 아직 검증되지 않았습니다. 합성 사례의 얼굴 특징을 실제 사진에 자동 대입하지 마세요. 입력 내용은 정식 Human Judgment가 아니며, 어떤 추천·시뮬레이션도 활성화하지 않습니다. 원본 사진·파일명·URL은 JSON에 내보내지 않습니다.</div></div>
<div class="columns"><aside class="side panel">
<h2 id="sampleTitle">사진 P01</h2><p id="expectedName"></p>
<div id="empty">로컬 사진을 선택하세요.</div><img id="preview" alt="검토용 얼굴 사진" hidden>
<label>사진 선택<input id="photo" type="file" accept="image/jpeg,image/png,image/webp"></label>
<p id="photoStatus">파일을 불러오기 전입니다.</p>
<label for="notes">전체 관찰 메모 (선택)</label><textarea id="notes" rows="3" maxlength="700" placeholder="개인 이름이나 연락처는 입력하지 마세요."></textarea>
<footer><button id="previous">이전 사진</button><button id="next">다음 사진</button></footer>
</aside><section class="panel">
<div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><h2>22개 관찰 항목</h2><b id="rated">0 / 22</b></div>
<p>각 항목에 관찰값 또는 판단 유보를 기록하세요. 관찰값을 선택할 때는 눈으로 확인한 근거를 남기세요. 비워 둔 항목은 검토하지 않은 것으로 기록합니다.</p>
<div id="groups"></div>
<footer><button id="export" class="primary" disabled>로컬 검토 초안 JSON 내보내기</button><span id="status">사진 입력과 최소 1개 항목 선택이 필요합니다.</span></footer>
</section></div></main>
<script type="application/json" id="review-data">__REVIEW_DATA__</script>
<script>
"use strict";
const packet=JSON.parse(document.getElementById("review-data").textContent);
const current=packet.photos.map(()=>({url:null,loaded:false,fields:{},notes:""}));
const labels={outline:"얼굴 윤곽",vertical:"세로 비율",eyes:"눈",featureLayout:"이목구비 배치",visualLanguage:"시각적 인상",colorAppearance:"사진상 색 표현"};
const el=id=>document.getElementById(id);let position=0;
function completeness(x){return packet.definitions.filter(d=>x.fields[d.group+"."+d.key]?.choice).length}
function canExport(){return current.some(x=>x.loaded&&completeness(x)>0)}
function updateFooter(){
 el("rated").textContent=completeness(current[position])+" / 22";
 el("export").disabled=!canExport();
 el("status").textContent=current[position].loaded?"저장되지 않은 로컬 초안입니다.":"현재 사진을 먼저 선택하세요.";
}
function create(tag,text){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;}
function render(){
 const sample=packet.photos[position],st=current[position];
 el("counter").textContent=(position+1)+" / "+packet.photos.length;
 el("sampleTitle").textContent="사진 "+sample.sampleRef;
 el("expectedName").textContent="선택할 파일: "+sample.fileName;
 el("photo").value="";el("photoStatus").textContent=st.loaded?"사진 로딩 완료":"사진 미선택";
 el("empty").hidden=st.loaded;el("preview").hidden=!st.loaded;
 if(st.loaded)el("preview").src=st.url;else el("preview").removeAttribute("src");
 el("notes").value=st.notes;el("previous").disabled=position===0;
 el("next").disabled=position===packet.photos.length-1;
 const host=el("groups");host.replaceChildren();let group="";
 for(const field of packet.definitions){
  if(field.group!==group){group=field.group;const h=create("h2",labels[group]||group);const wrap=create("section");wrap.className="group";wrap.append(h);host.append(wrap);}
  const row=create("div");row.className="field";const label=create("label");const key=field.group+"."+field.key;
  const strong=create("strong",field.key);const small=create("small",key);
  label.append(strong,small);
  const select=create("select");select.id="value-"+key;select.append(new Option("선택 안 함",""),new Option("판단 유보 (uncertain)","uncertain"),new Option("판단 불가 (not_assessable)","not_assessable"));
  field.values.forEach(v=>select.append(new Option(v,v)));
  select.value=st.fields[key]?.choice||"";
  select.addEventListener("change",()=>{const state=current[position];const item=state.fields[key]||{choice:"",evidence:""};item.choice=select.value;state.fields[key]=item;updateFooter();});
  const note=create("input");note.type="text";note.maxLength=240;note.placeholder="관찰 근거 또는 판단 불가 사유 (선택)";
  note.value=st.fields[key]?.evidence||"";
  note.addEventListener("input",()=>{const state=current[position];const item=state.fields[key]||{choice:"",evidence:""};item.evidence=note.value;state.fields[key]=item;});
  row.append(label,select,note);host.lastElementChild.append(row);
 }
 updateFooter();
}
el("photo").addEventListener("change",event=>{
 const file=event.target.files?.[0],sample=packet.photos[position],st=current[position];if(!file)return;
 if(file.name!==sample.fileName || !["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>20*1024*1024){
  event.target.value="";el("photoStatus").textContent="파일명·유형·크기를 확인하세요.";return;
 }
 const url=URL.createObjectURL(file),check=new Image();
 check.onload=()=>{
  if(check.naturalWidth<1||check.naturalHeight<1){URL.revokeObjectURL(url);return;}
  if(st.url)URL.revokeObjectURL(st.url);st.url=url;st.loaded=true;st.fields={};st.notes="";render();
 };
 check.onerror=()=>{URL.revokeObjectURL(url);el("photoStatus").textContent="이미지 해독 실패";};
 check.src=url;
});
el("notes").addEventListener("input",event=>{current[position].notes=event.target.value.slice(0,700)});
el("previous").addEventListener("click",()=>{if(position>0){position--;render();}});
el("next").addEventListener("click",()=>{if(position<packet.photos.length-1){position++;render();}});
el("export").addEventListener("click",()=>{
 if(!canExport())return;
 const records=current.map((s,i)=>({sampleRef:packet.photos[i].sampleRef,
  photoLocallyLoaded:s.loaded,observations:Object.fromEntries(packet.definitions.filter(d=>s.fields[d.group+"."+d.key]?.choice).map(d=>{
    const key=d.group+"."+d.key,f=s.fields[key];
    return [key,{reviewerDraftChoice:f.choice,
      evidenceNote:f.evidence.trim().slice(0,240),held:["uncertain","not_assessable"].includes(f.choice)}];
  })),notes:s.notes.slice(0,700)})).filter(x=>x.photoLocallyLoaded);
 const out={schemaVersion:packet.schemaVersion,status:"unsealed_exploratory_local_draft",
  sourceType:"manual_unverified_human_inputs",rightsVerified:false,
  observationValidityConfirmed:false,simulationAuthorized:false,
  sourcePhotosStored:false,providerCalls:0,records};
 const blob=new Blob([JSON.stringify(out,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);
 const a=create("a");a.href=url;a.download="face-lab-local-observation-draft.json";document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
});
window.addEventListener("pagehide",()=>current.forEach(s=>{if(s.url)URL.revokeObjectURL(s.url)}));
render();
</script></body></html>`;
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const preflightArg=process.argv.find(s=>s.startsWith("--preflight="))?.slice("--preflight=".length);
 const output=process.argv.find(s=>s.startsWith("--output="))?.slice("--output=".length);
 if(!preflightArg||!output||!resolve(output).toLowerCase().endsWith(".html"))throw Error("require --preflight and --output");
 const abs=resolve(output),repo=realpathSync(process.cwd());
 const rel=relative(repo,abs);
 if(rel===""||rel!==".."&&!rel.startsWith(".."+sep))throw Error("no_repo_output");
 if(existsSync(abs))throw Error("write_once");
 const html=buildStyleCheckLocalObservationReviewHtml(JSON.parse(readFileSync(preflightArg,"utf8")));
 writeFileSync(abs,html,{flag:"wx",mode:0o600});
 console.log(JSON.stringify({ok:true,sampleCount:JSON.parse(readFileSync(preflightArg,"utf8")).photoCount,observationFields:22,photoBytesEmbedded:false,providerCalls:0}));
}