import assert from "node:assert/strict";
import { benchmarkCheekRoiCandidatesAgainstReview } from "../lib/face-lab-v2/personal-color/independent-cheek-roi-benchmark.js";

const width=128,height=128;
const faceLandmarks=Array.from({length:478},()=>({x:.5,y:.5,z:0}));
for(const [index,[x,y]] of Object.entries({
  234:[.2,.5],454:[.8,.5],1:[.5,.48],33:[.35,.32],
  263:[.65,.32],61:[.4,.68],291:[.6,.68]
}))faceLandmarks[Number(index)]={x,y,z:0};

// This is a SYNTHETIC rectangle reference, defined independently from
// both algorithms; it is NOT a human annotation or real validation sample.
function referenceRect(x0,x1,y0,y1){
  const m=new Uint8Array(width*height);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const u=(x+.5)/width,v=(y+.5)/height;
    if(u>=x0&&u<x1&&v>=y0&&v<y1)m[y*width+x]=1;
  }
  return m;
}
const independent={
  leftCheek:referenceRect(.27,.45,.42,.63),
  rightCheek:referenceRect(.55,.73,.42,.63)
};
const common={
  faceLandmarks,faceCount:1,coordinateSpace:"original_image",
  width,height,reviewProvenance:"independent_manual_review",
  independentlyReviewedSkinMasks:independent
};
const source=JSON.stringify(faceLandmarks);
const a=benchmarkCheekRoiCandidatesAgainstReview(common);
assert.equal(a.status,"evaluation_only",JSON.stringify(a));
assert.equal(a.referenceIndependenceExternallyAudited,false);
assert.equal(a.roiAccuracyApproved,false);
assert.equal(a.productionAuthorized,false);
assert.equal(a.sourceImagePersisted,false);
assert.equal(a.faceLandmarksPersisted,false);
for(const cheek of ["leftCheek","rightCheek"]){
  const baseline=a.comparisons.legacy[cheek];
  const experiment=a.comparisons.sajuNeutralResearch[cheek];
  assert.ok(baseline.iou>0&&baseline.iou<=1);
  assert.ok(experiment.iou>0&&experiment.iou<=1);
  assert.equal(baseline.referencePixels,experiment.referencePixels);
  assert.equal(a.differences[cheek].iou,
    Math.round((experiment.iou-baseline.iou)*10000)/10000);
}
assert.ok(["leftCheek","rightCheek"].some(cheek=>
  a.comparisons.legacy[cheek].candidatePixels!==a.comparisons.sajuNeutralResearch[cheek].candidatePixels
));
assert.deepEqual(benchmarkCheekRoiCandidatesAgainstReview(common),a);
assert.equal(JSON.stringify(faceLandmarks),source);

function held(overrides,reason){
  const r=benchmarkCheekRoiCandidatesAgainstReview({...common,...overrides});
  assert.equal(r.status,"insufficient_evidence",JSON.stringify(r));
  assert.equal(r.reason,reason);
  assert.equal(r.comparisons,null);
  assert.equal(r.productionAuthorized,false);
  return r;
}
held({reviewProvenance:"auto_generated"},"independent_reference_review_required");
held({coordinateSpace:"mirrored_preview"},"image_orientation_unknown");
held({faceCount:2},"single_face_landmarks_unavailable");
held({faceLandmarks:faceLandmarks.slice(0,469)},"unsupported_provider_topology");
held({width:0},"invalid_pixel_dimensions");
held({independentlyReviewedSkinMasks:null},"independent_reference_masks_invalid");
held({independentlyReviewedSkinMasks:{
  leftCheek:independent.leftCheek,
  rightCheek:Uint8Array.from(independent.leftCheek)
}},"overlapping_reference_cheeks");
const bad=structuredClone(faceLandmarks);
bad[301].x=NaN;
held({faceLandmarks:bad},"neutral_landmarks_invalid");
const serialized=JSON.stringify(a);
for(const phrase of ['"faceLandmarks":','"cheekPolygons":','"independentlyReviewedSkinMasks":','"skinRegionMasks":','"sourceImage":']){
  assert.equal(serialized.includes(phrase),false);
}
console.log(JSON.stringify({
  ok:true,
  suite:"face_lab_saju_neutral_dual_roi_independent_review_protocol",
  studyType:"synthetic_geometry_fixture_only",
  maskComparisons:true,
  independentHumanReviewCompleted:false,
  realPhotoEvaluated:false,
  productionActivated:false
}));
