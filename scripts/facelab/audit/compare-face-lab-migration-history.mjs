#!/usr/bin/env node

import {
  mkdirSync, readFileSync, readdirSync, writeFileSync
} from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
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
  "Production status is always HOLD. No migration can be applied by this tool."
].join("\n");

function parseArgs(argv) {
  if (argv.length === 1 && argv[0] === "--help") return { help: true };
  const values = {};
  for (let i = 0; i < argv.length; i += 2) {
    const arg = argv[i], value = argv[i + 1];
    if (!["--repo-dir", "--hosted-list", "--out-dir"].includes(arg) ||
        !value || value.startsWith("--") || values[arg] !== undefined) {
      throw new Error("arguments_invalid");
    }
    values[arg] = value;
  }
  if (Object.keys(values).length !== 3) {
    throw new Error("arguments_required");
  }
  return {
    repoDir: resolve(values["--repo-dir"]),
    hostedPath: resolve(values["--hosted-list"]),
    outDir: resolve(values["--out-dir"])
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
    .filter(entry => entry.isFile() && entry.name.endsWith(".sql"))
    .map(entry => {
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
  });

  // Validate all inputs and compute all outputs BEFORE making output files.
  const csv = migrationReconciliationCsv(report);
  const markdown = migrationReconciliationMarkdown(report);
  const summary = JSON.stringify({
    toolVersion: report.toolVersion,
    inventoryStatus: report.inventoryStatus,
    productionReadiness: report.productionReadiness,
    reason: report.reason,
    projectIdentityVerified: report.projectIdentityVerified,
    appliedSqlVerified: report.appliedSqlVerified,
    counts: report.counts
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
