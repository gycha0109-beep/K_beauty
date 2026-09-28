import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  FACE_LAB_V2_HUMAN_PAIRWISE_CONTRACT_VERSION,
  verifyFaceLabV2HumanPairwiseDigest,
  validateFaceLabV2HumanPairwiseReviewItem
} from "../lib/face-lab-v2/evaluation/human-pairwise-contract.js";
import {
  FACE_LAB_V2_HIGH_REPETITION_TARGETS,
  FACE_LAB_V2_HUMAN_PAIRWISE_BUILDER_VERSION,
  FACE_LAB_V2_HUMAN_PAIRWISE_OPERATOR_MANIFEST_SCHEMA,
  FACE_LAB_V2_HUMAN_PAIRWISE_REVIEW_PACKET_SCHEMA,
  buildFaceLabV2HumanPairwiseOperatorManifest,
  buildFaceLabV2HumanPairwiseReviewPacket,
  verifyFaceLabV2HumanPairwiseOperatorManifestDigest,
  verifyFaceLabV2HumanPairwisePacketDigest
} from "../lib/face-lab-v2/evaluation/human-pairwise-builder.js";
import {
  runFaceLabV2CandidatePersonalizationEvaluation
} from "../lib/face-lab-v2/evaluation/candidate-personalization.js";

function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

const reviewPacket =
  buildFaceLabV2HumanPairwiseReviewPacket();
const reviewReplay =
  buildFaceLabV2HumanPairwiseReviewPacket();
const operatorManifest =
  buildFaceLabV2HumanPairwiseOperatorManifest();
const operatorReplay =
  buildFaceLabV2HumanPairwiseOperatorManifest();

assert.deepEqual(reviewPacket, reviewReplay);
assert.deepEqual(operatorManifest, operatorReplay);

assert.equal(
  reviewPacket.schemaVersion,
  FACE_LAB_V2_HUMAN_PAIRWISE_REVIEW_PACKET_SCHEMA
);
assert.equal(
  operatorManifest.schemaVersion,
  FACE_LAB_V2_HUMAN_PAIRWISE_OPERATOR_MANIFEST_SCHEMA
);
assert.equal(
  reviewPacket.builderVersion,
  FACE_LAB_V2_HUMAN_PAIRWISE_BUILDER_VERSION
);
assert.equal(
  reviewPacket.contractVersion,
  FACE_LAB_V2_HUMAN_PAIRWISE_CONTRACT_VERSION
);
assert.equal(
  reviewPacket.contractVersion,
  operatorManifest.contractVersion
);
assert.equal(
  reviewPacket.packetId,
  operatorManifest.packetId
);
assert.equal(
  reviewPacket.packetDigest,
  operatorManifest.reviewPacketDigest
);
assert.equal(
  verifyFaceLabV2HumanPairwisePacketDigest(reviewPacket),
  true
);
assert.equal(
  verifyFaceLabV2HumanPairwiseOperatorManifestDigest(
    operatorManifest
  ),
  true
);

assert.equal(reviewPacket.reviewItems.length, 14);
assert.equal(operatorManifest.mappings.length, 14);
assert.equal(
  new Set(
    reviewPacket.reviewItems.map((item) => item.pairId)
  ).size,
  14
);
assert.equal(
  new Set(
    reviewPacket.reviewItems.map(
      (item) => item.evaluationCaseRef
    )
  ).size,
  14
);

for (const item of reviewPacket.reviewItems) {
  assert.equal(
    validateFaceLabV2HumanPairwiseReviewItem(item).ok,
    true,
    JSON.stringify(
      validateFaceLabV2HumanPairwiseReviewItem(item).errors,
      null,
      2
    )
  );
  assert.equal(
    verifyFaceLabV2HumanPairwiseDigest(
      item,
      "itemDigest",
      sha256Hex
    ),
    true
  );
  assert.deepEqual(
    Object.keys(item.options).sort(),
    ["A", "B"]
  );
}

assert.deepEqual(
  operatorManifest.sampling.bucketCounts,
  {
    route_mutation: 5,
    activation_boundary: 3,
    high_repetition: 6
  }
);

const highRepetition = operatorManifest.mappings
  .filter(
    (item) => item.sampleBucket === "high_repetition"
  );
