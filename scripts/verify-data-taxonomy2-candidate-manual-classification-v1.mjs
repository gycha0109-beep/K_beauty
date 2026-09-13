import assert from "node:assert/strict";
import fs from "node:fs";

const migrationPath = "supabase/migrations/20260913202500_data_taxonomy2_candidate_manual_classification_v1.sql";
const evidencePath = "docs/evidence/data-taxonomy2-candidate-manual-classification-v1.md";

for (const path of [migrationPath, evidencePath]) {
  assert.ok(fs.existsSync(path), `missing required DATA-TAXONOMY2 artifact: ${path}`);
}

const migration = fs.readFileSync(migrationPath, "utf8");
const evidence = fs.readFileSync(evidencePath, "utf8");

const constraintNames = [...migration.matchAll(/\bconstraint\s+([A-Za-z_][A-Za-z0-9_$]*)/gi)].map((match) => match[1]);
const pgIdentifierPrefixes = new Map();
for (const name of constraintNames) {
  const postgresIdentifier = name.slice(0, 63);
  const existing = pgIdentifierPrefixes.get(postgresIdentifier);
  assert.ok(
    !existing || existing === name,
    `PostgreSQL 63-byte identifier collision: ${existing} vs ${name} -> ${postgresIdentifier}`,
  );
  pgIdentifierPrefixes.set(postgresIdentifier, name);
}
assert.ok(migration.includes("constraint pctc_entity_kind_fk"));
assert.ok(migration.includes("constraint pctc_entity_kind_axis_check"));

