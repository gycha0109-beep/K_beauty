const FALLBACK_COPY = {
  ko: {
    concernSummary: {
      oiliness: "유분과 번들거림이 빠르게 올라오는 흐름이 먼저 보입니다.",
      dehydration: "건조감이 반복돼 수분과 보습 연결이 먼저 필요해 보입니다.",
      acne: "트러블 부담을 줄이면서 잔여감이 무겁지 않은 구성이 더 먼저 맞습니다.",
      uneven_tone: "톤을 정리하되 과하게 무거운 루틴은 피하는 편이 더 좋습니다.",
      pores: "모공과 번들거림을 함께 보면서 사용감이 가벼운 쪽이 먼저 맞습니다.",
      redness: "붉은기와 예민함을 낮추는 방향이 지금은 더 중요해 보입니다.",
      barrier: "장벽이 흔들리는 흐름이라 저자극 보습 연결이 먼저 필요합니다."
    },
    summarySuffix: {
      tight: "세안 후 당김이 남는 편이라 수분이 끊기지 않게 이어주는 루틴이 중요합니다.",
      still_oily: "세안 직후에도 유분감이 남아 무거운 마무리보다 가벼운 흡수 흐름이 더 맞습니다.",
      default: "지금은 많은 단계를 더하기보다 사용감이 맞는 제품부터 정리하는 편이 안정적입니다."
    },
    strategy: {
      sensitive: "자극 부담을 낮추고 순한 단계부터 맞추세요.",
      oil: "유분을 먼저 정리하고 가벼운 레이어링으로 시작하세요.",
      dry: "수분이 끊기지 않게 얇은 보습 단계를 이어가세요.",
      default: "루틴을 단순하게 두고 기본 단계부터 안정적으로 맞추세요."
    },
    routine: {
      cleanser: "순한 클렌저로 가볍게 세안",
      toner: "가벼운 토너로 수분 연결",
      serum: "메인 고민 중심으로 세럼 한 단계 추가",
      sunscreen: "가벼운 선크림으로 마무리",
      moisturizer: "무겁지 않은 보습으로 마무리"
    },
    avoid: [
      "한 번에 많은 제품을 겹쳐 바르지 않기",
      "피부 상태와 맞지 않는 무거운 제형을 계속 쓰지 않기",
      "강한 세정이나 필링을 자주 반복하지 않기"
    ],
    noteTitle: "가볍게 참고할 포인트",
    noteByAfternoon: {
      more_oily: "오후 유분이 빨리 올라오면 리치한 보습보다 가벼운 레이어링이 더 편하게 이어지는 경우가 많습니다.",
      more_dry: "오후에 다시 건조해지면 기능성보다 수분이 빠지지 않게 잡아주는 쪽이 먼저 체감되기 쉽습니다.",
      red_or_irritated: "열감이나 마찰 자극이 올라오는 날에는 단계를 늘리기보다 저자극으로 단순하게 가는 편이 낫습니다.",
      default: "지금 단계에서는 많이 더하기보다 꾸준히 쓰기 쉬운 제품 몇 개로 루틴을 단순하게 맞추는 편이 좋습니다."
    }
  },
  en: {
    concernSummary: {
      oiliness: "Oil flow and midday shine look like the first thing to settle.",
      dehydration: "Dehydration looks like the main issue, so hydration and moisture support should come first.",
      acne: "Lowering breakout load while keeping residue light looks more important right now.",
      uneven_tone: "Tone concerns matter, but a heavy routine will likely help less than a cleaner one.",
      pores: "Pores and shine should be handled together with lighter-feel products first.",
      redness: "Lowering visible reactivity and irritation looks more important right now.",
      barrier: "Your barrier looks easier to support with a simpler, low-irritation routine first."
    },
    summarySuffix: {
      tight: "Post-wash tightness suggests hydration needs to stay connected through the routine.",
      still_oily: "If skin still feels oily after washing, lighter absorption will likely work better than a heavier finish.",
      default: "A simpler routine built around texture match will probably feel steadier right now."
    },
    strategy: {
      sensitive: "Lower irritation load and start with gentler steps first.",
      oil: "Control oil flow first and keep the layering lighter.",
      dry: "Keep hydration connected with thinner moisturizing steps.",
      default: "Keep the routine simple and stabilize the basics first."
    },
    routine: {
      cleanser: "Cleanse lightly with a gentle cleanser",
      toner: "Add hydration with a light toner",
      serum: "Add one serum focused on the main concern",
      sunscreen: "Finish with a light sunscreen",
      moisturizer: "Seal in with a light moisturizer"
    },
    avoid: [
      "Do not layer too many products at once",
      "Do not keep forcing heavy textures that feel off",
      "Do not repeat harsh cleansing or exfoliation too often"
    ],
    noteTitle: "Quick note",
    noteByAfternoon: {
      more_oily: "When shine rises quickly in the afternoon, lighter layering often stays more comfortable than richer moisture.",
      more_dry: "If skin dries out again in the afternoon, holding water in usually feels better before stronger actives.",
      red_or_irritated: "On days with heat or friction sensitivity, fewer low-irritation steps often feel steadier.",
      default: "Right now, a smaller set of easy-to-repeat products will likely feel better than adding more steps."
    }
  }
};

