import { randomBytes } from "crypto";

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

export function getRecommendedProductsForStorage(result = {}) {
  const products = [
    ...(result?.topPick ? [result.topPick] : []),
    ...((Array.isArray(result?.categoryPicks) ? result.categoryPicks : []).slice(0, 4))
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

export function buildAnalysisResultRow({ result, submission, locale = "ko", shareId, userId = null }) {
  const normalizedLocale = getShareLocale(locale || submission?.locale);
  const form = submission?.form || {};

  return {
    share_id: shareId,
    user_id: userId,
    locale: normalizedLocale,
    skin_type: form.skinType || null,
    main_concerns: normalizeConcernKeys(form),
    summary: String(result?.summary || ""),
    routine_am: Array.isArray(result?.morning) ? result.morning.filter(Boolean).slice(0, 5) : [],
    routine_pm: Array.isArray(result?.night) ? result.night.filter(Boolean).slice(0, 5) : [],
    recommended_products: getRecommendedProductsForStorage(result),
    is_public: true,
    image_url: null
  };
}

export function buildResultFingerprint(result = {}, submission = {}) {
  return JSON.stringify({
    skinType: submission?.form?.skinType || "",
    mainConcerns: normalizeConcernKeys(submission?.form || {}),
    summary: result?.summary || "",
    topPickId: result?.topPick?.id || "",
    supportingIds: (result?.categoryPicks || []).map((item) => item?.id || "").slice(0, 4)
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
    categoryPicks: recommendedProducts.slice(1),
    isPublic: Boolean(row.is_public),
    imageUrl: row.image_url || null
  };
}
