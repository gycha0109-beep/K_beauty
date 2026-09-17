begin;

-- The governed Product Fact preflight owns the fusion-input identity. Recompute
-- it only after governed Evidence ingest, using the exact Evidence row shape
-- consumed by product_fact_controlled_build_preflight_v1.
create or replace function public.admin_adopt_trust_evidence_candidate_v1(
  p_actor_user_id uuid,
  p_request_id text,
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
  v_ingest jsonb;
  v_review jsonb;
  v_preflight jsonb;
  v_confirmation_payload jsonb;
  v_confirmation_request_id text;
  v_evidence_id uuid;
  v_evidence public.product_evidence_records%rowtype;
  v_assignment public.product_fact_review_assignments%rowtype;
  v_assignment_count bigint;
  v_reused_assignment boolean := false;
  v_fusion_policy constant text := 'trust-phase4-single-primary-evidence-v1';
  v_fusion_input_digest text;
begin
  if char_length(v_request_id) not between 8 and 80 then
    raise exception 'trust_phase4_request_id_invalid' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_candidate_id::text, 0));

  v_plan := public.trust_phase4_build_adoption_plan_v1(
    p_actor_user_id,
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
    raise exception 'trust_phase4_governed_ingest_not_recorded' using errcode = '55000';
  end if;

  v_evidence_id := nullif(v_ingest ->> 'evidence_id', '')::uuid;
  if v_evidence_id is null then
    raise exception 'trust_phase4_governed_evidence_id_missing' using errcode = '55000';
  end if;

  select * into v_evidence
  from public.product_evidence_records
  where evidence_id = v_evidence_id;

  if not found
    or v_evidence.canonical_evidence_digest <> v_plan ->> 'canonical_evidence_digest'
    or v_evidence.proposition_key <> v_plan ->> 'proposition_key'
    or v_evidence.subject_id <> (v_plan ->> 'subject_id')::uuid
    or v_evidence.registry_version <> v_plan ->> 'registry_version'
    or v_evidence.fact_key <> v_plan ->> 'fact_key' then
    raise exception 'trust_phase4_governed_evidence_readback_invalid' using errcode = '55000';
  end if;

  select count(*) into v_assignment_count
  from public.product_fact_review_assignments a
  where a.product_id = (v_plan ->> 'product_id')::uuid
    and a.subject_id = (v_plan ->> 'subject_id')::uuid
    and a.registry_version = v_plan ->> 'registry_version'
    and a.fact_key = v_plan ->> 'fact_key'
    and a.proposition_key = v_plan ->> 'proposition_key'
    and a.operational_state not in ('confirmed','superseded');

  if v_assignment_count > 1 then
    raise exception 'trust_phase4_duplicate_open_assignments' using errcode = '55000';
  end if;

  if v_assignment_count = 1 then
    select * into v_assignment
    from public.product_fact_review_assignments a
    where a.product_id = (v_plan ->> 'product_id')::uuid
      and a.subject_id = (v_plan ->> 'subject_id')::uuid
      and a.registry_version = v_plan ->> 'registry_version'
      and a.fact_key = v_plan ->> 'fact_key'
      and a.proposition_key = v_plan ->> 'proposition_key'
      and a.operational_state not in ('confirmed','superseded')
    order by a.created_at desc, a.assignment_id desc
    limit 1
    for update;

    if v_assignment.assigned_to is distinct from p_actor_user_id
      or v_assignment.review_policy_version <> 'trust-phase4-controlled-evidence-adoption-v1'
      or v_assignment.operational_state not in ('under_review','ready_for_confirm') then
      raise exception 'trust_phase4_existing_assignment_not_reusable' using errcode = '55000';
    end if;
    v_reused_assignment := true;
  else
    v_review := public.admin_prepare_product_fact_review_v1(
      p_actor_user_id,
      v_request_id || ':review:under',
      jsonb_build_object(
        'product_id', v_plan ->> 'product_id',
        'subject_id', v_plan ->> 'subject_id',
        'registry_version', v_plan ->> 'registry_version',
        'fact_key', v_plan ->> 'fact_key',
        'proposition_key', v_plan ->> 'proposition_key',
        'operational_state', 'under_review',
        'assigned_to', p_actor_user_id,
        'review_policy_version', 'trust-phase4-controlled-evidence-adoption-v1',
        'reason_code', 'trust_phase4_controlled_evidence_adoption'
      )
    );

    if v_review ->> 'status' <> 'prepared' then
      raise exception 'trust_phase4_review_prepare_failed' using errcode = '55000';
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
        'product_id', v_plan ->> 'product_id',
        'subject_id', v_plan ->> 'subject_id',
        'registry_version', v_plan ->> 'registry_version',
        'fact_key', v_plan ->> 'fact_key',
        'proposition_key', v_plan ->> 'proposition_key',
        'operational_state', 'ready_for_confirm',
        'assigned_to', p_actor_user_id,
        'review_policy_version', 'trust-phase4-controlled-evidence-adoption-v1',
        'reason_code', 'trust_phase4_controlled_evidence_ready'
      )
    );

    if v_review ->> 'status' <> 'prepared'
      or v_review ->> 'operational_state' <> 'ready_for_confirm' then
      raise exception 'trust_phase4_ready_transition_failed' using errcode = '55000';
    end if;

    select * into v_assignment
    from public.product_fact_review_assignments
    where assignment_id = (v_review ->> 'assignment_id')::uuid
    for update;
  end if;

  if v_assignment.operational_state <> 'ready_for_confirm' then
    raise exception 'trust_phase4_assignment_not_ready' using errcode = '55000';
  end if;

  v_fusion_input_digest := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object(
      'registry_version', v_plan ->> 'registry_version',
      'subject_id', (v_plan ->> 'subject_id')::uuid,
      'fact_key', v_plan ->> 'fact_key',
      'proposition_key', v_plan ->> 'proposition_key',
      'fusion_policy_version', v_fusion_policy,
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
    'assignment_id', v_assignment.assignment_id,
    'fusion_policy_version', v_fusion_policy,
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
    or v_preflight ->> 'fusion_input_digest' <> v_fusion_input_digest then
    raise exception 'trust_phase4_product_fact_preflight_not_ready' using errcode = '55000';
  end if;

  return jsonb_build_object(
    'status', 'ready_for_explicit_confirmation',
    'candidate_id', p_candidate_id,
    'product_id', v_plan ->> 'product_id',
    'subject_id', v_plan ->> 'subject_id',
    'registry_version', v_plan ->> 'registry_version',
    'fact_key', v_plan ->> 'fact_key',
    'proposition_key', v_plan ->> 'proposition_key',
    'canonical_evidence_digest', v_plan ->> 'canonical_evidence_digest',
    'governed_source_id', v_ingest ->> 'source_id',
    'governed_binding_id', v_ingest ->> 'binding_id',
    'governed_evidence_id', v_evidence_id,
    'assignment_id', v_assignment.assignment_id,
    'assignment_reused', v_reused_assignment,
    'confirmation_request_id', v_confirmation_request_id,
    'confirmation_payload', v_confirmation_payload,
    'product_fact_preflight', v_preflight,
    'automatic_confirmation', false
  );
end;
$$;

revoke all on function public.admin_adopt_trust_evidence_candidate_v1(uuid, text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_adopt_trust_evidence_candidate_v1(uuid, text, uuid)
  to service_role;

commit;
