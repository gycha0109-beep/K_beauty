begin;

create table public.product_fact_revalidation_research_bridges (
  bridge_id uuid primary key default gen_random_uuid(),
  request_id text not null,
  transition_id uuid not null
    references public.product_fact_revalidation_transitions(transition_id) on delete restrict,
  assignment_id uuid not null
    references public.product_fact_review_assignments(assignment_id) on delete restrict,
  research_task_id uuid
    references public.product_fact_research_tasks(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  disposition text not null,
  blocker_code text,
  payload_digest text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  constraint product_fact_revalidation_research_bridges_request_unique unique (request_id),
  constraint product_fact_revalidation_research_bridges_transition_unique unique (transition_id),
  constraint product_fact_revalidation_research_bridges_request_check
    check (char_length(btrim(request_id)) between 8 and 120),
  constraint product_fact_revalidation_research_bridges_disposition_check
    check (disposition in ('RESEARCH_REQUEUED','BLOCKED')),
  constraint product_fact_revalidation_research_bridges_blocker_check
    check (
      (disposition = 'RESEARCH_REQUEUED' and research_task_id is not null and blocker_code is null)
      or
      (disposition = 'BLOCKED' and blocker_code in (
        'REVALIDATION_INTAKE_MISSING',
        'REVALIDATION_INTAKE_AMBIGUOUS',
        'REVALIDATION_INTAKE_STALE'
      ))
    ),
  constraint product_fact_revalidation_research_bridges_payload_digest_check
    check (payload_digest ~ '^[0-9a-f]{64}$'),
  constraint product_fact_revalidation_research_bridges_result_check
    check (jsonb_typeof(result) = 'object' and octet_length(result::text) <= 32768)
);

create index product_fact_revalidation_research_bridges_assignment_created_idx
  on public.product_fact_revalidation_research_bridges (assignment_id, created_at desc, bridge_id);
create index product_fact_revalidation_research_bridges_task_created_idx
  on public.product_fact_revalidation_research_bridges (research_task_id, created_at desc, bridge_id)
  where research_task_id is not null;
create index product_fact_revalidation_research_bridges_actor_created_idx
  on public.product_fact_revalidation_research_bridges (actor_user_id, created_at desc, bridge_id);

alter table public.product_fact_revalidation_research_bridges enable row level security;
revoke all on table public.product_fact_revalidation_research_bridges
  from public, anon, authenticated, service_role;
grant select on table public.product_fact_revalidation_research_bridges to service_role;

create or replace function public.admin_enqueue_product_fact_revalidation_research_v1(
  p_actor_user_id uuid,
  p_request_id text,
  p_transition_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role text;
  v_request_id text := btrim(coalesce(p_request_id, ''));
  v_payload jsonb;
  v_payload_digest text;
  v_existing public.product_fact_revalidation_research_bridges%rowtype;
  v_transition public.product_fact_revalidation_transitions%rowtype;
  v_assignment public.product_fact_review_assignments%rowtype;
  v_current public.product_fact_current%rowtype;
  v_task public.product_fact_research_tasks%rowtype;
  v_intake public.catalog_trust_intake%rowtype;
  v_task_count integer;
  v_intake_count integer;
  v_blocker_code text;
  v_audit_id uuid;
  v_result jsonb;
begin
  v_actor_role := public.admin_require_product_review_actor(
    p_actor_user_id,
    'admin.products.review'
  );

  if char_length(v_request_id) not between 8 and 120 or p_transition_id is null then
    raise exception 'product_fact_revalidation_research_request_invalid'
      using errcode = '22023';
  end if;

  v_payload := jsonb_build_object(
    'transition_id', p_transition_id,
    'actor_user_id', p_actor_user_id
  );
  v_payload_digest := public.product_fact_controlled_sha256_json_v1(v_payload);

  perform pg_advisory_xact_lock(
    hashtextextended('bejewely_product_fact_revalidation_research:' || p_transition_id::text, 0)
  );

  select *
    into v_existing
    from public.product_fact_revalidation_research_bridges
   where request_id = v_request_id
      or transition_id = p_transition_id
   order by case when request_id = v_request_id then 0 else 1 end
   limit 1;

  if found then
    if v_existing.transition_id <> p_transition_id
       or v_existing.actor_user_id <> p_actor_user_id
       or v_existing.payload_digest <> v_payload_digest then
      raise exception 'product_fact_revalidation_research_request_conflict'
        using errcode = '23505';
    end if;
    return v_existing.result || jsonb_build_object('idempotent', true);
  end if;

  select *
    into v_transition
    from public.product_fact_revalidation_transitions
   where transition_id = p_transition_id;

  if not found then
    raise exception 'product_fact_revalidation_research_transition_not_found'
      using errcode = 'P0002';
  end if;

  select *
    into v_assignment
    from public.product_fact_review_assignments
   where assignment_id = v_transition.assignment_id
   for update;

  if not found
     or v_assignment.operational_state <> 're_review_required'
     or v_assignment.subject_id is null
     or v_assignment.fact_key is null
     or v_assignment.registry_version is null
     or v_assignment.proposition_key is distinct from v_transition.proposition_key then
    raise exception 'product_fact_revalidation_research_assignment_stale'
      using errcode = '40001';
  end if;

  select *
    into v_current
    from public.product_fact_current
   where proposition_key = v_transition.proposition_key
   for update;

  if not found
     or v_current.fact_instance_id <> v_transition.fact_instance_id
     or v_current.confirmation_id <> v_transition.confirmation_id
     or v_current.subject_id is distinct from v_assignment.subject_id then
    raise exception 'product_fact_revalidation_research_current_stale'
      using errcode = '40001';
  end if;

  select count(*)::integer
    into v_task_count
    from public.product_fact_research_tasks t
   where t.subject_id = v_assignment.subject_id
     and t.fact_key = v_assignment.fact_key
     and t.registry_version = v_assignment.registry_version
     and t.research_policy_version = 'product-fact-required-policy-v1';

  if v_task_count > 1 then
    raise exception 'product_fact_revalidation_research_task_ambiguous'
      using errcode = '23514';
  end if;

  if v_task_count = 1 then
    select *
      into v_task
      from public.product_fact_research_tasks t
     where t.subject_id = v_assignment.subject_id
       and t.fact_key = v_assignment.fact_key
       and t.registry_version = v_assignment.registry_version
       and t.research_policy_version = 'product-fact-required-policy-v1'
     for update;

    if v_task.state = 'RESEARCHING' then
      raise exception 'product_fact_revalidation_research_task_busy'
        using errcode = '40001';
    end if;

    select *
      into v_intake
      from public.catalog_trust_intake
     where id = v_task.intake_id
       and product_id = v_assignment.product_id
       and subject_id = v_assignment.subject_id
       and identity_state = 'EXACT_SUBJECT_FOUND'
     for update;

    if not found then
      v_blocker_code := 'REVALIDATION_INTAKE_STALE';
    end if;
  else
    select count(*)::integer
      into v_intake_count
      from public.catalog_trust_intake i
     where i.product_id = v_assignment.product_id
       and i.subject_id = v_assignment.subject_id
       and i.identity_state = 'EXACT_SUBJECT_FOUND';

    if v_intake_count = 0 then
      v_blocker_code := 'REVALIDATION_INTAKE_MISSING';
    elsif v_intake_count > 1 then
      v_blocker_code := 'REVALIDATION_INTAKE_AMBIGUOUS';
    else
      select *
        into v_intake
        from public.catalog_trust_intake i
       where i.product_id = v_assignment.product_id
         and i.subject_id = v_assignment.subject_id
         and i.identity_state = 'EXACT_SUBJECT_FOUND'
       for update;

      insert into public.product_fact_research_tasks (
        intake_id,
        product_id,
        subject_id,
        fact_key,
        registry_version,
        research_policy_version,
        state,
        priority,
        blocker_code,
        blocker_detail,
        attempt_count,
        next_retry_at,
        created_at,
        updated_at,
        completed_at
      )
      values (
        v_intake.id,
        v_assignment.product_id,
        v_assignment.subject_id,
        v_assignment.fact_key,
        v_assignment.registry_version,
        'product-fact-required-policy-v1',
        'RESEARCH_PENDING',
        100,
        'REVALIDATION_REQUIRED',
        'Phase 8D revalidation research requested from transition ' || p_transition_id::text,
        0,
        now(),
        now(),
        now(),
        null
      )
      returning * into v_task;
    end if;
  end if;

  if v_blocker_code is not null then
    v_result := jsonb_build_object(
      'status', 'blocked',
      'actor_role', v_actor_role,
      'transition_id', p_transition_id,
      'assignment_id', v_assignment.assignment_id,
      'research_task_id', null,
      'disposition', 'BLOCKED',
      'blocker_code', v_blocker_code,
      'current_pointer_changed', false,
      'fact_instance_mutated', false,
      'automatic_confirmation', false,
      'idempotent', false
    );

    insert into public.product_fact_revalidation_research_bridges (
      request_id, transition_id, assignment_id, research_task_id,
      actor_user_id, disposition, blocker_code, payload_digest, result
    )
    values (
      v_request_id, p_transition_id, v_assignment.assignment_id, null,
      p_actor_user_id, 'BLOCKED', v_blocker_code, v_payload_digest, v_result
    );

    insert into public.product_fact_review_events (
      assignment_id, subject_id, fact_instance_id, confirmation_id,
      actor_user_id, event_kind, reason_code, event_payload, created_at
    )
    values (
      v_assignment.assignment_id, v_assignment.subject_id,
      v_transition.fact_instance_id, v_transition.confirmation_id,
      p_actor_user_id, 'revalidation_research_blocked',
      lower(v_blocker_code),
      jsonb_build_object(
        'request_id', v_request_id,
        'transition_id', p_transition_id,
        'blocker_code', v_blocker_code
      ),
      now()
    );

    return v_result;
  end if;

  update public.product_fact_research_tasks
     set state = 'RESEARCH_PENDING',
         blocker_code = 'REVALIDATION_REQUIRED',
         blocker_detail = 'Phase 8D revalidation research requested from transition ' || p_transition_id::text,
         next_retry_at = now(),
         completed_at = null,
         updated_at = now()
   where id = v_task.id
   returning * into v_task;

  update public.catalog_trust_intake
     set trust_state = 'RESEARCH_PENDING',
         completed_at = null,
         last_checked_at = now(),
         updated_at = now()
   where id = v_task.intake_id;

  v_audit_id := public.record_admin_audit_event(
    p_actor_user_id,
    'admin.products.review',
    'admin.product_fact.revalidation_research_requeued',
    'product_fact_research_task',
    v_task.id::text,
    null,
    jsonb_build_object(
      'state', 'RESEARCH_PENDING',
      'assignment_id', v_assignment.assignment_id,
      'transition_id', p_transition_id
    ),
    'requeue governed Product Fact research for revalidation',
    v_request_id,
    jsonb_build_object(
      'fact_key', v_assignment.fact_key,
      'registry_version', v_assignment.registry_version,
      'subject_id', v_assignment.subject_id,
      'current_fact_instance_id', v_transition.fact_instance_id
    )
  );

  v_result := jsonb_build_object(
    'status', 'research_requeued',
    'actor_role', v_actor_role,
    'transition_id', p_transition_id,
    'assignment_id', v_assignment.assignment_id,
    'research_task_id', v_task.id,
    'disposition', 'RESEARCH_REQUEUED',
    'blocker_code', null,
    'current_pointer_changed', false,
    'fact_instance_mutated', false,
    'automatic_confirmation', false,
    'audit_id', v_audit_id,
    'idempotent', false
  );

  insert into public.product_fact_revalidation_research_bridges (
    request_id, transition_id, assignment_id, research_task_id,
    actor_user_id, disposition, blocker_code, payload_digest, result
  )
  values (
    v_request_id, p_transition_id, v_assignment.assignment_id, v_task.id,
    p_actor_user_id, 'RESEARCH_REQUEUED', null, v_payload_digest, v_result
  );

  insert into public.product_fact_review_events (
    assignment_id, subject_id, fact_instance_id, confirmation_id,
    actor_user_id, event_kind, reason_code, event_payload, created_at
  )
  values (
    v_assignment.assignment_id, v_assignment.subject_id,
    v_transition.fact_instance_id, v_transition.confirmation_id,
    p_actor_user_id, 'revalidation_research_requeued',
    'revalidation_required',
    jsonb_build_object(
      'request_id', v_request_id,
      'transition_id', p_transition_id,
      'research_task_id', v_task.id
    ),
    now()
  );

  return v_result;
end;
$$;

revoke all on function public.admin_enqueue_product_fact_revalidation_research_v1(
  uuid, text, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.admin_enqueue_product_fact_revalidation_research_v1(
  uuid, text, uuid
) to service_role;

create or replace function public.claim_trust_research_tasks_v1(
  p_limit integer default 5,
  p_lease_seconds integer default 300
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if p_limit is null or p_limit < 1 or p_limit > 25 then
    raise exception 'trust_research_claim_limit_invalid';
  end if;
  if p_lease_seconds is null or p_lease_seconds < 30 or p_lease_seconds > 1800 then
    raise exception 'trust_research_lease_invalid';
  end if;

  update public.product_fact_research_tasks
  set state = 'RESEARCH_PENDING',
      next_retry_at = now(),
      blocker_code = 'WORKER_LEASE_EXPIRED',
      blocker_detail = 'Previous RESEARCHING lease expired before a result was recorded.',
      updated_at = now()
  where state = 'RESEARCHING'
    and last_research_at is not null
    and last_research_at < now() - make_interval(secs => p_lease_seconds);

  with eligible as (
    select rt.id
    from public.product_fact_research_tasks rt
    join public.catalog_trust_intake i on i.id = rt.intake_id
    join public.product_fact_subjects s on s.subject_id = rt.subject_id
    where rt.state = 'RESEARCH_PENDING'
      and rt.subject_id is not null
      and (rt.next_retry_at is null or rt.next_retry_at <= now())
      and i.identity_state = 'EXACT_SUBJECT_FOUND'
      and i.subject_id = rt.subject_id
      and s.product_id = rt.product_id
      and s.identity_status = 'resolved'
      and s.current_state = 'current'
      and s.market_applicability is not distinct from i.market
      and s.variant_key is null
    order by rt.priority desc, rt.created_at, rt.id
    for update of rt skip locked
    limit p_limit
  ), claimed as (
    update public.product_fact_research_tasks rt
    set state = 'RESEARCHING',
        attempt_count = rt.attempt_count + 1,
        next_retry_at = null,
        blocker_code = null,
        blocker_detail = null,
        last_research_at = now(),
        updated_at = now()
    from eligible e
    where rt.id = e.id
    returning rt.*
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'task_id', c.id,
      'product_id', c.product_id,
      'subject_id', c.subject_id,
      'fact_key', c.fact_key,
      'registry_version', c.registry_version,
      'research_policy_version', c.research_policy_version,
      'attempt_count', c.attempt_count,
      'official_source_seeds', coalesce((
        select jsonb_agg(jsonb_build_object(
          'source_binding_id', psb.binding_id,
          'source_name', psb.source_name,
          'external_type', psb.external_type,
          'binding_method', psb.binding_method,
          'product_scope_state', psb.product_scope_state,
          'canonical_locator', psb.source_url,
          'market', psb.market_code,
          'locale', psb.locale
        ) order by psb.created_at, psb.binding_id)
        from public.product_source_bindings psb
        join public.catalog_trust_intake i2 on i2.id = c.intake_id
        where psb.product_id = c.product_id
          and psb.binding_state = 'resolved'
          and psb.source_name ~ '_official$'
          and psb.source_url ~ '^https://'
          and psb.market_code is not distinct from i2.market
      ), '[]'::jsonb)
    )
    order by c.priority desc, c.created_at, c.id
  ), '[]'::jsonb)
  into v_result
  from claimed c;

  return v_result;
end;
$$;

revoke all on function public.claim_trust_research_tasks_v1(integer, integer)
  from public, anon, authenticated;
grant execute on function public.claim_trust_research_tasks_v1(integer, integer)
  to service_role;

create or replace function public.record_trust_research_result_v1(
  p_task_id uuid,
  p_result jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_task public.product_fact_research_tasks%rowtype;
  v_intake public.catalog_trust_intake%rowtype;
  v_subject public.product_fact_subjects%rowtype;
  v_binding public.product_source_bindings%rowtype;
  v_definition jsonb;
  v_outcome text;
  v_blocker text;
  v_detail text;
  v_retry_seconds integer;
  v_source jsonb;
  v_candidate jsonb;
  v_digest_basis text;
  v_page_digest text;
  v_observation_digest text;
  v_observation_id uuid;
  v_candidate_id uuid;
  v_evidence_digest text;
  v_evidence_class text;
  v_support_direction text;
  v_negative_admissibility text;
  v_confidence text;
  v_normalized_value jsonb;
  v_allowed_values jsonb;
  v_expected_type text;
  v_existing_current boolean;
begin
  if p_result is null or jsonb_typeof(p_result) <> 'object' then
    raise exception 'trust_research_result_invalid';
  end if;
  v_outcome := upper(coalesce(p_result ->> 'outcome',''));

  select * into v_task
  from public.product_fact_research_tasks
  where id = p_task_id
  for update;
  if not found then
    raise exception 'trust_research_task_not_found';
  end if;

  if v_task.state = 'EVIDENCE_CANDIDATE'
    and v_outcome = 'EVIDENCE_CANDIDATE'
    and v_task.evidence_candidate_id is not null
    and lower(coalesce(p_result #>> '{source,source_content_digest}','')) = coalesce(v_task.source_content_digest,'') then
    return jsonb_build_object(
      'task_id', p_task_id,
      'outcome', 'EVIDENCE_CANDIDATE',
      'source_observation_id', v_task.source_observation_id,
      'evidence_candidate_id', v_task.evidence_candidate_id,
      'idempotent_replay', true
    );
  end if;

  if v_task.state <> 'RESEARCHING' then
    raise exception 'trust_research_task_not_claimed:%', v_task.state;
  end if;

  select * into v_intake from public.catalog_trust_intake where id = v_task.intake_id;
  select * into v_subject from public.product_fact_subjects where subject_id = v_task.subject_id;

  if v_task.subject_id is null
    or v_intake.identity_state <> 'EXACT_SUBJECT_FOUND'
    or v_intake.subject_id is distinct from v_task.subject_id
    or v_subject.identity_status <> 'resolved'
    or v_subject.current_state <> 'current'
    or v_subject.product_id <> v_task.product_id
    or v_subject.market_applicability is distinct from v_intake.market then
    update public.product_fact_research_tasks
    set state = 'BLOCKED', blocker_code = 'IDENTITY_BLOCKED',
        blocker_detail = 'Phase 3 requires the exact resolved/current Subject selected by Phase 2.',
        last_research_at = now(), updated_at = now()
    where id = p_task_id;
    return jsonb_build_object('task_id',p_task_id,'outcome','IDENTITY_BLOCKED');
  end if;

  if v_subject.variant_key is not null then
    update public.product_fact_research_tasks
    set state = 'REVIEW_REQUIRED', blocker_code = 'VARIANT_CONFLICT',
        blocker_detail = 'Variant-scoped Subject requires separately governed presentation equivalence.',
        last_research_at = now(), updated_at = now()
    where id = p_task_id;
    return jsonb_build_object('task_id',p_task_id,'outcome','VARIANT_CONFLICT');
  end if;

  select definition into v_definition
  from public.product_fact_definition_snapshots
  where registry_version = v_task.registry_version
    and fact_key = v_task.fact_key
    and deprecated = false;
  if v_definition is null then
    update public.product_fact_research_tasks
    set state = 'BLOCKED', blocker_code = 'REGISTRY_GAP',
        blocker_detail = 'No active Registry definition exists for the task fact.',
        last_research_at = now(), updated_at = now()
    where id = p_task_id;
    return jsonb_build_object('task_id',p_task_id,'outcome','REGISTRY_GAP');
  end if;

  select exists (
    select 1
    from public.product_fact_current c
    where c.subject_id = v_task.subject_id
      and exists (
        select 1 from public.product_fact_instances fi
        where fi.fact_instance_id = c.fact_instance_id
          and fi.registry_version = v_task.registry_version
          and fi.fact_key = v_task.fact_key
      )
  ) into v_existing_current;
  if v_existing_current and not exists (
    select 1
    from public.product_fact_revalidation_research_bridges rb
    join public.product_fact_revalidation_transitions tr
      on tr.transition_id = rb.transition_id
    join public.product_fact_review_assignments ra
      on ra.assignment_id = rb.assignment_id
    where rb.research_task_id = v_task.id
      and rb.disposition = 'RESEARCH_REQUEUED'
      and tr.assignment_id = ra.assignment_id
      and tr.fact_instance_id = (
        select c.fact_instance_id
        from public.product_fact_current c
        join public.product_fact_instances fi
          on fi.fact_instance_id = c.fact_instance_id
        where c.subject_id = v_task.subject_id
          and fi.registry_version = v_task.registry_version
          and fi.fact_key = v_task.fact_key
        order by c.updated_at desc
        limit 1
      )
      and ra.operational_state = 're_review_required'
  ) then
    update public.product_fact_research_tasks
    set state = 'ALREADY_COVERED', blocker_code = null, blocker_detail = null,
        next_retry_at = null, last_research_at = now(), updated_at = now()
    where id = p_task_id;
    return jsonb_build_object('task_id',p_task_id,'outcome','ALREADY_COVERED');
  end if;

  v_detail := nullif(btrim(p_result ->> 'detail'),'');

  if v_outcome = 'TRANSIENT_FAILURE' then
    v_retry_seconds := greatest(60, least(3600, coalesce((p_result ->> 'retry_after_seconds')::integer, 300)));
    update public.product_fact_research_tasks
    set state = 'RESEARCH_PENDING', blocker_code = 'SOURCE_TRANSIENT_FAILURE',
        blocker_detail = coalesce(v_detail,'Transient official-source fetch failure.'),
        next_retry_at = now() + make_interval(secs => v_retry_seconds),
        last_research_at = now(), updated_at = now()
    where id = p_task_id;
    return jsonb_build_object('task_id',p_task_id,'outcome','TRANSIENT_FAILURE','retry_after_seconds',v_retry_seconds);
  end if;

  if v_outcome in ('EVIDENCE_INSUFFICIENT','SOURCE_BLOCKED','OUT_OF_SCOPE') then
    update public.product_fact_research_tasks
    set state = 'BLOCKED', blocker_code = v_outcome,
        blocker_detail = coalesce(v_detail, lower(v_outcome)),
        next_retry_at = null, last_research_at = now(), updated_at = now()
    where id = p_task_id;
    return jsonb_build_object('task_id',p_task_id,'outcome',v_outcome);
  end if;

  if v_outcome in ('REVIEW_REQUIRED','FORMULATION_CONFLICT','MARKET_CONFLICT') then
    v_blocker := case when v_outcome = 'REVIEW_REQUIRED'
      then coalesce(nullif(upper(p_result ->> 'blocker_code'),''),'REVIEW_REQUIRED')
      else v_outcome end;
    update public.product_fact_research_tasks
    set state = 'REVIEW_REQUIRED', blocker_code = v_blocker,
        blocker_detail = coalesce(v_detail, lower(v_blocker)),
        next_retry_at = null, last_research_at = now(), updated_at = now()
    where id = p_task_id;
    return jsonb_build_object('task_id',p_task_id,'outcome',v_outcome,'blocker_code',v_blocker);
  end if;

  if v_outcome <> 'EVIDENCE_CANDIDATE' then
    raise exception 'trust_research_outcome_not_supported:%', v_outcome;
  end if;

  v_source := p_result -> 'source';
  v_candidate := p_result -> 'candidate';
  if jsonb_typeof(v_source) <> 'object' or jsonb_typeof(v_candidate) <> 'object' then
    raise exception 'trust_research_candidate_payload_invalid';
  end if;

  select * into v_binding
  from public.product_source_bindings
  where binding_id = nullif(v_source ->> 'source_binding_id','')::uuid
    and product_id = v_task.product_id
    and binding_state = 'resolved'
    and source_name ~ '_official$'
    and source_url ~ '^https://'
    and market_code is not distinct from v_intake.market;
  if not found then
    update public.product_fact_research_tasks
    set state = 'BLOCKED', blocker_code = 'SOURCE_BLOCKED',
        blocker_detail = 'Evidence candidate source is not an exact-market resolved official source binding.',
        last_research_at = now(), updated_at = now()
    where id = p_task_id;
    return jsonb_build_object('task_id',p_task_id,'outcome','SOURCE_BLOCKED');
  end if;

  v_digest_basis := v_source ->> 'digest_basis';
  v_page_digest := lower(coalesce(v_source ->> 'source_content_digest',''));
  if v_digest_basis not in ('live-page-bytes-v1','frozen-first-party-observation-v1-not-live-page-bytes') then
    raise exception 'trust_research_digest_basis_invalid';
  end if;
  if v_page_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'trust_research_source_digest_invalid';
  end if;
  if nullif(btrim(v_source ->> 'source_kind'),'') is null
    or (v_source ->> 'source_kind') not in (
      'brand_official_product_page','brand_official_faq','brand_official_technical_document',
      'manufacturer_official_document','official_market_sales_page'
    ) then
    raise exception 'trust_research_source_kind_invalid';
  end if;
  if jsonb_typeof(v_source -> 'observed_claim') <> 'object'
    or jsonb_typeof(v_source -> 'product_identity_observation') <> 'object'
    or nullif(btrim(v_source ->> 'observation_version'),'') is null then
    raise exception 'trust_research_observation_invalid';
  end if;

  if v_digest_basis = 'frozen-first-party-observation-v1-not-live-page-bytes' then
    v_observation_digest := encode(extensions.digest(convert_to(jsonb_build_object(
      'source_binding_id', v_binding.binding_id,
      'canonical_locator', v_binding.source_url,
      'publisher', v_binding.source_name,
      'source_kind', v_source ->> 'source_kind',
      'market', v_binding.market_code,
      'locale', v_binding.locale,
      'observed_claim', v_source -> 'observed_claim',
      'product_identity_observation', v_source -> 'product_identity_observation',
      'observation_version', v_source ->> 'observation_version'
    )::text,'UTF8'),'sha256'),'hex');
    if v_page_digest <> v_observation_digest then
      raise exception 'trust_research_frozen_observation_digest_mismatch';
    end if;
  end if;

  v_evidence_class := v_candidate ->> 'evidence_class';
  if v_evidence_class is null
    or not (coalesce(v_definition -> 'permitted_evidence_classes','[]'::jsonb) ? v_evidence_class) then
    update public.product_fact_research_tasks
    set state = 'BLOCKED', blocker_code = 'OUT_OF_SCOPE',
        blocker_detail = 'Evidence class is not permitted by the active Registry definition.',
        last_research_at = now(), updated_at = now()
    where id = p_task_id;
    return jsonb_build_object('task_id',p_task_id,'outcome','OUT_OF_SCOPE');
  end if;

  v_normalized_value := v_candidate -> 'normalized_value';
  v_expected_type := v_definition ->> 'value_type';
  v_allowed_values := v_definition -> 'allowed_values';
  if v_normalized_value is null then
    raise exception 'trust_research_normalized_value_missing';
  end if;
  if v_expected_type = 'number' and jsonb_typeof(v_normalized_value) <> 'number' then
    raise exception 'trust_research_normalized_value_type_invalid:number';
  elsif v_expected_type = 'boolean' and jsonb_typeof(v_normalized_value) <> 'boolean' then
    raise exception 'trust_research_normalized_value_type_invalid:boolean';
  elsif v_expected_type in ('enum','entity_identifier') and jsonb_typeof(v_normalized_value) <> 'string' then
    raise exception 'trust_research_normalized_value_type_invalid:%', v_expected_type;
  elsif v_expected_type in ('number_unit','range_unit') and jsonb_typeof(v_normalized_value) <> 'object' then
    raise exception 'trust_research_normalized_value_type_invalid:%', v_expected_type;
  end if;
  if v_expected_type = 'enum'
    and jsonb_typeof(v_allowed_values) = 'array'
    and not (v_allowed_values ? trim(both '"' from v_normalized_value::text)) then
    raise exception 'trust_research_enum_value_invalid';
  end if;

  v_support_direction := coalesce(v_candidate ->> 'support_direction','supports');
  v_negative_admissibility := coalesce(v_candidate ->> 'negative_admissibility','not_applicable');
  if v_support_direction not in ('supports','opposes') then
    raise exception 'trust_research_support_direction_invalid';
  end if;
  if v_support_direction = 'opposes'
    and v_negative_admissibility not in ('explicit_negative','conflict_opposition') then
    raise exception 'trust_research_negative_semantics_invalid';
  end if;
  if v_support_direction = 'supports' and v_negative_admissibility <> 'not_applicable' then
    raise exception 'trust_research_positive_negative_semantics_invalid';
  end if;

  v_confidence := coalesce(v_candidate ->> 'confidence','high');
  if v_confidence not in ('high','medium','low') then
    raise exception 'trust_research_confidence_invalid';
  end if;

  insert into public.trust_source_observations (
    research_task_id, product_id, subject_id, source_binding_id,
    canonical_locator, publisher, source_kind, market, region, locale,
    observed_claim, product_identity_observation, observation_version,
    digest_basis, source_content_digest, observed_at, fetched_at
  ) values (
    v_task.id, v_task.product_id, v_task.subject_id, v_binding.binding_id,
    v_binding.source_url, v_binding.source_name, v_source ->> 'source_kind',
    v_binding.market_code, nullif(v_source ->> 'region',''), v_binding.locale,
    v_source -> 'observed_claim', v_source -> 'product_identity_observation',
    v_source ->> 'observation_version', v_digest_basis, v_page_digest,
    coalesce(nullif(v_source ->> 'observed_at','')::timestamptz, now()),
    nullif(v_source ->> 'fetched_at','')::timestamptz
  )
  on conflict (research_task_id, canonical_locator, observation_version, source_content_digest)
  do nothing
  returning observation_id into v_observation_id;

  if v_observation_id is null then
    select observation_id into v_observation_id
    from public.trust_source_observations
    where research_task_id = v_task.id
      and canonical_locator = v_binding.source_url
      and observation_version = v_source ->> 'observation_version'
      and source_content_digest = v_page_digest;
  end if;

  v_evidence_digest := encode(extensions.digest(convert_to(jsonb_build_object(
    'subject_id', v_task.subject_id,
    'registry_version', v_task.registry_version,
    'fact_key', v_task.fact_key,
    'normalized_value', v_normalized_value,
    'evidence_class', v_evidence_class,
    'support_direction', v_support_direction,
    'negative_admissibility', v_negative_admissibility,
    'market', v_intake.market,
    'region', nullif(v_candidate ->> 'region',''),
    'locale', v_binding.locale,
    'qualifier', coalesce(v_candidate -> 'qualifier','{}'::jsonb),
    'source_content_digest', v_page_digest
  )::text,'UTF8'),'sha256'),'hex');

  insert into public.trust_evidence_candidates (
    research_task_id, observation_id, product_id, subject_id,
    registry_version, fact_key, normalized_value, evidence_class,
    evidence_authority, confidence, support_direction, negative_admissibility,
    market, region, locale, qualifier, candidate_state, canonical_evidence_digest
  ) values (
    v_task.id, v_observation_id, v_task.product_id, v_task.subject_id,
    v_task.registry_version, v_task.fact_key, v_normalized_value, v_evidence_class,
    'product_specific_primary', v_confidence, v_support_direction, v_negative_admissibility,
    v_intake.market, nullif(v_candidate ->> 'region',''), v_binding.locale,
    coalesce(v_candidate -> 'qualifier','{}'::jsonb), 'READY', v_evidence_digest
  )
  on conflict (canonical_evidence_digest)
  do nothing
  returning candidate_id into v_candidate_id;

  if v_candidate_id is null then
    select candidate_id into v_candidate_id
    from public.trust_evidence_candidates
    where canonical_evidence_digest = v_evidence_digest;
  end if;

  update public.product_fact_research_tasks
  set state = 'EVIDENCE_CANDIDATE',
      source_locator = v_binding.source_url,
      source_content_digest = v_page_digest,
      source_observation_id = v_observation_id,
      evidence_candidate_id = v_candidate_id,
      blocker_code = null,
      blocker_detail = null,
      next_retry_at = null,
      last_research_at = now(),
      updated_at = now()
  where id = p_task_id;

  return jsonb_build_object(
    'task_id', p_task_id,
    'outcome', 'EVIDENCE_CANDIDATE',
    'source_observation_id', v_observation_id,
    'evidence_candidate_id', v_candidate_id,
    'canonical_evidence_digest', v_evidence_digest
  );
end;
$$;

revoke all on function public.record_trust_research_result_v1(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_trust_research_result_v1(uuid, jsonb)
  to service_role;

comment on table public.product_fact_revalidation_research_bridges is
  'Phase 8D immutable bridge from a governed revalidation transition to existing Phase 3 research. Missing/ambiguous legacy intake fails closed rather than fabricating catalog provenance.';

comment on function public.admin_enqueue_product_fact_revalidation_research_v1(
  uuid, text, uuid
) is
  'Explicit Admin Phase 8D revalidation research bridge. Requeues or creates only an operational Phase 3 task backed by exact existing intake provenance; never changes Product Fact semantic authority.';

comment on function public.record_trust_research_result_v1(uuid, jsonb) is
  'TRUST Phase 3 result boundary with Phase 8D revalidation exception: an explicitly bridged re_review_required assignment may research despite an existing Current Fact. Historical Fact and Current authority remain unchanged.';

commit;
