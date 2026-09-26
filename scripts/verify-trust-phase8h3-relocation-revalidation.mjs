import fs from "node:fs";
import assert from "node:assert/strict";
import { extractStrictFactCandidate } from "./trust-research-worker.mjs";

const migrationPath = "supabase/migrations/20260925235651_trust_phase8h3_relocation_revalidation_v1.sql";
const migration = fs.readFileSync(migrationPath, "utf8");
const worker = fs.readFileSync("scripts/trust-research-worker.mjs", "utf8");
const contract = fs.readFileSync("docs/evidence/trust-phase8h3-relocation-revalidation-contract-v1.md", "utf8");

for (const needle of [
  "add column relocation_id uuid",
  "admin_preflight_official_source_relocation_revalidation_v1",
  "admin_mark_official_source_relocation_revalidation_v1",
  "verification_result = 'unchanged'",
  "reason_code = 'source_relocated'",
  "baseline_kind <> 'fresh_recovery'",
  "comparability_state <> 'COMPARABLE'",
  "replacement_binding_id",
  "current_fact_context",
  "parent_propositions",
  "relationship-aware-value-v1",
  "same_proposition_value",
  "supersedes_fact_instance_id",
]) {
  assert.ok(migration.includes(needle), `migration missing contract token: ${needle}`);
}

assert.ok(!/update\s+public\.product_evidence_sources/i.test(migration), "historical Evidence Source must not be updated");
assert.ok(!/update\s+public\.product_evidence_records/i.test(migration), "historical Evidence must not be updated");
assert.ok(!/update\s+public\.product_fact_current/i.test(migration), "Phase 8H-3 must use controlled confirmation for Current writes");
assert.ok(!/replay_verified\s*=\s*true/i.test(migration), "synthetic replay verification is forbidden");
assert.ok(!/verification_result\s*=\s*'changed'.*source_relocated/is.test(migration), "relocation must not synthesize changed verification");

for (const needle of [
  "source relocated",
  "fresh-recovery",
  "Missing claims",
  "same-proposition",
]) {
  assert.ok(contract.toLowerCase().includes(needle.toLowerCase()), `contract missing invariant: ${needle}`);
}

assert.ok(worker.includes("expected-entity-product-identity-v1"), "contains_active expected-entity extractor missing");
assert.ok(!worker.toLowerCase().includes("niacinamide"), "worker must not hard-code Derma active identity");

const currentFactContext = {
  proposition_key: "a".repeat(64),
  value_entity_identifier: "niacinamide",
};
const strongSurfaces = {
  document: {
    title: "Niacinamide 20% Serum 30ml",
    meta_title: null,
    og_title: null,
  },
  structured_product_names: [],
};
const positive = extractStrictFactCandidate(
  "contains_active",
  "body text is irrelevant",
  [],
  { currentFactContext, semanticSurfaces: strongSurfaces },
);
assert.equal(positive?.normalizedValue, "niacinamide");
assert.equal(positive?.evidenceClass, "composition_identity");
assert.equal(positive?.observedClaim?.extractor, "expected-entity-product-identity-v1");

const bodyOnly = extractStrictFactCandidate(
  "contains_active",
  "This footer mentions niacinamide but the product identity does not.",
  [],
  {
    currentFactContext,
    semanticSurfaces: {
      document: { title: "Generic Serum", meta_title: null, og_title: null },
      structured_product_names: [],
    },
  },
);
assert.equal(bodyOnly, null, "body-only active mention must not become positive Evidence");

const wrongEntity = extractStrictFactCandidate(
  "contains_active",
  "",
  [],
  {
    currentFactContext: {
      proposition_key: "b".repeat(64),
      value_entity_identifier: "retinol",
    },
    semanticSurfaces: strongSurfaces,
  },
);
assert.equal(wrongEntity, null, "identity surface must match the expected current entity");

const parent = {
  proposition_key: "c".repeat(64),
  value_entity_identifier: "niacinamide",
};
const concentration = extractStrictFactCandidate(
  "active_concentration",
  "Niacinamide 20% Serum",
  [parent],
);
assert.deepEqual(concentration?.normalizedValue, { amount: 20, unit: "percent" });
assert.equal(concentration?.parentPropositionKey, parent.proposition_key);

console.log("TRUST_PHASE8H3_RELOCATION_REVALIDATION_STATIC_VERIFIED");
