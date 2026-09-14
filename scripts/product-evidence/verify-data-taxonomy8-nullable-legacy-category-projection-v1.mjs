import assert from "node:assert/strict";
import fs from "node:fs";

const migrationPath =
  "supabase/migrations/20260914030000_data_taxonomy8_nullable_legacy_category_projection_v1.sql";
const evidencePath =
  "evidence/catalog-taxonomy-v1/data-taxonomy8-nullable-legacy-category-projection-v1.json";
const compatibilityPath = "lib/catalog-product-legacy-projection-compatibility.mjs";

const migration = fs.readFileSync(migrationPath, "utf8");
const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
const compatibility = fs.readFileSync(compatibilityPath, "utf8");
const executableSql = migration
  .replace(/--.*$/gm, "")
  .replace(/\/\*[\s\S]*?\*\//g, "");

assert.equal(evidence.schema_version, "data-taxonomy8-nullable-legacy-category-projection-v1");
assert.equal(evidence.issue, 490);
assert.equal(evidence.baseline_main_sha, "d5ae6952196ddb4424b460067cc2943d9b6804c1");
assert.equal(evidence.production_baseline.product_count, 165);
assert.equal(evidence.production_baseline.category_null_count, 0);
assert.equal(evidence.production_baseline.category_type, "public.product_category");
assert.equal(evidence.production_baseline.category_nullable, false);
assert.equal(evidence.production_baseline.taxonomy_assignment_count, 165);
assert.equal(evidence.production_baseline.taxonomy_exact_equivalent_count, 165);
assert.equal(evidence.production_baseline.taxonomy_non_exact_count, 0);
assert.equal(evidence.production_baseline.recommendation_admitted_baseline, 164);
assert.equal(evidence.production_baseline.recommendation_runtime_cutover, false);

assert.equal(evidence.migration.path, migrationPath);
assert.equal(evidence.migration.repository_foundation_only, true);
assert.equal(evidence.migration.production_application, false);
assert.equal(evidence.migration.production_application_requires_explicit_approval, true);
assert.equal(evidence.migration.requires_pre_migration_not_null, true);
assert.equal(evidence.migration.requires_exact_equivalence_for_every_existing_product, true);
assert.equal(evidence.migration.requires_exactly_one_equivalence_row_per_product, true);
assert.equal(evidence.migration.drops_category_not_null, true);
assert.equal(evidence.migration.business_row_mutation, false);
assert.equal(evidence.migration.changes_product_category_enum, false);
assert.equal(evidence.migration.changes_product_form_nullability, false);
assert.equal(evidence.migration.recommendation_runtime_change, false);

assert.match(executableSql, /information_schema\.columns/i);
assert.match(executableSql, /udt_schema\s*,\s*c\.udt_name\s*,\s*c\.is_nullable/i);
assert.match(executableSql, /v_udt_schema\s*<>\s*'public'/i);
assert.match(executableSql, /v_udt_name\s*<>\s*'product_category'/i);
assert.match(executableSql, /v_is_nullable\s*<>\s*'NO'/i);
assert.match(executableSql, /to_regclass\('public\.catalog_taxonomy_product_exact_equivalence_v1'\)/i);
assert.match(executableSql, /count\(e\.product_id\)\s*<>\s*1/i);
assert.match(executableSql, /bool_and\(e\.exact_equivalent\)/i);
assert.match(executableSql, /alter\s+table\s+public\.products\s+alter\s+column\s+category\s+drop\s+not\s+null/i);
assert.match(executableSql, /comment\s+on\s+column\s+public\.products\.category/i);
assert.match(migration, /NULL means no legacy Recommendation category projection/);
assert.match(migration, /NULL does not grant Recommendation admission/);

assert.doesNotMatch(executableSql, /\b(insert|update|delete|truncate)\b/i);
assert.doesNotMatch(executableSql, /alter\s+type/i);
assert.doesNotMatch(executableSql, /add\s+value/i);
assert.doesNotMatch(executableSql, /alter\s+column\s+product_form/i);
assert.doesNotMatch(executableSql, /alter\s+column\s+category\s+set\s+not\s+null/i);

assert.match(compatibility, /CATALOG_ONLY/);
assert.match(compatibility, /grantsRecommendationAdmission:\s*false/);
assert.equal(evidence.post_application_semantics.null_category_grants_recommendation_admission, false);
assert.equal(evidence.post_application_semantics.catalog_only_products_allowed_by_schema, true);
assert.equal(evidence.post_application_semantics.catalog_only_products_allowed_by_promotion_in_this_gate, false);
assert.equal(evidence.post_application_semantics.recommendation_runtime_authority_unchanged, true);
assert.equal(evidence.rollback.set_not_null_only_when_category_null_count_zero, true);
assert.match(evidence.rollback.if_catalog_only_product_exists, /Do not coerce or delete/);
assert.ok(evidence.non_goals.includes("Production migration application"));
assert.ok(evidence.non_goals.includes("Recommendation taxonomy authority cutover"));
for (const value of Object.values(evidence.mutation_scope_now)) assert.equal(value, false);

console.log("DATA-TAXONOMY8 nullable legacy category schema foundation: PASS");
