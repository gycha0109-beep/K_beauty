/**
 * Saju-owned, product-neutral, opt-in **research** observation contract.
 * Does not load a model, authenticate a provider, preserve photos, identify
 * anatomy, infer skin colour, or grant production activation.
 *
 * The geometry callback is synchronous and transient. Consumers MUST NOT
 * persist, log, upload, or store the frame or its points.
 */
export const NEUTRAL_FACE_OBSERVATION_VERSION = "myeongha-neutral-face-observation-v0.1.0-research.0";
export const NEUTRAL_FACE_PROVIDER_TOPOLOGIES = Object.freeze([468, 478]);
const GEOMETRY_POINTS = 468;
const ANCHORS = Object.freeze({
  outerA: 234, outerB: 454, nose: 1,
  eyeA: 33, eyeB: 263, mouthA: 61, mouthB: 291
});
function hold(reason) {
  return {
    schemaVersion: NEUTRAL_FACE_OBSERVATION_VERSION,
    status: "insufficient_evidence",
    reason,
    coordinateSpace: "original_image",
    geometryLandmarkCount: null,
    providerLandmarkCount: null,
    anatomicalLateralityResolved: false,
    productionAuthorized: false,
    providerRunPersisted: false,
    sourceImagePersisted: false,
    faceLandmarksPersisted: false,
    skinSegmentationVerified: false
  };
}
function normalized(point) {
  if (!point || typeof point !== "object" || Array.isArray(point) ||
      !Number.isFinite(point.x) || point.x < 0 || point.x > 1 ||
      !Number.isFinite(point.y) || point.y < 0 || point.y > 1 ||
      !Number.isFinite(point.z)) return null;
  return Object.freeze({x: point.x, y: point.y});
}
function anchorGeometry(frame) {
  const points = Object.fromEntries(Object.entries(ANCHORS).map(
    ([key,index])=>[key,frame[index]]
  ));
  const faces = [points.outerA, points.outerB].sort((a,b)=>a.x-b.x);
  const eyes = [points.eyeA, points.eyeB].sort((a,b)=>a.x-b.x);
  const mouth = [points.mouthA, points.mouthB].sort((a,b)=>a.x-b.x);
  const imageFaceWidth = faces[1].x - faces[0].x;
  const eyeCenterY = (eyes[0].y + eyes[1].y) / 2;
  const mouthCenterY = (mouth[0].y + mouth[1].y) / 2;
  return Object.freeze({
    // Image-space, not anatomical left/right or independently verified
    // zygion; this is a geometric face-span *proxy* only.
    outerImageLeft: faces[0],
    outerImageRight: faces[1],
    eyeImageLeft: eyes[0],
    eyeImageRight: eyes[1],
    mouthImageLeft: mouth[0],
    mouthImageRight: mouth[1],
    nose: points.nose,
    imageFaceWidth,
    eyeCenterY,
    mouthCenterY,
    eyeToMouthY: mouthCenterY-eyeCenterY,
    coordinateSpace: "original_image",
    anatomicalLateralityResolved: false
  });
}
/**
 * Validate the *full* provider result. Iris points (indices 468-477) are
 * verified then discarded; unneeded z/visibility/provider metadata discarded.
 * Callback receives the frozen 468-point frame and neutral anchor geometry.
 * The returned receipt contains no personal geometry.
 */
export function consumeNeutralFaceObservation({
  faceLandmarks,
  faceCount,
  coordinateSpace = "unknown",
  onFrame
} = {}) {
  if (coordinateSpace !== "original_image") return hold("image_orientation_unknown");
  if (faceCount !== 1 || !Array.isArray(faceLandmarks)) return hold("single_face_landmarks_unavailable");
  if (!NEUTRAL_FACE_PROVIDER_TOPOLOGIES.includes(faceLandmarks.length)) return hold("unsupported_provider_topology");
  if (typeof onFrame !== "function") return hold("neutral_consumer_required");
  const frame = [];
  for (let i=0; i<faceLandmarks.length; i++) {
    const point = normalized(faceLandmarks[i]);
    if (!point) return hold("neutral_landmarks_invalid");
    if (i<GEOMETRY_POINTS) frame.push(point);
  }
  const frozenFrame = Object.freeze(frame);
  const geometry = anchorGeometry(frozenFrame);
  try {
    onFrame(Object.freeze({
      schemaVersion: NEUTRAL_FACE_OBSERVATION_VERSION,
      coordinateSpace: "original_image",
      frame: frozenFrame,
      anchorGeometry: geometry,
      anatomicalLateralityResolved: false,
      productionAuthorized: false
    }));
  } catch {
    return hold("neutral_consumer_failed");
  }
  return {
    schemaVersion: NEUTRAL_FACE_OBSERVATION_VERSION,
    status: "candidate_only",
    reason: null,
    coordinateSpace: "original_image",
    providerLandmarkCount: faceLandmarks.length,
    geometryLandmarkCount: GEOMETRY_POINTS,
    anatomicalLateralityResolved: false,
    productionAuthorized: false,
    providerRunPersisted: false,
    sourceImagePersisted: false,
    faceLandmarksPersisted: false,
    skinSegmentationVerified: false
  };
}
