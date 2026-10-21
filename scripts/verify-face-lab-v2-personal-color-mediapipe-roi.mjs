import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  detectMediaPipeCheekRoiProposal,
  PERSONAL_COLOR_MEDIAPIPE_MODEL,
  PERSONAL_COLOR_MEDIAPIPE_WASM_ROOT
} from "../lib/face-lab-v2/personal-color/mediapipe-roi-proposal.js";
import { compareCheekRoiProposalToReview } from "../lib/face-lab-v2/personal-color/roi-review-evaluation.js";

const width=128, height=128;
const faceLandmarks=Array.from({ length:478 }, ()=>({ x:0.5,y:0.5,z:0 }));
const anchors={
  234:[0.20,0.50], 454:[0.80,0.50], 1:[0.50,0.48],
  33:[0.35,0.32], 263:[0.65,0.32], 61:[0.40,0.68], 291:[0.60,0.68]
};
for(const [index,[x,y]] of Object.entries(anchors)) {
  faceLandmarks[Number(index)]={ x,y,z:0 };
}
const source=JSON.stringify(faceLandmarks);
const image={ width,height,marker:"in_memory_synthetic_non_face" };

function fakeRuntime({ faces=[faceLandmarks], fail="", calls=[] }={}) {
  return async ()=>({
    FilesetResolver:{
      async forVisionTasks(wasmRoot) {
        assert.equal(wasmRoot,PERSONAL_COLOR_MEDIAPIPE_WASM_ROOT);
        calls.push("wasm");
        if(fail==="wasm") throw Error("fake wasm failure must not leak");
        return { marker:"local_fake_fileset" };
      }
    },
    FaceLandmarker:{
      async createFromOptions(fileset,options) {
        calls.push("create");
        assert.equal(fileset.marker,"local_fake_fileset");
        assert.equal(options.baseOptions.modelAssetPath,PERSONAL_COLOR_MEDIAPIPE_MODEL);
        assert.equal(options.runningMode,"IMAGE");
        assert.equal(options.numFaces,2);
        assert.equal(options.outputFaceBlendshapes,false);
        assert.equal(options.outputFacialTransformationMatrixes,false);
        if(fail==="model") throw Error("model path must not leak");
        return {
          detect(received) {
            calls.push("detect");
            assert.equal(received,image);
            if(fail==="detect") throw Error("photo path must not leak");
            return { faceLandmarks:faces, faceBlendshapes:[{private:"never_return"}] };
          },
          close() { calls.push("close"); }
        };
      }
    }
  });
}

const calls=[];
let proposal;
const result=await detectMediaPipeCheekRoiProposal({
  image,width,height,originalImageOrientationVerified:true,
  loadVisionTasks:fakeRuntime({calls}),
  onProposal(value){ proposal=value; }
});
assert.equal(result.status,"proposal_only",JSON.stringify(result));
assert.equal(result.faceCount,1);
assert.ok(result.candidatePixels.leftCheek>=16);
assert.ok(result.candidatePixels.rightCheek>=16);
assert.equal(result.independentlyReviewedSkin,false);
assert.equal(result.skinMeasurement,null);
assert.equal(result.faceLandmarksPersisted,false);
assert.equal(result.sourceImagePersisted,false);
assert.deepEqual(calls,["wasm","create","detect","close"]);
assert.deepEqual(proposal.coordinateSpace,"original_image");
assert.equal(proposal.cheekPolygons.leftCheek.length,12);
assert.equal(proposal.cheekPolygons.rightCheek.length,12);
assert.equal(JSON.stringify(faceLandmarks),source);
assert.equal(JSON.stringify(result).includes("cheekPolygons"),false);
assert.equal(JSON.stringify(result).includes('"faceLandmarks":'),false);

async function mustHold(overrides,reason,opts={}) {
  const log=[];
  let callbackCount=0;
  const input={
    image,width,height,
    originalImageOrientationVerified:true,
    loadVisionTasks:fakeRuntime({calls:log,...opts}),
    onProposal(){callbackCount++;},
    ...overrides
  };
  const held=await detectMediaPipeCheekRoiProposal(input);
  assert.equal(held.status,"insufficient_evidence",JSON.stringify(held));
  assert.equal(held.reason,reason);
  assert.equal(held.candidatePixels,null);
  assert.equal(held.faceLandmarksPersisted,false);
  assert.equal(held.sourceImagePersisted,false);
  assert.equal(callbackCount,0);
  return log;
}
assert.deepEqual(await mustHold({originalImageOrientationVerified:false},
  "original_image_orientation_unverified"),[]);
assert.deepEqual(await mustHold({width:0},"source_image_dimensions_invalid"),[]);
assert.deepEqual(await mustHold({width:9000},"source_image_dimensions_invalid"),[]);
assert.deepEqual(await mustHold({image:null},"source_image_dimensions_invalid"),[]);
assert.deepEqual(await mustHold({},"single_face_not_detected",{faces:[]}),
  ["wasm","create","detect","close"]);
assert.deepEqual(await mustHold({},"multiple_faces_detected",{faces:[faceLandmarks,faceLandmarks]}),
  ["wasm","create","detect","close"]);
assert.deepEqual(await mustHold({},"vision_runtime_or_model_failed",{fail:"model"}),
  ["wasm","create"]);
assert.deepEqual(await mustHold({},"vision_runtime_or_model_failed",{fail:"detect"}),
  ["wasm","create","detect","close"]);
