import { createHash } from "node:crypto";

export const EVAL_P3_CONTRACTS = Object.freeze({
  p2BaseMainSha: "b702652c7167b49da96ce4f5308112436e066bd3",
  recommendationReferenceSha: "783afb91a964f5d762f46846f9ef854902b48e95",
  catalogDeclaredSha256: "e4788383a21ac4207d553fbfb5300dc629b8eab5ad200ffd1313d43e94e0c856",
  routeBlobSha: "cc059eba680034d28e1ade0b1a8147d43a8b30f7",
  surveyContractBlobSha: "0ad41d8328caf1939789063ab3bc06391a2a94d1",
  recommendationScorerBlobSha: "45358401d80e5edd8c92d303462f2a415196590c",
  skinDecisionEngineBlobSha: "13945cb21c0acec1c303eedfa2b9b6000f6e066d",
  attributeProvenanceVersion: "persona-attribute-provenance-v1",
  populationProjectionVersion: "population-persona-projection-v1",
  domainPersonaVersion: "kbeauty-domain-persona-v1",
  correlationRegistryVersion: "persona-correlation-registry-v1",
  decisionModelVersion: "persona-decision-model-v1",
  metamorphicRegistryVersion: "persona-metamorphic-registry-v1",
  cohortMaterializationVersion: "persona-cohort-materialization-v1",
  harnessEquivalenceVersion: "persona-harness-equivalence-v1",
  artifactHashVersion: "persona-artifact-hash-v1",
  pocScopeVersion: "eval-p3-poc-scope-v1",
  evaluatorVersion: "eval-p3-deterministic-persona-evaluator-v1",
  routeAdapterVersion: "eval-p3-route-pinned-adapter-v1"
});

const SKIN_TYPES = ["oily", "dry", "combination", "not_sure"];
const SENSITIVITIES = ["low", "medium", "high"];
const CONCERNS = ["oiliness", "dehydration", "acne", "pores", "redness", "barrier", "uneven_tone", "uv"];
const POST_WASH = ["tight", "comfortable", "still_oily"];
const AFTERNOON = ["more_oily", "more_dry", "red_or_irritated", "mostly_same"];
const CLEANSING = ["once", "twice", "3_plus"];
const EXPOSURES = [
  ["outdoor"],
  ["humidity"],
  ["aircon"],
  ["mask"],
  ["heat", "outdoor"],
  ["kitchen", "heat"],
  ["humidity", "mask"],
  ["aircon", "outdoor"]
];
const TEXTURES = ["gel", "watery", "lotion", "cream"];
const DISLIKED = ["sticky", "greasy", "heavy"];
const OPTIONAL_FLAGS = ["yes", "no", "unknown"];
const GENDER_PREFERENCES = ["female", "male", "unspecified"];

const SET_LIKE_ARRAY_KEYS = new Set([
  "environmentExposure",
  "applicable_rule_refs",
  "oversampling_flags",
  "failure_tags",
  "rule_refs",
  "provenance_references"
]);

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createCoverageDomain(index) {
  const preferenceState = index % 8 === 6 ? "skipped" : index % 8 === 7 ? "unknown" : "answered";
  const answered = preferenceState === "answered";
  const primaryConcern = CONCERNS[index % CONCERNS.length];
  const secondaryConcern = CONCERNS[(index + 3) % CONCERNS.length];

  return {
    skinType: SKIN_TYPES[index % SKIN_TYPES.length],
    sensitivity: SENSITIVITIES[Math.floor(index / 4) % SENSITIVITIES.length],
    primaryConcern,
    secondaryConcern,
    postWashFeeling: POST_WASH[index % POST_WASH.length],
    afternoonSkinChange: AFTERNOON[index % AFTERNOON.length],
    cleansingFrequency: CLEANSING[index % CLEANSING.length],
    environmentExposure: EXPOSURES[index % EXPOSURES.length],
    preferredTexture: TEXTURES[index % TEXTURES.length],
    mostDislikedFeel: DISLIKED[index % DISLIKED.length],
    recentSkinChange: OPTIONAL_FLAGS[index % OPTIONAL_FLAGS.length],
    recentlyChangedProduct: OPTIONAL_FLAGS[(index + 1) % OPTIONAL_FLAGS.length],
    sunscreen: {
      preferenceState,
      whiteCastHate: answered ? index % 2 === 0 : false,
      toneUpWanted: answered ? index % 4 === 1 : false,
      makeupUse: answered ? index % 3 === 0 : false,
      eyeSensitive: answered ? index % 5 === 0 : false
    },
    profile: {
      genderPreference: GENDER_PREFERENCES[index % GENDER_PREFERENCES.length]
    },
    routeExtensions: {
      verySensitivePeriod: index % 7 === 0
    }
  };
}

