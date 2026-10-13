#!/usr/bin/env node
/**
 * SCA-2 / SCA-3 feasibility: generate an OFFICIAL Expo 57 patch candidate
 * package-lock in an ephemeral worktree-like package manifest snapshot only.
 *
 * Advisory remediation is NOT attested by this experiment: both unmodified
 * raw npm audits remain the authority and the original workflow gate remains
 * untouched. Do not import experimental files back to the repository.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "bejewely-expo57-candidate-"));
const rootPackage = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const candidateSpec = "expo@~57.0.28";
const baseline = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
const targets = ["braces", "node-forge"];
const auditKinds = [
  ["production", ["--omit=dev"]],
  ["full", []],
];
const result = {
  mode: "OFFICIAL_EXPO_57_PATCH_CANDIDATE_LOCK_ONLY_EPHEMERAL",
  candidateSpec,
  packageLockChangedInSourceTree: false,
  dependencyMutationApproved: false,
  candidateResolved: false,
  state: "NOT_RUN",
  targetPackages: {},
  audits: {},
  requirement: "BOTH_CANONICAL_RAW_AUDITS_HIGH_CRITICAL_ZERO",
  originalAdvisoryGateUnchanged: true,
};
function sha256(file) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}
const originals = ["package.json", "package-lock.json", "apps/mobile/package.json"]
  .map((p) => [p, sha256(path.join(root, p))]);
function copy(relative) {
  const from = path.join(root, relative);
  const to = path.join(temp, relative);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}
function npm(args, limitMs) {
  const done = spawnSync("npm", args, {
    cwd: temp, encoding: "utf8", timeout: limitMs, maxBuffer: 32 * 1024 * 1024,
    env: {
      ...process.env,
      CI: "1",
      npm_config_update_notifier: "false",
      npm_config_fund: "false",
    },
  });
  return done;
}
function packageInstances(lock, name) {
  const suffix = "node_modules/" + name;
  return Object.entries(lock.packages || {})
    .filter(([p, info]) => (p === suffix || p.endsWith("/" + suffix)) &&
      typeof info.version === "string")
    .map(([p, info]) => ({ path: p, version: info.version }))
    .sort((a, b) => a.path.localeCompare(b.path));
}
function pinnedVersions(lock, name) {
  const versions = new Set();
  for (const [p, info] of Object.entries(lock.packages || {})) {
    if ((p === "node_modules/" + name || p.endsWith("/node_modules/" + name)) &&
        typeof info.version === "string") {
      versions.add(info.version);
    }
  }
  return [...versions].sort();
}
try {
  copy("package.json");
  copy("package-lock.json");
  for (const pattern of rootPackage.workspaces || []) {
    assert.match(pattern, /^(?:apps|packages|tools)\/\*$/,
      "unexpected workspace pattern: refuse copying unknown locations");
    const folder = path.join(root, pattern.slice(0, -2));
    if (!fs.existsSync(folder)) continue;
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      if (entry.isSymbolicLink() || !entry.isDirectory()) continue;
      const relative = path.join(pattern.slice(0, -2), entry.name, "package.json");
      if (fs.existsSync(path.join(root, relative))) copy(relative);
    }
  }
  // This is a genuine resolver-generated lockfile, not a handcrafted
  // replacement or an npm override of vulnerable packages.
  const install = npm([
    "install", candidateSpec, "--workspace", "@bejewely/mobile",
    "--package-lock-only", "--ignore-scripts", "--no-fund", "--no-audit",
  ], 210000);
  result.install = {
    exitCode: install.status,
    timedOut: install.error?.code === "ETIMEDOUT",
    spawnError: install.error?.code || null,
  };
  if (install.status !== 0) {
    result.state = "CANDIDATE_LOCK_RESOLUTION_FAILED";
  } else {
    const candidateLock = JSON.parse(fs.readFileSync(path.join(temp, "package-lock.json"), "utf8"));
    const mobile = JSON.parse(fs.readFileSync(path.join(temp, "apps/mobile/package.json"), "utf8"));
    result.candidateResolved = true;
    result.candidateLockSha256 = sha256(path.join(temp, "package-lock.json"));
    result.expoSpec = mobile.dependencies?.expo || "UNKNOWN";
    // Root hoisting can retain an older Expo version when npm places the
    // workspace-updated version under apps/mobile/node_modules. All paths
    // matter, not only the root node_modules slot.
    result.expoInstances = packageInstances(candidateLock, "expo");
    result.expoCliInstances = packageInstances(candidateLock, "@expo/cli");
    const workspaceExpo = candidateLock.packages?.["apps/mobile/node_modules/expo"]?.version;
    const hoistedExpo = candidateLock.packages?.["node_modules/expo"]?.version;
    result.mobileResolvedExpo = workspaceExpo || hoistedExpo || "UNKNOWN";
    result.candidateTargetVersionResolved = /^57\.0\.(?:2[8-9]|[3-9][0-9])$/.test(
      result.mobileResolvedExpo);

    for (const name of targets) {
      result.targetPackages[name] = {
        initialVersions: pinnedVersions(baseline, name),
        candidateVersions: pinnedVersions(candidateLock, name),
      };
    }
    let auditsReadable = true;
    for (const [kind, flags] of auditKinds) {
      const audit = npm(["audit", "--json", ...flags], 120000);
      const record = {
        exitCode: audit.status,
        timedOut: audit.error?.code === "ETIMEDOUT",
        readable: false,
      };
      try {
        const parsed = JSON.parse(audit.stdout);
        if (parsed?.metadata?.vulnerabilities) {
          const v = parsed.metadata.vulnerabilities;
          record.readable = true;
          record.high = v.high;
          record.critical = v.critical;
          record.moderate = v.moderate;
          record.total = v.total;
          record.bracesAdvisoryPresent = Boolean(parsed.vulnerabilities?.braces);
          record.forgeAdvisoryPresent = Boolean(parsed.vulnerabilities?.["node-forge"]);
        }
      } catch {
        // Results remain UNKNOWN. Do not replace a failed audit with a PASS.
      }
      result.audits[kind] = record;
      if (!record.readable) auditsReadable = false;
    }
    result.state = !result.candidateTargetVersionResolved ?
      "CANDIDATE_EXPO_WORKSPACE_VERSION_NOT_RESOLVED_HOLD" :
      !auditsReadable ? "CANDIDATE_AUDIT_UNREADABLE_HOLD" :
      auditKinds.every(([kind]) => result.audits[kind].high === 0 &&
        result.audits[kind].critical === 0) ?
        "RAW_HIGH_CRITICAL_ZERO_REQUIRES_COMPATIBILITY_REVIEW" :
        "CANDIDATE_STILL_HAS_HIGH_OR_CRITICAL_HOLD";
  }
} catch (e) {
  result.state = "CANDIDATE_EXPERIMENT_ERROR_HOLD";
  result.errorType = e?.name || "Error";
} finally {
  result.packageLockChangedInSourceTree = originals.some(([p, digest]) =>
    sha256(path.join(root, p)) !== digest);
  result.originalAdvisoryGateUnchanged = !result.packageLockChangedInSourceTree;
  fs.rmSync(temp, { recursive: true, force: true });
  console.log("SCA_EXPO57_OFFICIAL_CANDIDATE=" + JSON.stringify(result));
  if (!result.originalAdvisoryGateUnchanged) process.exitCode = 1;
}
