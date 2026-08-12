import { FACE_LAB_OBSERVATION_DEFINITIONS } from "./face-lab-observation-contract.js";

export const FACE_LAB_ARCHETYPE_REGISTRY_SCHEMA_VERSION = "face-lab-archetype-registry-v1";
export const FACE_LAB_ARCHETYPE_REGISTRY_VERSION = "face-lab-archetype-rubric-20260727";

export const FACE_LAB_ARCHETYPE_LIFECYCLE = Object.freeze([
  "proposed",
  "rubric_ready",
  "pilot",
  "validated",
  "active",
  "paused",
  "retired"
]);

const ARCHETYPE_KEYS = Object.freeze([
  "wolf",
  "cat",
  "puppy",
  "deer",
  "tofu",
  "potato",
  "dino"
]);

const INDICATOR_POLARITIES = new Set([1, -1]);
const LIFECYCLE_VALUES = new Set(FACE_LAB_ARCHETYPE_LIFECYCLE);
const REGISTRY_CALIBRATION_VALUES = new Set(["not_ready", "ready"]);
const ARCHETYPE_CALIBRATION_VALUES = new Set(["unvalidated", "validated"]);
const ARCHETYPE_KEY_VALUES = new Set(ARCHETYPE_KEYS);

function indicator(path, expectedValues, options = {}) {
  return Object.freeze({
    path,
    expectedValues: Object.freeze([...expectedValues]),
    polarity: options.polarity === -1 ? -1 : 1,
    weight: options.weight ?? 1,
    required: options.required === true,
    evidenceRequired: true
  });
}

function archetype(key, labelKo, indicators) {
  return Object.freeze({
    key,
    label: Object.freeze({ ko: labelKo, en: key }),
    lifecycle: "rubric_ready",
    calibrationStatus: "unvalidated",
    indicators: Object.freeze(indicators)
  });
}

export const FACE_LAB_ARCHETYPE_REGISTRY = Object.freeze({
  schemaVersion: FACE_LAB_ARCHETYPE_REGISTRY_SCHEMA_VERSION,
  registryVersion: FACE_LAB_ARCHETYPE_REGISTRY_VERSION,
  lifecycle: "rubric_ready",
  calibrationStatus: "not_ready",
  decisionPolicy: Object.freeze({
    minimumEvidenceCoverage: null,
    minimumTopScore: null,
    minimumTopMargin: null,
    maximumContradictions: null
  }),
  archetypes: Object.freeze([
    archetype("wolf", "늑대상", [
      indicator("observations.eyes.eyeLength", ["long"], { weight: 1, required: true }),
      indicator("observations.eyes.eyeDirection", ["upturned", "level"], { weight: 0.75 }),
      indicator("observations.visualLanguage.straightCurveBalance", ["straight"], { weight: 1, required: true }),
      indicator("observations.visualLanguage.contourDefinition", ["defined"], { weight: 0.75 }),
      indicator("observations.vertical.faceLengthBalance", ["long"], { weight: 0.75 }),
      indicator("observations.visualLanguage.straightCurveBalance", ["curved"], { polarity: -1, weight: 0.75 })
    ]),
    archetype("cat", "고양이상", [
      indicator("observations.eyes.eyeDirection", ["upturned"], { weight: 1, required: true }),
      indicator("observations.eyes.eyeLength", ["long"], { weight: 0.75 }),
      indicator("observations.featureLayout.featureConcentration", ["centered"], { weight: 1, required: true }),
      indicator("observations.visualLanguage.featureContrast", ["medium", "high"], { weight: 0.75 }),
      indicator("observations.visualLanguage.straightCurveBalance", ["balanced", "straight"], { weight: 0.5 }),
      indicator("observations.featureLayout.featureConcentration", ["spread"], { polarity: -1, weight: 0.75 })
    ]),
    archetype("puppy", "강아지상", [
      indicator("observations.eyes.eyeOpenness", ["medium", "wide"], { weight: 0.75, required: true }),
      indicator("observations.eyes.eyeDirection", ["level", "downturned"], { weight: 0.75 }),
      indicator("observations.visualLanguage.straightCurveBalance", ["curved"], { weight: 1, required: true }),
      indicator("observations.visualLanguage.contourDefinition", ["soft"], { weight: 1 }),
      indicator("observations.visualLanguage.featureContrast", ["low", "medium"], { weight: 0.5 }),
      indicator("observations.outline.jawlineAngularity", ["angular"], { polarity: -1, weight: 0.75 })
    ]),
    archetype("deer", "사슴상", [
      indicator("observations.vertical.faceLengthBalance", ["long"], { weight: 1, required: true }),
      indicator("observations.eyes.eyeOpenness", ["wide"], { weight: 1, required: true }),
      indicator("observations.outline.jawTaper", ["tapered"], { weight: 0.75 }),
      indicator("observations.visualLanguage.contourDefinition", ["soft", "moderate"], { weight: 0.5 }),
      indicator("observations.visualLanguage.featureContrast", ["low", "medium"], { weight: 0.5 }),
      indicator("observations.outline.jawlineAngularity", ["angular"], { polarity: -1, weight: 0.75 })
    ]),
    archetype("tofu", "두부상", [
      indicator("observations.visualLanguage.featureContrast", ["low"], { weight: 1, required: true }),
      indicator("observations.visualLanguage.contourDefinition", ["soft"], { weight: 1, required: true }),
      indicator("observations.visualLanguage.straightCurveBalance", ["curved", "balanced"], { weight: 0.75 }),
      indicator("observations.outline.jawlineAngularity", ["soft"], { weight: 0.75 }),
      indicator("observations.featureLayout.featureConcentration", ["balanced"], { weight: 0.5 }),
      indicator("observations.visualLanguage.featureContrast", ["high"], { polarity: -1, weight: 1 })
    ]),
    archetype("potato", "감자상", [
      indicator("observations.vertical.faceLengthBalance", ["short"], { weight: 1, required: true }),
      indicator("observations.outline.faceShape", ["round", "mixed"], { weight: 1, required: true }),
      indicator("observations.visualLanguage.straightCurveBalance", ["curved"], { weight: 0.75 }),
      indicator("observations.featureLayout.featureConcentration", ["centered"], { weight: 0.75 }),
      indicator("observations.outline.jawTaper", ["balanced", "broad"], { weight: 0.5 }),
      indicator("observations.vertical.faceLengthBalance", ["long"], { polarity: -1, weight: 1 })
    ]),
    archetype("dino", "공룡상", [
      indicator("observations.featureLayout.featureScale", ["large", "mixed"], { weight: 1, required: true }),
      indicator("observations.outline.jawlineAngularity", ["angular"], { weight: 1, required: true }),
      indicator("observations.outline.cheekboneProminence", ["prominent"], { weight: 0.75 }),
      indicator("observations.visualLanguage.straightCurveBalance", ["straight"], { weight: 0.75 }),
      indicator("observations.visualLanguage.contourDefinition", ["defined"], { weight: 0.75 }),
      indicator("observations.featureLayout.featureScale", ["small"], { polarity: -1, weight: 1 })
    ])
  ])
});

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function resolveAllowedValues(path) {
  const parts = typeof path === "string" ? path.split(".") : [];
  if (parts.length !== 3 || parts[0] !== "observations") {
    return null;
  }
  const values = FACE_LAB_OBSERVATION_DEFINITIONS?.[parts[1]]?.[parts[2]];
  return Array.isArray(values) ? new Set(values) : null;
}

