"use client";

import { useEffect, useMemo, useState } from "react";
import { buildCurrentProductFindings } from "@/lib/current-product-findings";

const IS_DEVELOPMENT = process.env.NODE_ENV === "development";
const EMPTY_DEV_SCENARIOS = [];

const PRIORITY_AXIS_TO_PLAN = {
  barrier: {
    primaryGoal: "barrier_redness",
    functionalDirection: "soothing",
    primaryConcern: "안정화·장벽",
    secondaryConcern: "수분 균형",
    direction: "진정과 장벽 보조 중심"
  },
  redness: {
    primaryGoal: "barrier_redness",
    functionalDirection: "soothing",
    primaryConcern: "안정화·장벽",
    secondaryConcern: "수분 균형",
    direction: "진정과 장벽 보조 중심"
  },
  dehydration: {
    primaryGoal: "dehydration",
    functionalDirection: "hydration",
    primaryConcern: "수분 균형",
    secondaryConcern: "안정화·장벽",
    direction: "수분과 보습 유지 중심"
  },
  oiliness: {
    primaryGoal: "oil_acne",
    functionalDirection: "acne_care",
    primaryConcern: "피지·트러블 케어",
    secondaryConcern: "모공·피부결",
    direction: "피지와 트러블 케어 중심"
  },
  acne: {
    primaryGoal: "oil_acne",
    functionalDirection: "acne_care",
    primaryConcern: "피지·트러블 케어",
    secondaryConcern: "모공·피부결",
    direction: "피지와 트러블 케어 중심"
  },
  pores: {
    primaryGoal: "pores_texture",
    functionalDirection: "exfoliation",
    primaryConcern: "모공·피부결",
    secondaryConcern: "유분 밸런스",
    direction: "피지·각질 정체를 한 가지 기능성 축으로 정리"
  },
  uneven_tone: {
    primaryGoal: "uneven_tone",
    functionalDirection: "tone_care",
    primaryConcern: "톤 균일",
    secondaryConcern: "수분 균형",
    direction: "톤 케어 중심"
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

const AXIS_LABELS = {
  ko: {
    hydration: "보습 관련 성분 목적 신호",
    moisture_lock: "수분 유지 관련 성분 목적 신호",
    barrier_support: "장벽 보조 관련 성분 목적 신호",
    soothing: "진정 관련 성분 목적 신호",
    exfoliation: "각질 케어 관련 성분 목적 신호",
    tone_care: "톤 케어 관련 성분 목적 신호",
    acne_care: "트러블 케어 관련 성분 목적 신호",
    sunscreen_protection: "자외선 차단 관련 구조화 신호",
    wrinkle_care: "탄력 케어 관련 성분 목적 신호"
  },
  en: {
    hydration: "hydration-related ingredient-purpose signal",
    moisture_lock: "moisture-locking ingredient-purpose signal",
    barrier_support: "barrier-support ingredient-purpose signal",
    soothing: "soothing ingredient-purpose signal",
    exfoliation: "exfoliation-related ingredient-purpose signal",
    tone_care: "tone-care ingredient-purpose signal",
    acne_care: "blemish-care ingredient-purpose signal",
    sunscreen_protection: "sun-protection structured signal",
    wrinkle_care: "resilience-care ingredient-purpose signal"
  }
};

const RELATION_LABELS = {
  ko: {
    supports_goal: "이번 방향과 연결되는 제품",
    different_goal: "이번 핵심 방향과는 직접 연결되지 않음",
    duplicate_axis: "같은 방향 제품이 여러 개 확인됨",
    not_evaluable: "기능성 점검 어려움",
    empty_slot: "현재 사용하지 않는 카테고리",
    unknown_usage: "사용 여부 미확인"
  },
  en: {
    supports_goal: "Connected to this direction",
    different_goal: "Not directly connected to this main direction",
    duplicate_axis: "Multiple products share this direction",
    not_evaluable: "Functional check unavailable",
    empty_slot: "Category marked as not used",
    unknown_usage: "Usage not answered"
  }
};

const COPY = {
  ko: {
    kicker: "FUNCTIONAL PLAN",
    title: "기능성 플랜",
    body: "지금 피부 상태와 확인 가능한 제품 정보를 바탕으로, 무엇을 더하고 무엇의 속도를 늦출지 정리합니다.",
    devBanner: "개발용 기능성 플랜 시나리오 — 저장되지 않음",
    primaryTab: "주요 고민 추천",
    secondaryTab: "보조 고민 솔루션",
    budgetTab: "예산별 대안",
    productSection: "내게 맞는 제품 고르기",
    productNotice: "개발용 fixture 또는 현재 리포트 후보만 화면 확인용으로 표시합니다. 저장·구매·DB 변경과 연결되지 않습니다.",
    reportProductNotice: "현재 리포트에서 확인 가능한 후보만 표시합니다. 현재 제품 목록이나 저장된 리포트에 바로 반영되지 않습니다.",
    solutionTitle: "주요 고민 솔루션",
    routineGuide: "내 루틴에 넣기",
    auditTitle: "이미 사용 중인 기능성 점검",
    summaryButton: "이번 기능성 플랜 요약 보기",
    summaryTitle: "이번 기능성 플랜 요약",
    close: "닫기",
    noProducts: "현재 조건에 맞는 확인 제품을 더 준비하고 있습니다. 지금은 현재 루틴의 사용감과 피부 반응을 먼저 확인하세요.",
    ctaNotice: "이 버튼은 화면 확인용입니다. 현재 제품 목록, 저장된 리포트, DB에는 반영되지 않습니다.",
    reportCtaNotice: "현재 제품 목록에는 아직 저장되지 않습니다. 다음 루틴 설정에서 추가할 수 있습니다.",
    previous: "이전",
    next: "컨디션 대응 보기"
  },
  en: {
    kicker: "FUNCTIONAL PLAN",
    title: "Functional plan",
    body: "Based on the current skin state and verifiable product information, this organizes what to add and what to slow down.",
    devBanner: "Development functional-plan scenario — not saved",
    primaryTab: "Main concern",
    secondaryTab: "Support concern",
    budgetTab: "Budget alternatives",
    productSection: "Choose a fitting product",
    productNotice: "Development fixtures or current report candidates are shown for UI preview only. They do not save, purchase, or update DB data.",
    reportProductNotice: "Only candidates available in the current report are shown. This does not directly update current products or the saved report.",
    solutionTitle: "Main concern solution",
    routineGuide: "Place it in my routine",
    auditTitle: "Current active check",
    summaryButton: "View this functional plan summary",
    summaryTitle: "Functional plan summary",
    close: "Close",
    noProducts: "We are still preparing verified products for this condition. For now, watch current routine feel and skin response first.",
    ctaNotice: "This button is for preview only. It does not update current products, saved reports, or DB data.",
    reportCtaNotice: "This is not saved to current products yet. You can add it in the next routine setup.",
    previous: "Previous",
    next: "Open condition response"
  }
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

function getCopy(locale) {
  return COPY[locale === "en" ? "en" : "ko"];
}

function normalizeText(value) {
  return String(value || "").trim();
}

function getPriorityAxis(freeResult = {}) {
  return (
    freeResult?.priority?.axis ||
    freeResult?.priority?.concern ||
    freeResult?.mainConcern ||
    "pores"
  );
}

function getCategoryLabel(category) {
  return CATEGORY_LABELS[normalizeText(category)] || CATEGORY_LABELS[normalizeText(category).toLowerCase()] || "제품";
}

function getSelections(currentProducts) {
  if (Array.isArray(currentProducts)) return currentProducts;
  if (Array.isArray(currentProducts?.selections)) return currentProducts.selections;
  return [];
}

function compactList(items = [], limit = 8) {
  return (Array.isArray(items) ? items : []).filter(Boolean).slice(0, limit);
}

function collectReportProducts({ freeResult = {}, report = {} }) {
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
      const key = product.id || `${product.brand || ""}-${product.name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function inferPlanMode({ freeResult = {}, decisions = [] }) {
  const explicit = decisions.find((decision) => decision?.planMode || decision?.mode)?.planMode ||
    decisions.find((decision) => decision?.planMode || decision?.mode)?.mode;
  if (explicit) return String(explicit).toUpperCase();

  const sensitivity = Number(freeResult?.sensitivityScore || freeResult?.scores?.sensitivity || 0);
  const redness = Number(freeResult?.scoring?.concernScores?.redness || 0);
  const barrier = Number(freeResult?.scoring?.concernScores?.barrier || 0);
  if (sensitivity >= 75 && (redness >= 70 || barrier >= 70)) return "HOLD";
  return "START";
}

function buildActualFunctionalPlan({ freeResult = {}, report = {}, decisions = [] }) {
  const priorityAxis = getPriorityAxis(freeResult);
  const base = PRIORITY_AXIS_TO_PLAN[priorityAxis] || PRIORITY_AXIS_TO_PLAN.pores;
  const planMode = inferPlanMode({ freeResult, decisions });
  const products = collectReportProducts({ freeResult, report }).slice(0, 3);

  return {
    ...base,
    planMode,
    planSummary:
      planMode === "HOLD"
        ? "이번 기간에는 새 기능성을 추가하기보다 피부가 편안하게 유지되는 기반을 먼저 확인하세요."
        : `${base.primaryConcern}을 먼저 잡고, ${base.direction} 방향을 낮은 빈도로 확인하세요.`,
    whyPriority: "무료 설문 결과의 우선 신호를 기준으로 이번 기능성 방향을 정했습니다.",
    baseApproach: planMode === "HOLD"
      ? "현재 루틴에서 편안했던 수분·보습 축을 유지하고 기능성 추가는 보류합니다."
      : "피부가 안정적인 날 저녁 루틴에서 한 가지 기능성만 분리해 확인합니다.",
    ingredientLabels: [],
    productCandidates: products,
    secondarySolution: { title: base.secondaryConcern, direction: "주요 고민을 방해하지 않는 선에서 보조 고민을 관리합니다.", products: [] },
    budgetAlternatives: [],
    routineGuide: {
      time: planMode === "HOLD" ? "이번 기간" : "저녁 루틴",
      order: planMode === "HOLD" ? "새 기능성 추가 없이 편안했던 수분·보습 단계를 중심으로 유지" : "세안 → 수분 토너 → 기능성 세럼 → 보습제",
      frequency: planMode === "HOLD" ? "불편 신호가 줄 때까지 기존 편안한 빈도 유지" : "처음 2주는 주 2회",
      avoid: "각질 패드, 스크럽, 다른 결 개선 기능성 중첩",
      review: "3~4주 후 피부 반응을 보고 조정 검토",
      weeklyAction: planMode === "HOLD" ? "새 제품을 추가하지 않고 안정화 여부를 먼저 확인하세요." : "한 가지 기능성만 낮은 빈도로 확인하세요."
    }
  };
}

function axisToText(axis, locale = "ko") {
  const labels = AXIS_LABELS[locale === "en" ? "en" : "ko"];
  return labels[axis] || (locale === "en" ? "structured functional signal" : "구조화된 기능성 신호");
}

function getFindingProductName(finding, locale = "ko") {
  if (finding?.productName) return finding.productName;
  if (finding?.sourceState === "not_in_db") return locale === "en" ? "Unregistered current product" : "DB에 없는 사용 중 제품";
  return getCategoryLabel(finding?.category);
}

function getFindingEvidenceText(finding, locale = "ko") {
  const isEnglish = locale === "en";
  const matchedAxes = Array.isArray(finding?.matchedAxes) ? finding.matchedAxes : [];

  if (finding?.relationToPlan === "supports_goal") {
    const axisText = matchedAxes.map((axis) => axisToText(axis, locale)).join(", ");
    return isEnglish
      ? `Verifiable ${axisText || "functional"} evidence is connected to this direction.`
      : `${axisText || "확인 가능한 기능성 신호"}가 이번 방향과 연결됩니다.`;
  }
  if (finding?.relationToPlan === "duplicate_axis") {
    const axisText = matchedAxes.map((axis) => axisToText(axis, locale)).join(", ");
    return isEnglish
      ? `More than one selected product shares ${axisText || "the same direction"}; check frequency and pairing together.`
      : `같은 방향의 ${axisText || "기능성 신호"}가 여러 제품에서 확인되어, 함께 사용할 때는 빈도와 조합을 점검하는 편이 좋습니다.`;
  }
  if (finding?.relationToPlan === "different_goal") {
    if (finding?.profile?.cautionTags?.includes("rinse_off_limit")) {
      return isEnglish
        ? "It has some ingredient-purpose signals, but as a rinse-off cleanser it is not treated like a core leave-on functional product."
        : "성분 목적 신호는 있으나, 씻어내는 세안 제품 특성상 이번 방향의 핵심 기능성 제품으로 보지는 않습니다.";
    }
    return isEnglish
      ? "This product can support another routine role, but it is not treated as the core product for this functional direction."
      : "현재 제품의 역할은 인정하되, 이번 기능성 방향의 핵심 제품으로는 보지 않습니다.";
  }
  if (finding?.relationToPlan === "empty_slot") {
    return isEnglish ? "This category is currently marked as not used." : "현재 이 카테고리는 사용하지 않는 것으로 확인되었습니다.";
  }
  if (finding?.relationToPlan === "unknown_usage") {
    return isEnglish ? "Usage for this category was not confirmed." : "이 카테고리의 사용 여부를 확인하지 못했습니다.";
  }
  if (finding?.sourceState === "not_in_db") {
    return isEnglish
      ? "The product is in use, but it is not in the current product data, so functionality was not inferred."
      : "사용 중인 제품이지만 현재 제품 데이터에 없어 기능성 점검은 진행하지 않았습니다.";
  }
  return isEnglish
    ? "Saved product information is not enough to verify its connection to this functional direction."
    : "저장된 제품 정보만으로는 이번 기능성 방향과의 연결을 충분히 확인하기 어렵습니다.";
}

function getFindingCautionText(finding, locale = "ko") {
  const tags = finding?.profile?.cautionTags || [];
  const isEnglish = locale === "en";

  if (tags.includes("rinse_off_limit")) {
    return isEnglish
      ? "Rinse-off products are reviewed more conservatively than leave-on functional steps."
      : "씻어내는 제품은 바르는 기능성 단계와 같은 기준으로 판단하지 않았습니다.";
  }
  if (tags.includes("exfoliation_overlap_watch")) {
    return isEnglish
      ? "When pairing with similar exfoliation steps, review frequency first."
      : "비슷한 각질 케어 단계와 함께 쓸 때는 사용 빈도를 먼저 점검하세요.";
  }
  if (tags.includes("sunscreen_metadata_incomplete")) {
    return isEnglish
      ? "Sun-protection metadata is not complete enough for a stronger judgment."
      : "자외선 차단 관련 구조화 정보가 충분하지 않아 강하게 판단하지 않았습니다.";
  }
  if (tags.includes("irritation_risk_watch") || tags.includes("sensitive_use_watch")) {
    return isEnglish
      ? "Existing structured caution fields suggest using this conservatively."
      : "기존 구조화 주의 정보가 있어 보수적으로 확인했습니다.";
  }
  return "";
}

function getFindingItems(findings = [], locale = "ko") {
  const relationLabels = RELATION_LABELS[locale === "en" ? "en" : "ko"];
  return findings.map((finding, index) => ({
    key: `${finding.sourceState}-${finding.category}-${finding.productId || index}`,
    title: getFindingProductName(finding, locale),
    category: getCategoryLabel(finding.category),
    relationLabel: relationLabels[finding.relationToPlan] || relationLabels.not_evaluable,
    evidence: getFindingEvidenceText(finding, locale),
    caution: getFindingCautionText(finding, locale)
  }));
}

function buildRoutineAuditFromFindings({ findingsResult, selections = [], locale = "ko" }) {
  const findings = Array.isArray(findingsResult?.findings) ? findingsResult.findings : [];
  const summary = findingsResult?.summary || {};
  const isEnglish = locale === "en";

  if (!selections.length) {
    return {
      status: "NO_ROUTINE_DATA",
      title: isEnglish ? "Current product check" : "현재 제품 점검",
      findings: [],
      hasNotInDb: false,
      message: isEnglish
        ? "You continued without selecting products, so routine fit and overlap were not checked."
        : "제품 선택 없이 계속해 현재 루틴의 적합도와 중복 여부는 점검하지 않았습니다.",
      actionMessage: isEnglish ? "Review the functional plan from skin-state guidance only." : "추천 플랜은 피부 상태 기준으로만 확인하세요."
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
      hasNotInDb,
      message: isEnglish
        ? "Multiple selected products show the same functional direction, so frequency and pairing are worth checking together."
        : "같은 방향의 제품이 여러 개 확인되어, 함께 사용할 때는 빈도와 조합을 점검하는 편이 좋습니다.",
      actionMessage: isEnglish
        ? "This does not mean stopping one now; use it as a prompt to keep the routine simpler."
        : "당장 중단하라는 뜻이 아니라, 이번 기간에는 루틴을 단순하게 유지하기 위한 점검 신호로 보세요."
    };
  }

  if (hasSupport) {
    return {
      status: "OPTIMIZE",
      title: isEnglish ? "A current product connects to this direction" : "현재 제품과 연결되는 신호가 있습니다",
      findings,
      hasNotInDb,
      message: isEnglish
        ? "A selected product has verifiable ingredient-purpose signals connected to this functional direction."
        : "선택한 제품 중 이번 기능성 방향과 연결되는 성분 목적 신호가 확인됩니다.",
      actionMessage: isEnglish
        ? "Rather than adding more immediately, first review frequency and same-day pairing."
        : "바로 새 제품을 늘리기보다, 먼저 현재 제품의 사용 빈도와 같은 날 조합을 확인하세요."
    };
  }

  if (hasSelected) {
    return {
      status: "MISMATCH",
      title: isEnglish ? "Current products were checked conservatively" : "현재 제품을 보수적으로 확인했습니다",
      findings,
      hasNotInDb,
      message: isEnglish
        ? "Some selected products can have routine value, but they are not treated as the core product for this functional direction."
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
    hasNotInDb,
    message: isEnglish
      ? "Current product input was reviewed only where structured product data was available."
      : "구조화된 제품 정보가 있는 범위에서만 현재 제품을 점검했습니다.",
    actionMessage: hasNotInDb || summary.notInDbCount
      ? (isEnglish ? "Unregistered products were not inferred from product or brand names." : "DB에 없는 제품은 제품명이나 브랜드명으로 기능성을 추정하지 않았습니다.")
      : (isEnglish ? "Use this as routine context, not as a stop-or-replace instruction." : "이 결과는 중단이나 교체 지시가 아니라 현재 루틴을 확인하기 위한 정보입니다.")
  };
}

function buildActualRoutineAudit({ report = {}, functionalPlan, locale = "ko" }) {
  const selections = getSelections(report?.currentProducts);
  const findingsResult = selections.length
    ? buildCurrentProductFindings({
        currentProducts: report?.currentProducts,
        primaryGoal: functionalPlan?.primaryGoal,
        functionalDirection: functionalPlan?.functionalDirection
      })
    : { findings: [], summary: {} };

  return buildRoutineAuditFromFindings({ findingsResult, selections, locale });
}

function buildDisplayModel({ freeResult, report, decisions, devScenario, locale }) {
  if (devScenario) {
    if (devScenario.currentProducts) {
      const findingsResult = buildCurrentProductFindings({
        currentProducts: devScenario.currentProducts,
        primaryGoal: devScenario.functionalPlan?.primaryGoal,
        functionalDirection: devScenario.functionalPlan?.functionalDirection
      });
      return {
        ...devScenario,
        routineAudit: buildRoutineAuditFromFindings({
          findingsResult,
          selections: getSelections(devScenario.currentProducts),
          locale
        })
      };
    }
    return devScenario;
  }

  const functionalPlan = buildActualFunctionalPlan({ freeResult, report, decisions });
  return {
    id: "actual-report",
    label: locale === "en" ? "Actual report" : "실제 리포트",
    functionalPlan,
    routineAudit: buildActualRoutineAudit({ report, functionalPlan, locale })
  };
}

function getProductCta(planMode, auditStatus, locale = "ko") {
  const isEnglish = locale === "en";
  if (planMode === "HOLD") return isEnglish ? "Review after skin is steady" : "피부 안정 후 검토하기";
  if (auditStatus === "OPTIMIZE") return isEnglish ? "View as next purchase candidate" : "다음 구매 후보로 보기";
  if (auditStatus === "MISMATCH") return isEnglish ? "View main concern support candidate" : "주요 고민 보완 후보로 보기";
  if (auditStatus === "REPLACE_CANDIDATE" || auditStatus === "CONSOLIDATE") return isEnglish ? "Compare as an alternative" : "대체 후보로 비교하기";
  return isEnglish ? "View as routine add candidate" : "루틴에 추가 후보로 보기";
}

function formatPrice(product) {
  if (product?.priceLabel) return product.priceLabel;
  if (product?.price_min || product?.price_max) {
    const min = product.price_min ? `${Number(product.price_min).toLocaleString()}원` : "";
    const max = product.price_max ? `${Number(product.price_max).toLocaleString()}원` : "";
    return [min, max].filter(Boolean).join("~");
  }
  return "가격 정보 확인 중";
}

function ProductCard({ product, ctaLabel, onCta, isDevPreview }) {
  return (
    <article className="rounded-[1rem] border border-white/10 bg-white/5 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-16 w-14 shrink-0 items-center justify-center rounded-[0.95rem] border border-white/10 bg-white/5 text-[10px] text-zinc-400">
          {isDevPreview ? "DEV" : "제품"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-1.5">
            {product.position ? <span className="ui-chip-compact px-2.5 py-1">{product.position}</span> : null}
            <span className="ui-chip-compact px-2.5 py-1">{getCategoryLabel(product.category)}</span>
          </div>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{product.brand}</p>
          <h5 className="mt-1 break-words text-sm font-semibold leading-5 text-zinc-900 dark:text-zinc-100">{product.name}</h5>
          <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{formatPrice(product)}</p>
        </div>
      </div>
      {product.reason ? <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{product.reason}</p> : null}
      {product.ingredientLabels?.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {product.ingredientLabels.map((label) => (
            <span key={label} className="rounded-full border border-violet-300/30 bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold text-violet-700 dark:text-violet-200">
              {label}
            </span>
          ))}
        </div>
      ) : null}
      <button type="button" onClick={onCta} className="ui-button-secondary mt-4 min-h-10 w-full justify-center px-3 text-xs font-semibold">
        {ctaLabel}
      </button>
    </article>
  );
}

function ProductOptions({ plan, audit, copy, isDevPreview, onCta, locale }) {
  const [tab, setTab] = useState("primary");
  const tabs = [
    ["primary", copy.primaryTab],
    ["secondary", copy.secondaryTab],
    ["budget", copy.budgetTab]
  ];
  const products =
    tab === "secondary"
      ? compactList(plan.secondarySolution?.products, 3)
      : tab === "budget"
        ? compactList(plan.budgetAlternatives, 3)
        : compactList(plan.productCandidates, 3);
  const ctaLabel = getProductCta(plan.planMode, audit.status, locale);

  return (
    <article className="rounded-[1rem] border border-white/10 bg-white/5 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">PRODUCT OPTIONS</p>
      <h4 className="mt-2 text-base font-semibold leading-6 text-zinc-900 dark:text-zinc-100">{copy.productSection}</h4>
      <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{isDevPreview ? copy.productNotice : copy.reportProductNotice}</p>
      <div className="mt-4 flex gap-1 overflow-x-auto rounded-full border border-white/10 bg-white/5 p-1">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold ${tab === key ? "bg-rose-500 text-white shadow-sm" : "text-zinc-600 dark:text-zinc-300"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mt-4 grid gap-3">
        {products.length
          ? products.map((product, index) => (
              <ProductCard
                key={product.id || `${product.brand}-${product.name}-${index}`}
                product={product}
                ctaLabel={ctaLabel}
                onCta={onCta}
                isDevPreview={isDevPreview}
              />
            ))
          : <p className="rounded-[0.9rem] border border-white/10 bg-white/[0.035] p-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{copy.noProducts}</p>}
      </div>
    </article>
  );
}

function SolutionCard({ plan, copy }) {
  return (
    <article className="rounded-[1rem] border border-white/10 bg-white/5 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{copy.solutionTitle}</p>
      <h4 className="mt-2 text-lg font-semibold leading-7 text-zinc-900 dark:text-zinc-100">{plan.primaryConcern}</h4>
      <div className="mt-4 space-y-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        <p><span className="font-semibold text-zinc-900 dark:text-zinc-100">기능성 방향</span><br />{plan.direction}</p>
        <p><span className="font-semibold text-zinc-900 dark:text-zinc-100">이번 우선순위 근거</span><br />{plan.whyPriority}</p>
        <p><span className="font-semibold text-zinc-900 dark:text-zinc-100">기본 접근</span><br />{plan.baseApproach}</p>
      </div>
      {plan.ingredientLabels?.length ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {plan.ingredientLabels.map((label) => (
            <span key={label} className="rounded-full bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold text-violet-700 dark:text-violet-200">{label}</span>
          ))}
        </div>
      ) : null}
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
          ? `이번 기간에는 새 기능성을 추가하지 마세요.\n${guide.order}\n\n${guide.frequency}. 같은 날에는 ${guide.avoid}은 피하거나 조절하세요.\n\n${guide.review}`
          : `${guide.time}에서 사용하세요.\n${guide.order}\n\n시작 빈도는 ${guide.frequency}입니다. 같은 날에는 ${guide.avoid}은 피하거나 조절하세요.\n\n${guide.review}`}
      </p>
    </article>
  );
}

function RoutineAuditCard({ audit, copy, locale = "ko" }) {
  const findingItems = getFindingItems(audit.findings || [], locale);

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
      {findingItems.length ? (
        <div className="mt-3 grid gap-2">
          {findingItems.map((item) => (
            <div key={item.key} className="rounded-[0.9rem] border border-white/10 bg-white/5 px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="min-w-0 flex-1 break-words text-sm font-semibold text-zinc-900 dark:text-zinc-100">{item.title}</p>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">
                  {item.category}
                </span>
              </div>
              <p className="mt-2 text-xs font-semibold text-violet-700 dark:text-violet-200">{item.relationLabel}</p>
              <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{item.evidence}</p>
              {item.caution ? <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{item.caution}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
      <p className="mt-3 rounded-[0.9rem] border border-white/10 bg-white/[0.035] px-3 py-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        {audit.actionMessage}
      </p>
    </article>
  );
}

function SummarySheet({ open, onClose, plan, audit, copy }) {
  if (!open) return null;

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
          <button type="button" onClick={onClose} className="ui-button-secondary min-h-9 px-3 text-xs font-semibold">{copy.close}</button>
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
  devScenarios = EMPTY_DEV_SCENARIOS,
  onNavigate
}) {
  const copy = getCopy(locale);
  const [devScenarioId, setDevScenarioId] = useState("");
  const [ctaNotice, setCtaNotice] = useState("");
  const [summaryOpen, setSummaryOpen] = useState(false);
  const canRequestDevScenarios = Boolean(enableDevScenarios && IS_DEVELOPMENT);
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
    () => buildDisplayModel({ freeResult, report, decisions, devScenario: activeDevScenario, locale }),
    [activeDevScenario, decisions, freeResult, locale, report]
  );
  const plan = model.functionalPlan;
  const audit = model.routineAudit;
  const isDevPreview = Boolean(activeDevScenario);
  const ctaCopy = isDevPreview ? copy.ctaNotice : copy.reportCtaNotice;

  return (
    <section className="space-y-4">
      {canRequestDevScenarios && devScenarios.length ? (
        <div className="rounded-[1rem] border border-amber-300/50 bg-amber-50/70 p-3 text-amber-900 dark:bg-amber-950/25 dark:text-amber-100">
          <p className="text-xs font-semibold">{copy.devBanner}</p>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {devScenarios.map((scenario) => (
              <button
                key={scenario.id}
                type="button"
                onClick={() => setDevScenarioId(scenario.id)}
                className={`shrink-0 rounded-full border px-3 py-2 text-xs font-semibold ${scenario.id === model.id ? "border-rose-400 bg-rose-500 text-white" : "border-amber-200 bg-white/70 text-amber-900"}`}
              >
                {scenario.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <article className="rounded-[1rem] border border-white/10 bg-white/5 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{copy.kicker}</p>
        <h3 className="mt-2 text-2xl font-semibold leading-8 text-zinc-900 dark:text-zinc-100">{copy.title}</h3>
        <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{copy.body}</p>
        <div className="mt-4 inline-flex rounded-full border border-violet-300/40 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-700 dark:text-violet-200">
          {plan.planMode}
        </div>
        <div className="mt-4 rounded-[1rem] bg-violet-500/10 p-4">
          <p className="text-xs font-semibold text-violet-700 dark:text-violet-200">{locale === "en" ? "Focus this time" : "이번에 집중할 피부 고민"}</p>
          <h4 className="mt-2 text-xl font-semibold text-zinc-900 dark:text-zinc-100">{plan.primaryConcern}</h4>
          {plan.secondaryConcern ? <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">보조 고민 · {plan.secondaryConcern}</p> : null}
          <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{plan.planSummary}</p>
        </div>
      </article>

      <SolutionCard plan={plan} copy={copy} />
      <ProductOptions
        plan={plan}
        audit={audit}
        copy={copy}
        isDevPreview={isDevPreview}
        locale={locale}
        onCta={() => setCtaNotice(ctaCopy)}
      />
      {ctaNotice ? <p className="rounded-[0.9rem] border border-violet-300/25 bg-violet-500/10 px-3 py-2 text-xs leading-5 text-violet-700 dark:text-violet-200">{ctaNotice}</p> : null}
      <RoutineGuideCard plan={plan} copy={copy} />
      <RoutineAuditCard audit={audit} copy={copy} locale={locale} />

      <button type="button" onClick={() => setSummaryOpen(true)} className="ui-button-secondary min-h-12 w-full justify-center px-4 text-sm font-semibold">
        {copy.summaryButton}
      </button>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="ui-button-secondary min-h-11 justify-center text-sm font-semibold" onClick={() => onNavigate?.("routine")}>
          {copy.previous}
        </button>
        <button type="button" className="ui-button-primary min-h-11 justify-center text-sm font-semibold" onClick={() => onNavigate?.("condition")}>
          {copy.next}
        </button>
      </div>

      <SummarySheet open={summaryOpen} onClose={() => setSummaryOpen(false)} plan={plan} audit={audit} copy={copy} />
    </section>
  );
}
