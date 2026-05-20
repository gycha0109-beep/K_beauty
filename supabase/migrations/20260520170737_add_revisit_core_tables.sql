begin;

create extension if not exists pgcrypto;

-- Revisit-only updated_at trigger function.
create or replace function public.set_revisit_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text,
  avatar_url text,
  provider text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.skin_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  skin_type text,
  concerns text[],
  sensitivity_level text,
  skin_summary text,
  face_summary text,
  preferences jsonb,
  photo_analysis jsonb,
  survey_snapshot jsonb,
  result_snapshot jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saved_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  skin_profile_id uuid references public.skin_profiles(id) on delete set null,
  report_type text not null constraint saved_reports_report_type_check check (report_type in ('free', 'premium')),
  source_type text constraint saved_reports_source_type_check check (source_type in ('session', 'premium_report_session', 'share', 'manual')),
  source_session_id text,
  title text,
  report_version text,
  free_result jsonb,
  premium_report jsonb,
  face_lab jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  skin_profile_id uuid references public.skin_profiles(id) on delete set null,
  checkin_date date not null default current_date,
  dryness_level int not null default 0 constraint daily_checkins_dryness_level_check check (dryness_level between 0 and 4),
  oiliness_level int not null default 0 constraint daily_checkins_oiliness_level_check check (oiliness_level between 0 and 4),
  redness_level int not null default 0 constraint daily_checkins_redness_level_check check (redness_level between 0 and 4),
  breakout_level int not null default 0 constraint daily_checkins_breakout_level_check check (breakout_level between 0 and 4),
  irritation_level int not null default 0 constraint daily_checkins_irritation_level_check check (irritation_level between 0 and 4),
  makeup_today boolean not null default false,
  outdoor_today boolean not null default false,
  memo text,
  context jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_checkins_user_id_checkin_date_key unique (user_id, checkin_date)
);

create table if not exists public.routine_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  skin_profile_id uuid references public.skin_profiles(id) on delete set null,
  daily_checkin_id uuid references public.daily_checkins(id) on delete set null,
  routine_date date not null default current_date,
  am_routine jsonb,
  pm_routine jsonb,
  keep_items text[],
  reduce_items text[],
  avoid_items text[],
  warnings jsonb,
  generation_source text not null default 'rule' constraint routine_logs_generation_source_check check (generation_source in ('rule', 'llm', 'hybrid')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint routine_logs_user_id_routine_date_key unique (user_id, routine_date)
);

create index if not exists idx_skin_profiles_user_id_created_at
  on public.skin_profiles (user_id, created_at desc);

create index if not exists idx_skin_profiles_user_id_active
  on public.skin_profiles (user_id, is_active);

create unique index if not exists idx_skin_profiles_single_active
  on public.skin_profiles (user_id)
  where is_active = true;

create index if not exists idx_saved_reports_user_id_created_at
  on public.saved_reports (user_id, created_at desc);

create index if not exists idx_saved_reports_skin_profile_id
  on public.saved_reports (skin_profile_id);

create index if not exists idx_daily_checkins_user_id_date
  on public.daily_checkins (user_id, checkin_date desc);

create index if not exists idx_routine_logs_user_id_date
  on public.routine_logs (user_id, routine_date desc);

create index if not exists idx_routine_logs_daily_checkin_id
  on public.routine_logs (daily_checkin_id);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_revisit_updated_at();

drop trigger if exists skin_profiles_set_updated_at on public.skin_profiles;
create trigger skin_profiles_set_updated_at
  before update on public.skin_profiles
  for each row
  execute function public.set_revisit_updated_at();

drop trigger if exists saved_reports_set_updated_at on public.saved_reports;
create trigger saved_reports_set_updated_at
  before update on public.saved_reports
  for each row
  execute function public.set_revisit_updated_at();

drop trigger if exists daily_checkins_set_updated_at on public.daily_checkins;
create trigger daily_checkins_set_updated_at
  before update on public.daily_checkins
  for each row
  execute function public.set_revisit_updated_at();

