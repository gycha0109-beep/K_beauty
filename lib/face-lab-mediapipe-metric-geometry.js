import {
  buildPhotoGeometryPacketFromMetricLandmarks,
  measurePhotoGeometry
} from './face-lab-photo-geometry-research.js';

export const MEDIAPIPE_METRIC_GEOMETRY_RUNTIME_SCHEMA_VERSION =
  'face-lab-mediapipe-metric-geometry-runtime-v0';

const EPSILON = 1e-12;
const COMPACT_FACE_THRESHOLD = 1e-3;

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function point(value) {
  return isObject(value) && finite(value.x) && finite(value.y) && finite(value.z);
}

function identity3() {
  return [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1]
  ];
}

function transpose3(matrix) {
  return matrix[0].map((_, column) => matrix.map((row) => row[column]));
}

function multiply3(left, right) {
  const result = Array.from({ length: 3 }, () => [0, 0, 0]);
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      for (let inner = 0; inner < 3; inner += 1) {
        result[row][column] += left[row][inner] * right[inner][column];
      }
    }
  }
  return result;
}

function multiplyVector3(matrix, vector) {
  return matrix.map((row) =>
    row[0] * vector[0] + row[1] * vector[1] + row[2] * vector[2]
  );
}

function determinant3(matrix) {
  return (
    matrix[0][0] * (matrix[1][1] * matrix[2][2] - matrix[1][2] * matrix[2][1]) -
    matrix[0][1] * (matrix[1][0] * matrix[2][2] - matrix[1][2] * matrix[2][0]) +
    matrix[0][2] * (matrix[1][0] * matrix[2][1] - matrix[1][1] * matrix[2][0])
  );
}

function dot3(left, right) {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function norm3(vector) {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

function normalize3(vector) {
  const norm = norm3(vector);
  if (!finite(norm) || norm <= EPSILON) {
    throw new Error('mediapipe_metric_geometry_vector_degenerate');
  }
  return vector.map((value) => value / norm);
}

function cross3(left, right) {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0]
  ];
}

function symmetricEigenDecomposition3(matrix) {
  const values = matrix.map((row) => row.slice());
  const vectors = identity3();

  for (let iteration = 0; iteration < 100; iteration += 1) {
    let p = 0;
    let q = 1;
    let max = Math.abs(values[0][1]);

    for (const [row, column] of [[0, 2], [1, 2]]) {
      const candidate = Math.abs(values[row][column]);
      if (candidate > max) {
        max = candidate;
        p = row;
        q = column;
      }
    }

    if (max < 1e-14) break;

    const phi = 0.5 * Math.atan2(
      2 * values[p][q],
      values[q][q] - values[p][p]
    );
    const cosine = Math.cos(phi);
    const sine = Math.sin(phi);
    const rotation = identity3();
    rotation[p][p] = cosine;
    rotation[q][q] = cosine;
    rotation[p][q] = sine;
    rotation[q][p] = -sine;

    const nextValues = multiply3(
      multiply3(transpose3(rotation), values),
      rotation
    );
    const nextVectors = multiply3(vectors, rotation);

    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        values[row][column] = nextValues[row][column];
        vectors[row][column] = nextVectors[row][column];
      }
    }
  }

  return [0, 1, 2]
    .map((index) => ({
      value: values[index][index],
      vector: [
        vectors[0][index],
        vectors[1][index],
        vectors[2][index]
      ]
    }))
    .sort((left, right) => right.value - left.value);
}