export function validateFaceLabArchetypeRegistry(registry) {
  const errors = [];

  if (!isPlainObject(registry)) {
    return { ok: false, errors: ["registry_invalid"] };
  }
  if (registry.schemaVersion !== FACE_LAB_ARCHETYPE_REGISTRY_SCHEMA_VERSION) {
    errors.push("schema_version_invalid");
  }
  if (typeof registry.registryVersion !== "string" || !registry.registryVersion.trim()) {
    errors.push("registry_version_invalid");
  }
  if (!LIFECYCLE_VALUES.has(registry.lifecycle)) {
    errors.push("registry_lifecycle_invalid");
  }
  if (!REGISTRY_CALIBRATION_VALUES.has(registry.calibrationStatus)) {
    errors.push("registry_calibration_status_invalid");
  }
  if (!Array.isArray(registry.archetypes) || registry.archetypes.length === 0) {
    errors.push("archetypes_missing");
  }

  const keys = new Set();
  for (const item of registry.archetypes || []) {
    if (!isPlainObject(item) || !ARCHETYPE_KEY_VALUES.has(item.key) || keys.has(item.key)) {
      errors.push("archetype_key_invalid");
      continue;
    }
    keys.add(item.key);
    if (!LIFECYCLE_VALUES.has(item.lifecycle)) {
      errors.push(`${item.key}:lifecycle_invalid`);
    }
    if (!ARCHETYPE_CALIBRATION_VALUES.has(item.calibrationStatus)) {
      errors.push(`${item.key}:calibration_status_invalid`);
    }
    if (!Array.isArray(item.indicators) || item.indicators.length === 0) {
      errors.push(`${item.key}:indicators_missing`);
      continue;
    }

    for (const entry of item.indicators) {
      const allowedValues = resolveAllowedValues(entry?.path);
      if (!allowedValues) {
        errors.push(`${item.key}:indicator_path_invalid`);
        continue;
      }
      if (!Array.isArray(entry.expectedValues) || entry.expectedValues.length === 0) {
        errors.push(`${item.key}:expected_values_missing`);
      } else if (entry.expectedValues.some((value) => !allowedValues.has(value))) {
        errors.push(`${item.key}:expected_value_invalid`);
      }
      if (!INDICATOR_POLARITIES.has(entry.polarity)) {
        errors.push(`${item.key}:polarity_invalid`);
      }
      if (!Number.isFinite(entry.weight) || entry.weight <= 0 || entry.weight > 5) {
        errors.push(`${item.key}:weight_invalid`);
      }
      if (typeof entry.required !== "boolean") {
        errors.push(`${item.key}:required_invalid`);
      }
      if (entry.evidenceRequired !== true) {
        errors.push(`${item.key}:evidence_required_invalid`);
      }
    }
  }

  if (keys.size !== ARCHETYPE_KEYS.length) {
    errors.push("taxonomy_incomplete");
  }

  const policy = registry.decisionPolicy;
  if (!isPlainObject(policy)) {
    errors.push("decision_policy_invalid");
  } else {
    for (const key of [
      "minimumEvidenceCoverage",
      "minimumTopScore",
      "minimumTopMargin",
      "maximumContradictions"
    ]) {
      const value = policy[key];
      const invalidRange = key === "minimumEvidenceCoverage"
        ? Number.isFinite(value) && value > 1
        : key === "maximumContradictions"
          ? Number.isFinite(value) && !Number.isInteger(value)
          : false;
      if (value !== null && (!Number.isFinite(value) || value < 0 || invalidRange)) {
        errors.push(`decision_policy_${key}_invalid`);
      }
    }
  }

  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}
