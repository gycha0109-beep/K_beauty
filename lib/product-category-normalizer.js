const ROUTINE_SLOT_BY_MODE = Object.freeze({
  "hydrate-functional": Object.freeze({
    am: "hydrate",
    morning: "hydrate",
    pm: "functional",
    evening: "functional",
    night: "functional"
  })
});

const CATEGORY_POLICY = Object.freeze({
  cleanser: Object.freeze({
    productFamily: "cleanser",
    routineSlot: "cleanse",
    resultSection: "cleanser"
  }),
  toner_essence: Object.freeze({
    productFamily: "toner_essence",
    routineSlot: "prep",
    resultSection: "toner_essence"
  }),
  toner_pad: Object.freeze({
    productFamily: "toner_essence",
    routineSlot: "prep",
    resultSection: "toner_essence"
  }),
  essence: Object.freeze({
    productFamily: "toner_essence",
    routineSlot: "prep",
    resultSection: "toner_essence"
  }),
  serum: Object.freeze({
    productFamily: "serum_ampoule",
    routineSlot: "hydrate-functional",
    resultSection: "serum_ampoule"
  }),
  ampoule: Object.freeze({
    productFamily: "serum_ampoule",
    routineSlot: "hydrate-functional",
    resultSection: "serum_ampoule"
  }),
  treatment: Object.freeze({
    productFamily: "serum_ampoule",
    routineSlot: "hydrate-functional",
    resultSection: "serum_ampoule"
  }),
  moisturizer: Object.freeze({
    productFamily: "moisturizer",
    routineSlot: "moisturize",
    resultSection: "moisturizer"
  }),
  moisturizer_lotion_emulsion: Object.freeze({
    productFamily: "moisturizer",
    routineSlot: "moisturize",
    resultSection: "moisturizer"
  }),
  moisturizer_gel: Object.freeze({
    productFamily: "moisturizer",
    routineSlot: "moisturize",
    resultSection: "moisturizer"
  }),
  moisturizer_cream: Object.freeze({
    productFamily: "moisturizer",
    routineSlot: "moisturize",
    resultSection: "moisturizer"
  }),
  moisturizer_balm: Object.freeze({
    productFamily: "moisturizer",
    routineSlot: "moisturize",
    resultSection: "moisturizer"
  }),
  sunscreen: Object.freeze({
    productFamily: "sunscreen",
    routineSlot: "protect",
    resultSection: "sunscreen"
  })
});

const LEGACY_CATEGORY_ALIASES = Object.freeze({
  cleansing: "cleanser",
  toner: "toner_essence",
  cream: "moisturizer_cream",
  lotion: "moisturizer_lotion_emulsion",
  emulsion: "moisturizer_lotion_emulsion",
  milk: "moisturizer_lotion_emulsion",
  fluid: "moisturizer_lotion_emulsion",
  gel: "moisturizer_gel",
  balm: "moisturizer_balm",
  sun: "sunscreen"
});

function normalizeRawCategory(rawCategory) {
  return String(rawCategory || "").trim().toLowerCase();
}

function getCanonicalCategory(rawCategory) {
  const normalized = normalizeRawCategory(rawCategory);
  return LEGACY_CATEGORY_ALIASES[normalized] || normalized;
}

function resolveRoutineSlot(policy, context) {
  const routineSlot = policy?.routineSlot || null;
  const mode = normalizeRawCategory(context?.mode || context?.routineMode || context?.timeOfDay);

  return ROUTINE_SLOT_BY_MODE[routineSlot]?.[mode] || routineSlot;
}

export function normalizeProductCategory(rawCategory) {
  const raw = normalizeRawCategory(rawCategory);
  const canonicalCategory = getCanonicalCategory(raw);
  const policy = CATEGORY_POLICY[canonicalCategory] || null;

  if (!policy) {
    return {
      rawCategory: raw,
      canonicalCategory: null,
      productFamily: null,
      routineSlot: null,
      resultSection: null,
      unsupported: true
    };
  }

  return {
    rawCategory: raw,
    canonicalCategory,
    productFamily: policy.productFamily,
    routineSlot: policy.routineSlot,
    resultSection: policy.resultSection,
    unsupported: false
  };
}

export function getProductFamily(category) {
  return normalizeProductCategory(category).productFamily;
}

export function getRoutineSlot(category, context = null) {
  const normalized = normalizeProductCategory(category);

  if (normalized.unsupported) {
    return null;
  }

  return resolveRoutineSlot(
    {
      routineSlot: normalized.routineSlot
    },
    context
  );
}

export function getResultSection(category) {
  return normalizeProductCategory(category).resultSection;
}

export function isSupportedCategory(category) {
  return !normalizeProductCategory(category).unsupported;
}

