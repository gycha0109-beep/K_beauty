import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUTPUT_PATH = path.join(ROOT, "tmp", "evaluator-boundary-readiness-review.json");
const MD_OUTPUT_PATH = path.join(ROOT, "tmp", "evaluator-boundary-readiness-review.md");
const READINESS_STATUSES = new Set([
  "ready_for_boundary_integration_design",
  "needs_more_evidence_before_design",
  "blocked_by_safety_regression",
  "blocked_by_runtime_mutation",
  "blocked_by_source_unavailability"
]);
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
  /base64/i,
  /raw form/i,
  /"name"\s*:/i,
  /"brand"\s*:/i,
  /"buy_link"\s*:/i,
  /"image_url"\s*:/i,
  /purchase\s*url/i,
  /review\s*text/i,
  /oliveyoung/i,
  /email/i,
  /cookie/i,
  /user-agent/i,
  /user agent/i,
  /Bearer\s+[A-Za-z0-9._-]+/i
];

function runReview() {
  const stdout = execFileSync(process.execPath, ["scripts/review-evaluator-boundary-readiness.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env
  });

  assert(stdout.includes("evaluator-boundary-readiness-review summary"));
  assert(existsSync(OUTPUT_PATH), "readiness review JSON should exist");
  assert(existsSync(MD_OUTPUT_PATH), "readiness review markdown should exist");
  return JSON.parse(readFileSync(OUTPUT_PATH, "utf8"));
}

function stripVolatile(output) {
  return {
    ...output,
    generatedAt: "<stable>"
  };
}

function assertNoLeakage() {
  const serialized = [
    readFileSync(OUTPUT_PATH, "utf8"),
    readFileSync(MD_OUTPUT_PATH, "utf8")
  ].join("\n");

  for (const pattern of FORBIDDEN_OUTPUT_PATTERNS) {
    assert(!pattern.test(serialized), `readiness review leaked forbidden pattern: ${pattern}`);
  }
}

function assertNoForbiddenFileChanges() {
  const phase39Guard = execFileSync(process.execPath, ["scripts/verify-shadow-dry-run-route-static-guard.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env
  });
  assert(phase39Guard.includes("verify-shadow-dry-run-route-static-guard passed"));
  const status = execFileSync("git", ["status", "--short", "--untracked-files=all"], {
    cwd: ROOT,
    encoding: "utf8"
  });
  const changedFiles = status
    .split(/\r?\n/)
    .map((line) => line.slice(3).trim())
    .filter(Boolean);

  for (const file of FORBIDDEN_RUNTIME_FILES) {
    if (file === "app/api/analyze/route.js") {
      continue;
    }
    assert(!changedFiles.includes(file), `${file} should not be modified by readiness review`);
  }

  assert(changedFiles.every((file) => !file.startsWith("data/")), "product data source files should not be modified");
  assert(changedFiles.every((file) => !file.startsWith("supabase/")), "Supabase schema/migration files should not be modified");
}

function assertEvidenceSeparation(output) {
  assert.ok([
    "actual_complete_product_row_capture",
    "actual_capture_coverage_unavailable"
  ].includes(output.actualEvidenceSummary.evidenceType));
  if (output.actualEvidenceSummary.evidenceType === "actual_capture_coverage_unavailable") {
    assert.equal(output.actualEvidenceSummary.actualEvidenceAvailable, false);
    assert.equal(output.actualEvidenceSummary.completeProductRowCaptures, 0);
    assert.equal(output.readinessStatus, "needs_more_evidence_before_design");
    assert(output.readinessReasons.includes(
      "low_risk_downgrade_consistency_was_not_established_across_actual_and_pure_replay_evidence"
    ));
  }
  assert.equal(output.pureReplayEvidenceSummary.evidenceType, "pure_engine_replay");
  assert.equal(output.syntheticCoverageSummary.evidenceType, "synthetic_policy_coverage");
  assert.equal(output.syntheticCoverageSummary.actualEvidence, false);

  assert(Number.isInteger(output.actualEvidenceSummary.completeProductRowCaptures));
  assert(!("completeProductRowCaptures" in output.pureReplayEvidenceSummary));
  assert(!("productRowsLoaded" in output.actualEvidenceSummary));
  assert.equal(output.pureReplayEvidenceSummary.routeInvoked, false);
  assert.equal(output.pureReplayEvidenceSummary.supabaseWriteExecuted, false);
  assert.equal(output.pureReplayEvidenceSummary.runtimeMutation, false);
}

function assertReadinessRules(output) {
  assert(READINESS_STATUSES.has(output.readinessStatus), `invalid readinessStatus: ${output.readinessStatus}`);
  assert.equal(output.routeInvoked, false);
  assert.equal(output.supabaseWriteExecuted, false);
  assert.equal(output.runtimeMutation, false);

  const actualHighRisk = output.safetyRegressionCheck.highRiskCollapsedCountActual;
  const pureHighRisk = output.safetyRegressionCheck.highRiskCollapsedCountPureReplay;
  if (actualHighRisk > 0 || pureHighRisk > 0) {
    assert.notEqual(output.readinessStatus, "ready_for_boundary_integration_design");
  }

  if (output.readinessStatus === "ready_for_boundary_integration_design") {
    assert.equal(output.safetyRegressionCheck.passed, true);
    assert.equal(output.lowRiskDowngradeConsistency.passed, true);
    assert(output.allowedNextStep.includes("evaluator_pass_plus_collapsed_hint_design"));
    assert(output.prohibitedNextStep.includes("evaluator_runtime_change"));
    assert(output.prohibitedNextStep.includes("candidate_policy_runtime_connection"));
  }
}

function assertGapContracts(output) {
  for (const gap of ["activeLeaningOnly", "metadataIncomplete", "serumCategory", "strongCaution"]) {
    assert(output.gapStatus[gap], `${gap} gap status should exist`);
    assert(output.gapStatus[gap].actualStatus, `${gap} missing actual status`);
    assert(output.gapStatus[gap].pureReplayStatus, `${gap} missing pure replay status`);
    assert(output.gapStatus[gap].syntheticCoverage, `${gap} missing synthetic coverage`);
  }

  if (output.gapStatus.metadataIncomplete.actualStatus.startsWith("observed_") ||
    output.gapStatus.metadataIncomplete.pureReplayStatus.startsWith("observed_")) {
    assert.equal(output.syntheticCoverageSummary.cases.metadataIncomplete, "requires_metadata_review");
  }
}

const first = runReview();
assertEvidenceSeparation(first);
assertReadinessRules(first);
assertGapContracts(first);
assertNoLeakage();
assertNoForbiddenFileChanges();

const second = runReview();
assert.deepEqual(
  stripVolatile(first),
  stripVolatile(second),
  "readiness review output should be deterministic apart from generatedAt"
);

console.log("verify-evaluator-boundary-readiness-review passed");
