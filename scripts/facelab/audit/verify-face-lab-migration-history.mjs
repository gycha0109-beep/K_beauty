#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  FACE_LAB_MIGRATION_RECONCILER_VERSION,
  reconcileFaceLabMigrationInventories,
  migrationReconciliationCsv,
  migrationReconciliationMarkdown
} from "./migration-reconciliation-core.mjs";

const sha = "f".repeat(64);
const repository = [
  { filename: "20260101000000_initial_baseline.sql", sha256: sha },
  { filename: "20260102000000_face_lab_privilege.sql", sha256: sha },
  { filename: "20260103000000_admin_audit.sql", sha256: sha },
  { filename: "20260104000000_catalog_rework.sql", sha256: sha },
  { filename: "20260105000000_repo_unique.sql", sha256: sha },
  { filename: "20260106000000_standalone.sql", sha256: sha }
];
const hosted = [
  { version: "20260101000000", name: "initial_baseline" },
  { version: "20260102000000", name: "face_lab_privilege_renamed" },
  { version: "20260103000000", name: "admin_audit" },
  { version: "20260202000000", name: "catalog-rework" },
  { version: "20260205000000", name: "hosted_unique" },
  { version: "20260206000000", name: "other" }
];
let passed = 0;
function test(name, fn) {
  fn();
  passed++;
}
function reconcile(repo = repository, remote = hosted) {
  return reconcileFaceLabMigrationInventories({
    repository: structuredClone(repo),
    hosted: structuredClone(remote)
  });
}
test("inventory counts and immutable HOLD", () => {
  const r = reconcile();
  assert.equal(r.toolVersion, FACE_LAB_MIGRATION_RECONCILER_VERSION);
  assert.equal(r.inventoryStatus, "complete");
  assert.equal(r.productionReadiness, "HOLD");
  assert.equal(r.projectIdentityVerified, false);
  assert.equal(r.appliedSqlVerified, false);
  assert.equal(r.databaseAccess, false);
  assert.equal(r.networkAccess, false);
  assert.equal(r.migrationExecuted, false);
  assert.deepEqual({
    repo: r.counts.repository, hosted: r.counts.hosted,
    matched: r.counts.version_matched, repoOnly: r.counts.repo_only,
    hostedOnly: r.counts.hosted_only, exact: r.counts.exact_version_and_name,
    drift: r.counts.version_match_name_drift, candidates: r.counts.unique_name_candidates,
    rows: r.counts.rows
  }, {
    repo: 6, hosted: 6, matched: 3, repoOnly: 3,
    hostedOnly: 3, exact: 2, drift: 1, candidates: 1, rows: 9
  });
});
test("matched version with renamed description stays unverified", () => {
  const r = reconcile();
  const row = r.rows.find(x => x.repo_version === "20260102000000");
  assert.equal(row.classification, "version_match_name_drift");
  assert.equal(row.object_status, "not_checked");
  assert.equal(row.decision, "HOLD");
  assert.equal(row.affects_face_lab_or_privileges, "high_review_required");
});
test("unique same-name reversion is only candidate and counted twice", () => {
  const r = reconcile();
  const a = r.rows.find(x => x.repo_version === "20260104000000");
  const b = r.rows.find(x => x.hosted_version === "20260202000000");
  assert.equal(a.classification, "renamed_or_reversioned_candidate");
  assert.equal(b.classification, "renamed_or_reversioned_candidate");
  assert.equal(a.name_candidate, b.hosted_version);
  assert.equal(b.name_candidate, a.repo_version);
  assert.equal(r.counts.repo_only, 3);
  assert.equal(r.counts.hosted_only, 3);
});
test("candidate ambiguity cannot be auto matched", () => {
  const dupNameRepo = [
    ...repository,
    { filename: "20260107000000_catalog_rework.sql", sha256: sha }
  ];
  const r = reconcile(dupNameRepo, hosted);
  assert.equal(r.counts.unique_name_candidates, 0);
  const candidate = r.rows.find(x => x.repo_version === "20260104000000");
  assert.equal(candidate.classification, "repo_only_unresolved");
});
test("order independent report", () => {
  const a = reconcile();
  const b = reconcile([...repository].reverse(), [...hosted].reverse());
  assert.deepEqual(a, b);
  assert.equal(migrationReconciliationCsv(a), migrationReconciliationCsv(b));
  assert.equal(migrationReconciliationMarkdown(a), migrationReconciliationMarkdown(b));
});
test("empty inventories are valid inventory but never production ready", () => {
  const r = reconcile([], []);
  assert.equal(r.counts.rows, 0);
  assert.equal(r.productionReadiness, "HOLD");
});
test("reject duplicate repository versions", () => {
  assert.throws(() => reconcile([...repository,
    { filename: "20260102000000_different.sql" }
  ]), /migration_inventory_repo_duplicate_version/);
});
test("reject duplicate hosted versions", () => {
  assert.throws(() => reconcile(repository, [...hosted,
    { version: hosted[0].version, name: "same_version" }
  ]), /migration_inventory_hosted_duplicate_version/);
});
test("reject malformed names, path traversal and versions", () => {
  assert.throws(() => reconcile([
    { filename: "../20260101000000_escape.sql" }
  ]), /migration_inventory_repo_filename_invalid/);
  assert.throws(() => reconcile(repository, [
    { version: "2026011", name: "invalid" }
  ]), /migration_inventory_hosted_entry_invalid/);
  assert.throws(() => reconcile(repository, [
    { version: "20260101000000", name: "../outside" }
  ]), /migration_inventory_hosted_entry_invalid/);
});
test("reject fake content digests and invalid lists", () => {
  assert.throws(() => reconcile([
    { filename: "20260101000000_a.sql", sha256: "im-not-sha" }
  ]), /migration_inventory_repo_sha_invalid/);
  assert.throws(() => reconcile(null, hosted),
    /migration_inventory_repo_list_invalid/);
  assert.throws(() => reconcile(repository, null),
    /migration_inventory_hosted_list_invalid/);
});
test("CSV and markdown do not assert production safety", () => {
  const csv = migrationReconciliationCsv(reconcile());
  const md = migrationReconciliationMarkdown(reconcile());
  assert.ok(csv.startsWith("repo_version,repo_name,repo_sql_sha256"));
  assert.equal(csv.trim().split("\n").length, 10);
  assert.match(md, /HOLD/);
  assert.match(md, /not SQL-execution proofs/);
  assert.doesNotMatch(md, /productionReadiness: PASS/);
});
test("CLI only accesses local files, generates reports with HOLD", () => {
  const tmp = mkdtempSync(join(tmpdir(), "facelab-migration-"));
  try {
    const dir = join(tmp, "migrations"), out = join(tmp, "report");
    mkdirSync(dir);
    writeFileSync(join(dir, "20260101000000_initial_baseline.sql"), "select 1;");
    writeFileSync(join(dir, "20260104000000_catalog_rework.sql"), "select 2;");
    const input = join(tmp, "hosted-list.json");
    writeFileSync(input, JSON.stringify({ migrations: hosted }));
    const cli = fileURLToPath(new URL("./compare-face-lab-migration-history.mjs", import.meta.url));
    const result = spawnSync(process.execPath, [
      cli, "--repo-dir", dir, "--hosted-list", input, "--out-dir", out
    ], { encoding: "utf8", timeout: 12000 });
    assert.equal(result.status, 0, result.stderr);
    const parsed = JSON.parse(result.stdout.trim());
    assert.equal(parsed.productionReadiness, "HOLD");
    assert.equal(parsed.counts.repository, 2);
    assert.equal(parsed.counts.hosted, 6);
    const summary = JSON.parse(
      readFileSync(join(out, "migration-reconciliation-summary.json"), "utf8")
    );
    assert.equal(summary.projectIdentityVerified, false);
    assert.equal(summary.appliedSqlVerified, false);
    const csv = readFileSync(join(out, "migration-reconciliation.csv"), "utf8");
    assert.match(csv, /20260104000000/);
    assert.match(csv, /[a-f0-9]{64}/);
    const md = readFileSync(join(out, "migration-reconciliation-review.md"), "utf8");
    assert.match(md, /Production/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
test("invalid CLI manifest aborts before creating reports", () => {
  const tmp = mkdtempSync(join(tmpdir(), "facelab-invalid-"));
  try {
    const dir = join(tmp, "sql"), out = join(tmp, "report");
    mkdirSync(dir);
    writeFileSync(join(dir, "20260101000000_one.sql"), "select 1;");
    const input = join(tmp, "bad.json");
    writeFileSync(input, JSON.stringify({ migrations: [
      { version: "20260101000000", name: "one" },
      { version: "20260101000000", name: "other" }
    ] }));
    const cli = fileURLToPath(new URL("./compare-face-lab-migration-history.mjs", import.meta.url));
    const proc = spawnSync(process.execPath, [
      cli, "--repo-dir", dir, "--hosted-list", input, "--out-dir", out
    ], { encoding: "utf8", timeout: 12000 });
    assert.equal(proc.status, 2);
    assert.match(proc.stderr, /migration_inventory_hosted_duplicate_version/);
    assert.equal(existsSync(out), false);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
test("the audited source and tools cannot reach databases", () => {
  for (const relative of [
    "./migration-reconciliation-core.mjs",
    "./compare-face-lab-migration-history.mjs"
  ]) {
    const source = readFileSync(new URL(relative, import.meta.url), "utf8");
    for (const forbidden of [
      "supabase-js", "execute_sql", "apply_migration",
      "pg.Pool", "fetch(", "https.request", "createClient(",
      "execSync(", "DATABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"
    ]) assert.ok(!source.includes(forbidden), relative + ": " + forbidden);
  }
});

console.log(JSON.stringify({
  status: "PASS",
  cases: passed,
  fixtureRepository: repository.length,
  fixtureHosted: hosted.length,
  providerCalls: 0,
  databaseCalls: 0,
  appliedMigrations: 0,
  productionReadiness: "HOLD"
}));
