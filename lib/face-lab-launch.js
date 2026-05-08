function cleanText(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function hasKoreanText(value) {
  return /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(String(value || ""));
}

const FACE_LAB_DISPLAY_TOKEN_LABELS = {
  ko: {
    "balanced oval": "균형형 타원 얼굴선",
    "soft oval": "부드러운 타원 얼굴선",
    oval: "타원형 얼굴선",
    round: "둥근 얼굴선",
    "soft beige": "부드러운 베이지 톤",
    beige: "베이지 톤",
    "medium layer": "중간 길이 레이어",
    "medium layers": "중간 길이 레이어",
    layer: "레이어",
    "light top volume": "가벼운 윗볼륨",
    "controlled sides": "정돈된 사이드",
    "forehead opening": "이마 노출",
    peach: "피치",
    coral: "코랄",
    taupe: "토프",
    cream: "크림",
    "neutral beige": "뉴트럴 베이지",
    "soft brown": "부드러운 브라운",
    "soft gray": "부드러운 그레이",
    "soft pink": "부드러운 핑크",
    "soft lavender": "연한 라벤더",
    "clean makeup": "깔끔한 메이크업",
    "compact balanced line": "컴팩트 균형형 얼굴선",
    wolf: "늑대상",
    "wolf-like": "늑대상",
    cat: "고양이상",
    "cat-like": "고양이상",
    deer: "사슴상",
    "deer-like": "사슴상",
    puppy: "강아지상",
    "puppy-like": "강아지상",
    rabbit: "토끼상",
    "rabbit-like": "토끼상",
    "rabbit-like mood": "토끼상",
    fox: "여우상",
    "fox-like": "여우상",
    "fox-like mood": "여우상",
    "wolf-like mood": "늑대상",
    "cat-like mood": "고양이상",
    "deer-like mood": "사슴상",
    "puppy-like mood": "강아지상",
    "soft tofu-like": "두부상",
    "soft tofu-like mood": "두부상"
  },
  en: {
    "balanced oval": "balanced oval face line",
    "soft oval": "soft oval face line",
    oval: "oval face line",
    round: "rounded face line",
    "soft beige": "soft beige tone",
    beige: "beige tone",
    "medium layer": "medium-length layers",
    "medium layers": "medium-length layers",
    layer: "layers",
    "light top volume": "light top volume",
    "controlled sides": "controlled side line",
    "forehead opening": "forehead opening",
    peach: "peach tone",
    coral: "coral tone",
    taupe: "taupe tone",
    cream: "cream tone",
    "neutral beige": "neutral beige tone",
    "soft brown": "soft brown tone",
    "soft gray": "soft gray tone",
    "soft pink": "soft pink tone",
    "soft lavender": "soft lavender tone",
    "clean makeup": "clean makeup",
    "compact balanced line": "compact balanced face line",
    wolf: "wolf-like mood",
    "wolf-like": "wolf-like mood",
    cat: "cat-like mood",
    "cat-like": "cat-like mood",
    deer: "deer-like mood",
    "deer-like": "deer-like mood",
    puppy: "puppy-like mood",
    "puppy-like": "puppy-like mood",
    rabbit: "rabbit-like mood",
    "rabbit-like": "rabbit-like mood",
    "rabbit-like mood": "rabbit-like mood",
    fox: "fox-like mood",
    "fox-like": "fox-like mood",
    "fox-like mood": "fox-like mood",
    "wolf-like mood": "wolf-like mood",
    "cat-like mood": "cat-like mood",
    "deer-like mood": "deer-like mood",
    "puppy-like mood": "puppy-like mood",
    "soft tofu-like": "soft tofu-like mood",
    "soft tofu-like mood": "soft tofu-like mood"
  }
};

const FACE_LAB_DISPLAY_TOKEN_KEYS = Object.keys(FACE_LAB_DISPLAY_TOKEN_LABELS.ko)
  .sort((left, right) => right.length - left.length);

function normalizeFaceLabToken(value) {
  return cleanText(value).toLowerCase().replace(/[_-]+/g, " ");
}

export function formatFaceLabDisplayText(value, locale = "ko") {
  const text = cleanText(value);

  if (!text) {
    return "";
  }

  const labels = FACE_LAB_DISPLAY_TOKEN_LABELS[locale] || FACE_LAB_DISPLAY_TOKEN_LABELS.ko;
  const exact = labels[normalizeFaceLabToken(text)];

  if (exact) {
    return exact;
  }

  let output = text;

  FACE_LAB_DISPLAY_TOKEN_KEYS.forEach((token) => {
    const label = labels[token] || FACE_LAB_DISPLAY_TOKEN_LABELS.ko[token];
    if (!label) {
      return;
    }

    const tokenPattern = token
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\s+/g, "[\\s_-]+");
    const pattern = new RegExp(`\\b${tokenPattern}\\b`, "gi");
    output = output.replace(pattern, label);
  });

  if (locale !== "en" && /^[a-z][a-z\s_-]{1,40}$/i.test(output)) {
    return "사진 기준 스타일 무드";
  }

  return cleanText(output);
}

export function formatFaceLabDisplayList(values = [], locale = "ko", limit = 10) {
  return unique(compactList(values, limit).map((item) => formatFaceLabDisplayText(item, locale))).filter(Boolean);
}

function compactList(values, limit = 4) {
  return Array.isArray(values)
    ? values.map((item) => cleanText(item)).filter(Boolean).slice(0, limit)
    : [];
}

