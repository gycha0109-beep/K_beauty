do $roles$ begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin;end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin;end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin;end if;
end $roles$;
create table public.products(id uuid primary key);
create table public.catalog_trust_intake(id uuid primary key,product_id uuid references public.products(id));
grant usage on schema public to service_role;
grant select on public.products,public.catalog_trust_intake to service_role;
