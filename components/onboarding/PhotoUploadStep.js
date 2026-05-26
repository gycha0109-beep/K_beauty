import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import exampleFace from "@/img/Facial_1.png";

const STEP_COPY = {
  ko: {
    title: "K-BEAUTY FINDER",
    kicker: "Skin Match",
    lead: "사진 한 장으로",
    highlight: "내 피부에 맞는 추천을 받아보세요",
    hint: "촬영하거나 사진을 선택하면 바로 시작할 수 있어요.",
    guide: "얼굴이 중앙에 오도록 맞춰주세요",
    camera: "지금 촬영하기",
    gallery: "사진에서 선택",
    retake: "다시 촬영",
    change: "사진 변경",
    capture: "촬영",
    cancel: "취소",
    cameraError: "카메라 접근에 실패했습니다.",
    previewAlt: "업로드한 얼굴 사진 미리보기",
    exampleAlt: "예시 얼굴 이미지",
    steps: [
      { title: "사진 촬영", body: "얼굴을 중앙 가이드에 맞춰주세요." },
      { title: "질문 답변", body: "피부 고민과 선호도를 알려주세요." },
      { title: "분석 완료", body: "맞춤 추천을 확인하세요." }
    ],
    tips: [
      { title: "밝은 곳에서", body: "자연광 또는 밝은 실내가 좋습니다." },
      { title: "정면으로", body: "얼굴을 정면에 가깝게 맞춥니다." },
      { title: "가까이서", body: "얼굴이 크게 나오도록 촬영합니다." }
    ]
  },
  en: {
    title: "K-BEAUTY FINDER",
    kicker: "Skin Match",
    lead: "With one photo",
    highlight: "get recommendations matched to your skin",
    hint: "Take or choose a photo to get started.",
    guide: "Keep your face near the center",
    camera: "Use Camera",
    gallery: "Choose Photo",
    retake: "Retake",
    change: "Change Photo",
    capture: "Capture",
    cancel: "Cancel",
    cameraError: "Camera access failed.",
    previewAlt: "Preview of the uploaded face photo",
    exampleAlt: "Example face image",
    steps: [
      { title: "Take photo", body: "Place your face around the guide." },
      { title: "Answer questions", body: "Tell us your skin concerns." },
      { title: "Get result", body: "Review your matched routine." }
    ],
    tips: [
      { title: "Bright light", body: "Natural or bright indoor light works best." },
      { title: "Face forward", body: "Keep your face close to front-facing." },
      { title: "Move closer", body: "Let your face fill the frame." }
    ]
  }
};

function FaceSilhouette() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
      <div className="w-[39%] max-w-[215px] text-[rgba(120,78,72,0.28)] blur-[0.5px] dark:text-[rgba(214,170,170,0.28)]">
        <svg viewBox="0 0 800 800" aria-hidden="true" className="h-full w-full scale-[0.94] fill-current">
          <path d="M400 108C295.066 108 210 193.066 210 298V360C210 441.873 261.77 511.653 334.38 538.42C347.9 543.404 357 556.363 357 570.772V583.9C357 605.994 343.705 625.914 323.304 634.321L177.788 694.278C119.99 718.091 82 774.373 82 836V860H718V836C718 774.373 680.01 718.091 622.212 694.278L476.696 634.321C456.295 625.914 443 605.994 443 583.9V570.772C443 556.363 452.1 543.404 465.62 538.42C538.23 511.653 590 441.873 590 360V298C590 193.066 504.934 108 400 108Z" />
        </svg>
      </div>
    </div>
  );
}

function PhotoGuideHint({ label, visible = true }) {
  if (!visible) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-x-4 top-[18%] z-20 flex justify-center">
      <p className="px-2 py-0.5 text-[11px] font-semibold leading-5 text-[#6b5060] drop-shadow-[0_1px_1px_rgba(255,255,255,0.9)] dark:text-white/86 dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]">
        {label}
      </p>
    </div>
  );
}

