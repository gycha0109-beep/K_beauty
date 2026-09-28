import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  FACE_LAB_V2_HUMAN_PAIRWISE_BLIND_STATE,
  FACE_LAB_V2_HUMAN_PAIRWISE_CONTRACT_VERSION,
  FACE_LAB_V2_HUMAN_PAIRWISE_JUDGMENT_SCHEMA,
  FACE_LAB_V2_HUMAN_PAIRWISE_REVEAL_SCHEMA,
  FACE_LAB_V2_HUMAN_PAIRWISE_REVIEW_ITEM_SCHEMA,
  canonicalizeFaceLabV2HumanPairwiseArtifact,
  validateFaceLabV2HumanPairwiseArtifact,
  validateFaceLabV2HumanPairwiseBindings,
  validateFaceLabV2HumanPairwiseJudgment,
  validateFaceLabV2HumanPairwiseReveal,
  validateFaceLabV2HumanPairwiseReviewItem,
  verifyFaceLabV2HumanPairwiseDigest
} from "../lib/face-lab-v2/evaluation/human-pairwise-contract.js";

function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

function seal(value, digestKey) {
  const next = { ...structuredClone(value), [digestKey]: "0".repeat(64) };
  const payload = canonicalizeFaceLabV2HumanPairwiseArtifact(
    next,
    digestKey
  );
  next[digestKey] = sha256Hex(payload);
  return next;
}

const reviewItem = seal({
  schemaVersion: FACE_LAB_V2_HUMAN_PAIRWISE_REVIEW_ITEM_SCHEMA,
  contractVersion: FACE_LAB_V2_HUMAN_PAIRWISE_CONTRACT_VERSION,
  pairId: "flhp_111111111111111111111111",
  evaluationCaseRef: "FL-TS-001-01",
  context: {
    targetLabel: "chic",
    targetVector: {
      softSharp: 0.79,
      naturalPolished: 0.765,
      playfulMature: 0.735,
      minimalStatement: 0.585,
      warmCool: 0.685,
      classicTrendy: 0.6
    },
    currentFaceFeatures: [
      {
        key: "eyeDirection",
        direction: "upturned",
        evidence: ["outer eye direction is visibly elevated"]
      },
      {
        key: "contourDefinition",
        direction: "defined",
        evidence: ["jaw boundary is clearly delineated"]
      }
    ],
    stylingScope: ["hair", "makeup"],
    constraints: {
      changeTolerance: "moderate",
      makeupIntensity: "medium"
    }
  },
  options: {
    A: {
      recommendationDigest: "a".repeat(64),
      routeStrategy: "balanced",
      actions: [
        {
          domain: "hair",
          parameter: "outlineDefinition",
          direction: "maintain",
          strength: "light",
          reason: "face_modifier_contour_already_defined",
          evidence: ["face_feature:contourDefinition=defined"],
          explanation: "Keep the existing outline definition rather than sharpening it further."
        }
      ]
    },
    B: {
      recommendationDigest: "b".repeat(64),
      routeStrategy: "balanced",
      actions: [
        {
          domain: "makeup",
          parameter: "eyeDefinition",
          direction: "increase",
          strength: "light",
          reason: "face_modifier_eye_direction_already_upturned",
          evidence: ["face_feature:eyeDirection=upturned"],
          explanation: "Use definition and length instead of adding more upward angle."
        }
      ]
    }
  },
  blindState: { ...FACE_LAB_V2_HUMAN_PAIRWISE_BLIND_STATE },
  createdAt: "2026-09-28T00:00:00.000Z"
}, "itemDigest");

const judgment = seal({
  schemaVersion: FACE_LAB_V2_HUMAN_PAIRWISE_JUDGMENT_SCHEMA,
  contractVersion: FACE_LAB_V2_HUMAN_PAIRWISE_CONTRACT_VERSION,
  judgmentId: "flhj_222222222222222222222222",
  pairId: reviewItem.pairId,
  reviewItemDigest: reviewItem.itemDigest,
  reviewerId: "reviewer_r01",
  assessability: "assessable",
  assessabilityReasonCodes: [],
  dimensions: {
    target_fit: "A",
    specificity: "B",
    evidence_action_linkage: "B"
  },
  rationale: "The two options have different strengths on the bounded rubric.",
  submittedAt: "2026-09-28T00:01:00.000Z",
  sealState: "sealed"
}, "judgmentDigest");

const reveal = seal({
  schemaVersion: FACE_LAB_V2_HUMAN_PAIRWISE_REVEAL_SCHEMA,
  contractVersion: FACE_LAB_V2_HUMAN_PAIRWISE_CONTRACT_VERSION,
  revealId: "flhr_333333333333333333333333",
  pairId: reviewItem.pairId,
  reviewItemDigest: reviewItem.itemDigest,
  mapping: {
    A: {
      role: "current",
      engineVersion: "face-lab-v2-current",
      recommendationDigest: reviewItem.options.A.recommendationDigest
    },
    B: {
      role: "candidate",
      engineVersion: "face-lab-v2-candidate",
      recommendationDigest: reviewItem.options.B.recommendationDigest
    }
  },
  humanJudgmentDigests: [judgment.judgmentDigest],
  revealState: "revealed_after_human_seal",
  revealedAt: "2026-09-28T00:02:00.000Z"
}, "revealDigest");

