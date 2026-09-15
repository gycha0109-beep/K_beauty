begin;

-- TRUST Phase 2 / Product Fact Subject resolution.
-- Operational identity resolution only. This migration never creates or mutates
-- Product Fact Subjects and never calls the governed Subject registration RPC.

alter table public.catalog_trust_intake
  drop constraint if exists catalog_trust_intake_identity_state_check;

alter table public.catalog_trust_intake
  add column if not exists identity_resolution_version text not null
    default 'product-fact-subject-resolution-v1',
  add column if not exists identity_resolution_detail jsonb not null
    default '{}'::jsonb;

alter table public.catalog_trust_intake
  add constraint catalog_trust_intake_identity_state_check
    check (identity_state in (
      'PENDING',
      'EXACT_SUBJECT_FOUND',
      'SUBJECT_CANDIDATE_FOUND',
      'SUBJECT_CREATION_REQUIRED',
      'IDENTITY_BLOCKED',
      'VARIANT_CONFLICT',
      'FORMULATION_CONFLICT',
      'MARKET_CONFLICT'
    )),
  add constraint catalog_trust_intake_identity_resolution_version_check
    check (char_length(btrim(identity_resolution_version)) between 1 and 160),
  add constraint catalog_trust_intake_identity_resolution_detail_check
    check (jsonb_typeof(identity_resolution_detail) = 'object');

create index if not exists catalog_trust_intake_identity_state_idx
  on public.catalog_trust_intake(identity_state, updated_at desc);

