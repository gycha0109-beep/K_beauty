import { createClient } from "@supabase/supabase-js";
import { PRODUCT_DB as LEGACY_PRODUCT_DB } from "@/lib/backups/product-db.backup";
import { isMoisturizerCategory } from "@/lib/product-category-utils";
import { normalizeReviewSignals } from "@/lib/review-signals";

const CACHE_TTL_MS = 5 * 60 * 1000;
const ALLOWED_SKIN_TYPES = ["oily", "dry", "combination", "sensitive"];
const ALLOWED_CONCERNS = [
  "oiliness",
  "dehydration",
  "acne",
  "uneven_tone",
  "pores",
  "redness",
  "barrier"
];

const CATEGORY_MAP = {
  cleanser: "cleanser",
  cleansing: "cleanser",
  toner: "toner_essence",
  toner_essence: "toner_essence",
  toner_pad: "toner_pad",
  essence: "essence",
  serum: "serum",
  ampoule: "ampoule",
  cream: "moisturizer_cream",
  moisturizer: "moisturizer",
  moisturizer_lotion_emulsion: "moisturizer_lotion_emulsion",
  moisturizer_gel: "moisturizer_gel",
  moisturizer_cream: "moisturizer_cream",
  moisturizer_balm: "moisturizer_balm",
  lotion: "moisturizer_lotion_emulsion",
  emulsion: "moisturizer_lotion_emulsion",
  milk: "moisturizer_lotion_emulsion",
  fluid: "moisturizer_lotion_emulsion",
  gel: "moisturizer_gel",
  balm: "moisturizer_balm",
  sunscreen: "sunscreen",
  sun: "sunscreen"
};

const CONCERN_MAP = {
  acne: "acne",
  antiaging: "uneven_tone",
  barrier: "barrier",
  dryness: "dehydration",
  hydration: "dehydration",
  pores: "pores",
  redness: "redness",
  sebum: "oiliness",
  sensitivity: "redness",
  uneven_tone: "uneven_tone",
  oiliness: "oiliness"
};

const TEXTURE_MAP = {
  watery: "watery",
  essence: "watery",
  gel: "gel",
  lotion: "lotion",
  cream: "cream"
};

const FINISH_MAP = {
  fresh: "fresh",
  clean: "natural",
  calm: "natural",
  moist: "dewy",
  dewy: "dewy",
  natural: "natural",
  "soft-matte": "soft_matte",
  soft_matte: "soft_matte",
  matte: "soft_matte"
};