const ADVERSARIAL_DOMAINS = [
  {
    skinType: "dry",
    sensitivity: "high",
    primaryConcern: "barrier",
    secondaryConcern: "redness",
    postWashFeeling: "tight",
    afternoonSkinChange: "red_or_irritated",
    cleansingFrequency: "3_plus",
    environmentExposure: ["aircon", "outdoor"],
    preferredTexture: "cream",
    mostDislikedFeel: "heavy",
    recentSkinChange: "yes",
    recentlyChangedProduct: "yes",
    sunscreen: { preferenceState: "answered", whiteCastHate: true, toneUpWanted: false, makeupUse: true, eyeSensitive: true },
    profile: { genderPreference: "female" },
    routeExtensions: { verySensitivePeriod: true }
  },
  {
    skinType: "oily",
    sensitivity: "high",
    primaryConcern: "dehydration",
    secondaryConcern: "oiliness",
    postWashFeeling: "tight",
    afternoonSkinChange: "more_oily",
    cleansingFrequency: "twice",
    environmentExposure: ["heat", "humidity", "outdoor"],
    preferredTexture: "watery",
    mostDislikedFeel: "greasy",
    recentSkinChange: "no",
    recentlyChangedProduct: "unknown",
    sunscreen: { preferenceState: "answered", whiteCastHate: true, toneUpWanted: false, makeupUse: false, eyeSensitive: true },
    profile: { genderPreference: "unspecified" },
    routeExtensions: { verySensitivePeriod: false }
  },
  {
    skinType: "not_sure",
    sensitivity: "medium",
    primaryConcern: "uv",
    secondaryConcern: "uneven_tone",
    postWashFeeling: "comfortable",
    afternoonSkinChange: "mostly_same",
    cleansingFrequency: "once",
    environmentExposure: ["outdoor"],
    preferredTexture: "gel",
    mostDislikedFeel: "sticky",
    recentSkinChange: "unknown",
    recentlyChangedProduct: "unknown",
    sunscreen: { preferenceState: "skipped", whiteCastHate: false, toneUpWanted: false, makeupUse: false, eyeSensitive: false },
    profile: { genderPreference: "female" },
    routeExtensions: { verySensitivePeriod: false }
  },
  {
    skinType: "combination",
    sensitivity: "low",
    primaryConcern: "pores",
    secondaryConcern: "dehydration",
    postWashFeeling: "still_oily",
    afternoonSkinChange: "more_dry",
    cleansingFrequency: "3_plus",
    environmentExposure: ["mask", "aircon"],
    preferredTexture: "lotion",
    mostDislikedFeel: "heavy",
    recentSkinChange: "yes",
    recentlyChangedProduct: "no",
    sunscreen: { preferenceState: "answered", whiteCastHate: true, toneUpWanted: false, makeupUse: true, eyeSensitive: false },
    profile: { genderPreference: "male" },
    routeExtensions: { verySensitivePeriod: false }
  },
  {
    skinType: "dry",
    sensitivity: "medium",
    primaryConcern: "oiliness",
    secondaryConcern: "barrier",
    postWashFeeling: "tight",
    afternoonSkinChange: "more_dry",
    cleansingFrequency: "once",
    environmentExposure: ["aircon"],
    preferredTexture: "cream",
    mostDislikedFeel: "greasy",
    recentSkinChange: "no",
    recentlyChangedProduct: "yes",
    sunscreen: { preferenceState: "answered", whiteCastHate: false, toneUpWanted: true, makeupUse: true, eyeSensitive: false },
    profile: { genderPreference: "unspecified" },
    routeExtensions: { verySensitivePeriod: false }
  },
  {
    skinType: "oily",
    sensitivity: "low",
    primaryConcern: "redness",
    secondaryConcern: "acne",
    postWashFeeling: "still_oily",
    afternoonSkinChange: "red_or_irritated",
    cleansingFrequency: "twice",
    environmentExposure: ["kitchen", "heat"],
    preferredTexture: "gel",
    mostDislikedFeel: "sticky",
    recentSkinChange: "yes",
    recentlyChangedProduct: "unknown",
    sunscreen: { preferenceState: "answered", whiteCastHate: false, toneUpWanted: false, makeupUse: false, eyeSensitive: true },
    profile: { genderPreference: "female" },
    routeExtensions: { verySensitivePeriod: true }
  },
  {
    skinType: "combination",
    sensitivity: "high",
    primaryConcern: "uneven_tone",
    secondaryConcern: "uv",
    postWashFeeling: "comfortable",
    afternoonSkinChange: "mostly_same",
    cleansingFrequency: "twice",
    environmentExposure: ["humidity", "outdoor"],
    preferredTexture: "watery",
    mostDislikedFeel: "greasy",
    recentSkinChange: "unknown",
    recentlyChangedProduct: "no",
    sunscreen: { preferenceState: "answered", whiteCastHate: true, toneUpWanted: true, makeupUse: true, eyeSensitive: true },
    profile: { genderPreference: "female" },
    routeExtensions: { verySensitivePeriod: false }
  },
  {
    skinType: "not_sure",
    sensitivity: "high",
    primaryConcern: "acne",
    secondaryConcern: "barrier",
    postWashFeeling: "tight",
    afternoonSkinChange: "red_or_irritated",
    cleansingFrequency: "3_plus",
    environmentExposure: ["mask", "heat", "outdoor"],
    preferredTexture: "gel",
    mostDislikedFeel: "heavy",
    recentSkinChange: "yes",
    recentlyChangedProduct: "yes",
    sunscreen: { preferenceState: "unknown", whiteCastHate: false, toneUpWanted: false, makeupUse: false, eyeSensitive: false },
    profile: { genderPreference: "unspecified" },
    routeExtensions: { verySensitivePeriod: true }
  }
];

