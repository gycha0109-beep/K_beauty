#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  evaluateSunscreenSemanticEnvelope,
  projectEstablishedSunscreenSemantics,
  evaluateSunscreenSemanticScoringEligibility,
} from "../lib/sunscreen-recommendation-semantic-projection.mjs";

const evidence = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-d5e-c-cosrx-sunscreen-semantic-bundle-v1.json",
    "utf8",
  ),
);
const upstream = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-d5e-b-cosrx-product-fact-controlled-confirmation-v1.json",
    "utf8",
  ),
);

assert.equal(evidence.stage, "DATA-AI29C-D5E-C");
assert.equal(
  evidence.decision,
  "D5E_C_COSRX_SEMANTIC_REVIEW_PASS_D1B_ENVELOPE_READY_NEUTRAL_COMPARABLE",
);
assert.equal(
  upstream.decision,
  "D5E_B_COSRX_PRODUCT_FACT_CONTROLLED_CONFIRMATION_PASS",
);

const bundle = evidence.semanticBundle;
assert.equal(Object.keys(bundle.fields).length, 12);
assert.equal(evidence.rawReader.reviewedFieldCount, 12);
assert.equal(evidence.rawReader.notReviewedFieldCount, 0);
assert.equal(evidence.rawReader.establishedFieldCount, 7);
assert.equal(evidence.rawReader.reviewedNotEstablishedFieldCount, 5);
assert.equal(evidence.rawReader.complete, false);
assert.equal(evidence.rawReader.status, "SEMANTIC_BUNDLE_INCOMPLETE");

const envelope = evaluateSunscreenSemanticEnvelope(bundle);
assert.deepEqual(
  {
    contractValid: envelope.contractValid,
    subjectExact: envelope.subjectExact,
    allReviewed: envelope.allReviewed,
    coreEstablished: envelope.coreEstablished,
    envelopeReady: envelope.envelopeReady,
    unresolvedFields: [...envelope.unresolvedFields],
  },
  {
    contractValid: true,
    subjectExact: true,
    allReviewed: true,
    coreEstablished: true,
    envelopeReady: true,
    unresolvedFields:
      evidence.d1bProjectionExpectation.unresolvedFields,
  },
);

const projection = projectEstablishedSunscreenSemantics(bundle);
assert.deepEqual(
  projection.projected,
  evidence.d1bProjectionExpectation.projected,
);

for (const [name, ctx] of [
  ["neutral", {}],
  ["finishRelevant", { finishRelevant: true }],
  ["toneUpRelevant", { toneUpRelevant: true }],
  ["whiteCastRelevant", { whiteCastRelevant: true }],
  ["sensitivityRelevant", { sensitivityRelevant: true }],
  ["eyeStingRelevant", { eyeStingRelevant: true }],
  ["pillingRelevant", { pillingRelevant: true }],
  ["textureRelevant", { textureRelevant: true }],
]) {
  const actual = evaluateSunscreenSemanticScoringEligibility(bundle, ctx);
  assert.equal(
    actual.eligible,
    evidence.contextualEligibilityExpectation[name].eligible,
    name,
  );
  assert.deepEqual(
    [...actual.blockers],
    evidence.contextualEligibilityExpectation[name].blockers,
    name,
  );
}

assert.equal(bundle.fields.category_slot.value, "sunscreen");
assert.equal(bundle.fields.uv_filter_type.value, "organic");
assert.equal(bundle.fields.finish.value, "fresh");
assert.equal(bundle.fields.tone_up.value, false);
assert.equal(bundle.fields.white_cast.value, "none");
assert.deepEqual(bundle.fields.skin_types.value, ["sensitive"]);
assert.deepEqual(bundle.fields.concerns.value, ["dehydration", "oiliness"]);

for (const field of [
  "texture",
  "sensitivity_safe",
  "irritation_risk",
  "eye_sting",
  "pilling_risk",
]) {
  assert.equal(bundle.fields[field].state, "reviewed_not_established");
  assert.equal(bundle.fields[field].value, null);
}

assert.equal(evidence.reviewExecution.requestCount, 12);
assert.equal(evidence.reviewExecution.insertedCount, 12);
assert.equal(evidence.reviewExecution.productRowMutated, false);
assert.equal(
  evidence.reviewExecution.recommendationAdmissionMutated,
  false,
);
assert.equal(evidence.reviewExecution.productionRankingChanged, false);

assert.equal(evidence.productionBoundary.admissionCriticalCurrentFactCount, 3);
assert.equal(evidence.productionBoundary.productLegacyCategory, null);
assert.equal(evidence.productionBoundary.taxonomyAssignmentState, "shadow");
assert.equal(evidence.productionBoundary.d5cD5dLiveAllowlistCount, 3);
assert.equal(evidence.productionBoundary.cosrxInD5cD5dAllowlist, false);
assert.equal(evidence.productionBoundary.d5dActivationEnabled, true);
assert.equal(
  evidence.productionBoundary.d5dAuthorizedPhase,
  "DATA-AI29C-D5D",
);

const d5cContract = fs.readFileSync(
  "lib/sunscreen-d5c-canary-authority-contract.mjs",
  "utf8",
);
assert.equal(
  d5cContract.includes(evidence.target.productId),
  false,
  "D5E-C must not widen the live D5C/D5D allowlist",
);

assert.equal(
  evidence.nextGate,
  "DATA-AI29C-D5E-D_COSRX_ADMISSION_AND_MIXED_SHADOW",
);
assert.equal(
  evidence.nextGateAuthorizedAfter,
  "D5E_C_EVIDENCE_MERGED_AND_CI_PASS",
);

console.log(JSON.stringify({
  status: "PASS",
  stage: evidence.stage,
  reviewed: evidence.rawReader.reviewedFieldCount,
  established: evidence.rawReader.establishedFieldCount,
  rawBundleComplete: evidence.rawReader.complete,
  d1bEnvelopeReady: envelope.envelopeReady,
  neutralEligible:
    evaluateSunscreenSemanticScoringEligibility(bundle, {}).eligible,
  cosrxLive: evidence.productionBoundary.cosrxInD5cD5dAllowlist,
  nextGate: evidence.nextGate,
}, null, 2));
