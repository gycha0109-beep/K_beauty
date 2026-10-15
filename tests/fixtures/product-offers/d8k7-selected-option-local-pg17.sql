-- D8K-7 LOCAL DOCKER ONLY. Synthetic seller/price data, NO production DB.
-- Run after baseline Product/Offer role migrations and review-only D8K SQL.
-- ON_ERROR_STOP=1 is mandatory; any RAISE EXCEPTION fails the entire run.
\set ON_ERROR_STOP on

-- PG17's actual function owner, client roles and RLS state are checked below.
insert into public.product_offers (
  offer_id, product_id, seller_key, seller_name, source_name,
  listing_id, listing_url, offer_state, product_scope_state,
  market_code, currency_code
) values (
  '94000000-0000-4000-8000-000000000001',
  '93000000-0000-4000-8000-000000000001',
  'fixture_store', 'Synthetic Local Seller', 'd8k7_local_fixture',
  'LOCAL-ONE', 'https://example.invalid/local-only', 'current', 'product',
  'KR', 'KRW'
);

-- Five independent option observations under the ONE original seller listing:
-- 1 single unknown shipping, 2 kit paid shipping, 3 single free shipping,
-- 4 invalid same-actor review, 5 invalid digest review.
insert into public.product_offer_option_observations (
  observation_id,offer_id,seller_option_key,variant_id,option_kind,
  unit_size,size_unit,quantity,gifts,selected_option_price_krw,
  shipping_price_krw,shipping_price_basis,observed_at,source_name,
  source_record_id,collector_actor_key,source_evidence_sha256
) values
 ('95000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000001',
  'single80','serum80','single',80,'ml',1,'[]',24500,null,'unknown',
  now()-interval '4 hours','local_fixture','record1','collector_one',repeat('a',64)),
 ('95000000-0000-4000-8000-000000000002','94000000-0000-4000-8000-000000000001',
  'kit80','serumkit','kit',80,'ml',2,'[{"skuId":"gift10","quantity":1}]',
  29900,3000,'seller_published_flat',now()-interval '4 hours',
  'local_fixture','record2','collector_one',repeat('a',64)),
 ('95000000-0000-4000-8000-000000000003','94000000-0000-4000-8000-000000000001',
  'free80','freevariant','single',80,'ml',1,'[]',
  23000,0,'seller_published_flat',now()-interval '4 hours',
  'local_fixture','record3','collector_one',repeat('a',64)),
 ('95000000-0000-4000-8000-000000000004','94000000-0000-4000-8000-000000000001',
  'self80','selfvariant','single',80,'ml',1,'[]',
  21000,null,'unknown',now()-interval '4 hours',
  'local_fixture','record4','collector_one',repeat('a',64)),
 ('95000000-0000-4000-8000-000000000005','94000000-0000-4000-8000-000000000001',
  'digest80','digestvariant','single',80,'ml',1,'[]',
  20500,null,'unknown',now()-interval '4 hours',
  'local_fixture','record5','collector_one',repeat('a',64));

insert into public.product_offer_option_reviews (
  review_id,observation_id,verdict,reviewer_reference,
  reviewer_actor_key,evidence_sha256,reviewed_at
) values
 ('96000000-0000-4000-8000-000000000001',
  '95000000-0000-4000-8000-000000000001',
  'verified','local-fixture-review-1','reviewer_two',
  repeat('a',64),now()-interval '2 hours'),
 ('96000000-0000-4000-8000-000000000002',
  '95000000-0000-4000-8000-000000000002',
  'verified','local-fixture-review-2','reviewer_two',
  repeat('a',64),now()-interval '2 hours'),
 ('96000000-0000-4000-8000-000000000003',
  '95000000-0000-4000-8000-000000000003',
  'verified','local-fixture-review-3','reviewer_two',
  repeat('a',64),now()-interval '2 hours'),
 ('96000000-0000-4000-8000-000000000004',
  '95000000-0000-4000-8000-000000000004',
  'verified','local-fixture-review-self','collector_one',
  repeat('a',64),now()-interval '2 hours'),
 ('96000000-0000-4000-8000-000000000005',
  '95000000-0000-4000-8000-000000000005',
  'verified','local-fixture-review-bad-hash','reviewer_two',
  repeat('b',64),now()-interval '2 hours');

