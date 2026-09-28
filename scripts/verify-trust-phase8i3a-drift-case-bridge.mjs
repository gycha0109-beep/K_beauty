import assert from "node:assert/strict";
import fs from "node:fs";

const blueprintPath = "docs/evidence/trust-phase8i3a-drift-case-bridge-db-blueprint-v1.sql";
const dryRunPath = "docs/evidence/trust-phase8i3a-drift-case-bridge-dry-run-v1.json";
const blueprint = fs.readFileSync(blueprintPath, "utf8");
const dryRun = JSON.parse(fs.readFileSync(dryRunPath, "utf8"));

for (const token of [
  "trust_official_source_transport_drift_cases",
  "trust_official_source_transport_drift_case_incidents",
  "trust_official_source_transport_drift_evaluations",
  "SOURCE_TRANSPORT_DRIFT",
  "SOURCE_TRANSPORT_DRIFT_REVIEW_REQUIRED",
  "trust_phase8i3_case_candidates_v1",
  "build_trust_official_source_transport_drift_cases_v1",
  "enqueue_trust_official_source_transport_drift_cases_v1",
  "get_trust_official_source_transport_drift_case_v1",
  "get_trust_official_source_transport_drift_cases_v1",
  "record_trust_official_source_transport_drift_evaluation_v1",
  "episode_anchor_probe_group_id",
  "first_probe_group_id",
  "REDIRECT_QUALIFICATION",
  "MISSING_REDISCOVERY",
  "TRANSPORT_SIGNAL_ONLY_NO_SEMANTIC_OR_RELOCATION_AUTHORITY",
  "READY_FOR_8I4",
  "POLICY_REQUIRED",
  "transport_signal_only",
  "trust_phase7c_legacy_subject_scope_ready_v1",
  "LEGACY_IDENTITY_SNAPSHOT_PRESERVED",
]) {
  assert.ok(blueprint.includes(token), `missing Phase 8I-3A contract token: ${token}`);
}

for (const table of [
  "trust_official_source_transport_drift_cases",
  "trust_official_source_transport_drift_case_incidents",
  "trust_official_source_transport_drift_evaluations",
]) {
  assert.ok(
    blueprint.includes(`alter table public.${table} enable row level security`),
    `RLS missing: ${table}`,
  );
}

assert.ok(
  blueprint.includes(
    "from public, anon, authenticated, service_role;",
  ),
  "Phase 8I-3 tables/functions must explicitly revoke broad/direct access",
);

for (const fn of [
  "public.trust_phase8i3_case_candidates_v1",
  "public.build_trust_official_source_transport_drift_cases_v1",
  "public.enqueue_trust_official_source_transport_drift_cases_v1",
  "public.get_trust_official_source_transport_drift_case_v1",
  "public.get_trust_official_source_transport_drift_cases_v1",
  "public.record_trust_official_source_transport_drift_evaluation_v1",
  "public.request_trust_reentry_v1",
  "public.process_trust_reentry_event_v1",
]) {
  const lowerBlueprint = blueprint.toLowerCase();
  const needle = ("create or replace function " + fn).toLowerCase();
  const pos = lowerBlueprint.indexOf(needle);
  assert.ok(pos >= 0, `function missing: ${fn}`);
  const next = lowerBlueprint.indexOf("create or replace function ", pos + 1);
  const segment = blueprint.slice(pos, next < 0 ? blueprint.length : next);
  assert.match(segment, /security definer/i, `SECURITY DEFINER missing: ${fn}`);
  assert.match(segment, /set search_path (?:=|TO) ''/i, `empty search_path missing: ${fn}`);
}

