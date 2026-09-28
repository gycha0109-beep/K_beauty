import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  FACE_LAB_OBSERVATION_DEFINITIONS,
  buildFaceLabObservationAnalysis
} from "../lib/face-lab-observation-contract.js";
import { buildFaceLabV2Canonical } from "../lib/face-lab-v2/canonical-composer.js";
import {
  buildTargetActionPool,
  TARGET_ACTION_POOL_VERSION
} from "../lib/face-lab-v2/target-action-pool.js";
import {
  FACE_ACTION_RELATIONS,
  FACE_ACTION_RELATION_AUTHORITY,
  FACE_ACTION_RELATION_REGISTRY_VERSION
} from "../lib/face-lab-v2/personalization/face-action-relations.js";
import {
  applyCurrentFaceModifiers,
  CURRENT_FACE_MODIFIER_VERSION
} from "../lib/face-lab-v2/personalization/current-face-modifier.js";
import { STYLE_DELTA_VERSION } from "../lib/face-lab-v2/style-delta.js";
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

function isolatedVector(axis, value) {
  return {
    softSharp: 0.5,
    naturalPolished: 0.5,
    playfulMature: 0.5,
    minimalStatement: 0.5,
    warmCool: 0.5,
    classicTrendy: 0.5,
    [axis]: value
  };
}

function poolFor(axis, value) {
  return buildTargetActionPool({
    vector: isolatedVector(axis, value)
  });
}

function reasonsFor(axis, value) {
  return poolFor(axis, value).map((item) => item.reason);
}

function findPoolAction(actions, domain, parameter) {
  return actions.find(
    (item) => item.domain === domain && item.parameter === parameter
  ) || null;
}

assert.equal(STYLE_DELTA_VERSION, "face-lab-style-delta-v3");
assert.equal(TARGET_ACTION_POOL_VERSION, "face-lab-target-action-pool-v1");
assert.equal(
  FACE_ACTION_RELATION_REGISTRY_VERSION,
  "face-lab-face-action-relation-registry-v1"
);
assert.equal(
  CURRENT_FACE_MODIFIER_VERSION,
  "face-lab-current-face-modifier-v1"
);

assert.deepEqual(
  FACE_ACTION_RELATIONS.map((item) => item.relationId),
  [
    "FL-CURRENT-001",
    "FL-CURRENT-002",
    "FL-CURRENT-003",
    "FL-CURRENT-004"
  ],
  "PR A must contain exactly the four pre-existing current modifier relations"
);
assert.ok(
  FACE_ACTION_RELATIONS.every(
    (item) =>
      item.authorityClass ===
      FACE_ACTION_RELATION_AUTHORITY.CURRENT_CONTRACT
  ),
  "PR A must not introduce candidate or blocked relation authority"
);
assert.equal(
  new Set(
    FACE_ACTION_RELATIONS.map(
      (item) => item.actionMatch.domain + ":" + item.actionMatch.parameter
    )
  ).size,
  FACE_ACTION_RELATIONS.length,
  "current relation action matches must remain non-overlapping"
);
assert.ok(
  FACE_ACTION_RELATIONS.every(
    (item) =>
      typeof item.sourceFeatureKey === "string" &&
      item.sourceFeatureKey.length > 0 &&
      Array.isArray(item.sourceValues) &&
      item.sourceValues.length > 0 &&
      typeof item.operation?.reason === "string" &&
      item.operation.reason.length > 0 &&
      typeof item.operation?.expectedEffect === "string" &&
      item.operation.expectedEffect.length > 0 &&
      ["redirect", "strength_cap", "preserve"].includes(
        item.operation?.type
      )
  ),
  "current relation registry shape must remain inspectable and bounded"
);

assert.equal(reasonsFor("softSharp", 0.36).length, 5);
assert.equal(reasonsFor("softSharp", 0.37).length, 0);
assert.equal(reasonsFor("softSharp", 0.63).length, 0);
assert.equal(reasonsFor("softSharp", 0.64).length, 5);
assert.equal(
  findPoolAction(poolFor("softSharp", 0.77), "hair", "outlineDefinition")
    ?.strength,
  "moderate"
);
assert.equal(
  findPoolAction(poolFor("softSharp", 0.78), "hair", "outlineDefinition")
    ?.strength,
  "strong"
);

