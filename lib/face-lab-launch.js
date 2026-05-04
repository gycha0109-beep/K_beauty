function cleanText(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function compactList(values, limit = 4) {
  return Array.isArray(values)
    ? values.map((item) => cleanText(item)).filter(Boolean).slice(0, limit)
    : [];
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeKeyword(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s/-]/gu, "")
    .trim();
}

function isWeakLine(value) {
  const text = cleanText(value);
  const lower = text.toLowerCase();

  if (!text) {
    return true;
  }

  const blockedPhrases = [
    "얼굴의 구조가 조화롭게 배치",
    "구조적으로 유사한",
    "유명 인상",
    "짧은 얼굴형에 적합한",
    "부드럽고 친근한 인상을 줍니다",
    "객관적으로",
    "매력적",
    "celebrity",
    "lookalike",
    "look-alike",
    "objective attractiveness",
    "fortune"
  ];

  return blockedPhrases.some((phrase) => lower.includes(phrase.toLowerCase()));
}

function looksActionable(line) {
  return /(앞머리|이마|옆볼륨|윗볼륨|턱선|가르마|볼륨|레이어|길이|스타일|피하|줄이|살리|덮|forehead|bang|volume|jaw|layer|side|top|avoid|reduce|lift|open)/i.test(
    cleanText(line)
  );
}

function isWeakKeyword(value) {
  const keyword = normalizeKeyword(value);

  if (!keyword) {
    return true;
  }

  const blocked = new Set([
    "지적",
    "디지털",
    "리더",
    "집중",
    "구조",
    "부드러움",
    "세련",
    "intellectual",
    "digital",
    "leader",
    "focused",
    "structured",
    "soft",
    "modern"
  ]);

  return blocked.has(keyword) || keyword.length <= 1;
}

function getTeaserLine(faceLab, locale = "ko") {
  const candidates = [
    ...compactList(faceLab?.free?.teaserLine ? [faceLab.free.teaserLine] : [], 1),
    ...compactList(faceLab?.features?.face_shape_hairstyle?.recommendations, 3),
    cleanText(faceLab?.features?.face_shape_hairstyle?.summary),
    ...compactList(faceLab?.features?.physiognomy?.feature_based_interpretation, 2)
  ].filter((item) => !isWeakLine(item) && looksActionable(item));

  if (candidates.length) {
    return candidates[0];
  }

  return locale === "en"
    ? "Styles that lift the top line a little and avoid spreading too wide at the sides usually look steadier on this face."
    : "옆으로 퍼지는 볼륨보다 윗선이 가볍게 살아나는 스타일이 얼굴 비율을 더 안정적으로 보이게 하는 편입니다.";
}

function getFaceSummary(faceLab, locale = "ko") {
  const candidates = [
    cleanText(faceLab?.paid?.faceSummary),
    cleanText(faceLab?.features?.physiognomy?.overall_impression),
    cleanText(faceLab?.features?.face_shape_hairstyle?.summary)
  ].filter((item) => !isWeakLine(item));

  if (candidates.length) {
    return candidates[0];
  }

  return locale === "en"
    ? "The face reads softer first, but the center line does not collapse easily, so cleaner styling usually makes the impression look more organized."
    : "전체적으로 부드러운 인상이 먼저 보이지만 중심선이 쉽게 흐트러지지 않아, 깔끔하게 정리된 스타일을 얹을수록 인상이 더 또렷해지는 편입니다.";
}

function buildHairDirections(faceLab, locale = "ko") {
  const explicit = compactList(faceLab?.paid?.hairDirections, 3).filter((item) => !isWeakLine(item));
  if (explicit.length >= 3) {
    return explicit.slice(0, 3);
  }

  const recommendations = compactList(faceLab?.features?.face_shape_hairstyle?.recommendations, 5)
    .filter((item) => !isWeakLine(item) && looksActionable(item));

  const fallback = locale === "en"
    ? [
        "Keep side volume a little tighter and lift the top line first when you want the face to look more balanced.",
        "A lighter fringe or partial forehead opening usually works better than a heavy full bang.",
        "Do not let the jawline disappear under a heavy lower silhouette."
      ]
    : [
        "옆볼륨은 너무 넓게 퍼뜨리기보다 윗선이 먼저 살아나게 두는 편이 얼굴 비율을 더 안정적으로 보이게 합니다.",
        "앞머리는 완전히 무겁게 덮기보다 이마가 조금 보이는 쪽이 중심선을 더 깔끔하게 살리기 쉽습니다.",
        "턱선 주변을 너무 무겁게 가리기보다 하단 실루엣을 가볍게 두는 편이 좋습니다."
      ];

  return unique([...explicit, ...recommendations, ...fallback]).slice(0, 3);
}

