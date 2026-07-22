const CONDITION_STATUSES = new Set(["maintain", "reduce", "avoid_for_now"]);

const RESPONSE_DEFINITIONS = [
  {
    responseKey: "hydration_barrier",
    axes: ["barrier", "redness", "dehydration", "acne"],
    ko: {
      title: "보습·진정 기본 단계",
      maintain: "피부가 흔들리는 날에도 편안한 보습과 진정 축은 유지하는 편이 좋습니다.",
      reduce: "단계를 늘리기보다 이미 편한 보습 단계만 남겨 루틴 부담을 낮춰 보세요.",
      action: "새 단계를 더하기보다 세안 후 진정·보습 마무리를 먼저 고정하세요."
    },
    en: {
      title: "Hydration and calming base",
      maintain: "On unstable days, comfortable hydration and calming support are worth keeping.",
      reduce: "Rather than adding steps, keep only the moisture layer that already feels comfortable.",
      action: "Keep the post-cleanse moisture finish steady before adding anything new."
    }
  },
  {
    responseKey: "cleansing_load",
    axes: ["barrier", "redness", "dehydration", "acne"],
    ko: {
      title: "세안 강도와 마찰",
      maintain: "세안은 유지하되, 개운함을 위해 강도를 올리는 방향은 피하는 편이 좋습니다.",
      reduce: "당김이나 잦은 세안 신호가 있으면 시간·횟수·마찰을 먼저 줄여보세요.",
      action: "짧게 씻고, 문지르는 동작보다 가볍게 헹구는 쪽으로 조정하세요."
    },
    en: {
      title: "Cleansing load and friction",
      maintain: "Keep cleansing, but avoid making it stronger just to feel more stripped.",
      reduce: "If tightness or frequent cleansing is present, reduce time, frequency, and rubbing first.",
      action: "Cleanse briefly and reduce rubbing before changing other steps."
    }
  },
  {
    responseKey: "active_load",
    axes: ["barrier", "redness", "acne", "uneven_tone", "pores"],
    ko: {
      title: "새 기능성·각질 단계",
      maintain: "기능성 목표는 한 번에 넓히지 않고 현재 루틴 안에서 좁게 보는 편이 좋습니다.",
      reduce: "피부가 예민하게 느껴지면 새 기능성이나 각질 단계 수를 먼저 줄여보세요.",
      avoid: "현재 부담 신호가 겹쳐 있어 새 기능성·각질 확장은 당분간 미루는 편이 안전합니다.",
      action: "컨디션이 며칠 안정된 뒤 한 가지 방향만 다시 확인하세요."
    },
    en: {
      title: "New active or exfoliating steps",
      maintain: "Keep active goals narrow rather than expanding several directions at once.",
      reduce: "When the skin feels reactive, reduce new active or exfoliating steps first.",
      avoid: "Current burden signals overlap, so avoid expanding new active or exfoliating steps for now.",
      action: "Recheck one direction only after the skin has felt stable for a few days."
    }
  },
  {
    responseKey: "sun_protection",
    axes: ["uv", "uneven_tone", "barrier", "redness"],
    ko: {
      title: "자외선 차단 유지",
      maintain: "흔들리는 날에도 아침 보호 단계는 유지하되, 앞단을 가볍게 조정하세요.",
      reduce: "선크림을 줄이기보다 그 앞에 겹치는 보습·베이스 층을 줄여보세요.",
      action: "앞단을 얇게 잡고 선크림을 충분히 바를 수 있는 여지를 남기세요."
    },
    en: {
      title: "Sun protection",
      maintain: "Keep the morning protection step, while making the layers before it lighter.",
      reduce: "Reduce the layers before sunscreen rather than reducing sunscreen itself.",
      action: "Leave enough room to wear sunscreen comfortably."
    }
  },
  {
    responseKey: "texture_routine",
    axes: ["oiliness", "pores", "acne", "uneven_tone"],
    ko: {
      title: "유분·모공·결 관리 강도",
      maintain: "유분·모공 흐름이 우선이면 관리 방향은 유지하되, 과하게 말리는 쪽은 피하세요.",
      reduce: "피부가 흔들리는 날에는 결 관리 강도보다 가벼운 사용감과 단계 수 조절을 먼저 보세요.",
      action: "강한 정리감보다 번들거림과 건조감이 동시에 커지지 않는 균형을 우선하세요."
    },
    en: {
      title: "Sebum, pore, and texture intensity",
      maintain: "If sebum or pores are leading, keep the direction but avoid over-drying.",
      reduce: "On unstable days, adjust texture and step count before increasing intensity.",
      action: "Aim for balance instead of a stronger stripped finish."
    }
  },
  {
    responseKey: "environment_recovery",
    axes: ["dehydration", "redness", "barrier", "uv"],
    ko: {
      title: "환경 노출 뒤 회복",
      maintain: "열·습도·마스크·야외·건조 환경 뒤에는 루틴을 단순하게 되돌리는 기준이 필요합니다.",
      reduce: "환경 부담이 있었던 날은 답답한 레이어와 새 시도를 줄여보세요.",
      action: "그날 밤에는 세안, 편안한 보습, 보호 루틴 회복처럼 단순한 축만 남기세요."
    },
    en: {
      title: "Recovery after environmental exposure",
      maintain: "After heat, humidity, masks, outdoor time, or dry air, keep a simple reset rule.",
      reduce: "On exposure-heavy days, reduce heavy layers and new trials.",
      action: "Keep the evening reset simple: cleanse gently and finish with comfortable moisture."
    }
  }
];

