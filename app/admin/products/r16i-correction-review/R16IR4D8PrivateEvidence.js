"use client";
import { useState } from "react";

const ENDPOINT = "/api/admin/products/r16i-correction-review/evidence";
const PRODUCTS = Object.freeze({
  official_single:"https://www.snature.kr/product/detail.html?product_no=151",
  hwahae_bundle:"https://www.hwahae.co.kr/goods/45194"
});
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
  const [selectedOption,setSelectedOption] = useState("");
  const [checkoutPrice,setCheckoutPrice] = useState("");
  const [capturedAt,setCapturedAt] = useState("");
  const [notes,setNotes] = useState("");
  const [file,setFile] = useState(null);
  const [items,setItems] = useState([]);
  const [busy,setBusy] = useState("");
  const [status,setStatus] = useState("");
  const [preview,setPreview] = useState(null);

  async function listEvidence() {
    if(busy || blocked) return;
    setBusy("list");setStatus("");setPreview(null);
    try {
      const body=await parseResponse(await fetch(ENDPOINT,{
        method:"GET",credentials:"same-origin",cache:"no-store"
      }));
      if(!Array.isArray(body.items)) throw Error("INVALID_LIST");
      setItems(body.items);
      setStatus("저장된 증빙 "+body.items.length+"건을 불러왔습니다. 모두 승인 전 자료입니다.");
    }catch{
      setItems([]);
      setStatus("비공개 증빙을 불러오지 못했습니다. 저장된 내용이 없다는 뜻은 아닙니다.");
    }finally{setBusy("");}
  }
  async function saveEvidence(event) {
    event.preventDefault();
    if(busy || blocked) return;
    setStatus("");setPreview(null);
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
      setStatus("증빙을 비공개 저장했습니다. 근거 검증·상품 정정 승인 전 상태입니다.");
      setFile(null);
      const fileInput=document.getElementById("r16i-capture-upload");
      if(fileInput) fileInput.value="";
      // Separate readback ensures UI never equates POST success with a verified price.
      const listed=await parseResponse(await fetch(ENDPOINT,{
        method:"GET",credentials:"same-origin",cache:"no-store"
      }));
      setItems(Array.isArray(listed.items)?listed.items:[]);
    }catch{
      setStatus("증빙 저장 또는 재조회에 실패했습니다. 적용·승인은 수행되지 않았습니다.");
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
      <form onSubmit={saveEvidence} className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="block text-sm font-semibold">판매처
          <select className={control+" mt-2"} value={sourceKey} onChange={e=>setSourceKey(e.target.value)} disabled={Boolean(busy)||blocked}>
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
            onChange={e=>setSelectedOption(e.target.value)} placeholder="미확인인 경우 비워 둘 수 있습니다." disabled={Boolean(busy)||blocked}/>
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
            {busy==="save"?"비공개 저장 중…":"미검증 캡처 저장"}
          </button>
          <button className={button} type="button" onClick={listEvidence} disabled={Boolean(busy)||blocked}>
            {busy==="list"?"조회 중…":"저장된 증빙 불러오기"}
          </button>
        </div>
      </form>
      <p role="status" aria-live="polite" className={small+" mt-3"}>{status||"서버에 저장하더라도 상품정보·리뷰·추천 데이터는 변경되지 않습니다."}</p>
      {items.length>0 && (
        <ul className="mt-4 divide-y divide-[#dbe4f0] dark:divide-[#435269]">
          {items.map(item=><li key={item.evidenceId} className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs">
            <div>
              <p className="font-bold">{item.sourceKey==="official_single"?"공식몰 단품":"화해 기획세트"} · 검토 전</p>
              <p className={small}>{item.selectedOption||"옵션 미기록"} · 입력가격 {won(item.claimedCheckoutPrice)} · 캡처 {item.capturedAt}</p>
            </div>
            <button type="button" className={button} disabled={Boolean(busy)||blocked}
              onClick={()=>showPrivateEvidence(item.evidenceId)}>증빙 열람</button>
            {preview?.id===item.evidenceId && <a className="text-[#2b62ad] underline underline-offset-2 dark:text-[#b6d2ff]"
              href={preview.url} target="_blank" rel="noopener noreferrer">60초 한정 캡처 열기 ↗</a>}
          </li>)}
        </ul>
      )}
    </section>
  );
}
