-- TRUST Phase 8I-1 isolated fairness/runtime verification.
-- The Phase 6A/6B runtime regressions must run first in the same isolated DB.

create temporary table trust_phase8i1_authority_baseline as
select
  (select count(*) from public.product_fact_subjects) as subjects,
  (select count(*) from public.product_evidence_records) as governed_evidence,
  (select count(*) from public.product_fact_instances) as instances,
  (select count(*) from public.product_fact_confirmations) as confirmations,
  (select count(*) from public.product_fact_current) as current_rows,
  (select count(*) from public.recommendation_logs) as recommendations;

-- Basic state/security contract and invalid argument fail-closed behavior.
do $$
begin
  if not exists(
    select 1 from public.trust_reentry_detector_runtime_state
    where scanner_key='PHASE6B_INTAKE_FLEET'
      and cycle_number=0
      and cursor_created_at is null
      and cursor_intake_id is null
      and cycle_upper_created_at is null
      and cycle_upper_intake_id is null
  ) then
    raise exception 'phase8i1_initial_runtime_state_invalid';
  end if;

  if has_table_privilege('service_role','public.trust_reentry_detector_runtime_state','SELECT')
    or has_table_privilege('service_role','public.trust_reentry_detector_runtime_state','UPDATE')
    or has_table_privilege('anon','public.trust_reentry_detector_runtime_state','SELECT')
    or has_table_privilege('authenticated','public.trust_reentry_detector_runtime_state','SELECT')
  then
    raise exception 'phase8i1_runtime_state_acl_invalid';
  end if;

  if not has_function_privilege('service_role','public.run_trust_reentry_detectors_v2(integer)','EXECUTE')
    or has_function_privilege('anon','public.run_trust_reentry_detectors_v2(integer)','EXECUTE')
    or has_function_privilege('authenticated','public.run_trust_reentry_detectors_v2(integer)','EXECUTE')
    or has_function_privilege('public','public.run_trust_reentry_detectors_v2(integer)','EXECUTE')
  then
    raise exception 'phase8i1_v2_acl_invalid';
  end if;

  begin
    perform public.run_trust_reentry_detectors_v2(0);
    raise exception 'phase8i1_limit_zero_not_rejected';
  exception when sqlstate '22023' then null;
  end;

  begin
    perform public.run_trust_reentry_detectors_v2(1001);
    raise exception 'phase8i1_limit_1001_not_rejected';
  exception when sqlstate '22023' then null;
  end;

  begin
    update public.trust_reentry_detector_runtime_state
    set cursor_created_at=now(),cursor_intake_id=null
    where scanner_key='PHASE6B_INTAKE_FLEET';
    raise exception 'phase8i1_malformed_cursor_not_rejected';
  exception when check_violation then null;
  end;
end;
$$;

-- The v2 runner must preserve Phase 6-B detector semantics. A normal first
-- cycle over the existing fixture should emit no new event after the v1
-- regressions have already stabilized the same signals.
do $$
declare
  v_before bigint;
  v_run jsonb;
begin
  select count(*) into v_before from public.trust_reentry_events;
  v_run := public.run_trust_reentry_detectors_v2(1000);

  if (v_run->>'intakes_scanned')::integer < 1
    or not (v_run->>'cycle_started')::boolean
    or not (v_run->>'cycle_completed')::boolean
    or (v_run->>'remaining_in_cycle')::integer <> 0
    or (v_run->>'events_emitted')::integer <> 0
    or (select count(*) from public.trust_reentry_events) <> v_before
  then
    raise exception 'phase8i1_v1_v2_semantic_parity_invalid:%',v_run;
  end if;
end;
$$;

-- Build 205 intake rows with the same timestamp. This intentionally stresses
-- the UUID tie-breaker; created_at alone cannot be a valid cursor.
create temporary table trust_phase8i1_generated_intakes (
  id uuid primary key,
  ordinal integer not null unique
);

insert into trust_phase8i1_generated_intakes(id,ordinal)
select gen_random_uuid(),g
from generate_series(1,205) g;

insert into public.catalog_trust_intake (
  id,product_id,source_candidate_id,catalog_revision,category,market,subject_id,
  identity_state,trust_state,required_fact_policy_version,
  created_at,started_at,completed_at,last_checked_at,updated_at,
  identity_resolution_version,identity_resolution_detail
)
select
  g.id,
  t.product_id,
  t.source_candidate_id,
  'phase8i1-fairness-' || lpad(g.ordinal::text,4,'0'),
  t.category,
  t.market,
  t.subject_id,
  t.identity_state,
  t.trust_state,
  t.required_fact_policy_version,
  '2099-01-01 00:00:00+00'::timestamptz,
  null,null,null,
  '2099-01-01 00:00:00+00'::timestamptz,
  t.identity_resolution_version,
  t.identity_resolution_detail
