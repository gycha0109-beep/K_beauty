export const STYLE_ROUTE_GENERATOR_VERSION = "face-lab-style-route-v5";

const COPY = {
  ko: {
    combinedSummary: (first, rest) => `${first} 그 외 ${rest}개의 조정을 함께 적용합니다.`,
    why: {
      hair_led: "매일 메이크업 강도를 크게 높이지 않고 헤어 실루엣 변화를 중심으로 이동하는 경로입니다.",
      makeup_led: "헤어 변화를 크게 주지 않고 메이크업의 위치·방향·강도를 이용하는 경로입니다.",
      grooming_led: "눈썹과 기본 그루밍을 중심으로 부담을 낮춘 경로입니다.",
      low_effort: "매일 반복해야 하는 동작 수와 유지 부담을 줄인 경로입니다.",
      balanced: "한 영역에 변화를 몰지 않고 여러 스타일 요소에 나눠 적용하는 경로입니다."
    },
    targetFit: {
      supported: (covered, total) => `활성 목표 방향 ${total}개 중 ${covered}개를 이 경로에서 함께 다룹니다.`,
      bounded: (covered, total) => `활성 목표 방향 ${total}개 중 ${covered}개를 선택한 영역 안에서 다룹니다.`
    }
  },
  en: {
    combinedSummary: (first, rest) => `${first} Apply ${rest} additional adjustment${rest === 1 ? "" : "s"} alongside it.`,
    why: {
      hair_led: "Moves toward the target mainly through hair silhouette without requiring much stronger daily makeup.",
      makeup_led: "Uses makeup placement, direction, and intensity while keeping hair changes limited.",
      grooming_led: "Keeps the burden low by focusing on brows and core grooming.",
      low_effort: "Reduces the number of repeated daily actions and ongoing maintenance.",
      balanced: "Distributes the change across several styling elements instead of concentrating it in one area."
    },
    targetFit: {
      supported: (covered, total) => `This route covers ${covered} of ${total} active target directions together.`,
      bounded: (covered, total) => `This route covers ${covered} of ${total} active target directions within the selected styling scope.`
    }
  }
};

const STRATEGY_META = {
  hair_led: {
    title: { ko: "헤어 중심", en: "Hair-led" },
    changeMagnitude: "medium",
    dailyEffort: "medium",
    maintenance: "medium",
    costBand: "standard",
    reversibility: "moderate"
  },
  makeup_led: {
    title: { ko: "메이크업 중심", en: "Makeup-led" },
    changeMagnitude: "medium",
    dailyEffort: "high",
    maintenance: "low",
    costBand: "standard",
    reversibility: "easy"
  },
  grooming_led: {
    title: { ko: "그루밍 중심", en: "Grooming-led" },
    changeMagnitude: "low",
    dailyEffort: "low",
    maintenance: "medium",
    costBand: "low",
    reversibility: "easy"
  },
  balanced: {
    title: { ko: "균형형", en: "Balanced" },
    changeMagnitude: "medium",
    dailyEffort: "medium",
    maintenance: "medium",
    costBand: "standard",
    reversibility: "mixed"
  },
  low_effort: {
    title: { ko: "낮은 관리 부담", en: "Low-effort" },
    changeMagnitude: "low",
    dailyEffort: "low",
    maintenance: "low",
    costBand: "low",
    reversibility: "easy"
  }
};

const ROUTABLE_DOMAINS = new Set([
  "hair",
  "brow_grooming",
  "makeup",
  "color",
  "eyewear",
  "accessories",
  "facial_hair"
]);

function activePriorities(styleDelta) {
  return Array.isArray(styleDelta?.priorities)
    ? styleDelta.priorities.filter(
        (item) => item?.constraintState === "allowed" && ROUTABLE_DOMAINS.has(item?.domain)
      )
    : [];
}

function toRouteAction(item) {
  return {
    domain: item.domain,
    parameter: item.parameter,
    direction: item.direction,
    strength: item.strength,
    explanation: item.expectedEffect,
    reason: item.reason || null,
    evidence: Array.isArray(item.evidence) ? [...item.evidence] : []
  };
}

function pick(priorities, domains, limit = 4) {
  const allowed = new Set(domains);
  return priorities
    .filter((item) => allowed.has(item.domain))
    .slice(0, limit)
    .map(toRouteAction);
}

const STRENGTH_RANK = {
  light: 1,
  moderate: 2,
  strong: 3
};

function capActionStrength(item, maximum) {
  if (
    !item ||
    !STRENGTH_RANK[item.strength] ||
    !STRENGTH_RANK[maximum] ||
    STRENGTH_RANK[item.strength] <= STRENGTH_RANK[maximum]
  ) {
    return item;
  }

  return { ...item, strength: maximum };
}

function targetAxisSet(actions) {
  const axes = new Set();

  (Array.isArray(actions) ? actions : []).forEach((item) => {
    (Array.isArray(item?.evidence) ? item.evidence : []).forEach((evidence) => {
      if (typeof evidence === "string" && evidence.startsWith("target_axis:")) {
        axes.add(evidence.slice("target_axis:".length));
      }
    });
  });

  return axes;
}

