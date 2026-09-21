\set ON_ERROR_STOP on

create temporary table trust_phase8e_context as
select
  tr.transition_id,
  tr.assignment_id,
  tr.proposition_key,
  tr.fact_instance_id,
  tr.confirmation_id,
  rb.bridge_id,
  rb.research_task_id,
  rt.evidence_candidate_id as candidate_id
from public.product_fact_revalidation_transitions tr
join public.product_fact_revalidation_research_bridges rb
  on rb.transition_id = tr.transition_id
join public.product_fact_research_tasks rt
  on rt.id = rb.research_task_id
where tr.request_id = 'phase8c-revalidate-0001'
  and rb.disposition = 'RESEARCH_REQUEUED'
limit 1;

do $$
declare
  v_ctx record;
  v_preflight jsonb;
  v_result jsonb;
  v_replay jsonb;
  v_fact_count bigint;
  v_current_count bigint;
  v_confirmation_count bigint;
  v_current_fact uuid;
  v_current_confirmation uuid;
begin
  select * into v_ctx from trust_phase8e_context;
  if not found or v_ctx.candidate_id is null then
    raise exception 'phase8e_fixture_context_missing';
  end if;

  if (select operational_state
      from public.product_fact_review_assignments
      where assignment_id = v_ctx.assignment_id) <> 're_review_required' then
    raise exception 'phase8e_assignment_not_ready_for_adjudication';
  end if;

  select count(*) into v_fact_count from public.product_fact_instances;
  select count(*) into v_current_count from public.product_fact_current;
  select count(*) into v_confirmation_count from public.product_fact_confirmations;
  v_current_fact := v_ctx.fact_instance_id;
  v_current_confirmation := v_ctx.confirmation_id;

  v_preflight := public.admin_preflight_product_fact_revalidation_resolution_v1(
    '92000000-0000-4000-8000-000000000001',
    'phase8e-reaffirm-0001',
    v_ctx.transition_id,
    v_ctx.candidate_id
  );

  if v_preflight ->> 'status' <> 'same_semantic_reaffirmation_ready'
    or v_preflight ->> 'semantic_relation' <> 'SAME_SEMANTIC'
    or v_preflight ->> 'current_proposition_key' <> v_ctx.proposition_key
    or v_preflight ->> 'candidate_proposition_key' <> v_ctx.proposition_key
    or coalesce((v_preflight ->> 'current_pointer_changed')::boolean, true)
    or coalesce((v_preflight ->> 'fact_instance_mutated')::boolean, true)
    or coalesce((v_preflight ->> 'automatic_confirmation')::boolean, true)
    or (v_preflight ->> 'payload_digest') !~ '^[0-9a-f]{64}$'
    or (v_preflight ->> 'prestate_digest') !~ '^[0-9a-f]{64}$' then
    raise exception 'phase8e_preflight_invalid';
  end if;

  if (select count(*) from public.product_fact_instances) <> v_fact_count
    or (select count(*) from public.product_fact_current) <> v_current_count
    or (select count(*) from public.product_fact_confirmations) <> v_confirmation_count then
    raise exception 'phase8e_preflight_wrote_semantic_authority';
  end if;

  v_result := public.admin_reaffirm_product_fact_revalidation_v1(
    '92000000-0000-4000-8000-000000000001',
    'phase8e-reaffirm-0001',
    v_ctx.transition_id,
    v_ctx.candidate_id,
    v_preflight ->> 'payload_digest',
    v_preflight ->> 'prestate_digest'
  );

  if v_result ->> 'status' <> 'reaffirmed'
    or v_result ->> 'resolution_kind' <> 'SAME_SEMANTIC_REAFFIRMATION'
    or (v_result ->> 'fact_instance_id')::uuid <> v_current_fact
    or (v_result ->> 'confirmation_id')::uuid <> v_current_confirmation
    or coalesce((v_result ->> 'current_pointer_changed')::boolean, true)
    or coalesce((v_result ->> 'fact_instance_mutated')::boolean, true)
    or coalesce((v_result ->> 'confirmation_created')::boolean, true)
    or coalesce((v_result ->> 'automatic_confirmation')::boolean, true)
    or nullif(v_result ->> 'evidence_id', '') is null then
    raise exception 'phase8e_reaffirm_result_invalid';
  end if;

  if (select operational_state
      from public.product_fact_review_assignments
      where assignment_id = v_ctx.assignment_id) <> 'confirmed' then
    raise exception 'phase8e_assignment_not_reaffirmed';
  end if;

  if (select fact_instance_id
      from public.product_fact_current
      where proposition_key = v_ctx.proposition_key) <> v_current_fact
    or (select confirmation_id
        from public.product_fact_current
        where proposition_key = v_ctx.proposition_key) <> v_current_confirmation
    or (select count(*) from public.product_fact_instances) <> v_fact_count
    or (select count(*) from public.product_fact_current) <> v_current_count
    or (select count(*) from public.product_fact_confirmations) <> v_confirmation_count then
    raise exception 'phase8e_reaffirm_mutated_semantic_authority';
  end if;

  if (select count(*)
      from public.product_fact_revalidation_resolutions
      where transition_id = v_ctx.transition_id
        and resolution_kind = 'SAME_SEMANTIC_REAFFIRMATION') <> 1 then
    raise exception 'phase8e_resolution_ledger_missing';
  end if;

  if not exists (
    select 1
    from public.product_evidence_records
    where evidence_id = (v_result ->> 'evidence_id')::uuid
      and proposition_key = v_ctx.proposition_key
  ) then
    raise exception 'phase8e_governed_evidence_missing';
  end if;

  if (select count(*)
      from public.product_fact_review_events
      where assignment_id = v_ctx.assignment_id
        and event_kind = 'revalidation_reaffirmed') <> 1 then
    raise exception 'phase8e_review_event_missing';
  end if;

  v_replay := public.admin_reaffirm_product_fact_revalidation_v1(
    '92000000-0000-4000-8000-000000000001',
    'phase8e-reaffirm-0001',
    v_ctx.transition_id,
    v_ctx.candidate_id,
    v_preflight ->> 'payload_digest',
    v_preflight ->> 'prestate_digest'
  );

  if coalesce((v_replay ->> 'idempotent')::boolean, false) is not true
    or (select count(*)
        from public.product_fact_revalidation_resolutions
        where transition_id = v_ctx.transition_id) <> 1
    or (select count(*) from public.product_fact_instances) <> v_fact_count
    or (select count(*) from public.product_fact_current) <> v_current_count
    or (select count(*) from public.product_fact_confirmations) <> v_confirmation_count then
    raise exception 'phase8e_reaffirm_replay_not_idempotent';
  end if;
