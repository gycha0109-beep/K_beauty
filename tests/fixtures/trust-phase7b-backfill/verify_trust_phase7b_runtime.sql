-- TRUST Phase 7-B isolated runtime fixture.
-- Exercises exact governed Subject materialization (including NULL market),
-- no-Subject review materialization, stale fingerprint rejection, replay
-- idempotency, pagination, and fail-closed Subject conflict handling.

insert into public.product_fact_definition_snapshots (
  registry_version, fact_key, definition, deprecated, value_type, definition_checksum
) values
  (
    'product-fact-registry-cross-category-v1',
    'low_ph',
    '{"domain_scope":["cleanser"]}'::jsonb,
    false,'boolean',repeat('a',64)
  ),
  (
    'product-fact-registry-cross-category-v1',
    'deep_cleansing',
    '{"domain_scope":["cleanser"]}'::jsonb,
    false,'boolean',repeat('b',64)
  ),
  (
    'product-fact-registry-cross-category-v1',
    'contains_active',
    '{"domain_scope":["treatment"]}'::jsonb,
    false,'boolean',repeat('c',64)
  ),
  (
    'product-fact-registry-cross-category-v1',
    'active_concentration',
    '{"domain_scope":["treatment"]}'::jsonb,
    false,'number',repeat('d',64)
  ),
  (
    'product-fact-registry-cross-category-v1',
    'recommended_use_frequency',
    '{"domain_scope":["treatment"]}'::jsonb,
    false,'text',repeat('e',64)
  )
on conflict (registry_version,fact_key) do update
set definition=excluded.definition,
    deprecated=excluded.deprecated,
    value_type=excluded.value_type,
    definition_checksum=excluded.definition_checksum;

insert into public.products (id,name,brand,category) values
  ('91000000-0000-4000-8000-000000000001','Legacy Governed Partial','Fixture','cleanser'),
  ('91000000-0000-4000-8000-000000000002','Legacy Subject Review','Fixture','treatment'),
  ('91000000-0000-4000-8000-000000000004','Legacy Governed Null Market','Fixture','cleanser');

insert into public.product_fact_subjects (
  subject_id,product_id,identity_status,current_state,market_applicability,variant_key,formulation_revision_key
) values
  (
    '92000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000001',
    'resolved','current','KR','standard','phase7b-cleanser-kr-v1'
  ),
  (
    '92000000-0000-4000-8000-000000000004',
    '91000000-0000-4000-8000-000000000004',
    'resolved','current',null,null,'phase7b-cleanser-global-v1'
  );

insert into public.product_fact_confirmations (confirmation_id)
values ('93000000-0000-4000-8000-000000000001');

insert into public.product_fact_instances (
  fact_instance_id,subject_id,registry_version,fact_key,proposition_key
) values (
  '94000000-0000-4000-8000-000000000001',
  '92000000-0000-4000-8000-000000000001',
  'product-fact-registry-cross-category-v1',
  'low_ph',
  'phase7b-cleanser-low-ph'
);

insert into public.product_fact_current (
  proposition_key,fact_instance_id,subject_id,confirmation_id
) values (
  'phase7b-cleanser-low-ph',
  '94000000-0000-4000-8000-000000000001',
  '92000000-0000-4000-8000-000000000001',
  '93000000-0000-4000-8000-000000000001'
);

create temporary table trust_phase7b_authority_baseline as
select
  (select count(*) from public.catalog_trust_intake) as intakes,
  (select count(*) from public.product_fact_research_tasks) as tasks,
  (select count(*) from public.product_fact_subjects) as subjects,
  (select count(*) from public.product_evidence_records) as evidence,
  (select count(*) from public.product_fact_instances) as instances,
  (select count(*) from public.product_fact_confirmations) as confirmations,
  (select count(*) from public.product_fact_current) as current_rows,
  (select count(*) from public.recommendation_logs) as recommendation_rows;

