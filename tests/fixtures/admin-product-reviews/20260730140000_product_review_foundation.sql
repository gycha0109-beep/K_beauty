begin;

create type public.product_review_status as enum (
  'new',
  'auto_matched',
  'needs_review',
  'approved',
  'promoted',
  'rejected'
);

create type public.product_category as enum (
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
);

create type public.product_form as enum (
  'serum',
  'ampoule',
  'essence',
  'booster',
  'peeling_solution'
);

create type public.product_texture as enum ('watery', 'gel', 'lotion', 'cream');
create type public.product_finish as enum ('fresh', 'natural', 'dewy', 'soft_matte');

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text not null,
  category public.product_category not null,
  product_form public.product_form,
  skin_types text[] not null default '{}',
  concerns text[] not null default '{}',
  texture public.product_texture not null,
  finish public.product_finish not null,
  irritation_risk text not null,
  sensitivity_safe boolean not null,
  normalized_name text not null,
  normalized_brand text not null,
  price_min numeric,
  price_max numeric,
  buy_link text,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (normalized_brand, normalized_name)
);

create table public.product_candidates (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  external_type text,
  external_id text,
  source_url text,
  category_path text,
  product_name_raw text not null,
  brand_name_raw text not null,
  normalized_name text not null,
  normalized_brand text not null,
  service_category public.product_category,
  product_form public.product_form,
  canonical_name text,
  canonical_brand text,
  review_status public.product_review_status not null default 'new',
  review_flags text[] not null default '{}',
  match_method text,
  match_confidence numeric,
  matched_product_id uuid references public.products(id),
  duplicate_of_product_id uuid references public.products(id),
  promotion_payload jsonb,
  review_notes text,
  reviewed_at timestamptz,
  reviewed_by text,
  promotion_version text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  seen_count integer not null default 1 check (seen_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index product_candidates_source_external_key
  on public.product_candidates (source_name, external_type, external_id)
  where external_id is not null
    and btrim(external_id) <> ''
    and external_type is not null
    and btrim(external_type) <> '';

create table public.candidate_promotion_reviews (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null unique references public.product_candidates(id) on delete cascade,
  status text not null default 'queued',
  priority_score numeric not null default 0,
  selection_reason text not null default '',
  evidence_snapshot jsonb not null default '{}',
  rule_version text not null,
  first_queued_at timestamptz not null default now(),
  last_queued_at timestamptz not null default now(),
  reviewed_at timestamptz,
  review_note text,
  approved_product_id uuid references public.products(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint candidate_promotion_reviews_status_check
    check (status in ('queued', 'reviewing', 'approved', 'rejected', 'deferred'))
);

alter table public.products enable row level security;
alter table public.product_candidates enable row level security;
alter table public.candidate_promotion_reviews enable row level security;

revoke all on table public.products from public, anon, authenticated;
revoke all on table public.product_candidates from public, anon, authenticated;
revoke all on table public.candidate_promotion_reviews from public, anon, authenticated;

grant select, insert, update, delete on table public.products to service_role;
grant select, insert, update, delete on table public.product_candidates to service_role;
grant select, insert, update, delete on table public.candidate_promotion_reviews to service_role;

create or replace function public.normalize_basic_text(p_value text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select trim(regexp_replace(lower(coalesce(p_value, '')), '\s+', ' ', 'g'));
$$;

create or replace function public.normalize_brand_key(p_value text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  with normalized as (
    select trim(
      regexp_replace(
        regexp_replace(
          regexp_replace(public.normalize_basic_text(p_value), '[._:+/&-]+', ' ', 'g'),
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
    when 'laroche posay' then 'la roche posay'
    when 'makep rem' then 'makep rem'
    else normalized_value
  end
  from normalized;
$$;

create or replace function public.normalize_product_key(p_value text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select trim(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            public.normalize_basic_text(p_value),
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

create or replace function public.promote_product_candidate(
  p_candidate_id uuid,
  p_actor text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_candidate public.product_candidates%rowtype;
  v_product_payload jsonb;
  v_target_id uuid;
  v_action text;
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
begin
  select * into v_candidate
  from public.product_candidates
  where id = p_candidate_id
  for update;

  if not found then
    raise exception 'candidate_not_found';
  end if;

  if v_candidate.review_status = 'promoted' then
    return jsonb_build_object(
      'candidate_id', v_candidate.id,
      'product_id', v_candidate.matched_product_id,
      'action', 'already_promoted',
      'review_status', 'promoted'
    );
  end if;

  if v_candidate.review_status <> 'approved' then
    raise exception 'candidate_not_approved';
  end if;

  if nullif(btrim(coalesce(v_candidate.canonical_name, '')), '') is null
    or nullif(btrim(coalesce(v_candidate.canonical_brand, '')), '') is null
    or v_candidate.service_category is null
  then
    raise exception 'candidate_identity_incomplete';
  end if;

  if v_candidate.service_category = 'treatment' and v_candidate.product_form is null then
    raise exception 'missing_product_form';
  end if;

  v_product_payload := coalesce(v_candidate.promotion_payload -> 'product', '{}'::jsonb);

  select array_agg(value order by value) into v_skin_types
  from jsonb_array_elements_text(v_product_payload -> 'skin_types') as item(value);

  select array_agg(value order by value) into v_concerns
  from jsonb_array_elements_text(v_product_payload -> 'concerns') as item(value);

  v_texture := v_product_payload ->> 'texture';
  v_finish := v_product_payload ->> 'finish';
  v_irritation_risk := v_product_payload ->> 'irritation_risk';
  v_sensitivity_safe := (v_product_payload ->> 'sensitivity_safe')::boolean;
  v_price_min := nullif(v_product_payload ->> 'price_min', '')::numeric;
  v_price_max := nullif(v_product_payload ->> 'price_max', '')::numeric;
  v_buy_link := nullif(btrim(coalesce(v_product_payload ->> 'buy_link', '')), '');
  v_image_url := nullif(btrim(coalesce(v_product_payload ->> 'image_url', '')), '');

  if v_candidate.duplicate_of_product_id is not null then
    select id into v_target_id from public.products
    where id = v_candidate.duplicate_of_product_id;
  end if;

  if v_target_id is null and v_candidate.matched_product_id is not null then
    select id into v_target_id from public.products
    where id = v_candidate.matched_product_id
      and normalized_name = public.normalize_product_key(v_candidate.canonical_name)
      and normalized_brand = public.normalize_brand_key(v_candidate.canonical_brand);
  end if;

  if v_target_id is null then
    select id into v_target_id from public.products
    where normalized_name = public.normalize_product_key(v_candidate.canonical_name)
      and normalized_brand = public.normalize_brand_key(v_candidate.canonical_brand)
    limit 1;
  end if;

  if v_target_id is null then
    insert into public.products (
      name,
      brand,
      category,
      product_form,
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
      image_url
    ) values (
      v_candidate.canonical_name,
      v_candidate.canonical_brand,
      v_candidate.service_category,
      v_candidate.product_form,
      v_skin_types,
      v_concerns,
      v_texture::public.product_texture,
      v_finish::public.product_finish,
      v_irritation_risk,
      v_sensitivity_safe,
      public.normalize_product_key(v_candidate.canonical_name),
      public.normalize_brand_key(v_candidate.canonical_brand),
      v_price_min,
      v_price_max,
      v_buy_link,
      v_image_url
    ) returning id into v_target_id;
    v_action := 'inserted';
  else
    update public.products
    set buy_link = coalesce(buy_link, v_buy_link),
        image_url = coalesce(image_url, v_image_url),
        price_min = coalesce(price_min, v_price_min),
        price_max = coalesce(price_max, v_price_max),
        updated_at = now()
    where id = v_target_id;
    v_action := 'merged';
  end if;

  update public.product_candidates
  set matched_product_id = v_target_id,
      duplicate_of_product_id = case when v_action = 'merged' then v_target_id else null end,
      review_status = 'promoted',
      reviewed_at = now(),
      reviewed_by = coalesce(nullif(btrim(coalesce(p_actor, '')), ''), reviewed_by),
      updated_at = now()
  where id = p_candidate_id;

  return jsonb_build_object(
    'candidate_id', p_candidate_id,
    'product_id', v_target_id,
    'action', v_action,
    'review_status', 'promoted'
  );
end;
$$;

revoke all on function public.promote_product_candidate(uuid, text)
  from public, anon, authenticated;
grant execute on function public.promote_product_candidate(uuid, text)
  to service_role;

commit;
