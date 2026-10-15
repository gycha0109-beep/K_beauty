// S1-B offline ONLY: inspect an ineligible, nonhuman v2 output BEFORE the
// production-style eligibility gate intentionally blocks all Skin observations.
// No Provider, disk, photo, raw output retention, skin diagnosis or scoring.
import { normalizeImageAnalysisEligibility } from "../../../lib/image-analysis-eligibility.js";
import {
  assessSkinAxisEvidence, SKIN_VISIBLE_AXES, SKIN_AXIS_EVIDENCE_VERSION
} from "./skin-axis-evidence-contract-core.mjs";

export const NONFACE_ABSTENTION_AUDIT_VERSION = "skin-v2-nonface-abstention-audit-v1";
const EXPECTED_SCHEMA = "vision-observation-v2";
const COUNTS = ["present", "not_seen", "unassessable", "unknown"];
function record(x) { return x !== null && typeof x === "object" && !Array.isArray(x); }
function closedKeys(x, keys) {
  return record(x) && Object.keys(x).every(k => keys.includes(k));
}
function asCount(x) {
  return Number.isSafeInteger(x) && x >= 0 ? x : null;
}
/**
 * Privacy-bounded data-shape audit: never return row content, evidence,
 * unsolicited keys, photo data, text or anything identifying a person.
 * Audit verdicts do NOT confer eligible-photo or release acceptance.
 */
export function inspectNonfaceSkinV2Abstention(parsed) {
  const base = {
    version: NONFACE_ABSTENTION_AUDIT_VERSION,
    nonfaceEligibilityVerified: false,
    skinEligible: false,
    axisRowCount: null,
    axisShapeValid: false,
    withheldPositiveOrZeroCues: false,
    shapeIssuesCount: null,
    shapeIssues: [],
    stateCounts: { present: 0, not_seen: 0, unassessable: 0, unknown: 0 },
    verdict: "INVALID_OR_NOT_V2",
    contractPolicy: "RESEARCH_CANDIDATE_EMPTY_WHEN_INELIGIBLE_SEVEN_WHEN_ELIGIBLE",
    ownerApprovalPending: true,
    providerSourcePersisted: false,
    actualHumanSkinAccuracyVerified: false,
    productReady: false,
    releaseReady: false
  };
  if (!record(parsed) || parsed.schemaVersion !== EXPECTED_SCHEMA) return base;
  const eligibility = normalizeImageAnalysisEligibility(parsed.eligibility);
  const isNonface = eligibility.source === "vision" &&
    eligibility.status === "ineligible" &&
    eligibility.faceLabEligible === false &&
    eligibility.skinAnalysisEligible === false &&
    eligibility.imageType !== "photorealistic_human";
  if (!isNonface) {
    return { ...base, skinEligible: eligibility.skinAnalysisEligible === true,
      verdict: "ELIGIBILITY_NOT_INELIGIBLE_NONFACE" };
  }
  const nonfaceBase = { ...base, nonfaceEligibilityVerified: true };
  if (!closedKeys(parsed, ["schemaVersion", "eligibility", "skin", "face"]) ||
      !closedKeys(parsed.skin, ["axisEvidence"]) ||
      !Array.isArray(parsed.skin.axisEvidence)) {
    return { ...nonfaceBase, verdict: "SKIN_OUTPUT_MISSING_OR_UNEXPECTED_SHAPE" };
  }
  const rows = parsed.skin.axisEvidence;
  const rowCount = rows.length;
  if (rowCount === 0) {
    // Clarified research v2 prompt asks for [] when Skin ineligible.
    // This is only an offline candidate policy, not the live Provider contract.
    return { ...nonfaceBase, axisRowCount: 0,
      axisShapeValid: true, withheldPositiveOrZeroCues: true,
      verdict: "EXPECTED_INELIGIBLE_EMPTY_AXES_RESEARCH_ONLY" };
  }
  if (rowCount !== SKIN_VISIBLE_AXES.length) {
    return { ...nonfaceBase, axisRowCount: rowCount,
      verdict: "AXIS_COUNT_INCOMPLETE_OR_EXCESSIVE" };
  }
  // IMPORTANT: evaluate raw rows with the existing S1-A shape validator by
  // providing its *synthetic* usable gate solely for validation. Never reuse
  // its normalized observations as an eligibility or scoring decision.
  const inspection = assessSkinAxisEvidence({
    schemaVersion: SKIN_AXIS_EVIDENCE_VERSION, axes: rows
  }, { photoStatus: "available", skinAnalysisEligible: true });
  const states = { present: 0, not_seen: 0, unassessable: 0, unknown: 0 };
  for (const axis of Object.values(inspection.axes || {})) {
    if (COUNTS.includes(axis?.state)) states[axis.state]++;
  }
  const issues = (inspection.issues || []).map(x => x?.code).filter(x =>
    ["unsupported_axis_or_row", "missing_axis", "duplicate_axis", "invalid_axis_evidence",
      "invalid_field", "legacy_unverifiable"].includes(x));
  const shapeValid = inspection.status === "ready";
  if (!shapeValid) {
    return { ...nonfaceBase, axisRowCount: rowCount,
      axisShapeValid: false, shapeIssuesCount: asCount(inspection.issues?.length),
      shapeIssues: [...new Set(issues)], stateCounts: states,
      verdict: "INVALID_SKIN_AXIS_ROWS" };
  }
  const safeAbstention = states.present === 0 && states.not_seen === 0;
  return {
    ...nonfaceBase,
    axisRowCount: rowCount,
    axisShapeValid: true,
    shapeIssuesCount: 0,
    withheldPositiveOrZeroCues: safeAbstention,
    stateCounts: states,
    verdict: safeAbstention
      ? "SEVEN_ABSTAINING_AXES_NOT_EMPTY_CONTRACT"
      : "UNSAFE_NONFACE_POSITIVE_OR_OBSERVED_ZERO"
  };
}