const SUNSCREEN_OVERRIDES_BY_ID = {
  "beautyofjoseon-relief-sun": {
    uv_filter_type: "organic",
    tone_up: false,
    white_cast: "none",
    eye_sting: "medium",
    pilling_risk: "medium",
    texture: "lotion",
    finish: "dewy",
    sensitivity_safe: true,
    irritation_risk: "low"
  },
  "roundlab-birch-sunscreen": {
    uv_filter_type: "organic",
    tone_up: false,
    white_cast: "none",
    eye_sting: "low",
    pilling_risk: "low",
    texture: "lotion",
    finish: "natural",
    sensitivity_safe: true,
    irritation_risk: "low"
  },
  "skin1004-hyalu-cica-sun-serum": {
    uv_filter_type: "organic",
    tone_up: false,
    white_cast: "none",
    eye_sting: "low",
    pilling_risk: "low",
    texture: "watery",
    finish: "natural",
    sensitivity_safe: true,
    irritation_risk: "low"
  },
  "isntree-watery-sun-gel": {
    uv_filter_type: "organic",
    tone_up: false,
    white_cast: "none",
    eye_sting: "medium",
    pilling_risk: "medium",
    texture: "watery",
    finish: "dewy",
    sensitivity_safe: true,
    irritation_risk: "low"
  },
  "drg-green-mild-sun": {
    uv_filter_type: "mineral",
    tone_up: true,
    white_cast: "high",
    eye_sting: "low",
    pilling_risk: "low",
    texture: "lotion",
    finish: "soft_matte",
    sensitivity_safe: true,
    irritation_risk: "low"
  },
  "tocobo-bio-watery-sun": {
    uv_filter_type: "organic",
    tone_up: false,
    white_cast: "none",
    eye_sting: "low",
    pilling_risk: "low",
    texture: "watery",
    finish: "fresh",
    sensitivity_safe: true,
    irritation_risk: "low"
  },
  "axisy-complete-sunscreen": {
    uv_filter_type: "mineral",
    tone_up: false,
    white_cast: "medium",
    eye_sting: "low",
    pilling_risk: "medium",
    texture: "cream",
    finish: "natural",
    sensitivity_safe: true,
    irritation_risk: "low"
  },
  "haruharu-airyfit-sun": {
    uv_filter_type: "organic",
    tone_up: false,
    white_cast: "none",
    eye_sting: "low",
    pilling_risk: "low",
    texture: "lotion",
    finish: "natural",
    sensitivity_safe: true,
    irritation_risk: "low"
  },
  "0bb742d2-df6b-49a7-8e29-8f76ae62ac0d": {
    uv_filter_type: "organic",
    tone_up: false,
    white_cast: "low",
    eye_sting: "low",
    pilling_risk: "low",
    texture: "cream",
    finish: "natural",
    sensitivity_safe: true,
    irritation_risk: "low"
  },
  "25b2763f-529f-4b2e-a436-2e0776279c55": {
    uv_filter_type: "organic",
    tone_up: false,
    white_cast: "low",
    eye_sting: "low",
    pilling_risk: "low",
    texture: "lotion",
    finish: "dewy",
    sensitivity_safe: true,
    irritation_risk: "low"
  },
  "2d3591f2-2216-4043-8493-a9492806ef8b": {
    uv_filter_type: "mineral",
    tone_up: false,
    white_cast: "low",
    eye_sting: "low",
    pilling_risk: "low",
    texture: "lotion",
    finish: "soft_matte",
    sensitivity_safe: true,
    irritation_risk: "low"
  },
  "336bb533-0fe4-4380-8b9f-ab16fb24b807": {
    uv_filter_type: "organic",
    tone_up: false,
    white_cast: "low",
    eye_sting: "low",
    pilling_risk: "low",
    texture: "watery",
    finish: "fresh",
    sensitivity_safe: true,
    irritation_risk: "low"
  },
  "57e4a5ec-115d-4322-85a1-7976db669700": {
    uv_filter_type: "organic",
    tone_up: false,
    white_cast: "none",
    eye_sting: "low",
    pilling_risk: "low",
    texture: "watery",
    finish: "dewy",
    sensitivity_safe: true,
    irritation_risk: "low"
  },
  "765b3ca1-6927-49b0-bee6-4138d03dd915": {
    uv_filter_type: "organic",
    tone_up: false,
    white_cast: "none",
    eye_sting: "low",
    pilling_risk: "low",
    texture: "watery",
    finish: "fresh",
    sensitivity_safe: true,
    irritation_risk: "low"
  },
  "dc1ef3f3-db1b-4c3f-954a-b18343e3d9f3": {
    uv_filter_type: "mineral",
    tone_up: false,
    white_cast: "medium",
    eye_sting: "low",
    pilling_risk: "medium",
    texture: "cream",
    finish: "natural",
    sensitivity_safe: true,
    irritation_risk: "low"
  },
  "dd326b18-ea56-45fb-8571-42186b6c9159": {
    uv_filter_type: "hybrid",
    tone_up: true,
    white_cast: "low",
    eye_sting: "low",
    pilling_risk: "low",
    texture: "cream",
    finish: "natural",
    sensitivity_safe: true,
    irritation_risk: "low"
  },
  "fdf06871-db8e-4e73-a48c-c057c5ce925d": {
    uv_filter_type: "organic",
    tone_up: false,
    white_cast: "low",
    eye_sting: "low",
    pilling_risk: "low",
    texture: "watery",
    finish: "dewy",
    sensitivity_safe: true,
    irritation_risk: "low"
  }
};

