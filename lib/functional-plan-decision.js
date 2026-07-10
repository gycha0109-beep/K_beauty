const CONCERN_AXES = [
  "barrier",
  "redness",
  "dehydration",
  "oiliness",
  "acne",
  "pores",
  "uneven_tone"
];

const GOAL_BY_CONCERN = {
  pores: {
    primaryGoal: "pores_texture",
    functionalDirection: "exfoliation"
  },
  oiliness: {
    primaryGoal: "oil_acne",
    functionalDirection: "acne_care"
  },
  acne: {
    primaryGoal: "oil_acne",
    functionalDirection: "acne_care"
  },
  redness: {
    primaryGoal: "barrier_redness",
    functionalDirection: "soothing"
  },
  barrier: {
    primaryGoal: "barrier_redness",
    functionalDirection: "barrier_support"
  },
  dehydration: {
    primaryGoal: "dehydration",
    functionalDirection: "hydration"
  },
  uneven_tone: {
    primaryGoal: "uneven_tone",
    functionalDirection: "tone_care"
  }
};

const TARGET_CATEGORIES_BY_DIRECTION = {
  exfoliation: ["toner_pad", "treatment"],
  acne_care: ["toner_pad", "treatment"],
  soothing: [
    "toner_essence",
    "treatment",
    "moisturizer_cream",
    "moisturizer_lotion_emulsion",
    "moisturizer_gel"
  ],
  barrier_support: ["moisturizer_cream", "moisturizer_lotion_emulsion", "moisturizer_balm"],
  hydration: [
    "toner_essence",
    "moisturizer_cream",
    "moisturizer_lotion_emulsion",
    "moisturizer_gel"
  ],
  tone_care: ["treatment", "serum", "ampoule", "essence"]
};

const AVOID_WITH_BY_DIRECTION = {
  exfoliation: ["physical_scrub", "multiple_exfoliation", "high_frequency_acid"],
  acne_care: ["multiple_acne_actives", "harsh_cleansing", "multiple_exfoliation"],
  soothing: ["new_active_stack", "strong_exfoliation"],
  barrier_support: ["strong_exfoliation", "over_cleansing"],
  hydration: ["over_cleansing", "high_frequency_exfoliation"],
  tone_care: ["strong_exfoliation_same_day", "multiple_tone_actives"]
};

const ROUTINE_GUIDE_BY_DIRECTION = {
  exfoliation: {
    slot: "PM",
    frequency: "weekly_2",
    note: "저녁 주 2회 이하로 시작해 반응을 확인합니다."
  },
  acne_care: {
    slot: "PM",
    frequency: "weekly_2_to_3",
    note: "트러블·피지 축은 한 번에 여러 제품을 늘리지 않습니다."
  },
  soothing: {
    slot: "AM_PM",
    frequency: "daily",
    note: "진정·장벽 보조 제품은 루틴의 안정감을 먼저 확인합니다."
  },
  barrier_support: {
    slot: "AM_PM",
    frequency: "daily",
    note: "보습제 단계에서 장벽 보조를 우선합니다."
  },
  hydration: {
    slot: "AM_PM",
    frequency: "daily",
    note: "수분 공급과 보습 유지 단계를 함께 봅니다."
  },
  tone_care: {
    slot: "AM_or_PM",
    frequency: "weekly_3_to_daily",
    note: "피부 반응을 보며 천천히 빈도를 올립니다."
  }
};

const ACTIVE_DIRECTIONS = new Set(["exfoliation", "acne_care", "tone_care"]);

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number.parseFloat(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function getConcernScoreValue(value) {
  if (value && typeof value === "object") {
    return parseNumber(value.total ?? value.score ?? value.value);
  }

  return parseNumber(value);
}

function getConcernScores(freeResult = {}) {
  const rawScores =
    freeResult?.scoring?.concernScores ||
    freeResult?.scoreCard?.concernScores ||
    freeResult?.concernScores ||
    {};
  const scores = {};

  CONCERN_AXES.forEach((axis) => {
    scores[axis] = getConcernScoreValue(rawScores?.[axis]);
  });

  return scores;
}

function getPriorityConcern(freeResult = {}) {
  return normalizeText(
    freeResult?.priority?.axis ||
      freeResult?.priority?.concern ||
      freeResult?.form?.mainConcern ||
      freeResult?.mainConcern ||
      (Array.isArray(freeResult?.form?.mainConcerns) ? freeResult.form.mainConcerns[0] : "")
  );
}

function hasUsableSignal(freeResult = {}, scores = {}) {
  return Boolean(
    getPriorityConcern(freeResult) ||
      CONCERN_AXES.some((axis) => scores[axis] > 0) ||
      freeResult?.priority
  );
}

function getRankedConcerns(scores = {}) {
  return CONCERN_AXES.map((axis) => ({
    axis,
    score: scores[axis] || 0
  }))
    .filter((item) => item.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return CONCERN_AXES.indexOf(left.axis) - CONCERN_AXES.indexOf(right.axis);
    });
}

function isPercentScale(scores = {}) {
  return Math.max(...Object.values(scores).map((value) => Number(value) || 0), 0) > 40;
}

function isHighConcernScore(value, scores = {}) {
  return isPercentScale(scores) ? value >= 70 : value >= 18;
}

function isVeryHighConcernScore(value, scores = {}) {
  return isPercentScale(scores) ? value >= 85 : value >= 24;
}

function getSensitivityLevel(freeResult = {}) {
  return normalizeText(
    freeResult?.form?.sensitivity ||
      freeResult?.form?.sensitivityLevel ||
      freeResult?.sensitivity ||
      freeResult?.sensitivityLevel ||
      freeResult?.sensitivity_level
  );
}

