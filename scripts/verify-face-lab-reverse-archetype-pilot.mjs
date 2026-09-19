import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SOURCE_MANIFEST_SCHEMA_VERSION,
  RAW_CANDIDATE_SCHEMA_VERSION,
  COLLECTION_BATCH_SCHEMA_VERSION,
  COLLECTION_LEDGER_SCHEMA_VERSION,
  REVERSE_ARCHETYPE_ARCHETYPES,
  REVERSE_ARCHETYPE_QUERY_TEMPLATES,
  buildFrozenReverseArchetypeQueryManifest,
  validateReverseArchetypeSourceManifest,
  validateReverseArchetypeQueryManifest,
  validateReverseArchetypeRawCandidate,
  buildReverseArchetypeCollectionPlan,
  validateReverseArchetypeCollectionBatch,
  buildReverseArchetypeCollectionCoverage,
  validateReverseArchetypeCollectionLedger,
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
const collectionBatchFixture = readJson('evidence/facelab/reverse-archetype/pilot-v1/collection-batch.example.json');
const collectionLedger = readJson('evidence/facelab/reverse-archetype/pilot-v1/collection-ledger.json');

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

const collectionPlan = buildReverseArchetypeCollectionPlan({
  sourceManifest,
  queryManifest
});
assert.equal(collectionPlan.plannedBatchCount, 168);
assert.equal(collectionPlan.plannedCandidateCount, 840);
assert.equal(
  collectionPlan.tasks.filter((task) => task.retrievalSurfaceId === 'google_images_ko_web').length,
  56
);
assert.equal(
  collectionPlan.tasks.filter((task) => task.archetypeQueryLabel === 'wolf').length,
  24
);

assert.equal(collectionBatchFixture.schemaVersion, COLLECTION_BATCH_SCHEMA_VERSION);
const collectionBatchValidation = validateReverseArchetypeCollectionBatch(
  collectionBatchFixture,
  { sourceManifest, queryManifest }
);
assert.equal(
  collectionBatchValidation.ok,
  true,
  collectionBatchValidation.errors.join(',')
);

assert.equal(
  validateReverseArchetypeCollectionBatch(
    {
      ...collectionBatchFixture,
      records: collectionBatchFixture.records.slice(0, 4)
    },
    { sourceManifest, queryManifest }
  ).ok,
  false,
  'complete batch must contain the frozen requested depth'
);

assert.equal(
  validateReverseArchetypeCollectionBatch(
    {
      ...collectionBatchFixture,
      records: collectionBatchFixture.records.map((record, index) =>
        index === 4 ? { ...record, resultRank: 4 } : record
      )
    },
    { sourceManifest, queryManifest }
  ).ok,
  false,
  'rank duplication must fail closed'
);

const blockedBatch = {
  schemaVersion: COLLECTION_BATCH_SCHEMA_VERSION,
  runFamily: collectionBatchFixture.runFamily,
  batchId: 'ra_batch_aaaaaaaaaaaaaaaaaaaaaaaa',
  runId: collectionBatchFixture.runId,
  retrievalSurfaceId: 'google_images_ko_web',
  queryId: 'wolf:face',
  status: 'blocked',
  collectedAt: '2026-09-19T01:10:00.000Z',
  collectionContext: {
    ...collectionBatchFixture.collectionContext
  },
  blockedReason: 'manual_capture_unavailable',
  records: []
};

const blockedBatchValidation = validateReverseArchetypeCollectionBatch(
  blockedBatch,
  { sourceManifest, queryManifest }
);
assert.equal(
  blockedBatchValidation.ok,
  true,
  blockedBatchValidation.errors.join(',')
);

const collectionCoverage = buildReverseArchetypeCollectionCoverage(
  [collectionBatchFixture, blockedBatch],
  { sourceManifest, queryManifest }
);
assert.equal(collectionCoverage.valid, true, collectionCoverage.errors.join(','));
assert.equal(collectionCoverage.plannedBatches, 168);
assert.equal(collectionCoverage.completeBatches, 1);
assert.equal(collectionCoverage.blockedBatches, 1);
assert.equal(collectionCoverage.pendingBatches, 166);
assert.equal(collectionCoverage.plannedCandidates, 840);
assert.equal(collectionCoverage.capturedCandidates, 5);
assert.equal(collectionCoverage.missingTasks.length, 166);

