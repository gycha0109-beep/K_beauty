"use client";

import { useEffect, useMemo, useState } from "react";
import { buildUnavailablePremiumFaceLab, sanitizePremiumFaceLabSummary } from "@/lib/premium-face-lab";
import { buildFaceLabV2Canonical } from "@/lib/face-lab-v2/canonical-composer";
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
    contextTitle: "주로 언제 쓰고 싶나요?",
    daily: "데일리",
    work_school: "출근 / 학교",
    date: "데이트",
    photo_social: "사진 / SNS",
    constraintsTitle: "현실적인 조건",
    hairChange: "헤어 길이 변화",
    hairSmall: "큰 변화는 싫어요",
    hairLarge: "큰 변화도 가능",
    dyeTitle: "염색",
    dyeNo: "현재 색 유지",
    dyeYes: "염색 가능",
    makeupIntensity: "메이크업 강도",
    makeupLight: "가볍게",
    makeupMedium: "보통",
    makeupExpressive: "적극적으로",
    dailyMinutes: "하루 스타일링 시간",
    minutes5: "5분 내",
    minutes15: "15분 내",
    minutes30: "30분 이상도 가능",
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
    contextTitle: "Main context",
    daily: "Daily",
    work_school: "Work / school",
    date: "Date",
    photo_social: "Photo / social",
    constraintsTitle: "Practical limits",
    hairChange: "Hair length change",
    hairSmall: "Keep length close",
    hairLarge: "Large change is okay",
    dyeTitle: "Hair color",
    dyeNo: "Keep current color",
    dyeYes: "Color change is okay",
    makeupIntensity: "Makeup intensity",
    makeupLight: "Light",
    makeupMedium: "Medium",
    makeupExpressive: "Expressive",
    dailyMinutes: "Daily styling time",
    minutes5: "Up to 5 min",
    minutes15: "Up to 15 min",
    minutes30: "30+ min is okay",
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

function FaceLabImage({ src, alt, locale }) {
  const copy = getCopy(locale);
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="flex aspect-[4/5] w-full items-center justify-center rounded-[0.75rem] border border-zinc-200 bg-zinc-50 px-4 text-center text-xs font-medium leading-5 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400">
        {copy.fallbackTitle}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt || copy.imageAlt}
      onError={() => setFailed(true)}
      className="aspect-[4/5] w-full rounded-[0.75rem] object-cover object-center"
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
    faceLabSummary || buildUnavailablePremiumFaceLab()
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
            <FaceLabImage src={imageUrl} alt={copy.imageAlt} locale={locale} />
            <div>
              <h3 className="ui-title text-lg">{copy.fallbackTitle}</h3>
              <p className="ui-text-secondary mt-2 text-sm leading-6">{copy.fallbackBody}</p>
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
          <FaceLabImage src={imageUrl} alt={copy.imageAlt} locale={locale} />
          <div>
            <h3 className="ui-title text-xl">{summary.impressionTitle || copy.title}</h3>
            {summary.impressionSummary ? (
              <p className="ui-text-secondary mt-2 text-sm leading-6">{summary.impressionSummary}</p>
            ) : null}
            {summary.keywords.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {summary.keywords.map((keyword) => (
                  <span key={keyword} className="ui-chip-compact px-3 py-1.5">{keyword}</span>
                ))}
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
              <article key={item.key} className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-950/35">
                <h4 className="text-sm font-semibold">{item.title}</h4>
                <p className="ui-text-secondary mt-1 text-sm leading-6">{item.summary}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}

