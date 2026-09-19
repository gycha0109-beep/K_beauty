import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PHOTO_GEOMETRY_MANIFEST_SCHEMA_VERSION,
  PHOTO_GEOMETRY_PACKET_SCHEMA_VERSION,
  STRUCTURAL_MEASUREMENT_SCHEMA_VERSION,
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

console.log(JSON.stringify({
  ok: true,
  productionAuthority: false,
  provider: manifest.provider,
  providerVersion: manifest.providerVersion,
  coordinateSpace: manifest.coordinateSpace,
  dimensions: measurement.dimensions,
  invariants: {
    exactSingleFace: true,
    poseNormalizedMetric3DRequired: true,
    rawScreenLandmarksRejected: true,
    uniformScaleInvariant: true,
    translationInvariant: true,
    sourceImagePersistenceForbidden: true,
    identityEmbeddingForbidden: true
  }
}, null, 2));
