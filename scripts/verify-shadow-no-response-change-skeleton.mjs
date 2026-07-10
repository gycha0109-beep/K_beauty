import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  FORBIDDEN_SHADOW_ARTIFACT_FIELDS,
  SHADOW_RUNTIME_DRY_RUN_ARTIFACT_SCHEMA_VERSION,
  validateShadowRuntimeDryRunArtifact
} from "../lib/shadow-runtime-dry-run-artifact-schema.js";

const ROOT = process.cwd();
const OUTPUT_PATH = path.join(ROOT, "tmp", "shadow-no-response-change-skeleton.json");

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
      evidenceType: "future_baseline_response_shape_snapshot_contract",
      responseShapeKeySet: ["topPick", "supportingProducts", "budgetAlternatives"],
      responseBodyDumpPresent: false
    },
    shadow: {
      evidenceType: "future_shadow_response_shape_snapshot_contract",
      dryRunArtifactInjectedIntoResponse: false,
      responseShapeKeySet: ["topPick", "supportingProducts", "budgetAlternatives"],
      responseBodyDumpPresent: false
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
      syntheticCoverageBucket: "synthetic_no_response_change_schema_sample",
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

function invalidWithCode(sample, code) {
  const result = validateShadowRuntimeDryRunArtifact(sample);
  return {
    invalid: result.valid === false,
    matchedCode: result.errors.some((error) => error.code === code),
    errorCodes: result.errors.map((error) => error.code).sort()
  };
}

const validSampleResult = validateShadowRuntimeDryRunArtifact(schemaSample());
const fullResponseBodyDumpResult = invalidWithCode(
  {
    ...schemaSample(),
    fullApiResponseBody: { bodyDumpPresent: true }
  },
  "forbidden_field_present"
);
const responseBodyFieldResult = invalidWithCode(
  {
    ...schemaSample(),
    shadow: {
      ...schemaSample().shadow,
      responseBody: { bodyDumpPresent: true }
    }
  },
  "forbidden_field_present"
);
const forbiddenFieldResult = invalidWithCode(
  {
    ...schemaSample(),
    shadow: {
      ...schemaSample().shadow,
      candidateRows: [{ productId: "schema-product-1", category: "serum", brand: "blocked" }]
    }
  },
  "forbidden_field_present"
);

assert.equal(validSampleResult.valid, true);
assert.equal(fullResponseBodyDumpResult.invalid && fullResponseBodyDumpResult.matchedCode, true);
assert.equal(responseBodyFieldResult.invalid && responseBodyFieldResult.matchedCode, true);
assert.equal(forbiddenFieldResult.invalid && forbiddenFieldResult.matchedCode, true);

const output = {
  generatedAt: new Date().toISOString(),
  evidenceType: "shadow_no_response_change_skeleton",
  runtimeConnected: false,
  dryRunOnly: true,
  routeInvoked: false,
  supabaseWriteExecuted: false,
  runtimeMutation: false,
  apiAnalyzeInvoked: false,
  responseFixtureCreated: false,
  syntheticSkeletonSampleUsed: true,
  syntheticTreatedAsActualEvidence: false,
  actualResponseEvidenceUsed: false,
  phase31SchemaCompatible: validSampleResult.valid,
  contract: {
    artifactMustNotBeIncludedInApiResponse: true,
    fullApiResponseBodyDumpForbidden: true,
    futureBaselineAfterSnapshotRequired: true,
    responseShapeComparisonScope: [
      "top_level_keys",
      "nested_response_shape",
      "field_presence",
      "field_type",
      "array_order_where_response_contract_depends_on_order"
    ],
    forbiddenFieldsFail: true
  },
  sampleValidation: {
    validSamplePassed: validSampleResult.valid,
    fullResponseBodyDumpSampleFailed: fullResponseBodyDumpResult.invalid,
    fullResponseBodyDumpMatchedForbiddenField: fullResponseBodyDumpResult.matchedCode,
    responseBodyFieldSampleFailed: responseBodyFieldResult.invalid,
    responseBodyFieldMatchedForbiddenField: responseBodyFieldResult.matchedCode,
    forbiddenFieldSampleFailed: forbiddenFieldResult.invalid,
    forbiddenFieldMatchedForbiddenField: forbiddenFieldResult.matchedCode
  },
  requiredFutureChecks: [
    "capture_future_baseline_response_shape_snapshot_without_body_dump",
    "capture_future_shadow_enabled_response_shape_snapshot_without_body_dump",
    "compare_baseline_after_shape_without_including_shadow_artifact_in_response",
    "fail_if_shadow_artifact_or_full_response_body_is_present_in_api_response",
    "fail_if_forbidden_artifact_field_is_present"
  ],
  forbiddenObservationFields: FORBIDDEN_SHADOW_ARTIFACT_FIELDS,
  limitations: [
    "skeleton_only_no_api_analyze_request",
    "synthetic_schema_sample_not_actual_response_evidence",
    "future_runtime_dry_run_must_supply_baseline_and_after_shape_snapshots"
  ]
};

await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`);

console.log("verify-shadow-no-response-change-skeleton passed");
