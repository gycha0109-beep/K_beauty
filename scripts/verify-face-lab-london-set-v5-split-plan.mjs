import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const plan = JSON.parse(
  readFileSync(
    "evidence/facelab/source-intake/v0/london-set-v5-reference-holdout-split-plan.json",
    "utf8"
  )
);
assert.equal(
  plan.schemaVersion,
  "face-lab-london-set-v5-reference-holdout-split-plan-v0"
);
assert.equal(plan.status, "frozen_pre_measurement");
assert.equal(
  plan.sourceReceiptDigest,
  "sha256:b51a121c5639da4d090f0e43b4287d5cd5c306ba036efca3030516cf72a2025a"
);
assert.equal(plan.method.measurementValuesUsed, false);
assert.equal(plan.method.sensitiveAttributesUsed, false);
assert.equal(plan.method.archetypeLabelsUsed, false);
assert.equal(plan.method.exactReferenceCount, 82);
assert.equal(plan.method.exactHoldoutCount, 20);
assert.equal(plan.records.length, 102);
assert.equal(new Set(plan.records.map((item) => item.subjectId)).size, 102);
assert.equal(
  plan.records.filter((item) => item.split === "reference").length,
  82
);
assert.equal(
  plan.records.filter((item) => item.split === "holdout").length,
  20
);
assert.equal(plan.boundaries.subjectLevelSplit, true);
assert.equal(plan.boundaries.subjectLeakageForbidden, true);
assert.equal(plan.boundaries.nearDuplicateFamilyLeakageForbidden, true);
assert.equal(plan.boundaries.productionAuthority, false);
assert.equal(plan.boundaries.normalizationAuthority, false);
assert.equal(plan.boundaries.thresholdAuthority, false);
assert.equal(plan.boundaries.adequacyDecisionAuthority, false);

console.log(JSON.stringify({
  ok: true,
  status: plan.status,
  referenceCount: 82,
  holdoutCount: 20,
  measurementValuesUsed: false,
  sensitiveAttributesUsed: false,
  archetypeLabelsUsed: false,
  productionAuthority: false,
  normalizationAuthority: false
}, null, 2));
