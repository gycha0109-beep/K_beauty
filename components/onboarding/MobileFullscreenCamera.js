"use client";

import { motion } from "framer-motion";
import { createPortal } from "react-dom";
import { useEffect, useRef } from "react";
import useFaceLandmarkerGuide from "@/hooks/useFaceLandmarkerGuide";
import { preloadFaceLandmarker } from "@/lib/face-guide/face-landmarker-client";

const AUTO_CAPTURE_COUNTDOWN_MS = 600;

const FACE_GUIDE_COPY = Object.freeze({
  en: Object.freeze({
    loading: "Preparing face guidance",
    multiple_faces: "Keep only one person in the frame",
    no_face: "Position your face inside the oval",
    not_frontal: "Look straight at the camera",
    off_center: "Center your face inside the oval",
    ready: "Great, you can take the photo",
    stabilizing: "Good, hold still",
    too_close: "Move a little farther away",
    too_far: "Move a little closer",
    unavailable: "Face recognition could not start. Close the camera and try again"
  }),
  ko: Object.freeze({
    loading: "얼굴 가이드를 준비하고 있어요",
    multiple_faces: "한 명만 화면에 보여 주세요",
    no_face: "얼굴을 타원 안에 맞춰 주세요",
    not_frontal: "정면을 바라봐 주세요",
    off_center: "얼굴을 타원 중앙에 맞춰 주세요",
    ready: "좋아요, 촬영할 수 있어요",
    stabilizing: "좋아요, 그대로 있어 주세요",
    too_close: "조금 더 멀리 떨어져 주세요",
    too_far: "조금 더 가까이 와 주세요",
    unavailable: "얼굴 인식을 시작하지 못했습니다. 카메라를 닫고 다시 시도해 주세요"
  })
});

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none">
      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function FaceGuide({ guideRef, state = "loading" }) {
  const isReady = state === "ready";
  const isStabilizing = state === "stabilizing";
  const isWarning = [
    "multiple_faces",
    "not_frontal",
    "off_center",
    "too_close",
    "too_far",
    "unavailable"
  ].includes(state);
  const borderClass = isReady
    ? "border-emerald-300/95 shadow-[0_0_0_9999px_rgba(9,6,10,0.38),0_0_34px_rgba(110,231,183,0.55)]"
    : isStabilizing
      ? "border-emerald-200/90 shadow-[0_0_0_9999px_rgba(9,6,10,0.42)]"
      : isWarning
        ? "border-amber-300/95"
        : "border-[#FF8CB3]/95";

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      <div
        ref={guideRef}
        data-testid="face-guide-oval"
        className={`absolute left-1/2 top-[45%] aspect-[3/4] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2 shadow-[0_0_0_9999px_rgba(9,6,10,0.48)] transition-[border-color,box-shadow] duration-150 ${borderClass}`}
        style={{
          width: "min(72dvw, calc((100dvh - 230px) * 0.72), 330px)"
        }}
      />
    </div>
  );
}

