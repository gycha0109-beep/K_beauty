import assert from "node:assert/strict";
import {
  validateRealPhotoStabilityAdequacyEvidence
} from "../lib/face-lab-real-photo-stability-adequacy.js";

const collectionSummary = {
  schemaVersion:
    "face-lab-real-photo-same-subject-stability-collection-v0",
  collectionFingerprint: "sha256:" + "a".repeat(64),
  reportCount: 4,
  runManifestDigests: [
    "sha256:" + "1".repeat(64),
    "sha256:" + "2".repeat(64)
  ],
  coveredNuisanceClasses: [
    "expression",
    "head_pitch",
    "head_roll",
    "head_yaw"
  ],
  realPhotoPoseAndExpressionCoverage: "covered_for_research",
  authority: {
    productionAuthority: false,
    thresholdAuthority: false,
    normalizationAuthority: false,
    populationAuthority: false
  }
};

const evidence = {
  schemaVersion:
    "face-lab-real-photo-stability-adequacy-evidence-v0",
  status: "adequate_for_provisional_research",
  decisionVersion: "synthetic-verifier-real-photo-adequacy-v0",
  evidenceRef: "synthetic-verifier-only:adequacy-review",
  sourceCollectionSchemaVersion: collectionSummary.schemaVersion,
  sourceCollectionFingerprint:
    collectionSummary.collectionFingerprint,
  sourceReportCount: collectionSummary.reportCount,
  sourceRunManifestDigests:
    collectionSummary.runManifestDigests,
  sourceCoveredNuisanceClasses:
    collectionSummary.coveredNuisanceClasses,
  nuisanceCoverageReviewed: true,
  subjectLinkageProvenanceReviewed: true,
  measurementDriftReviewed: true,
  sourceCaptureLimitationsReviewed: true,
  coverageLimitations: [
    "Synthetic verifier only; no real pose/expression stability adequacy is established."
  ],
  automaticAdequacyInferred: false,
  numericThresholdInvented: false,
  productionAuthority: false,
  normalizationAuthority: false,
  thresholdAuthority: false
};

const validated =
  validateRealPhotoStabilityAdequacyEvidence(
    evidence,
    collectionSummary
  );
assert.equal(validated.status, "adequate_for_provisional_research");
assert.equal(validated.authority.productionAuthority, false);
assert.equal(validated.authority.normalizationAuthority, false);
assert.equal(validated.authority.thresholdAuthority, false);
assert.equal(validated.review.automaticAdequacyInferred, false);
assert.equal(validated.review.numericThresholdInvented, false);

assert.throws(
  () =>
    validateRealPhotoStabilityAdequacyEvidence(
      {
        ...evidence,
        sourceCollectionFingerprint: "sha256:" + "b".repeat(64)
      },
      collectionSummary
    ),
  /adequacy_evidence_invalid/
);

assert.throws(
  () =>
    validateRealPhotoStabilityAdequacyEvidence(
      {
        ...evidence,
        sourceRunManifestDigests: [
          "sha256:" + "9".repeat(64)
        ]
      },
      collectionSummary
    ),
  /adequacy_evidence_invalid/
);

assert.throws(
  () =>
    validateRealPhotoStabilityAdequacyEvidence(
      {
        ...evidence,
        coverageLimitations: []
      },
      collectionSummary
    ),
  /adequacy_evidence_invalid/
);

assert.throws(
  () =>
    validateRealPhotoStabilityAdequacyEvidence(
      {
        ...evidence,
        automaticAdequacyInferred: true
      },
      collectionSummary
    ),
  /adequacy_evidence_invalid/
);

console.log(JSON.stringify({
  ok: true,
  productionAuthority: false,
  normalizationAuthority: false,
  thresholdAuthority: false,
  exactCollectionFingerprintRequired: true,
  runManifestDigestsRequired: true,
  nuisanceCoverageMustBeComplete: true,
  automaticAdequacyInferenceForbidden: true,
  numericThresholdInventionForbidden: true,
  explicitCoverageLimitationsRequired: true,
  actualAdequacyDecisionPresent: false
}, null, 2));
