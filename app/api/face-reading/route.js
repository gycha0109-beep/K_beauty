import { NextResponse } from "next/server";
import { formatUploadSize, validateImageUpload } from "@/lib/upload-validation";
import { getOpenAiEnvDiagnostics, previewDiagnosticText, resolveOpenAiApiKey } from "@/lib/openai-env-diagnostics";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";
const FACE_READING_RESPONSE_SCHEMA_VERSION = 1;

const COPY = {
  ko: {
    errorNeedImage: "얼굴 사진이 필요합니다.",
    invalidImageType: "JPEG, PNG, WEBP 이미지만 업로드할 수 있습니다.",
    imageTooLarge: `이미지 용량은 ${formatUploadSize()} 이하만 업로드할 수 있습니다.`,
    parseError: "Face Lab 응답을 해석하지 못했습니다.",
    serverError: "Face Lab 처리 중 오류가 발생했습니다.",
    systemLanguage: "Output must be entirely in Korean.",
    instruction:
      "업로드된 얼굴 사진을 기준으로 Face Lab 결과를 작성해 주세요. 부분 가림, 과한 보정, 강한 스타일링이 있으면 그 한계를 짧게 반영하세요.",
    toneRule: "감성적인 칭찬보다 구조와 인상 흐름 중심으로 써 주세요.",
    fallback: {
      headlineLabel: "선명한 판단형",
      headlineResult: "중심선이 또렷하고 표현 제어가 강한 판단형 인상",
      overall:
        "이목구비의 중심축이 분명하고 하관 정리가 선명해, 반응보다 판단이 먼저 보이는 인상으로 읽힙니다.",
      axes: ["리더형", "집중형"],
      features: [
        "눈의 집중도가 높기 때문에 시선이 중앙으로 빨리 모이고, 판단이 먼저 보이는 인상으로 이어집니다.",
        "입선 제어가 보이기 때문에 감정보다 표현 조절이 먼저 보이고, 말수를 아끼는 인상으로 이어집니다.",
        "턱선 마감이 선명하기 때문에 방향성이 쉽게 흐트러지지 않고, 쉽게 흔들리지 않는 인상으로 이어집니다.",
        "얼굴 비율이 한쪽으로 치우치지 않기 때문에 기준이 안쪽에 모이고, 차분히 중심을 잡는 인상으로 이어집니다."
      ],
      tendency: [
        "실제로는 말을 많이 하기보다 필요할 때만 강도를 올리는 편으로 읽힐 가능성이 있습니다.",
        "관계에서는 먼저 밀어붙이기보다 흐름을 읽다가 기준이 생기면 주도권을 잡는 쪽으로 보일 수 있습니다."
      ],
      strengths: [
        "판단 속도와 표현 제어가 함께 보입니다.",
        "강한 압박보다 방향 제시가 먼저 보입니다.",
        "초반 반응보다 누적 인상에서 존재감이 커질 수 있습니다."
      ],
      cautions: [
        "표정 변화가 적으면 정서적 거리감으로 읽힐 수 있습니다.",
        "한 방향 집중이 강하면 주변 속도를 답답하게 느낄 수 있습니다."
      ],
      shapeSummary:
        "얼굴 중심선이 또렷하게 살아 있어 시선이 중앙에 모이고, 너무 무거운 스타일보다 정리된 실루엣이 더 잘 맞습니다.",
      shapeRecommendations: [
        "이마를 살짝 드러내는 구조이기 때문에 중심선이 살아나고, 정리된 사이드 파트가 잘 맞습니다.",
        "옆으로 크게 퍼지지 않는 구조이기 때문에 얼굴선이 덜 넓어 보이고, 정돈된 실루엣이 잘 맞습니다.",
        "턱선 아래로 너무 무겁지 않은 길이이기 때문에 하관이 흐려지지 않고, 미디엄 레이어가 잘 맞습니다."
      ],
      shapeAvoid: [
        "양옆을 크게 부푸는 구조이기 때문에 가로 폭이 먼저 커지고, 중심선이 흐려지는 스타일은 피하는 편이 좋습니다.",
        "무거운 일자 뱅 구조이기 때문에 눈매 노출이 줄어들고, 또렷한 인상이 약해지는 스타일은 피하는 편이 좋습니다."
      ],
      lookalikeSummary:
        "선이 정돈된 얼굴 구조와 하관의 정리감이 먼저 보여, 같은 남성 인상군 안에서 비교하는 편이 자연스럽습니다.",
      lookalikes: [
        {
          name: "차은우",
          reason:
            "차은우 : 중심선이 또렷하고 눈매와 하관 정리가 비슷하기 때문에 정돈된 남성 인상이 겹쳐 보입니다."
        },
        {
          name: "박서준",
          reason:
            "박서준 : 입선 제어와 하관 구조가 비슷하기 때문에 단정한 카리스마 인상이 닮아 보입니다."
        },
        {
          name: "이준호",
          reason:
            "이준호 : 눈의 집중도와 턱선 마감이 비슷하기 때문에 절제된 남성 인상으로 이어집니다."
        }
      ],
      colorSummary:
        "명도 대비가 과하지 않아 뉴트럴 계열이 먼저 받쳐주고, 과한 채도보다 정돈된 톤이 얼굴 구조를 더 살립니다.",
      palette: ["소프트 베이지", "토프", "뮤트 코랄", "스톤 그레이"],
      colorRecommendations: [
        "채도가 낮은 베이지 계열이기 때문에 중심선이 흐려지지 않고, 얼굴 구조가 더 정돈돼 보입니다.",
        "토프와 소프트 그레이가 들어가면 턱선과 시선 중심이 덜 흐트러지고, 구조가 더 또렷해 보입니다.",
        "과한 네온 톤보다 채도 낮은 포인트가 더 맞는 이유는 얼굴 구조가 먼저 살아나기 때문입니다."
      ],
      colorAvoid: [
        "채도가 높은 핑크 계열이기 때문에 색이 먼저 튀고, 얼굴 구조 해석이 약해질 수 있습니다.",
        "차갑고 극단적인 대비가 강하면 인상이 먼저 세져 보여, 사람보다 스타일이 먼저 보일 수 있습니다."
      ]
    }
  },
  en: {
    errorNeedImage: "A face photo is required.",
    invalidImageType: "Only JPEG, PNG, and WEBP images are allowed.",
    imageTooLarge: `Images must be ${formatUploadSize()} or smaller.`,
    parseError: "Could not parse the Face Lab response.",
    serverError: "Something went wrong while generating Face Lab.",
    systemLanguage: "Output must be entirely in English.",
    instruction:
      "Create a Face Lab result from the uploaded face photo. If the face is partly occluded, heavily edited, or strongly styled, briefly acknowledge that limit.",
    toneRule: "Write with structure and impression logic, not flattering copy.",
    fallback: {
      headlineLabel: "Sharp decision type",
      headlineResult: "A clear center line with controlled expression creates a decision-first impression",
      overall:
        "The facial center line reads clearly and the lower-face finish looks defined, so the face gives a judgment-first impression.",
      axes: ["Leader", "Focused"],
      features: [
        "The eyes look more concentrated than wide-open, so the visual center gathers faster, and the face reads as more decision-led.",
        "The mouth line looks controlled, so expression appears filtered first, and the face reads as more measured in social settings.",
        "The jaw finish looks defined, so directional structure appears steadier, and the face reads as less easily swayed.",
        "The overall ratio stays balanced, so the eye does not drift to one side, and the face reads as internally centered."
      ],
      tendency: [
        "In practice, this kind of face can read as someone who raises intensity only when it matters.",
        "It can also read as someone who watches the flow first, then steps in with clearer direction."
      ],
      strengths: [
        "Decision speed and expression control can appear together.",
        "Direction often reads clearly before overt intensity does.",
        "Presence can grow more through accumulated impression than instant reaction."
      ],
      cautions: [
        "Low facial variation can read as emotional distance.",
        "Strong concentration can make slower people feel left behind."
      ],
      shapeSummary:
        "The center line stays visually clear, so cleaner silhouettes work better than heavier styles that hide the jaw and neckline.",
      shapeRecommendations: [
        "A clearer forehead opening creates a stronger center line, so cleaner side-part styles work well.",
        "A line that follows the face instead of widening sideways keeps the jaw cleaner, so tighter silhouettes work well.",
        "A mid-length layer that does not sit too heavy under the jaw helps the lower face stay defined."
      ],
      shapeAvoid: [
        "A style that widens hard at both sides makes the face spread outward, so it can weaken the central line.",
        "Heavy straight fringe lowers eye exposure, so it can hide the face's clearer focus."
      ],
      lookalikeSummary:
        "The face reads as a structured masculine presentation, so the look-alike set should stay within similar male public figures.",
      lookalikes: [
        {
          name: "Cha Eun-woo",
          reason:
            "Cha Eun-woo : the central facial line and cleaner eye-to-jaw structure overlap, creating a similarly polished masculine impression."
        },
        {
          name: "Park Seo-joon",
          reason:
            "Park Seo-joon : the mouth control and lower-face structure feel similar, so the face gives a similarly restrained charismatic impression."
        },
        {
          name: "Lee Junho",
          reason:
            "Lee Junho : the eye focus and jaw finish feel structurally close, so the controlled masculine impression overlaps."
        }
      ],
      colorSummary:
        "The contrast looks moderate rather than extreme, so cleaner muted tones support the structure better than high-chroma color.",
      palette: ["Soft beige", "Taupe", "Muted coral", "Stone gray"],
      colorRecommendations: [
        "A muted beige base softens contrast, so the center line stays visible without washing out.",
        "Taupe and soft gray keep the face structured, so the jaw and eye focus stay cleaner.",
        "Low-chroma warm accents work better than sharp neon color because the structure stays clearer."
      ],
      colorAvoid: [
        "Very high-chroma pink can make color arrive before structure, so the facial line looks less controlled.",
        "Cold extreme contrast can harden the face first, so styling can look louder than the person."
      ]
    }
  }
};

