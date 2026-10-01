#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";

const d1 = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-water-d1-day-dew-controlled-expansion-v1.json",
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

assert.equal(r1.version, "data-ai29c-water-d1-r1-day-dew-required-facts-v1");
assert.equal(r1.stage, "DATA-AI29C-WATER-D1-R1");
assert.equal(r1.track, "taxonomy-ai");
assert.equal(r1.productionProject, "bygrczggxfuisupcevaz");

assert.equal(r1.identity.productId, d1.identity.productId);
assert.equal(
  r1.identity.subjectId,
  d1.subjectCorrection.current.subjectId,
);
assert.equal(r1.identity.market, "US");
assert.equal(r1.identity.variantKey, null);
assert.equal(r1.identity.identityStatus, "resolved");
assert.equal(r1.identity.currentState, "current");

assert.equal(
  r1.officialSource.canonicalLocator,
  d1.officialSource.canonicalLocator,
);
assert.equal(r1.officialSource.market, "US");
assert.equal(r1.officialSource.observedSpfLabel, "SPF 50 broad spectrum UV protection");
assert.equal(r1.officialSource.observedFilterSystem, "chemical sunscreen");
assert.equal(r1.officialSource.registryAdmissibleUvaLabel, null);
assert.deepEqual(r1.officialSource.observedActiveFilters, [
  "Avobenzone 3.0%",
  "Homosalate 7.0%",
  "Octisalate 5.0%",
  "Octocrylene 5.0%",
]);

assert.equal(r1.governedEvidenceSource.bindingState, "exact_subject_match");
assert.equal(r1.governedEvidenceSource.scopeRelation, "equivalent");

assert.equal(r1.spfFact.factKey, "spf_value");
assert.equal(r1.spfFact.valueNumber, 50);
assert.equal(r1.spfFact.valueUnit, null);
assert.deepEqual(r1.spfFact.qualifier, { plus_modifier: "none" });
assert.equal(r1.spfFact.evidenceClass, "product_claim");
assert.equal(r1.spfFact.evidenceAuthority, "product_specific_primary");
assert.equal(r1.spfFact.evidenceConfidence, "high");
assert.equal(r1.spfFact.semanticStatus, "supported");
assert.equal(r1.spfFact.current, true);

assert.equal(r1.uvFilterFact.factKey, "uv_filter_type");
assert.equal(r1.uvFilterFact.valueEnum, "organic");
assert.deepEqual(r1.uvFilterFact.qualifier, {});
assert.equal(r1.uvFilterFact.evidenceClass, "composition_identity");
assert.equal(r1.uvFilterFact.evidenceAuthority, "product_specific_primary");
assert.equal(r1.uvFilterFact.evidenceConfidence, "high");
assert.equal(r1.uvFilterFact.semanticStatus, "supported");
assert.equal(r1.uvFilterFact.current, true);

assert.equal(r1.existingWaterFact.factInstanceId, d1.waterFact.factInstanceId);
assert.equal(r1.existingWaterFact.confirmationId, d1.waterFact.confirmationId);
assert.equal(r1.existingWaterFact.valueNumber, 80);
assert.equal(r1.existingWaterFact.valueUnit, "minutes");
assert.equal(r1.existingWaterFact.mutatedByR1, false);

assert.equal(r1.uvaHold.factKey, "uva_label");
assert.equal(r1.uvaHold.currentFactExists, false);
assert.equal(r1.uvaHold.registryAdmissibleCandidateValue, null);
assert.equal(r1.uvaHold.broadSpectrumToPaForbidden, true);
assert.equal(
  r1.uvaHold.broadSpectrumToUvaPfDeclaredWithoutGovernedRuleForbidden,
  true,
);
assert.equal(r1.uvaHold.researchTaskState, "BLOCKED");
assert.equal(r1.uvaHold.blockerCode, "EVIDENCE_INSUFFICIENT");

assert.deepEqual(
  r1.researchTaskCloseout.map((task) => [task.factKey, task.state]),
  [
    ["spf_value", "ALREADY_COVERED"],
    ["uv_filter_type", "ALREADY_COVERED"],
    ["uva_label", "BLOCKED"],
  ],
);

