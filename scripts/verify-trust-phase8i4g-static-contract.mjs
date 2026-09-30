import assert from "node:assert/strict";
import fs from "node:fs";
import {
  buildReadOnlyCanarySnapshot,
  classifyRealCanaryProvenance,
  selectFirstRealCanaryCandidate,
  verifyCanaryProtectedAuthorityInvariant,
  verifyCanaryGroupedLineage,
  verifyCanaryIdempotentReplay,
  verifyPhase8h3CanaryHandoff,
} from "../lib/trust/official-source-grouped-relocation-canary.mjs";

const scheduled = JSON.parse(
  fs.readFileSync(
    "docs/evidence/trust-phase8i3e-first-scheduled-production-observation-v1.json",
    "utf8",
  ),
);
const closeout = JSON.parse(
  fs.readFileSync(
    "docs/evidence/trust-phase8i4f-production-closeout-v1.json",
    "utf8",
  ),
);
const contract = fs.readFileSync(
  "docs/evidence/trust-phase8i4g-real-canary-contract-v1.md",
  "utf8",
);
const snapshotter = fs.readFileSync(
  "scripts/trust-phase8i4g-canary-snapshot.mjs",
  "utf8",
);
const readBoundaryMigration = fs.readFileSync(
  "supabase/migrations/20260930090756_trust_phase8i4g_canary_read_boundary_v1.sql",
  "utf8",
);
const incidentReadBoundaryMigration = fs.readFileSync(
  "supabase/migrations/20260930212000_trust_phase8i4g_transport_incident_read_boundary_v1.sql",
  "utf8",
);
const replayIdempotencyMigration = fs.readFileSync(
  "supabase/migrations/20260930214000_trust_phase8i4g_grouped_replay_idempotency_v1.sql",
  "utf8",
);
const workflow = fs.readFileSync(
  ".github/workflows/trust-phase8h3-relocation-revalidation.yml",
  "utf8",
);
const adminService = fs.readFileSync(
  "lib/admin/trust-grouped-relocation.js",
  "utf8",
);
const workbench = fs.readFileSync(
  "app/admin/products/trust/relocations/TrustGroupedRelocationWorkbench.js",
  "utf8",
);

assert.equal(scheduled.result, "PASS");
assert.equal(scheduled.workflow?.run_id, 36527329922);
assert.equal(scheduled.workflow?.event, "schedule");
assert.equal(scheduled.workflow?.transport_live, "SUCCESS");
assert.equal(scheduled.workflow?.transport_drift_scheduled, "SUCCESS");
assert.equal(scheduled.production_readback_after_run?.ready_for_8i4, 0);
assert.equal(scheduled.production_readback_after_run?.grouped_relocations, 0);
assert.equal(scheduled.authority?.automatic_relocation, false);
assert.equal(scheduled.authority?.automatic_grouped_confirmation, false);

assert.equal(closeout.result, "PASS");
assert.equal(closeout.repository?.pr, 915);
assert.equal(
  closeout.repository?.merge_sha,
  "a10df31e73f4ad453eb5f64b4057c44cf40fe5a4",
);
assert.equal(closeout.operator_boundary?.browser_authority_payload, false);
assert.equal(
  closeout.operator_boundary?.explicit_admin_confirmation_only,
  true,
);
assert.equal(closeout.production_readback?.ready_for_8i4, 0);
assert.equal(closeout.production_readback?.grouped_relocations, 0);

for (const required of [
  "WAITING_FOR_REAL_READY_FOR_8I4",
  "Detection is read-only. Detection is not approval.",
  "Single-canary blast radius",
  "Product Fact Current",
  "historical Product Evidence Source",
  "Recommendation authority",
  "semantic SAME/CHANGED",
  "Idempotent replay",
  "Phase 8H-3 downstream handoff",
]) {
  assert.ok(contract.includes(required), `8I-4G contract missing: ${required}`);
}

const realA = {
  evaluation_id: "00000000-0000-4000-8000-000000000001",
  case_id: "11111111-1111-4111-8111-111111111111",
  request_id:
    "phase8i3:phase8i3e-scheduled-40000000001-1:11111111-1111-4111-8111-111111111111",
  result_kind: "READY_FOR_8I4",
  candidate_locator: "https://example.com/new-a",
  result_payload: {
    qualified_historical_source_id:
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  },
  created_at: "2026-09-29T01:00:00Z",
};
const realB = {
  ...realA,
  evaluation_id: "00000000-0000-4000-8000-000000000002",
  case_id: "22222222-2222-4222-8222-222222222222",
  request_id:
    "phase8i3:phase8i3e-scheduled-40000000002-1:22222222-2222-4222-8222-222222222222",
  created_at: "2026-09-29T02:00:00Z",
};
const manual = {
  ...realA,
  evaluation_id: "00000000-0000-4000-8000-000000000003",
  request_id:
    "phase8i3:phase8i3d-record-40000000003-1:11111111-1111-4111-8111-111111111111",
};

