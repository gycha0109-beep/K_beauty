import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  PRODUCT_EVIDENCE_ADMISSION_POLICY_VERSION,
  PRODUCT_EVIDENCE_PRESENTATION_POLICY_VERSION,
  buildProductEvidencePresentationProjection,
  validateProductEvidencePresentationProjection
} from "../lib/product-evidence-presentation-contract.js";

const make = (overrides = {}) =>
  buildProductEvidencePresentationProjection({
    featureKey: "eye_sting",
    factRef: "fact:eye-sting:v1",
    axisRef: "axis:eye-sting:v1",
    knowledgeState: "supported",
    dominantFamily: "official",
    independentSupport: "multiple",
    recency: "current",
    agreement: "consistent",
    evidenceRefs: ["evidence:official:1", "evidence:measurement:1"],
    ...overrides
  });

const supportedOfficial = make();
assert.equal(supportedOfficial.recommendationUse, "explanation_only");
assert.equal(supportedOfficial.presentation.tone, "supported");
assert.equal(supportedOfficial.presentation.copyKey, "product_evidence_repeated_consistent");
assert.equal(supportedOfficial.presentationPolicyVersion, PRODUCT_EVIDENCE_PRESENTATION_POLICY_VERSION);
assert.equal(supportedOfficial.admissionPolicyVersion, PRODUCT_EVIDENCE_ADMISSION_POLICY_VERSION);
assert.deepEqual(validateProductEvidencePresentationProjection(supportedOfficial), { valid: true, errors: [] });

const supportedReviewExperience = make({
  factRef: "fact:eye-sting-review-observation:v1",
  axisRef: null,
  dominantFamily: "review_experience"
});
assert.equal(supportedReviewExperience.recommendationUse, "explanation_only");
assert.notEqual(supportedReviewExperience.recommendationUse, "constraint_eligible");
assert.equal(supportedReviewExperience.presentation.copyKey, "product_review_pattern_repeated");
assert.deepEqual(validateProductEvidencePresentationProjection(supportedReviewExperience), { valid: true, errors: [] });

for (const [knowledgeState, expectedTone] of [
  ["evidence_conflict", "mixed"],
  ["evidence_insufficient", "limited"],
  ["reviewed_not_established", "limited"],
  ["not_reviewed", "plain"]
]) {
  const projection = make({ knowledgeState });
  assert.equal(projection.recommendationUse, "blocked", `${knowledgeState}: recommendation admission`);
  assert.equal(projection.presentation.tone, expectedTone, `${knowledgeState}: presentation tone`);
  assert.deepEqual(validateProductEvidencePresentationProjection(projection), { valid: true, errors: [] });
}

const missingCanonicalState = make({
  factRef: null,
  axisRef: null,
  knowledgeState: null,
  dominantFamily: "none",
  independentSupport: "unresolved",
  recency: "unknown",
  agreement: "unknown",
  evidenceRefs: []
});
assert.equal(missingCanonicalState.knowledgeState, null, "missing canonical state must stay missing");
assert.equal(missingCanonicalState.recommendationUse, "blocked");
assert.equal(missingCanonicalState.presentation.copyKey, "product_evidence_missing");
assert.deepEqual(validateProductEvidencePresentationProjection(missingCanonicalState), { valid: true, errors: [] });

const supportedWithoutTraceability = make({ factRef: null, axisRef: null, evidenceRefs: [] });
assert.equal(supportedWithoutTraceability.recommendationUse, "blocked");
assert.equal(supportedWithoutTraceability.presentation.tone, "limited");
assert.equal(supportedWithoutTraceability.presentation.copyKey, "product_evidence_traceability_incomplete");
assert.deepEqual(validateProductEvidencePresentationProjection(supportedWithoutTraceability), { valid: true, errors: [] });

const dedupedEvidence = make({
  evidenceRefs: [" evidence:official:1 ", "evidence:official:1", "evidence:measurement:1", ""]
});
assert.deepEqual(dedupedEvidence.evidenceRefs, ["evidence:official:1", "evidence:measurement:1"]);

assert.throws(
  () => make({ independentSupport: "multiple_sources" }),
  /unsupported independentSupport/,
  "source count must not masquerade as independent support"
);
assert.throws(() => make({ knowledgeState: "safe" }), /unsupported knowledgeState/);

const tamperedReviewConstraint = {
  ...supportedReviewExperience,
  recommendationUse: "constraint_eligible"
};
const tamperedValidation = validateProductEvidencePresentationProjection(tamperedReviewConstraint);
assert.equal(tamperedValidation.valid, false);
assert(tamperedValidation.errors.includes("admission_policy_violation"));

const contractSource = await readFile(new URL("../lib/product-evidence-presentation-contract.js", import.meta.url), "utf8");
for (const forbiddenToken of ["trustScore", "evidenceStrength", "engine_score", "score_breakdown"]) {
  assert.equal(contractSource.includes(forbiddenToken), false, `forbidden trust/ranking token: ${forbiddenToken}`);
}

for (const scorerPath of ["../lib/recommendation-scoring.ts", "../lib/skin-match-decision-engine.js"]) {
  const scorerSource = await readFile(new URL(scorerPath, import.meta.url), "utf8");
  assert.equal(
    scorerSource.includes("product-evidence-presentation-contract"),
    false,
    `${scorerPath}: presentation contract must not enter production recommendation semantics`
  );
}

console.log(
  "verify-product-evidence-presentation-contract: PASS " +
    "numeric_confidence=0 missing_as_false=0 conflict_positive=0 review_constraint=0 ranking_integration=0"
);
