import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import exampleFace from "@/img/Facial_1.png";

const STEP_COPY = {
  ko: {
    title: "K-Beauty Finder",
    kicker: "Skin Match",
    headline: "사진 한 장, 몇 가지 질문으로 내 피부에 맞는 추천을 받아보세요",
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

function FaceSilhouette() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[calc(11%+20px)] bottom-[168px] z-0 flex items-start justify-center">
      <div className="relative h-full w-[56%] max-w-[272px]">
        <div className="absolute -left-[30px] -right-[30px] top-[4%] bottom-[calc(18%-35px)] rounded-[2rem] border-2 border-[#444444] dark:border-[#7A7A7A]" />
        <div className="h-full w-full text-[#444444] dark:text-[#7A7A7A]">
          <svg viewBox="0 0 800 800" aria-hidden="true" className="h-full w-full object-contain object-center fill-current">
            <g opacity="1">
              <path d="M400 108C295.066 108 210 193.066 210 298V360C210 441.873 261.77 511.653 334.38 538.42C347.9 543.404 357 556.363 357 570.772V583.9C357 605.994 343.705 625.914 323.304 634.321L177.788 694.278C119.99 718.091 82 774.373 82 836V860H718V836C718 774.373 680.01 718.091 622.212 694.278L476.696 634.321C456.295 625.914 443 605.994 443 583.9V570.772C443 556.363 452.1 543.404 465.62 538.42C538.23 511.653 590 441.873 590 360V298C590 193.066 504.934 108 400 108Z" />
              <path d="M239 344C218.565 344 202 360.565 202 381V427C202 447.435 218.565 464 239 464C259.435 464 276 447.435 276 427V381C276 360.565 259.435 344 239 344Z" />
              <path d="M561 344C540.565 344 524 360.565 524 381V427C524 447.435 540.565 464 561 464C581.435 464 598 447.435 598 427V381C598 360.565 581.435 344 561 344Z" />
            </g>
          </svg>
        </div>
      </div>
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

  const isContrastSurface = hasPreview || showIntroVisual;

  return (
    <section className="flex flex-1 flex-col justify-center py-4">
      <div className="ui-surface-tint relative overflow-hidden rounded-[2.4rem] shadow-[0_28px_80px_rgba(46,30,10,0.12)]">
        <div className={`relative ${hasPreview ? "min-h-[min(74dvh,640px)] max-h-[min(74dvh,640px)]" : "min-h-[560px]"}`}>
          {hasPreview ? (
            <>
              <div className="absolute inset-0 bg-[linear-gradient(180deg,#f4ede3_0%,#f7f1e7_100%)] dark:bg-[linear-gradient(180deg,#18181b_0%,#111114_100%)]" />
              <div className="relative z-10 flex min-h-[min(74dvh,640px)] max-h-[min(74dvh,640px)] flex-col p-3 sm:p-4">
                <div className="flex w-full justify-center">
                  <div className="w-full max-w-[18rem]">
                    <div className="flex aspect-[4/5] max-h-[min(42dvh,360px)] items-center justify-center overflow-hidden rounded-[1.85rem] bg-black/[0.05] dark:bg-white/[0.04]">
                    <img
                      src={previewUrl}
                      alt={t.previewAlt}
                      className="block h-full w-full object-contain object-center"
                    />
                    </div>
                  </div>
                </div>

                <div className="px-2 pb-2 pt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] ui-text-subtle-strong">
                    {t.title}
                  </p>
                  <span className="mt-3 ui-chip-soft">
                    {t.kicker}
                  </span>
                </div>

                <div className="px-2">
                  <h1 className="ui-title text-[1.02rem] font-semibold leading-[1.42] tracking-[-0.02em] sm:text-[1.1rem]">
                    {t.headline}
                  </h1>
                  <p className="ui-text-subtle mt-2 text-[11px] font-medium">
                    {t.hint}
                  </p>
                </div>

                <div className="mt-auto px-2 pt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="ui-button-primary min-h-[54px] px-4 text-sm font-semibold"
                    >
                      {t.retake}
                    </button>
                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      className="ui-button-secondary-soft min-h-[54px] px-4 text-sm font-semibold"
                    >
                      {t.change}
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="absolute inset-0 bg-[linear-gradient(180deg,#f4ede3_0%,#f7f1e7_100%)] dark:bg-[linear-gradient(180deg,#18181b_0%,#111114_100%)]" />
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
                <div className="absolute inset-0 bg-[linear-gradient(180deg,#f4ede3_0%,#f7f1e7_100%)] dark:bg-[linear-gradient(180deg,#18181b_0%,#111114_100%)]" />
                <FaceSilhouette />
              </div>

              <div className="relative z-10 flex min-h-[560px] flex-col p-5 sm:p-6">
                <div>
                  <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${isContrastSurface ? "ui-text-contrast-soft" : "ui-text-subtle-strong"}`}>
                    {t.title}
                  </p>
                  <span className={`mt-3 ${isContrastSurface ? "ui-chip-contrast" : "ui-chip-soft"}`}>
                    {t.kicker}
                  </span>
                </div>

                <div
                  className={`absolute inset-x-6 max-w-[21rem] sm:inset-x-7 ${
                    isContrastSurface ? "ui-text-contrast" : "ui-title"
                  } bottom-[102px] sm:bottom-[108px]`}
                >
                  <h1 className="text-[1.02rem] font-semibold leading-[1.42] tracking-[-0.02em] sm:text-[1.1rem]">
                    {t.headline}
                  </h1>
                  <p className={`mt-2 text-[11px] font-medium ${isContrastSurface ? "ui-text-contrast-soft" : "ui-text-subtle"}`}>
                    {t.hint}
                  </p>
                </div>

                <div className="mt-auto">
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="ui-button-primary min-h-[54px] px-4 text-sm font-semibold"
                    >
                      {t.camera}
                    </button>
                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      className={`min-h-[54px] px-4 text-sm font-semibold ${
                        isContrastSurface ? "ui-button-secondary-contrast" : "ui-button-secondary-soft"
                      }`}
                    >
                      {t.gallery}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
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

      {error ? <p className="ui-text-danger mt-4 text-sm font-medium">{error}</p> : null}
    </section>
  );
}
