#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { stdin } from "node:process";
import {
  DATA_AI20_MAX_APPROVED_ACCOUNTS
} from "../lib/product-query-authenticated-beta-controlled-activation.mjs";
import {
  aggregateProductQueryOperationalBaseline,
  parseProductQueryOperationalBaselineStartAt
} from "../lib/product-query-beta-operational-baseline.mjs";
import {
  evaluateProductQueryOperationalReadiness
} from "../lib/product-query-beta-operational-readiness-evaluator.mjs";
import {
  PRODUCT_QUERY_BETA_QUALITY_ACCEPTANCE_EVIDENCE
} from "../lib/product-query-beta-quality-acceptance-evidence.mjs";
import {
  PRODUCT_QUERY_OPERATIONAL_OBSERVABILITY
} from "../lib/product-query-operational-observability.mjs";

const PRODUCTION_CONFIRMATION = "I_CONFIRM_REAL_PRODUCTION_OBSERVATIONS";
const PRODUCTION_SOURCE = "production-vercel-runtime";

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

function parseNonNegativeInteger(value, label) {
  const raw = String(value ?? "").trim();
  assert.ok(raw, `--${label} is required`);
  const parsed = Number(raw);
  assert.ok(
    Number.isInteger(parsed) && parsed >= 0,
    `--${label} must be a non-negative integer`
  );
  return parsed;
}

async function readStdin() {
  let raw = "";
  stdin.setEncoding("utf8");
  for await (const chunk of stdin) raw += chunk;
  assert.ok(
    raw.trim(),
    "DATA-AI25 expects a JSON array of already-extracted DATA-AI24 safe Production events on stdin"
  );
  const parsed = JSON.parse(raw);
  assert.ok(Array.isArray(parsed), "DATA-AI25 Production observations must be a JSON array");
  return parsed;
}

const args = parseArgs();

assert.equal(
  String(args.source || ""),
  PRODUCTION_SOURCE,
  `--source must be ${PRODUCTION_SOURCE}`
);
assert.equal(
  String(args.confirm || ""),
  PRODUCTION_CONFIRMATION,
  "explicit real Production observation confirmation is required"
);

const boundaryPath = resolve(
  String(args.boundary || "tmp/data-ai25/operational-baseline-start.json")
);
const boundary = JSON.parse(await readFile(boundaryPath, "utf8"));

assert.equal(
  boundary?.boundaryVersion,
  "data-ai25-operational-baseline-start-v1",
  "invalid DATA-AI25 launch boundary version"
);
assert.equal(boundary?.phase, "DATA-AI25", "launch boundary phase mismatch");
assert.equal(
  boundary?.state,
  "operational_baseline_started",
  "launch boundary is not active"
);
assert.equal(
  boundary?.preBaselineQaExcluded,
  true,
  "launch boundary must exclude pre-baseline QA"
);
assert.equal(
  boundary?.syntheticTrafficMaySatisfyBaseline,
  false,
  "launch boundary must reject synthetic baseline authority"
);
assert.equal(
  boundary?.cohortExpansionAuthorized,
  false,
  "launch boundary must not authorize cohort expansion"
);
assert.equal(
  boundary?.publicCutoverAuthorized,
  false,
  "launch boundary must not authorize public cutover"
);

const operationalBaselineStartAt =
  parseProductQueryOperationalBaselineStartAt(
    boundary?.operationalBaselineStartAt
  );
assert.ok(operationalBaselineStartAt, "launch boundary timestamp is invalid");

const securityRegressionCount = parseNonNegativeInteger(
  args["security-regression-count"],
  "security-regression-count"
);
const persistenceLeakageCount = parseNonNegativeInteger(
  args["persistence-leakage-count"],
  "persistence-leakage-count"
);

const events = await readStdin();
const baseline = aggregateProductQueryOperationalBaseline(events, {
  operationalBaselineStartAt
});

const controls = Object.freeze({
  securityRegressionCount,
  persistenceLeakageCount,
  semanticQualityAccepted:
    PRODUCT_QUERY_BETA_QUALITY_ACCEPTANCE_EVIDENCE.accepted === true &&
    PRODUCT_QUERY_BETA_QUALITY_ACCEPTANCE_EVIDENCE.phase === "DATA-AI22",
  observabilityPrivacyAccepted:
    PRODUCT_QUERY_OPERATIONAL_OBSERVABILITY.phase === "DATA-AI24" &&
    PRODUCT_QUERY_OPERATIONAL_OBSERVABILITY.persistence === "none" &&
    PRODUCT_QUERY_OPERATIONAL_OBSERVABILITY.rawQuery === false &&
    PRODUCT_QUERY_OPERATIONAL_OBSERVABILITY.userIdentity === false,
  currentMaxApprovedAccounts: DATA_AI20_MAX_APPROVED_ACCOUNTS
});

const readiness = evaluateProductQueryOperationalReadiness(
  baseline,
  controls
);

const evidence = Object.freeze({
  evaluationVersion: "data-ai25-post-launch-evaluation-v1",
  phase: "DATA-AI25",
  source: PRODUCTION_SOURCE,
  launchBoundary: Object.freeze({
    operationalBaselineStartAt,
    deploymentId: boundary.deploymentId,
    deploymentSha: boundary.deploymentSha,
    preBaselineQaExcluded: true
  }),
  baseline,
  readiness,
  authority: Object.freeze({
    syntheticTrafficAccepted: false,
    rawRuntimeLogsPersisted: false,
    cohortExpansionAuthorized: false,
    publicCutoverAuthorized: false
  })
});

process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
