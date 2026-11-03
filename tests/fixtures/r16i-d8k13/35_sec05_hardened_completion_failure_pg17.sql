-- DISPOSABLE SYNTHETIC POSTGRESQL 17 ONLY.
-- Hardened complete/fail must reject each NULL input, maintain retry behavior,
-- preserve service_role-only execution, and roll back all synthetic updates.
DO $six_null_matrix$
DECLARE i integer; observed text;
BEGIN
 FOR i IN 1..6 LOOP
  BEGIN
   PERFORM public.complete_anonymous_write_grant(
    CASE WHEN i=1 THEN NULL ELSE repeat('a',64) END,
    CASE WHEN i=2 THEN NULL ELSE repeat('b',64) END,
    CASE WHEN i=3 THEN NULL ELSE 'analysis-run' END,
    CASE WHEN i=4 THEN NULL ELSE 'synthetic_run_id_123456789012345678' END,
    CASE WHEN i=5 THEN NULL ELSE 'result:create' END,
    CASE WHEN i=6 THEN NULL ELSE repeat('c',64) END,
    jsonb_build_object('synthetic',true)
   );
   RAISE EXCEPTION 'D8K13_SEC05_COMPLETE_ACCEPTED_NULL_ARG_%',i;
  EXCEPTION WHEN SQLSTATE '22023' THEN
   GET STACKED DIAGNOSTICS observed=MESSAGE_TEXT;
   IF observed IS DISTINCT FROM 'anonymous_write_grant_claim_invalid' THEN
    RAISE EXCEPTION 'D8K13_SEC05_COMPLETE_NULL_ERROR_DRIFT_%',i;
   END IF;
  END;
  BEGIN
   PERFORM public.fail_anonymous_write_grant(
    CASE WHEN i=1 THEN NULL ELSE repeat('a',64) END,
    CASE WHEN i=2 THEN NULL ELSE repeat('b',64) END,
    CASE WHEN i=3 THEN NULL ELSE 'analysis-run' END,
    CASE WHEN i=4 THEN NULL ELSE 'synthetic_run_id_123456789012345678' END,
    CASE WHEN i=5 THEN NULL ELSE 'result:create' END,
    CASE WHEN i=6 THEN NULL ELSE repeat('c',64) END
   );
   RAISE EXCEPTION 'D8K13_SEC05_FAIL_ACCEPTED_NULL_ARG_%',i;
  EXCEPTION WHEN SQLSTATE '22023' THEN
   GET STACKED DIAGNOSTICS observed=MESSAGE_TEXT;
   IF observed IS DISTINCT FROM 'anonymous_write_grant_claim_invalid' THEN
    RAISE EXCEPTION 'D8K13_SEC05_FAIL_NULL_ERROR_DRIFT_%',i;
   END IF;
  END;
 END LOOP;
 IF (public.complete_anonymous_write_grant(
    repeat('a',64),repeat('d',64),'analysis-run',
    'synthetic_run_id_123456789012345678','result:create',repeat('c',64)
   )->>'updated') IS DISTINCT FROM 'false'
 OR (public.fail_anonymous_write_grant(
    repeat('a',64),repeat('d',64),'analysis-run',
    'synthetic_run_id_123456789012345678','result:create',repeat('c',64)
   )->>'updated') IS DISTINCT FROM 'false' THEN
  RAISE EXCEPTION 'D8K13_SEC05_WRONG_PRINCIPAL_MUST_NOT_MUTATE';
 END IF;
END;
$six_null_matrix$;

