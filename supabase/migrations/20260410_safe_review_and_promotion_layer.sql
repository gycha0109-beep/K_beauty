begin;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'product_category'
  ) then
    create type public.product_category as enum (
      'cleanser',
      'toner_essence',
      'serum',
      'moisturizer',
      'sunscreen'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'product_texture'
  ) then
    create type public.product_texture as enum (
      'watery',
      'gel',
      'lotion',
      'cream'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'product_finish'
  ) then
    create type public.product_finish as enum (
      'fresh',
      'natural',
      'dewy',
      'soft_matte'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'product_review_status'
  ) then
    create type public.product_review_status as enum (
      'new',
      'auto_matched',
      'needs_review',
      'approved',
      'promoted',
      'rejected'
    );
  end if;
end
$$;

create or replace function public.normalize_basic_text(value text)
returns text
language sql
immutable
as $$
  select trim(regexp_replace(lower(coalesce(value, '')), '\s+', ' ', 'g'));
$$;

create or replace function public.normalize_brand_key(value text)
returns text
language sql
immutable
as $$
  with normalized as (
    select trim(
      regexp_replace(
        regexp_replace(
          regexp_replace(public.normalize_basic_text(value), '[._:+/&-]+', ' ', 'g'),
          '[{}[\]()<>]+',
          ' ',
          'g'
        ),
        '\s+',
        ' ',
        'g'
      )
    ) as normalized_value
  )
  select case normalized_value
    when 'dr g' then 'dr g'
    when 'dr.g' then 'dr g'
    when 'laroche posay' then 'la roche posay'
    when 'laroche-posay' then 'la roche posay'
    when 'la roche posay' then 'la roche posay'
    when 'makep rem' then 'makep rem'
    when 'makep:rem' then 'makep rem'
    else normalized_value
  end
  from normalized;
$$;

create or replace function public.normalize_product_key(value text)
returns text
language sql
immutable
as $$
  select trim(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            public.normalize_basic_text(value),
            '\b\d+(\.\d+)?\s?(ml|g|kg|oz|ea|pcs?|ct|pack|sheet|sheets)\b',
            ' ',
            'gi'
          ),
          '\b(refill|limited|special|set|gift|option|bundle|edition|renewal|1\+1|리필|한정|기획|옵션)\b',
          ' ',
          'gi'
        ),
        '[._:+/&-]+',
        ' ',
        'g'
      ),
      '\s+',
      ' ',
      'g'
    )
  );
$$;

create or replace function public.map_product_category(value text)
returns public.product_category
language sql
immutable
as $$
  select case public.normalize_basic_text(value)
    when 'cleanser' then 'cleanser'::public.product_category
    when 'cleansing' then 'cleanser'::public.product_category
    when 'toner' then 'toner_essence'::public.product_category
    when 'toner_essence' then 'toner_essence'::public.product_category
    when 'essence' then 'toner_essence'::public.product_category
    when 'serum' then 'serum'::public.product_category
    when 'ampoule' then 'serum'::public.product_category
    when 'cream' then 'moisturizer'::public.product_category
    when 'moisturizer' then 'moisturizer'::public.product_category
    when 'lotion' then 'moisturizer'::public.product_category
    when 'sunscreen' then 'sunscreen'::public.product_category
    when 'sun' then 'sunscreen'::public.product_category
    else 'toner_essence'::public.product_category
  end;
$$;

create or replace function public.map_product_texture(value text)
returns public.product_texture
language sql
immutable
as $$
  select case public.normalize_basic_text(value)
    when 'essence' then 'watery'::public.product_texture
    when 'gel' then 'gel'::public.product_texture
    when 'lotion' then 'lotion'::public.product_texture
    when 'cream' then 'cream'::public.product_texture
    else 'watery'::public.product_texture
  end;
$$;

create or replace function public.map_product_finish(value text)
returns public.product_finish
language sql
immutable
as $$
  select case public.normalize_basic_text(value)
    when 'fresh' then 'fresh'::public.product_finish
    when 'dewy' then 'dewy'::public.product_finish
    when 'moist' then 'dewy'::public.product_finish
    when 'soft-matte' then 'soft_matte'::public.product_finish
    when 'soft_matte' then 'soft_matte'::public.product_finish
    when 'matte' then 'soft_matte'::public.product_finish
    else 'natural'::public.product_finish
  end;
