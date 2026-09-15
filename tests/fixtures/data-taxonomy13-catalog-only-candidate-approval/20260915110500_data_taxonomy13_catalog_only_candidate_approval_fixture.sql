create extension if not exists pgcrypto with schema extensions;

create type public.product_review_status as enum ('new', 'approved', 'promoted', 'rejected');

create table public.products (
  id uuid primary key default gen_random_uuid(),
  normalized_brand text,
  normalized_name text,
  external_source text,
  external_type text,
  external_id text
);

create table public.product_candidates (
  id uuid primary key,
  source_name text not null,
  source_url text,
  category_path text not null,
  external_type text,
  external_id text,
  brand_name_raw text,
  product_name_raw text,
  canonical_brand text,
  canonical_name text,
  normalized_brand text,
  normalized_name text,
  identity_resolution_state text not null default 'unresolved',
  identity_resolution_version text,
  identity_resolution_evidence jsonb,
  service_category text,
  product_form text,
  matched_product_id uuid,
  duplicate_of_product_id uuid,
  review_status public.product_review_status not null default 'new',
  reviewed_at timestamptz,
  reviewed_by text,
  review_notes text,
  promotion_payload jsonb,
  updated_at timestamptz not null default now()
);

create table public.candidate_promotion_reviews (
  candidate_id uuid primary key references public.product_candidates(id) on delete cascade,
  status text not null,
  approved_product_id uuid,
  reviewed_at timestamptz,
  review_note text,
  updated_at timestamptz not null default now()
);

create table public.catalog_taxonomy_versions (
  version text primary key,
  lifecycle_state text not null,
  authority_mode text not null
);

create table public.catalog_taxonomy_terms (
  taxonomy_version text not null,
  term_id text not null,
  lifecycle_state text not null,
  primary key (taxonomy_version, term_id)
);

create table public.catalog_taxonomy_candidate_source_rules (
  rule_key text primary key,
  taxonomy_version text not null,
  lifecycle_state text not null,
  source_name_key text not null,
  raw_category_key text not null,
  entity_kind_term_id text,
  domain_term_id text,
  recommendation_family_term_id text,
  category_term_id text,
  form_term_id text
);

create table public.product_candidate_catalog_taxonomy_classifications (
  candidate_id uuid not null references public.product_candidates(id) on delete cascade,
  taxonomy_version text not null,
  source_name_snapshot text,
  category_path_snapshot text,
  legacy_category_snapshot text,
  legacy_product_form_snapshot text,
  classification_state text,
  classification_method text,
  source_rule_key text,
  legacy_projection_key text,
  product_write_allowed boolean,
  product_promotion_allowed boolean,
  recommendation_admission_allowed boolean,
  entity_kind_term_id text,
  domain_term_id text,
  recommendation_family_term_id text,
  category_term_id text,
  form_term_id text,
  classified_at timestamptz not null,
  primary key (candidate_id, taxonomy_version)
);

create table public.product_catalog_taxonomy_assignments (
  product_id uuid primary key,
  taxonomy_version text not null
);

create table public.admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null,
  capability text not null,
  action text not null,
  target_type text not null,
  target_id text not null,
  before_state jsonb,
  after_state jsonb,
  reason text,
  request_id text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table public.test_data_taxonomy13_runtime_flags (
  singleton boolean primary key default true check (singleton),
  runtime_drift boolean not null default false
);
insert into public.test_data_taxonomy13_runtime_flags(singleton, runtime_drift) values (true, false);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values (
  '11111111-1111-1111-1111-111111111111'::uuid,
  'authenticated',
  'authenticated',
  'data-taxonomy13@example.test',
  now(),
  now()
);

create or replace function public.normalize_brand_key(p_value text)
returns text
language sql
immutable
as $$
  select lower(regexp_replace(btrim(coalesce(p_value, '')), '\s+', ' ', 'g'));
$$;

create or replace function public.normalize_product_key(p_value text)
returns text
language sql
immutable
as $$
  select lower(regexp_replace(btrim(coalesce(p_value, '')), '\s+', ' ', 'g'));
$$;

