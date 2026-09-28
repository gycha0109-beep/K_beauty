import assert from "node:assert/strict";
import fs from "node:fs";

const evidence = JSON.parse(
  fs.readFileSync(
    "docs/evidence/trust-phase8i3c-production-backfill-closure-v1.json",
    "utf8",
  ),
);

assert.equal(evidence.contract, "trust-phase8i3c-production-backfill-closure-v1");
assert.equal(evidence.phase, "PHASE_8I_3C");
assert.equal(evidence.result, "PASS");
assert.equal(evidence.source_incident_count, 4);

assert.deepEqual(evidence.first_enqueue, {
  contract: "trust-phase8i3-drift-case-enqueue-result-v1",
  candidate_count: 2,
  new_case_count: 2,
  existing_case_count: 0,
  new_link_count: 4,
  new_reentry_event_count: 2,
  blocked_count: 0,
  authority_mutation: false,
  current_invalidated: false,
});

assert.deepEqual(evidence.idempotent_replay, {
  contract: "trust-phase8i3-drift-case-enqueue-result-v1",
  candidate_count: 0,
  new_case_count: 0,
  existing_case_count: 0,
  new_link_count: 0,
  new_reentry_event_count: 0,
  blocked_count: 0,
  authority_mutation: false,
  current_invalidated: false,
});

assert.equal(evidence.cases.length, 2);
const rice = evidence.cases.find(
  (row) => row.product_id === "25b2763f-529f-4b2e-a436-2e0776279c55",
);
const aqua = evidence.cases.find(
  (row) => row.product_id === "765b3ca1-6927-49b0-bee6-4138d03dd915",
);
assert.ok(rice);
assert.ok(aqua);
assert.equal(rice.case_key, "f8963413daf67fce51fbe191cded8facd7e9a3bd46567c1b7249ba1acb07c9f2");
assert.equal(aqua.case_key, "a7c27d8ae68b1a6757a0cc5c2590f38ac64dbb76c9b85d3dcc935dac721781e9");
assert.equal(rice.incident_ids.length, 3);
assert.equal(rice.source_ids.length, 3);
assert.equal(aqua.incident_ids.length, 1);
assert.equal(aqua.source_ids.length, 1);

for (const row of evidence.cases) {
  assert.equal(row.incident_kind, "CONFIRMED_REDIRECT");
  assert.equal(row.route_hint, "REDIRECT_QUALIFICATION");
  assert.equal(row.confirmed_final_locator, "https://beautyofjoseon.com/");
  assert.equal(row.event.event_type, "SOURCE_TRANSPORT_DRIFT");
  assert.equal(row.event.disposition, "REVIEW_REQUIRED");
  assert.equal(
    row.event.reason_code,
    "SOURCE_TRANSPORT_DRIFT_REVIEW_REQUIRED",
  );
  assert.equal(row.event.phase, "8I-3");
  assert.equal(row.event.transport_signal_only, true);
  assert.equal(row.event.authority_mutation, false);
  assert.equal(row.event.current_invalidated, false);
  assert.equal(row.event.trigger_fingerprint, row.case_key);
}

assert.deepEqual(evidence.production_readback, {
  cases: 2,
  links: 4,
  evaluations: 0,
  transport_incidents: 4,
  reentry_events: 5,
  source_transport_drift_events: 2,
  source_transport_drift_review_required: 2,
  builder_candidate_count: 0,
  product_fact_current: 71,
  evidence_sources: 40,
  confirmed_relocations: 1,
});

assert.deepEqual(evidence.authority_invariants, {
  historical_evidence_source_mutation: false,
  product_fact_current_mutation: false,
  relocation_confirmation: false,
  recommendation_mutation: false,
  semantic_verdict_created: false,
});

assert.equal(
  evidence.next_step,
  "PHASE_8I_3D_MANUAL_LIVE_EVALUATION",
);

console.log("TRUST_PHASE8I3C_PRODUCTION_BACKFILL_VERIFIED");
