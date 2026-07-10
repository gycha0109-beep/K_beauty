import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { validateShadowDryRunRouteSources } from "./verify-shadow-dry-run-route-static-guard.mjs";

const ROOT = process.cwd();
const ROUTE_PATH = path.join(ROOT, "app", "api", "analyze", "route.js");
const WRITER_PATH = path.join(ROOT, "lib", "shadow-boundary-dry-run-artifact-writer.js");

function replaceRequired(source, search, replacement, id) {
  assert(source.includes(search), `${id} mutation target should exist`);
  return source.replace(search, replacement);
}

function control(id, expectedViolation, mutate) {
  return { id, expectedViolation, mutate };
}

const NEGATIVE_CONTROLS = [
  control("production_guard_removed", "missing_development_guard", ({ routeSource, writerSource }) => ({
    routeSource: replaceRequired(
      routeSource,
      '    process.env.NODE_ENV !== "development" ||\n',
      "",
      "production_guard_removed"
    ),
    writerSource
  })),
  control("flag_default_on_shape", "missing_explicit_flag_guard", ({ routeSource, writerSource }) => ({
    routeSource: replaceRequired(
      routeSource,
      'process.env.DEV_ONLY_SHADOW_BOUNDARY_DRY_RUN !== "1"',
      'process.env.DEV_ONLY_SHADOW_BOUNDARY_DRY_RUN === "0"',
      "flag_default_on_shape"
    ),
    writerSource
  })),
  control("dynamic_import_outside_guard", "dynamic_import_outside_guard", ({ routeSource, writerSource }) => ({
    routeSource: `import("@/lib/shadow-boundary-dry-run-artifact-writer");\n${routeSource}`,
    writerSource
  })),
  control("shadow_result_merged_into_response", "shadow_merged_into_response", ({ routeSource, writerSource }) => ({
    routeSource: replaceRequired(
      routeSource,
      "    await artifactWriter.writeShadowBoundaryDryRunArtifact({",
      "    responsePayload.shadowDryRun = artifact;\n    await artifactWriter.writeShadowBoundaryDryRunArtifact({",
      "shadow_result_merged_into_response"
    ),
    writerSource
  })),
  control("recommendation_result_mutated", "recommendation_output_mutation_detected", ({ routeSource, writerSource }) => ({
    routeSource: replaceRequired(
      routeSource,
      "    await artifactWriter.writeShadowBoundaryDryRunArtifact({",
      "    recommendationResult.topPick = null;\n    await artifactWriter.writeShadowBoundaryDryRunArtifact({",
      "recommendation_result_mutated"
    ),
    writerSource
  })),
  control("shadow_merged_into_premium_payload", "shadow_merged_into_persistence_payload", ({ routeSource, writerSource }) => ({
    routeSource: replaceRequired(
      routeSource,
      "    await runShadowBoundaryDryRunIfEnabled({",
      "    premiumSessionReport.shadowDryRun = {};\n    await runShadowBoundaryDryRunIfEnabled({",
      "shadow_merged_into_premium_payload"
    ),
    writerSource
  })),
  control("writer_supabase_mutation_added", "writer_db_or_supabase_mutation_detected", ({ routeSource, writerSource }) => ({
    routeSource,
    writerSource: replaceRequired(
      writerSource,
      "  try {\n    await fileSystem.mkdir",
      '  try {\n    await supabase.from("shadow_audit").insert({});\n    await fileSystem.mkdir',
      "writer_supabase_mutation_added"
    )
  })),
  control("writer_output_outside_tmp", "writer_output_not_local_tmp_only", ({ routeSource, writerSource }) => ({
    routeSource,
    writerSource: replaceRequired(
      writerSource,
      'const OUTPUT_SUBDIRECTORY = ["tmp", "shadow-boundary-dry-run"]',
      'const OUTPUT_SUBDIRECTORY = ["artifacts", "shadow-boundary-dry-run"]',
      "writer_output_outside_tmp"
    )
  })),
  control("writer_forbidden_field_recording", "writer_forbidden_field_recording_detected", ({ routeSource, writerSource }) => ({
    routeSource,
    writerSource: replaceRequired(
      writerSource,
      "  const sanitizedValidation = validateShadowRuntimeDryRunArtifact(sanitized);",
      "  sanitized.productName = candidate.productName;\n  const sanitizedValidation = validateShadowRuntimeDryRunArtifact(sanitized);",
      "writer_forbidden_field_recording"
    )
  })),
  control("writer_failure_propagates_to_route", "route_failure_can_propagate", ({ routeSource, writerSource }) => ({
    routeSource: replaceRequired(
      routeSource,
      '    console.warn("[analyze] shadow-boundary-dry-run:non-blocking-failure");',
      '    throw new Error("shadow dry-run writer failure");',
      "writer_failure_propagates_to_route"
    ),
    writerSource
  }))
];

export function runShadowVerifierIntegrityChecks({
  routeSource = readFileSync(ROUTE_PATH, "utf8"),
  writerSource = readFileSync(WRITER_PATH, "utf8")
} = {}) {
  const baseline = validateShadowDryRunRouteSources({ routeSource, writerSource });
  const negativeControlResults = NEGATIVE_CONTROLS.map((spec) => {
    const mutated = spec.mutate({ routeSource, writerSource });
    const result = validateShadowDryRunRouteSources(mutated);
    return {
      id: spec.id,
      expectedViolation: spec.expectedViolation,
      detected: result.valid === false && result.violations.includes(spec.expectedViolation),
      verifierRejected: result.valid === false,
      detectedViolationCodes: [...result.violations].sort()
    };
  });

  return {
    baselineAccepted: baseline.valid,
    baselineViolations: baseline.violations,
    negativeControlResults,
    detectedCount: negativeControlResults.filter((result) => result.detected).length,
    totalCount: negativeControlResults.length,
    passed: baseline.valid && negativeControlResults.every((result) => result.detected),
    sourceFilesMutated: false
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const result = runShadowVerifierIntegrityChecks();
  assert.equal(result.baselineAccepted, true, `baseline should pass: ${result.baselineViolations.join(", ")}`);
  assert.equal(result.totalCount, 10);
  assert.equal(result.detectedCount, result.totalCount, JSON.stringify(result.negativeControlResults, null, 2));
  assert.equal(result.sourceFilesMutated, false);
  console.log("verify-shadow-verifier-integrity passed");
}
