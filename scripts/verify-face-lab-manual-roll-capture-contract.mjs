import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const contract = JSON.parse(
  readFileSync(
    "evidence/facelab/source-intake/v0/manual-roll-capture.contract.json",
    "utf8"
  )
);
const receipt = JSON.parse(
  readFileSync(
    "evidence/facelab/source-intake/v0/manual-roll-capture-receipt.json",
    "utf8"
  )
);
const runOutput = JSON.parse(
  readFileSync(
    "evidence/facelab/photo-geometry/v0/manual-roll-stability-run-output.json",
    "utf8"
  )
);
const reviewPacket = JSON.parse(
  readFileSync(
    "evidence/facelab/photo-geometry/v0/manual-roll-stability-review-packet.json",
    "utf8"
  )
);
const supplementalPosePrescreen = JSON.parse(
  readFileSync(
    "evidence/facelab/photo-geometry/v0/supplemental-roll-pose-prescreen.json",
    "utf8"
  )
);

assert.equal(contract.schemaVersion, "face-lab-manual-roll-capture-contract-v0");
assert.equal(contract.status, "capture_measured_supplemental_pose_prescreened_additional_evidence_required");
assert.equal(contract.nuisanceClass, "head_roll");
assert.equal(
  contract.captureReceiptRef,
  "evidence/facelab/source-intake/v0/manual-roll-capture-receipt.json"
);
assert.deepEqual(contract.captureProtocol.requiredViews, [
  "neutral_front",
  "roll_left",
  "roll_right"
]);
assert.equal(contract.captureProtocol.sameSessionRequired, true);
assert.equal(contract.captureProtocol.syntheticRotationAllowed, false);
assert.equal(contract.captureProtocol.warpAugmentationAllowed, false);
assert.equal(contract.captureProtocol.mirroredImageSubstitutionAllowed, false);
assert.equal(contract.captureProtocol.rollAngleThresholdDegrees, null);
assert.equal(contract.captureProtocol.targetRollDegrees, null);
assert.equal(contract.captureProtocol.angleThresholdAuthority, false);

assert.equal(contract.consent.explicitConsentRequired, true);
assert.equal(contract.consent.consentEvidenceRefRequired, true);
assert.equal(contract.consent.usageScopeMustBeRecorded, true);
assert.equal(contract.consent.commercialResearchUseMustBeExplicitIfApplicable, true);
assert.equal(contract.consent.biometricIdentityMatchingAllowed, false);
assert.equal(contract.consent.identityEmbeddingAllowed, false);

assert.equal(contract.storage.rawImagesPersistedInRepository, false);
assert.equal(contract.storage.rawImagesPersistedInEvidencePackets, false);
assert.equal(contract.storage.rawLandmarksPersisted, false);
assert.equal(contract.storage.localImagePathsPersistedInEvidencePackets, false);
assert.equal(contract.storage.sourceImageSha256ReceiptsAllowed, true);
assert.equal(contract.storage.transientLocalPathsAllowedOnlyDuringMeasurement, true);

