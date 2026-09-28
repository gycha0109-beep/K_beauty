import { createHash } from "node:crypto";
import {
  FACE_LAB_OBSERVATION_DEFINITIONS,
  buildFaceLabObservationAnalysis
} from "../../face-lab-observation-contract.js";
import { buildFaceLabV2Canonical } from "../canonical-composer.js";
import { FACE_LAB_V2_EVALUATION_CONTRACT_VERSION } from "./contracts.js";

export const FACE_LAB_V2_FACE_RESPONSIVENESS_VERSION =
  "face-lab-v2-face-responsiveness-evaluator-v1";

const ALL_STYLING_DOMAINS = Object.freeze([
  "hair",
  "brow_grooming",
  "makeup",
  "color",
  "eyewear",
  "accessories",
  "facial_hair"
]);

const PROFILE_CONSUMED_FIELDS = new Set([
  "outline.faceShape",
  "outline.foreheadWidthVsCheek",
  "outline.jawWidthVsCheek",
  "outline.jawlineAngularity",
  "outline.jawTaper",
  "outline.cheekboneProminence",
  "vertical.faceLengthBalance",
  "vertical.foreheadHeight",
  "vertical.midfaceLength",
  "vertical.lowerFaceLength",
  "eyes.eyeDirection",
  "eyes.eyeLength",
  "eyes.eyeOpenness",
  "featureLayout.featureScale",
  "featureLayout.featureConcentration",
  "featureLayout.focalFeatures",
  "visualLanguage.straightCurveBalance",
  "visualLanguage.contourDefinition",
  "visualLanguage.featureContrast"
]);

const OBSERVED_NOT_PROFILE_FIELDS = new Set([
  "colorAppearance.apparentTemperature",
  "colorAppearance.apparentBrightness",
  "colorAppearance.apparentSaturation"
]);

const MODIFIER_CONTRACTS = Object.freeze([
  Object.freeze({
    fieldPath: "eyes.eyeDirection",
    targetKey: "chic",
    stylingScope: ["makeup"],
    baselineValue: "level",
    variantValue: "upturned",
    expectedBaseline: {
      domain: "makeup",
      parameter: "outerEyeEmphasis",
      direction: "increase",
      strength: "moderate",
      reason: "target_softSharp_high"
    },
    expectedVariant: {
      domain: "makeup",
      parameter: "eyeDefinition",
      direction: "increase",
      strength: "light",
      reason: "face_modifier_eye_direction_already_upturned",
      evidence: "face_feature:eyeDirection=upturned"
    }
  }),
  Object.freeze({
    fieldPath: "visualLanguage.featureContrast",
    targetKey: "statement_glam",
    stylingScope: ["makeup"],
    baselineValue: "medium",
    variantValue: "high",
    expectedBaseline: {
      domain: "makeup",
      parameter: "selectedFeatureContrast",
      direction: "increase",
      strength: "strong",
      reason: "target_minimalStatement_high"
    },
    expectedVariant: {
      domain: "makeup",
      parameter: "selectedFeatureContrast",
      direction: "increase",
      strength: "light",
      reason: "face_modifier_existing_feature_contrast_high",
      evidence: "face_feature:featureContrast=high"
    }
  }),
  Object.freeze({
    fieldPath: "visualLanguage.contourDefinition",
    targetKey: "chic",
    stylingScope: ["hair"],
    baselineValue: "moderate",
    variantValue: "defined",
    expectedBaseline: {
      domain: "hair",
      parameter: "outlineDefinition",
      direction: "increase",
      strength: "strong",
      reason: "target_softSharp_high"
    },
    expectedVariant: {
      domain: "hair",
      parameter: "outlineDefinition",
      direction: "maintain",
      strength: "light",
      reason: "face_modifier_contour_already_defined",
      evidence: "face_feature:contourDefinition=defined"
    }
  }),
  Object.freeze({
    fieldPath: "visualLanguage.straightCurveBalance",
    targetKey: "soft",
    stylingScope: ["hair"],
    baselineValue: "balanced",
    variantValue: "curved",
    expectedBaseline: {
      domain: "hair",
      parameter: "curvature",
      direction: "increase",
      strength: "moderate",
      reason: "target_softSharp_low"
    },
    expectedVariant: {
      domain: "hair",
      parameter: "curvature",
      direction: "maintain",
      strength: "light",
      reason: "face_modifier_line_already_curved",
      evidence: "face_feature:straightCurveBalance=curved"
    }
  })
]);

const MODIFIER_BY_FIELD = new Map(
  MODIFIER_CONTRACTS.map((item) => [item.fieldPath, item])
);

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

