import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  applyFaceSpaceNormalizationCandidate,
  buildFaceSpaceNormalizationCandidate,
  evaluateFaceSpaceNormalizationReadiness,
  validateFaceSpaceReferenceStatisticsMethodDecision
} from "../lib/face-lab-face-space-normalization-research.js";
import {
  buildRealPhotoSameSubjectStabilityEvidence,
  summarizeRealPhotoStabilityCollection
} from "../lib/face-lab-real-photo-stability-evidence.js";
import {
  buildRealPhotoStabilityReviewPacket
} from "../lib/face-lab-real-photo-stability-review-packet.js";
import {
  validateFaceSpaceReferenceCorpus
} from "../lib/face-lab-face-space-reference-corpus.js";
import {
  buildFaceSpaceReferenceCorpusReviewPacket
} from "../lib/face-lab-reference-corpus-review-packet.js";

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

const semanticContract = readJson(
  "evidence/facelab/structural-measurement/v0/semantic-contract.json"
);
const stabilitySummary = readJson(
  "evidence/facelab/photo-geometry/v0/photo-geometry-stability-evidence-summary.json"
);
const readinessContract = readJson(
  "evidence/facelab/face-space-normalization/v0/readiness.contract.json"
);
const referenceCorpusContract = readJson(
  "evidence/facelab/face-space-normalization/v0/reference-corpus.contract.json"
);

assert.equal(readinessContract.productionAuthority, false);
assert.equal(readinessContract.status, "not_ready");
assert.equal(
  readinessContract.referenceStatistics.centerValuesDefined,
  true
);
assert.equal(
  readinessContract.referenceStatistics.scaleValuesDefined,
  true
);
assert.equal(
  readinessContract.referenceStatistics.status,
  "research_candidate_frozen"
);
assert.equal(referenceCorpusContract.currentEvidence.corpusManifestPresent, false);
assert.equal(referenceCorpusContract.currentEvidence.referenceSampleCount, 0);
assert.equal(referenceCorpusContract.currentEvidence.holdoutSampleCount, 0);

const actualReferenceRunOutput = readJson(
  "evidence/facelab/face-space-normalization/v0/london-set-v5-reference-corpus-run-output.json"
);
const actualReferenceReviewPacket = readJson(
  "evidence/facelab/face-space-normalization/v0/london-set-v5-reference-corpus-review-packet.json"
);
const actualReferenceAdequacyEvidence = readJson(
  "evidence/facelab/face-space-normalization/v0/reference-corpus-adequacy-evidence.json"
);
const actualSupplementalRollRunOutput = readJson(
  "evidence/facelab/photo-geometry/v0/supplemental-roll-stability-run-output.json"
);
const actualRealPhotoAdequacyDecision = readJson(
  "evidence/facelab/photo-geometry/v0/real-photo-stability-adequacy-decision.json"
);
const actualReferenceStatistics = readJson(
  "evidence/facelab/face-space-normalization/v0/london-set-v5-reference-statistics.json"
);
const actualMethodSelection = readJson(
  "evidence/facelab/face-space-normalization/v0/london-set-v5-reference-method-selection.json"
);
const actualRealPhotoReports = [
  ...readJson(
    "evidence/facelab/photo-geometry/v0/london-set-v5-expression-stability-run-output.json"
  ).reports,
  ...readJson(
    "evidence/facelab/photo-geometry/v0/london-set-v5-yaw-stability-run-output.json"
  ).reports,
  ...readJson(
    "evidence/facelab/photo-geometry/v0/pointing04-pitch-stability-run-output.json"
  ).reports,
  ...readJson(
    "evidence/facelab/photo-geometry/v0/manual-roll-stability-run-output.json"
  ).reports,
  ...actualSupplementalRollRunOutput.reports
];
const actualRealPhotoReviewPacket =
  buildRealPhotoStabilityReviewPacket({
    reports: actualRealPhotoReports,
    packetVersion: "real-photo-expression-yaw-pitch-roll-stability-review-v2"
  });
assert.equal(
  actualRealPhotoReviewPacket.sourceCollectionFingerprint,
  "sha256:aca9b072b8af2104a8c1b220f92ddc5ce5c28dfbe11e68dc6b102ad17db6f33c"
);
assert.equal(
  actualRealPhotoReviewPacket.reviewPacketFingerprint,
  "sha256:4250f183e5f25a9c863fe8d5592f6da60a837d9a7f3009d4e33b9a9f54eb8233"
);

const actualCurrentReadiness =
  evaluateFaceSpaceNormalizationReadiness({
    semanticContract,
    stabilitySummary,
    scope: "same_provider",
    referenceCorpusManifest: actualReferenceRunOutput.corpus,
    referenceCorpusReviewPacket: actualReferenceReviewPacket,
    referenceCorpusAdequacyEvidence:
      actualReferenceAdequacyEvidence,
    realPhotoStabilityReports: actualRealPhotoReports,
    realPhotoStabilityReviewPacket: actualRealPhotoReviewPacket,
    realPhotoStabilityAdequacyDecision:
      actualRealPhotoAdequacyDecision,
    evidence: {
      controlled3dPoseStress: true,
      controlled3dExpressionStress: true,
      providerCorrespondence: false
    }
  });

