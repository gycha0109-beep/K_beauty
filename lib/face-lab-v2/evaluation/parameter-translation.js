import { createHash } from "node:crypto";
import {
  FACE_LAB_OBSERVATION_DEFINITIONS,
  buildFaceLabObservationAnalysis
} from "../../face-lab-observation-contract.js";
import { buildCurrentFaceProfile } from "../current-face-profile.js";
import { buildStyleDelta } from "../style-delta.js";
import { TARGET_STYLE_AXES } from "../target-style-registry.js";
import { buildHairExecution } from "../domain/hair.js";
import { buildGroomingExecution } from "../domain/grooming.js";
import { buildMakeupExecution } from "../domain/makeup.js";
import { buildColorExecution } from "../domain/color.js";
import { buildEyewearExecution } from "../domain/eyewear.js";
import { buildAccessoriesExecution } from "../domain/accessories.js";

export const FACE_LAB_V2_PARAMETER_TRANSLATION_EVALUATOR_VERSION =
  "face-lab-v2-parameter-translation-evaluator-v1";

const ALL_SCOPE = Object.freeze([
  "hair",
  "brow_grooming",
  "makeup",
  "color",
  "eyewear",
  "accessories",
  "facial_hair"
]);

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])])
    );
  }
  return value;
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

function fingerprint(value) {
  return createHash("sha256")
    .update(stableStringify(value))
    .digest("hex")
    .slice(0, 16);
}

function makeRawObservation(overrides = {}) {
  const observations = {};

  for (const [group, fields] of Object.entries(FACE_LAB_OBSERVATION_DEFINITIONS)) {
    observations[group] = {};
    for (const [key, values] of Object.entries(fields)) {
      const isArray = group === "featureLayout" && key === "focalFeatures";
      observations[group][key] = {
        value: isArray ? [values[0]] : values[0],
        visibility: "clear",
        evidence: [`parameter-translation:${group}.${key}`],
        unavailableReason: null
      };
    }
  }

  const defaults = {
    "eyes.eyeDirection": "level",
    "visualLanguage.contourDefinition": "moderate",
    "visualLanguage.featureContrast": "medium",
    "visualLanguage.straightCurveBalance": "balanced"
  };

  for (const [path, value] of Object.entries({ ...defaults, ...overrides })) {
    const [group, key] = path.split(".");
    observations[group][key].value = value;
  }

  return {
    quality: {
      faceVisibility: "clear",
      faceScale: "adequate",
      pose: {
        yaw: "frontal",
        pitch: "level",
        roll: "level"
      },
      occlusion: {
        forehead: "none",
        brows: "none",
        eyes: "none",
        cheeks: "none",
        jawline: "none"
      },
      sharpness: "clear",
      exposure: "balanced",
      lightingUniformity: "even",
      whiteBalance: "stable",
      filterOrEditing: "none_detected",
      makeupCoverage: "none_or_light",
      structureSuitability: "suitable",
      colorSuitability: "suitable",
      evidence: ["parameter-translation:quality"]
    },
    observations
  };
}

function buildProfile(overrides = {}) {
  const analysis = buildFaceLabObservationAnalysis(
    makeRawObservation(overrides),
    {
      eligibility: { faceLabEligible: true },
      provider: "evaluation_fixture",
      model: "face-lab-v2-parameter-translation-v1"
    }
  );

  return buildCurrentFaceProfile(analysis, { locale: "ko" });
}

function buildTargetStyle(axis, value) {
  return {
    status: "available",
    profileVersion: `parameter-translation-${axis}-${value}`,
    approvedByUser: true,
    source: "parameter_translation_evaluation",
    targetLabels: [`axis:${axis}`],
    vector: Object.fromEntries(
      TARGET_STYLE_AXES.map((key) => [key, key === axis ? value : 0.5])
    ),
    stylingScope: [...ALL_SCOPE],
    changeTolerance: "moderate",
    constraints: {
      hair: {
        lengthChange: "small",
        dye: "no"
      },
      makeup: {
        intensity: "medium"
      },
      lifestyle: {
        dailyMinutes: 30,
        budgetBand: "standard",
        maintenanceTolerance: "medium"
      },
      hardExclusions: []
    },
    preferenceEvidence: [`parameter_translation_axis:${axis}`]
  };
}

function actionKey(action) {
  return [
    action.domain,
    action.parameter,
    action.direction
  ].join(":");
}

