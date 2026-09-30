#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import {
  SUNSCREEN_SEMANTIC_PROJECTION_POLICY_VERSION,
  evaluateSunscreenSemanticEnvelope,
  projectEstablishedSunscreenSemantics,
  evaluateSunscreenSemanticScoringEligibility,
} from "../lib/sunscreen-recommendation-semantic-projection.mjs";

const fixture = JSON.parse(
  fs.readFileSync(
    "fixtures/data-ai29c-d1b-sunscreen-semantic-projection-v1.json",
    "utf8",
  ),
);

assert.equal(
  SUNSCREEN_SEMANTIC_PROJECTION_POLICY_VERSION,
  "sunscreen-recommendation-semantic-projection-policy-v1",
);
assert.equal(fixture.product_count, 5);
assert.equal(fixture.boundaries.missing_is_not_false, true);
assert.equal(fixture.boundaries.contextual_fail_closed, true);

const byName = new Map(fixture.products.map((p) => [p.fixtureName, p]));
for (const product of fixture.products) {
  const envelope = evaluateSunscreenSemanticEnvelope(product);
  assert.equal(envelope.contractValid, true);
  assert.equal(envelope.subjectExact, true);
  assert.equal(envelope.allReviewed, true);
  assert.equal(envelope.coreEstablished, true);
  assert.equal(envelope.envelopeReady, true);

  const projected = projectEstablishedSunscreenSemantics(product);
  assert.equal(projected.projected.category, "sunscreen");
  assert.equal(projected.projected.uv_filter_type, "mineral");
  assert.equal(
    Object.prototype.hasOwnProperty.call(projected.projected, "sensitivity_safe"),
    false,
  );
}

const neutralEligible = fixture.products.filter(
  (p) => evaluateSunscreenSemanticScoringEligibility(p, {}).eligible,
);
assert.equal(neutralEligible.length, 5);

const sensitiveEligible = fixture.products.filter(
  (p) =>
    evaluateSunscreenSemanticScoringEligibility(p, {
      sensitivityRelevant: true,
    }).eligible,
);
assert.equal(sensitiveEligible.length, 0);

const makeupEligible = fixture.products.filter(
  (p) =>
    evaluateSunscreenSemanticScoringEligibility(p, {
      pillingRelevant: true,
    }).eligible,
);
assert.equal(makeupEligible.length, 0);

const whiteCastEligible = fixture.products
  .filter(
    (p) =>
      evaluateSunscreenSemanticScoringEligibility(p, {
        whiteCastRelevant: true,
      }).eligible,
  )
  .map((p) => p.fixtureName)
  .sort();
assert.deepEqual(whiteCastEligible, [
  "Dr. Troub Skin Returning Bio Repair + Suncream",
  "Jojoba Suncream",
  "Physical Daily Sunmilk",
].sort());

const eyeEligible = fixture.products
  .filter(
    (p) =>
      evaluateSunscreenSemanticScoringEligibility(p, {
        eyeStingRelevant: true,
      }).eligible,
  )
  .map((p) => p.fixtureName)
  .sort();
assert.deepEqual(eyeEligible, [
  "Dr. Troub Skin Returning Bio Repair + Suncream",
  "Dr. Troub Zinc Physical",
  "Jojoba Suncream",
  "Physical Daily Sunmilk",
].sort());

const toneEligible = fixture.products
  .filter(
    (p) =>
      evaluateSunscreenSemanticScoringEligibility(p, {
        toneUpRelevant: true,
      }).eligible,
  )
  .map((p) => p.fixtureName)
  .sort();
assert.equal(toneEligible.length, 4);
assert.equal(toneEligible.includes("Physical Daily Sunmilk"), false);

const finishEligible = fixture.products
  .filter(
    (p) =>
      evaluateSunscreenSemanticScoringEligibility(p, {
        finishRelevant: true,
      }).eligible,
  )
  .map((p) => p.fixtureName);
assert.deepEqual(finishEligible, ["Jojoba Suncream"]);

const textureEligible = fixture.products
  .filter(
    (p) =>
      evaluateSunscreenSemanticScoringEligibility(p, {
        textureRelevant: true,
      }).eligible,
  )
  .map((p) => p.fixtureName)
  .sort();
assert.deepEqual(textureEligible, [
  "Dr. Troub Zinc Physical",
  "Physical Daily Sunmilk",
].sort());

const zincWhiteCast = evaluateSunscreenSemanticScoringEligibility(
  byName.get("Dr. Troub Zinc Physical"),
  { whiteCastRelevant: true },
);
assert.equal(zincWhiteCast.eligible, false);
assert.deepEqual(zincWhiteCast.blockers, [
  "SEMANTIC_UNCERTAINTY:whiteCastRelevant:white_cast",
]);

const dailySensitivity = evaluateSunscreenSemanticScoringEligibility(
  byName.get("Physical Daily Sunmilk"),
  { sensitivityRelevant: true },
);
assert.equal(dailySensitivity.eligible, false);
assert.deepEqual(dailySensitivity.blockers, [
  "SEMANTIC_UNCERTAINTY:sensitivityRelevant:irritation_risk",
  "SEMANTIC_UNCERTAINTY:sensitivityRelevant:sensitivity_safe",
]);

for (const product of fixture.products) {
  const result = evaluateSunscreenSemanticScoringEligibility(product, {});
  assert.ok(Object.values(result.limits).every((value) => value === false));
}

console.log("DATA_AI29C_D1B_SEMANTIC_PROJECTION_POLICY=PASS");
console.log("envelope_ready=5 neutral_eligible=5 sensitive=0 makeup=0");
