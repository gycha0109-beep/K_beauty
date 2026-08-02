import { PILOT_TERMINAL_OUTCOMES } from "../synthetic-campaign/constants.js";
import {
  CAMPAIGN_EVIDENCE_SNAPSHOT_SCHEMA_VERSION,
  CAMPAIGN_EXPORT_MANIFEST_SCHEMA_VERSION,
  CAMPAIGN_METRIC_SET_SCHEMA_VERSION,
  CAMPAIGN_REPORT_POLICY,
  CAMPAIGN_REPORT_SCHEMA_VERSION,
  CAMPAIGN_REVIEW_PACKAGE_SCHEMA_VERSION,
  CAMPAIGN_SLOT_EVIDENCE_ROW_SCHEMA_VERSION,
  PROVIDER_COMPARISON_KEY_SCHEMA_VERSION,
  REPORT_REVIEW_SUBMISSION_SCHEMA_VERSION,
  REPORT_REVISION_LINK_SCHEMA_VERSION,
  T8_AUDIENCE,
  T8_CLAIM_TYPES,
  T8_EXPORT_FILE_ROLES,
  T8_FAILURE_GROUPS,
  T8_STAGE_METRICS
} from "./constants.js";

const HEX64 = /^[a-f0-9]{64}$/;
const RUN_ID = /^crun_[a-f0-9]{24}$/;
const SLOT_ID = /^slot_[a-f0-9]{24}$/;
const CANDIDATE_ID = /^cand_[a-f0-9]{24}$/;
const TOKEN = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const SAFE_RELATIVE_PATH = /^(?![A-Za-z]:)(?!\\\\)(?!\/)(?!.*(?:^|[\\/])\.\.(?:[\\/]|$))(?!.*\0).+$/;

function isObject(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function exactKeys(value, expected) {
  if (!isObject(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}
function isIso(value) { return typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value; }
function uniqueStrings(value, pattern = null) { return Array.isArray(value) && value.every((item) => typeof item === "string" && (!pattern || pattern.test(item))) && new Set(value).size === value.length; }
function error(code, path, detail = null) { return Object.freeze({ code, path, detail }); }
function result(errors) { return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors) }); }
function validateRate(value, denominator = null) {
  return exactKeys(value, ["numerator", "denominator", "fractionLabel", "percent"]) &&
    Number.isInteger(value.numerator) && value.numerator >= 0 &&
    Number.isInteger(value.denominator) && value.denominator > 0 &&
    (denominator === null || value.denominator === denominator) &&
    value.numerator <= value.denominator && value.fractionLabel === `${value.numerator}/${value.denominator}` &&
    Number.isFinite(value.percent) && Math.round(value.percent * 10) === value.percent * 10;
}

