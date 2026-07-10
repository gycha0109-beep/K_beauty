import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "tmp");
const JSON_OUTPUT = path.join(OUTPUT_DIR, "final-pre-runtime-integration-checklist.json");
const MD_OUTPUT = path.join(OUTPUT_DIR, "final-pre-runtime-integration-checklist.md");

const REQUIRED_FILES = {
  collapsedHintContract: "lib/evaluator-boundary-collapsed-hint-contract.js",
  candidatePolicyHintReceiverContract: "lib/candidate-policy-hint-receiver-contract.js",
  dryRunArtifactSchema: "lib/shadow-runtime-dry-run-artifact-schema.js",
  dryRunSnapshotContract: "lib/shadow-dry-run-snapshot-contract.js",
  routeOutsideDryRunHelperSkeleton: "lib/shadow-boundary-dry-run-helper.js",
  requiredContractTestsRunner: "scripts/run-evaluator-boundary-required-contract-tests.mjs",
  noResponseVerifierSkeleton: "scripts/verify-shadow-no-response-change-skeleton.mjs",
  noRecommendationVerifierSkeleton: "scripts/verify-shadow-no-recommendation-change-skeleton.mjs",
  noDbWriteVerifierSkeleton: "scripts/verify-shadow-no-db-write-skeleton.mjs",
  shadowSafetyVerifierSkeleton: "scripts/verify-shadow-safety-verifier-skeletons.mjs",
  routeInsertionStaticGuardReview: "scripts/review-shadow-route-insertion-static-guard.mjs"
};

const ARTIFACTS = {
  boundaryReadiness: "tmp/evaluator-boundary-readiness-review.json",
  runtimeAcceptance: "tmp/runtime-integration-acceptance-criteria.json",
  requiredContractTests: "tmp/evaluator-boundary-required-contract-tests.json",
  shadowSafetyVerifiers: "tmp/shadow-safety-verifier-skeletons.json",
  dryRunImplementationPlan: "tmp/shadow-dry-run-implementation-plan.json",
  routeStaticGuard: "tmp/shadow-route-insertion-static-guard.json",
  helperSkeleton: "tmp/shadow-boundary-dry-run-helper-skeleton.json"
};

const FORBIDDEN_RUNTIME_FILES = [
  "app/api/analyze/route.js",
  "lib/skin-match-decision-engine.js",
  "lib/functional-ranking-contract.js",
  "lib/functional-candidate-policy.js",
  "app/page.js",
  "app/result/page.js",
  "app/result/full-report/page.js"
];

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(ROOT, relativePath), "utf8"));
}

function exists(relativePath) {
  return existsSync(path.join(ROOT, relativePath));
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
    helperImportedByRuntime: false,
    passed: forbiddenChangedFiles.length === 0
  };
}

function count(value) {
  return Number(value || 0);
}

function readinessItem(id, passed, details = {}) {
  return { id, passed: Boolean(passed), details };
}

function allPassed(items) {
  return items.every((item) => item.passed);
}

function renderMarkdown(output) {
  return [
    "# Final Pre-runtime Integration Checklist",
    "",
    "This checklist is not runtime approval. It only determines readiness to write a first disabled shadow dry-run plan.",
    "",
    `- evidenceType: ${output.evidenceType}`,
    `- checklistStatus: ${output.checklistStatus}`,
    `- runtimeConnected: ${output.runtimeConnected}`,
    `- routeInvoked: ${output.routeInvoked}`,
    `- supabaseWriteExecuted: ${output.supabaseWriteExecuted}`,
    `- runtimeMutation: ${output.runtimeMutation}`,
    "",
    "## Readiness",
    `- policy: ${output.policyReadiness.passed}`,
    `- contract: ${output.contractReadiness.passed}`,
    `- safety verifiers: ${output.safetyVerifierReadiness.passed}`,
    `- route isolation: ${output.routeIsolationReadiness.passed}`,
    `- artifact safety: ${output.artifactSafetyReadiness.passed}`,
    "",
    "## Allow Conditions",
    ...output.firstRuntimeDryRunAllowConditions.map((condition) => `- ${condition.id}`),
    "",
    "## Block Conditions",
    ...output.blockConditions.map((condition) => `- ${condition.id}`),
    "",
    "## Phase 37",
    ...output.phase37AllowedScope.map((item) => `- allowed: ${item}`),
    ...output.phase37ProhibitedScope.map((item) => `- prohibited: ${item}`)
  ].join("\n");
}

