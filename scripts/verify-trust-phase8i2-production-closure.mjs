import assert from "node:assert/strict";
import fs from "node:fs";

const closure = JSON.parse(
  fs.readFileSync("docs/evidence/trust-phase8i2-production-closure-v1.json", "utf8"),
);
const workflow = fs.readFileSync(
  ".github/workflows/trust-phase8h3-relocation-revalidation.yml",
  "utf8",
);
const worker = fs.readFileSync(
  "scripts/trust-official-source-transport-worker.mjs",
  "utf8",
);
const liveVerifier = fs.readFileSync(
  "scripts/verify-trust-phase8i2b-live-result.mjs",
  "utf8",
);

assert.equal(closure.contract, "trust-phase8i2-production-closure-v1");
assert.equal(closure.phase, "PHASE_8I_2");
assert.equal(closure.result, "PASS");
assert.equal(closure.closure_authority, "PHASE_8I_2_CLOSED");
assert.equal(
  closure.next_authority,
  "PHASE_8I_3_CONFIRMED_TRANSPORT_INCIDENT_HANDOFF",
);

assert.equal(
  closure.rollout_fleet_snapshot_digest,
  "4575d20e983fafe3a882ad26aa362be4ceeec9f286a3d739e4fd92ed2ca98660",
);
assert.match(closure.rollout_fleet_snapshot_digest, /^[0-9a-f]{64}$/);

const byStage = new Map(closure.rollout.map((entry) => [entry.stage, entry]));
const canary = byStage.get("CANARY");
const full1 = byStage.get("FULL_PASS_1");
const early = byStage.get("EARLY_FULL_RECHECK_EXCLUDED");
const full2 = byStage.get("FULL_PASS_2");

assert.ok(canary?.qualified);
assert.equal(canary.run_id, 36363586674);
assert.equal(canary.network_probe_count, 5);
assert.equal(canary.source_observation_count, 10);
assert.equal(canary.incidents_created, 0);
assert.equal(canary.hard_blocked_target_count, 0);

assert.ok(full1?.qualified);
assert.equal(full1.run_id, 36366544747);
assert.equal(full1.network_probe_count, 25);
assert.equal(full1.source_observation_count, 35);
assert.equal(full1.incidents_created, 3);
assert.equal(full1.hard_blocked_target_count, 0);

assert.equal(early?.qualified, false);
assert.equal(early.run_id, 36366943620);
assert.ok(early.gap_from_full_pass_1_seconds < 1800);

assert.ok(full2?.qualified);
assert.equal(full2.run_id, 36370639405);
assert.equal(full2.network_probe_count, 25);
assert.equal(full2.source_observation_count, 35);
assert.ok(full2.gap_from_full_pass_1_seconds >= 1800);
assert.equal(full2.incidents_created, 1);
assert.equal(full2.hard_blocked_target_count, 0);

assert.equal(closure.confirmed_transport_incidents.total, 4);
assert.equal(closure.confirmed_transport_incidents.by_kind.CONFIRMED_REDIRECT, 4);
assert.equal(closure.confirmed_transport_incidents.incidents.length, 4);
assert.equal(
  new Set(
    closure.confirmed_transport_incidents.incidents.map((entry) => entry.incident_id),
  ).size,
  4,
);
assert.ok(
  closure.confirmed_transport_incidents.incidents.every(
    (entry) =>
      entry.confirmed_final_locator === "https://beautyofjoseon.com/" &&
      entry.effective_locator.startsWith("https://beautyofjoseon.com/products/"),
  ),
);

assert.deepEqual(closure.production_readback, {
  transport_observations: 115,
  transport_incidents: 4,
  product_fact_current_rows: 71,
  evidence_source_rows: 40,
  confirmed_relocations: 1,
  reentry_events: 3,
  reentry_checkpoints: 671,
});

assert.deepEqual(closure.authority_invariants, {
  historical_evidence_source_mutations: 0,
  automatic_product_fact_current_mutations: 0,
  automatic_relocation_confirmations: 0,
  transient_failure_promotions: 0,
  transport_to_reentry_bridge_enabled: false,
  semantic_same_inference_from_transport: false,
});

assert.equal(closure.scheduled_monitor.enabled_by_closure_pr, true);
assert.equal(closure.scheduled_monitor.cron_utc, "17 */6 * * *");
assert.equal(closure.scheduled_monitor.cadence_hours, 6);
assert.equal(closure.scheduled_monitor.scope, "full");
assert.equal(closure.scheduled_monitor.fleet_mode, "dynamic_ready_fleet");
assert.equal(closure.scheduled_monitor.same_host_delay_ms, 1000);
assert.equal(closure.scheduled_monitor.host_group_concurrency, 3);
assert.equal(closure.scheduled_monitor.internal_http_retry, false);
assert.equal(closure.scheduled_monitor.authority_mutation, false);

assert.ok(workflow.includes('cron: "17 */6 * * *"'));
assert.ok(
  workflow.includes(
    "if: github.event_name == 'schedule' || inputs.transport_mode == 'canary' || inputs.transport_mode == 'full'",
  ),
);
assert.ok(workflow.includes('"--dynamic-fleet=true"'));
assert.ok(workflow.includes('"--dynamic-full=' + "$" + '{SCHEDULED_RUN}"'));
assert.ok(
  workflow.includes(
    "TRANSPORT_MODE: " + "$" + "{{ github.event_name == 'schedule' && 'full' || inputs.transport_mode }}",
  ),
);
assert.ok(workflow.includes("if: github.event_name != 'schedule'"));

assert.ok(worker.includes('parseOptionalBooleanArg("dynamic-fleet", false)'));
assert.ok(worker.includes("TRANSPORT_DYNAMIC_FLEET_EMPTY"));
assert.ok(worker.includes("dynamicFleet is only valid for full scope"));
assert.ok(liveVerifier.includes('const dynamicFull = argValue("dynamic-full") === "true"'));
assert.ok(liveVerifier.includes("result.uniqueReadyTargetCount"));
assert.ok(liveVerifier.includes("result.readySourceCount"));

for (const forbidden of [
  "request_trust_reentry_v1",
  "process_trust_reentry_event_v1",
  "confirm_trust_official_source_relocation",
  "product_fact_current",
]) {
  assert.ok(
    !worker.includes(forbidden),
    "transport worker must remain authority-neutral: " + forbidden,
  );
}

console.log("TRUST_PHASE8I2_PRODUCTION_CLOSURE_VERIFIED");
