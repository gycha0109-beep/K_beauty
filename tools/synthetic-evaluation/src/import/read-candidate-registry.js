import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { hammingDistance64 } from "./image-processing.js";

export async function readCandidateRegistry(dataRoot) {
  const candidatesRoot = path.join(dataRoot, "candidates");
  let entries;
  try {
    entries = await readdir(candidatesRoot, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const manifests = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const manifestPath = path.join(candidatesRoot, entry.name, "manifest.json");
    try {
      const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
      if (manifest?.candidateId === entry.name && manifest?.state === "G0_GENERATED") {
        manifests.push(manifest);
      } else {
        throw new Error(`invalid candidate manifest: ${manifestPath}`);
      }
    } catch (error) {
      if (error?.code === "ENOENT") {
        continue;
      }
      throw error;
    }
  }
  return manifests;
}

export function findDuplicateReferences(manifests, canonicalSha256, fingerprintValue, candidateId) {
  const exactCanonicalDuplicateOf = manifests
    .filter((manifest) => manifest.candidateId !== candidateId)
    .filter((manifest) => manifest.asset?.canonicalSha256 === canonicalSha256)
    .map((manifest) => manifest.candidateId)
    .sort();

  const nearestPerceptualCandidates = manifests
    .filter((manifest) => manifest.candidateId !== candidateId)
    .filter((manifest) => /^[a-f0-9]{16}$/.test(manifest.asset?.perceptualFingerprint?.value || ""))
    .map((manifest) => ({
      candidateId: manifest.candidateId,
      hammingDistance: hammingDistance64(fingerprintValue, manifest.asset.perceptualFingerprint.value)
    }))
    .sort((left, right) => left.hammingDistance - right.hammingDistance || left.candidateId.localeCompare(right.candidateId))
    .slice(0, 5);

  return Object.freeze({
    exactCanonicalDuplicateOf: Object.freeze(exactCanonicalDuplicateOf),
    nearestPerceptualCandidates: Object.freeze(nearestPerceptualCandidates.map(Object.freeze))
  });
}
