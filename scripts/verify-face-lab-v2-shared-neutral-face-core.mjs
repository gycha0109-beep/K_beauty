import assert from "node:assert/strict";
import { inspectSharedNeutralFaceCoreCandidate } from "../lib/face-lab-v2/personal-color/shared-neutral-face-core-candidate.js";
import { compareSharedNeutralFaceCoreRoiParity } from "../lib/face-lab-v2/personal-color/shared-core-roi-parity.js";

const width = 128, height = 128;
const landmarks = Array.from({length: 478}, () => ({x: 0.5, y: 0.5, z: 0}));
for (const [index, [x, y]] of Object.entries({
  234: [0.20, 0.50], 454: [0.80, 0.50], 1: [0.50, 0.48],
  33: [0.35, 0.32], 263: [0.65, 0.32],
  61: [0.40, 0.68], 291: [0.60, 0.68]
})) landmarks[Number(index)] = {x, y, z: 0};

const source = JSON.stringify(landmarks);
let frameSeen = 0;
const inspected = inspectSharedNeutralFaceCoreCandidate({
  faceLandmarks: landmarks, faceCount: 1, coordinateSpace: "original_image",
  onFrame(frame) {
    frameSeen++;
    assert.equal(frame.coordinateSpace, "original_image");
    assert.equal(frame.semanticSideAuthority, false);
    assert.equal(frame.landmarks.length, 468);
    assert.ok(Object.isFrozen(frame.landmarks));
    assert.deepEqual(frame.landmarks[234], {x: 0.2, y: 0.5});
    assert.equal("z" in frame.landmarks[234], false);
  }
});
assert.equal(inspected.status, "candidate_only");
assert.equal(inspected.providerLandmarkCount, 478);
assert.equal(inspected.geometryLandmarkCount, 468);
assert.equal(frameSeen, 1);
assert.equal(inspected.productionAuthorized, false);
assert.equal(inspected.faceLandmarksPersisted, false);

const arg = { faceLandmarks: landmarks, faceCount: 1,
  coordinateSpace: "original_image", width, height };
const paired = compareSharedNeutralFaceCoreRoiParity(arg);
assert.equal(paired.status, "comparison_only", JSON.stringify(paired));
assert.equal(paired.parity, "diverged");
assert.match(paired.neutralCoreVersion,/myeongha-neutral-face-observation/);
assert.equal(paired.reference, "same_detector_different_research_roi_algorithms_not_human_accuracy");
assert.equal(paired.independentlyReviewedSkin, false);
assert.equal(paired.skinMeasurement, null);
assert.equal(paired.productionAuthorized, false);
for (const region of ["leftCheek", "rightCheek", "exclusion"]) {
  assert.equal(paired.metrics[region].samePixels, false);
  assert.ok(paired.metrics[region].iou > 0 && paired.metrics[region].iou < 1);
  assert.ok(paired.metrics[region].intersectionPixels > 0);
}
assert.deepEqual(compareSharedNeutralFaceCoreRoiParity(arg), paired);
assert.equal(JSON.stringify(landmarks), source);

function rejected(overrides, reason) {
  const result = compareSharedNeutralFaceCoreRoiParity({...arg, ...overrides});
  assert.equal(result.status, "insufficient_evidence", JSON.stringify(result));
  assert.equal(result.reason, reason);
  assert.equal(result.parity, null);
  assert.equal(result.faceLandmarksPersisted, false);
  assert.equal(result.skinMeasurement, null);
}
rejected({coordinateSpace: "mirrored_preview"}, "image_orientation_unknown");
rejected({faceCount: 2}, "single_face_landmarks_unavailable");
rejected({faceLandmarks: landmarks.slice(0, 469)}, "unsupported_provider_topology");
rejected({width: 0}, "invalid_image_dimensions");
rejected({width: 8192, height: 8192}, "invalid_image_dimensions");
const invalidNonAnchor = structuredClone(landmarks);
invalidNonAnchor[101].x = 2;
rejected({faceLandmarks: invalidNonAnchor}, "neutral_landmarks_invalid");
const badDepth = structuredClone(landmarks);
badDepth[101].z = NaN;
rejected({faceLandmarks: badDepth}, "neutral_landmarks_invalid");
let callbackCount = 0;
const refused = inspectSharedNeutralFaceCoreCandidate({
  faceLandmarks: invalidNonAnchor, faceCount: 1,
  coordinateSpace: "original_image", onFrame() { callbackCount++; }
});
assert.equal(refused.status, "insufficient_evidence");
assert.equal(callbackCount, 0);
const callbackFailure = inspectSharedNeutralFaceCoreCandidate({
  faceLandmarks: landmarks, faceCount: 1,
  coordinateSpace: "original_image", onFrame() { throw new Error("private"); }
});
assert.equal(callbackFailure.reason, "neutral_consumer_failed");
assert.ok(!JSON.stringify(callbackFailure).includes("private"));

for (const receipt of [inspected, paired, refused]) {
  const serialized = JSON.stringify(receipt);
  for (const secret of ["landmarks", "cheekPolygons", "skinRegionMasks", "imageBlob", "sourceImage"]) {
    // The boolean privacy contract contains "faceLandmarksPersisted" and
    // "sourceImagePersisted"; never return the raw fields themselves.
    assert.equal(Object.prototype.hasOwnProperty.call(receipt, secret), false);
  }
  assert.ok(!serialized.includes('"faceLandmarks":'));
  assert.ok(!serialized.includes('"cheekPolygons":'));
  assert.ok(!serialized.includes('"skinRegionMasks":'));
  assert.ok(!serialized.includes('"rgba":'));
}

console.log(JSON.stringify({
  ok: true,
  suite: "face_lab_m2_shared_neutral_core_contract_parity",
  implementation: "vendored_pinned_saju_package_and_independent_facelab_roi_algorithm",
  parity: paired.parity,
  detectedByMediaPipeInThisTest: false,
  independentHumanRoiAccuracyValidated: false,
  sourceImagePersisted: false,
  productionActivated: false
}));
