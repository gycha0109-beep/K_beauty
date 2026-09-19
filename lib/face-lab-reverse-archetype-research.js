import { createHash } from 'node:crypto';

export const REVERSE_ARCHETYPE_RESEARCH_SCHEMA_VERSION = 'face-lab-reverse-archetype-research-v1';
export const SOURCE_MANIFEST_SCHEMA_VERSION = 'face-lab-reverse-archetype-source-manifest-v1';
export const QUERY_MANIFEST_SCHEMA_VERSION = 'face-lab-reverse-archetype-query-manifest-v1';
export const RAW_CANDIDATE_SCHEMA_VERSION = 'face-lab-reverse-archetype-raw-candidate-v1';
export const COLLECTION_BATCH_SCHEMA_VERSION = 'face-lab-reverse-archetype-collection-batch-v1';
export const BLIND_PACKET_SCHEMA_VERSION = 'face-lab-reverse-archetype-blind-packet-v1';
export const SEALED_OBSERVATION_SCHEMA_VERSION = 'face-lab-reverse-archetype-sealed-observation-v1';
export const JOINED_RECORD_SCHEMA_VERSION = 'face-lab-reverse-archetype-joined-record-v1';

export const REVERSE_ARCHETYPE_ARCHETYPES = Object.freeze([
  Object.freeze({ key: 'wolf', labelKo: '늑대상' }),
  Object.freeze({ key: 'cat', labelKo: '고양이상' }),
  Object.freeze({ key: 'puppy', labelKo: '강아지상' }),
  Object.freeze({ key: 'deer', labelKo: '사슴상' }),
  Object.freeze({ key: 'tofu', labelKo: '두부상' }),
  Object.freeze({ key: 'potato', labelKo: '감자상' }),
  Object.freeze({ key: 'dino', labelKo: '공룡상' })
]);

export const REVERSE_ARCHETYPE_QUERY_TEMPLATES = Object.freeze([
  Object.freeze({ id: 'general', family: 'general_label', suffix: '' }),
  Object.freeze({ id: 'face', family: 'face_label', suffix: ' 얼굴' }),
  Object.freeze({ id: 'celebrity', family: 'celebrity_label', suffix: ' 연예인' }),
  Object.freeze({ id: 'male', family: 'gendered_label', suffix: ' 남자' }),
  Object.freeze({ id: 'female', family: 'gendered_label', suffix: ' 여자' }),
  Object.freeze({ id: 'male_celebrity', family: 'gendered_celebrity_label', suffix: ' 남자 연예인' }),
  Object.freeze({ id: 'female_celebrity', family: 'gendered_celebrity_label', suffix: ' 여자 연예인' }),
  Object.freeze({ id: 'descriptor', family: 'descriptor_query', suffix: ' 특징' })
]);

