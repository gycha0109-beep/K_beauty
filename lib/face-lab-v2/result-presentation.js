import { getTargetStyleLabel } from "./target-style-registry.js";

export const FACE_LAB_RESULT_PRESENTATION_VERSION = "face-lab-result-presentation-v3";

const COPY = {
  ko: {
    currentTitle: "지금 인상을 만드는 요소",
    currentFallback: "사진에서 확인 가능한 얼굴 특징만 스타일 판단에 사용했습니다.",
    targetTitle: "가고 싶은 방향",
    targetSummary: (labels) => `${labels} 방향을 기준으로 현재 얼굴에서 필요한 변화만 추렸습니다.`,
    changesTitle: "가장 먼저 바꿀 것",
    routesTitle: "어떤 방식으로 바꿀까요?",
    executionTitle: "이렇게 바꾸세요",
    lookTitle: "이렇게 합치면",
    conflictsTitle: "이건 과하게 하지 마세요",
    productTitle: "제품을 고를 때 볼 조건",
    archetypeTitle: "재미로 보는 인상 믹스",
    archetypeDisclaimer: "이 인상 믹스는 재미용이며 스타일 추천에는 사용하지 않습니다.",
    fitGood: "현재 조건과 잘 맞음",
    targetFitSupported: "여러 변화 요소를 함께 사용",
    targetFitBounded: "선택한 영역 안에서 제한적으로 접근",
    routeMeta: {
      changeMagnitude: "변화량",
      dailyEffort: "매일 손질",
      maintenance: "유지 관리",
      costBand: "비용",
      reversibility: "되돌리기"
    },
    level: {
      low: "낮음",
      medium: "중간",
      high: "높음",
      standard: "보통",
      higher: "높음",
      easy: "쉬운 편",
      moderate: "중간",
      difficult: "어려움",
      mixed: "혼합"
    },
    tradeoff: {
      daily_time_constraint: "짧은 준비 시간에서는 손이 조금 더 갑니다.",
      budget_constraint: "최소 비용 조건에서는 추가 지출이 생길 수 있습니다.",
      maintenance_constraint: "낮은 유지 관리 조건에서는 관리 부담이 조금 큽니다."
    },
    domain: {
      hair: "헤어",
      grooming: "그루밍",
      makeup: "메이크업",
      color: "컬러",
      eyewear: "안경",
      accessories: "액세서리",
      face_adjacent_style: "얼굴 주변 스타일"
    },
    productCategory: {
      eyeliner: "아이라이너",
      eyeshadow: "아이섀도",
      lip: "립",
      base: "베이스"
    },
    recommended: "찾을 조건",
    avoid: "피할 조건"
  },
  en: {
    currentTitle: "What shapes your current impression",
    currentFallback: "Only face features that can be used safely for styling were included.",
    targetTitle: "Your target direction",
    targetSummary: (labels) => `Using ${labels} as the target, Face Lab narrows the changes that matter for your current face.`,
    changesTitle: "Highest-impact changes",
    routesTitle: "Choose how to get there",
    executionTitle: "How to execute this route",
    lookTitle: "How it comes together",
    conflictsTitle: "Avoid overdoing these",
    productTitle: "What to look for in products",
    archetypeTitle: "Impression mix, just for fun",
    archetypeDisclaimer: "This impression mix is for fun only and does not drive style recommendations.",
    fitGood: "Fits your current constraints well",
    targetFitSupported: "Uses multiple styling changes together",
    targetFitBounded: "Approaches the target within the selected styling scope",
    routeMeta: {
      changeMagnitude: "Change",
      dailyEffort: "Daily effort",
      maintenance: "Maintenance",
      costBand: "Cost",
      reversibility: "Reversibility"
    },
    level: {
      low: "Low",
      medium: "Medium",
      high: "High",
      standard: "Standard",
      higher: "Higher",
      easy: "Easy",
      moderate: "Moderate",
      difficult: "Difficult",
      mixed: "Mixed"
    },
    tradeoff: {
      daily_time_constraint: "This route may take more effort within a very short daily routine.",
      budget_constraint: "This route may require some extra spend on a minimum-budget plan.",
      maintenance_constraint: "This route may need more upkeep than your low-maintenance preference."
    },
    domain: {
      hair: "Hair",
      grooming: "Grooming",
      makeup: "Makeup",
      color: "Color",
      eyewear: "Eyewear",
      accessories: "Accessories",
      face_adjacent_style: "Face-adjacent styling"
    },
    productCategory: {
      eyeliner: "Eyeliner",
      eyeshadow: "Eyeshadow",
      lip: "Lip",
      base: "Base"
    },
    recommended: "Look for",
    avoid: "Avoid"
  }
};

