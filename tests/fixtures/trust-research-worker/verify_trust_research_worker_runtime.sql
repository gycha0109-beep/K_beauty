-- TRUST Phase 3 isolated runtime verification.

create temporary table trust_phase3_baseline as
select
  (select count(*) from public.product_fact_subjects) as subjects,
  (select count(*) from public.product_fact_instances) as fact_instances,
  (select count(*) from public.product_fact_current) as current_rows,
  (select count(*) from public.product_fact_confirmations) as confirmations,
  (select count(*) from public.product_evidence_records) as governed_evidence,
  (select count(*) from public.recommendation_logs) as recommendation_rows;

create temporary table trust_phase3_claim as
select public.claim_trust_research_tasks_v1(10, 300) as payload;

do $$
declare
  v_payload jsonb;
  v_task jsonb;
  v_count integer := 0;
  v_seed_count integer;
  v_seed_name text;
begin
  select payload into v_payload from trust_phase3_claim;
  if jsonb_typeof(v_payload) <> 'array' or jsonb_array_length(v_payload) <> 3 then
    raise exception 'phase3_claim_count_invalid:%', v_payload;
  end if;

  for v_task in select value from jsonb_array_elements(v_payload) loop
    v_count := v_count + 1;
    if v_task ->> 'product_id' <> '10000000-0000-4000-8000-000000000009' then
      raise exception 'phase3_claim_wrong_product:%', v_task;
    end if;
    if v_task ->> 'subject_id' <> '30000000-0000-4000-8000-000000000009' then
      raise exception 'phase3_claim_wrong_subject:%', v_task;
    end if;
    v_seed_count := jsonb_array_length(v_task -> 'official_source_seeds');
    v_seed_name := v_task #>> '{official_source_seeds,0,source_name}';
    if v_seed_count <> 1 or v_seed_name <> 'fixture_official' then
      raise exception 'phase3_official_source_filter_failed:%:%', v_seed_count, v_task -> 'official_source_seeds';
    end if;
  end loop;

  if v_count <> 3 then
    raise exception 'phase3_claim_iteration_invalid:%', v_count;
  end if;
end;
$$;

-- Clear first-party UVA claim -> frozen observation + deterministic candidate.
do $$
declare
  v_task_id uuid;
  v_result jsonb;
  v_result_replay jsonb;
  v_state text;
  v_obs uuid;
  v_candidate uuid;
  v_obs_count integer;
  v_candidate_count integer;
