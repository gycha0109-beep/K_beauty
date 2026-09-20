-- TRUST Phase 7-A isolated runtime fixture.
-- Adds three legacy products with no product_candidate lineage:
--  A: one governed current Subject and one of two required facts covered;
--  B: no Subject;
--  C: multiple current resolved Subjects (conflict).

insert into public.product_fact_definition_snapshots (
  registry_version, fact_key, definition, deprecated, value_type, definition_checksum
) values
  (
    'product-fact-registry-cross-category-v1',
    'low_ph',
    '{"domain_scope":["cleanser"]}'::jsonb,
    false,'boolean',repeat('4',64)
  ),
  (
    'product-fact-registry-cross-category-v1',
    'deep_cleansing',
    '{"domain_scope":["cleanser"]}'::jsonb,
    false,'boolean',repeat('5',64)
  ),
  (
    'product-fact-registry-cross-category-v1',
    'contains_active',
    '{"domain_scope":["treatment"]}'::jsonb,
    false,'boolean',repeat('6',64)
  ),
  (
    'product-fact-registry-cross-category-v1',
    'active_concentration',
    '{"domain_scope":["treatment"]}'::jsonb,
    false,'number',repeat('7',64)
  ),
  (
    'product-fact-registry-cross-category-v1',
    'recommended_use_frequency',
    '{"domain_scope":["treatment"]}'::jsonb,
    false,'text',repeat('8',64)
  )
on conflict (registry_version,fact_key) do update
set definition=excluded.definition,
    deprecated=excluded.deprecated,
    value_type=excluded.value_type,
    definition_checksum=excluded.definition_checksum;

insert into public.products (id,name,brand,category) values
  ('81000000-0000-4000-8000-000000000001','Legacy Covered Cleanser','Fixture','cleanser'),
  ('81000000-0000-4000-8000-000000000002','Legacy Missing Subject Treatment','Fixture','treatment'),
  ('81000000-0000-4000-8000-000000000003','Legacy Conflicting Sunscreen','Fixture','sunscreen');

insert into public.product_fact_subjects (
  subject_id,product_id,identity_status,current_state,market_applicability,variant_key,formulation_revision_key
) values
  (
    '82000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000001',
    'resolved','current','KR',null,'phase7a-cleanser-formulation-v1'
  ),
  (
    '82000000-0000-4000-8000-000000000031',
    '81000000-0000-4000-8000-000000000003',
    'resolved','current','KR','variant-a','phase7a-sunscreen-formulation-a'
  ),
  (
    '82000000-0000-4000-8000-000000000032',
    '81000000-0000-4000-8000-000000000003',
    'resolved','current','KR','variant-b','phase7a-sunscreen-formulation-b'
  );

insert into public.product_fact_confirmations (confirmation_id)
values ('83000000-0000-4000-8000-000000000001');

insert into public.product_fact_instances (
  fact_instance_id,subject_id,registry_version,fact_key,proposition_key
) values (
  '84000000-0000-4000-8000-000000000001',
  '82000000-0000-4000-8000-000000000001',
  'product-fact-registry-cross-category-v1',
  'low_ph',
  'phase7a-cleanser-low-ph'
);

insert into public.product_fact_current (
  proposition_key,fact_instance_id,subject_id,confirmation_id
) values (
  'phase7a-cleanser-low-ph',
  '84000000-0000-4000-8000-000000000001',
  '82000000-0000-4000-8000-000000000001',
  '83000000-0000-4000-8000-000000000001'
);

create temporary table trust_phase7a_authority_baseline as
select
  (select count(*) from public.catalog_trust_intake) as intakes,
  (select count(*) from public.product_fact_research_tasks) as tasks,
  (select count(*) from public.product_fact_subjects) as subjects,
  (select count(*) from public.product_evidence_records) as evidence,
  (select count(*) from public.product_fact_instances) as instances,
  (select count(*) from public.product_fact_confirmations) as confirmations,
  (select count(*) from public.product_fact_current) as current_rows,
  (select count(*) from public.recommendation_logs) as recommendation_rows;

do $phase7a$
declare
  v_first jsonb;
  v_second jsonb;
  v_page1 jsonb;
  v_page2 jsonb;
  v_cursor uuid;
  v_rows jsonb;
  v_row_a jsonb;
  v_row_b jsonb;
  v_row_c jsonb;
