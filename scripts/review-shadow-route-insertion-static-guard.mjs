import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "tmp");
const JSON_OUTPUT = path.join(OUTPUT_DIR, "shadow-route-insertion-static-guard.json");
const MD_OUTPUT = path.join(OUTPUT_DIR, "shadow-route-insertion-static-guard.md");

const FILES_INSPECTED = [
  "app/api/analyze/route.js",
  "lib/shadow-dry-run-snapshot-contract.js",
  "lib/shadow-runtime-dry-run-artifact-schema.js",
  "docs/architecture/shadow-dry-run-implementation-plan.md",
  "tmp/shadow-dry-run-implementation-plan.json"
];

const FORBIDDEN_RUNTIME_FILES = [
  "app/api/analyze/route.js",
  "lib/skin-match-decision-engine.js",
  "lib/functional-ranking-contract.js",
  "lib/functional-candidate-policy.js",
  "app/page.js",
  "app/result/page.js",
  "app/result/full-report/page.js"
];

async function readText(relativePath) {
  return readFile(path.join(ROOT, relativePath), "utf8");
}

function firstLineMatching(text, pattern) {
  const lines = text.split(/\r?\n/);
  const index = lines.findIndex((line) => pattern.test(line));
  return index === -1 ? null : index + 1;
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

function insertionPointReview({
  id,
  staticAnchor,
  responseMutationRisk,
  recommendationMutationRisk,
  dbWriteRisk,
  artifactContaminationRisk,
  requiredGuardrails,
  recommendation,
  rationale
}) {
  return {
    id,
    staticAnchor,
    responseMutationRisk,
    recommendationMutationRisk,
    dbWriteRisk,
    artifactContaminationRisk,
    requiredGuardrails,
    recommendation,
    rationale
  };
}

function renderMarkdown(output) {
  return [
    "# Shadow Route Insertion Static Guard Review",
    "",
    "This is a static review only. It does not edit or invoke `/api/analyze`.",
    "",
    `- evidenceType: ${output.evidenceType}`,
    `- runtimeConnected: ${output.runtimeConnected}`,
    `- routeInvoked: ${output.routeInvoked}`,
    `- supabaseWriteExecuted: ${output.supabaseWriteExecuted}`,
    `- runtimeMutation: ${output.runtimeMutation}`,
    "",
    "## Recommended Insertion Point",
    `- ${output.recommendedInsertionPoint}`,
    "",
    "## Insertion Points",
    ...output.insertionPointReviews.map(
      (review) =>
        `- ${review.id}: response=${review.responseMutationRisk}, recommendation=${review.recommendationMutationRisk}, db=${review.dbWriteRisk}, recommendation=${review.recommendation}`
    ),
    "",
    "## Required Guardrails",
    ...output.requiredGuardrails.map((guardrail) => `- ${guardrail}`),
    "",
    "## Prohibited Patterns",
    ...output.prohibitedImplementationPatterns.map((pattern) => `- ${pattern}`)
  ].join("\n");
}

const routeText = await readText("app/api/analyze/route.js");
const implementationPlan = JSON.parse(await readText("tmp/shadow-dry-run-implementation-plan.json"));
const runtimeCheck = runtimeFileCheck();

const routeStaticAnchors = {
  functionalShadowCaptureHelperLine: firstLineMatching(routeText, /captureFunctionalShadowIfEnabled/),
  publicDecisionLine: firstLineMatching(routeText, /const publicDecision = buildFreeDecisionPayload\(decision\)/),
  candidateSourceDiagnosticsLine: firstLineMatching(routeText, /candidateSource: decision\?\.diagnostics\?\.candidateSource/),
  premiumSessionLine: firstLineMatching(routeText, /createPremiumReportSession/),
  responseConstructionLine: firstLineMatching(routeText, /const response = NextResponse\.json/),
  finalReturnLine: firstLineMatching(routeText, /return applyAnalysisGuardCookies\(NextResponse\.json/)
};

const insertionPointReviews = [
  insertionPointReview({
    id: "after_public_decision_created",
    staticAnchor: { line: routeStaticAnchors.publicDecisionLine, signal: "public_decision_payload_available" },
    responseMutationRisk: "medium",
    recommendationMutationRisk: "medium",
    dbWriteRisk: "low",
    artifactContaminationRisk: "medium",
    requiredGuardrails: [
      "read_only_public_decision_snapshot",
      "no_shadow_fields_on_public_response",
      "recommendation_snapshot_before_shadow_processing"
    ],
    recommendation: "conditional",
    rationale: "Final public decision exists, but the response object is close enough that accidental mutation risk is material."
  }),
  insertionPointReview({
    id: "after_candidate_source_diagnostics_created",
    staticAnchor: {
      line: routeStaticAnchors.candidateSourceDiagnosticsLine,
      signal: "candidate_source_diagnostics_observable"
    },
    responseMutationRisk: "low",
    recommendationMutationRisk: "low",
    dbWriteRisk: "low",
    artifactContaminationRisk: "low",
    requiredGuardrails: [
      "read_only_candidate_source_snapshot",
      "separate_final_recommendation_snapshot",
      "local_tmp_artifact_only"
    ],
    recommendation: "recommended_with_additional_snapshot_boundary",
    rationale: "Candidate diagnostics are useful for shadow context, but final response shape still needs a separate baseline snapshot."
  }),
  insertionPointReview({
    id: "before_premium_store",
    staticAnchor: { line: routeStaticAnchors.premiumSessionLine, signal: "persistence_boundary_nearby" },
    responseMutationRisk: "medium",
    recommendationMutationRisk: "medium",
    dbWriteRisk: "medium",
    artifactContaminationRisk: "medium",
    requiredGuardrails: [
      "no_store_payload_mutation",
      "dry_run_artifact_writer_not_reused_for_persistence",
      "db_write_count_zero_verifier"
    ],
    recommendation: "not_preferred",
    rationale: "The route has a persistence boundary, so this insertion point increases confusion risk between dry-run artifacts and stored payloads."
  }),
  insertionPointReview({
    id: "before_response_return_sanitized_comparison_only",
    staticAnchor: { line: routeStaticAnchors.responseConstructionLine, signal: "response_construction_nearby" },
    responseMutationRisk: "medium",
    recommendationMutationRisk: "low",
    dbWriteRisk: "low",
    artifactContaminationRisk: "medium",
    requiredGuardrails: [
      "no_response_object_append",
      "artifact_write_failure_non_blocking",
      "shape_snapshot_only"
    ],
    recommendation: "conditional",
    rationale: "The final shape is observable, but artifact contamination risk is higher because the return path is adjacent."
  }),
  insertionPointReview({
    id: "route_outside_helper_dev_only_artifact_writer",
    staticAnchor: {
      line: routeStaticAnchors.functionalShadowCaptureHelperLine,
      signal: "existing_dev_shadow_capture_pattern_available"
    },
    responseMutationRisk: "low",
    recommendationMutationRisk: "low",
    dbWriteRisk: "low",
    artifactContaminationRisk: "low",
    requiredGuardrails: [
      "disabled_by_default_flag_gate_before_helper",
      "pure_snapshot_inputs_only",
      "helper_result_not_merged_into_response",
      "helper_result_not_persisted",
      "schema_validation_before_local_artifact_write",
      "artifact_write_failure_non_blocking"
    ],
    recommendation: "recommended",
    rationale:
      "The route already has a dev-only shadow capture pattern, and a future pure helper plus local artifact writer can keep response, recommendation, and DB boundaries explicit."
  })
];

const requiredGuardrails = [
  "disabled_by_default_flag_gate_before_helper",
  "production_disabled_or_internal_allowlist_required",
  "snapshot_contract_helper_only_accepts_sanitized_inputs",
  "helper_result_not_merged_into_public_response",
  "helper_result_not_written_to_db_or_store_payload",
  "schema_validation_before_local_tmp_artifact_write",
  "artifact_write_failure_non_blocking_for_response",
  "no_candidate_policy_runtime_import",
  "no_evaluator_runtime_score_or_hard_filter_change",
  "run_no_response_no_recommendation_no_db_write_verifier_chain"
];

const prohibitedImplementationPatterns = [
  "append_shadow_artifact_to_api_response",
  "mutate_public_decision_or_recommendation_groups",
  "write_shadow_artifact_to_db_or_supabase",
  "reuse_premium_store_payload_for_shadow_artifact",
  "dump_full_api_response_body",
  "record_product_display_fields_or_raw_input",
  "print_env_or_secret_values",
  "call_candidate_policy_runtime_from_shadow_helper",
  "change_evaluator_hard_filter_score_or_weight"
];

const output = {
  generatedAt: new Date().toISOString(),
  evidenceType: "shadow_route_insertion_static_guard_review",
  runtimeConnected: false,
  routeInvoked: false,
  supabaseWriteExecuted: false,
  runtimeMutation: false,
  filesInspected: FILES_INSPECTED,
  routeStaticAnchors,
  phase33RecommendedInsertionPoint: implementationPlan.recommendedInsertionPoint?.id || null,
  insertionPointReviews,
  recommendedInsertionPoint: "route_outside_helper_dev_only_artifact_writer",
  requiredGuardrails,
  prohibitedImplementationPatterns,
  runtimeFileCheck: runtimeCheck,
  limitations: [
    "static_review_only_no_route_change",
    "line_numbers_are_static_anchor_hints_not_runtime_execution_evidence",
    "does_not_add_shadow_flag_to_api_analyze",
    "does_not_call_api_analyze",
    "does_not_execute_supabase_write"
  ]
};

await mkdir(OUTPUT_DIR, { recursive: true });
await writeFile(JSON_OUTPUT, `${JSON.stringify(output, null, 2)}\n`);
await writeFile(MD_OUTPUT, `${renderMarkdown(output)}\n`);

console.log("shadow-route-insertion-static-guard summary");
console.log(JSON.stringify({
  evidenceType: output.evidenceType,
  insertionPointReviews: output.insertionPointReviews.length,
  recommendedInsertionPoint: output.recommendedInsertionPoint,
  runtimeConnected: output.runtimeConnected,
  routeInvoked: output.routeInvoked,
  supabaseWriteExecuted: output.supabaseWriteExecuted,
  runtimeMutation: output.runtimeMutation
}, null, 2));
