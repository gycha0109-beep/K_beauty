export const GENERATION_SPEC_SCHEMA_VERSION = "generation-spec-v1";
export const FACE_FEATURE_INTENT_SCHEMA_VERSION = "face-feature-intent-v1";
export const FACE_FEATURE_CUE_PROFILE_VERSION = "face-feature-cues-v1";
export const ARCHETYPE_STRESS_FEATURE_CUE_PROFILE_VERSION = "face-feature-cues-v2";
export const ARCHETYPE_STRESS_TAXONOMY_VERSION = "face-lab-archetype-taxonomy-v1";
export const EXCLUSION_POLICY_VERSION = "reference-portrait-exclusions-v1";

export const GENERATION_PURPOSES = Object.freeze([
  "capture_control",
  "skin_cue_control",
  "face_feature_control",
  "archetype_stress",
  "paired_skin_edit",
  "mixed_control_pilot"
]);

const FACE_FEATURE_CUE_REGISTRY_V1 = Object.freeze({
  eyeDirection: Object.freeze(["upturned", "level", "downturned"]),
  eyeOpenness: Object.freeze(["narrow", "medium", "wide"]),
  faceLengthBalance: Object.freeze(["short", "balanced", "long"]),
  jawlineAngularity: Object.freeze(["soft", "moderate", "angular"]),
  straightCurveBalance: Object.freeze(["curved", "balanced", "straight"]),
  featureContrast: Object.freeze(["low", "medium", "high"])
});

export const ARCHETYPE_STRESS_FEATURE_CUE_REGISTRY = Object.freeze({
  faceShape: Object.freeze(["oval", "round", "square", "oblong", "heart", "diamond", "triangle", "mixed"]),
  jawlineAngularity: Object.freeze(["soft", "moderate", "angular"]),
  jawTaper: Object.freeze(["tapered", "balanced", "broad"]),
  cheekboneProminence: Object.freeze(["subtle", "moderate", "prominent"]),
  faceLengthBalance: Object.freeze(["short", "balanced", "long"]),
  eyeDirection: Object.freeze(["upturned", "level", "downturned", "mixed"]),
  eyeLength: Object.freeze(["short", "medium", "long"]),
  eyeOpenness: Object.freeze(["narrow", "medium", "wide"]),
  featureScale: Object.freeze(["small", "medium", "large", "mixed"]),
  featureConcentration: Object.freeze(["spread", "balanced", "centered"]),
  straightCurveBalance: Object.freeze(["curved", "balanced", "straight"]),
  contourDefinition: Object.freeze(["soft", "moderate", "defined"]),
  featureContrast: Object.freeze(["low", "medium", "high"])
});

export const FACE_FEATURE_CUE_REGISTRY = FACE_FEATURE_CUE_REGISTRY_V1;
export const FACE_FEATURE_CUE_REGISTRIES = Object.freeze({
  [FACE_FEATURE_CUE_PROFILE_VERSION]: FACE_FEATURE_CUE_REGISTRY_V1,
  [ARCHETYPE_STRESS_FEATURE_CUE_PROFILE_VERSION]: ARCHETYPE_STRESS_FEATURE_CUE_REGISTRY
});

export const FACE_FEATURE_CUE_STRENGTHS = Object.freeze(["subtle", "moderate"]);

export const ARCHETYPE_STRESS_ARCHETYPE_KEYS = Object.freeze([
  "wolf",
  "cat",
  "puppy",
  "deer",
  "tofu",
  "potato",
  "dino"
]);

export const ENABLED_ARCHETYPE_TAXONOMIES = Object.freeze({
  [ARCHETYPE_STRESS_TAXONOMY_VERSION]: ARCHETYPE_STRESS_ARCHETYPE_KEYS
});

