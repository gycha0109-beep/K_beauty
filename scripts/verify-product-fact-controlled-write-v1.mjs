#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsRoot = path.join(root, "supabase", "migrations");

function normalizeLineEndings(value) {
  return value.replace(/\r\n?/g, "\n");
}

function fail(code, detail = code) {
  const error = new Error(detail);
  error.code = code;
  throw error;
}

function stripComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\r\n]*/g, " ");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function functionBlock(sql, functionName) {
  const startPattern = new RegExp(
    `create\\s+or\\s+replace\\s+function\\s+public\\.${escapeRegExp(functionName)}\\s*\\(`,
    "i"
  );
  const start = startPattern.exec(sql);
  if (!start) fail("required_function_missing", functionName);
  const tail = sql.slice(start.index);
  const end = /\n\$\$;\s*(?=\n)/.exec(tail);
  if (!end) fail("function_definition_unterminated", functionName);
  return tail.slice(0, end.index + end[0].length);
}

function maskFunctionBodies(sql) {
  return sql.replace(
    /create\s+or\s+replace\s+function[\s\S]*?\n\$\$;\s*(?=\n)/gi,
    " "
  );
}

const migrationNames = readdirSync(migrationsRoot)
  .filter((name) => /^\d{14}_product_fact_controlled_write_v1\.sql$/.test(name));

assert.equal(
  migrationNames.length,
  1,
  "expected exactly one Product Fact controlled-write v1 migration"
);

const migrationName = migrationNames[0];
const migrationSql = normalizeLineEndings(
  readFileSync(path.join(migrationsRoot, migrationName), "utf8")
);

const externalFunctions = Object.freeze([
  "admin_publish_product_fact_registry_v1",
  "admin_ingest_product_fact_evidence_v1",
  "admin_prepare_product_fact_review_v1",
  "admin_preflight_product_fact_confirmation_v1",
  "admin_confirm_product_fact_v1"
]);

const internalFunctions = Object.freeze([
  "product_fact_controlled_json_exact_keys_v1",
  "product_fact_controlled_canonical_json_v1",
  "product_fact_controlled_sha256_json_v1",
  "product_fact_controlled_authority_rank_v1",
  "product_fact_controlled_latest_registry_v1",
  "product_fact_controlled_binding_is_current_v1",
  "product_fact_controlled_build_preflight_v1"
]);

const pf2Tables = Object.freeze([
  "product_fact_registry_versions",
  "product_fact_definition_snapshots",
  "product_fact_subjects",
  "product_evidence_sources",
  "product_evidence_source_subject_bindings",
  "product_evidence_records",
  "product_fact_instances",
  "product_fact_evidence_links",
  "product_fact_confirmations",
  "product_fact_current",
  "product_fact_review_assignments",
  "product_fact_review_events"
]);

