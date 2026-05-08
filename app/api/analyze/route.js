import { NextResponse } from "next/server";
import { createPhotoEvidencePrompt, buildFallbackPhotoAnalysis, normalizePhotoAnalysis } from "@/lib/photo-evidence";
import { buildSkinMatchDecisionBundle } from "@/lib/skin-match-decision-engine";
import {
  createPremiumReportSession,
  getPremiumReportCookieOptions,
  PREMIUM_REPORT_COOKIE
} from "@/lib/premium-report-session";
import { appendReviewEvidenceSentence } from "@/lib/review-signals";
import { formatUploadSize, validateImageUpload } from "@/lib/upload-validation";
import { createWriteAccessToken, WRITE_ACCESS_HEADER } from "@/lib/write-access";
import { getOpenAiEnvDiagnostics, previewDiagnosticText, resolveOpenAiApiKey } from "@/lib/openai-env-diagnostics";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const FREE_OPENAI_MODEL = "gpt-4o-mini";
const PREMIUM_OPENAI_MODEL = "gpt-4o";
const PHOTO_ANALYSIS_MAX_TOKENS = 900;
const PRODUCT_EXPLANATION_MAX_TOKENS = 1400;

const ANALYZE_COPY = {
  ko: {
    missingRequired: "필수 입력값이 비어 있습니다.",
    invalidImageType: "JPEG, PNG, WEBP 이미지만 업로드할 수 있습니다.",
    imageTooLarge: `이미지 용량은 ${formatUploadSize()} 이하만 업로드할 수 있습니다.`,
    missingApiKeyNotice: "OpenAI API 키가 없어 결정 엔진 기본 설명으로 결과를 표시합니다.",
    photoFallbackNotice: "사진 판독은 보수적으로 처리되고 설문 비중이 높아졌습니다.",
    explanationFallbackNotice: "설명 생성에 실패해 결정 엔진 기본 설명을 표시합니다.",
    serverError: "서버 오류가 발생했습니다."
  },
  en: {
    missingRequired: "Required input values are missing.",
    invalidImageType: "Only JPEG, PNG, and WEBP images are allowed.",
    imageTooLarge: `Images must be ${formatUploadSize()} or smaller.`,
    missingApiKeyNotice: "No OpenAI API key was found, so the deterministic engine text is shown instead.",
    photoFallbackNotice: "Photo evidence was handled conservatively, so the survey carried more weight.",
    explanationFallbackNotice: "Explanation generation failed, so the deterministic engine text is shown instead.",
    serverError: "A server error occurred."
  }
};

function getAnalyzeCopy(locale = "ko") {
  return ANALYZE_COPY[locale] || ANALYZE_COPY.ko;
}

function previewText(value, maxLength = 240) {
  return previewDiagnosticText(value, maxLength);
}

function logAnalyze(stage, payload = {}) {
  console.log(`[analyze] ${stage}`, payload);
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

function resolveAnalyzeModel(isPremium = false) {
  return isPremium ? PREMIUM_OPENAI_MODEL : FREE_OPENAI_MODEL;
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
    if (!matched) {
      throw new Error("Did not receive JSON.");
    }
    return JSON.parse(matched[0]);
  }
}