export default function MobileFullscreenCamera({
  phase,
  transitionRect,
  viewportSize,
  reducedMotion,
  isVideoReady,
  videoRef,
  onVideoReady,
  closeButtonRef,
  isCapturing,
  copy,
  onClose,
  onCapture,
  onAnimationComplete
}) {
  const guideRef = useRef(null);
  const autoCaptureHandledRef = useRef(0);
  const autoCaptureTimerRef = useRef(null);
  const faceGuideActive = isVideoReady && (phase === "opening" || phase === "open");
  const faceGuide = useFaceLandmarkerGuide({
    active: faceGuideActive,
    guideRef,
    videoRef
  });
  const {
    autoCaptureToken,
    confirmCurrentFrame,
    isCaptureReady,
    progress,
    rearmAutoCapture,
    state
  } = faceGuide;
  const language = copy.capturePhoto === "Take photo" ? "en" : "ko";
  const faceGuideMessage = FACE_GUIDE_COPY[language][state];
  const width = Math.max(viewportSize.width, 1);
  const height = Math.max(viewportSize.height, 1);
  const source = transitionRect || { left: 0, top: 0, width, height };
  const scaleX = source.width / width;
  const scaleY = source.height / height;
  const isPreparing = phase === "preparing";
  const isOpening = phase === "opening";
  const isClosing = phase === "closing";
  const duration = reducedMotion ? 0.01 : isClosing ? 0.4 : 0.56;
  const transitionStart = {
    x: source.left,
    y: source.top,
    scaleX,
    scaleY,
    borderRadius: "999px"
  };
  const animate = isPreparing
    ? transitionStart
    : isOpening
      ? {
          x: [source.left, source.left + source.width * 0.015, 0],
          y: [source.top, source.top + source.height * 0.015, 0],
          scaleX: [scaleX, scaleX * 0.97, 1],
          scaleY: [scaleY, scaleY * 0.97, 1],
          borderRadius: ["999px", "999px", "0px"]
        }
      : isClosing
        ? {
            x: [0, source.left * 0.16, source.left],
            y: [0, source.top * 0.16, source.top],
            scaleX: [1, 1 - (1 - scaleX) * 0.16, scaleX],
            scaleY: [1, 1 - (1 - scaleY) * 0.16, scaleY],
            borderRadius: ["0px", "999px", "999px"]
          }
        : {
            x: 0,
            y: 0,
            scaleX: 1,
            scaleY: 1,
            borderRadius: "0px"
          };

  useEffect(() => {
    preloadFaceLandmarker().catch(() => {});
  }, []);

  useEffect(() => {
    if (
      phase !== "open" ||
      state !== "ready" ||
      !autoCaptureToken ||
      isCapturing ||
      autoCaptureHandledRef.current === autoCaptureToken
    ) {
      return undefined;
    }

    autoCaptureHandledRef.current = autoCaptureToken;
    autoCaptureTimerRef.current = window.setTimeout(() => {
      autoCaptureTimerRef.current = null;
      if (!confirmCurrentFrame()) {
        rearmAutoCapture();
        return;
      }

      videoRef.current?.pause();
      onCapture?.({
        faceGuideValidated: true,
        source: "auto"
      });
    }, AUTO_CAPTURE_COUNTDOWN_MS);

    return () => {
      if (autoCaptureTimerRef.current) {
        window.clearTimeout(autoCaptureTimerRef.current);
        autoCaptureTimerRef.current = null;
      }
    };
  }, [
    autoCaptureToken,
    confirmCurrentFrame,
    isCapturing,
    onCapture,
    phase,
    rearmAutoCapture,
    state,
    videoRef
  ]);

  useEffect(() => {
    if (phase === "preparing" || phase === "closing") {
      autoCaptureHandledRef.current = 0;
    }
  }, [phase]);

  const handleManualCapture = () => {
    if (!isCaptureReady || isCapturing || !confirmCurrentFrame()) {
      rearmAutoCapture();
      return;
    }

    videoRef.current?.pause();
    onCapture?.({
      faceGuideValidated: true,
      source: "manual"
    });
  };

  return createPortal(
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={copy.capturePhoto}
      aria-hidden={isPreparing}
      data-testid="mobile-camera-overlay"
      data-camera-phase={phase}
      data-face-guidance-ready={isCaptureReady ? "true" : "false"}
      data-face-capture-allowed={faceGuide.canCapture ? "true" : "false"}
      data-face-guide-state={state}
      data-face-guide-attempt={String(faceGuide.attempt)}
      data-face-guide-delegate={faceGuide.delegate}
      data-face-guide-error-category={faceGuide.errorCategory}
      data-face-guide-error-code={faceGuide.errorCode}
      data-face-guide-error-name={faceGuide.errorName}
      data-face-guide-error-stage={faceGuide.errorStage || "none"}
      data-face-guide-progress={progress.toFixed(3)}
      data-face-guide-recovery-attempted={faceGuide.recoveryAttempted ? "true" : "false"}
      data-face-guide-wasm-capable={faceGuide.webAssemblyCapable ? "true" : "false"}
      data-face-guide-webgl-capable={faceGuide.webGlCapable ? "true" : "false"}
      data-face-auto-capture-token={autoCaptureToken}
      className={`fixed left-0 top-0 z-[1000] h-screen w-screen origin-top-left overflow-hidden bg-[#09070A] [height:100dvh] [width:100dvw] ${
        isPreparing ? "pointer-events-none opacity-[0.001]" : "opacity-100"
      }`}
      initial={transitionStart}
      animate={animate}
      transition={{
        duration,
        times: isOpening ? [0, 0.14, 1] : isClosing ? [0, 0.16, 1] : undefined,
        ease: reducedMotion ? "linear" : [0.22, 0.78, 0.2, 1]
      }}
      onAnimationComplete={onAnimationComplete}
    >
      <div className="absolute inset-0 bg-[#09070A]">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onCanPlay={onVideoReady}
          onPlaying={onVideoReady}
          data-preview-orientation="mirrored"
          className="absolute inset-0 h-full w-full scale-x-[-1] object-cover object-center"
        />
      </div>

      <motion.div
        className="absolute inset-0 z-30"
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === "open" ? 1 : 0 }}
        transition={{ duration: reducedMotion ? 0.01 : 0.18 }}
      >
        <FaceGuide guideRef={guideRef} state={state} />

        <button
          ref={closeButtonRef}
          type="button"
          aria-label={copy.closeCamera}
          onClick={onClose}
          disabled={isCapturing}
          className="absolute z-40 flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-black/35 text-white shadow-lg backdrop-blur-sm transition active:scale-95 disabled:opacity-45"
          style={{
            left: "calc(env(safe-area-inset-left) + 16px)",
            top: "calc(env(safe-area-inset-top) + 16px)"
          }}
        >
          <CloseIcon />
        </button>

        <div
          className="absolute inset-x-0 bottom-0 z-40 flex flex-col items-center px-5 pt-5"
          style={{
            paddingBottom: "calc(env(safe-area-inset-bottom) + 18px)",
            paddingLeft: "calc(env(safe-area-inset-left) + 20px)",
            paddingRight: "calc(env(safe-area-inset-right) + 20px)"
          }}
        >
          <p
            aria-live="polite"
            data-testid="face-guide-message"
            className="mb-4 rounded-full bg-black/35 px-4 py-2 text-center text-xs font-semibold text-white/90 backdrop-blur-sm"
          >
            {isVideoReady ? faceGuideMessage : copy.cameraLoading}
          </p>
          <button
            type="button"
            aria-label={copy.capturePhoto}
            onClick={handleManualCapture}
            disabled={!isVideoReady || !isCaptureReady || isCapturing}
            className={`relative flex h-[76px] w-[76px] items-center justify-center rounded-full border-[5px] bg-white/25 shadow-[0_10px_34px_rgba(0,0,0,0.35)] transition active:scale-95 disabled:opacity-45 ${
              isCaptureReady ? "border-emerald-200" : "border-white"
            }`}
          >
            <span
              className="absolute inset-[-7px] rounded-full"
              aria-hidden="true"
              style={{
                background: `conic-gradient(rgba(110,231,183,0.95) ${Math.round(progress * 360)}deg, rgba(255,255,255,0.16) 0deg)`,
                mask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 0)",
                WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 0)"
              }}
            />
            <span className="h-[56px] w-[56px] rounded-full bg-white" aria-hidden="true" />
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}
