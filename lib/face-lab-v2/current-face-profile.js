import { getFaceLabObservationAnalysis } from "../face-lab-analysis-bundle.js";

const PROFILE_VERSION = "face-lab-current-face-profile-v1";

const COPY = {
  ko: {
    straightCurveBalance: {
      curved: ["곡선 중심의 선", "얼굴의 선이 직선보다 곡선 쪽으로 읽힙니다."],
      balanced: ["직선과 곡선의 균형", "직선과 곡선이 한쪽으로 치우치지 않고 함께 보입니다."],
      straight: ["직선 중심의 선", "얼굴의 선이 곡선보다 직선 쪽으로 읽힙니다."]
    },
    contourDefinition: {
      soft: ["부드러운 윤곽", "얼굴 외곽의 경계가 강하게 끊기기보다 부드럽게 이어집니다."],
      moderate: ["중간 정도의 윤곽 선명도", "얼굴 외곽이 너무 흐리거나 강하지 않은 중간 수준으로 보입니다."],
      defined: ["선명한 윤곽", "얼굴 외곽의 경계와 구조가 비교적 또렷하게 보입니다."]
    },
    featureContrast: {
      low: ["낮은 특징 대비", "이목구비 사이의 시각적 대비가 비교적 낮게 보입니다."],
      medium: ["중간 특징 대비", "이목구비의 시각적 대비가 중간 정도로 보입니다."],
      high: ["높은 특징 대비", "이목구비 사이의 시각적 대비가 비교적 강하게 보입니다."]
    },
    eyeDirection: {
      upturned: ["상향 눈매 흐름", "눈의 바깥 방향이 수평보다 위쪽으로 향하는 흐름이 보입니다."],
      level: ["수평 눈매 흐름", "눈의 전체 방향이 비교적 수평에 가깝게 보입니다."],
      downturned: ["하향 눈매 흐름", "눈의 바깥 방향이 수평보다 아래쪽으로 향하는 흐름이 보입니다."],
      mixed: ["혼합형 눈매 흐름", "눈의 방향성이 한 방향으로 단순하게 정리되지 않습니다."]
    },
    jawlineAngularity: {
      soft: ["부드러운 턱선", "턱선이 각지게 끊기기보다 부드럽게 이어집니다."],
      moderate: ["중간 턱선 각도", "턱선의 각진 정도가 중간 수준으로 보입니다."],
      angular: ["각이 보이는 턱선", "턱선의 방향 전환과 각이 비교적 뚜렷하게 보입니다."]
    },
    featureConcentration: {
      spread: ["분산된 이목구비 배치", "이목구비가 얼굴 중심에 강하게 모이기보다 비교적 넓게 분포해 보입니다."],
      balanced: ["균형형 이목구비 배치", "이목구비의 배치가 중앙 집중이나 분산 한쪽으로 강하게 치우치지 않습니다."],
      centered: ["중앙 집중형 이목구비 배치", "이목구비가 얼굴 중심부에 비교적 모여 보입니다."]
    },
    faceLengthBalance: {
      short: ["짧은 세로 균형", "얼굴의 세로 흐름이 비교적 짧게 읽힙니다."],
      balanced: ["균형형 세로 비율", "얼굴의 세로 흐름이 한쪽으로 과하게 길거나 짧게 읽히지 않습니다."],
      long: ["긴 세로 균형", "얼굴의 세로 흐름이 비교적 길게 읽힙니다."]
    },
    summary: "사진에서 확인된 특징 중 스타일에 연결하기 좋은 핵심 단서를 정리했습니다."
  },
  en: {
    straightCurveBalance: {
      curved: ["Curve-led lines", "Visible facial lines read more curved than straight."],
      balanced: ["Balanced straight and curved lines", "Straight and curved lines appear without one clearly dominating."],
      straight: ["Straight-led lines", "Visible facial lines read more straight than curved."]
    },
    contourDefinition: {
      soft: ["Soft contour", "The outer facial line transitions softly rather than with hard breaks."],
      moderate: ["Moderate contour definition", "The outer contour reads at a moderate level of definition."],
      defined: ["Defined contour", "The outer contour and structural boundaries appear relatively clear."]
    },
    featureContrast: {
      low: ["Low feature contrast", "Visual contrast between facial features appears relatively low."],
      medium: ["Medium feature contrast", "Visual contrast between facial features appears moderate."],
      high: ["High feature contrast", "Visual contrast between facial features appears relatively strong."]
    },
    eyeDirection: {
      upturned: ["Upturned eye direction", "The outer eye direction trends upward from horizontal."],
      level: ["Level eye direction", "The overall eye direction reads close to horizontal."],
      downturned: ["Downturned eye direction", "The outer eye direction trends downward from horizontal."],
      mixed: ["Mixed eye direction", "Eye direction does not reduce cleanly to one orientation."]
    },
    jawlineAngularity: {
      soft: ["Soft jawline", "The jawline transitions softly rather than through strong angular breaks."],
      moderate: ["Moderate jaw angularity", "Jaw angularity appears moderate."],
      angular: ["Angular jawline", "Directional changes and angles along the jawline are relatively clear."]
    },
    featureConcentration: {
      spread: ["Spread feature placement", "Features appear relatively spread rather than strongly center-concentrated."],
      balanced: ["Balanced feature placement", "Feature placement does not strongly favor centered or spread."],
      centered: ["Centered feature placement", "Features appear relatively concentrated toward the facial center."]
    },
    faceLengthBalance: {
      short: ["Short vertical balance", "The facial vertical flow reads relatively short."],
      balanced: ["Balanced vertical proportion", "The facial vertical flow does not read especially long or short."],
      long: ["Long vertical balance", "The facial vertical flow reads relatively long."]
    },
    summary: "Key visible facial cues that can later inform styling are summarized here."
  }
};

