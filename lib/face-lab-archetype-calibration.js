import { FACE_LAB_ARCHETYPE_REGISTRY } from "./face-lab-archetype-registry.js";

export const FACE_LAB_ARCHETYPE_CALIBRATION_DATASET_SCHEMA_VERSION =
  "face-lab-archetype-calibration-dataset-v1";
export const FACE_LAB_ARCHETYPE_CALIBRATION_POLICY_SET_SCHEMA_VERSION =
  "face-lab-archetype-calibration-policy-set-v1";
export const FACE_LAB_ARCHETYPE_CALIBRATION_REPORT_SCHEMA_VERSION =
  "face-lab-archetype-calibration-report-v1";

const SPLITS = new Set(["development", "validation", "holdout"]);
const DATASET_STAGES = new Set(["synthetic", "pilot", "calibration"]);
const LABEL_DISPOSITIONS = new Set(["archetype", "ambiguous", "hold"]);
const SEX_GROUPS = new Set(["female", "male", "intersex", "unknown"]);
const AGE_BANDS = new Set(["18_29", "30_44", "45_59", "60_plus", "unknown"]);
const SKIN_TONE_BANDS = new Set(["light", "medium", "deep", "unknown"]);
const MAKEUP_CONDITIONS = new Set(["none_or_light", "moderate", "heavy", "unknown"]);
const FORBIDDEN_KEYS = new Set([
  "name",
  "fullname",
  "email",
  "phone",
  "address",
  "accountid",
  "userid",
  "image",
  "imagepath",
  "imageurl",
  "base64",
  "buffer",
  "crop",
  "facecrop",
  "evidence",
  "providerresponse",
  "rawresponse",
  "authorization",
  "cookie",
  "secret"
]);

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertAllowedKeys(value, allowedKeys, label) {
  const unknownKeys = Object.keys(value).filter((key) => !allowedKeys.includes(key));
  if (unknownKeys.length) throw new Error(`${label} contains unsupported keys: ${unknownKeys.sort().join(",")}`);
}

function normalizeKey(value) {
  return String(value || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function assertNoForbiddenPayload(value, label = "value", seen = new WeakSet()) {
  if (typeof value === "string") {
    if (/^data:image\//i.test(value.trim()) || /;base64,/i.test(value)) {
      throw new Error(`${label} contains forbidden image payload`);
    }
    return;
  }
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenPayload(item, `${label}[${index}]`, seen));
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(normalizeKey(key))) {
      throw new Error(`${label} contains forbidden key: ${key}`);
    }
    assertNoForbiddenPayload(item, `${label}.${key}`, seen);
  }
}

function cleanId(value, label) {
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  const cleaned = value.trim();
  if (!/^[a-z0-9][a-z0-9._-]{0,79}$/i.test(cleaned)) {
    throw new Error(`${label} must use 1-80 safe identifier characters`);
  }
  return cleaned;
}

function cleanStringList(value, label, { min = 0, max = 32, safeTokens = false } = {}) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  const cleaned = [...new Set(value.map((item) => {
    if (typeof item !== "string") throw new Error(`${label} entries must be strings`);
    const cleaned = item.trim();
    if (cleaned.length > 160) throw new Error(`${label} entries must be at most 160 characters`);
    if (safeTokens && cleaned && !/^[a-z0-9][a-z0-9._-]{0,159}$/i.test(cleaned)) {
      throw new Error(`${label} entries must use safe token characters`);
    }
    return cleaned;
  }).filter(Boolean))];
  if (cleaned.length < min || cleaned.length > max) {
    throw new Error(`${label} must contain ${min}-${max} values`);
  }
  return cleaned;
}

function cleanUnit(value, label) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${label} must be a finite number from 0 to 1`);
  }
  return Number(value);
}

function cleanNonNegative(value, label) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative finite number`);
  }
  return Number(value);
}

function round(value) {
  return Number((Number(value) || 0).toFixed(6));
}

