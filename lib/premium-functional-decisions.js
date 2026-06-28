const FUNCTIONAL_STATUSES = new Set(["now", "later", "pause"]);

const GOAL_DEFINITIONS = [
  {
    goalKey: "barrier_soothing",
    axes: ["barrier", "redness", "acne"],
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
    ko: {
      title: "유분·모공·결 관리",
      now: "민감·장벽 부담이 높지 않다면 지금 다뤄도 되는 목표입니다.",
      later: "목표는 유효하지만 현재 컨디션이 흔들릴 때는 조절 강도를 낮춰 보세요.",
      nextAction: "과하게 말리는 방향보다 가벼운 사용감과 세안 부담 조절부터 보세요."
    },
    en: {
      title: "Sebum and pore balance",
      now: "This can be handled now when barrier or sensitivity burden is not leading.",
      later: "The goal is valid, but keep the intensity lower while the skin is unstable.",
      nextAction: "Adjust cleansing burden and texture before drying the skin out."
    }
  },
  {
    goalKey: "tone_spot",
    axes: ["uneven_tone", "uv"],
    ko: {
      title: "톤·잡티 관리",
      now: "자외선·톤 흐름이 우선이면 보호 중심으로 지금 다룰 수 있습니다.",
      later: "톤 보정은 유효하지만 피부가 안정된 뒤 넓히는 편이 안전합니다.",
      nextAction: "아침 보호 루틴을 먼저 고정하고, 보정 목표는 한 번에 하나씩 확인하세요."
    },
    en: {
      title: "Tone and spot care",
      now: "When UV or tone is leading, this can start from a protection-focused routine.",
      later: "Tone correction is valid, but it is better expanded after the skin is stable.",
      nextAction: "Fix the morning protection routine first, then review one correction goal at a time."
    }
  },
  {
    goalKey: "texture_exfoliation",
    axes: ["pores", "uneven_tone", "acne"],
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
];

function getLocale(locale) {
  return locale === "en" ? "en" : "ko";
}

function getConcernTotal(scoreCard, axis) {
  const value = scoreCard?.[axis]?.total ?? scoreCard?.concernScores?.[axis]?.total;
  const total = Number(value);
  return Number.isFinite(total) ? total : 0;
}

function getPriorityAxis(context = {}) {
  return String(context.priorityAxis || context.priority?.axis || "").trim();
}

function isSensitiveAxis(axis) {
  return ["barrier", "redness", "acne"].includes(String(axis || "").trim());
}

function hasHighSensitiveBurden(scoreCard, priorityAxis) {
  if (isSensitiveAxis(priorityAxis)) {
    return true;
  }

  return ["barrier", "redness", "acne"].some((axis) => getConcernTotal(scoreCard, axis) >= 18);
}

function hasCurrentActiveBurden(currentProductVerdicts = []) {
  return Array.isArray(currentProductVerdicts) && currentProductVerdicts.some((item) => item?.status === "hold");
}

function goalRelevance(goal, scoreCard, priorityAxis) {
  const directPriority = goal.axes.includes(priorityAxis) ? 100 : 0;
  const score = Math.max(...goal.axes.map((axis) => getConcernTotal(scoreCard, axis)), 0);
  return directPriority + score;
}

function buildReasons({ goal, status, scoreCard, priorityAxis, sensitiveBurden, activeBurden, locale }) {
  const isEnglish = locale === "en";
  const reasons = [];

  if (goal.axes.includes(priorityAxis)) {
    reasons.push(isEnglish ? "This goal is connected to the current top priority." : "현재 1순위 피부 축과 직접 연결된 목표입니다.");
  }

  const strongestAxis = goal.axes
    .map((axis) => ({ axis, total: getConcernTotal(scoreCard, axis) }))
    .sort((a, b) => b.total - a.total)[0];

  if (strongestAxis?.total > 0) {
    reasons.push(
      isEnglish
        ? `The related concern score is visible in the current decision bundle.`
        : "Decision Bundle의 관련 고민 점수가 함께 확인됩니다."
    );
  }

  if (status === "pause" && activeBurden) {
    reasons.push(isEnglish ? "A current product verdict already asks to pause an active burden." : "현재 제품 판단에서 활성 부담 보류 신호가 확인됩니다.");
  } else if (status === "later" && sensitiveBurden) {
    reasons.push(isEnglish ? "Barrier or sensitivity burden should settle before expanding active goals." : "장벽·민감 부담이 안정된 뒤 기능 목표를 넓히는 편이 좋습니다.");
  }

  return reasons.slice(0, 2);
}

function decideGoalStatus(goal, context) {
  const priorityAxis = getPriorityAxis(context);
  const scoreCard = context.scoreCard || context.scoring || {};
  const sensitiveBurden = hasHighSensitiveBurden(scoreCard, priorityAxis);
  const activeBurden = hasCurrentActiveBurden(context.currentProductVerdicts);

  if (goal.goalKey === "texture_exfoliation" && sensitiveBurden && activeBurden) {
    return "pause";
  }

  if (goal.goalKey === "texture_exfoliation" && sensitiveBurden) {
    return "later";
  }

  if (goal.goalKey === "sebum_pore" && goal.axes.includes(priorityAxis) && !sensitiveBurden) {
    return "now";
  }

  if (["barrier_soothing", "hydration"].includes(goal.goalKey) && goal.axes.includes(priorityAxis)) {
    return "now";
  }

  if (goal.goalKey === "tone_spot" && goal.axes.includes(priorityAxis) && !sensitiveBurden) {
    return "now";
  }

  return "later";
}

function statusRank(status) {
  return { now: 0, later: 1, pause: 2 }[status] ?? 1;
}

export function buildPremiumFunctionalDecisions(context = {}) {
  const locale = getLocale(context.locale);
  const scoreCard = context.scoreCard || context.scoring || {};
  const priorityAxis = getPriorityAxis(context);
  const sensitiveBurden = hasHighSensitiveBurden(scoreCard, priorityAxis);
  const activeBurden = hasCurrentActiveBurden(context.currentProductVerdicts);

  return GOAL_DEFINITIONS
    .map((goal) => {
      const status = FUNCTIONAL_STATUSES.has(decideGoalStatus(goal, context))
        ? decideGoalStatus(goal, context)
        : "later";
      const copy = goal[locale] || goal.ko;
      const summary = status === "pause"
        ? copy.pause || copy.later
        : copy[status] || copy.later;

      return {
        goalKey: goal.goalKey,
        status,
        title: copy.title,
        summary,
        reasons: buildReasons({
          goal,
          status,
          scoreCard,
          priorityAxis,
          sensitiveBurden,
          activeBurden,
          locale
        }),
        nextAction: copy.nextAction || null,
        relevance: goalRelevance(goal, scoreCard, priorityAxis)
      };
    })
    .sort((left, right) => {
      const rankDiff = statusRank(left.status) - statusRank(right.status);
      if (rankDiff !== 0) {
        return rankDiff;
      }
      return right.relevance - left.relevance;
    })
    .slice(0, 5)
    .map(({ relevance, ...item }) => item);
}