function getCopy(locale = "ko") {
  return COPY[locale] || COPY.ko;
}

function buildFaceReadingMeta({ source, locale }) {
  return {
    schemaVersion: FACE_READING_RESPONSE_SCHEMA_VERSION,
    source,
    locale,
    generatedAt: new Date().toISOString()
  };
}

function hasFaceReadingPayloadShape(payload) {
  return Boolean(
    payload &&
    typeof payload === "object" &&
    payload.base_data &&
    typeof payload.base_data === "object" &&
    payload.features &&
    typeof payload.features === "object"
  );
}

function buildFaceReadingResponse(payload, { source, locale }) {
  const hasExpectedShape = hasFaceReadingPayloadShape(payload);
  const body = hasExpectedShape
    ? payload
    : buildMockFaceLab(locale);
  const resolvedSource = hasExpectedShape ? source : "mock_fallback";

  return {
    ...body,
    meta: buildFaceReadingMeta({ source: resolvedSource, locale })
  };
}

const KNOWN_PRESENTATION_BY_NAME = {
  "cha eun-woo": "masculine",
  "park seo-joon": "masculine",
  "lee junho": "masculine",
  "차은우": "masculine",
  "박서준": "masculine",
  "이준호": "masculine",
  "go youn-jung": "feminine",
  "han so-hee": "feminine",
  "suzy": "feminine",
  "bibi": "feminine",
  "고윤정": "feminine",
  "한소희": "feminine",
  "수지": "feminine",
  "비비": "feminine"
};

