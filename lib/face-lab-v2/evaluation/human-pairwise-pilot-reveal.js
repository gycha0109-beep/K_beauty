import { createHash } from "node:crypto";
import {
  FACE_LAB_V2_HUMAN_PAIRWISE_CONTRACT_VERSION,
  FACE_LAB_V2_HUMAN_PAIRWISE_REVEAL_SCHEMA,
  canonicalizeFaceLabV2HumanPairwiseArtifact,
  validateFaceLabV2HumanPairwiseBindings,
  validateFaceLabV2HumanPairwiseJudgment,
  verifyFaceLabV2HumanPairwiseDigest
} from "./human-pairwise-contract.js";
import {
  FACE_LAB_V2_HUMAN_PAIRWISE_BUILDER_VERSION,
  FACE_LAB_V2_HUMAN_PAIRWISE_OPERATOR_MANIFEST_SCHEMA,
  verifyFaceLabV2HumanPairwiseOperatorManifestDigest
} from "./human-pairwise-builder.js";
import { validateFaceLabV2PilotReviewPacket } from "./human-pairwise-pilot-intake.js";

export const FACE_LAB_V2_HUMAN_PAIRWISE_PILOT_REVEAL_VERSION =
  "face-lab-v2-human-pairwise-pilot-private-reveal-v1";

const sha256Hex = (text) => createHash("sha256").update(text).digest("hex");
const blocked = (reason) => ({ status: "blocked", reason, reveal: null });
const isObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const exactKeys = (value, keys) =>
  isObject(value) &&
  Object.keys(value).sort().join("|") === [...keys].sort().join("|");

const MANIFEST_KEYS = [
  "schemaVersion", "builderVersion", "contractVersion", "packetId",
  "reviewPacketDigest", "createdAt", "sampling", "mappings", "manifestDigest"
];

function validateOperatorManifest(manifest, packet) {
  if (
    !exactKeys(manifest, MANIFEST_KEYS) ||
    manifest.schemaVersion !== FACE_LAB_V2_HUMAN_PAIRWISE_OPERATOR_MANIFEST_SCHEMA ||
    manifest.builderVersion !== FACE_LAB_V2_HUMAN_PAIRWISE_BUILDER_VERSION ||
    manifest.contractVersion !== FACE_LAB_V2_HUMAN_PAIRWISE_CONTRACT_VERSION ||
    manifest.packetId !== packet.packetId ||
    manifest.reviewPacketDigest !== packet.packetDigest ||
    manifest.createdAt !== packet.createdAt ||
    !verifyFaceLabV2HumanPairwiseOperatorManifestDigest(manifest) ||
    !Array.isArray(manifest.mappings) ||
    manifest.mappings.length !== packet.reviewItems.length ||
    !isObject(manifest.sampling) ||
    manifest.sampling.pairCount !== packet.reviewItems.length
  ) return false;

  const ids = new Set();
  const reviews = new Map(
    packet.reviewItems.map((item) => [item.pairId, item])
  );
  for (const row of manifest.mappings) {
    if (!isObject(row) || ids.has(row.pairId)) return false;
    ids.add(row.pairId);
    const item = reviews.get(row.pairId);
    if (
      !item ||
      row.evaluationCaseRef !== item.evaluationCaseRef ||
      !exactKeys(row.mapping, ["A", "B"]) ||
      !["current", "candidate"].includes(row.mapping.A?.role) ||
      !["current", "candidate"].includes(row.mapping.B?.role) ||
      row.mapping.A.role === row.mapping.B.role ||
      typeof row.mapping.A.engineVersion !== "string" ||
      !row.mapping.A.engineVersion ||
      typeof row.mapping.B.engineVersion !== "string" ||
      !row.mapping.B.engineVersion ||
      row.mapping.A.recommendationDigest !== item.options.A.recommendationDigest ||
      row.mapping.B.recommendationDigest !== item.options.B.recommendationDigest
    ) return false;
  }
  return true;
}

/**
 * Operator-only: caller must keep the mapping inaccessible until independently
 * sealed Human judgments exist. No reviewer UI or network route uses this.
 * The digest proves internal integrity, not the operator's identity.
 */
export function buildFaceLabV2HumanPairwisePrivateReveal({
  reviewPacket,
  operatorManifest,
  pairId,
  judgments,
  revealedAt
} = {}) {
  if (!validateFaceLabV2PilotReviewPacket(reviewPacket)) {
    return blocked("review_packet_untrusted");
  }
  if (!Array.isArray(judgments) || judgments.length === 0) {
    return blocked("sealed_human_judgment_required");
  }
  if (!validateOperatorManifest(operatorManifest, reviewPacket)) {
    return blocked("operator_manifest_untrusted");
  }

  const reviewItem = reviewPacket.reviewItems.find(
    (item) => item.pairId === pairId
  );
  const mapRow = operatorManifest.mappings.find(
    (item) => item.pairId === pairId
  );
  if (!reviewItem || !mapRow) {
    return blocked("reveal_pair_not_in_frozen_packet");
  }
  if (
    typeof revealedAt !== "string" ||
    !Number.isFinite(Date.parse(revealedAt)) ||
    new Date(revealedAt).toISOString() !== revealedAt
  ) return blocked("reveal_time_invalid");

  const reviewers = new Set();
  const judgmentIds = new Set();
  for (const judgment of judgments) {
    if (
      !validateFaceLabV2HumanPairwiseJudgment(judgment).ok ||
      !verifyFaceLabV2HumanPairwiseDigest(
        judgment, "judgmentDigest", sha256Hex
      ) ||
      judgment.pairId !== reviewItem.pairId ||
      judgment.reviewItemDigest !== reviewItem.itemDigest ||
      Date.parse(judgment.submittedAt) < Date.parse(reviewItem.createdAt) ||
      Date.parse(judgment.submittedAt) > Date.parse(revealedAt) ||
      reviewers.has(judgment.reviewerId) ||
      judgmentIds.has(judgment.judgmentId)
    ) return blocked("human_seal_binding_invalid");
    reviewers.add(judgment.reviewerId);
    judgmentIds.add(judgment.judgmentId);
  }

  const digests = judgments.map((value) => value.judgmentDigest).sort();
  const reveal = {
    schemaVersion: FACE_LAB_V2_HUMAN_PAIRWISE_REVEAL_SCHEMA,
    contractVersion: FACE_LAB_V2_HUMAN_PAIRWISE_CONTRACT_VERSION,
    revealId: "flhr_" + sha256Hex(
      [pairId, revealedAt, ...digests].join("|")
    ).slice(0, 24),
    pairId,
    reviewItemDigest: reviewItem.itemDigest,
    mapping: structuredClone(mapRow.mapping),
    humanJudgmentDigests: digests,
    revealState: "revealed_after_human_seal",
    revealedAt,
    revealDigest: "0".repeat(64)
  };
  const canonical = canonicalizeFaceLabV2HumanPairwiseArtifact(
    reveal, "revealDigest"
  );
  if (!canonical) return blocked("reveal_canonicalization_failed");
  reveal.revealDigest = sha256Hex(canonical);

  if (!validateFaceLabV2HumanPairwiseBindings({
    reviewItem, judgments, reveal, sha256Hex
  }).ok) return blocked("reveal_binding_invalid");

  return { status: "revealed", reason: null, reveal };
}
