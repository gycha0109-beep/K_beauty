begin;

-- PF-5B1 immutable Product Fact Subject registration boundary.
-- Depends on PF-2 storage plus the controlled-write v1 helper layer.

do $$
begin
  if to_regclass('public.product_fact_subjects') is null
    or to_regprocedure('public.product_fact_controlled_json_exact_keys_v1(jsonb,text[])') is null
    or to_regprocedure('public.admin_require_product_review_actor(uuid,text)') is null
    or to_regprocedure('public.record_admin_audit_event(uuid,text,text,text,text,jsonb,jsonb,text,text,jsonb)') is null
  then
    raise exception 'product_fact_subject_registration_prerequisite_missing';
  end if;
end $$;

create or replace function public.admin_register_product_fact_subject_v1(
  p_actor_user_id uuid,
  p_request_id text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_role text;
  v_request_id text := btrim(coalesce(p_request_id, ''));
  v_product_id uuid;
  v_predecessor_subject_id uuid;
  v_subject_id uuid;
  v_subject_semantic_key text;
  v_subject_identity_serializer_version text;
  v_variant_key text;
  v_formulation_revision_key text;
  v_formulation_label text;
  v_identity_status text;
  v_identity_resolution_version text;
  v_current_state text;
  v_market_applicability text;
  v_region_applicability text;
  v_valid_from date;
  v_valid_to date;
  v_supersession_kind text;
  v_existing public.product_fact_subjects%rowtype;
  v_audit_id uuid;
  v_result jsonb;
begin
  v_actor_role := public.admin_require_product_review_actor(
    p_actor_user_id,
    'admin.products.review'
  );

  if char_length(v_request_id) not between 8 and 120
    or not public.product_fact_controlled_json_exact_keys_v1(
      p_payload,
      array[
        'product_id',
        'subject_semantic_key',
        'subject_identity_serializer_version',
        'variant_key',
        'formulation_revision_key',
        'formulation_label',
        'identity_status',
        'identity_resolution_version',
        'current_state',
        'market_applicability',
        'region_applicability',
        'valid_from',
        'valid_to',
        'predecessor_subject_id',
        'supersession_kind'
      ]
    )
  then
    raise exception 'product_fact_subject_payload_invalid' using errcode = '22023';
  end if;

  begin
    v_product_id := (p_payload ->> 'product_id')::uuid;
    if p_payload -> 'predecessor_subject_id' <> 'null'::jsonb then
      v_predecessor_subject_id := (p_payload ->> 'predecessor_subject_id')::uuid;
    end if;
    if p_payload -> 'valid_from' <> 'null'::jsonb then
      v_valid_from := (p_payload ->> 'valid_from')::date;
    end if;
    if p_payload -> 'valid_to' <> 'null'::jsonb then
      v_valid_to := (p_payload ->> 'valid_to')::date;
    end if;
  exception when others then
    raise exception 'product_fact_subject_identity_invalid' using errcode = '22023';
  end;

  v_subject_semantic_key := lower(btrim(coalesce(p_payload ->> 'subject_semantic_key', '')));
  v_subject_identity_serializer_version :=
    btrim(coalesce(p_payload ->> 'subject_identity_serializer_version', ''));
  v_variant_key := nullif(btrim(coalesce(p_payload ->> 'variant_key', '')), '');
  v_formulation_revision_key :=
    btrim(coalesce(p_payload ->> 'formulation_revision_key', ''));
  v_formulation_label := nullif(btrim(coalesce(p_payload ->> 'formulation_label', '')), '');
  v_identity_status := p_payload ->> 'identity_status';
  v_identity_resolution_version :=
    btrim(coalesce(p_payload ->> 'identity_resolution_version', ''));
  v_current_state := p_payload ->> 'current_state';
  v_market_applicability :=
    nullif(btrim(coalesce(p_payload ->> 'market_applicability', '')), '');
  v_region_applicability :=
    nullif(btrim(coalesce(p_payload ->> 'region_applicability', '')), '');
  v_supersession_kind := nullif(btrim(coalesce(p_payload ->> 'supersession_kind', '')), '');

  if v_subject_semantic_key !~ '^[0-9a-f]{64}$'
    or char_length(v_subject_identity_serializer_version) not between 1 and 160
    or (v_variant_key is not null and char_length(v_variant_key) not between 1 and 160)
    or char_length(v_formulation_revision_key) not between 1 and 160
    or v_identity_status not in ('resolved', 'ambiguous', 'unresolved')
    or char_length(v_identity_resolution_version) not between 1 and 160
    or v_current_state not in ('provisional', 'current', 'historical')
    or (v_current_state = 'current' and v_identity_status <> 'resolved')
    or (v_market_applicability is not null and char_length(v_market_applicability) not between 1 and 32)
    or (v_region_applicability is not null and char_length(v_region_applicability) not between 1 and 64)
    or (v_valid_from is not null and v_valid_to is not null and v_valid_from >= v_valid_to)
    or (
      (v_predecessor_subject_id is null and v_supersession_kind is not null)
      or
      (v_predecessor_subject_id is not null and v_supersession_kind not in (
        'reformulation', 'identity_correction', 'semantic_variant_split'
      ))
    )
  then
    raise exception 'product_fact_subject_payload_invalid' using errcode = '23514';
  end if;

  if not exists (select 1 from public.products where id = v_product_id) then
    raise exception 'product_fact_subject_product_not_found' using errcode = 'P0002';
  end if;

  if v_predecessor_subject_id is not null and not exists (
    select 1
    from public.product_fact_subjects
    where subject_id = v_predecessor_subject_id
      and product_id = v_product_id
  ) then
    raise exception 'product_fact_subject_predecessor_not_found' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('bejewely_product_fact_subject:' || v_subject_semantic_key, 0)
  );

  select * into v_existing
  from public.product_fact_subjects
  where subject_semantic_key = v_subject_semantic_key;

  if found then
    if v_existing.product_id <> v_product_id
      or v_existing.subject_identity_serializer_version <> v_subject_identity_serializer_version
      or v_existing.variant_key is distinct from v_variant_key
      or v_existing.formulation_revision_key <> v_formulation_revision_key
      or v_existing.formulation_label is distinct from v_formulation_label
      or v_existing.identity_status <> v_identity_status
      or v_existing.identity_resolution_version <> v_identity_resolution_version
      or v_existing.current_state <> v_current_state
      or v_existing.market_applicability is distinct from v_market_applicability
      or v_existing.region_applicability is distinct from v_region_applicability
      or v_existing.valid_from is distinct from v_valid_from
      or v_existing.valid_to is distinct from v_valid_to
      or v_existing.predecessor_subject_id is distinct from v_predecessor_subject_id
      or v_existing.supersession_kind is distinct from v_supersession_kind
    then
      raise exception 'product_fact_subject_semantic_key_conflict' using errcode = '23505';
    end if;

    return jsonb_build_object(
      'status', 'registered',
      'idempotent', true,
      'subject_id', v_existing.subject_id,
      'product_id', v_existing.product_id,
      'subject_semantic_key', v_existing.subject_semantic_key,
      'identity_status', v_existing.identity_status,
      'current_state', v_existing.current_state
    );
  end if;

  insert into public.product_fact_subjects (
    product_id,
    subject_semantic_key,
    subject_identity_serializer_version,
    variant_key,
    formulation_revision_key,
    formulation_label,
    identity_status,
    identity_resolution_version,
    current_state,
    market_applicability,
    region_applicability,
    valid_from,
    valid_to,
    predecessor_subject_id,
    supersession_kind,
    created_at,
    updated_at
  ) values (
    v_product_id,
    v_subject_semantic_key,
    v_subject_identity_serializer_version,
    v_variant_key,
    v_formulation_revision_key,
    v_formulation_label,
    v_identity_status,
    v_identity_resolution_version,
    v_current_state,
    v_market_applicability,
    v_region_applicability,
    v_valid_from,
    v_valid_to,
    v_predecessor_subject_id,
    v_supersession_kind,
    now(),
    now()
  )
  returning subject_id into v_subject_id;

  insert into public.product_fact_review_events (
    subject_id,
    actor_user_id,
    event_kind,
    reason_code,
    event_payload,
    created_at
  ) values (
    v_subject_id,
    p_actor_user_id,
    'subject_registered',
    'controlled_subject_registration',
    jsonb_build_object(
      'request_id', v_request_id,
      'product_id', v_product_id,
      'subject_semantic_key', v_subject_semantic_key,
      'identity_status', v_identity_status,
      'current_state', v_current_state,
      'predecessor_subject_id', v_predecessor_subject_id,
      'supersession_kind', v_supersession_kind
    ),
    now()
  );

  v_audit_id := public.record_admin_audit_event(
    p_actor_user_id,
    'admin.products.review',
    'admin.product_fact.subject_registered',
    'product_fact_subject',
    v_subject_id::text,
    null,
    jsonb_build_object(
      'product_id', v_product_id,
      'subject_semantic_key', v_subject_semantic_key,
      'identity_status', v_identity_status,
      'current_state', v_current_state,
      'formulation_revision_key', v_formulation_revision_key,
      'variant_key', v_variant_key,
      'market_applicability', v_market_applicability,
      'region_applicability', v_region_applicability
    ),
    'register immutable Product Fact subject identity',
    v_request_id,
    jsonb_build_object(
      'subject_identity_serializer_version', v_subject_identity_serializer_version,
      'identity_resolution_version', v_identity_resolution_version
    )
  );

  v_result := jsonb_build_object(
    'status', 'registered',
    'idempotent', false,
    'subject_id', v_subject_id,
    'product_id', v_product_id,
    'subject_semantic_key', v_subject_semantic_key,
    'identity_status', v_identity_status,
    'current_state', v_current_state,
    'audit_id', v_audit_id
  );

  return v_result;
