export const CURRENT_PRODUCT_CATEGORIES = [
  "cleanser",
  "toner_essence",
  "toner_pad",
  "serum",
  "ampoule",
  "essence",
  "moisturizer",
  "sunscreen",
  "special"
];

export const CURRENT_PRODUCT_STATUSES = ["selected", "not_in_db", "not_using"];
export const CURRENT_PRODUCT_USE_TIMES = ["morning", "evening", "both", "occasional"];
export const CURRENT_PRODUCT_SATISFACTIONS = ["good", "okay", "unknown", "bad"];

const CATEGORY_ALIASES = {
  moisturizer_lotion_emulsion: "moisturizer",
  moisturizer_gel: "moisturizer",
  moisturizer_cream: "moisturizer",
  moisturizer_balm: "moisturizer",
  treatment: "special",
  spot: "special",
  mask: "special"
};

const CATEGORY_LABELS = {
  ko: {
    cleanser: "클렌저",
    toner_essence: "토너/에센스",
    toner_pad: "토너 패드",
    serum: "세럼",
    ampoule: "앰플",
    essence: "에센스",
    moisturizer: "크림/보습제",
    sunscreen: "선크림",
    special: "기능성/스페셜 케어"
  },
  en: {
    cleanser: "Cleanser",
    toner_essence: "Toner / essence",
    toner_pad: "Toner pad",
    serum: "Serum",
    ampoule: "Ampoule",
    essence: "Essence",
    moisturizer: "Moisturizer",
    sunscreen: "Sunscreen",
    special: "Special care"
  }
};

export function normalizeCurrentProductCategory(category) {
  const raw = String(category || "").trim();
  const normalized = CATEGORY_ALIASES[raw] || raw;
  return CURRENT_PRODUCT_CATEGORIES.includes(normalized) ? normalized : "";
}

export function getCurrentProductCategoryLabel(category, locale = "ko") {
  const labels = CATEGORY_LABELS[locale === "en" ? "en" : "ko"];
  return labels[category] || category;
}

function parseCurrentProductsInput(input) {
  if (Array.isArray(input)) {
    return input;
  }

  if (typeof input !== "string" || !input.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(input);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function sanitizeCurrentProducts(input) {
  const items = parseCurrentProductsInput(input);
  const seenCategories = new Set();
  const sanitized = [];

  for (const item of items) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const category = normalizeCurrentProductCategory(item.category);
    const status = String(item.status || "").trim();

    if (!category || !CURRENT_PRODUCT_STATUSES.includes(status) || seenCategories.has(category)) {
      continue;
    }

    if (status === "selected") {
      const productId = String(item.productId || item.product_id || "").trim();

      if (!productId) {
        continue;
      }

      const next = { category, status, productId };

      if (CURRENT_PRODUCT_USE_TIMES.includes(item.useTime)) {
        next.useTime = item.useTime;
      }

      if (CURRENT_PRODUCT_SATISFACTIONS.includes(item.satisfaction)) {
        next.satisfaction = item.satisfaction;
      }

      sanitized.push(next);
      seenCategories.add(category);
      continue;
    }

    const next = { category, status };

    if (status === "not_in_db" && CURRENT_PRODUCT_USE_TIMES.includes(item.useTime)) {
      next.useTime = item.useTime;
    }

    if (status === "not_in_db" && CURRENT_PRODUCT_SATISFACTIONS.includes(item.satisfaction)) {
      next.satisfaction = item.satisfaction;
    }

    sanitized.push(next);
    seenCategories.add(category);
  }

  return sanitized;
}

function getSelectedProductSnapshot(selection, productLookup) {
  const product = productLookup.get(selection.productId);

  if (!product) {
    return null;
  }

  return {
    id: product.id || selection.productId,
    brand: product.brand || "",
    name: product.name || "",
    category: product.category || selection.category,
    product_form: product.product_form || product.productForm || "",
    image_url: product.image_url || ""
  };
}

export function buildCurrentProductsReport(selections = [], options = {}) {
  const sanitized = sanitizeCurrentProducts(selections);

  if (!sanitized.length) {
    return null;
  }

  const products = Array.isArray(options.productSnapshots) ? options.productSnapshots : [];
  const productLookup = new Map(
    products
      .filter((product) => product?.id)
      .map((product) => [String(product.id), product])
  );

  const enrichedSelections = sanitized.map((selection) => {
    if (selection.status !== "selected") {
      return selection;
    }

    return {
      ...selection,
      productSnapshot: getSelectedProductSnapshot(selection, productLookup)
    };
  });

  const sunscreen = enrichedSelections.find((item) => item.category === "sunscreen") || null;

  return {
    selections: enrichedSelections,
    summary: {
      total: enrichedSelections.length,
      selectedCount: enrichedSelections.filter((item) => item.status === "selected").length,
      notInDbCount: enrichedSelections.filter((item) => item.status === "not_in_db").length,
      notUsingCount: enrichedSelections.filter((item) => item.status === "not_using").length,
      sunscreenStatus: sunscreen?.status || "unknown"
    }
  };
}