function ratio(numerator, denominator) {
  return denominator > 0 ? round(numerator / denominator) : null;
}

function getArchetypeKeys(registry) {
  if (!isObject(registry) || !Array.isArray(registry.archetypes) || !registry.archetypes.length) {
    throw new Error("archetype registry is invalid");
  }
  const keys = registry.archetypes.map((item) => cleanId(item?.key, "registry archetype key"));
  if (new Set(keys).size !== keys.length) throw new Error("archetype registry contains duplicate keys");
  return keys.sort();
}

function validateAuditSlices(value, label) {
  if (!isObject(value)) throw new Error(`${label} must be an object`);
  assertAllowedKeys(value, ["sexGroup", "ageBand", "skinToneBand", "makeupCondition"], label);
  if (!SEX_GROUPS.has(value.sexGroup)) throw new Error(`${label}.sexGroup is invalid`);
  if (!AGE_BANDS.has(value.ageBand)) throw new Error(`${label}.ageBand is invalid`);
  if (!SKIN_TONE_BANDS.has(value.skinToneBand)) throw new Error(`${label}.skinToneBand is invalid`);
  if (!MAKEUP_CONDITIONS.has(value.makeupCondition)) {
    throw new Error(`${label}.makeupCondition is invalid`);
  }
  return {
    sexGroup: value.sexGroup,
    ageBand: value.ageBand,
    skinToneBand: value.skinToneBand,
    makeupCondition: value.makeupCondition
  };
}

function validateLabel(value, label, archetypeKeys) {
  if (!isObject(value)) throw new Error(`${label} must be an object`);
  assertAllowedKeys(value, ["disposition", "acceptableTopCandidates", "reviewerCount", "agreement", "adjacentPair"], label);
  if (!LABEL_DISPOSITIONS.has(value.disposition)) throw new Error(`${label}.disposition is invalid`);
  const acceptableTopCandidates = cleanStringList(
    value.acceptableTopCandidates,
    `${label}.acceptableTopCandidates`,
    { min: value.disposition === "archetype" ? 1 : value.disposition === "ambiguous" ? 2 : 0, max: 3, safeTokens: true }
  );
  if (value.disposition === "hold" && acceptableTopCandidates.length !== 0) {
    throw new Error(`${label}.acceptableTopCandidates must be empty for hold labels`);
  }
  if (acceptableTopCandidates.some((key) => !archetypeKeys.includes(key))) {
    throw new Error(`${label}.acceptableTopCandidates contains an unknown archetype`);
  }
  if (!Number.isSafeInteger(value.reviewerCount) || value.reviewerCount < 2 || value.reviewerCount > 25) {
    throw new Error(`${label}.reviewerCount must be an integer from 2 to 25`);
  }
  const agreement = cleanUnit(value.agreement, `${label}.agreement`);
  const adjacentPair = value.adjacentPair === undefined
    ? []
    : cleanStringList(value.adjacentPair, `${label}.adjacentPair`, { min: 0, max: 2, safeTokens: true });
  if (adjacentPair.length === 1) throw new Error(`${label}.adjacentPair must be empty or contain two keys`);
  if (adjacentPair.some((key) => !archetypeKeys.includes(key))) {
    throw new Error(`${label}.adjacentPair contains an unknown archetype`);
  }
  if (adjacentPair.length === 2 && adjacentPair[0] === adjacentPair[1]) {
    throw new Error(`${label}.adjacentPair keys must be distinct`);
  }
  return {
    disposition: value.disposition,
    acceptableTopCandidates: acceptableTopCandidates.sort(),
    reviewerCount: value.reviewerCount,
    agreement,
    adjacentPair: adjacentPair.sort()
  };
}