function svd3(matrix) {
  const eigen = symmetricEigenDecomposition3(
    multiply3(transpose3(matrix), matrix)
  );
  const vColumns = eigen.map((entry) => normalize3(entry.vector));
  const singularValues = eigen.map((entry) =>
    Math.sqrt(Math.max(0, entry.value))
  );

  const uColumns = vColumns.map((vector, index) => {
    if (singularValues[index] <= EPSILON) return null;
    return normalize3(multiplyVector3(matrix, vector));
  });

  uColumns[0] = normalize3(uColumns[0] || [1, 0, 0]);

  if (uColumns[1]) {
    const projection = dot3(uColumns[1], uColumns[0]);
    uColumns[1] = normalize3(
      uColumns[1].map((value, index) =>
        value - projection * uColumns[0][index]
      )
    );
  } else {
    uColumns[1] = normalize3(
      Math.abs(uColumns[0][0]) < 0.9
        ? cross3(uColumns[0], [1, 0, 0])
        : cross3(uColumns[0], [0, 1, 0])
    );
  }

  uColumns[2] = normalize3(cross3(uColumns[0], uColumns[1]));
  if (
    singularValues[2] > EPSILON &&
    dot3(uColumns[2], multiplyVector3(matrix, vColumns[2])) < 0
  ) {
    uColumns[2] = uColumns[2].map((value) => -value);
  }

  return {
    u: Array.from({ length: 3 }, (_, row) =>
      uColumns.map((column) => column[row])
    ),
    v: Array.from({ length: 3 }, (_, row) =>
      vColumns.map((column) => column[row])
    )
  };
}

function solveWeightedOrthogonalProblem(sourcePoints, targetPoints, weights) {
  if (
    sourcePoints.length === 0 ||
    sourcePoints.length !== targetPoints.length ||
    sourcePoints.length !== weights.length
  ) {
    throw new Error('mediapipe_metric_geometry_procrustes_shape_invalid');
  }

  const sqrtWeights = weights.map((weight) => {
    if (!finite(weight) || weight < 0) {
      throw new Error('mediapipe_metric_geometry_weight_invalid');
    }
    return Math.sqrt(weight);
  });
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  if (totalWeight <= 1e-9) {
    throw new Error('mediapipe_metric_geometry_total_weight_too_small');
  }

  const sourceCenter = [0, 1, 2].map((axis) =>
    sourcePoints.reduce(
      (sum, pointValue, index) =>
        sum + pointValue[axis] * weights[index],
      0
    ) / totalWeight
  );

  const weightedSources = sourcePoints.map((pointValue, index) =>
    pointValue.map((value) => value * sqrtWeights[index])
  );
  const weightedTargets = targetPoints.map((pointValue, index) =>
    pointValue.map((value) => value * sqrtWeights[index])
  );
  const centeredWeightedSources = weightedSources.map((pointValue, index) =>
    pointValue.map(
      (value, axis) =>
        value - sourceCenter[axis] * sqrtWeights[index]
    )
  );

  const design = Array.from({ length: 3 }, () => [0, 0, 0]);
  for (let index = 0; index < sourcePoints.length; index += 1) {
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        design[row][column] +=
          weightedTargets[index][row] *
          centeredWeightedSources[index][column];
      }
    }
  }

  const decomposition = svd3(design);
  const u = decomposition.u;
  const v = decomposition.v;

  if (determinant3(u) * determinant3(transpose3(v)) < 0) {
    for (let row = 0; row < 3; row += 1) {
      u[row][2] *= -1;
    }
  }

  const rotation = multiply3(u, transpose3(v));
  let numerator = 0;
  let denominator = 0;

  for (let index = 0; index < sourcePoints.length; index += 1) {
    const rotated = multiplyVector3(
      rotation,
      centeredWeightedSources[index]
    );
    for (let axis = 0; axis < 3; axis += 1) {
      numerator += rotated[axis] * weightedTargets[index][axis];
      denominator +=
        centeredWeightedSources[index][axis] *
        weightedSources[index][axis];
    }
  }

  if (denominator <= 1e-9) {
    throw new Error('mediapipe_metric_geometry_scale_denominator_too_small');
  }
  const scale = numerator / denominator;
  if (!finite(scale) || scale <= 1e-9) {
    throw new Error('mediapipe_metric_geometry_scale_too_small');
  }

  const translation = [0, 0, 0];
  for (let index = 0; index < sourcePoints.length; index += 1) {
    const transformed = multiplyVector3(
      rotation,
      weightedSources[index]
    ).map((value) => value * scale);

    for (let axis = 0; axis < 3; axis += 1) {
      translation[axis] += (
        weightedTargets[index][axis] - transformed[axis]
      ) * sqrtWeights[index] / totalWeight;
    }
  }

  return { rotation, scale, translation };
}

