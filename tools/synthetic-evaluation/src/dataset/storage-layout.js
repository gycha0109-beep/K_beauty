import path from "node:path";

function objectPath(type, digest) {
  return path.posix.join("objects", type, "sha256", digest.slice(0, 2), `${digest}.json`);
}

export const datasetStorageLayout = Object.freeze({
  sourceSnapshot: (digest) => objectPath("dataset-source-snapshots", digest),
  leakageGraph: (digest) => objectPath("leakage-graphs", digest),
  splitPlan: (digest) => objectPath("split-plans", digest),
  splitAssignment: (digest) => objectPath("split-assignments", digest),
  lockReview: (digest) => objectPath("dataset-lock-reviews", digest),
  member: (digest) => objectPath("dataset-members", digest),
  lockBasis: (digest) => objectPath("dataset-lock-bases", digest),
  datasetVersion: (digest) => objectPath("dataset-version-manifests", digest),
  exposureClaim: (digest) => objectPath("exposure-claims", digest),
  g5Record: (digest) => objectPath("g5-holdout-records", digest),
  datasetStatusEvent: (digest) => objectPath("dataset-status-events", digest),
  g5StatusEvent: (digest) => objectPath("g5-status-events", digest),
  activation: (digest) => objectPath("dataset-activation-manifests", digest),
  baselineRequest: (digest) => objectPath("regression-baseline-requests", digest),
  baselineReview: (digest) => objectPath("regression-baseline-reviews", digest),
  baseline: (digest) => objectPath("regression-baselines", digest),
  datasetRoot: (lineageId, versionId) => path.posix.join("datasets", lineageId, versionId),
  lockedManifest: (lineageId, versionId) => path.posix.join("datasets", lineageId, versionId, "locked-manifest.json"),
  activationManifest: (lineageId, versionId) => path.posix.join("datasets", lineageId, versionId, "activation-manifest.json"),
  memberIndex: (lineageId, versionId) => path.posix.join("datasets", lineageId, versionId, "member-index.json"),
  exposureIndex: (lineageId, versionId) => path.posix.join("datasets", lineageId, versionId, "exposure-index.json"),
  g5Index: (lineageId, versionId) => path.posix.join("datasets", lineageId, versionId, "g5-index.json"),
  g5StatusIndex: (lineageId, versionId) => path.posix.join("datasets", lineageId, versionId, "g5-status-index.json"),
  datasetStatusIndex: (lineageId, versionId) => path.posix.join("datasets", lineageId, versionId, "dataset-status-index.json"),
  activationClaim: (lineageId, versionId) => path.posix.join("datasets", "activation-claims", lineageId, `${versionId}.json`),
  lineageSuccessorClaim: (lineageId, predecessorDigest) => path.posix.join("datasets", "lineage-successor-claims", lineageId, `${predecessorDigest || "root"}.json`),
  exposureHeadClaim: (lineageId, fingerprint) => path.posix.join("datasets", "exposure-heads", lineageId, `${fingerprint}.json`),
  statusSuccessorClaim: (datasetVersionDigest, predecessorDigest) => path.posix.join("datasets", "status-successor-claims", datasetVersionDigest, `${predecessorDigest}.json`),
  g5StatusSuccessorClaim: (g5Digest, predecessorDigest) => path.posix.join("datasets", "g5-status-successor-claims", g5Digest, `${predecessorDigest}.json`),
  holdoutMaterialization: (datasetVersionDigest, authorizationDigest) => path.posix.join("datasets", "holdout-materializations", datasetVersionDigest, `${authorizationDigest}.json`),
  baselineActivationClaim: (datasetVersionDigest, modelArtifactDigest) => path.posix.join("datasets", "baseline-activation-claims", datasetVersionDigest, `${modelArtifactDigest}.json`)
});

export function nativeDatasetPath(root, relativePath) {
  return path.join(root, ...relativePath.split("/"));
}
