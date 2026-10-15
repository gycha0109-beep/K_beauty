import assert from "node:assert/strict";
import {
  FACE_LAB_V2_HIGH_REPETITION_TARGETS,
  buildFaceLabV2HumanPairwiseReviewPacket,
  buildFaceLabV2HumanPairwiseOperatorManifest
} from "../lib/face-lab-v2/evaluation/human-pairwise-builder.js";
import {
  runFaceLabV2CandidatePersonalizationEvaluation
} from "../lib/face-lab-v2/evaluation/candidate-personalization.js";

// Offline aggregate evidence only: no real reviewers, photos, candidate
// activation, operator mapping disclosure, or user-identifying output.
const packet = buildFaceLabV2HumanPairwiseReviewPacket();
const manifest = buildFaceLabV2HumanPairwiseOperatorManifest();
const evaluation = runFaceLabV2CandidatePersonalizationEvaluation();
assert.equal(packet.packetDigest, manifest.reviewPacketDigest);
assert.equal(evaluation.summary.hardFailureCount, 0);
assert.equal(evaluation.rows.length, 96);

const bucketStats = {};
let different = 0;
let identical = 0;
for (const mapping of manifest.mappings) {
  const item = packet.reviewItems.find((pair) => pair.pairId === mapping.pairId);
  assert.ok(item, "every operator row must refer to exactly one reviewer-visible pair");
  assert.equal(item.evaluationCaseRef, mapping.evaluationCaseRef);
  assert.ok(["route_mutation", "activation_boundary", "high_repetition"].includes(mapping.sampleBucket));
  const unequal = item.options.A.recommendationDigest !== item.options.B.recommendationDigest;
  if (mapping.selectedRouteChanged) {
    assert.equal(unequal, true, "changed selected routes must produce distinguishing pairs");
  }
  if (!mapping.selectedRouteChanged) {
    assert.equal(unequal, false, "unchanged route recommendations must not be counted as A/B superiority evidence");
  }
  bucketStats[mapping.sampleBucket] ||= { pairs: 0, distinguishing: 0, identical: 0 };
  bucketStats[mapping.sampleBucket].pairs += 1;
  bucketStats[mapping.sampleBucket][unequal ? "distinguishing" : "identical"] += 1;
  if (unequal) different += 1;
  else identical += 1;
}

assert.equal(packet.reviewItems.length, 14);
assert.equal(different, 5);
assert.equal(identical, 9);
assert.deepEqual(bucketStats, {
  route_mutation: { pairs: 5, distinguishing: 5, identical: 0 },
  activation_boundary: { pairs: 3, distinguishing: 0, identical: 3 },
  high_repetition: { pairs: 6, distinguishing: 0, identical: 6 }
});

const highRepetition = [...FACE_LAB_V2_HIGH_REPETITION_TARGETS].sort();
assert.equal(highRepetition.length, 6);
for (const target of highRepetition) {
  const rows = evaluation.rows.filter((row) => row.targetKey === target);
  assert.equal(rows.length, 8, "all synthetic face fixtures must be represented");
  assert.equal(new Set(rows.map((row) => row.currentActionSignature)).size, 1,
    "baseline diagnostic must show exactly one vCurrent action signature for " + target);
}

// Verify role secrecy remains in the reviewer packet; only the operator
// manifest may map sides to engines.
const reviewerVisible = JSON.stringify(packet);
for (const token of [
  "sampleBucket", "candidateRelationIds", "selectedRouteChanged",
  "\"role\":\"current\"", "\"role\":\"candidate\""
]) {
  assert.equal(reviewerVisible.includes(token), false, "reviewer-facing operator metadata leak: " + token);
}

console.log(JSON.stringify({
  ok: true,
  source: "current_main_deterministic_fixtures",
  pairCount: packet.reviewItems.length,
  pairwiseDifferentiatingCases: different,
  identicalControlCases: identical,
  buckets: bucketStats,
  repeatedCurrentTargets: highRepetition,
  actualHumanResponsesVerified: 0,
  canDeclareCandidateSuperior: false,
  canActivateProductionCandidate: false
}, null, 2));
