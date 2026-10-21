import { consumeNeutralFaceObservation } from "@myeongha/neutral-face-observation";
import { proposeSajuNeutralCheekResearchRegions } from "./saju-neutral-cheek-research-proposal.js";
import { proposePersonalColorCheekRegions } from "./cheek-landmark-proposal.js";
import { buildPersonalColorCheekMasks } from "./cheek-mask-geometry.js";

// Same-image, single-detector A/B test: legacy Face Lab ROI algorithm vs an
// independent experimental algorithm using the Saju neutral core package.
// This is NOT human-reviewed skin accuracy, validation of anatomy or a
// second independent detector.
export const SHARED_CORE_ROI_PARITY_VERSION = "face-lab-shared-core-roi-parity-v1";
const MAX_SOURCE_PIXELS = 32 * 1024 * 1024;
const MAX_MASK_PIXELS = 1024 * 1024;

function hold(reason) {
  return {
    schemaVersion: SHARED_CORE_ROI_PARITY_VERSION,
    status: "insufficient_evidence",
    reason,
    parity: null,
    productionAuthorized: false,
    skinMeasurement: null,
    sourceImagePersisted: false,
    faceLandmarksPersisted: false
  };
}

function dimensions(width, height) {
  const scale = Math.min(1, Math.sqrt(MAX_MASK_PIXELS / (width * height)));
  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale))
  };
}

function roiMasks(proposal, size) {
  if (proposal?.status !== "proposal_only" ||
      proposal.requiresIndependentRoiReview !== true ||
      proposal.mayMeasureSkin !== false) return null;
  const mask = buildPersonalColorCheekMasks({
    ...size,
    cheekPolygons: proposal.cheekPolygons,
    exclusionPolygons: proposal.exclusionPolygons
  });
  return mask.status === "masks_ready" ? mask : null;
}

function maskStats(first, second, firstExclusion, secondExclusion) {
  let intersection = 0;
  let union = 0;
  let firstCount = 0;
  let secondCount = 0;
  for (let i = 0; i < first.length; i++) {
    const a = first[i] === 1 && firstExclusion[i] === 0;
    const b = second[i] === 1 && secondExclusion[i] === 0;
    if (a && b) intersection++;
    if (a || b) union++;
    if (a) firstCount++;
    if (b) secondCount++;
  }
  return {
    samePixels: firstCount === secondCount && intersection === union,
    intersectionPixels: intersection,
    unionPixels: union,
    baselinePixels: firstCount,
    candidatePixels: secondCount,
    iou: union ? Math.round(1000000 * intersection / union) / 1000000 : null
  };
}

/**
 * Run the legacy 7-anchor proposal and the neutral-frame adapter proposal
 * on the SAME provider result. No second MediaPipe load or inference.
 * Return bounded aggregate parity only; keep pixels/landmarks in scope.
 */
export function compareSharedNeutralFaceCoreRoiParity({
  faceLandmarks,
  faceCount,
  coordinateSpace = "unknown",
  width,
  height
} = {}) {
  if (coordinateSpace !== "original_image") return hold("image_orientation_unknown");
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
      width <= 0 || height <= 0 || width > 8192 || height > 8192 ||
      width * height > MAX_SOURCE_PIXELS) return hold("invalid_image_dimensions");

  const baseline = proposePersonalColorCheekRegions({
    faceLandmarks, faceCount, coordinateSpace
  });
  let candidate = null;
  const inspected = consumeNeutralFaceObservation({
    faceLandmarks, faceCount, coordinateSpace,
    onFrame({anchorGeometry}) {
      candidate = proposeSajuNeutralCheekResearchRegions(anchorGeometry);
    }
  });
  if (inspected.status !== "candidate_only") return hold(inspected.reason);
  const size = dimensions(width, height);
  const first = roiMasks(baseline, size);
  const second = roiMasks(candidate, size);
  if (!first || !second) return hold("roi_not_comparable");

  const leftCheek = maskStats(
    first.skinRegionMasks.leftCheek, second.skinRegionMasks.leftCheek,
    first.exclusionMask, second.exclusionMask
  );
  const rightCheek = maskStats(
    first.skinRegionMasks.rightCheek, second.skinRegionMasks.rightCheek,
    first.exclusionMask, second.exclusionMask
  );
  const exclusion = maskStats(
    first.exclusionMask, second.exclusionMask,
    new Uint8Array(first.exclusionMask.length),
    new Uint8Array(second.exclusionMask.length)
  );
  const matched = leftCheek.samePixels && rightCheek.samePixels && exclusion.samePixels;
  return {
    schemaVersion: SHARED_CORE_ROI_PARITY_VERSION,
    status: "comparison_only",
    reason: null,
    parity: matched ? "matched" : "diverged",
    reference: "same_detector_different_research_roi_algorithms_not_human_accuracy",
    neutralCoreVersion: inspected.schemaVersion,
    providerLandmarkCount: inspected.providerLandmarkCount,
    geometryLandmarkCount: inspected.geometryLandmarkCount,
    maskDimensions: size,
    metrics: { leftCheek, rightCheek, exclusion },
    independentlyReviewedSkin: false,
    productionAuthorized: false,
    skinMeasurement: null,
    sourceImagePersisted: false,
    faceLandmarksPersisted: false
  };
}
