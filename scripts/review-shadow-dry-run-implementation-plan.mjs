import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  FORBIDDEN_SHADOW_ARTIFACT_FIELDS,
  SHADOW_RUNTIME_DRY_RUN_ARTIFACT_SCHEMA_VERSION
} from "../lib/shadow-runtime-dry-run-artifact-schema.js";

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "tmp");
const JSON_OUTPUT = path.join(OUTPUT_DIR, "shadow-dry-run-implementation-plan.json");
const MD_OUTPUT = path.join(OUTPUT_DIR, "shadow-dry-run-implementation-plan.md");
const DRY_RUN_PLAN_PATH = path.join(ROOT, "tmp", "shadow-runtime-dry-run-plan.json");
const SAFETY_SKELETON_PATH = path.join(ROOT, "tmp", "shadow-safety-verifier-skeletons.json");
const REQUIRED_CONTRACT_TESTS_PATH = path.join(ROOT, "tmp", "evaluator-boundary-required-contract-tests.json");

const FORBIDDEN_RUNTIME_FILES = [
  "app/api/analyze/route.js",
  "lib/skin-match-decision-engine.js",
  "lib/functional-ranking-contract.js",
  "lib/functional-candidate-policy.js",
  "app/page.js",
  "app/result/page.js",
  "app/result/full-report/page.js"
];

const FORBIDDEN_OBSERVATION_FIELDS = [
  "product_name",
  "productName",
  "name",
  "brand",
  "purchase_url",
  "purchaseUrl",
  "buy_link",
  "buyLink",
  "review_text",
  "reviewText",
  "raw_form",
  "rawForm",
  "image",
  "image_url",
  "imageUrl",
  "base64",
  "pii",
  "email",
  "cookie",
  "user_agent",
  "userAgent",
  "env_value",
  "secret_value",
  "token_value",
  "api_key_value",
  "full_api_response_body",
  "fullApiResponseBody",
  "apiResponseBody",
  "responseBody"
];

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

function routeCandidate(id, description, recommendation, risks, guardrails) {
  return {
    id,
    description,
    advantages: guardrails.advantages,
    risks,
    requiredGuardrails: guardrails.requiredGuardrails,
    responseChangeRisk: guardrails.responseChangeRisk,
    recommendationChangeRisk: guardrails.recommendationChangeRisk,
    dbWriteRisk: guardrails.dbWriteRisk,
    recommendation
  };
}

function renderMarkdown(output) {
  return [
    "# Shadow Dry-run Implementation Plan",
    "",
    "This artifact is an implementation plan only. It does not connect runtime dry-run code.",
    "",
    `- evidenceType: ${output.evidenceType}`,
    `- runtimeConnected: ${output.runtimeConnected}`,
    `- routeInvoked: ${output.routeInvoked}`,
    `- supabaseWriteExecuted: ${output.supabaseWriteExecuted}`,
    `- runtimeMutation: ${output.runtimeMutation}`,
    "",
    "## Feature Flag",
    `- defaultState: ${output.featureFlagPlan.defaultState}`,
    `- recommendedFlagName: ${output.featureFlagPlan.recommendedFlagName}`,
    `- productionDefault: ${output.featureFlagPlan.productionDefault}`,
    "",
    "## Recommended Insertion Point",
    `- ${output.recommendedInsertionPoint.id}`,
    `- rationale: ${output.recommendedInsertionPoint.rationale}`,
    "",
    "## Snapshot Contract",
    ...output.snapshotContractPlan.requiredSnapshots.map((snapshot) => `- ${snapshot.id}`),
    "",
    "## Verifier Chain",
    ...output.verifierChainPlan.requiredVerifiers.map((verifier) => `- ${verifier}`),
    "",
    "## Kill Switch",
    ...output.killSwitchPlan.killConditions.map((condition) => `- ${condition.id}`),
    "",
    "## Phase 34",
    ...output.phase34AllowedScope.map((item) => `- allowed: ${item}`),
    ...output.phase34ProhibitedScope.map((item) => `- prohibited: ${item}`)
  ].join("\n");
}

const dryRunPlan = await readJson(DRY_RUN_PLAN_PATH);
const safetySkeletons = await readJson(SAFETY_SKELETON_PATH);
const requiredContractTests = await readJson(REQUIRED_CONTRACT_TESTS_PATH);
const runtimeCheck = runtimeFileCheck();

