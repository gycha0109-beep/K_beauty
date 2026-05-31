begin;

-- Anonymous Supabase Auth users are still mapped to the authenticated role.
-- Keep owner-scoped access for permanent users only.

drop policy if exists "profiles_authenticated_select_own" on public.profiles;
drop policy if exists "profiles_authenticated_insert_own" on public.profiles;
drop policy if exists "profiles_authenticated_update_own" on public.profiles;
drop policy if exists "Users can read own profiles" on public.profiles;
drop policy if exists "Users can insert own profiles" on public.profiles;
drop policy if exists "Users can update own profiles" on public.profiles;

create policy "Users can read own profiles"
  on public.profiles
  for select
  to authenticated
  using (
    auth.uid() = id
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

create policy "Users can insert own profiles"
  on public.profiles
  for insert
  to authenticated
  with check (
    auth.uid() = id
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

create policy "Users can update own profiles"
  on public.profiles
  for update
  to authenticated
  using (
    auth.uid() = id
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  )
  with check (
    auth.uid() = id
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

drop policy if exists "skin_profiles_authenticated_select_own" on public.skin_profiles;
drop policy if exists "skin_profiles_authenticated_insert_own" on public.skin_profiles;
drop policy if exists "skin_profiles_authenticated_update_own" on public.skin_profiles;
drop policy if exists "skin_profiles_authenticated_delete_own" on public.skin_profiles;
drop policy if exists "Users can read own skin profiles" on public.skin_profiles;
drop policy if exists "Users can insert own skin profiles" on public.skin_profiles;
drop policy if exists "Users can update own skin profiles" on public.skin_profiles;
drop policy if exists "Users can delete own skin profiles" on public.skin_profiles;

create policy "Users can read own skin profiles"
  on public.skin_profiles
  for select
  to authenticated
  using (
    auth.uid() = user_id
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

create policy "Users can insert own skin profiles"
  on public.skin_profiles
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

create policy "Users can update own skin profiles"
  on public.skin_profiles
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

create policy "Users can delete own skin profiles"
  on public.skin_profiles
  for delete
  to authenticated
  using (
    auth.uid() = user_id
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

drop policy if exists "saved_reports_authenticated_select_own" on public.saved_reports;
drop policy if exists "saved_reports_authenticated_insert_own" on public.saved_reports;
drop policy if exists "saved_reports_authenticated_update_own" on public.saved_reports;
drop policy if exists "saved_reports_authenticated_delete_own" on public.saved_reports;
drop policy if exists "Users can read own saved reports" on public.saved_reports;
drop policy if exists "Users can insert own saved reports" on public.saved_reports;
drop policy if exists "Users can update own saved reports" on public.saved_reports;
drop policy if exists "Users can delete own saved reports" on public.saved_reports;

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

drop policy if exists "daily_checkins_authenticated_select_own" on public.daily_checkins;
drop policy if exists "daily_checkins_authenticated_insert_own" on public.daily_checkins;
drop policy if exists "daily_checkins_authenticated_update_own" on public.daily_checkins;
drop policy if exists "daily_checkins_authenticated_delete_own" on public.daily_checkins;
drop policy if exists "Users can read own daily checkins" on public.daily_checkins;
drop policy if exists "Users can insert own daily checkins" on public.daily_checkins;
drop policy if exists "Users can update own daily checkins" on public.daily_checkins;
drop policy if exists "Users can delete own daily checkins" on public.daily_checkins;

create policy "Users can read own daily checkins"
  on public.daily_checkins
  for select
  to authenticated
  using (
    auth.uid() = user_id
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

create policy "Users can insert own daily checkins"
  on public.daily_checkins
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

create policy "Users can update own daily checkins"
  on public.daily_checkins
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

create policy "Users can delete own daily checkins"
  on public.daily_checkins
  for delete
  to authenticated
  using (
    auth.uid() = user_id
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

drop policy if exists "routine_logs_authenticated_select_own" on public.routine_logs;
drop policy if exists "routine_logs_authenticated_insert_own" on public.routine_logs;
drop policy if exists "routine_logs_authenticated_update_own" on public.routine_logs;
drop policy if exists "routine_logs_authenticated_delete_own" on public.routine_logs;
drop policy if exists "Users can read own routine logs" on public.routine_logs;
drop policy if exists "Users can insert own routine logs" on public.routine_logs;
drop policy if exists "Users can update own routine logs" on public.routine_logs;
drop policy if exists "Users can delete own routine logs" on public.routine_logs;

create policy "Users can read own routine logs"
  on public.routine_logs
  for select
  to authenticated
  using (
    auth.uid() = user_id
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

create policy "Users can insert own routine logs"
  on public.routine_logs
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

create policy "Users can update own routine logs"
  on public.routine_logs
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

create policy "Users can delete own routine logs"
  on public.routine_logs
  for delete
  to authenticated
  using (
    auth.uid() = user_id
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

commit;