const EN_ACTIONS = {
  outlineDefinition: "Keep the hair outline controlled instead of making it sharper.",
  definition: "Increase definition in a controlled way.",
  outerEyeEmphasis: "Shift emphasis toward the outer third of the eyes.",
  angularity: "Adjust angularity to match the target without over-amplifying it.",
  edgeDefinition: "Refine edge definition while keeping the result wearable.",
  curvature: "Adjust curvature while preserving the face's existing line balance.",
  edgeDiffusion: "Diffuse hard makeup edges for a softer transition.",
  finishControl: "Keep the finish controlled rather than visually noisy.",
  shapeControl: "Keep the brow shape consistent from start to tail.",
  boundaryControl: "Keep the lip boundary neat without making it overly sharp.",
  rimDefinition: "Use clearer frame edges and a more deliberate upper line.",
  trimControl: "Keep facial-hair length and edges consistent.",
  textureFreedom: "Allow more natural texture instead of over-fixing the finish.",
  coverageIntensity: "Use coverage selectively rather than applying a heavy full-face layer.",
  silhouetteControl: "Control the overall silhouette instead of expanding it outward.",
  visualNoise: "Reduce the number of competing visual accents.",
  movement: "Add controlled movement through light layers or texture.",
  accentFreshness: "Use a slightly clearer color accent.",
  selectedFeatureContrast: "Choose one feature as the main contrast point.",
  visualWeight: "Adjust the visual weight of the selected styling element.",
  accentCount: "Limit how many areas are strongly accented at the same time.",
  temperatureDirection: "Move the color temperature toward the target direction.",
  trendSignal: "Adjust how strongly trend-driven details appear.",
  eyeDefinition: "Increase eye definition and length instead of adding more upward angle."
};

const FEATURE_EN = {
  eyeDirection: "Eye direction",
  contourDefinition: "Contour definition",
  featureContrast: "Feature contrast",
  straightCurveBalance: "Straight / curved line balance",
  faceShape: "Face shape",
  jawlineAngularity: "Jawline angularity",
  faceLengthBalance: "Face length balance"
};

const PRODUCT_VALUE_COPY = {
  ko: {
    opacity: {
      buildable: "농도를 단계적으로 조절하기 쉬운 타입",
      light_to_medium: "얇게 시작해 중간 정도까지 조절 가능한 커버"
    },
    chroma: {
      medium: "중간 정도의 채도",
      medium_low: "차분한 중저채도"
    },
    diffusion: {
      high: "경계를 부드럽게 퍼뜨리기 쉬운 제형"
    },
    buildability: {
      high: "겹쳐 발라도 강도 조절이 쉬운 타입"
    },
    finish: {
      matte: "매트 마감",
      satin: "은은한 새틴 마감",
      soft_matte: "부드러운 소프트 매트 마감",
      soft_satin: "부드러운 새틴 마감",
      natural: "자연스러운 마감"
    },
    constraint: {
      avoid_overly_fixed_upward_angle: "각도가 처음부터 강하게 고정되는 타입",
      angle_neutral_to_slight: "상승 각도가 과하게 강조되는 타입",
      avoid_heavy_coverage: "두껍게 고정되는 고커버 타입"
    }
  },
  en: {
    opacity: {
      buildable: "Buildable opacity that is easy to control",
      light_to_medium: "Light-to-medium coverage that can be layered selectively"
    },
    chroma: {
      medium: "Medium chroma",
      medium_low: "Muted medium-low chroma"
    },
    diffusion: {
      high: "A formula that diffuses edges easily"
    },
    buildability: {
      high: "High buildability for controlled layering"
    },
    finish: {
      matte: "Matte finish",
      satin: "Soft satin finish",
      soft_matte: "Soft-matte finish",
      soft_satin: "Soft satin finish",
      natural: "Natural finish"
    },
    constraint: {
      avoid_overly_fixed_upward_angle: "Products that lock in an overly strong upward angle",
      angle_neutral_to_slight: "Products that strongly exaggerate an upward angle",
      avoid_heavy_coverage: "Heavy, fixed high-coverage formulas"
    }
  }
};

function localeKey(locale) {
  return locale === "en" ? "en" : "ko";
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
}

function safeText(value, locale, fallback = "") {
  if (typeof value !== "string" || !value.trim()) return fallback;
  if (locale === "en" && /[가-힣]/.test(value)) return fallback;
  return value.trim();
}