const featureFlagPlan = {
  defaultState: "off",
  recommendedFlagName: dryRunPlan.disabledByDefaultGate?.recommendedFlagName || "SHADOW_RUNTIME_BOUNDARY_DRY_RUN",
  alternateFlagNameCandidates: [
    "SHADOW_RUNTIME_BOUNDARY_DRY_RUN",
    "ANALYZE_SHADOW_BOUNDARY_DRY_RUN",
    "DEV_ONLY_SHADOW_BOUNDARY_DRY_RUN"
  ],
  flagValuePrinted: false,
  productionDefault: "disabled",
  productionAdditionalGuardRequired: true,
  productionGuardCandidates: [
    "NODE_ENV_not_production",
    "explicit_internal_allowlist",
    "dev_only_artifact_writer_guard"
  ],
  disabledBehavior: "dry_run_code_path_not_executed",
  enabledBehavior: "shadow_snapshot_and_sanitized_artifact_only",
  apiResponseMutationAllowed: false,
  recommendationMutationAllowed: false,
  dbWriteAllowed: false
};

const routeInsertionPointCandidates = [
  routeCandidate(
    "after_public_decision_created",
    "Run future dry-run after publicDecision exists.",
    "conditional",
    [
      "public response object is in scope, so accidental response mutation risk must be guarded",
      "baseline recommendation snapshot must be captured before any shadow object is attached"
    ],
    {
      advantages: [
        "topPick/supportingProducts/budgetAlternatives are available for baseline snapshot",
        "response shape comparison can be designed near final payload construction"
      ],
      requiredGuardrails: [
        "deep clone or read-only snapshot only",
        "no mutation of publicDecision",
        "no shadow fields appended to response"
      ],
      responseChangeRisk: "medium",
      recommendationChangeRisk: "medium",
      dbWriteRisk: "low"
    }
  ),
  routeCandidate(
    "after_candidate_source_diagnostics_created",
    "Run future dry-run after candidate source diagnostics are available.",
    "recommended_with_dev_only_artifact_writer",
    [
      "candidate diagnostics may not include final public response shape",
      "must wait until recommendation summary snapshot is available"
    ],
    {
      advantages: [
        "candidate source and scorer-compatible rows can be observed without calling route again",
        "dry-run can keep actual and shadow diagnostics separated"
      ],
      requiredGuardrails: [
        "read-only diagnostics snapshot",
        "separate baseline recommendation snapshot",
        "local tmp artifact only"
      ],
      responseChangeRisk: "low",
      recommendationChangeRisk: "low",
      dbWriteRisk: "low"
    }
  ),
  routeCandidate(
    "before_premium_store",
    "Run future dry-run before any premium/report persistence boundary.",
    "conditional_not_preferred",
    [
      "dry-run artifact write failure could be confused with persistence failure",
      "must prove no DB write and no store payload mutation"
    ],
    {
      advantages: [
        "can compare baseline snapshots before persistence side effects",
        "DB write guard can be placed close to persistence boundary"
      ],
      requiredGuardrails: [
        "strict no-persistence dry-run branch",
        "artifact writer isolated from premium store payload",
        "no mutation of stored report object"
      ],
      responseChangeRisk: "medium",
      recommendationChangeRisk: "medium",
      dbWriteRisk: "medium"
    }
  ),
  routeCandidate(
    "before_response_return_sanitized_comparison_only",
    "Run future dry-run immediately before returning response, producing only sanitized comparison.",
    "conditional",
    [
      "late insertion increases risk of accidentally attaching artifact to response",
      "artifact write must not block response return"
    ],
    {
      advantages: [
        "final baseline response shape is available",
        "recommendation result snapshot can be compared against final result"
      ],
      requiredGuardrails: [
        "firewalled local artifact writer",
        "try/catch that cannot affect response",
        "no response object append"
      ],
      responseChangeRisk: "medium",
      recommendationChangeRisk: "low",
      dbWriteRisk: "low"
    }
  ),
  routeCandidate(
    "route_outside_helper_dev_only_artifact_writer",
    "Call a future pure helper from the route and keep artifact writing behind a dev-only local writer.",
    "recommended",
    [
      "requires a narrow future route touch to call the helper",
      "must statically prove helper return is not merged into API response"
    ],
    {
      advantages: [
        "keeps evaluator hint and receiver what-if logic outside route body",
        "makes no-response/no-recommendation/no-db-write verifiers easier to scope",
        "enforces sanitized artifact schema at the writer boundary"
      ],
      requiredGuardrails: [
        "disabled-by-default flag gate at helper entry",
        "pure snapshot inputs only",
        "local tmp artifact only",
        "artifact write failure swallowed into dev-only diagnostic status",
        "no import path from CandidatePolicy runtime"
      ],
      responseChangeRisk: "low",
      recommendationChangeRisk: "low",
      dbWriteRisk: "low"
    }
  )
];

