import {
  SOLO_ARTIFACT_STATES,
  SOLO_ASSESSMENT_AUTHORITY,
  SOLO_ASSESSMENT_POLICY_SCHEMA_VERSION,
  SOLO_BLEMISH_COUNT_BANDS,
  SOLO_BLEMISH_REGIONS,
  SOLO_CHECKPOINT_LINK_SCHEMA_VERSION,
  SOLO_CUE_ALIGNMENT_SCHEMA_VERSION,
  SOLO_DECISIONS,
  SOLO_EVIDENCE_AGREEMENTS,
  SOLO_EXCLUDED_FIELDS,
  SOLO_INTENT_ASSESSMENT_SCHEMA_VERSION,
  SOLO_INTENT_REVEAL_RECEIPT_SCHEMA_VERSION,
  SOLO_LIMITATIONS,
  SOLO_OPERATIONAL_DISPOSITIONS,
  SOLO_PLAN_DERIVED_WAVE_ASSESSMENT_SET_SCHEMA_VERSION,
  SOLO_PLAN_DERIVED_WAVE_SESSION_SCHEMA_VERSION,
  SOLO_POLICY_ID,
  SOLO_POLICY_VERSION,
  SOLO_PRESENCE,
  SOLO_REASON_CODES,
  SOLO_REDNESS_REGIONS,
  SOLO_REPORT_AUTHORITY,
  SOLO_REVIEWABILITY,
  SOLO_ROW_AUTHORITIES,
  SOLO_SCREENING_CLAIM_SCHEMA_VERSION,
  SOLO_SLOT_READINESS,
  SOLO_T5_STATUS,
  SOLO_TARGET_RELATIONS,
  SOLO_T4_RELATION_INPUTS,
  SOLO_ALIGNMENT_AXES,
  SOLO_ALIGNMENT_DIAGNOSTIC_FLAGS,
  SOLO_ALIGNMENT_LIMITATION_CODES,
  SOLO_ALIGNMENT_REQUIRED_LIMITATIONS,
  SOLO_TARGET_WITHHELD_SCREENING_SCHEMA_VERSION,
  SOLO_TRI_STATE,
  SOLO_USABILITY,
  SOLO_WAVE_ASSESSMENT_ROW_SCHEMA_VERSION,
  SOLO_WAVE_ASSESSMENT_SET_SCHEMA_VERSION,
  SOLO_WAVE_BRIEF_SCHEMA_VERSION,
  SOLO_WAVE_CONDITION_COUNTS,
  SOLO_WAVE_SHAPE_SCHEMA_VERSION,
  SOLO_WAVE_SESSION_SCHEMA_VERSION,
  SOLO_WAVE_SLOT_COUNTS,
  SOLO_WAVE_ALIGNMENT_REPORT_SCHEMA_VERSION,
  TARGET_WITHHELD_REVIEW_ITEM_SCHEMA_VERSION
} from "./constants.js";

const HEX64 = /^[a-f0-9]{64}$/;
const TOKEN = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const FIXTURE_TOKEN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const SESSION_ID = /^solo_[a-f0-9]{24}$/;
const REVIEW_ITEM_ID = /^sri_[a-f0-9]{24}$/;
const RUN_ID = /^crun_[a-f0-9]{24}$/;
const SLOT_ID = /^slot_[a-f0-9]{24}$/;
const CANDIDATE_ID = /^cand_[a-f0-9]{24}$/;
const SAFE_RELATIVE_PATH = /^(?![A-Za-z]:)(?!\\\\)(?!\/)(?!.*(?:^|[\\/])\.\.(?:[\\/]|$))(?!.*\0).+$/;

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, expected) {
  if (!isObject(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function isIso(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}

function uniqueEnumArray(value, allowed) {
  return Array.isArray(value) && value.every((item) => allowed.includes(item)) && new Set(value).size === value.length;
}

function uniqueReasonCodes(value) {
  return uniqueEnumArray(value, SOLO_REASON_CODES);
}

function error(code, path, detail = null) {
  return Object.freeze({ code, path, detail });
}

function result(errors) {
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors) });
}

function countMap(value, keys, expectedTotal = null) {
  if (!exactKeys(value, keys)) return false;
  if (!Object.values(value).every((count) => Number.isInteger(count) && count >= 0)) return false;
  return expectedTotal === null || Object.values(value).reduce((sum, count) => sum + count, 0) === expectedTotal;
}

