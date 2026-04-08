import { buildOptionalSkinNote, buildRecommendationBundle } from "@/lib/recommendation";

const concernSummary = {
  oiliness: "유분 조절과 산뜻한 마무리감이 중요한 패턴입니다.",
  dehydration: "수분 보충과 보습 유지가 핵심인 패턴입니다.",
  acne: "트러블 완화와 저자극 밸런스가 중요한 패턴입니다.",
  uneven_tone: "톤 정돈과 꾸준한 자외선 차단이 중요한 패턴입니다.",
  pores: "모공 고민을 줄이기 위한 가벼운 결 관리가 중요합니다.",
  redness: "붉은기 진정과 자극 최소화가 우선입니다.",
  barrier: "장벽 회복과 민감도 관리가 최우선입니다."
};

const textureLabel = {
  watery: "워터리",
  gel: "젤",
  lotion: "로션",
  cream: "크림"
};

function buildSummary(input) {
  const lines = [];
  lines.push(concernSummary[input.mainConcern] || concernSummary.acne);

  if (input.postWashFeeling === "tight") {
    lines.push("세안 후 당김이 있어 세정 강도보다 보습 연결 속도가 더 중요합니다.");
  } else if (input.postWashFeeling === "still_oily") {
    lines.push("세안 후에도 유분감이 남아 가벼운 제형 위주 구성이 더 잘 맞을 수 있습니다.");
  } else {
    lines.push("세안 후 편안한 편이라면 과도한 루틴 추가 없이 사용감 중심으로 고르는 것이 좋습니다.");
  }

  lines.push(`${textureLabel[input.preferredTexture] || "가벼운"} 제형 선호와 현재 환경 조건을 반영해 추천했습니다.`);
  return lines.join("\n");
}

function buildStrategy(input) {
  if (input.sensitivity === "high" || input.mainConcern === "barrier" || input.mainConcern === "redness") {
    return "민감도와 장벽 부담을 먼저 낮추면서 사용감이 맞는 제품만 단계별로 고르는 전략이 가장 효율적입니다.";
  }

  if (input.mainConcern === "oiliness" || input.mainConcern === "pores") {
    return "세정은 과하지 않게 유지하고 오후 번들거림을 줄일 수 있는 산뜻한 제형 중심으로 루틴을 구성하는 것이 좋습니다.";
  }

  if (input.mainConcern === "dehydration") {
    return "당김을 빠르게 잡을 수 있도록 수분층과 보습 마무리를 끊기지 않게 연결하는 전략이 가장 실용적입니다.";
  }

  return "기능성 제품을 많이 겹치기보다 주요 고민에 맞는 제품을 단계별로 하나씩 맞추는 방식이 더 안정적입니다.";
}

function buildMorning(input) {
  const steps = [];

  steps.push(
    input.postWashFeeling === "tight"
      ? "아침에는 약한 세안 또는 짧은 세안으로 시작하기"
      : "아침에는 피부 상태에 맞는 순한 클렌저로 가볍게 정리하기"
  );

  if (input.mainConcern === "redness" || input.mainConcern === "barrier" || input.sensitivity === "high") {
    steps.push("진정 토너나 장벽형 세럼으로 피부 컨디션 안정시키기");
  } else if (input.mainConcern === "uneven_tone") {
    steps.push("톤 정돈에 도움 되는 가벼운 세럼 또는 에센스 사용하기");
  } else {
    steps.push(`${textureLabel[input.preferredTexture] || "가벼운"} 제형 중심으로 수분 레이어 넣기`);
  }

  steps.push(
    input.environmentExposure?.includes("outdoor")
      ? "야외 활동을 고려해 자외선 차단제를 충분히 바르고 덧바르기 쉽게 유지하기"
      : "현재 피부 변화에 맞는 사용감의 자외선 차단제로 마무리하기"
  );

  return steps;
}

function buildNight(input) {
  const steps = [];

  steps.push(
    input.cleansingFrequency === "3_plus"
      ? "저녁에는 과세정을 피하고 자극 없는 세정으로 마무리하기"
      : "저녁에는 메이크업과 노폐물을 부드럽게 지우는 데 집중하기"
  );

  if (input.mainConcern === "acne" || input.mainConcern === "pores") {
    steps.push("트러블 또는 모공 고민 부위는 가벼운 세럼 위주로 정돈하기");
  } else if (input.mainConcern === "dehydration" || input.mainConcern === "barrier") {
    steps.push("수분과 장벽 보습이 끊기지 않도록 세럼과 보습제를 연결하기");
  } else {
    steps.push("주요 고민에 맞는 세럼을 한 단계만 넣고 과한 레이어링은 피하기");
  }

  steps.push(
    input.mostDislikedFeel === "heavy"
      ? "마지막 보습은 무겁지 않은 제형으로 짧게 마무리하기"
      : "피부가 편안하게 유지될 정도의 보습으로 마무리하기"
  );

  return steps;
}

function buildAvoid(input) {
  const avoid = [];

  if (input.cleansingFrequency === "3_plus") {
    avoid.push("세안 횟수가 많다면 강한 클렌저를 반복해서 쓰지 않기");
  } else {
    avoid.push("피부 상태가 안정적이어도 강한 세정으로 산뜻함만 추구하지 않기");
  }

  if (input.sensitivity === "high") {
    avoid.push("민감도가 높은 편이면 새 기능성 제품을 여러 개 동시에 추가하지 않기");
  } else if (input.mainConcern === "acne" || input.mainConcern === "pores") {
    avoid.push("모공이나 트러블 때문에 스크럽과 필링을 자주 반복하지 않기");
  } else {
    avoid.push("한 번에 많은 단계의 제품을 겹쳐 사용하지 않기");
  }

  if (input.mostDislikedFeel === "sticky") {
    avoid.push("끈적임이 싫다면 지나치게 광나는 레이어링을 여러 겹 올리지 않기");
  } else if (input.mostDislikedFeel === "greasy" || input.mostDislikedFeel === "heavy") {
    avoid.push("무겁고 답답한 크림을 필요 이상으로 두껍게 바르지 않기");
  } else if (input.mostDislikedFeel === "fragranced") {
    avoid.push("향이 강한 제품을 루틴 중심으로 고르지 않기");
  } else {
    avoid.push("현재 사용감과 맞지 않는 제품을 억지로 계속 사용하지 않기");
  }

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

export function buildMockAnalysis(input = {}) {
  const plan = buildRuleBasedPlan(input);
  const recommendation = buildRecommendationBundle(input);

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
