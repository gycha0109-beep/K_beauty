import fs from "node:fs";
import assert from "node:assert/strict";

const audit = JSON.parse(
  fs.readFileSync("docs/evidence/trust-phase8i-official-source-fleet-audit-v1.json", "utf8"),
);
const dryRun = JSON.parse(
  fs.readFileSync("docs/evidence/trust-phase8i-reentry-security-hardening-dry-run-v1.json", "utf8"),
);
const starvation = JSON.parse(
  fs.readFileSync("docs/evidence/trust-phase8i-reentry-scanner-starvation-regression-v1.json", "utf8"),
);
const blueprint = fs.readFileSync(
  "docs/evidence/trust-phase8i-reentry-security-hardening-db-blueprint-v1.sql",
  "utf8",
);
const phase6b = fs.readFileSync(
  "supabase/migrations/20260920200010_trust_phase6b_reentry_detectors_v1.sql",
  "utf8",
);

assert.equal(audit.contract, "trust-phase8i-official-source-fleet-audit-v1");
assert.equal(audit.watchtower_track, "pipeline-reliability");
assert.equal(audit.mutation_policy, "READ_ONLY_SNAPSHOT");
assert.equal(audit.official_source_count, audit.sources.length);
assert.equal(audit.official_source_count, 35);
assert.equal(audit.summary.profiled, 3);
assert.equal(audit.summary.comparable, 3);
assert.equal(audit.summary.unprofiled, 32);
assert.equal(audit.summary.current_dependency_sources, 35);
assert.equal(audit.summary.confirmed_relocation_sources, 1);
assert.equal(audit.summary.reentry_covered_sources, 33);
assert.equal(audit.summary.reentry_uncovered_sources, 2);

const sourceIds = new Set(audit.sources.map((source) => source.source_id));
assert.equal(sourceIds.size, audit.sources.length);
for (const source of audit.sources) {
  assert.ok(source.source_id);
  assert.ok(String(source.canonical_locator).startsWith("https://"));
  assert.ok(source.product_id);
  assert.ok(source.subject_id);
  assert.ok(source.current_dependency_count > 0);
  assert.ok(Array.isArray(source.reentry_detector_keys));
}

const derma = audit.sources.find(
  (source) => source.source_id === "f5eb21f8-4829-4c9b-b927-ccdfb43cdd1b",
);
assert.ok(derma);
assert.equal(derma.relocation_result, "confirmed");
assert.equal(derma.comparability_state, "COMPARABLE");
assert.equal(derma.latest_verification_result, "unchanged");

const uncovered = audit.sources.filter((source) => source.reentry_checkpoint_count === 0);
assert.equal(uncovered.length, 2);
assert.ok(uncovered.every((source) => source.publisher === "Torriden / (주)토리든"));
assert.ok(uncovered.every((source) => source.comparability_state === "COMPARABLE"));

assert.equal(starvation.contract, "trust-phase8i-reentry-scanner-starvation-regression-v1");
assert.equal(starvation.status, "KNOWN_GAP_LOCKED");
assert.equal(starvation.production_observation.intake_checkpoint_count, 165);
assert.equal(starvation.production_observation.default_limit, 100);
assert.equal(starvation.production_observation.cursor_present, false);
assert.equal(starvation.risk.starvation_possible, true);
assert.equal(starvation.required_v2_contract.stable_keyset_cursor, true);
assert.equal(starvation.required_v2_contract.eventual_full_coverage, true);
assert.match(phase6b, /order by created_at,id\s+limit p_limit/i);
assert.ok(!phase6b.includes("p_cursor"));

assert.equal(dryRun.contract, "trust-phase8i-reentry-security-hardening-dry-run-v1");
assert.equal(dryRun.result, "PASS");
assert.equal(dryRun.production_mutation_persisted, false);
assert.equal(dryRun.transaction_test.result, "PASS");
assert.equal(dryRun.transaction_test.process.authority_mutation, false);
assert.equal(dryRun.transaction_test.process.current_invalidated, false);
assert.equal(dryRun.transaction_test.detector.events_emitted, 0);
assert.equal(dryRun.rollback_readback.synthetic_event_persisted, false);

const signatures = [
  "public.hash_trust_reentry_signal_v1(jsonb)",
  "public.observe_trust_reentry_signal_v1(text,text,text,uuid,uuid,uuid,jsonb)",
  "public.process_trust_reentry_event_v1(uuid)",
  "public.request_trust_reentry_v1(text,uuid,uuid,uuid,text,uuid,text,jsonb)",
  "public.run_trust_reentry_detectors_v1(integer)",
];
for (const signature of signatures) {
  assert.ok(
    blueprint.includes(`alter function ${signature}`) &&
      blueprint.includes("set search_path = '';"),
    `missing empty search_path hardening for ${signature}`,
  );
  assert.ok(
    blueprint.includes(`revoke all on function ${signature}`),
    `missing ACL revoke for ${signature}`,
  );
}

for (const signature of [
  "public.process_trust_reentry_event_v1(uuid)",
  "public.request_trust_reentry_v1(text,uuid,uuid,uuid,text,uuid,text,jsonb)",
  "public.run_trust_reentry_detectors_v1(integer)",
]) {
  assert.ok(
    blueprint.includes(`grant execute on function ${signature}`) &&
      blueprint.includes("to service_role;"),
    `missing service_role grant for ${signature}`,
  );
}

for (const forbidden of [
  "insert into public.product_fact_current",
  "update public.product_fact_current",
  "delete from public.product_fact_current",
  "update public.product_evidence_sources",
  "delete from public.product_evidence_sources",
  "admin_confirm_trust_official_source_relocation_v1",
]) {
  assert.ok(!blueprint.toLowerCase().includes(forbidden.toLowerCase()));
}

console.log("TRUST_PHASE8I_FLEET_SECURITY_HARDENING_STATIC_VERIFIED");
