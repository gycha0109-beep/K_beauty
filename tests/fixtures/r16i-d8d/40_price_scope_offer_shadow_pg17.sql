-- R16I price-scope capability shadow in isolated PG17 ONLY.
-- Uses fictional prices from 00_minimal_pg17.sql, not Production data.
-- Shows nullable Product commercial fields and TWO separate seller Offer rows
-- without extending auth, trusting URLs or changing the D8D apply RPC.
\set ON_ERROR_STOP on
BEGIN;

DO $before$
BEGIN
 IF (SELECT count(*) FROM public.product_offers
       WHERE product_id='b639c8b4-6a61-440e-b4db-fac7381593ff')<>0 OR
    (SELECT size_ml FROM public.products
       WHERE id='b639c8b4-6a61-440e-b4db-fac7381593ff')<>160
 THEN RAISE EXCEPTION 'R16I_SHADOW_NOT_AT_EXPECTED_BASELINE'; END IF;
END
$before$;

-- Shadow-only Product 80ml without asserting a canonical checkout/list price.
UPDATE public.products
SET size_ml=80,price_min=NULL,price_max=NULL,
    unit_price_per_10ml=NULL,buy_link=NULL
WHERE id='b639c8b4-6a61-440e-b4db-fac7381593ff';

-- Two selected seller-option checkout observations, not product catalog prices.
INSERT INTO public.product_offers(
 product_id,seller_key,seller_name,source_name,listing_id,listing_url,
 price_amount,currency_code,availability_state,offer_state,
 product_scope_state,first_observed_at,last_observed_at,link_health_state
) VALUES
 ('b639c8b4-6a61-440e-b4db-fac7381593ff',
  'snature','에스네이처 공식몰','official_single','151',
  'https://www.snature.kr/product/detail.html?product_no=151',
  24000,'KRW','unknown','current','product_subject_unresolved',now(),now(),'unchecked'),
 ('b639c8b4-6a61-440e-b4db-fac7381593ff',
  'hwahae','화해','hwahae_bundle','45194',
  'https://www.hwahae.co.kr/goods/45194',
  29900,'KRW','unknown','current','product_subject_unresolved',now(),now(),'unchecked');

DO $test$
DECLARE duplicate_denied boolean:=false;
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM public.products WHERE id='b639c8b4-6a61-440e-b4db-fac7381593ff'
    AND size_ml=80 AND price_min IS NULL AND price_max IS NULL
    AND unit_price_per_10ml IS NULL AND buy_link IS NULL
 ) THEN RAISE EXCEPTION 'R16I_SHADOW_CANONICAL_PRICE_LEAK'; END IF;
 IF (SELECT count(*) FROM public.product_offers
      WHERE product_id='b639c8b4-6a61-440e-b4db-fac7381593ff')<>2
    OR (SELECT count(*) FROM public.product_offers
      WHERE seller_key='snature' AND listing_id='151' AND price_amount=24000
        AND product_scope_state='product_subject_unresolved')<>1
    OR (SELECT count(*) FROM public.product_offers
      WHERE seller_key='hwahae' AND listing_id='45194' AND price_amount=29900
        AND product_scope_state='product_subject_unresolved')<>1
 THEN RAISE EXCEPTION 'R16I_SHADOW_SELLER_SCOPE_MIXED'; END IF;
 IF EXISTS (SELECT 1 FROM public.product_offers
           WHERE availability_state<>'unknown' OR link_health_state<>'unchecked')
 THEN RAISE EXCEPTION 'R16I_SHADOW_UNTRUSTED_CTA_PROMOTED'; END IF;
 IF (SELECT count(*) FROM public.product_fact_subjects
      WHERE product_id='b639c8b4-6a61-440e-b4db-fac7381593ff')<>0
 THEN RAISE EXCEPTION 'R16I_SHADOW_FACT_SUBJECT_CREATED'; END IF;
 BEGIN
   INSERT INTO public.product_offers(
    product_id,seller_key,seller_name,source_name,listing_id,listing_url,price_amount
   ) VALUES(
    'b639c8b4-6a61-440e-b4db-fac7381593ff','hwahae','화해',
    'hwahae_bundle','45194','https://www.hwahae.co.kr/goods/45194',30000
   );
 EXCEPTION WHEN unique_violation THEN duplicate_denied:=true;
 END;
 IF NOT duplicate_denied THEN RAISE EXCEPTION 'R16I_SHADOW_DUPLICATE_SELLER_ALLOWED'; END IF;
END
$test$;

SELECT 'R16I_D8H_TWO_SELLER_PRICE_SCOPE_SHADOW_PASS' AS result;
ROLLBACK;

-- Ensure the fixture is exactly as it was, even after simulation.
DO $after$
BEGIN
 IF (SELECT count(*) FROM public.product_offers
       WHERE product_id='b639c8b4-6a61-440e-b4db-fac7381593ff')<>0
    OR (SELECT size_ml FROM public.products
       WHERE id='b639c8b4-6a61-440e-b4db-fac7381593ff')<>160
    OR (SELECT price_min FROM public.products
       WHERE id='b639c8b4-6a61-440e-b4db-fac7381593ff')<>29900
 THEN RAISE EXCEPTION 'R16I_SHADOW_TRANSACTION_NOT_ROLLED_BACK'; END IF;
END
$after$;
SELECT 'R16I_D8H_TWO_SELLER_PRICE_SCOPE_ROLLBACK_PASS' AS result;
