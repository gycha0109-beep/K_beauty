begin;

-- DATA-AI29C-UVA-R3D
-- Registry coexistence infrastructure only.
-- This migration does NOT publish a new Registry version and does NOT write Product Facts.

create table public.product_fact_registry_fact_write_policy_v1 (
  registry_version text not null,
  fact_key text not null,
  policy_state text not null,
  new_lineage_allowed boolean not null,
  existing_lineage_allowed boolean not null,
  effective_from timestamptz not null,
  effective_to timestamptz,
  policy_version text not null,
  authorized_phase text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_fact_registry_fact_write_policy_v1_pkey
    primary key (registry_version, fact_key),
  constraint product_fact_registry_fact_write_policy_v1_definition_fk
    foreign key (registry_version, fact_key)
    references public.product_fact_definition_snapshots(registry_version, fact_key)
    on delete restrict,
  constraint product_fact_registry_fact_write_policy_v1_state_check
    check (policy_state in ('active', 'draining', 'blocked')),
  constraint product_fact_registry_fact_write_policy_v1_time_check
    check (effective_to is null or effective_from < effective_to),
  constraint product_fact_registry_fact_write_policy_v1_text_check
    check (
      char_length(btrim(policy_version)) between 1 and 160
      and char_length(btrim(authorized_phase)) between 1 and 160
    ),
  constraint product_fact_registry_fact_write_policy_v1_state_semantics_check
    check (
      (policy_state = 'active'
        and new_lineage_allowed = true
        and existing_lineage_allowed = true)
      or
      (policy_state = 'draining'
        and new_lineage_allowed = false
        and existing_lineage_allowed = true)
      or
      (policy_state = 'blocked'
        and new_lineage_allowed = false
        and existing_lineage_allowed = false)
    )
);

create unique index product_fact_registry_fact_write_policy_v1_one_new_writer_idx
  on public.product_fact_registry_fact_write_policy_v1(fact_key)
  where new_lineage_allowed = true;

alter table public.product_fact_registry_fact_write_policy_v1 enable row level security;
alter table public.product_fact_registry_fact_write_policy_v1 force row level security;

revoke all on table public.product_fact_registry_fact_write_policy_v1
  from public, anon, authenticated, service_role;
grant select on table public.product_fact_registry_fact_write_policy_v1
  to service_role;

create or replace function public.product_fact_controlled_registry_write_admissibility_v2(
  p_registry_version text,
  p_fact_key text,
  p_lineage_kind text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $function$
declare
  v_registry_version text := btrim(coalesce(p_registry_version, ''));
  v_fact_key text := btrim(coalesce(p_fact_key, ''));
  v_lineage_kind text := lower(btrim(coalesce(p_lineage_kind, '')));
  v_policy public.product_fact_registry_fact_write_policy_v1%rowtype;
  v_definition public.product_fact_definition_snapshots%rowtype;
  v_allowed boolean := false;
  v_reason text;
  v_policy_digest text;
begin
  if char_length(v_registry_version) not between 1 and 160
    or char_length(v_fact_key) not between 1 and 160
    or v_lineage_kind not in ('new', 'existing')
  then
    raise exception 'product_fact_registry_write_admissibility_input_invalid'
      using errcode = '22023';
  end if;

  select * into v_definition
  from public.product_fact_definition_snapshots
  where registry_version = v_registry_version
    and fact_key = v_fact_key;

  if not found then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'DEFINITION_NOT_FOUND',
      'registry_version', v_registry_version,
      'fact_key', v_fact_key,
      'lineage_kind', v_lineage_kind,
      'policy_state', null,
      'policy_version', null,
      'policy_digest', null
    );
  end if;

  if v_definition.deprecated then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'DEFINITION_DEPRECATED',
      'registry_version', v_registry_version,
      'fact_key', v_fact_key,
      'lineage_kind', v_lineage_kind,
      'policy_state', null,
      'policy_version', null,
      'policy_digest', null
    );
  end if;

  select * into v_policy
  from public.product_fact_registry_fact_write_policy_v1
  where registry_version = v_registry_version
    and fact_key = v_fact_key;

  if not found then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'POLICY_MISSING',
      'registry_version', v_registry_version,
      'fact_key', v_fact_key,
      'lineage_kind', v_lineage_kind,
      'policy_state', null,
      'policy_version', null,
      'policy_digest', null
    );
  end if;

  v_policy_digest := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object(
      'registry_version', v_policy.registry_version,
      'fact_key', v_policy.fact_key,
      'policy_state', v_policy.policy_state,
      'new_lineage_allowed', v_policy.new_lineage_allowed,
      'existing_lineage_allowed', v_policy.existing_lineage_allowed,
      'effective_from', v_policy.effective_from,
      'effective_to', v_policy.effective_to,
      'policy_version', v_policy.policy_version,
      'authorized_phase', v_policy.authorized_phase
    )
  );

  if v_policy.effective_from > now()
    or (v_policy.effective_to is not null and v_policy.effective_to <= now())
  then
    v_reason := 'POLICY_NOT_EFFECTIVE';
  elsif v_policy.policy_state = 'blocked' then
    v_reason := 'POLICY_BLOCKED';
  elsif v_lineage_kind = 'new' and not v_policy.new_lineage_allowed then
    v_reason := 'NEW_LINEAGE_NOT_ALLOWED';
  elsif v_lineage_kind = 'existing' and not v_policy.existing_lineage_allowed then
    v_reason := 'EXISTING_LINEAGE_NOT_ALLOWED';
  else
    v_allowed := true;
    v_reason := 'ALLOWED';
  end if;

  return jsonb_build_object(
    'allowed', v_allowed,
    'reason', v_reason,
    'registry_version', v_registry_version,
    'fact_key', v_fact_key,
    'lineage_kind', v_lineage_kind,
    'policy_state', v_policy.policy_state,
    'new_lineage_allowed', v_policy.new_lineage_allowed,
    'existing_lineage_allowed', v_policy.existing_lineage_allowed,
    'effective_from', v_policy.effective_from,
    'effective_to', v_policy.effective_to,
    'policy_version', v_policy.policy_version,
    'authorized_phase', v_policy.authorized_phase,
    'policy_digest', v_policy_digest
  );
end;
$function$;

revoke all on function public.product_fact_controlled_registry_write_admissibility_v2(text,text,text)
  from public, anon, authenticated, service_role;

create or replace function public.admin_set_product_fact_registry_fact_write_policy_v1(
  p_actor_user_id uuid,
  p_request_id text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor_role text;
  v_request_id text := btrim(coalesce(p_request_id, ''));
  v_registry_version text;
  v_fact_key text;
  v_policy_state text;
  v_new_lineage_allowed boolean;
  v_existing_lineage_allowed boolean;
  v_effective_from timestamptz;
  v_effective_to timestamptz;
  v_policy_version text;
  v_authorized_phase text;
  v_reason_code text;
  v_existing public.product_fact_registry_fact_write_policy_v1%rowtype;
  v_row public.product_fact_registry_fact_write_policy_v1%rowtype;
  v_audit_id uuid;
begin
  v_actor_role := public.admin_require_product_review_actor(
    p_actor_user_id,
    'admin.operations.execute'
  );

  if char_length(v_request_id) not between 8 and 120
    or not public.product_fact_controlled_json_exact_keys_v1(
      p_payload,
      array[
        'registry_version',
        'fact_key',
        'policy_state',
        'new_lineage_allowed',
        'existing_lineage_allowed',
        'effective_from',
        'effective_to',
        'policy_version',
        'authorized_phase',
        'reason_code'
      ]
    )
  then
    raise exception 'product_fact_registry_write_policy_payload_invalid'
      using errcode = '22023';
  end if;

  v_registry_version := btrim(coalesce(p_payload ->> 'registry_version', ''));
  v_fact_key := btrim(coalesce(p_payload ->> 'fact_key', ''));
  v_policy_state := lower(btrim(coalesce(p_payload ->> 'policy_state', '')));
  v_policy_version := btrim(coalesce(p_payload ->> 'policy_version', ''));
  v_authorized_phase := btrim(coalesce(p_payload ->> 'authorized_phase', ''));
  v_reason_code := btrim(coalesce(p_payload ->> 'reason_code', ''));

  begin
    if jsonb_typeof(p_payload -> 'new_lineage_allowed') <> 'boolean'
      or jsonb_typeof(p_payload -> 'existing_lineage_allowed') <> 'boolean'
      or jsonb_typeof(p_payload -> 'effective_from') <> 'string'
    then
      raise exception 'invalid_policy_types';
    end if;
    v_new_lineage_allowed := (p_payload ->> 'new_lineage_allowed')::boolean;
    v_existing_lineage_allowed := (p_payload ->> 'existing_lineage_allowed')::boolean;
    v_effective_from := (p_payload ->> 'effective_from')::timestamptz;
    if p_payload -> 'effective_to' <> 'null'::jsonb then
      v_effective_to := (p_payload ->> 'effective_to')::timestamptz;
    end if;
  exception when others then
    raise exception 'product_fact_registry_write_policy_payload_invalid'
      using errcode = '22023';
  end;

  if char_length(v_registry_version) not between 1 and 160
    or char_length(v_fact_key) not between 1 and 160
    or v_policy_state not in ('active', 'draining', 'blocked')
    or char_length(v_policy_version) not between 1 and 160
    or char_length(v_authorized_phase) not between 1 and 160
    or char_length(v_reason_code) not between 1 and 160
    or (v_effective_to is not null and v_effective_from >= v_effective_to)
    or (
      v_policy_state = 'active'
      and (not v_new_lineage_allowed or not v_existing_lineage_allowed)
    )
    or (
      v_policy_state = 'draining'
      and (v_new_lineage_allowed or not v_existing_lineage_allowed)
    )
    or (
      v_policy_state = 'blocked'
      and (v_new_lineage_allowed or v_existing_lineage_allowed)
    )
  then
    raise exception 'product_fact_registry_write_policy_payload_invalid'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.product_fact_definition_snapshots
    where registry_version = v_registry_version
      and fact_key = v_fact_key
      and deprecated = false
  ) then
    raise exception 'product_fact_registry_write_policy_definition_not_found'
      using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('bejewely_product_fact_registry_write_policy:' || v_fact_key, 0)
  );

  if v_new_lineage_allowed and exists (
    select 1
    from public.product_fact_registry_fact_write_policy_v1
    where fact_key = v_fact_key
      and registry_version <> v_registry_version
      and new_lineage_allowed = true
  ) then
    raise exception 'product_fact_registry_write_policy_dual_writer_forbidden'
      using errcode = '23505';
  end if;

  select * into v_existing
  from public.product_fact_registry_fact_write_policy_v1
  where registry_version = v_registry_version
    and fact_key = v_fact_key
  for update;

  if found
    and v_existing.policy_state = v_policy_state
    and v_existing.new_lineage_allowed = v_new_lineage_allowed
    and v_existing.existing_lineage_allowed = v_existing_lineage_allowed
    and v_existing.effective_from = v_effective_from
    and v_existing.effective_to is not distinct from v_effective_to
    and v_existing.policy_version = v_policy_version
    and v_existing.authorized_phase = v_authorized_phase
  then
    return jsonb_build_object(
      'status', 'set',
      'idempotent', true,
      'registry_version', v_existing.registry_version,
      'fact_key', v_existing.fact_key,
      'policy_state', v_existing.policy_state,
      'new_lineage_allowed', v_existing.new_lineage_allowed,
      'existing_lineage_allowed', v_existing.existing_lineage_allowed,
      'policy_version', v_existing.policy_version,
      'authorized_phase', v_existing.authorized_phase
    );
  end if;

  insert into public.product_fact_registry_fact_write_policy_v1 (
    registry_version,
    fact_key,
    policy_state,
    new_lineage_allowed,
    existing_lineage_allowed,
    effective_from,
    effective_to,
    policy_version,
    authorized_phase,
    created_at,
    updated_at
  ) values (
    v_registry_version,
    v_fact_key,
    v_policy_state,
    v_new_lineage_allowed,
    v_existing_lineage_allowed,
    v_effective_from,
    v_effective_to,
    v_policy_version,
    v_authorized_phase,
    coalesce(v_existing.created_at, now()),
    now()
  )
  on conflict (registry_version, fact_key)
  do update set
    policy_state = excluded.policy_state,
    new_lineage_allowed = excluded.new_lineage_allowed,
    existing_lineage_allowed = excluded.existing_lineage_allowed,
    effective_from = excluded.effective_from,
    effective_to = excluded.effective_to,
    policy_version = excluded.policy_version,
    authorized_phase = excluded.authorized_phase,
    updated_at = now()
  returning * into v_row;

  v_audit_id := public.record_admin_audit_event(
    p_actor_user_id,
    'admin.operations.execute',
    'admin.product_fact.registry_write_policy_set',
    'product_fact_registry_fact_write_policy',
    v_registry_version || ':' || v_fact_key,
    case when v_existing.registry_version is null then null else to_jsonb(v_existing) end,
    to_jsonb(v_row),
    'set Product Fact Registry fact-key write policy',
    v_request_id,
    jsonb_build_object(
      'reason_code', v_reason_code,
      'policy_version', v_policy_version,
      'authorized_phase', v_authorized_phase
    )
  );

  return jsonb_build_object(
    'status', 'set',
    'idempotent', false,
    'registry_version', v_row.registry_version,
    'fact_key', v_row.fact_key,
    'policy_state', v_row.policy_state,
    'new_lineage_allowed', v_row.new_lineage_allowed,
    'existing_lineage_allowed', v_row.existing_lineage_allowed,
    'policy_version', v_row.policy_version,
    'authorized_phase', v_row.authorized_phase,
    'audit_id', v_audit_id,
    'actor_role', v_actor_role
  );
