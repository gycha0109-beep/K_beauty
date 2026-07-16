import { randomBytes } from "crypto";
import {
  resolveSafeProductImage,
  sanitizeAnalyzeResultProductImages
} from "./security/image-source-policy.js";

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
  return randomBytes(16).toString("base64url");
}

export function getSharePath(shareId) {
  return `/r/${shareId}`;
}

// This is the server-side read shape. Public and owner DTOs are projected below.
export const ANALYSIS_RESULT_READ_SELECT =
  "share_id, locale, skin_type, main_concerns, summary, routine_am, routine_pm, recommended_products, is_public, result_json";

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

  return sanitizeAnalyzeResultProductImages({
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
  });
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
      image_url: resolveSafeProductImage(product.image_url),
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

function asPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function normalizeOutputString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOutputStringArray(value, limit = 3) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(normalizeOutputString)
    .filter(Boolean)
    .slice(0, limit);
}

function getRoutineForOutput(result, itemsKey, focusKey) {
  const routineItems = normalizeOutputStringArray(result?.[itemsKey], 3);

  return routineItems.length
    ? routineItems
    : normalizeOutputStringArray([result?.[focusKey]], 1);
}

function projectPublicProduct(value) {
  const product = asPlainObject(value);

  if (!product) {
    return null;
  }

  const projected = {
    id: normalizeOutputString(product.id),
    name: normalizeOutputString(product.name),
    brand: normalizeOutputString(product.brand),
    step: normalizeOutputString(product.step),
    reason: normalizeOutputString(product.reason)
  };

  return projected.id || projected.name || projected.brand ? projected : null;
}

function projectPublicCategoryPick(value) {
  const product = projectPublicProduct(value);

  return product
    ? {
        id: product.id,
        name: product.name,
        brand: product.brand,
        step: product.step
      }
    : null;
}

function projectRoutineTiming(value) {
  const timing = asPlainObject(value);

  if (!timing) {
    return null;
  }

  return {
    mode: normalizeOutputString(timing.mode),
    label: normalizeOutputString(timing.label),
    strategyLine: normalizeOutputString(timing.strategyLine)
  };
}

function projectRoutineStructure(value) {
  const structure = asPlainObject(value);

  if (!structure) {
    return null;
  }

  const cards = Array.isArray(structure.cards)
    ? structure.cards
        .map((card) => {
          const item = asPlainObject(card);

          if (!item) {
            return null;
          }

          return {
            key: normalizeOutputString(item.key),
            label: normalizeOutputString(item.label),
            body: normalizeOutputString(item.body),
            mode: normalizeOutputString(item.mode)
          };
        })
        .filter((card) => card && (card.label || card.body))
        .slice(0, 3)
    : [];

  return {
    type: normalizeOutputString(structure.type),
    label: normalizeOutputString(structure.label),
    title: normalizeOutputString(structure.title),
    body: normalizeOutputString(structure.body),
    am: projectRoutineTiming(structure.am),
    pm: projectRoutineTiming(structure.pm),
    cards
  };
}

function getStoredResultParts(row) {
  const resultJson = asPlainObject(row?.result_json);
  const storedResult = asPlainObject(resultJson?.result);
  const storedSubmission = asPlainObject(resultJson?.submission);
  const storedForm = asPlainObject(storedSubmission?.form) || {};
  const storedProducts = storedResult
    ? [storedResult.topPick, storedResult.alternative].filter(Boolean)
    : [];
  const fallbackProducts = Array.isArray(row?.recommended_products)
    ? row.recommended_products
    : [];
  const recommendedProducts = storedProducts.length ? storedProducts : fallbackProducts;
  const storedConcerns = Array.isArray(storedForm.mainConcerns)
    ? storedForm.mainConcerns
    : storedForm.mainConcern
      ? [storedForm.mainConcern]
      : [];
  const normalizedStoredConcerns = normalizeOutputStringArray(storedConcerns, 5);
  const storedRoutineAm = storedResult
    ? getRoutineForOutput(storedResult, "morning", "amFocus")
    : [];
  const storedRoutinePm = storedResult
    ? getRoutineForOutput(storedResult, "night", "pmFocus")
    : [];
  const routineAm = storedRoutineAm.length
    ? storedRoutineAm
    : normalizeOutputStringArray(row?.routine_am, 3);
  const routinePm = storedRoutinePm.length
    ? storedRoutinePm
    : normalizeOutputStringArray(row?.routine_pm, 3);
  const alternative = storedResult?.alternative || recommendedProducts[1] || null;
  const categoryPicks = Array.isArray(storedResult?.categoryPicks) && storedResult.categoryPicks.length
    ? storedResult.categoryPicks
    : alternative
      ? [alternative]
      : recommendedProducts.slice(1, 2);

  return {
    resultJson,
    storedResult,
    storedForm,
    recommendedProducts,
    routineAm,
    routinePm,
    mainConcerns: normalizedStoredConcerns.length
      ? normalizedStoredConcerns
      : normalizeOutputStringArray(row?.main_concerns, 5),
    categoryPicks
  };
}

export function serializePublicAnalysisResult(row) {
  if (!asPlainObject(row)) {
    return null;
  }

  const {
    resultJson,
    storedResult,
    storedForm,
    recommendedProducts,
    routineAm,
    routinePm,
    mainConcerns,
    categoryPicks
  } = getStoredResultParts(row);
  const schemaVersion = Number.isInteger(resultJson?.schemaVersion)
    ? resultJson.schemaVersion
    : null;

  return {
    shareId: normalizeOutputString(row.share_id),
    schemaVersion,
    locale: getShareLocale(normalizeOutputString(resultJson?.locale) || normalizeOutputString(row.locale)),
    skinType: normalizeOutputString(storedForm.skinType) || normalizeOutputString(row.skin_type),
    mainConcerns,
    summary: normalizeOutputString(storedResult?.summary) || normalizeOutputString(row.summary),
    routineAm,
    routinePm,
    topPick: projectPublicProduct(storedResult?.topPick) || projectPublicProduct(recommendedProducts[0]),
    categoryPicks: categoryPicks
      .map(projectPublicCategoryPick)
      .filter(Boolean)
      .slice(0, 6),
    routineStructure: projectRoutineStructure(storedResult?.routineStructure)
  };
}

export function serializeOwnerAnalysisResult(row) {
  const publicResult = serializePublicAnalysisResult(row);

  return publicResult
    ? {
        ...publicResult,
        isPublic: row?.is_public === true
      }
    : null;
}

export function resolveAnalysisResultReadAudience(row, currentUserId = null) {
  if (!asPlainObject(row)) {
    return null;
  }

  if (row.is_public === true) {
    return "public";
  }

  return typeof row.user_id === "string" &&
    typeof currentUserId === "string" &&
    currentUserId === row.user_id
    ? "owner"
    : null;
}
