#!/usr/bin/env node
/** Negative fixtures for the whole tracked-tree SCA-3 prebuild guard. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { trackedChangesAtHead, unexpectedTrackedChanges } from "./sca-native-tracked-integrity.mjs";

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "bejewely-sca-native-integrity-"));
const git = (...args) => {
  const done = spawnSync("git", ["-C", temp, ...args], {
    encoding: "utf8", timeout: 15000,
  });
  assert.equal(done.status, 0, "fixture git setup failed");
};
try {
  git("init", "-q");
  const mobile = path.join(temp, "apps", "mobile");
  fs.mkdirSync(mobile, { recursive: true });
  const pkg = path.join(mobile, "package.json");
  const config = path.join(mobile, "app.json");
  fs.writeFileSync(pkg, '{"name":"fixture"}\n');
  fs.writeFileSync(config, '{"expo":{}}\n');
  git("add", "apps/mobile/package.json", "apps/mobile/app.json");
  git("-c", "user.email=fixture@example.invalid", "-c", "user.name=Fixture",
    "commit", "-q", "-m", "synthetic initial fixture");

  const baseline = trackedChangesAtHead(temp);
  assert.deepEqual(baseline, []);
  fs.writeFileSync(pkg, '{"name":"rewritten-by-prebuild"}\n');
  assert.deepEqual(trackedChangesAtHead(temp), ["apps/mobile/package.json"]);
  fs.writeFileSync(pkg, '{"name":"fixture"}\n');
  assert.deepEqual(trackedChangesAtHead(temp), [], "restored input is clean");

  // Non-whitelisted tracked files must not be silently ignored.
  fs.writeFileSync(config, '{"expo":{"unexpected":true}}\n');
  assert.deepEqual(trackedChangesAtHead(temp), ["apps/mobile/app.json"]);
  assert.deepEqual(
    unexpectedTrackedChanges([], trackedChangesAtHead(temp)),
    ["apps/mobile/app.json"],
  );
  fs.rmSync(config);
  assert.deepEqual(trackedChangesAtHead(temp), ["apps/mobile/app.json"]);
  fs.writeFileSync(config, '{"expo":{}}\n');
  assert.deepEqual(trackedChangesAtHead(temp), []);

  // Untracked generated native files are not treated as modifications to
  // repository-controlled sources. Cleanup is enforced separately.
  const android = path.join(mobile, "android");
  fs.mkdirSync(android);
  fs.writeFileSync(path.join(android, "generated.txt"), "fixture\n");
  assert.deepEqual(trackedChangesAtHead(temp), []);
  assert.deepEqual(unexpectedTrackedChanges([], []), []);
  console.log("SCA_NATIVE_TRACKED_INTEGRITY_TEST=PASS cases=6 disposable-only");
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