assert.equal(actualCurrentReadiness.status, "not_ready");
assert.equal(
  actualCurrentReadiness.evidenceState.referenceCorpusAdequacyPresent,
  true
);
assert.equal(actualCurrentReadiness.evidenceState.multiSubjectCoverage, true);
assert.equal(actualCurrentReadiness.evidenceState.generalFaceCoverage, true);
assert.equal(actualCurrentReadiness.evidenceState.referenceDistribution, true);
assert.equal(
  actualCurrentReadiness.evidenceState.realPhotoStabilityReportCount,
  492
);
assert.equal(
  actualCurrentReadiness.evidenceState.realPhotoStabilityAdequacyPresent,
  false
);
assert.equal(
  actualCurrentReadiness.evidenceState
    .realPhotoStabilityAdequacyDecisionStatus,
  "hold_for_more_evidence"
);
assert.equal(
  actualCurrentReadiness.evidenceState
    .realPhotoStabilityAdequacyDecisionCode,
  "ADDITIONAL_EVIDENCE_REQUIRED"
);
assert.equal(
  actualCurrentReadiness.evidenceState
    .realPhotoStabilityProvisionalResearchGateGranted,
  false
);
assert.deepEqual(
  actualCurrentReadiness.evidenceState
    .realPhotoStabilityAdequacyHoldReasons,
  [
  "head_roll_same_session_capture_provenance_unverified",
  "head_roll_research_use_authorization_unverified"
]
);
assert.deepEqual(
  [...actualCurrentReadiness.blockers].sort(),
  [...readinessContract.currentBlockers].sort()
);
for (const retiredBlocker of [
  "single_fixture_only",
  "multi_subject_coverage_missing",
  "general_face_coverage_missing",
  "reference_distribution_missing",
  "unresolved:head_yaw_real_same_subject_pair",
  "unresolved:head_pitch_real_same_subject_pair",
  "unresolved:head_roll_real_same_subject_pair",
  "unresolved:expression_real_same_subject_pair",
  "unresolved:general_face_coverage",
  "unresolved:population_or_reference_distribution"
]) {
  assert.equal(
    actualCurrentReadiness.blockers.includes(retiredBlocker),
    false,
    "governed replacement should supersede historical blocker: " +
      retiredBlocker
  );
}
assert.equal(actualCurrentReadiness.readyDimensionCount, 0);
assert.throws(
  () =>
    buildFaceSpaceNormalizationCandidate({
      readiness: actualCurrentReadiness,
      referenceStatistics: actualReferenceStatistics,
      methodDecision: actualMethodSelection.decision
    }),
  /normalization_not_ready/
);

const counterfactualAdequacyDecision = {
  ...actualRealPhotoAdequacyDecision,
  status: "adequate_for_provisional_research",
  decisionCode: "PROVISIONAL_RESEARCH_ADEQUATE",
  decisionVersion:
    "counterfactual-verifier-only-real-photo-adequacy-v1",
  evidenceRef:
    "synthetic-verifier-only:counterfactual-real-photo-adequacy",
  decisionRationale:
    "Counterfactual verifier only: prove that no code or lineage blocker remains after a future legitimate real-photo adequacy promotion. This is not empirical evidence and is never persisted as an adequacy decision.",
  holdReasons: [],
  evidenceIntegrityBlockers: [],
  provisionalResearchGateGranted: true
};

const counterfactualReady =
  evaluateFaceSpaceNormalizationReadiness({
    semanticContract,
    stabilitySummary,
    scope: "same_provider",
    referenceCorpusManifest: actualReferenceRunOutput.corpus,
    referenceCorpusReviewPacket: actualReferenceReviewPacket,
    referenceCorpusAdequacyEvidence:
      actualReferenceAdequacyEvidence,
    realPhotoStabilityReports: actualRealPhotoReports,
    realPhotoStabilityReviewPacket: actualRealPhotoReviewPacket,
    realPhotoStabilityAdequacyDecision:
      counterfactualAdequacyDecision,
    evidence: {
      controlled3dPoseStress: true,
      controlled3dExpressionStress: true,
      providerCorrespondence: false
    }
  });

assert.equal(
  counterfactualReady.status,
  "provisional_candidate_ready"
);
assert.deepEqual(counterfactualReady.blockers, []);
assert.equal(
  counterfactualReady.readyDimensionCount,
  semanticContract.dimensions.length
);
const counterfactualCandidate = buildFaceSpaceNormalizationCandidate({
  readiness: counterfactualReady,
  referenceStatistics: actualReferenceStatistics,
  methodDecision: actualMethodSelection.decision
});
assert.equal(
  counterfactualCandidate.referenceStatisticsVersion,
  "london-set-v5-reference-statistics-v1"
);
assert.equal(
  counterfactualCandidate.methodDecisionVersion,
  "london-set-v5-reference-method-selection-v1"
);
assert.equal(
  counterfactualCandidate.sourceReferenceSplitFingerprint,
  "sha256:6f9a051dd204db73e35a2866aebdeb49f83a8e0ad557d97c3036427af5d44ccf"
);
assert.equal(counterfactualCandidate.centerMethod, "median");
assert.equal(
  counterfactualCandidate.scaleMethod,
  "mad_scaled_consistent"
);
assert.equal(counterfactualCandidate.dimensions.length, 6);
assert.equal(
  counterfactualCandidate.authority.productionAuthority,
  false
);
assert.equal(
  counterfactualCandidate.authority.provisionalResearchOnly,
  true
);

let syntheticReferenceFingerprint =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
let syntheticReferenceProvenance = "synthetic-verifier-only";
let syntheticReferenceProvider = {
  source: "synthetic-verifier-provider",
  sourceVersion: "synthetic-verifier-v0",
  adapterId: "synthetic-verifier-adapter-v0"
};

const currentReadiness = evaluateFaceSpaceNormalizationReadiness({
  semanticContract,
  stabilitySummary,
  scope: "same_provider",
  evidence: {
    multiSubjectCoverage: false,
    generalFaceCoverage: false,
    referenceDistribution: false,
    realPoseStability: false,
    realExpressionStability: false,
    controlled3dPoseStress: true,
    controlled3dExpressionStress: true,
    realPoseEvidenceKind: "controlled_3d_same_identity",
    realExpressionEvidenceKind: "controlled_3d_same_identity",
    providerCorrespondence: false
  }
});

