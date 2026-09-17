import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SOURCE_MANIFEST_SCHEMA_VERSION,
  RAW_CANDIDATE_SCHEMA_VERSION,
  REVERSE_ARCHETYPE_ARCHETYPES,
  REVERSE_ARCHETYPE_QUERY_TEMPLATES,
  buildFrozenReverseArchetypeQueryManifest,
  validateReverseArchetypeSourceManifest,
  validateReverseArchetypeQueryManifest,
  validateReverseArchetypeRawCandidate,
  createReverseArchetypeBlindObservationPacket,
  validateReverseArchetypeBlindPacket,
  classifyReverseArchetypePrimaryEligibility,
  sealReverseArchetypeBlindObservation,
  joinReverseArchetypeAfterObservationSeal,
  buildReverseArchetypeExactDuplicateMap
} from '../lib/face-lab-reverse-archetype-research.js';

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

const sourceManifest = readJson('evidence/facelab/reverse-archetype/pilot-v1/source-manifest.json');
const queryManifest = readJson('evidence/facelab/reverse-archetype/pilot-v1/query-manifest.json');

const sourceValidation = validateReverseArchetypeSourceManifest(sourceManifest);
assert.equal(sourceValidation.ok, true, sourceValidation.errors.join(','));

const queryValidation = validateReverseArchetypeQueryManifest(queryManifest);
assert.equal(queryValidation.ok, true, queryValidation.errors.join(','));

assert.equal(sourceManifest.schemaVersion, SOURCE_MANIFEST_SCHEMA_VERSION);
assert.equal(REVERSE_ARCHETYPE_ARCHETYPES.length, 7);
assert.equal(REVERSE_ARCHETYPE_QUERY_TEMPLATES.length, 8);
assert.equal(queryManifest.queries.length, 56);
assert.equal(sourceManifest.retrievalSurfaces.length, 3);
assert.equal(queryManifest.requestedDepth, 5);
assert.equal(queryManifest.plannedMaximumCandidates, 840);

const rebuiltQueries = buildFrozenReverseArchetypeQueryManifest({
  runFamily: queryManifest.runFamily,
  requestedDepth: queryManifest.requestedDepth
});
assert.deepEqual(rebuiltQueries.queries, queryManifest.queries, 'frozen query manifest drift');

const candidate = {
  schemaVersion: RAW_CANDIDATE_SCHEMA_VERSION,
  runId: 'ra_run_0123456789abcdef',
  candidateId: 'ra_cand_0123456789abcdef01234567',
  archetypeQueryLabel: 'wolf',
  queryId: 'wolf:general',
  queryString: '늑대상',
  queryFamily: 'general_label',
  retrievalSurfaceId: 'google_images_ko_web',
  originDomain: 'example.com',
  originSourceFamilyOptional: null,
  resultRank: 1,
  resultPageOrCursor: 'top',
  resultUrl: 'https://search.example/result/1',
  landingUrl: 'https://example.com/article',
  imageUrl: 'https://cdn.example.com/image.jpg',
  retrievedAt: '2026-09-18T00:00:00.000Z',
  acquisitionMode: 'manual_metadata_capture',
  rawImageBytesRetained: false
};

const candidateValidation = validateReverseArchetypeRawCandidate(candidate, {
  sourceManifest,
  queryManifest
});
assert.equal(candidateValidation.ok, true, candidateValidation.errors.join(','));

assert.equal(
  validateReverseArchetypeRawCandidate(
    { ...candidate, ground_truth_label: 'wolf' },
    { sourceManifest, queryManifest }
  ).ok,
  false,
  'ground truth label must be forbidden'
);
assert.equal(
  validateReverseArchetypeRawCandidate(
    { ...candidate, observation: {} },
    { sourceManifest, queryManifest }
  ).ok,
  false,
  'raw candidate must not contain downstream observation'
);

const approvedAsset = {
  governanceStatus: 'approved_for_research_observation',
  opaqueAssetRef: 'ra_asset_aaaaaaaaaaaaaaaaaaaaaaaa',
  blindObservationId: 'ra_blind_bbbbbbbbbbbbbbbbbbbbbbbb',
  contentDigest: 'sha256:' + 'c'.repeat(64),
  mimeType: 'image/jpeg',
  width: 1024,
  height: 1024
};

const blindPacket = createReverseArchetypeBlindObservationPacket(candidate, approvedAsset);
const blindValidation = validateReverseArchetypeBlindPacket(blindPacket);
assert.equal(blindValidation.ok, true, blindValidation.errors.join(','));

const blindSerialized = JSON.stringify(blindPacket);
for (const forbidden of [
  'wolf',
  '늑대상',
  'queryString',
  'queryFamily',
  'retrievalSurface',
  'originDomain',
  'example.com',
  'https://'
]) {
  assert.equal(blindSerialized.includes(forbidden), false, 'blind leak: ' + forbidden);
}

assert.throws(
  () => createReverseArchetypeBlindObservationPacket(candidate, {
    ...approvedAsset,
    governanceStatus: 'metadata_only'
  }),
  /asset_governance_not_approved/
);

