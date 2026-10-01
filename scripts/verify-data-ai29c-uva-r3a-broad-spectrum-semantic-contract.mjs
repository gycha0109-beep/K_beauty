#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";

const r3a = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-uva-r3a-broad-spectrum-semantic-contract-v1.json",
    "utf8",
  ),
);
const r2 = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-uva-r2-exact-subject-research-v1.json",
    "utf8",
  ),
);
const dayDew = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-water-d1-r1-day-dew-required-facts-v1.json",
    "utf8",
  ),
);
const authorityContract = fs.readFileSync(
  "lib/recommendation-sunscreen-protection-authority-contract.mjs",
  "utf8",
);
const projection = fs.readFileSync(
  "lib/sunscreen-protection-projection.mjs",
  "utf8",
);

assert.equal(r3a.stage, "DATA-AI29C-UVA-R3A");
assert.equal(r3a.track, "taxonomy-ai");
assert.equal(r3a.currentUvaRegistry.factKey, "uva_label");
assert.deepEqual(r3a.currentUvaRegistry.allowedValues, [
  "PA+",
  "PA++",
  "PA+++",
  "PA++++",
  "UVA-PF-declared",
]);

const proposed = r3a.proposedFactDefinition;
assert.equal(proposed.fact_key, "broad_spectrum");
assert.equal(proposed.value_type, "boolean");
assert.equal(proposed.cardinality, "one");
assert.deepEqual(proposed.domain_scope, ["sunscreen"]);
assert.deepEqual(proposed.scope_schema.required_fields, ["market"]);
assert.deepEqual(proposed.permitted_evidence_classes, ["product_claim"]);
assert.equal(proposed.negative_evidence_requirement, "explicit_negative_only");
assert.equal(proposed.measurementEvidenceDeferred, true);
assert.deepEqual(proposed.proposition_identity_schema.qualifier_dimensions, []);

const dayDewCandidate = r3a.candidateObservations.find(
  (row) => row.productId === dayDew.identity.productId,
);
assert.ok(dayDewCandidate);
assert.equal(dayDewCandidate.subjectId, dayDew.identity.subjectId);
assert.equal(dayDewCandidate.market, "US");
assert.equal(dayDewCandidate.candidateValue, true);
assert.equal(dayDewCandidate.recommendationRankingEligible, false);

const skin1004 = r3a.candidateObservations.find(
  (row) => row.productId === "fdf06871-db8e-4e73-a48c-c057c5ce925d",
);
assert.ok(skin1004);
assert.equal(skin1004.subjectId, "9dcd611d-e353-47f5-b349-e1f22d73551e");
assert.equal(skin1004.market, "US");
assert.equal(skin1004.candidateValue, true);

const r2Skin1004 = r2.targets.find(
  (row) => row.productId === skin1004.productId,
);
assert.ok(r2Skin1004);
assert.equal(r2Skin1004.candidateValue, null);
assert.ok(r2.forbiddenConversions.includes("BROAD_SPECTRUM_TO_PA"));
assert.ok(
  r2.forbiddenConversions.includes(
    "BROAD_SPECTRUM_TO_UVA_PF_DECLARED_WITHOUT_GOVERNED_RULE",
  ),
);

for (const value of Object.values(r3a.semanticBoundaries)) {
  assert.equal(value, true);
}

assert.deepEqual(r3a.currentRecommendationProjection.factKeys, [
  "spf_value",
  "uva_label",
  "water_resistance_duration",
]);
assert.equal(r3a.currentRecommendationProjection.broadSpectrumConsumed, false);
assert.equal(r3a.currentRecommendationProjection.broadSpectrumRankingBucket, null);

assert.ok(
  authorityContract.includes('"spf_value"') &&
    authorityContract.includes('"uva_label"') &&
    authorityContract.includes('"water_resistance_duration"'),
);
assert.equal(authorityContract.includes('"broad_spectrum"'), false);
assert.equal(projection.includes('findEligibleFact(authority, "broad_spectrum")'), false);

assert.equal(r3a.adoptionBoundary.registryPublishAuthorized, false);
assert.equal(r3a.adoptionBoundary.productFactWriteAuthorized, false);
assert.equal(r3a.adoptionBoundary.recommendationAuthorityContractChanged, false);
assert.equal(r3a.adoptionBoundary.recommendationProjectionChanged, false);
assert.equal(r3a.adoptionBoundary.uvaRankingChanged, false);
assert.equal(r3a.adoptionBoundary.productionRankingChanged, false);
assert.equal(r3a.adoptionBoundary.publicActivation, false);

assert.equal(
  r3a.decision,
  "BROAD_SPECTRUM_SEPARATE_FACT_SEMANTICS_PASS",
);
assert.equal(
  r3a.nextGate,
  "AUDIT_REGISTRY_VERSION_COMPATIBILITY_BEFORE_ANY_REGISTRY_PUBLISH",
);

console.log(
  JSON.stringify({
    status: "PASS",
    stage: r3a.stage,
    proposedFactKey: proposed.fact_key,
    candidateTrueCount: r3a.candidateObservations.filter(
      (row) => row.candidateValue === true,
    ).length,
    recommendationConsumed:
      r3a.currentRecommendationProjection.broadSpectrumConsumed,
    registryPublishAuthorized:
      r3a.adoptionBoundary.registryPublishAuthorized,
    decision: r3a.decision,
  }),
);