function StepRail({ steps }) {
  return (
    <aside className="hidden lg:flex lg:flex-col lg:justify-center">
      <div className="space-y-1.5">
        {steps.map((step, index) => (
          <div key={step.title} className="relative flex gap-2.5 pb-4 last:pb-0">
            {index < steps.length - 1 ? (
              <span className="absolute left-[15px] top-8 h-[calc(100%-24px)] w-px bg-[#7a4858]/28 dark:bg-[#6a4050]/38" />
            ) : null}
            <span
              className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                index === 0
                  ? "border-transparent bg-[linear-gradient(135deg,#ef6387,#ff8068)] text-white shadow-[0_8px_18px_rgba(239,99,135,0.18)]"
                  : "border-[#d7b7ae] bg-white/40 text-[#7a6268] dark:border-[#5a3a48] dark:bg-[#301f28] dark:text-[#c8aeb8]"
              }`}
            >
              {index + 1}
            </span>
            <div className="pt-1">
              <p className={`text-[13px] font-semibold ${index === 0 ? "text-[#ef6b84] dark:text-[#ff91a0]" : "ui-text"}`}>
                {step.title}
              </p>
              <p className="ui-text-subtle mt-0.5 text-[11px] leading-5">{step.body}</p>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

function MobileStepChips({ steps }) {
  return (
    <div className="mt-2 lg:hidden">
      <div className="relative mx-auto max-w-[300px] px-1">
        <div className="pointer-events-none absolute left-8 right-8 top-[10px] z-0 h-px bg-[#d8aaa8]/55 dark:bg-[#5a3a48]/65" />
        <div className="relative grid grid-cols-3">
      {steps.map((step, index) => (
        <div
          key={step.title}
          className="relative z-10 flex flex-col items-center text-center"
        >
          <span
            className={`relative z-10 flex h-[21px] w-[21px] items-center justify-center rounded-full border text-[9px] font-semibold ${
              index === 0
                ? "border-transparent bg-[linear-gradient(135deg,#ef6387,#ff8068)] text-white shadow-[0_7px_14px_rgba(239,99,135,0.16)]"
                : "border-[#d8aaa8]/70 bg-[#fff8f3]/70 text-[#8a6970] dark:border-[#5a3a48] dark:bg-[#241720] dark:text-[#c8aeb8]"
            }`}
          >
            {index + 1}
          </span>
          <span
            className={`mt-0.5 rounded-full px-1 text-[9px] font-semibold leading-4 ${
              index === 0
                ? "bg-[#fff4f1] text-[#6b2f3f] dark:bg-[#241720] dark:text-[#ffe6e3]"
                : "bg-[#fff4f1] text-[#8a6970] dark:bg-[#241720] dark:text-[#c8aeb8]"
            }`}
          >
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
    <div className="mx-auto mt-1.5 grid w-full max-w-3xl grid-cols-3 gap-2 sm:mt-5">
      {tips.map((tip, index) => (
        <div
          key={tip.title}
          className="flex min-w-0 flex-col items-center justify-center rounded-[0.95rem] border border-[#ead8cf] bg-white/42 px-2 py-2.5 text-center shadow-[0_8px_20px_rgba(83,43,51,0.06)] dark:border-[#4a303c] dark:bg-[#21151d]/58 sm:rounded-[1.1rem] sm:px-3 sm:py-3"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#d7b7ae] bg-white/38 text-[#a67b84] dark:border-[#5a3a48] dark:bg-white/5 dark:text-[#c8aeb8]">
            <ShootingTipIcon index={index} />
          </span>
          <p className="mt-1.5 truncate text-[11px] font-bold text-[#5a2d3c] dark:text-[#fff8f3] sm:text-xs">{tip.title}</p>
        </div>
      ))}
    </div>
  );
}

function ShootingTipIcon({ index }) {
  if (index === 0) {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none">
        <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 3.5v2.2M12 18.3v2.2M4.5 12h2.2M17.3 12h2.2M6.7 6.7l1.55 1.55M15.75 15.75l1.55 1.55M17.3 6.7l-1.55 1.55M8.25 15.75 6.7 17.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  if (index === 1) {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none">
        <path d="M8 14.5c1.15-1.05 2.48-1.58 4-1.58s2.85.53 4 1.58" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M8.2 9.2c.75-1.2 2.05-1.95 3.8-1.95s3.05.75 3.8 1.95" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M9.2 17.2h5.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <circle cx="10.5" cy="10.5" r="4.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="m14 14 4.2 4.2M10.5 8.2v4.6M8.2 10.5h4.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function PhotoUploadStep({
  locale = "ko",
  previewUrl,
  onImageChange,
  error
}) {
  const t = STEP_COPY[locale] || STEP_COPY.ko;
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const hasPreview = Boolean(previewUrl);
  const [showIntroVisual, setShowIntroVisual] = useState(true);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [stream, setStream] = useState(null);
  const [cameraError, setCameraError] = useState(null);

  useEffect(() => {
    if (hasPreview) {
      setShowIntroVisual(false);
      return;
    }

    setShowIntroVisual(true);
    const timer = setTimeout(() => {
      setShowIntroVisual(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, [hasPreview]);

  useEffect(() => {
    if (!isCameraOpen || !stream || !videoRef.current) {
      return;
    }

    videoRef.current.srcObject = stream;
  }, [isCameraOpen, stream]);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  const handleFileChange = (file) => {
    if (!file) {
      return;
    }

    setCameraError(null);
    onImageChange?.({ target: { files: [file] } });
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    setStream(null);
    setIsCameraOpen(false);
  };

  const openCamera = async () => {
    let nextStream = null;

    try {
      setCameraError(null);

      try {
        nextStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false
        });
      } catch (preferredCameraError) {
        nextStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }

      setStream(nextStream);
      setIsCameraOpen(true);
    } catch (cameraOpenError) {
      console.error("camera open failed", cameraOpenError);
      setCameraError(t.cameraError);
      cameraInputRef.current?.click();
    }
  };

  const capturePhoto = () => {
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

    context.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          return;
        }

        const file = new File([blob], "selfie.jpg", { type: "image/jpeg" });
        handleFileChange(file);
        stopCamera();
      },
      "image/jpeg",
      0.9
    );
  };

  const stageContent = () => {
    if (isCameraOpen) {
      return (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
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
        <div
          className={`absolute inset-0 rounded-full transition-[opacity,filter,transform] duration-1000 ease-out ${
            showIntroVisual
              ? "opacity-100 blur-0 scale-100"
              : "pointer-events-none opacity-0 blur-[2px] scale-[1.015]"
          }`}
        >
          <Image
            src={exampleFace}
            alt={t.exampleAlt}
            fill
            priority
            sizes="(max-width: 768px) 78vw, 560px"
            className="rounded-full object-cover"
          />
        </div>
      </>
    );
  };

  const primaryLabel = isCameraOpen ? t.capture : hasPreview ? t.retake : t.camera;
  const secondaryLabel = isCameraOpen ? t.cancel : hasPreview ? t.change : t.gallery;
  const primaryAction = isCameraOpen ? capturePhoto : openCamera;
  const secondaryAction = isCameraOpen ? stopCamera : () => galleryInputRef.current?.click();

  return (
    <section className="relative flex flex-1 flex-col py-2 lg:py-8">
      <div className="relative overflow-hidden rounded-[1.65rem] border border-[#ead8cf] bg-[radial-gradient(circle_at_50%_18%,rgba(255,226,219,0.78),rgba(255,248,243,0.92)_32%,rgba(246,236,232,0.98)_100%)] shadow-[0_16px_46px_rgba(83,43,51,0.09)] dark:border-[#4a303c] dark:bg-[radial-gradient(circle_at_50%_20%,rgba(48,32,43,0.9),rgba(36,23,32,0.98)_42%,rgba(22,13,19,0.99)_100%)] dark:shadow-[0_20px_58px_rgba(0,0,0,0.24)] sm:rounded-[2.25rem]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(239,99,135,0.09),transparent_48%)] dark:bg-[radial-gradient(circle_at_50%_40%,rgba(239,99,135,0.1),transparent_48%)]" />
        <div className="relative z-10 grid gap-3 px-3.5 py-3.5 sm:gap-5 sm:px-6 sm:py-6 lg:grid-cols-[185px_minmax(0,1fr)] lg:gap-8 lg:px-8 lg:py-8">
          <StepRail steps={t.steps} />

          <div className="flex min-w-0 flex-col">
            <div className="order-1 mx-auto max-w-2xl text-center">
              <span className="inline-flex rounded-full border border-[#ead8cf] bg-white/55 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#5a2d3c] backdrop-blur dark:border-[#5a3a48] dark:bg-[#301f28]/80 dark:text-[#f4d7df] sm:px-4 sm:py-1.5 sm:text-xs sm:tracking-[0.18em]">
                {t.kicker}
              </span>
              <h1 className="mt-2 text-[1.18rem] font-semibold leading-[1.14] tracking-[-0.02em] text-[#2b1f26] dark:text-[#fff8f3] sm:mt-5 sm:text-[2.1rem] sm:leading-[1.28] sm:tracking-[-0.04em]">
                <span className="block">{t.lead}</span>
                <span className="block bg-[linear-gradient(90deg,#ef6387,#ff8068)] bg-clip-text text-transparent">
                  {t.highlight}
                </span>
              </h1>
            </div>

            <div className="order-2">
              <MobileStepChips steps={t.steps} />
            </div>

            <div className="order-3">
              <div className="relative mx-auto mt-3 flex w-full justify-center sm:mt-5">
                <div className="relative aspect-square w-[min(60vw,246px)] max-w-[246px] overflow-hidden rounded-full border border-[rgba(205,174,167,0.4)] bg-[#fffaf7]/58 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2),0_12px_30px_rgba(87,46,54,0.1)] dark:border-[rgba(106,64,80,0.46)] dark:bg-[#21151d]/72 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03),0_14px_34px_rgba(0,0,0,0.22)] sm:w-[min(62vw,420px)] sm:max-w-[420px] lg:w-[min(68vw,560px)] lg:max-w-[560px]">
                  <div className="absolute inset-0 z-10 rounded-full bg-[radial-gradient(circle_at_50%_42%,transparent_0%,transparent_60%,rgba(43,31,38,0.1)_100%)] dark:bg-[radial-gradient(circle_at_50%_42%,transparent_0%,transparent_60%,rgba(8,5,7,0.18)_100%)]" />
                  {stageContent()}
                  <PhotoGuideHint label={t.guide} visible={!hasPreview} />
                </div>
              </div>

              <div className="mx-auto mt-3 grid w-full max-w-[340px] grid-cols-[1fr_0.82fr] gap-2.5 sm:mt-5 sm:max-w-[370px] sm:gap-3">
                <button
                  type="button"
                  onClick={primaryAction}
                  className="ui-button-primary min-h-11 rounded-full px-4 text-sm font-semibold sm:min-h-[58px] sm:px-5"
                >
                  {primaryLabel}
                </button>
                <button
                  type="button"
                  onClick={secondaryAction}
                  className="ui-button-secondary-soft min-h-11 rounded-full px-4 text-sm font-semibold sm:min-h-[58px] sm:px-5"
                >
                  {secondaryLabel}
                </button>
              </div>
            </div>

            <div className="order-4">
              <ShootingTips tips={t.tips} />
            </div>
          </div>
        </div>

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          onChange={onImageChange}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onImageChange}
        />
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {cameraError ? <p className="ui-text-danger mt-4 text-sm font-medium">{cameraError}</p> : null}
      {error ? <p className="ui-text-danger mt-4 text-sm font-medium">{error}</p> : null}
    </section>
  );
}
