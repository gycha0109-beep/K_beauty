export const PREMIUM_ROUTINE_PROJECTION_VERSION = "premium-routine-projection-v1";

const STEP_COPY = {
  ko: {
    "am.cleanse": ["가벼운 세안", "밤사이 올라온 유분과 잔여감만 가볍게 정리합니다."],
    "am.hydration": ["수분 보완", "건조감이 있으면 얇게 깔아 수분을 먼저 보완합니다."],
    "am.sunscreen": ["선케어", "아침 마지막에 충분한 양의 선크림으로 마무리합니다."],
    "pm.cleanse": ["세안", "선크림과 피지, 잔여감을 부드럽게 정리합니다."],
    "pm.treatment": ["기능성 케어", "선택한 날에만 한 가지 기능성 축으로 사용합니다."],
    "pm.moisturizer": ["진정·보습 마무리", "저녁 루틴은 진정과 보습으로 단순하게 마무리합니다."]
  },
  en: {
    "am.cleanse": ["Light cleanse", "Clear only the oil and residue that built up overnight."],
    "am.hydration": ["Hydration support", "Add a thin hydration layer only where the skin feels tight."],
    "am.sunscreen": ["Sun care", "Finish the morning routine with enough sunscreen."],
    "pm.cleanse": ["Cleanse", "Remove sunscreen, sebum, and residue without stripping the skin."],
    "pm.treatment": ["Focused care", "Use one focused active lane only on selected nights."],
    "pm.moisturizer": ["Calming finish", "Finish the evening routine with simple hydration and comfort."]
  }
};

const REASON_COPY = {
  ko: {
    product_evidence_incomplete: "제품 정보가 부족해 강한 판단은 보류합니다.",
    stabilize_first_active_hold: "현재는 피부 안정화가 먼저라 기능성 사용을 잠시 쉽니다.",
    duplicate_or_stack_burden: "같은 기능 축이 겹칠 수 있어 사용 빈도와 같은 날 조합을 줄입니다.",
    no_clear_routine_conflict: "현재 확인 가능한 범위에서는 루틴 역할과 뚜렷한 충돌이 없습니다."
  },
  en: {
    product_evidence_incomplete: "Product evidence is incomplete, so a strong judgment is deferred.",
    stabilize_first_active_hold: "Skin stabilization comes first, so active use is paused for now.",
    duplicate_or_stack_burden: "The same functional lane may overlap, so reduce frequency and same-day stacking.",
    no_clear_routine_conflict: "No clear conflict was found with the current routine role."
  }
};

function localeKey(locale) {
  return locale === "en" ? "en" : "ko";
}

function normalizeVerdictCategory(category) {
  const raw = String(category || "").trim();
  return ["serum", "ampoule", "essence"].includes(raw) ? "treatment" : raw;
}

function verdictSlotKey(mode, slot, category) {
  return [mode, slot, normalizeVerdictCategory(category)].filter(Boolean).join(".");
}

function actionLabel(action, locale) {
  const labels = locale === "en"
    ? { maintain: "Fixed", reduce: "Reduce", hold: "Hold", check_needed: "Check needed" }
    : { maintain: "고정", reduce: "감량", hold: "보류", check_needed: "확인 필요" };
  return labels[action] || labels.maintain;
}

function frequencyText(step, locale) {
  const maximum = Number(step?.frequencyCap?.maximum || 0);
  if (maximum >= 7) return locale === "en" ? "Daily" : "매일";
  if (maximum <= 0) return locale === "en" ? "Pause for now" : "현재는 쉬기";
  return locale === "en" ? `Up to ${maximum} nights a week` : `주 ${maximum}회 이하`;
}

