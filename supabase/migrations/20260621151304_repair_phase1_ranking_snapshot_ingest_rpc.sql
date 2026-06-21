begin;

create temp table phase1_ranking_snapshot_ingest_repair_precheck
on commit drop
as
select count(*)::integer as ranking_snapshots_count
from public.ranking_snapshots;

alter table public.ranking_snapshots
  add column if not exists ingest_key text;

update public.ranking_snapshots
set ingest_key = 'legacy-' || id::text
where ingest_key is null;

alter table public.ranking_snapshots
  alter column ingest_key set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ranking_snapshots_ingest_key_not_blank'
      and conrelid = 'public.ranking_snapshots'::regclass
  ) then
    alter table public.ranking_snapshots
      add constraint ranking_snapshots_ingest_key_not_blank check (btrim(ingest_key) <> '');
  end if;
end $$;

create unique index if not exists ranking_snapshots_ingest_key_key
  on public.ranking_snapshots (ingest_key);

alter table public.ranking_snapshots enable row level security;

revoke insert, update, delete on table public.ranking_snapshots from anon, authenticated;
grant select, insert, update on table public.ranking_snapshots to service_role;

create or replace function public.ingest_ranking_snapshot(
  p_ingest_key text,
  p_snapshot jsonb
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_existing_snapshot record;
  v_snapshot_id uuid;
  v_item_count integer;
  v_candidate_id uuid;
  v_candidate_inserted boolean;
  v_candidates_inserted integer := 0;
  v_candidates_reobserved integer := 0;
  v_pending_identity_count integer := 0;
  v_source_rankings_inserted integer := 0;
  v_source_rankings_skipped integer := 0;
  v_item record;
  v_rank_positions integer[];
  v_candidate_keys text[];
begin
  if p_ingest_key is null or btrim(p_ingest_key) = '' then
    raise exception using
      errcode = '22023',
      message = 'ranking_ingest_missing_ingest_key';
  end if;

  if p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object' then
    raise exception using
      errcode = '22023',
      message = 'ranking_ingest_invalid_snapshot';
  end if;

  if nullif(btrim(coalesce(p_snapshot->'job'->>'id', '')), '') is null
     or nullif(btrim(coalesce(p_snapshot->'job'->>'source', '')), '') is null
     or nullif(btrim(coalesce(p_snapshot->'job'->>'serviceCategory', '')), '') is null
     or nullif(btrim(coalesce(p_snapshot->'job'->>'rankingScope', '')), '') is null
     or nullif(btrim(coalesce(p_snapshot->'job'->>'rankingFilter', '')), '') is null
     or nullif(btrim(coalesce(p_snapshot->>'sourceUrl', '')), '') is null
     or nullif(btrim(coalesce(p_snapshot->>'collectedAt', '')), '') is null
     or nullif(btrim(coalesce(p_snapshot->>'collectorVersion', '')), '') is null
     or nullif(btrim(coalesce(p_snapshot->>'snapshotHash', '')), '') is null then
    raise exception using
      errcode = '22023',
      message = 'ranking_ingest_missing_snapshot_metadata';
  end if;

  if p_snapshot->'job'->>'serviceCategory' not in (
    'cleanser',
    'toner_essence',
    'toner_pad',
    'treatment',
    'moisturizer',
    'moisturizer_lotion_emulsion',
    'moisturizer_gel',
    'moisturizer_cream',
    'moisturizer_balm',
    'sunscreen'
  ) then
    raise exception using
      errcode = '22023',
      message = 'ranking_ingest_invalid_service_category';
  end if;

  if jsonb_typeof(p_snapshot->'items') <> 'array' then
    raise exception using
      errcode = '22023',
      message = 'ranking_ingest_invalid_items';
  end if;

  with items as (
    select *
    from jsonb_to_recordset(p_snapshot->'items') as item(
      "rankPosition" integer,
      "productName" text,
      "brandName" text,
      rating numeric,
      "reviewCount" integer,
      "thumbnailUrl" text,
      "sourceUrl" text,
      price numeric,
      "externalType" text,
      "externalId" text,
      "rawItem" jsonb
    )
  )
  select
    count(*)::integer,
    array_agg("rankPosition" order by "rankPosition"),
    array_agg(
      case
        when nullif(btrim(coalesce("externalType", '')), '') is not null
         and nullif(btrim(coalesce("externalId", '')), '') is not null
          then 'external::' || (p_snapshot->'job'->>'source') || '::' || btrim("externalType") || '::' || btrim("externalId")
        else null
      end
      order by "rankPosition"
    )
  into v_item_count, v_rank_positions, v_candidate_keys
  from items;

  if v_item_count = 0 then
    raise exception using
      errcode = '22023',
      message = 'ranking_ingest_empty_items';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_snapshot->'items') as item(
      "rankPosition" integer,
      "productName" text,
      "brandName" text,
      rating numeric,
      "reviewCount" integer,
      "thumbnailUrl" text,
      "sourceUrl" text,
      price numeric,
      "externalType" text,
      "externalId" text,
      "rawItem" jsonb
    )
    where "rankPosition" is null
       or "rankPosition" <= 0
       or nullif(btrim(coalesce("productName", '')), '') is null
       or nullif(btrim(coalesce("brandName", '')), '') is null
       or nullif(btrim(coalesce("sourceUrl", '')), '') is null
       or nullif(btrim(coalesce("externalType", '')), '') is null
       or nullif(btrim(coalesce("externalId", '')), '') is null
       or "rawItem" is null
       or jsonb_typeof("rawItem") <> 'object'
  ) then
    raise exception using
      errcode = '22023',
      message = 'ranking_ingest_malformed_item';
  end if;

  if (
    select count(*) <> count(distinct value)
    from unnest(v_rank_positions) as ranks(value)
  ) then
    raise exception using
      errcode = '23505',
      message = 'ranking_ingest_duplicate_rank_position';
  end if;

  if (
    select count(*) <> count(distinct value)
    from unnest(v_candidate_keys) as candidates(value)
  ) then
    raise exception using
      errcode = '23505',
      message = 'ranking_ingest_duplicate_candidate_identity';
  end if;

  insert into public.ranking_snapshots (
    ingest_key,
    job_id,
    source,
    service_category,
    ranking_scope,
    ranking_filter,
    source_url,
    collected_at,
    collector_version,
    snapshot_hash,
    raw_payload,
    item_count,
    status
  )
  values (
    p_ingest_key,
    p_snapshot->'job'->>'id',
    p_snapshot->'job'->>'source',
    p_snapshot->'job'->>'serviceCategory',
    p_snapshot->'job'->>'rankingScope',
    p_snapshot->'job'->>'rankingFilter',
    p_snapshot->>'sourceUrl',
    (p_snapshot->>'collectedAt')::timestamptz,
    p_snapshot->>'collectorVersion',
    p_snapshot->>'snapshotHash',
    coalesce(p_snapshot->'rawPayload', '{}'::jsonb),
    v_item_count,
    'collected'
  )
  on conflict (ingest_key) do nothing
  returning id into v_snapshot_id;

  if v_snapshot_id is null then
    select *
    into v_existing_snapshot
    from public.ranking_snapshots
    where ingest_key = p_ingest_key;

    if v_existing_snapshot.id is null then
      raise exception using
        errcode = '40001',
        message = 'ranking_ingest_concurrent_snapshot_not_visible';
    end if;

    if v_existing_snapshot.snapshot_hash <> p_snapshot->>'snapshotHash'
       or v_existing_snapshot.job_id <> p_snapshot->'job'->>'id'
       or v_existing_snapshot.source <> p_snapshot->'job'->>'source'
       or v_existing_snapshot.service_category <> p_snapshot->'job'->>'serviceCategory'
       or v_existing_snapshot.ranking_scope <> p_snapshot->'job'->>'rankingScope'
       or v_existing_snapshot.ranking_filter <> p_snapshot->'job'->>'rankingFilter'
       or v_existing_snapshot.source_url <> p_snapshot->>'sourceUrl'
       or v_existing_snapshot.collected_at <> (p_snapshot->>'collectedAt')::timestamptz
       or v_existing_snapshot.collector_version <> p_snapshot->>'collectorVersion' then
      raise exception using
        errcode = '23505',
        message = 'ranking_ingest_ingest_key_conflict';
    end if;

    if v_existing_snapshot.status <> 'ingested' then
      raise exception using
        errcode = '55000',
        message = 'ranking_ingest_existing_snapshot_not_ingested';
    end if;

    select count(*)::integer
    into v_source_rankings_skipped
    from public.source_rankings
    where snapshot_id = v_existing_snapshot.id;

    return jsonb_build_object(
      'snapshot_id', v_existing_snapshot.id,
      'snapshot_created', false,
      'source_rankings_inserted', 0,
      'source_rankings_skipped', v_source_rankings_skipped,
      'candidates_inserted', 0,
      'candidates_reobserved', 0,
      'pending_identity_count', 0,
      'products_written', 0
    );
  end if;

  for v_item in
    select *
    from jsonb_to_recordset(p_snapshot->'items') as item(
      "rankPosition" integer,
      "productName" text,
      "brandName" text,
      rating numeric,
      "reviewCount" integer,
      "thumbnailUrl" text,
      "sourceUrl" text,
      price numeric,
      "externalType" text,
      "externalId" text,
      "rawItem" jsonb
    )
    order by "rankPosition"
  loop
    v_candidate_id := null;
    v_candidate_inserted := false;

    insert into public.product_candidates (
      source_name,
      category_path,
      product_name_raw,
      brand_name_raw,
      normalized_name,
      normalized_brand,
      external_type,
      external_id,
      source_url,
      first_seen_at,
      last_seen_at,
      seen_count,
      latest_price,
      latest_raw_source,
      review_status
    )
    values (
      p_snapshot->'job'->>'source',
      p_snapshot->'job'->>'serviceCategory',
      v_item."productName",
      v_item."brandName",
      lower(btrim(v_item."productName")),
      lower(btrim(v_item."brandName")),
      btrim(v_item."externalType"),
      btrim(v_item."externalId"),
      v_item."sourceUrl",
      (p_snapshot->>'collectedAt')::timestamptz,
      (p_snapshot->>'collectedAt')::timestamptz,
      1,
      v_item.price,
      v_item."rawItem",
      'new'
    )
    on conflict (source_name, external_type, external_id)
      where external_id is not null
        and btrim(external_id) <> ''
        and external_type is not null
        and btrim(external_type) <> ''
    do update
      set source_url = excluded.source_url,
          last_seen_at = excluded.last_seen_at,
          seen_count = greatest(coalesce(public.product_candidates.seen_count, 0), 0) + 1,
          latest_price = excluded.latest_price,
          latest_raw_source = excluded.latest_raw_source
    returning id, (xmax = 0) into v_candidate_id, v_candidate_inserted;

    if v_candidate_inserted then
      v_candidates_inserted := v_candidates_inserted + 1;
    else
      v_candidates_reobserved := v_candidates_reobserved + 1;
    end if;

    if v_candidate_id is not null and exists (
      select 1
      from public.source_rankings
      where snapshot_id = v_snapshot_id
        and candidate_id = v_candidate_id
    ) then
      raise exception using
        errcode = '23505',
        message = 'ranking_ingest_duplicate_candidate_id';
    end if;

    insert into public.source_rankings (
      snapshot_id,
      candidate_id,
      source_name,
      category_path,
      rank_position,
      product_name,
      brand_name,
      rating,
      review_count,
      thumbnail_url,
      source_url,
      collected_at,
      raw_item
    )
    values (
      v_snapshot_id,
      v_candidate_id,
      p_snapshot->'job'->>'source',
      p_snapshot->'job'->>'serviceCategory',
      v_item."rankPosition",
      v_item."productName",
      v_item."brandName",
      v_item.rating,
      v_item."reviewCount",
      v_item."thumbnailUrl",
      v_item."sourceUrl",
      (p_snapshot->>'collectedAt')::timestamptz,
      v_item."rawItem"
    );

    v_source_rankings_inserted := v_source_rankings_inserted + 1;
  end loop;

  update public.ranking_snapshots
  set status = 'ingested'
  where id = v_snapshot_id;

  return jsonb_build_object(
    'snapshot_id', v_snapshot_id,
    'snapshot_created', true,
    'source_rankings_inserted', v_source_rankings_inserted,
    'source_rankings_skipped', 0,
    'candidates_inserted', v_candidates_inserted,
    'candidates_reobserved', v_candidates_reobserved,
    'pending_identity_count', v_pending_identity_count,
    'products_written', 0
  );
