import assert from "node:assert/strict";
import { compareSkinPhotoSessions, SKIN_COMPARE_VERSION } from "./skin-photo-comparability-core.mjs";

const conditions = Object.freeze({
  deviceClass: "device_A",
  lighting: "controlled",
  whiteBalance: "neutral",
  makeup: "none",
  filter: "none",
  angle: "front",
  resolution: "adequate"
});
function photo(captureId, capturedAt, override = {}) {
  return {
    captureId,
    subjectGroupId: "opaque_group_1",
    capturedAt,
    photoStatus: "available",
    conditions: { ...conditions },
    signals: {
      redness: { state: "observed", score: 2, confidence: "high" },
      pores: { state: "unassessable", score: null, confidence: "unknown" }
    },
    ...override
  };
}
const earlier = photo("capture_1", "2026-10-01T12:00:00Z");
const later = photo("capture_2", "2026-10-08T12:00:00Z", {
  signals: {
    redness: { state: "observed", score: 3, confidence: "medium" },
    pores: { state: "observed", score: 0, confidence: "high" }
  }
});
const good = compareSkinPhotoSessions(earlier, later);
assert.equal(good.version, SKIN_COMPARE_VERSION);
assert.equal(good.status, "comparable");
assert.equal(good.axes.redness.rawScoreDeltaForAudit, 1);
assert.equal(good.axes.redness.improvementClaimAuthorized, false);
assert.equal(good.axes.pores.status, "not_comparable");
assert.equal(good.axes.pores.rawScoreDeltaForAudit, null);
assert.equal(good.authority.sameHumanOrPhotographyVerified, false);
assert.deepEqual(compareSkinPhotoSessions(earlier, later), good);

const limited = compareSkinPhotoSessions(earlier, photo("capture_2", later.capturedAt, {
  conditions: { ...conditions, deviceClass: "device_B" }
}));
assert.equal(limited.status, "limited");
assert.equal(limited.axes.redness.status, "limited");
assert.equal(limited.axes.redness.rawScoreDeltaForAudit, null);
assert(limited.reasonCodes.includes("device_mismatch"));

const worseConditions = [
  { filter: "present" },
  { filter: "unknown" },
  { makeup: "present" },
  { makeup: "unknown" },
  { whiteBalance: "warm" },
  { whiteBalance: "unknown" },
  { lighting: "low" },
  { lighting: "harsh" },
  { lighting: "unknown" }
];
for (const patch of worseConditions) {
  const result = compareSkinPhotoSessions(earlier, photo("capture_2", later.capturedAt, {
    conditions: { ...conditions, ...patch }
  }));
  assert.equal(result.status, "not_comparable");
  assert.equal(result.axes.redness.rawScoreDeltaForAudit, null);
}
for (const status of ["unavailable", "ineligible", "insufficient_evidence", "not_provided"]) {
  const result = compareSkinPhotoSessions(earlier, photo("capture_2", later.capturedAt, { photoStatus: status }));
  assert.equal(result.status, "not_comparable");
  assert(result.reasonCodes.includes("photo_not_available"));
}
assert.equal(compareSkinPhotoSessions(earlier, earlier).status, "not_comparable");
assert.equal(compareSkinPhotoSessions(later, earlier).status, "not_comparable");
assert.equal(compareSkinPhotoSessions(earlier, photo("capture_2", later.capturedAt, { subjectGroupId: "opaque_group_2" })).status, "not_comparable");
assert.equal(compareSkinPhotoSessions(earlier, photo("capture_2", later.capturedAt, {
  signals: { redness: { state: "observed", score: 0, confidence: "low" } }
})).axes.redness.status, "not_comparable");
assert.equal(compareSkinPhotoSessions(earlier, photo("capture_2", later.capturedAt, {
  signals: { redness: { state: "unknown", score: null, confidence: "unknown" } }
})).axes.redness.status, "not_comparable");
assert.throws(() => compareSkinPhotoSessions(earlier, { ...later, imageUrl: "https://example.com/photo" }), /invalid_capture_object/);
assert.throws(() => compareSkinPhotoSessions(earlier, { ...later, capturedAt: "yesterday" }), /invalid_capturedAt/);
assert.throws(() => compareSkinPhotoSessions(earlier, { ...later, signals: { uv: { state: "observed", score: 4, confidence: "high" } } }), /invalid_signals/);
assert.throws(() => compareSkinPhotoSessions(earlier, { ...later, conditions: { ...conditions, lighting: "magical" } }), /invalid_capture_condition/);
assert.throws(() => compareSkinPhotoSessions(earlier, { ...later, signals: { redness: { state: "unassessable", score: 0, confidence: "low" } } }), /unobserved_must_be_null/);
console.log("verify-face-lab-skin-s3-comparability: PASS (synthetic metadata only, no improvement claims)");
