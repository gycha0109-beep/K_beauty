import { readFileSync } from 'node:fs';

const migrationPath = 'supabase/migrations/20260915155618_data_taxonomy15_catalog_only_trust_intake_bridge_v1.sql';
const fixturePath = 'tests/fixtures/data-taxonomy15-catalog-only-trust-intake/20260915154000_data_taxonomy15_catalog_only_trust_intake_fixture.sql';
const runtimePath = 'tests/fixtures/data-taxonomy15-catalog-only-trust-intake/verify_data_taxonomy15_catalog_only_trust_intake_runtime.sql';

const migration = readFileSync(migrationPath, 'utf8');
const fixture = readFileSync(fixturePath, 'utf8');
const runtime = readFileSync(runtimePath, 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const token of [
  "create or replace function public.enqueue_catalog_trust_intake_from_promotion_v1()",
  "new.promotion_version = 'catalog-only-product-transactional-adoption-v1'",
  "classification.taxonomy_version = 'catalog-taxonomy-v1'",
  "classification.classification_state = 'active_shadow'",
  "classification.classification_method = 'source_rule_v1'",
  "classification.legacy_projection_key is null",
  "classification.product_write_allowed is false",
  "classification.product_promotion_allowed is false",
  "classification.recommendation_admission_allowed is false",
  "rule.lifecycle_state = 'active'",
  "rule.raw_category_key = lower(btrim(new.category_path))",
  "v_category := nullif(btrim(coalesce(new.service_category::text, '')), '')",
  "raise exception 'DATA-TAXONOMY15: promoted candidate % has no governed TRUST intake category'",
  "revoke all on function public.enqueue_catalog_trust_intake_from_promotion_v1()"
]) {
  assert(migration.includes(token), `migration missing required contract: ${token}`);
}

for (const forbidden of [
  /alter\s+table\s+public\.catalog_trust_intake[\s\S]*drop\s+not\s+null/i,
  /grant\s+execute/i,
  /insert\s+into\s+public\.products/i,
  /update\s+public\.products/i,
  /delete\s+from\s+public\.products/i,
  /insert\s+into\s+public\.product_fact_/i,
  /update\s+public\.product_fact_/i,
  /insert\s+into\s+public\.recommendation/i,
  /update\s+public\.recommendation/i
]) {
  assert(!forbidden.test(migration), `migration crosses forbidden authority boundary: ${forbidden}`);
}

assert(fixture.includes('catalog_taxonomy_candidate_source_rules'), 'fixture must model governed source rules');
assert(runtime.includes("catalog_only_category"), 'runtime must assert catalog-only category delivery');
assert(runtime.includes("legacy_category"), 'runtime must assert legacy behavior preservation');
assert(runtime.includes("when check_violation then"), 'runtime must assert fail-closed invalid catalog-only promotion');
assert(runtime.includes("'result','PASS'"), 'runtime must emit PASS evidence');

console.log('DATA-TAXONOMY15 static verifier PASS');