const ARCHETYPE_KEYS = new Set(REVERSE_ARCHETYPE_ARCHETYPES.map((item) => item.key));
const QUERY_FAMILIES = new Set(REVERSE_ARCHETYPE_QUERY_TEMPLATES.map((item) => item.family));
const ALLOWED_SURFACE_TYPES = new Set(['image_search']);
const ALLOWED_ACQUISITION_MODES = new Set(['manual_metadata_capture']);
const CANDIDATE_ID_PATTERN = /^ra_cand_[a-f0-9]{24}$/;
const BATCH_ID_PATTERN = /^ra_batch_[a-f0-9]{24}$/;
const RUN_ID_PATTERN = /^ra_run_[a-f0-9]{16}$/;
const ASSET_REF_PATTERN = /^ra_asset_[a-f0-9]{24}$/;
const BLIND_ID_PATTERN = /^ra_blind_[a-f0-9]{24}$/;
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function requireCondition(condition, code) {
  if (!condition) {
    const error = new Error(code);
    error.code = code;
    throw error;
  }
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

export function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

export function sha256Digest(value) {
  const input = typeof value === 'string' ? value : stableStringify(value);
  return 'sha256:' + createHash('sha256').update(input).digest('hex');
}

export function buildFrozenReverseArchetypeQueryManifest({
  runFamily = 'ra-web-pilot-v1',
  requestedDepth = 5
} = {}) {
  requireCondition(
    Number.isSafeInteger(requestedDepth) && requestedDepth > 0 && requestedDepth <= 20,
    'requested_depth_invalid'
  );

  const queries = [];
  for (const archetype of REVERSE_ARCHETYPE_ARCHETYPES) {
    for (const template of REVERSE_ARCHETYPE_QUERY_TEMPLATES) {
      queries.push({
        queryId: archetype.key + ':' + template.id,
        archetypeQueryLabel: archetype.key,
        labelKo: archetype.labelKo,
        queryFamily: template.family,
        queryString: archetype.labelKo + template.suffix,
        requestedDepth
      });
    }
  }

  return {
    schemaVersion: QUERY_MANIFEST_SCHEMA_VERSION,
    runFamily,
    status: 'frozen',
    labelsAreHypotheses: true,
    requestedDepth,
    queries
  };
}

export function validateReverseArchetypeSourceManifest(manifest) {
  const errors = [];
  if (!isObject(manifest) || manifest.schemaVersion !== SOURCE_MANIFEST_SCHEMA_VERSION) {
    errors.push('schema_version_invalid');
  }
  if (!nonEmpty(manifest?.runFamily)) errors.push('run_family_invalid');
  if (manifest?.status !== 'frozen_metadata_only') errors.push('status_invalid');
  if (!Array.isArray(manifest?.retrievalSurfaces) || manifest.retrievalSurfaces.length < 2) {
    errors.push('retrieval_surfaces_insufficient');
  }

  const ids = new Set();
  for (const surface of manifest?.retrievalSurfaces || []) {
    if (!isObject(surface) || !nonEmpty(surface.id) || ids.has(surface.id)) {
      errors.push('retrieval_surface_id_invalid');
    } else {
      ids.add(surface.id);
    }
    if (!ALLOWED_SURFACE_TYPES.has(surface?.type)) {
      errors.push((surface?.id || 'unknown') + ':type_invalid');
    }
    if (!ALLOWED_ACQUISITION_MODES.has(surface?.acquisitionMode)) {
      errors.push((surface?.id || 'unknown') + ':acquisition_mode_invalid');
    }
    if (surface?.rawImageByteRetention !== 'forbidden_until_governance_approved') {
      errors.push((surface?.id || 'unknown') + ':raw_image_retention_invalid');
    }
    if (surface?.automatedScrapingAllowed !== false) {
      errors.push((surface?.id || 'unknown') + ':automated_scraping_must_be_false');
    }
    if (!nonEmpty(surface?.countryOrLocale) || !nonEmpty(surface?.language)) {
      errors.push((surface?.id || 'unknown') + ':locale_invalid');
    }
  }

  return { ok: errors.length === 0, errors };
}

export function validateReverseArchetypeQueryManifest(manifest) {
  const errors = [];
  if (!isObject(manifest) || manifest.schemaVersion !== QUERY_MANIFEST_SCHEMA_VERSION) {
    errors.push('schema_version_invalid');
  }
  if (manifest?.status !== 'frozen') errors.push('status_invalid');
  if (manifest?.labelsAreHypotheses !== true) errors.push('labels_must_be_hypotheses');
  if (
    !Array.isArray(manifest?.queries) ||
    manifest.queries.length !== REVERSE_ARCHETYPE_ARCHETYPES.length * REVERSE_ARCHETYPE_QUERY_TEMPLATES.length
  ) {
    errors.push('query_count_invalid');
  }

  const ids = new Set();
  for (const query of manifest?.queries || []) {
    if (!nonEmpty(query?.queryId) || ids.has(query.queryId)) {
      errors.push('query_id_invalid');
    } else {
      ids.add(query.queryId);
    }
    if (!ARCHETYPE_KEYS.has(query?.archetypeQueryLabel)) {
      errors.push((query?.queryId || 'unknown') + ':archetype_label_invalid');
    }
    if (!QUERY_FAMILIES.has(query?.queryFamily)) {
      errors.push((query?.queryId || 'unknown') + ':query_family_invalid');
    }
    if (!nonEmpty(query?.queryString)) {
      errors.push((query?.queryId || 'unknown') + ':query_string_invalid');
    }
    if (
      !Number.isSafeInteger(query?.requestedDepth) ||
      query.requestedDepth <= 0 ||
      query.requestedDepth > 20
    ) {
      errors.push((query?.queryId || 'unknown') + ':requested_depth_invalid');
    }
    if (
      Object.prototype.hasOwnProperty.call(query || {}, 'groundTruthLabel') ||
      Object.prototype.hasOwnProperty.call(query || {}, 'ground_truth_label')
    ) {
      errors.push((query?.queryId || 'unknown') + ':ground_truth_forbidden');
    }
  }

  return { ok: errors.length === 0, errors };
}

export function validateReverseArchetypeRawCandidate(candidate, {
  sourceManifest,
  queryManifest
} = {}) {
  const errors = [];
  const queryMap = new Map((queryManifest?.queries || []).map((item) => [item.queryId, item]));
  const surfaceIds = new Set((sourceManifest?.retrievalSurfaces || []).map((item) => item.id));

  if (!isObject(candidate) || candidate.schemaVersion !== RAW_CANDIDATE_SCHEMA_VERSION) {
    errors.push('schema_version_invalid');
  }
  if (!RUN_ID_PATTERN.test(candidate?.runId || '')) errors.push('run_id_invalid');
  if (!CANDIDATE_ID_PATTERN.test(candidate?.candidateId || '')) {
    errors.push('candidate_id_not_opaque');
  }
  if (!ARCHETYPE_KEYS.has(candidate?.archetypeQueryLabel)) {
    errors.push('archetype_query_label_invalid');
  }
  if (!queryMap.has(candidate?.queryId)) errors.push('query_id_unknown');

  const frozenQuery = queryMap.get(candidate?.queryId);
  if (frozenQuery) {
    if (candidate.archetypeQueryLabel !== frozenQuery.archetypeQueryLabel) {
      errors.push('query_label_mismatch');
    }
    if (candidate.queryString !== frozenQuery.queryString) errors.push('query_string_drift');
    if (candidate.queryFamily !== frozenQuery.queryFamily) errors.push('query_family_drift');
  }

  if (!surfaceIds.has(candidate?.retrievalSurfaceId)) errors.push('retrieval_surface_unknown');
  if (
    !Number.isSafeInteger(candidate?.resultRank) ||
    candidate.resultRank < 1 ||
    (frozenQuery && candidate.resultRank > frozenQuery.requestedDepth)
  ) {
    errors.push('result_rank_invalid');
  }
  if (
    !nonEmpty(candidate?.resultUrl) ||
    !nonEmpty(candidate?.landingUrl) ||
    !nonEmpty(candidate?.imageUrl)
  ) {
    errors.push('provenance_url_missing');
  }
  if (!nonEmpty(candidate?.originDomain)) errors.push('origin_domain_missing');
  if (!nonEmpty(candidate?.retrievedAt) || Number.isNaN(Date.parse(candidate.retrievedAt))) {
    errors.push('retrieved_at_invalid');
  }
  if (candidate?.acquisitionMode !== 'manual_metadata_capture') {
    errors.push('acquisition_mode_invalid');
  }
  if (candidate?.rawImageBytesRetained !== false) {
    errors.push('raw_image_bytes_must_not_be_retained');
  }
  if (
    Object.prototype.hasOwnProperty.call(candidate || {}, 'groundTruthLabel') ||
    Object.prototype.hasOwnProperty.call(candidate || {}, 'ground_truth_label')
  ) {
    errors.push('ground_truth_forbidden');
  }
  if (
    Object.prototype.hasOwnProperty.call(candidate || {}, 'observation') ||
    Object.prototype.hasOwnProperty.call(candidate || {}, 'archetypeScore')
  ) {
    errors.push('downstream_evidence_forbidden_in_raw_candidate');
  }

  return { ok: errors.length === 0, errors };
}

export function buildReverseArchetypeCollectionPlan({
  sourceManifest,
  queryManifest
} = {}) {
  const sourceValidation = validateReverseArchetypeSourceManifest(sourceManifest);
  requireCondition(
    sourceValidation.ok,
    'source_manifest_invalid:' + sourceValidation.errors.join(',')
  );

  const queryValidation = validateReverseArchetypeQueryManifest(queryManifest);
  requireCondition(
    queryValidation.ok,
    'query_manifest_invalid:' + queryValidation.errors.join(',')
  );

  requireCondition(
    sourceManifest.runFamily === queryManifest.runFamily,
    'run_family_mismatch'
  );

  const tasks = [];
  for (const surface of sourceManifest.retrievalSurfaces) {
    for (const query of queryManifest.queries) {
      tasks.push({
        taskId: surface.id + '|' + query.queryId,
        retrievalSurfaceId: surface.id,
        queryId: query.queryId,
        archetypeQueryLabel: query.archetypeQueryLabel,
        queryFamily: query.queryFamily,
        queryString: query.queryString,
        requestedDepth: query.requestedDepth,
        acquisitionMode: surface.acquisitionMode
      });
    }
  }

  return {
    schemaVersion: 'face-lab-reverse-archetype-collection-plan-v1',
    runFamily: queryManifest.runFamily,
    retrievalSurfaceCount: sourceManifest.retrievalSurfaces.length,
    queryCount: queryManifest.queries.length,
    plannedBatchCount: tasks.length,
    plannedCandidateCount: tasks.reduce((sum, task) => sum + task.requestedDepth, 0),
    tasks
  };
}

export function validateReverseArchetypeCollectionBatch(batch, {
  sourceManifest,
  queryManifest
} = {}) {
  const errors = [];
  const queryMap = new Map((queryManifest?.queries || []).map((item) => [item.queryId, item]));
  const surfaceMap = new Map(
    (sourceManifest?.retrievalSurfaces || []).map((item) => [item.id, item])
  );

  if (!isObject(batch) || batch.schemaVersion !== COLLECTION_BATCH_SCHEMA_VERSION) {
    errors.push('schema_version_invalid');
  }
  if (batch?.runFamily !== queryManifest?.runFamily || batch?.runFamily !== sourceManifest?.runFamily) {
    errors.push('run_family_mismatch');
  }
  if (!BATCH_ID_PATTERN.test(batch?.batchId || '')) errors.push('batch_id_not_opaque');
  if (!RUN_ID_PATTERN.test(batch?.runId || '')) errors.push('run_id_invalid');
  if (!surfaceMap.has(batch?.retrievalSurfaceId)) errors.push('retrieval_surface_unknown');
  if (!queryMap.has(batch?.queryId)) errors.push('query_id_unknown');
  if (!['complete', 'blocked'].includes(batch?.status)) errors.push('status_invalid');

  const collectedAt = batch?.collectedAt;
  if (!nonEmpty(collectedAt) || Number.isNaN(Date.parse(collectedAt))) {
    errors.push('collected_at_invalid');
  }

  const context = batch?.collectionContext;
  if (!isObject(context)) {
    errors.push('collection_context_missing');
  } else {
    if (context.acquisitionMode !== 'manual_metadata_capture') {
      errors.push('collection_context_acquisition_invalid');
    }
    if (!['signed_out', 'signed_in'].includes(context.signedInState)) {
      errors.push('collection_context_signed_in_state_invalid');
    }
    if (!['fresh_profile', 'existing_profile', 'unknown'].includes(context.profileState)) {
      errors.push('collection_context_profile_state_invalid');
    }
    if (!['on', 'off', 'unknown'].includes(context.safeSearchState)) {
      errors.push('collection_context_safe_search_state_invalid');
    }
    if (!['desktop_web', 'mobile_web'].includes(context.deviceClass)) {
      errors.push('collection_context_device_class_invalid');
    }

    const surface = surfaceMap.get(batch?.retrievalSurfaceId);
    if (surface) {
      if (context.countryOrLocale !== surface.countryOrLocale) {
        errors.push('collection_context_locale_mismatch');
      }
      if (context.language !== surface.language) {
        errors.push('collection_context_language_mismatch');
      }
    }
  }

  const records = Array.isArray(batch?.records) ? batch.records : null;
  if (!records) {
    errors.push('records_invalid');
  }

  const query = queryMap.get(batch?.queryId);
  if (records && query) {
    if (batch.status === 'complete' && records.length !== query.requestedDepth) {
      errors.push('complete_batch_depth_mismatch');
    }
    if (records.length > query.requestedDepth) {
      errors.push('batch_depth_exceeded');
    }

    const candidateIds = new Set();
    const ranks = new Set();
    for (const record of records) {
      const validation = validateReverseArchetypeRawCandidate(record, {
        sourceManifest,
        queryManifest
      });
      for (const error of validation.errors) {
        errors.push('record:' + (record?.candidateId || 'unknown') + ':' + error);
      }
      if (record?.runId !== batch.runId) errors.push('record_run_id_mismatch');
      if (record?.retrievalSurfaceId !== batch.retrievalSurfaceId) {
        errors.push('record_surface_mismatch');
      }
      if (record?.queryId !== batch.queryId) errors.push('record_query_mismatch');

      if (candidateIds.has(record?.candidateId)) errors.push('candidate_id_duplicate_in_batch');
      candidateIds.add(record?.candidateId);

      if (ranks.has(record?.resultRank)) errors.push('result_rank_duplicate_in_batch');
      ranks.add(record?.resultRank);
    }

    if (batch.status === 'complete') {
      for (let rank = 1; rank <= query.requestedDepth; rank += 1) {
        if (!ranks.has(rank)) errors.push('complete_batch_rank_missing:' + rank);
      }
    }
  }

  if (batch?.status === 'blocked') {
    if (!nonEmpty(batch?.blockedReason)) errors.push('blocked_reason_missing');
  } else if (batch?.blockedReason !== null && batch?.blockedReason !== undefined) {
    errors.push('blocked_reason_forbidden_for_complete');
  }

  return { ok: errors.length === 0, errors };
}

export function buildReverseArchetypeCollectionCoverage(batches, {
  sourceManifest,
  queryManifest
} = {}) {
  const plan = buildReverseArchetypeCollectionPlan({ sourceManifest, queryManifest });
  const batchList = Array.isArray(batches) ? batches : [];
  const errors = [];
  const byTask = new Map();

  for (const batch of batchList) {
    const validation = validateReverseArchetypeCollectionBatch(batch, {
      sourceManifest,
      queryManifest
    });
    for (const error of validation.errors) {
      errors.push((batch?.batchId || 'unknown') + ':' + error);
    }

    const taskId = batch?.retrievalSurfaceId + '|' + batch?.queryId;
    if (byTask.has(taskId)) {
      errors.push('duplicate_collection_task:' + taskId);
      continue;
    }
    byTask.set(taskId, batch);
  }

  const bySurface = sourceManifest.retrievalSurfaces.map((surface) => {
    const tasks = plan.tasks.filter((task) => task.retrievalSurfaceId === surface.id);
    const observed = tasks.map((task) => byTask.get(task.taskId)).filter(Boolean);
    return {
      retrievalSurfaceId: surface.id,
      plannedBatches: tasks.length,
      completeBatches: observed.filter((batch) => batch.status === 'complete').length,
      blockedBatches: observed.filter((batch) => batch.status === 'blocked').length,
      pendingBatches: tasks.length - observed.length,
      capturedCandidates: observed.reduce(
        (sum, batch) => sum + (Array.isArray(batch.records) ? batch.records.length : 0),
        0
      )
    };
  });

  const byArchetype = REVERSE_ARCHETYPE_ARCHETYPES.map((archetype) => {
    const tasks = plan.tasks.filter((task) => task.archetypeQueryLabel === archetype.key);
    const observed = tasks.map((task) => byTask.get(task.taskId)).filter(Boolean);
    return {
      archetypeQueryLabel: archetype.key,
      plannedBatches: tasks.length,
      completeBatches: observed.filter((batch) => batch.status === 'complete').length,
      blockedBatches: observed.filter((batch) => batch.status === 'blocked').length,
      pendingBatches: tasks.length - observed.length,
      capturedCandidates: observed.reduce(
        (sum, batch) => sum + (Array.isArray(batch.records) ? batch.records.length : 0),
        0
      )
    };
  });

  const observedBatches = [...byTask.values()];
  const completeBatches = observedBatches.filter((batch) => batch.status === 'complete').length;
  const blockedBatches = observedBatches.filter((batch) => batch.status === 'blocked').length;
  const capturedCandidates = observedBatches.reduce(
    (sum, batch) => sum + (Array.isArray(batch.records) ? batch.records.length : 0),
    0
  );

  const missingTasks = plan.tasks
    .filter((task) => !byTask.has(task.taskId))
    .map((task) => task.taskId);

  return {
    schemaVersion: 'face-lab-reverse-archetype-collection-coverage-v1',
    runFamily: plan.runFamily,
    valid: errors.length === 0,
    errors,
    plannedBatches: plan.plannedBatchCount,
    completeBatches,
    blockedBatches,
    pendingBatches: plan.plannedBatchCount - observedBatches.length,
    plannedCandidates: plan.plannedCandidateCount,
    capturedCandidates,
    completeCandidateCoverage:
      plan.plannedCandidateCount === 0
        ? 0
        : capturedCandidates / plan.plannedCandidateCount,
    bySurface,
    byArchetype,
    missingTasks
  };
}

export function createReverseArchetypeBlindObservationPacket(candidate, asset) {
  requireCondition(isObject(candidate), 'candidate_invalid');
  requireCondition(isObject(asset), 'asset_invalid');
  requireCondition(CANDIDATE_ID_PATTERN.test(candidate.candidateId || ''), 'candidate_id_not_opaque');
  requireCondition(RUN_ID_PATTERN.test(candidate.runId || ''), 'run_id_invalid');
  requireCondition(
    asset.governanceStatus === 'approved_for_research_observation',
    'asset_governance_not_approved'
  );
  requireCondition(ASSET_REF_PATTERN.test(asset.opaqueAssetRef || ''), 'asset_ref_not_opaque');
  requireCondition(SHA256_PATTERN.test(asset.contentDigest || ''), 'asset_digest_invalid');
  requireCondition(
    ['image/jpeg', 'image/png', 'image/webp'].includes(asset.mimeType),
    'asset_mime_invalid'
  );
  requireCondition(Number.isSafeInteger(asset.width) && asset.width > 0, 'asset_width_invalid');
  requireCondition(Number.isSafeInteger(asset.height) && asset.height > 0, 'asset_height_invalid');
  requireCondition(
    BLIND_ID_PATTERN.test(asset.blindObservationId || ''),
    'blind_observation_id_invalid'
  );

  return {
    schemaVersion: BLIND_PACKET_SCHEMA_VERSION,
    researchSchemaVersion: REVERSE_ARCHETYPE_RESEARCH_SCHEMA_VERSION,
    runId: candidate.runId,
    candidateId: candidate.candidateId,
    blindObservationId: asset.blindObservationId,
    asset: {
      opaqueAssetRef: asset.opaqueAssetRef,
      contentDigest: asset.contentDigest,
      mimeType: asset.mimeType,
      width: asset.width,
      height: asset.height
    },
    targetContextExcluded: true
  };
}

export function validateReverseArchetypeBlindPacket(packet) {
  const errors = [];
  if (!isObject(packet) || packet.schemaVersion !== BLIND_PACKET_SCHEMA_VERSION) {
    errors.push('schema_version_invalid');
  }
  if (!RUN_ID_PATTERN.test(packet?.runId || '')) errors.push('run_id_invalid');
  if (!CANDIDATE_ID_PATTERN.test(packet?.candidateId || '')) errors.push('candidate_id_invalid');
  if (!BLIND_ID_PATTERN.test(packet?.blindObservationId || '')) {
    errors.push('blind_observation_id_invalid');
  }
  if (!ASSET_REF_PATTERN.test(packet?.asset?.opaqueAssetRef || '')) {
    errors.push('asset_ref_invalid');
  }
  if (!SHA256_PATTERN.test(packet?.asset?.contentDigest || '')) {
    errors.push('asset_digest_invalid');
  }
  if (packet?.targetContextExcluded !== true) errors.push('target_context_boundary_missing');

  const serialized = stableStringify(packet);
  const forbidden = [
    'archetypeQueryLabel',
    'queryString',
    'queryFamily',
    'retrievalSurface',
    'originDomain',
    'resultUrl',
    'landingUrl',
    'imageUrl',
    'groundTruth',
    'ground_truth',
    'wolf',
    'cat',
    'puppy',
    'deer',
    'tofu',
    'potato',
    'dino',
    '늑대상',
    '고양이상',
    '강아지상',
    '사슴상',
    '두부상',
    '감자상',
    '공룡상'
  ];
  for (const token of forbidden) {
    if (serialized.includes(token)) errors.push('target_context_leak:' + token);
  }

  return { ok: errors.length === 0, errors };
}

function validateNormalizedVisionBundle(bundle) {
  const errors = [];
  if (!isObject(bundle) || bundle.schemaVersion !== 'vision-observation-v1') {
    errors.push('vision_schema_invalid');
  }

  const eligibility = bundle?.eligibility;
  if (!isObject(eligibility) || eligibility.source !== 'vision') {
    errors.push('eligibility_invalid');
  }
  if (
    !Number.isInteger(eligibility?.humanFaceCount) &&
    eligibility?.humanFaceCount !== null
  ) {
    errors.push('face_count_invalid');
  }
  if (typeof eligibility?.faceLabEligible !== 'boolean') {
    errors.push('face_lab_eligible_invalid');
  }

  const analysis = bundle?.face?.analysis;
  if (!isObject(analysis) || analysis.schemaVersion !== 'face-lab-observation-v1') {
    errors.push('face_analysis_invalid');
  }
  if (
    !new Set(['available', 'partial', 'insufficient_evidence', 'unavailable'])
      .has(analysis?.status)
  ) {
    errors.push('face_analysis_status_invalid');
  }

  return { ok: errors.length === 0, errors };
}

export function classifyReverseArchetypePrimaryEligibility(visionBundle) {
  const validation = validateNormalizedVisionBundle(visionBundle);
  if (!validation.ok) {
    return { status: 'excluded', reason: 'observation_contract_invalid' };
  }

  const eligibility = visionBundle.eligibility;
  if (
    eligibility.humanFaceCount > 1 ||
    eligibility.faceLabFailureReason === 'multiple_faces'
  ) {
    return { status: 'excluded', reason: 'excluded_multi_face' };
  }
  if (
    eligibility.humanFaceCount === 0 ||
    eligibility.faceLabFailureReason === 'face_not_detected'
  ) {
    return { status: 'excluded', reason: 'no_face' };
  }
  if (eligibility.imageType !== 'photorealistic_human') {
    return { status: 'excluded', reason: 'non_photographic' };
  }
  if (eligibility.humanFaceCount !== 1) {
    return { status: 'excluded', reason: 'not_assessable_other' };
  }
  if (eligibility.faceLabEligible !== true) {
    const mapping = {
      face_too_small: 'face_too_small',
      face_occluded: 'face_occluded',
      face_angle_unsupported: 'profile_not_assessable',
      image_quality_insufficient: 'insufficient_resolution',
      non_photorealistic_face: 'non_photographic'
    };
    return {
      status: 'excluded',
      reason: mapping[eligibility.faceLabFailureReason] || 'not_assessable_other'
    };
  }
  if (!['available', 'partial'].includes(visionBundle.face.analysis.status)) {
    return { status: 'excluded', reason: 'not_assessable_other' };
  }

  return { status: 'included_primary', reason: null };
}

export function sealReverseArchetypeBlindObservation(
  packet,
  visionBundle,
  extractionIdentity,
  observedAt
) {
  const packetValidation = validateReverseArchetypeBlindPacket(packet);
  requireCondition(
    packetValidation.ok,
    'blind_packet_invalid:' + packetValidation.errors.join(',')
  );

  const visionValidation = validateNormalizedVisionBundle(visionBundle);
  requireCondition(
    visionValidation.ok,
    'vision_bundle_invalid:' + visionValidation.errors.join(',')
  );
  requireCondition(isObject(extractionIdentity), 'extraction_identity_invalid');

  const requiredIdentityKeys = [
    'observationContractVersion',
    'observationSchemaVersion',
    'visionProvider',
    'visionModel',
    'visionPromptVersionOrDigest',
    'normalizerVersion',
    'eligibilityVersion',
    'codeSha'
  ];
  for (const key of requiredIdentityKeys) {
    requireCondition(nonEmpty(extractionIdentity[key]), 'extraction_identity_missing:' + key);
  }

  requireCondition(
    nonEmpty(observedAt) && !Number.isNaN(Date.parse(observedAt)),
    'observed_at_invalid'
  );

  const payload = {
    schemaVersion: SEALED_OBSERVATION_SCHEMA_VERSION,
    researchSchemaVersion: REVERSE_ARCHETYPE_RESEARCH_SCHEMA_VERSION,
    runId: packet.runId,
    candidateId: packet.candidateId,
    blindObservationId: packet.blindObservationId,
    assetDigest: packet.asset.contentDigest,
    observedAt,
    eligibility: visionBundle.eligibility,
    faceAnalysis: visionBundle.face.analysis,
    primarySubset: classifyReverseArchetypePrimaryEligibility(visionBundle),
    extractionIdentity
  };

  return { ...payload, sealDigest: sha256Digest(payload) };
}

export function joinReverseArchetypeAfterObservationSeal(candidate, sealedObservation) {
  requireCondition(isObject(candidate), 'candidate_invalid');
  requireCondition(isObject(sealedObservation), 'sealed_observation_invalid');
  requireCondition(candidate.runId === sealedObservation.runId, 'run_id_mismatch');
  requireCondition(
    candidate.candidateId === sealedObservation.candidateId,
    'candidate_id_mismatch'
  );
  requireCondition(
    SHA256_PATTERN.test(sealedObservation.sealDigest || ''),
    'seal_digest_invalid'
  );

  const sealedPayload = { ...sealedObservation };
  delete sealedPayload.sealDigest;
  requireCondition(
    sha256Digest(sealedPayload) === sealedObservation.sealDigest,
    'seal_digest_mismatch'
  );

  return {
    schemaVersion: JOINED_RECORD_SCHEMA_VERSION,
    runId: candidate.runId,
    candidateId: candidate.candidateId,
    webContext: {
      archetypeQueryLabel: candidate.archetypeQueryLabel,
      queryId: candidate.queryId,
      queryString: candidate.queryString,
      queryFamily: candidate.queryFamily,
      retrievalSurfaceId: candidate.retrievalSurfaceId,
      originDomain: candidate.originDomain,
      originSourceFamilyOptional: candidate.originSourceFamilyOptional ?? null,
      resultRank: candidate.resultRank,
      resultPageOrCursor: candidate.resultPageOrCursor ?? null,
      resultUrl: candidate.resultUrl,
      landingUrl: candidate.landingUrl,
      imageUrl: candidate.imageUrl,
      retrievedAt: candidate.retrievedAt
    },
    observation: sealedObservation
  };
}

export function buildReverseArchetypeExactDuplicateMap(joinedRecords) {
  const groups = new Map();

  for (const row of joinedRecords || []) {
    const digest = row?.observation?.assetDigest;
    if (!SHA256_PATTERN.test(digest || '')) continue;
    if (!groups.has(digest)) groups.set(digest, []);
    groups.get(digest).push(row.candidateId);
  }

  return [...groups.entries()]
    .map(([assetDigest, candidateIds]) => ({
      assetDigest,
      candidateIds: [...candidateIds].sort(),
      count: candidateIds.length
    }))
    .sort((left, right) => left.assetDigest.localeCompare(right.assetDigest));
}
