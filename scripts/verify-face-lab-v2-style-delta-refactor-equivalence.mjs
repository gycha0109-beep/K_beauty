import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  FACE_LAB_OBSERVATION_DEFINITIONS,
  buildFaceLabObservationAnalysis
} from "../lib/face-lab-observation-contract.js";
import { buildFaceLabV2Canonical } from "../lib/face-lab-v2/canonical-composer.js";
import {
  buildFaceLabV2AdversarialCohort,
  buildFaceLabV2CoverageCohort,
  buildFaceLabV2EvaluationCohort
} from "../lib/face-lab-v2/evaluation/harness.js";
import {
  buildFaceLabV2TargetSweepCohort
} from "../lib/face-lab-v2/evaluation/target-responsiveness.js";

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

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function projectStyleDelta(caseId, canonical) {
  const styleDelta = canonical?.styleDelta || null;
  return {
    caseId,
    styleDelta: styleDelta
      ? {
          status: styleDelta.status ?? null,
          version: styleDelta.version ?? null,
          targetProfileVersion: styleDelta.targetProfileVersion ?? null,
          faceProfileVersion: styleDelta.faceProfileVersion ?? null,
          summary: styleDelta.summary ?? null,
          priorities: styleDelta.priorities ?? [],
          preservedFeatures: styleDelta.preservedFeatures ?? [],
          conflicts: styleDelta.conflicts ?? [],
          confidence: styleDelta.confidence ?? null,
          evidence: styleDelta.evidence ?? [],
          unavailableReason: styleDelta.unavailableReason ?? null
        }
      : null
  };
}

function hashCohort(cohort) {
  const payload = cohort.cases.map((item) => {
    const canonical = buildFaceLabV2Canonical({
      analysis: item.analysis,
      surveyAnswers: item.surveyAnswers,
      resultId: item.caseId
    });
    return projectStyleDelta(item.caseId, canonical);
  });
  return sha256(stableStringify(payload));
}

const NEUTRAL_VALUES = Object.freeze({
  "outline.faceShape": "oval",
  "outline.foreheadWidthVsCheek": "similar",
  "outline.jawWidthVsCheek": "similar",
  "outline.jawlineAngularity": "moderate",
  "outline.jawTaper": "balanced",
  "outline.cheekboneProminence": "moderate",
  "vertical.faceLengthBalance": "balanced",
  "vertical.foreheadHeight": "balanced",
  "vertical.midfaceLength": "balanced",
  "vertical.lowerFaceLength": "balanced",
  "eyes.eyeDirection": "level",
  "eyes.eyeLength": "medium",
  "eyes.eyeOpenness": "medium",
  "featureLayout.featureScale": "medium",
  "featureLayout.featureConcentration": "balanced",
  "featureLayout.focalFeatures": ["eyes"],
  "visualLanguage.straightCurveBalance": "balanced",
  "visualLanguage.contourDefinition": "moderate",
  "visualLanguage.featureContrast": "medium",
  "colorAppearance.apparentTemperature": "neutral",
  "colorAppearance.apparentBrightness": "medium",
  "colorAppearance.apparentSaturation": "balanced"
});

function buildNeutralRawObservation() {
  const observations = {};
  for (const [group, fields] of Object.entries(FACE_LAB_OBSERVATION_DEFINITIONS)) {
    observations[group] = {};
    for (const [key, values] of Object.entries(fields)) {
      const fieldPath = group + "." + key;
      const arrayField = group === "featureLayout" && key === "focalFeatures";
      const neutral = Object.prototype.hasOwnProperty.call(NEUTRAL_VALUES, fieldPath)
        ? NEUTRAL_VALUES[fieldPath]
        : values[0];
      observations[group][key] = {
        value: arrayField
          ? [...(Array.isArray(neutral) ? neutral : [neutral])]
          : neutral,
        visibility: "clear",
        evidence: ["style-delta-refactor:" + fieldPath],
        unavailableReason: null
      };
    }
  }

  return {
    quality: {
      faceVisibility: "clear",
      faceScale: "adequate",
      pose: { yaw: "frontal", pitch: "level", roll: "level" },
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
      evidence: ["style-delta-refactor:quality"]
    },
    observations
  };
}

function mutateObservation(raw, fieldPath, value) {
  const [group, key] = fieldPath.split(".");
  const next = structuredClone(raw);
  next.observations[group][key].value = value;
  return next;
}

function buildAnalysis(raw) {
  return buildFaceLabObservationAnalysis(raw, {
    eligibility: { faceLabEligible: true },
    provider: "evaluation_fixture",
    model: "face-lab-v2-style-delta-refactor-baseline-v1"
  });
}

const ALL_DOMAINS = [
  "hair",
  "brow_grooming",
  "makeup",
  "color",
  "eyewear",
  "accessories",
  "facial_hair"
];