function collectAttributeLeaves(value, prefix = "domain") {
  if (Array.isArray(value) || value === null || typeof value !== "object") {
    return [{ attribute_key: prefix, value: deepClone(value) }];
  }

  return Object.entries(value).flatMap(([key, item]) => collectAttributeLeaves(item, `${prefix}.${key}`));
}

export function getApplicableRuleRefs(domain) {
  const refs = [];
  if (domain.profile.genderPreference === "female") refs.push("POL-GENDER-001");
  if (
    domain.sensitivity === "high" ||
    ["redness", "barrier"].includes(domain.primaryConcern) ||
    domain.routeExtensions.verySensitivePeriod === true
  ) refs.push("POL-SUN-001");
  if (domain.sunscreen.preferenceState === "answered" && domain.sunscreen.eyeSensitive) refs.push("POL-SUN-002");
  if (
    domain.sunscreen.preferenceState === "answered" &&
    domain.sunscreen.whiteCastHate &&
    !domain.sunscreen.toneUpWanted
  ) refs.push("POL-SUN-003");
  if (domain.sunscreen.preferenceState === "answered" && domain.sunscreen.makeupUse) refs.push("POL-SUN-004");
  if (domain.skinType === "dry" && domain.primaryConcern !== "oiliness") refs.push("POL-SUN-005");
  return refs;
}

