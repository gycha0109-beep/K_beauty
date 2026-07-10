import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "tmp");
const JSON_OUTPUT = path.join(OUTPUT_DIR, "first-disabled-shadow-dry-run-plan.json");
const MD_OUTPUT = path.join(OUTPUT_DIR, "first-disabled-shadow-dry-run-plan.md");

const SOURCE_ARTIFACTS = {
  finalChecklist: "tmp/final-pre-runtime-integration-checklist.json",
  dryRunImplementationPlan: "tmp/shadow-dry-run-implementation-plan.json",
  shadowSafetyVerifiers: "tmp/shadow-safety-verifier-skeletons.json",
  requiredContractTests: "tmp/evaluator-boundary-required-contract-tests.json",
  routeStaticGuard: "tmp/shadow-route-insertion-static-guard.json",
  helperSkeleton: "tmp/shadow-boundary-dry-run-helper-skeleton.json"
};

const SOURCE_DOCUMENTS = [
  "docs/architecture/final-pre-runtime-integration-checklist.md",
  "docs/reviews/final-pre-runtime-integration-checklist-20260709.md",
  "docs/architecture/shadow-boundary-dry-run-helper.md",
  "docs/architecture/shadow-dry-run-snapshot-contract.md",
  "docs/architecture/shadow-dry-run-implementation-plan.md",
  "docs/architecture/shadow-runtime-dry-run-design.md",
  "docs/architecture/shadow-safety-verifier-skeletons.md",
  "docs/architecture/evaluator-boundary-required-contract-tests.md"
];

