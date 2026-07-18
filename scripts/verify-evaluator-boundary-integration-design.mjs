import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  EVALUATOR_BOUNDARY_COLLAPSED_HINT_CONTRACT_VALUES,
  resolveEvaluatorBoundaryCollapsedHint
} from "../lib/evaluator-boundary-collapsed-hint-contract.js";

const ROOT = process.cwd();
const OUTPUT_PATH = path.join(ROOT, "tmp", "evaluator-boundary-integration-whatif.json");
const MD_OUTPUT_PATH = path.join(ROOT, "tmp", "evaluator-boundary-integration-whatif.md");
const ARCHITECTURE_DOC_PATH = path.join(ROOT, "docs", "architecture", "evaluator-boundary-collapsed-hint-integration.md");
const REVIEW_DOC_PATH = path.join(ROOT, "docs", "reviews", "evaluator-boundary-integration-whatif-20260709.md");
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

function runWhatIf() {
  const stdout = execFileSync(process.execPath, ["scripts/run-evaluator-boundary-integration-whatif.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env
  });

  assert(stdout.includes("evaluator-boundary-integration-whatif summary"));
  assert(existsSync(OUTPUT_PATH), "what-if JSON should exist");
  assert(existsSync(MD_OUTPUT_PATH), "what-if markdown should exist");
  return JSON.parse(readFileSync(OUTPUT_PATH, "utf8"));
}

function stripVolatile(output) {
  return {
    ...output,
    generatedAt: "<stable>"
  };
}

function assertContractHelper() {
  assert.deepEqual(EVALUATOR_BOUNDARY_COLLAPSED_HINT_CONTRACT_VALUES.candidatePolicyHints, [
    "collapsed_candidate_hint",
    "hidden_candidate_hint",
    "insufficient_evidence_hint",
    "none"
  ]);

  const collapsed = resolveEvaluatorBoundaryCollapsedHint({
    candidateEvaluation: {
      hardFilterStatus: "blocked",
      hardFilterReasons: ["recent_instability_active_limited"]
    },
    boundaryPolicyResult: {
      applies: true,
      boundaryDecision: "downgrade_to_collapsed_candidate",
      confidence: "high",
      reasons: ["recent_instability_active_limited_block"],
      futureIntegrationHint: "future_evaluator_pass_with_collapsed_hint",
      policyContext: {
        irritationRisk: "low",
        sensitivitySafe: true,
        strongCautionSignal: false
      }
    },
    exposureContext: {
      currentExposureStatus: "hidden_candidate",
      safetyMetadataProfile: "safe_low_risk"
    }
  });
  assert.equal(collapsed.futureEvaluatorAction, "future_pass_with_collapsed_hint");
  assert.equal(collapsed.candidatePolicyHint, "collapsed_candidate_hint");
  assert.equal(collapsed.runtimeConnected, false);

  const highRisk = resolveEvaluatorBoundaryCollapsedHint({
    candidateEvaluation: {
      hardFilterStatus: "blocked",
      hardFilterReasons: ["recent_instability_active_limited"]
    },
    boundaryPolicyResult: {
      applies: true,
      boundaryDecision: "downgrade_to_collapsed_candidate",
      confidence: "high",
      reasons: ["recent_instability_active_limited_block"],
      futureIntegrationHint: "future_evaluator_pass_with_collapsed_hint",
      policyContext: {
        irritationRisk: "high",
        sensitivitySafe: false,
        strongCautionSignal: false
      }
    },
    exposureContext: {
      currentExposureStatus: "hidden_candidate",
      safetyMetadataProfile: "unsafe_high_risk"
    }
  });
  assert.equal(highRisk.futureEvaluatorAction, "preserve_hard_block");
  assert.equal(highRisk.candidatePolicyHint, "hidden_candidate_hint");

  const metadata = resolveEvaluatorBoundaryCollapsedHint({
    boundaryPolicyResult: {
      applies: true,
      boundaryDecision: "requires_metadata_review",
      confidence: "low",
      reasons: ["irritation_risk_missing"],
      futureIntegrationHint: "needs_product_metadata_review"
    },
    exposureContext: {
      safetyMetadataProfile: "metadata_incomplete"
    }
  });
  assert.equal(metadata.futureEvaluatorAction, "requires_metadata_review");
  assert.equal(metadata.candidatePolicyHint, "insufficient_evidence_hint");
}

