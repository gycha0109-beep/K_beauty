export const PREMIUM_CONDITION_PROJECTION_VERSION = "premium-condition-projection-v1";

const COPY = {
  ko: {
    redness_irritation: ["붉음·자극 대응", "붉음이나 자극 신호가 있으면 마찰과 열, 선택 기능성부터 줄이세요."],
    dryness_tightness: ["건조·당김 대응", "당김이 있으면 세안 부담을 낮추고 수분·장벽 보완을 유지하세요."],
    oiliness_shift: ["유분 증가 대응", "유분이 늘어난 날에는 보습을 없애기보다 무거운 레이어 수부터 줄이세요."],
    breakout_shift: ["트러블 변화 대응", "트러블 증가가 확인되면 같은 날 기능성 중복과 마찰을 줄이세요."],
    flaking_shift: ["각질 변화 대응", "각질 증가가 확인되면 각질 제거보다 보습과 마찰 감소를 우선하세요."],
    cleansing_burden: ["세안 부담 조정", "세안 횟수·시간·마찰을 낮추되 필요한 저녁 세안은 유지하세요."],
    active_exposure_burden: ["기능성 노출 조정", "기능성 노출이나 중복 부담이 있으면 빈도와 같은 날 중복을 줄이세요."],
    environment_recovery: ["환경 노출 후 회복", "환경 부담이 큰 날에는 루틴을 단순하게 되돌리고 보호 단계는 유지하세요."],
    product_reaction_watch: ["제품 반응 관찰", "최근 제품 변경만으로 원인을 확정하지 말고 반응 신호와 함께 관찰하세요."]
  },
  en: {
    redness_irritation: ["Redness and irritation", "When redness or irritation is present, reduce friction, heat, and optional active steps first."],
    dryness_tightness: ["Dryness and tightness", "Lower cleansing burden while keeping hydration and barrier support steady."],
    oiliness_shift: ["Oiliness increase", "Reduce heavy layers before removing hydration altogether."],
    breakout_shift: ["Breakout change", "When an increase is confirmed, reduce same-day active stacking and friction."],
    flaking_shift: ["Flaking change", "When flaking is confirmed, prioritize hydration and lower friction before exfoliating."],
    cleansing_burden: ["Cleansing burden", "Reduce cleansing frequency, duration, and friction while keeping necessary evening cleansing."],
    active_exposure_burden: ["Active exposure burden", "Reduce active frequency and same-day stacking when exposure burden is present."],
    environment_recovery: ["Environmental recovery", "Return to a simpler routine after heavy exposure while keeping protection."],
    product_reaction_watch: ["Product reaction watch", "Do not assign blame from a recent product change alone; watch for linked reaction evidence."]
  }
};

const REASON_COPY = {
  ko: {
    explicit_redness_or_irritation: "오후 붉음·자극 변화가 명시적으로 확인됐습니다.",
    sensitive_burden_watch: "민감 부담이 있어 급성 변화 여부를 보수적으로 관찰합니다.",
    explicit_dryness_or_tightness: "세안 후 당김 또는 오후 건조 증가가 확인됐습니다.",
    explicit_oiliness_increase: "오후 유분 증가가 확인됐습니다.",
    explicit_breakout_increase: "트러블 증가가 명시적으로 확인됐습니다.",
    explicit_flaking_increase: "각질 증가가 명시적으로 확인됐습니다.",
    cleansing_burden_elevated: "세안 횟수 또는 당김 신호가 세안 부담을 높입니다.",
    active_exposure_present: "현재 루틴에 기능성 노출이 확인됩니다.",
    active_stack_burden: "여러 기능성 축이 같은 시기에 겹칠 수 있습니다.",
    product_evidence_incomplete: "일부 제품 정보가 부족해 특정 제품 중단 판단은 보류합니다.",
    environment_exposure_present: "환경 노출 신호가 설문에 포함되어 있습니다.",
    explicit_product_reaction: "제품과 연결된 반응 신호가 명시적으로 확인됐습니다.",
    recent_product_change_watch: "최근 제품 변경은 관찰 근거지만 원인 확정 근거는 아닙니다."
  },
  en: {
    explicit_redness_or_irritation: "An explicit afternoon redness or irritation change was reported.",
    sensitive_burden_watch: "Sensitive burden supports conservative monitoring rather than assuming an acute reaction.",
    explicit_dryness_or_tightness: "Post-wash tightness or an afternoon dryness increase was reported.",
    explicit_oiliness_increase: "An afternoon oiliness increase was reported.",
    explicit_breakout_increase: "A breakout increase was explicitly reported.",
    explicit_flaking_increase: "A flaking increase was explicitly reported.",
    cleansing_burden_elevated: "Cleansing frequency or tightness raises cleansing burden.",
    active_exposure_present: "Current active-product exposure is present.",
    active_stack_burden: "Several active lanes may overlap in the same period.",
    product_evidence_incomplete: "Product evidence is incomplete, so a product-specific stop decision is deferred.",
    environment_exposure_present: "Environmental exposure was included in the survey context.",
    explicit_product_reaction: "A product-linked reaction signal was explicitly reported.",
    recent_product_change_watch: "A recent product change is a watch signal, not proof of causation."
  }
};

