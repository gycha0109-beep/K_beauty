"use client";
import { useState } from "react";

const ENDPOINT = "/api/admin/products/r16i-correction-review/evidence";
const PRODUCTS = Object.freeze({
  official_single:"https://www.snature.kr/product/detail.html?product_no=151",
  hwahae_bundle:"https://www.hwahae.co.kr/goods/45194"
});
const REVIEW_ENDPOINT = "/api/admin/products/r16i-correction-review/approval";
const SOURCE_OPTIONS = Object.freeze({
  official_single: "수분크림 80ml 1개",
  hwahae_bundle: "수분크림 80ml×2 + 세럼 10ml"
});
const CORRECTION_REASON = "잘못 등록된 증빙을 정정본으로 대체하여 기존 원본을 검토 대상에서 제외합니다.";
const EXCLUSION_REASON = "사용자가 잘못 등록한 미검증 증빙이므로 검토 대상에서 제외합니다.";
const control = "w-full rounded-xl border border-[#d2dbe8] bg-white px-3 py-2.5 text-sm dark:border-[#404e61] dark:bg-[#212c3c]";
const button = "rounded-xl border border-[#bdcde5] bg-white px-4 py-2.5 text-sm font-bold text-[#2859a6] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#526079] dark:bg-[#27354b] dark:text-[#b3ceff]";
const small = "text-xs leading-5 text-[#64738c] dark:text-[#b1bfd0]";
async function parseResponse(r) {
  const b=await r.json().catch(()=>null);
  if(!r.ok || !b?.ok) throw Error(b?.error || "증빙 조회에 실패했습니다.");
  return b;
}
const won=(x)=>Number.isInteger(x)?x.toLocaleString("ko-KR")+"원":"가격 미입력";
export default function R16IR4D8PrivateEvidence({ blocked }) {
  const [sourceKey,setSourceKey] = useState("official_single");
  const [selectedOption,setSelectedOption] = useState(SOURCE_OPTIONS.official_single);
  const [checkoutPrice,setCheckoutPrice] = useState("");
  const [capturedAt,setCapturedAt] = useState("");
  const [notes,setNotes] = useState("");
  const [file,setFile] = useState(null);
  const [items,setItems] = useState([]);
  const [busy,setBusy] = useState("");
  const [status,setStatus] = useState("");
  const [preview,setPreview] = useState(null);
  const [editing,setEditing] = useState(null);
  const [verdicts,setVerdicts] = useState([]);
  const [canOwnerDecide,setCanOwnerDecide] = useState(false);
  const [loaded,setLoaded] = useState(false);
  const verdictById = new Map(verdicts.map(v => [v.evidenceId,v.verdict]));
  const activeItems = items.filter(item => verdictById.get(item.evidenceId)!=="REJECTED");
  const excludedItems = items.filter(item => verdictById.get(item.evidenceId)==="REJECTED");

  async function refreshEvidence() {
    // The existing owner review ledger is the only authority for evidence exclusion.
    const [evidenceResponse,reviewResponse] = await Promise.all([
      fetch(ENDPOINT,{method:"GET",credentials:"same-origin",cache:"no-store"}),
      fetch(REVIEW_ENDPOINT,{method:"GET",credentials:"same-origin",cache:"no-store"})
    ]);
    const [evidence,review] = await Promise.all([
      parseResponse(evidenceResponse),parseResponse(reviewResponse)
    ]);
    if(!Array.isArray(evidence.items)||!Array.isArray(review.ledger?.verdicts))
      throw Error("INVALID_EVIDENCE_OR_REVIEW_LEDGER");
    setItems(evidence.items);
    setVerdicts(review.ledger.verdicts);
    setCanOwnerDecide(review.canOwnerDecide===true);
    setLoaded(true);
    setPreview(null);
    return {count:evidence.items.length,owner:review.canOwnerDecide===true};
  }
  async function listEvidence() {
    if(busy||blocked)return;
    setBusy("list");setStatus("");
    try {
      const result=await refreshEvidence();
      setStatus("검토 대상과 제외 이력을 새로고침했습니다. 전체 기록 "+result.count+"건.");
    }catch{
      setCanOwnerDecide(false);
      setStatus("증빙 또는 소유자 검토 이력 조회에 실패했습니다. 수정·제외가 차단됩니다.");
    }finally{setBusy("");}
  }
  async function rejectEvidence(evidenceId,reason) {
    const response=await fetch(REVIEW_ENDPOINT,{
      method:"POST",credentials:"same-origin",cache:"no-store",
      headers:{"Content-Type":"application/json","Accept":"application/json"},
      body:JSON.stringify({
        action:"review_evidence",
        payload:{evidenceId,verdict:"REJECTED",reason,requestId:crypto.randomUUID()}
      })
    });
    const body=await parseResponse(response);
    if(body.result?.verdict!=="REJECTED"||body.productWrites!==0||
       body.offerWrites!==0||body.productionWriteAuthorized!==false)
      throw Error("EXCLUSION_AUTHORITY_MISMATCH");
  }
  async function excludeEvidence(item) {
    if(busy||blocked||!canOwnerDecide||verdictById.has(item.evidenceId))return;
    if(!window.confirm("이 증빙을 검토 목록에서 제외하시겠습니까? 원본과 감사 이력은 보존되며 상품 DB는 바뀌지 않습니다."))return;
    setBusy("exclude");setStatus("");
    try {
      await rejectEvidence(item.evidenceId,EXCLUSION_REASON);
      await refreshEvidence();
      if(editing?.evidenceId===item.evidenceId)setEditing(null);
      setStatus("잘못된 증빙을 검토 목록에서 제외했습니다. 원본 감사 이력은 보존됩니다.");
    }catch{
      setStatus("증빙 제외가 완료되지 않았습니다. 검토 이력을 다시 불러와 상태를 확인해 주세요.");
      try{await refreshEvidence();}catch{}
    }finally{setBusy("");}
  }
  function startCorrection(item) {
    if(busy||blocked||!canOwnerDecide||verdictById.has(item.evidenceId))return;
    setEditing({evidenceId:item.evidenceId});
    setSourceKey(item.sourceKey);
    // Never reuse mismatched option text from the old incorrect evidence.
    setSelectedOption(SOURCE_OPTIONS[item.sourceKey]);
    setCheckoutPrice("");
    const originalTime=new Date(item.capturedAt);
    setCapturedAt(Number.isFinite(originalTime.getTime())
      ? new Date(originalTime.getTime()-originalTime.getTimezoneOffset()*60000).toISOString().slice(0,16):"");
    setNotes("");
    setFile(null);
    setPreview(null);
    setStatus("기존 원본은 수정할 수 없습니다. 수정한 정보와 원본 이미지를 다시 업로드하면 기존 기록을 자동 제외합니다.");
    document.getElementById("r16i-capture-upload")?.focus();
  }
  function cancelCorrection(){
    setEditing(null);setFile(null);setStatus("정정 입력을 취소했습니다. 저장 기록은 바뀌지 않았습니다.");
  }
  async function saveEvidence(event) {
    event.preventDefault();
    if(busy || blocked) return;
    setStatus("");setPreview(null);
    if(editing && !canOwnerDecide){
      setStatus("정정본을 저장하며 기존 기록을 제외하려면 OWNER 권한이 필요합니다.");return;
    }
    if(selectedOption!==SOURCE_OPTIONS[sourceKey]){
      setStatus("판매처와 상품 구성을 다시 확인해 주세요.");return;
    }
    if(!file || file.size>4194304 || !["image/png","image/jpeg","image/webp"].includes(file.type)) {
      setStatus("PNG/JPEG/WebP 이미지(4MB 이하)를 선택해 주세요.");return;
    }
    if(!capturedAt || !Number.isFinite(Date.parse(capturedAt))) {
      setStatus("실제 화면을 캡처한 날짜와 시간을 입력해 주세요.");return;
    }
    const form=new FormData();
    form.append("sourceKey",sourceKey);
    form.append("sourceUrl",PRODUCTS[sourceKey]);
    form.append("selectedOption",selectedOption);
    form.append("checkoutPrice",checkoutPrice);
    form.append("capturedAt",new Date(capturedAt).toISOString());
    form.append("notes",notes);
    form.append("requestId",crypto.randomUUID());
    form.append("image",file,file.name);
    setBusy("save");
    try {
      const saved=await parseResponse(await fetch(ENDPOINT,{
        method:"POST",credentials:"same-origin",cache:"no-store",body:form
      }));
      if(saved.saved?.evidenceState!=="UNVERIFIED"||saved.productWrites!==0)
        throw Error("EVIDENCE_AUTHORITY_VIOLATION");
      // The new evidence record is append-only. An OWNER may exclude the old
      // UNVERIFIED entry through the already-protected review ledger.
      let warning="";
      if(editing){
        try{await rejectEvidence(editing.evidenceId,CORRECTION_REASON);}
        catch{warning="수정본은 저장됐지만 이전 기록 제외에 실패했습니다. 다시 업로드하지 말고 이력에서 이전 기록을 수동 제외해 주세요. ";}
      }
      setEditing(null);
      setFile(null);
      const fileInput=document.getElementById("r16i-capture-upload");
      if(fileInput)fileInput.value="";
      try{await refreshEvidence();}
      catch{warning+="목록 재조회가 실패했습니다. 새로고침으로 상태를 확인해 주세요. ";}
      setStatus(warning||"증빙을 비공개 저장했습니다. 정정본도 미검증이며, 상품 DB에는 반영하지 않았습니다.");
    }catch{
      setStatus("등록 완료를 확인하지 못했습니다. 중복 업로드하지 말고 저장된 증빙을 먼저 조회해 주세요.");
    }finally{setBusy("");}
  }
  async function showPrivateEvidence(evidenceId) {
    if(busy || blocked) return;
    setBusy("preview");setPreview(null);setStatus("");
    try {
      const result=await parseResponse(await fetch(ENDPOINT+"?evidenceId="+encodeURIComponent(evidenceId),{
        method:"GET",credentials:"same-origin",cache:"no-store"
      }));
      if(!result.preview?.signedUrl || result.preview.expiresInSeconds!==60)
        throw Error("INVALID_SIGNED_URL");
      setPreview({id:evidenceId,url:result.preview.signedUrl});
      setStatus("임시 열람 링크가 준비됐습니다. 60초 후 만료됩니다.");
    }catch{
      setStatus("보안 증빙 열람 주소를 생성하지 못했습니다.");
    }finally{setBusy("");}
  }
  return (
    <section className="mt-5 rounded-xl border border-[#cbdcef] bg-[#f7faff] p-4 dark:border-[#374c68] dark:bg-[#1d2b3e]" aria-label="비공개 상품 근거 저장">
      <h3 className="font-bold text-[#203655] dark:text-[#e2efff]">판매 근거 캡처 비공개 저장</h3>
      <p className={small+" mt-2"}>
        직접 촬영한 판매 옵션·결제 직전 화면을 보관합니다. 고객 이름, 주소, 전화번호, 주문번호 등 개인정보는 올리기 전에 가려 주세요.
        업로드된 자료는 자동 검증 또는 가격 변경 승인으로 인정되지 않습니다.
      </p>
      {editing&&<div role="status" className="mt-3 rounded-xl border border-[#c8d8f1] bg-white p-3 text-sm dark:border-[#516481] dark:bg-[#25364b]">
        <strong>정정본 등록 중</strong> · 원본 {editing.evidenceId.slice(0,8)}.
        새로운 캡처를 첨부해 저장하면 기존 기록은 검토 대상에서 제외됩니다. 저장 전 취소할 수 있습니다.
        <button className="ml-3 underline" type="button" onClick={cancelCorrection} disabled={Boolean(busy)}>정정 취소</button>
      </div>}
      <form onSubmit={saveEvidence} className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="block text-sm font-semibold">판매처
          <select className={control+" mt-2"} value={sourceKey} onChange={e=>{
            const next=e.target.value;
            setSourceKey(next);setSelectedOption(SOURCE_OPTIONS[next]);setCheckoutPrice("");
          }} disabled={Boolean(busy)||blocked}>
            <option value="official_single">에스네이처 공식몰 · 80ml 단품</option>
            <option value="hwahae_bundle">화해 · 80ml×2 기획세트</option>
          </select>
        </label>
        <label className="block text-sm font-semibold">실제 캡처 시각
          <input className={control+" mt-2"} required type="datetime-local" value={capturedAt}
            onChange={e=>setCapturedAt(e.target.value)} disabled={Boolean(busy)||blocked}/>
        </label>
        <label className="block text-sm font-semibold">선택한 옵션 · 구성
          <input className={control+" mt-2"} maxLength={500} value={selectedOption}
            readOnly aria-readonly="true" title="판매처에 따라 고정된 대상 상품 구성입니다."/>
          <span className={small}>판매처와 구성은 함께 바뀝니다. 추가 옵션 정보는 메모에 작성하세요.</span>
        </label>
        <label className="block text-sm font-semibold">결제 직전 금액 (확인한 경우에만)
          <input className={control+" mt-2"} inputMode="numeric" pattern="[0-9]*" value={checkoutPrice}
            onChange={e=>setCheckoutPrice(e.target.value)} placeholder="미확인 시 비워 두세요." disabled={Boolean(busy)||blocked}/>
        </label>
        <label className="block text-sm font-semibold">캡처 이미지 · 최대 4MB
          <input id="r16i-capture-upload" required className={control+" mt-2"} type="file"
            accept="image/png,image/jpeg,image/webp" onChange={e=>setFile(e.target.files?.[0] || null)}
            disabled={Boolean(busy)||blocked}/>
        </label>
        <label className="block text-sm font-semibold">추가 확인 메모
          <input className={control+" mt-2"} maxLength={2000} value={notes} onChange={e=>setNotes(e.target.value)}
            placeholder="출처/옵션/사은품 SKU를 구분해 기록" disabled={Boolean(busy)||blocked}/>
        </label>
        <div className="md:col-span-2 flex flex-wrap items-center gap-2">
          <button className={button} type="submit" disabled={Boolean(busy)||blocked}>
            {busy==="save"?"비공개 저장 중…":editing?"정정본 저장 + 기존 기록 제외":"미검증 캡처 저장"}
          </button>
          <button className={button} type="button" onClick={listEvidence} disabled={Boolean(busy)||blocked}>
            {busy==="list"?"조회 중…":"저장된 증빙 불러오기"}
          </button>
        </div>
      </form>
      <p role="status" aria-live="polite" className={small+" mt-3"}>{status||"서버에 저장하더라도 상품정보·리뷰·추천 데이터는 변경되지 않습니다."}</p>
      {loaded&&<div className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-bold">검토 대상 {activeItems.length}건</h4>
          {!canOwnerDecide&&<span className={small}>기존 증빙 제외는 OWNER 권한에서만 가능합니다.</span>}
        </div>
        {activeItems.length===0?<p className={small+" mt-2"}>현재 검토 대상 증빙이 없습니다.</p>:
          <ul className="mt-2 divide-y divide-[#dbe4f0] dark:divide-[#435269]">
            {activeItems.map(item=><li key={item.evidenceId} className="flex flex-wrap items-start justify-between gap-3 py-3 text-xs">
              <div className="min-w-0 flex-1">
                <p className="font-bold">{item.sourceKey==="official_single"?"공식몰 단품":"화해 기획세트"} · {verdictById.get(item.evidenceId)||"미검증"}</p>
                <p className={small}>{item.selectedOption||"옵션 미기록"} · {won(item.claimedCheckoutPrice)} · 캡처 {item.capturedAt}</p>
                <p className={small}>기록번호 {item.evidenceId.slice(0,8)}</p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button type="button" className={button} disabled={Boolean(busy)||blocked}
                  onClick={()=>showPrivateEvidence(item.evidenceId)}>열람</button>
                {!verdictById.has(item.evidenceId)&&canOwnerDecide&&<>
                  <button type="button" className={button} disabled={Boolean(busy)||blocked}
                    onClick={()=>startCorrection(item)}>수정</button>
                  <button type="button" className={button+" text-[#a03737]"} disabled={Boolean(busy)||blocked}
                    onClick={()=>excludeEvidence(item)}>제외</button>
                </>}
              </div>
              {preview?.id===item.evidenceId&&<a className="basis-full text-[#2b62ad] underline underline-offset-2 dark:text-[#b6d2ff]"
                href={preview.url} target="_blank" rel="noopener noreferrer">60초 한정 원본 보기 ↗</a>}
            </li>)}
          </ul>}
        {excludedItems.length>0&&<details className="mt-3 rounded-xl border border-[#dbe4f0] p-3 dark:border-[#435269]">
          <summary className="cursor-pointer text-sm font-semibold">제외된 증빙 {excludedItems.length}건 · 감사 기록 보존</summary>
          <ul className="mt-2 divide-y divide-[#dbe4f0] dark:divide-[#435269]">
            {excludedItems.map(item=><li key={item.evidenceId} className="py-2 text-xs">
              {item.sourceKey==="official_single"?"공식몰":"화해"} · {item.selectedOption||"옵션 미기록"} · {won(item.claimedCheckoutPrice)}
              <span className={small}> · 반려됨 · {item.evidenceId.slice(0,8)}</span>
            </li>)}
          </ul>
        </details>}
        <p className={small+" mt-3"}>제외는 물리적 영구 삭제가 아니라 관리자 반려 기록입니다. 원본은 감사 목적으로 남고 상품·리뷰·추천에는 반영되지 않습니다.</p>
      </div>}
    </section>
  );
}