export const GENERATION_VALIDATION_ERROR_CODES = Object.freeze([
  "invalid_spec_shape",
  "invalid_spec_version",
  "unsupported_generation_purpose",
  "adult_age_required",
  "single_synthetic_person_required",
  "invalid_capture_contract",
  "invalid_appearance_contract",
  "unapproved_feature_cue",
  "archetype_taxonomy_unavailable",
  "archetype_weight_invalid",
  "conflicting_skin_targets",
  "reference_candidate_required",
  "invalid_variation_contract",
  "unsafe_exclusion_override",
  "non_deterministic_value",
  "sensitive_provenance_forbidden",
  "unsupported_target_axis"
]);

const REQUIRED_CAPTURE = Object.freeze({
  mediaStyle: "realistic_documentary_reference",
  pose: "direct_frontal",
  gaze: "camera",
  expression: "neutral",
  framing: "head_and_shoulders",
  headVisibility: "full_head_neck_upper_shoulders",
  background: "plain_light_gray",
  lighting: "soft_even_diffuse",
  whiteBalance: "natural",
  focus: "sharp_face",
  aspectRatio: "1:1",
  width: 1024,
  height: 1024
});

const REQUIRED_APPEARANCE = Object.freeze({
  hairColor: "dark_brown_black",
  hairStyle: "tied_back",
  hairFaceClearance: "away_from_forehead_and_cheeks",
  clothing: "plain_crew_neck_top",
  glasses: false,
  jewelry: false,
  visibleAccessories: false,
  visibleMakeup: "none"
});

const TOP_LEVEL_KEYS = Object.freeze([
  "schemaVersion",
  "purpose",
  "subject",
  "capture",
  "appearance",
  "featureIntent",
  "archetypeIntent",
  "skinIntent",
  "variation",
  "exclusionPolicyVersion",
  "provenance"
]);

const SUBJECT_KEYS = Object.freeze([
  "syntheticPersonOnly",
  "adultAgeBand",
  "presentation",
  "regionalAppearanceHint",
  "personCount"
]);

const SKIN_KEYS = Object.freeze([
  "baselineTexture",
  "redness",
  "blemishes",
  "oiliness",
  "dryness"
]);

const REDNESS_REGIONS = Object.freeze(["left_cheek", "right_cheek", "sides_of_nose"]);
const BLEMISH_REGIONS = Object.freeze(["left_cheek", "right_cheek", "chin"]);
const REFERENCE_PRESERVE = Object.freeze([
  "identity",
  "framing",
  "pose",
  "gaze",
  "expression",
  "hair",
  "clothing",
  "background",
  "lighting"
]);

const SAFE_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const SAFE_VERSION_PATTERN = /^[a-z0-9][a-z0-9._-]{0,31}$/;
const SENSITIVE_TEXT_PATTERN = /(?:https?:\/\/|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\b(?:api[_ -]?key|secret|token|cookie|authorization|bearer)\b|\bsk-[A-Za-z0-9_-]{8,}|\beyJ[A-Za-z0-9_-]{8,})/i;

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value, expected) {
  if (!isPlainObject(value)) {
    return false;
  }
  const actual = Object.keys(value).sort();
  const target = [...expected].sort();
  return actual.length === target.length && actual.every((item, index) => item === target[index]);
}

function sameScalarContract(value, required) {
  return exactKeys(value, Object.keys(required)) && Object.entries(required).every(([key, expected]) => value[key] === expected);
}

function addError(errors, code, path) {
  errors.push(Object.freeze({ code, path }));
}

function isEnum(value, allowed) {
  return allowed.includes(value);
}

function isUniqueEnumArray(value, allowed) {
  return Array.isArray(value) &&
    value.every((item) => allowed.includes(item)) &&
    new Set(value).size === value.length;
}

function validateSubject(value, errors) {
  if (!exactKeys(value, SUBJECT_KEYS)) {
    addError(errors, "invalid_spec_shape", "subject");
    return;
  }
  if (value.syntheticPersonOnly !== true || !isEnum(value.adultAgeBand, ["20s", "30s", "40s", "50s"])) {
    addError(errors, "adult_age_required", "subject.adultAgeBand");
  }
  if (value.personCount !== 1) {
    addError(errors, "single_synthetic_person_required", "subject.personCount");
  }
  if (!isEnum(value.presentation, ["feminine", "masculine", "androgynous"])) {
    addError(errors, "invalid_spec_shape", "subject.presentation");
  }
  if (value.regionalAppearanceHint !== null && value.regionalAppearanceHint !== "korean_appearance_hint") {
    addError(errors, "invalid_spec_shape", "subject.regionalAppearanceHint");
  }
}