$$;

create or replace function public.map_irritation_risk(value text)
returns text
language sql
immutable
as $$
  select case public.normalize_basic_text(value)
    when '1' then 'low'
    when '2' then 'medium'
    when '3' then 'high'
    when 'low' then 'low'
    when 'medium' then 'medium'
    when 'high' then 'high'
    else 'medium'
  end;
$$;

create or replace function public.map_skin_types_to_array(value text)
returns text[]
language sql
immutable
as $$
  select coalesce(
    array_agg(distinct mapped_value order by mapped_value),
    '{}'::text[]
  )
  from (
    select case trim(lower(token))
      when 'oily' then 'oily'
      when 'dry' then 'dry'
      when 'combination' then 'combination'
      when 'sensitive' then 'sensitive'
      else null
    end as mapped_value
    from unnest(string_to_array(coalesce(value, ''), ',')) as token
  ) mapped
  where mapped_value is not null;
$$;

create or replace function public.map_concerns_to_array(value text)
returns text[]
language sql
immutable
as $$
  select coalesce(
    array_agg(distinct mapped_value order by mapped_value),
    '{}'::text[]
  )
  from (
    select case trim(lower(token))
      when 'dryness' then 'dehydration'
      when 'hydration' then 'dehydration'
      when 'dehydration' then 'dehydration'
      when 'sebum' then 'oiliness'
      when 'oiliness' then 'oiliness'
      when 'acne' then 'acne'
      when 'antiaging' then 'uneven_tone'
      when 'uneven_tone' then 'uneven_tone'
      when 'pores' then 'pores'
      when 'redness' then 'redness'
      when 'sensitivity' then 'redness'
      when 'barrier' then 'barrier'
      else null
    end as mapped_value
    from unnest(string_to_array(coalesce(value, ''), ',')) as token
  ) mapped
  where mapped_value is not null;
$$;

create or replace function public.merge_text_flags(existing_flags text[], new_flags text[])
returns text[]
language sql
immutable
as $$
  select coalesce(
    array_agg(distinct flag order by flag),
    '{}'::text[]
  )
  from unnest(coalesce(existing_flags, '{}'::text[]) || coalesce(new_flags, '{}'::text[])) as flag
  where flag is not null;
$$;

alter table public.products
  add column if not exists normalized_name text,
  add column if not exists normalized_brand text,
  add column if not exists updated_at timestamptz default now();

update public.products
set updated_at = coalesce(updated_at, created_at, now());

alter table public.products
  alter column category type public.product_category
  using public.map_product_category(category::text);

alter table public.products
  alter column texture type public.product_texture
  using public.map_product_texture(texture::text);

alter table public.products
  alter column finish type public.product_finish
  using public.map_product_finish(finish::text);

alter table public.products
  alter column skin_types type text[]
  using public.map_skin_types_to_array(skin_types::text);

alter table public.products
  alter column concerns type text[]
  using public.map_concerns_to_array(concerns::text);

alter table public.products
  alter column irritation_risk type text
  using public.map_irritation_risk(irritation_risk::text);

update public.products
set normalized_name = public.normalize_product_key(name),
    normalized_brand = public.normalize_brand_key(brand),
    concerns = public.map_concerns_to_array(array_to_string(concerns, ',')),
    skin_types = public.map_skin_types_to_array(array_to_string(skin_types, ',')),
    updated_at = now();

alter table public.products
  alter column category set not null,
  alter column texture set not null,
  alter column finish set not null,
  alter column skin_types set not null,
  alter column concerns set not null,
  alter column irritation_risk set not null,
  alter column sensitivity_safe set not null,
  alter column normalized_name set not null,
  alter column normalized_brand set not null,
  alter column updated_at set not null;

create unique index if not exists products_normalized_brand_name_key
  on public.products (normalized_brand, normalized_name);

alter table public.products
  drop constraint if exists products_irritation_risk_check;

