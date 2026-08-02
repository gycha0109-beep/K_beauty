import {
  PROMOTION_ASSET_POLICY_REVIEW_SCHEMA_VERSION,
  PROMOTION_LEAKAGE_REVIEW_SCHEMA_VERSION,
  PROMOTION_OPERATOR_REATTESTATION_SCHEMA_VERSION,
  PROMOTION_USE_SCOPE,
  USAGE_RIGHTS_REVIEW_SCHEMA_VERSION,
  validatePromotionAssetPolicyReviewShape,
  validatePromotionLeakageReviewShape,
  validatePromotionOperatorReattestationShape,
  validateUsageRightsReviewShape
} from "@bejewely/face-contracts";
import { deepFreeze, sha256Hex, stableStringify } from "../shared/canonical-json.js";
import { verifyPromotionSourceSnapshotIntegrity } from "./source-snapshot.js";

function exactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function failure(code, path, detail = null) {
  return Object.freeze({ ok: false, errors: Object.freeze([{ code, path, detail }]) });
}

function digestArtifact(semantic, timestampKey, timestampValue, digestKey) {
  const digest = sha256Hex(stableStringify(semantic));
  return deepFreeze({ ...semantic, [timestampKey]: timestampValue, [digestKey]: digest });
}

function verifyDigest(value, timestampKey, digestKey) {
  const { [timestampKey]: timestamp, [digestKey]: digest, ...semantic } = value;
  return Number.isFinite(Date.parse(timestamp)) && digest === sha256Hex(stableStringify(semantic));
}

export function finalizePromotionOperatorReattestation({ snapshot, draft }) {
  if (!verifyPromotionSourceSnapshotIntegrity(snapshot) || !exactKeys(draft, ["operatorId", "syntheticOnlyConfirmed", "realPersonReferenceUsedConfirmed", "currentManifestReviewed", "attestedAt"])) {
    return failure("promotion_reattestation_invalid", "draft");
  }
  const semantic = {
    schemaVersion: PROMOTION_OPERATOR_REATTESTATION_SCHEMA_VERSION,
    candidateId: snapshot.candidate.candidateId,
    sourceSnapshotDigest: snapshot.sourceSnapshotDigest,
    fullProjectionDigest: snapshot.candidate.fullProjectionDigest,
    operatorId: draft.operatorId,
    syntheticOnlyConfirmed: draft.syntheticOnlyConfirmed,
    realPersonReferenceUsedConfirmed: draft.realPersonReferenceUsedConfirmed,
    currentManifestReviewed: draft.currentManifestReviewed
  };
  const artifact = digestArtifact(semantic, "attestedAt", draft.attestedAt, "attestationDigest");
  return validatePromotionOperatorReattestationShape(artifact).ok
    ? Object.freeze({ ok: true, artifact })
    : failure("promotion_reattestation_invalid", "draft");
}

export function verifyPromotionOperatorReattestationIntegrity(value) {
  return validatePromotionOperatorReattestationShape(value).ok && verifyDigest(value, "attestedAt", "attestationDigest");
}

export function finalizeUsageRightsReview({ snapshot, draft }) {
  if (!verifyPromotionSourceSnapshotIntegrity(snapshot) || !exactKeys(draft, ["reviewerId", "status", "sourcePolicy", "sourcePolicyEvidenceDigest", "reviewedAt"])) {
    return failure("promotion_rights_review_invalid", "draft");
  }
  const semantic = {
    schemaVersion: USAGE_RIGHTS_REVIEW_SCHEMA_VERSION,
    candidateId: snapshot.candidate.candidateId,
    sourceSnapshotDigest: snapshot.sourceSnapshotDigest,
    providerProfileId: snapshot.generation.providerProfileId,
    reviewScope: PROMOTION_USE_SCOPE,
    status: draft.status,
    reviewerId: draft.reviewerId,
    sourcePolicy: draft.sourcePolicy,
    sourcePolicyEvidenceDigest: draft.sourcePolicyEvidenceDigest
  };
  const artifact = digestArtifact(semantic, "reviewedAt", draft.reviewedAt, "reviewDigest");
  return validateUsageRightsReviewShape(artifact).ok
    ? Object.freeze({ ok: true, artifact })
    : failure("promotion_rights_review_invalid", "draft");
}

