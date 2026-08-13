import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ARCHETYPE_STRESS_ARCHETYPE_KEYS,
  ARCHETYPE_STRESS_FEATURE_CUE_PROFILE_VERSION,
  ARCHETYPE_STRESS_FEATURE_CUE_REGISTRY,
  ARCHETYPE_STRESS_TAXONOMY_VERSION,
  ENABLED_ARCHETYPE_TAXONOMIES,
  FACE_FEATURE_CUE_PROFILE_VERSION,
  FACE_FEATURE_CUE_REGISTRY,
  FACE_FEATURE_INTENT_SCHEMA_VERSION,
  validateDraftGenerationSpec
} from "@bejewely/face-contracts";
import { FACE_LAB_ARCHETYPE_REGISTRY } from "../lib/face-lab-archetype-registry.js";
import {
  SKIN_CONTROL_FIXTURES,
  compileGenerationPrompt
} from "../tools/synthetic-evaluation/src/index.js";

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

const EXPECTED_V1_AXES = Object.freeze([
  "eyeDirection",
  "eyeOpenness",
  "faceLengthBalance",
  "featureContrast",
  "jawlineAngularity",
  "straightCurveBalance"
]);

const EXPECTED_V2_AXES = Object.freeze([
  "cheekboneProminence",
  "contourDefinition",
  "eyeDirection",
  "eyeLength",
  "eyeOpenness",
  "faceLengthBalance",
  "faceShape",
  "featureConcentration",
  "featureContrast",
  "featureScale",
  "jawTaper",
  "jawlineAngularity",
  "straightCurveBalance"
]);

const RAW_ARCHETYPE_TOKEN = /\b(?:wolf|cat|puppy|deer|tofu|potato|dino)\b/i;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sorted(values) {
  return [...values].sort();
}

function axisFromIndicatorPath(path) {
  const parts = String(path).split(".");
  assert.equal(parts.length, 3, `unexpected indicator path shape: ${path}`);
  assert.equal(parts[0], "observations", `unexpected indicator root: ${path}`);
  return parts[2];
}

function errorCodes(result) {
  return result.errors.map((item) => item.code);
}

const registryKeys = FACE_LAB_ARCHETYPE_REGISTRY.archetypes.map((item) => item.key);
assert.deepEqual(registryKeys, EXPECTED_ARCHETYPE_KEYS);
assert.deepEqual(ARCHETYPE_STRESS_ARCHETYPE_KEYS, EXPECTED_ARCHETYPE_KEYS);
assert.equal(FACE_LAB_ARCHETYPE_REGISTRY.registryVersion, "face-lab-archetype-rubric-20260727");
assert.equal(FACE_LAB_ARCHETYPE_REGISTRY.lifecycle, "rubric_ready");
assert.equal(FACE_LAB_ARCHETYPE_REGISTRY.calibrationStatus, "not_ready");
assert.deepEqual(FACE_LAB_ARCHETYPE_REGISTRY.decisionPolicy, {
  minimumEvidenceCoverage: null,
  minimumTopScore: null,
  minimumTopMargin: null,
  maximumContradictions: null
});

assert.equal(FACE_FEATURE_CUE_PROFILE_VERSION, "face-feature-cues-v1");
assert.equal(ARCHETYPE_STRESS_FEATURE_CUE_PROFILE_VERSION, "face-feature-cues-v2");
assert.deepEqual(sorted(Object.keys(FACE_FEATURE_CUE_REGISTRY)), EXPECTED_V1_AXES);
assert.deepEqual(sorted(Object.keys(ARCHETYPE_STRESS_FEATURE_CUE_REGISTRY)), EXPECTED_V2_AXES);
assert.deepEqual(ENABLED_ARCHETYPE_TAXONOMIES[ARCHETYPE_STRESS_TAXONOMY_VERSION], EXPECTED_ARCHETYPE_KEYS);

const rubricAxes = new Set();
const requiredAxes = new Set();
for (const archetype of FACE_LAB_ARCHETYPE_REGISTRY.archetypes) {
  for (const indicator of archetype.indicators) {
    const axis = axisFromIndicatorPath(indicator.path);
    rubricAxes.add(axis);
    if (indicator.required) requiredAxes.add(axis);
    const allowed = ARCHETYPE_STRESS_FEATURE_CUE_REGISTRY[axis];
    assert.ok(allowed, `missing stress generation axis: ${axis}`);
    for (const expected of indicator.expected) {
      assert.ok(allowed.includes(expected), `missing stress generation enum: ${axis}=${expected}`);
    }
  }
}

const missingRubricAxes = sorted([...rubricAxes].filter((axis) => !ARCHETYPE_STRESS_FEATURE_CUE_REGISTRY[axis]));
const missingRequiredAxes = sorted([...requiredAxes].filter((axis) => !ARCHETYPE_STRESS_FEATURE_CUE_REGISTRY[axis]));
assert.deepEqual(missingRubricAxes, []);
assert.deepEqual(missingRequiredAxes, []);

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

