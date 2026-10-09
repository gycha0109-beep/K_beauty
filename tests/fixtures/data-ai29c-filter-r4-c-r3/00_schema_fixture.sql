-- DATA-AI29C-FILTER-R4-C-R3. Disposable PostgreSQL 17 fixture only.
-- Synthetic records and public-schema column contracts; no Production data copy.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
do $role$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
end $role$;

create table public.products (id uuid primary key);
create table public.product_fact_subjects (
  subject_id uuid primary key, product_id uuid not null references public.products(id),
  subject_semantic_key text not null, subject_identity_serializer_version text not null,
  variant_key text, formulation_revision_key text not null, formulation_label text,
  identity_status text not null, identity_resolution_version text not null,
  current_state text not null, market_applicability text, region_applicability text,
  valid_from date, valid_to date, predecessor_subject_id uuid, supersession_kind text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.product_source_bindings (
  binding_id uuid primary key, product_id uuid references public.products(id),
  source_url text, source_name text, market_code text, binding_state text,
  binding_method text, product_scope_state text
);
create table public.trust_official_source_binding_reviews (
  review_id uuid primary key, binding_id uuid, product_id uuid, subject_id uuid,
  subject_market text, source_market text, scope_relation text, variant_key text,
  formulation_revision_key text, review_version text
);
create table public.product_evidence_sources (
  source_id uuid primary key, content_digest text not null, canonical_locator text not null,
  source_kind text not null, market text, region text, source_metadata jsonb default '{}'::jsonb
);
create table public.product_evidence_source_subject_bindings (
  binding_id uuid primary key, source_id uuid references public.product_evidence_sources(source_id),
  product_id uuid, subject_id uuid, binding_state text, scope_relation text
);
create table public.product_fact_current (
  proposition_key text primary key, fact_instance_id uuid not null, subject_id uuid,
  confirmation_id uuid, updated_at timestamptz default now()
);
create table public.product_fact_instances (
  fact_instance_id uuid primary key, subject_id uuid, proposition_key text,
  fact_key text, semantic_status text
);
create table public.product_fact_research_tasks (id uuid primary key, subject_id uuid, state text);
create table public.product_evidence_records (evidence_id uuid primary key, subject_id uuid);
create table public.sunscreen_recommendation_semantic_field_reviews (
  review_id uuid primary key, subject_id uuid, is_current boolean not null default true
);
create table public.product_fact_review_events (
  event_id uuid primary key default gen_random_uuid(), subject_id uuid,
  actor_user_id uuid, event_kind text, reason_code text, event_payload jsonb,
  created_at timestamptz default now()
);
create table public.admin_memberships(user_id uuid primary key, role text, is_active boolean);
create table public.admin_audit_logs(
  id uuid primary key default gen_random_uuid(), actor_user_id uuid, actor_role text not null,
  required_capability text not null, action text not null, target_type text not null,
  target_id text, before_value jsonb, after_value jsonb, reason text not null,
  request_id text not null, metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(actor_user_id,request_id,action)
);

-- Exact definitions read from Production metadata for the canonical hash and exact-key helpers.
create or replace function public.product_fact_controlled_canonical_json_v1(p_value jsonb)
returns text language plpgsql immutable set search_path=public,pg_temp as $f$
declare v_type text:=jsonb_typeof(p_value);v_result text;
begin
  if p_value is null then return 'null';end if;
  if v_type='object' then
    select '{'||coalesce(string_agg(to_jsonb(entry.key)::text||':'||
    public.product_fact_controlled_canonical_json_v1(entry.value),',' order by entry.key),'')||'}'
    into v_result from jsonb_each(p_value) entry(key,value);
    return v_result;
  end if;
  if v_type='array' then
    select '['||coalesce(string_agg(public.product_fact_controlled_canonical_json_v1(item.value),
    ',' order by item.ordinality),'')||']' into v_result
    from jsonb_array_elements(p_value) with ordinality item(value,ordinality);
    return v_result;
  end if;
  return p_value::text;
end $f$;
create or replace function public.product_fact_controlled_sha256_json_v1(p_value jsonb)
returns text language sql immutable set search_path=public,extensions,pg_temp as $f$
select encode(extensions.digest(convert_to(public.product_fact_controlled_canonical_json_v1(p_value),'UTF8'),'sha256'),'hex');
$f$;
create or replace function public.product_fact_controlled_json_exact_keys_v1(p_value jsonb,p_keys text[])
returns boolean language sql immutable set search_path=public,pg_temp as $f$
select p_value is not null and jsonb_typeof(p_value)='object' and p_value ?& p_keys
and (select count(*) from jsonb_object_keys(p_value))=coalesce(array_length(p_keys,1),0);
$f$;

create or replace function public.admin_role_capabilities(p_role text)
returns text[] language sql immutable as $f$
select case p_role when 'admin_operator' then array['admin.products.review']::text[]
when 'admin_owner' then array['admin.products.review']::text[]
else array[]::text[] end;
$f$;
create or replace function public.admin_require_product_review_actor(
p_actor_user_id uuid,p_required_capability text default 'admin.products.review'
) returns text language plpgsql security definer set search_path=public,pg_temp as $f$
declare v_role text;
begin
  if p_actor_user_id is null then raise exception 'admin_product_review_actor_required' using errcode='22004';end if;
  select role into v_role from public.admin_memberships where user_id=p_actor_user_id and is_active limit 1;
  if v_role is null then raise exception 'admin_product_review_access_required' using errcode='42501';end if;
  if btrim(coalesce(p_required_capability,''))='' or not (p_required_capability=any(public.admin_role_capabilities(v_role)))
  then raise exception 'admin_product_review_capability_required' using errcode='42501';end if;
  return v_role;
end $f$;
create or replace function public.record_admin_audit_event(
p_actor_user_id uuid,p_required_capability text,p_action text,p_target_type text,p_target_id text,
p_before_value jsonb,p_after_value jsonb,p_reason text,p_request_id text,p_metadata jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $f$
declare v_id uuid;
begin
  insert into public.admin_audit_logs(actor_user_id,actor_role,required_capability,action,target_type,target_id,
  before_value,after_value,reason,request_id,metadata)
  values(p_actor_user_id,public.admin_require_product_review_actor(p_actor_user_id,p_required_capability),
  p_required_capability,p_action,p_target_type,p_target_id,p_before_value,p_after_value,p_reason,p_request_id,p_metadata)
  returning id into v_id;
  return v_id;
end $f$;

-- Fixed, synthetic BUSHMAN identity fixture. No real reviewer approval is represented.
insert into public.products(id) values('4608b3b4-8b51-4464-b46e-380b05c1a3d7');
insert into public.product_fact_subjects(
 subject_id,product_id,subject_semantic_key,subject_identity_serializer_version,variant_key,
 formulation_revision_key,formulation_label,identity_status,identity_resolution_version,
 current_state,market_applicability
) values(
 '0b5963bb-67d6-4738-a620-32ec86c1e3d0','4608b3b4-8b51-4464-b46e-380b05c1a3d7',
 '33696edfb47c47672930e0d398b0cd67fb966c355ec474ea9ec4ffa72400a584',
 'product-fact-subject-identity-v1',null,
 'data-ai29c-c5-bushman-waterproof-pro-current','BUSHMAN Waterproof Pro Suncream 50g',
 'resolved','data-ai29c-c5-presentation-identity-correction-v1','current','KR'
);
insert into public.admin_memberships(user_id,role,is_active) values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','admin_operator',true),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','admin_viewer',true);
insert into public.product_source_bindings values(
'9da03b35-9e00-4c46-8ff0-8f6835382349',
'4608b3b4-8b51-4464-b46e-380b05c1a3d7',
'https://bushmankorea.com/product/%EB%B6%80%EC%89%AC%EB%A7%A8-%EC%9B%8C%ED%84%B0%ED%94%84%EB%A3%A8%ED%94%84-%ED%94%84%EB%A1%9C-%EC%84%A0%ED%81%AC%EB%A6%BC-spf50-pa-50ml/31/',
'bushman_official','KR','resolved','trust_official_source_review_v1','product');
insert into public.trust_official_source_binding_reviews values(
'067e861d-2e61-4ec2-a3f7-660d78be468d',
'9da03b35-9e00-4c46-8ff0-8f6835382349',
'4608b3b4-8b51-4464-b46e-380b05c1a3d7',
'0b5963bb-67d6-4738-a620-32ec86c1e3d0',
'KR','KR','equivalent',null,'data-ai29c-c5-bushman-waterproof-pro-current',
'trust-official-source-review-v1');
insert into public.product_evidence_sources(source_id,content_digest,canonical_locator,source_kind,market) values
('76cc7f5b-d5dc-4d72-bb1c-ab2a899211c1','02aa9f0073cd4e4a6f433a3596fe94eee77b0bb8bb880f202c36fd44eb24c701',
 (select source_url from public.product_source_bindings),'official_product_page','KR'),
('94b32b8d-8340-4b91-9e62-646794fd4f41','3a9fbcb280935133e95a0f7f19bfff20157258b4dc17b8dce4d601e40f6681a9',
 (select source_url from public.product_source_bindings),'official_product_page','KR'),
('9b98d800-66c3-4a40-880c-4c99f415a920','696c6ab509c4a0045ef5b408b06a2359e08570cc4d3ece1338a749c3fa2e6460',
 (select source_url from public.product_source_bindings),'official_product_page','KR'),
('f25f3fc4-07b3-45e9-a0a8-12f0d1b37f06','183405aeaaec9640d798ae38da817a7ca39ceac4881b22485cf2cf118aa3e7ab',
 (select source_url from public.product_source_bindings),'official_product_page','KR');
insert into public.product_evidence_source_subject_bindings(binding_id,source_id,product_id,subject_id,binding_state,scope_relation) values
('c8b91f9b-a1b1-4b26-a435-b390672bf73f','76cc7f5b-d5dc-4d72-bb1c-ab2a899211c1','4608b3b4-8b51-4464-b46e-380b05c1a3d7','0b5963bb-67d6-4738-a620-32ec86c1e3d0','exact_subject_match','equivalent'),
('2b554836-0c57-4829-ac01-2631f34267d2','94b32b8d-8340-4b91-9e62-646794fd4f41','4608b3b4-8b51-4464-b46e-380b05c1a3d7','0b5963bb-67d6-4738-a620-32ec86c1e3d0','exact_subject_match','equivalent'),
('09650eb5-db97-474b-995c-5f5aeb706467','9b98d800-66c3-4a40-880c-4c99f415a920','4608b3b4-8b51-4464-b46e-380b05c1a3d7','0b5963bb-67d6-4738-a620-32ec86c1e3d0','exact_subject_match','equivalent'),
('a19156b9-8a1c-4af5-8a8b-d9f58ae9b17d','f25f3fc4-07b3-45e9-a0a8-12f0d1b37f06','4608b3b4-8b51-4464-b46e-380b05c1a3d7','0b5963bb-67d6-4738-a620-32ec86c1e3d0','exact_subject_match','equivalent');
insert into public.product_fact_instances(fact_instance_id,subject_id,proposition_key,fact_key,semantic_status) values
('00000000-0000-4000-8000-000000000001','0b5963bb-67d6-4738-a620-32ec86c1e3d0','test-spf','spf','established'),
('00000000-0000-4000-8000-000000000002','0b5963bb-67d6-4738-a620-32ec86c1e3d0','test-uva','uva_label','established'),
('00000000-0000-4000-8000-000000000003','0b5963bb-67d6-4738-a620-32ec86c1e3d0','test-filter','uv_filter_type','established');
insert into public.product_fact_current(proposition_key,fact_instance_id,subject_id) values
('test-spf','00000000-0000-4000-8000-000000000001','0b5963bb-67d6-4738-a620-32ec86c1e3d0'),
('test-uva','00000000-0000-4000-8000-000000000002','0b5963bb-67d6-4738-a620-32ec86c1e3d0'),
('test-filter','00000000-0000-4000-8000-000000000003','0b5963bb-67d6-4738-a620-32ec86c1e3d0');

revoke all on public.product_fact_subjects from public, anon, authenticated, service_role;
revoke all on public.admin_audit_logs from public, anon, authenticated, service_role;
