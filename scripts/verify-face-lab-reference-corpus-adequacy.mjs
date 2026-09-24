import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import {
  validateFaceSpaceReferenceCorpusAdequacyEvidence
} from "../lib/face-lab-reference-corpus-adequacy.js";
import {
  validateFaceSpaceReferenceCorpus
} from "../lib/face-lab-face-space-reference-corpus.js";

const summary = {
  schemaVersion: "face-space-reference-corpus-summary-v0",
  status: "structurally_valid_research_corpus",
  samplingFrameProvenanceRef: "synthetic-verifier-only",
  provider: {
    source: "mediapipe_face_geometry",
    sourceVersion:
      "google-ai-edge/mediapipe@20e8f2ae3365d46fa02037b54911b72e13494809",
    adapterId: "mediapipe-face-geometry-metric-v0"
  },
  referenceSplitFingerprint:
    "sha256:" + "a".repeat(64)
};

const reviewPacket = {
  schemaVersion: "face-space-reference-corpus-review-packet-v0",
  packetVersion: "synthetic-verifier-reference-review-v0",
  status: "manual_review_packet_ready",
  sourceReferenceCorpusSummarySchemaVersion: summary.schemaVersion,
  sourceReferenceSplitFingerprint: summary.referenceSplitFingerprint,
  sourceSamplingFrameProvenanceRef: summary.samplingFrameProvenanceRef,
  sourceProvider: summary.provider,
  reviewPacketFingerprint: "sha256:" + "c".repeat(64),
  reviewSnapshot: {},
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
  },
  privacy: {
    sourceImagePersisted: false,
    rawLandmarksPersisted: false,
    identityEmbeddingCreated: false,
    biometricIdentityMatchPerformed: false,
    localImagePathsIncluded: false
  }
};

const evidence = {
  schemaVersion: "face-space-reference-corpus-adequacy-evidence-v0",
  status: "adequate_for_provisional_research",
  decisionVersion: "synthetic-verifier-adequacy-v0",
  evidenceRef: "synthetic-verifier-only:adequacy-review",
  sourceReferenceCorpusSummarySchemaVersion: summary.schemaVersion,
  sourceReferenceSplitFingerprint: summary.referenceSplitFingerprint,
  sourceReviewPacketSchemaVersion: reviewPacket.schemaVersion,
  sourceReviewPacketVersion: reviewPacket.packetVersion,
  sourceReviewPacketFingerprint: reviewPacket.reviewPacketFingerprint,
  sourceSamplingFrameProvenanceRef: summary.samplingFrameProvenanceRef,
  sourceProvider: summary.provider,
  samplingFrameReviewed: true,
  splitIntegrityReviewed: true,
  measurementCoverageReviewed: true,
  holdoutIntegrityReviewed: true,
  coverageLimitations: [
    "Synthetic verifier only; does not establish real population adequacy."
  ],
  automaticAdequacyInferred: false,
  numericThresholdInvented: false,
  productionAuthority: false,
  normalizationAuthority: false,
  thresholdAuthority: false
};

const validated =
  validateFaceSpaceReferenceCorpusAdequacyEvidence(
    evidence,
    summary,
    reviewPacket
  );
assert.equal(validated.status, "adequate_for_provisional_research");
assert.equal(validated.authority.productionAuthority, false);
assert.equal(validated.authority.normalizationAuthority, false);
assert.equal(validated.authority.thresholdAuthority, false);
assert.equal(validated.review.automaticAdequacyInferred, false);
assert.equal(validated.review.numericThresholdInvented, false);

assert.throws(
  () =>
    validateFaceSpaceReferenceCorpusAdequacyEvidence(
      {
        ...evidence,
        sourceReferenceSplitFingerprint:
          "sha256:" + "b".repeat(64)
      },
      summary,
      reviewPacket
    ),
  /adequacy_evidence_invalid/
);

