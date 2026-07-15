import { buildCurrentProductFindings } from "./current-product-findings.js";

const PROJECTION_VERSION = "premium-functional-projection-v1";

const GOAL_COPY = {
  ko: {
    barrier_redness: { primary: "안정화·장벽", secondary: "수분 균형", direction: "진정과 장벽 보조 중심" },
    dehydration: { primary: "수분 균형", secondary: "안정화·장벽", direction: "수분과 보습 유지 중심" },
    oil_acne: { primary: "피지·트러블 케어", secondary: "모공·피부결", direction: "피지와 트러블 케어 중심" },
    pores_texture: { primary: "모공·피부결", secondary: "유분 밸런스", direction: "피지·각질 정체를 한 가지 기능성 축으로 정리" },
    uneven_tone: { primary: "톤 균일", secondary: "수분 균형", direction: "톤 케어 중심" },
    protection: { primary: "자외선 보호", secondary: "톤 균일", direction: "선케어 유지와 아침 보호 중심" }
  },
  en: {
    barrier_redness: { primary: "Barrier stability", secondary: "Hydration balance", direction: "Calming and barrier support" },
    dehydration: { primary: "Hydration balance", secondary: "Barrier stability", direction: "Hydration and moisture retention" },
    oil_acne: { primary: "Sebum and breakout care", secondary: "Pores and texture", direction: "Sebum and breakout support" },
    pores_texture: { primary: "Pores and texture", secondary: "Sebum balance", direction: "One controlled texture-care lane" },
    uneven_tone: { primary: "Tone balance", secondary: "Hydration balance", direction: "Tone care with protection first" },
    protection: { primary: "Sun protection", secondary: "Tone balance", direction: "Morning protection and sunscreen continuity" }
  }
};

