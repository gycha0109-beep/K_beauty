#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";

const r3h = JSON.parse(fs.readFileSync(
  "evidence/product-fact-catalog-expansion-v1/data-ai29c-uva-r3h-day-dew-broad-spectrum-governed-pilot-v1.json",
  "utf8",
));
const r3i = JSON.parse(fs.readFileSync(
  "evidence/product-fact-catalog-expansion-v1/data-ai29c-uva-r3i-skin1004-broad-spectrum-recovery-v1.json",
  "utf8",
));
const prospective = JSON.parse(fs.readFileSync(
  "evidence/product-fact-catalog-expansion-v1/data-ai29c-c6g-prospective-protection-shadow-input-v1.json",
  "utf8",
));
const d2 = JSON.parse(fs.readFileSync(
  "fixtures/data-ai29c-d2-sunscreen-initial-admission-v1.json",
  "utf8",
));
const contract = fs.readFileSync(
  "lib/recommendation-sunscreen-protection-authority-contract.mjs",
  "utf8",
);
const projection = fs.readFileSync(
  "lib/sunscreen-protection-projection.mjs",
  "utf8",
);

assert.equal(r3h.decision, "UVA_R3H_DAY_DEW_BROAD_SPECTRUM_GOVERNED_FACT_PILOT_PASS");
assert.equal(r3i.stage, "DATA-AI29C-UVA-R3I");
assert.equal(r3i.track, "taxonomy-ai");
assert.equal(r3i.identity.market, "US");
assert.equal(r3i.identity.variantKey, "HYALU_CICA_WATER_FIT_SUN_SERUM_UV_US_50ML");
assert.equal(r3i.registryAuthority.serializerVersion, "product-fact-proposition-schema-v2");
assert.equal(r3i.registryAuthority.valueIdentity, null);
assert.equal(r3i.confirmation.valueBoolean, true);
assert.equal(r3i.confirmation.semanticStatus, "supported");
assert.equal(r3i.confirmation.authorityCeiling, "product_specific_primary");
assert.equal(r3i.evidence.evidenceAuthority, "product_specific_primary");
assert.equal(r3i.evidence.supportDirection, "supports");
assert.equal(r3i.review.finalOperationalState, "confirmed");
assert.deepEqual(r3i.review.lifecycle, ["queued","under_review","ready_for_confirm","confirmed"]);

const preserved = new Map(r3i.preservedFacts.map((row) => [row.factKey,row]));
assert.equal(preserved.get("spf_value").factInstanceId, "304b8be8-e80a-49a5-9ceb-dfafef6b0828");
assert.equal(preserved.get("spf_value").confirmationId, "eea66ab9-abee-46c5-bb57-e3f9f119e5b3");
assert.equal(preserved.get("uv_filter_type").factInstanceId, "342002d4-b0c6-40d8-9903-68a716c77c11");
assert.equal(preserved.get("uv_filter_type").confirmationId, "ff4356be-b9f3-452a-9ae0-c7960585b502");

assert.equal(r3i.uvaLabelHold.currentFactCount, 0);
assert.equal(r3i.uvaLabelHold.state, "BLOCKED");
assert.equal(r3i.uvaLabelHold.blockerCode, "EVIDENCE_INSUFFICIENT");
assert.equal(r3i.uvaLabelHold.broadSpectrumDoesNotResolveUvaLabel, true);

assert.equal(r3i.productionReadback.currentFactCount, 94);
assert.equal(r3i.productionReadback.broadSpectrumCurrentFactCount, 2);
assert.equal(r3i.productionReadback.governedWaterFactCount, 2);
assert.deepEqual(r3i.productionReadback.skin1004CurrentFactKeys, [
  "broad_spectrum","spf_value","uv_filter_type",
]);

assert.equal(contract.includes('"broad_spectrum"'), false);
assert.equal(projection.includes('"broad_spectrum"'), false);
assert.equal(prospective.records.length, 20);
assert.equal(
  prospective.records.some((row) => row.product_id === r3i.identity.productId),
  true,
);
assert.equal(JSON.stringify(d2).includes(r3i.identity.productId), false);

assert.equal(r3i.recommendationBoundary.protectionAuthorityContractConsumesBroadSpectrum, false);
assert.equal(r3i.recommendationBoundary.sunscreenProjectionConsumesBroadSpectrum, false);
assert.equal(r3i.recommendationBoundary.frozenProspectiveCorpusContainsSkin1004, true);
assert.equal(r3i.recommendationBoundary.d2InitialAdmissionContainsSkin1004, false);
assert.equal(r3i.recommendationBoundary.recommendationAdmissionGrantedByThisStage, false);
assert.equal(r3i.recommendationBoundary.rankingChanged, false);
assert.equal(r3i.recommendationBoundary.productionCutoverAuthorized, false);
assert.equal(r3i.recommendationBoundary.outdoorRankableSignalAuthorized, false);
assert.equal(r3i.recommendationBoundary.publicActivation, false);

assert.equal(r3i.decision, "UVA_R3I_SKIN1004_BROAD_SPECTRUM_SECOND_SUBJECT_PASS");
assert.equal(r3i.nextGate, "DATA-AI29C-UVA-R3J_BROAD_SPECTRUM_COVERAGE_RECON");

console.log(JSON.stringify({
  status:"PASS",
  stage:r3i.stage,
  productId:r3i.identity.productId,
  propositionKey:r3i.registryAuthority.propositionKey,
  currentFacts:r3i.productionReadback.currentFactCount,
  broadSpectrumCurrent:r3i.productionReadback.broadSpectrumCurrentFactCount,
  rankingChanged:r3i.recommendationBoundary.rankingChanged,
  decision:r3i.decision,
}));
