import path from "node:path";

export function rawObjectRelativePath(rawSha256, format) {
  const extension = format === "jpeg" ? "jpg" : format;
  return path.posix.join("objects", "raw", "sha256", rawSha256.slice(0, 2), `${rawSha256}.${extension}`);
}

export function canonicalObjectRelativePath(canonicalSha256) {
  return path.posix.join("objects", "canonical", "sha256", canonicalSha256.slice(0, 2), `${canonicalSha256}.png`);
}

export function specObjectRelativePath(specDigest) {
  return path.posix.join("objects", "generation", "spec", "by-digest", specDigest.slice(0, 2), `${specDigest}.json`);
}

export function promptObjectRelativePath(promptDigest) {
  return path.posix.join("objects", "generation", "prompt", "by-digest", promptDigest.slice(0, 2), `${promptDigest}.json`);
}

export function assetRecordRelativePath(assetId) {
  return path.posix.join("assets", `${assetId}.json`);
}

export function candidateManifestRelativePath(candidateId) {
  return path.posix.join("candidates", candidateId, "manifest.json");
}

export function toNativePath(root, relativePath) {
  return path.join(root, ...relativePath.split("/"));
}
