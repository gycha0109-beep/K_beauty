import {
  buildFunctionalPolicy,
  FUNCTIONAL_POLICY_TAXONOMY,
  FUNCTIONAL_POLICY_VERSION
} from "./functional-policy.js";

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
  },
  sunscreen_protection: {
    slot: "AM",
    frequency: "daily",
    note: "아침 보호 단계를 유지하고 야외 노출 시 덧바름을 검토합니다."
  }
};

function hasUsableSignal(freeResult = {}) {
  const scores = freeResult?.scoring?.concernScores ||
    freeResult?.scoreCard?.concernScores ||
    freeResult?.concernScores ||
    {};
  return Boolean(
    freeResult?.priority?.axis ||
      freeResult?.priority?.concern ||
      freeResult?.form?.mainConcern ||
      freeResult?.mainConcern ||
      Object.values(scores).some((value) => Number(value?.total ?? value) > 0)
  );
}

function buildReason(policy, freeResult) {
  if (!hasUsableSignal(freeResult)) {
    return "freeResult signal unavailable; hydration fallback applied";
  }
  return `functional policy selected ${policy.priorityAxis}; ${policy.primaryGoal}/${policy.functionalDirection} applied`;
}

export function buildFunctionalPlanDecision({ freeResult } = {}) {
  const functionalPolicy = buildFunctionalPolicy({
    locale: "ko",
    freeResult: freeResult || {}
  });
  const routineGuide = ROUTINE_GUIDE_BY_DIRECTION[functionalPolicy.functionalDirection] ||
    ROUTINE_GUIDE_BY_DIRECTION.hydration;

  return {
    primaryGoal: functionalPolicy.primaryGoal,
    secondaryGoal: functionalPolicy.secondaryGoal,
    functionalDirection: functionalPolicy.functionalDirection,
    targetCategories: [...functionalPolicy.targetCategories],
    avoidWith: functionalPolicy.planMode === "HOLD" ? [] : [...functionalPolicy.avoidWith],
    routineGuide: {
      ...routineGuide,
      ...(functionalPolicy.planMode === "HOLD"
        ? {
            slot: "AM_PM",
            frequency: "hold",
            note: "피부가 편안하게 유지될 때까지 새 기능성 추가를 보류합니다."
          }
        : {})
    },
    recommendationSuppressed: functionalPolicy.recommendationSuppressed,
    suppressionReason: functionalPolicy.suppressionReason,
    reason: buildReason(functionalPolicy, freeResult),
    policyVersion: functionalPolicy.version || FUNCTIONAL_POLICY_VERSION
  };
}

export const FUNCTIONAL_PLAN_TAXONOMY = {
  GOAL_BY_CONCERN: FUNCTIONAL_POLICY_TAXONOMY.GOAL_BY_CONCERN,
  TARGET_CATEGORIES_BY_DIRECTION: FUNCTIONAL_POLICY_TAXONOMY.TARGET_CATEGORIES_BY_DIRECTION,
  AVOID_WITH_BY_DIRECTION: FUNCTIONAL_POLICY_TAXONOMY.AVOID_WITH_BY_DIRECTION,
  ROUTINE_GUIDE_BY_DIRECTION
};
