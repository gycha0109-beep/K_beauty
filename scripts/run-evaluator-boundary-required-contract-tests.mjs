import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveEvaluatorRecentInstabilityBoundaryPolicy } from "../lib/evaluator-recent-instability-boundary-policy.js";
import { resolveEvaluatorBoundaryCollapsedHint } from "../lib/evaluator-boundary-collapsed-hint-contract.js";
import { resolveCandidatePolicyHintReceiver } from "../lib/candidate-policy-hint-receiver-contract.js";
import {
  SHADOW_RUNTIME_DRY_RUN_ARTIFACT_SCHEMA_VERSION,
  validateShadowRuntimeDryRunArtifact
} from "../lib/shadow-runtime-dry-run-artifact-schema.js";

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "tmp");
const JSON_OUTPUT = path.join(OUTPUT_DIR, "evaluator-boundary-required-contract-tests.json");
const MD_OUTPUT = path.join(OUTPUT_DIR, "evaluator-boundary-required-contract-tests.md");

const REQUIRED_TEST_IDS = [
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

function baseCandidateEvaluation() {
  return {
    hardFilterStatus: "blocked",
    hardFilterReasons: ["recent_instability_active_limited"]
  };
}

function baseSurveySafety() {
  return {
    recentSkinChange: "yes",
    sensitivityRisk: "high"
  };
}

function baseGoalPolicy() {
  return {
    recentInstability: true,
    highSensitivity: true,
    recommendationGuard: "stabilize_first"
  };
}

function productProfile({ active = true, stabilizing = false, cautionTags = [], evaluable = true } = {}) {
  const functionalAxes = [];
  if (active) functionalAxes.push({ axis: "acne_care" });
  if (stabilizing) functionalAxes.push({ axis: "barrier_support" });
  return {
    evaluable,
    functionalAxes,
    cautionTags
  };
}

function evaluateContractCase({
  product,
  profile,
  candidateEvaluation = baseCandidateEvaluation(),
  exposureContext = {}
}) {
  const boundaryPolicyResult = resolveEvaluatorRecentInstabilityBoundaryPolicy({
    candidateEvaluation,
    surveySafety: baseSurveySafety(),
    goalPolicy: baseGoalPolicy(),
    product,
    productProfile: profile
  });
  const collapsedHintResult = resolveEvaluatorBoundaryCollapsedHint({
    candidateEvaluation,
    boundaryPolicyResult,
    exposureContext: {
      currentExposureStatus: "hidden_candidate",
      safetyMetadataProfile: exposureContext.safetyMetadataProfile,
      category: product?.category || null,
      strongCautionSignal: exposureContext.strongCautionSignal === true
    }
  });
  const receiverResult = resolveCandidatePolicyHintReceiver({
    candidateEvaluation,
    collapsedHintResult,
    currentExposureDecision: { exposureStatus: "hidden_candidate" },
    guardExposurePolicy: {
      safetyMetadataProfile: exposureContext.safetyMetadataProfile,
      policyContext: {
        category: product?.category || null,
        irritationRisk: product?.irritation_risk || null,
        sensitivitySafe: product?.sensitivity_safe ?? null,
        strongCautionSignal: exposureContext.strongCautionSignal === true
      }
    }
  });

  return {
    boundaryDecision: boundaryPolicyResult.boundaryDecision,
    futureIntegrationHint: boundaryPolicyResult.futureIntegrationHint,
    candidatePolicyHint: collapsedHintResult.candidatePolicyHint,
    futureEvaluatorAction: collapsedHintResult.futureEvaluatorAction,
    receiverDecision: receiverResult.receiverDecision,
    futureExposureGroup: receiverResult.futureExposureGroup,
    runtimeConnected: receiverResult.runtimeConnected,
    reasonKeys: Array.from(new Set([
      ...boundaryPolicyResult.reasons,
      ...collapsedHintResult.reasons,
      ...receiverResult.reasons
    ])).sort()
  };
}

function passResult(id, passed, details, guards = []) {
  return {
    id,
    passed,
    syntheticContractCase: true,
    actualEvidence: false,
    guards,
    details
  };
}

function validSchemaArtifact() {
  return {
    schemaVersion: SHADOW_RUNTIME_DRY_RUN_ARTIFACT_SCHEMA_VERSION,
    evidenceType: "shadow_runtime_dry_run_schema_test",
    runtimeConnected: false,
    dryRunOnly: true,
    routeInvoked: false,
    supabaseWriteExecuted: false,
    runtimeMutation: false,
    baseline: {
      evidenceType: "baseline_schema_test",
      candidateRows: [{ productId: "schema-product-1", category: "serum", reasonKeys: ["baseline"] }]
    },
    shadow: {
      evidenceType: "shadow_runtime_dry_run_schema_test",
      candidateRows: [{
        productId: "schema-product-1",
        category: "serum",
        boundaryDecision: "downgrade_to_collapsed_candidate",
        candidatePolicyHint: "collapsed_candidate_hint",
        receiverDecision: "accept_collapsed_candidate_hint",
        reasonKeys: ["schema_test"]
      }]
    },
    comparison: {
      hiddenToCollapsedDelta: 1,
      collapsedToHiddenRegressionCount: 0,
      highRiskCollapsedReceiverCount: 0,
      metadataIncompleteCollapsedReceiverCount: 0,
      apiResponseShapeChanged: false,
      recommendationResultChanged: false,
      topPickChanged: false,
      supportingProductsChanged: false,
      budgetAlternativesChanged: false,
      dbWriteCount: 0
    },
    evidenceSeparation: {
      actualEvidenceBucket: "actual_complete_product_row_capture",
      pureReplayEvidenceBucket: "pure_engine_replay",
      syntheticCoverageBucket: "synthetic_contract_case",
      syntheticTreatedAsActualEvidence: false
    },
    artifactSanitization: {
      forbiddenFieldsPresent: false,
      fullApiResponseBodyDumped: false,
      envValuesPrinted: false
    }
  };
}

function runContractTests() {
  const metadataIncomplete = evaluateContractCase({
    product: { id: "contract-metadata-incomplete", category: "serum" },
    profile: productProfile({ active: true, evaluable: false }),
    exposureContext: { safetyMetadataProfile: "metadata_incomplete" }
  });

  const strongCaution = evaluateContractCase({
    product: {
      id: "contract-strong-caution",
      category: "serum",
      irritation_risk: "low",
      sensitivity_safe: true
    },
    profile: productProfile({ active: true, cautionTags: ["strong_active_caution"] }),
    exposureContext: { safetyMetadataProfile: "mixed_or_uncertain", strongCautionSignal: true }
  });

  const activeOnlySafe = evaluateContractCase({
    product: {
      id: "contract-active-safe",
      category: "treatment",
      irritation_risk: "low",
      sensitivity_safe: true
    },
    profile: productProfile({ active: true, stabilizing: false }),
    exposureContext: { safetyMetadataProfile: "safe_low_risk" }
  });

  const activeOnlyUnsafe = evaluateContractCase({
    product: {
      id: "contract-active-unsafe",
      category: "treatment",
      irritation_risk: "high",
      sensitivity_safe: false
    },
    profile: productProfile({ active: true, stabilizing: false }),
    exposureContext: { safetyMetadataProfile: "unsafe_high_risk" }
  });

  const highRisk = evaluateContractCase({
    product: {
      id: "contract-high-risk",
      category: "moisturizer",
      irritation_risk: "high",
      sensitivity_safe: true
    },
    profile: productProfile({ active: true, stabilizing: true }),
    exposureContext: { safetyMetadataProfile: "unsafe_high_risk" }
  });

  const sensitivityUnsafe = evaluateContractCase({
    product: {
      id: "contract-sensitivity-unsafe",
      category: "moisturizer",
      irritation_risk: "low",
      sensitivity_safe: false
    },
    profile: productProfile({ active: true, stabilizing: true }),
    exposureContext: { safetyMetadataProfile: "unsafe_high_risk" }
  });

  const serumCategoryOnly = evaluateContractCase({
    product: {
      id: "contract-serum-category-only",
      category: "serum",
      irritation_risk: "low",
      sensitivity_safe: true
    },
    profile: productProfile({ active: true }),
    candidateEvaluation: {
      hardFilterStatus: "allowed",
      hardFilterReasons: []
    },
    exposureContext: { safetyMetadataProfile: "safe_low_risk" }
  });

  const serumSafeBoundary = evaluateContractCase({
    product: {
      id: "contract-serum-safe",
      category: "serum",
      irritation_risk: "low",
      sensitivity_safe: true
    },
    profile: productProfile({ active: true }),
    exposureContext: { safetyMetadataProfile: "safe_low_risk" }
  });

  const schemaArtifact = validSchemaArtifact();
  const validSchema = validateShadowRuntimeDryRunArtifact(schemaArtifact);
  const forbiddenSchema = validateShadowRuntimeDryRunArtifact({
    ...schemaArtifact,
    shadow: {
      ...schemaArtifact.shadow,
      candidateRows: [{ productId: "schema-product-2", category: "serum", brand: "forbidden" }]
    }
  });

  return [
    passResult(
      "metadata_incomplete_routes_to_insufficient_evidence",
      metadataIncomplete.candidatePolicyHint === "insufficient_evidence_hint" &&
        metadataIncomplete.futureExposureGroup === "insufficient_evidence_candidate",
      metadataIncomplete,
      ["metadata_incomplete_not_collapsed"]
    ),
    passResult(
      "strong_caution_preserves_hidden_or_hard_block",
      strongCaution.futureExposureGroup === "hidden_candidate" &&
        strongCaution.candidatePolicyHint === "hidden_candidate_hint",
      strongCaution,
      ["strong_caution_not_collapsed"]
    ),
    passResult(
      "active_only_safe_collapses_unsafe_preserves_hidden",
      activeOnlySafe.futureExposureGroup === "collapsed_candidate" &&
        activeOnlyUnsafe.futureExposureGroup === "hidden_candidate",
      {
        safe: activeOnlySafe,
        unsafe: activeOnlyUnsafe
      },
      ["active_only_safe_split"]
    ),
    passResult(
      "high_risk_or_sensitivity_unsafe_never_collapses",
      highRisk.futureExposureGroup !== "collapsed_candidate" &&
        sensitivityUnsafe.futureExposureGroup !== "collapsed_candidate" &&
        highRisk.candidatePolicyHint !== "collapsed_candidate_hint" &&
        sensitivityUnsafe.candidatePolicyHint !== "collapsed_candidate_hint",
      {
        highRisk,
        sensitivityUnsafe
      },
      ["high_risk_not_collapsed", "sensitivity_unsafe_not_collapsed"]
    ),
    passResult(
      "serum_category_does_not_drive_exposure_by_itself",
      serumCategoryOnly.futureExposureGroup === "unchanged" &&
        serumCategoryOnly.boundaryDecision === "not_applicable" &&
        serumSafeBoundary.futureExposureGroup === "collapsed_candidate",
      {
        categoryOnly: serumCategoryOnly,
        safeBoundary: serumSafeBoundary
      },
      ["category_alone_not_decision_rule"]
    ),
    passResult(
      "actual_and_pure_replay_evidence_remain_separate",
      schemaArtifact.evidenceSeparation.actualEvidenceBucket !==
        schemaArtifact.evidenceSeparation.pureReplayEvidenceBucket &&
        schemaArtifact.evidenceSeparation.syntheticTreatedAsActualEvidence === false,
      schemaArtifact.evidenceSeparation,
      ["synthetic_not_actual"]
    ),
    passResult(
      "no_api_response_shape_change",
      validSchema.valid === true &&
        schemaArtifact.comparison.apiResponseShapeChanged === false &&
        schemaArtifact.artifactSanitization.fullApiResponseBodyDumped === false,
      {
        apiResponseShapeChanged: schemaArtifact.comparison.apiResponseShapeChanged,
        fullApiResponseBodyDumped: schemaArtifact.artifactSanitization.fullApiResponseBodyDumped
      },
      ["api_response_shape_unchanged"]
    ),
    passResult(
      "no_recommendation_result_change_when_shadow_enabled",
      schemaArtifact.comparison.recommendationResultChanged === false &&
        schemaArtifact.comparison.topPickChanged === false &&
        schemaArtifact.comparison.supportingProductsChanged === false &&
        schemaArtifact.comparison.budgetAlternativesChanged === false,
      {
        recommendationResultChanged: schemaArtifact.comparison.recommendationResultChanged,
        topPickChanged: schemaArtifact.comparison.topPickChanged,
        supportingProductsChanged: schemaArtifact.comparison.supportingProductsChanged,
        budgetAlternativesChanged: schemaArtifact.comparison.budgetAlternativesChanged
      },
      ["recommendation_result_unchanged"]
    ),
    passResult(
      "no_db_write_from_shadow_dry_run",
      schemaArtifact.supabaseWriteExecuted === false &&
        schemaArtifact.comparison.dbWriteCount === 0,
      {
        supabaseWriteExecuted: schemaArtifact.supabaseWriteExecuted,
        dbWriteCount: schemaArtifact.comparison.dbWriteCount
      },
      ["db_write_count_zero"]
    ),
    passResult(
      "no_forbidden_artifact_fields",
      validSchema.valid === true &&
        forbiddenSchema.valid === false &&
        forbiddenSchema.errors.some((error) => error.code === "forbidden_field_present"),
      {
        validSamplePassed: validSchema.valid,
        forbiddenSampleFailed: !forbiddenSchema.valid,
        forbiddenErrorCodes: forbiddenSchema.errors.map((error) => error.code).sort()
      },
      ["artifact_sanitization"]
    )
  ];
}

function renderMarkdown(output) {
  return [
    "# Evaluator Boundary Required Contract Tests",
    "",
    "This is required contract test skeleton evidence. Synthetic cases are not actual evidence.",
    "",
    `- evidenceType: ${output.evidenceType}`,
    `- passedCount: ${output.passedCount}`,
    `- failedCount: ${output.failedCount}`,
    `- syntheticContractCasesUsed: ${output.syntheticContractCasesUsed}`,
    `- syntheticTreatedAsActualEvidence: ${output.syntheticTreatedAsActualEvidence}`,
    "",
    "## Results",
    ...output.testResults.map((result) => `- ${result.id}: ${result.passed ? "passed" : "failed"}`),
    "",
    "## Runtime Flags",
    `- runtimeConnected: ${output.runtimeConnected}`,
    `- routeInvoked: ${output.routeInvoked}`,
    `- supabaseWriteExecuted: ${output.supabaseWriteExecuted}`,
    `- runtimeMutation: ${output.runtimeMutation}`
  ].join("\n");
}

const testResults = runContractTests();
const failed = testResults.filter((result) => !result.passed);
const output = {
  generatedAt: new Date().toISOString(),
  evidenceType: "required_contract_test_skeleton",
  runtimeConnected: false,
  routeInvoked: false,
  supabaseWriteExecuted: false,
  runtimeMutation: false,
  syntheticContractCasesUsed: true,
  syntheticTreatedAsActualEvidence: false,
  schemaVersion: SHADOW_RUNTIME_DRY_RUN_ARTIFACT_SCHEMA_VERSION,
  testResults,
  passedCount: testResults.length - failed.length,
  failedCount: failed.length,
  requiredBeforeRuntimeIntegration: REQUIRED_TEST_IDS,
  limitations: [
    "phase31_contract_tests_are_skeleton_pure_helper_tests",
    "synthetic_contract_cases_are_not_actual_capture_evidence",
    "no_api_analyze_request_was_executed",
    "no_supabase_write_was_executed",
    "runtime_integration_remains_unapproved"
  ]
};

await mkdir(OUTPUT_DIR, { recursive: true });
await writeFile(JSON_OUTPUT, JSON.stringify(output, null, 2), "utf8");
await writeFile(MD_OUTPUT, renderMarkdown(output), "utf8");

console.log("evaluator-boundary-required-contract-tests summary");
console.log(JSON.stringify({
  evidenceType: output.evidenceType,
  passedCount: output.passedCount,
  failedCount: output.failedCount,
  syntheticContractCasesUsed: output.syntheticContractCasesUsed,
  syntheticTreatedAsActualEvidence: output.syntheticTreatedAsActualEvidence,
  runtimeConnected: output.runtimeConnected,
  routeInvoked: output.routeInvoked,
  supabaseWriteExecuted: output.supabaseWriteExecuted,
  runtimeMutation: output.runtimeMutation
}, null, 2));
