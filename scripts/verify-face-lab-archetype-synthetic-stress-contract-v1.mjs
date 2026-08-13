import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FACE_FEATURE_CUE_REGISTRY } from "@bejewely/face-contracts";
import { FACE_LAB_ARCHETYPE_REGISTRY } from "../lib/face-lab-archetype-registry.js";

const EXPECTED_ARCHETYPE_KEYS = Object.freeze([
  "wolf",
  "cat",
  "puppy",
  "deer",
  "tofu",
  "potato",
  "dino"
]);

const EXPECTED_CLOSE_PAIR_HYPOTHESES = Object.freeze([
  Object.freeze(["wolf", "cat"]),
  Object.freeze(["puppy", "deer"]),
  Object.freeze(["puppy", "tofu"]),
  Object.freeze(["deer", "tofu"]),
  Object.freeze(["cat", "potato"]),
  Object.freeze(["wolf", "dino"])
]);

const EXPECTED_STRESS_KINDS = Object.freeze([
  "required_axis_positive",
  "negative_contradiction",
  "missing_required_axis",
  "close_pair_boundary",
  "low_evidence",
  "observation_failure",
  "capture_stability"
]);

const EXPECTED_MISSING_RUBRIC_AXES = Object.freeze([
  "cheekboneProminence",
  "contourDefinition",
  "eyeLength",
  "faceShape",
  "featureConcentration",
  "featureScale",
  "jawTaper"
]);

const EXPECTED_MISSING_REQUIRED_AXES = Object.freeze([
  "contourDefinition",
  "eyeLength",
  "faceShape",
  "featureConcentration",
  "featureScale"
]);

function sorted(values) {
  return [...values].sort();
}

function axisFromIndicatorPath(path) {
  const parts = String(path).split(".");
  assert.equal(parts.length, 3, `unexpected indicator path shape: ${path}`);
  assert.equal(parts[0], "observations", `unexpected indicator root: ${path}`);
  return parts[2];
}

const registryKeys = FACE_LAB_ARCHETYPE_REGISTRY.archetypes.map((item) => item.key);
assert.deepEqual(registryKeys, EXPECTED_ARCHETYPE_KEYS);
assert.equal(FACE_LAB_ARCHETYPE_REGISTRY.registryVersion, "face-lab-archetype-rubric-20260727");
assert.equal(FACE_LAB_ARCHETYPE_REGISTRY.lifecycle, "rubric_ready");
assert.equal(FACE_LAB_ARCHETYPE_REGISTRY.calibrationStatus, "not_ready");
assert.deepEqual(FACE_LAB_ARCHETYPE_REGISTRY.decisionPolicy, {
  minimumEvidenceCoverage: null,
  minimumTopScore: null,
  minimumTopMargin: null,
  maximumContradictions: null
});

const rubricAxes = new Set();
const requiredAxes = new Set();
for (const archetype of FACE_LAB_ARCHETYPE_REGISTRY.archetypes) {
  for (const indicator of archetype.indicators) {
    const axis = axisFromIndicatorPath(indicator.path);
    rubricAxes.add(axis);
    if (indicator.required) requiredAxes.add(axis);
  }
}

const generationAxes = new Set(Object.keys(FACE_FEATURE_CUE_REGISTRY));
const missingRubricAxes = sorted([...rubricAxes].filter((axis) => !generationAxes.has(axis)));
const missingRequiredAxes = sorted([...requiredAxes].filter((axis) => !generationAxes.has(axis)));

assert.deepEqual(missingRubricAxes, EXPECTED_MISSING_RUBRIC_AXES);
assert.deepEqual(missingRequiredAxes, EXPECTED_MISSING_REQUIRED_AXES);

const generationSpecSource = readFileSync("packages/face-contracts/src/synthetic-generation/generation-spec.js", "utf8");
const compilerSource = readFileSync("tools/synthetic-evaluation/src/generation/compile-prompt.js", "utf8");
assert.match(generationSpecSource, /ENABLED_ARCHETYPE_TAXONOMIES\s*=\s*Object\.freeze\(\{\}\)/);
assert.match(generationSpecSource, /compilationMode\s*!==\s*"metadata_only"/);
assert.equal(compilerSource.includes("archetypeIntent"), false, "raw archetype intent must not be compiled into prompts");

const keySet = new Set(EXPECTED_ARCHETYPE_KEYS);
const pairKeys = new Set();
for (const pair of EXPECTED_CLOSE_PAIR_HYPOTHESES) {
  assert.equal(pair.length, 2);
  assert.ok(keySet.has(pair[0]) && keySet.has(pair[1]));
  assert.notEqual(pair[0], pair[1]);
  const canonical = sorted(pair).join("::");
  assert.equal(pairKeys.has(canonical), false, `duplicate close-pair hypothesis: ${canonical}`);
  pairKeys.add(canonical);
}

assert.equal(new Set(EXPECTED_STRESS_KINDS).size, EXPECTED_STRESS_KINDS.length);
assert.ok(EXPECTED_STRESS_KINDS.includes("missing_required_axis"));
assert.ok(EXPECTED_STRESS_KINDS.includes("negative_contradiction"));
assert.ok(EXPECTED_STRESS_KINDS.includes("capture_stability"));

const campaignExecutionReady = missingRequiredAxes.length === 0
  && !/ENABLED_ARCHETYPE_TAXONOMIES\s*=\s*Object\.freeze\(\{\}\)/.test(generationSpecSource);
assert.equal(campaignExecutionReady, false);

console.log(JSON.stringify({
  status: "PASS",
  contract: "face-lab-archetype-synthetic-stress-campaign-v1",
  registryVersion: FACE_LAB_ARCHETYPE_REGISTRY.registryVersion,
  archetypeKeys: registryKeys,
  stressKinds: EXPECTED_STRESS_KINDS,
  closePairHypotheses: EXPECTED_CLOSE_PAIR_HYPOTHESES,
  generationCueAxes: sorted(generationAxes),
  missingRubricAxes,
  missingRequiredAxes,
  archetypeIntentCompilation: "metadata_only_and_disabled",
  campaignExecutionReady,
  providerCalls: 0,
  hostedWrites: 0,
  syntheticWrites: 0
}, null, 2));