begin
  v_first := public.preflight_trust_legacy_catalog_backfill_v1(200,null);
  v_second := public.preflight_trust_legacy_catalog_backfill_v1(200,null);

  if v_first <> v_second then
    raise exception 'phase7a_preflight_not_deterministic';
  end if;

  if v_first->>'status' <> 'preflight'
    or v_first->>'phase' <> '7-A'
    or coalesce((v_first->>'writes_performed')::boolean,true)
    or coalesce((v_first->>'market_inference_performed')::boolean,true)
  then
    raise exception 'phase7a_preflight_envelope_invalid:%',v_first;
  end if;

  if (v_first->'global_summary'->>'eligible_products')::integer <> 3
    or (v_first->'global_summary'->>'no_subject')::integer <> 1
    or (v_first->'global_summary'->>'single_current_resolved_subject')::integer <> 1
    or (v_first->'global_summary'->>'no_current_resolved_subject')::integer <> 1
    or (v_first->'global_summary'->>'multiple_current_resolved_subjects')::integer <> 1
    or (v_first->'global_summary'->>'noncurrent_subject_only')::integer <> 0
  then
    raise exception 'phase7a_global_summary_invalid:%',v_first->'global_summary';
  end if;

  if (v_first->'batch'->>'count')::integer <> 3
    or coalesce((v_first->'batch'->>'has_more')::boolean,true)
    or v_first->'batch'->>'next_after_product_id' is not null
  then
    raise exception 'phase7a_batch_count_or_terminal_cursor_invalid:%',v_first->'batch';
  end if;

  v_rows := v_first->'batch'->'rows';

  select value into v_row_a
  from jsonb_array_elements(v_rows)
  where value->>'product_id'='81000000-0000-4000-8000-000000000001';

  select value into v_row_b
  from jsonb_array_elements(v_rows)
  where value->>'product_id'='81000000-0000-4000-8000-000000000002';

  select value into v_row_c
  from jsonb_array_elements(v_rows)
  where value->>'product_id'='81000000-0000-4000-8000-000000000003';

  if v_row_a is null or v_row_b is null or v_row_c is null then
    raise exception 'phase7a_expected_rows_missing';
  end if;

  if v_row_a->'subject_projection'->>'projected_identity_state' <> 'EXISTING_GOVERNED_SUBJECT'
    or v_row_a->'subject_projection'->>'subject_id' <> '82000000-0000-4000-8000-000000000001'
    or v_row_a->'subject_projection'->>'market' <> 'KR'
    or coalesce((v_row_a->'subject_projection'->>'market_inferred')::boolean,true)
    or (v_row_a->'trust_projection'->>'already_covered_count')::integer <> 1
    or (v_row_a->'trust_projection'->>'research_required_count')::integer <> 1
    or v_row_a->'trust_projection'->>'projected_trust_state' <> 'RESEARCH_PENDING'
    or length(v_row_a->>'catalog_revision') <> 64
  then
    raise exception 'phase7a_existing_subject_projection_invalid:%',v_row_a;
  end if;

  if not exists (
    select 1
    from jsonb_array_elements(v_row_a->'trust_projection'->'required_facts') f
    where f->>'fact_key'='low_ph'
      and f->>'projected_state'='ALREADY_COVERED'
      and f->>'blocker_code' is null
  ) or not exists (
    select 1
    from jsonb_array_elements(v_row_a->'trust_projection'->'required_facts') f
    where f->>'fact_key'='deep_cleansing'
      and f->>'projected_state'='RESEARCH_REQUIRED'
      and f->>'blocker_code' is null
  ) then
    raise exception 'phase7a_current_projection_fact_states_invalid:%',v_row_a;
  end if;

  if v_row_b->'subject_projection'->>'projected_identity_state' <> 'SUBJECT_CREATION_REQUIRED'
    or v_row_b->'subject_projection'->>'market' is not null
    or v_row_b->'trust_projection'->>'projected_trust_state' <> 'REVIEW_REQUIRED'
    or (v_row_b->'trust_projection'->>'subject_creation_required_count')::integer <> 3
    or (v_row_b->'trust_projection'->>'review_required_count')::integer <> 3
    or exists (
      select 1
      from jsonb_array_elements(v_row_b->'trust_projection'->'required_facts') f
      where f->>'projected_state' <> 'REVIEW_REQUIRED'
         or f->>'blocker_code' <> 'SUBJECT_CREATION_REQUIRED'
    )
  then
    raise exception 'phase7a_missing_subject_projection_invalid:%',v_row_b;
  end if;

  if v_row_c->'subject_projection'->>'projected_identity_state' <> 'SUBJECT_CONFLICT'
    or v_row_c->'trust_projection'->>'projected_trust_state' <> 'REVIEW_REQUIRED'
    or (v_row_c->'trust_projection'->>'review_required_count')::integer <> 3
    or exists (
      select 1
      from jsonb_array_elements(v_row_c->'trust_projection'->'required_facts') f
      where f->>'projected_state' <> 'REVIEW_REQUIRED'
         or f->>'blocker_code' <> 'SUBJECT_CONFLICT'
    )
  then
    raise exception 'phase7a_conflict_projection_invalid:%',v_row_c;
  end if;

  if exists(
    select 1 from jsonb_array_elements(v_rows) r
    where r->>'product_id'='10000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'phase7a_candidate_lineage_not_excluded';
  end if;

  v_page1 := public.preflight_trust_legacy_catalog_backfill_v1(2,null);
  v_cursor := (v_page1->'batch'->>'next_after_product_id')::uuid;
  if (v_page1->'batch'->>'count')::integer <> 2
    or not (v_page1->'batch'->>'has_more')::boolean
    or v_cursor is null
  then
    raise exception 'phase7a_page1_invalid:%',v_page1->'batch';
  end if;

  v_page2 := public.preflight_trust_legacy_catalog_backfill_v1(2,v_cursor);
  if (v_page2->'batch'->>'count')::integer <> 1
    or coalesce((v_page2->'batch'->>'has_more')::boolean,true)
    or v_page2->'batch'->>'next_after_product_id' is not null
  then
    raise exception 'phase7a_page2_invalid:%',v_page2->'batch';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_page1->'batch'->'rows') a
    join jsonb_array_elements(v_page2->'batch'->'rows') b
      on a->>'product_id'=b->>'product_id'
  ) then
    raise exception 'phase7a_pagination_overlap';
  end if;
