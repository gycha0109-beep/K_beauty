import { NextResponse } from "next/server";
import { createPhotoEvidencePrompt, buildFallbackPhotoAnalysis, normalizePhotoAnalysis } from "@/lib/photo-evidence";
import { buildSkinMatchDecisionBundle } from "@/lib/skin-match-decision-engine";
import {
  createPremiumReportSession,
  getPremiumReportCookieOptions,
  PREMIUM_REPORT_COOKIE
} from "@/lib/premium-report-session";
import { formatUploadSize, validateImageUpload } from "@/lib/upload-validation";
import { createWriteAccessToken, WRITE_ACCESS_HEADER } from "@/lib/write-access";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const FREE_OPENAI_MODEL = "gpt-4o-mini";
const PREMIUM_OPENAI_MODEL = "gpt-4o";
const PHOTO_ANALYSIS_MAX_TOKENS = 600;
const PRODUCT_EXPLANATION_MAX_TOKENS = 700;

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
  if (!value) {
    return "";
  }

  const text = String(value).replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
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
- Ground every reason in the provided survey evidence, photo evidence, and decision priority.
- Every reason must mention:
  1. skin type or current skin state
  2. main concern or selected priority
  3. texture or finish fit
  4. one avoidance point or constraint the product avoids
- comparison_reason must explain why this product is more practical than nearby alternatives for this exact user.
- Keep reason to 2 short sentences max.
- Keep comparison_reason to 1 sentence max.
- Do not use ranking language like "won", "beat", or "first place".
- If photo evidence is limited, lean more on survey evidence rather than inventing visual claims.
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
    hard_penalty: product.decision_meta?.hard_penalty,
    current_reason: product.reason,
    current_comparison_reason: product.comparison_reason
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
            ? decision.premiumReport.supportingProducts.map(
                (product) => byExpandedId.get(product.id) || product
              )
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

function sanitizePremiumReport(report) {
  if (!report) {
    return null;
  }

  return {
    topPickDetailedReason: String(report.topPickDetailedReason || "").trim(),
    supportingProducts: Array.isArray(report.supportingProducts)
      ? report.supportingProducts.map(sanitizeProductForPremium).filter(Boolean).slice(0, 3)
      : [],
    fullRoutine: {
      morning: Array.isArray(report.fullRoutine?.morning)
        ? report.fullRoutine.morning.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 4)
        : [],
      night: Array.isArray(report.fullRoutine?.night)
        ? report.fullRoutine.night.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 4)
        : []
    },
    avoidCombinations: Array.isArray(report.avoidCombinations)
      ? report.avoidCombinations.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 4)
      : [],
    budgetAlternatives: Array.isArray(report.budgetAlternatives)
      ? report.budgetAlternatives
          .map((item) => ({
            id: item?.id || "",
            name: item?.name || "",
            brand: item?.brand || "",
            step: item?.step || "",
            price_range: item?.price_range || "",
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
    topPick: decision.topPick || null,
    alternative: decision.alternative || null,
    amFocus: decision.amFocus || "",
    pmFocus: decision.pmFocus || "",
    warnings: Array.isArray(decision.warnings) ? decision.warnings.slice(0, 1) : [],
    photoEvidence: Array.isArray(decision.photoEvidence) ? decision.photoEvidence.slice(0, 3) : [],
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

async function extractPhotoAnalysis({ apiKey, imageDataUrl, locale, model }) {
  if (!apiKey || !imageDataUrl) {
    return buildFallbackPhotoAnalysis(locale);
  }

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
          content: createPhotoEvidencePrompt(locale)
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: createPhotoEvidencePrompt(locale)
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
  const allowedIds = new Set(selectedProducts.map((product) => product.id).filter(Boolean));
  const prompt = buildExplanationPrompt(locale, selectedProducts);
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
              {
                skinType: formInput.skinType,
                sensitivity: formInput.sensitivity,
                mainConcern: formInput.mainConcern,
                mainConcerns: formInput.mainConcerns || [],
                preferredTexture: formInput.preferredTexture,
                postWashFeeling: formInput.postWashFeeling,
                afternoonSkinChange: formInput.afternoonSkinChange,
                environmentExposure: formInput.environmentExposure || [],
                mostDislikedFeel: formInput.mostDislikedFeel,
                outdoorExposure: formInput.outdoorExposure,
                verySensitivePeriod: formInput.verySensitivePeriod
              },
              null,
              2
            ),
            "",
            "Decision context",
            JSON.stringify(
              {
                priority: decision.priority,
                amFocus: decision.amFocus,
                pmFocus: decision.pmFocus,
                warnings: decision.warnings,
                photoEvidence: decision.photoEvidence,
                surveyEvidence: decision.surveyEvidence
              },
              null,
              2
            ),
            "",
            "Selected products",
            JSON.stringify(selectedProducts, null, 2)
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

    const apiKey = process.env.OPENAI_API_KEY;
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

    let photoAnalysis = buildFallbackPhotoAnalysis(locale);
    let photoNotice = "";

    if (apiKey && imageDataUrl) {
      try {
        photoAnalysis = await extractPhotoAnalysis({
          apiKey,
          imageDataUrl,
          locale,
          model
        });
      } catch (photoError) {
        photoAnalysis = buildFallbackPhotoAnalysis(locale);
        photoNotice = copy.photoFallbackNotice;
        logAnalyze("photo-evidence:fallback", {
          message: photoError instanceof Error ? photoError.message : String(photoError)
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
          message: explanationError instanceof Error ? explanationError.message : String(explanationError)
        });
      }
    } else {
      explanationNotice = copy.missingApiKeyNotice;
    }

    const publicDecision = buildFreeDecisionPayload(decision);
    const premiumReport = sanitizePremiumReport(decision.premiumReport);
    const premiumSessionToken = createPremiumReportSession({
      premiumReport,
      locale
    });
    const response = NextResponse.json({
      ...publicDecision,
      meta: {
        source: "skin-match-v2",
        notice: [photoNotice, explanationNotice].filter(Boolean).join(" ").trim(),
        explanationSource: apiKey && !explanationNotice ? "openai" : "deterministic",
        photoEvidenceSource: apiKey && !photoNotice ? "openai" : "fallback"
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
        error: error instanceof Error ? error.message : "Server error."
      },
      { status: 500 }
    );
  }
}
