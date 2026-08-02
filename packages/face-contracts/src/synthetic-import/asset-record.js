export const RAW_ASSET_SCHEMA_VERSION = "raw-asset-v1";
export const CANONICAL_ASSET_SCHEMA_VERSION = "canonical-asset-v1";
export const ASSET_MANIFEST_SCHEMA_VERSION = "asset-manifest-v1";
export const CANONICAL_IMAGE_POLICY_VERSION = "canonical-image-v1";
export const PERCEPTUAL_FINGERPRINT_ALGORITHM = "dhash64-v1";

export function createBlindCandidateInput(candidateManifest) {
  return Object.freeze({
    candidateId: candidateManifest.candidateId,
    canonicalAsset: Object.freeze({
      sha256: candidateManifest.asset.canonicalSha256,
      objectRelativePath: candidateManifest.asset.canonicalObjectRelativePath,
      transformPolicyVersion: candidateManifest.asset.canonicalTransformPolicyVersion
    })
  });
}
