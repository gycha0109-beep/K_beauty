import { consumeNeutralFaceObservation } from "@myeongha/neutral-face-observation";
import { proposePersonalColorCheekRegions } from "./cheek-landmark-proposal.js";
import { proposeSajuNeutralCheekResearchRegions } from "./saju-neutral-cheek-research-proposal.js";
import { compareCheekRoiProposalToReview } from "./roi-review-evaluation.js";

export const INDEPENDENT_CHEEK_ROI_BENCHMARK_VERSION =
  "face-lab-independent-cheek-roi-a-b-benchmark-v1";

function hold(reason) {
  return {
    schemaVersion: INDEPENDENT_CHEEK_ROI_BENCHMARK_VERSION,
    status: "insufficient_evidence",
    reason,
    comparisons: null,
    differences: null,
    referenceIndependenceExternallyAudited: false,
    roiAccuracyApproved: false,
    productionAuthorized: false,
    sourceImagePersisted: false,
    faceLandmarksPersisted: false
  };
}
function score(proposal, reference) {
  if (proposal?.status !== "proposal_only" ||
      proposal.requiresIndependentRoiReview !== true ||
      proposal.mayMeasureSkin !== false) return null;
  return compareCheekRoiProposalToReview({
    ...reference,
    cheekPolygons: proposal.cheekPolygons,
    exclusionPolygons: proposal.exclusionPolygons
  });
}
function rounded(value) { return Math.round(value * 10000) / 10000; }

/**
 * Offline comparison to caller-provided, independently annotated **image**
 * masks. Does not run MediaPipe, open photos, or persist biometrics.
 *
 * Provenance is asserted by the caller, NOT independently established by
 * software. Never infer product readiness, absolute ROI accuracy, skin
 * identity, user diagnosis, or the superior model from these numbers alone.
 */
export function benchmarkCheekRoiCandidatesAgainstReview({
  faceLandmarks,
  faceCount,
  coordinateSpace = "unknown",
  width,
  height,
  independentlyReviewedSkinMasks,
  reviewProvenance
} = {}) {
  if (reviewProvenance !== "independent_manual_review") {
    return hold("independent_reference_review_required");
  }
  if (coordinateSpace !== "original_image") return hold("image_orientation_unknown");
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
      width <= 0 || height <= 0 || width * height > 1024 * 1024) {
    return hold("invalid_pixel_dimensions");
  }

  // Do not create a candidate if a neutral observation cannot be issued.
  let experimental;
  const neutral = consumeNeutralFaceObservation({
    faceLandmarks, faceCount, coordinateSpace,
    onFrame({anchorGeometry}) {
      experimental = proposeSajuNeutralCheekResearchRegions(anchorGeometry);
    }
  });
  if (neutral.status !== "candidate_only") return hold(neutral.reason);

  const legacy = proposePersonalColorCheekRegions({
    faceLandmarks, faceCount, coordinateSpace
  });
  const reference = {
    width, height, coordinateSpace, independentlyReviewedSkinMasks,
    reviewProvenance
  };
  const baseline = score(legacy, reference);
  const candidate = score(experimental, reference);
  if (!baseline || !candidate) return hold("roi_geometry_not_comparable");
  if (baseline.status !== "evaluation_only" || candidate.status !== "evaluation_only") {
    return hold(baseline.reason || candidate.reason || "reference_review_invalid");
  }

  const differences = {};
  for (const cheek of ["leftCheek","rightCheek"]) {
    const a=baseline.comparison[cheek];
    const b=candidate.comparison[cheek];
    differences[cheek] = Object.freeze({
      iou: rounded(b.iou-a.iou),
      precision: rounded(b.precision-a.precision),
      recall: rounded(b.recall-a.recall),
      candidatePixels: b.candidatePixels-a.candidatePixels
    });
  }
  return {
    schemaVersion: INDEPENDENT_CHEEK_ROI_BENCHMARK_VERSION,
    status: "evaluation_only",
    reason: null,
    neutralCoreVersion: neutral.schemaVersion,
    reference: "declared_independent_manual_review_not_software_attested",
    comparisons: {
      legacy: baseline.comparison,
      sajuNeutralResearch: candidate.comparison
    },
    differences,
    referenceIndependenceExternallyAudited: false,
    roiAccuracyApproved: false,
    productionAuthorized: false,
    sourceImagePersisted: false,
    faceLandmarksPersisted: false
  };
}