const LOOKALIKE_FALLBACKS = {
  ko: {
    masculine: {
      summary: "선이 정돈된 얼굴 구조와 하관의 정리감이 먼저 보여, 같은 남성 인상군 안에서 비교하는 편이 자연스럽습니다.",
      matches: [
        {
          name: "차은우",
          reason:
            "차은우 : 중심선이 또렷하고 눈매와 하관 정리가 비슷하기 때문에 정돈된 남성 인상이 겹쳐 보입니다."
        },
        {
          name: "박서준",
          reason:
            "박서준 : 입선 제어와 하관 구조가 비슷하기 때문에 단정한 카리스마 인상이 닮아 보입니다."
        },
        {
          name: "이준호",
          reason:
            "이준호 : 눈의 집중도와 턱선 마감이 비슷하기 때문에 절제된 남성 인상으로 이어집니다."
        }
      ]
    },
    feminine: {
      summary: "결 정리가 부드럽게 이어지고 시선 흐름이 안정적으로 보여, 같은 여성 인상군 안에서 비교하는 편이 자연스럽습니다.",
      matches: [
        {
          name: "고윤정",
          reason:
            "고윤정 : 눈매 흐름과 중안부 정리가 비슷하기 때문에 또렷하지만 차분한 여성 인상이 겹쳐 보입니다."
        },
        {
          name: "한소희",
          reason:
            "한소희 : 얼굴선의 정리감과 시선 집중이 비슷하기 때문에 선명한 여성 인상이 닮아 보입니다."
        },
        {
          name: "수지",
          reason:
            "수지 : 하관 마감과 전체 균형감이 비슷하기 때문에 부드럽게 정돈된 여성 인상으로 이어집니다."
        }
      ]
    },
    neutral: {
      summary: "구조 대비가 과하지 않고 중심선이 안정적으로 보여, 강한 성별 대비보다 비슷한 분위기의 대중 인물로 보는 편이 자연스럽습니다.",
      matches: [
        {
          name: "비비",
          reason:
            "비비 : 중심선이 살아 있으면서도 결이 과하게 날카롭지 않아, 또렷함과 자연스러움이 함께 보이는 인상이 닮아 보입니다."
        },
        {
          name: "이준호",
          reason:
            "이준호 : 눈의 집중도와 얼굴선 정리가 비슷하기 때문에 차분하게 중심이 잡힌 인상이 이어집니다."
        },
        {
          name: "고윤정",
          reason:
            "고윤정 : 전체 비율 정리가 안정적으로 보여, 결이 깨끗하게 모이는 인상이 겹쳐 보입니다."
        }
      ]
    }
  },
  en: {
    masculine: {
      summary: "The face reads as a structured masculine presentation, so the look-alike set should stay within similar male public figures.",
      matches: [
        {
          name: "Cha Eun-woo",
          reason:
            "Cha Eun-woo : the central facial line and cleaner eye-to-jaw structure overlap, creating a similarly polished masculine impression."
        },
        {
          name: "Park Seo-joon",
          reason:
            "Park Seo-joon : the mouth control and lower-face structure feel similar, so the face gives a similarly restrained charismatic impression."
        },
        {
          name: "Lee Junho",
          reason:
            "Lee Junho : the eye focus and jaw finish feel structurally close, so the controlled masculine impression overlaps."
        }
      ]
    },
    feminine: {
      summary: "The face reads as a softer feminine presentation, so the look-alike set should stay within similar female public figures.",
      matches: [
        {
          name: "Go Youn-jung",
          reason:
            "Go Youn-jung : the cleaner eye line and centered facial balance overlap, creating a similarly clear feminine impression."
        },
        {
          name: "Han So-hee",
          reason:
            "Han So-hee : the facial line definition and eye focus feel structurally similar, so the face gives a similarly sharp feminine impression."
        },
        {
          name: "Suzy",
          reason:
            "Suzy : the lower-face finish and overall balance feel close, so the face keeps a similarly calm feminine impression."
        }
      ]
    },
    neutral: {
      summary: "The structure reads balanced rather than strongly polarized, so a softer cross-style comparison is more natural than an extreme presentation call.",
      matches: [
        {
          name: "BIBI",
          reason:
            "BIBI : the center line stays visible without turning overly sharp, so the face gives a similarly clear but relaxed impression."
        },
        {
          name: "Lee Junho",
          reason:
            "Lee Junho : the eye focus and facial line control feel structurally close, so the impression stays centered and measured."
        },
        {
          name: "Go Youn-jung",
          reason:
            "Go Youn-jung : the balanced ratio and cleaner line flow overlap, so the face keeps a similarly composed impression."
        }
      ]
    }
  }
};

