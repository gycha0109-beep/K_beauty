"use client";

import {useEffect,useRef,useState} from "react";
import {detectMediaPipeCheekRoiProposal} from "@/lib/face-lab-v2/personal-color/mediapipe-roi-proposal";
import {buildRoiPreviewMasks} from "@/lib/face-lab-v2/personal-color/roi-render-mask-adapter";
import {describeRoiPhotoEvidence} from "@/lib/face-lab-v2/personal-color/roi-photo-quality-research";

const FORMATS=new Set(["image/jpeg","image/png","image/webp"]);
const MAX_FILE_BYTES=10*1024*1024;
const COLORS={
  baseline:[0,221,235,137],
  candidate:[255,88,180,145],
  overlap:[72,232,169,140]
};
const MESSAGE={
  source_image_dimensions_invalid:"이미지 크기를 확인할 수 없습니다. 다른 JPG/PNG/WebP 사진을 선택해 주세요.",
  single_face_not_detected:"얼굴을 찾지 못했습니다. 정면 사진을 선택해 주세요.",
  multiple_faces_detected:"얼굴이 여러 명입니다. 얼굴 한 명이 나오는 사진으로 다시 시도해 주세요.",
  cheek_geometry_unreliable:"현재 사진에서는 볼 영역을 안정적으로 제안하기 어렵습니다.",
  vision_runtime_or_model_failed:"얼굴 모델 로딩 또는 검출에 실패했습니다. 연결 상태를 확인해 주세요.",
  vision_runtime_unavailable:"얼굴 인식 런타임을 불러오지 못했습니다.",
  roi_not_comparable:"한쪽 연구 ROI가 유효한 기하 후보를 만들지 못했습니다.",
  image_orientation_unknown:"원본 이미지 좌표를 확인하지 못했습니다."
};
const percent=(value)=>Number.isFinite(value)?(value*100).toFixed(1)+"%":"—";
function outputSize(bitmap){
  const scale=Math.min(1,720/bitmap.width,Math.sqrt(850000/(bitmap.width*bitmap.height)));
  return {width:Math.max(1,Math.floor(bitmap.width*scale)),
    height:Math.max(1,Math.floor(bitmap.height*scale))};
}
function cropRegion(baseline,candidate,size){
  const points=[...Object.values(baseline.cheekPolygons).flat(),
    ...Object.values(candidate.cheekPolygons).flat()];
  const xs=points.map(v=>v.x),ys=points.map(v=>v.y);
  const minX=Math.min(...xs),maxX=Math.max(...xs);
  const minY=Math.min(...ys),maxY=Math.max(...ys);
  const width=Math.min(1,Math.max(.35,(maxX-minX)*2.3));
  const height=Math.min(1,Math.max(.35,(maxY-minY)*3.8));
  const x=Math.max(0,Math.min(1-width,(minX+maxX-width)/2));
  const y=Math.max(0,Math.min(1-height,(minY+maxY-height)/2));
  return {x:Math.floor(x*size.width),y:Math.floor(y*size.height),
    width:Math.max(1,Math.min(size.width-Math.floor(x*size.width),Math.ceil(width*size.width))),
    height:Math.max(1,Math.min(size.height-Math.floor(y*size.height),Math.ceil(height*size.height)))};
}
function paint(canvas,photo,first,second,region,mode){
  const imageWidth=photo.width,imageHeight=photo.height;
  const overlay=document.createElement("canvas");
  overlay.width=imageWidth;overlay.height=imageHeight;
  const ctx=overlay.getContext("2d");
  if(!ctx)return;
  ctx.drawImage(photo,0,0);
  const tint=document.createElement("canvas");
  tint.width=imageWidth;tint.height=imageHeight;
  const overlayCtx=tint.getContext("2d");
  if(!overlayCtx)return;
  const pixels=overlayCtx.createImageData(imageWidth,imageHeight);
  for(let i=0;i<imageWidth*imageHeight;i++){
    const a=(first.skinRegionMasks.leftCheek[i]===1||first.skinRegionMasks.rightCheek[i]===1)
      &&first.exclusionMask[i]===0;
    const b=(second.skinRegionMasks.leftCheek[i]===1||second.skinRegionMasks.rightCheek[i]===1)
      &&second.exclusionMask[i]===0;
    const color=mode==="baseline"?(a?COLORS.baseline:null):
      mode==="candidate"?(b?COLORS.candidate:null):
      a&&b?COLORS.overlap:a?COLORS.baseline:b?COLORS.candidate:null;
    if(!color)continue;
    const n=i*4;
    pixels.data[n]=color[0];pixels.data[n+1]=color[1];
    pixels.data[n+2]=color[2];pixels.data[n+3]=color[3];
  }
  overlayCtx.putImageData(pixels,0,0);
  ctx.drawImage(tint,0,0);
  const canvasWidth=480;
  const canvasHeight=Math.max(180,Math.round(canvasWidth*region.height/region.width));
  canvas.width=canvasWidth;canvas.height=canvasHeight;
  const dest=canvas.getContext("2d");
  if(!dest)return;
  dest.drawImage(overlay,region.x,region.y,region.width,region.height,
    0,0,canvasWidth,canvasHeight);
}
function emptyCanvases(refs){
  for(const ref of refs){if(ref.current){ref.current.width=0;ref.current.height=0;}}
}
export default function FaceLabRoiLiveClient(){
  const fileRef=useRef(null);
  const request=useRef(0);
  const firstCanvas=useRef(null),secondCanvas=useRef(null),diffCanvas=useRef(null);
  const canvases=[firstCanvas,secondCanvas,diffCanvas];
  const [filename,setFilename]=useState("");
  const [status,setStatus]=useState("idle");
  const [result,setResult]=useState(null);
  const [stats,setStats]=useState(null);
  const [error,setError]=useState("");
  const [viewReady,setViewReady]=useState(false);
  const [photoEvidence,setPhotoEvidence]=useState(null);

  useEffect(()=>()=>{request.current++;},[]);
  async function analyze(file){
    const current=++request.current;
    setStatus("loading");setResult(null);setStats(null);setError("");setViewReady(false);setPhotoEvidence(null);
    emptyCanvases(canvases);
    let bitmap;
    try{
      // EXIF-oriented, unmirrored image pixel space: image-left/right only.
      // Mirrored originals cannot be independently detected here.
      bitmap=await createImageBitmap(file,{imageOrientation:"from-image"});
      if(request.current!==current)return;
      let baseline=null,candidate=null,comparison=null;
      const inspected=await detectMediaPipeCheekRoiProposal({
        image:bitmap,width:bitmap.width,height:bitmap.height,
        originalImageOrientationVerified:true,
        onProposal(value){baseline=value;},
        onCandidateGeometry(value){candidate=value;},
        onParity(value){comparison=value;}
      });
      if(request.current!==current)return;
      if(inspected.status!=="proposal_only"){
        setResult(inspected);setStatus("done");return;
      }
      setResult(inspected);
      setStats(comparison);
      if(!baseline||!candidate||comparison?.status!=="comparison_only"){
        setError("비교 보류: "+(comparison?.reason||"후보 영역을 생성하지 못했습니다."));
        setStatus("done");return;
      }
      const size=outputSize(bitmap);
      const source=document.createElement("canvas");
      source.width=size.width;source.height=size.height;
      const sourceCtx=source.getContext("2d");
      if(!sourceCtx)throw Error("canvas_unavailable");
      sourceCtx.drawImage(bitmap,0,0,size.width,size.height);
      const preview=buildRoiPreviewMasks({baseline,candidate,size});
      if(preview.status!=="preview_only"){
        setError("화면 렌더링 보류: "+(preview.reason||"roi_mask_unavailable"));
        setStatus("done");return;
      }
      const first=preview.baseline,second=preview.candidate;
      const pixelData=sourceCtx.getImageData(0,0,size.width,size.height);
      const quality=describeRoiPhotoEvidence({rgba:pixelData.data,...size,
        leftMask:second.skinRegionMasks.leftCheek,
        rightMask:second.skinRegionMasks.rightCheek,
        exclusionMask:second.exclusionMask});
      setPhotoEvidence(quality);
      const crop=cropRegion(baseline,candidate,size);
      paint(firstCanvas.current,source,first,second,crop,"baseline");
      paint(secondCanvas.current,source,first,second,crop,"candidate");
      paint(diffCanvas.current,source,first,second,crop,"difference");
      setViewReady(true);setStatus("done");
    }catch{
      if(request.current===current){
        setError("사진을 읽거나 브라우저에서 얼굴을 검출하지 못했습니다.");
        setStatus("done");
      }
    }finally{try{bitmap?.close?.();}catch{}}
  }
  function selectFile(event){
    const file=event.target.files?.[0];
    ++request.current;
    fileRef.current=null;setFilename("");setStatus("idle");
    setResult(null);setStats(null);setError("");setViewReady(false);setPhotoEvidence(null);
    emptyCanvases(canvases);
    if(!file)return;
    if(!FORMATS.has(file.type)){setError("JPG, PNG, WebP 파일만 지원합니다.");return;}
    if(file.size>MAX_FILE_BYTES){setError("10MB 이하 사진만 사용할 수 있습니다.");return;}
    fileRef.current=file;setFilename(file.name.slice(0,100));
    void analyze(file);
  }
  const canCompare=stats?.status==="comparison_only";
  const pixelCount=canCompare?stats.maskDimensions.width*stats.maskDimensions.height:0;
  const tiny=canCompare&&["leftCheek","rightCheek"].some(side=>
    Math.max(stats.metrics?.[side]?.baselinePixels||0,
      stats.metrics?.[side]?.candidatePixels||0)/pixelCount<.002
  );
  return (
    <main className="min-h-screen bg-[#0b101a] px-4 py-9 text-slate-50 sm:px-7">
      <div className="mx-auto max-w-6xl">
        <a className="text-sm text-slate-400 hover:text-white" href="/">← BEJEWELY 홈</a>
        <div className="mt-7 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-slate-800 px-3 py-1 text-slate-200">Face Lab / ROI 실험</span>
          <span className="text-amber-300">피부 정확도 미검증 · 연구용</span>
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">두 방식이 볼을 어디로 잡는가?</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
          기존 Face Lab ROI와 Saju 중립 관측 프레임의 볼 내부 메시 랜드마크로 만든 v3 후보를 같은 사진에서 비교합니다.
          <strong className="text-white"> 화면의 색칠된 부분은 피부의 정답이 아니라 컴퓨터가 제안한 후보입니다.</strong>
        </p>

        <section className="mt-6 rounded-2xl border border-slate-700 bg-slate-900/80 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">사진 선택</h2>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                선택하면 자동 비교합니다. 사진은 서버로 전송하거나 저장하지 않습니다.
                얼굴 모델과 WASM만 외부 CDN에서 내려받습니다.
              </p>
            </div>
            <span className="text-xs text-slate-400">{filename||"JPG · PNG · WebP / 최대 10MB"}</span>
          </div>
          <input aria-label="ROI 비교 사진" type="file" accept="image/jpeg,image/png,image/webp"
            onChange={selectFile}
            className="mt-4 block w-full rounded-xl border border-slate-600 bg-slate-950 p-2 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-cyan-700 file:px-4 file:py-2 file:text-white"/>
          {status==="loading"&&<p role="status" className="mt-3 text-sm text-cyan-300">얼굴을 검출하고 두 ROI를 계산하고 있습니다…</p>}
          {(error||result?.status==="insufficient_evidence")&&
            <p role="alert" className="mt-3 text-sm text-amber-300">
              {error||MESSAGE[result?.reason]||`이 사진은 비교할 수 없습니다: ${result?.reason}`}
            </p>}
        </section>

        <section className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">1. 같은 얼굴, 서로 다른 위치</h2>
            <span className="text-xs text-slate-400">얼굴 중앙부 확대 · 후보 영역만 반투명 표시</span>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {[
              {name:"기존 Face Lab",desc:"청록색: 기존 볼 후보",ref:firstCanvas},
              {name:"Face Lab 볼 메시 v3",desc:"분홍색: 내부 볼 표면 메시 후보",ref:secondCanvas},
              {name:"두 후보의 차이",desc:"초록: 공통 / 청록: 기존만 / 분홍: 연구만",ref:diffCanvas}
            ].map((item,i)=>(
              <article key={i} className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900">
                <div className="px-4 py-3">
                  <h3 className="font-semibold">{item.name}</h3>
                  <p className="mt-1 text-xs text-slate-400">{item.desc}</p>
                </div>
                {!viewReady&&<div className="flex aspect-square items-center justify-center bg-slate-950 px-5 text-center text-sm text-slate-500">
                  {status==="loading"?"분석 중…":"사진을 고르면 확대 비교가 표시됩니다."}
                </div>}
                <canvas ref={item.ref} aria-label={item.name+" 볼 영역 확대 시각화"}
                  className={`w-full bg-slate-950 ${viewReady?"block":"hidden"}`}/>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-700 bg-slate-900/80 p-5 sm:p-6">
          <h2 className="text-lg font-semibold">2. 지금 이 결과로 알 수 있는 것</h2>
          {!canCompare?
            <p className="mt-3 text-sm text-slate-400">사진 비교 후 후보의 겹침 정도와 평가 보류 사유가 표시됩니다.</p>:
            <>
              {tiny&&<div role="status" className="mt-4 rounded-xl border border-amber-700/50 bg-amber-950/30 p-4">
                <p className="font-semibold text-amber-300">볼 후보가 사진에서 매우 작게 생성되었습니다.</p>
                <p className="mt-2 text-sm leading-6 text-slate-200">
                  기존·연구 알고리즘 모두 볼 전체가 아닌 좁은 지점만 잡을 수 있습니다.
                  겹침률이 높아도 영역 위치가 타당하다는 뜻은 아닙니다.
                  <strong> 이 사진에서는 실제 피부 측정에 사용하지 않습니다.</strong>
                </p>
              </div>}
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {["leftCheek","rightCheek"].map((key,i)=>{
                  const metric=stats.metrics?.[key];
                  return <div key={key} className="rounded-xl border border-slate-700 bg-slate-950 p-4">
                    <p className="text-xs text-slate-400">화면 {i===0?"왼쪽":"오른쪽"} 볼</p>
                    <p className="mt-1 text-xl font-semibold">{percent(metric?.iou)} <span className="text-xs font-normal text-slate-400">두 후보의 겹침률</span></p>
                    <p className="mt-2 text-xs text-slate-400">기존 {metric?.baselinePixels??"—"}px · 연구 {metric?.candidatePixels??"—"}px</p>
                  </div>;
                })}
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-300">
                이것은 <strong>기존 방식과 연구 방식이 얼마나 비슷한지</strong>만 보여줍니다.
                누가 더 정확한지는 독립적으로 검수된 피부 영역 기준이 없어 판단할 수 없습니다.
              </p>
            </>}
          <p className="mt-3 text-xs leading-6 text-slate-400">
            좌·우는 사진 기준입니다. 미러 이미지 여부와 화장·그림자·가려진 피부는
            자동 검증하지 않습니다. 퍼스널 컬러·피부색 측정도 수행하지 않습니다.
          </p>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-700 bg-slate-900/80 p-5 sm:p-6">
          <h2 className="text-lg font-semibold">3. 사진의 밝기·세부 묘사 참고 지표</h2>
          <p className="mt-2 text-xs leading-6 text-slate-400">
            연구용 ROI 후보 내부 픽셀만 사용합니다. 사진의 초점·화장·그림자 또는 피부색 정확도를 판정하는 검사가 아닙니다.
          </p>
          {photoEvidence?.status==="descriptive_only"?(
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                {label:"화면 왼쪽 볼",values:photoEvidence.imageLeft},
                {label:"화면 오른쪽 볼",values:photoEvidence.imageRight}
              ].map(item=>(
                <div key={item.label} className="rounded-xl border border-slate-700 bg-slate-950 p-4">
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="mt-2 text-xs text-slate-300">
                    평균 밝기: {item.values.meanLuma.toFixed(1)} / 255
                  </p>
                  <p className="mt-1 text-xs text-slate-300">
                    극단적으로 어둡거나 밝은 픽셀: {(item.values.clippedFraction*100).toFixed(1)}%
                  </p>
                  <p className="mt-1 text-xs text-slate-300">
                    국소 고주파 신호: {item.values.detailSignal.toFixed(4)}
                  </p>
                </div>
              ))}
              <p className="sm:col-span-2 text-xs leading-6 text-amber-300">
                좌우 밝기 차이: {(photoEvidence.meanLumaGap*100).toFixed(1)}%p (0–255 정규화 기준).
                이 수치에 검증된 합격 임계값은 없습니다. 특히 고주파 신호는 피부 질감, JPEG 압축, 조명에도 달라집니다.
              </p>
            </div>
          ):(
            <p className="mt-3 text-sm text-slate-500">ROI가 유효하게 생성되면 참고 지표가 표시됩니다.</p>
          )}
        </section>
      </div>
    </main>
  );
}