assert.equal(reasonsFor("naturalPolished", 0.36).length, 2);
assert.equal(reasonsFor("naturalPolished", 0.37).length, 0);
assert.equal(reasonsFor("naturalPolished", 0.63).length, 0);
assert.equal(reasonsFor("naturalPolished", 0.64).length, 5);

assert.equal(reasonsFor("playfulMature", 0.34).length, 2);
assert.equal(reasonsFor("playfulMature", 0.35).length, 0);
assert.equal(reasonsFor("playfulMature", 0.65).length, 0);
assert.equal(reasonsFor("playfulMature", 0.66).length, 2);

assert.equal(reasonsFor("minimalStatement", 0.34).length, 3);
assert.equal(reasonsFor("minimalStatement", 0.35).length, 0);
assert.equal(reasonsFor("minimalStatement", 0.65).length, 0);
assert.equal(reasonsFor("minimalStatement", 0.66).length, 3);
assert.equal(
  findPoolAction(
    poolFor("minimalStatement", 0.81),
    "makeup",
    "selectedFeatureContrast"
  )?.strength,
  "moderate"
);
assert.equal(
  findPoolAction(
    poolFor("minimalStatement", 0.82),
    "makeup",
    "selectedFeatureContrast"
  )?.strength,
  "strong"
);

assert.equal(reasonsFor("classicTrendy", 0.32).length, 1);
assert.equal(reasonsFor("classicTrendy", 0.33).length, 0);
assert.equal(reasonsFor("classicTrendy", 0.67).length, 0);
assert.equal(reasonsFor("classicTrendy", 0.68).length, 1);

assert.equal(reasonsFor("warmCool", 0.21).length, 1);
assert.equal(poolFor("warmCool", 0.21)[0]?.strength, "strong");
assert.equal(reasonsFor("warmCool", 0.23).length, 1);
assert.equal(poolFor("warmCool", 0.23)[0]?.strength, "moderate");
assert.equal(reasonsFor("warmCool", 0.34).length, 0);
assert.equal(reasonsFor("warmCool", 0.35).length, 0);
assert.equal(reasonsFor("warmCool", 0.65).length, 0);
assert.equal(reasonsFor("warmCool", 0.66).length, 1);
assert.equal(poolFor("warmCool", 0.77)[0]?.strength, "moderate");
assert.equal(poolFor("warmCool", 0.79)[0]?.strength, "strong");

assert.equal(reasonsFor("softSharp", null).length, 0);
assert.equal(reasonsFor("softSharp", undefined).length, 0);
assert.equal(reasonsFor("softSharp", Number.NaN).length, 0);
assert.equal(reasonsFor("softSharp", -1).length, 5);
assert.equal(
  findPoolAction(poolFor("softSharp", 2), "hair", "outlineDefinition")
    ?.strength,
  "strong"
);

const orderingPool = buildTargetActionPool({
  vector: {
    softSharp: 0.8,
    naturalPolished: 0.8,
    playfulMature: 0.8,
    minimalStatement: 0.9,
    warmCool: 0.8,
    classicTrendy: 0.8
  }
});
const orderingReasons = orderingPool.map((item) => item.reason);
assert.ok(
  orderingReasons.indexOf("target_softSharp_high") <
    orderingReasons.indexOf("target_naturalPolished_high")
);
assert.ok(
  orderingReasons.indexOf("target_naturalPolished_high") <
    orderingReasons.indexOf("target_playfulMature_high")
);
assert.ok(
  orderingReasons.indexOf("target_playfulMature_high") <
    orderingReasons.indexOf("target_minimalStatement_high")
);
assert.ok(
  orderingReasons.indexOf("target_minimalStatement_high") <
    orderingReasons.indexOf("target_warmCool_cool")
);
assert.ok(
  orderingReasons.indexOf("target_warmCool_cool") <
    orderingReasons.indexOf("target_classicTrendy_high")
);

