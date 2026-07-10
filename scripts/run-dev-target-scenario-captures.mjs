import { execFileSync } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.cwd();
const CAPTURE_DIR = process.env.FUNCTIONAL_SHADOW_CAPTURE_DIR ||
  path.join(ROOT, "tmp", "functional-shadow-captures");
const OUTPUT_DIR = path.join(ROOT, "tmp");
const PLAN_PATH = path.join(OUTPUT_DIR, "evaluator-boundary-target-capture-plan.json");
const COVERAGE_PATH = path.join(OUTPUT_DIR, "evaluator-boundary-actual-coverage.json");
const JSON_OUTPUT = path.join(OUTPUT_DIR, "evaluator-boundary-dev-target-captures.json");
const MD_OUTPUT = path.join(OUTPUT_DIR, "evaluator-boundary-dev-target-captures.md");
const IMAGE_FIXTURE = path.join(ROOT, "public", "test-assets", "kakao-test-face.png");

const ARTIFACT_JSON = new Set([
  "replay-summary.json",
  "aggregate-summary.json",
  "summary.json",
  "divergence-policy-review.json",
  "safety-review-packet.json",
  "safety-review-analysis.json",
  "recent-instability-guard-matrix.json",
  "candidate-exposure-audit.json",
  "exposure-readiness-review.json",
  "evaluator-hard-block-review.json",
  "evaluator-recent-instability-boundary-shadow.json"
]);

function increment(map, key, amount = 1) {
  const normalized = String(key || "unknown").trim().toLowerCase() || "unknown";
  map[normalized] = (map[normalized] || 0) + amount;
}

function sortObject(input = {}) {
  return Object.fromEntries(Object.entries(input).sort(([left], [right]) => left.localeCompare(right)));
}

function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sortDeep(item)])
    );
  }
  return value;
}

