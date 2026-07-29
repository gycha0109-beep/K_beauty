const FUNCTIONAL_LABEL_AXIS_MAP = {
  "skin hydration": "hydration",
  "moisture evaporation blocking": "moisture_lock",
  "skin protection": "barrier_support",
  "soothing/astringent": "soothing",
  exfoliation: "exfoliation",
  whitening: "tone_care",
  "acne relief": "acne_care",
  "uv protection": "sunscreen_protection",
  "wrinkle improvement": "wrinkle_care"
};

const CATEGORY_ROLE_MAP = {
  cleanser: "cleansing",
  toner_essence: "hydration_base",
  toner_pad: "hydration_base",
  serum: "functional_leave_on",
  ampoule: "functional_leave_on",
  essence: "functional_leave_on",
  treatment: "functional_leave_on",
  moisturizer: "support",
  moisturizer_lotion_emulsion: "support",
  moisturizer_gel: "support",
  moisturizer_cream: "support",
  moisturizer_balm: "support",
  sunscreen: "protection"
};

const LEAVE_ON_ACTIVE_AXES = new Set([
  "exfoliation",
  "acne_care",
  "tone_care",
  "wrinkle_care"
]);

const MOISTURIZER_NATURAL_AXES = new Set([
  "hydration",
  "moisture_lock",
  "barrier_support",
  "soothing"
]);