const [
  boundaryReadiness,
  runtimeAcceptance,
  requiredContractTests,
  shadowSafetyVerifiers,
  dryRunImplementationPlan,
  routeStaticGuard,
  helperSkeleton
] = await Promise.all([
  readJson(ARTIFACTS.boundaryReadiness),
  readJson(ARTIFACTS.runtimeAcceptance),
  readJson(ARTIFACTS.requiredContractTests),
  readJson(ARTIFACTS.shadowSafetyVerifiers),
  readJson(ARTIFACTS.dryRunImplementationPlan),
  readJson(ARTIFACTS.routeStaticGuard),
  readJson(ARTIFACTS.helperSkeleton)
]);

const runtimeCheck = runtimeFileCheck();

const highRiskCollapsedActual = count(boundaryReadiness.safetyRegressionCheck?.highRiskCollapsedCountActual);
const highRiskCollapsedPureReplay = count(boundaryReadiness.safetyRegressionCheck?.highRiskCollapsedCountPureReplay);
const actualSafeLowRows = count(boundaryReadiness.lowRiskDowngradeConsistency?.actualSafeLowRiskHiddenRows);
const actualSafeLowDowngraded = count(boundaryReadiness.lowRiskDowngradeConsistency?.actualDowngradeToCollapsedCount);
const pureSafeLowRows = count(boundaryReadiness.lowRiskDowngradeConsistency?.pureReplaySafeLowRiskHiddenRows);
const pureSafeLowDowngraded = count(boundaryReadiness.lowRiskDowngradeConsistency?.pureReplayDowngradeToCollapsedCount);

const policyItems = [
  readinessItem("boundary_policy_ready_for_design", boundaryReadiness.readinessStatus === "ready_for_boundary_integration_design", {
    readinessStatus: boundaryReadiness.readinessStatus
  }),
  readinessItem("runtime_acceptance_ready_for_plan", runtimeAcceptance.acceptanceStatus === "ready_for_runtime_integration_plan", {
    acceptanceStatus: runtimeAcceptance.acceptanceStatus
  }),
  readinessItem("high_risk_collapsed_zero_actual_and_pure", highRiskCollapsedActual === 0 && highRiskCollapsedPureReplay === 0, {
    actual: highRiskCollapsedActual,
    pureReplay: highRiskCollapsedPureReplay
  }),
  readinessItem(
    "low_risk_collapsed_consistency_actual_and_pure",
    actualSafeLowRows === actualSafeLowDowngraded && pureSafeLowRows === pureSafeLowDowngraded,
    {
      actualSafeLowRows,
      actualSafeLowDowngraded,
      pureSafeLowRows,
      pureSafeLowDowngraded
    }
  )
];

const contractItems = [
  ...Object.entries(REQUIRED_FILES)
    .filter(([id]) =>
      [
        "collapsedHintContract",
        "candidatePolicyHintReceiverContract",
        "dryRunArtifactSchema",
        "dryRunSnapshotContract",
        "routeOutsideDryRunHelperSkeleton"
      ].includes(id)
    )
    .map(([id, file]) => readinessItem(id, exists(file), { file })),
  readinessItem("required_contract_tests_10_passed", requiredContractTests.passedCount === 10 && requiredContractTests.failedCount === 0, {
    passedCount: requiredContractTests.passedCount,
    failedCount: requiredContractTests.failedCount
  })
];

const safetyVerifierItems = [
  readinessItem("no_response_change_skeleton_exists", exists(REQUIRED_FILES.noResponseVerifierSkeleton), {
    file: REQUIRED_FILES.noResponseVerifierSkeleton
  }),
  readinessItem("no_recommendation_change_skeleton_exists", exists(REQUIRED_FILES.noRecommendationVerifierSkeleton), {
    file: REQUIRED_FILES.noRecommendationVerifierSkeleton
  }),
  readinessItem("no_db_write_skeleton_exists", exists(REQUIRED_FILES.noDbWriteVerifierSkeleton), {
    file: REQUIRED_FILES.noDbWriteVerifierSkeleton
  }),
  readinessItem("shadow_safety_verifier_skeleton_passed", shadowSafetyVerifiers.evidenceType === "shadow_safety_verifier_skeletons", {
    noResponse: shadowSafetyVerifiers.skeletons?.noResponseChange?.passed,
    noRecommendation: shadowSafetyVerifiers.skeletons?.noRecommendationChange?.passed,
    noDbWrite: shadowSafetyVerifiers.skeletons?.noDbWrite?.passed
  }),
  readinessItem("kill_conditions_exist", Array.isArray(dryRunImplementationPlan.killSwitchPlan?.killConditions), {
    killConditions: dryRunImplementationPlan.killSwitchPlan?.killConditions?.map((condition) => condition.id) || []
  })
];

