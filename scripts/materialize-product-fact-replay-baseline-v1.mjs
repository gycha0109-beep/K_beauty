import { createHash } from "node:crypto";
import {
  access,
  lstat,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");
const PACKAGE_ROOT = path.join(
  ROOT,
  "tests",
  "fixtures",
  "product-fact-storage-v1",
  "replay-baseline-v1"
);
const MANIFEST_PATH = path.join(PACKAGE_ROOT, "manifest.json");
const MARKER = ".product-fact-local-replay-baseline-v1";
const DEFAULT_OUTPUT = path.join(ROOT, "tmp", "product-fact-replay-baseline-v1");
const TRACKED_MIGRATION_PREFIX = "supabase/migrations/";

function fail(code) {
  throw new Error(code);
}

function git(args, encoding = "utf8") {
  const result = spawnSync("git", args, {
    cwd: ROOT,
    encoding,
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024
  });
  if (result.status !== 0) {
    fail(`git_failed:${args[0]}:${String(result.stderr ?? "").trim()}`);
  }
  return result.stdout;
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function encodeLength(value) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(value));
  return buffer;
}

function digestEntries(entries) {
  const hash = createHash("sha256");
  for (const entry of entries) {
    const pathBytes = Buffer.from(entry.path, "utf8");
    hash.update(encodeLength(pathBytes.length));
    hash.update(pathBytes);
    hash.update(encodeLength(entry.content.length));
    hash.update(entry.content);
  }
  return hash.digest("hex");
}

function parseOutput() {
  const argument = process.argv.find((value) => value.startsWith("--output="));
  return argument ? argument.slice("--output=".length) : DEFAULT_OUTPUT;
}

function assertSafeOutput(candidate) {
  const resolved = path.resolve(ROOT, candidate);
  const allowed = `${path.join(ROOT, "tmp")}${path.sep}`;
  if (!resolved.startsWith(allowed)) {
    fail("output_must_be_under_repository_tmp");
  }
  return resolved;
}

async function exists(candidate) {
  try {
    await access(candidate);
    return true;
  } catch {
    return false;
  }
}

async function assertNoSymlinks(candidate) {
  const relative = path.relative(ROOT, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    fail("output_path_escape");
  }
  let current = ROOT;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    try {
      const metadata = await lstat(current);
      if (metadata.isSymbolicLink()) fail("output_symlink_component");
    } catch (error) {
      if (error && typeof error === "object" && error.code === "ENOENT") return;
      throw error;
    }
  }
}

async function resetOutput(output) {
  if (!(await exists(output))) return;
  const markerPath = path.join(output, MARKER);
  if (!(await exists(markerPath))) fail("refuse_unmarked_output_removal");
  const marker = await readFile(markerPath, "utf8");
  if (marker.trim() !== "product-fact-local-replay-baseline-v1") {
    fail("refuse_invalid_marker_output_removal");
  }
  await rm(output, { recursive: true, force: false });
}

function quoteIdentifier(value) {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) fail(`invalid_identifier:${value}`);
  return `"${value}"`;
}

function sqlValue(value, column) {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  const escaped = String(value).replaceAll("'", "''");
  if (column === "meta_json") return `'${escaped.replaceAll("\\", "\\\\")}'::jsonb`;
  if (column === "rating") return `'${escaped}'::numeric`;
  return `'${escaped}'`;
}

function sentinelSql(sentinels) {
  const stage = sentinels.lifecycle.find(
    (entry) => entry.stage === "after_predecessor_before_first_tracked_migration"
  );
  if (!stage || !Array.isArray(stage.rows) || stage.rows.length !== 5) {
    fail("invalid_predecessor_sentinel_stage");
  }
  const statements = [
    "-- GENERATED FROM sentinels/legacy-sentinels.json.",
    "-- TEST / LOCAL REPLAY ONLY. NOT A PRODUCTION MIGRATION.",
    "begin;",
    ""
  ];
  for (const row of stage.rows) {
    if (!/^public\.[a-z_][a-z0-9_]*$/.test(row.table)) {
      fail(`invalid_sentinel_table:${row.table}`);
    }
    const [schema, table] = row.table.split(".");
    const columns = Object.keys(row.values);
    const values = columns.map((column) => {
      const raw = column === "meta_json" ? JSON.stringify(row.values[column]) : row.values[column];
      return sqlValue(raw, column);
    });
    statements.push(
      `insert into ${quoteIdentifier(schema)}.${quoteIdentifier(table)} (${columns.map(quoteIdentifier).join(", ")})`,
      `values (${values.join(", ")});`,
      ""
    );
  }
  statements.push("commit;", "");
  return statements.join("\n");
}

