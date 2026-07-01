"use client";

import { useEffect, useMemo, useState } from "react";

const PLAN_MODE_LABELS = {
  ko: {
    START: "START",
    HOLD: "HOLD",
    NEXT: "NEXT"
  },
  en: {
    START: "START",
    HOLD: "HOLD",
    NEXT: "NEXT"
  }
};

const IS_DEVELOPMENT = process.env.NODE_ENV === "development";
const EMPTY_DEV_SCENARIOS = [];

const PLAN_MODE_TONE = {
  START: "border-violet-300/50 bg-violet-500/12 text-violet-700 dark:text-violet-200",
  HOLD: "border-amber-300/50 bg-amber-500/14 text-amber-700 dark:text-amber-200",
  NEXT: "border-sky-300/45 bg-sky-500/12 text-sky-700 dark:text-sky-200"
};

const AUDIT_TONE = {
  NO_ROUTINE_DATA: "border-zinc-300/60 bg-white/5 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300",
  UNKNOWN: "border-zinc-300/60 bg-white/5 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300",
  OPTIMIZE: "border-emerald-300/45 bg-emerald-500/12 text-emerald-700 dark:text-emerald-200",
  CONSOLIDATE: "border-sky-300/45 bg-sky-500/12 text-sky-700 dark:text-sky-200",
  MISMATCH: "border-violet-300/45 bg-violet-500/10 text-violet-700 dark:text-violet-200",
  ADJUST: "border-amber-300/50 bg-amber-500/14 text-amber-700 dark:text-amber-200",
  REPLACE_CANDIDATE: "border-rose-300/45 bg-rose-500/10 text-rose-700 dark:text-rose-200"
};

const CONCERN_TO_PLAN = {
  barrier: {
    title: "안정화·장벽",
    direction: "진정과 장벽 부담 정리",
    secondary: "수분 균형"
  },
  redness: {
    title: "안정화·장벽",
    direction: "진정과 장벽 부담 정리",
    secondary: "수분 균형"
  },
  dehydration: {
    title: "수분 균형",
    direction: "수분·보습·장벽 균형",
    secondary: "안정화·장벽"
  },
  oiliness: {
    title: "피지·트러블 케어",
    direction: "피지와 트러블 부담을 한 축으로 정리",
    secondary: "모공·피부결"
  },
  acne: {
    title: "피지·트러블 케어",
    direction: "피지와 트러블 부담을 한 축으로 정리",
    secondary: "모공·피부결"
  },
  pores: {
    title: "모공·피부결",
    direction: "피지·각질 정체를 한 가지 기능성 축으로 정리",
    secondary: "유분 밸런스"
  },
  uneven_tone: {
    title: "톤 균일",
    direction: "톤 균일 목표를 한 가지 보정 축으로 검토",
    secondary: "수분 균형"
  }
};

const CATEGORY_LABELS = {
  cleanser: "클렌저",
  toner_essence: "토너/에센스",
  toner_pad: "토너 패드",
  treatment: "세럼/기능성",
  serum: "세럼",
  ampoule: "앰플",
  essence: "에센스",
  moisturizer: "보습제",
  moisturizer_lotion_emulsion: "로션/에멀전",
  moisturizer_gel: "젤 보습제",
  moisturizer_cream: "크림",
  moisturizer_balm: "밤",
  sunscreen: "선크림"
};

const GOAL_AXES = {
  "모공·피부결": ["pores"],
  "피지·트러블 케어": ["oiliness", "acne"],
  "수분 균형": ["dehydration", "barrier"],
  "안정화·장벽": ["barrier", "redness"],
  "톤 균일": ["uneven_tone"]
};

