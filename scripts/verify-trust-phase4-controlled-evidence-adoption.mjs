#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";

const basePath = "supabase/migrations/20260917195000_trust_phase4_controlled_evidence_adoption_v1.sql";
const hardeningPath = "supabase/migrations/20260917195100_trust_phase4_controlled_evidence_adoption_fusion_hardening_v1.sql";
const base = fs.readFileSync(basePath, "utf8");
const hardening = fs.readFileSync(hardeningPath, "utf8");
const sql = `${base}\n${hardening}`;
let assertions = 0;
const check = (condition, message) => {
  assertions += 1;
  assert.ok(condition, message);
};

const stable = (value) => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
    : value;
const digest = (value) => crypto.createHash("sha256")
  .update(JSON.stringify(stable(value)))
  .digest("hex");

check(base.includes("create or replace function public.trust_phase4_build_adoption_plan_v1"), "internal adoption plan missing");
check(base.includes("create or replace function public.admin_preflight_trust_evidence_adoption_v1"), "Phase 4 preflight missing");
check(base.includes("create or replace function public.admin_adopt_trust_evidence_candidate_v1"), "Phase 4 adoption RPC missing");
check(hardening.includes("create or replace function public.admin_adopt_trust_evidence_candidate_v1"), "fusion-hardening RPC replacement missing");
check((sql.match(/security definer/gi) ?? []).length === 4, "all Phase 4 function definitions must be SECURITY DEFINER");
check((sql.match(/set search_path = public, extensions, pg_temp/gi) ?? []).length === 4, "fixed search_path missing");

check(base.includes("perform public.admin_require_product_review_actor"), "admin.products.review actor gate missing");
check(base.includes("'admin.products.review'"), "review capability missing");
check(base.includes("v_candidate.candidate_state <> 'READY'"), "READY candidate gate missing");
check(base.includes("v_task.state <> 'EVIDENCE_CANDIDATE'"), "Phase 3 task state gate missing");
check(base.includes("v_intake.identity_state <> 'EXACT_SUBJECT_FOUND'"), "exact intake identity gate missing");
check(base.includes("v_subject.identity_status <> 'resolved'"), "resolved Subject gate missing");
check(base.includes("v_subject.current_state <> 'current'"), "current Subject gate missing");
check(base.includes("v_subject.variant_key is not null"), "product-scoped Subject gate missing");
check(base.includes("v_catalog_binding.source_name !~ '_official$'"), "official-source binding gate missing");
check(base.includes("v_catalog_binding.source_url !~ '^https://'"), "HTTPS source gate missing");
check(base.includes("trust_phase4_parent_proposition_required"), "parent lineage fail-closed gate missing");

check(base.includes("trust_phase4_source_observation_digest_mismatch"), "observation digest tamper gate missing");
check(base.includes("trust_phase4_candidate_digest_mismatch"), "candidate digest tamper gate missing");
check(base.includes("trust_phase4_governed_evidence_collision"), "governed Evidence collision gate missing");
check(base.includes("trust_phase4_proposition_collision"), "proposition collision gate missing");
check(base.includes("trust_phase4_cardinality_collision"), "cardinality-one collision gate missing");
check(base.includes("trust_phase4_candidate_already_current"), "already-current gate missing");

check(base.includes("'serializer_version', 'product-fact-proposition-pilot-v1'"), "canonical serializer version missing");
check(base.includes("'subject_semantic_key', v_subject.subject_semantic_key"), "subject semantic identity missing");
check(base.includes("'value_identity', v_candidate.normalized_value"), "value identity missing");
check(base.includes("jsonb_strip_nulls(jsonb_build_object("), "scope null stripping missing");
check(base.includes("'parent_proposition_key', null"), "bounded parent identity missing");
check(base.includes("array['amount','unit']"), "number_unit amount/unit contract missing");
check(base.includes("array['min','max','unit']"), "range_unit contract missing");

