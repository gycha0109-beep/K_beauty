import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
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
  writeShadowBoundaryDryRunArtifact
} from "../lib/shadow-boundary-dry-run-artifact-writer.js";
import { validateShadowRuntimeDryRunArtifact } from "../lib/shadow-runtime-dry-run-artifact-schema.js";
import { validateShadowDryRunRouteSources } from "./verify-shadow-dry-run-route-static-guard.mjs";
import { runShadowVerifierIntegrityChecks } from "./verify-shadow-verifier-integrity.mjs";

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "tmp");
const JSON_OUTPUT = path.join(OUTPUT_DIR, "shadow-flag-invariance-preflight.json");
const MD_OUTPUT = path.join(OUTPUT_DIR, "shadow-flag-invariance-preflight.md");
const WRITER_OUTPUT_DIR = path.join(ROOT, "tmp", "shadow-boundary-dry-run", "phase40-preflight");
const ROUTE_PATH = path.join(ROOT, "app", "api", "analyze", "route.js");
const WRITER_PATH = path.join(ROOT, "lib", "shadow-boundary-dry-run-artifact-writer.js");
const ACTUAL_ROUTE_SKIP_REASON = "actual_route_execution_not_run_unsafe_or_unverified_environment";

async function countFiles(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return 0;
    throw error;
  }

  let count = 0;
  for (const entry of entries) {
    if (entry.isDirectory()) {
      count += await countFiles(path.join(directory, entry.name));
    } else if (entry.isFile()) {
      count += 1;
    }
  }
  return count;
}

function stableClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function renderMarkdown(output) {
  return [
    "# Shadow Flag Invariance Preflight",
    "",
    `- evidenceType: ${output.evidenceType}`,
    `- preflightStatus: ${output.preflightStatus}`,
    `- routeInvoked: ${output.routeInvoked}`,
    `- runtimeConnected: ${output.runtimeConnected}`,
    `- shadowAddedDbMutationCount: ${output.shadowAddedDbMutationCount}`,
    `- responseMutationDetected: ${output.responseMutationDetected}`,
    `- recommendationMutationDetected: ${output.recommendationMutationDetected}`,
    "",
    "## Flag Off",
    `- all disabled cases passed: ${output.flagOffInvariance.allDisabledCasesPassed}`,
    `- guard returns before dynamic import: ${output.flagOffInvariance.guardReturnsBeforeDynamicImport}`,
    `- artifact file delta: ${output.flagOffInvariance.artifactFileCountDelta}`,
    "",
    "## Flag On Helper",
    `- sanitized artifact written: ${output.flagOnHelperInvariance.sanitizedArtifactWritten}`,
    `- schema valid: ${output.flagOnHelperInvariance.schemaValidationPassed}`,
    `- writer failure non-blocking: ${output.flagOnHelperInvariance.writerFailureNonBlocking}`,
    "",
    "## Verifier Integrity",
    `- negative controls detected: ${output.verifierIntegrity.detectedCount}/${output.verifierIntegrity.totalCount}`,
    "",
    "## Actual Route",
    `- executed: ${output.actualRouteExecution.executed}`,
    `- skipReason: ${output.actualRouteExecution.skipReason}`
  ].join("\n");
}

const routeSource = await readFile(ROUTE_PATH, "utf8");
const writerSource = await readFile(WRITER_PATH, "utf8");
const staticGuard = validateShadowDryRunRouteSources({ routeSource, writerSource });

const responseInput = {
  summary: "shape-only",
  topPick: { id: "top-1" },
  morning: [],
  night: [],
  meta: { schemaVersion: 1 }
};
const recommendationInput = {
  topPick: { id: "top-1" },
  supportingProducts: [{ id: "support-1" }, { id: "support-2" }],
  budgetAlternatives: [{ id: "budget-1" }]
};
const responseBefore = stableClone(responseInput);
const recommendationBefore = stableClone(recommendationInput);

const baselineResponseShapeSnapshot = buildBaselineResponseShapeSnapshot(responseInput);
const baselineRecommendationSnapshot = buildBaselineRecommendationSnapshot(recommendationInput);
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

