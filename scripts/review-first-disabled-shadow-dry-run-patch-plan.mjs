import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "tmp");
const JSON_OUTPUT = path.join(OUTPUT_DIR, "first-disabled-shadow-dry-run-patch-plan.json");
const MD_OUTPUT = path.join(OUTPUT_DIR, "first-disabled-shadow-dry-run-patch-plan.md");

const SOURCE_ARTIFACTS = {
  firstDryRunPlan: "tmp/first-disabled-shadow-dry-run-plan.json",
  finalChecklist: "tmp/final-pre-runtime-integration-checklist.json",
  dryRunImplementationPlan: "tmp/shadow-dry-run-implementation-plan.json",
  routeStaticGuard: "tmp/shadow-route-insertion-static-guard.json",
  helperSkeleton: "tmp/shadow-boundary-dry-run-helper-skeleton.json",
  shadowSafetyVerifiers: "tmp/shadow-safety-verifier-skeletons.json",
  requiredContractTests: "tmp/evaluator-boundary-required-contract-tests.json"
};

const SOURCE_DOCUMENTS = [
  "docs/architecture/first-disabled-shadow-dry-run-plan.md",
  "docs/reviews/first-disabled-shadow-dry-run-plan-20260709.md",
  "docs/architecture/final-pre-runtime-integration-checklist.md",
  "docs/architecture/shadow-boundary-dry-run-helper.md",
  "docs/architecture/shadow-dry-run-snapshot-contract.md",
  "docs/architecture/shadow-dry-run-implementation-plan.md",
  "docs/architecture/shadow-runtime-dry-run-design.md"
];

