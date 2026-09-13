import assert from "node:assert/strict";
import fs from "node:fs";

const foundationPath = "supabase/migrations/20260913201050_data_taxonomy1_shadow_catalog_taxonomy_foundation_v1.sql";
const hardeningPath = "supabase/migrations/20260913201324_data_taxonomy1_shadow_catalog_taxonomy_hardening_v1.sql";
const evidencePath = "docs/evidence/data-taxonomy1-shadow-catalog-taxonomy-foundation-v1.md";

for (const path of [foundationPath, hardeningPath, evidencePath]) {
  assert.ok(fs.existsSync(path), `missing required DATA-TAXONOMY1 artifact: ${path}`);
}

const foundation = fs.readFileSync(foundationPath, "utf8");
const hardening = fs.readFileSync(hardeningPath, "utf8");
const evidence = fs.readFileSync(evidencePath, "utf8");
const migrations = `${foundation}\n${hardening}`;

const shadowTables = [
  "catalog_taxonomy_versions",
  "catalog_taxonomy_terms",
  "catalog_taxonomy_relations",
  "catalog_taxonomy_legacy_projections",
  "product_catalog_taxonomy_assignments",
];

for (const table of shadowTables) {
  assert.match(foundation, new RegExp(`create table public\\.${table}\\s*\\(`, "i"), `${table} must be created`);
  assert.match(foundation, new RegExp(`alter table public\\.${table} enable row level security`, "i"), `${table} must enable RLS`);
  assert.match(
    foundation,
    new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated, service_role`, "i"),
    `${table} must revoke broad access`,
  );
  assert.match(
    foundation,
    new RegExp(`grant select on table public\\.${table} to service_role`, "i"),
    `${table} must expose read-only service access`,
  );
}

assert.match(foundation, /'catalog-taxonomy-v1'\s*,\s*'shadow'\s*,\s*'shadow_only'/i);
assert.match(foundation, /assignment_state text not null default 'shadow'/i);
assert.match(foundation, /unique nulls not distinct \(taxonomy_version, legacy_category, legacy_product_form\)/i);
assert.match(foundation, /create view public\.catalog_taxonomy_shadow_read_v1\s*\nwith \(security_invoker = true\)/i);
assert.match(foundation, /DATA_TAXONOMY1_UNMAPPED_PRODUCTS/i);
assert.match(foundation, /DATA_TAXONOMY1_POSTCHECK_FAILED/i);
assert.match(foundation, /exact_legacy_projection/i);
assert.match(foundation, /t\.lifecycle_state <> 'active'/i);

const projectionKeys = [
  "catalog-taxonomy-v1:legacy:cleanser:none",
  "catalog-taxonomy-v1:legacy:toner_essence:none",
  "catalog-taxonomy-v1:legacy:toner_pad:none",
  "catalog-taxonomy-v1:legacy:treatment:serum",
  "catalog-taxonomy-v1:legacy:treatment:ampoule",
  "catalog-taxonomy-v1:legacy:treatment:essence",
  "catalog-taxonomy-v1:legacy:moisturizer_lotion_emulsion:none",
  "catalog-taxonomy-v1:legacy:moisturizer_gel:none",
  "catalog-taxonomy-v1:legacy:moisturizer_cream:none",
  "catalog-taxonomy-v1:legacy:moisturizer_balm:none",
  "catalog-taxonomy-v1:legacy:sunscreen:none",
];

for (const key of projectionKeys) {
  assert.ok(foundation.includes(`'${key}'`), `missing lossless legacy projection ${key}`);
}

const reservedTerms = [
  "entity_kind:tool",
  "entity_kind:device",
  "domain:makeup",
  "recommendation_family:mask",
  "recommendation_family:complexion",
  "category:mask",
  "category:foundation",
  "category:skincare_tool",
  "category:skincare_device",
  "form:sheet",
  "form:hydrogel",
  "form:wash_off",
  "form:sleeping",
  "form:cushion",
  "form:stick",
  "form:roller",
  "form:wearable",
  "capability:shade_variant",
  "capability:reusable",
  "capability:powered_device",
];

for (const suffix of reservedTerms) {
  assert.ok(foundation.includes(`catalog-taxonomy-v1:${suffix}`), `missing future-ready reserved term ${suffix}`);
}

assert.match(hardening, /add column retired_at timestamptz/i);
assert.match(hardening, /catalog_taxonomy_versions_lifecycle_timestamps_check/i);
assert.match(hardening, /set relation_type = 'supports_capability'/i);
assert.match(hardening, /where relation_type = 'has_capability'/i);
assert.match(hardening, /applicability_only_not_product_fact/i);
assert.match(hardening, /relation_type in \('belongs_to','allowed_form_for','supports_capability'\)/i);

const forbiddenMutations = [
  /alter\s+table\s+public\.products\b/i,
  /update\s+public\.products\b/i,
  /insert\s+into\s+public\.products\b/i,
  /delete\s+from\s+public\.products\b/i,
  /alter\s+type\s+public\.product_category\b/i,
  /alter\s+type\s+public\.product_form\b/i,
  /create\s+or\s+replace\s+function\s+public\.map_product_category\b/i,
  /(?:insert\s+into|update|delete\s+from|alter\s+table)\s+public\.product_fact_/i,
];

for (const pattern of forbiddenMutations) {
  assert.doesNotMatch(migrations, pattern, `DATA-TAXONOMY1 must not mutate existing runtime/Product Fact authority: ${pattern}`);
}

assert.match(evidence, /Product count: `165`/);
assert.match(evidence, /shadow assignments: `165`/);
assert.match(evidence, /exact legacy projection mismatches: `0`/);
assert.match(evidence, /assignments using reserved\/deprecated terms: `0`/);
assert.match(evidence, /322e754b46eb0f0a5983750bc4fee9c3/);
assert.match(evidence, /supports_capability/);
assert.match(evidence, /not evidence that an individual Product actually possesses/i);
assert.match(evidence, /New taxonomy vocabulary must not require a new `product_category` enum value/i);

console.log(JSON.stringify({
  result: "PASS",
  contract: "DATA-TAXONOMY1",
  taxonomyVersion: "catalog-taxonomy-v1",
  authorityMode: "shadow_only",
  losslessProjectionCount: projectionKeys.length,
  reservedFutureVocabularyVerified: true,
  existingProductMutationAllowed: false,
  productFactMutationAllowed: false,
  recommendationRuntimeCutover: false,
  capabilitySemantics: "applicability_only_not_product_fact",
}, null, 2));
