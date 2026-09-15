import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();

function read(path) {
  const absolute = resolve(root, path);
  if (!existsSync(absolute)) throw new Error(`missing file: ${path}`);
  return readFileSync(absolute, "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function includes(text, value, label) {
  assert(text.includes(value), `${label} missing: ${value}`);
}

function excludes(text, value, label) {
  assert(!text.includes(value), `${label} unexpectedly contains: ${value}`);
}

const foundation = read(
  "supabase/migrations/20260915093000_trust_phase1_intake_foundation_v1.sql"
);
const hardening = read(
  "supabase/migrations/20260915094000_trust_phase1_intake_delivery_hardening_v1.sql"
);
const runtime = read(
  "tests/fixtures/trust-intake-foundation/verify_trust_intake_foundation_runtime.sql"
);
const fixture = read(
  "tests/fixtures/trust-intake-foundation/20260915090000_trust_intake_foundation_fixture.sql"
);
const combined = `${foundation}\n${hardening}`;

[
  "create table if not exists public.catalog_trust_intake",
  "create table if not exists public.product_fact_research_tasks",
  "constraint catalog_trust_intake_product_revision_key unique (product_id, catalog_revision)",
  "constraint product_fact_research_tasks_intake_fact_key unique (intake_id, fact_key, registry_version, research_policy_version)",
  "product_fact_research_tasks_subject_fact_key",
  "alter table public.catalog_trust_intake enable row level security",
  "alter table public.product_fact_research_tasks enable row level security",
  "revoke all on table public.catalog_trust_intake from public, anon, authenticated, service_role",
  "revoke all on table public.product_fact_research_tasks from public, anon, authenticated, service_role",
  "create or replace function public.catalog_required_product_facts_v1",
  "create trigger product_candidate_trust_intake_enqueue_v1",
  "create or replace function public.process_catalog_trust_product_v1",
  "create or replace function public.read_catalog_trust_product_status_v1",
  "grant execute on function public.process_catalog_trust_product_v1(uuid)",
  "grant execute on function public.read_catalog_trust_product_status_v1(uuid)"
].forEach((value) => includes(combined, value, "TRUST Phase 1 migration"));

[
  "('sunscreen', 'spf_value'",
  "('sunscreen', 'uva_label'",
  "('sunscreen', 'uv_filter_type'",
  "('cleanser', 'low_ph'",
  "('cleanser', 'deep_cleansing'",
  "('toner_pad', 'pad_surface_texture'",
  "('toner_pad', 'wipe_off_use'",
  "('treatment', 'active_concentration'",
  "('moisturizer_cream', 'barrier_support_claim'"
].forEach((value) => includes(foundation, value, "required Fact policy"));

[
  "('sunscreen', 'water_resistance_duration'",
  "('sunscreen', 'eye_sting_observed'",
  "('sunscreen', 'white_cast_observed'",
  "('treatment', 'treatment_claim'",
  "('cleanser', 'fragrance_declared'"
].forEach((value) => excludes(foundation, value, "conservative required Fact policy"));

[
  "old.review_status is distinct from 'promoted'::public.product_review_status",
  "'candidate:' || new.id::text",
  "case when lower(coalesce(new.source_name, '')) = 'hwahae' then 'KR' else null end",
  "on conflict (product_id, catalog_revision) do nothing"
].forEach((value) => includes(foundation, value, "promotion intake delivery"));

[
  "market_applicability = v_intake.market",
  "fi.fact_key = v_policy.fact_key",
  "v_task_state := 'ALREADY_COVERED'",
  "v_task_state := 'IDENTITY_PENDING'",
  "v_task_state := 'RESEARCH_PENDING'",
  "where t.subject_id = v_subject_id",
  "and t.research_policy_version = 'product-fact-required-policy-v1'",
  "v_open_count = 0"
].forEach((value) => includes(hardening, value, "Current short-circuit/idempotency"));

[
  "v_result := public.promote_product_candidate_structural_v1",
  "perform public.process_catalog_trust_product_v1(v_product_id)",
  "exception when others then",
  "Task processing is retryable and must never roll back catalog promotion"
].forEach((value) => includes(hardening, value, "best-effort promotion processing"));

assert(
  !/(insert\s+into|update|delete\s+from)\s+public\.(product_fact_instances|product_fact_current|product_fact_confirmations|product_evidence_records|product_fact_subjects)\b/i.test(
    combined
  ),
  "Phase 1 migration must not mutate Product Fact authority relations"
);
assert(
  !/(insert\s+into|update|delete\s+from)\s+public\.recommendation/i.test(combined),
  "Phase 1 migration must not mutate Recommendation relations"
);
assert(
  !/grant\s+execute[\s\S]{0,180}process_catalog_trust_product_v1[\s\S]{0,80}to\s+(?:anon|authenticated|public)/i.test(
    combined
  ),
  "TRUST processor must not be browser-callable"
);
assert(
  !/grant\s+execute[\s\S]{0,180}read_catalog_trust_product_status_v1[\s\S]{0,80}to\s+(?:anon|authenticated|public)/i.test(
    combined
  ),
  "TRUST status read must not be browser-callable"
);

[
  "trust_intake_migration_backfilled_existing_catalog",
  "promotion_did_not_create_exactly_one_intake",
  "required_fact_policy_created_wrong_task_count",
  "existing_current_not_short_circuited",
  "identical_retry_not_idempotent",
  "subject_scoped_tasks_duplicated_across_revisions",
  "global_subject_was_auto_applied_to_kr",
  "phase1_mutated_fact_instances",
  "phase1_mutated_current",
  "phase1_mutated_confirmations",
  "phase1_mutated_recommendation_data",
  "TRUST_PHASE1_INTAKE_RUNTIME_VERIFIED"
].forEach((value) => includes(runtime, value, "runtime verifier"));

[
  "create table public.product_fact_subjects",
  "create table public.product_fact_instances",
  "create table public.product_fact_current",
  "create table public.product_fact_confirmations",
  "create table public.recommendation_logs",
  "create or replace function public.promote_product_candidate_structural_v1"
].forEach((value) => includes(fixture, value, "isolated fixture"));

console.log("TRUST_PHASE1_INTAKE_CONTRACT_VERIFIED");
