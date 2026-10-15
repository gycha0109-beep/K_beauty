import assert from "node:assert/strict";
import {
  evaluateSkinAnnotationAgreement,
  SKIN_ANNOTATION_AGREEMENT_VERSION
} from "./skin-human-annotation-agreement.mjs";

const label = (assessability, cue) => ({ assessability, cue });
const row = (caseId, axis, reviewerA, reviewerB) => ({ caseId, axis, reviewerA, reviewerB });
const manifest = {
  schemaVersion: SKIN_ANNOTATION_AGREEMENT_VERSION,
  datasetId: "anonymous_test_set",
  cases: [
    row("c1", "redness", label("assessable", "present"), label("assessable", "present")),
    row("c2", "redness", label("assessable", "absent"), label("assessable", "present")),
    row("c3", "pores", label("not_assessable", null), label("assessable", "present")),
    row("c4", "pores", label("ambiguous", null), label("not_assessable", null)),
    row("c5", "acne", label("assessable", "absent"), label("assessable", "absent"))
  ]
};
const original = JSON.stringify(manifest);
const report = evaluateSkinAnnotationAgreement(manifest);
assert.equal(report.status, "INDEPENDENT_ADJUDICATION_REQUIRED");
assert.equal(report.overall.rows, 5);
assert.equal(report.overall.exactMatches, 2);
assert.equal(report.overall.disagreements, 3);
assert.equal(report.overall.assessabilityDisagreements, 1);
assert.equal(report.overall.cueDisagreements, 1);
assert.equal(report.overall.exactAgreement, 0.4);
assert.equal(report.overall.cueAgreementWhenBothAssessable, 0.666667);
assert.equal(report.byAxis.redness.kappa, 0);
assert.equal(report.byAxis.acne.kappa, null, "constant same label has undefined kappa");
assert.deepEqual(report.disagreements, [
  { caseId: "c2", axis: "redness", reason: "visual_cue_disagreement" },
  { caseId: "c3", axis: "pores", reason: "assessability_disagreement" },
  { caseId: "c4", axis: "pores", reason: "unassessable_type_disagreement" }
]);
assert.equal(report.authority.independentBlindingVerified, false);
assert.equal(report.authority.annotationAgreementIsNotAccuracy, true);
assert.equal(report.authority.productionActivationAuthorized, false);
assert.equal(JSON.stringify(manifest), original);
assert.deepEqual(evaluateSkinAnnotationAgreement({ ...manifest, cases: [...manifest.cases].reverse() }), report);

const allMatch = evaluateSkinAnnotationAgreement({
  ...manifest,
  cases: [row("c1", "redness", label("assessable", "present"), label("assessable", "present"))]
});
assert.equal(allMatch.status, "AGREEMENT_OBSERVED_ONLY");
assert.equal(allMatch.overall.kappa, null);
assert.equal(allMatch.overall.exactAgreement, 1);
assert.equal(allMatch.authority.humanAdjudicationCompleted, false);

assert.throws(() => evaluateSkinAnnotationAgreement({
  ...manifest, cases: [manifest.cases[0], manifest.cases[0]]
}), /duplicate_case_axis/);
assert.throws(() => evaluateSkinAnnotationAgreement({
  ...manifest, cases: [{ ...manifest.cases[0], imageUrl: "https://example.org/private.jpg" }]
}), /unexpected_content/);
assert.throws(() => evaluateSkinAnnotationAgreement({
  ...manifest, cases: [row("c1", "uv",
    label("assessable", "present"), label("assessable", "present"))]
}), /case_identifier_or_axis_invalid/);
assert.throws(() => evaluateSkinAnnotationAgreement({
  ...manifest, cases: [row("c1", "redness",
    label("ambiguous", "absent"), label("assessable", "present"))]
}), /cue_and_assessability_conflict/);
assert.throws(() => evaluateSkinAnnotationAgreement({
  ...manifest, cases: [row("c1", "redness",
    { ...label("assessable", "present"), name: "person" }, label("assessable", "present"))]
}), /unexpected_content/);
console.log("verify-face-lab-skin-s1-human-agreement: PASS (anonymous synthetic annotations only)");