function getLocale(locale) {
  return locale === "en" ? "en" : "ko";
}

function getPriorityAxis(context = {}) {
  return String(
    context.priorityAxis ||
      context.priority?.axis ||
      context.sharedContext?.skinState?.priorityAxis ||
      ""
  ).trim();
}

function getConcernTotal(scoreCard, axis) {
  const value = scoreCard?.[axis]?.total ?? scoreCard?.concernScores?.[axis]?.total;
  const total = Number(value);
  return Number.isFinite(total) ? total : 0;
}

function getSafetyState(context = {}) {
  return context.safetyState || context.sharedContext?.safetyState || null;
}

function getProductExposureState(context = {}) {
  return context.productExposureState || context.sharedContext?.productExposureState || null;
}

function getAnswers(context = {}) {
  return context.answers || context.sharedContext?.survey?.answers || {};
}

function hasSensitiveBurden(context = {}) {
  const safetyState = getSafetyState(context);
  if (typeof safetyState?.sensitiveBurden === "boolean") {
    return safetyState.sensitiveBurden;
  }

  const priorityAxis = getPriorityAxis(context);
  const scoreCard = context.scoreCard || context.scoring || {};
  return ["barrier", "redness", "acne", "dehydration"].includes(priorityAxis) ||
    ["barrier", "redness", "acne"].some((axis) => getConcernTotal(scoreCard, axis) >= 18);
}

function hasActiveBurden(context = {}) {
  const safetyState = getSafetyState(context);
  if (typeof safetyState?.activeBurden === "boolean") {
    return safetyState.activeBurden;
  }

  const exposure = getProductExposureState(context);
  if (exposure) {
    return Boolean(
      exposure.activeExposurePresent ||
      exposure.duplicateActiveAxes?.length ||
      exposure.highCautionExposureCount
    );
  }

  return Array.isArray(context.currentProductVerdicts) &&
    context.currentProductVerdicts.some((item) => item?.status === "hold");
}

function hasEnvironmentBurden(answers = {}) {
  const exposures = Array.isArray(answers.environmentExposure)
    ? answers.environmentExposure.map((item) => String(item || "").trim())
    : [];
  const keys = new Set(["heat", "humidity", "mask", "aircon", "outdoor", "indoor_dry", "dry_air"]);
  return Boolean(answers.outdoorExposure) || exposures.some((item) => keys.has(item));
}

function hasCleansingBurden(answers = {}) {
  return answers.cleansingFrequency === "3_plus" || answers.postWashFeeling === "tight";
}

function decideStatus(responseKey, context = {}) {
  const answers = getAnswers(context);
  const sensitiveBurden = hasSensitiveBurden(context);
  const activeBurden = hasActiveBurden(context);
  const priorityAxis = getPriorityAxis(context);

  if (responseKey === "active_load") {
    return sensitiveBurden && activeBurden
      ? "avoid_for_now"
      : sensitiveBurden
        ? "reduce"
        : "maintain";
  }

  if (responseKey === "cleansing_load") {
    return hasCleansingBurden(answers) ? "reduce" : "maintain";
  }

  if (responseKey === "texture_routine") {
    return ["oiliness", "pores"].includes(priorityAxis) && !sensitiveBurden
      ? "maintain"
      : sensitiveBurden
        ? "reduce"
        : "maintain";
  }

  if (responseKey === "environment_recovery") {
    return hasEnvironmentBurden(answers) ? "reduce" : "maintain";
  }

  return "maintain";
}

