alter table public.product_fact_revalidation_transitions
  add column relocation_id uuid
    references public.trust_official_source_relocations(relocation_id) on delete restrict;

drop index if exists public.product_fact_revalidation_transitions_relocation_created_idx;
create index product_fact_revalidation_transitions_relocation_created_idx
  on public.product_fact_revalidation_transitions (relocation_id, created_at desc, transition_id)
  where relocation_id is not null;

alter table public.product_fact_revalidation_transitions
  drop constraint product_fact_revalidation_transitions_result_kind_check,
  drop constraint product_fact_revalidation_transitions_reason_code_check;

alter table public.product_fact_revalidation_transitions
  add constraint product_fact_revalidation_transitions_result_kind_check
    check (verification_result in ('unchanged', 'changed', 'unavailable', 'ambiguous')),
  add constraint product_fact_revalidation_transitions_reason_code_check
    check (reason_code in (
      'source_content_changed',
      'source_unavailable',
      'source_verification_ambiguous',
      'source_relocated'
    )),
  add constraint product_fact_revalidation_transitions_relocation_lineage_check
    check (
      (
        reason_code = 'source_relocated'
        and verification_result = 'unchanged'
        and relocation_id is not null
      )
      or
      (
        reason_code <> 'source_relocated'
        and verification_result <> 'unchanged'
        and relocation_id is null
      )
    );

create or replace function public.admin_preflight_official_source_relocation_revalidation_v1(
  p_actor_user_id uuid,
  p_relocation_id uuid,
  p_verification_id uuid,
  p_assignment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role text;
  v_relocation public.trust_official_source_relocations%rowtype;
  v_verification public.product_evidence_source_verifications%rowtype;
  v_profile public.product_evidence_source_verification_profiles%rowtype;
  v_assignment public.product_fact_review_assignments%rowtype;
  v_current public.product_fact_current%rowtype;
  v_fact public.product_fact_instances%rowtype;
  v_old_binding public.product_source_bindings%rowtype;
  v_replacement_binding public.product_source_bindings%rowtype;
  v_replacement_review public.trust_official_source_binding_reviews%rowtype;
  v_prestate jsonb;
  v_prestate_digest text;
  v_transition_payload jsonb;
begin
  v_actor_role := public.admin_require_product_review_actor(
    p_actor_user_id,
    'admin.products.review'
  );

  if p_relocation_id is null or p_verification_id is null or p_assignment_id is null then
    raise exception 'official_source_relocation_revalidation_identity_required'
      using errcode = '22023';
  end if;

  select *
    into v_relocation
    from public.trust_official_source_relocations
   where relocation_id = p_relocation_id;

  if not found or v_relocation.result <> 'confirmed' then
    raise exception 'official_source_relocation_revalidation_relocation_not_confirmed'
      using errcode = '55000';
  end if;

  select *
    into v_old_binding
    from public.product_source_bindings
   where binding_id = v_relocation.old_binding_id;

  select *
    into v_replacement_binding
    from public.product_source_bindings
   where binding_id = v_relocation.replacement_binding_id;

  select *
    into v_replacement_review
    from public.trust_official_source_binding_reviews
   where review_id = v_relocation.replacement_review_id;

  if v_old_binding.binding_id is null
     or v_old_binding.product_id <> v_relocation.product_id
     or v_old_binding.binding_state <> 'retired'
     or v_replacement_binding.binding_id is null
     or v_replacement_binding.product_id <> v_relocation.product_id
     or v_replacement_binding.binding_state <> 'resolved'
     or v_replacement_binding.source_url is distinct from v_relocation.replacement_locator
     or v_replacement_review.review_id is null
     or v_replacement_review.binding_id <> v_relocation.replacement_binding_id
     or v_replacement_review.product_id <> v_relocation.product_id
     or v_replacement_review.subject_id <> v_relocation.subject_id
     or v_replacement_review.scope_relation <> 'equivalent' then
    raise exception 'official_source_relocation_revalidation_relocation_lineage_stale'
      using errcode = '40001';
  end if;

  select *
    into v_verification
    from public.product_evidence_source_verifications
   where verification_id = p_verification_id;

  if not found
     or v_verification.source_id <> v_relocation.historical_source_id
     or v_verification.verification_result <> 'unchanged'
     or v_verification.verification_profile_id is null then
    raise exception 'official_source_relocation_revalidation_verification_invalid'
      using errcode = '23514';
  end if;

  select *
    into v_profile
    from public.product_evidence_source_verification_profiles
   where profile_id = v_verification.verification_profile_id;

  if not found
     or v_profile.source_id <> v_relocation.historical_source_id
     or v_profile.comparability_state <> 'COMPARABLE'
     or v_profile.baseline_kind <> 'fresh_recovery'
     or v_profile.digest_basis <> 'canonical-official-product-semantics-v1'
     or v_profile.adapter_key <> 'official-product-semantic'
     or v_profile.adapter_version <> 'v1'
     or v_profile.baseline_content_digest <> v_verification.baseline_content_digest
     or v_profile.digest_basis <> v_verification.observation_digest_basis
     or v_profile.adapter_version <> v_verification.adapter_version
     or v_profile.profile_digest <> v_verification.verification_profile_digest
     or coalesce(v_profile.canonical_baseline ->> 'final_url', '') <> v_relocation.replacement_locator
     or coalesce(v_verification.verification_metadata ->> 'final_url', '') <> v_relocation.replacement_locator
     or exists (
       select 1
         from public.product_evidence_source_verification_profiles child
        where child.supersedes_profile_id = v_profile.profile_id
     ) then
    raise exception 'official_source_relocation_revalidation_profile_not_comparable'
      using errcode = '23514';
  end if;

  select *
    into v_assignment
    from public.product_fact_review_assignments
   where assignment_id = p_assignment_id;

  if not found
     or v_assignment.operational_state <> 'confirmed'
     or v_assignment.product_id <> v_relocation.product_id
     or v_assignment.subject_id <> v_relocation.subject_id
     or v_assignment.proposition_key is null
     or v_assignment.fact_key is null
     or v_assignment.registry_version is null then
    raise exception 'official_source_relocation_revalidation_assignment_not_confirmed'
      using errcode = '40001';
  end if;

  select *
    into v_current
    from public.product_fact_current
   where proposition_key = v_assignment.proposition_key;

  if not found
     or v_current.subject_id <> v_assignment.subject_id then
    raise exception 'official_source_relocation_revalidation_current_stale'
      using errcode = '40001';
  end if;

  select *
    into v_fact
    from public.product_fact_instances
   where fact_instance_id = v_current.fact_instance_id;

  if not found
     or v_fact.proposition_key <> v_assignment.proposition_key
     or v_fact.subject_id <> v_assignment.subject_id
     or v_fact.registry_version <> v_assignment.registry_version
     or v_fact.fact_key <> v_assignment.fact_key then
    raise exception 'official_source_relocation_revalidation_fact_stale'
      using errcode = '40001';
  end if;

  if not exists (
    select 1
      from public.product_fact_evidence_links l
      join public.product_evidence_records e
        on e.evidence_id = l.evidence_id
     where l.fact_instance_id = v_current.fact_instance_id
       and e.source_id = v_relocation.historical_source_id
  ) then
    raise exception 'official_source_relocation_revalidation_historical_source_not_linked'
      using errcode = '23514';
  end if;

  v_prestate := jsonb_build_object(
    'relocation_id', v_relocation.relocation_id,
    'relocation_plan_digest', v_relocation.relocation_plan_digest,
    'historical_source_id', v_relocation.historical_source_id,
    'replacement_binding_id', v_relocation.replacement_binding_id,
    'replacement_review_id', v_relocation.replacement_review_id,
    'replacement_locator', v_relocation.replacement_locator,
    'verification_id', v_verification.verification_id,
    'verification_payload_digest', v_verification.payload_digest,
    'verification_profile_id', v_profile.profile_id,
    'verification_profile_digest', v_profile.profile_digest,
    'assignment_id', v_assignment.assignment_id,
    'assignment_state', v_assignment.operational_state,
    'assignment_updated_at', v_assignment.updated_at,
    'subject_id', v_assignment.subject_id,
    'proposition_key', v_assignment.proposition_key,
    'fact_key', v_assignment.fact_key,
    'registry_version', v_assignment.registry_version,
    'fact_instance_id', v_current.fact_instance_id,
    'confirmation_id', v_current.confirmation_id,
    'current_updated_at', v_current.updated_at
  );

  v_prestate_digest := public.product_fact_controlled_sha256_json_v1(v_prestate);

  v_transition_payload := jsonb_build_object(
    'relocation_id', v_relocation.relocation_id,
    'source_id', v_relocation.historical_source_id,
    'verification_id', v_verification.verification_id,
    'assignment_id', v_assignment.assignment_id,
    'proposition_key', v_assignment.proposition_key,
    'fact_instance_id', v_current.fact_instance_id,
    'confirmation_id', v_current.confirmation_id,
    'prestate_digest', v_prestate_digest,
    'reason_code', 'source_relocated'
  );

  return jsonb_build_object(
    'status', 'ready_for_relocation_revalidation_transition',
    'actor_role', v_actor_role,
    'transition_payload', v_transition_payload,
    'prestate_digest', v_prestate_digest,
    'reason_code', 'source_relocated',
    'current_pointer_changed', false,
    'fact_instance_mutated', false,
    'automatic_confirmation', false
  );
end;
$$;

revoke all on function public.admin_preflight_official_source_relocation_revalidation_v1(
  uuid, uuid, uuid, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.admin_preflight_official_source_relocation_revalidation_v1(
  uuid, uuid, uuid, uuid
) to service_role;

create or replace function public.admin_mark_official_source_relocation_revalidation_v1(
  p_actor_user_id uuid,
  p_request_id text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role text;
  v_request_id text := btrim(coalesce(p_request_id, ''));
  v_payload_digest text;
  v_existing public.product_fact_revalidation_transitions%rowtype;
  v_relocation_id uuid;
  v_verification_id uuid;
  v_assignment_id uuid;
  v_preflight jsonb;
  v_expected_payload jsonb;
  v_proposition_key text;
  v_fact_instance_id uuid;
  v_confirmation_id uuid;
  v_source_id uuid;
  v_prestate_digest text;
  v_assignment public.product_fact_review_assignments%rowtype;
  v_result jsonb;
  v_transition_id uuid;
  v_audit_id uuid;
begin
  v_actor_role := public.admin_require_product_review_actor(
    p_actor_user_id,
    'admin.products.review'
  );

  if char_length(v_request_id) not between 8 and 120
     or p_payload is null
     or not public.product_fact_controlled_json_exact_keys_v1(
       p_payload,
       array[
         'relocation_id',
         'source_id',
         'verification_id',
         'assignment_id',
         'proposition_key',
         'fact_instance_id',
         'confirmation_id',
         'prestate_digest',
         'reason_code'
       ]
     ) then
    raise exception 'official_source_relocation_revalidation_request_invalid'
      using errcode = '22023';
  end if;

  begin
    v_relocation_id := (p_payload ->> 'relocation_id')::uuid;
    v_source_id := (p_payload ->> 'source_id')::uuid;
    v_verification_id := (p_payload ->> 'verification_id')::uuid;
    v_assignment_id := (p_payload ->> 'assignment_id')::uuid;
    v_fact_instance_id := (p_payload ->> 'fact_instance_id')::uuid;
    v_confirmation_id := (p_payload ->> 'confirmation_id')::uuid;
  exception when invalid_text_representation then
    raise exception 'official_source_relocation_revalidation_request_invalid'
      using errcode = '22023';
  end;

  v_proposition_key := lower(btrim(coalesce(p_payload ->> 'proposition_key', '')));
  v_prestate_digest := lower(btrim(coalesce(p_payload ->> 'prestate_digest', '')));

  if v_proposition_key !~ '^[0-9a-f]{64}$'
     or v_prestate_digest !~ '^[0-9a-f]{64}$'
     or p_payload ->> 'reason_code' <> 'source_relocated' then
    raise exception 'official_source_relocation_revalidation_payload_invalid'
      using errcode = '22023';
  end if;

  v_payload_digest := public.product_fact_controlled_sha256_json_v1(p_payload);

  perform pg_advisory_xact_lock(
    hashtextextended('bejewely_official_source_relocation_revalidation_request:' || v_request_id, 0)
  );

  select *
    into v_existing
    from public.product_fact_revalidation_transitions
   where request_id = v_request_id;

  if found then
    if v_existing.actor_user_id <> p_actor_user_id
       or v_existing.payload_digest <> v_payload_digest
       or v_existing.relocation_id <> v_relocation_id then
      raise exception 'official_source_relocation_revalidation_request_conflict'
        using errcode = '23505';
    end if;
    return v_existing.result || jsonb_build_object('idempotent', true);
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('bejewely_product_fact_proposition:' || v_proposition_key, 0)
  );

  v_preflight := public.admin_preflight_official_source_relocation_revalidation_v1(
    p_actor_user_id,
    v_relocation_id,
    v_verification_id,
    v_assignment_id
  );
  v_expected_payload := v_preflight -> 'transition_payload';

  if v_preflight ->> 'status' <> 'ready_for_relocation_revalidation_transition'
     or v_expected_payload is distinct from p_payload then
    raise exception 'official_source_relocation_revalidation_prestate_stale'
      using errcode = '40001';
  end if;

  select *
    into v_assignment
    from public.product_fact_review_assignments
   where assignment_id = v_assignment_id
   for update;

  if not found
     or v_assignment.operational_state <> 'confirmed'
     or v_assignment.proposition_key <> v_proposition_key then
    raise exception 'official_source_relocation_revalidation_assignment_stale'
      using errcode = '40001';
  end if;

  update public.product_fact_review_assignments
     set operational_state = 'stale',
         updated_at = now()
   where assignment_id = v_assignment_id
     and operational_state = 'confirmed';

  if not found then
    raise exception 'official_source_relocation_revalidation_stale_transition_failed'
      using errcode = '40001';
  end if;

  insert into public.product_fact_review_events (
    assignment_id, subject_id, fact_instance_id, confirmation_id,
    actor_user_id, event_kind, reason_code, event_payload, created_at
  ) values (
    v_assignment_id, v_assignment.subject_id, v_fact_instance_id, v_confirmation_id,
    p_actor_user_id, 'revalidation_stale', 'source_relocated',
    jsonb_build_object(
      'request_id', v_request_id,
      'relocation_id', v_relocation_id,
      'verification_id', v_verification_id,
      'source_id', v_source_id,
      'from_state', 'confirmed',
      'to_state', 'stale'
    ),
    now()
  );

  update public.product_fact_review_assignments
     set operational_state = 're_review_required',
         updated_at = now()
   where assignment_id = v_assignment_id
     and operational_state = 'stale';

  if not found then
    raise exception 'official_source_relocation_revalidation_re_review_transition_failed'
      using errcode = '40001';
  end if;

  insert into public.product_fact_review_events (
    assignment_id, subject_id, fact_instance_id, confirmation_id,
    actor_user_id, event_kind, reason_code, event_payload, created_at
  ) values (
    v_assignment_id, v_assignment.subject_id, v_fact_instance_id, v_confirmation_id,
    p_actor_user_id, 'revalidation_required', 'source_relocated',
    jsonb_build_object(
      'request_id', v_request_id,
      'relocation_id', v_relocation_id,
      'verification_id', v_verification_id,
      'source_id', v_source_id,
      'from_state', 'stale',
      'to_state', 're_review_required'
    ),
    now()
  );

  v_result := jsonb_build_object(
    'status', 're_review_required',
    'actor_role', v_actor_role,
    'request_id', v_request_id,
    'relocation_id', v_relocation_id,
    'verification_id', v_verification_id,
    'source_id', v_source_id,
    'verification_result', 'unchanged',
    'reason_code', 'source_relocated',
    'assignment_id', v_assignment_id,
    'proposition_key', v_proposition_key,
    'fact_instance_id', v_fact_instance_id,
    'confirmation_id', v_confirmation_id,
    'current_pointer_changed', false,
    'fact_instance_mutated', false,
    'automatic_confirmation', false,
    'idempotent', false
  );

  insert into public.product_fact_revalidation_transitions (
    request_id, verification_id, assignment_id, proposition_key,
    fact_instance_id, confirmation_id, actor_user_id, verification_result,
    from_state, to_state, payload_digest, result, source_id,
    prestate_digest, reason_code, relocation_id
  ) values (
    v_request_id, v_verification_id, v_assignment_id, v_proposition_key,
    v_fact_instance_id, v_confirmation_id, p_actor_user_id, 'unchanged',
    'confirmed', 're_review_required', v_payload_digest, v_result, v_source_id,
    v_prestate_digest, 'source_relocated', v_relocation_id
  )
  returning transition_id into v_transition_id;

  v_result := v_result || jsonb_build_object('transition_id', v_transition_id);

  update public.product_fact_revalidation_transitions
     set result = v_result
   where transition_id = v_transition_id;

  v_audit_id := public.record_admin_audit_event(
    p_actor_user_id,
    'admin.products.review',
    'admin.product_fact.revalidation_required',
    'product_fact_review_assignment',
    v_assignment_id::text,
    jsonb_build_object(
      'operational_state', 'confirmed',
      'fact_instance_id', v_fact_instance_id,
      'confirmation_id', v_confirmation_id
    ),
    jsonb_build_object(
      'operational_state', 're_review_required',
      'fact_instance_id', v_fact_instance_id,
      'confirmation_id', v_confirmation_id
    ),
    'mark Product Fact for governed revalidation after confirmed official-source relocation',
    v_request_id,
    jsonb_build_object(
      'relocation_id', v_relocation_id,
      'verification_id', v_verification_id,
      'source_id', v_source_id,
      'reason_code', 'source_relocated',
      'proposition_key', v_proposition_key
    )
  );

  return v_result || jsonb_build_object('audit_id', v_audit_id);
end;
$$;

revoke all on function public.admin_mark_official_source_relocation_revalidation_v1(
  uuid, text, jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.admin_mark_official_source_relocation_revalidation_v1(
  uuid, text, jsonb
) to service_role;

create or replace function public.claim_trust_research_tasks_v1(
  p_limit integer default 5,
  p_lease_seconds integer default 300
)
returns jsonb
language plpgsql
security definer
set search_path = ''
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
           and (
             not exists (
               select 1
                 from public.product_fact_revalidation_research_bridges rb0
                 join public.product_fact_revalidation_transitions rt0
                   on rt0.transition_id = rb0.transition_id
                where rb0.research_task_id = c.id
                  and rb0.disposition = 'RESEARCH_REQUEUED'
                  and rt0.reason_code = 'source_relocated'
             )
             or psb.binding_id = (
               select r0.replacement_binding_id
                 from public.product_fact_revalidation_research_bridges rb0
                 join public.product_fact_revalidation_transitions rt0
                   on rt0.transition_id = rb0.transition_id
                 join public.trust_official_source_relocations r0
                   on r0.relocation_id = rt0.relocation_id
                where rb0.research_task_id = c.id
                  and rb0.disposition = 'RESEARCH_REQUEUED'
                  and rt0.reason_code = 'source_relocated'
                limit 1
             )
           )
      ), '[]'::jsonb),
      'current_fact_context', (
        select jsonb_build_object(
          'transition_id', rt0.transition_id,
          'relocation_id', rt0.relocation_id,
          'fact_instance_id', cf.fact_instance_id,
          'proposition_key', cf.proposition_key,
          'fact_key', cf.fact_key,
          'value_type', cf.value_type,
          'value_boolean', cf.value_boolean,
          'value_enum', cf.value_enum,
          'value_number', cf.value_number,
          'value_unit', cf.value_unit,
          'value_range_min', cf.value_range_min,
          'value_range_max', cf.value_range_max,
          'value_entity_identifier', cf.value_entity_identifier,
          'parent_fact_instance_id', cf.parent_fact_instance_id,
          'parent_proposition_key', cf.parent_proposition_key
        )
          from public.product_fact_revalidation_research_bridges rb0
          join public.product_fact_revalidation_transitions rt0
            on rt0.transition_id = rb0.transition_id
          join public.product_fact_instances cf
            on cf.fact_instance_id = rt0.fact_instance_id
         where rb0.research_task_id = c.id
           and rb0.disposition = 'RESEARCH_REQUEUED'
         limit 1
      ),
      'parent_propositions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'fact_instance_id', pf.fact_instance_id,
          'proposition_key', pf.proposition_key,
          'value_entity_identifier', pf.value_entity_identifier
        ))
          from public.product_fact_revalidation_research_bridges rb0
          join public.product_fact_revalidation_transitions rt0
            on rt0.transition_id = rb0.transition_id
          join public.product_fact_instances cf
            on cf.fact_instance_id = rt0.fact_instance_id
          join public.product_fact_instances pf
            on pf.fact_instance_id = cf.parent_fact_instance_id
         where rb0.research_task_id = c.id
           and rb0.disposition = 'RESEARCH_REQUEUED'
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

