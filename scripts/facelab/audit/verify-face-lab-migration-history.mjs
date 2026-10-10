#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  inspectFaceLabMigrationInventory,
  migrationInventoryPreflightMarkdown
} from "./inspect-face-lab-migration-inventory.mjs";
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
  assert.equal(candidate.classification, "ambiguous_candidate");
  assert.equal(candidate.candidate_matches, "20260202000000");
  const remote = r.rows.find(x => x.hosted_version === "20260202000000");
  assert.equal(remote.classification, "ambiguous_candidate");
  assert.equal(remote.candidate_matches, "20260104000000|20260107000000");
});
test("order independent report", () => {
  const a = reconcile();
  const b = reconcile([...repository].reverse(), [...hosted].reverse());
  assert.deepEqual(a, b);
  assert.equal(migrationReconciliationCsv(a), migrationReconciliationCsv(b));
  assert.equal(migrationReconciliationMarkdown(a), migrationReconciliationMarkdown(b));
});
test("empty or partial inventories fail closed", () => {
  assert.throws(() => reconcile([], []), /repo_list_invalid/);
  assert.throws(() => reconcile([], hosted), /repo_list_invalid/);
  assert.throws(() => reconcile(repository, []), /hosted_list_invalid/);
});
test("strict timestamps and explicit historical compatibility", () => {
  const a = [{ filename: "20260410_old_style.sql", sha256: sha }];
  const b = [{ version: "20260410", name: "old_style" }];
  assert.throws(() => reconcileFaceLabMigrationInventories({repository:a,hosted:b}), /repo_filename_invalid/);
  const r = reconcileFaceLabMigrationInventories({repository:a,hosted:b}, {allowLegacyDates:true});
  assert.equal(r.counts.exact_version_and_name, 1);
  assert.equal(r.projectIdentityConfirmed, false);
  assert.equal(r.productionReadiness, "HOLD");
  assert.throws(() => reconcileFaceLabMigrationInventories({repository:a,hosted:b},
    {allowLegacyDates:"true"}), /input_invalid/);
});
test("legacy day-version collisions remain blocked even with opt-in", () => {
  assert.throws(() => reconcileFaceLabMigrationInventories({
    repository: [
      {filename:"20260824_add_product_localized_names.sql",sha256:sha},
      {filename:"20260824_backfill_product_english_display_names.sql",sha256:sha}
    ],
    hosted: [{version:"20260824",name:"add_product_localized_names"}]
  }, {allowLegacyDates:true}), /repo_duplicate_version/);
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
test("CSV neutralizes potentially executable spreadsheet values", () => {
  const r = reconcile();
  r.rows = [{
    ...r.rows[0], repo_name: "\t=2+2",
    hosted_name: "+cmd|'/C calc'!A0", notes: "@SUM(1,1)"
  }];
  const csv = migrationReconciliationCsv(r);
  assert.match(csv, /\'\s+=2\+2/);
  assert.ok(csv.includes("'+cmd"));
  assert.ok(csv.includes("'@SUM"));
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
    assert.equal(summary.databaseWrites, 0);
    assert.equal(summary.projectIdentityConfirmed, false);
    assert.equal(summary.productionReconciliationComplete, false);
    assert.equal(summary.status, "HOLD");
    const csv = readFileSync(join(out, "migration-reconciliation.csv"), "utf8");
    assert.match(csv, /20260104000000/);
    assert.match(csv, /[a-f0-9]{64}/);
    const md = readFileSync(join(out, "migration-reconciliation-review.md"), "utf8");
    assert.match(md, /Production/);
    const outputs = ["migration-reconciliation.csv",
      "migration-reconciliation-review.md","migration-reconciliation-summary.json"];
    const before = outputs.map(file => readFileSync(join(out,file),"utf8"));
    const repeat = spawnSync(process.execPath, [
      cli,"--repo-dir",dir,"--hosted-list",input,"--out-dir",out
    ],{encoding:"utf8",timeout:12000});
    assert.equal(repeat.status,0,repeat.stderr);
    assert.deepEqual(outputs.map(file => readFileSync(join(out,file),"utf8")),before);
    writeFileSync(join(dir,"20260101000000_initial_baseline.sql"),"select 99;");
    const changed = spawnSync(process.execPath, [
      cli,"--repo-dir",dir,"--hosted-list",input,"--out-dir",out
    ],{encoding:"utf8",timeout:12000});
    assert.equal(changed.status,0,changed.stderr);
    const updatedCsv=readFileSync(join(out,"migration-reconciliation.csv"),"utf8");
    assert.notEqual(updatedCsv,csv);
    assert.ok(updatedCsv.includes(createHash("sha256").update("select 99;").digest("hex")));
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
test("CLI rejects unexpected files and malformed JSON", () => {
  const tmp = mkdtempSync(join(tmpdir(), "facelab-files-"));
  try {
    const dir = join(tmp, "sql"), out = join(tmp, "out"), input = join(tmp, "hosted.json");
    mkdirSync(dir);
    writeFileSync(join(dir, "20260101000000_a.sql"), "select 1;");
    writeFileSync(input, "{malformed");
    const cli = fileURLToPath(new URL("./compare-face-lab-migration-history.mjs", import.meta.url));
    const args = [cli, "--repo-dir", dir, "--hosted-list", input, "--out-dir", out];
    let result = spawnSync(process.execPath, args, {encoding:"utf8",timeout:12000});
    assert.equal(result.status, 2);
    assert.equal(existsSync(out), false);
    writeFileSync(input, JSON.stringify({migrations:[{version:"20260101000000",name:"a"}]}));
    writeFileSync(join(dir, "notes.txt"), "unexpected");
    result = spawnSync(process.execPath, args, {encoding:"utf8",timeout:12000});
    assert.equal(result.status, 2);
    assert.match(result.stderr, /repo_filename_invalid/);
    assert.equal(existsSync(out), false);
  } finally { rmSync(tmp, {recursive:true,force:true}); }
});
test("CLI opt-in permits historical 8-digit migration names", () => {
  const tmp = mkdtempSync(join(tmpdir(), "facelab-legacy-"));
  try {
    const dir = join(tmp, "sql"), out = join(tmp, "out"), input = join(tmp, "hosted.json");
    mkdirSync(dir);
    writeFileSync(join(dir, "20260410_legacy.sql"), "select 1;");
    writeFileSync(input, JSON.stringify({migrations:[{version:"20260410",name:"legacy"}]}));
    const cli = fileURLToPath(new URL("./compare-face-lab-migration-history.mjs", import.meta.url));
    const args = [cli, "--repo-dir", dir, "--hosted-list", input, "--out-dir", out];
    let result = spawnSync(process.execPath, args, {encoding:"utf8",timeout:12000});
    assert.equal(result.status, 2);
    assert.equal(existsSync(out), false);
    result = spawnSync(process.execPath, [
      ...args, "--allow-legacy-date-versions", "--git-commit", "a".repeat(40),
      "--snapshot-at", "2026-10-10T09:00:00Z"
    ], {encoding:"utf8",timeout:12000});
    assert.equal(result.status, 0, result.stderr);
    const summary = JSON.parse(readFileSync(join(out, "migration-reconciliation-summary.json"), "utf8"));
    assert.equal(summary.counts.repository, 1);
    assert.equal(summary.counts.exact_version_and_name, 1);
    assert.equal(summary.legacyDateVersionsAllowed, true);
    assert.equal(summary.status, "HOLD");
    assert.match(readFileSync(join(out, "migration-reconciliation-review.md"), "utf8"),
      /2026-10-10T09:00:00Z/);
  } finally { rmSync(tmp, {recursive:true,force:true}); }
});
test("repository preflight classifies legacy timestamps and duplicate groups", () => {
  const r = inspectFaceLabMigrationInventory([
    {filename:"20260824_backfill.sql",sha256:sha},
    {filename:"20260824_add_columns.sql",sha256:sha},
    {filename:"20261010090000_unique.sql",sha256:sha}
  ]);
  assert.equal(r.status,"HOLD");
  assert.equal(r.projectIdentityConfirmed,false);
  assert.equal(r.hostedHistoryCompared,false);
  assert.equal(r.databaseCalls,0);
  assert.equal(r.databaseWrites,0);
  assert.equal(r.networkCalls,0);
  assert.equal(r.counts.repositoryEntries,3);
  assert.equal(r.counts.timestamp14Files,1);
  assert.equal(r.counts.legacyDate8Files,2);
  assert.equal(r.counts.duplicateVersionGroups,1);
  assert.equal(r.counts.duplicateVersionFileCount,2);
  assert.equal(r.inventoryReconciliationEligible,false);
  assert.equal(r.duplicateVersions[0].version,"20260824");
  assert.deepEqual(r.duplicateVersions[0].files.map(x=>x.filename),
    ["20260824_add_columns.sql","20260824_backfill.sql"]);
  assert.match(migrationInventoryPreflightMarkdown(r),/20260824/);
});
test("repository preflight is order-independent and conserves input count", () => {
  const list = [
    {filename:"20260101000000_a.sql",sha256:sha},
    {filename:"bad_file.sql",sha256:sha},
    {filename:"20260101_legacy.sql",sha256:sha}
  ];
  const a=inspectFaceLabMigrationInventory(list);
  const b=inspectFaceLabMigrationInventory([...list].reverse());
  assert.deepEqual(a,b);
  assert.equal(a.counts.invalidFileCount,1);
  assert.equal(a.counts.validSqlFiles+a.counts.invalidFileCount,
    a.counts.repositoryEntries);
  assert.equal(a.invalidFilenameDiagnostic,
    "unexpected_file_names_present_names_redacted");
  assert.ok(!JSON.stringify(a).includes("bad_file.sql"));
  assert.equal(a.inventoryReconciliationEligible,false);
});
test("repository preflight rejects malformed manifest or duplicate filename", () => {
  assert.throws(()=>inspectFaceLabMigrationInventory([]),/entries_invalid/);
  assert.throws(()=>inspectFaceLabMigrationInventory([
    {filename:"20260101000000_a.sql",sha256:"bad"}
  ]),/entry_invalid/);
  assert.throws(()=>inspectFaceLabMigrationInventory([
    {filename:"20260101000000_a.sql",sha256:sha},
    {filename:"20260101000000_a.sql",sha256:sha}
  ]),/duplicate_filename/);
});
test("repository preflight CLI only reads local SQL and reports HOLD", () => {
  const tmp=mkdtempSync(join(tmpdir(),"facelab-preflight-"));
  try {
    const dir=join(tmp,"sql"),out=join(tmp,"out");
    mkdirSync(dir);
    writeFileSync(join(dir,"20260824_one.sql"),"select 1;");
    writeFileSync(join(dir,"20260824_two.sql"),"select 2;");
    const cli=fileURLToPath(new URL(
      "./inspect-face-lab-migration-inventory.mjs",import.meta.url));
    const args=[cli,"--repo-dir",dir,"--out-dir",out];
    const run=spawnSync(process.execPath,args,{encoding:"utf8",timeout:12000});
    assert.equal(run.status,0,run.stderr);
    const summary=JSON.parse(readFileSync(join(out,
      "migration-inventory-preflight.json"),"utf8"));
    assert.equal(summary.status,"HOLD");
    assert.equal(summary.counts.duplicateVersionGroups,1);
    assert.equal(summary.databaseWrites,0);
    assert.equal(summary.hostedHistoryCompared,false);
    const md=readFileSync(join(out,"migration-inventory-preflight.md"),"utf8");
    assert.match(md,/20260824/);
    const repeat=spawnSync(process.execPath,args,{encoding:"utf8",timeout:12000});
    assert.equal(repeat.status,0,repeat.stderr);
    assert.equal(readFileSync(join(out,
      "migration-inventory-preflight.md"),"utf8"),md);
    writeFileSync(join(dir,"unexpected.txt"),"never execute");
    const check=spawnSync(process.execPath,args,{encoding:"utf8",timeout:12000});
    assert.equal(check.status,0,check.stderr);
    const again=JSON.parse(readFileSync(join(out,
      "migration-inventory-preflight.json"),"utf8"));
    assert.equal(again.counts.invalidFileCount,1);
    assert.equal(again.status,"HOLD");
    assert.ok(!JSON.stringify(again).includes("unexpected.txt"));
  } finally {rmSync(tmp,{recursive:true,force:true});}
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

const actualRepoPath = fileURLToPath(new URL("../../../supabase/migrations/", import.meta.url));
const preflightCli = fileURLToPath(new URL(
  "./inspect-face-lab-migration-inventory.mjs", import.meta.url));
const actualPreflight = spawnSync(process.execPath, [
  preflightCli, "--repo-dir", actualRepoPath
], {encoding:"utf8",timeout:12000});
assert.equal(actualPreflight.status, 0, actualPreflight.stderr);
const actualPreflightSummary = JSON.parse(actualPreflight.stdout);
assert.equal(actualPreflightSummary.status, "HOLD");
assert.ok(actualPreflightSummary.counts.repositoryEntries > 0);

console.log(JSON.stringify({
  status: "PASS",
  cases: passed,
  fixtureRepository: repository.length,
  fixtureHosted: hosted.length,
  providerCalls: 0,
  databaseCalls: 0,
  appliedMigrations: 0,
  productionReadiness: "HOLD",
  repositoryPreflight: actualPreflightSummary
}));
