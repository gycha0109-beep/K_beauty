import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  buildBaselineRecommendationSnapshot,
  buildBaselineResponseShapeSnapshot,
  buildShadowBoundaryHintSnapshot,
  buildShadowComparisonSnapshot,
  buildShadowReceiverSnapshot,
  validateShadowDryRunSnapshot
} from "../lib/shadow-dry-run-snapshot-contract.js";
import { validateShadowRuntimeDryRunArtifact } from "../lib/shadow-runtime-dry-run-artifact-schema.js";
import {
  SHADOW_BOUNDARY_DRY_RUN_HELPER_VERSION,
  buildShadowBoundaryDryRunArtifact,
  isShadowBoundaryDryRunEnabled,
  summarizeShadowBoundaryDryRunComparison,
  validateShadowBoundaryDryRunInput
} from "../lib/shadow-boundary-dry-run-helper.js";

const ROOT = process.cwd();
const FORBIDDEN_RUNTIME_FILES = [
  "app/api/analyze/route.js",
  "lib/skin-match-decision-engine.js",
  "lib/functional-ranking-contract.js",
  "lib/functional-candidate-policy.js",
  "app/page.js",
  "app/result/page.js",
  "app/result/full-report/page.js"
];

function sampleInput(overrides = {}) {
  const baselineResponseShapeSnapshot = buildBaselineResponseShapeSnapshot({
    summary: "shape-only",
    topPick: { id: "top-1" },
    morning: [{ id: "m-1" }],
    night: [{ id: "n-1" }]
  });
  const baselineRecommendationSnapshot = buildBaselineRecommendationSnapshot({
    topPick: { id: "top-1", name: "not-output" },
    supportingProducts: [{ id: "support-1" }, { id: "support-2" }],
    budgetAlternatives: [{ id: "budget-1" }]
  });
  const shadowBoundaryHintSnapshot = buildShadowBoundaryHintSnapshot([
    {
      productId: "p-1",
      category: "serum",
      sourceHardFilterReason: "recent_instability_active_limited",
      boundaryDecision: "downgrade_to_collapsed_candidate",
      futureEvaluatorAction: "pass_with_collapsed_hint",
      candidatePolicyHint: "collapsed_candidate_hint",
      safetyMetadataClass: "safe_low_risk",
      reasonKeys: ["low_irritation_risk"]
    }
  ]);
  const shadowReceiverSnapshot = buildShadowReceiverSnapshot([
    {
      productId: "p-1",
      category: "serum",
      receivedHint: "collapsed_candidate_hint",
      receiverDecision: "accept_collapsed_candidate_hint",
      futureExposureGroup: "collapsed_candidate",
      visibilityPriority: "collapsed",
      userMessageType: "stabilize_first_context",
      safetyMetadataClass: "safe_low_risk",
      reasonKeys: ["low_irritation_risk"]
    }
  ]);
  const comparisonSnapshot = buildShadowComparisonSnapshot({
    baselineResponseShapeSnapshot,
    baselineRecommendationSnapshot,
    shadowBoundaryHintSnapshot,
    shadowReceiverSnapshot
  });

  return {
    baselineResponseShapeSnapshot,
    baselineRecommendationSnapshot,
    shadowBoundaryHintSnapshot,
    shadowReceiverSnapshot,
    comparisonSnapshot,
    dryRunContext: {
      evidenceType: "shadow_boundary_dry_run_helper_skeleton",
      dryRunOnly: true,
      runtimeConnected: false,
      routeInvoked: false,
      supabaseWriteExecuted: false,
      runtimeMutation: false
    },
    ...overrides
  };
}

function assertInvalid(input, code) {
  const result = validateShadowBoundaryDryRunInput(input);
  assert.equal(result.valid, false, `${code} sample should be invalid`);
  assert(
    result.errors.some((error) => error.code === code),
    `expected ${code}, got ${result.errors.map((error) => error.code).join(", ")}`
  );
}

function assertNoRuntimeConnections() {
  const route = readFileSync(path.join(ROOT, "app/api/analyze/route.js"), "utf8");
  const evaluator = readFileSync(path.join(ROOT, "lib/functional-ranking-contract.js"), "utf8");
  const candidatePolicy = readFileSync(path.join(ROOT, "lib/functional-candidate-policy.js"), "utf8");
  const joinedRuntime = [route, evaluator, candidatePolicy].join("\n");

  assert.equal(joinedRuntime.includes("shadow-boundary-dry-run-helper"), false);
  assert.equal(joinedRuntime.includes("isShadowBoundaryDryRunEnabled"), false);

  const status = execFileSync("git", ["status", "--short", "--untracked-files=all"], {
    cwd: ROOT,
    encoding: "utf8"
  });
  const changedFiles = status
    .split(/\r?\n/)
    .map((line) => line.slice(3).trim())
    .filter(Boolean);

  for (const file of FORBIDDEN_RUNTIME_FILES) {
    assert(!changedFiles.includes(file), `${file} should not be modified`);
  }
  assert(changedFiles.every((file) => !file.startsWith("data/")), "product data files should not be modified");
  assert(changedFiles.every((file) => !file.startsWith("supabase/")), "Supabase files should not be modified");
}

