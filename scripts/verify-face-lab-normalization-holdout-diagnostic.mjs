import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import {
  buildFaceSpaceNormalizationCandidate
} from "../lib/face-lab-face-space-normalization-research.js";
import {
  buildFaceSpaceReferenceMethodComparison
} from "../lib/face-lab-reference-method-comparison-research.js";
import {
  buildFaceSpaceReferenceMethodSelectionDecision
} from "../lib/face-lab-reference-method-selection-research.js";
import {
  estimateFaceSpaceReferenceStatistics
} from "../lib/face-lab-reference-statistics-research.js";
import {
  buildFaceSpaceNormalizationHoldoutDiagnostic
} from "../lib/face-lab-normalization-holdout-research.js";

const dimensions = [
  ["lower_face_width_ratio", "ratio"],
  ["chin_height_ratio", "ratio"],
  ["eye_spacing_ratio", "ratio"],
  ["eye_width_ratio", "ratio"],
  ["eye_tilt", "degree"],
  ["nose_width_ratio", "ratio"]
];

function measurement(sampleId, offset) {
  return {
    schemaVersion: "face-space-structural-measurement-v0",
    sampleId,
    source: "mediapipe_face_landmarker_metric_geometry",
    sourceVersion: "0.10.35",
    adapterId: "mediapipe_metric_geometry_v0",
    dimensions: dimensions.map(([id, unit], index) => ({
      id,
      unit,
      value: 0.2 + index * 0.1 + offset
    })),
    privacy: {
      sourceImagePersisted: false,
      identityEmbeddingCreated: false
    }
  };
}

function record(sampleId, subjectGroupId, split, offset, familyId) {
  return {
    sampleId,
    subjectGroupId,
    nearDuplicateFamilyId: familyId,
    provenanceRef: "synthetic-verifier-only:" + sampleId,
    split,
    archetypeGroundTruth: null,
    identityEmbeddingCreated: false,
    biometricIdentityMatchPerformed: false,
    rawImagePersistedInPacket: false,
    eligibilityQuality: {
      eligible: true,
      qualityStatus: "synthetic_verifier_only"
    },
    measurement: measurement(sampleId, offset)
  };
}

function makeManifest(referenceOffsets = [0, 0.02, 0.04], holdoutOffset = 0.03) {
  return {
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
      source: "mediapipe_face_landmarker_metric_geometry",
      sourceVersion: "0.10.35",
      adapterId: "mediapipe_metric_geometry_v0"
    },
    records: [
      record("ref_a", "subject_a", "reference", referenceOffsets[0], "family_a"),
      record("ref_b", "subject_b", "reference", referenceOffsets[1], "family_b"),
      record("ref_c", "subject_c", "reference", referenceOffsets[2], "family_c"),
      record("holdout_d", "subject_d", "holdout", holdoutOffset, "family_d")
    ]
  };
}

const manifest = makeManifest();
const comparison = buildFaceSpaceReferenceMethodComparison({
  manifest,
  comparisonVersion: "synthetic-verifier-holdout-comparison-v0"
});
const selection = buildFaceSpaceReferenceMethodSelectionDecision({
  comparison,
  selectedMethodId: "mean__standard_deviation",
  decisionVersion: "synthetic-verifier-holdout-method-v0",
  evidenceRef: "synthetic-verifier-only:holdout-method-selection",
  selectionRationale:
    "Synthetic verifier selects a supported method only to test holdout lineage."
});
const decision = selection.decision;

const statistics = estimateFaceSpaceReferenceStatistics({
  manifest,
  methodDecision: decision,
  methodComparison: comparison,
  version: "synthetic-verifier-holdout-stats-v0"
});

const readiness = {
  schemaVersion: "face-space-normalization-readiness-v0",
  normalizationVersion: "face-space-normalization-research-v0",
  status: "provisional_candidate_ready",
  evidenceState: {
    referenceCorpusManifestPresent: true,
    referenceSplitFingerprint: statistics.sourceReferenceSplitFingerprint,
    referenceCorpusSamplingFrameProvenanceRef:
      statistics.sourceSamplingFrameProvenanceRef,
    referenceCorpusProvider: statistics.sourceProvider
  },
  dimensions: dimensions.map(([id, unit]) => ({
    id,
    unit,
    normalizationStatus: "ready_for_provisional_candidate"
  }))
};

