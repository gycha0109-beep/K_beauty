begin;

-- TRUST Phase 7-B / Controlled legacy catalog backfill materialization.
-- Operational TRUST queues only. This migration must never create Product Fact
-- Subjects, adopt evidence, confirm facts, mutate Current, or write Recommendation.

create or replace function public.materialize_trust_legacy_catalog_backfill_v1(
  p_expected_fingerprint text,
  p_cohort text,
  p_limit integer default 25,
  p_after_product_id uuid default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_preflight jsonb;
  v_actual_fingerprint text;
  v_registry_version text;
  v_rows jsonb;
  v_selected_rows jsonb;
  v_selected_count integer := 0;
  v_last_product_id uuid;
  v_has_more boolean := false;
  v_row jsonb;
  v_fact jsonb;
  v_product_id uuid;
  v_subject_id uuid;
  v_intake_id uuid;
  v_inserted_intake_id uuid;
  v_task_id uuid;
  v_existing_subject_task_id uuid;
  v_catalog_revision text;
  v_category text;
  v_market text;
  v_projected_trust_state text;
  v_projected_identity_state text;
  v_fact_state text;
  v_task_state text;
  v_blocker_code text;
  v_intakes_created integer := 0;
  v_intakes_replayed integer := 0;
  v_tasks_created integer := 0;
  v_tasks_replayed integer := 0;
  v_already_covered integer := 0;
  v_research_pending integer := 0;
  v_review_required integer := 0;
  v_materialized jsonb := '[]'::jsonb;
begin
  if p_expected_fingerprint is null
    or p_expected_fingerprint !~ '^[0-9a-f]{64}$'
  then
    raise exception 'trust_phase7b_expected_fingerprint_invalid'
      using errcode='22023';
  end if;

  if p_cohort is null or p_cohort not in ('GOVERNED_SUBJECT','SUBJECT_REVIEW') then
    raise exception 'trust_phase7b_cohort_invalid:%',coalesce(p_cohort,'<null>')
      using errcode='22023';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'trust_phase7b_limit_invalid'
      using errcode='22023';
  end if;

  -- Phase 7-B is deliberately bounded to the full Phase 7-A snapshot. The
  -- fingerprint excludes operational intake/task writes, so the same approved
  -- fingerprint remains valid across idempotent materialization batches.
  v_preflight := public.preflight_trust_legacy_catalog_backfill_v1(500,null);

  if coalesce((v_preflight->'batch'->>'has_more')::boolean,false) then
    raise exception 'trust_phase7b_preflight_scope_exceeds_bound'
      using errcode='54000';
  end if;

  v_actual_fingerprint := v_preflight->'batch'->>'fingerprint';
  if v_actual_fingerprint is distinct from p_expected_fingerprint then
    raise exception 'trust_phase7b_preflight_fingerprint_stale:expected=% actual=%',
      p_expected_fingerprint,v_actual_fingerprint
      using errcode='40001';
  end if;

  if coalesce((v_preflight->'global_summary'->>'multiple_current_resolved_subjects')::integer,0) > 0 then
    raise exception 'trust_phase7b_subject_conflict_present'
      using errcode='23514';
  end if;

  if coalesce((v_preflight->'global_summary'->>'noncurrent_subject_only')::integer,0) > 0 then
    raise exception 'trust_phase7b_noncurrent_subject_review_present'
      using errcode='23514';
  end if;

  if coalesce((v_preflight->'batch'->'projection_summary'->>'registry_gap')::integer,0) > 0 then
    raise exception 'trust_phase7b_registry_gap_present'
      using errcode='23514';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_preflight->'batch'->'rows') r(item)
    where r.item->'trust_projection'->>'projected_trust_state'='BLOCKED'
  ) then
    raise exception 'trust_phase7b_blocked_projection_present'
      using errcode='23514';
  end if;

  v_registry_version := v_preflight->>'registry_version';
  v_rows := v_preflight->'batch'->'rows';

  select
    coalesce(jsonb_agg(s.item order by s.product_id),'[]'::jsonb),
    count(*)::integer,
    (array_agg(s.product_id order by s.product_id desc))[1]
  into v_selected_rows,v_selected_count,v_last_product_id
  from (
    select
      r.item,
      (r.item->>'product_id')::uuid as product_id
    from jsonb_array_elements(v_rows) r(item)
    where (p_after_product_id is null or (r.item->>'product_id')::uuid > p_after_product_id)
      and (
        (p_cohort='GOVERNED_SUBJECT'
          and r.item->'subject_projection'->>'projected_identity_state'='EXISTING_GOVERNED_SUBJECT'
          and r.item->'trust_projection'->>'projected_trust_state' in ('COMPLETED','RESEARCH_PENDING'))
        or
        (p_cohort='SUBJECT_REVIEW'
          and r.item->'subject_projection'->>'projected_identity_state'='SUBJECT_CREATION_REQUIRED'
          and r.item->'trust_projection'->>'projected_trust_state'='REVIEW_REQUIRED')
      )
    order by (r.item->>'product_id')::uuid
    limit p_limit
  ) s;

  if v_selected_count > 0 then
    select exists (
      select 1
      from jsonb_array_elements(v_rows) r(item)
      where (r.item->>'product_id')::uuid > v_last_product_id
        and (
          (p_cohort='GOVERNED_SUBJECT'
            and r.item->'subject_projection'->>'projected_identity_state'='EXISTING_GOVERNED_SUBJECT'
            and r.item->'trust_projection'->>'projected_trust_state' in ('COMPLETED','RESEARCH_PENDING'))
          or
          (p_cohort='SUBJECT_REVIEW'
            and r.item->'subject_projection'->>'projected_identity_state'='SUBJECT_CREATION_REQUIRED'
            and r.item->'trust_projection'->>'projected_trust_state'='REVIEW_REQUIRED')
        )
    ) into v_has_more;
  end if;

  for v_row in
    select value from jsonb_array_elements(v_selected_rows)
  loop
    v_product_id := (v_row->>'product_id')::uuid;
    perform pg_advisory_xact_lock(hashtextextended('trust-phase7b-product:' || v_product_id::text,0));
    v_category := v_row->>'category';
    v_market := v_row->'subject_projection'->>'market';
    v_projected_identity_state := v_row->'subject_projection'->>'projected_identity_state';
    v_projected_trust_state := v_row->'trust_projection'->>'projected_trust_state';
    v_catalog_revision := 'legacy-backfill-v1:' || (v_row->>'catalog_revision');
    v_subject_id := nullif(v_row->'subject_projection'->>'subject_id','')::uuid;

    if p_cohort='GOVERNED_SUBJECT' then
      if v_projected_identity_state <> 'EXISTING_GOVERNED_SUBJECT'
        or v_subject_id is null
        or v_projected_trust_state not in ('COMPLETED','RESEARCH_PENDING')
      then
        raise exception 'trust_phase7b_governed_subject_projection_invalid:%',v_product_id
          using errcode='23514';
      end if;

      if not exists (
        select 1
        from public.product_fact_subjects s
        where s.subject_id=v_subject_id
          and s.product_id=v_product_id
          and s.identity_status='resolved'
          and s.current_state='current'
          and s.market_applicability is not distinct from v_market
          and s.variant_key is not distinct from (v_row->'subject_projection'->>'variant_key')
          and s.formulation_revision_key is not distinct from (v_row->'subject_projection'->>'formulation_revision_key')
      ) then
        raise exception 'trust_phase7b_governed_subject_scope_drift:%',v_product_id
          using errcode='40001';
      end if;
    else
      if v_projected_identity_state <> 'SUBJECT_CREATION_REQUIRED'
        or v_subject_id is not null
        or v_market is not null
        or v_projected_trust_state <> 'REVIEW_REQUIRED'
      then
        raise exception 'trust_phase7b_subject_review_projection_invalid:%',v_product_id
          using errcode='23514';
      end if;
    end if;

    v_inserted_intake_id := null;
    insert into public.catalog_trust_intake (
      product_id,
      source_candidate_id,
      catalog_revision,
      category,
      market,
      subject_id,
      identity_state,
      trust_state,
      required_fact_policy_version,
      identity_resolution_version,
      identity_resolution_detail,
      created_at,
      started_at,
      completed_at,
      last_checked_at,
      updated_at
    ) values (
      v_product_id,
      null,
      v_catalog_revision,
      v_category,
      v_market,
      case when p_cohort='GOVERNED_SUBJECT' then v_subject_id else null end,
      case when p_cohort='GOVERNED_SUBJECT' then 'EXACT_SUBJECT_FOUND' else 'SUBJECT_CREATION_REQUIRED' end,
      v_projected_trust_state,
      'product-fact-required-policy-v1',
      'trust-phase7b-legacy-materialization-v1',
      jsonb_build_object(
        'materializer_version','trust-phase7b-legacy-materialization-v1',
        'preflight_fingerprint',v_actual_fingerprint,
        'projected_identity_state',v_projected_identity_state,
        'reason_code',case
          when p_cohort='GOVERNED_SUBJECT' then 'phase7a_exact_governed_subject'
          else 'no_product_fact_subject_exists'
        end,
        'subject_id',case when p_cohort='GOVERNED_SUBJECT' then v_subject_id else null end,
        'market',v_market,
        'variant_key',v_row->'subject_projection'->>'variant_key',
        'formulation_revision_key',v_row->'subject_projection'->>'formulation_revision_key',
        'market_inferred',false
      ),
      now(),
      now(),
      case when v_projected_trust_state='COMPLETED' then now() else null end,
      now(),
      now()
    )
    on conflict (product_id,catalog_revision) do nothing
    returning id into v_inserted_intake_id;

    if v_inserted_intake_id is not null then
      v_intake_id := v_inserted_intake_id;
      v_intakes_created := v_intakes_created + 1;
    else
      select i.id into v_intake_id
      from public.catalog_trust_intake i
      where i.product_id=v_product_id
        and i.catalog_revision=v_catalog_revision;

      if v_intake_id is null then
        raise exception 'trust_phase7b_intake_replay_lookup_failed:%',v_product_id
          using errcode='23514';
      end if;
      v_intakes_replayed := v_intakes_replayed + 1;
    end if;

    for v_fact in
      select value
      from jsonb_array_elements(v_row->'trust_projection'->'required_facts')
      order by (value->>'priority')::integer,value->>'fact_key'
    loop
      if coalesce((v_fact->>'registry_supported')::boolean,false) is not true
        or (v_fact->>'registry_version') is distinct from v_registry_version
      then
        raise exception 'trust_phase7b_required_fact_registry_invalid:%:%',v_product_id,v_fact->>'fact_key'
          using errcode='23514';
      end if;

      v_fact_state := v_fact->>'projected_state';
      v_blocker_code := null;

      if p_cohort='GOVERNED_SUBJECT' then
        if v_fact_state='ALREADY_COVERED' then
          v_task_state := 'ALREADY_COVERED';
          v_already_covered := v_already_covered + 1;
        elsif v_fact_state='RESEARCH_REQUIRED' then
          v_task_state := 'RESEARCH_PENDING';
          v_research_pending := v_research_pending + 1;
        else
          raise exception 'trust_phase7b_governed_fact_projection_invalid:%:%:%',
            v_product_id,v_fact->>'fact_key',v_fact_state
            using errcode='23514';
        end if;
      else
        if v_fact_state <> 'REVIEW_REQUIRED'
          or v_fact->>'blocker_code' <> 'SUBJECT_CREATION_REQUIRED'
        then
          raise exception 'trust_phase7b_review_fact_projection_invalid:%:%:%',
            v_product_id,v_fact->>'fact_key',v_fact_state
            using errcode='23514';
        end if;
        v_task_state := 'REVIEW_REQUIRED';
        v_blocker_code := 'SUBJECT_CREATION_REQUIRED';
        v_review_required := v_review_required + 1;
      end if;

      if v_inserted_intake_id is not null then
        if v_subject_id is not null then
          v_existing_subject_task_id := null;
          select t.id into v_existing_subject_task_id
          from public.product_fact_research_tasks t
          where t.subject_id=v_subject_id
            and t.fact_key=v_fact->>'fact_key'
            and t.registry_version=v_registry_version
            and t.research_policy_version='product-fact-required-policy-v1'
          limit 1;

          if v_existing_subject_task_id is not null then
            raise exception 'trust_phase7b_subject_task_conflict:%:%:%',
              v_product_id,v_fact->>'fact_key',v_existing_subject_task_id
              using errcode='23505';
          end if;
        end if;

        v_task_id := null;
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
          v_intake_id,
          v_product_id,
          case when p_cohort='GOVERNED_SUBJECT' then v_subject_id else null end,
          v_fact->>'fact_key',
          v_registry_version,
          'product-fact-required-policy-v1',
          v_task_state,
          (v_fact->>'priority')::smallint,
          v_blocker_code,
          case when v_blocker_code is not null
            then jsonb_build_object(
              'materializer_version','trust-phase7b-legacy-materialization-v1',
              'preflight_fingerprint',v_actual_fingerprint,
              'reason_code','no_product_fact_subject_exists',
              'market_inferred',false
            )::text
            else null
          end,
          0,
          now(),
          now(),
          case when v_task_state='ALREADY_COVERED' then now() else null end
        )
        on conflict (intake_id,fact_key,registry_version,research_policy_version) do nothing
        returning id into v_task_id;

        if v_task_id is null then
          raise exception 'trust_phase7b_task_insert_conflict:%:%',v_product_id,v_fact->>'fact_key'
            using errcode='23505';
        end if;
        v_tasks_created := v_tasks_created + 1;
      else
        if not exists (
          select 1
          from public.product_fact_research_tasks t
          where t.intake_id=v_intake_id
            and t.product_id=v_product_id
            and t.fact_key=v_fact->>'fact_key'
            and t.registry_version=v_registry_version
            and t.research_policy_version='product-fact-required-policy-v1'
        ) then
          raise exception 'trust_phase7b_replay_task_missing:%:%',v_product_id,v_fact->>'fact_key'
            using errcode='23514';
        end if;
        v_tasks_replayed := v_tasks_replayed + 1;
      end if;
    end loop;

    v_materialized := v_materialized || jsonb_build_array(jsonb_build_object(
      'product_id',v_product_id,
      'intake_id',v_intake_id,
      'created',v_inserted_intake_id is not null,
      'projected_identity_state',v_projected_identity_state,
      'projected_trust_state',v_projected_trust_state
    ));
  end loop;

  return jsonb_build_object(
    'status','materialized',
    'phase','7-B',
    'contract_version','trust-phase7b-legacy-materialization-v1',
    'cohort',p_cohort,
    'preflight_fingerprint',v_actual_fingerprint,
    'registry_version',v_registry_version,
    'batch',jsonb_build_object(
      'limit',p_limit,
      'after_product_id',p_after_product_id,
      'count',v_selected_count,
      'has_more',v_has_more,
      'next_after_product_id',case when v_has_more then v_last_product_id else null end,
      'intakes_created',v_intakes_created,
      'intakes_replayed',v_intakes_replayed,
      'tasks_created',v_tasks_created,
      'tasks_replayed',v_tasks_replayed,
      'already_covered',v_already_covered,
      'research_pending',v_research_pending,
      'review_required',v_review_required,
      'rows',v_materialized
    ),
    'writes_performed',(v_intakes_created > 0 or v_tasks_created > 0),
    'product_fact_authority_mutation',false,
    'recommendation_mutation',false,
    'market_inference_performed',false
  );
end;
$$;

comment on function public.materialize_trust_legacy_catalog_backfill_v1(text,text,integer,uuid) is
  'TRUST Phase 7-B service-role controlled materializer for Phase 7-A legacy catalog projections. Writes operational TRUST intake/tasks only; preserves exact governed Subject scope and never infers market.';

revoke all on function public.materialize_trust_legacy_catalog_backfill_v1(text,text,integer,uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.materialize_trust_legacy_catalog_backfill_v1(text,text,integer,uuid)
  to service_role;

commit;
