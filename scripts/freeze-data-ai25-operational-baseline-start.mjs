#!/usr/bin/env node

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const CONFIRMATION = "I_CONFIRM_REAL_SERVICE_LAUNCH";
const SHA_PATTERN = /^[0-9a-f]{40}$/i;
const DEPLOYMENT_ID_PATTERN = /^dpl_[A-Za-z0-9]+$/;

function parseArgs(argv = process.argv.slice(2)) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) continue;
    const separatorIndex = value.indexOf("=");
    if (separatorIndex > 2) {
      args[value.slice(2, separatorIndex)] = value.slice(separatorIndex + 1);
      continue;
    }
    const key = value.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      index += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function parseIsoTimestamp(value) {
  const raw = String(value || "").trim();
  assert.ok(raw, "--launched-at is required");
  const parsed = Date.parse(raw);
  assert.ok(Number.isFinite(parsed), "--launched-at must be a valid timestamp");
  return new Date(parsed).toISOString();
}

function requiredString(args, name) {
  const value = String(args[name] || "").trim();
  assert.ok(value, `--${name} is required`);
  return value;
}

const args = parseArgs();

assert.equal(
  String(args.confirm || ""),
  CONFIRMATION,
  "explicit real-service launch confirmation is required"
);

const operationalBaselineStartAt = parseIsoTimestamp(args["launched-at"]);
const deploymentSha = requiredString(args, "deployment-sha").toLowerCase();
const deploymentId = requiredString(args, "deployment-id");

assert.match(deploymentSha, SHA_PATTERN, "--deployment-sha must be a full Git SHA");
assert.match(deploymentId, DEPLOYMENT_ID_PATTERN, "--deployment-id must be a Vercel deployment id");

const outputPath = resolve(
  String(args.output || "tmp/data-ai25/operational-baseline-start.json")
);

const boundary = Object.freeze({
  boundaryVersion: "data-ai25-operational-baseline-start-v1",
  phase: "DATA-AI25",
  state: "operational_baseline_started",
  operationalBaselineStartAt,
  deploymentId,
  deploymentSha,
  source: "real_service_launch_manual_confirmation",
  preBaselineQaExcluded: true,
  syntheticTrafficMaySatisfyBaseline: false,
  cohortExpansionAuthorized: false,
  publicCutoverAuthorized: false
});

if (existsSync(outputPath)) {
  const existing = JSON.parse(await readFile(outputPath, "utf8"));
  const sameBoundary =
    existing?.boundaryVersion === boundary.boundaryVersion &&
    existing?.phase === boundary.phase &&
    existing?.operationalBaselineStartAt === boundary.operationalBaselineStartAt &&
    existing?.deploymentId === boundary.deploymentId &&
    existing?.deploymentSha === boundary.deploymentSha;

  assert.ok(
    sameBoundary,
    "operational baseline boundary is already frozen with different values"
  );

  process.stdout.write(`${JSON.stringify(existing, null, 2)}\n`);
  process.exit(0);
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(boundary, null, 2)}\n`, {
  encoding: "utf8",
  flag: "wx",
  mode: 0o600
});

process.stdout.write(`${JSON.stringify(boundary, null, 2)}\n`);
