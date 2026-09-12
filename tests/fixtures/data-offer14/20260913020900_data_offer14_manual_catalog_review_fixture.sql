create table public.admin_memberships (
  user_id uuid primary key,
  role text not null,
  is_active boolean not null default true
);

create or replace function public.admin_require_product_review_actor(
  p_actor_user_id uuid,
  p_required_capability text default 'admin.products.review'
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_role text;
begin
  if p_actor_user_id is null then
    raise exception 'admin_product_review_actor_required' using errcode = '22004';
  end if;
  select role into v_role
  from public.admin_memberships
  where user_id = p_actor_user_id and is_active = true;
  if v_role is null then
    raise exception 'admin_product_review_access_required' using errcode = '42501';
  end if;
  if p_required_capability <> 'admin.products.review' or v_role not in ('owner', 'admin') then
    raise exception 'admin_product_review_capability_required' using errcode = '42501';
  end if;
  return v_role;
end;
$function$;

create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null,
  actor_role text not null,
  required_capability text not null,
  action text not null,
  target_type text not null,
  target_id text,
  before_value jsonb,
  after_value jsonb,
  reason text not null,
  request_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.record_admin_audit_event(
  p_actor_user_id uuid,
  p_required_capability text,
  p_action text,
  p_target_type text,
  p_target_id text,
  p_before_value jsonb,
  p_after_value jsonb,
  p_reason text,
  p_request_id text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_id uuid;
  v_role text;
begin
  v_role := public.admin_require_product_review_actor(p_actor_user_id, p_required_capability);
  insert into public.admin_audit_logs(
    actor_user_id, actor_role, required_capability, action, target_type, target_id,
    before_value, after_value, reason, request_id, metadata
  )
  values (
    p_actor_user_id, v_role, p_required_capability, p_action, p_target_type, p_target_id,
    p_before_value, p_after_value, p_reason, p_request_id, coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_id;
  return v_id;
end;
$function$;

create table public.product_candidates (
  id uuid primary key,
  source_name text not null,
  external_type text,
  external_id text,
  source_url text,
  category_path text,
  product_name_raw text not null,
  brand_name_raw text,
  review_status text not null default 'new',
  identity_resolution_state text not null default 'unresolved',
  canonical_name text,
  canonical_brand text,
  service_category text,
  product_form text,
  matched_product_id uuid,
  duplicate_of_product_id uuid,
  promotion_payload jsonb
);

create table public.candidate_promotion_reviews (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null unique references public.product_candidates(id) on delete cascade,
  status text not null default 'queued' check (status = any(array['queued','reviewing','approved','rejected','deferred'])),
  priority_score numeric not null default 0 check (priority_score >= 0),
  selection_reason text not null default '',
  evidence_snapshot jsonb not null default '{}'::jsonb,
  rule_version text not null,
  first_queued_at timestamptz not null default now(),
  last_queued_at timestamptz not null default now(),
  reviewed_at timestamptz,
  review_note text,
  approved_product_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.candidate_ranking_evidence_summary (
  candidate_id uuid primary key,
  external_type text,
  external_id text,
  queue_eligible boolean not null,
  product_match_exists boolean not null,
  priority_score numeric not null,
  selection_reason text,
  evidence_snapshot jsonb not null,
  queue_policy text,
  concern_best_rank integer
);

create table public.products (id uuid primary key default gen_random_uuid());
create table public.product_source_bindings (id uuid primary key default gen_random_uuid());
create table public.product_offers (id uuid primary key default gen_random_uuid());
create table public.product_fact_current (id uuid primary key default gen_random_uuid());
create table public.recommendation_logs (id uuid primary key default gen_random_uuid());

insert into public.admin_memberships(user_id, role, is_active) values
  ('30000000-0000-4000-8000-000000000001', 'admin', true);

insert into public.product_candidates(
  id, source_name, external_type, external_id, source_url, category_path,
  product_name_raw, brand_name_raw, review_status, identity_resolution_state,
  canonical_name, canonical_brand, service_category, product_form, matched_product_id, duplicate_of_product_id
) values
  (
    'ccf23119-b067-4076-bb9e-01a83cf88fa0',
    'hwahae', 'products', '1986669',
    'https://www.hwahae.com/en/products/1986669',
    'sunscreen', 'DIVE IN Mild Sun Cream [SPF50+/PA++++]', 'Torriden',
    'new', 'unresolved', null, null, null, null, null, null
  ),
  (
    '11111111-1111-4111-8111-111111111111',
    'hwahae', 'goods', 'fixture-ranking',
    'https://example.invalid/ranking',
    'sunscreen', 'Ranking Fixture Sun Cream', 'Fixture',
    'new', 'unresolved', null, null, null, null, null, null
  ),
  (
    '22222222-2222-4222-8222-222222222221',
    'hwahae', 'products', 'queued-fixture',
    'https://example.invalid/queued',
    'sunscreen', 'Queued Fixture', 'Fixture',
    'new', 'unresolved', null, null, null, null, null, null
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'hwahae', 'products', 'reviewing-fixture',
    'https://example.invalid/reviewing',
    'sunscreen', 'Reviewing Fixture', 'Fixture',
    'new', 'unresolved', null, null, null, null, null, null
  ),
  (
    '22222222-2222-4222-8222-222222222223',
    'hwahae', 'products', 'deferred-fixture',
    'https://example.invalid/deferred',
    'sunscreen', 'Deferred Fixture', 'Fixture',
    'new', 'unresolved', null, null, null, null, null, null
  ),
  (
    '22222222-2222-4222-8222-222222222224',
    'hwahae', 'products', 'approved-fixture',
    'https://example.invalid/approved',
    'sunscreen', 'Approved Fixture', 'Fixture',
    'new', 'unresolved', null, null, null, null, null, null
  ),
  (
    '22222222-2222-4222-8222-222222222225',
    'hwahae', 'products', 'rejected-fixture',
    'https://example.invalid/rejected',
    'sunscreen', 'Rejected Fixture', 'Fixture',
    'new', 'unresolved', null, null, null, null, null, null
  ),
  (
    '22222222-2222-4222-8222-222222222226',
    'hwahae', 'products', 'promoted-fixture',
    'https://example.invalid/promoted',
    'sunscreen', 'Promoted Fixture', 'Fixture',
    'promoted', 'resolved', 'Promoted Fixture', 'Fixture', 'sunscreen', null,
    '99999999-9999-4999-8999-999999999999', null
  );

insert into public.candidate_promotion_reviews(
  candidate_id, status, priority_score, selection_reason, evidence_snapshot, rule_version,
  reviewed_at, review_note, approved_product_id
) values
  (
    '22222222-2222-4222-8222-222222222221', 'queued', 10,
    'existing queued fixture', '{"fixture":"queued"}'::jsonb, 'existing-manual-fixture-v1',
    null, null, null
  ),
  (
    '22222222-2222-4222-8222-222222222222', 'reviewing', 10,
    'existing reviewing fixture', '{"fixture":"reviewing"}'::jsonb, 'existing-manual-fixture-v1',
    null, null, null
  ),
  (
    '22222222-2222-4222-8222-222222222223', 'deferred', 0,
    'existing deferred fixture', '{"fixture":"deferred","queue_eligible":false}'::jsonb, 'ranking-review-v2',
    now(), 'deferred for fixture', null
  ),
  (
    '22222222-2222-4222-8222-222222222224', 'approved', 0,
    'existing approved fixture', '{"fixture":"approved"}'::jsonb, 'ranking-review-v2',
    now(), 'approved fixture', null
  ),
  (
    '22222222-2222-4222-8222-222222222225', 'rejected', 0,
    'existing rejected fixture', '{"fixture":"rejected"}'::jsonb, 'ranking-review-v2',
    now(), 'rejected fixture', null
  );

insert into public.candidate_ranking_evidence_summary(
  candidate_id, external_type, external_id, queue_eligible, product_match_exists,
  priority_score, selection_reason, evidence_snapshot, queue_policy, concern_best_rank
) values
  (
    'ccf23119-b067-4076-bb9e-01a83cf88fa0', 'products', '1986669', false, false,
    0, null, '{"fixture":"manual-candidate","queue_eligible":false}'::jsonb,
    null, null
  ),
  (
    '11111111-1111-4111-8111-111111111111', 'goods', 'fixture-ranking', true, false,
    100, 'top_15_immediate fixture', '{"fixture":"ranking-candidate"}'::jsonb,
    'top_15_immediate', 1
  );

insert into public.products(id) values ('99999999-9999-4999-8999-999999999999');
insert into public.product_source_bindings default values;
insert into public.product_offers default values;
insert into public.product_fact_current default values;
insert into public.recommendation_logs default values;

grant select, insert, update, delete on public.product_candidates to service_role;
grant select, insert, update, delete on public.candidate_promotion_reviews to service_role;
grant select, insert, update, delete on public.candidate_ranking_evidence_summary to service_role;
grant select on public.products, public.product_source_bindings, public.product_offers, public.product_fact_current, public.recommendation_logs to service_role;
grant select on public.admin_audit_logs to service_role;
grant execute on function public.admin_require_product_review_actor(uuid, text) to service_role;
grant execute on function public.record_admin_audit_event(uuid, text, text, text, text, jsonb, jsonb, text, text, jsonb) to service_role;