assert.equal(currentReadiness.status, "not_ready");
for (const blocker of [
  "single_fixture_only",
  "multi_subject_coverage_missing",
  "general_face_coverage_missing",
  "reference_distribution_missing",
  "real_pose_stability_missing",
  "real_expression_stability_missing"
]) {
  assert.ok(
    currentReadiness.blockers.includes(blocker),
    "missing legacy-baseline readiness blocker: " + blocker
  );
}
assert.equal(currentReadiness.readyDimensionCount, 0);
assert.equal(currentReadiness.evidenceState.controlled3dPoseStress, true);
assert.equal(currentReadiness.evidenceState.controlled3dExpressionStress, true);
assert.equal(currentReadiness.evidenceState.realPoseStability, false);
assert.equal(currentReadiness.evidenceState.realExpressionStability, false);
assert.equal(
  currentReadiness.dimensions.every(
    (dimension) => dimension.normalizationStatus === "not_ready"
  ),
  true
);
assert.throws(
  () =>
    buildFaceSpaceNormalizationCandidate({
      readiness: currentReadiness,
      referenceStatistics: {
        schemaVersion: "face-space-reference-statistics-v0",
        methodDecisionVersion: "synthetic-verifier-only-method-v0",
        sourceReferenceCorpusSummarySchemaVersion:
          "face-space-reference-corpus-summary-v0",
        sourceReferenceSplitFingerprint:
          syntheticReferenceFingerprint,
        methodComparisonVersion: "synthetic-verifier-comparison-v0",
        methodComparisonPacketFingerprint:
          "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        sourceSamplingFrameProvenanceRef: syntheticReferenceProvenance,
        sourceProvider: {
          source: syntheticReferenceProvider.source,
          sourceVersion: syntheticReferenceProvider.sourceVersion,
          adapterId: syntheticReferenceProvider.adapterId
        },
        referenceSplitOnly: true,
        authority: {
          productionAuthority: false,
          normalizationAuthority: false,
          thresholdAuthority: false
        },
        version: "must_not_be_used",
        dimensions: [
          {
            id: "lower_face_width_ratio",
            unit: "ratio",
            center: 0.75,
            scale: 0.05
          }
        ]
      }
    }),
  /normalization_not_ready/
);

const completeStabilitySummary = {
  ...stabilitySummary,
  fixture: {
    ...stabilitySummary.fixture,
    distinctSubjectCount: 12,
    sameSourceImageTransformOnly: false
  },
  unresolvedEvidence: []
};
function realPhotoMeasurement(sampleId, delta = {}) {
  const values = {
    lower_face_width_ratio: 0.74,
    chin_height_ratio: 0.45,
    eye_spacing_ratio: 0.20,
    eye_width_ratio: 0.17,
    eye_tilt: 0.2,
    nose_width_ratio: 0.18,
    ...delta
  };
  return {
    schemaVersion: "face-space-structural-measurement-v0",
    measurementVersion: "face-space-structural-measurement-v0",
    semanticsVersion: "face-space-structural-measurement-semantics-v0",
    sampleId,
    source: "mediapipe_face_geometry",
    sourceVersion:
      "google-ai-edge/mediapipe@20e8f2ae3365d46fa02037b54911b72e13494809",
    adapterId: "mediapipe-face-geometry-metric-v0",
    coordinateSpace: "pose_normalized_metric_3d",
    normalizationReference:
      "face_left_lateral_to_face_right_lateral_3d_distance",
    dimensions: Object.entries(values).map(([id, value]) => ({
      id,
      value,
      unit: id === "eye_tilt" ? "degree" : "ratio"
    })),
    privacy: {
      sourceImagePersisted: false,
      identityEmbeddingCreated: false
    }
  };
}

const realPhotoBaseline = realPhotoMeasurement("normalization_reference");
const realPhotoNuisanceFixtures = [
  ["head_yaw", { lower_face_width_ratio: 0.741, eye_tilt: 0.24 }],
  ["head_pitch", { chin_height_ratio: 0.451, eye_tilt: 0.19 }],
  ["head_roll", { eye_width_ratio: 0.1705, eye_tilt: 0.22 }],
  ["expression", { chin_height_ratio: 0.456, nose_width_ratio: 0.181 }]
];
const completeRealPhotoReports = realPhotoNuisanceFixtures.map(
  ([nuisanceClass, delta], index) =>
    buildRealPhotoSameSubjectStabilityEvidence(
      {
        pairGroupId: "normalization_real_photo_pair_" + index,
        referenceMeasurement: realPhotoBaseline,
        candidateMeasurement: realPhotoMeasurement(
          "normalization_real_photo_candidate_" + index,
          delta
        ),
        nuisance: { class: nuisanceClass },
        subjectLinkage: {
          method: "dataset_same_subject_provenance",
          evidenceRef: "synthetic-verifier-provenance:" + index,
          biometricIdentityMatchPerformed: false
        },
        executionProvenance: {
          kind: "real_photo_pair_runner",
          runnerVersion: "face-lab-real-photo-stability-pair-runner-v0",
          runManifestDigest:
            "sha256:" + String((index % 9) + 1).repeat(64),
          sourceSetProvenanceRef:
            "synthetic-verifier-normalization-source-set",
          referenceImageSha256:
            String((index % 9) + 1).repeat(64),
          candidateImageSha256:
            String(((index + 4) % 9) + 1).repeat(64)
        }
      },
      semanticContract
    )
);

const completeRealPhotoCollection =
  summarizeRealPhotoStabilityCollection(completeRealPhotoReports);
const completeRealPhotoReviewPacket =
  buildRealPhotoStabilityReviewPacket({
    reports: completeRealPhotoReports,
    packetVersion: "synthetic-verifier-real-photo-review-packet-v0"
  });
const futureRealPhotoStabilityAdequacyEvidence = {
  schemaVersion:
    "face-lab-real-photo-stability-adequacy-evidence-v0",
  status: "adequate_for_provisional_research",
  decisionVersion:
    "synthetic-verifier-real-photo-stability-adequacy-v0",
  evidenceRef:
    "synthetic-verifier-only:real-photo-stability-adequacy-review",
  sourceCollectionSchemaVersion:
    completeRealPhotoCollection.schemaVersion,
  sourceCollectionFingerprint:
    completeRealPhotoCollection.collectionFingerprint,
  sourceReviewPacketSchemaVersion:
    completeRealPhotoReviewPacket.schemaVersion,
  sourceReviewPacketVersion:
    completeRealPhotoReviewPacket.packetVersion,
  sourceReviewPacketFingerprint:
    completeRealPhotoReviewPacket.reviewPacketFingerprint,
  sourceReportCount:
    completeRealPhotoCollection.reportCount,
  sourceRunManifestDigests:
    completeRealPhotoCollection.runManifestDigests,
  sourceCoveredNuisanceClasses:
    completeRealPhotoCollection.coveredNuisanceClasses,
  nuisanceCoverageReviewed: true,
  subjectLinkageProvenanceReviewed: true,
  measurementDriftReviewed: true,
  sourceCaptureLimitationsReviewed: true,
  coverageLimitations: [
    "Synthetic verifier only; this does not establish real pose/expression stability adequacy."
  ],
  automaticAdequacyInferred: false,
  numericThresholdInvented: false,
  productionAuthority: false,
  normalizationAuthority: false,
  thresholdAuthority: false
};

