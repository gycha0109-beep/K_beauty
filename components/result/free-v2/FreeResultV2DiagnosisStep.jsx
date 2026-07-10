"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  FreeResultV2Card,
  FreeResultV2FaceLabMoodIcon,
  FreeResultV2PriorityIcon,
  FreeResultV2StepFrame
} from "@/components/result/free-v2/FreeResultV2Primitives";

function uniqueItems(items) {
  return Array.from(new Set(items.filter(Boolean)));
}

function FreeResultV2PhotoFrame({ photoUrl, photoAlt, fallback, showAnalysisOverlay = false, locale = "ko", className = "" }) {
  return (
    <div className={`relative mx-auto flex aspect-[4/5] min-h-[170px] w-full max-w-[230px] items-center justify-center overflow-hidden rounded-[1.35rem] border border-[#ead2cf] bg-white/68 dark:border-[#5a3a48] dark:bg-[#2a1b24] ${className}`}>
      {photoUrl ? (
        <>
          <img src={photoUrl} alt={photoAlt} className="h-full w-full object-cover object-center" />
          {showAnalysisOverlay ? <FreeResultV2AnalysisOverlay locale={locale} /> : null}
        </>
      ) : (
        <div className="px-4 text-center text-xs leading-5 text-[#7a5360] dark:text-[#c8aeb8]">{fallback}</div>
      )}
    </div>
  );
}

function FreeResultV2AnalysisOverlay({ locale = "ko" }) {
  const isEnglish = locale === "en";
  const labels = isEnglish
    ? {
        forehead: "T-zone",
        pore: "Pore area",
        dry: "Dryness cue",
        badge: "AI view"
      }
    : {
        forehead: "T존 관찰",
        pore: "모공 관찰",
        dry: "건조 의심",
        badge: "AI view"
      };

  return (
    <div className="pointer-events-none absolute inset-0 text-[10px] font-semibold tracking-normal text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_24%,rgba(255,154,168,0.22),transparent_23%),radial-gradient(circle_at_34%_56%,rgba(255,255,255,0.16),transparent_19%),radial-gradient(circle_at_64%_52%,rgba(255,128,104,0.14),transparent_18%)]" />
      <span className="absolute left-3 top-3 rounded-full border border-white/38 bg-[#1b1118]/38 px-2 py-1 text-[9px] uppercase tracking-[0.14em] text-white/84 shadow-[0_0_18px_rgba(255,154,168,0.18)] backdrop-blur-sm">
        {labels.badge}
      </span>
      <span className="absolute left-[38%] top-[18%] h-[19%] w-[24%] rounded-[48%] border border-[#ff9aa8]/74 shadow-[0_0_20px_rgba(255,154,168,0.28)]" />
      <span className="absolute left-[49%] top-[28%] h-[21%] border-l border-[#ff9aa8]/70 shadow-[0_0_16px_rgba(255,154,168,0.3)]" />
      <span className="absolute left-[57%] top-[39%] h-2 w-2 rounded-full bg-[#ff9aa8] shadow-[0_0_16px_rgba(255,154,168,0.75)]" />
      <span className="absolute left-[59%] top-[41%] h-px w-[22%] origin-left rotate-[14deg] bg-[#ff9aa8]/75" />
      <span className="absolute right-3 top-[43%] rounded-full border border-white/34 bg-[#1b1118]/42 px-2 py-1 text-white/88 backdrop-blur-sm">
        {labels.pore}
      </span>
      <span className="absolute left-[25%] top-[53%] h-2 w-2 rounded-full bg-white shadow-[0_0_14px_rgba(255,255,255,0.72)]" />
      <span className="absolute left-[16%] top-[56%] h-px w-[20%] origin-right -rotate-[20deg] bg-white/72" />
      <span className="absolute left-3 top-[60%] rounded-full border border-white/34 bg-[#1b1118]/42 px-2 py-1 text-white/88 backdrop-blur-sm">
        {labels.dry}
      </span>
      <span className="absolute left-[37%] top-[13%] rounded-full border border-[#ff9aa8]/58 bg-[#1b1118]/28 px-2 py-0.5 text-[#ffd7dd] backdrop-blur-sm">
        {labels.forehead}
      </span>
    </div>
  );
}

