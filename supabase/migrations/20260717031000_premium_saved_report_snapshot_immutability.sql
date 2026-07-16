create unique index if not exists saved_reports_premium_session_owner_uidx
on public.saved_reports (user_id, report_type, source_type, source_session_id)
where report_type = 'premium'
  and source_type = 'premium_report_session'
  and source_session_id is not null;

drop policy if exists "Users can update own saved reports" on public.saved_reports;

create policy "Users can update own mutable saved reports"
on public.saved_reports
for update
to authenticated
using (
  auth.uid() = user_id
  and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  and source_type is distinct from 'premium_report_session'
)
with check (
  auth.uid() = user_id
  and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  and source_type is distinct from 'premium_report_session'
);
