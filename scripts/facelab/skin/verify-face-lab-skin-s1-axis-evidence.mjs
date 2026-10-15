import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SKIN_AXIS_EVIDENCE_VERSION,
  SKIN_VISIBLE_AXES,
  assessSkinAxisEvidence,
  hasUsablePositiveSkinAxisEvidence
} from "./skin-axis-evidence-contract-core.mjs";

const gate = { photoStatus: "available", skinAnalysisEligible: true };
const observation = (axis, state, value, confidence, cue, area, reason) =>
  ({ axis, state, value, confidence, cue, area, reason });
const base = [
  observation("oiliness", "present", 4, "high", "surface_shine", "forehead", "none"),
  observation("dehydration", "not_seen", 0, "medium", "dry_texture", "cheeks", "none"),
  observation("acne", "unassessable", null, "unknown", null, null, "blur"),
  observation("uneven_tone", "unknown", null, "unknown", null, null, "missing"),
  observation("pores", "not_seen", 0, "high", "pore_visibility", "cheeks", "none"),
  observation("redness", "present", 5, "low", "red_appearance", "cheeks", "none"),
  observation("barrier", "present", 2, "medium", "surface_stress", "chin", "none")
];
const make = (axes = base) => ({ schemaVersion: SKIN_AXIS_EVIDENCE_VERSION, axes });
const check = (axes = base, policy = gate) => assessSkinAxisEvidence(make(axes), policy);
function change(axis, replacement, axes = base) {
  return axes.map(x => x.axis === axis ? { ...x, ...replacement } : x);
}
function invalid(axis, replacement, axes = base) {
  const got = check(change(axis, replacement, axes));
  assert.equal(got.axes[axis].state, "unknown", axis + " must HOLD");
  assert.equal(got.axes[axis].value, null, axis + " must preserve null");
  assert.equal(got.axes[axis].reason, "invalid_field");
  assert.equal(hasUsablePositiveSkinAxisEvidence(got, axis), false);
  assert(got.issues.some(x => x.axis === axis));
  return got;
}

const a = check();
assert.equal(a.status, "ready");
assert.equal(a.photoGate, "usable");
assert.equal(a.issues.length, 0);
assert.deepEqual(Object.keys(a.axes), SKIN_VISIBLE_AXES);
assert.equal(a.axes.dehydration.value, 0);
assert.equal(a.axes.dehydration.state, "not_seen");
assert.equal(a.axes.acne.value, null);
assert.equal(a.axes.acne.state, "unassessable");
assert.equal(a.axes.uneven_tone.value, null);
assert.equal(a.axes.uneven_tone.state, "unknown");
assert.equal(hasUsablePositiveSkinAxisEvidence(a, "oiliness"), true);
assert.equal(hasUsablePositiveSkinAxisEvidence(a, "barrier"), true);
assert.equal(hasUsablePositiveSkinAxisEvidence(a, "redness"), false);
assert.equal(hasUsablePositiveSkinAxisEvidence(a, "pores"), false);
assert.equal(hasUsablePositiveSkinAxisEvidence(a, "uv"), false);
assert.equal(hasUsablePositiveSkinAxisEvidence({ schemaVersion: SKIN_AXIS_EVIDENCE_VERSION, photoGate: "usable", axes: { oiliness: { state: "present", confidence: "high" } } }, "oiliness"), false);
assert.equal(a.authority.scoringActivated, false);
assert.equal(a.authority.realPhotoAccuracyVerified, false);
assert.equal(a.authority.historicalZeroRecovered, false);
assert.deepEqual(check([...base].reverse()).axes, a.axes);

// Converting a v1 numeric 0 (or 5!) into "not_seen" or "present" is forbidden.
const legacy = assessSkinAxisEvidence(
  { schemaVersion: "vision-observation-v1", skin: { signals: { pores: 0, redness: 5 } } },
  gate
);
assert.equal(legacy.status, "unsupported_schema");
assert.equal(legacy.axes.pores.state, "unknown");
assert.equal(legacy.axes.pores.value, null);
assert.equal(legacy.axes.redness.state, "unknown");
assert.equal(legacy.axes.redness.value, null);
assert.equal(legacy.axes.pores.reason, "legacy_unverifiable");
assert.equal(hasUsablePositiveSkinAxisEvidence(legacy, "redness"), false);

