import { randomBytes } from "crypto";

const ANALYSIS_FEATURE_TYPE = "skin";
const RESULT_JSON_SCHEMA_VERSION = 1;

const DISPLAY_MAP = {
  ko: {
    skinType: {
      oily: "지성",
      dry: "건성",
      combination: "복합성",
      not_sure: "잘 모르겠음"
    },
    mainConcern: {
      oiliness: "유분",
      dehydration: "건조",
      acne: "트러블",
      uneven_tone: "톤 불균일",
      pores: "모공",
      redness: "붉은기",
      barrier: "장벽 약화"
    },
    title: "당신의 K-뷰티 매치",
    summary: "피부 요약",
    concern: "주요 고민",
    skinTypeLabel: "피부 타입",
    topPick: "Top Pick",
    supporting: "함께 보면 좋은 추천",
    routineAm: "아침 루틴",
    routinePm: "저녁 루틴",
    backHome: "홈으로 돌아가기",
    shareDescription: "저장된 결과를 불러오지 못했습니다."
  },
  en: {
    skinType: {
      oily: "Oily",
      dry: "Dry",
      combination: "Combination",
      not_sure: "Not sure"
    },
    mainConcern: {
      oiliness: "Oiliness",
      dehydration: "Dehydration",
      acne: "Breakouts",
      uneven_tone: "Uneven tone",
      pores: "Pores",
      redness: "Redness",
      barrier: "Barrier"
    },
    title: "Your K-Beauty Match",
    summary: "Summary",
    concern: "Main concerns",
    skinTypeLabel: "Skin type",
    topPick: "Top Pick",
    supporting: "Supporting picks",
    routineAm: "AM routine",
    routinePm: "PM routine",
    backHome: "Back to home",
    shareDescription: "Could not load the saved result."
  }
};

export function getShareLocale(locale = "ko") {
  return DISPLAY_MAP[locale] ? locale : "ko";
}

export function getShareCopy(locale = "ko") {
  return DISPLAY_MAP[getShareLocale(locale)];
}

export function normalizeConcernKeys(form = {}) {
  const concerns = Array.isArray(form?.mainConcerns) && form.mainConcerns.length
    ? form.mainConcerns
    : form?.mainConcern
      ? [form.mainConcern]
      : [];

  return concerns.filter(Boolean).slice(0, 5);
}

export function getConcernLabels(mainConcerns = [], locale = "ko") {
  const copy = getShareCopy(locale);
  return mainConcerns
    .map((item) => copy.mainConcern[item] || item)
    .filter(Boolean);
}

export function getSkinTypeLabel(skinType, locale = "ko") {
  const copy = getShareCopy(locale);
  return copy.skinType[skinType] || skinType || "-";
}

export function createShareId() {
  return randomBytes(6).toString("base64url");
}

export function getSharePath(shareId) {
  return `/r/${shareId}`;
}

export const PUBLIC_ANALYSIS_RESULT_SELECT =
  "id, share_id, created_at, locale, skin_type, main_concerns, summary, routine_am, routine_pm, recommended_products, is_public, image_url, result_json";

const SENSITIVE_SUBMISSION_KEYS = new Set([
  "imagepreviewdataurl",
  "previewdataurl",
  "imagedataurl",
  "photodataurl",
  "base64image",
  "imagebase64",
  "imagedata",
  "photoimagedata",
  "previewimage"
]);

