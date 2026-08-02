export const JUDGMENT_AXIS_REGISTRY_SCHEMA_VERSION = "judgment-axis-registry-v1";
export const BLIND_JUDGMENT_ASSIGNMENT_SCHEMA_VERSION = "blind-judgment-assignment-v1";
export const JUDGMENT_EXECUTION_CLAIM_SCHEMA_VERSION = "judgment-execution-claim-v1";
export const BLIND_JUDGMENT_SUBMISSION_SCHEMA_VERSION = "blind-judgment-submission-v1";
export const JUDGMENT_CONSENSUS_SCHEMA_VERSION = "judgment-consensus-v1";
export const INTENT_ALIGNMENT_SCHEMA_VERSION = "intent-alignment-v1";
export const DERIVED_GRADE_RECORD_SCHEMA_VERSION = "derived-grade-record-v1";
export const JUDGMENT_POLICY_ID = "strict-two-plus-adjudicator-v1";
export const JUDGMENT_POLICY_VERSION = "1.0.0";
export const ALIGNMENT_POLICY_ID = "bejewely-intent-alignment-v1";
export const ALIGNMENT_POLICY_VERSION = "1.0.0";

export const JUDGMENT_REASON_CODES = Object.freeze([
  "image_not_reviewable",
  "face_not_clear",
  "skin_not_clear",
  "lighting_confounds_skin",
  "makeup_confounds_skin",
  "filter_or_editing_possible",
  "occlusion_confounds_axis",
  "pose_confounds_axis",
  "observation_value_supported",
  "observation_value_disputed",
  "axis_evidence_insufficient",
  "count_band_uncertain",
  "region_uncertain",
  "capture_contract_violation"
]);

export const JUDGMENT_CAPTURE_AXES = Object.freeze([
  "capture.apparentAdultSinglePhotorealisticHuman",
  "capture.directFrontal",
  "capture.levelPitch",
  "capture.levelRoll",
  "capture.cameraGaze",
  "capture.neutralExpression",
  "capture.headShouldersFraming",
  "capture.fullHeadNeckUpperShoulders",
  "capture.plainLightGrayBackground",
  "capture.softEvenDiffuseLighting",
  "capture.sharpFace",
  "appearance.hairTiedBack",
  "appearance.hairClearOfForeheadCheeks",
  "appearance.plainCrewNeckTop",
  "appearance.glassesAbsent",
  "appearance.jewelryAbsent",
  "appearance.visibleAccessoriesAbsent",
  "appearance.visibleMakeupAbsent"
]);

export const JUDGMENT_SKIN_AXES = Object.freeze([
  "skin.redness.presence",
  "skin.redness.regions",
  "skin.blemishes.presence",
  "skin.blemishes.countBand",
  "skin.blemishes.regions"
]);

export const JUDGMENT_FACE_AXES = Object.freeze([
  "face.eyeDirection",
  "face.eyeOpenness",
  "face.faceLengthBalance",
  "face.jawlineAngularity",
  "face.straightCurveBalance",
  "face.featureContrast"
]);

export const JUDGMENT_AXIS_KEYS = Object.freeze([
  ...JUDGMENT_CAPTURE_AXES,
  ...JUDGMENT_SKIN_AXES,
  ...JUDGMENT_FACE_AXES
]);

export const JUDGMENT_AXIS_REGISTRY = Object.freeze({
  schemaVersion: JUDGMENT_AXIS_REGISTRY_SCHEMA_VERSION,
  registryId: "bejewely-synthetic-judgment-v1",
  registryVersion: "1.0.0",
  axes: JUDGMENT_AXIS_KEYS
});

export const JUDGMENT_AXIS_STATUS = Object.freeze([
  "observed",
  "uncertain",
  "unavailable",
  "not_reviewed"
]);

export const JUDGMENT_AXIS_VALUES = Object.freeze({
  capture: Object.freeze(["confirmed", "rejected"]),
  rednessPresence: Object.freeze(["none", "mild", "moderate_or_higher"]),
  blemishPresence: Object.freeze(["none", "mild", "moderate_or_higher"]),
  blemishCount: Object.freeze(["none", "one_to_two", "three_to_five", "six_plus"]),
  rednessRegions: Object.freeze(["left_cheek", "right_cheek", "sides_of_nose", "other"]),
  blemishRegions: Object.freeze(["left_cheek", "right_cheek", "chin", "other"]),
  face: Object.freeze({
    "face.eyeDirection": Object.freeze(["upturned", "level", "downturned", "mixed"]),
    "face.eyeOpenness": Object.freeze(["narrow", "medium", "wide"]),
    "face.faceLengthBalance": Object.freeze(["short", "balanced", "long"]),
    "face.jawlineAngularity": Object.freeze(["soft", "moderate", "angular"]),
    "face.straightCurveBalance": Object.freeze(["curved", "balanced", "straight"]),
    "face.featureContrast": Object.freeze(["low", "medium", "high"])
  })
});