const SUNSCREEN_OVERRIDES_BY_PRODUCT_KEY = {
  "뷰티오브조선::맑은쌀 선크림 아쿠아프레쉬": {
    eye_sting: "medium",
    pilling_risk: "low",
    texture: "watery",
    finish: "fresh",
    sensitivity_safe: true,
    irritation_risk: "low"
  },
  "토리든::다이브인 워터리 모이스처 선크림": {
    eye_sting: "low",
    pilling_risk: "low",
    texture: "watery",
    finish: "natural",
    sensitivity_safe: true,
    irritation_risk: "low"
  },
  "에스트라::더마 UV365 레드 카밍 톤업 선스크린": {
    white_cast: "medium",
    eye_sting: "low",
    pilling_risk: "low",
    texture: "lotion",
    finish: "natural",
    sensitivity_safe: true,
    irritation_risk: "low"
  },
  "스킨1004::히알루-시카 워터핏 선세럼 uv": {
    eye_sting: "low",
    pilling_risk: "low",
    texture: "watery",
    finish: "natural",
    sensitivity_safe: true,
    irritation_risk: "low"
  },
  "라운드랩::자작나무 마일드업 선스크린 uvlock": {
    texture: "lotion",
    finish: "natural",
    sensitivity_safe: true,
    irritation_risk: "low"
  },
  "닥터지::그린 마일드 업 선 플러스": {
    white_cast: "high",
    eye_sting: "low",
    pilling_risk: "low",
    texture: "lotion",
    finish: "soft_matte",
    sensitivity_safe: true,
    irritation_risk: "low"
  },
  "뷰티오브조선::맑은쌀 선크림": {
    eye_sting: "medium",
    pilling_risk: "medium",
    texture: "lotion",
    finish: "dewy",
    sensitivity_safe: true,
    irritation_risk: "low"
  },
  "에스트라::더마uv365 장벽수분 무기자차 선크림": {
    white_cast: "medium",
    pilling_risk: "low",
    texture: "lotion",
    finish: "natural",
    sensitivity_safe: true,
    irritation_risk: "low"
  },
  "이즈앤트리::히아루론산 워터리 선젤": {
    texture: "watery",
    finish: "dewy",
    sensitivity_safe: true,
    irritation_risk: "low"
  }
};

