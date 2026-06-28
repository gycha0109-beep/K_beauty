begin;

create or replace view public.candidate_ranking_evidence_summary
with (security_invoker = true)
as
with observations as (
  select
    pc.id as candidate_id,
    sr.rank_position,
    sr.collected_at,
    (coalesce(rs.collected_at, sr.collected_at) at time zone 'Asia/Seoul')::date as observed_date_kst,
    rs.job_id,
    rs.service_category,
    rs.source_category_key,
    rs.source_product_form,
    rs.source_concern_key,
    rs.canonical_concerns,
    rs.evidence_type,
    rs.requested_limit
  from public.product_candidates pc
  join public.source_rankings sr on sr.candidate_id = pc.id
  join public.ranking_snapshots rs on rs.id = sr.snapshot_id
),
concern_observations as (
  select
    observations.candidate_id,
    coalesce(nullif(concern.value, ''), observations.source_concern_key) as concern_key,
    observations.rank_position,
    observations.collected_at,
    observations.observed_date_kst,
    observations.job_id,
    observations.service_category,
    observations.source_category_key,
    observations.source_product_form
  from observations
  left join lateral unnest(
    case
      when coalesce(array_length(observations.canonical_concerns, 1), 0) > 0
        then observations.canonical_concerns
      when nullif(observations.source_concern_key, '') is not null
        then array[observations.source_concern_key]
      else '{}'::text[]
    end
  ) as concern(value) on true
  where observations.evidence_type = 'concern_relevance'
),
concern_latest as (
  select distinct on (candidate_id, concern_key)
    candidate_id,
    concern_key,
    rank_position as latest_rank,
    collected_at as latest_collected_at,
    observed_date_kst as latest_observed_date
  from concern_observations
  where concern_key is not null
  order by candidate_id, concern_key, collected_at desc, rank_position asc
),
concern_groups as (
  select
    co.candidate_id,
    co.concern_key,
    count(*)::integer as observation_count,
    count(distinct co.observed_date_kst)::integer as distinct_observed_dates,
    min(co.observed_date_kst) as first_observed_date,
    max(co.observed_date_kst) as last_observed_date,
    min(co.rank_position)::integer as best_rank,
    cl.latest_rank::integer,
    cl.latest_collected_at,
    cl.latest_observed_date,
    jsonb_agg(
      jsonb_build_object(
        'rank', co.rank_position,
        'collected_at', co.collected_at,
        'observed_date', co.observed_date_kst,
        'job_id', co.job_id,
        'service_category', co.service_category,
        'source_category_key', co.source_category_key,
        'source_product_form', co.source_product_form
      )
      order by co.collected_at desc, co.rank_position asc
    ) as observations
  from concern_observations co
  join concern_latest cl
    on cl.candidate_id = co.candidate_id
   and cl.concern_key = co.concern_key
  where co.concern_key is not null
  group by
    co.candidate_id,
    co.concern_key,
    cl.latest_rank,
    cl.latest_collected_at,
    cl.latest_observed_date
),
concern_candidate_dates as (
  select
    candidate_id,
    count(*)::integer as concern_observation_count,
    count(distinct observed_date_kst)::integer as concern_distinct_observed_dates,
    min(observed_date_kst) as concern_first_observed_date,
    max(observed_date_kst) as concern_last_observed_date
  from concern_observations
  where concern_key is not null
  group by candidate_id
),
concern_summary as (
  select
    cg.candidate_id,
    count(*)::integer as distinct_concern_count,
    min(cg.best_rank)::integer as concern_best_rank,
    min(cg.latest_rank)::integer as concern_latest_best_rank,
    count(*) filter (where cg.latest_rank <= 15)::integer as concern_top15_count,
    count(*) filter (where cg.latest_rank between 16 and 30 and cg.distinct_observed_dates >= 2)::integer as persistent_concern_count,
    count(*) filter (where cg.distinct_observed_dates >= 2)::integer as repeated_concern_count,
    jsonb_agg(
      jsonb_build_object(
        'concern', cg.concern_key,
        'observation_count', cg.observation_count,
        'distinct_observed_dates', cg.distinct_observed_dates,
        'first_observed_date', cg.first_observed_date,
        'last_observed_date', cg.last_observed_date,
        'best_rank', cg.best_rank,
        'latest_rank', cg.latest_rank,
        'latest_collected_at', cg.latest_collected_at,
        'latest_observed_date', cg.latest_observed_date,
        'observations', cg.observations
      )
      order by cg.latest_rank asc, cg.concern_key asc
    ) as concern_evidence
  from concern_groups cg
  group by cg.candidate_id
),
popularity_observations as (
  select
    candidate_id,
    rank_position,
    collected_at,
    observed_date_kst,
    job_id,
    service_category,
    source_category_key,
    source_product_form,
    requested_limit
  from observations
  where evidence_type = 'popularity'
    and rank_position <= 100
),
popularity_latest as (
  select distinct on (candidate_id)
    candidate_id,
    rank_position as latest_rank,
    collected_at as latest_collected_at,
    observed_date_kst as latest_observed_date
  from popularity_observations
  order by candidate_id, collected_at desc, rank_position asc
),
popularity_summary as (
  select
    po.candidate_id,
    count(*)::integer as popularity_observation_count,
    count(distinct po.observed_date_kst)::integer as popularity_distinct_observed_dates,
    min(po.observed_date_kst) as popularity_first_observed_date,
    max(po.observed_date_kst) as popularity_last_observed_date,
    min(po.rank_position)::integer as popularity_best_rank,
    pl.latest_rank::integer as popularity_latest_rank,
    pl.latest_collected_at as popularity_latest_collected_at,
    pl.latest_observed_date as popularity_latest_observed_date,
    jsonb_agg(
      jsonb_build_object(
        'rank', po.rank_position,
        'collected_at', po.collected_at,
        'observed_date', po.observed_date_kst,
        'job_id', po.job_id,
        'service_category', po.service_category,
        'source_category_key', po.source_category_key,
        'source_product_form', po.source_product_form,
        'requested_limit', po.requested_limit
      )
      order by po.collected_at desc, po.rank_position asc
    ) as popularity_evidence
  from popularity_observations po
  join popularity_latest pl on pl.candidate_id = po.candidate_id
  group by po.candidate_id, pl.latest_rank, pl.latest_collected_at, pl.latest_observed_date
),
product_matches as (
  select
    pc.id as candidate_id,
    exists (
      select 1
      from public.products p
      where p.normalized_brand = pc.normalized_brand
        and p.normalized_name = pc.normalized_name
    ) as product_match_exists
  from public.product_candidates pc
),
policy_concerns as (
  select
    cg.candidate_id,
    cg.concern_key,
    cg.latest_rank,
    cg.distinct_observed_dates,
    cg.best_rank,
    coalesce(ps.popularity_latest_rank, 2147483647) as popularity_latest_rank,
    coalesce(cs.distinct_concern_count, 0) as observed_distinct_concern_count,
    case
      when cg.latest_rank <= 15
        then 'top_15_immediate'
      when cg.latest_rank between 16 and 30
        and cg.distinct_observed_dates >= 2
        then 'rank_16_30_persistent'
      when cg.latest_rank between 31 and 50
        and cg.distinct_observed_dates >= 3
        and (
          ps.popularity_latest_rank <= 30
          or coalesce(cs.distinct_concern_count, 0) >= 2
        )
        then 'rank_31_50_reinforced'
    end as queue_policy,
    case
      when cg.latest_rank <= 15 then 100
      when cg.latest_rank between 16 and 30 and cg.distinct_observed_dates >= 2 then 70
      when cg.latest_rank between 31 and 50
        and cg.distinct_observed_dates >= 3
        and (
          ps.popularity_latest_rank <= 30
          or coalesce(cs.distinct_concern_count, 0) >= 2
        )
        then 45
      else 0
    end as base_priority,
    case
      when ps.popularity_latest_rank <= 30
        and coalesce(cs.distinct_concern_count, 0) >= 2
        then jsonb_build_array('latest_popularity_rank_lte_30', 'two_or_more_distinct_concerns')
      when ps.popularity_latest_rank <= 30
        then jsonb_build_array('latest_popularity_rank_lte_30')
      when coalesce(cs.distinct_concern_count, 0) >= 2
        then jsonb_build_array('two_or_more_distinct_concerns')
      else '[]'::jsonb
    end as reinforcement_reasons
  from concern_groups cg
  left join concern_summary cs on cs.candidate_id = cg.candidate_id
  left join popularity_summary ps on ps.candidate_id = cg.candidate_id
),
policy_choice as (
  select distinct on (candidate_id)
    candidate_id,
    concern_key as qualifying_concern,
    latest_rank as qualifying_latest_rank,
    distinct_observed_dates as qualifying_distinct_observed_dates,
    queue_policy,
    base_priority,
    reinforcement_reasons,
    (
      base_priority
      + case when popularity_latest_rank <= 30 then 10 else 0 end
      + case when observed_distinct_concern_count >= 2 then 5 else 0 end
      + greatest(0, 51 - latest_rank)
    )::numeric as priority_score
  from policy_concerns
  where queue_policy is not null
  order by candidate_id, base_priority desc, latest_rank asc, distinct_observed_dates desc, concern_key asc
)
select
  pc.id as candidate_id,
  pc.source_name,
  pc.external_type,
  pc.external_id,
  pc.brand_name_raw,
  pc.product_name_raw,
  pc.normalized_brand,
  pc.normalized_name,
  coalesce(pm.product_match_exists, false) as product_match_exists,
  coalesce(cs.distinct_concern_count, 0) as distinct_concern_count,
  coalesce(ccd.concern_observation_count, 0) as concern_observation_count,
  cs.concern_best_rank,
  coalesce(cs.concern_top15_count, 0) as concern_top15_count,
  coalesce(cs.repeated_concern_count, 0) as repeated_concern_count,
  coalesce(ps.popularity_observation_count, 0) as popularity_observation_count,
  ps.popularity_best_rank,
  ps.popularity_latest_rank,
  jsonb_build_object(
    'rule_version', 'ranking-review-v2',
    'candidate', jsonb_build_object(
      'id', pc.id,
      'source_name', pc.source_name,
      'external_type', pc.external_type,
      'external_id', pc.external_id,
      'brand_name_raw', pc.brand_name_raw,
      'product_name_raw', pc.product_name_raw
    ),
    'queue_eligible', pcx.queue_policy is not null,
    'queue_policy', pcx.queue_policy,
    'qualification', jsonb_build_object(
      'reason', pcx.queue_policy,
      'concern', pcx.qualifying_concern,
      'latest_rank', pcx.qualifying_latest_rank,
      'distinct_observed_dates', pcx.qualifying_distinct_observed_dates,
      'reinforcement_reasons', coalesce(pcx.reinforcement_reasons, '[]'::jsonb)
    ),
    'concerns', coalesce(cs.concern_evidence, '[]'::jsonb),
    'concern_observation_count', coalesce(ccd.concern_observation_count, 0),
    'concern_distinct_observed_dates', coalesce(ccd.concern_distinct_observed_dates, 0),
    'concern_first_observed_date', ccd.concern_first_observed_date,
    'concern_last_observed_date', ccd.concern_last_observed_date,
    'popularity', jsonb_build_object(
      'observation_count', coalesce(ps.popularity_observation_count, 0),
      'distinct_observed_dates', coalesce(ps.popularity_distinct_observed_dates, 0),
      'first_observed_date', ps.popularity_first_observed_date,
      'last_observed_date', ps.popularity_last_observed_date,
      'best_rank', ps.popularity_best_rank,
      'latest_rank', ps.popularity_latest_rank,
      'latest_collected_at', ps.popularity_latest_collected_at,
      'latest_observed_date', ps.popularity_latest_observed_date,
      'observations', coalesce(ps.popularity_evidence, '[]'::jsonb)
    )
  ) as evidence_snapshot,
  coalesce(ccd.concern_distinct_observed_dates, 0) as concern_distinct_observed_dates,
  ccd.concern_first_observed_date,
  ccd.concern_last_observed_date,
  coalesce(ps.popularity_distinct_observed_dates, 0) as popularity_distinct_observed_dates,
  ps.popularity_first_observed_date,
  ps.popularity_last_observed_date,
  (pcx.queue_policy is not null) as queue_eligible,
  pcx.queue_policy,
  case pcx.queue_policy
    when 'top_15_immediate' then 'top_15_immediate: latest concern rank <= 15'
    when 'rank_16_30_persistent' then 'rank_16_30_persistent: latest concern rank 16-30 on >= 2 KST observed dates'
    when 'rank_31_50_reinforced' then 'rank_31_50_reinforced: latest concern rank 31-50 on >= 3 KST observed dates with reinforcement'
  end as selection_reason,
  coalesce(pcx.priority_score, 0)::numeric as priority_score