function buildReasons(definition, status, context, locale) {
  const en = locale === "en";
  const answers = getAnswers(context);
  const priorityAxis = getPriorityAxis(context);
  const reasons = [];

  if (definition.axes.includes(priorityAxis)) {
    reasons.push(en ? "This response is connected to the current priority." : "현재 우선 피부 축과 연결된 대응입니다.");
  }

  if (definition.responseKey === "cleansing_load" && hasCleansingBurden(answers)) {
    reasons.push(en ? "Tightness or frequent cleansing increases routine burden." : "당김 또는 잦은 세안 신호가 루틴 부담을 높입니다.");
  }

  if (definition.responseKey === "environment_recovery" && hasEnvironmentBurden(answers)) {
    reasons.push(en ? "Environmental exposure was included in the survey context." : "환경 노출 신호가 설문 맥락에 포함되어 있습니다.");
  }

  if (definition.responseKey === "active_load" && status === "avoid_for_now") {
    reasons.push(en ? "Verified current-product exposure overlaps with a sensitive priority." : "확인 가능한 현재 제품 노출과 민감한 우선순위가 겹칩니다.");
  } else if (definition.responseKey === "active_load" && status === "reduce") {
    reasons.push(en ? "The current priority benefits from lowering active-step load first." : "현재 우선순위에서는 기능 단계 부담을 먼저 낮추는 편이 좋습니다.");
  }

  if (!reasons.length) {
    reasons.push(en ? "This keeps the routine easier to adjust on unstable days." : "흔들리는 날 루틴을 조정하기 쉽게 만드는 기준입니다.");
  }

  return reasons.slice(0, 2);
}

function relevance(definition, context) {
  const priorityAxis = getPriorityAxis(context);
  const scoreCard = context.scoreCard || context.scoring || {};
  const direct = definition.axes.includes(priorityAxis) ? 100 : 0;
  return direct + Math.max(...definition.axes.map((axis) => getConcernTotal(scoreCard, axis)), 0);
}

export function buildPremiumConditionResponses(context = {}) {
  const locale = getLocale(context.locale);
  const safetyState = getSafetyState(context);
  const answers = getAnswers(context);
  const safetyNote = safetyState?.level === "stabilize_first" ||
    (answers.sensitivity === "high" && ["redness", "barrier", "acne"].includes(getPriorityAxis(context)))
    ? locale === "en"
      ? "If discomfort lasts or interferes with daily life, consider professional advice."
      : "불편감이 오래 지속되거나 일상에 지장을 줄 정도라면 전문적인 상담을 고려해 보세요."
    : null;

  return RESPONSE_DEFINITIONS
    .map((definition) => {
      const candidate = decideStatus(definition.responseKey, context);
      const status = CONDITION_STATUSES.has(candidate) ? candidate : "maintain";
      const copy = definition[locale] || definition.ko;
      const summary = status === "avoid_for_now"
        ? copy.avoid || copy.reduce || copy.maintain
        : copy[status] || copy.maintain;

      return {
        responseKey: definition.responseKey,
        status,
        title: copy.title,
        summary,
        reasons: buildReasons(definition, status, context, locale),
        action: definition.responseKey === "hydration_barrier" && safetyNote
          ? `${copy.action || ""} ${safetyNote}`.trim()
          : copy.action || null,
        relevance: relevance(definition, context)
      };
    })
    .sort((left, right) => {
      const rank = { avoid_for_now: 0, reduce: 1, maintain: 2 };
      return (rank[left.status] - rank[right.status]) || (right.relevance - left.relevance);
    })
    .slice(0, 5)
    .sort((left, right) => {
      const rank = { maintain: 0, reduce: 1, avoid_for_now: 2 };
      return (rank[left.status] - rank[right.status]) || (right.relevance - left.relevance);
    })
    .map(({ relevance: ignored, ...item }) => item);
}
