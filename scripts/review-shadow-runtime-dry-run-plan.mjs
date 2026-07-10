import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "tmp");
const JSON_OUTPUT = path.join(OUTPUT_DIR, "shadow-runtime-dry-run-plan.json");
const MD_OUTPUT = path.join(OUTPUT_DIR, "shadow-runtime-dry-run-plan.md");
const ACCEPTANCE_PATH = path.join(ROOT, "tmp", "runtime-integration-acceptance-criteria.json");
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

const REQUIRED_CONTRACT_TESTS = [
  "metadata_incomplete_routes_to_insufficient_evidence",
  "strong_caution_preserves_hidden_or_hard_block",
  "active_only_safe_collapses_unsafe_preserves_hidden",
  "high_risk_or_sensitivity_unsafe_never_collapses",
  "serum_category_does_not_drive_exposure_by_itself",
  "actual_and_pure_replay_evidence_remain_separate",
  "no_api_response_shape_change",
  "no_recommendation_result_change_when_shadow_enabled",
  "no_db_write_from_shadow_dry_run",
  "no_forbidden_artifact_fields"
];

const FORBIDDEN_OBSERVATION_FIELDS = [
  "product_name",
  "brand",
  "purchase_url",
  "review_text",
  "raw_form",
  "image",
  "base64",
  "pii",
  "env_secret_values",
  "full_api_response_body"
];

