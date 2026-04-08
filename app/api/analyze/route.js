import { NextResponse } from "next/server";
import { buildMockAnalysis, buildRuleBasedPlan } from "@/lib/mock-data";
import { buildOptionalSkinNote, buildRecommendationBundle } from "@/lib/recommendation";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const HTTP_REFERER = process.env.OPENROUTER_HTTP_REFERER || "http://localhost:3001";
const X_TITLE = process.env.OPENROUTER_X_TITLE || "K-Beauty AI Skin Test";

function createJsonSchemaPrompt(productCount) {
  return `
You are a K-beauty skincare assistant.
Return only valid JSON.
Do not wrap in markdown.
Do not include extra keys.
Use Korean language.

Required JSON shape:
{
  "summary": "3줄 이내 피부 요약",
  "strategy": "핵심 전략 한 줄",
  "morning": ["아침 루틴 1", "아침 루틴 2", "아침 루틴 3"],
  "night": ["저녁 루틴 1", "저녁 루틴 2", "저녁 루틴 3"],
  "avoid": ["피해야 할 것 1", "피해야 할 것 2", "피해야 할 것 3"],
  "productExplanations": [
    {
      "id": "product-id",
      "reason": "이 제품이 왜 이겼는지 1~2문장",
      "comparison_reason": "비슷한 후보보다 왜 앞섰는지 1문장"
    }
  ],
  "funInsight": {
    "title": "Optional Skin Note",
    "description": "보조 메모 한 줄"
  }
}

Rules:
- Keep recommendations practical and beginner-friendly.
- Do not diagnose disease.
- Mention gentle K-beauty style routine logic.
- Assume the uploaded face photo is available as a lightweight MVP visual reference.
- Use the survey answers as the primary source of truth.
- Product winners are already selected by code.
- Never choose, replace, reorder, or rename products.
- Do not decide winners. Do not suggest different products.
- Generate explanation text only for the provided product ids.
- Each product explanation must include:
  1. same-category comparison target
  2. a specific difference vs the closest alternative
  3. the user condition this difference matters for
  4. a final decision signal explaining why it ranks higher
- Each product explanation must also reflect:
  1. skin type reasoning
  2. concern reasoning
  3. texture or finish reasoning
  4. environment or routine reasoning
- reason must be 1 to 2 concise sentences total.
- comparison_reason must be exactly 1 sentence.
- comparison_reason must stay under 25 words.
- Do not repeat the same opening across products.
- Avoid vague phrases like "피부 타입에 잘 맞음", "고민을 반영함", "안정적으로 맞음".
- Avoid vague words or phrases like "적합합니다", "효과적입니다", "조화롭습니다", "우선순위가 높습니다", "좋은 선택입니다", "대응력이 높습니다".
- Do not use ranking phrases like "순위", "앞섰다", "선택됐다".
- End each comparison with a concrete user-facing effect, not a vague evaluation.
- Vary the outcome naturally and do not overuse endings like "유지됩니다" or "이어집니다".
- Use direct outcomes such as:
  - "늦게 올라옵니다"
  - "빠르게 가라앉습니다"
  - "겉도는 느낌이 줄어듭니다"
  - "밀림이 적습니다"
  - "흡수 흐름이 끊기지 않습니다"
- Use this sentence structure in Korean for every comparison:
  - "같은 [구체적인 타입] 대비 [명확한 차이]가 있어 [구체적인 사용자 조건]에서 [구체적인 체감 결과]가 남습니다."
- Keep the same logic order in every comparison:
  comparison target -> key difference -> user condition -> ranking reason.
- Vary only the surface phrasing and sentence opening.
- Good opening variations include:
  - "같은 ... 대비"
  - "... 기준으로 보면"
  - "...보다"
  - "... 흐름에서는"
  - "...와 비교하면"
- Keep each Why This Won style comparison to one sentence only.
- Use more specific comparison targets such as:
  - "같은 수분 세럼"
  - "같은 진정 세럼"
  - "같은 gel 타입 클렌저"
  - "같은 보습형 선크림"
- Every comparison must include both:
  1. one physical or sensory difference
     - absorption speed
     - residue
     - tightness after cleansing
     - oil comeback pattern
     - layering weight
     - irritation response
  2. one specific user condition
     - oily skin with afternoon shine
     - dry skin with post-wash tightness
     - sensitive skin with mask friction
- If a comparison does not contain both a real physical difference and a real user condition, rewrite it before returning JSON.
- If a comparison is longer than 25 words, rewrite it shorter before returning JSON.
- Use specific phrasing such as:
  - "같은 보습형 선크림 대비 번들 막이 늦게 올라와 오후 유분이 빠른 피부에서 겉도는 느낌이 줄어듭니다."
  - "같은 수분 세럼보다 세안 후 당김이 더 천천히 올라와 건성 피부에서도 다음 단계가 끊기지 않습니다."
  - "같은 진정 세럼과 비교하면 자극 반응이 덜 올라와 마스크 마찰이 있는 민감 피부에서 붉은 기운이 빨리 가라앉습니다."
- Make each explanation feel product-specific, comparison-based, and not template-like.
- Each array must contain exactly 3 entries except productExplanations.
- productExplanations must contain exactly ${productCount} objects.
- summary must be within 3 short lines.
- strategy must be exactly 1 sentence.
`.trim();
}