end;
$function$;

revoke all on function public.admin_set_product_fact_registry_fact_write_policy_v1(uuid,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.admin_set_product_fact_registry_fact_write_policy_v1(uuid,text,jsonb)
  to service_role;

do $seed$
declare
  v_expected integer;
  v_seeded integer;
begin
  select count(*) into v_expected
  from public.product_fact_definition_snapshots
  where registry_version = 'product-fact-registry-cross-category-v1'
    and deprecated = false;

  if v_expected <> 20 then
    raise exception 'product_fact_registry_write_policy_v1_definition_count_drift:%', v_expected;
  end if;

  insert into public.product_fact_registry_fact_write_policy_v1 (
    registry_version,
    fact_key,
    policy_state,
    new_lineage_allowed,
    existing_lineage_allowed,
    effective_from,
    effective_to,
    policy_version,
    authorized_phase,
    created_at,
    updated_at
  )
  select
    definition.registry_version,
    definition.fact_key,
    'active',
    true,
    true,
    coalesce(registry.effective_at, registry.created_at),
    null,
    'data-ai29c-uva-r3d-registry-coexistence-v1',
    'DATA-AI29C-UVA-R3D',
    now(),
    now()
  from public.product_fact_definition_snapshots as definition
  join public.product_fact_registry_versions as registry
    on registry.registry_version = definition.registry_version
  where definition.registry_version = 'product-fact-registry-cross-category-v1'
    and definition.deprecated = false
  on conflict (registry_version, fact_key) do nothing;

  select count(*) into v_seeded
  from public.product_fact_registry_fact_write_policy_v1
  where registry_version = 'product-fact-registry-cross-category-v1'
    and policy_state = 'active'
    and new_lineage_allowed = true
    and existing_lineage_allowed = true;

  if v_seeded <> v_expected then
    raise exception 'product_fact_registry_write_policy_v1_seed_mismatch:%/%',
      v_seeded, v_expected;
  end if;
end;
$seed$;

create or replace function public.admin_prepare_product_fact_review_v1(
  p_actor_user_id uuid,
  p_request_id text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor_role text;
  v_request_id text := btrim(coalesce(p_request_id, ''));
  v_product_id uuid;
  v_subject_id uuid;
  v_assigned_to uuid;
  v_registry_version text;
  v_fact_key text;
  v_proposition_key text;
  v_operational_state text;
  v_review_policy_version text;
  v_reason_code text;
  v_subject public.product_fact_subjects%rowtype;
  v_assignment public.product_fact_review_assignments%rowtype;
  v_before_state text;
  v_event_kind text;
  v_audit_id uuid;
  v_result jsonb;
  v_registry_write_policy jsonb;
  v_initial boolean := false;
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
        'subject_id',
        'registry_version',
        'fact_key',
        'proposition_key',
        'operational_state',
        'assigned_to',
        'review_policy_version',
        'reason_code'
      ]
    )
  then
    raise exception 'product_fact_review_prepare_payload_invalid' using errcode = '22023';
  end if;

  begin
    v_product_id := (p_payload ->> 'product_id')::uuid;
    if p_payload -> 'subject_id' <> 'null'::jsonb then
      v_subject_id := (p_payload ->> 'subject_id')::uuid;
    end if;
    if p_payload -> 'assigned_to' <> 'null'::jsonb then
      v_assigned_to := (p_payload ->> 'assigned_to')::uuid;
    end if;
  exception when others then
    raise exception 'product_fact_review_prepare_identity_invalid' using errcode = '22023';
  end;

  v_registry_version := btrim(coalesce(p_payload ->> 'registry_version', ''));
  v_fact_key := btrim(coalesce(p_payload ->> 'fact_key', ''));
  v_proposition_key := lower(btrim(coalesce(p_payload ->> 'proposition_key', '')));
  v_operational_state := p_payload ->> 'operational_state';
  v_review_policy_version := btrim(coalesce(p_payload ->> 'review_policy_version', ''));
  v_reason_code := btrim(coalesce(p_payload ->> 'reason_code', ''));

  if v_proposition_key !~ '^[0-9a-f]{64}$'
    or char_length(v_review_policy_version) not between 1 and 160
    or char_length(v_reason_code) not between 1 and 160
    or v_operational_state not in (
      'queued',
      'assigned',
      'under_review',
      'identity_blocked',
      'source_blocked',
      'needs_adjudication',
      'ready_for_confirm',
      're_review_required'
    )
  then
    raise exception 'product_fact_review_prepare_payload_invalid' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.products where id = v_product_id
  ) then
    raise exception 'product_fact_review_prepare_product_not_found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.product_fact_definition_snapshots
    where registry_version = v_registry_version
      and fact_key = v_fact_key
      and deprecated = false
  ) then
    raise exception 'product_fact_review_prepare_definition_not_found' using errcode = 'P0002';
  end if;

  if v_subject_id is null then
    if v_operational_state <> 'identity_blocked' then
      raise exception 'product_fact_review_prepare_subject_required' using errcode = '23514';
    end if;
  else
    select * into v_subject
    from public.product_fact_subjects
    where subject_id = v_subject_id
      and product_id = v_product_id;

    if not found then
      raise exception 'product_fact_review_prepare_subject_not_found' using errcode = 'P0002';
    end if;

    if v_operational_state = 'ready_for_confirm'
      and (
        v_subject.identity_status <> 'resolved'
        or v_subject.current_state <> 'current'
      )
    then
      raise exception 'product_fact_review_prepare_subject_not_current'
        using errcode = '23514';
    end if;
  end if;

  if v_assigned_to is not null and not exists (
    select 1
    from public.admin_memberships as membership
    where membership.user_id = v_assigned_to
      and membership.is_active = true
      and 'admin.products.review' = any(public.admin_role_capabilities(membership.role))
  ) then
    raise exception 'product_fact_review_prepare_assignee_invalid' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('bejewely_product_fact_review:' || v_proposition_key, 0)
  );

  select * into v_assignment
  from public.product_fact_review_assignments
  where product_id = v_product_id
    and subject_id is not distinct from v_subject_id
    and registry_version = v_registry_version
    and fact_key = v_fact_key
    and proposition_key = v_proposition_key
    and operational_state not in ('confirmed', 'superseded')
  order by created_at desc, assignment_id desc
  limit 1
  for update;

  v_registry_write_policy :=
    public.product_fact_controlled_registry_write_admissibility_v2(
      v_registry_version,
      v_fact_key,
      case when v_assignment.assignment_id is null then 'new' else 'existing' end
    );

  if coalesce((v_registry_write_policy ->> 'allowed')::boolean, false) is not true then
    raise exception 'product_fact_review_prepare_registry_write_forbidden:%',
      coalesce(v_registry_write_policy ->> 'reason', 'UNKNOWN')
      using errcode = '40001';
  end if;

  if v_assignment.assignment_id is null then
    if v_operational_state = 'ready_for_confirm' then
      raise exception 'product_fact_review_prepare_transition_invalid'
        using errcode = '23514';
    end if;

    insert into public.product_fact_review_assignments (
      product_id,
      subject_id,
      registry_version,
      fact_key,
      proposition_key,
      operational_state,
      assigned_to,
      review_policy_version,
      created_at,
      updated_at
    ) values (
      v_product_id,
      v_subject_id,
      v_registry_version,
      v_fact_key,
      v_proposition_key,
      v_operational_state,
      v_assigned_to,
      v_review_policy_version,
      now(),
      now()
    )
    returning * into v_assignment;

    v_initial := true;
    v_event_kind := 'review_assignment_prepared';
  else
    if v_assignment.review_policy_version <> v_review_policy_version then
      raise exception 'product_fact_review_prepare_policy_conflict' using errcode = '23505';
    end if;

    if v_assignment.operational_state = v_operational_state
      and v_assignment.assigned_to is not distinct from v_assigned_to
    then
      return jsonb_build_object(
        'status', 'prepared',
        'idempotent', true,
        'assignment_id', v_assignment.assignment_id,
        'operational_state', v_assignment.operational_state,
        'subject_id', v_assignment.subject_id,
        'registry_version', v_assignment.registry_version,
        'fact_key', v_assignment.fact_key,
        'proposition_key', v_assignment.proposition_key
      );
    end if;

    v_before_state := v_assignment.operational_state;

    if not (
      (v_before_state = 'queued'
        and v_operational_state in (
          'assigned', 'under_review', 'identity_blocked', 'source_blocked',
          'needs_adjudication'
        ))
      or (v_before_state = 'assigned'
        and v_operational_state in (
          'under_review', 'identity_blocked', 'source_blocked', 'needs_adjudication'
        ))
      or (v_before_state = 'under_review'
        and v_operational_state in (
          'identity_blocked', 'source_blocked', 'needs_adjudication', 'ready_for_confirm'
        ))
      or (v_before_state = 'identity_blocked'
        and v_operational_state in ('under_review', 'identity_blocked'))
      or (v_before_state = 'source_blocked'
        and v_operational_state in ('under_review', 'source_blocked'))
      or (v_before_state = 'needs_adjudication'
        and v_operational_state in ('under_review', 'needs_adjudication', 'ready_for_confirm'))
      or (v_before_state = 're_review_required'
        and v_operational_state in ('under_review', 're_review_required'))
    ) then
      raise exception 'product_fact_review_prepare_transition_invalid'
        using errcode = '23514';
    end if;

    if v_operational_state = 'ready_for_confirm'
      and (
        v_subject_id is null
        or v_subject.identity_status <> 'resolved'
        or v_subject.current_state <> 'current'
      )
    then
      raise exception 'product_fact_review_prepare_subject_not_current'
        using errcode = '23514';
    end if;

    update public.product_fact_review_assignments
    set operational_state = v_operational_state,
        assigned_to = v_assigned_to,
        updated_at = now()
    where assignment_id = v_assignment.assignment_id
    returning * into v_assignment;

    v_event_kind := 'review_assignment_transitioned';
  end if;

  insert into public.product_fact_review_events (
    assignment_id,
    subject_id,
    actor_user_id,
    event_kind,
    reason_code,
    event_payload,
    created_at
  ) values (
    v_assignment.assignment_id,
    v_assignment.subject_id,
    p_actor_user_id,
    v_event_kind,
    v_reason_code,
    jsonb_build_object(
      'request_id', v_request_id,
      'from_state', v_before_state,
      'to_state', v_assignment.operational_state,
      'review_policy_version', v_assignment.review_policy_version,
      'assigned_to', v_assignment.assigned_to
    ),
    now()
  );

  v_audit_id := public.record_admin_audit_event(
    p_actor_user_id,
    'admin.products.review',
    'admin.product_fact.review_prepared',
    'product_fact_review_assignment',
    v_assignment.assignment_id::text,
    case when v_initial then null else jsonb_build_object(
      'operational_state', v_before_state
    ) end,
    jsonb_build_object(
      'operational_state', v_assignment.operational_state,
      'assigned_to', v_assignment.assigned_to,
      'review_policy_version', v_assignment.review_policy_version
    ),
    'prepare Product Fact review assignment',
    v_request_id,
    jsonb_build_object(
      'subject_id', v_assignment.subject_id,
      'registry_version', v_assignment.registry_version,
      'fact_key', v_assignment.fact_key,
      'proposition_key', v_assignment.proposition_key
    )
  );

  v_result := jsonb_build_object(
    'status', 'prepared',
    'idempotent', false,
    'assignment_id', v_assignment.assignment_id,
    'operational_state', v_assignment.operational_state,
    'subject_id', v_assignment.subject_id,
    'registry_version', v_assignment.registry_version,
    'fact_key', v_assignment.fact_key,
    'proposition_key', v_assignment.proposition_key,
    'audit_id', v_audit_id
  );

  return v_result;