function materializePersona(personaId, cohortType, domain, technicalIndex) {
  const adversarial = cohortType === "ADVERSARIAL_COHORT";
  const sourceClass = adversarial ? "EXPLORATORY_STRESS_ASSIGNMENT" : "CURRENT_ENGINE_INPUT_DOMAIN";
  const correlationBasis = adversarial ? "EXPLORATORY_STRESS_CORRELATION" : "INDEPENDENT_BY_DESIGN";
  const sourceReference = adversarial ? "eval-p3-adversarial-explicit-v1" : "eval-p3-coverage-explicit-enumerator-v1";
  const attributeProvenance = collectAttributeLeaves(domain).map((leaf) => ({
    ...leaf,
    source_class: sourceClass,
    source_reference: sourceReference,
    contract_version: EVAL_P3_CONTRACTS.attributeProvenanceVersion,
    correlation_basis: correlationBasis,
    authority_ceiling: "SIMULATION_INPUT_ALLOWED"
  }));

  return {
    persona_id: personaId,
    cohort_type: cohortType,
    population: null,
    domain: deepClone(domain),
    decision_model_version: EVAL_P3_CONTRACTS.decisionModelVersion,
    applicable_rule_refs: getApplicableRuleRefs(domain),
    attribute_provenance: attributeProvenance,
    scenario_modifiers: {
      purpose: adversarial ? "TECHNICAL_ADVERSARIAL" : "TECHNICAL_COVERAGE",
      technical_index: technicalIndex,
      oversampling_flags: [adversarial ? "NON_REPRESENTATIVE_ADVERSARIAL" : "NON_REPRESENTATIVE_TECHNICAL_COVERAGE"]
    },
    materialization_version: EVAL_P3_CONTRACTS.cohortMaterializationVersion
  };
}

export function materializeP3Personas() {
  const coverage = Array.from({ length: 32 }, (_, index) =>
    materializePersona(`P3-C${String(index + 1).padStart(2, "0")}`, "COVERAGE_COHORT", createCoverageDomain(index), index + 1)
  );
  const adversarial = ADVERSARIAL_DOMAINS.map((domain, index) =>
    materializePersona(`P3-A${String(index + 1).padStart(2, "0")}`, "ADVERSARIAL_COHORT", domain, index + 1)
  );
  const personas = [...coverage, ...adversarial];
  const lineage = {
    sampling_frame: "P2_KBEAUTY_DOMAIN_PERSONA_V1_TECHNICAL_POC",
    sampling_strategy: "EXPLICIT_DETERMINISTIC_ENUMERATION",
    weighting_strategy: "NONE",
    sampler_version: "eval-p3-explicit-enumerator-v1",
    prng_algorithm: "NONE",
    seed: 0,
    oversampling_flags: ["COVERAGE_DESIGN", "ADVERSARIAL_DESIGN"],
    persona_count: personas.length
  };
  const cohortHash = semanticHash({ lineage, personas });

  return {
    schema_version: "eval-p3-materialized-persona-set-v1",
    lineage: { ...lineage, cohort_hash: cohortHash },
    personas
  };
}

const DOMAIN_KEYS = new Set([
  "skinType",
  "sensitivity",
  "primaryConcern",
  "secondaryConcern",
  "postWashFeeling",
  "afternoonSkinChange",
  "cleansingFrequency",
  "environmentExposure",
  "preferredTexture",
  "mostDislikedFeel",
  "recentSkinChange",
  "recentlyChangedProduct",
  "sunscreen",
  "profile",
  "routeExtensions"
]);

function validateEnum(errors, field, value, allowed) {
  if (!allowed.includes(value)) errors.push({ code: "INVALID_DOMAIN_ENUM", field, value });
}

