begin;

create table public.product_fact_revalidation_resolutions (
  resolution_id uuid primary key default gen_random_uuid(),
  request_id text not null,
  transition_id uuid not null
    references public.product_fact_revalidation_transitions(transition_id) on delete restrict,
  bridge_id uuid not null
    references public.product_fact_revalidation_research_bridges(bridge_id) on delete restrict,
  assignment_id uuid not null
    references public.product_fact_review_assignments(assignment_id) on delete restrict,
  research_task_id uuid not null
    references public.product_fact_research_tasks(id) on delete restrict,
  candidate_id uuid not null
    references public.trust_evidence_candidates(candidate_id) on delete restrict,
  evidence_id uuid
    references public.product_evidence_records(evidence_id) on delete restrict,
  current_fact_instance_id uuid not null
    references public.product_fact_instances(fact_instance_id) on delete restrict,
  current_confirmation_id uuid not null
    references public.product_fact_confirmations(confirmation_id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  resolution_kind text not null,
  payload_digest text not null,
  prestate_digest text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  constraint product_fact_revalidation_resolutions_request_unique unique (request_id),
  constraint product_fact_revalidation_resolutions_transition_unique unique (transition_id),
  constraint product_fact_revalidation_resolutions_request_check
    check (char_length(btrim(request_id)) between 8 and 100),
  constraint product_fact_revalidation_resolutions_kind_check
    check (resolution_kind in ('SAME_SEMANTIC_REAFFIRMATION')),
  constraint product_fact_revalidation_resolutions_payload_digest_check
    check (payload_digest ~ '^[0-9a-f]{64}$'),
  constraint product_fact_revalidation_resolutions_prestate_digest_check
    check (prestate_digest ~ '^[0-9a-f]{64}$'),
  constraint product_fact_revalidation_resolutions_result_check
    check (jsonb_typeof(result) = 'object' and octet_length(result::text) <= 32768)
);

create index product_fact_revalidation_resolutions_assignment_created_idx
  on public.product_fact_revalidation_resolutions (assignment_id, created_at desc, resolution_id);
create index product_fact_revalidation_resolutions_candidate_created_idx
  on public.product_fact_revalidation_resolutions (candidate_id, created_at desc, resolution_id);

alter table public.product_fact_revalidation_resolutions enable row level security;
revoke all on table public.product_fact_revalidation_resolutions
  from public, anon, authenticated, service_role;
grant select on table public.product_fact_revalidation_resolutions to service_role;

create or replace function public.trust_phase8e_build_revalidation_plan_v1(
  p_actor_user_id uuid,
  p_transition_id uuid,
  p_candidate_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
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
    or v_candidate.support_direction <> 'supports'
    or v_candidate.negative_admissibility <> 'not_applicable' then
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
$$;

create or replace function public.admin_preflight_product_fact_revalidation_resolution_v1(
  p_actor_user_id uuid,
  p_request_id text,
  p_transition_id uuid,
  p_candidate_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_request_id text := btrim(coalesce(p_request_id, ''));
  v_plan jsonb;
  v_payload_digest text;
begin
  if char_length(v_request_id) not between 8 and 100 then
    raise exception 'product_fact_revalidation_resolution_request_invalid'
      using errcode = '22023';
  end if;

  v_plan := public.trust_phase8e_build_revalidation_plan_v1(
    p_actor_user_id,
    p_transition_id,
    p_candidate_id
  );

  v_payload_digest := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object(
      'actor_user_id', p_actor_user_id,
      'transition_id', p_transition_id,
      'candidate_id', p_candidate_id
    )
  );

  return jsonb_build_object(
    'status', case
      when v_plan ->> 'semantic_relation' = 'SAME_SEMANTIC'
        then 'same_semantic_reaffirmation_ready'
      else 'semantic_change_review_required'
    end,
    'transition_id', p_transition_id,
    'assignment_id', v_plan ->> 'assignment_id',
    'candidate_id', p_candidate_id,
    'semantic_relation', v_plan ->> 'semantic_relation',
    'current_proposition_key', v_plan ->> 'current_proposition_key',
    'candidate_proposition_key', v_plan ->> 'candidate_proposition_key',
    'current_fact_instance_id', v_plan ->> 'current_fact_instance_id',
    'current_confirmation_id', v_plan ->> 'current_confirmation_id',
    'payload_digest', v_payload_digest,
    'prestate_digest', v_plan ->> 'prestate_digest',
    'expected_governed_write_boundary', case
      when v_plan ->> 'semantic_relation' = 'SAME_SEMANTIC'
        then jsonb_build_array(
          'evidence_ingest',
          'revalidation_resolution',
          'review_assignment_reaffirm'
        )
      else jsonb_build_array(
          'separate_changed_semantic_review_required'
        )
    end,
    'current_pointer_changed', false,
    'fact_instance_mutated', false,
    'automatic_confirmation', false
  );
end;
$$;

create or replace function public.admin_reaffirm_product_fact_revalidation_v1(
  p_actor_user_id uuid,
  p_request_id text,
  p_transition_id uuid,
  p_candidate_id uuid,
  p_expected_payload_digest text,
  p_expected_prestate_digest text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_actor_role text;
  v_request_id text := btrim(coalesce(p_request_id, ''));
  v_expected_payload_digest text := lower(btrim(coalesce(p_expected_payload_digest, '')));
  v_expected_prestate_digest text := lower(btrim(coalesce(p_expected_prestate_digest, '')));
  v_existing public.product_fact_revalidation_resolutions%rowtype;
  v_plan jsonb;
  v_payload_digest text;
  v_ingest jsonb;
  v_evidence_id uuid;
  v_result jsonb;
  v_audit_id uuid;
  v_updated_count integer;
begin
  v_actor_role := public.admin_require_product_review_actor(
    p_actor_user_id,
    'admin.products.review'
  );

  if char_length(v_request_id) not between 8 and 100
    or v_expected_payload_digest !~ '^[0-9a-f]{64}$'
    or v_expected_prestate_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'product_fact_revalidation_reaffirm_request_invalid'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('bejewely_product_fact_revalidation_resolution:' || p_transition_id::text, 0)
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
      or v_existing.payload_digest <> v_expected_payload_digest
      or v_existing.prestate_digest <> v_expected_prestate_digest then
      raise exception 'product_fact_revalidation_reaffirm_request_conflict'
        using errcode = '23505';
    end if;

    return v_existing.result || jsonb_build_object('idempotent', true);
  end if;

  v_plan := public.trust_phase8e_build_revalidation_plan_v1(
    p_actor_user_id,
    p_transition_id,
    p_candidate_id
  );

  v_payload_digest := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object(
      'actor_user_id', p_actor_user_id,
      'transition_id', p_transition_id,
      'candidate_id', p_candidate_id
    )
  );

  if v_plan ->> 'semantic_relation' <> 'SAME_SEMANTIC' then
    raise exception 'product_fact_revalidation_reaffirm_semantic_change'
      using errcode = '55000';
  end if;

  if v_payload_digest <> v_expected_payload_digest
    or v_plan ->> 'prestate_digest' <> v_expected_prestate_digest then
    raise exception 'product_fact_revalidation_reaffirm_stale_preflight'
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
    raise exception 'product_fact_revalidation_reaffirm_evidence_not_recorded'
      using errcode = '55000';
  end if;

  v_evidence_id := nullif(v_ingest ->> 'evidence_id', '')::uuid;
  if v_evidence_id is null then
    raise exception 'product_fact_revalidation_reaffirm_evidence_id_missing'
      using errcode = '55000';
  end if;

  update public.product_fact_review_assignments
  set operational_state = 'confirmed',
      updated_at = now()
  where assignment_id = (v_plan ->> 'assignment_id')::uuid
    and operational_state = 're_review_required';

  get diagnostics v_updated_count = row_count;
  if v_updated_count <> 1 then
    raise exception 'product_fact_revalidation_reaffirm_assignment_stale'
      using errcode = '40001';
  end if;

  v_result := jsonb_build_object(
    'status', 'reaffirmed',
    'idempotent', false,
    'actor_role', v_actor_role,
    'transition_id', p_transition_id,
    'bridge_id', v_plan ->> 'bridge_id',
    'assignment_id', v_plan ->> 'assignment_id',
    'research_task_id', v_plan ->> 'research_task_id',
    'candidate_id', p_candidate_id,
    'evidence_id', v_evidence_id,
    'resolution_kind', 'SAME_SEMANTIC_REAFFIRMATION',
    'fact_instance_id', v_plan ->> 'current_fact_instance_id',
    'confirmation_id', v_plan ->> 'current_confirmation_id',
    'proposition_key', v_plan ->> 'current_proposition_key',
    'payload_digest', v_payload_digest,
    'prestate_digest', v_expected_prestate_digest,
    'current_pointer_changed', false,
    'fact_instance_mutated', false,
    'confirmation_created', false,
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
    'SAME_SEMANTIC_REAFFIRMATION',
    v_payload_digest,
    v_expected_prestate_digest,
    v_result
  );

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
  select
    a.assignment_id,
    a.subject_id,
    (v_plan ->> 'current_fact_instance_id')::uuid,
    (v_plan ->> 'current_confirmation_id')::uuid,
    p_actor_user_id,
    'revalidation_reaffirmed',
    'same_semantic_research_evidence',
    jsonb_build_object(
      'request_id', v_request_id,
      'transition_id', p_transition_id,
      'candidate_id', p_candidate_id,
      'evidence_id', v_evidence_id,
      'payload_digest', v_payload_digest,
      'prestate_digest', v_expected_prestate_digest
    ),
    now()
  from public.product_fact_review_assignments a
  where a.assignment_id = (v_plan ->> 'assignment_id')::uuid;

  v_audit_id := public.record_admin_audit_event(
    p_actor_user_id,
    'admin.products.review',
    'admin.product_fact.revalidation_reaffirmed',
    'product_fact_review_assignment',
    v_plan ->> 'assignment_id',
    jsonb_build_object('operational_state', 're_review_required'),
    jsonb_build_object(
      'operational_state', 'confirmed',
      'fact_instance_id', v_plan ->> 'current_fact_instance_id',
      'confirmation_id', v_plan ->> 'current_confirmation_id'
    ),
    'reaffirm Product Fact after same-semantic revalidation research',
    v_request_id,
    jsonb_build_object(
      'transition_id', p_transition_id,
      'candidate_id', p_candidate_id,
      'evidence_id', v_evidence_id,
      'payload_digest', v_payload_digest,
      'prestate_digest', v_expected_prestate_digest
    )
  );

  return v_result || jsonb_build_object('audit_id', v_audit_id);
end;
$$;

revoke all on function public.trust_phase8e_build_revalidation_plan_v1(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_preflight_product_fact_revalidation_resolution_v1(uuid, text, uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_reaffirm_product_fact_revalidation_v1(uuid, text, uuid, uuid, text, text)
  from public, anon, authenticated, service_role;

grant execute on function public.admin_preflight_product_fact_revalidation_resolution_v1(uuid, text, uuid, uuid)
  to service_role;
grant execute on function public.admin_reaffirm_product_fact_revalidation_v1(uuid, text, uuid, uuid, text, text)
  to service_role;

comment on table public.product_fact_revalidation_resolutions is
  'Immutable Phase 8E resolution ledger. Same-semantic reaffirmation records new governed Evidence while preserving the existing Product Fact, confirmation, and Current pointer.';
comment on function public.admin_preflight_product_fact_revalidation_resolution_v1(uuid, text, uuid, uuid) is
  'Zero-write Phase 8E semantic adjudication preflight. SAME_SEMANTIC may proceed to reaffirmation; SEMANTIC_CHANGE is held for a separate governed replacement path.';
comment on function public.admin_reaffirm_product_fact_revalidation_v1(uuid, text, uuid, uuid, text, text) is
  'Explicit Admin same-semantic revalidation reaffirmation. Ingests governed Evidence and restores the existing assignment to confirmed without creating or mutating Product Fact semantic authority.';

commit;
