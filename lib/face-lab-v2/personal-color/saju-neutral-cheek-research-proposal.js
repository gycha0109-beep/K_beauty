/**
 * Face Lab cheek surface candidate v3 (research ONLY).
 *
 * Uses Saju's validated, ephemeral MediaPipe 468 frame as input, but ROI
 * morphology is entirely Face Lab-owned. This traces the interior cheek mesh
 * topology, not five horizontal strips between the face oval and the nose.
 * It is NOT photographic skin segmentation nor a basis for colour sampling.
 *
 * The vertex loops are selected from MediaPipe FACE_LANDMARKS_TESSELATION.
 * Left/right labels are sorted in image coordinates, never anatomy semantics.
 */
export const SAJU_NEUTRAL_CHEEK_RESEARCH_PROPOSAL_VERSION =
  "face-lab-cheek-mesh-surface-research-v3";

// Closed bilateral cheek surface rings. The perimeter follows mesh vertices
// adjacent to cheek and lateral nasolabial surface; no artificial rectangles.
// Keep at most 16 vertices per polygon for the bounded raster-mask contract.
export const CHEEK_SURFACE_RINGS = Object.freeze([
  Object.freeze([118,117,123,147,187,207,206,205,36,100,101]),
  Object.freeze([347,346,352,376,411,427,426,425,266,329,330])
]);
const INSET_TO_AVOID_FEATURE_BORDERS = 0.90;
const MIN_ROI_AREA_TO_FACE_BOX = 0.028;

