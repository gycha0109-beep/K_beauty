begin;

alter table public.product_fact_revalidation_transitions
  add column source_id uuid
    references public.product_evidence_sources(source_id) on delete restrict,
  add column prestate_digest text,
  add column reason_code text;

alter table public.product_fact_revalidation_transitions
  alter column source_id set not null,
  alter column prestate_digest set not null,
  alter column reason_code set not null;

alter table public.product_fact_revalidation_transitions
  add constraint product_fact_revalidation_transitions_prestate_digest_check
    check (prestate_digest ~ '^[0-9a-f]{64}$'),
  add constraint product_fact_revalidation_transitions_reason_code_check
    check (reason_code in (
      'source_content_changed',
      'source_unavailable',
      'source_verification_ambiguous'
    ));

create index product_fact_revalidation_transitions_source_created_idx
  on public.product_fact_revalidation_transitions (source_id, created_at desc, transition_id);

create or replace function public.admin_preflight_product_fact_revalidation_v1(
  p_actor_user_id uuid,
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
  v_verification public.product_evidence_source_verifications%rowtype;
  v_assignment public.product_fact_review_assignments%rowtype;
  v_current public.product_fact_current%rowtype;
  v_fact public.product_fact_instances%rowtype;
  v_reason_code text;
  v_prestate jsonb;
  v_prestate_digest text;
  v_transition_payload jsonb;
begin
  v_actor_role := public.admin_require_product_review_actor(
    p_actor_user_id,
    'admin.products.review'
  );

  if p_verification_id is null or p_assignment_id is null then
    raise exception 'product_fact_revalidation_preflight_identity_required'
      using errcode = '22023';
  end if;

  select *
    into v_verification
    from public.product_evidence_source_verifications
   where verification_id = p_verification_id;

  if not found then
    raise exception 'product_fact_revalidation_verification_not_found'
      using errcode = 'P0002';
  end if;

  if v_verification.verification_result not in ('changed', 'unavailable', 'ambiguous') then
    raise exception 'product_fact_revalidation_verification_not_actionable'
      using errcode = '23514';
  end if;

  select *
    into v_assignment
    from public.product_fact_review_assignments
   where assignment_id = p_assignment_id;

  if not found then
    raise exception 'product_fact_revalidation_assignment_not_found'
      using errcode = 'P0002';
  end if;

  if v_assignment.operational_state <> 'confirmed'
     or v_assignment.proposition_key is null
     or v_assignment.subject_id is null
     or v_assignment.fact_key is null
     or v_assignment.registry_version is null then
    raise exception 'product_fact_revalidation_assignment_not_confirmed'
      using errcode = '40001';
  end if;

  select *
    into v_current
    from public.product_fact_current
   where proposition_key = v_assignment.proposition_key;

  if not found
     or v_current.subject_id is distinct from v_assignment.subject_id then
    raise exception 'product_fact_revalidation_current_prestate_stale'
      using errcode = '40001';
  end if;

  select *
    into v_fact
    from public.product_fact_instances
   where fact_instance_id = v_current.fact_instance_id;

  if not found
     or v_fact.proposition_key <> v_assignment.proposition_key
     or v_fact.subject_id is distinct from v_assignment.subject_id
     or v_fact.fact_key is distinct from v_assignment.fact_key
     or v_fact.registry_version is distinct from v_assignment.registry_version then
    raise exception 'product_fact_revalidation_fact_prestate_stale'
      using errcode = '40001';
  end if;

  if not exists (
    select 1
      from public.product_fact_evidence_links as l
      join public.product_evidence_records as e
        on e.evidence_id = l.evidence_id
     where l.fact_instance_id = v_current.fact_instance_id
       and e.source_id = v_verification.source_id
  ) then
    raise exception 'product_fact_revalidation_source_not_linked_to_current_fact'
      using errcode = '23514';
  end if;

  v_reason_code := case v_verification.verification_result
    when 'changed' then 'source_content_changed'
    when 'unavailable' then 'source_unavailable'
    else 'source_verification_ambiguous'
  end;

  v_prestate := jsonb_build_object(
    'verification_id', v_verification.verification_id,
    'source_id', v_verification.source_id,
    'verification_payload_digest', v_verification.payload_digest,
    'verification_result', v_verification.verification_result,
    'assignment_id', v_assignment.assignment_id,
    'assignment_state', v_assignment.operational_state,
    'assignment_updated_at', v_assignment.updated_at,
    'subject_id', v_assignment.subject_id,
    'proposition_key', v_assignment.proposition_key,
    'fact_key', v_assignment.fact_key,
    'registry_version', v_assignment.registry_version,
    'fact_instance_id', v_current.fact_instance_id,
    'confirmation_id', v_current.confirmation_id,
    'current_updated_at', v_current.updated_at,
    'reason_code', v_reason_code
  );

  v_prestate_digest := public.product_fact_controlled_sha256_json_v1(v_prestate);

  v_transition_payload := jsonb_build_object(
    'source_id', v_verification.source_id,
    'verification_id', v_verification.verification_id,
    'assignment_id', v_assignment.assignment_id,
    'proposition_key', v_assignment.proposition_key,
    'fact_instance_id', v_current.fact_instance_id,
    'confirmation_id', v_current.confirmation_id,
    'prestate_digest', v_prestate_digest,
    'reason_code', v_reason_code
  );

  return jsonb_build_object(
    'status', 'ready_for_revalidation_transition',
    'actor_role', v_actor_role,
    'transition_payload', v_transition_payload,
    'prestate_digest', v_prestate_digest,
    'reason_code', v_reason_code,
    'current_pointer_changed', false,
    'fact_instance_mutated', false,
    'automatic_confirmation', false
  );
end;
$$;

revoke all on function public.admin_preflight_product_fact_revalidation_v1(
  uuid, uuid, uuid
) from public, anon, authenticated, service_role;

grant execute on function public.admin_preflight_product_fact_revalidation_v1(
  uuid, uuid, uuid
) to service_role;

create or replace function public.admin_mark_product_fact_revalidation_v1(
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
  v_source_id uuid;
  v_verification_id uuid;
  v_assignment_id uuid;
  v_fact_instance_id uuid;
  v_confirmation_id uuid;
  v_proposition_key text;
  v_supplied_prestate_digest text;
  v_supplied_reason_code text;
  v_verification public.product_evidence_source_verifications%rowtype;
  v_assignment public.product_fact_review_assignments%rowtype;
  v_current public.product_fact_current%rowtype;
  v_fact public.product_fact_instances%rowtype;
  v_reason_code text;
  v_prestate jsonb;
  v_prestate_digest text;
  v_audit_id uuid;
  v_result jsonb;
begin
  v_actor_role := public.admin_require_product_review_actor(
    p_actor_user_id,
    'admin.products.review'
  );

  if char_length(v_request_id) not between 8 and 120 then
    raise exception 'product_fact_revalidation_request_invalid'
      using errcode = '22023';
  end if;

  if p_payload is null
     or not public.product_fact_controlled_json_exact_keys_v1(
       p_payload,
       array[
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
    raise exception 'product_fact_revalidation_payload_invalid'
      using errcode = '22023';
  end if;

  begin
    v_source_id := (p_payload ->> 'source_id')::uuid;
    v_verification_id := (p_payload ->> 'verification_id')::uuid;
    v_assignment_id := (p_payload ->> 'assignment_id')::uuid;
    v_fact_instance_id := (p_payload ->> 'fact_instance_id')::uuid;
    v_confirmation_id := (p_payload ->> 'confirmation_id')::uuid;
  exception when invalid_text_representation then
    raise exception 'product_fact_revalidation_payload_invalid'
      using errcode = '22023';
  end;

  v_proposition_key := lower(btrim(coalesce(p_payload ->> 'proposition_key', '')));
  v_supplied_prestate_digest := lower(btrim(coalesce(p_payload ->> 'prestate_digest', '')));
  v_supplied_reason_code := btrim(coalesce(p_payload ->> 'reason_code', ''));

  if v_proposition_key !~ '^[0-9a-f]{64}$'
     or v_supplied_prestate_digest !~ '^[0-9a-f]{64}$'
     or v_supplied_reason_code not in (
       'source_content_changed',
       'source_unavailable',
       'source_verification_ambiguous'
     ) then
    raise exception 'product_fact_revalidation_payload_invalid'
      using errcode = '22023';
  end if;

  v_payload_digest := public.product_fact_controlled_sha256_json_v1(p_payload);

  perform pg_advisory_xact_lock(
    hashtextextended(
      'bejewely_product_fact_revalidation_request:' || v_request_id,
      0
    )
  );

  select *
    into v_existing
    from public.product_fact_revalidation_transitions
   where request_id = v_request_id;

  if found then
    if v_existing.actor_user_id <> p_actor_user_id
       or v_existing.payload_digest <> v_payload_digest then
      raise exception 'product_fact_revalidation_request_conflict'
        using errcode = '23505';
    end if;

    return v_existing.result || jsonb_build_object('idempotent', true);
  end if;

  select *
    into v_verification
    from public.product_evidence_source_verifications
   where verification_id = v_verification_id;

  if not found then
    raise exception 'product_fact_revalidation_verification_not_found'
      using errcode = 'P0002';
  end if;

  if v_verification.source_id <> v_source_id then
    raise exception 'product_fact_revalidation_source_mismatch'
      using errcode = '23514';
  end if;

  if v_verification.verification_result not in ('changed', 'unavailable', 'ambiguous') then
    raise exception 'product_fact_revalidation_verification_not_actionable'
      using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'bejewely_product_fact_proposition:' || v_proposition_key,
      0
    )
  );

  select *
    into v_assignment
    from public.product_fact_review_assignments
   where assignment_id = v_assignment_id
   for update;

  if not found then
    raise exception 'product_fact_revalidation_assignment_not_found'
      using errcode = 'P0002';
  end if;

  if v_assignment.operational_state <> 'confirmed' then
    raise exception 'product_fact_revalidation_assignment_not_confirmed'
      using errcode = '40001';
  end if;

  if v_assignment.proposition_key is distinct from v_proposition_key then
    raise exception 'product_fact_revalidation_assignment_proposition_mismatch'
      using errcode = '23514';
  end if;

  select *
    into v_current
    from public.product_fact_current
   where proposition_key = v_proposition_key
   for update;

  if not found then
    raise exception 'product_fact_revalidation_current_not_found'
      using errcode = 'P0002';
  end if;

  if v_current.fact_instance_id <> v_fact_instance_id
     or v_current.confirmation_id <> v_confirmation_id
     or v_current.subject_id is distinct from v_assignment.subject_id then
    raise exception 'product_fact_revalidation_current_prestate_stale'
      using errcode = '40001';
  end if;

  select *
    into v_fact
    from public.product_fact_instances
   where fact_instance_id = v_fact_instance_id;

  if not found
     or v_fact.proposition_key <> v_proposition_key
     or v_fact.subject_id is distinct from v_assignment.subject_id
     or v_fact.fact_key is distinct from v_assignment.fact_key
     or v_fact.registry_version is distinct from v_assignment.registry_version then
    raise exception 'product_fact_revalidation_fact_prestate_stale'
      using errcode = '40001';
  end if;

  if not exists (
    select 1
      from public.product_fact_evidence_links as l
      join public.product_evidence_records as e
        on e.evidence_id = l.evidence_id
     where l.fact_instance_id = v_fact_instance_id
       and e.source_id = v_source_id
  ) then
    raise exception 'product_fact_revalidation_source_not_linked_to_current_fact'
      using errcode = '23514';
  end if;

  v_reason_code := case v_verification.verification_result
    when 'changed' then 'source_content_changed'
    when 'unavailable' then 'source_unavailable'
    else 'source_verification_ambiguous'
  end;

  if v_supplied_reason_code <> v_reason_code then
    raise exception 'product_fact_revalidation_reason_mismatch'
      using errcode = '23514';
  end if;

  v_prestate := jsonb_build_object(
    'verification_id', v_verification.verification_id,
    'source_id', v_verification.source_id,
    'verification_payload_digest', v_verification.payload_digest,
    'verification_result', v_verification.verification_result,
    'assignment_id', v_assignment.assignment_id,
    'assignment_state', v_assignment.operational_state,
    'assignment_updated_at', v_assignment.updated_at,
    'subject_id', v_assignment.subject_id,
    'proposition_key', v_assignment.proposition_key,
    'fact_key', v_assignment.fact_key,
    'registry_version', v_assignment.registry_version,
    'fact_instance_id', v_current.fact_instance_id,
    'confirmation_id', v_current.confirmation_id,
    'current_updated_at', v_current.updated_at,
    'reason_code', v_reason_code
  );

  v_prestate_digest := public.product_fact_controlled_sha256_json_v1(v_prestate);

  if v_supplied_prestate_digest <> v_prestate_digest then
    raise exception 'product_fact_revalidation_prestate_digest_stale'
      using errcode = '40001';
  end if;

  update public.product_fact_review_assignments
     set operational_state = 'stale',
         updated_at = now()
   where assignment_id = v_assignment_id
     and operational_state = 'confirmed';

  if not found then
    raise exception 'product_fact_revalidation_stale_transition_failed'
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
    v_assignment_id,
    v_current.subject_id,
    v_fact_instance_id,
    v_confirmation_id,
    p_actor_user_id,
    'revalidation_stale',
    v_reason_code,
    jsonb_build_object(
      'request_id', v_request_id,
      'verification_id', v_verification_id,
      'source_id', v_source_id,
      'prestate_digest', v_prestate_digest,
      'verification_result', v_verification.verification_result,
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
    raise exception 'product_fact_revalidation_re_review_transition_failed'
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
    v_assignment_id,
    v_current.subject_id,
    v_fact_instance_id,
    v_confirmation_id,
    p_actor_user_id,
    'revalidation_required',
    v_reason_code,
    jsonb_build_object(
      'request_id', v_request_id,
      'verification_id', v_verification_id,
      'source_id', v_source_id,
      'prestate_digest', v_prestate_digest,
      'verification_result', v_verification.verification_result,
      'from_state', 'stale',
      'to_state', 're_review_required'
    ),
    now()
  );

  v_audit_id := public.record_admin_audit_event(
    p_actor_user_id,
    'admin.products.review',
    'admin.product_fact.revalidation_required',
    'product_fact_review_assignment',
    v_assignment_id::text,
    jsonb_build_object(
      'operational_state', 'confirmed',
      'fact_instance_id', v_fact_instance_id,
      'confirmation_id', v_confirmation_id,
      'prestate_digest', v_prestate_digest
    ),
    jsonb_build_object(
      'operational_state', 're_review_required',
      'fact_instance_id', v_fact_instance_id,
      'confirmation_id', v_confirmation_id
    ),
    'mark Product Fact for governed revalidation after source verification',
    v_request_id,
    jsonb_build_object(
      'verification_id', v_verification_id,
      'source_id', v_source_id,
      'verification_result', v_verification.verification_result,
      'reason_code', v_reason_code,
      'proposition_key', v_proposition_key,
      'prestate_digest', v_prestate_digest
    )
  );

  v_result := jsonb_build_object(
    'status', 're_review_required',
    'actor_role', v_actor_role,
    'request_id', v_request_id,
    'verification_id', v_verification_id,
    'source_id', v_source_id,
    'verification_result', v_verification.verification_result,
    'reason_code', v_reason_code,
    'prestate_digest', v_prestate_digest,
    'assignment_id', v_assignment_id,
    'proposition_key', v_proposition_key,
    'fact_instance_id', v_fact_instance_id,
    'confirmation_id', v_confirmation_id,
    'current_pointer_changed', false,
    'fact_instance_mutated', false,
    'automatic_confirmation', false,
    'audit_id', v_audit_id,
    'idempotent', false
  );

  insert into public.product_fact_revalidation_transitions (
    request_id,
    verification_id,
    source_id,
    assignment_id,
    proposition_key,
    fact_instance_id,
    confirmation_id,
    actor_user_id,
    verification_result,
    reason_code,
    prestate_digest,
    from_state,
    to_state,
    payload_digest,
    result
  )
  values (
    v_request_id,
    v_verification_id,
    v_source_id,
    v_assignment_id,
    v_proposition_key,
    v_fact_instance_id,
    v_confirmation_id,
    p_actor_user_id,
    v_verification.verification_result,
    v_reason_code,
    v_prestate_digest,
    'confirmed',
    're_review_required',
    v_payload_digest,
    v_result
  );

  return v_result;
end;
$$;

revoke all on function public.admin_mark_product_fact_revalidation_v1(
  uuid, text, jsonb
) from public, anon, authenticated, service_role;

grant execute on function public.admin_mark_product_fact_revalidation_v1(
  uuid, text, jsonb
) to service_role;

comment on function public.admin_preflight_product_fact_revalidation_v1(
  uuid, uuid, uuid
) is
  'Service-role-only Admin preflight that binds source, verification, proposition, current Fact, confirmation, assignment, reason code, and prestate digest without mutation.';

comment on function public.admin_mark_product_fact_revalidation_v1(
  uuid, text, jsonb
) is
  'Explicit Admin revalidation transition requiring the exact Phase 8C preflight payload. Fails closed on stale prestate and never mutates Product Fact semantic truth or Current pointers.';

commit;
