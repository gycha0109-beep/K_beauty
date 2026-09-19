import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const migrationPath = path.join(
  root,
  "supabase/migrations/20260919090000_trust_phase6a_reentry_foundation_v1.sql"
);
const libPath = path.join(root, "lib/admin/trust-reentry.js");
const preflightPath = path.join(root, "app/api/admin/trust/reentry/preflight/route.js");
const confirmPath = path.join(root, "app/api/admin/trust/reentry/confirm/route.js");
const uiPath = path.join(root, "app/admin/products/trust/TrustReentryAction.js");

for (const file of [migrationPath, libPath, preflightPath, confirmPath, uiPath]) {
  if (!fs.existsSync(file)) throw new Error(`missing:${path.relative(root,file)}`);
}

const sql = fs.readFileSync(migrationPath, "utf8");
const lib = fs.readFileSync(libPath, "utf8");
const routes =
  fs.readFileSync(preflightPath, "utf8") +
  fs.readFileSync(confirmPath, "utf8");
const ui = fs.readFileSync(uiPath, "utf8");

const requiredSql = [
  "create table public.trust_reentry_events",
  "'SOURCE_CHANGED'",
  "'FORMULATION_CHANGED'",
  "'POLICY_CHANGED'",
  "'REGISTRY_CHANGED'",
  "'MANUAL_RETRY'",
  "SOURCE_CHANGED_REVIEW_REQUIRED",
  "FORMULATION_CHANGED_REVIEW_REQUIRED",
  "create or replace function public.request_trust_reentry_v1",
  "create or replace function public.process_trust_reentry_event_v1",
  "grant execute on function public.request_trust_reentry_v1",
  "grant execute on function public.process_trust_reentry_event_v1",
  "to service_role",
  "GOVERNED_OR_COVERED_STATE_PRESERVED",
  "MANUAL_RETRY_ELIGIBLE_RESEARCH_BLOCKER"
];
for (const needle of requiredSql) {
  if (!sql.includes(needle)) throw new Error(`migration contract missing: ${needle}`);
}

for (const forbidden of [
  "delete from public.product_fact_current",
  "insert into public.product_fact_current",
  "update public.product_fact_current",
  "insert into public.product_fact_subjects",
  "update public.product_fact_subjects",
  "delete from public.product_fact_subjects",
  "admin_confirm_product_fact_v1",
  "recommendationRuntimeCutover = true"
]) {
  if (sql.toLowerCase().includes(forbidden.toLowerCase())) {
    throw new Error(`forbidden authority mutation: ${forbidden}`);
  }
}

if (!routes.includes("ADMIN_CAPABILITIES.PRODUCTS_REVIEW")) {
  throw new Error("manual revalidation must require admin.products.review");
}
if (!routes.includes("isAllowedAdminMutationRequest")) {
  throw new Error("manual revalidation routes must enforce same-origin policy");
}
if (!lib.includes("trust_reentry_stale_preflight")) {
  throw new Error("stale preflight guard missing");
}
if (!lib.includes("currentInvalidation: false")) {
  throw new Error("Current preservation contract missing");
}
if (!ui.includes("강제 초기화가 아니며")) {
  throw new Error("operator UI must explain non-destructive retry semantics");
}

console.log("TRUST_PHASE6A_REENTRY_STATIC_VERIFIED");
