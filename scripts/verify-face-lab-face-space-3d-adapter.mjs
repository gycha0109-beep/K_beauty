import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FACE_SPACE_3D_ADAPTER_SCHEMA_VERSION,
  FACE_SPACE_VECTOR_SCHEMA_VERSION,
  buildFaceSpace3DRenderRequest,
  evaluateFaceSpace3DRoundTrip,
  validateFaceSpace3DAdapterManifest,
  validateFaceSpaceVector
} from '../lib/face-lab-face-space-3d-research.js';

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

const base = 'evidence/facelab/face-space-3d/v0';
const vector = readJson(base + '/face-vector.fixture.json');
const gnm = readJson(base + '/google-gnm-v3-adapter.manifest.json');
const mpfb = readJson(base + '/mpfb2-adapter.manifest.json');
const flame = readJson(base + '/flame-2023-open-adapter.manifest.json');

assert.equal(vector.schemaVersion, FACE_SPACE_VECTOR_SCHEMA_VERSION);
assert.equal(gnm.schemaVersion, FACE_SPACE_3D_ADAPTER_SCHEMA_VERSION);
assert.equal(mpfb.schemaVersion, FACE_SPACE_3D_ADAPTER_SCHEMA_VERSION);
assert.equal(flame.schemaVersion, FACE_SPACE_3D_ADAPTER_SCHEMA_VERSION);

for (const manifest of [gnm, mpfb, flame]) {
  const validation = validateFaceSpace3DAdapterManifest(manifest);
  assert.equal(validation.ok, true, validation.errors.join(','));
  assert.equal(manifest.faceSpaceIsAuthority, true);
  assert.equal(manifest.nativeParametersAreAuthority, false);
  assert.equal(manifest.executionBoundary, 'offline_research');
  assert.equal(manifest.implementationStatus, 'mapping_candidate');
}

const vectorValidation = validateFaceSpaceVector(vector);
assert.equal(vectorValidation.ok, true, vectorValidation.errors.join(','));

assert.equal(
  validateFaceSpaceVector({ ...vector, archetypeLabel: 'wolf' }).ok,
  false,
  'Face Space vector must not encode an Archetype label'
);

assert.equal(
  validateFaceSpaceVector({ ...vector, identityEmbedding: [0.1, 0.2] }).ok,
  false,
  'Face Space v0 must not introduce identity embeddings'
);

assert.equal(
  validateFaceSpace3DAdapterManifest({
    ...mpfb,
    nativeParametersAreAuthority: true
  }).ok,
  false,
  'backend-native parameters must never become Face Space authority'
);

const invalidFlame = {
  ...flame,
  dimensionMappings: flame.dimensionMappings.map((mapping, index) =>
    index === 0
      ? { ...mapping, strategy: 'direct_target', nativeTarget: 'beta[0]' }
      : mapping
  )
};
assert.equal(
  validateFaceSpace3DAdapterManifest(invalidFlame).ok,
  false,
  'FLAME beta must not be mapped directly to an interpretable Face Space axis'
);

const invalidGnm = {
  ...gnm,
  dimensionMappings: gnm.dimensionMappings.map((mapping, index) =>
    index === 0
      ? { ...mapping, strategy: 'direct_target', nativeTarget: 'identity[0]' }
      : mapping
  )
};
assert.equal(
  validateFaceSpace3DAdapterManifest(invalidGnm).ok,
  false,
  'GNM identity components must not be mapped directly to interpretable Face Space axes'
);

assert.equal(
  validateFaceSpace3DAdapterManifest({
    ...gnm,
    semanticDemographicSamplingAllowed: true
  }).ok,
  false,
  'GNM demographic semantic identity sampling must stay disabled'
);

assert.match(
  gnm.backendVersion,
  /^google\/GNM@[a-f0-9]{40}$/,
  'GNM code candidate must pin an exact upstream commit'
);
assert.equal(gnm.modelArtifact, 'google/gnm-v3/gnm_head.npz');
assert.equal(
  gnm.modelArtifactRevision,
  'pending_exact_huggingface_revision_and_digest',
  'GNM model artifact must remain explicitly pending until exact HF revision/digest is frozen'
);

