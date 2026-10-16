-- Synthetic pre-existing hosted catalog shape needed by unmodified D8D-v2
-- functions. Execute ONLY in an isolated disposable PostgreSQL 17 fixture.
-- Never use production users, connection strings, Product/Offer records.
ALTER TABLE public.products
 ADD COLUMN updated_at timestamptz DEFAULT now(),
 ADD COLUMN name text,
 ADD COLUMN brand text,
 ADD COLUMN category text,
 ADD COLUMN size_ml numeric,
 ADD COLUMN price_min integer,
 ADD COLUMN price_max integer,
 ADD COLUMN unit_price_per_10ml numeric,
 ADD COLUMN buy_link text,
 ADD COLUMN hwahae_url text,
 ADD COLUMN source_url text,
 ADD COLUMN external_source text,
 ADD COLUMN external_type text,
 ADD COLUMN external_id text,
 ADD COLUMN market_signals jsonb;
ALTER TABLE public.admin_product_correction_proposals_v1
 ADD COLUMN product_id uuid REFERENCES public.products(id),
 ADD COLUMN strategy text,
 ADD COLUMN product_revision timestamptz,
 ADD COLUMN evidence_ids uuid[],
 ADD COLUMN field_changes jsonb;
ALTER TABLE public.admin_product_correction_decisions_v1
 ADD COLUMN proposal_id uuid REFERENCES public.admin_product_correction_proposals_v1(proposal_id),
 ADD COLUMN decision text;
ALTER TABLE public.admin_product_correction_evidence_v1
 ADD COLUMN source_url text,
 ADD COLUMN selected_option text,
 ADD COLUMN checkout_price_krw numeric,
 ADD COLUMN captured_at timestamptz;
CREATE TABLE public.product_offers (
 offer_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 product_id uuid REFERENCES public.products(id),
 seller_key text,seller_name text,source_name text,listing_id text,
 listing_url text,price_amount numeric,currency_code text,market_code text,
 availability_state text,offer_state text,product_scope_state text,
 first_observed_at timestamptz,last_observed_at timestamptz,
 link_health_state text
);
-- Referenced by the original D8D-v2 apply/rollback SQL bodies.
-- These are synthetic, empty prerequisites, never hosted row copies.
CREATE TABLE public.product_source_bindings (
 binding_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 product_id uuid REFERENCES public.products(id),
 source_name text,external_type text,external_id text,source_url text,
 binding_state text,product_scope_state text
);
CREATE TABLE public.catalog_trust_intake (
 intake_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 product_id uuid REFERENCES public.products(id),
 identity_state text,trust_state text,subject_id uuid
);
CREATE TABLE public.product_fact_subjects (
 subject_row_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 product_id uuid REFERENCES public.products(id)
);