export function validateCampaignSlotEvidenceRow(value) {
  const errors = [];
  const keys = ["schemaVersion","campaignRunId","campaignPlanDigest","providerProfileId","comparisonGroupId","slotId","conditionId","conditionOrdinal","waveOrdinal","generation","candidate","observation","judgment","promotion","warnings","sourceRefDigests","rowDigest"];
  if (!exactKeys(value, keys)) return result([error("report_slot_row_invalid", "$")]);
  if (value.schemaVersion !== CAMPAIGN_SLOT_EVIDENCE_ROW_SCHEMA_VERSION || !RUN_ID.test(value.campaignRunId || "") || !HEX64.test(value.campaignPlanDigest || "") || !TOKEN.test(value.providerProfileId || "") || !(value.comparisonGroupId === null || TOKEN.test(value.comparisonGroupId || "")) || !SLOT_ID.test(value.slotId || "") || !["A","B","C","D"].includes(value.conditionId) || ![1,2,3,4,5].includes(value.conditionOrdinal) || ![1,2,3].includes(value.waveOrdinal) || !HEX64.test(value.rowDigest || "")) errors.push(error("report_slot_row_invalid", "$"));
  if (!exactKeys(value.generation, ["attempts","retries","assetReady"]) || ![0,1,2].includes(value.generation?.attempts) || ![0,1].includes(value.generation?.retries) || typeof value.generation?.assetReady !== "boolean") errors.push(error("report_slot_row_invalid", "generation"));
  if (!exactKeys(value.candidate, ["candidateId","candidateDigest","canonicalSha256","visibleExternalMarkHint"]) || !(value.candidate?.candidateId === null || CANDIDATE_ID.test(value.candidate.candidateId || "")) || !(value.candidate?.candidateDigest === null || HEX64.test(value.candidate.candidateDigest || "")) || !(value.candidate?.canonicalSha256 === null || HEX64.test(value.candidate.canonicalSha256 || "")) || ![null,"present","absent","unknown"].includes(value.candidate?.visibleExternalMarkHint)) errors.push(error("report_slot_row_invalid", "candidate"));
  if (!exactKeys(value.observation, ["runCount","recoveryRunCount","authoritative","validIneligible","observationObjectDigest"]) || !Number.isInteger(value.observation?.runCount) || value.observation.runCount < 0 || !Number.isInteger(value.observation?.recoveryRunCount) || value.observation.recoveryRunCount < 0 || typeof value.observation?.authoritative !== "boolean" || typeof value.observation?.validIneligible !== "boolean" || !(value.observation?.observationObjectDigest === null || HEX64.test(value.observation.observationObjectDigest || "")) || (value.observation.validIneligible && !value.observation.authoritative)) errors.push(error("report_slot_row_invalid", "observation"));
  if (!exactKeys(value.judgment, ["consensusSealed","consensusDigest","alignmentDigest"]) || typeof value.judgment?.consensusSealed !== "boolean" || !(value.judgment?.consensusDigest === null || HEX64.test(value.judgment.consensusDigest || "")) || !(value.judgment?.alignmentDigest === null || HEX64.test(value.judgment.alignmentDigest || "")) || value.judgment.consensusSealed !== (value.judgment.consensusDigest !== null)) errors.push(error("report_slot_row_invalid", "judgment"));
  if (!exactKeys(value.promotion, ["decisionDigest","terminalOutcome","g4GradeRecordDigest","g4StatusAsOfCloseout","splitCouplingKeysDigest"]) || !(value.promotion?.decisionDigest === null || HEX64.test(value.promotion.decisionDigest || "")) || !PILOT_TERMINAL_OUTCOMES.includes(value.promotion?.terminalOutcome) || !(value.promotion?.g4GradeRecordDigest === null || HEX64.test(value.promotion.g4GradeRecordDigest || "")) || ![null,"active"].includes(value.promotion?.g4StatusAsOfCloseout) || !(value.promotion?.splitCouplingKeysDigest === null || HEX64.test(value.promotion.splitCouplingKeysDigest || ""))) errors.push(error("report_slot_row_invalid", "promotion"));
  if ((value.promotion.terminalOutcome === "promoted_g4") !== (value.promotion.g4GradeRecordDigest !== null && value.promotion.g4StatusAsOfCloseout === "active" && value.promotion.splitCouplingKeysDigest !== null)) errors.push(error("report_slot_row_invalid", "promotion.g4"));
  if (!uniqueStrings(value.warnings) || !uniqueStrings(value.sourceRefDigests, HEX64)) errors.push(error("report_slot_row_invalid", "references"));
  return result(errors);
}

