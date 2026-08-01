import {
  CANONICAL_IMAGE_POLICY_VERSION,
  CANDIDATE_GENERATED_STATE,
  CANDIDATE_IDENTITY_SCHEMA_VERSION,
  CANDIDATE_MANIFEST_SCHEMA_VERSION,
  PERCEPTUAL_FINGERPRINT_ALGORITHM
} from "@bejewely/face-contracts";
import { deepFreeze, sha256Hex, stableStringify } from "../generation/canonicalize-generation-spec.js";

export function buildCandidateIdentity({ request, inspection, compiledPrompt }) {
  const payload = {
    schemaVersion: CANDIDATE_IDENTITY_SCHEMA_VERSION,
    assetId: inspection.assetId,
    specDigest: request.generationArtifact.expectedSpecDigest,
    promptDigest: request.generationArtifact.expectedPromptDigest,
    providerProfileId: request.providerRun.providerProfileId,
    providerProfileVersion: request.providerRun.providerProfileVersion,
    providerGenerationId: request.providerRun.providerGenerationId,
    campaignId: request.grouping.campaignId,
    campaignSeriesId: request.grouping.campaignSeriesId,
    conditionId: request.grouping.conditionId,
    lineage: request.grouping.lineage,
    canonicalTransformPolicyVersion: CANONICAL_IMAGE_POLICY_VERSION,
    compiledPromptSchemaVersion: compiledPrompt.schemaVersion
  };
  const candidateDigest = sha256Hex(stableStringify(payload));
  return deepFreeze({
    payload,
    candidateDigest,
    candidateId: `cand_${candidateDigest.slice(0, 24)}`
  });
}

export function buildCandidateManifest({
  candidateIdentity,
  request,
  inspection,
  canonical,
  fingerprint,
  paths,
  duplicates,
  registeredAt
}) {
  return deepFreeze({
    schemaVersion: CANDIDATE_MANIFEST_SCHEMA_VERSION,
    candidateId: candidateIdentity.candidateId,
    candidateDigest: candidateIdentity.candidateDigest,
    state: CANDIDATE_GENERATED_STATE,
    asset: {
      assetId: inspection.assetId,
      rawSha256: inspection.rawSha256,
      rawObjectRelativePath: paths.raw,
      canonicalSha256: canonical.canonicalSha256,
      canonicalObjectRelativePath: paths.canonical,
      canonicalTransformPolicyVersion: canonical.transformPolicyVersion,
      perceptualFingerprint: {
        algorithm: PERCEPTUAL_FINGERPRINT_ALGORITHM,
        value: fingerprint.value
      }
    },
    generation: {
      specDigest: request.generationArtifact.expectedSpecDigest,
      promptDigest: request.generationArtifact.expectedPromptDigest,
      artifactReferences: {
        spec: {
          digest: request.generationArtifact.expectedSpecDigest,
          objectRelativePath: paths.spec
        },
        compiledPrompt: {
          digest: request.generationArtifact.expectedPromptDigest,
          objectRelativePath: paths.prompt
        }
      },
      providerProfileId: request.providerRun.providerProfileId,
      providerProfileVersion: request.providerRun.providerProfileVersion,
      providerRun: request.providerRun
    },
    grouping: request.grouping,
    operatorAttestation: request.operatorAttestation,
    operatorHints: request.operatorHints,
    duplicateReferences: {
      exactCanonicalDuplicateOf: duplicates.exactCanonicalDuplicateOf,
      nearestPerceptualCandidates: duplicates.nearestPerceptualCandidates
    },
    registeredAt
  });
}

export function buildAssetManifest({ inspection, canonical, fingerprint, paths, registeredAt }) {
  return deepFreeze({
    schemaVersion: "asset-manifest-v1",
    assetId: inspection.assetId,
    raw: {
      schemaVersion: "raw-asset-v1",
      rawSha256: inspection.rawSha256,
      byteLength: inspection.byteLength,
      detectedFormat: inspection.detectedFormat,
      originalExtension: inspection.originalExtension,
      width: inspection.width,
      height: inspection.height,
      frameCount: 1,
      hasAlpha: inspection.hasAlpha,
      storedRelativePath: paths.raw
    },
    canonical: {
      schemaVersion: "canonical-asset-v1",
      transformPolicyVersion: canonical.transformPolicyVersion,
      canonicalSha256: canonical.canonicalSha256,
      width: canonical.width,
      height: canonical.height,
      format: "png",
      metadataStripped: true,
      storedRelativePath: paths.canonical,
      perceptualFingerprint: fingerprint
    },
    registeredAt
  });
}
