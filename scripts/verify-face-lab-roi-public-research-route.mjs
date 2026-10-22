import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import securityHeaders from "../lib/security/security-headers.js";
import {consumeNeutralFaceObservation} from "../lib/face-lab-v2/personal-color/saju-neutral-observation.js";
import {compareSharedNeutralFaceCoreRoiParity} from "../lib/face-lab-v2/personal-color/shared-core-roi-parity.js";
import {detectMediaPipeCheekRoiProposal} from "../lib/face-lab-v2/personal-color/mediapipe-roi-proposal.js";
import {buildRoiPreviewMasks} from "../lib/face-lab-v2/personal-color/roi-render-mask-adapter.js";
import { FACE_OVAL_INDICES, proposeSajuNeutralCheekResearchRegions } from "../lib/face-lab-v2/personal-color/saju-neutral-cheek-research-proposal.js";

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
assert.match(ui,/Saju 기반 연구/);
assert.match(ui,/두 후보의 차이/);
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

const landmarks=Array.from({length:478},()=>({x:.5,y:.5,z:0}));
// A realistic closed contour is required; a seven-anchor fixture is no
// longer sufficient to justify the new full-face search band.
for(let i=0;i<FACE_OVAL_INDICES.length;i++){
  const theta=-Math.PI/2+2*Math.PI*i/FACE_OVAL_INDICES.length;
  landmarks[FACE_OVAL_INDICES[i]]={
    x:.5+.31*Math.cos(theta),y:.52+.40*Math.sin(theta),z:0
  };
}
for(const [index,[x,y]] of Object.entries({
1:[.5,.48],33:[.35,.32],263:[.65,.32],
61:[.4,.68],291:[.6,.68]
}))landmarks[Number(index)]={x,y,z:0};
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
  "full-outline candidate must differ structurally from seven-point ellipse");
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
assert.equal(experimentalGeometry.method,"mediapipe_face_oval_scanlines_v2");
assert.equal(experimentalGeometry.cheekPolygons.leftCheek.length,10);
assert.ok(preview.candidate.sampleCount.leftCheek > preview.baseline.sampleCount.leftCheek*1.4);
let callCount=0;
const malformed=consumeNeutralFaceObservation({
  faceLandmarks:landmarks.map((p,i)=>FACE_OVAL_INDICES.includes(i)&&i!==234&&i!==454
    ? {x:.5,y:.5,z:0}:p),
  faceCount:1,coordinateSpace:"original_image",
  onFrame({anchorGeometry,frame}){
    callCount++;
    const checked=proposeSajuNeutralCheekResearchRegions(anchorGeometry,frame);
    assert.equal(checked.status,"insufficient_evidence",
      "partial seven-anchor topology must fail closed, not fabricate an oval");
  }
});
assert.equal(malformed.status,"candidate_only");
assert.equal(callCount,1);
assert.equal(buildRoiPreviewMasks({
  baseline:{...baselineGeometry,cheekPolygons:null},
  candidate:experimentalGeometry,size:{width:128,height:128}
}).status,"insufficient_evidence");

console.log(JSON.stringify({ok:true,suite:"isolated_roi_research_public_route",tests:[
"unchanged_normal_csp","route_scoped_remote_model_csp","saju_source_hash",
"single_inference_full_face_oval_roi","missing_oval_fails_closed","redacted_baseline_callback_rasterizes","privacy_no_upload","no_skin_accuracy_claims"
],realPhotoValidated:false,modelDownloadedInTest:false,productionReleaseAuthorizedByThisTest:false}));
