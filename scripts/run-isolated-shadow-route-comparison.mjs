import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prepareIsolatedShadowRouteEnvironment } from "./setup-isolated-shadow-route-environment.mjs";
import { teardownIsolatedShadowRouteEnvironment } from "./teardown-isolated-shadow-route-environment.mjs";
import { compareShadowRouteMutationSummaries } from "./lib/shadow-route-mutation-observer.mjs";

const ROOT = process.cwd();
const TMP_DIR = path.join(ROOT, "tmp");
const JSON_OUTPUT = path.join(TMP_DIR, "isolated-shadow-route-controlled-run.json");
const MD_OUTPUT = path.join(TMP_DIR, "isolated-shadow-route-controlled-run.md");

const ALLOWED_STATUSES = new Set([
  "isolated_shadow_route_run_pass",
  "blocked_local_supabase_unavailable",
  "blocked_local_schema_not_reproducible",
  "blocked_external_provider_not_isolated",
  "blocked_needs_test_seam_approval",
  "blocked_fixture_contract",
  "blocked_mutation_observer_incomplete",
  "blocked_cleanup_contract",
  "blocked_response_regression",
  "blocked_recommendation_regression",
  "blocked_shadow_db_mutation",
  "blocked_shadow_storage_mutation",
  "blocked_artifact_safety_violation"
]);

function blockedExecution(reasonCode) {
  return {
    attempted: false,
    completed: false,
    httpStatus: null,
    responseShapeSnapshot: null,
    recommendationSnapshot: null,
    routeMutationSummary: null,
    storageMutationSummary: null,
    shadowArtifactDelta: null,
    reasonCode
  };
}

function selectStatus(setup) {
  if (!setup.tools.supabaseCliAvailable || !setup.tools.dockerDaemonAvailable) {
    return "blocked_local_supabase_unavailable";
  }
  if (!setup.localProject.configPresent || !setup.migrationReproducibility.schemaReproducible) {
    return "blocked_local_schema_not_reproducible";
  }
  if (!setup.providerIsolation.canGuaranteeZeroProductionProviderCalls) {
    return setup.providerIsolation.requiredSeam
      ? "blocked_needs_test_seam_approval"
      : "blocked_external_provider_not_isolated";
  }
  if (!setup.fixture.fixtureReadyForDeterministicProviderFallback) {
    return "blocked_fixture_contract";
  }
  if (setup.mutationObserver.mutationObserverCoverage !== "complete") {
    return "blocked_mutation_observer_incomplete";
  }
  if (!setup.cleanupContract.verified) {
    return "blocked_cleanup_contract";
  }
  return null;
}

function renderMarkdown(output) {
  return [
    "# Isolated Shadow Route Controlled Run",
    "",
    `- finalStatus: ${output.finalStatus}`,
    `- routeInvoked: ${output.routeInvoked}`,
    `- targetType: ${output.targetType}`,
    `- productionBlocked: ${output.productionBlocked}`,
    `- hostedUnknownTargetUsed: ${output.hostedUnknownTargetUsed}`,
    `- externalProductionProviderInvoked: ${output.externalProductionProviderInvoked}`,
    `- mutationObserverCoverage: ${output.mutationObserverCoverage.status}`,
    `- cleanupSucceeded: ${output.cleanupSucceeded}`,
    "",
    "The controlled request was not sent because the local schema cannot be reproduced from the repository migrations.",
    "Measured comparison values remain null rather than being reported as zero."
  ].join("\n");
}

const setup = await prepareIsolatedShadowRouteEnvironment();
const blockedStatus = selectStatus(setup);

if (!blockedStatus) {
  throw new Error("all route execution gates unexpectedly passed; controlled execution requires an explicit reviewed executor");
}
if (!ALLOWED_STATUSES.has(blockedStatus)) {
  throw new Error(`unsupported controlled-run status: ${blockedStatus}`);
}

const baselineExecution = blockedExecution(blockedStatus);
const flagOnExecution = blockedExecution(blockedStatus);
const mutationComparison = compareShadowRouteMutationSummaries(
  baselineExecution.routeMutationSummary,
  flagOnExecution.routeMutationSummary
);
const teardown = await teardownIsolatedShadowRouteEnvironment({ runDirectory: null });

