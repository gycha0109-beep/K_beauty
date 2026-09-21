\set ON_ERROR_STOP on

create temporary table trust_phase8c_context as
select
  c.proposition_key,
  c.fact_instance_id,
  c.confirmation_id,
  a.assignment_id,
  e.source_id,
  s.content_digest
from public.product_fact_current c
join public.product_fact_review_assignments a
  on a.proposition_key = c.proposition_key
 and a.operational_state = 'confirmed'
join public.product_fact_evidence_links l
  on l.fact_instance_id = c.fact_instance_id
join public.product_evidence_records e
  on e.evidence_id = l.evidence_id
join public.product_evidence_sources s
  on s.source_id = e.source_id
order by a.created_at desc, l.evidence_id
limit 1;

do $$
declare
  v_ctx record;
  v_verification jsonb;
  v_preflight jsonb;
  v_result jsonb;
  v_replay jsonb;
  v_fact_count bigint;
  v_current_count bigint;
  v_confirmation_count bigint;
  v_current_fact uuid;
  v_current_confirmation uuid;
  v_payload jsonb;
begin
  select * into v_ctx from trust_phase8c_context;
  if not found then
    raise exception 'phase8c_fixture_context_missing';
  end if;

  select count(*) into v_fact_count from public.product_fact_instances;
  select count(*) into v_current_count from public.product_fact_current;
  select count(*) into v_confirmation_count from public.product_fact_confirmations;
  v_current_fact := v_ctx.fact_instance_id;
  v_current_confirmation := v_ctx.confirmation_id;

  v_verification := public.record_product_evidence_source_verification_v1(
    'phase8c:changed-source',
    v_ctx.source_id,
    repeat('f', 64),
    'changed',
    'manual',
    '2026-09-22T01:10:00Z'::timestamptz,
    '{"fixture":"phase8c"}'::jsonb
  );

  v_preflight := public.admin_preflight_product_fact_revalidation_v1(
    '92000000-0000-4000-8000-000000000001',
    (v_verification ->> 'verification_id')::uuid,
    v_ctx.assignment_id
  );

  if v_preflight ->> 'status' <> 'ready_for_revalidation_transition'
     or coalesce((v_preflight ->> 'current_pointer_changed')::boolean, true)
     or coalesce((v_preflight ->> 'fact_instance_mutated')::boolean, true)
     or coalesce((v_preflight ->> 'automatic_confirmation')::boolean, true) then
    raise exception 'phase8c_preflight_result_invalid';
  end if;

  v_payload := v_preflight -> 'transition_payload';

  if v_payload ->> 'source_id' <> v_ctx.source_id::text
     or v_payload ->> 'verification_id' <> v_verification ->> 'verification_id'
     or v_payload ->> 'proposition_key' <> v_ctx.proposition_key
     or v_payload ->> 'fact_instance_id' <> v_ctx.fact_instance_id::text
     or v_payload ->> 'confirmation_id' <> v_ctx.confirmation_id::text
     or v_payload ->> 'assignment_id' <> v_ctx.assignment_id::text
     or v_payload ->> 'prestate_digest' !~ '^[0-9a-f]{64}$'
     or v_payload ->> 'reason_code' <> 'source_content_changed' then
    raise exception 'phase8c_preflight_binding_incomplete';
  end if;

  begin
    perform public.admin_mark_product_fact_revalidation_v1(
      '92000000-0000-4000-8000-000000000001',
      'phase8c-stale-digest-0001',
      jsonb_set(v_payload, '{prestate_digest}', to_jsonb(repeat('0',64)))
    );
    raise exception 'phase8c_stale_prestate_digest_not_rejected';
  exception
    when serialization_failure then
      if sqlerrm <> 'product_fact_revalidation_prestate_digest_stale' then
        raise;
      end if;
  end;

  begin
    perform public.admin_mark_product_fact_revalidation_v1(
      '92000000-0000-4000-8000-000000000001',
      'phase8c-reason-mismatch-0001',
      jsonb_set(v_payload, '{reason_code}', to_jsonb('source_unavailable'::text))
    );
    raise exception 'phase8c_reason_mismatch_not_rejected';
  exception
    when check_violation then
      if sqlerrm <> 'product_fact_revalidation_reason_mismatch' then
        raise;
      end if;
  end;

  begin
    perform public.admin_mark_product_fact_revalidation_v1(
      '92000000-0000-4000-8000-000000000001',
      'phase8c-source-mismatch-0001',
      jsonb_set(v_payload, '{source_id}', to_jsonb('00000000-0000-4000-8000-000000000999'::text))
    );
    raise exception 'phase8c_source_mismatch_not_rejected';
  exception
    when check_violation then
      if sqlerrm <> 'product_fact_revalidation_source_mismatch' then
        raise;
      end if;
  end;

  v_result := public.admin_mark_product_fact_revalidation_v1(
    '92000000-0000-4000-8000-000000000001',
    'phase8c-revalidate-0001',
    v_payload
  );

  if v_result ->> 'status' <> 're_review_required'
     or v_result ->> 'prestate_digest' <> v_payload ->> 'prestate_digest'
     or v_result ->> 'reason_code' <> v_payload ->> 'reason_code'
     or coalesce((v_result ->> 'current_pointer_changed')::boolean, true)
     or coalesce((v_result ->> 'fact_instance_mutated')::boolean, true)
     or coalesce((v_result ->> 'automatic_confirmation')::boolean, true) then
    raise exception 'phase8c_transition_result_invalid';
  end if;

  if (select operational_state from public.product_fact_review_assignments where assignment_id=v_ctx.assignment_id)
     <> 're_review_required' then
    raise exception 'phase8c_assignment_not_re_review_required';
  end if;

  if (select fact_instance_id from public.product_fact_current where proposition_key=v_ctx.proposition_key)
     <> v_current_fact
     or (select confirmation_id from public.product_fact_current where proposition_key=v_ctx.proposition_key)
     <> v_current_confirmation then
    raise exception 'phase8c_current_pointer_changed';
  end if;

  if (select count(*) from public.product_fact_instances) <> v_fact_count
     or (select count(*) from public.product_fact_current) <> v_current_count
     or (select count(*) from public.product_fact_confirmations) <> v_confirmation_count then
    raise exception 'phase8c_semantic_authority_mutated';
  end if;

  if (select count(*) from public.product_fact_revalidation_transitions
      where request_id='phase8c-revalidate-0001'
        and source_id=v_ctx.source_id
        and prestate_digest=v_payload ->> 'prestate_digest'
        and reason_code='source_content_changed') <> 1 then
    raise exception 'phase8c_transition_ledger_binding_missing';
  end if;

  if (select count(*) from public.product_fact_review_events
      where assignment_id=v_ctx.assignment_id
        and event_kind in ('revalidation_stale','revalidation_required')) <> 2 then
    raise exception 'phase8c_review_event_pair_missing';
  end if;

  v_replay := public.admin_mark_product_fact_revalidation_v1(
    '92000000-0000-4000-8000-000000000001',
    'phase8c-revalidate-0001',
    v_payload
  );

  if coalesce((v_replay ->> 'idempotent')::boolean, false) is not true then
    raise exception 'phase8c_exact_replay_not_idempotent';
  end if;

  if (select count(*) from public.product_fact_revalidation_transitions where request_id='phase8c-revalidate-0001') <> 1
     or (select count(*) from public.product_fact_review_events
         where assignment_id=v_ctx.assignment_id
           and event_kind in ('revalidation_stale','revalidation_required')) <> 2 then
    raise exception 'phase8c_exact_replay_created_duplicates';
  end if;

  begin
    perform public.admin_mark_product_fact_revalidation_v1(
      '92000000-0000-4000-8000-000000000001',
      'phase8c-revalidate-0001',
      jsonb_set(v_payload, '{fact_instance_id}', to_jsonb('00000000-0000-4000-8000-000000000999'::text))
    );
    raise exception 'phase8c_request_conflict_not_rejected';
  exception
    when unique_violation then
      if sqlerrm <> 'product_fact_revalidation_request_conflict' then
        raise;
      end if;
  end;

  begin
    perform public.admin_mark_product_fact_revalidation_v1(
      '92000000-0000-4000-8000-000000000001',
      'phase8c-revalidate-0002',
      v_payload
    );
    raise exception 'phase8c_nonconfirmed_assignment_not_rejected';
  exception
    when serialization_failure then
      if sqlerrm <> 'product_fact_revalidation_assignment_not_confirmed' then
        raise;
      end if;
  end;