begin
  select id into v_task_id
  from public.product_fact_research_tasks
  where product_id = '10000000-0000-4000-8000-000000000009'::uuid
    and fact_key = 'uva_label';

  v_result := public.record_trust_research_result_v1(
    v_task_id,
    jsonb_build_object(
      'outcome','EVIDENCE_CANDIDATE',
      'source', jsonb_build_object(
        'source_binding_id','70000000-0000-4000-8000-000000000001',
        'source_kind','brand_official_product_page',
        'digest_basis','live-page-bytes-v1',
        'source_content_digest',repeat('b',64),
        'observation_version','trust-research-observation-v1',
        'observed_at','2026-09-15T00:00:00Z',
        'fetched_at','2026-09-15T00:00:00Z',
        'observed_claim',jsonb_build_object(
          'matched_text','PA++++',
          'excerpt','Official label: SPF 50+ PA++++',
          'extractor','explicit-pa-label-v1'
        ),
        'product_identity_observation',jsonb_build_object(
          'product_id','10000000-0000-4000-8000-000000000009',
          'subject_id','30000000-0000-4000-8000-000000000009',
          'source_binding_id','70000000-0000-4000-8000-000000000001',
          'exact_catalog_product_binding',true
        )
      ),
      'candidate',jsonb_build_object(
        'normalized_value','PA++++',
        'evidence_class','product_claim',
        'confidence','high',
        'support_direction','supports',
        'negative_admissibility','not_applicable',
        'qualifier','{}'::jsonb
      )
    )
  );

  if v_result ->> 'outcome' <> 'EVIDENCE_CANDIDATE' then
    raise exception 'phase3_candidate_result_failed:%', v_result;
  end if;

  select state, source_observation_id, evidence_candidate_id
  into v_state, v_obs, v_candidate
  from public.product_fact_research_tasks where id = v_task_id;
  if v_state <> 'EVIDENCE_CANDIDATE' or v_obs is null or v_candidate is null then
    raise exception 'phase3_candidate_task_state_failed:%:%:%', v_state, v_obs, v_candidate;
  end if;

  select count(*) into v_obs_count from public.trust_source_observations where research_task_id = v_task_id;
  select count(*) into v_candidate_count from public.trust_evidence_candidates where research_task_id = v_task_id;
  if v_obs_count <> 1 or v_candidate_count <> 1 then
    raise exception 'phase3_candidate_cardinality_failed:%:%', v_obs_count, v_candidate_count;
  end if;

  -- Identical result delivery is idempotent after the task reached candidate state.
  v_result_replay := public.record_trust_research_result_v1(
    v_task_id,
    jsonb_build_object(
      'outcome','EVIDENCE_CANDIDATE',
      'source',jsonb_build_object('source_content_digest',repeat('b',64))
    )
  );
  if coalesce((v_result_replay ->> 'idempotent_replay')::boolean,false) is not true then
    raise exception 'phase3_candidate_replay_not_idempotent:%', v_result_replay;
  end if;

  select count(*) into v_obs_count from public.trust_source_observations where research_task_id = v_task_id;
  select count(*) into v_candidate_count from public.trust_evidence_candidates where research_task_id = v_task_id;
  if v_obs_count <> 1 or v_candidate_count <> 1 then
    raise exception 'phase3_candidate_replay_duplicated:%:%', v_obs_count, v_candidate_count;
  end if;
end;
$$;

-- A catalog third-party source cannot be promoted into a positive candidate.
do $$
declare
  v_task_id uuid;
  v_result jsonb;
  v_state text;
  v_blocker text;
  v_count integer;
begin
  select id into v_task_id
  from public.product_fact_research_tasks
  where product_id = '10000000-0000-4000-8000-000000000009'::uuid
    and fact_key = 'uv_filter_type';

  v_result := public.record_trust_research_result_v1(
    v_task_id,
    jsonb_build_object(
      'outcome','EVIDENCE_CANDIDATE',
      'source',jsonb_build_object(
        'source_binding_id','70000000-0000-4000-8000-000000000002',
        'source_kind','official_market_sales_page',
        'digest_basis','live-page-bytes-v1',
        'source_content_digest',repeat('c',64),
        'observation_version','trust-research-observation-v1',
        'observed_claim',jsonb_build_object('matched_text','mineral sunscreen'),
        'product_identity_observation',jsonb_build_object('exact_catalog_product_binding',true)
      ),
      'candidate',jsonb_build_object(
        'normalized_value','mineral',
        'evidence_class','product_claim',
        'confidence','high',
        'support_direction','supports',
        'negative_admissibility','not_applicable'
      )
    )
  );

  if v_result ->> 'outcome' <> 'SOURCE_BLOCKED' then
    raise exception 'phase3_third_party_positive_not_blocked:%', v_result;
  end if;
  select state, blocker_code into v_state, v_blocker from public.product_fact_research_tasks where id = v_task_id;
  if v_state <> 'BLOCKED' or v_blocker <> 'SOURCE_BLOCKED' then
    raise exception 'phase3_third_party_block_state_invalid:%:%', v_state, v_blocker;
  end if;
  select count(*) into v_count from public.trust_evidence_candidates where research_task_id = v_task_id;
  if v_count <> 0 then raise exception 'phase3_third_party_created_candidate:%', v_count; end if;
end;
$$;

-- Transient fetch failure is retryable; a later readable source with no strict
-- claim becomes EVIDENCE_INSUFFICIENT, not false/negative evidence.
do $$
declare
  v_task_id uuid;
  v_result jsonb;
  v_state text;
  v_blocker text;
  v_retry timestamptz;
