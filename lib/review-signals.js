import { resolveProductCategorySemantics } from "./product-category-normalizer.js";

export const REVIEW_SIGNAL_SOURCE = "hwahae_ai_review";
export const MAX_REVIEW_SIGNAL_IMPACT = 10;

const REVIEW_SIGNAL_ENTRY_LIMIT = 3;

const ALLOWED_MAPPED_TAGS = new Set([
  "dehydration",
  "barrier",
  "fresh",
  "oiliness",
  "acne_safe",
  "sensitive_safe",
  "makeup_safe",
  "lasting_strong",
  "sensitivity_risk",
  "irritation_risk",
  "acne_risk",
  "texture_mismatch",
  "lasting_weak",
  "pilling_risk",
  "drying",
  "redness",
  "absorption",
  "essence_rich",
  "hydration_support",
  "sticky",
  "rich_texture",
  "viscous_texture",
  "watery_texture",
  "oily_finish",
  "second_cleanse",
  "cleansing_power_weak",
  "foam_weak",
  "physical_exfoliation",
  "eye_sting",
  "white_cast",
  "acne",
  "non_sticky",
  "lightweight",
  "eye_sting_low",
  "pilling_low",
  "breathable",
  "non_heavy",
  "tone_up_weak",
  "tone_correction_weak",
  "tone_effect_weak",
  "spreadability",
  "texture_issue",
  "balance_mismatch",
  "heavy_finish",
  "pores_weak",
  "pores",
  "exfoliation",
  "non_slippery",
  "texture_refining",
  "blackhead_weak"
]);

const POSITIVE_SIGNAL_WEIGHTS = {
  dehydration: 2.2,
  barrier: 2.0,
  fresh: 1.6,
  oiliness: 1.8,
  acne_safe: 2.0,
  sensitive_safe: 2.2,
  makeup_safe: 1.8,
  lasting_strong: 1.4
};

const NEGATIVE_SIGNAL_WEIGHTS = {
  sensitivity_risk: -3.2,
  irritation_risk: -3.4,
  acne_risk: -2.6,
  texture_mismatch: -1.8,
  lasting_weak: -1.4,
  pilling_risk: -2.2,
  drying: -2.8
};

const RISK_RELATED_TAGS = new Set([
  "sensitivity_risk",
  "irritation_risk",
  "acne_risk",
  "drying"
]);

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "")
    .trim();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function roundToTenth(value) {
  return Math.round(value * 10) / 10;
}

function parseCount(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }

  const digits = String(value || "").replace(/[^\d]/g, "");
  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function uniqueValues(values = []) {
  return Array.from(new Set(values.filter(Boolean)));
}

function uniqueTags(values = []) {
  return uniqueValues(
    values
      .map((item) => String(item || "").trim())
      .filter((item) => ALLOWED_MAPPED_TAGS.has(item))
  );
}

const REVIEW_SIGNAL_CATEGORY_FAMILY_MAP = Object.freeze({
  moisturizer: "moisturizer",
  sunscreen: "sunscreen",
  treatment: "serum_ampoule",
  toner_pad: "toner_pad",
  toner_essence: "toner",
  cleanser: "cleanser"
});

