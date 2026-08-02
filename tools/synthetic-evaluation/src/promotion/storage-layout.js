import path from "node:path";

export function promotionSourceSnapshotRelativePath(candidateId, digest) {
  return path.posix.join("promotion", "source-snapshots", candidateId, `${digest}.json`);
}

export function promotionReattestationRelativePath(candidateId, digest) {
  return path.posix.join("promotion", "reattestations", candidateId, `${digest}.json`);
}

export function promotionRightsReviewRelativePath(candidateId, digest) {
  return path.posix.join("promotion", "rights", candidateId, `${digest}.json`);
}

export function promotionAssetReviewRelativePath(candidateId, digest) {
  return path.posix.join("promotion", "asset-policy", candidateId, `${digest}.json`);
}

export function promotionLeakageReviewRelativePath(candidateId, digest) {
  return path.posix.join("promotion", "leakage", candidateId, `${digest}.json`);
}

export function promotionEvidenceBundleRelativePath(candidateId, digest) {
  return path.posix.join("promotion", "evidence", candidateId, `${digest}.json`);
}

export function promotionReviewRelativePath(promotionKey, digest) {
  return path.posix.join("promotion", "reviews", promotionKey, `${digest}.json`);
}

export function promotionDecisionRelativePath(promotionKey, digest) {
  return path.posix.join("promotion", "decisions", promotionKey, `${digest}.json`);
}

export function promotionG4GradeRelativePath(candidateId, digest) {
  return path.posix.join("promotion", "grades", candidateId, `${digest}.json`);
}

export function promotionStatusEventRelativePath(promotionKey, digest) {
  return path.posix.join("promotion", "status-events", promotionKey, `${digest}.json`);
}

export function toNativePromotionPath(root, relativePath) {
  return path.join(root, ...relativePath.split("/"));
}