export function validateCampaignEvidenceSnapshot(value) {
  const errors = [];
  const keys = ["schemaVersion","reportScope","sourceRuns","sourceIntegrity","artifactIndexDigest","slotEvidenceDigest","comparisonKeyDigest","capturedAt","sourceSnapshotDigest"];
  if (!exactKeys(value, keys)) return result([error("report_source_snapshot_invalid", "$")]);
  if (value.schemaVersion !== CAMPAIGN_EVIDENCE_SNAPSHOT_SCHEMA_VERSION || !["single_run","provider_comparison"].includes(value.reportScope) || !HEX64.test(value.artifactIndexDigest || "") || !HEX64.test(value.slotEvidenceDigest || "") || !(value.comparisonKeyDigest === null || HEX64.test(value.comparisonKeyDigest || "")) || !isIso(value.capturedAt) || !HEX64.test(value.sourceSnapshotDigest || "")) errors.push(error("report_source_snapshot_invalid", "$"));
  if (!Array.isArray(value.sourceRuns) || ![1,2].includes(value.sourceRuns.length) || value.sourceRuns.some((run) => !exactKeys(run, ["campaignRunId","campaignPlanDigest","finalProjectionDigest","closeoutDigest","comparisonGroupId","providerProfileId","closedAt"]) || !RUN_ID.test(run.campaignRunId || "") || !HEX64.test(run.campaignPlanDigest || "") || !HEX64.test(run.finalProjectionDigest || "") || !HEX64.test(run.closeoutDigest || "") || !(run.comparisonGroupId === null || TOKEN.test(run.comparisonGroupId || "")) || !TOKEN.test(run.providerProfileId || "") || !isIso(run.closedAt))) errors.push(error("report_source_snapshot_invalid", "sourceRuns"));
  if (!exactKeys(value.sourceIntegrity, ["t7PlanRunSlotLedgerVerified","t7CloseoutVerified","referencedT3ArtifactsVerified","referencedT4ArtifactsVerified","referencedT5ArtifactsVerified","referencedT6ArtifactsVerified","canonicalAssetsVerified"]) || Object.values(value.sourceIntegrity || {}).some((item) => item !== true)) errors.push(error("report_source_snapshot_invalid", "sourceIntegrity"));
  if ((value.reportScope === "single_run") !== (value.sourceRuns.length === 1) || (value.reportScope === "provider_comparison") !== (value.sourceRuns.length === 2) || (value.reportScope === "single_run" && value.comparisonKeyDigest !== null) || (value.reportScope === "provider_comparison" && value.comparisonKeyDigest === null)) errors.push(error("report_source_snapshot_invalid", "reportScope"));
  return result(errors);
}

function validateConditionSummary(item) {
  return exactKeys(item, ["campaignRunId","providerProfileId","conditionId","denominator","registeredCandidates","authoritativeObservations","validIneligible","promotedG4AsOfCloseout","generationRetries","observationRecoveryRuns","terminalOutcomes"]) &&
    RUN_ID.test(item.campaignRunId || "") && TOKEN.test(item.providerProfileId || "") && ["A","B","C","D"].includes(item.conditionId) && item.denominator === 5 &&
    validateRate(item.registeredCandidates, 5) && validateRate(item.authoritativeObservations, 5) && validateRate(item.validIneligible, 5) && validateRate(item.promotedG4AsOfCloseout, 5) &&
    Number.isInteger(item.generationRetries) && item.generationRetries >= 0 && Number.isInteger(item.observationRecoveryRuns) && item.observationRecoveryRuns >= 0 &&
    exactKeys(item.terminalOutcomes, PILOT_TERMINAL_OUTCOMES) && Object.values(item.terminalOutcomes).every((count) => Number.isInteger(count) && count >= 0) && Object.values(item.terminalOutcomes).reduce((sum, count) => sum + count, 0) === 5;
}