const routeIsolationItems = [
  readinessItem("runtime_files_not_modified", runtimeCheck.passed, runtimeCheck),
  readinessItem(
    "recommended_insertion_point_route_outside_helper",
    routeStaticGuard.recommendedInsertionPoint === "route_outside_helper_dev_only_artifact_writer",
    { recommendedInsertionPoint: routeStaticGuard.recommendedInsertionPoint }
  ),
  readinessItem("route_static_guard_review_present", routeStaticGuard.evidenceType === "shadow_route_insertion_static_guard_review", {
    evidenceType: routeStaticGuard.evidenceType
  }),
  readinessItem("helper_not_connected_to_route", helperSkeleton.routeIntegrationStatus === "not_connected", {
    routeIntegrationStatus: helperSkeleton.routeIntegrationStatus
  })
];

const artifactSafetyItems = [
  readinessItem("artifact_local_tmp_only", dryRunImplementationPlan.artifactWritePlan?.localTmpOnly === true),
  readinessItem("artifact_db_persistence_forbidden", dryRunImplementationPlan.artifactWritePlan?.dbPersistenceAllowed === false),
  readinessItem(
    "api_response_merge_forbidden",
    routeStaticGuard.prohibitedImplementationPatterns?.includes("append_shadow_artifact_to_api_response")
  ),
  readinessItem(
    "full_response_body_dump_forbidden",
    routeStaticGuard.prohibitedImplementationPatterns?.includes("dump_full_api_response_body")
  ),
  readinessItem(
    "product_display_fields_forbidden",
    routeStaticGuard.prohibitedImplementationPatterns?.includes("record_product_display_fields_or_raw_input")
  ),
  readinessItem("env_secret_output_forbidden", routeStaticGuard.prohibitedImplementationPatterns?.includes("print_env_or_secret_values")),
  readinessItem(
    "artifact_writer_failure_non_blocking",
    routeStaticGuard.requiredGuardrails?.includes("artifact_write_failure_non_blocking_for_response") ||
      dryRunImplementationPlan.artifactWritePlan?.writerFailureBehavior === "must_not_change_response_or_recommendation"
  )
];

const firstRuntimeDryRunAllowConditions = [
  "flag_default_off",
  "production_disabled_or_allowlist_dev_only_guard",
  "response_snapshot_and_recommendation_snapshot_separated",
  "baseline_and_shadow_sections_separated",
  "no_api_response_shape_change_verifier_runs",
  "no_recommendation_result_change_verifier_runs",
  "no_db_write_verifier_runs",
  "forbidden_field_verifier_runs",
  "required_contract_tests_run",
  "high_risk_metadata_incomplete_strong_caution_kill_conditions_active",
  "artifact_writer_separated_from_helper",
  "artifact_writer_failure_non_blocking_for_response_and_recommendation"
].map((id) => ({ id, required: true }));

const blockConditions = [
  "high_risk_collapsed_receiver_count_gt_zero",
  "sensitivity_safe_false_collapsed_receiver_count_gt_zero",
  "metadata_incomplete_collapsed_receiver_count_gt_zero",
  "strong_caution_collapsed_receiver_count_gt_zero",
  "api_response_shape_diff",
  "top_pick_supporting_or_budget_diff",
  "db_write_count_gt_zero",
  "forbidden_artifact_field_detected",
  "production_flag_guard_insufficient",
  "route_helper_result_merged_into_public_response",
  "helper_result_written_to_db_or_store_payload"
].map((id) => ({ id, blocksFirstRuntimeDryRunConnection: true }));

const routeInvoked = [
  boundaryReadiness,
  runtimeAcceptance,
  shadowSafetyVerifiers,
  dryRunImplementationPlan,
  routeStaticGuard,
  helperSkeleton
].some((artifact) => artifact.routeInvoked === true);
const supabaseWriteExecuted = [
  boundaryReadiness,
  runtimeAcceptance,
  shadowSafetyVerifiers,
  dryRunImplementationPlan,
  routeStaticGuard,
  helperSkeleton
].some((artifact) => artifact.supabaseWriteExecuted === true);
const runtimeMutation = [
  boundaryReadiness,
  runtimeAcceptance,
  shadowSafetyVerifiers,
  dryRunImplementationPlan,
  routeStaticGuard,
  helperSkeleton
].some((artifact) => artifact.runtimeMutation === true);

const safetyViolation =
  highRiskCollapsedActual > 0 ||
  highRiskCollapsedPureReplay > 0 ||
  helperSkeleton.killConditionCoverage?.highRiskBlocked === false ||
  helperSkeleton.killConditionCoverage?.metadataIncompleteBlocked === false;
