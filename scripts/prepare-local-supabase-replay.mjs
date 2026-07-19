import { createHash } from "node:crypto";
import {
  access,
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIR, "..");
const DEFAULT_OUTPUT = path.join(REPOSITORY_ROOT, "tmp", "local-supabase-replay");
const OUTPUT_MARKER = ".kbeauty-local-replay-workspace";
const PREDECESSOR_FILE = "00000000_local_replay_predecessor.sql";
const COMPATIBILITY_FILE = "20260525_local_replay_untracked_product_columns.sql";
const COMPATIBILITY_ANCHOR = "20260526_moisturizer_lotion_emulsion_insert.sql";
const RUNTIME_FILE = "99999999_local_replay_runtime_contract.sql";

function parseOutputArgument() {
  const argument = process.argv.find((value) => value.startsWith("--output="));
  return argument ? argument.slice("--output=".length) : DEFAULT_OUTPUT;
}

function assertSafeOutputPath(candidate) {
  const resolved = path.resolve(REPOSITORY_ROOT, candidate);
  const allowedRoot = path.join(REPOSITORY_ROOT, "tmp") + path.sep;

  if (!resolved.startsWith(allowedRoot)) {
    throw new Error("local_replay_output_must_be_under_repository_tmp");
  }

  return resolved;
}

async function pathExists(candidate) {
  try {
    await access(candidate);
    return true;
  } catch {
    return false;
  }
}

async function assertNoSymlinkComponents(candidate) {
  const relative = path.relative(REPOSITORY_ROOT, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("local_replay_output_escaped_repository");
  }

  let current = REPOSITORY_ROOT;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    try {
      const metadata = await lstat(current);
      if (metadata.isSymbolicLink()) {
        throw new Error("local_replay_output_contains_symlink_component");
      }
    } catch (error) {
      if (error && typeof error === "object" && error.code === "ENOENT") {
        break;
      }
      throw error;
    }
  }
}

async function sha256(candidate) {
  const content = await readFile(candidate);
  return createHash("sha256").update(content).digest("hex");
}

async function resetOutput(outputRoot) {
  if (!(await pathExists(outputRoot))) {
    return;
  }

  const markerPath = path.join(outputRoot, OUTPUT_MARKER);
  if (!(await pathExists(markerPath))) {
    throw new Error("refusing_to_remove_unmarked_output_directory");
  }

  const marker = await readFile(markerPath, "utf8");
  if (marker.trim() !== "kbeauty-local-replay-v1") {
    throw new Error("refusing_to_remove_output_with_invalid_marker");
  }

  await rm(outputRoot, { recursive: true, force: false });
}

async function copyTrackedMigrations(sourceDirectory, destinationDirectory) {
  const sourceEntries = await readdir(sourceDirectory, { withFileTypes: true });
  const migrationNames = sourceEntries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, "en"));

  if (!migrationNames.includes("20260410_safe_review_and_promotion_layer.sql")) {
    throw new Error("missing_first_tracked_migration");
  }

  if (!migrationNames.includes(COMPATIBILITY_ANCHOR)) {
    throw new Error("missing_local_replay_compatibility_anchor");
  }

  const adapterNames = new Set([
    PREDECESSOR_FILE,
    COMPATIBILITY_FILE,
    RUNTIME_FILE
  ]);

  for (const migrationName of migrationNames) {
    if (adapterNames.has(migrationName)) {
      throw new Error(`tracked_migration_collides_with_local_adapter:${migrationName}`);
    }
  }

  const copied = [];
  for (const migrationName of migrationNames) {
    const source = path.join(sourceDirectory, migrationName);
    const destination = path.join(destinationDirectory, migrationName);
    await copyFile(source, destination);

    const sourceHash = await sha256(source);
    const destinationHash = await sha256(destination);
    if (sourceHash !== destinationHash) {
      throw new Error(`tracked_migration_copy_hash_mismatch:${migrationName}`);
    }

    copied.push({
      file: migrationName,
      origin: "tracked-production-migration",
      sha256: destinationHash
    });
  }

  return copied;
}

async function copyLocalAdapter(adapterDirectory, destinationDirectory, fileName, role) {
  const source = path.join(adapterDirectory, fileName);
  const destination = path.join(destinationDirectory, fileName);
  await copyFile(source, destination);

  return {
    file: fileName,
    origin: role,
    sha256: await sha256(destination)
  };
}