function normalizeResult(parsed) {
  const ensureList = (value, fallback) => {
    if (Array.isArray(value)) {
      return value.slice(0, 3).map((item) => String(item));
    }
    return fallback;
  };

  return {
    summary: String(parsed?.summary || "피부 요약을 생성하지 못했습니다."),
    strategy: String(parsed?.strategy || "자극을 줄이고 사용감이 맞는 루틴부터 가볍게 정리하세요."),
    morning: ensureList(parsed?.morning, [
      "순한 클렌저로 가볍게 세안하기",
      "가벼운 수분층으로 유수분 균형 맞추기",
      "자외선 차단제로 마무리하기"
    ]),
    night: ensureList(parsed?.night, [
      "과하지 않게 노폐물 정리하기",
      "고민에 맞는 진정 또는 보습 단계 더하기",
      "부담 없는 보습제로 마무리하기"
    ]),
    avoid: ensureList(parsed?.avoid, [
      "한 번에 너무 많은 제품을 겹쳐 바르기",
      "피부 상태와 맞지 않는 무거운 제형 계속 쓰기",
      "강한 세정이나 필링을 자주 반복하기"
    ]),
    productExplanations: Array.isArray(parsed?.productExplanations)
      ? parsed.productExplanations.map((item) => ({
          id: String(item?.id || ""),
          reason: String(item?.reason || ""),
          comparison_reason: String(item?.comparison_reason || "")
        }))
      : [],
    funInsight: parsed?.funInsight
      ? {
          title: String(parsed.funInsight?.title || "Optional Skin Note"),
          description: String(parsed.funInsight?.description || "")
        }
      : null
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
      try {
        return JSON.parse(matched[0]);
      } catch {
        throw new Error("JSON 형식 응답을 해석하지 못했습니다.");
      }
    }

    throw new Error("JSON 형식 응답을 받지 못했습니다.");
  }
}

