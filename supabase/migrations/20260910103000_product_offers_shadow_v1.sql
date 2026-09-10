begin;

create table if not exists public.product_offers (
  offer_id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  seller_key text not null,
  seller_name text not null,
  source_name text not null,
  listing_id text,
  listing_url text not null,
  price_amount numeric(14,2),
  currency_code text not null default 'KRW',
  availability_state text not null default 'unknown',
  market_code text not null default 'KR',
  locale text,
  offer_state text not null default 'current',
  product_scope_state text not null default 'product_subject_unresolved',
  first_observed_at timestamptz,
  last_observed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint product_offers_seller_key_check
    check (char_length(btrim(seller_key)) between 1 and 80),
  constraint product_offers_seller_name_check
    check (char_length(btrim(seller_name)) between 1 and 160),
  constraint product_offers_source_name_check
    check (char_length(btrim(source_name)) between 1 and 64),
  constraint product_offers_listing_id_check
    check (listing_id is null or char_length(btrim(listing_id)) between 1 and 256),
  constraint product_offers_listing_url_check
    check (char_length(btrim(listing_url)) between 1 and 2048),
  constraint product_offers_price_amount_check
    check (price_amount is null or price_amount >= 0),
  constraint product_offers_currency_code_check
    check (currency_code ~ '^[A-Z]{3}$'),
  constraint product_offers_availability_state_check
    check (availability_state in ('unknown', 'in_stock', 'out_of_stock', 'discontinued')),
  constraint product_offers_market_code_check
    check (char_length(btrim(market_code)) between 1 and 32),
  constraint product_offers_locale_check
    check (locale is null or char_length(btrim(locale)) between 1 and 32),
  constraint product_offers_offer_state_check
    check (offer_state in ('current', 'retired')),
  constraint product_offers_product_scope_state_check
    check (product_scope_state in ('product', 'product_subject_unresolved')),
  constraint product_offers_observed_range_check
    check (
      first_observed_at is null
      or last_observed_at is null
      or first_observed_at <= last_observed_at
    )
);

create unique index if not exists product_offers_seller_listing_id_key
  on public.product_offers(seller_key, listing_id)
  where listing_id is not null;

create unique index if not exists product_offers_seller_listing_url_key
  on public.product_offers(seller_key, listing_url);

create index if not exists product_offers_product_id_idx
  on public.product_offers(product_id);

create index if not exists product_offers_current_product_seller_idx
  on public.product_offers(product_id, seller_key)
  where offer_state = 'current';

alter table public.product_offers enable row level security;
revoke all on table public.product_offers from public, anon, authenticated, service_role;
grant select, insert, update on table public.product_offers to service_role;

comment on table public.product_offers is
  'Internal current seller/listing state for a Bejewely product. Product identity and official product facts remain separate, and legacy products.price_min/price_max/buy_link are not backfilled by this migration.';
comment on column public.product_offers.source_name is
  'Where Bejewely observed the offer. This is deliberately separate from seller_key because the observation source and seller can differ.';
comment on column public.product_offers.availability_state is
  'unknown means availability was not established and must not be treated as in_stock.';
comment on column public.product_offers.product_scope_state is
  'product means product-level scope is verified; product_subject_unresolved means formulation/variant scope is not yet bound to a Product Fact subject.';
comment on column public.product_offers.offer_state is
  'current rows participate in active offer reads. Retired rows are preserved rather than deleted; this table is not a full price-history ledger.';

commit;
