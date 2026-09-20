-- TRUST Phase 6-A isolated runtime verification.

create temporary table trust_phase6a_baseline as
select
  (select count(*) from public.product_fact_subjects) as subjects,
  (select count(*) from public.product_evidence_records) as governed_evidence,
  (select count(*) from public.product_fact_instances) as instances,
  (select count(*) from public.product_fact_confirmations) as confirmations,
  (select count(*) from public.product_fact_current) as current_rows,
  (select count(*) from public.recommendation_logs) as recommendations,
  (select count(*) from public.trust_source_observations) as observations,
  (select count(*) from public.trust_evidence_candidates) as evidence_candidates;

-- Exact Subject + SOURCE_BLOCKED can be explicitly requeued.
do $$
declare
  v_task_id uuid;
  v_intake_id uuid;
  v_request jsonb;
  v_replay jsonb;
  v_processed jsonb;
  v_processed_replay jsonb;
  v_state text;
  v_blocker text;
begin
  select id,intake_id into v_task_id,v_intake_id
  from public.product_fact_research_tasks
  where product_id='10000000-0000-4000-8000-000000000009'::uuid
    and fact_key='uv_filter_type';

  update public.product_fact_research_tasks
  set state='BLOCKED', blocker_code='SOURCE_BLOCKED',
      blocker_detail='fixture source blocked', next_retry_at=null
  where id=v_task_id;

  v_request := public.request_trust_reentry_v1(
    'MANUAL_RETRY',
    '10000000-0000-4000-8000-000000000009'::uuid,
    v_intake_id,
    v_task_id,
    repeat('d',64),
    '90000000-0000-4000-8000-000000000001'::uuid,
    'phase6a-manual-retry-001',
    '{"fixture":"source-blocked"}'::jsonb
  );

  v_replay := public.request_trust_reentry_v1(
    'MANUAL_RETRY',
    '10000000-0000-4000-8000-000000000009'::uuid,
    v_intake_id,
    v_task_id,
    repeat('d',64),
    '90000000-0000-4000-8000-000000000001'::uuid,
    'phase6a-manual-retry-001',
    '{"fixture":"source-blocked"}'::jsonb
  );

  if coalesce((v_request->>'idempotent')::boolean,true)
    or coalesce((v_replay->>'idempotent')::boolean,false) is not true
    or v_request->>'event_id' <> v_replay->>'event_id'
  then
    raise exception 'phase6a_request_replay_failed:%:%',v_request,v_replay;
  end if;

  v_processed := public.process_trust_reentry_event_v1((v_request->>'event_id')::uuid);
  if v_processed->>'disposition' <> 'RESEARCH_REQUEUED' then
    raise exception 'phase6a_manual_retry_not_requeued:%',v_processed;
  end if;

  select state,blocker_code into v_state,v_blocker
  from public.product_fact_research_tasks where id=v_task_id;
  if v_state <> 'RESEARCH_PENDING' or v_blocker is not null then
    raise exception 'phase6a_requeued_task_invalid:%:%',v_state,v_blocker;
  end if;

  v_processed_replay := public.process_trust_reentry_event_v1((v_request->>'event_id')::uuid);
  if coalesce((v_processed_replay->>'idempotent')::boolean,false) is not true
    or v_processed_replay->>'disposition' <> 'RESEARCH_REQUEUED'
  then
    raise exception 'phase6a_process_replay_failed:%',v_processed_replay;
  end if;
end;
$$;

-- Missing Subject revalidation must not become research with the same input.
do $$
declare
  v_task_id uuid;
  v_intake_id uuid;
  v_request jsonb;
  v_processed jsonb;
  v_state text;
  v_blocker text;
