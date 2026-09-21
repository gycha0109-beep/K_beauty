\set ON_ERROR_STOP on

create temporary table trust_phase8f_context as
select
  tr.transition_id,
  tr.assignment_id as old_assignment_id,
  tr.proposition_key as old_proposition_key,
  tr.fact_instance_id as old_fact_instance_id,
  tr.confirmation_id as old_confirmation_id,
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
  v_semantic_preflight jsonb;
  v_prepare jsonb;
  v_confirm jsonb;
  v_replay jsonb;
  v_fact_count bigint;
  v_current_count bigint;
  v_confirmation_count bigint;
  v_new_assignment uuid;
  v_new_fact uuid;
  v_new_confirmation uuid;
  v_new_proposition text;
begin
  select * into v_ctx from trust_phase8f_context;
  if not found or v_ctx.candidate_id is null then
    raise exception 'phase8f_context_missing';
  end if;

  select count(*) into v_fact_count from public.product_fact_instances;
  select count(*) into v_current_count from public.product_fact_current;
  select count(*) into v_confirmation_count from public.product_fact_confirmations;

  v_semantic_preflight :=
    public.admin_preflight_product_fact_revalidation_resolution_v1(
      '92000000-0000-4000-8000-000000000001',
      'phase8f-semantic-0001',
      v_ctx.transition_id,
      v_ctx.candidate_id
    );

  if v_semantic_preflight ->> 'status' <> 'semantic_change_review_required'
    or v_semantic_preflight ->> 'semantic_relation' <> 'SEMANTIC_CHANGE'
    or v_semantic_preflight ->> 'current_proposition_key'
       = v_semantic_preflight ->> 'candidate_proposition_key' then
    raise exception 'phase8f_semantic_change_not_detected';
  end if;

  if (select count(*) from public.product_fact_instances) <> v_fact_count
    or (select count(*) from public.product_fact_current) <> v_current_count
    or (select count(*) from public.product_fact_confirmations) <> v_confirmation_count then
    raise exception 'phase8f_semantic_preflight_wrote_authority';
  end if;

  v_prepare := public.admin_prepare_product_fact_revalidation_replacement_v1(
    '92000000-0000-4000-8000-000000000001',
    'phase8f-replace-0001',
    v_ctx.transition_id,
    v_ctx.candidate_id
  );

  if v_prepare ->> 'status' <> 'ready_for_explicit_replacement_confirmation'
    or coalesce((v_prepare ->> 'automatic_confirmation')::boolean, true)
    or v_prepare ->> 'old_proposition_key' <> v_ctx.old_proposition_key
    or v_prepare ->> 'new_proposition_key' = v_ctx.old_proposition_key
    or (v_prepare ->> 'confirmation_payload_digest') !~ '^[0-9a-f]{64}$'
    or (v_prepare ->> 'confirmation_prestate_digest') !~ '^[0-9a-f]{64}$'
    or (v_prepare ->> 'replacement_prestate_digest') !~ '^[0-9a-f]{64}$' then
    raise exception 'phase8f_prepare_invalid';
  end if;

  v_new_assignment := (v_prepare ->> 'new_assignment_id')::uuid;
  v_new_proposition := v_prepare ->> 'new_proposition_key';

  if (select operational_state
      from public.product_fact_review_assignments
      where assignment_id = v_ctx.old_assignment_id) <> 're_review_required'
    or (select operational_state
        from public.product_fact_review_assignments
        where assignment_id = v_new_assignment) <> 'ready_for_confirm' then
    raise exception 'phase8f_prepare_assignment_state_invalid';
  end if;

  if (select count(*) from public.product_fact_instances) <> v_fact_count
    or (select count(*) from public.product_fact_current) <> v_current_count
    or (select count(*) from public.product_fact_confirmations) <> v_confirmation_count then
    raise exception 'phase8f_prepare_confirmed_early';
  end if;

  v_confirm := public.admin_confirm_product_fact_revalidation_replacement_v1(
    '92000000-0000-4000-8000-000000000001',
    'phase8f-replace-0001',
    v_ctx.transition_id,
    v_ctx.candidate_id,
    v_new_assignment,
    v_prepare -> 'confirmation_payload',
    v_prepare ->> 'confirmation_payload_digest',
    v_prepare ->> 'confirmation_prestate_digest',
    v_prepare ->> 'replacement_prestate_digest'
  );

  if v_confirm ->> 'status' <> 'replaced'
    or v_confirm ->> 'resolution_kind' <> 'SEMANTIC_CHANGE_REPLACEMENT'
    or coalesce((v_confirm ->> 'automatic_confirmation')::boolean, true) then
    raise exception 'phase8f_confirm_result_invalid';
  end if;

  v_new_fact := (v_confirm ->> 'new_fact_instance_id')::uuid;
  v_new_confirmation := (v_confirm ->> 'new_confirmation_id')::uuid;

  if (select count(*) from public.product_fact_instances) <> v_fact_count + 1
    or (select count(*) from public.product_fact_confirmations) <> v_confirmation_count + 1
    or (select count(*) from public.product_fact_current) <> v_current_count then
    raise exception 'phase8f_replacement_write_set_invalid';
  end if;

  if exists (
      select 1 from public.product_fact_current
      where proposition_key = v_ctx.old_proposition_key
    )
    or not exists (
      select 1 from public.product_fact_current
      where proposition_key = v_new_proposition
        and fact_instance_id = v_new_fact
        and confirmation_id = v_new_confirmation
    ) then
    raise exception 'phase8f_current_pointer_not_replaced';
  end if;

  if (select supersedes_fact_instance_id
      from public.product_fact_instances
      where fact_instance_id = v_new_fact) <> v_ctx.old_fact_instance_id then
    raise exception 'phase8f_fact_supersession_link_missing';
  end if;

  if (select operational_state
      from public.product_fact_review_assignments
      where assignment_id = v_ctx.old_assignment_id) <> 'superseded'
    or (select operational_state
        from public.product_fact_review_assignments
        where assignment_id = v_new_assignment) <> 'confirmed' then
    raise exception 'phase8f_assignment_supersession_invalid';
  end if;

  if (select count(*)
      from public.product_fact_revalidation_resolutions
      where transition_id = v_ctx.transition_id
        and resolution_kind = 'SEMANTIC_CHANGE_REPLACEMENT') <> 1 then
    raise exception 'phase8f_resolution_ledger_missing';
  end if;

  if (select count(*)
      from public.product_fact_review_events
      where assignment_id = v_ctx.old_assignment_id
        and event_kind = 'revalidation_superseded') <> 1 then
    raise exception 'phase8f_supersession_event_missing';
  end if;

  v_replay := public.admin_confirm_product_fact_revalidation_replacement_v1(
    '92000000-0000-4000-8000-000000000001',
    'phase8f-replace-0001',
    v_ctx.transition_id,
    v_ctx.candidate_id,
    v_new_assignment,
    v_prepare -> 'confirmation_payload',
    v_prepare ->> 'confirmation_payload_digest',
    v_prepare ->> 'confirmation_prestate_digest',
    v_prepare ->> 'replacement_prestate_digest'
  );

  if coalesce((v_replay ->> 'idempotent')::boolean, false) is not true
    or (select count(*) from public.product_fact_instances) <> v_fact_count + 1
    or (select count(*) from public.product_fact_confirmations) <> v_confirmation_count + 1
    or (select count(*) from public.product_fact_current) <> v_current_count then
    raise exception 'phase8f_replacement_replay_not_idempotent';
  end if;