from public.product_candidates pc
left join concern_summary cs on cs.candidate_id = pc.id
left join concern_candidate_dates ccd on ccd.candidate_id = pc.id
left join popularity_summary ps on ps.candidate_id = pc.id
left join product_matches pm on pm.candidate_id = pc.id
left join policy_choice pcx on pcx.candidate_id = pc.id;

revoke all on public.candidate_ranking_evidence_summary from anon, authenticated;
grant select on public.candidate_ranking_evidence_summary to service_role;

create or replace function public.refresh_candidate_promotion_reviews(
  p_rule_version text default 'ranking-review-v2'
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_rule_version text := nullif(btrim(coalesce(p_rule_version, '')), '');
  v_inserted integer := 0;
  v_updated integer := 0;
  v_deferred integer := 0;
  v_protected integer := 0;
  v_examined integer := 0;
  v_review_id uuid;
  v_row record;
begin
  if v_rule_version is null then
    v_rule_version := 'ranking-review-v2';
  end if;

  if v_rule_version <> 'ranking-review-v2' then
    raise exception using
      errcode = '22023',
      message = 'review_refresh_unsupported_rule_version';
  end if;

  for v_row in
    select
      summary.*
    from public.candidate_ranking_evidence_summary summary
    where summary.queue_eligible
      and nullif(btrim(coalesce(summary.external_type, '')), '') is not null
      and nullif(btrim(coalesce(summary.external_id, '')), '') is not null
      and not summary.product_match_exists
    order by summary.priority_score desc, summary.concern_best_rank asc nulls last, summary.candidate_id
  loop
    v_examined := v_examined + 1;
    v_review_id := null;

    update public.candidate_promotion_reviews
    set priority_score = v_row.priority_score,
        selection_reason = v_row.selection_reason,
        evidence_snapshot = v_row.evidence_snapshot || jsonb_build_object(
          'queue_eligible', true,
          'queue_policy', v_row.queue_policy,
          'rule_version', v_rule_version
        ),
        rule_version = v_rule_version,
        last_queued_at = now()
    where candidate_id = v_row.candidate_id
      and status in ('queued', 'reviewing')
    returning id into v_review_id;

    if v_review_id is not null then
      v_updated := v_updated + 1;
      continue;
    end if;

    insert into public.candidate_promotion_reviews (
      candidate_id,
      status,
      priority_score,
      selection_reason,
      evidence_snapshot,
      rule_version,
      first_queued_at,
      last_queued_at
    )
    values (
      v_row.candidate_id,
      'queued',
      v_row.priority_score,
      v_row.selection_reason,
      v_row.evidence_snapshot || jsonb_build_object(
        'queue_eligible', true,
        'queue_policy', v_row.queue_policy,
        'rule_version', v_rule_version
      ),
      v_rule_version,
      now(),
      now()
    )
    on conflict (candidate_id) do nothing
    returning id into v_review_id;

    if v_review_id is not null then
      v_inserted := v_inserted + 1;
    else
      v_protected := v_protected + 1;
    end if;
  end loop;

  for v_row in
    select
      reviews.id as review_id,
      reviews.candidate_id,
      coalesce(summary.evidence_snapshot, '{}'::jsonb) as evidence_snapshot
    from public.candidate_promotion_reviews reviews
    left join public.candidate_ranking_evidence_summary summary
      on summary.candidate_id = reviews.candidate_id
    where reviews.status in ('queued', 'reviewing')
      and not exists (
        select 1
        from public.candidate_ranking_evidence_summary eligible
        where eligible.candidate_id = reviews.candidate_id
          and eligible.queue_eligible
          and nullif(btrim(coalesce(eligible.external_type, '')), '') is not null
          and nullif(btrim(coalesce(eligible.external_id, '')), '') is not null
          and not eligible.product_match_exists
      )
  loop
    update public.candidate_promotion_reviews
    set status = 'deferred',
        priority_score = 0,
        selection_reason = 'currently below queue threshold under ranking-review-v2',
        evidence_snapshot = v_row.evidence_snapshot || jsonb_build_object(
          'queue_eligible', false,
          'rule_version', v_rule_version,
          'ineligible_reasons', jsonb_build_array(
            'ranking-review-v2 requires concern rank <= 15, persistent rank 16-30, or reinforced rank 31-50'
          )
        ),
        rule_version = v_rule_version
    where id = v_row.review_id;

    v_deferred := v_deferred + 1;
  end loop;

  return jsonb_build_object(
    'rule_version', v_rule_version,
    'candidates_examined', v_examined,
    'reviews_inserted', v_inserted,
    'reviews_updated', v_updated,
    'reviews_deferred', v_deferred,
    'protected_reviews_skipped', v_protected,
    'products_written', 0
  );
end;
$$;

revoke all on function public.refresh_candidate_promotion_reviews(text) from public;
revoke execute on function public.refresh_candidate_promotion_reviews(text) from anon;
revoke execute on function public.refresh_candidate_promotion_reviews(text) from authenticated;
grant execute on function public.refresh_candidate_promotion_reviews(text) to service_role;

comment on view public.candidate_ranking_evidence_summary is
  'Read-only ranking evidence summary for ranking-review-v2 B policy. Persistence uses distinct KST observed dates, not same-day reruns.';

comment on function public.refresh_candidate_promotion_reviews(text) is
  'Refreshes the manual promotion review queue with ranking-review-v2 B policy and never writes products.';

do $$
begin
  if exists (
    select 1
    from pg_get_functiondef('public.refresh_candidate_promotion_reviews(text)'::regprocedure) as definition
    where definition ilike '%insert into public.products%'
       or definition ilike '%update public.products%'
       or definition ilike '%delete from public.products%'
  ) then
    raise exception using
      errcode = '42501',
      message = 'review_refresh_products_write_detected';
  end if;
end $$;

commit;
