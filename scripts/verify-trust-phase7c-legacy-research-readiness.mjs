#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260921190000_trust_phase7c_legacy_research_readiness_v1.sql",
);

if (!fs.existsSync(migrationPath)) throw new Error("missing Phase 7-C migration");

const sql = fs.readFileSync(migrationPath, "utf8");
const lower = sql.toLowerCase();

for (const needle of [
  "create table public.trust_official_source_binding_reviews",
  "create or replace function public.trust_phase7c_legacy_subject_scope_ready_v1",
  "create or replace function public.trust_phase7c_has_controlled_official_source_v1",
  "create or replace function public.admin_register_trust_official_source_binding_v1",
  "create or replace function public.preflight_trust_legacy_research_readiness_v1",
  "create or replace function public.claim_trust_research_tasks_v1",
  "create or replace function public.record_trust_research_result_v1",
  "create or replace function public.process_trust_reentry_event_v1",
  "trust-phase7b-legacy-materialization-v1",
  "trust-official-source-review-v1",
  "trust_official_source_review_v1",
  "OFFICIAL_SOURCE_REQUIRED",
  "LEGACY_SUBJECT_SCOPE_BLOCKED",
  "LEGACY_IDENTITY_SNAPSHOT_PRESERVED",
  "LEGACY_MANUAL_RETRY_READY",
  "i.catalog_revision not like 'legacy-backfill-v1:%'",
  "and s.variant_key is null",
  "s.variant_key is not distinct from nullif(i.identity_resolution_detail->>'variant_key','')",
  "s.formulation_revision_key is not distinct from nullif(i.identity_resolution_detail->>'formulation_revision_key','')",
  "psb.product_scope_state='product'",
  "psb.binding_method='trust_official_source_review_v1'",
  "subject_market text",
  "source_market text",
  "scope_relation text not null",
  "trust_official_source_narrower_scope_not_governed",
  "eb.binding_state='exact_subject_match'",
  "eb.scope_relation in ('equivalent','narrower')",
  "public.admin_require_product_review_actor",
  "'admin.products.review'",
  "public.record_admin_audit_event",
  "revoke all on table public.trust_official_source_binding_reviews",
  "grant execute on function public.admin_register_trust_official_source_binding_v1(uuid,text,jsonb)",
  "grant execute on function public.preflight_trust_legacy_research_readiness_v1(integer,uuid)",
]) {
  if (!sql.includes(needle)) throw new Error("Phase 7-C contract missing: " + needle);
}

for (const forbidden of [
  "insert into public.product_fact_subjects",
  "update public.product_fact_subjects",
  "delete from public.product_fact_subjects",
  "insert into public.product_evidence_records",
  "update public.product_evidence_records",
  "delete from public.product_evidence_records",
  "insert into public.product_fact_instances",
  "update public.product_fact_instances",
  "delete from public.product_fact_instances",
  "insert into public.product_fact_confirmations",
  "update public.product_fact_confirmations",
  "delete from public.product_fact_confirmations",
  "insert into public.product_fact_current",
  "update public.product_fact_current",
  "delete from public.product_fact_current",
  "admin_confirm_product_fact_v1",
  "admin_register_product_fact_subject_v1(",
]) {
  if (lower.includes(forbidden)) {
    throw new Error("forbidden Phase 7-C authority path: " + forbidden);
  }
}

const legacyBlockStart = sql.indexOf("if v_intake.id is not null\n    and v_intake.catalog_revision like 'legacy-backfill-v1:%'");
const nonLegacyStart = sql.indexOf("  else\n    perform public.process_catalog_trust_product_v1(v_event.product_id);", legacyBlockStart);
if (legacyBlockStart < 0 || nonLegacyStart < 0) {
  throw new Error("Phase 7-C legacy/non-legacy re-entry split missing");
}
const legacyReentry = sql.slice(legacyBlockStart, nonLegacyStart);
if (legacyReentry.includes("process_catalog_trust_product_v1(")) {
  throw new Error("legacy re-entry must never call generic Phase 2 resolver");
}

if (!sql.includes("select * into v_intake\n    from public.catalog_trust_intake\n    where product_id=v_event.product_id\n      and catalog_revision like 'legacy-backfill-v1:%'")) {
  throw new Error("product-level legacy retry snapshot preservation missing");
}

if (!sql.includes("i.catalog_revision not like 'legacy-backfill-v1:%'\n          and s.variant_key is null") ||
    !sql.includes("elsif v_subject.variant_key is not null then")) {
  throw new Error("non-legacy Phase 3 variant behavior must remain unchanged");
}

if (!sql.includes("v_intake.catalog_revision not like 'legacy-backfill-v1:%'") &&
    !sql.includes("i.catalog_revision not like 'legacy-backfill-v1:%'")) {
  throw new Error("non-legacy behavior split missing");
}

console.log("TRUST_PHASE7C_LEGACY_RESEARCH_READINESS_STATIC_VERIFIED");
