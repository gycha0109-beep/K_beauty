import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const paths = {
  auth: resolve(root, "scripts/premium-browser-journey-local-auth.mjs"),
  bootstrap: resolve(root, "scripts/bootstrap-premium-e2e-auth.mjs"),
  systemBrowser: resolve(root, "scripts/premium-e2e-system-browser.mjs"),
  sessionCapture: resolve(root, "scripts/premium-e2e-session-capture.mjs"),
  sessionCookieDiagnostic: resolve(root, "scripts/diagnose-premium-session-cookie.mjs"),
  runtimeDiagnostic: resolve(root, "lib/premium-session-payload-diagnostics.js"),
  runner: resolve(root, "scripts/run-premium-browser-journey-local.mjs"),
  package: resolve(root, "package.json"),
  gitignore: resolve(root, ".gitignore")
};
const [
  authSource,
  bootstrapSource,
  systemBrowserSource,
  sessionCaptureSource,
  sessionCookieDiagnosticSource,
  runtimeDiagnosticSource,
  runnerSource,
  packageSource,
  gitignoreSource
] = await Promise.all([
  readFile(paths.auth, "utf8"),
  readFile(paths.bootstrap, "utf8"),
  readFile(paths.systemBrowser, "utf8"),
  readFile(paths.sessionCapture, "utf8"),
  readFile(paths.sessionCookieDiagnostic, "utf8"),
  readFile(paths.runtimeDiagnostic, "utf8"),
  readFile(paths.runner, "utf8"),
  readFile(paths.package, "utf8"),
  readFile(paths.gitignore, "utf8")
]);
const packageJson = JSON.parse(packageSource);

assert.equal(packageJson.scripts["e2e:premium:login"], "node scripts/bootstrap-premium-e2e-auth.mjs");
assert.equal(packageJson.scripts["e2e:premium:hosted"], "node scripts/run-premium-browser-journey-local.mjs");
assert.equal(packageJson.scripts["diagnose:premium:session-cookie"], "node scripts/diagnose-premium-session-cookie.mjs");
assert.equal(packageJson.scripts["verify:premium-session-runtime-diagnostics"], "node scripts/verify-premium-session-runtime-diagnostics.mjs");
assert.equal(packageJson.scripts["check:premium-browser-journey-local"], "node scripts/check-premium-browser-journey-local.mjs");
assert.match(gitignoreSource, /^\.codex\/runtime\/premium-e2e\/$/m);

assert.match(authSource, /launchPersistentContext/);
assert.match(authSource, /\/auth\/v1\/user/);
assert.match(authSource, /test_account_must_use_google/);
assert.match(authSource, /test_accounts_must_be_distinct/);
assert.match(authSource, /inspectStorageState/);
assert.match(authSource, /local_runner_preview_only/);
assert.match(authSource, /git_worktree_not_clean/);
assert.match(authSource, /restrictLocalPath/);
assert.match(authSource, /resetLocalAuthProfiles/);
assert.match(authSource, /context\.request\.get/);
assert.match(authSource, /maxRedirects:\s*0/);
assert.match(authSource, /preview_navigation_left_target_origin/);
assert.doesNotMatch(authSource, /signInWithPassword/);
assert.doesNotMatch(authSource, /gmail\.com/i);
assert.doesNotMatch(authSource, /password/i);

assert.match(systemBrowserSource, /Google\/Chrome\/Application\/chrome\.exe/);
assert.match(systemBrowserSource, /PREMIUM_E2E_SYSTEM_CHROME/);
assert.match(systemBrowserSource, /--user-data-dir=/);
assert.match(systemBrowserSource, /--disable-background-mode/);
assert.match(systemBrowserSource, /Playwright가 Google 로그인 화면을 제어하지 않습니다/);
assert.doesNotMatch(systemBrowserSource, /remote-debugging/);

