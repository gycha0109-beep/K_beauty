import assert from "node:assert/strict";
import fs from "node:fs";

const migrationPath = "supabase/migrations/20260913232300_data_taxonomy3_product_exact_equivalence_v1.sql";
const evidencePath = "docs/evidence/data-taxonomy3-product-exact-equivalence-v1.md";

for (const path of [migrationPath, evidencePath]) {
  assert.ok(fs.existsSync(path), `missing DATA-TAXONOMY3 artifact: ${path}`);
}

const migration = fs.readFileSync(migrationPath, "utf8");
const evidence = fs.readFileSync(evidencePath, "utf8");

assert.match(migration, /create or replace view public\.catalog_taxonomy_product_exact_equivalence_v1/i);
assert.match(migration, /with \(security_invoker = true\)/i);
assert.match(migration, /left join public\.product_catalog_taxonomy_assignments/i);
assert.match(migration, /left join public\.catalog_taxonomy_legacy_projections/i);
assert.match(migration, /lp\.lifecycle_state = 'active'/i);
assert.match(migration, /category_equivalent/i);
assert.match(migration, /form_equivalent/i);
assert.match(migration, /exact_equivalent/i);
assert.match(migration, /v\.lifecycle_state = 'shadow'/i);
assert.match(migration, /v\.authority_mode = 'shadow_only'/i);
assert.match(migration, /revoke all on table public\.catalog_taxonomy_product_exact_equivalence_v1/i);
assert.match(migration, /grant select on table public\.catalog_taxonomy_product_exact_equivalence_v1\s*to service_role/i);

for (const forbidden of [
  /insert\s+into\s+public\.products/i,
  /update\s+public\.products/i,
  /delete\s+from\s+public\.products/i,
  /product_fact_current\s+set/i,
  /recommendation_admission_allowed\s*=\s*true/i,
  /authority_mode\s*=\s*'canonical'/i,
]) {
  assert.doesNotMatch(migration, forbidden);
}

for (const marker of [
  "Products = 165",
  "Product taxonomy assignments = 165",
  "joined rows = 165",
  "category mismatch = 0",
  "form mismatch = 0",
  "Recommendation runtime cutover = false",
]) {
  assert.ok(evidence.includes(marker), `missing evidence marker: ${marker}`);
}

console.log("DATA-TAXONOMY3 exact-equivalence contract verified");