async function main() {
  const outputRoot = assertSafeOutputPath(parseOutputArgument());
  const outputSupabase = path.join(outputRoot, "supabase");
  const outputMigrations = path.join(outputSupabase, "migrations");
  const trackedMigrations = path.join(REPOSITORY_ROOT, "supabase", "migrations");
  const localReplayRoot = path.join(REPOSITORY_ROOT, "supabase", "local-replay-test");
  const adapterDirectory = path.join(localReplayRoot, "adapters");
  const templateDirectory = path.join(localReplayRoot, "project-template");

  await assertNoSymlinkComponents(outputRoot);
  await resetOutput(outputRoot);
  await mkdir(outputMigrations, { recursive: true });
  await assertNoSymlinkComponents(outputRoot);
  await writeFile(
    path.join(outputRoot, OUTPUT_MARKER),
    "kbeauty-local-replay-v1\n",
    "utf8"
  );

  await copyFile(
    path.join(templateDirectory, "config.toml"),
    path.join(outputSupabase, "config.toml")
  );
  await copyFile(
    path.join(templateDirectory, "seed.sql"),
    path.join(outputSupabase, "seed.sql")
  );

  const files = [];
  files.push(
    await copyLocalAdapter(
      adapterDirectory,
      outputMigrations,
      PREDECESSOR_FILE,
      "local-predecessor-adapter"
    )
  );

  files.push(...await copyTrackedMigrations(trackedMigrations, outputMigrations));

  files.push(
    await copyLocalAdapter(
      adapterDirectory,
      outputMigrations,
      COMPATIBILITY_FILE,
      "local-untracked-dependency-adapter"
    )
  );
  files.push(
    await copyLocalAdapter(
      adapterDirectory,
      outputMigrations,
      RUNTIME_FILE,
      "local-runtime-contract-adapter"
    )
  );

  const orderedFiles = files
    .slice()
    .sort((left, right) => left.file.localeCompare(right.file, "en"));
  const orderedNames = orderedFiles.map((entry) => entry.file);
  const predecessorIndex = orderedNames.indexOf(PREDECESSOR_FILE);
  const firstTrackedIndex = orderedNames.indexOf("20260410_safe_review_and_promotion_layer.sql");
  const compatibilityIndex = orderedNames.indexOf(COMPATIBILITY_FILE);
  const compatibilityAnchorIndex = orderedNames.indexOf(COMPATIBILITY_ANCHOR);
  const runtimeIndex = orderedNames.indexOf(RUNTIME_FILE);

  if (predecessorIndex !== 0 || firstTrackedIndex <= predecessorIndex) {
    throw new Error("invalid_predecessor_replay_order");
  }
  if (compatibilityIndex < 0 || compatibilityIndex >= compatibilityAnchorIndex) {
    throw new Error("invalid_untracked_dependency_adapter_order");
  }
  if (runtimeIndex !== orderedNames.length - 1) {
    throw new Error("invalid_runtime_adapter_order");
  }

  const manifest = {
    schemaVersion: "local-supabase-replay-manifest-v1",
    generatedAt: new Date().toISOString(),
    output: path.relative(REPOSITORY_ROOT, outputRoot).replaceAll(path.sep, "/"),
    safety: {
      localOnly: true,
      symlinkComponentsRejected: true,
      linkedProjectMetadataCopied: false,
      remoteCommandsExecuted: false,
      productionMigrationsModified: false
    },
    files: orderedFiles
  };

  await writeFile(
    path.join(outputRoot, "replay-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );
  await writeFile(
    path.join(outputRoot, "README.txt"),
    [
      "K-Beauty local Supabase replay workspace",
      "",
      "This directory is generated and must remain under repository tmp/.",
      "It contains byte-identical copies of tracked production migrations plus",
      "three explicitly local-only adapters. It contains no linked project metadata.",
      "",
      "Run only against the generated local project:",
      `  supabase start --workdir ${path.relative(REPOSITORY_ROOT, outputRoot)}`,
      `  supabase db reset --workdir ${path.relative(REPOSITORY_ROOT, outputRoot)}`,
      ""
    ].join("\n"),
    "utf8"
  );

  console.log(JSON.stringify({
    status: "prepared",
    output: manifest.output,
    migrationCount: orderedFiles.length,
    trackedMigrationCount: orderedFiles.filter(
      (entry) => entry.origin === "tracked-production-migration"
    ).length,
    localAdapterCount: 3
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