BEGIN;
DO $valid_complete$
DECLARE first_result jsonb; retry_result jsonb;
BEGIN
 first_result:=public.complete_anonymous_write_grant(
   repeat('a',64),repeat('b',64),'analysis-run',
   'synthetic_run_id_123456789012345678','result:create',repeat('c',64),
   jsonb_build_object('synthetic',true)
 );
 retry_result:=public.complete_anonymous_write_grant(
   repeat('a',64),repeat('b',64),'analysis-run',
   'synthetic_run_id_123456789012345678','result:create',repeat('c',64),
   jsonb_build_object('synthetic',true)
 );
 IF first_result->>'updated' IS DISTINCT FROM 'true'
 OR retry_result->>'already_completed' IS DISTINCT FROM 'true'
 OR (SELECT status FROM public.anonymous_write_grant_uses
   WHERE request_fingerprint_hash=repeat('c',64)) IS DISTINCT FROM 'completed'
 OR (SELECT status FROM public.anonymous_write_grants
   WHERE jti_hash=repeat('a',64)) IS DISTINCT FROM 'completed' THEN
  RAISE EXCEPTION 'D8K13_SEC05_VALID_COMPLETE_RETRY_FAILED';
 END IF;
END;
$valid_complete$;
ROLLBACK;

BEGIN;
DO $valid_fail$
DECLARE first_result jsonb; retry_result jsonb;
BEGIN
 first_result:=public.fail_anonymous_write_grant(
   repeat('a',64),repeat('b',64),'analysis-run',
   'synthetic_run_id_123456789012345678','result:create',repeat('c',64)
 );
 retry_result:=public.fail_anonymous_write_grant(
   repeat('a',64),repeat('b',64),'analysis-run',
   'synthetic_run_id_123456789012345678','result:create',repeat('c',64)
 );
 IF first_result->>'updated' IS DISTINCT FROM 'true'
 OR retry_result->>'already_failed' IS DISTINCT FROM 'true'
 OR (SELECT status FROM public.anonymous_write_grant_uses
   WHERE request_fingerprint_hash=repeat('c',64)) IS DISTINCT FROM 'failed' THEN
  RAISE EXCEPTION 'D8K13_SEC05_VALID_FAIL_RETRY_FAILED';
 END IF;
END;
$valid_fail$;
ROLLBACK;

DO $role_and_rollback$
DECLARE r text;
BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF has_function_privilege(r,
   'public.complete_anonymous_write_grant(text,text,text,text,text,text,jsonb)','EXECUTE')
   OR has_function_privilege(r,
   'public.fail_anonymous_write_grant(text,text,text,text,text,text)','EXECUTE')
   THEN RAISE EXCEPTION 'D8K13_SEC05_COMPLETE_FAIL_PUBLIC_RPC_EXECUTE_ALLOWED';
  END IF;
 END LOOP;
 IF NOT has_function_privilege('service_role',
   'public.complete_anonymous_write_grant(text,text,text,text,text,text,jsonb)','EXECUTE')
   OR NOT has_function_privilege('service_role',
   'public.fail_anonymous_write_grant(text,text,text,text,text,text)','EXECUTE')
   OR (SELECT prosecdef FROM pg_proc WHERE oid=
    'public.complete_anonymous_write_grant(text,text,text,text,text,text,jsonb)'::regprocedure)
   OR (SELECT prosecdef FROM pg_proc WHERE oid=
    'public.fail_anonymous_write_grant(text,text,text,text,text,text)'::regprocedure)
   THEN RAISE EXCEPTION 'D8K13_SEC05_COMPLETE_FAIL_ROLE_BOUNDARY_DRIFT';
 END IF;
 IF (SELECT count(*) FROM public.anonymous_write_grants)<>1
  OR (SELECT count(*) FROM public.anonymous_write_grant_uses)<>1
  OR (SELECT status FROM public.anonymous_write_grants
    WHERE jti_hash=repeat('a',64)) IS DISTINCT FROM 'active'
  OR (SELECT status FROM public.anonymous_write_grant_uses
    WHERE request_fingerprint_hash=repeat('c',64)) IS DISTINCT FROM 'in_progress'
  THEN RAISE EXCEPTION 'D8K13_SEC05_COMPLETE_FAIL_FINAL_ROLLBACK_FAILED';
 END IF;
END;
$role_and_rollback$;

SELECT 'D8K13_SEC05_COMPLETE_FAIL_HARDENED_NULL_MATRIX_RETRY_ROLLBACK_PASS' AS result;