function buildSurvey(caseId, targetKey) {
  return {
    schemaVersion: "face-lab-target-style-survey-v1",
    entryMode: "known",
    targetSelections: [targetKey],
    clarifiers: {
      softSharp: null,
      naturalPolished: null
    },
    presentationPreference: "neutral_examples",
    stylingScope: [...ALL_DOMAINS],
    changeTolerance: "moderate",
    contexts: ["daily"],
    constraints: {
      hair: { lengthChange: "small", dye: "no" },
      makeup: { intensity: "medium" },
      lifestyle: {
        dailyMinutes: 30,
        budgetBand: "standard",
        maintenanceTolerance: "medium"
      },
      hardExclusions: []
    },
    approvedAt: "2026-09-28T00:00:00.000Z",
    evaluationCaseId: caseId
  };
}

const modifierPairs = [
  {
    id: "M1-eye-direction",
    targetKey: "chic",
    fieldPath: "eyes.eyeDirection",
    baseline: "level",
    variant: "upturned"
  },
  {
    id: "M2-feature-contrast",
    targetKey: "statement_glam",
    fieldPath: "visualLanguage.featureContrast",
    baseline: "medium",
    variant: "high"
  },
  {
    id: "M3-contour-definition",
    targetKey: "chic",
    fieldPath: "visualLanguage.contourDefinition",
    baseline: "moderate",
    variant: "defined"
  },
  {
    id: "M4-straight-curve",
    targetKey: "soft",
    fieldPath: "visualLanguage.straightCurveBalance",
    baseline: "balanced",
    variant: "curved"
  }
];

function buildModifierFixturePayload() {
  return modifierPairs.map((pair) => {
    const neutral = buildNeutralRawObservation();
    const baseline = buildFaceLabV2Canonical({
      analysis: buildAnalysis(mutateObservation(neutral, pair.fieldPath, pair.baseline)),
      surveyAnswers: buildSurvey(pair.id + "-base", pair.targetKey),
      resultId: pair.id + "-base"
    });
    const variant = buildFaceLabV2Canonical({
      analysis: buildAnalysis(mutateObservation(neutral, pair.fieldPath, pair.variant)),
      surveyAnswers: buildSurvey(pair.id + "-variant", pair.targetKey),
      resultId: pair.id + "-variant"
    });
    return {
      id: pair.id,
      fieldPath: pair.fieldPath,
      targetKey: pair.targetKey,
      baseline: projectStyleDelta(pair.id + "-base", baseline).styleDelta,
      variant: projectStyleDelta(pair.id + "-variant", variant).styleDelta
    };
  });
}

const EXPECTED_HASHES = Object.freeze({
  lockedStyleDeltaHash:
    "e580f798a2d4d4e2d642b73a954f49221d60788f9b8141d059e2a07947884cad",
  coverageStyleDeltaHash:
    "ee77c22a7d296c5c179261af6c68da7f87cb161bb1e1acd70f6d76787a5f7ae4",
  adversarialStyleDeltaHash:
    "dd3add9a93c8049504056c9384b3419276d7016290241f7388b8cc946acf312c",
  targetSweepStyleDeltaHash:
    "6da929c4db6cc7bccf141ea7c8a3ff4d2dcb9777b48da7ba9a93f8a3c79ac783",
  modifierFixtureHash:
    "8ace048db7dfcba6d106faa9d9566eb65633ad74eb96e8158246f8c17696e0c5"
});

const locked = buildFaceLabV2EvaluationCohort();
const coverage = buildFaceLabV2CoverageCohort();
const adversarial = buildFaceLabV2AdversarialCohort();
const targetSweep = buildFaceLabV2TargetSweepCohort();
const modifierPayload = buildModifierFixturePayload();

const hashes = {
  lockedStyleDeltaHash: hashCohort(locked),
  coverageStyleDeltaHash: hashCohort(coverage),
  adversarialStyleDeltaHash: hashCohort(adversarial),
  targetSweepStyleDeltaHash: hashCohort(targetSweep),
  modifierFixtureHash: sha256(stableStringify(modifierPayload))
};

assert.deepEqual(
  hashes,
  EXPECTED_HASHES,
  "Style Delta semantic witnesses changed from the pre-refactor main baseline"
);

assert.equal(locked.caseCount, 96);
assert.equal(coverage.caseCount, 96);
assert.equal(adversarial.caseCount, 32);
assert.equal(targetSweep.caseCount, 96);
assert.equal(modifierPayload.length, 4);

console.log(JSON.stringify({
  ok: true,
  mode: "frozen_pre_refactor_equivalence",
  cohortCounts: {
    locked: locked.caseCount,
    coverage: coverage.caseCount,
    adversarial: adversarial.caseCount,
    targetSweep: targetSweep.caseCount,
    modifierPairs: modifierPayload.length
  },
  hashes
}, null, 2));
