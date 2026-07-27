import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function loadModule(path, names, dependencies = {}) {
  const source = readFileSync(path, "utf8")
    .replace(/^import[\s\S]*?from\s+["'][^"']+["'];\r?\n/gm, "")
    .replace(/export const /g, "const ")
    .replace(/export function /g, "function ");
  const dependencyNames = Object.keys(dependencies);
  return Function(
    ...dependencyNames,
    `${source}\nreturn { ${names.join(", ")} };`
  )(...dependencyNames.map((name) => dependencies[name]));
}

const observationModule = loadModule(
  "lib/face-lab-observation-contract.js",
  ["FACE_LAB_OBSERVATION_DEFINITIONS"]
);
const registryModule = loadModule(
  "lib/face-lab-archetype-registry.js",
  ["FACE_LAB_ARCHETYPE_REGISTRY"],
  { FACE_LAB_OBSERVATION_DEFINITIONS: observationModule.FACE_LAB_OBSERVATION_DEFINITIONS }
);
const calibrationModule = loadModule(
  "lib/face-lab-archetype-calibration.js",
  [
    "evaluateFaceLabArchetypeCalibration",
    "validateFaceLabArchetypeCalibrationDataset",
    "validateFaceLabArchetypeCalibrationPolicySet"
  ],
  { FACE_LAB_ARCHETYPE_REGISTRY: registryModule.FACE_LAB_ARCHETYPE_REGISTRY }
);
const {
  evaluateFaceLabArchetypeCalibration,
  validateFaceLabArchetypeCalibrationDataset,
  validateFaceLabArchetypeCalibrationPolicySet
} = calibrationModule;
const FACE_LAB_ARCHETYPE_REGISTRY = registryModule.FACE_LAB_ARCHETYPE_REGISTRY;
const KEYS = FACE_LAB_ARCHETYPE_REGISTRY.archetypes.map((item) => item.key).sort();

function scoring(order, options = {}) {
  const scoreByKey = Object.fromEntries(KEYS.map((key) => [key, 0]));
  for (const [key, score] of order) scoreByKey[key] = score;
  const missingRequiredByKey = options.missingRequiredByKey || {};
  const contradictionByKey = options.contradictionByKey || {};
  const coverageByKey = options.coverageByKey || {};
  const candidates = KEYS.map((key) => ({
    key,
    rawScore: scoreByKey[key],
    evidenceCoverage: coverageByKey[key] ?? 0.9,
    missingRequiredPaths: missingRequiredByKey[key] || [],
    contradictionCount: contradictionByKey[key] || 0
  })).sort((left, right) => right.rawScore - left.rawScore || left.key.localeCompare(right.key));
  return {
    schemaVersion: "face-lab-archetype-scoring-v1",
    registryVersion: FACE_LAB_ARCHETYPE_REGISTRY.registryVersion,
    analysisUsable: options.analysisUsable !== false,
    qualityMultiplier: options.analysisUsable === false ? 0 : 0.9,
    candidates
  };
}

function sample({
  id,
  subject = id,
  split = "validation",
  disposition = "archetype",
  acceptable = ["cat"],
  adjacentPair = [],
  scores = [["cat", 3], ["wolf", 2]],
  scoringOptions = {},
  sexGroup = "female",
  ageBand = "18_29",
  skinToneBand = "light",
  makeupCondition = "none_or_light"
}) {
  return {
    sampleId: id,
    subjectId: subject,
    split,
    consentConfirmed: true,
    conditionTags: ["synthetic", "frontal"],
    auditSlices: { sexGroup, ageBand, skinToneBand, makeupCondition },
    label: {
      disposition,
      acceptableTopCandidates: disposition === "hold" ? [] : acceptable,
      reviewerCount: 3,
      agreement: disposition === "ambiguous" ? 0.67 : 1,
      adjacentPair
    },
    scoring: scoring(scores, scoringOptions)
  };
}

