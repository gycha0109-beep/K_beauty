"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Component, useEffect, useMemo, useRef, useState } from "react";
import ErrorMessage from "@/components/ErrorMessage";
import LoadingSpinner from "@/components/LoadingSpinner";

const TAB_ORDER = [
  "physiognomy",
  "face_shape_hairstyle",
  "lookalike_celebrities",
  "color_tone_recommendation"
];

const UI_COPY = {
  ko: {
    reportEyebrow: "FACE LAB REPORT",
    reportTitle: "Face Lab",
    reportSummaryLabel: "핵심 인상",
    reportTagsLabel: "공통 특징",
    readyTitle: "사진을 업로드하면 Face Lab 분석을 시작할 수 있습니다.",
    readyBody: "결과가 나오면 얼굴을 네 가지 관점으로 나눠 카드처럼 확인할 수 있습니다.",
    button: "Face Lab 보기",
    spinner: "Face Lab 결과를 생성하고 있습니다...",
    tabs: {
      physiognomy: "인상 해석",
      face_shape_hairstyle: "얼굴형 & 헤어",
      lookalike_celebrities: "닮은 분위기",
      color_tone_recommendation: "컬러 톤"
    },
    sections: {
      summary: "핵심 정리",
      evidence: "근거",
      apply: "활용 포인트",
      avoid: "피하면 좋은 방향",
      strengths: "강점",
      cautions: "주의 포인트",
      style: "추천 스타일",
      mood: "닮은 분위기",
      palette: "추천 팔레트",
      profile: "컬러 프로필",
      tags: "공통 특징"
    },
    nav: { prev: "이전", next: "다음", card: "CARD", tab: "TAB" },
    nextTabs: {
      physiognomy: "이 인상에 어울리는 헤어 보기",
      face_shape_hairstyle: "닮은 분위기 보기",
      lookalike_celebrities: "이 분위기의 컬러 톤 보기"
    },
    fallbackApply: "지금 보이는 얼굴 흐름을 그대로 살리는 방향이 가장 자연스럽습니다.",
    fallbackAvoid: "과하게 힘을 주는 해석보다 원래 결을 유지하는 편이 더 안정적입니다.",
    fallbackRender:
      "Face Lab 결과를 표시하는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요."
  },
  en: {
    reportEyebrow: "FACE LAB REPORT",
    reportTitle: "Face Lab",
    reportSummaryLabel: "Core impression",
    reportTagsLabel: "Shared features",
    readyTitle: "Upload a photo to start Face Lab.",
    readyBody: "Once the result is ready, you can move through four viewpoints as cards.",
    button: "View Face Lab",
    spinner: "Generating your Face Lab result...",
    tabs: {
      physiognomy: "Impression",
      face_shape_hairstyle: "Shape & Hair",
      lookalike_celebrities: "Similar Vibe",
      color_tone_recommendation: "Color Tone"
    },
    sections: {
      summary: "Core takeaway",
      evidence: "Why it reads this way",
      apply: "How to use it",
      avoid: "Avoid",
      strengths: "Strengths",
      cautions: "Cautions",
      style: "Recommended styles",
      mood: "Similar vibe",
      palette: "Palette",
      profile: "Color profile",
      tags: "Shared features"
    },
    nav: { prev: "Prev", next: "Next", card: "CARD", tab: "TAB" },
    nextTabs: {
      physiognomy: "See the hair direction for this impression",
      face_shape_hairstyle: "See similar vibe references",
      lookalike_celebrities: "See the color tone for this vibe"
    },
    fallbackApply: "Keeping the natural flow of the face will usually work best.",
    fallbackAvoid: "Avoid pushing the interpretation harder than the face already suggests.",
    fallbackRender: "There was a problem rendering the Face Lab result. Please try again."
  }
};

function getUi(locale = "ko") {
  return UI_COPY[locale] || UI_COPY.ko;
}

function cleanText(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function compactList(values, limit = 3) {
  return Array.isArray(values) ? values.map(cleanText).filter(Boolean).slice(0, limit) : [];
}

function uniqueItems(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(cleanText).filter(Boolean))];
}