const duplicateTaskCoverage = buildReverseArchetypeCollectionCoverage(
  [
    collectionBatchFixture,
    {
      ...collectionBatchFixture,
      batchId: 'ra_batch_bbbbbbbbbbbbbbbbbbbbbbbb'
    }
  ],
  { sourceManifest, queryManifest }
);
assert.equal(
  duplicateTaskCoverage.valid,
  false,
  'one surface/query collection task must not be silently captured twice'
);
assert.equal(
  duplicateTaskCoverage.errors.some((error) => error.includes('duplicate_collection_task')),
  true
);

const secondTaskSameCandidateIds = {
  ...collectionBatchFixture,
  batchId: 'ra_batch_cccccccccccccccccccccccc',
  queryId: 'wolf:face',
  records: collectionBatchFixture.records.map((record) => ({
    ...record,
    queryId: 'wolf:face',
    queryString: '늑대상 얼굴',
    queryFamily: 'face_label'
  }))
};
const crossBatchCandidateCollision = buildReverseArchetypeCollectionCoverage(
  [collectionBatchFixture, secondTaskSameCandidateIds],
  { sourceManifest, queryManifest }
);
assert.equal(crossBatchCandidateCollision.valid, false);
assert.equal(
  crossBatchCandidateCollision.errors.some((error) =>
    error.includes('duplicate_candidate_id_across_batches')
  ),
  true,
  'candidate IDs must be unique across the full collection run'
);

const duplicateBatchIdCoverage = buildReverseArchetypeCollectionCoverage(
  [
    collectionBatchFixture,
    {
      ...secondTaskSameCandidateIds,
      batchId: collectionBatchFixture.batchId,
      records: secondTaskSameCandidateIds.records.map((record, index) => ({
        ...record,
        candidateId: 'ra_cand_' + ['6', '7', '8', '9', 'a'][index].repeat(24)
      }))
    }
  ],
  { sourceManifest, queryManifest }
);
assert.equal(duplicateBatchIdCoverage.valid, false);
assert.equal(
  duplicateBatchIdCoverage.errors.some((error) => error.includes('duplicate_batch_id')),
  true,
  'batch IDs must be unique across the full collection run'
);

assert.equal(collectionLedger.schemaVersion, COLLECTION_LEDGER_SCHEMA_VERSION);
const collectionLedgerValidation = validateReverseArchetypeCollectionLedger(
  collectionLedger,
  { sourceManifest, queryManifest }
);
assert.equal(
  collectionLedgerValidation.ok,
  true,
  collectionLedgerValidation.errors.join(',')
);
assert.equal(collectionLedgerValidation.coverage.plannedBatches, 168);
assert.equal(collectionLedgerValidation.coverage.pendingBatches, 168);
assert.equal(collectionLedgerValidation.coverage.capturedCandidates, 0);

assert.equal(
  validateReverseArchetypeCollectionLedger(
    { ...collectionLedger, status: 'sealed' },
    { sourceManifest, queryManifest }
  ).ok,
  false,
  'ledger cannot seal while collection tasks are pending'
);

assert.equal(
  validateReverseArchetypeCollectionLedger(
    {
      ...collectionLedger,
      batches: [
        {
          ...collectionBatchFixture,
          runId: collectionBatchFixture.runId
        }
      ]
    },
    { sourceManifest, queryManifest }
  ).ok,
  false,
  'ledger must reject batches from a different run'
);

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

assert.equal(
  validateReverseArchetypeRawCandidate(
    { ...candidate, resultUrl: 'not-a-url' },
    { sourceManifest, queryManifest }
  ).ok,
  false,
  'provenance URLs must be valid HTTP(S) URLs'
);

assert.equal(
  validateReverseArchetypeRawCandidate(
    { ...candidate, originDomain: 'wrong.example' },
    { sourceManifest, queryManifest }
  ).ok,
  false,
  'originDomain must match the landing URL hostname'
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
  plannedCollectionBatches: collectionPlan.plannedBatchCount,
  collectionBatchContract: true,
  collectionCoverageContract: true,
  collectionLedgerContract: true,
  acquisitionMode: sourceManifest.collectionPolicy.acquisition,
  automatedScraping: sourceManifest.collectionPolicy.automatedScraping,
  rawImageRetention: sourceManifest.collectionPolicy.rawImageByteRetention,
  blindContextLeak: false,
  scorerDependency: false,
  productionWiring: false
}, null, 2));
