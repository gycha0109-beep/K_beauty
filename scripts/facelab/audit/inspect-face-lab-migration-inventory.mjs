#!/usr/bin/env node
/**
 * Repository-only migration inventory diagnostic.
 * Hashes SQL file bytes but never parses or executes SQL, reads credentials,
 * connects to the network, or claims to establish hosted DB identity.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const FILE_RE = /^([0-9]{14}|[0-9]{8})_([a-zA-Z0-9][a-zA-Z0-9._-]*)\.sql$/;
const SHA_RE = /^[a-f0-9]{64}$/;
const MAX_FILES = 10000;
const MAX_FILE_BYTES = 20 * 1024 * 1024;

function fail(code) {
  throw new Error("migration_preflight_" + code);
}
function cmp(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}
function isPlain(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/**
 * Pure function: inspect a complete local file manifest, not hosted history.
 * Invalid file names are counted but never emitted (untrusted filenames may
 * contain secrets). Duplicate timestamps remain explicitly unresolved.
 */
export function inspectFaceLabMigrationInventory(entries) {
  if (!Array.isArray(entries) || entries.length < 1 ||
      entries.length > MAX_FILES) fail("entries_invalid");
  const knownNames = new Set();
  const versions = new Map();
  let invalidFileCount = 0;
  const valid = [];
  for (const entry of entries) {
    if (!isPlain(entry) || typeof entry.filename !== "string" ||
        typeof entry.sha256 !== "string" || !SHA_RE.test(entry.sha256)) {
      fail("entry_invalid");
    }
    if (knownNames.has(entry.filename)) fail("duplicate_filename");
    knownNames.add(entry.filename);
    const parsed = FILE_RE.exec(entry.filename);
    if (!parsed || entry.filename.length > 260) {
      invalidFileCount++;
      continue;
    }
    const item = {
      version: parsed[1],
      name: parsed[2],
      filename: entry.filename,
      repoSqlSha256: entry.sha256,
      versionFormat: parsed[1].length === 14 ? "timestamp14" : "legacy_date8"
    };
    valid.push(item);
    versions.set(item.version, [...(versions.get(item.version) ?? []), item]);
  }
  valid.sort((a,b) => cmp(a.version,b.version) || cmp(a.filename,b.filename));
  const duplicateVersions = [...versions.entries()]
    .filter(([, group]) => group.length > 1)
    .sort(([a],[b]) => cmp(a,b))
    .map(([version, group]) => ({
      version,
      fileCount: group.length,
      files: group
        .sort((a,b) => cmp(a.filename,b.filename))
        .map(item => ({
          filename: item.filename, repoSqlSha256: item.repoSqlSha256
        }))
    }));
  const legacyMigrations = valid.filter(v => v.versionFormat === "legacy_date8");
  const counts = {
    repositoryEntries: entries.length,
    validSqlFiles: valid.length,
    timestamp14Files: valid.length - legacyMigrations.length,
    legacyDate8Files: legacyMigrations.length,
    invalidFileCount,
    duplicateVersionGroups: duplicateVersions.length,
    duplicateVersionFileCount:
      duplicateVersions.reduce((sum,x) => sum + x.fileCount,0)
  };
  if (counts.validSqlFiles + counts.invalidFileCount !== counts.repositoryEntries ||
      counts.timestamp14Files + counts.legacyDate8Files !== counts.validSqlFiles) {
    fail("conservation_violation");
  }
  return {
    kind: "local_repository_migration_preflight",
    status: "HOLD",
    diagnosticCompleted: true,
    inventoryReconciliationEligible:
      invalidFileCount === 0 && duplicateVersions.length === 0,
    projectIdentityConfirmed: false,
    productionReconciliationComplete: false,
    hostedHistoryCompared: false,
    sqlExecuted: false,
    databaseWrites: 0,
    databaseCalls: 0,
    networkCalls: 0,
    counts,
    duplicateVersions,
    legacyMigrations: legacyMigrations.map(item => ({
      version: item.version,
      filename: item.filename,
      repoSqlSha256: item.repoSqlSha256
    })),
    invalidFilenameDiagnostic: invalidFileCount
      ? "unexpected_file_names_present_names_redacted" : null,
    nextAction: duplicateVersions.length || invalidFileCount
      ? "read_only_repository_history_review"
      : "obtain_confirmed_hosted_history_before_reconciliation"
  };
}

