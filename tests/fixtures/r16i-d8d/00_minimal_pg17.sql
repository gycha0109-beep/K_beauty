-- Self-contained isolated PostgreSQL 17 fixture for D8D only.
-- These rows are SYNTHETIC. No production seller price is asserted.
CREATE SCHEMA IF NOT EXISTS auth;
DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END;
$$;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE TABLE public.admin_memberships(
 user_id uuid PRIMARY KEY REFERENCES auth.users(id),role text NOT NULL,is_active boolean NOT NULL);
CREATE TABLE public.products(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text,brand text,category text,size_ml numeric,
 price_min integer,price_max integer,unit_price_per_10ml numeric,
 buy_link text,hwahae_url text,source_url text,
 external_source text,external_type text,external_id text,
 market_signals jsonb NOT NULL DEFAULT '{}'::jsonb,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION public.fixture_products_updated_at() RETURNS trigger
 LANGUAGE plpgsql AS $$BEGIN NEW.updated_at:=clock_timestamp();RETURN NEW;END;$$;
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON public.products
 FOR EACH ROW EXECUTE FUNCTION public.fixture_products_updated_at();
CREATE TABLE public.product_source_bindings(
 product_id uuid NOT NULL,source_name text NOT NULL,external_type text,
 external_id text,source_url text,binding_state text,product_scope_state text);
CREATE TABLE public.catalog_trust_intake(
 product_id uuid NOT NULL,identity_state text,trust_state text,subject_id uuid);
CREATE TABLE public.product_fact_subjects(product_id uuid NOT NULL);
CREATE TABLE public.product_offers(
 offer_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
 seller_key text NOT NULL,seller_name text NOT NULL,source_name text NOT NULL,
 listing_id text,listing_url text NOT NULL,
 price_amount numeric,currency_code text NOT NULL DEFAULT 'KRW',
 availability_state text NOT NULL DEFAULT 'unknown',
 offer_state text NOT NULL DEFAULT 'current',
 product_scope_state text NOT NULL DEFAULT 'product_subject_unresolved',
 first_observed_at timestamptz,last_observed_at timestamptz,
 link_health_state text NOT NULL DEFAULT 'unchecked',
 UNIQUE(seller_key,listing_id), UNIQUE(seller_key,listing_url)
);
CREATE TABLE public.admin_product_correction_evidence_v1 (
 evidence_id uuid PRIMARY KEY,product_id uuid NOT NULL REFERENCES public.products(id),
 source_key text NOT NULL,source_url text NOT NULL,
 selected_option text NOT NULL,checkout_price_krw integer,
 captured_at timestamptz NOT NULL
);
CREATE TABLE public.admin_product_correction_evidence_verdicts_v1 (
 verdict_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 evidence_id uuid NOT NULL REFERENCES public.admin_product_correction_evidence_v1(evidence_id),
 verdict text NOT NULL
);
CREATE TABLE public.admin_product_correction_proposals_v1 (
 proposal_id uuid PRIMARY KEY,product_id uuid NOT NULL REFERENCES public.products(id),
 product_revision timestamptz NOT NULL,baseline_sha256 text NOT NULL,strategy text NOT NULL,
 field_changes jsonb NOT NULL,evidence_ids uuid[] NOT NULL
);
CREATE TABLE public.admin_product_correction_decisions_v1 (
 decision_id uuid PRIMARY KEY,proposal_id uuid NOT NULL REFERENCES public.admin_product_correction_proposals_v1(proposal_id),
 decision text NOT NULL
);

INSERT INTO auth.users(id) VALUES
 ('00000000-0000-4000-8000-000000000011'),
 ('00000000-0000-4000-8000-000000000012');
INSERT INTO public.admin_memberships(user_id,role,is_active)
VALUES('00000000-0000-4000-8000-000000000011','admin_owner',true),
('00000000-0000-4000-8000-000000000012','admin_operator',true);
INSERT INTO public.products(
 id,name,brand,category,size_ml,price_min,price_max,unit_price_per_10ml,
 buy_link,hwahae_url,source_url,external_source,external_type,external_id,
 market_signals,updated_at
) VALUES(
 'b639c8b4-6a61-440e-b4db-fac7381593ff',
 '아쿠아 스쿠알란 수분크림','에스네이처','moisturizer_cream',
 160,29900,29900,1868.75,
 'https://www.hwahae.co.kr/goods/45194',
 'https://www.hwahae.co.kr/goods/45194',
 'https://www.hwahae.co.kr/goods/45194','hwahae','goods','45194',
 '{"review_count":41475,"rating":4.58}',
 '2026-09-10T00:32:38.713599+00'
);
INSERT INTO public.product_source_bindings
 VALUES('b639c8b4-6a61-440e-b4db-fac7381593ff','hwahae','goods','45194',
 'https://www.hwahae.co.kr/goods/45194','resolved','product_subject_unresolved');
INSERT INTO public.catalog_trust_intake
 VALUES('b639c8b4-6a61-440e-b4db-fac7381593ff','SUBJECT_CREATION_REQUIRED','REVIEW_REQUIRED',null);

-- Both prices below are fictional isolated PG fixtures, NOT verified real prices.
INSERT INTO public.admin_product_correction_evidence_v1(
 evidence_id,product_id,source_key,source_url,selected_option,checkout_price_krw,captured_at
) VALUES
 ('00000000-0000-4000-8000-000000000041','b639c8b4-6a61-440e-b4db-fac7381593ff',
  'official_single','https://www.snature.kr/product/detail.html?product_no=151',
  '80ml 단품 스쿠알란 수분크림',24000,now()),
 ('00000000-0000-4000-8000-000000000042','b639c8b4-6a61-440e-b4db-fac7381593ff',
  'hwahae_bundle','https://www.hwahae.co.kr/goods/45194',
  '80ml 2개 + 세럼 10ml 기획',29900,now());
INSERT INTO public.admin_product_correction_evidence_verdicts_v1(evidence_id,verdict)
VALUES('00000000-0000-4000-8000-000000000041','VERIFIED'),
('00000000-0000-4000-8000-000000000042','VERIFIED');
INSERT INTO public.admin_product_correction_proposals_v1(
 proposal_id,product_id,product_revision,baseline_sha256,strategy,field_changes,evidence_ids
) VALUES(
 '00000000-0000-4000-8000-000000000021',
 'b639c8b4-6a61-440e-b4db-fac7381593ff',
 '2026-09-10T00:32:38.713599+00',repeat('a',64),
 'A_PRODUCT_ANCHOR_REUSE_AND_OFFER_SEPARATION',
 '[{"field":"products.size_ml","before":160,"after":80},
 {"field":"products.price_min","before":29900,"after":24000},
 {"field":"products.price_max","before":29900,"after":24000},
 {"field":"products.unit_price_per_10ml","before":1868.75,"after":3000},
 {"field":"products.buy_link","before":"https://www.hwahae.co.kr/goods/45194",
 "after":"https://www.snature.kr/product/detail.html?product_no=151"}]'::jsonb,
 ARRAY['00000000-0000-4000-8000-000000000041'::uuid,
 '00000000-0000-4000-8000-000000000042'::uuid]
);
INSERT INTO public.admin_product_correction_decisions_v1(decision_id,proposal_id,decision)
VALUES('00000000-0000-4000-8000-000000000031',
'00000000-0000-4000-8000-000000000021','APPROVE_FOR_D8D_REVIEW');