const COMMON_REVIEW_SIGNAL_RULES = Object.freeze({
  positive: [
    { matchAny: ["속건조", "수분있는", "수분감있는", "촉촉한", "보습되는"], tags: ["dehydration"] },
    { matchAny: ["보습", "장벽"], tags: ["dehydration", "barrier"] },
    { matchAny: ["가벼운", "산뜻한"], tags: ["fresh"] },
    { matchAny: ["유분없는", "번들거림없는"], tags: ["oiliness"] },
    { matchAny: ["트러블없어지는", "트러블안나는", "트러블안생기는", "여드름안나는"], tags: ["acne_safe"] },
    { matchAny: ["편안한", "순한", "진정되는", "자극없는"], tags: ["sensitive_safe"] },
    { matchAny: ["밀림없는"], tags: ["makeup_safe"] },
    { matchAny: ["지속력좋은", "오래가는"], tags: ["lasting_strong"] },
    { matchAny: ["잘발리는"], tags: ["spreadability"] },
    { matchAny: ["흡수잘되는"], tags: ["absorption"] },
    { matchAny: ["편안해지는"], tags: ["sensitive_safe"] }
  ],
  negative: [
    { matchAny: ["알러지반응오는", "알레르기반응오는", "알러지나는", "알레르기나는"], tags: ["sensitivity_risk"] },
    { matchAny: ["따가운", "화끈거리는", "가려운", "자극적인"], tags: ["irritation_risk"] },
    { matchAny: ["트러블생기는", "트러블나는", "여드름생기는"], tags: ["acne_risk"] },
    { matchAny: ["끈적한"], tags: ["sticky", "texture_mismatch"] },
    { matchAny: ["미끈거리는", "미끌거리는"], tags: ["texture_mismatch"] },
    { matchAny: ["밀리는"], tags: ["pilling_risk"] },
    { matchAny: ["건조한", "당기는"], tags: ["drying"] },
    { matchAny: ["잘굳는"], tags: ["texture_issue"] },
    { matchAny: ["유수분밸런스가맞지않는"], tags: ["balance_mismatch"] }
  ]
});

const CATEGORY_FAMILY_REVIEW_SIGNAL_RULES = Object.freeze({
  moisturizer: {
    positive: [
      { matchAny: ["피부강화되는"], tags: ["barrier"] }
    ],
    negative: [
      { matchAny: ["유분있는"], tags: ["oily_finish"] },
      { matchAny: ["답답한"], tags: ["heavy_finish"] },
      { matchAny: ["모공관리안되는"], tags: ["pores_weak"] }
    ]
  },
  serum_ampoule: {
    positive: [],
    negative: [
      { matchAny: ["흘러내리는"], tags: ["watery_texture"] },
      { matchAny: ["지속력안좋은"], tags: ["lasting_weak"] }
    ]
  },
  toner: {
    positive: [
      { matchAny: ["에센스양많은"], tags: ["essence_rich"] },
      { matchAny: ["진정되는"], tags: ["redness", "sensitive_safe"] },
      { matchAny: ["수분있는", "수분감있는"], tags: ["dehydration"] },
      { matchAny: ["트러블없어지는"], tags: ["acne_safe", "acne"] },
      { matchAny: ["흡수잘되는"], tags: ["absorption"] },
      { matchAny: ["겉끈적한"], tags: ["sticky"] },
      { matchAny: ["쫀득한"], tags: ["viscous_texture"] },
      { matchAny: ["각질제거잘되는"], tags: ["exfoliation", "pores"] },
      { matchAny: ["피부결좋아지는"], tags: ["texture_refining"] },
      { matchAny: ["따갑지않은"], tags: ["sensitive_safe"] },
      { matchAny: ["뒤집어지지않는"], tags: ["acne_safe", "sensitive_safe"] },
      { matchAny: ["매끄러운"], tags: ["texture_refining"] }
    ],
    negative: [
      { matchAny: ["흘러내리는"], tags: ["watery_texture"] },
      { matchAny: ["유분있는"], tags: ["oily_finish"] },
      { matchAny: ["블랙헤드안없어지는"], tags: ["blackhead_weak", "pores_weak"] },
      { matchAny: ["눈통증있는"], tags: ["eye_sting"] },
      { matchAny: ["지속력안좋은"], tags: ["lasting_weak"] }
    ]
  },
  cleanser: {
    positive: [
      { matchAny: ["2차세안에적합한"], tags: ["second_cleanse"] },
      { matchAny: ["알갱이있는"], tags: ["physical_exfoliation", "irritation_risk"] },
      { matchAny: ["각질제거잘되는"], tags: ["exfoliation", "pores"] },
      { matchAny: ["미끌거리지않는"], tags: ["non_slippery", "fresh"] }
    ],
    negative: [
      { matchAny: ["워터프루프안지워지는"], tags: ["cleansing_power_weak"] },
      { matchAny: ["거품이풍성하지않은"], tags: ["foam_weak"] },
      { matchAny: ["알갱이있는"], tags: ["physical_exfoliation", "irritation_risk"] },
      { matchAny: ["리치한"], tags: ["rich_texture"] },
      { matchAny: ["흘러내리는"], tags: ["watery_texture"] }
    ]
  },
  sunscreen: {
    positive: [
      { matchAny: ["끈적하지않은"], tags: ["non_sticky", "fresh"] },
      { matchAny: ["흡수잘되는"], tags: ["absorption"] },
      { matchAny: ["가벼운"], tags: ["fresh", "lightweight"] },
      { matchAny: ["눈통증없는", "눈시림없는"], tags: ["eye_sting_low"] },
      { matchAny: ["밀림없는"], tags: ["pilling_low"] },
      { matchAny: ["산뜻한"], tags: ["fresh"] },
      { matchAny: ["답답하지않은"], tags: ["breathable", "non_heavy"] }
    ],
    negative: [
      { matchAny: ["유분있는"], tags: ["oily_finish"] },
      { matchAny: ["따가운"], tags: ["irritation_risk"] },
      { matchAny: ["알러지반응오는"], tags: ["sensitivity_risk"] },
      { matchAny: ["톤업안되는"], tags: ["tone_up_weak"] },
      { matchAny: ["톤보정안되는"], tags: ["tone_correction_weak"] },
      { matchAny: ["지속력안좋은"], tags: ["lasting_weak"] },
      { matchAny: ["미백효과가없는"], tags: ["tone_effect_weak"] },
      { matchAny: ["눈통증있는", "눈시림"], tags: ["eye_sting"] },
      { matchAny: ["백탁"], tags: ["white_cast"] },
      { matchAny: ["밀리는"], tags: ["pilling_risk"] },
      { matchAny: ["흘러내리는"], tags: ["lasting_weak"] }
    ]
  }
});

function normalizeCategoryKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function normalizeCategoryFamily(value) {
  const normalized = normalizeCategoryKey(value);
  return normalized || null;
}

function getProductFormFromContext(context = {}) {
  if (!context || typeof context !== "object") {
    return null;
  }

  return context.product_form ?? context.productForm ?? null;
}

function hasCategoryContext(context = {}) {
  return Boolean(context?.category || context?.service_category);
}

export function getReviewSignalCategoryFamily(category, context = {}) {
  const semantics = resolveProductCategorySemantics({
    category,
    product_form: getProductFormFromContext(context)
  });

  if (semantics.unresolved) {
    return null;
  }

  return REVIEW_SIGNAL_CATEGORY_FAMILY_MAP[semantics.canonicalCategory] || null;
}

export function resolveReviewSignalCategoryFamilyForProduct(input = {}) {
  return getReviewSignalCategoryFamily(input?.category ?? input?.service_category, input);
}

export function resolveReviewSignalCategorySemantics(input = {}) {
  const semantics = resolveProductCategorySemantics({
    category: input?.category ?? input?.service_category,
    product_form: getProductFormFromContext(input)
  });

  if (semantics.unresolved) {
    return {
      status: "unresolved",
      family: null,
      reason: semantics.unresolvedReason || "unresolved",
      semantics
    };
  }

  return {
    status: "valid",
    family: REVIEW_SIGNAL_CATEGORY_FAMILY_MAP[semantics.canonicalCategory] || null,
    reason: null,
    semantics
  };
}

