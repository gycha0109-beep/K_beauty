import assert from "node:assert/strict";
import fs from "node:fs";

const migrationPath = "supabase/migrations/20260915111000_data_taxonomy13_catalog_only_candidate_approval_v1.sql";
const evidencePath = "evidence/catalog-taxonomy-v1/data-taxonomy13-catalog-only-candidate-approval-v1.json";
const fixturePath = "tests/fixtures/data-taxonomy13-catalog-only-candidate-approval/20260915110500_data_taxonomy13_catalog_only_candidate_approval_fixture.sql";
const runtimePath = "tests/fixtures/data-taxonomy13-catalog-only-candidate-approval/verify_data_taxonomy13_catalog_only_candidate_approval_runtime.sql";
const workflowPath = ".github/workflows/data-taxonomy13-catalog-only-candidate-approval.yml";
const migration = fs.readFileSync(migrationPath, "utf8");
const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
const fixture = fs.readFileSync(fixturePath, "utf8");
const runtime = fs.readFileSync(runtimePath, "utf8");
const workflow = fs.readFileSync(workflowPath, "utf8");
const executable = migration.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

assert.equal(evidence.schema_version, "data-taxonomy13-catalog-only-candidate-approval-v1");
assert.equal(evidence.issue, 513);
assert.equal(evidence.baseline_main_sha, "f1e5f814877e6db21dad486aa11d6c6484c1273c");
assert.equal(evidence.production_baseline.observed_main_sha, "7ca6c200611ab3c941b684e3a83d7f1dc2eeb0fe");
assert.equal(evidence.production_baseline.product_count, 165);
assert.equal(evidence.production_baseline.category_null_count, 0);
assert.equal(evidence.production_baseline.candidate_count, 190);
assert.equal(evidence.production_baseline.candidate_review_status.approved, 0);
assert.equal(evidence.production_baseline.pre_review_catalog_only_shape_count, 0);
assert.equal(evidence.production_baseline.taxonomy_lifecycle_state, "shadow");
assert.equal(evidence.production_baseline.taxonomy_authority_mode, "shadow_only");
assert.equal(evidence.production_baseline.catalog_only_promotion_function_service_role_execute, false);
assert.equal(evidence.production_baseline.recommendation_runtime_cutover, false);

assert.equal(evidence.first_candidate.candidate_id, "6a9627b6-a5da-458f-84f7-3a40f91453be");
assert.equal(evidence.first_candidate.source_name, "hwahae");
assert.equal(evidence.first_candidate.external_type, "products");
assert.equal(evidence.first_candidate.external_id, "1996087");
assert.equal(evidence.first_candidate.identity_resolution_state, "unresolved");
assert.equal(evidence.first_candidate.service_category, null);
assert.equal(evidence.first_candidate.product_form, null);
assert.equal(evidence.first_candidate.matched_product_id, null);
assert.equal(evidence.first_candidate.duplicate_of_product_id, null);
assert.equal(evidence.first_candidate.taxonomy.classification_state, "active_shadow");
assert.equal(evidence.first_candidate.taxonomy.classification_method, "source_rule_v1");
assert.equal(evidence.first_candidate.taxonomy.active_referenced_term_count, 4);
assert.equal(evidence.first_candidate.taxonomy.referenced_term_count, 4);
assert.equal(evidence.first_candidate.taxonomy.runtime_resolution_exact, true);
assert.equal(evidence.first_candidate.collision_readback.raw_normalized_product_identity, 0);
assert.equal(evidence.first_candidate.collision_readback.exact_external_product_identity, 0);
assert.equal(evidence.first_candidate.identity_cross_check.convergence_dimensions.length, 3);

assert.equal(evidence.repository_foundation.migration_path, migrationPath);
assert.equal(evidence.repository_foundation.migration_rebased_after_current_main, true);
assert.equal(evidence.repository_foundation.production_application, false);
assert.equal(evidence.repository_foundation.product_write_count, 0);
assert.equal(evidence.repository_foundation.taxonomy_assignment_write_count, 0);
assert.equal(evidence.repository_foundation.recommendation_semantic_write_count, 0);
assert.equal(evidence.runtime_verification.required, true);
assert.equal(evidence.runtime_verification.environment, "isolated_supabase");
assert.equal(evidence.runtime_verification.supabase_cli_version, "2.109.1");
assert.equal(evidence.runtime_verification.fixture_path, fixturePath);
assert.equal(evidence.runtime_verification.verification_path, runtimePath);
assert.equal(evidence.runtime_verification.production_write, false);
assert.ok(evidence.runtime_verification.scenarios.length >= 16);
assert.equal(evidence.approval_semantics.candidate_review_status_after_confirm, "approved");
assert.equal(evidence.approval_semantics.identity_resolution_state_after_confirm, "resolved");
assert.equal(evidence.approval_semantics.review_queue_approved_product_id_after_confirm, null);
assert.equal(evidence.approval_semantics.promotion_action, "none");

