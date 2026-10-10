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
  assessFaceLabCatalogEvidence,
  faceLabCatalogEvidenceMarkdown
} from "./catalog-evidence-evaluator-core.mjs";
import {
  inspectCandidateMigrationDifferences,
  candidateMigrationDiagnosticMarkdown,
  candidateMigrationDiagnosticCsv
} from "./candidate-migration-differences-core.mjs";
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
test("candidate-only diagnostic preserves 20260824 duplicate and name aliases", () => {
  const r=inspectCandidateMigrationDifferences({
    repository:[
      {filename:"20260824_add_product_localized_names.sql",sha256:sha},
      {filename:"20260824_backfill_product_english_display_names.sql",sha256:sha},
      {filename:"20261001010000_face_lab_test_quota_partition_v1.sql",sha256:sha},
      {filename:"20261002020000_exact.sql",sha256:sha}
    ],
    hosted:[
      {version:"20260824123819",name:"add_product_localized_names"},
      {version:"20261001095555",name:"face_lab_test_quota_partition_v1"},
      {version:"20261002020000",name:"exact"}
    ]
  });
  assert.equal(r.status,"HOLD");
  assert.equal(r.scope,"hosted_candidate_unverified");
  assert.equal(r.projectIdentityConfirmed,false);
  assert.equal(r.productionReconciliationComplete,false);
  assert.equal(r.databaseCalls,0);
  assert.equal(r.databaseWrites,0);
  assert.equal(r.sqlExecuted,false);
  assert.equal(r.counts.repositoryFiles,4);
  assert.equal(r.counts.hostedHistoryRecords,3);
  assert.equal(r.counts.directVersionCandidates,1);
  assert.equal(r.counts.repositoryWithoutDirectVersion,3);
  assert.equal(r.counts.hostedWithoutDirectVersion,2);
  assert.equal(r.counts.uniqueNameOnlyCandidates,2);
  assert.equal(r.counts.remainingRepoWithoutUniqueName,1);
  assert.equal(r.counts.remainingHostedWithoutUniqueName,0);
  assert.equal(r.counts.duplicateRepositoryVersionGroups,1);
  assert.equal(r.counts.outputRows,6);
  assert.equal(r.collisionGroups[0].version,"20260824");
  assert.ok(!r.rows.some(x=>x.executionVerified));
  assert.ok(r.rows.some(x=>x.name==="backfill_product_english_display_names" &&
    x.classification==="duplicate_repository_version"));
  assert.match(candidateMigrationDiagnosticMarkdown(r),/20260824/);
});
test("candidate-only diagnostic deterministic across input order", () => {
  const repository=[
    {filename:"20260824_a.sql",sha256:sha},
    {filename:"20260824_b.sql",sha256:sha},
    {filename:"20261001000000_c.sql",sha256:sha}
  ];
  const hosted=[{version:"20260824120000",name:"a"},
    {version:"20261001000000",name:"c"}];
  const a=inspectCandidateMigrationDifferences({repository,hosted});
  const b=inspectCandidateMigrationDifferences({
    repository:[...repository].reverse(),hosted:[...hosted].reverse()
  });
  assert.deepEqual(a,b);
  assert.equal(a.counts.repositoryFiles,
    a.counts.directVersionCandidates+a.counts.repositoryWithoutDirectVersion);
  assert.equal(a.counts.hostedHistoryRecords,
    a.counts.directVersionCandidates+a.counts.hostedWithoutDirectVersion);
});
test("candidate-only diagnostic refuses ambiguous name mapping", () => {
  const r=inspectCandidateMigrationDifferences({
    repository:[{filename:"20260824_a.sql",sha256:sha}],
    hosted:[
      {version:"20260824123456",name:"a"},
      {version:"20260824125555",name:"a"}
    ]
  });
  assert.equal(r.counts.ambiguousNameGroups,1);
  assert.equal(r.counts.uniqueNameOnlyCandidates,0);
  assert.equal(r.rows.length,3);
  assert.equal(r.rows.filter(x=>x.classification==="ambiguous_name_candidate").length,3);
});
test("candidate-only diagnostic rejects duplicates, unsafe names and empty lists", () => {
  assert.throws(()=>inspectCandidateMigrationDifferences({
    repository:[],hosted:[]}),/invalid_inventory/);
  assert.throws(()=>inspectCandidateMigrationDifferences({
    repository:[{filename:"20260824_a.sql",sha256:sha},
      {filename:"20260824_a.sql",sha256:sha}],
    hosted:[{version:"20260824123456",name:"a"}]
  }),/invalid_repository_entry/);
  assert.throws(()=>inspectCandidateMigrationDifferences({
    repository:[{filename:"20260824_a.sql",sha256:sha}],
    hosted:[{version:"20260824123456",name:"a"},
      {version:"20260824123456",name:"b"}]
  }),/hosted_duplicate_version/);
  assert.throws(()=>inspectCandidateMigrationDifferences({
    repository:[{filename:"../../etc/passwd",sha256:sha}],
    hosted:[{version:"20260824123456",name:"a"}]
  }),/invalid_repository_entry/);
});
test("candidate-only CLI yields stable HOLD with zero network or DB calls", () => {
  const temp=mkdtempSync(join(tmpdir(),"facelab-candidates-"));
  try {
    const dir=join(temp,"sql"),out=join(temp,"out"),input=join(temp,"hosted.json");
    mkdirSync(dir);
    writeFileSync(join(dir,"20260824_add.sql"),"select 1;");
    writeFileSync(join(dir,"20260824_backfill.sql"),"select 2;");
    writeFileSync(input,JSON.stringify({migrations:[
      {version:"20260824123819",name:"add"}
    ]}));
    const cli=fileURLToPath(new URL(
      "./inspect-face-lab-migration-candidates.mjs",import.meta.url));
    const arguments_=[cli,"--repo-dir",dir,"--hosted-list",input,"--out-dir",out];
    const run=spawnSync(process.execPath,arguments_,{
      encoding:"utf8",timeout:12000
    });
    assert.equal(run.status,0,run.stderr);
    const parsed=JSON.parse(readFileSync(join(out,
      "candidate-migration-diagnostic.json"),"utf8"));
    assert.equal(parsed.status,"HOLD");
    assert.equal(parsed.counts.duplicateRepositoryVersionGroups,1);
    assert.equal(parsed.counts.uniqueNameOnlyCandidates,1);
    assert.equal(parsed.databaseCalls,0);
    assert.equal(parsed.databaseWrites,0);
    const md=readFileSync(join(out,
      "candidate-migration-diagnostic.md"),"utf8");
    assert.match(md,/HOLD/);
    const csv=readFileSync(join(out,"candidate-migration-diagnostic.csv"),"utf8");
    assert.equal(csv.trimEnd().split("\n").length,parsed.rows.length+1);
    const run2=spawnSync(process.execPath,arguments_,{
      encoding:"utf8",timeout:12000
    });
    assert.equal(run2.status,0,run2.stderr);
    assert.equal(readFileSync(join(out,
      "candidate-migration-diagnostic.md"),"utf8"),md);
  } finally {rmSync(temp,{recursive:true,force:true});}
});
test("candidate-only CSV preserves rows and neutralizes spreadsheet formulas", () => {
  const r=inspectCandidateMigrationDifferences({
    repository:[{filename:"20260824_a.sql",sha256:sha},
      {filename:"20260824_b.sql",sha256:sha}],
    hosted:[{version:"20260824123456",name:"a"}]
  });
  const first=candidateMigrationDiagnosticCsv(r);
  assert.equal(first.trimEnd().split("\n").length,r.rows.length+1);
  assert.match(first,/duplicate_repository_version/);
  r.rows[0].name="=HYPERLINK(\"test\")";
  const escaped=candidateMigrationDiagnosticCsv(r);
  assert.ok(escaped.includes("'=HYPERLINK("));
  assert.ok(!escaped.includes('"=HYPERLINK('));
  assert.throws(()=>candidateMigrationDiagnosticCsv({}),/invalid_report/);
});
test("frozen 2026-10-10 candidate metadata reproduces all 143/171 records", () => {
  const snapshot=JSON.parse(readFileSync(new URL(
    "./fixtures/candidate-migration-metadata-20261010.json",import.meta.url),"utf8"));
  assert.equal(snapshot.sourceKind,"candidate_supabase_not_verified_production");
  assert.equal(snapshot.projectIdentityConfirmed,false);
  assert.equal(snapshot.appliedSqlVerified,false);
  assert.equal(snapshot.productionReconciliationComplete,false);
  assert.equal(snapshot.nonSecretMetadataOnly,true);
  assert.equal(snapshot.repositoryCommit,"4715f25de103aaae882a7fed387838b5d2c75000");
  assert.equal(snapshot.repository.length,143);
  assert.equal(snapshot.hosted.length,171);
  const result=inspectCandidateMigrationDifferences({
    repository:snapshot.repository,
    hosted:snapshot.hosted
  });
  assert.equal(result.status,"HOLD");
  assert.equal(result.scope,"hosted_candidate_unverified");
  assert.equal(result.counts.repositoryFiles,143);
  assert.equal(result.counts.repositoryUniqueVersions,142);
  assert.equal(result.counts.hostedHistoryRecords,171);
  assert.equal(result.counts.hostedUniqueVersions,171);
  assert.equal(result.counts.directVersionCandidates,101);
  assert.equal(result.counts.repositoryWithoutDirectVersion,42);
  assert.equal(result.counts.hostedWithoutDirectVersion,70);
  assert.equal(result.counts.uniqueNameOnlyCandidates,37);
  assert.equal(result.counts.remainingRepoWithoutUniqueName,5);
  assert.equal(result.counts.remainingHostedWithoutUniqueName,33);
  assert.equal(result.counts.duplicateRepositoryVersionGroups,1);
  assert.equal(result.counts.outputRows,213);
  assert.ok(result.uniqueNameOnlyCandidates.some(x=>
    x.name==="face_lab_test_quota_partition_v1"&&
    x.hostedVersion==="20260930133304"));
  assert.ok(result.collisionGroups.some(x=>x.version==="20260824"&&x.files.length===2));
  assert.ok(result.rows.every(x=>x.executionVerified===false));
  assert.equal(result.databaseCalls,0);
  assert.equal(result.databaseWrites,0);
  assert.equal(result.networkCalls,0);
  const csv=candidateMigrationDiagnosticCsv(result);
  assert.equal(csv.trimEnd().split("\n").length,214);
});
test("Face Lab catalog evidence SQL is read-only and scoped", () => {
  const sql=readFileSync(new URL(
    "./sql/face-lab-v2-catalog-readonly-v1.sql",import.meta.url),"utf8");
  const statements=sql.replace(/^--[^\n]*$/gm,"").split(";")
    .map(x=>x.trim()).filter(Boolean);
  assert.equal(statements.length,5);
  assert.equal(statements[0],"BEGIN TRANSACTION READ ONLY");
  assert.equal(statements[1],"SET LOCAL statement_timeout = '3s'");
  assert.equal(statements[2],"SET LOCAL lock_timeout = '500ms'");
  assert.match(statements[3],/^WITH\b/i);
  assert.match(statements[3],/AS face_lab_metadata_json$/);
  assert.equal(statements[4],"COMMIT");
  const query=statements[3].replace(/'(?:''|[^'])*'/g,"''");
  assert.doesNotMatch(query,/\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE|GRANT|REVOKE|CALL|PERFORM|EXECUTE|COPY)\b/i);
  assert.doesNotMatch(query,/\b(?:FROM|JOIN)\s+public\./i);
  for(const expected of [
    "saved_reports","analysis_request_rate_windows","analysis_request_idempotency",
    "face_lab_revision","consume_analysis_rate_limits","refund_analysis_rate_limits",
    "claim_analysis_idempotency","has_table_privilege","has_function_privilege",
    "has_schema_privilege","pg_catalog.pg_policy","pg_catalog.pg_constraint",
    "pg_catalog.pg_get_functiondef","pg_catalog.sha256",
    "'production_readiness','HOLD'",
    "'production_project_identity_verified',false",
    "'sql_application_verified',false"
  ]) assert.ok(sql.includes(expected),"missing catalog probe contract "+expected);
  assert.ok(!sql.includes("SUPABASE_SERVICE_ROLE_KEY"));
  assert.ok(!sql.includes("DATABASE_URL"));
});
function syntheticCatalogEvidence(){
  const rolePerms=()=>({
    anon:{select:false,insert:false,update:false,delete:false},
    authenticated:{select:false,insert:false,update:false,delete:false},
    service_role:{select:true,insert:true,update:true,delete:true}
  });
  return {
    kind:"face_lab_v2_catalog_metadata_readonly_v1",
    production_project_identity_verified:false,sql_application_verified:false,
    production_readiness:"HOLD",
    schema_public_usage:{anon:true,authenticated:true,service_role:true},
    table_metadata:[
      {name:"saved_reports",exists:true,relkind:"r",rls_enabled:true,
       rls_forced:false,policy_count:2,table_privileges:rolePerms()},
      ...["analysis_request_rate_windows","analysis_request_idempotency"]
        .map(name=>({name,exists:true,relkind:"r",rls_enabled:true,
          rls_forced:false,policy_count:0,table_privileges:rolePerms()}))
    ],
    column_metadata:[
      {table:"saved_reports",name:"face_lab_revision",exists:true,
       data_type:"bigint",not_null:true,default_expression:"0"},
      ...["analysis_request_rate_windows","analysis_request_idempotency"]
        .map(table=>({table,name:"endpoint",exists:true,
          data_type:"text",not_null:true,default_expression:null}))
    ],
    constraint_metadata:[
      {table:"saved_reports",name:"saved_reports_face_lab_revision_nonnegative",
       exists:true,constraint_type:"c",validated:true,
       definition:"CHECK ((face_lab_revision >= 0))"},
      {table:"analysis_request_rate_windows",
       name:"analysis_request_rate_windows_endpoint_check",
       exists:true,constraint_type:"c",validated:true,
       definition:"CHECK (endpoint IN ('face-reading-test','face-lab-simulation-test'))"},
      {table:"analysis_request_idempotency",
       name:"analysis_request_idempotency_endpoint_check",
       exists:true,constraint_type:"c",validated:true,
       definition:"CHECK (endpoint IN ('face-lab-simulation-test'))"}
    ],
    routine_metadata:[
      ["consume_analysis_rate_limits","public.consume_analysis_rate_limits(jsonb)"],
      ["refund_analysis_rate_limits","public.refund_analysis_rate_limits(jsonb)"],
      ["claim_analysis_idempotency",
       "public.claim_analysis_idempotency(text,text,text,text,text,timestamptz,integer)"]
    ].map(([routine_name,signature])=>({
      routine_name,signature,exists:true,security_definer:false,volatility:"v",
      definition_sha256:"a".repeat(64),
      function_execute_privileges:{
        anon_execute:false,authenticated_execute:false,service_role_execute:true
      }
    }))
  };
}
test("catalog readback neutral synthetic metadata remains HOLD despite no findings", () => {
  const r=assessFaceLabCatalogEvidence(syntheticCatalogEvidence());
  assert.equal(r.status,"HOLD");
  assert.equal(r.productionIdentityConfirmed,false);
  assert.equal(r.appliedSqlVerified,false);
  assert.equal(r.authorizationVerified,false);
  assert.equal(r.databaseCalls,0);
  assert.equal(r.databaseWrites,0);
  assert.equal(r.counts.totalFindings,0);
  assert.equal(r.counts.expectedTables,3);
  assert.equal(r.counts.expectedColumns,3);
  assert.equal(r.counts.expectedConstraints,3);
  assert.equal(r.counts.expectedRoutines,3);
  assert.match(faceLabCatalogEvidenceMarkdown(r),/HOLD/);
});
test("catalog readback flags missing metadata without false-positive approval", () => {
  const input=syntheticCatalogEvidence();
  input.table_metadata.splice(0,1);
  input.column_metadata.splice(0,1);
  input.constraint_metadata.splice(0,1);
  input.routine_metadata.splice(0,1);
  const r=assessFaceLabCatalogEvidence(input);
  assert.equal(r.status,"HOLD");
  for(const code of ["table_metadata_missing","column_metadata_missing",
    "constraint_metadata_missing","routine_metadata_missing"])
    assert.ok(r.findings.some(x=>x.code===code));
  assert.equal(r.counts.evidenceGaps,4);
});
test("catalog readback flags RLS, ACL, function-security and token regression", () => {
  const input=syntheticCatalogEvidence();
  input.table_metadata[1].rls_enabled=false;
  input.table_metadata[1].table_privileges.anon.insert=true;
  input.constraint_metadata[1].definition="CHECK (endpoint = 'analyze')";
  input.routine_metadata[0].security_definer=true;
  input.routine_metadata[0].function_execute_privileges.authenticated_execute=true;
  input.routine_metadata[1].function_execute_privileges.service_role_execute=false;
  const r=assessFaceLabCatalogEvidence(input);
  assert.equal(r.status,"HOLD");
  for(const code of ["rls_not_enabled","request_guard_table_access_exposed",
    "expected_constraint_token_missing","routine_security_invoker_unconfirmed",
    "routine_executable_by_untrusted_role","routine_service_role_execute_missing"])
    assert.ok(r.findings.some(x=>x.code===code),code);
  assert.ok(r.counts.priority>=6);
  assert.equal(r.networkCalls,0);
});
test("catalog readback fails closed on invalid scope or duplicates", () => {
  const input=syntheticCatalogEvidence();
  input.production_project_identity_verified=true;
  assert.throws(()=>assessFaceLabCatalogEvidence(input),/header_invalid/);
  const other=syntheticCatalogEvidence();
  other.routine_metadata.push(structuredClone(other.routine_metadata[0]));
  assert.throws(()=>assessFaceLabCatalogEvidence(other),/duplicate_or_invalid_entry/);
  const third=syntheticCatalogEvidence();
  third.routine_metadata=undefined;
  assert.throws(()=>assessFaceLabCatalogEvidence(third),/collection_invalid/);
});
test("catalog evidence CLI is offline, deterministic, and produces HOLD", () => {
  const dir=mkdtempSync(join(tmpdir(),"facelab-evidence-"));
  try {
    const input=join(dir,"evidence.json"),out=join(dir,"out");
    writeFileSync(input,JSON.stringify({
      face_lab_metadata_json:syntheticCatalogEvidence()
    }));
    const cli=fileURLToPath(new URL(
      "./evaluate-face-lab-catalog-evidence.mjs",import.meta.url));
    const args=[cli,"--evidence-json",input,"--out-dir",out];
    const run=spawnSync(process.execPath,args,{encoding:"utf8",timeout:12000});
    assert.equal(run.status,0,run.stderr);
    const a=readFileSync(join(out,"face-lab-catalog-evidence-review.json"),"utf8");
    const m=readFileSync(join(out,"face-lab-catalog-evidence-review.md"),"utf8");
    assert.equal(JSON.parse(a).status,"HOLD");
    assert.match(m,/manual|HOLD/i);
    const again=spawnSync(process.execPath,args,{encoding:"utf8",timeout:12000});
    assert.equal(again.status,0,again.stderr);
    assert.equal(readFileSync(join(out,"face-lab-catalog-evidence-review.json"),"utf8"),a);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
test("the audited source and tools cannot reach databases", () => {
  for (const relative of [
    "./migration-reconciliation-core.mjs",
    "./compare-face-lab-migration-history.mjs",
    "./candidate-migration-differences-core.mjs",
    "./inspect-face-lab-migration-candidates.mjs",
    "./catalog-evidence-evaluator-core.mjs",
    "./evaluate-face-lab-catalog-evidence.mjs"
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
