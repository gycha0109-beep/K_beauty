#!/usr/bin/env node

import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const verifierDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(verifierDir, "../..");
const verifierPattern = /^verify-trust-p\d.*\.mjs$/;

const verifiers = readdirSync(verifierDir)
  .filter((name) => verifierPattern.test(name))
  .filter((name) => name !== "verify-trust-historical-evidence.mjs")
  .sort();

assert.equal(
  verifiers.length,
  33,
  `TRUST historical verifier inventory changed: expected 33, found ${verifiers.length}`
);

for (const verifier of verifiers) {
  console.log(`\n=== TRUST historical evidence: ${verifier} ===`);
  const result = spawnSync(process.execPath, [join(verifierDir, verifier)], {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${verifier} failed with exit code ${result.status}`);
  }
}

console.log(`\nTRUST_HISTORICAL_EVIDENCE=PASS (${verifiers.length} verifiers)`);