export function validateSoloAssessmentPolicy(value) {
  const keys = [
    "schemaVersion",
    "policyId",
    "policyVersion",
    "authority",
    "requiredOperatorCount",
    "targetWithheldScreeningRequired",
    "intentRevealAfterScreeningOnly",
    "sameSlotQualityRegenerationAllowed",
    "t5ReuseAllowed",
    "promotionAllowed",
    "datasetLockAllowed",
    "policyDigest"
  ];
  if (!exactKeys(value, keys)) return result([error("solo_policy_invalid", "$")]);
  const valid =
    value.schemaVersion === SOLO_ASSESSMENT_POLICY_SCHEMA_VERSION &&
    value.policyId === SOLO_POLICY_ID &&
    value.policyVersion === SOLO_POLICY_VERSION &&
    value.authority === SOLO_ASSESSMENT_AUTHORITY &&
    value.requiredOperatorCount === 1 &&
    value.targetWithheldScreeningRequired === true &&
    value.intentRevealAfterScreeningOnly === true &&
    value.sameSlotQualityRegenerationAllowed === false &&
    value.t5ReuseAllowed === false &&
    value.promotionAllowed === false &&
    value.datasetLockAllowed === false &&
    HEX64.test(value.policyDigest || "");
  return result(valid ? [] : [error("solo_policy_invalid", "$")]);
}

export function validateSoloWaveShape(value) {
  const keys = ["schemaVersion","campaignPlanDigest","waveOrdinal","expectedSlotCount","conditionCounts","shapeSource","shapeDigest"];
  if (!exactKeys(value, keys)) return result([error("solo_wave_shape_invalid", "$")]);
  const conditionCountsValid = countMap(value.conditionCounts, ["A","B","C","D"], value.expectedSlotCount);
  const valid =
    value.schemaVersion === SOLO_WAVE_SHAPE_SCHEMA_VERSION &&
    HEX64.test(value.campaignPlanDigest || "") &&
    [1,2,3].includes(value.waveOrdinal) &&
    Number.isInteger(value.expectedSlotCount) && value.expectedSlotCount > 0 &&
    conditionCountsValid &&
    value.shapeSource === "campaign_plan" &&
    HEX64.test(value.shapeDigest || "");
  return result(valid ? [] : [error("solo_wave_shape_invalid", "$")]);
}

export function validateSoloWaveSession(value) {
  const planDerived = value?.schemaVersion === SOLO_PLAN_DERIVED_WAVE_SESSION_SCHEMA_VERSION;
  const keys = ["schemaVersion","sessionId","campaignRunId","campaignPlanDigest","sourceProjectionDigest","waveOrdinal","expectedSlotCount",...(planDerived ? ["waveShape","slotSetDigest"] : []),"operatorId","actorCount","policyDigest","privateReviewMapDigest","createdAt","sessionDigest"];
  if (!exactKeys(value, keys)) return result([error("solo_session_invalid", "$")]);
  const expectedSlotCount = planDerived ? value.waveShape?.expectedSlotCount : SOLO_WAVE_SLOT_COUNTS[value.waveOrdinal];
  const shapeValid = !planDerived || (
    validateSoloWaveShape(value.waveShape).ok &&
    value.waveShape.campaignPlanDigest === value.campaignPlanDigest &&
    value.waveShape.waveOrdinal === value.waveOrdinal
  );
  const valid =
    [SOLO_WAVE_SESSION_SCHEMA_VERSION, SOLO_PLAN_DERIVED_WAVE_SESSION_SCHEMA_VERSION].includes(value.schemaVersion) &&
    SESSION_ID.test(value.sessionId || "") &&
    RUN_ID.test(value.campaignRunId || "") &&
    HEX64.test(value.campaignPlanDigest || "") &&
    HEX64.test(value.sourceProjectionDigest || "") &&
    [1,2,3].includes(value.waveOrdinal) &&
    value.expectedSlotCount === expectedSlotCount &&
    shapeValid &&
    (!planDerived || HEX64.test(value.slotSetDigest || "")) &&
    TOKEN.test(value.operatorId || "") &&
    value.actorCount === 1 &&
    HEX64.test(value.policyDigest || "") &&
    HEX64.test(value.privateReviewMapDigest || "") &&
    isIso(value.createdAt) &&
    HEX64.test(value.sessionDigest || "");
  return result(valid ? [] : [error("solo_session_invalid", "$")]);
}

