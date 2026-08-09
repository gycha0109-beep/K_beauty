#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsRoot = path.join(root, "supabase", "migrations");
const baseline = "0a0c11b0ee8c64766b730f70a859f2348b79cb5e";
const verifierPath = "scripts/verify-product-fact-storage-migration-v1.mjs";

const requiredTables = Object.freeze([
  "product_fact_registry_versions",
  "product_fact_definition_snapshots",
  "product_fact_subjects",
  "product_evidence_sources",
  "product_evidence_source_subject_bindings",
  "product_evidence_records",
  "product_fact_instances",
  "product_fact_evidence_links",
  "product_fact_current",
  "product_fact_review_assignments",
  "product_fact_review_events",
  "product_fact_confirmations"
]);

const migrationNames = readdirSync(migrationsRoot)
  .filter((name) => /^\d{14}_product_fact_storage_v1\.sql$/.test(name));
assert.equal(migrationNames.length, 1, "expected exactly one Product Fact storage v1 migration");

const migrationName = migrationNames[0];
const migrationPath = `supabase/migrations/${migrationName}`;
const migrationSql = readFileSync(path.join(migrationsRoot, migrationName), "utf8");

function fail(code, detail = code) {
  const error = new Error(detail);
  error.code = code;
  throw error;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\r\n]*/g, " ");
}

function tableBlock(sql, tableName) {
  const clean = stripComments(sql);
  const startPattern = new RegExp(
    `create\\s+table\\s+public\\.${escapeRegExp(tableName)}\\s*\\(`,
    "i"
  );
  const start = startPattern.exec(clean);
  if (!start) fail("required_table_missing", tableName);
  const tail = clean.slice(start.index);
  const close = /^\);\s*$/m.exec(tail);
  if (!close) fail("table_definition_unterminated", tableName);
  return tail.slice(0, close.index + close[0].length).toLowerCase();
}

