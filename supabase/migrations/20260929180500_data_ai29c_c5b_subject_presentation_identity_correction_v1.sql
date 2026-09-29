begin;

-- DATA-AI29C-C5B / governed correction for presentation-only semantic-variant review mistakes.
-- This boundary preserves the predecessor Subject, permits correction only before any governed
-- Evidence/Fact authority is attached, and creates one product-scoped successor lineage.

do $$
begin
  if to_regclass('public.product_fact_subjects') is null
    or to_regclass('public.product_evidence_source_subject_bindings') is null
    or to_regclass('public.product_evidence_records') is null
    or to_regclass('public.product_fact_instances') is null
    or to_regclass('public.product_fact_current') is null
    or to_regclass('public.product_fact_research_tasks') is null
    or to_regprocedure('public.admin_require_product_review_actor(uuid,text)') is null
    or to_regprocedure('public.admin_product_review_sha256_json(jsonb)') is null
    or to_regprocedure('public.record_admin_audit_event(uuid,text,text,text,text,jsonb,jsonb,text,text,jsonb)') is null
  then
    raise exception 'product_fact_subject_presentation_correction_prerequisite_missing';
  end if;
end $$;

create or replace function public.admin_correct_product_fact_subject_presentation_variant_v1(
  p_actor_user_id uuid,
  p_request_id text,
  p_predecessor_subject_id uuid,
  p_expected_predecessor_updated_at text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_actor_role text;
  v_request_id text := btrim(coalesce(p_request_id, ''));
  v_expected_updated_at text := btrim(coalesce(p_expected_predecessor_updated_at, ''));
  v_reason text := btrim(coalesce(p_reason, ''));
  v_predecessor public.product_fact_subjects%rowtype;
  v_existing public.product_fact_subjects%rowtype;
  v_successor_subject_id uuid;
  v_semantic_identity jsonb;
  v_successor_semantic_key text;
  v_source_binding_count integer := 0;
  v_evidence_count integer := 0;
  v_fact_count integer := 0;
  v_current_pointer_count integer := 0;
  v_research_task_count integer := 0;
  v_competing_current_count integer := 0;
  v_audit_id uuid;
begin
  v_actor_role := public.admin_require_product_review_actor(
    p_actor_user_id,
    'admin.products.review'
  );

  if p_predecessor_subject_id is null
     or char_length(v_request_id) not between 8 and 120
     or char_length(v_reason) not between 12 and 1000
     or char_length(v_expected_updated_at) not between 8 and 160
  then
    raise exception 'product_fact_subject_presentation_correction_invalid_request'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'bejewely_product_fact_subject_presentation_correction:' || p_predecessor_subject_id::text,
      0
    )
  );

  select *
    into v_predecessor
  from public.product_fact_subjects
  where subject_id = p_predecessor_subject_id
  for update;

  if not found then
    raise exception 'product_fact_subject_presentation_correction_subject_not_found'
      using errcode = 'P0002';
  end if;

  v_semantic_identity := jsonb_build_object(
    'product_id', v_predecessor.product_id,
    'variant_key', null,
    'formulation_revision_key', v_predecessor.formulation_revision_key,
    'market_applicability', v_predecessor.market_applicability,
    'region_applicability', v_predecessor.region_applicability,
    'valid_from', v_predecessor.valid_from,
    'valid_to', v_predecessor.valid_to
  );
  v_successor_semantic_key :=
    public.admin_product_review_sha256_json(v_semantic_identity);

  select *
    into v_existing
  from public.product_fact_subjects
  where subject_semantic_key = v_successor_semantic_key;

  if found then
    if v_existing.product_id <> v_predecessor.product_id
       or v_existing.variant_key is not null
       or v_existing.formulation_revision_key <> v_predecessor.formulation_revision_key
       or v_existing.identity_status <> 'resolved'
       or v_existing.current_state <> 'current'
       or v_existing.market_applicability is distinct from v_predecessor.market_applicability
       or v_existing.region_applicability is distinct from v_predecessor.region_applicability
       or v_existing.valid_from is distinct from v_predecessor.valid_from
       or v_existing.valid_to is distinct from v_predecessor.valid_to
       or v_existing.predecessor_subject_id is distinct from v_predecessor.subject_id
       or v_existing.supersession_kind is distinct from 'identity_correction'
       or v_predecessor.current_state <> 'historical'
    then
      raise exception 'product_fact_subject_presentation_correction_semantic_conflict'
        using errcode = '23505';
    end if;

    return jsonb_build_object(
      'status', 'corrected',
      'idempotent', true,
      'actor_role', v_actor_role,
      'request_id', v_request_id,
      'predecessor_subject_id', v_predecessor.subject_id,
      'successor_subject_id', v_existing.subject_id,
      'successor_semantic_key', v_existing.subject_semantic_key,
      'predecessor_current_state', v_predecessor.current_state,
      'successor_current_state', v_existing.current_state,
      'successor_variant_key', v_existing.variant_key,
      'product_fact_authority_mutated', false,
      'recommendation_authority_mutated', false
    );
  end if;

  if v_predecessor.updated_at::text is distinct from v_expected_updated_at then
    raise exception 'product_fact_subject_presentation_correction_stale_predecessor'
      using errcode = '40001';
  end if;

  if v_predecessor.current_state <> 'current'
     or v_predecessor.identity_status <> 'resolved'
     or v_predecessor.variant_key is null
     or v_predecessor.subject_identity_serializer_version <> 'product-fact-subject-identity-v1'
     or v_predecessor.identity_resolution_version <> 'trust-phase5-admin-subject-review-v1'
     or v_predecessor.predecessor_subject_id is not null
     or v_predecessor.supersession_kind is not null
  then
    raise exception 'product_fact_subject_presentation_correction_predecessor_not_eligible'
      using errcode = '23514';
  end if;

  select count(*)::integer
    into v_source_binding_count
  from public.product_evidence_source_subject_bindings
  where subject_id = v_predecessor.subject_id;

  select count(*)::integer
    into v_evidence_count
  from public.product_evidence_records
  where subject_id = v_predecessor.subject_id;

  select count(*)::integer
    into v_fact_count
  from public.product_fact_instances
  where subject_id = v_predecessor.subject_id;

  select count(*)::integer
    into v_current_pointer_count
  from public.product_fact_current
  where subject_id = v_predecessor.subject_id;

  select count(*)::integer
    into v_research_task_count
  from public.product_fact_research_tasks
  where subject_id = v_predecessor.subject_id;

  if v_source_binding_count <> 0
     or v_evidence_count <> 0
     or v_fact_count <> 0
     or v_current_pointer_count <> 0
     or v_research_task_count <> 0
  then
    raise exception 'product_fact_subject_presentation_correction_authority_already_attached'
      using errcode = '23514';
  end if;

  select count(*)::integer
    into v_competing_current_count
  from public.product_fact_subjects
  where product_id = v_predecessor.product_id
    and subject_id <> v_predecessor.subject_id
    and identity_status = 'resolved'
    and current_state = 'current'
    and variant_key is null
    and market_applicability is not distinct from v_predecessor.market_applicability
    and region_applicability is not distinct from v_predecessor.region_applicability;

  if v_competing_current_count <> 0 then
    raise exception 'product_fact_subject_presentation_correction_competing_current_subject'
      using errcode = '23505';
  end if;

  update public.product_fact_subjects
  set current_state = 'historical',
      updated_at = now()
  where subject_id = v_predecessor.subject_id
    and current_state = 'current';

  if not found then
    raise exception 'product_fact_subject_presentation_correction_predecessor_transition_failed'
      using errcode = '40001';
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
    v_predecessor.product_id,
    v_successor_semantic_key,
    'product-fact-subject-identity-v1',
    null,
    v_predecessor.formulation_revision_key,
    v_predecessor.formulation_label,
    'resolved',
    'data-ai29c-c5-presentation-identity-correction-v1',
    'current',
    v_predecessor.market_applicability,
    v_predecessor.region_applicability,
    v_predecessor.valid_from,
    v_predecessor.valid_to,
    v_predecessor.subject_id,
    'identity_correction',
    now(),
    now()
  )
  returning subject_id into v_successor_subject_id;

  insert into public.product_fact_review_events (
    subject_id,
    actor_user_id,
    event_kind,
    reason_code,
    event_payload,
    created_at
  ) values
  (
    v_predecessor.subject_id,
    p_actor_user_id,
    'subject_identity_corrected',
    'presentation_only_variant_correction',
    jsonb_build_object(
      'request_id', v_request_id,
      'successor_subject_id', v_successor_subject_id,
      'prior_variant_key', v_predecessor.variant_key,
      'successor_variant_key', null,
      'formulation_revision_key', v_predecessor.formulation_revision_key
    ),
    now()
  ),
  (
    v_successor_subject_id,
    p_actor_user_id,
    'subject_registered',
    'identity_correction_successor',
    jsonb_build_object(
      'request_id', v_request_id,
      'predecessor_subject_id', v_predecessor.subject_id,
      'subject_semantic_key', v_successor_semantic_key,
      'variant_key', null,
      'formulation_revision_key', v_predecessor.formulation_revision_key,
      'supersession_kind', 'identity_correction'
    ),
    now()
  );

  v_audit_id := public.record_admin_audit_event(
    p_actor_user_id,
    'admin.products.review',
    'admin.product_fact.subject_presentation_identity_corrected',
    'product_fact_subject',
    v_successor_subject_id::text,
    jsonb_build_object(
      'predecessor_subject_id', v_predecessor.subject_id,
      'current_state', 'current',
      'variant_key', v_predecessor.variant_key
    ),
    jsonb_build_object(
      'successor_subject_id', v_successor_subject_id,
      'predecessor_subject_id', v_predecessor.subject_id,
      'current_state', 'current',
      'variant_key', null,
      'supersession_kind', 'identity_correction'
    ),
    v_reason,
    v_request_id,
    jsonb_build_object(
      'contract_version', 'product-fact-subject-presentation-identity-correction-v1',
      'subject_identity_serializer_version', 'product-fact-subject-identity-v1',
      'identity_resolution_version', 'data-ai29c-c5-presentation-identity-correction-v1',
      'source_binding_count_before', v_source_binding_count,
      'evidence_count_before', v_evidence_count,
      'fact_count_before', v_fact_count,
      'current_pointer_count_before', v_current_pointer_count,
      'research_task_count_before', v_research_task_count
    )
  );

  return jsonb_build_object(
    'status', 'corrected',
    'idempotent', false,
    'actor_role', v_actor_role,
    'request_id', v_request_id,
    'audit_id', v_audit_id,
    'product_id', v_predecessor.product_id,
    'predecessor_subject_id', v_predecessor.subject_id,
    'successor_subject_id', v_successor_subject_id,
    'successor_semantic_key', v_successor_semantic_key,
    'predecessor_current_state', 'historical',
    'successor_current_state', 'current',
    'successor_variant_key', null,
    'source_bindings_moved', 0,
    'evidence_records_moved', 0,
    'fact_instances_moved', 0,
    'current_pointers_moved', 0,
    'product_fact_authority_mutated', false,
    'recommendation_authority_mutated', false
  );
