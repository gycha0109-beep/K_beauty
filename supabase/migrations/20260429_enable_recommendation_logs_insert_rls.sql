begin;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'recommendation_logs'
      and column_name = 'user_id'
  ) then
    raise exception 'public.recommendation_logs.user_id is required before enabling RLS insert policy';
  end if;
end
$$;

alter table public.recommendation_logs enable row level security;

drop policy if exists "recommendation_logs_authenticated_insert" on public.recommendation_logs;

create policy "recommendation_logs_authenticated_insert"
  on public.recommendation_logs
  for insert
  to authenticated
  with check (user_id = auth.uid());

revoke select, update, delete on table public.recommendation_logs from anon, authenticated;
grant insert on table public.recommendation_logs to authenticated;

commit;