export function validateTargetWithheldReviewItem(value) {
  const keys = ["schemaVersion","reviewItemId","canonicalAsset","readiness","priorTargetKnowledgePossible","excludedFields","itemDigest"];
  if (!exactKeys(value, keys)) return result([error("solo_review_item_invalid", "$")]);
  const assetValid = value.canonicalAsset === null || (
    exactKeys(value.canonicalAsset, ["sha256","objectRelativePath"]) &&
    HEX64.test(value.canonicalAsset.sha256 || "") &&
    SAFE_RELATIVE_PATH.test(value.canonicalAsset.objectRelativePath || "")
  );
  const valid =
    value.schemaVersion === TARGET_WITHHELD_REVIEW_ITEM_SCHEMA_VERSION &&
    REVIEW_ITEM_ID.test(value.reviewItemId || "") &&
    assetValid &&
    SOLO_SLOT_READINESS.includes(value.readiness) &&
    value.priorTargetKnowledgePossible === true &&
    Array.isArray(value.excludedFields) &&
    value.excludedFields.length === SOLO_EXCLUDED_FIELDS.length &&
    value.excludedFields.every((item, index) => item === SOLO_EXCLUDED_FIELDS[index]) &&
    HEX64.test(value.itemDigest || "");
  return result(valid ? [] : [error("solo_review_item_invalid", "$")]);
}

export function validateSoloScreeningClaim(value) {
  const keys = ["schemaVersion","sessionDigest","reviewItemId","operatorId","itemDigest","claimState","claimedAt","claimDigest"];
  if (!exactKeys(value, keys)) return result([error("solo_screening_claim_invalid", "$")]);
  const valid =
    value.schemaVersion === SOLO_SCREENING_CLAIM_SCHEMA_VERSION &&
    HEX64.test(value.sessionDigest || "") &&
    REVIEW_ITEM_ID.test(value.reviewItemId || "") &&
    TOKEN.test(value.operatorId || "") &&
    HEX64.test(value.itemDigest || "") &&
    value.claimState === "claimed" &&
    isIso(value.claimedAt) &&
    HEX64.test(value.claimDigest || "");
  return result(valid ? [] : [error("solo_screening_claim_invalid", "$")]);
}

export function validateSoloTargetWithheldScreening(value) {
  const keys = ["schemaVersion","sessionDigest","reviewItemId","operatorId","claimDigest","reviewability","capture","skinObservation","artifactFlags","reasonCodes","priorTargetKnowledgeAcknowledged","submittedAt","screeningDigest"];
  if (!exactKeys(value, keys)) return result([error("solo_screening_invalid", "$")]);
  const captureKeys = ["singleAdultSyntheticPerson","directFrontalLevelPose","cameraGazeNeutralExpression","headShouldersFraming","plainBackground","softEvenLighting","sharpFace","hairMakeupAccessoriesControlled"];
  const captureValid = exactKeys(value.capture, captureKeys) && Object.values(value.capture || {}).every((item) => SOLO_TRI_STATE.includes(item));
  const reviewabilityValid = exactKeys(value.reviewability, ["face","skin"]) && Object.values(value.reviewability || {}).every((item) => SOLO_REVIEWABILITY.includes(item));
  const rednessValid = exactKeys(value.skinObservation?.redness, ["presence","regions"]) && SOLO_PRESENCE.includes(value.skinObservation.redness.presence) && uniqueEnumArray(value.skinObservation.redness.regions, SOLO_REDNESS_REGIONS);
  const blemishesValid = exactKeys(value.skinObservation?.blemishes, ["presence","countBand","regions"]) && SOLO_PRESENCE.includes(value.skinObservation.blemishes.presence) && SOLO_BLEMISH_COUNT_BANDS.includes(value.skinObservation.blemishes.countBand) && uniqueEnumArray(value.skinObservation.blemishes.regions, SOLO_BLEMISH_REGIONS);
  const skinValid = exactKeys(value.skinObservation, ["redness","blemishes"]) && rednessValid && blemishesValid;
  const artifactKeys = ["distortedAnatomy","duplicatedOrMissingFeature","visibleTextOrExternalMark","filterOrRetouchPossible"];
  const artifactValid = exactKeys(value.artifactFlags, artifactKeys) && Object.values(value.artifactFlags || {}).every((item) => SOLO_ARTIFACT_STATES.includes(item));
  const valid =
    value.schemaVersion === SOLO_TARGET_WITHHELD_SCREENING_SCHEMA_VERSION &&
    HEX64.test(value.sessionDigest || "") &&
    REVIEW_ITEM_ID.test(value.reviewItemId || "") &&
    TOKEN.test(value.operatorId || "") &&
    HEX64.test(value.claimDigest || "") &&
    reviewabilityValid && captureValid && skinValid && artifactValid &&
    uniqueReasonCodes(value.reasonCodes) &&
    value.priorTargetKnowledgeAcknowledged === true &&
    isIso(value.submittedAt) &&
    HEX64.test(value.screeningDigest || "");
  return result(valid ? [] : [error("solo_screening_invalid", "$")]);
}