end;
$$;

revoke all on function public.ingest_ranking_snapshot(text, jsonb) from public;
revoke execute on function public.ingest_ranking_snapshot(text, jsonb) from anon;
revoke execute on function public.ingest_ranking_snapshot(text, jsonb) from authenticated;
grant execute on function public.ingest_ranking_snapshot(text, jsonb) to service_role;

comment on column public.ranking_snapshots.ingest_key is
  'Stable retry identity for one locally generated snapshot. snapshot_hash remains a comparison fingerprint and is not unique.';

do $$
declare
  v_before_count integer;
  v_after_count integer;
  v_duplicate_count integer;
begin
  select ranking_snapshots_count
  into v_before_count
  from phase1_ranking_snapshot_ingest_repair_precheck;

  select count(*)::integer
  into v_after_count
  from public.ranking_snapshots;

  if v_after_count < v_before_count then
    raise exception using
      errcode = '23514',
      message = 'phase1_repair_ranking_snapshots_count_decreased';
  end if;

  if exists (
    select 1
    from public.ranking_snapshots
    where ingest_key is null
       or btrim(ingest_key) = ''
  ) then
    raise exception using
      errcode = '23514',
      message = 'phase1_repair_invalid_ingest_key';
  end if;

  select count(*)::integer
  into v_duplicate_count
  from (
    select ingest_key
    from public.ranking_snapshots
    group by ingest_key
    having count(*) > 1
  ) duplicate_keys;

  if v_duplicate_count > 0 then
    raise exception using
      errcode = '23505',
      message = 'phase1_repair_duplicate_ingest_key';
  end if;

  if to_regprocedure('public.ingest_ranking_snapshot(text,jsonb)') is null then
    raise exception using
      errcode = '42883',
      message = 'phase1_repair_missing_ingest_ranking_snapshot_rpc';
  end if;
end $$;

commit;
