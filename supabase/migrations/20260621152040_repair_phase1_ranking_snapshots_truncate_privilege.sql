begin;

revoke truncate on table public.ranking_snapshots from anon, authenticated;

do $$
begin
  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'ranking_snapshots'
      and grantee in ('anon', 'authenticated')
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
  ) then
    raise exception using
      errcode = '42501',
      message = 'phase1_repair_ranking_snapshots_public_write_privilege_remains';
  end if;
end $$;

commit;