export function validateSoloIntentRevealReceipt(value) {
  const keys = ["schemaVersion","sessionDigest","reviewItemId","screeningDigest","slotId","conditionId","fixtureId","finalizedSpecDigest","compiledPromptDigest","intendedSkinCue","revealedAt","revealDigest"];
  if (!exactKeys(value, keys)) return result([error("solo_reveal_invalid", "$")]);
  const cueValid = exactKeys(value.intendedSkinCue, ["redness","blemishes","blemishCountBand"]) &&
    ["none","mild"].includes(value.intendedSkinCue.redness) &&
    ["none","mild"].includes(value.intendedSkinCue.blemishes) &&
    ["none","three_to_five"].includes(value.intendedSkinCue.blemishCountBand) &&
    ((value.intendedSkinCue.blemishes === "none" && value.intendedSkinCue.blemishCountBand === "none") || (value.intendedSkinCue.blemishes === "mild" && value.intendedSkinCue.blemishCountBand === "three_to_five"));
  const valid =
    value.schemaVersion === SOLO_INTENT_REVEAL_RECEIPT_SCHEMA_VERSION &&
    HEX64.test(value.sessionDigest || "") &&
    REVIEW_ITEM_ID.test(value.reviewItemId || "") &&
    HEX64.test(value.screeningDigest || "") &&
    SLOT_ID.test(value.slotId || "") &&
    ["A","B","C","D"].includes(value.conditionId) &&
    FIXTURE_TOKEN.test(value.fixtureId || "") &&
    HEX64.test(value.finalizedSpecDigest || "") &&
    HEX64.test(value.compiledPromptDigest || "") &&
    cueValid && isIso(value.revealedAt) && HEX64.test(value.revealDigest || "");
  return result(valid ? [] : [error("solo_reveal_invalid", "$")]);
}

export function validateSoloIntentAssessment(value) {
  const keys = ["schemaVersion","sessionDigest","reviewItemId","operatorId","screeningDigest","revealDigest","derivedTargetRelation","faceLabInputUsability","operationalDisposition","nextWaveRecommendation","sameSlotQualityRegenerationAllowed","reasonCodes","submittedAt","intentAssessmentDigest"];
  if (!exactKeys(value, keys)) return result([error("solo_intent_assessment_invalid", "$")]);
  const relationValid = exactKeys(value.derivedTargetRelation, ["redness","blemishPresence","blemishCount"]) && Object.values(value.derivedTargetRelation || {}).every((item) => SOLO_TARGET_RELATIONS.includes(item));
  const valid =
    value.schemaVersion === SOLO_INTENT_ASSESSMENT_SCHEMA_VERSION &&
    HEX64.test(value.sessionDigest || "") && REVIEW_ITEM_ID.test(value.reviewItemId || "") && TOKEN.test(value.operatorId || "") &&
    HEX64.test(value.screeningDigest || "") && HEX64.test(value.revealDigest || "") && relationValid &&
    SOLO_USABILITY.includes(value.faceLabInputUsability) &&
    SOLO_OPERATIONAL_DISPOSITIONS.includes(value.operationalDisposition) &&
    SOLO_DECISIONS.includes(value.nextWaveRecommendation) &&
    value.sameSlotQualityRegenerationAllowed === false &&
    uniqueReasonCodes(value.reasonCodes) && isIso(value.submittedAt) && HEX64.test(value.intentAssessmentDigest || "");
  return result(valid ? [] : [error("solo_intent_assessment_invalid", "$")]);
}

