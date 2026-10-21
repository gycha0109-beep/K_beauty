/**
 * Candidate neutral observation contract shared in principle with Saju FR61/
 * MyeongHa FE035B. This is NOT an import of either package or a production
 * bridge. The callback is synchronous, ephemeral and restricted to research.
 *
 * MediaPipe provider index order is preserved without asserting anatomy.
 * Coordinates mean unmirrored, EXIF-oriented image coordinates, not CSS
 * preview coordinates or pose-normalized metric 3D.
 */
export const SHARED_NEUTRAL_FACE_CORE_CANDIDATE_VERSION =
  "shared-neutral-face-core-candidate-v1";

const PROVIDER_COUNTS = new Set([468, 478]);
const GEOMETRY_COUNT = 468;

function held(reason) {
  return {
    schemaVersion: SHARED_NEUTRAL_FACE_CORE_CANDIDATE_VERSION,
    status: "insufficient_evidence",
    reason,
    coordinateSpace: "original_image",
    providerLandmarkCount: null,
    geometryLandmarkCount: null,
    semanticSideAuthority: false,
    productionAuthorized: false,
    independentlyReviewedSkin: false,
    sourceImagePersisted: false,
    faceLandmarksPersisted: false
  };
}

function sanitized(point) {
  if (!point || typeof point !== "object" || Array.isArray(point) ||
      !Number.isFinite(point.x) || point.x < 0 || point.x > 1 ||
      !Number.isFinite(point.y) || point.y < 0 || point.y > 1 ||
      !Number.isFinite(point.z)) return null;
  // Depth, visibility, blendshapes and provider metadata are not needed by
  // the photo ROI bridge. Do not smuggle them into the neutral 2D frame.
  return Object.freeze({ x: point.x, y: point.y });
}

/**
 * Validate the complete MediaPipe observation (468/478), not only the seven
 * landmark anchors read by the legacy Face Lab ROI proposal.
 *
 * onFrame receives a transient frozen, provider-ordered 468-point 2D view.
 * Do not store/copy it or forward it to saved reports, loggers, analytics,
 * UI callback payloads or a network request. The returned receipt contains
 * no landmark, image, crop, provider trace or skin mask.
 */
export function inspectSharedNeutralFaceCoreCandidate({
  faceLandmarks,
  faceCount,
  coordinateSpace = "unknown",
  onFrame
} = {}) {
  if (coordinateSpace !== "original_image") return held("image_orientation_unknown");
  if (faceCount !== 1 || !Array.isArray(faceLandmarks)) {
    return held("single_face_landmarks_unavailable");
  }
  if (!PROVIDER_COUNTS.has(faceLandmarks.length)) {
    return held("unsupported_provider_topology");
  }
  if (typeof onFrame !== "function") return held("neutral_consumer_required");

  const frame = [];
  for (let i = 0; i < faceLandmarks.length; i++) {
    const point = sanitized(faceLandmarks[i]);
    if (!point) return held("neutral_landmarks_invalid");
    if (i < GEOMETRY_COUNT) frame.push(point);
  }
  const frozenFrame = Object.freeze(frame);
  try {
    onFrame(Object.freeze({
      coordinateSpace: "original_image",
      semanticSideAuthority: false,
      geometryLandmarkCount: GEOMETRY_COUNT,
      landmarks: frozenFrame
    }));
  } catch {
    return held("neutral_consumer_failed");
  }
  return {
    schemaVersion: SHARED_NEUTRAL_FACE_CORE_CANDIDATE_VERSION,
    status: "candidate_only",
    reason: null,
    coordinateSpace: "original_image",
    providerLandmarkCount: faceLandmarks.length,
    geometryLandmarkCount: GEOMETRY_COUNT,
    semanticSideAuthority: false,
    productionAuthorized: false,
    independentlyReviewedSkin: false,
    sourceImagePersisted: false,
    faceLandmarksPersisted: false
  };
}