const recommendedInsertionPoint = {
  id: "route_outside_helper_dev_only_artifact_writer",
  rationale:
    "Use a pure helper fed by sanitized baseline snapshots and candidate diagnostics, then write only a local tmp artifact behind an explicit dev-only flag. This gives the lowest response, recommendation, and DB-write risk while preserving static verifier boundaries.",
  requiredStaticGuards: [
    "flag_gate_before_helper_execution",
    "helper_result_not_merged_into_public_response",
    "helper_result_not_written_to_db",
    "recommendation_objects_passed_as_read_only_snapshots",
    "artifact_schema_validation_before_write"
  ]
};

const snapshotContractPlan = {
  schemaVersion: SHADOW_RUNTIME_DRY_RUN_ARTIFACT_SCHEMA_VERSION,
  requiredSnapshots: [
    {
      id: "baselineResponseShapeSnapshot",
      allowedFields: ["shapeKeyPath", "fieldType", "arrayShape", "orderSensitive"],
      forbiddenFields: ["full_api_response_body"]
    },
    {
      id: "baselineRecommendationSnapshot",
      allowedFields: ["topPickId", "supportingProductIdsInOrder", "budgetAlternativeIdsInOrder"],
      forbiddenFields: ["product_name", "brand", "purchase_url", "review_text"]
    },
    {
      id: "shadowBoundaryHintSnapshot",
      allowedFields: ["productId", "category", "boundaryDecision", "candidatePolicyHint", "reasonKeys"],
      forbiddenFields: ["raw_form", "image", "base64", "pii"]
    },
    {
      id: "shadowReceiverSnapshot",
      allowedFields: ["productId", "category", "receiverDecision", "futureExposureGroup", "reasonKeys"],
      forbiddenFields: ["product_name", "brand", "purchase_url", "review_text"]
    },
    {
      id: "comparisonSnapshot",
      allowedFields: [
        "responseShapeChanged",
        "recommendationChanged",
        "hiddenToCollapsedDelta",
        "collapsedToHiddenRegressionCount",
        "highRiskCollapsedReceiverCount",
        "metadataIncompleteCollapsedReceiverCount",
        "strongCautionCollapsedReceiverCount",
        "dbWriteCount"
      ],
      forbiddenFields: ["full_api_response_body", "env_value", "secret_value"]
    }
  ],
  forbiddenSnapshotFields: FORBIDDEN_OBSERVATION_FIELDS,
  evidenceSeparation: {
    actualCaptureEvidence: "not_written_by_dry_run_plan",
    pureReplayEvidence: "not_written_by_dry_run_plan",
    syntheticEvidence: "not_treated_as_actual"
  }
};

const artifactWritePlan = {
  allowedPathCandidates: [
    "tmp/shadow-runtime-dry-run/<run-id>.json",
    "tmp/shadow-runtime-dry-run/latest.json"
  ],
  schemaHelper: "lib/shadow-runtime-dry-run-artifact-schema.js",
  schemaRequired: true,
  localTmpOnly: true,
  dbPersistenceAllowed: false,
  productionArtifactWrite: "disabled_or_requires_explicit_internal_guard",
  requiredArtifactFlags: [
    "evidenceType",
    "dryRunOnly",
    "runtimeConnected",
    "routeInvoked",
    "supabaseWriteExecuted",
    "runtimeMutation"
  ],
  allowedEvidenceType: "shadow_runtime_dry_run",
  writerFailureBehavior: "must_not_change_response_or_recommendation"
};

const verifierChainPlan = {
  requiredVerifiers: [
    "verify-shadow-no-response-change-skeleton",
    "verify-shadow-no-recommendation-change-skeleton",
    "verify-shadow-no-db-write-skeleton",
    "verify-shadow-safety-verifier-skeletons",
    "verify-evaluator-boundary-required-contract-tests",
    "verify-shadow-runtime-dry-run-artifact-schema",
    "verify_high_risk_collapsed_receiver_count_zero",
    "verify_metadata_incomplete_not_collapsed",
    "verify_strong_caution_not_collapsed",
    "verify_no_forbidden_artifact_fields"
  ],
  requiredContractTests: requiredContractTests.testResults?.map((result) => result.id) || [],
  inheritedSkeletons: {
    noResponseChange: safetySkeletons.skeletons?.noResponseChange?.passed === true,
    noRecommendationChange: safetySkeletons.skeletons?.noRecommendationChange?.passed === true,
    noDbWrite: safetySkeletons.skeletons?.noDbWrite?.passed === true
  },
  blocksRuntimeConnectionOnFailure: true
};

