from pathlib import Path
import re
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else ".")

core_path = root / "scripts/premium-browser-journey-core.mjs"
core = core_path.read_text(encoding="utf-8")
core, count = re.subn(
    r"const FORBIDDEN_KEYS = new Set\(\[.*?\n\]\);",
    '''const FORBIDDEN_KEYS = new Set([
  "authorization",
  "accesstoken",
  "access_token",
  "premiumsessiontoken",
  "premium_session_token",
  "refreshtoken",
  "refresh_token",
  "sessionid",
  "session_id",
  "savedreportid",
  "saved_report_id",
  "token"
]);''',
    core,
    count=1,
    flags=re.DOTALL,
)
if count != 1:
    raise SystemExit("forbidden-key contract replacement failed")
core = core.replace(
    "!FORBIDDEN_KEYS.has(key)",
    "!FORBIDDEN_KEYS.has(String(key).toLowerCase())",
)

old_storage = '''export function inspectStorageState(storageState) {
  requireCondition(storageState && Array.isArray(storageState.cookies), FAILURE_CATEGORIES.PRECONDITION, "configuration", "invalid_storage_state");
  const authCookies = storageState.cookies.filter((cookie) => String(cookie?.name || "").includes("auth-token"));
  requireCondition(authCookies.length > 0, FAILURE_CATEGORIES.PRECONDITION, "configuration", "cookie_backed_auth_missing");
  return { authCookieCount: authCookies.length };
}'''
new_storage = '''function cookieMatchesHost(cookie, targetHost) {
  const domain = String(cookie?.domain || "").trim().replace(/^\\./, "").toLowerCase();
  const host = String(targetHost || "").trim().toLowerCase();
  return Boolean(domain && host && (host === domain || host.endsWith(`.${domain}`)));
}

export function inspectStorageState(storageState, targetHost) {
  requireCondition(storageState && Array.isArray(storageState.cookies), FAILURE_CATEGORIES.PRECONDITION, "configuration", "invalid_storage_state");
  requireCondition(targetHost, FAILURE_CATEGORIES.PRECONDITION, "configuration", "storage_state_target_host_missing");
  const authCookies = storageState.cookies.filter((cookie) =>
    String(cookie?.name || "").includes("auth-token") &&
    cookie?.secure === true &&
    String(cookie?.path || "/") === "/" &&
    cookieMatchesHost(cookie, targetHost)
  );
  requireCondition(authCookies.length > 0, FAILURE_CATEGORIES.PRECONDITION, "configuration", "target_host_cookie_backed_auth_missing");
  return { authCookieCount: authCookies.length, targetHost };
}'''
if core.count(old_storage) != 1:
    raise SystemExit("storage-state contract replacement failed")
core = core.replace(old_storage, new_storage, 1)

old_delete = 'path: `saved_reports?id=eq.${encodeURIComponent(id)}&select=id`'
new_delete = 'path: `saved_reports?id=eq.${encodeURIComponent(id)}&report_type=eq.premium&source_type=eq.premium_report_session&select=id`'
if core.count(old_delete) != 1:
    raise SystemExit("cleanup delete boundary replacement failed")
core = core.replace(old_delete, new_delete, 1)
core_path.write_text(core, encoding="utf-8")

runner_old_path = root / "scripts/verify-premium-browser-journey.mjs"
runner_path = root / "scripts/run-premium-browser-journey.mjs"
if runner_old_path.exists():
    runner_old_path.rename(runner_path)
if not runner_path.exists():
    raise SystemExit("runtime runner missing after rename")
runner = runner_path.read_text(encoding="utf-8")

old_storage_call = "const storageInspection = inspectStorageState(storageState);"
if runner.count(old_storage_call) != 1:
    raise SystemExit("storage-state call replacement failed")
runner = runner.replace(
    old_storage_call,
    "const storageInspection = inspectStorageState(storageState, baseUrl.hostname);",
    1,
)