function inverseTransformPoint(pointValue, transform) {
  const translated = pointValue.map(
    (value, axis) => value - transform.translation[axis]
  );
  return multiplyVector3(
    transpose3(transform.rotation),
    translated
  ).map((value) => value / transform.scale);
}

function compactFace(screenLandmarks) {
  let meanX = 0;
  let meanY = 0;

  for (let index = 0; index < screenLandmarks.length; index += 1) {
    meanX += (screenLandmarks[index][0] - meanX) / (index + 1);
    meanY += (screenLandmarks[index][1] - meanY) / (index + 1);
  }

  let maxSquaredDistance = 0;
  for (const landmark of screenLandmarks) {
    const dx = landmark[0] - meanX;
    const dy = landmark[1] - meanY;
    maxSquaredDistance = Math.max(
      maxSquaredDistance,
      dx * dx + dy * dy
    );
  }

  return Math.sqrt(maxSquaredDistance) <= COMPACT_FACE_THRESHOLD;
}

export function validateMediaPipeMetricGeometryRuntimeMetadata(metadata) {
  const errors = [];

  if (
    !isObject(metadata) ||
    metadata.schemaVersion !== MEDIAPIPE_METRIC_GEOMETRY_RUNTIME_SCHEMA_VERSION
  ) {
    errors.push('schema_version_invalid');
  }
  if (metadata?.provider !== 'mediapipe_face_geometry') {
    errors.push('provider_invalid');
  }
  if (!/^google-ai-edge\/mediapipe@[a-f0-9]{40}$/.test(metadata?.providerVersion || '')) {
    errors.push('provider_version_not_pinned');
  }
  if (metadata?.productionAuthority !== false) {
    errors.push('production_authority_forbidden');
  }
  if (metadata?.inputLandmarkTopology !== 468) {
    errors.push('input_landmark_topology_invalid');
  }
  if (metadata?.outputCoordinateSpace !== 'pose_normalized_metric_3d') {
    errors.push('output_coordinate_space_invalid');
  }
  if (metadata?.originPointLocation !== 'TOP_LEFT_CORNER') {
    errors.push('origin_point_location_invalid');
  }
  if (
    metadata?.camera?.verticalFovDegrees !== 63 ||
    metadata?.camera?.nearCm !== 1 ||
    metadata?.camera?.farCm !== 10000
  ) {
    errors.push('camera_contract_invalid');
  }
  if (
    !Array.isArray(metadata?.canonicalLandmarks) ||
    metadata.canonicalLandmarks.length !== 468 ||
    metadata.canonicalLandmarks.some((candidate) => !point(candidate))
  ) {
    errors.push('canonical_landmarks_invalid');
  }
  if (!isObject(metadata?.procrustesWeights)) {
    errors.push('procrustes_weights_missing');
  } else {
    const entries = Object.entries(metadata.procrustesWeights);
    if (entries.length !== 33) errors.push('procrustes_weight_count_invalid');
    for (const [index, weight] of entries) {
      if (
        !/^\d+$/.test(index) ||
        Number(index) < 0 ||
        Number(index) >= 468 ||
        !finite(weight) ||
        weight <= 0
      ) {
        errors.push('procrustes_weight_invalid:' + index);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

export function reconstructMediaPipeMetricGeometry({
  screenLandmarks,
  frameWidth,
  frameHeight
} = {}, metadata) {
  const validation = validateMediaPipeMetricGeometryRuntimeMetadata(metadata);
  if (!validation.ok) {
    throw new Error(
      'mediapipe_metric_geometry_metadata_invalid:' +
      validation.errors.join(',')
    );
  }

  if (
    !Array.isArray(screenLandmarks) ||
    screenLandmarks.length < metadata.inputLandmarkTopology
  ) {
    throw new Error('mediapipe_metric_geometry_landmark_topology_mismatch');
  }
  if (
    !Number.isInteger(frameWidth) ||
    !Number.isInteger(frameHeight) ||
    frameWidth <= 0 ||
    frameHeight <= 0
  ) {
    throw new Error('mediapipe_metric_geometry_frame_size_invalid');
  }

  const screen = screenLandmarks
    .slice(0, metadata.inputLandmarkTopology)
    .map((candidate, index) => {
      if (!point(candidate)) {
        throw new Error(
          'mediapipe_metric_geometry_screen_landmark_invalid:' + index
        );
      }
      return [candidate.x, candidate.y, candidate.z];
    });

  if (compactFace(screen)) {
    throw new Error('mediapipe_metric_geometry_face_too_compact');
  }

  const canonical = metadata.canonicalLandmarks.map(
    (candidate) => [candidate.x, candidate.y, candidate.z]
  );
  const weights = Array(metadata.inputLandmarkTopology).fill(0);
  for (const [index, weight] of Object.entries(metadata.procrustesWeights)) {
    weights[Number(index)] = weight;
  }

  const degreesToRadians = Math.PI / 180;
  const near = metadata.camera.nearCm;
  const heightAtNear =
    2 * near *
    Math.tan(
      0.5 * degreesToRadians * metadata.camera.verticalFovDegrees
    );
  const widthAtNear = frameWidth * heightAtNear / frameHeight;
  const left = -0.5 * widthAtNear;
  const bottom = -0.5 * heightAtNear;

  const projected = screen.map(([x, y, z]) => [
    x * widthAtNear + left,
    (1 - y) * heightAtNear + bottom,
    z * widthAtNear
  ]);
  const depthOffset =
    projected.reduce((sum, candidate) => sum + candidate[2], 0) /
    projected.length;

  const changeHandedness = (landmarks) =>
    landmarks.map(([x, y, z]) => [x, y, -z]);

  const firstIteration = solveWeightedOrthogonalProblem(
    canonical,
    changeHandedness(projected),
    weights
  );

  const unproject = (landmarks, scale) =>
    landmarks.map(([x, y, z]) => {
      const metricZ = (z - depthOffset + near) / scale;
      return [
        x * metricZ / near,
        y * metricZ / near,
        -metricZ
      ];
    });

  const intermediate = unproject(projected, firstIteration.scale);
  const secondIteration = solveWeightedOrthogonalProblem(
    canonical,
    intermediate,
    weights
  );
  const metric = unproject(
    projected,
    firstIteration.scale * secondIteration.scale
  );
  const pose = solveWeightedOrthogonalProblem(
    canonical,
    metric,
    weights
  );

  return {
    landmarks: metric.map((candidate) => {
      const [x, y, z] = inverseTransformPoint(candidate, pose);
      return { x, y, z };
    }),
    diagnostics: {
      firstIterationScale: firstIteration.scale,
      secondIterationScale: secondIteration.scale,
      totalUnprojectionScale:
        firstIteration.scale * secondIteration.scale,
      poseScale: pose.scale,
      coordinateSpace: metadata.outputCoordinateSpace,
      frameWidth,
      frameHeight
    }
  };
}

export function buildPhotoGeometryMeasurementFromFaceLandmarkerResult({
  sampleId,
  faceLandmarkerResult,
  frameWidth,
  frameHeight,
  sourceVersion,
  sourceImagePersisted = false
} = {}, manifest, metadata) {
  if (sourceImagePersisted !== false) {
    throw new Error('photo_geometry_source_image_persistence_forbidden');
  }
  if (
    !isObject(faceLandmarkerResult) ||
    !Array.isArray(faceLandmarkerResult.faceLandmarks)
  ) {
    throw new Error('mediapipe_face_landmarker_result_invalid');
  }
  if (faceLandmarkerResult.faceLandmarks.length !== 1) {
    throw new Error('photo_geometry_single_face_required');
  }

  const reconstruction = reconstructMediaPipeMetricGeometry({
    screenLandmarks: faceLandmarkerResult.faceLandmarks[0],
    frameWidth,
    frameHeight
  }, metadata);

  const packet = buildPhotoGeometryPacketFromMetricLandmarks({
    sampleId,
    sourceVersion,
    landmarks: reconstruction.landmarks,
    faceCount: 1,
    sourceImagePersisted: false
  }, manifest);

  return {
    packet,
    measurement: measurePhotoGeometry(packet, manifest),
    diagnostics: reconstruction.diagnostics
  };
}
