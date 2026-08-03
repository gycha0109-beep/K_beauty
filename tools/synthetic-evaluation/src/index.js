import "@bejewely/face-contracts";

export { compileGenerationPrompt } from "./generation/compile-prompt.js";
export {
  buildGenerationSemanticPayload,
  deepFreeze,
  finalizeGenerationSpec,
  sha256Hex,
  stableStringify
} from "./generation/canonicalize-generation-spec.js";
export { SKIN_CONTROL_FIXTURES, createPairedSkinEditDraft } from "./generation/fixtures/skin-control-fixtures.js";
export { PROVIDER_PROFILES, resolveProviderProfile } from "./generation/providers/provider-profiles.js";
export { REFERENCE_PORTRAIT_EXCLUSIONS_V1, resolveExclusionRegistry } from "./generation/registries/exclusions-v1.js";

export { importCandidate } from "./import/import-candidate.js";
export { resolveSafeContainedFile, validateRelativePath } from "./import/resolve-safe-path.js";
export {
  canonicalizeImageBuffer,
  fingerprintCanonicalBuffer,
  hammingDistance64,
  inspectImageBuffer
} from "./import/image-processing.js";
export { buildCandidateIdentity, buildCandidateManifest, buildAssetManifest } from "./import/build-candidate.js";
export { readCandidateRegistry, findDuplicateReferences } from "./import/read-candidate-registry.js";

export { observeCandidate } from "./observation/observe-candidate.js";
export { preflightObservationRun } from "./observation/preflight-observation.js";
export { normalizeObservationPayload } from "./observation/normalize-observation.js";
export { createObservationExecutionClaim, readObservationObject, readObservationRun, registerObservationRun } from "./observation/register-observation-run.js";
export { executeBoundedOpenAIObservation, ObservationTransportError } from "./observation/openai-transport.js";
export { ELIGIBLE_PARITY_FIXTURE, INELIGIBLE_PARITY_FIXTURE, INVALID_PARITY_FIXTURE } from "./observation/parity-fixtures.js";
export { OBSERVATION_ADAPTER_PROFILE, resolveObservationAdapterProfile } from "./observation/profiles.js";
export {
  CANONICAL_OBSERVATION_SNAPSHOT,
  OBSERVATION_PROMPT,
  OBSERVATION_PROMPT_DIGEST,
  OBSERVATION_SEMANTIC_EXPORT,
  OBSERVATION_SEMANTIC_EXPORT_DIGEST,
  verifyCanonicalObservationSnapshot
} from "./observation/snapshot/canonical-v1.js";
export { verifyObservationSourceCheckout } from "./observation/snapshot/verify-source-checkout.js";

export { verifyBlindJudgmentAssignmentIntegrity } from "./judgment/assignment.js";
export { verifyJudgmentSubmissionIntegrity } from "./judgment/submission.js";
export { verifyJudgmentConsensusIntegrity } from "./judgment/consensus.js";
export { verifyIntentAlignmentIntegrity } from "./judgment/alignment.js";
export { verifyDerivedGradeRecordIntegrity } from "./judgment/grades.js";
export { prepareBlindJudgmentAssignment } from "./judgment/prepare-assignment.js";
export { prepareStoredJudgmentAlignment } from "./judgment/stored-alignment.js";
export {
  readJudgmentConsensus,
  readJudgmentSubmissionByDigest,
  registerJudgmentConsensus,
  registerJudgmentSubmission
} from "./judgment/blind-registrar.js";
export {
  registerDerivedGradeRecord,
  registerIntentAlignment
} from "./judgment/alignment-registrar.js";

export {
  confirmPromotion,
  preparePromotionConfirmation,
  preparePromotionPolicyReviewPreflight,
  preparePromotionSourcePreflight,
  revokePromotion
} from "./promotion/orchestrator.js";
export { verifyPromotionSourceSnapshotIntegrity } from "./promotion/source-snapshot.js";
export { verifyPromotionEvidenceBundleIntegrity } from "./promotion/evidence.js";
export { verifyPromotionReviewSubmissionIntegrity } from "./promotion/promotion-review.js";
export {
  projectPromotionStatus,
  verifyG4GradeRecordIntegrity,
  verifyPromotionDecisionIntegrity,
  verifyPromotionStatusEventIntegrity
} from "./promotion/decision.js";

export * from "./campaign/index.js";
export {
  buildAndStoreCampaignReviewPackage,
  confirmCampaignReport,
  exportCampaignReport,
  preflightCampaignReport
} from "./reporting/orchestrator.js";
export {
  verifyCampaignEvidenceSnapshotIntegrity,
  verifyCampaignMetricSetIntegrity,
  verifyCampaignSlotRowIntegrity
} from "./reporting/derive.js";
export { verifyCampaignReviewPackageIntegrity } from "./reporting/review-package.js";
export { verifyCampaignReportIntegrity, verifyReportReviewSubmissionIntegrity, verifyReportRevisionLinkIntegrity } from "./reporting/claims-report.js";
export { verifyCampaignExportManifestIntegrity } from "./reporting/render.js";

export {
  lockAndActivateDataset,
  materializeHoldoutReferences,
  preflightDatasetLock,
  verifyCurrentDataset
} from "./dataset/orchestrator.js";
export { appendDatasetVersionStatus, appendG5Status } from "./dataset/status.js";
export {
  activateRegressionBaseline,
  preflightRegressionBaseline,
  verifyRegressionBaselineIntegrity,
  verifyRegressionBaselineReviewIntegrity
} from "./dataset/baseline.js";
export { verifyDatasetSourceSnapshotIntegrity } from "./dataset/source.js";
export { verifyLeakageGraphIntegrity } from "./dataset/leakage.js";
export { verifyDatasetExposureClaimIntegrity } from "./dataset/exposure.js";
export { verifyDatasetSplitAssignmentIntegrity, verifyDatasetSplitPlanIntegrity } from "./dataset/split.js";
export { verifyDatasetLockReviewIntegrity } from "./dataset/review.js";
export {
  verifyDatasetActivationManifestIntegrity,
  verifyDatasetLockBasisIntegrity,
  verifyDatasetMemberIntegrity,
  verifyDatasetVersionManifestIntegrity,
  verifyDatasetVersionStatusEventIntegrity,
  verifyG5HoldoutRecordIntegrity,
  verifyG5StatusEventIntegrity
} from "./dataset/lock.js";

export {
  claimSoloReviewItem,
  confirmSoloWaveBrief,
  linkSoloBriefToCheckpoint,
  prepareSoloWave,
  revealSoloIntent,
  submitSoloIntentAssessment,
  submitSoloScreening
} from "./solo-assessment/orchestrator.js";
export {
  SOLO_ASSESSMENT_POLICY,
  deriveSoloTargetRelation,
  verifySoloCheckpointLinkIntegrity,
  verifySoloIntentAssessmentIntegrity,
  verifySoloIntentRevealReceiptIntegrity,
  verifySoloTargetWithheldScreeningIntegrity,
  verifySoloWaveAssessmentSetIntegrity,
  verifySoloWaveBriefIntegrity,
  verifySoloWaveSessionIntegrity
} from "./solo-assessment/artifacts.js";