function a1SentinelLifecycleSql(sentinels) {
  const stage = sentinels.lifecycle.find(
    (entry) => entry.stage === "after_admin_v2_cleansing_profile_migrations_before_pre_pf2_fingerprints"
  );
  if (!stage || !Array.isArray(stage.updates) || stage.updates.length !== 1) {
    fail("invalid_a1_sentinel_lifecycle_stage");
  }
  const statements = [
    "-- GENERATED FROM sentinels/legacy-sentinels.json.",
    "-- TEST / LOCAL REPLAY ONLY. NOT A PRODUCTION MIGRATION.",
    "-- Deterministic A1 sentinel lifecycle; not a schema compatibility adapter.",
    "begin;",
    ""
  ];
  for (const update of stage.updates) {
    if (!/^public\.[a-z_][a-z0-9_]*$/.test(update.table)) {
      fail(`invalid_a1_sentinel_table:${update.table}`);
    }
    const [schema, table] = update.table.split(".");
    const keys = Object.entries(update.key ?? {});
    const values = Object.entries(update.values ?? {});
    if (keys.length !== 1 || values.length !== 1) fail("invalid_a1_sentinel_update_shape");
    const assignments = values.map(([column, value]) => `${quoteIdentifier(column)} = ${sqlValue(value, column)}`);
    const predicates = keys.map(([column, value]) => `${quoteIdentifier(column)} = ${sqlValue(value, column)}`);
    statements.push(
      `update ${quoteIdentifier(schema)}.${quoteIdentifier(table)}`,
      `set ${assignments.join(", ")}`,
      `where ${predicates.join(" and ")};`,
      ""
    );
  }
  statements.push("commit;", "");
  return statements.join("\n");
}

async function gitTreeMigrationEntries(commit) {
  const names = git(["ls-tree", "-r", "--name-only", commit, "--", "supabase/migrations"])
    .split(/\r?\n/)
    .filter((value) => value.startsWith(TRACKED_MIGRATION_PREFIX) && value.endsWith(".sql"))
    .sort((left, right) => Buffer.from(left).compare(Buffer.from(right)));
  if (names.length === 0) fail("pre_pf2_migration_tree_empty");

  return names.map((name) => ({
    path: name,
    content: Buffer.from(git(["show", `${commit}:${name}`], null))
  }));
}

function localConfig() {
  return [
    'project_id = "product-fact-local-replay-baseline-v1"',
    "",
    "[api]",
    "port = 57421",
    "",
    "[db]",
    "port = 57422",
    "shadow_port = 57420",
    "major_version = 15",
    "",
    "[db.seed]",
    "enabled = false",
    "",
    "[studio]",
    "enabled = false",
    ""
  ].join("\n");
}

