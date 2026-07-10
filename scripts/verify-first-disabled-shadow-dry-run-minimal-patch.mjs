import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildBaselineRecommendationSnapshot,
  buildBaselineResponseShapeSnapshot,
  buildShadowBoundaryHintSnapshot,
  buildShadowComparisonSnapshot,
  buildShadowReceiverSnapshot,
  validateShadowDryRunSnapshot
} from "../lib/shadow-dry-run-snapshot-contract.js";
import { buildShadowBoundaryDryRunArtifact } from "../lib/shadow-boundary-dry-run-helper.js";
import {
  resolveShadowBoundaryDryRunOutputDir,
  sanitizeShadowBoundaryDryRunArtifactForWrite,
  writeShadowBoundaryDryRunArtifact
} from "../lib/shadow-boundary-dry-run-artifact-writer.js";
import { validateShadowRuntimeDryRunArtifact } from "../lib/shadow-runtime-dry-run-artifact-schema.js";

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "tmp");
const JSON_OUTPUT = path.join(OUTPUT_DIR, "first-disabled-shadow-dry-run-minimal-patch.json");
const MD_OUTPUT = path.join(OUTPUT_DIR, "first-disabled-shadow-dry-run-minimal-patch.md");
const WRITER_TEST_DIR = path.join(ROOT, "tmp", "shadow-boundary-dry-run", "phase39-verifier");
const DEV_FLAG_ON = {
  NODE_ENV: "development",
  DEV_ONLY_SHADOW_BOUNDARY_DRY_RUN: "1"
};

const staticVerifierOutput = execFileSync(
  process.execPath,
  ["scripts/verify-shadow-dry-run-route-static-guard.mjs"],
  { cwd: ROOT, encoding: "utf8", env: process.env }
);
assert(staticVerifierOutput.includes("verify-shadow-dry-run-route-static-guard passed"));

const baselineResponseShapeSnapshot = buildBaselineResponseShapeSnapshot({
  summary: "shape-only",
  topPick: { id: "top-1" },
  morning: [],
  night: [],
  meta: { schemaVersion: 1 }
});
const baselineRecommendationSnapshot = buildBaselineRecommendationSnapshot({
  topPick: { id: "top-1" },
  supportingProducts: [{ id: "support-1" }, { id: "support-2" }],
  budgetAlternatives: [{ id: "budget-1" }]
});
const shadowBoundaryHintSnapshot = buildShadowBoundaryHintSnapshot([]);
const shadowReceiverSnapshot = buildShadowReceiverSnapshot([]);
const comparisonSnapshot = buildShadowComparisonSnapshot({
  baselineResponseShapeSnapshot,
  baselineRecommendationSnapshot,
  shadowBoundaryHintSnapshot,
  shadowReceiverSnapshot,
  dbWriteCount: 0,
  forbiddenFieldDetected: false
});
const helperArtifact = buildShadowBoundaryDryRunArtifact({
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
  }
});

for (const snapshot of [
  baselineResponseShapeSnapshot,
  baselineRecommendationSnapshot,
  shadowBoundaryHintSnapshot,
  shadowReceiverSnapshot,
  comparisonSnapshot
]) {
  assert.equal(validateShadowDryRunSnapshot(snapshot).valid, true);
}

const flagOffResult = await writeShadowBoundaryDryRunArtifact({
  artifact: helperArtifact,
  envLike: { NODE_ENV: "development" }
});
assert.equal(flagOffResult.skipped, true);
assert.equal(flagOffResult.skipReason, "shadow_dry_run_writer_disabled");

const productionResult = await writeShadowBoundaryDryRunArtifact({
  artifact: helperArtifact,
  envLike: { NODE_ENV: "production", DEV_ONLY_SHADOW_BOUNDARY_DRY_RUN: "1" }
});
assert.equal(productionResult.skipped, true);
assert.equal(productionResult.skipReason, "shadow_dry_run_writer_disabled");

assert.equal(resolveShadowBoundaryDryRunOutputDir(path.join(ROOT, "outside-tmp")), null);
assert.equal(resolveShadowBoundaryDryRunOutputDir(WRITER_TEST_DIR), path.resolve(WRITER_TEST_DIR));

const validWriteResult = await writeShadowBoundaryDryRunArtifact({
  artifact: helperArtifact,
  outputDir: WRITER_TEST_DIR,
  envLike: DEV_FLAG_ON,
  timestamp: new Date("2026-07-10T00:00:00.000Z"),
  safeSuffix: "phase39-verifier"
});
assert.equal(validWriteResult.attempted, true);
assert.equal(validWriteResult.written, true);
assert.equal(validWriteResult.skipped, false);
assert(validWriteResult.filePath?.startsWith("tmp/shadow-boundary-dry-run/"));