assert.equal(contract.readiness.captureDataPresent, true);
assert.equal(contract.readiness.rollEvidencePresent, true);
assert.equal(contract.readiness.descriptiveReviewPacketPresent, true);
assert.equal(contract.readiness.adequacyDecisionPresent, true);
assert.equal(
  contract.readiness.adequacyDecisionCode,
  "ADDITIONAL_EVIDENCE_REQUIRED"
);
assert.equal(contract.readiness.provisionalResearchGateGranted, false);
assert.equal(contract.readiness.additionalEvidenceRequired, true);
assert.equal(contract.readiness.currentSubjectCount, 1);
assert.equal(contract.readiness.currentObservationCount, 2);
assert.equal(contract.readiness.supplementalPosePrescreenPresent, true);
assert.equal(contract.readiness.supplementalPosePrescreenSubjectSetCount, 2);
assert.equal(contract.readiness.supplementalPosePrescreenImageCount, 6);
assert.equal(
  contract.readiness.supplementalFaceLabMetricMeasurementExecuted,
  false
);
assert.equal(contract.readiness.measuredSubjectCount, 1);
assert.equal(contract.readiness.measuredObservationCount, 2);
assert.equal(
  contract.supplementalPosePrescreen.evidenceRef,
  "evidence/facelab/photo-geometry/v0/supplemental-roll-pose-prescreen.json"
);
assert.equal(
  contract.supplementalPosePrescreen.faceLabMetricMeasurementExecuted,
  false
);
assert.equal(
  contract.supplementalPosePrescreen.structuralStabilityEvidenceAdded,
  false
);
assert.deepEqual(contract.expansionRequirement.reasonCodes, [
  "head_roll_subject_diversity_limited",
  "head_roll_distributional_evidence_limited"
]);
assert.equal(
  contract.expansionRequirement.additionalSubjectDiversityRequired,
  true
);
assert.equal(contract.expansionRequirement.exactMinimumSubjectCount, null);
assert.equal(
  contract.expansionRequirement.automaticAdequacyAtSubjectCount,
  false
);
assert.equal(
  contract.expansionRequirement.sameSessionCaptureUnitRetained,
  true
);
assert.equal(
  contract.expansionRequirement.numericRollThresholdIntroduced,
  false
);
assert.equal(
  contract.expansionRequirement.syntheticSubstitutionAllowed,
  false
);
assert.equal(
  contract.expansionRequirement.reReviewRequiredAfterExpansion,
  true
);
assert.equal(
  contract.expansionRequirement.multiSubjectToolingPreflight.verified,
  true
);
assert.equal(
  contract.expansionRequirement.multiSubjectToolingPreflight.syntheticSubjectCount,
  2
);
assert.equal(
  contract.expansionRequirement.multiSubjectToolingPreflight.expectedPairsPerSubject,
  2
);
assert.equal(
  contract.expansionRequirement.multiSubjectToolingPreflight.expectedViewsPerSubject,
  3
);
assert.equal(
  contract.expansionRequirement.multiSubjectToolingPreflight.adequacyThreshold,
  false
);
assert.equal(
  contract.expansionRequirement.multiSubjectToolingPreflight.empiricalEvidence,
  false
);
assert.equal(
  contract.measurementEvidenceRef,
  "evidence/facelab/photo-geometry/v0/manual-roll-stability-run-output.json"
);
assert.equal(
  contract.descriptiveReviewPacketRef,
  "evidence/facelab/photo-geometry/v0/manual-roll-stability-review-packet.json"
);

assert.equal(receipt.schemaVersion, "face-lab-manual-roll-capture-receipt-v0");
assert.equal(receipt.status, "capture_measured_review_packet_ready");
assert.equal(receipt.nuisanceClass, "head_roll");
assert.equal(receipt.commercialResearchUseAuthorized, true);
assert.equal(receipt.subjectCount, 1);
assert.equal(receipt.subjects.length, 1);
assert.equal(receipt.captureValidation.requiredViewsPresent, true);
assert.equal(receipt.captureValidation.sameSessionDeclared, true);
assert.equal(receipt.captureValidation.headRollViewsSelectedWithoutYawSubstitution, true);
assert.equal(receipt.captureValidation.numericRollThresholdApplied, false);
assert.equal(receipt.captureValidation.measurementExecuted, true);
assert.equal(
  receipt.captureValidation.measurementEvidenceRef,
  contract.measurementEvidenceRef
);
assert.equal(
  receipt.captureValidation.descriptiveReviewPacketRef,
  contract.descriptiveReviewPacketRef
);

for (const subject of receipt.subjects) {
  assert.match(subject.subjectId, /^[a-zA-Z0-9_-]+$/);
  assert.equal(subject.sameSession, true);
  assert.equal(subject.explicitConsent, true);
  assert.equal(subject.biometricIdentityMatchPerformed, false);
  assert.equal(subject.syntheticRotationApplied, false);
  assert.equal(subject.warpAugmentationApplied, false);
  assert.deepEqual(
    Object.keys(subject.views).sort(),
    ["neutralFront", "rollLeft", "rollRight"].sort()
  );
  for (const view of Object.values(subject.views)) {
    assert.match(view.sampleId, /^[a-zA-Z0-9_-]+$/);
    assert.match(view.sha256, /^[a-f0-9]{64}$/);
    assert.equal(view.mediaType, "image/jpeg");
    assert.ok(Number.isInteger(view.width) && view.width > 0);
    assert.ok(Number.isInteger(view.height) && view.height > 0);
  }
}

