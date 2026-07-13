import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { assertLocalShadowTestWorkdir } from "./assert-non-production-supabase-target.mjs";
import {
  collectLocalMutationSnapshot,
  buildRouteResponseContract,
  compareRouteExecutions,
  createConditionEvidence,
  readComparisonRecommendationEvidence
} from "./lib/isolated-shadow-route-evidence.mjs";
import {
  currentBranch,
  getLocalShadowRuntimeEnvironment,
  invokeLocalAnalyzeRoute,
  loadLocalAnalyzeFixture,
  queryLocalShadowPostgres,
  resetLocalShadowState,
  startLocalShadowServer,
  stopLocalShadowServer,
  waitForLocalShadowServer
} from "./lib/isolated-shadow-route-runtime.mjs";
import { prepareIsolatedShadowRouteEnvironment } from "./setup-isolated-shadow-route-environment.mjs";
import { teardownIsolatedShadowRouteEnvironment } from "./teardown-isolated-shadow-route-environment.mjs";

const ROOT = process.cwd();
const TMP_DIR = path.join(ROOT, "tmp");
const OUTPUT_PATH = path.join(TMP_DIR, "isolated-shadow-route-comparison.json");
const LOCAL_PORT = Number.parseInt(process.env.SHADOW_ROUTE_LOCAL_PORT || "3101", 10);
const ALLOWED_VERDICTS = new Set([
  "controlled_shadow_route_comparison_passed",
  "blocked_local_environment_setup",
  "blocked_test_server_start",
  "blocked_flag_off_route_execution",
  "blocked_flag_on_route_execution",
  "blocked_external_provider_isolation",
  "blocked_hosted_supabase_isolation",
  "blocked_response_contract_divergence",
  "blocked_unexpected_database_mutation",
  "blocked_unexpected_storage_mutation",
  "blocked_mutation_observer_incomplete",
  "blocked_cleanup_failure",
  "blocked_evidence_incomplete"
]);

async function executeCondition({ fixture, runtime, shadowEnabled, runDirectory, comparisonRunId }) {
  const before = collectLocalMutationSnapshot((sql) => queryLocalShadowPostgres(sql, { root: ROOT }));
  if (!before.ok) return createConditionEvidence({ reasonCode: before.reasonCode });

  const condition = shadowEnabled ? "on" : "off";
  const started = startLocalShadowServer({
    root: ROOT,
    port: LOCAL_PORT,
    env: {
      ...runtime.env,
      DEV_ONLY_SHADOW_BOUNDARY_DRY_RUN: shadowEnabled ? "1" : "",
      LOCAL_SHADOW_RECOMMENDATION_EVIDENCE: "1",
      LOCAL_SHADOW_RUN_DIRECTORY: runDirectory,
      LOCAL_SHADOW_COMPARISON_RUN_ID: comparisonRunId
    }
  });
  if (!started.ok || !(await waitForLocalShadowServer(started.child, LOCAL_PORT))) {
    await stopLocalShadowServer(started.child, { root: ROOT });
    return {
      ...createConditionEvidence({ reasonCode: started.reasonCode || "test_server_start_failed" }),
      serverStderr: started.getSanitizedStderr?.() || null
    };
  }

  let route;
  let serverStderr = null;
  try {
    route = await invokeLocalAnalyzeRoute({ fixture, port: LOCAL_PORT });
  } finally {
    await stopLocalShadowServer(started.child, { root: ROOT });
    serverStderr = started.getSanitizedStderr?.() || null;
  }
  if (!route.ok || route.httpStatus === 503) {
    return {
      ...createConditionEvidence({
        routeInvocationCount: 1,
        httpStatus: route.httpStatus,
        reasonCode: route.httpStatus === 503 ? "route_http_503" : route.reasonCode
      }),
      routeDiagnostic: route.diagnostic || null,
      serverStderr
    };
  }

  const after = collectLocalMutationSnapshot((sql) => queryLocalShadowPostgres(sql, { root: ROOT }));
  if (!after.ok) return createConditionEvidence({ routeInvocationCount: 1, httpStatus: route.httpStatus, reasonCode: after.reasonCode });

  const recommendation = await readComparisonRecommendationEvidence({ root: ROOT, runDirectory, comparisonRunId, condition });
  return recommendation.ok
    ? createConditionEvidence({
        routeInvocationCount: 1,
        httpStatus: route.httpStatus,
        responseContract: buildRouteResponseContract(route.payload),
        recommendationEvidence: recommendation.evidence,
        recommendationEvidenceMetadata: recommendation.metadata,
        beforeSnapshot: before.value,
        afterSnapshot: after.value
      })
    : createConditionEvidence({ routeInvocationCount: 1, httpStatus: route.httpStatus, reasonCode: recommendation.reasonCode });
}