function getCopy(locale = "ko") {
  return FALLBACK_COPY[locale] || FALLBACK_COPY.ko;
}

function getConcernSummary(mainConcern, locale = "ko") {
  const copy = getCopy(locale);
  return copy.concernSummary[mainConcern] || copy.concernSummary.barrier;
}

function buildSummary(input, locale = "ko") {
  const firstLine = getConcernSummary(input.mainConcern, locale);
  const copy = getCopy(locale);

  if (input.postWashFeeling === "tight") {
    return `${firstLine}\n${copy.summarySuffix.tight}`;
  }

  if (input.postWashFeeling === "still_oily") {
    return `${firstLine}\n${copy.summarySuffix.still_oily}`;
  }

  return `${firstLine}\n${copy.summarySuffix.default}`;
}

function buildStrategy(input, locale = "ko") {
  const copy = getCopy(locale);

  if (input.sensitivity === "high" || input.mainConcern === "redness" || input.mainConcern === "barrier") {
    return copy.strategy.sensitive;
  }

  if (input.mainConcern === "oiliness" || input.mainConcern === "pores") {
    return copy.strategy.oil;
  }

  if (input.mainConcern === "dehydration") {
    return copy.strategy.dry;
  }

  return copy.strategy.default;
}

function buildMorning(input, locale = "ko") {
  const copy = getCopy(locale);

  return [
    copy.routine.cleanser,
    copy.routine.toner,
    input.mainConcern === "oiliness" || input.mainConcern === "pores"
      ? copy.routine.sunscreen
      : copy.routine.moisturizer
  ];
}

function buildNight(input, locale = "ko") {
  const copy = getCopy(locale);

  return [
    copy.routine.cleanser,
    copy.routine.serum,
    copy.routine.moisturizer
  ];
}

function buildAvoid(locale = "ko") {
  return getCopy(locale).avoid.slice(0, 3);
}

function buildOptionalNote(input, locale = "ko") {
  const copy = getCopy(locale);
  const description =
    copy.noteByAfternoon[input.afternoonSkinChange] || copy.noteByAfternoon.default;

  return {
    title: copy.noteTitle,
    description
  };
}

function buildFallbackPhotoObservations(locale = "ko") {
  return {
    summary: locale === "en"
      ? "The photo did not provide enough reliable detail, so the result is organized mainly around the survey answers."
      : "사진 상태를 기준으로 세부 관찰을 확정하기 어려워, 설문 답변을 중심으로 결과를 정리했습니다.",
    signals: [],
    surveyAlignment: {
      status: "unknown",
      note: locale === "en"
        ? "Photo analysis was limited, so the survey answers were prioritized."
        : "사진 분석이 제한되어 설문 답변을 우선 반영했습니다."
    }
  };
}

export function buildRuleBasedPlan(input = {}, locale = "ko") {
  return {
    summary: buildSummary(input, locale),
    strategy: buildStrategy(input, locale),
    morning: buildMorning(input, locale),
    night: buildNight(input, locale),
    avoid: buildAvoid(locale),
    funInsight: buildOptionalNote(input, locale)
  };
}

export function buildFallbackAnalysis(input = {}, recommendation, plan = buildRuleBasedPlan(input), locale = "ko") {
  return {
    summary: plan.summary,
    strategy: plan.strategy,
    morning: plan.morning,
    night: plan.night,
    avoid: plan.avoid,
    topPick: recommendation.topPick,
    categoryPicks: recommendation.categoryPicks,
    alternative: recommendation.alternative,
    products: recommendation.products,
    photoObservations: buildFallbackPhotoObservations(locale),
    funInsight: plan.funInsight || buildOptionalNote(input, locale),
    scoring: recommendation.scoring
  };
}
