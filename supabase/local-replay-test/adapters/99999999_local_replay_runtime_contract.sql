-- LOCAL-ONLY REPLAY ADAPTER.
--
-- Apply only after the tracked migration chain. It restores the current
-- runtime read boundary that is present in the hosted schema but is not
-- represented by a tracked production migration.

begin;

create unique index products_external_unique
  on public.products (external_source, external_type, external_id)
  where external_source is not null
    and external_type is not null
    and external_id is not null;

alter table public.products enable row level security;
revoke all on table public.products from public, anon, authenticated;
grant select on table public.products to anon, authenticated;
grant all on table public.products to service_role;

drop policy if exists "Public can read products" on public.products;
create policy "Public can read products"
  on public.products
  for select
  to anon, authenticated
  using (true);

commit;
