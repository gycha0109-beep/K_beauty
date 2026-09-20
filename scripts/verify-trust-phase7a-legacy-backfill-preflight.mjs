#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260920233114_trust_phase7a_legacy_backfill_preflight_v1.sql",
);

if (!fs.existsSync(migrationPath)) throw new Error("missing Phase 7-A migration");

const sql = fs.readFileSync(migrationPath, "utf8");
const lower = sql.toLowerCase();

for (const needle of [
  "create or replace function public.preflight_trust_legacy_catalog_backfill_v1",
  "stable",
  "legacy_products_without_product_candidate_lineage",
  "pc.matched_product_id = p.id",
  "EXISTING_GOVERNED_SUBJECT",
  "SUBJECT_CREATION_REQUIRED",
  "ALREADY_COVERED",
  "RESEARCH_REQUIRED",
  "REVIEW_REQUIRED",
  "REGISTRY_GAP",
  "'blocker_code',q.blocker_code",
  "product_fact_current",
  "catalog_required_product_facts_v1",
  "trust-phase7a-catalog-revision-v1",
  "'brand',p.brand",
  "'name',p.name",
  "'category',p.category",
  "'has_more',v_has_more",
  "market_inferred",
  "writes_performed",
  "grant execute on function public.preflight_trust_legacy_catalog_backfill_v1(integer,uuid)",
]) {
  if (!sql.includes(needle)) throw new Error("Phase 7-A contract missing: " + needle);
}

for (const forbidden of [
  "insert into public.catalog_trust_intake",
  "update public.catalog_trust_intake",
  "delete from public.catalog_trust_intake",
  "insert into public.product_fact_research_tasks",
  "update public.product_fact_research_tasks",
  "delete from public.product_fact_research_tasks",
  "insert into public.product_fact_subjects",
  "update public.product_fact_subjects",
  "delete from public.product_fact_subjects",
  "insert into public.product_evidence_records",
  "update public.product_evidence_records",
  "delete from public.product_evidence_records",
  "insert into public.product_fact_current",
  "update public.product_fact_current",
  "delete from public.product_fact_current",
  "admin_confirm_product_fact_v1",
  "'identity_pending'",
]) {
  if (lower.includes(forbidden)) {
    throw new Error("forbidden Phase 7-A write/authority mutation: " + forbidden);
  }
}

if (!sql.includes("market_inference_performed',false")) {
  throw new Error("Phase 7-A must explicitly attest no market inference");
}
if (!sql.includes("writes_performed',false")) {
  throw new Error("Phase 7-A must explicitly attest no writes");
}
if (!sql.includes("from public.product_fact_current c")) {
  throw new Error("ALREADY_COVERED must derive from governed Current");
}
if (!sql.includes("fi.subject_id=s.subject_id")) {
  throw new Error("Current coverage must preserve exact Subject lineage");
}
if (!sql.includes("from public.product_candidates pc")) {
  throw new Error("legacy target must exclude product_candidate lineage");
}
if (!sql.includes("extensions.digest(")) {
  throw new Error("catalog revision and batch fingerprint must be deterministic hashes");
}
if (lower.includes("max(product_id)")) {
  throw new Error("Phase 7-A must not use unsupported max(uuid) aggregation");
}

if (!sql.includes("revoke all on function public.preflight_trust_legacy_catalog_backfill_v1")) {
  throw new Error("function ACL revoke missing");
}

console.log("TRUST_PHASE7A_LEGACY_BACKFILL_PREFLIGHT_STATIC_VERIFIED");