function collectActions(currentFaceProfile, axis, value) {
  const delta = buildStyleDelta({
    currentFaceProfile,
    targetStyle: buildTargetStyle(axis, value)
  });

  return (delta.priorities || []).filter(
    (item) => item?.constraintState === "allowed"
  );
}

function collectEmittableActions() {
  const neutral = buildProfile();
  const upturned = buildProfile({
    "eyes.eyeDirection": "upturned"
  });
  const definedContour = buildProfile({
    "visualLanguage.contourDefinition": "defined"
  });
  const curvedLines = buildProfile({
    "visualLanguage.straightCurveBalance": "curved"
  });
  const highContrast = buildProfile({
    "visualLanguage.featureContrast": "high"
  });

  const actions = [];

  for (const axis of TARGET_STYLE_AXES) {
    actions.push(...collectActions(neutral, axis, 0.15));
    actions.push(...collectActions(neutral, axis, 0.85));
  }

  actions.push(...collectActions(upturned, "softSharp", 0.85));
  actions.push(...collectActions(definedContour, "softSharp", 0.85));
  actions.push(...collectActions(curvedLines, "softSharp", 0.15));
  actions.push(...collectActions(highContrast, "minimalStatement", 0.85));

  return [
    ...new Map(actions.map((item) => [actionKey(item), item])).values()
  ].sort((left, right) => actionKey(left).localeCompare(actionKey(right)));
}

function syntheticTargetStyle() {
  return {
    status: "available",
    profileVersion: "parameter-translation-target-v1",
    approvedByUser: true,
    vector: Object.fromEntries(TARGET_STYLE_AXES.map((axis) => [axis, 0.5])),
    stylingScope: [...ALL_SCOPE],
    changeTolerance: "moderate",
    constraints: {
      hair: {
        lengthChange: "small",
        dye: "no"
      },
      makeup: {
        intensity: "medium"
      },
      lifestyle: {
        dailyMinutes: 30,
        budgetBand: "standard",
        maintenanceTolerance: "medium"
      },
      hardExclusions: []
    },
    preferenceEvidence: ["parameter_translation_synthetic_route"]
  };
}

function syntheticRoute(action) {
  return {
    routeId: `translation-${action.domain}-${action.parameter}-${action.direction}`,
    title: "Parameter translation fixture",
    strategy: "evaluation",
    domains: [action.domain],
    actions: [{
      domain: action.domain,
      parameter: action.parameter,
      direction: action.direction,
      strength: action.strength,
      explanation: action.expectedEffect,
      reason: action.reason,
      evidence: [...(action.evidence || [])]
    }],
    whyThisRoute: action.expectedEffect,
    constraintFit: {
      hardViolations: [],
      softTradeoffs: [],
      score: 0
    }
  };
}

function hasString(values) {
  return Array.isArray(values) &&
    values.some((item) => typeof item === "string" && item.trim());
}

function techniqueHasPayload(value) {
  if (!value) return false;
  return [
    "placement",
    "direction",
    "finish",
    "colorDirection"
  ].some((key) => hasString(value[key])) ||
    (typeof value.whyItWorks === "string" && value.whyItWorks.trim());
}

function resultHasPayload(key, result) {
  const value = result?.value;
  if (!value) return false;

  if (key === "hair") {
    return [
      "parting",
      "fringe",
      "crownVolume",
      "sideVolume",
      "templeCoverage",
      "faceLineExposure",
      "lengthDirection",
      "layerDirection",
      "curvature",
      "texture",
      "silhouette",
      "avoidOrModerate"
    ].some((name) => hasString(value[name])) ||
      (Array.isArray(value.examples) && value.examples.length > 0);
  }

  if (key === "grooming") {
    return [
      "brows",
      "facialHair",
      "sideburns",
      "hairline",
      "maintenancePlan"
    ].some((name) => hasString(value[name]));
  }

  if (key === "makeup") {
    return [
      "brows",
      "eyes",
      "blush",
      "lips",
      "complexion",
      "contourHighlight"
    ].some((name) => techniqueHasPayload(value[name])) ||
      hasString(value.avoidOrModerate);
  }

  if (key === "color") {
    return Boolean(
      value.temperatureDirection ||
      value.depthDirection ||
      value.chromaDirection ||
      value.contrastDirection ||
      hasString(value.preferredFamilies) ||
      hasString(value.moderateFamilies) ||
      hasString(value.applicationNotes) ||
      hasString(value.qualityWarnings)
    );
  }

  if (key === "eyewear") {
    return [
      "frameWidth",
      "frameHeight",
      "angularity",
      "curvature",
      "rimThickness",
      "bridgeDirection",
      "browAlignment",
      "visualWeight",
      "colorContrast"
    ].some((name) => hasString(value[name])) ||
      (Array.isArray(value.examples) && value.examples.length > 0);
  }

  if (key === "accessories") {
    return [
      "scale",
      "angularity",
      "curvature",
      "length",
      "visualWeight",
      "colorContrast"
    ].some((name) => hasString(value[name])) ||
      (Array.isArray(value.examples) && value.examples.length > 0);
  }

  return false;
}

