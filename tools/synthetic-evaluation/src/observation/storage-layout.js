import path from "node:path";

export function observationStorageLayout(dataRoot, candidateId, runId, observationDigest = null) {
  const runDirectory = path.join(dataRoot, "observation-runs", candidateId, runId);
  const observationObjectPath = observationDigest
    ? path.join(dataRoot, "objects", "observations", "by-digest", observationDigest.slice(0, 2), `${observationDigest}.json`)
    : null;
  return Object.freeze({
    runDirectory,
    claimPath: path.join(runDirectory, "claim.json"),
    manifestPath: path.join(runDirectory, "manifest.json"),
    observationObjectPath
  });
}

export function relativeFromDataRoot(dataRoot, absolutePath) {
  return path.relative(dataRoot, absolutePath).split(path.sep).join("/");
}
