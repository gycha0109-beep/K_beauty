-- Runs after the original Phase 2 runtime verification and after presentation
-- scope hardening. Existing fixture mutations are intentional test setup.

create temporary table trust_phase2_hardening_baseline as
select
  (select count(*) from public.product_fact_subjects) as subjects,
  (select count(*) from public.product_fact_instances) as fact_instances,
  (select count(*) from public.product_fact_current) as current_rows,
  (select count(*) from public.product_fact_confirmations) as confirmations,
  (select count(*) from public.recommendation_logs) as recommendation_rows;

-- Product 1 has a single current/resolved KR Subject, but it is variant-scoped.
-- Product + market therefore cannot prove exact presentation equivalence.
select public.process_catalog_trust_product_v1('10000000-0000-4000-8000-000000000001'::uuid);

do $$
declare
  v_identity text;
  v_trust text;
  v_subject uuid;
  v_reason text;
  v_count integer;
begin
  select identity_state, trust_state, subject_id,
         identity_resolution_detail ->> 'reason_code'
    into v_identity, v_trust, v_subject, v_reason
  from public.catalog_trust_intake
  where product_id = '10000000-0000-4000-8000-000000000001'::uuid
  order by created_at
  limit 1;

  if v_identity <> 'SUBJECT_CANDIDATE_FOUND'
    or v_trust <> 'REVIEW_REQUIRED'
    or v_subject is not null
    or v_reason <> 'presentation_relation_not_proven_for_variant_scoped_subject' then
    raise exception 'phase2_variant_scoped_subject_auto_linked:%:%:%:%',
      v_identity, v_trust, v_subject, v_reason;
  end if;

  select count(*) into v_count
  from public.product_fact_research_tasks
  where product_id = '10000000-0000-4000-8000-000000000001'::uuid
    and state = 'REVIEW_REQUIRED'
    and blocker_code = 'SUBJECT_CANDIDATE_FOUND';
  if v_count <> 3 then
    raise exception 'phase2_variant_scoped_tasks_not_review_required:%', v_count;
  end if;
end;
$$;

-- Product 8 received a governed Subject during the earlier runtime test. Its
-- variant scope is still not equivalent evidence for the catalog presentation.
select public.process_catalog_trust_product_v1('10000000-0000-4000-8000-000000000008'::uuid);

do $$
declare
  v_identity text;
  v_subject uuid;
  v_count integer;
begin
  select identity_state, subject_id into v_identity, v_subject
  from public.catalog_trust_intake
  where product_id = '10000000-0000-4000-8000-000000000008'::uuid;

  if v_identity <> 'SUBJECT_CANDIDATE_FOUND' or v_subject is not null then
    raise exception 'phase2_late_variant_subject_auto_linked:%:%', v_identity, v_subject;
  end if;

  select count(*) into v_count
  from public.product_fact_research_tasks
  where product_id = '10000000-0000-4000-8000-000000000008'::uuid;
  if v_count <> 3 then
    raise exception 'phase2_late_variant_subject_task_count_changed:%', v_count;
  end if;
end;
$$;

-- Product-level Subject scope (variant_key NULL) is the only automatic path in
-- Phase 2 until a governed presentation-equivalence relation is introduced.
insert into public.products (id, name, brand, category)
values ('10000000-0000-4000-8000-000000000009','Product Scoped Sunscreen','Fixture','sunscreen');

insert into public.product_candidates (
  id, source_name, service_category, review_status, matched_product_id,
  identity_resolution_state, identity_resolution_version, identity_resolution_evidence
) values (
  '20000000-0000-4000-8000-000000000009','hwahae','sunscreen','approved',
  '10000000-0000-4000-8000-000000000009','resolved',
  'crawler-identity-resolution-v1','{}'::jsonb
);

insert into public.product_fact_subjects (
  subject_id, product_id, identity_status, current_state, market_applicability,
  variant_key, formulation_revision_key
) values (
  '30000000-0000-4000-8000-000000000009',
  '10000000-0000-4000-8000-000000000009',
  'resolved','current','KR',null,'product-scope-formulation-v1'
);

select public.promote_product_candidate(
  '20000000-0000-4000-8000-000000000009'::uuid,
  'phase2-product-scope'
);
select public.process_catalog_trust_product_v1('10000000-0000-4000-8000-000000000009'::uuid);
select public.process_catalog_trust_product_v1('10000000-0000-4000-8000-000000000009'::uuid);

do $$
declare
  v_identity text;
  v_trust text;
  v_subject uuid;
  v_reason text;
  v_proven text;
  v_count integer;
begin
  select identity_state, trust_state, subject_id,
         identity_resolution_detail ->> 'reason_code',
         identity_resolution_detail ->> 'presentation_relation_proven'
    into v_identity, v_trust, v_subject, v_reason, v_proven
  from public.catalog_trust_intake
  where product_id = '10000000-0000-4000-8000-000000000009'::uuid;

  if v_identity <> 'EXACT_SUBJECT_FOUND'
    or v_trust <> 'RESEARCH_PENDING'
    or v_subject <> '30000000-0000-4000-8000-000000000009'::uuid
    or v_reason <> 'single_product_scoped_current_subject_exact_market'
    or v_proven <> 'true' then
    raise exception 'phase2_product_scoped_exact_path_failed:%:%:%:%:%',
      v_identity, v_trust, v_subject, v_reason, v_proven;
  end if;

  select count(*) into v_count
  from public.product_fact_research_tasks
  where product_id = '10000000-0000-4000-8000-000000000009'::uuid
    and subject_id = '30000000-0000-4000-8000-000000000009'::uuid
    and state = 'RESEARCH_PENDING';
  if v_count <> 3 then
    raise exception 'phase2_product_scoped_exact_tasks_invalid:%', v_count;
  end if;
end;
$$;

-- Final hardening must not mutate Product Fact semantic authority or Recommendation data.
do $$
declare
  b record;
  v_subjects integer;
  v_instances integer;
  v_current integer;
  v_confirmations integer;
  v_recommendations integer;
begin
  select * into b from trust_phase2_hardening_baseline;
  select count(*) into v_subjects from public.product_fact_subjects;
  select count(*) into v_instances from public.product_fact_instances;
  select count(*) into v_current from public.product_fact_current;
  select count(*) into v_confirmations from public.product_fact_confirmations;
  select count(*) into v_recommendations from public.recommendation_logs;

  if v_subjects <> b.subjects + 1 then
    raise exception 'phase2_hardening_created_or_deleted_subjects:%:%', b.subjects, v_subjects;
  end if;
  if v_instances <> b.fact_instances then
    raise exception 'phase2_hardening_mutated_fact_instances:%:%', b.fact_instances, v_instances;
  end if;
  if v_current <> b.current_rows then
    raise exception 'phase2_hardening_mutated_current:%:%', b.current_rows, v_current;
  end if;
  if v_confirmations <> b.confirmations then
    raise exception 'phase2_hardening_mutated_confirmations:%:%', b.confirmations, v_confirmations;
  end if;
  if v_recommendations <> b.recommendation_rows then
    raise exception 'phase2_hardening_mutated_recommendation_data:%:%', b.recommendation_rows, v_recommendations;
  end if;
end;
$$;

select 'TRUST_PHASE2_PRESENTATION_SCOPE_HARDENING_VERIFIED' as verification_result;