assert.equal(receipt.privacy.rawImagesPersistedInRepository, false);
assert.equal(receipt.privacy.rawImagesPersistedInEvidencePackets, false);
assert.equal(receipt.privacy.rawLandmarksPersisted, false);
assert.equal(receipt.privacy.localImagePathsPersisted, false);
assert.equal(receipt.privacy.identityEmbeddingCreated, false);
assert.equal(receipt.privacy.biometricIdentityMatchPerformed, false);
assert.equal(receipt.privacy.sourceImageSha256ReceiptsOnly, true);

assert.equal(runOutput.schemaVersion, "face-lab-real-photo-stability-run-output-v0");
assert.equal(runOutput.ok, true);
assert.equal(runOutput.reports.length, 2);
assert.deepEqual(runOutput.manifestSummary.coveredNuisanceClasses, ["head_roll"]);
assert.equal(
  reviewPacket.sourceCollectionFingerprint,
  runOutput.collectionSummary.collectionFingerprint
);
assert.equal(reviewPacket.sourceReportCount, runOutput.reports.length);
assert.deepEqual(reviewPacket.sourceCoveredNuisanceClasses, ["head_roll"]);
assert.equal(reviewPacket.reviewSemantics.descriptiveOnly, true);
assert.equal(reviewPacket.reviewSemantics.thresholdsApplied, false);
assert.equal(reviewPacket.reviewSemantics.automaticPassFail, false);
assert.equal(reviewPacket.reviewSemantics.automaticRanking, false);

const subject = receipt.subjects[0];
const leftReport = runOutput.reports.find((report) =>
  report.pairGroupId.endsWith("_left")
);
const rightReport = runOutput.reports.find((report) =>
  report.pairGroupId.endsWith("_right")
);
assert.ok(leftReport && rightReport);
assert.equal(
  subject.views.neutralFront.sha256,
  leftReport.executionProvenance.referenceImageSha256
);
assert.equal(
  subject.views.neutralFront.sha256,
  rightReport.executionProvenance.referenceImageSha256
);
assert.equal(
  subject.views.rollLeft.sha256,
  leftReport.executionProvenance.candidateImageSha256
);
assert.equal(
  subject.views.rollRight.sha256,
  rightReport.executionProvenance.candidateImageSha256
);

for (const authority of [contract.authority, receipt.authority]) {
  assert.equal(authority.productionAuthority, false);
  assert.equal(authority.normalizationAuthority, false);
  assert.equal(authority.thresholdAuthority, false);
  assert.equal(authority.adequacyDecisionAuthority, false);
  assert.equal(authority.populationAuthority, false);
}

