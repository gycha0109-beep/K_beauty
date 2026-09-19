import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildPhotoGeometryMeasurementFromFaceLandmarkerResult,
  reconstructMediaPipeMetricGeometry,
  validateMediaPipeMetricGeometryRuntimeMetadata
} from '../lib/face-lab-mediapipe-metric-geometry.js';

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

const base = 'evidence/facelab/photo-geometry/v0';
const manifest = readJson(base + '/mediapipe-face-geometry.manifest.json');
const runtimeMetadata = readJson(
  base + '/mediapipe-metric-geometry-runtime.metadata.json'
);
const screenFixture = readJson(
  base + '/mediapipe-upstream-screen-landmarks.fixture.json'
);
const expectedGeometry = readJson(
  base + '/mediapipe-upstream-geometry-output.fixture.json'
);

const metadataValidation =
  validateMediaPipeMetricGeometryRuntimeMetadata(runtimeMetadata);
assert.equal(
  metadataValidation.ok,
  true,
  metadataValidation.errors.join(',')
);
assert.equal(runtimeMetadata.productionAuthority, false);
assert.equal(runtimeMetadata.providerVersion, manifest.providerVersion);
assert.equal(screenFixture.landmarkTopology, 468);
assert.equal(screenFixture.landmarks.length, 468);
assert.equal(screenFixture.coordinateSpace, 'screen_normalized_xyz');

const reconstructed = reconstructMediaPipeMetricGeometry({
  screenLandmarks: screenFixture.landmarks,
  frameWidth: screenFixture.frame.width,
  frameHeight: screenFixture.frame.height
}, runtimeMetadata);

assert.equal(reconstructed.landmarks.length, 468);
assert.equal(
  reconstructed.diagnostics.coordinateSpace,
  'pose_normalized_metric_3d'
);

let maxCoordinateError = 0;
for (const [indexText, expected] of Object.entries(expectedGeometry.landmarks)) {
  const actual = reconstructed.landmarks[Number(indexText)];
  for (const axis of ['x', 'y', 'z']) {
    const error = Math.abs(actual[axis] - expected[axis]);
    maxCoordinateError = Math.max(maxCoordinateError, error);
    assert.ok(
      error < 2e-5,
      indexText + '.' + axis + ' upstream metric geometry parity drift: ' + error
    );
  }
}

const bridged = buildPhotoGeometryMeasurementFromFaceLandmarkerResult({
  sampleId: 'mediapipe_upstream_screen_runtime',
  faceLandmarkerResult: {
    faceLandmarks: [screenFixture.landmarks]
  },
  frameWidth: screenFixture.frame.width,
  frameHeight: screenFixture.frame.height,
  sourceVersion: manifest.providerVersion,
  sourceImagePersisted: false
}, manifest, runtimeMetadata);

assert.equal(Object.keys(bridged.packet.landmarks).length, 12);
assert.equal(bridged.packet.coordinateSpace, 'pose_normalized_metric_3d');
assert.equal(bridged.packet.poseNormalized, true);
assert.equal(bridged.packet.metricGeometry, true);
assert.equal(bridged.packet.sourceImagePersisted, false);
assert.equal(bridged.measurement.privacy.sourceImagePersisted, false);
assert.equal(bridged.measurement.privacy.identityEmbeddingCreated, false);

const expectedDimensions = {
  lower_face_width_ratio: 0.7607826208296034,
  chin_height_ratio: 0.5287697340619997,
  eye_spacing_ratio: 0.2227319468941475,
  eye_width_ratio: 0.1857692571116944,
  eye_tilt: 0.10998542128979372,
  nose_width_ratio: 0.27223537915718676
};
const actualDimensions = new Map(
  bridged.measurement.dimensions.map((item) => [item.id, item.value])
);
for (const [id, expected] of Object.entries(expectedDimensions)) {
  assert.ok(
    Math.abs(actualDimensions.get(id) - expected) < 2e-6,
    id + ' runtime measurement drift'
  );
}

assert.throws(
  () => buildPhotoGeometryMeasurementFromFaceLandmarkerResult({
    sampleId: 'zero_face',
    faceLandmarkerResult: { faceLandmarks: [] },
    frameWidth: 820,
    frameHeight: 1024,
    sourceVersion: manifest.providerVersion
  }, manifest, runtimeMetadata),
  /single_face_required/
);

assert.throws(
  () => buildPhotoGeometryMeasurementFromFaceLandmarkerResult({
    sampleId: 'two_faces',
    faceLandmarkerResult: {
      faceLandmarks: [screenFixture.landmarks, screenFixture.landmarks]
    },
    frameWidth: 820,
    frameHeight: 1024,
    sourceVersion: manifest.providerVersion
  }, manifest, runtimeMetadata),
  /single_face_required/
);

assert.throws(
  () => reconstructMediaPipeMetricGeometry({
    screenLandmarks: screenFixture.landmarks.slice(0, 467),
    frameWidth: 820,
    frameHeight: 1024
  }, runtimeMetadata),
  /landmark_topology_mismatch/
);

const withIrisTail = [
  ...screenFixture.landmarks,
  ...Array.from({ length: 10 }, () => ({ x: 0.5, y: 0.5, z: 0 }))
];
const withIris = reconstructMediaPipeMetricGeometry({
  screenLandmarks: withIrisTail,
  frameWidth: 820,
  frameHeight: 1024
}, runtimeMetadata);
assert.deepEqual(
  withIris.landmarks,
  reconstructed.landmarks,
  'Face Landmarker iris tail must be excluded exactly like upstream first-468 graph'
);

console.log(JSON.stringify({
  ok: true,
  productionAuthority: false,
  providerVersion: runtimeMetadata.providerVersion,
  upstreamParity: {
    sourceFixtureBlobSha: screenFixture.sourceBlobSha,
    maxCoordinateError,
    tolerance: 2e-5
  },
  runtimeBridge: {
    faceLandmarkerResultAccepted: true,
    first468Only: true,
    poseNormalizedMetric3D: true,
    minimalAnchorProjection: true,
    dimensions: bridged.measurement.dimensions
  }
}, null, 2));
