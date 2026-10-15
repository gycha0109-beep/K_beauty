-- D8K-7: repaired D8K-5/6 SCHEMA PROPOSAL for disposable local PG17 ONLY.
-- This file is NOT a migration. Do NOT run against production or hosted Supabase.
-- Requires pre-existing public.products and public.product_offers.
begin;

create table public.product_offer_option_observations (
  observation_id uuid primary key default gen_random_uuid(),
  offer_id uuid not null
    references public.product_offers(offer_id) on delete restrict,
  seller_option_key text not null,
  variant_id text not null,
  option_kind text not null,
  unit_size integer not null,
  size_unit text not null,
  quantity integer not null,
  gifts jsonb not null default '[]'::jsonb,
  selected_option_price_krw bigint not null,
  shipping_price_krw bigint,
  shipping_price_basis text not null default 'unknown',
  observed_at timestamptz not null,
  source_name text not null,
  source_record_id text not null,
  collector_actor_key text not null,
  source_evidence_sha256 text not null,
  recorded_at timestamptz not null default now(),
  constraint offer_option_key_shape check (
    seller_option_key ~ '^[a-z0-9][a-z0-9_:-]{0,95}$'
    and variant_id ~ '^[a-z0-9][a-z0-9_:-]{0,95}$'
  ),
  constraint offer_option_kind_check check (
    option_kind in ('single', 'multipack', 'kit')
  ),
  constraint offer_option_size_check check (
    unit_size between 1 and 10000
    and quantity between 1 and 10000
    and size_unit in ('ml', 'g', 'ea')
  ),
  constraint offer_option_gifts_array_check check (
    jsonb_typeof(gifts) = 'array'
    and jsonb_array_length(gifts) <= 12
  ),
  constraint offer_option_kind_composition_check check (
    (option_kind = 'single' and quantity = 1 and gifts = '[]'::jsonb)
    or (option_kind = 'multipack' and quantity >= 2 and gifts = '[]'::jsonb)
    or (option_kind = 'kit' and jsonb_array_length(gifts) between 1 and 12)
  ),
  constraint offer_option_price_check check (
    selected_option_price_krw between 1 and 1000000000
    and (shipping_price_krw is null or
         shipping_price_krw between 0 and 1000000000)
  ),
  constraint offer_option_shipping_basis_check check (
    (shipping_price_basis = 'unknown' and shipping_price_krw is null)
    or
    (shipping_price_basis = 'seller_published_flat'
       and shipping_price_krw is not null)
  ),
  constraint offer_option_source_check check (
    char_length(btrim(source_name)) between 1 and 80
    and char_length(btrim(source_record_id)) between 1 and 160
  ),
  constraint offer_option_collector_key_check check (
    collector_actor_key ~ '^[a-z0-9][a-z0-9_:-]{0,95}$'
  ),
  constraint offer_option_source_digest_check check (
    source_evidence_sha256 ~ '^[a-f0-9]{64}$'
  ),
  constraint offer_option_observed_date_check check (
    observed_at <= recorded_at
  ),
  constraint offer_option_history_identity_unique
    unique (offer_id, seller_option_key, observed_at)
);

create index offer_option_observations_offer_latest_idx
  on public.product_offer_option_observations
  (offer_id, seller_option_key, observed_at desc, observation_id desc);

-- Independent, append-only reviewer EVENTS. A later rejection can revoke
-- an earlier verification without overwriting the original observation.
create table public.product_offer_option_reviews (
  review_id uuid primary key default gen_random_uuid(),
  observation_id uuid not null
    references public.product_offer_option_observations(observation_id)
    on delete restrict,
  verdict text not null,
  reviewer_reference text not null,
  reviewer_actor_key text not null,
  evidence_sha256 text not null,
  reviewed_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint offer_option_review_verdict check (
    verdict in ('verified', 'rejected')
  ),
  constraint offer_option_reviewer_check check (
    char_length(btrim(reviewer_reference)) between 1 and 160
  ),
  constraint offer_option_reviewer_actor_check check (
    reviewer_actor_key ~ '^[a-z0-9][a-z0-9_:-]{0,95}$'
  ),
  constraint offer_option_digest_check check (
    evidence_sha256 ~ '^[a-f0-9]{64}$'
  ),
  constraint offer_option_review_time_check check (
    reviewed_at <= created_at
  ),
  constraint offer_option_review_event_unique
    unique (observation_id, reviewed_at)
);

create index offer_option_reviews_latest_idx
  on public.product_offer_option_reviews
  (observation_id, reviewed_at desc, created_at desc, review_id desc);

alter table public.product_offer_option_observations enable row level security;
alter table public.product_offer_option_reviews enable row level security;

-- Public schema defaults differ across Supabase/Postgres installations.
-- Explicitly close ALL built-in client grants.
revoke all on public.product_offer_option_observations
  from public, anon, authenticated, service_role;
revoke all on public.product_offer_option_reviews
  from public, anon, authenticated, service_role;

comment on table public.product_offer_option_observations is
  'Review-only D8K option-level history linked to immutable seller listing identity. Never Product price authority by itself.';
comment on table public.product_offer_option_reviews is
  'Review-only D8K append-only latest-verdict authority events. Latest rejection supersedes prior verification.';

commit;
