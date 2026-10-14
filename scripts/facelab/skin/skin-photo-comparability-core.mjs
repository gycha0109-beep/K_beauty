// S3 evaluation-only comparability preflight. No photo/image IO, storage, provider, policy or UI changes.
export const SKIN_COMPARE_VERSION = "skin-photo-comparability-v1";
export const SKIN_COMPARISON_AXES = Object.freeze([
  "oiliness", "dehydration", "acne", "uneven_tone", "pores", "redness", "barrier"
]);
const AXES = new Set(SKIN_COMPARISON_AXES);
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const STATUS = new Set(["available", "ineligible", "insufficient_evidence", "unavailable", "not_provided"]);
const LIGHTING = new Set(["controlled", "natural", "low", "harsh", "unknown"]);
const WHITE_BALANCE = new Set(["neutral", "warm", "cool", "unknown"]);
const BINARY = new Set(["none", "present", "unknown"]);
const ANGLE = new Set(["front", "left", "right", "unknown"]);
const RESOLUTION = new Set(["adequate", "low", "unknown"]);
const SIGNAL_STATE = new Set(["observed", "unassessable", "unknown"]);
const CONFIDENCE = new Set(["low", "medium", "high", "unknown"]);
const PHOTO_FIELDS = new Set(["captureId", "subjectGroupId", "capturedAt", "photoStatus", "conditions", "signals"]);
const CONDITION_FIELDS = new Set(["deviceClass", "lighting", "whiteBalance", "makeup", "filter", "angle", "resolution"]);
const SIGNAL_FIELDS = new Set(["state", "score", "confidence"]);
function record(value) { return value && typeof value === "object" && !Array.isArray(value); }
function keys(obj, whitelist, name) {
  if (!record(obj) || Object.keys(obj).some(k => !whitelist.has(k))) {
    throw new Error("invalid_" + name);
  }
}
function validTime(time) {
  return typeof time === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(time) &&
    Number.isFinite(Date.parse(time));
}
function validate(photo) {
  keys(photo, PHOTO_FIELDS, "capture_object");
  for (const key of ["captureId", "subjectGroupId"]) {
    if (!ID.test(photo[key] || "")) throw new Error("invalid_" + key);
  }
  if (!validTime(photo.capturedAt)) throw new Error("invalid_capturedAt");
  if (!STATUS.has(photo.photoStatus)) throw new Error("invalid_photoStatus");
  keys(photo.conditions, CONDITION_FIELDS, "conditions");
  const c = photo.conditions;
  if (typeof c.deviceClass !== "string" || !ID.test(c.deviceClass) ||
      !LIGHTING.has(c.lighting) || !WHITE_BALANCE.has(c.whiteBalance) ||
      !BINARY.has(c.makeup) || !BINARY.has(c.filter) ||
      !ANGLE.has(c.angle) || !RESOLUTION.has(c.resolution)) {
    throw new Error("invalid_capture_condition");
  }
  if (!record(photo.signals) || !Object.keys(photo.signals).every(a => AXES.has(a))) {
    throw new Error("invalid_signals");
  }
  for (const [axis, s] of Object.entries(photo.signals)) {
    keys(s, SIGNAL_FIELDS, "signal_" + axis);
    if (!SIGNAL_STATE.has(s.state) || !CONFIDENCE.has(s.confidence)) {
      throw new Error("invalid_signal_state_" + axis);
    }
    if (s.state === "observed") {
      if (!Number.isInteger(s.score) || s.score < 0 || s.score > 5) {
        throw new Error("invalid_observed_score_" + axis);
      }
    } else if (s.score !== null) {
      throw new Error("unobserved_must_be_null_" + axis);
    }
  }
  return photo;
}
function classifyGlobal(before, after) {
  const reasons = [];
  if (before.subjectGroupId !== after.subjectGroupId) reasons.push("different_subject_group");
  if (before.captureId === after.captureId) reasons.push("same_capture_replayed");
  if (Date.parse(after.capturedAt) <= Date.parse(before.capturedAt)) reasons.push("nonchronological_capture");
  if (before.photoStatus !== "available" || after.photoStatus !== "available") reasons.push("photo_not_available");
  const left = before.conditions, right = after.conditions;
  if (left.filter !== "none" || right.filter !== "none") reasons.push("filter_present_or_unknown");
  if (left.makeup !== "none" || right.makeup !== "none") reasons.push("makeup_present_or_unknown");
  if (left.whiteBalance === "unknown" || right.whiteBalance === "unknown" ||
      left.whiteBalance !== right.whiteBalance) reasons.push("white_balance_not_controlled");
  if (["low", "harsh", "unknown"].includes(left.lighting) ||
      ["low", "harsh", "unknown"].includes(right.lighting) ||
      left.lighting !== right.lighting) reasons.push("lighting_not_controlled");
  const hard = reasons.length > 0;
  const limited = [];
  if (left.deviceClass !== right.deviceClass) limited.push("device_mismatch");
  if (left.angle === "unknown" || right.angle === "unknown" || left.angle !== right.angle) limited.push("angle_mismatch");
  if (left.resolution !== "adequate" || right.resolution !== "adequate") limited.push("resolution_limit");
  if (left.angle !== "front" || right.angle !== "front") limited.push("off_axis_capture");
  return {
    status: hard ? "not_comparable" : limited.length ? "limited" : "comparable",
    reasonCodes: [...reasons, ...limited].sort()
  };
}
export function compareSkinPhotoSessions(rawBefore, rawAfter) {
  const before = validate(rawBefore), after = validate(rawAfter);
  const global = classifyGlobal(before, after);
  const axes = {};
  for (const axis of SKIN_COMPARISON_AXES) {
    const b = before.signals[axis], a = after.signals[axis];
    const axisReasons = [];
    if (!b || !a) axisReasons.push("signal_missing");
    else if (b.state !== "observed" || a.state !== "observed") axisReasons.push("signal_unassessable_or_unknown");
    else if (!["high", "medium"].includes(b.confidence) ||
             !["high", "medium"].includes(a.confidence)) axisReasons.push("low_field_confidence");
    const status = global.status === "not_comparable" ? "not_comparable" :
      axisReasons.length ? "not_comparable" : global.status;
    axes[axis] = {
      status,
      reasonCodes: [...global.reasonCodes, ...axisReasons].sort(),
      beforeEvidenceState: b?.state || "missing",
      afterEvidenceState: a?.state || "missing",
      rawScoreDeltaForAudit: status === "comparable" && b && a ? a.score - b.score : null,
      improvementClaimAuthorized: false
    };
  }
  return {
    version: SKIN_COMPARE_VERSION,
    status: global.status,
    reasonCodes: global.reasonCodes,
    axes,
    authority: {
      metadataPreflightOnly: true,
      sameHumanOrPhotographyVerified: false,
      improvementClaimAuthorized: false,
      providerCalls: 0,
      photoStorageAuthorized: false,
      productPolicyChangeAuthorized: false
    }
  };
}
