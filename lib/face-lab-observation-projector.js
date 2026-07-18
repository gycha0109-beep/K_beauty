import { buildFaceLabStructuredData } from "@/lib/face-lab-launch";
import {
  createFaceLabAvailable,
  createFaceLabInsufficientEvidence,
  createFaceLabUnavailable
} from "@/lib/face-lab-result-envelope";

const COPY = {
  ko: {
    faceShape: {
      oval: "타원형",
      round: "둥근형",
      square: "각진형",
      oblong: "긴형",
      heart: "하트형",
      diamond: "다이아몬드형",
      triangle: "삼각형",
      mixed: "복합형"
    },
    contour: { soft: "부드러운 윤곽", moderate: "균형 잡힌 윤곽", defined: "선명한 윤곽" },
    line: { curved: "곡선 중심", balanced: "직선과 곡선의 균형", straight: "직선 중심" },
    contrast: { low: "낮은 대비", medium: "중간 대비", high: "높은 대비" },
    temperature: { warm: "웜", neutral: "뉴트럴", cool: "쿨" },
    brightness: { low: "딥", medium: "미디엄", high: "라이트" },
    saturation: { muted: "뮤트", balanced: "균형", clear: "클리어" },
    unavailable: "사진에서 얼굴 구조 근거가 충분하지 않습니다."
  },
  en: {
    faceShape: {
      oval: "oval",
      round: "round",
      square: "square",
      oblong: "oblong",
      heart: "heart",
      diamond: "diamond",
      triangle: "triangle",
      mixed: "mixed"
    },
    contour: { soft: "soft contour", moderate: "balanced contour", defined: "defined contour" },
    line: { curved: "curve-led lines", balanced: "balanced straight and curved lines", straight: "straight-led lines" },
    contrast: { low: "low contrast", medium: "medium contrast", high: "high contrast" },
    temperature: { warm: "warm", neutral: "neutral", cool: "cool" },
    brightness: { low: "deep", medium: "medium", high: "light" },
    saturation: { muted: "muted", balanced: "balanced", clear: "clear" },
    unavailable: "The photo does not provide enough facial-structure evidence."
  }
};

function getCopy(locale) {
  return locale === "en" ? COPY.en : COPY.ko;
}

function fieldValue(analysis, group, key, fallback = null) {
  const field = analysis?.observations?.[group]?.[key];
  return field?.status === "available" ? field.value : fallback;
}

function compact(values, limit = 4) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()))].slice(0, limit);
}

function localizeToken(map, token, fallback = "") {
  return map[token] || fallback || token || "";
}

function buildLandmarks(analysis, locale) {
  const copy = getCopy(locale);
  const faceShape = fieldValue(analysis, "outline", "faceShape", "mixed");
  const jawline = fieldValue(analysis, "outline", "jawlineAngularity", "moderate");
  const eyeDirection = fieldValue(analysis, "eyes", "eyeDirection", "level");
  const concentration = fieldValue(analysis, "featureLayout", "featureConcentration", "balanced");

  return locale === "en"
    ? compact([
        `${localizeToken(copy.faceShape, faceShape, "mixed")} face outline`,
        `${jawline} jawline definition`,
        `${eyeDirection} eye direction`,
        `${concentration} feature placement`
      ])
    : compact([
        `${localizeToken(copy.faceShape, faceShape, "복합형")} 얼굴선`,
        `${jawline === "angular" ? "각이 선명한" : jawline === "soft" ? "부드러운" : "중간 강도의"} 턱선`,
        `${eyeDirection === "upturned" ? "상향" : eyeDirection === "downturned" ? "하향" : "수평"} 눈매 흐름`,
        `${concentration === "centered" ? "중앙 집중형" : concentration === "spread" ? "분산형" : "균형형"} 이목구비 배치`
      ]);
}