function actionText(action, locale) {
  if (!action) return "";
  if (locale === "en") {
    return EN_ACTIONS[action.parameter] || "Apply this styling adjustment in a controlled way.";
  }
  return safeText(action.explanation || action.expectedEffect, locale, "");
}

function mapCurrent(result, locale, copy) {
  const current = result?.currentFaceProfile || {};
  const summary = safeText(current.summary, locale, copy.currentFallback);
  const features = (current.keyFeatures || []).slice(0, 4).map((feature) => ({
    id: feature.key,
    title: safeText(
      feature.label,
      locale,
      locale === "en" ? (FEATURE_EN[feature.key] || "Observed feature") : feature.key
    ),
    body: safeText(
      feature.explanation,
      locale,
      locale === "en" ? "This observed feature is used as a bounded styling constraint." : ""
    )
  }));

  return {
    title: copy.currentTitle,
    summary,
    features
  };
}

function mapTarget(result, locale, copy) {
  const target = result?.targetStyle || {};
  const labels = (target.targetLabels || [])
    .map((key) => getTargetStyleLabel(key, locale) || key)
    .filter(Boolean);

  return {
    title: copy.targetTitle,
    labels,
    summary: copy.targetSummary(labels.join(locale === "en" ? " + " : " · ")),
    source: target.source || null
  };
}

function mapChanges(result, locale, copy) {
  return (result?.styleDelta?.priorities || [])
    .filter((item) => item?.constraintState === "allowed")
    .slice(0, 3)
    .map((item, index) => ({
      id: `${item.domain || "style"}-${item.parameter || index}`,
      domain: item.domain,
      domainLabel: copy.domain[item.domain === "brow_grooming" || item.domain === "facial_hair" ? "grooming" : item.domain] || item.domain,
      title: actionText(item, locale),
      strength: copy.level[item.strength] || null
    }))
    .filter((item) => item.title);
}

function mapRoute(route, locale, copy, selectedRouteId) {
  const tradeoffs = (route?.constraintFit?.softTradeoffs || [])
    .map((key) => copy.tradeoff[key])
    .filter(Boolean);

  return {
    routeId: route.routeId,
    title: safeText(route.title, locale, route.routeId),
    summary: safeText(route.whyThisRoute, locale, locale === "en" ? "A distinct way to approach the same target style." : "같은 추구미에 접근하는 다른 방법입니다."),
    selected: route.routeId === selectedRouteId,
    fitLabel: tradeoffs.length ? null : copy.fitGood,
    tradeoffs,
    targetFit: route.targetFit?.status === "supported"
      ? copy.targetFitSupported
      : copy.targetFitBounded,
    meta: [
      ["changeMagnitude", route.changeMagnitude],
      ["dailyEffort", route.dailyEffort],
      ["maintenance", route.maintenance],
      ["costBand", route.costBand],
      ["reversibility", route.reversibility]
    ].map(([key, value]) => ({
      key,
      label: copy.routeMeta[key],
      value: copy.level[value] || value
    })),
    actions: (route.actions || [])
      .slice(0, 3)
      .map((item) => actionText(item, locale))
      .filter(Boolean)
  };
}

function executionKey(domain) {
  if (domain === "brow_grooming" || domain === "facial_hair") return "grooming";
  return domain;
}

function techniqueLines(technique) {
  if (!technique) return [];
  return unique([
    ...(technique.placement || []),
    ...(technique.direction || []),
    ...(technique.finish || []),
    ...(technique.colorDirection || [])
  ]);
}

function koExecutionLines(key, result) {
  const value = result?.[key]?.value;
  if (!value) return [];

  if (key === "hair") {
    return unique([
      ...(value.parting || []),
      ...(value.fringe || []),
      ...(value.crownVolume || []),
      ...(value.sideVolume || []),
      ...(value.templeCoverage || []),
      ...(value.faceLineExposure || []),
      ...(value.lengthDirection || []),
      ...(value.layerDirection || []),
      ...(value.curvature || []),
      ...(value.texture || []),
      ...(value.silhouette || []),
      ...(value.avoidOrModerate || [])
    ]);
  }

  if (key === "grooming") {
    return unique([
      ...(value.brows || []),
      ...(value.facialHair || []),
      ...(value.sideburns || []),
      ...(value.hairline || []),
      ...(value.maintenancePlan || [])
    ]);
  }

  if (key === "makeup") {
    return unique([
      ...techniqueLines(value.brows),
      ...techniqueLines(value.eyes),
      ...techniqueLines(value.blush),
      ...techniqueLines(value.lips),
      ...techniqueLines(value.complexion),
      ...techniqueLines(value.contourHighlight),
      ...(value.avoidOrModerate || [])
    ]);
  }

  if (key === "color") {
    return unique(value.applicationNotes || []);
  }

  if (key === "eyewear") {
    return unique([
      ...(value.frameWidth || []),
      ...(value.frameHeight || []),
      ...(value.angularity || []),
      ...(value.curvature || []),
      ...(value.rimThickness || []),
      ...(value.bridgeDirection || []),
      ...(value.browAlignment || []),
      ...(value.visualWeight || []),
      ...(value.colorContrast || [])
    ]);
  }

  if (key === "accessories") {
    return unique([
      ...(value.scale || []),
      ...(value.angularity || []),
      ...(value.curvature || []),
      ...(value.length || []),
      ...(value.visualWeight || []),
      ...(value.colorContrast || []),
      ...(value.examples || []).map((item) => item?.whyItWorks)
    ]);
  }

  return [];
}

