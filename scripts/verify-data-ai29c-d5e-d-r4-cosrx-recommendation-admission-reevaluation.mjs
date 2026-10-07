#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  evaluateSunscreenInitialAdmissionGrant,
  SUNSCREEN_INITIAL_ADMISSION_ACCEPTED_SUBJECT_RESOLUTION_VERSIONS,
} from "../lib/sunscreen-initial-admission-grant-policy.mjs";
import {
  evaluateSunscreenSemanticEnvelope,
  evaluateSunscreenSemanticScoringEligibility,
} from "../lib/sunscreen-recommendation-semantic-projection.mjs";
import {
  D5C_SUNSCREEN_CANARY_PRODUCT_IDS,
} from "../lib/sunscreen-d5c-canary-authority-contract.mjs";

const artifact = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-d5e-d-r4-cosrx-recommendation-admission-reevaluation-v1.json",
    "utf8",
  ),
);
const prior = JSON.parse(
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

const PRODUCT_ID = "888eca86-af25-4a12-b9ea-47922d83f520";
const SUBJECT_ID = "994d7edb-7432-40c3-b09f-08cd59f91627";
const ACCEPTED_RESOLUTION = "trust-phase5-admin-subject-review-v1";

assert.equal(artifact.stage, "DATA-AI29C-D5E-D-R4");
assert.equal(
  artifact.decision,
  "D5E_D_R4_COSRX_RECOMMENDATION_ADMISSION_REEVALUATION_PASS",
);
assert.equal(artifact.target.productId, PRODUCT_ID);
assert.equal(artifact.target.subjectId, SUBJECT_ID);
assert.equal(artifact.productionBoundary.productionWrites, 0);

assert.equal(
  prior.decision,
  "D5E_D_COSRX_ADMISSION_HOLD_SUBJECT_IDENTITY_AUTHORITY_LINEAGE_MISMATCH",
);
assert.equal(prior.actualEvaluation.grant, false);
assert.equal(prior.actualEvaluation.decision, "NO_GRANT");
assert.deepEqual(prior.actualEvaluation.reasons, [
  "PRODUCT_FACT_SUBJECT_UNRESOLVED_OR_NON_CURRENT",
]);
assert.equal(
  prior.blockerAnalysis.onlyObservedAdmissionPolicyMismatch,
  "identityResolutionVersion",
);
assert.equal(
  prior.admissionInput.subject.identityResolutionVersion,
  "gpt-catalog-machine-subject-v1",
);

assert.deepEqual(
  [...SUNSCREEN_INITIAL_ADMISSION_ACCEPTED_SUBJECT_RESOLUTION_VERSIONS],
  [ACCEPTED_RESOLUTION],
);
assert.equal(
  artifact.liveAuthority.subject.identityResolutionVersion,
  ACCEPTED_RESOLUTION,
);
assert.equal(
  artifact.governedAuthorityUpgrade.previousIdentityResolutionVersion,
  prior.admissionInput.subject.identityResolutionVersion,
);
assert.equal(
  artifact.governedAuthorityUpgrade.nextIdentityResolutionVersion,
  ACCEPTED_RESOLUTION,
);
assert.equal(
  artifact.governedAuthorityUpgrade.eventKind,
  "subject_identity_authority_upgraded",
);
assert.equal(
  artifact.governedAuthorityUpgrade.reasonCode,
  "controlled_identity_authority_upgrade",
);

const priorSubjectWithoutResolution = structuredClone(prior.admissionInput.subject);
delete priorSubjectWithoutResolution.identityResolutionVersion;
const currentSubjectWithoutResolution = structuredClone(
  artifact.liveAuthority.subjectAdmissionShape,
);
delete currentSubjectWithoutResolution.identityResolutionVersion;
assert.deepEqual(
  currentSubjectWithoutResolution,
  priorSubjectWithoutResolution,
  "only Subject authority lineage may differ from the D5E-D admission input",
);

assert.deepEqual(
  artifact.liveAuthority.taxonomy,
  prior.admissionInput.taxonomy,
  "taxonomy must remain frozen",
);
assert.deepEqual(
  artifact.liveAuthority.registry,
  prior.admissionInput.registry,
  "registry must remain frozen",
);

function normalizeFact(fact) {
  return {
    factKey: fact.factKey,
    factInstanceId: fact.factInstanceId,
    confirmationId: fact.confirmationId,
    propositionKey: fact.propositionKey,
    registryVersion: fact.registryVersion,
    propositionSerializerVersion: fact.propositionSerializerVersion,
    semanticStatus: fact.semanticStatus,
    authorityCeiling: fact.authorityCeiling,
    fusedConfidence: fact.fusedConfidence,
    validTo: fact.validTo ?? null,
    valueType: fact.valueType,
    valueNumber: fact.valueNumber ?? null,
    valueEnum: fact.valueEnum ?? null,
  };
}

const priorFacts = prior.admissionInput.currentFacts
  .map(normalizeFact)
  .sort((a, b) => a.factKey.localeCompare(b.factKey));
const currentFacts = artifact.liveAuthority.currentFacts
  .map(normalizeFact)
  .sort((a, b) => a.factKey.localeCompare(b.factKey));
assert.deepEqual(currentFacts, priorFacts, "Product Fact set must be unchanged");

assert.deepEqual(artifact.liveAuthority.counts, {
  productFactCurrent: 3,
  productFactInstances: 3,
  researchTasks: 3,
  sourceBindings: 2,
  evidenceRecords: 3,
  currentSemanticReviews: 12,
  exactCurrentApplicabilitySubjects: 1,
});

const semanticRows = Object.entries(semantic.semanticBundle.fields)
  .map(([fieldName, value]) => ({
    fieldName,
    state: value.state,
    value: value.value,
    confidence: value.confidence,
  }))
  .sort((a, b) => a.fieldName.localeCompare(b.fieldName));
assert.deepEqual(
  artifact.liveAuthority.semanticReviewRows,
  semanticRows,
  "Production semantic readback must match frozen D5E-C semantics",
);

const established = semanticRows.filter((row) => row.state === "established");
const unresolved = semanticRows.filter(
  (row) => row.state === "reviewed_not_established",
);
assert.equal(established.length, 7);
assert.equal(unresolved.length, 5);
assert.deepEqual(
  unresolved.map((row) => row.fieldName).sort(),
  [...artifact.safetyBoundary.unresolvedFieldsRemainFailClosed].sort(),
);

const envelope = evaluateSunscreenSemanticEnvelope(semantic.semanticBundle);
assert.equal(envelope.envelopeReady, true);
assert.equal(envelope.productId, PRODUCT_ID);
assert.equal(envelope.subjectId, SUBJECT_ID);

const currentInput = structuredClone(prior.admissionInput);
currentInput.subject = structuredClone(
  artifact.liveAuthority.subjectAdmissionShape,
);
currentInput.taxonomy = structuredClone(artifact.liveAuthority.taxonomy);
currentInput.registry = structuredClone(artifact.liveAuthority.registry);
currentInput.currentFacts = prior.admissionInput.currentFacts.map((fact) => ({
  ...fact,
}));
currentInput.semanticBundle = semantic.semanticBundle;

const result = evaluateSunscreenInitialAdmissionGrant(currentInput);
assert.equal(result.grant, true);
assert.equal(result.decision, "SUNSCREEN_INITIAL_ADMISSION_GRANT");
assert.deepEqual([...result.reasons], [
  "SUNSCREEN_IDENTITY_PROTECTION_AND_SEMANTIC_AUTHORITY_COMPLETE",
]);
assert.equal(result.grant, artifact.actualEvaluation.grant);
assert.equal(result.decision, artifact.actualEvaluation.decision);
assert.deepEqual([...result.reasons], artifact.actualEvaluation.reasons);
assert.deepEqual(artifact.actualEvaluation.newBlockers, []);

assert.equal(result.semantics.impliesSafety, false);
assert.equal(result.semantics.impliesRecommendation, false);
assert.equal(result.semantics.modifiesScoring, false);
assert.equal(result.semantics.modifiesProductionRanking, false);
assert.equal(result.semantics.authorizesPublicActivation, false);

const neutral = evaluateSunscreenSemanticScoringEligibility(
  semantic.semanticBundle,
  {},
);
assert.equal(neutral.eligible, true);

const expectedFailClosed = {
  sensitivityRelevant: [
    "SEMANTIC_UNCERTAINTY:sensitivityRelevant:irritation_risk",
    "SEMANTIC_UNCERTAINTY:sensitivityRelevant:sensitivity_safe",
  ],
  eyeStingRelevant: [
    "SEMANTIC_UNCERTAINTY:eyeStingRelevant:eye_sting",
  ],
  pillingRelevant: [
    "SEMANTIC_UNCERTAINTY:pillingRelevant:pilling_risk",
  ],
  textureRelevant: [
    "SEMANTIC_UNCERTAINTY:textureRelevant:texture",
  ],
};
for (const [contextKey, blockers] of Object.entries(expectedFailClosed)) {
  const evaluated = evaluateSunscreenSemanticScoringEligibility(
    semantic.semanticBundle,
    { [contextKey]: true },
  );
  assert.equal(evaluated.eligible, false, contextKey);
  assert.deepEqual([...evaluated.blockers], blockers, contextKey);
}

assert.equal(D5C_SUNSCREEN_CANARY_PRODUCT_IDS.length, 3);
assert.equal(D5C_SUNSCREEN_CANARY_PRODUCT_IDS.includes(PRODUCT_ID), false);
assert.equal(artifact.productionBoundary.d5cD5dAllowlistCount, 3);
assert.equal(artifact.productionBoundary.d5cD5dAllowlistChanged, false);
assert.equal(artifact.productionBoundary.cosrxInD5cD5dAllowlist, false);
assert.deepEqual(artifact.productionBoundary.runtimeActivation, {
  scope: "authenticated_product_query_beta",
  enabled: true,
  authorizedPhase: "DATA-AI29C-D5D",
  changed: false,
});
for (const key of [
  "mixedShadowExecuted",
  "d5cD5dAllowlistChanged",
  "cosrxInD5cD5dAllowlist",
  "recommendationAdmissionMutation",
  "productionRankingChanged",
  "publicActivation",
  "uvaActivated",
  "waterResistanceActivated",
]) {
  assert.equal(artifact.productionBoundary[key], false, key);
}

assert.deepEqual(artifact.auditability, {
  priorHoldResolved: true,
  changedAdmissionInputFieldOnly: "subject.identityResolutionVersion",
  semanticKeyUnchanged: true,
  formulationRevisionUnchanged: true,
  productFactSetUnchanged: true,
  taxonomyUnchanged: true,
  registryUnchanged: true,
  semanticReviewSetUnchanged: true,
});

assert.equal(
  artifact.nextGate.stage,
  "DATA-AI29C-D5E-E_COSRX_4_PRODUCT_INTERNAL_CANARY",
);
assert.equal(artifact.nextGate.status, "NOT_EXECUTED");
assert.equal(artifact.nextGate.proposedCanaryProductCount, 4);

console.log(JSON.stringify({
  status: "PASS",
  stage: artifact.stage,
  decision: artifact.decision,
  admissionDecision: result.decision,
  admissionGrant: result.grant,
  priorHoldResolved: artifact.auditability.priorHoldResolved,
  unresolvedFailClosedFieldCount:
    artifact.safetyBoundary.unresolvedFieldsRemainFailClosed.length,
  d5cD5dAllowlistCount: artifact.productionBoundary.d5cD5dAllowlistCount,
  productionWrites: artifact.productionBoundary.productionWrites,
  nextGate: artifact.nextGate.stage,
}, null, 2));