function buildHairstyle(faceShape, foreheadHeight, jawTaper, locale) {
  if (locale === "en") {
    return {
      summary: `A ${faceShape} outline with ${foreheadHeight} forehead height and a ${jawTaper} jaw taper benefits from controlled width and a visible center line.`,
      recommendations: [
        "Keep the forehead opening adjustable so the vertical balance remains visible.",
        "Use controlled side volume rather than widening both sides at once.",
        "Choose layers that finish cleanly around the jaw instead of hiding its taper."
      ],
      avoid: [
        "Avoid excessive side expansion that overstates facial width.",
        "Avoid a uniformly heavy fringe when it hides the visible vertical balance."
      ]
    };
  }

  return {
    summary: `${faceShape} 얼굴선과 ${foreheadHeight === "high" ? "높은" : foreheadHeight === "low" ? "낮은" : "균형형"} 이마, ${jawTaper === "tapered" ? "좁아지는" : jawTaper === "broad" ? "넓은" : "균형형"} 하관을 기준으로 가로 폭을 과하게 키우지 않는 정돈된 실루엣이 맞습니다.`,
    recommendations: [
      "이마 노출을 조절할 수 있는 가르마로 세로 균형을 살리세요.",
      "양옆을 동시에 부풀리기보다 사이드 볼륨을 정돈해 얼굴선의 폭을 안정시키세요.",
      "턱선 주변을 무겁게 덮지 않는 레이어로 하관 마감을 살리세요."
    ],
    avoid: [
      "양옆 폭을 크게 넓혀 얼굴 가로선을 과장하는 스타일은 피하세요.",
      "세로 균형을 완전히 가리는 무거운 일자 앞머리는 피하세요."
    ]
  };
}

function buildColor(temperature, brightness, saturation, contrast, locale) {
  const copy = getCopy(locale);
  const temperatureLabel = localizeToken(copy.temperature, temperature, copy.temperature.neutral);
  const brightnessLabel = localizeToken(copy.brightness, brightness, copy.brightness.medium);
  const saturationLabel = localizeToken(copy.saturation, saturation, copy.saturation.balanced);
  const contrastLabel = localizeToken(copy.contrast, contrast, copy.contrast.medium);

  if (locale === "en") {
    return {
      summary: `${temperatureLabel}, ${brightnessLabel}, and ${saturationLabel} visible color cues with ${contrastLabel} support controlled rather than extreme color contrast.`,
      palette: compact([`${temperatureLabel} beige`, `${saturationLabel} taupe`, `${brightnessLabel} gray`, `${temperatureLabel} coral`]),
      recommendations: [
        "Keep the base close to the visible temperature cue.",
        "Use moderate contrast so facial structure remains clearer than the color itself.",
        "Treat the palette as photo-based styling guidance, not a personal-color diagnosis."
      ],
      avoid: [
        "Avoid extreme temperature shifts based on one photo.",
        "Avoid very high chroma when it overwhelms the visible facial contrast."
      ]
    };
  }

  return {
    summary: `사진에서 보이는 ${temperatureLabel}·${brightnessLabel}·${saturationLabel} 색감과 ${contrastLabel}를 기준으로 극단적인 대비보다 정돈된 색 조합이 안정적입니다.`,
    palette: compact([`${temperatureLabel} 베이지`, `${saturationLabel} 토프`, `${brightnessLabel} 그레이`, `${temperatureLabel} 코랄`]),
    recommendations: [
      "베이스 색은 사진에서 보이는 온도감과 크게 어긋나지 않게 잡으세요.",
      "색보다 얼굴 구조가 먼저 보이도록 대비를 중간 강도로 유지하세요.",
      "이 결과는 사진 기반 스타일 참고값이며 퍼스널컬러 진단으로 단정하지 마세요."
    ],
    avoid: [
      "사진 한 장만으로 온도감을 극단적으로 반전시키는 조합은 피하세요.",
      "높은 채도가 얼굴의 가시적 대비를 덮는 조합은 피하세요."
    ]
  };
}

