import {
  CAMPAIGN_EVIDENCE_SNAPSHOT_SCHEMA_VERSION,
  CAMPAIGN_METRIC_SET_SCHEMA_VERSION,
  CAMPAIGN_SLOT_EVIDENCE_ROW_SCHEMA_VERSION,
  PILOT_TERMINAL_OUTCOMES,
  T8_FAILURE_GROUPS,
  T8_STAGE_METRICS,
  validateCampaignEvidenceSnapshot,
  validateCampaignMetricSet,
  validateCampaignSlotEvidenceRow
} from "@bejewely/face-contracts";
import { deepFreeze, sha256Hex, stableStringify } from "../shared/canonical-json.js";
import { METRIC_POLICY } from "./policy.js";

function failure(code, path, detail = null) {
  return Object.freeze({ ok: false, errors: Object.freeze([{ code, path, detail }]) });
}

function semanticDigest(value, omitted = []) {
  const copy = { ...value };
  for (const key of omitted) delete copy[key];
  return sha256Hex(stableStringify(copy));
}

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

function exactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function warningsFor(item) {
  const warnings = [];
  const slot = item.projection;
  const mark = item.evidence.markHint;
  if (mark === "present") warnings.push("visible_external_mark_present");
  if (mark === "unknown") warnings.push("visible_external_mark_unknown");
  if (slot.generationRetries > 0) warnings.push("generation_technical_retry_used");
  if (slot.observationRecoveryRuns > 0) warnings.push("observation_recovery_used");
  if (slot.terminalOutcome === "observation_valid_ineligible") warnings.push("observation_valid_ineligible");
  if (slot.terminalOutcome === "promotion_held") warnings.push("promotion_hold_unresolved");
  if (!slot.refs.candidateId) warnings.push("no_registered_candidate");
  return warnings.sort();
}

export function deriveCampaignSlotRows(source) {
  if (!source || !Array.isArray(source.slotEvidence) || source.slotEvidence.length !== 20) return failure("report_slot_table_invalid", "source.slotEvidence");
  const rows = [];
  for (const item of source.slotEvidence) {
    const slot = item.slot;
    const projected = item.projection;
    const evidence = item.evidence;
    const candidateId = projected.refs.candidateId;
    const slotArtifactDigests = source.artifactIndex
      .filter((entry) => entry.slotId === slot.slotId)
      .map((entry) => entry.artifactDigest);
    const terminalOutcome = projected.terminalOutcome;
    const semantic = {
      schemaVersion: CAMPAIGN_SLOT_EVIDENCE_ROW_SCHEMA_VERSION,
      campaignRunId: source.run.campaignRunId,
      campaignPlanDigest: source.plan.planDigest,
      providerProfileId: source.run.providerProfileId,
      comparisonGroupId: source.plan.comparisonGroupId,
      slotId: slot.slotId,
      conditionId: slot.conditionId,
      conditionOrdinal: slot.conditionOrdinal,
      waveOrdinal: slot.waveOrdinal,
      generation: {
        attempts: projected.generationAttempts,
        retries: projected.generationRetries,
        assetReady: item.evidence.assetReady
      },
      candidate: {
        candidateId,
        candidateDigest: projected.refs.candidateDigest,
        canonicalSha256: projected.refs.canonicalSha256,
        visibleExternalMarkHint: evidence.markHint
      },
      observation: {
        runCount: projected.observationRuns,
        recoveryRunCount: projected.observationRecoveryRuns,
        authoritative: evidence.observationObject !== null,
        validIneligible: evidence.observationObject?.bundle?.eligibility?.status === "ineligible",
        observationObjectDigest: projected.refs.observationObjectDigest
      },
      judgment: {
        consensusSealed: evidence.consensus !== null,
        consensusDigest: projected.refs.consensusDigest,
        alignmentDigest: projected.refs.alignmentDigest
      },
      promotion: {
        decisionDigest: projected.refs.promotionDecisionDigest,
        terminalOutcome,
        g4GradeRecordDigest: projected.activeG4?.gradeRecordDigest || null,
        g4StatusAsOfCloseout: terminalOutcome === "promoted_g4" ? "active" : null,
        splitCouplingKeysDigest: projected.activeG4?.splitCouplingKeysDigest || null
      },
      warnings: warningsFor(item),
      sourceRefDigests: sortedUnique([...item.sourceRefDigests, ...slotArtifactDigests])
    };
    const row = deepFreeze({ ...semantic, rowDigest: sha256Hex(stableStringify(semantic)) });
    if (!validateCampaignSlotEvidenceRow(row).ok) return failure("report_slot_row_invalid", slot.slotId);
    rows.push(row);
  }
  rows.sort((left, right) => stableStringify([left.campaignRunId, left.conditionId, left.conditionOrdinal, left.slotId]).localeCompare(stableStringify([right.campaignRunId, right.conditionId, right.conditionOrdinal, right.slotId])));
  const uniqueSlots = new Set(rows.map((row) => `${row.campaignRunId}:${row.slotId}`));
  const conditionCounts = Object.fromEntries(["A", "B", "C", "D"].map((condition) => [condition, rows.filter((row) => row.conditionId === condition).length]));
  if (uniqueSlots.size !== 20 || Object.values(conditionCounts).some((count) => count !== 5)) return failure("report_denominator_invalid", "rows");
  return Object.freeze({ ok: true, rows: deepFreeze(rows), slotEvidenceDigest: sha256Hex(stableStringify(rows)) });
}