function unique(values) {
  return [...new Set(values.map((item) => cleanText(item)).filter(Boolean))];
}

function hasActionCue(value) {
  const text = cleanText(value).toLowerCase();
  return /(이마|앞머리|옆머리|사이드|볼륨|턱선|하관|길이|레이어|가르마|컬러|채도|대비|정리|드러내|줄이|피하|forehead|bang|side|volume|jaw|layer|part|color|tone|avoid|keep|reduce|open|lift)/i.test(text);
}

function isWeakLine(value) {
  const text = cleanText(value);
  const lower = text.toLowerCase();

  if (!text) {
    return true;
  }

  const blockedPhrases = [
    "리더형",
    "제어형",
    "판단형",
    "성격",
    "운세",
    "매력적",
    "객관적",
    "친근한 인상",
    "personality",
    "leader",
    "controlled",
    "decision-first",
    "fortune",
    "attractiveness",
    "celebrity",
    "lookalike",
    "look-alike"
  ];

  return blockedPhrases.some((phrase) => lower.includes(phrase.toLowerCase()));
}

function isActionLine(value) {
  return !isWeakLine(value) && hasActionCue(value);
}

function normalizeKeyword(value) {
  return cleanText(value)
    .replace(/[^\p{L}\p{N}\s/&+-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isWeakKeyword(value) {
  const keyword = normalizeKeyword(value).toLowerCase();

  if (!keyword) {
    return true;
  }

  const blocked = new Set([
    "리더형",
    "제어형",
    "판단형",
    "집중형",
    "선명한 판단형",
    "focused",
    "leader",
    "controlled",
    "decision",
    "decision-first",
    "personality",
    "structured"
  ]);

  return blocked.has(keyword) || keyword.length <= 1;
}

const FACE_MOOD_TYPES = [
  "여우상",
  "고양이상",
  "강아지상",
  "토끼상",
  "늑대상",
  "공룡상",
  "두부상",
  "사슴상",
  "햄스터상"
];

const FACE_MOOD_TYPE_LABELS_EN = {
  여우상: "Fox-like",
  고양이상: "Cat-like",
  강아지상: "Puppy-like",
  토끼상: "Rabbit-like",
  늑대상: "Wolf-like",
  공룡상: "Dinosaur-like",
  두부상: "Soft tofu-like",
  사슴상: "Deer-like",
  햄스터상: "Hamster-like"
};

function localizeFaceMoodType(value, locale = "ko") {
  return locale === "en" ? FACE_MOOD_TYPE_LABELS_EN[value] || value : value;
}

const COLOR_LABELS_EN = [
  { pattern: /파스텔\s*핑크|pastel pink/i, label: "pastel pink" },
  { pattern: /연한\s*라벤더|라벤더|lavender/i, label: "soft lavender" },
  { pattern: /크림|cream/i, label: "cream" },
  { pattern: /피치|peach/i, label: "peach" },
  { pattern: /코랄|coral/i, label: "coral" },
  { pattern: /베이지|beige/i, label: "soft beige" },
  { pattern: /토프|taupe/i, label: "taupe" },
  { pattern: /뉴트럴|neutral/i, label: "neutral beige" },
  { pattern: /브라운|brown/i, label: "soft brown" },
  { pattern: /그레이|gray|grey/i, label: "soft gray" },
  { pattern: /핑크|pink/i, label: "soft pink" },
  { pattern: /레드|red/i, label: "soft red" }
];

function localizeColorLabel(value, locale = "ko") {
  const text = cleanText(value);

  if (locale !== "en") {
    return formatFaceLabDisplayText(text, locale);
  }

  const matched = COLOR_LABELS_EN.find((item) => item.pattern.test(text));
  return formatFaceLabDisplayText(matched?.label || (hasKoreanText(text) ? "" : text), locale);
}

function localizePalette(values = [], locale = "ko", limit = 4) {
  return unique(compactList(values, limit).map((item) => localizeColorLabel(item, locale))).filter(Boolean);
}

function englishSafeLine(value) {
  const text = cleanText(value);
  return text && !hasKoreanText(text) ? text : "";
}

function buildEnglishHairRecommendationFromText(value, fallback) {
  const text = cleanText(value);

  if (!text) {
    return fallback.directionRecommended[0];
  }
  if (/앞머리|bang|fringe/i.test(text)) {
    return "For hair, keep fringe light enough to soften the impression without closing the upper face.";
  }
  if (/옆|사이드|볼륨|side|volume/i.test(text)) {
    return "For hair, keep the side line controlled so the face does not spread wider than needed.";
  }
  if (/턱|하관|jaw|lower/i.test(text)) {
    return "For hair, keep the lower-face line light so the jaw and neckline stay clean.";
  }
  if (/레이어|layer/i.test(text)) {
    return "For hair, use soft layers to keep the outline light rather than heavy.";
  }

  return englishSafeLine(text) || fallback.directionRecommended[0];
}

function buildEnglishHairAvoidFromText(value, fallback) {
  const text = cleanText(value);

  if (!text) {
    return fallback.directionAvoid[0];
  }
  if (/짧|short/i.test(text)) {
    return "Avoid cuts that are too short if they make the outline feel harsher than the face needs.";
  }
  if (/앞머리|bang|fringe/i.test(text)) {
    return "Avoid heavy full bangs that close off the upper face.";
  }
  if (/옆|사이드|볼륨|side|volume/i.test(text)) {
    return "Avoid wide side volume that spreads the face outward.";
  }
  if (/턱|하관|jaw|lower/i.test(text)) {
    return "Avoid heavy lower-face coverage that hides the jaw and neckline.";
  }

  return englishSafeLine(text) || fallback.directionAvoid[0];
}

function buildEnglishColorAvoidFromText(value, fallback) {
  const text = cleanText(value);

  if (!text) {
    return fallback.directionAvoid[1];
  }
  if (/원색|강한|대비|contrast|차갑|cold/i.test(text)) {
    return "Avoid strong primary colors or cold high-contrast combinations over a large area.";
  }
  if (/채도|chroma|saturation|쨍/i.test(text)) {
    return "Avoid high-chroma color blocks that arrive before the face structure.";
  }

  return englishSafeLine(text) || fallback.directionAvoid[1];
}

function getFallback(locale = "ko") {
  if (locale === "en") {
    return {
      teaserLine: "Because the impression reads clear and soft, a lighter top line with controlled side volume works better.",
      faceMood: {
        primary: "Cat-like",
        secondary: ["Rabbit-like", "Soft tofu-like"],
        keywords: ["light top volume", "peach", "coral", "controlled sides"],
        impression: "Clear and soft mood with eye focus"
      },
      structureContent: [
        "The face reads with a softer curve first, so overly sharp angles can feel heavier than a clean rounded flow.",
        "Attention gathers around the forehead and eye area, which makes the upper line an important balance point.",
        "The jaw reads steadier when the lower silhouette stays light instead of closing the face at once.",
        "The center line gathers inward, so too much side width can scatter the overall face flow."
      ],
      directionRecommended: [
        "For hair, keep light space at the upper line and control the width around the sides.",
        "For color, muted neutrals such as soft beige or taupe support the face before the color arrives.",
        "For makeup, keep skin and eye contrast clean instead of making every line stronger."
      ],
      directionAvoid: [
        "Avoid pairing heavy full bangs with wide side volume.",
        "Avoid large areas of high-chroma color or cold, high-contrast combinations.",
        "Avoid makeup contrast that hardens the outline more than the features need."
      ],
      guideBaseSetup: [
        "Start by keeping the upper line from feeling blocked, then control side width before adding detail.",
        "Use the lowest-chroma palette color as the base and keep the accent to one feature."
      ],
      guideCards: [
        {
          label: "Casual",
          body: "Use natural texture with only light top lift. Finish the sides narrow enough that they do not spread the face outward."
        },
        {
          label: "Clean",
          body: "Tidy the line around the ears and keep the skin semi-matte. Stay within beige or taupe tones for color."
        },
        {
          label: "Formal",
          body: "Define the part and neckline while keeping the lower face from looking closed. Place color emphasis on either the eyes or lips."
        }
      ],
      avoidKeywords: ["heavy bangs", "wide side volume", "strong contrast", "high chroma"],
      keywords: [
        "forehead opening",
        "controlled sides",
        "medium layers",
        "peach",
        "coral",
        "light top volume",
        "soft beige",
        "clean makeup"
      ],
      moodInterpretation: [
        "The primary mood is read as a cat-like style mood because the eye area gives the clearest visual focus.",
        "The line is not overly sharp, so rabbit-like and tofu-like softness balance the main mood.",
        "This works best with peach, coral, and beige tones rather than strong contrast.",
        "Heavy bangs or wide side volume can hide the clear, fresh impression."
      ]
    };
  }

  return {
    teaserLine: "맑고 부드러운 인상이 먼저 보여, 윗선은 가볍게 열고 옆라인은 자연스럽게 정리하는 스타일이 잘 맞습니다.",
    faceMood: {
      primary: "고양이상",
      secondary: ["토끼상", "두부상"],
      keywords: ["가벼운 윗볼륨", "피치", "코랄", "정돈된 사이드"],
      impression: "맑고 부드러운 인상, 눈매 중심"
    },
    structureContent: [
      "얼굴선은 직선보다 부드러운 곡선 흐름이 먼저 보여 강한 각보다 완만한 정리가 자연스럽습니다.",
      "이마와 눈매 쪽에 시선 중심이 모여 상단이 답답하면 전체 인상이 무거워질 수 있습니다.",
      "턱선은 날카롭게 끊기기보다 가볍게 이어질 때 하관 비율이 안정적으로 보입니다.",
      "중심선이 안쪽으로 모이는 편이라 양옆 폭이 커지면 얼굴 흐름이 분산되어 보일 수 있습니다."
    ],
    directionRecommended: [
      "헤어는 상단에 가벼운 여백을 두고 측면 폭을 정돈하는 방향이 안정적입니다.",
      "컬러는 소프트 베이지나 토프처럼 낮은 채도의 뉴트럴 계열이 얼굴 구조를 받쳐줍니다.",
      "메이크업은 선을 강하게 키우기보다 피부와 눈매 대비를 깨끗하게 맞추는 편이 좋습니다."
    ],
    directionAvoid: [
      "헤어는 무거운 풀뱅과 넓은 옆볼륨을 동시에 만드는 조합을 줄입니다.",
      "컬러는 고채도 원색이나 차갑고 강한 대비 조합을 넓은 면적으로 쓰지 않습니다.",
      "메이크업은 윤곽 대비를 세게 만들기보다 경계를 부드럽게 남기는 편이 안전합니다."
    ],
    guideBaseSetup: [
      "기본 세팅은 상단을 답답하게 막지 않고 측면 폭을 먼저 정돈하는 흐름으로 잡습니다.",
      "컬러는 팔레트 중 가장 낮은 채도의 색을 베이스로 두고 포인트는 한 곳만 선택합니다."
    ],
    guideCards: [
      {
        label: "캐주얼",
        body: "자연스러운 질감에 윗볼륨만 가볍게 살립니다. 옆선은 손으로 눌러 폭이 커지지 않는 정도로 마무리하세요."
      },
      {
        label: "클린",
        body: "귀 주변 라인을 정리하고 피부 표현은 세미매트로 맞춥니다. 색조는 베이지/토프 계열 안에서 차분하게 정리하세요."
      },
      {
        label: "포멀",
        body: "가르마와 목선을 또렷하게 정리하고 하관 주변은 무겁게 닫지 않습니다. 컬러 포인트는 입술이나 눈 중 한 곳만 둡니다."
      }
    ],
    avoidKeywords: ["무거운 앞머리", "넓은 옆볼륨", "강한 대비", "고채도 컬러"],
    keywords: [
      "이마 노출",
      "정돈된 사이드",
      "미디엄 레이어",
      "가벼운 윗볼륨",
      "피치",
      "코랄",
      "소프트 베이지",
      "클린 메이크업"
    ],
    moodInterpretation: [
      "대표 무드는 눈매에 시선이 먼저 모이는 고양이상 계열의 스타일 무드로 잡힙니다.",
      "다만 얼굴선이 과하게 날카롭기보다 부드러워서 토끼상/두부상 느낌이 함께 섞입니다.",
      "그래서 강한 대비보다 피치, 코랄, 베이지 계열처럼 부드러운 색이 안정적입니다.",
      "너무 무거운 앞머리나 넓은 옆볼륨은 맑은 인상을 가릴 수 있습니다."
    ]
  };
}

function textMatches(value, patterns) {
  const text = cleanText(value);
  return patterns.some((pattern) => pattern.test(text));
}

function collectTextValues(value) {
  if (!value) {
    return [];
  }

  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectTextValues(item));
  }

  if (typeof value === "object") {
    return Object.values(value).flatMap((item) => collectTextValues(item));
  }

  return [];
}

function firstUsableLine(lines, patterns = []) {
  return compactList(lines, 8).find((line) => {
    if (isWeakLine(line)) {
      return false;
    }

    return !patterns.length || textMatches(line, patterns);
  }) || "";
}

function buildStructureContent(faceLab, fallback, locale = "ko") {
  const featureLines = faceLab?.features?.physiognomy?.feature_based_interpretation || [];
  const landmarks = compactList(faceLab?.base_data?.landmarks, 4);
  const faceShape = cleanText(faceLab?.base_data?.face_shape);
  const faceSummary = cleanText(faceLab?.features?.face_shape_hairstyle?.summary);
  const structuralPatterns = [
    /얼굴|윤곽|중심|이마|눈|턱|하관|비율|입선|face|contour|center|forehead|eye|jaw|ratio|mouth|lower/i
  ];
  const styleInstructionPattern = /헤어|스타일|컬러|메이크업|가르마|레이어|앞머리|볼륨|hair|style|color|makeup|part|layer|bang|volume/i;
  const landmarkLines = landmarks.map((item) =>
    locale === "en"
      ? `${item} is one of the visible structure cues used for this report.`
      : `${item}이 이번 얼굴 구조 해석의 관찰 포인트입니다.`
  ).filter((item) => locale !== "en" || !hasKoreanText(item));
  const displayFaceShape = formatFaceLabDisplayText(faceShape, locale);
  const shapeLine = displayFaceShape
    ? locale === "en"
      ? hasKoreanText(displayFaceShape)
        ? ""
        : `${displayFaceShape} is the face-shape cue used as the base for this read.`
      : `${displayFaceShape} 흐름을 기준으로 얼굴선의 균형을 읽었습니다.`
    : "";
  const structuralSummary =
    faceSummary && (locale !== "en" || !hasKoreanText(faceSummary)) && !styleInstructionPattern.test(faceSummary) && textMatches(faceSummary, structuralPatterns)
      ? faceSummary
      : "";
  const structuralLine = firstUsableLine(featureLines, structuralPatterns);

  return unique([
    structuralSummary,
    locale === "en" && hasKoreanText(structuralLine) ? "" : structuralLine,
    shapeLine,
    ...landmarkLines,
    ...fallback.structureContent
  ]).slice(0, 4);
}

function buildColorDirection(faceLab, fallback, locale = "ko") {
  const palette = compactList(faceLab?.features?.color_tone_recommendation?.palette, 3);
  const colorLine = firstUsableLine([
    ...(faceLab?.features?.color_tone_recommendation?.recommendations || []),
    faceLab?.features?.color_tone_recommendation?.summary
  ]);

  if (palette.length) {
    const localizedPalette = localizePalette(palette, locale, 3);
    return locale === "en"
      ? localizedPalette.length
        ? `For color, keep ${localizedPalette.join(", ")} as the base before adding stronger accents.`
        : fallback.directionRecommended[1]
      : `컬러는 ${localizedPalette.join(", ")}처럼 얼굴보다 먼저 튀지 않는 톤을 베이스로 잡습니다.`;
  }

  return locale === "en" ? englishSafeLine(colorLine) || fallback.directionRecommended[1] : colorLine || fallback.directionRecommended[1];
}

function buildDirectionRecommended(faceLab, fallback, locale = "ko") {
  const hairLine = firstUsableLine(faceLab?.features?.face_shape_hairstyle?.recommendations || [], [
    /이마|앞머리|옆|사이드|볼륨|턱선|하관|레이어|가르마|forehead|bang|side|volume|jaw|layer|part/i
  ]);

  return unique([
    locale === "en" ? buildEnglishHairRecommendationFromText(hairLine, fallback) : hairLine || fallback.directionRecommended[0],
    buildColorDirection(faceLab, fallback, locale),
    fallback.directionRecommended[2]
  ]).slice(0, 3);
}

function buildDirectionAvoid(faceLab, fallback, locale = "ko") {
  const hairAvoid = firstUsableLine(faceLab?.features?.face_shape_hairstyle?.avoid || []);
  const colorAvoid = firstUsableLine(faceLab?.features?.color_tone_recommendation?.avoid || []);

  return unique([
    locale === "en" ? buildEnglishHairAvoidFromText(hairAvoid, fallback) : hairAvoid || fallback.directionAvoid[0],
    locale === "en" ? buildEnglishColorAvoidFromText(colorAvoid, fallback) : colorAvoid || fallback.directionAvoid[1],
    fallback.directionAvoid[2]
  ]).slice(0, 3);
}

function buildGuideBaseSetup(faceLab, fallback, locale = "ko") {
  const palette = compactList(faceLab?.features?.color_tone_recommendation?.palette, 2);
  const localizedPalette = localizePalette(palette, locale, 2);
  const paletteLine = palette.length
    ? locale === "en"
      ? localizedPalette.length
        ? `Use ${localizedPalette[0]} as the base tone, then keep ${localizedPalette[1] || localizedPalette[0]} as a small accent.`
        : fallback.guideBaseSetup[1]
      : `${localizedPalette[0]}을 베이스 톤으로 두고 ${localizedPalette[1] || localizedPalette[0]}은 작은 포인트로만 씁니다.`
    : fallback.guideBaseSetup[1];

  return unique([fallback.guideBaseSetup[0], paletteLine]).slice(0, 2);
}

function buildStyleKeywords(faceLab, fallback, locale = "ko") {
  const explicit = compactList(faceLab?.paid?.styleKeywords || faceLab?.styleKeywords, 10);
  const palette = localizePalette(faceLab?.features?.color_tone_recommendation?.palette, locale, 4);
  const recommendationKeywords = compactList(faceLab?.features?.face_shape_hairstyle?.recommendations, 4)
    .flatMap((item) => {
      const text = cleanText(item);
      const keywords = [];

      if (/이마|forehead/i.test(text)) {
        keywords.push(locale === "en" ? "forehead opening" : "이마 노출");
      }
      if (/사이드|옆|side/i.test(text)) {
        keywords.push(locale === "en" ? "controlled sides" : "정돈된 사이드");
      }
      if (/레이어|layer/i.test(text)) {
        keywords.push(locale === "en" ? "medium layers" : "미디엄 레이어");
      }
      if (/볼륨|volume/i.test(text)) {
        keywords.push(locale === "en" ? "light top volume" : "가벼운 윗볼륨");
      }

      return keywords;
    });

  return unique([
    ...explicit.map((item) => formatFaceLabDisplayText(item, locale)).filter(Boolean),
    ...recommendationKeywords,
    ...palette,
    ...fallback.keywords
  ])
    .map(normalizeKeyword)
    .filter((item) => !isWeakKeyword(item))
    .filter((item) => locale !== "en" || !hasKoreanText(item))
    .slice(0, 8);
}

function buildAvoidKeywords(faceLab, fallback, locale = "ko") {
  const avoidText = collectTextValues([
    faceLab?.features?.face_shape_hairstyle?.avoid,
    faceLab?.features?.color_tone_recommendation?.avoid
  ]).join(" ");
  const items = [];

  if (/앞머리|뱅|bang/i.test(avoidText)) {
    items.push(locale === "en" ? "heavy bangs" : "무거운 앞머리");
  }
  if (/옆|사이드|볼륨|side|volume/i.test(avoidText)) {
    items.push(locale === "en" ? "wide side volume" : "넓은 옆볼륨");
  }
  if (/대비|contrast/i.test(avoidText)) {
    items.push(locale === "en" ? "strong contrast" : "강한 대비");
  }
  if (/채도|chroma|saturation/i.test(avoidText)) {
    items.push(locale === "en" ? "high chroma" : "고채도 컬러");
  }

  return unique([...items, ...fallback.avoidKeywords]).slice(0, 4);
}

function buildFaceLine(faceLab, fallback, locale = "ko") {
  const text = [
    cleanText(faceLab?.base_data?.face_shape),
    ...collectTextValues(faceLab?.base_data?.landmarks),
    cleanText(faceLab?.features?.face_shape_hairstyle?.summary)
  ].join(" ");

  if (/soft|oval|round|curve|곡선|부드|완만|라운드/i.test(text)) {
    return locale === "en" ? "Soft curved line" : "부드러운 곡선형";
  }
  if (/structured|balanced|defined|clear|sharp|선명|또렷|분명|균형|정돈/i.test(text)) {
    return locale === "en" ? "Clean balanced line" : "정돈된 균형형";
  }
  if (/long|vertical|세로/i.test(text)) {
    return locale === "en" ? "Vertical-centered line" : "세로 중심형";
  }
  if (/short|compact|짧|컴팩트/i.test(text)) {
    return locale === "en" ? "Compact balanced line" : "컴팩트 균형형";
  }

  const rawFaceShape = formatFaceLabDisplayText(faceLab?.base_data?.face_shape, locale);
  return locale === "en"
    ? englishSafeLine(rawFaceShape) || "Soft curved line"
    : rawFaceShape || "부드러운 곡선형";
}

function buildFocusPoint(faceLab, fallback, locale = "ko") {
  const text = collectTextValues([faceLab?.base_data, faceLab?.features]).join(" ");
  const points = [];

  if (/이마|윗선|forehead|upper|top line/i.test(text)) {
    points.push(locale === "en" ? "Forehead" : "이마");
  }
  if (/눈|눈매|시선|eye|brow|gaze/i.test(text)) {
    points.push(locale === "en" ? "Eyes" : "눈매");
  }
  if (/중심|center|central/i.test(text)) {
    points.push(locale === "en" ? "Center line" : "중심선");
  }
  if (/턱|하관|jaw|lower/i.test(text)) {
    points.push(locale === "en" ? "Jawline" : "턱선");
  }
  if (/입선|mouth/i.test(text)) {
    points.push(locale === "en" ? "Mouth line" : "입선");
  }

  return unique(points).slice(0, 2).join(" / ") || (locale === "en" ? "Forehead / Eyes" : "이마 / 눈매");
}

function pickFaceMoodTypes(faceLab, locale = "ko") {
  const text = collectTextValues([faceLab?.base_data, faceLab?.features]).join(" ").toLowerCase();
  const has = (pattern) => pattern.test(text);
  let primary = "고양이상";
  let secondary = ["토끼상", "두부상"];

  if (has(/fox|여우|날렵|슬림|sharp|선명|또렷|입선/)) {
    primary = "여우상";
    secondary = ["고양이상", "사슴상"];
  }

  if (has(/cat|고양이|눈매|시선|eye|gaze|집중/)) {
    primary = "고양이상";
    secondary = has(/soft|부드|완만|round|curve|곡선/) ? ["토끼상", "두부상"] : ["여우상", "사슴상"];
  }

  if (has(/warm|open|friendly|puppy|강아지|열린|친화|입꼬리/)) {
    primary = "강아지상";
    secondary = ["토끼상", "햄스터상"];
  }

  if (has(/rabbit|토끼|soft|부드|완만|round|curve|곡선/)) {
    primary = primary === "고양이상" && has(/눈매|eye|gaze|시선/) ? "고양이상" : "토끼상";
    secondary = primary === "고양이상" ? ["토끼상", "두부상"] : ["두부상", "강아지상"];
  }

  if (has(/wolf|늑대|strong|defined|jaw|턱선|하관|강한|진한/)) {
    primary = has(/soft|부드|완만/) ? primary : "늑대상";
    secondary = primary === "늑대상" ? ["고양이상", "여우상"] : secondary;
  }

  if (has(/dino|공룡|structured|구조|단단|bone|골격/)) {
    primary = primary === "고양이상" || primary === "늑대상" ? primary : "공룡상";
    secondary = primary === "공룡상" ? ["늑대상", "고양이상"] : secondary;
  }

  if (has(/tofu|두부|clear|clean|담백|맑|low contrast|낮은 대비/)) {
    secondary = unique(["두부상", ...secondary]).filter((item) => item !== primary).slice(0, 2);
  }

  if (has(/deer|사슴|long|vertical|세로|차분/)) {
    secondary = unique(["사슴상", ...secondary]).filter((item) => item !== primary).slice(0, 2);
  }

  return {
    primary: FACE_MOOD_TYPES.includes(primary) ? primary : "고양이상",
    secondary: secondary.filter((item) => FACE_MOOD_TYPES.includes(item) && item !== primary).slice(0, 2)
  };
}

function buildFaceMoodKeywords(faceLab, fallback, locale = "ko") {
  const keywords = buildStyleKeywords(faceLab, fallback, locale);
  const normalizedPaletteKeywords = keywords.map((keyword) => {
    const text = cleanText(keyword).toLowerCase();

    if (/peach|피치/.test(text)) {
      return locale === "en" ? "peach" : "피치";
    }
    if (/coral|코랄/.test(text)) {
      return locale === "en" ? "coral" : "코랄";
    }
    if (/beige|베이지/.test(text)) {
      return locale === "en" ? "soft beige" : "소프트 베이지";
    }
    if (/lavender|라벤더/.test(text)) {
      return locale === "en" ? "soft lavender" : "연한 라벤더";
    }
    if (/cream|크림/.test(text)) {
      return locale === "en" ? "cream" : "크림";
    }
    if (/pink|핑크/.test(text)) {
      return locale === "en" ? "soft pink" : "핑크";
    }

    return formatFaceLabDisplayText(keyword, locale);
  });

  return unique([
    ...fallback.faceMood.keywords,
    ...normalizedPaletteKeywords,
    ...fallback.keywords
  ])
    .filter((item) => locale !== "en" || !hasKoreanText(item))
    .slice(0, 8);
}

function buildFaceMoodImpression(faceLab, moodTypes, fallback, locale = "ko") {
  const focusPoint = buildFocusPoint(faceLab, { faceMood: {} }, locale);
  const text = collectTextValues([faceLab?.base_data, faceLab?.features]).join(" ");
  const hasSoft = /soft|부드|완만|round|curve|곡선|맑|clear|clean|담백/i.test(text);
  const hasDefined = /sharp|defined|strong|선명|또렷|분명|진한|턱선/i.test(text);

  if (!text.trim()) {
    return fallback.faceMood.impression;
  }

  if (locale === "en") {
    if (moodTypes.primary === "늑대상") {
      return "Defined line mood with a clean lower-face focus";
    }
    if (moodTypes.primary === "강아지상") {
      return "Open and warm mood with soft expression focus";
    }
    if (moodTypes.primary === "토끼상") {
      return "Soft and fresh mood with gentle facial lines";
    }

    return `${hasDefined ? "Clear" : "Fresh"}${hasSoft ? " and soft" : ""} mood, ${focusPoint || "eye"} focus`;
  }

  if (moodTypes.primary === "늑대상") {
    return "선이 진하고 정돈된 인상, 하관 중심";
  }
  if (moodTypes.primary === "강아지상") {
    return "열려 있고 부드러운 인상, 표정 중심";
  }
  if (moodTypes.primary === "토끼상") {
    return "맑고 부드러운 인상, 완만한 얼굴선 중심";
  }

  const tone = hasSoft ? (hasDefined ? "또렷하고 부드러운" : "맑고 부드러운") : hasDefined ? "또렷한" : "맑은";

  return `${tone} 인상, ${focusPoint || "눈매"} 중심`;
}

function buildFaceMood(faceLab, fallback, locale = "ko") {
  const moodTypes = pickFaceMoodTypes(faceLab, locale);

  return {
    primary: localizeFaceMoodType(moodTypes.primary, locale),
    secondary: moodTypes.secondary.length
      ? moodTypes.secondary.map((item) => localizeFaceMoodType(item, locale))
      : fallback.faceMood.secondary,
    keywords: buildFaceMoodKeywords(faceLab, fallback, locale),
    impression: buildFaceMoodImpression(faceLab, moodTypes, fallback, locale)
  };
}

function buildMoodInterpretation(faceLab, fallback, faceMood, locale = "ko") {
  const secondaryText = faceMood.secondary.join(locale === "en" ? " / " : "/");
  const keywords = faceMood.keywords.slice(0, 4);

  if (locale === "en") {
    return [
      `The primary mood is read as a ${faceMood.primary} style mood because the most visible focus gathers around the features rather than overall width.`,
      `The secondary ${secondaryText} mood softens the main read so it does not feel too sharp or heavy.`,
      `This mood works well with ${keywords.join(", ")} because the styling stays clear without overpowering the face.`,
      "Heavy bangs, wide side volume, or strong contrast can cover the fresh impression."
    ];
  }

  return [
    `대표 무드는 ${faceMood.impression.includes("눈매") ? "눈매 중심의 " : ""}${faceMood.primary} 계열의 스타일 무드로 잡힙니다.`,
    `다만 전체 결이 한쪽으로만 강하지 않아 ${secondaryText} 느낌이 보완 무드로 섞입니다.`,
    `이 무드에서는 ${keywords.join(", ")}처럼 가볍고 정돈된 방향이 잘 맞습니다.`,
    "너무 무거운 앞머리, 넓은 옆볼륨, 강한 대비는 맑은 인상 흐름을 가릴 수 있습니다."
  ];
}

function buildFaceLabSections(faceLab, locale = "ko") {
  const fallback = getFallback(locale);
  const faceMood = buildFaceMood(faceLab, fallback, locale);

  return [
    {
      id: "structure",
      label: locale === "en" ? "Face Structure" : "얼굴 구조 정리",
      title: locale === "en" ? "Face Structure" : "얼굴 구조 정리",
      content: buildStructureContent(faceLab, fallback, locale)
    },
    {
      id: "direction",
      label: locale === "en" ? "Style Direction" : "스타일 방향",
      title: locale === "en" ? "Style Direction" : "스타일 방향",
      recommended: buildDirectionRecommended(faceLab, fallback, locale),
      avoid: buildDirectionAvoid(faceLab, fallback, locale)
    },
    {
      id: "guide",
      label: locale === "en" ? "Practical Guide" : "실전 적용 가이드",
      title: locale === "en" ? "Practical Guide" : "실전 적용 가이드",
      baseSetup: buildGuideBaseSetup(faceLab, fallback, locale),
      cards: fallback.guideCards
    },
    {
      id: "mood",
      label: locale === "en" ? "Mood Read" : "무드 해석",
      title: locale === "en" ? "Mood Read" : "무드 해석",
      content: buildMoodInterpretation(faceLab, fallback, faceMood, locale)
    }
  ];
}

function buildFaceLabSummary(faceLab, sections, locale = "ko") {
  const fallback = getFallback(locale);
  const keywords = buildFaceMoodKeywords(faceLab, fallback, locale);
  const avoidKeywords = buildAvoidKeywords(faceLab, fallback, locale);

  return {
    faceLine: buildFaceLine(faceLab, fallback, locale),
    focusPoint: buildFocusPoint(faceLab, fallback, locale),
    recommendedDirection: unique([...keywords, ...fallback.keywords]).slice(0, 3).join(" · "),
    avoidDirection: unique([...avoidKeywords, ...fallback.avoidKeywords]).slice(0, 3).join(" · ")
  };
}

function buildLegacySteps(sections) {
  const byId = Object.fromEntries(sections.map((section) => [section.id, section]));
  const structure = byId.structure || {};
  const direction = byId.direction || {};
  const guide = byId.guide || {};
  const mood = byId.mood || {};

  return [
    {
      step: 5,
      key: "face_structure",
      title: structure.title || structure.label,
      summary: Array.isArray(structure.content) ? structure.content[0] || "" : "",
      bullets: Array.isArray(structure.content) ? structure.content.slice(1, 4) : []
    },
    {
      step: 6,
      key: "style_direction",
      title: direction.title || direction.label,
      recommended: Array.isArray(direction.recommended) ? direction.recommended : [],
      avoid: Array.isArray(direction.avoid) ? direction.avoid : []
    },
    {
      step: 7,
      key: "practical_application",
      title: guide.title || guide.label,
      baseSetup: Array.isArray(guide.baseSetup) ? guide.baseSetup : [],
      variations: Array.isArray(guide.cards) ? guide.cards : [],
      cards: Array.isArray(guide.cards) ? guide.cards : []
    },
    {
      step: 8,
      key: "mood_interpretation",
      title: mood.title || mood.label,
      bullets: Array.isArray(mood.content) ? mood.content : []
    }
  ];
}

function buildFaceLabReportData(faceLab, locale = "ko") {
  const fallback = getFallback(locale);
  const faceMood = buildFaceMood(faceLab, fallback, locale);
  const sections = buildFaceLabSections(faceLab, locale);

  return {
    summary: buildFaceLabSummary(faceLab, sections, locale),
    faceMood,
    sections,
    steps: buildLegacySteps(sections)
  };
}

function buildFreeFaceLabTeaser(faceLab, reportData, fallback, locale = "ko") {
  const summary = reportData?.summary || {};
  const impression = cleanText(reportData?.faceMood?.impression || fallback.faceMood?.impression);
  const faceLine = cleanText(summary.faceLine);
  const focusPoint = cleanText(summary.focusPoint);
  const rawSourceText = collectTextValues([faceLab?.base_data, faceLab?.features]).join(" ");
  const sourceText = rawSourceText || [impression, faceLine, focusPoint].join(" ");

  if (locale === "en") {
    if (/jaw|lower|chin/i.test(sourceText)) {
      return "Because the lower face line reads defined, a lighter neckline works better than covering the jaw heavily.";
    }
    if (/soft|oval|round|curve|gentle/i.test(sourceText)) {
      return "Because the impression reads soft, light bangs and a natural side line fit better than a heavy outline.";
    }
    if (/forehead|upper|eye|gaze/i.test(sourceText)) {
      return "Because attention gathers around the upper face, an open top line with controlled sides fits better.";
    }
    if (/center|central|defined|clear|balanced|sharp/i.test(sourceText)) {
      return "Because the center line reads clearly, a cleaner top line feels steadier than wide side volume.";
    }

    return fallback.teaserLine;
  }

  if (/턱|하관/.test(sourceText)) {
    return "하관 라인이 보이는 편이라, 턱선을 무겁게 덮기보다 목선이 가볍게 이어지는 스타일이 안정적입니다.";
  }
  if (/부드|곡선|완만|라운드|맑/.test(sourceText)) {
    return "부드러운 인상이 강한 편이라, 가벼운 앞머리와 자연스러운 옆라인이 더 잘 맞습니다.";
  }
  if (/이마|눈매|윗선|시선/.test(sourceText)) {
    return "눈매와 윗선에 시선이 모이는 편이라, 앞은 가볍게 열고 옆라인은 정리하는 스타일이 잘 맞습니다.";
  }
  if (/중심선|정돈|또렷|선명|균형/.test(sourceText)) {
    return "얼굴 중심선이 또렷한 편이라, 옆볼륨보다 윗선이 정리되는 스타일이 더 안정적입니다.";
  }

  return fallback.teaserLine;
}

export function buildFaceLabLaunchData(faceLab, locale = "ko") {
  const fallback = getFallback(locale);
  const explicitTeaser = cleanText(faceLab?.free?.teaserLine || faceLab?.teaserLine);
  const reportData = buildFaceLabReportData(faceLab, locale);
  const generatedTeaser = buildFreeFaceLabTeaser(faceLab, reportData, fallback, locale);
  const teaserCandidate =
    explicitTeaser ||
    generatedTeaser ||
    compactList(faceLab?.features?.face_shape_hairstyle?.recommendations, 3).find(isActionLine);
  const structureSection = reportData.sections.find((section) => section.id === "structure") || {};
  const directionSection = reportData.sections.find((section) => section.id === "direction") || {};
  const guideSection = reportData.sections.find((section) => section.id === "guide") || {};

  return {
    free: {
      teaserLine: teaserCandidate || fallback.teaserLine
    },
    paid: {
      summary: reportData.summary,
      faceMood: reportData.faceMood,
      faceSummary: Array.isArray(structureSection.content) ? structureSection.content[0] || "" : "",
      hairDirections: Array.isArray(directionSection.recommended) ? directionSection.recommended : [],
      avoidStyles: Array.isArray(directionSection.avoid) ? directionSection.avoid : [],
      styleKeywords: Array.isArray(reportData.faceMood.keywords) ? reportData.faceMood.keywords : [],
      toneDirection: Array.isArray(guideSection.baseSetup) ? guideSection.baseSetup[1] || "" : "",
      reasoningLines: Array.isArray(structureSection.content) ? structureSection.content : [],
      practicalGuide: guideSection || null,
      sections: reportData.sections,
      steps: reportData.steps
    }
  };
}
