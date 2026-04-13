"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Component, useEffect, useMemo, useRef, useState } from "react";
import ErrorMessage from "@/components/ErrorMessage";
import LoadingSpinner from "@/components/LoadingSpinner";
import UploadPreview from "@/components/UploadPreview";

const TAB_ORDER = ["physiognomy", "face_shape_hairstyle", "lookalike_celebrities", "color_tone_recommendation"];

const UI_COPY = {
  ko: {
    reportEyebrow: "FACE LAB REPORT",
    reportTitle: "Face Lab",
    reportSummaryLabel: "핵심 인상",
    reportTagsLabel: "핵심 특징",
    readyTitle: "사진을 업로드하면 Face Lab 분석을 시작할 수 있습니다.",
    readyBody: "결과가 나오면 이 얼굴을 4개의 관점으로 카드처럼 넘겨볼 수 있습니다.",
    button: "Face Lab 보기",
    spinner: "Face Lab 결과를 생성하고 있습니다...",
    tabs: {
      physiognomy: "인상 해석",
      face_shape_hairstyle: "얼굴형 & 헤어",
      lookalike_celebrities: "닮은 분위기",
      color_tone_recommendation: "컬러 톤"
    },
    sections: {
      summary: "핵심 결론",
      evidence: "핵심 근거",
      apply: "활용 포인트",
      avoid: "피하면 좋은 방향",
      strengths: "강점",
      cautions: "주의 포인트",
      style: "추천 스타일",
      mood: "비슷한 분위기",
      palette: "추천 팔레트",
      profile: "컬러 프로필",
      tags: "공통 특징"
    },
    nav: { prev: "이전", next: "다음", card: "CARD", tab: "TAB" },
    nextTabs: {
      physiognomy: "이 인상에 어울리는 헤어 보기",
      face_shape_hairstyle: "비슷한 분위기 보기",
      lookalike_celebrities: "이 분위기의 컬러 톤 보기"
    },
    fallbackApply: "지금 보이는 얼굴 결을 그대로 살리는 방향이 가장 자연스럽습니다.",
    fallbackAvoid: "과하게 힘을 주는 해석보다는 원래 결을 유지하는 편이 안정적입니다."
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
    fallbackAvoid: "Avoid pushing the interpretation harder than the face already suggests."
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
    (locale === "ko"
      ? "부드럽게 이어지는 인상 흐름이 먼저 보입니다."
      : "A clear impression flow shows up first.")
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
                ? "border-[#23180f] bg-[#23180f] text-white shadow-[0_14px_28px_rgba(35,24,15,0.16)]"
                : "border-black/8 bg-white/92 text-black/70 hover:border-black/16"
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
    <section className="rounded-[2rem] border border-black/6 bg-white/90 p-5 shadow-[0_18px_40px_rgba(29,21,14,0.08)]">
      <div className="grid gap-4 sm:grid-cols-[132px_minmax(0,1fr)] sm:items-start">
        <div className="overflow-hidden rounded-[1.6rem] border border-black/8 bg-[#f5eee3]">
          {previewUrl ? (
            <img src={previewUrl} alt="Face Lab preview" className="h-32 w-full object-contain" />
          ) : (
            <div className="flex h-32 items-center justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-black/8 bg-white text-xl text-black/40">
                ◌
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/34">{ui.reportEyebrow}</p>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[1.55rem] font-semibold tracking-tight text-[#1f1811]">{ui.reportTitle}</h2>
              {faceShape ? (
                <span className="rounded-full border border-black/8 bg-[#f6efe5] px-3 py-1 text-xs font-medium text-black/58">
                  {faceShape}
                </span>
              ) : null}
            </div>
          </div>

          <div className="rounded-[1.35rem] bg-[#faf5ee] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/35">{ui.reportSummaryLabel}</p>
            <p className="mt-2 text-sm leading-6 text-black/76">{summary}</p>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/35">{ui.reportTagsLabel}</p>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span key={tag} className="rounded-full border border-black/8 bg-white px-3 py-1.5 text-xs font-medium text-black/64">
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
          <div key={item.label} className="rounded-[1.2rem] border border-black/6 bg-[#faf6f0] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-black/34">{item.label}</p>
            <p className="mt-2 text-sm font-medium text-black/74">{item.value}</p>
          </div>
        ))}
      </div>
    );
  }

  if (section.type === "palette") {
    return (
      <div className="grid grid-cols-2 gap-3">
        {section.items.map((item) => (
          <div key={item} className="rounded-[1.2rem] border border-black/6 bg-white p-3">
            <div className="h-12 rounded-[0.9rem]" style={getColorChipStyle(item)} />
            <p className="mt-2 text-sm font-medium text-black/72">{item}</p>
          </div>
        ))}
      </div>
    );
  }

  if (section.type === "matches") {
    return (
      <div className="space-y-3">
        {section.items.map((item) => (
          <div key={item.name} className="rounded-[1.2rem] border border-black/6 bg-[#faf6f0] p-4">
            <p className="text-sm font-semibold text-[#1f1811]">{item.name}</p>
            <p className="mt-2 text-sm leading-6 text-black/68">{item.reason}</p>
          </div>
        ))}
      </div>
    );
  }

  if (section.type === "chips") {
    return (
      <div className="flex flex-wrap gap-2">
        {section.items.map((item) => (
          <span key={item} className="rounded-full border border-black/8 bg-white px-3 py-1.5 text-xs font-medium text-black/64">
            {item}
          </span>
        ))}
      </div>
    );
  }

  if (section.type === "text") {
    return <p className="text-sm leading-6 text-black/72">{section.text}</p>;
  }

  return (
    <div className="space-y-2.5">
      {section.items.map((item) => (
        <div
          key={item}
          className={`rounded-[1.2rem] border px-4 py-3 text-sm leading-6 ${
            section.tone === "positive"
              ? "border-[#bfd6c1] bg-[#f4fbf4] text-black/72"
              : section.tone === "caution"
                ? "border-[#e4d5bf] bg-[#fff8ef] text-black/72"
                : "border-black/6 bg-[#faf6f0] text-black/72"
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
    <section className="overflow-hidden rounded-[2rem] border border-black/6 bg-white/90 shadow-[0_18px_40px_rgba(29,21,14,0.08)]">
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/34">
              {ui.nav.card} {activeCardIndex + 1}
            </p>
            <h3 className="text-[1.7rem] font-semibold tracking-tight text-[#1f1811]">{card.title}</h3>
            <p className="text-sm leading-6 text-black/68">{card.summary}</p>
          </div>

          <div className="space-y-4">
            {card.sections.map((section) => (
              <div key={`${card.id}-${section.label}`} className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-black/34">{section.label}</p>
                {renderSection(section)}
              </div>
            ))}
          </div>

          {showNextTab ? (
            <button
              type="button"
              onClick={onOpenNextTab}
              className="inline-flex rounded-full border border-black/10 bg-[#1f1811] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#31241a]"
            >
              {ui.nextTabs[activeTab]}
            </button>
          ) : null}
        </motion.article>
      </AnimatePresence>

      <div className="border-t border-black/6 bg-[#fcf8f1] px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex gap-2">
              {cards.map((item, index) => (
                <span
                  key={item.id}
                  className={`h-1.5 flex-1 rounded-full ${index === activeCardIndex ? "bg-[#23180f]" : "bg-black/10"}`}
                />
              ))}
            </div>
            <p className="text-xs text-black/44">
              {ui.nav.card} {activeCardIndex + 1} / {cards.length}
            </p>
          </div>

          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={onPrev}
              disabled={activeCardIndex === 0}
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black/70 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {ui.nav.prev}
            </button>
            <button
              type="button"
              onClick={onNext}
              disabled={activeCardIndex === cards.length - 1}
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black/70 disabled:cursor-not-allowed disabled:opacity-40"
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
          { label: ui.sections.summary, type: "text", text: cleanText(feature.overall_impression || feature.headline_result) },
          { label: ui.sections.tags, type: "chips", items: uniqueItems([feature.headline_label, ...compactList(feature.interpretation_axes, 2), ...sharedTags.slice(0, 2)]).slice(0, 5) }
        ]
      },
      {
        id: "physiognomy-evidence",
        title: locale === "ko" ? "이렇게 읽히는 이유" : "Why it reads this way",
        summary: locale === "ko" ? "이 인상을 만드는 근거만 짧게 정리했습니다." : "A short view of the features behind the impression.",
        sections: [{ label: ui.sections.evidence, items: compactList(feature.feature_based_interpretation, 3) }]
      },
      {
        id: "physiognomy-apply",
        title: locale === "ko" ? "활용 & 주의" : "Use & caution",
        summary: locale === "ko" ? "강점과 주의 포인트를 함께 보면 흐름이 더 선명해집니다." : "Strengths and cautions make the read easier to use.",
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
        summary: locale === "ko" ? "흐름을 살리는 쪽에만 집중했습니다." : "Focused on the styles that keep the flow working.",
        sections: [{ label: ui.sections.style, items: compactList(feature.recommendations, 3), tone: "positive" }]
      },
      {
        id: "shape-avoid",
        title: locale === "ko" ? "적용 & 주의" : "Use & avoid",
        summary: locale === "ko" ? "잘 맞는 방향과 피하면 좋은 방향을 같이 보세요." : "See the working direction and what to avoid together.",
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
        title: locale === "ko" ? "비슷한 분위기 셀럽" : "Similar vibe references",
        summary: locale === "ko" ? "닮은 사람보다 닮은 결에 더 집중했습니다." : "Focused on the shared vibe rather than identity.",
        sections: [{ label: ui.sections.mood, type: "matches", items: Array.isArray(feature.matches) ? feature.matches.slice(0, 3) : [] }]
      },
      {
        id: "mood-apply",
        title: locale === "ko" ? "활용 포인트" : "Use points",
        summary: locale === "ko" ? "이 무드를 살릴 때 과하지 않게 가져가는 편이 좋습니다." : "This mood usually works best when styling stays controlled.",
        sections: [
          { label: ui.sections.apply, items: compactList([ui.fallbackApply, ...(feature.matches || []).map((item) => item?.reason)], 2), tone: "positive" },
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
      summary: locale === "ko" ? "톤 구조를 4축으로 압축했습니다." : "The tone is compressed into four simple axes.",
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
      summary: locale === "ko" ? "추천 팔레트와 피하면 좋은 방향을 같이 보세요." : "See the useful palette and the avoid notes together.",
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
    if (!nextTab) return;
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
              className="rounded-full border border-black/10 bg-white/85 px-3 py-2 text-xs font-medium text-black/68 transition hover:border-black/20"
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
          className="w-full rounded-full bg-[#1f1811] px-5 py-4 text-sm font-medium text-white transition hover:bg-[#302118] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {copy?.faceLabButton || copy?.faceLab?.button || ui.button}
        </button>
      ) : null}

      {faceLabLoading ? <LoadingSpinner label={copy?.faceLabSpinner || copy?.faceLab?.spinner || ui.spinner} /> : null}

      {showComposer && !faceLabLoading ? (
        <div className="rounded-[1.8rem] border border-dashed border-black/10 bg-white/78 px-5 py-6 text-center">
          <p className="text-sm font-medium text-[#1f1811]">{ui.readyTitle}</p>
          <p className="mt-2 text-sm leading-6 text-black/56">{ui.readyBody}</p>
        </div>
      ) : null}

      {safeResult ? (
        <FaceLabErrorBoundary
          fallback={
            <div className="rounded-[1.8rem] border border-[#d7c3aa] bg-[#fff8ef] px-5 py-6 text-sm leading-6 text-black/72">
              {locale === "ko"
                ? "Face Lab 결과를 표시하는 중 문제가 발생했습니다. 다시 시도해주세요."
                : "There was a problem rendering the Face Lab result. Please try again."}
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
