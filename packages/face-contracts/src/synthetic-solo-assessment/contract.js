import {
  SOLO_ARTIFACT_STATES,
  SOLO_ASSESSMENT_AUTHORITY,
  SOLO_ASSESSMENT_POLICY_SCHEMA_VERSION,
  SOLO_BLEMISH_COUNT_BANDS,
  SOLO_BLEMISH_REGIONS,
  SOLO_CHECKPOINT_LINK_SCHEMA_VERSION,
  SOLO_DECISIONS,
  SOLO_EXCLUDED_FIELDS,
  SOLO_INTENT_ASSESSMENT_SCHEMA_VERSION,
  SOLO_INTENT_REVEAL_RECEIPT_SCHEMA_VERSION,
  SOLO_LIMITATIONS,
  SOLO_OPERATIONAL_DISPOSITIONS,
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
  SOLO_TARGET_WITHHELD_SCREENING_SCHEMA_VERSION,
  SOLO_TRI_STATE,
  SOLO_USABILITY,
  SOLO_WAVE_ASSESSMENT_ROW_SCHEMA_VERSION,
  SOLO_WAVE_ASSESSMENT_SET_SCHEMA_VERSION,
  SOLO_WAVE_BRIEF_SCHEMA_VERSION,
  SOLO_WAVE_CONDITION_COUNTS,
  SOLO_WAVE_SESSION_SCHEMA_VERSION,
  SOLO_WAVE_SLOT_COUNTS,
  TARGET_WITHHELD_REVIEW_ITEM_SCHEMA_VERSION
} from "./constants.js";

const HEX64 = /^[a-f0-9]{64}$/;
const TOKEN = /^[a-z0-9][a-z0-9._-]{0,127}$/;
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

export function validateSoloWaveSession(value) {
  const keys = ["schemaVersion","sessionId","campaignRunId","campaignPlanDigest","sourceProjectionDigest","waveOrdinal","expectedSlotCount","operatorId","actorCount","policyDigest","privateReviewMapDigest","createdAt","sessionDigest"];
  if (!exactKeys(value, keys)) return result([error("solo_session_invalid", "$")]);
  const valid =
    value.schemaVersion === SOLO_WAVE_SESSION_SCHEMA_VERSION &&
    SESSION_ID.test(value.sessionId || "") &&
    RUN_ID.test(value.campaignRunId || "") &&
    HEX64.test(value.campaignPlanDigest || "") &&
    HEX64.test(value.sourceProjectionDigest || "") &&
    [1,2,3].includes(value.waveOrdinal) &&
    value.expectedSlotCount === SOLO_WAVE_SLOT_COUNTS[value.waveOrdinal] &&
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
    TOKEN.test(value.fixtureId || "") &&
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
  const keys = ["schemaVersion","sessionDigest","campaignRunId","waveOrdinal","expectedSlotCount","rows","conditionCounts","exactDenominatorVerified","assessmentSetDigest"];
  if (!exactKeys(value, keys)) return result([error("solo_wave_set_invalid", "$")]);
  const expected = SOLO_WAVE_SLOT_COUNTS[value.waveOrdinal];
  const expectedConditions = SOLO_WAVE_CONDITION_COUNTS[value.waveOrdinal];
  const rowsValid = Array.isArray(value.rows) && value.rows.length === expected && value.rows.every((row) => validateSoloWaveAssessmentRow(row).ok) && new Set(value.rows.map((row) => row.slotId)).size === value.rows.length && value.rows.every((row) => row.campaignRunId === value.campaignRunId && row.waveOrdinal === value.waveOrdinal);
  const countsValid = exactKeys(value.conditionCounts, ["A","B","C","D"]) && Object.entries(expectedConditions || {}).every(([key, count]) => value.conditionCounts[key] === count) && value.rows.every((row) => value.conditionCounts[row.conditionId] > 0);
  const recomputed = { A: 0, B: 0, C: 0, D: 0 };
  if (Array.isArray(value.rows)) for (const row of value.rows) if (Object.hasOwn(recomputed, row.conditionId)) recomputed[row.conditionId] += 1;
  const exactCounts = Object.entries(recomputed).every(([key, count]) => value.conditionCounts?.[key] === count);
  const valid = value.schemaVersion === SOLO_WAVE_ASSESSMENT_SET_SCHEMA_VERSION && HEX64.test(value.sessionDigest || "") && RUN_ID.test(value.campaignRunId || "") && [1,2,3].includes(value.waveOrdinal) && value.expectedSlotCount === expected && rowsValid && countsValid && exactCounts && value.exactDenominatorVerified === true && HEX64.test(value.assessmentSetDigest || "");
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
