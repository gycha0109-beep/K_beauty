const POLICY_VERSION = "functional-policy-v1";

const CONCERN_AXES = [
  "barrier",
  "redness",
  "dehydration",
  "oiliness",
  "acne",
  "pores",
  "uneven_tone",
  "uv"
];

const ACTIVE_DIRECTIONS = new Set(["exfoliation", "acne_care", "tone_care", "wrinkle_care"]);
const SUPPORT_DIRECTIONS = new Set(["hydration", "soothing", "barrier_support", "sunscreen_protection"]);
const SENSITIVE_AXES = new Set(["barrier", "redness", "dehydration", "acne"]);

const GOAL_BY_CONCERN = Object.freeze({
  barrier: { primaryGoal: "barrier_redness", functionalDirection: "barrier_support" },
  redness: { primaryGoal: "barrier_redness", functionalDirection: "soothing" },
  dehydration: { primaryGoal: "dehydration", functionalDirection: "hydration" },
  oiliness: { primaryGoal: "oil_acne", functionalDirection: "acne_care" },
  acne: { primaryGoal: "oil_acne", functionalDirection: "acne_care" },
  pores: { primaryGoal: "pores_texture", functionalDirection: "exfoliation" },
  uneven_tone: { primaryGoal: "uneven_tone", functionalDirection: "tone_care" },
  uv: { primaryGoal: "protection", functionalDirection: "sunscreen_protection" }
});

const TARGET_CATEGORIES_BY_DIRECTION = Object.freeze({
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
  tone_care: ["treatment", "serum", "ampoule", "essence"],
  sunscreen_protection: ["sunscreen"]
});

const AVOID_WITH_BY_DIRECTION = Object.freeze({
  exfoliation: ["physical_scrub", "multiple_exfoliation", "high_frequency_acid"],
  acne_care: ["multiple_acne_actives", "harsh_cleansing", "multiple_exfoliation"],
  soothing: ["new_active_stack", "strong_exfoliation"],
  barrier_support: ["strong_exfoliation", "over_cleansing"],
  hydration: ["over_cleansing", "high_frequency_exfoliation"],
  tone_care: ["strong_exfoliation_same_day", "multiple_tone_actives"],
  sunscreen_protection: ["skip_sunscreen", "heavy_base_substitution"]
});