for (const table of [
  "catalog_taxonomy_candidate_source_rules",
  "product_candidate_catalog_taxonomy_classifications",
]) {
  assert.match(migration, new RegExp(`create table public\\.${table}\\s*\\(`, "i"));
  assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  assert.match(
    migration,
    new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated, service_role`, "i"),
  );
  assert.match(migration, new RegExp(`grant select on table public\\.${table} to service_role`, "i"));
}

for (const projectionKey of [
  "catalog-taxonomy-v1:legacy:moisturizer:none",
  "catalog-taxonomy-v1:legacy:treatment:booster",
  "catalog-taxonomy-v1:legacy:treatment:peeling_solution",
]) {
  assert.ok(migration.includes(`'${projectionKey}'`), `missing candidate-promotion projection ${projectionKey}`);
}

const currentSourceRules = new Map([
  ["catalog-taxonomy-v1:source:hwahae:cleanser", "catalog-taxonomy-v1:category:cleanser"],
  ["catalog-taxonomy-v1:source:hwahae:sunscreen", "catalog-taxonomy-v1:category:sunscreen"],
  ["catalog-taxonomy-v1:source:hwahae:toner_essence", "catalog-taxonomy-v1:category:toner"],
  ["catalog-taxonomy-v1:source:hwahae:treatment", "catalog-taxonomy-v1:category:treatment"],
]);

for (const [ruleKey, categoryTerm] of currentSourceRules) {
  assert.ok(migration.includes(`'${ruleKey}'`), `missing source classification rule ${ruleKey}`);
  assert.ok(migration.includes(`'${categoryTerm}'`), `missing target category term ${categoryTerm}`);
}

assert.match(migration, /candidate-catalog-taxonomy-classification-v1/i);
assert.match(migration, /classification_state in \('active_shadow','reserved_shadow','blocked_deprecated','unresolved'\)/i);
assert.match(migration, /return 'reserved_shadow'/i);
assert.match(migration, /return 'blocked_deprecated'/i);
assert.match(migration, /exact_source_category_rule_missing/i);
assert.match(migration, /exact_legacy_projection_missing/i);
assert.match(migration, /candidate_catalog_taxonomy_version_not_shadow/i);
assert.match(migration, /v_method := 'manual_legacy_projection_v1'/i);
assert.match(migration, /'classification_method','source_rule_v1'/i);
assert.match(migration, /product_write_allowed = false/i);
assert.match(migration, /product_promotion_allowed = false/i);
assert.match(migration, /recommendation_admission_allowed = false/i);
assert.match(migration, /recommendation_runtime_cutover',false/i);
assert.match(migration, /after insert or update of source_name, category_path, service_category, product_form/i);
assert.match(migration, /DATA_TAXONOMY2_CANDIDATE_BACKFILL_INCOMPLETE/i);
assert.match(migration, /DATA_TAXONOMY2_AUTHORITY_LEAK/i);
assert.match(migration, /DATA_TAXONOMY2_FORM_INFERENCE_FORBIDDEN/i);
assert.match(migration, /DATA_TAXONOMY2_ACTIVE_CLASSIFICATION_NONACTIVE_TERM/i);

const tonerRule = migration.match(/'catalog-taxonomy-v1:source:hwahae:toner_essence'[\s\S]*?'active',[\s\S]*?'\{\"observed_in_production\":true,\"authority\":\"shadow_only\",\"form_semantics\":\"unresolved_do_not_infer_essence\"\}'::jsonb/);
assert.ok(tonerRule, "toner_essence rule must preserve unresolved form semantics");
const treatmentRule = migration.match(/'catalog-taxonomy-v1:source:hwahae:treatment'[\s\S]*?'active',[\s\S]*?'\{\"observed_in_production\":true,\"authority\":\"shadow_only\",\"form_semantics\":\"requires_separate_governed_evidence\"\}'::jsonb/);
assert.ok(treatmentRule, "treatment rule must require separate governed form evidence");

for (const pattern of [
  /(?:insert\s+into|update|delete\s+from|alter\s+table)\s+public\.products\b/i,
  /create\s+or\s+replace\s+function\s+public\.promote_product_candidate\b/i,
  /create\s+or\s+replace\s+function\s+public\.map_product_category\b/i,
  /create\s+or\s+replace\s+function\s+public\.admin_confirm_product_candidate_review\b/i,
  /create\s+or\s+replace\s+function\s+public\.admin_confirm_product_review_import_batch\b/i,
  /(?:insert\s+into|update|delete\s+from|alter\s+table)\s+public\.product_fact_/i,
  /(?:insert\s+into|update|delete\s+from|alter\s+table)\s+public\.product_offers\b/i,
]) {
  assert.doesNotMatch(migration, pattern, `DATA-TAXONOMY2 must preserve existing runtime authority: ${pattern}`);
}

assert.match(evidence, /Production candidate count: `190`/);
assert.match(evidence, /Hwahae `cleanser`: `25`/);
assert.match(evidence, /Hwahae `sunscreen`: `37`/);
assert.match(evidence, /Hwahae `toner_essence`: `26`/);
assert.match(evidence, /Hwahae `treatment`: `102`/);
assert.match(evidence, /Production Product count: `165`/);
assert.match(evidence, /Production Product shadow assignments: `165`/);
assert.match(evidence, /c7ec481493af9075f891d4a089b53302/);
assert.match(evidence, /364282a34496ed047c74bf7d354d443f/);
assert.match(evidence, /88096291b54e626615dc81ce679baa79/);
assert.match(evidence, /6363c54ab4cfc2a4662ec489218fd843/);
assert.match(evidence, /f228d90b5dcd85e3a7dbf7163d60fa46/);
assert.match(evidence, /Production migration applied: `false`/);
assert.match(evidence, /Recommendation runtime cutover: `false`/);
assert.match(evidence, /legacy promotion authority remains unchanged/i);
assert.match(evidence, /reserved_shadow/i);
assert.match(evidence, /unknown\/unmapped raw category/i);

console.log(JSON.stringify({
  result: "PASS",
  contract: "DATA-TAXONOMY2",
  taxonomyVersion: "catalog-taxonomy-v1",
  candidateClassificationContract: "candidate-catalog-taxonomy-classification-v1",
  currentSourceRuleCount: currentSourceRules.size,
  candidatePromotionProjectionGapClosed: 3,
  unknownCategoryBehavior: "unresolved_fail_closed",
  reservedVocabularyBehavior: "reserved_shadow_non_admissible",
  productWriteAllowed: false,
  productPromotionAuthorityChanged: false,
  recommendationAdmissionAllowed: false,
  recommendationRuntimeCutover: false,
  productionMigrationApplied: false,
}, null, 2));