end;
$$;

do $$
declare
  v_ctx record;
  v_unchanged jsonb;
  v_payload jsonb;
begin
  select * into v_ctx from trust_phase8c_context;

  v_unchanged := public.record_product_evidence_source_verification_v1(
    'phase8c:unchanged-source',
    v_ctx.source_id,
    v_ctx.content_digest,
    'unchanged',
    'manual',
    '2026-09-22T01:11:00Z'::timestamptz,
    '{"fixture":"phase8c-unchanged"}'::jsonb
  );

  v_payload := jsonb_build_object(
    'source_id', v_ctx.source_id,
    'verification_id', (v_unchanged ->> 'verification_id')::uuid,
    'assignment_id', v_ctx.assignment_id,
    'proposition_key', v_ctx.proposition_key,
    'fact_instance_id', v_ctx.fact_instance_id,
    'confirmation_id', v_ctx.confirmation_id,
    'prestate_digest', repeat('0',64),
    'reason_code', 'source_content_changed'
  );

  begin
    perform public.admin_mark_product_fact_revalidation_v1(
      '92000000-0000-4000-8000-000000000001',
      'phase8c-unchanged-0001',
      v_payload
    );
    raise exception 'phase8c_unchanged_verification_not_rejected';
  exception
    when check_violation then
      if sqlerrm <> 'product_fact_revalidation_verification_not_actionable' then
        raise;
      end if;
  end;
end;
$$;

do $$
begin
  if not (
    select relrowsecurity
      from pg_class c
      join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public'
       and c.relname='product_fact_revalidation_transitions'
  ) then
    raise exception 'phase8c_transition_ledger_rls_missing';
  end if;

  if has_table_privilege('anon','public.product_fact_revalidation_transitions','SELECT')
     or has_table_privilege('authenticated','public.product_fact_revalidation_transitions','SELECT')
     or has_table_privilege('service_role','public.product_fact_revalidation_transitions','INSERT') then
    raise exception 'phase8c_transition_ledger_acl_leak';
  end if;

  if not has_table_privilege('service_role','public.product_fact_revalidation_transitions','SELECT') then
    raise exception 'phase8c_transition_ledger_service_read_missing';
  end if;

  if has_function_privilege(
       'anon',
       'public.admin_preflight_product_fact_revalidation_v1(uuid,uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.admin_preflight_product_fact_revalidation_v1(uuid,uuid,uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'public.admin_preflight_product_fact_revalidation_v1(uuid,uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.admin_mark_product_fact_revalidation_v1(uuid,text,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.admin_mark_product_fact_revalidation_v1(uuid,text,jsonb)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'public.admin_mark_product_fact_revalidation_v1(uuid,text,jsonb)',
       'EXECUTE'
     ) then
    raise exception 'phase8c_transition_function_acl_mismatch';
  end if;
end;
$$;

select 'TRUST_PHASE8C_REVALIDATION_TRANSITION_RUNTIME_VERIFIED';
