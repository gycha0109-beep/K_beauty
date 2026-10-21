import { proposePersonalColorCheekRegions } from "./cheek-landmark-proposal.js";
import { buildPersonalColorCheekMasks } from "./cheek-mask-geometry.js";
import { measurePersonalColorPhotoLab } from "./photo-lab-sampling.js";

// Research-only integration. Landmarks are externally supplied. This module
// does NOT detect faces, verify skin, estimate lighting or validate a reviewer.
export const PERSONAL_COLOR_REVIEWED_ROI_VERSION =
  "face-lab-personal-color-reviewed-roi-sampling-v1";

const REVIEW_FIELDS = [
  "skinRoi", "exclusions", "illumination", "orientation"
];
const REVIEW_REQUIRED = Object.freeze({
  skinRoi: "independently_approved",
  exclusions: "independently_approved",
  illumination: "independently_verified_stable",
  orientation: "original_image_verified"
});

function held(reason) {
  return {
    schemaVersion: PERSONAL_COLOR_REVIEWED_ROI_VERSION,
    status: "insufficient_evidence",
    reason,
    geometryStatus: null,
    measurement: null,
    seasonCandidate: null,
    undertone: null,
    suitability: null,
    sourceImagePersisted: false
  };
}

function validReview(review) {
  if (!review || Object.getPrototypeOf(review) !== Object.prototype ||
    Object.keys(review).length !== REVIEW_FIELDS.length) return false;
  return REVIEW_FIELDS.every((key) =>
    Object.hasOwn(review, key) && review[key] === REVIEW_REQUIRED[key]
  );
}

/**
 * Explicitly reviewed research sampling bridge:
 * externally supplied original-image FaceMesh landmarks -> proposal-only
 * polygons -> reviewed exclusions -> transient mask -> appearance-only Lab.
 *
 * No automatic approval is inferred from a FaceMesh polygon. All review
 * fields are externally asserted, not verified by this function. Even when
 * passed, a result is pixel measurement ONLY, never true skin tone.
 * No files, provider, network, storage or user-facing color suggestion.
 */
export function measurePersonalColorReviewedCheekRoi({
  observation,
  width, height, rgba,
  faceLandmarks, faceCount,
  coordinateSpace = "unknown",
  additionalExclusionPolygons,
  independentReview
} = {}) {
  // Fail before processing pixels/geometry on unverified skin/light status.
  if (!validReview(independentReview)) {
    return held("independent_photo_review_required");
  }
  if (!Array.isArray(additionalExclusionPolygons) ||
      additionalExclusionPolygons.length === 0) {
    return held("independent_exclusion_geometry_required");
  }
  const proposal = proposePersonalColorCheekRegions({
    faceLandmarks, faceCount, coordinateSpace
  });
  if (proposal.status !== "proposal_only" ||
    proposal.requiresIndependentRoiReview !== true ||
    proposal.mayMeasureSkin !== false) {
    return held(proposal.reason || "cheek_geometry_proposal_unavailable");
  }
  const geometry = buildPersonalColorCheekMasks({
    width, height,
    cheekPolygons: proposal.cheekPolygons,
    exclusionPolygons: [
      ...proposal.exclusionPolygons, ...additionalExclusionPolygons
    ]
  });
  if (geometry.status !== "masks_ready") {
    return held(geometry.reason || "skin_masks_not_ready");
  }
  const measurement = measurePersonalColorPhotoLab({
    observation, width, height, rgba,
    skinRegionMasks: geometry.skinRegionMasks,
    exclusionMask: geometry.exclusionMask
  });
  if (measurement.status !== "measurement_only") {
    return held(measurement.reason || "photo_quality_or_pixels_insufficient");
  }
  return {
    schemaVersion: PERSONAL_COLOR_REVIEWED_ROI_VERSION,
    status: "measurement_only",
    reason: null,
    geometryStatus: "reviewed_geometry_from_landmark_proposal",
    measurement,
    seasonCandidate: null,
    undertone: null,
    suitability: null,
    sourceImagePersisted: false
  };
}
