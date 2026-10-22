import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import securityHeaders from "../lib/security/security-headers.js";
import {consumeNeutralFaceObservation} from "../lib/face-lab-v2/personal-color/saju-neutral-observation.js";
import {compareSharedNeutralFaceCoreRoiParity} from "../lib/face-lab-v2/personal-color/shared-core-roi-parity.js";
import {detectMediaPipeCheekRoiProposal} from "../lib/face-lab-v2/personal-color/mediapipe-roi-proposal.js";
import {buildRoiPreviewMasks} from "../lib/face-lab-v2/personal-color/roi-render-mask-adapter.js";
import { CHEEK_SURFACE_RINGS, proposeSajuNeutralCheekResearchRegions } from "../lib/face-lab-v2/personal-color/saju-neutral-cheek-research-proposal.js";
import {buildPersonalColorCheekMasks} from "../lib/face-lab-v2/personal-color/cheek-mask-geometry.js";
import {describeRoiPhotoEvidence} from "../lib/face-lab-v2/personal-color/roi-photo-quality-research.js";

const read=(p)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const root="lib/face-lab-v2/personal-color/";
const upstream=read(root+"saju-neutral-observation.js");
const sha=createHash("sha1").update("blob "+Buffer.byteLength(upstream)+"\0").update(upstream).digest("hex");
assert.equal(sha,"90a6359da4aea4e9d6a1ff8e7be5c9a60910e3a0",
  "Saju research producer source drift");