end;
$$;

do $$
begin
  if not (
    select relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'product_fact_revalidation_resolutions'
  ) then
    raise exception 'phase8e_resolution_rls_missing';
  end if;

  if has_table_privilege('anon','public.product_fact_revalidation_resolutions','SELECT')
    or has_table_privilege('authenticated','public.product_fact_revalidation_resolutions','SELECT')
    or has_table_privilege('service_role','public.product_fact_revalidation_resolutions','INSERT')
    or has_table_privilege('service_role','public.product_fact_revalidation_resolutions','UPDATE')
    or has_table_privilege('service_role','public.product_fact_revalidation_resolutions','DELETE')
    or not has_table_privilege('service_role','public.product_fact_revalidation_resolutions','SELECT') then
    raise exception 'phase8e_resolution_acl_invalid';
  end if;

  if has_function_privilege(
      'anon',
      'public.admin_preflight_product_fact_revalidation_resolution_v1(uuid,text,uuid,uuid)',
      'EXECUTE'
    )
    or has_function_privilege(
      'authenticated',
      'public.admin_preflight_product_fact_revalidation_resolution_v1(uuid,text,uuid,uuid)',
      'EXECUTE'
    )
    or not has_function_privilege(
      'service_role',
      'public.admin_preflight_product_fact_revalidation_resolution_v1(uuid,text,uuid,uuid)',
      'EXECUTE'
    )
    or has_function_privilege(
      'anon',
      'public.admin_reaffirm_product_fact_revalidation_v1(uuid,text,uuid,uuid,text,text)',
      'EXECUTE'
    )
    or has_function_privilege(
      'authenticated',
      'public.admin_reaffirm_product_fact_revalidation_v1(uuid,text,uuid,uuid,text,text)',
      'EXECUTE'
    )
    or not has_function_privilege(
      'service_role',
      'public.admin_reaffirm_product_fact_revalidation_v1(uuid,text,uuid,uuid,text,text)',
      'EXECUTE'
    )
    or has_function_privilege(
      'service_role',
      'public.trust_phase8e_build_revalidation_plan_v1(uuid,uuid,uuid)',
      'EXECUTE'
    ) then
    raise exception 'phase8e_resolution_rpc_acl_invalid';
  end if;
end;
$$;

select 'TRUST_PHASE8E_REVALIDATION_ADJUDICATION_RUNTIME_VERIFIED';