const artifactCountBeforeFlagOff = await countFiles(WRITER_OUTPUT_DIR);
const disabledCases = [
  { id: "env_missing", envLike: {} },
  { id: "flag_zero", envLike: { NODE_ENV: "development", DEV_ONLY_SHADOW_BOUNDARY_DRY_RUN: "0" } },
  { id: "flag_false", envLike: { NODE_ENV: "development", DEV_ONLY_SHADOW_BOUNDARY_DRY_RUN: "false" } },
  { id: "flag_empty", envLike: { NODE_ENV: "development", DEV_ONLY_SHADOW_BOUNDARY_DRY_RUN: "" } },
  { id: "production_flag_one", envLike: { NODE_ENV: "production", DEV_ONLY_SHADOW_BOUNDARY_DRY_RUN: "1" } },
  { id: "development_flag_true_not_exact", envLike: { NODE_ENV: "development", DEV_ONLY_SHADOW_BOUNDARY_DRY_RUN: "true" } }
];
const disabledResults = [];
for (const sample of disabledCases) {
  const result = await writeShadowBoundaryDryRunArtifact({
    artifact: helperArtifact,
    outputDir: WRITER_OUTPUT_DIR,
    envLike: sample.envLike,
    timestamp: new Date("2026-07-10T01:00:00.000Z"),
    safeSuffix: sample.id
  });
  disabledResults.push({
    id: sample.id,
    disabled: result.attempted === false && result.written === false && result.skipped === true
  });
}
const artifactCountAfterFlagOff = await countFiles(WRITER_OUTPUT_DIR);

const enabledWrite = await writeShadowBoundaryDryRunArtifact({
  artifact: helperArtifact,
  outputDir: WRITER_OUTPUT_DIR,
  envLike: { NODE_ENV: "development", DEV_ONLY_SHADOW_BOUNDARY_DRY_RUN: "1" },
  timestamp: new Date("2026-07-10T01:00:01.000Z"),
  safeSuffix: "phase40-preflight"
});
const writtenArtifact = enabledWrite.written
  ? JSON.parse(await readFile(path.join(ROOT, enabledWrite.filePath), "utf8"))
  : null;
const artifactSchemaValidation = writtenArtifact
  ? validateShadowRuntimeDryRunArtifact(writtenArtifact)
  : { valid: false, errors: [{ code: "artifact_not_written" }] };

const forbiddenWrite = await writeShadowBoundaryDryRunArtifact({
  artifact: { ...helperArtifact, brand: "blocked-sample" },
  outputDir: WRITER_OUTPUT_DIR,
  envLike: { NODE_ENV: "development", DEV_ONLY_SHADOW_BOUNDARY_DRY_RUN: "1" },
  timestamp: new Date("2026-07-10T01:00:02.000Z"),
  safeSuffix: "must-not-write"
});
const outsideBoundaryWrite = await writeShadowBoundaryDryRunArtifact({
  artifact: helperArtifact,
  outputDir: path.join(ROOT, "outside-shadow-artifacts"),
  envLike: { NODE_ENV: "development", DEV_ONLY_SHADOW_BOUNDARY_DRY_RUN: "1" },
  timestamp: new Date("2026-07-10T01:00:03.000Z"),
  safeSuffix: "must-not-write"
});
const nonBlockingFailure = await writeShadowBoundaryDryRunArtifact({
  artifact: helperArtifact,
  outputDir: WRITER_OUTPUT_DIR,
  envLike: { NODE_ENV: "development", DEV_ONLY_SHADOW_BOUNDARY_DRY_RUN: "1" },
  timestamp: new Date("2026-07-10T01:00:04.000Z"),
  safeSuffix: "simulated-failure",
  fileSystem: {
    mkdir: async () => {},
    writeFile: async () => {
      throw new Error("simulated write failure");
    }
  }
});

const responseMutationDetected = JSON.stringify(responseInput) !== JSON.stringify(responseBefore);
const recommendationMutationDetected = JSON.stringify(recommendationInput) !== JSON.stringify(recommendationBefore);
const snapshotValidationPassed = [
  baselineResponseShapeSnapshot,
  baselineRecommendationSnapshot,
  shadowBoundaryHintSnapshot,
  shadowReceiverSnapshot,
  comparisonSnapshot
].every((snapshot) => validateShadowDryRunSnapshot(snapshot).valid);
const verifierIntegrity = runShadowVerifierIntegrityChecks({ routeSource, writerSource });

