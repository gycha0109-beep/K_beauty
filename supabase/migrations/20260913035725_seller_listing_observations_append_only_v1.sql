begin;

create table if not exists public.seller_listing_observations (
  observation_id uuid primary key default gen_random_uuid(),
  seller text not null,
  listing_id text,
  listing_url text not null,
  price_amount numeric(14,2),
  price_currency text,
  availability text not null,
  observed_at timestamptz not null,
  source_version text not null,
  created_at timestamptz not null default now(),
  constraint seller_listing_observations_seller_check
    check (seller = btrim(seller) and char_length(seller) between 1 and 80),
  constraint seller_listing_observations_listing_id_check
    check (
      listing_id is null
      or (listing_id = btrim(listing_id) and char_length(listing_id) between 1 and 256)
    ),
  constraint seller_listing_observations_listing_url_check
    check (
      listing_url = btrim(listing_url)
      and char_length(listing_url) between 1 and 2048
      and listing_url ~ '^https://[^[:space:]#]+$'
    ),
  constraint seller_listing_observations_price_amount_check
    check (price_amount is null or price_amount >= 0),
  constraint seller_listing_observations_price_currency_check
    check (price_currency is null or price_currency ~ '^[A-Z]{3}$'),
  constraint seller_listing_observations_price_pair_check
    check ((price_amount is null) = (price_currency is null)),
  constraint seller_listing_observations_availability_check
    check (availability in ('unknown', 'in_stock', 'out_of_stock', 'discontinued')),
  constraint seller_listing_observations_source_version_check
    check (
      source_version = btrim(source_version)
      and char_length(source_version) between 1 and 128
    )
);

create index if not exists seller_listing_observations_seller_observed_at_idx
  on public.seller_listing_observations(seller, observed_at desc);

create index if not exists seller_listing_observations_seller_listing_id_observed_at_idx
  on public.seller_listing_observations(seller, listing_id, observed_at desc)
  where listing_id is not null;

create or replace function public.reject_seller_listing_observation_mutation_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'seller_listing_observations_append_only'
    using errcode = '55000';
end;
$$;

revoke all on function public.reject_seller_listing_observation_mutation_v1() from public, anon, authenticated, service_role;

drop trigger if exists seller_listing_observations_immutable_v1 on public.seller_listing_observations;
create trigger seller_listing_observations_immutable_v1
before update or delete on public.seller_listing_observations
for each row execute function public.reject_seller_listing_observation_mutation_v1();

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.seller_listing_observations'::regclass
      and tgname = 'seller_listing_observations_immutable_v1'
      and not tgisinternal
  ) then
    raise exception 'seller_listing_observations_immutable_trigger_missing';
  end if;
end;
$$;

alter table public.seller_listing_observations enable row level security;
revoke all on table public.seller_listing_observations from public, anon, authenticated, service_role;
grant select, insert on table public.seller_listing_observations to service_role;

comment on table public.seller_listing_observations is
  'Append-only raw seller listing observations. Rows intentionally contain no Product, Product Fact Subject, or Offer identity binding and may repeat the same seller/listing/time when independently observed.';
comment on column public.seller_listing_observations.observed_at is
  'Time represented by the seller_listing_observation_v1 source observation, not database ingestion time.';
comment on column public.seller_listing_observations.created_at is
  'Database ingestion timestamp. It must not replace observed_at as observation provenance.';
comment on column public.seller_listing_observations.source_version is
  'Collector/parser provenance version supplied by seller_listing_observation_v1.';

commit;