old_auth_headers = '''function authHeaders(token = accessToken) {
  return { ...extraHTTPHeaders, Authorization: `Bearer ${token}` };
}'''
new_auth_headers = '''function authHeaders(token = accessToken) {
  return token
    ? { ...extraHTTPHeaders, Authorization: `Bearer ${token}` }
    : { ...extraHTTPHeaders };
}'''
if runner.count(old_auth_headers) != 1:
    raise SystemExit("auth header contract replacement failed")
runner = runner.replace(old_auth_headers, new_auth_headers, 1)

old_versions = '''  requireCondition(row.report_version === snapshot.reportVersion, FAILURE_CATEGORIES.PERSISTENCE, "persistence-read", "report_version_mismatch");
  requireCondition(new Set([snapshot.version, snapshot.reportVersion, snapshot.decisionBundleVersion]).size === 3, FAILURE_CATEGORIES.PERSISTENCE, "persistence-read", "version_contract_not_separated");'''
new_versions = '''  requireCondition(row.report_version === snapshot.reportVersion, FAILURE_CATEGORIES.PERSISTENCE, "persistence-read", "report_version_mismatch");
  const versions = [snapshot.version, snapshot.reportVersion, snapshot.decisionBundleVersion];
  requireCondition(
    versions.every((value) => typeof value === "string" && value.length > 0),
    FAILURE_CATEGORIES.PERSISTENCE,
    "persistence-read",
    "version_contract_missing"
  );
  requireCondition(new Set(versions).size === 3, FAILURE_CATEGORIES.PERSISTENCE, "persistence-read", "version_contract_not_separated");'''
if runner.count(old_versions) != 1:
    raise SystemExit("version contract replacement failed")
runner = runner.replace(old_versions, new_versions, 1)

cookie_anchor = "    persistenceRecords.push(buildPersistenceEvidence({ row: firstSaved.row, snapshot: firstSaved.snapshot, responseFingerprint: firstFingerprint }));\n"
cookie_step = '''
    await runStep(`${locale}:cookie-auth-boundary`, FAILURE_CATEGORIES.AUTH, async () => {
      const result = await requestJson(
        context,
        `${locale}:cookie-auth-boundary`,
        "/api/full-report",
        { method: "POST", data: { savedReportId: firstId, locale } },
        null
      );
      requireCondition(
        result.status === 200 && result.body?.meta?.source === "saved-report",
        FAILURE_CATEGORIES.AUTH,
        `${locale}:cookie-auth-boundary`,
        "cookie_backed_saved_report_access_failed"
      );
      assert.equal(result.body?.meta?.snapshot?.fingerprint, firstFingerprint);
      return result;
    });
'''
if runner.count(cookie_anchor) != 1:
    raise SystemExit("cookie-only auth insertion anchor mismatch")
runner = runner.replace(cookie_anchor, cookie_anchor + cookie_step, 1)

check_anchor = '  recordCheck("principal_conflict_checked", Boolean(conflictAccessToken), conflictAccessToken ? null : "optional_second_account_not_supplied");'
check_block = '''  recordCheck(
    "cookie_backed_auth_verified",
    steps.filter((step) => step.name.endsWith(":cookie-auth-boundary")).length === 2 &&
      steps.filter((step) => step.name.endsWith(":cookie-auth-boundary")).every((step) => step.status === "passed")
  );
  recordCheck("principal_conflict_checked", Boolean(conflictAccessToken), conflictAccessToken ? null : "optional_second_account_not_supplied");'''
if runner.count(check_anchor) != 1:
    raise SystemExit("cookie-only check insertion anchor mismatch")
runner = runner.replace(check_anchor, check_block, 1)

old_scan = '''  try {
    await scanArtifactDirectoryForSecrets(artifactDir, [accessToken, conflictAccessToken, previewBypassToken]);
  } catch (scanError) {
    finalError = scanError;
    verdict = { ...verdict, passed: false, failure: { category: scanError.category, step: scanError.step, code: scanError.code } };
    summary += "- Artifact secret scan: **FAIL**\\n";
    await writeArtifactSet({ artifactDir, manifest, steps, responses, persistence, verdict, summary });
  }'''
