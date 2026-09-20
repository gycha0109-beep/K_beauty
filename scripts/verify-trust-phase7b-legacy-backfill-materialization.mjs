#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260921004500_trust_phase7b_legacy_backfill_materialization_v1.sql",
);

if (!fs.existsSync(migrationPath)) throw new Error("missing Phase 7-B migration");

const sql = fs.readFileSync(migrationPath, "utf8");
const lower = sql.toLowerCase();

for (const needle of [
  "create or replace function public.materialize_trust_legacy_catalog_backfill_v1",
  "security definer",
  "set search_path = public, extensions, pg_temp",
  "preflight_trust_legacy_catalog_backfill_v1(500,null)",
  "trust_phase7b_preflight_fingerprint_stale",
  "trust_phase7b_subject_conflict_present",
  "trust_phase7b_noncurrent_subject_review_present",
  "trust_phase7b_registry_gap_present",
  "GOVERNED_SUBJECT",
  "SUBJECT_REVIEW",
  "EXISTING_GOVERNED_SUBJECT",
  "SUBJECT_CREATION_REQUIRED",
  "ALREADY_COVERED",
  "RESEARCH_REQUIRED",
  "RESEARCH_PENDING",
  "REVIEW_REQUIRED",
  "legacy-backfill-v1:",
  "market_inferred',false",
  "product_fact_authority_mutation',false",
  "recommendation_mutation',false",
  "market_inference_performed',false",
  "pg_advisory_xact_lock",
  "insert into public.catalog_trust_intake",
  "insert into public.product_fact_research_tasks",
  "grant execute on function public.materialize_trust_legacy_catalog_backfill_v1(text,text,integer,uuid)",
]) {
  if (!sql.includes(needle)) throw new Error("Phase 7-B contract missing: " + needle);
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
  "insert into public.recommendation",
  "update public.recommendation",
  "delete from public.recommendation",
  "admin_confirm_product_fact_v1",
  "admin_register_product_fact_subject_v1",
  "resolve_catalog_trust_subject_v1(",
  "process_catalog_trust_product_v1(",
]) {
  if (lower.includes(forbidden)) {
    throw new Error("forbidden Phase 7-B authority/reprocessing path: " + forbidden);
  }
}

if (!sql.includes("s.market_applicability is not distinct from v_market")) {
  throw new Error("Phase 7-B must preserve exact governed Subject market, including NULL");
}
if (!sql.includes("v_market is not null")) {
  throw new Error("Phase 7-B Subject-review cohort must reject inferred/non-null market");
}
if (!sql.includes("on conflict (product_id,catalog_revision) do nothing")) {
  throw new Error("Phase 7-B intake materialization must be idempotent");
}
if (!sql.includes("trust_phase7b_replay_task_missing")) {
  throw new Error("Phase 7-B replay must verify previously materialized tasks");
}
if (!sql.includes("revoke all on function public.materialize_trust_legacy_catalog_backfill_v1")) {
  throw new Error("Phase 7-B function ACL revoke missing");
}

console.log("TRUST_PHASE7B_LEGACY_BACKFILL_MATERIALIZATION_STATIC_VERIFIED");