const COPY = {
  ko: {
    kicker: "FUNCTIONAL PLAN",
    title: "기능성 플랜",
    body: "지금 피부 상태와 확인 가능한 제품 정보를 바탕으로, 무엇을 더하고 무엇의 속도를 늦출지 정리합니다.",
    devBanner: "개발용 기능성 플랜 시나리오 — 저장되지 않음",
    scenarioLabel: "시나리오",
    primaryTab: "주요 고민 추천",
    secondaryTab: "보조 고민 솔루션",
    budgetTab: "예산별 대안",
    productSection: "내게 맞는 제품 고르기",
    productNotice: "개발용 fixture 또는 현재 리포트 후보만 화면 확인용으로 표시합니다. 저장·구매·DB 변경과 연결되지 않습니다.",
    reportProductNotice: "현재 리포트에서 확인 가능한 후보만 표시합니다. 현재 제품 목록이나 저장된 리포트에는 바로 반영되지 않습니다.",
    routineGuide: "내 루틴에 넣기",
    auditTitle: "이미 사용 중인 기능성 점검",
    solutionTitle: "주요 고민 솔루션",
    summaryButton: "이번 기능성 플랜 요약 보기",
    summaryTitle: "이번 기능성 플랜 요약",
    close: "닫기",
    noProducts: "현재 조건에 맞는 화면용 후보가 없습니다. 제품을 억지로 채우지 않습니다.",
    ctaNotice: "이 버튼은 화면 확인용입니다. 현재 제품 목록, 저장된 리포트, DB에는 반영되지 않습니다.",
    reportCtaNotice: "현재 제품 목록에는 아직 저장되지 않습니다. 다음 루틴 설정에서 추가할 수 있습니다."
  },
  en: {
    kicker: "FUNCTIONAL PLAN",
    title: "Functional plan",
    body: "Based on the current skin state and verifiable product information, this organizes what to add and what to slow down.",
    devBanner: "Development functional-plan scenario — not saved",
    scenarioLabel: "Scenario",
    primaryTab: "Main concern",
    secondaryTab: "Support concern",
    budgetTab: "Budget alternatives",
    productSection: "Choose a fitting product",
    productNotice: "Development fixtures or current report candidates are shown for UI preview only. They do not save, purchase, or update DB data.",
    reportProductNotice: "Only candidates available in the current report are shown. This does not directly update current products or the saved report.",
    routineGuide: "Place it in my routine",
    auditTitle: "Current active check",
    solutionTitle: "Main concern solution",
    summaryButton: "View this functional plan summary",
    summaryTitle: "Functional plan summary",
    close: "Close",
    noProducts: "No display candidate is available for this condition. Product cards are not forced.",
    ctaNotice: "This button is for UI preview only. It does not update current products, saved reports, or the DB.",
    reportCtaNotice: "This is not saved to the current product list yet. You can add it in the next routine setup."
  }
};