assert.equal(typeof SHADOW_BOUNDARY_DRY_RUN_HELPER_VERSION, "string");
assert.equal(isShadowBoundaryDryRunEnabled(), false);
assert.equal(isShadowBoundaryDryRunEnabled({}), false);
assert.equal(isShadowBoundaryDryRunEnabled({ SHADOW_RUNTIME_BOUNDARY_DRY_RUN: "false" }), false);
assert.equal(isShadowBoundaryDryRunEnabled({ SHADOW_RUNTIME_BOUNDARY_DRY_RUN: "true", NODE_ENV: "development" }), true);
assert.equal(isShadowBoundaryDryRunEnabled({ SHADOW_RUNTIME_BOUNDARY_DRY_RUN: "true", NODE_ENV: "production" }), false);

const validInput = sampleInput();
const validation = validateShadowBoundaryDryRunInput(validInput);
assert.equal(validation.valid, true, JSON.stringify(validation.errors));

const artifact = buildShadowBoundaryDryRunArtifact(validInput);
assert.equal(artifact.evidenceType, "shadow_boundary_dry_run_helper_skeleton");
assert.equal(artifact.dryRunOnly, true);
assert.equal(artifact.runtimeConnected, false);
assert.equal(artifact.routeInvoked, false);
assert.equal(artifact.supabaseWriteExecuted, false);
assert.equal(artifact.runtimeMutation, false);
assert.notEqual(artifact.baseline, artifact.shadow);
assert.equal(artifact.killConditionSummary.blocked, false);
assert.equal(artifact.artifactWritten, false);
assert.equal(artifact.artifactSanitization.envValuesPrinted, false);
assert.equal(artifact.artifactSchemaCompatibleWhenEvidenceTypeAdapted, true);

const schemaProbe = validateShadowRuntimeDryRunArtifact({
  ...artifact,
  evidenceType: "shadow_runtime_dry_run_schema_test"
});
assert.equal(schemaProbe.valid, true, JSON.stringify(schemaProbe.errors));
assert.equal(validateShadowDryRunSnapshot(validInput.comparisonSnapshot).valid, true);

assertInvalid(
  {
    ...validInput,
    baselineResponseShapeSnapshot: {
      ...validInput.baselineResponseShapeSnapshot,
      fullApiResponseBody: { bodyDumpPresent: true }
    }
  },
  "forbidden_field_present"
);
assertInvalid(
  {
    ...validInput,
    baselineRecommendationSnapshot: {
      ...validInput.baselineRecommendationSnapshot,
      brand: "forbidden"
    }
  },
  "forbidden_field_present"
);
assertInvalid(
  {
    ...validInput,
    shadowReceiverSnapshot: {
      ...validInput.shadowReceiverSnapshot,
      receivers: [
        {
          ...validInput.shadowReceiverSnapshot.receivers[0],
          purchaseUrl: "https://example.invalid/p"
        }
      ]
    }
  },
  "forbidden_field_present"
);
assertInvalid(
  {
    ...validInput,
    dryRunContext: {
      ...validInput.dryRunContext,
      runtimeConnected: true
    }
  },
  "runtime_connected_not_false"
);
assertInvalid(
  {
    ...validInput,
    dryRunContext: {
      ...validInput.dryRunContext,
      supabaseWriteExecuted: true
    }
  },
  "supabase_write_executed_not_false"
);

const changedRecommendationComparison = {
  ...validInput.comparisonSnapshot,
  recommendationChanged: true,
  topPickChanged: true,
  killConditionTriggered: true,
  killConditionReasons: ["recommendation_changed"]
};
const changedRecommendationArtifact = buildShadowBoundaryDryRunArtifact({
  ...validInput,
  comparisonSnapshot: changedRecommendationComparison
});
assert.equal(changedRecommendationArtifact.killConditionSummary.blocked, true);
assert(changedRecommendationArtifact.killConditionSummary.blockedReasons.includes("recommendation_changed"));

const highRiskArtifact = buildShadowBoundaryDryRunArtifact({
  ...validInput,
  comparisonSnapshot: {
    ...validInput.comparisonSnapshot,
    highRiskCollapsedReceiverCount: 1,
    killConditionTriggered: true,
    killConditionReasons: ["high_risk_collapsed_receiver_count_not_zero"]
  }
});
assert.equal(highRiskArtifact.killConditionSummary.blocked, true);
assert(highRiskArtifact.killConditionSummary.blockedReasons.includes("high_risk_collapsed_receiver_count_not_zero"));

const metadataArtifact = buildShadowBoundaryDryRunArtifact({
  ...validInput,
  comparisonSnapshot: {
    ...validInput.comparisonSnapshot,
    metadataIncompleteCollapsedReceiverCount: 1,
    killConditionTriggered: true,
    killConditionReasons: ["metadata_incomplete_collapsed_receiver_count_not_zero"]
  }
});
assert.equal(metadataArtifact.killConditionSummary.blocked, true);

const dbWriteArtifact = buildShadowBoundaryDryRunArtifact({
  ...validInput,
  comparisonSnapshot: {
    ...validInput.comparisonSnapshot,
    dbWriteCount: 1,
    killConditionTriggered: true,
    killConditionReasons: ["db_write_count_not_zero"]
  }
});
assert.equal(dbWriteArtifact.killConditionSummary.blocked, true);

const first = buildShadowBoundaryDryRunArtifact(sampleInput());
const second = buildShadowBoundaryDryRunArtifact(sampleInput());
assert.deepEqual(first, second, "helper output should be deterministic");
assert.deepEqual(
  summarizeShadowBoundaryDryRunComparison(sampleInput()),
  summarizeShadowBoundaryDryRunComparison(sampleInput()),
  "comparison summary should be deterministic"
);

assertNoRuntimeConnections();

console.log("verify-shadow-boundary-dry-run-helper passed");