alter table public.products
  add constraint products_irritation_risk_check
  check (irritation_risk in ('low', 'medium', 'high'));

alter table public.products
  drop constraint if exists products_skin_types_allowed_check;

alter table public.products
  add constraint products_skin_types_allowed_check
  check (skin_types <@ array['oily', 'dry', 'combination', 'sensitive']::text[]);

alter table public.products
  drop constraint if exists products_concerns_allowed_check;

alter table public.products
  add constraint products_concerns_allowed_check
  check (
    concerns <@ array[
      'oiliness',
      'dehydration',
      'acne',
      'uneven_tone',
      'pores',
      'redness',
      'barrier'
    ]::text[]
  );

alter table public.product_candidates
  add column if not exists service_category public.product_category,
  add column if not exists canonical_name text,
  add column if not exists canonical_brand text,
  add column if not exists matched_product_id uuid,
  add column if not exists duplicate_of_product_id uuid references public.products(id),
  add column if not exists review_status public.product_review_status default 'new',
  add column if not exists review_notes text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by text,
  add column if not exists promotion_payload jsonb,
  add column if not exists match_method text,
  add column if not exists match_confidence numeric,
  add column if not exists review_flags text[],
  add column if not exists promotion_version text default 'v1';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'product_candidates_matched_product_id_fkey'
      and conrelid = 'public.product_candidates'::regclass
  ) then
    alter table public.product_candidates
      add constraint product_candidates_matched_product_id_fkey
      foreign key (matched_product_id) references public.products(id);
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'product_candidates'
      and column_name = 'status'
  ) then
    execute $sql$
      update public.product_candidates
      set review_status = coalesce(
            review_status,
            case
              when status = 'new' then 'new'::public.product_review_status
              else 'needs_review'::public.product_review_status
            end
          ),
          promotion_version = coalesce(promotion_version, 'v1')
    $sql$;
  else
    update public.product_candidates
    set review_status = coalesce(review_status, 'new'::public.product_review_status),
        promotion_version = coalesce(promotion_version, 'v1');
  end if;
end
$$;

alter table public.product_candidates
  alter column review_status set default 'new',
  alter column review_status set not null;

create index if not exists product_candidates_review_status_created_at_idx
  on public.product_candidates (review_status, created_at desc);

create index if not exists product_candidates_normalized_brand_name_idx
  on public.product_candidates (normalized_brand, normalized_name);

create index if not exists product_candidates_service_category_review_status_idx
  on public.product_candidates (service_category, review_status);

create or replace view public.product_candidate_evidence_summary as
select
  pc.id as candidate_id,
  pc.source_name,
  pc.category_path,
  pc.normalized_brand,
  pc.normalized_name,
  count(sr.id)::integer as source_evidence_count,
  max(sr.collected_at) as latest_collected_at,
  min(sr.rank_position) as best_rank_position
from public.product_candidates pc
left join public.source_rankings sr
  on sr.source_name = pc.source_name
 and sr.category_path = pc.category_path
 and public.normalize_basic_text(sr.brand_name) = pc.normalized_brand
 and public.normalize_basic_text(sr.product_name) = pc.normalized_name
group by
  pc.id,
  pc.source_name,
  pc.category_path,
  pc.normalized_brand,
  pc.normalized_name;