function validateScoringSnapshot(value, label, registryVersion, archetypeKeys) {
  if (!isObject(value)) throw new Error(`${label} must be an object`);
  assertAllowedKeys(value, ["schemaVersion", "registryVersion", "analysisUsable", "qualityMultiplier", "candidates"], label);
  if (value.schemaVersion !== "face-lab-archetype-scoring-v1") {
    throw new Error(`${label}.schemaVersion is invalid`);
  }
  if (value.registryVersion !== registryVersion) {
    throw new Error(`${label}.registryVersion does not match the dataset`);
  }
  if (typeof value.analysisUsable !== "boolean") throw new Error(`${label}.analysisUsable must be boolean`);
  const qualityMultiplier = cleanUnit(value.qualityMultiplier, `${label}.qualityMultiplier`);
  if (!Array.isArray(value.candidates) || value.candidates.length !== archetypeKeys.length) {
    throw new Error(`${label}.candidates must contain the complete taxonomy`);
  }
  const candidateKeys = new Set();
  const candidates = value.candidates.map((candidate, index) => {
    const itemLabel = `${label}.candidates[${index}]`;
    if (!isObject(candidate)) throw new Error(`${itemLabel} must be an object`);
    assertAllowedKeys(candidate, ["key", "rawScore", "evidenceCoverage", "missingRequiredPaths", "contradictionCount"], itemLabel);
    const key = cleanId(candidate.key, `${itemLabel}.key`);
    if (!archetypeKeys.includes(key) || candidateKeys.has(key)) {
      throw new Error(`${itemLabel}.key is unknown or duplicated`);
    }
    candidateKeys.add(key);
    const rawScore = Number(candidate.rawScore);
    if (!Number.isFinite(rawScore)) throw new Error(`${itemLabel}.rawScore must be finite`);
    const evidenceCoverage = cleanUnit(candidate.evidenceCoverage, `${itemLabel}.evidenceCoverage`);
    const missingRequiredPaths = cleanStringList(
      candidate.missingRequiredPaths,
      `${itemLabel}.missingRequiredPaths`,
      { min: 0, max: 32, safeTokens: true }
    );
    if (!Number.isSafeInteger(candidate.contradictionCount) || candidate.contradictionCount < 0) {
      throw new Error(`${itemLabel}.contradictionCount must be a non-negative integer`);
    }
    return {
      key,
      rawScore: round(rawScore),
      evidenceCoverage,
      missingRequiredPaths: missingRequiredPaths.sort(),
      contradictionCount: candidate.contradictionCount
    };
  });
  const expectedOrder = [...candidates].sort(
    (left, right) => right.rawScore - left.rawScore || left.key.localeCompare(right.key)
  );
  if (candidates.some((candidate, index) => candidate.key !== expectedOrder[index].key)) {
    throw new Error(`${label}.candidates must be sorted by rawScore desc then key asc`);
  }
  if (!value.analysisUsable && candidates.some((candidate) => candidate.rawScore !== 0)) {
    throw new Error(`${label} cannot contain non-zero scores when analysisUsable is false`);
  }
  return {
    schemaVersion: "face-lab-archetype-scoring-v1",
    registryVersion,
    analysisUsable: value.analysisUsable,
    qualityMultiplier,
    candidates
  };
}

