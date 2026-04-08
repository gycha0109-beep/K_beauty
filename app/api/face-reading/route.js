import { NextResponse } from "next/server";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const HTTP_REFERER = process.env.OPENROUTER_HTTP_REFERER || "http://localhost:3001";
const X_TITLE = process.env.OPENROUTER_X_TITLE || "K-Beauty AI Skin Test";

function buildMockFaceLab() {
  return {
    base_data: {
      landmarks: ["눈폭이 또렷한 편", "입선이 단단한 편", "턱선 마감이 선명함", "얼굴 비율이 균형형"],
      face_shape: "balanced oval",
      embedding: ["focused", "controlled", "steady"],
      color_values: {
        undertone: "neutral-warm",
        brightness: "medium",
        contrast: "soft-medium",
        saturation: "muted"
      }
    },
    features: {
      physiognomy: {
        headline_label: "차분한 설득형",
        headline_result: "중심선이 또렷한 + 표현 제어가 강한 + 설득형",
        overall_impression:
          "선의 긴장도는 과하지 않지만 중심축이 분명해, 반응보다 판단이 먼저 보이는 얼굴 구조로 읽힙니다.",
        interpretation_axes: ["신중형", "부드러운 카리스마형"],
        feature_based_interpretation: [
          "눈의 폭이 또렷하고 시선이 중앙으로 모이기 때문에 핵심이 먼저 읽히는 시각 효과가 생기고, 판단이 빠른 인상으로 이어집니다.",
          "입선이 단단하게 닫혀 있기 때문에 감정보다 제어가 먼저 보이는 시각 효과가 생기고, 거리 조절이 분명한 인상으로 이어집니다.",
          "턱선의 끊김이 적고 끝선이 선명하기 때문에 방향성이 고정돼 보이는 시각 효과가 생기고, 쉽게 흔들리지 않는 인상으로 이어집니다.",
          "얼굴 비율이 한쪽으로 치우치지 않기 때문에 판단 기준이 내부에 있는 시각 효과가 생기고, 차분하게 주도권을 잡는 인상으로 이어집니다."
        ],
        real_tendency: [
          "실제로는 말수가 많기보다 필요한 순간에만 강도를 올려 말하는 편일 가능성이 있습니다.",
          "관계에서는 먼저 밀어붙이기보다 흐름을 읽다가도 기준이 생기면 주도권을 잡는 쪽으로 보일 수 있습니다."
        ],
        strengths: [
          "판단 속도와 표현 제어가 함께 보여 설득 상황에서 말의 축이 쉽게 흐트러지지 않습니다.",
          "강한 압박보다 정리된 방향 제시가 먼저 보여 협의형 리더 역할에 강점을 가질 수 있습니다.",
          "초반 반응보다 누적 인상에서 존재감이 커지는 구조로 읽힐 가능성이 있습니다."
        ],
        cautions: [
          "표정 변화가 적으면 판단이 빠른 대신 정서적 거리가 있는 인상으로 읽힐 수 있습니다.",
          "한 방향으로 집중할 때 주변의 느린 속도를 비효율로 느낄 가능성이 있습니다."
        ]
      },
      face_shape_hairstyle: {
        summary:
          "중심선이 또렷한 얼굴형이기 때문에 시선이 중앙으로 모이는 효과가 생기고, 윤곽 정리형 스타일이 더 잘 맞습니다.",
        recommendations: [
          "이마가 일부 드러나는 앞머리 구조이기 때문에 세로 중심선이 살아나는 효과가 생기고, 가벼운 시스루 뱅이 잘 맞습니다.",
          "옆선이 얼굴을 따라 떨어지는 구조이기 때문에 윤곽 끊김이 줄어드는 효과가 생기고, 얼굴선 따라 흐르는 레이어가 잘 맞습니다.",
          "턱선과 광대를 함께 정리하는 구조이기 때문에 하관 무게가 분산되는 효과가 생기고, 미디엄 길이 레이어가 잘 맞습니다."
        ],
        avoid: [
          "양옆만 크게 부푸는 구조이기 때문에 가로 폭이 먼저 커지는 효과가 생기고, 중심선이 흐려지는 스타일은 피하는 편이 좋습니다.",
          "무거운 일자 풀뱅 구조이기 때문에 눈매 노출이 줄어드는 효과가 생기고, 또렷한 인상이 약해지는 스타일은 피하는 편이 좋습니다."
        ]
      },
      lookalike_celebrities: {
        summary:
          "눈 중심선과 입선 제어가 함께 보여, 선명한 판단 인상과 절제된 표현이 겹치는 셀럽군과 닮은 흐름으로 읽힙니다.",
        matches: [
          {
            name: "고윤정",
            reason: "고윤정 : 눈 중심선과 하관 정리감이 비슷하기 때문에 표정이 과하지 않아도 중심이 남는 인상이 닮은 쪽으로 보입니다."
          },
          {
            name: "한소희",
            reason: "한소희 : 눈매 선명도와 턱선 마감이 비슷하기 때문에 시선이 얼굴 중앙에 모이는 인상이 닮은 쪽으로 보입니다."
          },
          {
            name: "수지",
            reason: "수지 : 전체 선 강도는 높지 않지만 입선 제어가 비슷하기 때문에 절제된 설득형 인상이 닮은 흐름으로 보입니다."
          }
        ]
      },
      color_tone_recommendation: {
        summary:
          "대비가 과하지 않은 뉴트럴 웜 계열이기 때문에 중심선이 흐려지지 않는 효과가 생기고, 표정 구조가 더 정리돼 보입니다.",
        palette: ["Soft beige", "Muted coral", "Warm taupe", "Dusty peach"],
        recommendations: [
          "노란 기가 강하지 않은 베이스 구조이기 때문에 피부 면이 평평해 보이는 효과가 생기고, 뉴트럴 베이지가 잘 맞습니다.",
          "채도가 낮은 코랄 구조이기 때문에 입 주변 대비가 과하게 오르지 않는 효과가 생기고, 뮤트 코랄 립이 잘 맞습니다.",
          "크림과 웜 그레이 구조이기 때문에 얼굴 외곽 대비가 낮아지는 효과가 생기고, 저대비 의상 조합이 잘 맞습니다."
        ],
        avoid: [
          "푸른 기가 강한 핑크 구조이기 때문에 피부 대비가 먼저 오르는 효과가 생기고, 얼굴 구조 해석이 흐려질 수 있습니다.",
          "흑백 대비가 강한 조합이기 때문에 외곽 경계가 먼저 서는 효과가 생기고, 표정선보다 색이 먼저 보일 수 있습니다."
        ]
      }
    }
  };
}