const SUNSCREEN_METADATA_FIELDS = ["spf_value", "uva_label", "uv_filter_type"];

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function parseCount(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }

  const parsed = Number.parseInt(String(value || "").replace(/[^\d]/g, ""), 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function compareStrength(left, right) {
  const rank = { none: 0, low: 1, medium: 2, high: 3 };
  return (rank[left] || 0) - (rank[right] || 0);
}

function minStrength(value, cap) {
  return compareStrength(value, cap) > 0 ? cap : value;
}

function strengthFromCount(count) {
  if (count <= 0) {
    return "none";
  }

  if (count <= 2) {
    return "low";
  }

  if (count <= 7) {
    return "medium";
  }

  return "high";
}

function getCategory(product) {
  return normalizeText(product?.category);
}

function getCategoryRole(category) {
  return CATEGORY_ROLE_MAP[category] || "unknown";
}

function hasSunscreenMetadata(product) {
  return SUNSCREEN_METADATA_FIELDS.every((field) => {
    const value = product?.[field];
    return value != null && String(value).trim() !== "";
  });
}

function normalizeFunctionalEntries(ingredientSignals) {
  const sourceEntries = Array.isArray(ingredientSignals?.functional)
    ? ingredientSignals.functional
    : [];

  return sourceEntries
    .map((entry) => ({
      label: String(entry?.label || "").trim(),
      count: parseCount(entry?.count)
    }))
    .filter((entry) => entry.label && entry.count > 0);
}

function getAxisForLabel(label) {
  return FUNCTIONAL_LABEL_AXIS_MAP[normalizeText(label)] || null;
}

function isMoisturizerCategory(category) {
  return category === "moisturizer" || category.startsWith("moisturizer_");
}

function adjustStrengthForCategory(strength, axis, category) {
  if (strength === "none") {
    return strength;
  }

  if (category === "cleanser") {
    return minStrength(strength, "low");
  }

  if (category === "toner_pad" && axis === "exfoliation") {
    return minStrength(strength, "medium");
  }

  if (isMoisturizerCategory(category) && !MOISTURIZER_NATURAL_AXES.has(axis)) {
    return minStrength(strength, "low");
  }

  return strength;
}

function resolveConfidence({ axis, category, count, product }) {
  if (count <= 0) {
    return "none";
  }

  if (category === "cleanser") {
    return "low";
  }

  if (category === "sunscreen") {
    if (axis !== "sunscreen_protection") {
      return "low";
    }

    return hasSunscreenMetadata(product) ? "high" : "medium";
  }

  if (["treatment", "serum", "ampoule", "essence"].includes(category)) {
    return LEAVE_ON_ACTIVE_AXES.has(axis) || count >= 3 ? "high" : "medium";
  }

  if (category === "toner_pad") {
    return axis === "exfoliation" ? "medium" : count >= 3 ? "medium" : "low";
  }

  if (category === "toner_essence") {
    return MOISTURIZER_NATURAL_AXES.has(axis) ? "medium" : "low";
  }

  if (isMoisturizerCategory(category)) {
    return MOISTURIZER_NATURAL_AXES.has(axis) && count >= 3 ? "high" : "low";
  }

  return "low";
}

function makeEvidenceSummary(functionalEntries, categoryAdjustments) {
  if (!functionalEntries.length) {
    return "functional signals unavailable";
  }

  const signals = functionalEntries
    .map((entry) => `${entry.label}(${entry.count})`)
    .join(", ");
  const adjustments = categoryAdjustments.length
    ? `; ${categoryAdjustments.join(", ")}`
    : "";

  return `functional signals: ${signals}${adjustments}`;
}

function addUniqueTag(tags, tag) {
  if (tag && !tags.includes(tag)) {
    tags.push(tag);
  }
}

function collectCautionTags({ category, axes, unknownFunctionalLabels, product }) {
  const tags = [];

  if (category === "cleanser" && axes.length) {
    addUniqueTag(tags, "rinse_off_limit");
  }

  if (
    axes.some((axis) => axis.axis === "exfoliation") &&
    ["toner_pad", "treatment", "serum", "ampoule", "essence"].includes(category)
  ) {
    addUniqueTag(tags, "exfoliation_overlap_watch");
  }

  if (unknownFunctionalLabels.length) {
    addUniqueTag(tags, "unknown_functional_signal");
  }

  if (!axes.length) {
    addUniqueTag(tags, "low_evidence");
  }

  if (product?.sensitivity_safe === false && axes.length) {
    addUniqueTag(tags, "sensitive_use_watch");
  }

  if (["medium", "high"].includes(normalizeText(product?.irritation_risk)) && axes.length) {
    addUniqueTag(tags, "irritation_risk_watch");
  }

  if (
    category === "sunscreen" &&
    axes.some((axis) => axis.axis === "sunscreen_protection") &&
    !hasSunscreenMetadata(product)
  ) {
    addUniqueTag(tags, "sunscreen_metadata_incomplete");
  }

  return tags;
}

export function resolveProductFunctionalProfile(product = {}) {
  const category = getCategory(product);
  const categoryRole = getCategoryRole(category);
  const ingredientSignals =
    product?.ingredient_signals && typeof product.ingredient_signals === "object"
      ? product.ingredient_signals
      : null;
  const functionalEntries = normalizeFunctionalEntries(ingredientSignals);
  const unknownFunctionalLabels = [];
  const axisMap = new Map();

  for (const entry of functionalEntries) {
    const axis = getAxisForLabel(entry.label);

    if (!axis) {
      unknownFunctionalLabels.push(entry.label);
      continue;
    }

    if (!axisMap.has(axis)) {
      axisMap.set(axis, {
        axis,
        count: 0,
        evidence: []
      });
    }

    const item = axisMap.get(axis);
    item.count += entry.count;
    item.evidence.push({
      source: "ingredient_signals.functional",
      label: entry.label,
      count: entry.count
    });
  }

  const categoryAdjustment = [];

  if (category === "cleanser" && axisMap.size > 0) {
    categoryAdjustment.push("rinse-off category adjustment applied");
  }

  if (category === "toner_pad" && axisMap.has("exfoliation")) {
    categoryAdjustment.push("toner pad exfoliation overlap watch applied");
  }

  if (isMoisturizerCategory(category)) {
    const hasWeakMoisturizerAxis = Array.from(axisMap.keys()).some(
      (axis) => !MOISTURIZER_NATURAL_AXES.has(axis)
    );

    if (hasWeakMoisturizerAxis) {
      categoryAdjustment.push("moisturizer support-category confidence adjustment applied");
    }
  }

  if (category === "sunscreen" && axisMap.has("sunscreen_protection")) {
    categoryAdjustment.push(
      hasSunscreenMetadata(product)
        ? "sunscreen metadata support applied"
        : "sunscreen metadata incomplete"
    );
  }

  const functionalAxes = Array.from(axisMap.values()).map((item) => {
    const rawStrength = strengthFromCount(item.count);
    const strength = adjustStrengthForCategory(rawStrength, item.axis, category);

    return {
      axis: item.axis,
      strength,
      confidence: resolveConfidence({
        axis: item.axis,
        category,
        count: item.count,
        product
      }),
      evidence: item.evidence
    };
  });

  const cautionTags = collectCautionTags({
    category,
    axes: functionalAxes,
    unknownFunctionalLabels,
    product
  });
  const sourceCompleteness = functionalEntries.length
    ? "functional_signals_available"
    : "functional_signals_missing";

  return {
    productId: String(product?.id || product?.productId || product?.product_id || "").trim() || null,
    categoryRole,
    functionalAxes,
    cautionTags,
    evidenceSummary: makeEvidenceSummary(functionalEntries, categoryAdjustment),
    unknownFunctionalLabels,
    evaluable: functionalAxes.length > 0,
    categoryAdjustment,
    sourceCompleteness
  };
}

export const PRODUCT_FUNCTIONAL_LABEL_AXIS_MAP = FUNCTIONAL_LABEL_AXIS_MAP;