do $phase7b$
declare
  v_preflight jsonb;
  v_fingerprint text;
  v_page1 jsonb;
  v_page2 jsonb;
  v_replay jsonb;
  v_review jsonb;
  v_review_replay jsonb;
  v_cursor uuid;
  v_stale_rejected boolean := false;
  v_conflict_rejected boolean := false;
begin
  v_preflight := public.preflight_trust_legacy_catalog_backfill_v1(500,null);
  v_fingerprint := v_preflight->'batch'->>'fingerprint';

  if (v_preflight->'global_summary'->>'eligible_products')::integer <> 3
    or (v_preflight->'global_summary'->>'single_current_resolved_subject')::integer <> 2
    or (v_preflight->'global_summary'->>'no_subject')::integer <> 1
    or (v_preflight->'global_summary'->>'multiple_current_resolved_subjects')::integer <> 0
  then
    raise exception 'phase7b_initial_preflight_invalid:%',v_preflight->'global_summary';
  end if;

  if not exists (
    select 1
    from jsonb_array_elements(v_preflight->'batch'->'rows') r
    where r->>'product_id'='91000000-0000-4000-8000-000000000004'
      and r->'subject_projection'->>'projected_identity_state'='EXISTING_GOVERNED_SUBJECT'
      and r->'subject_projection'->>'market' is null
      and coalesce((r->'subject_projection'->>'market_inferred')::boolean,true)=false
  ) then
    raise exception 'phase7b_null_market_preflight_scope_invalid';
  end if;

  update public.products
  set name='Legacy Governed Partial Drifted'
  where id='91000000-0000-4000-8000-000000000001';

  begin
    perform public.materialize_trust_legacy_catalog_backfill_v1(
      v_fingerprint,'GOVERNED_SUBJECT',1,null
    );
  exception when sqlstate '40001' then
    v_stale_rejected := true;
  end;

  if not v_stale_rejected then
    raise exception 'phase7b_stale_fingerprint_not_rejected';
  end if;

  if (select count(*) from public.catalog_trust_intake) <>
     (select intakes from trust_phase7b_authority_baseline)
  then
    raise exception 'phase7b_stale_rejection_wrote_intake';
  end if;

  update public.products
  set name='Legacy Governed Partial'
  where id='91000000-0000-4000-8000-000000000001';

  v_preflight := public.preflight_trust_legacy_catalog_backfill_v1(500,null);
  if v_preflight->'batch'->>'fingerprint' <> v_fingerprint then
    raise exception 'phase7b_restored_fingerprint_mismatch';
  end if;

  v_page1 := public.materialize_trust_legacy_catalog_backfill_v1(
    v_fingerprint,'GOVERNED_SUBJECT',1,null
  );

  if (v_page1->'batch'->>'count')::integer <> 1
    or not (v_page1->'batch'->>'has_more')::boolean
    or (v_page1->'batch'->>'intakes_created')::integer <> 1
    or (v_page1->'batch'->>'tasks_created')::integer <> 2
    or (v_page1->'batch'->>'already_covered')::integer <> 1
    or (v_page1->'batch'->>'research_pending')::integer <> 1
    or coalesce((v_page1->>'product_fact_authority_mutation')::boolean,true)
    or coalesce((v_page1->>'recommendation_mutation')::boolean,true)
    or coalesce((v_page1->>'market_inference_performed')::boolean,true)
  then
    raise exception 'phase7b_governed_page1_invalid:%',v_page1;
  end if;

  v_cursor := (v_page1->'batch'->>'next_after_product_id')::uuid;
  if v_cursor is null then
    raise exception 'phase7b_governed_page1_cursor_missing';
  end if;

  v_page2 := public.materialize_trust_legacy_catalog_backfill_v1(
    v_fingerprint,'GOVERNED_SUBJECT',1,v_cursor
  );

  if (v_page2->'batch'->>'count')::integer <> 1
    or coalesce((v_page2->'batch'->>'has_more')::boolean,true)
    or v_page2->'batch'->>'next_after_product_id' is not null
    or (v_page2->'batch'->>'intakes_created')::integer <> 1
    or (v_page2->'batch'->>'tasks_created')::integer <> 2
    or (v_page2->'batch'->>'already_covered')::integer <> 0
    or (v_page2->'batch'->>'research_pending')::integer <> 2
  then
    raise exception 'phase7b_governed_page2_invalid:%',v_page2;
  end if;

  if not exists (
    select 1
    from public.catalog_trust_intake i
    where i.product_id='91000000-0000-4000-8000-000000000004'
      and i.subject_id='92000000-0000-4000-8000-000000000004'
      and i.market is null
      and i.identity_state='EXACT_SUBJECT_FOUND'
      and i.trust_state='RESEARCH_PENDING'
      and i.identity_resolution_detail->>'market_inferred'='false'
  ) then
    raise exception 'phase7b_null_market_subject_not_preserved';
  end if;

  v_replay := public.materialize_trust_legacy_catalog_backfill_v1(
    v_fingerprint,'GOVERNED_SUBJECT',100,null
  );

  if (v_replay->'batch'->>'count')::integer <> 2
    or (v_replay->'batch'->>'intakes_created')::integer <> 0
    or (v_replay->'batch'->>'intakes_replayed')::integer <> 2
    or (v_replay->'batch'->>'tasks_created')::integer <> 0
    or (v_replay->'batch'->>'tasks_replayed')::integer <> 4
    or coalesce((v_replay->>'writes_performed')::boolean,true)
  then
    raise exception 'phase7b_governed_replay_not_idempotent:%',v_replay;
  end if;

  v_review := public.materialize_trust_legacy_catalog_backfill_v1(
    v_fingerprint,'SUBJECT_REVIEW',100,null
  );

  if (v_review->'batch'->>'count')::integer <> 1
    or (v_review->'batch'->>'intakes_created')::integer <> 1
    or (v_review->'batch'->>'tasks_created')::integer <> 3
    or (v_review->'batch'->>'review_required')::integer <> 3
  then
    raise exception 'phase7b_subject_review_materialization_invalid:%',v_review;
  end if;

  if not exists (
    select 1
    from public.catalog_trust_intake i
    where i.product_id='91000000-0000-4000-8000-000000000002'
      and i.subject_id is null
      and i.market is null
      and i.identity_state='SUBJECT_CREATION_REQUIRED'
      and i.trust_state='REVIEW_REQUIRED'
      and i.identity_resolution_detail->>'market_inferred'='false'
  ) or (
    select count(*)
    from public.product_fact_research_tasks t
    where t.product_id='91000000-0000-4000-8000-000000000002'
      and t.subject_id is null
      and t.state='REVIEW_REQUIRED'
      and t.blocker_code='SUBJECT_CREATION_REQUIRED'
  ) <> 3 then
    raise exception 'phase7b_subject_review_state_invalid';
  end if;

  v_review_replay := public.materialize_trust_legacy_catalog_backfill_v1(
    v_fingerprint,'SUBJECT_REVIEW',100,null
  );
  if (v_review_replay->'batch'->>'intakes_created')::integer <> 0
    or (v_review_replay->'batch'->>'intakes_replayed')::integer <> 1
    or (v_review_replay->'batch'->>'tasks_created')::integer <> 0
    or (v_review_replay->'batch'->>'tasks_replayed')::integer <> 3
    or coalesce((v_review_replay->>'writes_performed')::boolean,true)
  then
    raise exception 'phase7b_subject_review_replay_not_idempotent:%',v_review_replay;
  end if;

  insert into public.products (id,name,brand,category)
  values ('91000000-0000-4000-8000-000000000003','Legacy Conflict','Fixture','cleanser');

  insert into public.product_fact_subjects (
    subject_id,product_id,identity_status,current_state,market_applicability,variant_key,formulation_revision_key
  ) values
    (
      '92000000-0000-4000-8000-000000000031',
      '91000000-0000-4000-8000-000000000003',
      'resolved','current','KR','a','phase7b-conflict-a'
    ),
    (
      '92000000-0000-4000-8000-000000000032',
      '91000000-0000-4000-8000-000000000003',
      'resolved','current','KR','b','phase7b-conflict-b'
    );

  v_preflight := public.preflight_trust_legacy_catalog_backfill_v1(500,null);

  begin
    perform public.materialize_trust_legacy_catalog_backfill_v1(
      v_preflight->'batch'->>'fingerprint','GOVERNED_SUBJECT',100,null
    );
  exception when check_violation then
    v_conflict_rejected := true;
  end;

  if not v_conflict_rejected then
    raise exception 'phase7b_subject_conflict_not_rejected';
  end if;

  delete from public.product_fact_subjects
  where product_id='91000000-0000-4000-8000-000000000003';
  delete from public.products
  where id='91000000-0000-4000-8000-000000000003';
