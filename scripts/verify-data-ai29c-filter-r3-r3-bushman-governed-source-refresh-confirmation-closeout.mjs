#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const r32 = JSON.parse(fs.readFileSync(
  "evidence/product-fact-catalog-expansion-v1/data-ai29c-filter-r3-r2-uv-filter-write-authority-handoff-closeout-v1.json",
  "utf8",
));
const r33 = JSON.parse(fs.readFileSync(
  "evidence/product-fact-catalog-expansion-v1/data-ai29c-filter-r3-r3-bushman-governed-source-refresh-confirmation-closeout-v1.json",
  "utf8",
));

assert.equal(
  r32.decision,
  "FILTER_R3_R2_UV_FILTER_REGISTRY_WRITE_AUTHORITY_HANDOFF_PASS",
);
assert.equal(
  r33.decision,
  "FILTER_R3_R3_BUSHMAN_GOVERNED_SOURCE_REFRESH_AND_CONFIRMATION_PASS",
);

assert.equal(r33.rollbackDryRun.passed, true);
for (const value of Object.values(r33.rollbackDryRun.rollbackCheck)) {
  assert.equal(value, 0);
}

assert.equal(r33.target.registryVersion, "product-fact-registry-cross-category-v2");
assert.equal(r33.target.factKey, "uv_filter_type");
assert.equal(r33.target.value, "hybrid");
assert.equal(
  r33.target.propositionSerializerVersion,
  "product-fact-proposition-schema-v2",
);
assert.equal(
  r33.target.propositionKey,
  "717e0e0eb6b8f5575ac20f0189878bd5af4195bda7da19f427670b12ca95200f",
);

assert.equal(r33.governedSource.bindingState, "exact_subject_match");
assert.equal(r33.governedSource.scopeRelation, "equivalent");
assert.equal(
  r33.governedSource.contentDigest,
  "3a9fbcb280935133e95a0f7f19bfff20157258b4dc17b8dce4d601e40f6681a9",
);

assert.equal(r33.evidence.evidenceClass, "composition_identity");
assert.equal(r33.evidence.evidenceAuthority, "product_specific_primary");
assert.equal(r33.evidence.confidence, "high");
assert.equal(r33.evidence.supportDirection, "supports");
assert.equal(r33.evidence.negativeAdmissibility, "not_applicable");
assert.equal(r33.evidence.propositionValueIdentity, null);

assert.deepEqual(r33.review.lifecycle, [
  "queued",
  "under_review",
  "ready_for_confirm",
  "confirmed",
]);
assert.equal(r33.confirmation.semanticStatus, "supported");
assert.equal(r33.confirmation.authorityCeiling, "product_specific_primary");
assert.equal(r33.confirmation.fusedConfidence, "high");
assert.equal(r33.confirmation.previousFactInstanceId, null);
assert.equal(r33.confirmation.idempotentRetryPassed, true);

assert.deepEqual(r33.counts.delta, {
  sources:1,
  bindings:1,
  evidence:1,
  assignments:1,
  factInstances:1,
  confirmations:1,
  current:1,
  evidenceLinks:1,
});
assert.equal(r33.counts.post.current, 108);

assert.equal(r33.preservedFacts.spf.unchanged, true);
assert.equal(r33.preservedFacts.uva.unchanged, true);
assert.equal(r33.invariants.historicalResearchTaskState, "BLOCKED");
assert.equal(r33.invariants.historicalResearchTaskBlocker, "EVIDENCE_INSUFFICIENT");
assert.equal(r33.invariants.historicalResearchTaskMutated, false);
assert.equal(r33.invariants.taxonomyAssignmentState, "shadow");
assert.equal(r33.invariants.semanticReviewCount, 0);
assert.equal(r33.invariants.legacyProductMutated, false);
assert.equal(r33.invariants.d5dSwitchEnabled, true);
assert.equal(r33.invariants.d5dAuthorizedPhase, "DATA-AI29C-D5D");
for (const key of [
  "recommendationWrite",
  "rankingChanged",
  "betaAllowlistChanged",
  "publicActivation",
  "uvaActivation",
  "waterActivation",
]) assert.equal(r33.invariants[key], false, key);

assert.equal(r33.security.advisorChecked, true);
assert.equal(r33.security.ddlOrRlsMutation, false);
assert.equal(r33.security.newSchemaSurfaceCreated, false);

assert.equal(r33.closure.filterRecoveryComplete, true);
assert.equal(r33.closure.recommendationAdmissionActivated, false);
assert.equal(r33.closure.automaticFollowOnStageDefined, false);
assert.equal(
  r33.closure.result,
  "FILTER_R3_RECOVERY_COMPLETE_NO_AUTOMATIC_RECOMMENDATION_ACTIVATION",
);

console.log(JSON.stringify({
  status:"PASS",
  stage:r33.stage,
  decision:r33.decision,
  value:r33.target.value,
  factInstanceId:r33.confirmation.factInstanceId,
  confirmationId:r33.confirmation.confirmationId,
  closure:r33.closure.result,
}, null, 2));