function field(analysis, group, key) {
  const candidate = analysis?.observations?.[group]?.[key];
  return candidate?.status === "available" ? candidate : null;
}

function numericEnum(value, mapping) {
  return Object.prototype.hasOwnProperty.call(mapping, value) ? mapping[value] : null;
}

function buildKeyFeature({ analysis, group, key, locale }) {
  const source = field(analysis, group, key);
  if (!source) {
    return null;
  }

  const copy = COPY[locale]?.[key]?.[source.value];
  if (!copy) {
    return null;
  }

  return {
    key,
    label: copy[0],
    direction: Array.isArray(source.value) ? source.value.join(",") : String(source.value),
    prominence: null,
    explanation: copy[1],
    evidence: [...source.evidence],
    confidence: source.confidence
  };
}

export function buildFaceLabV2Quality(analysisInput) {
  const analysis = getFaceLabObservationAnalysis(analysisInput);
  const quality = analysis?.quality;

  if (!quality || quality.status !== "available" || !quality.value) {
    return {
      status: "unavailable",
      faceVisibility: null,
      lightingSuitability: null,
      colorSuitability: null,
      poseWarnings: [],
      occlusionWarnings: [],
      captureWarnings: [],
      evidence: []
    };
  }

  const value = quality.value;
  const poseWarnings = [];
  const occlusionWarnings = [];
  const captureWarnings = [];

  if (value.pose?.yaw && !["frontal", "slight_left", "slight_right"].includes(value.pose.yaw)) {
    poseWarnings.push(`yaw:${value.pose.yaw}`);
  }
  if (value.pose?.pitch && value.pose.pitch !== "level") {
    poseWarnings.push(`pitch:${value.pose.pitch}`);
  }
  if (value.pose?.roll && value.pose.roll !== "level") {
    poseWarnings.push(`roll:${value.pose.roll}`);
  }

  Object.entries(value.occlusion || {}).forEach(([area, state]) => {
    if (state && state !== "none") {
      occlusionWarnings.push(`${area}:${state}`);
    }
  });

  if (value.sharpness !== "clear") captureWarnings.push(`sharpness:${value.sharpness}`);
  if (value.exposure !== "balanced") captureWarnings.push(`exposure:${value.exposure}`);
  if (value.lightingUniformity !== "even") captureWarnings.push(`lighting:${value.lightingUniformity}`);
  if (value.whiteBalance !== "stable") captureWarnings.push(`white_balance:${value.whiteBalance}`);
  if (value.filterOrEditing !== "none_detected") captureWarnings.push(`editing:${value.filterOrEditing}`);

  return {
    status: "available",
    faceVisibility: value.faceVisibility === "clear" ? 1 : value.faceVisibility === "partial" ? 0.65 : 0.25,
    lightingSuitability: value.structureSuitability === "suitable" ? 1 : value.structureSuitability === "limited" ? 0.6 : 0,
    colorSuitability: value.colorSuitability === "suitable" ? 1 : value.colorSuitability === "limited" ? 0.6 : 0,
    poseWarnings,
    occlusionWarnings,
    captureWarnings,
    evidence: [...quality.evidence]
  };
}