export function migrationInventoryPreflightMarkdown(report) {
  if (!isPlain(report) || !isPlain(report.counts) ||
      !Array.isArray(report.duplicateVersions)) fail("report_invalid");
  const c = report.counts;
  return [
    "# Face Lab / Migration Repository Inventory Preflight",
    "",
    "**Operational status: HOLD.** No hosted DB history was compared.",
    "This is not SQL execution evidence or production database identification.",
    "",
    "| Metric | Count |",
    "| --- | ---: |",
    "| Repository entries | " + c.repositoryEntries + " |",
    "| Valid SQL filenames | " + c.validSqlFiles + " |",
    "| 14-digit timestamp versions | " + c.timestamp14Files + " |",
    "| 8-digit legacy date versions | " + c.legacyDate8Files + " |",
    "| Invalid filenames (redacted) | " + c.invalidFileCount + " |",
    "| Duplicate version groups | " + c.duplicateVersionGroups + " |",
    "| Files in duplicate groups | " + c.duplicateVersionFileCount + " |",
    "",
    "## Duplicate repository versions",
    ...(report.duplicateVersions.length
      ? report.duplicateVersions.flatMap(group => [
          "- Version " + group.version + ": " + group.fileCount + " files",
          ...group.files.map(f => "  - " + f.filename + " (local SHA-256: " +
            f.repoSqlSha256 + ")")
        ])
      : ["- None detected"]),
    "",
    "## Legacy filenames",
    ...(report.legacyMigrations.length
      ? report.legacyMigrations.map(f => "- " + f.filename)
      : ["- None detected"]),
    "",
    "## Next step",
    report.nextAction,
    "",
    "No automatic renaming, migration replay, hosted record modification,",
    "environment variable access, or permission change is authorized.",
    ""
  ].join("\n");
}

function parseArgs(args) {
  const values = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i], value = args[i + 1];
    if (!["--repo-dir","--out-dir"].includes(key) ||
        values[key] !== undefined || !value || value.startsWith("--")) {
      fail("arguments_invalid");
    }
    values[key] = value;
  }
  if (!values["--repo-dir"]) fail("arguments_required");
  const repoDir = resolve(values["--repo-dir"]);
  const outDir = values["--out-dir"] ? resolve(values["--out-dir"]) : null;
  if (outDir && (outDir === repoDir || outDir.startsWith(repoDir + sep))) {
    fail("output_inside_source");
  }
  return {repoDir,outDir};
}

export function main(args = []) {
  const {repoDir,outDir} = parseArgs(args);
  const files = readdirSync(repoDir, {withFileTypes:true});
  if (!files.length || files.length > MAX_FILES) fail("entries_invalid");
  const entries = files.map(entry => {
    if (!entry.isFile()) fail("unexpected_entry_type");
    if (!entry.name.endsWith(".sql")) {
      // Do not read arbitrary files that may contain sensitive content.
      return {filename:entry.name,sha256:"0".repeat(64)};
    }
    const buffer = readFileSync(resolve(repoDir,entry.name));
    if (buffer.length > MAX_FILE_BYTES) fail("file_size_exceeded");
    return {
      filename:entry.name,
      sha256:createHash("sha256").update(buffer).digest("hex")
    };
  });
  const result = inspectFaceLabMigrationInventory(entries);
  const json = JSON.stringify(result,null,2) + "\n";
  if (outDir) {
    const md = migrationInventoryPreflightMarkdown(result);
    mkdirSync(outDir,{recursive:true});
    writeFileSync(resolve(outDir,"migration-inventory-preflight.json"),json);
    writeFileSync(resolve(outDir,"migration-inventory-preflight.md"),md);
  }
  process.stdout.write(JSON.stringify({
    status:result.status,
    diagnosticCompleted:result.diagnosticCompleted,
    counts:result.counts
  }) + "\n");
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    const message = String(error?.message ?? "");
    process.stderr.write((message.startsWith("migration_preflight_")
      ? message : "migration_preflight_io_failed") + "\n");
    process.exitCode = 2;
  }
}