function getFreeResultV2FaceLabMoodGroups(faceLabPreview = null, locale = "ko") {
  if (!faceLabPreview) {
    return [];
  }

  const isEnglish = locale === "en";
  const fallbacks = isEnglish
    ? {
        mood: "Face mood in analysis",
        tone: "Natural color match",
        style: "Clean style direction"
      }
    : {
        mood: "분석 중인 얼굴 분위기",
        tone: "자연스러운 컬러 매치",
        style: "정돈된 스타일 방향"
      };
  const primary = String(faceLabPreview.primary || "").trim();
  const keywords = uniqueItems([
    ...(Array.isArray(faceLabPreview.keywords) ? faceLabPreview.keywords : [])
  ]).filter(Boolean).slice(0, 5);
  const colorPattern = isEnglish
    ? /peach|coral|pink|cool|warm|tone|color/i
    : /피치|코랄|핑크|쿨|웜|톤|컬러|색/;
  const colorKeywords = keywords.filter((keyword) => colorPattern.test(keyword)).slice(0, 3);
  const styleKeywords = keywords
    .filter((keyword) => keyword !== primary && !colorKeywords.includes(keyword))
    .slice(0, 3);

  return [
    {
      key: "mood",
      label: isEnglish ? "Representative mood" : "대표 무드",
      value: primary || fallbacks.mood
    },
    {
      key: "tone",
      label: isEnglish ? "Best-fit color" : "잘 맞는 컬러",
      value: colorKeywords.join(" · ") || fallbacks.tone
    },
    {
      key: "style",
      label: isEnglish ? "Style direction" : "스타일 방향",
      value: styleKeywords.join(" · ") || fallbacks.style
    }
  ];
}