end;
$$;

comment on function public.admin_correct_product_fact_subject_presentation_variant_v1(uuid,text,uuid,text,text) is
  'Service-role-only admin correction for a pre-authority presentation-only variant review mistake. Preserves predecessor lineage, creates a product-scoped current successor, and never moves Product Fact Evidence/Facts/Current authority.';

revoke all on function public.admin_correct_product_fact_subject_presentation_variant_v1(uuid,text,uuid,text,text)
  from public, anon, authenticated, service_role;

grant execute on function public.admin_correct_product_fact_subject_presentation_variant_v1(uuid,text,uuid,text,text)
  to service_role;

do $$
begin
  if has_function_privilege(
      'anon',
      'public.admin_correct_product_fact_subject_presentation_variant_v1(uuid,text,uuid,text,text)',
      'EXECUTE'
    )
    or has_function_privilege(
      'authenticated',
      'public.admin_correct_product_fact_subject_presentation_variant_v1(uuid,text,uuid,text,text)',
      'EXECUTE'
    )
    or not has_function_privilege(
      'service_role',
      'public.admin_correct_product_fact_subject_presentation_variant_v1(uuid,text,uuid,text,text)',
      'EXECUTE'
    )
  then
    raise exception 'product_fact_subject_presentation_correction_rpc_privilege_invalid';
  end if;
end $$;

commit;