end;

$function$;


create or replace function public.product_fact_controlled_build_preflight_v1(
  p_actor_user_id uuid,
  p_request_id text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $function$
declare
  v_actor_role text;
  v_request_id text := btrim(coalesce(p_request_id, ''));
  v_assignment_id uuid;
  v_subject_id uuid;
  v_parent_fact_instance_id uuid;
  v_supporting_ids uuid[] := '{}'::uuid[];
  v_opposing_ids uuid[] := '{}'::uuid[];
  v_all_ids uuid[] := '{}'::uuid[];
  v_assignment public.product_fact_review_assignments%rowtype;
  v_subject public.product_fact_subjects%rowtype;
  v_definition public.product_fact_definition_snapshots%rowtype;
  v_parent_fact public.product_fact_instances%rowtype;
  v_current public.product_fact_current%rowtype;
  v_current_fact public.product_fact_instances%rowtype;
  v_registry_version text;
  v_fact_key text;
  v_proposition_key text;
  v_semantic_status text;
  v_value_type text;
  v_authority_ceiling text;
  v_expected_authority text := 'none';
  v_fused_confidence text;
  v_fusion_policy_version text;
  v_fusion_input_digest text;
  v_proposition_serializer_version text;
  v_max_authority_rank integer := 0;
  v_payload_digest text;
  v_computed_fusion_input_digest text;
  v_registry_state_digest text;
  v_registry_write_policy jsonb;
  v_subject_state_digest text;
  v_assignment_state_digest text;
  v_evidence_state_digest text;
  v_binding_state_digest text;
  v_current_state_digest text;
  v_prestate_digest text;
  v_previous_current jsonb;
  v_proposed_value jsonb;
  v_evidence_rows jsonb;
  v_expected_writes jsonb;
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
        'assignment_id',
        'subject_id',
        'registry_version',
        'fact_key',
        'proposition_key',
        'proposition_serializer_version',
        'semantic_status',
        'value_type',
        'value_boolean',
        'value_enum',
        'value_number',
        'value_unit',
        'value_range_min',
        'value_range_max',
        'value_entity_identifier',
        'market',
        'region',
        'locale',
        'valid_from',
        'valid_to',
        'qualifier',
        'parent_fact_instance_id',
        'parent_proposition_key',
        'authority_ceiling',
        'fused_confidence',
        'fusion_policy_version',
        'fusion_input_digest',
        'supporting_evidence_ids',
        'opposing_evidence_ids'
      ]
    )
    or octet_length(p_payload::text) > 1048576
  then
    raise exception 'product_fact_confirmation_payload_invalid' using errcode = '22023';
  end if;

  begin
    v_assignment_id := (p_payload ->> 'assignment_id')::uuid;
    v_subject_id := (p_payload ->> 'subject_id')::uuid;
    if p_payload -> 'parent_fact_instance_id' <> 'null'::jsonb then
      v_parent_fact_instance_id := (p_payload ->> 'parent_fact_instance_id')::uuid;
    end if;

    if jsonb_typeof(p_payload -> 'supporting_evidence_ids') <> 'array'
      or jsonb_typeof(p_payload -> 'opposing_evidence_ids') <> 'array'
    then
      raise exception 'invalid_evidence_array';
    end if;

    select coalesce(array_agg(item.value::uuid order by item.value), '{}'::uuid[])
    into v_supporting_ids
    from jsonb_array_elements_text(p_payload -> 'supporting_evidence_ids') as item(value);

    select coalesce(array_agg(item.value::uuid order by item.value), '{}'::uuid[])
    into v_opposing_ids
    from jsonb_array_elements_text(p_payload -> 'opposing_evidence_ids') as item(value);
  exception when others then
    raise exception 'product_fact_confirmation_identity_invalid' using errcode = '22023';
  end;

  if coalesce(array_length(v_supporting_ids, 1), 0) <>
      coalesce((select count(distinct value) from unnest(v_supporting_ids) as value), 0)
    or coalesce(array_length(v_opposing_ids, 1), 0) <>
      coalesce((select count(distinct value) from unnest(v_opposing_ids) as value), 0)
    or exists (
      select 1
      from unnest(v_supporting_ids) as support(value)
      join unnest(v_opposing_ids) as oppose(value) using (value)
    )
  then
    raise exception 'product_fact_confirmation_evidence_set_invalid' using errcode = '23514';
  end if;

  select coalesce(array_agg(value order by value), '{}'::uuid[])
  into v_all_ids
  from (
    select unnest(v_supporting_ids) as value
    union all
    select unnest(v_opposing_ids) as value
  ) as combined;

  v_registry_version := btrim(coalesce(p_payload ->> 'registry_version', ''));
  v_fact_key := btrim(coalesce(p_payload ->> 'fact_key', ''));
  v_proposition_key := lower(btrim(coalesce(p_payload ->> 'proposition_key', '')));
  v_proposition_serializer_version :=
    btrim(coalesce(p_payload ->> 'proposition_serializer_version', ''));
  v_semantic_status := p_payload ->> 'semantic_status';
  v_value_type := nullif(btrim(coalesce(p_payload ->> 'value_type', '')), '');
  v_authority_ceiling := p_payload ->> 'authority_ceiling';
  v_fused_confidence := p_payload ->> 'fused_confidence';
  v_fusion_policy_version := btrim(coalesce(p_payload ->> 'fusion_policy_version', ''));
  v_fusion_input_digest := lower(btrim(coalesce(p_payload ->> 'fusion_input_digest', '')));

  if v_proposition_key !~ '^[0-9a-f]{64}$'
    or char_length(v_proposition_serializer_version) not between 1 and 160
    or v_semantic_status not in (
      'supported',
      'reviewed_not_established',
      'evidence_insufficient',
      'evidence_conflict'
    )
    or v_authority_ceiling not in (
      'product_specific_primary',
      'limited_non_product_specific',
      'review_observation',
      'ingredient_basis',
      'legacy_unreviewed',
      'none'
    )
    or v_fused_confidence not in ('high', 'medium', 'low', 'unknown')
    or char_length(v_fusion_policy_version) not between 1 and 160
    or v_fusion_input_digest !~ '^[0-9a-f]{64}$'
    or jsonb_typeof(p_payload -> 'qualifier') <> 'object'
  then
    raise exception 'product_fact_confirmation_payload_invalid' using errcode = '22023';
  end if;

  select * into v_assignment
  from public.product_fact_review_assignments
  where assignment_id = v_assignment_id;

  if not found then
    raise exception 'product_fact_confirmation_assignment_not_found' using errcode = 'P0002';
  end if;

  if v_assignment.operational_state <> 'ready_for_confirm'
    or v_assignment.subject_id is distinct from v_subject_id
    or v_assignment.registry_version is distinct from v_registry_version
    or v_assignment.fact_key is distinct from v_fact_key
    or v_assignment.proposition_key is distinct from v_proposition_key
  then
    raise exception 'product_fact_confirmation_assignment_stale' using errcode = '40001';
  end if;

  if v_assignment.assigned_to is not null
    and v_assignment.assigned_to <> p_actor_user_id
    and v_actor_role <> 'admin_owner'
  then
    raise exception 'product_fact_confirmation_assignment_actor_mismatch'
      using errcode = '42501';
  end if;

  select * into v_subject
  from public.product_fact_subjects
  where subject_id = v_subject_id;

  if not found then
    raise exception 'product_fact_confirmation_subject_not_found' using errcode = 'P0002';
  end if;

  if v_subject.product_id <> v_assignment.product_id
    or v_subject.identity_status <> 'resolved'
    or v_subject.current_state <> 'current'
  then
    raise exception 'product_fact_confirmation_subject_stale' using errcode = '40001';
  end if;

  select * into v_definition
  from public.product_fact_definition_snapshots
  where registry_version = v_registry_version
    and fact_key = v_fact_key;

  if not found or v_definition.deprecated then
    raise exception 'product_fact_confirmation_definition_stale' using errcode = '40001';
  end if;

  v_registry_write_policy :=
    public.product_fact_controlled_registry_write_admissibility_v2(
      v_registry_version,
      v_fact_key,
      'existing'
    );

  if coalesce((v_registry_write_policy ->> 'allowed')::boolean, false) is not true then
    raise exception 'product_fact_confirmation_registry_write_forbidden:%',
      coalesce(v_registry_write_policy ->> 'reason', 'UNKNOWN')
      using errcode = '40001';
  end if;

  if v_semantic_status = 'supported' then
    if v_value_type is distinct from v_definition.value_type then
      raise exception 'product_fact_confirmation_value_type_mismatch' using errcode = '23514';
    end if;

    if (
      (v_value_type = 'boolean'
        and jsonb_typeof(p_payload -> 'value_boolean') = 'boolean'
        and p_payload -> 'value_enum' = 'null'::jsonb
        and p_payload -> 'value_number' = 'null'::jsonb
        and p_payload -> 'value_unit' = 'null'::jsonb
        and p_payload -> 'value_range_min' = 'null'::jsonb
        and p_payload -> 'value_range_max' = 'null'::jsonb
        and p_payload -> 'value_entity_identifier' = 'null'::jsonb)
      or
      (v_value_type = 'enum'
        and jsonb_typeof(p_payload -> 'value_enum') = 'string'
        and p_payload -> 'value_boolean' = 'null'::jsonb
        and p_payload -> 'value_number' = 'null'::jsonb
        and p_payload -> 'value_unit' = 'null'::jsonb
        and p_payload -> 'value_range_min' = 'null'::jsonb
        and p_payload -> 'value_range_max' = 'null'::jsonb
        and p_payload -> 'value_entity_identifier' = 'null'::jsonb)
      or
      (v_value_type = 'number'
        and jsonb_typeof(p_payload -> 'value_number') = 'number'
        and p_payload -> 'value_boolean' = 'null'::jsonb
        and p_payload -> 'value_enum' = 'null'::jsonb
        and p_payload -> 'value_unit' = 'null'::jsonb
        and p_payload -> 'value_range_min' = 'null'::jsonb
        and p_payload -> 'value_range_max' = 'null'::jsonb
        and p_payload -> 'value_entity_identifier' = 'null'::jsonb)
      or
      (v_value_type = 'number_unit'
        and jsonb_typeof(p_payload -> 'value_number') = 'number'
        and jsonb_typeof(p_payload -> 'value_unit') = 'string'
        and p_payload -> 'value_boolean' = 'null'::jsonb
        and p_payload -> 'value_enum' = 'null'::jsonb
        and p_payload -> 'value_range_min' = 'null'::jsonb
        and p_payload -> 'value_range_max' = 'null'::jsonb
        and p_payload -> 'value_entity_identifier' = 'null'::jsonb)
      or
      (v_value_type = 'range_unit'
        and jsonb_typeof(p_payload -> 'value_range_min') = 'number'
        and jsonb_typeof(p_payload -> 'value_range_max') = 'number'
        and jsonb_typeof(p_payload -> 'value_unit') = 'string'
        and (p_payload ->> 'value_range_min')::numeric
          <= (p_payload ->> 'value_range_max')::numeric
        and p_payload -> 'value_boolean' = 'null'::jsonb
        and p_payload -> 'value_enum' = 'null'::jsonb
        and p_payload -> 'value_number' = 'null'::jsonb
        and p_payload -> 'value_entity_identifier' = 'null'::jsonb)
      or
      (v_value_type = 'entity_identifier'
        and jsonb_typeof(p_payload -> 'value_entity_identifier') = 'string'
        and char_length(btrim(p_payload ->> 'value_entity_identifier')) between 1 and 512
        and p_payload -> 'value_boolean' = 'null'::jsonb
        and p_payload -> 'value_enum' = 'null'::jsonb
        and p_payload -> 'value_number' = 'null'::jsonb
        and p_payload -> 'value_unit' = 'null'::jsonb
        and p_payload -> 'value_range_min' = 'null'::jsonb
        and p_payload -> 'value_range_max' = 'null'::jsonb)
    ) is not true then
      raise exception 'product_fact_confirmation_typed_value_invalid' using errcode = '23514';
    end if;

    if v_value_type = 'enum'
      and jsonb_typeof(v_definition.definition -> 'allowed_values') = 'array'
      and not exists (
        select 1
        from jsonb_array_elements_text(v_definition.definition -> 'allowed_values') as allowed(value)
        where allowed.value = p_payload ->> 'value_enum'
      )
    then
      raise exception 'product_fact_confirmation_enum_value_invalid' using errcode = '23514';
    end if;

    if v_value_type in ('number_unit', 'range_unit')
      and jsonb_typeof(v_definition.definition #> '{unit_schema,allowed_units}') = 'array'
      and not exists (
        select 1
        from jsonb_array_elements_text(
          v_definition.definition #> '{unit_schema,allowed_units}'
        ) as allowed(value)
        where allowed.value = p_payload ->> 'value_unit'
      )
    then
      raise exception 'product_fact_confirmation_unit_invalid' using errcode = '23514';
    end if;
  else
    if v_value_type is not null
      or p_payload -> 'value_boolean' <> 'null'::jsonb
      or p_payload -> 'value_enum' <> 'null'::jsonb
      or p_payload -> 'value_number' <> 'null'::jsonb
      or p_payload -> 'value_unit' <> 'null'::jsonb
      or p_payload -> 'value_range_min' <> 'null'::jsonb
      or p_payload -> 'value_range_max' <> 'null'::jsonb
      or p_payload -> 'value_entity_identifier' <> 'null'::jsonb
    then
      raise exception 'product_fact_confirmation_non_supported_value_forbidden'
        using errcode = '23514';
    end if;
  end if;

  if p_payload -> 'valid_from' <> 'null'::jsonb
    and p_payload -> 'valid_to' <> 'null'::jsonb
    and (p_payload ->> 'valid_from')::date >= (p_payload ->> 'valid_to')::date
  then
    raise exception 'product_fact_confirmation_validity_invalid' using errcode = '23514';
  end if;

  if v_parent_fact_instance_id is null
      and p_payload -> 'parent_proposition_key' <> 'null'::jsonb
    or v_parent_fact_instance_id is not null
      and p_payload -> 'parent_proposition_key' = 'null'::jsonb
  then
    raise exception 'product_fact_confirmation_parent_pair_invalid' using errcode = '23514';
  end if;

  if v_parent_fact_instance_id is not null then
    select * into v_parent_fact
    from public.product_fact_instances
    where fact_instance_id = v_parent_fact_instance_id
      and proposition_key = lower(p_payload ->> 'parent_proposition_key')
      and subject_id = v_subject_id;

    if not found then
      raise exception 'product_fact_confirmation_parent_subject_mismatch'
        using errcode = '23514';
    end if;
  end if;

  if coalesce(array_length(v_all_ids, 1), 0) > 0 then
    if (
      select count(*)
      from public.product_evidence_records
      where evidence_id = any(v_all_ids)
    ) <> array_length(v_all_ids, 1) then
      raise exception 'product_fact_confirmation_evidence_missing' using errcode = 'P0002';
    end if;

    if exists (
      select 1
      from public.product_evidence_records as evidence
      where evidence.evidence_id = any(v_all_ids)
        and (
          evidence.subject_id <> v_subject_id
          or evidence.registry_version <> v_registry_version
          or evidence.fact_key <> v_fact_key
          or evidence.proposition_key <> v_proposition_key
          or not public.product_fact_controlled_binding_is_current_v1(evidence.binding_id)
          or exists (
            select 1
            from public.product_evidence_records as newer
            where newer.supersedes_evidence_id = evidence.evidence_id
          )
        )
    ) then
      raise exception 'product_fact_confirmation_evidence_stale' using errcode = '40001';
    end if;

    if exists (
      select 1
      from public.product_evidence_records as evidence
      join public.product_evidence_sources as source
        on source.source_id = evidence.source_id
      where evidence.evidence_id = any(v_all_ids)
        and lower(source.source_kind) ~
          '(ranking|popularity|sales[_ -]?rank|market[_ -]?signal)'
    ) then
      raise exception 'product_fact_market_popularity_fact_input_forbidden'
        using errcode = '23514';
    end if;

    if exists (
      select 1
      from public.product_evidence_records
      where evidence_id = any(v_supporting_ids)
        and (
          support_direction <> 'supports'
          or negative_admissibility <> 'not_applicable'
        )
    ) then
      raise exception 'product_fact_confirmation_support_role_invalid'
        using errcode = '23514';
    end if;

    if exists (
      select 1
      from public.product_evidence_records
      where evidence_id = any(v_opposing_ids)
        and (
          support_direction <> 'opposes'
          or negative_admissibility not in ('explicit_negative', 'conflict_opposition')
        )
    ) then
      raise exception 'product_fact_confirmation_opposition_role_invalid'
        using errcode = '23514';
    end if;
  end if;

  if v_semantic_status = 'supported' then
    if v_value_type = 'boolean'
      and (p_payload ->> 'value_boolean')::boolean = false
    then
      if not exists (
        select 1
        from public.product_evidence_records
        where evidence_id = any(v_opposing_ids)
          and negative_admissibility = 'explicit_negative'
      ) then
        raise exception 'product_fact_supported_false_requires_explicit_negative'
          using errcode = '23514';
      end if;
    elsif coalesce(array_length(v_supporting_ids, 1), 0) = 0 then
      raise exception 'product_fact_supported_requires_supporting_evidence'
        using errcode = '23514';
    end if;
  end if;

  if v_semantic_status = 'evidence_conflict'
    and (
      coalesce(array_length(v_supporting_ids, 1), 0) = 0
      or coalesce(array_length(v_opposing_ids, 1), 0) = 0
    )
  then
    raise exception 'product_fact_conflict_requires_support_and_opposition'
      using errcode = '23514';
  end if;

  select coalesce(max(public.product_fact_controlled_authority_rank_v1(evidence.evidence_authority)), 0)
  into v_max_authority_rank
  from public.product_evidence_records as evidence
  where evidence.evidence_id = any(v_all_ids);

  v_expected_authority := case v_max_authority_rank
    when 5 then 'product_specific_primary'
    when 4 then 'limited_non_product_specific'
    when 3 then 'review_observation'
    when 2 then 'ingredient_basis'
    when 1 then 'legacy_unreviewed'
    else 'none'
  end;

  if v_authority_ceiling <> v_expected_authority then
    raise exception 'product_fact_confirmation_authority_ceiling_invalid'
      using errcode = '23514';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'evidence_id', evidence.evidence_id,
        'role', case
          when evidence.evidence_id = any(v_supporting_ids) then 'supporting'
          else 'opposing'
        end,
        'canonical_evidence_digest', evidence.canonical_evidence_digest,
        'evidence_authority', evidence.evidence_authority,
        'confidence', evidence.confidence,
        'support_direction', evidence.support_direction,
        'negative_admissibility', evidence.negative_admissibility
      )
      order by evidence.evidence_id
    ),
    '[]'::jsonb
  )
  into v_evidence_rows
  from public.product_evidence_records as evidence
  where evidence.evidence_id = any(v_all_ids);

  v_computed_fusion_input_digest := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object(
      'registry_version', v_registry_version,
      'subject_id', v_subject_id,
      'fact_key', v_fact_key,
      'proposition_key', v_proposition_key,
      'fusion_policy_version', v_fusion_policy_version,
      'evidence', v_evidence_rows
    )
  );

  if v_computed_fusion_input_digest <> v_fusion_input_digest then
    raise exception 'product_fact_confirmation_fusion_input_stale' using errcode = '40001';
  end if;

  v_payload_digest := public.product_fact_controlled_sha256_json_v1(p_payload);

  v_registry_state_digest := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object(
      'latest_effective_registry', public.product_fact_controlled_latest_registry_v1(),
      'effective_registry_versions', (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'registry_version', registry.registry_version,
            'registry_checksum', registry.registry_checksum,
            'identity_serializer_version', registry.identity_serializer_version,
            'effective_at', registry.effective_at,
            'created_at', registry.created_at
          ) order by registry.registry_version
        ), '[]'::jsonb)
        from public.product_fact_registry_versions as registry
        where registry.effective_at is null or registry.effective_at <= now()
      ),
      'write_policy', v_registry_write_policy,
      'definition_checksum', v_definition.definition_checksum,
      'definition_deprecated', v_definition.deprecated
    )
  );

  v_subject_state_digest := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object(
      'subject_id', v_subject.subject_id,
      'product_id', v_subject.product_id,
      'subject_semantic_key', v_subject.subject_semantic_key,
      'identity_status', v_subject.identity_status,
      'identity_resolution_version', v_subject.identity_resolution_version,
      'current_state', v_subject.current_state,
      'market_applicability', v_subject.market_applicability,
      'region_applicability', v_subject.region_applicability,
      'valid_from', v_subject.valid_from,
      'valid_to', v_subject.valid_to,
      'updated_at', v_subject.updated_at
    )
  );

  v_assignment_state_digest := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object(
      'assignment_id', v_assignment.assignment_id,
      'operational_state', v_assignment.operational_state,
      'assigned_to', v_assignment.assigned_to,
      'review_policy_version', v_assignment.review_policy_version,
      'updated_at', v_assignment.updated_at
    )
  );

  v_evidence_state_digest := public.product_fact_controlled_sha256_json_v1(
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'evidence_id', evidence.evidence_id,
          'source_id', evidence.source_id,
          'binding_id', evidence.binding_id,
          'canonical_evidence_digest', evidence.canonical_evidence_digest,
          'evidence_authority', evidence.evidence_authority,
          'confidence', evidence.confidence,
          'support_direction', evidence.support_direction,
          'negative_admissibility', evidence.negative_admissibility,
          'supersedes_evidence_id', evidence.supersedes_evidence_id,
          'created_at', evidence.created_at
        )
        order by evidence.evidence_id
      )
      from public.product_evidence_records as evidence
      where evidence.subject_id = v_subject_id
        and evidence.registry_version = v_registry_version
        and evidence.fact_key = v_fact_key
        and evidence.proposition_key = v_proposition_key
    ), '[]'::jsonb)
  );

  v_binding_state_digest := public.product_fact_controlled_sha256_json_v1(
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'binding_id', binding.binding_id,
          'source_id', binding.source_id,
          'product_id', binding.product_id,
          'subject_id', binding.subject_id,
          'binding_state', binding.binding_state,
          'scope_relation', binding.scope_relation,
          'identity_resolution_version', binding.identity_resolution_version,
          'reviewed_at', binding.reviewed_at,
          'created_at', binding.created_at
        )
        order by binding.binding_id
      )
      from public.product_evidence_source_subject_bindings as binding
      where binding.source_id in (
        select distinct evidence.source_id
        from public.product_evidence_records as evidence
        where evidence.subject_id = v_subject_id
          and evidence.registry_version = v_registry_version
          and evidence.fact_key = v_fact_key
          and evidence.proposition_key = v_proposition_key
      )
    ), '[]'::jsonb)
  );

  select * into v_current
  from public.product_fact_current
  where proposition_key = v_proposition_key;

  if found then
    select * into strict v_current_fact
    from public.product_fact_instances
    where fact_instance_id = v_current.fact_instance_id;

    v_previous_current := jsonb_build_object(
      'proposition_key', v_current.proposition_key,
      'fact_instance_id', v_current.fact_instance_id,
      'subject_id', v_current.subject_id,
      'confirmation_id', v_current.confirmation_id,
      'updated_at', v_current.updated_at,
      'semantic_status', v_current_fact.semantic_status,
      'value_type', v_current_fact.value_type,
      'authority_ceiling', v_current_fact.authority_ceiling,
      'fused_confidence', v_current_fact.fused_confidence,
      'fusion_policy_version', v_current_fact.fusion_policy_version,
      'fusion_input_digest', v_current_fact.fusion_input_digest
    );
  else
    v_previous_current := null;
  end if;

  v_current_state_digest :=
    public.product_fact_controlled_sha256_json_v1(to_jsonb(v_previous_current));

  v_prestate_digest := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object(
      'registry_state_digest', v_registry_state_digest,
      'subject_state_digest', v_subject_state_digest,
      'assignment_state_digest', v_assignment_state_digest,
      'evidence_state_digest', v_evidence_state_digest,
      'binding_state_digest', v_binding_state_digest,
      'current_state_digest', v_current_state_digest
    )
  );

  v_proposed_value := case
    when v_semantic_status <> 'supported' then null
    else jsonb_build_object(
      'value_type', v_value_type,
      'value_boolean', p_payload -> 'value_boolean',
      'value_enum', p_payload -> 'value_enum',
      'value_number', p_payload -> 'value_number',
      'value_unit', p_payload -> 'value_unit',
      'value_range_min', p_payload -> 'value_range_min',
      'value_range_max', p_payload -> 'value_range_max',
      'value_entity_identifier', p_payload -> 'value_entity_identifier'
    )
  end;

  v_expected_writes := jsonb_build_object(
    'product_fact_instances', 1,
    'product_fact_evidence_links', coalesce(array_length(v_all_ids, 1), 0),
    'product_fact_confirmations', 1,
    'product_fact_current', 1,
    'product_fact_review_assignments_update', 1,
    'product_fact_review_events', 1
  );

  v_result := jsonb_build_object(
    'status', 'ready',
    'actor_role', v_actor_role,
    'request_id', v_request_id,
    'registry_version', v_registry_version,
    'subject_id', v_subject_id,
    'fact_key', v_fact_key,
    'proposition_key', v_proposition_key,
    'supporting_evidence_ids', to_jsonb(v_supporting_ids),
    'opposing_evidence_ids', to_jsonb(v_opposing_ids),
    'proposed_semantic_status', v_semantic_status,
    'proposed_value', v_proposed_value,
    'authority_ceiling', v_authority_ceiling,
    'fused_confidence', v_fused_confidence,
    'fusion_policy_version', v_fusion_policy_version,
    'fusion_input_digest', v_fusion_input_digest,
    'previous_current', v_previous_current,
    'payload_digest', v_payload_digest,
    'prestate_digest', v_prestate_digest,
    'expected_write_set', v_expected_writes
  );

  return v_result;
