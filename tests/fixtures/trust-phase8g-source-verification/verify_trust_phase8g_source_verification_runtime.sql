\set ON_ERROR_STOP on

create temporary table trust_phase8g_context as
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
  v_unresolved jsonb;
  v_fresh jsonb;
  v_fresh_replay jsonb;
  v_unchanged jsonb;
  v_unchanged_replay jsonb;
  v_changed jsonb;
  v_unprofiled jsonb;
  v_preflight jsonb;
  v_fact_count bigint;
  v_current_count bigint;
  v_confirmation_count bigint;
  v_assignment_count bigint;
  v_transition_count bigint;
  v_changed_digest text;
begin
  select * into v_ctx from trust_phase8g_context;
  if not found then
    raise exception 'phase8g_fixture_context_missing';
  end if;

  select count(*) into v_fact_count from public.product_fact_instances;
  select count(*) into v_current_count from public.product_fact_current;
  select count(*) into v_confirmation_count from public.product_fact_confirmations;
  select count(*) into v_assignment_count from public.product_fact_review_assignments;
  select count(*) into v_transition_count from public.product_fact_revalidation_transitions;

  v_unresolved := public.admin_register_product_evidence_source_verification_profile_v1(
    '92000000-0000-4000-8000-000000000001',
    'phase8g-profile-unresolved-0001',
    v_ctx.source_id,
    null,
    v_ctx.content_digest,
    'legacy-unknown-v1',
    'manual-only',
    'v0',
    'legacy_unresolved',
    '{}'::jsonb,
    '{"fixture":"phase8g-unresolved"}'::jsonb
  );

  if v_unresolved ->> 'comparability_state' <> 'BASELINE_RECOVERY_REQUIRED'
     or coalesce((v_unresolved ->> 'automatic_fact_mutation')::boolean, true)
     or coalesce((v_unresolved ->> 'automatic_confirmation')::boolean, true) then
    raise exception 'phase8g_unresolved_profile_state_invalid';
  end if;

  begin
    perform public.record_product_evidence_source_verification_v2(
      'phase8g-unresolved-verification-0001',
      (v_unresolved ->> 'profile_id')::uuid,
      v_ctx.content_digest,
      'unchanged',
      'manual',
      '2026-09-22T07:57:00Z'::timestamptz,
      '{"fixture":"phase8g-unresolved"}'::jsonb
    );
    raise exception 'phase8g_unresolved_profile_verification_not_rejected';
  exception
    when check_violation then
      if sqlerrm <> 'product_evidence_source_verification_profile_not_comparable' then
        raise;
      end if;
  end;

  v_fresh := public.admin_register_product_evidence_source_verification_profile_v1(
    '92000000-0000-4000-8000-000000000001',
    'phase8g-profile-fresh-0001',
    v_ctx.source_id,
    (v_unresolved ->> 'profile_id')::uuid,
    repeat('a', 64),
    'live-page-bytes-v1',
    'live-page-bytes',
    'v1',
    'fresh_recovery',
    jsonb_build_object(
      'final_url', 'https://example.com/product',
      'content_type', 'text/html; charset=utf-8',
      'byte_length', 1234,
      'fetched_at', '2026-09-22T07:58:00Z'
    ),
    '{"fixture":"phase8g-fresh"}'::jsonb
  );

  if v_fresh ->> 'comparability_state' <> 'COMPARABLE'
     or v_fresh ->> 'baseline_content_digest' <> repeat('a',64)
     or coalesce((v_fresh ->> 'automatic_fact_mutation')::boolean, true)
     or coalesce((v_fresh ->> 'automatic_confirmation')::boolean, true) then
    raise exception 'phase8g_fresh_profile_state_invalid';
  end if;

  v_fresh_replay := public.admin_register_product_evidence_source_verification_profile_v1(
    '92000000-0000-4000-8000-000000000001',
    'phase8g-profile-fresh-0001',
    v_ctx.source_id,
    (v_unresolved ->> 'profile_id')::uuid,
    repeat('a', 64),
    'live-page-bytes-v1',
    'live-page-bytes',
    'v1',
    'fresh_recovery',
    jsonb_build_object(
      'final_url', 'https://example.com/product',
      'content_type', 'text/html; charset=utf-8',
      'byte_length', 1234,
      'fetched_at', '2026-09-22T07:58:00Z'
    ),
    '{"fixture":"phase8g-fresh"}'::jsonb
  );

  if coalesce((v_fresh_replay ->> 'idempotent')::boolean, false) is not true
     or v_fresh_replay ->> 'profile_id' <> v_fresh ->> 'profile_id' then
    raise exception 'phase8g_profile_exact_replay_not_idempotent';
  end if;

  begin
    perform public.admin_register_product_evidence_source_verification_profile_v1(
      '92000000-0000-4000-8000-000000000001',
      'phase8g-profile-fresh-0001',
      v_ctx.source_id,
      (v_unresolved ->> 'profile_id')::uuid,
      repeat('b', 64),
      'live-page-bytes-v1',
      'live-page-bytes',
      'v1',
      'fresh_recovery',
      jsonb_build_object(
        'final_url', 'https://example.com/product',
        'content_type', 'text/html; charset=utf-8',
        'byte_length', 1234,
        'fetched_at', '2026-09-22T07:58:00Z'
      ),
      '{"fixture":"phase8g-fresh"}'::jsonb
    );
    raise exception 'phase8g_profile_request_conflict_not_rejected';
  exception
    when unique_violation then
      if sqlerrm <> 'product_evidence_source_verification_profile_request_conflict' then
        raise;
      end if;
  end;

  v_unchanged := public.record_product_evidence_source_verification_v2(
    'phase8g-unchanged-verification-0001',
    (v_fresh ->> 'profile_id')::uuid,
    repeat('a',64),
    'unchanged',
    'manual',
    '2026-09-22T07:59:00Z'::timestamptz,
    '{"fixture":"phase8g-unchanged"}'::jsonb
  );

  v_unchanged_replay := public.record_product_evidence_source_verification_v2(
    'phase8g-unchanged-verification-0001',
    (v_fresh ->> 'profile_id')::uuid,
    repeat('a',64),
    'unchanged',
    'manual',
    '2026-09-22T07:59:00Z'::timestamptz,
    '{"fixture":"phase8g-unchanged"}'::jsonb
  );

  if v_unchanged ->> 'verification_result' <> 'unchanged'
     or v_unchanged ->> 'baseline_content_digest' <> repeat('a',64)
     or coalesce((v_unchanged_replay ->> 'idempotent')::boolean, false) is not true then
    raise exception 'phase8g_unchanged_verification_invalid';
  end if;

  begin
    perform public.record_product_evidence_source_verification_v2(
      'phase8g-unchanged-verification-0001',
      (v_fresh ->> 'profile_id')::uuid,
      repeat('b',64),
      'changed',
      'manual',
      '2026-09-22T07:59:00Z'::timestamptz,
      '{"fixture":"phase8g-unchanged"}'::jsonb
    );
    raise exception 'phase8g_verification_request_conflict_not_rejected';
  exception
    when unique_violation then
      if sqlerrm <> 'product_evidence_source_verification_request_conflict' then
        raise;
      end if;
  end;

  v_changed_digest := case
    when v_ctx.content_digest = repeat('f',64) then repeat('e',64)
    else repeat('f',64)
  end;

  v_unprofiled := public.record_product_evidence_source_verification_v1(
    'phase8g-unprofiled-changed-0001',
    v_ctx.source_id,
    v_changed_digest,
    'changed',
    'manual',
    '2026-09-22T08:00:00Z'::timestamptz,
    '{"fixture":"phase8g-unprofiled"}'::jsonb
  );

  begin
    perform public.admin_preflight_product_fact_revalidation_v1(
      '92000000-0000-4000-8000-000000000001',
      (v_unprofiled ->> 'verification_id')::uuid,
      v_ctx.assignment_id
    );
    raise exception 'phase8g_unprofiled_revalidation_not_rejected';
  exception
    when check_violation then
      if sqlerrm <> 'product_fact_revalidation_verification_not_comparable' then
        raise;
      end if;
  end;

  v_changed := public.record_product_evidence_source_verification_v2(
    'phase8g-profiled-changed-0001',
    (v_fresh ->> 'profile_id')::uuid,
    repeat('b',64),
    'changed',
    'manual',
    '2026-09-22T08:01:00Z'::timestamptz,
    '{"fixture":"phase8g-profiled-changed"}'::jsonb
  );

  v_preflight := public.admin_preflight_product_fact_revalidation_v1(
    '92000000-0000-4000-8000-000000000001',
    (v_changed ->> 'verification_id')::uuid,
    v_ctx.assignment_id
  );

  if v_preflight ->> 'status' <> 'ready_for_revalidation_transition'
     or coalesce((v_preflight ->> 'current_pointer_changed')::boolean, true)
     or coalesce((v_preflight ->> 'fact_instance_mutated')::boolean, true)
     or coalesce((v_preflight ->> 'automatic_confirmation')::boolean, true) then
    raise exception 'phase8g_profiled_revalidation_preflight_invalid';
  end if;

  if (select count(*) from public.product_fact_instances) <> v_fact_count
     or (select count(*) from public.product_fact_current) <> v_current_count
     or (select count(*) from public.product_fact_confirmations) <> v_confirmation_count
     or (select count(*) from public.product_fact_review_assignments) <> v_assignment_count
     or (select count(*) from public.product_fact_revalidation_transitions) <> v_transition_count
     or (select operational_state from public.product_fact_review_assignments where assignment_id=v_ctx.assignment_id) <> 'confirmed' then
    raise exception 'phase8g_authority_state_mutated';
  end if;
