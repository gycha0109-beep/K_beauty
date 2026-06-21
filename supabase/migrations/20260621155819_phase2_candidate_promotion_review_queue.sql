begin;

alter table public.ranking_snapshots
  add column if not exists source_category_key text,
  add column if not exists source_product_form text,
  add column if not exists source_concern_key text,
  add column if not exists canonical_concerns text[] not null default '{}'::text[],
  add column if not exists evidence_type text,
  add column if not exists requested_limit integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ranking_snapshots_evidence_type_check'
      and conrelid = 'public.ranking_snapshots'::regclass
  ) then
    alter table public.ranking_snapshots
      add constraint ranking_snapshots_evidence_type_check
      check (evidence_type is null or evidence_type in ('popularity', 'concern_relevance'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ranking_snapshots_requested_limit_check'
      and conrelid = 'public.ranking_snapshots'::regclass
  ) then
    alter table public.ranking_snapshots
      add constraint ranking_snapshots_requested_limit_check
      check (requested_limit is null or requested_limit > 0);
  end if;
end $$;

create index if not exists ranking_snapshots_evidence_context_idx
  on public.ranking_snapshots (evidence_type, service_category, source_category_key, source_concern_key);

create or replace function public.populate_ranking_snapshot_context()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.source_category_key := nullif(btrim(coalesce(
    new.raw_payload->'job'->>'sourceCategoryKey',
    new.raw_payload->'job'->>'source_category_key',
    new.source_category_key,
    ''
  )), '');

  new.source_product_form := nullif(btrim(coalesce(
    new.raw_payload->'job'->>'sourceProductForm',
    new.raw_payload->'job'->>'source_product_form',
    new.source_product_form,
    ''
  )), '');

  new.source_concern_key := nullif(btrim(coalesce(
    new.raw_payload->'job'->>'sourceConcernKey',
    new.raw_payload->'job'->>'source_concern_key',
    new.raw_payload->'job'->>'rankingFilter',
    new.source_concern_key,
    ''
  )), '');

  if jsonb_typeof(new.raw_payload->'job'->'canonicalConcerns') = 'array' then
    select coalesce(array_agg(value order by value), '{}'::text[])
    into new.canonical_concerns
    from jsonb_array_elements_text(new.raw_payload->'job'->'canonicalConcerns') as concerns(value)
    where btrim(value) <> '';
  elsif jsonb_typeof(new.raw_payload->'job'->'canonical_concerns') = 'array' then
    select coalesce(array_agg(value order by value), '{}'::text[])
    into new.canonical_concerns
    from jsonb_array_elements_text(new.raw_payload->'job'->'canonical_concerns') as concerns(value)
    where btrim(value) <> '';
  else
    new.canonical_concerns := coalesce(new.canonical_concerns, '{}'::text[]);
  end if;

  new.evidence_type := nullif(btrim(coalesce(
    new.raw_payload->'job'->>'evidenceType',
    new.raw_payload->'job'->>'evidence_type',
    new.evidence_type,
    ''
  )), '');

  new.requested_limit := coalesce(
    nullif(new.raw_payload->'job'->>'requestedLimit', '')::integer,
    nullif(new.raw_payload->'job'->>'requested_limit', '')::integer,
    nullif(new.raw_payload->'job'->>'limit', '')::integer,
    new.requested_limit
  );

  return new;
end;
$$;

drop trigger if exists trg_populate_ranking_snapshot_context on public.ranking_snapshots;
create trigger trg_populate_ranking_snapshot_context
before insert or update of raw_payload on public.ranking_snapshots
for each row
execute function public.populate_ranking_snapshot_context();

update public.ranking_snapshots
set raw_payload = raw_payload;

create table if not exists public.candidate_promotion_reviews (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.product_candidates(id) on delete cascade,
  status text not null default 'queued',
  priority_score numeric not null default 0,
  selection_reason text not null default '',
  evidence_snapshot jsonb not null default '{}'::jsonb,
  rule_version text not null,
  first_queued_at timestamptz not null default now(),
  last_queued_at timestamptz not null default now(),
  reviewed_at timestamptz,
  review_note text,
  approved_product_id uuid references public.products(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint candidate_promotion_reviews_candidate_id_key unique (candidate_id),
  constraint candidate_promotion_reviews_status_check
    check (status in ('queued', 'reviewing', 'approved', 'rejected', 'deferred')),
  constraint candidate_promotion_reviews_priority_score_check
    check (priority_score >= 0)
);

create index if not exists candidate_promotion_reviews_status_priority_idx
  on public.candidate_promotion_reviews (status, priority_score desc, last_queued_at desc);

alter table public.candidate_promotion_reviews enable row level security;
revoke all on table public.candidate_promotion_reviews from anon, authenticated;
grant select, insert, update on table public.candidate_promotion_reviews to service_role;

create or replace function public.set_candidate_promotion_reviews_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_candidate_promotion_reviews_updated_at on public.candidate_promotion_reviews;
create trigger trg_candidate_promotion_reviews_updated_at
before update on public.candidate_promotion_reviews
for each row
execute function public.set_candidate_promotion_reviews_updated_at();

create or replace view public.candidate_ranking_evidence_summary
with (security_invoker = true)
as
with observations as (
  select
    pc.id as candidate_id,
    sr.rank_position,
    sr.collected_at,
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
    collected_at as latest_collected_at
  from concern_observations
  where concern_key is not null
  order by candidate_id, concern_key, collected_at desc, rank_position asc
),
concern_groups as (
  select
    co.candidate_id,
    co.concern_key,
    count(*)::integer as observation_count,
    min(co.rank_position)::integer as best_rank,
    cl.latest_rank::integer,
    cl.latest_collected_at,
    jsonb_agg(
      jsonb_build_object(
        'rank', co.rank_position,
        'collected_at', co.collected_at,
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
  group by co.candidate_id, co.concern_key, cl.latest_rank, cl.latest_collected_at
),
concern_summary as (
  select
    candidate_id,
    count(*)::integer as distinct_concern_count,
    sum(observation_count)::integer as concern_observation_count,
    min(best_rank)::integer as concern_best_rank,
    count(*) filter (where best_rank <= 15)::integer as concern_top15_count,
    count(*) filter (where observation_count >= 2)::integer as repeated_concern_count,
    jsonb_agg(
      jsonb_build_object(
        'concern', concern_key,
        'observation_count', observation_count,
        'best_rank', best_rank,
        'latest_rank', latest_rank,
        'latest_collected_at', latest_collected_at,
        'observations', observations
      )
      order by best_rank asc, concern_key asc
    ) as concern_evidence
  from concern_groups
  group by candidate_id
),
popularity_observations as (
  select
    candidate_id,
    rank_position,
    collected_at,
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
    collected_at as latest_collected_at
  from popularity_observations
  order by candidate_id, collected_at desc, rank_position asc
),
popularity_summary as (
  select
    po.candidate_id,
    count(*)::integer as popularity_observation_count,
    min(po.rank_position)::integer as popularity_best_rank,
    pl.latest_rank::integer as popularity_latest_rank,
    pl.latest_collected_at as popularity_latest_collected_at,
    jsonb_agg(
      jsonb_build_object(
        'rank', po.rank_position,
        'collected_at', po.collected_at,
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
  group by po.candidate_id, pl.latest_rank, pl.latest_collected_at
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
  coalesce(cs.concern_observation_count, 0) as concern_observation_count,
  cs.concern_best_rank,
  coalesce(cs.concern_top15_count, 0) as concern_top15_count,
  coalesce(cs.repeated_concern_count, 0) as repeated_concern_count,
  coalesce(ps.popularity_observation_count, 0) as popularity_observation_count,
  ps.popularity_best_rank,
  ps.popularity_latest_rank,
  jsonb_build_object(
    'candidate', jsonb_build_object(
      'id', pc.id,
      'source_name', pc.source_name,
      'external_type', pc.external_type,
      'external_id', pc.external_id,
      'brand_name_raw', pc.brand_name_raw,
      'product_name_raw', pc.product_name_raw
    ),
    'concerns', coalesce(cs.concern_evidence, '[]'::jsonb),
    'popularity', jsonb_build_object(
      'observation_count', coalesce(ps.popularity_observation_count, 0),
      'best_rank', ps.popularity_best_rank,
      'latest_rank', ps.popularity_latest_rank,
      'latest_collected_at', ps.popularity_latest_collected_at,
      'observations', coalesce(ps.popularity_evidence, '[]'::jsonb)
    )
  ) as evidence_snapshot
from public.product_candidates pc
left join concern_summary cs on cs.candidate_id = pc.id
left join popularity_summary ps on ps.candidate_id = pc.id
left join product_matches pm on pm.candidate_id = pc.id;

revoke all on public.candidate_ranking_evidence_summary from anon, authenticated;
grant select on public.candidate_ranking_evidence_summary to service_role;

create or replace function public.refresh_candidate_promotion_reviews(p_rule_version text)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_rule_version text := nullif(btrim(coalesce(p_rule_version, '')), '');
  v_inserted integer := 0;
  v_updated integer := 0;
  v_protected integer := 0;
  v_examined integer := 0;
  v_review_id uuid;
  v_row record;
begin
  if v_rule_version is null then
    raise exception using
      errcode = '22023',
      message = 'review_refresh_missing_rule_version';
  end if;

  for v_row in
    select
      summary.*,
      (
        case when summary.concern_top15_count > 0 then 50 else 0 end
        + least(summary.repeated_concern_count, 3) * 18
        + least(summary.distinct_concern_count, 4) * 12
        + case
            when summary.popularity_best_rank is null then 0
            when summary.popularity_best_rank <= 20 then 18
            when summary.popularity_best_rank <= 50 then 10
            when summary.popularity_best_rank <= 100 then 5
            else 0
          end
      )::numeric as priority_score,
      concat_ws(
        '; ',
        case when summary.concern_top15_count > 0 then 'concern top 15 evidence' end,
        case when summary.repeated_concern_count > 0 then 'repeated same-concern evidence' end,
        case when summary.distinct_concern_count >= 2 then 'multiple concern evidence' end,
        case when summary.popularity_observation_count > 0 then 'popularity ranking evidence' end
      ) as selection_reason
    from public.candidate_ranking_evidence_summary summary
    where nullif(btrim(coalesce(summary.external_type, '')), '') is not null
      and nullif(btrim(coalesce(summary.external_id, '')), '') is not null
      and not summary.product_match_exists
      and (
        summary.concern_top15_count > 0
        or summary.repeated_concern_count > 0
        or summary.distinct_concern_count >= 2
      )
    order by priority_score desc, summary.concern_best_rank asc nulls last, summary.candidate_id
  loop
    v_examined := v_examined + 1;
    v_review_id := null;

    update public.candidate_promotion_reviews
    set priority_score = v_row.priority_score,
        selection_reason = v_row.selection_reason,
        evidence_snapshot = v_row.evidence_snapshot,
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
      v_row.evidence_snapshot,
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

  return jsonb_build_object(
    'rule_version', v_rule_version,
    'candidates_examined', v_examined,
    'reviews_inserted', v_inserted,
    'reviews_updated', v_updated,
    'protected_reviews_skipped', v_protected,
    'products_written', 0
  );
end;
$$;

revoke all on function public.refresh_candidate_promotion_reviews(text) from public;
revoke execute on function public.refresh_candidate_promotion_reviews(text) from anon;
revoke execute on function public.refresh_candidate_promotion_reviews(text) from authenticated;
grant execute on function public.refresh_candidate_promotion_reviews(text) to service_role;

comment on table public.candidate_promotion_reviews is
  'Human review queue for product candidate promotion. Phase 2 automation updates queued/reviewing evidence only and never writes products.';

comment on view public.candidate_ranking_evidence_summary is
  'Read-only ranking evidence summary used to queue product candidates for manual promotion review.';

do $$
begin
  if to_regclass('public.candidate_promotion_reviews') is null then
    raise exception using
      errcode = '42P01',
      message = 'phase2_missing_candidate_promotion_reviews';
  end if;

  if to_regprocedure('public.refresh_candidate_promotion_reviews(text)') is null then
    raise exception using
      errcode = '42883',
      message = 'phase2_missing_refresh_candidate_promotion_reviews_rpc';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'candidate_promotion_reviews'
      and grantee in ('anon', 'authenticated')
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
  ) then
    raise exception using
      errcode = '42501',
      message = 'phase2_candidate_promotion_reviews_public_write_privilege';
  end if;
end $$;

commit;
