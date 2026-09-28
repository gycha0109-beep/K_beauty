import assert from "node:assert/strict";
import fs from "node:fs";

const evidencePath = "docs/evidence/trust-phase8i3c-production-backfill-v1.json";
const workflowPath = ".github/workflows/trust-phase8h3-relocation-revalidation.yml";
const workerPath = "scripts/trust-transport-drift-handoff-worker.mjs";

const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
const workflow = fs.readFileSync(workflowPath, "utf8");
const worker = fs.readFileSync(workerPath, "utf8");

assert.equal(evidence.contract, "trust-phase8i3c-production-backfill-v1");
assert.equal(evidence.phase, "PHASE_8I_3C");
assert.equal(evidence.result, "PASS");
assert.equal(evidence.watchtower_track, "pipeline-reliability");
assert.equal(evidence.production_migration.version, "20260929045848");
assert.equal(evidence.production_readback.transport_incidents, 4);
assert.equal(evidence.production_readback.drift_cases, 2);
assert.equal(evidence.production_readback.case_incident_links, 4);
assert.equal(evidence.production_readback.evaluations, 0);
assert.equal(evidence.production_readback.source_transport_drift_events, 2);
assert.equal(evidence.production_readback.reentry_events, 5);
assert.equal(evidence.production_readback.product_fact_current, 71);
assert.equal(evidence.production_readback.evidence_sources, 40);
assert.equal(evidence.production_readback.confirmed_relocations, 1);
assert.equal(evidence.production_readback.builder_candidate_count, 0);
assert.equal(evidence.cases.length, 2);
assert.deepEqual(
  evidence.cases.map((row) => row.incident_ids.length).sort((a, b) => a - b),
  [1, 3],
);
for (const row of evidence.cases) {
  assert.equal(row.event_disposition, "REVIEW_REQUIRED");
  assert.equal(row.event_reason_code, "SOURCE_TRANSPORT_DRIFT_REVIEW_REQUIRED");
  assert.ok(row.historical_source_ids.length >= 1);
  assert.equal(row.route_hint, "REDIRECT_QUALIFICATION");
}
assert.equal(evidence.idempotent_replay.candidate_count, 0);
assert.equal(evidence.idempotent_replay.new_case_count, 0);
assert.equal(evidence.idempotent_replay.new_link_count, 0);
assert.equal(evidence.idempotent_replay.new_reentry_event_count, 0);
assert.equal(evidence.idempotent_replay.authority_mutation, false);
assert.equal(evidence.idempotent_replay.current_invalidated, false);

for (const key of [
  "automatic_relocation_confirmation",
  "product_fact_current_mutation",
  "historical_evidence_source_mutation",
  "source_binding_retirement",
  "semantic_same_verdict",
  "recommendation_mutation",
]) {
  assert.equal(evidence.authority_invariants[key], false);
}

for (const required of [
  "transport_drift_mode:",
  "- shadow",
  "- record",
  "transport_drift_live:",
  "github.event_name == 'workflow_dispatch'",
  "inputs.transport_drift_mode == 'shadow'",
  "inputs.transport_drift_mode == 'record'",
  "SUPABASE_URL: https://bygrczggxfuisupcevaz.supabase.co",
  "SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}",
  "ref: ${{ github.sha }}",
  'test "$GITHUB_REF" = "refs/heads/main"',
  'test "$(git rev-parse HEAD)" = "$GITHUB_SHA"',
  "--registry=docs/evidence/trust-phase8i3-transport-drift-evaluation-policy-registry-v1.json",
  '--record="${record}"',
  "verify-trust-phase8i3d-live-result.mjs",
]) {
  assert.ok(workflow.includes(required), "workflow contract missing: " + required);
}

assert.ok(
  workflow.includes(
    "if: github.event_name == 'schedule' || inputs.transport_mode == 'canary' || inputs.transport_mode == 'full'",
  ),
  "Phase 8I-2 scheduler contract changed",
);
assert.ok(
  !workflow.includes(
    "github.event_name == 'schedule' && inputs.transport_drift_mode",
  ),
  "Phase 8I-3 drift evaluation must not be scheduled before manual canary closeout",
);

for (const forbidden of [
  ".from(",
  "admin_confirm_trust_official_source_relocation_v1",
  "admin_confirm_product_fact_v1",
  "product_fact_current",
  "product_evidence_sources",
  "trust_official_source_relocations",
]) {
  assert.equal(
    worker.includes(forbidden),
    false,
    "worker must not contain authority mutation path: " + forbidden,
  );
}

console.log("TRUST_PHASE8I3D_MANUAL_WORKFLOW_VERIFIED");
