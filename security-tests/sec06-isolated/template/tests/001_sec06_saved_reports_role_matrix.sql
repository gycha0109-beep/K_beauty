begin;

set search_path = public, extensions;
select plan(56);

select ok((select relrowsecurity from pg_class where oid = 'public.saved_reports'::regclass), 'S01 saved_reports RLS enabled');
select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'saved_reports' and policyname = 'Users can insert own free saved reports'), 'S02 free-only INSERT policy exists');
select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'saved_reports' and policyname = 'Users can update own free saved report titles'), 'S03 free-only UPDATE policy exists');
select ok(not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'saved_reports' and policyname = 'Users can insert own saved reports'), 'S04 broad INSERT policy removed');
select ok(not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'saved_reports' and policyname = 'Users can update own saved reports'), 'S05 broad UPDATE policy removed');
select ok(not has_table_privilege('anon', 'public.saved_reports', 'SELECT') and not has_table_privilege('anon', 'public.saved_reports', 'INSERT') and not has_table_privilege('anon', 'public.saved_reports', 'UPDATE') and not has_table_privilege('anon', 'public.saved_reports', 'DELETE'), 'S06 anon has no saved_reports table privileges');
select ok(has_table_privilege('authenticated', 'public.saved_reports', 'SELECT'), 'S07 authenticated SELECT granted');
select ok(has_table_privilege('authenticated', 'public.saved_reports', 'INSERT'), 'S08 authenticated INSERT granted');
select ok(has_table_privilege('authenticated', 'public.saved_reports', 'DELETE'), 'S09 authenticated DELETE granted');
select ok(not has_table_privilege('authenticated', 'public.saved_reports', 'UPDATE'), 'S10 authenticated table UPDATE revoked');
select ok(has_column_privilege('authenticated', 'public.saved_reports', 'title', 'UPDATE'), 'S11 authenticated title UPDATE granted');
select ok(not has_column_privilege('authenticated', 'public.saved_reports', 'report_type', 'UPDATE'), 'S12 authenticated report_type UPDATE denied');
select ok(not has_column_privilege('authenticated', 'public.saved_reports', 'premium_report', 'UPDATE'), 'S13 authenticated premium_report UPDATE denied');
select ok(not has_column_privilege('authenticated', 'public.saved_reports', 'source_type', 'UPDATE'), 'S14 authenticated provenance UPDATE denied');
select ok(has_table_privilege('service_role', 'public.saved_reports', 'SELECT, INSERT, UPDATE, DELETE'), 'S15 service_role authoritative CRUD granted');

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","is_anonymous":false}', true);

select lives_ok($sql$
  insert into public.saved_reports (id, user_id, report_type, source_type, source_session_id, title, report_version, free_result, premium_report)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '11111111-1111-1111-1111-111111111111', 'free', 'share', 'share-owner-free', 'Free report', 'free-v1', '{"summary":"ok"}', null)