assert.match(sessionCaptureSource, /createServerClient/);
assert.match(sessionCaptureSource, /supabase\.auth\.getSession\(\)/);
assert.match(sessionCaptureSource, /discoverCanonicalOAuthHost/);
assert.match(sessionCaptureSource, /meta\[property="og:url"\]/);
assert.match(sessionCaptureSource, /PREMIUM_E2E_OAUTH_RETURN_HOST/);
assert.match(sessionCaptureSource, /bridgeCanonicalOAuthCookies/);
assert.match(sessionCaptureSource, /oauth_cookie_bridge_failed/);
assert.match(sessionCaptureSource, /OAuth 세션을 .*Preview 호스트로 로컬 복제했습니다/);
assert.match(
  sessionCaptureSource,
  /const targetCookies = await context\.cookies\(baseUrl\.origin\);[\s\S]*?for \(const cookie of targetCookies\.filter\(authCookie\)\) \{[\s\S]*?clearCookies\(\{ name: cookie\.name, domain: cookie\.domain \}\)/
);
assert.match(
  sessionCaptureSource,
  /const bridged = await bridgeCanonicalOAuthCookies\([\s\S]*?if \(bridged\) \{[\s\S]*?targetCookies = await context\.cookies\(baseUrl\.origin\);[\s\S]*?\}[\s\S]*?const targetAuthCookies/
);
assert.match(sessionCaptureSource, /normalizeTargetAuthCookies/);
assert.match(sessionCaptureSource, /target_host_auth_cookie_normalization_failed/);
assert.match(sessionCaptureSource, /domain:\s*baseUrl\.hostname/);
assert.match(sessionCaptureSource, /path:\s*"\/"/);
assert.match(sessionCaptureSource, /secure:\s*true/);
assert.match(sessionCaptureSource, /oauth_session_stored_on_different_host/);
assert.match(sessionCaptureSource, /target_host_auth_cookie_missing/);
assert.match(sessionCaptureSource, /supabase_public_config_missing_for_cookie_capture/);
assert.match(sessionCaptureSource, /captureAccountSessionResilient/);
assert.match(sessionCaptureSource, /NEXT_PUBLIC_SUPABASE_(?:PUBLISHABLE_KEY|ANON_KEY)/);
assert.doesNotMatch(sessionCaptureSource, /signInWithPassword/);

assert.match(sessionCookieDiagnosticSource, /headersArray\(\)/);
assert.match(sessionCookieDiagnosticSource, /server_did_not_emit_premium_cookie/);
assert.match(sessionCookieDiagnosticSource, /premium_set_cookie_not_stored/);
assert.match(sessionCookieDiagnosticSource, /premium_cookie_boundary_ok/);
assert.match(sessionCookieDiagnosticSource, /premiumReportExposed/);
assert.match(sessionCookieDiagnosticSource, /premiumHeaderCount/);
assert.match(sessionCookieDiagnosticSource, /premiumCookieCount/);
assert.match(sessionCookieDiagnosticSource, /PREMIUM_SESSION_DIAGNOSTIC_REQUEST_HEADER/);
assert.match(sessionCookieDiagnosticSource, /responseDiagnosticVersion/);
assert.match(sessionCookieDiagnosticSource, /responseRuntimeCommit/);
assert.match(sessionCookieDiagnosticSource, /responseFinalStage/);
assert.doesNotMatch(sessionCookieDiagnosticSource, /console\.log\([^\n]*(?:accessToken|cookie\.value|header\.value)/);

assert.match(runtimeDiagnosticSource, /VERCEL_ENV === "preview"/);
assert.match(runtimeDiagnosticSource, /MAX_MEASUREMENT_DEPTH/);
assert.match(runtimeDiagnosticSource, /MAX_MEASUREMENT_ENTRIES/);
assert.match(runtimeDiagnosticSource, /MAX_MEASUREMENT_BYTES/);
assert.doesNotMatch(runtimeDiagnosticSource, /(?:accessToken|refreshToken|cookieValue|reportBody|serviceRole)/);

assert.match(bootstrapSource, /openManualSystemChromeSession/);
assert.match(bootstrapSource, /captureAccountSessionResilient/);
assert.match(bootstrapSource, /기존 로그인 세션을 재사용합니다/);
assert.match(bootstrapSource, /Google 로그인은 Playwright가 아닌 일반 시스템 Chrome에서 수행합니다/);
assert.match(bootstrapSource, /비밀번호는 이 스크립트나 저장소에 입력하지 않습니다/);
assert.match(bootstrapSource, /saveBootstrapMetadata/);
assert.match(bootstrapSource, /assertGitWorktreeClean\(\)/);
assert.match(bootstrapSource, /reset-profiles/);

assert.match(runnerSource, /captureAccountSessionResilient/);
assert.match(runnerSource, /assertGitWorktreeClean\(\)/);
assert.match(runnerSource, /PREMIUM_E2E_CONFLICT_ACCESS_TOKEN/);
assert.match(runnerSource, /cleanup-premium-browser-journey\.mjs/);
assert.match(runnerSource, /DELETE_TEST_REPORTS_/);
assert.match(runnerSource, /CLEANUP_FAILURE/);
assert.match(runnerSource, /HOSTED_PREVIEW_PASS/);
assert.match(runnerSource, /preview_probe_left_target_origin/);
assert.match(runnerSource, /redirect:\s*"manual"/);
assert.doesNotMatch(runnerSource, /PREMIUM_E2E_ALLOW_PRODUCTION/);

console.log(JSON.stringify({
  ok: true,
  checks: [
    "manual_system_chrome_google_login",
    "persisted_cookie_session_recovery",
    "canonical_oauth_cookie_bridge",
    "target_host_auth_cookie_normalization",
    "redacted_premium_session_cookie_diagnostic",
    "preview_only_runtime_stage_attestation",
    "wrong_host_oauth_detection",
    "persistent_profile_reuse",
    "network_captured_supabase_session_fallback",
    "distinct_account_guard",
    "preview_only_guard",
    "hosted_runner_and_cleanup",
    "runtime_files_ignored"
  ]
}, null, 2));
