from pathlib import Path

root = Path(".")

runner_path = root / "scripts/run-premium-browser-journey.mjs"
runner = runner_path.read_text(encoding="utf-8")
old_conflict = '''    if (conflictAccessToken) {
      const rowsBefore = await fetchPremiumSessionRows(supabaseConfig);
      await runStep(`${locale}:principal-conflict`, FAILURE_CATEGORIES.AUTH, async () => {
        const result = await requestJson(context, `${locale}:principal-conflict`, "/api/full-report", { method: "POST", data: reportBody }, conflictAccessToken);
        requireCondition(result.status === 401 && result.body?.error === "premium_principal_conflict", FAILURE_CATEGORIES.AUTH, `${locale}:principal-conflict`, "principal_conflict_not_rejected");
        return result;
      });
      const rowsAfter = await fetchPremiumSessionRows(supabaseConfig);
      assert.equal(rowsAfter.length, rowsBefore.length);
    }'''
new_conflict = '''    if (conflictAccessToken) {
      const rowsBefore = await fetchPremiumSessionRows(supabaseConfig);
      await runStep(`${locale}:principal-conflict`, FAILURE_CATEGORIES.AUTH, async () => {
        const result = await requestJson(context, `${locale}:principal-conflict`, "/api/full-report", { method: "POST", data: reportBody }, conflictAccessToken);
        requireCondition(result.status === 401 && result.body?.error === "premium_principal_conflict", FAILURE_CATEGORIES.AUTH, `${locale}:principal-conflict`, "principal_conflict_not_rejected");
        return result;
      });

      const foreignContext = await browser.newContext({ extraHTTPHeaders });
      try {
        await runStep(`${locale}:cross-account-saved-report`, FAILURE_CATEGORIES.AUTH, async () => {
          const result = await requestJson(
            foreignContext,
            `${locale}:cross-account-saved-report`,
            "/api/full-report",
            { method: "POST", data: { savedReportId: firstId, locale } },
            conflictAccessToken
          );
          requireCondition(
            result.status === 401 && result.body?.error === "premium_session_missing_or_expired",
            FAILURE_CATEGORIES.AUTH,
            `${locale}:cross-account-saved-report`,
            "cross_account_saved_report_not_rejected"
          );
          return result;
        });
      } finally {
        await foreignContext.close();
      }

      const rowsAfter = await fetchPremiumSessionRows(supabaseConfig);
      assert.equal(rowsAfter.length, rowsBefore.length);
      const ownerRowAfterCrossAccount = await fetchSavedReportById(supabaseConfig, firstId);
      assert.deepEqual(ownerRowAfterCrossAccount?.premium_report, firstSaved.row.premium_report);
      assert.equal(ownerRowAfterCrossAccount?.updated_at, firstSaved.row.updated_at);
    }'''
if runner.count(old_conflict) != 1:
    raise SystemExit("cross-account insertion anchor mismatch")
runner = runner.replace(old_conflict, new_conflict, 1)
old_check = '  recordCheck("principal_conflict_checked", Boolean(conflictAccessToken), conflictAccessToken ? null : "optional_second_account_not_supplied");'
new_check = '''  recordCheck(
    "cross_account_saved_report_denied",
    !conflictAccessToken || (
      steps.filter((step) => step.name.endsWith(":cross-account-saved-report")).length === 2 &&
      steps.filter((step) => step.name.endsWith(":cross-account-saved-report")).every((step) => step.status === "passed")
    ),
    conflictAccessToken ? null : "optional_second_account_not_supplied"
  );
  recordCheck("principal_conflict_checked", Boolean(conflictAccessToken), conflictAccessToken ? null : "optional_second_account_not_supplied");'''
if runner.count(old_check) != 1:
    raise SystemExit("cross-account verdict anchor mismatch")
runner = runner.replace(old_check, new_check, 1)
runner_path.write_text(runner, encoding="utf-8")

cleanup_path = root / "scripts/cleanup-premium-browser-journey.mjs"
cleanup = cleanup_path.read_text(encoding="utf-8")
old_import = '''  normalizeBaseUrl,
  requireCondition
} from "./premium-browser-journey-core.mjs";'''
new_import = '''  normalizeBaseUrl,
  requireCondition,
  validateEnvironmentGuard
} from "./premium-browser-journey-core.mjs";'''
if cleanup.count(old_import) != 1:
    raise SystemExit("cleanup validate import anchor mismatch")
