import { cleanEvidence, normalizeEnum, set } from "./helpers.js";

function unavailable(reason = "evidence_missing", status = "insufficient_evidence", allowedReasons = new Set()) {
  return { status: status === "unavailable" ? "unavailable" : "insufficient_evidence", source: null, confidence: null, evidence: [], unavailableReason: allowedReasons.has(reason) ? reason : "evidence_missing", value: null };
}

function qualityConfidence(value) {
  return value === "clear" ? 0.9 : value === "partial" ? 0.68 : value === "poor" ? 0.45 : null;
}

function observationConfidence(visibility, suitability) {
  const v = visibility === "clear" ? 1 : visibility === "partial" ? 0.75 : 0;
  const s = suitability === "suitable" ? 1 : suitability === "limited" ? 0.8 : 0;
  return v && s ? Number((0.9 * v * s).toFixed(2)) : null;
}

function normalizeQuality(value, S) {
  const q = S.face.quality;
  const normalized = {
    faceVisibility: normalizeEnum(value.faceVisibility, set(q.faceVisibility)),
    faceScale: normalizeEnum(value.faceScale, set(q.faceScale)),
    pose: {
      yaw: normalizeEnum(value.pose.yaw, set(S.face.pose.yaw)),
      pitch: normalizeEnum(value.pose.pitch, set(S.face.pose.pitch)),
      roll: normalizeEnum(value.pose.roll, set(S.face.pose.roll))
    },
    occlusion: Object.fromEntries(Object.entries(value.occlusion).map(([key, item]) => [key, normalizeEnum(item, set(S.face.occlusion))])),
    sharpness: normalizeEnum(value.sharpness, set(q.sharpness)),
    exposure: normalizeEnum(value.exposure, set(q.exposure)),
    lightingUniformity: normalizeEnum(value.lightingUniformity, set(q.lightingUniformity)),
    whiteBalance: normalizeEnum(value.whiteBalance, set(q.whiteBalance)),
    filterOrEditing: normalizeEnum(value.filterOrEditing, set(q.filterOrEditing)),
    makeupCoverage: normalizeEnum(value.makeupCoverage, set(q.makeupCoverage)),
    structureSuitability: normalizeEnum(value.structureSuitability, set(q.structureSuitability)),
    colorSuitability: normalizeEnum(value.colorSuitability, set(q.colorSuitability))
  };
  const evidence = cleanEvidence(value.evidence, 8);
  const valid = normalized.faceVisibility && normalized.faceScale && Object.values(normalized.pose).every(Boolean) && Object.values(normalized.occlusion).every(Boolean) && normalized.sharpness && normalized.exposure && normalized.lightingUniformity && normalized.whiteBalance && normalized.filterOrEditing && normalized.makeupCoverage && normalized.structureSuitability && normalized.colorSuitability && evidence.length;
  if (!valid || (normalized.faceVisibility === "poor" && normalized.structureSuitability === "suitable")) {
    return { status: "insufficient_evidence", source: null, confidence: null, evidence: [], unavailableReason: "quality_response_invalid", value: null };
  }
  return { status: "available", source: "vision", confidence: qualityConfidence(normalized.faceVisibility), evidence, unavailableReason: null, value: normalized };
}

function normalizeField(raw, allowed, suitability, isArray, S) {
  const reasons = set(S.face.fieldFailureReasons);
  const visibility = normalizeEnum(raw.visibility, set(S.face.visibility));
  const evidence = cleanEvidence(raw.evidence, 8);
  const reason = raw.unavailableReason === null ? null : normalizeEnum(raw.unavailableReason, reasons);
  if (suitability === "unsuitable") return unavailable(reason || "quality_insufficient", "unavailable", reasons);
  if (visibility === "uncertain") return unavailable(reason || "ambiguous", "insufficient_evidence", reasons);
  let value = isArray
    ? Array.isArray(raw.value) ? [...new Set(raw.value.filter((item) => allowed.has(item)))].slice(0, 4) : []
    : normalizeEnum(raw.value, allowed);
  if (isArray && !value.length) value = null;
  if (!value || !visibility || !evidence.length) return unavailable(!evidence.length ? "evidence_missing" : reason || "value_invalid", "insufficient_evidence", reasons);
  return { status: "available", source: "vision", confidence: observationConfidence(visibility, suitability), evidence, unavailableReason: null, value };
}

function normalizeFields(raw, quality, S) {
  const output = {};
  for (const [group, fields] of Object.entries(S.face.definitions)) {
    output[group] = {};
    for (const [name, values] of Object.entries(fields)) {
      const suitability = group === "colorAppearance" ? quality.value?.colorSuitability || "unsuitable" : quality.value?.structureSuitability || "unsuitable";
      output[group][name] = normalizeField(raw[group][name], set(values), suitability, group === "featureLayout" && name === "focalFeatures", S);
    }
  }
  return output;
}

function coverageOf(observations, S) {
  const availableGroups = [], partialGroups = [], unavailableGroups = [];
  let availableFieldCount = 0, totalCoreFieldCount = 0;
  for (const [group, fields] of Object.entries(observations)) {
    const values = Object.values(fields);
    const count = values.filter((field) => field.status === "available").length;
    if (Object.prototype.hasOwnProperty.call(S.face.coreGroupMinimums, group)) {
      totalCoreFieldCount += values.length;
      availableFieldCount += count;
      if (count >= S.face.coreGroupMinimums[group]) availableGroups.push(group);
      else if (count > 0) partialGroups.push(group);
      else unavailableGroups.push(group);
    } else if (count > 0) availableGroups.push(group);
    else unavailableGroups.push(group);
  }
  return { availableGroups, partialGroups, unavailableGroups, availableFieldCount, totalCoreFieldCount };
}

export function normalizeFace(rawFace, eligibility, { provider, model, semanticExport: S, versions }) {
  const quality = normalizeQuality(rawFace.quality, S);
  const observations = normalizeFields(rawFace.observations, quality, S);
  const coverage = coverageOf(observations, S);
  const core = Object.keys(S.face.coreGroupMinimums).filter((group) => coverage.availableGroups.includes(group)).length;
  let status = "insufficient_evidence", failureReason = "observation_coverage_insufficient";
  if (!eligibility.faceLabEligible) { status = "unavailable"; failureReason = "eligibility_failed"; }
  else if (quality.status !== "available") failureReason = "quality_response_invalid";
  else if (quality.value.structureSuitability === "unsuitable" || quality.value.faceVisibility === "poor") { status = "unavailable"; failureReason = "structure_quality_insufficient"; }
  else if (core === 5) { status = "available"; failureReason = null; }
  else if (core >= 3) { status = "partial"; failureReason = null; }
  return {
    schemaVersion: versions.faceSchemaVersion,
    model: { provider, name: model, promptVersion: versions.facePromptVersion },
    status, failureReason, quality, observations, coverage,
    warnings: quality.value?.colorSuitability === "unsuitable" ? ["color_observations_unavailable"] : [],
    privacy: { sourceImagePersisted: false }
  };
}
