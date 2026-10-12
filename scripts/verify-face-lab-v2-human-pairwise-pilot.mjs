import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  buildFaceLabV2HumanPairwiseOperatorManifest,
  buildFaceLabV2HumanPairwiseReviewPacket
} from "../lib/face-lab-v2/evaluation/human-pairwise-builder.js";
import {
  validateFaceLabV2HumanPairwiseBindings
} from "../lib/face-lab-v2/evaluation/human-pairwise-contract.js";
import {
  sealFaceLabV2HumanPairwisePilotJudgment,
  validateFaceLabV2PilotReviewPacket
} from "../lib/face-lab-v2/evaluation/human-pairwise-pilot-intake.js";
import {
  buildFaceLabV2HumanPairwisePrivateReveal
} from "../lib/face-lab-v2/evaluation/human-pairwise-pilot-reveal.js";

const sha256Hex = (text) => createHash("sha256").update(text).digest("hex");
const packet = buildFaceLabV2HumanPairwiseReviewPacket();
const manifest = buildFaceLabV2HumanPairwiseOperatorManifest();
const item = packet.reviewItems[0];
const at = "2026-10-12T06:00:00.000Z";
const revealAt = "2026-10-12T07:00:00.000Z";

assert.equal(validateFaceLabV2PilotReviewPacket(packet), true);
assert.equal(packet.packetId, manifest.packetId);
assert.ok(packet.reviewItems.length > 0);
assert.ok(item);
assert.equal(Object.hasOwn(packet, "mappings"), false);
assert.equal(Object.hasOwn(item, "engineVersion"), false);

const submission = (overrides = {}) => ({
  packetId: packet.packetId,
  pairId: item.pairId,
  reviewItemDigest: item.itemDigest,
  reviewerId: "reviewer_synthetic_fixture_001",
  assessability: "assessable",
  assessabilityReasonCodes: [],
  dimensions: {
    target_fit: "A",
    specificity: "tie",
    evidence_action_linkage: "uncertain"
  },
  rationale: "SYNTHETIC CONTRACT FIXTURE — not a human judgment.",
  submittedAt: at,
  ...overrides
});
const seal = (data = submission(), reviewPacket = packet) =>
  sealFaceLabV2HumanPairwisePilotJudgment({ reviewPacket, submission: data });
const reveal = (params = {}) => buildFaceLabV2HumanPairwisePrivateReveal({
  reviewPacket: packet,
  operatorManifest: manifest,
  pairId: item.pairId,
  judgments: [],
  revealedAt: revealAt,
  ...params
});

const intake = seal();
assert.equal(intake.status, "sealed", JSON.stringify(intake));
assert.equal(intake.judgment.sealState, "sealed");
assert.equal(intake.judgment.pairId, item.pairId);
assert.equal(intake.judgment.reviewItemDigest, item.itemDigest);
assert.match(intake.judgment.judgmentDigest, /^[a-f0-9]{64}$/);
assert.deepEqual(seal(), intake); // Deterministic sealed artifact.
assert.equal(reveal().reason, "sealed_human_judgment_required");

const opened = reveal({ judgments: [intake.judgment] });
assert.equal(opened.status, "revealed", JSON.stringify(opened));
assert.equal(opened.reveal.revealState, "revealed_after_human_seal");
assert.equal(opened.reveal.reviewItemDigest, item.itemDigest);
assert.deepEqual(
  [opened.reveal.mapping.A.role, opened.reveal.mapping.B.role].sort(),
  ["candidate", "current"]
);
assert.deepEqual(
  opened.reveal.humanJudgmentDigests,
  [intake.judgment.judgmentDigest]
);
assert.equal(
  validateFaceLabV2HumanPairwiseBindings({
    reviewItem: item, judgments: [intake.judgment],
    reveal: opened.reveal, sha256Hex
  }).ok, true
);
assert.deepEqual(reveal({ judgments: [intake.judgment] }), opened);

