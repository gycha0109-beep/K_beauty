import fs from "node:fs";
import assert from "node:assert/strict";
import { extractStrictFactCandidate } from "./trust-research-worker.mjs";

const migrationPath = "docs/evidence/trust-phase8h3-relocation-revalidation-db-blueprint-v1.sql";
const migration = fs.readFileSync(migrationPath, "utf8");
const worker = fs.readFileSync("scripts/trust-research-worker.mjs", "utf8");
const contract = fs.readFileSync("docs/evidence/trust-phase8h3-relocation-revalidation-contract-v1.md", "utf8");
const provenance = JSON.parse(fs.readFileSync("docs/evidence/trust-phase8h3-cli-migration-generation-v1.json", "utf8"));
const dryRun = JSON.parse(fs.readFileSync("docs/evidence/trust-phase8h3-db-dry-run-validation-v1.json", "utf8"));

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
assert.ok(!/^\s*begin\s*;/i.test(migration), "deployable blueprint must not open an outer transaction");
assert.ok(!/\n\s*commit\s*;\s*$/i.test(migration), "deployable blueprint must not commit its caller transaction");

assert.equal(provenance.contract, "trust-phase8h3-cli-migration-generation-v1");
assert.equal(provenance.generation_authority, "SUPABASE_CLI_MIGRATION_NEW");
assert.equal(provenance.production_mutation, "NONE");
assert.equal(provenance.repository_materialization, "DB_BLUEPRINT_PENDING_PRODUCTION_VERSION_READBACK");
assert.equal(dryRun.contract, "trust-phase8h3-db-dry-run-validation-v1");
assert.equal(dryRun.validation_mode, "PRODUCTION_SCHEMA_TRANSACTIONAL_DRY_RUN_ROLLED_BACK");
assert.equal(dryRun.migration_ddl_compile, "PASS");
assert.equal(dryRun.dependency_resolution, "PASS");
assert.equal(dryRun.production_mutation, "NONE");
assert.deepEqual(dryRun.in_transaction_readback, {
  preflight_exists: true,
  mark_exists: true,
  relocation_column_exists: true,
  service_role_execute: true,
  authenticated_execute: false,
});
assert.deepEqual(dryRun.rollback_readback, {
  preflight_rolled_back: true,
  mark_rolled_back: true,
  relocation_column_rolled_back: true,
});

for (const needle of [
  "source_relocated",
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