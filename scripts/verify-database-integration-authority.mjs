#!/usr/bin/env node

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  assertLocalShadowTestWorkdir,
  assertNonProductionSupabaseTarget
} from "./assert-non-production-supabase-target.mjs";

const ROOT = process.cwd();
const MIGRATION_DIR = path.join(ROOT, "supabase", "migrations");
const CONTRACT_PATH = path.join(ROOT, "docs", "ci", "database-integration-authority.json");
const contract = JSON.parse(readFileSync(CONTRACT_PATH, "utf8"));

const migrations = readdirSync(MIGRATION_DIR)
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((file) => {
    const match = file.match(/^(\d{8,14})_(.+)\.sql$/);
    assert.ok(match, `migration filename must be timestamp_name.sql: ${file}`);
    return { file, version: match[1], semanticName: match[2] };
  });

assert.equal(contract.contractVersion, "database-integration-authority-v1");
assert.equal(contract.scope, "repository-migration-authority-and-nonproduction-safety");
assert.equal(contract.productionObservation?.writeOperationsPerformed, false);
assert.equal(contract.productionObservation?.productionMigrationCount, 120);
assert.equal(contract.productionObservation?.repositoryMigrationCountAtAudit, 92);
assert.equal(contract.productionObservation?.directSemanticNameMatches, 89);
assert.equal(contract.productionObservation?.publicTableCount, 73);
assert.equal(contract.productionObservation?.rlsEnabledPublicTableCount, 73);
assert.deepEqual(contract.productionObservation?.rlsDisabledPublicTables, []);
assert.equal(contract.productionObservation?.fullRepositoryReplayReady, false);

assert.equal(new Set(migrations.map((item) => item.file)).size, migrations.length, "migration filenames must be unique");
assert.equal(new Set(migrations.map((item) => item.version)).size, migrations.length, "migration versions must be unique");
assert.equal(new Set(migrations.map((item) => item.semanticName)).size, migrations.length, "migration semantic names must be unique");
assert.ok(migrations.length >= contract.productionObservation.repositoryMigrationCountAtAudit, "repository migration inventory must not shrink below audited baseline");

const repoBySemanticName = new Map(migrations.map((item) => [item.semanticName, item]));

for (const entry of contract.canonicalRepositoryOnly || []) {
  assert.ok(repoBySemanticName.has(entry.semanticName), `canonical repository migration missing: ${entry.semanticName}`);
  assert.ok(typeof entry.reason === "string" && entry.reason.length >= 20, `repository-only rationale missing: ${entry.semanticName}`);
}

for (const [semanticName, repositoryVersion, productionVersion] of contract.sameSemanticNameDifferentTimestamp || []) {
  const local = repoBySemanticName.get(semanticName);
  assert.ok(local, `timestamp-drift migration missing from repository: ${semanticName}`);
  assert.equal(local.version, repositoryVersion, `repository timestamp drifted without authority update: ${semanticName}`);
  assert.notEqual(repositoryVersion, productionVersion, `timestamp divergence contract must describe an actual divergence: ${semanticName}`);
}

const historicalTaxonomy = contract.productionHistoricalOnly?.dataTaxonomy2GranularRollout || [];
assert.equal(historicalTaxonomy.length, 29, "DATA-TAXONOMY2 historical rollout inventory drift");
assert.equal(new Set(historicalTaxonomy).size, historicalTaxonomy.length, "DATA-TAXONOMY2 historical rollout names must be unique");
assert.ok(
  historicalTaxonomy.every((name) => name.startsWith("data_taxonomy2_")),
  "DATA-TAXONOMY2 historical rollout must stay explicitly scoped"
);

assert.equal(existsSync(path.join(ROOT, "supabase", "config.toml")), false, "root Supabase config appeared; promote Database Integration to an explicit reproducible local baseline before claiming replay readiness");
assert.equal(existsSync(path.join(ROOT, "supabase", "seed.sql")), false, "root seed appeared; Database Integration authority must be reviewed before changing replay readiness");
assert.equal(contract.replayBoundary?.rootSupabaseConfigTracked, false);
assert.equal(contract.replayBoundary?.rootSeedTracked, false);
assert.equal(contract.replayBoundary?.blankReplayClaimAllowed, false);
assert.equal(contract.replayBoundary?.canonicalDisposableLocalFixture, "supabase/local-shadow-test");