const deniedIntakes = [
  submission({ packetId: "flhpb_" + "a".repeat(24) }),
  submission({ pairId: "flhp_" + "b".repeat(24) }),
  submission({ reviewItemDigest: "0".repeat(64) }),
  submission({ reviewerId: "bad-reviewer" }),
  submission({ submittedAt: "2026-01-01T00:00:00.000Z" }),
  submission({ submittedAt: "not-a-time" }),
  submission({ assessability: "not_assessable" }),
  submission({ assessability: "uncertain_assessability" }),
  submission({ dimensions: {
    target_fit: "A", specificity: "not_assessable",
    evidence_action_linkage: "tie"
  } }),
  submission({ assessabilityReasonCodes: ["invented_reason"] }),
  submission({ dimensionWinner: "A" })
];
deniedIntakes.forEach((data, index) => {
  assert.equal(
    seal(data).status,
    "blocked",
    "invalid submission " + index
  );
});

const uncertain = seal(submission({
  reviewerId: "reviewer_synthetic_fixture_002",
  assessability: "uncertain_assessability",
  assessabilityReasonCodes: ["rubric_ambiguous"]
}));
assert.equal(uncertain.status, "sealed");
const unable = seal(submission({
  reviewerId: "reviewer_synthetic_fixture_003",
  assessability: "not_assessable",
  assessabilityReasonCodes: ["context_insufficient"],
  dimensions: {
    target_fit: "not_assessable",
    specificity: "not_assessable",
    evidence_action_linkage: "not_assessable"
  }
}));
assert.equal(unable.status, "sealed");

const openedThree = reveal({
  judgments: [unable.judgment, uncertain.judgment, intake.judgment]
});
assert.equal(openedThree.status, "revealed", JSON.stringify(openedThree));
assert.equal(openedThree.reveal.humanJudgmentDigests.length, 3);
assert.equal(
  reveal({
    judgments: [intake.judgment, uncertain.judgment, unable.judgment]
  }).reveal.revealDigest,
  openedThree.reveal.revealDigest
);

const corruptedPacket = structuredClone(packet);
corruptedPacket.reviewItems[0].options.A.actions[0].explanation =
  "tampered masked recommendation";
assert.equal(validateFaceLabV2PilotReviewPacket(corruptedPacket), false);
assert.equal(seal(submission(), corruptedPacket).status, "blocked");

const mutatedManifest = structuredClone(manifest);
mutatedManifest.mappings[0].mapping.A.role =
  manifest.mappings[0].mapping.A.role === "current" ? "candidate" : "current";
assert.equal(
  reveal({
    operatorManifest: mutatedManifest, judgments: [intake.judgment]
  }).status,
  "blocked"
);
const wrongPacketManifest = structuredClone(manifest);
wrongPacketManifest.reviewPacketDigest = "0".repeat(64);
assert.equal(
  reveal({
    operatorManifest: wrongPacketManifest, judgments: [intake.judgment]
  }).status,
  "blocked"
);

const tamperedSeal = structuredClone(intake.judgment);
tamperedSeal.dimensions.specificity = "B";
const wrongReviewItemSeal = structuredClone(intake.judgment);
wrongReviewItemSeal.reviewItemDigest = "f".repeat(64);
[
  [tamperedSeal],
  [wrongReviewItemSeal],
  [intake.judgment, intake.judgment],
  [intake.judgment, tamperedSeal]
].forEach((judgments, index) => {
  assert.equal(
    reveal({ judgments }).status,
    "blocked",
    "invalid seal list " + index
  );
});
assert.equal(
  reveal({ pairId: "flhp_" + "0".repeat(24),
    judgments: [intake.judgment] }).status,
  "blocked"
);
assert.equal(
  reveal({ revealedAt: at, judgments: [intake.judgment] }).status,
  "revealed" // Existing contract permits seal and reveal at same timestamp.
);
assert.equal(
  reveal({
    revealedAt: "2026-10-12T05:59:59.000Z",
    judgments: [intake.judgment]
  }).status,
  "blocked"
);
assert.equal(
  reveal({
    revealedAt: "2026-10-12",
    judgments: [intake.judgment]
  }).status,
  "blocked"
);
assert.equal(
  reveal({
    reviewPacket: corruptedPacket,
    judgments: [intake.judgment]
  }).status,
  "blocked"
);

// This verifier makes synthetic fixtures only; it never records real reviewers.
console.log(JSON.stringify({
  status: "PASS",
  stage: "FACE_LAB_HUMAN_PAIRWISE_PILOT_E1_OFFLINE",
  syntheticFixtureJudgments: 3,
  realHumanJudgments: 0,
  llmJudgeCalls: 0,
  productionWrites: 0,
  enginePromotion: false
}));
