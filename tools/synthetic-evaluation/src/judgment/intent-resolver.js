import {
  CANDIDATE_GENERATED_STATE,
  CANDIDATE_IDENTITY_SCHEMA_VERSION,
  CANDIDATE_MANIFEST_SCHEMA_VERSION,
  COMPILED_PROMPT_SCHEMA_VERSION
} from "@bejewely/face-contracts";
import { finalizeGenerationSpec } from "../generation/canonicalize-generation-spec.js";
import { deepFreeze, sha256Hex, stableStringify } from "../shared/canonical-json.js";

const HEX64 = /^[a-f0-9]{64}$/;
const CANDIDATE_ID = /^cand_[a-f0-9]{24}$/;

function failure(code, path, detail = null) {
  return Object.freeze({ ok: false, errors: Object.freeze([{ code, path, detail }]) });
}

function verifyFinalizedSpec(finalizedSpec) {
  if (!finalizedSpec || typeof finalizedSpec !== "object" || Array.isArray(finalizedSpec)) return null;
  const { specId, specDigest, ...draftSpec } = finalizedSpec;
  const rebuilt = finalizeGenerationSpec(draftSpec);
  if (!rebuilt.ok || rebuilt.specDigest !== specDigest || rebuilt.finalizedSpec.specId !== specId) return null;
  return rebuilt.finalizedSpec;
}

function verifyCompiledPrompt(compiledPrompt, finalizedSpec) {
  if (!compiledPrompt || typeof compiledPrompt !== "object" || Array.isArray(compiledPrompt) || compiledPrompt.schemaVersion !== COMPILED_PROMPT_SCHEMA_VERSION) return false;
  const { promptDigest, ...withoutDigest } = compiledPrompt;
  return HEX64.test(promptDigest || "") &&
    sha256Hex(stableStringify(withoutDigest)) === promptDigest &&
    compiledPrompt.specId === finalizedSpec.specId &&
    compiledPrompt.specDigest === finalizedSpec.specDigest;
}

function rebuildCandidateIdentity(manifest, compiledPrompt) {
  const payload = {
    schemaVersion: CANDIDATE_IDENTITY_SCHEMA_VERSION,
    assetId: manifest.asset.assetId,
    specDigest: manifest.generation.specDigest,
    promptDigest: manifest.generation.promptDigest,
    providerProfileId: manifest.generation.providerProfileId,
    providerProfileVersion: manifest.generation.providerProfileVersion,
    providerGenerationId: manifest.generation.providerRun.providerGenerationId,
    campaignId: manifest.grouping.campaignId,
    campaignSeriesId: manifest.grouping.campaignSeriesId,
    conditionId: manifest.grouping.conditionId,
    lineage: manifest.grouping.lineage,
    canonicalTransformPolicyVersion: manifest.asset.canonicalTransformPolicyVersion,
    compiledPromptSchemaVersion: compiledPrompt.schemaVersion
  };
  const candidateDigest = sha256Hex(stableStringify(payload));
  return { payload, candidateDigest, candidateId: `cand_${candidateDigest.slice(0, 24)}` };
}

function collectPolicyHolds(manifest) {
  const holds = [];
  const markStatus = manifest.operatorHints?.visibleExternalMark?.status;
  if (markStatus !== "absent") holds.push("external_mark_provenance_unresolved");
  if ((manifest.duplicateReferences?.exactCanonicalDuplicateOf || []).length) holds.push("exact_duplicate_requires_review");
  if ((manifest.duplicateReferences?.nearestPerceptualCandidates || []).length) holds.push("perceptual_neighbor_requires_review");
  return holds;
}

export function resolveCandidateIntent({ candidateManifest, finalizedSpec, compiledPrompt }) {
  if (!candidateManifest || typeof candidateManifest !== "object" || Array.isArray(candidateManifest)) {
    return failure("candidate_manifest_integrity_invalid", "candidateManifest");
  }
  if (
    candidateManifest.schemaVersion !== CANDIDATE_MANIFEST_SCHEMA_VERSION ||
    candidateManifest.state !== CANDIDATE_GENERATED_STATE ||
    !CANDIDATE_ID.test(candidateManifest.candidateId || "") ||
    !HEX64.test(candidateManifest.candidateDigest || "") ||
    !HEX64.test(candidateManifest.asset?.canonicalSha256 || "") ||
    !HEX64.test(candidateManifest.generation?.specDigest || "") ||
    !HEX64.test(candidateManifest.generation?.promptDigest || "")
  ) {
    return failure("candidate_manifest_integrity_invalid", "candidateManifest");
  }
  const verifiedSpec = verifyFinalizedSpec(finalizedSpec);
  if (!verifiedSpec || verifiedSpec.specDigest !== candidateManifest.generation.specDigest) {
    return failure("generation_spec_integrity_invalid", "finalizedSpec");
  }
  if (!verifyCompiledPrompt(compiledPrompt, verifiedSpec) || compiledPrompt.promptDigest !== candidateManifest.generation.promptDigest) {
    return failure("generation_spec_integrity_invalid", "compiledPrompt");
  }
  if (
    compiledPrompt.providerProfile?.id !== candidateManifest.generation.providerProfileId ||
    compiledPrompt.providerProfile?.version !== candidateManifest.generation.providerProfileVersion ||
    verifiedSpec.provenance.campaignId !== candidateManifest.grouping?.campaignId
  ) {
    return failure("intent_join_mismatch", "generation");
  }
  const expectedLineage = verifiedSpec.variation.pairingMode === "reference_edit" ? "reference_edit" : "independent";
  if (candidateManifest.grouping?.lineage?.kind !== expectedLineage) {
    return failure("intent_join_mismatch", "grouping.lineage");
  }
  if (
    expectedLineage === "reference_edit" &&
    candidateManifest.grouping.lineage.parentCandidateId !== verifiedSpec.variation.referenceCandidateId
  ) {
    return failure("intent_join_mismatch", "grouping.lineage.parentCandidateId");
  }
  if (
    expectedLineage === "independent" &&
    candidateManifest.grouping.lineage.parentCandidateId !== null
  ) {
    return failure("intent_join_mismatch", "grouping.lineage.parentCandidateId");
  }
  const identity = rebuildCandidateIdentity(candidateManifest, compiledPrompt);
  if (identity.candidateDigest !== candidateManifest.candidateDigest || identity.candidateId !== candidateManifest.candidateId) {
    return failure("candidate_manifest_integrity_invalid", "candidateId");
  }
  return Object.freeze({
    ok: true,
    intent: deepFreeze({
      candidate: {
        candidateId: candidateManifest.candidateId,
        candidateDigest: candidateManifest.candidateDigest,
        canonicalSha256: candidateManifest.asset.canonicalSha256
      },
      generation: {
        specId: verifiedSpec.specId,
        specDigest: verifiedSpec.specDigest,
        promptDigest: compiledPrompt.promptDigest,
        purpose: verifiedSpec.purpose,
        finalizedSpec: verifiedSpec
      },
      grouping: candidateManifest.grouping,
      policyHolds: collectPolicyHolds(candidateManifest)
    })
  });
}
