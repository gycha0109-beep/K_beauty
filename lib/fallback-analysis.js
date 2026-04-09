import { buildOptionalSkinNote } from "@/lib/recommendation";

const concernSummary = {
  oiliness: "유분이 빠르게 올라오는 피부라면 가벼운 사용감과 번들 지연이 먼저 중요합니다.",
  dehydration: "건조감이 오래 남는 피부라면 수분 유지와 보습 마무리가 먼저 중요합니다.",
  acne: "트러블이 반복되는 피부라면 자극 부담과 잔여감을 먼저 줄이는 쪽이 좋습니다.",
  uneven_tone: "톤이 쉽게 칙칙해진다면 무겁지 않은 루틴 위에서 결 정리가 먼저 중요합니다.",
  pores: "모공과 번들거림이 함께 신경 쓰이면 세정감과 오후 피지 흐름을 먼저 봐야 합니다.",
  redness: "붉은 기운이 쉽게 올라오면 진정감과 저자극 흐름을 먼저 맞추는 편이 좋습니다.",
  barrier: "장벽이 약해진 느낌이면 강한 기능보다 편안한 보습 흐름을 먼저 안정시키는 편이 좋습니다."
};

const textureLabel = {
  watery: "워터리",
  gel: "젤",
  lotion: "로션",
  cream: "크림"
};

function buildSummary(input) {
  const lines = [];
  lines.push(concernSummary[input.mainConcern] || concernSummary.barrier);

  if (input.postWashFeeling === "tight") {
    lines.push("세안 후 당김이 남아 과한 세정력보다 보습 연결감이 더 중요합니다.");
  } else if (input.postWashFeeling === "still_oily") {
    lines.push("세안 직후에도 유분감이 남아 무거운 마무리보다 산뜻한 층이 더 잘 맞습니다.");
  } else {
    lines.push("현재는 과한 단계 추가보다 사용감이 맞는 제품을 안정적으로 이어가는 편이 좋습니다.");
  }

  lines.push(`${textureLabel[input.preferredTexture] || "가벼운"} 제형 선호를 반영해 루틴을 단순하게 맞췄습니다.`);
  return lines.join("\n");
}

function buildStrategy(input) {
  if (input.sensitivity === "high" || input.mainConcern === "barrier" || input.mainConcern === "redness") {
    return "자극을 늘리기보다 편안한 사용감의 제품을 먼저 고르고 단계 수를 줄여 루틴을 안정시키세요.";
  }

  if (input.mainConcern === "oiliness" || input.mainConcern === "pores") {
    return "가벼운 흡수감과 번들 지연에 도움이 되는 제품부터 맞추고 과한 레이어링은 줄이세요.";
  }

  if (input.mainConcern === "dehydration") {
    return "수분층과 보습 마무리가 끊기지 않도록 제형이 너무 가볍거나 너무 무겁지 않게 맞추세요.";
  }

  return "핵심 고민에 직접 닿는 제품부터 먼저 맞추고 나머지 단계는 최소한으로 유지하세요.";
}

function buildMorning(input) {
  return [
    input.postWashFeeling === "tight"
      ? "아침에는 순한 세안 또는 가벼운 물세안으로 시작하기"
      : "아침에는 현재 유분 상태에 맞는 가벼운 세안으로 정리하기",
    input.mainConcern === "redness" || input.mainConcern === "barrier"
      ? "진정감 있는 수분층으로 피부 열감과 자극감을 먼저 눌러주기"
      : `${textureLabel[input.preferredTexture] || "가벼운"} 제형으로 수분 단계를 짧게 이어가기`,
    "자외선 차단제를 과하게 무겁지 않은 사용감으로 마무리하기"
  ];
}

function buildNight(input) {
  return [
    input.cleansingFrequency === "3_plus"
      ? "저녁에는 과세정 대신 필요한 만큼만 정리하고 마찰 줄이기"
      : "저녁에는 노폐물을 부드럽게 지우고 피부를 다시 건조하게 만들지 않기",
    input.mainConcern === "acne" || input.mainConcern === "pores"
      ? "문제 해결용 단계는 가볍게 두고 답답한 잔여감이 남지 않게 하기"
      : "보습과 진정 단계를 과하지 않게 연결해 피부 흐름 끊기지 않게 하기",
    input.mostDislikedFeel === "heavy"
      ? "마무리는 두껍지 않은 보습감으로 끝내기"
      : "마무리는 다음 날까지 부담이 덜한 보습감으로 끝내기"
  ];
}

function buildAvoid(input) {
  const avoid = [
    "한 번에 너무 많은 제품을 겹쳐 바르지 않기",
    input.sensitivity === "high"
      ? "새 기능성 제품을 여러 개 동시에 추가하지 않기"
      : "즉각적인 체감만 보고 강한 제품을 계속 올리지 않기",
    input.mostDislikedFeel === "sticky"
      ? "끈적임이 강한 마무리를 루틴 중간중간 반복하지 않기"
      : "현재 사용감과 맞지 않는 무거운 제형을 억지로 유지하지 않기"
  ];

  return avoid.slice(0, 3);
}

export function buildRuleBasedPlan(input = {}) {
  return {
    summary: buildSummary(input),
    strategy: buildStrategy(input),
    morning: buildMorning(input),
    night: buildNight(input),
    avoid: buildAvoid(input),
    funInsight: buildOptionalSkinNote(input)
  };
}

export function buildFallbackAnalysis(input = {}, recommendation, plan = buildRuleBasedPlan(input)) {
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
    funInsight: plan.funInsight,
    scoring: recommendation.scoring
  };
}
