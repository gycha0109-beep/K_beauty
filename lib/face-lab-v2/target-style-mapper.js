import {
  TARGET_STYLE_AXES,
  TARGET_STYLE_REGISTRY_VERSION,
  getTargetStylePrototype,
  isTargetStyleKey
} from "./target-style-registry.js";

export const TARGET_STYLE_MAPPER_VERSION = "target-style-mapper-v1";
export const TARGET_STYLE_PROFILE_VERSION = "face-lab-target-style-profile-v1";

const PRESENTATION_VALUES = new Set([
  "masculine_examples",
  "feminine_examples",
  "neutral_examples"
]);

const CHANGE_TOLERANCE_VALUES = new Set(["minimal", "light", "moderate", "high"]);

function cleanString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function cleanStringList(values) {
  return Array.isArray(values)
    ? [...new Set(values.map(cleanString).filter(Boolean))]
    : [];
}

function clamp01(value) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : null;
}

function averageVectors(vectors) {
  const result = {};

  TARGET_STYLE_AXES.forEach((axis) => {
    const values = vectors
      .map((vector) => clamp01(vector?.[axis]))
      .filter((value) => value !== null);

    result[axis] = values.length
      ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(3))
      : null;
  });

  return result;
}

function normalizeFinderVector(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const normalized = {};
  let count = 0;

  TARGET_STYLE_AXES.forEach((axis) => {
    const next = clamp01(value[axis]);
    normalized[axis] = next;
    if (next !== null) count += 1;
  });

  return count >= 4 ? normalized : null;
}

function hasMeaningfulVector(vector) {
  return Boolean(vector) && TARGET_STYLE_AXES.some((axis) => typeof vector[axis] === "number");
}

export function buildTargetStyleProfile({
  surveyAnswers = {},
  targetFinderResult = null
} = {}) {
  const targetSelections = cleanStringList(surveyAnswers.targetSelections)
    .filter(isTargetStyleKey)
    .slice(0, 2);

  const directVectors = targetSelections
    .map(getTargetStylePrototype)
    .filter(Boolean);

  const finderVector = normalizeFinderVector(
    targetFinderResult?.estimatedVector ||
    surveyAnswers?.targetFinder?.estimatedVector
  );

  const finderLabels = cleanStringList(
    targetFinderResult?.candidateLabels ||
    surveyAnswers?.targetFinder?.candidateLabels
  ).filter(isTargetStyleKey);

  const finderApproved = Boolean(
    targetFinderResult?.userApproved ||
    surveyAnswers?.targetFinder?.userApproved
  );

  let source = "direct_selection";
  let vector = averageVectors(directVectors);
  let targetLabels = targetSelections;

  if (finderVector && finderApproved && directVectors.length) {
    source = "mixed";
    vector = averageVectors([vector, finderVector]);
    targetLabels = [...new Set([...targetSelections, ...finderLabels])].slice(0, 3);
  } else if (finderVector && finderApproved) {
    source = "target_finder";
    vector = finderVector;
    targetLabels = finderLabels.slice(0, 3);
  }

  const approvedAt = cleanString(surveyAnswers.approvedAt);
  const approvedByUser = Boolean(approvedAt || finderApproved);
  const hasTarget = hasMeaningfulVector(vector) && targetLabels.length > 0;

  const stylingScope = cleanStringList(surveyAnswers.stylingScope);
  const contexts = cleanStringList(surveyAnswers.contexts);
  const presentationPreference = PRESENTATION_VALUES.has(surveyAnswers.presentationPreference)
    ? surveyAnswers.presentationPreference
    : "neutral_examples";
  const changeTolerance = CHANGE_TOLERANCE_VALUES.has(surveyAnswers.changeTolerance)
    ? surveyAnswers.changeTolerance
    : "light";

  const preferenceEvidence = [
    ...targetSelections.map((key) => `direct_target:${key}`),
    ...(finderVector ? ["target_finder_vector"] : []),
    ...(finderApproved ? ["target_finder_user_approved"] : []),
    ...(approvedAt ? ["target_profile_user_approved"] : [])
  ];

  if (!hasTarget) {
    return {
      status: "needs_confirmation",
      profileVersion: TARGET_STYLE_PROFILE_VERSION,
      source,
      approvedByUser: false,
      approvedAt: null,
      targetLabels: [],
      vector: Object.fromEntries(TARGET_STYLE_AXES.map((axis) => [axis, null])),
      priority: [],
      contexts,
      presentationPreference,
      stylingScope,
      changeTolerance,
      constraints: surveyAnswers.constraints && typeof surveyAnswers.constraints === "object"
        ? surveyAnswers.constraints
        : {},
      constraintsRef: null,
      preferenceEvidence,
      confidence: null,
      registryVersion: TARGET_STYLE_REGISTRY_VERSION,
      mapperVersion: TARGET_STYLE_MAPPER_VERSION
    };
  }

  return {
    status: approvedByUser ? "available" : "needs_confirmation",
    profileVersion: TARGET_STYLE_PROFILE_VERSION,
    source,
    approvedByUser,
    approvedAt: approvedAt || null,
    targetLabels,
    vector,
    priority: targetLabels.slice(0, 2),
    contexts,
    presentationPreference,
    stylingScope,
    changeTolerance,
    constraints: surveyAnswers.constraints && typeof surveyAnswers.constraints === "object"
      ? structuredClone(surveyAnswers.constraints)
      : {},
    constraintsRef: null,
    preferenceEvidence,
    confidence: approvedByUser ? 1 : 0.6,
    registryVersion: TARGET_STYLE_REGISTRY_VERSION,
    mapperVersion: TARGET_STYLE_MAPPER_VERSION
  };
}