const INTENDED_PHASE38_CHANGES = new Set([
  ".codex/AI_WORK_LOG.md",
  "scripts/review-first-disabled-shadow-dry-run-patch-plan.mjs",
  "scripts/verify-first-disabled-shadow-dry-run-patch-plan.mjs",
  "docs/architecture/first-disabled-shadow-dry-run-patch-plan.md",
  "docs/reviews/first-disabled-shadow-dry-run-patch-plan-20260709.md"
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
  const unexpectedChangedFiles = changedFiles.filter((file) => !INTENDED_PHASE38_CHANGES.has(file));

  return {
    changedFiles,
    forbiddenChangedFiles,
    unexpectedChangedFiles,
    passed: forbiddenChangedFiles.length === 0
  };
}

function planItem(id, details = {}) {
  return { id, details };
}

function renderMarkdown(plan) {
  return [
    "# First Disabled Shadow Dry-run Patch Plan",
    "",
    "This artifact is a patch plan only. It does not apply route changes or runtime connection.",
    "",
    `- evidenceType: ${plan.evidenceType}`,
    `- runtimeConnected: ${plan.runtimeConnected}`,
    `- routeInvoked: ${plan.routeInvoked}`,
    `- supabaseWriteExecuted: ${plan.supabaseWriteExecuted}`,
    `- runtimeMutation: ${plan.runtimeMutation}`,
    "",
    "## Future Patch Scope",
    ...plan.futurePatchScope.map((entry) => `- ${entry.id}`),
    "",
    "## Feature Flag Contract",
    ...plan.featureFlagContract.rules.map((entry) => `- ${entry.id}`),
    "",
    "## Route Insertion Blueprint",
    `- recommended insertion point: ${plan.minimalRouteInsertionBlueprint.recommendedInsertionPoint}`,
    ...plan.minimalRouteInsertionBlueprint.guardrails.map((entry) => `- ${entry.id}`),
    "",
    "## Snapshot Build Sequence",
    ...plan.snapshotBuildSequence.map((entry) => `- ${entry.step}. ${entry.id}`),
    "",
    "## Artifact Writer Plan",
    ...plan.artifactWriterPlan.rules.map((entry) => `- ${entry.id}`),
    "",
    "## Required Verifier Chain",
    ...plan.requiredVerifierChain.map((entry) => `- ${entry.id}`),
    "",
    "## Kill Criteria",
    ...plan.killCriteria.map((entry) => `- ${entry.id}`),
    "",
    "## Rollback Plan",
    ...plan.rollbackPlan.map((entry) => `- ${entry.step}. ${entry.id}`)
  ].join("\n");
}

const [
  firstDryRunPlan,
  finalChecklist,
  dryRunImplementationPlan,
  routeStaticGuard,
  helperSkeleton,
  shadowSafetyVerifiers,
  requiredContractTests
] = await Promise.all([
  readJson(SOURCE_ARTIFACTS.firstDryRunPlan),
  readJson(SOURCE_ARTIFACTS.finalChecklist),
  readJson(SOURCE_ARTIFACTS.dryRunImplementationPlan),
  readJson(SOURCE_ARTIFACTS.routeStaticGuard),
  readJson(SOURCE_ARTIFACTS.helperSkeleton),
  readJson(SOURCE_ARTIFACTS.shadowSafetyVerifiers),
  readJson(SOURCE_ARTIFACTS.requiredContractTests)
]);

const runtimeCheck = runtimeFileCheck();
const documentsPresent = SOURCE_DOCUMENTS.every((file) => exists(file));

const futurePatchScope = [
  planItem("add_dev_only_guarded_call_site_to_app_api_analyze_route_js_in_phase39_only", {
    futureFile: "app/api/analyze/route.js",
    phase38Action: "document_only"
  }),
  planItem("add_shadow_boundary_dry_run_artifact_writer_helper_in_phase39_or_later", {
    futureFile: "lib/shadow-boundary-dry-run-artifact-writer.js",
    phase38Action: "document_only"
  }),
  planItem("reuse_existing_shadow_boundary_dry_run_helper"),
  planItem("reuse_existing_shadow_dry_run_snapshot_contract"),
  planItem("reuse_existing_shadow_runtime_dry_run_artifact_schema"),
  planItem("strengthen_snapshot_based_verifiers_after_future_patch")
];

const featureFlagContract = {
  candidateFlags: ["SHADOW_RUNTIME_BOUNDARY_DRY_RUN", "DEV_ONLY_SHADOW_BOUNDARY_DRY_RUN"],
  selectedForFuturePlan: "DEV_ONLY_SHADOW_BOUNDARY_DRY_RUN",
  valuesPrinted: false,
  rules: [
    planItem("default_off"),
    planItem("production_disabled_or_allowlist_dev_only_guard_required"),
    planItem("flag_value_never_logged_or_written"),
    planItem("flag_off_skips_dry_run_path"),
    planItem("flag_on_does_not_change_response_recommendation_or_db"),
    planItem("flag_on_does_not_enable_evaluator_or_candidate_policy_runtime_connection")
  ]
};

const minimalRouteInsertionBlueprint = {
  recommendedInsertionPoint: "route_outside_helper_dev_only_artifact_writer",
  timing: "after_public_decision_and_recommendation_are_final_before_response_return",
  phase38AppliesPatch: false,
  guardrails: [
    planItem("pass_only_sanitized_snapshots_to_helper_and_writer"),
    planItem("do_not_merge_helper_result_into_response"),
    planItem("do_not_add_helper_result_to_db_or_store_payload"),
    planItem("wrap_writer_failure_in_non_blocking_try_catch"),
    planItem("write_local_tmp_only"),
    planItem("block_production_artifact_write_without_strong_guard"),
    planItem("preserve_existing_recommendation_result_objects")
  ]
};

const snapshotBuildSequence = [
  { step: 1, id: "buildBaselineResponseShapeSnapshot" },
  { step: 2, id: "buildBaselineRecommendationSnapshot" },
  { step: 3, id: "buildShadowBoundaryHintSnapshot" },
  { step: 4, id: "buildShadowReceiverSnapshot" },
  { step: 5, id: "buildShadowComparisonSnapshot" },
  { step: 6, id: "buildShadowBoundaryDryRunArtifact" },
  { step: 7, id: "validate_shadow_runtime_dry_run_artifact_schema" },
  { step: 8, id: "call_sanitized_local_artifact_writer" },
  { step: 9, id: "verify_no_response_or_recommendation_mutation" }
];

const artifactWriterPlan = {
  futureFile: "lib/shadow-boundary-dry-run-artifact-writer.js",
  helperSeparated: true,
  rules: [
    planItem("local_tmp_only"),
    planItem("no_db_or_supabase_write"),
    planItem("forbidden_field_scan_before_write"),
    planItem("schema_validation_before_write"),
    planItem("write_failure_non_blocking"),
    planItem("dev_only_artifact_path"),
    planItem("no_full_response_body_dump"),
    planItem("no_display_fields_raw_input_media_or_secret_values")
  ]
};

const requiredVerifierChain = [
  planItem("verify_shadow_no_response_change"),
  planItem("verify_shadow_no_recommendation_change"),
  planItem("verify_shadow_no_db_write"),
  planItem("verify_forbidden_artifact_field_scan"),
  planItem("verify_shadow_boundary_dry_run_helper"),
  planItem("verify_shadow_dry_run_snapshot_contract"),
  planItem("verify_shadow_runtime_dry_run_artifact_schema"),
  planItem("run_evaluator_boundary_required_contract_tests"),
  planItem("review_shadow_route_insertion_static_guard"),
  planItem("review_final_pre_runtime_integration_checklist"),
  planItem("npm_run_build"),
  planItem("git_diff_check")
];

const killCriteria = [
  planItem("api_response_shape_diff"),
  planItem("top_pick_supporting_or_budget_diff"),
  planItem("db_write_count_gt_zero"),
  planItem("high_risk_collapsed_receiver_count_gt_zero"),
  planItem("sensitivity_safe_false_collapsed_receiver_count_gt_zero"),
  planItem("metadata_incomplete_collapsed_receiver_count_gt_zero"),
  planItem("strong_caution_collapsed_receiver_count_gt_zero"),
  planItem("forbidden_artifact_field_detected"),
  planItem("writer_failure_affects_response_or_recommendation"),
  planItem("production_guard_insufficient"),
  planItem("helper_result_merged_into_response_or_db_store_payload")
];

const rollbackPlan = [
  { step: 1, id: "turn_flag_off" },
  { step: 2, id: "disable_artifact_writer" },
  { step: 3, id: "remove_or_disable_route_call_site" },
  { step: 4, id: "clean_local_tmp_artifacts_if_needed" },
  { step: 5, id: "reconfirm_baseline_response_and_recommendation" },
  { step: 6, id: "rerun_verifier_chain" },
  { step: 7, id: "write_failure_report" }
];

const phase39AllowedScope = [
  "first_disabled_shadow_dry_run_minimal_patch",
  "dev_only_flag_guard_addition",
  "route_outside_artifact_writer_skeleton",
  "local_tmp_artifact_write",
  "snapshot_schema_based_verifier_refinement",
  "response_recommendation_db_write_invariance_verification"
];

const phase39ProhibitedScope = [
  "evaluator_runtime_connection",
  "candidate_policy_runtime_connection",
  "api_response_change",
  "recommendation_result_change",
  "ui_exposure_change",
  "db_or_supabase_schema_change",
  "production_activation"
];

const limitations = [
  "phase38_does_not_apply_future_route_patch",
  "phase38_does_not_add_feature_flag_to_route",
  "phase38_does_not_execute_api_analyze",
  "no_actual_baseline_after_snapshot_pair_exists_yet",
  "artifact_writer_is_planned_but_not_created_or_connected"
];

const plan = {
  generatedAt: new Date().toISOString(),
  evidenceType: "first_disabled_shadow_dry_run_patch_plan",
  runtimeConnected: false,
  routeInvoked: false,
  supabaseWriteExecuted: false,
  runtimeMutation: false,
  evidenceSources: SOURCE_ARTIFACTS,
  documentsInspected: SOURCE_DOCUMENTS,
  sourceReadiness: {
    phase37EvidenceType: firstDryRunPlan.evidenceType,
    phase36ChecklistStatus: finalChecklist.checklistStatus,
    dryRunImplementationEvidenceType: dryRunImplementationPlan.evidenceType,
    recommendedInsertionPoint: routeStaticGuard.recommendedInsertionPoint,
    helperRouteIntegrationStatus: helperSkeleton.routeIntegrationStatus,
    shadowSafetyVerifierEvidenceType: shadowSafetyVerifiers.evidenceType,
    requiredContractTestsPassed: requiredContractTests.passedCount === 10 && requiredContractTests.failedCount === 0,
    documentsPresent,
    runtimeFileCheck: runtimeCheck
  },
  futurePatchScope,
  featureFlagContract,
  minimalRouteInsertionBlueprint,
  snapshotBuildSequence,
  artifactWriterPlan,
  requiredVerifierChain,
  killCriteria,
  rollbackPlan,
  phase39AllowedScope,
  phase39ProhibitedScope,
  limitations
};

await mkdir(OUTPUT_DIR, { recursive: true });
await writeFile(JSON_OUTPUT, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
await writeFile(MD_OUTPUT, `${renderMarkdown(plan)}\n`, "utf8");

console.log("first-disabled-shadow-dry-run-patch-plan summary");
console.log(
  JSON.stringify(
    {
      evidenceType: plan.evidenceType,
      phase37EvidenceType: plan.sourceReadiness.phase37EvidenceType,
      recommendedInsertionPoint: plan.minimalRouteInsertionBlueprint.recommendedInsertionPoint,
      futurePatchScopeCount: plan.futurePatchScope.length,
      verifierCount: plan.requiredVerifierChain.length,
      killCriteriaCount: plan.killCriteria.length,
      runtimeConnected: plan.runtimeConnected,
      routeInvoked: plan.routeInvoked,
      supabaseWriteExecuted: plan.supabaseWriteExecuted,
      runtimeMutation: plan.runtimeMutation
    },
    null,
    2
  )
);