const expansionTmp = mkdtempSync(
  path.join(tmpdir(), "face-lab-roll-expansion-preflight-")
);
try {
  const imagePath = (subjectId, view) =>
    path.join(expansionTmp, subjectId + "-" + view + ".jpg");
  const subjects = ["synthetic_subject_a", "synthetic_subject_b"].map(
    (subjectId, index) => {
      const neutralFrontPath = imagePath(subjectId, "neutral");
      const rollLeftPath = imagePath(subjectId, "left");
      const rollRightPath = imagePath(subjectId, "right");
      writeFileSync(
        neutralFrontPath,
        Buffer.from("synthetic-verifier-only-neutral-" + index)
      );
      writeFileSync(
        rollLeftPath,
        Buffer.from("synthetic-verifier-only-left-" + index)
      );
      writeFileSync(
        rollRightPath,
        Buffer.from("synthetic-verifier-only-right-" + index)
      );
      return {
        subjectId,
        consentEvidenceRef:
          "synthetic-verifier-only:consent-" + subjectId,
        sessionRef: "synthetic-session-" + subjectId,
        sameSession: true,
        explicitConsent: true,
        biometricIdentityMatchPerformed: false,
        syntheticRotationApplied: false,
        warpAugmentationApplied: false,
        neutralFront: { path: neutralFrontPath },
        rollLeft: { path: rollLeftPath },
        rollRight: { path: rollRightPath }
      };
    }
  );

  const specPath = path.join(expansionTmp, "capture-spec.json");
  const manifestPath = path.join(expansionTmp, "manifest.json");
  writeFileSync(
    specPath,
    JSON.stringify(
      {
        schemaVersion: "face-lab-manual-roll-capture-spec-v0",
        nuisanceClass: "head_roll",
        captureSetRef:
          "synthetic-verifier-only:multi-subject-roll-preflight",
        usageScope:
          "synthetic verifier only; not empirical stability evidence",
        commercialResearchUseAuthorized: true,
        subjects
      },
      null,
      2
    ) + "\n"
  );

  const build = spawnSync(
    process.execPath,
    [
      "scripts/build-face-lab-manual-roll-measurement-manifest.mjs",
      specPath,
      manifestPath
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024
    }
  );
  assert.equal(
    build.status,
    0,
    "multi-subject roll preflight failed: " +
      String(build.stderr || build.stdout || "")
  );
  const buildSummary = JSON.parse(build.stdout);
  const expansionManifest = JSON.parse(readFileSync(manifestPath, "utf8"));

  assert.equal(buildSummary.subjectCount, 2);
  assert.equal(buildSummary.pairCount, 4);
  assert.equal(expansionManifest.pairs.length, 4);
  assert.equal(
    new Set(
      expansionManifest.pairs.map(
        (pair) => pair.subjectLinkage.evidenceRef
      )
    ).size,
    2
  );
  assert.deepEqual(
    expansionManifest.pairs.map((pair) => pair.nuisance.class),
    ["head_roll", "head_roll", "head_roll", "head_roll"]
  );
  assert.equal(
    expansionManifest.pairs.every(
      (pair) =>
        pair.subjectLinkage.method === "manual_same_subject_pair" &&
        pair.subjectLinkage.biometricIdentityMatchPerformed === false &&
        pair.reference.rawImagePersistenceAllowed === false &&
        pair.candidate.rawImagePersistenceAllowed === false
    ),
    true
  );
  assert.equal(
    expansionManifest.sourceSet.rawImagePersistenceAllowed,
    false
  );

  const duplicateSpecPath = path.join(
    expansionTmp,
    "capture-spec-duplicate-subject.json"
  );
  writeFileSync(
    duplicateSpecPath,
    JSON.stringify(
      {
        schemaVersion: "face-lab-manual-roll-capture-spec-v0",
        nuisanceClass: "head_roll",
        captureSetRef:
          "synthetic-verifier-only:duplicate-subject-preflight",
        usageScope: "synthetic verifier only",
        commercialResearchUseAuthorized: true,
        subjects: [subjects[0], { ...subjects[1], subjectId: subjects[0].subjectId }]
      },
      null,
      2
    ) + "\n"
  );
  const duplicateBuild = spawnSync(
    process.execPath,
    [
      "scripts/build-face-lab-manual-roll-measurement-manifest.mjs",
      duplicateSpecPath,
      path.join(expansionTmp, "duplicate-manifest.json")
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024
    }
  );
  assert.notEqual(
    duplicateBuild.status,
    0,
    "duplicate subject IDs must fail the roll expansion builder"
  );
} finally {
  rmSync(expansionTmp, { recursive: true, force: true });
}