CREATE OR REPLACE FUNCTION public.trust_phase8e_build_revalidation_plan_legacy_v1(p_actor_user_id uuid, p_transition_id uuid, p_candidate_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
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

  if public.product_fact_controlled_latest_registry_v1()
      is distinct from v_candidate.registry_version then
    raise exception 'product_fact_revalidation_resolution_registry_stale'
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
$function$


revoke all on function public.trust_phase8e_build_revalidation_plan_legacy_v1(
  uuid, uuid, uuid
) from public, anon, authenticated, service_role;

create or replace function public.trust_phase8e_build_revalidation_plan_v1(
  p_actor_user_id uuid,
  p_transition_id uuid,
  p_candidate_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan jsonb;
  v_candidate public.trust_evidence_candidates%rowtype;
  v_current_fact public.product_fact_instances%rowtype;
  v_definition public.product_fact_definition_snapshots%rowtype;
  v_parent_required boolean;
  v_current_value jsonb;
  v_candidate_value jsonb;
  v_relation text;
  v_evidence_payload jsonb;
  v_prestate_digest text;
begin
  perform public.admin_require_product_review_actor(
    p_actor_user_id,
    'admin.products.review'
  );

  v_plan := public.trust_phase8e_build_revalidation_plan_legacy_v1(
    p_actor_user_id,
    p_transition_id,
    p_candidate_id
  );

  select *
    into v_candidate
    from public.trust_evidence_candidates
   where candidate_id = p_candidate_id;

  select *
    into v_current_fact
    from public.product_fact_instances
   where fact_instance_id = (v_plan ->> 'current_fact_instance_id')::uuid;

  select *
    into v_definition
    from public.product_fact_definition_snapshots
   where registry_version = v_candidate.registry_version
     and fact_key = v_candidate.fact_key
     and deprecated = false;

  if not found then
    raise exception 'product_fact_revalidation_resolution_definition_missing'
      using errcode = '55000';
  end if;

  v_parent_required := coalesce(
    (v_definition.definition #>> '{relationship_schema,subject_ref_required}')::boolean,
    false
  );

  if not v_parent_required then
    return v_plan;
  end if;

  if v_candidate.fact_key <> 'active_concentration'
     or v_definition.value_type <> 'number_unit' then
    raise exception 'product_fact_revalidation_relationship_comparator_unsupported'
      using errcode = '55000';
  end if;

  if v_current_fact.parent_fact_instance_id is null
     or v_current_fact.parent_proposition_key is null
     or v_candidate.parent_proposition_key is null
     or v_candidate.parent_proposition_key <> v_current_fact.parent_proposition_key then
    raise exception 'product_fact_revalidation_parent_proposition_mismatch'
      using errcode = '55000';
  end if;

  if v_candidate.market is distinct from v_current_fact.market
     or v_candidate.region is distinct from v_current_fact.region
     or v_candidate.locale is distinct from v_current_fact.locale
     or v_candidate.qualifier is distinct from v_current_fact.qualifier
     or v_current_fact.valid_from is not null
     or v_current_fact.valid_to is not null then
    raise exception 'product_fact_revalidation_relationship_scope_mismatch'
      using errcode = '55000';
  end if;

  if jsonb_typeof(v_candidate.normalized_value) <> 'object'
     or not (v_candidate.normalized_value ?& array['amount','unit'])
     or (select count(*) from jsonb_object_keys(v_candidate.normalized_value)) <> 2
     or jsonb_typeof(v_candidate.normalized_value -> 'amount') <> 'number'
     or jsonb_typeof(v_candidate.normalized_value -> 'unit') <> 'string' then
    raise exception 'product_fact_revalidation_relationship_value_invalid'
      using errcode = '22023';
  end if;

  v_current_value := jsonb_build_object(
    'amount', v_current_fact.value_number,
    'unit', v_current_fact.value_unit
  );
  v_candidate_value := v_candidate.normalized_value;

  v_relation := case
    when v_candidate_value = v_current_value then 'SAME_SEMANTIC'
    else 'SEMANTIC_CHANGE'
  end;

  v_evidence_payload := v_plan -> 'evidence_payload';
  v_evidence_payload := jsonb_set(
    v_evidence_payload,
    '{proposition_key}',
    to_jsonb(v_plan ->> 'current_proposition_key'),
    false
  );
  v_evidence_payload := jsonb_set(
    v_evidence_payload,
    '{proposition_value_identity}',
    'null'::jsonb,
    false
  );
  v_evidence_payload := jsonb_set(
    v_evidence_payload,
    '{parent_proposition_key}',
    to_jsonb(v_current_fact.parent_proposition_key),
    false
  );

  v_prestate_digest := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object(
      'legacy_prestate_digest', v_plan ->> 'prestate_digest',
      'comparison_contract', 'relationship-aware-value-v1',
      'current_proposition_key', v_plan ->> 'current_proposition_key',
      'current_parent_proposition_key', v_current_fact.parent_proposition_key,
      'current_parent_fact_instance_id', v_current_fact.parent_fact_instance_id,
      'current_value', v_current_value,
      'candidate_value', v_candidate_value
    )
  );

  return v_plan || jsonb_build_object(
    'candidate_proposition_key', v_plan ->> 'current_proposition_key',
    'semantic_relation', v_relation,
    'prestate_digest', v_prestate_digest,
    'evidence_payload', v_evidence_payload,
    'semantic_comparison_contract', 'relationship-aware-value-v1',
    'current_parent_fact_instance_id', v_current_fact.parent_fact_instance_id,
    'current_parent_proposition_key', v_current_fact.parent_proposition_key,
    'candidate_parent_proposition_key', v_candidate.parent_proposition_key,
    'current_typed_value', v_current_value,
    'candidate_typed_value', v_candidate_value
  );
end;
$$;

CREATE OR REPLACE FUNCTION public.trust_phase8f_build_replacement_fact_payload_legacy_v1(p_actor_user_id uuid, p_transition_id uuid, p_candidate_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_plan jsonb;
  v_candidate public.trust_evidence_candidates%rowtype;
  v_definition public.product_fact_definition_snapshots%rowtype;
  v_value_type text;
  v_allowed_values jsonb;
  v_allowed_units jsonb;
  v_value_boolean boolean;
  v_value_enum text;
  v_value_number numeric;
  v_value_unit text;
  v_value_range_min numeric;
  v_value_range_max numeric;
  v_value_entity_identifier text;
  v_fusion_policy constant text := 'trust-phase8f-revalidation-replacement-v1';
  v_fusion_input_digest text;
  v_fact_payload_base jsonb;
begin
  v_plan := public.trust_phase8e_build_revalidation_plan_v1(
    p_actor_user_id,
    p_transition_id,
    p_candidate_id
  );

  if v_plan ->> 'semantic_relation' <> 'SEMANTIC_CHANGE' then
    raise exception 'product_fact_revalidation_replacement_not_semantic_change'
      using errcode = '55000';
  end if;

  select * into v_candidate
  from public.trust_evidence_candidates
  where candidate_id = p_candidate_id;

  if not found then
    raise exception 'product_fact_revalidation_replacement_candidate_missing'
      using errcode = 'P0002';
  end if;

  select * into v_definition
  from public.product_fact_definition_snapshots
  where registry_version = v_candidate.registry_version
    and fact_key = v_candidate.fact_key
    and deprecated = false;

  if not found then
    raise exception 'product_fact_revalidation_replacement_definition_missing'
      using errcode = '55000';
  end if;

  if coalesce((v_definition.definition #>> '{relationship_schema,subject_ref_required}')::boolean, false) then
    raise exception 'product_fact_revalidation_replacement_parent_proposition_required'
      using errcode = '55000';
  end if;

  v_value_type := v_definition.value_type;
  v_allowed_values := v_definition.definition -> 'allowed_values';
  v_allowed_units := v_definition.definition #> '{unit_schema,allowed_units}';

  if v_value_type = 'boolean' then
    if jsonb_typeof(v_candidate.normalized_value) <> 'boolean' then
      raise exception 'product_fact_revalidation_replacement_value_invalid:boolean'
        using errcode = '22023';
    end if;
    v_value_boolean := (v_candidate.normalized_value #>> '{}')::boolean;
  elsif v_value_type = 'enum' then
    if jsonb_typeof(v_candidate.normalized_value) <> 'string' then
      raise exception 'product_fact_revalidation_replacement_value_invalid:enum'
        using errcode = '22023';
    end if;
    v_value_enum := v_candidate.normalized_value #>> '{}';
    if jsonb_typeof(v_allowed_values) = 'array' and not (v_allowed_values ? v_value_enum) then
      raise exception 'product_fact_revalidation_replacement_enum_invalid'
        using errcode = '22023';
    end if;
  elsif v_value_type = 'number' then
    if jsonb_typeof(v_candidate.normalized_value) <> 'number' then
      raise exception 'product_fact_revalidation_replacement_value_invalid:number'
        using errcode = '22023';
    end if;
    v_value_number := (v_candidate.normalized_value #>> '{}')::numeric;
  elsif v_value_type = 'entity_identifier' then
    if jsonb_typeof(v_candidate.normalized_value) <> 'string'
      or nullif(btrim(v_candidate.normalized_value #>> '{}'), '') is null then
      raise exception 'product_fact_revalidation_replacement_value_invalid:entity_identifier'
        using errcode = '22023';
    end if;
    v_value_entity_identifier := v_candidate.normalized_value #>> '{}';
  elsif v_value_type = 'number_unit' then
    if jsonb_typeof(v_candidate.normalized_value) <> 'object'
      or not (v_candidate.normalized_value ?& array['amount','unit'])
      or (select count(*) from jsonb_object_keys(v_candidate.normalized_value)) <> 2
      or jsonb_typeof(v_candidate.normalized_value -> 'amount') <> 'number'
      or jsonb_typeof(v_candidate.normalized_value -> 'unit') <> 'string' then
      raise exception 'product_fact_revalidation_replacement_value_invalid:number_unit'
        using errcode = '22023';
    end if;
    v_value_number := (v_candidate.normalized_value ->> 'amount')::numeric;
    v_value_unit := v_candidate.normalized_value ->> 'unit';
    if jsonb_typeof(v_allowed_units) = 'array' and not (v_allowed_units ? v_value_unit) then
      raise exception 'product_fact_revalidation_replacement_unit_invalid'
        using errcode = '22023';
    end if;
  elsif v_value_type = 'range_unit' then
    if jsonb_typeof(v_candidate.normalized_value) <> 'object'
      or not (v_candidate.normalized_value ?& array['min','max','unit'])
      or (select count(*) from jsonb_object_keys(v_candidate.normalized_value)) <> 3
      or jsonb_typeof(v_candidate.normalized_value -> 'min') <> 'number'
      or jsonb_typeof(v_candidate.normalized_value -> 'max') <> 'number'
      or jsonb_typeof(v_candidate.normalized_value -> 'unit') <> 'string' then
      raise exception 'product_fact_revalidation_replacement_value_invalid:range_unit'
        using errcode = '22023';
    end if;
    v_value_range_min := (v_candidate.normalized_value ->> 'min')::numeric;
    v_value_range_max := (v_candidate.normalized_value ->> 'max')::numeric;
    v_value_unit := v_candidate.normalized_value ->> 'unit';
    if v_value_range_min > v_value_range_max then
      raise exception 'product_fact_revalidation_replacement_range_invalid'
        using errcode = '22023';
    end if;
    if jsonb_typeof(v_allowed_units) = 'array' and not (v_allowed_units ? v_value_unit) then
      raise exception 'product_fact_revalidation_replacement_unit_invalid'
        using errcode = '22023';
    end if;
  else
    raise exception 'product_fact_revalidation_replacement_value_type_unsupported:%', v_value_type
      using errcode = '55000';
  end if;

  v_fusion_input_digest := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object(
      'fusion_policy_version', v_fusion_policy,
      'proposition_key', v_plan ->> 'candidate_proposition_key',
      'supporting_evidence_digests',
        jsonb_build_array(v_candidate.canonical_evidence_digest),
      'opposing_evidence_digests', '[]'::jsonb
    )
  );

  v_fact_payload_base := jsonb_build_object(
    'subject_id', v_candidate.subject_id,
    'registry_version', v_candidate.registry_version,
    'fact_key', v_candidate.fact_key,
    'proposition_key', v_plan ->> 'candidate_proposition_key',
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
    'parent_fact_instance_id', null,
    'parent_proposition_key', null,
    'authority_ceiling', 'product_specific_primary',
    'fused_confidence', v_candidate.confidence,
    'fusion_policy_version', v_fusion_policy,
    'fusion_input_digest', v_fusion_input_digest
  );

  return v_plan || jsonb_build_object(
    'subject_id', v_candidate.subject_id,
    'fact_payload_base', v_fact_payload_base,
    'fusion_policy_version', v_fusion_policy,
    'fusion_input_digest', v_fusion_input_digest
  );
end;
$function$


revoke all on function public.trust_phase8f_build_replacement_fact_payload_legacy_v1(
  uuid, uuid, uuid
) from public, anon, authenticated, service_role;

create or replace function public.trust_phase8f_build_replacement_fact_payload_v1(
  p_actor_user_id uuid,
  p_transition_id uuid,
  p_candidate_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan jsonb;
  v_candidate public.trust_evidence_candidates%rowtype;
  v_definition public.product_fact_definition_snapshots%rowtype;
  v_value_number numeric;
  v_value_unit text;
  v_allowed_units jsonb;
  v_fusion_policy constant text := 'trust-phase8f-revalidation-replacement-v1';
  v_fusion_input_digest text;
  v_fact_payload_base jsonb;
begin
  v_plan := public.trust_phase8e_build_revalidation_plan_v1(
    p_actor_user_id,
    p_transition_id,
    p_candidate_id
  );

  if v_plan ->> 'semantic_relation' <> 'SEMANTIC_CHANGE' then
    raise exception 'product_fact_revalidation_replacement_not_semantic_change'
      using errcode = '55000';
  end if;

  select *
    into v_candidate
    from public.trust_evidence_candidates
   where candidate_id = p_candidate_id;

  select *
    into v_definition
    from public.product_fact_definition_snapshots
   where registry_version = v_candidate.registry_version
     and fact_key = v_candidate.fact_key
     and deprecated = false;

  if not coalesce(
    (v_definition.definition #>> '{relationship_schema,subject_ref_required}')::boolean,
    false
  ) then
    return public.trust_phase8f_build_replacement_fact_payload_legacy_v1(
      p_actor_user_id,
      p_transition_id,
      p_candidate_id
    );
  end if;

  if v_candidate.fact_key <> 'active_concentration'
     or v_definition.value_type <> 'number_unit'
     or v_plan ->> 'candidate_proposition_key' <> v_plan ->> 'current_proposition_key'
     or v_plan ->> 'candidate_parent_proposition_key' <> v_plan ->> 'current_parent_proposition_key' then
    raise exception 'product_fact_revalidation_replacement_relationship_unsupported'
      using errcode = '55000';
  end if;

  if jsonb_typeof(v_candidate.normalized_value) <> 'object'
     or not (v_candidate.normalized_value ?& array['amount','unit'])
     or (select count(*) from jsonb_object_keys(v_candidate.normalized_value)) <> 2
     or jsonb_typeof(v_candidate.normalized_value -> 'amount') <> 'number'
     or jsonb_typeof(v_candidate.normalized_value -> 'unit') <> 'string' then
    raise exception 'product_fact_revalidation_replacement_value_invalid:number_unit'
      using errcode = '22023';
  end if;

  v_value_number := (v_candidate.normalized_value ->> 'amount')::numeric;
  v_value_unit := v_candidate.normalized_value ->> 'unit';
  v_allowed_units := v_definition.definition #> '{unit_schema,allowed_units}';

  if jsonb_typeof(v_allowed_units) = 'array' and not (v_allowed_units ? v_value_unit) then
    raise exception 'product_fact_revalidation_replacement_unit_invalid'
      using errcode = '22023';
  end if;

  v_fusion_input_digest := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object(
      'fusion_policy_version', v_fusion_policy,
      'proposition_key', v_plan ->> 'candidate_proposition_key',
      'parent_proposition_key', v_plan ->> 'candidate_parent_proposition_key',
      'supporting_evidence_digests',
        jsonb_build_array(v_candidate.canonical_evidence_digest),
      'opposing_evidence_digests', '[]'::jsonb
    )
  );

  v_fact_payload_base := jsonb_build_object(
    'subject_id', v_candidate.subject_id,
    'registry_version', v_candidate.registry_version,
    'fact_key', v_candidate.fact_key,
    'proposition_key', v_plan ->> 'candidate_proposition_key',
    'proposition_serializer_version', 'product-fact-proposition-pilot-v1',
    'semantic_status', 'supported',
    'value_type', 'number_unit',
    'value_boolean', null,
    'value_enum', null,
    'value_number', v_value_number,
    'value_unit', v_value_unit,
    'value_range_min', null,
    'value_range_max', null,
    'value_entity_identifier', null,
    'market', v_candidate.market,
    'region', v_candidate.region,
    'locale', v_candidate.locale,
    'valid_from', null,
    'valid_to', null,
    'qualifier', v_candidate.qualifier,
    'parent_fact_instance_id', (v_plan ->> 'current_parent_fact_instance_id')::uuid,
    'parent_proposition_key', v_plan ->> 'current_parent_proposition_key',
    'authority_ceiling', 'product_specific_primary',
    'fused_confidence', v_candidate.confidence,
    'fusion_policy_version', v_fusion_policy,
    'fusion_input_digest', v_fusion_input_digest
  );

  return v_plan || jsonb_build_object(
    'subject_id', v_candidate.subject_id,
    'fact_payload_base', v_fact_payload_base,
    'fusion_policy_version', v_fusion_policy,
    'fusion_input_digest', v_fusion_input_digest,
    'replacement_mode', 'same_proposition_value'
  );
end;
$$;

CREATE OR REPLACE FUNCTION public.admin_prepare_product_fact_revalidation_replacement_legacy_v1(p_actor_user_id uuid, p_request_id text, p_transition_id uuid, p_candidate_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_request_id text := btrim(coalesce(p_request_id, ''));
  v_plan jsonb;
  v_ingest jsonb;
  v_evidence_id uuid;
  v_evidence public.product_evidence_records%rowtype;
  v_is_explicit_negative boolean;
  v_fusion_input_digest text;
  v_assignment public.product_fact_review_assignments%rowtype;
  v_assignment_count bigint;
  v_review jsonb;
  v_confirmation_payload jsonb;
  v_confirmation_request_id text;
  v_preflight jsonb;
  v_replacement_prestate_digest text;
begin
  if char_length(v_request_id) not between 8 and 80 then
    raise exception 'product_fact_revalidation_replacement_request_invalid'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('bejewely_product_fact_revalidation_replacement:' || p_transition_id::text, 0)
  );

  v_plan := public.trust_phase8f_build_replacement_fact_payload_v1(
    p_actor_user_id,
    p_transition_id,
    p_candidate_id
  );

  v_ingest := public.admin_ingest_product_fact_evidence_v1(
    p_actor_user_id,
    v_request_id || ':ingest',
    jsonb_build_object(
      'source', v_plan -> 'source_payload',
      'binding', v_plan -> 'binding_payload',
      'evidence', v_plan -> 'evidence_payload'
    )
  );

  if v_ingest ->> 'status' <> 'evidence_recorded' then
    raise exception 'product_fact_revalidation_replacement_evidence_not_recorded'
      using errcode = '55000';
  end if;

  v_evidence_id := nullif(v_ingest ->> 'evidence_id', '')::uuid;
  if v_evidence_id is null then
    raise exception 'product_fact_revalidation_replacement_evidence_id_missing'
      using errcode = '55000';
  end if;

  select * into v_evidence
  from public.product_evidence_records
  where evidence_id = v_evidence_id;

  if not found
    or v_evidence.subject_id is distinct from (v_plan ->> 'subject_id')::uuid
    or v_evidence.proposition_key is distinct from v_plan ->> 'candidate_proposition_key'
    or v_evidence.canonical_evidence_digest is distinct from (
      select canonical_evidence_digest
      from public.trust_evidence_candidates
      where candidate_id = p_candidate_id
    ) then
    raise exception 'product_fact_revalidation_replacement_evidence_mismatch'
      using errcode = '55000';
  end if;

  v_is_explicit_negative :=
    v_evidence.support_direction = 'opposes'
    and v_evidence.negative_admissibility = 'explicit_negative';

  if not v_is_explicit_negative
    and not (
      v_evidence.support_direction = 'supports'
      and v_evidence.negative_admissibility = 'not_applicable'
    ) then
    raise exception 'product_fact_revalidation_replacement_evidence_role_invalid'
      using errcode = '55000';
  end if;

  select count(*) into v_assignment_count
  from public.product_fact_review_assignments a
  where a.product_id = (
      select product_id from public.trust_evidence_candidates where candidate_id = p_candidate_id
    )
    and a.subject_id = (v_plan ->> 'subject_id')::uuid
    and a.registry_version = (
      select registry_version from public.trust_evidence_candidates where candidate_id = p_candidate_id
    )
    and a.fact_key = (
      select fact_key from public.trust_evidence_candidates where candidate_id = p_candidate_id
    )
    and a.proposition_key = v_plan ->> 'candidate_proposition_key'
    and a.operational_state not in ('confirmed','superseded');

  if v_assignment_count > 1 then
    raise exception 'product_fact_revalidation_replacement_duplicate_assignments'
      using errcode = '55000';
  end if;

  if v_assignment_count = 1 then
    select * into v_assignment
    from public.product_fact_review_assignments a
    where a.product_id = (
        select product_id from public.trust_evidence_candidates where candidate_id = p_candidate_id
      )
      and a.subject_id = (v_plan ->> 'subject_id')::uuid
      and a.registry_version = (
        select registry_version from public.trust_evidence_candidates where candidate_id = p_candidate_id
      )
      and a.fact_key = (
        select fact_key from public.trust_evidence_candidates where candidate_id = p_candidate_id
      )
      and a.proposition_key = v_plan ->> 'candidate_proposition_key'
      and a.operational_state not in ('confirmed','superseded')
    order by a.created_at desc, a.assignment_id desc
    limit 1
    for update;

    if v_assignment.review_policy_version <> 'trust-phase8f-revalidation-replacement-v1'
      or v_assignment.assigned_to is distinct from p_actor_user_id
      or v_assignment.operational_state not in ('under_review','ready_for_confirm') then
      raise exception 'product_fact_revalidation_replacement_assignment_not_reusable'
        using errcode = '55000';
    end if;
  else
    v_review := public.admin_prepare_product_fact_review_v1(
      p_actor_user_id,
      v_request_id || ':review:under',
      jsonb_build_object(
        'product_id', (
          select product_id from public.trust_evidence_candidates where candidate_id = p_candidate_id
        ),
        'subject_id', v_plan ->> 'subject_id',
        'registry_version', (
          select registry_version from public.trust_evidence_candidates where candidate_id = p_candidate_id
        ),
        'fact_key', (
          select fact_key from public.trust_evidence_candidates where candidate_id = p_candidate_id
        ),
        'proposition_key', v_plan ->> 'candidate_proposition_key',
        'operational_state', 'under_review',
        'assigned_to', p_actor_user_id,
        'review_policy_version', 'trust-phase8f-revalidation-replacement-v1',
        'reason_code', 'revalidation_semantic_change'
      )
    );

    if v_review ->> 'status' <> 'prepared' then
      raise exception 'product_fact_revalidation_replacement_review_prepare_failed'
        using errcode = '55000';
    end if;

    select * into v_assignment
    from public.product_fact_review_assignments
    where assignment_id = (v_review ->> 'assignment_id')::uuid
    for update;
  end if;

  if v_assignment.operational_state = 'under_review' then
    v_review := public.admin_prepare_product_fact_review_v1(
      p_actor_user_id,
      v_request_id || ':review:ready',
      jsonb_build_object(
        'product_id', v_assignment.product_id,
        'subject_id', v_assignment.subject_id,
        'registry_version', v_assignment.registry_version,
        'fact_key', v_assignment.fact_key,
        'proposition_key', v_assignment.proposition_key,
        'operational_state', 'ready_for_confirm',
        'assigned_to', p_actor_user_id,
        'review_policy_version', v_assignment.review_policy_version,
        'reason_code', 'revalidation_semantic_change_ready'
      )
    );

    if v_review ->> 'status' <> 'prepared'
      or v_review ->> 'operational_state' <> 'ready_for_confirm' then
      raise exception 'product_fact_revalidation_replacement_ready_failed'
        using errcode = '55000';
    end if;

    select * into v_assignment
    from public.product_fact_review_assignments
    where assignment_id = (v_review ->> 'assignment_id')::uuid
    for update;
  end if;

  if v_assignment.operational_state <> 'ready_for_confirm' then
    raise exception 'product_fact_revalidation_replacement_assignment_not_ready'
      using errcode = '55000';
  end if;

  if v_is_explicit_negative and (
    v_plan #>> '{fact_payload_base,value_type}' <> 'boolean'
    or coalesce((v_plan #>> '{fact_payload_base,value_boolean}')::boolean, true) <> false
  ) then
    raise exception 'product_fact_revalidation_replacement_explicit_negative_requires_false_boolean'
      using errcode = '55000';
  end if;

  v_fusion_input_digest := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object(
      'registry_version', v_evidence.registry_version,
      'subject_id', v_evidence.subject_id,
      'fact_key', v_evidence.fact_key,
      'proposition_key', v_evidence.proposition_key,
      'fusion_policy_version', v_plan ->> 'fusion_policy_version',
      'evidence', jsonb_build_array(
        jsonb_build_object(
          'evidence_id', v_evidence.evidence_id,
          'role', case when v_is_explicit_negative then 'opposing' else 'supporting' end,
          'canonical_evidence_digest', v_evidence.canonical_evidence_digest,
          'evidence_authority', v_evidence.evidence_authority,
          'confidence', v_evidence.confidence,
          'support_direction', v_evidence.support_direction,
          'negative_admissibility', v_evidence.negative_admissibility
        )
      )
    )
  );

  v_confirmation_payload := (v_plan -> 'fact_payload_base') || jsonb_build_object(
    'assignment_id', v_assignment.assignment_id,
    'fusion_policy_version', v_plan ->> 'fusion_policy_version',
    'fusion_input_digest', v_fusion_input_digest,
    'supporting_evidence_ids',
      case when v_is_explicit_negative then '[]'::jsonb else jsonb_build_array(v_evidence_id) end,
    'opposing_evidence_ids',
      case when v_is_explicit_negative then jsonb_build_array(v_evidence_id) else '[]'::jsonb end
  );

  v_confirmation_request_id := v_request_id || ':confirm';
  v_preflight := public.admin_preflight_product_fact_confirmation_v1(
    p_actor_user_id,
    v_confirmation_request_id,
    v_confirmation_payload
  );

  if v_preflight ->> 'status' <> 'ready'
    or v_preflight -> 'previous_current' <> 'null'::jsonb then
    raise exception 'product_fact_revalidation_replacement_confirmation_preflight_invalid'
      using errcode = '55000';
  end if;

  v_replacement_prestate_digest := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object(
      'revalidation_prestate_digest', v_plan ->> 'prestate_digest',
      'confirmation_prestate_digest', v_preflight ->> 'prestate_digest',
      'old_proposition_key', v_plan ->> 'current_proposition_key',
      'old_fact_instance_id', v_plan ->> 'current_fact_instance_id',
      'old_confirmation_id', v_plan ->> 'current_confirmation_id',
      'old_assignment_id', v_plan ->> 'assignment_id',
      'new_proposition_key', v_plan ->> 'candidate_proposition_key',
      'new_assignment_id', v_assignment.assignment_id,
      'candidate_id', p_candidate_id,
      'evidence_id', v_evidence_id
    )
  );

  return jsonb_build_object(
    'status', 'ready_for_explicit_replacement_confirmation',
    'transition_id', p_transition_id,
    'candidate_id', p_candidate_id,
    'evidence_id', v_evidence_id,
    'old_assignment_id', v_plan ->> 'assignment_id',
    'old_proposition_key', v_plan ->> 'current_proposition_key',
    'old_fact_instance_id', v_plan ->> 'current_fact_instance_id',
    'old_confirmation_id', v_plan ->> 'current_confirmation_id',
    'new_assignment_id', v_assignment.assignment_id,
    'new_proposition_key', v_plan ->> 'candidate_proposition_key',
    'confirmation_request_id', v_confirmation_request_id,
    'confirmation_payload', v_confirmation_payload,
    'confirmation_payload_digest', v_preflight ->> 'payload_digest',
    'confirmation_prestate_digest', v_preflight ->> 'prestate_digest',
    'replacement_prestate_digest', v_replacement_prestate_digest,
    'automatic_confirmation', false
  );
end;
$function$


revoke all on function public.admin_prepare_product_fact_revalidation_replacement_legacy_v1(
  uuid, text, uuid, uuid
) from public, anon, authenticated, service_role;

create or replace function public.admin_prepare_product_fact_revalidation_replacement_v1(
  p_actor_user_id uuid,
  p_request_id text,
  p_transition_id uuid,
  p_candidate_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role text;
  v_request_id text := btrim(coalesce(p_request_id, ''));
  v_plan jsonb;
  v_ingest jsonb;
  v_evidence_id uuid;
  v_evidence public.product_evidence_records%rowtype;
  v_candidate public.trust_evidence_candidates%rowtype;
  v_old_assignment public.product_fact_review_assignments%rowtype;
  v_new_assignment public.product_fact_review_assignments%rowtype;
  v_assignment_count integer;
  v_fusion_input_digest text;
  v_confirmation_payload jsonb;
  v_confirmation_request_id text;
  v_preflight jsonb;
  v_replacement_prestate_digest text;
  v_audit_id uuid;
begin
  v_actor_role := public.admin_require_product_review_actor(
    p_actor_user_id,
    'admin.products.review'
  );

  if char_length(v_request_id) not between 8 and 80 then
    raise exception 'product_fact_revalidation_replacement_request_invalid'
      using errcode = '22023';
  end if;

  v_plan := public.trust_phase8f_build_replacement_fact_payload_v1(
    p_actor_user_id,
    p_transition_id,
    p_candidate_id
  );

  if coalesce(v_plan ->> 'replacement_mode', '') <> 'same_proposition_value' then
    return public.admin_prepare_product_fact_revalidation_replacement_legacy_v1(
      p_actor_user_id,
      p_request_id,
      p_transition_id,
      p_candidate_id
    );
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('bejewely_product_fact_revalidation_replacement:' || p_transition_id::text, 0)
  );

  select *
    into v_candidate
    from public.trust_evidence_candidates
   where candidate_id = p_candidate_id;

  select *
    into v_old_assignment
    from public.product_fact_review_assignments
   where assignment_id = (v_plan ->> 'assignment_id')::uuid
   for update;

  if not found
     or v_old_assignment.operational_state <> 're_review_required'
     or v_old_assignment.proposition_key <> v_plan ->> 'current_proposition_key' then
    raise exception 'product_fact_revalidation_replacement_old_assignment_stale'
      using errcode = '40001';
  end if;

  v_ingest := public.admin_ingest_product_fact_evidence_v1(
    p_actor_user_id,
    v_request_id || ':ingest',
    jsonb_build_object(
      'source', v_plan -> 'source_payload',
      'binding', v_plan -> 'binding_payload',
      'evidence', v_plan -> 'evidence_payload'
    )
  );

  if v_ingest ->> 'status' <> 'evidence_recorded' then
    raise exception 'product_fact_revalidation_replacement_evidence_not_recorded'
      using errcode = '55000';
  end if;

  v_evidence_id := nullif(v_ingest ->> 'evidence_id', '')::uuid;
  select *
    into v_evidence
    from public.product_evidence_records
   where evidence_id = v_evidence_id;

  if not found
     or v_evidence.subject_id <> v_candidate.subject_id
     or v_evidence.proposition_key <> v_plan ->> 'candidate_proposition_key'
     or v_evidence.parent_proposition_key <> v_plan ->> 'candidate_parent_proposition_key'
     or v_evidence.canonical_evidence_digest <> v_candidate.canonical_evidence_digest
     or v_evidence.support_direction <> 'supports'
     or v_evidence.negative_admissibility <> 'not_applicable' then
    raise exception 'product_fact_revalidation_replacement_evidence_mismatch'
      using errcode = '55000';
  end if;

  select count(*)::integer
    into v_assignment_count
    from public.product_fact_review_assignments a
   where a.product_id = v_candidate.product_id
     and a.subject_id = v_candidate.subject_id
     and a.registry_version = v_candidate.registry_version
     and a.fact_key = v_candidate.fact_key
     and a.proposition_key = v_plan ->> 'candidate_proposition_key'
     and a.assignment_id <> v_old_assignment.assignment_id
     and a.review_policy_version = 'trust-phase8f-revalidation-replacement-v1'
     and a.operational_state not in ('confirmed','superseded');

  if v_assignment_count > 1 then
    raise exception 'product_fact_revalidation_replacement_duplicate_assignments'
      using errcode = '55000';
  elsif v_assignment_count = 1 then
    select *
      into v_new_assignment
      from public.product_fact_review_assignments a
     where a.product_id = v_candidate.product_id
       and a.subject_id = v_candidate.subject_id
       and a.registry_version = v_candidate.registry_version
       and a.fact_key = v_candidate.fact_key
       and a.proposition_key = v_plan ->> 'candidate_proposition_key'
       and a.assignment_id <> v_old_assignment.assignment_id
       and a.review_policy_version = 'trust-phase8f-revalidation-replacement-v1'
       and a.operational_state not in ('confirmed','superseded')
     order by a.created_at desc, a.assignment_id desc
     limit 1
     for update;
  else
    insert into public.product_fact_review_assignments (
      product_id, subject_id, registry_version, fact_key, proposition_key,
      operational_state, assigned_to, review_policy_version, created_at, updated_at
    ) values (
      v_candidate.product_id, v_candidate.subject_id, v_candidate.registry_version,
      v_candidate.fact_key, v_plan ->> 'candidate_proposition_key',
      'under_review', p_actor_user_id,
      'trust-phase8f-revalidation-replacement-v1', now(), now()
    )
    returning * into v_new_assignment;

    insert into public.product_fact_review_events (
      assignment_id, subject_id, actor_user_id, event_kind, reason_code,
      event_payload, created_at
    ) values (
      v_new_assignment.assignment_id, v_new_assignment.subject_id, p_actor_user_id,
      'review_assignment_prepared', 'revalidation_semantic_change_under_review',
      jsonb_build_object(
        'request_id', v_request_id,
        'transition_id', p_transition_id,
        'old_assignment_id', v_old_assignment.assignment_id,
        'replacement_mode', 'same_proposition_value'
      ),
      now()
    );
  end if;

  if v_new_assignment.assigned_to is distinct from p_actor_user_id
     or v_new_assignment.operational_state not in ('under_review','ready_for_confirm') then
    raise exception 'product_fact_revalidation_replacement_assignment_not_reusable'
      using errcode = '55000';
  end if;

  if v_new_assignment.operational_state = 'under_review' then
    update public.product_fact_review_assignments
       set operational_state = 'ready_for_confirm',
           updated_at = now()
     where assignment_id = v_new_assignment.assignment_id
       and operational_state = 'under_review'
    returning * into v_new_assignment;

    if not found then
      raise exception 'product_fact_revalidation_replacement_ready_failed'
        using errcode = '40001';
    end if;

    insert into public.product_fact_review_events (
      assignment_id, subject_id, actor_user_id, event_kind, reason_code,
      event_payload, created_at
    ) values (
      v_new_assignment.assignment_id, v_new_assignment.subject_id, p_actor_user_id,
      'review_assignment_transitioned', 'revalidation_semantic_change_ready',
      jsonb_build_object(
        'request_id', v_request_id,
        'transition_id', p_transition_id,
        'from_state', 'under_review',
        'to_state', 'ready_for_confirm',
        'replacement_mode', 'same_proposition_value'
      ),
      now()
    );
  end if;

  v_fusion_input_digest := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object(
      'registry_version', v_evidence.registry_version,
      'subject_id', v_evidence.subject_id,
      'fact_key', v_evidence.fact_key,
      'proposition_key', v_evidence.proposition_key,
      'fusion_policy_version', v_plan ->> 'fusion_policy_version',
      'evidence', jsonb_build_array(
        jsonb_build_object(
          'evidence_id', v_evidence.evidence_id,
          'role', 'supporting',
          'canonical_evidence_digest', v_evidence.canonical_evidence_digest,
          'evidence_authority', v_evidence.evidence_authority,
          'confidence', v_evidence.confidence,
          'support_direction', v_evidence.support_direction,
          'negative_admissibility', v_evidence.negative_admissibility
        )
      )
    )
  );

  v_confirmation_payload := (v_plan -> 'fact_payload_base') || jsonb_build_object(
    'assignment_id', v_new_assignment.assignment_id,
    'fusion_policy_version', v_plan ->> 'fusion_policy_version',
    'fusion_input_digest', v_fusion_input_digest,
    'supporting_evidence_ids', jsonb_build_array(v_evidence_id),
    'opposing_evidence_ids', '[]'::jsonb
  );

  v_confirmation_request_id := v_request_id || ':confirm';
  v_preflight := public.admin_preflight_product_fact_confirmation_v1(
    p_actor_user_id,
    v_confirmation_request_id,
    v_confirmation_payload
  );

  if v_preflight ->> 'status' <> 'ready'
     or v_preflight #>> '{previous_current,fact_instance_id}' <> v_plan ->> 'current_fact_instance_id'
     or v_preflight #>> '{previous_current,confirmation_id}' <> v_plan ->> 'current_confirmation_id'
     or v_preflight #>> '{previous_current,proposition_key}' <> v_plan ->> 'current_proposition_key' then
    raise exception 'product_fact_revalidation_replacement_confirmation_preflight_invalid'
      using errcode = '55000';
  end if;

  v_replacement_prestate_digest := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object(
      'revalidation_prestate_digest', v_plan ->> 'prestate_digest',
      'confirmation_prestate_digest', v_preflight ->> 'prestate_digest',
      'old_proposition_key', v_plan ->> 'current_proposition_key',
      'old_fact_instance_id', v_plan ->> 'current_fact_instance_id',
      'old_confirmation_id', v_plan ->> 'current_confirmation_id',
      'old_assignment_id', v_plan ->> 'assignment_id',
      'new_proposition_key', v_plan ->> 'candidate_proposition_key',
      'new_assignment_id', v_new_assignment.assignment_id,
      'candidate_id', p_candidate_id,
      'evidence_id', v_evidence_id,
      'replacement_mode', 'same_proposition_value'
    )
  );

  v_audit_id := public.record_admin_audit_event(
    p_actor_user_id,
    'admin.products.review',
    'admin.product_fact.revalidation_replacement_prepared',
    'product_fact_revalidation_transition',
    p_transition_id::text,
    null,
    jsonb_build_object(
      'old_assignment_id', v_old_assignment.assignment_id,
      'new_assignment_id', v_new_assignment.assignment_id,
      'proposition_key', v_plan ->> 'current_proposition_key',
      'replacement_mode', 'same_proposition_value'
    ),
    'prepare same-proposition Product Fact value replacement after governed revalidation',
    v_request_id,
    jsonb_build_object(
      'candidate_id', p_candidate_id,
      'evidence_id', v_evidence_id,
      'replacement_prestate_digest', v_replacement_prestate_digest
    )
  );

  return jsonb_build_object(
    'status', 'ready_for_explicit_replacement_confirmation',
    'transition_id', p_transition_id,
    'candidate_id', p_candidate_id,
    'evidence_id', v_evidence_id,
    'old_assignment_id', v_old_assignment.assignment_id,
    'old_proposition_key', v_plan ->> 'current_proposition_key',
    'old_fact_instance_id', v_plan ->> 'current_fact_instance_id',
    'old_confirmation_id', v_plan ->> 'current_confirmation_id',
    'new_assignment_id', v_new_assignment.assignment_id,
    'new_proposition_key', v_plan ->> 'candidate_proposition_key',
    'confirmation_request_id', v_confirmation_request_id,
    'confirmation_payload', v_confirmation_payload,
    'confirmation_payload_digest', v_preflight ->> 'payload_digest',
    'confirmation_prestate_digest', v_preflight ->> 'prestate_digest',
    'replacement_prestate_digest', v_replacement_prestate_digest,
    'replacement_mode', 'same_proposition_value',
    'automatic_confirmation', false,
    'audit_id', v_audit_id
  );
end;
$$;

CREATE OR REPLACE FUNCTION public.admin_confirm_product_fact_revalidation_replacement_legacy_v1(p_actor_user_id uuid, p_request_id text, p_transition_id uuid, p_candidate_id uuid, p_new_assignment_id uuid, p_confirmation_payload jsonb, p_expected_confirmation_payload_digest text, p_expected_confirmation_prestate_digest text, p_expected_replacement_prestate_digest text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_actor_role text;
  v_request_id text := btrim(coalesce(p_request_id, ''));
  v_expected_confirmation_payload_digest text :=
    lower(btrim(coalesce(p_expected_confirmation_payload_digest, '')));
  v_expected_confirmation_prestate_digest text :=
    lower(btrim(coalesce(p_expected_confirmation_prestate_digest, '')));
  v_expected_replacement_prestate_digest text :=
    lower(btrim(coalesce(p_expected_replacement_prestate_digest, '')));
  v_existing public.product_fact_revalidation_resolutions%rowtype;
  v_plan jsonb;
  v_new_assignment public.product_fact_review_assignments%rowtype;
  v_preflight jsonb;
  v_replacement_prestate_digest text;
  v_confirmation jsonb;
  v_new_fact_instance_id uuid;
  v_new_confirmation_id uuid;
  v_evidence_id uuid;
  v_evidence public.product_evidence_records%rowtype;
  v_supporting_count integer;
  v_opposing_count integer;
  v_result jsonb;
  v_audit_id uuid;
  v_updated_count integer;
begin
  v_actor_role := public.admin_require_product_review_actor(
    p_actor_user_id,
    'admin.products.review'
  );

  if char_length(v_request_id) not between 8 and 80
    or v_expected_confirmation_payload_digest !~ '^[0-9a-f]{64}$'
    or v_expected_confirmation_prestate_digest !~ '^[0-9a-f]{64}$'
    or v_expected_replacement_prestate_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'product_fact_revalidation_replacement_confirm_request_invalid'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('bejewely_product_fact_revalidation_replacement:' || p_transition_id::text, 0)
  );

  select * into v_existing
  from public.product_fact_revalidation_resolutions
  where request_id = v_request_id
     or transition_id = p_transition_id
  order by case when request_id = v_request_id then 0 else 1 end
  limit 1;

  if found then
    if v_existing.request_id <> v_request_id
      or v_existing.transition_id <> p_transition_id
      or v_existing.candidate_id <> p_candidate_id
      or v_existing.actor_user_id <> p_actor_user_id
      or v_existing.resolution_kind <> 'SEMANTIC_CHANGE_REPLACEMENT'
      or v_existing.payload_digest <> v_expected_confirmation_payload_digest
      or v_existing.prestate_digest <> v_expected_replacement_prestate_digest then
      raise exception 'product_fact_revalidation_replacement_confirm_conflict'
        using errcode = '23505';
    end if;

    return v_existing.result || jsonb_build_object('idempotent', true);
  end if;

  v_plan := public.trust_phase8f_build_replacement_fact_payload_v1(
    p_actor_user_id,
    p_transition_id,
    p_candidate_id
  );

  select * into v_new_assignment
  from public.product_fact_review_assignments
  where assignment_id = p_new_assignment_id
  for update;

  if not found
    or v_new_assignment.operational_state <> 'ready_for_confirm'
    or v_new_assignment.assigned_to is distinct from p_actor_user_id
    or v_new_assignment.review_policy_version <> 'trust-phase8f-revalidation-replacement-v1'
    or v_new_assignment.subject_id is distinct from (v_plan ->> 'subject_id')::uuid
    or v_new_assignment.proposition_key is distinct from v_plan ->> 'candidate_proposition_key' then
    raise exception 'product_fact_revalidation_replacement_new_assignment_stale'
      using errcode = '40001';
  end if;

  if (p_confirmation_payload ->> 'assignment_id')::uuid <> p_new_assignment_id
    or p_confirmation_payload ->> 'proposition_key' <> v_plan ->> 'candidate_proposition_key' then
    raise exception 'product_fact_revalidation_replacement_confirmation_payload_mismatch'
      using errcode = '23514';
  end if;

  v_supporting_count := jsonb_array_length(p_confirmation_payload -> 'supporting_evidence_ids');
  v_opposing_count := jsonb_array_length(p_confirmation_payload -> 'opposing_evidence_ids');

  select value::uuid into v_evidence_id
  from (
    select value
    from jsonb_array_elements_text(p_confirmation_payload -> 'supporting_evidence_ids')
    union all
    select value
    from jsonb_array_elements_text(p_confirmation_payload -> 'opposing_evidence_ids')
  ) as evidence_ids
  limit 1;

  select * into v_evidence
  from public.product_evidence_records
  where evidence_id = v_evidence_id;

  if v_evidence_id is null
    or v_supporting_count + v_opposing_count <> 1
    or not found
    or v_evidence.subject_id is distinct from (v_plan ->> 'subject_id')::uuid
    or v_evidence.proposition_key is distinct from v_plan ->> 'candidate_proposition_key'
    or v_evidence.canonical_evidence_digest is distinct from (
      select canonical_evidence_digest
      from public.trust_evidence_candidates
      where candidate_id = p_candidate_id
    )
    or (
      v_supporting_count = 1
      and (
        v_evidence.support_direction <> 'supports'
        or v_evidence.negative_admissibility <> 'not_applicable'
      )
    )
    or (
      v_opposing_count = 1
      and (
        v_evidence.support_direction <> 'opposes'
        or v_evidence.negative_admissibility <> 'explicit_negative'
        or v_plan #>> '{fact_payload_base,value_type}' <> 'boolean'
        or coalesce((v_plan #>> '{fact_payload_base,value_boolean}')::boolean, true) <> false
      )
    ) then
    raise exception 'product_fact_revalidation_replacement_evidence_mismatch'
      using errcode = '23514';
  end if;

  v_preflight := public.admin_preflight_product_fact_confirmation_v1(
    p_actor_user_id,
    v_request_id || ':confirm',
    p_confirmation_payload
  );

  if v_preflight ->> 'status' <> 'ready'
    or v_preflight ->> 'payload_digest' <> v_expected_confirmation_payload_digest
    or v_preflight ->> 'prestate_digest' <> v_expected_confirmation_prestate_digest
    or v_preflight -> 'previous_current' <> 'null'::jsonb then
    raise exception 'product_fact_revalidation_replacement_confirmation_stale'
      using errcode = '40001';
  end if;

  v_replacement_prestate_digest := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object(
      'revalidation_prestate_digest', v_plan ->> 'prestate_digest',
      'confirmation_prestate_digest', v_preflight ->> 'prestate_digest',
      'old_proposition_key', v_plan ->> 'current_proposition_key',
      'old_fact_instance_id', v_plan ->> 'current_fact_instance_id',
      'old_confirmation_id', v_plan ->> 'current_confirmation_id',
      'old_assignment_id', v_plan ->> 'assignment_id',
      'new_proposition_key', v_plan ->> 'candidate_proposition_key',
      'new_assignment_id', p_new_assignment_id,
      'candidate_id', p_candidate_id,
      'evidence_id', v_evidence_id
    )
  );

  if v_replacement_prestate_digest <> v_expected_replacement_prestate_digest then
    raise exception 'product_fact_revalidation_replacement_prestate_stale'
      using errcode = '40001';
  end if;

  v_confirmation := public.admin_confirm_product_fact_v1(
    p_actor_user_id,
    v_request_id || ':confirm',
    p_confirmation_payload,
    v_expected_confirmation_payload_digest,
    v_expected_confirmation_prestate_digest
  );

  if v_confirmation ->> 'status' <> 'confirmed' then
    raise exception 'product_fact_revalidation_replacement_confirmation_failed'
      using errcode = '55000';
  end if;

  v_new_fact_instance_id := (v_confirmation ->> 'fact_instance_id')::uuid;
  v_new_confirmation_id := (v_confirmation ->> 'confirmation_id')::uuid;

  -- product_fact_instances.supersedes_fact_instance_id is intentionally
  -- proposition-local by storage FK. A changed-semantic replacement has a new
  -- proposition_key, so its cross-proposition lineage is recorded immutably
  -- by the revalidation resolution/event/audit instead of mutating the new Fact.

  delete from public.product_fact_current
  where proposition_key = v_plan ->> 'current_proposition_key'
    and fact_instance_id = (v_plan ->> 'current_fact_instance_id')::uuid
    and confirmation_id = (v_plan ->> 'current_confirmation_id')::uuid;

  get diagnostics v_updated_count = row_count;
  if v_updated_count <> 1 then
    raise exception 'product_fact_revalidation_replacement_old_current_stale'
      using errcode = '40001';
  end if;

  update public.product_fact_review_assignments
  set operational_state = 'superseded',
      updated_at = now()
  where assignment_id = (v_plan ->> 'assignment_id')::uuid
    and operational_state = 're_review_required';

  get diagnostics v_updated_count = row_count;
  if v_updated_count <> 1 then
    raise exception 'product_fact_revalidation_replacement_old_assignment_stale'
      using errcode = '40001';
  end if;

  insert into public.product_fact_review_events (
    assignment_id,
    subject_id,
    fact_instance_id,
    confirmation_id,
    actor_user_id,
    event_kind,
    reason_code,
    event_payload,
    created_at
  )
  values (
    (v_plan ->> 'assignment_id')::uuid,
    (v_plan ->> 'subject_id')::uuid,
    (v_plan ->> 'current_fact_instance_id')::uuid,
    (v_plan ->> 'current_confirmation_id')::uuid,
    p_actor_user_id,
    'revalidation_superseded',
    'semantic_change_confirmed',
    jsonb_build_object(
      'request_id', v_request_id,
      'transition_id', p_transition_id,
      'candidate_id', p_candidate_id,
      'new_assignment_id', p_new_assignment_id,
      'new_proposition_key', v_plan ->> 'candidate_proposition_key',
      'new_fact_instance_id', v_new_fact_instance_id,
      'new_confirmation_id', v_new_confirmation_id,
      'replacement_prestate_digest', v_replacement_prestate_digest
    ),
    now()
  );

  v_result := jsonb_build_object(
    'status', 'replaced',
    'idempotent', false,
    'actor_role', v_actor_role,
    'transition_id', p_transition_id,
    'candidate_id', p_candidate_id,
    'evidence_id', v_evidence_id,
    'resolution_kind', 'SEMANTIC_CHANGE_REPLACEMENT',
    'old_assignment_id', v_plan ->> 'assignment_id',
    'old_proposition_key', v_plan ->> 'current_proposition_key',
    'old_fact_instance_id', v_plan ->> 'current_fact_instance_id',
    'old_confirmation_id', v_plan ->> 'current_confirmation_id',
    'new_assignment_id', p_new_assignment_id,
    'new_proposition_key', v_plan ->> 'candidate_proposition_key',
    'new_fact_instance_id', v_new_fact_instance_id,
    'new_confirmation_id', v_new_confirmation_id,
    'confirmation_payload_digest', v_expected_confirmation_payload_digest,
    'confirmation_prestate_digest', v_expected_confirmation_prestate_digest,
    'replacement_prestate_digest', v_replacement_prestate_digest,
    'cross_proposition_replacement_lineage', true,
    'automatic_confirmation', false
  );

  insert into public.product_fact_revalidation_resolutions (
    request_id,
    transition_id,
    bridge_id,
    assignment_id,
    research_task_id,
    candidate_id,
    evidence_id,
    current_fact_instance_id,
    current_confirmation_id,
    actor_user_id,
    resolution_kind,
    payload_digest,
    prestate_digest,
    result
  ) values (
    v_request_id,
    p_transition_id,
    (v_plan ->> 'bridge_id')::uuid,
    (v_plan ->> 'assignment_id')::uuid,
    (v_plan ->> 'research_task_id')::uuid,
    p_candidate_id,
    v_evidence_id,
    (v_plan ->> 'current_fact_instance_id')::uuid,
    (v_plan ->> 'current_confirmation_id')::uuid,
    p_actor_user_id,
    'SEMANTIC_CHANGE_REPLACEMENT',
    v_expected_confirmation_payload_digest,
    v_replacement_prestate_digest,
    v_result
  );

  v_audit_id := public.record_admin_audit_event(
    p_actor_user_id,
    'admin.products.review',
    'admin.product_fact.revalidation_replaced',
    'product_fact_revalidation_transition',
    p_transition_id::text,
    jsonb_build_object(
      'proposition_key', v_plan ->> 'current_proposition_key',
      'fact_instance_id', v_plan ->> 'current_fact_instance_id',
      'confirmation_id', v_plan ->> 'current_confirmation_id'
    ),
    jsonb_build_object(
      'proposition_key', v_plan ->> 'candidate_proposition_key',
      'fact_instance_id', v_new_fact_instance_id,
      'confirmation_id', v_new_confirmation_id
    ),
    'replace Product Fact after changed-semantic revalidation research',
    v_request_id,
    jsonb_build_object(
      'candidate_id', p_candidate_id,
      'old_assignment_id', v_plan ->> 'assignment_id',
      'new_assignment_id', p_new_assignment_id,
      'replacement_prestate_digest', v_replacement_prestate_digest
    )
  );

  return v_result || jsonb_build_object('audit_id', v_audit_id);
end;
$function$


revoke all on function public.admin_confirm_product_fact_revalidation_replacement_legacy_v1(
  uuid, text, uuid, uuid, uuid, jsonb, text, text, text
) from public, anon, authenticated, service_role;

create or replace function public.admin_confirm_product_fact_revalidation_replacement_v1(
  p_actor_user_id uuid,
  p_request_id text,
  p_transition_id uuid,
  p_candidate_id uuid,
  p_new_assignment_id uuid,
  p_confirmation_payload jsonb,
  p_expected_confirmation_payload_digest text,
  p_expected_confirmation_prestate_digest text,
  p_expected_replacement_prestate_digest text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role text;
  v_request_id text := btrim(coalesce(p_request_id, ''));
  v_plan jsonb;
  v_existing public.product_fact_revalidation_resolutions%rowtype;
  v_new_assignment public.product_fact_review_assignments%rowtype;
  v_old_assignment public.product_fact_review_assignments%rowtype;
  v_candidate public.trust_evidence_candidates%rowtype;
  v_evidence_id uuid;
  v_evidence public.product_evidence_records%rowtype;
  v_preflight jsonb;
  v_replacement_prestate_digest text;
  v_confirmation jsonb;
  v_new_fact_instance_id uuid;
  v_new_confirmation_id uuid;
  v_new_fact public.product_fact_instances%rowtype;
  v_result jsonb;
  v_audit_id uuid;
begin
  v_actor_role := public.admin_require_product_review_actor(
    p_actor_user_id,
    'admin.products.review'
  );

  v_plan := public.trust_phase8f_build_replacement_fact_payload_v1(
    p_actor_user_id,
    p_transition_id,
    p_candidate_id
  );

  if coalesce(v_plan ->> 'replacement_mode', '') <> 'same_proposition_value' then
    return public.admin_confirm_product_fact_revalidation_replacement_legacy_v1(
      p_actor_user_id,
      p_request_id,
      p_transition_id,
      p_candidate_id,
      p_new_assignment_id,
      p_confirmation_payload,
      p_expected_confirmation_payload_digest,
      p_expected_confirmation_prestate_digest,
      p_expected_replacement_prestate_digest
    );
  end if;

  if char_length(v_request_id) not between 8 and 80
     or lower(btrim(coalesce(p_expected_confirmation_payload_digest, ''))) !~ '^[0-9a-f]{64}$'
     or lower(btrim(coalesce(p_expected_confirmation_prestate_digest, ''))) !~ '^[0-9a-f]{64}$'
     or lower(btrim(coalesce(p_expected_replacement_prestate_digest, ''))) !~ '^[0-9a-f]{64}$' then
    raise exception 'product_fact_revalidation_replacement_confirm_request_invalid'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('bejewely_product_fact_revalidation_replacement:' || p_transition_id::text, 0)
  );

  select *
    into v_existing
    from public.product_fact_revalidation_resolutions
   where request_id = v_request_id
      or transition_id = p_transition_id
   order by case when request_id = v_request_id then 0 else 1 end
   limit 1;

  if found then
    if v_existing.request_id <> v_request_id
       or v_existing.transition_id <> p_transition_id
       or v_existing.candidate_id <> p_candidate_id
       or v_existing.actor_user_id <> p_actor_user_id
       or v_existing.resolution_kind <> 'SEMANTIC_CHANGE_REPLACEMENT'
       or v_existing.payload_digest <> lower(btrim(p_expected_confirmation_payload_digest))
       or v_existing.prestate_digest <> lower(btrim(p_expected_replacement_prestate_digest)) then
      raise exception 'product_fact_revalidation_replacement_confirm_conflict'
        using errcode = '23505';
    end if;
    return v_existing.result || jsonb_build_object('idempotent', true);
  end if;

  select *
    into v_old_assignment
    from public.product_fact_review_assignments
   where assignment_id = (v_plan ->> 'assignment_id')::uuid
   for update;

  select *
    into v_new_assignment
    from public.product_fact_review_assignments
   where assignment_id = p_new_assignment_id
   for update;

  if v_old_assignment.assignment_id is null
     or v_old_assignment.operational_state <> 're_review_required'
     or v_new_assignment.assignment_id is null
     or v_new_assignment.assignment_id = v_old_assignment.assignment_id
     or v_new_assignment.operational_state <> 'ready_for_confirm'
     or v_new_assignment.assigned_to is distinct from p_actor_user_id
     or v_new_assignment.review_policy_version <> 'trust-phase8f-revalidation-replacement-v1'
     or v_new_assignment.subject_id <> (v_plan ->> 'subject_id')::uuid
     or v_new_assignment.proposition_key <> v_plan ->> 'candidate_proposition_key' then
    raise exception 'product_fact_revalidation_replacement_new_assignment_stale'
      using errcode = '40001';
  end if;

  if (p_confirmation_payload ->> 'assignment_id')::uuid <> p_new_assignment_id
     or p_confirmation_payload ->> 'proposition_key' <> v_plan ->> 'candidate_proposition_key'
     or p_confirmation_payload ->> 'parent_proposition_key' <> v_plan ->> 'candidate_parent_proposition_key'
     or (p_confirmation_payload ->> 'parent_fact_instance_id')::uuid <>
        (v_plan ->> 'current_parent_fact_instance_id')::uuid then
    raise exception 'product_fact_revalidation_replacement_confirmation_payload_mismatch'
      using errcode = '23514';
  end if;

  if jsonb_array_length(p_confirmation_payload -> 'supporting_evidence_ids') <> 1
     or jsonb_array_length(p_confirmation_payload -> 'opposing_evidence_ids') <> 0 then
    raise exception 'product_fact_revalidation_replacement_evidence_mismatch'
      using errcode = '23514';
  end if;

  select value::uuid
    into v_evidence_id
    from jsonb_array_elements_text(p_confirmation_payload -> 'supporting_evidence_ids')
   limit 1;

  select *
    into v_candidate
    from public.trust_evidence_candidates
   where candidate_id = p_candidate_id;

  select *
    into v_evidence
    from public.product_evidence_records
   where evidence_id = v_evidence_id;

  if not found
     or v_evidence.subject_id <> (v_plan ->> 'subject_id')::uuid
     or v_evidence.proposition_key <> v_plan ->> 'candidate_proposition_key'
     or v_evidence.parent_proposition_key <> v_plan ->> 'candidate_parent_proposition_key'
     or v_evidence.canonical_evidence_digest <> v_candidate.canonical_evidence_digest
     or v_evidence.support_direction <> 'supports'
     or v_evidence.negative_admissibility <> 'not_applicable' then
    raise exception 'product_fact_revalidation_replacement_evidence_mismatch'
      using errcode = '23514';
  end if;

  v_preflight := public.admin_preflight_product_fact_confirmation_v1(
    p_actor_user_id,
    v_request_id || ':confirm',
    p_confirmation_payload
  );

  if v_preflight ->> 'status' <> 'ready'
     or v_preflight ->> 'payload_digest' <> lower(btrim(p_expected_confirmation_payload_digest))
     or v_preflight ->> 'prestate_digest' <> lower(btrim(p_expected_confirmation_prestate_digest))
     or v_preflight #>> '{previous_current,fact_instance_id}' <> v_plan ->> 'current_fact_instance_id'
     or v_preflight #>> '{previous_current,confirmation_id}' <> v_plan ->> 'current_confirmation_id'
     or v_preflight #>> '{previous_current,proposition_key}' <> v_plan ->> 'current_proposition_key' then
    raise exception 'product_fact_revalidation_replacement_confirmation_stale'
      using errcode = '40001';
  end if;

  v_replacement_prestate_digest := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object(
      'revalidation_prestate_digest', v_plan ->> 'prestate_digest',
      'confirmation_prestate_digest', v_preflight ->> 'prestate_digest',
      'old_proposition_key', v_plan ->> 'current_proposition_key',
      'old_fact_instance_id', v_plan ->> 'current_fact_instance_id',
      'old_confirmation_id', v_plan ->> 'current_confirmation_id',
      'old_assignment_id', v_plan ->> 'assignment_id',
      'new_proposition_key', v_plan ->> 'candidate_proposition_key',
      'new_assignment_id', p_new_assignment_id,
      'candidate_id', p_candidate_id,
      'evidence_id', v_evidence_id,
      'replacement_mode', 'same_proposition_value'
    )
  );

  if v_replacement_prestate_digest <> lower(btrim(p_expected_replacement_prestate_digest)) then
    raise exception 'product_fact_revalidation_replacement_prestate_stale'
      using errcode = '40001';
  end if;

  v_confirmation := public.admin_confirm_product_fact_v1(
    p_actor_user_id,
    v_request_id || ':confirm',
    p_confirmation_payload,
    lower(btrim(p_expected_confirmation_payload_digest)),
    lower(btrim(p_expected_confirmation_prestate_digest))
  );

  if v_confirmation ->> 'status' <> 'confirmed' then
    raise exception 'product_fact_revalidation_replacement_confirmation_failed'
      using errcode = '55000';
  end if;

  v_new_fact_instance_id := (v_confirmation ->> 'fact_instance_id')::uuid;
  v_new_confirmation_id := (v_confirmation ->> 'confirmation_id')::uuid;

  select *
    into v_new_fact
    from public.product_fact_instances
   where fact_instance_id = v_new_fact_instance_id;

  if not found
     or v_new_fact.supersedes_fact_instance_id <> (v_plan ->> 'current_fact_instance_id')::uuid
     or v_new_fact.parent_fact_instance_id <> (v_plan ->> 'current_parent_fact_instance_id')::uuid
     or v_new_fact.parent_proposition_key <> v_plan ->> 'current_parent_proposition_key' then
    raise exception 'product_fact_revalidation_replacement_lineage_invalid'
      using errcode = '55000';
  end if;

  update public.product_fact_review_assignments
     set operational_state = 'superseded',
         updated_at = now()
   where assignment_id = v_old_assignment.assignment_id
     and operational_state = 're_review_required';

  if not found then
    raise exception 'product_fact_revalidation_replacement_old_assignment_stale'
      using errcode = '40001';
  end if;

  insert into public.product_fact_review_events (
    assignment_id, subject_id, fact_instance_id, confirmation_id,
    actor_user_id, event_kind, reason_code, event_payload, created_at
  ) values (
    v_old_assignment.assignment_id,
    (v_plan ->> 'subject_id')::uuid,
    (v_plan ->> 'current_fact_instance_id')::uuid,
    (v_plan ->> 'current_confirmation_id')::uuid,
    p_actor_user_id,
    'revalidation_superseded',
    'semantic_change_confirmed',
    jsonb_build_object(
      'request_id', v_request_id,
      'transition_id', p_transition_id,
      'candidate_id', p_candidate_id,
      'new_assignment_id', p_new_assignment_id,
      'new_proposition_key', v_plan ->> 'candidate_proposition_key',
      'new_fact_instance_id', v_new_fact_instance_id,
      'new_confirmation_id', v_new_confirmation_id,
      'replacement_mode', 'same_proposition_value',
      'replacement_prestate_digest', v_replacement_prestate_digest
    ),
    now()
  );

  v_result := jsonb_build_object(
    'status', 'replaced',
    'idempotent', false,
    'actor_role', v_actor_role,
    'transition_id', p_transition_id,
    'candidate_id', p_candidate_id,
    'evidence_id', v_evidence_id,
    'resolution_kind', 'SEMANTIC_CHANGE_REPLACEMENT',
    'old_assignment_id', v_old_assignment.assignment_id,
    'old_proposition_key', v_plan ->> 'current_proposition_key',
    'old_fact_instance_id', v_plan ->> 'current_fact_instance_id',
    'old_confirmation_id', v_plan ->> 'current_confirmation_id',
    'new_assignment_id', p_new_assignment_id,
    'new_proposition_key', v_plan ->> 'candidate_proposition_key',
    'new_fact_instance_id', v_new_fact_instance_id,
    'new_confirmation_id', v_new_confirmation_id,
    'confirmation_payload_digest', lower(btrim(p_expected_confirmation_payload_digest)),
    'confirmation_prestate_digest', lower(btrim(p_expected_confirmation_prestate_digest)),
    'replacement_prestate_digest', v_replacement_prestate_digest,
    'cross_proposition_replacement_lineage', false,
    'same_proposition_value_replacement', true,
    'automatic_confirmation', false
  );

  insert into public.product_fact_revalidation_resolutions (
    request_id, transition_id, bridge_id, assignment_id, research_task_id,
    candidate_id, evidence_id, current_fact_instance_id, current_confirmation_id,
    actor_user_id, resolution_kind, payload_digest, prestate_digest, result
  ) values (
    v_request_id, p_transition_id, (v_plan ->> 'bridge_id')::uuid,
    v_old_assignment.assignment_id, (v_plan ->> 'research_task_id')::uuid,
    p_candidate_id, v_evidence_id, (v_plan ->> 'current_fact_instance_id')::uuid,
    (v_plan ->> 'current_confirmation_id')::uuid, p_actor_user_id,
    'SEMANTIC_CHANGE_REPLACEMENT',
    lower(btrim(p_expected_confirmation_payload_digest)),
    v_replacement_prestate_digest,
    v_result
  );

  v_audit_id := public.record_admin_audit_event(
    p_actor_user_id,
    'admin.products.review',
    'admin.product_fact.revalidation_replaced',
    'product_fact_revalidation_transition',
    p_transition_id::text,
    jsonb_build_object(
      'proposition_key', v_plan ->> 'current_proposition_key',
      'fact_instance_id', v_plan ->> 'current_fact_instance_id',
      'confirmation_id', v_plan ->> 'current_confirmation_id',
      'assignment_id', v_old_assignment.assignment_id
    ),
    jsonb_build_object(
      'proposition_key', v_plan ->> 'candidate_proposition_key',
      'fact_instance_id', v_new_fact_instance_id,
      'confirmation_id', v_new_confirmation_id,
      'assignment_id', p_new_assignment_id
    ),
    'replace same-proposition Product Fact value after changed-semantic revalidation',
    v_request_id,
    jsonb_build_object(
      'candidate_id', p_candidate_id,
      'replacement_mode', 'same_proposition_value',
      'replacement_prestate_digest', v_replacement_prestate_digest
    )
  );

  return v_result || jsonb_build_object('audit_id', v_audit_id);
end;
$$;

revoke all on function public.trust_phase8e_build_revalidation_plan_v1(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.trust_phase8e_build_revalidation_plan_v1(uuid, uuid, uuid)
  to service_role;

revoke all on function public.trust_phase8f_build_replacement_fact_payload_v1(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.trust_phase8f_build_replacement_fact_payload_v1(uuid, uuid, uuid)
  to service_role;

revoke all on function public.admin_prepare_product_fact_revalidation_replacement_v1(
  uuid, text, uuid, uuid
) from public, anon, authenticated;
grant execute on function public.admin_prepare_product_fact_revalidation_replacement_v1(
  uuid, text, uuid, uuid
) to service_role;

revoke all on function public.admin_confirm_product_fact_revalidation_replacement_v1(
  uuid, text, uuid, uuid, uuid, jsonb, text, text, text
) from public, anon, authenticated;
grant execute on function public.admin_confirm_product_fact_revalidation_replacement_v1(
  uuid, text, uuid, uuid, uuid, jsonb, text, text, text
) to service_role;