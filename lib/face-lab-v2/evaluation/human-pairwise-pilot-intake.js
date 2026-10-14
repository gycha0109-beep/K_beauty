import { createHash } from "node:crypto";
import {
  FACE_LAB_V2_HUMAN_PAIRWISE_CONTRACT_VERSION,
  FACE_LAB_V2_HUMAN_PAIRWISE_DIMENSIONS,
  FACE_LAB_V2_HUMAN_PAIRWISE_JUDGMENT_SCHEMA,
  canonicalizeFaceLabV2HumanPairwiseArtifact,
  validateFaceLabV2HumanPairwiseJudgment,
  validateFaceLabV2HumanPairwiseReviewItem,
  verifyFaceLabV2HumanPairwiseDigest
} from "./human-pairwise-contract.js";
import {
  FACE_LAB_V2_HUMAN_PAIRWISE_BUILDER_VERSION,
  FACE_LAB_V2_HUMAN_PAIRWISE_REVIEW_PACKET_SCHEMA,
  verifyFaceLabV2HumanPairwisePacketDigest
} from "./human-pairwise-builder.js";

export const FACE_LAB_V2_HUMAN_PAIRWISE_PILOT_INTAKE_VERSION =
  "face-lab-v2-human-pairwise-pilot-intake-v1";

const PACKET_KEYS = [
  "schemaVersion", "builderVersion", "contractVersion", "packetId",
  "dimensions", "reviewItems", "createdAt", "packetDigest"
];
const SUBMISSION_KEYS = [
  "packetId", "pairId", "reviewItemDigest", "reviewerId",
  "assessability", "assessabilityReasonCodes", "dimensions",
  "rationale", "submittedAt"
];

const isObject = (x) => Boolean(x) && typeof x === "object" && !Array.isArray(x);
const exactKeys = (value, keys) =>
  isObject(value) &&
  Object.keys(value).sort().join("|") === [...keys].sort().join("|");
const sha256Hex = (text) => createHash("sha256").update(text).digest("hex");
const blocked = (reason) => ({ status: "blocked", reason, judgment: null });

export function validateFaceLabV2PilotReviewPacket(packet) {
  if (
    !exactKeys(packet, PACKET_KEYS) ||
    packet.schemaVersion !== FACE_LAB_V2_HUMAN_PAIRWISE_REVIEW_PACKET_SCHEMA ||
    packet.builderVersion !== FACE_LAB_V2_HUMAN_PAIRWISE_BUILDER_VERSION ||
    packet.contractVersion !== FACE_LAB_V2_HUMAN_PAIRWISE_CONTRACT_VERSION ||
    typeof packet.packetId !== "string" ||
    !/^flhpb_[a-f0-9]{24}$/.test(packet.packetId) ||
    !Array.isArray(packet.dimensions) ||
    packet.dimensions.join("|") !== FACE_LAB_V2_HUMAN_PAIRWISE_DIMENSIONS.join("|") ||
    !Array.isArray(packet.reviewItems) ||
    packet.reviewItems.length === 0 ||
    typeof packet.createdAt !== "string" ||
    !verifyFaceLabV2HumanPairwisePacketDigest(packet)
  ) return false;

  const seen = new Set();
  for (const item of packet.reviewItems) {
    if (
      !validateFaceLabV2HumanPairwiseReviewItem(item).ok ||
      !verifyFaceLabV2HumanPairwiseDigest(item, "itemDigest", sha256Hex) ||
      item.contractVersion !== packet.contractVersion ||
      item.createdAt !== packet.createdAt ||
      seen.has(item.pairId)
    ) return false;
    seen.add(item.pairId);
  }
  return true;
}

/**
 * Seal a real reviewer's submitted judgment without ever receiving the
 * private A/B-to-engine mapping. Hashes detect mutations, not human identity.
 * No disk, API, database, LLM or provider access occurs.
 */
export function sealFaceLabV2HumanPairwisePilotJudgment({
  reviewPacket,
  submission
} = {}) {
  if (!validateFaceLabV2PilotReviewPacket(reviewPacket)) {
    return blocked("review_packet_untrusted");
  }
  if (!exactKeys(submission, SUBMISSION_KEYS)) {
    return blocked("submission_shape_invalid");
  }
  if (submission.packetId !== reviewPacket.packetId) {
    return blocked("submission_packet_mismatch");
  }
  const items = reviewPacket.reviewItems.filter(
    (item) => item.pairId === submission.pairId
  );
  if (items.length !== 1 ||
      submission.reviewItemDigest !== items[0].itemDigest) {
    return blocked("submission_review_item_mismatch");
  }

  const submittedAt = Date.parse(submission.submittedAt);
  const createdAt = Date.parse(items[0].createdAt);
  if (!Number.isFinite(submittedAt) || submittedAt < createdAt) {
    return blocked("submission_time_invalid");
  }

  const judgmentId =
    "flhj_" + sha256Hex(
      [reviewPacket.packetId, submission.pairId,
        submission.reviewerId, submission.submittedAt,
        JSON.stringify(submission.dimensions), submission.assessability].join("|")
    ).slice(0, 24);

  const judgment = {
    schemaVersion: FACE_LAB_V2_HUMAN_PAIRWISE_JUDGMENT_SCHEMA,
    contractVersion: FACE_LAB_V2_HUMAN_PAIRWISE_CONTRACT_VERSION,
    judgmentId,
    pairId: submission.pairId,
    reviewItemDigest: items[0].itemDigest,
    reviewerId: submission.reviewerId,
    assessability: submission.assessability,
    assessabilityReasonCodes: structuredClone(submission.assessabilityReasonCodes),
    dimensions: structuredClone(submission.dimensions),
    rationale: submission.rationale,
    submittedAt: submission.submittedAt,
    sealState: "sealed",
    judgmentDigest: "0".repeat(64)
  };

  if (!validateFaceLabV2HumanPairwiseJudgment(judgment).ok) {
    return blocked("submission_contract_invalid");
  }
  const canonical = canonicalizeFaceLabV2HumanPairwiseArtifact(
    judgment, "judgmentDigest"
  );
  if (!canonical) return blocked("submission_canonicalization_failed");
  judgment.judgmentDigest = sha256Hex(canonical);

  if (!verifyFaceLabV2HumanPairwiseDigest(
    judgment, "judgmentDigest", sha256Hex
  )) return blocked("judgment_seal_invalid");

  return { status: "sealed", reason: null, judgment };
}
