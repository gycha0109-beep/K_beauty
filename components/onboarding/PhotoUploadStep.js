import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import exampleFace from "@/img/Facial_1.png";

const STEP_COPY = {
  ko: {
    title: "K-Beauty Finder",
    kicker: "Skin Match",
    headline: "사진 한 장, 몇 가지 질문으로\n피부에 맞는 추천을 받아보세요",
    hint: "정면에 가까운 밝은 사진 권장",
    camera: "지금 촬영하기",
    gallery: "사진에서 선택",
    retake: "다시 촬영",
    change: "사진 변경",
    previewAlt: "업로드한 얼굴 사진 미리보기",
    exampleAlt: "예시 얼굴 이미지"
  },
  en: {
    title: "K-Beauty Finder",
    kicker: "Skin Match",
    headline: "One photo and a few questions help organize recommendations for your skin.",
    hint: "A bright, front-facing photo works best",
    camera: "Use Camera",
    gallery: "Choose Photo",
    retake: "Retake",
    change: "Change Photo",
    previewAlt: "Preview of the uploaded face photo",
    exampleAlt: "Example face image"
  }
};

export default function PhotoUploadStep({
  locale = "ko",
  previewUrl,
  onImageChange,
  error
}) {
  const t = STEP_COPY[locale] || STEP_COPY.ko;
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const hasPreview = Boolean(previewUrl);
  const [showIntroVisual, setShowIntroVisual] = useState(true);

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

  const darkMode = hasPreview || showIntroVisual;

  return (
    <section className="flex flex-1 flex-col justify-center py-4">
      <div className="relative overflow-hidden rounded-[2.4rem] border border-black/6 bg-[#f7efe4] shadow-[0_28px_80px_rgba(46,30,10,0.12)]">
        <div className={`relative ${hasPreview ? "min-h-[260px]" : "min-h-[560px]"}`}>
          {hasPreview ? (
            <img src={previewUrl} alt={t.previewAlt} className="h-full min-h-[260px] w-full object-cover" />
          ) : (
            <>
              <div className="absolute inset-0 bg-[linear-gradient(180deg,#f4ede3_0%,#f7f1e7_100%)]" />
              <div
                className={`absolute inset-0 transition-opacity duration-700 ${
                  showIntroVisual ? "opacity-100" : "pointer-events-none opacity-0"
                }`}
              >
                <Image
                  src={exampleFace}
                  alt={t.exampleAlt}
                  fill
                  priority
                  sizes="(max-width: 768px) 100vw, 420px"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,12,8,0.12)_0%,rgba(15,12,8,0.08)_36%,rgba(15,12,8,0.62)_100%)]" />
              </div>
              <div
                className={`absolute inset-0 transition-opacity duration-700 ${
                  showIntroVisual ? "opacity-0" : "opacity-100"
                }`}
              >
                <div className="absolute inset-0 bg-[linear-gradient(180deg,#f4ede3_0%,#f7f1e7_100%)]" />
                <div className="flex min-h-[560px] flex-col items-center justify-center px-7 text-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full border border-black/8 bg-white text-[2rem] text-black/45 shadow-[0_14px_28px_rgba(26,20,12,0.08)]">
                    +
                  </div>
                </div>
              </div>
            </>
          )}

          <div className={`relative flex flex-col p-5 sm:p-6 ${hasPreview ? "min-h-[260px]" : "min-h-[560px]"}`}>
            <div>
              <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${darkMode ? "text-white/72" : "text-black/34"}`}>
                {t.title}
              </p>
              <span
                className={`mt-3 inline-flex rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] backdrop-blur ${
                  darkMode
                    ? "border border-white/20 bg-white/14 text-white"
                    : "border border-black/8 bg-white/78 text-black/60"
                }`}
              >
                {t.kicker}
              </span>
            </div>

            <div
              className={`absolute inset-x-6 max-w-[21rem] ${darkMode ? "text-white" : "text-[#1f1811]"} sm:inset-x-7 ${
                hasPreview ? "top-[92px] sm:top-[96px]" : "bottom-[102px] sm:bottom-[108px]"
              }`}
            >
              <h1 className="text-[1.18rem] font-semibold leading-[1.22] tracking-[-0.03em] sm:text-[1.28rem]">
                {t.headline}
              </h1>
              <p className={`mt-2 text-[11px] font-medium ${darkMode ? "text-white/78" : "text-black/48"}`}>{t.hint}</p>
            </div>

            <div className="mt-auto">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="inline-flex min-h-[54px] items-center justify-center rounded-full bg-[#1f1811] px-4 text-sm font-semibold text-white transition hover:bg-black"
                >
                  {hasPreview ? t.retake : t.camera}
                </button>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className={`inline-flex min-h-[54px] items-center justify-center rounded-full px-4 text-sm font-semibold backdrop-blur transition ${
                    darkMode
                      ? "border border-white/22 bg-white/14 text-white hover:bg-white/18"
                      : "border border-black/10 bg-white/84 text-black/72 hover:bg-white"
                  }`}
                >
                  {hasPreview ? t.change : t.gallery}
                </button>
              </div>
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
      </div>

      {error ? <p className="mt-4 text-sm font-medium text-red-600 dark:text-red-400">{error}</p> : null}
    </section>
  );
}