check(hardening.includes("select * into v_evidence"), "governed Evidence readback missing");
check(hardening.includes("v_evidence.canonical_evidence_digest <> v_plan ->> 'canonical_evidence_digest'"), "governed Evidence digest readback gate missing");
check(hardening.includes("'registry_version', v_plan ->> 'registry_version'"), "fusion registry identity missing");
check(hardening.includes("'subject_id', (v_plan ->> 'subject_id')::uuid"), "fusion Subject identity missing");
check(hardening.includes("'fact_key', v_plan ->> 'fact_key'"), "fusion fact identity missing");
check(hardening.includes("'proposition_key', v_plan ->> 'proposition_key'"), "fusion proposition identity missing");
check(hardening.includes("'evidence_id', v_evidence.evidence_id"), "fusion governed Evidence id missing");
check(hardening.includes("'role', 'supporting'"), "fusion Evidence role missing");
check(hardening.includes("'canonical_evidence_digest', v_evidence.canonical_evidence_digest"), "fusion Evidence digest missing");
check(hardening.includes("'evidence_authority', v_evidence.evidence_authority"), "fusion authority missing");
check(hardening.includes("'confidence', v_evidence.confidence"), "fusion confidence missing");
check(hardening.includes("'support_direction', v_evidence.support_direction"), "fusion support direction missing");
check(hardening.includes("'negative_admissibility', v_evidence.negative_admissibility"), "fusion negative admissibility missing");
check(hardening.includes("v_preflight ->> 'fusion_input_digest' <> v_fusion_input_digest"), "governed fusion readback equality gate missing");

check(sql.includes("public.admin_ingest_product_fact_evidence_v1("), "governed Evidence ingest delegation missing");
check(sql.includes("public.admin_prepare_product_fact_review_v1("), "governed review delegation missing");
check(sql.includes("public.admin_preflight_product_fact_confirmation_v1("), "governed Product Fact preflight delegation missing");
check(!sql.includes("admin_confirm_product_fact_v1("), "Phase 4 must never invoke final Product Fact confirmation");
check(sql.includes("'automatic_confirmation', false"), "automatic confirmation boundary missing");
check(sql.includes("'ready_for_explicit_confirmation'"), "explicit confirmation handoff missing");
check(sql.includes("'confirmation_payload', v_confirmation_payload"), "explicit confirmation payload handoff missing");
check(sql.includes("'confirmation_request_id', v_confirmation_request_id"), "explicit confirmation request id missing");

for (const table of [
  "product_evidence_sources",
  "product_evidence_source_subject_bindings",
  "product_evidence_records",
  "product_fact_instances",
  "product_fact_evidence_links",
  "product_fact_confirmations",
  "product_fact_current"
]) {
  const directWrite = new RegExp(`\\b(?:insert\\s+into|update|delete\\s+from)\\s+public\\.${table}\\b`, "i");
  check(!directWrite.test(sql), `direct governed table DML forbidden: ${table}`);
}

check(base.includes("revoke all on function public.trust_phase4_build_adoption_plan_v1"), "internal helper revoke missing");
check(sql.includes("from public, anon, authenticated, service_role"), "broad revoke boundary missing");
check(base.includes("grant execute on function public.admin_preflight_trust_evidence_adoption_v1"), "preflight service-role grant missing");
check(hardening.includes("grant execute on function public.admin_adopt_trust_evidence_candidate_v1"), "final adoption service-role grant missing");
check(!/grant\s+execute[\s\S]{0,180}\bto\s+(?:public|anon|authenticated)\b/i.test(sql), "browser execution grant forbidden");

const subjectSemanticKey = "e9b46ca78c3cc630403d66bb01b1d25d665f21941e2d430629d1c67a54578161";
const registryVersion = "product-fact-registry-cross-category-v1";
const scope = { market: "KR", variant: "DIVE_IN_MILD_SUN_CREAM_KR_60ML" };
const spf = digest({
  serializer_version: "product-fact-proposition-pilot-v1",
  subject_semantic_key: subjectSemanticKey,
  registry_version: registryVersion,
  fact_key: "spf_value",
  value_identity: 50,
  scope,
  qualifier: { plus_modifier: "plus" },
  parent_proposition_key: null
});
const uva = digest({
  serializer_version: "product-fact-proposition-pilot-v1",
  subject_semantic_key: subjectSemanticKey,
  registry_version: registryVersion,
  fact_key: "uva_label",
  value_identity: "PA++++",
  scope,
  qualifier: {},
  parent_proposition_key: null
});
check(spf === "059777b9cc342c1abd9da8b3f71604b5da717acbfba10a3a7ad65c02e9aa0a49", "P22 SPF proposition replay mismatch");
check(uva === "c5f231cf12bb6ca29a54bf097e1a01fb84f6bb1c1434a50ea919ef9b7909d6fb", "P22 UVA proposition replay mismatch");

console.log(JSON.stringify({
  status: "PASS",
  phase: "TRUST_PHASE4_CONTROLLED_EVIDENCE_ADOPTION_STATIC",
  assertions,
  serializer: "product-fact-proposition-pilot-v1",
  p22_replay: "PASS",
  governed_fusion_identity: "PASS",
  automatic_confirmation: false,
  direct_governed_table_dml: 0
}, null, 2));
