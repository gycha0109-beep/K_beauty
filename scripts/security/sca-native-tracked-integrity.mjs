/**
 * Read-only Git tracked-file integrity observation for disposable SCA-3 CI.
 * No textconv, external diff, network, file contents, or mutation.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

export function trackedChangesAtHead(repositoryRoot) {
  const result = spawnSync("git", [
    "-C", repositoryRoot, "diff", "--no-ext-diff", "--no-textconv",
    "--name-only", "-z", "HEAD", "--",
  ], {
    encoding: "buffer",
    timeout: 15000,
    maxBuffer: 1024 * 1024,
  });
  assert.equal(result.error, undefined, "cannot inspect tracked-file integrity");
  assert.equal(result.status, 0, "git tracked-file observation failed closed");
  const files = result.stdout.toString("utf8").split("\0").filter(Boolean);
  return [...new Set(files)].sort();
}

export function unexpectedTrackedChanges(before, after) {
  assert.ok(Array.isArray(before) && Array.isArray(after),
    "tracked-file snapshots required");
  const existing = new Set(before);
  return after.filter((file) => !existing.has(file)).sort();
}
