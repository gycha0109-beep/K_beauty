begin;

-- TRUST Phase 1 delivery hardening.
-- Keep promotion durable even if task materialization needs a later retry, and
-- reuse subject-scoped tasks across catalog revisions instead of duplicating them.

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
  v_subject_count integer;
  v_policy record;
  v_task_state text;
  v_existing_task_id uuid;
  v_existing_task_state text;
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
    v_subject_id := null;
    v_subject_count := 0;

    -- Never transfer NULL/global Product Fact Subjects into a market-scoped
    -- intake. Exact market identity is required for Phase 1 short-circuiting.
    if v_intake.market is not null then
      select count(*)::integer, max(subject_id::text)::uuid
        into v_subject_count, v_subject_id
      from public.product_fact_subjects
      where product_id = v_intake.product_id
        and identity_status = 'resolved'
        and current_state = 'current'
        and market_applicability = v_intake.market;
    end if;

    if v_subject_count = 1 then
      update public.catalog_trust_intake
      set subject_id = v_subject_id,
          identity_state = 'EXACT_SUBJECT_FOUND',
          started_at = coalesce(started_at, now()),
          last_checked_at = now(),
          updated_at = now()
      where id = v_intake.id;
    elsif v_subject_count > 1 then
      v_subject_id := null;
      update public.catalog_trust_intake
      set subject_id = null,
          identity_state = 'REVIEW_REQUIRED',
          trust_state = 'REVIEW_REQUIRED',
          started_at = coalesce(started_at, now()),
          last_checked_at = now(),
          updated_at = now()
      where id = v_intake.id;
    else
      update public.catalog_trust_intake
      set subject_id = null,
          identity_state = 'PENDING',
          trust_state = 'IDENTITY_RESOLVING',
          started_at = coalesce(started_at, now()),
          last_checked_at = now(),
          updated_at = now()
      where id = v_intake.id;
    end if;

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
      elsif v_subject_id is null then
        v_task_state := 'IDENTITY_PENDING';
      else
        v_task_state := 'RESEARCH_PENDING';
      end if;

      v_existing_task_id := null;
      v_existing_task_state := null;

      if v_subject_id is not null then
        select t.id, t.state
          into v_existing_task_id, v_existing_task_state
        from public.product_fact_research_tasks t
        where t.subject_id = v_subject_id
          and t.fact_key = v_policy.fact_key
          and t.registry_version = v_registry_version
          and t.research_policy_version = 'product-fact-required-policy-v1'
        order by t.created_at, t.id
        limit 1
        for update;
      end if;

      if v_existing_task_id is not null then
        update public.product_fact_research_tasks
        set state = case
              when v_task_state = 'ALREADY_COVERED' then 'ALREADY_COVERED'
              else state
            end,
            priority = least(priority, v_policy.priority),
            completed_at = case
              when v_task_state = 'ALREADY_COVERED' then coalesce(completed_at, now())
              else completed_at
            end,
            updated_at = now()
        where id = v_existing_task_id;
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
          0,
          now(),
          now(),
          case when v_task_state = 'ALREADY_COVERED' then now() else null end
        )
        on conflict (intake_id, fact_key, registry_version, research_policy_version)
        do update set
          subject_id = excluded.subject_id,
          state = case
            when public.product_fact_research_tasks.state in ('CONFIRMED','BLOCKED','EVIDENCE_CANDIDATE','PREFLIGHT_READY','REVIEW_REQUIRED')
              then public.product_fact_research_tasks.state
            else excluded.state
          end,
          priority = excluded.priority,
          completed_at = case
            when excluded.state = 'ALREADY_COVERED' then coalesce(public.product_fact_research_tasks.completed_at, now())
            else public.product_fact_research_tasks.completed_at
          end,
          updated_at = now();
      end if;

      v_tasks_touched := v_tasks_touched + 1;
      if v_task_state = 'ALREADY_COVERED' then
        v_tasks_covered := v_tasks_covered + 1;
      end if;
    end loop;

    if v_subject_count = 1 then
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

-- Current application review confirmation reaches promotion through this
-- compatibility entry point. Materialize tasks best-effort after the structural
-- promotion; the promotion itself remains durable even if processing must retry.
create or replace function public.promote_product_candidate(
  p_candidate_id uuid,
  p_actor text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
  v_product_id uuid;
begin
  v_result := public.promote_product_candidate_structural_v1(p_candidate_id, p_actor);
  v_product_id := nullif(v_result ->> 'product_id', '')::uuid;

  if v_product_id is not null and v_result ->> 'action' in ('inserted','merged','already_promoted') then
    begin
      perform public.process_catalog_trust_product_v1(v_product_id);
    exception when others then
      -- Intake enqueue is transactionally durable via the promotion trigger.
      -- Task processing is retryable and must never roll back catalog promotion.
      null;
    end;
  end if;

  return v_result;
end;
$$;

revoke all on function public.promote_product_candidate(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.promote_product_candidate(uuid, text)
  to service_role;

commit;
