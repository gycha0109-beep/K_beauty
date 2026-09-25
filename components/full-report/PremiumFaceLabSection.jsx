"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildUnavailablePremiumFaceLab, sanitizePremiumFaceLabSummary } from "@/lib/premium-face-lab";
import { buildFaceLabV2Canonical } from "@/lib/face-lab-v2/canonical-composer";
import FaceLabV2Result from "@/components/full-report/face-lab/FaceLabV2Result";
import { getBrowserSupabaseAccessToken } from "@/lib/supabase/browser-client";
import { getTargetStyleLabel } from "@/lib/face-lab-v2/target-style-registry";
import {
  TARGET_FINDER_ROUNDS,
  buildTargetFinderResult,
  getTargetFinderRound
} from "@/lib/face-lab-v2/target-finder";

const TARGET_KEYS = [
  "natural",
  "clear_soft",
  "soft",
  "cute_playful",
  "sophisticated",
  "chic",
  "mature_calm",
  "defined",
  "minimal",
  "statement_glam",
  "classic",
  "trendy"
];


const COPY = {
  ko: {
    title: "Face Lab",
    legacyBody: "업로드한 사진에서 읽힌 인상과 표현 방향이에요.",
    fallbackTitle: "사진 기반 Face Lab 결과가 준비되지 않았어요.",
    fallbackBody: "다음 분석에서는 사진을 함께 등록하면 인상과 표현 방향도 확인할 수 있어요.",
    imageAlt: "Face Lab 분석 이미지",
    keywords: "키워드",
    directions: "표현 방향",
    companion: "피부 관리 방향과 함께 참고할 수 있는 표현 언어예요.",
    introTitle: "추구미부터 정해볼까요?",
    introBody: "현재 얼굴을 다시 분석하지 않고, 원하는 분위기와 바꿀 수 있는 범위를 더하면 여러 스타일 경로를 비교할 수 있습니다.",
    modeTitle: "원하는 스타일이 이미 있으신가요?",
    known: "명확해요",
    partial: "대충 있어요",
    unknown: "잘 모르겠어요",
    targetTitle: "어떤 분위기에 가장 끌리시나요?",
    targetBody: "최대 2개까지 고르세요.",
    partialClarifierTitle: "조금 더 가까운 쪽을 알려주세요",
    softSide: "부드러운 쪽",
    sharpSide: "또렷한 쪽",
    naturalSide: "힘 뺀 쪽",
    polishedSide: "정돈된 쪽",
    middleSide: "중간 / 상관없음",
    finderTitle: "내 추구미 찾아보기",
    finderBody: "두 방향 중 더 끌리는 쪽을 골라주세요.",
    finderInconclusive: "선택만으로 한 방향을 정하기 어려웠습니다. 아래 목록에서 지금 가장 끌리는 분위기를 직접 골라주세요.",
    both: "둘 다 좋아요",
    neither: "둘 다 별로예요",
    finderProgress: (index) => `${index + 1}/${TARGET_FINDER_ROUNDS.length}`,
    setupTitle: "어디까지 바꿔보고 싶으세요?",
    presentationTitle: "어떤 스타일 예시가 더 편한가요?",
    masculine: "남성 스타일 중심",
    feminine: "여성 스타일 중심",
    neutral: "중성 / 상관없음",
    scopeTitle: "관심 있는 영역",
    changeTitle: "변화 강도",
    minimal: "거의 유지",
    light: "조금 바꾸기",
    moderate: "꽤 바꾸기",
    high: "새로운 느낌도 가능",
    constraintsTitle: "현실적인 조건",
    makeupIntensity: "메이크업 강도",
    makeupLight: "가볍게",
    makeupMedium: "보통",
    makeupExpressive: "적극적으로",
    dailyMinutes: "하루 스타일링 시간",
    minutes5: "5분 내",
    minutes15: "15분 내",
    minutes30: "30분 이상도 가능",
    budgetTitle: "스타일링 예산",
    budgetLow: "최소 비용",
    budgetStandard: "보통",
    budgetFlexible: "필요하면 투자",
    maintenanceTitle: "유지 관리 부담",
    maintenanceLow: "최소화",
    maintenanceMedium: "보통",
    maintenanceHigh: "관리 가능",
    reviewTitle: "이 방향으로 Face Lab을 만들까요?",
    confirm: "이대로 결과 보기",
    edit: "추구미 수정",
    next: "다음",
    back: "이전",
    currentTitle: "지금의 나",
    targetResultTitle: "나의 추구미",
    deltaTitle: "가장 영향이 큰 변화",
    routesTitle: "가능한 스타일 경로",
    routeMeta: "변화 {change} · 매일 {effort} · 유지 {maintenance}",
    executionTitle: "선택한 경로 실행안",
    hairTitle: "Hair",
    groomingTitle: "Grooming",
    makeupTitle: "Makeup",
    colorTitle: "Color",
    eyewearTitle: "Eyewear",
    accessoriesTitle: "Accessories",
    lookTitle: "완성 조합",
    conflictTitle: "서로 부딪힐 수 있는 포인트",
    productSpecTitle: "필요한 색조 제품 속성",
    archetypeFunTitle: "재미로 보는 아키타입 믹스",
    noDomain: "이 경로에서는 별도 변화가 없습니다.",
    restart: "처음부터 다시",
    targetFinderResult: "선택을 기준으로 추린 추구미",
    scope: {
      hair: "헤어",
      brow_grooming: "눈썹 / 그루밍",
      makeup: "메이크업",
      color: "컬러",
      eyewear: "안경",
      accessories: "액세서리",
      facial_hair: "수염"
    },
    routeLevel: {
      low: "낮음",
      medium: "중간",
      high: "큼",
      standard: "보통",
      higher: "높음",
      easy: "쉬움",
      moderate: "중간",
      difficult: "어려움",
      mixed: "혼합"
    }
  },
  en: {
    title: "Face Lab",
    legacyBody: "Impression and style direction read from the uploaded photo.",
    fallbackTitle: "Photo-based Face Lab results are not ready.",
    fallbackBody: "Add a photo in your next analysis to unlock Face Lab.",
    imageAlt: "Face Lab analysis image",
    keywords: "Keywords",
    directions: "Style directions",
    companion: "Use this as expression language alongside the skin-care direction.",
    introTitle: "Set your target look",
    introBody: "Keep the existing face analysis and add your preferred direction and practical constraints to compare styling routes.",
    modeTitle: "Do you already know the look you want?",
    known: "Yes, clearly",
    partial: "Roughly",
    unknown: "Not yet",
    targetTitle: "Which directions appeal to you most?",
    targetBody: "Choose up to two.",
    partialClarifierTitle: "Which side feels a little closer?",
    softSide: "Softer",
    sharpSide: "Sharper",
    naturalSide: "More natural",
    polishedSide: "More polished",
    middleSide: "Middle / no preference",
    finderTitle: "Find my target look",
    finderBody: "Choose the direction you prefer in each pair.",
    finderInconclusive: "Your choices did not resolve to a clear direction. Pick the style that feels closest from the list below.",
    both: "Both",
    neither: "Neither",
    finderProgress: (index) => `${index + 1}/${TARGET_FINDER_ROUNDS.length}`,
    setupTitle: "What are you willing to change?",
    presentationTitle: "Which examples feel more relevant?",
    masculine: "Masculine examples",
    feminine: "Feminine examples",
    neutral: "Neutral / no preference",
    scopeTitle: "Styling areas",
    changeTitle: "Change level",
    minimal: "Keep it close",
    light: "Small change",
    moderate: "Noticeable change",
    high: "Open to a new direction",
    constraintsTitle: "Practical limits",
    makeupIntensity: "Makeup intensity",
    makeupLight: "Light",
    makeupMedium: "Medium",
    makeupExpressive: "Expressive",
    dailyMinutes: "Daily styling time",
    minutes5: "Up to 5 min",
    minutes15: "Up to 15 min",
    minutes30: "30+ min is okay",
    budgetTitle: "Styling budget",
    budgetLow: "Keep cost low",
    budgetStandard: "Standard",
    budgetFlexible: "Flexible",
    maintenanceTitle: "Maintenance tolerance",
    maintenanceLow: "Keep it low",
    maintenanceMedium: "Medium",
    maintenanceHigh: "High is okay",
    reviewTitle: "Build Face Lab with this target?",
    confirm: "View my result",
    edit: "Edit target",
    next: "Next",
    back: "Back",
    currentTitle: "Current face profile",
    targetResultTitle: "Target style",
    deltaTitle: "Highest-impact changes",
    routesTitle: "Styling routes",
    routeMeta: "Change {change} · Daily {effort} · Maintenance {maintenance}",
    executionTitle: "Selected route",
    hairTitle: "Hair",
    groomingTitle: "Grooming",
    makeupTitle: "Makeup",
    colorTitle: "Color",
    eyewearTitle: "Eyewear",
    accessoriesTitle: "Accessories",
    lookTitle: "Complete look",
    conflictTitle: "Potential conflicts",
    productSpecTitle: "Makeup product attributes",
    archetypeFunTitle: "Archetype mix for fun",
    noDomain: "No separate change in this route.",
    restart: "Start over",
    targetFinderResult: "Target directions from your choices",
    scope: {
      hair: "Hair",
      brow_grooming: "Brows / grooming",
      makeup: "Makeup",
      color: "Color",
      eyewear: "Eyewear",
      accessories: "Accessories",
      facial_hair: "Facial hair"
    },
    routeLevel: {
      low: "Low",
      medium: "Medium",
      high: "High",
      standard: "Standard",
      higher: "Higher",
      easy: "Easy",
      moderate: "Medium",
      difficult: "Difficult",
      mixed: "Mixed"
    }
  }
};

