import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PHOTO_GEOMETRY_MANIFEST_SCHEMA_VERSION,
  PHOTO_GEOMETRY_PACKET_SCHEMA_VERSION,
  STRUCTURAL_MEASUREMENT_SCHEMA_VERSION,
  buildPhotoGeometryPacketFromMetricLandmarks,
  measurePhotoGeometry,
  validatePhotoGeometryManifest,
  validatePhotoGeometryPacket
} from '../lib/face-lab-photo-geometry-research.js';

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

const base = 'evidence/facelab/photo-geometry/v0';
const manifest = readJson(base + '/mediapipe-face-geometry.manifest.json');
const fixture = readJson(base + '/mediapipe-canonical-landmarks.fixture.json');
const upstreamGeometryFixture = readJson(base + '/mediapipe-upstream-geometry-output.fixture.json');
const diagnostic = readJson(base + '/mediapipe-vs-gnm-canonical-diagnostic.json');
const gnmEvidence = readJson('evidence/facelab/face-space-3d/v0/gnm-v3-poc-evidence-summary.json');

assert.equal(manifest.schemaVersion, PHOTO_GEOMETRY_MANIFEST_SCHEMA_VERSION);
assert.equal(fixture.schemaVersion, PHOTO_GEOMETRY_PACKET_SCHEMA_VERSION);

const manifestValidation = validatePhotoGeometryManifest(manifest);
assert.equal(manifestValidation.ok, true, manifestValidation.errors.join(','));

const fixtureValidation = validatePhotoGeometryPacket(fixture, manifest);
assert.equal(fixtureValidation.ok, true, fixtureValidation.errors.join(','));

const measurement = measurePhotoGeometry(fixture, manifest);
assert.equal(measurement.schemaVersion, STRUCTURAL_MEASUREMENT_SCHEMA_VERSION);
assert.equal(measurement.privacy.sourceImagePersisted, false);
assert.equal(measurement.privacy.identityEmbeddingCreated, false);

const byId = new Map(measurement.dimensions.map((item) => [item.id, item.value]));
const expected = {
  lower_face_width_ratio: 0.7751021570208014,
  chin_height_ratio: 0.38602395513547744,
  eye_spacing_ratio: 0.24222180527550102,
  eye_width_ratio: 0.17325655282091248,
  eye_tilt: 0,
  nose_width_ratio: 0.18340209039921024
};

for (const [id, value] of Object.entries(expected)) {
  assert.ok(Math.abs(byId.get(id) - value) < 1e-12, id + ' canonical fixture drift');
}

function transformFixture(source, { scale = 1, tx = 0, ty = 0, tz = 0 } = {}) {
  return {
    ...source,
    sampleId: source.sampleId + '_transformed',
    landmarks: Object.fromEntries(
      Object.entries(source.landmarks).map(([id, p]) => [
        id,
        {
          x: p.x * scale + tx,
          y: p.y * scale + ty,
          z: p.z * scale + tz
        }
      ])
    )
  };
}

const transformed = measurePhotoGeometry(
  transformFixture(fixture, { scale: 2.75, tx: 11, ty: -7, tz: 4 }),
  manifest
);
const transformedById = new Map(transformed.dimensions.map((item) => [item.id, item.value]));
for (const [id, value] of Object.entries(expected)) {
  assert.ok(
    Math.abs(transformedById.get(id) - value) < 1e-12,
    id + ' must be invariant to uniform scale and translation'
  );
}

const rawScreenPacket = {
  ...fixture,
  coordinateSpace: 'screen_normalized_xyz',
  poseNormalized: false,
  metricGeometry: false
};
assert.equal(
  validatePhotoGeometryPacket(rawScreenPacket, manifest).ok,
  false,
  'raw Face Landmarker screen coordinates must fail closed'
);

assert.equal(
  validatePhotoGeometryPacket({ ...fixture, faceCount: 2 }, manifest).ok,
  false,
  'photo geometry bridge must require exactly one face'
);

const missingAnchor = structuredClone(fixture);
delete missingAnchor.landmarks['234'];
assert.equal(
  validatePhotoGeometryPacket(missingAnchor, manifest).ok,
  false,
  'missing structural anchor must fail closed'
);

assert.equal(
  validatePhotoGeometryPacket({ ...fixture, imageDataUrl: 'data:image/png;base64,AAAA' }, manifest).ok,
  false,
  'image bytes must not enter the structural measurement packet'
);

assert.equal(
  validatePhotoGeometryPacket({ ...fixture, identityEmbedding: [0.1, 0.2] }, manifest).ok,
  false,
  'identity embeddings are forbidden'
);

