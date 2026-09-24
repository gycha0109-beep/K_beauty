export const STYLE_ROUTE_GENERATOR_VERSION = "face-lab-style-route-v1";

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

function activePriorities(styleDelta) {
  return Array.isArray(styleDelta?.priorities)
    ? styleDelta.priorities.filter((item) => item?.constraintState === "allowed")
    : [];
}

function pick(priorities, domains, limit = 4) {
  const allowed = new Set(domains);
  return priorities
    .filter((item) => allowed.has(item.domain))
    .slice(0, limit)
    .map((item) => ({
      domain: item.domain,
      parameter: item.parameter,
      direction: item.direction,
      strength: item.strength,
      explanation: item.expectedEffect
    }));
}

function createRoute(strategy, actions, locale, targetStyle = null) {
  if (!actions.length) return null;
  const meta = STRATEGY_META[strategy];
  const dailyMinutes = Number(targetStyle?.constraints?.lifestyle?.dailyMinutes);
  const changeTolerance = targetStyle?.changeTolerance || "light";
  const makeupIntensity = targetStyle?.constraints?.makeup?.intensity || null;

  const adjustedActions = actions.map((item) => {
    if (
      item.domain === "makeup" &&
      makeupIntensity === "light" &&
      item.strength === "strong"
    ) {
      return { ...item, strength: "moderate" };
    }
    return item;
  });

  const softTradeoffs = [];
  let dailyEffort = meta.dailyEffort;
  let changeMagnitude = meta.changeMagnitude;

  if (Number.isFinite(dailyMinutes) && dailyMinutes <= 5 && dailyEffort === "high") {
    softTradeoffs.push("daily_time_constraint");
  }

  if (changeTolerance === "minimal") {
    changeMagnitude = "low";
  } else if (changeTolerance === "high" && strategy === "hair_led") {
    changeMagnitude = "high";
  }

  if (Number.isFinite(dailyMinutes) && dailyMinutes <= 5 && strategy === "low_effort") {
    dailyEffort = "low";
  }

  return {
    routeId: strategy,
    title: meta.title[locale],
    summary: adjustedActions.length === 1
      ? adjustedActions[0].explanation
      : `${adjustedActions[0].explanation} 그 외 ${adjustedActions.length - 1}개의 조정을 함께 적용합니다.`,
    strategy,
    domains: [...new Set(adjustedActions.map((item) => item.domain))],
    changeMagnitude,
    dailyEffort,
    maintenance: meta.maintenance,
    costBand: meta.costBand,
    reversibility: meta.reversibility,
    targetFit: {
      status: adjustedActions.length >= 2 ? "supported" : "bounded",
      explanation: adjustedActions.length >= 2
        ? "추구미의 주요 방향을 두 개 이상의 실행 파라미터로 나눠 적용합니다."
        : "선택 가능한 스타일 영역이 제한되어 한 영역 중심으로 적용합니다."
    },
    constraintFit: {
      hardViolations: [],
      softTradeoffs
    },
    actions: adjustedActions,
    whyThisRoute: strategy === "hair_led"
      ? "매일 메이크업 강도를 크게 높이지 않고 헤어 실루엣 변화를 중심으로 이동하는 경로입니다."
      : strategy === "makeup_led"
        ? "헤어 변화를 크게 주지 않고 메이크업의 위치·방향·강도를 이용하는 경로입니다."
        : strategy === "grooming_led"
          ? "눈썹과 기본 그루밍을 중심으로 부담을 낮춘 경로입니다."
          : strategy === "low_effort"
            ? "매일 반복해야 하는 동작 수와 유지 부담을 줄인 경로입니다."
            : "한 영역에 변화를 몰지 않고 여러 스타일 요소에 나눠 적용하는 경로입니다."
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

  const candidates = [
    createRoute("hair_led", pick(priorities, ["hair"], 4), resolvedLocale, targetStyle),
    createRoute("makeup_led", pick(priorities, ["makeup"], 4), resolvedLocale, targetStyle),
    createRoute("balanced", pick(priorities, [
      "hair",
      "brow_grooming",
      "makeup",
      "color",
      "eyewear",
      "accessories",
      "facial_hair",
      "face_adjacent_style"
    ], 4), resolvedLocale, targetStyle),
    createRoute("grooming_led", pick(priorities, ["brow_grooming", "facial_hair"], 4), resolvedLocale, targetStyle),
    createRoute("low_effort", pick(priorities, ["brow_grooming", "eyewear", "color", "hair"], 2), resolvedLocale, targetStyle)
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
  const prefersLowEffort =
    targetStyle?.changeTolerance === "minimal" ||
    (Number.isFinite(dailyMinutes) && dailyMinutes <= 5);

  const ordered = prefersLowEffort
    ? [...routes].sort((left, right) => {
        if (left.strategy === "low_effort") return -1;
        if (right.strategy === "low_effort") return 1;
        if (left.strategy === "balanced") return -1;
        if (right.strategy === "balanced") return 1;
        return 0;
      })
    : routes;

  const limited = ordered.slice(0, 3);
  const defaultRoute =
    (prefersLowEffort && limited.find((route) => route.strategy === "low_effort")) ||
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