end;
$$;

do $$
begin
  if has_function_privilege(
      'anon',
      'public.admin_prepare_product_fact_revalidation_replacement_v1(uuid,text,uuid,uuid)',
      'EXECUTE'
    )
    or has_function_privilege(
      'authenticated',
      'public.admin_prepare_product_fact_revalidation_replacement_v1(uuid,text,uuid,uuid)',
      'EXECUTE'
    )
    or not has_function_privilege(
      'service_role',
      'public.admin_prepare_product_fact_revalidation_replacement_v1(uuid,text,uuid,uuid)',
      'EXECUTE'
    )
    or has_function_privilege(
      'anon',
      'public.admin_confirm_product_fact_revalidation_replacement_v1(uuid,text,uuid,uuid,uuid,jsonb,text,text,text)',
      'EXECUTE'
    )
    or has_function_privilege(
      'authenticated',
      'public.admin_confirm_product_fact_revalidation_replacement_v1(uuid,text,uuid,uuid,uuid,jsonb,text,text,text)',
      'EXECUTE'
    )
    or not has_function_privilege(
      'service_role',
      'public.admin_confirm_product_fact_revalidation_replacement_v1(uuid,text,uuid,uuid,uuid,jsonb,text,text,text)',
      'EXECUTE'
    )
    or has_function_privilege(
      'service_role',
      'public.trust_phase8f_build_replacement_fact_payload_v1(uuid,uuid,uuid)',
      'EXECUTE'
    ) then
    raise exception 'phase8f_rpc_acl_invalid';
  end if;
end;
$$;

select 'TRUST_PHASE8F_CHANGED_SEMANTIC_REPLACEMENT_RUNTIME_VERIFIED';