function referenceCorpusMeasurement(sampleId, offset = 0) {
  const values = {
    lower_face_width_ratio: 0.74 + offset,
    chin_height_ratio: 0.45 + offset,
    eye_spacing_ratio: 0.20 + offset,
    eye_width_ratio: 0.17 + offset,
    eye_tilt: 0.2 + offset,
    nose_width_ratio: 0.18 + offset
  };
  return {
    schemaVersion: "face-space-structural-measurement-v0",
    sampleId,
    source: "mediapipe_face_geometry",
    sourceVersion:
      "google-ai-edge/mediapipe@20e8f2ae3365d46fa02037b54911b72e13494809",
    adapterId: "mediapipe-face-geometry-metric-v0",
    dimensions: Object.entries(values).map(([id, value]) => ({
      id,
      value,
      unit: id === "eye_tilt" ? "degree" : "ratio"
    })),
    privacy: {
      sourceImagePersisted: false,
      identityEmbeddingCreated: false
    }
  };
}

function referenceCorpusRecord(
  sampleId,
  subjectGroupId,
  split,
  offset,
  familyId
) {
  return {
    sampleId,
    subjectGroupId,
    split,
    nearDuplicateFamilyId: familyId,
    provenanceRef: "synthetic-verifier-corpus:" + sampleId,
    archetypeGroundTruth: null,
    identityEmbeddingCreated: false,
    biometricIdentityMatchPerformed: false,
    rawImagePersistedInPacket: false,
    eligibilityQuality: {
      eligible: true,
      qualityStatus: "synthetic_verifier_only"
    },
    measurement: referenceCorpusMeasurement(sampleId, offset)
  };
}

const futureReferenceCorpusManifest = {
  schemaVersion: "face-space-reference-corpus-v0",
  productionAuthority: false,
  normalizationAuthority: false,
  samplingFrame: {
    kind: "consented_general_face_corpus",
    provenanceRef: "synthetic-verifier-only",
    archetypeSeeded: false,
    generalFaceIntent: true
  },
  provider: {
    source: "mediapipe_face_geometry",
    sourceVersion:
      "google-ai-edge/mediapipe@20e8f2ae3365d46fa02037b54911b72e13494809",
    adapterId: "mediapipe-face-geometry-metric-v0"
  },
  records: [
    referenceCorpusRecord(
      "normalization_ref_a",
      "normalization_subject_a",
      "reference",
      0,
      "normalization_family_a"
    ),
    referenceCorpusRecord(
      "normalization_ref_b",
      "normalization_subject_b",
      "reference",
      0.01,
      "normalization_family_b"
    ),
    referenceCorpusRecord(
      "normalization_ref_c",
      "normalization_subject_c",
      "reference",
      -0.01,
      "normalization_family_c"
    ),
    referenceCorpusRecord(
      "normalization_holdout_d",
      "normalization_subject_d",
      "holdout",
      0.005,
      "normalization_family_d"
    )
  ]
};

const futureReferenceCorpusSummary =
  validateFaceSpaceReferenceCorpus(futureReferenceCorpusManifest);
const futureReferenceCorpusReviewPacket =
  buildFaceSpaceReferenceCorpusReviewPacket({
    manifest: futureReferenceCorpusManifest,
    packetVersion: "synthetic-verifier-reference-corpus-review-packet-v0"
  });

const futureReferenceCorpusAdequacyEvidence = {
  schemaVersion: "face-space-reference-corpus-adequacy-evidence-v0",
  status: "adequate_for_provisional_research",
  decisionVersion: "synthetic-verifier-corpus-adequacy-v0",
  evidenceRef: "synthetic-verifier-only:corpus-adequacy-review",
  sourceReferenceCorpusSummarySchemaVersion:
    futureReferenceCorpusSummary.schemaVersion,
  sourceReferenceSplitFingerprint:
    futureReferenceCorpusSummary.referenceSplitFingerprint,
  sourceReviewPacketSchemaVersion:
    futureReferenceCorpusReviewPacket.schemaVersion,
  sourceReviewPacketVersion:
    futureReferenceCorpusReviewPacket.packetVersion,
  sourceReviewPacketFingerprint:
    futureReferenceCorpusReviewPacket.reviewPacketFingerprint,
  sourceSamplingFrameProvenanceRef:
    futureReferenceCorpusSummary.samplingFrameProvenanceRef,
  sourceProvider: futureReferenceCorpusSummary.provider,
  samplingFrameReviewed: true,
  splitIntegrityReviewed: true,
  measurementCoverageReviewed: true,
  holdoutIntegrityReviewed: true,
  coverageLimitations: [
    "Synthetic verifier only; this does not establish real general-face adequacy."
  ],
  automaticAdequacyInferred: false,
  numericThresholdInvented: false,
  productionAuthority: false,
  normalizationAuthority: false,
  thresholdAuthority: false
};