async function readOpenAiResponse(response) {
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

function buildExplanationPrompt(locale = "ko", selectedProducts = []) {
  const isEnglish = locale === "en";

  return `
You are writing explanation text only for products already selected by a deterministic Skin Match engine.
Return only valid JSON.
Do not use markdown.
Do not change products.
Do not pick products.
Do not rename products.
Do not suggest extra products.
${isEnglish ? "Use English." : "Use Korean."}

Required JSON shape:
{
  "productExplanations": [
    {
      "id": "product-id",
      "reason": "${isEnglish ? "Two short sentences." : "두 문장 이내"}",
      "comparison_reason": "${isEnglish ? "One short sentence." : "한 문장"}"
    }
  ]
}

Rules:
- Product ids are fixed and must match the provided ids only.
- Ground every reason in the provided survey evidence, photo evidence, decision priority, and the product's existing category/role.
- Use photoObservations as cautious visual support when it is available, but do not overstate photo findings.
- You may rewrite explanation only. You may not choose, replace, reorder, rename, or invent products.
- Use the detailed survey block and the product-step survey cues block together. Do not ignore step-specific survey details.
- Every reason must follow this structure:
  1. current user skin state
  2. the priority being addressed
  3. why this product category or role fits
  4. one concrete usage direction
- Keep the explanation consultative and specific, like a beauty consultation.
- Prefer natural user-facing Korean. Avoid stiff translated phrasing.
- Do not use generic filler such as:
  - "피부에 좋습니다"
  - "추천할 만합니다"
  - "적합합니다" without explaining why
- For sunscreen, mention UV or outdoor protection and finish burden when relevant.
- For cleanser, mention oiliness, breakouts, or cleansing burden when relevant.
- For toner_essence or toner_pad, mention pores, texture, surface refinement, and frequency caution when relevant.
- For serum or ampoule, mention calming, hydration, breakouts, or redness support when relevant.
- For moisturizer, mention hydration retention, barrier comfort, or recovery when relevant.
- When relevant, reflect concrete survey details such as:
  - post-wash tightness
  - afternoon oil rise
  - high sensitivity
  - cleansing frequency
  - dislike of stickiness or heaviness
  - outdoor exposure
  - white-cast dislike
  - tone-up preference
  - makeup use
  - eye sensitivity
- comparison_reason must explain why this product is more practical than nearby alternatives for this exact user.
- Keep reason to 2 short sentences max.
- Keep comparison_reason to 1 sentence max.
- Do not use ranking language like "won", "beat", or "first place".
- If photo evidence is limited, lean more on survey evidence rather than inventing visual claims.
- If photoObservations has usable signals, weave at most one cautious photo-based phrase into the reason.
- productExplanations must contain exactly ${selectedProducts.length} items.
`.trim();
}

function buildSelectedProductsContext(decision) {
  return (decision.explanationProducts || decision.products || []).map((product) => ({
    id: product.id,
    name: product.name,
    brand: product.brand,
    category: product.category,
    step: product.step,
    texture: product.texture,
    finish: product.finish,
    use_time: product.use_time,
    score: product.engine_score,
    base_score: product.decision_meta?.base_score,
    hero_boost: product.decision_meta?.hero_boost,
    review_signal_score: product.decision_meta?.review_signal_score,
    hard_penalty: product.decision_meta?.hard_penalty,
    current_reason: product.reason,
    current_comparison_reason: product.comparison_reason
  }));
}

function getPromptCategoryFamily(category = "") {
  const normalized = String(category || "").trim().toLowerCase();

  if (normalized === "toner_pad" || normalized === "toner_essence" || normalized === "essence") {
    return "toner_essence";
  }

  if (normalized === "serum" || normalized === "ampoule") {
    return "serum_ampoule";
  }

  return normalized;
}

function buildSurveyContextForLlm(formInput = {}) {
  return {
    skinType: formInput.skinType,
    sensitivity: formInput.sensitivity,
    genderPreference: formInput.genderPreference,
    mainConcern: formInput.mainConcern,
    mainConcerns: formInput.mainConcerns || [],
    cleansingFrequency: formInput.cleansingFrequency,
    preferredTexture: formInput.preferredTexture,
    postWashFeeling: formInput.postWashFeeling,
    afternoonSkinChange: formInput.afternoonSkinChange,
    environmentExposure: formInput.environmentExposure || [],
    mostDislikedFeel: formInput.mostDislikedFeel,
    whiteCastHate: Boolean(formInput.whiteCastHate),
    toneUpWanted: Boolean(formInput.toneUpWanted),
    makeupUse: Boolean(formInput.makeupUse),
    eyeSensitive: Boolean(formInput.eyeSensitive),
    outdoorExposure: Boolean(formInput.outdoorExposure),
    verySensitivePeriod: Boolean(formInput.verySensitivePeriod)
  };
}

function buildStepSurveyCues(formInput = {}) {
  return {
    cleanser: {
      cleansingFrequency: formInput.cleansingFrequency,
      postWashFeeling: formInput.postWashFeeling,
      afternoonSkinChange: formInput.afternoonSkinChange,
      sensitivity: formInput.sensitivity,
      mostDislikedFeel: formInput.mostDislikedFeel
    },
    toner_essence: {
      mainConcern: formInput.mainConcern,
      mainConcerns: formInput.mainConcerns || [],
      sensitivity: formInput.sensitivity,
      postWashFeeling: formInput.postWashFeeling,
      afternoonSkinChange: formInput.afternoonSkinChange,
      preferredTexture: formInput.preferredTexture
    },
    serum_ampoule: {
      mainConcern: formInput.mainConcern,
      mainConcerns: formInput.mainConcerns || [],
      sensitivity: formInput.sensitivity,
      verySensitivePeriod: Boolean(formInput.verySensitivePeriod),
      postWashFeeling: formInput.postWashFeeling,
      afternoonSkinChange: formInput.afternoonSkinChange
    },
    moisturizer: {
      skinType: formInput.skinType,
      sensitivity: formInput.sensitivity,
      postWashFeeling: formInput.postWashFeeling,
      afternoonSkinChange: formInput.afternoonSkinChange,
      mostDislikedFeel: formInput.mostDislikedFeel,
      verySensitivePeriod: Boolean(formInput.verySensitivePeriod)
    },
    sunscreen: {
      outdoorExposure: Boolean(formInput.outdoorExposure),
      whiteCastHate: Boolean(formInput.whiteCastHate),
      toneUpWanted: Boolean(formInput.toneUpWanted),
      makeupUse: Boolean(formInput.makeupUse),
      eyeSensitive: Boolean(formInput.eyeSensitive),
      mostDislikedFeel: formInput.mostDislikedFeel,
      preferredTexture: formInput.preferredTexture
    }
  };
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

function applyExplanationBundle(decision, explanationItems) {
  const explainedProducts = applyProductExplanations(decision.products || [], explanationItems);
  const explainedExplanationProducts = applyProductExplanations(
    decision.explanationProducts || decision.products || [],
    explanationItems
  );
  const byId = new Map(explainedProducts.map((product) => [product.id, product]));
  const byExpandedId = new Map(explainedExplanationProducts.map((product) => [product.id, product]));
  const explainedAltPicks = (decision.altPicks || []).map(
    (product) => byId.get(product.id) || product
  );
  const explainedTopPick = decision.topPick
    ? byId.get(decision.topPick.id) || decision.topPick
    : null;

  return {
    ...decision,
    topPick: explainedTopPick,
    altPicks: explainedAltPicks,
    alternative: explainedAltPicks[0] || null,
    categoryPicks: explainedAltPicks,
    products: explainedProducts
      .filter(Boolean),
    explanationProducts: explainedExplanationProducts,
    premiumReport: decision.premiumReport
      ? {
          ...decision.premiumReport,
          topPickDetailedReason: decision.premiumReport.topPickDetailedReason || "",
          supportingProducts: Array.isArray(decision.premiumReport.supportingProducts)
            ? decision.premiumReport.supportingProducts.map((item) => {
                if (item?.product) {
                  return {
                    ...item,
                    product: byExpandedId.get(item.product.id) || item.product
                  };
                }

                return byExpandedId.get(item?.id) || item;
              })
            : []
        }
      : null
  };
}

function sanitizeProductForPremium(product) {
  if (!product) {
    return null;
  }

  return {
    id: product.id || "",
    name: product.name || "",
    brand: product.brand || "",
    category: product.category || "",
    step: product.step || "",
    texture: product.texture || "",
    finish: product.finish || "",
    use_time: product.use_time || "",
    price_range: product.price_range || "",
    buy_link: product.buy_link || "",
    image_url: product.image_url || "",
    reason: product.reason || "",
    comparison_reason: product.comparison_reason || ""
  };
}

function sanitizeSupportingProductForPremium(item) {
  if (!item) {
    return null;
  }

  if (item.product) {
    const product = sanitizeProductForPremium(item.product);

    if (!product) {
      return null;
    }

    return {
      role: String(item.role || "").trim(),
      label: String(item.label || "").trim(),
      product,
      reason: String(item.reason || "").trim(),
      usage: String(item.usage || "").trim(),
      relationToTopPick: String(item.relationToTopPick || "").trim()
    };
  }

  return sanitizeProductForPremium(item);
}

function stripRawSignalBlobs(product) {
  if (!product || typeof product !== "object") {
    return product || null;
  }

  const nextProduct = {
    ...product
  };

  delete nextProduct.review_signals;
  delete nextProduct.market_signals;
  delete nextProduct.ingredient_signals;
  return nextProduct;
}

function appendTopPickReviewEvidence(decision, locale = "ko") {
  if (!decision?.topPick) {
    return decision;
  }

  const applyToProduct = (product) => {
    if (!product) {
      return product;
    }

    const nextReason = appendReviewEvidenceSentence(product.reason, product.review_signals, locale);
    return nextReason === product.reason
      ? product
      : {
          ...product,
          reason: nextReason
        };
  };

  const topPick = applyToProduct(decision.topPick);
  const topPickId = topPick?.id;
  const updateById = (product) => (product?.id === topPickId ? applyToProduct(product) : product);

  return {
    ...decision,
    topPick,
    products: Array.isArray(decision.products) ? decision.products.map(updateById) : decision.products,
    explanationProducts: Array.isArray(decision.explanationProducts)
      ? decision.explanationProducts.map(updateById)
      : decision.explanationProducts,
    premiumReport: decision.premiumReport
      ? {
          ...decision.premiumReport,
          topPickDetailedReason: appendReviewEvidenceSentence(
            decision.premiumReport.topPickDetailedReason,
            topPick?.review_signals,
            locale
          )
        }
      : decision.premiumReport
  };
}

function sanitizeRoutineStructure(structure) {
  if (!structure || typeof structure !== "object") {
    return null;
  }

  return {
    type: String(structure.type || "").trim(),
    label: String(structure.label || "").trim(),
    title: String(structure.title || "").trim(),
    body: String(structure.body || "").trim(),
    am: structure.am && typeof structure.am === "object"
      ? {
          mode: String(structure.am.mode || "").trim(),
          label: String(structure.am.label || "").trim(),
          strategyLine: String(structure.am.strategyLine || "").trim()
        }
      : null,
    pm: structure.pm && typeof structure.pm === "object"
      ? {
          mode: String(structure.pm.mode || "").trim(),
          label: String(structure.pm.label || "").trim(),
          strategyLine: String(structure.pm.strategyLine || "").trim()
        }
      : null,
    cards: Array.isArray(structure.cards)
      ? structure.cards
          .map((item) => ({
            key: String(item?.key || "").trim(),
            label: String(item?.label || "").trim(),
            body: String(item?.body || "").trim(),
            mode: String(item?.mode || "").trim()
          }))
          .filter((item) => item.label || item.body)
          .slice(0, 3)
      : []
  };
}

function sanitizeRoutineStepForPremium(item) {
  if (!item || typeof item !== "object") {
    return null;
  }

  return {
    order: Number.isFinite(Number(item.order)) ? Number(item.order) : null,
    stepName: String(item.stepName || "").trim(),
    productRole: String(item.productRole || "").trim(),
    product: sanitizeProductForPremium(item.product || null),
    instruction: String(item.instruction || "").trim(),
    frequency: String(item.frequency || "").trim(),
    caution: String(item.caution || "").trim()
  };
}

function sanitizePhotoObservationsForPremium(observations) {
  if (!observations || typeof observations !== "object") {
    return null;
  }

  return {
    summary: String(observations.summary || "").trim(),
    signals: Array.isArray(observations.signals)
      ? observations.signals
          .map((item) => ({
            key: String(item?.key || "").trim(),
            label: String(item?.label || "").trim(),
            area: String(item?.area || "").trim(),
            confidence: String(item?.confidence || "").trim(),
            description: String(item?.description || "").trim()
          }))
          .filter((item) => item.key && (item.label || item.area || item.description))
          .slice(0, 3)
      : [],
    surveyAlignment: observations.surveyAlignment && typeof observations.surveyAlignment === "object"
      ? {
          status: String(observations.surveyAlignment.status || "").trim(),
          note: String(observations.surveyAlignment.note || "").trim()
        }
      : null
  };
}

function sanitizePremiumReport(report) {
  if (!report) {
    return null;
  }

  return {
    topPickDetailedReason: String(report.topPickDetailedReason || "").trim(),
    supportingConcerns: Array.isArray(report.supportingConcerns)
      ? report.supportingConcerns.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 3)
      : [],
    supportingProducts: Array.isArray(report.supportingProducts)
      ? report.supportingProducts.map(sanitizeSupportingProductForPremium).filter(Boolean).slice(0, 3)
      : [],
    routineStructure: sanitizeRoutineStructure(report.routineStructure),
    photoObservations: sanitizePhotoObservationsForPremium(report.photoObservations),
    fullRoutine: {
      morning: Array.isArray(report.fullRoutine?.morning)
        ? report.fullRoutine.morning.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 5)
        : [],
      night: Array.isArray(report.fullRoutine?.night)
        ? report.fullRoutine.night.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 5)
        : [],
      morningSteps: Array.isArray(report.fullRoutine?.morningSteps)
        ? report.fullRoutine.morningSteps
            .map(sanitizeRoutineStepForPremium)
            .filter((item) => item?.stepName || item?.instruction || item?.product)
            .slice(0, 5)
        : [],
      nightSteps: Array.isArray(report.fullRoutine?.nightSteps)
        ? report.fullRoutine.nightSteps
            .map(sanitizeRoutineStepForPremium)
            .filter((item) => item?.stepName || item?.instruction || item?.product)
            .slice(0, 5)
        : []
    },
    routineVariants: Array.isArray(report.fullRoutine?.variants)
      ? report.fullRoutine.variants
          .map((variant) => ({
            key: String(variant?.key || "").trim(),
            label: String(variant?.label || "").trim(),
            items: Array.isArray(variant?.items)
              ? variant.items.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 3)
              : []
          }))
          .filter((variant) => variant.label || variant.items.length)
          .slice(0, 4)
      : [],
    avoidCombinations: Array.isArray(report.avoidCombinations)
      ? report.avoidCombinations.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 4)
      : [],
    budgetAlternatives: Array.isArray(report.budgetAlternatives)
      ? report.budgetAlternatives
            .map((item) => ({
              id: item?.id || "",
              name: item?.name || "",
              brand: item?.brand || "",
              category: item?.category || "",
              step: item?.step || "",
              texture: item?.texture || "",
              finish: item?.finish || "",
              use_time: item?.use_time || "",
              price_range: item?.price_range || "",
              price_min: Number.isFinite(Number(item?.price_min)) ? Number(item.price_min) : null,
              price_max: Number.isFinite(Number(item?.price_max)) ? Number(item.price_max) : null,
              buy_link: item?.buy_link || "",
              image_url: item?.image_url || "",
              summary: item?.summary || ""
            }))
          .filter((item) => item.id || item.name)
          .slice(0, 3)
      : []
  };
}