function FreeResultV2FaceLabPhotoCarousel({ photoUrl, photoAlt, photoFallback, faceLabPreview = null, locale = "ko" }) {
  const isEnglish = locale === "en";
  const groups = getFreeResultV2FaceLabMoodGroups(faceLabPreview, locale);
  const [activeIndex, setActiveIndex] = useState(0);
  const [hasPlayedHint, setHasPlayedHint] = useState(false);
  const [valueTextNode, setValueTextNode] = useState(null);
  const touchStartXRef = useRef(null);
  const activeGroup = groups[activeIndex] || groups[0];

  useEffect(() => {
    const valueNode = valueTextNode;

    if (!valueNode) {
      return undefined;
    }

    const maxFontSize = 20.8;
    const minFontSize = 8.5;
    let frameId = null;
    let cancelled = false;

    const fitValueText = () => {
      if (typeof window === "undefined") {
        return;
      }

      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      frameId = window.requestAnimationFrame(() => {
        if (cancelled) {
          return;
        }

        const currentNode = valueTextNode;
        const parentWidth = currentNode?.parentElement?.clientWidth ?? 0;

        if (!currentNode || parentWidth <= 0) {
          return;
        }

        currentNode.style.fontSize = `${maxFontSize}px`;

        const contentWidth = currentNode.scrollWidth;
        const nextFontSize = contentWidth > parentWidth
          ? Math.max(minFontSize, Math.min(maxFontSize, (maxFontSize * parentWidth) / contentWidth))
          : maxFontSize;

        currentNode.style.fontSize = `${Math.floor(nextFontSize * 10) / 10}px`;
      });
    };

    fitValueText();

    const parentNode = valueNode.parentElement;
    const observer = typeof ResizeObserver !== "undefined" && parentNode
      ? new ResizeObserver(fitValueText)
      : null;

    observer?.observe(parentNode);
    window.addEventListener("resize", fitValueText);

    const fontsReady = typeof document !== "undefined" ? document.fonts?.ready : null;
    fontsReady?.then(() => {
      if (!cancelled) {
        fitValueText();
      }
    });

    return () => {
      cancelled = true;
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      observer?.disconnect();
      window.removeEventListener("resize", fitValueText);
    };
  }, [activeGroup?.value, valueTextNode]);

  if (!faceLabPreview || !activeGroup) {
    return (
      <FreeResultV2PhotoFrame
        photoUrl={photoUrl}
        photoAlt={photoAlt}
        fallback={photoFallback}
        locale={locale}
        className="max-w-[14.2rem] min-h-[212px] sm:max-w-[16.2rem] sm:min-h-[243px]"
      />
    );
  }

  const goToIndex = (nextIndex) => {
    if (!groups.length) {
      return;
    }

    setActiveIndex(((nextIndex % groups.length) + groups.length) % groups.length);
  };

  const goNext = () => goToIndex(activeIndex + 1);
  const goPrevious = () => goToIndex(activeIndex - 1);

  const handleTouchStart = (event) => {
    touchStartXRef.current = event.touches?.[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event) => {
    const startX = touchStartXRef.current;
    touchStartXRef.current = null;

    if (typeof startX !== "number") {
      return;
    }

    const endX = event.changedTouches?.[0]?.clientX;
    if (typeof endX !== "number") {
      return;
    }

    const deltaX = endX - startX;
    if (Math.abs(deltaX) < 32) {
      return;
    }

    if (deltaX < 0) {
      goNext();
    } else {
      goPrevious();
    }
  };

  return (
    <FreeResultV2Card
      className="touch-pan-y p-4 sm:p-5"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="relative">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[13px] font-semibold leading-5 text-[#d9416f] dark:text-[#ff9aa8]">
          Face Lab · 무드 요약
        </p>
      </div>
      {activeGroup ? (
        <>
          <div className="mx-auto flex max-w-[18rem] flex-col items-center">
            <FreeResultV2PhotoFrame
              photoUrl={photoUrl}
              photoAlt={photoAlt}
              fallback={photoFallback}
              locale={locale}
              className="max-w-[14.2rem] min-h-[212px] sm:max-w-[16.2rem] sm:min-h-[243px]"
            />
            <motion.div
              className="mt-3.5 min-h-[4.05rem] w-full px-1 text-center"
              initial={{ x: 0 }}
              animate={hasPlayedHint ? { x: 0 } : { x: [0, 7, -6, 0] }}
              transition={{ delay: 0.25, duration: 0.52, ease: "easeOut" }}
              onAnimationComplete={() => setHasPlayedHint(true)}
            >
              <div className="mx-auto flex max-w-[16rem] flex-col items-center">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={`${activeGroup.key}-label`}
                    className="block text-[14px] font-semibold leading-5 text-[#9b5a6d] dark:text-[#d8a1b0]"
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                  >
                    {activeGroup.label}
                  </motion.span>
                </AnimatePresence>
                <div className="mt-1 flex min-h-[1.65rem] min-w-0 items-center justify-center" aria-live="polite">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      ref={setValueTextNode}
                      key={`${activeGroup.key}-value`}
                      className="block max-w-full min-w-0 whitespace-nowrap break-keep text-center text-[1.3rem] font-semibold leading-[1.18] text-[#26101a] dark:text-[#fff8f3]"
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                    >
                      {activeGroup.value}
                    </motion.span>
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          </div>
          <div className="mt-0.5 flex items-center justify-center gap-2" aria-label={isEnglish ? "Face Lab lens position" : "Face Lab 관점 위치"}>
              <button
                type="button"
                onClick={goPrevious}
                className="hidden h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#ead9d6]/72 bg-white/20 text-[13px] font-semibold leading-none text-[#9b5a6d] transition hover:border-[#f2c4ca] hover:bg-white/34 sm:flex dark:border-[#5a3a48]/76 dark:bg-white/[0.032] dark:text-[#d8a1b0] dark:hover:border-[#ff9aa8]/30"
                aria-label={isEnglish ? "Previous Face Lab lens" : "이전 Face Lab 관점"}
              >
                ‹
              </button>
              <div className="flex items-center justify-center gap-1.5">
              {groups.map((group, index) => (
                <button
                  key={group.key}
                  type="button"
                  onClick={() => goToIndex(index)}
                  className={`h-2 rounded-full transition ${index === activeIndex ? "w-4 bg-[#e6507a] dark:bg-[#ff8fa2]" : "w-2 bg-[#d9bdc6] dark:bg-[#6b4b59]"}`}
                  aria-label={isEnglish ? `Show Face Lab lens ${index + 1}` : `${index + 1}번째 Face Lab 관점 보기`}
                  aria-current={index === activeIndex}
                />
              ))}
              </div>
              <button
                type="button"
                onClick={goNext}
                className="hidden h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#ead9d6]/72 bg-white/20 text-[13px] font-semibold leading-none text-[#9b5a6d] transition hover:border-[#f2c4ca] hover:bg-white/34 sm:flex dark:border-[#5a3a48]/76 dark:bg-white/[0.032] dark:text-[#d8a1b0] dark:hover:border-[#ff9aa8]/30"
                aria-label={isEnglish ? "Next Face Lab lens" : "다음 Face Lab 관점"}
              >
                ›
              </button>
            </div>
        </>
      ) : null}
      </div>
    </FreeResultV2Card>
  );
}

function getFreeResultV2SkinRadarMetrics(data = {}, locale = "ko") {
  const isEnglish = locale === "en";
  const concernScores = Array.isArray(data?.concernScores) ? data.concernScores : [];
  const scoreByAxis = new Map(
    concernScores
      .map((item) => [String(item?.axis || ""), Number(item?.score)])
      .filter(([axis, score]) => axis && Number.isFinite(score))
  );
  const hasDecisionScores = scoreByAxis.size > 0;

  if (hasDecisionScores) {
    const getScore = (axes = []) => {
      const values = axes
        .map((axis) => scoreByAxis.get(axis))
        .filter((score) => Number.isFinite(score));

      return values.length ? Math.max(...values) : 0;
    };
    const toRadarValue = (score) => Math.max(0, Math.min(100, Math.round(Number(score) || 0)));

    return [
      { key: "moisture", label: isEnglish ? "Dryness" : "수분 부족", value: toRadarValue(getScore(["dehydration"])) },
      { key: "oil", label: isEnglish ? "Oil" : "유분감", value: toRadarValue(getScore(["oiliness"])) },
      { key: "pores", label: isEnglish ? "Pores" : "모공", value: toRadarValue(getScore(["pores"])) },
      { key: "barrier", label: isEnglish ? "Barrier" : "장벽", value: toRadarValue(getScore(["barrier"])) },
      { key: "sensitivity", label: isEnglish ? "Sensitive" : "민감", value: toRadarValue(getScore(["redness", "acne"])) }
    ];
  }

  const summaryText = [
    data?.coreLine,
    ...(Array.isArray(data?.priorities) ? data.priorities.flatMap((priority) => [priority.title, priority.body]) : []),
    ...(Array.isArray(data?.tags) ? data.tags.flatMap((tag) => [tag.label, tag.value]) : [])
  ].filter(Boolean).join(" ").toLowerCase();
  const includesAny = (terms) => terms.some((term) => summaryText.includes(term.toLowerCase()));
  const hasMoistureCue = includesAny(["수분", "건조", "moisture", "dry", "dehydrat"]);
  const hasOilCue = includesAny(["유분", "피지", "번들", "oil", "shine"]);
  const hasPoreCue = includesAny(["모공", "pore"]);
  const hasBarrierCue = includesAny(["장벽", "barrier"]);
  const hasSensitivityCue = includesAny(["민감", "예민", "자극", "붉", "트러블", "sensitive", "irritation", "redness", "breakout", "acne"]);

  return [
    { key: "moisture", label: isEnglish ? "Dryness" : "수분부족", value: hasMoistureCue ? 76 : 42 },
    { key: "oil", label: isEnglish ? "Oil" : "유분감", value: hasOilCue ? 78 : 44 },
    { key: "pores", label: isEnglish ? "Pores" : "모공", value: hasPoreCue ? 72 : 42 },
    { key: "barrier", label: isEnglish ? "Barrier" : "장벽", value: hasBarrierCue ? 68 : 40 },
    { key: "sensitivity", label: isEnglish ? "Sensitive" : "민감", value: hasSensitivityCue ? 64 : 36 }
  ];
}

function getFreeResultV2PentagonPoint(value, index, radius = 48, center = { x: 88, y: 88 }) {
  const angle = (-90 + index * 72) * (Math.PI / 180);
  const scale = Math.max(0, Math.min(100, Number(value) || 0)) / 100;

  return {
    x: center.x + Math.cos(angle) * radius * scale,
    y: center.y + Math.sin(angle) * radius * scale
  };
}

function getFreeResultV2PentagonPoints(values, radius = 48, center = { x: 88, y: 88 }) {
  return values
    .map((value, index) => {
      const point = getFreeResultV2PentagonPoint(value, index, radius, center);
      return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    })
    .join(" ");
}

function getFreeResultV2RadarStatus(metric = {}, locale = "ko") {
  const value = Math.max(0, Math.min(100, Number(metric.value) || 0));
  const isEnglish = locale === "en";
  const copy = {
    high: { label: isEnglish ? "High" : "높음", rank: 4 },
    medium: { label: isEnglish ? "Medium" : "중간", rank: 3 },
    caution: { label: isEnglish ? "Watch" : "주의", rank: 2 },
    normal: { label: isEnglish ? "Stable" : "보통", rank: 1 }
  };

  if (value < 55) {
    return { tone: "normal", ...copy.normal };
  }

  if (metric.key === "moisture") {
    return { tone: value >= 70 ? "high" : "medium", ...(value >= 70 ? copy.high : copy.medium) };
  }

  if (metric.key === "oil") {
    return { tone: value >= 64 ? "medium" : "normal", ...(value >= 64 ? copy.medium : copy.normal) };
  }

  if (metric.key === "pores") {
    return { tone: value >= 64 ? "caution" : "normal", ...(value >= 64 ? copy.caution : copy.normal) };
  }

  return { tone: "normal", ...copy.normal };
}

function getFreeResultV2RadarChipClass(tone = "normal") {
  if (tone === "high") {
    return "border-[#f3bbc7] bg-[#fff4f6]/72 text-[#cf466b] dark:border-[#ff8fa2]/32 dark:bg-[#ff8fa2]/10 dark:text-[#ff9aa8]";
  }

  if (tone === "medium") {
    return "border-[#ead0e4] bg-[#fcf5ff]/68 text-[#865878] dark:border-[#d8a1d8]/25 dark:bg-[#d8a1d8]/10 dark:text-[#e8b5df]";
  }

  if (tone === "caution") {
    return "border-[#efcfac] bg-[#fff7ed]/72 text-[#94613b] dark:border-[#ffbf78]/25 dark:bg-[#ffbf78]/10 dark:text-[#ffd0a2]";
  }

  return "border-[#ead9d6] bg-white/38 text-[#7a5360] dark:border-[#5a3a48] dark:bg-[#2a1b24]/54 dark:text-[#c8aeb8]";
}

function FreeResultV2SkinRadarHelpModal({ isOpen, onClose, locale = "ko" }) {
  const isEnglish = locale === "en";
  const axisItems = isEnglish
    ? [
        ["Moisture lack", "How easily the skin loses hydration and starts to feel dry."],
        ["Oil feel", "How easily shine appears around the forehead and nose."],
        ["Pore visibility", "How noticeable pores or surface texture look."],
        ["Barrier burden", "How much the skin's basic moisture-holding comfort needs support."],
        ["Irritation response", "The chance of redness, stinging, or sensitivity showing up."]
      ]
    : [
        ["수분 부족", "피부가 수분을 오래 유지하지 못하고 쉽게 건조해지는 정도"],
        ["유분감", "이마와 코 주변 번들거림이 얼마나 쉽게 올라오는지"],
        ["모공 가시성", "모공이나 피부결이 눈에 얼마나 도드라져 보이는지"],
        ["장벽 부담", "수분을 붙잡고 자극을 버티는 피부 기본 컨디션"],
        ["자극 반응", "붉어짐·따가움·예민함 같은 자극 반응 가능성"]
      ];

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.button
            type="button"
            className="fixed inset-0 z-[80] bg-[#2a101b]/24 backdrop-blur-[1px] dark:bg-black/42"
            onClick={onClose}
            aria-label={isEnglish ? "Close skin summary help" : "피부 상태 요약 도움말 닫기"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="free-result-v2-skin-radar-help-title"
            className="fixed inset-x-4 top-[8vh] z-[81] mx-auto max-h-[84vh] w-auto max-w-[22rem] overflow-y-auto rounded-[1.35rem] border border-[#ead9d6] bg-[#fffaf6] p-4 text-left shadow-[0_28px_80px_rgba(35,16,25,0.28)] dark:border-[#5a3a48] dark:bg-[#241720] dark:shadow-[0_28px_80px_rgba(0,0,0,0.48)]"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 id="free-result-v2-skin-radar-help-title" className="text-[1rem] font-semibold leading-6 text-[#26101a] dark:text-[#fff8f3]">
                {isEnglish ? "What is the skin state summary?" : "피부 상태 요약이란?"}
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-full border border-[#ead9d6] px-3 py-1 text-[12px] font-semibold text-[#7a5360] transition hover:bg-white dark:border-[#5a3a48] dark:text-[#c8aeb8] dark:hover:bg-[#301f28]"
              >
                {isEnglish ? "Close" : "닫기"}
              </button>
            </div>
            <div className="mt-3 space-y-2 break-keep text-[12px] leading-5 text-[#5f3a48] dark:text-[#d8c2c9]">
              <p>
                {isEnglish
                  ? "The pentagon compresses signals from the photo analysis and survey into five care axes."
                  : "오각형은 사진 분석과 설문 답변에서 확인된 신호를 5가지 관리 축으로 압축한 요약입니다."}
              </p>
              <p>
                {isEnglish
                  ? "The farther outward an axis is, the more that signal needs attention now. Recommendations reflect this flow together with the care priority."
                  : "바깥쪽으로 갈수록 현재 더 신경 써야 할 신호가 강하다는 의미이며, 추천 결과는 이 흐름과 관리 우선순위를 함께 반영합니다."}
              </p>
            </div>
            <dl className="mt-3 divide-y divide-[#ead9d6] overflow-hidden rounded-[1rem] border border-[#ead9d6] bg-white/38 dark:divide-[#4a303c] dark:border-[#4a303c] dark:bg-[#2a1b24]/70">
              {axisItems.map(([label, description]) => (
                <div key={label} className="grid grid-cols-[5.2rem_minmax(0,1fr)] gap-2 px-3 py-2.5">
                  <dt className="text-[12px] font-semibold leading-5 text-[#e6507a] dark:text-[#ff9aa8]">{label}</dt>
                  <dd className="break-keep text-[12px] leading-5 text-[#4d2635] dark:text-[#f1d9e2]">{description}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 border-t border-[#ead9d6] pt-3 break-keep text-[11px] leading-5 text-[#7a5360] dark:border-[#4a303c] dark:text-[#c8aeb8]">
              {isEnglish
                ? "These are not medical measurements. They are a care-priority summary organized from photo and survey signals."
                : "이 수치는 의료적 측정값이 아니라, 사진과 설문 신호를 종합해 정리한 관리 우선순위 요약입니다."}
            </p>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}

function FreeResultV2SkinRadarSummary({ data, locale = "ko", size = "compact", showLegend = false }) {
  const isEnglish = locale === "en";
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const metrics = getFreeResultV2SkinRadarMetrics(data, locale);
  const metricsWithStatus = metrics.map((metric) => ({
    ...metric,
    status: getFreeResultV2RadarStatus(metric, locale)
  }));
  const preferredSignalKeys = ["moisture", "oil", "pores"];
  const topSignals = preferredSignalKeys
    .map((key) => metricsWithStatus.find((metric) => metric.key === key))
    .filter(Boolean);
  const isLarge = size === "large";
  const radarCenter = isLarge ? { x: 94, y: 92 } : { x: 88, y: 88 };
  const radarRadius = isLarge ? 54 : 48;
  const currentPoints = getFreeResultV2PentagonPoints(metrics.map((metric) => metric.value), radarRadius, radarCenter);
  const balancePoints = getFreeResultV2PentagonPoints([62, 62, 62, 62, 62], radarRadius, radarCenter);
  const guideLevels = [25, 50, 75, 100];
  const labelPositions = isLarge
    ? [
        { x: 94, y: 13, anchor: "middle" },
        { x: 167, y: 82, anchor: "middle" },
        { x: 137, y: 161, anchor: "middle" },
        { x: 51, y: 161, anchor: "middle" },
        { x: 21, y: 82, anchor: "middle" }
      ]
    : [
        { x: 88, y: 14, anchor: "middle" },
        { x: 154, y: 84, anchor: "middle" },
        { x: 128, y: 164, anchor: "middle" },
        { x: 48, y: 164, anchor: "middle" },
        { x: 22, y: 84, anchor: "middle" }
      ];

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-[#3a1824] dark:text-[#fff8f3]">
          {isEnglish ? "Skin state summary" : "피부 상태 요약"}
        </p>
        <button
          type="button"
          onClick={() => setIsHelpOpen(true)}
          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#f2a4b6] bg-[#fff0f4]/74 text-[11px] font-semibold text-[#d9416f] shadow-[0_0_0_3px_rgba(230,80,122,0.07)] transition hover:border-[#e6507a] hover:bg-[#ffe5eb] hover:text-[#c93362] hover:shadow-[0_0_0_4px_rgba(230,80,122,0.12)] active:scale-95 dark:border-[#ff9aa8]/48 dark:bg-[#ff9aa8]/10 dark:text-[#ff9aa8] dark:shadow-[0_0_0_3px_rgba(255,154,168,0.055)] dark:hover:border-[#ff9aa8] dark:hover:bg-[#ff9aa8]/14 dark:hover:shadow-[0_0_0_4px_rgba(255,154,168,0.1)]"
          title={isEnglish ? "View skin state summary help." : "피부 상태 요약 설명 보기"}
          aria-label={isEnglish ? "Skin state summary help" : "피부 상태 요약 도움말"}
          aria-haspopup="dialog"
          aria-expanded={isHelpOpen}
        >
          i
        </button>
      </div>
      {showLegend ? (
        <p className="mx-auto mt-3 max-w-[17rem] break-keep text-center text-[13px] font-medium leading-6 text-[#5f3a48] dark:text-[#d8c2c9]">
          {isEnglish ? (
            <>
              <span className="font-semibold text-[#e6507a] dark:text-[#ff8fa2]">Dryness</span> is the strongest signal,
              <br />
              with <span className="font-semibold text-[#e6507a] dark:text-[#ff8fa2]">oil feel</span> and{" "}
              <span className="font-semibold text-[#e6507a] dark:text-[#ff8fa2]">pores</span> needing care too.
            </>
          ) : (
            <>
              <span className="font-semibold text-[#e6507a] dark:text-[#ff8fa2]">수분 부족</span> 신호가 가장 강하고,
              <br />
              <span className="font-semibold text-[#e6507a] dark:text-[#ff8fa2]">유분감</span>과{" "}
              <span className="font-semibold text-[#e6507a] dark:text-[#ff8fa2]">모공</span>도 함께 관리가 필요해요.
            </>
          )}
        </p>
      ) : null}
      <div className="mt-2 flex justify-center">
        <svg
          viewBox={isLarge ? "0 0 188 184" : "0 0 176 176"}
          className={`w-full ${isLarge ? "aspect-[188/184] max-w-[15.45rem]" : "aspect-square max-w-[10.9rem]"}`}
          role="img"
          aria-label={isEnglish
            ? "Pentagon skin parameter summary: moisture lack, oil feel, pore visibility, barrier burden, irritation response"
            : "오각 피부 파라미터 요약: 수분 부족, 유분감, 모공 가시성, 장벽 부담, 자극 반응"}
        >
          {guideLevels.map((level) => (
            <polygon
              key={level}
              points={getFreeResultV2PentagonPoints([level, level, level, level, level], radarRadius, radarCenter)}
              fill="none"
              stroke="currentColor"
              strokeWidth="0.7"
              className="text-[#cbb4bc] opacity-[0.38] dark:text-[#63505a] dark:opacity-[0.55]"
            />
          ))}
          {Array.from({ length: 5 }).map((_, index) => {
            const endPoint = getFreeResultV2PentagonPoint(100, index, radarRadius, radarCenter);
            return (
              <line
                key={index}
                x1={radarCenter.x}
                y1={radarCenter.y}
                x2={endPoint.x.toFixed(1)}
                y2={endPoint.y.toFixed(1)}
                stroke="currentColor"
                strokeWidth="0.7"
                className="text-[#cbb4bc] opacity-[0.34] dark:text-[#63505a] dark:opacity-[0.48]"
              />
            );
          })}
          <polygon
            points={balancePoints}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeDasharray="4 3"
            className="text-[#8f98a3] opacity-[0.42] dark:opacity-[0.46]"
          />
          <polygon points={currentPoints} fill="currentColor" className="text-[#e6507a] opacity-[0.28] dark:text-[#ff7f98] dark:opacity-[0.34]" />
          <polygon points={currentPoints} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" className="text-[#e6507a] dark:text-[#ff8fa2]" />
          {metrics.map((metric, index) => {
            const point = getFreeResultV2PentagonPoint(metric.value, index, radarRadius, radarCenter);
            return (
              <circle key={metric.key} cx={point.x.toFixed(1)} cy={point.y.toFixed(1)} r="3" fill="currentColor" className="text-[#e6507a] dark:text-[#ff8fa2]" />
            );
          })}
          {metrics.map((metric, index) => (
            <text
              key={metric.key}
              x={labelPositions[index].x}
              y={labelPositions[index].y}
              textAnchor={labelPositions[index].anchor}
              className={`fill-[#5f3a48] ${isLarge ? "text-[11px]" : "text-[10.5px]"} font-semibold dark:fill-[#d8c2c9]`}
            >
              {metric.label}
              {isLarge ? (
                <tspan
                  x={labelPositions[index].x}
                  dy="1.15em"
                  className="fill-[#9a6c78] text-[8.5px] font-medium dark:fill-[#b896a2]"
                >
                  {metricsWithStatus[index]?.status?.label}
                </tspan>
              ) : null}
            </text>
          ))}
        </svg>
      </div>
      {showLegend ? (
        <div className="mt-0.5">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[10.5px] text-[#8b6873] dark:text-[#b896a2]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-px w-5 rounded-full bg-[#e6507a] dark:bg-[#ff8fa2]" aria-hidden="true" />
              {isEnglish ? "My state" : "나의 상태"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-px w-5 border-t border-dashed border-[#8f98a3]" aria-hidden="true" />
              {isEnglish ? "Guide" : "관리 기준"}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {topSignals.map((metric) => (
              <span
                key={metric.key}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none shadow-none ${getFreeResultV2RadarChipClass(metric.status.tone)}`}
              >
                {metric.label}
                <span className="font-medium opacity-[0.82]">{metric.status.label}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}
      <FreeResultV2SkinRadarHelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} locale={locale} />
    </div>
  );
}

function FreeResultV2DiagnosisSummaryCard({ photoUrl, photoAlt, photoFallback, faceLabPreview = null, locale = "ko" }) {
  const hasFaceLab = Boolean(faceLabPreview);

  if (hasFaceLab) {
    return (
      <FreeResultV2FaceLabPhotoCarousel
        photoUrl={photoUrl}
        photoAlt={photoAlt}
        photoFallback={photoFallback}
        faceLabPreview={faceLabPreview}
        locale={locale}
      />
    );
  }

  return (
    <FreeResultV2Card className="p-4 sm:p-5">
      <div className="flex justify-center">
        <FreeResultV2PhotoFrame
          photoUrl={photoUrl}
          photoAlt={photoAlt}
          fallback={photoFallback}
          locale={locale}
          className="max-w-[14.2rem] min-h-[212px] sm:max-w-[16.2rem] sm:min-h-[243px]"
        />
      </div>
    </FreeResultV2Card>
  );
}

function FreeResultV2SkinRadarCard({ data, locale = "ko" }) {
  return (
    <FreeResultV2Card className="p-4 sm:p-5">
      <FreeResultV2SkinRadarSummary data={data} locale={locale} size="large" showLegend />
    </FreeResultV2Card>
  );
}

function FreeResultV2PriorityListCard({ priorities = [], locale = "ko" }) {
  const isEnglish = locale === "en";
  const displayPriorities = Array.isArray(priorities) ? priorities.slice(0, 3) : [];
  const [openRank, setOpenRank] = useState(displayPriorities[0]?.rank ?? null);

  if (!displayPriorities.length) {
    return null;
  }

  const getShortBody = (priority) => {
    const title = String(priority?.title || "");

    if (/oil|pore|유분|모공/i.test(title)) {
      return isEnglish ? "Start with light surface control." : "가벼운 표면 정돈부터 시작합니다.";
    }

    if (/moisture|hydration|수분/i.test(title)) {
      return isEnglish ? "Keep moisture from dropping too easily." : "수분감이 쉽게 떨어지지 않게 관리합니다.";
    }

    if (/barrier|장벽/i.test(title)) {
      return isEnglish ? "Keep the skin steady against outside irritation." : "외부 자극에 흔들리지 않게 지켜줍니다.";
    }

    if (/irritation|sensitivity|redness|자극|민감|붉/i.test(title)) {
      return isEnglish ? "Lower the irritation burden first." : "자극 부담을 먼저 낮춥니다.";
    }

    return priority?.body || (isEnglish ? "Check this step first." : "이 항목을 먼저 확인합니다.");
  };

  return (
    <FreeResultV2Card className="p-4 sm:p-5">
      <p className="break-keep text-[1.05rem] font-semibold leading-6 text-[#26101a] dark:text-[#fff8f3]">
        {isEnglish ? "Care Priority TOP 3" : "지금 관리 우선순위 TOP 3"}
      </p>
      <div className="mt-3 overflow-hidden rounded-[1.25rem] border border-[#ead9d6] bg-white/30 dark:border-[#5a3a48] dark:bg-[#2a1b24]">
        {displayPriorities.map((priority, index) => (
          <div key={priority.rank} className={index ? "border-t border-[#ead9d6] dark:border-[#5a3a48]" : ""}>
            <button
              type="button"
              onClick={() => setOpenRank((current) => (current === priority.rank ? null : priority.rank))}
              className="grid w-full grid-cols-[2.05rem_1.25rem_minmax(0,1fr)_1rem] items-center gap-2.5 px-3.5 py-2.5 text-left transition hover:bg-white/32 dark:hover:bg-[#301f28]/54"
              aria-expanded={openRank === priority.rank}
            >
              <span className="flex h-[1.7rem] w-[1.7rem] shrink-0 items-center justify-center rounded-full bg-[#ff7d9b] text-[13px] font-semibold text-white shadow-[0_10px_20px_rgba(230,80,122,0.18)] dark:bg-[#ff8fa2] dark:text-[#25131d]">
                {priority.rank}
              </span>
              <span className="flex h-6 w-6 items-center justify-center text-[#e6507a] dark:text-[#ff9aa8]">
                <FreeResultV2PriorityIcon rank={priority.rank} />
              </span>
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <p className="min-w-0 break-keep text-sm font-semibold leading-5 text-[#26101a] dark:text-[#fff8f3]">{priority.title}</p>
                {index === 0 ? (
                  <span className="rounded-full bg-[#ffe3e8] px-2 py-0.5 text-[11px] font-semibold text-[#d9416f] dark:bg-[#553043] dark:text-[#ff9aa8]">
                    {isEnglish ? "Core" : "핵심"}
                  </span>
                ) : null}
              </div>
              <span className={`text-sm leading-none text-[#b3949f] transition-transform dark:text-[#8f7480] ${openRank === priority.rank ? "rotate-90" : ""}`} aria-hidden="true">›</span>
            </button>
            <AnimatePresence initial={false}>
              {openRank === priority.rank ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="overflow-hidden"
                >
                  <p className="px-3.5 pb-3 pl-[4.85rem] pr-7 break-keep text-xs leading-5 text-[#7a5360] dark:text-[#c8aeb8]">
                    {getShortBody(priority)}
                  </p>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </FreeResultV2Card>
  );
}

export default function FreeResultV2DiagnosisStep({ data, photoUrl, photoAlt, photoFallback, faceLabPreview = null, locale = "ko" }) {
  const isEnglish = locale === "en";

  return (
    <FreeResultV2StepFrame
      title={isEnglish ? "Core Diagnosis" : "핵심 진단"}
    >
      <FreeResultV2DiagnosisSummaryCard
        photoUrl={photoUrl}
        photoAlt={photoAlt}
        photoFallback={photoFallback}
        faceLabPreview={faceLabPreview}
        locale={locale}
      />
      <FreeResultV2SkinRadarCard data={data} locale={locale} />
      <FreeResultV2PriorityListCard priorities={data.priorities} locale={locale} />
    </FreeResultV2StepFrame>
  );
}