const GOAL_DEFINITIONS = Object.freeze([
  {
    goalKey: "barrier_soothing",
    axes: ["barrier", "redness", "acne"],
    directions: ["barrier_support", "soothing"],
    ko: {
      title: "진정·장벽 안정",
      now: "현재 피부 우선순위와 가장 직접적으로 연결되는 목표입니다.",
      later: "필요한 목표지만 다른 부담을 낮춘 뒤에도 함께 유지할 수 있습니다.",
      nextAction: "새 기능을 늘리기보다 자극을 줄이고 보습 마무리를 안정적으로 유지하세요."
    },
    en: {
      title: "Calming and barrier support",
      now: "This is the most direct goal for the current skin priority.",
      later: "This remains useful, but can stay as a steady support goal after the main burden is lower.",
      nextAction: "Keep the routine calm and steady before adding new active goals."
    }
  },
  {
    goalKey: "hydration",
    axes: ["dehydration", "barrier", "redness"],
    directions: ["hydration"],
    ko: {
      title: "보습·수분 유지",
      now: "수분 유지가 현재 루틴의 부담을 키우지 않고 바로 다루기 쉬운 목표입니다.",
      later: "수분 목표는 유효하지만 먼저 루틴을 가볍게 정리한 뒤 확인하세요.",
      nextAction: "얇은 보습층과 마무리 단계를 우선 안정시키세요."
    },
    en: {
      title: "Hydration support",
      now: "Hydration is a practical goal that can be handled without adding strong routine burden.",
      later: "Hydration still matters, but review it after the routine feels lighter.",
      nextAction: "Stabilize thin hydration and the finish step first."
    }
  },
  {
    goalKey: "sebum_pore",
    axes: ["oiliness", "pores", "acne"],
    directions: ["acne_care"],
    ko: {
      title: "유분·모공·결 관리",
      now: "민감·장벽 부담이 높지 않다면 지금 다뤄도 되는 목표입니다.",
      later: "목표는 유효하지만 현재 컨디션이 흔들릴 때는 조절 강도를 낮춰 보세요.",
      pause: "현재 부담 신호가 겹쳐 적극적인 피지·트러블 기능 확장은 잠시 보류하는 편이 안전합니다.",
      nextAction: "과하게 말리는 방향보다 가벼운 사용감과 세안 부담 조절부터 보세요."
    },
    en: {
      title: "Sebum and pore balance",
      now: "This can be handled now when barrier or sensitivity burden is not leading.",
      later: "The goal is valid, but keep the intensity lower while the skin is unstable.",
      pause: "Current burden signals overlap, so expanding sebum or blemish actives is better paused for now.",
      nextAction: "Adjust cleansing burden and texture before drying the skin out."
    }
  },
  {
    goalKey: "tone_spot",
    axes: ["uneven_tone", "uv"],
    directions: ["tone_care", "sunscreen_protection"],
    ko: {
      title: "톤·잡티 관리",
      now: "자외선·톤 흐름이 우선이면 보호 중심으로 지금 다룰 수 있습니다.",
      later: "톤 보정은 유효하지만 피부가 안정된 뒤 넓히는 편이 안전합니다.",
      pause: "현재 부담 신호가 겹쳐 새 톤 기능성 확장은 잠시 보류하고 보호 단계만 유지하세요.",
      nextAction: "아침 보호 루틴을 먼저 고정하고, 보정 목표는 한 번에 하나씩 확인하세요."
    },
    en: {
      title: "Tone and spot care",
      now: "When UV or tone is leading, this can start from a protection-focused routine.",
      later: "Tone correction is valid, but it is better expanded after the skin is stable.",
      pause: "Current burden signals overlap, so pause new tone actives while maintaining protection.",
      nextAction: "Fix the morning protection routine first, then review one correction goal at a time."
    }
  },
  {
    goalKey: "texture_exfoliation",
    axes: ["pores", "uneven_tone", "acne"],
    directions: ["exfoliation"],
    ko: {
      title: "결·각질 관리",
      now: "민감·장벽 부담이 낮고 결 흐름이 우선일 때만 가볍게 검토할 수 있습니다.",
      later: "현재 우선순위가 안정된 뒤 검토하는 편이 좋은 목표입니다.",
      pause: "현재 컨디션과 활성 부담 신호가 겹쳐 적극 확장은 잠시 보류하는 편이 안전합니다.",
      nextAction: "각질·결 목표는 피부가 며칠 안정된 뒤 하나씩 확인하세요."
    },
    en: {
      title: "Texture and exfoliation",
      now: "Review this lightly only when sensitivity or barrier burden is low.",
      later: "This is better reviewed after the current priority is stable.",
      pause: "Current condition and active burden overlap, so active expansion is better paused for now.",
      nextAction: "Recheck texture goals one at a time after the skin is stable for a few days."
    }
  }
]);

function normalizeText(value) {
  return String(value || "").normalize("NFKC").trim().toLowerCase();
}

