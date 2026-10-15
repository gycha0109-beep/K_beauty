-- D8K-5 REVIEW-ONLY SQL CANDIDATE. NOT in supabase/migrations/.
-- NEVER run on hosted/production databases; must be regenerated with the
-- Supabase CLI and tested in an isolated PG17 environment before approval.
-- Existing product_offers seller+listing constraints are UNCHANGED.
begin;

create table public.product_offer_option_observations (
  observation_id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.product_offers(offer_id) on delete restrict,
  seller_option_key text not null,
  variant_id text not null,
  option_kind text not null,
  unit_size integer not null,
  size_unit text not null,
  quantity integer not null,
  gifts jsonb not null default '[]'::jsonb,
  selected_option_price_krw bigint not null,
  shipping_price_krw bigint,
  observed_at timestamptz not null,
  source_name text not null,
  source_record_id text not null,
  recorded_at timestamptz not null default now(),
  constraint offer_option_key_shape check (
    seller_option_key ~ '^[a-z0-9][a-z0-9_:-]{0,95}$' and
    variant_id ~ '^[a-z0-9][a-z0-9_:-]{0,95}$'
  ),
  constraint offer_option_kind_check check (option_kind in ('single','multipack','kit')),
  constraint offer_option_size_check check (
    unit_size between 1 and 10000 and quantity between 1 and 10000
    and size_unit in ('ml','g','ea')
  ),
  constraint offer_option_gifts_array_check check (
    jsonb_typeof(gifts) = 'array' and jsonb_array_length(gifts) <= 12
    -- Each gift skuId/quantity must also be validated in the server evidence
    -- projector. SQL JSON shapes are not independent evidence attestation.
  ),
  constraint offer_option_kind_composition_check check (
    (option_kind = 'single' and quantity = 1 and gifts = '[]'::jsonb)
    or (option_kind = 'multipack' and quantity >= 2 and gifts = '[]'::jsonb)
    or (option_kind = 'kit' and jsonb_array_length(gifts) between 1 and 12)
  ),
  constraint offer_option_price_check check (
    selected_option_price_krw between 1 and 1000000000 and
    (shipping_price_krw is null or shipping_price_krw between 0 and 1000000000)
  ),
  constraint offer_option_source_check check (
    char_length(btrim(source_name)) between 1 and 80 and
    char_length(btrim(source_record_id)) between 1 and 160
  ),
  constraint offer_option_observed_date_check check (observed_at <= recorded_at),
  constraint offer_option_history_identity_unique
    unique (offer_id, seller_option_key, observed_at)
);
create index offer_option_observations_offer_latest_idx
  on public.product_offer_option_observations
  (offer_id, seller_option_key, observed_at desc, observation_id desc);

-- Independent reviewer event. A source observation MUST NOT self-authorize.
create table public.product_offer_option_reviews (
  review_id uuid primary key default gen_random_uuid(),
  observation_id uuid not null
    references public.product_offer_option_observations(observation_id)
    on delete restrict,
  verdict text not null,
  reviewer_reference text not null,
  evidence_sha256 text not null,
  reviewed_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint offer_option_review_verdict check (verdict in ('verified','rejected')),
  constraint offer_option_reviewer_check check
    (char_length(btrim(reviewer_reference)) between 1 and 160),
  constraint offer_option_digest_check check
    (evidence_sha256 ~ '^[a-f0-9]{64}$'),
  constraint offer_option_review_time_check check (reviewed_at <= created_at),
  constraint offer_option_review_event_unique
    unique (observation_id, reviewed_at)
);
-- Append-only review events permit subsequent rejection/revocation of a
-- prior verified observation without mutating or deleting the audit record.
-- Index ALL verdicts: latest rejection MUST suppress previous verification.
create index offer_option_reviews_latest_idx
  on public.product_offer_option_reviews
  (observation_id, reviewed_at desc, review_id desc);

-- Defense in depth. No policy grants any UI client access. There is no
-- ingestion/review writer grant, RPC, or runtime role added in this proposal.
alter table public.product_offer_option_observations enable row level security;
alter table public.product_offer_option_reviews enable row level security;
revoke all on public.product_offer_option_observations
  from public, anon, authenticated, service_role;
revoke all on public.product_offer_option_reviews
  from public, anon, authenticated, service_role;

comment on table public.product_offer_option_observations is
  'D8K-5 candidate append-only selected option observation history, separate from seller listing identity and product-level prices. No live writer or reader grant.';
comment on table public.product_offer_option_reviews is
  'D8K-6 candidate append-only review event history; latest review verdict wins, including rejection/revocation, without exposing Product admission or CTA.';

-- If approved, isolated PG17 tests must prove intended RLS/grant denial
-- for all client roles, review immutability/authority, and ability of a
-- specifically approved server reader to see only verified latest options.
-- Nothing here inserts backfill, updates product_offers, or grants API access.
commit;
