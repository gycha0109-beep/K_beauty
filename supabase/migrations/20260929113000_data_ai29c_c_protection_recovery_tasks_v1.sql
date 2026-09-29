begin;

-- DATA-AI29C-C / sunscreen protection data recovery.
-- This is an operational recovery bridge only. It does not mutate Product Fact
-- authority, Recommendation authority, Product Query ranking, or activation state.

alter table public.product_fact_research_tasks
  drop constraint if exists product_fact_research_tasks_policy_version_check;

alter table public.product_fact_research_tasks
  add constraint product_fact_research_tasks_policy_version_check
  check (research_policy_version in (
    'product-fact-required-policy-v1',
    'data-ai29c-protection-recovery-v1'
  ));

create or replace function public.read_data_ai29c_protection_recovery_v1()
returns jsonb
language sql
security definer
set search_path = public, pg_temp
stable
as $$
with sunscreen as (
  select p.id as product_id, p.brand, p.name,
         p.water_resistant_minutes as legacy_water_resistant_minutes
  from public.products p
  where p.category = 'sunscreen'
),
subject_rollup as (
  select
    sun.product_id,
    count(s.subject_id)::integer as subject_count,
    (array_agg(s.subject_id order by s.subject_id))[1] as subject_id,
    (array_agg(s.market_applicability order by s.subject_id))[1] as market,
    (array_agg(s.identity_status order by s.subject_id))[1] as identity_status,
    (array_agg(s.current_state order by s.subject_id))[1] as current_state,
    (array_agg(s.valid_to order by s.subject_id))[1] as subject_valid_to
  from sunscreen sun
  left join public.product_fact_subjects s
    on s.product_id = sun.product_id
   and s.current_state = 'current'
  group by sun.product_id
),
fact_rollup as (
  select
    sr.product_id,
    count(*) filter (where fi.fact_key = 'spf_value')::integer as spf_count,
    count(*) filter (where fi.fact_key = 'uva_label')::integer as uva_count,
    count(*) filter (where fi.fact_key = 'water_resistance_duration')::integer as water_count,
    max(fi.value_number) filter (where fi.fact_key = 'spf_value') as spf_value,
    max(fi.value_enum) filter (where fi.fact_key = 'uva_label') as uva_label,
    max(fi.value_number) filter (where fi.fact_key = 'water_resistance_duration') as water_duration,
    max(fi.value_unit) filter (where fi.fact_key = 'water_resistance_duration') as water_unit,
    bool_or(
      fi.fact_key = 'spf_value'
      and fi.semantic_status = 'supported'
      and fi.authority_ceiling = 'product_specific_primary'
      and fi.fused_confidence in ('high','medium')
      and (fi.valid_to is null or fi.valid_to > current_date)
    ) as spf_eligible,
    bool_or(
      fi.fact_key = 'uva_label'
      and fi.semantic_status = 'supported'
      and fi.authority_ceiling = 'product_specific_primary'
      and fi.fused_confidence in ('high','medium')
      and (fi.valid_to is null or fi.valid_to > current_date)
    ) as uva_eligible,
    bool_or(
      fi.fact_key = 'water_resistance_duration'
      and fi.semantic_status = 'supported'
      and fi.authority_ceiling = 'product_specific_primary'
      and fi.fused_confidence in ('high','medium')
      and (fi.valid_to is null or fi.valid_to > current_date)
    ) as water_eligible,
    bool_or(fi.fact_key = 'spf_value' and fi.valid_to is not null and fi.valid_to <= current_date) as spf_stale,
    bool_or(fi.fact_key = 'uva_label' and fi.valid_to is not null and fi.valid_to <= current_date) as uva_stale,
    bool_or(fi.fact_key = 'water_resistance_duration' and fi.valid_to is not null and fi.valid_to <= current_date) as water_stale
  from subject_rollup sr
  left join public.product_fact_current c
    on c.subject_id = sr.subject_id
   and sr.subject_count = 1
  left join public.product_fact_instances fi
    on fi.fact_instance_id = c.fact_instance_id
  group by sr.product_id
),
rows as (
  select
    sun.product_id,
    sun.brand,
    sun.name,
    sun.legacy_water_resistant_minutes,
    sr.subject_count,
    case when sr.subject_count = 1 then sr.subject_id else null end as subject_id,
    case when sr.subject_count = 1 then sr.market else null end as market,
    case
      when sr.subject_count = 0 then 'missing'
      when sr.subject_count > 1 then 'ambiguous'
      when sr.identity_status <> 'resolved' or sr.current_state <> 'current' then 'ineligible'
      when sr.subject_valid_to is not null and sr.subject_valid_to <= current_date then 'stale'
      else 'resolved'
    end as subject_state,
    case
      when sr.subject_count <> 1 then 'unavailable'
      when fr.spf_count = 0 then 'missing'
      when fr.spf_count > 1 then 'ambiguous'
      when coalesce(fr.spf_stale,false) then 'stale'
      when coalesce(fr.spf_eligible,false) then 'resolved'
      else 'ineligible'
    end as spf_state,
    fr.spf_value,
    case
      when sr.subject_count <> 1 then 'unavailable'
      when fr.uva_count = 0 then 'missing'
      when fr.uva_count > 1 then 'ambiguous'
      when coalesce(fr.uva_stale,false) then 'stale'
      when coalesce(fr.uva_eligible,false) then 'resolved'
      else 'ineligible'
    end as uva_state,
    fr.uva_label,
    case
      when sr.subject_count <> 1 then 'unavailable'
      when fr.water_count = 0 then 'missing'
      when fr.water_count > 1 then 'ambiguous'
      when coalesce(fr.water_stale,false) then 'stale'
      when coalesce(fr.water_eligible,false) then 'resolved'
      else 'ineligible'
    end as water_state,
    fr.water_duration,
    fr.water_unit,
    i.id as intake_id,
    i.trust_state,
    uva_task.id as uva_task_id,
    uva_task.state as uva_task_state,
    uva_task.blocker_code as uva_task_blocker_code,
    water_task.id as water_task_id,
    water_task.state as water_task_state,
    water_task.blocker_code as water_task_blocker_code,
    water_task.research_policy_version as water_task_policy_version
  from sunscreen sun
  join subject_rollup sr on sr.product_id = sun.product_id
  join fact_rollup fr on fr.product_id = sun.product_id
  left join lateral (
    select i.*
    from public.catalog_trust_intake i
    where i.product_id = sun.product_id
      and sr.subject_count = 1
      and i.subject_id = sr.subject_id
      and i.identity_state = 'EXACT_SUBJECT_FOUND'
      and i.market is not distinct from sr.market
    order by i.updated_at desc, i.created_at desc, i.id desc
    limit 1
  ) i on true
  left join lateral (
    select t.*
    from public.product_fact_research_tasks t
    where sr.subject_count = 1
      and t.subject_id = sr.subject_id
      and t.fact_key = 'uva_label'
    order by t.updated_at desc, t.created_at desc, t.id desc
    limit 1
  ) uva_task on true
  left join lateral (
    select t.*
    from public.product_fact_research_tasks t
    where sr.subject_count = 1
      and t.subject_id = sr.subject_id
      and t.fact_key = 'water_resistance_duration'
    order by t.updated_at desc, t.created_at desc, t.id desc
    limit 1
  ) water_task on true
),
summary as (
  select
    count(*)::integer as sunscreen_count,
    count(*) filter (where spf_state = 'resolved')::integer as spf_eligible_count,
    count(*) filter (where uva_state = 'resolved')::integer as uva_eligible_count,
    count(*) filter (where water_state = 'resolved')::integer as water_eligible_count,
    count(distinct case
      when spf_state = 'resolved' and spf_value >= 50 then 'spf_50_plus_band'
      when spf_state = 'resolved' and spf_value >= 30 then 'spf_30_49'
      when spf_state = 'resolved' and spf_value >= 15 then 'spf_15_29'
      when spf_state = 'resolved' and spf_value > 0 then 'spf_below_15'
    end)::integer as spf_distinct_scoring_buckets,
    count(distinct case
      when uva_state = 'resolved' and uva_label = 'PA++++' then 'uva_high'
      when uva_state = 'resolved' and uva_label in ('PA+++','UVA-PF-declared') then 'uva_medium_high'
      when uva_state = 'resolved' and uva_label = 'PA++' then 'uva_medium'
      when uva_state = 'resolved' and uva_label = 'PA+' then 'uva_low'
    end)::integer as uva_distinct_scoring_buckets,
    count(distinct case
      when water_state = 'resolved' and water_duration >= 80 then 'water_80_plus'
      when water_state = 'resolved' and water_duration >= 40 then 'water_40_79'
      when water_state = 'resolved' and water_duration > 0 then 'water_1_39'
    end)::integer as water_distinct_scoring_buckets
  from rows
)
select jsonb_build_object(
  'contractVersion', 'data-ai29c-c-protection-recovery-v1',
  'productionCutoverAuthorized', false,
  'outdoorRankableSignalAuthorized', false,
  'summary', jsonb_build_object(
    'sunscreenCount', summary.sunscreen_count,
    'spfEligibleCount', summary.spf_eligible_count,
    'uvaEligibleCount', summary.uva_eligible_count,
    'waterEligibleCount', summary.water_eligible_count,
    'spfDistinctScoringBuckets', summary.spf_distinct_scoring_buckets,
    'uvaDistinctScoringBuckets', summary.uva_distinct_scoring_buckets,
    'waterDistinctScoringBuckets', summary.water_distinct_scoring_buckets
  ),
  'rows', coalesce((
    select jsonb_agg(jsonb_build_object(
      'productId', r.product_id,
      'brand', r.brand,
      'name', r.name,
      'subjectCount', r.subject_count,
      'subjectId', r.subject_id,
      'market', r.market,
      'subjectState', r.subject_state,
      'spf', jsonb_build_object('state',r.spf_state,'value',r.spf_value),
      'uva', jsonb_build_object(
        'state',r.uva_state,
        'value',r.uva_label,
        'taskId',r.uva_task_id,
        'taskState',r.uva_task_state,
        'blockerCode',r.uva_task_blocker_code
      ),
      'waterResistance', jsonb_build_object(
        'state',r.water_state,
        'duration',r.water_duration,
        'unit',r.water_unit,
        'legacyLeadPresent',r.legacy_water_resistant_minutes is not null,
        'taskId',r.water_task_id,
        'taskState',r.water_task_state,
        'blockerCode',r.water_task_blocker_code,
        'researchPolicyVersion',r.water_task_policy_version
      ),
      'trustIntakeId',r.intake_id,
      'trustState',r.trust_state
    ) order by r.brand, r.name, r.product_id)
    from rows r
  ), '[]'::jsonb)
)
from summary;
$$;

