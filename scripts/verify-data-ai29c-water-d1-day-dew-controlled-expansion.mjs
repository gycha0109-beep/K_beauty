#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const artifact = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-water-d1-day-dew-controlled-expansion-v1.json",
    "utf8",
  ),
);
const prospective = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-c6g-prospective-protection-shadow-input-v1.json",
    "utf8",
  ),
);

assert.equal(
  artifact.version,
  "data-ai29c-water-d1-day-dew-controlled-expansion-v1",
);
assert.equal(artifact.stage, "DATA-AI29C-WATER-D1");
assert.equal(artifact.identity.productId, "6852eeda-eb1d-4c4e-8bea-b30a26126a9c");
assert.equal(
  artifact.subjectCorrection.current.subjectId,
  "4f64fa1b-6af7-4767-b818-f1178d4fe986",
);
assert.equal(artifact.subjectCorrection.current.variantKey, null);
assert.equal(artifact.subjectCorrection.current.marketApplicability, "US");
assert.equal(artifact.subjectCorrection.current.currentState, "current");
assert.equal(
  artifact.subjectCorrection.predecessor.currentState,
  "historical",
);
assert.equal(artifact.subjectCorrection.authorityAttachedBeforeCorrection, false);

assert.equal(artifact.trustIntake.market, "US");
assert.equal(artifact.trustIntake.identityState, "EXACT_SUBJECT_FOUND");
assert.equal(
  artifact.trustIntake.subjectId,
  artifact.subjectCorrection.current.subjectId,
);
assert.equal(artifact.trustIntake.presentationRelationProven, true);

assert.equal(artifact.waterFact.factKey, "water_resistance_duration");
assert.equal(artifact.waterFact.valueNumber, 80);
assert.equal(artifact.waterFact.valueUnit, "minutes");
assert.equal(artifact.waterFact.market, "US");
assert.equal(artifact.waterFact.evidenceAuthority, "product_specific_primary");
assert.equal(artifact.waterFact.evidenceConfidence, "high");
assert.equal(artifact.waterFact.assignmentState, "confirmed");
assert.equal(
  artifact.waterFact.qualifier.method_context,
  "FDA_2021_water_resistance_human_study",
);
assert.equal(
  artifact.waterFact.qualifier.interpretation,
  "direct_product_specific_water_resistance_duration_claim",
);

assert.equal(artifact.authorityReadback.currentGovernedWaterFactCount, 2);
assert.equal(artifact.authorityReadback.currentGovernedWaterSubjectCount, 2);

assert.equal(prospective.records.length, 20);
assert.equal(
  prospective.records.some(
    (record) =>
      record.product_id === artifact.identity.productId,
  ),
  false,
  "Day Dew must not silently enter the frozen prospective 20-product corpus",
);
assert.equal(
  prospective.records.filter((record) => record.water_bucket != null).length,
  0,
  "committed C6G frozen input must remain unchanged",
);

assert.equal(
  artifact.prospectiveCohortBoundary.frozenProspectiveCorpusCount,
  20,
);
assert.equal(
  artifact.prospectiveCohortBoundary.dayDewIncludedInFrozenProspectiveCorpus,
  false,
);
assert.equal(
  artifact.prospectiveCohortBoundary.frozenProspectiveWaterEligibleCount,
  1,
);
assert.equal(
  artifact.prospectiveCohortBoundary.frozenProspectiveWaterCoverage,
  "1/20",
);
assert.equal(
  artifact.prospectiveCohortBoundary.doNotRebaseFrozenProspectiveDenominatorTo21,
  true,
);

assert.deepEqual(
  artifact.requiredFactTasks.map((task) => [task.factKey, task.state]),
  [
    ["spf_value", "RESEARCH_PENDING"],
    ["uva_label", "RESEARCH_PENDING"],
    ["uv_filter_type", "RESEARCH_PENDING"],
  ],
);

assert.equal(artifact.identity.recommendationAdmissionGranted, false);
assert.equal(artifact.productionInvariants.spfAuthenticatedBetaEnabled, true);
assert.equal(
  artifact.productionInvariants.spfAuthorizedPhase,
  "DATA-AI29C-D5D",
);
assert.equal(artifact.productionInvariants.spfProductionStateMutated, false);
assert.equal(artifact.productionInvariants.waterAxisActivated, false);
assert.equal(artifact.productionInvariants.waterRankingWired, false);
assert.equal(
  artifact.productionInvariants.productionRankingChangedByWater,
  false,
);
assert.equal(
  artifact.productionInvariants.productionCutoverAuthorized,
  false,
);
assert.equal(
  artifact.productionInvariants.outdoorRankableSignalAuthorized,
  false,
);
assert.equal(artifact.productionInvariants.publicActivation, false);
assert.equal(
  artifact.productionInvariants.sephoraUsedAsProductFactAuthority,
  false,
);

assert.equal(
  artifact.decision,
  "WATER_D1_DAY_DEW_GOVERNED_WATER_FACT_PASS_RANKING_COHORT_UNCHANGED",
);

console.log(
  JSON.stringify({
    status: "PASS",
    stage: artifact.stage,
    governedWaterFacts: artifact.authorityReadback.currentGovernedWaterFactCount,
    frozenProspectiveWaterCoverage:
      artifact.prospectiveCohortBoundary.frozenProspectiveWaterCoverage,
    dayDewRankingCohortAdmission:
      artifact.prospectiveCohortBoundary.dayDewIncludedInFrozenProspectiveCorpus,
    waterAxisActivated: artifact.productionInvariants.waterAxisActivated,
    decision: artifact.decision,
  }),
);
