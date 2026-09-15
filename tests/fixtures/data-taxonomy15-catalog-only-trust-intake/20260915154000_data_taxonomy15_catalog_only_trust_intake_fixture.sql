create extension if not exists pgcrypto;

create type public.product_review_status as enum ('new','approved','promoted');

create table public.products (
  id uuid primary key default gen_random_uuid()
);

create table public.product_candidates (
  id uuid primary key,
  review_status public.product_review_status not null,
  matched_product_id uuid references public.products(id),
  promotion_version text,
  source_name text not null,
  category_path text not null,
  service_category text
);

create table public.product_candidate_catalog_taxonomy_classifications (
  candidate_id uuid not null references public.product_candidates(id),
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
  primary key (candidate_id, taxonomy_version)
);

create table public.catalog_taxonomy_candidate_source_rules (
  rule_key text primary key,
  taxonomy_version text not null,
  source_name_key text not null,
  raw_category_key text not null,
  lifecycle_state text not null,
  entity_kind_term_id text,
  domain_term_id text,
  recommendation_family_term_id text,
  category_term_id text,
  form_term_id text
);

create table public.catalog_trust_intake (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  source_candidate_id uuid references public.product_candidates(id),
  catalog_revision text not null,
  category text not null,
  market text,
  identity_state text not null,
  trust_state text not null,
  required_fact_policy_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, catalog_revision)
);

create or replace function public.enqueue_catalog_trust_intake_from_promotion_v1()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return new;
end;
$$;

create trigger product_candidate_trust_intake_enqueue_v1
after update of review_status, matched_product_id, promotion_version on public.product_candidates
for each row
execute function public.enqueue_catalog_trust_intake_from_promotion_v1();

insert into public.catalog_taxonomy_candidate_source_rules(
  rule_key,
  taxonomy_version,
  source_name_key,
  raw_category_key,
  lifecycle_state,
  entity_kind_term_id,
  domain_term_id,
  recommendation_family_term_id,
  category_term_id,
  form_term_id
) values (
  'catalog-taxonomy-v1:source:hwahae:treatment',
  'catalog-taxonomy-v1',
  'hwahae',
  'treatment',
  'active',
  'catalog-taxonomy-v1:entity_kind:cosmetic',
  'catalog-taxonomy-v1:domain:skincare',
  'catalog-taxonomy-v1:recommendation_family:treatment',
  'catalog-taxonomy-v1:category:treatment',
  null
);

insert into public.products(id) values
  ('10000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000003');

insert into public.product_candidates(
  id, review_status, matched_product_id, promotion_version, source_name, category_path, service_category
) values
  ('20000000-0000-0000-0000-000000000001','approved',null,'v1','hwahae','treatment',null),
  ('20000000-0000-0000-0000-000000000002','approved',null,'v1','hwahae','cleanser','cleanser'),
  ('20000000-0000-0000-0000-000000000003','approved',null,'v1','hwahae','treatment',null);

insert into public.product_candidate_catalog_taxonomy_classifications(
  candidate_id,
  taxonomy_version,
  source_name_snapshot,
  category_path_snapshot,
  legacy_category_snapshot,
  legacy_product_form_snapshot,
  classification_state,
  classification_method,
  source_rule_key,
  legacy_projection_key,
  product_write_allowed,
  product_promotion_allowed,
  recommendation_admission_allowed,
  entity_kind_term_id,
  domain_term_id,
  recommendation_family_term_id,
  category_term_id,
  form_term_id
) values (
  '20000000-0000-0000-0000-000000000001',
  'catalog-taxonomy-v1',
  'hwahae',
  'treatment',
  null,
  null,
  'active_shadow',
  'source_rule_v1',
  'catalog-taxonomy-v1:source:hwahae:treatment',
  null,
  false,
  false,
  false,
  'catalog-taxonomy-v1:entity_kind:cosmetic',
  'catalog-taxonomy-v1:domain:skincare',
  'catalog-taxonomy-v1:recommendation_family:treatment',
  'catalog-taxonomy-v1:category:treatment',
  null
);