function clone(value) {
  return structuredClone(value);
}

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
        evidence: ["face-responsiveness:" + fieldPath],
        unavailableReason: null
      };
    }
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
      evidence: ["face-responsiveness:quality"]
    },
    observations
  };
}

function setRawObservationValue(raw, fieldPath, value) {
  const [group, key] = fieldPath.split(".");
  const next = clone(raw);
  next.observations[group][key].value = Array.isArray(value)
    ? [...value]
    : value;
  return next;
}

function buildAnalysis(raw) {
  return buildFaceLabObservationAnalysis(raw, {
    eligibility: { faceLabEligible: true },
    provider: "evaluation_fixture",
    model: "face-lab-v2-face-responsiveness-v1"
  });
}

function buildSurvey(caseId, targetKey, stylingScope) {
  return {
    schemaVersion: "face-lab-target-style-survey-v1",
    entryMode: "known",
    targetSelections: [targetKey],
    clarifiers: {
      softSharp: null,
      naturalPolished: null
    },
    presentationPreference: "neutral_examples",
    stylingScope: [...stylingScope],
    changeTolerance: "moderate",
    contexts: ["daily"],
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
    approvedAt: "2026-09-28T00:00:00.000Z",
    evaluationCaseId: caseId
  };
}

function fieldRole(fieldPath) {
  if (MODIFIER_BY_FIELD.has(fieldPath)) return "recommendation_modifier";
  if (PROFILE_CONSUMED_FIELDS.has(fieldPath)) return "profile_only";
  if (OBSERVED_NOT_PROFILE_FIELDS.has(fieldPath)) return "observed_not_profile_consumed";
  return "unknown";
}

export function buildFaceLabV2FaceObservationInventory() {
  const rows = [];

  for (const [group, fields] of Object.entries(FACE_LAB_OBSERVATION_DEFINITIONS)) {
    for (const [key, values] of Object.entries(fields)) {
      const fieldPath = group + "." + key;
      rows.push({
        fieldPath,
        role: fieldRole(fieldPath),
        allowedValues: [...values],
        modifierContract: MODIFIER_BY_FIELD.get(fieldPath) || null
      });
    }
  }

  return rows;
}

function pairValues(row) {
  const contract = row.modifierContract;
  if (contract) {
    return {
      baselineValue: contract.baselineValue,
      variantValue: contract.variantValue
    };
  }

  const arrayField = row.fieldPath === "featureLayout.focalFeatures";
  return {
    baselineValue: arrayField ? [row.allowedValues[0]] : row.allowedValues[0],
    variantValue: arrayField ? [row.allowedValues[1]] : row.allowedValues[1]
  };
}

function rawValueDiffs(left, right) {
  const diffs = [];

  for (const [group, fields] of Object.entries(FACE_LAB_OBSERVATION_DEFINITIONS)) {
    for (const key of Object.keys(fields)) {
      const fieldPath = group + "." + key;
      const leftValue = left.observations[group][key].value;
      const rightValue = right.observations[group][key].value;
      if (stableStringify(leftValue) !== stableStringify(rightValue)) {
        diffs.push(fieldPath);
      }
    }
  }

  return diffs;
}

function activePriorities(canonical) {
  return (canonical?.styleDelta?.priorities || []).filter(
    (item) => item?.constraintState !== "blocked"
  );
}

function activeStyleDeltaSignature(canonical) {
  return activePriorities(canonical)
    .map((item) =>
      [
        item.domain,
        item.parameter,
        item.direction,
        item.strength,
        item.reason || "",
        (item.evidence || []).slice().sort().join(",")
      ].join(":")
    )
    .sort()
    .join("|");
}

function selectedRoute(canonical) {
  return (canonical?.routes?.routes || []).find(
    (route) => route.routeId === canonical?.routes?.selectedRouteId
  ) || null;
}

function selectedRouteSignature(canonical) {
  const route = selectedRoute(canonical);
  if (!route) return "NO_ROUTE";

  const actions = (route.actions || [])
    .map((item) =>
      [
        item.domain,
        item.parameter,
        item.direction,
        item.strength,
        item.reason || "",
        (item.evidence || []).slice().sort().join(",")
      ].join(":")
    )
    .sort()
    .join("|");

  return (route.strategy || route.routeId) + "::" + actions;
}

function findAction(canonical, expected) {
  return activePriorities(canonical).find(
    (item) =>
      item.domain === expected.domain &&
      item.parameter === expected.parameter
  ) || null;
}