function resolveReviewSignalCategoryFamily(options = {}, parsed = {}) {
  const explicitFamily = normalizeCategoryFamily(options.categoryFamily || parsed.categoryFamily);
  const category = options.category || parsed.category || options.service_category || parsed.service_category || null;

  if (!hasCategoryContext(options) && !hasCategoryContext(parsed) && explicitFamily) {
    return explicitFamily;
  }

  return getReviewSignalCategoryFamily(category, {
    product_form: getProductFormFromContext(options) ?? getProductFormFromContext(parsed)
  });
}

function matchesAnyNeedle(normalizedLabel, values = []) {
  return values.some((value) => normalizedLabel.includes(normalizeText(value)));
}

function applyReviewSignalRules(mapped, normalizedLabel, rules = []) {
  rules.forEach((rule) => {
    if (matchesAnyNeedle(normalizedLabel, rule.matchAny)) {
      mapped.push(...rule.tags);
    }
  });
}

function buildUnmappedSummary(positive = [], negative = []) {
  const positiveLabels = positive.filter((entry) => entry.mapped.length === 0).map((entry) => entry.label);
  const negativeLabels = negative.filter((entry) => entry.mapped.length === 0).map((entry) => entry.label);

  return {
    positive: positiveLabels,
    negative: negativeLabels,
    all: uniqueValues([...positiveLabels, ...negativeLabels])
  };
}

function inferPositiveMappedTags(label) {
  const normalized = normalizeText(label);
  const mapped = [];

  if (!normalized) {
    return mapped;
  }

  if (normalized.includes("속건조")) {
    mapped.push("dehydration");
  }

  if (normalized.includes("수분") || normalized.includes("보습")) {
    mapped.push("dehydration", "barrier");
  }

  if (normalized.includes("가벼") || normalized.includes("산뜻") || normalized.includes("흡수")) {
    mapped.push("fresh");
  }

  if (normalized.includes("유분없") || normalized.includes("번들") || normalized.includes("산뜻")) {
    mapped.push("oiliness");
  }

  if (
    normalized.includes("트러블안생") ||
    normalized.includes("트러블없") ||
    normalized.includes("여드름안")
  ) {
    mapped.push("acne_safe");
  }

  if (
    normalized.includes("편안") ||
    normalized.includes("순하") ||
    normalized.includes("진정") ||
    normalized.includes("자극없")
  ) {
    mapped.push("sensitive_safe");
  }

  if (normalized.includes("밀림없")) {
    mapped.push("makeup_safe");
  }

  if (normalized.includes("지속력좋") || normalized.includes("오래가")) {
    mapped.push("lasting_strong");
  }

  return uniqueTags(mapped);
}

function inferNegativeMappedTags(label) {
  const normalized = normalizeText(label);
  const mapped = [];

  if (!normalized) {
    return mapped;
  }

  if (normalized.includes("알러지") || normalized.includes("알레르기")) {
    mapped.push("sensitivity_risk");
  }

  if (
    normalized.includes("따가") ||
    normalized.includes("화끈") ||
    normalized.includes("가려") ||
    normalized.includes("자극")
  ) {
    mapped.push("irritation_risk");
  }

  if (normalized.includes("트러블") || normalized.includes("여드름")) {
    mapped.push("acne_risk");
  }

  if (normalized.includes("미끌") || normalized.includes("끈적")) {
    mapped.push("texture_mismatch");
  }

  if (
    normalized.includes("흘러내림") ||
    normalized.includes("지속력안") ||
    normalized.includes("지속력아쉬") ||
    normalized.includes("금방지워")
  ) {
    mapped.push("lasting_weak");
  }

  if (normalized.includes("밀림")) {
    mapped.push("pilling_risk");
  }

  if (normalized.includes("건조")) {
    mapped.push("drying");
  }

  return uniqueTags(mapped);
}

