begin;

do $$
begin
  if not exists (
    select 1 from pg_roles where rolname = 'recommendation_admission_runtime'
  ) then
    create role recommendation_admission_runtime
      nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  end if;
end
$$;

grant recommendation_admission_runtime to postgres;

create table if not exists public.products (
  id uuid primary key
);

commit;
