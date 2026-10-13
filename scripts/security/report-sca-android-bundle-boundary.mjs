#!/usr/bin/env node
/**
 * SCA-3 observational inventory of an Android JavaScript export's source maps.
 *
 * Expected input: existing mobile:export:android --source-maps output,
 * generated from UNMODIFIED npm-ci-installed dependencies on a disposable CI
 * runner. No source code, sourcemap contents or environment values are logged.
 *
 * Sources present != reachable attacker input; sources absent from an export
 * != absent from native/other builds or a security fix. Never changes npm audit.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const exportRoot = path.join(repoRoot, "apps", "mobile", ".expo-ci-dist");
const targets = ["braces", "node-forge"];
const maxSourceMapBytes = 96 * 1024 * 1024;
const maxTotalMapBytes = 256 * 1024 * 1024;
const maxFiles = 1000;
function listFiles(folder, files = []) {
  if (!fs.existsSync(folder)) return files;
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    // Do not follow symlinks or read external files.
    assert.ok(!entry.isSymbolicLink(), "symlink in generated bundle output");
    const name = path.join(folder, entry.name);
    if (entry.isDirectory()) listFiles(name, files);
    else if (entry.isFile()) files.push(name);
    else throw new Error("unexpected generated bundle entry type");
    assert.ok(files.length <= maxFiles, "generated export has too many files");
  }
  return files;
}
function collectSourceEntries(map, into, depth = 0) {
  assert.ok(depth <= 12, "unexpected indexed sourcemap nesting");
  if (Array.isArray(map.sources)) {
    for (const source of map.sources) {
      if (typeof source === "string") into.push(source.replaceAll("\\", "/"));
    }
  }
  if (Array.isArray(map.sections)) {
    for (const section of map.sections) {
      if (section && typeof section === "object" && section.map) {
        collectSourceEntries(section.map, into, depth + 1);
      }
    }
  }
}
assert.ok(fs.existsSync(exportRoot), "expected Android JS export folder absent");
assert.ok(fs.statSync(exportRoot).isDirectory(), "export path must be a directory");
const allFiles = listFiles(exportRoot);
const maps = allFiles.filter((file) => file.endsWith(".map"));
assert.ok(maps.length > 0, "no generated Android source maps: inclusion inconclusive");
let totalMapBytes = 0;
const sources = [];
for (const file of maps) {
  const stat = fs.statSync(file);
  assert.ok(stat.size <= maxSourceMapBytes, "oversized sourcemap");
  totalMapBytes += stat.size;
  assert.ok(totalMapBytes <= maxTotalMapBytes, "oversized aggregate sourcemaps");
  const map = JSON.parse(fs.readFileSync(file, "utf8"));
  collectSourceEntries(map, sources);
}
assert.ok(sources.length > 0, "no source entries: inclusion inconclusive");
const packages = Object.fromEntries(targets.map((name) => {
  const token = "/node_modules/" + name + "/";
  const count = sources.filter((src) => ("/" + src).includes(token)).length;
  return [name, {
    observation: count > 0 ? "REFERENCED_IN_EXPORT_SOURCEMAPS" :
      "NOT_REFERENCED_IN_EXPORT_SOURCEMAPS",
    sourceEntries: count,
  }];
}));
const result = {
  state: "BASELINE_ONLY_UNMODIFIED_DEPENDENCIES",
  exported: "ANDROID_JAVASCRIPT_ONLY_NOT_APK",
  maps: maps.length,
  sourceEntries: sources.length,
  packages,
  caveat: "BUNDLE_SOURCE_MAP_OBSERVATION_NOT_ATTACK_REACHABILITY_OR_SECURITY_REMEDIATION",
  canonicalAuditUnchanged: true,
};
console.log("SCA_ANDROID_BUNDLE_BOUNDARY=" + JSON.stringify(result));