function cautionText(step, locale) {
  const codes = new Set(step?.reasonCodes || []);
  if (codes.has("stabilize_first")) {
    return locale === "en"
      ? "Do not restart until the skin feels stable for several days."
      : "피부가 며칠간 안정적으로 편안해질 때까지 다시 시작하지 마세요.";
  }
  if (codes.has("active_stack_burden")) {
    return locale === "en"
      ? "Do not stack another active product in the same evening."
      : "같은 저녁에 다른 기능성 제품을 추가로 겹치지 마세요.";
  }
  if (codes.has("cleansing_burden_elevated")) {
    return locale === "en"
      ? "Lower cleansing strength or frequency before changing products."
      : "제품을 바꾸기 전에 세안 강도나 횟수부터 낮추세요.";
  }
  if (step?.stepKey === "am.sunscreen") {
    return locale === "en"
      ? "Keep this step even when the rest of the routine is shortened."
      : "다른 단계를 줄여도 이 보호 단계는 유지하세요.";
  }
  return locale === "en"
    ? "Keep the surrounding routine simple until the skin feels steady."
    : "피부가 안정될 때까지 주변 단계는 단순하게 두세요.";
}

function productRole(product = {}) {
  const category = String(product?.category || product?.decision_meta?.slot || "").trim();
  if (category === "cleanser") return "cleanser";
  if (category === "sunscreen") return "sunscreen";
  if (category.startsWith("moisturizer")) return "hydration_base";
  if (["toner_essence", "toner_pad"].includes(category)) return "hydration_base";
  if (["treatment", "serum", "ampoule", "essence"].includes(category)) return "functional_leave_on";
  return "";
}

function unwrap(item) {
  return item?.product || item || null;
}

