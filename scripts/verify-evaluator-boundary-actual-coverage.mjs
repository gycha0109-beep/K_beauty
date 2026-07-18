import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const OUTPUT_PATH = "tmp/evaluator-boundary-actual-coverage.json";

function runCollector() {
  return execFileSync(process.execPath, ["scripts/collect-evaluator-boundary-actual-coverage.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8"
  });
}

function readOutput() {
  return JSON.parse(readFileSync(OUTPUT_PATH, "utf8"));
}

function stableOutput(output) {
  const clone = JSON.parse(JSON.stringify(output));
  delete clone.generatedAt;
  return clone;
}

function runCase(name, fn) {
  fn();
  console.log(`ok - ${name}`);
}

const stdout = runCollector();
const output = readOutput();

runCase("collector executes and output JSON exists", () => {
  assert.ok(stdout.includes("evaluator-boundary-actual-coverage summary"));
  assert.equal(existsSync(OUTPUT_PATH), true);
});

runCase("actual evidence presence or absence is represented explicitly", () => {
  assert.ok(output.captureSummary.totalFilesScanned >= output.captureSummary.completeProductRowFixturesUsed);
  assert.equal(typeof output.actualEvidenceAvailable, "boolean");
  if (output.actualEvidenceAvailable) {
    assert.equal(output.evidenceType, "actual_complete_product_row_capture");
    assert.ok(output.captureSummary.completeProductRowFixturesUsed > 0);
  } else {
    assert.equal(output.evidenceType, "actual_capture_coverage_unavailable");
    assert.equal(output.captureSummary.completeProductRowFixturesUsed, 0);
    assert.ok(output.limitations.includes("actual_complete_product_row_capture_not_available_in_clean_checkout"));
  }
});

runCase("candidate and boundary counts are internally consistent", () => {
  assert.ok(output.candidateSummary.totalCandidateRows >= 0);
  assert.ok(output.candidateSummary.boundaryApplicableRows >= 0);
  if (output.actualEvidenceAvailable) {
    assert.ok(output.candidateSummary.totalCandidateRows > 0);
    assert.ok(output.candidateSummary.boundaryApplicableRows > 0);
  } else {
    assert.equal(output.candidateSummary.totalCandidateRows, 0);
    assert.equal(output.candidateSummary.boundaryApplicableRows, 0);
  }
  assert.equal(output.candidateSummary.boundaryApplicableRows, output.candidateSummary.reviewedRows);
  const decisionTotal = Object.values(output.decisionSummary).reduce((sum, value) => sum + value, 0);
  assert.equal(decisionTotal, output.candidateSummary.boundaryApplicableRows);
});

runCase("gap buckets are observed or explicitly marked as not observed", () => {
  for (const [key, bucket] of Object.entries(output.gapCoverage)) {
    assert.ok(["observed_in_current_actual_captures", "not_observed_in_current_actual_captures"].includes(bucket.status), key);
    if (!bucket.observed) {
      assert.equal(bucket.status, "not_observed_in_current_actual_captures");
    }
  }
});

runCase("high-risk actual candidates are not downgraded to collapsed", () => {
  assert.equal(output.highRiskProtection.highRiskCollapsedCount, 0);
  assert.equal(output.highRiskProtection.passed, true);
});

runCase("metadata incomplete actual candidates are not treated as hard block or collapsed by boundary policy", () => {
  const bucket = output.gapCoverage.metadataIncomplete;
  if (bucket.observed) {
    assert.equal(bucket.decisionDistribution.preserve_hard_block || 0, 0);
    assert.equal(bucket.decisionDistribution.downgrade_to_collapsed_candidate || 0, 0);
  }
});

runCase("safe_low_risk hidden candidates, when observed, are not reclassified as high risk", () => {
  const bucket = output.gapCoverage.safeLowRiskHidden;
  if (bucket.observed) {
    assert.ok(bucket.totalRows > 0);
    assert.equal(bucket.unsafeMetadataRows, 0);
    assert.equal(bucket.safetyMetadataProfileDistribution.safe_low_risk, bucket.totalRows);
  }
});

runCase("raw form, image, PII, product names, brands, URLs, and review text are not emitted", () => {
  const raw = readFileSync(OUTPUT_PATH, "utf8").toLowerCase();
  [
    "raw form",
    "base64",
    "filename",
    "image_url",
    "email",
    "session",
    "cookie",
    "user-agent",
    "product name",
    "brand",
    "purchase url",
    "review text"
  ].forEach((token) => assert.equal(raw.includes(token), false, token));
});

runCase("collector output is deterministic apart from generatedAt", () => {
  const first = stableOutput(output);
  runCollector();
  const second = stableOutput(readOutput());

  assert.deepEqual(first, second);
});

runCase("runtime files are not connected to the actual coverage collector", () => {
  const route = readFileSync("app/api/analyze/route.js", "utf8");
  const evaluator = readFileSync("lib/functional-ranking-contract.js", "utf8");
  const candidatePolicy = readFileSync("lib/functional-candidate-policy.js", "utf8");
  const page = readFileSync("app/page.js", "utf8");
  const joined = [route, evaluator, candidatePolicy, page].join("\n");

  assert.equal(joined.includes("collect-evaluator-boundary-actual-coverage"), false);
  assert.equal(route.includes("evaluator-boundary-actual-coverage"), false);
  assert.equal(evaluator.includes("evaluator-boundary-actual-coverage"), false);
  assert.equal(candidatePolicy.includes("evaluator-boundary-actual-coverage"), false);
  assert.equal(page.includes("evaluator-boundary-actual-coverage"), false);
});