const ROUTINE_GUIDE_BY_DIRECTION = {
  ko: {
    exfoliation: {
      time: "저녁 루틴",
      order: "세안 → 수분 토너 → 결 케어 한 가지 → 보습제",
      frequency: "처음 2주는 주 2회 이하",
      avoid: "각질 패드, 스크럽, 다른 결 개선 기능성 중첩",
      weeklyAction: "한 가지 결 케어만 낮은 빈도로 확인하세요."
    },
    acne_care: {
      time: "저녁 루틴",
      order: "세안 → 가벼운 수분 단계 → 트러블 기능 한 가지 → 보습제",
      frequency: "처음 2주는 주 2~3회 이하",
      avoid: "여러 트러블 기능성과 강한 각질 케어 중첩",
      weeklyAction: "트러블 기능은 한 축만 선택해 반응을 확인하세요."
    },
    soothing: {
      time: "아침·저녁 루틴",
      order: "부드러운 세안 → 진정·수분 단계 → 보습 → 아침 선케어",
      frequency: "매일 편안한 범위",
      avoid: "새 기능성 여러 개와 강한 각질 케어",
      weeklyAction: "편안했던 진정·보습 축을 일정하게 유지하세요."
    },
    barrier_support: {
      time: "아침·저녁 루틴",
      order: "부드러운 세안 → 수분 단계 → 장벽 보조 보습 → 아침 선케어",
      frequency: "매일 편안한 범위",
      avoid: "강한 각질 케어와 과도한 세안",
      weeklyAction: "보습 마무리의 편안함과 지속성을 먼저 확인하세요."
    },
    hydration: {
      time: "아침·저녁 루틴",
      order: "부드러운 세안 → 얇은 수분 단계 → 보습 마무리 → 아침 선케어",
      frequency: "매일 편안한 범위",
      avoid: "과도한 세안과 잦은 각질 케어",
      weeklyAction: "수분 공급과 보습 유지 단계를 함께 안정시키세요."
    },
    tone_care: {
      time: "아침 보호·선택한 저녁 루틴",
      order: "아침 선케어 유지 → 저녁 톤 기능 한 가지 → 보습 마무리",
      frequency: "처음 2주는 주 2~3회",
      avoid: "강한 각질 케어와 여러 톤 기능성 중첩",
      weeklyAction: "보호 단계를 고정하고 톤 기능은 한 가지씩 확인하세요."
    },
    sunscreen_protection: {
      time: "아침 루틴",
      order: "가벼운 수분·보습 → 충분한 선크림",
      frequency: "매일 아침, 야외 노출 시 덧바름 검토",
      avoid: "선크림 생략과 과도하게 무거운 베이스 대체",
      weeklyAction: "선크림을 충분히 바를 수 있도록 앞단 레이어를 가볍게 조정하세요."
    }
  },
  en: {
    exfoliation: {
      time: "Evening routine",
      order: "Cleanse → hydration → one texture-care step → moisturizer",
      frequency: "Up to twice weekly for the first 2 weeks",
      avoid: "Overlapping pads, scrubs, or other texture actives",
      weeklyAction: "Test one texture-care step at a low frequency."
    },
    acne_care: {
      time: "Evening routine",
      order: "Cleanse → light hydration → one breakout-care step → moisturizer",
      frequency: "Up to 2–3 nights weekly for the first 2 weeks",
      avoid: "Multiple breakout actives and strong exfoliation together",
      weeklyAction: "Keep breakout care in one lane and review response."
    },
    soothing: {
      time: "Morning and evening",
      order: "Gentle cleanse → calming hydration → moisturizer → morning sunscreen",
      frequency: "Daily within a comfortable range",
      avoid: "Several new actives and strong exfoliation",
      weeklyAction: "Keep the comfortable calming and moisture base steady."
    },
    barrier_support: {
      time: "Morning and evening",
      order: "Gentle cleanse → hydration → barrier-support finish → morning sunscreen",
      frequency: "Daily within a comfortable range",
      avoid: "Strong exfoliation and over-cleansing",
      weeklyAction: "Review comfort and staying power of the moisture finish first."
    },
    hydration: {
      time: "Morning and evening",
      order: "Gentle cleanse → thin hydration → moisture finish → morning sunscreen",
      frequency: "Daily within a comfortable range",
      avoid: "Over-cleansing and frequent exfoliation",
      weeklyAction: "Stabilize hydration and moisture retention together."
    },
    tone_care: {
      time: "Morning protection and selected evenings",
      order: "Maintain morning sunscreen → one evening tone step → moisturizer",
      frequency: "2–3 nights weekly for the first 2 weeks",
      avoid: "Strong exfoliation and overlapping tone actives",
      weeklyAction: "Fix protection first and review one tone active at a time."
    },
    sunscreen_protection: {
      time: "Morning routine",
      order: "Light hydration or moisturizer → full sunscreen application",
      frequency: "Every morning; consider reapplication outdoors",
      avoid: "Skipping sunscreen or replacing it with a heavier base",
      weeklyAction: "Lighten earlier layers so sunscreen can be worn fully."
    }
  }
};

function normalizeLocale(locale) {
  return locale === "en" ? "en" : "ko";
}

function getSelections(currentProducts) {
  if (Array.isArray(currentProducts)) return currentProducts;
  if (Array.isArray(currentProducts?.selections)) return currentProducts.selections;
  return [];
}