function validateFeatureIntent(value, errors) {
  if (value === null) {
    return;
  }
  if (!exactKeys(value, ["schemaVersion", "cueProfileVersion", "cues"])) {
    addError(errors, "invalid_spec_shape", "featureIntent");
    return;
  }
  const cueRegistry = FACE_FEATURE_CUE_REGISTRIES[value.cueProfileVersion];
  if (value.schemaVersion !== FACE_FEATURE_INTENT_SCHEMA_VERSION || !cueRegistry) {
    addError(errors, "unapproved_feature_cue", "featureIntent.cueProfileVersion");
  }
  if (!isPlainObject(value.cues)) {
    addError(errors, "unapproved_feature_cue", "featureIntent.cues");
    return;
  }
  const entries = Object.entries(value.cues);
  if (entries.length < 1 || entries.length > 4) {
    addError(errors, "unapproved_feature_cue", "featureIntent.cues");
  }
  for (const [axis, cue] of entries) {
    const allowed = cueRegistry?.[axis];
    if (!allowed || !exactKeys(cue, ["value", "strength"]) || !allowed.includes(cue.value) || !FACE_FEATURE_CUE_STRENGTHS.includes(cue.strength)) {
      addError(errors, "unapproved_feature_cue", `featureIntent.cues.${axis}`);
    }
  }
}

function validateArchetypeIntent(value, errors) {
  if (value === null) {
    return;
  }
  if (!exactKeys(value, ["taxonomyVersion", "primary", "secondary", "intendedWeightsBps", "compilationMode"])) {
    addError(errors, "invalid_spec_shape", "archetypeIntent");
    return;
  }
  const taxonomy = ENABLED_ARCHETYPE_TAXONOMIES[value.taxonomyVersion];
  if (!taxonomy) {
    addError(errors, "archetype_taxonomy_unavailable", "archetypeIntent.taxonomyVersion");
    return;
  }
  if (value.compilationMode !== "metadata_only") {
    addError(errors, "invalid_spec_shape", "archetypeIntent.compilationMode");
  }
  const primaryValid = typeof value.primary === "string" && taxonomy.includes(value.primary);
  const secondaryValid = value.secondary === null || (typeof value.secondary === "string" && taxonomy.includes(value.secondary));
  if (!primaryValid || !secondaryValid || value.primary === value.secondary) {
    addError(errors, "archetype_taxonomy_unavailable", "archetypeIntent.primary");
  }
  const declared = [value.primary, value.secondary].filter(Boolean);
  if (!isPlainObject(value.intendedWeightsBps)) {
    addError(errors, "archetype_weight_invalid", "archetypeIntent.intendedWeightsBps");
    return;
  }
  const weightKeys = Object.keys(value.intendedWeightsBps).sort();
  const declaredKeys = [...declared].sort();
  const values = Object.values(value.intendedWeightsBps);
  if (
    weightKeys.length !== declaredKeys.length ||
    !weightKeys.every((key, index) => key === declaredKeys[index]) ||
    !values.every((weight) => Number.isInteger(weight) && weight > 0 && weight <= 10000) ||
    values.reduce((sum, weight) => sum + weight, 0) !== 10000
  ) {
    addError(errors, "archetype_weight_invalid", "archetypeIntent.intendedWeightsBps");
  }
}

