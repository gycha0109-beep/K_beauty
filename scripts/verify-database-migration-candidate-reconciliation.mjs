#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  inspectCandidateMigrationDifferences,
  candidateMigrationDiagnosticCsv,
  candidateMigrationDiagnosticMarkdown
} from "./database/audit/candidate-migration-differences-core.mjs";

const sha = "a".repeat(64);
const repository = [
  { filename: "20260101000000_stable.sql", sha256: sha },
  { filename: "20260102000000_renamed_at_repository.sql", sha256: sha },
  { filename: "20260824_add_product_localized_names.sql", sha256: sha },
  { filename: "20260824_backfill_product_english_display_names.sql", sha256: sha },
  { filename: "20260103000000_repo_only.sql", sha256: sha },
  { filename: "20260104000000_ambiguous.sql", sha256: sha }
];
const hosted = [
  { version: "20260101000000", name: "stable" },
  { version: "20260102000000", name: "different_title" },
  { version: "20260824120000", name: "add_product_localized_names" },
  { version: "20260824120001", name: "backfill_product_english_display_names" },
  { version: "20260105000000", name: "ambiguous" },
  { version: "20260106000000", name: "ambiguous" }
];
let checks = 0;
const checked = (label, fn) => {
  fn();
  checks++;
};

const subject = () => inspectCandidateMigrationDifferences({
  repository: structuredClone(repository),
  hosted: structuredClone(hosted)
});
checked("HOLD, no network or execution", () => {
  const r = subject();
  assert.equal(r.status, "HOLD");
  assert.equal(r.scope, "hosted_candidate_unverified");
  for (const key of ["projectIdentityConfirmed", "productionReconciliationComplete", "appliedSqlVerified", "sqlExecuted"]) {
    assert.equal(r[key], false, key);
  }
  for (const key of ["databaseCalls", "databaseWrites", "networkCalls"]) {
    assert.equal(r[key], 0, key);
  }
});

checked("Preserve duplicated repository legacy versions while candidate matching", () => {
  const r = subject();
  assert.deepEqual(r.counts, {
    versionNameDriftCandidates: 1,
    repositoryFiles: 6,
    repositoryUniqueVersions: 5,
    hostedHistoryRecords: 6,
    hostedUniqueVersions: 6,
    directVersionCandidates: 2,
    repositoryWithoutDirectVersion: 4,
    hostedWithoutDirectVersion: 4,
    uniqueNameOnlyCandidates: 2,
    remainingRepoWithoutUniqueName: 2,
    remainingHostedWithoutUniqueName: 2,
    ambiguousNameGroups: 1,
    duplicateRepositoryVersionGroups: 1,
    outputRows: 10
  });
  assert.equal(r.collisionGroups[0].version, "20260824");
  assert.equal(r.collisionGroups[0].files.length, 2);
  assert.equal(r.uniqueNameOnlyCandidates.length, 2);
  assert.ok(r.uniqueNameOnlyCandidates.every(x => x.evidence === "name_only" && x.appliedStatus === "unverified"));
  assert.equal(r.rows.filter(x => x.executionVerified).length, 0);
  assert.equal(r.rows.filter(x => x.classification === "duplicate_repository_version").length, 2);
});

checked("Report drift when a matching version has a different name", () => {
  const r = subject();
  const drift = r.rows.find(x => x.filename === "20260102000000_renamed_at_repository.sql");
  assert.equal(drift.classification, "version_name_drift_candidate");
  assert.equal(drift.counterpartVersion, "20260102000000");
  assert.equal(drift.executionVerified, false);
});

checked("Ambiguous name must never auto-pair", () => {
  const r = subject();
  const ambiguous = r.rows.find(x => x.filename === "20260104000000_ambiguous.sql");
  assert.equal(ambiguous.classification, "ambiguous_name_candidate");
  assert.equal(ambiguous.counterpartVersion, null);
});