function buildDataset() {
  return {
    schemaVersion: "face-lab-archetype-calibration-dataset-v1",
    datasetId: "synthetic-calibration-001",
    registryVersion: FACE_LAB_ARCHETYPE_REGISTRY.registryVersion,
    labelProtocolVersion: "archetype-label-protocol-v1",
    datasetStage: "synthetic",
    minimumSliceSize: 2,
    privacy: {
      sourceImagesCommitted: false,
      directIdentifiersExcluded: true,
      minorSubjectsExcluded: true,
      labelsSeparatedFromImages: true
    },
    samples: [
      sample({ id: "cat-clear-1", acceptable: ["cat"], adjacentPair: ["cat", "wolf"] }),
      sample({ id: "cat-close-1", acceptable: ["cat"], adjacentPair: ["cat", "wolf"], scores: [["cat", 2.7], ["wolf", 2.62]], sexGroup: "male", skinToneBand: "medium" }),
      sample({ id: "wolf-clear-1", acceptable: ["wolf"], adjacentPair: ["cat", "wolf"], scores: [["wolf", 3.2], ["cat", 2.1]], sexGroup: "male", ageBand: "30_44", skinToneBand: "deep", makeupCondition: "moderate" }),
      sample({ id: "puppy-clear-1", acceptable: ["puppy"], scores: [["puppy", 2.9], ["tofu", 1.4]], ageBand: "30_44", skinToneBand: "medium" }),
      sample({ id: "ambiguous-cat-wolf-1", disposition: "ambiguous", acceptable: ["cat", "wolf"], adjacentPair: ["cat", "wolf"], scores: [["cat", 2.9], ["wolf", 2.84]], sexGroup: "male", ageBand: "45_59", skinToneBand: "deep", makeupCondition: "heavy" }),
      sample({ id: "hold-zero-1", disposition: "hold", acceptable: [], scores: [], scoringOptions: { analysisUsable: false }, sexGroup: "female", ageBand: "45_59", skinToneBand: "light", makeupCondition: "heavy" }),
      sample({ id: "deer-missing-axis-1", acceptable: ["deer"], scores: [["deer", 3.1], ["puppy", 1.5]], scoringOptions: { missingRequiredByKey: { deer: ["observations.eyes.eyeOpenness"] } }, sexGroup: "female", ageBand: "60_plus", skinToneBand: "medium", makeupCondition: "moderate" }),
      sample({ id: "dino-contradiction-1", acceptable: ["dino"], scores: [["dino", 3.4], ["wolf", 1.9]], scoringOptions: { contradictionByKey: { dino: 2 } }, sexGroup: "intersex", ageBand: "60_plus", skinToneBand: "deep" })
    ]
  };
}

function buildPolicySet() {
  return {
    schemaVersion: "face-lab-archetype-calibration-policy-set-v1",
    policySetId: "synthetic-policy-grid-001",
    registryVersion: FACE_LAB_ARCHETYPE_REGISTRY.registryVersion,
    policies: [
      {
        policyId: "loose",
        minimumEvidenceCoverage: 0.5,
        minimumTopScore: 1,
        minimumTopMargin: 0,
        maximumContradictions: 5
      },
      {
        policyId: "strict",
        minimumEvidenceCoverage: 0.8,
        minimumTopScore: 2.5,
        minimumTopMargin: 0.2,
        maximumContradictions: 0
      }
    ]
  };
}

const dataset = buildDataset();
const policySet = buildPolicySet();
const normalizedDataset = validateFaceLabArchetypeCalibrationDataset(dataset);
const normalizedPolicySet = validateFaceLabArchetypeCalibrationPolicySet(policySet);
assert.equal(normalizedDataset.samples.length, 8);
assert.deepEqual(normalizedPolicySet.policies.map((item) => item.policyId), ["loose", "strict"]);

