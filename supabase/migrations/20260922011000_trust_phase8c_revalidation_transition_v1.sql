begin;

create table public.product_fact_revalidation_transitions (
  transition_id uuid primary key default gen_random_uuid(),
  request_id text not null,
  verification_id uuid not null
    references public.product_evidence_source_verifications(verification_id) on delete restrict,
  assignment_id uuid not null
    references public.product_fact_review_assignments(assignment_id) on delete restrict,
  proposition_key text not null,
  fact_instance_id uuid not null
    references public.product_fact_instances(fact_instance_id) on delete restrict,
  confirmation_id uuid not null
    references public.product_fact_confirmations(confirmation_id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  verification_result text not null,
  from_state text not null,
  to_state text not null,
  payload_digest text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  constraint product_fact_revalidation_transitions_request_unique unique (request_id),
  constraint product_fact_revalidation_transitions_verification_assignment_unique
    unique (verification_id, assignment_id),
  constraint product_fact_revalidation_transitions_request_check
    check (char_length(btrim(request_id)) between 8 and 120),
  constraint product_fact_revalidation_transitions_proposition_check
    check (proposition_key ~ '^[0-9a-f]{64}$'),
  constraint product_fact_revalidation_transitions_result_kind_check
    check (verification_result in ('changed', 'unavailable', 'ambiguous')),
  constraint product_fact_revalidation_transitions_state_check
    check (from_state = 'confirmed' and to_state = 're_review_required'),
  constraint product_fact_revalidation_transitions_payload_digest_check
    check (payload_digest ~ '^[0-9a-f]{64}$'),
  constraint product_fact_revalidation_transitions_result_check
    check (jsonb_typeof(result) = 'object' and octet_length(result::text) <= 32768)
);

create index product_fact_revalidation_transitions_assignment_created_idx
  on public.product_fact_revalidation_transitions (assignment_id, created_at desc, transition_id);

create index product_fact_revalidation_transitions_fact_created_idx
  on public.product_fact_revalidation_transitions (fact_instance_id, created_at desc, transition_id);

alter table public.product_fact_revalidation_transitions enable row level security;

revoke all on table public.product_fact_revalidation_transitions
  from public, anon, authenticated, service_role;
grant select on table public.product_fact_revalidation_transitions to service_role;

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
  v_verification_id uuid;
  v_assignment_id uuid;
  v_fact_instance_id uuid;
  v_confirmation_id uuid;
  v_proposition_key text;
  v_verification public.product_evidence_source_verifications%rowtype;
  v_assignment public.product_fact_review_assignments%rowtype;
  v_current public.product_fact_current%rowtype;
  v_fact public.product_fact_instances%rowtype;
  v_reason_code text;
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
         'verification_id',
         'assignment_id',
         'proposition_key',
         'fact_instance_id',
         'confirmation_id'
       ]
     ) then
    raise exception 'product_fact_revalidation_payload_invalid'
      using errcode = '22023';
  end if;

  begin
    v_verification_id := (p_payload ->> 'verification_id')::uuid;
    v_assignment_id := (p_payload ->> 'assignment_id')::uuid;
    v_fact_instance_id := (p_payload ->> 'fact_instance_id')::uuid;
    v_confirmation_id := (p_payload ->> 'confirmation_id')::uuid;
  exception when invalid_text_representation then
    raise exception 'product_fact_revalidation_payload_invalid'
      using errcode = '22023';
  end;

  v_proposition_key := lower(btrim(coalesce(p_payload ->> 'proposition_key', '')));
  if v_proposition_key !~ '^[0-9a-f]{64}$' then
    raise exception 'product_fact_revalidation_proposition_invalid'
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
      'source_id', v_verification.source_id,
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
      'source_id', v_verification.source_id,
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
      'confirmation_id', v_confirmation_id
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
      'source_id', v_verification.source_id,
      'verification_result', v_verification.verification_result,
      'reason_code', v_reason_code,
      'proposition_key', v_proposition_key
    )
  );

  v_result := jsonb_build_object(
    'status', 're_review_required',
    'actor_role', v_actor_role,
    'request_id', v_request_id,
    'verification_id', v_verification_id,
    'source_id', v_verification.source_id,
    'verification_result', v_verification.verification_result,
    'reason_code', v_reason_code,
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
    assignment_id,
    proposition_key,
    fact_instance_id,
    confirmation_id,
    actor_user_id,
    verification_result,
    from_state,
    to_state,
    payload_digest,
    result
  )
  values (
    v_request_id,
    v_verification_id,
    v_assignment_id,
    v_proposition_key,
    v_fact_instance_id,
    v_confirmation_id,
    p_actor_user_id,
    v_verification.verification_result,
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

comment on table public.product_fact_revalidation_transitions is
  'Immutable idempotency/audit ledger for governed confirmed -> stale -> re_review_required transitions. It never changes Product Fact semantic truth or Current pointers.';

comment on function public.admin_mark_product_fact_revalidation_v1(
  uuid, text, jsonb
) is
  'Explicit Admin transition from a confirmed assignment to re_review_required when a linked source verification is changed, unavailable, or ambiguous. Current Fact, Fact instance, and confirmation remain unchanged.';

commit;
