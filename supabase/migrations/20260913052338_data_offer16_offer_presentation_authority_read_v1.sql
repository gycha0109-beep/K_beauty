begin;

do $$
begin
  if not exists (
    select 1 from pg_roles where rolname = 'recommendation_admission_runtime'
  ) then
    raise exception 'DATA_OFFER16_RUNTIME_ROLE_REQUIRED';
  end if;

  if not exists (
    select 1 from pg_roles where rolname = 'product_offer_presentation_reader_owner'
  ) then
    create role product_offer_presentation_reader_owner
      nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  else
    alter role product_offer_presentation_reader_owner
      nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  end if;
end
$$;

grant usage on schema public to recommendation_admission_runtime;
grant usage on schema public to product_offer_presentation_reader_owner;

revoke all privileges on public.product_offers from recommendation_admission_runtime;
revoke all privileges on public.product_offers from product_offer_presentation_reader_owner;

grant select (
  offer_id,
  product_id,
  seller_key,
  seller_name,
  source_name,
  listing_id,
  listing_url,
  price_amount,
  currency_code,
  availability_state,
  market_code,
  locale,
  offer_state,
  product_scope_state,
  first_observed_at,
  last_observed_at,
  created_at
) on public.product_offers
  to product_offer_presentation_reader_owner;

drop policy if exists data_offer16_offer_presentation_owner_select_v1
  on public.product_offers;
create policy data_offer16_offer_presentation_owner_select_v1
  on public.product_offers
  for select
  to product_offer_presentation_reader_owner
  using (true);

create or replace function public.read_product_offer_presentation_authority_v1(
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
      'read_contract_version', 'product-offer-presentation-authority-read-v1',
      'status', 'NO_AUTHORITY',
      'reason', 'PRODUCT_IDS_REQUIRED'
    );
  end if;

  if cardinality(p_product_ids) > 64 then
    return jsonb_build_object(
      'read_contract_version', 'product-offer-presentation-authority-read-v1',
      'status', 'NO_AUTHORITY',
      'reason', 'PRODUCT_ID_LIMIT_EXCEEDED'
    );
  end if;

  if array_position(p_product_ids, null) is not null then
    return jsonb_build_object(
      'read_contract_version', 'product-offer-presentation-authority-read-v1',
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
      'read_contract_version', 'product-offer-presentation-authority-read-v1',
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
        'created_at', o.created_at
      )
      order by o.product_id, o.created_at, o.offer_id
    ),
    '[]'::jsonb
  )
    into v_offers
  from public.product_offers o
  where o.product_id = any (p_product_ids);

  return jsonb_build_object(
    'read_contract_version', 'product-offer-presentation-authority-read-v1',
    'status', 'AUTHORITY_RESOLVED',
    'offers', v_offers
  );
end;
$$;

comment on function public.read_product_offer_presentation_authority_v1(uuid[]) is
  'DATA-OFFER16 bounded product-scoped Offer transport for post-recommendation commerce presentation only. It does not choose an Offer, authorize price projection, bind Product identity, or write recommendation semantics.';

revoke all on function public.read_product_offer_presentation_authority_v1(uuid[])
  from public, anon, authenticated, service_role;
grant execute on function public.read_product_offer_presentation_authority_v1(uuid[])
  to recommendation_admission_runtime;

grant create on schema public to product_offer_presentation_reader_owner;
grant product_offer_presentation_reader_owner to postgres;
alter function public.read_product_offer_presentation_authority_v1(uuid[])
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
    raise exception 'DATA_OFFER16_OWNER_SCHEMA_CREATE_FORBIDDEN';
  end if;

  if has_table_privilege(
    'recommendation_admission_runtime',
    'public.product_offers',
    'SELECT'
  ) then
    raise exception 'DATA_OFFER16_RUNTIME_RAW_SELECT_FORBIDDEN';
  end if;

  if has_table_privilege(
    'recommendation_admission_runtime',
    'public.product_offers',
    'INSERT'
  ) or has_table_privilege(
    'recommendation_admission_runtime',
    'public.product_offers',
    'UPDATE'
  ) or has_table_privilege(
    'recommendation_admission_runtime',
    'public.product_offers',
    'DELETE'
  ) then
    raise exception 'DATA_OFFER16_RUNTIME_RAW_WRITE_FORBIDDEN';
  end if;

  if not has_function_privilege(
    'recommendation_admission_runtime',
    'public.read_product_offer_presentation_authority_v1(uuid[])',
    'EXECUTE'
  ) then
    raise exception 'DATA_OFFER16_RUNTIME_RPC_EXECUTE_REQUIRED';
  end if;

  if has_function_privilege(
    'anon',
    'public.read_product_offer_presentation_authority_v1(uuid[])',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.read_product_offer_presentation_authority_v1(uuid[])',
    'EXECUTE'
  ) or has_function_privilege(
    'service_role',
    'public.read_product_offer_presentation_authority_v1(uuid[])',
    'EXECUTE'
  ) then
    raise exception 'DATA_OFFER16_BROAD_RPC_EXECUTE_FORBIDDEN';
  end if;
end
$$;

commit;
