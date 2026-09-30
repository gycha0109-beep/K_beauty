#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import {
  SUNSCREEN_WATER_JCIA_LABEL_MAPPING_VERSION,
  mapJciaUvWaterResistanceLabel,
} from "../lib/sunscreen-water-jcia-label-mapping.mjs";

const fixture = JSON.parse(
  fs.readFileSync(
    "fixtures/data-ai29c-water-b1-governed-label-mapping-v1.json",
    "utf8",
  ),
);
const frontier = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-water-b-evidence-frontier-v1.json",
    "utf8",
  ),
);

assert.equal(
  frontier.decision,
  "WATER_B_EVIDENCE_FRONTIER_PASS_SEMANTIC_MAPPING_REVIEW_REQUIRED",
);
assert.equal(
  SUNSCREEN_WATER_JCIA_LABEL_MAPPING_VERSION,
  "sunscreen-water-jcia-label-mapping-v1",
);

for (const [label, minutes] of [
  ["UV耐水性★", 40],
  ["UV耐水性☆", 40],
  ["UV耐水性★★", 80],
  ["UV耐水性☆☆", 80],
]) {
  const result = mapJciaUvWaterResistanceLabel({
    label,
    market: "JP",
    exactSubjectMatch: true,
    officialProductClaim: true,
  });
  assert.equal(result.eligible, true);
  assert.equal(result.projection.valueNumber, minutes);
  assert.equal(result.projection.valueUnit, "minutes");
  assert.equal(
    result.projection.qualifier.metric,
    "SPF_retention_percentage",
  );
  assert.equal(
    result.projection.qualifier.method_context,
    "ISO_18861_JCIA_UV_water_resistance",
  );
  assert.equal(
    result.projection.interpretation,
    "standardized_test_immersion_condition_not_real_world_effect_duration",
  );
  assert.equal(result.projection.sweatResistanceImplied, false);
}

assert.equal(
  mapJciaUvWaterResistanceLabel({
    label: "UV耐水性★★",
    market: "KR",
    exactSubjectMatch: true,
    officialProductClaim: true,
  }).eligible,
  false,
);
assert.equal(
  mapJciaUvWaterResistanceLabel({
    label: "UV耐水性★★",
    market: "JP",
    exactSubjectMatch: false,
    officialProductClaim: true,
  }).eligible,
  false,
);
assert.equal(
  mapJciaUvWaterResistanceLabel({
    label: "super waterproof",
    market: "JP",
    exactSubjectMatch: true,
    officialProductClaim: true,
  }).eligible,
  false,
);

assert.equal(fixture.mappingPolicyVersion, SUNSCREEN_WATER_JCIA_LABEL_MAPPING_VERSION);
assert.equal(
  fixture.normativeSemanticAuthority.policyRole,
  "semantic_decoder_not_product_evidence",
);
assert.equal(
  fixture.normativeSemanticAuthority.sweatSemanticsExcluded,
  true,
);
assert.equal(
  fixture.normativeSemanticAuthority.realWorldDurationGuaranteeExcluded,
  true,
);
assert.equal(
  fixture.admissibilityGate.standardSourceMustNotBeBoundAsExactProductEvidence,
  true,
);

const candidate = fixture.anessaCandidate;
assert.equal(candidate.subjectId, "d1d748c3-8706-4b6c-8719-676f6f317532");
assert.equal(candidate.market, "JP");
assert.equal(candidate.observedLabel, "UV耐水性★★");
assert.equal(candidate.productEvidenceClass, "product_claim");
assert.equal(candidate.productEvidenceAuthority, "product_specific_primary");
assert.deepEqual(candidate.mappedValue, {
  valueType: "number_unit",
  valueNumber: 80,
  valueUnit: "minutes",
  qualifier: {
    metric: "SPF_retention_percentage",
    method_context: "ISO_18861_JCIA_UV_water_resistance",
    timepoint: "after_total_80_min_water_immersion",
  },
});
assert.equal(candidate.controlledEvidenceIngestEligible, true);
assert.equal(candidate.autoConfirmationEligible, false);

for (const forbidden of [
  "WATERPROOF_WORD_TO_MINUTES",
  "SUPER_WATERPROOF_WORD_TO_MINUTES",
  "SWEAT_RESISTANT_TO_JCIA_WATER_DURATION",
  "JCIA_STANDARD_AS_EXACT_PRODUCT_EVIDENCE",
  "JCIA_LABEL_OUTSIDE_JP_MARKET",
  "LABEL_TO_REAL_WORLD_EFFECT_DURATION_GUARANTEE",
  "OUT_OF_CORPUS_PRODUCT_TRANSFER",
  "MISSING_TO_ZERO",
]) {
  assert.ok(fixture.forbiddenMappings.includes(forbidden));
}

assert.equal(
  fixture.nextGate.stage,
  "WATER_C_CONTROLLED_ANESSA_FACT_ADOPTION",
);
assert.equal(fixture.nextGate.allowed, true);
assert.ok(Object.values(fixture.limits).every((value) => value === false));
assert.equal(
  fixture.decision,
  "WATER_B1_GOVERNED_LABEL_MAPPING_PASS_CONTROLLED_ADOPTION_CANDIDATE",
);

const source = fs.readFileSync(
  "lib/sunscreen-water-jcia-label-mapping.mjs",
  "utf8",
);
assert.equal(source.includes("admin_confirm_product_fact_v1"), false);
assert.equal(source.includes("admin_ingest_product_fact_evidence_v1"), false);

console.log(JSON.stringify({
  status: "PASS",
  stage: "DATA-AI29C-WATER-B1",
  mappingPolicyVersion: SUNSCREEN_WATER_JCIA_LABEL_MAPPING_VERSION,
  anessaMappedMinutes: candidate.mappedValue.valueNumber,
  controlledEvidenceIngestEligible: candidate.controlledEvidenceIngestEligible,
  autoConfirmationEligible: candidate.autoConfirmationEligible,
  decision: fixture.decision,
}));
