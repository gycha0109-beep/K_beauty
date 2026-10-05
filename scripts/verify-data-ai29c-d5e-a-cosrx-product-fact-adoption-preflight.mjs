#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const evidence = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-d5e-a-cosrx-product-fact-adoption-preflight-v1.json",
    "utf8",
  ),
);
const upstream = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-d5e-sunscreen-admission-expansion-frontier-v1.json",
    "utf8",
  ),
);

assert.equal(evidence.stage, "DATA-AI29C-D5E-A");
assert.equal(
  evidence.decision,
  "D5E_A_COSRX_PRODUCT_FACT_ADOPTION_PREFLIGHT_PASS_READY_FOR_SEPARATE_CONTROLLED_WRITE",
);
assert.equal(evidence.mode, "READ_ONLY_PRODUCTION_PREFLIGHT_ZERO_WRITE");
assert.equal(
  upstream.decision,
  "D5E0_SUNSCREEN_ADMISSION_EXPANSION_FRONTIER_FROZEN_COSRX_WAVE2_SELECTED",
);

assert.equal(evidence.target.productId, "888eca86-af25-4a12-b9ea-47922d83f520");
assert.equal(
  evidence.target.subject.subjectId,
  "994d7edb-7432-40c3-b09f-08cd59f91627",
);
assert.equal(evidence.target.subject.market, "KR");
assert.equal(evidence.target.subject.identityStatus, "resolved");
assert.equal(evidence.target.subject.currentState, "current");
assert.equal(evidence.target.exactCurrentSubjectCount, 1);
assert.equal(evidence.target.currentAdmissionCriticalFactCount, 0);

assert.equal(
  evidence.registry.latestPublishedRegistry,
  "product-fact-registry-cross-category-v2",
);
assert.equal(
  evidence.registry.candidateRegistry,
  "product-fact-registry-cross-category-v1",
);
assert.equal(evidence.registry.candidateRegistryNewLineageAllowed, true);
for (const row of Object.values(evidence.registry.facts)) {
  assert.equal(row.allowed, true);
  assert.equal(row.reason, "ALLOWED");
  assert.equal(row.policyState, "active");
  assert.match(row.policyDigest, /^[0-9a-f]{64}$/);
}

assert.equal(evidence.candidatePreflights.length, 3);
const byFact = new Map(
  evidence.candidatePreflights.map((row) => [row.factKey, row]),
);
assert.deepEqual([...byFact.keys()].sort(), [
  "spf_value",
  "uv_filter_type",
  "uva_label",
]);

for (const row of byFact.values()) {
  assert.equal(row.candidateState, "READY");
  assert.equal(row.evidenceAuthority, "product_specific_primary");
  assert.equal(row.confidence, "high");
  assert.equal(row.market, "KR");
  assert.equal(row.preflightStatus, "ready");
  assert.equal(row.openAssignmentCount, 0);
  assert.equal(row.automaticConfirmation, false);
  assert.deepEqual(row.expectedGovernedWriteBoundary, [
    "evidence_ingest",
    "review_prepare",
    "confirmation_preflight",
  ]);
  assert.match(row.canonicalEvidenceDigest, /^[0-9a-f]{64}$/);
  assert.match(row.propositionKey, /^[0-9a-f]{64}$/);
}
assert.equal(byFact.get("spf_value").normalizedValue, 50);
assert.equal(byFact.get("uva_label").normalizedValue, "PA++++");
assert.equal(byFact.get("uv_filter_type").normalizedValue, "organic");

assert.equal(
  evidence.governedExecutionContract.adoptionRpc,
  "admin_adopt_trust_evidence_candidate_v1",
);
assert.equal(
  evidence.governedExecutionContract.explicitConfirmationRpc,
  "admin_confirm_product_fact_v1",
);
assert.equal(
  evidence.governedExecutionContract.adoptionAutomaticConfirmation,
  false,
);
assert.equal(
  evidence.governedExecutionContract.parallelConfirmationForbidden,
  true,
);

assert.deepEqual(evidence.d5eBPlannedOrder, [
  "spf_value",
  "uva_label",
  "uv_filter_type",
]);

for (const [key,value] of Object.entries(evidence.productionBoundary)) {
  if (key.endsWith("Writes")) assert.equal(value, 0, key);
  else assert.equal(value, false, key);
}

assert.deepEqual(evidence.result, {
  candidateCount: 3,
  readyPreflightCount: 3,
  openAssignmentCount: 0,
  registryWriteAdmissibleCount: 3,
  exactCurrentSubject: true,
  currentFactCollisionCount: 0,
  readyForSeparateControlledWrite: true,
});

const d5cContract = fs.readFileSync(
  "lib/sunscreen-d5c-canary-authority-contract.mjs",
  "utf8",
);
assert.equal(
  d5cContract.includes("888eca86-af25-4a12-b9ea-47922d83f520"),
  false,
  "D5E-A must not widen the D5C/D5D three-product allowlist",
);

assert.equal(
  evidence.nextGate,
  "DATA-AI29C-D5E-B_COSRX_PRODUCT_FACT_CONTROLLED_CONFIRMATION",
);
assert.equal(
  evidence.nextGateExecutionRule,
  "SEPARATE_STAGE_AFTER_D5E_A_MERGE_AND_CI_PASS",
);

console.log(JSON.stringify({
  status: "PASS",
  stage: evidence.stage,
  decision: evidence.decision,
  candidateCount: evidence.result.candidateCount,
  readyPreflightCount: evidence.result.readyPreflightCount,
  registryWriteAdmissibleCount: evidence.result.registryWriteAdmissibleCount,
  productionWrites: 0,
  nextGate: evidence.nextGate,
}, null, 2));