function normalizePresentationHint(value) {
  const normalized = String(value || "").trim().toLowerCase();

  if (normalized === "masculine" || normalized === "feminine" || normalized === "neutral") {
    return normalized;
  }

  return "neutral";
}

function getKnownPresentation(name) {
  const normalized = String(name || "").trim().toLowerCase();
  return KNOWN_PRESENTATION_BY_NAME[normalized] || null;
}

function getLookalikeFallback(locale = "ko", presentationHint = "neutral") {
  const fallbackSet = LOOKALIKE_FALLBACKS[locale] || LOOKALIKE_FALLBACKS.ko;
  return fallbackSet[presentationHint] || fallbackSet.neutral;
}

function buildMockFaceLab(locale = "ko", presentationHint = "neutral") {
  const fallback = getCopy(locale).fallback;
  const resolvedPresentation = normalizePresentationHint(presentationHint);
  const lookalikeFallback = getLookalikeFallback(locale, resolvedPresentation);

  return {
    base_data: {
      landmarks:
        locale === "en"
          ? ["clear eye focus", "controlled mouth line", "defined jaw finish", "balanced face ratio"]
          : ["눈의 집중도가 또렷함", "입선 제어가 보임", "턱선 마감이 선명함", "얼굴 비율이 균형형"],
      face_shape: "balanced oval",
      presentation_hint: resolvedPresentation,
      embedding: locale === "en" ? ["focused", "controlled", "structured"] : ["집중형", "제어형", "구조형"],
      color_values: {
        undertone: "neutral",
        brightness: "medium",
        contrast: "medium",
        saturation: "muted"
      }
    },
    features: {
      physiognomy: {
        headline_label: fallback.headlineLabel,
        headline_result: fallback.headlineResult,
        overall_impression: fallback.overall,
        interpretation_axes: fallback.axes,
        feature_based_interpretation: fallback.features,
        real_tendency: fallback.tendency,
        strengths: fallback.strengths,
        cautions: fallback.cautions
      },
      face_shape_hairstyle: {
        summary: fallback.shapeSummary,
        recommendations: fallback.shapeRecommendations,
        avoid: fallback.shapeAvoid
      },
      lookalike_celebrities: {
        summary: lookalikeFallback.summary,
        matches: lookalikeFallback.matches
      },
      color_tone_recommendation: {
        summary: fallback.colorSummary,
        palette: fallback.palette,
        recommendations: fallback.colorRecommendations,
        avoid: fallback.colorAvoid
      }
    }
  };
}

