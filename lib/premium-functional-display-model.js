const DISPLAY_MODEL_VERSION = "premium-functional-display-model-v1";

const LEGACY_GOAL_MAP = {
  barrier_soothing: { primaryGoal: "barrier_redness", functionalDirection: "soothing" },
  hydration: { primaryGoal: "dehydration", functionalDirection: "hydration" },
  sebum_pore: { primaryGoal: "oil_acne", functionalDirection: "acne_care" },
  tone_spot: { primaryGoal: "uneven_tone", functionalDirection: "tone_care" },
  texture_exfoliation: { primaryGoal: "pores_texture", functionalDirection: "exfoliation" }
};

const LEGACY_COPY = {
  ko: {
    barrier_redness: { primary: "안정화·장벽", secondary: "수분 균형", direction: "진정과 장벽 보조 중심" },
    dehydration: { primary: "수분 균형", secondary: "안정화·장벽", direction: "수분과 보습 유지 중심" },
    oil_acne: { primary: "피지·트러블 케어", secondary: "모공·피부결", direction: "피지와 트러블 케어 중심" },
    pores_texture: { primary: "모공·피부결", secondary: "유분 밸런스", direction: "낮은 빈도의 결 케어 중심" },
    uneven_tone: { primary: "톤 균일", secondary: "수분 균형", direction: "보호 우선의 톤 케어 중심" }
  },
  en: {
    barrier_redness: { primary: "Barrier stability", secondary: "Hydration balance", direction: "Calming and barrier support" },
    dehydration: { primary: "Hydration balance", secondary: "Barrier stability", direction: "Hydration and moisture retention" },
    oil_acne: { primary: "Sebum and breakout care", secondary: "Pores and texture", direction: "Sebum and breakout support" },
    pores_texture: { primary: "Pores and texture", secondary: "Sebum balance", direction: "Low-frequency texture care" },
    uneven_tone: { primary: "Tone balance", secondary: "Hydration balance", direction: "Protection-first tone care" }
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

function collectProducts(report = {}) {
  const freeResult = report?.freeResult || {};
  const raw = [
    freeResult?.topPick,
    report?.topPick,
    ...(Array.isArray(report?.supportingProducts) ? report.supportingProducts : []),
    ...(Array.isArray(report?.budgetAlternatives) ? report.budgetAlternatives : []),
    ...(Array.isArray(freeResult?.altPicks) ? freeResult.altPicks : [])
  ];
  const seen = new Set();
  return raw
    .map((item) => item?.product || item)
    .filter((item) => item?.name)
    .filter((item) => {
      const key = String(item.id || `${item.brand || ""}-${item.name || ""}`);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3);
}

function buildLegacyAudit(report, locale) {
  const isEnglish = locale === "en";
  const selections = getSelections(report?.currentProducts);
  if (!selections.length) {
    return {
      status: "NO_ROUTINE_DATA",
      title: isEnglish ? "Current product check" : "현재 제품 점검",
      findings: [],
      hasNotInDb: false,
      message: isEnglish
        ? "This saved report does not contain a canonical current-product audit."
        : "이 저장 리포트에는 정규화된 현재 제품 점검 결과가 없습니다.",
      actionMessage: isEnglish
        ? "Use the functional plan as skin-state guidance only."
        : "기능성 플랜은 피부 상태 중심 안내로 확인하세요."
    };
  }
  return {
    status: "UNKNOWN",
    title: isEnglish ? "Legacy current-product data" : "이전 형식의 현재 제품 정보",
    findings: Array.isArray(report?.currentProductFindings?.findings)
      ? report.currentProductFindings.findings
      : [],
    hasNotInDb: selections.some((item) => item?.status === "not_in_db"),
    message: isEnglish
      ? "This legacy report does not contain the canonical functional audit, so no new judgment was inferred in the UI."
      : "이전 형식 리포트에는 정규화된 기능성 점검이 없어 UI에서 새 판단을 추론하지 않았습니다.",
    actionMessage: isEnglish
      ? "Regenerate or update current products to receive the canonical audit."
      : "현재 제품을 다시 확인하거나 리포트를 재생성하면 정규화된 점검을 받을 수 있습니다."
  };
}

function buildLegacyPlan({ report, decisions, locale }) {
  const primaryDecision = decisions.find((item) => item?.status === "now") || decisions[0] || null;
  const mapped = LEGACY_GOAL_MAP[primaryDecision?.goalKey] || LEGACY_GOAL_MAP.hydration;
  const copy = LEGACY_COPY[locale][mapped.primaryGoal] || LEGACY_COPY[locale].dehydration;
  const planMode = primaryDecision?.status === "pause" ? "HOLD" : "START";
  const isEnglish = locale === "en";
  return {
    version: "legacy-functional-projection-v1",
    policyVersion: null,
    primaryGoal: mapped.primaryGoal,
    secondaryGoal: null,
    functionalDirection: mapped.functionalDirection,
    status: primaryDecision?.status || "later",
    planMode,
    allowedIntensity: planMode === "HOLD" ? "hold" : "low",
    primaryConcern: primaryDecision?.title || copy.primary,
    secondaryConcern: copy.secondary,
    direction: copy.direction,
    planSummary: primaryDecision?.summary || (isEnglish
      ? "This legacy report is shown without recomputing functional policy in the UI."
      : "이전 리포트의 기능성 판단을 UI에서 재계산하지 않고 표시합니다."),
    whyPriority: primaryDecision?.reasons?.[0] || (isEnglish
      ? "This is a compatibility view of the saved decision."
      : "저장된 판단을 호환 표시한 결과입니다."),
    baseApproach: primaryDecision?.nextAction || (isEnglish
      ? "Keep the plan narrow until the report is regenerated."
      : "리포트를 다시 생성하기 전까지 기능 방향을 좁게 유지하세요."),
    ingredientLabels: [],
    productCandidates: collectProducts(report),
    secondarySolution: {
      title: copy.secondary,
      direction: isEnglish
        ? "Keep the support concern secondary to the saved main decision."
        : "저장된 주요 판단을 방해하지 않는 범위에서 보조 고민을 관리합니다.",
      products: []
    },
    budgetAlternatives: Array.isArray(report?.budgetAlternatives)
      ? report.budgetAlternatives.slice(0, 3)
      : [],
    targetCategories: [],
    avoidWith: [],
    reviewCondition: null,
    routineGuide: {
      time: planMode === "HOLD" ? (isEnglish ? "For now" : "이번 기간") : (isEnglish ? "Selected routine" : "선택한 루틴"),
      order: isEnglish
        ? "Use the saved report order; the UI does not infer a new sequence."
        : "저장된 리포트 순서를 따르며 UI에서 새 순서를 추론하지 않습니다.",
      frequency: isEnglish
        ? "Use the saved comfortable frequency"
        : "기존에 편안했던 빈도 유지",
      avoid: isEnglish
        ? "Avoid overlapping several new actives"
        : "여러 새 기능성 중첩",
      review: isEnglish
        ? "Regenerate the report before increasing intensity."
        : "강도를 늘리기 전 리포트를 다시 확인하세요.",
      weeklyAction: primaryDecision?.nextAction || null
    }
  };
}

export function resolvePremiumFunctionalDisplayModel({
  report = {},
  decisions = [],
  locale = "ko",
  devScenario = null
} = {}) {
  const resolvedLocale = normalizeLocale(locale);
  if (devScenario && typeof devScenario === "object") {
    return {
      ...devScenario,
      version: devScenario.version || DISPLAY_MODEL_VERSION,
      functionalPlan: devScenario.functionalPlan || buildLegacyPlan({
        report: devScenario,
        decisions: Array.isArray(devScenario.functionalDecisions) ? devScenario.functionalDecisions : [],
        locale: resolvedLocale
      }),
      routineAudit: devScenario.routineAudit || buildLegacyAudit(devScenario, resolvedLocale)
    };
  }

  const functionalPlan =
    report?.functionalPlan ||
    report?.decisionBundle?.functionalPlan ||
    null;
  const routineAudit =
    report?.functionalRoutineAudit ||
    report?.decisionBundle?.functionalRoutineAudit ||
    null;

  if (functionalPlan && routineAudit) {
    return {
      id: "actual-report",
      label: resolvedLocale === "en" ? "Actual report" : "실제 리포트",
      version: DISPLAY_MODEL_VERSION,
      source: "canonical",
      functionalPlan,
      routineAudit
    };
  }

  return {
    id: "legacy-report",
    label: resolvedLocale === "en" ? "Legacy saved report" : "이전 저장 리포트",
    version: DISPLAY_MODEL_VERSION,
    source: "legacy_adapter",
    functionalPlan: functionalPlan || buildLegacyPlan({ report, decisions, locale: resolvedLocale }),
    routineAudit: routineAudit || buildLegacyAudit(report, resolvedLocale)
  };
}

export const PREMIUM_FUNCTIONAL_DISPLAY_MODEL_VERSION = DISPLAY_MODEL_VERSION;
