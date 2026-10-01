#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";

const r3g = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-uva-r3g-proposition-serializer-contract-v1.json",
    "utf8",
  ),
);
const r3h = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-uva-r3h-day-dew-broad-spectrum-governed-pilot-v1.json",
    "utf8",
  ),
);
const r1 = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-water-d1-r1-day-dew-required-facts-v1.json",
    "utf8",
  ),
);
const prospective = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-c6g-prospective-protection-shadow-input-v1.json",
    "utf8",
  ),
);
const d2 = JSON.parse(
  fs.readFileSync(
    "fixtures/data-ai29c-d2-sunscreen-initial-admission-v1.json",
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

assert.equal(
  r3g.decision,
  "UVA_R3G_PROPOSITION_SERIALIZER_SCHEMA_V2_PASS_POLICY_LOCKED",
);
assert.equal(r3h.stage, "DATA-AI29C-UVA-R3H");
assert.equal(r3h.track, "taxonomy-ai");
assert.equal(r3h.identity.productId, r1.identity.productId);
assert.equal(r3h.identity.subjectId, r1.identity.subjectId);

assert.equal(
  r3h.registryAuthority.serializerVersion,
  "product-fact-proposition-schema-v2",
);
assert.equal(
  r3h.registryAuthority.propositionKey,
  r3g.dayDewPilotIdentity.propositionKey,
);
assert.equal(r3h.registryAuthority.valueIdentity, null);
assert.equal(r3h.registryAuthority.trueAndFalseShareSamePropositionKey, true);

assert.equal(r3h.writePolicy.policyState, "active");
assert.equal(r3h.writePolicy.newLineageAllowed, true);
assert.equal(r3h.writePolicy.existingLineageAllowed, true);
assert.equal(r3h.writePolicy.authorizedPhase, "DATA-AI29C-UVA-R3H");

assert.equal(r3h.governedSource.sourceId, r1.governedEvidenceSource.sourceId);
assert.equal(r3h.governedSource.bindingId, r1.governedEvidenceSource.bindingId);
assert.equal(r3h.governedSource.bindingState, "exact_subject_match");
assert.equal(r3h.governedSource.scopeRelation, "equivalent");
assert.equal(
  r3h.governedSource.observedClaim,
  "SPF 50 broad spectrum UV protection",
);

assert.equal(r3h.evidence.evidenceClass, "product_claim");
assert.equal(r3h.evidence.evidenceAuthority, "product_specific_primary");
assert.equal(r3h.evidence.confidence, "high");
assert.equal(r3h.evidence.supportDirection, "supports");
assert.equal(r3h.evidence.propositionValueIdentity, null);
assert.equal(
  r3h.evidence.canonicalEvidenceDigest,
  r3g.dayDewPilotIdentity.evidenceDigest,
);

assert.equal(r3h.review.finalOperationalState, "confirmed");
assert.deepEqual(r3h.review.lifecycle, [
  "queued",
  "under_review",
  "ready_for_confirm",
  "confirmed",
]);

assert.equal(r3h.confirmation.semanticStatus, "supported");
assert.equal(r3h.confirmation.valueBoolean, true);
assert.equal(r3h.confirmation.authorityCeiling, "product_specific_primary");
assert.equal(r3h.confirmation.fusedConfidence, "high");
assert.equal(r3h.confirmation.current, true);

const preserved = new Map(
  r3h.existingDayDewFactsPreserved.map((row) => [row.factKey, row]),
);
assert.equal(
  preserved.get("spf_value").factInstanceId,
  r1.spfFact.factInstanceId,
);
assert.equal(
  preserved.get("spf_value").confirmationId,
  r1.spfFact.confirmationId,
);
assert.equal(
  preserved.get("uv_filter_type").factInstanceId,
  r1.uvFilterFact.factInstanceId,
);
assert.equal(
  preserved.get("uv_filter_type").confirmationId,
  r1.uvFilterFact.confirmationId,
);
assert.equal(
  preserved.get("water_resistance_duration").factInstanceId,
  r1.existingWaterFact.factInstanceId,
);
assert.equal(
  preserved.get("water_resistance_duration").confirmationId,
  r1.existingWaterFact.confirmationId,
);

assert.equal(r3h.uvaLabelHold.currentFactCount, 0);
assert.equal(r3h.uvaLabelHold.researchTaskState, "BLOCKED");
assert.equal(r3h.uvaLabelHold.blockerCode, "EVIDENCE_INSUFFICIENT");
assert.equal(r3h.uvaLabelHold.broadSpectrumDoesNotResolveUvaLabel, true);

assert.equal(r3h.productionReadback.currentFactCount, 93);
assert.equal(r3h.productionReadback.dayDewCurrentFactCount, 4);
assert.deepEqual(r3h.productionReadback.dayDewCurrentFactKeys, [
  "broad_spectrum",
  "spf_value",
  "uv_filter_type",
  "water_resistance_duration",
]);
assert.equal(r3h.productionReadback.broadSpectrumCurrentFactCount, 1);
assert.equal(r3h.productionReadback.governedWaterFactCount, 2);
assert.equal(r3h.productionReadback.spfAuthenticatedBetaEnabled, true);
assert.equal(r3h.productionReadback.spfAuthorizedPhase, "DATA-AI29C-D5D");

assert.equal(authorityContract.includes('"broad_spectrum"'), false);
assert.equal(projection.includes('"broad_spectrum"'), false);
assert.equal(prospective.records.length, 20);
assert.equal(
  prospective.records.some((row) => row.product_id === r3h.identity.productId),
  false,
);
assert.equal(JSON.stringify(d2).includes(r3h.identity.productId), false);

assert.equal(
  r3h.recommendationBoundary.recommendationProtectionContractConsumesBroadSpectrum,
  false,
);
assert.equal(
  r3h.recommendationBoundary.sunscreenProjectionConsumesBroadSpectrum,
  false,
);
assert.equal(
  r3h.recommendationBoundary.d2InitialAdmissionFixtureContainsDayDew,
  false,
);
assert.equal(
  r3h.recommendationBoundary.frozenProspectiveCorpusContainsDayDew,
  false,
);
assert.equal(r3h.recommendationBoundary.frozenProspectiveCorpusCount, 20);
assert.equal(r3h.recommendationBoundary.frozenProspectiveWaterCoverage, "1/20");
assert.equal(
  r3h.recommendationBoundary.recommendationAdmissionGrantedByThisStage,
  false,
);
assert.equal(r3h.recommendationBoundary.productionRankingChanged, false);
assert.equal(r3h.recommendationBoundary.productionCutoverAuthorized, false);
assert.equal(r3h.recommendationBoundary.outdoorRankableSignalAuthorized, false);
assert.equal(r3h.recommendationBoundary.publicActivation, false);

assert.equal(
  r3h.decision,
  "UVA_R3H_DAY_DEW_BROAD_SPECTRUM_GOVERNED_FACT_PILOT_PASS",
);
assert.equal(
  r3h.nextGate,
  "DATA-AI29C-UVA-R3I_BROAD_SPECTRUM_SECOND_SUBJECT_RECOVERY",
);

console.log(
  JSON.stringify({
    status: "PASS",
    stage: r3h.stage,
    broadSpectrumValue: r3h.confirmation.valueBoolean,
    currentFacts: r3h.productionReadback.currentFactCount,
    dayDewFacts: r3h.productionReadback.dayDewCurrentFactKeys,
    rankingChanged: r3h.recommendationBoundary.productionRankingChanged,
    decision: r3h.decision,
  }),
);
