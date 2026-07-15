create extension if not exists pgtap;

begin;
select plan(24);

select ok(
  pg_get_constraintdef(oid) like '%result-read%',
  'R01 endpoint constraint includes result-read'
) from pg_constraint where conname = 'analysis_request_rate_windows_endpoint_check';
select ok(pg_get_constraintdef(oid) like '%analyze%', 'R02 endpoint constraint preserves analyze')
  from pg_constraint where conname = 'analysis_request_rate_windows_endpoint_check';
select ok(pg_get_constraintdef(oid) like '%face-reading%', 'R03 endpoint constraint preserves face-reading')
  from pg_constraint where conname = 'analysis_request_rate_windows_endpoint_check';
select throws_ok($sql$insert into public.analysis_request_rate_windows(scope,subject_hash,endpoint,window_key,window_started_at,window_reset_at,request_count,expires_at) values ('ip',repeat('a',64),'invalid','bad',now(),now()+interval '1 minute',0,now()+interval '1 day')$sql$, '23514', NULL, 'R04 invalid endpoint is rejected');
select ok((select relrowsecurity from pg_class where oid='public.analysis_request_rate_windows'::regclass), 'R05 rate table RLS remains enabled');
select ok(not has_table_privilege('anon','public.analysis_request_rate_windows','select'), 'R06 anon table read denied');
select ok(not has_table_privilege('authenticated','public.analysis_request_rate_windows','select'), 'R07 authenticated table read denied');
select ok(has_table_privilege('service_role','public.analysis_request_rate_windows','select'), 'R08 service_role table access retained');
select ok(not has_function_privilege('anon','public.consume_analysis_rate_limits(jsonb)','execute'), 'R09 anon RPC denied');
select ok(not has_function_privilege('authenticated','public.consume_analysis_rate_limits(jsonb)','execute'), 'R10 authenticated RPC denied');
select ok(has_function_privilege('service_role','public.consume_analysis_rate_limits(jsonb)','execute'), 'R11 service_role RPC allowed');
select ok(not prosecdef, 'R12 RPC remains SECURITY INVOKER') from pg_proc where oid='public.consume_analysis_rate_limits(jsonb)'::regprocedure;
select ok(proconfig @> array['search_path=public'], 'R13 RPC search_path remains public') from pg_proc where oid='public.consume_analysis_rate_limits(jsonb)'::regprocedure;

set local role service_role;
select is(
  public.consume_analysis_rate_limits('[{"scope":"anonymous","subject_hash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","endpoint":"result-read","window_key":"tap-a","window_started_at":"2026-07-15T00:00:00Z","window_reset_at":"2026-07-15T00:01:00Z","request_limit":1},{"scope":"ip","subject_hash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","endpoint":"result-read","window_key":"tap-b","window_started_at":"2026-07-15T00:00:00Z","window_reset_at":"2026-07-15T00:01:00Z","request_limit":1}]'::jsonb)->>'allowed',
  'true', 'R14 service_role result-read consume succeeds'
);
reset role;
select is((select count(*)::text from public.analysis_request_rate_windows where endpoint='result-read'), '2', 'R15 two result-read buckets created');
select is((select sum(request_count)::text from public.analysis_request_rate_windows where endpoint='result-read'), '2', 'R16 allowed consume increments every bucket');

set local role service_role;
select is(
  public.consume_analysis_rate_limits('[{"scope":"anonymous","subject_hash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","endpoint":"result-read","window_key":"tap-a","window_started_at":"2026-07-15T00:00:00Z","window_reset_at":"2026-07-15T00:01:00Z","request_limit":1},{"scope":"ip","subject_hash":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc","endpoint":"result-read","window_key":"tap-c","window_started_at":"2026-07-15T00:00:00Z","window_reset_at":"2026-07-15T00:01:00Z","request_limit":10}]'::jsonb)->>'allowed',
  'false', 'R17 exhausted bucket rejects the whole request'
);
reset role;
select is((select request_count::text from public.analysis_request_rate_windows where subject_hash=repeat('c',64)), '0', 'R18 atomic rejection leaves other bucket unchanged');
select is((select sum(request_count)::text from public.analysis_request_rate_windows where endpoint='result-read'), '2', 'R19 rejected request increments no bucket');

set local role service_role;
select is(public.consume_analysis_rate_limits('[{"scope":"user","subject_hash":"dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd","endpoint":"analyze","window_key":"tap-analyze","window_started_at":"2026-07-15T00:00:00Z","window_reset_at":"2026-07-15T01:00:00Z","request_limit":2}]'::jsonb)->>'allowed', 'true', 'R20 analyze remains accepted');
select is(public.consume_analysis_rate_limits('[{"scope":"user","subject_hash":"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee","endpoint":"face-reading","window_key":"tap-face","window_started_at":"2026-07-15T00:00:00Z","window_reset_at":"2026-07-15T01:00:00Z","request_limit":2}]'::jsonb)->>'allowed', 'true', 'R21 face-reading remains accepted');
reset role;
select ok(to_regprocedure('public.cleanup_analysis_request_guard(timestamp with time zone)') is not null, 'R22 cleanup RPC remains present');
select ok(to_regclass('public.analysis_request_idempotency') is not null, 'R23 idempotency table remains present');
select is((select count(*)::text from pg_constraint where conname='analysis_request_rate_windows_endpoint_check'), '1', 'R24 corrective migration is reapply-safe');

select * from finish();
rollback;