export function validateFaceLabArchetypeCalibrationDataset(
  dataset,
  registry = FACE_LAB_ARCHETYPE_REGISTRY
) {
  assertNoForbiddenPayload(dataset, "dataset");
  if (!isObject(dataset)) throw new Error("dataset must be an object");
  assertAllowedKeys(dataset, ["schemaVersion", "datasetId", "registryVersion", "labelProtocolVersion", "datasetStage", "minimumSliceSize", "privacy", "samples"], "dataset");
  if (dataset.schemaVersion !== FACE_LAB_ARCHETYPE_CALIBRATION_DATASET_SCHEMA_VERSION) {
    throw new Error("dataset schemaVersion is invalid");
  }
  const archetypeKeys = getArchetypeKeys(registry);
  const datasetId = cleanId(dataset.datasetId, "datasetId");
  const registryVersion = cleanId(dataset.registryVersion, "registryVersion");
  if (registryVersion !== registry.registryVersion) throw new Error("dataset registryVersion is not current");
  const labelProtocolVersion = cleanId(dataset.labelProtocolVersion, "labelProtocolVersion");
  if (!DATASET_STAGES.has(dataset.datasetStage)) throw new Error("datasetStage is invalid");
  const minimumAllowedSliceSize = dataset.datasetStage === "synthetic" ? 2 : 5;
  if (!Number.isSafeInteger(dataset.minimumSliceSize) || dataset.minimumSliceSize < minimumAllowedSliceSize || dataset.minimumSliceSize > 1000) {
    throw new Error(`minimumSliceSize must be an integer from ${minimumAllowedSliceSize} to 1000`);
  }
  const privacy = dataset.privacy;
  if (!isObject(privacy)) throw new Error("dataset privacy declaration is invalid");
  assertAllowedKeys(privacy, ["sourceImagesCommitted", "directIdentifiersExcluded", "minorSubjectsExcluded", "labelsSeparatedFromImages"], "dataset.privacy");
  if (
      privacy.sourceImagesCommitted !== false ||
      privacy.directIdentifiersExcluded !== true ||
      privacy.minorSubjectsExcluded !== true ||
      privacy.labelsSeparatedFromImages !== true) {
    throw new Error("dataset privacy declaration is invalid");
  }
  if (!Array.isArray(dataset.samples) || !dataset.samples.length) {
    throw new Error("dataset.samples must be a non-empty array");
  }

  const sampleIds = new Set();
  const subjectSplits = new Map();
  const samples = dataset.samples.map((sample, index) => {
    const label = `samples[${index}]`;
    if (!isObject(sample)) throw new Error(`${label} must be an object`);
    assertAllowedKeys(sample, ["sampleId", "subjectId", "split", "consentConfirmed", "conditionTags", "auditSlices", "label", "scoring"], label);
    if (sample.consentConfirmed !== true) throw new Error(`${label}.consentConfirmed must be true`);
    const sampleId = cleanId(sample.sampleId, `${label}.sampleId`);
    if (sampleIds.has(sampleId)) throw new Error(`duplicate sampleId: ${sampleId}`);
    sampleIds.add(sampleId);
    const subjectId = cleanId(sample.subjectId, `${label}.subjectId`);
    if (!SPLITS.has(sample.split)) throw new Error(`${label}.split is invalid`);
    const existingSplit = subjectSplits.get(subjectId);
    if (existingSplit && existingSplit !== sample.split) {
      throw new Error(`subject split leakage detected: ${subjectId}`);
    }
    subjectSplits.set(subjectId, sample.split);
    const conditionTags = cleanStringList(sample.conditionTags, `${label}.conditionTags`, { min: 1, max: 24, safeTokens: true });
    return {
      sampleId,
      subjectId,
      split: sample.split,
      consentConfirmed: true,
      conditionTags: conditionTags.sort(),
      auditSlices: validateAuditSlices(sample.auditSlices, `${label}.auditSlices`),
      label: validateLabel(sample.label, `${label}.label`, archetypeKeys),
      scoring: validateScoringSnapshot(
        sample.scoring,
        `${label}.scoring`,
        registryVersion,
        archetypeKeys
      )
    };
  });

  return {
    schemaVersion: FACE_LAB_ARCHETYPE_CALIBRATION_DATASET_SCHEMA_VERSION,
    datasetId,
    registryVersion,
    labelProtocolVersion,
    datasetStage: dataset.datasetStage,
    minimumSliceSize: dataset.minimumSliceSize,
    privacy: {
      sourceImagesCommitted: false,
      directIdentifiersExcluded: true,
      minorSubjectsExcluded: true,
      labelsSeparatedFromImages: true
    },
    samples
  };
}

