import {
  CAMPAIGN_EXPORT_MANIFEST_SCHEMA_VERSION,
  T8_AUDIENCE,
  validateCampaignExportManifest
} from "@bejewely/face-contracts";
import { sha256Hex, stableStringify } from "../shared/canonical-json.js";
import { EXPORTER_PROFILE } from "./policy.js";
import { verifyCampaignEvidenceSnapshotIntegrity, verifyCampaignMetricSetIntegrity } from "./derive.js";
import { verifyCampaignReportIntegrity } from "./claims-report.js";
import { verifyCampaignReviewPackageIntegrity } from "./review-package.js";

function failure(code, path, detail = null) {
  return Object.freeze({ ok: false, errors: Object.freeze([{ code, path, detail }]) });
}

function jsonBytes(value) {
  return Buffer.from(`${stableStringify(value)}\n`, "utf8");
}

function csvCell(value) {
  if (value === null || value === undefined) return "";
  const text = typeof value === "object" ? stableStringify(value) : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csvBytes(columns, rows) {
  const lines = [columns.join(",")];
  for (const row of rows) lines.push(columns.map((column) => csvCell(row[column])).join(","));
  return Buffer.from(`${lines.join("\n")}\n`, "utf8");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function reportHtml(report, metricSet) {
  const stageRows = Object.entries(metricSet.stageMetrics).sort(([left], [right]) => left.localeCompare(right)).map(([name, rate]) => `<tr><th scope="row">${escapeHtml(name)}</th><td>${rate.numerator}</td><td>${rate.denominator}</td><td>${escapeHtml(rate.fractionLabel)}</td><td>${rate.percent.toFixed(1)}%</td></tr>`).join("");
  const terminalRows = Object.entries(metricSet.terminalOutcomes).sort(([left], [right]) => left.localeCompare(right)).map(([name, count]) => `<tr><th scope="row">${escapeHtml(name)}</th><td>${count}</td></tr>`).join("");
  const claimRows = report.interpretationClaims.map((claim) => `<li><strong>${escapeHtml(claim.claimType)}</strong> — ${escapeHtml(claim.statement)} <code>${escapeHtml(claim.sourceMetricIds.join(","))}</code></li>`).join("");
  const limitations = report.limitations.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  return `<!doctype html>\n<html lang="en">\n<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(report.title)}</title><style>body{font-family:system-ui,sans-serif;max-width:1100px;margin:24px auto;padding:0 16px;color:#171717}table{border-collapse:collapse;width:100%;margin-block:1rem}th,td{border:1px solid #777;padding:.45rem;text-align:left}code{overflow-wrap:anywhere}.boundary{border:2px solid #333;padding:12px}@media print{body{max-width:none;margin:0}a{color:inherit}}</style></head>\n<body>\n<header><h1>${escapeHtml(report.title)}</h1><p class="boundary">Internal review only. Descriptive evidence report; not split, G5, clinical, identity, or public-release authority.</p></header>\n<section><h2>Scope and source boundary</h2><p>Runs: ${escapeHtml(report.scope.campaignRunIds.join(", "))}. Primary denominator per run: 20. G4 time boundary: as of closeout.</p></section>\n<section><h2>Stage funnel</h2><table><thead><tr><th>Metric</th><th>Numerator</th><th>Denominator</th><th>Fraction</th><th>Percent</th></tr></thead><tbody>${stageRows}</tbody></table></section>\n<section><h2>Terminal outcomes</h2><table><thead><tr><th>Outcome</th><th>Count</th></tr></thead><tbody>${terminalRows}</tbody></table></section>\n<section><h2>Source-linked descriptive claims</h2><ul>${claimRows}</ul></section>\n<section><h2>Limitations</h2><ul>${limitations}</ul></section>\n<footer><p>Report digest: <code>${report.reportDigest}</code><br>Source snapshot: <code>${report.sourceSnapshotDigest}</code><br>Metric set: <code>${report.metricSetDigest}</code></p></footer>\n</body></html>\n`;
}

function slotCsvRows(rows) {
  return rows.map((row) => ({
    campaign_run_id: row.campaignRunId,
    campaign_plan_digest: row.campaignPlanDigest,
    provider_profile_id: row.providerProfileId,
    comparison_group_id: row.comparisonGroupId,
    slot_id: row.slotId,
    condition_id: row.conditionId,
    condition_ordinal: row.conditionOrdinal,
    wave_ordinal: row.waveOrdinal,
    generation_attempts: row.generation.attempts,
    generation_retries: row.generation.retries,
    generation_asset_ready: row.generation.assetReady,
    candidate_id: row.candidate.candidateId,
    candidate_digest: row.candidate.candidateDigest,
    canonical_sha256: row.candidate.canonicalSha256,
    visible_external_mark_hint: row.candidate.visibleExternalMarkHint,
    observation_run_count: row.observation.runCount,
    observation_recovery_run_count: row.observation.recoveryRunCount,
    observation_authoritative: row.observation.authoritative,
    observation_valid_ineligible: row.observation.validIneligible,
    observation_object_digest: row.observation.observationObjectDigest,
    consensus_sealed: row.judgment.consensusSealed,
    consensus_digest: row.judgment.consensusDigest,
    alignment_digest: row.judgment.alignmentDigest,
    promotion_decision_digest: row.promotion.decisionDigest,
    terminal_outcome: row.promotion.terminalOutcome,
    g4_grade_record_digest: row.promotion.g4GradeRecordDigest,
    g4_status_as_of_closeout: row.promotion.g4StatusAsOfCloseout,
    split_coupling_keys_digest: row.promotion.splitCouplingKeysDigest,
    warnings: row.warnings,
    source_ref_digests: row.sourceRefDigests,
    row_digest: row.rowDigest
  }));
}

function addFile(files, relativePath, mediaType, role, bytes) {
  files.set(relativePath, { bytes, mediaType, role });
}

export function buildExportFiles({ sourceSnapshot, artifactIndex, rows, metricSet, reviewPackage, reviewFiles, report, generatedAt = new Date().toISOString() }) {
  if (!verifyCampaignEvidenceSnapshotIntegrity(sourceSnapshot) || !verifyCampaignMetricSetIntegrity(metricSet) || !verifyCampaignReviewPackageIntegrity(reviewPackage) || !verifyCampaignReportIntegrity(report, metricSet) || !Number.isFinite(Date.parse(generatedAt)) || new Date(generatedAt).toISOString() !== generatedAt) return failure("campaign_export_invalid", "source");
  const files = new Map();
  addFile(files, "source-snapshot.json", "application/json", "source", jsonBytes(sourceSnapshot));
  addFile(files, "artifact-index.json", "application/json", "source", jsonBytes(artifactIndex));
  addFile(files, "slots.json", "application/json", "table", jsonBytes(rows));
  const slotRows = slotCsvRows(rows);
  addFile(files, "slots.csv", "text/csv; charset=utf-8", "table", csvBytes(Object.keys(slotRows[0]), slotRows));
  addFile(files, "stage-summary.json", "application/json", "table", jsonBytes(metricSet.stageMetrics));
  addFile(files, "stage-summary.csv", "text/csv; charset=utf-8", "table", csvBytes(["metric_id","numerator","denominator","fraction_label","percent"], Object.entries(metricSet.stageMetrics).sort(([left],[right]) => left.localeCompare(right)).map(([metric_id, value]) => ({ metric_id, numerator: value.numerator, denominator: value.denominator, fraction_label: value.fractionLabel, percent: value.percent.toFixed(1) }))));
  addFile(files, "condition-summary.json", "application/json", "table", jsonBytes(metricSet.conditionSummaries));
  addFile(files, "condition-summary.csv", "text/csv; charset=utf-8", "table", csvBytes(["campaign_run_id","provider_profile_id","condition_id","denominator","registered_candidates","authoritative_observations","valid_ineligible","promoted_g4_as_of_closeout","generation_retries","observation_recovery_runs","terminal_outcomes"], metricSet.conditionSummaries.map((item) => ({ campaign_run_id: item.campaignRunId, provider_profile_id: item.providerProfileId, condition_id: item.conditionId, denominator: item.denominator, registered_candidates: item.registeredCandidates, authoritative_observations: item.authoritativeObservations, valid_ineligible: item.validIneligible, promoted_g4_as_of_closeout: item.promotedG4AsOfCloseout, generation_retries: item.generationRetries, observation_recovery_runs: item.observationRecoveryRuns, terminal_outcomes: item.terminalOutcomes }))));
  addFile(files, "terminal-outcomes.csv", "text/csv; charset=utf-8", "table", csvBytes(["terminal_outcome","count"], Object.entries(metricSet.terminalOutcomes).sort(([left],[right]) => left.localeCompare(right)).map(([terminal_outcome, count]) => ({ terminal_outcome, count }))));
  const warningCounts = {};
  for (const row of rows) for (const warning of row.warnings) warningCounts[warning] = (warningCounts[warning] || 0) + 1;
  addFile(files, "reason-codes.csv", "text/csv; charset=utf-8", "table", csvBytes(["reason_code","count"], Object.entries(warningCounts).sort(([left],[right]) => left.localeCompare(right)).map(([reason_code, count]) => ({ reason_code, count }))));
  for (const [relativePath, bytes] of reviewFiles) addFile(files, relativePath, relativePath.endsWith(".html") ? "text/html; charset=utf-8" : "image/png", relativePath.endsWith(".html") ? "review" : "thumbnail", bytes);
  addFile(files, "report/report.json", "application/json", "report", jsonBytes(report));
  addFile(files, "report/report.html", "text/html; charset=utf-8", "report", Buffer.from(reportHtml(report, metricSet), "utf8"));
  if (metricSet.comparison) {
    addFile(files, "comparison/provider-summary.json", "application/json", "table", jsonBytes(metricSet.comparison));
    const rows = Object.entries(metricSet.comparison.stageDeltas).sort(([left],[right]) => left.localeCompare(right)).map(([metric_id, value]) => ({ metric_id, provider_a: value.providerA, provider_b: value.providerB, count_delta_a_minus_b: value.countDeltaAminusB, percentage_point_delta_a_minus_b: value.percentagePointDeltaAminusB.toFixed(1) }));
    addFile(files, "comparison/provider-summary.csv", "text/csv; charset=utf-8", "table", csvBytes(["metric_id","provider_a","provider_b","count_delta_a_minus_b","percentage_point_delta_a_minus_b"], rows));
  }
  const descriptors = [...files.entries()].map(([relativePath, file]) => ({ relativePath, mediaType: file.mediaType, sha256: sha256Hex(file.bytes), byteLength: file.bytes.length, role: file.role })).sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  const semantic = {
    schemaVersion: CAMPAIGN_EXPORT_MANIFEST_SCHEMA_VERSION,
    sourceSnapshotDigest: sourceSnapshot.sourceSnapshotDigest,
    reportDigest: report.reportDigest,
    audience: T8_AUDIENCE,
    files: descriptors,
    generatedBy: EXPORTER_PROFILE
  };
  const exportManifest = { ...semantic, generatedAt, exportDigest: sha256Hex(stableStringify(semantic)) };
  return validateCampaignExportManifest(exportManifest).ok ? Object.freeze({ ok: true, files, exportManifest }) : failure("campaign_export_manifest_invalid", "$", "contract");
}

export function verifyCampaignExportManifestIntegrity(manifest) {
  if (!validateCampaignExportManifest(manifest).ok) return false;
  const { generatedAt, exportDigest, ...semantic } = manifest;
  return exportDigest === sha256Hex(stableStringify(semantic));
}

export const csvInternals = Object.freeze({ csvCell, csvBytes, jsonBytes });
