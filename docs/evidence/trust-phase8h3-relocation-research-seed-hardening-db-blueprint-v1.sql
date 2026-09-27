create or replace function public.claim_trust_research_tasks_v1(
  p_limit integer default 5,
  p_lease_seconds integer default 300
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if p_limit is null or p_limit < 1 or p_limit > 25 then
    raise exception 'trust_research_claim_limit_invalid';
  end if;
  if p_lease_seconds is null or p_lease_seconds < 30 or p_lease_seconds > 1800 then
    raise exception 'trust_research_lease_invalid';
  end if;

  update public.product_fact_research_tasks
     set state = 'RESEARCH_PENDING',
         next_retry_at = now(),
         blocker_code = 'WORKER_LEASE_EXPIRED',
         blocker_detail = 'Previous RESEARCHING lease expired before a result was recorded.',
         updated_at = now()
   where state = 'RESEARCHING'
     and last_research_at is not null
     and last_research_at < now() - make_interval(secs => p_lease_seconds);

  with eligible as (
    select rt.id
      from public.product_fact_research_tasks rt
      join public.catalog_trust_intake i on i.id = rt.intake_id
      join public.product_fact_subjects s on s.subject_id = rt.subject_id
     where rt.state = 'RESEARCH_PENDING'
       and rt.subject_id is not null
       and (rt.next_retry_at is null or rt.next_retry_at <= now())
       and i.identity_state = 'EXACT_SUBJECT_FOUND'
       and i.subject_id = rt.subject_id
       and s.product_id = rt.product_id
       and s.identity_status = 'resolved'
       and s.current_state = 'current'
       and s.market_applicability is not distinct from i.market
       and s.variant_key is null
     order by rt.priority desc, rt.created_at, rt.id
     for update of rt skip locked
     limit p_limit
  ), claimed as (
    update public.product_fact_research_tasks rt
       set state = 'RESEARCHING',
           attempt_count = rt.attempt_count + 1,
           next_retry_at = null,
           blocker_code = null,
           blocker_detail = null,
           last_research_at = now(),
           updated_at = now()
      from eligible e
     where rt.id = e.id
    returning rt.*
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'task_id', c.id,
      'product_id', c.product_id,
      'subject_id', c.subject_id,
      'fact_key', c.fact_key,
      'registry_version', c.registry_version,
      'research_policy_version', c.research_policy_version,
      'attempt_count', c.attempt_count,
      'official_source_seeds', coalesce((
        select jsonb_agg(jsonb_build_object(
          'source_binding_id', psb.binding_id,
          'source_name', psb.source_name,
          'external_type', psb.external_type,
          'binding_method', psb.binding_method,
          'product_scope_state', psb.product_scope_state,
          'canonical_locator', psb.source_url,
          'market', psb.market_code,
          'locale', psb.locale
        ) order by psb.created_at, psb.binding_id)
          from public.product_source_bindings psb
          join public.catalog_trust_intake i2 on i2.id = c.intake_id
         where psb.product_id = c.product_id
           and psb.binding_state = 'resolved'
           and psb.source_name ~ '_official$'
           and psb.source_url ~ '^https://'
           and (
             (
               not exists (
                 select 1
                   from public.product_fact_revalidation_research_bridges rb0
                   join public.product_fact_revalidation_transitions rt0
                     on rt0.transition_id = rb0.transition_id
                  where rb0.research_task_id = c.id
                    and rb0.disposition = 'RESEARCH_REQUEUED'
                    and rt0.reason_code = 'source_relocated'
               )
               and psb.market_code is not distinct from i2.market
             )
             or exists (
               select 1
                 from public.product_fact_revalidation_research_bridges rb0
                 join public.product_fact_revalidation_transitions rt0
                   on rt0.transition_id = rb0.transition_id
                 join public.trust_official_source_relocations r0
                   on r0.relocation_id = rt0.relocation_id
                 join public.trust_official_source_binding_reviews rv0
                   on rv0.review_id = r0.replacement_review_id
                where rb0.research_task_id = c.id
                  and rb0.disposition = 'RESEARCH_REQUEUED'
                  and rt0.reason_code = 'source_relocated'
                  and r0.result = 'confirmed'
                  and r0.product_id = c.product_id
                  and r0.subject_id = c.subject_id
                  and r0.replacement_binding_id = psb.binding_id
                  and rv0.binding_id = psb.binding_id
                  and rv0.product_id = c.product_id
                  and rv0.subject_id = c.subject_id
                  and rv0.scope_relation = 'equivalent'
             )
           )
      ), '[]'::jsonb),
      'current_fact_context', (
        select jsonb_build_object(
          'transition_id', rt0.transition_id,
          'relocation_id', rt0.relocation_id,
          'fact_instance_id', cf.fact_instance_id,
          'proposition_key', cf.proposition_key,
          'fact_key', cf.fact_key,
          'value_type', cf.value_type,
          'value_boolean', cf.value_boolean,
          'value_enum', cf.value_enum,
          'value_number', cf.value_number,
          'value_unit', cf.value_unit,
          'value_range_min', cf.value_range_min,
          'value_range_max', cf.value_range_max,
          'value_entity_identifier', cf.value_entity_identifier,
          'parent_fact_instance_id', cf.parent_fact_instance_id,
          'parent_proposition_key', cf.parent_proposition_key
        )
          from public.product_fact_revalidation_research_bridges rb0
          join public.product_fact_revalidation_transitions rt0
            on rt0.transition_id = rb0.transition_id
          join public.product_fact_instances cf
            on cf.fact_instance_id = rt0.fact_instance_id
         where rb0.research_task_id = c.id
           and rb0.disposition = 'RESEARCH_REQUEUED'
         limit 1
      ),
      'parent_propositions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'fact_instance_id', pf.fact_instance_id,
          'proposition_key', pf.proposition_key,
          'value_entity_identifier', pf.value_entity_identifier
        ))
          from public.product_fact_revalidation_research_bridges rb0
          join public.product_fact_revalidation_transitions rt0
            on rt0.transition_id = rb0.transition_id
          join public.product_fact_instances cf
            on cf.fact_instance_id = rt0.fact_instance_id
          join public.product_fact_instances pf
            on pf.fact_instance_id = cf.parent_fact_instance_id
         where rb0.research_task_id = c.id
           and rb0.disposition = 'RESEARCH_REQUEUED'
      ), '[]'::jsonb)
    )
    order by c.priority desc, c.created_at, c.id
  ), '[]'::jsonb)
    into v_result
    from claimed c;

  return v_result;
end;
$$;

revoke all on function public.claim_trust_research_tasks_v1(integer, integer)
  from public, anon, authenticated;
grant execute on function public.claim_trust_research_tasks_v1(integer, integer)
  to service_role;