function assertWhatIfContract(output) {
  assert.equal(output.evidenceType, "integration_whatif_shadow");
  assert.equal(output.runtimeConnected, false);
  assert.equal(output.routeInvoked, false);
  assert.equal(output.supabaseWriteExecuted, false);
  assert.equal(output.runtimeMutation, false);
  assert.equal(output.recommendedIntegrationOption, "option_b_evaluator_pass_with_collapsed_hint");
  assert.equal(output.safetyRegressionCheck.highRiskCollapsedHintCountActual, 0);
  assert.equal(output.safetyRegressionCheck.highRiskCollapsedHintCountPureReplay, 0);
  assert.equal(output.safetyRegressionCheck.passed, true);
  assert.equal(output.lowRiskCollapsedHintConsistency.passed, true);
  assert.ok([
    "actual_complete_product_row_capture",
    "actual_capture_coverage_unavailable"
  ].includes(output.actualWhatIfSummary.evidenceLabel));
  assert.equal(output.pureReplayWhatIfSummary.evidenceLabel, "pure_engine_replay");
  assert(!("productRowsLoaded" in output.actualWhatIfSummary), "actual evidence should not include pure replay source fields");
  assert(!("completeProductRowCaptures" in output.pureReplayWhatIfSummary), "pure replay should not include actual capture counts");
  assert.equal(output.actualWhatIfSummary.metadataIncompleteCollapsedHintCount, 0);
  assert.equal(output.pureReplayWhatIfSummary.metadataIncompleteCollapsedHintCount, 0);
  assert(output.prohibitedNextStep.includes("connect_evaluator_runtime"));
  assert(output.prohibitedNextStep.includes("connect_candidate_policy_runtime"));
}

function assertNoLeakage() {
  const serialized = [
    readFileSync(OUTPUT_PATH, "utf8"),
    readFileSync(MD_OUTPUT_PATH, "utf8"),
    readFileSync(REVIEW_DOC_PATH, "utf8")
  ].join("\n");

  for (const pattern of FORBIDDEN_OUTPUT_PATTERNS) {
    assert(!pattern.test(serialized), `what-if output leaked forbidden pattern: ${pattern}`);
  }
}

function assertDocsExistAndStayDesignOnly() {
  assert(existsSync(ARCHITECTURE_DOC_PATH), "architecture design document should exist");
  assert(existsSync(REVIEW_DOC_PATH), "what-if review document should exist");

  const architecture = readFileSync(ARCHITECTURE_DOC_PATH, "utf8");
  const review = readFileSync(REVIEW_DOC_PATH, "utf8");

  assert(architecture.includes("runtime 정책 변경 또는 CandidatePolicy 연결 승인이 아니다"));
  assert(architecture.includes("Option B: evaluator pass plus collapsed hint"));
  assert(architecture.includes("Runtime Non-application"));
  assert(review.includes("Recommended option: Option B"));
  assert(review.includes("runtimeConnected: false"));
  assert(review.includes("Still Prohibited"));
}

function assertNoForbiddenRuntimeConnections() {
  const route = readFileSync("app/api/analyze/route.js", "utf8");
  const evaluator = readFileSync("lib/functional-ranking-contract.js", "utf8");
  const candidatePolicy = readFileSync("lib/functional-candidate-policy.js", "utf8");
  const page = readFileSync("app/page.js", "utf8");
  const joinedRuntime = [route, evaluator, candidatePolicy, page].join("\n");

  assert.equal(joinedRuntime.includes("evaluator-boundary-collapsed-hint-contract"), false);
  assert.equal(joinedRuntime.includes("run-evaluator-boundary-integration-whatif"), false);
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
    assert(!changedFiles.includes(file), `${file} should not be modified by integration design`);
  }

  assert(changedFiles.every((file) => !file.startsWith("data/")), "product data source files should not be modified");
  assert(changedFiles.every((file) => !file.startsWith("supabase/")), "Supabase files should not be modified");
}

assertContractHelper();
const first = runWhatIf();
assertWhatIfContract(first);
assertDocsExistAndStayDesignOnly();
assertNoLeakage();
assertNoForbiddenRuntimeConnections();

const second = runWhatIf();
assert.deepEqual(
  stripVolatile(first),
  stripVolatile(second),
  "integration what-if output should be deterministic apart from generatedAt"
);

console.log("verify-evaluator-boundary-integration-design passed");
