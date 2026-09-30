#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";

const r1 = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-uva-r1-live-authority-recon-v1.json",
    "utf8",
  ),
);
const r2 = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-uva-r2-exact-subject-research-v1.json",
    "utf8",
  ),
);

assert.equal(r2.version, "data-ai29c-uva-r2-exact-subject-research-v1");
assert.equal(r2.track, "taxonomy-ai");
assert.equal(r2.productionProject, "bygrczggxfuisupcevaz");

assert.equal(r1.decision, "UVA_R1_LIVE_RECON_PASS_R2_EXACT_SUBJECT_RESEARCH_REQUIRED");
assert.equal(r2.entryState.comparableCorpusCount, r1.comparableCorpus.count);
assert.equal(
  r2.entryState.currentUvaEligibleCount,
  r1.comparableCorpus.uvaAuthority.eligibleCount,
);
assert.equal(
  r2.entryState.currentUvaMissingCount,
  r1.comparableCorpus.uvaAuthority.missingCount,
);
assert.deepEqual(
  r2.entryState.missingProductIds,
  r1.comparableCorpus.uvaAuthority.missingProductIds,
);

assert.equal(r2.registry.registryVersion, r1.registry.registryVersion);
assert.equal(r2.registry.factKey, r1.factKey);
assert.equal(r2.registry.definitionChecksum, r1.registry.definitionChecksum);
assert.deepEqual(r2.registry.allowedValues, r1.registry.allowedValues);
assert.equal(
  r2.registry.positiveEvidenceRequirement,
  r1.registry.positiveEvidenceRequirement,
);

assert.equal(r2.targets.length, 2);
assert.deepEqual(
  r2.targets.map((target) => target.productId).sort(),
  r1.missingTargets.map((target) => target.productId).sort(),
);

const lrp = r2.targets.find(
  (target) => target.productId === "9983f167-24e7-4223-bd86-446ce6ced31b",
);
assert.ok(lrp);
assert.equal(lrp.subjectId, "614db853-7865-408b-8f40-a4dcfe6a2ea5");
assert.equal(lrp.market, "KR");
assert.equal(lrp.candidateValue, null);
assert.equal(lrp.confirmationEligible, false);
assert.equal(
  lrp.decision,
  "HOLD_EXACT_SUBJECT_FIRST_PARTY_UVA_LABEL_NOT_ESTABLISHED",
);
assert.ok(
  lrp.firstPartySources.some(
    (source) =>
      source.canonicalLocator ===
        "https://www.larocheposay.co.kr/product/view/4833.do" &&
      source.identityMatch === "exact",
  ),
);

const skin1004 = r2.targets.find(
  (target) => target.productId === "fdf06871-db8e-4e73-a48c-c057c5ce925d",
);
assert.ok(skin1004);
assert.equal(skin1004.subjectId, "9dcd611d-e353-47f5-b349-e1f22d73551e");
assert.equal(skin1004.market, "US");
assert.equal(skin1004.candidateValue, null);
assert.equal(skin1004.confirmationEligible, false);
assert.equal(
  skin1004.decision,
  "HOLD_EXACT_US_FORMULATION_UVA_LABEL_NOT_ESTABLISHED",
);

const us = skin1004.firstPartySources.find(
  (source) => source.identityMatch === "exact_us_formulation",
);
const global = skin1004.firstPartySources.find(
  (source) => source.identityMatch === "different_global_formulation",
);
assert.ok(us);
assert.ok(global);
assert.equal(us.observedClaim, "SPF50 broad-spectrum coverage");
assert.equal(us.registryAdmissibleUvaLabel, null);
assert.equal(global.observedClaim, "SPF50+ PA++++");
assert.equal(global.transferToExactSubjectAllowed, false);
assert.notDeepEqual(us.activeIngredients, global.uvFilters);

assert.deepEqual(r2.researchOutcome, {
  recoveredCount: 0,
  confirmationEligibleCount: 0,
  remainingMissingCount: 2,
  projectedCoverageAfterR2: {
    eligibleCount: 12,
    totalCount: 14,
    complete: false,
  },
  r3GovernedAdoptionRequired: false,
  reason:
    "No new exact-Subject first-party evidence establishes a registry-admissible uva_label for either missing Product Fact Subject.",
});

for (const forbidden of [
  "BROAD_SPECTRUM_TO_PA",
  "BROAD_SPECTRUM_TO_UVA_PF_DECLARED_WITHOUT_GOVERNED_RULE",
  "GLOBAL_PA_TO_US_FORMULATION",
  "NON_KR_UVA_CLAIM_TO_LRP_KR_SUBJECT",
  "RETAIL_OR_REVIEW_PA_TO_PRODUCT_FACT",
  "MISSING_UVA_TO_LOW_PROTECTION",
]) {
  assert.ok(r2.forbiddenConversions.includes(forbidden));
}

assert.deepEqual(r2.limits, {
  productFactWritten: false,
  evidenceRecordWritten: false,
  reviewAssignmentWritten: false,
  confirmationWritten: false,
  registryChanged: false,
  productionRankingChanged: false,
  productionCutoverAuthorized: false,
  outdoorRankableSignalAuthorized: false,
  publicActivation: false,
  uvaActivated: false,
  waterResistanceApplied: false,
  spfProductionStateMutated: false,
});

assert.equal(
  r2.decision,
  "UVA_R2_HOLD_NO_EXACT_SUBJECT_REGISTRY_ADMISSIBLE_UVA_LABEL",
);

console.log(
  JSON.stringify({
    status: "PASS",
    stage: "DATA-AI29C-UVA-R2",
    recoveredCount: r2.researchOutcome.recoveredCount,
    confirmationEligibleCount: r2.researchOutcome.confirmationEligibleCount,
    projectedCoverage: r2.researchOutcome.projectedCoverageAfterR2,
    decision: r2.decision,
  }),
);