function normalizeObjectKey(key) {
  return String(key || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function isInlineImageData(value) {
  return typeof value === "string" && /^data:image\//i.test(value.trim());
}

function sanitizeSubmissionForStorage(value) {
  if (!value || typeof value !== "object") {
    return isInlineImageData(value) ? null : value;
  }

  if (Array.isArray(value)) {
    return value
      .map(sanitizeSubmissionForStorage)
      .filter((item) => item !== null && item !== undefined);
  }

  return Object.entries(value).reduce((next, [key, item]) => {
    const normalizedKey = normalizeObjectKey(key);

    if (SENSITIVE_SUBMISSION_KEYS.has(normalizedKey) || isInlineImageData(item)) {
      return next;
    }

    const sanitizedItem = sanitizeSubmissionForStorage(item);

    if (sanitizedItem !== null && sanitizedItem !== undefined) {
      next[key] = sanitizedItem;
    }

    return next;
  }, {});
}

function stripRawSignalBlobsFromProduct(product) {
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

function sanitizeResultForStorage(result = {}) {
  if (!result || typeof result !== "object") {
    return {};
  }

  return {
    ...result,
    topPick: stripRawSignalBlobsFromProduct(result.topPick || null),
    alternative: stripRawSignalBlobsFromProduct(result.alternative || null),
    altPicks: Array.isArray(result.altPicks)
      ? result.altPicks.map(stripRawSignalBlobsFromProduct)
      : result.altPicks,
    categoryPicks: Array.isArray(result.categoryPicks)
      ? result.categoryPicks.map(stripRawSignalBlobsFromProduct)
      : result.categoryPicks,
    products: Array.isArray(result.products)
      ? result.products.map(stripRawSignalBlobsFromProduct)
      : result.products,
    explanationProducts: Array.isArray(result.explanationProducts)
      ? result.explanationProducts.map(stripRawSignalBlobsFromProduct)
      : result.explanationProducts
  };
}

function getResultJsonSource(result = {}) {
  const source = result?.meta?.source;
  return typeof source === "string" && source.trim()
    ? source.trim()
    : "skin-match-v2";
}

function normalizeStringArray(value, limit = 3) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, limit);
}

function getRoutineForStorage(result = {}, itemsKey, focusKey) {
  const routineItems = normalizeStringArray(result?.[itemsKey]);

  if (routineItems.length) {
    return routineItems;
  }

  return result?.[focusKey]
    ? normalizeStringArray([result[focusKey]])
    : [];
}

export function getRecommendedProductsForStorage(result = {}) {
  const products = [
    ...(result?.topPick ? [result.topPick] : []),
    ...(result?.alternative ? [result.alternative] : [])
  ];

  return products
    .filter(Boolean)
    .map((product) => ({
      id: product.id || "",
      name: product.name || "",
      brand: product.brand || "",
      step: product.step || "",
      reason: product.reason || "",
      comparison_reason: product.comparison_reason || "",
      buy_link: product.buy_link || "",
      image_url: product.image_url || "",
      price_range: product.price_range || "",
      use_time: product.use_time || ""
    }));
}

export function buildAnalysisRequestRow({
  submission,
  userId = null,
  supportsUserId = false,
  sessionId = null
} = {}) {
  const form = submission?.form && typeof submission.form === "object"
    ? submission.form
    : {};

  return {
    feature_type: ANALYSIS_FEATURE_TYPE,
    survey_json: form,
    image_url: null,
    ...(sessionId ? { session_id: sessionId } : {}),
    ...(supportsUserId ? { user_id: userId } : {})
  };
}

export function buildAnalysisResultRow({
  result,
  submission,
  locale = "ko",
  shareId,
  requestId,
  userId = null,
  supportsUserId = true,
  isPublic = false,
  anonymousWriteGrantUseId = null
}) {
  if (!requestId) {
    throw new Error("analysis_results.request_id is required.");
  }

  const normalizedLocale = getShareLocale(locale || submission?.locale);
  const form = submission?.form || {};
  const sanitizedResult = sanitizeResultForStorage(result || {});
  const safeSubmission = sanitizeSubmissionForStorage(submission || {});
  const summary = String(sanitizedResult?.summary || "");
  const recommendedProducts = getRecommendedProductsForStorage(sanitizedResult);
  const headlineLabel = String(
    sanitizedResult?.topPick?.name ||
    sanitizedResult?.priority?.label ||
    summary ||
    "Skin Match"
  ).trim();

  return {
    request_id: requestId,
    feature_type: ANALYSIS_FEATURE_TYPE,
    headline_label: headlineLabel || "Skin Match",
    result_json: {
      schemaVersion: RESULT_JSON_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      source: getResultJsonSource(sanitizedResult),
      locale: normalizedLocale,
      result: sanitizedResult,
      submission: safeSubmission,
      share_id: shareId
    },
    confidence_score: null,
    share_id: shareId,
    ...(supportsUserId ? { user_id: userId } : {}),
    ...(anonymousWriteGrantUseId ? { anonymous_write_grant_use_id: anonymousWriteGrantUseId } : {}),
    locale: normalizedLocale,
    skin_type: form.skinType || null,
    main_concerns: normalizeConcernKeys(form),
    summary,
    routine_am: getRoutineForStorage(sanitizedResult, "morning", "amFocus"),
    routine_pm: getRoutineForStorage(sanitizedResult, "night", "pmFocus"),
    recommended_products: recommendedProducts,
    is_public: Boolean(isPublic),
    image_url: null
  };
}

export function buildResultFingerprint(result = {}, submission = {}) {
  return JSON.stringify({
    skinType: submission?.form?.skinType || "",
    mainConcerns: normalizeConcernKeys(submission?.form || {}),
    summary: result?.summary || "",
    topPickId: result?.topPick?.id || "",
    supportingIds: result?.alternative?.id ? [result.alternative.id] : []
  });
}

export function normalizeStoredAnalysisResult(row) {
  if (!row) {
    return null;
  }

  const resultJson = row.result_json && typeof row.result_json === "object"
    ? row.result_json
    : null;
  const storedResult =
    resultJson?.result && typeof resultJson.result === "object"
      ? resultJson.result
      : null;
  const storedSubmission =
    resultJson?.submission && typeof resultJson.submission === "object"
      ? resultJson.submission
      : null;
  const storedForm = storedSubmission?.form && typeof storedSubmission.form === "object"
    ? storedSubmission.form
    : {};
  const locale = getShareLocale(resultJson?.locale || row.locale);
  const projectedRecommendedProducts = Array.isArray(row.recommended_products) ? row.recommended_products : [];
  const canonicalRecommendedProducts = storedResult
    ? getRecommendedProductsForStorage(storedResult)
    : [];
  const recommendedProducts = canonicalRecommendedProducts.length
    ? canonicalRecommendedProducts
    : projectedRecommendedProducts;
  const storedMainConcerns = normalizeConcernKeys(storedForm);
  const mainConcerns = storedMainConcerns.length
    ? storedMainConcerns
    : Array.isArray(row.main_concerns) ? row.main_concerns : [];
  const routineAm = storedResult
    ? getRoutineForStorage(storedResult, "morning", "amFocus")
    : [];
  const routinePm = storedResult
    ? getRoutineForStorage(storedResult, "night", "pmFocus")
    : [];
  const topPick = storedResult?.topPick || recommendedProducts[0] || null;
  const alternative = storedResult?.alternative || recommendedProducts[1] || null;
  const categoryPicks = Array.isArray(storedResult?.categoryPicks) && storedResult.categoryPicks.length
    ? storedResult.categoryPicks
    : alternative
      ? [alternative]
      : recommendedProducts.slice(1, 2);

  return {
    id: row.id,
    shareId: row.share_id,
    createdAt: row.created_at,
    userId: row.user_id,
    locale,
    schemaVersion: resultJson?.schemaVersion || null,
    generatedAt: resultJson?.generatedAt || null,
    source: resultJson?.source || null,
    skinType: storedForm.skinType || row.skin_type || "",
    mainConcerns,
    summary: storedResult?.summary || row.summary || "",
    routineAm: routineAm.length ? routineAm : normalizeStringArray(row.routine_am),
    routinePm: routinePm.length ? routinePm : normalizeStringArray(row.routine_pm),
    morning: routineAm.length ? routineAm : normalizeStringArray(row.routine_am),
    night: routinePm.length ? routinePm : normalizeStringArray(row.routine_pm),
    routineStructure: storedResult?.routineStructure || null,
    recommendedProducts,
    topPick,
    alternative,
    categoryPicks,
    isPublic: Boolean(row.is_public),
    imageUrl: row.image_url || null
  };
}