assert.equal(classifyRealCanaryProvenance(realA).eligible, true);
assert.equal(classifyRealCanaryProvenance(manual).eligible, false);
assert.equal(
  selectFirstRealCanaryCandidate([realB, manual, realA])?.evaluation_id,
  realA.evaluation_id,
);

const waiting = buildReadOnlyCanarySnapshot({
  capturedAt: "2026-09-29T00:00:00Z",
  evaluations: [manual],
  groupedRelocations: [],
  caseLineage: {},
  counts: {},
});
assert.equal(waiting.state, "WAITING_FOR_REAL_READY_FOR_8I4");
assert.equal(waiting.candidate_count, 0);
assert.equal(waiting.automatic_confirmation, false);

const detected = buildReadOnlyCanarySnapshot({
  capturedAt: "2026-09-29T00:00:00Z",
  evaluations: [realB, realA],
  groupedRelocations: [],
  caseLineage: {
    [realA.case_id]: {
      product_id: "p1",
      subject_id: "u1",
      source_ids: ["s2", "s1"],
      incident_ids: ["i2", "i1"],
    },
    [realB.case_id]: {
      product_id: "p2",
      subject_id: "u2",
      source_ids: ["s3", "s4"],
      incident_ids: ["i3", "i4"],
    },
  },
  counts: {},
});
assert.equal(
  detected.state,
  "REAL_READY_DETECTED_REQUIRES_ADMIN_PREFLIGHT",
);
assert.equal(detected.candidates[0].canary_rank, 1);
assert.equal(
  detected.candidates[1].state,
  "QUEUED_BEHIND_FIRST_REAL_CANARY",
);

const protectedState = {
  product_fact_instances: 71,
  product_fact_current: 71,
  product_fact_confirmations: 71,
  evidence_sources: 40,
  evidence_subject_bindings: 40,
  recommendation_logs: 1300,
  historical_evidence_source_digest: "a",
  historical_evidence_binding_digest: "b",
  product_fact_scope_digest: "c",
  recommendation_scope_digest: "d",
};
const before = {
  protected: protectedState,
  candidate: {
    historical_source_count: 3,
    incident_count: 3,
    old_binding_state: "resolved",
  },
  authority: {
    relocation_count: 1,
    grouped_relocation_count: 0,
    grouped_source_count: 0,
    grouped_incident_count: 0,
  },
};
const after = {
  protected: { ...protectedState },
  candidate: {
    historical_source_count: 3,
    incident_count: 3,
    old_binding_state: "retired",
    replacement_binding_state: "resolved",
  },
  authority: {
    relocation_count: 2,
    grouped_relocation_count: 1,
    grouped_source_count: 3,
    grouped_incident_count: 3,
  },
};
assert.equal(
  verifyCanaryProtectedAuthorityInvariant(before, after).result,
  "PASS",
);

const lineage = {
  sources: [{ source_id: "s1" }, { source_id: "s2" }, { source_id: "s3" }],
  incidents: [
    { incident_id: "i1", source_id: "s1" },
    { incident_id: "i2", source_id: "s2" },
    { incident_id: "i3", source_id: "s3" },
  ],
};
assert.equal(
  verifyCanaryGroupedLineage({
    expectedSourceIds: ["s3", "s1", "s2"],
    expectedIncidentIds: ["i3", "i2", "i1"],
    lineage,
  }).result,
  "PASS",
);

const firstResult = {
  status: "confirmed",
  groupId: "g1",
  relocationId: "r1",
  replacementBindingId: "b2",
  replacementReviewId: "rv2",
};
const replayResult = { ...firstResult, idempotent: true };
const replayCounts = {
  relocation_count: 2,
  grouped_relocation_count: 1,
  grouped_source_count: 3,
  grouped_incident_count: 3,
  product_source_binding_count: 134,
  official_source_review_count: 20,
  product_fact_instances: 71,
  product_fact_current: 71,
  product_fact_confirmations: 71,
  evidence_sources: 40,
  evidence_subject_bindings: 40,
  recommendation_logs: 1300,
};
assert.equal(
  verifyCanaryIdempotentReplay({
    firstResult,
    replayResult,
    beforeReplay: replayCounts,
    afterReplay: { ...replayCounts },
  }).result,
  "PASS",
);

assert.equal(
  verifyPhase8h3CanaryHandoff({
    relocation: {
      status: "confirmed",
      relocation_id: "r1",
      product_id: "p1",
      subject_id: "s1",
    },
    downstream: {
      relocation_id: "r1",
      product_id: "p1",
      subject_id: "s1",
      state: "READY_FOR_REVALIDATION",
      automatic_semantic_authority: false,
    },
  }).result,
  "PASS",
);

for (const forbidden of [
  "admin_confirm_trust_official_source_grouped_relocation_v1",
  "admin_confirm_trust_official_source_relocation_v1",
]) {
  assert.equal(
    snapshotter.includes(forbidden),
    false,
    `read-only snapshotter contains forbidden confirmation path: ${forbidden}`,
  );
}

assert.equal(
  snapshotter.includes(".from("),
  false,
  "scheduled canary snapshotter must not bypass the governed read RPC",
);
assert.ok(
  snapshotter.includes('"get_trust_phase8i4g_canary_snapshot_v1"'),
  "scheduled canary snapshotter must use the governed read RPC",
);

