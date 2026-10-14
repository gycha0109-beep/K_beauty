"use client";
import {useEffect,useState} from "react";
import {buildR16IPriceScopeReview} from "@/lib/product-intelligence/r16i-price-scope-review-v1.mjs";

const API="/api/admin/products/r16i-correction-review/approval";
const EVIDENCE="/api/admin/products/r16i-correction-review/evidence";
const FIELDS=[["products.size_ml","제품 용량 ml"],["products.price_min","최저 가격 원"],
  ["products.price_max","최고 가격 원"],["products.unit_price_per_10ml","10ml당 가격"],
  ["products.buy_link","대표 구매 링크"]];
const btn="rounded-lg border border-[#bdd1ed] px-3 py-2 text-sm font-semibold text-[#2b60b4] disabled:opacity-40 dark:border-[#465c79] dark:text-[#b9d3ff]";
const ctl="w-full rounded-lg border border-[#d6e0ed] bg-white p-2.5 text-sm dark:border-[#455267] dark:bg-[#202c3c]";
const light="text-xs leading-6 text-[#69798e] dark:text-[#b0bfd2]";
const value=v=>v===null||v===undefined?"없음":typeof v==="object"?JSON.stringify(v):String(v);
async function load(url,body=null){
 const res=await fetch(url,{method:body?"POST":"GET",credentials:"same-origin",cache:"no-store",
   headers:body?{"Content-Type":"application/json","Accept":"application/json"}:{"Accept":"application/json"},
   body:body?JSON.stringify(body):undefined});
 const json=await res.json().catch(()=>null);
 if(!res.ok||!json?.ok)throw Error(json?.error||"요청 실패");
 return json;
}
export default function R16IR4D8CorrectionApproval({review}){
 const [ledger,setLedger]=useState(null),[evidence,setEvidence]=useState([]),
  [busy,setBusy]=useState(""),[message,setMessage]=useState("");
 const [selected,setSelected]=useState(""),[preview,setPreview]=useState(""),
  [opened,setOpened]=useState(false),[verdictReason,setVerdictReason]=useState("");
 const [field,setField]=useState("products.size_ml"),[after,setAfter]=useState(""),
  [changes,setChanges]=useState([]),[linked,setLinked]=useState([]),
  [proposalReason,setProposalReason]=useState("");
 const [decisionReason,setDecisionReason]=useState({}),[decisionType,setDecisionType]=useState({});
 const blocked=review?.decision!=="REVIEW_REQUIRED";
 const beforeMap=new Map((review?.reviewed_fields||[]).map(x=>[x.entity+"."+x.field,x.before]));
 const verdictMap=new Map((ledger?.verdicts||[]).map(x=>[x.evidenceId,x]));
 const decisionMap=new Map((ledger?.decisions||[]).map(x=>[x.proposalId,x]));
 const verified=evidence.filter(e=>verdictMap.get(e.evidenceId)?.verdict==="VERIFIED");
 const selectedSources=new Set(verified.filter(e=>linked.includes(e.evidenceId)).map(e=>e.sourceKey));
 const twoSellerEvidenceSelected=selectedSources.has("official_single")&&selectedSources.has("hwahae_bundle");
 const priceScope=buildR16IPriceScopeReview({
  view:review,evidence,verdicts:ledger?.verdicts||[],nowIso:new Date().toISOString()
 });
 async function reload(){
  const [a,b]=await Promise.all([load(API),load(EVIDENCE)]);
  if(!a.ledger||!Array.isArray(b.items))throw Error("검토 이력 응답 불완전");
  setLedger({...a.ledger,owner:a.canOwnerDecide===true});setEvidence(b.items);
 }
 useEffect(()=>{
  if(blocked){setLedger(null);setEvidence([]);return;}
  let active=true;
  Promise.all([load(API),load(EVIDENCE)]).then(([a,b])=>{
   if(active&&a.ledger&&Array.isArray(b.items)){
    setLedger({...a.ledger,owner:a.canOwnerDecide===true});setEvidence(b.items);
   }
  }).catch(()=>{if(active){setLedger(null);setEvidence([]);setMessage("승인 이력 조회 실패. 결정을 차단합니다.");}});
  return()=>{active=false;};
 },[blocked,review?.product_revision]);
 async function submit(action,payload){
  if(busy||blocked||!ledger)return;
  setBusy(action);setMessage("");
  try{
   await load(API,{action,payload:{...payload,requestId:crypto.randomUUID()}});
   await reload();
   setMessage("결정을 저장했습니다. 실제 상품 DB는 변경하지 않았습니다.");
   if(action==="review_evidence"){setSelected("");setOpened(false);setPreview("");setVerdictReason("");}
   if(action==="create_proposal"){setChanges([]);setLinked([]);setProposalReason("");}
  }catch(e){
   setMessage(e?.message||"요청이 차단됐습니다.");
   try{await reload();}catch{setLedger(null);setEvidence([]);}
  }finally{setBusy("");}
 }
 async function openPreview(){
  if(!selected||busy)return;
  setBusy("preview");setPreview("");setOpened(false);
  try{
   const b=await load(EVIDENCE+"?evidenceId="+encodeURIComponent(selected));
   if(!b.preview?.signedUrl||b.preview.expiresInSeconds!==60)throw Error("비공개 주소 발급 실패");
   setPreview(b.preview.signedUrl);setMessage("60초 열람 링크를 발급했습니다.");
  }catch(e){setMessage(e.message);}finally{setBusy("");}
 }
 function addField(){
  const v=field==="products.buy_link"?after.trim():Number(after.trim());
  if(!beforeMap.has(field)||!after.trim()||(field!=="products.buy_link"&&!Number.isFinite(v))||
    (field==="products.buy_link"&&!["https://www.snature.kr/product/detail.html?product_no=151",
      "https://www.hwahae.co.kr/goods/45194"].includes(v))||
    JSON.stringify(v)===JSON.stringify(beforeMap.get(field))){
   setMessage("기존값과 다른 유효한 변경 후보를 입력하세요.");return;
  }
  setChanges(prev=>[...prev.filter(x=>x.field!==field),{field,before:beforeMap.get(field),after:v}]);
  setAfter("");setMessage("");
 }
 return <div className="mt-5 space-y-4" aria-label="실제 정정안 검토 시스템">
  <div className="flex flex-wrap items-center justify-between gap-2">
   <h3 className="font-bold">증빙 검토 → 정정안 작성 → 소유자 결정</h3>
   <button className={btn} type="button" disabled={!!busy||blocked} onClick={async()=>{
    setBusy("reload");try{await reload();setMessage("최신 검토 이력을 불러왔습니다.");}
    catch{setLedger(null);setEvidence([]);setMessage("이력 조회 실패");}finally{setBusy("");}
   }}>검토 이력 새로고침</button>
  </div>
  <p className={light}>여기서 승인하는 정정안은 D8-D 적용 전의 검토 기록입니다. 가격·상품·판매 옵션을 실제 DB에 적용하지 않습니다. 승인하려면 공식몰 단품과 화해 기획세트 양쪽의 VERIFIED 캡처가 필요합니다.</p>
  {blocked||!ledger?<p role="alert" className="rounded-lg bg-[#fff3e9] p-3 text-sm text-[#a2581c] dark:bg-[#413022]">
   {blocked?"상품의 검증된 변경 전 상태가 달라 처리할 수 없습니다.":"검토 이력을 불러오지 못해 제출과 승인을 차단했습니다."}
  </p>:<>
   <section className="rounded-xl border border-[#dbe4ef] p-4 dark:border-[#435369]">
    <h4 className="font-semibold">A. 캡처 근거 판정</h4>
    <p className={light+" mt-1"}>업로드된 자료는 미검증입니다. 소유자가 원본 화면을 직접 확인하고 판정 이유를 기록합니다.</p>
    {evidence.length===0?<p className={light+" mt-3"}>저장된 근거가 없습니다. 위 캡처 저장 영역에 이미지를 먼저 등록해 주세요.</p>:
     <div className="mt-3 space-y-2">{evidence.map(e=><div key={e.evidenceId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-xs dark:border-[#4b5564]">
      <span>{e.sourceKey==="official_single"?"제조사 단품":"화해 기획세트"} · {e.selectedOption||"옵션 미기록"} · {verdictMap.get(e.evidenceId)?.verdict||"미검토"}<span className={"block "+light}>캡처 {e.capturedAt} / 입력 금액 {value(e.claimedCheckoutPrice)}원</span></span>
      {!verdictMap.has(e.evidenceId)&&ledger.owner&&<button className={btn} type="button" onClick={()=>{setSelected(e.evidenceId);setPreview("");setOpened(false);}}>이 캡처 검토</button>}
     </div>)}</div>}
    {ledger.owner&&selected&&!verdictMap.has(selected)&&<div className="mt-4 space-y-2 rounded-lg bg-[#f4f7fc] p-3 dark:bg-[#263247]">
     <button type="button" className={btn} disabled={!!busy} onClick={openPreview}>비공개 캡처 열람 링크 발급</button>
     {preview&&<a className="ml-2 text-sm text-[#2767bd] underline" href={preview} target="_blank" rel="noopener noreferrer" onClick={()=>setOpened(true)}>원본 열기 (60초)</a>}
     <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={opened} onChange={e=>setOpened(e.target.checked)}/> 원본을 열어 선택 옵션과 출처를 확인하고 판정 책임을 이해했습니다.</label>
     <textarea className={ctl} rows={2} maxLength={2000} placeholder="판단 사유를 입력하세요 (공백 제외 1자 이상)" value={verdictReason} onChange={e=>setVerdictReason(e.target.value)}/>
     <p className={light} role="status" aria-live="polite">
      {!opened?"원본 확인 체크박스를 선택해 주세요.":!verdictReason.trim()?"판정 사유를 입력하면 인정·반려 버튼이 활성화됩니다.":"판정할 수 있습니다."}
     </p>
     <div className="flex gap-2"><button type="button" className={btn} disabled={!opened||!verdictReason.trim()||!!busy} onClick={()=>submit("review_evidence",{evidenceId:selected,verdict:"VERIFIED",reason:verdictReason})}>원본 인정</button>
     <button type="button" className={btn} disabled={!opened||!verdictReason.trim()||!!busy} onClick={()=>submit("review_evidence",{evidenceId:selected,verdict:"REJECTED",reason:verdictReason})}>반려</button></div>
     <p className={light}>근거 인정은 실결제 가격 인증이나 상품 수정 승인이 아닙니다.</p>
    </div>}
   </section>
   <section className="rounded-xl border border-[#dbe4ef] p-4 dark:border-[#435369]">
    <h4 className="font-semibold">B. 필드별 정정안 작성</h4>
    <p className={light+" mt-1"}>확인된 근거와 변경할 필드를 연결합니다. 근거 없는 수치는 제안하지 마세요.</p>
    <div className="mt-3 rounded-xl border border-[#d5dce8] p-3 dark:border-[#526076]" aria-label="정상가 관측/결제금액 분리">
     <h5 className="text-sm font-semibold">정상가 관측/결제금액 분리 · 읽기 전용</h5>
     {priceScope.status!=="REVIEW_REQUIRED"?<p className={light+" mt-1"}>
      가격 출처를 분리해 검토하려면 공식몰·화해의 VERIFIED 원본 2건과 일치하는 상품 사전 상태가 필요합니다.
     </p>:<>
      <p className={light+" mt-1"}>
       공식몰 화면 표시 정상가 {priceScope.officialScreenListPriceKrW.toLocaleString("ko-KR")}원
       (사용자 캡처 관측값, 현재 판매가 보증 아님) · 화면 할인액 {priceScope.officialDiscountObservedKrW.toLocaleString("ko-KR")}원
      </p>
      <div className="mt-2 grid gap-2 md:grid-cols-2">
       {priceScope.offerCandidates.map(row=><div key={row.sourceKey} className="rounded-lg border p-2 text-xs dark:border-[#526076]">
        <p className="font-semibold">{row.label}</p>
        <p>해당 옵션 결제 관측가: {row.checkoutAmountKrW.toLocaleString("ko-KR")}원</p>
        <p className={light}>크림 {row.creamUnitMl}ml × {row.creamQuantity}개{row.giftSerumMl>0?` · 세럼 ${row.giftSerumMl}ml 사은품`:""}</p>
        <p className={light}>판매처 Offer 후보 · 실제 등록 아님</p>
       </div>)}
      </div>
      <p className={light+" mt-2"}>
       Product 기준 용량은 80ml 후보이나 대표가격·10ml당 가격·구매 링크는 미확정입니다.
       <strong>대표가격 자동 확정 금지.</strong> 기존 D8D 적용 SQL은 공식몰 할인 결제금액을 Product 가격으로 요구하므로,
       필드별 가격 정책을 확정하기 전에는 실제 정정안을 승인·적용하지 마세요.
      </p>
     </>}
    </div>
    <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
     <label className="text-xs">필드<select className={ctl+" mt-1"} value={field} onChange={e=>{setField(e.target.value);setAfter("");}}>{FIELDS.map(([id,label])=><option value={id} key={id}>{label}</option>)}</select></label>
     <label className="text-xs">제안값<input className={ctl+" mt-1"} value={after} onChange={e=>setAfter(e.target.value)} placeholder={value(beforeMap.get(field))}/></label>
     <button type="button" className={btn+" self-end"} onClick={addField}>필드 추가</button>
    </div>
    {changes.length>0&&<ul className="mt-3 space-y-1">{changes.map(change=><li key={change.field} className="flex items-center justify-between gap-2 text-xs">
     <span className="break-all">{change.field}: {value(change.before)} → {value(change.after)}</span>
     <button className="underline" type="button" onClick={()=>setChanges(p=>p.filter(f=>f.field!==change.field))}>삭제</button>
    </li>)}</ul>}
    <p className={light+" mt-3"}>검증된 근거 선택 · 공식몰과 화해 각각 최소 1건</p>
    {verified.length===0?<p className={light}>VERIFIED 근거가 없습니다. 먼저 캡처 검토를 완료해야 합니다.</p>:
     <div className="mt-2 space-y-1">{verified.map(e=><label key={e.evidenceId} className="flex items-center gap-2 text-xs">
      <input type="checkbox" checked={linked.includes(e.evidenceId)} onChange={ev=>setLinked(p=>ev.target.checked?[...p,e.evidenceId]:p.filter(id=>id!==e.evidenceId))}/>
      {e.sourceKey==="official_single"?"공식몰":"화해"} · {e.selectedOption||"옵션 미입력"} ({e.evidenceId.slice(0,8)})
     </label>)}</div>}
    {verified.length>0&&!twoSellerEvidenceSelected&&<p role="status" className={light+" mt-2"}>
      공식몰 80ml 단품과 화해 기획세트의 VERIFIED 근거를 각각 선택해야 정정안을 제출할 수 있습니다.
    </p>}
    <textarea rows={2} maxLength={2000} className={ctl+" mt-3"} placeholder="정정안 이유 (12자 이상)" value={proposalReason} onChange={e=>setProposalReason(e.target.value)}/>
    <button type="button" className={btn+" mt-2"} disabled={!!busy||changes.length===0||!twoSellerEvidenceSelected||proposalReason.trim().length<12} onClick={()=>submit("create_proposal",{
     strategy:"A_PRODUCT_ANCHOR_REUSE_AND_OFFER_SEPARATION",baselineSha256:ledger.baselineSha256,
     productRevision:ledger.productRevision,fieldChanges:changes,evidenceIds:linked,rationale:proposalReason
    })}>정정안 제출 (실제 적용 없음)</button>
   </section>
   <section className="rounded-xl border border-[#dbe4ef] p-4 dark:border-[#435369]">
    <h4 className="font-semibold">C. 소유자 승인 · 보류 · 반려</h4>
    {(ledger.proposals||[]).length===0?<p className={light+" mt-2"}>제출된 정정안이 없습니다.</p>:
     <div className="mt-3 space-y-3">{ledger.proposals.map(p=>{
      const decision=decisionMap.get(p.proposalId);
      return <div className="rounded-lg border p-3 text-xs dark:border-[#4a5364]" key={p.proposalId}>
       <p className="font-semibold">정정안 {p.proposalId.slice(0,8)} · {decision?.decision||"미결정"}</p>
       <p className={light+" mt-1"}>{p.rationale}</p>
       <p className={light}>{p.fieldChanges.map(x=>x.field+": "+value(x.before)+" → "+value(x.after)).join(" / ")}</p>
       {p.stale&&<p className="font-bold text-[#a74a25]">기존 DB와 달라 승인 불가</p>}
       {decision?<p className={light+" mt-2"}>최종 판단: {decision.reason}</p>:ledger.owner&&<div className="mt-2 space-y-2">
        <select className={ctl} value={decisionType[p.proposalId]||"HOLD"} onChange={e=>setDecisionType(m=>({...m,[p.proposalId]:e.target.value}))}>
         <option value="HOLD">보류</option><option value="REJECT">반려</option>
         <option value="APPROVE_FOR_D8D_REVIEW" disabled={p.stale}>정정안 승인 · D8-D 반영 전 검토</option>
        </select>
        <textarea rows={2} className={ctl} maxLength={2000} placeholder="판단 사유 (12자 이상)" value={decisionReason[p.proposalId]||""}
         onChange={e=>setDecisionReason(m=>({...m,[p.proposalId]:e.target.value}))}/>
        <button type="button" className={btn} disabled={!!busy||(decisionReason[p.proposalId]||"").trim().length<12||
          (p.stale&&decisionType[p.proposalId]==="APPROVE_FOR_D8D_REVIEW")}
         onClick={()=>submit("decide_proposal",{proposalId:p.proposalId,decision:decisionType[p.proposalId]||"HOLD",reason:decisionReason[p.proposalId]})}>
         결정 기록 (상품 DB 미반영)
        </button>
       </div>}
      </div>;
     })}</div>}
   </section>
  </>}
  <p role="status" aria-live="polite" className={light}>{message}</p>
 </div>;
}
