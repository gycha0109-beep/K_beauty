export const PERSONAL_COLOR_CHEEK_LANDMARK_PROPOSAL_VERSION =
  "face-lab-personal-color-cheek-landmark-proposal-v1";

const INDEX = Object.freeze({
  outerA: 234,
  outerB: 454,
  nose: 1,
  eyeA: 33,
  eyeB: 263,
  mouthA: 61,
  mouthB: 291
});

function hold(reason) {
  return {
    schemaVersion: PERSONAL_COLOR_CHEEK_LANDMARK_PROPOSAL_VERSION,
    status: "insufficient_evidence",
    reason,
    cheekPolygons: null,
    exclusionPolygons: null,
    coordinateSpace: "original_image",
    requiresIndependentRoiReview: true,
    mayMeasureSkin: false,
    sourceImagePersisted: false
  };
}

function validPoint(p) {
  return p &&
    typeof p === "object" &&
    Number.isFinite(p.x) && Number.isFinite(p.y) &&
    p.x >= 0 && p.x <= 1 &&
    p.y >= 0 && p.y <= 1;
}

function polygonAround(centerX, centerY, radiusX, radiusY) {
  return Array.from({ length: 12 }, (_, i) => {
    const angle = i * Math.PI / 6;
    return {
      x: centerX + radiusX * Math.cos(angle),
      y: centerY + radiusY * Math.sin(angle)
    };
  });
}

function rect(xMin, yMin, xMax, yMax) {
  return [
    { x: xMin, y: yMin },
    { x: xMax, y: yMin },
    { x: xMax, y: yMax },
    { x: xMin, y: yMax }
  ];
}

/**
 * Geometry proposal only. Input is Face Mesh-style normalized landmarks in
 * ORIGINAL IMAGE coordinates, not CSS mirrored-camera preview coordinates.
 *
 * The proposal is intentionally NOT a validated skin segmentation: cheek
 * areas might still contain cosmetics, hair, shadows, lens artifacts or
 * background. A separate independent ROI review and photo-quality decision
 * are required before buildPersonalColorCheekMasks + CIELAB sampling.
 *
 * No image, landmarks or polygon data are persisted.
 */
export function proposePersonalColorCheekRegions({
  faceLandmarks,
  faceCount,
  coordinateSpace = "unknown"
} = {}) {
  if (coordinateSpace !== "original_image") return hold("image_orientation_unknown");
  if (faceCount !== 1 || !Array.isArray(faceLandmarks) ||
    faceLandmarks.length < 468) {
    return hold("single_face_landmarks_unavailable");
  }

  const points = Object.fromEntries(
    Object.entries(INDEX).map(([name, index]) => [name, faceLandmarks[index]])
  );
  if (!Object.values(points).every(validPoint)) {
    return hold("required_face_landmarks_invalid");
  }

  const sides = [points.outerA, points.outerB].sort((a, b) => a.x - b.x);
  const eyes = [points.eyeA, points.eyeB].sort((a, b) => a.x - b.x);
  const mouth = [points.mouthA, points.mouthB].sort((a, b) => a.x - b.x);
  const faceWidth = sides[1].x - sides[0].x;
  const eyesY = (eyes[0].y + eyes[1].y) / 2;
  const mouthY = (mouth[0].y + mouth[1].y) / 2;
  const vertical = mouthY - eyesY;

  if (faceWidth < 0.20 || vertical < 0.10 ||
    sides[0].x >= points.nose.x || points.nose.x >= sides[1].x ||
    Math.abs(eyes[1].y - eyes[0].y) > vertical * 0.25 ||
    Math.abs(mouth[1].y - mouth[0].y) > vertical * 0.25 ||
    (points.nose.x - sides[0].x) / faceWidth < 0.32 ||
    (sides[1].x - points.nose.x) / faceWidth < 0.32 ||
    eyes[0].x < sides[0].x || eyes[1].x > sides[1].x ||
    eyesY >= points.nose.y || points.nose.y >= mouthY
  ) {
    return hold("face_geometry_unreliable");
  }

  const radiusX = faceWidth * 0.075;
  const radiusY = vertical * 0.18;
  const centerY = eyesY + vertical * 0.55;
  const centerXLeft = sides[0].x * 0.46 + points.nose.x * 0.54;
  const centerXRight = sides[1].x * 0.46 + points.nose.x * 0.54;

  const cheeks = {
    leftCheek: polygonAround(centerXLeft, centerY, radiusX, radiusY),
    rightCheek: polygonAround(centerXRight, centerY, radiusX, radiusY)
  };
  // Explicit geometric eye/mouth exclusion zones; these do not identify
  // makeup or shadows. Reviewers must add non-geometric exclusions separately.
  const exclusionPolygons = [
    rect(eyes[0].x - radiusX, eyesY - radiusY, eyes[1].x + radiusX, eyesY + radiusY),
    rect(mouth[0].x - radiusX, mouthY - radiusY, mouth[1].x + radiusX, mouthY + radiusY)
  ];

  if (![...cheeks.leftCheek, ...cheeks.rightCheek,
    ...exclusionPolygons.flat()].every(validPoint)) {
    return hold("face_regions_out_of_bounds");
  }
  if (centerXRight - centerXLeft <= 2.5 * radiusX) {
    return hold("cheek_regions_not_separated");
  }

  return {
    schemaVersion: PERSONAL_COLOR_CHEEK_LANDMARK_PROPOSAL_VERSION,
    status: "proposal_only",
    reason: null,
    cheekPolygons: cheeks,
    exclusionPolygons,
    coordinateSpace: "original_image",
    requiresIndependentRoiReview: true,
    mayMeasureSkin: false,
    sourceImagePersisted: false
  };
}
