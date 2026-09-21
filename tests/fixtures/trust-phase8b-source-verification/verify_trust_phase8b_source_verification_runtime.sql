\set ON_ERROR_STOP on

insert into public.product_evidence_sources (
  source_id,
  canonical_locator,
  publisher,
  source_kind,
  source_metadata,
  content_digest,
  market,
  accessed_at
)
values (
  '11111111-1111-4111-8111-111111111111'::uuid,
  'https://example.invalid/phase8b-source',
  'TRUST Phase 8B Fixture',
  'official_product_page',
  '{}'::jsonb,
  repeat('a', 64),
  'KR',
  '2026-09-22T00:00:00Z'::timestamptz
);

do $$
declare
  v_first jsonb;
  v_replay jsonb;
  v_changed jsonb;
  v_unavailable jsonb;
  v_before_fact bigint;
  v_before_current bigint;
  v_before_assignments bigint;
  v_before_confirmations bigint;
begin
  select count(*) into v_before_fact from public.product_fact_instances;
  select count(*) into v_before_current from public.product_fact_current;
  select count(*) into v_before_assignments from public.product_fact_review_assignments;
  select count(*) into v_before_confirmations from public.product_fact_confirmations;

  v_first := public.record_product_evidence_source_verification_v1(
    'phase8b:unchanged',
    '11111111-1111-4111-8111-111111111111'::uuid,
    repeat('a', 64),
    'unchanged',
    'scheduled',
    '2026-09-22T00:05:00Z'::timestamptz,
    '{"probe":"first"}'::jsonb
  );

  if coalesce((v_first ->> 'inserted')::boolean, false) is not true then
    raise exception 'phase8b_first_insert_failed';
  end if;

  if coalesce((v_first ->> 'automatic_fact_mutation')::boolean, true) is not false
     or coalesce((v_first ->> 'automatic_confirmation')::boolean, true) is not false then
    raise exception 'phase8b_automatic_authority_detected';
  end if;

  v_replay := public.record_product_evidence_source_verification_v1(
    'phase8b:unchanged',
    '11111111-1111-4111-8111-111111111111'::uuid,
    repeat('a', 64),
    'unchanged',
    'scheduled',
    '2026-09-22T00:05:00Z'::timestamptz,
    '{"probe":"first"}'::jsonb
  );

  if coalesce((v_replay ->> 'inserted')::boolean, true) is not false
     or v_replay ->> 'verification_id' <> v_first ->> 'verification_id' then
    raise exception 'phase8b_exact_replay_not_idempotent';
  end if;

  begin
    perform public.record_product_evidence_source_verification_v1(
      'phase8b:unchanged',
      '11111111-1111-4111-8111-111111111111'::uuid,
      repeat('b', 64),
      'changed',
      'scheduled',
      '2026-09-22T00:05:00Z'::timestamptz,
      '{"probe":"conflict"}'::jsonb
    );
    raise exception 'phase8b_request_conflict_not_rejected';
  exception
    when unique_violation then
      if sqlerrm <> 'product_evidence_source_verification_request_conflict' then
        raise;
      end if;
  end;

  v_changed := public.record_product_evidence_source_verification_v1(
    'phase8b:changed',
    '11111111-1111-4111-8111-111111111111'::uuid,
    repeat('b', 64),
    'changed',
    'manual',
    '2026-09-22T00:06:00Z'::timestamptz,
    '{"probe":"changed"}'::jsonb
  );

  if v_changed ->> 'verification_result' <> 'changed' then
    raise exception 'phase8b_changed_result_missing';
  end if;

  v_unavailable := public.record_product_evidence_source_verification_v1(
    'phase8b:unavailable',
    '11111111-1111-4111-8111-111111111111'::uuid,
    null,
    'unavailable',
    'scheduled',
    '2026-09-22T00:07:00Z'::timestamptz,
    '{"probe":"unavailable"}'::jsonb
  );

  if v_unavailable ->> 'verification_result' <> 'unavailable' then
    raise exception 'phase8b_unavailable_result_missing';
  end if;

  begin
    perform public.record_product_evidence_source_verification_v1(
      'phase8b:bad-unchanged',
      '11111111-1111-4111-8111-111111111111'::uuid,
      repeat('b', 64),
      'unchanged',
      'manual',
      '2026-09-22T00:08:00Z'::timestamptz,
      '{}'::jsonb
    );
    raise exception 'phase8b_bad_unchanged_not_rejected';
  exception
    when invalid_parameter_value then
      if sqlerrm <> 'product_evidence_source_verification_unchanged_digest_mismatch' then
        raise;
      end if;
  end;

  begin
    perform public.record_product_evidence_source_verification_v1(
      'phase8b:bad-changed',
      '11111111-1111-4111-8111-111111111111'::uuid,
      repeat('a', 64),
      'changed',
      'manual',
      '2026-09-22T00:09:00Z'::timestamptz,
      '{}'::jsonb
    );
    raise exception 'phase8b_bad_changed_not_rejected';
  exception
    when invalid_parameter_value then
      if sqlerrm <> 'product_evidence_source_verification_changed_digest_required' then
        raise;
      end if;
  end;

  if (select count(*) from public.product_evidence_source_verifications) <> 3 then
    raise exception 'phase8b_verification_row_count_mismatch';
  end if;

  if (select count(*) from public.product_fact_instances) <> v_before_fact
     or (select count(*) from public.product_fact_current) <> v_before_current
     or (select count(*) from public.product_fact_review_assignments) <> v_before_assignments
     or (select count(*) from public.product_fact_confirmations) <> v_before_confirmations then
    raise exception 'phase8b_product_fact_state_mutated';
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
       and c.relname = 'product_evidence_source_verifications'
  ) then
    raise exception 'phase8b_rls_not_enabled';
  end if;

  if has_table_privilege('anon', 'public.product_evidence_source_verifications', 'SELECT')
     or has_table_privilege('anon', 'public.product_evidence_source_verifications', 'INSERT')
     or has_table_privilege('authenticated', 'public.product_evidence_source_verifications', 'SELECT')
     or has_table_privilege('authenticated', 'public.product_evidence_source_verifications', 'INSERT')
     or has_table_privilege('service_role', 'public.product_evidence_source_verifications', 'INSERT') then
    raise exception 'phase8b_direct_table_authority_leak';
  end if;

  if not has_table_privilege('service_role', 'public.product_evidence_source_verifications', 'SELECT') then
    raise exception 'phase8b_service_role_read_missing';
  end if;

  if has_function_privilege(
       'anon',
       'public.record_product_evidence_source_verification_v1(text,uuid,text,text,text,timestamptz,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.record_product_evidence_source_verification_v1(text,uuid,text,text,text,timestamptz,jsonb)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'public.record_product_evidence_source_verification_v1(text,uuid,text,text,text,timestamptz,jsonb)',
       'EXECUTE'
     ) then
    raise exception 'phase8b_function_authority_mismatch';
  end if;

  if not exists (
    select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'record_product_evidence_source_verification_v1'
       and p.prosecdef
       and p.proconfig @> array['search_path=""']::text[]
  ) then
    raise exception 'phase8b_function_security_contract_missing';
  end if;
end;
$$;

select 'TRUST_PHASE8B_SOURCE_VERIFICATION_RUNTIME_VERIFIED';
