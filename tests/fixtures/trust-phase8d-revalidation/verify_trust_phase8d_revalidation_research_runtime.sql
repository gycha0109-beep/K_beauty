\set ON_ERROR_STOP on

create temporary table trust_phase8d_context as
select
  tr.transition_id,
  tr.assignment_id,
  tr.proposition_key,
  tr.fact_instance_id,
  tr.confirmation_id,
  a.subject_id,
  a.fact_key,
  a.registry_version,
  t.id as research_task_id,
  t.source_observation_id,
  t.evidence_candidate_id
from public.product_fact_revalidation_transitions tr
join public.product_fact_review_assignments a
  on a.assignment_id=tr.assignment_id
left join public.product_fact_research_tasks t
  on t.subject_id=a.subject_id
 and t.fact_key=a.fact_key
 and t.registry_version=a.registry_version
 and t.research_policy_version='product-fact-required-policy-v1'
where tr.request_id='phase8c-revalidate-0001'
limit 1;

do $$
declare
  v_ctx record;
  v_bridge jsonb;
  v_replay jsonb;
  v_claimed jsonb;
  v_result jsonb;
  v_observation public.trust_source_observations%rowtype;
  v_candidate public.trust_evidence_candidates%rowtype;
  v_fact_count bigint;
  v_current_count bigint;
  v_confirmation_count bigint;
  v_current_fact uuid;
  v_current_confirmation uuid;