create or replace function public.promote_product_candidate(p_candidate_id uuid, p_actor text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate public.product_candidates%rowtype;
  v_product_payload jsonb;
  v_skin_types text[];
  v_concerns text[];
  v_texture text;
  v_finish text;
  v_irritation_risk text;
  v_sensitivity_safe boolean;
  v_price_min numeric;
  v_price_max numeric;
  v_buy_link text;
  v_image_url text;
  v_normalized_name text;
  v_normalized_brand text;
  v_target_id uuid;
  v_action text;
  v_missing_flags text[] := '{}'::text[];
  v_actor text := nullif(trim(coalesce(p_actor, '')), '');
begin
  select *
  into v_candidate
  from public.product_candidates
  where id = p_candidate_id
  for update;

  if not found then
    raise exception 'Candidate % not found', p_candidate_id;
  end if;

  if v_candidate.review_status = 'promoted'::public.product_review_status then
    return jsonb_build_object(
      'candidate_id', v_candidate.id,
      'product_id', v_candidate.matched_product_id,
      'action', 'already_promoted',
      'review_status', v_candidate.review_status::text
    );
  end if;

  if v_candidate.review_status <> 'approved'::public.product_review_status then
    raise exception 'Candidate % must be approved before promotion. Current status: %', p_candidate_id, v_candidate.review_status::text;
  end if;

  if nullif(trim(coalesce(v_candidate.canonical_name, '')), '') is null then
    v_missing_flags := array_append(v_missing_flags, 'missing_canonical_name');
  end if;

  if nullif(trim(coalesce(v_candidate.canonical_brand, '')), '') is null then
    v_missing_flags := array_append(v_missing_flags, 'missing_canonical_brand');
  end if;

  if v_candidate.service_category is null then
    v_missing_flags := array_append(v_missing_flags, 'ambiguous_category');
  end if;

  v_product_payload := coalesce(v_candidate.promotion_payload -> 'product', '{}'::jsonb);

  select coalesce(array_agg(distinct item order by item), '{}'::text[])
  into v_skin_types
  from jsonb_array_elements_text(coalesce(v_product_payload -> 'skin_types', '[]'::jsonb)) as item;

  if coalesce(array_length(v_skin_types, 1), 0) = 0 then
    v_missing_flags := array_append(v_missing_flags, 'missing_skin_types');
  elsif exists (
    select 1 from unnest(v_skin_types) as item
    where item not in ('oily', 'dry', 'combination', 'sensitive')
  ) then
    v_missing_flags := array_append(v_missing_flags, 'invalid_skin_types');
  end if;

  select coalesce(array_agg(distinct item order by item), '{}'::text[])
  into v_concerns
  from jsonb_array_elements_text(coalesce(v_product_payload -> 'concerns', '[]'::jsonb)) as item;

  if coalesce(array_length(v_concerns, 1), 0) = 0 then
    v_missing_flags := array_append(v_missing_flags, 'missing_concerns');
  elsif exists (
    select 1 from unnest(v_concerns) as item
    where item not in ('oiliness', 'dehydration', 'acne', 'uneven_tone', 'pores', 'redness', 'barrier')
  ) then
    v_missing_flags := array_append(v_missing_flags, 'invalid_concerns');
  end if;

  v_texture := nullif(trim(coalesce(v_product_payload ->> 'texture', '')), '');
  if v_texture is null then
    v_missing_flags := array_append(v_missing_flags, 'missing_texture');
  elsif v_texture not in ('watery', 'gel', 'lotion', 'cream') then
    v_missing_flags := array_append(v_missing_flags, 'invalid_texture');
  end if;

  v_finish := nullif(trim(coalesce(v_product_payload ->> 'finish', '')), '');
  if v_finish is null then
    v_missing_flags := array_append(v_missing_flags, 'missing_finish');
  elsif v_finish not in ('fresh', 'natural', 'dewy', 'soft_matte') then
    v_missing_flags := array_append(v_missing_flags, 'invalid_finish');
  end if;

  v_irritation_risk := nullif(trim(coalesce(v_product_payload ->> 'irritation_risk', '')), '');
  if v_irritation_risk is null then
    v_missing_flags := array_append(v_missing_flags, 'missing_irritation_risk');
  elsif v_irritation_risk not in ('low', 'medium', 'high') then
    v_missing_flags := array_append(v_missing_flags, 'invalid_irritation_risk');
  end if;

  if not (v_product_payload ? 'sensitivity_safe') or v_product_payload -> 'sensitivity_safe' is null then
    v_missing_flags := array_append(v_missing_flags, 'missing_sensitivity_safe');
  else
    begin
      v_sensitivity_safe := (v_product_payload ->> 'sensitivity_safe')::boolean;
    exception
      when others then
        v_missing_flags := array_append(v_missing_flags, 'invalid_sensitivity_safe');
    end;
  end if;

  begin
    v_price_min := nullif(v_product_payload ->> 'price_min', '')::numeric;
  exception
    when others then
      v_price_min := null;
  end;

  begin
    v_price_max := nullif(v_product_payload ->> 'price_max', '')::numeric;
  exception
    when others then
      v_price_max := null;
  end;

  v_buy_link := nullif(trim(coalesce(v_product_payload ->> 'buy_link', '')), '');
  v_image_url := nullif(trim(coalesce(v_product_payload ->> 'image_url', '')), '');

  if coalesce(array_length(v_missing_flags, 1), 0) > 0 then
    update public.product_candidates
    set review_status = 'needs_review'::public.product_review_status,
        review_flags = public.merge_text_flags(review_flags, v_missing_flags),
        review_notes = trim(
          both from concat_ws(
            E'\n',
            nullif(review_notes, ''),
            'Promotion blocked: ' || array_to_string(v_missing_flags, ', ')
          )
        ),
        reviewed_at = now(),
        reviewed_by = coalesce(v_actor, reviewed_by),
        promotion_version = coalesce(promotion_version, 'v1')
    where id = v_candidate.id;

    return jsonb_build_object(
      'candidate_id', v_candidate.id,
      'action', 'blocked',
      'review_status', 'needs_review',
      'missing_flags', to_jsonb(v_missing_flags)
    );
  end if;

  v_normalized_name := public.normalize_product_key(v_candidate.canonical_name);
  v_normalized_brand := public.normalize_brand_key(v_candidate.canonical_brand);

  if v_candidate.duplicate_of_product_id is not null then
    select id
    into v_target_id
    from public.products
    where id = v_candidate.duplicate_of_product_id;
  end if;

  if v_target_id is null and v_candidate.matched_product_id is not null then
    select id
    into v_target_id
    from public.products
    where id = v_candidate.matched_product_id
      and normalized_name = v_normalized_name
      and normalized_brand = v_normalized_brand;
  end if;

  if v_target_id is null then
    select id
    into v_target_id
    from public.products
    where normalized_name = v_normalized_name
      and normalized_brand = v_normalized_brand
    limit 1;
  end if;

  if v_target_id is null then
    insert into public.products (
      name,
      brand,
      category,
      skin_types,
      concerns,
      texture,
      finish,
      irritation_risk,
      sensitivity_safe,
      normalized_name,
      normalized_brand,
      price_min,
      price_max,
      buy_link,
      image_url,
      created_at,
      updated_at
    ) values (
      v_candidate.canonical_name,
      v_candidate.canonical_brand,
      v_candidate.service_category,
      v_skin_types,
      v_concerns,
      v_texture::public.product_texture,
      v_finish::public.product_finish,
      v_irritation_risk,
      v_sensitivity_safe,
      v_normalized_name,
      v_normalized_brand,
      v_price_min,
      v_price_max,
      v_buy_link,
      v_image_url,
      now(),
      now()
    )
    returning id into v_target_id;

    v_action := 'inserted';
  else
    update public.products
    set buy_link = coalesce(public.products.buy_link, v_buy_link),
        image_url = coalesce(public.products.image_url, v_image_url),
        price_min = coalesce(public.products.price_min, v_price_min),
        price_max = coalesce(public.products.price_max, v_price_max),
        updated_at = now()
    where id = v_target_id;

    v_action := 'merged';
  end if;

  update public.product_candidates
  set matched_product_id = v_target_id,
      duplicate_of_product_id = case when v_action = 'merged' then v_target_id else null end,
      review_status = 'promoted'::public.product_review_status,
      reviewed_at = now(),
      reviewed_by = coalesce(v_actor, reviewed_by),
      promotion_version = coalesce(promotion_version, 'v1'),
      promotion_payload = jsonb_set(
        coalesce(promotion_payload, '{}'::jsonb),
        '{metadata}',
        coalesce(promotion_payload -> 'metadata', '{}'::jsonb) || jsonb_build_object(
          'version', coalesce(promotion_version, 'v1'),
          'promoted_at', now(),
          'promotion_action', v_action
        ),
        true
      )
  where id = v_candidate.id;

  return jsonb_build_object(
    'candidate_id', v_candidate.id,
    'product_id', v_target_id,
    'action', v_action,
    'review_status', 'promoted'
  );
end;
$$;

commit;
