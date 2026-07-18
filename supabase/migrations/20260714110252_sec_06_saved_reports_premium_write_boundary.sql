begin;

alter table public.saved_reports enable row level security;

drop policy if exists "saved_reports_authenticated_insert_own" on public.saved_reports;
drop policy if exists "saved_reports_authenticated_update_own" on public.saved_reports;
drop policy if exists "Users can insert own saved reports" on public.saved_reports;
drop policy if exists "Users can update own saved reports" on public.saved_reports;
drop policy if exists "Users can insert own free saved reports" on public.saved_reports;
drop policy if exists "Users can update own free saved report titles" on public.saved_reports;

create policy "Users can insert own free saved reports"
  on public.saved_reports
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and report_type = 'free'
    and premium_report is null
    and jsonb_typeof(free_result) = 'object'
    and not (free_result ? 'premiumReport')
    and not (free_result ? 'premium_report')
    and source_type = 'share'
    and source_session_id is not null
    and btrim(source_session_id) <> ''
  );

create policy "Users can update own free saved report titles"
  on public.saved_reports
  for update
  to authenticated
  using (
    (select auth.uid()) = user_id
    and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and report_type = 'free'
    and premium_report is null
  )
  with check (
    (select auth.uid()) = user_id
    and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and report_type = 'free'
    and premium_report is null
  );

revoke all on table public.saved_reports from anon;
revoke all on table public.saved_reports from authenticated;

grant select, insert, delete on table public.saved_reports to authenticated;
grant update (title) on table public.saved_reports to authenticated;

grant select, insert, update, delete on table public.saved_reports to service_role;

commit;
