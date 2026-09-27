import { createHash } from "node:crypto";
import {
  FACE_LAB_OBSERVATION_DEFINITIONS,
  buildFaceLabObservationAnalysis
} from "../../face-lab-observation-contract.js";
import { buildFaceLabV2Canonical } from "../canonical-composer.js";
import { TARGET_STYLE_REGISTRY } from "../target-style-registry.js";
import {
  FACE_LAB_V2_EVALUATION_CONTRACT_VERSION,
  FACE_LAB_V2_TARGET_CONTRAST_PAIRS,
  FACE_LAB_V2_TARGET_SWEEP_COHORT_VERSION,
  FACE_LAB_V2_TARGET_SWEEP_FACE_COUNT,
  FACE_LAB_V2_TARGET_SWEEP_SEED
} from "./contracts.js";

export const FACE_LAB_V2_TARGET_RESPONSIVENESS_VERSION =
  "face-lab-v2-target-responsiveness-evaluator-v1";

const TARGET_KEYS = Object.freeze(Object.keys(TARGET_STYLE_REGISTRY));
const STYLING_SCOPE = Object.freeze([
  "hair",
  "brow_grooming",
  "makeup",
  "color",
  "eyewear",
  "accessories",
  "facial_hair"
]);

function fnv1a32(value) {
  let hash = 0x811c9dc5;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(values, random) {
  return values[Math.floor(random() * values.length)];
}

function pickUnique(values, count, random) {
  const pool = [...values];
  const result = [];
  while (pool.length && result.length < count) {
    const index = Math.floor(random() * pool.length);
    result.push(pool.splice(index, 1)[0]);
  }
  return result;
}

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

function buildRawObservation(faceGroupId, random) {
  const observations = {};

  for (const [group, fields] of Object.entries(FACE_LAB_OBSERVATION_DEFINITIONS)) {
    observations[group] = {};
    for (const [key, values] of Object.entries(fields)) {
      const arrayField = group === "featureLayout" && key === "focalFeatures";
      observations[group][key] = {
        value: arrayField
          ? pickUnique(values, random() > 0.6 ? 2 : 1, random)
          : pick(values, random),
        visibility: "clear",
        evidence: [`target-sweep:${faceGroupId}:${group}.${key}`],
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
      evidence: [`target-sweep:${faceGroupId}:quality`]
    },
    observations
  };
}

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
    stylingScope: [...STYLING_SCOPE],
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

export function buildFaceLabV2TargetSweepCohort({
  seed = FACE_LAB_V2_TARGET_SWEEP_SEED,
  faceCount = FACE_LAB_V2_TARGET_SWEEP_FACE_COUNT
} = {}) {
  const random = mulberry32(fnv1a32(seed));
  const cases = [];
  const boundedFaceCount = Math.max(1, Math.min(faceCount, 64));

  for (let faceIndex = 0; faceIndex < boundedFaceCount; faceIndex += 1) {
    const faceGroupId = `FL-TS-FACE-${String(faceIndex + 1).padStart(3, "0")}`;
    const rawObservation = buildRawObservation(faceGroupId, random);
    const analysis = buildFaceLabObservationAnalysis(rawObservation, {
      eligibility: { faceLabEligible: true },
      provider: "evaluation_fixture",
      model: "face-lab-v2-target-sweep-v1"
    });

    for (let targetIndex = 0; targetIndex < TARGET_KEYS.length; targetIndex += 1) {
      const targetKey = TARGET_KEYS[targetIndex];
      const caseId =
        `FL-TS-${String(faceIndex + 1).padStart(3, "0")}-` +
        `${String(targetIndex + 1).padStart(2, "0")}`;

      cases.push({
        caseId,
        cohort: "TARGET_SWEEP",
        faceGroupId,
        targetKey,
        analysis,
        surveyAnswers: buildSurvey(caseId, targetKey),
        provenance: {
          source: "synthetic_structured_observation",
          generationIntentIsGroundTruth: false,
          samplingSemantics: "same_face_target_sweep_not_population_prevalence",
          seed,
          cohortVersion: FACE_LAB_V2_TARGET_SWEEP_COHORT_VERSION
        }
      });
    }
  }

  const cohortPayload = cases.map((item) => ({
    caseId: item.caseId,
    faceGroupId: item.faceGroupId,
    targetKey: item.targetKey,
    analysis: item.analysis,
    surveyAnswers: item.surveyAnswers
  }));

  return {
    cohortVersion: FACE_LAB_V2_TARGET_SWEEP_COHORT_VERSION,
    seed,
    faceCount: boundedFaceCount,
    targetCount: TARGET_KEYS.length,
    caseCount: cases.length,
    cohortHash: sha256(stableStringify(cohortPayload)),
    cases
  };
}

function activeStyleDeltaSignature(canonical) {
  const priorities = Array.isArray(canonical?.styleDelta?.priorities)
    ? canonical.styleDelta.priorities
    : [];

  return priorities
    .filter((item) => item?.constraintState !== "blocked")
    .map((item) =>
      [
        item.domain,
        item.parameter,
        item.direction,
        item.strength,
        item.reason || ""
      ].join(":")
    )
    .sort()
    .join("|");
}

function selectedRouteSignature(canonical) {
  const route = (canonical?.routes?.routes || []).find(
    (item) => item.routeId === canonical?.routes?.selectedRouteId
  );
  if (!route) return "NO_ROUTE";

  const actions = (route.actions || [])
    .map((item) =>
      [
        item.domain,
        item.parameter,
        item.direction,
        item.strength
      ].join(":")
    )
    .sort()
    .join("|");

  return `${route.strategy || route.routeId}::${actions}`;
}

function addFailure(failures, {
  caseId,
  faceGroupId,
  evaluatorId,
  expected,
  observed,
  severity = "hard"
}) {
  failures.push({
    caseId,
    faceGroupId,
    evaluatorId,
    severity,
    expected,
    observed,
    fingerprint: sha256(
      stableStringify({ evaluatorId, expected, observed })
    ).slice(0, 16)
  });
}

export function runFaceLabV2TargetResponsivenessEvaluation({
  seed = FACE_LAB_V2_TARGET_SWEEP_SEED,
  faceCount = FACE_LAB_V2_TARGET_SWEEP_FACE_COUNT
} = {}) {
  const cohort = buildFaceLabV2TargetSweepCohort({ seed, faceCount });
  const failures = [];
  const grouped = new Map();

  for (const caseDef of cohort.cases) {
    const canonical = buildFaceLabV2Canonical({
      analysis: caseDef.analysis,
      surveyAnswers: caseDef.surveyAnswers,
      resultId: caseDef.caseId
    });

    if (
      canonical.targetStyle?.status !== "available" ||
      !canonical.targetStyle?.targetLabels?.includes(caseDef.targetKey)
    ) {
      addFailure(failures, {
        caseId: caseDef.caseId,
        faceGroupId: caseDef.faceGroupId,
        evaluatorId: "E3-target-authority",
        expected: `confirmed target ${caseDef.targetKey}`,
        observed: canonical.targetStyle?.targetLabels || []
      });
    }

    const row = {
      caseId: caseDef.caseId,
      targetKey: caseDef.targetKey,
      canonicalStatus: canonical.status,
      styleDeltaSignature: activeStyleDeltaSignature(canonical),
      selectedRouteSignature: selectedRouteSignature(canonical),
      selectedRouteId: canonical.routes?.selectedRouteId || null
    };

    if (!grouped.has(caseDef.faceGroupId)) {
      grouped.set(caseDef.faceGroupId, []);
    }
    grouped.get(caseDef.faceGroupId).push(row);
  }

  const faceDiagnostics = [];
  let contrastPairComparisonCount = 0;
  let contrastPairCollisionCount = 0;
  let collapsedFaceCount = 0;
  let totalUniqueStyleDeltaSignatures = 0;
  let totalUniqueSelectedRouteSignatures = 0;

  for (const [faceGroupId, rows] of grouped.entries()) {
    const byTarget = new Map(rows.map((row) => [row.targetKey, row]));
    const uniqueStyleDeltaSignatureCount =
      new Set(rows.map((row) => row.styleDeltaSignature)).size;
    const uniqueSelectedRouteSignatureCount =
      new Set(rows.map((row) => row.selectedRouteSignature)).size;

    totalUniqueStyleDeltaSignatures += uniqueStyleDeltaSignatureCount;
    totalUniqueSelectedRouteSignatures += uniqueSelectedRouteSignatureCount;

    const pairCollisions = [];

    for (const [leftKey, rightKey] of FACE_LAB_V2_TARGET_CONTRAST_PAIRS) {
      const left = byTarget.get(leftKey);
      const right = byTarget.get(rightKey);
      if (!left || !right) continue;

      contrastPairComparisonCount += 1;
      if (left.styleDeltaSignature === right.styleDeltaSignature) {
        contrastPairCollisionCount += 1;
        pairCollisions.push({
          leftTarget: leftKey,
          rightTarget: rightKey,
          sharedStyleDeltaSignature: left.styleDeltaSignature
        });
      }
    }

    if (uniqueStyleDeltaSignatureCount <= 1) {
      collapsedFaceCount += 1;
      addFailure(failures, {
        caseId: rows[0]?.caseId || null,
        faceGroupId,
        evaluatorId: "E3-target-responsiveness-collapse",
        expected: "multiple style-delta signatures across confirmed targets",
        observed: uniqueStyleDeltaSignatureCount
      });
    }

    faceDiagnostics.push({
      faceGroupId,
      targetCount: rows.length,
      uniqueStyleDeltaSignatureCount,
      uniqueSelectedRouteSignatureCount,
      noRouteCount: rows.filter((row) => row.selectedRouteId === null).length,
      pairCollisions
    });
  }

  const hardFailures = failures.filter((item) => item.severity === "hard");

  return {
    reportVersion: "face-lab-v2-target-responsiveness-report-v1",
    evaluatorVersion: FACE_LAB_V2_TARGET_RESPONSIVENESS_VERSION,
    contractVersion: FACE_LAB_V2_EVALUATION_CONTRACT_VERSION,
    cohort: {
      version: cohort.cohortVersion,
      seed: cohort.seed,
      faceCount: cohort.faceCount,
      targetCount: cohort.targetCount,
      caseCount: cohort.caseCount,
      hash: cohort.cohortHash
    },
    summary: {
      hardFailureCount: hardFailures.length,
      collapsedFaceCount,
      contrastPairComparisonCount,
      contrastPairCollisionCount,
      averageUniqueStyleDeltaSignatures: Number(
        (totalUniqueStyleDeltaSignatures / cohort.faceCount).toFixed(3)
      ),
      averageUniqueSelectedRouteSignatures: Number(
        (totalUniqueSelectedRouteSignatures / cohort.faceCount).toFixed(3)
      )
    },
    faceDiagnostics,
    failures
  };
}