export function validateDomainPersona(domain) {
  const errors = [];
  if (!domain || typeof domain !== "object" || Array.isArray(domain)) {
    return [{ code: "INVALID_DOMAIN_OBJECT", field: "domain" }];
  }

  for (const key of Object.keys(domain)) {
    if (key === "sunscreenIntent" || key === "explicitCategoryIntent") {
      errors.push({ code: "GAP-DOMAIN-003_NON_PUBLIC_SCORER_INPUT", field: key });
    } else if (!DOMAIN_KEYS.has(key)) {
      errors.push({ code: "UNKNOWN_DOMAIN_FIELD", field: key });
    }
  }

  const required = [
    "skinType",
    "sensitivity",
    "primaryConcern",
    "postWashFeeling",
    "afternoonSkinChange",
    "cleansingFrequency",
    "environmentExposure",
    "preferredTexture",
    "mostDislikedFeel",
    "recentSkinChange",
    "recentlyChangedProduct",
    "sunscreen",
    "profile",
    "routeExtensions"
  ];
  for (const key of required) {
    if (!(key in domain) || domain[key] == null) errors.push({ code: "MISSING_REQUIRED_DOMAIN_FIELD", field: key });
  }

  if (domain.skinType === "sensitive") {
    errors.push({ code: "GAP-DOMAIN-004_UNSUPPORTED_SCORER_VALUE", field: "skinType", value: domain.skinType });
  } else if (domain.skinType != null) {
    validateEnum(errors, "skinType", domain.skinType, SKIN_TYPES);
  }
  if (domain.sensitivity != null) validateEnum(errors, "sensitivity", domain.sensitivity, SENSITIVITIES);
  if (domain.primaryConcern != null) validateEnum(errors, "primaryConcern", domain.primaryConcern, CONCERNS);
  if (domain.secondaryConcern != null) validateEnum(errors, "secondaryConcern", domain.secondaryConcern, CONCERNS);
  if (domain.postWashFeeling != null) validateEnum(errors, "postWashFeeling", domain.postWashFeeling, POST_WASH);
  if (domain.afternoonSkinChange != null) validateEnum(errors, "afternoonSkinChange", domain.afternoonSkinChange, AFTERNOON);
  if (domain.cleansingFrequency != null) validateEnum(errors, "cleansingFrequency", domain.cleansingFrequency, CLEANSING);
  if (domain.preferredTexture != null) validateEnum(errors, "preferredTexture", domain.preferredTexture, TEXTURES);
  if (domain.mostDislikedFeel === "drying") {
    errors.push({ code: "GAP-DOMAIN-004_UNSUPPORTED_SCORER_VALUE", field: "mostDislikedFeel", value: domain.mostDislikedFeel });
  } else if (domain.mostDislikedFeel != null) {
    validateEnum(errors, "mostDislikedFeel", domain.mostDislikedFeel, DISLIKED);
  }
  if (domain.recentSkinChange != null) validateEnum(errors, "recentSkinChange", domain.recentSkinChange, OPTIONAL_FLAGS);
  if (domain.recentlyChangedProduct != null) validateEnum(errors, "recentlyChangedProduct", domain.recentlyChangedProduct, OPTIONAL_FLAGS);

  if (!Array.isArray(domain.environmentExposure)) {
    errors.push({ code: "INVALID_DOMAIN_TYPE", field: "environmentExposure" });
  } else {
    const allowedExposure = ["heat", "humidity", "mask", "kitchen", "outdoor", "aircon"];
    for (const value of domain.environmentExposure) validateEnum(errors, "environmentExposure", value, allowedExposure);
  }

  if (domain.sunscreen && typeof domain.sunscreen === "object") {
    validateEnum(errors, "sunscreen.preferenceState", domain.sunscreen.preferenceState, ["answered", "skipped", "unknown"]);
    for (const key of ["whiteCastHate", "toneUpWanted", "makeupUse", "eyeSensitive"]) {
      if (typeof domain.sunscreen[key] !== "boolean") errors.push({ code: "INVALID_DOMAIN_TYPE", field: `sunscreen.${key}` });
    }
  }
  if (domain.profile && typeof domain.profile === "object") {
    validateEnum(errors, "profile.genderPreference", domain.profile.genderPreference, GENDER_PREFERENCES);
  }
  if (domain.routeExtensions && typeof domain.routeExtensions === "object") {
    if (typeof domain.routeExtensions.verySensitivePeriod !== "boolean") {
      errors.push({ code: "INVALID_DOMAIN_TYPE", field: "routeExtensions.verySensitivePeriod" });
    }
  }

  return errors;
}