cleanup = cleanup.replace(old_import, new_import, 1)
old_config = '''const baseUrl = normalizeBaseUrl(process.env.PREMIUM_E2E_BASE_URL);
'''
new_config = '''const baseUrl = normalizeBaseUrl(process.env.PREMIUM_E2E_BASE_URL);
const environment = String(process.env.PREMIUM_E2E_ENVIRONMENT || "").trim();
const expectedHost = String(process.env.PREMIUM_E2E_EXPECTED_HOST || "").trim();
const expectedSha = String(process.env.PREMIUM_E2E_EXPECTED_SHA || "").trim();
'''
if cleanup.count(old_config) != 1:
    raise SystemExit("cleanup config anchor mismatch")
cleanup = cleanup.replace(old_config, new_config, 1)
old_guard = '''requireCondition(manifest.targetHost === baseUrl.hostname, FAILURE_CATEGORIES.PRECONDITION, "cleanup", "cleanup_target_host_mismatch");
requireCondition(
  ["preview", "production-like", "production"].includes(manifest.environment),
  FAILURE_CATEGORIES.PRECONDITION,
  "cleanup",
  "cleanup_environment_invalid"
);
if (manifest.environment === "production") {
  requireCondition(
    process.env.PREMIUM_E2E_ALLOW_PRODUCTION === PRODUCTION_CONFIRMATION,
    FAILURE_CATEGORIES.PRECONDITION,
    "cleanup",
    "production_cleanup_not_confirmed"
  );
}
'''
new_guard = '''requireCondition(manifest.targetHost === baseUrl.hostname, FAILURE_CATEGORIES.PRECONDITION, "cleanup", "cleanup_target_host_mismatch");
requireCondition(manifest.environment === environment, FAILURE_CATEGORIES.PRECONDITION, "cleanup", "cleanup_environment_mismatch");
validateEnvironmentGuard({
  baseUrl,
  environment,
  expectedHost,
  expectedSha,
  deploymentSha: String(manifest.targetGitSha || ""),
  productionConfirmation: process.env.PREMIUM_E2E_ALLOW_PRODUCTION
});
'''
if cleanup.count(old_guard) != 1:
    raise SystemExit("cleanup environment guard replacement mismatch")
cleanup = cleanup.replace(old_guard, new_guard, 1)
old_ids = '''const ids = Array.isArray(persistence.createdSavedReportIds)
  ? [...new Set(persistence.createdSavedReportIds)]
  : [];
requireCondition(ids.length > 0, FAILURE_CATEGORIES.PRECONDITION, "cleanup", "no_cleanup_ids");
requireCondition(
  ids.every((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)),
  FAILURE_CATEGORIES.PRECONDITION,
  "cleanup",
  "invalid_cleanup_id"
);

const deleted = [];
for (const id of ids) {
  const existing = await fetchSavedReportById(config, id);
  requireCondition(existing?.user_id === user.id, FAILURE_CATEGORIES.AUTH, "cleanup", "cleanup_row_owner_mismatch");
  requireCondition(
    existing?.report_type === "premium" && existing?.source_type === "premium_report_session",
    FAILURE_CATEGORIES.PRECONDITION,
    "cleanup",
    "cleanup_row_not_test_premium_session"
  );
  const removedIds = await deleteSavedReportById(config, id);
'''
new_ids = '''const ids = Array.isArray(persistence.createdSavedReportIds)
  ? [...new Set(persistence.createdSavedReportIds)]
  : [];
requireCondition(ids.length > 0, FAILURE_CATEGORIES.PRECONDITION, "cleanup", "no_cleanup_ids");
requireCondition(
  ids.every((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)),
  FAILURE_CATEGORIES.PRECONDITION,
  "cleanup",
  "invalid_cleanup_id"
);

const records = Array.isArray(persistence.records) ? persistence.records : [];
const recordById = new Map(
  records
    .filter((record) => record && typeof record.savedReportId === "string")
    .map((record) => [record.savedReportId, record])
);
if (persistence.evidenceQuarantined !== true) {
  requireCondition(
    recordById.size === ids.length && ids.every((id) => recordById.has(id)),
    FAILURE_CATEGORIES.PRECONDITION,
    "cleanup",
    "cleanup_artifact_record_mismatch"
  );
}

const deleted = [];
for (const id of ids) {
  const existing = await fetchSavedReportById(config, id);
  requireCondition(existing?.user_id === user.id, FAILURE_CATEGORIES.AUTH, "cleanup", "cleanup_row_owner_mismatch");
  requireCondition(
    existing?.report_type === "premium" && existing?.source_type === "premium_report_session",
    FAILURE_CATEGORIES.PRECONDITION,
    "cleanup",
    "cleanup_row_not_test_premium_session"
  );
  const record = recordById.get(id) || null;
  if (record) {
    requireCondition(record.sourceType === existing.source_type, FAILURE_CATEGORIES.PRECONDITION, "cleanup", "cleanup_source_type_mismatch");
    requireCondition(
      record.sourceSessionHash === hashIdentifier(existing.source_session_id),
      FAILURE_CATEGORIES.PRECONDITION,
      "cleanup",
      "cleanup_source_session_mismatch"
    );
    requireCondition(record.createdAt === existing.created_at, FAILURE_CATEGORIES.PRECONDITION, "cleanup", "cleanup_created_at_mismatch");
    requireCondition(record.updatedAt === existing.updated_at, FAILURE_CATEGORIES.PRECONDITION, "cleanup", "cleanup_updated_at_mismatch");
  }
  const removedIds = await deleteSavedReportById(config, id);
'''
if cleanup.count(old_ids) != 1:
    raise SystemExit("cleanup evidence binding replacement mismatch")
