import fs from "node:fs";
import assert from "node:assert/strict";

const pairs = [
  [
    "docs/evidence/trust-phase8h3-research-result-security-hardening-db-blueprint-v1.sql",
    "supabase/migrations/20260928040319_trust_phase8h3_research_result_security_hardening_v1.sql",
  ],
  [
    "docs/evidence/trust-phase8h3-relational-candidate-persistence-hardening-db-blueprint-v1.sql",
    "supabase/migrations/20260928042607_trust_phase8h3_relational_candidate_persistence_hardening_v1.sql",
  ],
  [
    "docs/evidence/trust-phase8h3-8e-relationship-scope-hardening-db-blueprint-v1.sql",
    "supabase/migrations/20260928042612_trust_phase8h3_8e_relationship_scope_hardening_v1.sql",
  ],
  [
    "docs/evidence/trust-phase8h3-8e-security-hardening-db-blueprint-v1.sql",
    "supabase/migrations/20260928042618_trust_phase8h3_8e_security_hardening_v1.sql",
  ],
];

for (const [blueprintPath, migrationPath] of pairs) {
  assert.equal(
    fs.readFileSync(migrationPath, "utf8"),
    fs.readFileSync(blueprintPath, "utf8"),
    `Production migration must exactly match reviewed blueprint: ${migrationPath}`,
  );
}

const closure = JSON.parse(
  fs.readFileSync(
    "docs/evidence/trust-phase8h3-derma-production-canary-closure-v1.json",
    "utf8",
  ),
);

assert.equal(closure.contract, "trust-phase8h3-derma-production-canary-closure-v1");
assert.equal(closure.watchtower_track, "pipeline-reliability");
assert.equal(closure.result, "PASS");

const historical = closure.derma?.historical_source;
assert.equal(historical?.source_id, "f5eb21f8-4829-4c9b-b927-ccdfb43cdd1b");
assert.equal(
  historical?.canonical_locator,
  "https://www.dermafactory.net/products/niacinamide-20-serum-30ml?variant=46478659616933",
);
assert.equal(
  historical?.content_digest,
  "98279671fb0e027d35a199e3d02c913cd98e891f2dd8fe8bf837f730a022b291",
);
assert.equal(historical?.mutated, false);
assert.equal(historical?.source_metadata?.current_name, undefined);

assert.equal(closure.derma?.relocation?.result, "confirmed");
assert.equal(closure.derma?.relocation?.old_binding_state, "retired");
assert.equal(closure.derma?.relocation?.replacement_binding_state, "resolved");
assert.equal(closure.derma?.relocation?.replacement_scope_relation, "equivalent");

assert.equal(closure.derma?.verification?.baseline_kind, "fresh_recovery");
assert.equal(closure.derma?.verification?.comparability_state, "COMPARABLE");
assert.equal(closure.derma?.verification?.verification_result, "unchanged");
assert.equal(
  closure.derma?.verification?.semantic_digest,
  "4db8cee5affc402eefd5022c88d40d6007c7e33796f91cbc5e34112a643dd1db",
);

for (const fact of [
  closure.derma?.contains_active,
  closure.derma?.active_concentration,
]) {
  assert.equal(fact?.resolution_kind, "SAME_SEMANTIC_REAFFIRMATION");
  assert.equal(fact?.operational_state, "confirmed");
  assert.deepEqual(fact?.current_after, fact?.current_before);
  assert.equal(fact?.current_pointer_changed, false);
  assert.equal(fact?.fact_instance_mutated, false);
  assert.equal(fact?.confirmation_created, false);
  assert.equal(fact?.automatic_confirmation, false);
}

assert.equal(
  closure.derma?.active_concentration?.corrected_candidate?.parent_proposition_key,
  "89703d12e70171885f5a0db6edb1920bbd3e1ae3f2dc652c0511d93643bc1c55",
);
assert.equal(
  closure.derma?.active_concentration?.corrected_candidate?.canonical_evidence_digest,
  "8936d01a7778cfa399602186bb3993d4b0005f0bea6af5dcc1e8266d63194e14",
);
assert.equal(
  closure.derma?.active_concentration?.malformed_candidate?.candidate_id,
  "2d98d183-cc0e-4f4d-82b7-9a2a255dd3b2",
);
assert.equal(
  closure.derma?.active_concentration?.malformed_candidate?.preserved,
  true,
);
assert.equal(
  closure.derma?.active_concentration?.malformed_candidate?.resolution_refs,
  0,
);

assert.equal(closure.security?.phase8h3_functions_checked, 6);
assert.equal(closure.security?.readback, "PASS");
assert.equal(closure.security?.new_phase8h3_advisor_blocker, false);
assert.deepEqual(closure.security?.expected_contract, {
  security_definer: true,
  search_path: "",
  service_role_execute: true,
  authenticated_execute: false,
  anon_execute: false,
  public_execute: false,
});

for (const field of [
  "assignment_updated_since_phase8h3",
  "current_updated_since_phase8h3",
  "relocations_created_since_phase8h3",
  "transitions_created_since_phase8h3",
  "research_bridges_created_since_phase8h3",
  "research_tasks_created_since_phase8h3",
  "research_tasks_updated_since_phase8h3",
  "resolutions_created_since_phase8h3",
  "phase8h3_request_rows_on_unrelated_scope",
]) {
  assert.equal(closure.blast_radius?.[field], 0, `blast-radius invariant failed: ${field}`);
}
assert.equal(closure.blast_radius?.product_count, 16);
assert.equal(closure.blast_radius?.result, "PASS");

assert.equal(
  closure.research_task_terminal_contract?.observed_state,
  "EVIDENCE_CANDIDATE",
);
assert.equal(
  closure.research_task_terminal_contract?.mutation_required,
  false,
);
assert.equal(closure.production_mutation_after_reaffirmation, "NONE");

console.log("TRUST_PHASE8H3_DERMA_PRODUCTION_CLOSURE_STATIC_VERIFIED");
