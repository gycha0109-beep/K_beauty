import {
  FACE_LAB_OBSERVATION_DEFINITIONS,
  buildFaceLabObservationAnalysis
} from "../../face-lab-observation-contract.js";
import { buildCurrentFaceProfile } from "../current-face-profile.js";
import { buildStyleDelta } from "../style-delta.js";
import { TARGET_STYLE_AXES } from "../target-style-registry.js";

export const FACE_LAB_V2_AXIS_CONSUMPTION_EVALUATOR_VERSION =
  "face-lab-v2-axis-consumption-evaluator-v1";

const STYLING_SCOPE = Object.freeze([
  "hair",
  "brow_grooming",
  "makeup",
  "color",
  "eyewear",
  "accessories",
  "facial_hair"
]);

function buildRawObservation() {
  const observations = {};

  for (const [group, fields] of Object.entries(FACE_LAB_OBSERVATION_DEFINITIONS)) {
    observations[group] = {};
    for (const [key, values] of Object.entries(fields)) {
      const isArray = group === "featureLayout" && key === "focalFeatures";
      observations[group][key] = {
        value: isArray ? [values[0]] : values[0],
        visibility: "clear",
        evidence: [`axis-consumption:${group}.${key}`],
        unavailableReason: null
      };
    }
  }

  observations.eyes.eyeDirection.value = "level";
  observations.visualLanguage.contourDefinition.value = "moderate";
  observations.visualLanguage.featureContrast.value = "medium";
  observations.visualLanguage.straightCurveBalance.value = "balanced";

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
      evidence: ["axis-consumption:quality"]
    },
    observations
  };
}

function buildTargetStyle(axis, value) {
  const vector = Object.fromEntries(
    TARGET_STYLE_AXES.map((key) => [key, key === axis ? value : 0.5])
  );

  return {
    status: "available",
    profileVersion: `axis-consumption-${axis}-${value}`,
    approvedByUser: true,
    source: "axis_consumption_evaluation",
    targetLabels: [`axis:${axis}`],
    vector,
    stylingScope: [...STYLING_SCOPE],
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
    preferenceEvidence: [`evaluation_axis:${axis}`]
  };
}

function activeAxisPriorities(styleDelta, axis) {
  const token = `target_axis:${axis}`;
  return (styleDelta?.priorities || []).filter(
    (item) =>
      item?.constraintState !== "blocked" &&
      Array.isArray(item?.evidence) &&
      item.evidence.includes(token)
  );
}

export function runFaceLabV2AxisConsumptionEvaluation() {
  const analysis = buildFaceLabObservationAnalysis(buildRawObservation(), {
    eligibility: { faceLabEligible: true },
    provider: "evaluation_fixture",
    model: "face-lab-v2-axis-consumption-v1"
  });
  const currentFaceProfile = buildCurrentFaceProfile(analysis, { locale: "ko" });
  const failures = [];
  const axisDiagnostics = [];

  for (const axis of TARGET_STYLE_AXES) {
    const lowDelta = buildStyleDelta({
      currentFaceProfile,
      targetStyle: buildTargetStyle(axis, 0.15)
    });
    const highDelta = buildStyleDelta({
      currentFaceProfile,
      targetStyle: buildTargetStyle(axis, 0.85)
    });

    const low = activeAxisPriorities(lowDelta, axis);
    const high = activeAxisPriorities(highDelta, axis);

    axisDiagnostics.push({
      axis,
      lowActionCount: low.length,
      highActionCount: high.length,
      lowDomains: [...new Set(low.map((item) => item.domain))],
      highDomains: [...new Set(high.map((item) => item.domain))]
    });

    if (!low.length) {
      failures.push({
        evaluatorId: "E3-axis-consumption",
        axis,
        direction: "low",
        expected: `at least one executable priority with target_axis:${axis}`,
        observed: "no executable priority"
      });
    }

    if (!high.length) {
      failures.push({
        evaluatorId: "E3-axis-consumption",
        axis,
        direction: "high",
        expected: `at least one executable priority with target_axis:${axis}`,
        observed: "no executable priority"
      });
    }
  }

  return {
    reportVersion: "face-lab-v2-axis-consumption-report-v1",
    evaluatorVersion: FACE_LAB_V2_AXIS_CONSUMPTION_EVALUATOR_VERSION,
    summary: {
      axisCount: TARGET_STYLE_AXES.length,
      hardFailureCount: failures.length,
      fullyConsumedAxisCount: axisDiagnostics.filter(
        (item) => item.lowActionCount > 0 && item.highActionCount > 0
      ).length
    },
    axisDiagnostics,
    failures
  };
}
