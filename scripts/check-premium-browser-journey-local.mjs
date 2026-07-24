import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const paths = {
  auth: resolve(root, "scripts/premium-browser-journey-local-auth.mjs"),
  bootstrap: resolve(root, "scripts/bootstrap-premium-e2e-auth.mjs"),
  runner: resolve(root, "scripts/run-premium-browser-journey-local.mjs"),
  package: resolve(root, "package.json"),
  gitignore: resolve(root, ".gitignore")
};
const [authSource, bootstrapSource, runnerSource, packageSource, gitignoreSource] = await Promise.all([
  readFile(paths.auth, "utf8"),
  readFile(paths.bootstrap, "utf8"),
  readFile(paths.runner, "utf8"),
  readFile(paths.package, "utf8"),
  readFile(paths.gitignore, "utf8")
]);
const packageJson = JSON.parse(packageSource);

assert.equal(packageJson.scripts["e2e:premium:login"], "node scripts/bootstrap-premium-e2e-auth.mjs");
assert.equal(packageJson.scripts["e2e:premium:hosted"], "node scripts/run-premium-browser-journey-local.mjs");
assert.equal(packageJson.scripts["check:premium-browser-journey-local"], "node scripts/check-premium-browser-journey-local.mjs");
assert.match(gitignoreSource, /^\.codex\/runtime\/premium-e2e\/$/m);

assert.match(authSource, /launchPersistentContext/);
assert.match(authSource, /\/auth\/v1\/user/);
assert.match(authSource, /test_account_must_use_google/);
assert.match(authSource, /test_accounts_must_be_distinct/);
assert.match(authSource, /inspectStorageState/);
assert.match(authSource, /local_runner_preview_only/);
assert.doesNotMatch(authSource, /signInWithPassword/);
assert.doesNotMatch(authSource, /gmail\.com/i);
assert.doesNotMatch(authSource, /password/i);

assert.match(bootstrapSource, /interactive:\s*true/);
assert.match(bootstrapSource, /비밀번호는 이 스크립트나 저장소에 입력하지 않습니다/);
assert.match(bootstrapSource, /saveBootstrapMetadata/);

assert.match(runnerSource, /interactive:\s*false/);
assert.match(runnerSource, /PREMIUM_E2E_CONFLICT_ACCESS_TOKEN/);
assert.match(runnerSource, /cleanup-premium-browser-journey\.mjs/);
assert.match(runnerSource, /DELETE_TEST_REPORTS_/);
assert.match(runnerSource, /CLEANUP_FAILURE/);
assert.match(runnerSource, /HOSTED_PREVIEW_PASS/);
assert.doesNotMatch(runnerSource, /PREMIUM_E2E_ALLOW_PRODUCTION/);

console.log(JSON.stringify({
  ok: true,
  checks: [
    "manual_google_login_only",
    "persistent_profile_reuse",
    "network_captured_supabase_session",
    "distinct_account_guard",
    "preview_only_guard",
    "hosted_runner_and_cleanup",
    "runtime_files_ignored"
  ]
}, null, 2));
