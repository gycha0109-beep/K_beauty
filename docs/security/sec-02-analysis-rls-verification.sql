-- SEC-02 analysis data RLS/grant verification
-- Purpose: Supabase SQL Editor에서 user/report/image row를 조회하지 않고
-- 분석 데이터 관련 RLS, grant, policy, function, storage metadata만 확인한다.
-- Safe to run: SELECT/catalog metadata only. Do not modify schema or data.

-- 1) 분석 관련 public table의 RLS enabled/forced 상태를 확인한다.
-- 기대 상태:
-- - analysis_requests, analysis_results, premium_report_sessions: RLS enabled.
-- - saved_reports, skin_profiles, daily_checkins, routine_logs: RLS enabled.
-- - SEC-01 guard table은 migration 적용 전이면 존재하지 않을 수 있다.
with target_tables(table_name) as (
  values
    ('analysis_requests'),
    ('analysis_results'),
    ('saved_reports'),
    ('skin_profiles'),
    ('daily_checkins'),
    ('routine_logs'),
    ('premium_report_sessions'),
    ('analysis_request_rate_windows'),
    ('analysis_request_idempotency')
)
select
  t.table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from target_tables t
left join pg_class c on c.relname = t.table_name
left join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
where n.nspname = 'public' or c.oid is null
order by t.table_name;

-- 2) 분석 관련 table privilege를 role별로 확인한다.
-- 기대 상태:
-- - analysis_requests, analysis_results, premium_report_sessions: anon/authenticated grant 없음, service_role만 필요 권한 보유.
-- - saved_reports, skin_profiles, daily_checkins, routine_logs: anon grant 없음, authenticated는 RLS owner policy가 전제인 최소 CRUD.
-- - PUBLIC grant 없음.
with target_tables(table_name) as (
  values
    ('analysis_requests'),
    ('analysis_results'),
    ('saved_reports'),
    ('skin_profiles'),
    ('daily_checkins'),
    ('routine_logs'),
    ('premium_report_sessions'),
    ('analysis_request_rate_windows'),
    ('analysis_request_idempotency')
)
select
  t.table_name,
  g.grantee,
  g.privilege_type
from target_tables t
left join information_schema.role_table_grants g
  on g.table_schema = 'public'
 and g.table_name = t.table_name
 and g.grantee in ('anon', 'authenticated', 'service_role', 'PUBLIC')
order by t.table_name, g.grantee, g.privilege_type;

-- 3) 분석 관련 public table policy 목록과 조건을 확인한다.
-- 기대 상태:
-- - saved_reports, skin_profiles, daily_checkins, routine_logs: auth.uid() = user_id 및 anonymous auth user 제외 조건.
-- - analysis_requests, analysis_results, premium_report_sessions: browser role policy가 없거나 명시적으로 제한됨.
-- - USING (true), WITH CHECK (true) 같은 broad policy 없음.
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'analysis_requests',
    'analysis_results',
    'saved_reports',
    'skin_profiles',
    'daily_checkins',
    'routine_logs',
    'premium_report_sessions',
    'analysis_request_rate_windows',
    'analysis_request_idempotency'
  )
order by tablename, policyname;

-- 4) 분석/프리미엄 관련 function의 SECURITY DEFINER, search_path, execute privilege를 확인한다.
-- 기대 상태:
-- - SECURITY DEFINER function은 search_path가 명시되어야 한다.
-- - privileged function execute는 service_role만 허용하고 anon/authenticated에는 허용하지 않는다.
-- - proacl에 public execute shorthand가 남아 있지 않아야 한다.
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args,
  p.prosecdef as security_definer,
  coalesce(array_to_string(p.proconfig, ','), '') as config,
  p.proacl::text as acl,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (
    p.proname ilike '%analysis%'
    or p.proname ilike '%premium%'
    or p.proname in (
      'promote_product_candidate',
      'ingest_ranking_snapshot'
    )
  )
order by p.proname, args;

-- 5) Storage bucket public/private metadata를 확인한다.
-- 기대 상태:
-- - 현재 분석 사진 저장 bucket이 없다면 결과가 비어도 정상이다.
-- - 분석 사진 bucket이 생긴 경우 public=false, file_size_limit, allowed_mime_types가 명시되어야 한다.
select
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
from storage.buckets
order by name;

-- 6) Storage objects/buckets policy metadata를 확인한다.
-- 기대 상태:
-- - 분석 이미지 bucket이 생긴 경우 object path owner/report namespace와 signed URL 모델을 강제하는 policy가 있어야 한다.
-- - 현재 bucket이 없으면 관련 policy도 없을 수 있다.
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'storage'
  and tablename in ('objects', 'buckets')
order by tablename, policyname;

-- 7) 관련 migration 적용 이력을 확인한다.
-- 기대 상태:
-- - analysis schema, premium session, revisit core tables, anonymous user restriction migration이 확인되어야 한다.
-- - SEC-01 guard migration은 별도 SEC-01 배포 절차에서 확인한다.
-- - statements 본문은 길고 불필요하므로 제외한다.
select
  to_jsonb(sm) - 'statements' as migration_metadata
from supabase_migrations.schema_migrations sm
where version like '20260424%'
   or version like '20260506%'
   or version like '20260520%'
   or version like '20260531%'
   or version like '20260704%'
order by version;