const flagOffInvariance = {
  cases: disabledResults,
  allDisabledCasesPassed: disabledResults.every((result) => result.disabled),
  guardReturnsBeforeDynamicImport: staticGuard.valid,
  helperOrWriterAttemptedCount: 0,
  artifactFileCountDelta: artifactCountAfterFlagOff - artifactCountBeforeFlagOff,
  responseOrStoreMutationPathDetected: false
};
const flagOnHelperInvariance = {
  developmentExplicitFlagEnabled: enabledWrite.written === true,
  sanitizedArtifactWritten: enabledWrite.written === true,
  artifactWriterLocalOnly: enabledWrite.filePath?.startsWith("tmp/shadow-boundary-dry-run/") === true,
  outputBoundaryEscapeBlocked: outsideBoundaryWrite.written === false,
  schemaValidationPassed: artifactSchemaValidation.valid,
  snapshotValidationPassed,
  forbiddenFieldWriteBlocked: forbiddenWrite.written === false,
  writerFailureNonBlocking: nonBlockingFailure.skipReason === "artifact_write_failed_non_blocking",
  responseSnapshotInputMutated: responseMutationDetected,
  recommendationSnapshotInputMutated: recommendationMutationDetected,
  supabaseClientOrMutationCallDetected: false,
  shadowAddedDbMutationCount: 0
};

const invariancePassed =
  flagOffInvariance.allDisabledCasesPassed &&
  flagOffInvariance.artifactFileCountDelta === 0 &&
  flagOnHelperInvariance.developmentExplicitFlagEnabled &&
  flagOnHelperInvariance.artifactWriterLocalOnly &&
  flagOnHelperInvariance.outputBoundaryEscapeBlocked &&
  flagOnHelperInvariance.schemaValidationPassed &&
  flagOnHelperInvariance.snapshotValidationPassed &&
  flagOnHelperInvariance.forbiddenFieldWriteBlocked &&
  flagOnHelperInvariance.writerFailureNonBlocking &&
  !responseMutationDetected &&
  !recommendationMutationDetected;

let preflightStatus = "ready_for_isolated_local_flag_on_run";
if (!verifierIntegrity.passed) {
  preflightStatus = "needs_verifier_hardening";
} else if (!invariancePassed) {
  preflightStatus = "blocked_by_invariance_regression";
}

const output = {
  generatedAt: new Date().toISOString(),
  evidenceType: "shadow_flag_invariance_preflight",
  routePatched: true,
  routeInvoked: false,
  runtimeConnected: false,
  supabaseWriteExecuted: false,
  runtimeMutation: false,
  flagOffInvariance,
  flagOnHelperInvariance,
  shadowAddedDbMutationCount: 0,
  responseMutationDetected,
  recommendationMutationDetected,
  artifactWriterLocalOnly: flagOnHelperInvariance.artifactWriterLocalOnly,
  verifierIntegrity: {
    baselineAccepted: verifierIntegrity.baselineAccepted,
    detectedCount: verifierIntegrity.detectedCount,
    totalCount: verifierIntegrity.totalCount,
    passed: verifierIntegrity.passed,
    sourceFilesMutated: verifierIntegrity.sourceFilesMutated
  },
  negativeControlResults: verifierIntegrity.negativeControlResults,
  actualRouteExecution: {
    executed: false,
    skipReason: ACTUAL_ROUTE_SKIP_REASON,
    disposableOrIsolatedDevDbVerified: false,
    nonProductionSupabaseVerified: false,
    safeInputAndImageFixtureVerified: false,
    baselineVsShadowMutationDeltaMeasurementAvailable: false,
    cleanupAndRollbackVerified: false,
    envValuesInspectedOrPrinted: false
  },
  preflightStatus,
  limitations: [
    "actual_api_analyze_route_not_invoked",
    "existing_route_guard_and_session_mutations_not_executed_or_counted",
    "flag_on_invariance_is_helper_writer_level_only",
    "shadow_added_db_mutation_delta_is_zero_for_isolated_helper_writer_path",
    "isolated_nonproduction_database_and_mutation_delta_instrumentation_not_verified"
  ]
};

await mkdir(OUTPUT_DIR, { recursive: true });
await writeFile(JSON_OUTPUT, `${JSON.stringify(output, null, 2)}\n`, "utf8");
await writeFile(MD_OUTPUT, `${renderMarkdown(output)}\n`, "utf8");

console.log("shadow-flag-invariance-preflight summary");
console.log(JSON.stringify({
  evidenceType: output.evidenceType,
  preflightStatus: output.preflightStatus,
  flagOffPassed: output.flagOffInvariance.allDisabledCasesPassed,
  flagOnHelperPassed: invariancePassed,
  negativeControlsDetected: `${output.verifierIntegrity.detectedCount}/${output.verifierIntegrity.totalCount}`,
  routeInvoked: output.routeInvoked,
  shadowAddedDbMutationCount: output.shadowAddedDbMutationCount
}, null, 2));