async function main() {
  const output = assertSafeOutput(parseOutput());
  await assertNoSymlinks(output);
  await resetOutput(output);
  await mkdir(path.join(output, "supabase", "migrations"), { recursive: true });
  await writeFile(path.join(output, MARKER), "product-fact-local-replay-baseline-v1\n", "utf8");

  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  if (manifest.historical_identity_claimed !== false) fail("historical_identity_claim_not_false");
  if (manifest.hosted_identity_claimed !== false) fail("hosted_identity_claim_not_false");
  if (manifest.production_identity_claimed !== false) fail("production_identity_claim_not_false");

  const head = git(["rev-parse", "HEAD"]).trim();
  const ancestor = spawnSync(
    "git",
    ["merge-base", "--is-ancestor", manifest.authoritative_main, head],
    { cwd: ROOT, windowsHide: true }
  );
  if (ancestor.status !== 0) fail("head_not_descended_from_authoritative_main");

  const migrationEntries = await gitTreeMigrationEntries(manifest.pre_pf2_repository_sha);
  const migrationNames = migrationEntries.map((entry) => path.posix.basename(entry.path));
  if (migrationNames[0] !== manifest.compatible_first_migration) fail("first_migration_binding_mismatch");
  if (migrationNames.at(-1) !== manifest.compatible_last_pre_pf2_migration) {
    fail("last_pre_pf2_migration_binding_mismatch");
  }

  const migrationsDirectory = path.join(output, "supabase", "migrations");
  const predecessorSource = path.join(PACKAGE_ROOT, manifest.predecessor_fixture_paths[0]);
  const predecessorContent = await readFile(predecessorSource);
  await writeFile(
    path.join(migrationsDirectory, "00000000000000_product_fact_replay_predecessor_v1.sql"),
    predecessorContent
  );

  const sentinels = JSON.parse(
    await readFile(path.join(PACKAGE_ROOT, manifest.sentinel_paths[0]), "utf8")
  );
  const generatedSentinels = sentinelSql(sentinels);
  await writeFile(
    path.join(migrationsDirectory, "00000000000001_product_fact_replay_legacy_sentinels_v1.sql"),
    generatedSentinels,
    "utf8"
  );

  const bridgeByAnchor = new Map(
    manifest.ordered_compatibility_bridges.map((entry) => [entry.anchor_migration, entry])
  );
  const effectiveFiles = [];
  for (const entry of migrationEntries) {
    const migrationName = path.posix.basename(entry.path);
    const bridge = bridgeByAnchor.get(migrationName);
    if (bridge) {
      const bridgeContent = await readFile(path.join(PACKAGE_ROOT, bridge.path));
      const bridgeName = path.posix.basename(bridge.path);
      await writeFile(path.join(migrationsDirectory, bridgeName), bridgeContent);
      effectiveFiles.push({
        file: bridgeName,
        origin: "governed-compatibility-bridge",
        package_path: bridge.path,
        raw_sha256: sha256(bridgeContent)
      });
    }
    await writeFile(path.join(migrationsDirectory, migrationName), entry.content);
    effectiveFiles.push({
      file: migrationName,
      origin: "tracked-pre-pf2-migration",
      repository_path: entry.path,
      raw_sha256: sha256(entry.content),
      git_blob_id: git(["rev-parse", `${manifest.pre_pf2_repository_sha}:${entry.path}`]).trim()
    });
  }

  const generatedA1Sentinels = a1SentinelLifecycleSql(sentinels);
  const a1SentinelName = "20260805220011_product_fact_replay_a1_sentinels_v1.sql";
  await writeFile(
    path.join(migrationsDirectory, a1SentinelName),
    generatedA1Sentinels,
    "utf8"
  );
  effectiveFiles.push({
    file: a1SentinelName,
    origin: "synthetic-sentinel-lifecycle",
    source: manifest.sentinel_paths[0],
    raw_sha256: sha256(Buffer.from(generatedA1Sentinels, "utf8"))
  });

  const diskOrder = (await readdir(migrationsDirectory))
    .filter((name) => name.endsWith(".sql"))
    .sort((left, right) => Buffer.from(left).compare(Buffer.from(right)));
  const expectedPrefix = [
    "00000000000000_product_fact_replay_predecessor_v1.sql",
    "00000000000001_product_fact_replay_legacy_sentinels_v1.sql"
  ];
  if (diskOrder[0] !== expectedPrefix[0] || diskOrder[1] !== expectedPrefix[1]) {
    fail("materialized_predecessor_order_invalid");
  }
  if (diskOrder.at(-1) !== a1SentinelName) {
    fail("materialized_a1_sentinel_lifecycle_order_invalid");
  }
  for (const bridge of manifest.ordered_compatibility_bridges) {
    const bridgeName = path.posix.basename(bridge.path);
    const bridgeIndex = diskOrder.indexOf(bridgeName);
    const anchorIndex = diskOrder.indexOf(bridge.anchor_migration);
    if (bridgeIndex < 0 || bridgeIndex + 1 !== anchorIndex) {
      fail(`materialized_bridge_anchor_invalid:${bridgeName}`);
    }
  }

  const ledgerDigest = digestEntries(migrationEntries);
  await writeFile(path.join(output, "supabase", "config.toml"), localConfig(), "utf8");
  await writeFile(
    path.join(output, "materialization-manifest.json"),
    `${JSON.stringify({
      schema_version: "product-fact-replay-materialization-v1",
      baseline_version: manifest.baseline_version,
      baseline_canonical_sha256: manifest.canonical_sha256,
      pre_pf2_repository_sha: manifest.pre_pf2_repository_sha,
      tracked_migration_count: migrationEntries.length,
      tracked_migration_ledger_sha256: ledgerDigest,
      effective_execution_order: diskOrder,
      tracked_files: effectiveFiles.filter((entry) => entry.origin === "tracked-pre-pf2-migration"),
      bridge_files: effectiveFiles.filter((entry) => entry.origin === "governed-compatibility-bridge"),
      sentinel_files: effectiveFiles.filter((entry) => entry.origin === "synthetic-sentinel-lifecycle"),
      local_only: true,
      historical_identity_claimed: false,
      hosted_identity_claimed: false,
      remote_commands_executed: false
    }, null, 2)}\n`,
    "utf8"
  );
  await writeFile(
    path.join(output, "README.txt"),
    [
      "Product Fact governed local replay baseline v1",
      "",
      "LOCAL / TEST ONLY. NOT A PRODUCTION MIGRATION WORKSPACE.",
      "Do not link, push, pull, repair, or execute remote SQL from this directory.",
      "This workspace does not claim historical Production or Hosted identity.",
      ""
    ].join("\n"),
    "utf8"
  );

  console.log(JSON.stringify({
    status: "PASS",
    output: path.relative(ROOT, output).replaceAll(path.sep, "/"),
    baseline_version: manifest.baseline_version,
    baseline_canonical_sha256: manifest.canonical_sha256,
    tracked_migrations: migrationEntries.length,
    bridges: manifest.ordered_compatibility_bridges.length,
    predecessor_sentinel_rows: sentinels.lifecycle[0].rows.length,
    a1_sentinel_updates: sentinels.lifecycle[1].updates.length,
    tracked_migration_ledger_sha256: ledgerDigest,
    local_only: true
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