const killSwitchPlan = {
  immediateDisableMechanism: "set_dry_run_flag_off",
  artifactWriteFailureBehavior: "non_blocking_for_recommendation_and_response",
  verifierFailureBehavior: "block_runtime_connection",
  killConditions: [
    {
      id: "high_risk_violation_detected",
      status: "blocked_by_safety_regression"
    },
    {
      id: "response_shape_diff_detected",
      status: "blocked_by_response_change"
    },
    {
      id: "recommendation_result_diff_detected",
      status: "blocked_by_recommendation_change"
    },
    {
      id: "db_write_detected",
      status: "blocked_by_db_write"
    },
    {
      id: "metadata_incomplete_collapsed_detected",
      status: "blocked_by_contract_violation"
    },
    {
      id: "strong_caution_collapsed_detected",
      status: "blocked_by_contract_violation"
    },
    {
      id: "forbidden_artifact_field_detected",
      status: "blocked_by_artifact_safety_violation"
    }
  ],
  rollbackScope: [
    "disable_flag",
    "stop_artifact_writer",
    "discard_shadow_artifacts_from_decision_process",
    "keep_existing_recommendation_response_path"
  ]
};

const output = {
  generatedAt: new Date().toISOString(),
  evidenceType: "shadow_dry_run_implementation_plan",
  runtimeConnected: false,
  routeInvoked: false,
  supabaseWriteExecuted: false,
  runtimeMutation: false,
  evidenceSources: {
    phase30DryRunPlan: "tmp/shadow-runtime-dry-run-plan.json",
    phase31RequiredContractTests: "tmp/evaluator-boundary-required-contract-tests.json",
    phase32SafetySkeletons: "tmp/shadow-safety-verifier-skeletons.json"
  },
  readinessInputs: {
    phase30EvidenceType: dryRunPlan.evidenceType,
    phase32EvidenceType: safetySkeletons.evidenceType,
    phase32RuntimeConnected: safetySkeletons.runtimeConnected,
    phase32SupabaseWriteExecuted: safetySkeletons.supabaseWriteExecuted,
    requiredContractTestsFailedCount: requiredContractTests.failedCount
  },
  featureFlagPlan,
  routeInsertionPointCandidates,
  recommendedInsertionPoint,
  snapshotContractPlan,
  artifactWritePlan,
  verifierChainPlan,
  killSwitchPlan,
  forbiddenFields: FORBIDDEN_OBSERVATION_FIELDS,
  phase34AllowedScope: [
    "dry_run_snapshot_contract_helper_design",
    "future_flag_contract_documentation",
    "snapshot_schema_backed_no_response_no_recommendation_no_db_verifier_refinement",
    "route_insertion_point_static_guard_review"
  ],
  phase34ProhibitedScope: [
    "change_api_analyze_route",
    "connect_evaluator_runtime",
    "connect_candidate_policy_runtime",
    "change_api_response",
    "change_recommendation_results",
    "change_db_or_supabase"
  ],
  runtimeFileCheck: runtimeCheck,
  limitations: [
    "implementation_plan_only_no_runtime_connection",
    "does_not_add_flag_to_api_analyze",
    "does_not_call_api_analyze",
    "does_not_execute_supabase_write",
    "does_not_create_actual_response_recommendation_or_db_evidence",
    "future_phase_must_define_snapshot_contract_helper_before_any_route_change"
  ]
};

await mkdir(OUTPUT_DIR, { recursive: true });
await writeFile(JSON_OUTPUT, `${JSON.stringify(output, null, 2)}\n`);
await writeFile(MD_OUTPUT, `${renderMarkdown(output)}\n`);

console.log("shadow-dry-run-implementation-plan summary");
console.log(JSON.stringify({
  evidenceType: output.evidenceType,
  recommendedInsertionPoint: output.recommendedInsertionPoint.id,
  routeInsertionPointCandidates: output.routeInsertionPointCandidates.length,
  requiredSnapshots: output.snapshotContractPlan.requiredSnapshots.map((snapshot) => snapshot.id),
  verifierCount: output.verifierChainPlan.requiredVerifiers.length,
  runtimeConnected: output.runtimeConnected,
  routeInvoked: output.routeInvoked,
  supabaseWriteExecuted: output.supabaseWriteExecuted,
  runtimeMutation: output.runtimeMutation
}, null, 2));
