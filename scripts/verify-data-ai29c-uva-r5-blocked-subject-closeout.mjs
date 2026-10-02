#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";

const r4 = JSON.parse(fs.readFileSync(
  "evidence/product-fact-catalog-expansion-v1/data-ai29c-uva-r4-blocked-subject-reassessment-v1.json",
  "utf8",
));
const r5 = JSON.parse(fs.readFileSync(
  "evidence/product-fact-catalog-expansion-v1/data-ai29c-uva-r5-blocked-subject-closeout-v1.json",
  "utf8",
));

assert.equal(
  r4.decision,
  "UVA_R4_BLOCKED_SUBJECT_REASSESSMENT_HOLD_NO_NEW_REGISTRY_ADMISSIBLE_UVA_LABEL",
);
assert.equal(r5.stage, "DATA-AI29C-UVA-R5");
assert.equal(r5.registryContract.factKey, "uva_label");
assert.equal(
  r5.registryContract.definitionChecksum,
  "9027670c9d68f16c980dafa1416788f2cc0b5faad3fbe0da23b0b50c0de87bfa",
);
assert.equal(r5.blockedSubjects.length, 3);
assert.equal(
  r5.blockedSubjects.every(
    (row) =>
      row.state === "BLOCKED" &&
      row.blockerCode === "EVIDENCE_INSUFFICIENT" &&
      row.attemptCount === 1 &&
      typeof row.watchFingerprint.subjectSemanticKey === "string" &&
      row.watchFingerprint.subjectSemanticKey.length === 64 &&
      typeof row.watchFingerprint.formulationRevisionKey === "string" &&
      row.watchFingerprint.formulationRevisionKey.length > 0 &&
      typeof row.watchFingerprint.sourceContentDigest === "string" &&
      row.watchFingerprint.sourceContentDigest.length === 64 &&
      row.watchFingerprint.scopeRelation === "equivalent",
  ),
  true,
);
assert.equal(r5.watchPolicy.repeatSearchUnderUnchangedFingerprint, false);
assert.ok(r5.watchPolicy.reopenIf.length >= 5);
assert.ok(r5.watchPolicy.doNotReopenFor.includes("Broad Spectrum wording alone"));
assert.deepEqual(r5.coverageAtCloseout, {
  resolvedCurrentSunscreenSubjects: 13,
  currentUvaLabelSubjects: 10,
  blockedUvaSubjects: 3,
  currentProductFactCount: 94,
  broadSpectrumCurrentSubjects: 2,
  uvFilterTypeCurrentSubjects: 11,
  spfCurrentSubjects: 13,
  waterResistanceDurationCurrentSubjects: 2,
});
assert.equal(r5.writeBoundary.productFactWrites, 0);
assert.equal(r5.writeBoundary.researchTaskWrites, 0);
assert.equal(r5.writeBoundary.registryWrites, 0);
assert.equal(r5.writeBoundary.policyWrites, 0);
assert.equal(
  r5.decision,
  "UVA_R5_BLOCKED_SUBJECT_CLOSEOUT_PASS_WATCH_ON_CHANGE",
);
assert.equal(
  r5.nextGate,
  "DATA-AI29C-FILTER-R1_UV_FILTER_TYPE_MISSING_SUBJECT_RECOVERY",
);

console.log(JSON.stringify({
  status:"PASS",
  stage:r5.stage,
  blockedSubjects:r5.blockedSubjects.length,
  repeatSearchUnderUnchangedFingerprint:r5.watchPolicy.repeatSearchUnderUnchangedFingerprint,
  nextGate:r5.nextGate,
  decision:r5.decision,
}));
