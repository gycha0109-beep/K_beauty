begin;

insert into public.product_offers (
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
  product_scope_state
)
values (
  '94000000-0000-4000-8000-000000000001',
  '93000000-0000-4000-8000-000000000001',
  'oliveyoung',
  'Olive Young',
  'legacy_product_buy_link_v1',
  'A000000900001',
  'https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000900001',
  null,
  'KRW',
  'unknown',
  'KR',
  null,
  'current',
  'product_subject_unresolved'
);

do $$
declare
  v_offer public.product_offers%rowtype;
  v_payload jsonb;
  v_t timestamptz := clock_timestamp();
  v_count integer;
begin
  select * into v_offer
  from public.product_offers
  where offer_id = '94000000-0000-4000-8000-000000000001';

  if v_offer.link_health_state <> 'unchecked'
     or v_offer.link_health_failure_streak <> 0
     or v_offer.link_health_last_check_id is not null then
    raise exception 'COMMERCE_LINK_HEALTH_RUNTIME_DEFAULT_FAILED';
  end if;

  if not has_schema_privilege('service_role', 'private', 'USAGE') then
    raise exception 'COMMERCE_LINK_HEALTH_SERVICE_ROLE_SCHEMA_USAGE_REQUIRED';
  end if;

  if not has_function_privilege(
    'service_role',
    to_regprocedure('private.record_product_offer_link_check_v1(uuid,text,timestamptz,text,text,integer,text,integer,text,text,integer,text)'),
    'EXECUTE'
  ) then
    raise exception 'COMMERCE_LINK_HEALTH_SERVICE_ROLE_EXECUTE_REQUIRED';
  end if;

  if has_function_privilege(
    'anon',
    to_regprocedure('private.record_product_offer_link_check_v1(uuid,text,timestamptz,text,text,integer,text,integer,text,text,integer,text)'),
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    to_regprocedure('private.record_product_offer_link_check_v1(uuid,text,timestamptz,text,text,integer,text,integer,text,text,integer,text)'),
    'EXECUTE'
  ) then
    raise exception 'COMMERCE_LINK_HEALTH_PUBLIC_EXECUTE_FORBIDDEN';
  end if;

  if has_table_privilege('anon', 'public.product_offer_link_checks', 'SELECT')
     or has_table_privilege('authenticated', 'public.product_offer_link_checks', 'SELECT')
     or has_table_privilege('service_role', 'public.product_offer_link_checks', 'SELECT') then
    raise exception 'COMMERCE_LINK_HEALTH_DIRECT_CHECK_READ_FORBIDDEN';
  end if;

  if has_column_privilege(
    'service_role',
    'public.product_offers',
    'link_health_state',
    'UPDATE'
  ) then
    raise exception 'COMMERCE_LINK_HEALTH_DIRECT_PROJECTION_UPDATE_FORBIDDEN';
  end if;

  select private.record_product_offer_link_check_v1(
    '94000000-0000-4000-8000-000000000001',
    'runtime-forbidden-1',
    v_t,
    'https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000900001',
    'https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000900001',
    403,
    'forbidden',
    0,
    'text/html',
    'HTTP_403',
    0,
    'commerce-link-health-checker-v1'
  ) into v_payload;

  if v_payload->>'link_health_state' <> 'unknown'
     or (v_payload->>'link_health_failure_streak')::integer <> 0 then
    raise exception 'COMMERCE_LINK_HEALTH_TRANSIENT_TRANSITION_FAILED';
  end if;

  select private.record_product_offer_link_check_v1(
    '94000000-0000-4000-8000-000000000001',
    'runtime-hard-1',
    v_t + interval '1 second',
    'https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000900001',
    'https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000900001',
    404,
    'hard_not_found',
    0,
    'text/html',
    'HTTP_404',
    7,
    'commerce-link-health-checker-v1'
  ) into v_payload;

  if v_payload->>'link_health_state' <> 'suspect'
     or (v_payload->>'link_health_failure_streak')::integer <> 1 then
    raise exception 'COMMERCE_LINK_HEALTH_FIRST_HARD_FAILURE_FAILED';
  end if;

  select private.record_product_offer_link_check_v1(
    '94000000-0000-4000-8000-000000000001',
    'runtime-transient-after-suspect',
    v_t + interval '2 seconds',
    'https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000900001',
    null,
    null,
    'network_error',
    0,
    null,
    'TIMEOUT',
    0,
    'commerce-link-health-checker-v1'
  ) into v_payload;

  if v_payload->>'link_health_state' <> 'suspect'
     or (v_payload->>'link_health_failure_streak')::integer <> 1 then
    raise exception 'COMMERCE_LINK_HEALTH_TRANSIENT_PRESERVATION_FAILED';
  end if;

  select private.record_product_offer_link_check_v1(
    '94000000-0000-4000-8000-000000000001',
    'runtime-hard-2',
    v_t + interval '3 seconds',
    'https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000900001',
    'https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000900001',
    410,
    'hard_not_found',
    0,
    'text/html',
    'HTTP_410',
    7,
    'commerce-link-health-checker-v1'
  ) into v_payload;

  if v_payload->>'link_health_state' <> 'broken'
     or (v_payload->>'link_health_failure_streak')::integer <> 2 then
    raise exception 'COMMERCE_LINK_HEALTH_SECOND_HARD_FAILURE_FAILED';
  end if;

  select private.record_product_offer_link_check_v1(
    '94000000-0000-4000-8000-000000000001',
    'runtime-hard-2',
    v_t + interval '3 seconds',
    'https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000900001',
    'https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000900001',
    410,
    'hard_not_found',
    0,
    'text/html',
    'HTTP_410',
    7,
    'commerce-link-health-checker-v1'
  ) into v_payload;

  if (v_payload->>'inserted')::boolean then
    raise exception 'COMMERCE_LINK_HEALTH_IDEMPOTENCY_FAILED';
  end if;

  select count(*) into v_count
  from public.product_offer_link_checks
  where offer_id = '94000000-0000-4000-8000-000000000001';

  if v_count <> 4 then
    raise exception 'COMMERCE_LINK_HEALTH_IDEMPOTENCY_COUNT_FAILED';
  end if;

  select private.record_product_offer_link_check_v1(
    '94000000-0000-4000-8000-000000000001',
    'runtime-recovery-1',
    v_t + interval '4 seconds',
    'https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000900001',
    'https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000900001',
    200,
    'healthy',
    0,
    'text/html',
    'LISTING_ID_OBSERVED',
    128,
    'commerce-link-health-checker-v1'
  ) into v_payload;

  if v_payload->>'link_health_state' <> 'healthy'
     or (v_payload->>'link_health_failure_streak')::integer <> 0 then
    raise exception 'COMMERCE_LINK_HEALTH_RECOVERY_FAILED';
  end if;

  begin
    perform private.record_product_offer_link_check_v1(
      '94000000-0000-4000-8000-000000000001',
      'runtime-stale-url',
      v_t + interval '5 seconds',
      'https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000999999',
      null,
      404,
      'hard_not_found',
      0,
      'text/html',
      'HTTP_404',
      7,
      'commerce-link-health-checker-v1'
    );
    raise exception 'COMMERCE_LINK_HEALTH_STALE_CHECK_WAS_ACCEPTED';
  exception
    when others then
      if sqlerrm <> 'COMMERCE_LINK_HEALTH_STALE_CHECK' then
        raise;
      end if;
  end;
end
$$;

rollback;

select 'COMMERCE_LINK_HEALTH_DB_RUNTIME: PASS' as result;
