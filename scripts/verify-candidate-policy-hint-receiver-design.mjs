import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  CANDIDATE_POLICY_HINT_RECEIVER_CONTRACT_VALUES,
  resolveCandidatePolicyHintReceiver
} from "../lib/candidate-policy-hint-receiver-contract.js";

const ROOT = process.cwd();
const OUTPUT_PATH = path.join(ROOT, "tmp", "candidate-policy-hint-receiver-whatif.json");
const MD_OUTPUT_PATH = path.join(ROOT, "tmp", "candidate-policy-hint-receiver-whatif.md");
const ARCHITECTURE_DOC_PATH = path.join(ROOT, "docs", "architecture", "candidate-policy-hint-receiver.md");
const REVIEW_DOC_PATH = path.join(ROOT, "docs", "reviews", "candidate-policy-hint-receiver-whatif-20260709.md");
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

function collapsedHint(overrides = {}) {
  return {
    candidatePolicyHint: "collapsed_candidate_hint",
    boundaryDecision: "downgrade_to_collapsed_candidate",
    futureEvaluatorAction: "future_pass_with_collapsed_hint",
    integrationContext: {
      safetyMetadataProfile: "safe_low_risk",
      irritationRisk: "low",
      sensitivitySafe: true,
      strongCautionSignal: false,
      category: "serum",
      ...overrides.integrationContext
    },
    ...overrides
  };
}

function resolve(input = {}) {
  return resolveCandidatePolicyHintReceiver({
    candidateEvaluation: { hardFilterStatus: "blocked", confidence: "high" },
    currentExposureDecision: { exposureStatus: "hidden_candidate" },
    guardExposurePolicy: {},
    ...input
  });
}

function runWhatIf() {
  const stdout = execFileSync(process.execPath, ["scripts/run-candidate-policy-hint-receiver-whatif.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env
  });

  assert(stdout.includes("candidate-policy-hint-receiver-whatif summary"));
  assert(existsSync(OUTPUT_PATH), "receiver what-if JSON should exist");
  assert(existsSync(MD_OUTPUT_PATH), "receiver what-if markdown should exist");
  return JSON.parse(readFileSync(OUTPUT_PATH, "utf8"));
}

function stripVolatile(output) {
  return {
    ...output,
    generatedAt: "<stable>"
  };
}

function assertHelperSemantics() {
  assert.deepEqual(CANDIDATE_POLICY_HINT_RECEIVER_CONTRACT_VALUES.receivedHints, [
    "collapsed_candidate_hint",
    "hidden_candidate_hint",
    "insufficient_evidence_hint",
    "none"
  ]);

  const accepted = resolve({ collapsedHintResult: collapsedHint() });
  assert.equal(accepted.receiverDecision, "accept_collapsed_candidate_hint");
  assert.equal(accepted.futureExposureGroup, "collapsed_candidate");
  assert.equal(accepted.runtimeConnected, false);

  const hidden = resolve({
    collapsedHintResult: {
      candidatePolicyHint: "hidden_candidate_hint",
      boundaryDecision: "preserve_hard_block",
      futureEvaluatorAction: "preserve_hard_block",
      integrationContext: { safetyMetadataProfile: "unsafe_high_risk" }
    }
  });
  assert.equal(hidden.receiverDecision, "preserve_hidden_candidate");
  assert.equal(hidden.futureExposureGroup, "hidden_candidate");

  const insufficient = resolve({
    collapsedHintResult: {
      candidatePolicyHint: "insufficient_evidence_hint",
      boundaryDecision: "requires_metadata_review",
      futureEvaluatorAction: "requires_metadata_review",
      integrationContext: { safetyMetadataProfile: "metadata_incomplete" }
    }
  });
  assert.equal(insufficient.receiverDecision, "route_to_insufficient_evidence");
  assert.equal(insufficient.futureExposureGroup, "insufficient_evidence_candidate");

  const highRisk = resolve({
    collapsedHintResult: collapsedHint({
      integrationContext: {
        safetyMetadataProfile: "unsafe_high_risk",
        irritationRisk: "high",
        sensitivitySafe: false,
        strongCautionSignal: false,
        category: "moisturizer"
      }
    })
  });
  assert.equal(highRisk.receiverDecision, "preserve_hidden_candidate");
  assert.equal(highRisk.futureExposureGroup, "hidden_candidate");

  const metadata = resolve({
    collapsedHintResult: collapsedHint({
      integrationContext: {
        safetyMetadataProfile: "metadata_incomplete",
        irritationRisk: null,
        sensitivitySafe: null,
        strongCautionSignal: false
      }
    })
  });
  assert.equal(metadata.receiverDecision, "route_to_insufficient_evidence");
  assert.equal(metadata.futureExposureGroup, "insufficient_evidence_candidate");

  const none = resolve({
    collapsedHintResult: {
      candidatePolicyHint: "none",
      boundaryDecision: "not_applicable",
      futureEvaluatorAction: "not_applicable"
    }
  });
  assert.equal(none.receiverDecision, "keep_existing_exposure");
  assert.equal(none.futureExposureGroup, "unchanged");
}

