import { getRecommendationProducts } from "@/lib/product-source";
import {
  normalizeCanonicalFinish,
  normalizeRecommendationAnswers,
  scoreCanonicalProduct,
  scoreSunscreenProduct
} from "@/lib/recommendation-scoring";
import {
  appendReviewEvidenceSentence,
  buildReviewEvidenceSentence,
  computeReviewSignalScore
} from "@/lib/review-signals";

const CONCERN_AXES = [
  "barrier",
  "dehydration",
  "oiliness",
  "redness",
  "acne",
  "pores",
  "uneven_tone",
  "uv"
];

const PRIORITY_TIEBREAKER = [
  "uv",
  "barrier",
  "redness",
  "dehydration",
  "acne",
  "pores",
  "oiliness",
  "uneven_tone"
];

const CATEGORY_SLOT_LABELS = {
  cleanser: { ko: "클렌저", en: "Cleanser" },
  toner_essence: { ko: "Toner / Essence", en: "Toner / Essence" },
  serum: { ko: "Serum / Ampoule", en: "Serum / Ampoule" },
  moisturizer: { ko: "보습제", en: "Moisturizer" },
  sunscreen: { ko: "선크림", en: "Sunscreen" }
};

const PRIORITY_LABELS = {
  barrier: { ko: "장벽", en: "Barrier" },
  dehydration: { ko: "건조", en: "Dehydration" },
  oiliness: { ko: "유분", en: "Oiliness" },
  redness: { ko: "붉은기", en: "Redness" },
  acne: { ko: "트러블", en: "Breakouts" },
  pores: { ko: "모공", en: "Pores" },
  uneven_tone: { ko: "톤 불균일", en: "Uneven tone" },
  uv: { ko: "자외선", en: "UV" }
};

const STEP_LABELS = {
  cleanser: { ko: "클렌저", en: "Cleanser" },
  toner_essence: { ko: "Toner / Essence", en: "Toner / Essence" },
  serum: { ko: "Serum / Ampoule", en: "Serum / Ampoule" },
  moisturizer: { ko: "보습제", en: "Moisturizer" },
  sunscreen: { ko: "선크림", en: "Sunscreen" }
};

const SLOT_ALIAS = {
  cleanser: "cleanser",
  toner_pad: "toner_essence",
  toner_essence: "toner_essence",
  essence: "toner_essence",
  serum: "serum",
  ampoule: "serum",
  moisturizer: "moisturizer",
  sunscreen: "sunscreen"
};

/*
Object.assign(CATEGORY_SLOT_LABELS, {
  toner_essence: { ko: "Toner / Essence", en: "Toner / Essence" },
  serum: { ko: "Serum / Ampoule", en: "Serum / Ampoule" },
});

Object.assign(STEP_LABELS, {
  toner_essence: { ko: "Toner / Essence", en: "Toner / Essence" },
  serum: { ko: "Serum / Ampoule", en: "Serum / Ampoule" },
});

*/
Object.assign(CATEGORY_SLOT_LABELS, {
  toner_essence: { ko: "토너 / 에센스", en: "Toner / Essence" },
  serum: { ko: "세럼 · 앰플", en: "Serum / Ampoule" },
});

Object.assign(STEP_LABELS, {
  toner_essence: { ko: "토너 / 에센스", en: "Toner / Essence" },
  serum: { ko: "세럼 / 앰플", en: "Serum / Ampoule" },
});

Object.assign(SLOT_ALIAS, {
  toner_pad: "toner_essence",
  toner_essence: "toner_essence",
  essence: "toner_essence",
  serum: "serum",
  ampoule: "serum",
});

function getLocale(locale = "ko") {
  return locale === "en" ? "en" : "ko";
}

function getLabel(map, key, locale = "ko") {
  return map[key]?.[getLocale(locale)] || key;
}

function createScoreCard() {
  return CONCERN_AXES.reduce((accumulator, axis) => {
    accumulator[axis] = {
      total: 0,
      survey: 0,
      photo: 0,
      environment: 0
    };
    return accumulator;
  }, {});
}

