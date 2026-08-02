import {
  JUDGMENT_AXIS_STATUS,
  JUDGMENT_AXIS_VALUES,
  JUDGMENT_CAPTURE_AXES,
  JUDGMENT_REASON_CODES
} from "./constants.js";

export const HEX64 = /^[a-f0-9]{64}$/;
export const CANDIDATE_ID = /^cand_[a-f0-9]{24}$/;
export const OBSERVATION_RUN_ID = /^obs_[a-f0-9]{24}$/;
export const ASSIGNMENT_ID = /^jasn_[a-f0-9]{24}$/;
export const SUBMISSION_ID = /^jsub_[a-f0-9]{24}$/;
export const CONSENSUS_ID = /^jcon_[a-f0-9]{24}$/;
export const ALIGNMENT_ID = /^aln_[a-f0-9]{24}$/;
export const GRADE_RECORD_ID = /^grd_[a-f0-9]{24}$/;
export const JUDGE_ID = /^judge_[a-z0-9][a-z0-9._-]{2,63}$/;
export const SAFE_RELATIVE_PATH = /^(?![A-Za-z]:)(?!\\\\)(?!\/)(?!.*(?:^|[\\/])\.\.(?:[\\/]|$))(?!.*\0).+$/;
const OBSERVATION_PATH = /^(?:eligibility|skin|face)(?:\.[A-Za-z0-9_]+){0,8}$/;

export function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function exactKeys(value, expected) {
  if (!isObject(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

export function isIso(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function uniqueAllowedArray(value, allowed) {
  return Array.isArray(value) && value.every((item) => allowed.includes(item)) && new Set(value).size === value.length;
}

export function contractError(code, path, detail = null) {
  return Object.freeze({ code, path, detail });
}

export function validateReasonList(value, path, errors, { allowEmpty = true } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0) || value.length > 12 || !value.every((item) => JUDGMENT_REASON_CODES.includes(item)) || new Set(value).size !== value.length) {
    errors.push(contractError("judgment_submission_invalid", path));
  }
}

export function validateObservationPaths(value, path, errors) {
  if (!Array.isArray(value) || value.length > 12 || !value.every((item) => typeof item === "string" && OBSERVATION_PATH.test(item)) || new Set(value).size !== value.length) {
    errors.push(contractError("judgment_submission_invalid", path));
  }
}

export function validateObservedValue(axis, value) {
  if (JUDGMENT_CAPTURE_AXES.includes(axis)) return JUDGMENT_AXIS_VALUES.capture.includes(value);
  if (axis === "skin.redness.presence") return JUDGMENT_AXIS_VALUES.rednessPresence.includes(value);
  if (axis === "skin.redness.regions") return uniqueAllowedArray(value, JUDGMENT_AXIS_VALUES.rednessRegions);
  if (axis === "skin.blemishes.presence") return JUDGMENT_AXIS_VALUES.blemishPresence.includes(value);
  if (axis === "skin.blemishes.countBand") return JUDGMENT_AXIS_VALUES.blemishCount.includes(value);
  if (axis === "skin.blemishes.regions") return uniqueAllowedArray(value, JUDGMENT_AXIS_VALUES.blemishRegions);
  return JUDGMENT_AXIS_VALUES.face[axis]?.includes(value) || false;
}

export function validateAxisDecision(axis, decision, errors) {
  if (!exactKeys(decision, ["status", "value", "reasons", "observationPaths"]) || !JUDGMENT_AXIS_STATUS.includes(decision?.status)) {
    errors.push(contractError("judgment_submission_invalid", `axes.${axis}`));
    return;
  }
  if (decision.status === "observed") {
    if (!validateObservedValue(axis, decision.value)) errors.push(contractError("judgment_submission_invalid", `axes.${axis}.value`));
  } else if (decision.value !== null) {
    errors.push(contractError("judgment_submission_invalid", `axes.${axis}.value`));
  }
  validateReasonList(decision.reasons, `axes.${axis}.reasons`, errors, { allowEmpty: decision.status === "observed" });
  validateObservationPaths(decision.observationPaths, `axes.${axis}.observationPaths`, errors);
}