for (const archetype of FACE_LAB_ARCHETYPE_REGISTRY.archetypes) {
  const draft = clone(SKIN_CONTROL_FIXTURES.A.spec);
  draft.purpose = "archetype_stress";
  draft.featureIntent = {
    schemaVersion: FACE_FEATURE_INTENT_SCHEMA_VERSION,
    cueProfileVersion: ARCHETYPE_STRESS_FEATURE_CUE_PROFILE_VERSION,
    cues: Object.fromEntries(
      archetype.indicators
        .filter((indicator) => indicator.required)
        .map((indicator) => [
          axisFromIndicatorPath(indicator.path),
          { value: indicator.expected[0], strength: "subtle" }
        ])
    )
  };
  draft.archetypeIntent = {
    taxonomyVersion: ARCHETYPE_STRESS_TAXONOMY_VERSION,
    primary: archetype.key,
    secondary: null,
    intendedWeightsBps: { [archetype.key]: 10000 },
    compilationMode: "metadata_only"
  };
  draft.provenance.campaignId = "face-eval-c-stress-v1";
  draft.provenance.sourceTemplateId = `archetype-${archetype.key}-required-axis`;
  draft.provenance.sourceTemplateVersion = "v1";
  draft.provenance.notes = null;

  const validation = validateDraftGenerationSpec(draft);
  assert.deepEqual(validation, { ok: true, errors: [] }, `stress draft rejected: ${archetype.key}`);

  const compiled = compileGenerationPrompt({
    draftSpec: draft,
    providerProfileId: "gemini-image-manual-v1"
  });
  assert.equal(compiled.ok, true, `stress prompt compilation failed: ${archetype.key}`);
  assert.doesNotMatch(compiled.compiledPrompt.content.positivePrompt, RAW_ARCHETYPE_TOKEN);
  assert.doesNotMatch(compiled.compiledPrompt.content.positivePrompt, /\barchetype\b/i);

  const wrongPurpose = clone(draft);
  wrongPurpose.purpose = "face_feature_control";
  const wrongPurposeResult = validateDraftGenerationSpec(wrongPurpose);
  assert.equal(wrongPurposeResult.ok, false);
  assert.ok(errorCodes(wrongPurposeResult).includes("unsupported_target_axis"));

  const wrongProfile = clone(draft);
  wrongProfile.featureIntent.cueProfileVersion = FACE_FEATURE_CUE_PROFILE_VERSION;
  const wrongProfileResult = validateDraftGenerationSpec(wrongProfile);
  assert.equal(wrongProfileResult.ok, false);
  assert.ok(errorCodes(wrongProfileResult).includes("unsupported_target_axis") || errorCodes(wrongProfileResult).includes("unapproved_feature_cue"));
}

const badTaxonomy = clone(SKIN_CONTROL_FIXTURES.A.spec);
badTaxonomy.purpose = "archetype_stress";
badTaxonomy.featureIntent = {
  schemaVersion: FACE_FEATURE_INTENT_SCHEMA_VERSION,
  cueProfileVersion: ARCHETYPE_STRESS_FEATURE_CUE_PROFILE_VERSION,
  cues: { eyeDirection: { value: "upturned", strength: "subtle" } }
};
badTaxonomy.archetypeIntent = {
  taxonomyVersion: "unknown-taxonomy-v1",
  primary: "cat",
  secondary: null,
  intendedWeightsBps: { cat: 10000 },
  compilationMode: "metadata_only"
};
const badTaxonomyResult = validateDraftGenerationSpec(badTaxonomy);
assert.equal(badTaxonomyResult.ok, false);
assert.ok(errorCodes(badTaxonomyResult).includes("archetype_taxonomy_unavailable"));

const missingPrimary = clone(badTaxonomy);
missingPrimary.archetypeIntent.taxonomyVersion = ARCHETYPE_STRESS_TAXONOMY_VERSION;
missingPrimary.archetypeIntent.primary = null;
missingPrimary.archetypeIntent.intendedWeightsBps = {};
const missingPrimaryResult = validateDraftGenerationSpec(missingPrimary);
assert.equal(missingPrimaryResult.ok, false);
assert.ok(errorCodes(missingPrimaryResult).includes("archetype_taxonomy_unavailable"));

for (const key of Object.keys(SKIN_CONTROL_FIXTURES)) {
  const result = compileGenerationPrompt({
    draftSpec: SKIN_CONTROL_FIXTURES[key].spec,
    providerProfileId: "gemini-image-manual-v1"
  });
  assert.equal(result.ok, true);
  const snapshot = readFileSync(`tools/synthetic-evaluation/tests/snapshots/gemini-${key}.txt`, "utf8").replaceAll("\r\n", "\n");
  assert.equal(`${result.compiledPrompt.content.positivePrompt}\n`, snapshot, `legacy prompt snapshot drift: ${key}`);
}

const compilerSource = readFileSync("tools/synthetic-evaluation/src/generation/compile-prompt.js", "utf8");
assert.equal(compilerSource.includes("draftSpec.archetypeIntent"), false);
assert.equal(compilerSource.includes("spec.archetypeIntent"), false);
assert.equal(compilerSource.includes("archetypeIntent.primary"), false);

const campaignExecutionReady = missingRequiredAxes.length === 0
  && Boolean(ENABLED_ARCHETYPE_TAXONOMIES[ARCHETYPE_STRESS_TAXONOMY_VERSION]);
assert.equal(campaignExecutionReady, true);

console.log(JSON.stringify({
  status: "PASS",
  contract: "face-lab-archetype-synthetic-stress-campaign-v1",
  cueCoverage: "face-feature-cues-v2",
  registryVersion: FACE_LAB_ARCHETYPE_REGISTRY.registryVersion,
  archetypeKeys: registryKeys,
  stressKinds: EXPECTED_STRESS_KINDS,
  closePairHypotheses: EXPECTED_CLOSE_PAIR_HYPOTHESES,
  generationCueAxes: sorted(Object.keys(ARCHETYPE_STRESS_FEATURE_CUE_REGISTRY)),
  missingRubricAxes,
  missingRequiredAxes,
  archetypeIntentCompilation: "metadata_only",
  legacyPromptSnapshots: "byte_invariant",
  campaignExecutionReady,
  providerCalls: 0,
  hostedWrites: 0,
  syntheticWrites: 0
}, null, 2));