assert.throws(
  () =>
    validateFaceSpaceReferenceCorpusAdequacyEvidence(
      {
        ...evidence,
        coverageLimitations: []
      },
      summary,
      reviewPacket
    ),
  /adequacy_evidence_invalid/
);

assert.throws(
  () =>
    validateFaceSpaceReferenceCorpusAdequacyEvidence(
      {
        ...evidence,
        automaticAdequacyInferred: true
      },
      summary,
      reviewPacket
    ),
  /adequacy_evidence_invalid/
);

assert.throws(
  () =>
    validateFaceSpaceReferenceCorpusAdequacyEvidence(
      evidence,
      summary,
      {
        ...reviewPacket,
        privacy: {
          ...reviewPacket.privacy,
          localImagePathsIncluded: true
        }
      }
    ),
  /adequacy_review_packet_invalid/
);

const actualRunOutput = JSON.parse(
  readFileSync(
    "evidence/facelab/face-space-normalization/v0/london-set-v5-reference-corpus-run-output.json",
    "utf8"
  )
);
const actualReviewPacket = JSON.parse(
  readFileSync(
    "evidence/facelab/face-space-normalization/v0/london-set-v5-reference-corpus-review-packet.json",
    "utf8"
  )
);
const actualEvidence = JSON.parse(
  readFileSync(
    "evidence/facelab/face-space-normalization/v0/reference-corpus-adequacy-evidence.json",
    "utf8"
  )
);
const actualContract = JSON.parse(
  readFileSync(
    "evidence/facelab/face-space-normalization/v0/reference-corpus-adequacy.contract.json",
    "utf8"
  )
);
const actualSummary = validateFaceSpaceReferenceCorpus(
  actualRunOutput.corpus
);
const actualValidated = validateFaceSpaceReferenceCorpusAdequacyEvidence(
  actualEvidence,
  actualSummary,
  actualReviewPacket
);

assert.equal(actualSummary.recordCount, 102);
assert.equal(actualSummary.distinctSubjectGroupCount, 102);
assert.deepEqual(actualSummary.splitCounts, {
  reference: 82,
  holdout: 20
});
assert.equal(
  actualValidated.status,
  "adequate_for_provisional_research"
);
assert.equal(
  actualValidated.sourceReferenceSplitFingerprint,
  "sha256:6f9a051dd204db73e35a2866aebdeb49f83a8e0ad557d97c3036427af5d44ccf"
);
assert.equal(
  actualValidated.sourceReviewPacketFingerprint,
  "sha256:49f76545486f50e88b68a23f68cc65605158dc402d78a4ce44d27940314de392"
);
assert.equal(actualValidated.authority.productionAuthority, false);
assert.equal(actualValidated.authority.normalizationAuthority, false);
assert.equal(actualValidated.authority.thresholdAuthority, false);
assert.equal(actualContract.currentEvidence.adequacyDecisionPresent, true);
assert.equal(
  actualContract.currentEvidence.adequacyDecisionVersion,
  "london-set-v5-reference-corpus-adequacy-v1"
);
assert.equal(
  actualContract.currentEvidence.adequacyEvidenceRef,
  "evidence/facelab/face-space-normalization/v0/reference-corpus-adequacy-evidence.json"
);

console.log(JSON.stringify({
  ok: true,
  productionAuthority: false,
  normalizationAuthority: false,
  thresholdAuthority: false,
  automaticAdequacyInferenceForbidden: true,
  numericThresholdInventionForbidden: true,
  exactReferenceFingerprintRequired: true,
  explicitCoverageLimitationsRequired: true,
  exactReviewPacketFingerprintRequired: true,
  reviewPacketPrivacyBoundaryRequired: true,
  actualAdequacyDecisionPresent: true,
  actualRecordCount: actualSummary.recordCount,
  actualDistinctSubjectGroupCount: actualSummary.distinctSubjectGroupCount,
  actualDecisionVersion: actualValidated.decisionVersion
}, null, 2));