const SUNSCREEN_OVERRIDE_MATCHERS = [
  {
    match: ({ brand, name }) =>
      brand.includes("닥터지") || (brand.includes("dr.g") && name.includes("green mild")),
    data: {
      uv_filter_type: "mineral",
      tone_up: true,
      white_cast: "high",
      eye_sting: "low",
      pilling_risk: "low",
      texture: "lotion",
      finish: "soft_matte",
      sensitivity_safe: true,
      irritation_risk: "low"
    }
  },
  {
    match: ({ brand, name }) =>
      brand.includes("에스트라") && name.includes("배리어") && name.includes("미네랄"),
    data: {
      uv_filter_type: "mineral",
      tone_up: false,
      white_cast: "medium",
      eye_sting: "low",
      pilling_risk: "low",
      texture: "lotion",
      finish: "natural",
      sensitivity_safe: true,
      irritation_risk: "low"
    }
  },
  {
    match: ({ brand, name }) =>
      (brand.includes("라운드랩") && name.includes("마일드업")) ||
      (brand.includes("round lab") && name.includes("mild up")),
    data: {
      uv_filter_type: "mineral",
      tone_up: true,
      white_cast: "medium",
      eye_sting: "low",
      pilling_risk: "low",
      texture: "lotion",
      finish: "natural",
      sensitivity_safe: true,
      irritation_risk: "low"
    }
  },
  {
    match: ({ brand, name }) =>
      (brand.includes("뷰티오브조선") && name.includes("릴리프 선") && !name.includes("아쿠아")) ||
      (brand.includes("beauty of joseon") && name.includes("relief sun") && !name.includes("aqua")),
    data: {
      uv_filter_type: "organic",
      tone_up: false,
      white_cast: "none",
      eye_sting: "medium",
      pilling_risk: "medium",
      texture: "lotion",
      finish: "dewy",
      sensitivity_safe: true,
      irritation_risk: "low"
    }
  },
  {
    match: ({ brand, name }) =>
      (brand.includes("뷰티오브조선") && name.includes("아쿠아프레시")) ||
      (brand.includes("beauty of joseon") && name.includes("aqua")),
    data: {
      uv_filter_type: "organic",
      tone_up: false,
      white_cast: "none",
      eye_sting: "medium",
      pilling_risk: "low",
      texture: "watery",
      finish: "fresh",
      sensitivity_safe: true,
      irritation_risk: "low"
    }
  },
  {
    match: ({ brand, name }) =>
      (brand.includes("스킨1004") && name.includes("선세럼")) ||
      (brand.includes("skin1004") && name.includes("sun serum")),
    data: {
      uv_filter_type: "organic",
      tone_up: false,
      white_cast: "none",
      eye_sting: "low",
      pilling_risk: "low",
      texture: "watery",
      finish: "natural",
      sensitivity_safe: true,
      irritation_risk: "low"
    }
  },
  {
    match: ({ brand, name }) =>
      (brand.includes("이즈앤트리") && name.includes("선젤")) ||
      (brand.includes("isntree") && name.includes("sun gel")),
    data: {
      uv_filter_type: "organic",
      tone_up: false,
      white_cast: "none",
      eye_sting: "medium",
      pilling_risk: "medium",
      texture: "watery",
      finish: "dewy",
      sensitivity_safe: true,
      irritation_risk: "low"
    }
  },
  {
    match: ({ brand, name }) =>
      brand.includes("에스트라") && name.includes("레드 카밍") && name.includes("톤업"),
    data: {
      uv_filter_type: "hybrid",
      tone_up: true,
      white_cast: "medium",
      eye_sting: "low",
      pilling_risk: "low",
      texture: "lotion",
      finish: "natural",
      sensitivity_safe: true,
      irritation_risk: "low"
    }
  },
  {
    match: ({ brand, name }) =>
      (brand.includes("토리든") && name.includes("워터리")) ||
      (brand.includes("torriden") && name.includes("watery")),
    data: {
      uv_filter_type: "organic",
      tone_up: false,
      white_cast: "none",
      eye_sting: "low",
      pilling_risk: "low",
      texture: "watery",
      finish: "natural",
      sensitivity_safe: true,
      irritation_risk: "low"
    }
  }
];

let cachedProducts = null;
let cachedAt = 0;
let inFlightProductsPromise = null;

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function getSunscreenOverride(product) {
  if (product?.category !== "sunscreen") {
    return null;
  }

  const normalizedId = normalizeText(product.id);
  const productKey = `${normalizeText(product.brand)}::${normalizeText(product.name)}`;
  const overrideById = normalizedId ? SUNSCREEN_OVERRIDES_BY_ID[normalizedId] : null;
  const overrideByProductKey = productKey ? SUNSCREEN_OVERRIDES_BY_PRODUCT_KEY[productKey] : null;

  if (overrideById) {
    return overrideById;
  }

  if (overrideByProductKey) {
    return overrideByProductKey;
  }

  const normalizedProduct = {
    brand: normalizeText(product.brand),
    name: normalizeText(product.name)
  };

  return SUNSCREEN_OVERRIDE_MATCHERS.find((override) => override.match(normalizedProduct))?.data || null;
}

function applyRecommendationProductOverrides(product) {
  const sunscreenOverride = getSunscreenOverride(product);

  if (!sunscreenOverride) {
    return product;
  }

  const mergedSunscreenMetadata = Object.entries(sunscreenOverride).reduce(
    (acc, [key, value]) => {
      if (acc[key] == null && value != null) {
        acc[key] = value;
      }

      return acc;
    },
    { ...product },
  );

  return {
    ...mergedSunscreenMetadata,
  };
}

