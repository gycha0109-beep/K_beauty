import { createHash } from "node:crypto";
import {
  validateFaceSpaceReferenceCorpus
} from "./face-lab-face-space-reference-corpus.js";

export const FACE_SPACE_REFERENCE_CORPUS_REVIEW_PACKET_SCHEMA_VERSION =
  "face-space-reference-corpus-review-packet-v0";

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function buildFaceSpaceReferenceCorpusReviewPacket({
  manifest,
  packetVersion
} = {}) {
  if (!nonEmpty(packetVersion)) {
    throw new Error("reference_corpus_review_packet_version_invalid");
  }

  const summary = validateFaceSpaceReferenceCorpus(manifest);
  const splitSubjectGroups = {
    reference: new Set(),
    holdout: new Set()
  };
  const splitNearDuplicateFamilies = {
    reference: new Set(),
    holdout: new Set()
  };
  const qualityStatusCounts = {
    reference: {},
    holdout: {}
  };

  for (const record of manifest.records) {
    splitSubjectGroups[record.split].add(record.subjectGroupId);
    if (nonEmpty(record.nearDuplicateFamilyId)) {
      splitNearDuplicateFamilies[record.split].add(
        record.nearDuplicateFamilyId
      );
    }
    const status = record.eligibilityQuality.qualityStatus;
    qualityStatusCounts[record.split][status] =
      (qualityStatusCounts[record.split][status] || 0) + 1;
  }

  const reviewSnapshot = {
    samplingFrame: {
      kind: summary.samplingFrameKind,
      provenanceRef: summary.samplingFrameProvenanceRef
    },
    provider: summary.provider,
    referenceSplitFingerprint: summary.referenceSplitFingerprint,
    sourceExecution: summary.sourceExecution,
    recordCount: summary.recordCount,
    distinctSubjectGroupCount: summary.distinctSubjectGroupCount,
    splitCounts: summary.splitCounts,
    splitDistinctSubjectGroupCounts: {
      reference: splitSubjectGroups.reference.size,
      holdout: splitSubjectGroups.holdout.size
    },
    splitNearDuplicateFamilyCounts: {
      reference: splitNearDuplicateFamilies.reference.size,
      holdout: splitNearDuplicateFamilies.holdout.size
    },
    qualityStatusCounts,
    dimensionIds: [...summary.dimensionIds].sort()
  };

  const reviewPacketFingerprint =
    "sha256:" +
    createHash("sha256")
      .update(JSON.stringify(reviewSnapshot))
      .digest("hex");

  return {
    schemaVersion: FACE_SPACE_REFERENCE_CORPUS_REVIEW_PACKET_SCHEMA_VERSION,
    packetVersion,
    status: "manual_review_packet_ready",
    sourceReferenceCorpusSummarySchemaVersion: summary.schemaVersion,
    sourceReferenceSplitFingerprint:
      summary.referenceSplitFingerprint,
    sourceSamplingFrameProvenanceRef:
      summary.samplingFrameProvenanceRef,
    sourceProvider: summary.provider,
    reviewPacketFingerprint,
    reviewSnapshot,
    authority: {
      productionAuthority: false,
      normalizationAuthority: false,
      thresholdAuthority: false,
      referenceStatisticsAuthority: false,
      methodSelectionAuthority: false,
      adequacyDecisionAuthority: false
    },
    reviewSemantics: {
      descriptiveOnly: true,
      centerScaleStatisticsIncluded: false,
      percentileStatisticsIncluded: false,
      holdoutMeasurementValuesIncluded: false,
      automaticPassFail: false,
      automaticRanking: false
    }
  };
}