new_scan = '''  try {
    await scanArtifactDirectoryForSecrets(artifactDir, [accessToken, conflictAccessToken, previewBypassToken]);
  } catch (scanError) {
    finalError = scanError instanceof JourneyFailure
      ? scanError
      : new JourneyFailure(FAILURE_CATEGORIES.HARNESS, "artifact-secret-scan", "artifact_secret_scan_failed");
    verdict = {
      ...verdict,
      passed: false,
      failure: { category: finalError.category, step: finalError.step, code: finalError.code }
    };
    summary = `# Premium authenticated runtime journey\\n\\n- Run ID: \\`${runId}\\`\\n- Environment: \\`${environment}\\`\\n- Target host: \\`${baseUrl.hostname}\\`\\n- Result: **FAIL**\\n- Artifact secret scan: **FAIL; response evidence quarantined**\\n- Created test reports: ${createdSavedReportIds.length}\\n- Cleanup: ${createdSavedReportIds.length ? "required through the separate cleanup command" : "not required"}\\n`;
    const quarantinedPersistence = {
      createdSavedReportIds: [...new Set(createdSavedReportIds)],
      records: [],
      duplicateSourceTupleCount: persistence.duplicateSourceTupleCount,
      cleanupRequired: createdSavedReportIds.length > 0,
      evidenceQuarantined: true
    };
    await writeArtifactSet({
      artifactDir,
      manifest,
      steps,
      responses: [],
      persistence: quarantinedPersistence,
      verdict,
      summary
    });
    try {
      await scanArtifactDirectoryForSecrets(artifactDir, [accessToken, conflictAccessToken, previewBypassToken]);
    } catch {
      finalError = new JourneyFailure(
        FAILURE_CATEGORIES.HARNESS,
        "artifact-secret-scan",
        "artifact_quarantine_scan_failed"
      );
      verdict = {
        passed: false,
        failure: { category: finalError.category, step: finalError.step, code: finalError.code },
        checks: []
      };
      summary = `# Premium authenticated runtime journey\\n\\n- Run ID: \\`${runId}\\`\\n- Environment: \\`${environment}\\`\\n- Target host: \\`${baseUrl.hostname}\\`\\n- Result: **FAIL**\\n- Artifact quarantine rescan: **FAIL**\\n- Created test reports: ${createdSavedReportIds.length}\\n- Cleanup: ${createdSavedReportIds.length ? "required through the separate cleanup command" : "not required"}\\n`;
      await writeArtifactSet({
        artifactDir,
        manifest: {
          runId,
          environment,
          targetHost: baseUrl.hostname,
          accountHash,
          startedAt: startedAt.toISOString(),
          finishedAt: new Date().toISOString()
        },
        steps: [],
        responses: [],
        persistence: {
          createdSavedReportIds: [...new Set(createdSavedReportIds)],
          records: [],
          cleanupRequired: createdSavedReportIds.length > 0,
          evidenceQuarantined: true
        },
        verdict,
        summary
      });
    }
  }'''
if runner.count(old_scan) != 1:
    raise SystemExit("artifact quarantine replacement failed")
runner = runner.replace(old_scan, new_scan, 1)
runner_path.write_text(runner, encoding="utf-8")

cleanup_path = root / "scripts/cleanup-premium-browser-journey.mjs"
cleanup = cleanup_path.read_text(encoding="utf-8")
if cleanup.count("  FAILURE_CATEGORIES,\n") != 1:
    raise SystemExit("cleanup import anchor mismatch")