end;
$phase7a$;

do $authority$
declare
  b record;
begin
  select * into b from trust_phase7a_authority_baseline;
  if (select count(*) from public.catalog_trust_intake) <> b.intakes then raise exception 'phase7a_intake_write'; end if;
  if (select count(*) from public.product_fact_research_tasks) <> b.tasks then raise exception 'phase7a_task_write'; end if;
  if (select count(*) from public.product_fact_subjects) <> b.subjects then raise exception 'phase7a_subject_write'; end if;
  if (select count(*) from public.product_evidence_records) <> b.evidence then raise exception 'phase7a_evidence_write'; end if;
  if (select count(*) from public.product_fact_instances) <> b.instances then raise exception 'phase7a_instance_write'; end if;
  if (select count(*) from public.product_fact_confirmations) <> b.confirmations then raise exception 'phase7a_confirmation_write'; end if;
  if (select count(*) from public.product_fact_current) <> b.current_rows then raise exception 'phase7a_current_write'; end if;
  if (select count(*) from public.recommendation_logs) <> b.recommendation_rows then raise exception 'phase7a_recommendation_write'; end if;

  if not has_function_privilege(
    'service_role',
    'public.preflight_trust_legacy_catalog_backfill_v1(integer,uuid)',
    'EXECUTE'
  ) or has_function_privilege(
    'anon',
    'public.preflight_trust_legacy_catalog_backfill_v1(integer,uuid)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.preflight_trust_legacy_catalog_backfill_v1(integer,uuid)',
    'EXECUTE'
  ) then
    raise exception 'phase7a_function_acl_invalid';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname='preflight_trust_legacy_catalog_backfill_v1'
      and p.provolatile='s'
      and p.prosecdef
  ) then
    raise exception 'phase7a_function_must_be_stable_security_definer';
  end if;
end;
$authority$;

select 'TRUST_PHASE7A_LEGACY_BACKFILL_PREFLIGHT_RUNTIME_VERIFIED' as verification_result;
