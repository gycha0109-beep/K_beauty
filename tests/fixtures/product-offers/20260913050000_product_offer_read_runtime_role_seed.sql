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