begin
  select * into v_ctx from trust_phase8d_context;
  if not found or v_ctx.research_task_id is null then
    raise exception 'phase8d_fixture_context_missing';
  end if;

  select count(*) into v_fact_count from public.product_fact_instances;
  select count(*) into v_current_count from public.product_fact_current;
  select count(*) into v_confirmation_count from public.product_fact_confirmations;
  v_current_fact := v_ctx.fact_instance_id;
  v_current_confirmation := v_ctx.confirmation_id;

  select * into v_observation
  from public.trust_source_observations
  where observation_id=v_ctx.source_observation_id;

  select * into v_candidate
  from public.trust_evidence_candidates
  where candidate_id=v_ctx.evidence_candidate_id;

  if v_observation.observation_id is null or v_candidate.candidate_id is null then
    raise exception 'phase8d_prior_research_lineage_missing';
  end if;

  v_bridge := public.admin_enqueue_product_fact_revalidation_research_v1(
    '92000000-0000-4000-8000-000000000001',
    'phase8d-research-0001',
    v_ctx.transition_id
  );

  if v_bridge ->> 'status' <> 'research_requeued'
     or v_bridge ->> 'disposition' <> 'RESEARCH_REQUEUED'
     or (v_bridge ->> 'research_task_id')::uuid <> v_ctx.research_task_id
     or coalesce((v_bridge ->> 'current_pointer_changed')::boolean, true)
     or coalesce((v_bridge ->> 'fact_instance_mutated')::boolean, true)
     or coalesce((v_bridge ->> 'automatic_confirmation')::boolean, true) then
    raise exception 'phase8d_research_bridge_result_invalid';
  end if;

  if (select state from public.product_fact_research_tasks where id=v_ctx.research_task_id)
     <> 'RESEARCH_PENDING' then
    raise exception 'phase8d_research_task_not_requeued';
  end if;

  if (select operational_state from public.product_fact_review_assignments where assignment_id=v_ctx.assignment_id)
     <> 're_review_required' then
    raise exception 'phase8d_assignment_state_changed_early';
  end if;

  v_replay := public.admin_enqueue_product_fact_revalidation_research_v1(
    '92000000-0000-4000-8000-000000000001',
    'phase8d-research-0001',
    v_ctx.transition_id
  );

  if coalesce((v_replay ->> 'idempotent')::boolean, false) is not true
     or (select count(*) from public.product_fact_revalidation_research_bridges
         where transition_id=v_ctx.transition_id) <> 1 then
    raise exception 'phase8d_research_bridge_replay_not_idempotent';
  end if;

  v_claimed := public.claim_trust_research_tasks_v1(25,300);

  if not exists (
    select 1
    from jsonb_array_elements(v_claimed) item
    where (item ->> 'task_id')::uuid=v_ctx.research_task_id
  ) then
    raise exception 'phase8d_revalidation_task_not_claimed';
  end if;

  v_result := public.record_trust_research_result_v1(
    v_ctx.research_task_id,
    jsonb_build_object(
      'outcome','EVIDENCE_CANDIDATE',
      'source',jsonb_strip_nulls(jsonb_build_object(
        'source_binding_id',v_observation.source_binding_id,
        'digest_basis',v_observation.digest_basis,
        'source_content_digest',v_observation.source_content_digest,
        'source_kind',v_observation.source_kind,
        'observed_claim',v_observation.observed_claim,
        'product_identity_observation',v_observation.product_identity_observation,
        'observation_version',v_observation.observation_version,
        'region',v_observation.region,
        'observed_at',v_observation.observed_at,
        'fetched_at',v_observation.fetched_at
      )),
      'candidate',jsonb_strip_nulls(jsonb_build_object(
        'normalized_value',v_candidate.normalized_value,
        'evidence_class',v_candidate.evidence_class,
        'support_direction',v_candidate.support_direction,
        'negative_admissibility',v_candidate.negative_admissibility,
        'confidence',v_candidate.confidence,
        'region',v_candidate.region,
        'qualifier',v_candidate.qualifier
      ))
    )
  );

  if v_result ->> 'outcome' <> 'EVIDENCE_CANDIDATE'
     or (v_result ->> 'evidence_candidate_id')::uuid <> v_candidate.candidate_id then
    raise exception 'phase8d_phase3_reentry_failed';
  end if;

  if (select state from public.product_fact_research_tasks where id=v_ctx.research_task_id)
     <> 'EVIDENCE_CANDIDATE' then
    raise exception 'phase8d_research_task_not_candidate';
  end if;

  if (select operational_state from public.product_fact_review_assignments where assignment_id=v_ctx.assignment_id)
     <> 're_review_required' then
    raise exception 'phase8d_assignment_mutated_by_research';
  end if;

  if (select fact_instance_id from public.product_fact_current where proposition_key=v_ctx.proposition_key)
     <> v_current_fact
     or (select confirmation_id from public.product_fact_current where proposition_key=v_ctx.proposition_key)
     <> v_current_confirmation
     or (select count(*) from public.product_fact_instances) <> v_fact_count
     or (select count(*) from public.product_fact_current) <> v_current_count
     or (select count(*) from public.product_fact_confirmations) <> v_confirmation_count then
    raise exception 'phase8d_semantic_authority_mutated';
  end if;

  if (select count(*) from public.product_fact_review_events
      where assignment_id=v_ctx.assignment_id
        and event_kind='revalidation_research_requeued') <> 1 then
    raise exception 'phase8d_research_review_event_missing';
  end if;
end;
$$;

do $$
begin
  if not (
    select relrowsecurity
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relname='product_fact_revalidation_research_bridges'
  ) then
    raise exception 'phase8d_bridge_rls_missing';
  end if;

  if has_table_privilege('anon','public.product_fact_revalidation_research_bridges','SELECT')
     or has_table_privilege('authenticated','public.product_fact_revalidation_research_bridges','SELECT')
     or has_table_privilege('service_role','public.product_fact_revalidation_research_bridges','INSERT')
     or not has_table_privilege('service_role','public.product_fact_revalidation_research_bridges','SELECT') then
    raise exception 'phase8d_bridge_acl_mismatch';
  end if;

  if has_function_privilege(
       'anon',
       'public.admin_enqueue_product_fact_revalidation_research_v1(uuid,text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.admin_enqueue_product_fact_revalidation_research_v1(uuid,text,uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'public.admin_enqueue_product_fact_revalidation_research_v1(uuid,text,uuid)',
       'EXECUTE'
     ) then
    raise exception 'phase8d_bridge_function_acl_mismatch';
  end if;
end;
$$;

select 'TRUST_PHASE8D_REVALIDATION_RESEARCH_BRIDGE_RUNTIME_VERIFIED';