create or replace function public.admin_product_review_sha256_json(p_value jsonb)
returns text
language sql
immutable
as $$
  select encode(extensions.digest(convert_to(coalesce(p_value, 'null'::jsonb)::text, 'UTF8'), 'sha256'), 'hex');
$$;

create or replace function public.admin_require_product_review_actor(
  p_actor_user_id uuid,
  p_capability text
)
returns text
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
begin
  if p_actor_user_id is distinct from '11111111-1111-1111-1111-111111111111'::uuid
     or p_capability is distinct from 'admin.products.review' then
    raise exception 'admin_actor_forbidden' using errcode = '42501';
  end if;
  return 'admin_owner';
end;
$$;

create or replace function public.record_admin_audit_event(
  p_actor_user_id uuid,
  p_capability text,
  p_action text,
  p_target_type text,
  p_target_id text,
  p_before_state jsonb,
  p_after_state jsonb,
  p_reason text,
  p_request_id text,
  p_metadata jsonb
)
returns uuid
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into public.admin_audit_events(
    id, actor_user_id, capability, action, target_type, target_id,
    before_state, after_state, reason, request_id, metadata
  ) values (
    v_id, p_actor_user_id, p_capability, p_action, p_target_type, p_target_id,
    p_before_state, p_after_state, p_reason, p_request_id, p_metadata
  );
  return v_id;
end;
$$;

create or replace function public.resolve_catalog_taxonomy_source_category_v1(
  p_source_name text,
  p_category_path text,
  p_taxonomy_version text
)
returns jsonb
language plpgsql
stable
set search_path = 'public', 'pg_temp'
as $$
declare
  v_rule public.catalog_taxonomy_candidate_source_rules%rowtype;
  v_drift boolean;
begin
  select runtime_drift into v_drift
  from public.test_data_taxonomy13_runtime_flags
  where singleton = true;

  select rule.* into v_rule
  from public.catalog_taxonomy_candidate_source_rules as rule
  where rule.taxonomy_version = p_taxonomy_version
    and rule.source_name_key = lower(btrim(p_source_name))
    and rule.raw_category_key = btrim(p_category_path)
    and rule.lifecycle_state = 'active';

  if not found then
    return jsonb_build_object(
      'classification_state', 'unmatched',
      'classification_method', 'none',
      'product_write_allowed', false,
      'product_promotion_allowed', false,
      'recommendation_admission_allowed', false
    );
  end if;

  return jsonb_build_object(
    'classification_state', 'active_shadow',
    'classification_method', 'source_rule_v1',
    'source_rule_key', v_rule.rule_key,
    'entity_kind_term_id', v_rule.entity_kind_term_id,
    'domain_term_id', v_rule.domain_term_id,
    'recommendation_family_term_id', v_rule.recommendation_family_term_id,
    'category_term_id', case when v_drift then 'category:drift' else v_rule.category_term_id end,
    'form_term_id', v_rule.form_term_id,
    'product_write_allowed', false,
    'product_promotion_allowed', false,
    'recommendation_admission_allowed', false
  );
end;
$$;

create or replace function public.test_data_taxonomy13_payload()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'contract_version', 'catalog-only-candidate-approval-v1',
    'canonical_brand', '파티온',
    'canonical_name', '노스카나인 트러블 세럼',
    'identity_resolution_version', 'crawler-identity-resolution-v1',
    'reason', 'Independent identity evidence converges for catalog-only approval.',
    'identity_evidence', jsonb_build_object(
      'contract_version', 'catalog-only-candidate-identity-evidence-v1',
      'providers', jsonb_build_array(
        jsonb_build_object(
          'provider', 'hwahae',
          'locator', 'https://www.hwahae.co.kr/goods/60898',
          'canonical_brand', '파티온',
          'canonical_name', '노스카나인 트러블 세럼'
        ),
        jsonb_build_object(
          'provider', 'fation_official',
          'locator', 'https://www.fation.co.kr/product/329',
          'canonical_brand', '파티온',
          'canonical_name', '노스카나인 트러블 세럼'
        )
      ),
      'convergence_dimensions', jsonb_build_array('brand', 'product_name', 'presentation'),
      'authority_boundary', jsonb_build_object(
        'product_write_allowed', false,
        'taxonomy_assignment_write_allowed', false,
        'recommendation_admission_allowed', false,
        'recommendation_runtime_cutover', false,
        'product_fact_write_allowed', false,
        'offer_write_allowed', false
      )
    )
  );
