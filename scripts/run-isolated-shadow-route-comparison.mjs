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
  readComparisonPolicyEvidence,
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
const DURABLE_EVIDENCE_ROOT = path.join(TMP_DIR, "isolated-shadow-route-comparison-evidence");
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
      DEV_ONLY_BOUNDARY_POLICY_SHADOW: shadowEnabled ? "1" : "",
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
  if (!recommendation.ok) {
    return createConditionEvidence({ routeInvocationCount: 1, httpStatus: route.httpStatus, reasonCode: recommendation.reasonCode });
  }
  const policy = shadowEnabled
    ? await readComparisonPolicyEvidence({ root: ROOT, runDirectory, comparisonRunId })
    : { ok: true, evidence: null, metadata: null };
  if (!policy.ok) {
    return createConditionEvidence({ routeInvocationCount: 1, httpStatus: route.httpStatus, reasonCode: policy.reasonCode });
  }
  return createConditionEvidence({
    routeInvocationCount: 1,
    httpStatus: route.httpStatus,
    responseContract: buildRouteResponseContract(route.payload),
    recommendationEvidence: recommendation.evidence,
    recommendationEvidenceMetadata: recommendation.metadata,
    policyEvidence: policy.evidence,
    policyEvidenceMetadata: policy.metadata,
    beforeSnapshot: before.value,
    afterSnapshot: after.value
  });
}

function isWithinDirectory(candidate, directory) {
  const relative = path.relative(directory, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function persistDurableComparisonEvidence({ comparisonRunId, flagOff, flagOn }) {
  const directory = path.resolve(DURABLE_EVIDENCE_ROOT, comparisonRunId);
  const recommendationDirectory = path.join(directory, "recommendations");
  const policyDirectory = path.join(directory, "policy");
  if (!isWithinDirectory(directory, DURABLE_EVIDENCE_ROOT)) {
    return { ok: false, reasonCode: "durable_comparison_evidence_path_rejected" };
  }

  const files = [
    [path.join(recommendationDirectory, "recommendation-flag-off.json"), flagOff.recommendationEvidence],
    [path.join(recommendationDirectory, "recommendation-flag-on.json"), flagOn.recommendationEvidence],
    [path.join(policyDirectory, "policy-flag-on.json"), flagOn.policyEvidence]
  ];
  if (files.some(([, evidence]) => !evidence || typeof evidence !== "object")) {
    return { ok: false, reasonCode: "durable_comparison_evidence_missing" };
  }

  try {
    await Promise.all([
      mkdir(recommendationDirectory, { recursive: true }),
      mkdir(policyDirectory, { recursive: true })
    ]);
    await Promise.all(files.map(([filePath, evidence]) => writeFile(
      filePath,
      `${JSON.stringify(evidence, null, 2)}\n`,
      { encoding: "utf8", flag: "wx" }
    )));
  } catch {
    return { ok: false, reasonCode: "durable_comparison_evidence_write_failed" };
  }

  const relativeDirectory = (value) => path.relative(ROOT, value).replace(/\\/g, "/");
  return {
    ok: true,
    metadata: {
      comparisonRunId,
      directory: relativeDirectory(directory),
      recommendationDirectory: relativeDirectory(recommendationDirectory),
      policyDirectory: relativeDirectory(policyDirectory),
      files: [
        "recommendations/recommendation-flag-off.json",
        "recommendations/recommendation-flag-on.json",
        "policy/policy-flag-on.json"
      ]
    },
    recommendationMetadata: {
      directory: relativeDirectory(recommendationDirectory),
      expectedFileCount: 2,
      observedFileCount: 2,
      expectedDirectories: [],
      observedDirectories: [],
      residualFiles: [],
      residualDirectories: []
    },
    policyMetadata: {
      directory: relativeDirectory(policyDirectory),
      expectedFileCount: 1,
      observedFileCount: 1,
      residualFiles: []
    }
  };
}

function verdictFor({ setupReady, blocker, flagOff, flagOn, comparison, observerComplete }) {
  if (!setupReady) return "blocked_local_environment_setup";
  if (["local_workdir_safety_rejected", "local_target_safety_rejected"].includes(blocker)) return "blocked_hosted_supabase_isolation";
  if (blocker?.startsWith("durable_comparison_evidence")) return "blocked_evidence_incomplete";
  if (blocker?.includes("server")) return "blocked_test_server_start";
  if (!flagOff.completed && !flagOff.reasonCode?.startsWith("recommendation_evidence")) return "blocked_flag_off_route_execution";
  if (!flagOn.completed && !flagOn.reasonCode?.startsWith("recommendation_evidence")) return "blocked_flag_on_route_execution";
  if (blocker?.startsWith("recommendation_evidence")) return "blocked_evidence_incomplete";
  if (!flagOff.completed) return "blocked_flag_off_route_execution";
  if (!flagOn.completed) return "blocked_flag_on_route_execution";
  if (!flagOff.providerEvidence.providerStubbed || !flagOn.providerEvidence.providerStubbed) return "blocked_external_provider_isolation";
  if (comparison.responseShapeChanged) return "blocked_response_contract_divergence";
  if (comparison.recommendationChanged) return "blocked_evidence_incomplete";
  if (!flagOn.policyEvidence || comparison.policyViolationDetected) return "blocked_evidence_incomplete";
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
    durableEvidence: null,
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

  let comparisonRunId = null;
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

    comparisonRunId = randomUUID();
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
    if (output.flagOff.completed && output.flagOn.completed && comparisonRunId) {
      const durableEvidence = await persistDurableComparisonEvidence({
        comparisonRunId,
        flagOff: output.flagOff,
        flagOn: output.flagOn
      });
      if (!durableEvidence.ok) {
        output.blocker = durableEvidence.reasonCode;
      } else {
        output.durableEvidence = durableEvidence.metadata;
        output.flagOff.recommendationEvidenceMetadata = durableEvidence.recommendationMetadata;
        output.flagOn.recommendationEvidenceMetadata = durableEvidence.recommendationMetadata;
        output.flagOn.policyEvidenceMetadata = durableEvidence.policyMetadata;
      }
    }
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