begin
  perform public.promote_product_candidate(
    '20000000-0000-4000-8000-000000000002'::uuid,
    'phase6a-fixture'
  );
  perform public.process_catalog_trust_product_v1(
    '10000000-0000-4000-8000-000000000002'::uuid
  );

  select id,intake_id into v_task_id,v_intake_id
  from public.product_fact_research_tasks
  where product_id='10000000-0000-4000-8000-000000000002'::uuid
  order by priority,fact_key limit 1;

  v_request := public.request_trust_reentry_v1(
    'MANUAL_RETRY',
    '10000000-0000-4000-8000-000000000002'::uuid,
    v_intake_id,
    v_task_id,
    repeat('e',64),
    '90000000-0000-4000-8000-000000000001'::uuid,
    'phase6a-manual-retry-002',
    '{"fixture":"missing-subject"}'::jsonb
  );
  v_processed := public.process_trust_reentry_event_v1((v_request->>'event_id')::uuid);

  select state,blocker_code into v_state,v_blocker
  from public.product_fact_research_tasks where id=v_task_id;

  if v_processed->>'disposition' <> 'REVIEW_REQUIRED'
    or v_state <> 'REVIEW_REQUIRED'
    or v_blocker <> 'SUBJECT_CREATION_REQUIRED'
  then
    raise exception 'phase6a_identity_blocker_force_requeued:%:%:%',v_processed,v_state,v_blocker;
  end if;
end;
$$;

-- Change events are durable review signals only in Phase 6-A.
do $$
declare
  v_task_id uuid;
  v_intake_id uuid;
  v_event_type text;
  v_request jsonb;
  v_processed jsonb;
  v_i integer := 0;
begin
  select id,intake_id into v_task_id,v_intake_id
  from public.product_fact_research_tasks
  where product_id='10000000-0000-4000-8000-000000000009'::uuid
    and fact_key='spf_value';

  foreach v_event_type in array array[
    'SOURCE_CHANGED','FORMULATION_CHANGED','POLICY_CHANGED','REGISTRY_CHANGED'
  ] loop
    v_i := v_i + 1;
    v_request := public.request_trust_reentry_v1(
      v_event_type,
      '10000000-0000-4000-8000-000000000009'::uuid,
      v_intake_id,
      v_task_id,
      repeat(v_i::text,64),
      null,
      null,
      jsonb_build_object('fixture',lower(v_event_type))
    );
    v_processed := public.process_trust_reentry_event_v1((v_request->>'event_id')::uuid);
    if v_processed->>'disposition' <> 'REVIEW_REQUIRED'
      or coalesce((v_processed->>'current_invalidated')::boolean,true)
      or coalesce((v_processed->>'authority_mutation')::boolean,true)
    then
      raise exception 'phase6a_change_event_not_review_only:%',v_processed;
    end if;
  end loop;
end;
$$;

-- Product Fact authority and Recommendation cardinality remain invariant.
do $$
declare
  b record;
begin
  select * into b from trust_phase6a_baseline;
  if (select count(*) from public.product_fact_subjects) <> b.subjects then raise exception 'phase6a_subject_mutation'; end if;
  if (select count(*) from public.product_evidence_records) <> b.governed_evidence then raise exception 'phase6a_evidence_mutation'; end if;
  if (select count(*) from public.product_fact_instances) <> b.instances then raise exception 'phase6a_instance_mutation'; end if;
  if (select count(*) from public.product_fact_confirmations) <> b.confirmations then raise exception 'phase6a_confirmation_mutation'; end if;
  if (select count(*) from public.product_fact_current) <> b.current_rows then raise exception 'phase6a_current_mutation'; end if;
  if (select count(*) from public.recommendation_logs) <> b.recommendations then raise exception 'phase6a_recommendation_mutation'; end if;
  if (select count(*) from public.trust_source_observations) <> b.observations then raise exception 'phase6a_observation_mutation'; end if;
  if (select count(*) from public.trust_evidence_candidates) <> b.evidence_candidates then raise exception 'phase6a_candidate_mutation'; end if;
  if (select count(*) from public.trust_reentry_events) <> 6 then raise exception 'phase6a_event_cardinality_invalid'; end if;
end;
$$;

select 'TRUST_PHASE6A_REENTRY_RUNTIME_VERIFIED' as verification_result;