export function verifyUsageRightsReviewIntegrity(value) {
  return validateUsageRightsReviewShape(value).ok && verifyDigest(value, "reviewedAt", "reviewDigest");
}

export function finalizePromotionAssetPolicyReview({ snapshot, draft }) {
  if (!verifyPromotionSourceSnapshotIntegrity(snapshot) || !exactKeys(draft, ["reviewerId", "visibleExternalMark", "prohibitedTransformationDetected", "canonicalImageReviewed", "reviewedAt"])) {
    return failure("promotion_asset_review_invalid", "draft");
  }
  const semantic = {
    schemaVersion: PROMOTION_ASSET_POLICY_REVIEW_SCHEMA_VERSION,
    candidateId: snapshot.candidate.candidateId,
    sourceSnapshotDigest: snapshot.sourceSnapshotDigest,
    canonicalSha256: snapshot.candidate.canonicalSha256,
    reviewerId: draft.reviewerId,
    visibleExternalMark: draft.visibleExternalMark,
    prohibitedTransformationDetected: draft.prohibitedTransformationDetected,
    canonicalImageReviewed: draft.canonicalImageReviewed
  };
  const artifact = digestArtifact(semantic, "reviewedAt", draft.reviewedAt, "reviewDigest");
  return validatePromotionAssetPolicyReviewShape(artifact).ok
    ? Object.freeze({ ok: true, artifact })
    : failure("promotion_asset_review_invalid", "draft");
}

export function verifyPromotionAssetPolicyReviewIntegrity(value) {
  return validatePromotionAssetPolicyReviewShape(value).ok && verifyDigest(value, "reviewedAt", "reviewDigest");
}

function normalizeCouplingKeys(keys) {
  return [...keys]
    .map((item) => ({ kind: item.kind, key: item.key }))
    .sort((left, right) => `${left.kind}:${left.key}`.localeCompare(`${right.kind}:${right.key}`));
}

export function finalizePromotionLeakageReview({ snapshot, draft }) {
  if (!verifyPromotionSourceSnapshotIntegrity(snapshot) || !exactKeys(draft, ["exactCanonicalDisposition", "perceptualDisposition", "splitCouplingKeys", "reviewerId", "reviewedAt"])) {
    return failure("promotion_leakage_review_invalid", "draft");
  }
  const semantic = {
    schemaVersion: PROMOTION_LEAKAGE_REVIEW_SCHEMA_VERSION,
    candidateId: snapshot.candidate.candidateId,
    sourceSnapshotDigest: snapshot.sourceSnapshotDigest,
    exactCanonicalDisposition: draft.exactCanonicalDisposition,
    perceptualDisposition: draft.perceptualDisposition,
    splitCouplingKeys: normalizeCouplingKeys(draft.splitCouplingKeys),
    reviewerId: draft.reviewerId
  };
  const artifact = digestArtifact(semantic, "reviewedAt", draft.reviewedAt, "reviewDigest");
  const uniqueKeys = new Set(artifact.splitCouplingKeys.map((item) => `${item.kind}:${item.key}`));
  return validatePromotionLeakageReviewShape(artifact).ok && uniqueKeys.size === artifact.splitCouplingKeys.length
    ? Object.freeze({ ok: true, artifact })
    : failure("promotion_leakage_review_invalid", "draft");
}

export function verifyPromotionLeakageReviewIntegrity(value) {
  if (!validatePromotionLeakageReviewShape(value).ok || !verifyDigest(value, "reviewedAt", "reviewDigest")) return false;
  const normalized = normalizeCouplingKeys(value.splitCouplingKeys);
  return stableStringify(normalized) === stableStringify(value.splitCouplingKeys) &&
    new Set(normalized.map((item) => `${item.kind}:${item.key}`)).size === normalized.length;
}
