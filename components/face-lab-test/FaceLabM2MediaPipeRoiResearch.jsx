"use client";

import { useEffect, useRef, useState } from "react";
import {
  detectMediaPipeCheekRoiProposal
} from "@/lib/face-lab-v2/personal-color/mediapipe-roi-proposal";

// Explicit, development-only opt-in. MediaPipe model/WASM are public CDN assets.
// Photo inference is browser-local; do not upload/store analysis overlays.
function drawProposal(canvas, bitmap, polygons) {
  if (!canvas) return;
  const maxWidth = 360;
  const scale = Math.min(1, maxWidth / bitmap.width);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.drawImage(bitmap, 0, 0, width, height);
  const trace = (vertices, color) => {
    ctx.beginPath();
    for (let i = 0; i < vertices.length; i++) {
      const p = vertices[i];
      if (i === 0) ctx.moveTo(p.x * width, p.y * height);
      else ctx.lineTo(p.x * width, p.y * height);
    }
    ctx.closePath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = color;
    ctx.stroke();
  };
  trace(polygons.cheekPolygons.leftCheek, "#00e5ff");
  trace(polygons.cheekPolygons.rightCheek, "#00e5ff");
  for (const polygon of polygons.exclusionPolygons) trace(polygon, "#ffb923");
}

export default function FaceLabM2MediaPipeRoiResearch({ sourceImageFile }) {
  const canvasRef = useRef(null);
  const requestRef = useRef(0);
  const [orientationAcknowledged, setOrientationAcknowledged] = useState(false);
  const [state, setState] = useState({ status: "idle", result: null });

  useEffect(() => {
    requestRef.current += 1;
    setState({ status: "idle", result: null });
    setOrientationAcknowledged(false);
    const canvas = canvasRef.current;
    if (canvas) { canvas.width = 0; canvas.height = 0; }
    return () => { requestRef.current += 1; };
  }, [sourceImageFile]);

  async function runLocalInference() {
    if (!sourceImageFile || !orientationAcknowledged || state.status === "loading") return;
    const request = ++requestRef.current;
    setState({ status: "loading", result: null });
    const canvas = canvasRef.current;
    if (canvas) { canvas.width = 0; canvas.height = 0; }
    let bitmap;
    let parity = null;
    try {
      bitmap = await createImageBitmap(sourceImageFile, { imageOrientation: "from-image" });
      if (request !== requestRef.current) return;
      const result = await detectMediaPipeCheekRoiProposal({
        image: bitmap, width: bitmap.width, height: bitmap.height,
        // Decoded, EXIF-oriented ImageBitmap is analyzed in its unmirrored
        // pixel coordinate system. User confirms it is not mirrored upstream.
        originalImageOrientationVerified: orientationAcknowledged,
        onParity: (comparison) => {
          if (request === requestRef.current) parity = comparison;
        },
        onProposal: (proposal) => {
          if (request === requestRef.current) drawProposal(canvasRef.current, bitmap, proposal);
        }
      });
      if (request === requestRef.current) setState({ status: "complete", result, parity });
    } catch {
      if (request === requestRef.current) {
        setState({ status: "complete", result: {
          status: "insufficient_evidence", reason: "image_decode_or_detector_failed"
        } });
      }
    } finally {
      try { bitmap?.close?.(); } catch { /* local bitmap disposal */ }
    }
  }

  if (process.env.NODE_ENV !== "development") return null;
  return (
    <section data-testid="face-lab-m2-mediapipe-roi-research"
      className="ui-card-subtle p-5 sm:p-6">
      <p className="ui-kicker">FACE LAB · ROI RESEARCH · LOCAL</p>
      <h3 className="ui-title mt-2 text-lg">MediaPipe 볼 영역 자동 제안 검증</h3>
      <p className="ui-text-secondary mt-2 text-xs leading-5">
        버튼을 누른 경우에만 외부 공개 CDN에서 MediaPipe WASM·모델을 불러옵니다.
        얼굴 사진은 이 기능에서 서버로 전송하지 않고 브라우저에서 처리합니다.
        자동 피부 분할·피부색 측정·퍼스널 컬러 판정은 수행하지 않습니다.
      </p>
      <label className="mt-3 flex items-start gap-2 text-xs">
        <input type="checkbox" checked={orientationAcknowledged}
          onChange={(event) => setOrientationAcknowledged(event.target.checked)} />
        <span>사진이 좌우 반전된 미러 미리보기가 아님을 확인했습니다 (독립 검수 아님).</span>
      </label>
      <button type="button"
        data-testid="face-lab-m2-mediapipe-run"
        className="ui-button-secondary mt-3 min-h-11 px-4 text-sm"
        disabled={!sourceImageFile || !orientationAcknowledged || state.status === "loading"}
        onClick={() => void runLocalInference()}>
        {state.status === "loading" ? "브라우저에서 검출 중..." : "랜드마크로 볼 ROI 제안"}
      </button>
      {state.status === "complete" && state.result?.status === "proposal_only" ? (
        <p className="ui-text-secondary mt-3 text-sm" data-testid="face-lab-m2-mediapipe-status">
          ROI 제안 완료 · 감지 얼굴 1명 · 왼쪽 후보 {state.result.candidatePixels.leftCheek}픽셀 /
          오른쪽 후보 {state.result.candidatePixels.rightCheek}픽셀.
          독립 피부 마스크 검수 전이므로 측정 및 색상 판정은 보류합니다.
        </p>
      ) : state.status === "complete" ? (
        <p className="ui-text-secondary mt-3 text-sm" data-testid="face-lab-m2-mediapipe-status">
          ROI 보류 · {state.result?.reason || "insufficient_evidence"}.
          네트워크 모델 자산이나 얼굴·원본 좌표 조건을 확인해 주세요.
        </p>
      ) : null}
      {state.status === "complete" && state.result?.status === "proposal_only" ? (
        <p className="ui-text-secondary mt-2 text-xs"
          data-testid="face-lab-m2-core-parity-status">
          공통 관측 계약 후보 병렬 비교 · {state.parity?.status === "comparison_only"
            ? state.parity.parity === "matched"
              ? "ROI 마스크 일치 (서로 다른 연구 후보)"
              : "ROI 마스크 불일치 — 추가 검토 필요"
            : "비교 보류"}
          . 실제 피부 ROI 정확도 검증은 별도입니다.
        </p>
      ) : null}
      <canvas ref={canvasRef} data-testid="face-lab-m2-mediapipe-overlay"
        className="mt-3 max-w-full rounded-lg" aria-label="연구용 볼 영역 제안 오버레이" />
      <p className="ui-text-secondary mt-2 text-xs">
        청록색: 볼 ROI 제안 · 주황색: 눈/입 제외 영역.
        이미지와 좌표는 로컬 메모리에만 유지되며 저장 버튼이 없습니다.
      </p>
    </section>
  );
}