export function validateCampaignMetricSet(value) {
  const errors = [];
  const keys = ["schemaVersion","sourceSnapshotDigest","runCount","policy","stageMetrics","terminalOutcomes","conditionSummaries","failureGroups","comparison","metricSetDigest"];
  if (!exactKeys(value, keys)) return result([error("report_metric_set_invalid", "$")]);
  if (value.schemaVersion !== CAMPAIGN_METRIC_SET_SCHEMA_VERSION || !HEX64.test(value.sourceSnapshotDigest || "") || ![1,2].includes(value.runCount) || !HEX64.test(value.metricSetDigest || "")) errors.push(error("report_metric_set_invalid", "$"));
  if (!exactKeys(value.policy, ["id","version","digest"]) || !TOKEN.test(value.policy?.id || "") || !TOKEN.test(value.policy?.version || "") || !HEX64.test(value.policy?.digest || "")) errors.push(error("report_metric_set_invalid", "policy"));
  const denominator = 20 * value.runCount;
  if (!exactKeys(value.stageMetrics, T8_STAGE_METRICS) || Object.values(value.stageMetrics || {}).some((rate) => !validateRate(rate, denominator))) errors.push(error("report_metric_set_invalid", "stageMetrics"));
  if (!exactKeys(value.terminalOutcomes, PILOT_TERMINAL_OUTCOMES) || Object.values(value.terminalOutcomes || {}).some((count) => !Number.isInteger(count) || count < 0) || Object.values(value.terminalOutcomes || {}).reduce((sum, count) => sum + count, 0) !== denominator) errors.push(error("report_metric_set_invalid", "terminalOutcomes"));
  if (!Array.isArray(value.conditionSummaries) || value.conditionSummaries.length !== 4 * value.runCount || !value.conditionSummaries.every(validateConditionSummary)) errors.push(error("report_metric_set_invalid", "conditionSummaries"));
  if (!exactKeys(value.failureGroups, T8_FAILURE_GROUPS) || Object.values(value.failureGroups || {}).some((count) => !Number.isInteger(count) || count < 0)) errors.push(error("report_metric_set_invalid", "failureGroups"));
  if ((value.runCount === 1) !== (value.comparison === null) || (value.runCount === 2 && !isObject(value.comparison))) errors.push(error("report_metric_set_invalid", "comparison"));
  return result(errors);
}

export function validateCampaignReviewPackage(value) {
  const errors = [];
  const keys = ["schemaVersion","sourceSnapshotDigest","artifactIndexDigest","slotTableDigest","blindContactSheetDigest","annotatedContactSheetDigest","thumbnailPolicyDigest","thumbnailIndexDigest","unresolvedHoldSlotIds","warningSlotIds","reviewChecklist","packageDigest"];
  if (!exactKeys(value, keys)) return result([error("report_review_package_invalid", "$")]);
  if (value.schemaVersion !== CAMPAIGN_REVIEW_PACKAGE_SCHEMA_VERSION || !["sourceSnapshotDigest","artifactIndexDigest","slotTableDigest","blindContactSheetDigest","annotatedContactSheetDigest","thumbnailPolicyDigest","thumbnailIndexDigest","packageDigest"].every((key) => HEX64.test(value[key] || "")) || !uniqueStrings(value.unresolvedHoldSlotIds, SLOT_ID) || !uniqueStrings(value.warningSlotIds, SLOT_ID)) errors.push(error("report_review_package_invalid", "$"));
  if (!exactKeys(value.reviewChecklist, ["allSlotsPresent","denominatorsExact","sourceRefsVerified","externalMarksNotHidden","unresolvedHoldsVisible","noSplitFields"]) || Object.values(value.reviewChecklist || {}).some((item) => item !== true)) errors.push(error("report_review_package_invalid", "reviewChecklist"));
  return result(errors);
}

export function validateInterpretationClaim(value) {
  const errors = [];
  if (!exactKeys(value, ["claimId","claimType","subject","statement","sourceMetricIds","sourceSlotIds","comparisonDirection","authority","claimDigest"])) return result([error("report_claim_invalid", "$")]);
  if (!TOKEN.test(value.claimId || "") || !T8_CLAIM_TYPES.includes(value.claimType) || typeof value.subject !== "string" || value.subject.length < 1 || value.subject.length > 256 || typeof value.statement !== "string" || value.statement.length < 1 || value.statement.length > 1000 || !uniqueStrings(value.sourceMetricIds) || !uniqueStrings(value.sourceSlotIds, SLOT_ID) || value.sourceMetricIds.length + value.sourceSlotIds.length < 1 || !["none","provider_a_minus_b","provider_b_minus_a"].includes(value.comparisonDirection) || value.authority !== "descriptive_only" || !HEX64.test(value.claimDigest || "")) errors.push(error("report_claim_invalid", "$"));
  return result(errors);
}

