import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, realpathSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const screensPatchRoot = join(defaultRoot, "scripts/patches/react-native-screens-4.26.2");
export const normalizedHash = (source) => createHash("sha256").update(source.toString().replace(/\r\n/g, "\n")).digest("hex");

function contained(root, candidate) {
  const path = relative(root, candidate);
  assert.ok(path && !isAbsolute(path) && path !== ".." && !path.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`), "Screens source must stay inside its installed package");
}

// No install hook or network fetch: only the actual Android compiler owners invoke this guard.
export function applyScreensPatch({ repoRoot = defaultRoot, patchRoot = screensPatchRoot, replaceFile = renameSync } = {}) {
  const manifest = JSON.parse(readFileSync(join(patchRoot, "manifest.json"), "utf8"));
  assert.equal(manifest.package, "react-native-screens");
  assert.equal(manifest.version, "4.26.2");
  assert.equal(manifest.rows.length, 4, "Exactly four upstream sources are permitted");
  assert.deepEqual(manifest.rows.map((row) => row.local).sort(), [
    "android/src/main/cpp/NativeProxy.cpp", "android/src/main/cpp/NativeProxy.h",
    "cpp/RNSScreenRemovalListener.cpp", "cpp/RNSScreenRemovalListener.h",
  ].sort(), "Only the approved four native source paths may be replaced");
  const installedJson = createRequire(join(repoRoot, "apps/mobile/package.json")).resolve("react-native-screens/package.json");
  const packageRoot = realpathSync(dirname(installedJson));
  contained(realpathSync(repoRoot), packageRoot);
  assert.ok(relative(realpathSync(repoRoot), packageRoot).split(/[\\/]/).includes("node_modules"), "Refuse a source checkout outside node_modules");
  const installed = JSON.parse(readFileSync(installedJson, "utf8"));
  assert.equal(installed.name, manifest.package);
  assert.equal(installed.version, manifest.version, "Screens version drift: review the frozen SDK before updating the patch");
  const seen = new Set();
  const rows = manifest.rows.map((row) => {
    assert.ok(!seen.has(row.local), "Duplicate source target");
    seen.add(row.local);
    const target = resolve(packageRoot, row.local);
    contained(packageRoot, target);
    assert.equal(realpathSync(target), target, "Refuse symlinked source targets");
    const original = readFileSync(target);
    const replacement = readFileSync(join(patchRoot, row.local), "utf8").replace(/\r\n/g, "\n");
    assert.equal(normalizedHash(replacement), row.afterSha256, `Replacement source drift: ${row.local}`);
    const hash = normalizedHash(original);
    assert.ok(hash === row.beforeSha256 || hash === row.afterSha256, `Unknown installed source: ${row.local}`);
    return { ...row, target, original, replacement, hash };
  });
  const before = rows.every((row) => row.hash === row.beforeSha256);
  const after = rows.every((row) => row.hash === row.afterSha256);
  assert.ok(before || after, "Mixed Screens patch state; clean install before retrying");
  if (after) return { state: "already-applied", version: installed.version, files: rows.length };

  const temporary = [];
  const changed = [];
  try {
    // Prepare and validate every file before the first replacement. Same-directory rename is atomic per file.
    for (const row of rows) {
      row.temporary = `${row.target}.bejewely-${randomUUID()}.tmp`;
      writeFileSync(row.temporary, row.replacement, { flag: "wx" });
      temporary.push(row.temporary);
    }
    for (const row of rows) {
      assert.deepEqual(readFileSync(row.target), row.original, "Installed source changed during patch; refuse overwrite");
      replaceFile(row.temporary, row.target);
      changed.push(row);
    }
    for (const row of rows) assert.equal(normalizedHash(readFileSync(row.target)), row.afterSha256);
  } catch (error) {
    const rollbackErrors = [];
    for (const row of changed.reverse()) {
      try {
        assert.equal(normalizedHash(readFileSync(row.target)), row.afterSha256, "Source changed concurrently; refuse rollback overwrite");
        writeFileSync(row.target, row.original);
      } catch (rollbackError) { rollbackErrors.push(rollbackError); }
    }
    if (rollbackErrors.length) throw new AggregateError([error, ...rollbackErrors], "Patch failed and rollback was incomplete; clean install required");
    throw error;
  } finally {
    for (const path of temporary) {
      try { unlinkSync(path); } catch (error) { if (error.code !== "ENOENT") throw error; }
    }
  }
  return { state: "applied", version: installed.version, files: rows.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = applyScreensPatch();
  console.log(`MOBILE_ANDROID_SCREENS_COMPAT=PASS version=${result.version} state=${result.state} files=${result.files}`);
}
