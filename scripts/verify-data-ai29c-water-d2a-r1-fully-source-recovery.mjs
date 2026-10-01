#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";

const d2a = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-water-d2a-frozen20-authority-recon-v1.json",
    "utf8",
  ),
);
const r1 = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-water-d2a-r1-fully-source-recovery-v1.json",
    "utf8",
  ),
);
const prospective = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-c6g-prospective-protection-shadow-input-v1.json",
    "utf8",
  ),
);

assert.equal(r1.version, "data-ai29c-water-d2a-r1-fully-source-recovery-v1");
assert.equal(r1.stage, "DATA-AI29C-WATER-D2A-R1");
assert.equal(r1.track, "taxonomy-ai");
assert.equal(r1.productionProject, "bygrczggxfuisupcevaz");

const fullyId = "df32d800-2f16-4511-8efa-dc353ea1c2ef";
const fullySubject = "d677c25a-508d-42f8-a0e4-e76d6f9abb0c";

assert.equal(r1.target.productId, fullyId);
assert.equal(r1.target.subjectId, fullySubject);
assert.equal(r1.target.market, "KR");
assert.equal(r1.target.variantKey, null);

assert.equal(d2a.sourceBindingAudit.firstPartySourceGapCount, 1);
assert.deepEqual(d2a.sourceBindingAudit.firstPartySourceGapProductIds, [fullyId]);

const d2aFully = d2a.targets.find((target) => target.productId === fullyId);
assert.ok(d2aFully);
assert.equal(d2aFully.subjectId, fullySubject);
assert.equal(d2aFully.decision, "HOLD_FIRST_PARTY_SOURCE_NOT_ESTABLISHED");

assert.equal(
  r1.officialSource.canonicalLocator,
  "https://www.full-y.co.kr/product/detail.html?cate_no=49&display_group=1&product_no=117",
);
assert.equal(r1.officialSource.sourceKind, "official_product_page");
assert.equal(r1.officialSource.market, "KR");
assert.equal(r1.officialSource.directWaterResistanceDurationClaim, null);
assert.equal(r1.officialSource.genericWaterproofClaim, false);

assert.equal(r1.governedSourceRegistration.status, "binding_recorded");
assert.equal(
  r1.governedSourceRegistration.sourceId,
  "be715dd9-f911-4366-b2cd-b3dda7e4e68a",
);
assert.equal(
  r1.governedSourceRegistration.bindingId,
  "7fbd65af-60fa-47a7-bd84-85727da51888",
);
assert.equal(r1.governedSourceRegistration.bindingState, "exact_subject_match");
assert.equal(r1.governedSourceRegistration.scopeRelation, "equivalent");
assert.equal(r1.governedSourceRegistration.sourceInserted, true);
assert.equal(r1.governedSourceRegistration.bindingInserted, true);
assert.equal(r1.governedSourceRegistration.evidenceId, null);
assert.equal(r1.governedSourceRegistration.evidenceInserted, false);

assert.equal(r1.operationalProjection.status, "projected");
assert.equal(r1.operationalProjection.sourceName, "fully_official");
assert.equal(
  r1.operationalProjection.productFactAuthorityMutated,
  false,
);
assert.equal(
  r1.operationalProjection.recommendationAuthorityMutated,
  false,
);
assert.equal(
  r1.operationalProjection.productionCutoverAuthorized,
  false,
);

assert.equal(prospective.records.length, 20);
assert.equal(
  prospective.records.some((record) => record.product_id === fullyId),
  true,
);
assert.equal(r1.productionReadback.frozenProspectiveCorpusCount, 20);
assert.equal(r1.productionReadback.currentGovernedWaterFactCount, 2);
assert.equal(r1.productionReadback.fullyCurrentGovernedWaterFactCount, 0);
assert.equal(r1.productionReadback.frozenWaterEligibleCount, 1);
assert.equal(r1.productionReadback.frozenWaterCoverage, "1/20");
assert.equal(r1.productionReadback.spfAuthenticatedBetaEnabled, true);
assert.equal(r1.productionReadback.spfAuthorizedPhase, "DATA-AI29C-D5D");

assert.deepEqual(r1.d2aDelta, {
  previousFirstPartyBoundTargetCount: 18,
  currentFirstPartyBoundTargetCount: 19,
  previousFirstPartySourceGapCount: 1,
  currentFirstPartySourceGapCount: 0,
  resolvedSourceGapProductIds: [fullyId],
  newDurationAuthorityCount: 0,
  newConfirmationEligibleCount: 0,
  d2bGovernedAdoptionRequired: false,
});

for (const value of Object.values(r1.semanticBoundaries)) {
  assert.equal(value, true);
}

assert.equal(r1.limits.productEvidenceSourceWritten, true);
assert.equal(r1.limits.productEvidenceSubjectBindingWritten, true);
assert.equal(r1.limits.operationalProductSourceBindingWritten, true);
assert.equal(r1.limits.trustOfficialSourceReviewWritten, true);
assert.equal(r1.limits.evidenceRecordWritten, false);
assert.equal(r1.limits.productFactWritten, false);
assert.equal(r1.limits.productFactCurrentWritten, false);
assert.equal(r1.limits.recommendationAuthorityMutated, false);
assert.equal(r1.limits.waterAxisActivated, false);
assert.equal(r1.limits.waterRankingWired, false);
assert.equal(r1.limits.productionRankingChanged, false);
assert.equal(r1.limits.productionCutoverAuthorized, false);
assert.equal(r1.limits.outdoorRankableSignalAuthorized, false);
assert.equal(r1.limits.publicActivation, false);
assert.equal(r1.limits.spfProductionStateMutated, false);

assert.equal(
  r1.decision,
  "WATER_D2A_R1_FULLY_SOURCE_RECOVERY_PASS_NO_DURATION_AUTHORITY",
);
assert.equal(
  r1.nextGate,
  "NO_D2B_ADOPTION_PROCEED_TO_SEPARATE_GOVERNED_PRODUCT_FACT_RESEARCH",
);

console.log(
  JSON.stringify({
    status: "PASS",
    stage: r1.stage,
    firstPartyBoundTargets: r1.d2aDelta.currentFirstPartyBoundTargetCount,
    remainingSourceGaps: r1.d2aDelta.currentFirstPartySourceGapCount,
    newDurationAuthority: r1.d2aDelta.newDurationAuthorityCount,
    frozenWaterCoverage: r1.productionReadback.frozenWaterCoverage,
    decision: r1.decision,
  }),
);
