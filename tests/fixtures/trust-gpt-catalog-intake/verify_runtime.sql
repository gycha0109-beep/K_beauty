begin;

set local role anon;
do $test$
begin
  begin
    perform public.ingest_gpt_catalog_product_v1(
      'gpt-e2e-anon-denied-001',
      '{}'::jsonb
    );
    raise exception 'GPT_E2E_ANON_INGEST_ALLOWED';
  exception
    when insufficient_privilege then
      null;
  end;
end;
$test$;
reset role;

set local role authenticated;
do $test$
begin
  begin
    perform public.ingest_gpt_catalog_product_v1(
      'gpt-e2e-authenticated-denied-001',
      '{}'::jsonb
    );
    raise exception 'GPT_E2E_AUTHENTICATED_INGEST_ALLOWED';
  exception
    when insufficient_privilege then
      null;
  end;
end;
$test$;
reset role;

set local role service_role;

do $test$
declare
  v_payload jsonb;
  v_result jsonb;
  v_replay jsonb;
  v_status jsonb;
  v_claimed jsonb;
  v_unsupported jsonb;
  v_changed jsonb;
  v_other_payload jsonb;
  v_other_result jsonb;
  v_other_tasks_before jsonb;
  v_other_tasks_after jsonb;
  v_v2_probe_tasks_before jsonb;
  v_v2_probe_tasks_after jsonb;
  v_latest_registry text;
  v_task_count integer;