do $$
declare output jsonb;
begin
  output := public.read_selected_offer_option_evidence_v1(
    array['93000000-0000-4000-8000-000000000001'::uuid]);
  if output->>'status' <> 'AUTHORITY_RESOLVED'
     or jsonb_array_length(output->'options') <> 3 then
    raise exception 'D8K7_INITIAL_THREE_OPTIONS_FAILED: %', output;
  end if;
  if not exists (
    select 1 from jsonb_array_elements(output->'options') x
    where x->>'seller_option_key' = 'single80'
      and x->>'shipping_price_basis' = 'unknown'
      and x->'shipping_price_krw' = 'null'::jsonb
  ) then
    raise exception 'D8K7_UNKNOWN_SHIPPING_WAS_NOT_NULL';
  end if;
  if not exists (
    select 1 from jsonb_array_elements(output->'options') x
    where x->>'seller_option_key' = 'free80'
      and x->>'shipping_price_basis' = 'seller_published_flat'
      and (x->>'shipping_price_krw')::integer = 0
  ) then
    raise exception 'D8K7_FREE_SHIPPING_WAS_NOT_ZERO';
  end if;
  if exists (
    select 1 from jsonb_array_elements(output->'options') x
    where x->>'seller_option_key' in ('self80','digest80')
  ) then
    raise exception 'D8K7_UNTRUSTED_REVIEW_WAS_RETURNED';
  end if;
end $$;

-- Invalid recorded shipping basis must be rejected by real PG17 CHECK,
-- not just a JavaScript serializer.
do $$
begin
  begin
    insert into public.product_offer_option_observations (
      offer_id,seller_option_key,variant_id,option_kind,unit_size,size_unit,
      quantity,gifts,selected_option_price_krw,shipping_price_krw,
      shipping_price_basis,observed_at,source_name,source_record_id,
      collector_actor_key,source_evidence_sha256
    ) values (
      '94000000-0000-4000-8000-000000000001',
      'invalid_ship','variantinvalid','single',80,'ml',
      1,'[]',19900,0,'unknown',now()-interval '1 hour',
      'local_fixture','invalidshipping','collector_one',repeat('a',64)
    );
    raise exception 'D8K7_INVALID_SHIPPING_BASIS_ACCEPTED';
  exception when check_violation then
    null;
  end;
end $$;

-- Latest REJECTION overrides earlier verification of exact same quote.
insert into public.product_offer_option_reviews (
  review_id,observation_id,verdict,reviewer_reference,
  reviewer_actor_key,evidence_sha256,reviewed_at
) values (
 '96000000-0000-4000-8000-000000000006',
 '95000000-0000-4000-8000-000000000001',
 'rejected','local-fixture-revocation','reviewer_two',
 repeat('a',64),now()-interval '30 minutes'
);

do $$
declare output jsonb;
begin
 output := public.read_selected_offer_option_evidence_v1(
   array['93000000-0000-4000-8000-000000000001'::uuid]);
 if jsonb_array_length(output->'options') <> 2 or exists (
   select 1 from jsonb_array_elements(output->'options') x
   where x->>'seller_option_key' = 'single80'
 ) then
   raise exception 'D8K7_REVOCATION_OLD_PRICE_FALLBACK: %',output;
 end if;
end $$;

-- A newer unreviewed observation invalidates older verified kit evidence.
insert into public.product_offer_option_observations (
  observation_id,offer_id,seller_option_key,variant_id,option_kind,
  unit_size,size_unit,quantity,gifts,selected_option_price_krw,
  shipping_price_krw,shipping_price_basis,observed_at,
  source_name,source_record_id,collector_actor_key,source_evidence_sha256
) values (
  '95000000-0000-4000-8000-000000000006',
  '94000000-0000-4000-8000-000000000001',
  'kit80','serumkit','kit',80,'ml',2,
  '[{"skuId":"gift10","quantity":1}]',30900,null,'unknown',
  now()-interval '1 hour','local_fixture','new_unreviewed_kit',
  'collector_one',repeat('a',64)
);

do $$
declare output jsonb;
begin
 output := public.read_selected_offer_option_evidence_v1(
   array['93000000-0000-4000-8000-000000000001'::uuid]);
 if output->>'status' <> 'AUTHORITY_RESOLVED'
    or jsonb_array_length(output->'options') <> 1
    or output->'options'->0->>'seller_option_key' <> 'free80' then
    raise exception 'D8K7_NEW_UNREVIEWED_KIT_FALLBACK: %',output;
 end if;
 if output::text like '%example.invalid%' or output::text like '%listing_url%' then
    raise exception 'D8K7_RAW_URL_EXPOSED';
 end if;
end $$;

