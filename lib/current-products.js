import { resolveProductCategorySemantics } from "@/lib/product-category-normalizer";
import { resolveSafeProductImage } from "@/lib/security/image-source-policy";
import { buildCurrentProductSnapshotProtectionMetadata } from "@/lib/current-product-snapshot-contract";

export const CANONICAL_CURRENT_PRODUCT_CATEGORIES = [
  "cleanser",
  "toner_essence",
  "toner_pad",
  "treatment",
  "moisturizer",
  "moisturizer_lotion_emulsion",
  "moisturizer_gel",
  "moisturizer_cream",
  "moisturizer_balm",
  "sunscreen"
];

export const CURRENT_PRODUCT_CATEGORIES = [
  "cleanser",
  "toner_essence",
  "toner_pad",
  "serum",
  "ampoule",
  "essence",
  "treatment",
  "moisturizer",
  "sunscreen"
];

export const CURRENT_PRODUCT_STATUSES = ["selected", "not_in_db", "not_using"];
export const CURRENT_PRODUCT_USE_TIMES = ["morning", "evening", "both", "occasional"];
export const CURRENT_PRODUCT_SATISFACTIONS = ["good", "okay", "unknown", "bad"];

const CATEGORY_ALIASES = {
  moisturizer_lotion_emulsion: "moisturizer",
  moisturizer_gel: "moisturizer",
  moisturizer_cream: "moisturizer",
  moisturizer_balm: "moisturizer"
};

const CATEGORY_LABELS = {
  ko: {
    cleanser: "클렌저",
    toner_essence: "토너/에센스",
    toner_pad: "토너 패드",
    serum: "세럼",
    ampoule: "앰플",
    essence: "에센스",
    treatment: "세럼/앰플/에센스",
    moisturizer: "크림/보습제",
    sunscreen: "선크림"
  },
  en: {
    cleanser: "Cleanser",
    toner_essence: "Toner / essence",
    toner_pad: "Toner pad",
    serum: "Serum",
    ampoule: "Ampoule",
    essence: "Essence",
    treatment: "Serum / ampoule / essence",
    moisturizer: "Moisturizer",
    sunscreen: "Sunscreen"
  }
};

const LEGACY_CURRENT_PRODUCT_CATEGORIES = new Set(["serum", "ampoule", "essence"]);

export function normalizeCurrentProductCategory(category) {
  const raw = String(category || "").trim();
  const normalized = CATEGORY_ALIASES[raw] || raw;
  return CURRENT_PRODUCT_CATEGORIES.includes(normalized) ? normalized : "";
}

export function normalizeCanonicalCurrentProductCategory(category) {
  const normalized = String(category || "").trim();
  return CANONICAL_CURRENT_PRODUCT_CATEGORIES.includes(normalized) ? normalized : "";
}

export function isLegacyCurrentProductCategory(category) {
  return LEGACY_CURRENT_PRODUCT_CATEGORIES.has(String(category || "").trim());
}

export function getCurrentProductCategoryLabel(category, locale = "ko") {
  const labels = CATEGORY_LABELS[locale === "en" ? "en" : "ko"];
  return labels[category] || category;
}

const ROUTINE_SLOT_LABELS = {
  ko: {
    cleanse: "세안",
    prep: "정리",
    hydrate: "수분 보완",
    moisturize: "보습 마무리",
    protect: "아침 보호",
    functional: "기능성"
  },
  en: {
    cleanse: "Cleanse",
    prep: "Prep",
    hydrate: "Hydration support",
    moisturize: "Moisture finish",
    protect: "Morning protection",
    functional: "Active care"
  }
};

const CURRENT_PRODUCT_ROUTINE_SLOT_MAP = {
  cleanser: [{ mode: "pm", slot: "cleanse" }],
  toner_essence: [
    { mode: "am", slot: "prep" },
    { mode: "pm", slot: "prep" }
  ],
  toner_pad: [
    { mode: "am", slot: "prep" },
    { mode: "pm", slot: "prep" }
  ],
  treatment: [
    { mode: "am", slot: "hydrate" },
    { mode: "pm", slot: "functional" }
  ],
  moisturizer: [{ mode: "pm", slot: "moisturize" }],
  sunscreen: [{ mode: "am", slot: "protect" }]
};

function getRoutineSlotLabel(slot, locale = "ko") {
  const labels = ROUTINE_SLOT_LABELS[locale === "en" ? "en" : "ko"];
  return labels[slot] || slot;
}

function getCurrentProductSnapshot(selection) {
  return selection?.productSnapshot || selection?.product || null;
}

export function resolveCurrentProductSemantics(selection) {
  const snapshot = getCurrentProductSnapshot(selection);
  const semantics = resolveProductCategorySemantics({
    category: snapshot?.category || selection?.category,
    product_form:
      snapshot?.product_form ??
      snapshot?.productForm ??
      selection?.product_form ??
      selection?.productForm
  });

  return semantics.authorizesRecommendationCategory ? semantics : null;
}

export function getCurrentProductRoutineSlots(selection) {
  const semantics = resolveCurrentProductSemantics(selection);

  if (!semantics) {
    return [];
  }

  return CURRENT_PRODUCT_ROUTINE_SLOT_MAP[semantics.canonicalCategory] || [];
}

