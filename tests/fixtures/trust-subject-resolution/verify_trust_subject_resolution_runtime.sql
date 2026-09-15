do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.catalog_trust_intake;
  if v_count <> 0 then
    raise exception 'phase2_migration_backfilled_intake:%', v_count;
  end if;
  select count(*) into v_count from public.product_fact_research_tasks;
  if v_count <> 0 then
    raise exception 'phase2_migration_backfilled_tasks:%', v_count;
  end if;
end;
$$;

create temporary table trust_phase2_authority_baseline as
select
  (select count(*) from public.product_fact_subjects) as subjects,
  (select count(*) from public.product_fact_instances) as fact_instances,
  (select count(*) from public.product_fact_current) as current_rows,
  (select count(*) from public.product_fact_confirmations) as confirmations,
  (select count(*) from public.recommendation_logs) as recommendation_rows;

-- Promote all fixture candidates. Promotion must only enqueue intake.
select public.promote_product_candidate('20000000-0000-4000-8000-000000000001'::uuid, 'phase2-exact');
select public.promote_product_candidate('20000000-0000-4000-8000-000000000002'::uuid, 'phase2-missing');
select public.promote_product_candidate('20000000-0000-4000-8000-000000000003'::uuid, 'phase2-candidate');
select public.promote_product_candidate('20000000-0000-4000-8000-000000000004'::uuid, 'phase2-ambiguous');
select public.promote_product_candidate('20000000-0000-4000-8000-000000000005'::uuid, 'phase2-market');
select public.promote_product_candidate('20000000-0000-4000-8000-000000000006'::uuid, 'phase2-variant');
select public.promote_product_candidate('20000000-0000-4000-8000-000000000007'::uuid, 'phase2-formulation');
select public.promote_product_candidate('20000000-0000-4000-8000-000000000008'::uuid, 'phase2-late');

do $$
declare
  v_intakes integer;
  v_tasks integer;
begin
  select count(*) into v_intakes from public.catalog_trust_intake;
  select count(*) into v_tasks from public.product_fact_research_tasks;
  if v_intakes <> 8 then
    raise exception 'phase2_fixture_intake_count_invalid:%', v_intakes;
  end if;
  if v_tasks <> 0 then
    raise exception 'phase2_promotion_materialized_tasks:%', v_tasks;
  end if;
end;
$$;

-- Exact current/resolved exact-market Subject auto-links and preserves Current short-circuit.
select public.process_catalog_trust_product_v1('10000000-0000-4000-8000-000000000001'::uuid);

do $$
declare
  v_identity text;
  v_trust text;
  v_subject uuid;
  v_count integer;
begin
  select identity_state, trust_state, subject_id into v_identity, v_trust, v_subject
  from public.catalog_trust_intake
  where product_id = '10000000-0000-4000-8000-000000000001'::uuid;

  if v_identity <> 'EXACT_SUBJECT_FOUND'
    or v_trust <> 'RESEARCH_PENDING'
    or v_subject <> '30000000-0000-4000-8000-000000000001'::uuid then
    raise exception 'phase2_exact_subject_resolution_failed:%:%:%', v_identity, v_trust, v_subject;
  end if;

  select count(*) into v_count
  from public.product_fact_research_tasks
  where product_id = '10000000-0000-4000-8000-000000000001'::uuid
    and state = 'ALREADY_COVERED'
    and fact_key = 'spf_value';
  if v_count <> 1 then
    raise exception 'phase2_exact_current_short_circuit_failed:%', v_count;
  end if;
end;
$$;

-- Missing Subject escalates to controlled Subject creation instead of writing authority.
select public.process_catalog_trust_product_v1('10000000-0000-4000-8000-000000000002'::uuid);

do $$
declare
  v_identity text;
  v_trust text;
  v_count integer;
