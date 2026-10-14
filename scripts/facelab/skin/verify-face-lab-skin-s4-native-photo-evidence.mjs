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
assert.equal(resolveSkinPhotoDisplayState(null).status, "unknown");
const replay = state("unavailable", "available");
assert.deepEqual(state("unavailable", "available"), replay);

const component = readFileSync("apps/mobile/features/reports/NativeSavedReport.tsx", "utf8");
assert(component.includes('import { resolveSkinPhotoDisplayState } from "./skin-photo-evidence-status";'));
assert(component.includes('<Section title={copy.photoEvidence} lines={getSkinPhotoEvidenceLines(report, locale)} />'));
assert(component.includes("if (state.statusConflict) return [copy.conflict];"));
assert(component.includes("피부 판단을 보류하고 재확인해야 합니다"));
assert(!component.includes("photoEvidenceState ="), "render component must not mutate saved photo state");
console.log("verify-face-lab-skin-s4-native-photo-evidence: PASS (synthetic display states only)");