function addScore(scoreCard, axis, bucket, value) {
  if (!scoreCard[axis] || !value) {
    return;
  }

  scoreCard[axis].total += value;
  scoreCard[axis][bucket] += value;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeLower(value) {
  return String(value || "").trim().toLowerCase();
}

function includesNormalized(haystack, needle) {
  return normalizeLower(haystack).includes(normalizeLower(needle));
}

function getProductSlot(category) {
  return SLOT_ALIAS[category] || category || "";
}

function hasConcern(product, axis) {
  return Array.isArray(product?.concerns) && product.concerns.includes(axis);
}

function isLowIrritation(product) {
  return product?.irritation_risk === "low" || Boolean(product?.sensitivity_safe);
}

function isCalmingSerum(product) {
  return (
    getProductSlot(product?.category) === "serum" &&
    isLowIrritation(product) &&
    (hasConcern(product, "redness") || hasConcern(product, "barrier") || hasConcern(product, "acne"))
  );
}

function isDeepCleanser(product) {
  const combined = [
    product?.id,
    product?.name,
    product?.notes,
    product?.standout_reason
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    getProductSlot(product?.category) === "cleanser" &&
    (combined.includes("deep clean") ||
      combined.includes("pore deep") ||
      combined.includes("clarified finish") ||
      combined.includes("perfect whip"))
  );
}

function isHeroNamedCleanser(product) {
  const combined = [product?.brand, product?.name, product?.id]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return combined.includes("senka") && combined.includes("perfect whip");
}

function applySurveyWeights(scoreCard, answers) {
  const mainConcerns = Array.isArray(answers.mainConcerns) && answers.mainConcerns.length
    ? answers.mainConcerns
    : answers.mainConcern
      ? [answers.mainConcern]
      : [];

  mainConcerns.forEach((axis, index) => {
    addScore(scoreCard, axis, "survey", index === 0 ? 22 : 10);
  });

  switch (answers.skinType) {
    case "dry":
      addScore(scoreCard, "dehydration", "survey", 8);
      addScore(scoreCard, "barrier", "survey", 5);
      break;
    case "oily":
      addScore(scoreCard, "oiliness", "survey", 8);
      addScore(scoreCard, "pores", "survey", 5);
      addScore(scoreCard, "acne", "survey", 3);
      break;
    case "combination":
      addScore(scoreCard, "oiliness", "survey", 4);
      addScore(scoreCard, "dehydration", "survey", 3);
      addScore(scoreCard, "pores", "survey", 3);
      break;
    default:
      break;
  }

  if (answers.sensitivity === "high") {
    addScore(scoreCard, "barrier", "survey", 8);
    addScore(scoreCard, "redness", "survey", 7);
  } else if (answers.sensitivity === "medium") {
    addScore(scoreCard, "barrier", "survey", 4);
    addScore(scoreCard, "redness", "survey", 3);
  }

  if (answers.postWashFeeling === "tight") {
    addScore(scoreCard, "dehydration", "survey", 8);
    addScore(scoreCard, "barrier", "survey", 5);
    addScore(scoreCard, "redness", "survey", 2);
  }

  if (answers.postWashFeeling === "still_oily") {
    addScore(scoreCard, "oiliness", "survey", 8);
    addScore(scoreCard, "pores", "survey", 5);
    addScore(scoreCard, "acne", "survey", 3);
  }

  if (answers.afternoonSkinChange === "more_oily") {
    addScore(scoreCard, "oiliness", "survey", 7);
    addScore(scoreCard, "pores", "survey", 4);
    addScore(scoreCard, "acne", "survey", 2);
  }

  if (answers.afternoonSkinChange === "more_dry") {
    addScore(scoreCard, "dehydration", "survey", 7);
    addScore(scoreCard, "barrier", "survey", 4);
  }

  if (answers.afternoonSkinChange === "red_or_irritated") {
    addScore(scoreCard, "redness", "survey", 8);
    addScore(scoreCard, "barrier", "survey", 5);
  }

  if (answers.cleansingFrequency === "3_plus") {
    addScore(scoreCard, "barrier", "survey", 3);
    addScore(scoreCard, "dehydration", "survey", 2);
  }

  if (answers.whiteCastHate) {
    addScore(scoreCard, "uv", "survey", 3);
  }

  if (answers.toneUpWanted) {
    addScore(scoreCard, "uv", "survey", 2);
    addScore(scoreCard, "uneven_tone", "survey", 1);
  }

  if (answers.makeupUse) {
    addScore(scoreCard, "pores", "survey", 2);
    addScore(scoreCard, "uv", "survey", 1);
  }

  if (answers.eyeSensitive) {
    addScore(scoreCard, "redness", "survey", 2);
    addScore(scoreCard, "barrier", "survey", 1);
    addScore(scoreCard, "uv", "survey", 1);
  }

  if (answers.outdoorExposure) {
    addScore(scoreCard, "uv", "survey", 10);
  }

  if (answers.verySensitivePeriod) {
    addScore(scoreCard, "barrier", "survey", 7);
    addScore(scoreCard, "redness", "survey", 6);
  }
}

function applyEnvironmentWeights(scoreCard, answers) {
  const exposureList = Array.isArray(answers.environmentExposure)
    ? answers.environmentExposure
    : [];

  exposureList.forEach((exposure) => {
    switch (exposure) {
      case "heat":
        addScore(scoreCard, "oiliness", "environment", 4);
        addScore(scoreCard, "redness", "environment", 2);
        addScore(scoreCard, "uv", "environment", 2);
        break;
      case "humidity":
        addScore(scoreCard, "oiliness", "environment", 4);
        addScore(scoreCard, "pores", "environment", 2);
        addScore(scoreCard, "acne", "environment", 2);
        break;
      case "mask":
        addScore(scoreCard, "redness", "environment", 4);
        addScore(scoreCard, "acne", "environment", 4);
        addScore(scoreCard, "barrier", "environment", 2);
        break;
      case "kitchen":
        addScore(scoreCard, "redness", "environment", 3);
        addScore(scoreCard, "oiliness", "environment", 3);
        addScore(scoreCard, "uv", "environment", 1);
        break;
      case "outdoor":
        addScore(scoreCard, "uv", "environment", 8);
        addScore(scoreCard, "redness", "environment", 2);
        addScore(scoreCard, "oiliness", "environment", 1);
        break;
      case "aircon":
        addScore(scoreCard, "dehydration", "environment", 4);
        addScore(scoreCard, "barrier", "environment", 2);
        addScore(scoreCard, "redness", "environment", 1);
        break;
      default:
        break;
    }
  });
}

function applyPhotoWeights(scoreCard, photoAnalysis) {
  const signals = photoAnalysis?.signals || {};

  CONCERN_AXES.forEach((axis) => {
    const rawValue = Number(signals[axis] || 0);
    const scaled = clamp(rawValue, 0, 5) * (axis === "uv" ? 3 : 4);
    addScore(scoreCard, axis, "photo", scaled);
  });
}

function getPriority(scoreCard) {
  return CONCERN_AXES
    .map((axis) => ({
      axis,
      score: scoreCard[axis].total
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return PRIORITY_TIEBREAKER.indexOf(left.axis) - PRIORITY_TIEBREAKER.indexOf(right.axis);
    })[0];
}

function getConcernRanking(scoreCard) {
  return CONCERN_AXES
    .map((axis) => ({
      axis,
      score: scoreCard[axis].total
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return PRIORITY_TIEBREAKER.indexOf(left.axis) - PRIORITY_TIEBREAKER.indexOf(right.axis);
    });
}

function buildCoreRoutineFocus(priorityAxis, targetSlot, locale = "ko") {
  const slotLabel = getLabel(CATEGORY_SLOT_LABELS, targetSlot, locale);

  if (locale === "en") {
    if (priorityAxis === "uneven_tone") {
      return `Keep ${slotLabel.toLowerCase()} as the one steady correction point through the day.`;
    }

    if (priorityAxis === "acne" || priorityAxis === "redness") {
      return `Keep ${slotLabel.toLowerCase()} as the one correction lane instead of widening the routine too quickly.`;
    }

    return `Keep ${slotLabel.toLowerCase()} as the one steady decision point through the day before splitting the routine wider.`;
  }

  if (priorityAxis === "uneven_tone") {
    return `${slotLabel} 한 포인트를 하루 전체에서 흔들리지 않게 유지하는 쪽이 먼저입니다.`;
  }

  if (priorityAxis === "acne" || priorityAxis === "redness") {
    return `${slotLabel} 한 축만 먼저 고정하고 루틴을 넓히는 속도를 늦추는 편이 맞습니다.`;
  }

  return `${slotLabel} 한 포인트를 하루 전체에 걸쳐 먼저 안정적으로 유지하는 편이 맞습니다.`;
}

function buildRoutineStructure(priorityAxis, targetSlot, scoreCard, amFocus, pmFocus, locale = "ko") {
  const ranking = getConcernRanking(scoreCard);
  const lead = ranking[0] || { axis: priorityAxis, score: 0 };
  const runnerUp = ranking[1] || { axis: null, score: 0 };
  const gap = lead.score - runnerUp.score;
  const recoveryAxes = new Set(["barrier", "dehydration", "redness"]);
  const splitAxes = new Set(["oiliness", "pores", "acne"]);
  const hasRecoveryShadow = recoveryAxes.has(runnerUp.axis) && runnerUp.score >= 14;
  const hasDayShadow = runnerUp.axis === "uv" && runnerUp.score >= 14;
  const topCategoryLabel = getLabel(CATEGORY_SLOT_LABELS, targetSlot, locale);
  const commonFocus = buildCoreRoutineFocus(priorityAxis, targetSlot, locale);

  let type = "am_pm_balanced";

  if (priorityAxis === "uv" || (targetSlot === "sunscreen" && gap >= 4)) {
    type = "am_only";
  } else if (recoveryAxes.has(priorityAxis) && gap >= 6 && !hasDayShadow) {
    type = "pm_only";
  } else if (gap >= 8 && !splitAxes.has(priorityAxis) && !hasRecoveryShadow && !hasDayShadow) {
    type = "single_track";
  } else if (splitAxes.has(priorityAxis) || gap <= 4 || hasRecoveryShadow || hasDayShadow) {
    type = "am_pm_balanced";
  } else if (targetSlot === "moisturizer") {
    type = "pm_only";
  } else {
    type = "single_track";
  }

  if (type === "am_only") {
    return {
      type,
      label: locale === "en" ? "Morning-led" : "아침 집중형",
      title: locale === "en" ? "Morning-led Routine" : "아침 집중 루틴",
      body:
        locale === "en"
          ? `${topCategoryLabel} is carrying most of the decision weight, so the routine stays concentrated on the morning side first.`
          : `${topCategoryLabel} 단계가 낮 쪽 성패를 크게 좌우해서 아침에 집중하는 구조로 읽는 편이 맞습니다.`,
      cards: [
        {
          key: "morning",
          label: locale === "en" ? "Morning Focus" : "아침 핵심",
          body: amFocus || commonFocus
        }
      ],
      meta: {
        primaryAxis: lead.axis,
        secondaryAxis: runnerUp.axis,
        gap,
        topCategory: targetSlot
      }
    };
  }

  if (type === "pm_only") {
    return {
      type,
      label: locale === "en" ? "Night-led" : "저녁 회복형",
      title: locale === "en" ? "Night-led Routine" : "저녁 집중 루틴",
      body:
        locale === "en"
          ? `${getLabel(PRIORITY_LABELS, priorityAxis, locale)} is strong enough that the routine should settle on the night side first.`
          : `${getLabel(PRIORITY_LABELS, priorityAxis, locale)} 축이 강해서 저녁 쪽에서 회복과 보정을 먼저 잡는 구조로 보는 편이 맞습니다.`,
      cards: [
        {
          key: "night",
          label: locale === "en" ? "Night Focus" : "저녁 핵심",
          body: pmFocus || commonFocus
        }
      ],
      meta: {
        primaryAxis: lead.axis,
        secondaryAxis: runnerUp.axis,
        gap,
        topCategory: targetSlot
      }
    };
  }

  if (type === "single_track") {
    return {
      type,
      label: locale === "en" ? "All-day single track" : "하루 공통 1포인트",
      title: locale === "en" ? "All-day Core Routine" : "하루 공통 루틴",
      body:
        locale === "en"
          ? "The score gap is wide enough that one correction lane should stay steady through the day before the routine splits into AM and PM."
          : "점수 차가 커서 아침과 저녁을 억지로 나누기보다 한 포인트를 하루 전체에 일관되게 유지하는 편이 맞습니다.",
      cards: [
        {
          key: "core",
          label: locale === "en" ? "All-day Core" : "하루 공통 포인트",
          body: commonFocus
        }
      ],
      meta: {
        primaryAxis: lead.axis,
        secondaryAxis: runnerUp.axis,
        gap,
        topCategory: targetSlot
      }
    };
  }

  return {
    type,
    label: locale === "en" ? "AM + PM split" : "아침 + 저녁 분리형",
    title: locale === "en" ? "AM + PM Split Routine" : "아침 · 저녁 분리 루틴",
    body:
      locale === "en"
        ? "The score spread suggests a split structure works better, with a lighter daytime role and a separate evening correction role."
        : "점수 분포상 낮과 밤 역할을 나눠 보는 편이 더 자연스러워, 아침과 저녁을 분리하는 구조가 맞습니다.",
    cards: [
      {
        key: "morning",
        label: locale === "en" ? "Morning Focus" : "아침 핵심",
        body: amFocus
      },
      {
        key: "night",
        label: locale === "en" ? "Night Focus" : "저녁 핵심",
        body: pmFocus
      }
    ].filter((item) => item.body),
    meta: {
      primaryAxis: lead.axis,
      secondaryAxis: runnerUp.axis,
      gap,
      topCategory: targetSlot
    }
  };
}

function buildPublicRoutineLists(routineStructure) {
  const cards = Array.isArray(routineStructure?.cards) ? routineStructure.cards : [];
  const morning = [];
  const night = [];

  for (const card of cards) {
    if (!card?.body) {
      continue;
    }

    if (card.key === "night") {
      night.push(card.body);
      continue;
    }

    morning.push(card.body);
  }

  return {
    morning: morning.slice(0, 1),
    night: night.slice(0, 1)
  };
}

function getTopCategorySlot(priorityAxis, answers, scoreCard) {
  switch (priorityAxis) {
    case "uv":
      return "sunscreen";
    case "pores":
      return "toner_essence";
    case "barrier":
    case "dehydration":
      return "moisturizer";
    case "redness":
      return "serum";
    case "acne":
      return answers.sensitivity === "high" ? "serum" : "cleanser";
    case "oiliness":
      return answers.outdoorExposure ? "sunscreen" : "cleanser";
    case "uneven_tone":
      return scoreCard.uv.total >= 12 ? "sunscreen" : "serum";
    default:
      return "serum";
  }
}

function getEnvironmentAdjustment(product, answers, scoreCard) {
  let total = 0;
  const reasons = [];
  const slot = getProductSlot(product.category);
  const exposures = Array.isArray(answers.environmentExposure)
    ? answers.environmentExposure
    : [];

  if ((answers.outdoorExposure || exposures.includes("outdoor")) && slot === "sunscreen") {
    total += 8;
    reasons.push("outdoor-support");
  }

  if ((exposures.includes("heat") || exposures.includes("humidity")) && slot === "sunscreen") {
    total += 4;
    reasons.push("hot-weather-spf");
  }

  if (exposures.includes("aircon") && slot === "moisturizer") {
    total += 4;
    reasons.push("aircon-barrier");
  }

  if (exposures.includes("mask") && (slot === "serum" || slot === "moisturizer") && isLowIrritation(product)) {
    total += 4;
    reasons.push("mask-calming");
  }

  if (exposures.includes("humidity") && slot === "toner_essence" && scoreCard.pores.total >= 12) {
    total += 4;
    reasons.push("humid-pore-control");
  }

  if ((exposures.includes("heat") || exposures.includes("kitchen")) && slot === "cleanser" && scoreCard.oiliness.total >= 12) {
    total += 2;
    reasons.push("heat-cleanse-reset");
  }

  return { total, reasons };
}

function getHeroBoost(product, answers, scoreCard, targetSlot) {
  let total = 0;
  const reasons = [];
  const slot = getProductSlot(product.category);
  const acneHigh = scoreCard.acne.total >= 18;
  const oilHigh = scoreCard.oiliness.total >= 18;
  const poresHigh = scoreCard.pores.total >= 18;
  const barrierHigh = scoreCard.barrier.total >= 18;
  const dehydrationHigh = scoreCard.dehydration.total >= 18;
  const rednessHigh = scoreCard.redness.total >= 18;

  if (slot === targetSlot) {
    total += 16;
    reasons.push("priority-slot");
  }

  if (answers.outdoorExposure && slot === "sunscreen") {
    total += 10;
    reasons.push("outdoor-hero");
  }

  if (acneHigh && oilHigh && answers.sensitivity === "low") {
    if (isHeroNamedCleanser(product)) {
      total += 14;
      reasons.push("hero-perfect-whip");
    } else if (slot === "cleanser") {
      total += 6;
      reasons.push("hero-cleanser");
    }
  }

  if (poresHigh && oilHigh && answers.sensitivity === "low" && slot === "toner_essence") {
    total += 12;
    reasons.push("hero-toner-pad");
  }

  if ((barrierHigh || dehydrationHigh) && slot === "moisturizer") {
    total += 10;
    reasons.push("hero-moisturizer");
  }

  if ((rednessHigh || acneHigh) && isCalmingSerum(product)) {
    total += 10;
    reasons.push("hero-calming-serum");
  }

  return { total, reasons };
}

function getHardPenalty(product, answers, scoreCard) {
  let total = 0;
  const reasons = [];
  const slot = getProductSlot(product.category);
  const finish = normalizeCanonicalFinish(product.finish);

  if (answers.sensitivity === "high" && product.irritation_risk === "high") {
    total -= 22;
    reasons.push("high-sensitivity-irritation");
  }

  if (scoreCard.barrier.total >= 18 && slot === "toner_essence" && !isLowIrritation(product)) {
    total -= 16;
    reasons.push("weak-barrier-toner-pad");
  }

  if (scoreCard.dehydration.total >= 18 && finish === "soft_matte") {
    total -= 14;
    reasons.push("dehydration-soft-matte");
  }

  if (scoreCard.redness.total >= 18 && isDeepCleanser(product)) {
    total -= 18;
    reasons.push("redness-deep-clean");
  }

  return { total, reasons };
}

function buildAvoidancePhrase(product, answers, penalties, locale = "ko") {
  if (penalties.includes("high-sensitivity-irritation")) {
    return locale === "en" ? "high-irritation options" : "자극이 강한 옵션";
  }

  if (penalties.includes("dehydration-soft-matte")) {
    return locale === "en" ? "a matte, drying finish" : "건조하게 마르는 매트한 마무리";
  }

  if (answers.mostDislikedFeel === "sticky") {
    return locale === "en" ? "sticky residue" : "끈적한 잔여감";
  }

  if (answers.mostDislikedFeel === "greasy") {
    return locale === "en" ? "greasy shine" : "번들거리는 막감";
  }

  if (answers.mostDislikedFeel === "heavy") {
    return locale === "en" ? "a heavy layer" : "무거운 레이어감";
  }

  if (answers.mostDislikedFeel === "pilling") {
    return locale === "en" ? "easy pilling" : "밀리는 마무리";
  }

  return locale === "en" ? "unnecessary routine drag" : "불필요한 루틴 부담";
}

function buildSkinStatePhrase(answers, scoreCard, locale = "ko") {
  const parts = [];

  if (answers.skinType && answers.skinType !== "not_sure") {
    const map = {
      ko: {
        oily: "유분이 빠르게 올라오는 피부",
        dry: "쉽게 당기는 피부",
        combination: "유분과 건조가 같이 움직이는 피부"
      },
      en: {
        oily: "skin that gets shiny quickly",
        dry: "skin that tightens easily",
        combination: "skin balancing shine and dryness"
      }
    };
    parts.push(map[getLocale(locale)][answers.skinType] || "");
  }

  if (scoreCard.barrier.total >= 18) {
    parts.push(locale === "en" ? "with a shaky barrier" : "장벽이 흔들리기 쉬운 상태");
  } else if (scoreCard.redness.total >= 18) {
    parts.push(locale === "en" ? "with easily visible flushing" : "붉은기가 쉽게 올라오는 상태");
  }

  return parts.filter(Boolean).slice(0, 2).join(locale === "en" ? " " : " / ");
}

function buildDefaultReason(product, answers, scoreCard, priorityAxis, penalties, locale = "ko") {
  const concernLabel = getLabel(PRIORITY_LABELS, priorityAxis, locale);
  const slotLabel = getLabel(CATEGORY_SLOT_LABELS, getProductSlot(product.category), locale);
  const texture = product.texture || (locale === "en" ? "light" : "가벼운");
  const finish = normalizeCanonicalFinish(product.finish || "natural");
  const avoidance = buildAvoidancePhrase(product, answers, penalties, locale);
  const skinState = buildSkinStatePhrase(answers, scoreCard, locale);

  if (locale === "en") {
    return `${slotLabel} stays closer to ${skinState || "your current skin state"} when ${concernLabel.toLowerCase()} is driving the decision. The ${texture} texture with a ${finish.replace(/_/g, " ")} finish helps without leaning into ${avoidance}.`;
  }

  return `${slotLabel}가 ${skinState || "현재 피부 상태"}에서 ${concernLabel} 우선순위를 다루기 좋게 붙습니다. ${texture} 제형에 ${finish.replace(/_/g, " ")} 마무리라 ${avoidance} 쪽으로 치우치지 않게 잡아줍니다.`;
}

function buildDefaultComparisonReason(product, runnerUp, priorityAxis, locale = "ko") {
  if (!runnerUp) {
    return locale === "en"
      ? "This product stays more directly aligned with the current priority."
      : "지금 우선순위에 더 곧게 맞춰지는 제품입니다.";
  }

  const winnerSlot = getLabel(CATEGORY_SLOT_LABELS, getProductSlot(product.category), locale);
  const concernLabel = getLabel(PRIORITY_LABELS, priorityAxis, locale);

  if (locale === "en") {
    return `${winnerSlot} keeps the ${concernLabel.toLowerCase()} decision more practical than ${runnerUp.name} for this input mix.`;
  }

  return `${winnerSlot} 쪽이 ${concernLabel} 기준에서 ${runnerUp.name}보다 더 실사용 쪽으로 맞습니다.`;
}

function getEvidenceLead(evidence = []) {
  if (!Array.isArray(evidence)) {
    return "";
  }

  return evidence.find((item) => item?.detail)?.detail || "";
}

function buildEvidenceGroundedReason(
  product,
  answers,
  scoreCard,
  priorityAxis,
  penalties,
  photoEvidence,
  surveyEvidence,
  locale = "ko"
) {
  const concernLabel = getLabel(PRIORITY_LABELS, priorityAxis, locale);
  const slotLabel = getLabel(CATEGORY_SLOT_LABELS, getProductSlot(product.category), locale);
  const texture = product.texture || (locale === "en" ? "light" : "가벼운");
  const finish = normalizeCanonicalFinish(product.finish || "natural").replace(/_/g, " ");
  const avoidance = buildAvoidancePhrase(product, answers, penalties, locale);
  const skinState = buildSkinStatePhrase(answers, scoreCard, locale);
  const photoLead = getEvidenceLead(photoEvidence);
  const surveyLead = getEvidenceLead(surveyEvidence);
  const evidenceLead = photoLead || surveyLead;

  if (locale === "en") {
    const evidenceClause = evidenceLead
      ? ` ${evidenceLead}`
      : " The survey and visible cues both pointed to the same priority.";

    return `${slotLabel} fits ${skinState || "your current skin state"} while ${concernLabel.toLowerCase()} stays in front.${evidenceClause} The ${texture} texture with a ${finish} finish keeps the match away from ${avoidance}.`;
  }

  const evidenceClause = evidenceLead
    ? ` ${evidenceLead}`
    : " 설문과 보이는 단서가 같은 우선순위로 모였습니다.";

  return `${slotLabel}는 ${skinState || "지금 피부 상태"}에서 ${concernLabel} 우선순위를 먼저 받쳐주는 선택입니다.${evidenceClause} ${texture} 텍스처와 ${finish} 마무리라 ${avoidance} 쪽으로 치우치지 않게 잡아줍니다.`;
}

function buildPremiumTopPickReason(
  topPick,
  answers,
  scoreCard,
  priorityAxis,
  warnings,
  photoEvidence,
  surveyEvidence,
  locale = "ko"
) {
  if (!topPick) {
    return "";
  }

  const summaryReason = buildEvidenceGroundedReason(
    topPick,
    answers,
    scoreCard,
    priorityAxis,
    topPick?.decision_meta?.penalty_reasons || [],
    photoEvidence,
    surveyEvidence,
    locale
  );
  const surveyLead = getEvidenceLead(surveyEvidence);
  const photoLead = getEvidenceLead(photoEvidence);
  const lines = [summaryReason];

  if (surveyLead) {
    lines.push(
      locale === "en"
        ? `Survey signal: ${surveyLead}`
        : `설문 근거: ${surveyLead}`
    );
  }

  if (photoLead) {
    lines.push(
      locale === "en"
        ? `Photo signal: ${photoLead}`
        : `사진 근거: ${photoLead}`
    );
  }

  if (warnings?.[0]) {
    lines.push(
      locale === "en"
        ? `Constraint to respect: ${warnings[0]}`
        : `함께 지킬 제약: ${warnings[0]}`
    );
  }

  const reviewEvidence = buildReviewEvidenceSentence(topPick?.review_signals, locale);

  if (reviewEvidence) {
    lines.push(reviewEvidence);
  }

  return lines.filter(Boolean).join(" ");
}

function formatEvidenceItem(axis, label, detail) {
  return {
    axis,
    label: String(label || "").trim(),
    detail: String(detail || "").trim()
  };
}

function buildSurveyEvidence(answers, scoreCard, locale = "ko") {
  const items = [];
  const concernLabel = getLabel(PRIORITY_LABELS, answers.mainConcern || answers.mainConcerns?.[0], locale);

  if (concernLabel) {
    items.push(
      formatEvidenceItem(
        answers.mainConcern || answers.mainConcerns?.[0],
        locale === "en" ? "Survey priority" : "설문 우선 고민",
        locale === "en"
          ? `${concernLabel} was selected as the lead concern.`
          : `${concernLabel}을(를) 주요 고민으로 선택했습니다.`
      )
    );
  }

  if (answers.postWashFeeling === "tight") {
    items.push(
      formatEvidenceItem(
        "dehydration",
        locale === "en" ? "After-cleansing feel" : "세안 후 느낌",
        locale === "en"
          ? "Tightness after cleansing pushed dehydration and barrier support higher."
          : "세안 후 당김이 있어 건조와 장벽 점수를 올렸습니다."
      )
    );
  }

  if (answers.afternoonSkinChange === "more_oily") {
    items.push(
      formatEvidenceItem(
        "oiliness",
        locale === "en" ? "Afternoon change" : "오후 피부 변화",
        locale === "en"
          ? "Midday oil rise pushed oiliness and pores higher."
          : "오후 유분 증가가 유분과 모공 점수를 끌어올렸습니다."
      )
    );
  }

  if (answers.afternoonSkinChange === "red_or_irritated") {
    items.push(
      formatEvidenceItem(
        "redness",
        locale === "en" ? "Afternoon change" : "오후 피부 변화",
        locale === "en"
          ? "Afternoon irritation pushed redness and barrier higher."
          : "오후 예민함이 붉은기와 장벽 점수를 올렸습니다."
      )
    );
  }

  if (answers.outdoorExposure || (Array.isArray(answers.environmentExposure) && answers.environmentExposure.includes("outdoor"))) {
    items.push(
      formatEvidenceItem(
        "uv",
        locale === "en" ? "Outdoor exposure" : "야외 노출",
        locale === "en"
          ? "Outdoor exposure kept UV protection in the top tier."
          : "야외 노출이 있어 자외선 축을 상단 우선순위로 유지했습니다."
      )
    );
  }

  if (answers.sensitivity === "high" || scoreCard.barrier.total >= 18) {
    items.push(
      formatEvidenceItem(
        "barrier",
        locale === "en" ? "Sensitivity guardrail" : "민감도 가드레일",
        locale === "en"
          ? "Higher sensitivity increased barrier-first weighting."
          : "민감도가 높아 장벽 우선 가중치를 더했습니다."
      )
    );
  }

  return items.slice(0, 4);
}

function buildWarnings(answers, scoreCard, priorityAxis, locale = "ko") {
  const warnings = [];

  if (answers.sensitivity === "high" || scoreCard.redness.total >= 18 || scoreCard.barrier.total >= 18) {
    warnings.push(
      locale === "en"
        ? "Keep exfoliating pads and deep-cleansing steps on a short leash while the barrier looks unsettled."
        : "장벽이 흔들리는 동안에는 각질 패드와 강한 딥클렌징 빈도를 짧게 묶는 편이 안전합니다."
    );
  }

  if (scoreCard.dehydration.total >= 18 && scoreCard.oiliness.total >= 16) {
    warnings.push(
      locale === "en"
        ? "Do not overcorrect shine with matte or stripping steps when dehydration is climbing too."
        : "건조도 같이 올라올 때는 유분만 잡겠다고 매트하거나 벗겨내는 쪽으로 몰지 않는 편이 좋습니다."
    );
  }

  if (priorityAxis === "uv" || scoreCard.uv.total >= 16) {
    warnings.push(
      locale === "en"
        ? "UV protection is carrying practical weight here, so skipping sunscreen will collapse the daytime match."
        : "이번 결과에서는 자외선 축 비중이 높아 낮 시간 선케어를 빼면 매치가 크게 무너집니다."
    );
  }

  return warnings.slice(0, 2);
}

function buildSummary(priorityAxis, topCategory, scoreCard, photoEvidence, surveyEvidence, locale = "ko") {
  const priorityLabel = getLabel(PRIORITY_LABELS, priorityAxis, locale);
  const categoryLabel = getLabel(CATEGORY_SLOT_LABELS, topCategory, locale);
  const surveyLead = surveyEvidence[0]?.detail || "";
  const photoLead = photoEvidence[0]?.detail || "";

  if (locale === "en") {
    return [
      `${priorityLabel} is leading the decision, so ${categoryLabel.toLowerCase()} moved to the front.`,
      photoLead || surveyLead || "Survey and photo evidence both pushed the same priority higher."
    ].join("\n");
  }

  return [
    `${priorityLabel} 축이 먼저 올라와 ${categoryLabel}를 맨 앞으로 세웠습니다.`,
    photoLead || surveyLead || "설문과 사진 근거가 같은 우선순위로 모였습니다."
  ].join("\n");
}

function buildAmFocus(priorityAxis, topCategory, scoreCard, locale = "ko") {
  if (locale === "en") {
    if (priorityAxis === "uv") {
      return "Keep the morning routine light enough that sunscreen is easy to wear in a full amount.";
    }

    if (priorityAxis === "oiliness" || priorityAxis === "pores") {
      return "Reset surface oil early, then keep the finish clean so shine does not rebound by midday.";
    }

    if (priorityAxis === "barrier" || priorityAxis === "dehydration") {
      return "Hold water in early and avoid a finish that starts feeling tight before noon.";
    }

    return `Keep the morning routine centered on ${getLabel(CATEGORY_SLOT_LABELS, topCategory, locale).toLowerCase()} without adding extra drag.`;
  }

  if (priorityAxis === "uv") {
    return "아침에는 선크림을 충분히 바를 수 있게 앞단을 가볍게 정리하는 쪽이 핵심입니다.";
  }

  if (priorityAxis === "oiliness" || priorityAxis === "pores") {
    return "아침에는 표면 유분을 먼저 정리하고 오후에 번들막이 늦게 올라오게 만드는 쪽이 핵심입니다.";
  }

  if (priorityAxis === "barrier" || priorityAxis === "dehydration") {
    return "아침에는 수분이 중간에 끊기지 않게 잡아 두고 일찍 당기지 않게 만드는 쪽이 핵심입니다.";
  }

  return `아침에는 ${getLabel(CATEGORY_SLOT_LABELS, topCategory, locale)} 중심으로 맞추되 레이어 부담은 늘리지 않는 쪽이 핵심입니다.`;
}

function buildPmFocus(priorityAxis, locale = "ko") {
  if (locale === "en") {
    if (priorityAxis === "acne" || priorityAxis === "redness") {
      return "Use the evening routine to lower friction and calm reactivity instead of chasing a harsher reset.";
    }

    if (priorityAxis === "barrier" || priorityAxis === "dehydration") {
      return "Use the evening routine to leave the barrier quieter and more comfortable by morning.";
    }

    return "Use the evening routine to correct the main concern without stacking more steps than the skin can hold.";
  }

  if (priorityAxis === "acne" || priorityAxis === "redness") {
    return "저녁에는 강하게 리셋하기보다 마찰과 자극을 낮춰서 피부가 조용해지는 쪽으로 가져가는 게 좋습니다.";
  }

  if (priorityAxis === "barrier" || priorityAxis === "dehydration") {
    return "저녁에는 다음 날 아침까지 장벽이 덜 흔들리고 편안하게 남는 쪽으로 가져가는 게 좋습니다.";
  }

  return "저녁에는 메인 고민만 바로잡고 피부가 버거워할 만큼 단계를 늘리지 않는 쪽이 좋습니다.";
}

function buildDecisionProduct(product, answers, scoreCard, priorityAxis, targetSlot, locale = "ko") {
  const scored =
    product.category === "sunscreen"
      ? scoreSunscreenProduct(product, answers)
      : scoreCanonicalProduct(product, answers);
  const environmentAdjustment = getEnvironmentAdjustment(product, answers, scoreCard);
  const heroBoost = getHeroBoost(product, answers, scoreCard, targetSlot);
  const reviewSignal = computeReviewSignalScore(product.review_signals, answers, product);
  const hardPenalty = getHardPenalty(product, answers, scoreCard);
  const finalScore =
    scored.score +
    environmentAdjustment.total +
    heroBoost.total +
    reviewSignal.total +
    hardPenalty.total;

  return {
    ...scored,
    score_breakdown: {
      ...(scored.score_breakdown || {}),
      review_signal_score: reviewSignal.total
    },
    step: getLabel(STEP_LABELS, getProductSlot(product.category), locale),
    reason: appendReviewEvidenceSentence(
      buildDefaultReason(product, answers, scoreCard, priorityAxis, hardPenalty.reasons, locale),
      product.review_signals,
      locale
    ),
    comparison_reason: "",
    decision_meta: {
      base_score: scored.score,
      environment_adjustment: environmentAdjustment.total,
      hero_boost: heroBoost.total,
      review_signal_score: reviewSignal.total,
      hard_penalty: hardPenalty.total,
      final_score: finalScore,
      slot: getProductSlot(product.category),
      environment_reasons: environmentAdjustment.reasons,
      hero_reasons: heroBoost.reasons,
      penalty_reasons: hardPenalty.reasons
    },
    engine_score: finalScore
  };
}

function buildAltPicks(sortedProducts, topPick, targetSlot, priorityAxis, locale = "ko") {
  const picks = [];
  const usedIds = new Set(topPick ? [topPick.id] : []);
  const usedSlots = new Set();

  const sameSlotRunnerUp = sortedProducts.find(
    (product) => product.id !== topPick?.id && product.decision_meta?.slot === targetSlot
  );

  if (sameSlotRunnerUp) {
    usedIds.add(sameSlotRunnerUp.id);
    usedSlots.add(sameSlotRunnerUp.decision_meta.slot);
    picks.push(sameSlotRunnerUp);
  }

  for (const product of sortedProducts) {
    if (picks.length >= 3 || usedIds.has(product.id)) {
      continue;
    }

    if (usedSlots.has(product.decision_meta?.slot)) {
      continue;
    }

    usedIds.add(product.id);
    usedSlots.add(product.decision_meta?.slot);
    picks.push(product);
  }

  if (!picks.length && sortedProducts[1]) {
    picks.push(sortedProducts[1]);
  }

  const runnerById = new Map(
    sortedProducts.map((product, index) => {
      const runnerUp = sortedProducts[index + 1] || null;
      return [
        product.id,
        buildDefaultComparisonReason(product, runnerUp, priorityAxis, locale)
      ];
    })
  );

  return picks
    .filter(Boolean)
    .map((product) => ({
      ...product,
      comparison_reason: runnerById.get(product.id) || product.comparison_reason
    }));
}

function normalizePhotoEvidence(photoAnalysis) {
  return Array.isArray(photoAnalysis?.evidence)
    ? photoAnalysis.evidence
        .map((item) => formatEvidenceItem(item.axis, item.label, item.detail))
        .filter((item) => item.label || item.detail)
        .slice(0, 3)
    : [];
}

function buildPremiumRoutineByStructure(topPick, supportingProducts, routineStructure, locale = "ko") {
  const morning = [];
  const night = [];
  const primaryCard = Array.isArray(routineStructure?.cards) ? routineStructure.cards[0] : null;
  const type = routineStructure?.type || "am_pm_balanced";

  if (type === "am_only") {
    if (primaryCard?.body) {
      morning.push(primaryCard.body);
    }

    if (topPick?.step) {
      morning.push(
        locale === "en"
          ? `Keep ${topPick.step.toLowerCase()} as the main decision step before you widen the routine further.`
          : `${topPick.step}를 아침 핵심 단계로 두고 다른 단계를 넓히는 순서를 뒤로 미루는 편이 맞습니다.`
      );
    }

    if (supportingProducts[0]?.step) {
      morning.push(
        locale === "en"
          ? `Only add ${supportingProducts[0].step.toLowerCase()} when the skin still feels easy after the main step.`
          : `메인 단계 뒤에도 피부가 가볍게 받는 날에만 ${supportingProducts[0].step}를 보조로 붙이는 구성이 좋습니다.`
      );
    }
  } else if (type === "pm_only") {
    if (primaryCard?.body) {
      night.push(primaryCard.body);
    }

    if (topPick?.step) {
      night.push(
        locale === "en"
          ? `Use ${topPick.step.toLowerCase()} as the main correction step at night before adding anything else.`
          : `${topPick.step}를 저녁 보정 단계의 중심으로 두고 다른 단계를 덧붙이는 순서가 맞습니다.`
      );
    }

    if (supportingProducts[0]?.step) {
      night.push(
        locale === "en"
          ? `Layer ${supportingProducts[0].step.toLowerCase()} only when the skin can comfortably hold more at night.`
          : `저녁에 피부가 더 받을 수 있는 날에만 ${supportingProducts[0].step}를 첫 보조 단계로 붙이는 구성이 좋습니다.`
      );
    }
  } else if (type === "single_track") {
    if (primaryCard?.body) {
      morning.push(primaryCard.body);
    }

    if (topPick?.step) {
      morning.push(
        locale === "en"
          ? `Keep ${topPick.step.toLowerCase()} as the one steady correction lane across the day.`
          : `${topPick.step}를 하루 전체에서 흔들리지 않는 단일 보정 축으로 두는 구성이 맞습니다.`
      );
    }

    if (supportingProducts[0]?.step) {
      morning.push(
        locale === "en"
          ? `Bring in ${supportingProducts[0].step.toLowerCase()} only when you intentionally want to widen the routine.`
          : `루틴을 넓히고 싶은 날에만 ${supportingProducts[0].step}를 추가로 붙이는 정도가 적당합니다.`
      );
    }
  } else {
    const morningCard = Array.isArray(routineStructure?.cards)
      ? routineStructure.cards.find((item) => item.key === "morning")
      : null;
    const nightCard = Array.isArray(routineStructure?.cards)
      ? routineStructure.cards.find((item) => item.key === "night")
      : null;

    if (morningCard?.body) {
      morning.push(morningCard.body);
    }

    if (nightCard?.body) {
      night.push(nightCard.body);
    }

    if (topPick?.step) {
      if (locale === "en") {
        morning.push(`Keep ${topPick.step.toLowerCase()} as the main decision step in the morning flow.`);
        night.push(`Use ${topPick.step.toLowerCase()} as the correction step at night before adding anything else.`);
      } else {
        morning.push(`${topPick.step}를 아침 흐름의 메인 결정 단계로 두는 구성이 맞습니다.`);
        night.push(`${topPick.step}를 저녁 보정 단계의 중심으로 두고 다른 단계를 덧붙이는 구성이 맞습니다.`);
      }
    }

    if (supportingProducts[0]?.step) {
      if (locale === "en") {
        night.push(`Layer ${supportingProducts[0].step.toLowerCase()} as the first supporting step when the skin can hold more.`);
      } else {
        night.push(`피부가 더 받을 수 있는 날에는 ${supportingProducts[0].step}를 첫 보조 단계로 붙이는 구성이 좋습니다.`);
      }
    }
  }

  return {
    morning: morning.filter(Boolean).slice(0, 3),
    night: night.filter(Boolean).slice(0, 3)
  };
}

function buildPremiumRoutine(topPick, supportingProducts, routineStructure, locale = "ko") {
  return buildPremiumRoutineByStructure(topPick, supportingProducts, routineStructure, locale);
}

function buildAvoidCombinations(answers, warnings, locale = "ko") {
  const items = [...warnings];

  if (answers.sensitivity === "high") {
    items.push(
      locale === "en"
        ? "Do not stack a harsh cleanser and a friction-heavy pad in the same short routine window."
        : "강한 클렌저와 마찰이 큰 패드를 같은 짧은 루틴 안에 겹치지 않는 편이 좋습니다."
    );
  }

  if (answers.postWashFeeling === "tight") {
    items.push(
      locale === "en"
        ? "Do not pair a drying cleanse with a matte finish when tightness is already visible."
        : "이미 당김이 보일 때는 건조한 세정감과 매트한 마무리를 같은 흐름으로 묶지 않는 편이 좋습니다."
    );
  }

  return items.filter(Boolean).slice(0, 3);
}

function buildBudgetAlternatives(scoredProducts, topPick, locale = "ko") {
  const topPriceMin = Number(topPick?.price_min || 0) || Number.MAX_SAFE_INTEGER;
  const topSlot = topPick?.decision_meta?.slot;

  return scoredProducts
    .filter((product) => product.id !== topPick?.id)
    .filter((product) => product.decision_meta?.slot === topSlot)
    .filter((product) => {
      const priceMin = Number(product.price_min || 0) || 0;
      return topPriceMin === Number.MAX_SAFE_INTEGER || (priceMin > 0 && priceMin < topPriceMin);
    })
    .slice(0, 2)
    .map((product) => ({
      id: product.id,
      name: product.name,
      brand: product.brand,
      step: product.step,
      price_range: product.price_range || "",
      summary:
        locale === "en"
          ? `${product.step} stays in the same decision lane at a lighter price band.`
          : `${product.step} 축을 유지하면서 가격 부담을 조금 덜어낸 선택지입니다.`
    }));
}

export async function buildSkinMatchDecisionBundle(input, options = {}) {
  const locale = getLocale(options.locale);
  const products = Array.isArray(options.products) && options.products.length
    ? options.products
    : await getRecommendationProducts();
  const answers = normalizeRecommendationAnswers(input);
  const scoreCard = createScoreCard();
  const photoAnalysis = options.photoAnalysis || { signals: {}, evidence: [] };

  applySurveyWeights(scoreCard, answers);
  applyEnvironmentWeights(scoreCard, answers);
  applyPhotoWeights(scoreCard, photoAnalysis);

  const priority = getPriority(scoreCard);
  const targetSlot = getTopCategorySlot(priority.axis, answers, scoreCard);
  const photoEvidence = normalizePhotoEvidence(photoAnalysis);
  const surveyEvidence = buildSurveyEvidence(answers, scoreCard, locale);

  const scoredProducts = products
    .filter((product) => product?.id && product?.name && product?.brand)
    .map((product) => buildDecisionProduct(product, answers, scoreCard, priority.axis, targetSlot, locale))
    .sort((left, right) => {
      if (right.engine_score !== left.engine_score) {
        return right.engine_score - left.engine_score;
      }

      return right.score - left.score;
    });

  const topPick =
    scoredProducts.find((product) => product.decision_meta?.slot === targetSlot) ||
    scoredProducts[0] ||
    null;
  const allAltPicks = buildAltPicks(scoredProducts, topPick, targetSlot, priority.axis, locale);
  const topPickRunnerUp = allAltPicks[0] || scoredProducts.find((product) => product.id !== topPick?.id) || null;
  const resolvedTopPick = topPick
    ? {
        ...topPick,
        reason: buildEvidenceGroundedReason(
          topPick,
          answers,
          scoreCard,
          priority.axis,
          topPick?.decision_meta?.penalty_reasons || [],
          photoEvidence,
          surveyEvidence,
          locale
        ),
        comparison_reason: buildDefaultComparisonReason(topPick, topPickRunnerUp, priority.axis, locale)
      }
    : null;
  const resolvedAltPicks = allAltPicks.map((product) => ({
    ...product,
    reason: buildEvidenceGroundedReason(
      product,
      answers,
      scoreCard,
      priority.axis,
      product?.decision_meta?.penalty_reasons || [],
      photoEvidence,
      surveyEvidence,
      locale
    )
  }));
  const freeAltPick = resolvedAltPicks[0] || null;
  const supportingProducts = resolvedAltPicks.slice(0, 3);
  const allWarnings = buildWarnings(answers, scoreCard, priority.axis, locale);
  const warnings = allWarnings.slice(0, 1);
  const summary = buildSummary(priority.axis, targetSlot, scoreCard, photoEvidence, surveyEvidence, locale);
  const amFocus = buildAmFocus(priority.axis, targetSlot, scoreCard, locale);
  const pmFocus = buildPmFocus(priority.axis, locale);
  const routineStructure = buildRoutineStructure(priority.axis, targetSlot, scoreCard, amFocus, pmFocus, locale);
  const publicRoutine = buildPublicRoutineLists(routineStructure);
  const premiumRoutine = buildPremiumRoutine(resolvedTopPick, supportingProducts, routineStructure, locale);
  const premiumReport = {
    topPickDetailedReason: buildPremiumTopPickReason(
      resolvedTopPick,
      answers,
      scoreCard,
      priority.axis,
      allWarnings,
      photoEvidence,
      surveyEvidence,
      locale
    ),
    supportingProducts,
    routineStructure,
    fullRoutine: premiumRoutine,
    avoidCombinations: buildAvoidCombinations(answers, allWarnings, locale),
    budgetAlternatives: buildBudgetAlternatives(scoredProducts, resolvedTopPick, locale)
  };

  return {
    summary,
    priority: {
      axis: priority.axis,
      label: getLabel(PRIORITY_LABELS, priority.axis, locale),
      score: priority.score,
      topCategory: targetSlot,
      topCategoryLabel: getLabel(CATEGORY_SLOT_LABELS, targetSlot, locale)
    },
    topPick: resolvedTopPick,
    altPicks: freeAltPick ? [freeAltPick] : [],
    amFocus,
    pmFocus,
    routineStructure,
    warnings,
    photoEvidence,
    surveyEvidence,
    alternative: freeAltPick,
    categoryPicks: freeAltPick ? [freeAltPick] : [],
    products: [resolvedTopPick, freeAltPick].filter(Boolean),
    explanationProducts: [resolvedTopPick, ...supportingProducts].filter(Boolean),
    premiumReport,
    morning: publicRoutine.morning,
    night: publicRoutine.night,
    avoid: warnings,
    scoring: {
      version: "skin-match-v2",
      deterministic: true,
      concernScores: Object.fromEntries(
        CONCERN_AXES.map((axis) => [
          axis,
          {
            total: scoreCard[axis].total,
            survey: scoreCard[axis].survey,
            photo: scoreCard[axis].photo,
            environment: scoreCard[axis].environment
          }
        ])
      )
    }
  };
}