export function validateMaterializedPersona(persona) {
  const errors = validateDomainPersona(persona?.domain);
  if (!persona?.persona_id) errors.push({ code: "MISSING_PERSONA_ID", field: "persona_id" });
  if (!["COVERAGE_COHORT", "ADVERSARIAL_COHORT"].includes(persona?.cohort_type)) {
    errors.push({ code: "INVALID_P3_COHORT_TYPE", field: "cohort_type" });
  }
  if (persona?.population !== null) errors.push({ code: "POPULATION_PRIOR_NOT_AUTHORIZED", field: "population" });
  if (persona?.materialization_version !== EVAL_P3_CONTRACTS.cohortMaterializationVersion) {
    errors.push({ code: "MATERIALIZATION_VERSION_MISMATCH", field: "materialization_version" });
  }
  if (!Array.isArray(persona?.attribute_provenance) || persona.attribute_provenance.length === 0) {
    errors.push({ code: "ATTRIBUTE_PROVENANCE_MISSING", field: "attribute_provenance" });
  }
  return errors;
}

export function buildP3NegativeFixtures() {
  const baseline = createCoverageDomain(0);
  const mutate = (id, expectedCode, fn) => {
    const domain = deepClone(baseline);
    fn(domain);
    return { fixture_id: id, expected_code: expectedCode, domain };
  };

  return [
    mutate("P3-N01", "GAP-DOMAIN-004_UNSUPPORTED_SCORER_VALUE", (domain) => { domain.skinType = "sensitive"; }),
    mutate("P3-N02", "GAP-DOMAIN-004_UNSUPPORTED_SCORER_VALUE", (domain) => { domain.mostDislikedFeel = "drying"; }),
    mutate("P3-N03", "GAP-DOMAIN-003_NON_PUBLIC_SCORER_INPUT", (domain) => { domain.sunscreenIntent = true; }),
    mutate("P3-N04", "GAP-DOMAIN-003_NON_PUBLIC_SCORER_INPUT", (domain) => { domain.explicitCategoryIntent = "sunscreen"; }),
    mutate("P3-N05", "INVALID_DOMAIN_ENUM", (domain) => { domain.sunscreen.preferenceState = "implicit"; }),
    mutate("P3-N06", "MISSING_REQUIRED_DOMAIN_FIELD", (domain) => { delete domain.primaryConcern; }),
    mutate("P3-N07", "INVALID_DOMAIN_ENUM", (domain) => { domain.environmentExposure = ["office"]; }),
    mutate("P3-N08", "INVALID_DOMAIN_ENUM", (domain) => { domain.preferredTexture = "balm"; })
  ];
}