$sql$, 'R01 permanent owner can insert a valid free share report');
select is((select count(*)::bigint from public.saved_reports where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1' and report_type = 'free' and premium_report is null and source_type = 'share' and source_session_id = 'share-owner-free'), 1::bigint, 'R02 valid free row keeps exact contract');
select throws_ok($sql$insert into public.saved_reports (user_id, report_type, source_type, source_session_id, free_result) values ('11111111-1111-1111-1111-111111111111', 'premium', 'premium_report_session', 'forged-premium', null)$sql$, '42501', NULL, 'R03 direct premium INSERT denied');
select throws_ok($sql$insert into public.saved_reports (user_id, report_type, source_type, source_session_id, free_result, premium_report) values ('11111111-1111-1111-1111-111111111111', 'free', 'share', 'share-premium', '{"summary":"ok"}', '{"paid":true}')$sql$, '42501', NULL, 'R04 premium_report INSERT denied');
select throws_ok($sql$insert into public.saved_reports (user_id, report_type, source_type, source_session_id, free_result) values ('11111111-1111-1111-1111-111111111111', 'free', 'share', 'share-alias-camel', '{"premiumReport":{"paid":true}}')$sql$, '42501', NULL, 'R05 camel premium alias denied');
select throws_ok($sql$insert into public.saved_reports (user_id, report_type, source_type, source_session_id, free_result) values ('11111111-1111-1111-1111-111111111111', 'free', 'share', 'share-alias-snake', '{"premium_report":{"paid":true}}')$sql$, '42501', NULL, 'R06 snake premium alias denied');
select throws_ok($sql$insert into public.saved_reports (user_id, report_type, source_type, source_session_id, free_result) values ('11111111-1111-1111-1111-111111111111', 'free', 'manual', 'manual-forged', '{"summary":"ok"}')$sql$, '42501', NULL, 'R07 non-share provenance denied');
select throws_ok($sql$insert into public.saved_reports (user_id, report_type, source_type, source_session_id, free_result) values ('11111111-1111-1111-1111-111111111111', 'free', 'share', '   ', '{"summary":"ok"}')$sql$, '42501', NULL, 'R08 blank source_session_id denied');
select throws_ok($sql$insert into public.saved_reports (user_id, report_type, source_type, source_session_id, free_result) values ('11111111-1111-1111-1111-111111111111', 'free', 'share', 'share-null', null)$sql$, '42501', NULL, 'R09 null free_result denied');
select throws_ok($sql$insert into public.saved_reports (user_id, report_type, source_type, source_session_id, free_result) values ('11111111-1111-1111-1111-111111111111', 'free', 'share', 'share-array', '[]')$sql$, '42501', NULL, 'R10 non-object free_result denied');
select lives_ok($sql$update public.saved_reports set title = 'Renamed free report' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'$sql$, 'R11 owner can update free title');
select is((select title from public.saved_reports where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'), 'Renamed free report', 'R12 free title update persisted');
select throws_ok($sql$update public.saved_reports set report_type = 'premium' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'$sql$, '42501', NULL, 'R13 free to premium UPDATE denied');
select throws_ok($sql$update public.saved_reports set premium_report = '{"paid":true}' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'$sql$, '42501', NULL, 'R14 adding premium_report denied');
select throws_ok($sql$update public.saved_reports set source_type = 'premium_report_session' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'$sql$, '42501', NULL, 'R15 source_type UPDATE denied');
select throws_ok($sql$update public.saved_reports set source_session_id = 'forged' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'$sql$, '42501', NULL, 'R16 source_session_id UPDATE denied');
select throws_ok($sql$update public.saved_reports set user_id = '22222222-2222-2222-2222-222222222222' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'$sql$, '42501', NULL, 'R17 owner linkage UPDATE denied');
select throws_ok($sql$update public.saved_reports set skin_profile_id = '33333333-3333-3333-3333-333333333333' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'$sql$, '42501', NULL, 'R18 profile linkage UPDATE denied');
select throws_ok($sql$update public.saved_reports set free_result = '{"summary":"changed"}' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'$sql$, '42501', NULL, 'R19 free payload UPDATE denied');
select throws_ok($sql$update public.saved_reports set report_version = 'forged' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'$sql$, '42501', NULL, 'R20 report version UPDATE denied');
select throws_ok($sql$update public.saved_reports set face_lab = '{"forged":true}' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'$sql$, '42501', NULL, 'R21 face payload UPDATE denied');

reset role;
set local role service_role;
select lives_ok($sql$
  insert into public.saved_reports (id, user_id, report_type, source_type, source_session_id, title, report_version, free_result, premium_report)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', '11111111-1111-1111-1111-111111111111', 'premium', 'premium_report_session', 'server-session-1', 'Premium report', 'premium-v1', null, '{"authoritative":true}')
$sql$, 'R22 service_role can insert authoritative premium row');
select lives_ok($sql$update public.saved_reports set premium_report = '{"authoritative":true,"revision":2}' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'$sql$, 'R23 service_role can update authoritative premium row');
select is((select premium_report ->> 'revision' from public.saved_reports where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'), '2', 'R24 service_role premium update persisted');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","is_anonymous":false}', true);
select is((select count(*)::bigint from public.saved_reports), 2::bigint, 'R25 owner can reopen own free and premium rows');
with changed as (
  update public.saved_reports
  set title = 'Forged premium title'
  where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'
  returning 1
)
select set_config('sec06.r26_affected_count', count(*)::text, true) from changed;
select is(current_setting('sec06.r26_affected_count')::bigint, 0::bigint, 'R26 owner cannot update an existing premium row');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","is_anonymous":false}', true);
select is((select count(*)::bigint from public.saved_reports), 0::bigint, 'R27 non-owner cannot read owner rows');
select throws_ok($sql$insert into public.saved_reports (user_id, report_type, source_type, source_session_id, free_result) values ('11111111-1111-1111-1111-111111111111', 'free', 'share', 'non-owner-forge', '{"summary":"ok"}')$sql$, '42501', NULL, 'R28 non-owner cannot insert for owner');
with changed as (
  update public.saved_reports
  set title = 'Non-owner title'
  where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'
  returning 1
)
select set_config('sec06.r29_affected_count', count(*)::text, true) from changed;
select is(current_setting('sec06.r29_affected_count')::bigint, 0::bigint, 'R29 non-owner cannot update owner title');
with removed as (
  delete from public.saved_reports
  where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'
  returning 1
)
select set_config('sec06.r30_affected_count', count(*)::text, true) from removed;
select is(current_setting('sec06.r30_affected_count')::bigint, 0::bigint, 'R30 non-owner cannot delete owner row');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated","is_anonymous":true}', true);
select is((select count(*)::bigint from public.saved_reports), 0::bigint, 'R31 anonymous Auth user cannot read rows');
select throws_ok($sql$insert into public.saved_reports (user_id, report_type, source_type, source_session_id, free_result) values ('33333333-3333-3333-3333-333333333333', 'free', 'share', 'anonymous-auth', '{"summary":"ok"}')$sql$, '42501', NULL, 'R32 anonymous Auth user cannot insert');
with changed as (
  update public.saved_reports
  set title = 'Anonymous title'
  where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'
  returning 1
)
select set_config('sec06.r33_affected_count', count(*)::text, true) from changed;
select is(current_setting('sec06.r33_affected_count')::bigint, 0::bigint, 'R33 anonymous Auth user cannot update');
with removed as (
  delete from public.saved_reports
  where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'
  returning 1
)
select set_config('sec06.r34_affected_count', count(*)::text, true) from removed;
select is(current_setting('sec06.r34_affected_count')::bigint, 0::bigint, 'R34 anonymous Auth user cannot delete');

reset role;
set local role anon;
select throws_ok($sql$select * from public.saved_reports$sql$, '42501', NULL, 'R35 anon SELECT denied by privilege');
select throws_ok($sql$insert into public.saved_reports (user_id, report_type, source_type, source_session_id, free_result) values ('44444444-4444-4444-4444-444444444444', 'free', 'share', 'anon', '{"summary":"ok"}')$sql$, '42501', NULL, 'R36 anon INSERT denied by privilege');
select throws_ok($sql$update public.saved_reports set title = 'Anon title' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'$sql$, '42501', NULL, 'R37 anon UPDATE denied by privilege');
select throws_ok($sql$delete from public.saved_reports where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'$sql$, '42501', NULL, 'R38 anon DELETE denied by privilege');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","is_anonymous":false}', true);
select lives_ok($sql$delete from public.saved_reports where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'$sql$, 'R39 owner can delete own premium row');
select lives_ok($sql$delete from public.saved_reports where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'$sql$, 'R40 owner can delete own free row');
select is((select count(*)::bigint from public.saved_reports), 0::bigint, 'R41 owner cleanup removed both rows');

reset role;
select * from finish();
rollback;