function uniqueValues(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function parseListValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return [];
    }

    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);

        if (Array.isArray(parsed)) {
          return parsed.map((item) => String(item).trim()).filter(Boolean);
        }
      } catch {}
    }

    return trimmed
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function mapCategory(value, fallback = "toner_essence") {
  return CATEGORY_MAP[normalizeText(value)] || fallback;
}

function inferMoisturizerCategory(product) {
  const rawCategory = normalizeText(product?.category);
  const name = normalizeText(`${product?.brand || ""} ${product?.name || ""}`);
  const texture = normalizeText(product?.texture);

  if (isMoisturizerCategory(rawCategory)) {
    return rawCategory;
  }

  if (rawCategory !== "moisturizer") {
    return null;
  }

  if (name.includes("balm") || name.includes("ointment") || name.includes("밤")) {
    return "moisturizer_balm";
  }

  if (texture === "lotion" || name.includes("lotion") || name.includes("emulsion") || name.includes("로션") || name.includes("에멀전")) {
    return "moisturizer_lotion_emulsion";
  }

  if (name.includes("cream") || name.includes("크림")) {
    return "moisturizer_cream";
  }

  if (
    name.includes("water gel") ||
    name.includes("aqua gel") ||
    name.includes("aloe gel") ||
    name.includes("수딩젤") ||
    name.includes("수분젤")
  ) {
    return "moisturizer_gel";
  }

  return "moisturizer_cream";
}

function mapConcerns(value, fallback = []) {
  const mapped = parseListValue(value)
    .map((item) => CONCERN_MAP[normalizeText(item)])
    .filter(Boolean);

  return mapped.length ? uniqueValues(mapped) : fallback;
}

function mapSkinTypes(value, fallback = []) {
  const mapped = parseListValue(value)
    .map((item) => normalizeText(item))
    .filter((item) => ALLOWED_SKIN_TYPES.includes(item));

  return mapped.length ? uniqueValues(mapped) : fallback;
}

function mapTexture(value, fallback = "watery") {
  return TEXTURE_MAP[normalizeText(value)] || fallback;
}

function mapFinish(value, fallback = "natural") {
  return FINISH_MAP[normalizeText(value)] || fallback;
}

function mapAllowedValue(value, allowedValues) {
  const normalizedValue = normalizeText(value);
  return allowedValues.includes(normalizedValue) ? normalizedValue : null;
}

function mapIrritationRisk(value, sensitivitySafe) {
  if (typeof value === "string") {
    const normalizedValue = normalizeText(value);

    if (["low", "medium", "high"].includes(normalizedValue)) {
      return normalizedValue;
    }

    const parsedNumber = Number.parseInt(normalizedValue, 10);

    if (Number.isFinite(parsedNumber)) {
      if (parsedNumber <= 1) {
        return "low";
      }

      return parsedNumber >= 3 ? "high" : "medium";
    }
  }

  if (typeof value === "number") {
    if (value <= 1) {
      return "low";
    }

    return value >= 3 ? "high" : "medium";
  }

  if (sensitivitySafe === true) {
    return "low";
  }

  return "medium";
}

function mapPriceRange(priceMin, priceMax, fallback = "$$") {
  const ceiling = Number(priceMax || priceMin || 0);

  if (!ceiling) {
    return fallback;
  }

  if (ceiling < 20000) {
    return "$";
  }

  if (ceiling < 40000) {
    return "$$";
  }

  return "$$$";
}

function normalizeBuyLink(value) {
  const buyLink = String(value || "").trim();

  if (!buyLink || buyLink.includes("example.com")) {
    return "";
  }

  // Keep direct links only when they point to an exact Olive Young product detail page.
  if (/oliveyoung\.co\.kr\/.*getGoodsDetail/i.test(buyLink)) {
    return buyLink;
  }

  return "";
}

function deriveAbsorption(texture) {
  if (texture === "cream") {
    return "slow";
  }

  if (texture === "lotion") {
    return "medium";
  }

  return "fast";
}