export function buildCurrentFaceProfile(analysisInput, { locale = "ko" } = {}) {
  const analysis = getFaceLabObservationAnalysis(analysisInput);
  const resolvedLocale = locale === "en" ? "en" : "ko";

  if (!analysis || analysis.status === "unavailable") {
    return {
      status: "unavailable",
      profileVersion: PROFILE_VERSION,
      summary: null,
      keyFeatures: [],
      visualLanguage: null,
      structuralProfile: null,
      presentationObservations: null,
      evidence: [],
      confidence: null,
      unavailableReason: analysis?.failureReason || "face_analysis_unavailable"
    };
  }

  const featureSpecs = [
    ["visualLanguage", "straightCurveBalance"],
    ["visualLanguage", "contourDefinition"],
    ["visualLanguage", "featureContrast"],
    ["eyes", "eyeDirection"],
    ["outline", "jawlineAngularity"],
    ["featureLayout", "featureConcentration"],
    ["vertical", "faceLengthBalance"]
  ];

  const keyFeatures = featureSpecs
    .map(([group, key]) => buildKeyFeature({ analysis, group, key, locale: resolvedLocale }))
    .filter(Boolean)
    .slice(0, 5);

  const line = field(analysis, "visualLanguage", "straightCurveBalance");
  const definition = field(analysis, "visualLanguage", "contourDefinition");
  const contrast = field(analysis, "visualLanguage", "featureContrast");

  const visualLanguage = line || definition || contrast
    ? {
        lineCurve: numericEnum(line?.value, { curved: 0, balanced: 0.5, straight: 1 }),
        definition: numericEnum(definition?.value, { soft: 0, moderate: 0.5, defined: 1 }),
        featureContrast: numericEnum(contrast?.value, { low: 0, medium: 0.5, high: 1 }),
        visualWeightDistribution: null
      }
    : null;

  const evidence = [...new Set(keyFeatures.flatMap((item) => item.evidence))];
  const confidences = keyFeatures
    .map((item) => item.confidence)
    .filter((value) => typeof value === "number" && Number.isFinite(value));

  const available = keyFeatures.length >= 3;
  const status = available
    ? analysis.status === "partial" ? "partial" : "available"
    : "insufficient_evidence";

  return {
    status,
    profileVersion: PROFILE_VERSION,
    representationRef: null,
    faceSpaceVersion: null,
    summary: keyFeatures.length ? COPY[resolvedLocale].summary : null,
    keyFeatures,
    visualLanguage,
    structuralProfile: null,
    presentationObservations: null,
    evidence,
    confidence: confidences.length
      ? Number((confidences.reduce((sum, value) => sum + value, 0) / confidences.length).toFixed(2))
      : null,
    unavailableReason: status === "insufficient_evidence"
      ? "current_face_profile_evidence_insufficient"
      : null
  };
}