function visionBundle({
  count = 1,
  eligible = true,
  imageType = 'photorealistic_human',
  failureReason = null,
  faceStatus = 'available'
} = {}) {
  return {
    schemaVersion: 'vision-observation-v1',
    eligibility: {
      status: eligible ? 'eligible' : 'ineligible',
      source: 'vision',
      imageType,
      humanFaceCount: count,
      faceLabEligible: eligible,
      skinAnalysisEligible: false,
      faceLabFailureReason: eligible ? null : failureReason,
      skinFailureReason: 'skin_not_visible',
      confidence: 0.9,
      evidence: ['fixture']
    },
    face: {
      status: faceStatus,
      analysis: {
        schemaVersion: 'face-lab-observation-v1',
        status: faceStatus,
        failureReason: faceStatus === 'available' ? null : 'observation_coverage_insufficient',
        quality: {
          status: 'available',
          source: 'vision',
          confidence: 0.9,
          evidence: ['fixture'],
          unavailableReason: null,
          value: { structureSuitability: 'suitable' }
        },
        observations: {
          outline: {
            faceShape: {
              status: 'available',
              source: 'vision',
              confidence: 0.9,
              evidence: ['fixture'],
              unavailableReason: null,
              value: 'oval'
            }
          }
        }
      }
    }
  };
}

assert.deepEqual(
  classifyReverseArchetypePrimaryEligibility(visionBundle()),
  { status: 'included_primary', reason: null }
);
assert.deepEqual(
  classifyReverseArchetypePrimaryEligibility(
    visionBundle({ count: 2, eligible: false, failureReason: 'multiple_faces' })
  ),
  { status: 'excluded', reason: 'excluded_multi_face' }
);
assert.deepEqual(
  classifyReverseArchetypePrimaryEligibility(
    visionBundle({
      count: 0,
      eligible: false,
      failureReason: 'face_not_detected',
      imageType: 'other'
    })
  ),
  { status: 'excluded', reason: 'no_face' }
);

const extractionIdentity = {
  observationContractVersion: 'face-lab-observation-contract-current-main',
  observationSchemaVersion: 'face-lab-observation-v1',
  visionProvider: 'openai',
  visionModel: 'fixture-model',
  visionPromptVersionOrDigest: 'vision-observation-prompt-v1',
  normalizerVersion: 'vision-observation-normalizer-current-main',
  eligibilityVersion: 'image-analysis-eligibility-current-main',
  codeSha: 'cc029c0f1c6d36304049570641193f94335ed7a3'
};

const sealed = sealReverseArchetypeBlindObservation(
  blindPacket,
  visionBundle(),
  extractionIdentity,
  '2026-09-18T00:10:00.000Z'
);
assert.equal(JSON.stringify(sealed).includes('wolf'), false);
assert.equal(JSON.stringify(sealed).includes('늑대상'), false);

const joined = joinReverseArchetypeAfterObservationSeal(candidate, sealed);
assert.equal(joined.webContext.archetypeQueryLabel, 'wolf');
assert.equal(joined.observation.sealDigest, sealed.sealDigest);
assert.equal(joined.observation.primarySubset.status, 'included_primary');

const candidateB = {
  ...candidate,
  candidateId: 'ra_cand_111111111111111111111111'
};
const blindPacketB = {
  ...blindPacket,
  candidateId: candidateB.candidateId,
  blindObservationId: 'ra_blind_222222222222222222222222'
};
const sealedB = sealReverseArchetypeBlindObservation(
  blindPacketB,
  visionBundle(),
  extractionIdentity,
  '2026-09-18T00:11:00.000Z'
);
const duplicateMap = buildReverseArchetypeExactDuplicateMap([
  joined,
  joinReverseArchetypeAfterObservationSeal(candidateB, sealedB)
]);
assert.equal(duplicateMap.length, 1);
assert.equal(duplicateMap[0].count, 2);

const researchSource = readFileSync('lib/face-lab-reverse-archetype-research.js', 'utf8');
for (const forbiddenModule of [
  'face-lab-archetype-scoring',
  'face-lab-archetype-registry',
  'face-lab-archetype-decision'
]) {
  assert.equal(
    researchSource.includes('from ' + JSON.stringify('./' + forbiddenModule + '.js')),
    false,
    'research module must not import current archetype authority: ' + forbiddenModule
  );
}

console.log(JSON.stringify({
  status: 'passed',
  runFamily: sourceManifest.runFamily,
  retrievalSurfaceCount: sourceManifest.retrievalSurfaces.length,
  archetypeCount: REVERSE_ARCHETYPE_ARCHETYPES.length,
  queryStrataPerArchetype: REVERSE_ARCHETYPE_QUERY_TEMPLATES.length,
  totalQueries: queryManifest.queries.length,
  requestedDepth: queryManifest.requestedDepth,
  plannedMaximumCandidates: queryManifest.plannedMaximumCandidates,
  acquisitionMode: sourceManifest.collectionPolicy.acquisition,
  automatedScraping: sourceManifest.collectionPolicy.automatedScraping,
  rawImageRetention: sourceManifest.collectionPolicy.rawImageByteRetention,
  blindContextLeak: false,
  scorerDependency: false,
  productionWiring: false
}, null, 2));
