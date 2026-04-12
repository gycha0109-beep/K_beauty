import { buildOptionalSkinNote } from "@/lib/recommendation";

const concernSummaryMap = {
  oiliness: "유분이 빠르게 올라오는 흐름이라 가벼운 사용감과 번들 제어가 먼저 중요합니다.",
  dehydration: "건조감이 이어지는 편이라 수분층과 보습 마무리를 먼저 안정시키는 편이 좋습니다.",
  acne: "트러블이 반복되기 쉬워 답답함을 줄이고 자극을 덜 남기는 구성이 우선입니다.",
  uneven_tone: "톤이 들쭉날쭉해 보일 때는 무겁지 않은 루틴으로 결을 먼저 정리하는 편이 낫습니다.",
  pores: "모공과 번들거림이 함께 신경 쓰여 잔여감이 덜 남는 제품 구성이 중요합니다.",
  redness: "붉은기가 올라오기 쉬워 진정감과 자극 부담을 줄이는 흐름이 먼저 필요합니다.",
  barrier: "장벽이 흔들리는 상태라 강한 기능보다 편하게 이어지는 보습 루틴이 먼저입니다."
};

const textureLabelMap = {
  watery: "워터리한",
  gel: "가벼운 젤",
  lotion: "로션형",
  cream: "크림형",
  heavy: "리치한"
};

function getConcernSummary(mainConcern) {
  return concernSummaryMap[mainConcern] || concernSummaryMap.barrier;
}

function getTextureLabel(texture) {
  return textureLabelMap[texture] || "가벼운";
}

function buildSummary(input) {
  const firstLine = getConcernSummary(input.mainConcern);

  if (input.postWashFeeling === "tight") {
    return `${firstLine}\n세안 후 당김이 남아 보습이 끊기지 않는 구성이 더 잘 맞습니다.`;
  }

  if (input.postWashFeeling === "still_oily") {
    return `${firstLine}\n세안 직후에도 유분감이 남아 무거운 마무리보다 빠른 흡수 흐름이 더 낫습니다.`;
  }

  return `${firstLine}\n지금은 단계를 늘리기보다 사용감이 맞는 제품부터 정리하는 편이 좋습니다.`;
}

function buildStrategy(input) {
  if (input.sensitivity === "high" || input.mainConcern === "redness" || input.mainConcern === "barrier") {
    return "자극을 줄이고 편하게 이어지는 제품부터 맞춘 뒤 필요한 단계만 천천히 더하세요.";
  }

  if (input.mainConcern === "oiliness" || input.mainConcern === "pores") {
    return "번들 제어와 가벼운 흡수 흐름이 먼저 보이는 제품부터 고르고 무거운 레이어는 줄이세요.";
  }

  if (input.mainConcern === "dehydration") {
    return "수분층이 끊기지 않게 잡아 주면서도 표면 잔여감이 과하지 않은 조합부터 맞추세요.";
  }

  return `${getTextureLabel(input.preferredTexture)} 사용감을 중심으로 루틴을 단순하게 맞추는 편이 좋습니다.`;
}

function buildMorning(input) {
  return [
    input.postWashFeeling === "tight"
      ? "아침에는 세안을 가볍게 하고 당김이 덜 남는 클렌저부터 맞추기"
      : "아침에는 현재 유분 흐름에 맞는 순한 세안으로 표면만 정리하기",
    input.mainConcern === "redness" || input.mainConcern === "barrier"
      ? "진정감 있는 수분층으로 첫 단계를 짧게 정리하기"
      : `${getTextureLabel(input.preferredTexture)} 텍스처로 수분 단계를 가볍게 이어가기`,
    "자외선 차단은 무겁지 않은 마무리로 끝내기"
  ];
}

function buildNight(input) {
  return [
    input.cleansingFrequency === "3_plus"
      ? "저녁에는 과한 세정 대신 필요한 만큼만 정리하기"
      : "저녁에는 노폐물만 부드럽게 지우고 피부를 다시 건조하게 만들지 않기",
    input.mainConcern === "acne" || input.mainConcern === "pores"
      ? "트러블 단계는 답답함이 덜한 제형으로 짧게 가져가기"
      : "보습과 진정 단계를 과하지 않게 이어가기",
    input.mostDislikedFeel === "heavy"
      ? "마무리는 두껍지 않게 끝내기"
      : "마무리는 다음 날까지 부담이 덜 남는 보습으로 끝내기"
  ];
}

function buildAvoid(input) {
  return [
    "한 번에 제품을 많이 겹쳐 바르지 않기",
    input.sensitivity === "high"
      ? "새 제품을 여러 개 동시에 추가하지 않기"
      : "체감만 보고 강한 제품을 바로 늘리지 않기",
    input.mostDislikedFeel === "sticky"
      ? "끈적임이 강한 마무리를 계속 겹치지 않기"
      : "현재와 맞지 않는 무거운 제형을 억지로 유지하지 않기"
  ];
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
