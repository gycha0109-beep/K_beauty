"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  FreeResultV2Card,
  FreeResultV2EvidenceSourceIcon,
  FreeResultV2StepFrame
} from "@/components/result/free-v2/FreeResultV2Primitives";

function isPhotoAnalysisLimited(photoSignals = []) {
  const signals = Array.isArray(photoSignals)
    ? photoSignals.map((signal) => String(signal || "").trim()).filter(Boolean)
    : [];
  const joined = signals.join(" ").toLowerCase();

  return (
    !signals.length ||
    joined.includes("photo cues were limited") ||
    joined.includes("limited photo") ||
    joined.includes("사진 신호는 제한") ||
    joined.includes("사진 상태") ||
    joined.includes("확정하기 어려") ||
    joined.includes("선명한 사진") ||
    joined.includes("분석 실패")
  );
}

function getPhotoAnalysisFailureCopy(locale = "ko") {
  return locale === "en"
    ? {
        photo: "Sorry, a clearer photo is needed.",
        signal: "Analysis failed",
        title: "Photo analysis was excluded",
        body: "The photo was blurry or partially covered,\nso we could not confirm enough skin details.\nWe analyzed mainly from your survey answers."
      }
    : {
        photo: "죄송합니다. 더 선명한 사진이 필요합니다.",
        signal: "분석 실패",
        title: "사진 분석은 제외되었어요",
        body: "사진이 흐리거나 가려져 있어\n피부 특징을 충분히 확인하지 못했습니다.\n설문 답변을 중심으로 분석했습니다."
      };
}

function FreeResultV2CameraExcludedIcon() {
  return (
    <div className="relative mx-auto h-14 w-20 sm:h-16 sm:w-24" aria-hidden="true">
      <div className="absolute left-1 top-4 h-9 w-16 rounded-xl border border-[#b79ad1]/45 bg-[linear-gradient(145deg,#8a6aa2_0%,#4c365b_62%,#2f243a_100%)] shadow-[inset_0_1px_5px_rgba(255,255,255,0.18),0_10px_18px_rgba(17,7,24,0.28)] sm:h-10 sm:w-20">
        <div className="absolute left-2.5 -top-2.5 h-3 w-5 rounded-t-md border border-[#b79ad1]/40 bg-[linear-gradient(145deg,#9f81b9,#5f4770)]" />
        <div className="absolute left-7 -top-3 h-4 w-8 rounded-t-lg border border-[#b79ad1]/40 bg-[linear-gradient(145deg,#9a7bb4,#5c456c)] sm:left-8 sm:w-10" />
        <div className="absolute right-2.5 top-2 h-2.5 w-4 rounded border border-[#251d2b]/70 bg-[#241b2c]" />
        <div className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#c7a8d8]/35 bg-[linear-gradient(145deg,#9777aa,#4d375d)] shadow-[inset_0_1px_5px_rgba(255,255,255,0.18)] sm:h-10 sm:w-10">
          <div className="h-5 w-5 rounded-full border border-[#17111e]/80 bg-[radial-gradient(circle_at_34%_30%,#a99df1_0%,#4a3a67_36%,#171321_74%)] sm:h-6 sm:w-6" />
        </div>
      </div>
      <div className="absolute right-1 top-8 flex h-8 w-8 items-center justify-center rounded-full border border-[#b79ad1]/45 bg-[linear-gradient(145deg,#9171a3,#584164)] shadow-[0_8px_14px_rgba(18,8,27,0.30)] sm:top-9 sm:h-9 sm:w-9">
        <span className="absolute h-1.5 w-5 rotate-45 rounded-full bg-[#f8edf7]" />
        <span className="absolute h-1.5 w-5 -rotate-45 rounded-full bg-[#f8edf7]" />
      </div>
      <span className="absolute right-2 top-1 h-4 w-1.5 rotate-[14deg] rounded-full bg-[#b79aff] shadow-[0_0_8px_rgba(183,154,255,0.44)]" />
      <span className="absolute -right-0.5 top-4 h-4 w-1.5 rotate-45 rounded-full bg-[#cbb8ff] shadow-[0_0_8px_rgba(203,184,255,0.44)]" />
      <span className="absolute -right-2 top-7 h-4 w-1.5 rotate-[84deg] rounded-full bg-[#d6c7ff] shadow-[0_0_8px_rgba(214,199,255,0.38)]" />
    </div>
  );
}