function pickBalanced(priorities, domains, limit = 4) {
  const allowed = new Set(domains);
  const pool = priorities.filter((item) => allowed.has(item.domain));
  const selected = [];
  const seenDomains = new Set();
  const seenAxes = new Set();

  while (selected.length < limit && selected.length < pool.length) {
    const remaining = pool.filter((item) => !selected.includes(item));

    const score = (item) => {
      const axes = targetAxisSet([item]);
      const addsAxis = [...axes].some((axis) => !seenAxes.has(axis));
      const addsDomain = !seenDomains.has(item.domain);
      return (addsAxis ? 2 : 0) + (addsDomain ? 1 : 0);
    };

    remaining.sort((left, right) => score(right) - score(left));
    const next = remaining[0];
    if (!next) break;

    selected.push(next);
    seenDomains.add(next.domain);
    targetAxisSet([next]).forEach((axis) => seenAxes.add(axis));
  }

  return selected.map(toRouteAction);
}

function createRoute(strategy, actions, locale, targetStyle = null, activeTargetAxes = new Set()) {
  if (!actions.length) return null;
  const meta = STRATEGY_META[strategy];
  const dailyMinutes = Number(targetStyle?.constraints?.lifestyle?.dailyMinutes);
  const changeTolerance = targetStyle?.changeTolerance || "light";
  const makeupIntensity = targetStyle?.constraints?.makeup?.intensity || null;
  const budgetBand = targetStyle?.constraints?.lifestyle?.budgetBand || "standard";
  const maintenanceTolerance =
    targetStyle?.constraints?.lifestyle?.maintenanceTolerance || "medium";
  const copy = COPY[locale] || COPY.ko;

  let adjustedActions = actions
    .filter((item) =>
      !(item.domain === "makeup" && ["grooming_only", "none"].includes(makeupIntensity))
    )
    .map((item) => {
      if (item.domain !== "makeup") return item;
      if (makeupIntensity === "light") return capActionStrength(item, "light");
      if (makeupIntensity === "medium") return capActionStrength(item, "moderate");
      return item;
    });

  if (!adjustedActions.length) return null;

  if (changeTolerance === "minimal") {
    adjustedActions = adjustedActions
      .slice(0, 2)
      .map((item) => capActionStrength(item, "light"));
  } else if (changeTolerance === "light") {
    adjustedActions = adjustedActions.map((item) =>
      capActionStrength(item, "moderate")
    );
  }

  const softTradeoffs = [];
  let dailyEffort = meta.dailyEffort;
  let changeMagnitude = meta.changeMagnitude;
  let constraintScore = 0;

  if (Number.isFinite(dailyMinutes) && dailyMinutes <= 5) {
    if (dailyEffort === "high") {
      softTradeoffs.push("daily_time_constraint");
      constraintScore -= 2;
    }
    if (strategy === "low_effort" || dailyEffort === "low") {
      constraintScore += 2;
    }
  } else if (Number.isFinite(dailyMinutes) && dailyMinutes <= 15 && dailyEffort === "high") {
    softTradeoffs.push("daily_time_constraint");
    constraintScore -= 1;
  }

  if (budgetBand === "low") {
    if (meta.costBand === "low") {
      constraintScore += 2;
    } else {
      softTradeoffs.push("budget_constraint");
      constraintScore -= 1;
    }
  }

  if (maintenanceTolerance === "low") {
    if (meta.maintenance === "low") {
      constraintScore += 2;
    } else {
      softTradeoffs.push("maintenance_constraint");
      constraintScore -= 1;
    }
  }

  if (changeTolerance === "minimal") {
    changeMagnitude = "low";
    if (meta.changeMagnitude === "low") constraintScore += 1;
  } else if (changeTolerance === "high" && strategy === "hair_led") {
    changeMagnitude = "high";
    constraintScore += 1;
  }

  if (Number.isFinite(dailyMinutes) && dailyMinutes <= 5 && strategy === "low_effort") {
    dailyEffort = "low";
  }

  const routeTargetAxes = targetAxisSet(adjustedActions);
  const totalTargetAxes = activeTargetAxes.size;
  const coveredTargetAxes = [...routeTargetAxes].filter((axis) => activeTargetAxes.has(axis)).length;
  const coverage = totalTargetAxes
    ? Number((coveredTargetAxes / totalTargetAxes).toFixed(2))
    : 0;
  const targetFitStatus = coverage >= 0.67 ? "supported" : "bounded";

  return {
    routeId: strategy,
    title: meta.title[locale],
    summary: adjustedActions.length === 1
      ? adjustedActions[0].explanation
      : copy.combinedSummary(adjustedActions[0].explanation, adjustedActions.length - 1),
    strategy,
    domains: [...new Set(adjustedActions.map((item) => item.domain))],
    changeMagnitude,
    dailyEffort,
    maintenance: meta.maintenance,
    costBand: meta.costBand,
    reversibility: meta.reversibility,
    targetFit: {
      status: targetFitStatus,
      coverage,
      coveredDimensions: [...routeTargetAxes].filter((axis) => activeTargetAxes.has(axis)),
      totalDimensions: [...activeTargetAxes],
      explanation: copy.targetFit[targetFitStatus](coveredTargetAxes, totalTargetAxes)
    },
    faceEvidence: [...new Set(
      adjustedActions.flatMap((item) =>
        (item.evidence || []).filter((evidence) => evidence.startsWith("face_feature:"))
      )
    )],
    constraintFit: {
      hardViolations: [],
      softTradeoffs,
      score: constraintScore
    },
    actions: adjustedActions,
    whyThisRoute: copy.why[strategy] || copy.why.balanced
  };
}

