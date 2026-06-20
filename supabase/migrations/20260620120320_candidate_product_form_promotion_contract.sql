alter table public.product_candidates
  add column if not exists product_form public.product_form;

comment on column public.product_candidates.product_form is
  'Treatment sub-form to promote into products.product_form when service_category is treatment.';

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
  elsif v_candidate.service_category in (
    'serum'::public.product_category,
    'ampoule'::public.product_category,
    'essence'::public.product_category
  ) then
    v_missing_flags := array_append(v_missing_flags, 'legacy_service_category');
  elsif v_candidate.service_category = 'treatment'::public.product_category then
    if v_candidate.product_form is null then
      v_missing_flags := array_append(v_missing_flags, 'missing_product_form');
    elsif v_candidate.product_form not in (
      'serum'::public.product_form,
      'ampoule'::public.product_form,
      'essence'::public.product_form,
      'booster'::public.product_form,
      'peeling_solution'::public.product_form
    ) then
      v_missing_flags := array_append(v_missing_flags, 'invalid_product_form');
    end if;
  elsif v_candidate.product_form is not null then
    v_missing_flags := array_append(v_missing_flags, 'unexpected_product_form');
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
      image_url,
      created_at,
      updated_at
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

revoke all on function public.promote_product_candidate(uuid, text) from public;
revoke execute on function public.promote_product_candidate(uuid, text) from anon;
revoke execute on function public.promote_product_candidate(uuid, text) from authenticated;
grant execute on function public.promote_product_candidate(uuid, text) to service_role;

-- Read-only verification checks after applying this migration:
--
-- select table_name, column_name, udt_name, is_nullable
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'product_candidates'
--   and column_name = 'product_form';
--
-- select pg_get_functiondef('public.promote_product_candidate(uuid,text)'::regprocedure)
--   like '%missing_product_form%' as validates_missing_product_form,
--   pg_get_functiondef('public.promote_product_candidate(uuid,text)'::regprocedure)
--   like '%legacy_service_category%' as blocks_legacy_service_category,
--   pg_get_functiondef('public.promote_product_candidate(uuid,text)'::regprocedure)
--   not like '%map_product_category%' as does_not_use_category_fallback;
--
-- select r.rolname as grantee,
--        has_function_privilege(r.oid, 'public.promote_product_candidate(uuid,text)'::regprocedure, 'EXECUTE') as can_execute
-- from pg_roles r
-- where r.rolname in ('anon', 'authenticated', 'service_role')
-- order by r.rolname;
