import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import exampleFace from "@/img/Facial_1.png";

const STEP_COPY = {
  ko: {
    title: "K-BEAUTY FINDER",
    kicker: "Skin Match",
    lead: "사진 한 장, 몇 가지 질문으로",
    highlight: "내 피부에 맞는 추천을 받아보세요",
    hint: "정면에 가까운 밝은 사진을 권장합니다.",
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
    lead: "One photo and a few questions",
    highlight: "to organize recommendations for your skin",
    hint: "A bright, front-facing photo works best.",
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
          <path d="M239 344C218.565 344 202 360.565 202 381V427C202 447.435 218.565 464 239 464C259.435 464 276 447.435 276 427V381C276 360.565 259.435 344 239 344Z" />
          <path d="M561 344C540.565 344 524 360.565 524 381V427C524 447.435 540.565 464 561 464C581.435 464 598 447.435 598 427V381C598 360.565 581.435 344 561 344Z" />
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
      <p className="rounded-full bg-[#2b1f26]/42 px-3 py-1 text-[11px] font-medium leading-5 text-white/85 shadow-sm backdrop-blur-md dark:bg-black/24 dark:text-white/82">
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
    <div className="mt-5 lg:hidden">
      <div className="relative mx-auto max-w-sm px-2">
        <div className="absolute left-8 right-8 top-[13px] h-px bg-[#d8aaa8]/60 dark:bg-[#5a3a48]/70" />
        <div className="relative grid grid-cols-3">
      {steps.map((step, index) => (
        <div
          key={step.title}
          className="flex flex-col items-center text-center"
        >
          <span
            className={`relative z-10 flex h-[27px] w-[27px] items-center justify-center rounded-full border text-[10px] font-semibold ${
              index === 0
                ? "border-transparent bg-[linear-gradient(135deg,#ef6387,#ff8068)] text-white shadow-[0_8px_16px_rgba(239,99,135,0.18)]"
                : "border-[#d8aaa8]/70 bg-[#fff8f3]/70 text-[#8a6970] dark:border-[#5a3a48] dark:bg-[#241720] dark:text-[#c8aeb8]"
            }`}
          >
            {index + 1}
          </span>
          <span
            className={`mt-1.5 text-[10px] font-semibold leading-4 ${
              index === 0
                ? "text-[#6b2f3f] dark:text-[#ffe6e3]"
                : "text-[#8a6970] dark:text-[#c8aeb8]"
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
    <div className="mx-auto mt-5 grid w-full max-w-3xl gap-2 rounded-[1.35rem] border border-[#ead8cf] bg-white/35 px-4 py-3.5 dark:border-[#4a303c] dark:bg-[#21151d]/80 sm:mt-6 sm:grid-cols-3 sm:p-3">
      {tips.map((tip) => (
        <div key={tip.title} className="rounded-2xl px-2 py-2 sm:px-3 sm:py-2.5">
          <p className="text-xs font-semibold text-[#5a2d3c] dark:text-[#fff8f3]">{tip.title}</p>
          <p className="ui-text-subtle mt-1 text-xs leading-5 sm:text-[11px]">{tip.body}</p>
        </div>
      ))}
    </div>
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

    if (showIntroVisual) {
      return (
        <Image
          src={exampleFace}
          alt={t.exampleAlt}
          fill
          priority
          sizes="(max-width: 768px) 78vw, 560px"
          className="object-cover"
        />
      );
    }

    return <FaceSilhouette />;
  };

  const primaryLabel = isCameraOpen ? t.capture : hasPreview ? t.retake : t.camera;
  const secondaryLabel = isCameraOpen ? t.cancel : hasPreview ? t.change : t.gallery;
  const primaryAction = isCameraOpen ? capturePhoto : openCamera;
  const secondaryAction = isCameraOpen ? stopCamera : () => galleryInputRef.current?.click();

  return (
    <section className="relative flex flex-1 flex-col py-3 lg:py-8">
      <div className="relative overflow-hidden rounded-[2.25rem] border border-[#ead8cf] bg-[radial-gradient(circle_at_50%_24%,rgba(255,226,219,0.9),rgba(255,248,243,0.92)_34%,rgba(246,236,232,0.98)_100%)] shadow-[0_20px_68px_rgba(83,43,51,0.1)] dark:border-[#4a303c] dark:bg-[radial-gradient(circle_at_50%_28%,rgba(48,32,43,0.95),rgba(36,23,32,0.98)_42%,rgba(22,13,19,0.99)_100%)] dark:shadow-[0_24px_72px_rgba(0,0,0,0.28)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(239,99,135,0.09),transparent_48%)] dark:bg-[radial-gradient(circle_at_50%_40%,rgba(239,99,135,0.1),transparent_48%)]" />
        <div className="relative z-10 grid gap-5 px-4 py-5 sm:px-6 sm:py-6 lg:grid-cols-[185px_minmax(0,1fr)] lg:gap-8 lg:px-8 lg:py-8">
          <StepRail steps={t.steps} />

          <div className="min-w-0">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8a5f68] dark:text-[#c8aeb8]">
                {t.title}
              </p>
              <span className="mt-3 inline-flex rounded-full border border-[#ead8cf] bg-white/55 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#5a2d3c] backdrop-blur dark:border-[#5a3a48] dark:bg-[#301f28]/80 dark:text-[#f4d7df]">
                {t.kicker}
              </span>
              <h1 className="mt-6 text-[1.45rem] font-semibold leading-[1.28] tracking-[-0.04em] text-[#2b1f26] dark:text-[#fff8f3] sm:mt-5 sm:text-[2.1rem]">
                <span className="block">{t.lead}</span>
                <span className="block bg-[linear-gradient(90deg,#ef6387,#ff8068)] bg-clip-text text-transparent">
                  {t.highlight}
                </span>
              </h1>
              <p className="mt-4 text-sm font-medium text-[#8a6970] dark:text-[#c8aeb8] sm:mt-3">{t.hint}</p>
            </div>

            <MobileStepChips steps={t.steps} />

            <div className="relative mx-auto mt-5 flex w-full justify-center sm:mt-6">
              <div className="relative aspect-square w-[min(68vw,560px)] max-w-[560px] overflow-hidden rounded-full border border-[rgba(205,174,167,0.4)] bg-[#fffaf7]/58 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2),0_14px_38px_rgba(87,46,54,0.1)] dark:border-[rgba(106,64,80,0.46)] dark:bg-[#21151d]/72 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03),0_16px_44px_rgba(0,0,0,0.23)] sm:w-[min(78vw,560px)]">
                <div className="absolute inset-0 z-10 rounded-full bg-[radial-gradient(circle_at_50%_42%,transparent_0%,transparent_60%,rgba(43,31,38,0.1)_100%)] dark:bg-[radial-gradient(circle_at_50%_42%,transparent_0%,transparent_60%,rgba(8,5,7,0.18)_100%)]" />
                {stageContent()}
                <PhotoGuideHint label={t.guide} visible={!hasPreview} />
              </div>
            </div>

            <div className="mx-auto mt-5 grid w-full max-w-[370px] grid-cols-[1fr_0.82fr] gap-3">
              <button
                type="button"
                onClick={primaryAction}
                className="ui-button-primary min-h-[58px] rounded-full px-5 text-sm font-semibold"
              >
                {primaryLabel}
              </button>
              <button
                type="button"
                onClick={secondaryAction}
                className="ui-button-secondary-soft min-h-[58px] rounded-full px-5 text-sm font-semibold"
              >
                {secondaryLabel}
              </button>
            </div>

            <ShootingTips tips={t.tips} />
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