function normalizeArray(value, fallback, maxLength) {
  if (!Array.isArray(value) || !value.length) {
    return fallback;
  }

  return value.slice(0, maxLength).map((item) => String(item || "").trim()).filter(Boolean);
}

function isPlaceholderCelebrityName(name) {
  const normalized = String(name || "").trim().toLowerCase();

  return (
    !normalized ||
    /^celebrity[\s_-]*[a-z0-9]+$/.test(normalized) ||
    /^celeb[\s_-]*[a-z0-9]+$/.test(normalized) ||
    /^person[\s_-]*[a-z0-9]+$/.test(normalized) ||
    /^sample[\s_-]*[a-z0-9]+$/.test(normalized)
  );
}

function hasPlaceholderReason(reason) {
  const normalized = String(reason || "").trim().toLowerCase();

  return (
    !normalized ||
    normalized.includes("celebrity a") ||
    normalized.includes("celebrity b") ||
    normalized.includes("celebrity c") ||
    normalized.includes("person 1") ||
    normalized.includes("sample 1")
  );
}

function hasMixedKnownPresentation(matches, presentationHint) {
  if (presentationHint === "neutral") {
    return false;
  }

  return matches.some((item) => {
    const knownPresentation = getKnownPresentation(item.name);
    return knownPresentation && knownPresentation !== presentationHint;
  });
}

