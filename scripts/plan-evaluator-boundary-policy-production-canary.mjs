import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const OUTPUT_PATH = path.join(process.cwd(), "tmp", "evaluator-boundary-policy-production-canary-deployment-plan.json");
const FLAGS = Object.freeze({
  enable: "ENABLE_EVALUATOR_BOUNDARY_CANDIDATE_POLICY_RUNTIME",
  disable: "DISABLE_EVALUATOR_BOUNDARY_CANDIDATE_POLICY_RUNTIME",
  scope: "EVALUATOR_BOUNDARY_CANDIDATE_POLICY_CANARY_SCOPE",
  deployment: "EVALUATOR_BOUNDARY_CANDIDATE_POLICY_CANARY_DEPLOYMENT"
});

function stage(id, environmentScope, expectedRuntimeState, requiredFlags, checks) {
  return { id, environmentScope, expectedRuntimeState, requiredFlags, checks };
}

export function buildEvaluatorBoundaryPolicyProductionCanaryDryRunPlan() {
  return {
    evidenceType: "candidate_policy_production_canary_deployment_dry_run",
    schemaVersion: "2026-07-14.phase46.3c",
    dryRun: true,
    platform: "vercel",
    sourceControl: "github",
    primaryProductionPath: "main_push",
    previewValidationPath: "non_main_branch_push",
    manualPreviewPromotion: "exceptional_requires_separate_approval",
    actualDeploymentApplied: false,
    environmentChanged: false,
    trafficChanged: false,
    weightedTrafficSplit: "unconfirmed_not_assumed",
    stages: [
      stage("baseline", "production", { runtimeEnabled: false, runtimeExecuted: false, runtimeConnected: false }, [
        { name: FLAGS.enable, state: "absent_or_off" },
        { name: FLAGS.disable, state: "absent_or_off" }
      ], ["run_synthetic_probe_baseline", "verify_production_observability_contract"]),
      stage("preview_canary", "preview", { runtimeEnabled: true, runtimeExecuted: true, runtimeConnected: true }, [
        { name: FLAGS.enable, state: "enabled" },
        { name: FLAGS.disable, state: "absent_or_off" },
        { name: FLAGS.scope, state: "deployment_canary" },
        { name: FLAGS.deployment, state: "enabled" }
      ], ["run_synthetic_probe_canary", "verify_kill_switch_propagation", "verify_production_observability_contract"]),
      stage("production_approval", "production", { runtimeEnabled: true, runtimeExecuted: true, runtimeConnected: true }, [
        { name: FLAGS.enable, state: "enabled_after_separate_approval" },
        { name: FLAGS.disable, state: "absent_or_off" },
        { name: FLAGS.scope, state: "deployment_canary" },
        { name: FLAGS.deployment, state: "enabled" }
      ], ["confirm_isolated_canary_scope", "main_push_creates_production_deployment", "run_synthetic_probe_and_observability_checks"]),
      stage("disable", "production", { runtimeEnabled: false, runtimeExecuted: false, runtimeConnected: false }, [
        { name: FLAGS.disable, state: "enabled" }
      ], ["verify_kill_switch_propagation_before_timeout", "confirm_existing_recommendation_path"]),
      stage("rollback", "production", { runtimeEnabled: false, runtimeExecuted: false, runtimeConnected: false }, [
        { name: FLAGS.disable, state: "enabled" }
      ], ["return_to_previous_known_good_vercel_deployment", "confirm_no_db_storage_or_schema_rollback_required"])
    ],
    verifierOrder: [
      "run-evaluator-boundary-policy-synthetic-canary-probe",
      "verify-evaluator-boundary-policy-kill-switch-propagation",
      "verify-evaluator-boundary-policy-production-observability"
    ],
    stopConditions: [
      "safety_violation_count_nonzero",
      "unexpected_receiver_exposure_nonzero",
      "response_schema_changed",
      "unexpected_recommendation_delta",
      "unexpected_db_or_storage_delta",
      "forbidden_telemetry_field",
      "baseline_slo_exceeded",
      "disable_runtime_execution_violation",
      "kill_switch_propagation_timeout",
      "canary_scope_not_isolated"
    ],
    rollback: {
      firstAction: "enable_disable_kill_switch",
      propagationTimeoutRequired: true,
      deploymentFallback: "previous_known_good_vercel_deployment",
      exactCommandAndAuthorization: "unconfirmed_requires_separate_approval"
    },
    constraints: [
      "no_vercel_or_github_api_calls",
      "no_deployment_or_environment_changes",
      "no_weighted_traffic_split_assumption",
      "no_project_team_token_or_secret_values"
    ]
  };
}

async function main() {
  const plan = buildEvaluatorBoundaryPolicyProductionCanaryDryRunPlan();
  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(plan, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  console.log(JSON.stringify({ evidenceType: plan.evidenceType, dryRun: plan.dryRun }));
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  await main();
}
