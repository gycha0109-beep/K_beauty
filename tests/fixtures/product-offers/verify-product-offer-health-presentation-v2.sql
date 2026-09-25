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
  '95000000-0000-4000-8000-000000000001',
  '93000000-0000-4000-8000-000000000001',
  'oliveyoung',
  'Olive Young',
  'legacy_product_buy_link_v1',
  'A000000900101',
  'https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000900101',
  null,
  'KRW',
  'unknown',
  'KR',
  'ko-KR',
  'current',
  'product_subject_unresolved'
);

select private.record_product_offer_link_check_v1(
  '95000000-0000-4000-8000-000000000001',
  'runtime-presentation-v2-unknown',
  clock_timestamp(),
  'https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000900101',
  'https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000900101',
  403,
  'forbidden',
  0,
  'text/html',
  'HTTP_403',
  0,
  'commerce-link-health-checker-v1'
);

set local role recommendation_admission_runtime;

do $$
declare
  v_payload jsonb;
  v_offer jsonb;
begin
  v_payload := public.read_product_offer_presentation_authority_v2(
    array['93000000-0000-4000-8000-000000000001'::uuid]
  );

  if v_payload->>'read_contract_version' <> 'product-offer-presentation-authority-read-v2'
     or v_payload->>'status' <> 'AUTHORITY_RESOLVED' then
    raise exception 'COMMERCE_HEALTH_PRESENTATION_V2_CONTRACT_FAILED';
  end if;

  select value into v_offer
  from jsonb_array_elements(v_payload->'offers')
  where value->>'offer_id' = '95000000-0000-4000-8000-000000000001';

  if v_offer is null then
    raise exception 'COMMERCE_HEALTH_PRESENTATION_V2_OFFER_MISSING';
  end if;

  if v_offer->>'link_health_state' <> 'unknown'
     or (v_offer->>'link_health_failure_streak')::integer <> 0
     or v_offer->>'link_health_reason' <> 'HTTP_403'
     or nullif(v_offer->>'link_health_last_check_id', '') is null then
    raise exception 'COMMERCE_HEALTH_PRESENTATION_V2_HEALTH_FIELDS_FAILED';
  end if;
end
$$;

reset role;

rollback;

select 'COMMERCE_HEALTH_PRESENTATION_V2_DB_RUNTIME: PASS' as result;
