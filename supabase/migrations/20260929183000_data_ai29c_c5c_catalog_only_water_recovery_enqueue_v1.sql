begin;

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
  v_legacy_category_eligible_count integer := 0;
  v_catalog_only_taxonomy_eligible_count integer := 0;
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

  select count(*)::integer
  into v_legacy_category_eligible_count
  from public.products p
  where p.category = 'sunscreen';

  select count(distinct a.product_id)::integer
  into v_catalog_only_taxonomy_eligible_count
  from public.product_catalog_taxonomy_assignments a
  join public.products p on p.id = a.product_id
  where p.category is null
    and a.taxonomy_version = 'catalog-taxonomy-v1'
    and a.category_term_id = 'catalog-taxonomy-v1:category:sunscreen'
    and a.assignment_state = 'shadow';

  with eligible_products as (
    select p.id as product_id
    from public.products p
    where p.category = 'sunscreen'
       or exists (
         select 1
         from public.product_catalog_taxonomy_assignments a
         where a.product_id = p.id
           and a.taxonomy_version = 'catalog-taxonomy-v1'
           and a.category_term_id = 'catalog-taxonomy-v1:category:sunscreen'
           and a.assignment_state = 'shadow'
       )
  ),
  subject_counts as (
    select
      ep.product_id,
      count(s.subject_id)::integer as subject_count
    from eligible_products ep
    left join public.product_fact_subjects s
      on s.product_id = ep.product_id
     and s.identity_status = 'resolved'
     and s.current_state = 'current'
     and (s.valid_to is null or s.valid_to > current_date)
    group by ep.product_id
  )
  select count(*)::integer
  into v_ambiguous_subject_count
  from subject_counts
  where subject_count <> 1;

  with eligible_products as (
    select p.id as product_id
    from public.products p
    where p.category = 'sunscreen'
       or exists (
         select 1
         from public.product_catalog_taxonomy_assignments a
         where a.product_id = p.id
           and a.taxonomy_version = 'catalog-taxonomy-v1'
           and a.category_term_id = 'catalog-taxonomy-v1:category:sunscreen'
           and a.assignment_state = 'shadow'
       )
  ),
  single_subject as (
    select
      ep.product_id,
      s.subject_id,
      s.market_applicability as market
    from eligible_products ep
    join public.product_fact_subjects s
      on s.product_id = ep.product_id
     and s.identity_status = 'resolved'
     and s.current_state = 'current'
     and (s.valid_to is null or s.valid_to > current_date)
    where (
      select count(*)
      from public.product_fact_subjects sx
      where sx.product_id = ep.product_id
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

  with eligible_products as (
    select p.id as product_id
    from public.products p
    where p.category = 'sunscreen'
       or exists (
         select 1
         from public.product_catalog_taxonomy_assignments a
         where a.product_id = p.id
           and a.taxonomy_version = 'catalog-taxonomy-v1'
           and a.category_term_id = 'catalog-taxonomy-v1:category:sunscreen'
           and a.assignment_state = 'shadow'
       )
  ),
  single_subject as (
    select
      ep.product_id,
      s.subject_id,
      s.market_applicability as market
    from eligible_products ep
    join public.product_fact_subjects s
      on s.product_id = ep.product_id
     and s.identity_status = 'resolved'
     and s.current_state = 'current'
     and (s.valid_to is null or s.valid_to > current_date)
    where (
      select count(*)
      from public.product_fact_subjects sx
      where sx.product_id = ep.product_id
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
      join public.product_fact_instances fi on fi.fact_instance_id = c.fact_instance_id
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

  with eligible_products as (
    select p.id as product_id
    from public.products p
    where p.category = 'sunscreen'
       or exists (
         select 1
         from public.product_catalog_taxonomy_assignments a
         where a.product_id = p.id
           and a.taxonomy_version = 'catalog-taxonomy-v1'
           and a.category_term_id = 'catalog-taxonomy-v1:category:sunscreen'
           and a.assignment_state = 'shadow'
       )
  ),
  single_subject as (
    select
      ep.product_id,
      s.subject_id,
      s.market_applicability as market
    from eligible_products ep
    join public.product_fact_subjects s
      on s.product_id = ep.product_id
     and s.identity_status = 'resolved'
     and s.current_state = 'current'
     and (s.valid_to is null or s.valid_to > current_date)
    where (
      select count(*)
      from public.product_fact_subjects sx
      where sx.product_id = ep.product_id
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
      join public.product_fact_instances fi on fi.fact_instance_id = c.fact_instance_id
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
    'legacyCategoryEligibleCount', v_legacy_category_eligible_count,
    'catalogOnlyTaxonomyEligibleCount', v_catalog_only_taxonomy_eligible_count,
    'productFactAuthorityMutated', false,
    'recommendationAuthorityMutated', false,
    'productionCutoverAuthorized', false
  );
end;
$$;

comment on function public.enqueue_data_ai29c_protection_recovery_tasks_v1() is
  'DATA-AI29C-C service-role recovery enqueue. Includes legacy sunscreen category rows and catalog-only canonical sunscreen taxonomy shadow assignments; writes research tasks only and never Product Fact or Recommendation authority.';

revoke all on function public.enqueue_data_ai29c_protection_recovery_tasks_v1()
  from public, anon, authenticated, service_role;
grant execute on function public.enqueue_data_ai29c_protection_recovery_tasks_v1()
  to service_role;

commit;
