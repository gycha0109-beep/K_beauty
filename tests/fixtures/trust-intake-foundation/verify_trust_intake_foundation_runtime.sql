do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.catalog_trust_intake;
  if v_count <> 0 then
    raise exception 'trust_intake_migration_backfilled_existing_catalog:%', v_count;
  end if;

  select count(*) into v_count from public.product_fact_research_tasks;
  if v_count <> 0 then
    raise exception 'trust_task_migration_backfilled_existing_catalog:%', v_count;
  end if;
end;
$$;

create temporary table trust_authority_baseline as
select
  (select count(*) from public.product_fact_subjects) as subjects,
  (select count(*) from public.product_fact_instances) as fact_instances,
  (select count(*) from public.product_fact_current) as current_rows,
  (select count(*) from public.product_fact_confirmations) as confirmations,
  (select count(*) from public.recommendation_logs) as recommendation_rows;

select public.promote_product_candidate(
  '20000000-0000-4000-8000-000000000001'::uuid,
  'fixture'
);

-- Promotion transaction must durably enqueue intake but must not materialize
-- Product Fact research tasks inside the catalog transaction.
do $$
declare
  v_intakes integer;
  v_tasks integer;
  v_state text;
begin
  select count(*) into v_intakes
  from public.catalog_trust_intake
  where product_id = '10000000-0000-4000-8000-000000000001'::uuid;
  select count(*) into v_tasks
  from public.product_fact_research_tasks
  where product_id = '10000000-0000-4000-8000-000000000001'::uuid;
  select trust_state into v_state
  from public.catalog_trust_intake
  where product_id = '10000000-0000-4000-8000-000000000001'::uuid;

  if v_intakes <> 1 then
    raise exception 'promotion_did_not_create_exactly_one_intake:%', v_intakes;
  end if;
  if v_tasks <> 0 then
    raise exception 'promotion_transaction_materialized_tasks:%', v_tasks;
  end if;
  if v_state <> 'PENDING' then
    raise exception 'promotion_intake_not_pending_before_processor:%', v_state;
  end if;
end;
$$;

select public.process_catalog_trust_product_v1(
  '10000000-0000-4000-8000-000000000001'::uuid
);

do $$
declare
  v_count integer;
  v_state text;
  v_identity text;
begin
  select count(*) into v_count
  from public.catalog_trust_intake
  where product_id = '10000000-0000-4000-8000-000000000001'::uuid;
  if v_count <> 1 then
    raise exception 'promotion_did_not_create_exactly_one_intake:%', v_count;
  end if;

  select trust_state, identity_state into v_state, v_identity
  from public.catalog_trust_intake
  where product_id = '10000000-0000-4000-8000-000000000001'::uuid;
  if v_state <> 'RESEARCH_PENDING' or v_identity <> 'EXACT_SUBJECT_FOUND' then
    raise exception 'unexpected_intake_state:%:%', v_state, v_identity;
  end if;

  select count(*) into v_count
  from public.product_fact_research_tasks
  where product_id = '10000000-0000-4000-8000-000000000001'::uuid;
  if v_count <> 3 then
    raise exception 'required_fact_policy_created_wrong_task_count:%', v_count;
  end if;

  select count(*) into v_count
  from public.product_fact_research_tasks
  where product_id = '10000000-0000-4000-8000-000000000001'::uuid
    and fact_key = 'spf_value'
    and state = 'ALREADY_COVERED';
  if v_count <> 1 then
    raise exception 'existing_current_not_short_circuited:%', v_count;
  end if;

  select count(*) into v_count
  from public.product_fact_research_tasks
  where product_id = '10000000-0000-4000-8000-000000000001'::uuid
    and fact_key in ('uva_label','uv_filter_type')
    and state = 'RESEARCH_PENDING';
  if v_count <> 2 then
    raise exception 'missing_facts_not_research_pending:%', v_count;
  end if;

  select count(*) into v_count
  from public.product_fact_research_tasks
  where fact_key not in ('spf_value','uva_label','uv_filter_type');
  if v_count <> 0 then
    raise exception 'required_fact_policy_leaked_unapproved_fact_keys:%', v_count;
  end if;
end;
$$;

-- Identical promotion retry and processor retry must not duplicate either intake or tasks.
select public.promote_product_candidate(
  '20000000-0000-4000-8000-000000000001'::uuid,
  'fixture-retry'
);
select public.process_catalog_trust_product_v1(
  '10000000-0000-4000-8000-000000000001'::uuid
);

do $$
declare
  v_intakes integer;
  v_tasks integer;
