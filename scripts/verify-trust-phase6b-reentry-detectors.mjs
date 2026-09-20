// TRUST Phase 6-B static contract verifier.
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const migrationPath = path.join(
  root,
  "supabase/migrations/20260920200010_trust_phase6b_reentry_detectors_v1.sql",
);

if (!fs.existsSync(migrationPath)) {
  throw new Error("missing Phase 6-B migration");
}

const sql = fs.readFileSync(migrationPath, "utf8");

for (const needle of [
  "create table public.trust_reentry_detector_checkpoints",
  "'OFFICIAL_SOURCE_SET'",
  "'SOURCE_OBSERVATION_DIGEST'",
  "'IDENTITY_SCOPE'",
  "'REQUIRED_FACT_POLICY'",
  "'PRODUCT_FACT_REGISTRY'",
  "create or replace function public.observe_trust_reentry_signal_v1",
  "create or replace function public.run_trust_reentry_detectors_v1",
  "public.request_trust_reentry_v1",
  "public.process_trust_reentry_event_v1",
  "SOURCE_CHANGED",
  "FORMULATION_CHANGED",
  "POLICY_CHANGED",
  "REGISTRY_CHANGED",
  "source_name ~ '_official$'",
  "source_url ~ '^https://'",
  "catalog_required_product_facts_v1",
  "product_fact_definition_snapshots",
  "grant execute on function public.run_trust_reentry_detectors_v1(integer)",
]) {
  if (!sql.includes(needle)) {
    throw new Error(`Phase 6-B contract missing: ${needle}`);
  }
}

for (const forbidden of [
  "create trigger",
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
  "recommendationRuntimeCutover = true",
]) {
  if (sql.toLowerCase().includes(forbidden.toLowerCase())) {
    throw new Error(`forbidden Phase 6-B authority mutation: ${forbidden}`);
  }
}

if (!sql.includes("'status','baselined'") || !sql.includes("'status','no_change'")) {
  throw new Error("first-observation baseline / unchanged semantics missing");
}
if (!sql.includes("'previous_signal'") || !sql.includes("'current_signal'")) {
  throw new Error("deterministic drift payload missing");
}
if (!sql.includes("'authority_mutation'") || !sql.includes("'current_invalidated'")) {
  throw new Error("Phase 6-A review-only processing assertions missing");
}
if (!sql.includes("revoke all on table public.trust_reentry_detector_checkpoints")) {
  throw new Error("checkpoint direct-access denial missing");
}
if (!sql.includes("revoke all on function public.observe_trust_reentry_signal_v1")) {
  throw new Error("private detector bridge execute denial missing");
}

console.log("TRUST_PHASE6B_REENTRY_DETECTORS_STATIC_VERIFIED");