function auditSql(sql) {
  let assertions = 0;
  const clean = stripComments(sql);
  const lower = clean.toLowerCase();
  const check = (condition, code, detail = code) => {
    if (!condition) fail(code, detail);
    assertions += 1;
  };

  check(/^begin;[\s\S]*commit;\s*$/i.test(clean.trim()), "atomic_migration_missing");
  check(!/\bcreate\s+table\b/i.test(clean), "pf2_redesign_create_table_forbidden");

  for (const table of pf2Tables) {
    const tablePattern = escapeRegExp(table);
    check(
      !new RegExp(
        `\\b(?:alter|drop|truncate)\\s+table\\s+(?:if\\s+exists\\s+)?public\\.${tablePattern}\\b`,
        "i"
      ).test(clean),
      "pf2_table_mutation_forbidden",
      table
    );
  }

  const topLevel = stripComments(maskFunctionBodies(clean)).toLowerCase();
  check(
    !/\b(?:insert\s+into|update|delete\s+from)\s+public\.(?:product_fact_|product_evidence_)/i.test(topLevel),
    "operational_seed_or_top_level_write_forbidden"
  );
  check(
    !/\bselect\s+public\.admin_(?:publish|ingest|prepare|confirm|preflight)_product_fact/i.test(topLevel),
    "controlled_operation_top_level_invocation_forbidden"
  );
  check(
    !/\b(?:insert\s+into|update|delete\s+from)\s+public\.(?:products|product_candidates|candidate_promotion_reviews)\b/i.test(clean),
    "legacy_catalog_write_forbidden"
  );

  for (const functionName of [...externalFunctions, ...internalFunctions]) {
    check(
      new RegExp(
        `create\\s+or\\s+replace\\s+function\\s+public\\.${escapeRegExp(functionName)}\\s*\\(`,
        "i"
      ).test(clean),
      "required_function_missing",
      functionName
    );
  }

  for (const functionName of externalFunctions) {
    const block = functionBlock(clean, functionName).toLowerCase();
    check(block.includes("security definer"), "external_rpc_security_definer_missing", functionName);
    check(
      /set\s+search_path\s*=\s*public(?:\s*,\s*extensions)?\s*,\s*pg_temp/.test(block),
      "external_rpc_search_path_uncontrolled",
      functionName
    );
  }

  const registry = functionBlock(clean, "admin_publish_product_fact_registry_v1").toLowerCase();
  check(
    registry.includes("'admin.operations.execute'"),
    "registry_operation_capability_missing"
  );
  check(
    registry.includes("product_fact_registry_checksum_mismatch")
      && registry.includes("product_fact_registry_definition_checksum_mismatch"),
    "registry_digest_validation_missing"
  );
  check(
    registry.includes("product_fact_registry_version_conflict")
      && registry.includes("'idempotent', true"),
    "registry_idempotency_contract_missing"
  );
  check(
    registry.includes("insert into public.product_fact_registry_versions")
      && registry.includes("insert into public.product_fact_definition_snapshots"),
    "registry_publish_write_set_missing"
  );

  const evidence = functionBlock(clean, "admin_ingest_product_fact_evidence_v1").toLowerCase();
  check(evidence.includes("'admin.products.review'"), "evidence_operation_capability_missing");
  check(
    evidence.includes("exact_subject_match")
      && evidence.includes("equivalent_presentation_match")
      && evidence.includes("scope_relation not in ('equivalent', 'narrower')"),
    "evidence_resolved_binding_scope_gate_missing"
  );
  check(
    evidence.includes("product_fact_negative_evidence_contract_invalid")
      && evidence.includes("explicit_negative")
      && evidence.includes("conflict_opposition"),
    "negative_evidence_guard_missing"
  );
  check(
    evidence.includes("product_fact_market_popularity_authority_forbidden")
      && evidence.includes("support_direction' <> 'context_only'")
      && evidence.includes("evidence_authority' <> 'none'"),
    "market_popularity_authority_guard_missing"
  );
  check(
    evidence.includes("permitted_evidence_classes"),
    "registry_evidence_class_gate_missing"
  );
  check(
    evidence.includes("insert into public.product_evidence_sources")
      && evidence.includes("insert into public.product_evidence_source_subject_bindings")
      && evidence.includes("insert into public.product_evidence_records"),
    "evidence_ingest_write_set_missing"
  );
  check(
    !/insert\s+into\s+public\.product_fact_instances/.test(evidence)
      && !/insert\s+into\s+public\.product_fact_current/.test(evidence)
      && !/insert\s+into\s+public\.product_fact_confirmations/.test(evidence),
    "evidence_ingest_fact_promotion_forbidden"
  );

  const prepare = functionBlock(clean, "admin_prepare_product_fact_review_v1").toLowerCase();
  check(prepare.includes("'admin.products.review'"), "review_prepare_capability_missing");
  check(
    prepare.includes("insert into public.product_fact_review_assignments")
      && prepare.includes("review_assignment_prepared")
      && prepare.includes("review_assignment_transitioned"),
    "review_prepare_assignment_event_missing"
  );
  check(
    prepare.includes("ready_for_confirm")
      && prepare.includes("identity_status <> 'resolved'")
      && prepare.includes("current_state <> 'current'"),
    "ready_for_confirm_subject_gate_missing"
  );
  check(
    prepare.includes("product_fact_review_prepare_transition_invalid"),
    "review_transition_guard_missing"
  );

  const preflight = functionBlock(clean, "product_fact_controlled_build_preflight_v1").toLowerCase();
  check(preflight.includes("'admin.products.review'"), "preflight_capability_missing");
  check(
    !/\binsert\s+into\b/.test(preflight)
      && !/\bupdate\s+public\./.test(preflight)
      && !/\bdelete\s+from\b/.test(preflight)
      && !preflight.includes("record_admin_audit_event"),
    "dry_run_write_detected"
  );
  for (const token of [
    "ready_for_confirm",
    "product_fact_confirmation_assignment_stale",
    "product_fact_confirmation_subject_stale",
    "product_fact_confirmation_registry_stale",
    "product_fact_confirmation_evidence_stale",
    "product_fact_controlled_binding_is_current_v1",
    "product_fact_supported_false_requires_explicit_negative",
    "product_fact_conflict_requires_support_and_opposition",
    "product_fact_confirmation_authority_ceiling_invalid",
    "product_fact_market_popularity_fact_input_forbidden",
    "fusion_input_digest",
    "payload_digest",
    "prestate_digest",
    "evidence_state_digest",
    "binding_state_digest",
    "current_state_digest",
    "expected_write_set"
  ]) {
    check(preflight.includes(token), "preflight_contract_token_missing", token);
  }
  check(
    preflight.includes("semantic_status <> 'supported'")
      && preflight.includes("product_fact_confirmation_non_supported_value_forbidden"),
    "missing_not_false_semantic_guard_missing"
  );

  const dryRun = functionBlock(
    clean,
    "admin_preflight_product_fact_confirmation_v1"
  ).toLowerCase();
  check(
    !/\binsert\s+into\b|\bupdate\s+public\.|\bdelete\s+from\b/.test(dryRun),
    "public_dry_run_write_detected"
  );
  check(
    dryRun.includes("product_fact_controlled_build_preflight_v1"),
    "public_dry_run_shared_revalidation_missing"
  );

  const confirm = functionBlock(clean, "admin_confirm_product_fact_v1").toLowerCase();
  check(confirm.includes("'admin.products.review'"), "confirm_capability_missing");
  check(
    confirm.includes("bejewely_product_fact_confirmation_request:")
      && confirm.includes("bejewely_product_fact_proposition:"),
    "confirm_advisory_lock_missing"
  );
  check(
    confirm.includes("product_fact_confirmation_request_conflict")
      && confirm.includes("v_existing.payload_digest <> v_expected_payload_digest")
      && confirm.includes("v_existing.prestate_digest <> v_expected_prestate_digest")
      && confirm.includes("'idempotent', true"),
    "confirm_idempotency_conflict_contract_missing"
  );
  check(
    confirm.includes("product_fact_controlled_build_preflight_v1")
      && confirm.includes("product_fact_confirmation_stale_preflight")
      && confirm.includes("v_preflight ->> 'prestate_digest' <> v_expected_prestate_digest"),
    "confirm_stale_revalidation_missing"
  );

  const orderedWrites = [
    "insert into public.product_fact_instances",
    "insert into public.product_fact_evidence_links",
    "insert into public.product_fact_confirmations",
    "insert into public.product_fact_current",
    "update public.product_fact_review_assignments",
    "insert into public.product_fact_review_events"
  ];
  let lastIndex = -1;
  for (const write of orderedWrites) {
    const index = confirm.indexOf(write);
    check(index > lastIndex, "confirm_atomic_write_order_invalid", write);
    lastIndex = index;
  }

  check(
    confirm.includes("confirmation_id = excluded.confirmation_id")
      && confirm.includes("product_fact_confirmation_assignment_transition_failed"),
    "current_confirmation_or_assignment_guard_missing"
  );
  check(
    !/\bexception\s+when\s+others\b/.test(confirm),
    "confirm_exception_swallow_forbidden"
  );
  check(
    confirm.includes("supersedes_fact_instance_id"),
    "fact_history_supersession_missing"
  );

  for (const functionName of externalFunctions) {
    const escaped = escapeRegExp(functionName);
    check(
      new RegExp(
        `revoke\\s+all\\s+on\\s+function\\s+public\\.${escaped}\\([\\s\\S]*?\\)\\s+from\\s+public\\s*,\\s*anon\\s*,\\s*authenticated\\s*,\\s*service_role\\s*;`,
        "i"
      ).test(clean),
      "external_rpc_revoke_all_missing",
      functionName
    );
    check(
      new RegExp(
        `grant\\s+execute\\s+on\\s+function\\s+public\\.${escaped}\\([\\s\\S]*?\\)\\s+to\\s+service_role\\s*;`,
        "i"
      ).test(clean),
      "external_rpc_service_role_allowlist_missing",
      functionName
    );
  }

  check(
    !/grant\s+(?:all|insert|update|delete|truncate)[\s\S]{0,160}on\s+table\s+public\.(?:product_fact_|product_evidence_)[\s\S]{0,160}to\s+service_role/i.test(clean),
    "broad_service_role_table_write_forbidden"
  );
  check(
    !/grant\s+execute\s+on\s+function\s+public\.admin_(?:publish|ingest|prepare|preflight|confirm)_product_fact[\s\S]{0,240}to\s+(?:anon|authenticated|public)/i.test(clean),
    "browser_rpc_execute_forbidden"
  );

  for (const helper of internalFunctions) {
    const escaped = escapeRegExp(helper);
    check(
      new RegExp(
        `revoke\\s+all\\s+on\\s+function\\s+public\\.${escaped}\\([\\s\\S]*?\\)\\s+from\\s+public\\s*,\\s*anon\\s*,\\s*authenticated\\s*,\\s*service_role\\s*;`,
        "i"
      ).test(clean),
      "internal_helper_revoke_missing",
      helper
    );
    check(
      !new RegExp(
        `grant\\s+execute\\s+on\\s+function\\s+public\\.${escaped}\\([\\s\\S]*?\\)\\s+to\\s+(?:anon|authenticated|service_role)`,
        "i"
      ).test(clean),
      "internal_helper_execute_exposed",
      helper
    );
  }

  check(
    lower.includes("product_fact_controlled_write_direct_table_write_exposed")
      && lower.includes("product_fact_controlled_write_rpc_privilege_invalid"),
    "migration_security_postcondition_missing"
  );

  return assertions;
}

