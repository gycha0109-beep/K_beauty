\set ON_ERROR_STOP on

create temporary table phase7c_authority_baseline as
select
  (select count(*) from public.product_fact_subjects) subjects,
  (select count(*) from public.product_evidence_records) evidence,
  (select count(*) from public.product_fact_instances) instances,
  (select count(*) from public.product_fact_confirmations) confirmations,
  (select count(*) from public.product_fact_current) current_rows,
  (select count(*) from public.recommendation_logs) recommendations,
  (select count(*) from public.catalog_trust_intake) intakes,
  (select count(*) from public.product_fact_research_tasks) tasks;

do $phase7c$
declare
  v_ready jsonb;
  v_claim jsonb;
  v_reg jsonb;
  v_replay jsonb;
  v_result jsonb;
  v_event jsonb;
  v_processed jsonb;
  v_task_id uuid;
  v_wrong_market_rejected boolean := false;
  v_unauthorized_rejected boolean := false;
begin
  v_ready := public.preflight_trust_legacy_research_readiness_v1(200,null);

  if (v_ready->>'count')::integer <> 2
    or (v_ready->>'ready')::integer <> 0
    or (v_ready->>'official_source_required')::integer <> 2
    or (v_ready->>'subject_scope_blocked')::integer <> 0
    or (v_ready->>'identity_review_required')::integer <> 0
  then
    raise exception 'phase7c_initial_readiness_invalid:%',v_ready;
  end if;

  -- Existing uncontrolled *_official and Hwahae bindings must not make a
  -- legacy task claimable.
  v_claim := public.claim_trust_research_tasks_v1(25,300);
  if jsonb_array_length(v_claim) <> 0 then
    raise exception 'phase7c_unreviewed_source_claimed:%',v_claim;
  end if;

  -- Non-legacy variant behavior remains the Phase 3 behavior: not claimable.
  if (select state from public.product_fact_research_tasks
      where id='5c000000-0000-4000-8000-000000000011') <> 'RESEARCH_PENDING'
  then
    raise exception 'phase7c_nonlegacy_variant_behavior_changed';
  end if;

  begin
    perform public.admin_register_trust_official_source_binding_v1(
      '00000000-0000-4000-8000-000000000099',
      'phase7c-unauthorized-01',
      jsonb_build_object(
        'product_id','10000000-0000-4000-8000-000000000009',
        'subject_id','30000000-0000-4000-8000-000000000009',
        'source_name','fixture_reviewed_official',
        'source_kind','brand_official_product_page',
        'source_url','https://brand.example.test/products/legacy-9',
        'market_code','KR',
        'locale','ko-KR'
      )
    );
  exception when insufficient_privilege then
    v_unauthorized_rejected := true;
  end;
  if not v_unauthorized_rejected then
    raise exception 'phase7c_unauthorized_source_admission_not_rejected';
  end if;

  begin
    perform public.admin_register_trust_official_source_binding_v1(
      'a7000000-0000-4000-8000-000000000001',
      'phase7c-wrong-market-01',
      jsonb_build_object(
        'product_id','10000000-0000-4000-8000-000000000009',
        'subject_id','30000000-0000-4000-8000-000000000009',
        'source_name','fixture_reviewed_official',
        'source_kind','brand_official_product_page',
        'source_url','https://brand.example.test/products/legacy-9',
        'market_code','US',
        'locale','en-US'
      )
    );
  exception when check_violation then
    v_wrong_market_rejected := true;
  end;
  if not v_wrong_market_rejected then
    raise exception 'phase7c_wrong_market_source_admission_not_rejected';
  end if;

  v_reg := public.admin_register_trust_official_source_binding_v1(
    'a7000000-0000-4000-8000-000000000001',
    'phase7c-register-legacy-9',
    jsonb_build_object(
      'product_id','10000000-0000-4000-8000-000000000009',
      'subject_id','30000000-0000-4000-8000-000000000009',
      'source_name','fixture_reviewed_official',
      'source_kind','brand_official_product_page',
      'source_url','https://brand.example.test/products/legacy-9',
      'market_code','KR',
      'locale','ko-KR'
    )
  );
  if coalesce((v_reg->>'idempotent')::boolean,true) then
    raise exception 'phase7c_source_first_registration_not_new:%',v_reg;
  end if;

  v_replay := public.admin_register_trust_official_source_binding_v1(
    'a7000000-0000-4000-8000-000000000001',
    'phase7c-register-legacy-9-replay',
    jsonb_build_object(
      'product_id','10000000-0000-4000-8000-000000000009',
      'subject_id','30000000-0000-4000-8000-000000000009',
      'source_name','fixture_reviewed_official',
      'source_kind','brand_official_product_page',
      'source_url','https://brand.example.test/products/legacy-9',
      'market_code','KR',
      'locale','ko-KR'
    )
  );
  if not coalesce((v_replay->>'idempotent')::boolean,false)
    or v_replay->>'binding_id' <> v_reg->>'binding_id'
    or v_replay->>'review_id' <> v_reg->>'review_id'
  then
    raise exception 'phase7c_source_registration_replay_invalid:%',v_replay;
  end if;

  v_ready := public.preflight_trust_legacy_research_readiness_v1(200,null);
  if (v_ready->>'ready')::integer <> 1
    or (v_ready->>'official_source_required')::integer <> 1
  then
    raise exception 'phase7c_readiness_after_source_invalid:%',v_ready;
  end if;

  v_claim := public.claim_trust_research_tasks_v1(25,300);
  if jsonb_array_length(v_claim) <> 1
    or v_claim->0->>'product_id' <> '10000000-0000-4000-8000-000000000009'
    or jsonb_array_length(v_claim->0->'official_source_seeds') <> 1
    or v_claim->0->'official_source_seeds'->0->>'binding_method' <> 'trust_official_source_review_v1'
  then
    raise exception 'phase7c_legacy_variant_claim_invalid:%',v_claim;
  end if;

  v_task_id := (v_claim->0->>'task_id')::uuid;
  v_result := public.record_trust_research_result_v1(
    v_task_id,
    jsonb_build_object('outcome','SOURCE_BLOCKED','detail','fixture non-authoritative source-blocked result')
  );
  if v_result->>'outcome' <> 'SOURCE_BLOCKED'
    or (select blocker_code from public.product_fact_research_tasks where id=v_task_id) <> 'SOURCE_BLOCKED'
  then
    raise exception 'phase7c_variant_record_scope_rejected:%',v_result;
  end if;

  -- With the reviewed source still present, legacy MANUAL_RETRY requeues without
  -- invoking the generic Phase 2 resolver.
  v_event := public.request_trust_reentry_v1(
    'MANUAL_RETRY',
    '10000000-0000-4000-8000-000000000009',
    (select intake_id from public.product_fact_research_tasks where id=v_task_id),
    v_task_id,
    repeat('c',64),
    'a7000000-0000-4000-8000-000000000001',
    'phase7c-manual-retry-1',
    '{}'::jsonb
  );
  v_processed := public.process_trust_reentry_event_v1((v_event->>'event_id')::uuid);
  if v_processed->>'disposition' <> 'RESEARCH_REQUEUED'
    or v_processed->>'reason_code' <> 'LEGACY_MANUAL_RETRY_READY'
    or (select state from public.product_fact_research_tasks where id=v_task_id) <> 'RESEARCH_PENDING'
  then
    raise exception 'phase7c_legacy_manual_retry_invalid:%',v_processed;
  end if;

  if not exists (
    select 1 from public.catalog_trust_intake i
    where i.product_id='10000000-0000-4000-8000-000000000009'
      and i.subject_id='30000000-0000-4000-8000-000000000009'
      and i.market='KR'
      and i.identity_resolution_detail->>'variant_key'='fixture-legacy-variant'
      and i.identity_resolution_detail->>'formulation_revision_key'='fixture-legacy-formulation-v1'
      and i.identity_resolution_detail->>'market_inferred'='false'
  ) then
    raise exception 'phase7c_legacy_manual_retry_mutated_identity';
  end if;

  -- Product-level retry also preserves the legacy snapshot and does not call the
  -- generic resolver.
  v_event := public.request_trust_reentry_v1(
    'MANUAL_RETRY',
    '10000000-0000-4000-8000-000000000009',
    null,null,repeat('d',64),
    'a7000000-0000-4000-8000-000000000001',
    'phase7c-product-retry-1',
    '{}'::jsonb
  );
  v_processed := public.process_trust_reentry_event_v1((v_event->>'event_id')::uuid);
  if v_processed->>'disposition' <> 'NOOP'
    or v_processed->>'reason_code' <> 'LEGACY_IDENTITY_SNAPSHOT_PRESERVED'
  then
    raise exception 'phase7c_product_level_legacy_retry_invalid:%',v_processed;
  end if;

  -- Remove product 9 from claim competition after its regression is proven.
  update public.product_fact_research_tasks
  set state='ALREADY_COVERED',blocker_code=null,blocker_detail=null,updated_at=now()
  where id=v_task_id;

  -- NULL-market official source admission must preserve NULL exactly.
  v_reg := public.admin_register_trust_official_source_binding_v1(
    'a7000000-0000-4000-8000-000000000001',
    'phase7c-register-null-10',
    jsonb_build_object(
      'product_id','1c000000-0000-4000-8000-000000000010',
      'subject_id','3c000000-0000-4000-8000-000000000010',
      'source_name','fixture_global_reviewed_official',
      'source_kind','brand_official_product_page',
      'source_url','https://brand.example.test/products/global-10',
      'market_code',null,
      'locale','en'
    )
  );
  if coalesce((v_reg->>'idempotent')::boolean,true) then
    raise exception 'phase7c_null_market_source_registration_invalid:%',v_reg;
  end if;

  if not exists (
    select 1
    from public.product_source_bindings psb
    join public.trust_official_source_binding_reviews osr on osr.binding_id=psb.binding_id
    where psb.product_id='1c000000-0000-4000-8000-000000000010'
      and psb.market_code is null
      and osr.subject_market is null
      and osr.source_market is null
      and osr.scope_relation='equivalent'
      and osr.subject_id='3c000000-0000-4000-8000-000000000010'
      and osr.variant_key='fixture-global-variant'
      and osr.formulation_revision_key='fixture-global-formulation-v1'
  ) then
    raise exception 'phase7c_null_market_scope_not_preserved';
  end if;

  v_claim := public.claim_trust_research_tasks_v1(25,300);
  if jsonb_array_length(v_claim) <> 1
    or v_claim->0->>'product_id' <> '1c000000-0000-4000-8000-000000000010'
    or v_claim->0->'official_source_seeds'->0->>'market' is not null
  then
    raise exception 'phase7c_null_market_claim_invalid:%',v_claim;
  end if;

  v_result := public.record_trust_research_result_v1(
    (v_claim->0->>'task_id')::uuid,
    jsonb_build_object('outcome','SOURCE_BLOCKED','detail','fixture null-market scope regression')
  );
  if v_result->>'outcome' <> 'SOURCE_BLOCKED' then
    raise exception 'phase7c_null_market_record_scope_rejected:%',v_result;
  end if;

  -- Non-legacy variant remains pending even after all legacy readiness work.
  v_claim := public.claim_trust_research_tasks_v1(25,300);
  if jsonb_array_length(v_claim) <> 0
    or (select state from public.product_fact_research_tasks
        where id='5c000000-0000-4000-8000-000000000011') <> 'RESEARCH_PENDING'
  then
    raise exception 'phase7c_nonlegacy_variant_claim_behavior_changed:%',v_claim;
  end if;
