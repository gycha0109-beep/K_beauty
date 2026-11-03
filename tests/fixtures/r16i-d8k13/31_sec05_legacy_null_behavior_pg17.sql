-- SYNTHETIC LEGACY COUNTEREXAMPLE ONLY. Entire transaction rolls back.
-- This demonstrates the observed legacy NULL SQL logic under disposable PG17.
BEGIN;
INSERT INTO public.anonymous_write_grants(
  jti_hash,version,purpose,resource_type,resource_id,operation,
  principal_hash,expected_fingerprint_hash,max_uses,issued_at,expires_at
) VALUES(
  repeat('a',64),2,'anonymous-analysis-write','analysis-run',
  'synthetic_run_id_123456789012345678','result:create',
  repeat('b',64),repeat('c',64),1,
  now()-interval '1 minute',now()+interval '1 hour'
);

DO $legacy_case$
DECLARE
  result jsonb;
BEGIN
  result := public.claim_anonymous_write_grant(
    repeat('a',64),repeat('b',64),'analysis-run',
    NULL,'result:create',repeat('c',64)
  );
  IF result->>'state' IS DISTINCT FROM 'claimed' THEN
    RAISE EXCEPTION 'D8K13_LEGACY_NULL_COUNTEREXAMPLE_NOT_REPRODUCED';
  END IF;
  IF (SELECT count(*) FROM public.anonymous_write_grant_uses) <> 1
    OR (SELECT used_count FROM public.anonymous_write_grants WHERE jti_hash=repeat('a',64)) <> 1 THEN
    RAISE EXCEPTION 'D8K13_LEGACY_NULL_COUNTEREXAMPLE_WRITES_NOT_OBSERVED';
  END IF;
END;
$legacy_case$;
ROLLBACK;

DO $rollback_guard$
BEGIN
  IF (SELECT count(*) FROM public.anonymous_write_grants) <> 0
     OR (SELECT count(*) FROM public.anonymous_write_grant_uses) <> 0 THEN
    RAISE EXCEPTION 'D8K13_LEGACY_COUNTEREXAMPLE_ROLLBACK_FAILED';
  END IF;
END;
$rollback_guard$;

SELECT 'D8K13_SEC05_LEGACY_NULL_COUNTEREXAMPLE_AND_ROLLBACK_PASS' AS result;
