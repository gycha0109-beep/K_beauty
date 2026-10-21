import { buildPersonalColorCheekMasks } from "./cheek-mask-geometry.js";

export const PERSONAL_COLOR_ROI_REVIEW_VERSION =
  "face-lab-personal-color-roi-review-evaluation-v1";

function held(reason) {
  return {
    schemaVersion: PERSONAL_COLOR_ROI_REVIEW_VERSION,
    status: "insufficient_evidence",
    reason,
    comparison: null,
    roiAccuracyApproved: false,
    bareSkinVerifiedBySoftware: false,
    faceLandmarksPersisted: false,
    sourceImagePersisted: false
  };
}

function validMask(mask, pixels) {
  if (!(mask instanceof Uint8Array || mask instanceof Uint8ClampedArray) ||
      mask.length !== pixels) return false;
  for (const bit of mask) if (bit !== 0 && bit !== 1) return false;
  return true;
}

function rounded(v) {
  return Math.round(v * 10000) / 10000;
}

/**
 * Score a geometry-only MediaPipe cheek proposal against independently
 * reviewed image-left / image-right binary masks in the same coordinate
 * system. Reviewer masks MUST NOT be derived from the candidate proposal;
 * this function cannot attest to that independence.
 *
 * Never sets a pass/fail threshold, skin eligibility or product authority.
 * No source image, identity, landmarks, mask or polygon is returned.
 */
export function compareCheekRoiProposalToReview({
  width, height, cheekPolygons, exclusionPolygons,
  independentlyReviewedSkinMasks, reviewProvenance,
  coordinateSpace = "unknown"
} = {}) {
  if (reviewProvenance !== "independent_manual_review") {
    return held("independent_reference_review_required");
  }
  if (coordinateSpace !== "original_image") {
    return held("image_orientation_unknown");
  }
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
      width <= 0 || height <= 0 || width * height > 1024 * 1024) {
    return held("invalid_pixel_dimensions");
  }
  const pixels = width * height;
  const left = independentlyReviewedSkinMasks?.leftCheek;
  const right = independentlyReviewedSkinMasks?.rightCheek;
  if (!validMask(left, pixels) || !validMask(right, pixels)) {
    return held("independent_reference_masks_invalid");
  }

  let leftReferenceCount = 0, rightReferenceCount = 0;
  for (let i = 0; i < pixels; i++) {
    if (left[i] && right[i]) return held("overlapping_reference_cheeks");
    leftReferenceCount += left[i];
    rightReferenceCount += right[i];
  }
  if (leftReferenceCount < 16 || rightReferenceCount < 16) {
    return held("insufficient_reference_pixels");
  }
  const candidate = buildPersonalColorCheekMasks({
    width, height, cheekPolygons, exclusionPolygons
  });
  if (candidate.status !== "masks_ready") {
    return held(candidate.reason || "candidate_geometry_not_ready");
  }

  const comparison = {};
  for (const region of ["leftCheek", "rightCheek"]) {
    const reference = independentlyReviewedSkinMasks[region];
    const proposed = candidate.skinRegionMasks[region];
    let intersection = 0;
    let union = 0;
    let referencePixels = 0;
    let candidatePixels = 0;
    for (let i = 0; i < pixels; i++) {
      const isCandidate = proposed[i] === 1 && candidate.exclusionMask[i] === 0;
      const isReference = reference[i] === 1;
      if (isCandidate && isReference) intersection++;
      if (isCandidate || isReference) union++;
      if (isCandidate) candidatePixels++;
      if (isReference) referencePixels++;
    }
    comparison[region] = {
      candidatePixels, referencePixels,
      intersectionPixels: intersection,
      iou: rounded(intersection / union),
      precision: rounded(intersection / candidatePixels),
      recall: rounded(intersection / referencePixels)
    };
  }

  return {
    schemaVersion: PERSONAL_COLOR_ROI_REVIEW_VERSION,
    status: "evaluation_only",
    reason: null,
    comparison,
    roiAccuracyApproved: false,
    bareSkinVerifiedBySoftware: false,
    faceLandmarksPersisted: false,
    sourceImagePersisted: false
  };
}