cleanup = cleanup.replace(
    "  FAILURE_CATEGORIES,\n",
    "  FAILURE_CATEGORIES,\n  PRODUCTION_CONFIRMATION,\n",
    1,
)
cleanup_anchor = 'requireCondition(manifest.targetHost === baseUrl.hostname, FAILURE_CATEGORIES.PRECONDITION, "cleanup", "cleanup_target_host_mismatch");\n'
cleanup_guard = '''requireCondition(
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
if cleanup.count(cleanup_anchor) != 1:
    raise SystemExit("cleanup production guard anchor mismatch")
cleanup = cleanup.replace(cleanup_anchor, cleanup_anchor + cleanup_guard, 1)
cleanup_path.write_text(cleanup, encoding="utf-8")

contract_path = root / "scripts/verify-premium-browser-journey-contract.mjs"
contract = contract_path.read_text(encoding="utf-8")
contract = contract.replace(
    'import assert from "node:assert/strict";\n',
    'import assert from "node:assert/strict";\nimport { mkdtemp, rm } from "node:fs/promises";\nimport { readFileSync } from "node:fs";\nimport { tmpdir } from "node:os";\nimport { join } from "node:path";\n',
    1,
)
contract = contract.replace(
    "  hashIdentifier,\n",
    "  hashIdentifier,\n  inspectStorageState,\n",
    1,
)
contract = contract.replace(
    "  validateEnvironmentGuard\n",
    "  scanArtifactDirectoryForSecrets,\n  validateEnvironmentGuard,\n  writeArtifactSet\n",
    1,
)
contract_append = '''
assert.deepEqual(
  inspectStorageState(
    { cookies: [{ name: "sb-project-auth-token", domain: "preview.example.test", path: "/", secure: true }] },
    "preview.example.test"
  ),
  { authCookieCount: 1, targetHost: "preview.example.test" }
);
assert.throws(
  () => inspectStorageState(
    { cookies: [{ name: "sb-project-auth-token", domain: "other.example.test", path: "/", secure: true }] },
    "preview.example.test"
  ),
  (error) => error instanceof JourneyFailure && error.code === "target_host_cookie_backed_auth_missing"
);
assert.throws(
  () => resolveConflictBody({ ACCESS_TOKEN: "forbidden" }, "ko"),
  (error) => error instanceof JourneyFailure && error.category === FAILURE_CATEGORIES.PRECONDITION
);

const artifactDir = await mkdtemp(join(tmpdir(), "premium-browser-contract-"));
try {
  await writeArtifactSet({
    artifactDir,
    manifest: { runId: "contract-run", targetHost: "preview.example.test" },
    steps: [],
    responses: [{ leaked: "contract-secret-value" }],
    persistence: { createdSavedReportIds: [] },
    verdict: { passed: false },
    summary: "contract"
  });
  await assert.rejects(
    () => scanArtifactDirectoryForSecrets(artifactDir, ["contract-secret-value"]),
    (error) => error instanceof JourneyFailure && error.code === "secret_material_detected_in_artifact"
  );
} finally {
  await rm(artifactDir, { recursive: true, force: true });
}

