begin;

-- TRUST Phase 7-A / Existing Catalog Backfill Preflight.
-- Read-only planning surface: no TRUST queue materialization, Product Fact writes,
-- evidence adoption, confirmation, Current mutation, or Recommendation mutation.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.preflight_trust_legacy_catalog_backfill_v1(
  p_limit integer default 200,
  p_after_product_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_registry_version text;
  v_eligible_count integer;
  v_zero_subject_count integer;
  v_no_current_resolved_count integer;
  v_single_subject_count integer;
  v_conflict_subject_count integer;
  v_noncurrent_subject_only_count integer;
  v_rows jsonb;
  v_batch_count integer;
  v_last_product_id uuid;
  v_has_more boolean;
  v_batch_fingerprint text;
  v_projection_summary jsonb;
begin
  if p_limit is null or p_limit < 1 or p_limit > 500 then
    raise exception 'trust_phase7a_preflight_limit_invalid'
      using errcode='22023';
  end if;

  select registry_version
    into v_registry_version
  from public.product_fact_registry_versions
  order by effective_at desc nulls last, created_at desc, registry_version desc
  limit 1;

  if v_registry_version is null then
    raise exception 'trust_phase7a_registry_unavailable'
      using errcode='23514';
  end if;

  with legacy as (
    select p.id
    from public.products p
    where not exists (
      select 1
      from public.product_candidates pc
      where pc.matched_product_id = p.id
    )
  ),
  subject_shape as (
    select
      l.id,
      count(s.subject_id)::integer as total_subject_count,
      count(s.subject_id) filter (
        where s.identity_status='resolved'
          and s.current_state='current'
      )::integer as current_resolved_count
    from legacy l
    left join public.product_fact_subjects s on s.product_id=l.id
    group by l.id
  )
  select
    count(*)::integer,
    count(*) filter(where total_subject_count=0)::integer,
    count(*) filter(where current_resolved_count=0)::integer,
    count(*) filter(where current_resolved_count=1)::integer,
    count(*) filter(where current_resolved_count>1)::integer,
    count(*) filter(where current_resolved_count=0 and total_subject_count>0)::integer
  into
    v_eligible_count,
    v_zero_subject_count,
    v_no_current_resolved_count,
    v_single_subject_count,
    v_conflict_subject_count,
    v_noncurrent_subject_only_count
  from subject_shape;

  with selected as (
    select p.*
    from public.products p
    where not exists (
      select 1
      from public.product_candidates pc
      where pc.matched_product_id=p.id
    )
      and (p_after_product_id is null or p.id > p_after_product_id)
    order by p.id
    limit p_limit
  ),
  shaped as (
    select
      p.id as product_id,
      p.brand,
      p.name,
      p.category::text as category,
      coalesce(ss.total_subject_count,0)::integer as total_subject_count,
      coalesce(ss.current_resolved_count,0)::integer as current_resolved_count,
      case when coalesce(ss.current_resolved_count,0)=1 then ss.subject_id else null end as subject_id,
      case when coalesce(ss.current_resolved_count,0)=1 then ss.market_applicability else null end as market,
      case when coalesce(ss.current_resolved_count,0)=1 then ss.variant_key else null end as variant_key,
      case when coalesce(ss.current_resolved_count,0)=1 then ss.formulation_revision_key else null end as formulation_revision_key
    from selected p
    left join lateral (
      select
        count(s.subject_id)::integer as total_subject_count,
        count(s.subject_id) filter(
          where s.identity_status='resolved'
            and s.current_state='current'
        )::integer as current_resolved_count,
        min(s.subject_id::text) filter(
          where s.identity_status='resolved'
            and s.current_state='current'
        )::uuid as subject_id,
        min(s.market_applicability) filter(
          where s.identity_status='resolved'
            and s.current_state='current'
        ) as market_applicability,
        min(s.variant_key) filter(
          where s.identity_status='resolved'
            and s.current_state='current'
        ) as variant_key,
        min(s.formulation_revision_key) filter(
          where s.identity_status='resolved'
            and s.current_state='current'
        ) as formulation_revision_key
      from public.product_fact_subjects s
      where s.product_id=p.id
    ) ss on true
  ),
  projected as (
    select
      s.*,
      coalesce(f.required_fact_count,0)::integer as required_fact_count,
      coalesce(f.already_covered_count,0)::integer as already_covered_count,
      coalesce(f.research_required_count,0)::integer as research_required_count,
      coalesce(f.subject_creation_required_count,0)::integer as subject_creation_required_count,
      coalesce(f.review_required_count,0)::integer as review_required_count,
      coalesce(f.registry_gap_count,0)::integer as registry_gap_count,
      coalesce(f.required_facts,'[]'::jsonb) as required_facts
    from shaped s
    left join lateral (
      select
        count(*)::integer as required_fact_count,
        count(*) filter(where q.projected_state='ALREADY_COVERED')::integer as already_covered_count,
        count(*) filter(where q.projected_state='RESEARCH_REQUIRED')::integer as research_required_count,
        count(*) filter(where q.blocker_code='SUBJECT_CREATION_REQUIRED')::integer as subject_creation_required_count,
        count(*) filter(where q.projected_state='REVIEW_REQUIRED')::integer as review_required_count,
        count(*) filter(where q.projected_state='REGISTRY_GAP')::integer as registry_gap_count,
        coalesce(jsonb_agg(
          jsonb_build_object(
            'fact_key',q.fact_key,
            'priority',q.priority,
            'registry_version',v_registry_version,
            'registry_supported',q.registry_supported,
            'projected_state',q.projected_state,
            'blocker_code',q.blocker_code
          )
          order by q.priority,q.fact_key
        ),'[]'::jsonb) as required_facts
      from (
        select
          b.fact_key,
          b.priority,
          b.registry_supported,
          case
            when s.current_resolved_count > 1 then 'REVIEW_REQUIRED'
            when s.current_resolved_count = 0 then 'REVIEW_REQUIRED'
            when not b.registry_supported then 'REGISTRY_GAP'
            when b.current_covered then 'ALREADY_COVERED'
            else 'RESEARCH_REQUIRED'
          end as projected_state,
          case
            when s.current_resolved_count > 1 then 'SUBJECT_CONFLICT'
            when s.current_resolved_count = 0 and s.total_subject_count = 0 then 'SUBJECT_CREATION_REQUIRED'
            when s.current_resolved_count = 0 then 'IDENTITY_BLOCKED'
            when not b.registry_supported then 'REGISTRY_GAP'
            else null
          end as blocker_code
        from (
          select
            policy.fact_key,
            policy.priority,
            exists(
              select 1
              from public.product_fact_definition_snapshots d
              where d.registry_version=v_registry_version
                and d.fact_key=policy.fact_key
                and not d.deprecated
                and (d.definition -> 'domain_scope') ? s.category
            ) as registry_supported,
            exists(
              select 1
              from public.product_fact_current c
              join public.product_fact_instances fi
                on fi.fact_instance_id=c.fact_instance_id
              where c.subject_id=s.subject_id
                and fi.subject_id=s.subject_id
                and fi.registry_version=v_registry_version
                and fi.fact_key=policy.fact_key
            ) as current_covered
          from public.catalog_required_product_facts_v1(s.category) policy
        ) b
      ) q
    ) f on true
  ),
  rows as (
    select
      p.product_id,
      jsonb_build_object(
        'product_id',p.product_id,
        'brand',p.brand,
        'name',p.name,
        'category',p.category,
        'catalog_revision',encode(
          extensions.digest(
            convert_to(
              jsonb_build_object(
                'contract','trust-phase7a-catalog-revision-v1',
                'product_id',p.product_id,
                'brand',p.brand,
                'name',p.name,
                'category',p.category
              )::text,
              'UTF8'
            ),
            'sha256'
          ),
          'hex'
        ),
        'source_candidate_id',null,
        'subject_projection',jsonb_build_object(
          'total_subject_count',p.total_subject_count,
          'current_resolved_count',p.current_resolved_count,
          'subject_id',p.subject_id,
          'market',p.market,
          'variant_key',p.variant_key,
          'formulation_revision_key',p.formulation_revision_key,
          'projected_identity_state',case
            when p.current_resolved_count=1 then 'EXISTING_GOVERNED_SUBJECT'
            when p.current_resolved_count=0 and p.total_subject_count=0 then 'SUBJECT_CREATION_REQUIRED'
            when p.current_resolved_count>1 then 'SUBJECT_CONFLICT'
            else 'REVIEW_REQUIRED'
          end,
          'market_inferred',false
        ),
        'trust_projection',jsonb_build_object(
          'projected_trust_state',case
            when p.category is null or p.required_fact_count=0 then 'BLOCKED'
            when p.current_resolved_count>1 then 'REVIEW_REQUIRED'
            when p.current_resolved_count=0 then 'REVIEW_REQUIRED'
            when p.registry_gap_count>0 then 'REVIEW_REQUIRED'
            when p.research_required_count>0 then 'RESEARCH_PENDING'
            else 'COMPLETED'
          end,
          'reason_code',case
            when p.category is null then 'legacy_category_missing'
            when p.required_fact_count=0 then 'required_fact_policy_missing'
            when p.current_resolved_count>1 then 'multiple_current_resolved_subjects'
            when p.current_resolved_count=0 and p.total_subject_count=0 then 'no_product_fact_subject_exists'
            when p.current_resolved_count=0 then 'existing_subject_not_current_resolved'
            when p.registry_gap_count>0 then 'required_fact_registry_gap'
            when p.research_required_count>0 then 'required_fact_missing_current'
            else 'all_required_facts_already_covered'
          end,
          'required_fact_count',p.required_fact_count,
          'already_covered_count',p.already_covered_count,
          'research_required_count',p.research_required_count,
          'subject_creation_required_count',p.subject_creation_required_count,
          'review_required_count',p.review_required_count,
          'registry_gap_count',p.registry_gap_count,
          'required_facts',p.required_facts
        )
      ) as payload
    from projected p
  )
  select
    coalesce(jsonb_agg(payload order by product_id),'[]'::jsonb),
    count(*)::integer,
    max(product_id)
  into v_rows,v_batch_count,v_last_product_id
  from rows;

  if v_batch_count > 0 then
    select exists(
      select 1
      from public.products p
      where not exists (
        select 1
        from public.product_candidates pc
        where pc.matched_product_id=p.id
      )
        and p.id > v_last_product_id
    )
    into v_has_more;
  else
    v_has_more := false;
  end if;

  select jsonb_build_object(
    'already_covered',coalesce(sum((e.item->'trust_projection'->>'already_covered_count')::integer),0),
    'research_required',coalesce(sum((e.item->'trust_projection'->>'research_required_count')::integer),0),
    'subject_creation_required',coalesce(sum((e.item->'trust_projection'->>'subject_creation_required_count')::integer),0),
    'review_required',coalesce(sum((e.item->'trust_projection'->>'review_required_count')::integer),0),
    'registry_gap',coalesce(sum((e.item->'trust_projection'->>'registry_gap_count')::integer),0)
  )
  into v_projection_summary
  from jsonb_array_elements(v_rows) as e(item);

  v_batch_fingerprint := encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'contract','trust-phase7a-legacy-backfill-preflight-v1',
          'registry_version',v_registry_version,
          'after_product_id',p_after_product_id,
          'rows',v_rows
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  return jsonb_build_object(
    'status','preflight',
    'phase','7-A',
    'contract_version','trust-phase7a-legacy-backfill-preflight-v1',
    'registry_version',v_registry_version,
    'target_scope','legacy_products_without_product_candidate_lineage',
    'global_summary',jsonb_build_object(
      'eligible_products',v_eligible_count,
      'no_subject',v_zero_subject_count,
      'no_current_resolved_subject',v_no_current_resolved_count,
      'single_current_resolved_subject',v_single_subject_count,
      'multiple_current_resolved_subjects',v_conflict_subject_count,
      'noncurrent_subject_only',v_noncurrent_subject_only_count
    ),
    'batch',jsonb_build_object(
      'limit',p_limit,
      'after_product_id',p_after_product_id,
      'count',v_batch_count,
      'has_more',v_has_more,
      'next_after_product_id',case when v_has_more then v_last_product_id else null end,
      'projection_summary',v_projection_summary,
      'fingerprint',v_batch_fingerprint,
      'rows',v_rows
    ),
    'writes_performed',false,
    'market_inference_performed',false
  );
end;
$$;

comment on function public.preflight_trust_legacy_catalog_backfill_v1(integer,uuid) is
  'TRUST Phase 7-A service-role read-only preflight for legacy catalog backfill. Projects governed Subject/Current coverage without materializing intake/tasks or inferring market.';

revoke all on function public.preflight_trust_legacy_catalog_backfill_v1(integer,uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.preflight_trust_legacy_catalog_backfill_v1(integer,uuid)
  to service_role;

commit;