function validateSkinIntent(value, errors) {
  if (!exactKeys(value, SKIN_KEYS)) {
    addError(errors, "invalid_spec_shape", "skinIntent");
    return;
  }
  if (value.baselineTexture !== "natural_visible_pores" || value.oiliness !== "not_targeted" || value.dryness !== "not_targeted") {
    addError(errors, "unsupported_target_axis", "skinIntent");
  }

  const redness = value.redness;
  if (!exactKeys(redness, ["severity", "regions", "pattern"]) || !isEnum(redness.severity, ["none", "mild"]) || !isEnum(redness.pattern, ["none", "diffuse"]) || !isUniqueEnumArray(redness.regions, REDNESS_REGIONS)) {
    addError(errors, "conflicting_skin_targets", "skinIntent.redness");
  } else {
    const none = redness.severity === "none" && redness.pattern === "none" && redness.regions.length === 0;
    const mild = redness.severity === "mild" && redness.pattern === "diffuse" && redness.regions.length > 0;
    if (!none && !mild) {
      addError(errors, "conflicting_skin_targets", "skinIntent.redness");
    }
  }

  const blemishes = value.blemishes;
  if (!exactKeys(blemishes, ["severity", "regions", "countBand", "pattern"]) || !isEnum(blemishes.severity, ["none", "mild"]) || !isEnum(blemishes.countBand, ["none", "three_to_five"]) || !isEnum(blemishes.pattern, ["none", "discrete"]) || !isUniqueEnumArray(blemishes.regions, BLEMISH_REGIONS)) {
    addError(errors, "conflicting_skin_targets", "skinIntent.blemishes");
  } else {
    const none = blemishes.severity === "none" && blemishes.countBand === "none" && blemishes.pattern === "none" && blemishes.regions.length === 0;
    const mild = blemishes.severity === "mild" && blemishes.countBand === "three_to_five" && blemishes.pattern === "discrete" && blemishes.regions.length > 0;
    if (!none && !mild) {
      addError(errors, "conflicting_skin_targets", "skinIntent.blemishes");
    }
  }
}

function validateVariation(value, errors) {
  if (!exactKeys(value, ["pairingMode", "referenceCandidateId", "mutationScope", "preserve"])) {
    addError(errors, "invalid_spec_shape", "variation");
    return;
  }
  if (value.pairingMode === "independent") {
    if (value.referenceCandidateId !== null || value.mutationScope !== "full_generation" || !Array.isArray(value.preserve) || value.preserve.length !== 0) {
      addError(errors, "invalid_variation_contract", "variation");
    }
    return;
  }
  if (value.pairingMode === "reference_edit") {
    if (typeof value.referenceCandidateId !== "string" || !SAFE_ID_PATTERN.test(value.referenceCandidateId)) {
      addError(errors, "reference_candidate_required", "variation.referenceCandidateId");
    }
    if (value.mutationScope !== "skin_only" || !Array.isArray(value.preserve) || value.preserve.length !== REFERENCE_PRESERVE.length || !REFERENCE_PRESERVE.every((token, index) => value.preserve[index] === token)) {
      addError(errors, "invalid_variation_contract", "variation.preserve");
    }
    return;
  }
  addError(errors, "invalid_variation_contract", "variation.pairingMode");
}

function validateProvenance(value, errors) {
  if (!exactKeys(value, ["campaignId", "authoredBy", "sourceTemplateId", "sourceTemplateVersion", "createdAt", "notes"])) {
    addError(errors, "invalid_spec_shape", "provenance");
    return;
  }
  const validIds = SAFE_ID_PATTERN.test(value.campaignId || "") && SAFE_ID_PATTERN.test(value.sourceTemplateId || "") && SAFE_VERSION_PATTERN.test(value.sourceTemplateVersion || "");
  const validAuthor = isEnum(value.authoredBy, ["campaign_planner", "human_operator"]);
  const validDate = typeof value.createdAt === "string" && Number.isFinite(Date.parse(value.createdAt)) && new Date(value.createdAt).toISOString() === value.createdAt;
  const validNotes = value.notes === null || (typeof value.notes === "string" && value.notes.length <= 500 && !SENSITIVE_TEXT_PATTERN.test(value.notes));
  if (!validIds || !validAuthor || !validDate || !validNotes || SENSITIVE_TEXT_PATTERN.test(String(value.campaignId)) || SENSITIVE_TEXT_PATTERN.test(String(value.sourceTemplateId))) {
    addError(errors, "sensitive_provenance_forbidden", "provenance");
  }
}