function productPool(report = {}) {
  const topPick = report?.freeResult?.topPick || report?.topPick || null;
  const supporting = Array.isArray(report?.supportingProducts)
    ? report.supportingProducts.map(unwrap)
    : Array.isArray(report?.premiumReport?.supportingProducts)
      ? report.premiumReport.supportingProducts.map(unwrap)
      : [];
  const alternatives = Array.isArray(report?.freeResult?.altPicks) ? report.freeResult.altPicks : [];
  const seen = new Set();
  return [topPick, ...supporting, ...alternatives]
    .filter((product) => product?.id)
    .filter((product) => {
      const key = String(product.id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function attachProducts(policy, report) {
  const pool = productPool(report);
  const used = { morning: new Set(), evening: new Set() };
  const find = (step, windowKey) => {
    const product = pool.find((item) => {
      const id = String(item.id);
      return !used[windowKey].has(id) && productRole(item) === step.role;
    }) || null;
    if (product?.id) used[windowKey].add(String(product.id));
    return product;
  };
  return {
    morning: policy.windows.morning.steps.map((step) => ({ ...step, product: find(step, "morning") })),
    evening: policy.windows.evening.steps.map((step) => ({ ...step, product: find(step, "evening") }))
  };
}

function displayStep(step, locale) {
  const [title, instruction] = STEP_COPY[locale][step.stepKey] || [step.stepKey, ""];
  const caution = cautionText(step, locale);
  return {
    order: step.order,
    title,
    status: actionLabel(step.action, locale),
    action: instruction,
    productRole: step.role,
    product: step.product || null,
    frequency: frequencyText(step, locale),
    caution,
    adjustment: caution,
    requirement: step.requirement,
    reasonCodes: step.reasonCodes || []
  };
}

function localizeReasons(reasonCodes, locale) {
  return (reasonCodes || []).map((code) => REASON_COPY[locale][code]).filter(Boolean);
}

function currentProductVerdicts(policy, locale) {
  return (policy.productActions || [])
    .filter((item) => item?.slotKey)
    .map((item) => {
      const [mode, slot, category] = String(item.slotKey).split(".");
      const status = item.action === "reduce" ? "adjust" : item.action;
      const titles = locale === "en"
        ? { keep: "OK to keep", adjust: "Adjust use first", hold: "Pause for now", check_needed: "Needs product information" }
        : { keep: "현재 루틴에서 유지 가능", adjust: "사용 방식 먼저 조정", hold: "현재는 잠시 보류", check_needed: "제품 정보 확인 필요" };
      const reasons = localizeReasons(item.reasonCodes, locale);
      return {
        slotKey: verdictSlotKey(mode, slot, category),
        productId: item.productId || null,
        status,
        title: titles[status] || titles.check_needed,
        summary: reasons[0] || (locale === "en" ? "Routine evidence was checked." : "현재 루틴 근거를 확인했습니다."),
        reasons,
        reasonCodes: item.reasonCodes || [],
        adjustment: item.reevaluateWhen?.length
          ? locale === "en" ? "Recheck when the listed condition is met." : "재평가 조건이 충족되면 다시 확인하세요."
          : null,
        reevaluateWhen: item.reevaluateWhen || []
      };
    });
}

function variants(policy, locale) {
  const result = [
    {
      key: "outdoor_day",
      label: locale === "en" ? "Outdoor-heavy day" : "야외 노출이 긴 날",
      items: locale === "en"
        ? ["Keep sunscreen as the fixed morning step.", "Reduce one prep layer if reapplication becomes difficult."]
        : ["선크림은 아침 고정 단계로 유지합니다.", "덧바르기 어렵다면 앞단 보습을 한 단계 줄입니다."]
    },
    {
      key: "makeup_day",
      label: locale === "en" ? "Makeup day" : "메이크업 하는 날",
      items: locale === "en"
        ? ["Keep base layers thin.", "Let sunscreen settle before makeup."]
        : ["베이스 전 스킨케어 층을 얇게 둡니다.", "선크림이 자리 잡은 뒤 메이크업을 올립니다."]
    }
  ];
  if (policy.weeklySchedule.activeDaysMax > 0) {
    result.push({
      key: "active_off_day",
      label: locale === "en" ? "Active off-day" : "기능성 쉬는 날",
      items: locale === "en"
        ? ["Keep only cleansing, hydration, and protection.", "Do not replace the skipped active with another active product."]
        : ["세안·보습·보호만 남깁니다.", "쉰 기능성 대신 다른 기능성 제품을 넣지 않습니다."]
    });
  }
  return result;
}

function avoidCopy(item, locale) {
  const codes = new Set(item?.reasonCodes || []);
  if (codes.has("active_stack_burden")) {
    return locale === "en"
      ? "Do not stack several active-care products in the same evening."
      : "여러 기능성 제품을 같은 저녁에 한꺼번에 겹치지 마세요.";
  }
  if (codes.has("cleansing_burden_elevated")) {
    return locale === "en"
      ? "Do not combine strong cleansing and exfoliation in the same short routine window."
      : "강한 세안과 각질 케어를 같은 짧은 루틴 안에 묶지 마세요.";
  }
  return "";
}

export function buildPremiumRoutineProjection({ report = {}, routinePolicy, locale = "ko" } = {}) {
  const normalizedLocale = localeKey(locale);
  const attached = attachProducts(routinePolicy, report);
  const morningSteps = attached.morning.map((step) => displayStep(step, normalizedLocale));
  const nightSteps = attached.evening.map((step) => displayStep(step, normalizedLocale));
  const routinePlan = {
    version: PREMIUM_ROUTINE_PROJECTION_VERSION,
    modes: routinePolicy.modes,
    morningSteps,
    nightSteps,
    weeklySchedule: routinePolicy.weeklySchedule,
    prohibitedSameWindow: routinePolicy.prohibitedSameWindow,
    introductionOrder: routinePolicy.introductionOrder,
    variants: variants(routinePolicy, normalizedLocale),
    confidence: routinePolicy.confidence,
    reasonCodes: routinePolicy.reasonCodes
  };

  return {
    routinePlan,
    routineStructure: {
      type: "mode_split",
      label: normalizedLocale === "en" ? "AM / PM strategy" : "AM / PM 전략",
      title: normalizedLocale === "en" ? "AM / PM Usage Strategy" : "AM / PM 사용 전략",
      am: { mode: routinePolicy.modes.morning, label: routinePolicy.modes.morning },
      pm: { mode: routinePolicy.modes.evening, label: routinePolicy.modes.evening },
      meta: { primaryAxis: report?.freeResult?.priority?.axis || null }
    },
    fullRoutine: {
      morning: morningSteps.map((step) => step.action),
      night: nightSteps.map((step) => step.action),
      morningSteps,
      nightSteps,
      variants: routinePlan.variants
    },
    currentProductVerdicts: currentProductVerdicts(routinePolicy, normalizedLocale),
    avoidCombinations: routinePolicy.prohibitedSameWindow.map((item) => avoidCopy(item, normalizedLocale)).filter(Boolean)
  };
}