begin
  v_payload := jsonb_build_object(
    'contract_version','gpt-catalog-research-v1',
    'brand','GPT E2E Brand',
    'product_name','GPT E2E Daily Shield Sunscreen',
    'category','sunscreen',
    'market','KR',
    'locale','ko-KR',
    'official_url','https://official.example.test/products/gpt-e2e-daily-shield',
    'identity_evidence',jsonb_build_object(
      'providers',jsonb_build_array(
        jsonb_build_object(
          'provider','brand_official',
          'locator','https://official.example.test/products/gpt-e2e-daily-shield',
          'canonical_brand','GPT E2E Brand',
          'canonical_name','GPT E2E Daily Shield Sunscreen'
        ),
        jsonb_build_object(
          'provider','independent_reference',
          'locator','https://reference.example.test/products/gpt-e2e-daily-shield',
          'canonical_brand','GPT E2E Brand',
          'canonical_name','GPT E2E Daily Shield Sunscreen'
        )
      )
    ),
    'official_fetch',jsonb_build_object(
      'final_url','https://official.example.test/products/gpt-e2e-daily-shield',
      'content_digest',repeat('a',64),
      'content_type','text/html; charset=utf-8',
      'fetched_at',now()
    )
  );

  v_result := public.ingest_gpt_catalog_product_v1(
    'gpt-e2e-supported-sunscreen-001',
    v_payload
  );

  if v_result ->> 'state' <> 'TRUST_RESEARCH_READY'
     or nullif(v_result ->> 'candidate_id','') is null
     or nullif(v_result ->> 'product_id','') is null
     or nullif(v_result ->> 'intake_id','') is null
     or nullif(v_result ->> 'subject_id','') is null
     or nullif(v_result ->> 'source_binding_id','') is null
     or coalesce((v_result #>> '{authority,automatic_confirmation}')::boolean,true)
  then
    raise exception 'GPT_E2E_SUPPORTED_INGEST_FAILED:%', v_result;
  end if;

  reset role;

  select registry_version into v_latest_registry
  from public.product_fact_registry_versions
  order by effective_at desc nulls last, created_at desc
  limit 1;

  if v_latest_registry is distinct from 'product-fact-registry-cross-category-v2' then
    raise exception 'GPT_E2E_LATEST_REGISTRY_NOT_V2:%', v_latest_registry;
  end if;

  if (
    select count(*)::integer
    from public.product_fact_research_tasks
    where product_id = (v_result ->> 'product_id')::uuid
      and registry_version = 'product-fact-registry-cross-category-v1'
      and fact_key in ('spf_value','uva_label','uv_filter_type')
  ) <> 3
  or exists (
    select 1
    from public.product_fact_research_tasks
    where product_id = (v_result ->> 'product_id')::uuid
      and registry_version <> 'product-fact-registry-cross-category-v1'
  ) then
    raise exception 'GPT_E2E_REGISTRY_PIN_V1_FAILED:%', v_result;
  end if;

  select coalesce(
    jsonb_agg(jsonb_build_object(
      'id',id,
      'registry_version',registry_version,
      'fact_key',fact_key,
      'state',state,
      'attempt_count',attempt_count,
      'subject_id',subject_id,
      'updated_at',updated_at
    ) order by id),
    '[]'::jsonb
  )
  into v_v2_probe_tasks_before
  from public.product_fact_research_tasks
  where product_id = (v_result ->> 'product_id')::uuid;

  set local role service_role;

  begin
    perform public.process_catalog_trust_product_v3(
      (v_result ->> 'product_id')::uuid,
      'product-fact-registry-cross-category-v2'
    );
    raise exception 'GPT_E2E_V2_POLICY_PROBE_NOT_BLOCKED';
  exception
    when check_violation then
      null;
  end;

  reset role;

  select coalesce(
    jsonb_agg(jsonb_build_object(
      'id',id,
      'registry_version',registry_version,
      'fact_key',fact_key,
      'state',state,
      'attempt_count',attempt_count,
      'subject_id',subject_id,
      'updated_at',updated_at
    ) order by id),
    '[]'::jsonb
  )
  into v_v2_probe_tasks_after
  from public.product_fact_research_tasks
  where product_id = (v_result ->> 'product_id')::uuid;

  if v_v2_probe_tasks_after is distinct from v_v2_probe_tasks_before then
    raise exception 'GPT_E2E_V2_POLICY_FAIL_CLOSED_MUTATED_TASKS:%:%',
      v_v2_probe_tasks_before,
      v_v2_probe_tasks_after;
  end if;

  set local role service_role;

  v_replay := public.ingest_gpt_catalog_product_v1(
    'gpt-e2e-supported-sunscreen-001',
    v_payload
  );
  if coalesce((v_replay ->> 'idempotent')::boolean,false) is not true
     or v_replay ->> 'product_id' is distinct from v_result ->> 'product_id'
  then
    raise exception 'GPT_E2E_REPLAY_NOT_IDEMPOTENT:%', v_replay;
  end if;

  begin
    v_changed := jsonb_set(v_payload,'{product_name}','"GPT E2E Changed Product"'::jsonb);
    perform public.ingest_gpt_catalog_product_v1(
      'gpt-e2e-supported-sunscreen-001',
      v_changed
    );
    raise exception 'GPT_E2E_REQUEST_REUSE_CONFLICT_NOT_REJECTED';
  exception
    when unique_violation then
      null;
  end;

  v_status := public.read_catalog_trust_product_status_v1(
    (v_result ->> 'product_id')::uuid
  );
  select count(*)::integer into v_task_count
  from jsonb_array_elements(coalesce(v_status -> 'intakes','[]'::jsonb)) intake,
       jsonb_array_elements(coalesce(intake -> 'tasks','[]'::jsonb)) task
  where task ->> 'state' in ('RESEARCH_PENDING','ALREADY_COVERED');

  if v_task_count < 1 then
    raise exception 'GPT_E2E_NO_TRUST_TASKS:%', v_status;
  end if;

  v_other_payload := jsonb_build_object(
    'contract_version','gpt-catalog-research-v1',
    'brand','GPT E2E Isolation Brand',
    'product_name','GPT E2E Isolation Shield Sunscreen',
    'category','sunscreen',
    'market','KR',
    'locale','ko-KR',
    'official_url','https://official.example.test/products/gpt-e2e-isolation-shield',
    'identity_evidence',jsonb_build_object(
      'providers',jsonb_build_array(
        jsonb_build_object(
          'provider','brand_official',
          'locator','https://official.example.test/products/gpt-e2e-isolation-shield',
          'canonical_brand','GPT E2E Isolation Brand',
          'canonical_name','GPT E2E Isolation Shield Sunscreen'
        ),
        jsonb_build_object(
          'provider','independent_reference',
          'locator','https://reference.example.test/products/gpt-e2e-isolation-shield',
          'canonical_brand','GPT E2E Isolation Brand',
          'canonical_name','GPT E2E Isolation Shield Sunscreen'
        )
      )
    ),
    'official_fetch',jsonb_build_object(
      'final_url','https://official.example.test/products/gpt-e2e-isolation-shield',
      'content_digest',repeat('c',64),
      'content_type','text/html; charset=utf-8',
      'fetched_at',now()
    )
  );

  v_other_result := public.ingest_gpt_catalog_product_v1(
    'gpt-e2e-supported-sunscreen-isolation-001',
    v_other_payload
  );
  if v_other_result ->> 'state' <> 'TRUST_RESEARCH_READY'
     or nullif(v_other_result ->> 'product_id','') is null
  then
    raise exception 'GPT_E2E_ISOLATION_PRODUCT_SETUP_FAILED:%', v_other_result;
  end if;

  reset role;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',id,
        'state',state,
        'attempt_count',attempt_count,
        'next_retry_at',next_retry_at,
        'last_research_at',last_research_at,
        'blocker_code',blocker_code,
        'blocker_detail',blocker_detail,
        'updated_at',updated_at
      )
      order by id
    ),
    '[]'::jsonb
  )
  into v_other_tasks_before
  from public.product_fact_research_tasks
  where product_id = (v_other_result ->> 'product_id')::uuid;

  if jsonb_array_length(v_other_tasks_before) < 1 then
    raise exception 'GPT_E2E_ISOLATION_PRODUCT_TASKS_MISSING:%', v_other_result;
  end if;

  set local role service_role;

  v_claimed := public.claim_gpt_catalog_research_tasks_v1(
    (v_result ->> 'product_id')::uuid,
    25,
    300
  );
  if jsonb_typeof(v_claimed) <> 'array'
     or jsonb_array_length(v_claimed) < 1
     or exists (
       select 1
       from jsonb_array_elements(v_claimed) task
       where task ->> 'product_id' is distinct from v_result ->> 'product_id'
          or jsonb_array_length(coalesce(task -> 'official_source_seeds','[]'::jsonb)) <> 1
          or task #>> '{official_source_seeds,0,source_name}' <> 'gpt_official'
     )
  then
    raise exception 'GPT_E2E_SCOPED_CLAIM_FAILED:%', v_claimed;
  end if;

  reset role;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',id,
        'state',state,
        'attempt_count',attempt_count,
        'next_retry_at',next_retry_at,
        'last_research_at',last_research_at,
        'blocker_code',blocker_code,
        'blocker_detail',blocker_detail,
        'updated_at',updated_at
      )
      order by id
    ),
    '[]'::jsonb
  )
  into v_other_tasks_after
  from public.product_fact_research_tasks
  where product_id = (v_other_result ->> 'product_id')::uuid;

  set local role service_role;

  if v_other_tasks_after is distinct from v_other_tasks_before then
    raise exception 'GPT_E2E_CROSS_PRODUCT_TASK_MUTATION:%:%',
      v_other_tasks_before,
      v_other_tasks_after;
  end if;

  v_unsupported := public.ingest_gpt_catalog_product_v1(
    'gpt-e2e-unsupported-cushion-001',
    jsonb_build_object(
      'contract_version','gpt-catalog-research-v1',
      'brand','GPT E2E Makeup Brand',
      'product_name','GPT E2E Cushion',
      'category','foundation',
      'market','KR',
      'locale','ko-KR',
      'official_url','https://official.example.test/products/gpt-e2e-cushion',
      'identity_evidence',jsonb_build_object(
        'providers',jsonb_build_array(
          jsonb_build_object(
            'provider','brand_official',
            'locator','https://official.example.test/products/gpt-e2e-cushion',
            'canonical_brand','GPT E2E Makeup Brand',
            'canonical_name','GPT E2E Cushion'
          ),
          jsonb_build_object(
            'provider','independent_reference',
            'locator','https://reference.example.test/products/gpt-e2e-cushion',
            'canonical_brand','GPT E2E Makeup Brand',
            'canonical_name','GPT E2E Cushion'
          )
        )
      ),
      'official_fetch',jsonb_build_object(
        'final_url','https://official.example.test/products/gpt-e2e-cushion',
        'content_digest',repeat('b',64),
        'content_type','text/html; charset=utf-8',
        'fetched_at',now()
      )
    )
  );

  if v_unsupported ->> 'state' <> 'BLOCKED_UNSUPPORTED_CATEGORY'
     or v_unsupported ->> 'blocker_code' <> 'UNSUPPORTED_TRUST_CATEGORY'
     or v_unsupported ? 'product_id'
  then
    raise exception 'GPT_E2E_UNSUPPORTED_NOT_BLOCKED:%', v_unsupported;
  end if;

  v_status := public.read_gpt_catalog_intake_run_v1(
    'gpt-e2e-unsupported-cushion-001'
  );
  if v_status ->> 'state' <> 'BLOCKED_UNSUPPORTED_CATEGORY' then
    raise exception 'GPT_E2E_UNSUPPORTED_BLOCKER_NOT_PERSISTED:%', v_status;
  end if;
end;
$test$;

reset role;
rollback;

select jsonb_build_object(
  'contract','trust-gpt-catalog-intake-isolated-sql-e2e-v1',
  'result','PASS',
  'automatic_confirmation',false,
  'unsupported_makeup_activation',false,
  'authenticated_ingest_denied',true,
  'cross_product_claim_isolation',true,
  'latest_registry_v2',true,
  'gpt_registry_pinned_v1',true,
  'v2_policy_missing_fail_closed',true
) as result;
