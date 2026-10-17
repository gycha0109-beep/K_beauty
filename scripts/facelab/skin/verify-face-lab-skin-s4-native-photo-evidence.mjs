import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveSkinPhotoDisplayState } from "../../../apps/mobile/features/reports/skin-photo-evidence-status.ts";

const sampleCues = {
  summary: "Visible redness",
  signals: [{ key: "redness", confidence: "medium" }]
};
function state(explicit, canonical, cues = sampleCues) {
  return resolveSkinPhotoDisplayState({
    ...(explicit ? { photoEvidenceState: { status: explicit } } : {}),
    ...(canonical ? { decisionBundle: { context: { photo: { status: canonical } } } } : {}),
    photoObservations: cues
  });
}
assert.deepEqual(state("available", "available"), {
  status: "available", statusConflict: false, highOrMediumObservationCount: 1
});
assert.deepEqual(state("unavailable", "available"), {
  status: "unavailable", statusConflict: true, highOrMediumObservationCount: 0
});
assert.equal(state("ineligible", "available").status, "ineligible");
assert.equal(state("insufficient_evidence", "available").status, "insufficient_evidence");
assert.equal(state("not_provided", "available").status, "not_provided");
assert.equal(state(null, "available").status, "unknown", "old canonical available must not assert photo success");
assert.equal(state(null, "unavailable").status, "unavailable");
assert.equal(resolveSkinPhotoDisplayState({}).status, "unknown");
assert.equal(state("available", "available", { signals: [] }).highOrMediumObservationCount, 0);
assert.equal(state("available", "available", { signals: [{ key: "redness", confidence: "low" }] }).highOrMediumObservationCount, 0);
assert.equal(state("available", "available", { signals: [{ key: "redness", confidence: "high" }] }).highOrMediumObservationCount, 1);
assert.equal(state("available", "available", { signals: [{ key: "redness", state: "unknown", confidence: "high" }] }).highOrMediumObservationCount, 0, "unknown v2 state must not masquerade as supporting cue");
assert.equal(state("available", "available", { signals: [{ key: "redness", state: "unassessable", confidence: "medium" }] }).highOrMediumObservationCount, 0, "unassessable evidence cannot be counted");
assert.equal(state("available", "available", { signals: [{ key: "redness", state: "present", confidence: "high" }] }).highOrMediumObservationCount, 1);
assert.equal(state("available", "available", { signals: [{ key: "redness", state: "not_seen", confidence: "medium" }] }).highOrMediumObservationCount, 1, "explicit visible absence can be a bounded visual cue, not proof of healthy skin");
assert.equal(state("available", "available", { signals: [{ key: "redness", state: "unsupported", confidence: "high" }] }).highOrMediumObservationCount, 0);

assert.equal(resolveSkinPhotoDisplayState(null).status, "unknown");
const replay = state("unavailable", "available");
assert.deepEqual(state("unavailable", "available"), replay);

const component = readFileSync("apps/mobile/features/reports/NativeSavedReport.tsx", "utf8");
assert(component.includes('import { resolveSkinPhotoDisplayState } from "./skin-photo-evidence-status";'));
assert(component.includes('<Section title={copy.photoEvidence} lines={getSkinPhotoEvidenceLines(report, locale)} />'));
assert(component.includes("if (state.statusConflict) return [copy.conflict];"));
assert(component.includes('if (state.status === "available" && state.highOrMediumObservationCount === 0) {'));
assert(component.includes("return [copy.limited];"), "no reliable individual cue must not be called supporting photo evidence");
assert(component.includes("사진 판단을 보류하고 재확인해야 합니다"));
assert(component.includes("필터 없이 조명이 고른 환경에서 다시 촬영해 볼 수 있습니다"), "insufficient evidence must explain how to retry");
assert(component.includes("You can retake a clear photo under even lighting."), "low confidence needs optional retake guidance");
assert(!component.includes("photoEvidenceState ="), "render component must not mutate saved photo state");
console.log("verify-face-lab-skin-s4-native-photo-evidence: PASS (synthetic display states only)");
