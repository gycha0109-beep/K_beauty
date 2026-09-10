begin;

create table if not exists public.product_source_bindings (
  binding_id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  source_name text not null,
  external_type text not null,
  external_id text not null,
  source_url text,
  market_code text,
  locale text,
  binding_state text not null default 'resolved',
  binding_method text not null default 'legacy_product_external_key',
  product_scope_state text not null default 'product_subject_unresolved',
  first_observed_at timestamptz,
  last_observed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_source_bindings_source_name_check
    check (char_length(btrim(source_name)) between 1 and 64),
  constraint product_source_bindings_external_type_check
    check (char_length(btrim(external_type)) between 1 and 80),
  constraint product_source_bindings_external_id_check
    check (char_length(btrim(external_id)) between 1 and 256),
  constraint product_source_bindings_source_url_check
    check (source_url is null or char_length(source_url) <= 2048),
  constraint product_source_bindings_market_code_check
    check (market_code is null or char_length(btrim(market_code)) between 1 and 32),
  constraint product_source_bindings_locale_check
    check (locale is null or char_length(btrim(locale)) between 1 and 32),
  constraint product_source_bindings_state_check
    check (binding_state in ('resolved', 'retired')),
  constraint product_source_bindings_method_check
    check (char_length(btrim(binding_method)) between 3 and 80),
  constraint product_source_bindings_scope_check
    check (product_scope_state in ('product', 'product_subject_unresolved')),
  constraint product_source_bindings_observed_range_check
    check (
      first_observed_at is null
      or last_observed_at is null
      or first_observed_at <= last_observed_at
    )
);

create unique index if not exists product_source_bindings_resolved_source_identity_key
  on public.product_source_bindings(source_name, external_type, external_id)
  where binding_state = 'resolved';

create index if not exists product_source_bindings_product_id_idx
  on public.product_source_bindings(product_id);

create index if not exists product_source_bindings_product_source_idx
  on public.product_source_bindings(product_id, source_name)
  where binding_state = 'resolved';

alter table public.product_source_bindings enable row level security;
revoke all on table public.product_source_bindings from public, anon, authenticated, service_role;
grant select, insert, update on table public.product_source_bindings to service_role;

insert into public.product_source_bindings(
  product_id,
  source_name,
  external_type,
  external_id,
  source_url,
  binding_state,
  binding_method,
  product_scope_state
)
select
  p.id,
  btrim(p.external_source),
  btrim(p.external_type),
  btrim(p.external_id),
  nullif(btrim(coalesce(p.source_url, '')), ''),
  'resolved',
  'legacy_product_external_key',
  'product_subject_unresolved'
from public.products p
where nullif(btrim(coalesce(p.external_source, '')), '') is not null
  and nullif(btrim(coalesce(p.external_type, '')), '') is not null
  and nullif(btrim(coalesce(p.external_id, '')), '') is not null
on conflict (source_name, external_type, external_id)
  where binding_state = 'resolved'
do nothing;

comment on table public.product_source_bindings is
  'Internal product-to-source identity bindings. Allows one Bejewely product to keep multiple external source identifiers without treating seller/price data as product identity.';
comment on column public.product_source_bindings.product_scope_state is
  'product means the source identity is verified at product scope; product_subject_unresolved means formulation/variant scope has not yet been bound to Product Fact subjects.';
comment on column public.product_source_bindings.binding_state is
  'Only resolved rows participate in source identity matching. Retired rows remain as history and do not claim an active source identity.';
comment on column public.product_source_bindings.binding_method is
  'Records how the binding was admitted. Initial backfill uses legacy_product_external_key.';

commit;