assert.deepEqual(await mustHold({},"vision_runtime_or_model_failed",{fail:"wasm"}),
  ["wasm"]);
const bogus=faceLandmarks.slice(0,400);
await mustHold({},"single_face_landmarks_unavailable",{faces:[bogus]});
const rotated=structuredClone(faceLandmarks);
rotated[1]={ x:0.77,y:0.48,z:0 };
await mustHold({},"face_geometry_unreliable",{faces:[rotated]});
const malformed=structuredClone(faceLandmarks);
malformed[33]={ x:Number.NaN,y:0.32,z:0 };
await mustHold({},"required_face_landmarks_invalid",{faces:[malformed]});

// The reference regions are constructed independently as wide cheek patches;
// never calculate a "reference" from the candidate polygons themselves.
const independentMasks={
  leftCheek:new Uint8Array(width*height),
  rightCheek:new Uint8Array(width*height)
};
for(let row=0;row<height;row++) for(let col=0;col<width;col++){
  const x=(col+0.5)/width,y=(row+0.5)/height,i=row*width+col;
  if(x>=0.27&&x<0.45&&y>=0.42&&y<0.63) independentMasks.leftCheek[i]=1;
  if(x>=0.55&&x<0.73&&y>=0.42&&y<0.63) independentMasks.rightCheek[i]=1;
}
const compareInput={
  width,height,
  cheekPolygons:proposal.cheekPolygons,
  exclusionPolygons:proposal.exclusionPolygons,
  independentlyReviewedSkinMasks:independentMasks,
  reviewProvenance:"independent_manual_review",
  coordinateSpace:"original_image"
};
const comparison=compareCheekRoiProposalToReview(compareInput);
assert.equal(comparison.status,"evaluation_only",JSON.stringify(comparison));
assert.equal(comparison.roiAccuracyApproved,false);
assert.equal(comparison.bareSkinVerifiedBySoftware,false);
assert.equal(comparison.sourceImagePersisted,false);
assert.equal(comparison.faceLandmarksPersisted,false);
for(const cheek of ["leftCheek","rightCheek"]){
  const m=comparison.comparison[cheek];
  assert.ok(m.candidatePixels>=16);
  assert.ok(m.referencePixels>=16);
  assert.ok(m.intersectionPixels>0);
  assert.ok(m.iou>0&&m.iou<1);
  assert.ok(m.precision>0&&m.precision<=1);
  assert.ok(m.recall>0&&m.recall<1);
}
assert.equal(JSON.stringify(comparison).includes("cheekPolygons"),false);
assert.equal(JSON.stringify(comparison).includes("referenceMasks"),false);
assert.deepEqual(compareCheekRoiProposalToReview(compareInput),comparison);

function rejected(overrides,reason){
  const data=compareCheekRoiProposalToReview({...compareInput,...overrides});
  assert.equal(data.status,"insufficient_evidence",JSON.stringify(data));
  assert.equal(data.reason,reason);
  assert.equal(data.comparison,null);
}
rejected({reviewProvenance:"auto_generated"},"independent_reference_review_required");
rejected({coordinateSpace:"mirrored_preview"},"image_orientation_unknown");
rejected({independentlyReviewedSkinMasks:null},"independent_reference_masks_invalid");
const overlaps={
  leftCheek:independentMasks.leftCheek,
  rightCheek:Uint8Array.from(independentMasks.leftCheek)
};
rejected({independentlyReviewedSkinMasks:overlaps},"overlapping_reference_cheeks");
const invalidMask={leftCheek:Uint8Array.from(independentMasks.leftCheek),
  rightCheek:Uint8Array.from(independentMasks.rightCheek)};
invalidMask.leftCheek[0]=7;
rejected({independentlyReviewedSkinMasks:invalidMask},"independent_reference_masks_invalid");
rejected({cheekPolygons:{...proposal.cheekPolygons,leftCheek:proposal.cheekPolygons.rightCheek,
  rightCheek:proposal.cheekPolygons.leftCheek}},"cheek_orientation_mismatch");

const ui=readFileSync("components/face-lab-test/FaceLabM2MediaPipeRoiResearch.jsx","utf8");
const route=readFileSync("app/face-lab-test/FaceLabTestClient.jsx","utf8");
assert.ok(ui.includes('process.env.NODE_ENV !== "development"'));
assert.ok(ui.includes("onClick={() => void runLocalInference()}"));
assert.ok(ui.includes('data-testid="face-lab-m2-mediapipe-overlay"'));
assert.ok(ui.includes("detectMediaPipeCheekRoiProposal"));
assert.ok(route.includes('process.env.NODE_ENV === "development" ? ('));
assert.ok(route.includes("FaceLabM2MediaPipeRoiResearch"));
assert.ok(!ui.includes("fetch("));
assert.ok(!ui.includes("localStorage"));
assert.ok(!ui.includes("sessionStorage"));

console.log(JSON.stringify({
  ok:true,
  suite:"m2_mediapipe_browser_detector_adapter",
  imageDetectAPICalled:true,
  result:result.status,
  candidatePixels:result.candidatePixels,
  independentReferenceEvaluation:"evaluation_only",
  realModelLoadedInCI:false,
  realPhotoIoUValidated:false,
  automaticSkinSegmentationValidated:false,
  sourceImagePersisted:false,
  productionActivated:false
},null,2));
