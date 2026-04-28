begin;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'analysis_results'
      and column_name = 'user_id'
  ) then
    raise exception 'public.analysis_results.user_id is required before enabling RLS policies';
  end if;
end
$$;

alter table public.analysis_results enable row level security;

drop policy if exists "analysis_results_authenticated_insert_own" on public.analysis_results;
drop policy if exists "analysis_results_authenticated_select_own" on public.analysis_results;

create policy "analysis_results_authenticated_insert_own"
  on public.analysis_results
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "analysis_results_authenticated_select_own"
  on public.analysis_results
  for select
  to authenticated
  using (user_id = auth.uid());

revoke all on table public.analysis_results from anon;
revoke update, delete on table public.analysis_results from authenticated;
grant select, insert on table public.analysis_results to authenticated;

commit;