export function validateFaceLabArchetypeCalibrationPolicySet(
  policySet,
  registry = FACE_LAB_ARCHETYPE_REGISTRY
) {
  assertNoForbiddenPayload(policySet, "policySet");
  if (!isObject(policySet)) throw new Error("policySet must be an object");
  assertAllowedKeys(policySet, ["schemaVersion", "policySetId", "registryVersion", "policies"], "policySet");
  if (policySet.schemaVersion !== FACE_LAB_ARCHETYPE_CALIBRATION_POLICY_SET_SCHEMA_VERSION) {
    throw new Error("policySet schemaVersion is invalid");
  }
  const policySetId = cleanId(policySet.policySetId, "policySetId");
  const registryVersion = cleanId(policySet.registryVersion, "policySet.registryVersion");
  if (registryVersion !== registry.registryVersion) throw new Error("policySet registryVersion is not current");
  if (!Array.isArray(policySet.policies) || !policySet.policies.length || policySet.policies.length > 200) {
    throw new Error("policySet.policies must contain 1-200 policies");
  }
  const policyIds = new Set();
  const policies = policySet.policies.map((policy, index) => {
    const label = `policies[${index}]`;
    if (!isObject(policy)) throw new Error(`${label} must be an object`);
    assertAllowedKeys(policy, ["policyId", "minimumEvidenceCoverage", "minimumTopScore", "minimumTopMargin", "maximumContradictions"], label);
    const policyId = cleanId(policy.policyId, `${label}.policyId`);
    if (policyIds.has(policyId)) throw new Error(`duplicate policyId: ${policyId}`);
    policyIds.add(policyId);
    if (!Number.isSafeInteger(policy.maximumContradictions) || policy.maximumContradictions < 0 || policy.maximumContradictions > 100) {
      throw new Error(`${label}.maximumContradictions must be an integer from 0 to 100`);
    }
    return {
      policyId,
      minimumEvidenceCoverage: cleanUnit(policy.minimumEvidenceCoverage, `${label}.minimumEvidenceCoverage`),
      minimumTopScore: cleanNonNegative(policy.minimumTopScore, `${label}.minimumTopScore`),
      minimumTopMargin: cleanNonNegative(policy.minimumTopMargin, `${label}.minimumTopMargin`),
      maximumContradictions: policy.maximumContradictions
    };
  });
  return {
    schemaVersion: FACE_LAB_ARCHETYPE_CALIBRATION_POLICY_SET_SCHEMA_VERSION,
    policySetId,
    registryVersion,
    policies: policies.sort((left, right) => left.policyId.localeCompare(right.policyId))
  };
}

function applyPolicy(sample, policy) {
  const scoring = sample.scoring;
  const [top, second] = scoring.candidates;
  const holdReasons = [];
  if (!scoring.analysisUsable) holdReasons.push("insufficient_quality");
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
    subjectId: sample.subjectId,
    predictedKey: held ? null : top.key,
    rawTopKey: top?.rawScore > 0 ? top.key : null,
    rawTopScore: top?.rawScore || 0,
    topMargin,
    held,
    holdReasons
  };
}