end;
$$;

do $$
begin
  if not (
    select relrowsecurity
      from pg_class c
      join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public'
       and c.relname='product_evidence_source_verification_profiles'
  ) then
    raise exception 'phase8g_profile_rls_missing';
  end if;

  if has_table_privilege('anon','public.product_evidence_source_verification_profiles','SELECT')
     or has_table_privilege('authenticated','public.product_evidence_source_verification_profiles','SELECT')
     or has_table_privilege('service_role','public.product_evidence_source_verification_profiles','INSERT')
     or has_table_privilege('service_role','public.product_evidence_source_verification_profiles','UPDATE')
     or has_table_privilege('service_role','public.product_evidence_source_verification_profiles','DELETE')
     or not has_table_privilege('service_role','public.product_evidence_source_verification_profiles','SELECT') then
    raise exception 'phase8g_profile_acl_mismatch';
  end if;

  if has_function_privilege(
       'anon',
       'public.admin_register_product_evidence_source_verification_profile_v1(uuid,text,uuid,uuid,text,text,text,text,text,jsonb,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.admin_register_product_evidence_source_verification_profile_v1(uuid,text,uuid,uuid,text,text,text,text,text,jsonb,jsonb)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'public.admin_register_product_evidence_source_verification_profile_v1(uuid,text,uuid,uuid,text,text,text,text,text,jsonb,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.record_product_evidence_source_verification_v2(text,uuid,text,text,text,timestamptz,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.record_product_evidence_source_verification_v2(text,uuid,text,text,text,timestamptz,jsonb)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'public.record_product_evidence_source_verification_v2(text,uuid,text,text,text,timestamptz,jsonb)',
       'EXECUTE'
     ) then
    raise exception 'phase8g_function_acl_mismatch';
  end if;
end;
$$;

select 'TRUST_PHASE8G_SOURCE_VERIFICATION_COMPARABILITY_RUNTIME_VERIFIED';
