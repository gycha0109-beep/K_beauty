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

export { createBlindJudgmentAssignment, verifyBlindJudgmentAssignmentIntegrity } from "./judgment/assignment.js";
export { buildJudgmentExecutionClaim, finalizeJudgmentSubmission, verifyJudgmentSubmissionIntegrity } from "./judgment/submission.js";
export { buildJudgmentConsensus, verifyJudgmentConsensusIntegrity } from "./judgment/consensus.js";
export { resolveCandidateIntent } from "./judgment/intent-resolver.js";
export { alignJudgmentToIntent, verifyIntentAlignmentIntegrity } from "./judgment/alignment.js";
export { deriveG2ObservedRecord, deriveG3ConsensusRecord, verifyDerivedGradeRecordIntegrity } from "./judgment/grades.js";
export { prepareBlindJudgmentAssignment } from "./judgment/prepare-assignment.js";
export { readAndResolveCandidateIntent } from "./judgment/read-intent-artifacts.js";
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