export function validateSoloWaveAssessmentRow(value) {
  const keys = ["schemaVersion","campaignRunId","waveOrdinal","slotId","conditionId","readiness","candidateId","canonicalSha256","observationDigest","screeningDigest","revealDigest","intentAssessmentDigest","authoritativeT5Status","soloAuthority","rowDigest"];
  if (!exactKeys(value, keys)) return result([error("solo_wave_row_invalid", "$")]);
  const assessable = value.soloAuthority === SOLO_ASSESSMENT_AUTHORITY;
  const refsComplete = value.screeningDigest !== null && value.revealDigest !== null && value.intentAssessmentDigest !== null;
  const technicalRefsEmpty = value.screeningDigest === null && value.revealDigest === null && value.intentAssessmentDigest === null;
  const valid =
    value.schemaVersion === SOLO_WAVE_ASSESSMENT_ROW_SCHEMA_VERSION && RUN_ID.test(value.campaignRunId || "") && [1,2,3].includes(value.waveOrdinal) && SLOT_ID.test(value.slotId || "") && ["A","B","C","D"].includes(value.conditionId) && SOLO_SLOT_READINESS.includes(value.readiness) &&
    (value.candidateId === null || CANDIDATE_ID.test(value.candidateId || "")) &&
    (value.canonicalSha256 === null || HEX64.test(value.canonicalSha256 || "")) &&
    (value.observationDigest === null || HEX64.test(value.observationDigest || "")) &&
    (value.screeningDigest === null || HEX64.test(value.screeningDigest || "")) &&
    (value.revealDigest === null || HEX64.test(value.revealDigest || "")) &&
    (value.intentAssessmentDigest === null || HEX64.test(value.intentAssessmentDigest || "")) &&
    SOLO_T5_STATUS.includes(value.authoritativeT5Status) && SOLO_ROW_AUTHORITIES.includes(value.soloAuthority) &&
    ((assessable && refsComplete) || (!assessable && technicalRefsEmpty)) &&
    HEX64.test(value.rowDigest || "");
  return result(valid ? [] : [error("solo_wave_row_invalid", "$")]);
}

export function validateSoloWaveAssessmentSet(value) {
  const planDerived = value?.schemaVersion === SOLO_PLAN_DERIVED_WAVE_ASSESSMENT_SET_SCHEMA_VERSION;
  const keys = ["schemaVersion","sessionDigest","campaignRunId","waveOrdinal","expectedSlotCount",...(planDerived ? ["waveShape","slotSetDigest"] : []),"rows","conditionCounts","exactDenominatorVerified","assessmentSetDigest"];
  if (!exactKeys(value, keys)) return result([error("solo_wave_set_invalid", "$")]);
  const shapeValid = !planDerived || validateSoloWaveShape(value.waveShape).ok && value.waveShape.waveOrdinal === value.waveOrdinal;
  const expected = planDerived ? value.waveShape?.expectedSlotCount : SOLO_WAVE_SLOT_COUNTS[value.waveOrdinal];
  const expectedConditions = planDerived ? value.waveShape?.conditionCounts : SOLO_WAVE_CONDITION_COUNTS[value.waveOrdinal];
  const rowsValid = Array.isArray(value.rows) && value.rows.length === expected && value.rows.every((row) => validateSoloWaveAssessmentRow(row).ok) && new Set(value.rows.map((row) => row.slotId)).size === value.rows.length && value.rows.every((row) => row.campaignRunId === value.campaignRunId && row.waveOrdinal === value.waveOrdinal);
  const countsValid = exactKeys(value.conditionCounts, ["A","B","C","D"]) && Object.entries(expectedConditions || {}).every(([key, count]) => value.conditionCounts[key] === count) && value.rows.every((row) => value.conditionCounts[row.conditionId] > 0);
  const recomputed = { A: 0, B: 0, C: 0, D: 0 };
  if (Array.isArray(value.rows)) for (const row of value.rows) if (Object.hasOwn(recomputed, row.conditionId)) recomputed[row.conditionId] += 1;
  const exactCounts = Object.entries(recomputed).every(([key, count]) => value.conditionCounts?.[key] === count);
  const valid = [SOLO_WAVE_ASSESSMENT_SET_SCHEMA_VERSION, SOLO_PLAN_DERIVED_WAVE_ASSESSMENT_SET_SCHEMA_VERSION].includes(value.schemaVersion) && shapeValid && (!planDerived || HEX64.test(value.slotSetDigest || "")) && HEX64.test(value.sessionDigest || "") && RUN_ID.test(value.campaignRunId || "") && [1,2,3].includes(value.waveOrdinal) && value.expectedSlotCount === expected && rowsValid && countsValid && exactCounts && value.exactDenominatorVerified === true && HEX64.test(value.assessmentSetDigest || "");
  return result(valid ? [] : [error("solo_wave_set_invalid", "$")]);
}