function collectReportProducts(report = {}) {
  const freeResult = report?.freeResult || {};
  const raw = [
    freeResult?.topPick,
    report?.topPick,
    ...(Array.isArray(report?.supportingProducts) ? report.supportingProducts : []),
    ...(Array.isArray(report?.budgetAlternatives) ? report.budgetAlternatives : []),
    ...(Array.isArray(freeResult?.altPicks) ? freeResult.altPicks : []),
    ...(Array.isArray(freeResult?.categoryPicks) ? freeResult.categoryPicks : [])
  ];
  const seen = new Set();
  return raw
    .map((item) => item?.product || item)
    .filter((product) => product?.name)
    .filter((product) => {
      const key = String(product.id || `${product.brand || ""}-${product.name || ""}`);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function sanitizeFinding(finding) {
  if (!finding || typeof finding !== "object") return null;
  const profile = finding.profile && typeof finding.profile === "object"
    ? {
        evaluable: Boolean(finding.profile.evaluable),
        categoryRole: finding.profile.categoryRole || null,
        functionalAxes: Array.isArray(finding.profile.functionalAxes)
          ? finding.profile.functionalAxes.map((axis) => ({
              axis: axis?.axis || null,
              strength: axis?.strength || "none",
              confidence: axis?.confidence || "none"
            })).filter((axis) => axis.axis)
          : [],
        cautionTags: Array.isArray(finding.profile.cautionTags)
          ? finding.profile.cautionTags.filter(Boolean)
          : []
      }
    : null;
  return {
    sourceState: finding.sourceState || "unanswered",
    category: finding.category || "",
    productId: finding.productId || null,
    productName: finding.productName || null,
    canEvaluate: Boolean(finding.canEvaluate),
    relationToPlan: finding.relationToPlan || "not_evaluable",
    matchedAxes: Array.isArray(finding.matchedAxes) ? finding.matchedAxes.filter(Boolean) : [],
    reason: finding.reason || "",
    profile
  };
}

function buildAudit({ findingsResult, selections, locale }) {
  const findings = (Array.isArray(findingsResult?.findings) ? findingsResult.findings : [])
    .map(sanitizeFinding)
    .filter(Boolean);
  const summary = findingsResult?.summary || {};
  const isEnglish = locale === "en";

  if (!selections.length) {
    return {
      status: "NO_ROUTINE_DATA",
      title: isEnglish ? "Current product check" : "현재 제품 점검",
      findings: [],
      summary,
      hasNotInDb: false,
      message: isEnglish
        ? "You continued without selecting products, so routine fit and overlap were not checked."
        : "제품 선택 없이 계속해 현재 루틴의 적합도와 중복 여부는 점검하지 않았습니다.",
      actionMessage: isEnglish
        ? "Review the functional plan from skin-state guidance only."
        : "추천 플랜은 피부 상태 기준으로만 확인하세요."
    };
  }

  const hasDuplicate = findings.some((finding) => finding.relationToPlan === "duplicate_axis");
  const hasSupport = findings.some((finding) => finding.relationToPlan === "supports_goal");
  const hasSelected = findings.some((finding) => finding.sourceState === "selected");
  const hasNotInDb = findings.some((finding) => finding.sourceState === "not_in_db");

  if (hasDuplicate) {
    return {
      status: "CONSOLIDATE",
      title: isEnglish ? "Review similar functional steps together" : "비슷한 방향은 함께 점검하세요",
      findings,
      summary,
      hasNotInDb,
      message: isEnglish
        ? "Multiple selected products show the same functional direction, so frequency and pairing are worth checking together."
        : "같은 방향의 제품이 여러 개 확인되어, 함께 사용할 때는 빈도와 조합을 점검하는 편이 좋습니다.",
      actionMessage: isEnglish
        ? "This is not an immediate stop instruction; use it to keep the routine simpler."
        : "당장 중단하라는 뜻이 아니라, 이번 기간에는 루틴을 단순하게 유지하기 위한 점검 신호로 보세요."
    };
  }

  if (hasSupport) {
    return {
      status: "OPTIMIZE",
      title: isEnglish ? "A current product connects to this direction" : "현재 제품과 연결되는 신호가 있습니다",
      findings,
      summary,
      hasNotInDb,
      message: isEnglish
        ? "A selected product has verifiable ingredient-purpose signals connected to this functional direction."
        : "선택한 제품 중 이번 기능성 방향과 연결되는 성분 목적 신호가 확인됩니다.",
      actionMessage: isEnglish
        ? "Before adding more, review current frequency and same-day pairing."
        : "바로 새 제품을 늘리기보다, 먼저 현재 제품의 사용 빈도와 같은 날 조합을 확인하세요."
    };
  }

  if (hasSelected) {
    return {
      status: "MISMATCH",
      title: isEnglish ? "Current products were checked conservatively" : "현재 제품을 보수적으로 확인했습니다",
      findings,
      summary,
      hasNotInDb,
      message: isEnglish
        ? "Selected products may have other routine roles, but they are not treated as the core product for this direction."
        : "선택한 제품의 역할은 확인하되, 이번 기능성 방향의 핵심 제품으로 단정하지 않았습니다.",
      actionMessage: isEnglish
        ? "Product names or brands were not used to infer ingredients or functionality."
        : "제품명이나 브랜드명으로 성분·기능성을 추정하지 않았습니다."
    };
  }

  return {
    status: "UNKNOWN",
    title: isEnglish ? "Product information check" : "현재 제품 정보 확인",
    findings,
    summary,
    hasNotInDb,
    message: isEnglish
      ? "Current product input was reviewed only where structured product data was available."
      : "구조화된 제품 정보가 있는 범위에서만 현재 제품을 점검했습니다.",
    actionMessage: hasNotInDb || summary.notInDbCount
      ? (isEnglish
          ? "Unregistered products were not inferred from product or brand names."
          : "DB에 없는 제품은 제품명이나 브랜드명으로 기능성을 추정하지 않았습니다.")
      : (isEnglish
          ? "Use this as routine context, not as a stop-or-replace instruction."
          : "이 결과는 중단이나 교체 지시가 아니라 현재 루틴을 확인하기 위한 정보입니다.")
  };
}

function buildPlanSummary(policy, copy, locale) {
  const isEnglish = locale === "en";
  if (policy.planMode === "HOLD") {
    return isEnglish
      ? "Do not add a new active yet. First confirm that the comfortable base stays stable."
      : "이번 기간에는 새 기능성을 추가하기보다 피부가 편안하게 유지되는 기반을 먼저 확인하세요.";
  }
  if (policy.allowedIntensity === "support_only") {
    return isEnglish
      ? `Start with ${copy.primary.toLowerCase()} and keep the plan limited to supportive care.`
      : `${copy.primary}을 먼저 잡고, 보조 관리 범위에서 루틴을 안정시키세요.`;
  }
  return isEnglish
    ? `Start with ${copy.primary.toLowerCase()} and test ${copy.direction.toLowerCase()} at a controlled intensity.`
    : `${copy.primary}을 먼저 잡고, ${copy.direction} 방향을 낮은 강도로 확인하세요.`;
}

function buildBaseApproach(policy, locale) {
  const isEnglish = locale === "en";
  if (policy.planMode === "HOLD") {
    return isEnglish
      ? "Keep the hydration and moisture base that already felt comfortable, and pause new active expansion."
      : "현재 루틴에서 편안했던 수분·보습 축을 유지하고 기능성 추가는 보류합니다.";
  }
  if (policy.allowedIntensity === "support_only") {
    return isEnglish
      ? "Keep the base steady and avoid turning supportive care into a larger active stack."
      : "기반 루틴을 일정하게 유지하고 보조 관리가 여러 기능성 중첩으로 커지지 않게 합니다.";
  }
  return isEnglish
    ? "Test only one functional direction at a time and increase intensity only after tolerance is clear."
    : "한 번에 한 가지 기능 방향만 확인하고, 반응이 안정적일 때만 강도를 넓힙니다.";
}

function buildRoutineGuide(policy, locale) {
  const base = ROUTINE_GUIDE_BY_DIRECTION[locale]?.[policy.functionalDirection] ||
    ROUTINE_GUIDE_BY_DIRECTION[locale].hydration;
  if (policy.planMode !== "HOLD") {
    return {
      ...base,
      review: policy.reviewCondition
    };
  }
  return {
    time: locale === "en" ? "For now" : "이번 기간",
    order: locale === "en"
      ? "Keep only the hydration and moisture steps that have already felt comfortable."
      : "새 기능성 추가 없이 편안했던 수분·보습 단계를 중심으로 유지",
    frequency: locale === "en"
      ? "Maintain the existing comfortable frequency until discomfort settles"
      : "불편 신호가 줄 때까지 기존 편안한 빈도 유지",
    avoid: base.avoid,
    review: policy.reviewCondition,
    weeklyAction: locale === "en"
      ? "Do not add a new product yet; confirm stabilization first."
      : "새 제품을 추가하지 않고 안정화 여부를 먼저 확인하세요."
  };
}

export function buildPremiumFunctionalProjection({ report = {}, functionalPolicy, locale = "ko" } = {}) {
  const resolvedLocale = normalizeLocale(locale || functionalPolicy?.locale);
  const policy = functionalPolicy || report?.functionalPolicy || report?.decisionBundle?.functionalPolicy;
  if (!policy || typeof policy !== "object") {
    return {
      version: PROJECTION_VERSION,
      functionalPlan: null,
      currentProductFindings: { findings: [], summary: {} },
      functionalRoutineAudit: buildAudit({ findingsResult: {}, selections: [], locale: resolvedLocale })
    };
  }

  const copy = GOAL_COPY[resolvedLocale][policy.primaryGoal] || GOAL_COPY[resolvedLocale].dehydration;
  const products = collectReportProducts(report);
  const currentProductFindings = buildCurrentProductFindings({
    currentProducts: report?.currentProducts,
    primaryGoal: policy.primaryGoal,
    functionalDirection: policy.functionalDirection
  });
  const selections = getSelections(report?.currentProducts);
  const functionalRoutineAudit = buildAudit({
    findingsResult: currentProductFindings,
    selections,
    locale: resolvedLocale
  });
  const secondaryCopy = policy.secondaryGoal
    ? GOAL_COPY[resolvedLocale][policy.secondaryGoal]
    : null;
  const functionalPlan = {
    version: PROJECTION_VERSION,
    policyVersion: policy.version || null,
    primaryGoal: policy.primaryGoal,
    secondaryGoal: policy.secondaryGoal || null,
    functionalDirection: policy.functionalDirection,
    status: policy.status,
    planMode: policy.planMode,
    allowedIntensity: policy.allowedIntensity,
    primaryConcern: copy.primary,
    secondaryConcern: secondaryCopy?.primary || copy.secondary || null,
    direction: copy.direction,
    planSummary: buildPlanSummary(policy, copy, resolvedLocale),
    whyPriority: resolvedLocale === "en"
      ? "This direction comes from the canonical functional policy using the shared decision context."
      : "공통 Decision Context를 사용하는 단일 기능성 정책에서 이번 방향을 결정했습니다.",
    baseApproach: buildBaseApproach(policy, resolvedLocale),
    ingredientLabels: [],
    productCandidates: products.slice(0, 3),
    secondarySolution: {
      title: secondaryCopy?.primary || copy.secondary || null,
      direction: resolvedLocale === "en"
        ? "Manage the support concern only where it does not interfere with the main goal."
        : "주요 고민을 방해하지 않는 범위에서 보조 고민을 관리합니다.",
      products: []
    },
    budgetAlternatives: Array.isArray(report?.budgetAlternatives)
      ? report.budgetAlternatives.slice(0, 3)
      : [],
    targetCategories: Array.isArray(policy.targetCategories) ? [...policy.targetCategories] : [],
    avoidWith: Array.isArray(policy.avoidWith) ? [...policy.avoidWith] : [],
    reviewCondition: policy.reviewCondition || null,
    routineGuide: buildRoutineGuide(policy, resolvedLocale)
  };

  return {
    version: PROJECTION_VERSION,
    functionalPlan,
    currentProductFindings: {
      findings: functionalRoutineAudit.findings,
      summary: currentProductFindings.summary || {}
    },
    functionalRoutineAudit
  };
}

export const PREMIUM_FUNCTIONAL_PROJECTION_VERSION = PROJECTION_VERSION;
