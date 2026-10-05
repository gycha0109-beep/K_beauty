#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  evaluateSunscreenInitialAdmissionGrant,
  SUNSCREEN_INITIAL_ADMISSION_ACCEPTED_SUBJECT_RESOLUTION_VERSIONS,
} from "../lib/sunscreen-initial-admission-grant-policy.mjs";

const evidence = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-d5e-d-cosrx-admission-mixed-shadow-v1.json",
    "utf8",
  ),
);
const semantic = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-d5e-c-cosrx-sunscreen-semantic-bundle-v1.json",
    "utf8",
  ),
);

assert.equal(evidence.stage, "DATA-AI29C-D5E-D");
assert.equal(
  evidence.decision,
  "D5E_D_COSRX_ADMISSION_HOLD_SUBJECT_IDENTITY_AUTHORITY_LINEAGE_MISMATCH",
);
assert.deepEqual(
  [...SUNSCREEN_INITIAL_ADMISSION_ACCEPTED_SUBJECT_RESOLUTION_VERSIONS],
  ["trust-phase5-admin-subject-review-v1"],
);

const actualInput = {
  ...evidence.admissionInput,
  semanticBundle: semantic.semanticBundle,
};
const actual = evaluateSunscreenInitialAdmissionGrant(actualInput);
assert.equal(actual.grant, false);
assert.equal(actual.decision, "NO_GRANT");
assert.deepEqual([...actual.reasons], [
  "PRODUCT_FACT_SUBJECT_UNRESOLVED_OR_NON_CURRENT",
]);
assert.deepEqual(actual, {
  ...actual,
  grant: evidence.actualEvaluation.grant,
  decision: evidence.actualEvaluation.decision,
  reasons: actual.reasons,
});

assert.equal(
  evidence.admissionInput.subject.identityStatus,
  "resolved",
);
assert.equal(
  evidence.admissionInput.subject.currentState,
  "current",
);
assert.equal(
  evidence.admissionInput.subject.subjectIdentitySerializerVersion,
  "product-fact-subject-identity-v1",
);
assert.equal(
  evidence.admissionInput.subject.identityResolutionVersion,
  "gpt-catalog-machine-subject-v1",
);
assert.equal(
  evidence.blockerAnalysis.onlyObservedAdmissionPolicyMismatch,
  "identityResolutionVersion",
);

const hypotheticalInput = structuredClone(actualInput);
hypotheticalInput.subject.identityResolutionVersion =
  evidence.counterfactualPolicyProbe.hypotheticalValue;
const hypothetical =
  evaluateSunscreenInitialAdmissionGrant(hypotheticalInput);
assert.equal(
  evidence.counterfactualPolicyProbe.mutationAppliedToProduction,
  false,
);
assert.equal(hypothetical.grant, true);
assert.equal(
  hypothetical.decision,
  "SUNSCREEN_INITIAL_ADMISSION_GRANT",
);
assert.equal(
  hypothetical.decision,
  evidence.counterfactualPolicyProbe.expectedDecision,
);

assert.equal(evidence.mixedShadow.executed, false);
assert.equal(
  evidence.mixedShadow.reason,
  "SUNSCREEN_INITIAL_ADMISSION_GRANT_REQUIRED",
);
assert.equal(evidence.mixedShadow.proposedMixedCorpusCountIfGrant, 15);
assert.equal(
  evidence.mixedShadow.existingAuthorityCompleteMixedProofCount,
  14,
);
for (const key of [
  "productionWrite",
  "recommendationAdmissionMutation",
  "productionRankingChanged",
  "publicActivation",
]) {
  assert.equal(evidence.mixedShadow[key], false, key);
}

assert.equal(
  evidence.authorityRecoveryBoundary.automaticOverwriteOfExistingMachineSubjectForbidden,
  true,
);
assert.equal(
  evidence.authorityRecoveryBoundary.subjectMutationAuthorizedInD5eD,
  false,
);
assert.equal(
  evidence.nextGate,
  "DATA-AI29C-D5E-D-R1_COSRX_SUBJECT_IDENTITY_AUTHORITY_RECOVERY_PREFLIGHT",
);
assert.equal(evidence.nextGateMode, "READ_ONLY");

const d5c = fs.readFileSync(
  "lib/sunscreen-d5c-canary-authority-contract.mjs",
  "utf8",
);
assert.equal(
  d5c.includes(evidence.admissionInput.product.id),
  false,
  "D5E-D HOLD must not widen the D5C/D5D live allowlist",
);

console.log(JSON.stringify({
  status: "PASS",
  stage: evidence.stage,
  actualDecision: actual.decision,
  actualReasons: actual.reasons,
  hypotheticalDecision: hypothetical.decision,
  mixedShadowExecuted: evidence.mixedShadow.executed,
  nextGate: evidence.nextGate,
}, null, 2));
