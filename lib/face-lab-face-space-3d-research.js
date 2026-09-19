import { createHash } from 'node:crypto';

export const FACE_SPACE_3D_CONTRACT_VERSION = 'face-space-3d-adapter-v0';
export const FACE_SPACE_VECTOR_SCHEMA_VERSION = 'face-space-vector-research-v0';
export const FACE_SPACE_3D_ADAPTER_SCHEMA_VERSION = 'face-space-3d-adapter-manifest-v0';
export const FACE_SPACE_3D_ROUNDTRIP_SCHEMA_VERSION = 'face-space-3d-roundtrip-v0';

const BACKENDS = new Set(['gnm_v3', 'mpfb2', 'flame_2023_open']);
const IMPLEMENTATION_STATUSES = new Set(['mapping_candidate', 'executable', 'validated']);
const STRATEGIES = new Set([
  'direct_target',
  'composite_target',
  'custom_target_required',
  'optimization_fit',
  'unsupported'
]);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function stableStringify(value) {
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  if (isObject(value)) {
    return '{' + Object.keys(value).sort().map((key) =>
      JSON.stringify(key) + ':' + stableStringify(value[key])
    ).join(',') + '}';
  }
  return JSON.stringify(value);
}

export function digestFaceSpace3DRecord(value) {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

export function validateFaceSpaceVector(vector) {
  const errors = [];
  if (!isObject(vector) || vector.schemaVersion !== FACE_SPACE_VECTOR_SCHEMA_VERSION) {
    errors.push('schema_version_invalid');
  }
  if (!nonEmpty(vector?.vectorId)) errors.push('vector_id_missing');
  if (!nonEmpty(vector?.normalizationVersion)) errors.push('normalization_version_missing');
  if (!Array.isArray(vector?.dimensions) || vector.dimensions.length === 0) {
    errors.push('dimensions_invalid');
    return { ok: errors.length === 0, errors };
  }

  const ids = new Set();
  for (const dimension of vector.dimensions) {
    if (!nonEmpty(dimension?.id)) errors.push('dimension_id_missing');
    if (ids.has(dimension?.id)) errors.push('dimension_id_duplicate:' + dimension.id);
    ids.add(dimension?.id);
    if (!finite(dimension?.value)) errors.push('dimension_value_invalid:' + (dimension?.id || 'unknown'));
    if (!nonEmpty(dimension?.unit)) errors.push('dimension_unit_missing:' + (dimension?.id || 'unknown'));
  }

  if (vector?.archetypeLabel !== undefined) errors.push('archetype_label_forbidden');
  if (vector?.identityEmbedding !== undefined) errors.push('identity_embedding_forbidden');

  return { ok: errors.length === 0, errors };
}

export function validateFaceSpace3DAdapterManifest(manifest) {
  const errors = [];
  if (!isObject(manifest) || manifest.schemaVersion !== FACE_SPACE_3D_ADAPTER_SCHEMA_VERSION) {
    errors.push('schema_version_invalid');
  }
  if (!nonEmpty(manifest?.adapterId)) errors.push('adapter_id_missing');
  if (!BACKENDS.has(manifest?.backend)) errors.push('backend_invalid');
  if (!nonEmpty(manifest?.backendVersion)) errors.push('backend_version_missing');
  if (!nonEmpty(manifest?.mappingVersion)) errors.push('mapping_version_missing');
  if (manifest?.faceSpaceIsAuthority !== true) errors.push('face_space_authority_required');
  if (manifest?.nativeParametersAreAuthority !== false) {
    errors.push('native_parameters_must_not_be_authority');
  }
  if (manifest?.executionBoundary !== 'offline_research') {
    errors.push('execution_boundary_invalid');
  }
  if (!IMPLEMENTATION_STATUSES.has(manifest?.implementationStatus)) {
    errors.push('implementation_status_invalid');
  }
  if (!isObject(manifest?.licenseReview) || !nonEmpty(manifest.licenseReview.status)) {
    errors.push('license_review_missing');
  }
  if (manifest?.backend === 'gnm_v3' && manifest?.semanticDemographicSamplingAllowed !== false) {
    errors.push('gnm_semantic_demographic_sampling_must_be_disabled');
  }
  if (
    manifest?.backend === 'gnm_v3' &&
    manifest?.semanticContractVersion !== 'face-space-structural-measurement-semantics-v0'
  ) {
    errors.push('gnm_semantic_contract_version_invalid');
  }
  if (!Array.isArray(manifest?.dimensionMappings) || manifest.dimensionMappings.length === 0) {
    errors.push('dimension_mappings_invalid');
    return { ok: errors.length === 0, errors };
  }

  const ids = new Set();
  for (const mapping of manifest.dimensionMappings) {
    if (!nonEmpty(mapping?.dimensionId)) errors.push('mapping_dimension_id_missing');
    if (ids.has(mapping?.dimensionId)) {
      errors.push('mapping_dimension_duplicate:' + mapping.dimensionId);
    }
    ids.add(mapping?.dimensionId);

    if (!STRATEGIES.has(mapping?.strategy)) {
      errors.push('mapping_strategy_invalid:' + (mapping?.dimensionId || 'unknown'));
    }
    if (mapping?.strategy === 'direct_target' && !nonEmpty(mapping?.nativeTarget)) {
      errors.push('direct_target_name_missing:' + mapping.dimensionId);
    }
    if (mapping?.strategy === 'optimization_fit' && !nonEmpty(mapping?.objectiveFamily)) {
      errors.push('optimization_objective_missing:' + mapping.dimensionId);
    }
    if (mapping?.strategy !== 'unsupported') {
      if (!finite(mapping?.absoluteTolerance) || mapping.absoluteTolerance < 0) {
        errors.push('mapping_tolerance_invalid:' + mapping.dimensionId);
      }
    }

    if (
      manifest?.backend === 'flame_2023_open' &&
      !['optimization_fit', 'unsupported'].includes(mapping?.strategy)
    ) {
      errors.push('flame_direct_axis_mapping_forbidden:' + mapping.dimensionId);
    }

    if (
      manifest?.backend === 'gnm_v3' &&
      !['optimization_fit', 'unsupported'].includes(mapping?.strategy)
    ) {
      errors.push('gnm_direct_axis_mapping_forbidden:' + mapping.dimensionId);
    }
  }

  return { ok: errors.length === 0, errors };
}

export function buildFaceSpace3DRenderRequest(vector, manifest) {
  const vectorValidation = validateFaceSpaceVector(vector);
  if (!vectorValidation.ok) {
    throw new Error('face_space_vector_invalid:' + vectorValidation.errors.join(','));
  }
  const manifestValidation = validateFaceSpace3DAdapterManifest(manifest);
  if (!manifestValidation.ok) {
    throw new Error('adapter_manifest_invalid:' + manifestValidation.errors.join(','));
  }

  const mappingById = new Map(
    manifest.dimensionMappings.map((mapping) => [mapping.dimensionId, mapping])
  );

  const mappedDimensions = vector.dimensions.map((dimension) => {
    const mapping = mappingById.get(dimension.id);
    if (!mapping) {
      return {
        ...dimension,
        mappingStatus: 'unmapped',
        strategy: 'unsupported'
      };
    }
    return {
      ...dimension,
      mappingStatus: mapping.strategy === 'unsupported' ? 'unsupported' : 'mapped',
      strategy: mapping.strategy,
      nativeTarget: mapping.nativeTarget || null,
      objectiveFamily: mapping.objectiveFamily || null,
      absoluteTolerance: finite(mapping.absoluteTolerance) ? mapping.absoluteTolerance : null
    };
  });

  const request = {
    schemaVersion: 'face-space-3d-render-request-v0',
    contractVersion: FACE_SPACE_3D_CONTRACT_VERSION,
    vectorId: vector.vectorId,
    normalizationVersion: vector.normalizationVersion,
    adapterId: manifest.adapterId,
    backend: manifest.backend,
    backendVersion: manifest.backendVersion,
    mappingVersion: manifest.mappingVersion,
    executionBoundary: manifest.executionBoundary,
    mappedDimensions
  };

  return {
    ...request,
    requestDigest: digestFaceSpace3DRecord(request)
  };
}

export function evaluateFaceSpace3DRoundTrip({
  vector,
  manifest,
  measurement
} = {}) {
  const vectorValidation = validateFaceSpaceVector(vector);
  const manifestValidation = validateFaceSpace3DAdapterManifest(manifest);
  const errors = [
    ...vectorValidation.errors.map((error) => 'vector:' + error),
    ...manifestValidation.errors.map((error) => 'manifest:' + error)
  ];

  if (!isObject(measurement) || measurement.schemaVersion !== FACE_SPACE_3D_ROUNDTRIP_SCHEMA_VERSION) {
    errors.push('measurement_schema_invalid');
  }
  if (measurement?.vectorId !== vector?.vectorId) errors.push('measurement_vector_id_mismatch');
  if (measurement?.adapterId !== manifest?.adapterId) errors.push('measurement_adapter_id_mismatch');
  if (!nonEmpty(measurement?.meshDigest)) errors.push('mesh_digest_missing');
  if (!nonEmpty(measurement?.measurementVersion)) errors.push('measurement_version_missing');
  if (!Array.isArray(measurement?.dimensions)) errors.push('measurement_dimensions_invalid');

  if (errors.length > 0) {
    return { ok: false, status: 'invalid', errors, dimensions: [] };
  }

  const targetById = new Map(vector.dimensions.map((item) => [item.id, item]));
  const mappingById = new Map(manifest.dimensionMappings.map((item) => [item.dimensionId, item]));
  const measuredIds = new Set();
  const dimensions = [];

  for (const measured of measurement.dimensions) {
    if (!nonEmpty(measured?.id) || !finite(measured?.value) || !nonEmpty(measured?.unit)) {
      errors.push('measurement_dimension_invalid:' + (measured?.id || 'unknown'));
      continue;
    }
    if (measuredIds.has(measured.id)) {
      errors.push('measurement_dimension_duplicate:' + measured.id);
      continue;
    }
    measuredIds.add(measured.id);

    const target = targetById.get(measured.id);
    if (!target) {
      errors.push('measurement_dimension_unknown:' + measured.id);
      continue;
    }
    if (target.unit !== measured.unit) {
      errors.push('measurement_unit_mismatch:' + measured.id);
      continue;
    }

    const mapping = mappingById.get(measured.id);
    const tolerance = mapping && finite(mapping.absoluteTolerance)
      ? mapping.absoluteTolerance
      : null;
    const absoluteError = Math.abs(measured.value - target.value);
    const supported = mapping && mapping.strategy !== 'unsupported';
    const passed = supported && tolerance !== null && absoluteError <= tolerance;

    dimensions.push({
      id: measured.id,
      unit: measured.unit,
      target: target.value,
      measured: measured.value,
      absoluteError,
      tolerance,
      supported: Boolean(supported),
      passed
    });
  }

  for (const target of vector.dimensions) {
    if (!measuredIds.has(target.id)) {
      const mapping = mappingById.get(target.id);
      dimensions.push({
        id: target.id,
        unit: target.unit,
        target: target.value,
        measured: null,
        absoluteError: null,
        tolerance: mapping && finite(mapping.absoluteTolerance) ? mapping.absoluteTolerance : null,
        supported: Boolean(mapping && mapping.strategy !== 'unsupported'),
        passed: false
      });
    }
  }

  if (errors.length > 0) {
    return { ok: false, status: 'invalid', errors, dimensions };
  }

  const supportedDimensions = dimensions.filter((item) => item.supported);
  const failedDimensions = supportedDimensions.filter((item) => !item.passed);
  const unsupportedDimensions = dimensions.filter((item) => !item.supported);

  return {
    ok: failedDimensions.length === 0,
    status: failedDimensions.length === 0 ? 'pass' : 'hold',
    errors: [],
    adapterId: manifest.adapterId,
    backend: manifest.backend,
    vectorId: vector.vectorId,
    meshDigest: measurement.meshDigest,
    measurementVersion: measurement.measurementVersion,
    dimensions,
    supportedDimensionCount: supportedDimensions.length,
    failedDimensionCount: failedDimensions.length,
    unsupportedDimensionCount: unsupportedDimensions.length
  };
}
