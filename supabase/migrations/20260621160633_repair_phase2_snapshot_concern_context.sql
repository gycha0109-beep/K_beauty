begin;

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

update public.ranking_snapshots
set raw_payload = raw_payload
where raw_payload ? 'job';

update public.ranking_snapshots
set source_concern_key = null
where evidence_type = 'popularity'
  and source_concern_key = 'all';

do $$
begin
  if exists (
    select 1
    from public.ranking_snapshots
    where evidence_type = 'popularity'
      and source_concern_key = 'all'
  ) then
    raise exception using
      errcode = '23514',
      message = 'phase2_popularity_snapshot_concern_key_not_cleared';
  end if;
end $$;

commit;