function rate(numerator, denominator) {
  return Object.freeze({ numerator, denominator, fractionLabel: `${numerator}/${denominator}`, percent: Math.round((numerator / denominator) * 1000) / 10 });
}

function stageNumerators(rows) {
  return {
    issued_primary_slots: rows.filter((row) => row.generation.attempts >= 1).length,
    asset_ready_handoffs: rows.filter((row) => row.generation.assetReady).length,
    registered_candidates: rows.filter((row) => row.candidate.candidateId !== null).length,
    authoritative_observations: rows.filter((row) => row.observation.authoritative).length,
    valid_ineligible: rows.filter((row) => row.observation.validIneligible).length,
    sealed_consensus: rows.filter((row) => row.judgment.consensusSealed).length,
    alignment_records: rows.filter((row) => row.judgment.alignmentDigest !== null).length,
    promotion_decisions: rows.filter((row) => row.promotion.decisionDigest !== null).length,
    promoted_g4_as_of_closeout: rows.filter((row) => row.promotion.terminalOutcome === "promoted_g4").length
  };
}

function terminalCounts(rows) {
  return Object.fromEntries(PILOT_TERMINAL_OUTCOMES.map((outcome) => [outcome, rows.filter((row) => row.promotion.terminalOutcome === outcome).length]));
}

function failureGroups(rows) {
  const mapping = {
    generation_technical: ["generation_failed_no_asset"],
    candidate_import_technical: ["candidate_import_failed"],
    observation_valid_ineligible: ["observation_valid_ineligible"],
    observation_technical: ["observation_failed"],
    judgment_incomplete: ["judgment_incomplete"],
    promotion_non_gold: ["retained_g3_negative_control"],
    promotion_hold: ["promotion_held"],
    promotion_reject: ["promotion_rejected"],
    campaign_cancelled: ["cancelled_budget_exhausted", "cancelled_campaign_stop", "cancelled_operator"]
  };
  return Object.fromEntries(T8_FAILURE_GROUPS.map((group) => [group, rows.filter((row) => mapping[group].includes(row.promotion.terminalOutcome)).length]));
}

function conditionSummary(rows, runId, providerProfileId, conditionId) {
  const subset = rows.filter((row) => row.campaignRunId === runId && row.conditionId === conditionId);
  if (subset.length !== 5) throw Object.assign(new Error("report_denominator_invalid"), { code: "report_denominator_invalid" });
  return deepFreeze({
    campaignRunId: runId,
    providerProfileId,
    conditionId,
    denominator: 5,
    registeredCandidates: rate(subset.filter((row) => row.candidate.candidateId).length, 5),
    authoritativeObservations: rate(subset.filter((row) => row.observation.authoritative).length, 5),
    validIneligible: rate(subset.filter((row) => row.observation.validIneligible).length, 5),
    promotedG4AsOfCloseout: rate(subset.filter((row) => row.promotion.terminalOutcome === "promoted_g4").length, 5),
    generationRetries: subset.reduce((sum, row) => sum + row.generation.retries, 0),
    observationRecoveryRuns: subset.reduce((sum, row) => sum + row.observation.recoveryRunCount, 0),
    terminalOutcomes: terminalCounts(subset)
  });
}

