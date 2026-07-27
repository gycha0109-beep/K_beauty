import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";

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

const observation = loadModule(
  "lib/face-lab-observation-contract.js",
  ["FACE_LAB_OBSERVATION_DEFINITIONS"]
);
const registry = loadModule(
  "lib/face-lab-archetype-registry.js",
  ["FACE_LAB_ARCHETYPE_REGISTRY"],
  { FACE_LAB_OBSERVATION_DEFINITIONS: observation.FACE_LAB_OBSERVATION_DEFINITIONS }
);
const core = loadModule(
  "lib/face-lab-archetype-calibration.js",
  [
    "evaluateFaceLabArchetypeCalibration",
    "validateFaceLabArchetypeCalibrationDataset",
    "validateFaceLabArchetypeCalibrationPolicySet"
  ],
  { FACE_LAB_ARCHETYPE_REGISTRY: registry.FACE_LAB_ARCHETYPE_REGISTRY }
);
const governance = loadModule(
  "lib/face-lab-archetype-calibration-governance.js",
  [
    "FACE_LAB_ARCHETYPE_CALIBRATION_GOVERNANCE_SCHEMA_VERSION",
    "validateFaceLabArchetypeCalibrationGovernance",
    "evaluateFaceLabArchetypeCalibrationGoverned"
  ],
  {
    FACE_LAB_ARCHETYPE_REGISTRY: registry.FACE_LAB_ARCHETYPE_REGISTRY,
    evaluateFaceLabArchetypeCalibration: core.evaluateFaceLabArchetypeCalibration,
    validateFaceLabArchetypeCalibrationDataset: core.validateFaceLabArchetypeCalibrationDataset,
    validateFaceLabArchetypeCalibrationPolicySet: core.validateFaceLabArchetypeCalibrationPolicySet
  }
);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const dataset = JSON.parse(readFileSync(
  "scripts/fixtures/face-lab-archetype-calibration-dataset.example.json",
  "utf8"
));
const policySet = JSON.parse(readFileSync(
  "scripts/fixtures/face-lab-archetype-calibration-policies.example.json",
  "utf8"
));

const validated = governance.validateFaceLabArchetypeCalibrationGovernance({ dataset, policySet });
assert.equal(validated.dataset.samples.length, 3);
assert.equal(validated.policySet.policies.length, 2);
assert.equal(Object.hasOwn(validated.dataset.samples[0], "auditSliceConsentConfirmed"), false);

const reportA = governance.evaluateFaceLabArchetypeCalibrationGoverned({ dataset, policySet });
const reportB = governance.evaluateFaceLabArchetypeCalibrationGoverned({ dataset, policySet });
assert.deepEqual(reportA, reportB);
assert.equal(reportA.governanceSchemaVersion, "face-lab-archetype-calibration-governance-v1");
assert.equal(reportA.labelingMode, "blind_to_model_scores");
assert.equal(reportA.labelsFrozenBeforePolicyEvaluation, true);
assert.equal(reportA.auditSliceConsentEnforced, true);
assert.equal(reportA.suppressedSliceIdentitiesHidden, true);
assert.equal(reportA.policySelectionProtocol, "manual_predeclared");
assert.equal(reportA.policyCandidatesFrozenBeforeEvaluation, true);
assert.equal(reportA.automaticPolicySelection, false);
assert.equal(reportA.registryMutationPerformed, false);
assert.equal(reportA.productionActivationEligible, false);
assert.equal(reportA.userFacingPercentagesAllowed, false);
assert.equal(reportA.sampleCount, 2);

for (const policyResult of reportA.policyResults) {
  assert.equal(policyResult.adjacentPairMetrics.cat__wolf.sampleCount, 1);
  assert.equal(policyResult.adjacentPairMetrics.cat__wolf.totalWrongReleases, 0);
  assert.deepEqual(policyResult.sliceMetrics.sexGroup, {});
  assert.equal(policyResult.sliceSuppression.sexGroup.suppressedGroupCount, 2);
}

assert.throws(
  () => governance.evaluateFaceLabArchetypeCalibrationGoverned({ dataset, policySet, split: "holdout" }),
  /allowHoldout/
);
const holdout = governance.evaluateFaceLabArchetypeCalibrationGoverned({
  dataset,
  policySet,
  split: "holdout",
  allowHoldout: true
});
assert.equal(holdout.holdoutAccessed, true);
assert.equal(holdout.sampleCount, 1);

const noAuditConsent = clone(dataset);
noAuditConsent.samples[0].auditSliceConsentConfirmed = false;
assert.throws(
  () => governance.validateFaceLabArchetypeCalibrationGovernance({ dataset: noAuditConsent, policySet }),
  /auditSliceConsentConfirmed/
);

const allUnknownWithoutAuditConsent = clone(dataset);
allUnknownWithoutAuditConsent.samples[0].auditSlices = {
  sexGroup: "unknown",
  ageBand: "unknown",
  skinToneBand: "unknown",
  makeupCondition: "unknown"
};
allUnknownWithoutAuditConsent.samples[0].auditSliceConsentConfirmed = false;
assert.doesNotThrow(() => governance.validateFaceLabArchetypeCalibrationGovernance({
  dataset: allUnknownWithoutAuditConsent,
  policySet
}));

