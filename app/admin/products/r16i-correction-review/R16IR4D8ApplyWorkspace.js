"use client";

import { useEffect, useState } from "react";

const APPLY="/api/admin/products/r16i-correction-review/apply";
const APPROVAL="/api/admin/products/r16i-correction-review/approval";
const style="rounded-xl border border-[#d4e0ed] bg-white p-4 dark:border-[#414f61] dark:bg-[#1b2636]";
const btn="rounded-lg border border-[#c1cde2] px-3.5 py-2.5 text-sm font-semibold text-[#285ead] disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#4a617e] dark:text-[#abc9ff]";
const note="text-xs leading-6 text-[#62728a] dark:text-[#b4c4d5]";
async function getJson(url,body){
  const response=await fetch(url,{method:body?"POST":"GET",credentials:"same-origin",cache:"no-store",
    headers:body?{"Accept":"application/json","Content-Type":"application/json"}:{"Accept":"application/json"},
    body:body?JSON.stringify(body):undefined});
  const result=await response.json().catch(()=>null);
  if(!response.ok||result?.ok!==true)throw new Error(result?.error||"요청 실패");
  return result;
}
export default function R16IR4D8ApplyWorkspace({review}){
  const [gate,setGate]=useState(null);
  const [proposals,setProposals]=useState([]);
  const [selected,setSelected]=useState("");
  const [preview,setPreview]=useState(null);
  const [typed,setTyped]=useState("");
  const [rollbackTyped,setRollbackTyped]=useState("");
  const [busy,setBusy]=useState("");
  const [message,setMessage]=useState("");
  async function reload(){
    const a=await getJson(APPLY);
    setGate(a);
    if(review?.decision==="REVIEW_REQUIRED"){
      try{
        const p=await getJson(APPROVAL);
        const decisions=new Map((p.ledger?.decisions||[]).map(d=>[d.proposalId,d.decision]));
        setProposals((p.ledger?.proposals||[]).filter(x=>
          decisions.get(x.proposalId)==="APPROVE_FOR_D8D_REVIEW"&&!x.stale));
      }catch{setProposals([]);}
    }else setProposals([]);
  }
  useEffect(()=>{
    let live=true;
    getJson(APPLY).then(a=>{if(live)setGate(a);}).catch(()=>{
      if(live){setGate(null);setMessage("D8-D 적용 이력과 잠금 상태를 조회하지 못했습니다.");}
    });
    if(review?.decision==="REVIEW_REQUIRED"){
      getJson(APPROVAL).then(p=>{
        if(!live)return;
        const decisions=new Map((p.ledger?.decisions||[]).map(d=>[d.proposalId,d.decision]));
        setProposals((p.ledger?.proposals||[]).filter(x=>
          decisions.get(x.proposalId)==="APPROVE_FOR_D8D_REVIEW"&&!x.stale));
      }).catch(()=>{if(live)setProposals([]);});
    }
    return()=>{live=false;};
  },[review?.decision,review?.product_revision]);
  async function run(mode,identifier){
    if(busy||!gate)return;
    setBusy(mode);setMessage("");
    try{
      const requestId=crypto.randomUUID();
      const payload=mode==="ROLLBACK"
        ?{mode,applicationId:identifier,requestId,confirmation:"원복 실행"}
        :{mode,proposalId:identifier,requestId,
          confirmation:mode==="PREVIEW"?"변경 전 검토":"실제 DB 반영"};
      const result=await getJson(APPLY,payload);
      if(mode==="PREVIEW"){
        if(result.result?.status!=="PREVIEW_VERIFIED_NO_WRITE")throw Error("미리보기 검증 응답이 아닙니다.");
        setPreview({proposalId:identifier,...result.result});
        setMessage("증빙과 DB 정합성을 다시 확인했습니다. 실제 데이터 변경은 없습니다.");
      }else{
        setPreview(null);setTyped("");setRollbackTyped("");
        await reload();
        setMessage(mode==="APPLY"
          ?"트랜잭션이 적용됐습니다. Product와 분리 Offer 및 적용 이력을 확인해 주세요."
          :"기록된 변경 전후값을 재검증하여 원복했습니다. 정정 재시도는 별도 기준 확정이 필요합니다.");
      }
    }catch(e){
      setPreview(null);
      setMessage(e?.message||"실행이 차단됐습니다.");
      try{await reload();}catch{setGate(null);}
    }finally{setBusy("");}
  }
  const released=gate?.applyAvailable===true;
  const records=gate?.applications||[];
  return (
    <section className={style} aria-label="D8D 안전 적용과 되돌리기">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">5. 실제 DB 적용 · 원복</h2>
          <p className={note+" mt-1"}>
            공식몰 단품 Product 정정과 화해 기획세트 Offer 등록은 반드시 같은 DB 트랜잭션으로 처리합니다.
          </p>
        </div>
        <button type="button" className={btn} onClick={async()=>{
          if(busy)return;setBusy("refresh");setMessage("");
          try{await reload();setMessage("최근 적용 이력을 확인했습니다.");}
          catch{setGate(null);setMessage("적용 이력 조회 실패");}finally{setBusy("");}
        }} disabled={!!busy}>적용 이력 새로고침</button>
      </div>

      {!gate?<p role="alert" className={note+" mt-3"}>적용 이력 조회 실패 또는 관리자 소유자 권한 필요 · 모든 적용 기능 차단</p>:(
        <div className="mt-3 space-y-3">
          <p className={note}>
            운영 DB 승인 잠금: <strong>{gate.releaseGateEnabled?"해제됨":"유지 중"}</strong> ·
            서버 실행 잠금: <strong>{gate.serverApplyEnabled?"해제됨":"유지 중"}</strong> ·
            실제 반영: <strong>{released?"승인된 건만 가능":"불가"}</strong>
          </p>
          <p className={note}>보안 이슈와 적용 전 검증이 해결되지 않은 상태에서는 미리보기만 가능합니다. 관리자 화면에서 잠금을 임의 해제할 수 없습니다.</p>

          {proposals.length>0&&<div className="rounded-lg bg-[#f3f7fc] p-3 dark:bg-[#28374b]">
            <label className="block text-xs font-bold">소유자가 승인한 정정안
              <select className="mt-2 w-full rounded-lg border p-2 text-sm dark:border-[#53627a] dark:bg-[#202c3e]"
                value={selected} onChange={e=>{setSelected(e.target.value);setPreview(null);setTyped("");}}>
                <option value="">정정안을 선택하세요</option>
                {proposals.map(p=><option key={p.proposalId} value={p.proposalId}>
                  정정안 {p.proposalId.slice(0,8)} · {p.fieldChanges.length}개 필드
                </option>)}
              </select>
            </label>
            <button type="button" className={btn+" mt-3"} disabled={!!busy||!selected}
              onClick={()=>run("PREVIEW",selected)}>변경 내용과 증빙 재검증 · 미리보기</button>
            {preview?.proposalId===selected&&<div className="mt-3 space-y-2 rounded-lg border p-3 text-xs dark:border-[#526176]">
              <p className="font-bold">DB 트랜잭션 미리보기 (아직 반영하지 않음)</p>
              <p>기존 Product: {preview.before?.size_ml}ml · {preview.before?.price_min}원</p>
              <p>수정 Product: {preview.after?.size_ml}ml · {preview.after?.price_min}원</p>
              <p>신규 화해 기획세트 Offer: {preview.plannedOffer?.price_amount}원 · 상품 범위 미해결 유지</p>
              <p>적용 잠금: {preview.releaseGateEnabled?"DB 활성":"DB 비활성"}</p>
              <label className="block font-semibold">실제 반영 확인 문구
                <input className="mt-2 block w-full rounded-lg border p-2 dark:border-[#526176] dark:bg-[#202b3b]"
                  value={typed} onChange={e=>setTyped(e.target.value)} placeholder="실제 DB 반영" autoComplete="off"/>
              </label>
              <button className={btn} type="button"
                disabled={!!busy||!released||typed!=="실제 DB 반영"}
                onClick={()=>run("APPLY",selected)}>실제 Product + Offer DB 반영</button>
            </div>}
          </div>}
          {proposals.length===0&&<p className={note}>적용 가능한 승인 정정안이 없습니다. 먼저 양쪽 판매처 캡처를 검증하고 D8-C 정정안을 승인해야 합니다.</p>}
          <h3 className="text-sm font-bold">적용 및 원복 기록</h3>
          {records.length===0?<p className={note}>아직 실제 상품값을 수정한 기록이 없습니다.</p>:
            <ul className="space-y-3">{records.map(a=><li key={a.applicationId} className="rounded-xl border p-3 text-xs dark:border-[#526078]">
              <p className="font-bold">{a.state} · {a.appliedAt}</p>
              <p className={note}>정정안 {a.proposalId.slice(0,8)} · Product {a.before?.size_ml}ml → {a.after?.size_ml}ml · Offer {a.offerId.slice(0,8)}</p>
              {a.state==="APPLIED"&&<div className="mt-3 space-y-2">
                <p className={note}>되돌리기는 해당 Product/Offer가 적용 당시 상태 그대로일 때만 허용됩니다. 원복 후 D4 기존 리비전 검사는 다시 갱신해야 합니다.</p>
                <label className="block">원복 확인 문구
                  <input className="mt-1 block w-full rounded-lg border p-2 dark:border-[#526176] dark:bg-[#202b3b]"
                    value={rollbackTyped} onChange={e=>setRollbackTyped(e.target.value)} placeholder="원복 실행" autoComplete="off"/>
                </label>
                <button type="button" className={btn} disabled={!!busy||rollbackTyped!=="원복 실행"}
                  onClick={()=>run("ROLLBACK",a.applicationId)}>변경 전 값으로 원복</button>
              </div>}
            </li>)}</ul>}
        </div>
      )}
      <p role="status" className={note+" mt-3"} aria-live="polite">{message}</p>
    </section>
  );
}