function actionMatches(action, expected) {
  if (!action) return false;
  if (action.domain !== expected.domain) return false;
  if (action.parameter !== expected.parameter) return false;
  if (action.direction !== expected.direction) return false;
  if (action.strength !== expected.strength) return false;
  if (action.reason !== expected.reason) return false;
  if (
    expected.evidence &&
    !(action.evidence || []).includes(expected.evidence)
  ) {
    return false;
  }
  return true;
}

function profileFieldValue(profile, fieldPath) {
  const key = fieldPath.split(".")[1];
  const keyFeature = (profile?.keyFeatures || []).find((item) => item.key === key);
  if (keyFeature) return keyFeature.direction;

  const structural = profile?.structuralProfile?.values;
  if (structural && Object.prototype.hasOwnProperty.call(structural, key)) {
    return structural[key];
  }

  return null;
}

function addFailure(failures, {
  pairId,
  fieldPath,
  evaluatorId,
  expected,
  observed
}) {
  const payload = {
    pairId,
    fieldPath,
    evaluatorId,
    severity: "hard",
    expected,
    observed
  };

  failures.push({
    ...payload,
    fingerprint: fingerprint(payload)
  });
}

function evaluatePair(row, pairIndex, failures) {
  const pairId = "FL-FACE-RESP-" + String(pairIndex + 1).padStart(3, "0");
  const contract = row.modifierContract;
  const role = row.role;
  const values = pairValues(row);
  const targetKey = contract?.targetKey || "chic";
  const stylingScope = contract?.stylingScope || ALL_STYLING_DOMAINS;
  const surveyAnswers = buildSurvey(pairId, targetKey, stylingScope);

  const neutralRaw = buildNeutralRawObservation();
  const baselineRaw = setRawObservationValue(
    neutralRaw,
    row.fieldPath,
    values.baselineValue
  );
  const variantRaw = setRawObservationValue(
    neutralRaw,
    row.fieldPath,
    values.variantValue
  );

  const diffs = rawValueDiffs(baselineRaw, variantRaw);
  if (diffs.length !== 1 || diffs[0] !== row.fieldPath) {
    addFailure(failures, {
      pairId,
      fieldPath: row.fieldPath,
      evaluatorId: "E7-controlled-face-mutation",
      expected: [row.fieldPath],
      observed: diffs
    });
  }

  const baselineAnalysis = buildAnalysis(baselineRaw);
  const variantAnalysis = buildAnalysis(variantRaw);

  const baseline = buildFaceLabV2Canonical({
    analysis: baselineAnalysis,
    surveyAnswers,
    resultId: pairId + "-baseline"
  });
  const variant = buildFaceLabV2Canonical({
    analysis: variantAnalysis,
    surveyAnswers,
    resultId: pairId + "-variant"
  });

  if (stableStringify(baseline.targetStyle) !== stableStringify(variant.targetStyle)) {
    addFailure(failures, {
      pairId,
      fieldPath: row.fieldPath,
      evaluatorId: "E7-target-invariance",
      expected: "targetStyle unchanged under face-only mutation",
      observed: {
        baseline: baseline.targetStyle,
        variant: variant.targetStyle
      }
    });
  }

  const baselineStyleDeltaSignature = activeStyleDeltaSignature(baseline);
  const variantStyleDeltaSignature = activeStyleDeltaSignature(variant);
  const baselineRouteSignature = selectedRouteSignature(baseline);
  const variantRouteSignature = selectedRouteSignature(variant);

  if (role === "recommendation_modifier") {
    const baselineAction = findAction(baseline, contract.expectedBaseline);
    const variantAction = findAction(variant, contract.expectedVariant);

    if (!actionMatches(baselineAction, contract.expectedBaseline)) {
      addFailure(failures, {
        pairId,
        fieldPath: row.fieldPath,
        evaluatorId: "E7-modifier-baseline-contract",
        expected: contract.expectedBaseline,
        observed: baselineAction
      });
    }

    if (!actionMatches(variantAction, contract.expectedVariant)) {
      addFailure(failures, {
        pairId,
        fieldPath: row.fieldPath,
        evaluatorId: "E7-modifier-variant-contract",
        expected: contract.expectedVariant,
        observed: variantAction
      });
    }

    if (baselineStyleDeltaSignature === variantStyleDeltaSignature) {
      addFailure(failures, {
        pairId,
        fieldPath: row.fieldPath,
        evaluatorId: "E7-style-delta-face-responsiveness",
        expected: "style-delta action semantics change for modifier-backed observation",
        observed: baselineStyleDeltaSignature
      });
    }

    if (baselineRouteSignature === variantRouteSignature) {
      addFailure(failures, {
        pairId,
        fieldPath: row.fieldPath,
        evaluatorId: "E7-route-face-responsiveness",
        expected: "selected route action semantics change for modifier-backed observation",
        observed: baselineRouteSignature
      });
    }
  } else {
    if (baselineStyleDeltaSignature !== variantStyleDeltaSignature) {
      addFailure(failures, {
        pairId,
        fieldPath: row.fieldPath,
        evaluatorId: "E7-non-authority-style-delta-leakage",
        expected: "current non-authority observation value does not alter active style-delta actions",
        observed: {
          baseline: baselineStyleDeltaSignature,
          variant: variantStyleDeltaSignature
        }
      });
    }

    if (baselineRouteSignature !== variantRouteSignature) {
      addFailure(failures, {
        pairId,
        fieldPath: row.fieldPath,
        evaluatorId: "E7-non-authority-route-leakage",
        expected: "current non-authority observation value does not alter selected route actions",
        observed: {
          baseline: baselineRouteSignature,
          variant: variantRouteSignature
        }
      });
    }
  }

  return {
    pairId,
    fieldPath: row.fieldPath,
    role,
    targetKey,
    stylingScope: [...stylingScope],
    baselineValue: values.baselineValue,
    variantValue: values.variantValue,
    rawMutationDiffs: diffs,
    baselineProfileValue: profileFieldValue(
      baseline.currentFaceProfile,
      row.fieldPath
    ),
    variantProfileValue: profileFieldValue(
      variant.currentFaceProfile,
      row.fieldPath
    ),
    currentFaceProfileChanged:
      stableStringify(baseline.currentFaceProfile) !==
      stableStringify(variant.currentFaceProfile),
    styleDeltaChanged:
      baselineStyleDeltaSignature !== variantStyleDeltaSignature,
    selectedRouteChanged:
      baselineRouteSignature !== variantRouteSignature,
    baselineStyleDeltaSignature,
    variantStyleDeltaSignature,
    baselineRouteSignature,
    variantRouteSignature
  };
}