assert.equal(
  validatePhotoGeometryManifest({ ...manifest, rawScreenLandmarksAccepted: true }).ok,
  false,
  'manifest must not silently accept screen-normalized landmarks'
);

assert.equal(
  validatePhotoGeometryManifest({ ...manifest, identityEmbeddingAllowed: true }).ok,
  false,
  'manifest must keep identity embeddings disabled'
);

const fullMetricLandmarks = Array.from(
  { length: manifest.landmarkTopology },
  () => ({ x: 0, y: 0, z: 0 })
);
for (const [id, value] of Object.entries(upstreamGeometryFixture.landmarks)) {
  fullMetricLandmarks[Number(id)] = value;
}
const minimalPacket = buildPhotoGeometryPacketFromMetricLandmarks({
  sampleId: 'minimal_packet_builder_fixture',
  sourceVersion: manifest.providerVersion,
  landmarks: fullMetricLandmarks,
  faceCount: 1,
  sourceImagePersisted: false
}, manifest);
assert.equal(
  Object.keys(minimalPacket.landmarks).length,
  Object.keys(manifest.anchorMap).length,
  'runtime packet builder must retain only required structural anchors'
);
assert.equal(validatePhotoGeometryPacket(minimalPacket, manifest).ok, true);
assert.deepEqual(
  measurePhotoGeometry(minimalPacket, manifest).dimensions,
  measurePhotoGeometry(upstreamGeometryFixture, manifest).dimensions,
  'minimal selected-anchor packet must preserve structural measurements'
);
assert.throws(
  () => buildPhotoGeometryPacketFromMetricLandmarks({
    sampleId: 'bad_face_count',
    sourceVersion: manifest.providerVersion,
    landmarks: fullMetricLandmarks,
    faceCount: 2
  }, manifest),
  /single_face_required/
);

const upstreamValidation = validatePhotoGeometryPacket(upstreamGeometryFixture, manifest);
assert.equal(upstreamValidation.ok, true, upstreamValidation.errors.join(','));

const upstreamMeasurement = measurePhotoGeometry(upstreamGeometryFixture, manifest);
const upstreamById = new Map(upstreamMeasurement.dimensions.map((item) => [item.id, item.value]));
const upstreamExpected = {
  lower_face_width_ratio: 0.7607826208296034,
  chin_height_ratio: 0.5287697340619997,
  eye_spacing_ratio: 0.2227319468941475,
  eye_width_ratio: 0.1857692571116944,
  eye_tilt: 0.10998542128979372,
  nose_width_ratio: 0.27223537915718676
};
for (const [id, value] of Object.entries(upstreamExpected)) {
  assert.ok(
    Math.abs(upstreamById.get(id) - value) < 1e-12,
    id + ' upstream FaceGeometry fixture drift'
  );
}
assert.notEqual(
  upstreamMeasurement.measurementDigest,
  measurement.measurementDigest,
  'canonical model and upstream runtime geometry fixtures must remain distinct evidence'
);

assert.equal(diagnostic.status, 'semantic_alignment_hold');
assert.equal(diagnostic.productionAuthority, false);
assert.deepEqual(
  diagnostic.interpretation.investigate,
  ['chin_height_ratio', 'nose_width_ratio'],
  'cross-backend canonical mismatch must stay frozen for investigation'
);

const gnmTemplate = gnmEvidence.probe.templateMetrics;
for (const item of diagnostic.dimensions) {
  assert.ok(byId.has(item.id), 'diagnostic MediaPipe dimension missing: ' + item.id);
  assert.equal(item.mediapipe, byId.get(item.id), 'diagnostic MediaPipe value drift: ' + item.id);
  assert.equal(item.gnm, gnmTemplate[item.id], 'diagnostic GNM value drift: ' + item.id);
  assert.ok(
    Math.abs(item.absoluteDifference - Math.abs(item.mediapipe - item.gnm)) < 1e-12,
    'diagnostic difference drift: ' + item.id
  );
}

console.log(JSON.stringify({
  ok: true,
  productionAuthority: false,
  provider: manifest.provider,
  providerVersion: manifest.providerVersion,
  coordinateSpace: manifest.coordinateSpace,
  dimensions: measurement.dimensions,
  upstreamRuntimeFixtureDimensions: upstreamMeasurement.dimensions,
  invariants: {
    exactSingleFace: true,
    poseNormalizedMetric3DRequired: true,
    rawScreenLandmarksRejected: true,
    uniformScaleInvariant: true,
    translationInvariant: true,
    sourceImagePersistenceForbidden: true,
    identityEmbeddingForbidden: true,
    minimalAnchorProjection: true
  }
}, null, 2));