assert.equal(r1.preflightRecovery.initialFusionInputPreflightRejected, true);
assert.equal(
  r1.preflightRecovery.initialFailureKind,
  "product_fact_confirmation_fusion_input_stale",
);
assert.equal(
  r1.preflightRecovery.businessWriteOccurredOnRejectedPreflight,
  false,
);
assert.equal(r1.preflightRecovery.finalSpfPreflightStatus, "ready");
assert.equal(r1.preflightRecovery.finalUvFilterPreflightStatus, "ready");

assert.deepEqual(
  [...r1.productionReadback.currentDayDewFactKeys].sort(),
  ["spf_value", "uv_filter_type", "water_resistance_duration"].sort(),
);
assert.equal(r1.productionReadback.currentDayDewFactCount, 3);
assert.equal(r1.productionReadback.currentDayDewUvaFactCount, 0);
assert.equal(r1.productionReadback.currentGovernedWaterFactCount, 2);
assert.equal(r1.productionReadback.spfAuthenticatedBetaEnabled, true);
assert.equal(r1.productionReadback.spfAuthorizedPhase, "DATA-AI29C-D5D");
assert.equal(r1.productionReadback.spfProductionStateMutated, false);
assert.equal(r1.productionReadback.waterAxisActivated, false);
assert.equal(r1.productionReadback.waterRankingWired, false);

assert.equal(prospective.records.length, 20);
assert.equal(
  prospective.records.some(
    (record) => record.product_id === r1.identity.productId,
  ),
  false,
  "Day Dew must remain outside the frozen prospective corpus",
);
assert.equal(
  JSON.stringify(d2).includes(r1.identity.productId),
  false,
  "Day Dew must remain outside the D2 initial admission fixture",
);
assert.equal(r1.recommendationBoundary.d2InitialAdmissionFixtureContainsDayDew, false);
assert.equal(r1.recommendationBoundary.frozenProspectiveCorpusContainsDayDew, false);
assert.equal(r1.recommendationBoundary.frozenProspectiveCorpusCount, 20);
assert.equal(r1.recommendationBoundary.frozenProspectiveWaterEligibleCount, 1);
assert.equal(r1.recommendationBoundary.frozenProspectiveWaterCoverage, "1/20");
assert.equal(r1.recommendationBoundary.frozenProspectiveDenominatorRebased, false);
assert.equal(r1.recommendationBoundary.recommendationAdmissionGrantedByThisStage, false);

assert.equal(r1.limits.evidenceRecordWritten, true);
assert.equal(r1.limits.spfProductFactWritten, true);
assert.equal(r1.limits.uvFilterProductFactWritten, true);
assert.equal(r1.limits.uvaProductFactWritten, false);
assert.equal(r1.limits.waterProductFactMutated, false);
assert.equal(r1.limits.recommendationAuthorityMutated, false);
assert.equal(r1.limits.productionRankingChanged, false);
assert.equal(r1.limits.productionCutoverAuthorized, false);
assert.equal(r1.limits.outdoorRankableSignalAuthorized, false);
assert.equal(r1.limits.publicActivation, false);
assert.equal(r1.limits.waterAxisActivated, false);
assert.equal(r1.limits.waterRankingWired, false);
assert.equal(r1.limits.spfProductionStateMutated, false);

assert.equal(
  r1.decision,
  "WATER_D1_R1_DAY_DEW_REQUIRED_FACTS_PARTIAL_PASS_UVA_HOLD",
);
assert.equal(
  r1.nextGate,
  "KEEP_DAY_DEW_RECOMMENDATION_ADMISSION_CLOSED_UNTIL_SEPARATE_D2_REVIEW_AND_UVA_GOVERNANCE_RESOLUTION",
);

console.log(
  JSON.stringify({
    status: "PASS",
    stage: r1.stage,
    dayDewCurrentFacts: r1.productionReadback.currentDayDewFactKeys,
    uvaState: r1.uvaHold.researchTaskState,
    inD2Admission: r1.recommendationBoundary.d2InitialAdmissionFixtureContainsDayDew,
    inFrozenProspective:
      r1.recommendationBoundary.frozenProspectiveCorpusContainsDayDew,
    frozenWaterCoverage:
      r1.recommendationBoundary.frozenProspectiveWaterCoverage,
    decision: r1.decision,
  }),
);