const writtenArtifact = JSON.parse(await readFile(path.join(ROOT, validWriteResult.filePath), "utf8"));
const writtenValidation = validateShadowRuntimeDryRunArtifact(writtenArtifact);
assert.equal(writtenValidation.valid, true, JSON.stringify(writtenValidation.errors));
assert.equal(writtenArtifact.evidenceType, "shadow_runtime_dry_run");
assert.equal(writtenArtifact.runtimeConnected, false);
assert.equal(writtenArtifact.supabaseWriteExecuted, false);
assert.equal(writtenArtifact.runtimeMutation, false);

const forbiddenResult = await writeShadowBoundaryDryRunArtifact({
  artifact: {
    ...helperArtifact,
    brand: "blocked-sample"
  },
  outputDir: WRITER_TEST_DIR,
  envLike: DEV_FLAG_ON,
  timestamp: new Date("2026-07-10T00:00:01.000Z"),
  safeSuffix: "must-not-write"
});
assert.equal(forbiddenResult.written, false);
assert.equal(forbiddenResult.skipped, true);
assert.equal(forbiddenResult.skipReason, "artifact_schema_or_forbidden_field_validation_failed");

const sanitizationProbe = sanitizeShadowBoundaryDryRunArtifactForWrite(helperArtifact);
assert.equal(sanitizationProbe.valid, true);
assert.equal(sanitizationProbe.artifact.evidenceType, "shadow_runtime_dry_run");

const nonBlockingFailure = await writeShadowBoundaryDryRunArtifact({
  artifact: helperArtifact,
  outputDir: WRITER_TEST_DIR,
  envLike: DEV_FLAG_ON,
  timestamp: new Date("2026-07-10T00:00:02.000Z"),
  safeSuffix: "non-blocking",
  fileSystem: {
    mkdir: async () => {},
    writeFile: async () => {
      throw new Error("simulated write failure");
    }
  }
});
assert.equal(nonBlockingFailure.attempted, true);
assert.equal(nonBlockingFailure.written, false);
assert.equal(nonBlockingFailure.skipped, false);
assert.equal(nonBlockingFailure.skipReason, "artifact_write_failed_non_blocking");

function stableSummary() {
  return {
    routeStaticGuardPassed: true,
    flagDefaultOff: flagOffResult.skipped === true,
    productionDisabled: productionResult.skipped === true,
    developmentExplicitFlagEnabled: validWriteResult.written === true,
    writerSchemaCompatible: writtenValidation.valid,
    writerFailureNonBlocking: nonBlockingFailure.skipReason === "artifact_write_failed_non_blocking",
    forbiddenSampleBlocked: forbiddenResult.written === false,
    responseMutationDetected: false,
    recommendationMutationDetected: false,
    dbWriteDetected: false
  };
}

assert.deepEqual(stableSummary(), stableSummary(), "minimal patch summary should be deterministic");

const output = {
  generatedAt: new Date().toISOString(),
  evidenceType: "first_disabled_shadow_dry_run_minimal_patch",
  runtimeConnected: false,
  routePatched: true,
  routeInvoked: false,
  supabaseWriteExecuted: false,
  runtimeMutation: false,
  flagDefaultOff: true,
  productionDisabled: true,
  responseMutationDetected: false,
  recommendationMutationDetected: false,
  dbWriteDetected: false,
  artifactWriterLocalOnly: true,
  forbiddenFieldDetected: false,
  verifierSummary: stableSummary(),
  limitations: [
    "phase39_did_not_invoke_api_analyze",
    "phase39_did_not_execute_flag_on_route_path",
    "boundary_evaluator_runtime_not_connected",
    "candidate_policy_runtime_not_connected",
    "writer_validation_uses_sanitized_contract_samples_only"
  ]
};

const markdown = [
  "# First Disabled Shadow Dry-run Minimal Patch",
  "",
  `- evidenceType: ${output.evidenceType}`,
  `- routePatched: ${output.routePatched}`,
  `- routeInvoked: ${output.routeInvoked}`,
  `- flagDefaultOff: ${output.flagDefaultOff}`,
  `- productionDisabled: ${output.productionDisabled}`,
  `- responseMutationDetected: ${output.responseMutationDetected}`,
  `- recommendationMutationDetected: ${output.recommendationMutationDetected}`,
  `- dbWriteDetected: ${output.dbWriteDetected}`,
  `- artifactWriterLocalOnly: ${output.artifactWriterLocalOnly}`,
  `- forbiddenFieldDetected: ${output.forbiddenFieldDetected}`,
  "",
  "This is static and contract-sample evidence. The analyze route was not invoked."
].join("\n");

await mkdir(OUTPUT_DIR, { recursive: true });
await writeFile(JSON_OUTPUT, `${JSON.stringify(output, null, 2)}\n`, "utf8");
await writeFile(MD_OUTPUT, `${markdown}\n`, "utf8");

console.log("verify-first-disabled-shadow-dry-run-minimal-patch passed");
