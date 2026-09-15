create type public.product_review_status as enum ('new','needs_review','approved','promoted','rejected');
create type public.product_category as enum (
  'cleanser','toner_essence','toner_pad','treatment','moisturizer',
  'moisturizer_lotion_emulsion','moisturizer_gel','moisturizer_cream','moisturizer_balm','sunscreen'
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text,
  brand text,
  category public.product_category
);

create table public.product_candidates (
  id uuid primary key default gen_random_uuid(),
  source_name text,
  service_category public.product_category,
  review_status public.product_review_status not null default 'new',
  matched_product_id uuid references public.products(id),
  promotion_version text
);

create table public.product_fact_subjects (
  subject_id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  identity_status text not null,
  current_state text not null,
  market_applicability text
);

create table public.product_fact_registry_versions (
  registry_version text primary key,
  registry_checksum text,
  identity_serializer_version text,
  effective_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.product_fact_definition_snapshots (
  registry_version text not null references public.product_fact_registry_versions(registry_version),
  fact_key text not null,
  definition jsonb not null,
  deprecated boolean not null default false,
  value_type text,
  definition_checksum text,
  superseded_by_fact_key text,
  primary key (registry_version, fact_key)
);

create table public.product_evidence_records (
  evidence_id uuid primary key default gen_random_uuid()
);

create table public.product_fact_instances (
  fact_instance_id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.product_fact_subjects(subject_id),
  registry_version text not null,
  fact_key text not null,
  proposition_key text not null
);

create table public.product_fact_confirmations (
  confirmation_id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table public.product_fact_current (
  proposition_key text primary key,
  fact_instance_id uuid not null references public.product_fact_instances(fact_instance_id),
  subject_id uuid not null references public.product_fact_subjects(subject_id),
  confirmation_id uuid not null references public.product_fact_confirmations(confirmation_id),
  updated_at timestamptz not null default now()
);

create table public.recommendation_logs (
  id uuid primary key default gen_random_uuid(),
  marker text not null
);

insert into public.product_fact_registry_versions (
  registry_version, registry_checksum, identity_serializer_version, created_at
) values (
  'product-fact-registry-cross-category-v1', repeat('a', 64), 'subject-identity-v1', now()
);

insert into public.product_fact_definition_snapshots (
  registry_version, fact_key, definition, deprecated, value_type, definition_checksum
) values
  ('product-fact-registry-cross-category-v1','spf_value','{"domain_scope":["sunscreen"]}'::jsonb,false,'number',repeat('1',64)),
  ('product-fact-registry-cross-category-v1','uva_label','{"domain_scope":["sunscreen"]}'::jsonb,false,'enum',repeat('2',64)),
  ('product-fact-registry-cross-category-v1','uv_filter_type','{"domain_scope":["sunscreen"]}'::jsonb,false,'enum',repeat('3',64));

insert into public.products (id, name, brand, category)
values ('10000000-0000-4000-8000-000000000001','Fixture Sunscreen','Fixture','sunscreen');

insert into public.product_candidates (
  id, source_name, service_category, review_status, matched_product_id, promotion_version
) values (
  '20000000-0000-4000-8000-000000000001','hwahae','sunscreen','approved',
  '10000000-0000-4000-8000-000000000001',null
);

insert into public.product_fact_subjects (
  subject_id, product_id, identity_status, current_state, market_applicability
) values (
  '30000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'resolved','current','KR'
);

insert into public.product_fact_confirmations (confirmation_id)
values ('40000000-0000-4000-8000-000000000001');

insert into public.product_fact_instances (
  fact_instance_id, subject_id, registry_version, fact_key, proposition_key
) values (
  '50000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  'product-fact-registry-cross-category-v1','spf_value','fixture-spf'
);

insert into public.product_fact_current (
  proposition_key, fact_instance_id, subject_id, confirmation_id
) values (
  'fixture-spf','50000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001'
);

insert into public.recommendation_logs (id, marker)
values ('60000000-0000-4000-8000-000000000001','unchanged');

create or replace function public.promote_product_candidate_structural_v1(
  p_candidate_id uuid,
  p_actor text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_candidate public.product_candidates%rowtype;
begin
  select * into v_candidate from public.product_candidates where id = p_candidate_id for update;
  if not found then
    raise exception 'fixture_candidate_not_found';
  end if;

  if v_candidate.review_status = 'promoted'::public.product_review_status then
    return jsonb_build_object(
      'candidate_id', v_candidate.id,
      'product_id', v_candidate.matched_product_id,
      'action', 'already_promoted',
      'review_status', 'promoted'
    );
  end if;

  if v_candidate.review_status <> 'approved'::public.product_review_status then
    raise exception 'fixture_candidate_not_approved';
  end if;

  update public.product_candidates
  set review_status = 'promoted'::public.product_review_status,
      promotion_version = 'crawler-canonical-product-structural-adoption-v1'
  where id = p_candidate_id;

  return jsonb_build_object(
    'candidate_id', p_candidate_id,
    'product_id', v_candidate.matched_product_id,
    'action', 'merged',
    'review_status', 'promoted'
  );
end;
$$;

create or replace function public.promote_product_candidate(p_candidate_id uuid, p_actor text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return public.promote_product_candidate_structural_v1(p_candidate_id, p_actor);
end;
$$;