begin
  select id into v_task_id
  from public.product_fact_research_tasks
  where product_id = '10000000-0000-4000-8000-000000000009'::uuid
    and fact_key = 'spf_value';

  v_result := public.record_trust_research_result_v1(
    v_task_id,
    jsonb_build_object('outcome','TRANSIENT_FAILURE','detail','fixture timeout','retry_after_seconds',60)
  );
  select state, blocker_code, next_retry_at into v_state, v_blocker, v_retry
  from public.product_fact_research_tasks where id = v_task_id;
  if v_state <> 'RESEARCH_PENDING' or v_blocker <> 'SOURCE_TRANSIENT_FAILURE' or v_retry is null then
    raise exception 'phase3_transient_retry_invalid:%:%:%', v_state, v_blocker, v_retry;
  end if;

  -- Advance only the operational retry clock in the fixture.
  update public.product_fact_research_tasks set next_retry_at = now() where id = v_task_id;
  perform public.claim_trust_research_tasks_v1(1, 300);

  v_result := public.record_trust_research_result_v1(
    v_task_id,
    jsonb_build_object(
      'outcome','EVIDENCE_INSUFFICIENT',
      'detail','Official source readable; no strict SPF label claim found. Missing is not false.'
    )
  );
  select state, blocker_code into v_state, v_blocker
  from public.product_fact_research_tasks where id = v_task_id;
  if v_state <> 'BLOCKED' or v_blocker <> 'EVIDENCE_INSUFFICIENT' then
    raise exception 'phase3_evidence_insufficient_invalid:%:%:%', v_state, v_blocker, v_result;
  end if;
end;
$$;

-- ACL, staging semantics, and governed authority must remain fail-closed.
do $$
declare
  b record;
  v_subjects integer;
  v_instances integer;
  v_current integer;
  v_confirmations integer;
  v_governed_evidence integer;
  v_recommendations integer;
  v_obs integer;
  v_candidates integer;
  v_acl text[];
begin
  select * into b from trust_phase3_baseline;
  select count(*) into v_subjects from public.product_fact_subjects;
  select count(*) into v_instances from public.product_fact_instances;
  select count(*) into v_current from public.product_fact_current;
  select count(*) into v_confirmations from public.product_fact_confirmations;
  select count(*) into v_governed_evidence from public.product_evidence_records;
  select count(*) into v_recommendations from public.recommendation_logs;
  select count(*) into v_obs from public.trust_source_observations;
  select count(*) into v_candidates from public.trust_evidence_candidates;

  if v_subjects <> b.subjects then raise exception 'phase3_mutated_subjects:%:%', b.subjects, v_subjects; end if;
  if v_instances <> b.fact_instances then raise exception 'phase3_mutated_fact_instances:%:%', b.fact_instances, v_instances; end if;
  if v_current <> b.current_rows then raise exception 'phase3_mutated_current:%:%', b.current_rows, v_current; end if;
  if v_confirmations <> b.confirmations then raise exception 'phase3_mutated_confirmations:%:%', b.confirmations, v_confirmations; end if;
  if v_governed_evidence <> b.governed_evidence then raise exception 'phase3_mutated_governed_evidence:%:%', b.governed_evidence, v_governed_evidence; end if;
  if v_recommendations <> b.recommendation_rows then raise exception 'phase3_mutated_recommendations:%:%', b.recommendation_rows, v_recommendations; end if;
  if v_obs <> 1 or v_candidates <> 1 then raise exception 'phase3_staging_cardinality_invalid:%:%', v_obs, v_candidates; end if;

  select proacl into v_acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='record_trust_research_result_v1';
  if v_acl::text like '%authenticated%' or v_acl::text like '%anon%' or v_acl::text like '%PUBLIC%' then
    raise exception 'phase3_result_rpc_acl_too_broad:%', v_acl;
  end if;
end;
$$;

select 'TRUST_PHASE3_RESEARCH_WORKER_RUNTIME_VERIFIED' as verification_result;