from trust_phase8i1_generated_intakes g
cross join lateral (
  select *
  from public.catalog_trust_intake
  where catalog_revision not like 'phase8i1-%'
  order by created_at,id
  limit 1
) t;

create temporary table trust_phase8i1_scanned (
  cycle_label text not null,
  intake_id uuid not null
);

create temporary table trust_phase8i1_late_ids (
  id uuid primary key,
  kind text not null
);

-- Start a controlled active cycle immediately after the pre-existing fixture
-- rows and cap it at the max of the 205 generated rows.
do $$
declare
  v_cursor_created_at timestamptz;
  v_cursor_id uuid;
  v_upper_id uuid;
begin
  select created_at,id
  into v_cursor_created_at,v_cursor_id
  from public.catalog_trust_intake
  where id not in (select id from trust_phase8i1_generated_intakes)
  order by created_at desc,id desc
  limit 1;

  select id into v_upper_id
  from trust_phase8i1_generated_intakes
  order by id desc
  limit 1;

  update public.trust_reentry_detector_runtime_state
  set cycle_number=41,
      cursor_created_at=v_cursor_created_at,
      cursor_intake_id=v_cursor_id,
      cycle_upper_created_at='2099-01-01 00:00:00+00'::timestamptz,
      cycle_upper_intake_id=v_upper_id,
      active_cycle_started_at=now(),
      last_run_at=null,
      updated_at=now()
  where scanner_key='PHASE6B_INTAKE_FLEET';
end;
$$;

-- 100 + 100 + 5 must cover the 205-row frozen cycle exactly once.
do $$
declare
  r1 jsonb;
  r2 jsonb;
  r3 jsonb;
  v_future uuid := gen_random_uuid();
  v_backfill uuid := gen_random_uuid();
  t public.catalog_trust_intake%rowtype;
begin
  r1 := public.run_trust_reentry_detectors_v2(100);
  if (r1->>'intakes_scanned')::integer <> 100
    or (r1->>'remaining_in_cycle')::integer <> 105
    or (r1->>'cycle_completed')::boolean
  then
    raise exception 'phase8i1_batch1_invalid:%',r1;
  end if;
  insert into trust_phase8i1_scanned
  select 'frozen-cycle',value::uuid from jsonb_array_elements_text(r1->'scanned_intake_ids');

  r2 := public.run_trust_reentry_detectors_v2(100);
  if (r2->>'intakes_scanned')::integer <> 100
    or (r2->>'remaining_in_cycle')::integer <> 5
    or (r2->>'cycle_completed')::boolean
  then
    raise exception 'phase8i1_batch2_invalid:%',r2;
  end if;
  insert into trust_phase8i1_scanned
  select 'frozen-cycle',value::uuid from jsonb_array_elements_text(r2->'scanned_intake_ids');

  select * into t
  from public.catalog_trust_intake
  where id=(select id from trust_phase8i1_generated_intakes order by ordinal limit 1);

  -- Added beyond the frozen upper bound: must wait for the next cycle.
  insert into public.catalog_trust_intake (
    id,product_id,source_candidate_id,catalog_revision,category,market,subject_id,
    identity_state,trust_state,required_fact_policy_version,
    created_at,started_at,completed_at,last_checked_at,updated_at,
    identity_resolution_version,identity_resolution_detail
  ) values (
    v_future,t.product_id,t.source_candidate_id,'phase8i1-future-row',t.category,t.market,t.subject_id,
    t.identity_state,t.trust_state,t.required_fact_policy_version,
    '2099-01-02 00:00:00+00',null,null,null,'2099-01-02 00:00:00+00',
    t.identity_resolution_version,t.identity_resolution_detail
  );

  -- Added behind the current cursor after batch 2: must also wait until the
  -- next cycle rather than being lost forever.
  insert into public.catalog_trust_intake (
    id,product_id,source_candidate_id,catalog_revision,category,market,subject_id,
    identity_state,trust_state,required_fact_policy_version,
    created_at,started_at,completed_at,last_checked_at,updated_at,
    identity_resolution_version,identity_resolution_detail
  ) values (
    v_backfill,t.product_id,t.source_candidate_id,'phase8i1-backfill-row',t.category,t.market,t.subject_id,
    t.identity_state,t.trust_state,t.required_fact_policy_version,
    '2098-12-31 00:00:00+00',null,null,null,'2098-12-31 00:00:00+00',
    t.identity_resolution_version,t.identity_resolution_detail
  );

  insert into trust_phase8i1_late_ids values (v_future,'future'),(v_backfill,'backfill');

  r3 := public.run_trust_reentry_detectors_v2(100);
  if (r3->>'intakes_scanned')::integer <> 5
    or (r3->>'remaining_in_cycle')::integer <> 0
    or not (r3->>'cycle_completed')::boolean
    or r3->'cursor_after' <> 'null'::jsonb
  then
    raise exception 'phase8i1_batch3_invalid:%',r3;
  end if;
  insert into trust_phase8i1_scanned
  select 'frozen-cycle',value::uuid from jsonb_array_elements_text(r3->'scanned_intake_ids');

  if (select count(*) from trust_phase8i1_scanned where cycle_label='frozen-cycle') <> 205
    or (select count(distinct intake_id) from trust_phase8i1_scanned where cycle_label='frozen-cycle') <> 205
    or exists(
      select 1
      from trust_phase8i1_generated_intakes g
      where not exists(
        select 1 from trust_phase8i1_scanned s
        where s.cycle_label='frozen-cycle' and s.intake_id=g.id
      )
    )
    or exists(
      select 1 from trust_phase8i1_scanned s
      join trust_phase8i1_late_ids l on l.id=s.intake_id
      where s.cycle_label='frozen-cycle'
    )
  then
    raise exception 'phase8i1_frozen_cycle_coverage_invalid';
  end if;
