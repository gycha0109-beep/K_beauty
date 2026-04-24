import { randomBytes } from "crypto";

const ANALYSIS_FEATURE_TYPE = "skin";

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
  "id, share_id, created_at, locale, skin_type, main_concerns, summary, routine_am, routine_pm, recommended_products, is_public, image_url";

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
  supportsUserId = false
} = {}) {
  const form = submission?.form && typeof submission.form === "object"
    ? submission.form
    : {};

  return {
    feature_type: ANALYSIS_FEATURE_TYPE,
    survey_json: form,
    image_url: null,
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
  isPublic = false
}) {
  if (!requestId) {
    throw new Error("analysis_results.request_id is required.");
  }

  const normalizedLocale = getShareLocale(locale || submission?.locale);
  const form = submission?.form || {};
  const summary = String(result?.summary || "");
  const recommendedProducts = getRecommendedProductsForStorage(result);
  const headlineLabel = String(
    result?.topPick?.name ||
    result?.priority?.label ||
    summary ||
    "Skin Match"
  ).trim();

  return {
    request_id: requestId,
    feature_type: ANALYSIS_FEATURE_TYPE,
    headline_label: headlineLabel || "Skin Match",
    result_json: {
      result: result || {},
      submission: submission || {},
      share_id: shareId,
      locale: normalizedLocale
    },
    confidence_score: null,
    share_id: shareId,
    ...(supportsUserId ? { user_id: userId } : {}),
    locale: normalizedLocale,
    skin_type: form.skinType || null,
    main_concerns: normalizeConcernKeys(form),
    summary,
    routine_am: result?.amFocus ? [String(result.amFocus).trim()].filter(Boolean) : [],
    routine_pm: result?.pmFocus ? [String(result.pmFocus).trim()].filter(Boolean) : [],
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

  const locale = getShareLocale(row.locale);
  const recommendedProducts = Array.isArray(row.recommended_products) ? row.recommended_products : [];

  return {
    id: row.id,
    shareId: row.share_id,
    createdAt: row.created_at,
    userId: row.user_id,
    locale,
    skinType: row.skin_type || "",
    mainConcerns: Array.isArray(row.main_concerns) ? row.main_concerns : [],
    summary: row.summary || "",
    routineAm: Array.isArray(row.routine_am) ? row.routine_am : [],
    routinePm: Array.isArray(row.routine_pm) ? row.routine_pm : [],
    recommendedProducts,
    topPick: recommendedProducts[0] || null,
    alternative: recommendedProducts[1] || null,
    categoryPicks: recommendedProducts.slice(1, 2),
    isPublic: Boolean(row.is_public),
    imageUrl: row.image_url || null
  };
}