export function validateSoloWaveBrief(value) {
  const keys = ["schemaVersion","authority","authoritativeCampaignReport","singleOperator","sessionDigest","assessmentSetDigest","sourceProjectionDigest","summaries","operatorDecision","limitations","briefDigest"];
  if (!exactKeys(value, keys)) return result([error("solo_wave_brief_invalid", "$")]);
  const summaryKeys = ["readinessCounts","reviewabilityCounts","usabilityCounts","targetRelationCounts","artifactFlagCounts","technicalOutcomeCounts"];
  const summariesValid = exactKeys(value.summaries, summaryKeys) &&
    countMap(value.summaries.readinessCounts, SOLO_SLOT_READINESS) &&
    countMap(value.summaries.reviewabilityCounts, [...SOLO_REVIEWABILITY, "technical_or_unavailable"]) &&
    countMap(value.summaries.usabilityCounts, [...SOLO_USABILITY, "technical_or_unavailable"]) &&
    countMap(value.summaries.targetRelationCounts, SOLO_TARGET_RELATIONS) &&
    countMap(value.summaries.artifactFlagCounts, [...SOLO_ARTIFACT_STATES, "technical_or_unavailable"]) &&
    countMap(value.summaries.technicalOutcomeCounts, ["technical_no_asset","technical_import_failure","technical_observation_failure","cancelled","none"]);
  const decisionValid = exactKeys(value.operatorDecision, ["decision","reasonCodes","confirmedSingleOperatorLimitation","confirmedNoT5ConsensusClaim","confirmedNoG3G4G5Claim","confirmedNoSameSlotQualityRetry","decidedBy"]) &&
    SOLO_DECISIONS.includes(value.operatorDecision.decision) && uniqueReasonCodes(value.operatorDecision.reasonCodes) &&
    value.operatorDecision.confirmedSingleOperatorLimitation === true && value.operatorDecision.confirmedNoT5ConsensusClaim === true && value.operatorDecision.confirmedNoG3G4G5Claim === true && value.operatorDecision.confirmedNoSameSlotQualityRetry === true && TOKEN.test(value.operatorDecision.decidedBy || "");
  const limitationsValid = Array.isArray(value.limitations) && value.limitations.length === SOLO_LIMITATIONS.length && value.limitations.every((item, index) => item === SOLO_LIMITATIONS[index]);
  const valid = value.schemaVersion === SOLO_WAVE_BRIEF_SCHEMA_VERSION && value.authority === SOLO_REPORT_AUTHORITY && value.authoritativeCampaignReport === false && value.singleOperator === true && HEX64.test(value.sessionDigest || "") && HEX64.test(value.assessmentSetDigest || "") && HEX64.test(value.sourceProjectionDigest || "") && summariesValid && decisionValid && limitationsValid && HEX64.test(value.briefDigest || "");
  return result(valid ? [] : [error("solo_wave_brief_invalid", "$")]);
}

export function validateSoloCheckpointLink(value) {
  const keys = ["schemaVersion","campaignRunId","waveOrdinal","soloWaveBriefDigest","t7CheckpointApprovalDigest","soloDecision","t7Decision","decisionMatch","linkedAt","linkDigest"];
  if (!exactKeys(value, keys)) return result([error("solo_checkpoint_link_invalid", "$")]);
  const valid = value.schemaVersion === SOLO_CHECKPOINT_LINK_SCHEMA_VERSION && RUN_ID.test(value.campaignRunId || "") && [1,2].includes(value.waveOrdinal) && HEX64.test(value.soloWaveBriefDigest || "") && HEX64.test(value.t7CheckpointApprovalDigest || "") && SOLO_DECISIONS.includes(value.soloDecision) && SOLO_DECISIONS.includes(value.t7Decision) && value.soloDecision === value.t7Decision && value.decisionMatch === true && isIso(value.linkedAt) && HEX64.test(value.linkDigest || "");
  return result(valid ? [] : [error("solo_checkpoint_link_invalid", "$")]);
}

function validateIntendedCue(value) {
  return exactKeys(value, ["redness","blemishes","blemishCountBand"]) &&
    ["none","mild"].includes(value.redness) &&
    ["none","mild"].includes(value.blemishes) &&
    ["none","three_to_five"].includes(value.blemishCountBand);
}

function validateHumanObservation(value) {
  return exactKeys(value, ["redness","blemishes","blemishCountBand"]) &&
    SOLO_PRESENCE.includes(value.redness) && SOLO_PRESENCE.includes(value.blemishes) &&
    SOLO_BLEMISH_COUNT_BANDS.includes(value.blemishCountBand);
}

