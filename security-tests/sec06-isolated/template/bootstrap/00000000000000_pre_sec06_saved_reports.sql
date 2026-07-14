-- SEC-06 isolated local verification only.
-- This is a minimal pre-SEC-06 saved_reports contract, not a production
-- historical replay. It must never be applied to a hosted database.

begin;

create extension if not exists pgcrypto;
create extension if not exists pgtap with schema extensions;

create table public.saved_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  skin_profile_id uuid,
  report_type text not null check (report_type in ('free', 'premium')),
  source_type text check (source_type in ('session', 'premium_report_session', 'share', 'manual')),
  source_session_id text,
  title text,
  report_version text,
  free_result jsonb,
  premium_report jsonb,
  face_lab jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.saved_reports enable row level security;

create policy "Users can read own saved reports"
  on public.saved_reports
  for select
  to authenticated
  using (
    auth.uid() = user_id
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

create policy "Users can insert own saved reports"
  on public.saved_reports
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

create policy "Users can update own saved reports"
  on public.saved_reports
  for update
  to authenticated
  using (
    auth.uid() = user_id
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  )
  with check (
    auth.uid() = user_id
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

create policy "Users can delete own saved reports"
  on public.saved_reports
  for delete
  to authenticated
  using (
    auth.uid() = user_id
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

revoke all on table public.saved_reports from anon;
grant select, insert, update, delete on table public.saved_reports to authenticated;
grant select, insert, update, delete on table public.saved_reports to service_role;

commit;