function localeKey(locale) {
  return locale === "en" ? "en" : "ko";
}

function statusFromScenario(item) {
  if (item.responseLevel === "pause_optional") return "avoid_for_now";
  if (item.responseLevel === "reduce") return "reduce";
  return "maintain";
}

function responseKey(conditionKey) {
  const map = {
    redness_irritation: "hydration_barrier",
    dryness_tightness: "hydration_barrier",
    oiliness_shift: "texture_routine",
    breakout_shift: "active_load",
    flaking_shift: "hydration_barrier",
    cleansing_burden: "cleansing_load",
    active_exposure_burden: "active_load",
    environment_recovery: "environment_recovery",
    product_reaction_watch: "product_reaction_watch"
  };
  return map[conditionKey] || conditionKey;
}

function relevance(item) {
  const triggerRank = { active: 30, watch: 20, unknown: 5, inactive: 0 }[item.triggerState] || 0;
  const responseRank = { pause_optional: 20, reduce: 10, maintain: 0 }[item.responseLevel] || 0;
  return triggerRank + responseRank;
}

function actionText(item, locale) {
  const en = locale === "en";
  const parts = [];
  if (item.reduceActions?.length) {
    parts.push(en
      ? `Reduce: ${item.reduceActions.join(", ")}.`
      : `줄이기: ${item.reduceActions.join(", ")}.`);
  }
  if (item.pauseRoles?.length) {
    parts.push(en
      ? `Pause temporarily: ${item.pauseRoles.join(", ")}.`
      : `일시 중단: ${item.pauseRoles.join(", ")}.`);
  }
  if (item.returnCriteria?.length) {
    parts.push(en
      ? `Return when: ${item.returnCriteria.join(", ")}.`
      : `복귀 기준: ${item.returnCriteria.join(", ")}.`);
  }
  return parts.join(" ") || null;
}

function projectScenario(item, locale) {
  const copy = COPY[locale][item.conditionKey] || [item.conditionKey, ""];
  return {
    responseKey: responseKey(item.conditionKey),
    conditionKey: item.conditionKey,
    status: statusFromScenario(item),
    triggerState: item.triggerState,
    title: copy[0],
    summary: copy[1],
    reasons: (item.reasonCodes || []).map((code) => REASON_COPY[locale][code]).filter(Boolean).slice(0, 2),
    action: actionText(item, locale),
    reasonCodes: item.reasonCodes || [],
    evidenceKeys: item.evidenceKeys || [],
    returnCriteria: item.returnCriteria || [],
    escalationCriteria: item.escalationCriteria || [],
    confidence: item.confidence || "low"
  };
}

function mergeLegacyFallback(report, responses, conditionPolicy, allowLegacyFallback) {
  if (!allowLegacyFallback) return responses;
  const legacy = Array.isArray(report?.conditionResponses) ? report.conditionResponses : [];
  if (!legacy.length) return responses;

  if (conditionPolicy?.conditionSignalState?.completeness !== "minimal") {
    return responses;
  }

  const legacySnapshot = legacy
    .filter((item) => item?.responseKey)
    .map((item) => ({ ...item, source: "legacy_snapshot", legacyCarryover: true }));
  const legacyKeys = new Set(legacySnapshot.map((item) => item.responseKey));
  return [...legacySnapshot, ...responses.filter((item) => !legacyKeys.has(item.responseKey))];
}

export function buildPremiumConditionProjection({ report = {}, conditionPolicy, locale = "ko", allowLegacyFallback = true } = {}) {
  const normalizedLocale = localeKey(locale);
  const canonical = (conditionPolicy?.scenarios || [])
    .filter((item) => ["active", "watch"].includes(item.triggerState))
    .sort((left, right) => relevance(right) - relevance(left))
    .map((item) => projectScenario(item, normalizedLocale));
  const fallback = canonical.length
    ? canonical
    : (conditionPolicy?.scenarios || [])
        .filter((item) => item.conditionKey === "active_exposure_burden" || item.conditionKey === "cleansing_burden")
        .map((item) => projectScenario(item, normalizedLocale));
  const responses = mergeLegacyFallback(report, fallback, conditionPolicy, allowLegacyFallback).slice(0, 5);
  const escalation = (conditionPolicy?.scenarios || []).some((item) =>
    item.triggerState === "active" && Array.isArray(item.escalationCriteria) && item.escalationCriteria.length
  );

  return {
    conditionPlan: {
      version: PREMIUM_CONDITION_PROJECTION_VERSION,
      source: "canonical",
      responseMode: conditionPolicy?.responseMode || "steady",
      responses,
      globalNotice: escalation
        ? normalizedLocale === "en"
          ? "If discomfort persists, worsens, or interferes with daily life, consider professional advice."
          : "불편감이 지속되거나 악화되거나 일상에 지장을 주면 전문적인 상담을 고려하세요."
        : null,
      confidence: conditionPolicy?.confidence || "low"
    },
    conditionResponses: responses.map(({ source, legacyCarryover, ...item }) => item)
  };
}
