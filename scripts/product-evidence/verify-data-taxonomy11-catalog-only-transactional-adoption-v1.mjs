import assert from "node:assert/strict";
import fs from "node:fs";

const migrationPath = "supabase/migrations/20260914072000_data_taxonomy11_catalog_only_transactional_adoption_v1.sql";
const evidencePath = "evidence/catalog-taxonomy-v1/data-taxonomy11-catalog-only-transactional-adoption-v1.json";
const migration = fs.readFileSync(migrationPath, "utf8");
const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
const executable = migration.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

assert.equal(evidence.schema_version, "data-taxonomy11-catalog-only-transactional-adoption-v1");
assert.equal(evidence.issue, 500);
assert.equal(evidence.baseline_main_sha, "8bc5959b526890002f7920795b6c4af045d1e9f5");
assert.equal(evidence.production_baseline.product_count, 165);
assert.equal(evidence.production_baseline.category_null_count, 0);
assert.equal(evidence.production_baseline.current_catalog_only_eligible_shape_count, 0);
assert.equal(evidence.production_baseline.recommendation_product_count, 164);
assert.equal(evidence.production_baseline.recommendation_runtime_cutover, false);
assert.equal(evidence.migration.production_application, false);
assert.equal(evidence.migration.execute_grant_added, false);
assert.equal(evidence.migration.legacy_promotion_function_changed, false);
assert.equal(evidence.transactional_contract.assignment_method, "source_classification");
assert.equal(evidence.transactional_contract.recommendation_admission_allowed, false);
for (const value of Object.values(evidence.mutation_scope_now)) assert.equal(value, false);

assert.match(executable, /create\s+or\s+replace\s+function\s+public\.promote_product_candidate_catalog_only_v1\s*\(/i);
assert.match(executable, /language\s+plpgsql[\s\S]*security\s+definer[\s\S]*set\s+search_path\s*=\s*'public'\s*,\s*'pg_temp'/i);
assert.match(executable, /from\s+public\.product_candidates[\s\S]*for\s+update/i);
assert.match(executable, /from\s+public\.product_candidate_catalog_taxonomy_classifications[\s\S]*for\s+update/i);
assert.match(executable, /catalog_taxonomy_versions[\s\S]*lifecycle_state\s*=\s*'shadow'[\s\S]*authority_mode\s*=\s*'shadow_only'/i);
assert.match(executable, /catalog_taxonomy_candidate_source_rules[\s\S]*lifecycle_state\s+is\s+distinct\s+from\s+'active'/i);
assert.match(executable, /catalog_taxonomy_terms[\s\S]*lifecycle_state\s*=\s*'active'/i);
assert.match(executable, /resolve_catalog_taxonomy_source_category_v1\s*\(/i);
assert.match(executable, /classification_state'\s+is\s+distinct\s+from\s+'active_shadow'/i);
assert.match(executable, /recommendation_admission_allowed'\s+is\s+distinct\s+from\s+'false'/i);
assert.match(executable, /service_category\s+is\s+not\s+null\s+or\s+v_candidate\.product_form\s+is\s+not\s+null/i);
assert.match(executable, /matched_product_id\s+is\s+not\s+null\s+or\s+v_candidate\.duplicate_of_product_id\s+is\s+not\s+null/i);
assert.match(executable, /normalized_name\s*=\s*v_normalized_name[\s\S]*normalized_brand\s*=\s*v_normalized_brand/i);
assert.match(executable, /external_source\s*=\s*v_candidate\.source_name[\s\S]*external_type\s*=\s*v_candidate\.external_type[\s\S]*external_id\s*=\s*v_candidate\.external_id/i);

const productInsertAt = executable.search(/insert\s+into\s+public\.products\s*\(/i);
const assignmentInsertAt = executable.search(/insert\s+into\s+public\.product_catalog_taxonomy_assignments\s*\(/i);
const candidateUpdateAt = executable.search(/update\s+public\.product_candidates\s+set\s+matched_product_id/i);
assert.ok(productInsertAt >= 0);
assert.ok(assignmentInsertAt > productInsertAt);
assert.ok(candidateUpdateAt > assignmentInsertAt);

const productInsert = executable.slice(productInsertAt, assignmentInsertAt);
assert.match(productInsert, /category\s*,\s*product_form/i);
assert.match(productInsert, /values\s*\([\s\S]*v_candidate\.canonical_name[\s\S]*v_candidate\.canonical_brand[\s\S]*null\s*,\s*null/i);
const assignmentInsert = executable.slice(assignmentInsertAt, candidateUpdateAt);
assert.match(assignmentInsert, /legacy_projection_key[\s\S]*assignment_state[\s\S]*assignment_method/i);
assert.match(assignmentInsert, /null\s*,\s*'shadow'\s*,\s*'source_classification'/i);
assert.match(executable.slice(candidateUpdateAt), /review_status\s*=\s*'promoted'::public\.product_review_status/i);
assert.match(executable.slice(candidateUpdateAt), /recommendation_admission_allowed'\s*,\s*false/i);

for (const role of ["public", "anon", "authenticated", "service_role"]) {
  assert.match(executable, new RegExp(`revoke\\s+all\\s+on\\s+function\\s+public\\.promote_product_candidate_catalog_only_v1\\(uuid,\\s*text\\)\\s+from\\s+${role}`, "i"));
}
assert.doesNotMatch(executable, /grant\s+execute/i);
assert.doesNotMatch(executable, /create\s+or\s+replace\s+function\s+public\.promote_product_candidate_structural_v1/i);
assert.doesNotMatch(executable, /alter\s+type|add\s+value/i);
assert.doesNotMatch(executable, /recommendation_shadow\.|read_recommendation_admission_authority/i);

console.log("DATA-TAXONOMY11 disabled transactional catalog-only adoption foundation: PASS");