const INTENDED_PHASE37_CHANGES = new Set([
  ".codex/AI_WORK_LOG.md",
  "scripts/review-first-disabled-shadow-dry-run-plan.mjs",
  "scripts/verify-first-disabled-shadow-dry-run-plan.mjs",
  "docs/architecture/first-disabled-shadow-dry-run-plan.md",
  "docs/reviews/first-disabled-shadow-dry-run-plan-20260709.md"
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

function gitStatusFiles() {
  const status = execFileSync("git", ["status", "--short", "--untracked-files=all"], {
    cwd: ROOT,
    encoding: "utf8"
  });
  return status
    .split(/\r?\n/)
    .map((line) => line.slice(3).trim())
    .filter(Boolean);
}

function runtimeFileCheck() {
  const changedFiles = gitStatusFiles();
  const forbiddenChangedFiles = changedFiles.filter((file) =>
    FORBIDDEN_RUNTIME_FILES.includes(file) ||
    file.startsWith("data/") ||
    file.startsWith("supabase/")
  );
  const unexpectedChangedFiles = changedFiles.filter((file) => !INTENDED_PHASE37_CHANGES.has(file));
  return {
    changedFiles,
    forbiddenChangedFiles,
    unexpectedChangedFiles,
    passed: forbiddenChangedFiles.length === 0
  };
}

function item(id, required = true, status = "required", details = {}) {
  return { id, required, status, details };
}

function renderMarkdown(plan) {
  return [
    "# First Disabled Shadow Dry-run Plan",
    "",
    "This artifact is a preflight plan only. It does not approve route changes or runtime connection.",
    "",
    `- evidenceType: ${plan.evidenceType}`,
    `- runtimeConnected: ${plan.runtimeConnected}`,
    `- routeInvoked: ${plan.routeInvoked}`,
    `- supabaseWriteExecuted: ${plan.supabaseWriteExecuted}`,
    `- runtimeMutation: ${plan.runtimeMutation}`,
    "",
    "## Preflight Checklist",
    ...plan.preflightChecklist.map((entry) => `- ${entry.id}: ${entry.status}`),
    "",
    "## First Dry-run Runbook",
    ...plan.firstDryRunRunbook.map((entry) => `- ${entry.step}. ${entry.id}`),
    "",
    "## Snapshot Requirements",
    ...plan.snapshotRequirements.map((entry) => `- ${entry.id}`),
    "",
    "## Kill Criteria",
    ...plan.killCriteria.map((entry) => `- ${entry.id}`),
    "",
    "## Rollback Plan",
    ...plan.rollbackPlan.map((entry) => `- ${entry.step}. ${entry.id}`),
    "",
    "## Phase 38",
    ...plan.phase38AllowedScope.map((entry) => `- allowed: ${entry}`),
    ...plan.phase38ProhibitedScope.map((entry) => `- prohibited: ${entry}`)
  ].join("\n");
}

const [
  finalChecklist,
  dryRunImplementationPlan,
  shadowSafetyVerifiers,
  requiredContractTests,
  routeStaticGuard,
  helperSkeleton
] = await Promise.all([
  readJson(SOURCE_ARTIFACTS.finalChecklist),
  readJson(SOURCE_ARTIFACTS.dryRunImplementationPlan),
  readJson(SOURCE_ARTIFACTS.shadowSafetyVerifiers),
  readJson(SOURCE_ARTIFACTS.requiredContractTests),
  readJson(SOURCE_ARTIFACTS.routeStaticGuard),
  readJson(SOURCE_ARTIFACTS.helperSkeleton)
]);

const runtimeCheck = runtimeFileCheck();
const docsPresent = SOURCE_DOCUMENTS.every((file) => exists(file));
const phase36Ready = finalChecklist.checklistStatus === "ready_for_first_disabled_shadow_dry_run_plan";

const preflightChecklist = [
  item("branch_clean_or_only_intended_phase37_changes", true, runtimeCheck.unexpectedChangedFiles.length === 0 ? "ready" : "review_required", {
    unexpectedChangedFiles: runtimeCheck.unexpectedChangedFiles
  }),
  item("api_analyze_route_change_scope_must_be_separate_phase", true, "required"),
  item("flag_default_off", true, "required"),
  item("production_disabled_or_allowlist_dev_only_guard", true, "required"),
  item("helper_and_artifact_writer_separated", true, helperSkeleton.routeIntegrationStatus === "not_connected" ? "ready" : "blocked"),
  item("artifact_writer_failure_non_blocking", true, "required"),
  item("artifact_path_local_tmp_only", true, dryRunImplementationPlan.artifactWritePlan?.localTmpOnly === true ? "ready" : "review_required"),
  item("schema_validation_before_write", true, "required"),
  item("no_response_merge", true, "required"),
  item("no_recommendation_mutation", true, "required"),
  item("no_db_or_supabase_write", true, "required"),
  item("forbidden_fields_block", true, "required"),
  item("required_contract_tests_passed", true, requiredContractTests.passedCount === 10 && requiredContractTests.failedCount === 0 ? "ready" : "blocked"),
  item("no_response_no_recommendation_no_db_verifiers_available", true, shadowSafetyVerifiers.evidenceType === "shadow_safety_verifier_skeletons" ? "ready" : "blocked")
];

const firstDryRunRunbook = [
  { step: 1, id: "prepare_baseline_run", action: "Prepare a future baseline run plan without changing response or recommendation behavior." },
  { step: 2, id: "capture_flag_off_baseline_snapshots", action: "With the future flag off, capture response shape and recommendation snapshots only." },
  { step: 3, id: "execute_flag_on_dry_run", action: "Enable only the disabled-by-default dry-run path under explicit non-production guard." },
  { step: 4, id: "check_response_shape_diff", action: "Run the no-response-change verifier against baseline and dry-run snapshots." },
  { step: 5, id: "check_recommendation_diff", action: "Run the no-recommendation-change verifier for topPick, supportingProducts, and budgetAlternatives." },
  { step: 6, id: "check_db_write_count", action: "Run the no-DB-write verifier and require all mutation counts to be zero." },
  { step: 7, id: "validate_artifact_schema", action: "Validate the dry-run artifact before any local tmp write." },
  { step: 8, id: "scan_forbidden_fields", action: "Scan for response body dumps, display fields, raw input, media payloads, PII, and env or secret values." },
  { step: 9, id: "check_safety_kill_counts", action: "Require high-risk, sensitivity unsafe, metadata incomplete, and strong caution collapsed receiver counts to be zero." },
  { step: 10, id: "confirm_flag_off_rollback", action: "Turn the flag off and confirm dry-run code path, artifact writer, and snapshots are inactive." }
];

const snapshotRequirements = [
  item("baselineResponseShapeSnapshot"),
  item("baselineRecommendationSnapshot"),
  item("shadowBoundaryHintSnapshot"),
  item("shadowReceiverSnapshot"),
  item("comparisonSnapshot"),
  item("dbWriteSummary"),
  item("forbiddenFieldScanSummary"),
  item("killConditionSummary")
];

const killCriteria = [
  item("api_response_shape_diff"),
  item("top_pick_supporting_or_budget_diff"),
  item("db_write_count_gt_zero"),
  item("high_risk_collapsed_receiver_count_gt_zero"),
  item("sensitivity_safe_false_collapsed_receiver_count_gt_zero"),
  item("metadata_incomplete_collapsed_receiver_count_gt_zero"),
  item("strong_caution_collapsed_receiver_count_gt_zero"),
  item("forbidden_artifact_field_detected"),
  item("artifact_writer_failure_affects_response_or_recommendation"),
  item("production_guard_insufficient"),
  item("helper_result_merged_into_public_response_or_store_payload")
];

const rollbackPlan = [
  { step: 1, id: "turn_flag_off", action: "Disable the future shadow dry-run flag immediately." },
  { step: 2, id: "disable_artifact_writer", action: "Disable the artifact writer independently from the helper." },
  { step: 3, id: "remove_local_tmp_artifacts_if_needed", action: "Remove only local tmp dry-run artifacts when investigation requires it." },
  { step: 4, id: "remove_or_disable_route_dry_run_block", action: "Remove or disable the future route dry-run block from the implementation patch." },
  { step: 5, id: "reconfirm_response_and_recommendation_baseline", action: "Re-run baseline response shape and recommendation snapshot comparison." },
  { step: 6, id: "rerun_verifier_chain", action: "Re-run no-response, no-recommendation, no-DB-write, forbidden-field, and contract verifiers." },
  { step: 7, id: "write_failure_report", action: "Document the failed criterion and do not expand runtime connection." }
];

const phase38AllowedScope = [
  "first_disabled_shadow_dry_run_implementation_patch_plan",
  "route_insertion_minimal_patch_proposal",
  "artifact_writer_skeleton_proposal",
  "flag_guard_implementation_plan",
  "dry_run_snapshot_verifier_refinement"
];

const phase38ProhibitedScope = [
  "actual_route_change",
  "evaluator_runtime_connection",
  "candidate_policy_runtime_connection",
  "api_response_change",
  "recommendation_result_change",
  "db_or_supabase_change"
];

const limitations = [
  "phase37_does_not_execute_first_dry_run",
  "no_future_route_patch_is_applied",
  "no_runtime_response_or_recommendation_snapshot_pair_exists_yet",
  "artifact_writer_remains_unconnected",
  phase36Ready ? "phase36_ready_status_is_plan_readiness_only" : "phase36_ready_status_not_present"
];

const plan = {
  generatedAt: new Date().toISOString(),
  evidenceType: "first_disabled_shadow_dry_run_plan",
  runtimeConnected: false,
  routeInvoked: false,
  supabaseWriteExecuted: false,
  runtimeMutation: false,
  evidenceSources: SOURCE_ARTIFACTS,
  documentsInspected: SOURCE_DOCUMENTS,
  sourceReadiness: {
    phase36ChecklistStatus: finalChecklist.checklistStatus,
    phase36Ready,
    dryRunImplementationEvidenceType: dryRunImplementationPlan.evidenceType,
    shadowSafetyVerifierEvidenceType: shadowSafetyVerifiers.evidenceType,
    requiredContractTestsPassed: requiredContractTests.passedCount === 10 && requiredContractTests.failedCount === 0,
    routeStaticGuardRecommendedInsertionPoint: routeStaticGuard.recommendedInsertionPoint,
    routeIntegrationStatus: helperSkeleton.routeIntegrationStatus,
    documentsPresent: docsPresent,
    runtimeFileCheck: runtimeCheck
  },
  preflightChecklist,
  firstDryRunRunbook,
  snapshotRequirements,
  killCriteria,
  rollbackPlan,
  phase38AllowedScope,
  phase38ProhibitedScope,
  limitations
};

await mkdir(OUTPUT_DIR, { recursive: true });
await writeFile(JSON_OUTPUT, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
await writeFile(MD_OUTPUT, `${renderMarkdown(plan)}\n`, "utf8");

console.log("first-disabled-shadow-dry-run-plan summary");
console.log(
  JSON.stringify(
    {
      evidenceType: plan.evidenceType,
      phase36ChecklistStatus: plan.sourceReadiness.phase36ChecklistStatus,
      preflightItems: plan.preflightChecklist.length,
      runbookSteps: plan.firstDryRunRunbook.length,
      snapshotRequirements: plan.snapshotRequirements.length,
      killCriteria: plan.killCriteria.length,
      runtimeConnected: plan.runtimeConnected,
      routeInvoked: plan.routeInvoked,
      supabaseWriteExecuted: plan.supabaseWriteExecuted,
      runtimeMutation: plan.runtimeMutation
    },
    null,
    2
  )
);