function assertWhatIfContract(output) {
  assert.equal(output.evidenceType, "candidate_policy_hint_receiver_whatif");
  assert.equal(output.runtimeConnected, false);
  assert.equal(output.routeInvoked, false);
  assert.equal(output.supabaseWriteExecuted, false);
  assert.equal(output.runtimeMutation, false);
  assert.equal(output.actualReceiverSummary.evidenceLabel, "actual_complete_product_row_capture");
  assert.equal(output.pureReplayReceiverSummary.evidenceLabel, "pure_engine_replay");
  assert.equal(output.safetyRegressionCheck.highRiskCollapsedReceiverCountActual, 0);
  assert.equal(output.safetyRegressionCheck.highRiskCollapsedReceiverCountPureReplay, 0);
  assert.equal(output.safetyRegressionCheck.passed, true);
  assert.equal(output.lowRiskCollapsedReceiverConsistency.passed, true);
  assert.equal(output.actualReceiverSummary.metadataIncompleteCollapsedReceiverViolationCount, 0);
  assert.equal(output.pureReplayReceiverSummary.metadataIncompleteCollapsedReceiverViolationCount, 0);
  assert(!("productRowsLoaded" in output.actualReceiverSummary), "actual receiver summary should not include pure replay source fields");
  assert(!("completeProductRowCaptures" in output.pureReplayReceiverSummary), "pure replay receiver summary should not include actual capture counts");
  assert(output.prohibitedNextStep.includes("connect_candidate_policy_runtime"));
  assert(output.prohibitedNextStep.includes("connect_evaluator_runtime"));
}

function assertDocs() {
  assert(existsSync(ARCHITECTURE_DOC_PATH), "architecture receiver doc should exist");
  assert(existsSync(REVIEW_DOC_PATH), "receiver what-if review doc should exist");

  const architecture = readFileSync(ARCHITECTURE_DOC_PATH, "utf8");
  const review = readFileSync(REVIEW_DOC_PATH, "utf8");

  assert(architecture.includes("runtime 정책 변경 또는 CandidatePolicy 연결 승인이 아니다"));
  assert(architecture.includes("Evaluator"));
  assert(architecture.includes("CandidatePolicy Hint Receiver"));
  assert(review.includes("actual evidence receiver what-if"));
  assert(review.includes("pure replay evidence receiver what-if"));
  assert(review.includes("Still prohibited"));
}

function assertNoLeakage() {
  const serialized = [
    readFileSync(OUTPUT_PATH, "utf8"),
    readFileSync(MD_OUTPUT_PATH, "utf8"),
    existsSync(REVIEW_DOC_PATH) ? readFileSync(REVIEW_DOC_PATH, "utf8") : ""
  ].join("\n");

  for (const pattern of FORBIDDEN_OUTPUT_PATTERNS) {
    assert(!pattern.test(serialized), `receiver output leaked forbidden pattern: ${pattern}`);
  }
}

function assertNoRuntimeConnections() {
  const route = readFileSync("app/api/analyze/route.js", "utf8");
  const evaluator = readFileSync("lib/functional-ranking-contract.js", "utf8");
  const candidatePolicy = readFileSync("lib/functional-candidate-policy.js", "utf8");
  const page = readFileSync("app/page.js", "utf8");
  const joinedRuntime = [route, evaluator, candidatePolicy, page].join("\n");

  assert.equal(joinedRuntime.includes("candidate-policy-hint-receiver-contract"), false);
  assert.equal(joinedRuntime.includes("run-candidate-policy-hint-receiver-whatif"), false);
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
    assert(!changedFiles.includes(file), `${file} should not be modified by receiver design`);
  }

  assert(changedFiles.every((file) => !file.startsWith("data/")), "product data source files should not be modified");
  assert(changedFiles.every((file) => !file.startsWith("supabase/")), "Supabase files should not be modified");
}

assertHelperSemantics();
const first = runWhatIf();
assertWhatIfContract(first);
assertNoRuntimeConnections();

const second = runWhatIf();
assert.deepEqual(
  stripVolatile(first),
  stripVolatile(second),
  "receiver what-if output should be deterministic apart from generatedAt"
);

if (existsSync(ARCHITECTURE_DOC_PATH) && existsSync(REVIEW_DOC_PATH)) {
  assertDocs();
  assertNoLeakage();
}

console.log("verify-candidate-policy-hint-receiver-design passed");