function normalizeMatches(value, fallback, presentationHint = "neutral") {
  if (!Array.isArray(value) || !value.length) {
    return fallback;
  }

  const seenNames = new Set();
  const matches = value
    .slice(0, 3)
    .map((item) => ({
      name: String(item?.name || "").trim(),
      reason: String(item?.reason || "").trim()
    }))
    .filter((item) => {
      const normalizedName = item.name.toLowerCase();

      if (
        !item.name ||
        !item.reason ||
        isPlaceholderCelebrityName(item.name) ||
        hasPlaceholderReason(item.reason) ||
        seenNames.has(normalizedName)
      ) {
        return false;
      }

      seenNames.add(normalizedName);
      return true;
    });

  if (matches.length !== 3 || hasMixedKnownPresentation(matches, presentationHint)) {
    return fallback;
  }

  return matches;
}

function normalizeFaceLab(parsed, locale = "ko") {
  const presentationHint = normalizePresentationHint(parsed?.base_data?.presentation_hint);
  const fallback = buildMockFaceLab(locale, presentationHint);

  return {
    base_data: {
      landmarks: normalizeArray(parsed?.base_data?.landmarks, fallback.base_data.landmarks, 4),
      face_shape: String(parsed?.base_data?.face_shape || fallback.base_data.face_shape),
      presentation_hint: presentationHint,
      embedding: normalizeArray(parsed?.base_data?.embedding, fallback.base_data.embedding, 4),
      color_values: {
        undertone: String(parsed?.base_data?.color_values?.undertone || fallback.base_data.color_values.undertone),
        brightness: String(parsed?.base_data?.color_values?.brightness || fallback.base_data.color_values.brightness),
        contrast: String(parsed?.base_data?.color_values?.contrast || fallback.base_data.color_values.contrast),
        saturation: String(parsed?.base_data?.color_values?.saturation || fallback.base_data.color_values.saturation)
      }
    },
    features: {
      physiognomy: {
        headline_label: String(parsed?.features?.physiognomy?.headline_label || fallback.features.physiognomy.headline_label),
        headline_result: String(parsed?.features?.physiognomy?.headline_result || fallback.features.physiognomy.headline_result),
        overall_impression: String(parsed?.features?.physiognomy?.overall_impression || fallback.features.physiognomy.overall_impression),
        interpretation_axes: normalizeArray(parsed?.features?.physiognomy?.interpretation_axes, fallback.features.physiognomy.interpretation_axes, 2),
        feature_based_interpretation: normalizeArray(parsed?.features?.physiognomy?.feature_based_interpretation, fallback.features.physiognomy.feature_based_interpretation, 4),
        real_tendency: normalizeArray(parsed?.features?.physiognomy?.real_tendency, fallback.features.physiognomy.real_tendency, 2),
        strengths: normalizeArray(parsed?.features?.physiognomy?.strengths, fallback.features.physiognomy.strengths, 3),
        cautions: normalizeArray(parsed?.features?.physiognomy?.cautions, fallback.features.physiognomy.cautions, 2)
      },
      face_shape_hairstyle: {
        summary: String(parsed?.features?.face_shape_hairstyle?.summary || fallback.features.face_shape_hairstyle.summary),
        recommendations: normalizeArray(parsed?.features?.face_shape_hairstyle?.recommendations, fallback.features.face_shape_hairstyle.recommendations, 3),
        avoid: normalizeArray(parsed?.features?.face_shape_hairstyle?.avoid, fallback.features.face_shape_hairstyle.avoid, 2)
      },
      lookalike_celebrities: {
        summary: "",
        matches: []
      },
      color_tone_recommendation: {
        summary: String(parsed?.features?.color_tone_recommendation?.summary || fallback.features.color_tone_recommendation.summary),
        palette: normalizeArray(parsed?.features?.color_tone_recommendation?.palette, fallback.features.color_tone_recommendation.palette, 4),
        recommendations: normalizeArray(parsed?.features?.color_tone_recommendation?.recommendations, fallback.features.color_tone_recommendation.recommendations, 3),
        avoid: normalizeArray(parsed?.features?.color_tone_recommendation?.avoid, fallback.features.color_tone_recommendation.avoid, 2)
      }
    }
  };
}

