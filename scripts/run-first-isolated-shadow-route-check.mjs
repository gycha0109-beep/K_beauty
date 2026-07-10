import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";

const ROOT = process.cwd();
const ENV_PATH = path.join(ROOT, ".env.local");
const OUTPUT_DIR = path.join(ROOT, "tmp");
const JSON_OUTPUT = path.join(OUTPUT_DIR, "first-isolated-shadow-route-check.json");
const MD_OUTPUT = path.join(OUTPUT_DIR, "first-isolated-shadow-route-check.md");
const SKIP_REASON = "isolated_route_run_not_executed_environment_unverified";
const NON_PRODUCTION_VALUES = new Set(["dev", "development", "test", "testing", "local", "preview"]);

function trackedFiles() {
  return execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" })
    .split(/\r?\n/)
    .map((file) => file.trim())
    .filter(Boolean);
}

function parseEnvWithoutMutation() {
  if (!existsSync(ENV_PATH)) return {};
  return dotenv.parse(readFileSync(ENV_PATH));
}

function classifySupabaseUrl(env) {
  const value = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || "";
  if (!value) {
    return { configured: false, isLoopback: false, isRemoteHosted: false };
  }

  try {
    const hostname = new URL(value).hostname.toLowerCase();
    const isLoopback = ["localhost", "127.0.0.1", "::1", "host.docker.internal"].includes(hostname);
    return { configured: true, isLoopback, isRemoteHosted: !isLoopback };
  } catch {
    return { configured: true, isLoopback: false, isRemoteHosted: false };
  }
}

function hasExplicitNonProductionMarker(env) {
  const markerKeys = [
    "SUPABASE_ENVIRONMENT",
    "APP_ENV",
    "DEPLOYMENT_ENV",
    "SHADOW_TEST_ENVIRONMENT"
  ];
  return markerKeys.some((key) => NON_PRODUCTION_VALUES.has(String(env[key] || "").trim().toLowerCase()));
}

function renderMarkdown(output) {
  return [
    "# First Isolated Shadow Route Check",
    "",
    `- status: ${output.status}`,
    `- routeInvoked: ${output.routeInvoked}`,
    `- skipReason: ${output.skipReason}`,
    "",
    "## Environment",
    `- non-production verified: ${output.environmentVerification.supabase.verifiedNonProduction}`,
    `- disposable verified: ${output.environmentVerification.disposableEnvironment.verified}`,
    `- safe fixture verified: ${output.environmentVerification.safeFixture.verified}`,
    `- mutation delta separation verified: ${output.environmentVerification.mutationDeltaMeasurement.verified}`,
    "",
    "No API request or Supabase mutation was executed."
  ].join("\n");
}

const env = parseEnvWithoutMutation();
const files = trackedFiles();
const urlClassification = classifySupabaseUrl(env);
const localConfigPresent = [
  "supabase/config.toml",
  ".supabase/config.toml"
].some((file) => existsSync(path.join(ROOT, file)));
const explicitNonProductionMarkerPresent = hasExplicitNonProductionMarker(env);
const disposableMarkerPresent = String(env.SHADOW_TEST_DB_DISPOSABLE || "") === "1";
const cleanupContractCount = files.filter(
  (file) => /(?:cleanup|reset|rollback)/i.test(file) && /(?:supabase|database|db|shadow)/i.test(file)
).length;
const imageFixtureCount = files.filter(
  (file) => /(?:fixture|sample|test[-_]?image|test[-_]?data)/i.test(file) && /\.(?:png|jpe?g|webp)$/i.test(file)
).length;
const payloadFixtureCount = files.filter(
  (file) => /(?:fixture|sample|test[-_]?data)/i.test(file) && /(?:analyze|survey)/i.test(file) && /\.(?:json|m?js|c?js)$/i.test(file)
).length;
const mutationInstrumentationCount = files.filter(
  (file) => /(?:mutation[-_]?delta|db[-_]?write[-_]?delta|shadow[-_]?write[-_]?counter)/i.test(file)
).length;

const verifiedNonProduction =
  (urlClassification.isLoopback && localConfigPresent) ||
  (explicitNonProductionMarkerPresent && disposableMarkerPresent);
const disposableVerified =
  verifiedNonProduction && disposableMarkerPresent && cleanupContractCount > 0;
const safeFixtureVerified = imageFixtureCount > 0 && payloadFixtureCount > 0;
const identicalInputReplayVerified = safeFixtureVerified;
const mutationDeltaMeasurementVerified = mutationInstrumentationCount > 0;
const cleanupAndRollbackVerified = disposableVerified && cleanupContractCount > 0;

