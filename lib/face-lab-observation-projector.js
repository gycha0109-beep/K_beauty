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
    contour: { soft: "부드러운 윤곽", moderate: "중간 강도의 윤곽", defined: "선명한 윤곽" },
    line: { curved: "곡선 중심", balanced: "직선과 곡선의 균형", straight: "직선 중심" },
    contrast: { low: "낮은 대비", medium: "중간 대비", high: "높은 대비" },
    temperature: { warm: "웜", neutral: "뉴트럴", cool: "쿨" },
    brightness: { low: "딥", medium: "미디엄", high: "라이트" },
    saturation: { muted: "뮤트", balanced: "균형", clear: "클리어" },
    genericShape: "관찰 가능한 얼굴선",
    genericHeadline: "사진에서 확인된 얼굴 구조",
    genericOverall: "사진에서 확인된 구조 단서만 기준으로 폭과 대비를 과장하지 않는 정돈된 방향을 제안합니다."
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
    contour: { soft: "soft contour", moderate: "moderately defined contour", defined: "defined contour" },
    line: { curved: "curve-led lines", balanced: "balanced straight and curved lines", straight: "straight-led lines" },
    contrast: { low: "low contrast", medium: "medium contrast", high: "high contrast" },
    temperature: { warm: "warm", neutral: "neutral", cool: "cool" },
    brightness: { low: "deep", medium: "medium", high: "light" },
    saturation: { muted: "muted", balanced: "balanced", clear: "clear" },
    genericShape: "visible face outline",
    genericHeadline: "Visible facial structure",
    genericOverall: "The styling direction uses only supported structural cues and avoids exaggerating width or contrast."
  }
};

function getCopy(locale) {
  return locale === "en" ? COPY.en : COPY.ko;
}

function fieldValue(analysis, group, key) {
  const field = analysis?.observations?.[group]?.[key];
  return field?.status === "available" ? field.value : null;
}

function compact(values, limit = 4) {
  return [...new Set(
    values
      .filter((value) => typeof value === "string" && value.trim())
      .map((value) => value.trim())
  )].slice(0, limit);
}

function localizeToken(map, token) {
  return token && map[token] ? map[token] : "";
}

function buildLandmarks(analysis, locale) {
  const copy = getCopy(locale);
  const faceShape = fieldValue(analysis, "outline", "faceShape");
  const jawline = fieldValue(analysis, "outline", "jawlineAngularity");
  const eyeDirection = fieldValue(analysis, "eyes", "eyeDirection");
  const concentration = fieldValue(analysis, "featureLayout", "featureConcentration");

  if (locale === "en") {
    return compact([
      faceShape ? `${localizeToken(copy.faceShape, faceShape)} face outline` : "",
      jawline ? `${jawline} jawline definition` : "",
      eyeDirection ? `${eyeDirection} eye direction` : "",
      concentration ? `${concentration} feature placement` : ""
    ]);
  }

  return compact([
    faceShape ? `${localizeToken(copy.faceShape, faceShape)} 얼굴선` : "",
    jawline
      ? `${jawline === "angular" ? "각이 선명한" : jawline === "soft" ? "부드러운" : "중간 강도의"} 턱선`
      : "",
    eyeDirection
      ? `${eyeDirection === "upturned" ? "상향" : eyeDirection === "downturned" ? "하향" : eyeDirection === "mixed" ? "혼합형" : "수평"} 눈매 흐름`
      : "",
    concentration
      ? `${concentration === "centered" ? "중앙 집중형" : concentration === "spread" ? "분산형" : "균형형"} 이목구비 배치`
      : ""
  ]);
}

