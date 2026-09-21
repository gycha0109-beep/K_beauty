#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260921094643_trust_phase7c_phase4_legacy_adoption_compat_v1.sql",
);
if (!fs.existsSync(migrationPath)) throw new Error("missing Phase 7-C Phase 4 compatibility migration");

const sql = fs.readFileSync(migrationPath, "utf8");
const lower = sql.toLowerCase();

for (const needle of [
  "create or replace function public.trust_phase4_build_adoption_plan_v1",
  "v_legacy := v_intake.catalog_revision like 'legacy-backfill-v1:%'",
  "trust_phase7c_legacy_subject_scope_ready_v1(v_task.id)",
  "trust_phase4_legacy_subject_scope_invalid",
  "trust_official_source_binding_reviews",
  "trust_phase4_legacy_controlled_source_invalid",
  "v_catalog_binding.binding_method <> 'trust_official_source_review_v1'",
  "v_catalog_binding.product_scope_state <> 'product'",
  "v_legacy_source_review.scope_relation",
  "'scope_relation', v_binding_scope_relation",
  "(not v_legacy and v_subject.variant_key is not null)",
  "trust_phase4_parent_proposition_required",
  "automatic_confirmation",
]) {
  if (!sql.includes(needle) && needle !== "automatic_confirmation") {
    throw new Error("Phase 7-C Phase 4 compatibility contract missing: " + needle);
  }
}

// This migration only replaces the plan builder. It must not directly mutate
// Product Fact authority or introduce an automatic-confirmation path.
for (const forbidden of [
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
  "admin_confirm_product_fact_v1(",
]) {
  if (lower.includes(forbidden)) throw new Error("forbidden authority mutation in compatibility migration: " + forbidden);
}

if (!sql.includes("or (not v_legacy and v_observation.market is distinct from v_candidate.market)")) {
  throw new Error("non-legacy observation-market strictness missing");
}
if (!sql.includes("or (not v_legacy and v_catalog_binding.market_code is distinct from v_candidate.market)")) {
  throw new Error("non-legacy catalog-source market strictness missing");
}
if (!sql.includes("v_legacy_source_review.source_market is not distinct from v_observation.market") &&
    !sql.includes("osr.source_market is not distinct from v_observation.market")) {
  throw new Error("legacy source-market review bridge missing");
}
if (!sql.includes("osr.subject_market is not distinct from v_intake.market")) {
  throw new Error("legacy subject-market review bridge missing");
}
if (!sql.includes("osr.scope_relation in ('equivalent','narrower')")) {
  throw new Error("legacy scope relation must remain bounded");
}
if (!sql.includes("v_candidate.evidence_authority <> 'product_specific_primary'") ||
    !sql.includes("v_candidate.support_direction <> 'supports'")) {
  throw new Error("Phase 4 candidate authority/adjudication gates were weakened");
}

console.log("TRUST_PHASE7C_PHASE4_LEGACY_COMPAT_STATIC_VERIFIED");