function buildFreeDecisionPayload(decision) {
  return {
    summary: decision.summary || "",
    priority: decision.priority || null,
    topPick: stripRawSignalBlobs(decision.topPick || null),
    alternative: stripRawSignalBlobs(decision.alternative || null),
    amFocus: decision.amFocus || "",
    pmFocus: decision.pmFocus || "",
    routineStructure: sanitizeRoutineStructure(decision.routineStructure),
    morning: Array.isArray(decision.morning) ? decision.morning.slice(0, 3) : [],
    night: Array.isArray(decision.night) ? decision.night.slice(0, 3) : [],
    warnings: Array.isArray(decision.warnings) ? decision.warnings.slice(0, 1) : [],
    photoEvidence: Array.isArray(decision.photoEvidence) ? decision.photoEvidence.slice(0, 3) : [],
    photoObservations: decision.photoObservations || null,
    surveyEvidence: Array.isArray(decision.surveyEvidence) ? decision.surveyEvidence.slice(0, 4) : []
  };
}

async function fetchOpenAiJson({ apiKey, body, stage }) {
  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const payload = await readOpenAiResponse(response);

  logAnalyze(stage, {
    status: payload.status,
    ok: payload.ok,
    preview: previewText(payload.data?.error?.message || payload.data?.error || payload.rawText)
  });

  if (!payload.ok) {
    throw new Error(
      payload.data?.error?.message ||
      payload.data?.error ||
      payload.rawText ||
      `OpenAI failed (${payload.status}).`
    );
  }

  const content = extractTextContent(payload.data?.choices?.[0]?.message?.content);

  if (!content) {
    throw new Error("OpenAI returned empty content.");
  }

  return safeParse(content);
}