function TargetFinder({ locale, onComplete, onBack }) {
  const copy = getCopy(locale);
  const [roundIndex, setRoundIndex] = useState(0);
  const [choices, setChoices] = useState([]);
  const round = getTargetFinderRound(roundIndex);

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
            <div className={`h-20 rounded-xl ${
              index === 0
                ? "bg-gradient-to-br from-zinc-100 to-rose-100 dark:from-zinc-800 dark:to-rose-950"
                : "bg-gradient-to-br from-zinc-100 to-violet-100 dark:from-zinc-800 dark:to-violet-950"
            }`} />
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

function ResultList({ items }) {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!safeItems.length) return null;

  return (
    <div className="mt-3 grid gap-2">
      {safeItems.map((item, index) => (
        <div key={`${index}-${item}`} className="rounded-xl border border-zinc-200 bg-white/60 px-3 py-2.5 text-sm leading-6 dark:border-zinc-800 dark:bg-zinc-950/30">
          {item}
        </div>
      ))}
    </div>
  );
}

function FaceLabV2Result({ result, locale, onSelectRoute, onEditTarget }) {
  const copy = getCopy(locale);
  const selectedRoute = result.routes?.routes?.find((route) => route.routeId === result.routes.selectedRouteId);

  const formatMeta = (route) => copy.routeMeta
    .replace("{change}", copy.routeLevel[route.changeMagnitude] || route.changeMagnitude)
    .replace("{effort}", copy.routeLevel[route.dailyEffort] || route.dailyEffort)
    .replace("{maintenance}", copy.routeLevel[route.maintenance] || route.maintenance);

  const makeupLines = [
    ...(result.makeup?.value?.eyes?.direction || []),
    ...(result.makeup?.value?.blush?.direction || []),
    ...(result.makeup?.value?.lips?.direction || []),
    ...(result.makeup?.value?.complexion?.direction || [])
  ];

  const hairLines = result.hair?.value
    ? [
        ...(result.hair.value.parting || []),
        ...(result.hair.value.sideVolume || []),
        ...(result.hair.value.layerDirection || []),
        ...(result.hair.value.curvature || []),
        ...(result.hair.value.texture || []),
        ...(result.hair.value.silhouette || []),
        ...(result.hair.value.avoidOrModerate || [])
      ]
    : [];

  const groomingLines = result.grooming?.value
    ? [
        ...(result.grooming.value.brows || []),
        ...(result.grooming.value.facialHair || []),
        ...(result.grooming.value.maintenancePlan || [])
      ]
    : [];

  const colorLines = result.color?.value
    ? [
        ...(result.color.value.applicationNotes || []),
        result.color.value.temperatureDirection
          ? `temperature: ${result.color.value.temperatureDirection}`
          : null,
        result.color.value.chromaDirection
          ? `chroma: ${result.color.value.chromaDirection}`
          : null
      ].filter(Boolean)
    : [];

  const eyewearLines = result.eyewear?.value
    ? [
        ...(result.eyewear.value.angularity || []),
        ...(result.eyewear.value.curvature || []),
        ...(result.eyewear.value.rimThickness || []),
        ...(result.eyewear.value.visualWeight || [])
      ]
    : [];

  const accessoryLines = result.accessories?.value
    ? [
        ...(result.accessories.value.visualWeight || []),
        ...(result.accessories.value.examples || []).map((item) => item.direction)
      ]
    : [];

  return (
    <section className="space-y-4">
      <section className="ui-card p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="ui-kicker">FACE LAB V2</p>
            <h2 className="ui-title mt-2 text-xl">{copy.currentTitle}</h2>
            <p className="ui-text-secondary mt-2 text-sm leading-6">{result.currentFaceProfile?.summary}</p>
          </div>
          <button type="button" onClick={onEditTarget} className="ui-button-secondary px-3 py-2 text-xs font-semibold">
            {copy.edit}
          </button>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {(result.currentFaceProfile?.keyFeatures || []).slice(0, 4).map((feature) => (
            <div key={feature.key} className="ui-card-subtle p-3">
              <p className="text-sm font-semibold">{feature.label}</p>
              <p className="ui-text-secondary mt-1 text-xs leading-5">{feature.explanation}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="ui-card-subtle p-5 sm:p-6">
        <p className="ui-kicker">{copy.targetResultTitle}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(result.targetStyle?.targetLabels || []).map((key) => (
            <span key={key} className="ui-choice-active rounded-full px-3 py-1.5 text-sm font-semibold">
              {getTargetStyleLabel(key, locale) || key}
            </span>
          ))}
        </div>
      </section>

      <section className="ui-card-subtle p-5 sm:p-6">
        <p className="ui-kicker">{copy.deltaTitle}</p>
        <div className="mt-3 grid gap-2">
          {(result.styleDelta?.priorities || [])
            .filter((item) => item.constraintState === "allowed")
            .slice(0, 5)
            .map((item) => (
              <div key={`${item.domain}-${item.parameter}`} className="rounded-xl border border-zinc-200 bg-white/60 p-3 dark:border-zinc-800 dark:bg-zinc-950/30">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {copy.scope[item.domain] || item.domain}
                </p>
                <p className="mt-1 text-sm font-semibold">{item.expectedEffect}</p>
              </div>
            ))}
        </div>
      </section>

      <section className="ui-card-subtle p-5 sm:p-6">
        <p className="ui-kicker">{copy.routesTitle}</p>
        <div className="mt-3 grid gap-3">
          {(result.routes?.routes || []).map((route) => (
            <button
              key={route.routeId}
              type="button"
              onClick={() => onSelectRoute(route.routeId)}
              className={`rounded-xl border p-4 text-left transition ${
                result.routes.selectedRouteId === route.routeId
                  ? "ui-choice-active"
                  : "border-zinc-200 bg-white/60 dark:border-zinc-800 dark:bg-zinc-950/30"
              }`}
            >
              <p className="text-sm font-semibold">{route.title}</p>
              <p className="mt-1 text-xs opacity-80">{formatMeta(route)}</p>
              <p className="mt-2 text-sm leading-6 opacity-90">{route.whyThisRoute}</p>
              {route.actions?.length ? (
                <div className="mt-3 grid gap-1.5">
                  {route.actions.slice(0, 2).map((action) => (
                    <p
                      key={`${action.domain}-${action.parameter}`}
                      className="text-xs leading-5 opacity-80"
                    >
                      · {action.explanation}
                    </p>
                  ))}
                </div>
              ) : null}
            </button>
          ))}
        </div>
      </section>

      <section className="ui-card p-5 sm:p-6">
        <p className="ui-kicker">{copy.executionTitle}</p>
        {selectedRoute ? <h3 className="ui-title mt-2 text-lg">{selectedRoute.title}</h3> : null}

        <div className="mt-5 grid gap-4">
          <div>
            <h4 className="text-sm font-semibold">{copy.hairTitle}</h4>
            {hairLines.length ? <ResultList items={hairLines} /> : <p className="ui-text-secondary mt-2 text-sm">{copy.noDomain}</p>}
          </div>
          <div>
            <h4 className="text-sm font-semibold">{copy.groomingTitle}</h4>
            {groomingLines.length ? <ResultList items={groomingLines} /> : <p className="ui-text-secondary mt-2 text-sm">{copy.noDomain}</p>}
          </div>
          <div>
            <h4 className="text-sm font-semibold">{copy.makeupTitle}</h4>
            {makeupLines.length ? <ResultList items={makeupLines} /> : <p className="ui-text-secondary mt-2 text-sm">{copy.noDomain}</p>}
          </div>
          <div>
            <h4 className="text-sm font-semibold">{copy.colorTitle}</h4>
            {colorLines.length ? <ResultList items={colorLines} /> : <p className="ui-text-secondary mt-2 text-sm">{copy.noDomain}</p>}
          </div>
          <div>
            <h4 className="text-sm font-semibold">{copy.eyewearTitle}</h4>
            {eyewearLines.length ? <ResultList items={eyewearLines} /> : <p className="ui-text-secondary mt-2 text-sm">{copy.noDomain}</p>}
          </div>
          <div>
            <h4 className="text-sm font-semibold">{copy.accessoriesTitle}</h4>
            {accessoryLines.length ? <ResultList items={accessoryLines} /> : <p className="ui-text-secondary mt-2 text-sm">{copy.noDomain}</p>}
          </div>
        </div>
      </section>

      {result.looks?.looks?.length ? (
        <section className="ui-card-subtle p-5 sm:p-6">
          <p className="ui-kicker">{copy.lookTitle}</p>
          {result.looks.looks.map((look) => (
            <div key={look.lookId} className="mt-3 rounded-xl border border-zinc-200 bg-white/60 p-4 dark:border-zinc-800 dark:bg-zinc-950/30">
              <h4 className="text-sm font-semibold">{look.title}</h4>
              <p className="ui-text-secondary mt-2 text-sm leading-6">{look.summary}</p>
              <p className="ui-text-secondary mt-2 text-xs leading-5">{look.whyItWorks}</p>
            </div>
          ))}
          {result.looks.visualConflicts?.length ? (
            <div className="mt-4">
              <p className="text-xs font-semibold text-zinc-500">{copy.conflictTitle}</p>
              <ResultList
                items={result.looks.visualConflicts.map((item) =>
                  item.resolution
                    ? `${item.description} → ${item.resolution}`
                    : item.description
                )}
              />
            </div>
          ) : null}
        </section>
      ) : null}

      {result.productHandoff?.specifications?.length ? (
        <section className="ui-card-subtle p-5 sm:p-6">
          <p className="ui-kicker">{copy.productSpecTitle}</p>
          <div className="mt-3 grid gap-2">
            {result.productHandoff.specifications.map((spec) => (
              <div key={spec.specId} className="rounded-xl border border-zinc-200 bg-white/60 p-3 dark:border-zinc-800 dark:bg-zinc-950/30">
                <p className="text-sm font-semibold">{spec.category}</p>
                <p className="ui-text-secondary mt-1 text-xs leading-5">
                  {Object.entries(spec.requiredAttributes || {})
                    .filter(([, value]) => value !== null && value !== undefined)
                    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : value}`)
                    .join(" · ")}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
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
  const [presentationPreference, setPresentationPreference] = useState("neutral_examples");
  const [stylingScope, setStylingScope] = useState([]);
  const [changeTolerance, setChangeTolerance] = useState("light");
  const [contexts, setContexts] = useState(["daily"]);
  const [hairLengthChange, setHairLengthChange] = useState("small");
  const [dyeAllowed, setDyeAllowed] = useState(false);
  const [makeupIntensity, setMakeupIntensity] = useState("light");
  const [dailyMinutes, setDailyMinutes] = useState(15);
  const [canonical, setCanonical] = useState(null);
  const [selectedRouteId, setSelectedRouteId] = useState(null);

  useEffect(() => {
    if (!faceLabAnalysis || typeof window === "undefined") return;

    let active = true;

    const restoreState = (stored) => {
      if (!active || !stored?.surveyAnswers) return false;

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
      setSelectedRouteId(restored.routes?.selectedRouteId || stored.selectedRouteId || null);
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
      setChangeTolerance(stored.surveyAnswers.changeTolerance || "light");
      setContexts(stored.surveyAnswers.contexts || ["daily"]);
      setFinderResult(stored.targetFinderResult || null);
      setHairLengthChange(stored.surveyAnswers.constraints?.hair?.lengthChange || "small");
      setDyeAllowed(stored.surveyAnswers.constraints?.hair?.dye === "yes");
      setMakeupIntensity(stored.surveyAnswers.constraints?.makeup?.intensity || "light");
      setDailyMinutes(stored.surveyAnswers.constraints?.lifestyle?.dailyMinutes || 15);
      setStage("result");
      return true;
    };

    const load = async () => {
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
          if (response.ok && restoreState(data?.faceLabV2)) {
            return;
          }
        } catch {}
      }

      try {
        const stored = JSON.parse(localStorage.getItem(storageKey) || "null");
        restoreState(stored);
      } catch {}
    };

    void load();

    return () => {
      active = false;
    };
  }, [faceLabAnalysis, locale, resultKey, savedReportId, storageKey]);

  if (!faceLabAnalysis) {
    return <LegacyFaceLab faceLabSummary={faceLabSummary} photoUrl={photoUrl} locale={locale} />;
  }

  const persistServer = async (surveyAnswers, approvedFinder, routeId) => {
    if (!savedReportId) return;

    try {
      const accessToken = await getBrowserSupabaseAccessToken();
      if (!accessToken) return;

      await fetch("/api/premium/face-lab-v2", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          savedReportId,
          surveyAnswers,
          targetFinderResult: approvedFinder,
          selectedRouteId: routeId
        })
      });
    } catch {}
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
    contexts,
    constraints: {
      hair: {
        lengthChange: hairLengthChange,
        dye: dyeAllowed ? "yes" : "no"
      },
      makeup: {
        intensity: makeupIntensity
      },
      lifestyle: {
        dailyMinutes
      },
      hardExclusions: [
        ...(!dyeAllowed ? ["hair_dye"] : [])
      ]
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
    setSelectedRouteId(result.routes?.selectedRouteId || null);
    setStage("result");

    if (typeof window !== "undefined") {
      localStorage.setItem(storageKey, JSON.stringify({
        surveyAnswers,
        targetFinderResult: approvedFinder,
        selectedRouteId: result.routes?.selectedRouteId || null,
        canonicalV2: result
      }));
    }

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

    setCanonical(result);
    setSelectedRouteId(routeId);

    if (typeof window !== "undefined") {
      localStorage.setItem(storageKey, JSON.stringify({
        surveyAnswers,
        targetFinderResult: approvedFinder,
        selectedRouteId: routeId,
        canonicalV2: result
      }));
    }

    void persistServer(surveyAnswers, approvedFinder, routeId);
  };

  const choosePresentation = (value) => {
    setPresentationPreference(value);
    if (!stylingScope.length) {
      setStylingScope(defaultScopes(value));
    }
  };

  const toggleScope = (key) => {
    setStylingScope((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key]
    );
  };

  const toggleContext = (key) => {
    setContexts((current) =>
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
          setFinderResult(value);
          setTargets(value.candidateLabels || []);
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
                setEntryMode(value);
                setFinderResult(null);
                setTargets([]);
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
        <p className="text-sm font-semibold">{copy.contextTitle}</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {["daily", "work_school", "date", "photo_social"].map((key) => (
            <ChoiceButton key={key} active={contexts.includes(key)} onClick={() => toggleContext(key)}>
              {copy[key]}
            </ChoiceButton>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <p className="text-sm font-semibold">{copy.constraintsTitle}</p>
        {stylingScope.includes("hair") ? (
          <div className="mt-3">
            <p className="text-xs font-semibold text-zinc-500">{copy.hairChange}</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <ChoiceButton active={hairLengthChange === "small"} onClick={() => setHairLengthChange("small")}>{copy.hairSmall}</ChoiceButton>
              <ChoiceButton active={hairLengthChange === "large"} onClick={() => setHairLengthChange("large")}>{copy.hairLarge}</ChoiceButton>
            </div>
            <p className="mt-3 text-xs font-semibold text-zinc-500">{copy.dyeTitle}</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <ChoiceButton active={!dyeAllowed} onClick={() => setDyeAllowed(false)}>{copy.dyeNo}</ChoiceButton>
              <ChoiceButton active={dyeAllowed} onClick={() => setDyeAllowed(true)}>{copy.dyeYes}</ChoiceButton>
            </div>
          </div>
        ) : null}

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
