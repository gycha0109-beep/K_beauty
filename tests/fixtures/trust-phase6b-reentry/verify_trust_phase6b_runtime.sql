-- TRUST Phase 6-B isolated runtime verification.
-- Run after the Phase 6-A runtime fixture so manual retry regressions are
-- already proven on the same isolated database.

create temporary table trust_phase6b_baseline as
select
  (select count(*) from public.product_fact_subjects) as subjects,
  (select count(*) from public.product_evidence_records) as governed_evidence,
  (select count(*) from public.product_fact_instances) as instances,
  (select count(*) from public.product_fact_confirmations) as confirmations,
  (select count(*) from public.product_fact_current) as current_rows,
  (select count(*) from public.recommendation_logs) as recommendations,
  (select count(*) from public.trust_reentry_events) as reentry_events;

-- First detector pass only establishes checkpoints. Exact replay is a no-op.
do $$
declare
  v_first jsonb;
  v_second jsonb;
  v_events bigint;
  v_checkpoints bigint;
begin
  select reentry_events into v_events from trust_phase6b_baseline;

  v_first := public.run_trust_reentry_detectors_v1(100);
  if (v_first->>'events_emitted')::integer <> 0
    or (v_first->>'signals_baselined')::integer <= 0
  then
    raise exception 'phase6b_initial_baseline_invalid:%',v_first;
  end if;
  if (select count(*) from public.trust_reentry_events) <> v_events then
    raise exception 'phase6b_initial_baseline_emitted_event';
  end if;

  select count(*) into v_checkpoints
  from public.trust_reentry_detector_checkpoints;
  if v_checkpoints <= 0 then
    raise exception 'phase6b_checkpoint_baseline_missing';
  end if;

  v_second := public.run_trust_reentry_detectors_v1(100);
  if (v_second->>'events_emitted')::integer <> 0
    or (v_second->>'signals_unchanged')::integer <= 0
    or (select count(*) from public.trust_reentry_detector_checkpoints) <> v_checkpoints
  then
    raise exception 'phase6b_identical_replay_invalid:%',v_second;
  end if;
end;
$$;

-- Official source locator drift emits exactly one SOURCE_CHANGED review event.
do $$
declare
  v_before bigint;
  v_run jsonb;
  v_event record;
begin
  select count(*) into v_before from public.trust_reentry_events;

  update public.product_source_bindings
  set source_url='https://official.example.test/products/product-9-v2',
      updated_at=now()
  where binding_id='70000000-0000-4000-8000-000000000001'::uuid;

  v_run := public.run_trust_reentry_detectors_v1(100);
  if (v_run->>'events_emitted')::integer <> 1
    or (select count(*) from public.trust_reentry_events) <> v_before + 1
  then
    raise exception 'phase6b_source_locator_event_invalid:%',v_run;
  end if;

  select event_type,disposition,event_payload,disposition_detail
  into v_event
  from public.trust_reentry_events
  where event_payload->>'phase'='6-B'
    and event_payload->>'detector_key'='OFFICIAL_SOURCE_SET'
  order by created_at desc,event_id desc
  limit 1;

  if v_event.event_type <> 'SOURCE_CHANGED'
    or v_event.disposition <> 'REVIEW_REQUIRED'
    or coalesce((v_event.disposition_detail->>'authority_mutation')::boolean,true)
    or coalesce((v_event.disposition_detail->>'current_invalidated')::boolean,true)
  then
    raise exception 'phase6b_source_locator_event_semantics_invalid:%',row_to_json(v_event);
  end if;
end;
$$;

-- First source observation establishes a digest baseline; the next digest
-- for the same canonical source scope emits SOURCE_CHANGED.
do $$
declare
  v_task_id uuid;
  v_before bigint;
  v_run jsonb;