const candidate = buildFaceSpaceNormalizationCandidate({
  readiness,
  referenceStatistics: statistics,
  methodDecision: decision
});

assert.equal(candidate.referenceSplitOnly, true);
assert.equal(
  candidate.sourceReferenceCorpusSummarySchemaVersion,
  "face-space-reference-corpus-summary-v0"
);
assert.match(
  candidate.sourceReferenceSplitFingerprint,
  /^sha256:[a-f0-9]{64}$/
);
assert.equal(
  candidate.sourceSamplingFrameProvenanceRef,
  manifest.samplingFrame.provenanceRef
);
assert.deepEqual(candidate.sourceProvider, manifest.provider);

const diagnostic = buildFaceSpaceNormalizationHoldoutDiagnostic({
  manifest,
  candidate
});

assert.equal(
  diagnostic.schemaVersion,
  "face-space-normalization-holdout-diagnostic-v0"
);
assert.equal(diagnostic.status, "research_diagnostic_only");
assert.equal(diagnostic.holdoutSplitOnly, true);
assert.equal(diagnostic.holdoutSampleCount, 1);
assert.equal(diagnostic.referenceSampleCountExcluded, 3);
assert.equal(diagnostic.dimensions.length, 6);
assert.equal(diagnostic.authority.productionAuthority, false);
assert.equal(diagnostic.authority.normalizationActivationAuthority, false);
assert.equal(diagnostic.authority.acceptanceThresholdAuthority, false);
assert.equal("passed" in diagnostic, false);
assert.equal("thresholds" in diagnostic, false);

const changedReferenceOnly = makeManifest([100, 200, 300], 0.03);
assert.throws(
  () =>
    buildFaceSpaceNormalizationHoldoutDiagnostic({
      manifest: changedReferenceOnly,
      candidate
    }),
  /holdout_candidate_invalid/
);

const changedHoldout = makeManifest([0, 0.02, 0.04], 0.08);
const diagnosticWithChangedHoldout = buildFaceSpaceNormalizationHoldoutDiagnostic({
  manifest: changedHoldout,
  candidate
});
assert.notDeepEqual(
  diagnosticWithChangedHoldout.dimensions,
  diagnostic.dimensions
);

assert.throws(
  () =>
    buildFaceSpaceNormalizationHoldoutDiagnostic({
      manifest,
      candidate: {
        ...candidate,
        referenceSplitOnly: false
      }
    }),
  /holdout_candidate_invalid/
);

const actualHoldoutContract = JSON.parse(
  readFileSync(
    "evidence/facelab/face-space-normalization/v0/holdout-diagnostic.contract.json",
    "utf8"
  )
);
assert.equal(
  actualHoldoutContract.status,
  "blocked_pending_real_photo_stability_adequacy"
);
assert.equal(
  actualHoldoutContract.currentEvidence.realReferenceCorpusPresent,
  true
);
assert.equal(
  actualHoldoutContract.currentEvidence.referenceStatisticsPresent,
  true
);
assert.equal(
  actualHoldoutContract.currentEvidence
    .realPhotoStabilityAdequacyDecisionCode,
  "ADDITIONAL_EVIDENCE_REQUIRED"
);
assert.equal(
  actualHoldoutContract.currentEvidence
    .provisionalResearchCandidatePresent,
  false
);
assert.equal(
  actualHoldoutContract.currentEvidence.realHoldoutDiagnosticPresent,
  false
);
assert.equal(
  actualHoldoutContract.currentEvidence
    .productionNormalizationAuthorized,
  false
);

console.log(JSON.stringify({
  ok: true,
  status: diagnostic.status,
  productionAuthority: false,
  normalizationActivationAuthority: false,
  acceptanceThresholdAuthority: false,
  holdoutSplitOnly: true,
  referenceSplitExcludedFromDiagnostic: true,
  noPassFailDecision: true,
  noThresholds: true,
  exactReferenceSplitFingerprintRequired: true,
  alteredReferenceSplitRejected: true,
  holdoutChangesDoNotInvalidateReferenceBinding: true,
  syntheticVerifierOnly: true,
  actualHoldoutDiagnosticPersisted: false,
  actualHoldoutDiagnosticBlockedByRealPhotoAdequacy: true,
  methodSelectionBoundToComparisonEvidence: true,
  candidateBoundToReadinessCorpusLineage: true
}, null, 2));