export function runFaceLabV2FaceResponsivenessEvaluation() {
  const failures = [];
  const inventory = buildFaceLabV2FaceObservationInventory();

  const unknownFields = inventory.filter((row) => row.role === "unknown");
  if (unknownFields.length) {
    addFailure(failures, {
      pairId: "inventory",
      fieldPath: null,
      evaluatorId: "E7-observation-inventory-unknown",
      expected: "every observation field explicitly classified",
      observed: unknownFields.map((row) => row.fieldPath)
    });
  }

  const diagnostics = inventory.map((row, index) =>
    evaluatePair(row, index, failures)
  );

  const recommendationModifierCount = inventory.filter(
    (row) => row.role === "recommendation_modifier"
  ).length;
  const profileOnlyCount = inventory.filter(
    (row) => row.role === "profile_only"
  ).length;
  const observedNotProfileCount = inventory.filter(
    (row) => row.role === "observed_not_profile_consumed"
  ).length;

  const expectedCounts = {
    observationFieldCount: 22,
    recommendationModifierCount: 4,
    profileOnlyCount: 15,
    observedNotProfileCount: 3
  };
  const observedCounts = {
    observationFieldCount: inventory.length,
    recommendationModifierCount,
    profileOnlyCount,
    observedNotProfileCount
  };

  if (stableStringify(expectedCounts) !== stableStringify(observedCounts)) {
    addFailure(failures, {
      pairId: "inventory",
      fieldPath: null,
      evaluatorId: "E7-observation-inventory-count",
      expected: expectedCounts,
      observed: observedCounts
    });
  }

  return {
    reportVersion: "face-lab-v2-face-responsiveness-report-v1",
    evaluatorVersion: FACE_LAB_V2_FACE_RESPONSIVENESS_VERSION,
    contractVersion: FACE_LAB_V2_EVALUATION_CONTRACT_VERSION,
    authorityInventory: inventory,
    summary: {
      pairedComparisonCount: diagnostics.length,
      recommendationModifierPairCount: recommendationModifierCount,
      nonAuthorityPairCount:
        diagnostics.length - recommendationModifierCount,
      profileOnlyPairCount: profileOnlyCount,
      observedNotProfilePairCount: observedNotProfileCount,
      styleDeltaChangedPairCount: diagnostics.filter(
        (row) => row.styleDeltaChanged
      ).length,
      selectedRouteChangedPairCount: diagnostics.filter(
        (row) => row.selectedRouteChanged
      ).length,
      currentFaceProfileChangedPairCount: diagnostics.filter(
        (row) => row.currentFaceProfileChanged
      ).length,
      hardFailureCount: failures.length
    },
    diagnostics,
    failures
  };
}