function summarizePredictions(samples, predictions) {
  const bySampleId = new Map(predictions.map((item) => [item.sampleId, item]));
  const counts = {
    samples: samples.length,
    archetypeLabels: 0,
    ambiguousLabels: 0,
    holdLabels: 0,
    released: 0,
    held: 0,
    correctReleases: 0,
    incorrectReleases: 0,
    expectedHolds: 0,
    expectedHoldsHeld: 0,
    archetypeLabelsHeld: 0,
    rawTopAgreement: 0,
    ambiguousReleased: 0,
    adjacentPairCases: 0,
    adjacentPairWrongReleases: 0
  };

  for (const sample of samples) {
    const prediction = bySampleId.get(sample.sampleId);
    const disposition = sample.label.disposition;
    if (disposition === "archetype") counts.archetypeLabels += 1;
    if (disposition === "ambiguous") counts.ambiguousLabels += 1;
    if (disposition === "hold") counts.holdLabels += 1;
    if (disposition === "archetype" && sample.label.adjacentPair.length === 2) counts.adjacentPairCases += 1;
    const expectedHold = disposition !== "archetype";
    if (expectedHold) counts.expectedHolds += 1;
    if (prediction.held) {
      counts.held += 1;
      if (expectedHold) counts.expectedHoldsHeld += 1;
      if (disposition === "archetype") counts.archetypeLabelsHeld += 1;
    } else {
      counts.released += 1;
      const correct = disposition === "archetype" &&
        sample.label.acceptableTopCandidates.includes(prediction.predictedKey);
      if (correct) counts.correctReleases += 1;
      else counts.incorrectReleases += 1;
      if (disposition === "ambiguous") counts.ambiguousReleased += 1;
      if (
        disposition === "archetype" &&
        sample.label.adjacentPair.length === 2 &&
        sample.label.adjacentPair.includes(prediction.predictedKey) &&
        !sample.label.acceptableTopCandidates.includes(prediction.predictedKey)
      ) {
        counts.adjacentPairWrongReleases += 1;
      }
    }
    if (
      disposition === "archetype" &&
      prediction.rawTopKey &&
      sample.label.acceptableTopCandidates.includes(prediction.rawTopKey)
    ) {
      counts.rawTopAgreement += 1;
    }
  }

  return {
    counts,
    metrics: {
      releaseRate: ratio(counts.released, counts.samples),
      releasePrecision: ratio(counts.correctReleases, counts.released),
      archetypeRecall: ratio(counts.correctReleases, counts.archetypeLabels),
      expectedHoldRecall: ratio(counts.expectedHoldsHeld, counts.expectedHolds),
      holdPrecision: ratio(counts.expectedHoldsHeld, counts.held),
      ambiguousForceRate: ratio(counts.ambiguousReleased, counts.ambiguousLabels),
      rawTopAgreement: ratio(counts.rawTopAgreement, counts.archetypeLabels),
      adjacentPairWrongReleaseRate: ratio(counts.adjacentPairWrongReleases, counts.adjacentPairCases)
    }
  };
}

function buildAdjacentPairMetrics(samples, predictions) {
  const bySampleId = new Map(predictions.map((item) => [item.sampleId, item]));
  const pairKeys = [...new Set(samples
    .filter((sample) => sample.label.disposition === "archetype" && sample.label.adjacentPair.length === 2)
    .map((sample) => sample.label.adjacentPair.join("__")))].sort();
  return Object.fromEntries(pairKeys.map((pairKey) => {
    const pairSamples = samples.filter((sample) =>
      sample.label.disposition === "archetype" && sample.label.adjacentPair.join("__") === pairKey
    );
    let wrongReleases = 0;
    let correctReleases = 0;
    let held = 0;
    for (const sample of pairSamples) {
      const prediction = bySampleId.get(sample.sampleId);
      if (prediction.held) {
        held += 1;
      } else if (sample.label.acceptableTopCandidates.includes(prediction.predictedKey)) {
        correctReleases += 1;
      } else if (sample.label.adjacentPair.includes(prediction.predictedKey)) {
        wrongReleases += 1;
      }
    }
    return [pairKey, {
      sampleCount: pairSamples.length,
      correctReleases,
      wrongReleases,
      held,
      wrongReleaseRate: ratio(wrongReleases, pairSamples.length)
    }];
  }));
}

function buildSliceDisparities(sliceMetrics) {
  const metricNames = [
    "releasePrecision",
    "archetypeRecall",
    "expectedHoldRecall",
    "ambiguousForceRate",
    "rawTopAgreement"
  ];
  return Object.fromEntries(Object.entries(sliceMetrics).map(([dimension, values]) => {
    const unsuppressed = Object.values(values).filter((entry) => entry.suppressed === false);
    return [dimension, Object.fromEntries(metricNames.map((metricName) => {
      const observed = unsuppressed
        .map((entry) => entry.metrics?.[metricName])
        .filter((value) => Number.isFinite(value));
      return [metricName, observed.length >= 2 ? round(Math.max(...observed) - Math.min(...observed)) : null];
    }))];
  }));
}

