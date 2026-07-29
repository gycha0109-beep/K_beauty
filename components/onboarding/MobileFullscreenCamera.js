"use client";

import { motion } from "framer-motion";
import { createPortal } from "react-dom";

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none">
      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function FaceGuide({ state = "idle" }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden" data-face-guide-state={state}>
      <div
        className={`absolute left-1/2 top-[45%] aspect-[3/4] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2 shadow-[0_0_0_9999px_rgba(9,6,10,0.48)] transition-colors ${
          state === "ready"
            ? "border-emerald-300/95 shadow-[0_0_0_9999px_rgba(9,6,10,0.4)]"
            : "border-[#FF8CB3]/95"
        }`}
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
  loadingVisual,
  isVideoReady,
  videoRef,
  closeButtonRef,
  isCapturing,
  copy,
  onClose,
  onCapture,
  onAnimationComplete
}) {
  const width = Math.max(viewportSize.width, 1);
  const height = Math.max(viewportSize.height, 1);
  const source = transitionRect || { left: 0, top: 0, width, height };
  const scaleX = source.width / width;
  const scaleY = source.height / height;
  const isPreparing = phase === "requesting" || phase === "waiting_for_frame";
  const isExpanding = phase === "expanding";
  const isClosing = phase === "closing";
  const duration = reducedMotion ? 0.01 : isClosing ? 0.38 : 0.56;
  const transitionStart = {
    x: source.left,
    y: source.top,
    scaleX,
    scaleY,
    borderRadius: "999px"
  };
  const animate = isPreparing
    ? transitionStart
    : isExpanding
    ? {
        x: [source.left, source.left + source.width * 0.015, 0],
        y: [source.top, source.top + source.height * 0.015, 0],
        scaleX: [scaleX, scaleX * 0.97, 1],
        scaleY: [scaleY, scaleY * 0.97, 1],
        borderRadius: ["999px", "999px", "0px"]
      }
    : isClosing
      ? {
          x: source.left,
          y: source.top,
          scaleX,
          scaleY,
          borderRadius: "999px"
        }
      : {
          x: 0,
          y: 0,
          scaleX: 1,
          scaleY: 1,
          borderRadius: "0px"
        };

  return createPortal(
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={copy.capturePhoto}
      aria-hidden={isPreparing}
      data-testid="mobile-camera-overlay"
      data-camera-phase={phase}
      className={`fixed left-0 top-0 z-[1000] h-screen w-screen origin-top-left overflow-hidden bg-[#09070A] [height:100dvh] [width:100dvw] ${
        isPreparing ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      initial={transitionStart}
      animate={animate}
      transition={{
        duration,
        times: isExpanding ? [0, 0.14, 1] : undefined,
        ease: reducedMotion ? "linear" : [0.22, 0.78, 0.2, 1]
      }}
      onAnimationComplete={onAnimationComplete}
    >
      <div className="absolute inset-0 bg-[#09070A]">
        <div className={`absolute inset-0 transition-opacity duration-200 ${isVideoReady ? "opacity-0" : "opacity-100"}`}>
          {loadingVisual}
        </div>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 h-full w-full scale-x-[-1] object-cover object-center ${
            isVideoReady ? "opacity-100" : "opacity-0"
          }`}
        />
      </div>

      <motion.div
        className="absolute inset-0 z-30"
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === "open" ? 1 : 0 }}
        transition={{ duration: reducedMotion ? 0.01 : 0.18 }}
      >
        <FaceGuide state="idle" />

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
          <p className="mb-4 rounded-full bg-black/35 px-4 py-2 text-center text-xs font-semibold text-white/90 backdrop-blur-sm">
            {isVideoReady ? copy.alignFace : copy.cameraLoading}
          </p>
          <button
            type="button"
            aria-label={copy.capturePhoto}
            onClick={onCapture}
            disabled={!isVideoReady || isCapturing}
            className="flex h-[76px] w-[76px] items-center justify-center rounded-full border-[5px] border-white bg-white/25 shadow-[0_10px_34px_rgba(0,0,0,0.35)] transition active:scale-95 disabled:opacity-45"
          >
            <span className="h-[56px] w-[56px] rounded-full bg-white" aria-hidden="true" />
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}