$$;

create or replace function public.test_seed_data_taxonomy13()
returns void
language plpgsql
set search_path = 'public', 'pg_temp'
as $$
begin
  delete from public.admin_catalog_only_candidate_approval_confirmations;
  delete from public.admin_audit_events;
  delete from public.candidate_promotion_reviews;
  delete from public.product_candidate_catalog_taxonomy_classifications;
  delete from public.product_candidates;
  delete from public.product_catalog_taxonomy_assignments;
  delete from public.products;
  delete from public.catalog_taxonomy_candidate_source_rules;
  delete from public.catalog_taxonomy_terms;
  delete from public.catalog_taxonomy_versions;
  update public.test_data_taxonomy13_runtime_flags set runtime_drift = false where singleton = true;

  insert into public.catalog_taxonomy_versions(version, lifecycle_state, authority_mode)
  values ('catalog-taxonomy-v1', 'shadow', 'shadow_only');

  insert into public.catalog_taxonomy_terms(taxonomy_version, term_id, lifecycle_state)
  values
    ('catalog-taxonomy-v1', 'entity:product', 'active'),
    ('catalog-taxonomy-v1', 'domain:skincare', 'active'),
    ('catalog-taxonomy-v1', 'family:treatment', 'active'),
    ('catalog-taxonomy-v1', 'category:treatment', 'active');

  insert into public.catalog_taxonomy_candidate_source_rules(
    rule_key, taxonomy_version, lifecycle_state, source_name_key, raw_category_key,
    entity_kind_term_id, domain_term_id, recommendation_family_term_id,
    category_term_id, form_term_id
  ) values (
    'catalog-taxonomy-v1:source:hwahae:treatment',
    'catalog-taxonomy-v1', 'active', 'hwahae', 'treatment',
    'entity:product', 'domain:skincare', 'family:treatment', 'category:treatment', null
  );

  insert into public.product_candidates(
    id, source_name, source_url, category_path, external_type, external_id,
    brand_name_raw, product_name_raw, canonical_brand, canonical_name,
    identity_resolution_state, identity_resolution_version,
    service_category, product_form, matched_product_id, duplicate_of_product_id,
    review_status, promotion_payload, updated_at
  ) values (
    '6a9627b6-a5da-458f-84f7-3a40f91453be'::uuid,
    'hwahae', 'https://www.hwahae.co.kr/goods/60898', 'treatment', 'products', '1996087',
    '파티온', '노스카나인 트러블 세럼', null, null,
    'unresolved', 'crawler-identity-resolution-v1',
    null, null, null, null,
    'new', '{}'::jsonb, '2026-09-15 01:00:00+00'::timestamptz
  );

  insert into public.candidate_promotion_reviews(
    candidate_id, status, approved_product_id, updated_at
  ) values (
    '6a9627b6-a5da-458f-84f7-3a40f91453be'::uuid,
    'queued', null, '2026-09-15 01:00:00+00'::timestamptz
  );

  insert into public.product_candidate_catalog_taxonomy_classifications(
    candidate_id, taxonomy_version, source_name_snapshot, category_path_snapshot,
    legacy_category_snapshot, legacy_product_form_snapshot,
    classification_state, classification_method, source_rule_key, legacy_projection_key,
    product_write_allowed, product_promotion_allowed, recommendation_admission_allowed,
    entity_kind_term_id, domain_term_id, recommendation_family_term_id,
    category_term_id, form_term_id, classified_at
  ) values (
    '6a9627b6-a5da-458f-84f7-3a40f91453be'::uuid,
    'catalog-taxonomy-v1', 'hwahae', 'treatment', null, null,
    'active_shadow', 'source_rule_v1',
    'catalog-taxonomy-v1:source:hwahae:treatment', null,
    false, false, false,
    'entity:product', 'domain:skincare', 'family:treatment', 'category:treatment', null,
    '2026-09-15 01:00:00+00'::timestamptz
  );
end;
$$;