function verdictFor({ setupReady, blocker, flagOff, flagOn, comparison, observerComplete }) {
  if (!setupReady) return "blocked_local_environment_setup";
  if (["local_workdir_safety_rejected", "local_target_safety_rejected"].includes(blocker)) return "blocked_hosted_supabase_isolation";
  if (blocker?.includes("server")) return "blocked_test_server_start";
  if (!flagOff.completed && !flagOff.reasonCode?.startsWith("recommendation_evidence")) return "blocked_flag_off_route_execution";
  if (!flagOn.completed && !flagOn.reasonCode?.startsWith("recommendation_evidence")) return "blocked_flag_on_route_execution";
  if (blocker?.startsWith("recommendation_evidence")) return "blocked_evidence_incomplete";
  if (!flagOff.completed) return "blocked_flag_off_route_execution";
  if (!flagOn.completed) return "blocked_flag_on_route_execution";
  if (!flagOff.providerEvidence.providerStubbed || !flagOn.providerEvidence.providerStubbed) return "blocked_external_provider_isolation";
  if (comparison.responseShapeChanged) return "blocked_response_contract_divergence";
  if (comparison.recommendationChanged) return "blocked_evidence_incomplete";
  if (comparison.databaseMutationClassification.some((event) => event.classification === "unexpected_mutation") || comparison.tableMutationClassification.some((event) => event.classification === "unexpected_mutation")) return "blocked_unexpected_database_mutation";
  if (comparison.storageMutationClassification.classification === "unexpected_mutation") return "blocked_unexpected_storage_mutation";
  if (!observerComplete || !comparison.completeRecommendationComparison) return "blocked_evidence_incomplete";
  return "controlled_shadow_route_comparison_passed";
}

export async function runIsolatedShadowRouteComparison() {
  const setup = await prepareIsolatedShadowRouteEnvironment();
  const setupReady = setup.setupStatus === "local_shadow_runtime_ready_for_controlled_route_run";
  const output = {
    evidenceType: "isolated_shadow_route_controlled_run",
    phase: "45",
    branch: currentBranch(ROOT),
    startedAt: new Date().toISOString(),
    completedAt: null,
    targetType: setup.localTarget?.targetType || "local_shadow_test_unverified",
    productionBlocked: setup.localTarget?.productionBlocked === true,
    routeInvoked: false,
    externalProviderInvocationCount: 0,
    hostedSupabaseAccessCount: 0,
    setupStatus: setup.setupStatus,
    mutationObserverCoverage: {
      complete: setup.mutationObserver?.mutationObserverCoverage === "complete",
      unobservedMutationSurface: setup.mutationObserver?.unobservedMutationSurface || []
    },
    flagOff: createConditionEvidence({ reasonCode: "setup_not_ready" }),
    flagOn: createConditionEvidence({ reasonCode: "setup_not_ready" }),
    responseShapeChanged: null,
    recommendationChanged: null,
    mutationComparison: null,
    cleanup: null,
    secretsPrinted: false,
    runtimeConnected: false,
    evaluatorConnected: false,
    candidatePolicyConnected: false,
    limitations: [
      "controlled_route_uses_only_loopback_local_supabase",
      "external_provider_stub_required_for_both_conditions"
    ],
    blocker: null,
    verdict: null
  };

  try {
    if (!setupReady) {
      output.blocker = setup.reasonCode;
      return output;
    }
    if (!assertLocalShadowTestWorkdir({ root: ROOT }).safeToRunLocalDatabaseCommands) {
      output.blocker = "local_workdir_safety_rejected";
      return output;
    }
    const runtime = getLocalShadowRuntimeEnvironment({ root: ROOT });
    if (!runtime.ok) {
      output.blocker = runtime.reasonCode;
      output.targetType = runtime.target?.targetType || output.targetType;
      return output;
    }
    output.targetType = runtime.target.targetType;
    output.productionBlocked = true;
    const fixture = loadLocalAnalyzeFixture({ root: ROOT });
    if (!fixture.ok) {
      output.blocker = fixture.reasonCode;
      return output;
    }
    const reset = resetLocalShadowState({ root: ROOT });
    if (!reset.ok) {
      output.blocker = reset.reasonCode;
      return output;
    }

    const comparisonRunId = randomUUID();
    const conditionInput = { fixture, runtime, runDirectory: setup.runDirectory, comparisonRunId };
    output.flagOff = await executeCondition({ ...conditionInput, shadowEnabled: false });
    output.routeInvoked = output.flagOff.routeInvocationCount === 1;
    if (!output.flagOff.completed) {
      output.blocker = output.flagOff.reasonCode;
      return output;
    }
    const flagOnReset = resetLocalShadowState({ root: ROOT });
    if (!flagOnReset.ok) {
      output.blocker = flagOnReset.reasonCode;
      return output;
    }
    output.flagOn = await executeCondition({ ...conditionInput, shadowEnabled: true });
    output.routeInvoked = true;
    if (!output.flagOn.completed) {
      output.blocker = output.flagOn.reasonCode;
      return output;
    }

    output.mutationComparison = compareRouteExecutions(output.flagOff, output.flagOn);
    output.responseShapeChanged = output.mutationComparison.responseShapeChanged;
    output.recommendationChanged = output.mutationComparison.recommendationChanged;
    return output;
  } finally {
    const teardown = await teardownIsolatedShadowRouteEnvironment({ runDirectory: setup.runDirectory || null });
    output.cleanup = teardown.cleanup;
    output.completedAt = new Date().toISOString();
    output.verdict = !output.cleanup?.succeeded
      ? "blocked_cleanup_failure"
      : verdictFor({
          setupReady,
          blocker: output.blocker,
          flagOff: output.flagOff,
          flagOn: output.flagOn,
          comparison: output.mutationComparison || {},
          observerComplete: output.mutationObserverCoverage.complete
        });
    if (!ALLOWED_VERDICTS.has(output.verdict)) output.verdict = "blocked_evidence_incomplete";
    await mkdir(TMP_DIR, { recursive: true });
    await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const output = await runIsolatedShadowRouteComparison();
  console.log(JSON.stringify({ verdict: output.verdict, routeInvoked: output.routeInvoked, secretsPrinted: false }, null, 2));
}
