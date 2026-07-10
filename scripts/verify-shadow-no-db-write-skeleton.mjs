import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  SHADOW_RUNTIME_DRY_RUN_ARTIFACT_SCHEMA_VERSION,
  validateShadowRuntimeDryRunArtifact
} from "../lib/shadow-runtime-dry-run-artifact-schema.js";

const ROOT = process.cwd();
const OUTPUT_PATH = path.join(ROOT, "tmp", "shadow-no-db-write-skeleton.json");

const MUTATION_COUNT_FIELDS = [
  "insertCount",
  "updateCount",
  "deleteCount",
  "upsertCount",
  "rpcMutationCount",
  "storageWriteCount",
  "analyticsWriteCount"
];

function summarizeWrites(summary = {}) {
  const counts = Object.fromEntries(MUTATION_COUNT_FIELDS.map((field) => [field, Number(summary[field] || 0)]));
  const dbWriteCount = Object.values(counts).reduce((total, value) => total + value, 0);
  return {
    ...counts,
    dbWriteCount,
    supabaseWriteExecuted: dbWriteCount > 0,
    passed: dbWriteCount === 0 && summary.shadowRuntimeMutationCount === 0
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
      evidenceType: "future_baseline_write_guard_snapshot_contract",
      guardSessionMutationTrackedSeparately: true
    },
    shadow: {
      evidenceType: "future_shadow_write_guard_snapshot_contract",
      dryRunOnly: true,
      writeSummary: {
        insertCount: 0,
        updateCount: 0,
        deleteCount: 0,
        upsertCount: 0,
        rpcMutationCount: 0,
        storageWriteCount: 0,
        analyticsWriteCount: 0,
        shadowRuntimeMutationCount: 0
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
      syntheticCoverageBucket: "synthetic_no_db_write_schema_sample",
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

const validSummary = summarizeWrites(schemaSample().shadow.writeSummary);
const insertSummary = summarizeWrites({ ...schemaSample().shadow.writeSummary, insertCount: 1 });
const rpcSummary = summarizeWrites({ ...schemaSample().shadow.writeSummary, rpcMutationCount: 1 });
const storageSummary = summarizeWrites({ ...schemaSample().shadow.writeSummary, storageWriteCount: 1 });
const validSampleResult = validateShadowRuntimeDryRunArtifact(schemaSample());
const dbWriteSchemaResult = validateShadowRuntimeDryRunArtifact({
  ...schemaSample(),
  supabaseWriteExecuted: true,
  comparison: {
    ...schemaSample().comparison,
    dbWriteCount: 1
  }
});

assert.equal(validSampleResult.valid, true);
assert.equal(validSummary.passed, true);
assert.equal(insertSummary.passed, false);
assert.equal(rpcSummary.passed, false);
assert.equal(storageSummary.passed, false);
assert.equal(dbWriteSchemaResult.valid, false);

const output = {
  generatedAt: new Date().toISOString(),
  evidenceType: "shadow_no_db_write_skeleton",
  runtimeConnected: false,
  dryRunOnly: true,
  routeInvoked: false,
  supabaseWriteExecuted: false,
  runtimeMutation: false,
  supabaseInvoked: false,
  syntheticSkeletonSampleUsed: true,
  syntheticTreatedAsActualEvidence: false,
  actualDbEvidenceUsed: false,
  phase31SchemaCompatible: validSampleResult.valid,
  contract: {
    supabaseWriteExecutedMustRemainFalse: true,
    dbWriteCountMustRemainZero: true,
    mutationCountsMustRemainZero: MUTATION_COUNT_FIELDS,
    guardSessionMutationTrackedSeparately: true,
    actualSupabaseCallForbiddenInSkeleton: true
  },
  sampleValidation: {
    validWriteSummaryPassed: validSummary.passed,
    dbWriteSampleFailed: insertSummary.passed === false,
    rpcMutationSampleFailed: rpcSummary.passed === false,
    storageWriteSampleFailed: storageSummary.passed === false,
    phase31SchemaRejectsSupabaseWrite: dbWriteSchemaResult.valid === false,
    dbWriteSchemaErrorCodes: dbWriteSchemaResult.errors.map((error) => error.code).sort()
  },
  requiredFutureChecks: [
    "capture_future_shadow_write_summary_without_executing_write",
    "fail_if_insert_update_delete_upsert_count_is_nonzero",
    "fail_if_rpc_mutation_count_is_nonzero",
    "fail_if_storage_write_count_is_nonzero",
    "fail_if_analytics_or_log_write_count_is_nonzero",
    "separate_existing_guard_or_session_mutation_from_shadow_dry_run_mutation"
  ],
  limitations: [
    "skeleton_only_no_supabase_call",
    "synthetic_write_summary_not_actual_db_evidence",
    "future_runtime_dry_run_must_supply_observed_write_summary"
  ]
};

await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`);

console.log("verify-shadow-no-db-write-skeleton passed");