begin
  select identity_state, trust_state into v_identity, v_trust
  from public.catalog_trust_intake
  where product_id = '10000000-0000-4000-8000-000000000002'::uuid;
  if v_identity <> 'SUBJECT_CREATION_REQUIRED' or v_trust <> 'REVIEW_REQUIRED' then
    raise exception 'phase2_missing_subject_state_invalid:%:%', v_identity, v_trust;
  end if;

  select count(*) into v_count
  from public.product_fact_research_tasks
  where product_id = '10000000-0000-4000-8000-000000000002'::uuid
    and state = 'REVIEW_REQUIRED'
    and blocker_code = 'SUBJECT_CREATION_REQUIRED';
  if v_count <> 3 then
    raise exception 'phase2_missing_subject_tasks_invalid:%', v_count;
  end if;
end;
$$;

-- A single exact-market non-current Subject is only a candidate and never auto-links.
select public.process_catalog_trust_product_v1('10000000-0000-4000-8000-000000000003'::uuid);

do $$
declare
  v_identity text;
  v_trust text;
  v_subject uuid;
  v_candidate text;
begin
  select identity_state, trust_state, subject_id,
         identity_resolution_detail ->> 'candidate_subject_id'
    into v_identity, v_trust, v_subject, v_candidate
  from public.catalog_trust_intake
  where product_id = '10000000-0000-4000-8000-000000000003'::uuid;

  if v_identity <> 'SUBJECT_CANDIDATE_FOUND'
    or v_trust <> 'REVIEW_REQUIRED'
    or v_subject is not null
    or v_candidate <> '30000000-0000-4000-8000-000000000003' then
    raise exception 'phase2_subject_candidate_state_invalid:%:%:%:%', v_identity, v_trust, v_subject, v_candidate;
  end if;
end;
$$;

-- Upstream catalog ambiguity fails closed before Product Fact Subject reuse.
select public.process_catalog_trust_product_v1('10000000-0000-4000-8000-000000000004'::uuid);

do $$
declare
  v_identity text;
  v_trust text;
  v_count integer;
begin
  select identity_state, trust_state into v_identity, v_trust
  from public.catalog_trust_intake
  where product_id = '10000000-0000-4000-8000-000000000004'::uuid;
  if v_identity <> 'IDENTITY_BLOCKED' or v_trust <> 'BLOCKED' then
    raise exception 'phase2_upstream_ambiguous_not_blocked:%:%', v_identity, v_trust;
  end if;
  select count(*) into v_count
  from public.product_fact_research_tasks
  where product_id = '10000000-0000-4000-8000-000000000004'::uuid
    and state = 'BLOCKED'
    and blocker_code = 'IDENTITY_BLOCKED';
  if v_count <> 3 then
    raise exception 'phase2_upstream_ambiguous_tasks_invalid:%', v_count;
  end if;
end;
$$;

-- A Global/NULL Subject must not be transferred to a KR intake.
select public.process_catalog_trust_product_v1('10000000-0000-4000-8000-000000000005'::uuid);

do $$
declare
  v_identity text;
  v_trust text;
begin
  select identity_state, trust_state into v_identity, v_trust
  from public.catalog_trust_intake
  where product_id = '10000000-0000-4000-8000-000000000005'::uuid;
  if v_identity <> 'MARKET_CONFLICT' or v_trust <> 'BLOCKED' then
    raise exception 'phase2_market_conflict_not_blocked:%:%', v_identity, v_trust;
  end if;
end;
$$;

-- Multiple exact-market current variants with the same formulation fail closed.
select public.process_catalog_trust_product_v1('10000000-0000-4000-8000-000000000006'::uuid);

do $$
declare
  v_identity text;
begin
  select identity_state into v_identity
  from public.catalog_trust_intake
  where product_id = '10000000-0000-4000-8000-000000000006'::uuid;
  if v_identity <> 'VARIANT_CONFLICT' then
    raise exception 'phase2_variant_conflict_classification_failed:%', v_identity;
  end if;
end;
$$;

-- Multiple exact-market current formulation revisions fail closed before variant ambiguity.
select public.process_catalog_trust_product_v1('10000000-0000-4000-8000-000000000007'::uuid);

do $$
declare
  v_identity text;
begin
  select identity_state into v_identity
  from public.catalog_trust_intake
  where product_id = '10000000-0000-4000-8000-000000000007'::uuid;
  if v_identity <> 'FORMULATION_CONFLICT' then
    raise exception 'phase2_formulation_conflict_classification_failed:%', v_identity;
  end if;