const structuralOnlyReadiness = evaluateFaceSpaceNormalizationReadiness({
  semanticContract,
  stabilitySummary: completeStabilitySummary,
  scope: "same_provider",
  referenceCorpusManifest: futureReferenceCorpusManifest,
  referenceCorpusReviewPacket:
    futureReferenceCorpusReviewPacket,
  evidence: {
    controlled3dPoseStress: true,
    controlled3dExpressionStress: true,
    providerCorrespondence: false
  }
});
assert.equal(structuralOnlyReadiness.status, "not_ready");
assert.equal(
  structuralOnlyReadiness.evidenceState.referenceCorpusManifestPresent,
  true
);
assert.equal(
  structuralOnlyReadiness.evidenceState.referenceCorpusAdequacyPresent,
  false
);
assert.equal(
  structuralOnlyReadiness.evidenceState.structuralMultiSubjectCoverage,
  true
);
assert.equal(
  structuralOnlyReadiness.evidenceState.structuralGeneralFaceCoverage,
  true
);
assert.equal(
  structuralOnlyReadiness.evidenceState.structuralReferenceDistribution,
  true
);
assert.equal(structuralOnlyReadiness.evidenceState.multiSubjectCoverage, false);
assert.equal(structuralOnlyReadiness.evidenceState.generalFaceCoverage, false);
assert.equal(structuralOnlyReadiness.evidenceState.referenceDistribution, false);
assert.equal(
  structuralOnlyReadiness.blockers.includes(
    "reference_corpus_adequacy_missing"
  ),
  true
);

assert.throws(
  () =>
    evaluateFaceSpaceNormalizationReadiness({
      semanticContract,
      stabilitySummary: completeStabilitySummary,
      scope: "same_provider",
      referenceCorpusManifest: futureReferenceCorpusManifest,
      referenceCorpusAdequacyEvidence:
        futureReferenceCorpusAdequacyEvidence,
      evidence: {}
    }),
  /reference_corpus_adequacy_review_packet_invalid/
);

const corpusOnlyReadiness = evaluateFaceSpaceNormalizationReadiness({
  semanticContract,
  stabilitySummary: completeStabilitySummary,
  scope: "same_provider",
  referenceCorpusManifest: futureReferenceCorpusManifest,
  referenceCorpusReviewPacket:
    futureReferenceCorpusReviewPacket,
  referenceCorpusAdequacyEvidence: futureReferenceCorpusAdequacyEvidence,
  evidence: {
    realPoseStability: false,
    realExpressionStability: false,
    controlled3dPoseStress: true,
    controlled3dExpressionStress: true,
    providerCorrespondence: false
  }
});
assert.equal(corpusOnlyReadiness.status, "not_ready");
assert.equal(
  corpusOnlyReadiness.evidenceState.referenceCorpusAdequacyPresent,
  true
);
assert.equal(
  corpusOnlyReadiness.evidenceState.referenceCorpusAdequacyDecisionVersion,
  futureReferenceCorpusAdequacyEvidence.decisionVersion
);
assert.equal(
  corpusOnlyReadiness.evidenceState.referenceCorpusReviewPacketFingerprint,
  futureReferenceCorpusReviewPacket.reviewPacketFingerprint
);
assert.equal(corpusOnlyReadiness.evidenceState.multiSubjectCoverage, true);
assert.equal(corpusOnlyReadiness.evidenceState.generalFaceCoverage, true);
assert.equal(corpusOnlyReadiness.evidenceState.referenceDistribution, true);
assert.equal(
  corpusOnlyReadiness.blockers.includes("multi_subject_coverage_missing"),
  false
);
assert.equal(
  corpusOnlyReadiness.blockers.includes("general_face_coverage_missing"),
  false
);
assert.equal(
  corpusOnlyReadiness.blockers.includes("reference_distribution_missing"),
  false
);
assert.equal(corpusOnlyReadiness.blockers.includes("real_pose_stability_missing"), true);
assert.equal(corpusOnlyReadiness.evidenceState.realPhotoStabilityReportCount, 0);
assert.equal(
  corpusOnlyReadiness.blockers.includes("real_expression_stability_missing"),
  true
);

const manualCoverageCannotBypassCorpusSummary = evaluateFaceSpaceNormalizationReadiness({
  semanticContract,
  stabilitySummary: completeStabilitySummary,
  scope: "same_provider",
  evidence: {
    multiSubjectCoverage: true,
    generalFaceCoverage: true,
    referenceDistribution: true,
    realPoseStability: true,
    realExpressionStability: true,
    realPoseEvidenceKind: "real_photo_same_subject",
    realExpressionEvidenceKind: "real_photo_same_subject",
    providerCorrespondence: false
  }
});
assert.equal(manualCoverageCannotBypassCorpusSummary.status, "not_ready");
assert.equal(manualCoverageCannotBypassCorpusSummary.evidenceState.multiSubjectCoverage, false);
assert.equal(manualCoverageCannotBypassCorpusSummary.evidenceState.generalFaceCoverage, false);
assert.equal(manualCoverageCannotBypassCorpusSummary.evidenceState.referenceDistribution, false);
assert.equal(
  manualCoverageCannotBypassCorpusSummary.evidenceState.claimedRealPoseStability,
  true
);
assert.equal(
  manualCoverageCannotBypassCorpusSummary.evidenceState.claimedRealExpressionStability,
  true
);
assert.equal(
  manualCoverageCannotBypassCorpusSummary.evidenceState.realPoseStability,
  false
);
assert.equal(
  manualCoverageCannotBypassCorpusSummary.evidenceState.realExpressionStability,
  false
);

assert.throws(
  () =>
    evaluateFaceSpaceNormalizationReadiness({
      semanticContract,
      stabilitySummary: completeStabilitySummary,
      scope: "same_provider",
      referenceCorpusSummary: {
        schemaVersion: "face-space-reference-corpus-summary-v0"
      },
      evidence: {}
    }),
  /reference_corpus_summary_input_forbidden/
);

const structuralRealPhotoOnlyReadiness =
  evaluateFaceSpaceNormalizationReadiness({
    semanticContract,
    stabilitySummary: completeStabilitySummary,
    scope: "same_provider",
    referenceCorpusManifest: futureReferenceCorpusManifest,
  referenceCorpusReviewPacket:
    futureReferenceCorpusReviewPacket,
    referenceCorpusAdequacyEvidence:
      futureReferenceCorpusAdequacyEvidence,
    realPhotoStabilityReports: completeRealPhotoReports,
    realPhotoStabilityReviewPacket:
      completeRealPhotoReviewPacket,
    evidence: {
      controlled3dPoseStress: true,
      controlled3dExpressionStress: true,
      providerCorrespondence: false
    }
  });