const mutationPool = buildTargetActionPool({
  vector: {
    softSharp: 0.8,
    naturalPolished: 0.5,
    playfulMature: 0.5,
    minimalStatement: 0.9,
    warmCool: 0.5,
    classicTrendy: 0.5
  }
});
const mutationSnapshot = structuredClone(mutationPool);
applyCurrentFaceModifiers(mutationPool, {
  keyFeatures: [
    { key: "eyeDirection", direction: "upturned" },
    { key: "featureContrast", direction: "high" },
    { key: "contourDefinition", direction: "defined" },
    { key: "straightCurveBalance", direction: "curved" }
  ]
});
assert.deepEqual(
  mutationPool,
  mutationSnapshot,
  "current face modifier must not mutate the shared Target Action Pool"
);

const sharpModified = applyCurrentFaceModifiers(
  poolFor("softSharp", 0.8),
  {
    keyFeatures: [
      { key: "eyeDirection", direction: "upturned" },
      { key: "contourDefinition", direction: "defined" }
    ]
  }
);
const eyeModified = findPoolAction(
  sharpModified.actions,
  "makeup",
  "eyeDefinition"
);
assert.deepEqual(
  {
    direction: eyeModified?.direction,
    strength: eyeModified?.strength,
    reason: eyeModified?.reason,
    evidence: eyeModified?.evidence
  },
  {
    direction: "increase",
    strength: "light",
    reason: "face_modifier_eye_direction_already_upturned",
    evidence: [
      "target_axis:softSharp",
      "face_feature:eyeDirection=upturned"
    ]
  }
);
const outlineModified = findPoolAction(
  sharpModified.actions,
  "hair",
  "outlineDefinition"
);
assert.deepEqual(
  {
    direction: outlineModified?.direction,
    strength: outlineModified?.strength,
    reason: outlineModified?.reason,
    evidence: outlineModified?.evidence
  },
  {
    direction: "maintain",
    strength: "light",
    reason: "face_modifier_contour_already_defined",
    evidence: [
      "target_axis:softSharp",
      "face_feature:contourDefinition=defined"
    ]
  }
);
assert.deepEqual(
  sharpModified.conflicts,
  [
    {
      type: "over_amplification_guard",
      domains: ["makeup"],
      description:
        "이미 상향 흐름이 보이는 눈매에 추가 상승 방향을 중첩하지 않습니다.",
      resolution:
        "상승 각도 대신 눈의 선명도와 길이 쪽으로 이동합니다."
    }
  ]
);

const statementModified = applyCurrentFaceModifiers(
  poolFor("minimalStatement", 0.9),
  {
    keyFeatures: [
      { key: "featureContrast", direction: "high" }
    ]
  }
);
const contrastModified = findPoolAction(
  statementModified.actions,
  "makeup",
  "selectedFeatureContrast"
);
assert.deepEqual(
  {
    direction: contrastModified?.direction,
    strength: contrastModified?.strength,
    reason: contrastModified?.reason,
    evidence: contrastModified?.evidence
  },
  {
    direction: "increase",
    strength: "light",
    reason: "face_modifier_existing_feature_contrast_high",
    evidence: [
      "target_axis:minimalStatement",
      "face_feature:featureContrast=high"
    ]
  }
);
assert.equal(statementModified.conflicts.length, 1);
assert.equal(statementModified.conflicts[0]?.type, "contrast_guard");

const softModified = applyCurrentFaceModifiers(
  poolFor("softSharp", 0.2),
  {
    keyFeatures: [
      { key: "straightCurveBalance", direction: "curved" }
    ]
  }
);
const curvatureModified = findPoolAction(
  softModified.actions,
  "hair",
  "curvature"
);
assert.deepEqual(
  {
    direction: curvatureModified?.direction,
    strength: curvatureModified?.strength,
    reason: curvatureModified?.reason,
    evidence: curvatureModified?.evidence
  },
  {
    direction: "maintain",
    strength: "light",
    reason: "face_modifier_line_already_curved",
    evidence: [
      "target_axis:softSharp",
      "face_feature:straightCurveBalance=curved"
    ]
  }
);

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
