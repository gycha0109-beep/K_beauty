import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import * as helper from "../lib/shadow-boundary-dry-run-helper.js";
import {
  buildBaselineRecommendationSnapshot,
  buildBaselineResponseShapeSnapshot,
  buildShadowBoundaryHintSnapshot,
  buildShadowComparisonSnapshot,
  buildShadowReceiverSnapshot,
  validateShadowDryRunSnapshot
} from "../lib/shadow-dry-run-snapshot-contract.js";
import { validateShadowRuntimeDryRunArtifact } from "../lib/shadow-runtime-dry-run-artifact-schema.js";

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "tmp");
const JSON_OUTPUT = path.join(OUTPUT_DIR, "shadow-boundary-dry-run-helper-skeleton.json");
const MD_OUTPUT = path.join(OUTPUT_DIR, "shadow-boundary-dry-run-helper-skeleton.md");

const FORBIDDEN_RUNTIME_FILES = [
  "app/api/analyze/route.js",
  "lib/skin-match-decision-engine.js",
  "lib/functional-ranking-contract.js",
  "lib/functional-candidate-policy.js",
  "app/page.js",
  "app/result/page.js",
  "app/result/full-report/page.js"
];

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

function sampleInput(overrides = {}) {
  const baselineResponseShapeSnapshot = buildBaselineResponseShapeSnapshot({
    summary: "shape-only",
    topPick: { id: "top-1" },
    morning: [{ id: "m-1" }],
    night: [{ id: "n-1" }]
  });
  const baselineRecommendationSnapshot = buildBaselineRecommendationSnapshot({
    topPick: { id: "top-1" },
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

function renderMarkdown(output) {
  return [
    "# Shadow Boundary Dry-run Helper Skeleton Review",
    "",
    "This is a route-disconnected helper skeleton review.",
    "",
    `- evidenceType: ${output.evidenceType}`,
    `- runtimeConnected: ${output.runtimeConnected}`,
    `- routeInvoked: ${output.routeInvoked}`,
    `- supabaseWriteExecuted: ${output.supabaseWriteExecuted}`,
    `- runtimeMutation: ${output.runtimeMutation}`,
    `- routeIntegrationStatus: ${output.routeIntegrationStatus}`,
    "",
    "## Helper Exports",
    ...output.helperExports.map((item) => `- ${item}`),
    "",
    "## Compatibility",
    `- snapshot contract: ${output.snapshotContractCompatibility.passed}`,
    `- artifact schema adapted: ${output.artifactSchemaCompatibility.adaptedEvidenceTypePassed}`,
    "",
    "## Kill Conditions",
    ...Object.entries(output.killConditionCoverage).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Next Step",
    ...output.allowedNextStep.map((item) => `- allowed: ${item}`),
    ...output.prohibitedNextStep.map((item) => `- prohibited: ${item}`)
  ].join("\n");
}

const input = sampleInput();
const artifact = helper.buildShadowBoundaryDryRunArtifact(input);
const adaptedArtifactValidation = validateShadowRuntimeDryRunArtifact({
  ...artifact,
  evidenceType: "shadow_runtime_dry_run_schema_test"
});

const highRiskArtifact = helper.buildShadowBoundaryDryRunArtifact({
  ...input,
  comparisonSnapshot: {
    ...input.comparisonSnapshot,
    highRiskCollapsedReceiverCount: 1,
    killConditionTriggered: true,
    killConditionReasons: ["high_risk_collapsed_receiver_count_not_zero"]
  }
});
const metadataArtifact = helper.buildShadowBoundaryDryRunArtifact({
  ...input,
  comparisonSnapshot: {
    ...input.comparisonSnapshot,
    metadataIncompleteCollapsedReceiverCount: 1,
    killConditionTriggered: true,
    killConditionReasons: ["metadata_incomplete_collapsed_receiver_count_not_zero"]
  }
});
const dbWriteArtifact = helper.buildShadowBoundaryDryRunArtifact({
  ...input,
  comparisonSnapshot: {
    ...input.comparisonSnapshot,
    dbWriteCount: 1,
    killConditionTriggered: true,
    killConditionReasons: ["db_write_count_not_zero"]
  }
});
const forbiddenInput = {
  ...input,
  baselineRecommendationSnapshot: {
    ...input.baselineRecommendationSnapshot,
    brand: "forbidden"
  }
};

const snapshotValidationResults = [
  validateShadowDryRunSnapshot(input.baselineResponseShapeSnapshot),
  validateShadowDryRunSnapshot(input.baselineRecommendationSnapshot),
  validateShadowDryRunSnapshot(input.shadowBoundaryHintSnapshot),
  validateShadowDryRunSnapshot(input.shadowReceiverSnapshot),
  validateShadowDryRunSnapshot(input.comparisonSnapshot)
];
const forbiddenValidation = helper.validateShadowBoundaryDryRunInput(forbiddenInput);

const output = {
  generatedAt: new Date().toISOString(),
  evidenceType: "shadow_boundary_dry_run_helper_skeleton_review",
  runtimeConnected: false,
  routeInvoked: false,
  supabaseWriteExecuted: false,
  runtimeMutation: false,
  helperExports: [
    "SHADOW_BOUNDARY_DRY_RUN_HELPER_VERSION",
    "isShadowBoundaryDryRunEnabled",
    "buildShadowBoundaryDryRunArtifact",
    "validateShadowBoundaryDryRunInput",
    "summarizeShadowBoundaryDryRunComparison"
  ],
  defaultDisabledGate: {
    emptyEnvEnabled: helper.isShadowBoundaryDryRunEnabled({}),
    explicitDevFlagEnabled: helper.isShadowBoundaryDryRunEnabled({
      SHADOW_RUNTIME_BOUNDARY_DRY_RUN: "true",
      NODE_ENV: "development"
    }),
    explicitProductionFlagEnabled: helper.isShadowBoundaryDryRunEnabled({
      SHADOW_RUNTIME_BOUNDARY_DRY_RUN: "true",
      NODE_ENV: "production"
    }),
    envValuesPrinted: false
  },
  snapshotContractCompatibility: {
    passed: snapshotValidationResults.every((result) => result.valid),
    snapshotTypes: snapshotValidationResults.map((result) => result.summary.snapshotType)
  },
  artifactSchemaCompatibility: {
    skeletonEvidenceType: artifact.evidenceType,
    adaptedEvidenceTypePassed: adaptedArtifactValidation.valid,
    adaptedEvidenceTypeErrors: adaptedArtifactValidation.errors
  },
  killConditionCoverage: {
    validInputBlocked: artifact.killConditionSummary.blocked,
    highRiskBlocked: highRiskArtifact.killConditionSummary.blocked,
    metadataIncompleteBlocked: metadataArtifact.killConditionSummary.blocked,
    dbWriteBlocked: dbWriteArtifact.killConditionSummary.blocked
  },
  forbiddenFieldCoverage: {
    forbiddenInputRejected: forbiddenValidation.valid === false,
    rejectedErrorCodes: forbiddenValidation.errors.map((error) => error.code).sort()
  },
  routeIntegrationStatus: "not_connected",
  allowedNextStep: [
    "final_pre_runtime_integration_checklist",
    "artifact_writer_skeleton_design",
    "snapshot_contract_backed_verifier_refinement"
  ],
  prohibitedNextStep: [
    "api_analyze_route_connection",
    "evaluator_runtime_connection",
    "candidate_policy_runtime_connection",
    "api_response_change",
    "recommendation_result_change",
    "db_or_supabase_write"
  ],
  runtimeFileCheck: runtimeFileCheck(),
  limitations: [
    "helper_skeleton_only_not_route_connected",
    "artifact_payload_returned_but_not_written",
    "synthetic_helper_sample_not_actual_evidence",
    "does_not_call_api_analyze",
    "does_not_execute_supabase_write"
  ]
};

await mkdir(OUTPUT_DIR, { recursive: true });
await writeFile(JSON_OUTPUT, `${JSON.stringify(output, null, 2)}\n`);
await writeFile(MD_OUTPUT, `${renderMarkdown(output)}\n`);

console.log("shadow-boundary-dry-run-helper-skeleton summary");
console.log(JSON.stringify({
  evidenceType: output.evidenceType,
  routeIntegrationStatus: output.routeIntegrationStatus,
  defaultEnabled: output.defaultDisabledGate.emptyEnvEnabled,
  snapshotContractCompatible: output.snapshotContractCompatibility.passed,
  artifactSchemaCompatible: output.artifactSchemaCompatibility.adaptedEvidenceTypePassed,
  runtimeConnected: output.runtimeConnected,
  routeInvoked: output.routeInvoked,
  supabaseWriteExecuted: output.supabaseWriteExecuted,
  runtimeMutation: output.runtimeMutation
}, null, 2));
