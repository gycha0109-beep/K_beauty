"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Component, useEffect, useMemo, useRef, useState } from "react";
import ErrorMessage from "@/components/ErrorMessage";
import LoadingSpinner from "@/components/LoadingSpinner";
import UploadPreview from "@/components/UploadPreview";

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

function FaceLabHeader({ locale, previewUrl, summary, tags, faceShape }) {
  const ui = getUi(locale);

  return (
    <section className="ui-card p-5">
      <div className="grid gap-4 sm:grid-cols-[132px_minmax(0,1fr)] sm:items-start">
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

        <div className="space-y-3">
          <div className="space-y-1">
            <p className="ui-kicker">{ui.reportEyebrow}</p>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="ui-title text-[1.55rem]">{ui.reportTitle}</h2>
              {faceShape ? (
                <span className="ui-chip px-3 py-1 text-xs font-medium">{faceShape}</span>
              ) : null}
            </div>
          </div>

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
  onClearImage,
  presets = [],
  onPresetPreview,
  faceLabResult,
  faceLabError,
  faceLabLoading,
  onAnalyze
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

  const handleAnalyze = () => {
    try {
      onAnalyze?.();
    } catch (error) {
      console.error("FaceLab action error:", error);
    }
  };

  return (
    <div className="space-y-5 pb-6">
      {presets.length ? (
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onPresetPreview?.(preset.id)}
              className="ui-button-secondary bg-white/85 px-3 py-2 text-xs font-medium dark:bg-zinc-900/85"
            >
              {copy?.facePresetLabels?.[preset.id] || preset.buttonLabel}
            </button>
          ))}
        </div>
      ) : null}

      {showComposer ? (
        <UploadPreview
          imageFile={imageFile}
          previewUrl={previewUrl}
          onChange={onImageChange}
          onClear={onClearImage}
          locale={locale}
        />
      ) : null}

      <ErrorMessage message={faceLabError} />

      {showComposer ? (
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={!imageFile || faceLabLoading}
          className="ui-button-primary w-full px-5 py-4 text-sm font-medium disabled:opacity-45"
        >
          {copy?.faceLabButton || copy?.faceLab?.button || ui.button}
        </button>
      ) : null}

      {faceLabLoading ? <LoadingSpinner label={copy?.faceLabSpinner || copy?.faceLab?.spinner || ui.spinner} /> : null}

      {showComposer && !faceLabLoading ? (
        <div className="ui-card-dashed px-5 py-6 text-center">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{ui.readyTitle}</p>
          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{ui.readyBody}</p>
        </div>
      ) : null}

      {safeResult ? (
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
      ) : null}
    </div>
  );
}