function getCopy(locale) {
  return locale === "en" ? COPY.en : COPY.ko;
}

function defaultScopes(presentationPreference) {
  if (presentationPreference === "masculine_examples") {
    return ["hair", "brow_grooming", "eyewear"];
  }
  if (presentationPreference === "feminine_examples") {
    return ["hair", "brow_grooming", "makeup", "color"];
  }
  return [];
}

function FaceLabImage({ src, alt, locale = "ko" }) {
  const copy = getCopy(locale);
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="flex aspect-[4/5] w-full items-center justify-center rounded-[0.5rem] border border-zinc-200 bg-zinc-50 px-4 text-center text-xs font-medium leading-5 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400">
        {copy.fallbackTitle}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt || copy.imageAlt}
      onError={() => setFailed(true)}
      className="aspect-[4/5] w-full rounded-[0.5rem] object-cover object-center"
    />
  );
}

function ChoiceButton({ active, onClick, children, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
        active
          ? "ui-choice-active"
          : "ui-button-secondary"
      } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
    >
      {children}
    </button>
  );
}

function LegacyFaceLab({ faceLabSummary, photoUrl, locale }) {
  const copy = getCopy(locale);
  const summary = sanitizePremiumFaceLabSummary(
    faceLabSummary || buildUnavailablePremiumFaceLab(photoUrl, copy.imageAlt)
  );
  const imageUrl = summary.imageUrl || photoUrl || null;

  if (summary.status !== "available") {
    return (
      <section className="space-y-4">
        <section className="ui-card p-5 sm:p-6">
          <p className="ui-kicker">FACE LAB</p>
          <h2 className="ui-title mt-2 text-xl leading-tight">{copy.title}</h2>
          <p className="ui-text-secondary mt-2 text-sm leading-6">{copy.legacyBody}</p>
        </section>
        <section className="ui-card-subtle p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-[140px_1fr] sm:items-center">
            <FaceLabImage src={imageUrl} alt={summary.imageAlt || copy.imageAlt} locale={locale} />
            <div className="min-w-0">
              <h3 className="ui-title text-lg leading-tight break-words">{copy.fallbackTitle}</h3>
              <p className="ui-text-secondary mt-2 text-sm leading-6 break-words">{copy.fallbackBody}</p>
            </div>
          </div>
        </section>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <section className="ui-card p-5 sm:p-6">
        <p className="ui-kicker">FACE LAB</p>
        <h2 className="ui-title mt-2 text-xl leading-tight">{copy.title}</h2>
        <p className="ui-text-secondary mt-2 text-sm leading-6">{copy.legacyBody}</p>
      </section>
      <section className="ui-card-subtle p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-[150px_1fr]">
          <FaceLabImage src={imageUrl} alt={summary.imageAlt || copy.imageAlt} locale={locale} />
          <div className="min-w-0">
            <p className="ui-kicker">{copy.companion}</p>
            <h3 className="ui-title mt-2 text-xl leading-tight break-words">{summary.impressionTitle || copy.title}</h3>
            {summary.impressionSummary ? <p className="ui-text-secondary mt-2 text-sm leading-6 break-words">{summary.impressionSummary}</p> : null}
            {summary.keywords.length ? (
              <div className="mt-4">
                <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">{copy.keywords}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {summary.keywords.map((keyword) => <span key={keyword} className="ui-chip-compact max-w-full px-3 py-1.5 break-words">{keyword}</span>)}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>
      {summary.styleDirections.length ? (
        <section className="ui-card-subtle p-5 sm:p-6">
          <p className="ui-kicker">{copy.directions}</p>
          <div className="mt-3 grid gap-3">
            {summary.styleDirections.map((item) => (
              <article key={item.key} className="rounded-[0.5rem] border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-950/35">
                <h4 className="text-sm font-semibold leading-6 text-zinc-900 break-words dark:text-zinc-100">{item.title}</h4>
                <p className="mt-1 text-sm leading-6 text-zinc-700 break-words dark:text-zinc-300">{item.summary}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
      {summary.caution ? (
        <p className="rounded-[0.5rem] border border-zinc-200 bg-zinc-50/80 px-3 py-3 text-xs font-medium leading-5 text-zinc-600 break-words dark:border-zinc-800 dark:bg-zinc-950/35 dark:text-zinc-300">{summary.caution}</p>
      ) : null}
    </section>
  );
}

function TargetFinder({ locale, onComplete, onBack }) {
  const copy = getCopy(locale);
  const [roundIndex, setRoundIndex] = useState(0);
  const [choices, setChoices] = useState([]);
  const round = getTargetFinderRound(roundIndex, locale);

  if (!round) {
    return null;
  }

  const choose = (choice) => {
    const nextChoices = [
      ...choices,
      {
        roundId: round.roundId,
        choice
      }
    ];

    if (roundIndex + 1 < TARGET_FINDER_ROUNDS.length) {
      setChoices(nextChoices);
      setRoundIndex((value) => value + 1);
      return;
    }

    onComplete(buildTargetFinderResult(nextChoices));
  };

  const candidates = [round.candidateA, round.candidateB];

  return (
    <section className="ui-card p-5 sm:p-6">
      <p className="ui-kicker">{copy.finderProgress(roundIndex)}</p>
      <h3 className="ui-title mt-2 text-xl">{copy.finderTitle}</h3>
      <p className="ui-text-secondary mt-2 text-sm leading-6">{copy.finderBody}</p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {candidates.map((candidate, index) => (
          <button
            key={candidate.candidateId}
            type="button"
            onClick={() => choose(index === 0 ? "a" : "b")}
            className="ui-card-subtle min-h-40 p-4 text-left transition hover:-translate-y-0.5"
            data-reference-asset-key={candidate.referenceAssetKey}
          >
            <div className={`min-h-28 rounded-xl p-3 ${
              index === 0
                ? "bg-gradient-to-br from-zinc-100 to-rose-100 dark:from-zinc-800 dark:to-rose-950"
                : "bg-gradient-to-br from-zinc-100 to-violet-100 dark:from-zinc-800 dark:to-violet-950"
            }`}>
              <div className="flex h-full flex-col justify-end gap-1.5">
                {(candidate.reference?.cues || []).map((cue) => (
                  <span
                    key={cue}
                    className="w-fit rounded-full bg-white/75 px-2 py-1 text-[10px] font-semibold text-zinc-700 shadow-sm dark:bg-zinc-950/55 dark:text-zinc-200"
                  >
                    {cue}
                  </span>
                ))}
              </div>
            </div>
            <p className="mt-3 text-sm font-semibold">
              {getTargetStyleLabel(candidate.targetKey, locale)}
            </p>
          </button>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <ChoiceButton onClick={() => choose("both")}>{copy.both}</ChoiceButton>
        <ChoiceButton onClick={() => choose("neither")}>{copy.neither}</ChoiceButton>
      </div>
      <button type="button" onClick={onBack} className="mt-4 text-sm font-semibold text-zinc-500">
        {copy.back}
      </button>
    </section>
  );
}

function TargetSelection({ locale, selected, onChange }) {
  const copy = getCopy(locale);

  const toggle = (key) => {
    if (selected.includes(key)) {
      onChange(selected.filter((item) => item !== key));
      return;
    }
    if (selected.length >= 2) return;
    onChange([...selected, key]);
  };

  return (
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {TARGET_KEYS.map((key) => (
        <ChoiceButton
          key={key}
          active={selected.includes(key)}
          disabled={!selected.includes(key) && selected.length >= 2}
          onClick={() => toggle(key)}
        >
          {getTargetStyleLabel(key, locale)}
        </ChoiceButton>
      ))}
    </div>
  );
}

function persistenceFingerprint(value) {
  if (!value?.surveyAnswers) return null;

  return JSON.stringify({
    surveyAnswers: value.surveyAnswers,
    targetFinderResult: value.targetFinderResult || null,
    selectedRouteId: value.selectedRouteId || null
  });
}

export default function PremiumFaceLabSection({
  faceLabSummary,
  faceLabAnalysis = null,
  photoUrl = "",
  locale = "ko",
  resultKey = "current",
  savedReportId = null
}) {
  const copy = getCopy(locale);
  const storageKey = useMemo(() => `bejewely:face-lab-v2:${resultKey}`, [resultKey]);
  const [stage, setStage] = useState("mode");
  const [entryMode, setEntryMode] = useState(null);
  const [targets, setTargets] = useState([]);
  const [softSharpClarifier, setSoftSharpClarifier] = useState(null);
  const [naturalPolishedClarifier, setNaturalPolishedClarifier] = useState(null);
  const [finderResult, setFinderResult] = useState(null);
  const [finderInconclusive, setFinderInconclusive] = useState(false);
  const [presentationPreference, setPresentationPreference] = useState("neutral_examples");
  const [stylingScope, setStylingScope] = useState([]);
  const [scopeTouched, setScopeTouched] = useState(false);
  const [changeTolerance, setChangeTolerance] = useState("light");
  const [makeupIntensity, setMakeupIntensity] = useState("light");
  const [dailyMinutes, setDailyMinutes] = useState(15);
  const [budgetBand, setBudgetBand] = useState("standard");
  const [maintenanceTolerance, setMaintenanceTolerance] = useState("medium");
  const [canonical, setCanonical] = useState(null);
  const persistQueueRef = useRef(Promise.resolve());
  const restoreInteractionRef = useRef(0);

  useEffect(() => {
    if (!faceLabAnalysis || typeof window === "undefined") return;

    let active = true;
    const restoreInteractionRevision = restoreInteractionRef.current;

    const restoreState = (stored) => {
      if (
        !active ||
        restoreInteractionRef.current !== restoreInteractionRevision ||
        !stored?.surveyAnswers
      ) {
        return false;
      }

      const restored = buildFaceLabV2Canonical({
        analysis: faceLabAnalysis,
        surveyAnswers: stored.surveyAnswers,
        targetFinderResult: stored.targetFinderResult || null,
        selectedRouteId: stored.selectedRouteId || null,
        locale,
        resultId: resultKey
      });

      if (restored?.targetStyle?.status !== "available") return false;

      setCanonical(restored);
      setEntryMode(stored.surveyAnswers.entryMode || "known");
      setTargets(
        stored.surveyAnswers.targetSelections?.length
          ? stored.surveyAnswers.targetSelections
          : stored.targetFinderResult?.candidateLabels || []
      );
      setSoftSharpClarifier(stored.surveyAnswers.clarifiers?.softSharp || null);
      setNaturalPolishedClarifier(stored.surveyAnswers.clarifiers?.naturalPolished || null);
      setPresentationPreference(stored.surveyAnswers.presentationPreference || "neutral_examples");
      setStylingScope(stored.surveyAnswers.stylingScope || []);
      setScopeTouched(Boolean(stored.surveyAnswers.stylingScope?.length));
      setChangeTolerance(stored.surveyAnswers.changeTolerance || "light");
      setFinderResult(stored.targetFinderResult || null);
      setMakeupIntensity(stored.surveyAnswers.constraints?.makeup?.intensity || "light");
      setDailyMinutes(stored.surveyAnswers.constraints?.lifestyle?.dailyMinutes || 15);
      setBudgetBand(stored.surveyAnswers.constraints?.lifestyle?.budgetBand || "standard");
      setMaintenanceTolerance(
        stored.surveyAnswers.constraints?.lifestyle?.maintenanceTolerance || "medium"
      );
      setStage("result");
      return true;
    };

    const readLocalState = () => {
      try {
        return JSON.parse(localStorage.getItem(storageKey) || "null");
      } catch {
        return null;
      }
    };

    const updatedAtMs = (stored) => {
      const value = Date.parse(stored?.updatedAt || "");
      return Number.isFinite(value) ? value : 0;
    };

    const cacheServerStateLocally = (stored) => {
      if (!stored?.surveyAnswers) return;
      try {
        localStorage.setItem(storageKey, JSON.stringify({
          surveyAnswers: stored.surveyAnswers,
          targetFinderResult: stored.targetFinderResult || null,
          selectedRouteId: stored.selectedRouteId || null,
          updatedAt: stored.updatedAt || null
        }));
      } catch {}
    };

    const load = async () => {
      const localStored = readLocalState();

      if (savedReportId) {
        try {
          const accessToken = await getBrowserSupabaseAccessToken();
          const response = await fetch(
            `/api/premium/face-lab-v2?savedReportId=${encodeURIComponent(savedReportId)}`,
            {
              headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
            }
          );
          const data = await response.json().catch(() => null);
          const serverStored = data?.faceLabV2 || null;

          if (response.ok) {
            if (
              updatedAtMs(localStored) > updatedAtMs(serverStored) &&
              restoreState(localStored)
            ) {
              return;
            }

            if (restoreState(serverStored)) {
              cacheServerStateLocally(serverStored);
              return;
            }
          }
        } catch {}
      }

      restoreState(localStored);
    };

    void load();

    return () => {
      active = false;
    };
  }, [faceLabAnalysis, locale, resultKey, savedReportId, storageKey]);

  if (!faceLabAnalysis) {
    return <LegacyFaceLab faceLabSummary={faceLabSummary} photoUrl={photoUrl} locale={locale} />;
  }

  const persistLocal = (value) => {
    if (typeof window === "undefined") return false;

    try {
      localStorage.setItem(storageKey, JSON.stringify({
        ...value,
        updatedAt: new Date().toISOString()
      }));
      return true;
    } catch {
      return false;
    }
  };

  const persistServer = (surveyAnswers, approvedFinder, routeId) => {
    if (!savedReportId) return Promise.resolve();

    const write = async () => {
      try {
        const accessToken = await getBrowserSupabaseAccessToken();
        if (!accessToken) return;

        const requestState = {
          surveyAnswers,
          targetFinderResult: approvedFinder,
          selectedRouteId: routeId
        };
        const response = await fetch("/api/premium/face-lab-v2", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            savedReportId,
            ...requestState
          })
        });
        const data = await response.json().catch(() => null);
        const serverStored = data?.faceLabV2 || null;

        if (!response.ok || !serverStored?.surveyAnswers) return;

        try {
          const currentStored = JSON.parse(localStorage.getItem(storageKey) || "null");
          if (
            persistenceFingerprint(currentStored) !==
            persistenceFingerprint(requestState)
          ) {
            return;
          }

          localStorage.setItem(storageKey, JSON.stringify({
            surveyAnswers: serverStored.surveyAnswers,
            targetFinderResult: serverStored.targetFinderResult || null,
            selectedRouteId: serverStored.selectedRouteId || null,
            updatedAt: serverStored.updatedAt || null
          }));
        } catch {}
      } catch {}
    };

    persistQueueRef.current = persistQueueRef.current.then(write, write);
    return persistQueueRef.current;
  };

  const buildSurveyAnswers = () => ({
    schemaVersion: "face-lab-target-style-survey-v1",
    entryMode: entryMode || "known",
    targetSelections: entryMode === "unknown" ? [] : targets,
    clarifiers: {
      softSharp: entryMode === "partial" ? softSharpClarifier : null,
      naturalPolished: entryMode === "partial" ? naturalPolishedClarifier : null
    },
    presentationPreference,
    stylingScope,
    changeTolerance,
    constraints: {
      makeup: {
        intensity: makeupIntensity
      },
      lifestyle: {
        dailyMinutes,
        budgetBand,
        maintenanceTolerance
      },
      hardExclusions: []
    },
    approvedAt: new Date().toISOString()
  });

  const confirm = () => {
    const surveyAnswers = buildSurveyAnswers();
    const approvedFinder = finderResult
      ? { ...finderResult, userApproved: true }
      : null;
    const result = buildFaceLabV2Canonical({
      analysis: faceLabAnalysis,
      surveyAnswers,
      targetFinderResult: approvedFinder,
      selectedRouteId: null,
      locale,
      resultId: resultKey
    });

    setCanonical(result);
    setStage("result");

    persistLocal({
      surveyAnswers,
      targetFinderResult: approvedFinder,
      selectedRouteId: result.routes?.selectedRouteId || null
    });

    void persistServer(
      surveyAnswers,
      approvedFinder,
      result.routes?.selectedRouteId || null
    );
  };

  const selectRoute = (routeId) => {
    const surveyAnswers = buildSurveyAnswers();
    const approvedFinder = finderResult
      ? { ...finderResult, userApproved: true }
      : null;
    const result = buildFaceLabV2Canonical({
      analysis: faceLabAnalysis,
      surveyAnswers,
      targetFinderResult: approvedFinder,
      selectedRouteId: routeId,
      locale,
      resultId: resultKey
    });

    const resolvedRouteId = result.routes?.selectedRouteId || null;

    setCanonical(result);

    persistLocal({
      surveyAnswers,
      targetFinderResult: approvedFinder,
      selectedRouteId: resolvedRouteId
    });

    void persistServer(surveyAnswers, approvedFinder, resolvedRouteId);
  };

  const choosePresentation = (value) => {
    setPresentationPreference(value);
    if (!scopeTouched) {
      setStylingScope(defaultScopes(value));
    }
  };

  const toggleScope = (key) => {
    setScopeTouched(true);
    setStylingScope((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key]
    );
  };

  if (stage === "result" && canonical) {
    return (
      <FaceLabV2Result
        result={canonical}
        locale={locale}
        onSelectRoute={selectRoute}
        onEditTarget={() => setStage(entryMode === "unknown" ? "finder" : "target")}
      />
    );
  }

  if (stage === "finder") {
    return (
      <TargetFinder
        locale={locale}
        onBack={() => setStage("mode")}
        onComplete={(value) => {
          const candidateLabels = value.candidateLabels || [];

          if (!candidateLabels.length) {
            setFinderResult(null);
            setFinderInconclusive(true);
            setTargets([]);
            setEntryMode("known");
            setStage("target");
            return;
          }

          setFinderResult(value);
          setFinderInconclusive(false);
          setTargets(candidateLabels);
          setStage("setup");
        }}
      />
    );
  }

  if (stage === "mode") {
    return (
      <section className="ui-card p-5 sm:p-6">
        <p className="ui-kicker">FACE LAB V2</p>
        <h2 className="ui-title mt-2 text-xl">{copy.introTitle}</h2>
        <p className="ui-text-secondary mt-2 text-sm leading-6">{copy.introBody}</p>
        <h3 className="mt-6 text-sm font-semibold">{copy.modeTitle}</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {[
            ["known", copy.known],
            ["partial", copy.partial],
            ["unknown", copy.unknown]
          ].map(([value, label]) => (
            <ChoiceButton
              key={value}
              active={entryMode === value}
              onClick={() => {
                restoreInteractionRef.current += 1;
                setEntryMode(value);
                setFinderResult(null);
                setFinderInconclusive(false);
                setTargets([]);
                setStylingScope([]);
                setScopeTouched(false);
                setPresentationPreference("neutral_examples");
                setSoftSharpClarifier(null);
                setNaturalPolishedClarifier(null);
                setStage(value === "unknown" ? "finder" : "target");
              }}
            >
              {label}
            </ChoiceButton>
          ))}
        </div>
      </section>
    );
  }

  if (stage === "target") {
    return (
      <section className="ui-card p-5 sm:p-6">
        <p className="ui-kicker">TARGET STYLE</p>
        <h3 className="ui-title mt-2 text-xl">{copy.targetTitle}</h3>
        <p className="ui-text-secondary mt-2 text-sm">{copy.targetBody}</p>
        {finderInconclusive ? (
          <p className="mt-3 rounded-xl border border-amber-300/60 bg-amber-50/60 px-3 py-2.5 text-sm leading-6 dark:border-amber-900/60 dark:bg-amber-950/15">
            {copy.finderInconclusive}
          </p>
        ) : null}
        <TargetSelection locale={locale} selected={targets} onChange={setTargets} />

        {entryMode === "partial" ? (
          <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/30">
            <p className="text-sm font-semibold">{copy.partialClarifierTitle}</p>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <ChoiceButton
                active={softSharpClarifier === "soft"}
                onClick={() => setSoftSharpClarifier("soft")}
              >
                {copy.softSide}
              </ChoiceButton>
              <ChoiceButton
                active={softSharpClarifier === "neutral"}
                onClick={() => setSoftSharpClarifier("neutral")}
              >
                {copy.middleSide}
              </ChoiceButton>
              <ChoiceButton
                active={softSharpClarifier === "sharp"}
                onClick={() => setSoftSharpClarifier("sharp")}
              >
                {copy.sharpSide}
              </ChoiceButton>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <ChoiceButton
                active={naturalPolishedClarifier === "natural"}
                onClick={() => setNaturalPolishedClarifier("natural")}
              >
                {copy.naturalSide}
              </ChoiceButton>
              <ChoiceButton
                active={naturalPolishedClarifier === "neutral"}
                onClick={() => setNaturalPolishedClarifier("neutral")}
              >
                {copy.middleSide}
              </ChoiceButton>
              <ChoiceButton
                active={naturalPolishedClarifier === "polished"}
                onClick={() => setNaturalPolishedClarifier("polished")}
              >
                {copy.polishedSide}
              </ChoiceButton>
            </div>
          </div>
        ) : null}

        <div className="mt-5 flex gap-2">
          <button type="button" onClick={() => setStage("mode")} className="ui-button-secondary min-h-11 flex-1 px-4 text-sm font-semibold">
            {copy.back}
          </button>
          <button
            type="button"
            onClick={() => setStage("setup")}
            disabled={
              !targets.length ||
              (entryMode === "partial" &&
                (!softSharpClarifier || !naturalPolishedClarifier))
            }
            className="ui-button-primary min-h-11 flex-1 px-4 text-sm font-semibold disabled:opacity-40"
          >
            {copy.next}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="ui-card p-5 sm:p-6">
      <p className="ui-kicker">TARGET SETUP</p>
      <h3 className="ui-title mt-2 text-xl">{copy.setupTitle}</h3>

      {entryMode === "unknown" && targets.length ? (
        <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-950/30">
          <p className="text-xs font-semibold text-zinc-500">{copy.targetFinderResult}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {targets.map((key) => (
              <span key={key} className="ui-chip-compact px-3 py-1.5">
                {getTargetStyleLabel(key, locale)}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-5">
        <p className="text-sm font-semibold">{copy.presentationTitle}</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {[
            ["masculine_examples", copy.masculine],
            ["feminine_examples", copy.feminine],
            ["neutral_examples", copy.neutral]
          ].map(([value, label]) => (
            <ChoiceButton key={value} active={presentationPreference === value} onClick={() => choosePresentation(value)}>
              {label}
            </ChoiceButton>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <p className="text-sm font-semibold">{copy.scopeTitle}</p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {Object.entries(copy.scope).map(([key, label]) => (
            <ChoiceButton key={key} active={stylingScope.includes(key)} onClick={() => toggleScope(key)}>
              {label}
            </ChoiceButton>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <p className="text-sm font-semibold">{copy.changeTitle}</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {["minimal", "light", "moderate", "high"].map((key) => (
            <ChoiceButton key={key} active={changeTolerance === key} onClick={() => setChangeTolerance(key)}>
              {copy[key]}
            </ChoiceButton>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <p className="text-sm font-semibold">{copy.constraintsTitle}</p>
        {stylingScope.includes("makeup") ? (
          <div className="mt-3">
            <p className="text-xs font-semibold text-zinc-500">{copy.makeupIntensity}</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <ChoiceButton active={makeupIntensity === "light"} onClick={() => setMakeupIntensity("light")}>{copy.makeupLight}</ChoiceButton>
              <ChoiceButton active={makeupIntensity === "medium"} onClick={() => setMakeupIntensity("medium")}>{copy.makeupMedium}</ChoiceButton>
              <ChoiceButton active={makeupIntensity === "expressive"} onClick={() => setMakeupIntensity("expressive")}>{copy.makeupExpressive}</ChoiceButton>
            </div>
          </div>
        ) : null}

        <div className="mt-3">
          <p className="text-xs font-semibold text-zinc-500">{copy.dailyMinutes}</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <ChoiceButton active={dailyMinutes === 5} onClick={() => setDailyMinutes(5)}>{copy.minutes5}</ChoiceButton>
            <ChoiceButton active={dailyMinutes === 15} onClick={() => setDailyMinutes(15)}>{copy.minutes15}</ChoiceButton>
            <ChoiceButton active={dailyMinutes === 30} onClick={() => setDailyMinutes(30)}>{copy.minutes30}</ChoiceButton>
          </div>
        </div>

        <div className="mt-3">
          <p className="text-xs font-semibold text-zinc-500">{copy.budgetTitle}</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <ChoiceButton active={budgetBand === "low"} onClick={() => setBudgetBand("low")}>{copy.budgetLow}</ChoiceButton>
            <ChoiceButton active={budgetBand === "standard"} onClick={() => setBudgetBand("standard")}>{copy.budgetStandard}</ChoiceButton>
            <ChoiceButton active={budgetBand === "flexible"} onClick={() => setBudgetBand("flexible")}>{copy.budgetFlexible}</ChoiceButton>
          </div>
        </div>

        <div className="mt-3">
          <p className="text-xs font-semibold text-zinc-500">{copy.maintenanceTitle}</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <ChoiceButton active={maintenanceTolerance === "low"} onClick={() => setMaintenanceTolerance("low")}>{copy.maintenanceLow}</ChoiceButton>
            <ChoiceButton active={maintenanceTolerance === "medium"} onClick={() => setMaintenanceTolerance("medium")}>{copy.maintenanceMedium}</ChoiceButton>
            <ChoiceButton active={maintenanceTolerance === "high"} onClick={() => setMaintenanceTolerance("high")}>{copy.maintenanceHigh}</ChoiceButton>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/30">
        <p className="text-sm font-semibold">{copy.reviewTitle}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {targets.map((key) => (
            <span key={key} className="ui-chip-compact px-3 py-1.5">{getTargetStyleLabel(key, locale)}</span>
          ))}
        </div>
      </div>

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={() => setStage(entryMode === "unknown" ? "finder" : "target")}
          className="ui-button-secondary min-h-11 flex-1 px-4 text-sm font-semibold"
        >
          {copy.back}
        </button>
        <button
          type="button"
          disabled={!stylingScope.length || !targets.length}
          onClick={confirm}
          className="ui-button-primary min-h-11 flex-1 px-4 text-sm font-semibold disabled:opacity-40"
        >
          {copy.confirm}
        </button>
      </div>
    </section>
  );
}