export function validateReportReviewSubmission(value) {
  const errors = [];
  if (!exactKeys(value, ["schemaVersion","sourceSnapshotDigest","metricSetDigest","reviewPackageDigest","reviewerId","checks","reviewedAt","submissionDigest"])) return result([error("report_review_submission_invalid", "$")]);
  if (value.schemaVersion !== REPORT_REVIEW_SUBMISSION_SCHEMA_VERSION || !["sourceSnapshotDigest","metricSetDigest","reviewPackageDigest","submissionDigest"].every((key) => HEX64.test(value[key] || "")) || !TOKEN.test(value.reviewerId || "") || !isIso(value.reviewedAt)) errors.push(error("report_review_submission_invalid", "$"));
  if (!exactKeys(value.checks, ["sourceIntegrityReviewed","denominatorReviewed","claimsReviewed","holdsVisible","contactSheetsReviewed"]) || Object.values(value.checks || {}).some((item) => item !== true)) errors.push(error("report_review_submission_invalid", "checks"));
  return result(errors);
}

export function validateCampaignReport(value) {
  const errors = [];
  const keys = ["schemaVersion","sourceSnapshotDigest","reportMode","title","scope","metricSetDigest","reviewPackageDigest","reportReviewDigest","interpretationClaims","limitations","g4TimeBoundary","predecessorReportDigest","reportPolicy","reportDigest"];
  if (!exactKeys(value, keys)) return result([error("campaign_report_invalid", "$")]);
  if (value.schemaVersion !== CAMPAIGN_REPORT_SCHEMA_VERSION || !HEX64.test(value.sourceSnapshotDigest || "") || !["single_run","provider_comparison"].includes(value.reportMode) || typeof value.title !== "string" || value.title.length < 1 || value.title.length > 256 || !HEX64.test(value.metricSetDigest || "") || !HEX64.test(value.reviewPackageDigest || "") || !HEX64.test(value.reportReviewDigest || "") || !(value.predecessorReportDigest === null || HEX64.test(value.predecessorReportDigest || "")) || !HEX64.test(value.reportDigest || "")) errors.push(error("campaign_report_invalid", "$"));
  if (!exactKeys(value.scope, ["campaignRunIds","comparisonGroupId","primaryDenominatorPerRun","closedAtByRun"]) || !uniqueStrings(value.scope?.campaignRunIds, RUN_ID) || ![1,2].includes(value.scope.campaignRunIds.length) || !(value.scope.comparisonGroupId === null || TOKEN.test(value.scope.comparisonGroupId || "")) || value.scope.primaryDenominatorPerRun !== 20 || !exactKeys(value.scope.closedAtByRun, value.scope.campaignRunIds) || Object.values(value.scope.closedAtByRun || {}).some((item) => !isIso(item))) errors.push(error("campaign_report_invalid", "scope"));
  if (!Array.isArray(value.interpretationClaims) || !value.interpretationClaims.every((claim) => validateInterpretationClaim(claim).ok) || !uniqueStrings(value.limitations)) errors.push(error("campaign_report_invalid", "content"));
  if (!exactKeys(value.g4TimeBoundary, ["mode","currentStatusAppendixIncluded","statusVerifiedAt"]) || value.g4TimeBoundary.mode !== "as_of_closeout" || typeof value.g4TimeBoundary.currentStatusAppendixIncluded !== "boolean" || !(value.g4TimeBoundary.statusVerifiedAt === null || isIso(value.g4TimeBoundary.statusVerifiedAt)) || (value.g4TimeBoundary.currentStatusAppendixIncluded !== (value.g4TimeBoundary.statusVerifiedAt !== null))) errors.push(error("campaign_report_invalid", "g4TimeBoundary"));
  if (!exactKeys(value.reportPolicy, ["id","version","digest"]) || value.reportPolicy.id !== CAMPAIGN_REPORT_POLICY.id || value.reportPolicy.version !== CAMPAIGN_REPORT_POLICY.version || !HEX64.test(value.reportPolicy.digest || "")) errors.push(error("campaign_report_invalid", "reportPolicy"));
  return result(errors);
}