function mapExecution(result, locale, copy, selectedRoute) {
  if (!selectedRoute) {
    return {
      title: copy.executionTitle,
      routeId: null,
      routeTitle: null,
      domains: []
    };
  }

  const grouped = new Map();
  (selectedRoute.actions || []).forEach((action) => {
    const key = executionKey(action.domain);
    if (!grouped.has(key)) grouped.set(key, []);
    const text = actionText(action, locale);
    if (text) grouped.get(key).push(text);
  });

  const domainResults = {
    hair: result?.hair,
    grooming: result?.grooming,
    makeup: result?.makeup,
    color: result?.color,
    eyewear: result?.eyewear,
    accessories: result?.accessories,
    face_adjacent_style: result?.faceAdjacentStyle
  };

  const orderedKeys = unique((selectedRoute.domains || []).map(executionKey));
  const domains = orderedKeys.map((key) => {
    const domainResult = domainResults[key];
    if (domainResult && !["available", "partial"].includes(domainResult.status)) return null;

    const routeActions = unique(grouped.get(key) || []);
    const executionActions = locale === "ko" ? koExecutionLines(key, result) : [];
    const actions = executionActions.length ? executionActions : routeActions;

    if (!actions.length) return null;

    return {
      domain: key,
      title: copy.domain[key] || key,
      actions
    };
  }).filter(Boolean);

  return {
    title: copy.executionTitle,
    routeId: selectedRoute.routeId,
    routeTitle: safeText(selectedRoute.title, locale, selectedRoute.routeId),
    domains
  };
}

function conflictText(item, locale) {
  if (locale === "ko") {
    return {
      description: safeText(item?.description, locale, ""),
      resolution: safeText(item?.resolution, locale, "")
    };
  }

  const key = item?.type || item?.impact || item?.conflictId;
  if (key === "over_amplification_guard") {
    return {
      description: "The eye direction already reads upward, so adding another strong upward angle can over-amplify the same cue.",
      resolution: "Adjust definition and length instead of increasing the angle."
    };
  }
  if (key === "contrast_guard") {
    return {
      description: "Feature contrast is already high, so increasing contrast everywhere can overload the result.",
      resolution: "Keep one feature as the main contrast point."
    };
  }
  if (key === "accent-overload") {
    return {
      description: "Several strong accents can compete around the face.",
      resolution: "Keep one or two accents dominant and reduce the others."
    };
  }

  return {
    description: safeText(item?.description, locale, ""),
    resolution: safeText(item?.resolution, locale, "")
  };
}

function mapConflicts(result, locale, copy) {
  const combined = Array.isArray(result?.looks?.visualConflicts)
    ? result.looks.visualConflicts
    : (result?.styleDelta?.conflicts || []);
  const seen = new Set();
  const items = [];

  combined.forEach((item, index) => {
    const key = item?.type || item?.conflictId || `conflict-${index}`;
    if (seen.has(key)) return;
    seen.add(key);
    const mapped = conflictText(item, locale);
    if (!mapped.description) return;
    items.push({
      id: key,
      description: mapped.description,
      resolution: mapped.resolution || null
    });
  });

  return {
    title: copy.conflictsTitle,
    items
  };
}

function productValues(copySet, key, value) {
  const values = Array.isArray(value) ? value : [value];
  return values.map((item) => copySet[key]?.[item]).filter(Boolean);
}

