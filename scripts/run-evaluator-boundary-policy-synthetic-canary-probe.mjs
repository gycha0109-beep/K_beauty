import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  compareEvaluatorBoundaryPolicySyntheticProbes,
  evaluateEvaluatorBoundaryPolicyCanaryGate,
  evaluateEvaluatorBoundaryPolicyKillSwitchPropagation
} from "../lib/evaluator-boundary-policy-runtime-observability.js";
import { writeSyntheticCanaryEvidenceExclusive } from "./lib/evaluator-boundary-policy-synthetic-canary-evidence.mjs";

function probeSummary(result) {
  return {
    requestCount: result.requestCount,
    errorCount: result.errorCount,
    p95LatencyMs: result.p95LatencyMs,
    databaseMutationCount: result.databaseMutationCount,
    storageMutationCount: result.storageMutationCount,
    runtimeTelemetry: result.runtimeTelemetry
  };
}

export function buildEvaluatorBoundaryPolicySyntheticCanaryEvidence(input = {}) {
  const comparison = compareEvaluatorBoundaryPolicySyntheticProbes({
    baseline: input.baseline,
    canary: input.canary
  });
  if (!comparison.valid) {
    return {
      evidenceType: "candidate_policy_synthetic_canary_probe",
      verdict: "blocked_probe_evidence_incomplete",
      stopReasons: [comparison.reasonCode],
      rollbackVerdict: "rollback_not_verified"
    };
  }
  const runtimeStateValid =
    input.baseline.runtimeTelemetry.runtimeEnabled === false &&
    input.baseline.runtimeTelemetry.runtimeExecuted === false &&
    input.baseline.runtimeTelemetry.runtimeConnected === false &&
    input.canary.runtimeTelemetry.runtimeEnabled === true &&
    input.canary.runtimeTelemetry.runtimeExecuted === true &&
    input.canary.runtimeTelemetry.runtimeConnected === true;
  if (!runtimeStateValid) {
    return {
      evidenceType: "candidate_policy_synthetic_canary_probe",
      verdict: "blocked_probe_evidence_incomplete",
      stopReasons: ["runtime_state_contract_invalid"],
      rollbackVerdict: "rollback_not_verified"
    };
  }

  const canaryGate = evaluateEvaluatorBoundaryPolicyCanaryGate({
    telemetry: input.canary.runtimeTelemetry,
    comparison,
    slo: {
      baselineErrorRate: comparison.baselineErrorRate,
      canaryErrorRate: comparison.canaryErrorRate,
      maxErrorRateIncrease: input.slo?.maxErrorRateIncrease,
      baselineP95LatencyMs: comparison.baselineP95LatencyMs,
      canaryP95LatencyMs: comparison.canaryP95LatencyMs,
      maxP95LatencyIncreaseMs: input.slo?.maxP95LatencyIncreaseMs
    }
  });
  const propagation = evaluateEvaluatorBoundaryPolicyKillSwitchPropagation(input.killSwitchPropagation);
  const stopReasons = Array.from(new Set([
    ...canaryGate.stopReasons,
    ...(propagation.propagated ? [] : [propagation.stopReason])
  ]));
  const rollbackVerdict = propagation.propagated
    ? (canaryGate.stopRequired ? "rollback_verified" : "rollback_capability_verified")
    : "rollback_not_verified";

  return {
    evidenceType: "candidate_policy_synthetic_canary_probe",
    schemaVersion: "2026-07-14.phase46.3b",
    fixtureContractId: input.baseline.fixtureContractId,
    sameSyntheticFixture: true,
    baseline: probeSummary(input.baseline),
    canary: probeSummary(input.canary),
    comparison: {
      responseSchemaChanged: comparison.responseSchemaChanged,
      unexpectedRecommendationDelta: comparison.unexpectedRecommendationDelta,
      shadowAddedDbMutationDelta: comparison.shadowAddedDbMutationDelta,
      shadowAddedStorageMutationDelta: comparison.shadowAddedStorageMutationDelta,
      baselineErrorRate: comparison.baselineErrorRate,
      canaryErrorRate: comparison.canaryErrorRate,
      baselineP95LatencyMs: comparison.baselineP95LatencyMs,
      canaryP95LatencyMs: comparison.canaryP95LatencyMs
    },
    canaryRuntimeExecuted: input.canary.runtimeTelemetry.runtimeExecuted,
    killSwitchPropagation: propagation,
    stopRequired: stopReasons.length > 0,
    stopReasons,
    rollbackVerdict,
    verdict: !propagation.observationWindowComplete
      ? "blocked_probe_evidence_incomplete"
      : propagation.propagated && !canaryGate.stopRequired
      ? "synthetic_canary_probe_contract_passed"
      : propagation.propagated
        ? "canary_stopped_rollback_verified"
        : "blocked_kill_switch_not_propagated",
    productionRuntimeActivated: false,
    hostedEnvironmentChanged: false,
    forbiddenFieldDetected: false
  };
}

async function main() {
  const [inputPath, runIdFlag, runId, ...unexpectedArguments] = process.argv.slice(2);
  if (!inputPath) throw new Error("aggregate_probe_input_path_required");
  if (runIdFlag !== "--run-id" || !runId || unexpectedArguments.length > 0) {
    throw new Error("synthetic_canary_run_id_required");
  }
  const input = JSON.parse(await readFile(path.resolve(inputPath), "utf8"));
  const evidence = buildEvaluatorBoundaryPolicySyntheticCanaryEvidence(input);
  const evidencePath = await writeSyntheticCanaryEvidenceExclusive({ runId, evidence });
  console.log(JSON.stringify({ verdict: evidence.verdict, stopRequired: evidence.stopRequired, evidencePath }));
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  await main();
}
