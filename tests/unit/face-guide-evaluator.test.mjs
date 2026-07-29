import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateFaceGuide,
  FACE_GUIDE_STATE,
  mapLandmarkToCoverFrame
} from "../../lib/face-guide/face-guide-evaluator.mjs";

const OVAL_INDICES = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365,
  379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93,
  234, 127, 162, 21, 54, 103, 67, 109
];

const FRAME = Object.freeze({
  guideRect: Object.freeze({ height: 374, left: 55, top: 193, width: 280 }),
  videoHeight: 480,
  videoRect: Object.freeze({ height: 844, left: 0, top: 0, width: 390 }),
  videoWidth: 640
});

function createFace(mode = "ready") {
  const scale = mode === "too_far" ? 0.65 : mode === "too_close" ? 1.2 : 1;
  const centerX = mode === "off_center" ? 0.55 : 0.5;
  const centerY = 0.45;
  const radiusX = 0.11 * scale;
  const radiusY = 0.2 * scale;
  const landmarks = Array.from({ length: 478 }, () => ({ x: centerX, y: centerY, z: 0 }));

  OVAL_INDICES.forEach((index, pointIndex) => {
    const angle = -Math.PI / 2 + (pointIndex / OVAL_INDICES.length) * Math.PI * 2;
    landmarks[index] = {
      x: centerX + Math.cos(angle) * radiusX,
      y: centerY + Math.sin(angle) * radiusY,
      z: 0
    };
  });

  landmarks[33] = { x: centerX - radiusX * 0.5, y: centerY - radiusY * 0.36, z: 0 };
  landmarks[263] = { x: centerX + radiusX * 0.5, y: centerY - radiusY * 0.36, z: 0 };
  landmarks[234] = { x: centerX - radiusX, y: centerY, z: 0 };
  landmarks[454] = { x: centerX + radiusX, y: centerY, z: 0 };
  landmarks[152] = { x: centerX, y: centerY + radiusY, z: 0 };
  landmarks[1] = {
    x: mode === "not_frontal" ? centerX - radiusX * 0.75 : centerX,
    y: centerY + radiusY * 0.04,
    z: 0
  };

  if (mode === "tilted") {
    landmarks[33].y -= radiusY * 0.12;
    landmarks[263].y += radiusY * 0.12;
  }

  return landmarks;
}

function evaluate(faces, mirrored = true) {
  return evaluateFaceGuide({
    ...FRAME,
    faceLandmarks: faces,
    mirrored
  });
}

test("maps mirrored object-cover coordinates symmetrically", () => {
  const unmirroredLeft = mapLandmarkToCoverFrame({
    landmark: { x: 0.25, y: 0.5, z: 0 },
    mirrored: false,
    videoHeight: FRAME.videoHeight,
    videoRect: FRAME.videoRect,
    videoWidth: FRAME.videoWidth
  });
  const mirroredLeft = mapLandmarkToCoverFrame({
    landmark: { x: 0.25, y: 0.5, z: 0 },
    mirrored: true,
    videoHeight: FRAME.videoHeight,
    videoRect: FRAME.videoRect,
    videoWidth: FRAME.videoWidth
  });

  assert.ok(unmirroredLeft && mirroredLeft);
  assert.equal(Math.round(unmirroredLeft.x + mirroredLeft.x), FRAME.videoRect.width);
});

test("classifies face count, distance, position, and frontal state", () => {
  assert.equal(evaluate([]).state, FACE_GUIDE_STATE.noFace);
  assert.equal(evaluate([createFace(), createFace()]).state, FACE_GUIDE_STATE.multipleFaces);
  assert.equal(evaluate([createFace("too_far")]).state, FACE_GUIDE_STATE.tooFar);
  assert.equal(evaluate([createFace("too_close")]).state, FACE_GUIDE_STATE.tooClose);
  assert.equal(evaluate([createFace("off_center")]).state, FACE_GUIDE_STATE.offCenter);
  assert.equal(evaluate([createFace("not_frontal")]).state, FACE_GUIDE_STATE.notFrontal);
  assert.equal(evaluate([createFace("tilted")]).state, FACE_GUIDE_STATE.notFrontal);
});

test("keeps frontal roll valid for mirrored and original eye order", () => {
  const mirroredReady = evaluate([createFace()], true);
  const unmirroredReady = evaluate([createFace()], false);

  assert.equal(mirroredReady.state, FACE_GUIDE_STATE.ready);
  assert.equal(unmirroredReady.state, FACE_GUIDE_STATE.ready);
  assert.ok(mirroredReady.metrics.rollDegrees < 0.01);
  assert.ok(unmirroredReady.metrics.rollDegrees < 0.01);
});