function comparisonSummary(rows, sourceRuns) {
  if (sourceRuns.length !== 2) return null;
  const [left, right] = sourceRuns;
  const leftRows = rows.filter((row) => row.campaignRunId === left.campaignRunId);
  const rightRows = rows.filter((row) => row.campaignRunId === right.campaignRunId);
  const leftStage = stageNumerators(leftRows);
  const rightStage = stageNumerators(rightRows);
  const stageDeltas = Object.fromEntries(T8_STAGE_METRICS.map((metric) => [metric, {
    providerA: leftStage[metric],
    providerB: rightStage[metric],
    countDeltaAminusB: leftStage[metric] - rightStage[metric],
    percentagePointDeltaAminusB: Math.round(((leftStage[metric] - rightStage[metric]) / 20) * 1000) / 10
  }]));
  const leftTerminal = terminalCounts(leftRows);
  const rightTerminal = terminalCounts(rightRows);
  const terminalDeltas = Object.fromEntries(PILOT_TERMINAL_OUTCOMES.map((outcome) => [outcome, {
    providerA: leftTerminal[outcome],
    providerB: rightTerminal[outcome],
    countDeltaAminusB: leftTerminal[outcome] - rightTerminal[outcome],
    percentagePointDeltaAminusB: Math.round(((leftTerminal[outcome] - rightTerminal[outcome]) / 20) * 1000) / 10
  }]));
  return deepFreeze({
    providerA: { campaignRunId: left.campaignRunId, providerProfileId: left.providerProfileId, denominator: 20 },
    providerB: { campaignRunId: right.campaignRunId, providerProfileId: right.providerProfileId, denominator: 20 },
    stageDeltas,
    terminalDeltas,
    authority: "descriptive_only",
    ranking: null,
    significance: null,
    causalAttribution: null
  });
}

export function deriveCampaignMetricSet({ sourceSnapshot, rows }) {
  const runCount = sourceSnapshot.sourceRuns.length;
  const denominator = 20 * runCount;
  if (!Array.isArray(rows) || rows.length !== denominator || !rows.every(verifyCampaignSlotRowIntegrity)) return failure("report_denominator_invalid", "rows");
  const runIds = sourceSnapshot.sourceRuns.map((run) => run.campaignRunId).sort();
  if (stableStringify(sortedUnique(rows.map((row) => row.campaignRunId))) !== stableStringify(runIds) || runIds.some((runId) => rows.filter((row) => row.campaignRunId === runId).length !== 20)) return failure("report_denominator_invalid", "rows.campaignRunId");
  const stageCounts = stageNumerators(rows);
  const stageMetrics = Object.fromEntries(T8_STAGE_METRICS.map((metric) => [metric, rate(stageCounts[metric], denominator)]));
  const summaries = [];
  for (const run of sourceSnapshot.sourceRuns) for (const condition of ["A", "B", "C", "D"]) summaries.push(conditionSummary(rows, run.campaignRunId, run.providerProfileId, condition));
  const semantic = {
    schemaVersion: CAMPAIGN_METRIC_SET_SCHEMA_VERSION,
    sourceSnapshotDigest: sourceSnapshot.sourceSnapshotDigest,
    runCount,
    policy: METRIC_POLICY,
    stageMetrics,
    terminalOutcomes: terminalCounts(rows),
    conditionSummaries: summaries,
    failureGroups: failureGroups(rows),
    comparison: comparisonSummary(rows, sourceSnapshot.sourceRuns)
  };
  const metricSet = deepFreeze({ ...semantic, metricSetDigest: sha256Hex(stableStringify(semantic)) });
  const semanticFailure = metricSetSemanticFailure(metricSet);
  return semanticFailure === null
    ? Object.freeze({ ok: true, metricSet })
    : failure("report_metric_set_invalid", "$", semanticFailure);
}

