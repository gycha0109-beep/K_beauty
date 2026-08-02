import assert from "node:assert/strict";
import test from "node:test";
import {
  EXCLUSION_POLICY_VERSION,
  FACE_FEATURE_CUE_PROFILE_VERSION,
  FACE_FEATURE_INTENT_SCHEMA_VERSION,
  validateDraftGenerationSpec
} from "@bejewely/face-contracts";
import {
  SKIN_CONTROL_FIXTURES,
  createPairedSkinEditDraft,
  finalizeGenerationSpec
} from "../src/index.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function errorCodes(result) {
  return result.errors.map((item) => item.code);
}

test("A/B/C/D fixtures pass exact draft validation", () => {
  for (const fixture of Object.values(SKIN_CONTROL_FIXTURES)) {
    assert.deepEqual(validateDraftGenerationSpec(fixture.spec), { ok: true, errors: [] });
  }
});

test("semantic digest ignores createdAt and notes but changes on target changes", () => {
  const source = clone(SKIN_CONTROL_FIXTURES.B.spec);
  const first = finalizeGenerationSpec(source);
  const metadataOnly = clone(source);
  metadataOnly.provenance.createdAt = "2026-08-03T00:00:00.000Z";
  metadataOnly.provenance.notes = "manual batch note";
  const second = finalizeGenerationSpec(metadataOnly);
  assert.equal(first.specDigest, second.specDigest);
  assert.equal(first.finalizedSpec.specId, second.finalizedSpec.specId);

  const targetChanged = clone(source);
  targetChanged.subject.adultAgeBand = "30s";
  const third = finalizeGenerationSpec(targetChanged);
  assert.notEqual(first.specDigest, third.specDigest);
});

test("region order is canonicalized", () => {
  const first = clone(SKIN_CONTROL_FIXTURES.D.spec);
  const second = clone(first);
  second.skinIntent.redness.regions.reverse();
  second.skinIntent.blemishes.regions.reverse();
  assert.equal(finalizeGenerationSpec(first).specDigest, finalizeGenerationSpec(second).specDigest);
});

test("unknown fields and supplied identity fail closed", () => {
  const draft = clone(SKIN_CONTROL_FIXTURES.A.spec);
  draft.specId = "caller-owned";
  const result = validateDraftGenerationSpec(draft);
  assert.equal(result.ok, false);
  assert.ok(errorCodes(result).includes("invalid_spec_shape"));
});

test("required exclusion policy cannot be replaced", () => {
  const draft = clone(SKIN_CONTROL_FIXTURES.A.spec);
  draft.exclusionPolicyVersion = "custom-exclusions";
  const result = validateDraftGenerationSpec(draft);
  assert.equal(result.ok, false);
  assert.ok(errorCodes(result).includes("unsafe_exclusion_override"));
  assert.equal(EXCLUSION_POLICY_VERSION, "reference-portrait-exclusions-v1");
});

test("conflicting skin cues fail closed", () => {
  const draft = clone(SKIN_CONTROL_FIXTURES.A.spec);
  draft.skinIntent.redness = {
    severity: "none",
    regions: ["left_cheek"],
    pattern: "diffuse"
  };
  const result = validateDraftGenerationSpec(draft);
  assert.equal(result.ok, false);
  assert.ok(errorCodes(result).includes("conflicting_skin_targets"));
});

test("face feature control accepts only observation-backed cue registry", () => {
  const draft = clone(SKIN_CONTROL_FIXTURES.A.spec);
  draft.purpose = "face_feature_control";
  draft.featureIntent = {
    schemaVersion: FACE_FEATURE_INTENT_SCHEMA_VERSION,
    cueProfileVersion: FACE_FEATURE_CUE_PROFILE_VERSION,
    cues: {
      eyeDirection: { value: "upturned", strength: "subtle" },
      jawlineAngularity: { value: "angular", strength: "moderate" }
    }
  };
  assert.equal(validateDraftGenerationSpec(draft).ok, true);

  draft.featureIntent.cues.eyeDirection.value = "cat";
  const rejected = validateDraftGenerationSpec(draft);
  assert.equal(rejected.ok, false);
  assert.ok(errorCodes(rejected).includes("unapproved_feature_cue"));
});

test("archetype metadata remains unavailable until a taxonomy registry is approved", () => {
  const draft = clone(SKIN_CONTROL_FIXTURES.A.spec);
  draft.archetypeIntent = {
    taxonomyVersion: "unapproved-taxonomy-v1",
    primary: "cat",
    secondary: null,
    intendedWeightsBps: { cat: 10000 },
    compilationMode: "metadata_only"
  };
  const result = validateDraftGenerationSpec(draft);
  assert.equal(result.ok, false);
  assert.ok(errorCodes(result).includes("archetype_taxonomy_unavailable"));
});

test("paired edit requires the exact preserve contract", () => {
  const paired = createPairedSkinEditDraft(
    clone(SKIN_CONTROL_FIXTURES.B.spec.skinIntent),
    "candidate_reference_01"
  );
  assert.equal(validateDraftGenerationSpec(paired).ok, true);

  paired.variation.preserve = ["identity"];
  const rejected = validateDraftGenerationSpec(paired);
  assert.equal(rejected.ok, false);
  assert.ok(errorCodes(rejected).includes("invalid_variation_contract"));
});

test("sensitive provenance is rejected", () => {
  const draft = clone(SKIN_CONTROL_FIXTURES.A.spec);
  draft.provenance.notes = "Bearer secret-token-value";
  const result = validateDraftGenerationSpec(draft);
  assert.equal(result.ok, false);
  assert.ok(errorCodes(result).includes("sensitive_provenance_forbidden"));
});

test("exported fixtures and semantic payloads are deeply immutable", () => {
  assert.equal(Object.isFrozen(SKIN_CONTROL_FIXTURES.A.spec.skinIntent), true);
  assert.throws(() => {
    SKIN_CONTROL_FIXTURES.A.spec.skinIntent.redness.severity = "mild";
  }, TypeError);
  const finalized = finalizeGenerationSpec(SKIN_CONTROL_FIXTURES.A.spec);
  assert.equal(Object.isFrozen(finalized.semanticPayload.skinIntent), true);
  assert.throws(() => {
    finalized.semanticPayload.skinIntent.redness.severity = "mild";
  }, TypeError);
});
