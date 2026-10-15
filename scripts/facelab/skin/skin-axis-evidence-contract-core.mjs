// Evaluation-only Skin S1 contract. Not imported by the shared Vision provider,
// production recommendation engine, API response, persistence, or Style Track.
// Labels describe visible appearance only. A model confidence token is NOT a calibrated probability.
export const SKIN_AXIS_EVIDENCE_VERSION = "skin-axis-evidence-v1";
export const SKIN_VISIBLE_AXES = Object.freeze([
  "oiliness", "dehydration", "acne", "uneven_tone", "pores", "redness", "barrier"
]);

const AXES = new Set(SKIN_VISIBLE_AXES);
const AREAS = new Set([
  "full_face", "t_zone", "forehead", "nose", "cheeks", "chin", "jawline", "eye_area"
]);
const CUES = Object.freeze({
  oiliness: ["surface_shine"],
  dehydration: ["dry_texture", "visible_flaking"],
  acne: ["active_spots"],
  uneven_tone: ["tone_variation"],
  pores: ["pore_visibility"],
  redness: ["red_appearance"],
  barrier: ["surface_stress", "dry_texture", "visible_flaking"]
});
const PHOTO_STATUSES = new Set([
  "available", "unavailable", "not_provided", "ineligible", "insufficient_evidence", "unknown"
]);
const ROW_KEYS = new Set(["axis", "state", "value", "confidence", "cue", "area", "reason"]);
const TOP_KEYS = new Set(["schemaVersion", "axes"]);
const NOT_ASSESSABLE_REASONS = new Set([
  "blur", "occlusion", "lighting", "makeup", "filter", "low_resolution", "unsupported"
]);
const UNKNOWN_REASONS = new Set(["missing", "unsupported", "legacy_unverifiable", "invalid_field"]);

function record(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function onlyKeys(obj, allowed) {
  return record(obj) && Object.keys(obj).every(key => allowed.has(key));
}
function unknown(reason) {
  return { state: "unknown", value: null, confidence: "unknown", cue: null, area: null, reason };
}
function allUnknown(reason) {
  return Object.fromEntries(SKIN_VISIBLE_AXES.map(axis => [axis, unknown(reason)]));
}
function result(photoGate, status, axes, issues = []) {
  return {
    schemaVersion: SKIN_AXIS_EVIDENCE_VERSION,
    evaluationOnly: true,
    photoGate,
    status,
    axes,
    issues,
    authority: {
      scoringActivated: false,
      historicalZeroRecovered: false,
      realPhotoAccuracyVerified: false
    }
  };
}
function normalizedRow(row, axis) {
  if (!onlyKeys(row, ROW_KEYS) || Object.keys(row).length !== ROW_KEYS.size) return null;
  const { state, value, confidence, cue, area, reason } = row;
  const validCue = CUES[axis].includes(cue);
  const validArea = AREAS.has(area);
  if (state === "present") {
    return Number.isInteger(value) && value >= 1 && value <= 5
      && ["low", "medium", "high"].includes(confidence)
      && validCue && validArea && reason === "none"
      ? { state, value, confidence, cue, area, reason } : null;
  }
  if (state === "not_seen") {
    // Numeric zero ALONE can never establish this state. It requires an explicit
    // scoped cue, visible region and at least medium reported confidence.
    return value === 0 && ["medium", "high"].includes(confidence)
      && validCue && validArea && reason === "none"
      ? { state, value, confidence, cue, area, reason } : null;
  }
  if (state === "unassessable") {
    return value === null && confidence === "unknown" && cue === null && area === null
      && NOT_ASSESSABLE_REASONS.has(reason)
      ? { state, value, confidence, cue, area, reason } : null;
  }
  if (state === "unknown") {
    return value === null && confidence === "unknown" && cue === null && area === null
      && UNKNOWN_REASONS.has(reason)
      ? { state, value, confidence, cue, area, reason } : null;
  }
  return null;
}

/**
 * Interpret an explicit future Skin axis-evidence manifest, without provider calls
 * or changes to actual scoring. Legacy v1 numeric signals are deliberately NOT
 * inferred into observed-zero or positive cue states.
 *
 * @param {unknown} manifest { schemaVersion:"skin-axis-evidence-v1", axes:[{axis,state,value,confidence,cue,area,reason}] }
 * @param {{photoStatus:string, skinAnalysisEligible:boolean}} gate
 */
export function assessSkinAxisEvidence(manifest, gate = {}) {
  const photoStatus = PHOTO_STATUSES.has(gate.photoStatus) ? gate.photoStatus : "unknown";
  if (photoStatus !== "available" || gate.skinAnalysisEligible !== true) {
    const reason = photoStatus === "not_provided" ? "no_photo"
      : photoStatus === "unavailable" ? "photo_unavailable"
      : photoStatus === "ineligible" || gate.skinAnalysisEligible === false ? "image_ineligible"
      : photoStatus === "insufficient_evidence" ? "insufficient_evidence"
      : "photo_state_unknown";
    return result("blocked", "blocked", allUnknown(reason), [{ axis: null, code: reason }]);
  }

  if (!onlyKeys(manifest, TOP_KEYS) ||
      manifest.schemaVersion !== SKIN_AXIS_EVIDENCE_VERSION ||
      !Array.isArray(manifest.axes) || manifest.axes.length > 16) {
    const reason = manifest?.schemaVersion === "vision-observation-v1"
      ? "legacy_unverifiable" : "invalid_field";
    return result("usable", "unsupported_schema", allUnknown(reason), [
      { axis: null, code: reason }
    ]);
  }

  const rows = new Map();
  const issues = [];
  for (const item of manifest.axes) {
    if (!record(item) || !AXES.has(item.axis)) {
      issues.push({ axis: null, code: "unsupported_axis_or_row" });
      continue;
    }
    const existing = rows.get(item.axis) || [];
    existing.push(item);
    rows.set(item.axis, existing);
  }

  const axes = {};
  for (const axis of SKIN_VISIBLE_AXES) {
    const matches = rows.get(axis) || [];
    if (!matches.length) {
      axes[axis] = unknown("missing");
      issues.push({ axis, code: "missing_axis" });
    } else if (matches.length !== 1) {
      axes[axis] = unknown("invalid_field");
      issues.push({ axis, code: "duplicate_axis" });
    } else {
      const normalized = normalizedRow(matches[0], axis);
      axes[axis] = normalized || unknown("invalid_field");
      if (!normalized) issues.push({ axis, code: "invalid_axis_evidence" });
    }
  }
  return result("usable", issues.length ? "partial" : "ready", axes, issues);
}

// Informational predicate ONLY. It does not output points and must never be
// wired into actual recommendation priority/ranking without separate approval.
export function hasUsablePositiveSkinAxisEvidence(evaluation, axis) {
  if (evaluation?.schemaVersion !== SKIN_AXIS_EVIDENCE_VERSION ||
      evaluation?.photoGate !== "usable" || !AXES.has(axis)) return false;
  const observed = evaluation.axes?.[axis];
  return observed?.state === "present" &&
    (observed.confidence === "medium" || observed.confidence === "high");
}