const page=read("app/face-lab-roi-test/page.js");
const ui=read("app/face-lab-roi-test/FaceLabRoiLiveClient.jsx");
const middleware=read("middleware.js");
assert.match(page,/robots:\s*\{\s*index:\s*false/);
assert.match(ui,/detectMediaPipeCheekRoiProposal/);
assert.match(ui,/onCandidateGeometry/);
assert.match(ui,/buildRoiPreviewMasks/);
assert.doesNotMatch(ui,/function maskFor\(/);
assert.doesNotMatch(ui,/<input[^>]+type="checkbox"|orientationConfirmed|동의 체크/);
assert.match(ui,/기존 Face Lab/);
assert.match(ui,/Face Lab 볼 메시 v3/);
assert.match(ui,/두 후보의 차이/);
assert.match(ui,/describeRoiPhotoEvidence/);
assert.match(ui,/선택하면 자동 비교합니다/);
assert.match(ui,/볼 후보가 사진에서 매우 작게 생성되었습니다/);
assert.match(ui,/onChange={selectFile}/);
assert.doesNotMatch(ui,/\bfetch\s*\(/);
assert.doesNotMatch(ui,/\bFormData\b|localStorage|sessionStorage|indexedDB/);
assert.match(middleware,/researchRoiTest:\s*request\.nextUrl\.pathname === "\/face-lab-roi-test"/);

const nonce="AAAAAAAAAAAAAAAAAAAAAA==";
const base={nonce,supabaseUrl:"https://example.supabase.co"};
const normal=securityHeaders.buildContentSecurityPolicy(base);
const research=securityHeaders.buildContentSecurityPolicy({...base,researchRoiTest:true});
assert.doesNotMatch(normal,/https:\/\/cdn\.jsdelivr\.net/);
assert.doesNotMatch(normal,/https:\/\/storage\.googleapis\.com/);
const connect=research.split(";").find(x=>x.trim().startsWith("connect-src"));
assert.match(connect,/https:\/\/cdn\.jsdelivr\.net/);
assert.match(connect,/https:\/\/storage\.googleapis\.com/);
assert.match(research,/wasm-unsafe-eval/);
assert.match(research,/worker-src 'none'/);

// Selected 2-D vertices from the public MediaPipe canonical face model OBJ.
// This is a synthetic, front-facing mesh fixture: NOT any real photo label.
const canonicalSubset={"1":[0,-1.126865],"33":[-4.445859,2.663991],"36":[-2.844939,-0.720868],"61":[-2.456206,-4.342621],"98":[-1.405627,-1.714196],"100":[-2.34234,0.572222],"101":[-3.327324,0.104863],"117":[-5.258659,0.945811],"118":[-4.432338,0.722096],"123":[-6.338145,-0.529279],"145":[-3.177186,2.294265],"147":[-6.234883,-1.94443],"187":[-5.278538,-2.238942],"205":[-3.832928,-1.537326],"206":[-2.96186,-2.274215],"207":[-4.386901,-2.683286],"234":[-7.664182,0.673132],"263":[4.445859,2.663991],"266":[2.844939,-0.720868],"291":[2.456206,-4.342621],"327":[1.405627,-1.714196],"329":[2.34234,0.572222],"330":[3.327324,0.104863],"346":[5.258659,0.945811],"347":[4.432338,0.722096],"352":[6.338145,-0.529279],"374":[3.177186,2.294265],"376":[6.234883,-1.94443],"411":[5.278538,-2.238942],"425":[3.832928,-1.537326],"426":[2.96186,-2.274215],"427":[4.386901,-2.683286],"454":[7.664182,0.673132]};
const landmarks=Array.from({length:478},()=>({x:.5,y:.5,z:0}));
for(const [index,[x,y]] of Object.entries(canonicalSubset)){
  landmarks[Number(index)]={x:(x+9)/18,y:(9-y)/20,z:0};
}
let used=0;
const neutral=consumeNeutralFaceObservation({
  faceLandmarks:landmarks,faceCount:1,coordinateSpace:"original_image",
  onFrame({frame,anchorGeometry}) {
    used++;
    assert.equal(frame.length,468);
    assert.equal(anchorGeometry.anatomicalLateralityResolved,false);
  }
});
assert.equal(used,1);
assert.equal(neutral.status,"candidate_only");
let researchProposal=null;
const researchReceipt=consumeNeutralFaceObservation({
  faceLandmarks:landmarks,faceCount:1,coordinateSpace:"original_image",
  onFrame({anchorGeometry,frame}) {
    researchProposal=proposeSajuNeutralCheekResearchRegions(anchorGeometry,frame);
  }
});
assert.equal(researchReceipt.status,"candidate_only");
assert.equal(researchProposal?.status,"proposal_only",JSON.stringify(researchProposal));
const candidateMask=buildPersonalColorCheekMasks({
  width:128,height:128,
  cheekPolygons:researchProposal.cheekPolygons,
  exclusionPolygons:researchProposal.exclusionPolygons
});
assert.equal(candidateMask.status,"masks_ready",JSON.stringify(candidateMask).slice(0,400));
const stats=compareSharedNeutralFaceCoreRoiParity({
  faceLandmarks:landmarks,faceCount:1,coordinateSpace:"original_image",
  width:128,height:128
});
assert.equal(stats.status,"comparison_only",JSON.stringify(stats));
assert.equal(stats.parity,"diverged");
assert.equal(stats.productionAuthorized,false);
assert.equal(stats.reference,"same_detector_different_research_roi_algorithms_not_human_accuracy");
assert.ok(stats.metrics.leftCheek.candidatePixels>stats.metrics.leftCheek.baselinePixels*1.4,
  "candidate should be a meaningfully broader area, not a retuned dot");
assert.ok(stats.metrics.rightCheek.candidatePixels>stats.metrics.rightCheek.baselinePixels*1.4);
assert.ok(stats.metrics.leftCheek.iou<.8,
  "inner-mesh candidate must differ structurally from seven-point ellipse");
for(const metric of Object.values(stats.metrics)){
  assert.ok(metric.iou>0&&metric.iou<1);
}
let detectorCalls=0,candidates=0,legacy=0,parity=0;
let baselineGeometry=null,experimentalGeometry=null;
const mocked={
 FilesetResolver:{forVisionTasks:async()=>({})},
 FaceLandmarker:{createFromOptions:async()=>({
   detect(){detectorCalls++;return {faceLandmarks:[landmarks]};},
   close(){}
 })}
};
const result=await detectMediaPipeCheekRoiProposal({
 image:{},width:128,height:128,originalImageOrientationVerified:true,
 loadVisionTasks:async()=>mocked,
 onCandidateGeometry(candidate){candidates++;experimentalGeometry=candidate;assert.equal(candidate.status,"proposal_only");},
 onProposal(candidate){legacy++;baselineGeometry=candidate;assert.ok(candidate.cheekPolygons.leftCheek.length===12);},
 onParity(comparison){parity++;assert.equal(comparison.parity,"diverged");}
});
assert.equal(result.status,"proposal_only",JSON.stringify(result));
assert.deepEqual({detectorCalls,candidates,legacy,parity},{detectorCalls:1,candidates:1,legacy:1,parity:1});
assert.equal(result.skinMeasurement,null);
assert.equal(result.faceLandmarksPersisted,false);
assert.equal(Object.hasOwn(baselineGeometry,"status"),false,
  "detector deliberately redacts baseline proposal flags");
const preview=buildRoiPreviewMasks({
  baseline:baselineGeometry,candidate:experimentalGeometry,
  size:{width:128,height:128}
});
assert.equal(preview.status,"preview_only",JSON.stringify(preview));
assert.equal(preview.skinMeasurementAuthorized,false);
assert.equal(preview.skinAccuracyVerified,false);
assert.ok(preview.baseline.sampleCount.leftCheek>0);
assert.ok(preview.candidate.sampleCount.rightCheek>0);
assert.equal(experimentalGeometry.method,"mediapipe_inner_cheek_mesh_v3");
assert.equal(experimentalGeometry.cheekPolygons.leftCheek.length,11);
assert.ok(new Set(experimentalGeometry.cheekPolygons.leftCheek.map(p=>p.x.toFixed(3))).size>6,
 "v3 must not collapse into straight vertical sides");
assert.ok(new Set(experimentalGeometry.cheekPolygons.leftCheek.map(p=>p.y.toFixed(3))).size>6,
 "v3 must follow mesh curvature rather than flat scanline rows");
assert.ok(preview.candidate.sampleCount.leftCheek > preview.baseline.sampleCount.leftCheek*1.4);
let callCount=0;
const malformed=consumeNeutralFaceObservation({
  faceLandmarks:landmarks.map((p,i)=>CHEEK_SURFACE_RINGS.flat().includes(i)&&i!==234&&i!==454
    ? {x:.5,y:.5,z:0}:p),
  faceCount:1,coordinateSpace:"original_image",
  onFrame({anchorGeometry,frame}){
    callCount++;
    const checked=proposeSajuNeutralCheekResearchRegions(anchorGeometry,frame);
    assert.equal(checked.status,"insufficient_evidence",
      "partial seven-anchor topology must fail closed, not fabricate a cheek surface");
  }
});
assert.equal(malformed.status,"candidate_only");
assert.equal(callCount,1);
const mirrored=landmarks.map(p=>({...p,x:1-p.x}));
let mirroredCandidate=null;
const mirroredReceipt=consumeNeutralFaceObservation({
  faceLandmarks:mirrored,faceCount:1,coordinateSpace:"original_image",
  onFrame({anchorGeometry,frame}){
    mirroredCandidate=proposeSajuNeutralCheekResearchRegions(anchorGeometry,frame);
  }
});
assert.equal(mirroredReceipt.status,"candidate_only");
assert.equal(mirroredCandidate.status,"proposal_only",
  "geometric IMAGE-left/right assignment should remain valid when mirrored");
assert.ok(mirroredCandidate.cheekPolygons.leftCheek.every(p=>p.x<.5));
assert.ok(mirroredCandidate.cheekPolygons.rightCheek.every(p=>p.x>.5));

assert.equal(buildRoiPreviewMasks({
  baseline:{...baselineGeometry,cheekPolygons:null},
  candidate:experimentalGeometry,size:{width:128,height:128}
}).status,"insufficient_evidence");

// Boundary conditions: quality signals are scalar, local-only and never
// automatically label photo focus, bare skin or colour eligibility.
const testW=24,testH=24,testN=testW*testH;
const allMask=new Uint8Array(testN).fill(1);
const noneMask=new Uint8Array(testN);
const flat=new Uint8ClampedArray(testN*4);
const checker=new Uint8ClampedArray(testN*4);
for(let i=0;i<testN;i++){
  flat.set([128,128,128,255],i*4);
  const n=((i%testW)+Math.floor(i/testW))%2===0?0:255;
  checker.set([n,n,n,255],i*4);
}
const argumentsFor=(rgba)=>({rgba,width:testW,height:testH,
  leftMask:allMask,rightMask:allMask,exclusionMask:noneMask});
const flatEvidence=describeRoiPhotoEvidence(argumentsFor(flat));
const checkerEvidence=describeRoiPhotoEvidence(argumentsFor(checker));
assert.equal(flatEvidence.status,"descriptive_only");
assert.equal(flatEvidence.imageLeft.detailSignal,0);
assert.equal(checkerEvidence.status,"descriptive_only");
assert.ok(checkerEvidence.imageLeft.detailSignal>flatEvidence.imageLeft.detailSignal);
assert.equal(checkerEvidence.imageLeft.clippedFraction,1);
assert.equal(checkerEvidence.focusVerified,false);
assert.equal(checkerEvidence.measurementAuthorized,false);
assert.equal(checkerEvidence.photoColorCalibrated,false);
assert.ok(!JSON.stringify(checkerEvidence).includes("rgba"));
assert.equal(describeRoiPhotoEvidence({...argumentsFor(flat),
  rgba:new Uint8ClampedArray(1)}).status,"insufficient_evidence");

console.log(JSON.stringify({ok:true,suite:"isolated_roi_research_public_route",tests:[
"unchanged_normal_csp","route_scoped_remote_model_csp","saju_source_hash",
"single_inference_inner_cheek_mesh_v3","degenerate_cheek_mesh_fails_closed","redacted_baseline_callback_rasterizes","quality_signals_local_and_not_photo_approval","privacy_no_upload","no_skin_accuracy_claims"
],realPhotoValidated:false,modelDownloadedInTest:false,productionReleaseAuthorizedByThisTest:false}));
