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
