#!/usr/bin/env node
/**
 * OFFLINE / LOCAL ONLY. AI-Hub 71645 acne point-review workbench.
 *
 * node scripts/review-aihub-71645-acne-local.mjs --self-test
 * node scripts/review-aihub-71645-acne-local.mjs --labels "D:\private\VL" --images "D:\private\VS" --out "D:\private\acne-review.html" --limit 18
 *
 * Unzip VL.zip and VS.zip LOCALLY before running. Never upload original or HTML report.
 * HTML references JPGs by file:// URL; image bytes are NOT embedded, copied or sent.
 * No web server, network calls, DB, model inference or localStorage are used.
 */
import { readdirSync, readFileSync, lstatSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const TYPES = new Set(["papule", "comedone", "pustule", "nodule", "cyst"]);
const valid = n => typeof n === "number" && Number.isFinite(n);
const integer = n => Number.isInteger(n) && n > 0;
const normalName = s => basename(String(s)).replace(/ \(1\)(?=\.jpe?g$)/i, "").toLowerCase();
const safeNumber = n => (typeof n === "number" || (typeof n === "string" && n.trim())) && Number.isFinite(Number(n)) ? Number(n) : null;

function xyPoint(p) {
  if (!p) return null;
  if (Array.isArray(p) && p.length >= 2 && safeNumber(p[0]) !== null && safeNumber(p[1]) !== null) {
    return {x: Number(p[0]), y: Number(p[1])};
  }
  if (typeof p === "object" && !Array.isArray(p) && safeNumber(p.x) !== null && safeNumber(p.y) !== null) {
    return {x: Number(p.x), y: Number(p.y)};
  }
  return null;
}
function lesionPoint(lesion) {
  if (!lesion || typeof lesion !== "object") return {error: "invalid_lesion"};
  const points = lesion.points ?? lesion.point ?? lesion.location;
  if (!points) return {error: "missing_points"};
  const direct = xyPoint(points);
  if (direct) return {point: direct};
  if (Array.isArray(points) && points.length === 1) {
    const single = xyPoint(points[0]);
    if (single) return {point: single};
  }
  // Refuse to guess whether multiple points are bbox vertices or multiple lesions.
  return {error: "ambiguous_geometry"};
}
function collectAcne(json) {
  const rows = [];
  const seen = new WeakSet();
  function walk(node, context, depth) {
    if (!node || typeof node !== "object" || depth > 12 || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) { for (const x of node) walk(x, context, depth + 1); return; }
    const image = typeof node.filename === "string" ? node.filename :
      typeof node.image_name === "string" ? node.image_name : context.image;
    const width = safeNumber(node.width) ?? context.width;
    const height = safeNumber(node.height) ?? context.height;
    if ("acne" in node && Array.isArray(node.acne)) {
      rows.push({image, width, height, acne: node.acne});
    }
    for (const [key, val] of Object.entries(node)) {
      if (["acne", "points", "face_box", "expert"].includes(key)) continue;
      if (val && typeof val === "object") walk(val, {image,width,height}, depth + 1);
    }
  }
  walk(json, {image:null, width:null, height:null}, 0);
  return rows;
}
function scan(path, allowed, cap=160000) {
  const items = [], stack = [resolve(path)];
  while (stack.length) {
    const at = stack.pop();
    const s = lstatSync(at);
    if (s.isSymbolicLink()) continue;
    if (s.isDirectory()) {
      for (const e of readdirSync(at, {withFileTypes:true})) {
        if (e.isSymbolicLink()) continue;
        if (e.isDirectory() || e.isFile()) stack.push(join(at,e.name));
      }
    } else if (s.isFile() && allowed.test(extname(at))) {
      items.push(at);
      if (items.length > cap) throw Error("Too many source files for bounded review.");
    }
  }
  return items;
}
function imageDimensions(buffer) {
  // Read JPEG dimensions from SOF; do not rely on label-provided width/height.
  if (buffer.length < 8 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  for (let i=2; i+9 < buffer.length;) {
    if (buffer[i] !== 0xff) { i++; continue; }
    let j=i+1;
    while (j<buffer.length && buffer[j]===0xff) j++;
    const code=buffer[j];
    if (code===0xd9 || code===0xda) break;
    if (code===0xd8 || code===0x01 || (code>=0xd0 && code<=0xd7)) { i=j+1; continue; }
    if (j+3>=buffer.length) break;
    const length=buffer.readUInt16BE(j+1);
    if (length<2 || j+1+length>buffer.length) break;
    if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(code) && length>=7) {
      return {height:buffer.readUInt16BE(j+4),width:buffer.readUInt16BE(j+6)};
    }
    i=j+1+length;
  }
  return null;
}
function parseLabels(files) {
  const images=new Map(), counters={files:0,jsonErrors:0,acneRows:0,unresolvedFilename:0,
    rejectedGeometry:0,rejectedType:0,pointOutOfBounds:0,duplicatePoints:0,annotations:0,emptyOrNull:0};
  for (const file of files) {
    counters.files++;
    let parsed;
    try { parsed=JSON.parse(readFileSync(file,"utf8")); } catch { counters.jsonErrors++; continue; }
    const rows=collectAcne(parsed);
    for(const r of rows) {
      counters.acneRows++;
      if(!r.image){counters.unresolvedFilename++;continue;}
      const name=normalName(r.image);
      if(!/\.jpe?g$/i.test(name)){counters.unresolvedFilename++;continue;}
      if(!r.acne.length){counters.emptyOrNull++;continue;}
      let item=images.get(name);
      if(!item){item={name,width:r.width,height:r.height,points:[],seen:new Set()};images.set(name,item);}
      if(r.width && item.width && r.width!==item.width || r.height && item.height && r.height!==item.height){
        counters.rejectedGeometry+=r.acne.length;continue;
      }
      for(const entry of r.acne) {
        const type=String(entry?.type??entry?.acne_type??entry?.label??"").toLowerCase();
        if(!TYPES.has(type)){counters.rejectedType++;continue;}
        const p=lesionPoint(entry);
        if(!p.point){counters.rejectedGeometry++;continue;}
        if(p.point.x<0||p.point.y<0 ||
          (integer(item.width) && p.point.x>=item.width) ||
          (integer(item.height) && p.point.y>=item.height)){counters.pointOutOfBounds++;continue;}
        const key=[type,p.point.x,p.point.y].join(":");
        if(item.seen.has(key)){counters.duplicatePoints++;continue;}
        item.seen.add(key);
        item.points.push({type,x:p.point.x,y:p.point.y});
        counters.annotations++;
      }
    }
  }
  return {images, counters};
}
function resolveCases(labelData, imageFiles) {
  const imgs=new Map(), dupImages=new Set();
  for(const file of imageFiles) {
    const key=normalName(file);
    if(imgs.has(key)) dupImages.add(key);
    else imgs.set(key,file);
  }
  const cases=[],skipped={noPhoto:0,ambiguousImageName:0,badJpeg:0,sizeConflict:0,withoutQualifiedPoint:0};
  for(const r of labelData.images.values()) {
    if(!r.points.length){skipped.withoutQualifiedPoint++;continue;}
    if(dupImages.has(r.name)){skipped.ambiguousImageName++;continue;}
    const file=imgs.get(r.name);
    if(!file){skipped.noPhoto++;continue;}
    const dimensions=imageDimensions(readFileSync(file));
    if(!dimensions){skipped.badJpeg++;continue;}
    if((integer(r.width) && r.width!==dimensions.width) ||
       (integer(r.height) && r.height!==dimensions.height)){skipped.sizeConflict++;continue;}
    const inImage = r.points.filter(p=>p.x>=0&&p.y>=0&&p.x<dimensions.width&&p.y<dimensions.height);
    if(inImage.length!==r.points.length){skipped.sizeConflict++;continue;}
    cases.push({file,name:r.name,width:dimensions.width,height:dimensions.height,points:inImage});
  }
  return {cases,skipped};
}
function chooseCases(cases, limit) {
  // Deterministic across same metadata. Low / mid / high burden cases included.
  const sorted=[...cases].sort((a,b)=>a.points.length-b.points.length||a.name.localeCompare(b.name));
  const chosen=[];
  if(!sorted.length)return chosen;
  const used=new Set();
  for(let i=0;i<limit && used.size<sorted.length;i++){
    const fraction=limit===1?0.5:(i/(limit-1));
    let target=Math.min(sorted.length-1,Math.round(fraction*(sorted.length-1)));
    while(used.has(target))target=(target+1)%sorted.length;
    used.add(target);
    chosen.push(sorted[target]);
  }
  return chosen;
}
function escapeHtml(str){return String(str).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function htmlReport(cases, info) {
  const cards=cases.map((c,i)=>{
    const url=pathToFileURL(c.file).href;
    const dots=c.points.map((p,k)=>{
      const circleRadius=Math.max(5,Math.round(Math.min(c.width,c.height)*0.009));
      return '<g><circle cx="'+p.x+'" cy="'+p.y+'" r="'+circleRadius+'" fill="none" stroke="#f5de35" stroke-width="'+Math.max(2,Math.round(circleRadius/3))+'"/><text x="'+(p.x+circleRadius)+'" y="'+p.y+'" fill="#fff" stroke="#252525" stroke-width="1.8" paint-order="stroke" font-size="'+Math.max(13,circleRadius+5)+'">'+(k+1)+'</text></g>';
    }).join("");
    const rows=c.points.map((p,k)=>'<div class="lesion"><b>'+(k+1)+'</b> '+escapeHtml(p.type)+' <label><select data-case="'+i+'" data-point="'+k+'"><option value="unreviewed">미검수</option><option value="match">정확</option><option value="off_target">위치 오류</option><option value="wrong_type">유형 오류</option><option value="uncertain">판정 어려움</option></select></label></div>').join("");
    return '<section><h2>표본 '+(i+1)+' <small>'+c.points.length+'개 좌표</small></h2><div class="canvas"><img alt="로컬 원본 얼굴 사진" src="'+escapeHtml(url)+'"/><svg viewBox="0 0 '+c.width+' '+c.height+'" preserveAspectRatio="xMidYMid meet" aria-label="원본 좌표 오버레이">'+dots+'</svg></div><details><summary>병변별 검수 ('+c.points.length+'개)</summary><div class="labels">'+rows+'</div></details></section>';
  }).join("");
  const minimal={imageCandidates:info.imageCandidates,validImageMatches:info.validImageMatches,selectedCases:cases.length,totalPoints:cases.reduce((n,c)=>n+c.points.length,0),counters:info.counters,skipped:info.skipped};
  const safe=JSON.stringify(minimal).replace(/</g,"\\u003c");
  return '<!doctype html><html lang="ko"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>'+
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src file:; style-src \'unsafe-inline\'; script-src \'unsafe-inline\';"/>'+
    '<title>AI-Hub 여드름 좌표 로컬 검수</title><style>body{margin:0;background:#10141d;color:#e7eaf0;font:15px system-ui,sans-serif;padding:26px;max-width:1240px;margin:auto}section{border:1px solid #344154;border-radius:16px;margin:22px 0;padding:15px;background:#1a2330}h1{font-size:22px}h2{font-size:18px}small{font-weight:normal;color:#9cacc1} .canvas{position:relative;display:inline-block;width:100%;max-width:800px}.canvas img{display:block;width:100%;height:auto}.canvas svg{position:absolute;inset:0;width:100%;height:100%}details{margin-top:12px}.labels{display:flex;flex-wrap:wrap;gap:8px;padding-top:8px}.lesion{background:#293547;padding:8px;border-radius:8px}select,button{background:#242f44;color:#fff;border:1px solid #8191a4;border-radius:8px;padding:8px}button{cursor:pointer;padding:11px}.warning{color:#ffdb76}</style></head><body>'+
    '<h1>AI-Hub 71645 여드름 좌표 — 오프라인 육안 검수</h1>'+
    '<p class="warning">원본 사진은 이 컴퓨터에서만 열립니다. HTML 파일은 절대 업로드·공유하지 마세요. 사진이 보이지 않으면 원천 데이터 경로를 확인하세요. 좌표는 자동 추론 결과가 아닌 원본 라벨입니다.</p>'+
    '<p>대상 '+cases.length+'장 · 개별 위치 '+minimal.totalPoints+'개. 웹 서버, 네트워크, 외부 API, localStorage 사용 없음.</p>'+
    '<button id="export">검수 결과 다운로드 (사진·파일명 제외)</button><p id="status" role="status"></p>'+
    cards+
    '<script>const stats='+safe+';document.getElementById("export").addEventListener("click",()=>{const flags=[...document.querySelectorAll("select")].map(s=>({caseIndex:Number(s.dataset.case)+1,lesionIndex:Number(s.dataset.point)+1,status:s.value}));const reviewed=flags.filter(x=>x.status!=="unreviewed");const tallies={};for(const f of reviewed)tallies[f.status]=(tallies[f.status]||0)+1;const report={schema:"aihub-71645-point-review-v1",scope:"local_visual_label_check",reviewed:reviewed.length,unreviewed:flags.length-reviewed.length,tallies,flags,sourceAudit:{counters:stats.counters,skipped:stats.skipped,imageCandidates:stats.imageCandidates,validImageMatches:stats.validImageMatches}};const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download="aihub-acne-review-summary.json";a.click();URL.revokeObjectURL(url);document.getElementById("status").textContent="사진과 원본 파일명은 포함하지 않은 검수 결과를 저장했습니다.";});</script>'+
    '</body></html>';
}
function selfTest(){
  function yes(cond,message){if(!cond)throw Error(message);}
  const one={filename:"0990_01_F.jpg",width:800,height:600,acne:[
    {type:"papule",points:[[100,200]]},{type:"comedone",points:[{x:500,y:450}]},
    {type:"Circle(Clone)",points:[[20,20]]},{type:"papule",points:[[100,200]]},
    {type:"papule",points:[[900,200]]},{type:"pustule",points:[[1,2],[3,4]]}]};
  const rows=collectAcne({annotations:[one]});
  yes(rows.length===1,"nested JSON parse");
  yes(rows[0].image==="0990_01_F.jpg","image inheritance");
  yes(xyPoint([100,200]).x===100,"array point parse");
  yes(lesionPoint({points:[{x:10,y:22}]}).point.y===22,"object point");
  yes(lesionPoint({points:[[1,2],[3,4]]}).error==="ambiguous_geometry","ambiguous multi-point must block");
  const cases=chooseCases([{name:"a",points:[{}]},{name:"b",points:[{},{}]},{name:"c",points:[{},{},{}]}],3);
  yes(cases.length===3 && new Set(cases.map(x=>x.name)).size===3,"sampling");
  yes(normalName("0990_01_F (1).jpg")==="0990_01_f.jpg","Drive duplicate suffix normalization");
  yes(escapeHtml("<test>")==="&lt;test&gt;","safe html");
  const jpeg=Buffer.from([255,216,255,192,0,17,8,2,88,3,32,3,1,17,0,2,17,1,3,17,1,255,217]);
  yes(imageDimensions(jpeg)?.height===600 && imageDimensions(jpeg)?.width===800,"jpeg dimensions");
  yes(!htmlReport([],{imageCandidates:0,validImageMatches:0,counters:{},skipped:{}}).includes("0990_01_F.jpg"),"no sample leak");
  return {checks:10,pass:true};
}
const args=process.argv.slice(2);
if(args.includes("--self-test")) {
  console.log(JSON.stringify(selfTest()));
} else {
  const get=x=>{const i=args.indexOf(x);return i<0?null:args[i+1]};
  const labels=get("--labels"),images=get("--images"),out=get("--out");
  const limit=Number(get("--limit")??18);
  if(!labels||!images||!out||!Number.isInteger(limit)||limit<1||limit>30) {
    console.error("Usage: node scripts/review-aihub-71645-acne-local.mjs --labels <unpacked VL directory> --images <unpacked VS directory> --out <private local HTML path> [--limit 18]");
    process.exitCode=2;
  } else {
    try {
      const data=parseLabels(scan(labels,/\.json$/i));
      const matched=resolveCases(data,scan(images,/\.jpe?g$/i));
      const cases=chooseCases(matched.cases,limit);
      if(!cases.length) throw Error("No explicitly annotated eligible image matches; check labels schema and VS filename mapping.");
      mkdirSync(dirname(resolve(out)),{recursive:true});
      writeFileSync(resolve(out),htmlReport(cases,{
        imageCandidates:data.images.size,validImageMatches:matched.cases.length,
        counters:data.counters,skipped:matched.skipped
      }),{encoding:"utf8",mode:0o600});
      console.log(JSON.stringify({out:resolve(out),reviewCases:cases.length,reviewPoints:cases.reduce((n,c)=>n+c.points.length,0),
        matchedPhotos:matched.cases.length,pointFailures:data.counters,skipReasons:matched.skipped},null,2));
      if(data.counters.jsonErrors||data.counters.rejectedGeometry||data.counters.rejectedType||
         data.counters.pointOutOfBounds||matched.skipped.badJpeg||matched.skipped.sizeConflict)process.exitCode=1;
    } catch(error) {
      console.error("Local review failed:",error.message);
      process.exitCode=1;
    }
  }
}