function deriveMappedTags(label, sentiment = "positive", options = {}) {
  const normalized = normalizeText(label);

  if (!normalized) {
    return [];
  }

  const mapped = [];
  applyReviewSignalRules(mapped, normalized, COMMON_REVIEW_SIGNAL_RULES[sentiment] || []);

  const categoryFamily = resolveReviewSignalCategoryFamily(options, options);
  if (categoryFamily) {
    applyReviewSignalRules(
      mapped,
      normalized,
      CATEGORY_FAMILY_REVIEW_SIGNAL_RULES[categoryFamily]?.[sentiment] || []
    );
  }

  return uniqueTags(mapped);
}

function normalizeEntry(entry, sentiment = "positive", options = {}) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const label = String(entry.label || "").trim();
  const count = parseCount(entry.count);
  const explicitMapped = uniqueTags(Array.isArray(entry.mapped) ? entry.mapped : []);
  const mapped = explicitMapped.length ? explicitMapped : deriveMappedTags(label, sentiment, options);

  if (!label || count <= 0) {
    return null;
  }

  return {
    label,
    count,
    mapped
  };
}

function normalizeEntryList(entries, sentiment = "positive", options = {}) {
  return Array.isArray(entries)
    ? entries
        .map((entry) => normalizeEntry(entry, sentiment, options))
        .filter(Boolean)
        .sort((left, right) => right.count - left.count)
    : [];
}

export function normalizeReviewSignals(input, options = {}) {
  if (!input) {
    return null;
  }

  let parsed = input;

  if (typeof input === "string") {
    try {
      parsed = JSON.parse(input);
    } catch {
      return null;
    }
  }

  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const mappingOptions = {
    category: options.category || parsed.category || null,
    product_form: getProductFormFromContext(options) ?? getProductFormFromContext(parsed),
    categoryFamily: resolveReviewSignalCategoryFamily(options, parsed)
  };
  const positive = normalizeEntryList(parsed.positive, "positive", mappingOptions);
  const negative = normalizeEntryList(parsed.negative, "negative", mappingOptions);

  if (!positive.length && !negative.length) {
    return null;
  }

  return {
    source: String(parsed.source || REVIEW_SIGNAL_SOURCE).trim() || REVIEW_SIGNAL_SOURCE,
    positive,
    negative,
    updated_at: String(parsed.updated_at || "").trim() || null,
    unmapped_summary: buildUnmappedSummary(positive, negative)
  };
}

export function getReviewSignalConfidence(count = 0) {
  if (count >= 5000) {
    return 1.4;
  }

  if (count >= 1000) {
    return 1.2;
  }

  if (count >= 300) {
    return 1.0;
  }

  return 0.8;
}

function hasConcern(answers = {}, concern) {
  const mainConcerns = Array.isArray(answers.mainConcerns) ? answers.mainConcerns : [];
  return answers.mainConcern === concern || mainConcerns.includes(concern);
}

function isSensitiveProfile(answers = {}) {
  return (
    answers.sensitivity === "high" ||
    answers.sensitivity === "medium" ||
    hasConcern(answers, "barrier") ||
    hasConcern(answers, "redness") ||
    Boolean(answers.verySensitivePeriod)
  );
}

function isDryProfile(answers = {}) {
  return (
    answers.skinType === "dry" ||
    hasConcern(answers, "dehydration") ||
    hasConcern(answers, "barrier") ||
    answers.postWashFeeling === "tight" ||
    answers.afternoonSkinChange === "more_dry"
  );
}

function isOilProfile(answers = {}) {
  return (
    answers.skinType === "oily" ||
    answers.skinType === "combination" ||
    hasConcern(answers, "oiliness") ||
    hasConcern(answers, "pores") ||
    answers.afternoonSkinChange === "more_oily"
  );
}

function isAcneProfile(answers = {}) {
  return hasConcern(answers, "acne") || hasConcern(answers, "pores") || isOilProfile(answers);
}