assert.equal(structuralRealPhotoOnlyReadiness.status, "not_ready");
assert.equal(
  structuralRealPhotoOnlyReadiness.evidenceState
    .realPhotoStabilityAdequacyPresent,
  false
);
assert.equal(
  structuralRealPhotoOnlyReadiness.evidenceState
    .structuralRealPoseEvidenceKind,
  "real_photo_same_subject"
);
assert.equal(
  structuralRealPhotoOnlyReadiness.evidenceState
    .structuralRealExpressionEvidenceKind,
  "real_photo_same_subject"
);
assert.equal(
  structuralRealPhotoOnlyReadiness.evidenceState.realPoseStability,
  false
);
assert.equal(
  structuralRealPhotoOnlyReadiness.evidenceState.realExpressionStability,
  false
);
assert.equal(
  structuralRealPhotoOnlyReadiness.blockers.includes(
    "real_photo_stability_adequacy_missing"
  ),
  true
);

assert.throws(
  () =>
    evaluateFaceSpaceNormalizationReadiness({
      semanticContract,
      stabilitySummary: completeStabilitySummary,
      scope: "same_provider",
      referenceCorpusManifest: futureReferenceCorpusManifest,
  referenceCorpusReviewPacket:
    futureReferenceCorpusReviewPacket,
      referenceCorpusAdequacyEvidence:
        futureReferenceCorpusAdequacyEvidence,
      realPhotoStabilityReports: completeRealPhotoReports,
      realPhotoStabilityAdequacyEvidence:
        futureRealPhotoStabilityAdequacyEvidence,
      evidence: {}
    }),
  /adequacy_review_packet_invalid/
);

const completeEvidence = {
  realPoseStability: true,
  realExpressionStability: true,
  realPoseEvidenceKind: "real_photo_same_subject",
  realExpressionEvidenceKind: "real_photo_same_subject",
  controlled3dPoseStress: true,
  controlled3dExpressionStress: true,
  providerCorrespondence: false
};

const sameProviderReady = evaluateFaceSpaceNormalizationReadiness({
  semanticContract,
  stabilitySummary: completeStabilitySummary,
  scope: "same_provider",
  referenceCorpusManifest: futureReferenceCorpusManifest,
  referenceCorpusReviewPacket:
    futureReferenceCorpusReviewPacket,
  referenceCorpusAdequacyEvidence: futureReferenceCorpusAdequacyEvidence,
  realPhotoStabilityReports: completeRealPhotoReports,
  realPhotoStabilityReviewPacket:
    completeRealPhotoReviewPacket,
  realPhotoStabilityAdequacyEvidence:
    futureRealPhotoStabilityAdequacyEvidence,
  evidence: completeEvidence
});
assert.equal(sameProviderReady.status, "provisional_candidate_ready");
assert.equal(
  sameProviderReady.evidenceState.realPhotoStabilityAdequacyPresent,
  true
);
assert.equal(
  sameProviderReady.evidenceState.realPhotoStabilityAdequacyDecisionVersion,
  futureRealPhotoStabilityAdequacyEvidence.decisionVersion
);
assert.equal(
  sameProviderReady.evidenceState.realPhotoStabilityReviewPacketFingerprint,
  completeRealPhotoReviewPacket.reviewPacketFingerprint
);
syntheticReferenceFingerprint =
  sameProviderReady.evidenceState.referenceSplitFingerprint;
syntheticReferenceProvenance =
  sameProviderReady.evidenceState.referenceCorpusSamplingFrameProvenanceRef;
syntheticReferenceProvider =
  sameProviderReady.evidenceState.referenceCorpusProvider;
assert.equal(
  sameProviderReady.evidenceState.referenceCorpusManifestPresent,
  true
);
assert.match(
  sameProviderReady.evidenceState.referenceSplitFingerprint,
  /^sha256:[a-f0-9]{64}$/
);
assert.equal(sameProviderReady.evidenceState.realPhotoStabilityReportCount, 4);
assert.equal(
  sameProviderReady.evidenceState.realPhotoStabilityCoverage,
  "covered_for_research"
);
assert.equal(
  sameProviderReady.readyDimensionCount,
  semanticContract.dimensions.length
);
assert.equal(
  sameProviderReady.dimensions.every(
    (dimension) =>
      dimension.normalizationStatus === "ready_for_provisional_candidate"
  ),
  true
);

const crossProviderHeld = evaluateFaceSpaceNormalizationReadiness({
  semanticContract,
  stabilitySummary: completeStabilitySummary,
  scope: "cross_provider",
  referenceCorpusManifest: futureReferenceCorpusManifest,
  referenceCorpusReviewPacket:
    futureReferenceCorpusReviewPacket,
  referenceCorpusAdequacyEvidence: futureReferenceCorpusAdequacyEvidence,
  realPhotoStabilityReports: completeRealPhotoReports,
  realPhotoStabilityReviewPacket:
    completeRealPhotoReviewPacket,
  realPhotoStabilityAdequacyEvidence:
    futureRealPhotoStabilityAdequacyEvidence,
  evidence: completeEvidence
});
assert.equal(crossProviderHeld.status, "not_ready");
assert.equal(crossProviderHeld.readyDimensionCount, 0);
assert.deepEqual(
  crossProviderHeld.dimensions
    .filter(
      (dimension) =>
        dimension.normalizationStatus === "provider_semantic_hold"
    )
    .map((dimension) => dimension.id)
    .sort(),
  ["chin_height_ratio", "nose_width_ratio"]
);
assert.deepEqual(
  crossProviderHeld.dimensions
    .filter(
      (dimension) =>
        dimension.normalizationStatus ===
        "provider_semantic_unvalidated"
    )
    .map((dimension) => dimension.id)
    .sort(),
  [
    "eye_spacing_ratio",
    "eye_tilt",
    "eye_width_ratio",
    "lower_face_width_ratio"
  ]
);

