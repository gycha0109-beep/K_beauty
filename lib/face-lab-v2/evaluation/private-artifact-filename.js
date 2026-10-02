const LOGICAL_CASE_ID_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;

export function isFaceLabPrivateArtifactCaseId(value) {
  return typeof value === "string" &&
    LOGICAL_CASE_ID_PATTERN.test(value.trim());
}

export function faceLabPrivateArtifactStem(caseId) {
  const normalized =
    typeof caseId === "string"
      ? caseId.trim()
      : "";

  if (!isFaceLabPrivateArtifactCaseId(normalized)) {
    return null;
  }

  return normalized.replaceAll(":", "%3A");
}