cleanup = cleanup.replace(old_ids, new_ids, 1)
cleanup_path.write_text(cleanup, encoding="utf-8")

contract_path = root / "scripts/verify-premium-browser-journey-contract.mjs"
contract = contract_path.read_text(encoding="utf-8")
old_assertions = '''assert.match(runnerSource, /cookie-auth-boundary/);
assert.match(runnerSource, /responses:\s*\[\]/);
assert.match(runnerSource, /artifact_quarantine_scan_failed/);
assert.match(cleanupSource, /production_cleanup_not_confirmed/);
assert.match(coreSource, /report_type=eq\.premium&source_type=eq\.premium_report_session/);'''
new_assertions = '''assert.match(runnerSource, /cookie-auth-boundary/);
assert.match(runnerSource, /cross-account-saved-report/);
assert.match(runnerSource, /cross_account_saved_report_not_rejected/);
assert.match(runnerSource, /responses:\s*\[\]/);
assert.match(runnerSource, /artifact_quarantine_scan_failed/);
assert.match(cleanupSource, /validateEnvironmentGuard/);
assert.match(cleanupSource, /cleanup_environment_mismatch/);
assert.match(cleanupSource, /cleanup_artifact_record_mismatch/);
assert.match(cleanupSource, /cleanup_source_session_mismatch/);
assert.match(coreSource, /report_type=eq\.premium&source_type=eq\.premium_report_session/);'''
if contract.count(old_assertions) != 1:
    raise SystemExit("contract post-review assertion replacement mismatch")
contract = contract.replace(old_assertions, new_assertions, 1)
contract_path.write_text(contract, encoding="utf-8")

docs_path = root / "docs/verification/premium-authenticated-browser-journey-v1.md"
docs = docs_path.read_text(encoding="utf-8")
old_step = "15. Optionally verify mismatched Cookie and Bearer users fail closed."
new_step = "15. Optionally verify mismatched Cookie and Bearer users fail closed and a second account cannot reopen the first account's saved report."
if docs.count(old_step) != 1:
    raise SystemExit("docs cross-account step replacement mismatch")
docs = docs.replace(old_step, new_step, 1)
old_cleanup = "It records the result in `cleanup-result.json`. Production cleanup additionally requires the production-write confirmation used by the runtime verifier."
new_cleanup = "It records the result in `cleanup-result.json`. Cleanup revalidates the current environment, target host, expected deployment SHA, account, report type, source-session evidence, and recorded timestamps. Production cleanup additionally requires the production-write confirmation used by the runtime verifier."
if docs.count(old_cleanup) != 1:
    raise SystemExit("docs cleanup replacement mismatch")
docs = docs.replace(old_cleanup, new_cleanup, 1)
docs_path.write_text(docs, encoding="utf-8")

log_path = root / ".codex/work-logs/2026-07-17-premium-browser-journey-verification.md"
log = log_path.read_text(encoding="utf-8").rstrip()
log += '''
- Post-integration review added a direct second-account bearer-only attempt to reopen the first account's saved report; this complements, rather than substitutes for, the mixed Cookie/Bearer principal-conflict check.
- Cleanup now revalidates the current environment, exact host, expected deployment SHA, account identity, and non-quarantined artifact evidence before deleting owner-scoped Premium session rows.
'''
log_path.write_text(log.rstrip() + "\n", encoding="utf-8")
