-- TEST / LOCAL E2E ONLY. NOT A PRODUCTION MIGRATION.
-- Minimal Phase 7-C reviewed-official-source relation required by the
-- production Phase 8H relocation migration. Production owns this table via
-- trust_phase7c_legacy_research_readiness_v1; the isolated runtime deliberately
-- does not replay the legacy backfill stack.

begin;

create table if not exists public.trust_official_source_binding_reviews (
  review_id uuid primary key default gen_random_uuid(),
  binding_id uuid not null references public.product_source_bindings(binding_id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  subject_id uuid not null references public.product_fact_subjects(subject_id) on delete restrict,
  subject_market text,
  source_market text,
  scope_relation text not null check (scope_relation in ('equivalent','narrower')),
  variant_key text,
  formulation_revision_key text not null,
  source_kind text not null check (source_kind in (
    'brand_official_product_page',
    'brand_official_faq',
    'brand_official_technical_document',
    'manufacturer_official_document',
    'official_market_sales_page'
  )),
  actor_user_id uuid not null,
  request_id text not null check (char_length(btrim(request_id)) between 8 and 120),
  review_version text not null check (review_version='trust-official-source-review-v1'),
  created_at timestamptz not null default now(),
  unique(product_id,subject_id,binding_id,review_version)
);

create index if not exists trust_official_source_binding_reviews_subject_idx
  on public.trust_official_source_binding_reviews(subject_id,created_at desc);

alter table public.trust_official_source_binding_reviews enable row level security;
revoke all on table public.trust_official_source_binding_reviews
  from public, anon, authenticated, service_role;
grant select on table public.trust_official_source_binding_reviews to service_role;

commit;
