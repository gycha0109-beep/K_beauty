import path from "node:path";

export function judgmentClaimRelativePath(assignmentId, judgeId) {
  return path.posix.join("judgment", "claims", assignmentId, `${judgeId}.json`);
}

export function judgmentSubmissionObjectRelativePath(submissionDigest) {
  return path.posix.join("judgment", "submissions", submissionDigest.slice(0, 2), `${submissionDigest}.json`);
}

export function judgmentSubmissionManifestRelativePath(assignmentId, judgeId) {
  return path.posix.join("judgment", "manifests", assignmentId, `${judgeId}.json`);
}

export function judgmentConsensusRelativePath(candidateId, consensusDigest) {
  return path.posix.join("judgment", "consensus", candidateId, `${consensusDigest}.json`);
}

export function intentAlignmentObjectRelativePath(alignmentDigest) {
  return path.posix.join("alignment", "objects", alignmentDigest.slice(0, 2), `${alignmentDigest}.json`);
}

export function intentAlignmentManifestRelativePath(candidateId, alignmentId) {
  return path.posix.join("alignment", "manifests", candidateId, `${alignmentId}.json`);
}

export function derivedGradeRecordRelativePath(candidateId, gradeRecordId) {
  return path.posix.join("grades", candidateId, `${gradeRecordId}.json`);
}

export function toNativePath(root, relativePath) {
  return path.join(root, ...relativePath.split("/"));
}

export function relativeFromRoot(root, absolutePath) {
  return path.relative(root, absolutePath).split(path.sep).join("/");
}