function hold(reason) {
  return {
    schemaVersion:SAJU_NEUTRAL_CHEEK_RESEARCH_PROPOSAL_VERSION,
    status:"insufficient_evidence",reason,cheekPolygons:null,
    exclusionPolygons:null,coordinateSpace:"original_image",
    method:"mediapipe_inner_cheek_mesh_v3",
    requiresIndependentRoiReview:true,mayMeasureSkin:false,
    sourceImagePersisted:false
  };
}
function valid(p) {
  return p&&typeof p==="object"&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&
    p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1;
}
function area(points) {
  return Math.abs(points.reduce((v,p,i)=>{
    const q=points[(i+1)%points.length];
    return v+p.x*q.y-q.x*p.y;
  },0))/2;
}
function center(points) {
  return points.reduce((s,p)=>({x:s.x+p.x/points.length,
    y:s.y+p.y/points.length}),{x:0,y:0});
}
function bounds(points) {
  return {minX:Math.min(...points.map(p=>p.x)),
    maxX:Math.max(...points.map(p=>p.x)),
    minY:Math.min(...points.map(p=>p.y)),
    maxY:Math.max(...points.map(p=>p.y))};
}
function rect(x0,y0,x1,y1){
  return [{x:x0,y:y0},{x:x1,y:y0},{x:x1,y:y1},{x:x0,y:y1}];
}
export function proposeSajuNeutralCheekResearchRegions(anchor,frame) {
  if(anchor?.coordinateSpace!=="original_image"||
    anchor.anatomicalLateralityResolved!==false)return hold("image_orientation_unknown");
  if(!Array.isArray(frame)||frame.length!==468||!frame.every(valid)) {
    return hold("full_neutral_frame_required");
  }
  const {outerImageLeft,outerImageRight,nose,
    eyeImageLeft,eyeImageRight,mouthImageLeft,mouthImageRight,
    imageFaceWidth:w,eyeToMouthY:v,eyeCenterY,mouthCenterY}=anchor;
  if(![outerImageLeft,outerImageRight,nose,eyeImageLeft,eyeImageRight,
    mouthImageLeft,mouthImageRight].every(valid)||
    ![w,v,eyeCenterY,mouthCenterY].every(Number.isFinite)) {
    return hold("anchor_geometry_unavailable");
  }
  if(w<.20||v<.10||
    outerImageLeft.x>=nose.x||nose.x>=outerImageRight.x||
    (nose.x-outerImageLeft.x)/w<.32||
    (outerImageRight.x-nose.x)/w<.32||
    Math.abs(eyeImageLeft.y-eyeImageRight.y)>v*.25||
    Math.abs(mouthImageLeft.y-mouthImageRight.y)>v*.25||
    eyeCenterY>=nose.y||nose.y>=mouthCenterY) {
    return hold("pose_or_anchor_geometry_unreliable");
  }
  // Validate actual nose wings + lower eyelids for occlusion-sensitive
  // clearance. These are mesh features, not inferred bare-skin labels.
  const noseWings=[frame[98],frame[327]].sort((a,b)=>a.x-b.x);
  const lowerLids=[frame[145],frame[374]].sort((a,b)=>a.x-b.x);
  const mouthCorners=[mouthImageLeft,mouthImageRight].sort((a,b)=>a.x-b.x);
  if(noseWings[0].x>=nose.x||noseWings[1].x<=nose.x||
    lowerLids[0].y>=mouthCorners[0].y ||
    lowerLids[1].y>=mouthCorners[1].y) {
    return hold("inner_feature_order_unreliable");
  }
  const rings=CHEEK_SURFACE_RINGS.map(ids=>ids.map(i=>frame[i]));
  const ordered=rings.sort((a,b)=>center(a).x-center(b).x);
  const [leftRaw,rightRaw]=ordered;
  if(center(leftRaw).x>=nose.x||center(rightRaw).x<=nose.x) {
    return hold("cheek_mesh_side_ambiguous");
  }

  const inset=(points)=>{
    const c=center(points);
    return points.map(p=>({
      x:c.x+(p.x-c.x)*INSET_TO_AVOID_FEATURE_BORDERS,
      y:c.y+(p.y-c.y)*INSET_TO_AVOID_FEATURE_BORDERS
    }));
  };
  const left=inset(leftRaw),right=inset(rightRaw);
  const a=bounds(left),b=bounds(right);
  if(![...left,...right].every(valid)||
    area(left)<MIN_ROI_AREA_TO_FACE_BOX*w*v||
    area(right)<MIN_ROI_AREA_TO_FACE_BOX*w*v ||
    a.maxX>=b.minX||
    // Avoid eyes, nose alae and mouth while remaining conservative.
    a.minY<=lowerLids[0].y+v*.07||
    b.minY<=lowerLids[1].y+v*.07||
    a.maxY>=mouthCorners[0].y-v*.07||
    b.maxY>=mouthCorners[1].y-v*.07||
    a.maxX>=noseWings[0].x-.025*w||
    b.minX<=noseWings[1].x+.025*w) {
    return hold("cheek_mesh_clearance_or_area_unreliable");
  }

  const eyePadX=w*.063,eyePadY=v*.135;
  const mouthPadX=w*.065,mouthPadY=v*.14;
  const wingPadX=w*.020;
  const exclusionPolygons=[
    rect(eyeImageLeft.x-eyePadX,eyeCenterY-eyePadY,
      eyeImageRight.x+eyePadX,eyeCenterY+eyePadY),
    rect(mouthCorners[0].x-mouthPadX,mouthCenterY-mouthPadY,
      mouthCorners[1].x+mouthPadX,mouthCenterY+mouthPadY),
    rect(noseWings[0].x-wingPadX,nose.y-v*.16,
      noseWings[1].x+wingPadX,nose.y+v*.35)
  ];
  if(!exclusionPolygons.every(poly=>poly.every(valid))) {
    return hold("facial_feature_exclusion_out_of_bounds");
  }
  return {
    schemaVersion:SAJU_NEUTRAL_CHEEK_RESEARCH_PROPOSAL_VERSION,
    status:"proposal_only",reason:null,
    cheekPolygons:{leftCheek:left,rightCheek:right},
    exclusionPolygons,coordinateSpace:"original_image",
    method:"mediapipe_inner_cheek_mesh_v3",
    requiresIndependentRoiReview:true,mayMeasureSkin:false,
    sourceImagePersisted:false
  };
}