function toNumber(value) {
  if (value && typeof value === "object") {
    return toNumber(value.total ?? value.score ?? value.value);
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeLocale(locale) {
  return locale === "en" ? "en" : "ko";
}

function getFreeResult(context = {}) {
  return context?.freeResult && typeof context.freeResult === "object" ? context.freeResult : {};
}

function getSharedContext(context = {}) {
  if (context?.sharedContext && typeof context.sharedContext === "object") {
    return context.sharedContext;
  }
  if (context?.skinState && typeof context.skinState === "object") {
    return context;
  }
  return null;
}

function getPriorityAxis(context = {}) {
  const shared = getSharedContext(context);
  const freeResult = getFreeResult(context);
  return normalizeText(
    shared?.skinState?.priorityAxis ||
      context?.priorityAxis ||
      context?.priority?.axis ||
      freeResult?.priority?.axis ||
      freeResult?.priority?.concern ||
      freeResult?.form?.mainConcern ||
      freeResult?.mainConcern ||
      (Array.isArray(freeResult?.form?.mainConcerns) ? freeResult.form.mainConcerns[0] : "")
  );
}

function getConcernScores(context = {}) {
  const shared = getSharedContext(context);
  const freeResult = getFreeResult(context);
  const source =
    shared?.skinState?.concernScores ||
    context?.scoreCard ||
    context?.scoring?.concernScores ||
    freeResult?.scoring?.concernScores ||
    freeResult?.scoreCard?.concernScores ||
    freeResult?.concernScores ||
    {};

  return Object.fromEntries(CONCERN_AXES.map((axis) => [axis, toNumber(source?.[axis])]));
}

function getAnswers(context = {}) {
  const shared = getSharedContext(context);
  const freeResult = getFreeResult(context);
  return (
    shared?.survey?.answers ||
    context?.answers ||
    freeResult?.answers ||
    freeResult?.form ||
    {}
  );
}

function isPercentScale(scores = {}) {
  return Math.max(...Object.values(scores).map(toNumber), 0) > 40;
}

function highThreshold(scores = {}) {
  return isPercentScale(scores) ? 70 : 18;
}

function veryHighThreshold(scores = {}) {
  return isPercentScale(scores) ? 85 : 24;
}

function getSensitivityState(context = {}, answers = {}) {
  const freeResult = getFreeResult(context);
  const level = normalizeText(
    answers?.sensitivity ||
      answers?.sensitivityLevel ||
      freeResult?.sensitivity ||
      freeResult?.sensitivityLevel ||
      freeResult?.form?.sensitivity
  );
  const score = toNumber(
    freeResult?.sensitivityScore ||
      freeResult?.scores?.sensitivity ||
      freeResult?.scoring?.sensitivity ||
      freeResult?.form?.sensitivityScore
  );
  const high =
    level === "high" ||
    level === "very_high" ||
    Boolean(answers?.verySensitivePeriod || freeResult?.verySensitivePeriod) ||
    score >= 75 ||
    (score > 0 && score <= 30 && score >= 18);

  return { level: level || "unknown", score, high };
}

function resolveSafety(context, scores, priorityAxis, answers) {
  const shared = getSharedContext(context);
  const provided = context?.safetyState || shared?.safetyState || {};
  const exposure = context?.productExposureState || shared?.productExposureState || {};
  const sensitivity = getSensitivityState(context, answers);
  const highSensitiveAxes = ["barrier", "redness", "dehydration", "acne"].filter(
    (axis) => scores[axis] >= highThreshold(scores)
  );
  const sensitiveBurden =
    typeof provided?.sensitiveBurden === "boolean"
      ? provided.sensitiveBurden
      : sensitivity.high || SENSITIVE_AXES.has(priorityAxis) || highSensitiveAxes.length > 0;
  const verdictHold = Array.isArray(context?.currentProductVerdicts) &&
    context.currentProductVerdicts.some((item) => item?.status === "hold");
  const activeBurden =
    typeof provided?.activeBurden === "boolean"
      ? provided.activeBurden
      : Boolean(
          verdictHold ||
          exposure?.activeExposurePresent ||
          exposure?.duplicateActiveAxes?.length ||
          exposure?.highCautionExposureCount
        );
  const recentSkinChange = normalizeText(
    provided?.recentSkinChange || answers?.recentSkinChange
  );
  const recentlyChangedProduct = normalizeText(
    provided?.recentlyChangedProduct || answers?.recentlyChangedProduct
  );
  const stabilizeFirst =
    provided?.level === "stabilize_first" ||
    activeBurden ||
    recentSkinChange === "yes" ||
    recentlyChangedProduct === "yes" ||
    (sensitivity.high && (
      scores.barrier >= highThreshold(scores) || scores.redness >= highThreshold(scores)
    ));

  return {
    level: stabilizeFirst ? "stabilize_first" : sensitiveBurden ? "caution" : "stable",
    sensitivity,
    sensitiveBurden,
    highSensitiveAxes,
    activeBurden,
    stabilizeFirst,
    activeExpansionAllowed: !stabilizeFirst,
    exfoliationExpansionAllowed: !stabilizeFirst && !sensitiveBurden,
    protectionMustMaintain: true,
    recentSkinChange: recentSkinChange || "unknown",
    recentlyChangedProduct: recentlyChangedProduct || "unknown"
  };
}

function rankedConcerns(scores = {}) {
  return CONCERN_AXES.map((axis) => ({ axis, score: scores[axis] || 0 }))
    .filter((item) => item.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return CONCERN_AXES.indexOf(left.axis) - CONCERN_AXES.indexOf(right.axis);
    });
}

function resolvePrimary(priorityAxis, scores) {
  const scoredAxis = rankedConcerns(scores)[0]?.axis || "";
  const selectedAxis = GOAL_BY_CONCERN[priorityAxis]
    ? priorityAxis
    : GOAL_BY_CONCERN[scoredAxis]
      ? scoredAxis
      : "dehydration";
  return {
    axis: selectedAxis,
    ...(GOAL_BY_CONCERN[selectedAxis] || GOAL_BY_CONCERN.dehydration)
  };
}

function resolveSecondaryGoal(primaryGoal, primaryAxis, scores) {
  for (const item of rankedConcerns(scores)) {
    if (item.axis === primaryAxis) continue;
    const goal = GOAL_BY_CONCERN[item.axis]?.primaryGoal;
    if (goal && goal !== primaryGoal) return goal;
  }
  return null;
}

function goalRelevance(goal, scores, priorityAxis) {
  const direct = goal.axes.includes(priorityAxis) ? 100 : 0;
  const score = Math.max(...goal.axes.map((axis) => scores[axis] || 0), 0);
  return direct + score;
}

function decideGoalStatus(goal, state) {
  const { priorityAxis, safety } = state;
  const direct = goal.axes.includes(priorityAxis);
  const activeGoal = goal.directions.some((direction) => ACTIVE_DIRECTIONS.has(direction));
  const protectionGoal = goal.directions.includes("sunscreen_protection");

  if (protectionGoal && priorityAxis === "uv") return "now";
  if (!activeGoal && (direct || safety.sensitiveBurden)) return "now";
  if (activeGoal && safety.stabilizeFirst && direct) return "pause";
  if (activeGoal && safety.sensitiveBurden && direct) return "later";
  if (direct) return "now";
  if (goal.goalKey === "texture_exfoliation" && safety.stabilizeFirst) return "pause";
  return "later";
}

function getGoalReasons(goal, status, state, locale) {
  const isEnglish = locale === "en";
  const reasons = [];
  if (goal.axes.includes(state.priorityAxis)) {
    reasons.push(isEnglish ? "This goal is connected to the current top priority." : "현재 1순위 피부 축과 직접 연결된 목표입니다.");
  }
  if (status === "pause") {
    reasons.push(isEnglish ? "Current safety signals require stabilization before active expansion." : "현재 안전 신호상 기능성 확장보다 안정화가 먼저입니다.");
  } else if (status === "later" && state.safety.sensitiveBurden) {
    reasons.push(isEnglish ? "Barrier or sensitivity burden should settle before expanding active goals." : "장벽·민감 부담이 안정된 뒤 기능 목표를 넓히는 편이 좋습니다.");
  } else if (Math.max(...goal.axes.map((axis) => state.scores[axis] || 0), 0) > 0) {
    reasons.push(isEnglish ? "Related concern scores support this ordering." : "관련 고민 점수가 이 우선순위를 뒷받침합니다.");
  }
  return reasons.slice(0, 2);
}

function buildGoals(state, locale) {
  return GOAL_DEFINITIONS.map((goal) => {
    const status = decideGoalStatus(goal, state);
    const copy = goal[locale] || goal.ko;
    const summary = status === "pause"
      ? copy.pause || copy.later
      : copy[status] || copy.later;
    return {
      goalKey: goal.goalKey,
      status,
      title: copy.title,
      summary,
      reasons: getGoalReasons(goal, status, state, locale),
      nextAction: copy.nextAction || null,
      relevance: goalRelevance(goal, state.scores, state.priorityAxis)
    };
  })
    .sort((left, right) => {
      const rank = { now: 0, later: 1, pause: 2 };
      const rankDiff = (rank[left.status] ?? 1) - (rank[right.status] ?? 1);
      return rankDiff || right.relevance - left.relevance;
    })
    .map(({ relevance, ...goal }) => goal);
}

function resolvePlanMode(direction, safety) {
  if (ACTIVE_DIRECTIONS.has(direction) && safety.stabilizeFirst) return "HOLD";
  return "START";
}

function resolveAllowedIntensity(direction, safety) {
  if (ACTIVE_DIRECTIONS.has(direction)) {
    if (safety.stabilizeFirst) return "hold";
    if (safety.sensitiveBurden) return "low";
    return "low_to_moderate";
  }
  if (direction === "sunscreen_protection") return "maintain";
  if (SUPPORT_DIRECTIONS.has(direction) && safety.stabilizeFirst) return "support_only";
  return "steady";
}

function resolveSuppression(direction, safety, scores) {
  if (ACTIVE_DIRECTIONS.has(direction) && safety.stabilizeFirst) {
    if (safety.sensitivity.high && (scores.redness >= highThreshold(scores) || scores.barrier >= highThreshold(scores))) {
      return { recommendationSuppressed: true, suppressionReason: "sensitivity_barrier" };
    }
    if (scores.dehydration >= highThreshold(scores)) {
      return { recommendationSuppressed: true, suppressionReason: "dryness_with_active" };
    }
    return { recommendationSuppressed: true, suppressionReason: "stabilize_first" };
  }
  if (
    ACTIVE_DIRECTIONS.has(direction) &&
    (scores.redness >= veryHighThreshold(scores) || scores.barrier >= veryHighThreshold(scores))
  ) {
    return { recommendationSuppressed: true, suppressionReason: "redness_instability" };
  }
  return { recommendationSuppressed: false, suppressionReason: null };
}

function buildReviewCondition(planMode, safety, locale) {
  if (locale === "en") {
    return planMode === "HOLD"
      ? "Recheck after the skin has felt stable for several days and recent-change signals have settled."
      : safety.sensitiveBurden
        ? "Review tolerance after 2 weeks before increasing intensity."
        : "Review response after 3 to 4 weeks before widening the plan.";
  }
  return planMode === "HOLD"
    ? "피부가 며칠 편안하게 유지되고 최근 변화 신호가 가라앉은 뒤 다시 검토합니다."
    : safety.sensitiveBurden
      ? "2주 동안 반응을 확인한 뒤 강도 확대 여부를 검토합니다."
      : "3~4주 후 반응을 확인한 뒤 기능 방향 확대 여부를 검토합니다.";
}

export function buildFunctionalPolicy(context = {}) {
  const locale = normalizeLocale(context.locale);
  const priorityAxis = getPriorityAxis(context);
  const scores = getConcernScores(context);
  const answers = getAnswers(context);
  const primary = resolvePrimary(priorityAxis, scores);
  const safety = resolveSafety(context, scores, primary.axis, answers);
  const planMode = resolvePlanMode(primary.functionalDirection, safety);
  const allowedIntensity = resolveAllowedIntensity(primary.functionalDirection, safety);
  const suppression = resolveSuppression(primary.functionalDirection, safety, scores);
  const state = {
    priorityAxis: primary.axis,
    scores,
    safety
  };
  const goals = buildGoals(state, locale);
  const primaryStatus = ACTIVE_DIRECTIONS.has(primary.functionalDirection)
    ? safety.stabilizeFirst
      ? "pause"
      : safety.sensitiveBurden
        ? "later"
        : "now"
    : "now";
  const reasonCodes = [
    `priority:${primary.axis}`,
    `direction:${primary.functionalDirection}`,
    `safety:${safety.level}`,
    ...(safety.activeBurden ? ["active_burden"] : []),
    ...(safety.sensitiveBurden ? ["sensitive_burden"] : []),
    ...(suppression.suppressionReason ? [`suppression:${suppression.suppressionReason}`] : [])
  ];

  return {
    version: POLICY_VERSION,
    locale,
    priorityAxis: primary.axis,
    primaryGoal: primary.primaryGoal,
    secondaryGoal: resolveSecondaryGoal(primary.primaryGoal, primary.axis, scores),
    functionalDirection: primary.functionalDirection,
    status: primaryStatus,
    planMode,
    allowedIntensity,
    targetCategories: [...(TARGET_CATEGORIES_BY_DIRECTION[primary.functionalDirection] || [])],
    avoidWith: [...(AVOID_WITH_BY_DIRECTION[primary.functionalDirection] || [])],
    reviewCondition: buildReviewCondition(planMode, safety, locale),
    recommendationSuppressed: suppression.recommendationSuppressed,
    suppressionReason: suppression.suppressionReason,
    reasonCodes,
    safety: {
      level: safety.level,
      sensitiveBurden: safety.sensitiveBurden,
      activeBurden: safety.activeBurden,
      activeExpansionAllowed: safety.activeExpansionAllowed,
      exfoliationExpansionAllowed: safety.exfoliationExpansionAllowed,
      protectionMustMaintain: safety.protectionMustMaintain
    },
    goals
  };
}

export const FUNCTIONAL_POLICY_VERSION = POLICY_VERSION;
export const FUNCTIONAL_POLICY_TAXONOMY = Object.freeze({
  CONCERN_AXES,
  GOAL_BY_CONCERN,
  TARGET_CATEGORIES_BY_DIRECTION,
  AVOID_WITH_BY_DIRECTION,
  GOAL_DEFINITIONS
});
