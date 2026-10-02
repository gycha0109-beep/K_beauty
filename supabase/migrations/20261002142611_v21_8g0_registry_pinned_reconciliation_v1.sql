begin;

-- V2.1-8G0 / Registry-pinned catalog trust reconciliation.
-- Adds an explicit-registry processing path and a controlled intake identity
-- authority update. Historical process_catalog_trust_product_v1 remains unchanged.
-- This migration does not create Product Fact Subjects, Evidence, Fact instances,
-- Current facts, recommendation activation, or public activation.

do $$
begin
  if to_regprocedure('public.resolve_catalog_trust_subject_v1(uuid)') is null
    or to_regprocedure('public.product_fact_controlled_registry_write_admissibility_v2(text,text,text)') is null
    or to_regprocedure('public.product_fact_controlled_json_exact_keys_v1(jsonb,text[])') is null
    or to_regprocedure('public.admin_require_product_review_actor(uuid,text)') is null
    or to_regprocedure('public.record_admin_audit_event(uuid,text,text,text,text,jsonb,jsonb,text,text,jsonb)') is null
  then
    raise exception 'v21_8g0_prerequisite_missing';
  end if;
end $$;

create or replace function public.admin_resolve_catalog_trust_intake_identity_v1(
  p_actor_user_id uuid,
  p_request_id text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_role text;
  v_request_id text := btrim(coalesce(p_request_id, ''));
  v_intake_id uuid;
  v_expected_updated_at timestamptz;
  v_market text;
  v_identity_resolution_version text;
  v_official_source_locator text;
  v_source_content_digest text;
  v_resolution_reason text;
  v_intake public.catalog_trust_intake%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_audit_id uuid;
begin
  v_actor_role := public.admin_require_product_review_actor(
    p_actor_user_id,
    'admin.products.review'
  );

  if char_length(v_request_id) not between 8 and 120
    or not public.product_fact_controlled_json_exact_keys_v1(
      p_payload,
      array[
        'intake_id',
        'market',
        'identity_resolution_version',
        'official_source_locator',
        'source_content_digest',
        'resolution_reason',
        'expected_updated_at'
      ]
    )
    or octet_length(p_payload::text) > 65536
  then
    raise exception 'catalog_trust_intake_identity_payload_invalid'
      using errcode = '22023';
  end if;

  begin
    v_intake_id := (p_payload ->> 'intake_id')::uuid;
    v_expected_updated_at := (p_payload ->> 'expected_updated_at')::timestamptz;
  exception when others then
    raise exception 'catalog_trust_intake_identity_key_invalid'
      using errcode = '22023';
  end;

  v_market := upper(btrim(coalesce(p_payload ->> 'market', '')));
  v_identity_resolution_version :=
    btrim(coalesce(p_payload ->> 'identity_resolution_version', ''));
  v_official_source_locator :=
    btrim(coalesce(p_payload ->> 'official_source_locator', ''));
  v_source_content_digest :=
    lower(btrim(coalesce(p_payload ->> 'source_content_digest', '')));
  v_resolution_reason :=
    btrim(coalesce(p_payload ->> 'resolution_reason', ''));

  if char_length(v_market) not between 2 and 16
    or v_market !~ '^[A-Z0-9][A-Z0-9_-]{1,15}$'
    or char_length(v_identity_resolution_version) not between 1 and 160
    or char_length(v_official_source_locator) not between 8 and 2048
    or v_official_source_locator !~ '^https://'
    or v_source_content_digest !~ '^[0-9a-f]{64}$'
    or char_length(v_resolution_reason) not between 1 and 1000
  then
    raise exception 'catalog_trust_intake_identity_authority_invalid'
      using errcode = '23514';
  end if;

  select * into v_intake
  from public.catalog_trust_intake
  where id = v_intake_id
  for update;

  if not found then
    raise exception 'catalog_trust_intake_not_found'
      using errcode = 'P0002';
  end if;

  if v_intake.updated_at is distinct from v_expected_updated_at then
    raise exception 'catalog_trust_intake_identity_prestate_conflict'
      using errcode = '40001';
  end if;

  if v_intake.subject_id is not null
    or v_intake.identity_state = 'EXACT_SUBJECT_FOUND'
  then
    raise exception 'catalog_trust_intake_identity_already_bound'
      using errcode = '23514';
  end if;

  v_before := jsonb_build_object(
    'market', v_intake.market,
    'subject_id', v_intake.subject_id,
    'identity_state', v_intake.identity_state,
    'identity_resolution_version', v_intake.identity_resolution_version,
    'identity_resolution_detail', v_intake.identity_resolution_detail,
    'trust_state', v_intake.trust_state,
    'updated_at', v_intake.updated_at
  );

  update public.catalog_trust_intake
  set market = v_market,
      subject_id = null,
      identity_state = 'PENDING',
      identity_resolution_version = v_identity_resolution_version,
      identity_resolution_detail = jsonb_build_object(
        'authority_kind', 'admin_identity_authority',
        'official_source_locator', v_official_source_locator,
        'source_content_digest', v_source_content_digest,
        'resolution_reason', v_resolution_reason,
        'market', v_market
      ),
      trust_state = 'IDENTITY_RESOLVING',
      started_at = coalesce(started_at, now()),
      completed_at = null,
      last_checked_at = now(),
      updated_at = now()
  where id = v_intake_id
  returning * into v_intake;

  v_after := jsonb_build_object(
    'market', v_intake.market,
    'subject_id', v_intake.subject_id,
    'identity_state', v_intake.identity_state,
    'identity_resolution_version', v_intake.identity_resolution_version,
    'identity_resolution_detail', v_intake.identity_resolution_detail,
    'trust_state', v_intake.trust_state,
    'updated_at', v_intake.updated_at
  );

  v_audit_id := public.record_admin_audit_event(
    p_actor_user_id,
    'admin.products.review',
    'admin.catalog_trust.intake_identity_resolved',
    'catalog_trust_intake',
    v_intake.id::text,
    v_before,
    v_after,
    'resolve catalog trust intake identity authority before Subject registration',
    v_request_id,
    jsonb_build_object(
      'product_id', v_intake.product_id,
      'catalog_revision', v_intake.catalog_revision,
      'category', v_intake.category,
      'official_source_locator', v_official_source_locator,
      'source_content_digest', v_source_content_digest,
      'identity_resolution_version', v_identity_resolution_version
    )
  );

  return jsonb_build_object(
    'status', 'identity_authority_resolved',
    'intake_id', v_intake.id,
    'product_id', v_intake.product_id,
    'market', v_intake.market,
    'identity_state', v_intake.identity_state,
    'trust_state', v_intake.trust_state,
    'identity_resolution_version', v_intake.identity_resolution_version,
    'updated_at', v_intake.updated_at,
    'audit_id', v_audit_id
  );
end;
$$;

revoke all on function public.admin_resolve_catalog_trust_intake_identity_v1(uuid,text,jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_resolve_catalog_trust_intake_identity_v1(uuid,text,jsonb)
  to service_role;

comment on function public.admin_resolve_catalog_trust_intake_identity_v1(uuid,text,jsonb) is
  'V2.1-8G0 service-role/admin-reviewed intake identity authority update. Sets exact market and frozen official-source digest only; does not create Product Fact Subject or Fact authority.';

create or replace function public.process_catalog_trust_product_v2(
  p_product_id uuid,
  p_registry_version text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_registry_version text := btrim(coalesce(p_registry_version, ''));
  v_intake public.catalog_trust_intake%rowtype;
  v_subject_id uuid;
  v_policy record;
  v_task_state text;
  v_task_blocker_code text;
  v_task_blocker_detail text;
  v_existing_task_id uuid;
  v_intake_task_id uuid;
  v_policy_count integer;
  v_intake_count integer := 0;
  v_tasks_touched integer := 0;
  v_tasks_covered integer := 0;
  v_policy_checks integer := 0;
  v_open_count integer;
  v_lineage_kind text;
  v_write_policy jsonb;
begin
  if p_product_id is null
    or not exists(select 1 from public.products where id = p_product_id)
  then
    raise exception 'catalog_trust_product_not_found'
      using errcode = 'P0002';
  end if;

  if char_length(v_registry_version) not between 1 and 160
    or not exists (
      select 1
      from public.product_fact_registry_versions r
      where r.registry_version = v_registry_version
        and (r.effective_at is null or r.effective_at <= now())
    )
  then
    raise exception 'catalog_trust_registry_invalid_or_ineffective'
      using errcode = '23514';
  end if;

  -- Full product preflight. No intake/task mutation occurs before every required
  -- Fact has a definition and an admissible explicit registry lineage.
  for v_intake in
    select *
    from public.catalog_trust_intake
    where product_id = p_product_id
    order by created_at, id
  loop
    select count(*)::integer into v_policy_count
    from public.catalog_required_product_facts_v1(v_intake.category);

    if v_policy_count = 0 then
      raise exception 'catalog_trust_required_fact_policy_missing:%',
        v_intake.category
        using errcode = '23514';
    end if;

    for v_policy in
      select * from public.catalog_required_product_facts_v1(v_intake.category)
    loop
      if not exists (
        select 1
        from public.product_fact_definition_snapshots d
        where d.registry_version = v_registry_version
          and d.fact_key = v_policy.fact_key
          and not d.deprecated
          and (d.definition -> 'domain_scope') ? v_intake.category
      ) then
        raise exception 'catalog_trust_required_fact_registry_mismatch:%:%:%',
          v_registry_version, v_intake.category, v_policy.fact_key
          using errcode = '23514';
      end if;

      v_lineage_kind := case
        when exists (
          select 1
          from public.product_fact_research_tasks t
          where t.intake_id = v_intake.id
            and t.fact_key = v_policy.fact_key
            and t.registry_version = v_registry_version
            and t.research_policy_version = 'product-fact-required-policy-v1'
        ) then 'existing'
        else 'new'
      end;

      v_write_policy :=
        public.product_fact_controlled_registry_write_admissibility_v2(
          v_registry_version,
          v_policy.fact_key,
          v_lineage_kind
        );
      v_policy_checks := v_policy_checks + 1;

      if coalesce((v_write_policy ->> 'allowed')::boolean, false) is not true then
        raise exception 'catalog_trust_registry_write_policy_blocked:%:%:%:%',
          v_registry_version,
          v_policy.fact_key,
          v_lineage_kind,
          coalesce(v_write_policy ->> 'reason', 'UNKNOWN')
          using errcode = '23514';
      end if;
    end loop;
  end loop;

  for v_intake in
    select *
    from public.catalog_trust_intake
    where product_id = p_product_id
    order by created_at, id
    for update
  loop
    v_intake_count := v_intake_count + 1;

    perform public.resolve_catalog_trust_subject_v1(v_intake.id);

    select * into v_intake
    from public.catalog_trust_intake
    where id = v_intake.id
    for update;

    v_subject_id := v_intake.subject_id;

    select count(*)::integer into v_policy_count
    from public.catalog_required_product_facts_v1(v_intake.category);

    for v_policy in
      select * from public.catalog_required_product_facts_v1(v_intake.category)
    loop
      v_task_blocker_code := null;
      v_task_blocker_detail := null;

      if v_subject_id is not null and exists (
        select 1
        from public.product_fact_current c
        join public.product_fact_instances fi
          on fi.fact_instance_id = c.fact_instance_id
        where c.subject_id = v_subject_id
          and fi.registry_version = v_registry_version
          and fi.fact_key = v_policy.fact_key
      ) then
        v_task_state := 'ALREADY_COVERED';
      elsif v_subject_id is not null then
        v_task_state := 'RESEARCH_PENDING';
      elsif v_intake.identity_state in (
        'SUBJECT_CANDIDATE_FOUND',
        'SUBJECT_CREATION_REQUIRED'
      ) then
        v_task_state := 'REVIEW_REQUIRED';
        v_task_blocker_code := v_intake.identity_state;
        v_task_blocker_detail := v_intake.identity_resolution_detail::text;
      else
        v_task_state := 'BLOCKED';
        v_task_blocker_code := v_intake.identity_state;
        v_task_blocker_detail := v_intake.identity_resolution_detail::text;
      end if;

      v_existing_task_id := null;
      v_intake_task_id := null;

      if v_subject_id is not null then
        select t.id into v_existing_task_id
        from public.product_fact_research_tasks t
        where t.subject_id = v_subject_id
          and t.fact_key = v_policy.fact_key
          and t.registry_version = v_registry_version
          and t.research_policy_version = 'product-fact-required-policy-v1'
        order by t.created_at, t.id
        limit 1
        for update;
      end if;

      select t.id into v_intake_task_id
      from public.product_fact_research_tasks t
      where t.intake_id = v_intake.id
        and t.fact_key = v_policy.fact_key
        and t.registry_version = v_registry_version
        and t.research_policy_version = 'product-fact-required-policy-v1'
      limit 1
      for update;

      v_lineage_kind := case
        when v_existing_task_id is not null or v_intake_task_id is not null
          then 'existing'
        else 'new'
      end;

      v_write_policy :=
        public.product_fact_controlled_registry_write_admissibility_v2(
          v_registry_version,
          v_policy.fact_key,
          v_lineage_kind
        );

      if coalesce((v_write_policy ->> 'allowed')::boolean, false) is not true then
        raise exception 'catalog_trust_registry_write_policy_blocked_after_resolution:%:%:%:%',
          v_registry_version,
          v_policy.fact_key,
          v_lineage_kind,
          coalesce(v_write_policy ->> 'reason', 'UNKNOWN')
          using errcode = '23514';
      end if;

      if v_subject_id is not null and v_existing_task_id is not null then
        if v_intake_task_id is not null
          and v_intake_task_id <> v_existing_task_id
        then
          if exists (
            select 1
            from public.product_fact_research_tasks t
            where t.id = v_intake_task_id
              and t.subject_id is null
              and t.state in ('IDENTITY_PENDING','REVIEW_REQUIRED','BLOCKED')
              and t.source_locator is null
              and t.source_content_digest is null
              and t.evidence_id is null
              and t.attempt_count = 0
          ) then
            delete from public.product_fact_research_tasks
            where id = v_intake_task_id;
            v_intake_task_id := null;
          else
            raise exception 'catalog_trust_identity_task_reconciliation_required:%',
              v_intake_task_id
              using errcode = '23514';
          end if;
        end if;

        update public.product_fact_research_tasks
        set state = case
              when v_task_state = 'ALREADY_COVERED' then 'ALREADY_COVERED'
              when state in ('CONFIRMED','EVIDENCE_CANDIDATE','PREFLIGHT_READY') then state
              when state in ('REVIEW_REQUIRED','BLOCKED')
                and coalesce(blocker_code, '') not in (
                  'SUBJECT_CANDIDATE_FOUND',
                  'SUBJECT_CREATION_REQUIRED',
                  'IDENTITY_BLOCKED',
                  'VARIANT_CONFLICT',
                  'FORMULATION_CONFLICT',
                  'MARKET_CONFLICT'
                ) then state
              else v_task_state
            end,
            priority = least(priority, v_policy.priority),
            blocker_code = case
              when v_task_state = 'ALREADY_COVERED' then null
              when state in ('CONFIRMED','EVIDENCE_CANDIDATE','PREFLIGHT_READY') then blocker_code
              when state in ('REVIEW_REQUIRED','BLOCKED')
                and coalesce(blocker_code, '') not in (
                  'SUBJECT_CANDIDATE_FOUND',
                  'SUBJECT_CREATION_REQUIRED',
                  'IDENTITY_BLOCKED',
                  'VARIANT_CONFLICT',
                  'FORMULATION_CONFLICT',
                  'MARKET_CONFLICT'
                ) then blocker_code
              else v_task_blocker_code
            end,
            blocker_detail = case
              when v_task_state = 'ALREADY_COVERED' then null
              when state in ('CONFIRMED','EVIDENCE_CANDIDATE','PREFLIGHT_READY') then blocker_detail
              when state in ('REVIEW_REQUIRED','BLOCKED')
                and coalesce(blocker_code, '') not in (
                  'SUBJECT_CANDIDATE_FOUND',
                  'SUBJECT_CREATION_REQUIRED',
                  'IDENTITY_BLOCKED',
                  'VARIANT_CONFLICT',
                  'FORMULATION_CONFLICT',
                  'MARKET_CONFLICT'
                ) then blocker_detail
              else v_task_blocker_detail
            end,
            completed_at = case
              when v_task_state = 'ALREADY_COVERED'
                then coalesce(completed_at, now())
              when state = 'CONFIRMED' then completed_at
              else null
            end,
            updated_at = now()
        where id = v_existing_task_id;

      elsif v_subject_id is not null and v_intake_task_id is not null then
        update public.product_fact_research_tasks
        set subject_id = v_subject_id,
            state = v_task_state,
            priority = least(priority, v_policy.priority),
            blocker_code = null,
            blocker_detail = null,
            completed_at = case
              when v_task_state = 'ALREADY_COVERED'
                then coalesce(completed_at, now())
              else null
            end,
            updated_at = now()
        where id = v_intake_task_id;

      else
        insert into public.product_fact_research_tasks (
          intake_id,
          product_id,
          subject_id,
          fact_key,
          registry_version,
          research_policy_version,
          state,
          priority,
          blocker_code,
          blocker_detail,
          attempt_count,
          created_at,
          updated_at,
          completed_at
        ) values (
          v_intake.id,
          v_intake.product_id,
          v_subject_id,
          v_policy.fact_key,
          v_registry_version,
          'product-fact-required-policy-v1',
          v_task_state,
          v_policy.priority,
          v_task_blocker_code,
          v_task_blocker_detail,
          0,
          now(),
          now(),
          case when v_task_state = 'ALREADY_COVERED' then now() else null end
        )
        on conflict (
          intake_id,
          fact_key,
          registry_version,
          research_policy_version
        )
        do update set
          subject_id = excluded.subject_id,
          state = case
            when public.product_fact_research_tasks.state in (
              'CONFIRMED','EVIDENCE_CANDIDATE','PREFLIGHT_READY'
            ) then public.product_fact_research_tasks.state
            else excluded.state
          end,
          priority = least(
            public.product_fact_research_tasks.priority,
            excluded.priority
          ),
          blocker_code = case
            when public.product_fact_research_tasks.state in (
              'CONFIRMED','EVIDENCE_CANDIDATE','PREFLIGHT_READY'
            ) then public.product_fact_research_tasks.blocker_code
            else excluded.blocker_code
          end,
          blocker_detail = case
            when public.product_fact_research_tasks.state in (
              'CONFIRMED','EVIDENCE_CANDIDATE','PREFLIGHT_READY'
            ) then public.product_fact_research_tasks.blocker_detail
            else excluded.blocker_detail
          end,
          completed_at = case
            when excluded.state = 'ALREADY_COVERED'
              then coalesce(
                public.product_fact_research_tasks.completed_at,
                now()
              )
            when public.product_fact_research_tasks.state = 'CONFIRMED'
              then public.product_fact_research_tasks.completed_at
            else null
          end,
          updated_at = now();
      end if;

      v_tasks_touched := v_tasks_touched + 1;
      if v_task_state = 'ALREADY_COVERED' then
        v_tasks_covered := v_tasks_covered + 1;
      end if;
    end loop;

    if v_subject_id is not null then
      select count(*)::integer into v_open_count
      from public.catalog_required_product_facts_v1(v_intake.category) p
      where not exists (
        select 1
        from public.product_fact_current c
        join public.product_fact_instances fi
          on fi.fact_instance_id = c.fact_instance_id
        where c.subject_id = v_subject_id
          and fi.registry_version = v_registry_version
          and fi.fact_key = p.fact_key
      )
      and not exists (
        select 1
        from public.product_fact_research_tasks t
        where t.subject_id = v_subject_id
          and t.fact_key = p.fact_key
          and t.registry_version = v_registry_version
          and t.research_policy_version = 'product-fact-required-policy-v1'
          and t.state in ('CONFIRMED','ALREADY_COVERED','BLOCKED')
      );

      if v_open_count = 0 then
        update public.catalog_trust_intake
        set trust_state = 'COMPLETED',
            completed_at = coalesce(completed_at, now()),
            last_checked_at = now(),
            updated_at = now()
        where id = v_intake.id;
      else
        update public.catalog_trust_intake
        set trust_state = 'RESEARCH_PENDING',
            completed_at = null,
            last_checked_at = now(),
            updated_at = now()
        where id = v_intake.id;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'status', 'processed',
    'product_id', p_product_id,
    'registry_version', v_registry_version,
    'registry_selection', 'explicit',
    'required_fact_policy_version', 'product-fact-required-policy-v1',
    'subject_resolution_version', 'product-fact-subject-resolution-v1',
    'policy_checks', v_policy_checks,
    'intakes_processed', v_intake_count,
    'tasks_touched', v_tasks_touched,
    'already_covered', v_tasks_covered
  );
end;
$$;

revoke all on function public.process_catalog_trust_product_v2(uuid,text)
  from public, anon, authenticated, service_role;
grant execute on function public.process_catalog_trust_product_v2(uuid,text)
  to service_role;

comment on function public.process_catalog_trust_product_v2(uuid,text) is
  'V2.1-8G0 service-role catalog trust processor with explicit Registry pinning and fail-closed per-Fact write-policy checks. Historical v1 processor is unchanged.';

do $$
declare
  v_def text;
begin
  if has_function_privilege(
      'anon',
      'public.admin_resolve_catalog_trust_intake_identity_v1(uuid,text,jsonb)',
      'EXECUTE'
    )
    or has_function_privilege(
      'authenticated',
      'public.admin_resolve_catalog_trust_intake_identity_v1(uuid,text,jsonb)',
      'EXECUTE'
    )
    or not has_function_privilege(
      'service_role',
      'public.admin_resolve_catalog_trust_intake_identity_v1(uuid,text,jsonb)',
      'EXECUTE'
    )
    or has_function_privilege(
      'anon',
      'public.process_catalog_trust_product_v2(uuid,text)',
      'EXECUTE'
    )
    or has_function_privilege(
      'authenticated',
      'public.process_catalog_trust_product_v2(uuid,text)',
      'EXECUTE'
    )
    or not has_function_privilege(
      'service_role',
      'public.process_catalog_trust_product_v2(uuid,text)',
      'EXECUTE'
    )
  then
    raise exception 'v21_8g0_rpc_privilege_invalid';
  end if;

  select pg_get_functiondef(
    'public.process_catalog_trust_product_v2(uuid,text)'::regprocedure
  ) into v_def;

  if position('order by effective_at' in lower(v_def)) > 0
    or position('product_fact_controlled_registry_write_admissibility_v2' in v_def) = 0
  then
    raise exception 'v21_8g0_registry_pin_contract_invalid';
  end if;
end $$;

commit;