function validateT4Axis(value) {
  return exactKeys(value, ["signalScore","observationLevels","relationInput"]) &&
    Number.isInteger(value.signalScore) && value.signalScore >= 0 && value.signalScore <= 5 &&
    uniqueEnumArray(value.observationLevels, ["low","mild","moderate","high"]) &&
    SOLO_T4_RELATION_INPUTS.includes(value.relationInput);
}

function validateRelationSet(value, allowNotAvailable = false) {
  if (!exactKeys(value, SOLO_ALIGNMENT_AXES)) return false;
  return SOLO_ALIGNMENT_AXES.every((axis) =>
    SOLO_TARGET_RELATIONS.includes(value[axis]) || (allowNotAvailable && axis === "blemishCount" && value[axis] === "not_available")
  );
}

export function validateSoloCueAlignment(value) {
  const keys = [
    "schemaVersion","campaignRunId","waveOrdinal","sessionDigest","reviewItemId","slotId","conditionId","candidateId",
    "screeningDigest","revealDigest","observationDigest","intendedCue","humanObservation","t4Observation",
    "humanTargetRelation","t4TargetRelation","humanT4Relation","diagnosticFlags","derivedAt","alignmentDigest"
  ];
  if (!exactKeys(value, keys)) return result([error("solo_cue_alignment_invalid", "$")]);
  const t4Valid = exactKeys(value.t4Observation, ["skinStatus","redness","blemishPresence","blemishCount"]) &&
    ["available","insufficient_evidence","unavailable"].includes(value.t4Observation?.skinStatus) &&
    validateT4Axis(value.t4Observation?.redness) && validateT4Axis(value.t4Observation?.blemishPresence) &&
    exactKeys(value.t4Observation?.blemishCount, ["support","value"]) &&
    value.t4Observation.blemishCount.support === "not_available" && value.t4Observation.blemishCount.value === null;
  const comparisonValid = exactKeys(value.humanT4Relation, SOLO_ALIGNMENT_AXES) &&
    Object.values(value.humanT4Relation || {}).every((item) => SOLO_EVIDENCE_AGREEMENTS.includes(item));
  const flagsValid = Array.isArray(value.diagnosticFlags) && value.diagnosticFlags.every((item) =>
    exactKeys(item, ["code","axis"]) && SOLO_ALIGNMENT_DIAGNOSTIC_FLAGS.includes(item.code) && SOLO_ALIGNMENT_AXES.includes(item.axis)
  ) && new Set(value.diagnosticFlags.map((item) => `${item.code}:${item.axis}`)).size === value.diagnosticFlags.length;
  const valid = value.schemaVersion === SOLO_CUE_ALIGNMENT_SCHEMA_VERSION && RUN_ID.test(value.campaignRunId || "") &&
    [1,2,3].includes(value.waveOrdinal) && HEX64.test(value.sessionDigest || "") && REVIEW_ITEM_ID.test(value.reviewItemId || "") &&
    SLOT_ID.test(value.slotId || "") && ["A","B","C","D"].includes(value.conditionId) && CANDIDATE_ID.test(value.candidateId || "") &&
    HEX64.test(value.screeningDigest || "") && HEX64.test(value.revealDigest || "") && HEX64.test(value.observationDigest || "") &&
    validateIntendedCue(value.intendedCue) && validateHumanObservation(value.humanObservation) && t4Valid &&
    validateRelationSet(value.humanTargetRelation) && validateRelationSet(value.t4TargetRelation, true) && comparisonValid && flagsValid &&
    isIso(value.derivedAt) && HEX64.test(value.alignmentDigest || "");
  return result(valid ? [] : [error("solo_cue_alignment_invalid", "$")]);
}

function validateTargetSummary(value, { t4 = false } = {}) {
  const keys = t4
    ? ["total","supported","evaluable","unverifiable","notAvailable","exactMatch","underTarget","overTarget","contradictory"]
    : ["total","evaluable","unverifiable","exactMatch","underTarget","overTarget","contradictory"];
  if (!exactKeys(value, keys) || !Object.values(value).every((item) => Number.isInteger(item) && item >= 0)) return false;
  const buckets = value.exactMatch + value.underTarget + value.overTarget + value.contradictory;
  if (buckets !== value.evaluable) return false;
  return t4
    ? value.total === value.supported + value.notAvailable && value.supported === value.evaluable + value.unverifiable
    : value.total === value.evaluable + value.unverifiable;
}

function validateAgreementSummary(value) {
  return exactKeys(value, ["total","comparable","agree","disagree","unverifiable","notComparable"]) &&
    Object.values(value).every((item) => Number.isInteger(item) && item >= 0) &&
    value.comparable === value.agree + value.disagree &&
    value.total === value.comparable + value.unverifiable + value.notComparable;
}

