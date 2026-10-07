#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const r31 = JSON.parse(fs.readFileSync(
  "evidence/product-fact-catalog-expansion-v1/data-ai29c-filter-r3-r1-bushman-write-policy-handoff-preflight-v1.json",
  "utf8",
));
const r32 = JSON.parse(fs.readFileSync(
  "evidence/product-fact-catalog-expansion-v1/data-ai29c-filter-r3-r2-uv-filter-write-authority-handoff-closeout-v1.json",
  "utf8",
));

assert.equal(
  r31.decision,
  "FILTER_R3_R1_POLICY_MISSING_FAIL_CLOSED_HANDOFF_PREFLIGHT_PASS",
);
assert.equal(
  r32.decision,
  "FILTER_R3_R2_UV_FILTER_REGISTRY_WRITE_AUTHORITY_HANDOFF_PASS",
);
assert.equal(r32.rollbackDryRun.passed, true);
assert.equal(r32.rollbackDryRun.persisted, false);

assert.equal(r32.execution.atomicTransaction, true);
assert.equal(r32.execution.v1.before.policyState, "active");
assert.equal(r32.execution.v1.before.newLineageAllowed, true);
assert.equal(r32.execution.v1.after.policyState, "draining");
assert.equal(r32.execution.v1.after.newLineageAllowed, false);
assert.equal(r32.execution.v1.after.existingLineageAllowed, true);
assert.equal(r32.execution.v2.before, null);
assert.equal(r32.execution.v2.after.policyState, "active");
assert.equal(r32.execution.v2.after.newLineageAllowed, true);
assert.equal(r32.execution.v2.after.existingLineageAllowed, true);

assert.equal(
  r32.execution.policyVersion,
  "data-ai29c-filter-r3-r2-uv-filter-write-authority-handoff-v1",
);
assert.equal(r32.execution.authorizedPhase, "DATA-AI29C-FILTER-R3-R2");
assert.match(r32.execution.v1.auditId, /^[0-9a-f-]{36}$/);
assert.match(r32.execution.v2.auditId, /^[0-9a-f-]{36}$/);

assert.equal(r32.productionReadback.singleNewWriterCount, 1);
assert.equal(
  r32.productionReadback.singleNewWriterRegistry,
  "product-fact-registry-cross-category-v2",
);
assert.equal(r32.productionReadback.v1CurrentUvFilterCount, 18);
assert.equal(r32.productionReadback.v2CurrentUvFilterCount, 0);
assert.equal(r32.productionReadback.v1OpenUvFilterReviewAssignments, 0);
assert.equal(r32.productionReadback.bushmanSpf.unchanged, true);
assert.equal(r32.productionReadback.bushmanUva.unchanged, true);
assert.equal(r32.productionReadback.bushmanUvFilterCurrentCount, 0);

assert.equal(r32.invariants.v1ExistingLineagePreserved, true);
assert.equal(r32.invariants.v1NewLineageBlocked, true);
assert.equal(r32.invariants.v2NewLineageAllowed, true);
assert.equal(r32.invariants.v2ExistingLineageAllowed, true);
assert.equal(r32.invariants.dualNewWriterPrevented, true);
assert.equal(r32.invariants.existingCurrentFactsPreserved, true);

assert.equal(r32.writeBoundary.registryPolicyWrites, 2);
for (const key of [
  "sourceWrites","sourceBindingWrites","evidenceWrites","reviewAssignmentWrites",
  "productFactWrites","researchTaskMutations","productMutations","recommendationWrites"
]) assert.equal(r32.writeBoundary[key], 0, key);
for (const key of [
  "rankingChanged","betaAllowlistChanged","publicActivation","uvaActivation","waterActivation"
]) assert.equal(r32.writeBoundary[key], false, key);

assert.equal(
  r32.bushmanFrozenAuthority.sourceDigest,
  r31.frozenCompositionAuthority.sourceDigest,
);
assert.equal(
  r32.bushmanFrozenAuthority.propositionKey,
  r31.frozenCompositionAuthority.propositionKey,
);
assert.equal(
  r32.bushmanFrozenAuthority.canonicalEvidenceDigest,
  r31.frozenCompositionAuthority.canonicalEvidenceDigest,
);
assert.equal(r32.bushmanFrozenAuthority.proposedValue, "hybrid");

assert.equal(
  r32.nextGate,
  "DATA-AI29C-FILTER-R3-R3_BUSHMAN_GOVERNED_SOURCE_REFRESH_AND_CONFIRMATION",
);

console.log(JSON.stringify({
  status:"PASS",
  stage:r32.stage,
  decision:r32.decision,
  singleNewWriter:r32.productionReadback.singleNewWriterRegistry,
  v1State:r32.execution.v1.after.policyState,
  v2State:r32.execution.v2.after.policyState,
  nextGate:r32.nextGate,
}, null, 2));
