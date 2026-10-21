import { buildPersonalColorCheekMasks } from "./cheek-mask-geometry.js";

/**
 * The trusted detector callback emits a geometry-only view, not the full
 * proposal contract; the Saju callback emits the validated research
 * proposal. Validate both through the same raster mask builder.
 *
 * These masks are visualization-only. Never authorize skin sampling.
 */
export function buildRoiPreviewMasks({baseline,candidate,size}={}) {
  if(!baseline?.cheekPolygons?.leftCheek ||
     !baseline?.cheekPolygons?.rightCheek ||
     !Array.isArray(baseline?.exclusionPolygons) ||
     !candidate?.cheekPolygons?.leftCheek ||
     !candidate?.cheekPolygons?.rightCheek ||
     !Array.isArray(candidate?.exclusionPolygons) ||
     candidate.status!=="proposal_only" ||
     candidate.requiresIndependentRoiReview!==true ||
     candidate.mayMeasureSkin!==false) {
    return {status:"insufficient_evidence",reason:"roi_preview_geometry_missing"};
  }
  const first=buildPersonalColorCheekMasks({
    ...size, cheekPolygons:baseline.cheekPolygons,
    exclusionPolygons:baseline.exclusionPolygons
  });
  const second=buildPersonalColorCheekMasks({
    ...size, cheekPolygons:candidate.cheekPolygons,
    exclusionPolygons:candidate.exclusionPolygons
  });
  if(first.status!=="masks_ready"||second.status!=="masks_ready") {
    return {status:"insufficient_evidence",
      reason:first.status!=="masks_ready"?(first.reason||"baseline_mask_invalid"):
        (second.reason||"research_mask_invalid")};
  }
  return {status:"preview_only",baseline:first,candidate:second,
    skinMeasurementAuthorized:false,skinAccuracyVerified:false};
}