export function buildCampaignEvidenceSnapshot({ sources, rows, comparisonKey = null, capturedAt = new Date().toISOString() }) {
  if (!Array.isArray(sources) || ![1, 2].includes(sources.length) || !Number.isFinite(Date.parse(capturedAt)) || new Date(capturedAt).toISOString() !== capturedAt) return failure("report_source_snapshot_invalid", "$", null);
  const reportScope = sources.length === 1 ? "single_run" : "provider_comparison";
  if ((reportScope === "provider_comparison") !== Boolean(comparisonKey)) return failure("report_source_snapshot_invalid", "comparisonKey");
  const artifactIndex = sources.flatMap((source) => source.artifactIndex).sort((a, b) => stableStringify(a).localeCompare(stableStringify(b)));
  const artifactIndexDigest = sha256Hex(stableStringify(artifactIndex));
  const slotEvidenceDigest = sha256Hex(stableStringify(rows));
  const sourceRuns = sources.map((source) => ({
    campaignRunId: source.run.campaignRunId,
    campaignPlanDigest: source.plan.planDigest,
    finalProjectionDigest: source.projection.projectionDigest,
    closeoutDigest: source.closeout.closeoutDigest,
    comparisonGroupId: source.plan.comparisonGroupId,
    providerProfileId: source.run.providerProfileId,
    closedAt: source.closeout.closedAt
  })).sort((a, b) => a.campaignRunId.localeCompare(b.campaignRunId));
  const semantic = {
    schemaVersion: CAMPAIGN_EVIDENCE_SNAPSHOT_SCHEMA_VERSION,
    reportScope,
    sourceRuns,
    sourceIntegrity: {
      t7PlanRunSlotLedgerVerified: true,
      t7CloseoutVerified: true,
      referencedT3ArtifactsVerified: true,
      referencedT4ArtifactsVerified: true,
      referencedT5ArtifactsVerified: true,
      referencedT6ArtifactsVerified: true,
      canonicalAssetsVerified: true
    },
    artifactIndexDigest,
    slotEvidenceDigest,
    comparisonKeyDigest: comparisonKey?.comparisonKeyDigest || null
  };
  const snapshot = deepFreeze({ ...semantic, capturedAt, sourceSnapshotDigest: sha256Hex(stableStringify(semantic)) });
  return validateCampaignEvidenceSnapshot(snapshot).ok
    ? Object.freeze({ ok: true, snapshot, artifactIndex })
    : failure("report_source_snapshot_invalid", "$", "contract");
}

function validDelta(value) {
  return exactKeys(value, ["providerA", "providerB", "countDeltaAminusB", "percentagePointDeltaAminusB"]) &&
    Number.isInteger(value.providerA) && value.providerA >= 0 && value.providerA <= 20 &&
    Number.isInteger(value.providerB) && value.providerB >= 0 && value.providerB <= 20 &&
    value.countDeltaAminusB === value.providerA - value.providerB &&
    value.percentagePointDeltaAminusB === Math.round(((value.providerA - value.providerB) / 20) * 1000) / 10;
}

function comparisonSemanticFailure(metricSet) {
  if (metricSet.runCount === 1) return metricSet.comparison === null ? null : "comparison_present_for_single_run";
  const comparison = metricSet.comparison;
  if (!exactKeys(comparison, ["providerA", "providerB", "stageDeltas", "terminalDeltas", "authority", "ranking", "significance", "causalAttribution"])) return "comparison_shape";
  for (const provider of [comparison.providerA, comparison.providerB]) {
    if (!exactKeys(provider, ["campaignRunId", "providerProfileId", "denominator"]) || !/^crun_[a-f0-9]{24}$/.test(provider.campaignRunId || "") || typeof provider.providerProfileId !== "string" || provider.providerProfileId.length === 0 || provider.denominator !== 20) return "comparison_provider_shape";
  }
  if (comparison.providerA.campaignRunId === comparison.providerB.campaignRunId || comparison.providerA.providerProfileId === comparison.providerB.providerProfileId) return "comparison_provider_not_varied";
  if (!exactKeys(comparison.stageDeltas, T8_STAGE_METRICS) || Object.values(comparison.stageDeltas).some((value) => !validDelta(value))) return "comparison_stage_delta";
  if (!exactKeys(comparison.terminalDeltas, PILOT_TERMINAL_OUTCOMES) || Object.values(comparison.terminalDeltas).some((value) => !validDelta(value))) return "comparison_terminal_delta";
  if (comparison.authority !== "descriptive_only" || comparison.ranking !== null || comparison.significance !== null || comparison.causalAttribution !== null) return "comparison_authority";
  const summaryRuns = sortedUnique(metricSet.conditionSummaries.map((summary) => summary.campaignRunId));
  if (stableStringify(summaryRuns) !== stableStringify([comparison.providerA.campaignRunId, comparison.providerB.campaignRunId].sort())) return "comparison_summary_runs";
  return null;
}