const missingContract = !allPassed(contractItems) || !allPassed(safetyVerifierItems);
const needsRouteStaticReview = !allPassed(routeIsolationItems);
const needsMorePreflight =
  !dryRunImplementationPlan.verifierChainPlan?.requiredVerifiers?.includes("verify-shadow-no-response-change-skeleton") ||
  !dryRunImplementationPlan.verifierChainPlan?.requiredVerifiers?.includes("verify-shadow-no-recommendation-change-skeleton") ||
  !dryRunImplementationPlan.verifierChainPlan?.requiredVerifiers?.includes("verify-shadow-no-db-write-skeleton");

let checklistStatus = "ready_for_first_disabled_shadow_dry_run_plan";
if (safetyViolation) {
  checklistStatus = "blocked_by_safety_regression";
} else if (routeInvoked || supabaseWriteExecuted || runtimeMutation) {
  checklistStatus = "blocked_by_runtime_mutation";
} else if (missingContract) {
  checklistStatus = "blocked_by_missing_contract";
} else if (needsRouteStaticReview) {
  checklistStatus = "needs_more_route_static_review";
} else if (needsMorePreflight) {
  checklistStatus = "needs_more_preflight_tests";
}

const output = {
  generatedAt: new Date().toISOString(),
  evidenceType: "final_pre_runtime_integration_checklist",
  runtimeConnected: false,
  routeInvoked: false,
  supabaseWriteExecuted: false,
  runtimeMutation: false,
  evidenceSources: ARTIFACTS,
  policyReadiness: {
    passed: allPassed(policyItems),
    items: policyItems
  },
  contractReadiness: {
    passed: allPassed(contractItems),
    items: contractItems
  },
  safetyVerifierReadiness: {
    passed: allPassed(safetyVerifierItems),
    items: safetyVerifierItems
  },
  routeIsolationReadiness: {
    passed: allPassed(routeIsolationItems),
    items: routeIsolationItems
  },
  artifactSafetyReadiness: {
    passed: allPassed(artifactSafetyItems),
    items: artifactSafetyItems
  },
  firstRuntimeDryRunAllowConditions,
  blockConditions,
  checklistStatus,
  checklistReasons: [
    `policy_readiness:${allPassed(policyItems)}`,
    `contract_readiness:${allPassed(contractItems)}`,
    `safety_verifier_readiness:${allPassed(safetyVerifierItems)}`,
    `route_isolation_readiness:${allPassed(routeIsolationItems)}`,
    `artifact_safety_readiness:${allPassed(artifactSafetyItems)}`,
    `runtime_flags_clear:${!routeInvoked && !supabaseWriteExecuted && !runtimeMutation}`
  ],
  phase37AllowedScope: [
    "first_disabled_shadow_dry_run_plan",
    "disabled_shadow_dry_run_preflight_plan",
    "artifact_writer_skeleton_design_if_kept_route_disconnected"
  ],
  phase37ProhibitedScope: [
    "api_analyze_route_change",
    "shadow_flag_added_to_route",
    "evaluator_runtime_connection",
    "candidate_policy_runtime_connection",
    "api_response_change",
    "recommendation_result_change",
    "db_or_supabase_write"
  ],
  limitations: [
    "checklist_is_not_runtime_connection_approval",
    "first_disabled_shadow_dry_run_plan_still_requires_separate_approval",
    "no_api_analyze_request_executed",
    "no_actual_runtime_snapshot_collected",
    "no_artifact_writer_connected_to_route"
  ]
};

await mkdir(OUTPUT_DIR, { recursive: true });
await writeFile(JSON_OUTPUT, `${JSON.stringify(output, null, 2)}\n`);
await writeFile(MD_OUTPUT, `${renderMarkdown(output)}\n`);

console.log("final-pre-runtime-integration-checklist summary");
console.log(JSON.stringify({
  evidenceType: output.evidenceType,
  checklistStatus: output.checklistStatus,
  policyReadiness: output.policyReadiness.passed,
  contractReadiness: output.contractReadiness.passed,
  safetyVerifierReadiness: output.safetyVerifierReadiness.passed,
  routeIsolationReadiness: output.routeIsolationReadiness.passed,
  artifactSafetyReadiness: output.artifactSafetyReadiness.passed,
  runtimeConnected: output.runtimeConnected,
  routeInvoked: output.routeInvoked,
  supabaseWriteExecuted: output.supabaseWriteExecuted,
  runtimeMutation: output.runtimeMutation
}, null, 2));