for (const required of [
  "create schema if not exists private",
  "private.get_trust_phase8i4g_canary_snapshot_internal_v1",
  "security definer",
  "public.get_trust_phase8i4g_canary_snapshot_v1",
  "security invoker",
  "current_user <> 'service_role'",
  "set search_path = ''",
  "READ_ONLY_SERVICE_ROLE_RPC_NO_AUTHORITY_MUTATION",
  "revoke all on function private.get_trust_phase8i4g_canary_snapshot_internal_v1(integer)",
  "revoke all on function public.get_trust_phase8i4g_canary_snapshot_v1(integer)",
  "grant execute on function private.get_trust_phase8i4g_canary_snapshot_internal_v1(integer)",
  "grant execute on function public.get_trust_phase8i4g_canary_snapshot_v1(integer)",
  "to service_role",
]) {
  assert.ok(
    readBoundaryMigration.toLowerCase().includes(required.toLowerCase()),
    `8I-4G read boundary migration missing: ${required}`,
  );
}
for (const forbidden of [
  "grant select",
  "admin_confirm_trust_official_source_grouped_relocation_v1",
  "admin_confirm_trust_official_source_relocation_v1",
  "admin_confirm_product_fact_v1",
]) {
  assert.equal(
    readBoundaryMigration.includes(forbidden),
    false,
    `8I-4G read boundary migration contains forbidden authority expansion: ${forbidden}`,
  );
}

assert.ok(
  replayIdempotencyMigration.includes(
    "admin_confirm_trust_official_source_grouped_relocation_v1",
  ),
  "8I-4G replay fix must replace grouped confirmation",
);
assert.ok(
  replayIdempotencyMigration.indexOf("select * into v_existing") <
    replayIdempotencyMigration.indexOf(
      "v_preflight := public.admin_preflight_trust_official_source_grouped_relocation_v1",
    ),
  "persisted idempotent replay must be checked before mutable preflight",
);
assert.ok(
  replayIdempotencyMigration.includes("'idempotent',true"),
  "8I-4G replay fix must retain exact confirmed idempotent return",
);
assert.ok(
  replayIdempotencyMigration.includes("pg_advisory_xact_lock"),
  "8I-4G replay fix must retain transaction serialization",
);

for (const required of [
  "get_trust_official_source_transport_drift_case_incidents_v1",
  "security definer",
  "set search_path = ''",
  "READ_ONLY_CASE_SCOPED_TRANSPORT_INCIDENT_VIEW_NO_AUTHORITY_MUTATION",
  "revoke all on function public.get_trust_official_source_transport_drift_case_incidents_v1(uuid)",
  "grant execute on function public.get_trust_official_source_transport_drift_case_incidents_v1(uuid)",
  "to service_role",
]) {
  assert.ok(
    incidentReadBoundaryMigration.toLowerCase().includes(required.toLowerCase()),
    `8I-4G incident read boundary migration missing: ${required}`,
  );
}
assert.equal(
  incidentReadBoundaryMigration.toLowerCase().includes("grant select"),
  false,
  "8I-4G incident read boundary must not restore direct SELECT",
);
assert.ok(
  adminService.includes(
    '"get_trust_official_source_transport_drift_case_incidents_v1"',
  ),
  "Admin grouped relocation must use the governed transport incident RPC",
);
assert.equal(
  /rows\(\s*client,\s*"trust_official_source_transport_incidents"/m.test(
    adminService,
  ),
  false,
  "Admin grouped relocation must not direct-read transport incidents",
);

for (const required of [
  "Capture Phase 8I-4G read-only canary state",
  "trust-phase8i4g-canary-snapshot.mjs",
  "verify-trust-phase8i4g-canary-snapshot.mjs",
]) {
  assert.ok(workflow.includes(required), `workflow missing: ${required}`);
}
assert.equal(
  workflow.includes(
    "admin_confirm_trust_official_source_grouped_relocation_v1",
  ),
  false,
);

for (const required of [
  "trust_grouped_relocation_canary_real_candidate_required",
  "trust_grouped_relocation_canary_candidate_not_first",
  "WAITING_FOR_REAL_READY_FOR_8I4",
  "FIRST_REAL_CANARY_REQUIRES_EXPLICIT_ADMIN_CONFIRMATION",
]) {
  assert.ok(adminService.includes(required), `admin service missing: ${required}`);
}

for (const required of [
  "8I-4G FIRST REAL CANARY",
  "Queued behind canary",
  "WAITING_FOR_REAL_READY_FOR_8I4",
]) {
  assert.ok(workbench.includes(required), `workbench missing: ${required}`);
}

console.log(
  JSON.stringify(
    {
      contract: "trust-phase8i4g-static-contract-verification-v1",
      result: "PASS",
      baseline_state: "WAITING_FOR_REAL_READY_FOR_8I4",
      scheduled_detection: "READ_ONLY",
      automatic_confirmation: false,
    },
    null,
    2,
  ),
);
