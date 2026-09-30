-- Local/CI-only compatibility layer for the Phase 8I-4G isolated canary E2E.
-- This is NOT a Production migration and is copied only into the ephemeral local Supabase runtime.

begin;

alter table public.product_source_bindings
  add column if not exists external_type text,
  add column if not exists external_id text,
  add column if not exists binding_method text,
  add column if not exists product_scope_state text,
  add column if not exists first_observed_at timestamptz,
  add column if not exists last_observed_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.product_source_bindings
set external_type='brand_official_product_page',
    external_id='official-url-sha256:' ||
      encode(
        extensions.digest(convert_to(source_url,'UTF8'),'sha256'),
        'hex'
      ),
    binding_method='trust_official_source_review_v1',
    product_scope_state='product',
    first_observed_at=coalesce(first_observed_at,now()),
    last_observed_at=coalesce(last_observed_at,now()),
    updated_at=now()
where binding_id='85000000-0000-4000-8000-000000000001';

grant select,insert,update on table public.product_source_bindings to service_role;

create table public.trust_official_source_binding_reviews (
  review_id uuid primary key default gen_random_uuid(),
  binding_id uuid not null
    references public.product_source_bindings(binding_id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  subject_id uuid not null
    references public.product_fact_subjects(subject_id) on delete restrict,
  subject_market text,
  source_market text,
  scope_relation text not null
    check (scope_relation in ('equivalent','narrower')),
  variant_key text,
  formulation_revision_key text not null,
  source_kind text not null
    check (source_kind in (
      'brand_official_product_page',
      'brand_official_faq',
      'brand_official_technical_document',
      'manufacturer_official_document',
      'official_market_sales_page'
    )),
  actor_user_id uuid not null,
  request_id text not null
    check (char_length(btrim(request_id)) between 8 and 120),
  review_version text not null
    check (review_version='trust-official-source-review-v1'),
  created_at timestamptz not null default now(),
  unique(product_id,subject_id,binding_id,review_version)
);

alter table public.trust_official_source_binding_reviews enable row level security;
revoke all on table public.trust_official_source_binding_reviews
  from public,anon,authenticated,service_role;
grant select,insert on table public.trust_official_source_binding_reviews
  to service_role;

insert into public.trust_official_source_binding_reviews(
  review_id,binding_id,product_id,subject_id,
  subject_market,source_market,scope_relation,variant_key,
  formulation_revision_key,source_kind,actor_user_id,request_id,review_version
)
select
  '86000000-0000-4000-8000-000000000001',
  b.binding_id,
  b.product_id,
  s.subject_id,
  s.market_applicability,
  b.market_code,
  'equivalent',
  s.variant_key,
  s.formulation_revision_key,
  b.external_type,
  '92000000-0000-4000-8000-000000000001',
  'trust-i4g-local-review-0001',
  'trust-official-source-review-v1'
from public.product_source_bindings b
join public.product_fact_subjects s on s.product_id=b.product_id
where b.binding_id='85000000-0000-4000-8000-000000000001'
  and s.identity_status='resolved'
  and s.current_state='current';

-- Phase 8I-2 only needs the latest profile identity/comparability fields for
-- transport target projection. The E2E deliberately leaves this table empty.
create table public.product_evidence_source_verification_profiles (
  profile_id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.product_evidence_sources(source_id),
  comparability_state text not null default 'BASELINE_RECOVERY_REQUIRED',
  created_at timestamptz not null default now()
);

alter table public.product_evidence_source_verification_profiles enable row level security;
revoke all on table public.product_evidence_source_verification_profiles
  from public,anon,authenticated,service_role;
grant select on table public.product_evidence_source_verification_profiles
  to service_role;

commit;