for (const forbidden of [
  /update\s+public\.product_evidence_sources/i,
  /delete\s+from\s+public\.product_evidence_sources/i,
  /update\s+public\.product_fact_current/i,
  /delete\s+from\s+public\.product_fact_current/i,
  /insert\s+into\s+public\.trust_official_source_relocations/i,
  /update\s+public\.trust_official_source_relocations/i,
  /admin_confirm_trust_official_source_relocation_v1\s*\(/i,
  /admin_confirm_product_fact_v1\s*\(/i,
]) {
  assert.equal(forbidden.test(blueprint), false, `forbidden authority mutation path: ${forbidden}`);
}

assert.match(
  blueprint,
  /if v_event\.event_type in \('SOURCE_CHANGED','FORMULATION_CHANGED','POLICY_CHANGED','REGISTRY_CHANGED','SOURCE_TRANSPORT_DRIFT'\) then/,
);
assert.ok(
  blueprint.includes(
    "'phase',case when v_event.event_type='SOURCE_TRANSPORT_DRIFT' then '8I-3' else '6-A' end",
  ),
);
assert.ok(
  blueprint.includes(
    "'transport_signal_only',v_event.event_type='SOURCE_TRANSPORT_DRIFT'",
  ),
);
assert.ok(
  blueprint.includes(
    "'SOURCE_CHANGED','FORMULATION_CHANGED','POLICY_CHANGED','REGISTRY_CHANGED','SOURCE_TRANSPORT_DRIFT','MANUAL_RETRY'",
  ),
);

assert.equal(dryRun.contract, "trust-phase8i3a-drift-case-bridge-dry-run-v1");
assert.equal(dryRun.validation_mode, "PRODUCTION_SCHEMA_TRANSACTIONAL_DRY_RUN_ROLLED_BACK");
assert.equal(dryRun.production_mutation, "NONE");
assert.equal(dryRun.result, "PASS");

assert.deepEqual(dryRun.prestate, {
  transport_incidents: 4,
  reentry_events: 3,
  source_transport_drift_events: 0,
  product_fact_current: 71,
  evidence_sources: 40,
  confirmed_relocations: 1,
});

assert.equal(dryRun.builder_readback.candidate_count, 2);
assert.equal(dryRun.builder_readback.cases.length, 2);
const rice = dryRun.builder_readback.cases.find(
  (entry) => entry.product_id === "25b2763f-529f-4b2e-a436-2e0776279c55",
);
const aqua = dryRun.builder_readback.cases.find(
  (entry) => entry.product_id === "765b3ca1-6927-49b0-bee6-4138d03dd915",
);
assert.ok(rice);
assert.ok(aqua);
assert.equal(rice.incident_count, 3);
assert.equal(rice.source_ids.length, 3);
assert.equal(aqua.incident_count, 1);
assert.equal(aqua.source_ids.length, 1);
assert.equal(rice.route_hint, "REDIRECT_QUALIFICATION");
assert.equal(aqua.route_hint, "REDIRECT_QUALIFICATION");
assert.match(rice.case_key, /^[0-9a-f]{64}$/);
assert.match(aqua.case_key, /^[0-9a-f]{64}$/);
assert.notEqual(rice.case_key, aqua.case_key);

assert.deepEqual(dryRun.first_enqueue, {
  candidate_count: 2,
  new_case_count: 2,
  existing_case_count: 0,
  new_link_count: 4,
  new_reentry_event_count: 2,
  blocked_count: 0,
  authority_mutation: false,
  current_invalidated: false,
});

assert.equal(dryRun.first_enqueue_readback.case_count, 2);
assert.equal(dryRun.first_enqueue_readback.link_count, 4);
assert.equal(dryRun.first_enqueue_readback.source_transport_drift_event_count, 2);
assert.equal(dryRun.first_enqueue_readback.source_transport_drift_review_required_count, 2);
assert.equal(dryRun.first_enqueue_readback.event_disposition, "REVIEW_REQUIRED");
assert.equal(
  dryRun.first_enqueue_readback.reason_code,
  "SOURCE_TRANSPORT_DRIFT_REVIEW_REQUIRED",
);
assert.equal(dryRun.first_enqueue_readback.phase, "8I-3");
assert.equal(dryRun.first_enqueue_readback.transport_signal_only, true);
assert.equal(dryRun.first_enqueue_readback.product_fact_current, 71);
assert.equal(dryRun.first_enqueue_readback.evidence_sources, 40);
assert.equal(dryRun.first_enqueue_readback.confirmed_relocations, 1);

assert.deepEqual(dryRun.second_enqueue, {
  candidate_count: 0,
  new_case_count: 0,
  existing_case_count: 0,
  new_link_count: 0,
  new_reentry_event_count: 0,
  blocked_count: 0,
  authority_mutation: false,
  current_invalidated: false,
});

assert.equal(dryRun.evaluation_idempotency.first.idempotent, false);
assert.equal(dryRun.evaluation_idempotency.second.idempotent, true);
assert.equal(dryRun.evaluation_idempotency.first.result_kind, "HOLD");
assert.equal(dryRun.evaluation_idempotency.second.result_kind, "HOLD");
assert.equal(dryRun.evaluation_idempotency.evaluation_count, 1);

assert.deepEqual(dryRun.rollback_readback, {
  phase8i3_tables_absent: true,
  transport_incidents: 4,
  reentry_events: 3,
  source_transport_drift_events: 0,
  product_fact_current: 71,
  evidence_sources: 40,
  confirmed_relocations: 1,
  event_constraint_restored_without_source_transport_drift: true,
});

console.log("TRUST_PHASE8I3A_DRIFT_CASE_BRIDGE_VERIFIED");