// A failed photo must dominate even an otherwise impeccable cue manifest.
for (const [photoStatus, reason] of [
  ["unavailable", "photo_unavailable"],
  ["not_provided", "no_photo"],
  ["ineligible", "image_ineligible"],
  ["insufficient_evidence", "insufficient_evidence"],
  ["unknown", "photo_state_unknown"]
]) {
  const blocked = check(base, { photoStatus, skinAnalysisEligible: true });
  assert.equal(blocked.photoGate, "blocked");
  assert.equal(blocked.axes.oiliness.state, "unknown");
  assert.equal(blocked.axes.oiliness.reason, reason);
  assert.equal(hasUsablePositiveSkinAxisEvidence(blocked, "oiliness"), false);
}
for (const otherGate of [
  { photoStatus: "available", skinAnalysisEligible: false },
  { photoStatus: "available" },
  {}
]) {
  const blocked = check(base, otherGate);
  assert.equal(blocked.photoGate, "blocked");
  assert.equal(hasUsablePositiveSkinAxisEvidence(blocked, "oiliness"), false);
}

// Positive signal must be actually observable, valid, axis-matched and an integer.
invalid("oiliness", { value: 0 });
invalid("oiliness", { value: "4" });
invalid("oiliness", { value: NaN });
invalid("oiliness", { value: 6 });
invalid("oiliness", { cue: "red_appearance" });
invalid("oiliness", { cue: "uncertain" });
invalid("oiliness", { area: "unknown" });
invalid("oiliness", { reason: "unsupported" });
invalid("oiliness", { confidence: "very_high" });
invalid("oiliness", { state: "present", value: null });

// Only a deliberately observed zero has not_seen status.
invalid("dehydration", { value: null });
invalid("dehydration", { value: 1 });
invalid("dehydration", { confidence: "low" });
invalid("dehydration", { area: "unknown" });
invalid("dehydration", { cue: "active_spots" });
invalid("dehydration", { reason: "blur" });
invalid("dehydration", { state: "present" }); // 0 cannot become a positive cue.

// Unsupported and unknown always retain null, not 0.
invalid("acne", { value: 0 });
invalid("acne", { cue: "active_spots" });
invalid("acne", { reason: "none" });
invalid("uneven_tone", { value: 0 });
invalid("uneven_tone", { confidence: "medium" });
invalid("uneven_tone", { reason: "blur" });

// Contradictory, duplicated, omitted, or unrecognized axes stay uncertain.
const omitted = check(base.filter(item => item.axis !== "pores"));
assert.equal(omitted.status, "partial");
assert.equal(omitted.axes.pores.reason, "missing");
assert.equal(omitted.axes.pores.value, null);
assert.equal(hasUsablePositiveSkinAxisEvidence(omitted, "pores"), false);
const duplicated = check([...base, { ...base[0], confidence: "low" }]);
assert.equal(duplicated.status, "partial");
assert.equal(duplicated.axes.oiliness.state, "unknown");
assert(duplicated.issues.some(x => x.axis === "oiliness" && x.code === "duplicate_axis"));
assert.equal(duplicated.axes.barrier.state, "present"); // valid axes survive another axis error
const unsupported = check([
  ...base,
  observation("uv", "present", 5, "high", "tone_variation", "full_face", "none")
]);
assert.equal(unsupported.status, "partial");
assert.equal(unsupported.axes.oiliness.state, "present");
assert(unsupported.issues.some(x => x.code === "unsupported_axis_or_row"));
assert.equal(hasUsablePositiveSkinAxisEvidence(unsupported, "uv"), false);

const extra = check(change("oiliness", { rawFaceImage: "DO_NOT_RETAIN" }));
assert.equal(extra.axes.oiliness.state, "unknown");
assert(!JSON.stringify(extra).includes("DO_NOT_RETAIN"));
assert.equal(check([...base, { malicious: "SECRET_TEXT" }]).status, "partial");
assert(!JSON.stringify(check([...base, { malicious: "SECRET_TEXT" }])).includes("SECRET_TEXT"));
assert.equal(assessSkinAxisEvidence(null, gate).status, "unsupported_schema");
assert.equal(assessSkinAxisEvidence({ schemaVersion: SKIN_AXIS_EVIDENCE_VERSION, axes: "bad" }, gate).status, "unsupported_schema");
assert.equal(check([...base, ...base, ...base]).status, "unsupported_schema");

// No current product path may call the evaluation-only helper.
const sourcePath = "skin-axis-evidence-contract-core";
for (const path of [
  "lib/vision-observation-normalizer.js",
  "lib/vision-observation-contract.js",
  "lib/skin-match-decision-engine-core.js",
  "app/api/analyze/route.js",
  "lib/shared-skin-decision-context-v4.js"
]) {
  assert(!readFileSync(path, "utf8").includes(sourcePath), path + " must not import evaluation-only evidence");
}

console.log("verify-face-lab-skin-s1-axis-evidence: PASS synthetic_negative_matrix=covered provider_calls=0 production_score_changes=0 real_photo_validated=false");
