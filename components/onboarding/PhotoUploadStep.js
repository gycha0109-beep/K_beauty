"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import MobileFullscreenCamera from "@/components/onboarding/MobileFullscreenCamera";
import { writeSafeLog } from "@/lib/security/error-redaction";

const INTRO_FACE_IMAGE_SRC = "/images/Facial_1.png";
const CAMERA_HISTORY_STATE_KEY = "bejewelyMobileCamera";
const VIDEO_READY_TIMEOUT_MS = 8000;

const STEP_COPY = {
  ko: {
    brand: "BEJEWELY",
    kicker: "Skin Match AI",
    lead: "내 피부에 딱 맞는",
    highlight: "제품을 찾아드려요",
    hint: "사진 신호와 설문 답변을 함께 분석합니다.",
    guide: "얼굴을 원 안에 맞춰주세요",
    privacy: "JPEG, PNG, WebP · 최대 8MB · 사진은 저장되지 않고 분석에만 사용합니다",
    camera: "지금 촬영하기",
    gallery: "사진에서 선택",
    retake: "다시 촬영하기",
    change: "다른 사진 선택",
    next: "다음",
    capture: "촬영",
    cancel: "취소",
    closeCamera: "카메라 닫기",
    capturePhoto: "사진 촬영",
    cameraLoading: "카메라를 준비하고 있어요",
    alignFace: "타원 안에 얼굴을 맞춰 주세요",
    cameraError: "카메라 접근에 실패했습니다.",
    previewAlt: "업로드한 얼굴 사진 미리보기",
    steps: [
      { title: "사진 촬영", body: "피부 신호를 확인합니다." },
      { title: "질문 답변", body: "고민과 선호를 반영합니다." },
      { title: "분석 완료", body: "맞춤 추천을 제공합니다." }
    ],
    tips: [
      { title: "밝은 곳", body: "자연광이 좋아요." },
      { title: "정면", body: "카메라를 바라봐 주세요." },
      { title: "가까이", body: "얼굴이 크게 보여야 해요." }
    ]
  },
  en: {
    brand: "BEJEWELY",
    kicker: "Skin Match AI",
    lead: "Find products",
    highlight: "matched to your skin",
    hint: "We combine photo signals with your survey answers.",
    guide: "Place your face inside the circle",
    privacy: "JPEG, PNG, WebP · up to 8MB · used only for analysis and not saved",
    camera: "Use Camera",
    gallery: "Choose Photo",
    retake: "Retake Photo",
    change: "Choose Different Photo",
    next: "Next",
    capture: "Capture",
    cancel: "Cancel",
    closeCamera: "Close camera",
    capturePhoto: "Take photo",
    cameraLoading: "Preparing camera",
    alignFace: "Position your face inside the oval",
    cameraError: "Camera access failed.",
    previewAlt: "Preview of the uploaded face photo",
    steps: [
      { title: "Take photo", body: "Read visible skin signals." },
      { title: "Answer questions", body: "Add concerns and preferences." },
      { title: "Get result", body: "Receive matched product picks." }
    ],
    tips: [
      { title: "Bright light", body: "Natural light works best." },
      { title: "Face forward", body: "Look straight at the camera." },
      { title: "Move closer", body: "Keep your face clearly visible." }
    ]
  }
};

function CameraIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <path d="M8.5 7.5 10 5.5h4l1.5 2H18a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h2.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="3.25" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="m7 16 3.4-3.4a1.2 1.2 0 0 1 1.7 0L15.5 16l1.2-1.2a1.2 1.2 0 0 1 1.7 0L20 16.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="8.5" cy="9.5" r="1" fill="currentColor" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none">
      <rect x="5.5" y="10" width="13" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M8.5 10V7.8a3.5 3.5 0 0 1 7 0V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ShootingTipIcon({ index }) {
  if (index === 0) {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
        <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 3.5v2.2M12 18.3v2.2M4.5 12h2.2M17.3 12h2.2M6.7 6.7l1.55 1.55M15.75 15.75l1.55 1.55M17.3 6.7l-1.55 1.55M8.25 15.75 6.7 17.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  if (index === 1) {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
        <path d="M8 14.5c1.15-1.05 2.48-1.58 4-1.58s2.85.53 4 1.58" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M8.2 9.2c.75-1.2 2.05-1.95 3.8-1.95s3.05.75 3.8 1.95" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M9.2 17.2h5.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <circle cx="10.5" cy="10.5" r="4.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="m14 14 4.2 4.2M10.5 8.2v4.6M8.2 10.5h4.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function FaceSilhouette() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
      <div className="w-[43%] max-w-[224px] text-[#F3E6EA] dark:text-[#25232A]">
        <svg viewBox="0 0 800 800" aria-hidden="true" className="h-full w-full scale-[0.94] fill-current">
          <path d="M400 108C295.066 108 210 193.066 210 298V360C210 441.873 261.77 511.653 334.38 538.42C347.9 543.404 357 556.363 357 570.772V583.9C357 605.994 343.705 625.914 323.304 634.321L177.788 694.278C119.99 718.091 82 774.373 82 836V860H718V836C718 774.373 680.01 718.091 622.212 694.278L476.696 634.321C456.295 625.914 443 605.994 443 583.9V570.772C443 556.363 452.1 543.404 465.62 538.42C538.23 511.653 590 441.873 590 360V298C590 193.066 504.934 108 400 108Z" />
        </svg>
      </div>
    </div>
  );
}

function StepRail({ steps }) {
  return (
    <aside className="hidden lg:flex lg:flex-col lg:justify-center">
      <div className="space-y-1">
        {steps.map((step, index) => (
          <div key={step.title} className="relative flex gap-2.5 pb-4 last:pb-0">
            {index < steps.length - 1 ? (
              <span className="absolute left-[14px] top-8 h-[calc(100%-24px)] w-px bg-[#F7CBD9] dark:bg-[#2D2932]" />
            ) : null}
            <span
              className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
                index === 0
                  ? "border-transparent bg-[#FF4F8A] text-white shadow-[0_8px_18px_rgba(255,79,138,0.18)]"
                  : "border-[#EEE7EA] bg-white text-[#666666] dark:border-[#2D2932] dark:bg-[#17141C] dark:text-[#A1A1AA]"
              }`}
            >
              {index + 1}
            </span>
            <div className="pt-1">
              <p className={`text-[12px] font-semibold ${index === 0 ? "text-[#FF4F8A]" : "text-[#666666] dark:text-[#A1A1AA]"}`}>
                {step.title}
              </p>
              <p className="mt-0.5 text-[10px] leading-5 text-[#8A8A8F] dark:text-[#7D7D86]">{step.body}</p>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

function MobileStepChips({ steps }) {
  return (
    <div className="mt-4 lg:hidden">
      <div className="relative mx-auto max-w-[300px] px-1">
        <div className="pointer-events-none absolute left-8 right-8 top-[10px] z-0 h-px bg-[#F7CBD9] dark:bg-[#2D2932]" />
        <div className="relative grid grid-cols-3">
          {steps.map((step, index) => (
            <div key={step.title} className="relative z-10 flex flex-col items-center text-center">
              <span
                className={`relative z-10 flex h-[21px] w-[21px] items-center justify-center rounded-full border text-[9px] font-semibold ${
                  index === 0
                    ? "border-transparent bg-[#FF4F8A] text-white shadow-[0_7px_14px_rgba(255,79,138,0.16)]"
                    : "border-[#EEE7EA] bg-white text-[#666666] dark:border-[#2D2932] dark:bg-[#17141C] dark:text-[#A1A1AA]"
                }`}
              >
                {index + 1}
              </span>
              <span className={`mt-1 text-[9px] font-semibold leading-4 ${index === 0 ? "text-[#FF4F8A]" : "text-[#666666] dark:text-[#A1A1AA]"}`}>
                {step.title}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ShootingTips({ tips }) {
  return (
    <div className="mx-auto mt-4 grid w-full max-w-3xl grid-cols-3 gap-2 sm:mt-6">
      {tips.map((tip, index) => (
        <div
          key={tip.title}
          className="flex min-w-0 flex-col items-center justify-center rounded-[0.95rem] border border-[#F0E6EA] bg-white px-2 py-2.5 text-center shadow-[0_8px_20px_rgba(17,17,17,0.04)] dark:border-[#2D2932] dark:bg-[#17141C] sm:rounded-[1.1rem] sm:px-3 sm:py-3"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#FF4F8A]">
            <ShootingTipIcon index={index} />
          </span>
          <p className="mt-1 truncate text-[11px] font-bold text-[#111111] dark:text-white sm:text-xs">{tip.title}</p>
          <p className="hidden text-[10px] leading-4 text-[#666666] dark:text-[#A1A1AA] sm:block">{tip.body}</p>
        </div>
      ))}
    </div>
  );
}

export default function PhotoUploadStep({
  locale = "ko",
  previewUrl,
  onImageChange,
  onNext,
  error
}) {
  const t = STEP_COPY[locale] || STEP_COPY.ko;
  const galleryInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraStageRef = useRef(null);
  const closeButtonRef = useRef(null);
  const mountedRef = useRef(true);
  const streamRef = useRef(null);
  const requestTokenRef = useRef(0);
  const fullscreenPhaseRef = useRef("closed");
  const isRequestingRef = useRef(false);
  const isCapturingRef = useRef(false);
  const transitionFallbackRef = useRef(null);
  const videoReadyTimeoutRef = useRef(null);
  const historyEntryRef = useRef(null);
  const popStateHandlerRef = useRef(null);
  const historyCloseFallbackRef = useRef(null);
  const lastCameraTriggerRef = useRef(null);
  const reducedMotion = useReducedMotion();
  const hasPreview = Boolean(previewUrl);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [stream, setStream] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [showIntroFace, setShowIntroFace] = useState(true);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [fullscreenPhase, setFullscreenPhase] = useState("closed");
  const [transitionRect, setTransitionRect] = useState(null);
  const [viewportSize, setViewportSize] = useState({ width: 1, height: 1 });
  const isFullscreenSession = fullscreenPhase !== "closed";
  const isFullscreenVisible = fullscreenPhase === "opening" || fullscreenPhase === "open" || fullscreenPhase === "closing";

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setShowIntroFace(false);
    }, 2600);

    return () => {
      window.clearTimeout(timerId);
    };
  }, []);

  useEffect(() => {
    if (!isCameraOpen || !stream || !videoRef.current) {
      return;
    }

    videoRef.current.srcObject = stream;
    videoRef.current.play().catch(() => {});
  }, [isCameraOpen, isFullscreenSession, stream]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      requestTokenRef.current += 1;
      isRequestingRef.current = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;

      if (transitionFallbackRef.current) {
        window.clearTimeout(transitionFallbackRef.current);
      }
      if (videoReadyTimeoutRef.current) {
        window.clearTimeout(videoReadyTimeoutRef.current);
      }
      if (historyCloseFallbackRef.current) {
        window.clearTimeout(historyCloseFallbackRef.current);
      }
      if (popStateHandlerRef.current) {
        window.removeEventListener("popstate", popStateHandlerRef.current);
      }

      const entry = historyEntryRef.current;
      if (entry && window.history.state?.[CAMERA_HISTORY_STATE_KEY]?.id === entry.id) {
        const nextState = { ...(window.history.state || {}) };
        delete nextState[CAMERA_HISTORY_STATE_KEY];
        window.history.replaceState(nextState, "", window.location.href);
      }
    };
  }, []);

  useEffect(() => {
    if (!isFullscreenVisible) {
      return;
    }

    const body = document.body;
    const root = document.documentElement;
    const scrollY = window.scrollY;
    const previousBodyStyles = {
      overflow: body.style.overflow,
      overscrollBehavior: body.style.overscrollBehavior,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      touchAction: body.style.touchAction
    };
    const previousRootStyles = {
      overflow: root.style.overflow,
      overscrollBehavior: root.style.overscrollBehavior
    };

    root.style.overflow = "hidden";
    root.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.touchAction = "none";

    return () => {
      Object.assign(body.style, previousBodyStyles);
      Object.assign(root.style, previousRootStyles);
      window.scrollTo(0, scrollY);
    };
  }, [isFullscreenVisible]);

  useEffect(() => {
    if (!isFullscreenVisible) {
      return;
    }

    const syncViewportSize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };
    const visualViewport = window.visualViewport;

    window.addEventListener("resize", syncViewportSize);
    visualViewport?.addEventListener("resize", syncViewportSize);

    return () => {
      window.removeEventListener("resize", syncViewportSize);
      visualViewport?.removeEventListener("resize", syncViewportSize);
    };
  }, [isFullscreenVisible]);

  useEffect(() => {
    if (fullscreenPhase !== "open") {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus({ preventScroll: true });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [fullscreenPhase]);

  useEffect(() => {
    if (fullscreenPhase !== "opening" && fullscreenPhase !== "closing") {
      return;
    }

    if (transitionFallbackRef.current) {
      window.clearTimeout(transitionFallbackRef.current);
    }

    transitionFallbackRef.current = window.setTimeout(
      () => {
        if (fullscreenPhase === "opening") {
          fullscreenPhaseRef.current = "open";
          setFullscreenPhase("open");
        } else {
          finishFullscreenClose();
        }
      },
      reducedMotion ? 80 : fullscreenPhase === "opening" ? 720 : 520
    );

    return () => {
      if (transitionFallbackRef.current) {
        window.clearTimeout(transitionFallbackRef.current);
        transitionFallbackRef.current = null;
      }
    };
  }, [fullscreenPhase, reducedMotion]);

  const handleFileChange = (file) => {
    if (!file) {
      return;
    }

    setCameraError(null);
    onImageChange?.({ target: { files: [file] } });
  };

  function clearVideoReadyTimeout() {
    if (videoReadyTimeoutRef.current) {
      window.clearTimeout(videoReadyTimeoutRef.current);
      videoReadyTimeoutRef.current = null;
    }
  }

  function stopCameraTracks() {
    const activeStream = streamRef.current;

    if (activeStream) {
      activeStream.getTracks().forEach((track) => track.stop());
    }

    streamRef.current = null;
    setStream(null);
  }

  function clearCameraHistoryEntry({ removeCurrentMarker = false } = {}) {
    if (historyCloseFallbackRef.current) {
      window.clearTimeout(historyCloseFallbackRef.current);
      historyCloseFallbackRef.current = null;
    }

    if (popStateHandlerRef.current) {
      window.removeEventListener("popstate", popStateHandlerRef.current);
      popStateHandlerRef.current = null;
    }

    const entry = historyEntryRef.current;
    if (
      removeCurrentMarker &&
      entry &&
      window.history.state?.[CAMERA_HISTORY_STATE_KEY]?.id === entry.id
    ) {
      const nextState = { ...(window.history.state || {}) };
      delete nextState[CAMERA_HISTORY_STATE_KEY];
      window.history.replaceState(nextState, "", window.location.href);
    }

    historyEntryRef.current = null;
  }

  function createCameraHistoryEntry() {
    if (historyEntryRef.current) {
      return;
    }

    const entryId = `camera-${Date.now()}-${requestTokenRef.current}`;
    const existingState =
      window.history.state && typeof window.history.state === "object" && !Array.isArray(window.history.state)
        ? window.history.state
        : {};

    historyEntryRef.current = { id: entryId };
    popStateHandlerRef.current = () => {
      if (!historyEntryRef.current) {
        return;
      }

      clearCameraHistoryEntry();
      beginFullscreenClose();
    };
    window.addEventListener("popstate", popStateHandlerRef.current);
    window.history.pushState(
      {
        ...existingState,
        [CAMERA_HISTORY_STATE_KEY]: { id: entryId }
      },
      "",
      window.location.href
    );
  }

  function finishFullscreenClose() {
    if (fullscreenPhaseRef.current === "closed") {
      return;
    }

    clearVideoReadyTimeout();
    clearCameraHistoryEntry({ removeCurrentMarker: true });
    stopCameraTracks();
    setIsCameraOpen(false);
    fullscreenPhaseRef.current = "closed";
    setFullscreenPhase("closed");
    setTransitionRect(null);
    setIsVideoReady(false);
    setIsCapturing(false);
    isCapturingRef.current = false;
    window.requestAnimationFrame(() => {
      lastCameraTriggerRef.current?.focus({ preventScroll: true });
    });
  }

  const stopCamera = () => {
    requestTokenRef.current += 1;
    isRequestingRef.current = false;
    clearVideoReadyTimeout();
    stopCameraTracks();
    setIsCameraOpen(false);
    setIsVideoReady(false);
    setIsCapturing(false);
    isCapturingRef.current = false;
  };

  function beginFullscreenClose() {
    if (fullscreenPhaseRef.current === "closed" || fullscreenPhaseRef.current === "closing") {
      return;
    }

    requestTokenRef.current += 1;
    isRequestingRef.current = false;
    clearVideoReadyTimeout();

    if (fullscreenPhaseRef.current === "preparing") {
      finishFullscreenClose();
      return;
    }

    setViewportSize({
      width: window.innerWidth,
      height: window.innerHeight
    });
    setTransitionRect(
      cameraStageRef.current?.getBoundingClientRect() || {
        left: 0,
        top: 0,
        width: 1,
        height: 1
      }
    );
    fullscreenPhaseRef.current = "closing";
    setFullscreenPhase("closing");
  }

  const closeFullscreenCamera = () => {
    if (fullscreenPhaseRef.current === "closed" || fullscreenPhaseRef.current === "closing") {
      return;
    }

    const entry = historyEntryRef.current;
    const isCurrentCameraEntry = entry && window.history.state?.[CAMERA_HISTORY_STATE_KEY]?.id === entry.id;

    if (isCurrentCameraEntry) {
      historyCloseFallbackRef.current = window.setTimeout(() => {
        if (!historyEntryRef.current) {
          return;
        }

        clearCameraHistoryEntry({ removeCurrentMarker: true });
        beginFullscreenClose();
      }, 700);
      window.history.back();
      return;
    }

    beginFullscreenClose();
  };

  const openCamera = async (event) => {
    if (isRequestingRef.current || isCameraOpen || fullscreenPhaseRef.current !== "closed") {
      return;
    }

    const useFullscreen =
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 1023px)").matches &&
      Boolean(cameraStageRef.current);
    const token = requestTokenRef.current + 1;
    let nextStream = null;

    requestTokenRef.current = token;
    isRequestingRef.current = true;
    lastCameraTriggerRef.current = event?.currentTarget || null;

    if (useFullscreen) {
      const rect = cameraStageRef.current.getBoundingClientRect();
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
      setTransitionRect({
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
      });
      fullscreenPhaseRef.current = "preparing";
      setFullscreenPhase("preparing");
    }

    try {
      setCameraError(null);
      setIsVideoReady(false);

      try {
        nextStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false
        });
      } catch {
        if (requestTokenRef.current !== token) {
          return;
        }

        nextStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }

      if (requestTokenRef.current !== token) {
        nextStream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = nextStream;
      setStream(nextStream);
      setIsCameraOpen(true);

      if (useFullscreen) {
        clearVideoReadyTimeout();
        videoReadyTimeoutRef.current = window.setTimeout(() => {
          if (requestTokenRef.current !== token || fullscreenPhaseRef.current !== "preparing") {
            return;
          }

          writeSafeLog("warn", {
            event: "client_operation_failed",
            category: "browser_api_unavailable",
            operation: "camera_video_ready",
            dependency: "browser",
            retryable: true
          });
          setCameraError(t.cameraError);
          beginFullscreenClose();
        }, VIDEO_READY_TIMEOUT_MS);
      }
    } catch {
      if (requestTokenRef.current !== token) {
        nextStream?.getTracks().forEach((track) => track.stop());
        return;
      }

      writeSafeLog("warn", {
        event: "client_operation_failed",
        category: "browser_api_unavailable",
        operation: "client",
        dependency: "browser",
        retryable: false
      });
      setCameraError(t.cameraError);

      if (useFullscreen) {
        beginFullscreenClose();
      } else {
        stopCamera();
      }
    } finally {
      if (requestTokenRef.current === token) {
        isRequestingRef.current = false;
      }
    }
  };

  const handleFullscreenVideoReady = () => {
    if (fullscreenPhaseRef.current !== "preparing" || !streamRef.current) {
      return;
    }

    const video = videoRef.current;
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) {
      return;
    }

    clearVideoReadyTimeout();
    setIsVideoReady(true);
    createCameraHistoryEntry();
    fullscreenPhaseRef.current = "opening";
    setFullscreenPhase("opening");
  };

  const capturePhoto = () => {
    if (isCapturingRef.current) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    isCapturingRef.current = true;
    setIsCapturing(true);
    context.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!mountedRef.current) {
          return;
        }

        if (!blob) {
          isCapturingRef.current = false;
          setIsCapturing(false);
          return;
        }

        const file = new File([blob], "selfie.jpg", { type: "image/jpeg" });
        handleFileChange(file);

        if (isFullscreenSession) {
          closeFullscreenCamera();
        } else {
          stopCamera();
        }
      },
      "image/jpeg",
      0.9
    );
  };

  const stageContent = () => {
    if (isCameraOpen && !isFullscreenSession) {
      return (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onCanPlay={() => setIsVideoReady(true)}
          className="absolute inset-0 h-full w-full scale-x-[-1] rounded-full object-cover object-center"
        />
      );
    }

    if (hasPreview) {
      return (
        <img
          src={previewUrl}
          alt={t.previewAlt}
          className="absolute inset-0 h-full w-full rounded-full object-cover object-center"
        />
      );
    }

    return (
      <>
        <FaceSilhouette />
        <img
          src={INTRO_FACE_IMAGE_SRC}
          alt=""
          aria-hidden="true"
          className={`absolute inset-0 z-10 h-full w-full rounded-full object-cover object-center transition-opacity duration-[1800ms] ease-in-out motion-reduce:transition-none ${
            showIntroFace ? "opacity-100" : "opacity-0"
          }`}
        />
      </>
    );
  };

  const primaryLabel = isCameraOpen && !isFullscreenSession ? t.capture : hasPreview ? t.next : t.camera;
  const secondaryLabel = isCameraOpen && !isFullscreenSession ? t.cancel : t.gallery;
  const primaryAction = isCameraOpen && !isFullscreenSession ? capturePhoto : hasPreview ? onNext : openCamera;
  const secondaryAction = isCameraOpen && !isFullscreenSession ? stopCamera : () => galleryInputRef.current?.click();

  const handleFullscreenAnimationComplete = () => {
    if (fullscreenPhase === "opening") {
      fullscreenPhaseRef.current = "open";
      setFullscreenPhase("open");
    } else if (fullscreenPhase === "closing") {
      finishFullscreenClose();
    }
  };

  return (
    <section className="relative flex flex-1 flex-col py-2 lg:py-7">
      <div className="relative overflow-hidden rounded-[1.6rem] border border-[#F4DCE5] bg-white shadow-[0_18px_50px_rgba(255,79,138,0.08)] dark:border-[#2D2932] dark:bg-[#17141C] dark:shadow-[0_22px_70px_rgba(0,0,0,0.34)] sm:rounded-[2rem]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_44%,rgba(255,79,138,0.105),transparent_48%)] dark:bg-[radial-gradient(circle_at_50%_42%,rgba(255,79,138,0.18),transparent_48%)]" />
        <div className="relative z-10 grid gap-3 px-3.5 py-3.5 sm:gap-5 sm:px-6 sm:py-6 lg:grid-cols-[170px_minmax(0,1fr)] lg:gap-8 lg:px-8 lg:py-7">
          <StepRail steps={t.steps} />

          <div className="flex min-w-0 flex-col">
            <div className="order-1 mx-auto max-w-2xl text-center">
              <p className="text-[13px] font-extrabold tracking-[0.48em] text-[#FF2F6D] sm:text-sm">
                {t.brand}
              </p>
              <span className="mt-4 inline-flex rounded-full border border-[#F3DDE5] bg-[#FFF8FA] px-3 py-1 text-[10px] font-semibold text-[#FF4F8A] dark:border-[#34232C] dark:bg-[#0B0A0E] sm:text-xs">
                {t.kicker}
              </span>
              <h1 className="mt-3 text-[1.65rem] font-bold leading-[1.18] text-[#111111] dark:text-white sm:mt-4 sm:text-[2.35rem] sm:leading-[1.18]">
                <span className="block">{t.lead}</span>
                <span className="block bg-[linear-gradient(135deg,#FF2F6D_0%,#FF6A3D_100%)] bg-clip-text text-transparent">
                  {t.highlight}
                </span>
              </h1>
              <p className="mx-auto mt-3 max-w-md text-sm font-medium leading-6 text-[#666666] dark:text-[#A1A1AA]">
                {t.hint}
              </p>
            </div>

            <div className="order-2">
              <MobileStepChips steps={t.steps} />
            </div>

            <div className="order-3">
              <div className="relative mx-auto mt-4 flex w-full justify-center sm:mt-6">
                <div
                  ref={cameraStageRef}
                  className="relative aspect-square w-[min(64vw,258px)] max-w-[258px] overflow-hidden rounded-full border-2 border-[#F6AFC7] bg-[#FFF8FA] shadow-[0_0_0_10px_rgba(255,79,138,0.055),0_14px_34px_rgba(255,79,138,0.115)] dark:border-[#FF4F8A] dark:bg-[#0B0A0E] dark:shadow-[0_0_0_10px_rgba(255,79,138,0.08),0_0_42px_rgba(255,79,138,0.24)] sm:w-[min(56vw,368px)] sm:max-w-[368px] lg:w-[min(48vw,430px)] lg:max-w-[430px]"
                >
                  {stageContent()}
                  {!hasPreview && !isCameraOpen ? (
                    <div className="pointer-events-none absolute inset-x-4 top-[18%] z-20 flex justify-center">
                      <p
                        className={`px-3 py-1 text-[11px] font-semibold leading-5 text-[#666666] transition-opacity duration-[1800ms] ease-in-out motion-reduce:transition-none dark:text-white/85 ${
                          showIntroFace ? "opacity-0" : "opacity-100"
                        }`}
                      >
                        {t.guide}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mx-auto mt-5 grid w-full max-w-[360px] grid-cols-1 gap-2.5 sm:mt-6 sm:max-w-[390px] sm:gap-3">
                <button
                  type="button"
                  onClick={primaryAction}
                  disabled={isRequestingRef.current || fullscreenPhase !== "closed"}
                  className="ui-button-primary min-h-[54px] rounded-[0.9rem] px-5 text-base font-bold sm:min-h-[58px]"
                >
                  {hasPreview && !isCameraOpen ? null : <CameraIcon />}
                  <span className={hasPreview && !isCameraOpen ? "" : "ml-2"}>{primaryLabel}</span>
                </button>
                {hasPreview && !isCameraOpen ? (
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={openCamera}
                      disabled={fullscreenPhase !== "closed"}
                      className="ui-button-secondary-soft min-h-[48px] rounded-[0.9rem] px-3 text-sm font-semibold sm:min-h-[52px]"
                    >
                      <CameraIcon />
                      <span className="ml-2">{t.retake}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      className="ui-button-secondary-soft min-h-[48px] rounded-[0.9rem] px-3 text-sm font-semibold sm:min-h-[52px]"
                    >
                      <ImageIcon />
                      <span className="ml-2">{t.change}</span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={secondaryAction}
                    className="ui-button-secondary-soft min-h-[48px] rounded-[0.9rem] px-5 text-sm font-semibold sm:min-h-[52px]"
                  >
                    <ImageIcon />
                    <span className="ml-2">{secondaryLabel}</span>
                  </button>
                )}
                <p className="inline-flex items-center justify-center gap-1.5 text-center text-[11px] font-medium text-[#666666] dark:text-[#A1A1AA]">
                  <LockIcon />
                  {t.privacy}
                </p>
              </div>
            </div>

            <div className="order-4">
              <ShootingTips tips={t.tips} />
            </div>
          </div>
        </div>

        <input
          ref={galleryInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={onImageChange}
        />
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {cameraError ? <p className="ui-text-danger mt-4 text-sm font-medium">{cameraError}</p> : null}
      {error ? <p className="ui-text-danger mt-4 text-sm font-medium">{error}</p> : null}

      {isFullscreenSession && typeof document !== "undefined" ? (
        <MobileFullscreenCamera
          phase={fullscreenPhase}
          transitionRect={transitionRect}
          viewportSize={viewportSize}
          reducedMotion={reducedMotion}
          isVideoReady={isVideoReady}
          videoRef={videoRef}
          onVideoReady={handleFullscreenVideoReady}
          closeButtonRef={closeButtonRef}
          isCapturing={isCapturing}
          copy={t}
          onClose={closeFullscreenCamera}
          onCapture={capturePhoto}
          onAnimationComplete={handleFullscreenAnimationComplete}
        />
      ) : null}
    </section>
  );
}