function getSensitivityScore(freeResult = {}) {
  return parseNumber(
    freeResult?.sensitivityScore ||
      freeResult?.scores?.sensitivity ||
      freeResult?.scoring?.sensitivity ||
      freeResult?.form?.sensitivityScore
  );
}

function isHighSensitivity(freeResult = {}) {
  const level = getSensitivityLevel(freeResult);
  const score = getSensitivityScore(freeResult);

  return (
    level === "high" ||
    level === "very_high" ||
    Boolean(freeResult?.form?.verySensitivePeriod || freeResult?.verySensitivePeriod) ||
    score >= 75 ||
    (score > 0 && score <= 30 && score >= 18)
  );
}

function resolveConcernToGoal(axis) {
  return GOAL_BY_CONCERN[normalizeText(axis)] || null;
}

function resolveSecondaryGoal(primaryGoal, priorityConcern, scores) {
  const ranked = getRankedConcerns(scores);
  const secondaryPriority = normalizeText(priorityConcern);
  const explicitSecondary = normalizeText(
    priorityConcern?.secondary ||
      priorityConcern?.secondaryAxis ||
      priorityConcern?.secondaryConcern
  );
  const candidates = [explicitSecondary, ...ranked.map((item) => item.axis)].filter(Boolean);

  for (const axis of candidates) {
    if (axis === secondaryPriority) {
      continue;
    }

    const goal = resolveConcernToGoal(axis)?.primaryGoal;

    if (goal && goal !== primaryGoal) {
      return goal;
    }
  }

  return null;
}

function getSuppression({ freeResult, scores, functionalDirection }) {
  const sensitivityHigh = isHighSensitivity(freeResult);
  const rednessHigh = isHighConcernScore(scores.redness, scores);
  const barrierHigh = isHighConcernScore(scores.barrier, scores);
  const dehydrationHigh = isHighConcernScore(scores.dehydration, scores);

  if (sensitivityHigh && (rednessHigh || barrierHigh)) {
    return {
      recommendationSuppressed: true,
      suppressionReason: "sensitivity_barrier"
    };
  }

  if (dehydrationHigh && ACTIVE_DIRECTIONS.has(functionalDirection)) {
    return {
      recommendationSuppressed: true,
      suppressionReason: "dryness_with_active"
    };
  }

  if (isVeryHighConcernScore(scores.redness, scores) || isVeryHighConcernScore(scores.barrier, scores)) {
    return {
      recommendationSuppressed: true,
      suppressionReason: "redness_instability"
    };
  }

  return {
    recommendationSuppressed: false,
    suppressionReason: null
  };
}

function buildReason({ priorityConcern, hasSignals, source, primaryGoal, functionalDirection }) {
  if (!hasSignals) {
    return "freeResult signal unavailable; hydration fallback applied";
  }

  return `${source} selected ${priorityConcern || "fallback"}; ${primaryGoal}/${functionalDirection} applied`;
}

export function buildFunctionalPlanDecision({ freeResult } = {}) {
  const scores = getConcernScores(freeResult);
  const hasSignals = hasUsableSignal(freeResult, scores);

  if (!hasSignals) {
    return {
      primaryGoal: "dehydration",
      secondaryGoal: null,
      functionalDirection: "hydration",
      targetCategories: [...TARGET_CATEGORIES_BY_DIRECTION.hydration],
      avoidWith: [],
      routineGuide: {
        slot: "AM_PM",
        frequency: "daily",
        note: "기본 보습 루틴을 우선 확인합니다."
      },
      recommendationSuppressed: false,
      suppressionReason: null,
      reason: "freeResult signal unavailable; hydration fallback applied"
    };
  }

  const priorityConcern = getPriorityConcern(freeResult);
  const rankedConcern = getRankedConcerns(scores)[0]?.axis || "";
  const selectedConcern = resolveConcernToGoal(priorityConcern)
    ? priorityConcern
    : resolveConcernToGoal(rankedConcern)
      ? rankedConcern
      : "dehydration";
  const resolved = resolveConcernToGoal(selectedConcern) || GOAL_BY_CONCERN.dehydration;
  const { recommendationSuppressed, suppressionReason } = getSuppression({
    freeResult,
    scores,
    functionalDirection: resolved.functionalDirection
  });

  return {
    primaryGoal: resolved.primaryGoal,
    secondaryGoal: resolveSecondaryGoal(resolved.primaryGoal, selectedConcern, scores),
    functionalDirection: resolved.functionalDirection,
    targetCategories: [...(TARGET_CATEGORIES_BY_DIRECTION[resolved.functionalDirection] || [])],
    avoidWith: [...(AVOID_WITH_BY_DIRECTION[resolved.functionalDirection] || [])],
    routineGuide: {
      ...(ROUTINE_GUIDE_BY_DIRECTION[resolved.functionalDirection] || ROUTINE_GUIDE_BY_DIRECTION.hydration)
    },
    recommendationSuppressed,
    suppressionReason,
    reason: buildReason({
      priorityConcern: selectedConcern,
      hasSignals,
      source: resolveConcernToGoal(priorityConcern) ? "priority" : "concernScores",
      primaryGoal: resolved.primaryGoal,
      functionalDirection: resolved.functionalDirection
    })
  };
}

export const FUNCTIONAL_PLAN_TAXONOMY = {
  GOAL_BY_CONCERN,
  TARGET_CATEGORIES_BY_DIRECTION,
  AVOID_WITH_BY_DIRECTION,
  ROUTINE_GUIDE_BY_DIRECTION
};
