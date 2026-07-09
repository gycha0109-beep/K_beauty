import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUTPUT_PATH = path.join(ROOT, "tmp", "product-source-config-trace.json");
const FORBIDDEN_RUNTIME_FILES = [
  "app/api/analyze/route.js",
  "lib/skin-match-decision-engine.js",
  "lib/functional-ranking-contract.js",
  "lib/functional-candidate-policy.js",
  "app/page.js",
  "app/result/page.js",
  "app/result/full-report/page.js"
];
const FORBIDDEN_OUTPUT_PATTERNS = [
  /https?:\/\//i,
  /eyJ[A-Za-z0-9_-]{20,}/,
  /base64,/i,
  /raw review text/i,
  /purchase url/i,
  /buy_link"\s*:/i,
  /image_url"\s*:/i,
  /oliveyoung/i,
  /cookie"\s*:/i,
  /email"\s*:/i,
  /Bearer\s+[A-Za-z0-9._-]+/i
];

function runTrace() {
  execFileSync(process.execPath, ["scripts/trace-product-source-config.mjs"], {
    cwd: ROOT,
    stdio: "ignore",
    env: process.env
  });
  assert(existsSync(OUTPUT_PATH), "product source config trace output JSON should exist");
  return JSON.parse(readFileSync(OUTPUT_PATH, "utf8"));
}

function stripVolatile(artifact) {
  return {
    ...artifact,
    generatedAt: "<stable>"
  };
}

function assertNoLeakage(artifact) {
  const serialized = JSON.stringify(artifact);

  for (const pattern of FORBIDDEN_OUTPUT_PATTERNS) {
    assert(!pattern.test(serialized), `trace output leaked forbidden pattern: ${pattern}`);
  }

  for (const key of artifact.requiredConfigKeys || []) {
    assert.equal(key.valuePrinted, false, `${key.keyName} should not print values`);
  }

  for (const file of artifact.envFilesInspected || []) {
    assert.equal(file.valuesPrinted, false, `${file.fileName} should not print values`);
  }
}

function assertTraceContract(artifact) {
  assert.equal(artifact.traceVersion, "product-source-config-trace-v1");
  assert.equal(artifact.routeInvoked, false);
  assert.equal(artifact.apiAnalyzeInvoked, false);
  assert.equal(artifact.supabaseWriteExecuted, false);
  assert.equal(artifact.runtimeMutation, false);
  assert.equal(artifact.syntheticProductsUsed, false);
  assert(Array.isArray(artifact.filesInspected) && artifact.filesInspected.length > 0);
  assert(Array.isArray(artifact.productSourceEntrypoints) && artifact.productSourceEntrypoints.length > 0);
  assert(Array.isArray(artifact.requiredConfigKeys) && artifact.requiredConfigKeys.length >= 4);
  assert(artifact.routeProductSourcePath && typeof artifact.routeProductSourcePath === "object");
  assert(artifact.scriptProductSourcePath && typeof artifact.scriptProductSourcePath === "object");
  assert(artifact.readOnlyQueryFeasibility && typeof artifact.readOnlyQueryFeasibility === "object");
  assert(artifact.localFixtureFeasibility && typeof artifact.localFixtureFeasibility === "object");
  assert(artifact.scorerCompatibleContractSummary && typeof artifact.scorerCompatibleContractSummary === "object");
  assert(artifact.recommendedSourceStrategy && typeof artifact.recommendedSourceStrategy === "object");
  assert(Array.isArray(artifact.limitations) && artifact.limitations.length > 0);

  assert(
    artifact.missingConfigReasons.length > 0 ||
      ["available", "unavailable"].includes(artifact.readOnlyQueryFeasibility.currentStatus),
    "trace should include missingConfigReasons or read-only availability"
  );
}

function assertNoForbiddenFileChanges() {
  const changedFiles = execFileSync("git", ["diff", "--name-only"], {
    cwd: ROOT,
    encoding: "utf8"
  })
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const file of FORBIDDEN_RUNTIME_FILES) {
    assert(!changedFiles.includes(file), `${file} should not be modified by Phase 24`);
  }

  assert(
    changedFiles.every((file) => !file.startsWith("data/")),
    "product data source files should not be modified"
  );
  assert(
    changedFiles.every((file) => !file.startsWith("supabase/")),
    "Supabase schema/migration files should not be modified"
  );
}

function assertReadOnlySmokeShape(artifact) {
  const smoke = artifact.readOnlyAvailabilitySmoke;
  assert(smoke && typeof smoke === "object", "readOnlyAvailabilitySmoke should exist");
  assert(["available", "unavailable"].includes(smoke.status), "invalid smoke status");
  assert.equal(smoke.serviceRoleRequired, false, "read-only product source should not require service role");
  assert.equal(smoke.productDataPrinted, false, "product row data should not be printed");

  if (smoke.status === "available") {
    assert(smoke.rowsRead >= 0, "rowsRead should be numeric");
    assert(smoke.rowCount >= smoke.scorerCompatibleCount);
    assert(smoke.fieldCoverage && typeof smoke.fieldCoverage === "object");
  } else {
    assert(smoke.reason, "unavailable smoke should include safe reason key");
  }
}

function main() {
  const first = runTrace();
  assertTraceContract(first);
  assertReadOnlySmokeShape(first);
  assertNoLeakage(first);
  assertNoForbiddenFileChanges();

  const second = runTrace();
  assert.deepEqual(
    stripVolatile(first),
    stripVolatile(second),
    "product source config trace should be deterministic apart from generatedAt"
  );

  console.log("verify-product-source-config-trace passed");
}

main();
