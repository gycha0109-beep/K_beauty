import assert from "node:assert/strict";
import {
  evaluateSkinCues,
  SKIN_CUE_EVAL_VERSION,
  SKIN_CUE_AXES,
  validateSkinCueEvaluationManifest
} from "./skin-cue-evaluation-core.mjs";

const signal = (assessability, referenceCue, predictionCue, confidence, rawScore = null) => ({
  reference: { assessability, cue: referenceCue },
  prediction: { cue: predictionCue, confidence, rawScore }
});
const item = (caseId, tags, signals) => ({
  caseId, subjectGroupId: "group_1", captureTags: tags, signals
});
const base = {
  schemaVersion: SKIN_CUE_EVAL_VERSION,
  datasetId: "synthetic_s1_test",
  evidenceFamily: "synthetic",
  cases: [
    item("A", ["baseline"], { redness: signal("assessable", "present", "present", "high", 4) }),
    item("B", ["white_balance_shift"], { redness: signal("assessable", "absent", "present", "high", 4) }),
    item("C", ["low_light"], { redness: signal("assessable", "absent", "abstain", "low", 0) }),
    item("D", ["makeup_present"], { redness: signal("not_assessable", null, "present", "high", 4) }),
    item("E", ["filter_suspected"], { redness: signal("ambiguous", null, "abstain", "unknown", null) }),
    item("F", ["baseline", "different_device"], { pores: signal("assessable", "absent", "absent", "medium", 0) })
  ]
};
const result = evaluateSkinCues(base);
assert.equal(result.status, "DIAGNOSTIC_ONLY");
assert.equal(result.evidenceFamily, "synthetic");
assert.equal(result.count.cases, 6);
assert.equal(result.count.observations, 6);
assert.equal(result.axes.redness.tp, 1);
assert.equal(result.axes.redness.fp, 1);
assert.equal(result.axes.redness.tn, 0);
assert.equal(result.axes.redness.referenceAssessable, 3);
assert.equal(result.axes.redness.referenceNotAssessable, 1);
assert.equal(result.axes.redness.referenceAmbiguous, 1);
assert.equal(result.axes.redness.abstainedAssessable, 1);
assert.equal(result.axes.redness.nonAbstainedWithoutReference, 1);
assert.equal(result.axes.redness.highConfidenceWithoutReference, 1);
assert.equal(result.axes.redness.precision, 0.5);
assert.equal(result.axes.redness.recall, 1);
assert.equal(result.axes.redness.assessableCoverage, 0.666667);
assert.equal(result.axes.redness.referenceUnknownRate, 0.4);
assert.equal(result.axes.pores.tn, 1);
assert.equal(result.axes.pores.precision, null);
assert.equal(result.axes.acne.rows, 0);
assert.equal(result.axes.acne.assessableCoverage, null);
assert.equal(result.strata.makeup_present.redness.highConfidenceWithoutReference, 1);
assert.equal(result.strata.white_balance_shift.redness.fp, 1);
assert.deepEqual(Object.keys(result.axes), SKIN_CUE_AXES);
assert.deepEqual(evaluateSkinCues({ ...base, cases: [...base.cases].reverse() }), result);
assert.deepEqual(validateSkinCueEvaluationManifest(base).cases[0].signals.redness.reference,
  { assessability: "assessable", cue: "present" });
assert.equal(result.meaning.absentNotInferredFromZeroScore, true);
assert.equal(result.meaning.realPhotoAccuracyCertified, false);
assert.equal(result.meaning.productionActivationAuthorized, false);

function reject(mutated, pattern) {
  assert.throws(() => evaluateSkinCues(mutated), pattern);
}
reject({ ...base, evidenceFamily: "production_truth" }, /evidence_family_invalid/);
reject({ ...base, cases: [...base.cases, base.cases[0]] }, /case_duplicate/);
reject({ ...base, cases: [{ ...base.cases[0], imageBase64: "sensitive" }] }, /unknown_keys/);
reject({ ...base, cases: [{ ...base.cases[0], captureTags: ["portrait_shot"] }] }, /capture_tags_invalid/);
reject({ ...base, cases: [item("X", ["baseline"], { uv: signal("assessable", "present", "present", "high", 5) })] }, /signals_invalid/);
reject({ ...base, cases: [item("X", ["baseline"], { redness: signal("not_assessable", "absent", "present", "high", 4) })] }, /reference_cue_invalid/);
reject({ ...base, cases: [item("X", ["baseline"], { redness: signal("assessable", "present", "absent", "low", 6) })] }, /raw_score_invalid/);
reject({ ...base, cases: [item("X", ["baseline"], { redness: signal("assessable", "present", "absent", "low", null), clinicalDiagnosis: {} })] }, /signals_invalid/);
const human = evaluateSkinCues({ ...base, evidenceFamily: "human_review", datasetId: "unverified_human_input" });
assert.equal(human.meaning.realPhotoAccuracyCertified, false, "human-labelled record alone cannot certify accuracy");
console.log("verify-face-lab-skin-s1-cue-evaluation: PASS (synthetic-only, no provider/photo/production)");