end;
$phase7b$;

do $authority$
declare
  b record;
begin
  select * into b from trust_phase7b_authority_baseline;

  if (select count(*) from public.catalog_trust_intake) <> b.intakes + 3 then
    raise exception 'phase7b_intake_cardinality_invalid';
  end if;
  if (select count(*) from public.product_fact_research_tasks) <> b.tasks + 7 then
    raise exception 'phase7b_task_cardinality_invalid';
  end if;
  if (select count(*) from public.product_fact_subjects) <> b.subjects then
    raise exception 'phase7b_subject_authority_mutation';
  end if;
  if (select count(*) from public.product_evidence_records) <> b.evidence then
    raise exception 'phase7b_evidence_authority_mutation';
  end if;
  if (select count(*) from public.product_fact_instances) <> b.instances then
    raise exception 'phase7b_instance_authority_mutation';
  end if;
  if (select count(*) from public.product_fact_confirmations) <> b.confirmations then
    raise exception 'phase7b_confirmation_authority_mutation';
  end if;
  if (select count(*) from public.product_fact_current) <> b.current_rows then
    raise exception 'phase7b_current_authority_mutation';
  end if;
  if (select count(*) from public.recommendation_logs) <> b.recommendation_rows then
    raise exception 'phase7b_recommendation_mutation';
  end if;

  if (
    select count(*)
    from public.product_fact_research_tasks t
    where t.product_id in (
      '91000000-0000-4000-8000-000000000001',
      '91000000-0000-4000-8000-000000000004'
    )
      and t.state='RESEARCH_PENDING'
  ) <> 3 then
    raise exception 'phase7b_research_pending_count_invalid';
  end if;

  if (
    select count(*)
    from public.product_fact_research_tasks t
    where t.product_id='91000000-0000-4000-8000-000000000001'
      and t.state='ALREADY_COVERED'
      and t.fact_key='low_ph'
  ) <> 1 then
    raise exception 'phase7b_already_covered_not_preserved';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.materialize_trust_legacy_catalog_backfill_v1(text,text,integer,uuid)',
    'EXECUTE'
  ) or has_function_privilege(
    'anon',
    'public.materialize_trust_legacy_catalog_backfill_v1(text,text,integer,uuid)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.materialize_trust_legacy_catalog_backfill_v1(text,text,integer,uuid)',
    'EXECUTE'
  ) then
    raise exception 'phase7b_function_acl_invalid';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname='materialize_trust_legacy_catalog_backfill_v1'
      and p.provolatile='v'
      and p.prosecdef
      and p.proconfig @> array['search_path=public, extensions, pg_temp']::text[]
  ) then
    raise exception 'phase7b_function_security_shape_invalid';
  end if;
end;
$authority$;

select 'TRUST_PHASE7B_LEGACY_BACKFILL_MATERIALIZATION_RUNTIME_VERIFIED' as verification_result;
