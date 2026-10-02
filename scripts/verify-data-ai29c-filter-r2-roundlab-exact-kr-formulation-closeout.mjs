#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";

const r1 = JSON.parse(fs.readFileSync(
  "evidence/product-fact-catalog-expansion-v1/data-ai29c-filter-r1-uv-filter-recovery-v1.json",
  "utf8",
));
const r2 = JSON.parse(fs.readFileSync(
  "evidence/product-fact-catalog-expansion-v1/data-ai29c-filter-r2-roundlab-exact-kr-formulation-closeout-v1.json",
  "utf8",
));

assert.equal(
  r1.decision,
  "FILTER_R1_PARTIAL_PASS_TORRIDEN_ORGANIC_RECOVERED_ROUNDLAB_HOLD",
);
assert.equal(r2.stage, "DATA-AI29C-FILTER-R2");

assert.equal(
  r2.registryContracts.currentPublished.definitionChecksum,
  "6dd4e0016889b65dafade9d410692e9ab85b036e0654089950950ceb46f6e917",
);
assert.equal(
  r2.registryContracts.historicalTaskLineage.definitionChecksum,
  "c6107f2924d443c80f1c61e7977f54f69a97ac5b5da21f8eb2be13891f1ec52c",
);
assert.deepEqual(
  r2.registryContracts.currentPublished.allowedValues,
  ["mineral", "organic", "hybrid"],
);
assert.deepEqual(
  r2.registryContracts.currentPublished.permittedEvidenceClasses,
  ["product_claim", "composition_identity"],
);
assert.equal(
  r2.registryContracts.currentPublished.positiveEvidenceRequirement,
  "product-specific evidence",
);

assert.equal(r2.target.productId, "0bb742d2-df6b-49a7-8e29-8f76ae62ac0d");
assert.equal(r2.target.subjectId, "761e6fd6-3487-4505-a1a7-13c37d5cece4");
assert.equal(
  r2.target.subjectSemanticKey,
  "cb287a3632034e8626d1580a2b9d82493730882f7694f73accf6cdca1d790e3e",
);
assert.equal(r2.target.variantKey, "renewed_KR");
assert.equal(
  r2.target.formulationRevisionKey,
  "pilot-freeze-9aba73ebdc1f56e6041286efa04eb74f",
);
assert.equal(r2.target.market, "KR");

assert.equal(r2.target.task.taskId, "6e0e8b65-0ac2-4246-894b-a19494bd7329");
assert.equal(r2.target.task.state, "BLOCKED");
assert.equal(r2.target.task.blockerCode, "EVIDENCE_INSUFFICIENT");
assert.equal(r2.target.task.attemptCount, 1);

assert.equal(
  r2.target.governedExactKrSource.contentDigest,
  "879027d0cd4ffb563e7c028ee98b6454055f6a73c609c2bad80321474886049a",
);
assert.equal(r2.target.governedExactKrSource.bindingState, "exact_subject_match");
assert.equal(r2.target.governedExactKrSource.scopeRelation, "equivalent");
assert.equal(r2.target.governedExactKrSource.market, "KR");
assert.ok(r2.target.governedExactKrSource.notObserved.length >= 2);

assert.equal(r2.target.currentOfficialProductPage.market, "KR");
assert.equal(r2.target.globalOfficialEvidence.observedClassification, "Chemical");
assert.deepEqual(
  r2.target.globalOfficialEvidence.observedActiveFilters,
  ["Avobenzone", "Homosalate", "Octisalate"],
);
assert.equal(r2.target.globalOfficialEvidence.transferToKrSubjectAuthorized, false);

assert.equal(r2.target.result, "HOLD_EVIDENCE_INSUFFICIENT");
assert.equal(r2.target.currentUvFilterFactCount, 0);

assert.deepEqual(r2.coverageAtCloseout, {
  resolvedCurrentSunscreenSubjects: 13,
  spfCurrentSubjects: 13,
  uvaLabelCurrentSubjects: 10,
  uvFilterCurrentSubjects: 12,
  uvFilterMissingSubjects: 1,
  waterResistanceDurationCurrentSubjects: 2,
  broadSpectrumCurrentSubjects: 2,
  currentProductFacts: 95,
});

assert.equal(r2.watchPolicy.repeatSearchUnderUnchangedFingerprint, false);
assert.ok(r2.watchPolicy.fingerprintFields.length >= 5);
assert.ok(r2.watchPolicy.reopenIf.length >= 5);
assert.ok(
  r2.watchPolicy.doNotReopenFor.includes(
    "global or US Chemical classification without exact-formulation equivalence",
  ),
);

assert.equal(r2.writeBoundary.productFactWrites, 0);
assert.equal(r2.writeBoundary.researchTaskWrites, 0);
assert.equal(r2.writeBoundary.registryWrites, 0);
assert.equal(r2.writeBoundary.policyWrites, 0);
assert.equal(r2.writeBoundary.recommendationWrites, 0);
assert.equal(r2.writeBoundary.rankingChanged, false);
assert.equal(r2.writeBoundary.publicActivation, false);

assert.equal(
  r2.decision,
  "FILTER_R2_ROUNDLAB_CLOSEOUT_PASS_WATCH_ON_CHANGE_NO_ADMISSIBLE_EXACT_KR_FILTER_AUTHORITY",
);
assert.equal(
  r2.nextGate,
  "DATA-AI29C-PROTECTION-R1_PROTECTION_GAP_WATCH_CLOSEOUT",
);

console.log(JSON.stringify({
  status: "PASS",
  stage: r2.stage,
  subject: r2.target.name,
  result: r2.target.result,
  uvFilterCoverage: `${r2.coverageAtCloseout.uvFilterCurrentSubjects}/${r2.coverageAtCloseout.resolvedCurrentSunscreenSubjects}`,
  currentFacts: r2.coverageAtCloseout.currentProductFacts,
  repeatSearchUnderUnchangedFingerprint: r2.watchPolicy.repeatSearchUnderUnchangedFingerprint,
  decision: r2.decision,
}));