function metricSetSemanticFailure(metricSet) {
  const validation = validateCampaignMetricSet(metricSet);
  if (!validation.ok) return `contract:${validation.errors.map((item) => `${item.path}:${item.detail ?? ""}`).join("|")}`;
  const denominator = 20 * metricSet.runCount;
  const stage = Object.fromEntries(Object.entries(metricSet.stageMetrics).map(([key, value]) => [key, value.numerator]));
  if (!(stage.issued_primary_slots >= stage.asset_ready_handoffs && stage.asset_ready_handoffs >= stage.registered_candidates && stage.registered_candidates >= stage.authoritative_observations && stage.authoritative_observations >= stage.valid_ineligible && stage.authoritative_observations >= stage.sealed_consensus && stage.sealed_consensus >= stage.alignment_records && stage.alignment_records >= stage.promotion_decisions && stage.promotion_decisions >= stage.promoted_g4_as_of_closeout)) return "funnel_order";
  if (Object.values(metricSet.terminalOutcomes).reduce((sum, value) => sum + value, 0) !== denominator) return "terminal_denominator";
  const terminalFromConditions = Object.fromEntries(PILOT_TERMINAL_OUTCOMES.map((outcome) => [outcome, metricSet.conditionSummaries.reduce((sum, summary) => sum + summary.terminalOutcomes[outcome], 0)]));
  if (stableStringify(terminalFromConditions) !== stableStringify(metricSet.terminalOutcomes)) return "condition_terminal_aggregate";
  const uniqueConditionKeys = new Set(metricSet.conditionSummaries.map((summary) => `${summary.campaignRunId}:${summary.conditionId}`));
  if (uniqueConditionKeys.size !== 4 * metricSet.runCount) return "condition_key_count";
  const aggregate = {
    registered_candidates: metricSet.conditionSummaries.reduce((sum, summary) => sum + summary.registeredCandidates.numerator, 0),
    authoritative_observations: metricSet.conditionSummaries.reduce((sum, summary) => sum + summary.authoritativeObservations.numerator, 0),
    valid_ineligible: metricSet.conditionSummaries.reduce((sum, summary) => sum + summary.validIneligible.numerator, 0),
    promoted_g4_as_of_closeout: metricSet.conditionSummaries.reduce((sum, summary) => sum + summary.promotedG4AsOfCloseout.numerator, 0)
  };
  for (const [key, value] of Object.entries(aggregate)) if (stage[key] !== value) return `stage_condition_aggregate:${key}`;
  const expectedFailureGroups = {
    generation_technical: metricSet.terminalOutcomes.generation_failed_no_asset,
    candidate_import_technical: metricSet.terminalOutcomes.candidate_import_failed,
    observation_valid_ineligible: metricSet.terminalOutcomes.observation_valid_ineligible,
    observation_technical: metricSet.terminalOutcomes.observation_failed,
    judgment_incomplete: metricSet.terminalOutcomes.judgment_incomplete,
    promotion_non_gold: metricSet.terminalOutcomes.retained_g3_negative_control,
    promotion_hold: metricSet.terminalOutcomes.promotion_held,
    promotion_reject: metricSet.terminalOutcomes.promotion_rejected,
    campaign_cancelled: metricSet.terminalOutcomes.cancelled_budget_exhausted + metricSet.terminalOutcomes.cancelled_campaign_stop + metricSet.terminalOutcomes.cancelled_operator
  };
  if (stableStringify(expectedFailureGroups) !== stableStringify(metricSet.failureGroups)) return "failure_group_aggregate";
  return comparisonSemanticFailure(metricSet);
}

export function verifyCampaignSlotRowIntegrity(row) {
  if (!validateCampaignSlotEvidenceRow(row).ok) return false;
  return row.rowDigest === semanticDigest(row, ["rowDigest"]);
}

export function verifyCampaignEvidenceSnapshotIntegrity(snapshot) {
  if (!validateCampaignEvidenceSnapshot(snapshot).ok) return false;
  return snapshot.sourceSnapshotDigest === semanticDigest(snapshot, ["capturedAt", "sourceSnapshotDigest"]);
}

export function verifyCampaignMetricSetIntegrity(metricSet) {
  if (metricSetSemanticFailure(metricSet) !== null) return false;
  return metricSet.metricSetDigest === semanticDigest(metricSet, ["metricSetDigest"]);
}
