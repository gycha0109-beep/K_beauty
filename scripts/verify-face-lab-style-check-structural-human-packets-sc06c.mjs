import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {
  buildStyleCheckStructuralHumanReviewPacket,
  buildStyleCheckStructuralHumanOperatorManifest,
  auditStyleCheckStructuralHumanPacketSampling,
  STYLE_CHECK_STRUCTURAL_HUMAN_PACKET_VERSION
} from "../lib/face-lab-v2/evaluation/style-check-structural-human-pairwise-builder.js";
import {
  FACE_LAB_V2_HUMAN_PAIRWISE_BLIND_STATE,
  FACE_LAB_V2_HUMAN_PAIRWISE_DIMENSIONS,
  validateFaceLabV2HumanPairwiseReviewItem,
  verifyFaceLabV2HumanPairwiseDigest
} from "../lib/face-lab-v2/evaluation/human-pairwise-contract.js";
import {
  verifyFaceLabV2HumanPairwisePacketDigest,
  verifyFaceLabV2HumanPairwiseOperatorManifestDigest
} from "../lib/face-lab-v2/evaluation/human-pairwise-builder.js";

const hex=(x)=>createHash("sha256").update(x).digest("hex");
const packet=buildStyleCheckStructuralHumanReviewPacket();
const manifest=buildStyleCheckStructuralHumanOperatorManifest();
const stats=auditStyleCheckStructuralHumanPacketSampling();
assert.equal(packet.builderVersion,STYLE_CHECK_STRUCTURAL_HUMAN_PACKET_VERSION);
assert.equal(packet.packetId,manifest.packetId);
assert.equal(manifest.reviewPacketDigest,packet.packetDigest);
assert.equal(stats.syntheticInputCount,96);
assert.equal(stats.candidateActivatedCases,14);
assert.ok(stats.reviewerVisiblePairs>0);
assert.equal(stats.reviewerVisiblePairs,7,
  "only actual selected-route differences from SC-06B belong in blind packet");
assert.equal(stats.excludedNoVisibleDifference,7);
assert.equal(packet.reviewItems.length,stats.reviewerVisiblePairs);
assert.equal(manifest.mappings.length,stats.reviewerVisiblePairs);
assert.deepEqual(packet.dimensions,[...FACE_LAB_V2_HUMAN_PAIRWISE_DIMENSIONS]);
assert.equal(verifyFaceLabV2HumanPairwisePacketDigest(packet),true);
assert.equal(verifyFaceLabV2HumanPairwiseOperatorManifestDigest(manifest),true);

let aCurrent=0,bCurrent=0;
const allRoles=new Set();
for(const [index,item] of packet.reviewItems.entries()){
  assert.equal(validateFaceLabV2HumanPairwiseReviewItem(item).ok,true,
    JSON.stringify({i:index,item}));
  assert.equal(verifyFaceLabV2HumanPairwiseDigest(item,"itemDigest",hex),true);
  assert.deepEqual(item.blindState,FACE_LAB_V2_HUMAN_PAIRWISE_BLIND_STATE);
  assert.notEqual(item.options.A.recommendationDigest,
    item.options.B.recommendationDigest);
  const entry=manifest.mappings.find(x=>x.pairId===item.pairId);
  assert.ok(entry);
  assert.equal(entry.mapping.A.recommendationDigest,item.options.A.recommendationDigest);
  assert.equal(entry.mapping.B.recommendationDigest,item.options.B.recommendationDigest);
  assert.notEqual(entry.mapping.A.role,entry.mapping.B.role);
  if(entry.mapping.A.role==="current")aCurrent++;else bCurrent++;
  for(const x of entry.candidateRelationIds)allRoles.add(x);
  assert.ok(item.context.currentFaceFeatures.some(f=>
    ["jawlineAngularity","eyeOpenness","featureScale"].includes(f.key)));
}
assert.ok(aCurrent>0&&bCurrent>0,"A/B role ordering must be counterbalanced");
assert.ok(aCurrent-bCurrent<=1&&bCurrent-aCurrent<=1);
assert.ok(allRoles.has("SC-STRUCT-001")&&allRoles.has("SC-STRUCT-002"));
assert.equal(allRoles.has("SC-STRUCT-003"),false,
  "zero-coverage hypothesis may not masquerade as a human-review sample");
const safe=JSON.stringify(packet);
assert.equal(/candidate_relation:|candidate_structural:|candidate_structural_guard|candidatePolicy|productionActive|SC-STRUCT-00|candidate_face_fit|사람 평가에서 비교/.test(safe),
  false,"reviewer-side payload must not contain operator-only hypothesis roles");
const leaked=JSON.stringify(manifest);
assert.ok(leaked.includes("candidate"));
assert.equal(safe.includes('"mapping"'),false);
assert.equal(safe.includes('"role"'),false);
assert.equal(safe.includes('"engineVersion"'),false);
assert.equal(safe.includes('"candidateRelationIds"'),false);
assert.equal(stats.realPhotoReviewed,0);
assert.equal(stats.humanJudgments,0);
assert.equal(stats.productionAuthorization,false);
assert.deepEqual(buildStyleCheckStructuralHumanReviewPacket(),packet);
assert.deepEqual(buildStyleCheckStructuralHumanOperatorManifest(),manifest);

const corrupted=structuredClone(packet);
corrupted.reviewItems[0].options.A.actions[0].strength="strong";
assert.equal(verifyFaceLabV2HumanPairwiseDigest(corrupted.reviewItems[0],
  "itemDigest",hex),false);
assert.equal(verifyFaceLabV2HumanPairwisePacketDigest(corrupted),false);

console.log(JSON.stringify({
  ok:true,version:STYLE_CHECK_STRUCTURAL_HUMAN_PACKET_VERSION,
  summary:stats,blindPairs:packet.reviewItems.length,
  roleBalance:{A_current:aCurrent,B_current:bCurrent},
  reviewerPacketIntegrityValid:true,operatorManifestIntegrityValid:true,
  tamperingDetected:true,realHumanJudgments:0,operationalDeployment:false
}));