assert.deepEqual(
  highRepetition
    .map((item) => item.targetKey)
    .sort(),
  [...FACE_LAB_V2_HIGH_REPETITION_TARGETS].sort()
);
assert.ok(
  highRepetition.every(
    (item) =>
      item.candidateRelationIds.length === 0 &&
      item.selectedRouteChanged === false
  )
);

const activationRows = operatorManifest.mappings.filter(
  (item) =>
    item.sampleBucket === "route_mutation" ||
    item.sampleBucket === "activation_boundary"
);
assert.equal(activationRows.length, 8);
assert.ok(
  activationRows.every(
    (item) => item.candidateRelationIds.length > 0
  )
);

const evaluation =
  runFaceLabV2CandidatePersonalizationEvaluation();
assert.deepEqual(
  activationRows
    .map((item) => item.evaluationCaseRef)
    .sort(),
  evaluation.rows
    .filter(
      (row) => row.candidateRelationIds.length > 0
    )
    .map((row) => row.caseId)
    .sort()
);

const routeMutation = operatorManifest.mappings.filter(
  (item) => item.sampleBucket === "route_mutation"
);
const activationBoundary = operatorManifest.mappings.filter(
  (item) => item.sampleBucket === "activation_boundary"
);
assert.ok(
  routeMutation.every(
    (item) => item.selectedRouteChanged === true
  )
);
assert.ok(
  activationBoundary.every(
    (item) => item.selectedRouteChanged === false
  )
);

for (const mapping of operatorManifest.mappings) {
  const item = reviewPacket.reviewItems.find(
    (candidate) =>
      candidate.pairId === mapping.pairId
  );
  assert.ok(item);
  assert.equal(
    mapping.mapping.A.recommendationDigest,
    item.options.A.recommendationDigest
  );
  assert.equal(
    mapping.mapping.B.recommendationDigest,
    item.options.B.recommendationDigest
  );

  if (mapping.sampleBucket === "route_mutation") {
    assert.notEqual(
      item.options.A.recommendationDigest,
      item.options.B.recommendationDigest
    );
  } else {
    assert.equal(
      item.options.A.recommendationDigest,
      item.options.B.recommendationDigest
    );
  }
}

const rolesOnA = operatorManifest.mappings.reduce(
  (counter, item) => {
    const role = item.mapping.A.role;
    counter[role] = (counter[role] || 0) + 1;
    return counter;
  },
  {}
);
assert.deepEqual(rolesOnA, {
  current: 7,
  candidate: 7
});

const serializedReview = JSON.stringify(reviewPacket);
for (const forbidden of [
  "FL-CAND-",
  "candidate_relation:",
  "candidate_face_fit_",
  "face-lab-style-delta-candidate-v1",
  "sampleBucket",
  "selectedRouteChanged",
  "candidateRelationIds",
  "operator-manifest",
  "\"role\":\"current\"",
  "\"role\":\"candidate\""
]) {
  assert.ok(
    !serializedReview.includes(forbidden),
    "reviewer packet leaked operator-only state: " +
      forbidden
  );
}

assert.ok(
  serializedReview.includes(
    "face_feature:straightCurveBalance="
  ),
  "reviewer packet must preserve visible face evidence when it is recommendation-relevant"
);
assert.ok(
  serializedReview.includes(
    "face_fit_curve_alignment"
  ) ||
    serializedReview.includes(
      "face_fit_straight_alignment"
    ),
  "reviewer packet must preserve role-neutral rationale differences"
);

console.log(JSON.stringify({
  ok: true,
  builderVersion:
    FACE_LAB_V2_HUMAN_PAIRWISE_BUILDER_VERSION,
  packetId: reviewPacket.packetId,
  packetDigest: reviewPacket.packetDigest,
  pairCount: reviewPacket.reviewItems.length,
  bucketCounts:
    operatorManifest.sampling.bucketCounts,
  rolesOnA,
  highRepetitionTargets:
    operatorManifest.sampling.highRepetitionTargets,
  operatorManifestDigest:
    operatorManifest.manifestDigest
}, null, 2));

console.log("BEGIN_REVIEW_PACKET_JSON");
console.log(JSON.stringify(reviewPacket, null, 2));
console.log("END_REVIEW_PACKET_JSON");