assert.equal(validateFaceLabV2HumanPairwiseReviewItem(reviewItem).ok, true);
assert.equal(validateFaceLabV2HumanPairwiseJudgment(judgment).ok, true);
assert.equal(validateFaceLabV2HumanPairwiseReveal(reveal).ok, true);
assert.equal(validateFaceLabV2HumanPairwiseArtifact(reviewItem).ok, true);
assert.equal(validateFaceLabV2HumanPairwiseArtifact(judgment).ok, true);
assert.equal(validateFaceLabV2HumanPairwiseArtifact(reveal).ok, true);

assert.equal(
  verifyFaceLabV2HumanPairwiseDigest(reviewItem, "itemDigest", sha256Hex),
  true
);
assert.equal(
  verifyFaceLabV2HumanPairwiseDigest(judgment, "judgmentDigest", sha256Hex),
  true
);
assert.equal(
  verifyFaceLabV2HumanPairwiseDigest(reveal, "revealDigest", sha256Hex),
  true
);

assert.equal(
  validateFaceLabV2HumanPairwiseBindings({
    reviewItem,
    judgments: [judgment],
    reveal,
    sha256Hex
  }).ok,
  true
);

const leakedBlind = structuredClone(reviewItem);
leakedBlind.blindState.engineRoleHidden = false;
assert.equal(validateFaceLabV2HumanPairwiseReviewItem(leakedBlind).ok, false);

const leakedOption = structuredClone(reviewItem);
leakedOption.options.A.engineVersion = "current-secret";
assert.equal(validateFaceLabV2HumanPairwiseReviewItem(leakedOption).ok, false);

const unsealedJudgment = structuredClone(judgment);
unsealedJudgment.sealState = "draft";
assert.equal(validateFaceLabV2HumanPairwiseJudgment(unsealedJudgment).ok, false);

const forcedAssessability = structuredClone(judgment);
forcedAssessability.assessability = "not_assessable";
forcedAssessability.assessabilityReasonCodes = ["context_insufficient"];
assert.equal(validateFaceLabV2HumanPairwiseJudgment(forcedAssessability).ok, false);

const uncertainWithoutUncertain = structuredClone(judgment);
uncertainWithoutUncertain.assessability = "uncertain_assessability";
uncertainWithoutUncertain.assessabilityReasonCodes = ["rubric_ambiguous"];
assert.equal(
  validateFaceLabV2HumanPairwiseJudgment(uncertainWithoutUncertain).ok,
  false
);

const emptyReveal = structuredClone(reveal);
emptyReveal.humanJudgmentDigests = [];
assert.equal(validateFaceLabV2HumanPairwiseReveal(emptyReveal).ok, false);

const sameRoleReveal = structuredClone(reveal);
sameRoleReveal.mapping.B.role = "current";
assert.equal(validateFaceLabV2HumanPairwiseReveal(sameRoleReveal).ok, false);

const earlyReveal = seal({
  ...reveal,
  revealedAt: "2026-09-28T00:00:30.000Z"
}, "revealDigest");
assert.equal(
  validateFaceLabV2HumanPairwiseBindings({
    reviewItem,
    judgments: [judgment],
    reveal: earlyReveal,
    sha256Hex
  }).ok,
  false
);

const tamperedItem = structuredClone(reviewItem);
tamperedItem.context.targetLabel = "natural";
assert.equal(
  verifyFaceLabV2HumanPairwiseDigest(tamperedItem, "itemDigest", sha256Hex),
  false
);

assert.equal(
  validateFaceLabV2HumanPairwiseArtifact({
    schemaVersion: "face-lab-v2-bounded-llm-pairwise-judgment-v1"
  }).ok,
  false,
  "LLM judge artifacts remain unsupported until Human calibration is established"
);

console.log(JSON.stringify({
  ok: true,
  contractVersion: FACE_LAB_V2_HUMAN_PAIRWISE_CONTRACT_VERSION,
  schemas: {
    reviewItem: FACE_LAB_V2_HUMAN_PAIRWISE_REVIEW_ITEM_SCHEMA,
    judgment: FACE_LAB_V2_HUMAN_PAIRWISE_JUDGMENT_SCHEMA,
    reveal: FACE_LAB_V2_HUMAN_PAIRWISE_REVEAL_SCHEMA
  },
  dimensions: [
    "target_fit",
    "specificity",
    "evidence_action_linkage"
  ],
  humanJudgmentCount: 0,
  llmJudgeCallCount: 0,
  llmJudgeSchemaStatus: "unsupported_pending_human_calibration"
}, null, 2));
