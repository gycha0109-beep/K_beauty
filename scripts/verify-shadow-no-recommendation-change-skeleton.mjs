import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  SHADOW_RUNTIME_DRY_RUN_ARTIFACT_SCHEMA_VERSION,
  validateShadowRuntimeDryRunArtifact
} from "../lib/shadow-runtime-dry-run-artifact-schema.js";

const ROOT = process.cwd();
const OUTPUT_PATH = path.join(ROOT, "tmp", "shadow-no-recommendation-change-skeleton.json");

function sameOrderedArray(left = [], right = []) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function compareRecommendationSummary(baseline, shadow) {
  const topPickChanged = baseline.topPick !== shadow.topPick;
  const supportingProductsChanged = !sameOrderedArray(baseline.supportingProducts, shadow.supportingProducts);
  const budgetAlternativesChanged = !sameOrderedArray(baseline.budgetAlternatives, shadow.budgetAlternatives);
  return {
    topPickChanged,
    supportingProductsChanged,
    budgetAlternativesChanged,
    recommendationResultChanged: topPickChanged || supportingProductsChanged || budgetAlternativesChanged
  };
}

function schemaSample(overrides = {}) {
  return {
    schemaVersion: SHADOW_RUNTIME_DRY_RUN_ARTIFACT_SCHEMA_VERSION,
    evidenceType: "shadow_runtime_dry_run_schema_test",
    runtimeConnected: false,
    dryRunOnly: true,
    routeInvoked: false,
    supabaseWriteExecuted: false,
    runtimeMutation: false,
    baseline: {
      evidenceType: "future_baseline_recommendation_snapshot_contract",
      recommendationSummary: {
        topPick: "slot_top_1",
        supportingProducts: ["slot_support_1", "slot_support_2"],
        budgetAlternatives: ["slot_budget_1", "slot_budget_2"]
      }
    },
    shadow: {
      evidenceType: "future_shadow_recommendation_snapshot_contract",
      dryRunOnly: true,
      recommendationSummary: {
        topPick: "slot_top_1",
        supportingProducts: ["slot_support_1", "slot_support_2"],
        budgetAlternatives: ["slot_budget_1", "slot_budget_2"]
      },
      shadowOnlyHintSummary: {
        candidatePolicyHintsObserved: 3,
        recommendationMutationAllowed: false
      }
    },
    comparison: {
      apiResponseShapeChanged: false,
      recommendationResultChanged: false,
      topPickChanged: false,
      supportingProductsChanged: false,
      budgetAlternativesChanged: false,
      dbWriteCount: 0,
      highRiskCollapsedReceiverCount: 0,
      metadataIncompleteCollapsedReceiverCount: 0
    },
    evidenceSeparation: {
      actualEvidenceBucket: "not_used_in_skeleton",
      pureReplayEvidenceBucket: "not_used_in_skeleton_pure_replay",
      syntheticCoverageBucket: "synthetic_no_recommendation_change_schema_sample",
      syntheticTreatedAsActualEvidence: false
    },
    artifactSanitization: {
      forbiddenFieldsPresent: false,
      fullApiResponseBodyDumped: false,
      envValuesPrinted: false
    },
    ...overrides
  };
}

const unchangedBaseline = schemaSample().baseline.recommendationSummary;
const unchangedShadow = schemaSample().shadow.recommendationSummary;
const changedTopPick = { ...unchangedShadow, topPick: "slot_top_2" };
const changedOrder = {
  ...unchangedShadow,
  supportingProducts: [...unchangedShadow.supportingProducts].reverse()
};

const unchangedComparison = compareRecommendationSummary(unchangedBaseline, unchangedShadow);
const changedTopPickComparison = compareRecommendationSummary(unchangedBaseline, changedTopPick);
const changedOrderComparison = compareRecommendationSummary(unchangedBaseline, changedOrder);
const validSampleResult = validateShadowRuntimeDryRunArtifact(schemaSample());

assert.equal(validSampleResult.valid, true);
assert.equal(unchangedComparison.recommendationResultChanged, false);
assert.equal(changedTopPickComparison.topPickChanged, true);
assert.equal(changedTopPickComparison.recommendationResultChanged, true);
assert.equal(changedOrderComparison.supportingProductsChanged, true);
assert.equal(changedOrderComparison.recommendationResultChanged, true);

const output = {
  generatedAt: new Date().toISOString(),
  evidenceType: "shadow_no_recommendation_change_skeleton",
  runtimeConnected: false,
  dryRunOnly: true,
  routeInvoked: false,
  supabaseWriteExecuted: false,
  runtimeMutation: false,
  apiAnalyzeInvoked: false,
  recommendationEngineInvoked: false,
  syntheticSkeletonSampleUsed: true,
  syntheticTreatedAsActualEvidence: false,
  actualRecommendationEvidenceUsed: false,
  phase31SchemaCompatible: validSampleResult.valid,
  contract: {
    futureBaselineAfterSnapshotRequired: true,
    topPickMustRemainUnchanged: true,
    supportingProductsMustRemainUnchanged: true,
    budgetAlternativesMustRemainUnchanged: true,
    orderSensitiveComparison: true,
    shadowHintReceiverResultsCannotMutateRecommendation: true
  },
  sampleComparison: {
    unchangedSamplePassed: unchangedComparison.recommendationResultChanged === false,
    changedTopPickSampleFailed: changedTopPickComparison.recommendationResultChanged === true,
    changedTopPickChanged: changedTopPickComparison.topPickChanged,
    changedOrderSampleFailed: changedOrderComparison.recommendationResultChanged === true,
    orderChangeDetectedAsSupportingProductsChanged: changedOrderComparison.supportingProductsChanged
  },
  requiredFutureChecks: [
    "capture_future_baseline_recommendation_summary_snapshot",
    "capture_future_shadow_enabled_recommendation_summary_snapshot",
    "compare_top_pick_identity_without_shadow_mutation",
    "compare_supporting_products_identity_and_order_without_shadow_mutation",
    "compare_budget_alternatives_identity_and_order_without_shadow_mutation",
    "fail_if_shadow_only_hint_or_receiver_result_changes_recommendations"
  ],
  limitations: [
    "skeleton_only_no_api_analyze_request",
    "synthetic_recommendation_summary_not_actual_recommendation_evidence",
    "future_runtime_dry_run_must_supply_baseline_and_after_recommendation_snapshots"
  ]
};

await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`);

console.log("verify-shadow-no-recommendation-change-skeleton passed");
