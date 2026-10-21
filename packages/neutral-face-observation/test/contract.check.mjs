import assert from "node:assert/strict";
import test from "node:test";
import { consumeNeutralFaceObservation, NEUTRAL_FACE_OBSERVATION_VERSION } from "../index.js";

const landmarks = Array.from({length: 478}, () => ({x:0.5,y:0.5,z:0}));
for(const [index,[x,y]] of Object.entries({
  234:[0.2,0.5],454:[0.8,0.5],1:[0.5,0.48],
  33:[0.35,0.32],263:[0.65,0.32],61:[0.4,0.68],291:[0.6,0.68]
})) landmarks[+index]={x,y,z:0};
test("frozen geometry callback and redacted receipt",()=>{
  let count=0;
  const before=JSON.stringify(landmarks);
  const receipt=consumeNeutralFaceObservation({
    faceLandmarks:landmarks,faceCount:1,coordinateSpace:"original_image",
    onFrame({frame,anchorGeometry,productionAuthorized}){
      count++;
      assert.equal(frame.length,468);
      assert.equal(frame[234].x,.2);
      assert.equal(Object.isFrozen(frame),true);
      assert.equal(Object.isFrozen(anchorGeometry),true);
      assert.equal(Object.hasOwn(frame[234],"z"),false);
      assert.equal(anchorGeometry.imageFaceWidth,.6000000000000001);
      assert.equal(anchorGeometry.anatomicalLateralityResolved,false);
      assert.equal(productionAuthorized,false);
    }
  });
  assert.equal(count,1);
  assert.equal(receipt.schemaVersion,NEUTRAL_FACE_OBSERVATION_VERSION);
  assert.equal(receipt.status,"candidate_only");
  assert.equal(receipt.providerLandmarkCount,478);
  assert.equal(receipt.productionAuthorized,false);
  assert.equal(receipt.faceLandmarksPersisted,false);
  assert.equal(JSON.stringify(landmarks),before);
  assert.ok(!JSON.stringify(receipt).includes('"frame"'));
  assert.ok(!JSON.stringify(receipt).includes('"landmarks"'));
});
test("fail closed on any bad coordinate and wrong topology",()=>{
  const run=(overrides)=>consumeNeutralFaceObservation({
    faceLandmarks:landmarks,faceCount:1,coordinateSpace:"original_image",
    onFrame(){throw Error("should not execute");},...overrides
  });
  assert.equal(run({coordinateSpace:"mirrored_preview"}).reason,"image_orientation_unknown");
  assert.equal(run({faceCount:2}).reason,"single_face_landmarks_unavailable");
  assert.equal(run({faceLandmarks:landmarks.slice(0,469)}).reason,"unsupported_provider_topology");
  const bad=JSON.parse(JSON.stringify(landmarks));bad[110].z=NaN;
  assert.equal(run({faceLandmarks:bad}).reason,"neutral_landmarks_invalid");
  assert.equal(run({onFrame:undefined}).reason,"neutral_consumer_required");
  assert.equal(run({}).reason,"neutral_consumer_failed");
});
