// Research-only independent Face Lab ROI proposal that consumes the Saju
// product-neutral anchor geometry. It is intentionally NOT the legacy
// proposePersonalColorCheekRegions algorithm. Neither is verified skin.
export const SAJU_NEUTRAL_CHEEK_RESEARCH_PROPOSAL_VERSION =
  "face-lab-saju-neutral-cheek-research-v1";

function hold(reason) {
  return {
    schemaVersion: SAJU_NEUTRAL_CHEEK_RESEARCH_PROPOSAL_VERSION,
    status: "insufficient_evidence",
    reason,
    cheekPolygons: null,
    exclusionPolygons: null,
    requiresIndependentRoiReview: true,
    mayMeasureSkin: false,
    sourceImagePersisted: false
  };
}
function ellipse(cx, cy, rx, ry) {
  return Array.from({length:16}, (_,i) => {
    const t=2*Math.PI*i/16;
    return {x:cx+rx*Math.cos(t),y:cy+ry*Math.sin(t)};
  });
}
function rect(x0,y0,x1,y1) {
  return [{x:x0,y:y0},{x:x1,y:y0},{x:x1,y:y1},{x:x0,y:y1}];
}
function bounded(polygons) {
  return polygons.every(poly=>poly.every(pt=>
    Number.isFinite(pt.x)&&Number.isFinite(pt.y)&&
    pt.x>=0&&pt.x<=1&&pt.y>=0&&pt.y<=1
  ));
}
/**
 * Geometry-only experimental mask candidate. Saju provides image-space
 * feature anchors; Face Lab exclusively owns cheek ROI morphology and
 * exclusion placement. Must never be used for colour sampling by itself.
 *
 * Deliberately independent: 16 vertices, eye-to-mouth y=0.52, width radius
 * 0.070, height radius 0.160, and 0.43 outer-face interpolation.
 * Baseline uses 12 / 0.55 / 0.075 / 0.180 / 0.46 respectively.
 * These are research parameters, not evidence-based anatomical thresholds.
 */
export function proposeSajuNeutralCheekResearchRegions(anchor) {
  if(!anchor||anchor.coordinateSpace!=="original_image" ||
    anchor.anatomicalLateralityResolved!==false) return hold("image_orientation_unknown");
  const {outerImageLeft:left,outerImageRight:right,nose,
    eyeImageLeft:eyeL,eyeImageRight:eyeR,
    mouthImageLeft:mouthL,mouthImageRight:mouthR,
    imageFaceWidth:w,eyeToMouthY:v,eyeCenterY:eyeY,mouthCenterY:mouthY}=anchor;
  if(![left,right,nose,eyeL,eyeR,mouthL,mouthR].every(p=>
    p&&Number.isFinite(p.x)&&Number.isFinite(p.y)
  )||![w,v,eyeY,mouthY].every(Number.isFinite)) return hold("anchor_geometry_unavailable");
  if(w<.20||v<.10||left.x>=nose.x||nose.x>=right.x||
    eyeL.x<left.x||eyeR.x>right.x||
    Math.abs(eyeL.y-eyeR.y)>v*.25 ||
    Math.abs(mouthL.y-mouthR.y)>v*.25||
    eyeY>=nose.y||nose.y>=mouthY||
    (nose.x-left.x)/w<.32||(right.x-nose.x)/w<.32
  ) return hold("face_geometry_unreliable");
  const rx=w*.070,ry=v*.160,cy=eyeY+v*.52;
  const lcx=left.x*.43+nose.x*.57;
  const rcx=right.x*.43+nose.x*.57;
  if(rcx-lcx <=2.5*rx) return hold("cheek_regions_not_separated");
  const cheekPolygons={
    leftCheek:ellipse(lcx,cy,rx,ry),
    rightCheek:ellipse(rcx,cy,rx,ry)
  };
  const exclusionPolygons=[
    rect(eyeL.x-rx,eyeY-ry,eyeR.x+rx,eyeY+ry),
    rect(mouthL.x-rx,mouthY-ry,mouthR.x+rx,mouthY+ry)
  ];
  if(!bounded([...Object.values(cheekPolygons),...exclusionPolygons]))return hold("face_regions_out_of_bounds");
  return {
    schemaVersion:SAJU_NEUTRAL_CHEEK_RESEARCH_PROPOSAL_VERSION,
    status:"proposal_only",
    reason:null,
    cheekPolygons,exclusionPolygons,
    coordinateSpace:"original_image",
    requiresIndependentRoiReview:true,
    mayMeasureSkin:false,
    sourceImagePersisted:false
  };
}