begin
  select id into v_task_id
  from public.product_fact_research_tasks
  where product_id='10000000-0000-4000-8000-000000000009'::uuid
    and fact_key='spf_value'
  order by created_at,id
  limit 1;

  insert into public.trust_source_observations (
    observation_id,research_task_id,product_id,subject_id,source_binding_id,
    canonical_locator,publisher,source_kind,market,locale,
    observed_claim,product_identity_observation,observation_version,
    digest_basis,source_content_digest,observed_at
  ) values (
    '71000000-0000-4000-8000-000000000001'::uuid,
    v_task_id,
    '10000000-0000-4000-8000-000000000009'::uuid,
    '30000000-0000-4000-8000-000000000009'::uuid,
    '70000000-0000-4000-8000-000000000001'::uuid,
    'https://official.example.test/products/product-9-v2',
    'fixture_official','brand_official_product_page','KR','ko-KR',
    '{"spf":"SPF50+"}'::jsonb,'{"product":"fixture"}'::jsonb,
    'phase6b-observation-v1',
    'live-page-bytes-v1',repeat('a',64),now()
  );

  select count(*) into v_before from public.trust_reentry_events;
  v_run := public.run_trust_reentry_detectors_v1(100);
  if (v_run->>'events_emitted')::integer <> 0
    or (select count(*) from public.trust_reentry_events) <> v_before
  then
    raise exception 'phase6b_first_digest_must_baseline:%',v_run;
  end if;

  insert into public.trust_source_observations (
    observation_id,research_task_id,product_id,subject_id,source_binding_id,
    canonical_locator,publisher,source_kind,market,locale,
    observed_claim,product_identity_observation,observation_version,
    digest_basis,source_content_digest,observed_at
  ) values (
    '71000000-0000-4000-8000-000000000002'::uuid,
    v_task_id,
    '10000000-0000-4000-8000-000000000009'::uuid,
    '30000000-0000-4000-8000-000000000009'::uuid,
    '70000000-0000-4000-8000-000000000001'::uuid,
    'https://official.example.test/products/product-9-v2',
    'fixture_official','brand_official_product_page','KR','ko-KR',
    '{"spf":"SPF50+ changed source bytes"}'::jsonb,'{"product":"fixture"}'::jsonb,
    'phase6b-observation-v1',
    'live-page-bytes-v1',repeat('b',64),now() + interval '1 second'
  );

  select count(*) into v_before from public.trust_reentry_events;
  v_run := public.run_trust_reentry_detectors_v1(100);
  if (v_run->>'events_emitted')::integer <> 1
    or (select count(*) from public.trust_reentry_events) <> v_before + 1
    or not exists(
      select 1 from public.trust_reentry_events
      where event_payload->>'phase'='6-B'
        and event_payload->>'detector_key'='SOURCE_OBSERVATION_DIGEST'
        and event_type='SOURCE_CHANGED'
        and disposition='REVIEW_REQUIRED'
    )
  then
    raise exception 'phase6b_digest_change_event_invalid:%',v_run;
  end if;
end;
$$;

-- Identity/formulation/market scope drift is review-only FORMULATION_CHANGED.
do $$
declare
  v_before bigint;
  v_run jsonb;
begin
  update public.product_candidates
  set identity_resolution_state='formulation_conflict',
      identity_resolution_evidence='{"reason_code":"fixture_formulation_changed"}'::jsonb
  where id='20000000-0000-4000-8000-000000000009'::uuid;

  select count(*) into v_before from public.trust_reentry_events;
  v_run := public.run_trust_reentry_detectors_v1(100);

  if (v_run->>'events_emitted')::integer <> 1
    or (select count(*) from public.trust_reentry_events) <> v_before + 1
    or not exists(
      select 1 from public.trust_reentry_events
      where event_payload->>'phase'='6-B'
        and event_payload->>'detector_key'='IDENTITY_SCOPE'
        and event_type='FORMULATION_CHANGED'
        and disposition='REVIEW_REQUIRED'
    )
  then
    raise exception 'phase6b_identity_scope_event_invalid:%',v_run;
  end if;
end;
$$;