const unblinded = clone(dataset);
unblinded.labelingMode = "reviewers_saw_model_scores";
assert.throws(
  () => governance.validateFaceLabArchetypeCalibrationGovernance({ dataset: unblinded, policySet }),
  /blind_to_model_scores/
);

const labelsNotFrozen = clone(dataset);
labelsNotFrozen.labelsFrozenBeforePolicyEvaluation = false;
assert.throws(
  () => governance.validateFaceLabArchetypeCalibrationGovernance({ dataset: labelsNotFrozen, policySet }),
  /labelsFrozenBeforePolicyEvaluation/
);

const policiesNotFrozen = clone(policySet);
policiesNotFrozen.candidatesFrozenBeforeEvaluation = false;
assert.throws(
  () => governance.validateFaceLabArchetypeCalibrationGovernance({ dataset, policySet: policiesNotFrozen }),
  /predeclared and frozen/
);

const smuggledImage = clone(dataset);
smuggledImage.samples[0].imagePath = "private/person.jpg";
assert.throws(
  () => governance.validateFaceLabArchetypeCalibrationGovernance({ dataset: smuggledImage, policySet }),
  /unsupported keys/
);

const thirdTypeError = clone(dataset);
const sample = thirdTypeError.samples[0];
const deer = sample.scoring.candidates.find((candidate) => candidate.key === "deer");
deer.rawScore = 3.5;
sample.scoring.candidates.sort((left, right) => right.rawScore - left.rawScore || left.key.localeCompare(right.key));
const thirdTypeReport = governance.evaluateFaceLabArchetypeCalibrationGoverned({
  dataset: thirdTypeError,
  policySet
});
const balanced = thirdTypeReport.policyResults.find((item) => item.policy.policyId === "candidate-balanced");
assert.equal(balanced.adjacentPairMetrics.cat__wolf.otherWrongReleases, 1);
assert.equal(balanced.adjacentPairMetrics.cat__wolf.totalWrongReleaseRate, 1);

const reportText = JSON.stringify(reportA);
assert.doesNotMatch(reportText, /sampleId|subjectId|auditSliceConsentConfirmed|data:image|base64/i);
assert.doesNotMatch(reportText, /"sexGroup":\{"female"|"sexGroup":\{"male"/i);

const privateRoot = "private/face-lab-calibration";
const outputRoot = "tmp/face-lab-archetype-calibration";
const datasetPath = `${privateRoot}/governance-verifier-dataset.json`;
const policyPath = `${privateRoot}/governance-verifier-policies.json`;
const outputPath = `${outputRoot}/governance-verifier-report.json`;
mkdirSync(privateRoot, { recursive: true });
mkdirSync(outputRoot, { recursive: true });
copyFileSync("scripts/fixtures/face-lab-archetype-calibration-dataset.example.json", datasetPath);
copyFileSync("scripts/fixtures/face-lab-archetype-calibration-policies.example.json", policyPath);
rmSync(outputPath, { force: true });
const cliArgs = [
  "scripts/evaluate-face-lab-archetype-calibration-governed.mjs",
  "--dataset", datasetPath,
  "--policies", policyPath,
  "--split", "validation",
  "--output", outputPath
];
const cliSuccess = spawnSync(process.execPath, cliArgs, { encoding: "utf8" });
assert.equal(cliSuccess.status, 0, `${cliSuccess.stdout}\n${cliSuccess.stderr}`);
assert.equal(existsSync(outputPath), true);
const cliOverwrite = spawnSync(process.execPath, cliArgs, { encoding: "utf8" });
assert.notEqual(cliOverwrite.status, 0);
assert.match(cliOverwrite.stderr, /failed=output_exists/);
const cliOutside = spawnSync(process.execPath, [
  "scripts/evaluate-face-lab-archetype-calibration-governed.mjs",
  "--dataset", "scripts/fixtures/face-lab-archetype-calibration-dataset.example.json",
  "--policies", policyPath,
  "--split", "validation",
  "--output", `${outputRoot}/governance-verifier-reject.json`
], { encoding: "utf8" });
assert.notEqual(cliOutside.status, 0);
assert.match(cliOutside.stderr, /failed=path_boundary_rejected/);
const cliHoldout = spawnSync(process.execPath, [
  "scripts/evaluate-face-lab-archetype-calibration-governed.mjs",
  "--dataset", datasetPath,
  "--policies", policyPath,
  "--split", "holdout",
  "--output", `${outputRoot}/governance-verifier-holdout.json`
], { encoding: "utf8" });
assert.notEqual(cliHoldout.status, 0);
assert.match(cliHoldout.stderr, /failed=holdout_confirmation_required/);
for (const cleanupPath of [
  datasetPath,
  policyPath,
  outputPath,
  `${outputRoot}/governance-verifier-reject.json`,
  `${outputRoot}/governance-verifier-holdout.json`
]) rmSync(cleanupPath, { force: true });

for (const sourcePath of [
  "lib/face-lab-archetype-calibration-governance.js",
  "scripts/evaluate-face-lab-archetype-calibration-governed.mjs"
]) {
  const source = readFileSync(sourcePath, "utf8");
  assert.doesNotMatch(source, /https?:\/\//);
  assert.doesNotMatch(source, /registry\s*\.\s*decisionPolicy\s*=/);
  if (sourcePath.includes("evaluate-face-lab")) {
    assert.match(source, /root must not be a symlink/);
  }
}

console.log("[verify-face-lab-archetype-calibration-governance] PASS");