const secondaryBlockers = [
  !setup.providerIsolation.canGuaranteeZeroProductionProviderCalls
    ? "external_provider_isolation_requires_approved_test_seam"
    : null,
  setup.mutationObserver.mutationObserverCoverage !== "complete"
    ? "mutation_observer_not_installed"
    : null,
  !setup.cleanupContract.verified ? "cleanup_not_verified_against_created_resources" : null
].filter(Boolean);

const output = {
  generatedAt: new Date().toISOString(),
  evidenceType: "isolated_shadow_route_controlled_run",
  targetType: "local_supabase_candidate_unconfigured",
  productionBlocked: true,
  hostedUnknownTargetUsed: false,
  routeInvoked: false,
  externalProductionProviderInvoked: false,
  providerStubbed: false,
  fixtureType: setup.fixture.imageFixtureType,
  baselineExecution,
  flagOnExecution,
  responseShapeChanged: null,
  recommendationChanged: null,
  baselineRouteMutationSummary: null,
  flagOnRouteMutationSummary: null,
  shadowAddedDbMutationDelta: mutationComparison.shadowAddedDbMutationDelta,
  shadowAddedStorageMutationDelta: mutationComparison.shadowAddedStorageMutationDelta,
  unobservedMutationSurface: setup.mutationObserver.unobservedMutationSurface,
  mutationObserverCoverage: {
    status: setup.mutationObserver.mutationObserverCoverage,
    measured: setup.mutationObserver.measured,
    separatesExistingRouteMutationsFromShadowAddedMutations:
      setup.mutationObserver.separatesExistingRouteMutationsFromShadowAddedMutations
  },
  flagOffArtifactDelta: null,
  flagOnArtifactDelta: null,
  artifactSchemaValid: null,
  forbiddenFieldDetected: null,
  cleanupExecuted: teardown.cleanup.attempted,
  cleanupSucceeded: teardown.cleanup.succeeded,
  cleanupReasonCode: teardown.cleanup.reasonCode,
  runtimeConnected: false,
  evaluatorConnected: false,
  candidatePolicyConnected: false,
  databaseCommandExecuted: false,
  supabaseWriteExecuted: false,
  safetyViolationCounts: {
    highRiskCollapsedReceiverCount: null,
    sensitivityUnsafeCollapsedReceiverCount: null,
    metadataIncompleteCollapsedReceiverCount: null,
    strongCautionCollapsedReceiverCount: null
  },
  environmentAssessment: {
    tools: setup.tools,
    localProject: setup.localProject,
    migrationReproducibility: setup.migrationReproducibility,
    providerIsolation: setup.providerIsolation,
    fixture: setup.fixture
  },
  blockingReasons: [setup.migrationReproducibility.reasonCode, ...secondaryBlockers],
  limitations: [
    "controlled_route_request_not_sent",
    "repository_migrations_do_not_create_base_products_table",
    "current_hosted_unknown_target_was_not_used",
    "development_provider_key_fallback_is_not_isolated",
    "mutation_observer_evidence_not_measured",
    "response_recommendation_and_artifact_comparison_not_measured"
  ],
  finalStatus: blockedStatus
};

await mkdir(TMP_DIR, { recursive: true });
await writeFile(JSON_OUTPUT, `${JSON.stringify(output, null, 2)}\n`, "utf8");
await writeFile(MD_OUTPUT, `${renderMarkdown(output)}\n`, "utf8");

console.log("run-isolated-shadow-route-comparison summary");
console.log(JSON.stringify({
  finalStatus: output.finalStatus,
  routeInvoked: output.routeInvoked,
  hostedUnknownTargetUsed: output.hostedUnknownTargetUsed,
  externalProductionProviderInvoked: output.externalProductionProviderInvoked,
  shadowAddedDbMutationDelta: output.shadowAddedDbMutationDelta,
  mutationObserverCoverage: output.mutationObserverCoverage.status,
  cleanupSucceeded: output.cleanupSucceeded
}, null, 2));
