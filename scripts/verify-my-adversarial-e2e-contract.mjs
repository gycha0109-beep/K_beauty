#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function includes(source, needle, label) {
  assert.ok(source.includes(needle), `${label}: missing ${JSON.stringify(needle)}`);
}

function syntaxCheck(relativePath) {
  const result = spawnSync(process.execPath, ["--check", relativePath], {
    cwd: root,
    encoding: "utf8"
  });
  assert.equal(result.status, 0, `${relativePath} syntax failed: ${result.stderr || result.stdout}`);
}

const runner = read("scripts/run-my-adversarial-e2e.mjs");
const launcher = read("scripts/run-my-adversarial-e2e-local.mjs");
const rlsProbe = read("scripts/run-my-rls-adversarial-probe.mjs");
const checkinRoute = read("app/api/my/check-in/route.js");
const packageJson = JSON.parse(read("package.json"));
const health = read("scripts/verify-current-main-health.mjs");
const revisitMigration = read("supabase/migrations/20260520170737_add_revisit_core_tables.sql");

syntaxCheck("scripts/run-my-adversarial-e2e.mjs");
syntaxCheck("scripts/run-my-adversarial-e2e-local.mjs");
syntaxCheck("scripts/run-my-rls-adversarial-probe.mjs");
syntaxCheck("scripts/verify-my-adversarial-e2e-contract.mjs");

// The runtime must use real browser sessions and two distinct permanent accounts.
includes(runner, 'import { chromium } from "playwright";', "Playwright runtime");
includes(runner, "two_access_tokens_required", "two-account token precondition");
includes(runner, "accounts_must_be_distinct", "two-account principal isolation");
includes(runner, "two_storage_states_required", "cookie-backed browser sessions");
includes(runner, "DEDICATED_ACCOUNT_CONFIRMATION", "dedicated account guard");
includes(runner, "validateEnvironmentGuard", "deployment/environment guard");
includes(runner, "MY_E2E_ALLOW_PRODUCTION", "explicit Production write confirmation boundary");
assert.doesNotMatch(runner, /SERVICE_ROLE|service_role|SUPABASE_SERVICE/i, "E2E must not depend on service-role authority");
assert.doesNotMatch(rlsProbe, /SERVICE_ROLE|service_role|SUPABASE_SERVICE/i, "RLS attack probe must use user authority only");

// Security and bug scenarios are required, not optional comments.
for (const scenario of [
  "anonymous-boundaries",
  "csrf-signout-cross-origin",
  "authenticated-input-fuzz",
  "checkin-create-and-truncate",
  "checkin-concurrency-upsert",
  "historical-routine-immutability",
  "saved-history-metadata-boundary",
  "cross-account-app-isolation",
  "cross-account-rls-select-update-delete",
  "forged-user-id-insert-denied",
  "my-ui-xss-account-locale",
  "cleanup-fixtures",
  "logout-session-boundary"
]) includes(runner, `"${scenario}"`, `runtime scenario ${scenario}`);

// Input abuse corpus must include path/script/date/range and unsupported payload probes.
for (const probe of [
  "../../etc/passwd",
  "<script>alert(1)</script>",
  "invalid_local_date",
  "invalid_diary_month",
  "invalid_saved_report_history_query",
  "invalid_json",
  "premiumReport",
  "ATTACKER_OVERWRITE"
]) includes(runner, probe, `adversarial probe ${probe}`);

// API level fields are an explicit JSON-number contract: do not accept coercible strings from direct callers.
includes(checkinRoute, 'typeof value !== "number"', "strict level JSON type boundary");
includes(checkinRoute, "Number.isInteger(value)", "integer level boundary");
assert.doesNotMatch(checkinRoute, /const level = Number\(value\)/, "check-in level validation must not coerce strings");
includes(runner, 'breakout_level: "2"', "numeric-string abuse probe");

// Persistence safety: fixtures are exact-ID tracked, cleaned, and the prior active baseline is restored.
includes(runner, "fixtureIds", "fixture ID tracking");
includes(runner, "cleanupFixtures", "cleanup implementation");
includes(runner, "previousActiveProfileIds", "prior baseline tracking");
includes(runner, "previous_active_profile_restore_failed", "prior baseline restore verification");
includes(runner, "fixture_cleanup_incomplete", "post-cleanup readback");
includes(runner, 'query: { ...query, select: "id" }', "exact-row delete readback");