function signature(route) {
  return route
    ? route.actions.map((item) => `${item.domain}:${item.parameter}:${item.direction}`).sort().join("|")
    : "";
}

export function buildStyleRoutes(styleDelta, { locale = "ko", targetStyle = null } = {}) {
  const resolvedLocale = locale === "en" ? "en" : "ko";

  if (!styleDelta || !["available", "partial"].includes(styleDelta.status)) {
    return {
      status: "unavailable",
      version: STYLE_ROUTE_GENERATOR_VERSION,
      routes: [],
      defaultRouteId: null,
      selectedRouteId: null,
      comparisonAxes: [],
      evidence: [],
      confidence: null,
      unavailableReason: "style_delta_unavailable"
    };
  }

  const priorities = activePriorities(styleDelta);
  if (!priorities.length) {
    return {
      status: "insufficient_evidence",
      version: STYLE_ROUTE_GENERATOR_VERSION,
      routes: [],
      defaultRouteId: null,
      selectedRouteId: null,
      comparisonAxes: [],
      evidence: styleDelta.evidence || [],
      confidence: null,
      unavailableReason: "no_actionable_priorities"
    };
  }

  const activeTargetAxes = targetAxisSet(priorities);

  const candidates = [
    createRoute("hair_led", pick(priorities, ["hair"], 4), resolvedLocale, targetStyle, activeTargetAxes),
    createRoute("makeup_led", pick(priorities, ["makeup"], 4), resolvedLocale, targetStyle, activeTargetAxes),
    createRoute("balanced", pickBalanced(priorities, [
      "hair",
      "brow_grooming",
      "makeup",
      "color",
      "eyewear",
      "accessories",
      "facial_hair"
    ], 4), resolvedLocale, targetStyle, activeTargetAxes),
    createRoute("grooming_led", pick(priorities, ["brow_grooming", "facial_hair"], 4), resolvedLocale, targetStyle, activeTargetAxes),
    createRoute("low_effort", pick(priorities, ["brow_grooming", "eyewear", "color", "hair"], 2), resolvedLocale, targetStyle, activeTargetAxes)
  ].filter(Boolean);

  const routes = [];
  const seen = new Set();

  candidates.forEach((route) => {
    const key = signature(route);
    if (!key || seen.has(key)) return;
    seen.add(key);
    routes.push(route);
  });

  const dailyMinutes = Number(targetStyle?.constraints?.lifestyle?.dailyMinutes);
  const budgetBand = targetStyle?.constraints?.lifestyle?.budgetBand || "standard";
  const maintenanceTolerance =
    targetStyle?.constraints?.lifestyle?.maintenanceTolerance || "medium";
  const prefersLowEffort =
    targetStyle?.changeTolerance === "minimal" ||
    (Number.isFinite(dailyMinutes) && dailyMinutes <= 5);
  const hasDailyTimePreference =
    Number.isFinite(dailyMinutes) && dailyMinutes <= 15;
  const hasConstraintPreference =
    prefersLowEffort ||
    hasDailyTimePreference ||
    budgetBand === "low" ||
    maintenanceTolerance === "low";

  const ordered = hasConstraintPreference
    ? [...routes].sort((left, right) => {
        const scoreDiff = (right.constraintFit?.score || 0) - (left.constraintFit?.score || 0);
        if (scoreDiff) return scoreDiff;
        if (prefersLowEffort && left.strategy === "low_effort") return -1;
        if (prefersLowEffort && right.strategy === "low_effort") return 1;
        if (left.strategy === "balanced") return -1;
        if (right.strategy === "balanced") return 1;
        return 0;
      })
    : routes;

  const limited = ordered.slice(0, 3);
  const defaultRoute =
    (hasConstraintPreference && limited[0]) ||
    limited.find((route) => route.strategy === "balanced") ||
    limited[0] ||
    null;

  return {
    status: limited.length ? "available" : "insufficient_evidence",
    version: STYLE_ROUTE_GENERATOR_VERSION,
    routes: limited,
    defaultRouteId: defaultRoute?.routeId || null,
    selectedRouteId: null,
    comparisonAxes: [
      "changeMagnitude",
      "dailyEffort",
      "maintenance",
      "costBand",
      "reversibility"
    ],
    evidence: styleDelta.evidence || [],
    confidence: typeof styleDelta.confidence === "number" ? styleDelta.confidence : null,
    unavailableReason: limited.length ? null : "route_generation_empty"
  };
}
