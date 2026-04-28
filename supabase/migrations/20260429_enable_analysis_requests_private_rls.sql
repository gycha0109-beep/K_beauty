begin;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'analysis_requests'
      and column_name = 'user_id'
  ) then
    raise exception 'public.analysis_requests.user_id is required before enabling RLS policies';
  end if;
end
$$;

alter table public.analysis_requests enable row level security;

drop policy if exists "analysis_requests_authenticated_insert_own" on public.analysis_requests;
drop policy if exists "analysis_requests_authenticated_select_own" on public.analysis_requests;

create policy "analysis_requests_authenticated_insert_own"
  on public.analysis_requests
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "analysis_requests_authenticated_select_own"
  on public.analysis_requests
  for select
  to authenticated
  using (user_id = auth.uid());

revoke all on table public.analysis_requests from anon;
revoke update, delete on table public.analysis_requests from authenticated;
grant select, insert on table public.analysis_requests to authenticated;

commit;