async function readOpenRouterResponse(response) {
  const rawText = await response.text();

  if (!rawText) {
    return {
      ok: response.ok,
      status: response.status,
      data: null,
      rawText: ""
    };
  }

  try {
    return {
      ok: response.ok,
      status: response.status,
      data: JSON.parse(rawText),
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

function buildSelectedProductsContext(recommendation) {
  return recommendation.products.map((product) => ({
    id: product.id,
    name: product.name,
    brand: product.brand,
    category: product.category,
    step: product.step,
    score: product.score,
    labels: product.labels,
    notes: product.notes,
    current_reason: product.reason,
    current_comparison_reason: product.comparison_reason,
    explanation_context: product.explanation_context,
    score_breakdown: product.score_breakdown
  }));
}

function applyProductExplanations(products, explanationItems) {
  const explanationMap = new Map(
    (explanationItems || [])
      .filter((item) => item?.id)
      .map((item) => [item.id, item])
  );

  return products.map((product) => {
    const explanation = explanationMap.get(product.id);

    if (!explanation) {
      return product;
    }

    return {
      ...product,
      reason: explanation.reason || product.reason,
      comparison_reason: explanation.comparison_reason || product.comparison_reason
    };
  });
}

function applyExplanationBundle(recommendation, explanationItems) {
  const explainedProducts = applyProductExplanations(recommendation.products, explanationItems);
  const byId = new Map(explainedProducts.map((product) => [product.id, product]));

  return {
    ...recommendation,
    topPick: recommendation.topPick
      ? byId.get(recommendation.topPick.id) || recommendation.topPick
      : null,
    categoryPicks: (recommendation.categoryPicks || []).map(
      (product) => byId.get(product.id) || product
    ),
    alternative: recommendation.alternative
      ? byId.get(recommendation.alternative.id) || recommendation.alternative
      : null,
    products: explainedProducts
  };
}

function buildUserContext(formInput) {
  return [
    `- 피부 타입: ${formInput.skinType}`,
    `- 민감도: ${formInput.sensitivity}`,
    `- 주요 고민: ${formInput.mainConcern}`,
    `- 세안 빈도: ${formInput.cleansingFrequency}`,
    `- 선호 제형: ${formInput.preferredTexture}`,
    `- 세안 후 느낌: ${formInput.postWashFeeling}`,
    `- 오후 피부 변화: ${formInput.afternoonSkinChange}`,
    `- 환경 노출: ${(formInput.environmentExposure || []).join(", ") || "없음"}`,
    `- 피하고 싶은 사용감: ${formInput.mostDislikedFeel}`
  ].join("\n");
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const image = formData.get("image");
    const skinType = formData.get("skinType");
    const sensitivity = formData.get("sensitivity");
    const mainConcern = formData.get("mainConcern");
    const cleansingFrequency = formData.get("cleansingFrequency");
    const preferredTexture = formData.get("preferredTexture");
    const postWashFeeling = formData.get("postWashFeeling");
    const afternoonSkinChange = formData.get("afternoonSkinChange");
    const environmentExposure = JSON.parse(formData.get("environmentExposure") || "[]");
    const mostDislikedFeel = formData.get("mostDislikedFeel");

    if (
      !image ||
      !skinType ||
      !sensitivity ||
      !mainConcern ||
      !cleansingFrequency ||
      !preferredTexture ||
      !postWashFeeling ||
      !afternoonSkinChange ||
      !mostDislikedFeel
    ) {
      return NextResponse.json(
        { error: "필수 입력값이 비어 있습니다." },
        { status: 400 }
      );
    }

    const formInput = {
      skinType,
      sensitivity,
      mainConcern,
      cleansingFrequency,
      preferredTexture,
      postWashFeeling,
      afternoonSkinChange,
      environmentExposure,
      mostDislikedFeel
    };

    const recommendation = buildRecommendationBundle(formInput);
    const ruleBasedPlan = buildRuleBasedPlan(formInput);
    const optionalSkinNote = buildOptionalSkinNote(formInput);
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        ...buildMockAnalysis(formInput),
        topPick: recommendation.topPick,
        categoryPicks: recommendation.categoryPicks,
        alternative: recommendation.alternative,
        products: recommendation.products,
        funInsight: optionalSkinNote,
        scoring: recommendation.scoring,
        meta: {
          source: "mock",
          notice: "OpenRouter API 키가 없어 mock 결과를 표시합니다."
        }
      });
    }

    let imageDataUrl = null;

    if (typeof image.arrayBuffer === "function") {
      const buffer = Buffer.from(await image.arrayBuffer());
      imageDataUrl = `data:${image.type || "image/jpeg"};base64,${buffer.toString("base64")}`;
    }

    const selectedProductsContext = buildSelectedProductsContext(recommendation);
    const content = [
      {
        type: "text",
        text: [
          createJsonSchemaPrompt(selectedProductsContext.length),
          "",
          "설문 정보",
          buildUserContext(formInput),
          "",
          "아래는 코드가 이미 선택한 최종 제품 목록",
          JSON.stringify(selectedProductsContext, null, 2)
        ].join("\n")
      }
    ];

    if (imageDataUrl) {
      content.push({
        type: "image_url",
        image_url: {
          url: imageDataUrl
        }
      });
    } else {
      content.push({
        type: "text",
        text: "얼굴 사진은 업로드되었지만 현재는 MVP 구조 기준으로만 반영합니다."
      });
    }

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
            content: createJsonSchemaPrompt(selectedProductsContext.length)
          },
          {
            role: "user",
            content
          }
        ]
      })
    });

    const { data, rawText, status, ok } = await readOpenRouterResponse(response);

    if (!ok) {
      return NextResponse.json({
        ...buildMockAnalysis(formInput),
        topPick: recommendation.topPick,
        categoryPicks: recommendation.categoryPicks,
        alternative: recommendation.alternative,
        products: recommendation.products,
        funInsight: optionalSkinNote,
        scoring: recommendation.scoring,
        meta: {
          source: "mock",
          notice: "OpenRouter 호출이 실패해 mock 결과를 대신 표시합니다."
        },
        error:
          data?.error?.message ||
          data?.error ||
          rawText ||
          `OpenRouter 호출이 실패했습니다. (${status})`
      });
    }

    const rawContent = extractTextContent(data?.choices?.[0]?.message?.content);

    if (!rawContent) {
      return NextResponse.json({
        ...buildMockAnalysis(formInput),
        topPick: recommendation.topPick,
        categoryPicks: recommendation.categoryPicks,
        alternative: recommendation.alternative,
        products: recommendation.products,
        funInsight: optionalSkinNote,
        scoring: recommendation.scoring,
        meta: {
          source: "mock",
          notice: "응답 본문이 비어 있어 mock 결과를 표시합니다."
        }
      });
    }

    try {
      const parsed = safeParse(rawContent);
      const normalized = normalizeResult(parsed);
      const explainedRecommendation = applyExplanationBundle(
        recommendation,
        normalized.productExplanations
      );

      return NextResponse.json({
        summary: normalized.summary || ruleBasedPlan.summary,
        strategy: normalized.strategy || ruleBasedPlan.strategy,
        morning: normalized.morning?.length ? normalized.morning : ruleBasedPlan.morning,
        night: normalized.night?.length ? normalized.night : ruleBasedPlan.night,
        avoid: normalized.avoid?.length ? normalized.avoid : ruleBasedPlan.avoid,
        topPick: explainedRecommendation.topPick,
        categoryPicks: explainedRecommendation.categoryPicks,
        alternative: explainedRecommendation.alternative,
        products: explainedRecommendation.products,
        funInsight: normalized.funInsight || optionalSkinNote,
        scoring: recommendation.scoring,
        meta: {
          source: "openrouter",
          notice: ""
        }
      });
    } catch (parseError) {
      return NextResponse.json({
        ...buildMockAnalysis(formInput),
        topPick: recommendation.topPick,
        categoryPicks: recommendation.categoryPicks,
        alternative: recommendation.alternative,
        products: recommendation.products,
        funInsight: optionalSkinNote,
        scoring: recommendation.scoring,
        meta: {
          source: "mock",
          notice: "응답 파싱이 실패해 mock 결과를 대신 표시합니다."
        },
        error:
          parseError.message ||
          "모델 응답을 JSON으로 해석하지 못했습니다. 다시 시도해 주세요."
      });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