// RLS attacks must use the attacker token directly against PostgREST, then verify owner data remains unchanged.
includes(runner, 'restRequest(accessTokenB, "saved_reports"', "foreign update attack");
includes(runner, 'restRequest(accessTokenB, "daily_checkins"', "foreign delete/insert attack");
includes(runner, "rls_foreign_select_allowed", "foreign select denial assertion");
includes(runner, "owner_report_mutated_by_foreign_user", "owner mutation readback");
includes(runner, "owner_checkin_deleted_by_foreign_user", "owner delete readback");

// The collision-free forged-owner probe must not allow a uniqueness error to masquerade as RLS enforcement.
includes(rlsProbe, 'rest(accessTokenB, "saved_reports"', "collision-free forged owner insert");
includes(rlsProbe, "user_id: userA.id", "forged owner target");
includes(rlsProbe, "forged_owner_insert_allowed", "forged insert fail-closed assertion");
includes(rlsProbe, "[401, 403].includes(forgedInsert.status)", "RLS-only denial statuses");
assert.doesNotMatch(rlsProbe, /409/, "collision-free RLS probe must not accept uniqueness conflicts");
includes(rlsProbe, "forged_owner_row_persisted", "owner readback after attack");
includes(launcher, "run-my-rls-adversarial-probe.mjs", "launcher collision-free RLS preflight");
includes(launcher, "collision_free_forged_owner_probe_failed", "launcher requires RLS probe pass");

// Stored XSS is checked in a real rendered My page, not only by string sanitization.
includes(runner, "window.__MY_E2E_XSS", "stored XSS sentinel");
includes(runner, 'page.goto(appUrl("/my")', "KO My browser page");
includes(runner, 'page.goto(appUrl("/en/my")', "EN My browser page");
includes(runner, 'a[href="/en/my"]', "KO-to-EN My navigation");
includes(runner, 'a[href="/my"]', "EN-to-KO My navigation");

// Logout is a real UI action followed by an authenticated API readback.
includes(runner, 'getByRole("button", { name: /sign out/i })', "logout UI action");
includes(runner, "session_still_authenticated_after_logout", "post-logout API boundary");

// Launcher reuses the already-authoritative premium two-account cookie capture rather than inventing a second auth mechanism.
includes(launcher, "captureAccountSessionResilient", "shared auth capture");
includes(launcher, "assertAccountPair", "shared account-pair assertion");
includes(launcher, "loadBootstrapMetadata", "bootstrap identity pin");
includes(launcher, "assertGitWorktreeClean", "clean exact-head guard");
includes(launcher, "resolveExpectedSha", "exact deployment SHA guard");
includes(launcher, "LOCAL_PROFILE_A_PATH", "shared profile A path");
includes(launcher, "LOCAL_PROFILE_B_PATH", "shared profile B path");
includes(launcher, "verify-my-adversarial-e2e-contract.mjs", "launcher preflight verifier");

// Database authority: current Supabase migration must keep unique same-day rows and own-row RLS on all My persistence tables.
for (const contract of [
  "daily_checkins_user_id_checkin_date_key unique (user_id, checkin_date)",
  "routine_logs_user_id_routine_date_key unique (user_id, routine_date)",
  "idx_skin_profiles_single_active",
  'create policy "skin_profiles_authenticated_select_own"',
  'create policy "saved_reports_authenticated_select_own"',
  'create policy "daily_checkins_authenticated_select_own"',
  'create policy "routine_logs_authenticated_select_own"',
  'create policy "saved_reports_authenticated_delete_own"',
  'create policy "daily_checkins_authenticated_delete_own"'
]) includes(revisitMigration, contract, `Supabase authority ${contract}`);

assert.equal(packageJson.scripts["verify:my-adversarial-e2e-contract"], "node scripts/verify-my-adversarial-e2e-contract.mjs");
assert.equal(packageJson.scripts["e2e:my:login"], "node scripts/bootstrap-premium-e2e-auth.mjs");
assert.equal(packageJson.scripts["e2e:my:hosted"], "node scripts/run-my-adversarial-e2e-local.mjs");
includes(
  health,
  'run("My adversarial E2E harness contract", node, ["--experimental-default-type=module", "scripts/verify-my-adversarial-e2e-contract.mjs"]);',
  "canonical Current Main Health integration"
);

console.log("MY ADVERSARIAL E2E CONTRACT: PASS");