function extractTextContent(content) {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (item?.type === "text") {
          return item.text || "";
        }
        return "";
      })
      .join("\n")
      .trim();
  }

  return "";
}

function safeParse(content, locale = "ko") {
  try {
    return JSON.parse(content);
  } catch {
    const matched = content.match(/\{[\s\S]*\}/);
    if (matched) {
      return JSON.parse(matched[0]);
    }
    throw new Error(getCopy(locale).parseError);
  }
}

function createPrompt(locale = "ko") {
  const copy = getCopy(locale);

  return `
You are generating a Face Lab result.
This is not medical or scientific analysis.
Return only valid JSON.
Do not include markdown.
Do not add extra keys.
${copy.systemLanguage}

Use this exact JSON shape:
{
  "base_data": {
    "landmarks": ["visible feature 1", "visible feature 2", "visible feature 3", "visible feature 4"],
    "face_shape": "short face-shape label",
    "presentation_hint": "masculine | feminine | neutral",
    "embedding": ["descriptor 1", "descriptor 2", "descriptor 3"],
    "color_values": {
      "undertone": "value",
      "brightness": "value",
      "contrast": "value",
      "saturation": "value"
    }
  },
  "features": {
    "physiognomy": {
      "headline_label": "dominant label",
      "headline_result": "summary line",
      "overall_impression": "1 sentence",
      "interpretation_axes": ["axis 1", "axis 2"],
      "feature_based_interpretation": ["sentence 1", "sentence 2", "sentence 3", "sentence 4"],
      "real_tendency": ["sentence 1", "sentence 2"],
      "strengths": ["line 1", "line 2", "line 3"],
      "cautions": ["line 1", "line 2"]
    },
    "face_shape_hairstyle": {
      "summary": "1 sentence",
      "recommendations": ["line 1", "line 2", "line 3"],
      "avoid": ["line 1", "line 2"]
    },
    "lookalike_celebrities": {
      "summary": "",
      "matches": []
    },
    "color_tone_recommendation": {
      "summary": "1 sentence",
      "palette": ["color 1", "color 2", "color 3", "color 4"],
      "recommendations": ["line 1", "line 2", "line 3"],
      "avoid": ["line 1", "line 2"]
    }
  }
}

Rules:
- Keep the tone analytical, structural, and observation-based.
- This is style guidance, not diagnosis, face reading, or attractiveness scoring.
- Do not use mystical, medical, or absolute wording.
- Do not identify celebrities or public figures.
- Keep lookalike_celebrities.summary empty and lookalike_celebrities.matches empty.
- presentation_hint must be exactly one of: masculine, feminine, neutral.
- overall_impression must connect visible impression to styling direction.
- Hairstyle summary and recommendations must connect face observations to style decisions such as forehead exposure, side volume, top volume, jaw balance, or length balance.
- Avoid fortune-like lines, vague praise, and blunt feature judgment.
- Do not write lines such as "얼굴의 구조가 조화롭게 배치되어 있습니다", "구조적으로 유사한 유명 인상입니다", or "부드럽고 친근한 인상을 줍니다".
- Hairstyle recommendations should use structure -> visual effect -> recommendation.
- Feature-based lines should follow observation -> visual effect -> impression outcome.
- ${copy.toneRule}
`.trim();
}