function buildHairstyle({ faceShape, foreheadHeight, jawTaper, locale }) {
  const observed = compact([faceShape, foreheadHeight, jawTaper]);
  if (!observed.length) {
    return { summary: "", recommendations: [], avoid: [] };
  }

  if (locale === "en") {
    const facts = compact([
      faceShape ? `${faceShape} outline` : "",
      foreheadHeight ? `${foreheadHeight} forehead height` : "",
      jawTaper ? `${jawTaper} jaw taper` : ""
    ]).join(", ");
    return {
      summary: `Based on the supported ${facts}, keep width and vertical balance adjustable rather than forcing one fixed silhouette.`,
      recommendations: compact([
        foreheadHeight ? "Keep forehead exposure adjustable so the observed vertical balance remains visible." : "",
        faceShape ? "Control side volume so the observed outline is not widened uniformly." : "",
        jawTaper ? "Use layers that finish cleanly around the jaw instead of hiding the observed taper." : ""
      ], 3),
      avoid: compact([
        faceShape ? "Avoid excessive side expansion that distorts the observed outline." : "",
        foreheadHeight ? "Avoid a uniformly heavy fringe when it hides the observed vertical balance." : ""
      ], 2)
    };
  }

  const facts = compact([
    faceShape ? `${faceShape} 얼굴선` : "",
    foreheadHeight ? `${foreheadHeight === "high" ? "높은" : foreheadHeight === "low" ? "낮은" : "균형형"} 이마` : "",
    jawTaper ? `${jawTaper === "tapered" ? "좁아지는" : jawTaper === "broad" ? "넓은" : "균형형"} 하관` : ""
  ]).join("·");
  return {
    summary: `확인된 ${facts}을 기준으로 한쪽 실루엣을 단정하기보다 가로 폭과 세로 균형을 조절할 수 있는 구성이 맞습니다.`,
    recommendations: compact([
      foreheadHeight ? "이마 노출을 조절할 수 있는 가르마로 확인된 세로 균형을 살리세요." : "",
      faceShape ? "사이드 볼륨을 정돈해 확인된 얼굴선의 폭을 일괄적으로 넓히지 마세요." : "",
      jawTaper ? "턱선 주변을 무겁게 덮지 않는 레이어로 확인된 하관 마감을 살리세요." : ""
    ], 3),
    avoid: compact([
      faceShape ? "양옆 폭을 크게 넓혀 확인된 얼굴선을 왜곡하는 스타일은 피하세요." : "",
      foreheadHeight ? "확인된 세로 균형을 완전히 가리는 무거운 일자 앞머리는 피하세요." : ""
    ], 2)
  };
}

function buildColor({ temperature, brightness, saturation, contrast, locale }) {
  const copy = getCopy(locale);
  const visibleColorTokens = compact([temperature, brightness, saturation]);
  if (visibleColorTokens.length < 2) {
    return { summary: "", palette: [], recommendations: [], avoid: [] };
  }

  const temperatureLabel = localizeToken(copy.temperature, temperature);
  const brightnessLabel = localizeToken(copy.brightness, brightness);
  const saturationLabel = localizeToken(copy.saturation, saturation);
  const contrastLabel = localizeToken(copy.contrast, contrast);
  const labels = compact([temperatureLabel, brightnessLabel, saturationLabel]);

  if (locale === "en") {
    return {
      summary: `The supported visible color cues are ${labels.join(", ")}${contrastLabel ? ` with ${contrastLabel}` : ""}; treat them as photo-based styling guidance only.`,
      palette: compact([
        temperatureLabel ? `${temperatureLabel} beige` : "",
        saturationLabel ? `${saturationLabel} taupe` : "",
        brightnessLabel ? `${brightnessLabel} gray` : ""
      ]),
      recommendations: [
        "Keep the base close to the supported visible temperature and brightness cues.",
        "Use moderate contrast so facial structure remains clearer than the color itself.",
        "Treat this as styling guidance, not a personal-color diagnosis."
      ],
      avoid: [
        "Avoid extreme temperature shifts based on one photo.",
        "Avoid very high chroma when it overwhelms the supported facial contrast."
      ]
    };
  }

  return {
    summary: `확인된 사진 색감 단서는 ${labels.join("·")}${contrastLabel ? `·${contrastLabel}` : ""}이며, 퍼스널컬러 진단이 아닌 스타일 참고값으로만 사용합니다.`,
    palette: compact([
      temperatureLabel ? `${temperatureLabel} 베이지` : "",
      saturationLabel ? `${saturationLabel} 토프` : "",
      brightnessLabel ? `${brightnessLabel} 그레이` : ""
    ]),
    recommendations: [
      "베이스 색은 확인된 온도감과 명도 단서에서 크게 벗어나지 않게 잡으세요.",
      "색보다 얼굴 구조가 먼저 보이도록 대비를 중간 강도로 유지하세요.",
      "이 결과는 사진 기반 스타일 참고값이며 퍼스널컬러 진단으로 단정하지 마세요."
    ],
    avoid: [
      "사진 한 장만으로 온도감을 극단적으로 반전시키는 조합은 피하세요.",
      "높은 채도가 확인된 얼굴 대비를 덮는 조합은 피하세요."
    ]
  };
}