comment on function public.read_data_ai29c_protection_recovery_v1() is
  'DATA-AI29C-C bounded operational recovery audit. Never authorizes Product Query ranking or Product Fact mutation.';

create or replace function public.enqueue_data_ai29c_protection_recovery_tasks_v1()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_registry_version text;
  v_inserted_count integer := 0;
  v_existing_task_count integer := 0;
  v_missing_intake_count integer := 0;
  v_ambiguous_subject_count integer := 0;
begin
  select registry_version
  into v_registry_version
  from public.product_fact_registry_versions
  order by coalesce(effective_at, created_at) desc, created_at desc, registry_version desc
  limit 1;

  if v_registry_version is null then
    raise exception 'data_ai29c_c_registry_unavailable';
  end if;

  if not exists (
    select 1
    from public.product_fact_definition_snapshots d
    where d.registry_version = v_registry_version
      and d.fact_key = 'water_resistance_duration'
      and d.deprecated = false
      and d.value_type = 'number_unit'
  ) then
    raise exception 'data_ai29c_c_water_resistance_registry_unavailable';
  end if;

  with subject_counts as (
    select
      p.id as product_id,
      count(s.subject_id)::integer as subject_count,
      (array_agg(s.subject_id order by s.subject_id))[1] as subject_id,
      (array_agg(s.market_applicability order by s.subject_id))[1] as market
    from public.products p
    left join public.product_fact_subjects s
      on s.product_id = p.id
     and s.identity_status = 'resolved'
     and s.current_state = 'current'
     and (s.valid_to is null or s.valid_to > current_date)
    where p.category = 'sunscreen'
    group by p.id
  )
  select count(*)::integer
  into v_ambiguous_subject_count
  from subject_counts
  where subject_count <> 1;

  with single_subject as (
    select
      p.id as product_id,
      s.subject_id,
      s.market_applicability as market
    from public.products p
    join public.product_fact_subjects s
      on s.product_id = p.id
     and s.identity_status = 'resolved'
     and s.current_state = 'current'
     and (s.valid_to is null or s.valid_to > current_date)
    where p.category = 'sunscreen'
      and (
        select count(*)
        from public.product_fact_subjects sx
        where sx.product_id = p.id
          and sx.identity_status = 'resolved'
          and sx.current_state = 'current'
          and (sx.valid_to is null or sx.valid_to > current_date)
      ) = 1
  ),
  missing_water as (
    select ss.*
    from single_subject ss
    where not exists (
      select 1
      from public.product_fact_current c
      join public.product_fact_instances fi
        on fi.fact_instance_id = c.fact_instance_id
      where c.subject_id = ss.subject_id
        and fi.registry_version = v_registry_version
        and fi.fact_key = 'water_resistance_duration'
        and fi.semantic_status = 'supported'
        and fi.authority_ceiling = 'product_specific_primary'
        and fi.fused_confidence in ('high','medium')
        and (fi.valid_to is null or fi.valid_to > current_date)
    )
  )
  select count(*)::integer
  into v_existing_task_count
  from missing_water mw
  where exists (
    select 1
    from public.product_fact_research_tasks t
    where t.subject_id = mw.subject_id
      and t.fact_key = 'water_resistance_duration'
  );

  with single_subject as (
    select
      p.id as product_id,
      s.subject_id,
      s.market_applicability as market
    from public.products p
    join public.product_fact_subjects s
      on s.product_id = p.id
     and s.identity_status = 'resolved'
     and s.current_state = 'current'
     and (s.valid_to is null or s.valid_to > current_date)
    where p.category = 'sunscreen'
      and (
        select count(*)
        from public.product_fact_subjects sx
        where sx.product_id = p.id
          and sx.identity_status = 'resolved'
          and sx.current_state = 'current'
          and (sx.valid_to is null or sx.valid_to > current_date)
      ) = 1
  ),
  missing_water as (
    select ss.*
    from single_subject ss
    where not exists (
      select 1
      from public.product_fact_current c
      join public.product_fact_instances fi
        on fi.fact_instance_id = c.fact_instance_id
      where c.subject_id = ss.subject_id
        and fi.registry_version = v_registry_version
        and fi.fact_key = 'water_resistance_duration'
        and fi.semantic_status = 'supported'
        and fi.authority_ceiling = 'product_specific_primary'
        and fi.fused_confidence in ('high','medium')
        and (fi.valid_to is null or fi.valid_to > current_date)
    )
      and not exists (
        select 1
        from public.product_fact_research_tasks t
        where t.subject_id = ss.subject_id
          and t.fact_key = 'water_resistance_duration'
      )
  )
  select count(*)::integer
  into v_missing_intake_count
  from missing_water mw
  where not exists (
    select 1
    from public.catalog_trust_intake i
    where i.product_id = mw.product_id
      and i.subject_id = mw.subject_id
      and i.identity_state = 'EXACT_SUBJECT_FOUND'
      and i.market is not distinct from mw.market
  );

  with single_subject as (
    select
      p.id as product_id,
      s.subject_id,
      s.market_applicability as market
    from public.products p
    join public.product_fact_subjects s
      on s.product_id = p.id
     and s.identity_status = 'resolved'
     and s.current_state = 'current'
     and (s.valid_to is null or s.valid_to > current_date)
    where p.category = 'sunscreen'
      and (
        select count(*)
        from public.product_fact_subjects sx
        where sx.product_id = p.id
          and sx.identity_status = 'resolved'
          and sx.current_state = 'current'
          and (sx.valid_to is null or sx.valid_to > current_date)
      ) = 1
  ),
  candidates as (
    select
      ss.product_id,
      ss.subject_id,
      i.id as intake_id
    from single_subject ss
    join lateral (
      select i.id
      from public.catalog_trust_intake i
      where i.product_id = ss.product_id
        and i.subject_id = ss.subject_id
        and i.identity_state = 'EXACT_SUBJECT_FOUND'
        and i.market is not distinct from ss.market
      order by i.updated_at desc, i.created_at desc, i.id desc
      limit 1
    ) i on true
    where not exists (
      select 1
      from public.product_fact_current c
      join public.product_fact_instances fi
        on fi.fact_instance_id = c.fact_instance_id
      where c.subject_id = ss.subject_id
        and fi.registry_version = v_registry_version
        and fi.fact_key = 'water_resistance_duration'
        and fi.semantic_status = 'supported'
        and fi.authority_ceiling = 'product_specific_primary'
        and fi.fused_confidence in ('high','medium')
        and (fi.valid_to is null or fi.valid_to > current_date)
    )
      and not exists (
        select 1
        from public.product_fact_research_tasks t
        where t.subject_id = ss.subject_id
          and t.fact_key = 'water_resistance_duration'
      )
  ),
  inserted as (
    insert into public.product_fact_research_tasks (
      intake_id,
      product_id,
      subject_id,
      fact_key,
      registry_version,
      research_policy_version,
      state,
      priority,
      created_at,
      updated_at
    )
    select
      c.intake_id,
      c.product_id,
      c.subject_id,
      'water_resistance_duration',
      v_registry_version,
      'data-ai29c-protection-recovery-v1',
      'RESEARCH_PENDING',
      95,
      now(),
      now()
    from candidates c
    on conflict do nothing
    returning id, intake_id
  ),
  reopened as (
    update public.catalog_trust_intake i
    set trust_state = 'RESEARCH_PENDING',
        completed_at = null,
        last_checked_at = now(),
        updated_at = now()
    where i.id in (select inserted.intake_id from inserted)
    returning i.id
  )
  select count(*)::integer
  into v_inserted_count
  from inserted;

  return jsonb_build_object(
    'contractVersion', 'data-ai29c-c-protection-recovery-v1',
    'researchPolicyVersion', 'data-ai29c-protection-recovery-v1',
    'factKey', 'water_resistance_duration',
    'insertedTaskCount', v_inserted_count,
    'existingTaskCount', v_existing_task_count,
    'missingExactIntakeCount', v_missing_intake_count,
    'ambiguousOrMissingSubjectCount', v_ambiguous_subject_count,
    'productFactAuthorityMutated', false,
    'recommendationAuthorityMutated', false,
    'productionCutoverAuthorized', false
  );
end;
$$;

comment on function public.enqueue_data_ai29c_protection_recovery_tasks_v1() is
  'DATA-AI29C-C explicit operational task generator for missing governed water-resistance duration only. It never confirms facts or changes Recommendation.';

revoke all on function public.read_data_ai29c_protection_recovery_v1()
  from public, anon, authenticated;
revoke all on function public.enqueue_data_ai29c_protection_recovery_tasks_v1()
  from public, anon, authenticated;

grant execute on function public.read_data_ai29c_protection_recovery_v1()
  to service_role;
grant execute on function public.enqueue_data_ai29c_protection_recovery_tasks_v1()
  to service_role;

commit;