export function toRecommendationAnswers(domain) {
  const mainConcerns = [domain.primaryConcern, domain.secondaryConcern].filter(Boolean).slice(0, 2);
  return {
    skinType: domain.skinType,
    sensitivity: domain.sensitivity,
    mainConcern: domain.primaryConcern,
    mainConcerns,
    primaryConcern: domain.primaryConcern,
    recentSkinChange: domain.recentSkinChange,
    recentlyChangedProduct: domain.recentlyChangedProduct,
    cleansingFrequency: domain.cleansingFrequency,
    preferredTexture: domain.preferredTexture,
    postWashFeeling: domain.postWashFeeling,
    afternoonSkinChange: domain.afternoonSkinChange,
    environmentExposure: deepClone(domain.environmentExposure),
    mostDislikedFeel: domain.mostDislikedFeel,
    genderPreference: domain.profile.genderPreference,
    whiteCastHate: domain.sunscreen.whiteCastHate,
    toneUpWanted: domain.sunscreen.toneUpWanted,
    makeupUse: domain.sunscreen.makeupUse,
    eyeSensitive: domain.sunscreen.eyeSensitive,
    sunscreenPreferenceState: domain.sunscreen.preferenceState,
    outdoorExposure: domain.environmentExposure.includes("outdoor"),
    verySensitivePeriod: domain.routeExtensions.verySensitivePeriod
  };
}