const crossProviderReady = evaluateFaceSpaceNormalizationReadiness({
  semanticContract,
  stabilitySummary: completeStabilitySummary,
  scope: "cross_provider",
  referenceCorpusManifest: futureReferenceCorpusManifest,
  referenceCorpusReviewPacket:
    futureReferenceCorpusReviewPacket,
  referenceCorpusAdequacyEvidence: futureReferenceCorpusAdequacyEvidence,
  realPhotoStabilityReports: completeRealPhotoReports,
  realPhotoStabilityReviewPacket:
    completeRealPhotoReviewPacket,
  realPhotoStabilityAdequacyEvidence:
    futureRealPhotoStabilityAdequacyEvidence,
  evidence: {
    ...completeEvidence,
    providerCorrespondence: true
  }
});
assert.equal(crossProviderReady.status, "provisional_candidate_ready");
assert.equal(
  crossProviderReady.readyDimensionCount,
  semanticContract.dimensions.length
);

const selectedMethodDecision =
  validateFaceSpaceReferenceStatisticsMethodDecision({
    schemaVersion: "face-space-reference-statistics-method-decision-v0",
    status: "selected_for_research_candidate",
    decisionVersion: "synthetic-verifier-only-method-v0",
    scope: "same_provider",
    referenceCorpusSummarySchemaVersion:
      "face-space-reference-corpus-summary-v0",
    centerMethod: "median",
    scaleMethod: "mad_scaled_consistent",
    percentileMethod: null,
    thresholdMethod: null,
    sourceReferenceSplitFingerprint:
      syntheticReferenceFingerprint,
    comparisonPacketFingerprint:
      "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    comparisonVersion: "synthetic-verifier-comparison-v0",
    evidenceRef: "synthetic-verifier-only:method-selection",
    selectionRationale:
      "Synthetic verifier decision used only to exercise normalization lineage gates.",
    holdoutUsedForSelection: false,
    automaticWinnerSelected: false,
    productionAuthority: false,
    normalizationAuthority: false,
    thresholdAuthority: false
  });
assert.equal(
  selectedMethodDecision.authority.researchMethodSelectionOnly,
  true
);

assert.throws(
  () =>
    validateFaceSpaceReferenceStatisticsMethodDecision({
      schemaVersion: "face-space-reference-statistics-method-decision-v0",
      status: "not_selected",
      decisionVersion: "invalid",
      scope: "same_provider",
      referenceCorpusSummarySchemaVersion:
        "face-space-reference-corpus-summary-v0",
      centerMethod: null,
      scaleMethod: null,
      percentileMethod: null,
      thresholdMethod: null,
      productionAuthority: false,
      normalizationAuthority: false,
      thresholdAuthority: false
    }),
  /method_decision_invalid/
);

assert.throws(
  () =>
    buildFaceSpaceNormalizationCandidate({
      readiness: sameProviderReady,
      referenceStatistics: {
        schemaVersion: "face-space-reference-statistics-v0",
        methodDecisionVersion: "synthetic-verifier-only-method-v0",
        sourceReferenceCorpusSummarySchemaVersion:
          "face-space-reference-corpus-summary-v0",
        sourceReferenceSplitFingerprint:
          syntheticReferenceFingerprint,
        methodComparisonVersion: "synthetic-verifier-comparison-v0",
        methodComparisonPacketFingerprint:
          "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        sourceSamplingFrameProvenanceRef: syntheticReferenceProvenance,
        sourceProvider: {
          source: syntheticReferenceProvider.source,
          sourceVersion: syntheticReferenceProvider.sourceVersion,
          adapterId: syntheticReferenceProvider.adapterId
        },
        referenceSplitOnly: true,
        authority: {
          productionAuthority: false,
          normalizationAuthority: false,
          thresholdAuthority: false
        },
        version: "stats-without-method-decision",
        dimensions: [
          {
            id: "lower_face_width_ratio",
            unit: "ratio",
            center: 0.75,
            scale: 0.05
          }
        ]
      }
    }),
  /method_decision_invalid/
);

const candidate = buildFaceSpaceNormalizationCandidate({
  readiness: sameProviderReady,
  methodDecision: selectedMethodDecision,
  referenceStatistics: {
        schemaVersion: "face-space-reference-statistics-v0",
        methodDecisionVersion: "synthetic-verifier-only-method-v0",
        sourceReferenceCorpusSummarySchemaVersion:
          "face-space-reference-corpus-summary-v0",
        sourceReferenceSplitFingerprint:
          syntheticReferenceFingerprint,
        methodComparisonVersion: "synthetic-verifier-comparison-v0",
        methodComparisonPacketFingerprint:
          "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        sourceSamplingFrameProvenanceRef: syntheticReferenceProvenance,
        sourceProvider: {
          source: syntheticReferenceProvider.source,
          sourceVersion: syntheticReferenceProvider.sourceVersion,
          adapterId: syntheticReferenceProvider.adapterId
        },
        referenceSplitOnly: true,
        authority: {
          productionAuthority: false,
          normalizationAuthority: false,
          thresholdAuthority: false
        },
    version: "synthetic-verifier-only-v0",
    dimensions: [
      {
        id: "lower_face_width_ratio",
        unit: "ratio",
        center: 0.75,
        scale: 0.05
      },
      {
        id: "eye_tilt",
        unit: "degree",
        center: 0,
        scale: 2
      }
    ]
  }
});
assert.equal(candidate.authority.productionAuthority, false);
assert.equal(candidate.authority.provisionalResearchOnly, true);
assert.equal(candidate.dimensions.length, 2);

