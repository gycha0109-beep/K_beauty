-- DISPOSABLE SYNTHETIC POSTGRESQL 17 ONLY.
-- Require the already-claimed synthetic result grant from fixture 32.
-- Both legacy RPCs are derived from installed function bodies, not invoked on hosted DB.
DO $preflight$
BEGIN
 IF (SELECT count(*) FROM public.anonymous_write_grants WHERE jti_hash=repeat('a',64)
   AND principal_hash=repeat('b',64) AND status='active' AND used_count=1)<>1
  OR (SELECT count(*) FROM public.anonymous_write_grant_uses WHERE
    request_fingerprint_hash=repeat('c',64) AND status='in_progress')<>1 THEN
  RAISE EXCEPTION 'D8K13_SEC05_EXTENDED_LEGACY_FIXTURE_BASELINE_INVALID';
 END IF;
END;
$preflight$;

BEGIN;
DO $legacy_complete$
DECLARE result jsonb;
BEGIN
 result:=public.complete_anonymous_write_grant(
  repeat('a',64),NULL,'analysis-run','synthetic_run_id_123456789012345678',
  'result:create',repeat('c',64),jsonb_build_object('synthetic',true)
 );
 IF result->>'updated' IS DISTINCT FROM 'true'
  OR (SELECT status FROM public.anonymous_write_grant_uses
    WHERE request_fingerprint_hash=repeat('c',64)) IS DISTINCT FROM 'completed'
  OR (SELECT status FROM public.anonymous_write_grants
    WHERE jti_hash=repeat('a',64)) IS DISTINCT FROM 'completed'
 THEN
  RAISE EXCEPTION 'D8K13_SEC05_LEGACY_COMPLETE_NULL_PRINCIPAL_BYPASS_NOT_REPRODUCED';
 END IF;
END;
$legacy_complete$;
ROLLBACK;

BEGIN;
DO $legacy_fail$
DECLARE result jsonb;
BEGIN
 result:=public.fail_anonymous_write_grant(
  repeat('a',64),NULL,'analysis-run','synthetic_run_id_123456789012345678',
  'result:create',repeat('c',64)
 );
 IF result->>'updated' IS DISTINCT FROM 'true'
  OR (SELECT status FROM public.anonymous_write_grant_uses
    WHERE request_fingerprint_hash=repeat('c',64)) IS DISTINCT FROM 'failed'
 THEN
  RAISE EXCEPTION 'D8K13_SEC05_LEGACY_FAIL_NULL_PRINCIPAL_BYPASS_NOT_REPRODUCED';
 END IF;
END;
$legacy_fail$;
ROLLBACK;

DO $rollback_assert$
BEGIN
 IF (SELECT count(*) FROM public.anonymous_write_grants)<>1
  OR (SELECT count(*) FROM public.anonymous_write_grant_uses)<>1
  OR (SELECT status FROM public.anonymous_write_grants
    WHERE jti_hash=repeat('a',64)) IS DISTINCT FROM 'active'
  OR (SELECT status FROM public.anonymous_write_grant_uses
    WHERE request_fingerprint_hash=repeat('c',64)) IS DISTINCT FROM 'in_progress'
 THEN
  RAISE EXCEPTION 'D8K13_SEC05_COMPLETE_FAIL_LEGACY_ROLLBACK_FAILED';
 END IF;
END;
$rollback_assert$;

SELECT 'D8K13_SEC05_COMPLETE_FAIL_LEGACY_NULL_BYPASS_ROLLBACK_PASS' AS result;