async function extractPhotoAnalysis({ apiKey, imageDataUrl, locale, model, formInput }) {
  if (!apiKey || !imageDataUrl) {
    return buildFallbackPhotoAnalysis(locale);
  }

  const photoPrompt = createPhotoEvidencePrompt(locale, buildSurveyContextForLlm(formInput));
  const parsed = await fetchOpenAiJson({
    apiKey,
    stage: "photo-evidence",
    body: {
      model,
      max_tokens: PHOTO_ANALYSIS_MAX_TOKENS,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: photoPrompt
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: photoPrompt
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
    }
  });

  return normalizePhotoAnalysis(parsed, locale);
}

async function generateProductExplanations({ apiKey, locale, decision, formInput, model }) {
  if (!apiKey || !(decision.explanationProducts || decision.products)?.length) {
    return [];
  }

  const selectedProducts = buildSelectedProductsContext(decision);
  const surveyContext = buildSurveyContextForLlm(formInput);
  const stepSurveyCues = buildStepSurveyCues(formInput);
  const selectedProductsWithSurveyCues = selectedProducts.map((product) => ({
    ...product,
    categoryFamily: getPromptCategoryFamily(product.category),
    relevantSurveyCues: stepSurveyCues[getPromptCategoryFamily(product.category)] || {}
  }));
  const allowedIds = new Set(selectedProducts.map((product) => product.id).filter(Boolean));
  const prompt = buildExplanationPrompt(locale, selectedProductsWithSurveyCues);
  const parsed = await fetchOpenAiJson({
    apiKey,
    stage: "product-explanations",
    body: {
      model,
      max_tokens: PRODUCT_EXPLANATION_MAX_TOKENS,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: prompt
        },
        {
          role: "user",
          content: [
            prompt,
            "",
            "User input",
            JSON.stringify(
              surveyContext,
              null,
              2
            ),
            "",
            "Product-step survey cues",
            JSON.stringify(stepSurveyCues, null, 2),
            "",
            "Decision context",
            JSON.stringify(
              {
                priority: decision.priority,
                amFocus: decision.amFocus,
                pmFocus: decision.pmFocus,
                warnings: decision.warnings,
                photoEvidence: decision.photoEvidence,
                photoObservations: decision.photoObservations,
                surveyEvidence: decision.surveyEvidence
              },
              null,
              2
            ),
            "",
            "Selected products",
            JSON.stringify(selectedProductsWithSurveyCues, null, 2)
          ].join("\n")
        }
      ]
    }
  });

  return Array.isArray(parsed?.productExplanations)
    ? parsed.productExplanations
        .map((item) => ({
          id: String(item?.id || ""),
          reason: String(item?.reason || "").trim(),
          comparison_reason: String(item?.comparison_reason || "").trim()
        }))
        .filter((item) => allowedIds.has(item.id))
    : [];
}