async function readOpenAiResponse(response) {
  const rawText = await response.text();

  try {
    return {
      ok: response.ok,
      status: response.status,
      data: rawText ? JSON.parse(rawText) : null,
      rawText
    };
  } catch {
    return {
      ok: response.ok,
      status: response.status,
      data: null,
      rawText
    };
  }
}

export async function POST(request) {
  let responseLocale = "ko";

  try {
    const formData = await request.formData();
    const image = formData.get("image");
    const locale = formData.get("locale") === "en" ? "en" : "ko";
    responseLocale = locale;
    const copy = getCopy(locale);
    const imageValidation = validateImageUpload(image);

    if (!image || typeof image.arrayBuffer !== "function") {
      return NextResponse.json({ error: copy.errorNeedImage }, { status: 400 });
    }

    if (!imageValidation.ok) {
      const errorMessage = imageValidation.code === "too_large"
        ? copy.imageTooLarge
        : copy.invalidImageType;

      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const { apiKey } = resolveOpenAiApiKey();
    if (process.env.NODE_ENV !== "production") {
      console.info(
        "[face-reading] openai-env:diagnostic",
        getOpenAiEnvDiagnostics({
          route: "face-reading",
          routeUsesOpenAi: true,
          routeUsesOpenRouter: false
        })
      );
    }
    if (!apiKey) {
      return NextResponse.json(
        buildFaceReadingResponse(buildMockFaceLab(locale), {
          source: "mock_fallback",
          locale
        })
      );
    }

    const buffer = Buffer.from(await image.arrayBuffer());
    const imageDataUrl = `data:${image.type || "image/jpeg"};base64,${buffer.toString("base64")}`;

    const response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1400,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: createPrompt(locale) },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `${copy.instruction}\n${copy.toneRule}`
              },
              {
                type: "image_url",
                image_url: { url: imageDataUrl }
              }
            ]
          }
        ]
      })
    });

    const { ok, status, data, rawText } = await readOpenAiResponse(response);

    if (!ok) {
      console.error("[face-reading] OpenAI failed", {
        status,
        preview: previewDiagnosticText(data?.error?.message || data?.error || rawText)
      });
      return NextResponse.json(
        buildFaceReadingResponse(buildMockFaceLab(locale), {
          source: "mock_fallback",
          locale
        })
      );
    }

    const rawContent = extractTextContent(data?.choices?.[0]?.message?.content);

    if (!rawContent) {
      console.error("[face-reading] Empty model content", {
        status,
        preview: previewDiagnosticText(rawText)
      });
      return NextResponse.json(
        buildFaceReadingResponse(buildMockFaceLab(locale), {
          source: "mock_fallback",
          locale
        })
      );
    }

    try {
      const parsed = safeParse(rawContent, locale);
      const normalizedFaceLab = normalizeFaceLab(parsed, locale);

      if (process.env.NODE_ENV !== "production" && !hasFaceReadingPayloadShape(normalizedFaceLab)) {
        console.warn("[face-reading] response shape warning", {
          hasBaseData: Boolean(normalizedFaceLab?.base_data),
          hasFeatures: Boolean(normalizedFaceLab?.features)
        });
      }

      return NextResponse.json(
        buildFaceReadingResponse(normalizedFaceLab, {
          source: "openai",
          locale
        })
      );
    } catch (parseError) {
      console.error("[face-reading] parse failed", {
        message: parseError instanceof Error ? parseError.message : String(parseError),
        contentPreview: rawContent.slice(0, 240)
      });
      return NextResponse.json(
        buildFaceReadingResponse(buildMockFaceLab(locale), {
          source: "mock_fallback",
          locale
        })
      );
    }
  } catch (error) {
    console.error("[face-reading] failed", error);
    return NextResponse.json(
      { error: getCopy(responseLocale).serverError },
      { status: 500 }
    );
  }
}