function isValidFaceLabResult(result) {
  return Boolean(
    result?.features?.physiognomy &&
      result?.features?.face_shape_hairstyle &&
      result?.features?.lookalike_celebrities &&
      result?.features?.color_tone_recommendation
  );
}

function getSharedTags(result) {
  return uniqueItems([
    cleanText(result?.base_data?.face_shape),
    ...compactList(result?.base_data?.landmarks, 4),
    ...compactList(result?.base_data?.embedding, 2)
  ]).slice(0, 6);
}

function getHeaderSummary(result, locale = "ko") {
  const physiognomy = result?.features?.physiognomy;
  return (
    cleanText(physiognomy?.headline_result) ||
    cleanText(physiognomy?.overall_impression) ||
    (locale === "ko" ? "얼굴에서 가장 먼저 읽히는 인상 흐름을 짧게 정리했습니다." : "A clear impression flow shows up first.")
  );
}

function getColorChipStyle(label) {
  const lower = cleanText(label).toLowerCase();

  if (lower.includes("coral")) return { backgroundColor: "#e9a694", color: "#3e221f" };
  if (lower.includes("beige")) return { backgroundColor: "#d7c0a1", color: "#33271b" };
  if (lower.includes("olive") || lower.includes("khaki")) return { backgroundColor: "#a6a878", color: "#202215" };
  if (lower.includes("apricot") || lower.includes("peach")) return { backgroundColor: "#e4b08f", color: "#3d261f" };
  if (lower.includes("taupe") || lower.includes("stone")) return { backgroundColor: "#b4a69d", color: "#241d19" };
  if (lower.includes("rose")) return { backgroundColor: "#d7a4ab", color: "#381f24" };
  return { backgroundColor: "#ece4d8", color: "#2f241b" };
}

const COMPOSER_COPY = {
  ko: {
    eyebrow: "K-BEAUTY FINDER",
    chip: "FACE LAB",
    body: "사진을 업로드 하면 Face Lab 분석을 시작할 수 있습니다.",
    hint: "정면에 가까운 밝은 사진 권장",
    camera: "지금 촬영하기",
    gallery: "사진에서 선택",
    previewAlt: "업로드한 얼굴 사진 미리보기"
  },
  en: {
    eyebrow: "K-BEAUTY FINDER",
    chip: "FACE LAB",
    body: "Upload a photo to start your Face Lab analysis.",
    hint: "A bright, front-facing photo works best",
    camera: "Use Camera",
    gallery: "Choose Photo",
    previewAlt: "Preview of the uploaded face photo"
  }
};

function FaceLabGuideSilhouette() {
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

function FaceLabComposerCard({ locale = "ko", previewUrl, onImageChange }) {
  const t = COMPOSER_COPY[locale] || COMPOSER_COPY.ko;
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const hasPreview = Boolean(previewUrl);

  return (
    <section className="ui-surface-tint relative overflow-hidden rounded-[2.4rem] shadow-[0_28px_80px_rgba(46,30,10,0.12)]">
      <div className={`relative ${hasPreview ? "min-h-[min(74dvh,640px)] max-h-[min(74dvh,640px)]" : "h-[560px]"}`}>
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#f4ede3_0%,#f7f1e7_100%)] dark:bg-[linear-gradient(180deg,#18181b_0%,#111114_100%)]" />

        <div className={`relative z-10 flex flex-col p-5 sm:p-6 ${hasPreview ? "min-h-[min(74dvh,640px)] max-h-[min(74dvh,640px)]" : "h-[560px]"}`}>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] ui-text-subtle-strong">
              {t.eyebrow}
            </p>
            <span className="mt-3 ui-chip-soft">
              {t.chip}
            </span>
          </div>

          {hasPreview ? (
            <div className="flex w-full justify-center pt-4">
              <div className="mx-auto w-full max-w-[18rem]">
                <div className="flex aspect-[4/5] max-h-[min(42dvh,360px)] items-center justify-center overflow-hidden rounded-[1.85rem] bg-black/[0.05] dark:bg-white/[0.04]">
                  <img
                    src={previewUrl}
                    alt={t.previewAlt}
                    className="mx-auto block h-full w-full object-contain object-center"
                  />
                </div>
              </div>
            </div>
          ) : (
            <FaceLabGuideSilhouette />
          )}

          <div
            className={`${
              hasPreview
                ? "px-2 pb-2 pt-4"
                : "absolute inset-x-6 bottom-[102px] max-w-[21rem] sm:inset-x-7 sm:bottom-[108px]"
            }`}
          >
            <div className={`${hasPreview ? "max-w-[21rem]" : ""}`}>
              <p className="ui-title text-[1.02rem] font-semibold leading-[1.42] tracking-[-0.02em] sm:text-[1.1rem]">
                {t.body}
              </p>
              <p className="ui-text-subtle mt-2 text-[11px] font-medium">
                {t.hint}
              </p>
            </div>
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
                className="ui-button-secondary-soft min-h-[54px] px-4 text-sm font-semibold"
              >
                {t.gallery}
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
    </section>
  );
}

class FaceLabErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error("FaceLab render error:", error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

function FaceLabTabs({ tabs, activeTab, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`rounded-[1.25rem] border px-4 py-3 text-left text-sm font-medium transition ${
              isActive
                ? "bg-zinc-900 text-white shadow-[0_14px_28px_rgba(24,24,27,0.14)] dark:bg-zinc-100 dark:text-zinc-950"
                : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-700"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function FaceLabHeader({ locale, previewUrl, summary, tags }) {
  const ui = getUi(locale);

  return (
    <section className="ui-card p-5">
      <div className="space-y-5">
        <div className="space-y-1">
          <h2 className="ui-title text-[1.55rem]">{ui.reportTitle}</h2>
        </div>

        <div className="mx-auto w-full max-w-[132px]">
          <div className="ui-image-surface overflow-hidden rounded-[1.6rem]">
            {previewUrl ? (
              <img src={previewUrl} alt="Face Lab preview" className="h-32 w-full object-contain" />
            ) : (
              <div className="flex h-32 items-center justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-zinc-200 bg-white text-xl text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-500">
                  +
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="ui-panel-accent p-4">
            <p className="ui-kicker">{ui.reportSummaryLabel}</p>
            <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{summary}</p>
          </div>

          <div className="space-y-2">
            <p className="ui-kicker">{ui.reportTagsLabel}</p>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span key={tag} className="ui-chip px-3 py-1.5 text-xs font-medium">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function renderSection(section) {
  if (!section) {
    return null;
  }

  if (section.type === "profile") {
    return (
      <div className="grid grid-cols-2 gap-3">
        {section.items.map((item) => (
          <div key={item.label} className="ui-card-muted rounded-[1.2rem] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
              {item.label}
            </p>
            <p className="mt-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">{item.value}</p>
          </div>
        ))}
      </div>
    );
  }

  if (section.type === "palette") {
    return (
      <div className="grid grid-cols-2 gap-3">
        {section.items.map((item) => (
          <div key={item} className="ui-card-subtle rounded-[1.2rem] p-3">
            <div className="h-12 rounded-[0.9rem]" style={getColorChipStyle(item)} />
            <p className="mt-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">{item}</p>
          </div>
        ))}
      </div>
    );
  }

  if (section.type === "matches") {
    return (
      <div className="space-y-3">
        {section.items.map((item) => (
          <div key={item.name} className="ui-card-muted rounded-[1.2rem] p-4">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{item.name}</p>
            <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{item.reason}</p>
          </div>
        ))}
      </div>
    );
  }

  if (section.type === "chips") {
    return (
      <div className="flex flex-wrap gap-2">
        {section.items.map((item) => (
          <span key={item} className="ui-chip px-3 py-1.5 text-xs font-medium">
            {item}
          </span>
        ))}
      </div>
    );
  }

  if (section.type === "text") {
    return <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">{section.text}</p>;
  }

  return (
    <div className="space-y-2.5">
      {section.items.map((item) => (
        <div
          key={item}
          className={`rounded-[1.2rem] border px-4 py-3 text-sm leading-6 ${
            section.tone === "positive"
              ? "border-emerald-200 bg-emerald-50 text-zinc-800 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-zinc-200"
              : section.tone === "caution"
                ? "border-amber-200 bg-amber-50 text-zinc-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-zinc-200"
                : "border-zinc-200 bg-zinc-50 text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
          }`}
        >
          {item}
        </div>
      ))}
    </div>
  );
}

function FaceLabCardDeck({ locale, cards, activeTab, activeCardIndex, onPrev, onNext, onOpenNextTab }) {
  const ui = getUi(locale);
  const card = cards[activeCardIndex];
  const showNextTab = activeCardIndex === cards.length - 1 && ui.nextTabs[activeTab];

  return (
    <section className="ui-card overflow-hidden p-0">
      <AnimatePresence mode="wait">
        <motion.article
          key={`${activeTab}-${activeCardIndex}`}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -18 }}
          transition={{ duration: 0.24, ease: "easeOut" }}
          className="space-y-5 p-5"
        >
          <div className="space-y-2">
            <p className="ui-kicker">
              {ui.nav.card} {activeCardIndex + 1}
            </p>
            <h3 className="ui-title text-[1.7rem]">{card.title}</h3>
            <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">{card.summary}</p>
          </div>

          <div className="space-y-4">
            {card.sections.map((section) => (
              <div key={`${card.id}-${section.label}`} className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                  {section.label}
                </p>
                {renderSection(section)}
              </div>
            ))}
          </div>

          {showNextTab ? (
            <button
              type="button"
              onClick={onOpenNextTab}
              className="ui-button-primary px-4 py-2.5 text-sm font-medium"
            >
              {ui.nextTabs[activeTab]}
            </button>
          ) : null}
        </motion.article>
      </AnimatePresence>

      <div className="border-t border-zinc-200 bg-zinc-50 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex gap-2">
              {cards.map((item, index) => (
                <span
                  key={item.id}
                  className={`h-1.5 flex-1 rounded-full ${
                    index === activeCardIndex ? "bg-zinc-900 dark:bg-zinc-100" : "bg-zinc-200 dark:bg-zinc-800"
                  }`}
                />
              ))}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {ui.nav.card} {activeCardIndex + 1} / {cards.length}
            </p>
          </div>

          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={onPrev}
              disabled={activeCardIndex === 0}
              className="ui-button-secondary px-4 py-2 text-sm font-medium"
            >
              {ui.nav.prev}
            </button>
            <button
              type="button"
              onClick={onNext}
              disabled={activeCardIndex === cards.length - 1}
              className="ui-button-secondary px-4 py-2 text-sm font-medium"
            >
              {ui.nav.next}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function buildCards(tabId, result, sharedTags, locale = "ko") {
  const ui = getUi(locale);
  const baseData = result?.base_data ?? {};
  const features = result?.features ?? {};
  const feature = features?.[tabId] ?? {};
  const faceShape = cleanText(baseData.face_shape);

  if (tabId === "physiognomy") {
    return [
      {
        id: "physiognomy-summary",
        title: ui.tabs.physiognomy,
        summary: cleanText(feature.headline_result || feature.overall_impression),
        sections: [
          {
            label: ui.sections.summary,
            type: "text",
            text: cleanText(feature.overall_impression || feature.headline_result)
          },
          {
            label: ui.sections.tags,
            type: "chips",
            items: uniqueItems([feature.headline_label, ...compactList(feature.interpretation_axes, 2), ...sharedTags.slice(0, 2)]).slice(0, 5)
          }
        ]
      },
      {
        id: "physiognomy-evidence",
        title: locale === "ko" ? "이렇게 읽히는 이유" : "Why it reads this way",
        summary:
          locale === "ko"
            ? "인상을 만드는 근거만 짧게 정리했습니다."
            : "A short view of the features behind the impression.",
        sections: [{ label: ui.sections.evidence, items: compactList(feature.feature_based_interpretation, 3) }]
      },
      {
        id: "physiognomy-apply",
        title: locale === "ko" ? "활용 & 주의" : "Use & caution",
        summary:
          locale === "ko"
            ? "강점과 주의 포인트를 함께 보면 흐름이 더 선명해집니다."
            : "Strengths and cautions make the read easier to use.",
        sections: [
          { label: ui.sections.strengths, items: compactList(feature.strengths, 2), tone: "positive" },
          { label: ui.sections.cautions, items: compactList(feature.cautions, 2), tone: "caution" }
        ]
      }
    ];
  }

  if (tabId === "face_shape_hairstyle") {
    return [
      {
        id: "shape-summary",
        title: ui.tabs.face_shape_hairstyle,
        summary: cleanText(feature.summary),
        sections: [
          { label: ui.sections.summary, type: "text", text: cleanText(feature.summary) },
          { label: ui.sections.tags, type: "chips", items: uniqueItems([faceShape, ...sharedTags.slice(0, 3)]).slice(0, 4) }
        ]
      },
      {
        id: "shape-style",
        title: locale === "ko" ? "추천 스타일" : "Recommended styles",
        summary:
          locale === "ko"
            ? "얼굴 흐름을 해치지 않는 쪽에 집중했습니다."
            : "Focused on the styles that keep the flow working.",
        sections: [{ label: ui.sections.style, items: compactList(feature.recommendations, 3), tone: "positive" }]
      },
      {
        id: "shape-avoid",
        title: locale === "ko" ? "활용 & 주의" : "Use & avoid",
        summary:
          locale === "ko"
            ? "잘 맞는 방향과 피하면 좋은 방향을 같이 봐주세요."
            : "See the working direction and what to avoid together.",
        sections: [
          { label: ui.sections.apply, items: [ui.fallbackApply], tone: "positive" },
          { label: ui.sections.avoid, items: compactList(feature.avoid, 2), tone: "caution" }
        ]
      }
    ];
  }

  if (tabId === "lookalike_celebrities") {
    return [
      {
        id: "mood-summary",
        title: ui.tabs.lookalike_celebrities,
        summary: cleanText(feature.summary),
        sections: [
          { label: ui.sections.summary, type: "text", text: cleanText(feature.summary) },
          { label: ui.sections.tags, type: "chips", items: sharedTags.slice(0, 4) }
        ]
      },
      {
        id: "mood-matches",
        title: locale === "ko" ? "닮은 분위기 참고" : "Similar vibe references",
        summary:
          locale === "ko"
            ? "실제 인물보다 분위기 결에 집중한 참고입니다."
            : "Focused on the shared vibe rather than identity.",
        sections: [{ label: ui.sections.mood, type: "matches", items: Array.isArray(feature.matches) ? feature.matches.slice(0, 3) : [] }]
      },
      {
        id: "mood-apply",
        title: locale === "ko" ? "활용 포인트" : "Use points",
        summary:
          locale === "ko"
            ? "이 무드를 과장하지 않고 살리는 쪽이 좋습니다."
            : "This mood usually works best when styling stays controlled.",
        sections: [
          {
            label: ui.sections.apply,
            items: compactList([ui.fallbackApply, ...(feature.matches || []).map((item) => item?.reason)], 2),
            tone: "positive"
          },
          { label: ui.sections.avoid, items: [ui.fallbackAvoid], tone: "caution" }
        ]
      }
    ];
  }

  const colorValues = baseData?.color_values ?? {};
  return [
    {
      id: "color-summary",
      title: ui.tabs.color_tone_recommendation,
      summary: cleanText(feature.summary),
      sections: [
        { label: ui.sections.summary, type: "text", text: cleanText(feature.summary) },
        { label: ui.sections.tags, type: "chips", items: sharedTags.slice(0, 4) }
      ]
    },
    {
      id: "color-profile",
      title: locale === "ko" ? "컬러 프로필" : "Color profile",
      summary:
        locale === "ko"
          ? "톤 구조를 네 축으로 간단히 정리했습니다."
          : "The tone is compressed into four simple axes.",
      sections: [
        {
          label: ui.sections.profile,
          type: "profile",
          items: [
            { label: locale === "ko" ? "언더톤" : "Undertone", value: cleanText(colorValues.undertone) || "-" },
            { label: locale === "ko" ? "명도" : "Brightness", value: cleanText(colorValues.brightness) || "-" },
            { label: locale === "ko" ? "대비" : "Contrast", value: cleanText(colorValues.contrast) || "-" },
            { label: locale === "ko" ? "채도" : "Chroma", value: cleanText(colorValues.saturation) || "-" }
          ]
        }
      ]
    },
    {
      id: "color-apply",
      title: locale === "ko" ? "추천 & 주의" : "Recommend & avoid",
      summary:
        locale === "ko"
          ? "어울리는 팔레트와 피하면 좋은 방향을 함께 봐주세요."
          : "See the useful palette and the avoid notes together.",
      sections: [
        { label: ui.sections.palette, type: "palette", items: compactList(feature.palette, 4) },
        { label: ui.sections.apply, items: compactList(feature.recommendations, 2), tone: "positive" },
        { label: ui.sections.avoid, items: compactList(feature.avoid, 2), tone: "caution" }
      ]
    }
  ];
}

export default function FaceLab({
  locale = "ko",
  copy,
  imageFile,
  previewUrl,
  onImageChange,
  faceLabResult,
  faceLabError,
  faceLabLoading
}) {
  const ui = getUi(locale);
  const reportRef = useRef(null);
  const tabs = useMemo(() => TAB_ORDER.map((id) => ({ id, label: ui.tabs[id] })), [ui]);
  const safeResult = isValidFaceLabResult(faceLabResult) ? faceLabResult : null;
  const [activeTab, setActiveTab] = useState(TAB_ORDER[0]);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const showComposer = !safeResult;

  useEffect(() => {
    setActiveTab(TAB_ORDER[0]);
    setActiveCardIndex(0);
  }, [safeResult]);

  useEffect(() => {
    setActiveCardIndex(0);
  }, [activeTab]);

  const sharedTags = useMemo(() => (safeResult ? getSharedTags(safeResult) : []), [safeResult]);
  const headerSummary = useMemo(() => (safeResult ? getHeaderSummary(safeResult, locale) : ""), [locale, safeResult]);
  const cards = useMemo(() => (safeResult ? buildCards(activeTab, safeResult, sharedTags, locale) : []), [activeTab, locale, safeResult, sharedTags]);

  const openNextTab = () => {
    const currentIndex = TAB_ORDER.indexOf(activeTab);
    const nextTab = TAB_ORDER[currentIndex + 1];

    if (!nextTab) {
      return;
    }

    setActiveTab(nextTab);
    setActiveCardIndex(0);
    reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      {showComposer ? (
        <section className="flex flex-1 flex-col justify-center py-4">
          <FaceLabComposerCard
            locale={locale}
            previewUrl={previewUrl}
            onImageChange={onImageChange}
          />
          <ErrorMessage message={faceLabError} />
          {faceLabLoading ? <LoadingSpinner label={copy?.faceLabSpinner || copy?.faceLab?.spinner || ui.spinner} /> : null}
        </section>
      ) : null}

      {safeResult ? (
        <div className="mt-[30px] space-y-5 pb-6">
          <ErrorMessage message={faceLabError} />
          {faceLabLoading ? <LoadingSpinner label={copy?.faceLabSpinner || copy?.faceLab?.spinner || ui.spinner} /> : null}
          <FaceLabErrorBoundary
            fallback={
              <div className="ui-error px-5 py-6">
                {ui.fallbackRender}
              </div>
            }
          >
            <div ref={reportRef} className="space-y-4">
              <FaceLabHeader
                locale={locale}
                previewUrl={previewUrl}
                summary={headerSummary}
                tags={sharedTags}
                faceShape={cleanText(safeResult?.base_data?.face_shape)}
              />

              <FaceLabTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

              <FaceLabCardDeck
                locale={locale}
                cards={cards}
                activeTab={activeTab}
                activeCardIndex={activeCardIndex}
                onPrev={() => setActiveCardIndex((current) => Math.max(0, current - 1))}
                onNext={() => setActiveCardIndex((current) => Math.min(cards.length - 1, current + 1))}
                onOpenNextTab={openNextTab}
              />
            </div>
          </FaceLabErrorBoundary>
        </div>
      ) : null}
    </>
  );
}