function parseBooleanField(value) {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return null;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function parseJsonArrayField(value) {
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeGenderPreference(value) {
  return GENDER_PREFERENCES.includes(value) ? value : "unspecified";
}

export function buildRouteLikePayload(domain, { explicitOutdoorExposure = false } = {}) {
  const payload = {
    skinType: domain.skinType,
    sensitivityLevel: domain.sensitivity,
    mainConcern: domain.primaryConcern,
    mainConcerns: JSON.stringify([domain.primaryConcern, domain.secondaryConcern].filter(Boolean).slice(0, 2)),
    primaryConcern: domain.primaryConcern,
    recentSkinChange: domain.recentSkinChange,
    recentlyChangedProduct: domain.recentlyChangedProduct,
    cleansingFrequency: domain.cleansingFrequency,
    texturePreference: domain.preferredTexture,
    postCleanseFeel: domain.postWashFeeling,
    afternoonState: domain.afternoonSkinChange,
    environmentExposure: JSON.stringify(domain.environmentExposure),
    dislikedFeel: domain.mostDislikedFeel,
    genderPreference: domain.profile.genderPreference,
    whiteCastHate: String(domain.sunscreen.whiteCastHate),
    toneUpWanted: String(domain.sunscreen.toneUpWanted),
    makeupUse: String(domain.sunscreen.makeupUse),
    eyeSensitive: String(domain.sunscreen.eyeSensitive),
    sunscreenPreferenceState: domain.sunscreen.preferenceState,
    verySensitivePeriod: String(domain.routeExtensions.verySensitivePeriod)
  };
  if (explicitOutdoorExposure) {
    payload.outdoorExposure = String(domain.environmentExposure.includes("outdoor"));
  }
  return payload;
}

export function materializeRouteRecommendationInput(payload) {
  const skinType = payload.skinType;
  const sensitivity = payload.sensitivityLevel || payload.sensitivity;
  const mainConcern = payload.mainConcern;
  const mainConcerns = parseJsonArrayField(payload.mainConcerns);
  const primaryConcern = payload.primaryConcern;
  const recentSkinChange = payload.recentSkinChange;
  const recentlyChangedProduct = payload.recentlyChangedProduct;
  const cleansingFrequency = payload.cleansingFrequency;
  const preferredTexture = payload.texturePreference || payload.preferredTexture;
  const postWashFeeling = payload.postCleanseFeel || payload.postWashFeeling;
  const afternoonSkinChange = payload.afternoonState || payload.afternoonSkinChange;
  const environmentExposure = parseJsonArrayField(payload.environmentExposure);
  const mostDislikedFeel = payload.dislikedFeel || payload.mostDislikedFeel;
  const genderPreference = normalizeGenderPreference(payload.genderPreference);
  const whiteCastHate = parseBooleanField(payload.whiteCastHate);
  const toneUpWanted = parseBooleanField(payload.toneUpWanted);
  const makeupUse = parseBooleanField(payload.makeupUse);
  const eyeSensitive = parseBooleanField(payload.eyeSensitive);
  const sunscreenPreferenceState = payload.sunscreenPreferenceState;
  const outdoorExposure = parseBooleanField(payload.outdoorExposure);
  const verySensitivePeriod = parseBooleanField(payload.verySensitivePeriod);
  const resolvedMainConcern = (typeof mainConcern === "string" && mainConcern) || mainConcerns[0] || "";

  return {
    skinType,
    sensitivity,
    mainConcern: resolvedMainConcern,
    mainConcerns: mainConcerns.length ? mainConcerns : undefined,
    primaryConcern,
    recentSkinChange,
    recentlyChangedProduct,
    cleansingFrequency,
    preferredTexture,
    postWashFeeling,
    afternoonSkinChange,
    environmentExposure,
    mostDislikedFeel,
    genderPreference,
    whiteCastHate: Boolean(whiteCastHate),
    toneUpWanted: Boolean(toneUpWanted),
    makeupUse: Boolean(makeupUse),
    eyeSensitive: Boolean(eyeSensitive),
    sunscreenPreferenceState,
    outdoorExposure: typeof outdoorExposure === "boolean" ? outdoorExposure : environmentExposure.includes("outdoor"),
    verySensitivePeriod: Boolean(verySensitivePeriod)
  };
}

export function buildContractGapObservations(personas, negativeFixtures) {
  const preferenceAmbiguity = personas
    .filter((persona) => persona.domain.sunscreen.preferenceState !== "answered")
    .map((persona) => persona.persona_id);
  const routeOnlySensitivePeriod = personas
    .filter((persona) => Object.prototype.hasOwnProperty.call(persona.domain.routeExtensions, "verySensitivePeriod"))
    .map((persona) => persona.persona_id);
  const gap003 = negativeFixtures
    .filter((fixture) => fixture.expected_code === "GAP-DOMAIN-003_NON_PUBLIC_SCORER_INPUT")
    .map((fixture) => fixture.fixture_id);
  const gap004 = negativeFixtures
    .filter((fixture) => fixture.expected_code === "GAP-DOMAIN-004_UNSUPPORTED_SCORER_VALUE")
    .map((fixture) => fixture.fixture_id);

  return [
    {
      gap_id: "GAP-DOMAIN-001",
      classification: "SURVEY_COMPLETENESS_NOT_CONSUMED_BY_RECOMMENDATION_NORMALIZER",
      authority: "DIAGNOSTIC_ONLY",
      affected_fixture_ids: preferenceAmbiguity
    },
    {
      gap_id: "GAP-DOMAIN-002",
      classification: "CURRENT_ROUTE_INPUT_OUTSIDE_SURVEY_CONTRACT",
      authority: "DIAGNOSTIC_ONLY",
      affected_fixture_ids: routeOnlySensitivePeriod
    },
    {
      gap_id: "GAP-DOMAIN-003",
      classification: "DOMAIN_CORE_DIAGNOSTIC_ONLY_NOT_PUBLIC_CONTRACT_INPUT",
      authority: "DIAGNOSTIC_ONLY",
      affected_fixture_ids: gap003
    },
    {
      gap_id: "GAP-DOMAIN-004",
      classification: "LEGACY_OR_INTERNAL_SCORER_VALUE_UNSUPPORTED_FOR_PERSONA_V1",
      authority: "DIAGNOSTIC_ONLY",
      affected_fixture_ids: gap004
    }
  ];
}

export function canonicalizeSemantic(value, path = []) {
  if (Array.isArray(value)) {
    const items = value.map((item, index) => canonicalizeSemantic(item, [...path, String(index)]));
    const key = path[path.length - 1] || "";
    if (SET_LIKE_ARRAY_KEYS.has(key)) {
      return items.slice().sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right), "en"));
    }
    return items;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort((left, right) => left.localeCompare(right, "en"))
        .map((key) => [key, canonicalizeSemantic(value[key], [...path, key])])
    );
  }
  return value;
}

export function semanticHash(value) {
  return createHash("sha256").update(JSON.stringify(canonicalizeSemantic(value))).digest("hex");
}