create or replace function public.resolve_catalog_trust_subject_v1(p_intake_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_intake public.catalog_trust_intake%rowtype;
  v_source_identity_state text;
  v_source_identity_version text;
  v_total_subject_count integer := 0;
  v_exact_current_count integer := 0;
  v_exact_market_count integer := 0;
  v_other_market_count integer := 0;
  v_formulation_count integer := 0;
  v_variant_count integer := 0;
  v_subject_id uuid;
  v_candidate_subject_id uuid;
  v_subject_ids jsonb := '[]'::jsonb;
  v_identity_state text;
  v_trust_state text;
  v_reason_code text;
  v_detail jsonb;
begin
  select * into v_intake
  from public.catalog_trust_intake
  where id = p_intake_id
  for update;

  if not found then
    raise exception 'catalog_trust_intake_not_found' using errcode = 'P0002';
  end if;

  v_detail := jsonb_build_object(
    'resolver_version', 'product-fact-subject-resolution-v1',
    'product_id', v_intake.product_id,
    'market', v_intake.market,
    'source_candidate_id', v_intake.source_candidate_id
  );

  -- Reuse the catalog identity authority already produced upstream. A promoted
  -- candidate that is not catalog-identity-resolved must never be upgraded into
  -- an exact Product Fact Subject association by TRUST.
  if v_intake.source_candidate_id is not null then
    select pc.identity_resolution_state, pc.identity_resolution_version
      into v_source_identity_state, v_source_identity_version
    from public.product_candidates pc
    where pc.id = v_intake.source_candidate_id;

    if not found then
      v_identity_state := 'IDENTITY_BLOCKED';
      v_reason_code := 'source_candidate_missing';
    elsif v_source_identity_state = 'variant_scope_conflict' then
      v_identity_state := 'VARIANT_CONFLICT';
      v_reason_code := 'catalog_variant_scope_conflict';
    elsif v_source_identity_state = 'formulation_conflict' then
      v_identity_state := 'FORMULATION_CONFLICT';
      v_reason_code := 'catalog_formulation_conflict';
    elsif v_source_identity_state = 'market_conflict' then
      v_identity_state := 'MARKET_CONFLICT';
      v_reason_code := 'catalog_market_conflict';
    elsif v_source_identity_state <> 'resolved' then
      v_identity_state := 'IDENTITY_BLOCKED';
      v_reason_code := 'catalog_identity_not_resolved';
    end if;

    v_detail := v_detail || jsonb_build_object(
      'catalog_identity_state', v_source_identity_state,
      'catalog_identity_version', v_source_identity_version
    );
  end if;

  if v_identity_state is null and v_intake.market is null then
    v_identity_state := 'IDENTITY_BLOCKED';
    v_reason_code := 'intake_market_unresolved';
  end if;

  if v_identity_state is null then
    select count(*)::integer
      into v_total_subject_count
    from public.product_fact_subjects s
    where s.product_id = v_intake.product_id;

    select
      count(*)::integer,
      min(s.subject_id::text)::uuid,
      count(distinct coalesce(s.formulation_revision_key, '<null>'))::integer,
      count(distinct coalesce(s.variant_key, '<null>'))::integer,
      coalesce(jsonb_agg(s.subject_id order by s.subject_id), '[]'::jsonb)
      into v_exact_current_count, v_subject_id, v_formulation_count, v_variant_count, v_subject_ids
    from public.product_fact_subjects s
    where s.product_id = v_intake.product_id
      and s.identity_status = 'resolved'
      and s.current_state = 'current'
      and s.market_applicability = v_intake.market;

    if v_exact_current_count = 1 then
      v_identity_state := 'EXACT_SUBJECT_FOUND';
      v_reason_code := 'single_current_resolved_exact_market_subject';
    elsif v_exact_current_count > 1 then
      v_subject_id := null;
      if v_formulation_count > 1 then
        v_identity_state := 'FORMULATION_CONFLICT';
        v_reason_code := 'multiple_current_formulations_exact_market';
      elsif v_variant_count > 1 then
        v_identity_state := 'VARIANT_CONFLICT';
        v_reason_code := 'multiple_current_variants_exact_market';
      else
        v_identity_state := 'IDENTITY_BLOCKED';
        v_reason_code := 'multiple_current_subjects_exact_market';
      end if;
    else
      select
        count(*)::integer,
        min(s.subject_id::text)::uuid,
        count(distinct coalesce(s.formulation_revision_key, '<null>'))::integer,
        count(distinct coalesce(s.variant_key, '<null>'))::integer,
        coalesce(jsonb_agg(s.subject_id order by s.subject_id), '[]'::jsonb)
        into v_exact_market_count, v_candidate_subject_id, v_formulation_count, v_variant_count, v_subject_ids
      from public.product_fact_subjects s
      where s.product_id = v_intake.product_id
        and s.market_applicability = v_intake.market;

      if v_exact_market_count = 1 then
        v_identity_state := 'SUBJECT_CANDIDATE_FOUND';
        v_reason_code := 'single_noncurrent_or_nonresolved_exact_market_subject';
      elsif v_exact_market_count > 1 then
        if v_formulation_count > 1 then
          v_identity_state := 'FORMULATION_CONFLICT';
          v_reason_code := 'multiple_candidate_formulations_exact_market';
        elsif v_variant_count > 1 then
          v_identity_state := 'VARIANT_CONFLICT';
          v_reason_code := 'multiple_candidate_variants_exact_market';
        else
          v_identity_state := 'IDENTITY_BLOCKED';
          v_reason_code := 'multiple_candidate_subjects_exact_market';
        end if;
      else
        select count(*)::integer into v_other_market_count
        from public.product_fact_subjects s
        where s.product_id = v_intake.product_id
          and s.market_applicability is distinct from v_intake.market;

        if v_other_market_count > 0 then
          v_identity_state := 'MARKET_CONFLICT';
          v_reason_code := 'subjects_exist_only_outside_exact_market';
        elsif v_total_subject_count = 0 then
          v_identity_state := 'SUBJECT_CREATION_REQUIRED';
          v_reason_code := 'no_product_fact_subject_exists';
        else
          v_identity_state := 'IDENTITY_BLOCKED';
          v_reason_code := 'subject_identity_unclassifiable';
        end if;
      end if;
    end if;
  end if;

  if v_identity_state = 'EXACT_SUBJECT_FOUND' then
    v_trust_state := case
      when v_intake.trust_state = 'COMPLETED' then 'COMPLETED'
      else 'RESEARCH_PENDING'
    end;
  elsif v_identity_state in ('SUBJECT_CANDIDATE_FOUND', 'SUBJECT_CREATION_REQUIRED') then
    v_trust_state := 'REVIEW_REQUIRED';
  else
    v_trust_state := 'BLOCKED';
  end if;

  v_detail := v_detail || jsonb_build_object(
    'reason_code', v_reason_code,
    'total_subject_count', v_total_subject_count,
    'exact_current_count', v_exact_current_count,
    'exact_market_count', v_exact_market_count,
    'other_market_count', v_other_market_count,
    'candidate_subject_id', v_candidate_subject_id,
    'subject_ids', v_subject_ids
  );

  update public.catalog_trust_intake
  set subject_id = case when v_identity_state = 'EXACT_SUBJECT_FOUND' then v_subject_id else null end,
      identity_state = v_identity_state,
      identity_resolution_version = 'product-fact-subject-resolution-v1',
      identity_resolution_detail = v_detail,
      trust_state = v_trust_state,
      started_at = coalesce(started_at, now()),
      completed_at = case when v_trust_state = 'COMPLETED' then completed_at else null end,
      last_checked_at = now(),
      updated_at = now()
  where id = v_intake.id;

  return jsonb_build_object(
    'status', 'resolved',
    'intake_id', v_intake.id,
    'product_id', v_intake.product_id,
    'identity_state', v_identity_state,
    'subject_id', case when v_identity_state = 'EXACT_SUBJECT_FOUND' then v_subject_id else null end,
    'trust_state', v_trust_state,
    'detail', v_detail
  );
end;
$$;

revoke all on function public.resolve_catalog_trust_subject_v1(uuid)
  from public, anon, authenticated;
grant execute on function public.resolve_catalog_trust_subject_v1(uuid)
  to service_role;

comment on function public.resolve_catalog_trust_subject_v1(uuid) is
  'TRUST Phase 2 service-role Subject resolver. Reuses existing Product Fact Subjects only; never creates or mutates Subject authority.';

create or replace function public.process_catalog_trust_product_v1(p_product_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_registry_version text;
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
  v_open_count integer;
begin
  if p_product_id is null or not exists(select 1 from public.products where id = p_product_id) then
    raise exception 'catalog_trust_product_not_found' using errcode = 'P0002';
  end if;

  select registry_version into v_registry_version
  from public.product_fact_registry_versions
  order by effective_at desc nulls last, created_at desc
  limit 1;

  if v_registry_version is null then
    raise exception 'catalog_trust_registry_unavailable' using errcode = '23514';
  end if;

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

    if v_policy_count = 0 then
      update public.catalog_trust_intake
      set trust_state = 'BLOCKED', last_checked_at = now(), updated_at = now()
      where id = v_intake.id;
      continue;
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
        raise exception 'catalog_trust_required_fact_registry_mismatch:%:%', v_intake.category, v_policy.fact_key
          using errcode = '23514';
      end if;

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
      elsif v_intake.identity_state in ('SUBJECT_CANDIDATE_FOUND', 'SUBJECT_CREATION_REQUIRED') then
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

      if v_subject_id is not null and v_existing_task_id is not null then
        if v_intake_task_id is not null and v_intake_task_id <> v_existing_task_id then
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
            delete from public.product_fact_research_tasks where id = v_intake_task_id;
            v_intake_task_id := null;
          else
            raise exception 'catalog_trust_identity_task_reconciliation_required:%', v_intake_task_id
              using errcode = '23514';
          end if;
        end if;

        update public.product_fact_research_tasks
        set state = case
              when v_task_state = 'ALREADY_COVERED' then 'ALREADY_COVERED'
              when state in ('CONFIRMED','EVIDENCE_CANDIDATE','PREFLIGHT_READY') then state
              when state in ('REVIEW_REQUIRED','BLOCKED')
                and coalesce(blocker_code, '') not in (
                  'SUBJECT_CANDIDATE_FOUND','SUBJECT_CREATION_REQUIRED','IDENTITY_BLOCKED',
                  'VARIANT_CONFLICT','FORMULATION_CONFLICT','MARKET_CONFLICT'
                ) then state
              else v_task_state
            end,
            priority = least(priority, v_policy.priority),
            blocker_code = case
              when v_task_state = 'ALREADY_COVERED' then null
              when state in ('CONFIRMED','EVIDENCE_CANDIDATE','PREFLIGHT_READY') then blocker_code
              when state in ('REVIEW_REQUIRED','BLOCKED')
                and coalesce(blocker_code, '') not in (
                  'SUBJECT_CANDIDATE_FOUND','SUBJECT_CREATION_REQUIRED','IDENTITY_BLOCKED',
                  'VARIANT_CONFLICT','FORMULATION_CONFLICT','MARKET_CONFLICT'
                ) then blocker_code
              else v_task_blocker_code
            end,
            blocker_detail = case
              when v_task_state = 'ALREADY_COVERED' then null
              when state in ('CONFIRMED','EVIDENCE_CANDIDATE','PREFLIGHT_READY') then blocker_detail
              when state in ('REVIEW_REQUIRED','BLOCKED')
                and coalesce(blocker_code, '') not in (
                  'SUBJECT_CANDIDATE_FOUND','SUBJECT_CREATION_REQUIRED','IDENTITY_BLOCKED',
                  'VARIANT_CONFLICT','FORMULATION_CONFLICT','MARKET_CONFLICT'
                ) then blocker_detail
              else v_task_blocker_detail
            end,
            completed_at = case
              when v_task_state = 'ALREADY_COVERED' then coalesce(completed_at, now())
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
            completed_at = case when v_task_state = 'ALREADY_COVERED' then coalesce(completed_at, now()) else null end,
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
        on conflict (intake_id, fact_key, registry_version, research_policy_version)
        do update set
          subject_id = excluded.subject_id,
          state = case
            when public.product_fact_research_tasks.state in ('CONFIRMED','EVIDENCE_CANDIDATE','PREFLIGHT_READY')
              then public.product_fact_research_tasks.state
            else excluded.state
          end,
          priority = least(public.product_fact_research_tasks.priority, excluded.priority),
          blocker_code = case
            when public.product_fact_research_tasks.state in ('CONFIRMED','EVIDENCE_CANDIDATE','PREFLIGHT_READY')
              then public.product_fact_research_tasks.blocker_code
            else excluded.blocker_code
          end,
          blocker_detail = case
            when public.product_fact_research_tasks.state in ('CONFIRMED','EVIDENCE_CANDIDATE','PREFLIGHT_READY')
              then public.product_fact_research_tasks.blocker_detail
            else excluded.blocker_detail
          end,
          completed_at = case
            when excluded.state = 'ALREADY_COVERED' then coalesce(public.product_fact_research_tasks.completed_at, now())
            when public.product_fact_research_tasks.state = 'CONFIRMED' then public.product_fact_research_tasks.completed_at
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
        join public.product_fact_instances fi on fi.fact_instance_id = c.fact_instance_id
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
        set trust_state = 'COMPLETED', completed_at = coalesce(completed_at, now()), last_checked_at = now(), updated_at = now()
        where id = v_intake.id;
      else
        update public.catalog_trust_intake
        set trust_state = 'RESEARCH_PENDING', completed_at = null, last_checked_at = now(), updated_at = now()
        where id = v_intake.id;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'status', 'processed',
    'product_id', p_product_id,
    'registry_version', v_registry_version,
    'required_fact_policy_version', 'product-fact-required-policy-v1',
    'subject_resolution_version', 'product-fact-subject-resolution-v1',
    'intakes_processed', v_intake_count,
    'tasks_touched', v_tasks_touched,
    'already_covered', v_tasks_covered
  );
end;
$$;

revoke all on function public.process_catalog_trust_product_v1(uuid)
  from public, anon, authenticated;
grant execute on function public.process_catalog_trust_product_v1(uuid)
  to service_role;

create or replace function public.read_catalog_trust_product_status_v1(p_product_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'product_id', p_product_id,
    'intakes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id,
        'catalog_revision', i.catalog_revision,
        'category', i.category,
        'market', i.market,
        'subject_id', i.subject_id,
        'identity_state', i.identity_state,
        'identity_resolution_version', i.identity_resolution_version,
        'identity_resolution_detail', i.identity_resolution_detail,
        'trust_state', i.trust_state,
        'required_fact_policy_version', i.required_fact_policy_version,
        'created_at', i.created_at,
        'last_checked_at', i.last_checked_at,
        'tasks', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', t.id,
            'origin_intake_id', t.intake_id,
            'fact_key', t.fact_key,
            'registry_version', t.registry_version,
            'state', t.state,
            'priority', t.priority,
            'subject_id', t.subject_id,
            'blocker_code', t.blocker_code,
            'blocker_detail', t.blocker_detail,
            'attempt_count', t.attempt_count,
            'completed_at', t.completed_at
          ) order by t.priority, t.fact_key)
          from public.product_fact_research_tasks t
          where t.intake_id = i.id
             or (i.subject_id is not null and t.subject_id = i.subject_id)
        ), '[]'::jsonb)
      ) order by i.created_at, i.id)
      from public.catalog_trust_intake i
      where i.product_id = p_product_id
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.read_catalog_trust_product_status_v1(uuid)
  from public, anon, authenticated;
grant execute on function public.read_catalog_trust_product_status_v1(uuid)
  to service_role;

commit;
