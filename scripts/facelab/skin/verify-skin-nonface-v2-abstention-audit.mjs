import assert from "node:assert/strict";
import { inspectNonfaceSkinV2Abstention as inspect } from "./skin-nonface-v2-abstention-audit.mjs";
import { SKIN_VISIBLE_AXES } from "./skin-axis-evidence-contract-core.mjs";

const ineligible = {
  status: "ineligible", source: "vision", imageType: "other",
  humanFaceCount: 0, faceLabEligible: false, skinAnalysisEligible: false,
  faceLabFailureReason: "face_not_detected",
  skinFailureReason: "face_not_detected",
  confidence: 0.98,
  evidence: ["colored squares without a face"]
};
const unknown = (axis) => ({ axis, state: "unknown", value: null,
  confidence: "unknown", cue: null, area: null, reason: "missing" });
const fixture = {
  schemaVersion: "vision-observation-v2",
  eligibility: ineligible,
  skin: { axisEvidence: SKIN_VISIBLE_AXES.map(unknown) },
  face: {}
};
const clone = (x) => structuredClone(x);
const observed = inspect(fixture);
assert.equal(observed.nonfaceEligibilityVerified, true);
assert.equal(observed.axisRowCount, 7);
assert.equal(observed.axisShapeValid, true);
assert.equal(observed.withheldPositiveOrZeroCues, true);
assert.equal(observed.stateCounts.unknown, 7);
assert.equal(observed.verdict, "SEVEN_ABSTAINING_AXES_REQUIRES_CONTRACT_DECISION");
assert.equal(observed.productReady, false);
assert.equal(observed.releaseReady, false);
assert.equal(observed.actualHumanSkinAccuracyVerified, false);

const empty = clone(fixture); empty.skin.axisEvidence = [];
const emptyResult = inspect(empty);
assert.equal(emptyResult.verdict, "EMPTY_AXES_REQUIRES_CONTRACT_DECISION");
assert.equal(emptyResult.axisShapeValid, false);
assert.equal(emptyResult.withheldPositiveOrZeroCues, true);
assert.equal(emptyResult.axisRowCount, 0);

const missing = clone(fixture); delete missing.skin.axisEvidence;
assert.equal(inspect(missing).verdict, "SKIN_OUTPUT_MISSING_OR_UNEXPECTED_SHAPE");
const badTop = { ...fixture, medicalAdvice: "private text" };
assert.equal(inspect(badTop).verdict, "SKIN_OUTPUT_MISSING_OR_UNEXPECTED_SHAPE");
const badSkin = clone(fixture); badSkin.skin.legacySignals = { acne: 5 };
assert.equal(inspect(badSkin).verdict, "SKIN_OUTPUT_MISSING_OR_UNEXPECTED_SHAPE");
const count6 = clone(fixture); count6.skin.axisEvidence.pop();
assert.equal(inspect(count6).verdict, "AXIS_COUNT_INCOMPLETE_OR_EXCESSIVE");
const count8 = clone(fixture); count8.skin.axisEvidence.push(unknown("extra"));
assert.equal(inspect(count8).verdict, "AXIS_COUNT_INCOMPLETE_OR_EXCESSIVE");

const dup = clone(fixture); dup.skin.axisEvidence[6] = unknown("pores");
assert.equal(inspect(dup).verdict, "INVALID_SKIN_AXIS_ROWS");
assert.ok(inspect(dup).shapeIssues.includes("duplicate_axis"));
const extra = clone(fixture); extra.skin.axisEvidence[0].privateEmail = "secret@example.com";
assert.equal(inspect(extra).verdict, "INVALID_SKIN_AXIS_ROWS");
assert.equal(JSON.stringify(inspect(extra)).includes("secret@example.com"), false);
const malformed = clone(fixture); malformed.skin.axisEvidence[3].value = 0;
assert.equal(inspect(malformed).verdict, "INVALID_SKIN_AXIS_ROWS");

const present = clone(fixture);
present.skin.axisEvidence[0] = { axis: "oiliness", state: "present", value: 5,
  confidence: "high", cue: "surface_shine", area: "t_zone", reason: "none" };
assert.equal(inspect(present).verdict, "UNSAFE_NONFACE_POSITIVE_OR_OBSERVED_ZERO");
assert.equal(inspect(present).withheldPositiveOrZeroCues, false);
const zero = clone(fixture);
zero.skin.axisEvidence[1] = { axis: "dehydration", state: "not_seen", value: 0,
  confidence: "medium", cue: "dry_texture", area: "cheeks", reason: "none" };
assert.equal(inspect(zero).verdict, "UNSAFE_NONFACE_POSITIVE_OR_OBSERVED_ZERO");
const unassessable = clone(fixture);
unassessable.skin.axisEvidence[1] = { axis: "dehydration", state: "unassessable",
  value: null, confidence: "unknown", cue: null, area: null, reason: "unsupported" };
assert.equal(inspect(unassessable).verdict, "SEVEN_ABSTAINING_AXES_REQUIRES_CONTRACT_DECISION");

const eligible = clone(fixture);
eligible.eligibility = { ...ineligible, status: "eligible", imageType: "photorealistic_human",
  humanFaceCount: 1, faceLabEligible: true, skinAnalysisEligible: true,
  faceLabFailureReason: null, skinFailureReason: null };
assert.equal(inspect(eligible).verdict, "ELIGIBILITY_NOT_INELIGIBLE_NONFACE");
assert.equal(inspect(eligible).nonfaceEligibilityVerified, false);
const untrusted = clone(fixture);
untrusted.eligibility.evidence = [];
assert.equal(inspect(untrusted).nonfaceEligibilityVerified, false);
const wrong = clone(fixture); wrong.schemaVersion = "vision-observation-v1";
assert.equal(inspect(wrong).verdict, "INVALID_OR_NOT_V2");

// No source leakage even with arbitrary strings in face output.
const malicious = clone(fixture);
malicious.face = { private: "BIO_IDENTIFYING_SOURCE_SENTINEL" };
malicious.skin.axisEvidence[0].cue = "BIO_IDENTIFYING_SOURCE_SENTINEL";
const sanitized = inspect(malicious);
assert.equal(JSON.stringify(sanitized).includes("BIO_IDENTIFYING_SOURCE_SENTINEL"), false);
assert.equal(JSON.stringify(sanitized).includes("colored squares"), false);
console.log("verify-skin-nonface-v2-abstention-audit: PASS (synthetic-only expected hold, unknown, zero, count, duplicate, privacy)");