const gnmRequest = buildFaceSpace3DRenderRequest(vector, gnm);
const mpfbRequest = buildFaceSpace3DRenderRequest(vector, mpfb);
const flameRequest = buildFaceSpace3DRenderRequest(vector, flame);

assert.equal(gnmRequest.backend, 'gnm_v3');
assert.equal(mpfbRequest.backend, 'mpfb2');
assert.equal(flameRequest.backend, 'flame_2023_open');
assert.notEqual(gnmRequest.requestDigest, mpfbRequest.requestDigest);
assert.notEqual(gnmRequest.requestDigest, flameRequest.requestDigest);
assert.notEqual(mpfbRequest.requestDigest, flameRequest.requestDigest);
assert.equal(gnmRequest.mappedDimensions.length, vector.dimensions.length);
assert.equal(mpfbRequest.mappedDimensions.length, vector.dimensions.length);
assert.equal(flameRequest.mappedDimensions.length, vector.dimensions.length);

function makeSyntheticContractMeasurement(manifest, offset = 0) {
  return {
    schemaVersion: 'face-space-3d-roundtrip-v0',
    vectorId: vector.vectorId,
    adapterId: manifest.adapterId,
    meshDigest: 'fixture-only-not-a-real-mesh-digest',
    measurementVersion: 'contract-fixture-measurement-v0',
    dimensions: vector.dimensions.map((dimension) => ({
      id: dimension.id,
      unit: dimension.unit,
      value: dimension.value + offset
    }))
  };
}

const gnmContractRoundTrip = evaluateFaceSpace3DRoundTrip({
  vector,
  manifest: gnm,
  measurement: makeSyntheticContractMeasurement(gnm)
});
assert.equal(gnmContractRoundTrip.ok, true);
assert.equal(gnmContractRoundTrip.status, 'pass');

const mpfbContractRoundTrip = evaluateFaceSpace3DRoundTrip({
  vector,
  manifest: mpfb,
  measurement: makeSyntheticContractMeasurement(mpfb)
});
assert.equal(mpfbContractRoundTrip.ok, true);
assert.equal(mpfbContractRoundTrip.status, 'pass');

const flameContractRoundTrip = evaluateFaceSpace3DRoundTrip({
  vector,
  manifest: flame,
  measurement: makeSyntheticContractMeasurement(flame)
});
assert.equal(flameContractRoundTrip.ok, true);
assert.equal(flameContractRoundTrip.status, 'pass');

const badRoundTrip = evaluateFaceSpace3DRoundTrip({
  vector,
  manifest: mpfb,
  measurement: makeSyntheticContractMeasurement(mpfb, 0.2)
});
assert.equal(badRoundTrip.ok, false);
assert.equal(badRoundTrip.status, 'hold');
assert.ok(badRoundTrip.failedDimensionCount > 0);

const missingDimensionMeasurement = makeSyntheticContractMeasurement(mpfb);
missingDimensionMeasurement.dimensions = missingDimensionMeasurement.dimensions.slice(1);
const missingDimensionRoundTrip = evaluateFaceSpace3DRoundTrip({
  vector,
  manifest: mpfb,
  measurement: missingDimensionMeasurement
});
assert.equal(missingDimensionRoundTrip.ok, false);
assert.equal(missingDimensionRoundTrip.status, 'hold');

console.log(JSON.stringify({
  ok: true,
  contractOnly: true,
  productionAuthority: false,
  vectorDimensions: vector.dimensions.length,
  adapters: [
    {
      adapterId: gnm.adapterId,
      backend: gnm.backend,
      implementationStatus: gnm.implementationStatus
    },
    {
      adapterId: mpfb.adapterId,
      backend: mpfb.backend,
      implementationStatus: mpfb.implementationStatus
    },
    {
      adapterId: flame.adapterId,
      backend: flame.backend,
      implementationStatus: flame.implementationStatus
    }
  ],
  invariants: {
    faceSpaceAuthority: true,
    archetypeLabelForbiddenInVector: true,
    identityEmbeddingForbidden: true,
    nativeParametersNotAuthority: true,
    directGnmAxisMappingForbidden: true,
    gnmDemographicSemanticSamplingDisabled: true,
    directFlameAxisMappingForbidden: true,
    roundTripFailClosed: true
  }
}, null, 2));