checked("Inputs are immutable and output is permutation invariant", () => {
  const frozen = structuredClone(repository);
  const first = subject();
  const second = inspectCandidateMigrationDifferences({
    repository: [...repository].reverse(), hosted: [...hosted].reverse()
  });
  assert.deepEqual(repository, frozen);
  assert.deepEqual(first, second);
});

checked("Reject duplicate hosted version and unsafe shape", () => {
  assert.throws(() => inspectCandidateMigrationDifferences({repository,hosted:[...hosted,hosted[0]]}), /migration_candidates_hosted_duplicate_version/);
  assert.throws(() => inspectCandidateMigrationDifferences({repository:[{filename:"../secrets.sql"}],hosted}), /migration_candidates_invalid_repository_entry/);
  assert.throws(() => inspectCandidateMigrationDifferences({repository:[{filename:"20260101000000_bad.sql",sha256:"bad"}],hosted}), /migration_candidates_invalid_repository_entry/);
  assert.throws(() => inspectCandidateMigrationDifferences({repository,hosted:[]}), /migration_candidates_invalid_inventory/);
});

checked("CSV, Markdown retain explicit unverified status", () => {
  const r = subject();
  const csv = candidateMigrationDiagnosticCsv(r);
  const md = candidateMigrationDiagnosticMarkdown(r);
  assert.ok(csv.includes("version_name_drift_candidate"));
  assert.match(md, /Decision: HOLD/);
  assert.match(md, /not execution evidence/);
  assert.doesNotMatch(md, /Production identity verified:\s*true/i);
});

checked("Offline CLI with temporary files only; output remains HOLD", () => {
  const tmp = mkdtempSync(join(tmpdir(), "bejewely-db-candidate-"));
  try {
    const migrationDir = join(tmp, "migrations");
    const target = join(tmp, "out");
    mkdirSync(migrationDir);
    for (const row of repository) writeFileSync(join(migrationDir,row.filename), "select 1;\n");
    const candidatePath = join(tmp, "nonsecret-candidate-migrations.json");
    writeFileSync(candidatePath, JSON.stringify({migrations:hosted}));
    const cli = fileURLToPath(new URL("./database/audit/inspect-candidate-migrations.mjs", import.meta.url));
    const run = spawnSync(process.execPath,[
      cli,"--repo-dir",migrationDir,"--hosted-list",candidatePath,"--out-dir",target
    ],{encoding:"utf8",env:{PATH:process.env.PATH},timeout:15000});
    assert.equal(run.status, 0, run.stderr);
    const report = JSON.parse(readFileSync(join(target,"candidate-migration-diagnostic.json"),"utf8"));
    assert.equal(report.status,"HOLD");
    assert.equal(report.counts.duplicateRepositoryVersionGroups,1);
    assert.equal(report.counts.versionNameDriftCandidates,1);
    assert.match(readFileSync(join(target,"candidate-migration-diagnostic.csv"),"utf8"), /version_name_drift_candidate/);
    assert.match(readFileSync(join(target,"candidate-migration-diagnostic.md"),"utf8"), /Decision: HOLD/);
    // Reject symlinked source files and refuse to emit an artifact.
    symlinkSync(join(migrationDir,repository[0].filename),join(migrationDir,"20261212000000_symlink.sql"));
    const denied = spawnSync(process.execPath,[
      cli,"--repo-dir",migrationDir,"--hosted-list",candidatePath,"--out-dir",join(tmp,"denied")
    ],{encoding:"utf8",env:{PATH:process.env.PATH},timeout:15000});
    assert.equal(denied.status,2);
    assert.match(denied.stderr,/migration_candidates_invalid_repository_entry/);
  } finally {
    rmSync(tmp,{recursive:true,force:true});
  }
});

console.log(JSON.stringify({
  status: "PASS", owner: "database-integration",
  offline: true, cases: checks, productionReadiness: "HOLD", databaseCalls: 0
}));