assert.equal(
  supplementalPosePrescreen.schemaVersion,
  "face-lab-supplemental-roll-pose-prescreen-v0"
);
assert.equal(
  supplementalPosePrescreen.status,
  "supplemental_triplets_pose_prescreened_metric_measurement_pending"
);
assert.equal(
  supplementalPosePrescreen.sourceContext.subjectGroupingBasis,
  "user_grouped_triplets"
);
assert.equal(
  supplementalPosePrescreen.sourceContext.biometricIdentityMatchingUsed,
  false
);
assert.equal(
  supplementalPosePrescreen.sourceContext.identityEmbeddingCreated,
  false
);
assert.equal(
  supplementalPosePrescreen.prescreenMethod.faceLabMetricGeometryEquivalent,
  false
);
assert.equal(
  supplementalPosePrescreen.prescreenMethod.adequacyThreshold,
  false
);
assert.equal(
  supplementalPosePrescreen.summary.supplementalSubjectSetCount,
  2
);
assert.equal(supplementalPosePrescreen.summary.imageCount, 6);
assert.equal(
  supplementalPosePrescreen.summary.faceLabMetricMeasurementExecuted,
  false
);
assert.equal(
  supplementalPosePrescreen.summary.structuralStabilityEvidenceAdded,
  false
);
assert.equal(supplementalPosePrescreen.subjects.length, 2);
for (const supplementalSubject of supplementalPosePrescreen.subjects) {
  assert.deepEqual(
    supplementalSubject.views.map((view) => view.view),
    ["neutral_front", "roll_left", "roll_right"]
  );
  assert.equal(supplementalSubject.views.length, 3);
  for (const view of supplementalSubject.views) {
    assert.match(view.sha256, /^[a-f0-9]{64}$/);
    assert.ok(Number.isInteger(view.width) && view.width > 0);
    assert.ok(Number.isInteger(view.height) && view.height > 0);
    assert.ok(Number.isFinite(view.approxEyeLineRollDegrees));
    assert.ok(Number.isInteger(view.faceDetectorCount) && view.faceDetectorCount >= 1);
  }
  const [neutral, left, right] = supplementalSubject.views;
  assert.ok(Math.abs(neutral.approxEyeLineRollDegrees) < Math.abs(left.approxEyeLineRollDegrees));
  assert.ok(Math.abs(neutral.approxEyeLineRollDegrees) < Math.abs(right.approxEyeLineRollDegrees));
  assert.ok(left.approxEyeLineRollDegrees * right.approxEyeLineRollDegrees < 0);
  assert.equal(
    supplementalSubject.interpretation.eligibleForTransientMetricMeasurement,
    true
  );
  assert.equal(
    supplementalSubject.interpretation.adequacyDecisionImpact,
    "none_until_face_lab_metric_measurement"
  );
}
assert.equal(
  supplementalPosePrescreen.privacy.rawImagesPersistedInRepository,
  false
);
assert.equal(
  supplementalPosePrescreen.privacy.localPathsPersisted,
  false
);
for (const value of Object.values(supplementalPosePrescreen.authority)) {
  assert.equal(value, false);
}

const serialized = JSON.stringify({
  contract,
  receipt,
  runOutput,
  reviewPacket,
  supplementalPosePrescreen
});
assert.equal(serialized.includes("/mnt/data/"), false);
assert.equal(serialized.includes("\\mnt\\data\\"), false);
assert.equal(serialized.includes('"path"'), false);

console.log(JSON.stringify({
  ok: true,
  nuisanceClass: "head_roll",
  captureDataPresent: true,
  rollEvidencePresent: true,
  descriptiveReviewPacketPresent: true,
  adequacyDecisionCode: "ADDITIONAL_EVIDENCE_REQUIRED",
  additionalEvidenceRequired: true,
  supplementalPosePrescreenPresent: true,
  supplementalPosePrescreenSubjectSetCount: 2,
  supplementalFaceLabMetricMeasurementExecuted: false,
  multiSubjectExpansionPreflightVerified: true,
  syntheticPreflightSubjectCount: 2,
  preflightSubjectCountIsAdequacyThreshold: false,
  empiricalEvidenceCreatedByPreflight: false,
  measurementExecuted: true,
  angleThresholdAuthority: false,
  rawImagesPersistedInRepository: false,
  localImagePathsPersisted: false,
  productionAuthority: false
}, null, 2));
