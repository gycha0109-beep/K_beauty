import { buildFallbackPhotoAnalysis } from "@/lib/photo-evidence";

const COPY = {
  ko: {
    labels: {
      oiliness: "유분 표현",
      dehydration: "수분감 저하",
      acne: "트러블 경향",
      uneven_tone: "톤 불균일",
      pores: "모공 표현",
      redness: "붉은기",
      barrier: "표면 장벽 부담"
    },
    areas: {
      full_face: "얼굴 전반",
      t_zone: "T존",
      forehead: "이마",
      nose: "코",
      cheeks: "볼",
      chin: "턱",
      jawline: "턱선",
      eye_area: "눈가",
      unknown: "확인 가능한 부위"
    },
    cues: {
      surface_shine: "표면 광택",
      dry_texture: "건조한 결",
      visible_flaking: "들뜬 표면",
      red_appearance: "붉은 표현",
      active_spots: "눈에 띄는 국소 부위",
      pore_visibility: "모공 가시성",
      tone_variation: "톤 차이",
      surface_stress: "표면 부담",
      uncertain: "제한적인 사진 단서"
    },
    levels: { low: "낮게", mild: "약하게", moderate: "중간 정도로", high: "높게" },
    summary: "사진에서는 {signals} 경향이 우선 확인됩니다.",
    alignment: {
      aligned: "설문에서 선택한 고민과 사진 단서가 비슷한 방향입니다.",
      mixed: "설문 고민과 사진 단서가 일부만 겹쳐 설문 답변을 함께 반영했습니다.",
      conflict: "사진 단서가 설문 고민을 뚜렷하게 뒷받침하지 않아 설문 답변을 우선했습니다.",
      unknown: "사진 단서가 제한되어 설문 답변을 우선했습니다."
    }
  },
  en: {
    labels: {
      oiliness: "Oil expression",
      dehydration: "Lower hydration look",
      acne: "Breakout tendency",
      uneven_tone: "Uneven tone",
      pores: "Visible pores",
      redness: "Redness",
      barrier: "Surface barrier stress"
    },
    areas: {
      full_face: "the face overall",
      t_zone: "the T-zone",
      forehead: "the forehead",
      nose: "the nose",
      cheeks: "the cheeks",
      chin: "the chin",
      jawline: "the jawline",
      eye_area: "the eye area",
      unknown: "the visible area"
    },
    cues: {
      surface_shine: "surface shine",
      dry_texture: "dry-looking texture",
      visible_flaking: "visible surface flaking",
      red_appearance: "red appearance",
      active_spots: "visible localized spots",
      pore_visibility: "pore visibility",
      tone_variation: "tone variation",
      surface_stress: "surface stress",
      uncertain: "a limited photo cue"
    },
    levels: { low: "at a low level", mild: "mildly", moderate: "at a moderate level", high: "at a higher level" },
    summary: "The photo most clearly supports {signals}.",
    alignment: {
      aligned: "The selected survey concern and the photo cues point in a similar direction.",
      mixed: "The survey concern and photo cues overlap only partly, so both were considered.",
      conflict: "The photo does not strongly support the selected concern, so the survey was prioritized.",
      unknown: "Photo evidence was limited, so the survey was prioritized."
    }
  }
};

function getCopy(locale) {
  return locale === "en" ? COPY.en : COPY.ko;
}

function getPrimaryConcern(formInput = {}) {
  return formInput.primaryConcern || formInput.mainConcern || formInput.mainConcerns?.[0] || null;
}

function buildAlignment(skin, formInput, locale) {
  const copy = getCopy(locale);
  const concern = getPrimaryConcern(formInput);
  if (!concern || skin.status !== "available") {
    return { status: "unknown", note: copy.alignment.unknown };
  }
  const score = Number(skin.signals?.[concern] || 0);
  const status = score >= 3 ? "aligned" : score === 2 ? "mixed" : "conflict";
  return { status, note: copy.alignment[status] };
}

function observationDescription(item, locale) {
  const copy = getCopy(locale);
  const area = copy.areas[item.area] || copy.areas.unknown;
  const cue = copy.cues[item.cue] || copy.cues.uncertain;
  const level = copy.levels[item.level] || copy.levels.low;
  return locale === "en"
    ? `${cue} appears ${level} around ${area}.`
    : `${area}에서 ${cue}이 ${level} 보입니다.`;
}

export function projectSkinObservation(bundle, { locale = "ko", formInput = {} } = {}) {
  const resolvedLocale = locale === "en" ? "en" : "ko";
  const fallback = buildFallbackPhotoAnalysis(resolvedLocale);
  const eligibility = bundle?.eligibility;
  const skin = bundle?.skin;

  if (!eligibility || eligibility.skinAnalysisEligible !== true || !skin) {
    return {
      ...fallback,
      imageEligibility: eligibility || fallback.imageEligibility
    };
  }

  const copy = getCopy(resolvedLocale);
  const observations = Array.isArray(skin.observations) ? skin.observations.slice(0, 3) : [];
  const signals = observations.map((item) => ({
    key: item.key,
    label: copy.labels[item.key] || copy.labels.barrier,
    area: copy.areas[item.area] || copy.areas.unknown,
    confidence: item.confidence,
    description: observationDescription(item, resolvedLocale)
  }));
  const evidence = observations.slice(0, 4).map((item) => ({
    axis: item.key,
    label: copy.labels[item.key] || copy.labels.barrier,
    detail: observationDescription(item, resolvedLocale)
  }));
  const signalLabels = signals.map((item) => item.label).slice(0, 3);
  const summary = signalLabels.length
    ? copy.summary.replace("{signals}", signalLabels.join(resolvedLocale === "en" ? ", " : "·"))
    : fallback.photoObservations.summary;

  return {
    signals: { ...skin.signals },
    evidence,
    photoObservations: {
      summary,
      signals,
      surveyAlignment: buildAlignment(skin, formInput, resolvedLocale)
    },
    imageEligibility: eligibility
  };
}
