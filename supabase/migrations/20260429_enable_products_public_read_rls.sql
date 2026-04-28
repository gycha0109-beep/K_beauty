begin;

alter table public.products enable row level security;

drop policy if exists "products_public_read" on public.products;

create policy "products_public_read"
  on public.products
  for select
  to anon, authenticated
  using (true);

grant select on table public.products to anon, authenticated;

commit;
