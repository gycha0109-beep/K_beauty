import {
  TARGET_STYLE_AXES,
  isTargetStyleKey
} from "./target-style-registry.js";

export const FACE_LAB_V2_SURVEY_SCHEMA_VERSION = "face-lab-target-style-survey-v1";

const ENTRY_MODES = new Set(["known", "partial", "unknown"]);
const PRESENTATION_VALUES = new Set([
  "masculine_examples",
  "feminine_examples",
  "neutral_examples"
]);
const SCOPE_VALUES = new Set([
  "hair",
  "brow_grooming",
  "makeup",
  "color",
  "eyewear",
  "accessories",
  "facial_hair",
  "face_adjacent_style",
  "auto_scope"
]);
const CHANGE_VALUES = new Set(["minimal", "light", "moderate", "high"]);
const CONTEXT_VALUES = new Set([
  "daily",
  "work_school",
  "date",
  "photo_social",
  "formal",
  "event"
]);
const HARD_EXCLUSIONS = new Set([
  "hair_dye",
  "hair_disabled",
  "makeup_disabled",
  "brow_grooming_disabled",
  "eyewear_disabled",
  "accessories_disabled",
  "facial_hair_disabled"
]);

function stringList(values, allowed = null, limit = 12) {
  if (!Array.isArray(values)) return [];

  const cleaned = values
    .filter((value) => typeof value === "string" && value.trim())
    .map((value) => value.trim())
    .filter((value) => !allowed || allowed.has(value));

  return [...new Set(cleaned)].slice(0, limit);
}

function validDateString(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value))
    ? value
    : null;
}

function clamp01(value) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : null;
}

export function normalizeFaceLabV2TargetFinderResult(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const vector = {};
  let vectorCount = 0;

  TARGET_STYLE_AXES.forEach((axis) => {
    const normalized = clamp01(value.estimatedVector?.[axis]);
    vector[axis] = normalized;
    if (normalized !== null) vectorCount += 1;
  });

  const candidateLabels = stringList(value.candidateLabels, null, 3)
    .filter(isTargetStyleKey);

  if (vectorCount < 4 || !candidateLabels.length) {
    return null;
  }

  return {
    candidateSetVersion:
      typeof value.candidateSetVersion === "string" && value.candidateSetVersion.trim()
        ? value.candidateSetVersion.trim().slice(0, 80)
        : "target-finder-cards-v1",
    candidateLabels,
    estimatedVector: vector,
    userApproved: value.userApproved === true
  };
}

export function normalizeFaceLabV2SurveyAnswers(value) {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};

  const presentationPreference = PRESENTATION_VALUES.has(source.presentationPreference)
    ? source.presentationPreference
    : "neutral_examples";

  const changeTolerance = CHANGE_VALUES.has(source.changeTolerance)
    ? source.changeTolerance
    : "light";

  const hair = source.constraints?.hair && typeof source.constraints.hair === "object"
    ? source.constraints.hair
    : {};
  const makeup = source.constraints?.makeup && typeof source.constraints.makeup === "object"
    ? source.constraints.makeup
    : {};
  const lifestyle = source.constraints?.lifestyle && typeof source.constraints.lifestyle === "object"
    ? source.constraints.lifestyle
    : {};

  const dailyMinutes = [5, 15, 30].includes(Number(lifestyle.dailyMinutes))
    ? Number(lifestyle.dailyMinutes)
    : 15;

  return {
    schemaVersion: FACE_LAB_V2_SURVEY_SCHEMA_VERSION,
    entryMode: ENTRY_MODES.has(source.entryMode) ? source.entryMode : "known",
    targetSelections: stringList(source.targetSelections, null, 2).filter(isTargetStyleKey),
    clarifiers: {
      softSharp: ["soft", "neutral", "sharp"].includes(source.clarifiers?.softSharp)
        ? source.clarifiers.softSharp
        : null,
      naturalPolished: ["natural", "neutral", "polished"].includes(source.clarifiers?.naturalPolished)
        ? source.clarifiers.naturalPolished
        : null
    },
    presentationPreference,
    stylingScope: stringList(source.stylingScope, SCOPE_VALUES, 8),
    changeTolerance,
    contexts: stringList(source.contexts, CONTEXT_VALUES, 6),
    constraints: {
      hair: {
        lengthChange: ["small", "large"].includes(hair.lengthChange)
          ? hair.lengthChange
          : "small",
        dye: hair.dye === "yes" ? "yes" : "no"
      },
      makeup: {
        intensity: ["light", "medium", "expressive", "grooming_only", "none"].includes(makeup.intensity)
          ? makeup.intensity
          : "light"
      },
      lifestyle: {
        dailyMinutes
      },
      hardExclusions: stringList(
        source.constraints?.hardExclusions,
        HARD_EXCLUSIONS,
        HARD_EXCLUSIONS.size
      )
    },
    approvedAt: validDateString(source.approvedAt)
  };
}

export function normalizeFaceLabV2PersistencePayload(value) {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};

  return {
    surveyAnswers: normalizeFaceLabV2SurveyAnswers(source.surveyAnswers),
    targetFinderResult: normalizeFaceLabV2TargetFinderResult(source.targetFinderResult),
    selectedRouteId:
      typeof source.selectedRouteId === "string" && source.selectedRouteId.trim()
        ? source.selectedRouteId.trim().slice(0, 80)
        : null
  };
}