end;
$$;

revoke all on function public.admin_register_product_fact_subject_v1(uuid, text, jsonb)
  from public, anon, authenticated, service_role;

grant execute on function public.admin_register_product_fact_subject_v1(uuid, text, jsonb)
  to service_role;

comment on function public.admin_register_product_fact_subject_v1(uuid, text, jsonb) is
  'Service-role-only immutable Product Fact Subject registration boundary; semantic-key replay is idempotent and conflicting identity reuse fails closed.';

do $$
begin
  if not (
    select cls.relrowsecurity
    from pg_class as cls
    join pg_namespace as ns on ns.oid = cls.relnamespace
    where ns.nspname = 'public'
      and cls.relname = 'product_fact_subjects'
  ) then
    raise exception 'product_fact_subject_registration_rls_disabled';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants as grant_row
    where grant_row.table_schema = 'public'
      and grant_row.table_name = 'product_fact_subjects'
      and grant_row.grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
      and grant_row.privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
  ) then
    raise exception 'product_fact_subject_registration_direct_write_exposed';
  end if;

  if has_function_privilege(
      'anon',
      'public.admin_register_product_fact_subject_v1(uuid,text,jsonb)',
      'EXECUTE'
    )
    or has_function_privilege(
      'authenticated',
      'public.admin_register_product_fact_subject_v1(uuid,text,jsonb)',
      'EXECUTE'
    )
    or not has_function_privilege(
      'service_role',
      'public.admin_register_product_fact_subject_v1(uuid,text,jsonb)',
      'EXECUTE'
    )
  then
    raise exception 'product_fact_subject_registration_rpc_privilege_invalid';
  end if;
end $$;

commit;