function buildDeterministicFaceLabData(analysis, locale) {
  const copy = getCopy(locale);
  const faceShapeToken = fieldValue(analysis, "outline", "faceShape");
  const contourToken = fieldValue(analysis, "visualLanguage", "contourDefinition");
  const lineToken = fieldValue(analysis, "visualLanguage", "straightCurveBalance");
  const contrastToken = fieldValue(analysis, "visualLanguage", "featureContrast");
  const foreheadHeight = fieldValue(analysis, "vertical", "foreheadHeight");
  const jawTaper = fieldValue(analysis, "outline", "jawTaper");
  const temperature = fieldValue(analysis, "colorAppearance", "apparentTemperature");
  const brightness = fieldValue(analysis, "colorAppearance", "apparentBrightness");
  const saturation = fieldValue(analysis, "colorAppearance", "apparentSaturation");
  const focalFeatures = fieldValue(analysis, "featureLayout", "focalFeatures") || [];

  const faceShape = localizeToken(copy.faceShape, faceShapeToken);
  const contour = localizeToken(copy.contour, contourToken);
  const line = localizeToken(copy.line, lineToken);
  const contrast = localizeToken(copy.contrast, contrastToken);
  const descriptors = compact([faceShape, contour, line, contrast]);
  const hairstyle = buildHairstyle({
    faceShape: faceShape || null,
    foreheadHeight,
    jawTaper,
    locale
  });
  const color = buildColor({ temperature, brightness, saturation, contrast: contrastToken, locale });

  const headline = descriptors.length
    ? descriptors.slice(0, 2).join(locale === "en" ? " with " : "·")
    : copy.genericHeadline;
  const overall = descriptors.length
    ? locale === "en"
      ? `The supported visible structure is ${descriptors.join(", ")}; styling should preserve these cues without inventing unavailable features.`
      : `사진에서 확인된 구조 단서는 ${descriptors.join("·")}이며, 확인되지 않은 특징을 보완해 단정하지 않는 방향으로 정리했습니다.`
    : copy.genericOverall;
  const featureLines = compact([
    faceShape
      ? locale === "en"
        ? `The ${faceShape} outline is visible, so side width should not be expanded uniformly.`
        : `${faceShape} 얼굴선이 보여 양옆 폭을 일괄적으로 키우지 않는 편이 좋습니다.`
      : "",
    contour
      ? locale === "en"
        ? `${contour} is supported, so layers should not hide the visible outer line.`
        : `${contour}이 확인되어 외곽선을 무겁게 가리지 않는 편이 좋습니다.`
      : "",
    line
      ? locale === "en"
        ? `${line} is supported, so styling can follow that visible line balance.`
        : `${line}이 확인되어 해당 선의 균형을 유지하는 편이 좋습니다.`
      : "",
    contrast
      ? locale === "en"
        ? `${contrast} is supported, so color contrast should stay proportional to it.`
        : `${contrast}가 확인되어 컬러 대비도 그보다 과하지 않게 맞추는 편이 좋습니다.`
      : ""
  ], 4);

  const baseData = {
    landmarks: buildLandmarks(analysis, locale),
    face_shape: faceShapeToken || "",
    presentation_hint: "neutral",
    embedding: compact([lineToken, contourToken, contrastToken, ...focalFeatures], 4),
    color_values: {
      undertone: temperature || "",
      brightness: brightness || "",
      contrast: contrastToken || "",
      saturation: saturation || ""
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
      strengths: descriptors.length
        ? locale === "en"
          ? ["The supported structure can guide styling without relying on identity or personality claims."]
          : ["확인된 구조만으로도 성격이나 정체성을 추론하지 않고 스타일 방향을 정리할 수 있습니다."]
        : [],
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

  if (!analysis || analysis.status !== "available") {
    return createFaceLabInsufficientEvidence(
      analysis ? { analysis } : null,
      analysis?.failureReason || (analysis?.status === "partial" ? "observation_coverage_partial" : "observation_coverage_insufficient"),
      { eligibility, analyzedAt: timestamp }
    );
  }

  return createFaceLabAvailable(
    buildDeterministicFaceLabData(analysis, resolvedLocale),
    { eligibility, analyzedAt: timestamp }
  );
}
