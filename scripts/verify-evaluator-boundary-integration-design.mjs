import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync
} from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  EVALUATOR_BOUNDARY_COLLAPSED_HINT_CONTRACT_VALUES,
  resolveEvaluatorBoundaryCollapsedHint
} from "../lib/evaluator-boundary-collapsed-hint-contract.js";
import {
  cleanupCandidatePolicyVerifierWorkspace,
  materializeCandidatePolicyVerifierBaseline,
  validateIntegrationWhatIf
} from "./lib/candidate-policy-verifier-baseline.mjs";

const ROOT = process.cwd();
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

function runWhatIf(workspace, { staleNegativeControl = false } = {}) {
  if (staleNegativeControl) {
    const staleCaptureDir = path.join(workspace, "captures");
    const staleOutputDir = path.join(workspace, "artifacts");
    mkdirSync(staleCaptureDir, { recursive: true });
    mkdirSync(staleOutputDir, { recursive: true });
    writeFileSync(
      path.join(staleCaptureDir, "candidate-exposure-audit.json"),
      "{\"invalid\":true}\n",
      "utf8"
    );
    writeFileSync(
      path.join(staleOutputDir, "evaluator-boundary-integration-whatif.json"),
      "{\"invalid\":true}\n",
      "utf8"
    );
  }

  const result = materializeCandidatePolicyVerifierBaseline({
    root: ROOT,
    workspace
  });
  assert.equal(result.runs.every((run) => run.status === 0), true);
  assert.equal(result.candidateAudit.aggregate.totalEvaluatedProductRows, 24);
  assert.equal(result.integration.contractVersion, "evaluator-boundary-collapsed-hint-contract-v1");
  return result;
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
    "deterministic_contract_fixture",
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

function assertNoLeakage(outputDir) {
  const serialized = [
    readFileSync(path.join(outputDir, "evaluator-boundary-integration-whatif.json"), "utf8"),
    readFileSync(path.join(outputDir, "evaluator-boundary-integration-whatif.md"), "utf8"),
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

function assertMissingAndMalformedPrerequisitesFailClosed() {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "candidate-policy-missing-"));
  try {
    const captureDir = path.join(workspace, "captures");
    const outputDir = path.join(workspace, "artifacts");
    mkdirSync(captureDir, { recursive: true });
    mkdirSync(outputDir, { recursive: true });
    const missing = spawnSync(process.execPath, [
      "scripts/run-evaluator-boundary-integration-whatif.mjs",
      "--capture-dir",
      captureDir,
      "--output-dir",
      outputDir
    ], {
      cwd: ROOT,
      encoding: "utf8",
      env: process.env
    });
    assert.notEqual(missing.status, 0, "missing prerequisites must fail");

    const malformed = {
      evidenceType: "integration_whatif_shadow",
      contractVersion: "evaluator-boundary-collapsed-hint-contract-v1",
      recommendedIntegrationOption: "tampered_option",
      safetyRegressionCheck: { passed: true },
      lowRiskCollapsedHintConsistency: { passed: true }
    };
    assert.throws(
      () => validateIntegrationWhatIf(malformed),
      /exact key set|recommendedIntegrationOption/
    );
  } finally {
    cleanupCandidatePolicyVerifierWorkspace(workspace);
  }
}

assertContractHelper();
assertMissingAndMalformedPrerequisitesFailClosed();

const firstWorkspace = mkdtempSync(path.join(os.tmpdir(), "candidate-policy-integration-a-"));
const secondWorkspace = mkdtempSync(path.join(os.tmpdir(), "candidate-policy-integration-b-"));
try {
  const first = runWhatIf(firstWorkspace, { staleNegativeControl: true });
  assertWhatIfContract(first.integration);
  const tamperedIntegration = structuredClone(first.integration);
  tamperedIntegration.recommendedIntegrationOption = "tampered_option";
  assert.throws(
    () => validateIntegrationWhatIf(tamperedIntegration),
    (error) =>
      error?.actual === "tampered_option" &&
      error?.expected === "option_b_evaluator_pass_with_collapsed_hint"
  );
  assertDocsExistAndStayDesignOnly();
  assertNoLeakage(first.outputDir);
  assertNoForbiddenRuntimeConnections();

  const second = runWhatIf(secondWorkspace);
  assert.deepEqual(first.captureFiles, second.captureFiles);
  assert.deepEqual(first.outputFiles, second.outputFiles);
  assert.deepEqual(first.semanticHashes, second.semanticHashes);
  assert.deepEqual(
    stripVolatile(first.integration),
    stripVolatile(second.integration),
    "integration what-if output should be deterministic apart from generatedAt"
  );
} finally {
  cleanupCandidatePolicyVerifierWorkspace(firstWorkspace);
  cleanupCandidatePolicyVerifierWorkspace(secondWorkspace);
}

console.log("verify-evaluator-boundary-integration-design passed");