function execute(action) {
  const route = syntheticRoute(action);
  const targetStyle = syntheticTargetStyle();
  const currentFaceProfile = buildProfile();

  if (action.domain === "hair") {
    return {
      key: "hair",
      result: buildHairExecution({ route, targetStyle, currentFaceProfile })
    };
  }

  if (action.domain === "brow_grooming" || action.domain === "facial_hair") {
    return {
      key: "grooming",
      result: buildGroomingExecution({ route, targetStyle })
    };
  }

  if (action.domain === "makeup") {
    return {
      key: "makeup",
      result: buildMakeupExecution({ route, targetStyle }).result
    };
  }

  if (action.domain === "color") {
    return {
      key: "color",
      result: buildColorExecution({ route, targetStyle })
    };
  }

  if (action.domain === "eyewear") {
    return {
      key: "eyewear",
      result: buildEyewearExecution({ route, targetStyle })
    };
  }

  if (action.domain === "accessories") {
    return {
      key: "accessories",
      result: buildAccessoriesExecution({ route, targetStyle })
    };
  }

  return {
    key: null,
    result: null
  };
}

function failure(action, evaluatorId, expected, observed) {
  const payload = {
    evaluatorId,
    severity: "hard",
    action: actionKey(action),
    expected,
    observed
  };

  return {
    ...payload,
    fingerprint: fingerprint(payload)
  };
}

export function runFaceLabV2ParameterTranslationEvaluation() {
  const actions = collectEmittableActions();
  const failures = [];
  const domainActionCounts = {};
  const parameterKeys = new Set();

  for (const action of actions) {
    domainActionCounts[action.domain] = (domainActionCounts[action.domain] || 0) + 1;
    parameterKeys.add(`${action.domain}:${action.parameter}`);

    const { key, result } = execute(action);

    if (!key || !result) {
      failures.push(
        failure(
          action,
          "E5-parameter-execution-missing",
          "an executable domain engine",
          "no engine"
        )
      );
      continue;
    }

    if (result.status !== "available") {
      failures.push(
        failure(
          action,
          "E5-parameter-status",
          `${key}:available`,
          result.status || "missing"
        )
      );
      continue;
    }

    const evidenceToken = `style_delta:${action.parameter}`;
    if (!(result.evidence || []).includes(evidenceToken)) {
      failures.push(
        failure(
          action,
          "E5-parameter-evidence",
          evidenceToken,
          result.evidence || []
        )
      );
    }

    if (!resultHasPayload(key, result)) {
      failures.push(
        failure(
          action,
          "E5-parameter-empty-translation",
          "at least one user-visible execution payload",
          result.value
        )
      );
    }
  }

  return {
    reportVersion: "face-lab-v2-parameter-translation-report-v1",
    evaluatorVersion: FACE_LAB_V2_PARAMETER_TRANSLATION_EVALUATOR_VERSION,
    summary: {
      actionVariantCount: actions.length,
      uniqueParameterCount: parameterKeys.size,
      translatedActionVariantCount: actions.length - failures.filter(
        (item) => item.evaluatorId === "E5-parameter-empty-translation" ||
          item.evaluatorId === "E5-parameter-status" ||
          item.evaluatorId === "E5-parameter-execution-missing"
      ).length,
      hardFailureCount: failures.length,
      domainActionCounts
    },
    actions: actions.map((item) => ({
      domain: item.domain,
      parameter: item.parameter,
      direction: item.direction,
      strength: item.strength,
      reason: item.reason
    })),
    failures
  };
}
