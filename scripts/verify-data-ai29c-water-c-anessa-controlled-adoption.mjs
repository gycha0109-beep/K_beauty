#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const waterA = JSON.parse(
  fs.readFileSync("fixtures/data-ai29c-water-a-intent-contract-v1.json", "utf8"),
);
const waterB1 = JSON.parse(
  fs.readFileSync(
    "fixtures/data-ai29c-water-b1-governed-label-mapping-v1.json",
    "utf8",
  ),
);
const adoption = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-water-c-anessa-controlled-adoption-v1.json",
    "utf8",
  ),
);

assert.equal(
  waterA.decision,
  "WATER_A_CANONICAL_INTENT_CONTRACT_FROZEN_RUNTIME_NOT_WIRED",
);
assert.equal(
  waterB1.decision,
  "WATER_B1_GOVERNED_LABEL_MAPPING_PASS_CONTROLLED_ADOPTION_CANDIDATE",
);

assert.equal(adoption.version, "data-ai29c-water-c-anessa-controlled-adoption-v1");
assert.equal(adoption.productionProject, "bygrczggxfuisupcevaz");
assert.equal(adoption.product.market, "JP");
assert.equal(adoption.product.variantKey, "NA");

assert.equal(
  adoption.governance.mappingPolicyVersion,
  "sunscreen-water-jcia-label-mapping-v1",
);
assert.equal(
  adoption.governance.factKey,
  "water_resistance_duration",
);

assert.equal(adoption.source.bindingState, "exact_subject_match");
assert.equal(adoption.source.scopeRelation, "equivalent");
assert.equal(adoption.source.observedLabel, "UV耐水性★★");

assert.equal(adoption.evidence.evidenceClass, "product_claim");
assert.equal(
  adoption.evidence.evidenceAuthority,
  "product_specific_primary",
);
assert.equal(adoption.evidence.confidence, "medium");
assert.equal(adoption.evidence.supportDirection, "supports");

assert.deepEqual(adoption.review.stateSequence, [
  "under_review",
  "ready_for_confirm",
  "confirmed",
]);
assert.equal(adoption.review.finalOperationalState, "confirmed");

assert.equal(adoption.preflight.status, "ready");
assert.deepEqual(adoption.preflight.expectedWriteSet, {
  product_fact_instances: 1,
  product_fact_current: 1,
  product_fact_confirmations: 1,
  product_fact_evidence_links: 1,
  product_fact_review_events: 1,
  product_fact_review_assignments_update: 1,
});

assert.equal(adoption.confirmedFact.semanticStatus, "supported");
assert.equal(adoption.confirmedFact.valueType, "number_unit");
assert.equal(adoption.confirmedFact.valueNumber, 80);
assert.equal(adoption.confirmedFact.valueUnit, "minutes");
assert.equal(adoption.confirmedFact.market, "JP");
assert.equal(
  adoption.confirmedFact.authorityCeiling,
  "product_specific_primary",
);
assert.equal(adoption.confirmedFact.fusedConfidence, "medium");
assert.deepEqual(adoption.confirmedFact.qualifier, {
  metric: "SPF_retention_percentage",
  method_context: "ISO_18861_JCIA_UV_water_resistance",
  timepoint: "after_total_80_min_water_immersion",
  mapping_policy_version: "sunscreen-water-jcia-label-mapping-v1",
  interpretation:
    "standardized_test_immersion_condition_not_real_world_effect_duration",
  observed_label: "UV耐水性★★",
});

assert.deepEqual(adoption.verification, {
  currentReadbackPass: true,
  supportingEvidenceLinkCount: 1,
  confirmationReplayIdempotent: true,
  prospectiveCorpusCount: 20,
  waterEligibleBefore: 0,
  waterEligibleAfter: 1,
  waterAuthorityCoverage: "1/20",
});

assert.ok(
  Object.values(adoption.limits).every((value) => value === false),
);

assert.equal(
  adoption.decision,
  "WATER_C_ANESSA_CONTROLLED_FACT_ADOPTION_PASS",
);

const intentSource = fs.readFileSync(
  "lib/product-query-intent-contract.mjs",
  "utf8",
);
assert.equal(intentSource.includes('"water_resistance_needed"'), false);

const scorerSource = fs.readFileSync(
  "lib/sunscreen-protection-shadow-scoring.mjs",
  "utf8",
);
assert.equal(
  scorerSource.includes("sunscreen-water-intent-contract"),
  false,
);
assert.ok(
  scorerSource.includes(
    '"waterResistance:water_resistance_intent_not_available"',
  ),
);

console.log(JSON.stringify({
  status: "PASS",
  stage: "DATA-AI29C-WATER-C",
  factInstanceId: adoption.confirmedFact.factInstanceId,
  confirmationId: adoption.confirmedFact.confirmationId,
  waterAuthorityCoverage: adoption.verification.waterAuthorityCoverage,
  runtimeWired: false,
  waterAxisActivated: false,
  decision: adoption.decision,
}));
