/**
 * Face Lab-owned, research-only M2 ROI search zone, NOT a skin segmentation.
 *
 * Unlike the deprecated seven-anchor ellipses, this uses the complete
 * official MediaPipe FACE_LANDMARKS_FACE_OVAL polyline and five section
 * intersections between the eyes and mouth. The Saju neutral observation
 * producer supplies the validated, ephemeral 468-point image-space frame.
 *
 * The reference region ontology in Saju MESH4/MESH5 remains an unvalidated
 * authoring artifact, not a source of anatomical ground truth. This heuristic
 * must not authorize a CIELAB sample or production photometry.
 */

export const SAJU_NEUTRAL_CHEEK_RESEARCH_PROPOSAL_VERSION =
  "face-lab-cheek-contour-section-research-v2";

// Exact order from the official MediaPipe face-landmarks connections.
// Image left/right are deliberately distinct from anatomical laterality.
// https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/tasks/web/vision/face_landmarker/face_landmarks_connections.ts
export const FACE_OVAL_INDICES = Object.freeze([
  10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,
  400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,
  54,103,67,109
]);
const ROW_POSITIONS = Object.freeze([0.25,0.38,0.51,0.65,0.79]);
const MIN_REGION_WIDTH_IN_FACE = 0.105;

function hold(reason) {
  return {
    schemaVersion: SAJU_NEUTRAL_CHEEK_RESEARCH_PROPOSAL_VERSION,
    status: "insufficient_evidence",
    reason,
    cheekPolygons: null,
    exclusionPolygons: null,
    coordinateSpace: "original_image",
    requiresIndependentRoiReview: true,
    mayMeasureSkin: false,
    sourceImagePersisted: false,
    method: "mediapipe_face_oval_scanlines_v2"
  };
}
function valid(point) {
  return point && Number.isFinite(point.x) && Number.isFinite(point.y) &&
    point.x>=0 && point.x<=1 && point.y>=0 && point.y<=1;
}
function rect(x0,y0,x1,y1) {
  return [{x:x0,y:y0},{x:x1,y:y0},{x:x1,y:y1},{x:x0,y:y1}];
}
function polygonArea(points) {
  return Math.abs(points.reduce((s,p,i)=>{
    const q=points[(i+1)%points.length];
    return s+p.x*q.y-q.x*p.y;
  },0))/2;
}
// Intersections with the closed official FACE_OVAL polyline.
// Reject any ambiguous/missing contour instead of extrapolating a face.
function faceSidesAtY(oval,y) {
  const intersections=[];
  for(let i=0;i<oval.length;i++) {
    const a=oval[i],b=oval[(i+1)%oval.length];
    if((a.y<=y&&b.y>y)||(b.y<=y&&a.y>y)) {
      intersections.push(a.x+(y-a.y)*(b.x-a.x)/(b.y-a.y));
    }
  }
  if(intersections.length!==2) return null;
  intersections.sort((a,b)=>a-b);
  return intersections;
}
export function proposeSajuNeutralCheekResearchRegions(anchor,frame) {
  if(anchor?.coordinateSpace!=="original_image" ||
      anchor.anatomicalLateralityResolved!==false) return hold("image_orientation_unknown");
  if(!Array.isArray(frame)||frame.length!==468||!frame.every(valid)) {
    return hold("full_neutral_frame_required");
  }
  const {outerImageLeft:left,outerImageRight:right,nose,
    eyeImageLeft:eyeL,eyeImageRight:eyeR,
    mouthImageLeft:mouthL,mouthImageRight:mouthR,
    imageFaceWidth:w,eyeToMouthY:v,eyeCenterY:eyeY,mouthCenterY:mouthY}=anchor;
  if(![left,right,nose,eyeL,eyeR,mouthL,mouthR].every(valid)||
      ![w,v,eyeY,mouthY].every(Number.isFinite))return hold("anchor_geometry_unavailable");
  if(w<.20||v<.10||left.x>=nose.x||nose.x>=right.x||
      eyeL.x<left.x||eyeR.x>right.x||
      Math.abs(eyeL.y-eyeR.y)>v*.25||
      Math.abs(mouthL.y-mouthR.y)>v*.25||
      eyeY>=nose.y||nose.y>=mouthY||
      (nose.x-left.x)/w<.32||(right.x-nose.x)/w<.32) {
    return hold("pose_or_anchor_geometry_unreliable");
  }
  const oval=FACE_OVAL_INDICES.map(index=>frame[index]);
  const lateralLeft=[],medialLeft=[],lateralRight=[],medialRight=[];
  for(const t of ROW_POSITIONS) {
    const y=eyeY+v*t;
    const sides=faceSidesAtY(oval,y);
    if(!sides) return hold("face_oval_section_ambiguous");
    const [edgeL,edgeR]=sides;
    if(edgeL>=nose.x-.32*w || edgeR<=nose.x+.32*w) {
      return hold("face_oval_section_too_narrow");
    }
    // Surface search band: margins avoid the silhouette/temples and the
    // central nose. It is wider and shape-adaptive, unlike the tiny circles.
    // Fractions are hypotheses for human ROI QA, not anatomical cutoffs.
    const lOuter=edgeL+.12*(nose.x-edgeL);
    const lInner=nose.x-.18*w;
    const rInner=nose.x+.18*w;
    const rOuter=edgeR-.12*(edgeR-nose.x);
    if(lInner-lOuter<MIN_REGION_WIDTH_IN_FACE*w||
       rOuter-rInner<MIN_REGION_WIDTH_IN_FACE*w) {
      return hold("face_oval_search_band_too_narrow");
    }
    lateralLeft.push({x:lOuter,y});
    medialLeft.push({x:lInner,y});
    medialRight.push({x:rInner,y});
    lateralRight.push({x:rOuter,y});
  }
  const cheekPolygons={
    leftCheek:[...lateralLeft,...medialLeft.reverse()],
    rightCheek:[...medialRight,...lateralRight.reverse()]
  };
  const radius=w*.075;
  const exclusionPolygons=[
    rect(eyeL.x-radius,eyeY-v*.15,eyeR.x+radius,eyeY+v*.15),
    rect(mouthL.x-radius,mouthY-v*.15,mouthR.x+radius,mouthY+v*.15)
  ];
  const polygons=[...Object.values(cheekPolygons),...exclusionPolygons];
  if(!polygons.every(p=>p.every(valid)))return hold("face_search_band_out_of_bounds");
  if(polygonArea(cheekPolygons.leftCheek)<w*v*.07||
     polygonArea(cheekPolygons.rightCheek)<w*v*.07) {
    return hold("face_search_band_area_insufficient");
  }
  return {
    schemaVersion:SAJU_NEUTRAL_CHEEK_RESEARCH_PROPOSAL_VERSION,
    status:"proposal_only",
    reason:null,
    cheekPolygons,exclusionPolygons,
    coordinateSpace:"original_image",
    method:"mediapipe_face_oval_scanlines_v2",
    requiresIndependentRoiReview:true,
    mayMeasureSkin:false,
    sourceImagePersisted:false
  };
}