function normalizeArray(value, fallback, maxLength) {
  if (!Array.isArray(value) || !value.length) {
    return fallback;
  }

  return value.slice(0, maxLength).map((item) => String(item));
}

function normalizeMatches(value, fallback) {
  if (!Array.isArray(value) || !value.length) {
    return fallback;
  }

  return value.slice(0, 3).map((item) => ({
    name: String(item?.name || ""),
    reason: String(item?.reason || "")
  }));
}

function normalizeFaceLab(parsed) {
  const fallback = buildMockFaceLab();

  return {
    base_data: {
      landmarks: normalizeArray(parsed?.base_data?.landmarks, fallback.base_data.landmarks, 4),
      face_shape: String(parsed?.base_data?.face_shape || fallback.base_data.face_shape),
      embedding: normalizeArray(parsed?.base_data?.embedding, fallback.base_data.embedding, 4),
      color_values: {
        undertone: String(
          parsed?.base_data?.color_values?.undertone || fallback.base_data.color_values.undertone
        ),
        brightness: String(
          parsed?.base_data?.color_values?.brightness || fallback.base_data.color_values.brightness
        ),
        contrast: String(
          parsed?.base_data?.color_values?.contrast || fallback.base_data.color_values.contrast
        ),
        saturation: String(
          parsed?.base_data?.color_values?.saturation || fallback.base_data.color_values.saturation
        )
      }
    },
    features: {
      physiognomy: {
        headline_label: String(
          parsed?.features?.physiognomy?.headline_label ||
            fallback.features.physiognomy.headline_label
        ),
        headline_result: String(
          parsed?.features?.physiognomy?.headline_result ||
            fallback.features.physiognomy.headline_result
        ),
        overall_impression: String(
          parsed?.features?.physiognomy?.overall_impression ||
            fallback.features.physiognomy.overall_impression
        ),
        interpretation_axes: normalizeArray(
          parsed?.features?.physiognomy?.interpretation_axes,
          fallback.features.physiognomy.interpretation_axes,
          2
        ),
        feature_based_interpretation: normalizeArray(
          parsed?.features?.physiognomy?.feature_based_interpretation,
          fallback.features.physiognomy.feature_based_interpretation,
          4
        ),
        real_tendency: normalizeArray(
          parsed?.features?.physiognomy?.real_tendency,
          fallback.features.physiognomy.real_tendency,
          2
        ),
        strengths: normalizeArray(
          parsed?.features?.physiognomy?.strengths,
          fallback.features.physiognomy.strengths,
          3
        ),
        cautions: normalizeArray(
          parsed?.features?.physiognomy?.cautions,
          fallback.features.physiognomy.cautions,
          2
        )
      },
      face_shape_hairstyle: {
        summary: String(
          parsed?.features?.face_shape_hairstyle?.summary ||
            fallback.features.face_shape_hairstyle.summary
        ),
        recommendations: normalizeArray(
          parsed?.features?.face_shape_hairstyle?.recommendations,
          fallback.features.face_shape_hairstyle.recommendations,
          3
        ),
        avoid: normalizeArray(
          parsed?.features?.face_shape_hairstyle?.avoid,
          fallback.features.face_shape_hairstyle.avoid,
          2
        )
      },
      lookalike_celebrities: {
        summary: String(
          parsed?.features?.lookalike_celebrities?.summary ||
            fallback.features.lookalike_celebrities.summary
        ),
        matches: normalizeMatches(
          parsed?.features?.lookalike_celebrities?.matches,
          fallback.features.lookalike_celebrities.matches
        )
      },
      color_tone_recommendation: {
        summary: String(
          parsed?.features?.color_tone_recommendation?.summary ||
            fallback.features.color_tone_recommendation.summary
        ),
        palette: normalizeArray(
          parsed?.features?.color_tone_recommendation?.palette,
          fallback.features.color_tone_recommendation.palette,
          4
        ),
        recommendations: normalizeArray(
          parsed?.features?.color_tone_recommendation?.recommendations,
          fallback.features.color_tone_recommendation.recommendations,
          3
        ),
        avoid: normalizeArray(
          parsed?.features?.color_tone_recommendation?.avoid,
          fallback.features.color_tone_recommendation.avoid,
          2
        )
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

function safeParse(content) {
  try {
    return JSON.parse(content);
  } catch {
    const matched = content.match(/\{[\s\S]*\}/);

    if (matched) {
      return JSON.parse(matched[0]);
    }

    throw new Error("Face Lab 응답을 해석하지 못했습니다.");
  }
}

function createPrompt() {
  return `
You are generating a Korean "Face Lab" result.
This is not medical or scientific analysis.
Return only valid JSON.
Do not include markdown.
Do not add extra keys.

Use this exact JSON shape:
{
  "base_data": {
    "landmarks": ["visible feature 1", "visible feature 2", "visible feature 3", "visible feature 4"],
    "face_shape": "short face-shape label",
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
      "overall_impression": "1 to 2 sentences",
      "interpretation_axes": ["axis 1", "axis 2"],
      "feature_based_interpretation": [
        "sentence 1",
        "sentence 2",
        "sentence 3",
        "sentence 4"
      ],
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
      "summary": "1 sentence",
      "matches": [
        { "name": "celebrity 1", "reason": "structured reason" },
        { "name": "celebrity 2", "reason": "structured reason" },
        { "name": "celebrity 3", "reason": "structured reason" }
      ]
    },
    "color_tone_recommendation": {
      "summary": "1 sentence",
      "palette": ["color 1", "color 2", "color 3", "color 4"],
      "recommendations": ["line 1", "line 2", "line 3"],
      "avoid": ["line 1", "line 2"]
    }
  }
}

Interpretation axis rules:
- Pick 1 or 2 dominant axes only for physiognomy.
- Allowed axes:
  - 안정형
  - 친화형
  - 리더형
  - 신중형
  - 집중형
  - 부드러운 카리스마형
  - 거리감 있는 이성형
  - 표현력 있는 외향형

Summary rules:
- headline_result is the SUMMARY line.
- Format:
  [structure trait] + " + " + [behavior trait] + " " + [archetype]
- Example:
  판단 속도가 빠른 + 표현 제어가 강한 + 설득형
- Avoid these vague words in headline_result by default:
  부드러운, 친근한, 안정적인, 신뢰감

Feature rules:
- Every feature_based_interpretation sentence must use exactly ONE sentence.
- Format:
  [observation] + " 때문에 " + [visual effect] + ", " + [impression outcome] + "으로 이어집니다."
- No arrows.
- No line breaks.
- Prefer structural causal wording.

Word replacement rules:
- Replace vague words with structural ones:
  - 부드러운 -> 낮은 긴장도 / 완만한 곡선
  - 친근한 -> 접근 장벽이 낮은
  - 신뢰감 -> 예측 가능성

Look-alike rules:
- For each match reason use this format:
  [Name] : [structural similarity] + " 때문에 " + [impression similarity]

Hair / shape rules:
- Use this format for each recommendation and avoid line:
  [face structure] + " 때문에 " + [visual effect] + ", " + [recommendation]

Language rules:
- Output must be entirely in Korean.
- Tone must feel analytical, semi-professional, observation-based, and plausible.
- Not mystical, not medical, not absolute.
- Do not let every result converge to the same soft or trustworthy tone.
- If the face has sharper lines, stronger contrast, narrower eyes, or tighter mouth shape, allow outputs like:
  - 판단이 빠른 인상
  - 거리 조절이 분명한 인상
  - 쉽게 흔들리지 않는 구조
  - 주도성이 보이는 타입
- If the face has softer curves, wider eyes, relaxed mouth corners, or lower tension overall, allow outputs like:
  - 접근 장벽이 낮은 인상
  - 감정 완충력이 있는 타입
  - 분위기를 부드럽게 만드는 성향
  - 관계 조율형
- If mixed features appear, combine them naturally:
  - 부드러운 리더형
  - 차분한 설득형
  - 친화적인 중심형
`.trim();
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const image = formData.get("image");

    if (!image || typeof image.arrayBuffer !== "function") {
      return NextResponse.json({ error: "얼굴 사진이 필요합니다." }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return NextResponse.json(buildMockFaceLab());
    }

    const buffer = Buffer.from(await image.arrayBuffer());
    const imageDataUrl = `data:${image.type || "image/jpeg"};base64,${buffer.toString("base64")}`;

    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": HTTP_REFERER,
        "X-Title": X_TITLE
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: createPrompt()
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "업로드된 얼굴 사진을 바탕으로 Face Lab 결과를 작성해 주세요. 모든 설명은 감정형 표현보다 구조형 문장으로 쓰고, 요약은 템플릿 규칙에 맞춰 짧게 정리해 주세요."
              },
              {
                type: "image_url",
                image_url: {
                  url: imageDataUrl
                }
              }
            ]
          }
        ]
      })
    });

    const raw = await response.text();

    if (!response.ok) {
      return NextResponse.json(buildMockFaceLab());
    }

    const parsedResponse = JSON.parse(raw);
    const content = extractTextContent(parsedResponse?.choices?.[0]?.message?.content);

    if (!content) {
      return NextResponse.json(buildMockFaceLab());
    }

    return NextResponse.json(normalizeFaceLab(safeParse(content)));
  } catch {
    return NextResponse.json(buildMockFaceLab());
  }
}