function FreeResultV2EvidencePhotoCallout({ title, body, tone = "pink", align = "left", isVisible = true, origin = "left", delay = 0 }) {
  const colorClass = tone === "blue"
    ? "border-[#9fb4ff]/60 bg-[#eef3ff]/90 text-[#465f9a] dark:border-[#9fb4ff]/40 dark:bg-[#2c2d45]/60 dark:text-[#d8e0ff]"
    : "border-[#ff9aa8]/60 bg-[#fff0f4]/90 text-[#9a3657] dark:border-[#ff9aa8]/40 dark:bg-[#3b2431]/60 dark:text-[#ffe4e8]";
  const hiddenX = origin === "left" ? 42 : -42;

  return (
    <motion.div
      className={`max-w-[5.4rem] sm:max-w-[6.75rem] ${align === "right" ? "text-left" : "text-right"}`}
      initial={false}
      animate={isVisible ? { opacity: 1, x: 0, y: 0, scale: 1, rotate: 0 } : { opacity: 0, x: hiddenX, y: 8, scale: 0.86, rotate: origin === "left" ? 4 : -4 }}
      transition={{
        type: "spring",
        stiffness: 430,
        damping: 23,
        mass: 0.8,
        delay
      }}
      style={{ pointerEvents: isVisible ? "auto" : "none" }}
      aria-hidden={!isVisible}
    >
      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none shadow-[0_0_16px_rgba(255,154,168,0.12)] ${colorClass}`}>
        {title}
      </span>
      <p className="mt-2 text-[10px] leading-4 text-[#664250] dark:text-[#c8aeb8]">{body}</p>
    </motion.div>
  );
}

function buildPhotoCalloutItems(photoSignals = [], locale = "ko") {
  const fallback = locale === "en" ? "Photo cues were limited" : "사진 신호는 제한적으로 확인됨";
  const signals = Array.isArray(photoSignals)
    ? photoSignals.map((signal) => String(signal || "").trim()).filter(Boolean)
    : [];
  const displaySignals = signals.length ? signals : [fallback];

  return displaySignals.slice(0, 3).map((signal, index) => ({
    key: `${signal}-${index}`,
    title: signal,
    body: getFreeResultV2EvidenceSignalNote(signal, "photo"),
    tone: index === 0 ? "blue" : "pink",
    origin: index === 0 ? "left" : "right",
    delay: 0.06 + index * 0.08
  }));
}

function FreeResultV2PhotoWireOverlay({ isVisible }) {
  return (
    <motion.svg
      className="pointer-events-none absolute inset-0 z-0 h-full w-full"
      viewBox="0 0 100 100"
      fill="none"
      initial={false}
      animate={isVisible ? { opacity: 1 } : { opacity: 0 }}
      transition={{ duration: 0.34, ease: "easeOut" }}
      aria-hidden={!isVisible}
    >
      <path d="M46 25 C39 25 32 24 24 23" stroke="#9fb4ff" strokeWidth="0.7" strokeLinecap="round" opacity="0.82" />
      <path d="M42 58 C35 56 29 55 22 55" stroke="#ff9aa8" strokeWidth="0.7" strokeLinecap="round" opacity="0.82" />
      <path d="M58 47 C66 45 73 42 82 39" stroke="#ffb199" strokeWidth="0.7" strokeLinecap="round" opacity="0.82" />
      <circle cx="46" cy="25" r="1.15" fill="#9fb4ff" opacity="0.9" />
      <circle cx="42" cy="58" r="1.15" fill="#ff9aa8" opacity="0.9" />
      <circle cx="58" cy="47" r="1.15" fill="#ffb199" opacity="0.9" />
      <circle cx="24" cy="23" r="1" fill="#9fb4ff" opacity="0.7" />
      <circle cx="22" cy="55" r="1" fill="#ff9aa8" opacity="0.7" />
      <circle cx="82" cy="39" r="1" fill="#ffb199" opacity="0.7" />
    </motion.svg>
  );
}

function FreeResultV2EvidencePhotoCard({ photoUrl, photoAlt, fallback, photoSignals = [], locale = "ko" }) {
  const isEnglish = locale === "en";
  const [isCalloutsOpen, setIsCalloutsOpen] = useState(false);
  const storageKey = "bejewely:free-result-v2:evidence-photo-callouts-open";
  const calloutItems = buildPhotoCalloutItems(photoSignals, locale);
  const isLimited = isPhotoAnalysisLimited(photoSignals);
  const failureCopy = getPhotoAnalysisFailureCopy(locale);
  const callouts = isEnglish
    ? {
        badge: "AI analysis view",
        reveal: "Tap to reveal",
        revealLabel: "Reveal photo analysis cues"
      }
    : {
        badge: "AI 분석 뷰",
        reveal: "눌러보세요!",
        revealLabel: "사진 분석 신호 보기",
        oil: ["T존 유분감", "이마와 코 주변 유분감 확인"],
        pores: ["모공 가시성", "볼 주변 모공이 보이는 편"],
        dry: ["수분감 저하", "볼 주변이 건조해 보임"]
      };
  const revealCallouts = () => {
    setIsCalloutsOpen(true);

    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem(storageKey, "true");
      } catch {
        // Ignore storage failures; the reveal still works for the current view.
      }
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      if (window.sessionStorage.getItem(storageKey) === "true") {
        setIsCalloutsOpen(true);
      }
    } catch {
      // Ignore storage failures; the default collapsed state is acceptable.
    }
  }, [storageKey]);

  return (
    <FreeResultV2Card className="overflow-hidden">
      <div className="relative">
        <span className="absolute left-0 top-0 z-20 rounded-full border border-[#e8c8d0] bg-white/80 px-3 py-1.5 text-[11px] font-semibold text-[#321724] backdrop-blur-sm dark:border-[#5a3a48] dark:bg-[#2a1b24]/75 dark:text-[#f3e4df]">
          {callouts.badge}
        </span>
        {isLimited ? (
          <div className="flex min-h-[16rem] items-center justify-center pt-8">
            <div className="relative mx-auto aspect-[4/5] w-full max-w-[13rem] overflow-hidden rounded-[1.6rem] border border-[#ead2cf] bg-white/68 dark:border-[#5a3a48] dark:bg-[#2a1b24]">
              {photoUrl ? (
                <img src={photoUrl} alt={photoAlt} className="h-full w-full object-cover object-center" />
              ) : (
                <div className="flex h-full items-center justify-center px-4 text-center text-xs leading-5 text-[#7a5360] dark:text-[#c8aeb8]">{fallback}</div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,rgba(36,23,32,0),rgba(36,23,32,0.82))] px-3 pb-3 pt-8 text-center">
                <p className="text-[12px] font-semibold leading-5 text-white">
                  {failureCopy.photo}
                </p>
              </div>
            </div>
          </div>
        ) : (
        <div className="relative grid min-h-[16rem] grid-cols-[minmax(4.7rem,1fr)_minmax(9rem,10.75rem)_minmax(4.7rem,1fr)] items-center gap-1.5 pt-8 sm:grid-cols-[minmax(3.6rem,0.8fr)_minmax(7.4rem,1.7fr)_minmax(3.6rem,0.8fr)] sm:gap-2">
          <FreeResultV2PhotoWireOverlay isVisible={isCalloutsOpen} />
          <div className="relative z-10 flex h-full items-center justify-end">
            {calloutItems[0] ? (
              <FreeResultV2EvidencePhotoCallout
                title={calloutItems[0].title}
                body={calloutItems[0].body}
                tone={calloutItems[0].tone}
                isVisible={isCalloutsOpen}
                origin={calloutItems[0].origin}
                delay={isCalloutsOpen ? calloutItems[0].delay : 0}
              />
            ) : null}
          </div>
          <button
            type="button"
            onClick={revealCallouts}
            className="relative z-10 mx-auto block aspect-[4/5] w-full max-w-[10.75rem] overflow-hidden rounded-[1.6rem] border border-[#ead2cf] bg-white/68 p-0 text-left outline-none transition hover:border-[#ff9aa8]/52 focus-visible:ring-2 focus-visible:ring-[#ff9aa8]/70 dark:border-[#5a3a48] dark:bg-[#2a1b24] sm:max-w-[13rem]"
            aria-label={callouts.revealLabel}
            aria-expanded={isCalloutsOpen}
          >
            {photoUrl ? (
              <img src={photoUrl} alt={photoAlt} className="h-full w-full object-cover object-center" />
            ) : (
              <div className="flex h-full items-center justify-center px-4 text-center text-xs leading-5 text-[#7a5360] dark:text-[#c8aeb8]">{fallback}</div>
            )}
            <AnimatePresence>
              {!isCalloutsOpen ? (
                <motion.div
                  className="pointer-events-none absolute inset-0 z-10 flex items-end justify-center bg-[linear-gradient(180deg,transparent_46%,rgba(26,13,21,0.42)_100%)] p-3"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.22 }}
                >
                  <motion.span
                    className="inline-flex items-center rounded-full border border-white/44 bg-[#241720]/78 px-3 py-1.5 text-[11px] font-semibold text-[#fff8f3] shadow-[0_12px_30px_rgba(20,10,16,0.28)] backdrop-blur-sm"
                    animate={{ y: [0, -4, 0], scale: [1, 1.04, 1] }}
                    transition={{ duration: 1.35, repeat: Infinity, ease: "easeInOut" }}
                  >
                    {callouts.reveal}
                  </motion.span>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </button>
          <div className="relative z-10 flex h-full flex-col justify-center gap-8">
            {calloutItems.slice(1).map((item) => (
              <FreeResultV2EvidencePhotoCallout
                key={item.key}
                title={item.title}
                body={item.body}
                align="right"
                isVisible={isCalloutsOpen}
                origin={item.origin}
                delay={isCalloutsOpen ? item.delay : 0}
              />
            ))}
          </div>
        </div>
        )}
      </div>
    </FreeResultV2Card>
  );
}

function FreeResultV2EvidenceSignalGroup({ title, signals = [], tone = "photo" }) {
  const isSurvey = tone === "survey";
  const dotClass = isSurvey ? "bg-[#9aaeff]" : "bg-[#e6507a] dark:bg-[#ff9aa8]";
  const iconBg = isSurvey
    ? "border-[#9aaeff]/30 bg-[#9aaeff]/14 text-[#b8c4ff]"
    : "border-[#ff9aa8]/32 bg-[#ff9aa8]/14 text-[#ff9aa8]";

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${iconBg}`}>
          <FreeResultV2EvidenceSourceIcon tone={tone} />
        </span>
        <p className={`text-sm font-semibold ${isSurvey ? "text-[#6f5ca8] dark:text-[#b8c4ff]" : "text-[#e6507a] dark:text-[#ff9aa8]"}`}>
          {title}
        </p>
      </div>
      <ul className="mt-4 space-y-3">
        {signals.map((signal, index) => (
          <li key={`${title}-${signal}-${index}`} className="flex items-start gap-2.5">
            <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
            <span className="min-w-0">
              <span className="block text-sm font-semibold leading-6 text-[#3a1824] dark:text-[#f3e4df]">{signal}</span>
              <span className="block text-xs leading-5 text-[#8b6370] dark:text-[#c8aeb8]">{getFreeResultV2EvidenceSignalNote(signal, tone)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function getFreeResultV2EvidenceSignalNote(signal = "", tone = "photo") {
  const text = String(signal || "");

  if (tone === "survey") {
    if (/oil|유분/.test(text)) {
      return /[ㄱ-ㅎ가-힣]/.test(text) ? "유분이 쉽게 올라와요" : "Oil comes up easily";
    }
    if (/dry|건조|dehyd|tight/.test(text)) {
      return /[ㄱ-ㅎ가-힣]/.test(text) ? "속당김이 자주 느껴져요" : "Tightness is felt often";
    }
    if (/pore|모공/.test(text)) {
      return /[ㄱ-ㅎ가-힣]/.test(text) ? "모공이 눈에 띄어요" : "Pores stand out";
    }
    return /[ㄱ-ㅎ가-힣]/.test(text) ? "설문 답변에서 확인됨" : "Confirmed in survey answers";
  }

  if (/T존|T-zone|oil|유분/.test(text)) {
    return /[ㄱ-ㅎ가-힣]/.test(text) ? "이마와 코 주변 번들거림" : "Shine around forehead and nose";
  }
  if (/pore|모공/.test(text)) {
    return /[ㄱ-ㅎ가-힣]/.test(text) ? "볼 주변 모공이 도드라짐" : "Pore texture around cheeks";
  }
  if (/dry|건조|수분|moisture/.test(text)) {
    return /[ㄱ-ㅎ가-힣]/.test(text) ? "볼 주변이 건조해 보임" : "Cheek area looks dry";
  }

  return /[ㄱ-ㅎ가-힣]/.test(text) ? "사진에서 확인된 신호" : "Visible cue in the photo";
}

function FreeResultV2EvidenceSignalFace({ source, isActive, locale = "ko" }) {
  const failureCopy = getPhotoAnalysisFailureCopy(locale);

  return (
    <div
      className={`col-start-1 row-start-1 min-w-0 rounded-[1.35rem] border border-[#ead9d6] bg-white/28 p-4 dark:border-[#5a3a48] dark:bg-[#2a1b24]/66 ${source.analysisFailed ? "flex min-h-[11rem] items-center justify-center" : ""} ${isActive ? "" : "pointer-events-none"}`}
      style={{
        backfaceVisibility: "hidden",
        transform: source.key === "survey" ? "rotateY(180deg)" : "rotateY(0deg)"
      }}
      aria-hidden={!isActive}
    >
      {source.analysisFailed ? (
        <div className="w-full text-center">
          <FreeResultV2CameraExcludedIcon />
          <h3 className="mt-2 text-[1rem] font-extrabold leading-tight tracking-tight text-[#2b1420] dark:text-[#fff8f3] sm:text-[1.08rem]">
            {failureCopy.title}
          </h3>
          <p className="mx-auto mt-1.5 max-w-[18rem] whitespace-pre-line break-keep text-[0.72rem] font-semibold leading-4 text-[#8b6370] dark:text-[#c8aeb8] sm:text-[0.78rem]">
            {failureCopy.body}
          </p>
        </div>
      ) : (
        <FreeResultV2EvidenceSignalGroup title={source.title} signals={source.signals} tone={source.key} />
      )}
    </div>
  );
}

function FreeResultV2EvidenceSignalsCard({ photoSignals = [], surveySignals = [], locale = "ko" }) {
  const isEnglish = locale === "en";
  const [activeSource, setActiveSource] = useState("photo");
  const photoAnalysisLimited = isPhotoAnalysisLimited(photoSignals);
  const sources = [
    {
      key: "photo",
      tabLabel: isEnglish ? "Photo" : "사진 신호",
      title: isEnglish ? "Photo cues" : "사진에서 보인 신호",
      signals: photoSignals,
      analysisFailed: photoAnalysisLimited
    },
    {
      key: "survey",
      tabLabel: isEnglish ? "Survey" : "설문 신호",
      title: isEnglish ? "Survey overlap" : "설문에서 겹친 신호",
      signals: surveySignals
    }
  ];
  const activeSourceData = sources.find((source) => source.key === activeSource) || sources[0];
  const nextSourceData = activeSource === "photo" ? sources[1] : sources[0];
  const setSignalSource = (sourceKey) => {
    setActiveSource(sourceKey);
  };
  const toggleSignalSource = () => {
    setActiveSource((current) => (current === "photo" ? "survey" : "photo"));
  };
  const handleFlipKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleSignalSource();
    }
  };

  return (
    <FreeResultV2Card>
      <p className="text-[13px] font-semibold text-[#e6507a] dark:text-[#ff9aa8]">
        {isEnglish ? "Signals used for the decision" : "판단에 사용한 신호"}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2 rounded-[1.15rem] border border-[#ead9d6] bg-white/28 p-1 dark:border-[#5a3a48] dark:bg-[#2a1b24]/66">
        {sources.map((source) => {
          const isActive = source.key === activeSourceData.key;

          return (
            <button
              key={source.key}
              type="button"
              onClick={() => setSignalSource(source.key)}
              className={`inline-flex min-h-[2.65rem] items-center justify-center gap-2 rounded-[0.95rem] px-3 py-2 text-sm font-semibold transition ${
                isActive
                  ? "bg-[linear-gradient(135deg,#f45f88,#ff7b68)] text-white shadow-[0_14px_28px_rgba(230,80,122,0.22)]"
                  : "text-[#7a5360] hover:bg-white/40 dark:text-[#c8aeb8] dark:hover:bg-[#301f28]"
              }`}
              aria-pressed={isActive}
            >
              <FreeResultV2EvidenceSourceIcon tone={source.key} className="h-4 w-4" />
              {source.tabLabel}
            </button>
          );
        })}
      </div>

      <div
        className="mt-4 cursor-pointer outline-none"
        role="button"
        tabIndex={0}
        onClick={toggleSignalSource}
        onKeyDown={handleFlipKeyDown}
        aria-label={isEnglish ? `Show ${nextSourceData.tabLabel}` : `${nextSourceData.tabLabel} 보기`}
        style={{ perspective: 1200 }}
      >
        <motion.div
          className="grid"
          animate={{ rotateY: activeSourceData.key === "survey" ? 180 : 0 }}
          transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformStyle: "preserve-3d" }}
          whileTap={{ scale: 0.985 }}
        >
          {sources.map((source) => (
            <FreeResultV2EvidenceSignalFace
              key={source.key}
              source={source}
              isActive={source.key === activeSourceData.key}
              locale={locale}
            />
          ))}
        </motion.div>
      </div>
    </FreeResultV2Card>
  );
}

function FreeResultV2EvidenceBridge({ locale = "ko" }) {
  const isEnglish = locale === "en";

  return (
    <div className="relative overflow-hidden rounded-[1.35rem] border border-[#ead9d6]/55 bg-[linear-gradient(135deg,rgba(255,253,251,0.62),rgba(255,250,248,0.48))] px-4 py-2 shadow-none dark:border-[rgba(255,154,168,0.18)] dark:bg-[linear-gradient(135deg,rgba(244,95,136,0.13),rgba(166,122,255,0.075))] dark:shadow-[0_0_28px_rgba(244,95,136,0.055)]">
      <div className="flex min-h-12 items-center gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#ff9aa8]/24 bg-white/34 text-[#e6507a] dark:border-[#ff9aa8]/20 dark:bg-white/[0.04] dark:text-[#ff9aa8]">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
            <path d="M12 3.8 13.6 8.4 18.2 10 13.6 11.6 12 16.2 10.4 11.6 5.8 10 10.4 8.4 12 3.8Z" fill="currentColor" opacity="0.9" />
            <path d="M18 14.5 18.7 16.3 20.5 17 18.7 17.7 18 19.5 17.3 17.7 15.5 17 17.3 16.3 18 14.5Z" fill="currentColor" opacity="0.58" />
          </svg>
        </span>
        <p className="min-w-0 break-keep text-left text-[13px] font-semibold leading-5 text-[#4d2635] dark:text-[#f1d9e2]">
          {isEnglish
            ? "Based on this analysis, we organized the best-fit product and how to use it."
            : "이 분석을 바탕으로 가장 적합한 제품과 활용 방법을 정리했습니다."}
        </p>
      </div>
    </div>
  );
}

export default function FreeResultV2EvidenceStep({ evidence, photoUrl, photoAlt, photoFallback, locale = "ko" }) {
  const isEnglish = locale === "en";

  return (
    <FreeResultV2StepFrame
      eyebrow={isEnglish ? "Diagnosis evidence" : "진단 근거"}
      title={isEnglish ? "Why this diagnosis?" : "왜 이렇게 판단했을까?"}
      body={isEnglish ? "We used photo analysis and survey answers together." : "사진 분석과 설문 답변을 함께 참고했습니다."}
    >
      <FreeResultV2EvidencePhotoCard
        photoUrl={photoUrl}
        photoAlt={photoAlt}
        fallback={photoFallback}
        photoSignals={evidence.photoSignals}
        locale={locale}
      />

      <FreeResultV2EvidenceSignalsCard
        photoSignals={evidence.photoSignals}
        surveySignals={evidence.surveySignals}
        locale={locale}
      />

      <FreeResultV2EvidenceBridge locale={locale} />
    </FreeResultV2StepFrame>
  );
}