-- Bounded inputs, no grants to anon/authenticated/service_role, no raw
-- SELECT for recommendation_admission_runtime.
do $$
declare result jsonb;
begin
 if exists (
   select 1 from pg_class where oid =
     'public.product_offer_option_observations'::regclass
     and not relrowsecurity
 ) or exists (
   select 1 from pg_class where oid =
     'public.product_offer_option_reviews'::regclass
     and not relrowsecurity
 ) then
   raise exception 'D8K7_RLS_OFF';
 end if;
 if has_table_privilege('anon','public.product_offer_option_observations','SELECT')
   or has_table_privilege('authenticated','public.product_offer_option_observations','SELECT')
   or has_table_privilege('service_role','public.product_offer_option_observations','SELECT')
   or has_table_privilege('recommendation_admission_runtime',
        'public.product_offer_option_observations','SELECT')
   or has_table_privilege('anon','public.product_offer_option_reviews','SELECT')
   or has_table_privilege('authenticated','public.product_offer_option_reviews','SELECT')
   or has_table_privilege('service_role','public.product_offer_option_reviews','SELECT')
   or has_table_privilege('recommendation_admission_runtime',
        'public.product_offer_option_reviews','SELECT')
   or has_function_privilege('anon','public.read_selected_offer_option_evidence_v1(uuid[])','EXECUTE')
   or has_function_privilege('authenticated','public.read_selected_offer_option_evidence_v1(uuid[])','EXECUTE')
   or has_function_privilege('service_role','public.read_selected_offer_option_evidence_v1(uuid[])','EXECUTE')
   or not has_function_privilege('recommendation_admission_runtime',
      'public.read_selected_offer_option_evidence_v1(uuid[])','EXECUTE') then
   raise exception 'D8K7_ROLE_PERMISSION_BOUNDARY_FAILED';
 end if;
 result := public.read_selected_offer_option_evidence_v1(null);
 if result->>'status' <> 'NO_AUTHORITY' then
   raise exception 'D8K7_NULL_PRODUCT_IDS_ALLOWED';
 end if;
 result := public.read_selected_offer_option_evidence_v1('{}'::uuid[]);
 if result->>'status' <> 'NO_AUTHORITY' then
   raise exception 'D8K7_EMPTY_PRODUCT_IDS_ALLOWED';
 end if;
 result := public.read_selected_offer_option_evidence_v1(
   array[null::uuid]);
 if result->>'status' <> 'NO_AUTHORITY' then
   raise exception 'D8K7_NULL_ELEMENT_ALLOWED';
 end if;
 result := public.read_selected_offer_option_evidence_v1(
   array(select ('93000000-0000-4000-8000-' ||
     lpad(i::text,12,'0'))::uuid from generate_series(1,65) i));
 if result->>'status' <> 'NO_AUTHORITY' then
   raise exception 'D8K7_65_PRODUCT_LIMIT_ALLOWED';
 end if;
end $$;

-- Exceed 256 independently reviewed choices under ONE listing; read must
-- return only NO_AUTHORITY, never a truncated set of seller prices.
with inserted as (
 insert into public.product_offer_option_observations (
  offer_id,seller_option_key,variant_id,option_kind,
  unit_size,size_unit,quantity,gifts,selected_option_price_krw,
  shipping_price_krw,shipping_price_basis,observed_at,
  source_name,source_record_id,collector_actor_key,source_evidence_sha256
 ) select
  '94000000-0000-4000-8000-000000000001'::uuid,
  'cap_'||i::text,'variant_cap','single',
  80,'ml',1,'[]'::jsonb,15000,
  null,'unknown',now()-interval '3 hours',
  'local_fixture','cap_'||i::text,'collector_one',repeat('a',64)
 from generate_series(1,257) i
 returning observation_id
)
insert into public.product_offer_option_reviews (
 observation_id,verdict,reviewer_reference,reviewer_actor_key,
 evidence_sha256,reviewed_at
)
select observation_id,'verified','capacity_fixture','reviewer_two',
       repeat('a',64),now()-interval '2 hours'
from inserted;

do $$
declare output jsonb;
begin
 output := public.read_selected_offer_option_evidence_v1(
   array['93000000-0000-4000-8000-000000000001'::uuid]);
 if output->>'status' <> 'NO_AUTHORITY'
    or output->>'reason' <> 'SELECTED_OPTION_ROW_LIMIT_EXCEEDED'
    or output ? 'options' then
   raise exception 'D8K7_OPTION_257_CAPACITY_PARTIAL_LEAK: %',output;
 end if;
end $$;

-- Restore fixture to small valid shape for actual SET ROLE runtime probes.
delete from public.product_offer_option_reviews
where observation_id in (
 select observation_id from public.product_offer_option_observations
 where seller_option_key like 'cap_%'
);
delete from public.product_offer_option_observations
where seller_option_key like 'cap_%';

do $$
declare output jsonb;
begin
 output := public.read_selected_offer_option_evidence_v1(
   array['93000000-0000-4000-8000-000000000001'::uuid]);
 if output->>'status' <> 'AUTHORITY_RESOLVED'
    or jsonb_array_length(output->'options') <> 1 then
   raise exception 'D8K7_POST_CAP_RESTORE_FAILED: %',output;
 end if;
end $$;

\echo D8K7_PG17_SQL_ACCEPTANCE_PASS