function getCopy(locale) {
  return locale === "en" ? COPY.en : COPY.ko;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function compactList(values, limit = 4) {
  const seen = new Set();

  return (Array.isArray(values) ? values : [])
    .map((item) => normalizeText(item))
    .filter((item) => {
      const key = item.toLowerCase();

      if (!item || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

function getSelections(currentProducts) {
  if (Array.isArray(currentProducts)) {
    return currentProducts;
  }

  return Array.isArray(currentProducts?.selections) ? currentProducts.selections : [];
}

function getSnapshot(selection = {}) {
  return selection.productSnapshot || selection.product || null;
}

function getProductTitle(product = {}) {
  return [product.brand, product.name].map(normalizeText).filter(Boolean).join(" ") || "선택한 제품";
}

function getCategoryLabel(category) {
  return CATEGORY_LABELS[normalizeText(category)] || CATEGORY_LABELS[normalizeText(category).toLowerCase()] || "제품";
}

function getPriorityAxis(result = {}) {
  return normalizeText(result?.priority?.axis || result?.mainConcern || result?.form?.mainConcern || "pores");
}

function getPlanBase(result = {}) {
  return CONCERN_TO_PLAN[getPriorityAxis(result)] || CONCERN_TO_PLAN.pores;
}

function getConcernScore(result, axis) {
  const value =
    result?.scoring?.concernScores?.[axis]?.total ??
    result?.scoreCard?.[axis]?.total ??
    result?.concernScores?.[axis]?.total;
  const score = Number(value);
  return Number.isFinite(score) ? score : 0;
}

function inferPlanMode({ result = {}, decisions = [] }) {
  const priorityAxis = getPriorityAxis(result);
  const answers = result?.answers || result?.form || {};
  const sensitivity = normalizeText(answers.sensitivity || answers.sensitivityLevel || result?.sensitivity).toLowerCase();
  const sensitive = ["high", "very_high", "yes", "true", "sensitive"].includes(sensitivity);
  const barrierSignal = getConcernScore(result, "barrier") >= 18 || getConcernScore(result, "redness") >= 18;
  const hasPause = Array.isArray(decisions) && decisions.some((decision) => decision?.status === "pause");

  if (hasPause || (sensitive && barrierSignal)) {
    return "HOLD";
  }

  if (priorityAxis === "uneven_tone" && getConcernScore(result, "barrier") >= 14) {
    return "NEXT";
  }

  return "START";
}

function unwrapProduct(item) {
  return item?.product || item || null;
}

function mapProductForDisplay(product = {}, fallbackPosition = "") {
  return {
    id: normalizeText(product.id || `${product.brand}-${product.name}`),
    brand: normalizeText(product.brand || "확인 제품"),
    name: normalizeText(product.name || "제품명 확인 중"),
    category: normalizeText(product.category || product.step || product.product_form || "treatment"),
    product_form: normalizeText(product.product_form || product.productForm || ""),
    concerns: compactList(product.concerns || product.concern || [], 6),
    texture: normalizeText(product.texture || product.finish || "사용감 정보 확인 중"),
    finish: normalizeText(product.finish || ""),
    priceLabel: product.priceLabel || getPriceLabel(product),
    position: normalizeText(product.position || product.recommendation_tier || fallbackPosition),
    ingredientLabels: compactList(product.ingredientLabels || product.activeLabels || [], 3),
    reason: normalizeText(product.reason || product.explanation || product.standout_reason || "현재 리포트에 포함된 화면용 후보입니다.")
  };
}

function getPriceLabel(product = {}) {
  const min = Number(product.price_min || product.priceMin || 0);
  const max = Number(product.price_max || product.priceMax || 0);

  if (Number.isFinite(min) && min > 0 && Number.isFinite(max) && max > 0) {
    const low = Math.min(min, max);
    const high = Math.max(min, max);
    return low === high ? `${low.toLocaleString("ko-KR")}원` : `${low.toLocaleString("ko-KR")}~${high.toLocaleString("ko-KR")}원`;
  }

  return normalizeText(product.price_range || product.priceRange || "가격 정보 확인 중");
}

function collectReportProducts({ freeResult, report }) {
  const candidates = [
    freeResult?.topPick,
    ...(Array.isArray(report?.supportingProducts) ? report.supportingProducts.map(unwrapProduct) : []),
    ...(Array.isArray(report?.budgetAlternatives) ? report.budgetAlternatives.map(unwrapProduct) : []),
    ...(Array.isArray(freeResult?.altPicks) ? freeResult.altPicks : [])
  ].filter(Boolean);
  const seen = new Set();

  return candidates
    .map((product, index) => mapProductForDisplay(product, index === 0 ? "주요 고민 추천" : "비교 후보"))
    .filter((product) => {
      const key = product.id || `${product.brand}-${product.name}`;

      if (!key || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, 3);
}

function productMatchesPrimary(product, primaryConcern) {
  const axes = GOAL_AXES[primaryConcern] || [];
  return product.concerns?.some((concern) => axes.includes(concern));
}

function buildActualFunctionalPlan({ freeResult = {}, report = {}, decisions = [] }) {
  const base = getPlanBase(freeResult);
  const planMode = inferPlanMode({ result: freeResult, decisions });
  const products = collectReportProducts({ freeResult, report });
  const primaryProducts = products.filter((product) => productMatchesPrimary(product, base.title));
  const displayProducts = (primaryProducts.length ? primaryProducts : products).slice(0, 3);

  return {
    primaryConcern: base.title,
    secondaryConcern: base.secondary,
    direction: base.direction,
    planMode,
    planSummary: planMode === "HOLD"
      ? "이번 기간에는 새 기능성을 늘리기보다 피부가 편안하게 유지되는 기반을 먼저 만듭니다."
      : planMode === "NEXT"
        ? `${base.title}은 유효하지만 현재 우선순위가 안정된 뒤 다음 단계로 검토합니다.`
        : `${base.title}을 한 가지 기능성 목표로 좁혀 낮은 빈도로 시작합니다.`,
    whyPriority: "무료 결과의 priority와 concernScores를 기준으로 이번 주요 고민을 정했습니다.",
    baseApproach: planMode === "HOLD"
      ? "기본 보습·수분 축을 유지하고 활성 기능성 확장은 보류합니다."
      : "저녁 루틴에서 하나의 기능성 축만 분리해 반응을 확인합니다.",
    ingredientLabels: [],
    productCandidates: displayProducts,
    secondarySolution: base.secondary
      ? {
          title: base.secondary,
          direction: "주요 고민을 방해하지 않는 선에서 보조 고민은 낮은 강도로 관리합니다.",
          products: []
        }
      : null,
    budgetAlternatives: products.slice(0, 3).map((product, index) => ({
      ...product,
      position: ["가성비", "균형", "프리미엄"][index] || "비교 후보"
    })),
    routineGuide: {
      time: "저녁 루틴",
      order: "세안 → 수분 토너 → 기능성 단계 → 보습제",
      frequency: planMode === "HOLD" ? "이번 기간 신규 추가 보류" : "처음 2주는 주 2회",
      avoid: "각질 패드, 스크럽, 다른 기능성 단계 중첩",
      review: "3~4주 후 피부 반응을 보고 재검토",
      weeklyAction: planMode === "HOLD"
        ? "이번 주에는 새 기능성 추가 없이 편안한 보습·수분 축을 유지하세요."
        : "이번 주에는 한 가지 기능성만 낮은 빈도로 확인하세요."
    }
  };
}

function getMatchEvidence(selection, primaryConcern) {
  if (selection?.status !== "selected") {
    return null;
  }

  const snapshot = getSnapshot(selection);

  if (!snapshot) {
    return null;
  }

  const axes = GOAL_AXES[primaryConcern] || [];
  const matchedConcerns = compactList(snapshot.concerns || [], 8).filter((concern) => axes.includes(concern));

  if (!matchedConcerns.length) {
    return null;
  }

  return {
    name: getProductTitle(snapshot),
    category: getCategoryLabel(snapshot.category || selection.category),
    evidence: `DB concerns: ${matchedConcerns.map((axis) => {
      if (axis === "pores") return "모공";
      if (axis === "oiliness") return "피지";
      if (axis === "acne") return "트러블";
      if (axis === "barrier") return "장벽";
      if (axis === "redness") return "붉음";
      if (axis === "dehydration") return "수분";
      if (axis === "uneven_tone") return "톤";
      return axis;
    }).join(", ")}`
  };
}

function buildActualRoutineAudit({ report = {}, primaryConcern }) {
  const selections = getSelections(report?.currentProducts);

  if (!selections.length) {
    return {
      status: "NO_ROUTINE_DATA",
      title: "현재 제품 점검",
      selectedProduct: null,
      selectedProducts: [],
      hasNotInDb: false,
      message: "제품 선택 없이 계속해 현재 루틴의 적합도와 중복 여부는 점검하지 않았습니다.",
      actionMessage: "추천 플랜은 피부 상태 기준으로만 확인하세요."
    };
  }

  const selected = selections.filter((selection) => selection?.status === "selected");
  const notInDb = selections.filter((selection) => selection?.status === "not_in_db");
  const matched = selected.map((selection) => getMatchEvidence(selection, primaryConcern)).filter(Boolean);
  const verdicts = Array.isArray(report?.currentProductVerdicts) ? report.currentProductVerdicts : [];
  const hasHoldVerdict = verdicts.some((verdict) => verdict?.status === "hold");
  const hasAdjustVerdict = verdicts.some((verdict) => verdict?.status === "adjust");

  if (matched.length >= 2) {
    return {
      status: "CONSOLIDATE",
      title: "비슷한 기능성은 정리하세요",
      selectedProduct: matched[0],
      selectedProducts: matched,
      hasNotInDb: notInDb.length > 0,
      message: "현재 확인된 제품 안에서 같은 개선 목표를 가진 제품이 여러 개 겹칩니다.",
      actionMessage: "대표 제품 하나를 중심으로 두고 같은 목적의 신규 추가는 미루세요."
    };
  }

  if (hasHoldVerdict) {
    return {
      status: "REPLACE_CANDIDATE",
      title: "다음 교체 시점에 비교하세요",
      selectedProduct: matched[0] || null,
      selectedProducts: matched,
      hasNotInDb: notInDb.length > 0,
      message: "현재 피부 부담 신호와 충돌 가능성이 있어 다음 교체 시점에 다른 방향을 검토해보세요.",
      actionMessage: "바로 사용을 멈추라고 단정하지 않고, 다음 구매 시점에 대체 후보를 비교하세요."
    };
  }

  if (hasAdjustVerdict) {
    return {
      status: "ADJUST",
      title: "사용 방식 먼저 조정",
      selectedProduct: matched[0] || null,
      selectedProducts: matched,
      hasNotInDb: notInDb.length > 0,
      message: "제품이 반드시 문제라고 단정할 수는 없지만 지금 방식은 조절해보세요.",
      actionMessage: "사용 빈도와 같은 날 조합을 먼저 낮춰 확인하세요."
    };
  }

  if (matched.length === 1) {
    return {
      status: "OPTIMIZE",
      title: "이미 잘 시작하셨어요",
      selectedProduct: matched[0],
      selectedProducts: matched,
      hasNotInDb: notInDb.length > 0,
      message: `현재 사용 중인 ${matched[0].name} (${matched[0].category}) 제품이 ${primaryConcern} 목표와 연결됩니다.`,
      actionMessage: "새 제품을 추가하기보다 현재 제품의 빈도와 같은 날 조합을 안정화하세요."
    };
  }

  if (selected.length) {
    return {
      status: "MISMATCH",
      title: "이번 주요 고민과 직접 연결되지는 않아요",
      selectedProduct: null,
      selectedProducts: [],
      hasNotInDb: notInDb.length > 0,
      message: "현재 제품은 다른 고민 축에는 연결될 수 있지만 이번 주요 고민을 직접 다루는 제품은 아닙니다.",
      actionMessage: "제품명이나 브랜드만으로 기능성을 추정하지 않고, 주요 고민 보완 후보만 별도로 비교하세요."
    };
  }

  return {
    status: "UNKNOWN",
    title: "기능성 정보 확인 불가",
    selectedProduct: null,
    selectedProducts: [],
    hasNotInDb: notInDb.length > 0,
    message: "사용 중인 제품은 있지만 기능성 정보를 확인하지 못해 현재 루틴 점검에서는 제외했습니다.",
    actionMessage: "not_in_db 제품명이나 브랜드명으로 기능성을 추정하지 않습니다."
  };
}

function buildDisplayModel({ freeResult, report, decisions, devScenario }) {
  if (devScenario) {
    return devScenario;
  }

  const functionalPlan = buildActualFunctionalPlan({ freeResult, report, decisions });

  return {
    id: "actual-report",
    label: "실제 리포트",
    functionalPlan,
    routineAudit: buildActualRoutineAudit({
      report,
      primaryConcern: functionalPlan.primaryConcern
    })
  };
}

function getProductCta(planMode, auditStatus) {
  if (planMode === "HOLD") return "피부 안정 후 검토하기";
  if (auditStatus === "OPTIMIZE") return "다음 구매 후보로 보기";
  if (auditStatus === "MISMATCH") return "주요 고민 보완 후보로 보기";
  if (auditStatus === "REPLACE_CANDIDATE" || auditStatus === "CONSOLIDATE") return "대체 후보로 비교하기";
  return "루틴에 추가 후보로 보기";
}

function ProductCard({ product, ctaLabel, onCta, isDevPreview }) {
  return (
    <article className="rounded-[1rem] border border-white/10 bg-white/5 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-16 w-14 shrink-0 items-center justify-center rounded-[0.95rem] border border-white/10 bg-white/5 text-[10px] text-zinc-400">
          {isDevPreview ? "DEV" : "후보"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-1.5">
            {product.position ? <span className="ui-chip-compact px-2.5 py-1">{product.position}</span> : null}
            <span className="ui-chip-compact px-2.5 py-1">{getCategoryLabel(product.category)}</span>
          </div>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{product.brand}</p>
          <h5 className="mt-1 break-words text-sm font-semibold leading-5 text-zinc-900 dark:text-zinc-100">{product.name}</h5>
          <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{product.priceLabel}</p>
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{product.reason}</p>
      {product.ingredientLabels?.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {product.ingredientLabels.map((label) => (
            <span key={label} className="rounded-full border border-violet-300/30 bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold text-violet-700 dark:text-violet-200">
              {label}
            </span>
          ))}
        </div>
      ) : null}
      <button type="button" onClick={onCta} className="ui-button-secondary mt-4 min-h-11 w-full justify-center px-3 text-sm font-semibold">
        {ctaLabel}
      </button>
    </article>
  );
}

function ProductPicker({ plan, audit, copy, onCta, isDevPreview }) {
  const tabs = [
    {
      key: "primary",
      label: copy.primaryTab,
      items: plan.productCandidates || []
    },
    ...(plan.secondarySolution
      ? [{
          key: "secondary",
          label: copy.secondaryTab,
          body: plan.secondarySolution.direction,
          items: plan.secondarySolution.products || []
        }]
      : []),
    {
      key: "budget",
      label: copy.budgetTab,
      body: "같은 기능성 목표 안에서 가격대와 제품 포지션을 비교하는 화면용 후보입니다.",
      items: plan.budgetAlternatives || []
    }
  ];
  const [activeTab, setActiveTab] = useState(tabs[0]?.key || "primary");
  const active = tabs.find((tab) => tab.key === activeTab) || tabs[0];
  const ctaLabel = getProductCta(plan.planMode, audit.status);

  return (
    <article className="rounded-[1rem] border border-white/10 bg-white/5 p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">PRODUCT OPTIONS</p>
        <h4 className="mt-2 text-base font-semibold leading-6 text-zinc-900 dark:text-zinc-100">{copy.productSection}</h4>
        <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{isDevPreview ? copy.productNotice : copy.reportProductNotice}</p>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-1 rounded-[1rem] border border-white/10 bg-white/5 p-1">
        {tabs.map((tab) => {
          const selected = tab.key === activeTab;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`min-h-10 rounded-[0.8rem] px-2 text-xs font-semibold transition ${
                selected ? "ui-choice-active" : "text-zinc-600 hover:bg-white/50 dark:text-zinc-300 dark:hover:bg-white/8"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {active?.body ? <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{active.body}</p> : null}
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {active?.items?.length ? (
          active.items.map((product) => (
            <ProductCard
              key={product.id || `${product.brand}-${product.name}`}
              product={product}
              ctaLabel={ctaLabel}
              onCta={onCta}
              isDevPreview={isDevPreview}
            />
          ))
        ) : (
          <p className="rounded-[0.9rem] border border-white/10 bg-white/5 px-3 py-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            {copy.noProducts}
          </p>
        )}
      </div>
    </article>
  );
}

function RoutineGuideCard({ plan, copy }) {
  const guide = plan.routineGuide || {};
  const isHold = plan.planMode === "HOLD";

  return (
    <article className="rounded-[1rem] border border-white/10 bg-white/5 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">ROUTINE GUIDE</p>
      <h4 className="mt-2 text-base font-semibold leading-6 text-zinc-900 dark:text-zinc-100">{copy.routineGuide}</h4>
      <p className="mt-3 whitespace-pre-line text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        {isHold
          ? `이번 기간에는 새 기능성을 추가하지 마세요.\n${guide.order || "편안했던 수분·보습 단계를 중심으로 유지합니다."}\n\n${guide.frequency || "부담 신호가 줄 때까지 기존 편안한 빈도를 유지하세요."}. 같은 날에는 ${guide.avoid || "비슷한 기능성 단계 중첩"}만 피하세요.\n\n${guide.review || "피부가 안정되면 다음 단계 기능성을 다시 검토하세요."}`
          : `${guide.time || "저녁 루틴"}에서 사용하세요.\n${guide.order || "세안 후 수분 단계 다음, 보습제 전에 넣습니다."}\n\n시작 빈도는 ${guide.frequency || "낮은 빈도"}입니다. 같은 날에는 ${guide.avoid || "비슷한 기능성 단계 중첩"}은 피하거나 조절하세요.\n\n${guide.review || "3~4주 후 피부 반응을 보고 재검토하세요."}`}
      </p>
    </article>
  );
}

function RoutineAuditCard({ audit, copy }) {
  const products = audit.selectedProducts?.length
    ? audit.selectedProducts
    : audit.selectedProduct
      ? [audit.selectedProduct]
      : [];

  return (
    <article className="rounded-[1rem] border border-white/10 bg-white/5 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{copy.auditTitle}</p>
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${AUDIT_TONE[audit.status] || AUDIT_TONE.UNKNOWN}`}>
          {audit.status}
        </span>
      </div>
      <h4 className="mt-3 text-base font-semibold leading-6 text-zinc-900 dark:text-zinc-100">{audit.title || copy.auditTitle}</h4>
      <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{audit.message}</p>
      {products.length ? (
        <div className="mt-3 grid gap-2">
          {products.map((product) => (
            <div key={`${product.name}-${product.evidence}`} className="rounded-[0.9rem] border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{product.name}</p>
              <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                {product.category} · {product.evidence}
              </p>
            </div>
          ))}
        </div>
      ) : null}
      {audit.context || audit.replacementContext ? (
        <p className="mt-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{audit.context || audit.replacementContext}</p>
      ) : null}
      <p className="mt-3 rounded-[0.9rem] border border-white/10 bg-white/[0.035] px-3 py-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        {audit.actionMessage}
      </p>
    </article>
  );
}

function SummarySheet({ open, onClose, plan, audit, copy }) {
  if (!open) {
    return null;
  }

  const items = [
    ["이번 주요 고민", plan.primaryConcern],
    ["추천 기능성 방향", plan.direction],
    ["추천 플랜 속도", plan.planMode],
    ["현재 제품 점검 결과", audit.status],
    ["이번 주 루틴 행동", plan.routineGuide?.weeklyAction || plan.baseApproach],
    ["피해야 할 조합", plan.routineGuide?.avoid],
    ["다음 재검토 시점", plan.routineGuide?.review]
  ].filter(([, body]) => body);

  return (
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 bg-black/35 backdrop-blur-[1px]" aria-label={copy.close} onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-h-[78vh] max-w-2xl overflow-y-auto rounded-t-[1.35rem] border border-white/10 bg-[#fffaf6] p-5 shadow-[0_-22px_80px_rgba(35,16,25,0.25)] dark:bg-[#241720]">
        <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-zinc-300 dark:bg-zinc-700" />
        <div className="flex items-start justify-between gap-3">
          <h4 className="text-lg font-semibold leading-7 text-zinc-900 dark:text-zinc-100">{copy.summaryTitle}</h4>
          <button type="button" onClick={onClose} className="ui-button-secondary min-h-9 px-3 text-xs font-semibold">
            {copy.close}
          </button>
        </div>
        <div className="mt-4 grid gap-2">
          {items.map(([label, body]) => (
            <p key={label} className="grid gap-1 rounded-[0.9rem] border border-white/10 bg-white/5 px-3 py-2 text-sm leading-6 sm:grid-cols-[128px_minmax(0,1fr)]">
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">{label}</span>
              <span className="text-zinc-700 dark:text-zinc-300">{body}</span>
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PremiumFunctionalDecisionSection({
  decisions = [],
  freeResult = {},
  report = {},
  locale = "ko",
  enableDevScenarios = false,
  devScenarios = EMPTY_DEV_SCENARIOS
}) {
  const copy = getCopy(locale);
  const [devScenarioId, setDevScenarioId] = useState("");
  const [ctaNotice, setCtaNotice] = useState("");
  const [summaryOpen, setSummaryOpen] = useState(false);
  const canRequestDevScenarios = Boolean(enableDevScenarios && IS_DEVELOPMENT);
  const canUseDevScenarios = Boolean(canRequestDevScenarios && devScenarios.length);
  const activeDevScenario = canRequestDevScenarios
    ? devScenarios.find((scenario) => scenario.id === devScenarioId) || devScenarios[0] || null
    : null;

  useEffect(() => {
    if (!canRequestDevScenarios) {
      setDevScenarioId("");
      return;
    }

    setDevScenarioId((current) => current || devScenarios[0]?.id || "");
  }, [canRequestDevScenarios, devScenarios]);
  const model = useMemo(
    () => buildDisplayModel({ freeResult, report, decisions, devScenario: activeDevScenario }),
    [activeDevScenario, decisions, freeResult, report]
  );
  const plan = model.functionalPlan;
  const audit = model.routineAudit;

  const handleDisplayOnlyCta = () => {
    setCtaNotice(canUseDevScenarios ? copy.ctaNotice : copy.reportCtaNotice);
  };

  return (
    <section className="ui-card p-5 sm:p-6">
      {canUseDevScenarios ? (
        <div className="mb-5 rounded-[1rem] border border-amber-300/40 bg-amber-500/10 p-3">
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">{copy.devBanner}</p>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {devScenarios.map((scenario) => {
              const active = scenario.id === devScenarioId;

              return (
                <button
                  key={scenario.id}
                  type="button"
                  onClick={() => {
                    setDevScenarioId(scenario.id);
                    setCtaNotice("");
                  }}
                  className={`shrink-0 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                    active ? "ui-choice-active" : "border-white/10 bg-white/5 text-zinc-600 dark:text-zinc-300"
                  }`}
                >
                  {scenario.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="min-w-0">
        <p className="ui-kicker">{copy.kicker}</p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="ui-title text-xl leading-tight">{copy.title}</h3>
            <p className="ui-text-secondary mt-2 text-sm leading-6">{copy.body}</p>
          </div>
          <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${PLAN_MODE_TONE[plan.planMode] || PLAN_MODE_TONE.START}`}>
            {PLAN_MODE_LABELS[locale === "en" ? "en" : "ko"][plan.planMode] || plan.planMode}
          </span>
        </div>
      </div>

      <article className="mt-5 rounded-[1.15rem] border border-violet-300/30 bg-violet-500/10 p-4">
        <p className="text-sm font-semibold text-violet-800 dark:text-violet-100">이번에 집중할 피부 고민</p>
        <h4 className="mt-3 text-xl font-semibold leading-8 text-zinc-900 dark:text-zinc-100">{plan.primaryConcern}</h4>
        {plan.secondaryConcern ? (
          <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-300">보조 고민 · {plan.secondaryConcern}</p>
        ) : null}
        <p className="mt-3 whitespace-pre-line text-sm leading-6 text-zinc-700 dark:text-zinc-300">{plan.planSummary}</p>
      </article>

      <div className="mt-4 grid gap-4">
        <article className="rounded-[1rem] border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{copy.solutionTitle}</p>
          <h4 className="mt-2 text-base font-semibold leading-6 text-zinc-900 dark:text-zinc-100">{plan.primaryConcern}</h4>
          <div className="mt-3 space-y-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
            <p><span className="font-semibold text-zinc-900 dark:text-zinc-100">기능성 방향</span><br />{plan.direction}</p>
            <p><span className="font-semibold text-zinc-900 dark:text-zinc-100">이번 우선순위 근거</span><br />{plan.whyPriority}</p>
            <p><span className="font-semibold text-zinc-900 dark:text-zinc-100">기본 접근</span><br />{plan.baseApproach}</p>
          </div>
          {plan.ingredientLabels?.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {plan.ingredientLabels.map((label) => (
                <span key={label} className="rounded-full border border-violet-300/35 bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold text-violet-700 dark:text-violet-200">
                  {label}
                </span>
              ))}
            </div>
          ) : null}
        </article>

        <ProductPicker plan={plan} audit={audit} copy={copy} onCta={handleDisplayOnlyCta} isDevPreview={canUseDevScenarios} />
        {ctaNotice ? (
          <p className="rounded-[0.9rem] border border-violet-300/35 bg-violet-500/10 px-3 py-2 text-xs leading-5 text-violet-800 dark:text-violet-100">
            {ctaNotice}
          </p>
        ) : null}
        <RoutineGuideCard plan={plan} copy={copy} />
        <RoutineAuditCard audit={audit} copy={copy} />

        <button type="button" onClick={() => setSummaryOpen(true)} className="ui-button-secondary min-h-12 w-full justify-center px-4 text-sm font-semibold">
          {copy.summaryButton}
        </button>
      </div>

      <SummarySheet
        open={summaryOpen}
        onClose={() => setSummaryOpen(false)}
        plan={plan}
        audit={audit}
        copy={copy}
      />
    </section>
  );
}
