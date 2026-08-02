import { DATASET_SOURCE_SNAPSHOT_SCHEMA_VERSION } from "@bejewely/face-contracts";
import { DATASET_SOURCE_POLICY_RECORD } from "../../src/dataset/policy.js";
import { deepFreeze, sha256Hex, stableStringify } from "../../src/shared/canonical-json.js";

function hex(index, length = 64) { return index.toString(16).padStart(length, "0").slice(-length); }

export function emptyExposureRegistry(datasetLineageId = "dataset-lineage-v1") {
  const semantic = { datasetLineageId, heads: [], claimDigests: [] };
  return Object.freeze({ ok: true, heads: Object.freeze([]), claims: Object.freeze([]), registryDigest: sha256Hex(stableStringify(semantic)) });
}

export function createSourceSnapshot({ count = 10, coupledPairs = [], lineageId = "dataset-lineage-v1", purpose = "skin_cue_control" } = {}) {
  const exposure = emptyExposureRegistry(lineageId);
  const members = [];
  for (let index = 1; index <= count; index += 1) {
    const candidateId = `cand_${hex(index, 24)}`;
    const canonicalSha256 = hex(1000 + index);
    const claimValuesDigest = index % 2 === 0 ? "a".repeat(64) : "b".repeat(64);
    const keys = [{ kind: "canonical_sha256", key: canonicalSha256, sourceArtifactDigest: hex(2000 + index) }];
    for (const [left, right, key] of coupledPairs) if (index === left || index === right) keys.push({ kind: "reviewed_visual_similarity", key, sourceArtifactDigest: hex(3000 + left + right) });
    members.push({
      campaignRunId: `crun_${hex(500 + Math.ceil(index / 20), 24)}`,
      candidateId,
      candidateDigest: hex(4000 + index),
      canonicalSha256,
      canonicalObjectRelativePath: `objects/canonical/sha256/${canonicalSha256.slice(0, 2)}/${canonicalSha256}.png`,
      g4GradeRecordDigest: hex(5000 + index),
      g4StatusHeadDigest: hex(6000 + index),
      promotionKey: `prom_${hex(7000 + index, 24)}`,
      promotionSourceSnapshotDigest: hex(8000 + index),
      promotionEvidenceBundleDigest: hex(9000 + index),
      leakageReviewDigest: hex(10000 + index),
      claimValuesDigest,
      splitCouplingKeys: keys,
      splitCouplingKeysDigest: sha256Hex(stableStringify(keys))
    });
  }
  members.sort((a, b) => stableStringify([a.claimValuesDigest, a.canonicalSha256, a.candidateId, a.g4GradeRecordDigest]).localeCompare(stableStringify([b.claimValuesDigest, b.canonicalSha256, b.candidateId, b.g4GradeRecordDigest])));
  const labelSemantic = { purpose, claimAxes: ["skin.redness.presence"], excludedClaims: ["identity"] };
  const labelSchema = { ...labelSemantic, labelSchemaDigest: sha256Hex(stableStringify(labelSemantic)) };
  const semantic = {
    schemaVersion: DATASET_SOURCE_SNAPSHOT_SCHEMA_VERSION,
    datasetId: "dataset-pilot-v1",
    datasetLineageId: lineageId,
    purpose,
    useScope: "internal_evaluation_only",
    sourceUniverseDigest: hex(11000),
    members,
    exclusions: [],
    labelSchema,
    priorExposureRegistryDigest: exposure.registryDigest,
    sourcePolicy: DATASET_SOURCE_POLICY_RECORD
  };
  const snapshot = deepFreeze({ ...semantic, capturedAt: "2026-08-03T00:00:00.000Z", sourceSnapshotDigest: sha256Hex(stableStringify(semantic)) });
  return { snapshot, exposure };
}

export function splitPlanDraft(count) {
  const base = Math.floor(count / 5);
  const remainder = count - base * 5;
  return {
    targets: {
      train: base + remainder,
      development: base,
      validation: base,
      test: base,
      holdout: base
    },
    minimumComponents: { validation: base ? 1 : 0, test: base ? 1 : 0, holdout: base ? 1 : 0 },
    balancePolicy: { axis: "claim_values_digest", hardMinimumPerLabel: 0, allowedAbsoluteDeviation: 0 },
    authoredBy: "operator_dataset"
  };
}

export function approvedLockReviewDraft() {
  return {
    reviewer: { reviewerId: "reviewer_dataset", role: "dataset_lock_reviewer", roleSeparationAttested: true },
    confirmations: {
      currentG4StatusReviewed: true,
      leakageComponentsReviewed: true,
      priorExposureReviewed: true,
      splitFeasibilityReviewed: true,
      holdoutIsolationReviewed: true,
      labelSchemaReviewed: true
    },
    decision: "approve_lock",
    reasonCodes: [],
    completedAt: "2026-08-03T01:00:00.000Z"
  };
}