assert.throws(
  () =>
    buildFaceSpaceNormalizationCandidate({
      readiness: sameProviderReady,
      methodDecision: selectedMethodDecision,
      referenceStatistics: {
        schemaVersion: "face-space-reference-statistics-v0",
        methodDecisionVersion: "synthetic-verifier-only-method-v0",
        sourceReferenceCorpusSummarySchemaVersion:
          "face-space-reference-corpus-summary-v0",
        sourceReferenceSplitFingerprint:
          syntheticReferenceFingerprint,
        methodComparisonVersion: "synthetic-verifier-comparison-v0",
        methodComparisonPacketFingerprint:
          "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        sourceSamplingFrameProvenanceRef: syntheticReferenceProvenance,
        sourceProvider: {
          source: syntheticReferenceProvider.source,
          sourceVersion: syntheticReferenceProvider.sourceVersion,
          adapterId: syntheticReferenceProvider.adapterId
        },
        referenceSplitOnly: true,
        authority: {
          productionAuthority: false,
          normalizationAuthority: false,
          thresholdAuthority: false
        },
        version: "bad-unit",
        dimensions: [
          {
            id: "eye_tilt",
            unit: "ratio",
            center: 0,
            scale: 1
          }
        ]
      }
    }),
  /reference_unit_mismatch:eye_tilt/
);

assert.throws(
  () =>
    buildFaceSpaceNormalizationCandidate({
      readiness: sameProviderReady,
      methodDecision: selectedMethodDecision,
      referenceStatistics: {
        schemaVersion: "face-space-reference-statistics-v0",
        methodDecisionVersion: "synthetic-verifier-only-method-v0",
        sourceReferenceCorpusSummarySchemaVersion:
          "face-space-reference-corpus-summary-v0",
        sourceReferenceSplitFingerprint:
          syntheticReferenceFingerprint,
        methodComparisonVersion: "synthetic-verifier-comparison-v0",
        methodComparisonPacketFingerprint:
          "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        sourceSamplingFrameProvenanceRef: syntheticReferenceProvenance,
        sourceProvider: {
          source: syntheticReferenceProvider.source,
          sourceVersion: syntheticReferenceProvider.sourceVersion,
          adapterId: syntheticReferenceProvider.adapterId
        },
        referenceSplitOnly: true,
        authority: {
          productionAuthority: false,
          normalizationAuthority: false,
          thresholdAuthority: false
        },
        version: "duplicate-id",
        dimensions: [
          {
            id: "eye_tilt",
            unit: "degree",
            center: 0,
            scale: 1
          },
          {
            id: "eye_tilt",
            unit: "degree",
            center: 0,
            scale: 1
          }
        ]
      }
    }),
  /reference_dimension_duplicate:eye_tilt/
);

const normalized = applyFaceSpaceNormalizationCandidate({
  measurement: {
    schemaVersion: "face-space-structural-measurement-v0",
    sampleId: "synthetic_verifier_only",
    dimensions: [
      {
        id: "lower_face_width_ratio",
        value: 0.8,
        unit: "ratio"
      },
      {
        id: "eye_tilt",
        value: 1,
        unit: "degree"
      }
    ]
  },
  candidate
});
assert.equal(normalized.authority.productionAuthority, false);
assert.equal(normalized.authority.provisionalResearchOnly, true);
assert.equal(normalized.dimensions.length, 2);
assert.ok(
  Math.abs(normalized.dimensions[0].value - 1) < 1e-12
);
assert.ok(
  Math.abs(normalized.dimensions[1].value - 0.5) < 1e-12
);

assert.throws(
  () =>
    evaluateFaceSpaceNormalizationReadiness({
      semanticContract,
      stabilitySummary,
      scope: "invalid_scope",
      evidence: {}
    }),
  /normalization_scope_invalid/
);

console.log(JSON.stringify({
  ok: true,
  productionAuthority: false,
  current: {
    status: currentReadiness.status,
    blockers: currentReadiness.blockers,
    readyDimensionCount: currentReadiness.readyDimensionCount
  },
  simulatedFutureGate: {
    sameProviderStatus: sameProviderReady.status,
    crossProviderWithoutCorrespondence: crossProviderHeld.status,
    crossProviderWithCorrespondence: crossProviderReady.status
  },
  invariants: {
    currentSingleFixtureCannotNormalize: true,
    actualGovernedCorpusCoverageSupersedesHistoricalCoverageBlockers: true,
    actualRealPhotoHoldBlocksProvisionalCandidate: true,
    actualReferenceStatisticsRemainResearchOnly: true,
    counterfactualCandidatePathUsesActualReferenceLineage: true,
    counterfactualPromotionIsVerifierOnlyAndNotEvidence: true,
    controlled3dDoesNotSatisfyRealPhotoGate: true,
    callerBooleansCannotSatisfyRealPhotoGate: true,
    validatedRealPhotoReportsRequiredForPoseExpressionGate: true,
    realPhotoReportsRequireRunnerProvenance: true,
    explicitRealPhotoStabilityAdequacyReviewRequired: true,
    structuralRealPhotoCoverageAloneCannotSatisfyReadiness: true,
    realPhotoAdequacyBoundToExactCollectionFingerprint: true,
    realPhotoAdequacyBoundToExactReviewPacketFingerprint: true,
    reviewPacketAloneCannotSatisfyReadiness: true,
    realPhotoNumericAdequacyThresholdNotInvented: true,
    manualCoverageFlagsCannotBypassReferenceCorpusManifest: true,
    validatedReferenceCorpusManifestRequiredForCoverageGates: true,
    explicitReferenceCorpusAdequacyReviewRequired: true,
    referenceCorpusAdequacyBoundToExactReviewPacketFingerprint: true,
    referenceCorpusReviewPacketAloneCannotSatisfyReadiness: true,
    structuralValidityAloneCannotSatisfyCoverageGates: true,
    numericAdequacyThresholdNotInvented: true,
    callerSuppliedReferenceCorpusSummaryForbidden: true,
    referenceCorpusManifestCannotAuthorizeStatistics: true,
    referenceStatisticsMethodDecisionRequired: true,
    methodDecisionMustCarryComparisonEvidence: true,
    statisticsMustMatchDecisionComparisonLineage: true,
    candidateStatisticsMustMatchReadinessCorpusLineage: true,
    currentMethodDecisionIsExplicitResearchSelection: true,
    referenceStatsMustBeExplicit: true,
    providerEquivalenceScopedToCrossProvider: true,
    provisionalCandidateResearchOnly: true,
    noArchetypeAuthority: true,
    noStyleRecommendationAuthority: true
  }
}, null, 2));