end;

$function$;


create or replace function public.trust_phase4_build_adoption_plan_v1(
  p_actor_user_id uuid,
  p_candidate_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $function$
declare
  v_candidate public.trust_evidence_candidates%rowtype;
  v_task public.product_fact_research_tasks%rowtype;
  v_intake public.catalog_trust_intake%rowtype;
  v_observation public.trust_source_observations%rowtype;
  v_subject public.product_fact_subjects%rowtype;
  v_catalog_binding public.product_source_bindings%rowtype;
  v_definition public.product_fact_definition_snapshots%rowtype;
  v_existing_evidence public.product_evidence_records%rowtype;
  v_registry_version text;
  v_registry_write_policy jsonb;
  v_expected_observation_digest text;
  v_expected_candidate_digest text;
  v_proposition_key text;
  v_scope jsonb;
  v_value_type text;
  v_allowed_values jsonb;
  v_allowed_units jsonb;
  v_cardinality text;
  v_value_boolean boolean;
  v_value_enum text;
  v_value_number numeric;
  v_value_unit text;
  v_value_range_min numeric;
  v_value_range_max numeric;
  v_value_entity_identifier text;
  v_source_payload jsonb;
  v_binding_payload jsonb;
  v_evidence_payload jsonb;
  v_fact_payload_base jsonb;
  v_fusion_policy constant text := 'trust-phase4-single-primary-evidence-v1';
  v_fusion_input_digest text;
  v_open_assignment_count bigint;
  v_legacy boolean := false;
  v_legacy_source_review public.trust_official_source_binding_reviews%rowtype;
  v_binding_scope_relation text := 'equivalent';
  v_subject_ref_required boolean := false;
  v_parent_fact_key text;
  v_parent_proposition_key text;
  v_parent_fact_instance_id uuid;
  v_parent_fact public.product_fact_instances%rowtype;
begin
  perform public.admin_require_product_review_actor(
    p_actor_user_id,
    'admin.products.review'
  );

  if p_candidate_id is null then
    raise exception 'trust_phase4_candidate_id_required' using errcode = '22023';
  end if;

  select * into v_candidate
  from public.trust_evidence_candidates
  where candidate_id = p_candidate_id;

  if not found then
    raise exception 'trust_phase4_candidate_not_found' using errcode = '22023';
  end if;

  if v_candidate.candidate_state <> 'READY' then
    raise exception 'trust_phase4_candidate_not_ready:%', v_candidate.candidate_state
      using errcode = '55000';
  end if;

  select * into v_task
  from public.product_fact_research_tasks
  where id = v_candidate.research_task_id;

  if not found
    or v_task.state <> 'EVIDENCE_CANDIDATE'
    or v_task.evidence_candidate_id is distinct from v_candidate.candidate_id
    or v_task.source_observation_id is distinct from v_candidate.observation_id
    or v_task.product_id is distinct from v_candidate.product_id
    or v_task.subject_id is distinct from v_candidate.subject_id
    or v_task.registry_version is distinct from v_candidate.registry_version
    or v_task.fact_key is distinct from v_candidate.fact_key then
    raise exception 'trust_phase4_research_task_lineage_invalid' using errcode = '55000';
  end if;

  select * into v_intake
  from public.catalog_trust_intake
  where id = v_task.intake_id;

  if not found
    or v_intake.product_id is distinct from v_candidate.product_id
    or v_intake.identity_state <> 'EXACT_SUBJECT_FOUND'
    or v_intake.subject_id is distinct from v_candidate.subject_id
    or nullif(btrim(coalesce(v_intake.identity_resolution_version, '')), '') is null
    or v_intake.market is distinct from v_candidate.market then
    raise exception 'trust_phase4_intake_identity_invalid' using errcode = '55000';
  end if;

  v_legacy := v_intake.catalog_revision like 'legacy-backfill-v1:%';

  if v_legacy
    and not public.trust_phase7c_legacy_subject_scope_ready_v1(v_task.id) then
    raise exception 'trust_phase4_legacy_subject_scope_invalid' using errcode = '55000';
  end if;

  select * into v_observation
  from public.trust_source_observations
  where observation_id = v_candidate.observation_id;

  if not found
    or v_observation.research_task_id is distinct from v_candidate.research_task_id
    or v_observation.product_id is distinct from v_candidate.product_id
    or v_observation.subject_id is distinct from v_candidate.subject_id
    or v_observation.canonical_locator is distinct from v_task.source_locator
    or v_observation.source_content_digest is distinct from v_task.source_content_digest
    or (not v_legacy and v_observation.market is distinct from v_candidate.market)
    or v_observation.region is distinct from v_candidate.region
    or v_observation.locale is distinct from v_candidate.locale then
    raise exception 'trust_phase4_source_observation_lineage_invalid' using errcode = '55000';
  end if;

  if v_observation.canonical_locator !~ '^https://'
    or v_observation.source_content_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'trust_phase4_source_observation_invalid' using errcode = '22023';
  end if;

  if v_observation.digest_basis = 'frozen-first-party-observation-v1-not-live-page-bytes' then
    v_expected_observation_digest := encode(
      extensions.digest(
        convert_to(
          jsonb_build_object(
            'source_binding_id', v_observation.source_binding_id,
            'canonical_locator', v_observation.canonical_locator,
            'publisher', v_observation.publisher,
            'source_kind', v_observation.source_kind,
            'market', v_observation.market,
            'locale', v_observation.locale,
            'observed_claim', v_observation.observed_claim,
            'product_identity_observation', v_observation.product_identity_observation,
            'observation_version', v_observation.observation_version
          )::text,
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    );

    if v_expected_observation_digest <> v_observation.source_content_digest then
      raise exception 'trust_phase4_source_observation_digest_mismatch' using errcode = '55000';
    end if;
  elsif v_observation.digest_basis <> 'live-page-bytes-v1' then
    raise exception 'trust_phase4_source_digest_basis_invalid' using errcode = '22023';
  end if;

  select * into v_catalog_binding
  from public.product_source_bindings
  where binding_id = v_observation.source_binding_id;

  if not found
    or v_catalog_binding.product_id is distinct from v_candidate.product_id
    or v_catalog_binding.binding_state <> 'resolved'
    or v_catalog_binding.source_name !~ '_official$'
    or v_catalog_binding.source_url is distinct from v_observation.canonical_locator
    or v_catalog_binding.source_url !~ '^https://'
    or v_catalog_binding.market_code is distinct from v_observation.market
    or (not v_legacy and v_catalog_binding.market_code is distinct from v_candidate.market)
    or v_catalog_binding.locale is distinct from v_candidate.locale then
    raise exception 'trust_phase4_catalog_source_binding_invalid' using errcode = '55000';
  end if;

  if v_legacy then
    select * into v_legacy_source_review
    from public.trust_official_source_binding_reviews osr
    where osr.binding_id = v_catalog_binding.binding_id
      and osr.product_id = v_candidate.product_id
      and osr.subject_id = v_candidate.subject_id
      and osr.subject_market is not distinct from v_intake.market
      and osr.source_market is not distinct from v_observation.market
      and osr.variant_key is not distinct from (
        select s.variant_key
        from public.product_fact_subjects s
        where s.subject_id = v_candidate.subject_id
      )
      and osr.formulation_revision_key is not distinct from (
        select s.formulation_revision_key
        from public.product_fact_subjects s
        where s.subject_id = v_candidate.subject_id
      )
      and osr.source_kind = v_observation.source_kind
      and osr.scope_relation in ('equivalent','narrower')
      and osr.review_version = 'trust-official-source-review-v1'
    order by osr.created_at desc, osr.review_id desc
    limit 1;

    if not found
      or v_catalog_binding.binding_method <> 'trust_official_source_review_v1'
      or v_catalog_binding.product_scope_state <> 'product' then
      raise exception 'trust_phase4_legacy_controlled_source_invalid' using errcode = '55000';
    end if;

    v_binding_scope_relation := v_legacy_source_review.scope_relation;
  end if;

  select * into v_subject
  from public.product_fact_subjects
  where subject_id = v_candidate.subject_id;

  if not found
    or v_subject.product_id is distinct from v_candidate.product_id
    or v_subject.identity_status <> 'resolved'
    or v_subject.current_state <> 'current'
    or v_subject.market_applicability is distinct from v_candidate.market
    or (not v_legacy and v_subject.variant_key is not null) then
    raise exception 'trust_phase4_subject_identity_invalid' using errcode = '55000';
  end if;

  if v_legacy and (
    v_legacy_source_review.variant_key is distinct from v_subject.variant_key
    or v_legacy_source_review.formulation_revision_key is distinct from v_subject.formulation_revision_key
  ) then
    raise exception 'trust_phase4_legacy_subject_review_mismatch' using errcode = '55000';
  end if;

  v_registry_version := v_candidate.registry_version;
  v_registry_write_policy :=
    public.product_fact_controlled_registry_write_admissibility_v2(
      v_candidate.registry_version,
      v_candidate.fact_key,
      'existing'
    );

  if coalesce((v_registry_write_policy ->> 'allowed')::boolean, false) is not true then
    raise exception 'trust_phase4_registry_write_forbidden:%',
      coalesce(v_registry_write_policy ->> 'reason', 'UNKNOWN')
      using errcode = '55000';
  end if;

  select * into v_definition
  from public.product_fact_definition_snapshots
  where registry_version = v_candidate.registry_version
    and fact_key = v_candidate.fact_key
    and deprecated = false;

  if not found then
    raise exception 'trust_phase4_registry_definition_missing' using errcode = '55000';
  end if;

  if not coalesce(v_definition.definition -> 'permitted_evidence_classes' ? v_candidate.evidence_class, false) then
    raise exception 'trust_phase4_evidence_class_not_permitted' using errcode = '55000';
  end if;

  if v_candidate.evidence_authority <> 'product_specific_primary'
    or v_candidate.support_direction <> 'supports'
    or v_candidate.negative_admissibility <> 'not_applicable' then
    raise exception 'trust_phase4_candidate_requires_adjudication' using errcode = '55000';
  end if;

  v_subject_ref_required :=
    coalesce((v_definition.definition #>> '{relationship_schema,subject_ref_required}')::boolean, false);
  v_parent_fact_key :=
    nullif(btrim(coalesce(v_definition.definition #>> '{relationship_schema,subject_ref_fact_key}', '')), '');
  v_parent_proposition_key := v_candidate.parent_proposition_key;

  if v_subject_ref_required then
    if v_parent_proposition_key is null
      or v_parent_proposition_key !~ '^[0-9a-f]{64}$'
      or v_parent_fact_key is null then
      raise exception 'trust_phase4_parent_proposition_required' using errcode = '55000';
    end if;

    select pfi.* into v_parent_fact
    from public.product_fact_current pc
    join public.product_fact_instances pfi on pfi.fact_instance_id = pc.fact_instance_id
    where pc.proposition_key = v_parent_proposition_key
      and pc.subject_id = v_candidate.subject_id
      and pfi.subject_id = v_candidate.subject_id
      and pfi.registry_version = v_candidate.registry_version
      and pfi.fact_key = v_parent_fact_key
      and pfi.semantic_status = 'supported';

    if not found then
      raise exception 'trust_phase4_parent_proposition_not_current' using errcode = '55000';
    end if;

    if (v_parent_fact.market is not null and v_parent_fact.market is distinct from v_candidate.market)
      or (v_parent_fact.region is not null and v_parent_fact.region is distinct from v_candidate.region) then
      raise exception 'trust_phase4_parent_scope_mismatch' using errcode = '55000';
    end if;

    v_parent_fact_instance_id := v_parent_fact.fact_instance_id;
  elsif v_parent_proposition_key is not null then
    raise exception 'trust_phase4_parent_proposition_unexpected' using errcode = '55000';
  end if;

  if jsonb_typeof(v_candidate.qualifier) <> 'object' then
    raise exception 'trust_phase4_qualifier_invalid' using errcode = '22023';
  end if;

  v_value_type := v_definition.value_type;
  v_allowed_values := v_definition.definition -> 'allowed_values';
  v_allowed_units := v_definition.definition #> '{unit_schema,allowed_units}';
  v_cardinality := coalesce(v_definition.definition ->> 'cardinality', 'one');

  if v_value_type = 'boolean' then
    if jsonb_typeof(v_candidate.normalized_value) <> 'boolean' then
      raise exception 'trust_phase4_normalized_value_invalid:boolean' using errcode = '22023';
    end if;
    v_value_boolean := (v_candidate.normalized_value #>> '{}')::boolean;
  elsif v_value_type = 'enum' then
    if jsonb_typeof(v_candidate.normalized_value) <> 'string' then
      raise exception 'trust_phase4_normalized_value_invalid:enum' using errcode = '22023';
    end if;
    v_value_enum := v_candidate.normalized_value #>> '{}';
    if jsonb_typeof(v_allowed_values) = 'array' and not (v_allowed_values ? v_value_enum) then
      raise exception 'trust_phase4_enum_value_invalid' using errcode = '22023';
    end if;
  elsif v_value_type = 'number' then
    if jsonb_typeof(v_candidate.normalized_value) <> 'number' then
      raise exception 'trust_phase4_normalized_value_invalid:number' using errcode = '22023';
    end if;
    v_value_number := (v_candidate.normalized_value #>> '{}')::numeric;
  elsif v_value_type = 'entity_identifier' then
    if jsonb_typeof(v_candidate.normalized_value) <> 'string'
      or nullif(btrim(v_candidate.normalized_value #>> '{}'), '') is null then
      raise exception 'trust_phase4_normalized_value_invalid:entity_identifier' using errcode = '22023';
    end if;
    v_value_entity_identifier := v_candidate.normalized_value #>> '{}';
  elsif v_value_type = 'number_unit' then
    if jsonb_typeof(v_candidate.normalized_value) <> 'object'
      or not (v_candidate.normalized_value ?& array['amount','unit'])
      or (select count(*) from jsonb_object_keys(v_candidate.normalized_value)) <> 2
      or jsonb_typeof(v_candidate.normalized_value -> 'amount') <> 'number'
      or jsonb_typeof(v_candidate.normalized_value -> 'unit') <> 'string' then
      raise exception 'trust_phase4_normalized_value_invalid:number_unit' using errcode = '22023';
    end if;
    v_value_number := (v_candidate.normalized_value ->> 'amount')::numeric;
    v_value_unit := v_candidate.normalized_value ->> 'unit';
    if jsonb_typeof(v_allowed_units) = 'array' and not (v_allowed_units ? v_value_unit) then
      raise exception 'trust_phase4_unit_invalid' using errcode = '22023';
    end if;
  elsif v_value_type = 'range_unit' then
    if jsonb_typeof(v_candidate.normalized_value) <> 'object'
      or not (v_candidate.normalized_value ?& array['min','max','unit'])
      or (select count(*) from jsonb_object_keys(v_candidate.normalized_value)) <> 3
      or jsonb_typeof(v_candidate.normalized_value -> 'min') <> 'number'
      or jsonb_typeof(v_candidate.normalized_value -> 'max') <> 'number'
      or jsonb_typeof(v_candidate.normalized_value -> 'unit') <> 'string' then
      raise exception 'trust_phase4_normalized_value_invalid:range_unit' using errcode = '22023';
    end if;
    v_value_range_min := (v_candidate.normalized_value ->> 'min')::numeric;
    v_value_range_max := (v_candidate.normalized_value ->> 'max')::numeric;
    v_value_unit := v_candidate.normalized_value ->> 'unit';
    if v_value_range_min > v_value_range_max then
      raise exception 'trust_phase4_range_invalid' using errcode = '22023';
    end if;
    if jsonb_typeof(v_allowed_units) = 'array' and not (v_allowed_units ? v_value_unit) then
      raise exception 'trust_phase4_unit_invalid' using errcode = '22023';
    end if;
  else
    raise exception 'trust_phase4_value_type_unsupported:%', v_value_type using errcode = '55000';
  end if;

  v_expected_candidate_digest := encode(
    extensions.digest(
      convert_to(
        (
          jsonb_build_object(
            'subject_id', v_candidate.subject_id,
            'registry_version', v_candidate.registry_version,
            'fact_key', v_candidate.fact_key,
            'normalized_value', v_candidate.normalized_value,
            'evidence_class', v_candidate.evidence_class,
            'support_direction', v_candidate.support_direction,
            'negative_admissibility', v_candidate.negative_admissibility,
            'market', v_candidate.market,
            'region', v_candidate.region,
            'locale', v_candidate.locale,
            'qualifier', v_candidate.qualifier,
            'source_content_digest', v_observation.source_content_digest
          )
          || case
            when v_parent_proposition_key is null then '{}'::jsonb
            else jsonb_build_object('parent_proposition_key', v_parent_proposition_key)
          end
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  if v_expected_candidate_digest <> v_candidate.canonical_evidence_digest then
    raise exception 'trust_phase4_candidate_digest_mismatch' using errcode = '55000';
  end if;

  v_scope := jsonb_strip_nulls(jsonb_build_object(
    'market', v_candidate.market,
    'variant', v_subject.variant_key
  ));

  v_proposition_key := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object(
      'serializer_version', 'product-fact-proposition-pilot-v1',
      'subject_semantic_key', v_subject.subject_semantic_key,
      'registry_version', v_candidate.registry_version,
      'fact_key', v_candidate.fact_key,
      'value_identity', case when v_subject_ref_required then null else v_candidate.normalized_value end,
      'scope', v_scope,
      'qualifier', v_candidate.qualifier,
      'parent_proposition_key', v_parent_proposition_key
    )
  );

  if exists (
    select 1 from public.product_fact_current c
    where c.proposition_key = v_proposition_key
  ) then
    raise exception 'trust_phase4_candidate_already_current' using errcode = '55000';
  end if;

  if v_cardinality = 'one' and exists (
    select 1
    from public.product_fact_current c
    join public.product_fact_instances fi on fi.fact_instance_id = c.fact_instance_id
    where c.subject_id = v_candidate.subject_id
      and fi.registry_version = v_candidate.registry_version
      and fi.fact_key = v_candidate.fact_key
      and c.proposition_key <> v_proposition_key
  ) then
    raise exception 'trust_phase4_cardinality_collision' using errcode = '55000';
  end if;

  if exists (
    select 1 from public.product_fact_instances fi
    where fi.proposition_key = v_proposition_key
      and (
        fi.subject_id <> v_candidate.subject_id
        or fi.registry_version <> v_candidate.registry_version
        or fi.fact_key <> v_candidate.fact_key
      )
  ) then
    raise exception 'trust_phase4_proposition_collision' using errcode = '55000';
  end if;

  select * into v_existing_evidence
  from public.product_evidence_records
  where canonical_evidence_digest = v_candidate.canonical_evidence_digest;

  if found and (
    v_existing_evidence.subject_id <> v_candidate.subject_id
    or v_existing_evidence.registry_version <> v_candidate.registry_version
    or v_existing_evidence.fact_key <> v_candidate.fact_key
    or v_existing_evidence.proposition_key <> v_proposition_key
    or v_existing_evidence.proposition_serializer_version <> 'product-fact-proposition-pilot-v1'
    or v_existing_evidence.proposition_value_identity is distinct from
      (case when v_subject_ref_required then null else v_candidate.normalized_value end)
    or v_existing_evidence.parent_proposition_key is distinct from v_parent_proposition_key
    or v_existing_evidence.evidence_class <> v_candidate.evidence_class
    or v_existing_evidence.evidence_authority <> v_candidate.evidence_authority
    or v_existing_evidence.confidence <> v_candidate.confidence
    or v_existing_evidence.support_direction <> v_candidate.support_direction
    or v_existing_evidence.negative_admissibility <> v_candidate.negative_admissibility
    or v_existing_evidence.market is distinct from v_candidate.market
    or v_existing_evidence.region is distinct from v_candidate.region
    or v_existing_evidence.locale is distinct from v_candidate.locale
    or v_existing_evidence.qualifier is distinct from v_candidate.qualifier
  ) then
    raise exception 'trust_phase4_governed_evidence_collision' using errcode = '55000';
  end if;

  select count(*) into v_open_assignment_count
  from public.product_fact_review_assignments a
  where a.product_id = v_candidate.product_id
    and a.subject_id = v_candidate.subject_id
    and a.registry_version = v_candidate.registry_version
    and a.fact_key = v_candidate.fact_key
    and a.proposition_key = v_proposition_key
    and a.operational_state not in ('confirmed','superseded');

  if v_open_assignment_count > 1 then
    raise exception 'trust_phase4_duplicate_open_assignments' using errcode = '55000';
  end if;

  v_source_payload := jsonb_build_object(
    'canonical_locator', v_observation.canonical_locator,
    'publisher', v_observation.publisher,
    'source_kind', v_observation.source_kind,
    'source_metadata', jsonb_build_object('digest_basis', v_observation.digest_basis),
    'content_digest', v_observation.source_content_digest,
    'external_snapshot_reference', null,
    'market', v_observation.market,
    'region', v_observation.region,
    'locale', v_observation.locale,
    'published_at', null,
    'accessed_at', coalesce(v_observation.fetched_at, v_observation.observed_at),
    'observed_at', v_observation.observed_at
  );

  v_binding_payload := jsonb_build_object(
    'product_id', v_candidate.product_id,
    'subject_id', v_candidate.subject_id,
    'binding_state', 'exact_subject_match',
    'scope_relation', v_binding_scope_relation,
    'presentation_metadata', jsonb_build_object(
      'catalog_source_binding_id', v_observation.source_binding_id
    ),
    'identity_resolution_version', v_intake.identity_resolution_version,
    'reviewed_at', v_candidate.created_at
  );

  v_evidence_payload := jsonb_build_object(
    'registry_version', v_candidate.registry_version,
    'fact_key', v_candidate.fact_key,
    'proposition_key', v_proposition_key,
    'proposition_serializer_version', 'product-fact-proposition-pilot-v1',
    'proposition_value_identity', case when v_subject_ref_required then null else v_candidate.normalized_value end,
    'parent_proposition_key', v_parent_proposition_key,
    'evidence_class', v_candidate.evidence_class,
    'evidence_authority', v_candidate.evidence_authority,
    'confidence', v_candidate.confidence,
    'support_direction', v_candidate.support_direction,
    'negative_admissibility', v_candidate.negative_admissibility,
    'market', v_candidate.market,
    'region', v_candidate.region,
    'locale', v_candidate.locale,
    'valid_from', null,
    'valid_to', null,
    'qualifier', v_candidate.qualifier,
    'canonical_evidence_digest', v_candidate.canonical_evidence_digest,
    'supersedes_evidence_id', null
  );

  v_fusion_input_digest := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object(
      'fusion_policy_version', v_fusion_policy,
      'proposition_key', v_proposition_key,
      'supporting_evidence_digests', jsonb_build_array(v_candidate.canonical_evidence_digest),
      'opposing_evidence_digests', '[]'::jsonb
    )
  );

  v_fact_payload_base := jsonb_build_object(
    'subject_id', v_candidate.subject_id,
    'registry_version', v_candidate.registry_version,
    'fact_key', v_candidate.fact_key,
    'proposition_key', v_proposition_key,
    'proposition_serializer_version', 'product-fact-proposition-pilot-v1',
    'semantic_status', 'supported',
    'value_type', v_value_type,
    'value_boolean', v_value_boolean,
    'value_enum', v_value_enum,
    'value_number', v_value_number,
    'value_unit', v_value_unit,
    'value_range_min', v_value_range_min,
    'value_range_max', v_value_range_max,
    'value_entity_identifier', v_value_entity_identifier,
    'market', v_candidate.market,
    'region', v_candidate.region,
    'locale', v_candidate.locale,
    'valid_from', null,
    'valid_to', null,
    'qualifier', v_candidate.qualifier,
    'parent_fact_instance_id', v_parent_fact_instance_id,
    'parent_proposition_key', v_parent_proposition_key,
    'authority_ceiling', 'product_specific_primary',
    'fused_confidence', v_candidate.confidence,
    'fusion_policy_version', v_fusion_policy,
    'fusion_input_digest', v_fusion_input_digest
  );

  return jsonb_build_object(
    'candidate_id', v_candidate.candidate_id,
    'product_id', v_candidate.product_id,
    'subject_id', v_candidate.subject_id,
    'registry_version', v_candidate.registry_version,
    'fact_key', v_candidate.fact_key,
    'proposition_key', v_proposition_key,
    'proposition_serializer_version', 'product-fact-proposition-pilot-v1',
    'canonical_evidence_digest', v_candidate.canonical_evidence_digest,
    'source_payload', v_source_payload,
    'binding_payload', v_binding_payload,
    'evidence_payload', v_evidence_payload,
    'fact_payload_base', v_fact_payload_base,
    'open_assignment_count', v_open_assignment_count
  );
end;

$function$;


create or replace function public.trust_phase8e_build_revalidation_plan_legacy_v1(
  p_actor_user_id uuid,
  p_transition_id uuid,
  p_candidate_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $function$
declare
  v_transition public.product_fact_revalidation_transitions%rowtype;
  v_bridge public.product_fact_revalidation_research_bridges%rowtype;
  v_assignment public.product_fact_review_assignments%rowtype;
  v_current public.product_fact_current%rowtype;
  v_current_fact public.product_fact_instances%rowtype;
  v_task public.product_fact_research_tasks%rowtype;
  v_candidate public.trust_evidence_candidates%rowtype;
  v_observation public.trust_source_observations%rowtype;
  v_intake public.catalog_trust_intake%rowtype;
  v_subject public.product_fact_subjects%rowtype;
  v_scope jsonb;
  v_candidate_proposition_key text;
  v_semantic_relation text;
  v_prestate_digest text;
  v_source_payload jsonb;
  v_binding_payload jsonb;
  v_evidence_payload jsonb;
  v_registry_write_policy jsonb;
begin
  perform public.admin_require_product_review_actor(
    p_actor_user_id,
    'admin.products.review'
  );

  if p_transition_id is null or p_candidate_id is null then
    raise exception 'product_fact_revalidation_resolution_identity_required'
      using errcode = '22023';
  end if;

  select * into v_transition
  from public.product_fact_revalidation_transitions
  where transition_id = p_transition_id;

  if not found then
    raise exception 'product_fact_revalidation_resolution_transition_not_found'
      using errcode = 'P0002';
  end if;

  select * into v_bridge
  from public.product_fact_revalidation_research_bridges
  where transition_id = p_transition_id
    and disposition = 'RESEARCH_REQUEUED';

  if not found or v_bridge.research_task_id is null then
    raise exception 'product_fact_revalidation_resolution_bridge_missing'
      using errcode = '55000';
  end if;

  select * into v_assignment
  from public.product_fact_review_assignments
  where assignment_id = v_transition.assignment_id;

  if not found
    or v_assignment.assignment_id <> v_bridge.assignment_id
    or v_assignment.operational_state <> 're_review_required'
    or v_assignment.subject_id is null
    or v_assignment.proposition_key is distinct from v_transition.proposition_key then
    raise exception 'product_fact_revalidation_resolution_assignment_stale'
      using errcode = '40001';
  end if;

  select * into v_current
  from public.product_fact_current
  where proposition_key = v_transition.proposition_key;

  if not found
    or v_current.fact_instance_id <> v_transition.fact_instance_id
    or v_current.confirmation_id <> v_transition.confirmation_id
    or v_current.subject_id is distinct from v_assignment.subject_id then
    raise exception 'product_fact_revalidation_resolution_current_stale'
      using errcode = '40001';
  end if;

  select * into v_current_fact
  from public.product_fact_instances
  where fact_instance_id = v_current.fact_instance_id;

  if not found
    or v_current_fact.proposition_key <> v_transition.proposition_key
    or v_current_fact.subject_id is distinct from v_assignment.subject_id
    or v_current_fact.registry_version is distinct from v_assignment.registry_version
    or v_current_fact.fact_key is distinct from v_assignment.fact_key then
    raise exception 'product_fact_revalidation_resolution_fact_stale'
      using errcode = '40001';
  end if;

  select * into v_task
  from public.product_fact_research_tasks
  where id = v_bridge.research_task_id;

  if not found
    or v_task.state <> 'EVIDENCE_CANDIDATE'
    or v_task.evidence_candidate_id is distinct from p_candidate_id
    or v_task.subject_id is distinct from v_assignment.subject_id
    or v_task.registry_version is distinct from v_assignment.registry_version
    or v_task.fact_key is distinct from v_assignment.fact_key then
    raise exception 'product_fact_revalidation_resolution_task_stale'
      using errcode = '40001';
  end if;

  select * into v_candidate
  from public.trust_evidence_candidates
  where candidate_id = p_candidate_id;

  if not found
    or v_candidate.candidate_state <> 'READY'
    or v_candidate.research_task_id <> v_task.id
    or v_candidate.subject_id is distinct from v_assignment.subject_id
    or v_candidate.registry_version is distinct from v_assignment.registry_version
    or v_candidate.fact_key is distinct from v_assignment.fact_key
    or v_candidate.evidence_authority <> 'product_specific_primary'
    or not (
      (
        v_candidate.support_direction = 'supports'
        and v_candidate.negative_admissibility = 'not_applicable'
      )
      or (
        v_candidate.support_direction = 'opposes'
        and v_candidate.negative_admissibility = 'explicit_negative'
        and jsonb_typeof(v_candidate.normalized_value) = 'boolean'
        and (v_candidate.normalized_value #>> '{}')::boolean = false
      )
    ) then
    raise exception 'product_fact_revalidation_resolution_candidate_invalid'
      using errcode = '55000';
  end if;

  select * into v_observation
  from public.trust_source_observations
  where observation_id = v_candidate.observation_id;

  if not found
    or v_observation.research_task_id <> v_task.id
    or v_observation.product_id <> v_candidate.product_id
    or v_observation.subject_id <> v_candidate.subject_id
    or v_observation.source_content_digest is distinct from v_task.source_content_digest
    or v_observation.canonical_locator is distinct from v_task.source_locator then
    raise exception 'product_fact_revalidation_resolution_observation_invalid'
      using errcode = '55000';
  end if;

  select * into v_intake
  from public.catalog_trust_intake
  where id = v_task.intake_id;

  if not found
    or v_intake.identity_state <> 'EXACT_SUBJECT_FOUND'
    or v_intake.product_id <> v_candidate.product_id
    or v_intake.subject_id is distinct from v_candidate.subject_id
    or nullif(btrim(coalesce(v_intake.identity_resolution_version, '')), '') is null
    or v_intake.market is distinct from v_candidate.market then
    raise exception 'product_fact_revalidation_resolution_intake_invalid'
      using errcode = '55000';
  end if;

  select * into v_subject
  from public.product_fact_subjects
  where subject_id = v_candidate.subject_id;

  if not found
    or v_subject.product_id <> v_candidate.product_id
    or v_subject.identity_status <> 'resolved'
    or v_subject.current_state <> 'current'
    or v_subject.market_applicability is distinct from v_candidate.market then
    raise exception 'product_fact_revalidation_resolution_subject_invalid'
      using errcode = '55000';
  end if;

  v_registry_write_policy :=
    public.product_fact_controlled_registry_write_admissibility_v2(
      v_candidate.registry_version,
      v_candidate.fact_key,
      'existing'
    );

  if coalesce((v_registry_write_policy ->> 'allowed')::boolean, false) is not true then
    raise exception 'product_fact_revalidation_resolution_registry_write_forbidden:%',
      coalesce(v_registry_write_policy ->> 'reason', 'UNKNOWN')
      using errcode = '40001';
  end if;

  v_scope := jsonb_strip_nulls(jsonb_build_object(
    'market', v_candidate.market,
    'variant', v_subject.variant_key
  ));

  v_candidate_proposition_key := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object(
      'serializer_version', 'product-fact-proposition-pilot-v1',
      'subject_semantic_key', v_subject.subject_semantic_key,
      'registry_version', v_candidate.registry_version,
      'fact_key', v_candidate.fact_key,
      'value_identity', v_candidate.normalized_value,
      'scope', v_scope,
      'qualifier', v_candidate.qualifier,
      'parent_proposition_key', null
    )
  );

  v_semantic_relation := case
    when v_candidate_proposition_key = v_transition.proposition_key
      then 'SAME_SEMANTIC'
    else 'SEMANTIC_CHANGE'
  end;

  v_source_payload := jsonb_build_object(
    'canonical_locator', v_observation.canonical_locator,
    'publisher', v_observation.publisher,
    'source_kind', v_observation.source_kind,
    'source_metadata', jsonb_build_object('digest_basis', v_observation.digest_basis),
    'content_digest', v_observation.source_content_digest,
    'external_snapshot_reference', null,
    'market', v_observation.market,
    'region', v_observation.region,
    'locale', v_observation.locale,
    'published_at', null,
    'accessed_at', coalesce(v_observation.fetched_at, v_observation.observed_at),
    'observed_at', v_observation.observed_at
  );

  v_binding_payload := jsonb_build_object(
    'product_id', v_candidate.product_id,
    'subject_id', v_candidate.subject_id,
    'binding_state', 'exact_subject_match',
    'scope_relation', 'equivalent',
    'presentation_metadata', jsonb_build_object(
      'catalog_source_binding_id', v_observation.source_binding_id
    ),
    'identity_resolution_version', v_intake.identity_resolution_version,
    'reviewed_at', v_candidate.created_at
  );

  v_evidence_payload := jsonb_build_object(
    'registry_version', v_candidate.registry_version,
    'fact_key', v_candidate.fact_key,
    'proposition_key', v_candidate_proposition_key,
    'proposition_serializer_version', 'product-fact-proposition-pilot-v1',
    'proposition_value_identity', v_candidate.normalized_value,
    'parent_proposition_key', null,
    'evidence_class', v_candidate.evidence_class,
    'evidence_authority', v_candidate.evidence_authority,
    'confidence', v_candidate.confidence,
    'support_direction', v_candidate.support_direction,
    'negative_admissibility', v_candidate.negative_admissibility,
    'market', v_candidate.market,
    'region', v_candidate.region,
    'locale', v_candidate.locale,
    'valid_from', null,
    'valid_to', null,
    'qualifier', v_candidate.qualifier,
    'canonical_evidence_digest', v_candidate.canonical_evidence_digest,
    'supersedes_evidence_id', null
  );

  v_prestate_digest := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object(
      'transition', jsonb_build_object(
        'transition_id', v_transition.transition_id,
        'assignment_id', v_transition.assignment_id,
        'proposition_key', v_transition.proposition_key,
        'fact_instance_id', v_transition.fact_instance_id,
        'confirmation_id', v_transition.confirmation_id
      ),
      'bridge', jsonb_build_object(
        'bridge_id', v_bridge.bridge_id,
        'research_task_id', v_bridge.research_task_id,
        'disposition', v_bridge.disposition
      ),
      'assignment', jsonb_build_object(
        'assignment_id', v_assignment.assignment_id,
        'operational_state', v_assignment.operational_state,
        'review_policy_version', v_assignment.review_policy_version,
        'updated_at', v_assignment.updated_at
      ),
      'current', jsonb_build_object(
        'proposition_key', v_current.proposition_key,
        'fact_instance_id', v_current.fact_instance_id,
        'confirmation_id', v_current.confirmation_id,
        'updated_at', v_current.updated_at
      ),
      'research', jsonb_build_object(
        'research_task_id', v_task.id,
        'state', v_task.state,
        'candidate_id', v_candidate.candidate_id,
        'canonical_evidence_digest', v_candidate.canonical_evidence_digest,
        'source_content_digest', v_observation.source_content_digest,
        'task_updated_at', v_task.updated_at
      )
    )
  );

  return jsonb_build_object(
    'transition_id', v_transition.transition_id,
    'bridge_id', v_bridge.bridge_id,
    'assignment_id', v_assignment.assignment_id,
    'research_task_id', v_task.id,
    'candidate_id', v_candidate.candidate_id,
    'current_fact_instance_id', v_current.fact_instance_id,
    'current_confirmation_id', v_current.confirmation_id,
    'current_proposition_key', v_transition.proposition_key,
    'candidate_proposition_key', v_candidate_proposition_key,
    'semantic_relation', v_semantic_relation,
    'prestate_digest', v_prestate_digest,
    'source_payload', v_source_payload,
    'binding_payload', v_binding_payload,
    'evidence_payload', v_evidence_payload
  );
end;

$function$;


-- Preserve the exact pre-existing execute ACL posture.
revoke all on function public.admin_prepare_product_fact_review_v1(uuid,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.admin_prepare_product_fact_review_v1(uuid,text,jsonb)
  to service_role;

revoke all on function public.product_fact_controlled_build_preflight_v1(uuid,text,jsonb)
  from public, anon, authenticated, service_role;

revoke all on function public.trust_phase4_build_adoption_plan_v1(uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.trust_phase4_build_adoption_plan_v1(uuid,uuid)
  to service_role;

revoke all on function public.trust_phase8e_build_revalidation_plan_legacy_v1(uuid,uuid,uuid)
  from public, anon, authenticated, service_role;

comment on table public.product_fact_registry_fact_write_policy_v1 is
  'DATA-AI29C-UVA-R3D per-fact Registry write authority. Registry publication does not imply controlled write authorization.';

comment on function public.product_fact_controlled_registry_write_admissibility_v2(text,text,text) is
  'Fail-closed registry/fact-key lineage admissibility for Product Fact controlled writes.';

comment on function public.admin_set_product_fact_registry_fact_write_policy_v1(uuid,text,jsonb) is
  'Admin-only audited mutation boundary for per-fact Registry write authority.';

commit;