function expectFailure(sql, expectedCode) {
  let thrown = null;
  try {
    auditSql(sql);
  } catch (error) {
    thrown = error;
  }
  assert.ok(thrown, `mutation should fail: ${expectedCode}`);
  assert.equal(thrown.code, expectedCode, `unexpected mutation failure: ${thrown?.code}`);
}

const assertions = auditSql(migrationSql);

const mutations = [
  {
    code: "external_rpc_security_definer_missing",
    sql: migrationSql.replace(
      /(create or replace function public\.admin_confirm_product_fact_v1[\s\S]*?language plpgsql\s+)security definer/i,
      "$1"
    )
  },
  {
    code: "browser_rpc_execute_forbidden",
    sql: migrationSql.replace(/\ncommit;\s*$/i, "\ngrant execute on function public.admin_confirm_product_fact_v1(uuid,text,jsonb,text,text) to authenticated;\n\ncommit;\n")
  },
  {
    code: "broad_service_role_table_write_forbidden",
    sql: migrationSql.replace(/\ncommit;\s*$/i, "\ngrant insert on table public.product_fact_instances to service_role;\n\ncommit;\n")
  },
  {
    code: "dry_run_write_detected",
    sql: migrationSql.replace(
      "  v_payload_digest := public.product_fact_controlled_sha256_json_v1(p_payload);",
      "  insert into public.product_fact_instances default values;\n  v_payload_digest := public.product_fact_controlled_sha256_json_v1(p_payload);"
    )
  },
  {
    code: "confirm_idempotency_conflict_contract_missing",
    sql: migrationSql.replace(
      "product_fact_confirmation_request_conflict",
      "product_fact_confirmation_request_replaced"
    )
  },
  {
    code: "confirm_stale_revalidation_missing",
    sql: migrationSql.replace(
      "v_preflight ->> 'prestate_digest' <> v_expected_prestate_digest",
      "false"
    )
  },
  {
    code: "preflight_contract_token_missing",
    sql: migrationSql.replace(
      "product_fact_supported_false_requires_explicit_negative",
      "product_fact_supported_false_unchecked"
    )
  },
  {
    code: "preflight_contract_token_missing",
    sql: migrationSql.replace(
      "product_fact_controlled_binding_is_current_v1(evidence.binding_id)",
      "true"
    )
  },
  {
    code: "current_confirmation_or_assignment_guard_missing",
    sql: migrationSql.replace(
      "confirmation_id = excluded.confirmation_id",
      "confirmation_id = product_fact_current.confirmation_id"
    )
  },
  {
    code: "confirm_exception_swallow_forbidden",
    sql: migrationSql.replace(
      "  return v_result || jsonb_build_object('audit_id', v_audit_id);\nend;\n$$;\n\nrevoke all on function public.product_fact_controlled_json_exact_keys_v1",
      () => "  return v_result || jsonb_build_object('audit_id', v_audit_id);\nexception when others then\n  return '{}'::jsonb;\nend;\n$$;\n\nrevoke all on function public.product_fact_controlled_json_exact_keys_v1"
    )
  },
  {
    code: "controlled_operation_top_level_invocation_forbidden",
    sql: migrationSql.replace(/\ncommit;\s*$/i, "\nselect public.admin_confirm_product_fact_v1(null, 'request-1', '{}'::jsonb, repeat('0',64), repeat('0',64));\n\ncommit;\n")
  }
];

for (const mutation of mutations) {
  expectFailure(mutation.sql, mutation.code);
}

console.log(JSON.stringify({
  status: "PASS",
  migration: migrationName,
  assertions,
  negative_mutation_cases: mutations.length,
  runtime_database_replay: "NOT_PERFORMED_BY_STATIC_VERIFIER",
  guarantees: [
    "pf2_table_invariance",
    "controlled_rpc_security",
    "dry_run_product_fact_write_zero_static",
    "confirm_atomic_write_shape",
    "idempotency_conflict_guards",
    "stale_state_revalidation",
    "supported_false_explicit_negative",
    "missing_not_false",
    "market_popularity_authority_guard",
    "broad_service_role_table_write_absent",
    "operational_seed_absent"
  ]
}, null, 2));
