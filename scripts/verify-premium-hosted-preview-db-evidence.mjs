import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import {
  fetchPremiumSessionRows,
  fetchSavedReportById,
  countDuplicateSourceTuples,
  requireCondition
} from "./premium-browser-journey-core.mjs";
import { HOSTED_FAILURE_CATEGORIES, loadHostedManifest, parseHostedConfig } from "./premium-hosted-preview-core.mjs";

const config = parseHostedConfig();
const manifest = await loadHostedManifest(config.manifestPath);
const accessToken = String(process.env.PREMIUM_HOSTED_ACCESS_TOKEN || "").trim();
const supabaseUrl = String(process.env.PREMIUM_HOSTED_SUPABASE_URL || "").trim();
const anonKey = String(process.env.PREMIUM_HOSTED_SUPABASE_ANON_KEY || "").trim();
const savedIds = String(process.env.PREMIUM_HOSTED_SAVED_REPORT_IDS || "").split(",").map((value) => value.trim()).filter(Boolean);
requireCondition(accessToken && supabaseUrl && anonKey, HOSTED_FAILURE_CATEGORIES.PRECONDITION, "db-evidence", "supabase_reader_config_missing");
requireCondition(savedIds.length >= 2, HOSTED_FAILURE_CATEGORIES.PRECONDITION, "db-evidence", "saved_report_ids_incomplete");

const { buildPremiumReportSnapshot } = await import(pathToFileURL(resolve(process.cwd(), "lib/premium-report-snapshot.js")).href);
const dbConfig = { accessToken, supabaseUrl, anonKey };
const rows = [];
for (const id of savedIds) {
  const row = await fetchSavedReportById(dbConfig, id);
  requireCondition(row?.id === id, HOSTED_FAILURE_CATEGORIES.PERSISTENCE, "db-evidence", "saved_report_not_readable");
  const snapshot = buildPremiumReportSnapshot(row.premium_report);
  requireCondition(snapshot?.fingerprint, HOSTED_FAILURE_CATEGORIES.PERSISTENCE, "db-evidence", "snapshot_fingerprint_missing");
  requireCondition(row.report_version === snapshot.reportVersion, HOSTED_FAILURE_CATEGORIES.PERSISTENCE, "db-evidence", "report_version_mismatch");
  rows.push({
    savedReportId: row.id,
    ownerMatches: row.user_id === manifest.accountA.userId,
    reportType: row.report_type,
    reportVersion: row.report_version,
    snapshotVersion: snapshot.version,
    decisionBundleVersion: snapshot.decisionBundleVersion,
    fingerprint: snapshot.fingerprint,
    sourceType: row.source_type,
    sourceSessionId: row.source_session_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });
}
requireCondition(rows.every((row) => row.ownerMatches), HOSTED_FAILURE_CATEGORIES.AUTH, "db-evidence", "saved_report_owner_mismatch");
requireCondition(new Set(rows.map((row) => row.sourceSessionId)).size === rows.length, HOSTED_FAILURE_CATEGORIES.PERSISTENCE, "db-evidence", "source_session_not_independent");
const allSessionRows = await fetchPremiumSessionRows(dbConfig);
requireCondition(countDuplicateSourceTuples(allSessionRows) === 0, HOSTED_FAILURE_CATEGORIES.PERSISTENCE, "db-evidence", "duplicate_source_tuple_detected");

console.log(JSON.stringify({ status: "passed", rows: rows.map(({ sourceSessionId, ...row }) => row), duplicateTupleCount: 0 }, null, 2));
