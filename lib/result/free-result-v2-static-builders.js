import { getRoutineStructureData } from "@/lib/routine-structure";

export function buildFinalReportPreviewSections(locale = "ko") {
  const isEnglish = locale === "en";

  if (isEnglish) {
    return [
      {
        key: "routine_execution",
        title: "Morning · night execution routine",
        body: "We organize which product to use, in what order, and at which step."
      },
      {
        key: "situation_routines",
        title: "Situation-based routine changes",
        body: "We adjust the routine for sensitive days, breakout days, outdoor-heavy days, and makeup days."
      },
      {
        key: "avoid_combinations",
        title: "Avoid combinations",
        body: "We point out pairings that can increase irritation or make the routine feel too heavy."
      },
      {
        key: "alternative_strategy",
        title: "Alternative product strategy",
        body: "We explain when and how to switch products instead of relying only on the Top Pick."
      },
      {
        key: "face_lab_expanded",
        title: "Face Lab expanded guide",
        body: "We organize hair direction, avoid styles, and mood keywords that fit your face shape."
      }
    ];
  }

  return [
    {
      key: "routine_execution",
      title: "아침·저녁 실행 루틴",
      body: "제품을 어느 순서로, 어느 단계에서 쓰면 되는지 정리합니다."
    },
    {
      key: "situation_routines",
      title: "상황별 루틴 변형",
      body: "민감한 날, 트러블 올라온 날, 야외활동 많은 날, 메이크업하는 날 기준으로 루틴을 바꿔줍니다."
    },
    {
      key: "avoid_combinations",
      title: "피해야 할 조합",
      body: "같이 쓰면 자극이 커지거나 루틴이 무거워지는 조합을 알려줍니다."
    },
    {
      key: "alternative_strategy",
      title: "대체 제품 사용 전략",
      body: "Top Pick 대신 어떤 제품을 언제 바꿔 쓰면 좋은지 정리합니다."
    },
    {
      key: "face_lab_expanded",
      title: "Face Lab 확장 가이드",
      body: "얼굴형에 맞는 헤어 방향, 피해야 할 스타일, 분위기 키워드를 정리합니다."
    }
  ];
}

function buildLegacyFreeResultV2RoutinePreview(locale = "ko") {
  if (locale === "en") {
    return {
      morning: "Light reset → moisture hold → UV protection",
      night: "Gentle cleanse → moisture refill → barrier comfort",
      morningSteps: ["Light reset", "Moisture hold", "UV protection"],
      nightSteps: ["Gentle cleanse", "Moisture refill", "Barrier comfort"],
      morningNote: "A light flow that keeps the skin from feeling heavy.",
      nightNote: "A gentle flow that clears residue and supports comfort.",
      gateNote: "Detailed product order and usage frequency are available in the full report."
    };
  }

  return {
    morning: "가볍게 정돈 → 수분 유지 → 자외선 차단",
    night: "순한 세안 → 수분 보충 → 장벽 안정",
    morningSteps: ["가볍게 정돈", "수분 유지", "자외선 차단"],
    nightSteps: ["순한 세안", "수분 보충", "장벽 안정"],
    morningNote: "무겁게 덮기보다 가볍게 유지하는 흐름입니다.",
    nightNote: "잔여감을 순하게 정리하고 장벽을 안정시키는 흐름입니다.",
    gateNote: "세부 제품 순서와 사용 빈도는 전체 리포트에서 확인할 수 있어요."
  };
}

function compactRoutinePreviewItems(items = []) {
  const seen = new Set();
  return items
    .map((item) => String(item || "").trim())
    .filter((item) => !isInternalRoutinePreviewLabel(item))
    .filter(Boolean)
    .filter((item) => {
      if (seen.has(item)) {
        return false;
      }

      seen.add(item);
      return true;
    })
    .slice(0, 3);
}

const ROUTINE_MODE_PREVIEW_STEPS = {
  ko: {
    protective: ["가볍게 정돈", "수분 유지", "자외선 차단"],
    fresh_control: ["가볍게 정돈", "유분 조절", "답답함 줄이기"],
    hydration_hold: ["가볍게 정돈", "수분 유지", "보습 연결"],
    low_irritation_protect: ["자극 줄이기", "수분 유지", "자외선 차단"],
    minimal_barrier: ["자극 줄이기", "장벽 보완", "가볍게 마무리"],
    recovery: ["순하게 정리", "수분 보충", "장벽 안정"],
    reset: ["순하게 정리", "유분 정돈", "수분 균형"],
    acne_care: ["순하게 정리", "자극 줄이기", "트러블 집중 케어"],
    pore_texture_care: ["순하게 정리", "모공·결 정돈", "진정 보습"],
    calming_repair: ["자극 줄이기", "진정 보완", "장벽 안정"],
    barrier_repair: ["순하게 정리", "장벽 보완", "보습 마무리"]
  },
  en: {
    protective: ["Light reset", "Moisture hold", "UV protection"],
    fresh_control: ["Light reset", "Oil control", "Lower heaviness"],
    hydration_hold: ["Light reset", "Moisture hold", "Hydration seal"],
    low_irritation_protect: ["Reduce irritation", "Moisture hold", "UV protection"],
    minimal_barrier: ["Reduce irritation", "Barrier support", "Light finish"],
    recovery: ["Gentle reset", "Moisture refill", "Barrier comfort"],
    reset: ["Gentle reset", "Oil reset", "Moisture balance"],
    acne_care: ["Gentle reset", "Reduce irritation", "Focused breakout care"],
    pore_texture_care: ["Gentle reset", "Pore + texture care", "Calming hydration"],
    calming_repair: ["Reduce irritation", "Calming support", "Barrier comfort"],
    barrier_repair: ["Gentle reset", "Barrier support", "Moisture finish"]
  }
};

