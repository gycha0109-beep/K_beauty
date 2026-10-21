"use client";

import { useEffect, useRef, useState } from "react";
import { detectMediaPipeCheekRoiProposal } from "@/lib/face-lab-v2/personal-color/mediapipe-roi-proposal";

const ACCEPTED_TYPES = new Set(["image/jpeg","image/png","image/webp"]);
const MAX_BYTES = 10 * 1024 * 1024;
const SIDE_NAMES = {leftCheek:"화면 왼쪽 볼",rightCheek:"화면 오른쪽 볼",exclusion:"눈·입 제외 영역"};
const MESSAGE = {
  original_image_orientation_unverified:"좌우 반전 여부 확인이 필요합니다.",
  source_image_dimensions_invalid:"이미지가 너무 크거나 크기를 읽을 수 없습니다.",
  vision_runtime_unavailable:"얼굴 검출 런타임을 준비할 수 없습니다.",
  vision_runtime_or_model_failed:"모델 다운로드 또는 얼굴 검출에 실패했습니다. 연결 상태를 확인해 주세요.",
  single_face_not_detected:"얼굴 한 명을 검출하지 못했습니다.",
  multiple_faces_detected:"얼굴이 여러 명 검출되었습니다. 한 명의 정면 사진으로 다시 시도해 주세요.",
  cheek_geometry_unreliable:"볼 영역을 신뢰할 수 없는 자세·각도입니다.",
  roi_not_comparable:"두 ROI 후보 중 하나가 기하 조건을 충족하지 못했습니다."
};
function percent(value) {
  return Number.isFinite(value) ? (100 * value).toFixed(1) + "%" : "비교 불가";
}
function drawPolygon(ctx, points, w, h, stroke, dashed = false) {
  if (!Array.isArray(points) || points.length < 3) return;
  ctx.save();
  ctx.strokeStyle=stroke;ctx.lineWidth=2.5;
  if(dashed)ctx.setLineDash([6,5]);
  ctx.beginPath();
  points.forEach((p,i)=>i===0?ctx.moveTo(p.x*w,p.y*h):ctx.lineTo(p.x*w,p.y*h));
  ctx.closePath();ctx.stroke();ctx.restore();
}
function paint(canvas, bitmap, baseline, candidate) {
  if(!canvas)return;
  const scale=Math.min(1,800/bitmap.width);
  const width=Math.max(1,Math.round(bitmap.width*scale));
  const height=Math.max(1,Math.round(bitmap.height*scale));
  canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext("2d");
  if(!ctx)return;
  ctx.drawImage(bitmap,0,0,width,height);
  for(const p of Object.values(baseline?.cheekPolygons||{}))
    drawPolygon(ctx,p,width,height,"#00d4db");
  for(const p of Object.values(candidate?.cheekPolygons||{}))
    drawPolygon(ctx,p,width,height,"#ff54b8",true);
  for(const p of baseline?.exclusionPolygons||[])
    drawPolygon(ctx,p,width,height,"#ffad33");
}
export default function FaceLabRoiLiveClient() {
  const fileRef=useRef(null);
  const canvasRef=useRef(null);
  const requestId=useRef(0);
  const [selected,setSelected]=useState("");
  const [orientationConfirmed,setOrientationConfirmed]=useState(false);
  const [status,setStatus]=useState("idle");
  const [result,setResult]=useState(null);
  const [comparison,setComparison]=useState(null);
  const [error,setError]=useState("");

  useEffect(()=>()=>{requestId.current+=1;},[]);
  function choose(event) {
    requestId.current+=1;
    setStatus("idle");setResult(null);setComparison(null);setError("");
    setOrientationConfirmed(false);
    const canvas=canvasRef.current;
    if(canvas){canvas.width=0;canvas.height=0;}
    const file=event.target.files?.[0]||null;
    fileRef.current=null;setSelected("");
    if(!file)return;
    if(!ACCEPTED_TYPES.has(file.type)){setError("JPG, PNG, WebP만 지원합니다.");return;}
    if(file.size>MAX_BYTES){setError("10MB 이하 사진만 사용할 수 있습니다.");return;}
    fileRef.current=file;setSelected(file.name.slice(0,80));
  }

  async function analyze() {
    if(!fileRef.current||!orientationConfirmed||status==="loading")return;
    const id=++requestId.current;
    const input=fileRef.current;
    setStatus("loading");setResult(null);setComparison(null);setError("");
    let bitmap;
    try {
      bitmap=await createImageBitmap(input,{imageOrientation:"from-image"});
      if(id!==requestId.current)return;
      let first=null,second=null,paired=null;
      const output=await detectMediaPipeCheekRoiProposal({
        image:bitmap,width:bitmap.width,height:bitmap.height,
        originalImageOrientationVerified:true,
        onProposal(geometry){first=geometry;},
        onCandidateGeometry(geometry){second=geometry;},
        onParity(value){paired=value;}
      });
      if(id!==requestId.current)return;
      if(output.status==="proposal_only"){
        paint(canvasRef.current,bitmap,first,second);
      }
      setResult(output);
      setComparison(paired);
      setStatus("done");
    }catch{
      if(id===requestId.current){setStatus("done");setError("사진 디코딩 또는 검출에 실패했습니다.");}
    }finally{
      try{bitmap?.close?.();}catch{}
    }
  }

  return (
    <main className="min-h-screen bg-[#0b101a] px-4 py-10 text-slate-50 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <a href="/" className="text-sm text-slate-400 hover:text-white">← BEJEWELY 홈</a>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">RESEARCH ONLY · 정확도 미검증</span>
          <span className="text-xs text-slate-400">Face Lab M2 · 공통 관측 코어 병렬 비교</span>
        </div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">볼 ROI 연구 비교</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
          기존 Face Lab 방식과 Saju 공통 코어 기반 연구 후보를 같은 얼굴 검출 결과에 적용합니다.
          실제 피부 영역의 정답이나 퍼스널 컬러를 판정하는 화면이 아닙니다.
        </p>
        <section className="mt-7 rounded-3xl border border-slate-700 bg-slate-900/80 p-5 sm:p-7">
          <h2 className="text-lg font-semibold">1. 사진 선택</h2>
          <p className="mt-2 text-xs leading-6 text-slate-400">
            사진은 이 테스트에서 서버로 업로드하지 않습니다. 버튼을 누를 때 MediaPipe WASM·모델만 공개 CDN에서 불러옵니다.
            본인이 소유하거나 사용 허락을 받은 얼굴 사진만 선택해 주세요.
          </p>
          <input aria-label="ROI 테스트 사진" type="file" accept="image/jpeg,image/png,image/webp" onChange={choose}
            className="mt-4 block w-full rounded-xl border border-slate-600 bg-slate-950 p-3 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-cyan-700 file:px-3 file:py-2 file:text-white"/>
          {selected&&<p className="mt-2 text-xs text-slate-300">선택: {selected}</p>}
          <label className="mt-5 flex items-start gap-3 text-sm text-slate-300">
            <input type="checkbox" checked={orientationConfirmed}
              onChange={e=>setOrientationConfirmed(e.target.checked)}
              className="mt-1 h-4 w-4 accent-cyan-400"/>
            <span>이 사진은 좌우 반전된 미러 이미지가 아니며, 얼굴이 한 명 나옵니다.</span>
          </label>
          <button onClick={analyze} disabled={!selected||!orientationConfirmed||status==="loading"}
            className="mt-5 w-full rounded-xl bg-cyan-600 px-6 py-3 font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-40">
            {status==="loading"?"브라우저에서 얼굴 검출 중…":"2개 ROI 비교 실행"}
          </button>
          {(error||result?.status==="insufficient_evidence")&&
            <p role="status" className="mt-4 text-sm text-amber-300">
              {error||MESSAGE[result?.reason]||`분석 보류: ${result?.reason}`}
            </p>}
        </section>

        <section className="mt-6 rounded-3xl border border-slate-700 bg-slate-900/80 p-5 sm:p-7">
          <h2 className="text-lg font-semibold">2. 겹쳐 보기</h2>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-300">
            <span><span className="mr-2 text-cyan-300">━━</span> 기존 ROI</span>
            <span><span className="mr-2 text-pink-400">┄┄</span> 공통 코어 연구 ROI</span>
            <span><span className="mr-2 text-amber-400">━━</span> 제외 영역</span>
          </div>
          {result?.status!=="proposal_only"&&
            <div className="mt-4 rounded-xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-500">
              분석 후 이곳에 ROI 겹침 결과가 나타납니다.
            </div>}
          <canvas ref={canvasRef} aria-label="기존 및 Saju 공통 코어 기반 볼 ROI 오버레이"
            className={`mt-4 max-h-[600px] w-full rounded-xl object-contain ${result?.status==="proposal_only"?"":"hidden"}`}/>
        </section>

        {result?.status==="proposal_only"&&(
          <section className="mt-6 rounded-3xl border border-slate-700 bg-slate-900/80 p-5 sm:p-7">
            <h2 className="text-lg font-semibold">3. 픽셀 수준 차이</h2>
            <p className="mt-2 text-sm text-slate-400">
              동일 얼굴 검출 기반의 두 가지 서로 다른 연구 알고리즘 비교입니다.
              겹침률이 높거나 낮아도 피부 영역 정확도를 의미하지 않습니다.
            </p>
            {comparison?.status==="comparison_only"?(
              <>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {Object.entries(SIDE_NAMES).map(([key,label])=>{
                    const metric=comparison.metrics?.[key];
                    return <article key={key} className="rounded-xl border border-slate-700 bg-slate-950 p-4">
                      <h3 className="text-sm font-semibold">{label}</h3>
                      <p className="mt-3 text-2xl font-bold text-cyan-300">{percent(metric?.iou)}</p>
                      <p className="mt-1 text-xs text-slate-400">공통 영역 / 합집합 (IoU)</p>
                      <p className="mt-3 text-xs text-slate-400">기존: {metric?.baselinePixels??"-"}px</p>
                      <p className="mt-1 text-xs text-slate-400">연구: {metric?.candidatePixels??"-"}px</p>
                    </article>;
                  })}
                </div>
                <p className="mt-4 text-xs text-amber-300">
                  기하 후보 {comparison.parity==="matched"?"일치":"불일치"} · 독립 검수 피부 마스크 없음 · 색상 측정 비활성화
                </p>
              </>
            ):<p role="status" className="mt-4 text-sm text-amber-300">
              병렬 비교 보류: {comparison?.reason||"비교 결과가 준비되지 않았습니다."}
            </p>}
          </section>
        )}
        <p className="mt-7 text-xs leading-6 text-slate-500">
          테스트 결과는 브라우저 화면에서만 표시됩니다. 이 화면에는 계정·서버 API·DB 저장·피부색 측정·판매 기능이 없습니다.
          새로고침하면 결과가 사라집니다.
        </p>
      </div>
    </main>
  );
}