const reportA = evaluateFaceLabArchetypeCalibration({ dataset, policySet, split: "validation" });
const reportB = evaluateFaceLabArchetypeCalibration({ dataset, policySet, split: "validation" });
assert.deepEqual(reportA, reportB);
assert.equal(reportA.automaticPolicySelection, false);
assert.equal(reportA.registryMutationPerformed, false);
assert.equal(reportA.productionActivationEligible, false);
assert.equal(reportA.userFacingPercentagesAllowed, false);
assert.equal(reportA.sampleCount, 8);
assert.equal(reportA.subjectCount, 8);

const loose = reportA.policyResults.find((item) => item.policy.policyId === "loose");
const strict = reportA.policyResults.find((item) => item.policy.policyId === "strict");
assert.equal(loose.counts.ambiguousReleased, 1);
assert.equal(loose.metrics.ambiguousForceRate, 1);
assert.equal(strict.counts.ambiguousReleased, 0);
assert.equal(strict.counts.archetypeLabelsHeld, 3);
assert.ok(strict.metrics.releasePrecision > loose.metrics.releasePrecision);
assert.equal(strict.sliceMetrics.ageBand["18_29"].suppressed, false);
assert.equal(strict.sliceMetrics.ageBand["60_plus"].suppressed, false);
assert.equal(strict.sliceMetrics.ageBand["45_59"].suppressed, false);
assert.equal(strict.sliceMetrics.ageBand["30_44"].suppressed, false);
assert.equal(strict.sliceMetrics.sexGroup.intersex.suppressed, true);
assert.ok(Number.isFinite(loose.sliceDisparities.skinToneBand.releasePrecision));
assert.equal(loose.adjacentPairMetrics.cat__wolf.sampleCount, 3);

assert.throws(
  () => evaluateFaceLabArchetypeCalibration({ dataset, policySet, split: "holdout" }),
  /allowHoldout/
);

const holdoutDataset = buildDataset();
holdoutDataset.samples.push(sample({
  id: "holdout-cat-1",
  subject: "holdout-subject-1",
  split: "holdout",
  acceptable: ["cat"]
}));
const holdoutReport = evaluateFaceLabArchetypeCalibration({
  dataset: holdoutDataset,
  policySet,
  split: "holdout",
  allowHoldout: true
});
assert.equal(holdoutReport.holdoutAccessed, true);
assert.equal(holdoutReport.sampleCount, 1);

const leakage = buildDataset();
leakage.samples.push(sample({
  id: "leakage-copy",
  subject: "cat-clear-1",
  split: "development"
}));
assert.throws(
  () => validateFaceLabArchetypeCalibrationDataset(leakage),
  /subject split leakage/
);

const forbidden = buildDataset();
forbidden.samples[0].imagePath = "private/person.jpg";
assert.throws(
  () => validateFaceLabArchetypeCalibrationDataset(forbidden),
  /forbidden key|unsupported keys/
);

const evidenceLeak = buildDataset();
evidenceLeak.samples[0].scoring.candidates[0].evidence = ["visible face fact"];
assert.throws(
  () => validateFaceLabArchetypeCalibrationDataset(evidenceLeak),
  /forbidden key/
);

const wrongRegistry = buildDataset();
wrongRegistry.registryVersion = "old-registry";
assert.throws(
  () => validateFaceLabArchetypeCalibrationDataset(wrongRegistry),
  /not current/
);

const wrongOrder = buildDataset();
wrongOrder.samples[0].scoring.candidates.reverse();
assert.throws(
  () => validateFaceLabArchetypeCalibrationDataset(wrongOrder),
  /sorted/
);

const reportText = JSON.stringify(reportA);
assert.doesNotMatch(reportText, /sampleId|subjectId|consentConfirmed|fixture-visible-fact|data:image|base64/i);

const source = readFileSync(new URL("../lib/face-lab-archetype-calibration.js", import.meta.url), "utf8");
assert.doesNotMatch(source, /fetch\s*\(|https?:\/\//);
assert.doesNotMatch(source, /registry\s*\.\s*decisionPolicy\s*=/);

console.log("[verify-face-lab-archetype-calibration] PASS");