-- Required Fact Policy output drift is detected without mutating the
-- intake's governed policy-version field. Keep the exact fact keys and change
-- one sunscreen priority to model a new policy implementation under test.
create or replace function public.catalog_required_product_facts_v1(p_category text)
returns table(fact_key text, priority smallint)
language sql
stable
set search_path = public, pg_temp
as $policy$
  select policy.fact_key, policy.priority
  from (values
    ('cleanser', 'low_ph', 100::smallint),
    ('cleanser', 'deep_cleansing', 110::smallint),
    ('toner_essence', 'product_format', 100::smallint),
    ('toner_essence', 'contains_active', 120::smallint),
    ('toner_pad', 'product_format', 100::smallint),
    ('toner_pad', 'pad_surface_texture', 105::smallint),
    ('toner_pad', 'wipe_off_use', 110::smallint),
    ('toner_pad', 'contains_active', 120::smallint),
    ('treatment', 'contains_active', 100::smallint),
    ('treatment', 'active_concentration', 110::smallint),
    ('treatment', 'recommended_use_frequency', 120::smallint),
    ('moisturizer', 'primary_use_role', 100::smallint),
    ('moisturizer', 'barrier_support_claim', 110::smallint),
    ('moisturizer_lotion_emulsion', 'primary_use_role', 100::smallint),
    ('moisturizer_lotion_emulsion', 'barrier_support_claim', 110::smallint),
    ('moisturizer_gel', 'primary_use_role', 100::smallint),
    ('moisturizer_gel', 'barrier_support_claim', 110::smallint),
    ('moisturizer_cream', 'primary_use_role', 100::smallint),
    ('moisturizer_cream', 'barrier_support_claim', 110::smallint),
    ('moisturizer_balm', 'primary_use_role', 100::smallint),
    ('moisturizer_balm', 'barrier_support_claim', 110::smallint),
    ('sunscreen', 'spf_value', 100::smallint),
    ('sunscreen', 'uva_label', 105::smallint),
    ('sunscreen', 'uv_filter_type', 111::smallint)
  ) as policy(category, fact_key, priority)
  where policy.category = lower(btrim(coalesce(p_category, '')))
  order by policy.priority, policy.fact_key;
$policy$;

do $phase6b_policy$
declare
  v_before bigint;
  v_expected integer;
  v_run jsonb;
begin
  select count(*)::integer into v_expected
  from public.trust_reentry_detector_checkpoints
  where detector_key='REQUIRED_FACT_POLICY'
    and signal_payload->>'category'='sunscreen';

  if v_expected < 1 then
    raise exception 'phase6b_policy_baseline_missing';
  end if;

  select count(*) into v_before from public.trust_reentry_events;
  v_run := public.run_trust_reentry_detectors_v1(100);

  if (v_run->>'events_emitted')::integer <> v_expected
    or (select count(*) from public.trust_reentry_events) <> v_before + v_expected
    or (
      select count(*)
      from public.trust_reentry_events
      where event_payload->>'phase'='6-B'
        and event_payload->>'detector_key'='REQUIRED_FACT_POLICY'
        and event_type='POLICY_CHANGED'
        and disposition='REVIEW_REQUIRED'
    ) < v_expected
  then
    raise exception 'phase6b_policy_event_invalid:%:%',v_expected,v_run;
  end if;
end;
$phase6b_policy$;

-- Registry checksum drift is detected without changing governed Product Facts.
do $$
declare
  v_before bigint;
  v_run jsonb;
begin
  update public.product_fact_registry_versions
  set registry_checksum=repeat('b',64)
  where registry_version='product-fact-registry-cross-category-v1';

  select count(*) into v_before from public.trust_reentry_events;
  v_run := public.run_trust_reentry_detectors_v1(100);

  if (v_run->>'events_emitted')::integer <> 2 then
    -- Two current intakes share the same registry snapshot in this fixture.
    raise exception 'phase6b_registry_event_count_invalid:%',v_run;
  end if;
  if (select count(*) from public.trust_reentry_events) <> v_before + 2 then
    raise exception 'phase6b_registry_event_cardinality_invalid:%',v_run;
  end if;
  if (
    select count(*)
    from public.trust_reentry_events
    where event_payload->>'phase'='6-B'
      and event_payload->>'detector_key'='PRODUCT_FACT_REGISTRY'
      and event_type='REGISTRY_CHANGED'
      and disposition='REVIEW_REQUIRED'
  ) < 2 then
    raise exception 'phase6b_registry_events_missing';
  end if;
