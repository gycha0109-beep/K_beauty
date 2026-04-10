import { createClient } from "@supabase/supabase-js";
import { PRODUCT_DB as LEGACY_PRODUCT_DB } from "@/lib/backups/product-db.backup";

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
  essence: "toner_essence",
  serum: "serum",
  ampoule: "serum",
  cream: "moisturizer",
  moisturizer: "moisturizer",
  lotion: "moisturizer",
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

  if (ceiling <= 15000) {
    return "$";
  }

  if (ceiling <= 30000) {
    return "$$";
  }

  return "$$$";
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
    serum: "adds a focused concern step without overloading the routine",
    moisturizer: "finishes the routine with steadier comfort",
    sunscreen: "keeps daytime protection easier to wear"
  };

  return `${name} ${labelMap[category] || "stays easier to use consistently"} based on the current Supabase product metadata.`;
}

function buildFallbackNotes(category) {
  const noteMap = {
    cleanser: "Supabase cleanser metadata.",
    toner_essence: "Supabase toner metadata.",
    serum: "Supabase serum metadata.",
    moisturizer: "Supabase moisturizer metadata.",
    sunscreen: "Supabase sunscreen metadata."
  };

  return noteMap[category] || "Supabase product metadata.";
}

function buildSupabaseProduct(product) {
  const category = mapCategory(product.category);
  const texture = mapTexture(product.texture);
  const finish = mapFinish(product.finish);
  const concerns = mapConcerns(product.concerns, ["dehydration"]);
  const irritationRisk = mapIrritationRisk(product.irritation_risk, product.sensitivity_safe);
  const sensitivitySafe = Boolean(product.sensitivity_safe);
  const priceMin = Number(product.price_min || 0) || null;
  const priceMax = Number(product.price_max || 0) || null;

  return {
    id: String(product.id),
    name: String(product.name || "Unknown Product"),
    brand: String(product.brand || "Unknown Brand"),
    category,
    skin_types: mapSkinTypes(product.skin_types, ["combination"]),
    concerns: concerns.length ? concerns : ["dehydration"],
    texture,
    finish,
    absorption: deriveAbsorption(texture),
    barrier_support: deriveBarrierSupport(concerns, irritationRisk),
    irritation_risk: irritationRisk,
    sensitivity_safe: sensitivitySafe,
    climate_fit: deriveClimateFit(category, texture, finish),
    sebum_control: deriveSebumControl(concerns, texture, finish),
    hydration_level: deriveHydrationLevel(concerns, texture, finish),
    comedogenic_risk: deriveComedogenicRisk(texture, finish),
    use_time: deriveUseTime(category),
    standout_reason: buildFallbackReason(product.name, category),
    notes: buildFallbackNotes(category),
    buy_link: String(product.buy_link || ""),
    image_url: String(product.image_url || ""),
    price_min: priceMin,
    price_max: priceMax,
    price_range: mapPriceRange(product.price_min, product.price_max),
    is_kbeauty: true
  };
}

function getSupabaseConfig() {
  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return null;
  }

  return {
    supabaseUrl: supabaseUrl.startsWith("http")
      ? supabaseUrl
      : `https://${supabaseUrl}`,
    supabaseServiceRoleKey
  };
}

async function fetchSupabaseProducts() {
  const supabaseConfig = getSupabaseConfig();

  if (!supabaseConfig) {
    return [];
  }

  const supabase = createClient(
    supabaseConfig.supabaseUrl,
    supabaseConfig.supabaseServiceRoleKey,
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

function mergeProductSources(supabaseProducts, legacyProducts) {
  const merged = new Map();

  for (const product of supabaseProducts) {
    merged.set(`supabase:${product.id}`, product);
  }

  for (const product of legacyProducts) {
    merged.set(`legacy:${product.id}`, product);
  }

  return Array.from(merged.values());
}

async function loadRecommendationProducts() {
  const supabaseProducts = await fetchSupabaseProducts();
  const mergedProducts = mergeProductSources(supabaseProducts, LEGACY_PRODUCT_DB);

  if (mergedProducts.length === 0) {
    return LEGACY_PRODUCT_DB;
  }

  return mergedProducts;
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