function buildDeterministicFaceLabData(analysis, locale) {
  const copy = getCopy(locale);
  const faceShapeToken = fieldValue(analysis, "outline", "faceShape", "mixed");
  const faceShape = localizeToken(copy.faceShape, faceShapeToken, copy.faceShape.mixed);
  const contourToken = fieldValue(analysis, "visualLanguage", "contourDefinition", "moderate");
  const lineToken = fieldValue(analysis, "visualLanguage", "straightCurveBalance", "balanced");
  const contrastToken = fieldValue(analysis, "visualLanguage", "featureContrast", "medium");
  const foreheadHeight = fieldValue(analysis, "vertical", "foreheadHeight", "balanced");
  const jawTaper = fieldValue(analysis, "outline", "jawTaper", "balanced");
  const temperature = fieldValue(analysis, "colorAppearance", "apparentTemperature", "neutral");
  const brightness = fieldValue(analysis, "colorAppearance", "apparentBrightness", "medium");
  const saturation = fieldValue(analysis, "colorAppearance", "apparentSaturation", "balanced");
  const focalFeatures = fieldValue(analysis, "featureLayout", "focalFeatures", []);
  const contour = localizeToken(copy.contour, contourToken, copy.contour.moderate);
  const line = localizeToken(copy.line, lineToken, copy.line.balanced);
  const contrast = localizeToken(copy.contrast, contrastToken, copy.contrast.medium);
  const hairstyle = buildHairstyle(faceShape, foreheadHeight, jawTaper, locale);
  const color = buildColor(temperature, brightness, saturation, contrastToken, locale);

  const headline = locale === "en"
    ? `${faceShape} outline with ${contour}`
    : `${contour}이 살아 있는 ${faceShape} 얼굴선`;
  const overall = locale === "en"
    ? `The visible structure combines ${line} and ${contrast}, so styling should preserve the center line without exaggerating width or contrast.`
    : `사진에서 ${line}과 ${contrast}가 함께 보여, 폭이나 대비를 과장하기보다 중심선과 윤곽을 정돈하는 방향이 맞습니다.`;
  const featureLines = locale === "en"
    ? [
        `The ${faceShape} outline sets the main silhouette, so width should be controlled rather than expanded uniformly.`,
        `${contour} keeps the jaw and outer line visible, so layers should finish cleanly around the lower face.`,
        `${line} supports a balanced mix of clean edges and softer transitions.`,
        `${contrast} means color and makeup contrast should stay proportional to the visible feature definition.`
      ]
    : [
        `${faceShape} 얼굴선이 기본 실루엣을 만들기 때문에 양옆 폭을 일괄적으로 키우기보다 정돈하는 편이 좋습니다.`,
        `${contour}이 보여 턱선과 외곽선을 가리지 않는 레이어가 구조를 더 잘 살립니다.`,
        `${line}이 확인되어 또렷한 선과 부드러운 연결을 한쪽으로 치우치지 않게 쓰는 편이 좋습니다.`,
        `${contrast}가 보여 컬러와 메이크업 대비도 이목구비 선명도보다 과해지지 않게 맞추는 편이 좋습니다.`
      ];

  const baseData = {
    landmarks: buildLandmarks(analysis, locale),
    face_shape: faceShapeToken,
    presentation_hint: "neutral",
    embedding: compact([lineToken, contourToken, contrastToken, ...focalFeatures], 4),
    color_values: {
      undertone: temperature,
      brightness,
      contrast: contrastToken,
      saturation
    }
  };
  const features = {
    physiognomy: {
      headline_label: headline,
      headline_result: overall,
      overall_impression: overall,
      interpretation_axes: compact([line, contour, contrast], 3),
      feature_based_interpretation: featureLines,
      real_tendency: [],
      strengths: locale === "en"
        ? ["The center line remains readable.", "The outline can be styled without extreme contrast."]
        : ["중심선이 비교적 분명하게 읽힙니다.", "극단적인 대비 없이도 윤곽을 살릴 수 있습니다."],
      cautions: locale === "en"
        ? ["Lighting and angle can change apparent color and contour cues."]
        : ["조명과 각도에 따라 색감과 윤곽 단서는 달라질 수 있습니다."]
    },
    face_shape_hairstyle: hairstyle,
    lookalike_celebrities: { summary: "", matches: [] },
    color_tone_recommendation: color
  };
  const legacy = { base_data: baseData, features };

  return {
    ...legacy,
    structured: buildFaceLabStructuredData(legacy, locale),
    analysis
  };
}

export function projectFaceLabResult(bundle, { locale = "ko", analyzedAt = null } = {}) {
  const resolvedLocale = locale === "en" ? "en" : "ko";
  const eligibility = bundle?.eligibility || null;
  const analysis = bundle?.face?.analysis || null;
  const timestamp = analyzedAt || new Date().toISOString();

  if (!eligibility || eligibility.faceLabEligible !== true) {
    return createFaceLabUnavailable(
      eligibility?.faceLabFailureReason || "eligibility_response_invalid",
      { eligibility, analyzedAt: timestamp }
    );
  }

  if (!analysis || !["available", "partial"].includes(analysis.status)) {
    return createFaceLabInsufficientEvidence(
      analysis ? { analysis } : null,
      analysis?.failureReason || "observation_coverage_insufficient",
      { eligibility, analyzedAt: timestamp }
    );
  }

  return createFaceLabAvailable(
    buildDeterministicFaceLabData(analysis, resolvedLocale),
    { eligibility, analyzedAt: timestamp }
  );
}