function buildAvoidStyles(faceLab, locale = "ko") {
  const explicit = compactList(faceLab?.paid?.avoidStyles, 3).filter((item) => !isWeakLine(item));
  if (explicit.length >= 3) {
    return explicit.slice(0, 3);
  }

  const avoid = compactList(faceLab?.features?.face_shape_hairstyle?.avoid, 4)
    .filter((item) => !isWeakLine(item));

  const fallback = locale === "en"
    ? [
        "Wide side volume that pushes the face outward",
        "Heavy full bangs that cover the brows completely",
        "A lower silhouette that hides the whole jawline at once"
      ]
    : [
        "옆으로 넓게 퍼지는 볼륨 스타일",
        "눈썹 아래까지 무겁게 덮는 앞머리",
        "턱선을 한 번에 모두 가리는 무거운 하단 실루엣"
      ];

  return unique([...explicit, ...avoid, ...fallback]).slice(0, 3);
}

function buildStyleKeywords(faceLab, locale = "ko") {
  const explicit = compactList(faceLab?.paid?.styleKeywords, 3).filter((item) => !isWeakKeyword(item));
  if (explicit.length >= 3) {
    return explicit.slice(0, 3);
  }

  const axes = compactList(faceLab?.features?.physiognomy?.interpretation_axes, 3)
    .map(normalizeKeyword)
    .filter((item) => !isWeakKeyword(item));
  const embedding = compactList(faceLab?.base_data?.embedding, 3)
    .map(normalizeKeyword)
    .filter((item) => !isWeakKeyword(item));
  const fallback = locale === "en"
    ? ["clean natural", "soft urban", "light volume"]
    : ["깔끔한 내추럴", "부드러운 도시감", "가벼운 볼륨"];

  return unique([...explicit, ...axes, ...embedding, ...fallback]).slice(0, 3);
}

function getToneDirection(faceLab, locale = "ko") {
  const explicit = cleanText(faceLab?.paid?.toneDirection);
  if (explicit && !isWeakLine(explicit)) {
    return explicit;
  }

  const summary = cleanText(faceLab?.features?.color_tone_recommendation?.summary);
  if (summary && !isWeakLine(summary)) {
    return summary;
  }

  const palette = compactList(faceLab?.features?.color_tone_recommendation?.palette, 3);
  if (palette.length) {
    return locale === "en"
      ? `A cleaner, muted direction such as ${palette.join(", ")} usually supports the facial structure more naturally.`
      : `${palette.join(", ")} 같은 정리된 저채도 톤이 얼굴선보다 색이 먼저 튀지 않게 받쳐 주는 편입니다.`;
  }

  return locale === "en"
    ? "Muted and cleaner tones usually support the structure better than loud high-chroma contrast."
    : "채도가 너무 강한 쪽보다 정리된 저채도 톤이 얼굴 구조를 더 자연스럽게 받쳐 주는 편입니다.";
}

function buildReasoningLines(faceLab, locale = "ko") {
  const explicit = compactList(faceLab?.paid?.reasoningLines, 3).filter((item) => !isWeakLine(item));
  if (explicit.length >= 3) {
    return explicit.slice(0, 3);
  }

  const featureLines = compactList(faceLab?.features?.physiognomy?.feature_based_interpretation, 4)
    .filter((item) => !isWeakLine(item));
  const colorLines = compactList(faceLab?.features?.color_tone_recommendation?.recommendations, 2)
    .filter((item) => !isWeakLine(item));
  const lines = unique([...explicit, ...featureLines, ...colorLines]).slice(0, 3);

  if (lines.length) {
    return lines;
  }

  return locale === "en"
    ? [
        "The face holds better when side width does not spread too far before the center line arrives.",
        "A cleaner lower silhouette usually keeps the jaw and cheek balance more stable.",
        "Lower-chroma color direction tends to let the face arrive before the styling does."
      ]
    : [
        "옆선이 먼저 넓어지지 않을수록 중심선이 더 또렷하게 보이는 편입니다.",
        "하단 실루엣이 정리될수록 턱선과 볼선의 균형이 더 안정적으로 보입니다.",
        "채도를 낮춘 색 방향이 스타일보다 얼굴선을 먼저 보이게 하는 데 유리한 편입니다."
      ];
}

export function buildFaceLabLaunchData(faceLab, locale = "ko") {
  return {
    free: {
      teaserLine: getTeaserLine(faceLab, locale)
    },
    paid: {
      faceSummary: getFaceSummary(faceLab, locale),
      hairDirections: buildHairDirections(faceLab, locale),
      avoidStyles: buildAvoidStyles(faceLab, locale),
      styleKeywords: buildStyleKeywords(faceLab, locale),
      toneDirection: getToneDirection(faceLab, locale),
      reasoningLines: buildReasoningLines(faceLab, locale)
    }
  };
}
