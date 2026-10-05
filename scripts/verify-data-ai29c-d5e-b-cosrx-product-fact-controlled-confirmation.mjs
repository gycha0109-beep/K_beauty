#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const evidence = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-d5e-b-cosrx-product-fact-controlled-confirmation-v1.json",
    "utf8",
  ),
);
const preflight = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-d5e-a-cosrx-product-fact-adoption-preflight-v1.json",
    "utf8",
  ),
);

assert.equal(evidence.stage, "DATA-AI29C-D5E-B");
assert.equal(
  evidence.decision,
  "D5E_B_COSRX_PRODUCT_FACT_CONTROLLED_CONFIRMATION_PASS",
);
assert.equal(
  preflight.decision,
  "D5E_A_COSRX_PRODUCT_FACT_ADOPTION_PREFLIGHT_PASS_READY_FOR_SEPARATE_CONTROLLED_WRITE",
);
assert.equal(evidence.target.productId, "888eca86-af25-4a12-b9ea-47922d83f520");
assert.equal(evidence.target.market, "KR");
assert.equal(evidence.target.legacyCategory, null);
assert.equal(evidence.target.taxonomyAssignmentState, "shadow");

assert.deepEqual(evidence.executionOrder, [
  "spf_value",
  "uva_label",
  "uv_filter_type",
]);
assert.equal(evidence.controlledPath.automaticConfirmation, false);
assert.equal(evidence.controlledPath.parallelConfirmation, false);
assert.equal(evidence.controlledPath.perFactReadbackRequired, true);

assert.equal(evidence.facts.length, 3);
const byFact = new Map(evidence.facts.map((row) => [row.factKey, row]));
assert.equal(byFact.get("spf_value").value, 50);
assert.equal(byFact.get("uva_label").value, "PA++++");
assert.equal(byFact.get("uv_filter_type").value, "organic");

for (const row of byFact.values()) {
  assert.equal(row.currentCount, 1);
  assert.equal(row.supportingEvidenceCount, 1);
  assert.equal(row.confirmedAssignmentCount, 1);
  assert.equal(row.semanticStatus, "supported");
  assert.equal(row.evidenceAuthority, "product_specific_primary");
  assert.equal(row.confidence, "high");
  assert.equal(
    row.registryVersion,
    "product-fact-registry-cross-category-v1",
  );
  assert.match(row.propositionKey, /^[0-9a-f]{64}$/);
  assert.match(row.payloadDigest, /^[0-9a-f]{64}$/);
  assert.match(row.prestateDigest, /^[0-9a-f]{64}$/);
  assert.match(row.fusionInputDigest, /^[0-9a-f]{64}$/);
  assert.match(row.canonicalEvidenceDigest, /^[0-9a-f]{64}$/);
}

assert.deepEqual(evidence.lineageSummary, {
  exactSubjectBindingCount: 2,
  governedSourceCount: 2,
  governedEvidenceCount: 3,
  confirmedReviewAssignmentCount: 3,
  productFactInstanceCount: 3,
  productFactCurrentCount: 3,
  confirmationRowCount: 3,
  distinctConfirmationRequestCount: 3,
});

assert.equal(evidence.poststate.exactCurrentSubjectCount, 1);
assert.equal(evidence.poststate.admissionCriticalCurrentCount, 3);
assert.equal(evidence.poststate.semanticCurrentReviewCount, 0);
assert.equal(evidence.poststate.productLegacyCategoryIsNull, true);
assert.equal(evidence.poststate.taxonomyAssignmentUnchanged, true);
assert.equal(evidence.poststate.taxonomyAssignmentState, "shadow");
assert.equal(evidence.poststate.d5cD5dLiveAllowlistCount, 3);
assert.equal(evidence.poststate.cosrxInD5cD5dAllowlist, false);
assert.equal(evidence.poststate.d5dActivationEnabled, true);
assert.equal(evidence.poststate.d5dAuthorizedPhase, "DATA-AI29C-D5D");
assert.equal(evidence.poststate.recommendationAdmissionChanged, false);
assert.equal(evidence.poststate.productionRankingChanged, false);
assert.equal(evidence.poststate.publicSearchCutover, false);
assert.equal(evidence.poststate.uvaActivated, false);
assert.equal(evidence.poststate.waterResistanceActivated, false);

const d5cContract = fs.readFileSync(
  "lib/sunscreen-d5c-canary-authority-contract.mjs",
  "utf8",
);
for (const id of evidence.poststate.d5cD5dLiveAllowlistProductIds) {
  assert.ok(d5cContract.includes(id));
}
assert.equal(
  d5cContract.includes(evidence.target.productId),
  false,
  "D5E-B must not widen the D5C/D5D live allowlist",
);

assert.equal(evidence.mainDriftDuringExecution.observed, true);
assert.equal(
  evidence.mainDriftDuringExecution.overlapWithD5eBAuthoritySurface,
  false,
);

assert.equal(
  evidence.nextGate,
  "DATA-AI29C-D5E-C_COSRX_SUNSCREEN_SEMANTIC_BUNDLE",
);
assert.equal(
  evidence.nextGateAuthorizedAfter,
  "D5E_B_EVIDENCE_MERGED_AND_CI_PASS",
);

console.log(JSON.stringify({
  status: "PASS",
  stage: evidence.stage,
  decision: evidence.decision,
  admissionCriticalCurrentCount:
    evidence.poststate.admissionCriticalCurrentCount,
  governedEvidenceCount: evidence.lineageSummary.governedEvidenceCount,
  confirmationRowCount: evidence.lineageSummary.confirmationRowCount,
  liveAllowlistCount: evidence.poststate.d5cD5dLiveAllowlistCount,
  cosrxLive: evidence.poststate.cosrxInD5cD5dAllowlist,
  nextGate: evidence.nextGate,
}, null, 2));