function buildLabelSummary(samples) {
  const dispositionCounts = { archetype: 0, ambiguous: 0, hold: 0 };
  let agreementTotal = 0;
  let reviewerTotal = 0;
  for (const sample of samples) {
    dispositionCounts[sample.label.disposition] += 1;
    agreementTotal += sample.label.agreement;
    reviewerTotal += sample.label.reviewerCount;
  }
  return {
    dispositionCounts,
    meanAgreement: round(agreementTotal / samples.length),
    meanReviewerCount: round(reviewerTotal / samples.length)
  };
}

function buildSliceMetrics(samples, predictions, minimumSliceSize) {
  const dimensions = ["sexGroup", "ageBand", "skinToneBand", "makeupCondition"];
  return Object.fromEntries(dimensions.map((dimension) => {
    const values = [...new Set(samples.map((sample) => sample.auditSlices[dimension]))].sort();
    return [dimension, Object.fromEntries(values.map((value) => {
      const sliceSamples = samples.filter((sample) => sample.auditSlices[dimension] === value);
      const sampleIds = new Set(sliceSamples.map((sample) => sample.sampleId));
      const slicePredictions = predictions.filter((item) => sampleIds.has(item.sampleId));
      if (sliceSamples.length < minimumSliceSize) {
        return [value, { sampleCount: sliceSamples.length, suppressed: true, metrics: null }];
      }
      return [value, {
        sampleCount: sliceSamples.length,
        suppressed: false,
        ...summarizePredictions(sliceSamples, slicePredictions)
      }];
    }))];
  }));
}

export function evaluateFaceLabArchetypeCalibration({
  dataset,
  policySet,
  split = "validation",
  allowHoldout = false,
  registry = FACE_LAB_ARCHETYPE_REGISTRY
} = {}) {
  if (!SPLITS.has(split)) throw new Error("split is invalid");
  if (split === "holdout" && allowHoldout !== true) {
    throw new Error("holdout evaluation requires explicit allowHoldout=true");
  }
  const normalizedDataset = validateFaceLabArchetypeCalibrationDataset(dataset, registry);
  const normalizedPolicySet = validateFaceLabArchetypeCalibrationPolicySet(policySet, registry);
  if (normalizedDataset.registryVersion !== normalizedPolicySet.registryVersion) {
    throw new Error("dataset and policySet registryVersion mismatch");
  }
  const samples = normalizedDataset.samples.filter((sample) => sample.split === split);
  if (!samples.length) throw new Error(`dataset contains no ${split} samples`);
  const subjectCount = new Set(samples.map((sample) => sample.subjectId)).size;
  const policyResults = normalizedPolicySet.policies.map((policy) => {
    const predictions = samples.map((sample) => applyPolicy(sample, policy));
    const sliceMetrics = buildSliceMetrics(samples, predictions, normalizedDataset.minimumSliceSize);
    return {
      policy,
      ...summarizePredictions(samples, predictions),
      adjacentPairMetrics: buildAdjacentPairMetrics(samples, predictions),
      sliceMetrics,
      sliceDisparities: buildSliceDisparities(sliceMetrics)
    };
  });

  return {
    schemaVersion: FACE_LAB_ARCHETYPE_CALIBRATION_REPORT_SCHEMA_VERSION,
    mode: "offline_calibration_comparison",
    datasetId: normalizedDataset.datasetId,
    datasetStage: normalizedDataset.datasetStage,
    labelProtocolVersion: normalizedDataset.labelProtocolVersion,
    registryVersion: normalizedDataset.registryVersion,
    policySetId: normalizedPolicySet.policySetId,
    evaluatedSplit: split,
    holdoutAccessed: split === "holdout",
    sampleCount: samples.length,
    subjectCount,
    labelSummary: buildLabelSummary(samples),
    automaticPolicySelection: false,
    registryMutationPerformed: false,
    productionActivationEligible: false,
    userFacingPercentagesAllowed: false,
    policyResults
  };
}