begin
  select count(*) into v_intakes from public.catalog_trust_intake
  where product_id = '10000000-0000-4000-8000-000000000001'::uuid;
  select count(*) into v_tasks from public.product_fact_research_tasks
  where product_id = '10000000-0000-4000-8000-000000000001'::uuid;
  if v_intakes <> 1 or v_tasks <> 3 then
    raise exception 'identical_retry_not_idempotent:intakes=% tasks=%', v_intakes, v_tasks;
  end if;
end;
$$;

-- A distinct catalog revision may create a new intake, but once an exact Subject
-- exists the subject/fact task identity must still be reused.
insert into public.product_candidates (
  id, source_name, service_category, review_status, matched_product_id
) values (
  '20000000-0000-4000-8000-000000000002','hwahae','sunscreen','approved',
  '10000000-0000-4000-8000-000000000001'
);

select public.promote_product_candidate(
  '20000000-0000-4000-8000-000000000002'::uuid,
  'fixture-second-revision'
);
select public.process_catalog_trust_product_v1(
  '10000000-0000-4000-8000-000000000001'::uuid
);

do $$
declare
  v_intakes integer;
  v_tasks integer;
begin
  select count(*) into v_intakes from public.catalog_trust_intake
  where product_id = '10000000-0000-4000-8000-000000000001'::uuid;
  select count(*) into v_tasks from public.product_fact_research_tasks
  where product_id = '10000000-0000-4000-8000-000000000001'::uuid;
  if v_intakes <> 2 then
    raise exception 'second_revision_intake_missing:%', v_intakes;
  end if;
  if v_tasks <> 3 then
    raise exception 'subject_scoped_tasks_duplicated_across_revisions:%', v_tasks;
  end if;
end;
$$;

-- A NULL/global Subject must not be auto-transferred to a KR intake.
insert into public.products (id, name, brand, category)
values ('10000000-0000-4000-8000-000000000002','Global Fixture Sunscreen','Fixture','sunscreen');

insert into public.product_fact_subjects (
  subject_id, product_id, identity_status, current_state, market_applicability
) values (
  '30000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000002',
  'resolved','current',null
);

insert into public.product_candidates (
  id, source_name, service_category, review_status, matched_product_id
) values (
  '20000000-0000-4000-8000-000000000003','hwahae','sunscreen','approved',
  '10000000-0000-4000-8000-000000000002'
);

select public.promote_product_candidate(
  '20000000-0000-4000-8000-000000000003'::uuid,
  'fixture-global-boundary'
);
select public.process_catalog_trust_product_v1(
  '10000000-0000-4000-8000-000000000002'::uuid
);

do $$
declare
  v_identity text;
  v_state text;
  v_count integer;
begin
  select identity_state, trust_state into v_identity, v_state
  from public.catalog_trust_intake
  where product_id = '10000000-0000-4000-8000-000000000002'::uuid;
  if v_identity <> 'PENDING' or v_state <> 'IDENTITY_RESOLVING' then
    raise exception 'global_subject_was_auto_applied_to_kr:%:%', v_identity, v_state;
  end if;

  select count(*) into v_count
  from public.product_fact_research_tasks
  where product_id = '10000000-0000-4000-8000-000000000002'::uuid
    and state = 'IDENTITY_PENDING';
  if v_count <> 3 then
    raise exception 'kr_identity_pending_task_count_invalid:%', v_count;
  end if;
end;
$$;

-- Phase 1 must not mutate governed Product Fact authority or Recommendation data.
do $$
declare
  b record;
  v_subjects integer;
  v_instances integer;
  v_current integer;
  v_confirmations integer;
  v_recommendations integer;
begin
  select * into b from trust_authority_baseline;

  -- One subject was inserted explicitly by this verifier for the market-boundary
  -- case; processing itself must not create any additional Subject.
  select count(*) into v_subjects from public.product_fact_subjects;
  select count(*) into v_instances from public.product_fact_instances;
  select count(*) into v_current from public.product_fact_current;
  select count(*) into v_confirmations from public.product_fact_confirmations;
  select count(*) into v_recommendations from public.recommendation_logs;

  if v_subjects <> b.subjects + 1 then
    raise exception 'phase1_created_or_deleted_subjects:%:%', b.subjects, v_subjects;
  end if;
  if v_instances <> b.fact_instances then
    raise exception 'phase1_mutated_fact_instances:%:%', b.fact_instances, v_instances;
  end if;
  if v_current <> b.current_rows then
    raise exception 'phase1_mutated_current:%:%', b.current_rows, v_current;
  end if;
  if v_confirmations <> b.confirmations then
    raise exception 'phase1_mutated_confirmations:%:%', b.confirmations, v_confirmations;
  end if;
  if v_recommendations <> b.recommendation_rows then
    raise exception 'phase1_mutated_recommendation_data:%:%', b.recommendation_rows, v_recommendations;
  end if;
end;
$$;

select 'TRUST_PHASE1_INTAKE_RUNTIME_VERIFIED' as verification_result;
