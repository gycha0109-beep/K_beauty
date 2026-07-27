import { FACE_LAB_ARCHETYPE_REGISTRY } from "./face-lab-archetype-registry.js";
import {
  evaluateFaceLabArchetypeCalibration,
  validateFaceLabArchetypeCalibrationDataset,
  validateFaceLabArchetypeCalibrationPolicySet
} from "./face-lab-archetype-calibration.js";

export const FACE_LAB_ARCHETYPE_CALIBRATION_GOVERNANCE_SCHEMA_VERSION =
  "face-lab-archetype-calibration-governance-v1";

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertAllowedKeys(value, allowedKeys, label) {
  if (!isObject(value)) throw new Error(`${label} must be an object`);
  const unknown = Object.keys(value).filter((key) => !allowedKeys.includes(key));
  if (unknown.length) throw new Error(`${label} contains unsupported keys: ${unknown.sort().join(",")}`);
}

function validateDatasetGovernance(dataset) {
  assertAllowedKeys(dataset, [
    "schemaVersion",
    "datasetId",
    "registryVersion",
    "labelProtocolVersion",
    "labelingMode",
    "labelsFrozenBeforePolicyEvaluation",
    "datasetStage",
    "minimumSliceSize",
    "privacy",
    "samples"
  ], "dataset");
  if (dataset.labelingMode !== "blind_to_model_scores") {
    throw new Error("labelingMode must be blind_to_model_scores");
  }
  if (dataset.labelsFrozenBeforePolicyEvaluation !== true) {
    throw new Error("labelsFrozenBeforePolicyEvaluation must be true");
  }
  if (!Array.isArray(dataset.samples)) throw new Error("dataset.samples must be an array");

  const samples = dataset.samples.map((sample, index) => {
    const label = `samples[${index}]`;
    assertAllowedKeys(sample, [
      "sampleId",
      "subjectId",
      "split",
      "consentConfirmed",
      "auditSliceConsentConfirmed",
      "conditionTags",
      "auditSlices",
      "label",
      "scoring"
    ], label);
    if (!isObject(sample.auditSlices)) throw new Error(`${label}.auditSlices must be an object`);
    const hasSensitiveSlice = Object.values(sample.auditSlices).some((value) => value !== "unknown");
    if (hasSensitiveSlice && sample.auditSliceConsentConfirmed !== true) {
      throw new Error(`${label}.auditSliceConsentConfirmed must be true for non-unknown audit slices`);
    }
    return {
      sampleId: sample.sampleId,
      subjectId: sample.subjectId,
      split: sample.split,
      consentConfirmed: sample.consentConfirmed,
      conditionTags: sample.conditionTags,
      auditSlices: sample.auditSlices,
      label: sample.label,
      scoring: sample.scoring
    };
  });

  return {
    schemaVersion: dataset.schemaVersion,
    datasetId: dataset.datasetId,
    registryVersion: dataset.registryVersion,
    labelProtocolVersion: dataset.labelProtocolVersion,
    datasetStage: dataset.datasetStage,
    minimumSliceSize: dataset.minimumSliceSize,
    privacy: dataset.privacy,
    samples
  };
}

function validatePolicyGovernance(policySet) {
  assertAllowedKeys(policySet, [
    "schemaVersion",
    "policySetId",
    "registryVersion",
    "selectionProtocol",
    "candidatesFrozenBeforeEvaluation",
    "policies"
  ], "policySet");
  if (
    policySet.selectionProtocol !== "manual_predeclared" ||
    policySet.candidatesFrozenBeforeEvaluation !== true
  ) {
    throw new Error("policy candidates must be manually predeclared and frozen before evaluation");
  }
  return {
    schemaVersion: policySet.schemaVersion,
    policySetId: policySet.policySetId,
    registryVersion: policySet.registryVersion,
    policies: policySet.policies
  };
}

function round(value) {
  return Number((Number(value) || 0).toFixed(6));
}

function ratio(numerator, denominator) {
  return denominator > 0 ? round(numerator / denominator) : null;
}

function applyPolicy(sample, policy) {
  const [top, second] = sample.scoring.candidates;
  const holdReasons = [];
  if (!sample.scoring.analysisUsable) holdReasons.push("insufficient_quality");
  if (!top || top.rawScore <= 0) holdReasons.push("low_top_score");
  if (top?.missingRequiredPaths?.length) holdReasons.push("missing_required_axis");
  if (top && top.evidenceCoverage < policy.minimumEvidenceCoverage) holdReasons.push("low_evidence");
  if (top && top.rawScore < policy.minimumTopScore) holdReasons.push("low_top_score");
  const topMargin = top ? round(top.rawScore - (second?.rawScore || 0)) : 0;
  if (top && topMargin < policy.minimumTopMargin) holdReasons.push("low_top_margin");
  if (top && top.contradictionCount > policy.maximumContradictions) holdReasons.push("contradiction");
  const held = holdReasons.length > 0;
  return {
    sampleId: sample.sampleId,
    predictedKey: held ? null : top.key,
    held,
    holdReasons: [...new Set(holdReasons)]
  };
}

