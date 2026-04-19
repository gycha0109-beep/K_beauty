import { NextResponse } from "next/server";
import { buildFallbackAnalysis, buildRuleBasedPlan } from "@/lib/fallback-analysis";
import { buildRecommendationBundle } from "@/lib/recommendation";
import { formatUploadSize, validateImageUpload } from "@/lib/upload-validation";
import { createWriteAccessToken } from "@/lib/write-access";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const HTTP_REFERER = process.env.OPENROUTER_HTTP_REFERER || "http://localhost:3001";
const X_TITLE = process.env.OPENROUTER_X_TITLE || "K-Beauty AI Skin Test";
const OPENROUTER_MODEL = "openai/gpt-4o-mini";
const OPENROUTER_MAX_TOKENS = 1200;

function previewText(value, maxLength = 280) {
  if (!value) {
    return "";
  }

  const text = String(value).replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function logAnalyze(stage, payload = {}) {
  console.log(`[analyze] ${stage}`, payload);
}

const ANALYZE_COPY = {
  ko: {
    languageInstruction: "Use Korean language.",
    schemaSummary: "3줄 이내 피부 요약",
    schemaStrategy: "핵심 전략 한 줄",
    schemaMorning: ["아침 루틴 1", "아침 루틴 2", "아침 루틴 3"],
    schemaNight: ["저녁 루틴 1", "저녁 루틴 2", "저녁 루틴 3"],
    schemaAvoid: ["피해야 할 것 1", "피해야 할 것 2", "피해야 할 것 3"],
    schemaReason: "이 제품 설명 1~2문장",
    schemaCompare: "이 제품의 차이를 보여주는 1문장",
    schemaInsightTitle: "Optional Skin Note",
    schemaInsightDescription: "보조 메모 한 줄",
    surveyInfo: "설문 정보",
    selectedProducts: "아래는 코드가 이미 선택한 최종 제품 목록",
    imageFallbackText: "얼굴 사진은 업로드되었지만 현재는 MVP 구조 기준으로만 반영합니다.",
    missingRequired: "필수 입력값이 비어 있습니다.",
    invalidImageType: "JPEG, PNG, WEBP 이미지만 업로드할 수 있습니다.",
    imageTooLarge: `이미지 용량은 ${formatUploadSize()} 이하만 업로드할 수 있습니다.`,
    missingApiKeyNotice: "OpenRouter API 키가 없어 mock 결과를 표시합니다.",
    fetchFailNotice: "OpenRouter 호출이 실패해 mock 결과를 대신 표시합니다.",
    fetchFailError: "OpenRouter 호출이 실패했습니다.",
    emptyBodyNotice: "응답 본문이 비어 있어 mock 결과를 표시합니다.",
    parseFailNotice: "응답 파싱이 실패해 mock 결과를 대신 표시합니다.",
    parseFailError: "모델 응답을 JSON으로 해석하지 못했습니다. 다시 시도해 주세요.",
    serverError: "서버 오류가 발생했습니다.",
    parseJsonError: "JSON 형식 응답을 해석하지 못했습니다.",
    nonJsonError: "JSON 형식 응답을 받지 못했습니다."
  },
  en: {
    languageInstruction: "Use English language.",
    schemaSummary: "Skin summary in up to 3 short lines",
    schemaStrategy: "One-line core strategy",
    schemaMorning: ["Morning step 1", "Morning step 2", "Morning step 3"],
    schemaNight: ["Night step 1", "Night step 2", "Night step 3"],
    schemaAvoid: ["Avoid 1", "Avoid 2", "Avoid 3"],
    schemaReason: "1 to 2 sentences explaining this product",
    schemaCompare: "1 sentence showing how it differs",
    schemaInsightTitle: "Optional Skin Note",
    schemaInsightDescription: "One short supporting note",
    surveyInfo: "Survey info",
    selectedProducts: "Below is the final product list already selected by code",
    imageFallbackText: "A face photo was uploaded, but in this MVP it is only used as lightweight visual context.",
    missingRequired: "Required input values are missing.",
    invalidImageType: "Only JPEG, PNG, and WEBP images are allowed.",
    imageTooLarge: `Images must be ${formatUploadSize()} or smaller.`,
    missingApiKeyNotice: "OpenRouter API key is missing, so a mock result is shown instead.",
    fetchFailNotice: "OpenRouter request failed, so a mock result is shown instead.",
    fetchFailError: "OpenRouter request failed.",
    emptyBodyNotice: "The response body was empty, so a mock result is shown instead.",
    parseFailNotice: "Response parsing failed, so a mock result is shown instead.",
    parseFailError: "Could not parse the model response as JSON. Please try again.",
    serverError: "A server error occurred.",
    parseJsonError: "Could not parse the JSON response.",
    nonJsonError: "Did not receive a JSON response."
  }
};

function getAnalyzeCopy(locale = "ko") {
  return ANALYZE_COPY[locale] || ANALYZE_COPY.ko;
}

function createJsonSchemaPrompt(productCount, locale = "ko") {
  const copy = getAnalyzeCopy(locale);
  return `
You are a K-beauty skincare assistant.
Return only valid JSON.
Do not wrap in markdown.
Do not include extra keys.
${copy.languageInstruction}

Required JSON shape:
{
  "summary": "${copy.schemaSummary}",
  "strategy": "${copy.schemaStrategy}",
  "morning": ["${copy.schemaMorning[0]}", "${copy.schemaMorning[1]}", "${copy.schemaMorning[2]}"],
  "night": ["${copy.schemaNight[0]}", "${copy.schemaNight[1]}", "${copy.schemaNight[2]}"],
  "avoid": ["${copy.schemaAvoid[0]}", "${copy.schemaAvoid[1]}", "${copy.schemaAvoid[2]}"],
  "productExplanations": [
    {
      "id": "product-id",
      "reason": "${copy.schemaReason}",
      "comparison_reason": "${copy.schemaCompare}"
    }
  ],
  "funInsight": {
    "title": "${copy.schemaInsightTitle}",
    "description": "${copy.schemaInsightDescription}"
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
  1. a specific physical or sensory difference
  2. the user condition this difference matters for
  3. why this product feels stronger than nearby alternatives
- Each product explanation must also reflect:
  1. skin type reasoning
  2. concern reasoning
  3. texture or finish reasoning
  4. environment or routine reasoning
- reason must be 1 to 2 concise sentences total.
- comparison_reason must be exactly 1 sentence.
- comparison_reason must stay under 25 words.
- Start both reason and comparison_reason directly with the product effect or usage difference.
- Do not begin any product sentence with comparison lead-ins such as:
  - "같은 ..."
  - "... 기준으로 보면"
  - "...보다"
  - "... 흐름에서는"
  - "...와 비교하면"
- Product copy should talk about the product first, not the comparison target first.
- Do not repeat the same opening across products.
- Avoid vague phrases like "피부 타입에 잘 맞음", "고민을 반영함", "안정적으로 맞음".
- Avoid vague words or phrases like "적합합니다", "효과적입니다", "조화롭습니다", "우선순위가 높습니다", "좋은 선택입니다", "대응력이 높습니다".
- Do not use ranking phrases like "순위", "앞섰다", "선택됐다".
- End each sentence with a concrete user-facing effect, not a vague evaluation.
- Vary the outcome naturally and do not overuse endings like "유지됩니다" or "이어집니다".
- Use direct outcomes such as:
  - "늦게 올라옵니다"
  - "빠르게 가라앉습니다"
  - "겉도는 느낌이 줄어듭니다"
  - "밀림이 적습니다"
  - "흡수 흐름이 끊기지 않습니다"
- Use this sentence structure in Korean for comparison_reason:
  - "[명확한 차이] [구체적인 사용자 조건]에서 [구체적인 체감 결과]가 남습니다."
- Keep the same logic order in every explanation:
  key difference -> user condition -> outcome.
- Keep comparison_reason to one sentence only.
- Every explanation must include both:
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
- If an explanation does not contain both a real physical difference and a real user condition, rewrite it before returning JSON.
- If comparison_reason is longer than 25 words, rewrite it shorter before returning JSON.
- Use specific phrasing such as:
  - "번들 막이 늦게 올라와 오후 유분이 빠른 피부에서 겉도는 느낌이 줄어듭니다."
  - "세안 후 당김이 천천히 올라와 건성 피부에서도 다음 단계가 끊기지 않습니다."
  - "자극 반응이 덜 올라와 마스크 마찰이 있는 민감 피부에서 붉은 기운이 빨리 가라앉습니다."
- Make each explanation feel product-specific, direct, and not template-like.
- Each array must contain exactly 3 entries except productExplanations.
- productExplanations must contain exactly ${productCount} objects.
- summary must be within 3 short lines.
- strategy must be exactly 1 sentence.
`.trim();
}

function normalizeResult(parsed, locale = "ko") {
  const copy = getAnalyzeCopy(locale);
  const ensureList = (value, fallback) => {
    if (Array.isArray(value)) {
      return value.slice(0, 3).map((item) => String(item));
    }
    return fallback;
  };

  return {
    summary: String(parsed?.summary || (locale === "en" ? "Could not generate a skin summary." : "피부 요약을 생성하지 못했습니다.")),
    strategy: String(parsed?.strategy || (locale === "en" ? "Lower irritation first and organize the routine around products that feel right." : "자극을 줄이고 사용감이 맞는 루틴부터 가볍게 정리하세요.")),
    morning: ensureList(parsed?.morning, [
      locale === "en" ? "Cleanse lightly with a gentle cleanser" : "순한 클렌저로 가볍게 세안하기",
      locale === "en" ? "Balance hydration with a light layer" : "가벼운 수분층으로 유수분 균형 맞추기",
      locale === "en" ? "Finish with sunscreen" : "자외선 차단제로 마무리하기"
    ]),
    night: ensureList(parsed?.night, [
      locale === "en" ? "Remove buildup without over-cleansing" : "과하지 않게 노폐물 정리하기",
      locale === "en" ? "Add one calming or moisturizing step for the main concern" : "고민에 맞는 진정 또는 보습 단계 더하기",
      locale === "en" ? "Finish with a comfortable moisturizer" : "부담 없는 보습제로 마무리하기"
    ]),
    avoid: ensureList(parsed?.avoid, [
      locale === "en" ? "Do not stack too many products at once" : "한 번에 너무 많은 제품을 겹쳐 바르기",
      locale === "en" ? "Do not keep using heavy textures that feel wrong" : "피부 상태와 맞지 않는 무거운 제형 계속 쓰기",
      locale === "en" ? "Do not repeat harsh cleansing or peeling too often" : "강한 세정이나 필링을 자주 반복하기"
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
          title: String(parsed.funInsight?.title || copy.schemaInsightTitle),
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
        throw new Error(getAnalyzeCopy("ko").parseJsonError);
      }
    }

    throw new Error(getAnalyzeCopy("ko").nonJsonError);
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
    why_picked: product.why_picked,
    caution_note: product.caution_note,
    matched_signals: product.matched_signals,
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

function buildUserContext(formInput, locale = "ko") {
  const labels = locale === "en"
    ? {
        skinType: "Skin type",
        sensitivity: "Sensitivity",
        concern: "Main concern",
        cleansing: "Cleansing frequency",
        texture: "Preferred texture",
        postWash: "Post-wash feel",
        afternoon: "Afternoon skin change",
        exposure: "Environment exposure",
        dislike: "Most disliked feel",
        outdoor: "Outdoor exposure context",
        sensitivePeriod: "Very sensitive period",
        none: "None",
        yes: "Yes",
        no: "No"
      }
    : {
        skinType: "피부 타입",
        sensitivity: "민감도",
        concern: "주요 고민",
        cleansing: "세안 빈도",
        texture: "선호 제형",
        postWash: "세안 후 느낌",
        afternoon: "오후 피부 변화",
        exposure: "환경 노출",
        dislike: "피하고 싶은 사용감",
        outdoor: "야외 노출 컨텍스트",
        sensitivePeriod: "매우 예민한 시기",
        none: "없음",
        yes: "예",
        no: "아니오"
      };
  const mainConcerns = Array.isArray(formInput.mainConcerns) && formInput.mainConcerns.length
    ? formInput.mainConcerns.join(", ")
    : formInput.mainConcern;

  return [
    `- ${labels.skinType}: ${formInput.skinType}`,
    `- ${labels.sensitivity}: ${formInput.sensitivity}`,
    `- ${labels.concern}: ${mainConcerns}`,
    `- ${labels.cleansing}: ${formInput.cleansingFrequency}`,
    `- ${labels.texture}: ${formInput.preferredTexture}`,
    `- ${labels.postWash}: ${formInput.postWashFeeling}`,
    `- ${labels.afternoon}: ${formInput.afternoonSkinChange}`,
    `- ${labels.exposure}: ${(formInput.environmentExposure || []).join(", ") || labels.none}`,
    `- ${labels.dislike}: ${formInput.mostDislikedFeel}`,
    `- ${labels.outdoor}: ${formInput.outdoorExposure ? labels.yes : labels.no}`,
    `- ${labels.sensitivePeriod}: ${formInput.verySensitivePeriod ? labels.yes : labels.no}`
  ].join("\n");
}

function parseBooleanField(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return null;
}

function parseJsonArrayField(value) {
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const image = formData.get("image");
    const skinType = formData.get("skinType");
    const sensitivity =
      formData.get("sensitivityLevel") || formData.get("sensitivity");
    const mainConcern = formData.get("mainConcern");
    const mainConcerns = parseJsonArrayField(formData.get("mainConcerns"));
    const cleansingFrequency = formData.get("cleansingFrequency");
    const preferredTexture =
      formData.get("texturePreference") || formData.get("preferredTexture");
    const postWashFeeling =
      formData.get("postCleanseFeel") || formData.get("postWashFeeling");
    const afternoonSkinChange =
      formData.get("afternoonState") || formData.get("afternoonSkinChange");
    const environmentExposure = parseJsonArrayField(formData.get("environmentExposure"));
    const mostDislikedFeel =
      formData.get("dislikedFeel") || formData.get("mostDislikedFeel");
    const outdoorExposure = parseBooleanField(formData.get("outdoorExposure"));
    const verySensitivePeriod = parseBooleanField(formData.get("verySensitivePeriod"));
    const locale = formData.get("locale") === "en" ? "en" : "ko";
    const copy = getAnalyzeCopy(locale);
    const resolvedMainConcern =
      (typeof mainConcern === "string" && mainConcern) || mainConcerns[0] || "";
    const imageValidation = validateImageUpload(image);

    if (
      !image ||
      !skinType ||
      !sensitivity ||
      !resolvedMainConcern ||
      !cleansingFrequency ||
      !preferredTexture ||
      !postWashFeeling ||
      !afternoonSkinChange ||
      !mostDislikedFeel
    ) {
      return NextResponse.json(
        { error: copy.missingRequired },
        { status: 400 }
      );
    }

    if (!imageValidation.ok) {
      const errorMessage = imageValidation.code === "too_large"
        ? copy.imageTooLarge
        : copy.invalidImageType;

      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      );
    }

    const formInput = {
      skinType,
      sensitivity,
      mainConcern: resolvedMainConcern,
      mainConcerns: mainConcerns.length ? mainConcerns : undefined,
      cleansingFrequency,
      preferredTexture,
      postWashFeeling,
      afternoonSkinChange,
      environmentExposure,
      mostDislikedFeel,
      outdoorExposure:
        typeof outdoorExposure === "boolean"
          ? outdoorExposure
          : environmentExposure.includes("outdoor"),
      verySensitivePeriod: Boolean(verySensitivePeriod)
    };

    const recommendation = await buildRecommendationBundle(formInput);
    const ruleBasedPlan = buildRuleBasedPlan(formInput, locale);
    const optionalSkinNote = ruleBasedPlan.funInsight;
    const fallbackAnalysis = buildFallbackAnalysis(
      formInput,
      recommendation,
      ruleBasedPlan,
      locale
    );
    const apiKey = process.env.OPENROUTER_API_KEY;
    const writeAccessToken = createWriteAccessToken();
    const withWriteAccessToken = (payload) => ({
      ...payload,
      writeAccessToken
    });

    logAnalyze("request:prepared", {
      hasApiKey: Boolean(apiKey),
      model: OPENROUTER_MODEL,
      maxTokens: OPENROUTER_MAX_TOKENS,
      referer: HTTP_REFERER,
      title: X_TITLE,
      locale,
      mainConcern: formInput.mainConcern,
      skinType: formInput.skinType,
      selectedProductCount: recommendation.products?.length || 0
    });

    if (!apiKey) {
      logAnalyze("fallback:missing_api_key", {
        env: process.env.VERCEL ? "vercel" : "local"
      });

      return NextResponse.json(withWriteAccessToken({
        ...fallbackAnalysis,
        topPick: recommendation.topPick,
        categoryPicks: recommendation.categoryPicks,
        alternative: recommendation.alternative,
        products: recommendation.products,
        funInsight: optionalSkinNote,
        scoring: recommendation.scoring,
        meta: {
          source: "mock",
          notice: copy.missingApiKeyNotice
        }
      }));
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
          createJsonSchemaPrompt(selectedProductsContext.length, locale),
          "",
          copy.surveyInfo,
          buildUserContext(formInput, locale),
          "",
          copy.selectedProducts,
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
        text: copy.imageFallbackText
      });
    }

    logAnalyze("openrouter:fetch:start", {
      model: OPENROUTER_MODEL,
      maxTokens: OPENROUTER_MAX_TOKENS,
      hasImage: Boolean(imageDataUrl),
      env: process.env.VERCEL ? "vercel" : "local"
    });

    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": HTTP_REFERER,
        "X-Title": X_TITLE
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        max_tokens: OPENROUTER_MAX_TOKENS,
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: createJsonSchemaPrompt(selectedProductsContext.length, locale)
          },
          {
            role: "user",
            content
          }
        ]
      })
    });

    const { data, rawText, status, ok } = await readOpenRouterResponse(response);

    logAnalyze("openrouter:fetch:end", {
      status,
      ok,
      errorPreview: previewText(data?.error?.message || data?.error || rawText)
    });

    if (!ok) {
      logAnalyze("fallback:openrouter_non_ok", {
        status,
        bodyPreview: previewText(rawText),
        errorPreview: previewText(data?.error?.message || data?.error)
      });

      return NextResponse.json(withWriteAccessToken({
        ...fallbackAnalysis,
        topPick: recommendation.topPick,
        categoryPicks: recommendation.categoryPicks,
        alternative: recommendation.alternative,
        products: recommendation.products,
        funInsight: optionalSkinNote,
        scoring: recommendation.scoring,
        meta: {
          source: "mock",
          notice: copy.fetchFailNotice
        },
        error:
          data?.error?.message ||
          data?.error ||
          rawText ||
          `${copy.fetchFailError} (${status})`
      }));
    }

    const rawContent = extractTextContent(data?.choices?.[0]?.message?.content);

    logAnalyze("openrouter:content:received", {
      hasContent: Boolean(rawContent),
      contentPreview: previewText(rawContent)
    });

    if (!rawContent) {
      logAnalyze("fallback:empty_content", {
        status,
        bodyPreview: previewText(rawText)
      });

      return NextResponse.json(withWriteAccessToken({
        ...fallbackAnalysis,
        topPick: recommendation.topPick,
        categoryPicks: recommendation.categoryPicks,
        alternative: recommendation.alternative,
        products: recommendation.products,
        funInsight: optionalSkinNote,
        scoring: recommendation.scoring,
        meta: {
          source: "mock",
          notice: copy.emptyBodyNotice
        }
      }));
    }

    try {
      const parsed = safeParse(rawContent);
      logAnalyze("openrouter:parse:success", {
        summaryPreview: previewText(parsed?.summary),
        explanationCount: Array.isArray(parsed?.productExplanations)
          ? parsed.productExplanations.length
          : 0
      });
      const normalized = normalizeResult(parsed, locale);
      const explainedRecommendation = applyExplanationBundle(
        recommendation,
        normalized.productExplanations
      );

      return NextResponse.json(withWriteAccessToken({
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
      }));
    } catch (parseError) {
      logAnalyze("fallback:parse_error", {
        message: parseError instanceof Error ? parseError.message : String(parseError),
        contentPreview: previewText(rawContent)
      });

      return NextResponse.json(withWriteAccessToken({
        ...fallbackAnalysis,
        topPick: recommendation.topPick,
        categoryPicks: recommendation.categoryPicks,
        alternative: recommendation.alternative,
        products: recommendation.products,
        funInsight: optionalSkinNote,
        scoring: recommendation.scoring,
        meta: {
          source: "mock",
          notice: copy.parseFailNotice
        },
        error:
          (parseError instanceof Error ? parseError.message : "") ||
          copy.parseFailError
      }));
    }
  } catch (error) {
    logAnalyze("fallback:catch", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? previewText(error.stack, 600) : ""
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