function deriveBarrierSupport(concerns, irritationRisk) {
  if (concerns.includes("barrier") || concerns.includes("redness")) {
    return "high";
  }

  if (irritationRisk === "low") {
    return "medium";
  }

  return "low";
}

function deriveClimateFit(category, texture, finish) {
  const climate = new Set();

  if (category === "sunscreen") {
    climate.add("outdoor");
  }

  if (["watery", "gel"].includes(texture)) {
    climate.add("humidity");
    climate.add("heat");
  }

  if (["lotion", "cream"].includes(texture) || finish === "dewy") {
    climate.add("aircon");
  }

  if (finish === "natural" || finish === "soft_matte") {
    climate.add("mask");
  }

  return Array.from(climate);
}

function deriveSebumControl(concerns, texture, finish) {
  if (concerns.includes("oiliness") || concerns.includes("pores")) {
    return 4;
  }

  if (["watery", "gel"].includes(texture) || finish === "fresh" || finish === "soft_matte") {
    return 3;
  }

  return 2;
}

function deriveHydrationLevel(concerns, texture, finish) {
  if (concerns.includes("dehydration") || concerns.includes("barrier")) {
    return 4;
  }

  if (["lotion", "cream"].includes(texture) || finish === "dewy") {
    return 4;
  }

  return 3;
}

function deriveComedogenicRisk(texture, finish) {
  if (texture === "cream" && finish === "dewy") {
    return "medium";
  }

  return "low";
}

function deriveUseTime(category) {
  return category === "sunscreen" ? "day" : "both";
}

function buildFallbackReason(name, category) {
  const labelMap = {
    cleanser: "keeps the cleanse step lighter and easier to repeat",
    toner_essence: "keeps the first hydration layer easy to build",
    toner_pad: "keeps the swipe-on hydration step easy to layer",
    essence: "adds a lighter targeted layer without forcing a full serum texture",
    serum: "adds a focused concern step without overloading the routine",
    ampoule: "adds a more concentrated targeted step without overloading the routine",
    moisturizer: "finishes the routine with steadier comfort",
    moisturizer_lotion_emulsion: "adds light oil-water balance without making the routine feel heavy",
    moisturizer_gel: "adds fresh hydration and cooling comfort without a rich finish",
    moisturizer_cream: "finishes the routine with steadier barrier comfort",
    moisturizer_balm: "adds a stronger protective layer for dry or damaged spots",
    sunscreen: "keeps daytime protection easier to wear"
  };

  return `${name} ${labelMap[category] || "stays easier to use consistently"} based on the current Supabase product metadata.`;
}

function buildFallbackNotes(category) {
  const noteMap = {
    cleanser: "Supabase cleanser metadata.",
    toner_essence: "Supabase toner metadata.",
    toner_pad: "Supabase toner pad metadata.",
    essence: "Supabase essence metadata.",
    serum: "Supabase serum metadata.",
    ampoule: "Supabase ampoule metadata.",
    moisturizer: "Supabase moisturizer metadata.",
    moisturizer_lotion_emulsion: "Supabase moisturizer lotion/emulsion metadata.",
    moisturizer_gel: "Supabase moisturizer gel metadata.",
    moisturizer_cream: "Supabase moisturizer cream metadata.",
    moisturizer_balm: "Supabase moisturizer balm metadata.",
    sunscreen: "Supabase sunscreen metadata."
  };

  return noteMap[category] || "Supabase product metadata.";
}

