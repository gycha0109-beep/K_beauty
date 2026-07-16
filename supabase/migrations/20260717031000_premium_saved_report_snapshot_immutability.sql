create unique index if not exists saved_reports_premium_session_owner_uidx
on public.saved_reports (user_id, report_type, source_type, source_session_id)
where report_type = 'premium'
  and source_type = 'premium_report_session'
  and source_session_id is not null;

drop policy if exists "Users can update own saved reports" on public.saved_reports;

create