async function readJsonIfPresent(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function ensurePlan() {
  const existing = await readJsonIfPresent(PLAN_PATH);
  if (existing?.planVersion === "evaluator-boundary-target-capture-plan-v1") {
    return existing;
  }

  execFileSync(process.execPath, ["scripts/plan-evaluator-boundary-target-captures.mjs"], {
    cwd: ROOT,
    stdio: "ignore",
    env: process.env
  });

  return readJsonIfPresent(PLAN_PATH);
}

async function ensureCoverage() {
  execFileSync(process.execPath, ["scripts/collect-evaluator-boundary-actual-coverage.mjs"], {
    cwd: ROOT,
    stdio: "ignore",
    env: process.env
  });

  return readJsonIfPresent(COVERAGE_PATH);
}

async function scanCaptureSummary() {
  const summary = {
    totalJsonFilesScanned: 0,
    completeProductRowFixtures: 0,
    completeProductRowCaptureIds: [],
    excludedFixtureCounts: {}
  };

  let entries = [];
  try {
    entries = await readdir(CAPTURE_DIR, { withFileTypes: true });
  } catch {
    return {
      ...summary,
      missingCaptureDir: true,
      excludedFixtureCounts: {}
    };
  }

  const names = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort();
  summary.totalJsonFilesScanned = names.length;

  for (const name of names) {
    const fixture = ARTIFACT_JSON.has(name) ? null : await readJsonIfPresent(path.join(CAPTURE_DIR, name));

    if (!fixture || fixture.captureVersion !== "v1") {
      increment(summary.excludedFixtureCounts, ARTIFACT_JSON.has(name) ? "analysis_or_summary_artifact" : "malformed_or_non_capture_json");
      continue;
    }

    const source = fixture.candidateSource || {};
    if (source.completeness === "complete" && source.candidateIdentityMode === "product_row") {
      summary.completeProductRowFixtures += 1;
      summary.completeProductRowCaptureIds.push(fixture.captureId || name.replace(/\.json$/, ""));
    } else {
      increment(summary.excludedFixtureCounts, source.completeness || "unsupported_capture_source");
    }
  }

  summary.completeProductRowCaptureIds.sort();
  summary.excludedFixtureCounts = sortObject(summary.excludedFixtureCounts);
  return summary;
}

function detectRequestContract() {
  const routePath = path.join(ROOT, "app", "api", "analyze", "route.js");
  const route = readFileSync(routePath, "utf8");
  const requiredFields = [];

  for (const field of [
    "image",
    "skinType",
    "sensitivity",
    "mainConcerns",
    "primaryConcern",
    "recentSkinChange",
    "recentlyChangedProduct",
    "cleansingFrequency",
    "preferredTexture",
    "postWashFeeling",
    "afternoonSkinChange",
    "mostDislikedFeel"
  ]) {
    if (route.includes(`formData.get("${field}")`) || route.includes(`formData.get("${field}`)) {
      requiredFields.push(field);
    }
  }

  return {
    endpoint: "/api/analyze",
    method: "POST",
    payloadType: "multipart/form-data",
    imageRequired: route.includes("!image") && route.includes("validateImageUpload(image)"),
    imageFixtureAvailable: existsSync(IMAGE_FIXTURE),
    requiredOrSupportedFields: Array.from(new Set(requiredFields)).sort(),
    idempotencyHeaderRequired: route.includes("guardAnalysisRequest") &&
      readFileSync(path.join(ROOT, "lib", "security", "analysis-request-guard.js"), "utf8")
        .includes("validateIdempotencyKey")
  };
}

function detectDbMutationRisk() {
  const route = readFileSync(path.join(ROOT, "app", "api", "analyze", "route.js"), "utf8");
  const guard = readFileSync(path.join(ROOT, "lib", "security", "analysis-request-guard.js"), "utf8");
  const premiumSession = readFileSync(path.join(ROOT, "lib", "premium-report-session.js"), "utf8");

  const detectedPaths = [];
  if (route.includes("guardAnalysisRequest") && guard.includes('rpc("consume_analysis_rate_limits"')) {
    detectedPaths.push("analysis_guard_rate_limit_rpc");
  }
  if (route.includes("guardAnalysisRequest") && guard.includes('rpc("claim_analysis_idempotency"')) {
    detectedPaths.push("analysis_guard_idempotency_rpc");
  }
  if (route.includes("completeAnalysisRequestGuard") && guard.includes('rpc("complete_analysis_idempotency"')) {
    detectedPaths.push("analysis_guard_completion_rpc");
  }
  if (route.includes("createPremiumReportSession") && premiumSession.includes(".insert({")) {
    detectedPaths.push("premium_report_store_insert");
  }
  if (route.includes("createPremiumReportSession") && premiumSession.includes(".delete()")) {
    detectedPaths.push("premium_report_store_prune_delete");
  }

  return {
    hasMutationRisk: detectedPaths.length > 0,
    detectedPaths: detectedPaths.sort()
  };
}

function scenarioResultsFromPlan(plan, status, reason) {
  return (plan?.proposedScenarios || []).map((scenario) => ({
    scenarioId: scenario.scenarioId,
    status,
    reason,
    expectedGapTargets: scenario.expectedGapTargets || []
  }));
}

function newCompleteCaptureIds(before, after) {
  const beforeSet = new Set(before.completeProductRowCaptureIds || []);
  return (after.completeProductRowCaptureIds || []).filter((captureId) => !beforeSet.has(captureId)).sort();
}

function makeMarkdown(result) {
  const scenarioRows = result.scenarioResults
    .map((scenario) => `| ${scenario.scenarioId} | ${scenario.status} | ${scenario.reason} |`)
    .join("\n");
  const gapCoverage = result.coverageAfterRun?.gapCoverage || {};
  const gapRows = Object.entries(gapCoverage)
    .filter(([gap]) => ["activeLeaningOnly", "metadataIncomplete", "serumCategory", "strongCaution", "safeLowRiskHidden"].includes(gap))
    .map(([gap, value]) => `| ${gap} | ${value.status} | ${value.totalRows} | ${value.boundaryApplicableRows} |`)
    .join("\n");

  return `# Evaluator Boundary Dev Target Captures - 2026-07-03

This document records a dev-only target scenario capture execution attempt. It is not runtime policy approval.

## Execution

- Executed: ${result.executionStatus.executed}
- Skipped: ${result.executionStatus.skipped}
- Skip reason: ${result.executionStatus.skipReason || "none"}
- Server mode: ${result.serverMode}
- Capture flag enabled in this process: ${result.captureFlagEnabled}

## Scenario Results

| Scenario | Status | Reason |
| --- | --- | --- |
${scenarioRows}

## Capture Delta

- Complete/product_row before: ${result.beforeCaptureSummary.completeProductRowFixtures}
- Complete/product_row after: ${result.afterCaptureSummary.completeProductRowFixtures}
- New complete/product_row captures: ${result.newCompleteProductRowCaptures.length}

## Coverage After Run

| Gap | Status | Rows | Boundary-applicable rows |
| --- | --- | ---: | ---: |
${gapRows}

## Runtime

Runtime mutation: ${result.runtimeMutation}

No evaluator, CandidatePolicy, UI/API, product data, route, or fixture-original mutation was applied by this script.
`;
}

export async function runDevTargetScenarioCaptures({ generatedAt = new Date().toISOString() } = {}) {
  const plan = await ensurePlan();
  const beforeCaptureSummary = await scanCaptureSummary();
  const requestContractNotes = detectRequestContract();
  const mutationRisk = detectDbMutationRisk();
  let coverageAfterRun = await ensureCoverage();

  let skipReason = null;
  if (!requestContractNotes.imageFixtureAvailable) {
    skipReason = "capture_run_not_executed_image_fixture_missing";
  } else if (mutationRisk.hasMutationRisk) {
    skipReason = "capture_run_not_executed_db_mutating_guard_path";
  }

  const executed = !skipReason;
  const scenarioResults = executed
    ? scenarioResultsFromPlan(plan, "not_attempted", "actual_execution_not_implemented_without_safe_no_write_path")
    : scenarioResultsFromPlan(plan, "not_attempted", skipReason);
  const afterCaptureSummary = await scanCaptureSummary();
  const newIds = newCompleteCaptureIds(beforeCaptureSummary, afterCaptureSummary);

  coverageAfterRun = coverageAfterRun || await ensureCoverage();

  return sortDeep({
    captureRunVersion: "evaluator-boundary-dev-target-captures-v1",
    generatedAt,
    executionStatus: {
      executed,
      skipped: Boolean(skipReason),
      skipReason
    },
    serverMode: executed ? "not_started_no_safe_execution_adapter" : "not_started",
    captureFlagEnabled: process.env.NODE_ENV === "development" && process.env.FUNCTIONAL_SHADOW_CAPTURE === "1",
    plannedCaptureEnv: {
      NODE_ENV: "development",
      FUNCTIONAL_SHADOW_CAPTURE: "1"
    },
    scenariosAttempted: executed ? scenarioResults.filter((item) => item.status !== "not_attempted").length : 0,
    scenariosSucceeded: 0,
    scenariosFailed: 0,
    scenarioResults,
    beforeCaptureSummary,
    afterCaptureSummary,
    newCompleteProductRowCaptures: newIds,
    requestContractNotes,
    mutationRisk,
    coverageAfterRun: coverageAfterRun
      ? {
          captureSummary: coverageAfterRun.captureSummary,
          candidateSummary: coverageAfterRun.candidateSummary,
          gapCoverage: coverageAfterRun.gapCoverage,
          decisionSummary: coverageAfterRun.decisionSummary,
          highRiskProtection: coverageAfterRun.highRiskProtection,
          limitations: coverageAfterRun.limitations
        }
      : null,
    syntheticFixturesUsed: false,
    runtimeMutation: false
  });
}

async function main() {
  const result = await runDevTargetScenarioCaptures();
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(JSON_OUTPUT, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  await writeFile(MD_OUTPUT, makeMarkdown(result), "utf8");

  console.log("dev target scenario capture run complete");
  console.log(`executed: ${result.executionStatus.executed}`);
  console.log(`skipReason: ${result.executionStatus.skipReason || "none"}`);
  console.log(`complete/product_row before: ${result.beforeCaptureSummary.completeProductRowFixtures}`);
  console.log(`complete/product_row after: ${result.afterCaptureSummary.completeProductRowFixtures}`);
  console.log(`new complete/product_row captures: ${result.newCompleteProductRowCaptures.length}`);
  console.log(`wrote ${JSON_OUTPUT}`);
  console.log(`wrote ${MD_OUTPUT}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