function buildSupabaseProduct(product) {
  const category = inferMoisturizerCategory(product) || mapCategory(product.category);
  const texture = mapTexture(product.texture);
  const finish = mapFinish(product.finish);
  const concerns = mapConcerns(product.concerns, ["dehydration"]);
  const irritationRisk = mapIrritationRisk(product.irritation_risk, product.sensitivity_safe);
  const sensitivitySafe = Boolean(product.sensitivity_safe);
  const priceMin = Number(product.price_min || 0) || null;
  const priceMax = Number(product.price_max || 0) || null;
  const reviewSignals = product?.review_signals == null ? null : product.review_signals;
  const marketSignals = product?.market_signals && typeof product.market_signals === "object"
    ? product.market_signals
    : null;
  const ingredientSignals = product?.ingredient_signals && typeof product.ingredient_signals === "object"
    ? product.ingredient_signals
    : null;

  return {
    id: String(product.id),
    name: String(product.name || "Unknown Product"),
    brand: String(product.brand || "Unknown Brand"),
    category,
    recommendation_tier: typeof product.recommendation_tier === "string"
      ? product.recommendation_tier
      : null,
    skin_types: mapSkinTypes(product.skin_types, ["combination"]),
    concerns: concerns.length ? concerns : ["dehydration"],
    texture,
    finish,
    absorption: deriveAbsorption(texture),
    barrier_support: deriveBarrierSupport(concerns, irritationRisk),
    irritation_risk: irritationRisk,
    sensitivity_safe: sensitivitySafe,
    is_mens: Boolean(product.is_mens),
    climate_fit: deriveClimateFit(category, texture, finish),
    sebum_control: deriveSebumControl(concerns, texture, finish),
    hydration_level: deriveHydrationLevel(concerns, texture, finish),
    comedogenic_risk: deriveComedogenicRisk(texture, finish),
    use_time: isMoisturizerCategory(category) ? "both" : deriveUseTime(category),
    standout_reason: buildFallbackReason(product.name, category),
    notes: buildFallbackNotes(category),
    // Recommendation products stay at the product-line level, not SKU / set / refill splits.
    buy_link: normalizeBuyLink(product.buy_link),
    image_url: String(product.image_url || ""),
    price_min: priceMin,
    price_max: priceMax,
    price_range: mapPriceRange(product.price_min, product.price_max),
    is_kbeauty: true,
    uv_filter_type: mapAllowedValue(product.uv_filter_type, ["mineral", "organic", "hybrid"]),
    tone_up: typeof product.tone_up === "boolean" ? product.tone_up : null,
    white_cast: mapAllowedValue(product.white_cast, ["none", "low", "medium", "high"]),
    eye_sting: mapAllowedValue(product.eye_sting, ["low", "medium", "high"]),
    pilling_risk: mapAllowedValue(product.pilling_risk, ["low", "medium", "high"]),
    review_signals: reviewSignals,
    market_signals: marketSignals,
    ingredient_signals: ingredientSignals
  };
}

function getSupabaseConfig() {
  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return {
    supabaseUrl: supabaseUrl.startsWith("http")
      ? supabaseUrl
      : `https://${supabaseUrl}`,
    supabaseAnonKey
  };
}

async function fetchSupabaseProducts() {
  const supabaseConfig = getSupabaseConfig();

  if (!supabaseConfig) {
    return [];
  }

  const supabase = createClient(
    supabaseConfig.supabaseUrl,
    supabaseConfig.supabaseAnonKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("[product-source] failed to load Supabase products", error.message);
    return [];
  }

  return (data || [])
    .filter((product) => product?.name && product?.brand)
    .map(buildSupabaseProduct);
}

async function loadRecommendationProducts() {
  const supabaseProducts = await fetchSupabaseProducts();
  const baseProducts = supabaseProducts.length > 0 ? supabaseProducts : LEGACY_PRODUCT_DB;

  return baseProducts
    .map(applyRecommendationProductOverrides)
    .map((product) => ({
      ...product,
      review_signals: normalizeReviewSignals(product?.review_signals)
    }));
}

export async function getRecommendationProducts() {
  if (cachedProducts && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedProducts;
  }

  if (!inFlightProductsPromise) {
    inFlightProductsPromise = loadRecommendationProducts()
      .then((products) => {
        cachedProducts = products;
        cachedAt = Date.now();
        return products;
      })
      .finally(() => {
        inFlightProductsPromise = null;
      });
  }

  return inFlightProductsPromise;
}