const environmentVerification = {
  allRequiredConditionsVerified: false,
  supabase: {
    urlConfigured: urlClassification.configured,
    urlIsLoopback: urlClassification.isLoopback,
    remoteHostedDetected: urlClassification.isRemoteHosted,
    explicitNonProductionMarkerPresent,
    localSupabaseConfigPresent: localConfigPresent,
    verifiedNonProduction
  },
  disposableEnvironment: {
    disposableMarkerPresent,
    cleanupContractPresent: cleanupContractCount > 0,
    verified: disposableVerified
  },
  safeFixture: {
    repoImageFixtureCount: imageFixtureCount,
    safePayloadFixtureCount: payloadFixtureCount,
    userImageUsed: false,
    verified: safeFixtureVerified
  },
  identicalInputReplay: {
    verified: identicalInputReplayVerified
  },
  mutationDeltaMeasurement: {
    instrumentationContractCount: mutationInstrumentationCount,
    separatesExistingRouteMutationsFromShadowAddedMutations: mutationDeltaMeasurementVerified,
    verified: mutationDeltaMeasurementVerified
  },
  cleanupAndRollback: {
    verified: cleanupAndRollbackVerified
  },
  envValuesPrinted: false,
  secretValuesPrinted: false
};
environmentVerification.allRequiredConditionsVerified = [
  verifiedNonProduction,
  disposableVerified,
  safeFixtureVerified,
  identicalInputReplayVerified,
  mutationDeltaMeasurementVerified,
  cleanupAndRollbackVerified
].every(Boolean);

const shouldExecuteRoute = environmentVerification.allRequiredConditionsVerified;
if (shouldExecuteRoute) {
  throw new Error("isolated route execution requires a separately reviewed executable harness");
}

const output = {
  generatedAt: new Date().toISOString(),
  evidenceType: "first_isolated_shadow_route_check",
  status: "isolated_route_run_not_executed_environment_unverified",
  routeInvoked: false,
  runtimeConnected: false,
  supabaseWriteExecuted: false,
  runtimeMutation: false,
  skipReason: SKIP_REASON,
  environmentVerification,
  flagOffBaseline: {
    attempted: false,
    responseShapeSnapshot: null,
    topPickId: null,
    supportingProductIdsInOrder: null,
    budgetAlternativeIdsInOrder: null,
    shadowArtifactNewCount: null,
    reason: SKIP_REASON
  },
  flagOnDryRun: {
    attempted: false,
    responseShapeSnapshot: null,
    topPickId: null,
    supportingProductIdsInOrder: null,
    budgetAlternativeIdsInOrder: null,
    shadowArtifactNewCount: null,
    artifactSchemaValid: null,
    forbiddenFieldDetected: null,
    writerFailureDetected: null,
    reason: SKIP_REASON
  },
  comparison: {
    responseShapeChanged: null,
    topPickChanged: null,
    supportingProductsChanged: null,
    supportingProductsOrderChanged: null,
    budgetAlternativesChanged: null,
    budgetAlternativesOrderChanged: null,
    helperResultMergedIntoResponseOrStore: null,
    reason: "comparison_not_run"
  },
  artifactVerification: {
    attempted: false,
    flagOffNewArtifactCount: null,
    flagOnNewArtifactCount: null,
    schemaValid: null,
    forbiddenFieldDetected: null,
    reason: SKIP_REASON
  },
  existingRouteMutationCount: null,
  shadowAddedDbMutationDelta: null,
  safetyViolationCounts: {
    highRiskCollapsedReceiverCount: null,
    sensitivityUnsafeCollapsedReceiverCount: null,
    metadataIncompleteCollapsedReceiverCount: null,
    strongCautionCollapsedReceiverCount: null
  },
  limitations: [
    "remote_supabase_configuration_not_proven_nonproduction",
    "disposable_cleanup_contract_not_verified",
    "safe_repo_image_and_payload_fixtures_not_available",
    "existing_vs_shadow_added_mutation_delta_instrumentation_not_available",
    "actual_api_analyze_request_not_sent"
  ]
};

await mkdir(OUTPUT_DIR, { recursive: true });
await writeFile(JSON_OUTPUT, `${JSON.stringify(output, null, 2)}\n`, "utf8");
await writeFile(MD_OUTPUT, `${renderMarkdown(output)}\n`, "utf8");

console.log("first-isolated-shadow-route-check summary");
console.log(JSON.stringify({
  status: output.status,
  routeInvoked: output.routeInvoked,
  skipReason: output.skipReason,
  requiredConditionsVerified: output.environmentVerification.allRequiredConditionsVerified,
  envValuesPrinted: output.environmentVerification.envValuesPrinted,
  secretValuesPrinted: output.environmentVerification.secretValuesPrinted
}, null, 2));
