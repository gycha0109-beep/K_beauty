import { createHash } from 'node:crypto';

export const PHOTO_GEOMETRY_MANIFEST_SCHEMA_VERSION =
  'face-lab-photo-geometry-manifest-v0';
export const PHOTO_GEOMETRY_PACKET_SCHEMA_VERSION =
  'face-lab-photo-geometry-metric-landmarks-v0';
export const STRUCTURAL_MEASUREMENT_SCHEMA_VERSION =
  'face-space-structural-measurement-v0';
export const STRUCTURAL_MEASUREMENT_VERSION =
  'face-space-structural-measurement-v0';

const REQUIRED_ANCHORS = Object.freeze([
  'face_left_lateral',
  'face_right_lateral',
  'lower_face_left',
  'lower_face_right',
  'chin',
  'nose_base_center',
  'right_eye_outer',
  'right_eye_inner',
  'left_eye_inner',
  'left_eye_outer',
  'nose_left_alar',
  'nose_right_alar'
]);

const STRUCTURAL_DIMENSIONS = Object.freeze([
  'lower_face_width_ratio',
  'chin_height_ratio',
  'eye_spacing_ratio',
  'eye_width_ratio',
  'eye_tilt',
  'nose_width_ratio'
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

function digest(value) {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function point(value) {
  return isObject(value) &&
    finite(value.x) &&
    finite(value.y) &&
    finite(value.z);
}

function distance3d(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function safeRatio(numerator, denominator, id) {
  if (!finite(denominator) || denominator <= 1e-9) {
    throw new Error('photo_geometry_normalizer_invalid:' + id);
  }
  return numerator / denominator;
}

function canonicalEyeTiltDegrees(outer, inner) {
  let dx = inner.x - outer.x;
  let dy = inner.y - outer.y;
  if (dx < 0) {
    dx = -dx;
    dy = -dy;
  }
  return Math.atan2(dy, dx) * 180 / Math.PI;
}

function hasForbiddenPayload(value, seen = new WeakSet()) {
  if (typeof value === 'string') return /^data:image\//i.test(value.trim());
  if (!value || typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);

  if (Array.isArray(value)) return value.some((item) => hasForbiddenPayload(item, seen));

  return Object.entries(value).some(([key, item]) => {
    const normalized = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
    if ([
      'image',
      'imageurl',
      'imagedataurl',
      'base64',
      'buffer',
      'facecrop',
      'crop',
      'identityembedding'
    ].includes(normalized)) {
      return true;
    }
    return hasForbiddenPayload(item, seen);
  });
}

export function validatePhotoGeometryManifest(manifest) {
  const errors = [];
  if (!isObject(manifest) || manifest.schemaVersion !== PHOTO_GEOMETRY_MANIFEST_SCHEMA_VERSION) {
    errors.push('schema_version_invalid');
  }
  if (!nonEmpty(manifest?.adapterId)) errors.push('adapter_id_missing');
  if (manifest?.provider !== 'mediapipe_face_geometry') errors.push('provider_invalid');
  if (!/^google-ai-edge\/mediapipe@[a-f0-9]{40}$/.test(manifest?.providerVersion || '')) {
    errors.push('provider_version_not_pinned');
  }
  if (manifest?.coordinateSpace !== 'pose_normalized_metric_3d') {
    errors.push('coordinate_space_invalid');
  }
  if (manifest?.landmarkTopology !== 468) errors.push('landmark_topology_invalid');
  if (manifest?.rawScreenLandmarksAccepted !== false) {
    errors.push('raw_screen_landmarks_must_be_rejected');
  }
  if (manifest?.identityEmbeddingAllowed !== false) {
    errors.push('identity_embedding_must_be_disabled');
  }
  if (manifest?.productionAuthority !== false) {
    errors.push('production_authority_forbidden');
  }
  if (!isObject(manifest?.anchorMap)) {
    errors.push('anchor_map_missing');
  } else {
    const ids = new Set();
    for (const anchor of REQUIRED_ANCHORS) {
      const id = manifest.anchorMap[anchor];
      if (!Number.isInteger(id) || id < 0 || id >= manifest.landmarkTopology) {
        errors.push('anchor_invalid:' + anchor);
      }
      if (ids.has(id)) errors.push('anchor_duplicate:' + id);
      ids.add(id);
    }
  }
  if (!isObject(manifest?.upstreamEvidence) ||
      !/^[a-f0-9]{40}$/.test(manifest?.upstreamEvidence?.canonicalModelBlobSha || '')) {
    errors.push('canonical_model_blob_not_pinned');
  }
  return { ok: errors.length === 0, errors };
}

export function validatePhotoGeometryPacket(packet, manifest) {
  const errors = [];
  const manifestValidation = validatePhotoGeometryManifest(manifest);
  errors.push(...manifestValidation.errors.map((error) => 'manifest:' + error));

  if (!isObject(packet) || packet.schemaVersion !== PHOTO_GEOMETRY_PACKET_SCHEMA_VERSION) {
    errors.push('packet_schema_invalid');
  }
  if (!nonEmpty(packet?.sampleId)) errors.push('sample_id_missing');
  if (packet?.source !== manifest?.provider) errors.push('source_mismatch');
  if (packet?.sourceVersion !== manifest?.providerVersion) errors.push('source_version_mismatch');
  if (packet?.coordinateSpace !== manifest?.coordinateSpace) errors.push('coordinate_space_mismatch');
  if (packet?.landmarkTopology !== manifest?.landmarkTopology) errors.push('landmark_topology_mismatch');
  if (packet?.faceCount !== 1) errors.push('single_face_required');
  if (packet?.poseNormalized !== true) errors.push('pose_normalization_required');
  if (packet?.metricGeometry !== true) errors.push('metric_geometry_required');
  if (packet?.sourceImagePersisted !== false) errors.push('source_image_persistence_forbidden');
  if (hasForbiddenPayload(packet)) errors.push('forbidden_image_or_identity_payload');

  if (!isObject(packet?.landmarks)) {
    errors.push('landmarks_missing');
  } else if (isObject(manifest?.anchorMap)) {
    for (const anchor of REQUIRED_ANCHORS) {
      const index = manifest.anchorMap[anchor];
      if (!point(packet.landmarks[String(index)])) {
        errors.push('landmark_missing:' + anchor + ':' + index);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

export function measurePhotoGeometry(packet, manifest) {
  const validation = validatePhotoGeometryPacket(packet, manifest);
  if (!validation.ok) {
    throw new Error('photo_geometry_packet_invalid:' + validation.errors.join(','));
  }

  const anchor = (name) => packet.landmarks[String(manifest.anchorMap[name])];
  const faceWidth = distance3d(anchor('face_left_lateral'), anchor('face_right_lateral'));

  const values = {
    lower_face_width_ratio: safeRatio(
      distance3d(anchor('lower_face_left'), anchor('lower_face_right')),
      faceWidth,
      'lower_face_width_ratio'
    ),
    chin_height_ratio: safeRatio(
      distance3d(anchor('nose_base_center'), anchor('chin')),
      faceWidth,
      'chin_height_ratio'
    ),
    eye_spacing_ratio: safeRatio(
      distance3d(anchor('right_eye_inner'), anchor('left_eye_inner')),
      faceWidth,
      'eye_spacing_ratio'
    ),
    eye_width_ratio: safeRatio(
      (
        distance3d(anchor('right_eye_outer'), anchor('right_eye_inner')) +
        distance3d(anchor('left_eye_inner'), anchor('left_eye_outer'))
      ) / 2,
      faceWidth,
      'eye_width_ratio'
    ),
    eye_tilt: (
      canonicalEyeTiltDegrees(anchor('right_eye_outer'), anchor('right_eye_inner')) +
      canonicalEyeTiltDegrees(anchor('left_eye_outer'), anchor('left_eye_inner'))
    ) / 2,
    nose_width_ratio: safeRatio(
      distance3d(anchor('nose_left_alar'), anchor('nose_right_alar')),
      faceWidth,
      'nose_width_ratio'
    )
  };

  const dimensions = STRUCTURAL_DIMENSIONS.map((id) => ({
    id,
    value: values[id],
    unit: id === 'eye_tilt' ? 'degree' : 'ratio'
  }));

  const record = {
    schemaVersion: STRUCTURAL_MEASUREMENT_SCHEMA_VERSION,
    measurementVersion: STRUCTURAL_MEASUREMENT_VERSION,
    sampleId: packet.sampleId,
    source: packet.source,
    sourceVersion: packet.sourceVersion,
    adapterId: manifest.adapterId,
    coordinateSpace: packet.coordinateSpace,
    normalizationReference: 'face_left_lateral_to_face_right_lateral_3d_distance',
    dimensions,
    privacy: {
      sourceImagePersisted: false,
      identityEmbeddingCreated: false
    }
  };

  return {
    ...record,
    measurementDigest: digest(record)
  };
}

export function compareStructuralMeasurements(left, right) {
  if (left?.schemaVersion !== STRUCTURAL_MEASUREMENT_SCHEMA_VERSION ||
      right?.schemaVersion !== STRUCTURAL_MEASUREMENT_SCHEMA_VERSION) {
    throw new Error('structural_measurement_schema_invalid');
  }

  const leftById = new Map(left.dimensions.map((item) => [item.id, item]));
  const rightById = new Map(right.dimensions.map((item) => [item.id, item]));
  const dimensions = [];

  for (const id of STRUCTURAL_DIMENSIONS) {
    const a = leftById.get(id);
    const b = rightById.get(id);
    if (!a || !b || a.unit !== b.unit || !finite(a.value) || !finite(b.value)) {
      throw new Error('structural_measurement_dimension_invalid:' + id);
    }
    dimensions.push({
      id,
      unit: a.unit,
      left: a.value,
      right: b.value,
      absoluteDifference: Math.abs(a.value - b.value)
    });
  }

  return {
    schemaVersion: 'face-space-structural-measurement-comparison-v0',
    leftDigest: left.measurementDigest || digest(left),
    rightDigest: right.measurementDigest || digest(right),
    dimensions
  };
}

export const PHOTO_GEOMETRY_REQUIRED_ANCHORS = REQUIRED_ANCHORS;
export const PHOTO_GEOMETRY_STRUCTURAL_DIMENSIONS = STRUCTURAL_DIMENSIONS;