function isInternalRoutinePreviewLabel(value = "") {
  const text = String(value || "").trim().toLowerCase();
  return (
    !text ||
    text === "아침 전략" ||
    text === "저녁 전략" ||
    text === "morning strategy" ||
    text === "night strategy" ||
    /^am\s*[·/]/i.test(text) ||
    /^pm\s*[·/]/i.test(text)
  );
}

function getRoutineStepText(item) {
  if (typeof item === "string") {
    return item;
  }

  if (!item || typeof item !== "object") {
    return "";
  }

  return (
    item.intent ||
    item.purpose ||
    item.stepIntent ||
    item.stepPurpose ||
    item.title ||
    item.label ||
    item.body ||
    item.summary ||
    ""
  );
}

function collectExplicitRoutineSteps(...sources) {
  return compactRoutinePreviewItems(
    sources.flatMap((source) => {
      if (!source) {
        return [];
      }

      if (Array.isArray(source)) {
        return source.map(getRoutineStepText);
      }

      return [getRoutineStepText(source)];
    })
  );
}

function getModeRoutineSteps(mode = "", locale = "ko") {
  const copy = ROUTINE_MODE_PREVIEW_STEPS[locale] || ROUTINE_MODE_PREVIEW_STEPS.ko;
  return compactRoutinePreviewItems(copy[mode] || []);
}

function buildRoutinePreviewForMode(structure, key, fallbackLabel = "", locale = "ko") {
  const modeData = key === "morning" ? structure?.am : structure?.pm;
  const card = Array.isArray(structure?.cards)
    ? structure.cards.find((item) => item?.key === key)
    : null;
  const label = modeData?.label || card?.label || fallbackLabel;
  const strategyLine = modeData?.strategyLine || card?.body || "";
  const mode = modeData?.mode || card?.mode || "";
  const explicitSteps = collectExplicitRoutineSteps(
    modeData?.steps,
    modeData?.stepIntents,
    modeData?.stepPurposes,
    modeData?.intents,
    modeData?.purposes,
    card?.steps,
    card?.stepIntents,
    card?.stepPurposes,
    card?.intents,
    card?.purposes
  );
  const modeSteps = getModeRoutineSteps(mode, locale);
  const steps = explicitSteps.length >= 2 ? explicitSteps : modeSteps;

  return {
    mode,
    label,
    strategyLine,
    steps
  };
}

function applyRoutinePreviewFallback(segment, fallbackPreview, key) {
  const fallbackSteps = key === "morning"
    ? fallbackPreview.morningSteps
    : fallbackPreview.nightSteps;
  const fallbackLine = key === "morning"
    ? fallbackPreview.morning
    : fallbackPreview.night;
  const fallbackNote = key === "morning"
    ? fallbackPreview.morningNote
    : fallbackPreview.nightNote;

  if (Array.isArray(segment?.steps) && segment.steps.length >= 2) {
    return {
      ...segment,
      didFallback: false
    };
  }

  return {
    mode: "",
    label: fallbackNote,
    strategyLine: fallbackLine,
    steps: Array.isArray(fallbackSteps) ? fallbackSteps : [],
    didFallback: true
  };
}

export function buildFreeResultV2RoutinePreview(result = null, locale = "ko") {
  const hasRoutineStructure = result?.routineStructure && typeof result.routineStructure === "object";
  const legacyPreview = buildLegacyFreeResultV2RoutinePreview(locale);

  if (!hasRoutineStructure) {
    return legacyPreview;
  }

  const structure = getRoutineStructureData(result, locale);
  const isEnglish = locale === "en";
  const morning = applyRoutinePreviewFallback(
    buildRoutinePreviewForMode(structure, "morning", isEnglish ? "Morning strategy" : "아침 전략", locale),
    legacyPreview,
    "morning"
  );
  const night = applyRoutinePreviewFallback(
    buildRoutinePreviewForMode(structure, "night", isEnglish ? "Night strategy" : "저녁 전략", locale),
    legacyPreview,
    "night"
  );
  const morningSteps = morning.steps;
  const nightSteps = night.steps;

  if (!morningSteps.length && !nightSteps.length) {
    return legacyPreview;
  }

  return {
    morning: morning.strategyLine || morningSteps.join(" · "),
    night: night.strategyLine || nightSteps.join(" · "),
    morningSteps,
    nightSteps,
    morningNote: morning.label || (isEnglish ? "Use the morning routine as the daytime direction." : "아침 루틴은 낮 시간 관리 방향만 미리 보여줍니다."),
    nightNote: night.label || (isEnglish ? "Use the night routine as the evening direction." : "저녁 루틴은 밤 시간 관리 방향만 미리 보여줍니다."),
    gateNote: isEnglish
      ? "Detailed product order and usage frequency are available in the full report."
      : "세부 제품 순서와 사용 빈도는 전체 리포트에서 확인할 수 있어요."
  };
}

export function buildFreeResultV2FaceLabPreview(faceLabPreview = null, locale = "ko") {
  if (faceLabPreview?.primary || faceLabPreview?.keywords?.length) {
    return {
      primary: faceLabPreview.primary || (locale === "en" ? "Mood preview" : "대표 무드"),
      keywords: (faceLabPreview.keywords || []).slice(0, 4)
    };
  }

  return null;
}