function skinCuePresence(skinIntent) {
  return Boolean(skinIntent && (skinIntent.redness?.severity === "mild" || skinIntent.blemishes?.severity === "mild"));
}

function validatePurposeCompatibility(spec, errors) {
  const hasFeature = spec.featureIntent !== null;
  const hasArchetype = spec.archetypeIntent !== null;
  const hasSkinCue = skinCuePresence(spec.skinIntent);
  const mode = spec.variation?.pairingMode;

  if (spec.purpose !== "archetype_stress" && hasArchetype) {
    addError(errors, "unsupported_target_axis", "archetypeIntent");
  }
  if (spec.purpose === "capture_control" && (hasFeature || hasSkinCue || mode !== "independent")) {
    addError(errors, "unsupported_target_axis", "purpose");
  }
  if (spec.purpose === "skin_cue_control" && (hasFeature || mode !== "independent")) {
    addError(errors, "unsupported_target_axis", "purpose");
  }
  if (spec.purpose === "face_feature_control" && (!hasFeature || hasSkinCue || mode !== "independent")) {
    addError(errors, "unsupported_target_axis", "purpose");
  }
  if (
    spec.purpose === "archetype_stress" && (
      !hasFeature ||
      !hasArchetype ||
      hasSkinCue ||
      mode !== "independent" ||
      spec.featureIntent?.cueProfileVersion !== ARCHETYPE_STRESS_FEATURE_CUE_PROFILE_VERSION
    )
  ) {
    addError(errors, "unsupported_target_axis", "purpose");
  }
  if (spec.purpose === "paired_skin_edit" && (hasFeature || !hasSkinCue || mode !== "reference_edit")) {
    addError(errors, "unsupported_target_axis", "purpose");
  }
  if (spec.purpose === "mixed_control_pilot" && (!hasFeature || !hasSkinCue || mode !== "independent")) {
    addError(errors, "unsupported_target_axis", "purpose");
  }
}

export function validateDraftGenerationSpec(spec) {
  const errors = [];
  if (!exactKeys(spec, TOP_LEVEL_KEYS)) {
    addError(errors, "invalid_spec_shape", "$root");
    return Object.freeze({ ok: false, errors: Object.freeze(errors) });
  }
  if (spec.schemaVersion !== GENERATION_SPEC_SCHEMA_VERSION) {
    addError(errors, "invalid_spec_version", "schemaVersion");
  }
  if (!GENERATION_PURPOSES.includes(spec.purpose)) {
    addError(errors, "unsupported_generation_purpose", "purpose");
  }

  validateSubject(spec.subject, errors);
  if (!sameScalarContract(spec.capture, REQUIRED_CAPTURE)) {
    addError(errors, "invalid_capture_contract", "capture");
  }
  if (!sameScalarContract(spec.appearance, REQUIRED_APPEARANCE)) {
    addError(errors, "invalid_appearance_contract", "appearance");
  }
  validateFeatureIntent(spec.featureIntent, errors);
  validateArchetypeIntent(spec.archetypeIntent, errors);
  validateSkinIntent(spec.skinIntent, errors);
  validateVariation(spec.variation, errors);
  if (spec.exclusionPolicyVersion !== EXCLUSION_POLICY_VERSION) {
    addError(errors, "unsafe_exclusion_override", "exclusionPolicyVersion");
  }
  validateProvenance(spec.provenance, errors);

  if (GENERATION_PURPOSES.includes(spec.purpose)) {
    validatePurposeCompatibility(spec, errors);
  }

  return errors.length
    ? Object.freeze({ ok: false, errors: Object.freeze(errors) })
    : Object.freeze({ ok: true, errors: Object.freeze([]) });
}

export function isDraftGenerationSpec(value) {
  return validateDraftGenerationSpec(value).ok;
}

export const GENERATION_REFERENCE_PRESERVE_ORDER = REFERENCE_PRESERVE;
export const GENERATION_REDNESS_REGION_ORDER = REDNESS_REGIONS;
export const GENERATION_BLEMISH_REGION_ORDER = BLEMISH_REGIONS;