function formatSelectedProductNames(selection, locale = "ko") {
  const snapshot = getCurrentProductSnapshot(selection);
  const brandName = String(snapshot?.brand || snapshot?.brandName || "").trim();
  const productName = String(snapshot?.name || snapshot?.productName || "").trim();

  if (brandName || productName) {
    return {
      brandName,
      productName: productName || (locale === "en" ? "Selected product" : "선택한 제품")
    };
  }

  return {
    brandName: "",
    productName: locale === "en" ? "Selected product" : "선택한 제품"
  };
}

function buildCurrentProductRoutineSlotItem(selection, slot, locale = "ko") {
  const isEnglish = locale === "en";
  const semantics = resolveCurrentProductSemantics(selection);
  const category = semantics?.canonicalCategory || normalizeCurrentProductCategory(selection?.category);
  const status = String(selection?.status || "").trim();
  const categoryLabel = getCurrentProductCategoryLabel(category, locale);
  const slotLabel = getRoutineSlotLabel(slot, locale);

  if (!semantics) {
    return null;
  }

  if (status === "selected") {
    const { brandName, productName } = formatSelectedProductNames(selection, locale);
    const hasProductDetail = Boolean(brandName || String(getCurrentProductSnapshot(selection)?.name || "").trim());

    return {
      category,
      slot,
      status,
      label: isEnglish ? "Current product" : "현재 제품",
      brandName,
      productName,
      helperText: hasProductDetail
        ? category === "sunscreen"
          ? (isEnglish ? "Reflected in the protection step." : "보호 단계 판단에 반영됩니다.")
          : (isEnglish ? "Connected to this routine step from your current inputs." : "현재 입력값 기준으로 이 단계에 연결했어요.")
        : (isEnglish ? "Details are excluded from this analysis." : "상세 정보는 이번 분석에서 제외했어요."),
      severity: "positive"
    };
  }

  if (status === "not_in_db") {
    return {
      category,
      slot,
      status,
      label: isEnglish ? "Currently using" : "현재 사용 중",
      productName: isEnglish ? `Unregistered ${categoryLabel}` : `등록되지 않은 ${categoryLabel}`,
      helperText: category === "sunscreen"
        ? (
            isEnglish
              ? "Sunscreen is treated as in use, but detailed fit is excluded."
              : "선크림은 사용 중으로 반영하되, 상세 적합도 판단은 제외했어요."
          )
        : (
            isEnglish
              ? "Not in DB · detailed fit is excluded."
              : "DB 미등록 · 상세 적합도 판단은 제외했어요."
          ),
      severity: "neutral"
    };
  }

  if (status === "not_using") {
    const isSunscreenEmpty = category === "sunscreen" && slot === "protect";

    return {
      category,
      slot,
      status,
      label: isEnglish ? "Not using" : "사용 안 함",
      productName: isSunscreenEmpty
        ? (isEnglish ? "Morning protection slot is empty." : "아침 보호 슬롯이 비어 있어요.")
        : (isEnglish ? `${slotLabel} slot is empty.` : `${slotLabel} 단계가 비어 있어요.`),
      helperText: isSunscreenEmpty
        ? (
            isEnglish
              ? "Sunscreen stays a fixed step to fill in the morning routine."
              : "선크림은 아침 루틴에서 채워야 할 고정 단계로 안내합니다."
          )
        : (
            isEnglish
              ? "You can fill this only when needed."
              : "필요할 때만 채워도 되는 단계로 봅니다."
          ),
      severity: isSunscreenEmpty ? "warning" : "empty"
    };
  }

  return null;
}

export function buildCurrentProductRoutineSlots(currentProducts, locale = "ko") {
  const selections = Array.isArray(currentProducts)
    ? currentProducts
    : Array.isArray(currentProducts?.selections)
      ? currentProducts.selections
      : [];
  const model = {
    am: {
      prep: [],
      hydrate: [],
      protect: []
    },
    pm: {
      cleanse: [],
      prep: [],
      moisturize: [],
      functional: []
    },
    summary: {
      hasSelected: false,
      hasNotInDb: false,
      hasNotUsing: false,
      sunscreenStatus: selections.length ? "missing" : null
    }
  };

  for (const selection of selections) {
    const category = normalizeCurrentProductCategory(selection?.category);
    const status = String(selection?.status || "").trim();
    const slots = getCurrentProductRoutineSlots(selection);

    if (!category || !CURRENT_PRODUCT_STATUSES.includes(status)) {
      continue;
    }

    if (status === "selected") {
      model.summary.hasSelected = true;
    }
    if (status === "not_in_db") {
      model.summary.hasNotInDb = true;
    }
    if (status === "not_using") {
      model.summary.hasNotUsing = true;
    }
    if (category === "sunscreen") {
      model.summary.sunscreenStatus = status;
    }

    for (const { mode, slot } of slots) {
      const item = buildCurrentProductRoutineSlotItem(selection, slot, locale);

      if (item && Array.isArray(model[mode]?.[slot])) {
        model[mode][slot].push(item);
      }
    }
  }

  return model;
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
    image_url: resolveSafeProductImage(product.image_url),
    ...buildCurrentProductSnapshotProtectionMetadata(product)
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
