#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

const [dashboardSource, cardSource, saveReportSource, migrationSource] = await Promise.all([
  read("lib/my/dashboard.js"),
  read("components/my/SkinProfileSummaryCard.jsx"),
  read("app/api/my/save-report/route.js"),
  read("supabase/migrations/20260520170737_add_revisit_core_tables.sql")
]);

// Dashboard must expose only the authenticated user's current active profile.
assert.match(dashboardSource, /\.from\("skin_profiles"\)/);
assert.match(dashboardSource, /\.eq\("user_id", user\.id\)/);
assert.match(dashboardSource, /\.eq\("is_active", true\)/);
assert.match(dashboardSource, /\.order\("created_at", \{ ascending: false \}\)/);
assert.match(dashboardSource, /"created_at"/);

// Baseline UI must present the current baseline and its analysis creation date.
assert.match(cardSource, /현재 기준 피부 프로필/);
assert.match(cardSource, /Current Skin Baseline/);
assert.match(cardSource, /현재 기준/);
assert.match(cardSource, /Current baseline/);
assert.match(cardSource, /profile\?\.created_at/);
assert.match(cardSource, /formatBaselineDate/);
assert.match(cardSource, /copy\.profile\.analysisDate/);
assert.match(cardSource, /새 분석으로 갱신/);
assert.match(cardSource, /Refresh with a new analysis/);
assert.match(cardSource, /href=\{copy\.paths\.home\}/);
assert.match(cardSource, /기존 분석 기록은 그대로 유지됩니다/);
assert.match(cardSource, /keeping your previous analysis history/);
assert.match(cardSource, /sm:w-auto/);

// MY-4 must not introduce arbitrary manual profile editing controls.
assert.doesNotMatch(cardSource, /<textarea\b/i);
assert.doesNotMatch(cardSource, /<input\b/i);
assert.doesNotMatch(cardSource, /contentEditable/i);
assert.doesNotMatch(cardSource, /method=["'](?:post|put|patch)["']/i);

// Saving a new analysis must rotate the active baseline rather than mutate it in place.
assert.match(saveReportSource, /const previousActiveProfileId = previousActiveProfiles\?\.\[0\]\?\.id \|\| null/);
assert.match(saveReportSource, /\.from\("skin_profiles"\)[\s\S]*?\.update\(\{ is_active: false \}\)[\s\S]*?\.eq\("user_id", user\.id\)[\s\S]*?\.eq\("is_active", true\)/);
assert.match(saveReportSource, /is_active: true/);
assert.match(saveReportSource, /\.from\("skin_profiles"\)[\s\S]*?\.insert\(skinProfilePayload\)/);
assert.match(saveReportSource, /restorePreviousActiveProfile/);
assert.match(saveReportSource, /\.update\(\{ is_active: true \}\)[\s\S]*?\.eq\("id", previousActiveProfileId\)[\s\S]*?\.eq\("user_id", userId\)/);

// Existing DB authority must enforce one active profile per user and own-row access.
assert.match(migrationSource, /idx_skin_profiles_single_active/);
assert.match(migrationSource, /where is_active = true/);
assert.match(migrationSource, /skin_profiles_authenticated_select_own/);
assert.match(migrationSource, /using \(auth\.uid\(\) = user_id\)/);

console.log("MY SKIN PROFILE BASELINE VERIFIER: PASS");
