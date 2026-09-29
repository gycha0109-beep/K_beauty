import assert from "node:assert/strict";
import fs from "node:fs";

const closeout = JSON.parse(
  fs.readFileSync("docs/evidence/trust-phase8i3d-production-closeout-v1.json", "utf8"),
);
const scheduler = JSON.parse(
  fs.readFileSync("docs/evidence/trust-phase8i3e-scheduler-integration-v1.json", "utf8"),
);
const workflow = fs.readFileSync(
  ".github/workflows/trust-phase8h3-relocation-revalidation.yml",
  "utf8",
);
const enqueueWorker = fs.readFileSync(
  "scripts/trust-transport-drift-case-enqueue.mjs",
  "utf8",
);
const evaluationWorker = fs.readFileSync(
  "scripts/trust-transport-drift-handoff-worker.mjs",
  "utf8",
);

assert.equal(closeout.contract, "trust-phase8i3d-production-closeout-v1");
assert.equal(closeout.phase, "PHASE_8I_3D");
assert.equal(closeout.result, "PASS");
assert.equal(closeout.watchtower_track, "pipeline-reliability");
assert.equal(closeout.manual_runs.shadow.conclusion, "success");
assert.equal(closeout.manual_runs.shadow.evaluation_writes_after_run, 0);
assert.equal(closeout.manual_runs.record.conclusion, "success");
assert.equal(closeout.manual_runs.record.evaluation_writes_after_run, 2);
assert.equal(closeout.manual_runs.stable_replay.conclusion, "success");
assert.equal(closeout.manual_runs.stable_replay.case_count, 2);
assert.equal(closeout.manual_runs.stable_replay.evaluated_count, 0);
assert.equal(closeout.manual_runs.stable_replay.skipped_count, 2);
assert.equal(closeout.manual_runs.stable_replay.recorded_count, 0);
assert.equal(
  closeout.manual_runs.stable_replay.stable_skip_reason,
  "HOLD_STABLE_UNTIL_POLICY_OR_NEW_CASE",
);
assert.equal(closeout.production_readback.evaluations, 2);
assert.equal(closeout.production_readback.product_fact_current, 71);
assert.equal(closeout.production_readback.evidence_sources, 40);
assert.equal(closeout.production_readback.confirmed_relocations, 1);
assert.equal(closeout.evaluation_rows.length, 2);
for (const row of closeout.evaluation_rows) {
  assert.equal(row.policy_version, "v1");
  assert.equal(row.evaluation_mode, "REDISCOVERY");
  assert.equal(row.result_kind, "HOLD");
}
assert.equal(closeout.stable_replay_invariants.evaluation_count_before, 2);
assert.equal(closeout.stable_replay_invariants.evaluation_count_after, 2);
assert.equal(closeout.stable_replay_invariants.duplicate_evaluation_writes, 0);
assert.equal(closeout.stable_replay_invariants.hold_gate_stable, true);
assert.equal(closeout.stable_replay_invariants.authority_mutation, false);

for (const key of [
  "automatic_relocation_confirmation",
  "product_fact_current_mutation",
  "product_fact_instance_mutation",
  "confirmation_mutation",
  "historical_evidence_source_mutation",
  "source_binding_retirement_or_replacement",
  "recommendation_mutation",
  "semantic_same_or_changed_resolution",
]) {
  assert.equal(closeout.authority_invariants[key], false);
}

assert.equal(scheduler.contract, "trust-phase8i3e-scheduler-integration-v1");
assert.equal(scheduler.phase, "PHASE_8I_3E");
assert.equal(scheduler.result, "PASS");
assert.equal(scheduler.decision, "INTEGRATE");
assert.equal(scheduler.watchtower_track, "pipeline-reliability");
assert.equal(scheduler.prerequisite.result, "PASS");
assert.equal(scheduler.schedule_contract.cadence_cron, "17 */6 * * *");
assert.deepEqual(scheduler.schedule_contract.sequencing, [
  "verify",
  "transport_live",
  "transport_drift_scheduled",
]);
assert.equal(scheduler.schedule_contract.evaluation_record, true);
assert.equal(scheduler.schedule_contract.retry_interval_hours, 6);
assert.equal(scheduler.authority_invariants.transport_operational_observation_only, true);
assert.equal(scheduler.authority_invariants.automatic_phase8i4_resolution, false);

for (const required of [
  'schedule:',
  'cron: "17 */6 * * *"',
  "transport_drift_scheduled:",
  "if: github.event_name == 'schedule'",
  "needs: [verify, transport_live]",
  "trust-transport-drift-case-enqueue.mjs",
  "verify-trust-phase8i3e-enqueue-result.mjs",
  "--registry=docs/evidence/trust-phase8i3-transport-drift-evaluation-policy-registry-v1.json",
  "--record=true",
  "verify-trust-phase8i3d-live-result.mjs",
  "--mode=record",
  "trust-phase8i3e-scheduled-",
]) {
  assert.ok(workflow.includes(required), "scheduler workflow contract missing: " + required);
}

assert.ok(
  workflow.includes(
    "if: github.event_name == 'schedule' || inputs.transport_mode == 'canary' || inputs.transport_mode == 'full'",
  ),
  "scheduled full transport contract changed",
);
assert.ok(
  workflow.includes(
    "if: github.event_name == 'workflow_dispatch' && (inputs.transport_drift_mode == 'shadow' || inputs.transport_drift_mode == 'record')",
  ),
  "manual Phase 8I-3D job must remain manual-only",
);

assert.ok(
  enqueueWorker.includes(
    '"enqueue_trust_official_source_transport_drift_cases_v1"',
  ),
);
for (const forbidden of [
  "admin_confirm_trust_official_source_relocation_v1",
  "admin_confirm_product_fact_v1",
  "record_trust_official_source_relocation",
]) {
  assert.equal(
    enqueueWorker.includes(forbidden),
    false,
    "enqueue worker contains forbidden authority path: " + forbidden,
  );
  assert.equal(
    evaluationWorker.includes(forbidden),
    false,
    "evaluation worker contains forbidden authority path: " + forbidden,
  );
}

assert.ok(
  evaluationWorker.includes(
    '"NO_AUTOMATIC_RELOCATION_OR_PRODUCT_FACT_MUTATION"',
  ),
);

console.log("TRUST_PHASE8I3E_SCHEDULER_INTEGRATION_VERIFIED");
