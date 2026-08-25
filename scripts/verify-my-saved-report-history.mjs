#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

const [readerSource, routeSource, uiSource, dashboardSource, migrationSource] = await Promise.all([
  read("lib/my/saved-report-history.js"),
  read("app/api/my/saved-reports/route.js"),
  read("components/my/SavedReportHistory.jsx"),
  read("components/my/MyDashboard.jsx"),
  read("supabase/migrations/20260520170737_add_revisit_core_tables.sql")
]);

assert.match(readerSource, /import "server-only"/);
assert.match(readerSource, /\.from\("saved_reports"\)/);
assert.match(readerSource, /\.eq\("user_id", user\.id\)/);
assert.match(readerSource, /\.order\("created_at", \{ ascending: false \}\)/);
assert.match(readerSource, /\.order\("id", \{ ascending: false \}\)/);
assert.match(readerSource, /\.range\(normalizedOffset, normalizedOffset \+ normalizedLimit\)/);
assert.match(readerSource, /rows\.slice\(0, normalizedLimit\)/);
assert.match(readerSource, /nextOffset: hasMore \? normalizedOffset \+ normalizedLimit : null/);

const columnsStart = readerSource.indexOf("const SAVED_REPORT_HISTORY_COLUMNS");
const columnsEnd = readerSource.indexOf("].join", columnsStart);
assert.ok(columnsStart >= 0 && columnsEnd > columnsStart);
const columnsSource = readerSource.slice(columnsStart, columnsEnd);
for (const column of [
  "id",
  "report_type",
  "source_type",
  "source_session_id",
  "title",
  "report_version",
  "created_at",
  "updated_at"
]) {
  assert.match(columnsSource, new RegExp(`"${column}"`));
}
for (const forbiddenColumn of ["free_result", "premium_report", "face_lab", "skin_profile_id", "user_id"]) {
  assert.doesNotMatch(columnsSource, new RegExp(`"${forbiddenColumn}"`));
}

assert.match(readerSource, /reportType: report\.report_type/);
assert.match(readerSource, /reportVersion: report\.report_version/);
assert.match(readerSource, /href: getSavedReportHistoryPath\(report\)/);
assert.doesNotMatch(readerSource.slice(readerSource.indexOf("function normalizeSavedReport")), /freeResult|premiumReport|faceLab|sourceSessionId|userId/);
assert.match(readerSource, /report\.report_type === "premium"/);
assert.match(readerSource, /\/result\/full-report\?savedReportId=/);
assert.match(readerSource, /report\.report_type === "free"/);
assert.match(readerSource, /report\.source_type === "share"/);
assert.match(readerSource, /`\/r\/\$\{encodeURIComponent\(report\.source_session_id\)\}`/);

assert.match(readerSource, /SAVED_REPORT_HISTORY_DEFAULT_LIMIT = 5/);
assert.match(readerSource, /SAVED_REPORT_HISTORY_MAX_LIMIT = 12/);
assert.match(readerSource, /SAVED_REPORT_HISTORY_MAX_OFFSET = 240/);
assert.match(readerSource, /invalid_saved_report_history_query/);
assert.match(routeSource, /searchParams\.get\("limit"\)/);
assert.match(routeSource, /searchParams\.get\("offset"\)/);
assert.match(routeSource, /createNoStoreHeaders/);
assert.match(routeSource, /status: result\.status/);

assert.match(uiSource, /\/api\/my\/saved-reports\?/);
assert.match(uiSource, /cache: "no-store"/);
assert.match(uiSource, /PAGE_SIZE = 5/);
assert.match(uiSource, /nextOffset/);
assert.match(uiSource, /loadMore/);
assert.match(uiSource, /내 분석 기록/);
assert.match(uiSource, /My Analysis History/);
assert.match(uiSource, /report\.reportVersion/);
assert.match(uiSource, /report\.createdAt/);
assert.match(uiSource, /report\.reportType === "premium"/);
assert.match(uiSource, /href\.startsWith\("\/result\/full-report\?"\)/);
assert.match(uiSource, /locale === "en" \? `\/en\$\{href\}` : href/);
assert.match(uiSource, /href\.startsWith\("\/r\/"\)/);
assert.match(uiSource, /sm:grid-cols-\[minmax\(0,1fr\)_auto\]/);

assert.match(dashboardSource, /SavedReportHistory/);
assert.match(dashboardSource, /<SavedReportHistory locale=\{locale\} \/>/);

assert.match(migrationSource, /alter table public\.saved_reports enable row level security/);
assert.match(migrationSource, /saved_reports_authenticated_select_own/);
assert.match(migrationSource, /using \(auth\.uid\(\) = user_id\)/);
assert.match(migrationSource, /idx_saved_reports_user_id_created_at/);

console.log("MY SAVED REPORT HISTORY VERIFIER: PASS");
