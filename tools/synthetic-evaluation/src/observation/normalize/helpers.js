export const set = (items) => new Set(items);

export function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function exactKeys(value, keys) {
  if (!isObject(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

export function cleanEvidence(value, limit) {
  return Array.isArray(value)
    ? [...new Set(value
        .map((item) => typeof item === "string" ? item.trim().replace(/\s+/g, " ") : "")
        .filter(Boolean))].slice(0, limit)
    : [];
}

export function normalizeEnum(value, allowed) {
  return typeof value === "string" && allowed.has(value) ? value : null;
}

export function hasExactRawObservationShape(parsed, semanticExport) {
  const S = semanticExport;
  if (!exactKeys(parsed, ["schemaVersion", "eligibility", "skin", "face"])) return false;
  if (!exactKeys(parsed.eligibility, [
    "status", "source", "imageType", "humanFaceCount", "faceLabEligible",
    "skinAnalysisEligible", "faceLabFailureReason", "skinFailureReason", "confidence", "evidence"
  ])) return false;
  if (
    !exactKeys(parsed.skin, ["signals", "observations"]) ||
    !exactKeys(parsed.skin.signals, S.skin.signalAxes) ||
    !Array.isArray(parsed.skin.observations) ||
    parsed.skin.observations.length > 4 ||
    parsed.skin.observations.some((item) => !exactKeys(item, ["key", "area", "cue", "level", "confidence"]))
  ) return false;
  if (!exactKeys(parsed.face, ["quality", "observations"])) return false;
  if (!exactKeys(parsed.face.quality, [
    "faceVisibility", "faceScale", "pose", "occlusion", "sharpness", "exposure",
    "lightingUniformity", "whiteBalance", "filterOrEditing", "makeupCoverage",
    "structureSuitability", "colorSuitability", "evidence"
  ])) return false;
  if (
    !exactKeys(parsed.face.quality.pose, ["yaw", "pitch", "roll"]) ||
    !exactKeys(parsed.face.quality.occlusion, ["forehead", "brows", "eyes", "cheeks", "jawline"])
  ) return false;
  const definitions = S.face.definitions;
  if (!exactKeys(parsed.face.observations, Object.keys(definitions))) return false;
  for (const [group, fields] of Object.entries(definitions)) {
    if (!exactKeys(parsed.face.observations[group], Object.keys(fields))) return false;
    for (const fieldName of Object.keys(fields)) {
      if (!exactKeys(parsed.face.observations[group][fieldName], ["value", "visibility", "evidence", "unavailableReason"])) return false;
    }
  }
  return true;
}