end;
$$;

-- Final identical run emits nothing.
do $$
declare
  v_before bigint;
  v_run jsonb;
begin
  select count(*) into v_before from public.trust_reentry_events;
  v_run := public.run_trust_reentry_detectors_v1(100);
  if (v_run->>'events_emitted')::integer <> 0
    or (select count(*) from public.trust_reentry_events) <> v_before
  then
    raise exception 'phase6b_final_replay_not_idempotent:%',v_run;
  end if;
end;
$$;

-- Governed Product Fact and Recommendation authority cardinality are invariant.
do $$
declare
  b record;
begin
  select * into b from trust_phase6b_baseline;
  if (select count(*) from public.product_fact_subjects) <> b.subjects then raise exception 'phase6b_subject_mutation'; end if;
  if (select count(*) from public.product_evidence_records) <> b.governed_evidence then raise exception 'phase6b_evidence_mutation'; end if;
  if (select count(*) from public.product_fact_instances) <> b.instances then raise exception 'phase6b_instance_mutation'; end if;
  if (select count(*) from public.product_fact_confirmations) <> b.confirmations then raise exception 'phase6b_confirmation_mutation'; end if;
  if (select count(*) from public.product_fact_current) <> b.current_rows then raise exception 'phase6b_current_mutation'; end if;
  if (select count(*) from public.recommendation_logs) <> b.recommendations then raise exception 'phase6b_recommendation_mutation'; end if;

  if exists(
    select 1
    from public.trust_reentry_events
    where event_payload->>'phase'='6-B'
      and (
        disposition <> 'REVIEW_REQUIRED'
        or coalesce((disposition_detail->>'authority_mutation')::boolean,true)
        or coalesce((disposition_detail->>'current_invalidated')::boolean,true)
      )
  ) then
    raise exception 'phase6b_non_review_event_detected';
  end if;

  if exists(
    select 1
    from public.catalog_trust_intake i
    where i.product_id='10000000-0000-4000-8000-000000000002'::uuid
      and (i.identity_state <> 'SUBJECT_CREATION_REQUIRED' or i.trust_state <> 'REVIEW_REQUIRED')
  ) then
    raise exception 'phase6b_missing_subject_regression';
  end if;
end;
$$;

-- Security surface: checkpoints are not directly exposed and only the runner
-- is service-role callable.
do $$
begin
  if has_table_privilege('service_role','public.trust_reentry_detector_checkpoints','SELECT')
    or has_table_privilege('service_role','public.trust_reentry_detector_checkpoints','INSERT')
    or has_table_privilege('anon','public.trust_reentry_detector_checkpoints','SELECT')
    or has_table_privilege('authenticated','public.trust_reentry_detector_checkpoints','SELECT')
  then
    raise exception 'phase6b_checkpoint_acl_invalid';
  end if;

  if not has_function_privilege('service_role','public.run_trust_reentry_detectors_v1(integer)','EXECUTE')
    or has_function_privilege('anon','public.run_trust_reentry_detectors_v1(integer)','EXECUTE')
    or has_function_privilege('authenticated','public.run_trust_reentry_detectors_v1(integer)','EXECUTE')
    or has_function_privilege('service_role','public.observe_trust_reentry_signal_v1(text,text,text,uuid,uuid,uuid,jsonb)','EXECUTE')
  then
    raise exception 'phase6b_function_acl_invalid';
  end if;
end;
$$;

select 'TRUST_PHASE6B_REENTRY_DETECTORS_RUNTIME_VERIFIED' as verification_result;
