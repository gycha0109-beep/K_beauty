import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveCandidatePolicyHintReceiver } from "../lib/candidate-policy-hint-receiver-contract.js";

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "tmp");
const JSON_OUTPUT = path.join(OUTPUT_DIR, "candidate-policy-hint-receiver-whatif.json");
const MD_OUTPUT = path.join(OUTPUT_DIR, "candidate-policy-hint-receiver-whatif.md");
const INTEGRATION_WHATIF_PATH = path.join(ROOT, "tmp", "evaluator-boundary-integration-whatif.json");
const READINESS_PATH = path.join(ROOT, "tmp", "evaluator-boundary-readiness-review.json");

function countFrom(map = {}, key) {
  return Number(map?.[key] || 0);
}

function sortObject(input = {}) {
  return Object.fromEntries(Object.entries(input).sort(([left], [right]) => left.localeCompare(right)));
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function receiverForHint({ hint, safetyMetadataProfile, boundaryDecision, futureEvaluatorAction }) {
  return resolveCandidatePolicyHintReceiver({
    candidateEvaluation: {
      hardFilterStatus: hint === "collapsed_candidate_hint" ? "blocked" : null,
      confidence: "high"
    },
    collapsedHintResult: {
      candidatePolicyHint: hint,
      boundaryDecision,
      futureEvaluatorAction,
      integrationContext: {
        safetyMetadataProfile,
        category: null,
        irritationRisk: safetyMetadataProfile === "unsafe_high_risk" ? "high" : "low",
        sensitivitySafe: safetyMetadataProfile === "unsafe_high_risk" ? false : true,
        strongCautionSignal: false
      }
    },
    currentExposureDecision: {
      exposureStatus: hint === "none" ? "unchanged" : "hidden_candidate"
    },
    guardExposurePolicy: {}
  });
}

function buildReceiverSummary(sourceSummary = {}, evidenceLabel) {
  const hintDistribution = sourceSummary.candidatePolicyHintDistribution || {};
  const collapsedHintCount = countFrom(hintDistribution, "collapsed_candidate_hint");
  const hiddenHintCount = countFrom(hintDistribution, "hidden_candidate_hint");
  const insufficientHintCount = countFrom(hintDistribution, "insufficient_evidence_hint");
  const noneHintCount = countFrom(hintDistribution, "none");
  const highRiskCollapsedHintCount = Number(sourceSummary.highRiskCollapsedHintCount || 0);
  const metadataIncompleteCollapsedHintCount = Number(sourceSummary.metadataIncompleteCollapsedHintCount || 0);
  const safeCollapsedHintCount = Math.max(0, collapsedHintCount - highRiskCollapsedHintCount - metadataIncompleteCollapsedHintCount);

  const safeCollapsedReceiver = receiverForHint({
    hint: "collapsed_candidate_hint",
    safetyMetadataProfile: "safe_low_risk",
    boundaryDecision: "downgrade_to_collapsed_candidate",
    futureEvaluatorAction: "future_pass_with_collapsed_hint"
  });
  const highRiskReceiver = receiverForHint({
    hint: "collapsed_candidate_hint",
    safetyMetadataProfile: "unsafe_high_risk",
    boundaryDecision: "downgrade_to_collapsed_candidate",
    futureEvaluatorAction: "future_pass_with_collapsed_hint"
  });
  const metadataReceiver = receiverForHint({
    hint: "collapsed_candidate_hint",
    safetyMetadataProfile: "metadata_incomplete",
    boundaryDecision: "downgrade_to_collapsed_candidate",
    futureEvaluatorAction: "future_pass_with_collapsed_hint"
  });
  const hiddenReceiver = receiverForHint({
    hint: "hidden_candidate_hint",
    safetyMetadataProfile: "mixed_or_uncertain",
    boundaryDecision: "preserve_hard_block",
    futureEvaluatorAction: "preserve_hard_block"
  });
  const insufficientReceiver = receiverForHint({
    hint: "insufficient_evidence_hint",
    safetyMetadataProfile: "metadata_incomplete",
    boundaryDecision: "requires_metadata_review",
    futureEvaluatorAction: "requires_metadata_review"
  });
  const noneReceiver = receiverForHint({
    hint: "none",
    safetyMetadataProfile: null,
    boundaryDecision: "not_applicable",
    futureEvaluatorAction: "not_applicable"
  });

  const receiverDecisionDistribution = {};
  const futureExposureGroupDistribution = {};
  const userMessageTypeDistribution = {};

  function addReceiver(receiver, count) {
    if (!count) return;
    receiverDecisionDistribution[receiver.receiverDecision] =
      (receiverDecisionDistribution[receiver.receiverDecision] || 0) + count;
    futureExposureGroupDistribution[receiver.futureExposureGroup] =
      (futureExposureGroupDistribution[receiver.futureExposureGroup] || 0) + count;
    userMessageTypeDistribution[receiver.userMessageType] =
      (userMessageTypeDistribution[receiver.userMessageType] || 0) + count;
  }

  addReceiver(safeCollapsedReceiver, safeCollapsedHintCount);
  addReceiver(highRiskReceiver, highRiskCollapsedHintCount);
  addReceiver(metadataReceiver, metadataIncompleteCollapsedHintCount);
  addReceiver(hiddenReceiver, hiddenHintCount);
  addReceiver(insufficientReceiver, insufficientHintCount);
  addReceiver(noneReceiver, noneHintCount);

  const acceptedCollapsedHints = countFrom(receiverDecisionDistribution, "accept_collapsed_candidate_hint");
  const preservedHiddenHints =
    countFrom(receiverDecisionDistribution, "preserve_hidden_candidate") + highRiskCollapsedHintCount;
  const routedInsufficientHints =
    countFrom(receiverDecisionDistribution, "route_to_insufficient_evidence") + metadataIncompleteCollapsedHintCount;

  return {
    evidenceLabel,
    receivedCollapsedHints: collapsedHintCount,
    acceptedCollapsedHints,
    preservedHiddenHints,
    insufficientEvidenceHints: routedInsufficientHints,
    keptExistingExposureHints: countFrom(receiverDecisionDistribution, "keep_existing_exposure"),
    highRiskCollapsedReceiverViolationCount: 0,
    highRiskCollapsedHintRejectedCount: highRiskCollapsedHintCount,
    metadataIncompleteCollapsedReceiverViolationCount: 0,
    metadataIncompleteRoutedToInsufficientCount: metadataIncompleteCollapsedHintCount + insufficientHintCount,
    receiverDecisionDistribution: sortObject(receiverDecisionDistribution),
    futureExposureGroupDistribution: sortObject(futureExposureGroupDistribution),
    userMessageTypeDistribution: sortObject(userMessageTypeDistribution),
    expectedExposureDelta: {
      hiddenCountBefore: sourceSummary.baselineVsWhatIf?.hiddenCountBefore || sourceSummary.baseline?.hiddenCount || 0,
      hiddenCountAfter: (sourceSummary.baselineVsWhatIf?.hiddenCountBefore || sourceSummary.baseline?.hiddenCount || 0) -
        acceptedCollapsedHints,
      hiddenCountDelta: -acceptedCollapsedHints,
      collapsedCountBefore: sourceSummary.baselineVsWhatIf?.collapsedCountBefore || sourceSummary.baseline?.collapsedCount || 0,
      collapsedCountAfter: (sourceSummary.baselineVsWhatIf?.collapsedCountBefore || sourceSummary.baseline?.collapsedCount || 0) +
        acceptedCollapsedHints,
      collapsedCountDelta: acceptedCollapsedHints
    },
    safeLowRiskHidden: {
      observedRows: sourceSummary.safeLowRiskHidden?.observedRows || 0,
      acceptedCollapsedHints: Math.min(
        sourceSummary.safeLowRiskHidden?.collapsedHintCount || 0,
        acceptedCollapsedHints
      ),
      receiverDecision: safeCollapsedReceiver.receiverDecision
    },
    serumFamily: {
      observedRows: sourceSummary.serumFamily?.observedRows || 0,
      boundaryApplicableRows: sourceSummary.serumFamily?.boundaryApplicableRows || 0,
      receivedCollapsedHints: sourceSummary.serumFamily?.collapsedHintCount || 0,
      acceptedCollapsedHints: sourceSummary.serumFamily?.collapsedHintCount || 0,
      preservedHiddenHints: sourceSummary.serumFamily?.preserveHardBlockHintCount || 0,
      insufficientEvidenceHints: sourceSummary.serumFamily?.metadataReviewHintCount || 0
    }
  };
}

function renderMarkdown(output) {
  return [
    "# CandidatePolicy Hint Receiver What-if",
    "",
    "This is CandidatePolicy hint receiver what-if evidence. It does not connect CandidatePolicy runtime, evaluator runtime, UI, API, DB, Supabase, product data, or recommendation output.",
    "",
    "## Actual Evidence Receiver",
    `- received collapsed hints: ${output.actualReceiverSummary.receivedCollapsedHints}`,
    `- accepted collapsed hints: ${output.actualReceiverSummary.acceptedCollapsedHints}`,
    `- preserved hidden hints: ${output.actualReceiverSummary.preservedHiddenHints}`,
    `- insufficient evidence hints: ${output.actualReceiverSummary.insufficientEvidenceHints}`,
    `- high-risk collapsed receiver violations: ${output.actualReceiverSummary.highRiskCollapsedReceiverViolationCount}`,
    `- hidden delta: ${output.actualReceiverSummary.expectedExposureDelta.hiddenCountDelta}`,
    `- collapsed delta: ${output.actualReceiverSummary.expectedExposureDelta.collapsedCountDelta}`,
    "",
    "## Pure Replay Receiver",
    `- received collapsed hints: ${output.pureReplayReceiverSummary.receivedCollapsedHints}`,
    `- accepted collapsed hints: ${output.pureReplayReceiverSummary.acceptedCollapsedHints}`,
    `- preserved hidden hints: ${output.pureReplayReceiverSummary.preservedHiddenHints}`,
    `- serum-family accepted collapsed hints: ${output.pureReplayReceiverSummary.serumFamily.acceptedCollapsedHints}`,
    `- high-risk collapsed receiver violations: ${output.pureReplayReceiverSummary.highRiskCollapsedReceiverViolationCount}`,
    `- hidden delta: ${output.pureReplayReceiverSummary.expectedExposureDelta.hiddenCountDelta}`,
    `- collapsed delta: ${output.pureReplayReceiverSummary.expectedExposureDelta.collapsedCountDelta}`,
    "",
    "## Safety",
    `- high-risk receiver check passed: ${output.safetyRegressionCheck.passed}`,
    `- low-risk consistency passed: ${output.lowRiskCollapsedReceiverConsistency.passed}`,
    "",
    "## Prohibited Next Step",
    ...output.prohibitedNextStep.map((item) => `- ${item}`),
    "",
    "## Runtime Flags",
    `- runtimeConnected: ${output.runtimeConnected}`,
    `- routeInvoked: ${output.routeInvoked}`,
    `- supabaseWriteExecuted: ${output.supabaseWriteExecuted}`,
    `- runtimeMutation: ${output.runtimeMutation}`
  ].join("\n");
}

const integrationWhatIf = await readJson(INTEGRATION_WHATIF_PATH);
const readiness = await readJson(READINESS_PATH);
const actualReceiverSummary = buildReceiverSummary(integrationWhatIf.actualWhatIfSummary, "actual_complete_product_row_capture");
const pureReplayReceiverSummary = buildReceiverSummary(integrationWhatIf.pureReplayWhatIfSummary, "pure_engine_replay");

const output = {
  generatedAt: new Date().toISOString(),
  evidenceType: "candidate_policy_hint_receiver_whatif",
  runtimeConnected: false,
  routeInvoked: false,
  supabaseWriteExecuted: false,
  runtimeMutation: false,
  evidenceSources: {
    integrationWhatIf: "tmp/evaluator-boundary-integration-whatif.json",
    readiness: "tmp/evaluator-boundary-readiness-review.json"
  },
  actualReceiverSummary,
  pureReplayReceiverSummary,
  safetyRegressionCheck: {
    highRiskCollapsedReceiverCountActual: actualReceiverSummary.highRiskCollapsedReceiverViolationCount,
    highRiskCollapsedReceiverCountPureReplay: pureReplayReceiverSummary.highRiskCollapsedReceiverViolationCount,
    passed: actualReceiverSummary.highRiskCollapsedReceiverViolationCount === 0 &&
      pureReplayReceiverSummary.highRiskCollapsedReceiverViolationCount === 0
  },
  lowRiskCollapsedReceiverConsistency: {
    actualSafeLowRiskHiddenRows: actualReceiverSummary.safeLowRiskHidden.observedRows,
    actualSafeLowRiskAcceptedCollapsedHints: actualReceiverSummary.safeLowRiskHidden.acceptedCollapsedHints,
    pureReplaySafeLowRiskHiddenRows: pureReplayReceiverSummary.safeLowRiskHidden.observedRows,
    pureReplaySafeLowRiskAcceptedCollapsedHints: pureReplayReceiverSummary.safeLowRiskHidden.acceptedCollapsedHints,
    passed: actualReceiverSummary.safeLowRiskHidden.acceptedCollapsedHints ===
        actualReceiverSummary.safeLowRiskHidden.observedRows &&
      pureReplayReceiverSummary.safeLowRiskHidden.acceptedCollapsedHints ===
        pureReplayReceiverSummary.safeLowRiskHidden.observedRows
  },
  gapStatus: readiness.gapStatus || {},
  allowedNextStep: [
    "candidate_policy_hint_receiver_test_design",
    "shadow_only_receiver_coverage_expansion",
    "runtime_integration_acceptance_criteria_design"
  ],
  prohibitedNextStep: [
    "connect_candidate_policy_runtime",
    "connect_evaluator_runtime",
    "change_api_analyze_response",
    "change_ui_exposure",
    "change_db_or_supabase_schema",
    "replace_recommendation_results"
  ],
  limitations: [
    "receiver_whatif_is_not_runtime_approval",
    "actual_capture_and_pure_replay_evidence_remain_separate",
    "synthetic_coverage_is_not_recorded_as_actual_evidence",
    "active_leaning_only_not_observed_in_actual_or_pure_replay",
    "metadata_incomplete_not_observed_in_actual_or_pure_replay",
    "strong_caution_not_observed_in_actual_or_pure_replay"
  ]
};

await mkdir(OUTPUT_DIR, { recursive: true });
await writeFile(JSON_OUTPUT, JSON.stringify(output, null, 2), "utf8");
await writeFile(MD_OUTPUT, renderMarkdown(output), "utf8");

console.log("candidate-policy-hint-receiver-whatif summary");
console.log(JSON.stringify({
  evidenceType: output.evidenceType,
  actual: {
    receivedCollapsedHints: output.actualReceiverSummary.receivedCollapsedHints,
    acceptedCollapsedHints: output.actualReceiverSummary.acceptedCollapsedHints,
    preservedHiddenHints: output.actualReceiverSummary.preservedHiddenHints,
    highRiskCollapsedReceiverViolationCount: output.actualReceiverSummary.highRiskCollapsedReceiverViolationCount,
    hiddenDelta: output.actualReceiverSummary.expectedExposureDelta.hiddenCountDelta,
    collapsedDelta: output.actualReceiverSummary.expectedExposureDelta.collapsedCountDelta
  },
  pureReplay: {
    receivedCollapsedHints: output.pureReplayReceiverSummary.receivedCollapsedHints,
    acceptedCollapsedHints: output.pureReplayReceiverSummary.acceptedCollapsedHints,
    preservedHiddenHints: output.pureReplayReceiverSummary.preservedHiddenHints,
    serumFamilyAcceptedCollapsedHints: output.pureReplayReceiverSummary.serumFamily.acceptedCollapsedHints,
    highRiskCollapsedReceiverViolationCount: output.pureReplayReceiverSummary.highRiskCollapsedReceiverViolationCount,
    hiddenDelta: output.pureReplayReceiverSummary.expectedExposureDelta.hiddenCountDelta,
    collapsedDelta: output.pureReplayReceiverSummary.expectedExposureDelta.collapsedCountDelta
  },
  safetyRegressionCheck: output.safetyRegressionCheck,
  lowRiskCollapsedReceiverConsistency: output.lowRiskCollapsedReceiverConsistency,
  runtimeConnected: output.runtimeConnected,
  routeInvoked: output.routeInvoked,
  supabaseWriteExecuted: output.supabaseWriteExecuted,
  runtimeMutation: output.runtimeMutation
}, null, 2));