end;
$phase7c$;

do $authority$
declare
  b record;
begin
  select * into b from phase7c_authority_baseline;

  if (select count(*) from public.product_fact_subjects) <> b.subjects
    or (select count(*) from public.product_evidence_records) <> b.evidence
    or (select count(*) from public.product_fact_instances) <> b.instances
    or (select count(*) from public.product_fact_confirmations) <> b.confirmations
    or (select count(*) from public.product_fact_current) <> b.current_rows
    or (select count(*) from public.recommendation_logs) <> b.recommendations
    or (select count(*) from public.catalog_trust_intake) <> b.intakes
    or (select count(*) from public.product_fact_research_tasks) <> b.tasks
  then
    raise exception 'phase7c_authority_or_queue_cardinality_mutation';
  end if;

  if (select count(*) from public.trust_official_source_binding_reviews) <> 2 then
    raise exception 'phase7c_review_bridge_cardinality_invalid';
  end if;

  if (select count(*) from public.admin_audit_logs
      where action='admin.trust.official_source_registered') <> 2 then
    raise exception 'phase7c_source_admission_audit_invalid';
  end if;

  if has_function_privilege(
      'anon','public.admin_register_trust_official_source_binding_v1(uuid,text,jsonb)','EXECUTE'
    )
    or has_function_privilege(
      'authenticated','public.admin_register_trust_official_source_binding_v1(uuid,text,jsonb)','EXECUTE'
    )
    or not has_function_privilege(
      'service_role','public.admin_register_trust_official_source_binding_v1(uuid,text,jsonb)','EXECUTE'
    )
    or has_function_privilege(
      'anon','public.preflight_trust_legacy_research_readiness_v1(integer,uuid)','EXECUTE'
    )
    or has_function_privilege(
      'authenticated','public.preflight_trust_legacy_research_readiness_v1(integer,uuid)','EXECUTE'
    )
    or not has_function_privilege(
      'service_role','public.preflight_trust_legacy_research_readiness_v1(integer,uuid)','EXECUTE'
    )
  then
    raise exception 'phase7c_function_acl_invalid';
  end if;

  if exists (
    select 1 from information_schema.role_table_grants
    where table_schema='public'
      and table_name='trust_official_source_binding_reviews'
      and grantee in ('PUBLIC','anon','authenticated','service_role')
  ) then
    raise exception 'phase7c_review_bridge_direct_grant_exposed';
  end if;
end;
$authority$;

select 'TRUST_PHASE7C_LEGACY_RESEARCH_READINESS_RUNTIME_VERIFIED' as verification_result;
