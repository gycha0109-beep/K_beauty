begin;

do $$
begin
  if not exists (
    select 1 from pg_roles where rolname = 'recommendation_admission_runtime'
  ) then
    raise exception 'COMMERCE_HEALTH_PRESENTATION_RUNTIME_ROLE_REQUIRED';
  end if;

  if not exists (
    select 1 from pg_roles where rolname = 'product_offer_presentation_reader_owner'
  ) then
    raise exception 'COMMERCE_HEALTH_PRESENTATION_READER_OWNER_REQUIRED';
  end if;
end
$$;

grant select (
  link_health_state,
  link_health_checked_at,
  link_health_failure_streak,
  link_health_reason,
  link_health_last_check_id
) on public.product_offers
  to product_offer_presentation_reader_owner;

create or replace function public.read_product_offer_presentation_authority_v2(
  p_product_ids uuid[]
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_offer_count integer;
  v_offers jsonb;
begin
  if p_product_ids is null or cardinality(p_product_ids) = 0 then
    return jsonb_build_object(
      'read_contract_version', 'product-offer-presentation-authority-read-v2',
      'status', 'NO_AUTHORITY',
      'reason', 'PRODUCT_IDS_REQUIRED'
    );
  end if;

  if cardinality(p_product_ids) > 64 then
    return jsonb_build_object(
      'read_contract_version', 'product-offer-presentation-authority-read-v2',
      'status', 'NO_AUTHORITY',
      'reason', 'PRODUCT_ID_LIMIT_EXCEEDED'
    );
  end if;

  if array_position(p_product_ids, null) is not null then
    return jsonb_build_object(
      'read_contract_version', 'product-offer-presentation-authority-read-v2',
      'status', 'NO_AUTHORITY',
      'reason', 'MALFORMED_PRODUCT_IDS'
    );
  end if;

  select count(o.offer_id)::integer
    into v_offer_count
  from public.product_offers o
  where o.product_id = any (p_product_ids);

  if v_offer_count > 256 then
    return jsonb_build_object(
      'read_contract_version', 'product-offer-presentation-authority-read-v2',
      'status', 'NO_AUTHORITY',
      'reason', 'OFFER_ROW_LIMIT_EXCEEDED'
    );
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'offer_id', o.offer_id,
        'product_id', o.product_id,
        'seller_key', o.seller_key,
        'seller_name', o.seller_name,
        'source_name', o.source_name,
        'listing_id', o.listing_id,
        'listing_url', o.listing_url,
        'price_amount', o.price_amount,
        'currency_code', o.currency_code,
        'availability_state', o.availability_state,
        'market_code', o.market_code,
        'locale', o.locale,
        'offer_state', o.offer_state,
        'product_scope_state', o.product_scope_state,
        'first_observed_at', o.first_observed_at,
        'last_observed_at', o.last_observed_at,
        'created_at', o.created_at,
        'link_health_state', o.link_health_state,
        'link_health_checked_at', o.link_health_checked_at,
        'link_health_failure_streak', o.link_health_failure_streak,
        'link_health_reason', o.link_health_reason,
        'link_health_last_check_id', o.link_health_last_check_id
      )
      order by o.product_id, o.created_at, o.offer_id
    ),
    '[]'::jsonb
  )
    into v_offers
  from public.product_offers o
  where o.product_id = any (p_product_ids);

  return jsonb_build_object(
    'read_contract_version', 'product-offer-presentation-authority-read-v2',
    'status', 'AUTHORITY_RESOLVED',
    'offers', v_offers
  );
end;
$$;

comment on function public.read_product_offer_presentation_authority_v2(uuid[]) is
  'Health-aware bounded Product Offer transport for post-recommendation commerce presentation. Link health is presentation-only and does not establish Product Fact, recommendation, price, inventory, or Product identity authority.';

revoke all on function public.read_product_offer_presentation_authority_v2(uuid[])
  from public, anon, authenticated, service_role;
grant execute on function public.read_product_offer_presentation_authority_v2(uuid[])
  to recommendation_admission_runtime;

grant create on schema public to product_offer_presentation_reader_owner;
grant product_offer_presentation_reader_owner to postgres;
alter function public.read_product_offer_presentation_authority_v2(uuid[])
  owner to product_offer_presentation_reader_owner;
revoke product_offer_presentation_reader_owner from postgres;
revoke create on schema public from product_offer_presentation_reader_owner;

do $$
begin
  if has_schema_privilege(
    'product_offer_presentation_reader_owner',
    'public',
    'CREATE'
  ) then
    raise exception 'COMMERCE_HEALTH_PRESENTATION_OWNER_SCHEMA_CREATE_FORBIDDEN';
  end if;

  if has_table_privilege(
    'recommendation_admission_runtime',
    'public.product_offers',
    'SELECT'
  ) then
    raise exception 'COMMERCE_HEALTH_PRESENTATION_RUNTIME_RAW_SELECT_FORBIDDEN';
  end if;

  if not has_function_privilege(
    'recommendation_admission_runtime',
    'public.read_product_offer_presentation_authority_v2(uuid[])',
    'EXECUTE'
  ) then
    raise exception 'COMMERCE_HEALTH_PRESENTATION_RUNTIME_RPC_EXECUTE_REQUIRED';
  end if;

  if has_function_privilege(
    'anon',
    'public.read_product_offer_presentation_authority_v2(uuid[])',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.read_product_offer_presentation_authority_v2(uuid[])',
    'EXECUTE'
  ) or has_function_privilege(
    'service_role',
    'public.read_product_offer_presentation_authority_v2(uuid[])',
    'EXECUTE'
  ) then
    raise exception 'COMMERCE_HEALTH_PRESENTATION_BROAD_RPC_EXECUTE_FORBIDDEN';
  end if;
end
$$;

commit;
