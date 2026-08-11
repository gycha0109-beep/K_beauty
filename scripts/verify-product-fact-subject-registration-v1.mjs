#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsRoot = path.join(root, "supabase", "migrations");
const names = readdirSync(migrationsRoot)
  .filter((name) => /^\d{14}_product_fact_subject_registration_v1\.sql$/.test(name));

assert.equal(names.length, 1, "expected one Product Fact subject registration v1 migration");
const migrationName = names[0];
const sql = readFileSync(path.join(migrationsRoot, migrationName), "utf8").replace(/\r\n?/g, "\n");

function fail(code, detail = code) {
  const error = new Error(detail);
  error.code = code;
  throw error;
}

function audit(value) {
  let assertions = 0;
  const check = (condition, code, detail = code) => {
    if (!condition) fail(code, detail);
    assertions += 1;
  };
  const lower = value.toLowerCase();

  check(/^begin;[\s\S]*commit;\s*$/i.test(value.trim()), "atomic_migration_missing");
  check(!/\bcreate\s+table\b/i.test(value), "create_table_forbidden");
  check(!/\b(?:alter|drop|truncate)\s+table\s+public\.product_fact_/i.test(value), "pf2_table_mutation_forbidden");
  check(!/\b(?:insert\s+into|update|delete\s+from)\s+public\.products\b/i.test(value), "catalog_write_forbidden");

  const start = lower.indexOf("create or replace function public.admin_register_product_fact_subject_v1(");
  check(start >= 0, "subject_rpc_missing");
  const tail = lower.slice(start);
  const end = tail.indexOf("\n$$;");
  check(end > 0, "subject_rpc_unterminated");
  const block = tail.slice(0, end + 4);

  check(block.includes("security definer"), "security_definer_missing");
  check(/set\s+search_path\s*=\s*public\s*,\s*pg_temp/.test(block), "search_path_uncontrolled");
  check(block.includes("'admin.products.review'"), "capability_gate_missing");
  for (const token of [
    "subject_semantic_key",
    "subject_identity_serializer_version",
    "variant_key",
    "formulation_revision_key",
    "identity_status",
    "identity_resolution_version",
    "current_state",
    "market_applicability",
    "region_applicability",
    "predecessor_subject_id",
    "supersession_kind"
  ]) {
    check(block.includes(token), "subject_identity_token_missing", token);
  }
  check(block.includes("identity_status not in ('resolved', 'ambiguous', 'unresolved')"), "identity_status_guard_missing");
  check(block.includes("current_state not in ('provisional', 'current', 'historical')"), "current_state_guard_missing");
  check(block.includes("v_current_state = 'current' and v_identity_status <> 'resolved'"), "current_requires_resolved_missing");
  check(block.includes("v_valid_from >= v_valid_to"), "half_open_validity_guard_missing");
  check(block.includes("'reformulation', 'identity_correction', 'semantic_variant_split'"), "supersession_kind_guard_missing");
  check(block.includes("product_fact_subject_semantic_key_conflict"), "semantic_key_conflict_missing");
  check(block.includes("'idempotent', true"), "idempotent_replay_missing");
  check(block.includes("insert into public.product_fact_subjects"), "subject_insert_missing");
  check(!/\bupdate\s+public\.product_fact_subjects\b/.test(block), "subject_mutable_update_forbidden");
  check(block.includes("subject_registered"), "review_event_missing");
  check(block.includes("record_admin_audit_event"), "admin_audit_missing");

  check(
    /revoke\s+all\s+on\s+function\s+public\.admin_register_product_fact_subject_v1\(uuid,\s*text,\s*jsonb\)\s+from\s+public,\s*anon,\s*authenticated,\s*service_role;/i.test(value),
    "rpc_revoke_missing"
  );
  check(
    /grant\s+execute\s+on\s+function\s+public\.admin_register_product_fact_subject_v1\(uuid,\s*text,\s*jsonb\)\s+to\s+service_role;/i.test(value),
    "service_role_allowlist_missing"
  );
  check(
    !/grant\s+execute[\s\S]{0,240}admin_register_product_fact_subject_v1[\s\S]{0,240}to\s+(?:anon|authenticated|public)/i.test(value),
    "browser_execute_forbidden"
  );
  check(
    !/grant\s+(?:all|insert|update|delete|truncate)[\s\S]{0,180}product_fact_subjects[\s\S]{0,180}service_role/i.test(value),
    "service_role_table_write_forbidden"
  );
  check(lower.includes("product_fact_subject_registration_direct_write_exposed"), "runtime_direct_write_postcondition_missing");
  check(lower.includes("product_fact_subject_registration_rpc_privilege_invalid"), "runtime_rpc_postcondition_missing");

  const topLevel = value.replace(/create\s+or\s+replace\s+function[\s\S]*?\n\$\$;\s*(?=\n)/gi, " ");
  check(
    !/\binsert\s+into\s+public\.product_fact_subjects\b/i.test(topLevel),
    "operational_subject_seed_forbidden"
  );

  return assertions;
}

function expectFailure(mutated, code) {
  let thrown;
  try { audit(mutated); } catch (error) { thrown = error; }
  assert.ok(thrown, `mutation should fail: ${code}`);
  assert.equal(thrown.code, code, `unexpected mutation failure: ${thrown?.code}`);
}

const assertions = audit(sql);
const mutations = [
  ["security_definer_missing", sql.replace(/security definer/i, "")],
  ["current_requires_resolved_missing", sql.replace("v_current_state = 'current' and v_identity_status <> 'resolved'", "false")],
  ["semantic_key_conflict_missing", sql.replace("product_fact_subject_semantic_key_conflict", "product_fact_subject_semantic_key_reused")],
  ["subject_mutable_update_forbidden", sql.replace("  return v_result;", "  update public.product_fact_subjects set updated_at = now() where subject_id = v_subject_id;\n  return v_result;")],
  ["browser_execute_forbidden", sql.replace(/\ncommit;\s*$/i, "\ngrant execute on function public.admin_register_product_fact_subject_v1(uuid,text,jsonb) to authenticated;\ncommit;\n")],
  ["service_role_table_write_forbidden", sql.replace(/\ncommit;\s*$/i, "\ngrant insert on table public.product_fact_subjects to service_role;\ncommit;\n")],
  ["operational_subject_seed_forbidden", sql.replace(/\ncommit;\s*$/i, "\ninsert into public.product_fact_subjects default values;\ncommit;\n")]
];
for (const [code, mutated] of mutations) expectFailure(mutated, code);

console.log(JSON.stringify({
  status: "PASS",
  migration: migrationName,
  assertions,
  negative_mutation_cases: mutations.length,
  runtime_database_replay: "NOT_PERFORMED_BY_STATIC_VERIFIER",
  guarantees: [
    "immutable_subject_registration",
    "semantic_key_idempotency",
    "resolved_current_gate",
    "half_open_validity",
    "supersession_lineage",
    "service_role_rpc_only",
    "direct_table_write_absent",
    "operational_seed_absent"
  ]
}, null, 2));