const localFixture = assertLocalShadowTestWorkdir({ root: ROOT });
assert.equal(localFixture.safeToRunLocalDatabaseCommands, true, "canonical disposable local Supabase fixture must remain safe");
assert.equal(localFixture.targetType, "loopback_disposable_local_shadow_test");

const missingTarget = assertNonProductionSupabaseTarget({ env: {}, root: ROOT });
assert.equal(missingTarget.safeToRunRoute, false);
assert.equal(missingTarget.productionBlocked, true);

const productionLikeTarget = assertNonProductionSupabaseTarget({
  env: { NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" },
  root: ROOT
});
assert.equal(productionLikeTarget.safeToRunRoute, false);
assert.equal(productionLikeTarget.productionBlocked, true);

const loopbackTarget = assertNonProductionSupabaseTarget({
  env: { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" },
  root: ROOT
});
assert.equal(loopbackTarget.safeToRunRoute, true);
assert.equal(loopbackTarget.productionBlocked, false);

const disposableHostedTarget = assertNonProductionSupabaseTarget({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: "https://disposable-preview.supabase.co",
    SHADOW_ROUTE_NON_PRODUCTION_TARGET: "1",
    SHADOW_TEST_DB_DISPOSABLE: "1",
    SUPABASE_ENVIRONMENT: "preview"
  },
  root: ROOT
});
assert.equal(disposableHostedTarget.safeToRunRoute, true);

const incompleteHostedAllowlist = assertNonProductionSupabaseTarget({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: "https://disposable-preview.supabase.co",
    SHADOW_ROUTE_NON_PRODUCTION_TARGET: "1",
    SUPABASE_ENVIRONMENT: "preview"
  },
  root: ROOT
});
assert.equal(incompleteHostedAllowlist.safeToRunRoute, false, "hosted non-production target requires the complete disposable allowlist");

const g3a = readFileSync(
  path.join(ROOT, "supabase", "migrations", "20260822083000_v21_admission_g3a_pf_authority_read_v1.sql"),
  "utf8"
);
assert.match(g3a, /G3A_RUNTIME_ROLE_BOOTSTRAP_REQUIRED/);
assert.match(g3a, /recommendation_admission_runtime/);
assert.match(g3a, /security definer/i);
assert.match(g3a, /set search_path = ''/i);

const taxonomyBase = readFileSync(
  path.join(ROOT, "supabase", "migrations", "20260913202500_data_taxonomy2_candidate_manual_classification_v1.sql"),
  "utf8"
);
const taxonomyAdoption = readFileSync(
  path.join(ROOT, "supabase", "migrations", "20260913210000_data_taxonomy2_production_adoption_reconcile_v1.sql"),
  "utf8"
);
const taxonomyEvidence = readFileSync(
  path.join(ROOT, "docs", "evidence", "data-taxonomy2-candidate-manual-classification-v1.md"),
  "utf8"
);

for (const table of [
  "catalog_taxonomy_candidate_source_rules",
  "product_candidate_catalog_taxonomy_classifications"
]) {
  assert.match(taxonomyBase, new RegExp(`create table public\\.${table}\\s*\\(`, "i"));
  assert.doesNotMatch(taxonomyAdoption, new RegExp(`create table public\\.${table}\\s*\\(`, "i"));
}
assert.match(taxonomyEvidence, /split-Production adoption reconciliation/i);
assert.match(taxonomyEvidence, /20260913210822\s+data_taxonomy2_production_adoption_reconcile_v1/);
assert.match(taxonomyEvidence, /Production migration applied:\s*`true`/);

for (const workflow of contract.preservedDistributedRuntimeOwners || []) {
  assert.ok(existsSync(path.join(ROOT, ".github", "workflows", workflow)), `distributed database runtime owner missing: ${workflow}`);
}

console.log(JSON.stringify({
  status: "PASS",
  contractVersion: contract.contractVersion,
  repositoryMigrations: migrations.length,
  auditedProductionMigrations: contract.productionObservation.productionMigrationCount,
  auditedPublicTables: contract.productionObservation.publicTableCount,
  auditedPublicTablesWithRls: contract.productionObservation.rlsEnabledPublicTableCount,
  fullRepositoryReplayReady: false,
  localDisposableFixture: localFixture.targetType,
  distributedRuntimeOwners: contract.preservedDistributedRuntimeOwners.length
}, null, 2));
