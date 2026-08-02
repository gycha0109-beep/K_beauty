import assert from "node:assert/strict";
import test from "node:test";
import {
  CANONICAL_OBSERVATION_SNAPSHOT,
  OBSERVATION_PROMPT,
  OBSERVATION_PROMPT_DIGEST,
  OBSERVATION_SEMANTIC_EXPORT_DIGEST,
  verifyCanonicalObservationSnapshot
} from "../../src/observation/snapshot/canonical-v1.js";
import { normalizeObservationPayload } from "../../src/observation/normalize-observation.js";
import {
  ELIGIBLE_PARITY_FIXTURE,
  INELIGIBLE_PARITY_FIXTURE,
  INVALID_PARITY_FIXTURE
} from "../../src/observation/parity-fixtures.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test("pinned observation snapshot is self-consistent and source-addressed", () => {
  assert.deepEqual(verifyCanonicalObservationSnapshot(), { ok: true });
  assert.match(CANONICAL_OBSERVATION_SNAPSHOT.snapshotId, /^obsc_[a-f0-9]{24}$/);
  assert.match(CANONICAL_OBSERVATION_SNAPSHOT.snapshotDigest, /^[a-f0-9]{64}$/);
  assert.match(OBSERVATION_SEMANTIC_EXPORT_DIGEST, /^[a-f0-9]{64}$/);
  assert.match(OBSERVATION_PROMPT_DIGEST, /^[a-f0-9]{64}$/);
  assert.match(OBSERVATION_PROMPT, /Do not generate.*archetypes/i);
  assert.equal(CANONICAL_OBSERVATION_SNAPSHOT.source.files.length, 4);
  assert.equal(CANONICAL_OBSERVATION_SNAPSHOT.source.files.every((file) => /^[a-f0-9]{40}$/.test(file.blobSha)), true);
});

test("eligible parity fixture produces canonical available bundle", () => {
  const result = normalizeObservationPayload(ELIGIBLE_PARITY_FIXTURE, { provider: "fixture", model: "fixture-canonical-v1" });
  assert.equal(result.ok, true);
  assert.equal(result.bundle.status, "available");
  assert.equal(result.bundle.eligibility.status, "eligible");
  assert.equal(result.bundle.skin.status, "available");
  assert.equal(result.bundle.face.status, "available");
  assert.equal(result.bundle.privacy.sourceImagePersisted, false);
  assert.equal(result.bundle.privacy.rawProviderResponsePersisted, false);
  assert.equal(Object.isFrozen(result.bundle), true);
});

test("valid ineligible image remains an observation rather than execution failure", () => {
  const result = normalizeObservationPayload(INELIGIBLE_PARITY_FIXTURE, { provider: "fixture", model: "fixture-canonical-v1" });
  assert.equal(result.ok, true);
  assert.equal(result.bundle.status, "available");
  assert.equal(result.bundle.eligibility.status, "ineligible");
  assert.equal(result.bundle.skin.status, "unavailable");
  assert.equal(result.bundle.face.status, "unavailable");
});

test("unknown fields, schema mismatch, and invalid eligibility fail closed", () => {
  assert.deepEqual(normalizeObservationPayload(INVALID_PARITY_FIXTURE), { ok: false, code: "provider_contract_invalid" });
  const schema = clone(ELIGIBLE_PARITY_FIXTURE);
  schema.schemaVersion = "vision-observation-v2";
  assert.equal(normalizeObservationPayload(schema).ok, false);
  const eligibility = clone(ELIGIBLE_PARITY_FIXTURE);
  eligibility.eligibility.source = "prompt";
  assert.equal(normalizeObservationPayload(eligibility).ok, false);
  const nestedUnknown = clone(ELIGIBLE_PARITY_FIXTURE);
  nestedUnknown.face.quality.pose.intent = "frontal";
  assert.equal(normalizeObservationPayload(nestedUnknown).ok, false);
  const nestedMissing = clone(ELIGIBLE_PARITY_FIXTURE);
  delete nestedMissing.face.observations.outline.faceShape.evidence;
  assert.equal(normalizeObservationPayload(nestedMissing).ok, false);
});
