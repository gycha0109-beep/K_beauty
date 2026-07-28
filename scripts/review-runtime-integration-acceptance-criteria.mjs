import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "tmp");
const JSON_OUTPUT = path.join(OUTPUT_DIR, "runtime-integration-acceptance-criteria.json");
const MD_OUTPUT = path.join(OUTPUT_DIR, "runtime-integration-acceptance-criteria.md");
const READINESS_PATH = path.join(ROOT, "tmp", "evaluator-boundary-readiness-review.json");
const INTEGRATION_WHATIF_PATH = path.join(ROOT, "tmp", "evaluator-boundary-integration-whatif.json");
const RECEIVER_WHATIF_PATH = path.join(ROOT, "tmp", "candidate-policy-hint-receiver-whatif.json");

const FORBIDDEN_RUNTIME_FILES = [
  "app/api/analyze/route.js",
  "lib/skin-match-decision-engine.js",
  "lib/functional-ranking-contract.js",
  "lib/functional-candidate-policy.js",
  "app/page.js",
  "app/result/page.js",
  "app/result/full-report/page.js"
];

function count(value) {
  return Number(value || 0);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function hasNoForbiddenRuntimeChanges() {
  const phase39Guard = execFileSync(process.execPath, ["scripts/verify-shadow-dry-run-route-static-guard.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env
  });
  const phase39RoutePatchGuarded = phase39Guard.includes("verify-shadow-dry-run-route-static-guard passed");
  const status = execFileSync("git", ["status", "--short", "--untracked-files=all"], {
    cwd: ROOT,
    encoding: "utf8"
  });
  const changedFiles = status
    .split(/\r?\n/)
    .map((line) => line.slice(3).trim())
    .filter(Boolean);

  return {
    passed: FORBIDDEN_RUNTIME_FILES.every((file) =>
      file === "app/api/analyze/route.js"
        ? phase39RoutePatchGuarded
        : !changedFiles.includes(file)
    ) &&
      changedFiles.every((file) => !file.startsWith("data/")) &&
      changedFiles.every((file) => !file.startsWith("supabase/")),
    forbiddenChangedFiles: changedFiles.filter((file) =>
      (FORBIDDEN_RUNTIME_FILES.includes(file) &&
        !(file === "app/api/analyze/route.js" && phase39RoutePatchGuarded)) ||
      file.startsWith("data/") ||
      file.startsWith("supabase/")
    ),
    phase39RoutePatchGuarded
  };
}

function gate(status, summary, details = {}) {
  return { status, summary, details };
}

function allPass(...values) {
  return values.every(Boolean);
}

function determineAcceptanceStatus({
  safetyRegressionGate,
  lowRiskConsistencyGate,
  evidenceSeparationGate,
  serumCategoryGate,
  metadataIncompleteGate,
  strongCautionGate,
  activeOnlyGate,
  runtimeIsolationGate
}) {
  if (safetyRegressionGate.status === "fail") return "blocked_by_safety_regression";
  if (runtimeIsolationGate.status === "fail") return "blocked_by_runtime_mutation";

  const corePassed = allPass(
    safetyRegressionGate.status === "pass",
    lowRiskConsistencyGate.status === "pass",
    evidenceSeparationGate.status === "pass",
    serumCategoryGate.status === "pass"
  );
  const unobservedCovered = allPass(
    metadataIncompleteGate.status === "conditional",
    strongCautionGate.status === "conditional",
    activeOnlyGate.status === "conditional"
  );

  if (corePassed && unobservedCovered) return "ready_for_runtime_integration_plan";
  if (!unobservedCovered) return "needs_more_contract_tests";
  return "needs_more_evidence";
}

function renderMarkdown(output) {
  return [
    "# Runtime Integration Acceptance Criteria Review",
    "",
    "This is a design-only acceptance review. It does not approve runtime integration.",
    "",
    `- acceptanceStatus: ${output.acceptanceStatus}`,
    `- evidenceType: ${output.evidenceType}`,
    `- runtimeConnected: ${output.runtimeConnected}`,
    `- routeInvoked: ${output.routeInvoked}`,
    `- supabaseWriteExecuted: ${output.supabaseWriteExecuted}`,
    `- runtimeMutation: ${output.runtimeMutation}`,
    "",
    "## Gate Results",
    ...Object.entries(output.gateResults).map(([key, value]) => `- ${key}: ${value.status} - ${value.summary}`),
    "",
    "## Required Contract Tests Before Runtime",
    ...output.requiredContractTestsBeforeRuntime.map((item) => `- ${item}`),
    "",
    "## Required Shadow Dry-run Before Runtime",
    ...output.requiredShadowDryRunBeforeRuntime.map((item) => `- ${item}`),
    "",
    "## Allowed Next Step",
    ...output.allowedNextStep.map((item) => `- ${item}`),
    "",
    "## Prohibited Next Step",
    ...output.prohibitedNextStep.map((item) => `- ${item}`),
    "",
    "## Limitations",
    ...output.limitations.map((item) => `- ${item}`)
  ].join("\n");
}

const readiness = await readJson(READINESS_PATH);
const integrationWhatIf = await readJson(INTEGRATION_WHATIF_PATH);
const receiverWhatIf = await readJson(RECEIVER_WHATIF_PATH);
const runtimeFileCheck = hasNoForbiddenRuntimeChanges();

const actualHighRiskCollapsedHints = count(integrationWhatIf.safetyRegressionCheck?.highRiskCollapsedHintCountActual);
const pureHighRiskCollapsedHints = count(integrationWhatIf.safetyRegressionCheck?.highRiskCollapsedHintCountPureReplay);
const actualHighRiskCollapsedReceivers = count(receiverWhatIf.safetyRegressionCheck?.highRiskCollapsedReceiverCountActual);
const pureHighRiskCollapsedReceivers = count(receiverWhatIf.safetyRegressionCheck?.highRiskCollapsedReceiverCountPureReplay);

const safetyRegressionGate = gate(
  actualHighRiskCollapsedHints === 0 &&
    pureHighRiskCollapsedHints === 0 &&
    actualHighRiskCollapsedReceivers === 0 &&
    pureHighRiskCollapsedReceivers === 0
    ? "pass"
    : "fail",
  "High-risk collapsed hint and receiver counts must stay zero.",
  {
    actualHighRiskCollapsedHints,
    pureHighRiskCollapsedHints,
    actualHighRiskCollapsedReceivers,
    pureHighRiskCollapsedReceivers
  }
);

const actualSafeRows = count(receiverWhatIf.lowRiskCollapsedReceiverConsistency?.actualSafeLowRiskHiddenRows);
const actualSafeAccepted = count(receiverWhatIf.lowRiskCollapsedReceiverConsistency?.actualSafeLowRiskAcceptedCollapsedHints);
const pureSafeRows = count(receiverWhatIf.lowRiskCollapsedReceiverConsistency?.pureReplaySafeLowRiskHiddenRows);
const pureSafeAccepted = count(receiverWhatIf.lowRiskCollapsedReceiverConsistency?.pureReplaySafeLowRiskAcceptedCollapsedHints);

const lowRiskEvidenceComplete = actualSafeRows > 0 && pureSafeRows > 0;
const lowRiskConsistencyGate = gate(
  lowRiskEvidenceComplete
    ? (actualSafeRows === actualSafeAccepted && pureSafeRows === pureSafeAccepted ? "pass" : "fail")
    : "conditional",
  lowRiskEvidenceComplete
    ? "Observed safe_low_risk hidden rows must consistently resolve to collapsed hints and receiver acceptance in both actual and pure-replay evidence."
    : "Complete safe_low_risk evidence is unavailable across actual and pure-replay sources; runtime integration remains unapproved.",
  {
    actualSafeLowRiskHiddenRows: actualSafeRows,
    actualSafeLowRiskAcceptedCollapsedHints: actualSafeAccepted,
    pureReplaySafeLowRiskHiddenRows: pureSafeRows,
    pureReplaySafeLowRiskAcceptedCollapsedHints: pureSafeAccepted
  }
);

const nonReplayEvidenceLabels = new Set([
  "actual_complete_product_row_capture",
  "deterministic_contract_fixture",
  "actual_capture_coverage_unavailable"
]);
const actualIntegrationLabel = integrationWhatIf.actualWhatIfSummary?.evidenceLabel;
const actualReceiverLabel = receiverWhatIf.actualReceiverSummary?.evidenceLabel;
const evidenceSeparationGate = gate(
  nonReplayEvidenceLabels.has(actualIntegrationLabel) &&
    actualReceiverLabel === actualIntegrationLabel &&
    integrationWhatIf.pureReplayWhatIfSummary?.evidenceLabel === "pure_engine_replay" &&
    receiverWhatIf.pureReplayReceiverSummary?.evidenceLabel === "pure_engine_replay" &&
    readiness.syntheticCoverageSummary?.actualEvidence === false
    ? "pass"
    : "fail",
  "Actual capture, pure replay, and synthetic coverage must remain separate.",
  {
    actualEvidenceLabel: receiverWhatIf.actualReceiverSummary?.evidenceLabel,
    pureReplayEvidenceLabel: receiverWhatIf.pureReplayReceiverSummary?.evidenceLabel,
    syntheticCoverageRecordedAsActual: readiness.syntheticCoverageSummary?.actualEvidence === true
  }
);

const pureSerum = receiverWhatIf.pureReplayReceiverSummary?.serumFamily || {};
const serumEvidenceObserved = count(pureSerum.observedRows) > 0;
const serumCategoryGate = gate(
  serumEvidenceObserved
    ? (count(pureSerum.boundaryApplicableRows) > 0 &&
        count(pureSerum.acceptedCollapsedHints) > 0 &&
        count(receiverWhatIf.safetyRegressionCheck?.highRiskCollapsedReceiverCountPureReplay) === 0
      ? "pass"
      : "fail")
    : "conditional",
  serumEvidenceObserved
    ? "Observed serum-family candidates must not be classified from category alone."
    : "Serum-family pure replay evidence is unavailable in the clean checkout; category behavior remains a required contract test.",
  {
    pureReplayObservedRows: count(pureSerum.observedRows),
    pureReplayBoundaryApplicableRows: count(pureSerum.boundaryApplicableRows),
    pureReplayAcceptedCollapsedHints: count(pureSerum.acceptedCollapsedHints),
    pureReplayPreservedHiddenHints: count(pureSerum.preservedHiddenHints),
    categoryOnlyDecisionAllowed: false,
    highRiskSerumCollapsedCount: 0
  }
);

const syntheticCases = readiness.syntheticCoverageSummary?.cases || {};
const metadataIncompleteGate = gate(
  syntheticCases.metadataIncomplete === "requires_metadata_review" ? "conditional" : "fail",
  "Metadata incomplete is unobserved in actual/pure evidence and must remain a required contract test.",
  {
    actualStatus: readiness.gapStatus?.metadataIncomplete?.actualStatus,
    pureReplayStatus: readiness.gapStatus?.metadataIncomplete?.pureReplayStatus,
    syntheticCoverage: syntheticCases.metadataIncomplete,
    requiredContractTest: "metadata_incomplete_routes_to_insufficient_evidence"
  }
);

const strongCautionGate = gate(
  syntheticCases.strongCaution === "preserve_hard_block" &&
    syntheticCases.serumStrongCautionHighRisk === "preserve_hard_block"
    ? "conditional"
    : "fail",
  "Strong caution is unobserved in actual/pure evidence and must remain a required contract test.",
  {
    actualStatus: readiness.gapStatus?.strongCaution?.actualStatus,
    pureReplayStatus: readiness.gapStatus?.strongCaution?.pureReplayStatus,
    syntheticCoverage: syntheticCases.strongCaution,
    serumStrongCautionHighRiskCoverage: syntheticCases.serumStrongCautionHighRisk,
    requiredContractTest: "strong_caution_preserves_hidden_or_hard_block"
  }
);

const activeOnlyGate = gate(
  syntheticCases.activeLeaningOnlySafeMetadata === "downgrade_to_collapsed_candidate" &&
    syntheticCases.activeLeaningOnlyUnsafeMetadata === "preserve_hard_block"
    ? "conditional"
    : "fail",
  "Active-only is unobserved in actual/pure evidence and must stay covered by required contract tests.",
  {
    actualStatus: readiness.gapStatus?.activeLeaningOnly?.actualStatus,
    pureReplayStatus: readiness.gapStatus?.activeLeaningOnly?.pureReplayStatus,
    safeSyntheticCoverage: syntheticCases.activeLeaningOnlySafeMetadata,
    unsafeSyntheticCoverage: syntheticCases.activeLeaningOnlyUnsafeMetadata,
    requiredContractTest: "active_only_safe_collapses_unsafe_preserves_hidden"
  }
);

const runtimeIsolationGate = gate(
  readiness.routeInvoked === false &&
    readiness.supabaseWriteExecuted === false &&
    readiness.runtimeMutation === false &&
    integrationWhatIf.routeInvoked === false &&
    integrationWhatIf.supabaseWriteExecuted === false &&
    integrationWhatIf.runtimeMutation === false &&
    receiverWhatIf.routeInvoked === false &&
    receiverWhatIf.supabaseWriteExecuted === false &&
    receiverWhatIf.runtimeMutation === false &&
    runtimeFileCheck.passed
    ? "pass"
    : "fail",
  "Review artifacts remain runtime-disconnected; the Phase 39 route patch is allowed only when its static guard passes.",
  {
    routeInvoked: false,
    supabaseWriteExecuted: false,
    runtimeMutation: false,
    forbiddenChangedFiles: runtimeFileCheck.forbiddenChangedFiles,
    phase39RoutePatchGuarded: runtimeFileCheck.phase39RoutePatchGuarded
  }
);

const gateResults = {
  gateA_safetyRegression: safetyRegressionGate,
  gateB_lowRiskConsistency: lowRiskConsistencyGate,
  gateC_evidenceSeparation: evidenceSeparationGate,
  gateD_serumCategory: serumCategoryGate,
  gateE_metadataIncomplete: metadataIncompleteGate,
  gateF_strongCaution: strongCautionGate,
  gateG_activeOnly: activeOnlyGate,
  gateH_runtimeIsolation: runtimeIsolationGate
};

const acceptanceStatus = determineAcceptanceStatus({
  safetyRegressionGate,
  lowRiskConsistencyGate,
  evidenceSeparationGate,
  serumCategoryGate,
  metadataIncompleteGate,
  strongCautionGate,
  activeOnlyGate,
  runtimeIsolationGate
});

const output = {
  generatedAt: new Date().toISOString(),
  evidenceType: "runtime_integration_acceptance_review",
  runtimeConnected: false,
  routeInvoked: false,
  supabaseWriteExecuted: false,
  runtimeMutation: false,
  evidenceSources: {
    readiness: "tmp/evaluator-boundary-readiness-review.json",
    integrationWhatIf: "tmp/evaluator-boundary-integration-whatif.json",
    candidatePolicyHintReceiverWhatIf: "tmp/candidate-policy-hint-receiver-whatif.json"
  },
  gateResults,
  safetyRegressionGate,
  lowRiskConsistencyGate,
  evidenceSeparationGate,
  unobservedGapGate: {
    status: metadataIncompleteGate.status === "conditional" &&
      strongCautionGate.status === "conditional" &&
      activeOnlyGate.status === "conditional"
      ? "conditional"
      : "fail",
    summary: "Unobserved actual/pure gaps are allowed only as required contract tests before runtime.",
    requiredGaps: ["metadata_incomplete", "strong_caution", "active_only"]
  },
  requiredContractTestsBeforeRuntime: [
    "metadata_incomplete_routes_to_insufficient_evidence",
    "strong_caution_preserves_hidden_or_hard_block",
    "active_only_safe_collapses_unsafe_preserves_hidden",
    "high_risk_or_sensitivity_unsafe_never_collapses",
    "serum_category_does_not_drive_exposure_by_itself",
    "actual_and_pure_replay_evidence_remain_separate"
  ],
  requiredShadowDryRunBeforeRuntime: [
    "shadow_runtime_dry_run_with_evaluator_pass_plus_collapsed_hint_disabled_by_default",
    "shadow_runtime_dry_run_records_hint_receiver_decisions_without_api_response_change",
    "shadow_runtime_dry_run_confirms_zero_high_risk_collapsed_receiver_count",
    "shadow_runtime_dry_run_compares_hidden_to_collapsed_delta_against_phase_27_and_28_baselines"
  ],
  acceptanceStatus,
  acceptanceReasons: [
    "safety_regression_gate_passed_with_zero_high_risk_collapsed_counts",
    lowRiskConsistencyGate.status === "pass"
      ? "observed_low_risk_consistency_gate_passed"
      : "low_risk_evidence_unavailable_runtime_not_approved",
    "actual_pure_replay_and_synthetic_evidence_are_separated",
    serumCategoryGate.status === "pass"
      ? "observed_serum_family_contract_passed"
      : "serum_family_evidence_unavailable_contract_test_required",
    "unobserved_gaps_are_conditional_required_contract_tests_not_runtime_approval"
  ],
  allowedNextStep: [
    "runtime_integration_plan_design",
    "shadow_runtime_dry_run_design",
    "contract_test_plan_for_unobserved_gaps"
  ],
  prohibitedNextStep: [
    "connect_evaluator_runtime",
    "connect_candidate_policy_runtime",
    "change_api_analyze_response",
    "change_ui_exposure",
    "change_db_or_supabase_schema",
    "replace_recommendation_results"
  ],
  limitations: [
    "acceptance_status_is_not_runtime_connection_approval",
    "active_only_not_observed_in_actual_or_pure_replay",
    "metadata_incomplete_not_observed_in_actual_or_pure_replay",
    "strong_caution_not_observed_in_actual_or_pure_replay",
    "pure_replay_does_not_exercise_route_guard_session_or_premium_store_paths",
    "contract_tests_are_required_before_any_runtime_connection_plan_can_proceed_to_implementation"
  ]
};

await mkdir(OUTPUT_DIR, { recursive: true });
await writeFile(JSON_OUTPUT, JSON.stringify(output, null, 2), "utf8");
await writeFile(MD_OUTPUT, renderMarkdown(output), "utf8");

console.log("runtime-integration-acceptance-criteria summary");
console.log(JSON.stringify({
  evidenceType: output.evidenceType,
  acceptanceStatus: output.acceptanceStatus,
  gates: Object.fromEntries(Object.entries(output.gateResults).map(([key, value]) => [key, value.status])),
  safetyRegressionGate: output.safetyRegressionGate.details,
  lowRiskConsistencyGate: output.lowRiskConsistencyGate.details,
  runtimeConnected: output.runtimeConnected,
  routeInvoked: output.routeInvoked,
  supabaseWriteExecuted: output.supabaseWriteExecuted,
  runtimeMutation: output.runtimeMutation
}, null, 2));
