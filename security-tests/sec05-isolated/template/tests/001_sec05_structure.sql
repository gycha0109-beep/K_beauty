begin;

select plan(15);

select ok(to_regclass('public.anonymous_write_grants') is not null, 'STRUCTURE grants table exists');
select ok(to_regclass('public.anonymous_write_grant_uses') is not null, 'STRUCTURE uses table exists');
select ok(exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'analysis_results'
    and column_name = 'anonymous_write_grant_use_id' and data_type = 'uuid' and is_nullable = 'YES'
), 'STRUCTURE analysis_results has nullable grant-use linkage');
select ok(exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'recommendation_logs'
    and column_name = 'anonymous_write_grant_use_id' and data_type = 'uuid' and is_nullable = 'YES'
), 'STRUCTURE recommendation_logs has nullable grant-use linkage');
select ok(exists (
  select 1 from pg_constraint
  where conrelid = 'public.anonymous_write_grants'::regclass and contype = 'u'
    and pg_get_constraintdef(oid) like '%jti_hash%'
), 'STRUCTURE jti hash is unique');
select ok(exists (
  select 1 from pg_constraint
  where conrelid = 'public.anonymous_write_grant_uses'::regclass and contype = 'u'
    and pg_get_constraintdef(oid) like '%grant_id, request_fingerprint_hash%'
), 'STRUCTURE grant-use fingerprint is unique');
select ok(exists (
  select 1 from pg_indexes
  where schemaname = 'public' and indexname = 'analysis_results_anonymous_write_grant_use_id_key'
    and indexdef like '%UNIQUE%' and indexdef like '%anonymous_write_grant_use_id%'
), 'STRUCTURE result linkage has unique partial index');
select ok(exists (
  select 1 from pg_indexes
  where schemaname = 'public' and indexname = 'recommendation_logs_anonymous_write_grant_use_id_key'
    and indexdef like '%UNIQUE%' and indexdef like '%anonymous_write_grant_use_id%'
), 'STRUCTURE recommendation linkage has unique partial index');
select ok(exists (
  select 1 from pg_constraint
  where conrelid = 'public.analysis_results'::regclass and contype = 'f'
    and confrelid = 'public.anonymous_write_grant_uses'::regclass
), 'STRUCTURE result linkage foreign key exists');
select ok(exists (
  select 1 from pg_constraint
  where conrelid = 'public.recommendation_logs'::regclass and contype = 'f'
    and confrelid = 'public.anonymous_write_grant_uses'::regclass
), 'STRUCTURE recommendation linkage foreign key exists');
select ok(exists (
  select 1 from pg_constraint
  where conrelid = 'public.anonymous_write_grants'::regclass and contype = 'c'
    and pg_get_constraintdef(oid) like '%result:create%' and pg_get_constraintdef(oid) like '%track:create%'
), 'STRUCTURE result and track operation contract exists');
select ok(exists (
  select 1 from pg_constraint
  where conrelid = 'public.anonymous_write_grant_uses'::regclass and contype = 'c'
    and pg_get_constraintdef(oid) like '%in_progress%' and pg_get_constraintdef(oid) like '%completed%'
), 'STRUCTURE grant-use state contract exists');
select ok((
  select count(*) = 5 from pg_proc
  where oid in (
    'public.create_anonymous_write_grants(jsonb)'::regprocedure,
    'public.claim_anonymous_write_grant(text,text,text,text,text,text)'::regprocedure,
    'public.complete_anonymous_write_grant(text,text,text,text,text,text,jsonb)'::regprocedure,
    'public.fail_anonymous_write_grant(text,text,text,text,text,text)'::regprocedure,
    'public.cleanup_anonymous_write_grants(timestamptz)'::regprocedure
  )
), 'STRUCTURE required grant RPC signatures exist');
select ok((
  select bool_and(not prosecdef) from pg_proc
  where oid in (
    'public.create_anonymous_write_grants(jsonb)'::regprocedure,
    'public.claim_anonymous_write_grant(text,text,text,text,text,text)'::regprocedure,
    'public.complete_anonymous_write_grant(text,text,text,text,text,text,jsonb)'::regprocedure,
    'public.fail_anonymous_write_grant(text,text,text,text,text,text)'::regprocedure,
    'public.cleanup_anonymous_write_grants(timestamptz)'::regprocedure
  )
), 'STRUCTURE RPCs are SECURITY INVOKER and rely on service_role ACL');
select ok((
  select bool_and('search_path=public' = any(coalesce(proconfig, array[]::text[]))) from pg_proc
  where oid in (
    'public.create_anonymous_write_grants(jsonb)'::regprocedure,
    'public.claim_anonymous_write_grant(text,text,text,text,text,text)'::regprocedure,
    'public.complete_anonymous_write_grant(text,text,text,text,text,text,jsonb)'::regprocedure,
    'public.fail_anonymous_write_grant(text,text,text,text,text,text)'::regprocedure,
    'public.cleanup_anonymous_write_grants(timestamptz)'::regprocedure
  )
), 'STRUCTURE all RPC search paths are fixed to public');

select * from finish();
rollback;