drop trigger if exists routine_logs_set_updated_at on public.routine_logs;
create trigger routine_logs_set_updated_at
  before update on public.routine_logs
  for each row
  execute function public.set_revisit_updated_at();

alter table public.profiles enable row level security;
alter table public.skin_profiles enable row level security;
alter table public.saved_reports enable row level security;
alter table public.daily_checkins enable row level security;
alter table public.routine_logs enable row level security;

drop policy if exists "profiles_authenticated_select_own" on public.profiles;
drop policy if exists "profiles_authenticated_insert_own" on public.profiles;
drop policy if exists "profiles_authenticated_update_own" on public.profiles;

create policy "profiles_authenticated_select_own"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

create policy "profiles_authenticated_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

create policy "profiles_authenticated_update_own"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "skin_profiles_authenticated_select_own" on public.skin_profiles;
drop policy if exists "skin_profiles_authenticated_insert_own" on public.skin_profiles;
drop policy if exists "skin_profiles_authenticated_update_own" on public.skin_profiles;
drop policy if exists "skin_profiles_authenticated_delete_own" on public.skin_profiles;

create policy "skin_profiles_authenticated_select_own"
  on public.skin_profiles
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "skin_profiles_authenticated_insert_own"
  on public.skin_profiles
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "skin_profiles_authenticated_update_own"
  on public.skin_profiles
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "skin_profiles_authenticated_delete_own"
  on public.skin_profiles
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "saved_reports_authenticated_select_own" on public.saved_reports;
drop policy if exists "saved_reports_authenticated_insert_own" on public.saved_reports;
drop policy if exists "saved_reports_authenticated_update_own" on public.saved_reports;
drop policy if exists "saved_reports_authenticated_delete_own" on public.saved_reports;

create policy "saved_reports_authenticated_select_own"
  on public.saved_reports
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "saved_reports_authenticated_insert_own"
  on public.saved_reports
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "saved_reports_authenticated_update_own"
  on public.saved_reports
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "saved_reports_authenticated_delete_own"
  on public.saved_reports
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "daily_checkins_authenticated_select_own" on public.daily_checkins;
drop policy if exists "daily_checkins_authenticated_insert_own" on public.daily_checkins;
drop policy if exists "daily_checkins_authenticated_update_own" on public.daily_checkins;
drop policy if exists "daily_checkins_authenticated_delete_own" on public.daily_checkins;

create policy "daily_checkins_authenticated_select_own"
  on public.daily_checkins
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "daily_checkins_authenticated_insert_own"
  on public.daily_checkins
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "daily_checkins_authenticated_update_own"
  on public.daily_checkins
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "daily_checkins_authenticated_delete_own"
  on public.daily_checkins
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "routine_logs_authenticated_select_own" on public.routine_logs;
drop policy if exists "routine_logs_authenticated_insert_own" on public.routine_logs;
drop policy if exists "routine_logs_authenticated_update_own" on public.routine_logs;
drop policy if exists "routine_logs_authenticated_delete_own" on public.routine_logs;

create policy "routine_logs_authenticated_select_own"
  on public.routine_logs
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "routine_logs_authenticated_insert_own"
  on public.routine_logs
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "routine_logs_authenticated_update_own"
  on public.routine_logs
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "routine_logs_authenticated_delete_own"
  on public.routine_logs
  for delete
  to authenticated
  using (auth.uid() = user_id);

revoke all on table public.profiles from anon;
revoke all on table public.skin_profiles from anon;
revoke all on table public.saved_reports from anon;
revoke all on table public.daily_checkins from anon;
revoke all on table public.routine_logs from anon;

grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.skin_profiles to authenticated;
grant select, insert, update, delete on table public.saved_reports to authenticated;
grant select, insert, update, delete on table public.daily_checkins to authenticated;
grant select, insert, update, delete on table public.routine_logs to authenticated;

commit;