function auditSql(sql, { checkGitScope = false } = {}) {
  let assertions = 0;
  const clean = stripComments(sql).toLowerCase();
  const check = (condition, code, detail = code) => {
    if (!condition) fail(code, detail);
    assertions += 1;
  };
  const matches = (value, pattern) => pattern.test(value);

  check(/^begin;[\s\S]*commit;\s*$/i.test(sql.trim()), "atomic_migration_missing");

  const blocks = new Map();
  for (const tableName of requiredTables) {
    const block = tableBlock(sql, tableName);
    blocks.set(tableName, block);
    check(Boolean(block), "required_table_missing", tableName);
  }

  const subjects = blocks.get("product_fact_subjects");
  check(
    matches(subjects, /product_id\s+uuid\s+not\s+null\s+references\s+public\.products\s*\(id\)/),
    "subject_product_fk_missing"
  );
  check(
    subjects.includes("constraint product_fact_subjects_predecessor_product_fk")
      && /foreign\s+key\s*\(predecessor_subject_id,\s*product_id\)/.test(subjects),
    "subject_predecessor_fk_missing"
  );
  check(
    subjects.includes("constraint product_fact_subjects_predecessor_self_check"),
    "subject_predecessor_self_check_missing"
  );
  check(
    subjects.includes("constraint product_fact_subjects_validity_check")
      && /valid_from\s+is\s+null\s+or\s+valid_to\s+is\s+null\s+or\s+valid_from\s*<\s*valid_to/.test(subjects),
    "subject_validity_check_missing"
  );
  check(
    /identity_status\s+in\s*\(\s*'resolved'\s*,\s*'ambiguous'\s*,\s*'unresolved'\s*\)/.test(subjects),
    "identity_state_check_missing"
  );
  check(
    /create\s+unique\s+index\s+product_fact_subjects_current_applicability_unique[\s\S]*?nulls\s+not\s+distinct[\s\S]*?where\s+identity_status\s*=\s*'resolved'\s+and\s+current_state\s*=\s*'current'/.test(clean),
    "current_subject_collision_guard_missing"
  );
  check(
    !/(brand|commercial_name|normalized_name|size|volume|source_url)\s+(text|uuid|numeric)/.test(subjects),
    "subject_identity_forbidden_dimension"
  );

  const definitions = blocks.get("product_fact_definition_snapshots");
  for (const valueType of [
    "boolean",
    "enum",
    "number",
    "number_unit",
    "range_unit",
    "entity_identifier"
  ]) {
    check(definitions.includes(`'${valueType}'`), "registry_value_type_missing", valueType);
  }

  const sources = blocks.get("product_evidence_sources");
  check(sources.includes("canonical_locator text not null"), "safe_source_locator_missing");
  check(sources.includes("content_digest text not null"), "source_digest_missing");
  check(!/raw_(body|html|content)/.test(sources), "raw_source_body_column_forbidden");

  const bindings = blocks.get("product_evidence_source_subject_bindings");
  check(
    /source_id\s+uuid\s+not\s+null\s+references\s+public\.product_evidence_sources\s*\(source_id\)/.test(bindings),
    "binding_source_fk_missing"
  );
  check(
    bindings.includes("constraint product_evidence_source_subject_bindings_subject_product_fk"),
    "binding_subject_fk_missing"
  );
  check(
    bindings.includes("constraint product_evidence_source_subject_bindings_state_check"),
    "binding_state_check_missing"
  );
  for (const state of [
    "exact_subject_match",
    "equivalent_presentation_match",
    "product_family_only",
    "variant_ambiguous",
    "formulation_ambiguous",
    "identity_unresolved",
    "disjoint_subject"
  ]) {
    check(bindings.includes(`'${state}'`), "binding_state_missing", state);
  }
  for (const relation of ["equivalent", "narrower", "broader", "disjoint", "overlapping"]) {
    check(bindings.includes(`'${relation}'`), "scope_relation_missing", relation);
  }
  check(
    bindings.includes("constraint product_evidence_source_subject_bindings_target_check"),
    "binding_target_fail_closed_check_missing"
  );

  const evidence = blocks.get("product_evidence_records");
  check(
    evidence.includes("constraint product_evidence_records_binding_gate_fk"),
    "evidence_binding_fk_missing"
  );
  check(
    evidence.includes("constraint product_evidence_records_source_fk"),
    "evidence_source_fk_missing"
  );
  check(
    evidence.includes("constraint product_evidence_records_definition_fk"),
    "evidence_registry_definition_fk_missing"
  );
  check(
    /subject_id\s+uuid\s+not\s+null\s+references\s+public\.product_fact_subjects\s*\(subject_id\)/.test(evidence),
    "evidence_subject_fk_missing"
  );
  check(
    /binding_state\s+in\s*\(\s*'exact_subject_match'\s*,\s*'equivalent_presentation_match'\s*\)/.test(evidence),
    "evidence_resolved_binding_gate_missing"
  );
  for (const evidenceClass of [
    "product_claim",
    "measurement",
    "observation",
    "usage_instruction",
    "composition_identity",
    "physical_characteristic",
    "role_declaration",
    "legacy_catalog_observation"
  ]) {
    check(evidence.includes(`'${evidenceClass}'`), "evidence_class_missing", evidenceClass);
  }
  for (const direction of ["supports", "opposes", "context_only"]) {
    check(evidence.includes(`'${direction}'`), "support_direction_missing", direction);
  }
  check(
    evidence.includes("constraint product_evidence_records_validity_check"),
    "evidence_validity_check_missing"
  );
  check(
    evidence.includes("canonical_evidence_digest text not null"),
    "canonical_evidence_digest_missing"
  );
  check(
    evidence.includes("constraint product_evidence_records_supersedes_fk"),
    "evidence_version_supersession_fk_missing"
  );

  const facts = blocks.get("product_fact_instances");
  check(
    /subject_id\s+uuid\s+not\s+null\s+references\s+public\.product_fact_subjects\s*\(subject_id\)/.test(facts),
    "fact_subject_fk_missing"
  );
  check(
    facts.includes("constraint product_fact_instances_definition_fk"),
    "fact_registry_definition_fk_missing"
  );
  for (const status of [
    "supported",
    "reviewed_not_established",
    "not_reviewed",
    "evidence_insufficient",
    "evidence_conflict"
  ]) {
    check(facts.includes(`'${status}'`), "semantic_status_missing", status);
  }
  for (const forbiddenOperationalStatus of [
    "queued",
    "assigned",
    "under_review",
    "identity_blocked",
    "source_blocked",
    "needs_adjudication",
    "ready_for_confirm",
    "confirmed",
    "stale",
    "re_review_required",
    "superseded"
  ]) {
    check(
      !facts.includes(`'${forbiddenOperationalStatus}'`),
      "operational_state_in_semantic_fact_status",
      forbiddenOperationalStatus
    );
  }
  check(
    facts.includes("constraint product_fact_instances_typed_value_check")
      && /semantic_status\s*<>\s*'supported'[\s\S]*?value_boolean\s+is\s+null/.test(facts)
      && /value_type\s*=\s*'boolean'[\s\S]*?value_boolean\s+is\s+not\s+null/.test(facts),
    "typed_value_discriminator_missing"
  );
  check(!/value_boolean\s*=\s*true/.test(facts), "supported_false_not_representable");
  check(
    facts.includes("constraint product_fact_instances_parent_fk")
      && /foreign\s+key\s*\(parent_fact_instance_id,\s*parent_proposition_key,\s*subject_id\)/.test(facts),
    "relationship_fact_lineage_fk_missing"
  );
  check(
    facts.includes("constraint product_fact_instances_supersedes_fk"),
    "fact_version_supersession_fk_missing"
  );

  const links = blocks.get("product_fact_evidence_links");
  check(links.includes("primary key (fact_instance_id, evidence_id)"), "fact_evidence_link_uniqueness_missing");
  check(links.includes("constraint product_fact_evidence_links_fact_fk"), "fact_evidence_fact_fk_missing");
  check(
    links.includes("constraint product_fact_evidence_links_evidence_fk"),
    "fact_evidence_evidence_fk_missing"
  );
  check(
    /link_role\s+in\s*\(\s*'supporting'\s*,\s*'opposing'\s*\)/.test(links),
    "evidence_link_role_check_missing"
  );

  const current = blocks.get("product_fact_current");
  check(
    /proposition_key\s+text\s+primary\s+key/.test(current),
    "current_proposition_uniqueness_missing"
  );
  check(
    current.includes("constraint product_fact_current_fact_fk")
      && /foreign\s+key\s*\(fact_instance_id,\s*proposition_key,\s*subject_id\)/.test(current),
    "current_fact_composite_fk_missing"
  );
  check(
    /confirmation_id\s+uuid\s+not\s+null\s+references\s+public\.product_fact_confirmations\s*\(confirmation_id\)/.test(current),
    "current_confirmation_fk_missing"
  );

  const assignments = blocks.get("product_fact_review_assignments");
  check(
    assignments.includes("constraint product_fact_review_assignments_operational_state_check"),
    "review_operational_state_check_missing"
  );
  check(
    assignments.includes("constraint product_fact_review_assignments_subject_product_fk"),
    "review_assignment_subject_fk_missing"
  );
  check(
    assignments.includes("constraint product_fact_review_assignments_definition_fk"),
    "review_assignment_definition_fk_missing"
  );
  for (const semanticStatus of [
    "supported",
    "reviewed_not_established",
    "evidence_insufficient",
    "evidence_conflict"
  ]) {
    check(
      !assignments.includes(`'${semanticStatus}'`),
      "semantic_status_in_operational_assignment",
      semanticStatus
    );
  }

  const confirmations = blocks.get("product_fact_confirmations");
  for (const digestColumn of ["payload_digest", "prestate_digest", "result_digest"]) {
    check(confirmations.includes(`${digestColumn} text not null`), "confirmation_digest_missing", digestColumn);
  }
  check(
    confirmations.includes("actor_user_id uuid not null references auth.users(id)"),
    "confirmation_actor_fk_missing"
  );
  const events = blocks.get("product_fact_review_events");
  check(
    events.includes("actor_user_id uuid not null references auth.users(id)"),
    "review_event_actor_fk_missing"
  );
  for (const [column, table, target] of [
    ["assignment_id", "product_fact_review_assignments", "assignment_id"],
    ["subject_id", "product_fact_subjects", "subject_id"],
    ["evidence_id", "product_evidence_records", "evidence_id"],
    ["fact_instance_id", "product_fact_instances", "fact_instance_id"],
    ["confirmation_id", "product_fact_confirmations", "confirmation_id"]
  ]) {
    check(
      new RegExp(
        `${column}\\s+uuid[\\s\\S]*?references\\s+public\\.${table}\\s*\\(${target}\\)`
      ).test(events),
      "review_event_semantic_fk_missing",
      `${column}->${table}`
    );
  }

  check(
    !/(alter|drop|truncate)\s+table\s+(if\s+exists\s+)?public\.product_metadata_field_reviews\b/.test(clean),
    "legacy_structure_mutation_forbidden"
  );
  check(
    !/(alter|drop|truncate)\s+table\s+(if\s+exists\s+)?public\.admin_product_review_[a-z0-9_]+\b/.test(clean),
    "legacy_admin_structure_mutation_forbidden"
  );
  check(
    !/(alter|drop|truncate)\s+table\s+(if\s+exists\s+)?public\.products\b/.test(clean),
    "products_structure_mutation_forbidden"
  );
  check(!/\b(update|delete\s+from)\s+public\.products\b/.test(clean), "catalog_mutation_forbidden");
  check(
    !/insert\s+into\s+public\.(product_fact_|product_evidence_)[a-z0-9_]+/.test(clean),
    "product_fact_backfill_forbidden"
  );
  for (const forbiddenSeed of [
    "uva_regulatory_label_broad_spectrum",
    "uv_water_resistance_rating",
    "general_irritation_observed",
    "subjective_soothing_observed"
  ]) {
    check(!clean.includes(forbiddenSeed), "phase3b_candidate_seed_forbidden", forbiddenSeed);
  }

  for (const tableName of requiredTables) {
    const table = escapeRegExp(tableName);
    check(
      new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security\\s*;`).test(clean),
      "rls_enable_missing",
      tableName
    );
    check(
      new RegExp(
        `revoke\\s+all\\s+on\\s+table\\s+public\\.${table}\\s+from\\s+public\\s*,\\s*anon\\s*,\\s*authenticated\\s*,\\s*service_role\\s*;`
      ).test(clean),
      "fail_closed_revoke_missing",
      tableName
    );
    check(
      new RegExp(`grant\\s+select\\s+on\\s+table\\s+public\\.${table}\\s+to\\s+service_role\\s*;`).test(clean),
      "service_role_read_grant_missing",
      tableName
    );
  }
  check(
    !/create\s+policy[\s\S]*?on\s+public\.(product_fact_|product_evidence_)/.test(clean),
    "browser_policy_forbidden"
  );
  check(
    !/grant\s+(select|insert|update|delete|all)([\s,]+(select|insert|update|delete))*\s+on\s+table\s+public\.(product_fact_|product_evidence_)[a-z0-9_]+\s+to\s+(public|anon|authenticated)\b/.test(clean),
    "browser_write_permission_forbidden"
  );
  check(
    !/grant\s+(insert|update|delete|all)([\s,]+(insert|update|delete|select))*\s+on\s+table\s+public\.(product_fact_|product_evidence_)[a-z0-9_]+\s+to\s+service_role\b/.test(clean),
    "unimplemented_direct_write_grant_forbidden"
  );

  if (checkGitScope) {
    const git = (args) => execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();
    check(git(["rev-parse", "--is-inside-work-tree"]) === "true", "real_git_checkout_required");
    execFileSync("git", ["cat-file", "-e", `${baseline}^{commit}`], { cwd: root, stdio: "ignore" });
    check(git(["merge-base", baseline, "HEAD"]) === baseline, "baseline_not_ancestor");

    const changed = new Set();
    for (const args of [
      ["diff", "--name-only", `${baseline}...HEAD`],
      ["diff", "--cached", "--name-only"],
      ["diff", "--name-only"],
      ["ls-files", "--others", "--exclude-standard"]
    ]) {
      for (const file of git(args).split(/\r?\n/).filter(Boolean)) changed.add(file.replaceAll("\\", "/"));
    }

    const allowed = new Set([migrationPath, verifierPath, ".codex/AI_WORK_LOG.md"]);
    check(changed.has(migrationPath), "migration_not_in_git_delta");
    check(changed.has(verifierPath), "verifier_not_in_git_delta");
    for (const file of changed) check(allowed.has(file), "git_scope_forbidden_path", file);
  }

  return assertions;
}

function removeNamedConstraint(sql, constraintName) {
  const pattern = new RegExp(
    `\\n\\s*constraint\\s+${escapeRegExp(constraintName)}[\\s\\S]*?,(?=\\n\\s*constraint\\s+)`,
    "i"
  );
  const mutated = sql.replace(pattern, "");
  assert.notEqual(mutated, sql, `negative fixture did not remove ${constraintName}`);
  return mutated;
}

function expectAuditFailure(name, sql, code) {
  try {
    auditSql(sql);
  } catch (error) {
    assert.equal(error.code, code, `${name}: expected ${code}, received ${error.code || error.message}`);
    return;
  }
  assert.fail(`${name}: expected verifier failure`);
}

function injectBeforeCommit(sql, statement) {
  const mutated = sql.replace(/\ncommit;\s*$/i, `\n${statement}\n\ncommit;\n`);
  assert.notEqual(mutated, sql, "negative fixture did not locate final commit");
  return mutated;
}

const assertions = auditSql(migrationSql, { checkGitScope: true });

const negativeCases = [
  [
    "subject_product_fk_removed",
    migrationSql.replace(
      "product_id uuid not null references public.products(id) on delete restrict,",
      "product_id uuid not null,"
    ),
    "subject_product_fk_missing"
  ],
  [
    "current_proposition_uniqueness_removed",
    migrationSql.replace("proposition_key text primary key,", "proposition_key text not null,"),
    "current_proposition_uniqueness_missing"
  ],
  [
    "validity_check_removed",
    removeNamedConstraint(migrationSql, "product_fact_subjects_validity_check"),
    "subject_validity_check_missing"
  ],
  [
    "binding_state_check_removed",
    removeNamedConstraint(
      migrationSql,
      "product_evidence_source_subject_bindings_state_check"
    ),
    "binding_state_check_missing"
  ],
  [
    "typed_value_discriminator_removed",
    removeNamedConstraint(migrationSql, "product_fact_instances_typed_value_check"),
    "typed_value_discriminator_missing"
  ],
  [
    "legacy_scalar_alter_added",
    injectBeforeCommit(
      migrationSql,
      "alter table public.product_metadata_field_reviews add column pf2_forbidden text;"
    ),
    "legacy_structure_mutation_forbidden"
  ],
  [
    "product_fact_backfill_added",
    injectBeforeCommit(migrationSql, "insert into public.product_fact_subjects default values;"),
    "product_fact_backfill_forbidden"
  ],
  [
    "browser_write_permission_added",
    injectBeforeCommit(
      migrationSql,
      "grant insert on table public.product_fact_subjects to authenticated;"
    ),
    "browser_write_permission_forbidden"
  ]
];

for (const [name, sql, code] of negativeCases) expectAuditFailure(name, sql, code);

console.log("PASS verify-product-fact-storage-migration-v1");
console.log(`migration=${migrationPath}`);
console.log(`required_tables=${requiredTables.length}`);
console.log(`assertions=${assertions}`);
console.log(`negative_cases=${negativeCases.length}`);
for (const [name] of negativeCases) console.log(`negative:${name}=PASS`);
console.log("git_scope=PASS");
console.log("database_apply=NOT_RUN_STATIC_ONLY");
