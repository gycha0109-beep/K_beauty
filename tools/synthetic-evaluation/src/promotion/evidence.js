import {
  PROMOTION_EVIDENCE_BUNDLE_SCHEMA_VERSION,
  validatePromotionEvidenceBundleShape
} from "@bejewely/face-contracts";
import { deepFreeze, sha256Hex, stableStringify } from "../shared/canonical-json.js";
import { PROMOTION_POLICY_DIGEST } from "./policy.js";
import {
  verifyPromotionAssetPolicyReviewIntegrity,
  verifyPromotionLeakageReviewIntegrity,
  verifyPromotionOperatorReattestationIntegrity,
  verifyUsageRightsReviewIntegrity
} from "./reviews.js";
import { verifyPromotionSourceSnapshotIntegrity } from "./source-snapshot.js";

function failure(code, path, detail = null) {
  return Object.freeze({ ok: false, errors: Object.freeze([{ code, path, detail }]) });
}

function semanticOf(bundle) {
  const { assembledAt, bundleDigest, ...semantic } = bundle;
  return semantic;
}

function referencesSnapshot(snapshot, artifact) {
  return artifact.candidateId === snapshot.candidate.candidateId &&
    artifact.sourceSnapshotDigest === snapshot.sourceSnapshotDigest;
}

export function assemblePromotionEvidenceBundle({
  snapshot,
  operatorReattestation,
  rightsReview,
  assetPolicyReview,
  leakageReview,
  assembledAt = new Date().toISOString()
}) {
  if (!verifyPromotionSourceSnapshotIntegrity(snapshot) || !Number.isFinite(Date.parse(assembledAt))) {
    return failure("promotion_evidence_bundle_invalid", "snapshot");
  }
  const checks = [
    [operatorReattestation, verifyPromotionOperatorReattestationIntegrity, "operatorReattestation"],
    [rightsReview, verifyUsageRightsReviewIntegrity, "rightsReview"],
    [assetPolicyReview, verifyPromotionAssetPolicyReviewIntegrity, "assetPolicyReview"],
    [leakageReview, verifyPromotionLeakageReviewIntegrity, "leakageReview"]
  ];
  for (const [artifact, verify, path] of checks) {
    if (!verify(artifact) || !referencesSnapshot(snapshot, artifact)) return failure("promotion_evidence_bundle_invalid", path);
  }
  if (
    operatorReattestation.fullProjectionDigest !== snapshot.candidate.fullProjectionDigest ||
    rightsReview.providerProfileId !== snapshot.generation.providerProfileId ||
    assetPolicyReview.canonicalSha256 !== snapshot.candidate.canonicalSha256
  ) {
    return failure("promotion_evidence_bundle_invalid", "reviewReferences");
  }
  const semantic = {
    schemaVersion: PROMOTION_EVIDENCE_BUNDLE_SCHEMA_VERSION,
    promotionKey: snapshot.promotionKey,
    sourceSnapshotDigest: snapshot.sourceSnapshotDigest,
    operatorReattestationDigest: operatorReattestation.attestationDigest,
    rightsReviewDigest: rightsReview.reviewDigest,
    assetPolicyReviewDigest: assetPolicyReview.reviewDigest,
    leakageReviewDigest: leakageReview.reviewDigest,
    policyDigest: PROMOTION_POLICY_DIGEST
  };
  const bundleDigest = sha256Hex(stableStringify(semantic));
  const bundle = deepFreeze({ ...semantic, assembledAt, bundleDigest });
  return verifyPromotionEvidenceBundleIntegrity(bundle)
    ? Object.freeze({ ok: true, bundle })
    : failure("promotion_evidence_bundle_invalid", "bundle");
}

export function verifyPromotionEvidenceBundleIntegrity(bundle) {
  return validatePromotionEvidenceBundleShape(bundle).ok &&
    bundle.policyDigest === PROMOTION_POLICY_DIGEST &&
    bundle.bundleDigest === sha256Hex(stableStringify(semanticOf(bundle)));
}