end;
$$;

-- The next cycle must include both the future row and the behind-cursor
-- backfill row. Limit 1000 ensures this fixture cycle completes in one call.
do $$
declare
  v_run jsonb;
begin
  v_run := public.run_trust_reentry_detectors_v2(1000);
  insert into trust_phase8i1_scanned
  select 'next-cycle',value::uuid from jsonb_array_elements_text(v_run->'scanned_intake_ids');

  if not (v_run->>'cycle_started')::boolean
    or not (v_run->>'cycle_completed')::boolean
    or (v_run->>'remaining_in_cycle')::integer <> 0
    or (v_run->>'events_emitted')::integer <> 0
    or exists(
      select 1
      from trust_phase8i1_late_ids l
      where not exists(
        select 1 from trust_phase8i1_scanned s
        where s.cycle_label='next-cycle' and s.intake_id=l.id
      )
    )
  then
    raise exception 'phase8i1_next_cycle_eventual_coverage_invalid:%',v_run;
  end if;
end;
$$;

-- Runtime state must be reset after a completed cycle while retaining cycle
-- history. Product Fact and recommendation authority cardinality stay fixed.
do $$
declare
  b record;
begin
  if not exists(
    select 1
    from public.trust_reentry_detector_runtime_state
    where scanner_key='PHASE6B_INTAKE_FLEET'
      and cycle_number >= 42
      and cursor_created_at is null
      and cursor_intake_id is null
      and cycle_upper_created_at is null
      and cycle_upper_intake_id is null
      and active_cycle_started_at is null
      and last_cycle_completed_at is not null
  ) then
    raise exception 'phase8i1_completed_cycle_state_invalid';
  end if;

  select * into b from trust_phase8i1_authority_baseline;
  if (select count(*) from public.product_fact_subjects) <> b.subjects then raise exception 'phase8i1_subject_mutation'; end if;
  if (select count(*) from public.product_evidence_records) <> b.governed_evidence then raise exception 'phase8i1_evidence_mutation'; end if;
  if (select count(*) from public.product_fact_instances) <> b.instances then raise exception 'phase8i1_instance_mutation'; end if;
  if (select count(*) from public.product_fact_confirmations) <> b.confirmations then raise exception 'phase8i1_confirmation_mutation'; end if;
  if (select count(*) from public.product_fact_current) <> b.current_rows then raise exception 'phase8i1_current_mutation'; end if;
  if (select count(*) from public.recommendation_logs) <> b.recommendations then raise exception 'phase8i1_recommendation_mutation'; end if;
end;
$$;

select 'TRUST_PHASE8I1_FAIR_DETECTOR_RUNTIME_VERIFIED' as verification_result;