function count(value) {
  return Number(value || 0);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function runtimeFileCheck() {
  const status = execFileSync("git", ["status", "--short", "--untracked-files=all"], {
    cwd: ROOT,
    encoding: "utf8"
  });
  const changedFiles = status
    .split(/\r?\n/)
    .map((line) => line.slice(3).trim())
    .filter(Boolean);

  const forbiddenChangedFiles = changedFiles.filter((file) =>
    FORBIDDEN_RUNTIME_FILES.includes(file) ||
    file.startsWith("data/") ||
    file.startsWith("supabase/")
  );

  return {
    changedFiles,
    forbiddenChangedFiles,
    passed: forbiddenChangedFiles.length === 0
  };
}

function renderMarkdown(output) {
  return [
    "# Shadow Runtime Dry-run Plan",
    "",
    "This is a design-only dry-run plan. It does not connect evaluator runtime or CandidatePolicy runtime.",
    "",
    `- evidenceType: ${output.evidenceType}`,
    `- readinessFromPhase29: ${output.readinessFromPhase29.acceptanceStatus}`,
    `- runtimeConnected: ${output.runtimeConnected}`,
    `- routeInvoked: ${output.routeInvoked}`,
    `- supabaseWriteExecuted: ${output.supabaseWriteExecuted}`,
    `- runtimeMutation: ${output.runtimeMutation}`,
    "",
    "## Disabled By Default",
    `- defaultState: ${output.disabledByDefaultGate.defaultState}`,
    `- explicitFlagRequired: ${output.disabledByDefaultGate.explicitFlagRequired}`,
    `- apiResponseExposure: ${output.disabledByDefaultGate.apiResponseExposure}`,
    `- recommendationMutation: ${output.disabledByDefaultGate.recommendationMutation}`,
    `- dbPersistence: ${output.disabledByDefaultGate.dbPersistence}`,
    "",
    "## Baseline vs Shadow",
    ...output.baselineVsShadowComparison.requiredComparisons.map((item) => `- ${item}`),
    "",
    "## Kill Conditions",
    ...output.killConditions.map((condition) => `- ${condition.id}`),
    "",
    "## Required Contract Tests",
    ...output.requiredContractTests.map((test) => `- ${test.id}`),
    "",
    "## Forbidden Observation Fields",
    ...output.forbiddenObservationFields.map((field) => `- ${field}`),
    "",
    "## Phase 31 Allowed Scope",
    ...output.phase31AllowedScope.map((item) => `- ${item}`),
    "",
    "## Phase 31 Prohibited Scope",
    ...output.phase31ProhibitedScope.map((item) => `- ${item}`)
  ].join("\n");
}

const acceptance = await readJson(ACCEPTANCE_PATH);
const integrationWhatIf = await readJson(INTEGRATION_WHATIF_PATH);
const receiverWhatIf = await readJson(RECEIVER_WHATIF_PATH);
const runtimeCheck = runtimeFileCheck();

const dryRunObservationScope = {
  allowedFields: [
    "productId",
    "category",
    "baselineExposureGroup",
    "whatIfExposureGroup",
    "boundaryDecision",
    "candidatePolicyHint",
    "receiverDecision",
    "highRiskCollapsedReceiverCount",
    "safeLowRiskCollapsedReceiverCount",
    "reasonKeys",
    "evidenceType",
    "runtimeConnected",
    "dryRunOnly"
  ],
  aggregationOnlyFields: [
    "hiddenToCollapsedDelta",
    "collapsedToHiddenRegressionCount",
    "metadataIncompleteRoutingCount",
    "safeLowRiskCollapsedReceiverCount",
    "highRiskCollapsedReceiverCount"
  ],
  outputRestrictions: [
    "sanitized_artifact_only",
    "dev_only_log_only",
    "no_api_response_body_dump",
    "no_product_display_fields",
    "no_env_values"
  ]
};

const baselineVsShadowComparison = {
  baselineEvidenceType: "existing_runtime_baseline_snapshot",
  shadowEvidenceType: "disabled_by_default_shadow_runtime_dry_run",
  phase27Baseline: {
    actualHiddenDelta: count(integrationWhatIf.actualWhatIfSummary?.baselineVsWhatIf?.hiddenCountDelta),
    actualCollapsedDelta: count(integrationWhatIf.actualWhatIfSummary?.baselineVsWhatIf?.collapsedCountDelta),
    pureReplayHiddenDelta: count(integrationWhatIf.pureReplayWhatIfSummary?.baselineVsWhatIf?.hiddenCountDelta),
    pureReplayCollapsedDelta: count(integrationWhatIf.pureReplayWhatIfSummary?.baselineVsWhatIf?.collapsedCountDelta)
  },
  phase28ReceiverBaseline: {
    actualHiddenDelta: count(receiverWhatIf.actualReceiverSummary?.expectedExposureDelta?.hiddenCountDelta),
    actualCollapsedDelta: count(receiverWhatIf.actualReceiverSummary?.expectedExposureDelta?.collapsedCountDelta),
    pureReplayHiddenDelta: count(receiverWhatIf.pureReplayReceiverSummary?.expectedExposureDelta?.hiddenCountDelta),
    pureReplayCollapsedDelta: count(receiverWhatIf.pureReplayReceiverSummary?.expectedExposureDelta?.collapsedCountDelta)
  },
  requiredComparisons: [
    "baseline_evaluator_result",
    "baseline_candidate_policy_exposure_result",
    "boundary_hint_whatif_result",
    "receiver_whatif_result",
    "hidden_to_collapsed_delta",
    "collapsed_to_hidden_regression",
    "high_risk_collapsed_violation",
    "metadata_incomplete_routing_result",
    "api_response_shape_diff",
    "recommendation_result_diff",
    "db_write_attempt_count"
  ],
  separationRule: "baseline_and_shadow_outputs_must_be_stored_as_separate_sanitized_sections"
};

const killConditions = [
  {
    id: "high_risk_collapsed_receiver_count_gt_zero",
    threshold: "> 0",
    blocks: ["runtime_connection", "dry_run_expansion"]
  },
  {
    id: "sensitivity_safe_false_collapsed_receiver_count_gt_zero",
    threshold: "> 0",
    blocks: ["runtime_connection", "dry_run_expansion"]
  },
  {
    id: "strong_caution_collapsed_receiver_count_gt_zero",
    threshold: "> 0",
    blocks: ["runtime_connection", "dry_run_expansion"]
  },
  {
    id: "metadata_incomplete_collapsed_receiver_count_gt_zero",
    threshold: "> 0",
    blocks: ["runtime_connection", "dry_run_expansion"]
  },
  {
    id: "api_response_shape_change_detected",
    threshold: "any",
    blocks: ["runtime_connection", "dry_run_expansion"]
  },
  {
    id: "top_pick_supporting_or_budget_result_change_detected",
    threshold: "any",
    blocks: ["runtime_connection", "dry_run_expansion"]
  },
  {
    id: "db_write_detected",
    threshold: "any",
    blocks: ["runtime_connection", "dry_run_expansion"]
  },
  {
    id: "production_flag_missing_or_misconfigured",
    threshold: "any",
    blocks: ["runtime_connection", "dry_run_expansion"]
  },
  {
    id: "forbidden_artifact_field_detected",
    threshold: "any",
    blocks: ["runtime_connection", "dry_run_expansion"]
  }
];

const requiredContractTests = REQUIRED_CONTRACT_TESTS.map((id) => {
  const descriptions = {
    metadata_incomplete_routes_to_insufficient_evidence: {
      purpose: "Metadata gaps must not be treated as safe collapsed candidates.",
      expectedResult: "receiverDecision route_to_insufficient_evidence"
    },
    strong_caution_preserves_hidden_or_hard_block: {
      purpose: "Strong caution must override collapsed hint eligibility.",
      expectedResult: "hidden or hard block preserved"
    },
    active_only_safe_collapses_unsafe_preserves_hidden: {
      purpose: "Active-only products require the safe versus unsafe metadata split.",
      expectedResult: "safe collapses; unsafe preserves hidden or hard block"
    },
    high_risk_or_sensitivity_unsafe_never_collapses: {
      purpose: "High-risk and sensitivity-unsafe candidates must never become collapsed.",
      expectedResult: "collapsed receiver count remains zero"
    },
    serum_category_does_not_drive_exposure_by_itself: {
      purpose: "Serum category must not decide exposure without metadata and boundary decision.",
      expectedResult: "category-only cases keep existing exposure or preserve hidden"
    },
    actual_and_pure_replay_evidence_remain_separate: {
      purpose: "Evidence strength must remain explicit.",
      expectedResult: "actual, pure replay, and synthetic sections stay separated"
    },
    no_api_response_shape_change: {
      purpose: "Shadow dry-run must not change public response contract.",
      expectedResult: "response field shape unchanged"
    },
    no_recommendation_result_change_when_shadow_enabled: {
      purpose: "Shadow dry-run must not alter selected recommendation groups.",
      expectedResult: "topPick, supportingProducts, and budgetAlternatives unchanged"
    },
    no_db_write_from_shadow_dry_run: {
      purpose: "Shadow dry-run must not persist diagnostic results.",
      expectedResult: "insert/update/delete/upsert/rpc mutation count is zero"
    },
    no_forbidden_artifact_fields: {
      purpose: "Dry-run artifacts must stay sanitized.",
      expectedResult: "forbidden observation fields are absent"
    }
  };
  return {
    id,
    ...descriptions[id],
    requiredBeforeRuntimeConnection: true
  };
});

const output = {
  generatedAt: new Date().toISOString(),
  evidenceType: "shadow_runtime_dry_run_plan",
  runtimeConnected: false,
  routeInvoked: false,
  supabaseWriteExecuted: false,
  runtimeMutation: false,
  evidenceSources: {
    runtimeIntegrationAcceptance: "tmp/runtime-integration-acceptance-criteria.json",
    evaluatorBoundaryIntegrationWhatIf: "tmp/evaluator-boundary-integration-whatif.json",
    candidatePolicyHintReceiverWhatIf: "tmp/candidate-policy-hint-receiver-whatif.json"
  },
  disabledByDefaultGate: {
    defaultState: "off",
    explicitFlagRequired: true,
    recommendedFlagName: "SHADOW_RUNTIME_BOUNDARY_DRY_RUN",
    productionDefault: "disabled",
    productionAdditionalGuardRequired: true,
    apiResponseExposure: "none",
    recommendationMutation: "none",
    dbPersistence: "none",
    allowedOutput: ["sanitized_artifact", "dev_only_log"],
    envValuesPrinted: false
  },
  dryRunObservationScope,
  forbiddenObservationFields: FORBIDDEN_OBSERVATION_FIELDS,
  baselineVsShadowComparison,
  killConditions,
  requiredContractTests,
  requiredDryRunVerifiers: [
    "verify_disabled_by_default_flag",
    "verify_no_api_response_shape_change",
    "verify_no_recommendation_result_change",
    "verify_no_db_write_from_shadow_dry_run",
    "verify_no_forbidden_artifact_fields",
    "verify_high_risk_collapsed_receiver_count_zero",
    "verify_metadata_incomplete_not_collapsed",
    "verify_strong_caution_not_collapsed",
    "verify_actual_pure_replay_synthetic_evidence_separation"
  ],
  phase31AllowedScope: [
    "contract_test_skeleton_or_pure_helper_unit_tests",
    "shadow_dry_run_flag_design_document_refinement",
    "dry_run_artifact_schema_design",
    "no_response_change_verifier_design",
    "no_db_write_verifier_design"
  ],
  phase31ProhibitedScope: [
    "connect_evaluator_runtime",
    "connect_candidate_policy_runtime",
    "change_api_analyze_response",
    "change_ui_exposure",
    "change_db_or_supabase_schema",
    "replace_recommendation_results"
  ],
  readinessFromPhase29: {
    acceptanceStatus: acceptance.acceptanceStatus,
    gateSummary: Object.fromEntries(
      Object.entries(acceptance.gateResults || {}).map(([key, value]) => [key, value.status])
    ),
    requiredContractTestsBeforeRuntime: acceptance.requiredContractTestsBeforeRuntime || [],
    requiredShadowDryRunBeforeRuntime: acceptance.requiredShadowDryRunBeforeRuntime || []
  },
  runtimeFileCheck: {
    passed: runtimeCheck.passed,
    forbiddenChangedFiles: runtimeCheck.forbiddenChangedFiles
  },
  limitations: [
    "dry_run_plan_is_not_runtime_connection_approval",
    "phase30_does_not_implement_contract_tests",
    "phase30_does_not_add_runtime_flags",
    "phase30_does_not_call_api_analyze",
    "actual_capture_pure_replay_and_synthetic_coverage_remain_separate",
    "metadata_incomplete_strong_caution_and_active_only_remain_required_contract_test_branches"
  ]
};

await mkdir(OUTPUT_DIR, { recursive: true });
await writeFile(JSON_OUTPUT, JSON.stringify(output, null, 2), "utf8");
await writeFile(MD_OUTPUT, renderMarkdown(output), "utf8");

console.log("shadow-runtime-dry-run-plan summary");
console.log(JSON.stringify({
  evidenceType: output.evidenceType,
  readinessFromPhase29: output.readinessFromPhase29.acceptanceStatus,
  disabledByDefault: output.disabledByDefaultGate.defaultState,
  requiredContractTests: output.requiredContractTests.map((test) => test.id),
  killConditions: output.killConditions.map((condition) => condition.id),
  runtimeConnected: output.runtimeConnected,
  routeInvoked: output.routeInvoked,
  supabaseWriteExecuted: output.supabaseWriteExecuted,
  runtimeMutation: output.runtimeMutation
}, null, 2));