export function validateReportRevisionLink(value) {
  const errors = [];
  if (!exactKeys(value, ["schemaVersion","sourceSnapshotDigest","predecessorReportDigest","successorReportDigest","reasonCode","linkedAt","linkDigest"])) return result([error("report_revision_link_invalid", "$")]);
  if (value.schemaVersion !== REPORT_REVISION_LINK_SCHEMA_VERSION || !["sourceSnapshotDigest","predecessorReportDigest","successorReportDigest","linkDigest"].every((key) => HEX64.test(value[key] || "")) || !["renderer_bug","csv_ordering_bug","typo","limitation_clarification","descriptive_statement_correction"].includes(value.reasonCode) || !isIso(value.linkedAt) || value.predecessorReportDigest === value.successorReportDigest) errors.push(error("report_revision_link_invalid", "$"));
  return result(errors);
}

export function validateProviderComparisonKey(value) {
  const errors = [];
  if (!exactKeys(value, ["schemaVersion","comparisonGroupId","objectiveDigest","matrixDigest","nonProviderSourceFreezeDigest","campaignPolicyDigest","comparisonKeyDigest"])) return result([error("provider_comparison_invalid", "$")]);
  if (value.schemaVersion !== PROVIDER_COMPARISON_KEY_SCHEMA_VERSION || !TOKEN.test(value.comparisonGroupId || "") || !["objectiveDigest","matrixDigest","nonProviderSourceFreezeDigest","campaignPolicyDigest","comparisonKeyDigest"].every((key) => HEX64.test(value[key] || ""))) errors.push(error("provider_comparison_invalid", "$"));
  return result(errors);
}

export function validateCampaignExportManifest(value) {
  const errors = [];
  if (!exactKeys(value, ["schemaVersion","sourceSnapshotDigest","reportDigest","audience","files","generatedBy","generatedAt","exportDigest"])) return result([error("campaign_export_manifest_invalid", "$")]);
  if (value.schemaVersion !== CAMPAIGN_EXPORT_MANIFEST_SCHEMA_VERSION || !HEX64.test(value.sourceSnapshotDigest || "") || !HEX64.test(value.reportDigest || "") || value.audience !== T8_AUDIENCE || !isIso(value.generatedAt) || !HEX64.test(value.exportDigest || "")) errors.push(error("campaign_export_manifest_invalid", "$"));
  if (!Array.isArray(value.files) || value.files.length === 0 || value.files.some((file) => !exactKeys(file, ["relativePath","mediaType","sha256","byteLength","role"]) || typeof file.relativePath !== "string" || !SAFE_RELATIVE_PATH.test(file.relativePath) || typeof file.mediaType !== "string" || !HEX64.test(file.sha256 || "") || !Number.isInteger(file.byteLength) || file.byteLength < 0 || !T8_EXPORT_FILE_ROLES.includes(file.role)) || new Set(value.files.map((file) => file.relativePath)).size !== value.files.length) errors.push(error("campaign_export_manifest_invalid", "files"));
  if (!exactKeys(value.generatedBy, ["exporterId","exporterVersion","rendererVersion"]) || !TOKEN.test(value.generatedBy?.exporterId || "") || !TOKEN.test(value.generatedBy?.exporterVersion || "") || !TOKEN.test(value.generatedBy?.rendererVersion || "")) errors.push(error("campaign_export_manifest_invalid", "generatedBy"));
  return result(errors);
}

export const reportingContractInternals = Object.freeze({ exactKeys, isIso, validateRate });
