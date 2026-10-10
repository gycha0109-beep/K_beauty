#!/usr/bin/env node

import {
  mkdirSync, readFileSync, readdirSync, writeFileSync
} from "node:fs";
import { createHash } from "node:crypto";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  reconcileFaceLabMigrationInventories,
  migrationReconciliationCsv,
  migrationReconciliationMarkdown
} from "./migration-reconciliation-core.mjs";

const HELP = [
  "Offline Face Lab migration inventory comparison (does not connect to DB)",
  "Usage:",
  "  node scripts/facelab/audit/compare-face-lab-migration-history.mjs",
  "    --repo-dir supabase/migrations",
  "    --hosted-list /path/to/nonsecret-migration-list.json",
  "    --out-dir /path/to/audit-output",
  "",
  "Hosted input: JSON array [{version,name}] or {migrations:[{version,name}]}",
  "Reports: migration-reconciliation.csv, migration-reconciliation-review.md",
  "         migration-reconciliation-summary.json",
  "Options: --allow-legacy-date-versions (explicitly permit 8-digit historical dates)",
  "         --git-commit <40-char-sha> --snapshot-at <YYYY-MM-DDTHH:MM:SSZ>",
  "Production status is always HOLD. No migration can be applied by this tool."
].join("\n");

function parseArgs(argv) {
  if (argv.length === 1 && argv[0] === "--help") return { help: true };
  const values = {};
  const legacyCount = argv.filter(v => v === "--allow-legacy-date-versions").length;
  if (legacyCount > 1) throw new Error("arguments_invalid");
  const positional = argv.filter(v => v !== "--allow-legacy-date-versions");
  for (let i = 0; i < positional.length; i += 2) {
    const arg = positional[i], value = positional[i + 1];
    if (!["--repo-dir", "--hosted-list", "--out-dir", "--git-commit", "--snapshot-at"].includes(arg) ||
        !value || value.startsWith("--") || values[arg] !== undefined) {
      throw new Error("arguments_invalid");
    }
    values[arg] = value;
  }
  if (!["--repo-dir", "--hosted-list", "--out-dir"].every(k => values[k])) {
    throw new Error("arguments_required");
  }
  if (values["--git-commit"] && !/^[a-f0-9]{40}$/.test(values["--git-commit"])) {
    throw new Error("arguments_invalid");
  }
  if (values["--snapshot-at"] &&
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(values["--snapshot-at"])) {
    throw new Error("arguments_invalid");
  }
  const repoDir = resolve(values["--repo-dir"]);
  const outDir = resolve(values["--out-dir"]);
  if (outDir === repoDir || outDir.startsWith(repoDir + sep)) {
    throw new Error("arguments_invalid");
  }
  return {
    repoDir,
    hostedPath: resolve(values["--hosted-list"]),
    outDir,
    allowLegacyDates: legacyCount === 1,
    gitCommit: values["--git-commit"],
    snapshotAt: values["--snapshot-at"]
  };
}

export function main(argv = []) {
  const args = parseArgs(argv);
  if (args.help) {
    process.stdout.write(HELP + "\n");
    return 0;
  }

  // Only filenames and SHA-256 digests leave this process. Raw SQL contents
  // are hashed in memory and never logged, uploaded, or executed.
  const repository = readdirSync(args.repoDir, { withFileTypes: true })
    .map(entry => {
      // Fail closed: do not silently ignore unexpected files or symlinks.
      if (!entry.isFile() || !entry.name.endsWith(".sql")) {
        throw new Error("migration_inventory_repo_filename_invalid");
      }
      const content = readFileSync(resolve(args.repoDir, entry.name));
      return {
        filename: entry.name,
        sha256: createHash("sha256").update(content).digest("hex")
      };
    });

  const supplied = JSON.parse(readFileSync(args.hostedPath, "utf8"));
  const hosted = Array.isArray(supplied) ? supplied : supplied?.migrations;
  const report = reconcileFaceLabMigrationInventories({
    repository, hosted
  }, { allowLegacyDates: args.allowLegacyDates });

  // Validate all inputs and compute all outputs BEFORE making output files.
  const csv = migrationReconciliationCsv(report);
  const markdown = migrationReconciliationMarkdown(report, {
    gitCommit: args.gitCommit,
    snapshotAt: args.snapshotAt
  });
  const summary = JSON.stringify({
    toolVersion: report.toolVersion,
    status: "HOLD",
    inventoryStatus: report.inventoryStatus,
    productionReadiness: report.productionReadiness,
    projectIdentityConfirmed: false,
    productionReconciliationComplete: false,
    databaseWrites: 0,
    networkCalls: 0,
    migrationExecuted: false,
    inputKind: "local_sql_and_supplied_nonsecret_json",
    gitCommit: args.gitCommit ?? null,
    snapshotAt: args.snapshotAt ?? null,
    legacyDateVersionsAllowed: args.allowLegacyDates,
    reason: report.reason,
    projectIdentityVerified: report.projectIdentityVerified,
    appliedSqlVerified: report.appliedSqlVerified,
    counts: report.counts,
    unresolved: report.rows.filter(row => !["exact_record", "version_match_name_drift"].includes(row.classification)).map(row => ({
      repo_version: row.repo_version,
      hosted_version: row.hosted_version,
      classification: row.classification,
      candidate_matches: row.candidate_matches
    }))
  }, null, 2) + "\n";

  mkdirSync(args.outDir, { recursive: true });
  writeFileSync(resolve(args.outDir, "migration-reconciliation.csv"), csv);
  writeFileSync(
    resolve(args.outDir, "migration-reconciliation-review.md"), markdown
  );
  writeFileSync(
    resolve(args.outDir, "migration-reconciliation-summary.json"), summary
  );

  process.stdout.write(JSON.stringify({
    inventoryStatus: report.inventoryStatus,
    productionReadiness: report.productionReadiness,
    counts: report.counts
  }) + "\n");
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    // Do not echo paths, SQL, environment variables, or input contents.
    const allowedCode = String(error?.message ?? "").startsWith("migration_inventory_")
      ? error.message : "offline_inventory_input_or_output_failed";
    process.stderr.write(allowedCode + "\n");
    process.exitCode = 2;
  }
}