function buildAdjacentPairMetrics(samples, policy) {
  const predictions = new Map(samples.map((sample) => [sample.sampleId, applyPolicy(sample, policy)]));
  const pairKeys = [...new Set(samples
    .filter((sample) => sample.label.disposition === "archetype" && sample.label.adjacentPair.length === 2)
    .map((sample) => sample.label.adjacentPair.join("__")))].sort();

  return Object.fromEntries(pairKeys.map((pairKey) => {
    const pairSamples = samples.filter((sample) =>
      sample.label.disposition === "archetype" && sample.label.adjacentPair.join("__") === pairKey
    );
    let correctReleases = 0;
    let adjacentWrongReleases = 0;
    let otherWrongReleases = 0;
    let held = 0;
    for (const sample of pairSamples) {
      const prediction = predictions.get(sample.sampleId);
      if (prediction.held) held += 1;
      else if (sample.label.acceptableTopCandidates.includes(prediction.predictedKey)) correctReleases += 1;
      else if (sample.label.adjacentPair.includes(prediction.predictedKey)) adjacentWrongReleases += 1;
      else otherWrongReleases += 1;
    }
    const totalWrongReleases = adjacentWrongReleases + otherWrongReleases;
    return [pairKey, {
      sampleCount: pairSamples.length,
      correctReleases,
      adjacentWrongReleases,
      otherWrongReleases,
      totalWrongReleases,
      held,
      adjacentWrongReleaseRate: ratio(adjacentWrongReleases, pairSamples.length),
      totalWrongReleaseRate: ratio(totalWrongReleases, pairSamples.length)
    }];
  }));
}

function sanitizeSliceMetrics(sliceMetrics) {
  const visible = {};
  const suppression = {};
  for (const [dimension, groups] of Object.entries(sliceMetrics || {})) {
    const visibleEntries = Object.entries(groups || {}).filter(([, entry]) => entry?.suppressed === false);
    const suppressedGroupCount = Object.values(groups || {}).filter((entry) => entry?.suppressed === true).length;
    visible[dimension] = Object.fromEntries(visibleEntries);
    suppression[dimension] = { suppressedGroupCount };
  }
  return { visible, suppression };
}

export function validateFaceLabArchetypeCalibrationGovernance({
  dataset,
  policySet,
  registry = FACE_LAB_ARCHETYPE_REGISTRY
} = {}) {
  const coreDataset = validateDatasetGovernance(dataset);
  const corePolicySet = validatePolicyGovernance(policySet);
  return {
    dataset: validateFaceLabArchetypeCalibrationDataset(coreDataset, registry),
    policySet: validateFaceLabArchetypeCalibrationPolicySet(corePolicySet, registry)
  };
}

export function evaluateFaceLabArchetypeCalibrationGoverned({
  dataset,
  policySet,
  split = "validation",
  allowHoldout = false,
  registry = FACE_LAB_ARCHETYPE_REGISTRY
} = {}) {
  const governed = validateFaceLabArchetypeCalibrationGovernance({ dataset, policySet, registry });
  const report = evaluateFaceLabArchetypeCalibration({
    dataset: governed.dataset,
    policySet: governed.policySet,
    split,
    allowHoldout,
    registry
  });
  const samples = governed.dataset.samples.filter((sample) => sample.split === split);
  return {
    ...report,
    governanceSchemaVersion: FACE_LAB_ARCHETYPE_CALIBRATION_GOVERNANCE_SCHEMA_VERSION,
    labelingMode: "blind_to_model_scores",
    labelsFrozenBeforePolicyEvaluation: true,
    auditSliceConsentEnforced: true,
    suppressedSliceIdentitiesHidden: true,
    policySelectionProtocol: "manual_predeclared",
    policyCandidatesFrozenBeforeEvaluation: true,
    policyResults: report.policyResults.map((result) => {
      const sanitizedSlices = sanitizeSliceMetrics(result.sliceMetrics);
      return {
        ...result,
        adjacentPairMetrics: buildAdjacentPairMetrics(samples, result.policy),
        sliceMetrics: sanitizedSlices.visible,
        sliceSuppression: sanitizedSlices.suppression
      };
    })
  };
}