assert.match(executable, /create\s+table\s+public\.admin_catalog_only_candidate_approval_confirmations/i);
assert.match(executable, /alter\s+table\s+public\.admin_catalog_only_candidate_approval_confirmations\s+enable\s+row\s+level\s+security/i);
assert.match(executable, /create\s+or\s+replace\s+function\s+public\.admin_preflight_product_candidate_catalog_only_approval_v1\s*\(/i);
assert.match(executable, /create\s+or\s+replace\s+function\s+public\.admin_confirm_product_candidate_catalog_only_approval_v1\s*\(/i);
assert.match(executable, /security\s+definer[\s\S]*set\s+search_path\s*=\s*'public'\s*,\s*'pg_temp'/i);
assert.match(executable, /admin_require_product_review_actor\s*\([\s\S]*'admin\.products\.review'/i);
assert.match(executable, /catalog-only-candidate-identity-evidence-v1/i);
assert.match(executable, /identity_evidence_provider_count_insufficient/i);
assert.match(executable, /identity_evidence_independent_convergence_missing/i);
assert.match(executable, /identity_evidence_provider_identity_mismatch/i);
assert.match(executable, /candidate_identity_state_not_unresolved/i);
assert.match(executable, /legacy_projection_fields_present/i);
assert.match(executable, /candidate_product_reference_present/i);
assert.match(executable, /taxonomy_classification_snapshot_stale/i);
assert.match(executable, /taxonomy_classification_not_catalog_only_source_rule/i);
assert.match(executable, /taxonomy_classifier_authority_drifted/i);
assert.match(executable, /taxonomy_source_rule_drifted/i);
assert.match(executable, /taxonomy_term_set_not_active/i);
assert.match(executable, /taxonomy_runtime_resolution_drifted/i);
assert.match(executable, /normalized_product_identity_collision/i);
assert.match(executable, /exact_external_product_identity_collision/i);
assert.match(executable, /candidate_identity_peer_collision/i);
assert.match(executable, /candidate_external_peer_collision/i);
assert.match(executable, /resolve_catalog_taxonomy_source_category_v1\s*\(/i);
assert.match(executable, /catalog_taxonomy_versions[\s\S]*lifecycle_state\s*=\s*'shadow'[\s\S]*authority_mode\s*=\s*'shadow_only'/i);
assert.match(executable, /catalog_taxonomy_candidate_source_rules[\s\S]*lifecycle_state\s+is\s+distinct\s+from\s+'active'/i);
assert.match(executable, /catalog_taxonomy_terms[\s\S]*lifecycle_state\s*=\s*'active'/i);
assert.match(executable, /catalog_only_candidate_approval_stale_preflight/i);
assert.match(executable, /catalog_only_candidate_approval_request_id_conflict/i);
assert.match(executable, /pg_advisory_xact_lock/i);

const confirmStart = executable.search(/create\s+or\s+replace\s+function\s+public\.admin_confirm_product_candidate_catalog_only_approval_v1/i);
assert.ok(confirmStart >= 0);
const confirmSql = executable.slice(confirmStart);
const candidateUpdateMatch = confirmSql.match(/update\s+public\.product_candidates[\s\S]*?where\s+id\s*=\s*p_candidate_id\s*;/i);
assert.ok(candidateUpdateMatch);
const candidateUpdate = candidateUpdateMatch[0];
assert.match(candidateUpdate, /canonical_brand\s*=\s*v_canonical_brand/i);
assert.match(candidateUpdate, /canonical_name\s*=\s*v_canonical_name/i);
assert.match(candidateUpdate, /identity_resolution_state\s*=\s*'resolved'/i);
assert.match(candidateUpdate, /identity_resolution_version\s*=\s*'crawler-identity-resolution-v1'/i);
assert.match(candidateUpdate, /review_status\s*=\s*'approved'::public\.product_review_status/i);
assert.doesNotMatch(candidateUpdate, /service_category\s*=/i);
assert.doesNotMatch(candidateUpdate, /product_form\s*=/i);
assert.doesNotMatch(candidateUpdate, /matched_product_id\s*=/i);
assert.doesNotMatch(candidateUpdate, /duplicate_of_product_id\s*=/i);

const reviewUpdateMatch = confirmSql.match(/update\s+public\.candidate_promotion_reviews[\s\S]*?where\s+candidate_id\s*=\s*p_candidate_id\s*;/i);
assert.ok(reviewUpdateMatch);
assert.match(reviewUpdateMatch[0], /status\s*=\s*'approved'/i);
assert.match(reviewUpdateMatch[0], /approved_product_id\s*=\s*null/i);

assert.doesNotMatch(executable, /insert\s+into\s+public\.products\b/i);
assert.doesNotMatch(executable, /update\s+public\.products\b/i);
assert.doesNotMatch(executable, /delete\s+from\s+public\.products\b/i);
assert.doesNotMatch(executable, /insert\s+into\s+public\.product_catalog_taxonomy_assignments\b/i);
assert.doesNotMatch(executable, /update\s+public\.product_catalog_taxonomy_assignments\b/i);
assert.doesNotMatch(executable, /delete\s+from\s+public\.product_catalog_taxonomy_assignments\b/i);
assert.doesNotMatch(executable, /promote_product_candidate_catalog_only_v1\s*\(/i);
assert.doesNotMatch(executable, /promote_product_candidate_structural_v1\s*\(/i);
assert.doesNotMatch(executable, /promote_product_candidate\s*\(/i);
assert.doesNotMatch(executable, /recommendation_logs\s*(?:set|values|where|\()/i);
assert.doesNotMatch(executable, /grant\s+execute\s+on\s+function\s+public\.promote_product_candidate_catalog_only_v1/i);

assert.match(executable, /revoke\s+all\s+on\s+function\s+public\.admin_preflight_product_candidate_catalog_only_approval_v1[\s\S]*from\s+public/i);
assert.match(executable, /revoke\s+all\s+on\s+function\s+public\.admin_confirm_product_candidate_catalog_only_approval_v1[\s\S]*from\s+authenticated/i);
assert.match(executable, /grant\s+execute\s+on\s+function\s+public\.admin_preflight_product_candidate_catalog_only_approval_v1[\s\S]*to\s+service_role/i);
assert.match(executable, /grant\s+execute\s+on\s+function\s+public\.admin_confirm_product_candidate_catalog_only_approval_v1[\s\S]*to\s+service_role/i);

assert.match(fixture, /create\s+or\s+replace\s+function\s+public\.test_seed_data_taxonomy13/i);
assert.match(fixture, /resolve_catalog_taxonomy_source_category_v1/i);
assert.match(runtime, /positive preflight \+ confirm/i);
assert.match(runtime, /identity_evidence_provider_count_insufficient/i);
assert.match(runtime, /legacy_projection_fields_present/i);
assert.match(runtime, /taxonomy_classification_snapshot_stale/i);
assert.match(runtime, /taxonomy_classification_not_catalog_only_source_rule/i);
assert.match(runtime, /taxonomy_source_rule_drifted/i);
assert.match(runtime, /taxonomy_term_set_not_active/i);
assert.match(runtime, /taxonomy_runtime_resolution_drifted/i);
assert.match(runtime, /normalized_product_identity_collision/i);
assert.match(runtime, /exact_external_product_identity_collision/i);
assert.match(runtime, /candidate_identity_peer_collision/i);
assert.match(runtime, /candidate_external_peer_collision/i);
assert.match(runtime, /catalog_only_candidate_approval_stale_preflight/i);
assert.match(runtime, /catalog_only_candidate_approval_request_id_conflict/i);
assert.match(runtime, /exact retry was not idempotent/i);
assert.match(workflow, /SUPABASE_CLI_VERSION:\s*2\.109\.1/);
assert.match(workflow, /data-taxonomy13-catalog-only-candidate-approval\/20260915110500_data_taxonomy13_catalog_only_candidate_approval_fixture\.sql/);
assert.match(workflow, /20260915111100_verify_data_taxonomy13_catalog_only_candidate_approval_runtime\.sql/);
assert.match(workflow, /supabase@\$\{SUPABASE_CLI_VERSION\}[^\n]*start/);
assert.match(workflow, /supabase@\$\{SUPABASE_CLI_VERSION\}[^\n]*db reset/);

console.log(JSON.stringify({
  status: "PASS",
  issue: evidence.issue,
  candidateId: evidence.first_candidate.candidate_id,
  contract: evidence.schema_version,
  baselineMainSha: evidence.baseline_main_sha,
  productionObservedMainSha: evidence.production_baseline.observed_main_sha,
  runtimeVerification: evidence.runtime_verification.required,
  runtimeScenarioCount: evidence.runtime_verification.scenarios.length,
  productionApplication: evidence.repository_foundation.production_application,
  productWrites: evidence.repository_foundation.product_write_count,
  recommendationRuntimeCutover: evidence.production_baseline.recommendation_runtime_cutover
}, null, 2));
