begin;

create table if not exists public.product_identity_key_repair_requests (
  request_id text primary key,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  expected_normalized_brand text not null,
  expected_normalized_name text not null,
  expected_updated_at timestamptz not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  constraint product_identity_key_repair_request_id_check
    check (char_length(btrim(request_id)) between 8 and 120),
  constraint product_identity_key_repair_result_object_check
    check (jsonb_typeof(result) = 'object'),
  constraint product_identity_key_repair_result_size_check
    check (octet_length(result::text) <= 16384)
);

alter table public.product_identity_key_repair_requests enable row level security;
revoke all on table public.product_identity_key_repair_requests from public, anon, authenticated, service_role;

create or replace function public.admin_preflight_product_identity_key_repair_v1(
  p_actor_user_id uuid,
  p_product_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_role text;
  v_product public.products%rowtype;
  v_proposed_brand text;
  v_proposed_name text;
  v_collision_product_id uuid;
  v_disposition text;
begin
  v_actor_role := public.admin_require_product_review_actor(
    p_actor_user_id,
    'admin.products.review'
  );

  if p_product_id is null then
    raise exception 'product_identity_key_repair_product_required' using errcode = '22004';
  end if;

  select * into v_product
  from public.products
  where id = p_product_id;

  if not found then
    raise exception 'product_identity_key_repair_product_not_found' using errcode = 'P0002';
  end if;

  v_proposed_brand := public.normalize_brand_key(v_product.brand);
  v_proposed_name := public.normalize_product_key(v_product.name);

  if nullif(v_proposed_brand, '') is null or nullif(v_proposed_name, '') is null then
    v_disposition := 'blocked_missing_identity';
  elsif v_product.normalized_brand is not distinct from v_proposed_brand
    and v_product.normalized_name is not distinct from v_proposed_name
  then
    v_disposition := 'current';
  elsif v_product.normalized_brand is distinct from v_proposed_brand then
    v_disposition := 'manual_review_required';
  elsif lower(regexp_replace(coalesce(v_product.normalized_name, ''), '\s+', '', 'g'))
    is distinct from lower(regexp_replace(v_proposed_name, '\s+', '', 'g'))
  then
    v_disposition := 'manual_review_required';
  else
    select id into v_collision_product_id
    from public.products
    where id <> v_product.id
      and normalized_brand = v_proposed_brand
      and normalized_name = v_proposed_name
    order by id
    limit 1;

    if v_collision_product_id is not null then
      v_disposition := 'blocked_proposed_collision';
    else
      v_disposition := 'safe_mechanical_candidate';
    end if;
  end if;

  return jsonb_build_object(
    'contract_version', 'product-identity-key-repair-v1',
    'product_id', v_product.id,
    'actor_role', v_actor_role,
    'eligible', v_disposition = 'safe_mechanical_candidate',
    'disposition', v_disposition,
    'expected_normalized_brand', v_product.normalized_brand,
    'expected_normalized_name', v_product.normalized_name,
    'expected_updated_at', v_product.updated_at,
    'proposed_normalized_brand', v_proposed_brand,
    'proposed_normalized_name', v_proposed_name,
    'collision_product_id', v_collision_product_id
  );
end;
$$;

create or replace function public.admin_confirm_product_identity_key_repair_v1(
  p_actor_user_id uuid,
  p_request_id text,
  p_product_id uuid,
  p_expected_normalized_brand text,
  p_expected_normalized_name text,
  p_expected_updated_at timestamptz,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_role text;
  v_request_id text := btrim(coalesce(p_request_id, ''));
  v_reason text := btrim(coalesce(p_reason, ''));
  v_existing public.product_identity_key_repair_requests%rowtype;
  v_product public.products%rowtype;
  v_proposed_brand text;
  v_proposed_name text;
  v_collision_product_id uuid;
  v_after_updated_at timestamptz;
  v_audit_id uuid;
  v_before jsonb;
  v_after jsonb;
  v_result jsonb;
begin
  v_actor_role := public.admin_require_product_review_actor(
    p_actor_user_id,
    'admin.products.review'
  );

  if p_product_id is null
    or p_expected_updated_at is null
    or p_expected_normalized_brand is null
    or p_expected_normalized_name is null
    or char_length(v_request_id) not between 8 and 120
    or char_length(v_reason) not between 3 and 1000
  then
    raise exception 'product_identity_key_repair_payload_invalid' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('product-identity-key-repair-request:' || v_request_id, 0));

  select * into v_existing
  from public.product_identity_key_repair_requests
  where request_id = v_request_id;

  if found then
    if v_existing.actor_user_id <> p_actor_user_id
      or v_existing.product_id <> p_product_id
      or v_existing.expected_normalized_brand <> p_expected_normalized_brand
      or v_existing.expected_normalized_name <> p_expected_normalized_name
      or v_existing.expected_updated_at <> p_expected_updated_at
    then
      raise exception 'product_identity_key_repair_request_conflict' using errcode = '23505';
    end if;

    return v_existing.result || jsonb_build_object('idempotent', true);
  end if;

  select * into v_product
  from public.products
  where id = p_product_id
  for update;

  if not found then
    raise exception 'product_identity_key_repair_product_not_found' using errcode = 'P0002';
  end if;

  if v_product.normalized_brand is distinct from p_expected_normalized_brand
    or v_product.normalized_name is distinct from p_expected_normalized_name
    or v_product.updated_at is distinct from p_expected_updated_at
  then
    raise exception 'product_identity_key_repair_prestate_stale' using errcode = '23514';
  end if;

  v_proposed_brand := public.normalize_brand_key(v_product.brand);
  v_proposed_name := public.normalize_product_key(v_product.name);

  if nullif(v_proposed_brand, '') is null or nullif(v_proposed_name, '') is null then
    raise exception 'product_identity_key_repair_missing_identity' using errcode = '23514';
  end if;

  if v_product.normalized_brand is distinct from v_proposed_brand then
    raise exception 'product_identity_key_repair_brand_drift_requires_manual_review' using errcode = '23514';
  end if;

  if v_product.normalized_name is not distinct from v_proposed_name then
    raise exception 'product_identity_key_repair_not_required' using errcode = '23514';
  end if;

  if lower(regexp_replace(v_product.normalized_name, '\s+', '', 'g'))
    is distinct from lower(regexp_replace(v_proposed_name, '\s+', '', 'g'))
  then
    raise exception 'product_identity_key_repair_name_drift_requires_manual_review' using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('product-identity-key:' || v_proposed_brand || ':' || v_proposed_name, 0)
  );

  select id into v_collision_product_id
  from public.products
  where id <> v_product.id
    and normalized_brand = v_proposed_brand
    and normalized_name = v_proposed_name
  order by id
  limit 1;

  if v_collision_product_id is not null then
    raise exception 'product_identity_key_repair_collision' using errcode = '23505';
  end if;

  v_before := jsonb_build_object(
    'normalized_brand', v_product.normalized_brand,
    'normalized_name', v_product.normalized_name,
    'updated_at', v_product.updated_at
  );

  update public.products
  set normalized_name = v_proposed_name,
      updated_at = now()
  where id = v_product.id
  returning updated_at into v_after_updated_at;

  v_after := jsonb_build_object(
    'normalized_brand', v_proposed_brand,
    'normalized_name', v_proposed_name,
    'updated_at', v_after_updated_at
  );

  v_audit_id := public.record_admin_audit_event(
    p_actor_user_id,
    'admin.products.review',
    'admin.product.identity_key_repaired',
    'product',
    v_product.id::text,
    v_before,
    v_after,
    v_reason,
    v_request_id,
    jsonb_build_object(
      'contract_version', 'product-identity-key-repair-v1',
      'repair_scope', 'normalized_name_case_whitespace_only'
    )
  );

  v_result := jsonb_build_object(
    'status', 'confirmed',
    'idempotent', false,
    'contract_version', 'product-identity-key-repair-v1',
    'request_id', v_request_id,
    'product_id', v_product.id,
    'actor_role', v_actor_role,
    'normalized_brand', v_proposed_brand,
    'normalized_name', v_proposed_name,
    'updated_at', v_after_updated_at,
    'audit_id', v_audit_id
  );

  insert into public.product_identity_key_repair_requests(
    request_id,
    actor_user_id,
    product_id,
    expected_normalized_brand,
    expected_normalized_name,
    expected_updated_at,
    result,
    created_at
  ) values (
    v_request_id,
    p_actor_user_id,
    p_product_id,
    p_expected_normalized_brand,
    p_expected_normalized_name,
    p_expected_updated_at,
    v_result,
    now()
  );

  return v_result;
end;
$$;

revoke all on function public.admin_preflight_product_identity_key_repair_v1(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_confirm_product_identity_key_repair_v1(uuid, text, uuid, text, text, timestamptz, text)
  from public, anon, authenticated, service_role;

grant execute on function public.admin_preflight_product_identity_key_repair_v1(uuid, uuid)
  to service_role;
grant execute on function public.admin_confirm_product_identity_key_repair_v1(uuid, text, uuid, text, text, timestamptz, text)
  to service_role;

comment on table public.product_identity_key_repair_requests is
  'Idempotency ledger for admin-controlled product normalized-name case/whitespace repairs.';
comment on function public.admin_preflight_product_identity_key_repair_v1(uuid, uuid) is
  'Read-only preflight. Only marks case/whitespace-only normalized-name drift as mechanically repairable.';
comment on function public.admin_confirm_product_identity_key_repair_v1(uuid, text, uuid, text, text, timestamptz, text) is
  'Service-role-only controlled repair for case/whitespace-only product normalized-name drift with exact prestate, collision, admin capability, idempotency, and audit checks.';

commit;