function getPositiveBaseScore(tag, answers = {}, product = {}) {
  switch (tag) {
    case "dehydration":
      return isDryProfile(answers) ? POSITIVE_SIGNAL_WEIGHTS.dehydration : 0;
    case "barrier":
      return isSensitiveProfile(answers) || hasConcern(answers, "dehydration")
        ? POSITIVE_SIGNAL_WEIGHTS.barrier
        : 0;
    case "fresh":
      return (
        answers.preferredTexture === "watery" ||
        answers.preferredTexture === "gel" ||
        answers.mostDislikedFeel === "sticky" ||
        answers.mostDislikedFeel === "greasy" ||
        answers.mostDislikedFeel === "heavy" ||
        answers.afternoonSkinChange === "more_oily" ||
        (product.category === "sunscreen" && Boolean(answers.outdoorExposure))
      )
        ? POSITIVE_SIGNAL_WEIGHTS.fresh
        : 0;
    case "oiliness":
      return isOilProfile(answers) ? POSITIVE_SIGNAL_WEIGHTS.oiliness : 0;
    case "acne_safe":
      return isAcneProfile(answers) ? POSITIVE_SIGNAL_WEIGHTS.acne_safe : 0;
    case "sensitive_safe":
      return isSensitiveProfile(answers) ? POSITIVE_SIGNAL_WEIGHTS.sensitive_safe : 0;
    case "makeup_safe":
      return answers.makeupUse ? POSITIVE_SIGNAL_WEIGHTS.makeup_safe : 0;
    case "lasting_strong":
      return answers.outdoorExposure || answers.makeupUse ? POSITIVE_SIGNAL_WEIGHTS.lasting_strong : 0;
    default:
      return 0;
  }
}

function getNegativeBaseScore(tag, answers = {}, product = {}) {
  switch (tag) {
    case "sensitivity_risk":
      return isSensitiveProfile(answers) ? NEGATIVE_SIGNAL_WEIGHTS.sensitivity_risk : 0;
    case "irritation_risk":
      return isSensitiveProfile(answers) || hasConcern(answers, "dehydration")
        ? NEGATIVE_SIGNAL_WEIGHTS.irritation_risk
        : 0;
    case "acne_risk":
      return isAcneProfile(answers) ? NEGATIVE_SIGNAL_WEIGHTS.acne_risk : 0;
    case "texture_mismatch":
      return ["sticky", "greasy", "heavy", "pilling"].includes(answers.mostDislikedFeel || "")
        ? NEGATIVE_SIGNAL_WEIGHTS.texture_mismatch
        : 0;
    case "lasting_weak":
      return product.category === "sunscreen" && (answers.outdoorExposure || answers.makeupUse)
        ? NEGATIVE_SIGNAL_WEIGHTS.lasting_weak
        : 0;
    case "pilling_risk":
      return answers.makeupUse || product.category === "sunscreen"
        ? NEGATIVE_SIGNAL_WEIGHTS.pilling_risk
        : 0;
    case "drying":
      return isDryProfile(answers) ? NEGATIVE_SIGNAL_WEIGHTS.drying : 0;
    default:
      return 0;
  }
}