export async function POST(request) {
  let responseLocale = "ko";

  try {
    const formData = await request.formData();
    const image = formData.get("image");
    const skinType = formData.get("skinType");
    const sensitivity =
      formData.get("sensitivityLevel") || formData.get("sensitivity");
    const genderPreference = formData.get("genderPreference");
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
    const whiteCastHate = parseBooleanField(formData.get("whiteCastHate"));
    const toneUpWanted = parseBooleanField(formData.get("toneUpWanted"));
    const makeupUse = parseBooleanField(formData.get("makeupUse"));
    const eyeSensitive = parseBooleanField(formData.get("eyeSensitive"));
    const outdoorExposure = parseBooleanField(formData.get("outdoorExposure"));
    const verySensitivePeriod = parseBooleanField(formData.get("verySensitivePeriod"));
    const isPremium = false;
    const locale = formData.get("locale") === "en" ? "en" : "ko";
    responseLocale = locale;
    const copy = getAnalyzeCopy(locale);
    const model = resolveAnalyzeModel(isPremium) || FREE_OPENAI_MODEL;
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
      return NextResponse.json({ error: copy.missingRequired }, { status: 400 });
    }

    if (!imageValidation.ok) {
      return NextResponse.json(
        {
          error:
            imageValidation.code === "too_large"
              ? copy.imageTooLarge
              : copy.invalidImageType
        },
        { status: 400 }
      );
    }

    const formInput = {
      skinType,
      sensitivity,
      genderPreference:
        typeof genderPreference === "string" && genderPreference
          ? genderPreference
          : "unspecified",
      mainConcern: resolvedMainConcern,
      mainConcerns: mainConcerns.length ? mainConcerns : undefined,
      cleansingFrequency,
      preferredTexture,
      postWashFeeling,
      afternoonSkinChange,
      environmentExposure,
      mostDislikedFeel,
      whiteCastHate: Boolean(whiteCastHate),
      toneUpWanted: Boolean(toneUpWanted),
      makeupUse: Boolean(makeupUse),
      eyeSensitive: Boolean(eyeSensitive),
      outdoorExposure:
        typeof outdoorExposure === "boolean"
          ? outdoorExposure
          : environmentExposure.includes("outdoor"),
      verySensitivePeriod: Boolean(verySensitivePeriod)
    };

    const { apiKey } = resolveOpenAiApiKey();
    const writeAccessToken = createWriteAccessToken();

    let imageDataUrl = null;

    if (typeof image.arrayBuffer === "function") {
      const buffer = Buffer.from(await image.arrayBuffer());
      imageDataUrl = `data:${image.type || "image/jpeg"};base64,${buffer.toString("base64")}`;
    }

    logAnalyze("request:prepared", {
      hasApiKey: Boolean(apiKey),
      isPremium,
      locale,
      model,
      mainConcern: formInput.mainConcern,
      skinType: formInput.skinType
    });
    if (process.env.NODE_ENV !== "production") {
      logAnalyze(
        "openai-env:diagnostic",
        getOpenAiEnvDiagnostics({
          route: "analyze",
          routeUsesOpenAi: true,
          routeUsesOpenRouter: false
        })
      );
    }

    let photoAnalysis = buildFallbackPhotoAnalysis(locale);
    let photoNotice = "";

    if (apiKey && imageDataUrl) {
      try {
        photoAnalysis = await extractPhotoAnalysis({
          apiKey,
          imageDataUrl,
          locale,
          model,
          formInput
        });
      } catch (photoError) {
        photoAnalysis = buildFallbackPhotoAnalysis(locale);
        photoNotice = copy.photoFallbackNotice;
        logAnalyze("photo-evidence:fallback", {
          message: previewDiagnosticText(photoError instanceof Error ? photoError.message : String(photoError))
        });
      }
    } else {
      photoNotice = copy.photoFallbackNotice;
    }

    let decision = await buildSkinMatchDecisionBundle(formInput, {
      locale,
      photoAnalysis
    });

    let explanationNotice = "";

    if (apiKey) {
      try {
        const explanationItems = await generateProductExplanations({
          apiKey,
          locale,
          decision,
          formInput,
          model
        });

        if (explanationItems.length) {
          decision = applyExplanationBundle(decision, explanationItems);
        }
      } catch (explanationError) {
        explanationNotice = copy.explanationFallbackNotice;
        logAnalyze("product-explanations:fallback", {
          message: previewDiagnosticText(explanationError instanceof Error ? explanationError.message : String(explanationError))
        });
      }
    } else {
      explanationNotice = copy.missingApiKeyNotice;
    }

    decision = appendTopPickReviewEvidence(decision, locale);

    const publicDecision = buildFreeDecisionPayload(decision);
    const premiumReport = sanitizePremiumReport(decision.premiumReport);
    const premiumSessionReport = premiumReport
      ? {
          ...premiumReport,
          freeResult: publicDecision
        }
      : null;
    const premiumSessionToken = await createPremiumReportSession({
      premiumReport: premiumSessionReport,
      locale
    });
    const response = NextResponse.json({
      ...publicDecision,
      meta: {
        source: "skin-match-v2",
        notice: [photoNotice, explanationNotice].filter(Boolean).join(" ").trim(),
        explanationSource: apiKey && !explanationNotice ? "openai" : "deterministic",
        photoEvidenceSource: apiKey && !photoNotice ? "openai" : "fallback",
        photoObservationsSource: apiKey && !photoNotice ? "openai" : "fallback"
      }
    });

    if (premiumSessionToken) {
      response.cookies.set(
        PREMIUM_REPORT_COOKIE,
        premiumSessionToken,
        getPremiumReportCookieOptions()
      );
    }

    if (writeAccessToken) {
      response.headers.set(WRITE_ACCESS_HEADER, writeAccessToken);
    }

    return response;
  } catch (error) {
    logAnalyze("request:error", {
      message: error instanceof Error ? error.message : String(error)
    });

    return NextResponse.json(
      {
        error: getAnalyzeCopy(responseLocale).serverError
      },
      { status: 500 }
    );
  }
}