function mapProductGuides(result, locale, copy) {
  const valueCopy = PRODUCT_VALUE_COPY[locale];
  return (result?.productHandoff?.specifications || []).map((spec) => {
    const attrs = spec.requiredAttributes || {};
    const recommended = unique([
      ...productValues(valueCopy, "opacity", attrs.opacity),
      ...productValues(valueCopy, "chroma", attrs.chroma),
      ...productValues(valueCopy, "diffusion", attrs.diffusion),
      ...productValues(valueCopy, "buildability", attrs.buildability),
      ...productValues(valueCopy, "finish", attrs.finish)
    ]);
    const avoid = unique(
      (spec.excludedAttributes?.constraints || [])
        .map((item) => valueCopy.constraint[item])
        .filter(Boolean)
    );

    return {
      specId: spec.specId,
      category: copy.productCategory[spec.category] || (locale === "en" ? "Makeup product" : "색조 제품"),
      recommendedLabel: copy.recommended,
      avoidLabel: copy.avoid,
      recommended,
      avoid
    };
  }).filter((item) => item.recommended.length || item.avoid.length);
}

function mapLook(result, locale, copy, selectedRoute, execution) {
  if (!selectedRoute) return null;

  const canonicalLook = (result?.looks?.looks || []).find(
    (item) => item?.routeId === selectedRoute.routeId
  ) || null;

  const canonicalPieces = (canonicalLook?.pieces || [])
    .map((piece) => ({
      domain: piece.domain,
      title: copy.domain[piece.domain] || piece.domain,
      summary: safeText(piece.summary, locale, "")
    }))
    .filter((piece) => piece.summary);

  const fallbackSummary = safeText(
    selectedRoute.summary,
    locale,
    actionText(selectedRoute.actions?.[0], locale)
  );

  return {
    title: copy.lookTitle,
    routeTitle: safeText(canonicalLook?.title, locale, safeText(selectedRoute.title, locale, selectedRoute.routeId)),
    summary: safeText(canonicalLook?.summary, locale, fallbackSummary),
    why: safeText(canonicalLook?.whyItWorks, locale, safeText(selectedRoute.whyThisRoute, locale, "")),
    pieces: canonicalPieces.length
      ? canonicalPieces
      : execution.domains.map((domain) => ({
          domain: domain.domain,
          title: domain.title,
          summary: domain.actions[0]
        }))
  };
}

function mapArchetype(result, locale, copy) {
  if (result?.archetypeFun?.status !== "available") return null;
  const items = [...(result.archetypeFun.mix || [])]
    .sort((a, b) => (b.relativeShare || 0) - (a.relativeShare || 0))
    .map((item, index) => ({
      key: item.key,
      label: safeText(item.label, locale, item.key),
      emphasis: index === 0 ? "primary" : "secondary"
    }));

  return {
    title: copy.archetypeTitle,
    items,
    disclaimer: copy.archetypeDisclaimer
  };
}

export function buildFaceLabV2ResultPresentation(result, { locale = "ko" } = {}) {
  const resolvedLocale = localeKey(locale);
  const copy = COPY[resolvedLocale];

  if (!result || !["available", "partial"].includes(result.status)) {
    return {
      version: FACE_LAB_RESULT_PRESENTATION_VERSION,
      locale: resolvedLocale,
      status: "unavailable",
      current: null,
      target: null,
      changes: [],
      routes: { title: copy.routesTitle, selectedRouteId: null, cards: [] },
      execution: { title: copy.executionTitle, routeId: null, routeTitle: null, domains: [] },
      conflicts: { title: copy.conflictsTitle, items: [] },
      look: null,
      productGuides: [],
      productTitle: copy.productTitle,
      archetype: mapArchetype(result, resolvedLocale, copy)
    };
  }

  const selectedRoute = (result.routes?.routes || []).find(
    (route) => route.routeId === result.routes?.selectedRouteId
  ) || null;

  const execution = mapExecution(result, resolvedLocale, copy, selectedRoute);

  return {
    version: FACE_LAB_RESULT_PRESENTATION_VERSION,
    locale: resolvedLocale,
    status: result.status,
    current: mapCurrent(result, resolvedLocale, copy),
    target: mapTarget(result, resolvedLocale, copy),
    changes: mapChanges(result, resolvedLocale, copy),
    changesTitle: copy.changesTitle,
    routes: {
      title: copy.routesTitle,
      selectedRouteId: result.routes?.selectedRouteId || null,
      cards: (result.routes?.routes || []).map((route) =>
        mapRoute(route, resolvedLocale, copy, result.routes?.selectedRouteId || null)
      )
    },
    execution,
    conflicts: mapConflicts(result, resolvedLocale, copy),
    look: mapLook(result, resolvedLocale, copy, selectedRoute, execution),
    productTitle: copy.productTitle,
    productGuides: mapProductGuides(result, resolvedLocale, copy),
    archetype: mapArchetype(result, resolvedLocale, copy)
  };
}