end;
$$;

-- Missing -> governed Subject appears -> retry must reconcile the three pristine
-- identity placeholders instead of leaving duplicate active tasks.
select public.process_catalog_trust_product_v1('10000000-0000-4000-8000-000000000008'::uuid);

do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.product_fact_research_tasks
  where product_id = '10000000-0000-4000-8000-000000000008'::uuid
    and state = 'REVIEW_REQUIRED'
    and blocker_code = 'SUBJECT_CREATION_REQUIRED';
  if v_count <> 3 then
    raise exception 'phase2_late_subject_placeholder_setup_failed:%', v_count;
  end if;
end;
$$;

-- This insertion is test setup representing the separate governed admin Subject
-- registration path. The Phase 2 resolver itself must never perform this write.
insert into public.product_fact_subjects (
  subject_id, product_id, identity_status, current_state, market_applicability, variant_key, formulation_revision_key
) values (
  '30000000-0000-4000-8000-000000000008',
  '10000000-0000-4000-8000-000000000008',
  'resolved','current','KR','late-primary','late-formulation-v1'
);

select public.process_catalog_trust_product_v1('10000000-0000-4000-8000-000000000008'::uuid);
select public.process_catalog_trust_product_v1('10000000-0000-4000-8000-000000000008'::uuid);

do $$
declare
  v_identity text;
  v_subject uuid;
  v_count integer;
  v_bad integer;
begin
  select identity_state, subject_id into v_identity, v_subject
  from public.catalog_trust_intake
  where product_id = '10000000-0000-4000-8000-000000000008'::uuid;

  if v_identity <> 'EXACT_SUBJECT_FOUND'
    or v_subject <> '30000000-0000-4000-8000-000000000008'::uuid then
    raise exception 'phase2_late_subject_not_resolved:%:%', v_identity, v_subject;
  end if;

  select count(*) into v_count
  from public.product_fact_research_tasks
  where product_id = '10000000-0000-4000-8000-000000000008'::uuid;
  if v_count <> 3 then
    raise exception 'phase2_late_subject_task_duplicate:%', v_count;
  end if;

  select count(*) into v_bad
  from public.product_fact_research_tasks
  where product_id = '10000000-0000-4000-8000-000000000008'::uuid
    and (
      subject_id is distinct from '30000000-0000-4000-8000-000000000008'::uuid
      or state <> 'RESEARCH_PENDING'
      or blocker_code is not null
    );
  if v_bad <> 0 then
    raise exception 'phase2_late_subject_task_reconciliation_failed:%', v_bad;
  end if;
end;
$$;

-- Resolver/processor retries must not mutate governed authority or Recommendation data.
do $$
declare
  b record;
  v_subjects integer;
  v_instances integer;
  v_current integer;
  v_confirmations integer;
  v_recommendations integer;
begin
  select * into b from trust_phase2_authority_baseline;
  select count(*) into v_subjects from public.product_fact_subjects;
  select count(*) into v_instances from public.product_fact_instances;
  select count(*) into v_current from public.product_fact_current;
  select count(*) into v_confirmations from public.product_fact_confirmations;
  select count(*) into v_recommendations from public.recommendation_logs;

  if v_subjects <> b.subjects + 1 then
    raise exception 'phase2_created_or_deleted_subjects:%:%', b.subjects, v_subjects;
  end if;
  if v_instances <> b.fact_instances then
    raise exception 'phase2_mutated_fact_instances:%:%', b.fact_instances, v_instances;
  end if;
  if v_current <> b.current_rows then
    raise exception 'phase2_mutated_current:%:%', b.current_rows, v_current;
  end if;
  if v_confirmations <> b.confirmations then
    raise exception 'phase2_mutated_confirmations:%:%', b.confirmations, v_confirmations;
  end if;
  if v_recommendations <> b.recommendation_rows then
    raise exception 'phase2_mutated_recommendation_data:%:%', b.recommendation_rows, v_recommendations;
  end if;
end;
$$;

select 'TRUST_PHASE2_SUBJECT_RESOLUTION_RUNTIME_VERIFIED' as verification_result;