export function validateSoloWaveAlignmentReport(value) {
  const keys = [
    "schemaVersion","campaignRunId","waveOrdinal","sessionDigest","campaignPlanDigest","sourceProjectionDigest",
    "waveShape","slotSetDigest","alignmentRows","sample","humanTargetAlignment","t4TargetAlignment","humanT4Agreement",
    "diagnostics","limitations","derivedAt","reportDigest"
  ];
  if (!exactKeys(value, keys)) return result([error("solo_wave_alignment_report_invalid", "$")]);
  const rowsValid = Array.isArray(value.alignmentRows) && value.alignmentRows.length === value.sample?.assessedSlots &&
    value.alignmentRows.every((item) => exactKeys(item, ["reviewItemId","slotId","alignmentDigest"]) && REVIEW_ITEM_ID.test(item.reviewItemId || "") && SLOT_ID.test(item.slotId || "") && HEX64.test(item.alignmentDigest || "")) &&
    new Set(value.alignmentRows.map((item) => item.reviewItemId)).size === value.alignmentRows.length &&
    new Set(value.alignmentRows.map((item) => item.slotId)).size === value.alignmentRows.length &&
    new Set(value.alignmentRows.map((item) => item.alignmentDigest)).size === value.alignmentRows.length;
  const sampleValid = exactKeys(value.sample, ["expectedSlots","assessedSlots"]) &&
    Number.isInteger(value.sample.expectedSlots) && value.sample.expectedSlots > 0 && value.sample.assessedSlots === value.sample.expectedSlots;
  const humanValid = exactKeys(value.humanTargetAlignment, SOLO_ALIGNMENT_AXES) && Object.values(value.humanTargetAlignment).every((item) => validateTargetSummary(item));
  const t4Valid = exactKeys(value.t4TargetAlignment, SOLO_ALIGNMENT_AXES) && Object.values(value.t4TargetAlignment).every((item) => validateTargetSummary(item, { t4: true }));
  const agreementValid = exactKeys(value.humanT4Agreement, SOLO_ALIGNMENT_AXES) && Object.values(value.humanT4Agreement).every(validateAgreementSummary);
  const diagnosticKeys = ["generationSideSignalWeakPossible","observationSideMissPossible","ambiguousVisualCue"];
  const diagnosticsValid = exactKeys(value.diagnostics, diagnosticKeys) && Object.values(value.diagnostics).every((item) =>
    exactKeys(item, ["count","rowDigests"]) && Number.isInteger(item.count) && item.count >= 0 && Array.isArray(item.rowDigests) &&
    item.rowDigests.length === item.count && item.rowDigests.every((digest) => HEX64.test(digest || "")) && new Set(item.rowDigests).size === item.rowDigests.length
  );
  const limitationsValid = Array.isArray(value.limitations) && value.limitations.every((item) =>
    exactKeys(item, ["code","affectedAxes"]) && SOLO_ALIGNMENT_LIMITATION_CODES.includes(item.code) && item.affectedAxes.length > 0 && uniqueEnumArray(item.affectedAxes, SOLO_ALIGNMENT_AXES)
  ) && new Set(value.limitations.map((item) => item.code)).size === value.limitations.length &&
    SOLO_ALIGNMENT_REQUIRED_LIMITATIONS.every((code) => value.limitations.some((item) => item.code === code));
  const valid = value.schemaVersion === SOLO_WAVE_ALIGNMENT_REPORT_SCHEMA_VERSION && RUN_ID.test(value.campaignRunId || "") &&
    [1,2,3].includes(value.waveOrdinal) && HEX64.test(value.sessionDigest || "") && HEX64.test(value.campaignPlanDigest || "") &&
    HEX64.test(value.sourceProjectionDigest || "") && validateSoloWaveShape(value.waveShape).ok && value.waveShape.waveOrdinal === value.waveOrdinal && value.waveShape.campaignPlanDigest === value.campaignPlanDigest &&
    value.waveShape.expectedSlotCount === value.sample?.expectedSlots && HEX64.test(value.slotSetDigest || "") && rowsValid && sampleValid &&
    humanValid && t4Valid && agreementValid && diagnosticsValid && limitationsValid && isIso(value.derivedAt) && HEX64.test(value.reportDigest || "");
  return result(valid ? [] : [error("solo_wave_alignment_report_invalid", "$")]);
}
