import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import securityHeaders from "../lib/security/security-headers.js";
import {consumeNeutralFaceObservation} from "../lib/face-lab-v2/personal-color/saju-neutral-observation.js";
import {compareSharedNeutralFaceCoreRoiParity} from "../lib/face-lab-v2/personal-color/shared-core-roi-parity.js";
import {detectMediaPipeCheekRoiProposal} from "../lib/face-lab-v2/personal-color/mediapipe-roi-proposal.js";

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
for(const [index,[x,y]] of Object.entries({
234:[.2,.5],454:[.8,.5],1:[.5,.48],33:[.35,.32],
263:[.65,.32],61:[.4,.68],291:[.6,.68]
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
for(const metric of Object.values(stats.metrics)){
  assert.ok(metric.iou>0&&metric.iou<1);
}
let detectorCalls=0,candidates=0,legacy=0,parity=0;
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
 onCandidateGeometry(candidate){candidates++;assert.equal(candidate.status,"proposal_only");},
 onProposal(candidate){legacy++;assert.ok(candidate.cheekPolygons.leftCheek.length===12);},
 onParity(comparison){parity++;assert.equal(comparison.parity,"diverged");}
});
assert.equal(result.status,"proposal_only",JSON.stringify(result));
assert.deepEqual({detectorCalls,candidates,legacy,parity},{detectorCalls:1,candidates:1,legacy:1,parity:1});
assert.equal(result.skinMeasurement,null);
assert.equal(result.faceLandmarksPersisted,false);
console.log(JSON.stringify({ok:true,suite:"isolated_roi_research_public_route",tests:[
"unchanged_normal_csp","route_scoped_remote_model_csp","saju_source_hash",
"single_inference_two_distinct_roi_paths","privacy_no_upload","no_skin_accuracy_claims"
],realPhotoValidated:false,modelDownloadedInTest:false,productionReleaseAuthorizedByThisTest:false}));