const runnerSource = readFileSync(new URL("./run-premium-browser-journey.mjs", import.meta.url), "utf8");
const cleanupSource = readFileSync(new URL("./cleanup-premium-browser-journey.mjs", import.meta.url), "utf8");
const coreSource = readFileSync(new URL("./premium-browser-journey-core.mjs", import.meta.url), "utf8");
const suiteSource = readFileSync(new URL("./run-security-closeout-verifier-suite.mjs", import.meta.url), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
assert.match(runnerSource, /cookie-auth-boundary/);
assert.match(runnerSource, /responses:\\s*\\[\\]/);
assert.match(runnerSource, /artifact_quarantine_scan_failed/);
assert.match(cleanupSource, /production_cleanup_not_confirmed/);
assert.match(coreSource, /report_type=eq\\.premium&source_type=eq\\.premium_report_session/);
assert.match(suiteSource, /verify-premium-browser-journey-contract\\.mjs/);
assert.equal(
  packageJson.scripts["verify:premium-browser-journey"],
  "node scripts/run-premium-browser-journey.mjs"
);
'''
marker = '\nconsole.log("premium browser journey contract verification passed");'
if contract.count(marker) != 1:
    raise SystemExit("contract verifier append marker mismatch")
contract = contract.replace(marker, "\n" + contract_append + marker, 1)
contract_path.write_text(contract, encoding="utf-8")

package_path = root / "package.json"
package = package_path.read_text(encoding="utf-8")
old_package_command = '"verify:premium-browser-journey": "node scripts/verify-premium-browser-journey.mjs"'
new_package_command = '"verify:premium-browser-journey": "node scripts/run-premium-browser-journey.mjs"'
if package.count(old_package_command) != 1:
    raise SystemExit("package runtime command replacement failed")
package = package.replace(old_package_command, new_package_command, 1)
package_path.write_text(package, encoding="utf-8")

suite_path = root / "scripts/run-security-closeout-verifier-suite.mjs"
suite = suite_path.read_text(encoding="utf-8")
entry = '  "verify-premium-browser-journey-contract.mjs",\n'
anchor = '  "verify-premium-decision-state.mjs",\n'
if entry not in suite:
    if suite.count(anchor) != 1:
        raise SystemExit("security suite manifest anchor mismatch")
    suite = suite.replace(anchor, entry + anchor, 1)
suite_path.write_text(suite, encoding="utf-8")

docs_path = root / "docs/verification/premium-authenticated-browser-journey-v1.md"
docs = docs_path.read_text(encoding="utf-8")
coverage_start = docs.index("## Mandatory coverage")
coverage_end = docs.index("## Fail-closed preconditions")
coverage = '''## Mandatory coverage

Both Korean and English journeys execute the following sequence:

1. Reject an unauthenticated Premium request.
2. Open the explicitly selected deployment.
3. Run authenticated `/api/analyze`.
4. Verify the Premium cookie contract.
5. Verify the current session is unsaved before the first save.
6. Save the first `/api/full-report` result.
7. Compare the response fingerprint with the RLS-readable database row.
8. Prove target-host Supabase cookies can reopen the saved report without an Authorization header.
9. Verify report, snapshot, and Decision Bundle version values are present and mutually distinct.
10. Retry the identical request and receive the same immutable report.
11. Reopen the saved report with opposite locale and Top Pick tampering.
12. Submit a mandatory meaningful conflict fixture and receive HTTP 409.
13. Verify the database row and `updated_at` remain unchanged.
14. Verify current-session saved-report discovery.
15. Optionally verify mismatched Cookie and Bearer users fail closed.
16. Rotate the Premium session without exposing identifiers.
17. Save a second report under a distinct source-session tuple.
18. Verify the first report remains unchanged.
19. Verify duplicate Premium source-session tuples are zero.
20. Write redacted evidence artifacts.

'''
docs = docs[:coverage_start] + coverage + docs[coverage_end:]
docs = docs.replace(
    "- cookie-backed Playwright storage state\n",
    "- cookie-backed Playwright storage state with secure auth cookies applicable to the exact target host\n",
    1,
)
docs = docs.replace(
    "A secret scan is mandatory.\n",
    "A secret scan is mandatory. If it detects secret material, response evidence is replaced with a minimal quarantine artifact set and scanned again.\n",
    1,
)
docs = docs.replace(
    "It records the result in `cleanup-result.json`.\n",
    "It records the result in `cleanup-result.json`. Production cleanup additionally requires the production-write confirmation used by the runtime verifier.\n",
    1,
)
docs = docs.replace(
    "PREMIUM_E2E_DEDICATED_ACCOUNT_CONFIRMATION\n```",
    "PREMIUM_E2E_DEDICATED_ACCOUNT_CONFIRMATION\n```\n\nOptional execution controls:\n\n```text\nPREMIUM_E2E_RUN_ID\nPREMIUM_E2E_ARTIFACT_ROOT\nPREMIUM_E2E_PREVIEW_BYPASS_TOKEN\nPREMIUM_E2E_HEADLESS\nPREMIUM_E2E_ALLOW_PRODUCTION\n```",
    1,
)
docs_path.write_text(docs, encoding="utf-8")

log_path = root / ".codex/work-logs/2026-07-17-premium-browser-journey-verification.md"
log = log_path.read_text(encoding="utf-8").rstrip()
log += '''
- Integration review found that the environment-dependent runtime runner matched the security closeout verifier discovery pattern; it was renamed to `run-premium-browser-journey.mjs`, while the pure contract verifier was registered in the fail-closed manifest.
- Added an actual cookie-only saved-report reopen so bearer success cannot mask unusable target-host auth cookies.
- Hardened target-host cookie preconditions, version presence checks, conflict-fixture control-key matching, production cleanup confirmation, narrowed cleanup deletion filters, and artifact secret-scan quarantine.
'''
log_path.write_text(log + "\n", encoding="utf-8")