export function computeReviewSignalScore(reviewSignals, answers = {}, product = {}) {
  const normalized = normalizeReviewSignals(reviewSignals, {
    category: product?.category,
    product_form: product?.product_form ?? product?.productForm,
    categoryFamily: product?.categoryFamily
  });

  if (!normalized) {
    return {
      total: 0,
      unclampedTotal: 0,
      details: [],
      positive: [],
      negative: []
    };
  }

  const details = [];
  let total = 0;

  const applyEntries = (entries = [], sentiment = "positive") => {
    entries.slice(0, REVIEW_SIGNAL_ENTRY_LIMIT).forEach((entry) => {
      const tags = entry.mapped.length
        ? entry.mapped
        : deriveMappedTags(entry.label, sentiment, {
            category: product?.category,
            product_form: product?.product_form ?? product?.productForm,
            categoryFamily: product?.categoryFamily
          });

      if (!tags.length) {
        return;
      }

      const confidence = getReviewSignalConfidence(entry.count);
      const perTagScale = 1 / tags.length;

      tags.forEach((tag) => {
        const baseScore = sentiment === "positive"
          ? getPositiveBaseScore(tag, answers, product)
          : getNegativeBaseScore(tag, answers, product);

        if (!baseScore) {
          return;
        }

        const score = roundToTenth(baseScore * confidence * perTagScale);
        total += score;
        details.push({
          sentiment,
          label: entry.label,
          tag,
          count: entry.count,
          confidence,
          score
        });
      });
    });
  };

  applyEntries(normalized.positive, "positive");
  applyEntries(normalized.negative, "negative");

  const clampedTotal = clamp(roundToTenth(total), -MAX_REVIEW_SIGNAL_IMPACT, MAX_REVIEW_SIGNAL_IMPACT);

  return {
    total: clampedTotal,
    unclampedTotal: roundToTenth(total),
    details: details.slice(0, 10),
    positive: details.filter((item) => item.sentiment === "positive"),
    negative: details.filter((item) => item.sentiment === "negative")
  };
}

function formatLabelList(labels, locale = "ko") {
  if (labels.length <= 1) {
    return labels[0] || "";
  }

  if (labels.length === 2) {
    return locale === "en" ? `${labels[0]} and ${labels[1]}` : `${labels[0]}, ${labels[1]}`;
  }

  const head = labels.slice(0, -1).join(", ");
  const tail = labels[labels.length - 1];
  return locale === "en" ? `${head}, and ${tail}` : `${head}, ${tail}`;
}

function getNegativeCautionTail(entry, locale = "ko") {
  const mapped = Array.isArray(entry?.mapped) ? entry.mapped : [];
  const hasRiskTag = mapped.some((tag) => RISK_RELATED_TAGS.has(tag));

  if (locale === "en") {
    return hasRiskTag
      ? "so reactive skin should double-check before committing."
      : "so texture fit is worth double-checking.";
  }

  return hasRiskTag
    ? "민감한 피부라면 확인하는 편이 좋습니다."
    : "사용감은 한 번 확인하는 편이 좋습니다.";
}

export function buildReviewEvidenceSentence(reviewSignals, locale = "ko") {
  const normalized = normalizeReviewSignals(reviewSignals);

  if (!normalized) {
    return "";
  }

  const positiveLabels = normalized.positive.slice(0, 2).map((item) => item.label).filter(Boolean);
  const negativeEntry = normalized.negative[0] || null;

  if (locale === "en") {
    const positiveSentence = positiveLabels.length
      ? `Public Hwahae AI review summaries often mention ${formatLabelList(positiveLabels, locale)}.`
      : "";
    const negativeSentence = negativeEntry
      ? ` There are also notes about ${negativeEntry.label}, ${getNegativeCautionTail(negativeEntry, locale)}`
      : "";
    return `${positiveSentence}${negativeSentence}`.trim();
  }

  const positiveSentence = positiveLabels.length
    ? `실제 리뷰에서는 ${formatLabelList(positiveLabels, locale)} 반응이 많이 보입니다.`
    : "";
  const negativeSentence = negativeEntry
    ? ` 다만 ${negativeEntry.label} 의견도 있어 ${getNegativeCautionTail(negativeEntry, locale)}`
    : "";

  return `${positiveSentence}${negativeSentence}`.trim();
}

export function appendReviewEvidenceSentence(baseText, reviewSignals, locale = "ko") {
  const base = String(baseText || "").trim();
  const sentence = buildReviewEvidenceSentence(reviewSignals, locale);

  if (!sentence) {
    return base;
  }

  if (!base) {
    return sentence;
  }

  if (base.includes(sentence)) {
    return base;
  }

  return `${base} ${sentence}`.trim();
}
