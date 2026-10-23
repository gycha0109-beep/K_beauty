-- SYNTHETIC HARDENED FUNCTION CONTRACT, isolated PG17 only.
DO $null_matrix$
DECLARE
  i integer;
  observed_message text;
BEGIN
  FOR i IN 1..6 LOOP
    BEGIN
      PERFORM public.claim_anonymous_write_grant(
        CASE WHEN i=1 THEN NULL ELSE repeat('a',64) END,
        CASE WHEN i=2 THEN NULL ELSE repeat('b',64) END,
        CASE WHEN i=3 THEN NULL ELSE 'analysis-run' END,
        CASE WHEN i=4 THEN NULL ELSE 'synthetic_run_id_123456789012345678' END,
        CASE WHEN i=5 THEN NULL ELSE 'result:create' END,
        CASE WHEN i=6 THEN NULL ELSE repeat('c',64) END
      );
      RAISE EXCEPTION 'D8K13_SEC05_HARDENED_NULL_ARG_ACCEPTED_%',i;
    EXCEPTION WHEN SQLSTATE '22023' THEN
      GET STACKED DIAGNOSTICS observed_message=MESSAGE_TEXT;
      IF observed_message IS DISTINCT FROM 'anonymous_write_grant_claim_invalid' THEN
        RAISE EXCEPTION 'D8K13_SEC05_UNEXPECTED_NULL_GUARD_ERROR_%',i;
      END IF;
    END;
  END LOOP;
  IF (SELECT count(*) FROM public.anonymous_write_grants) <> 0
     OR (SELECT count(*) FROM public.anonymous_write_grant_uses) <> 0 THEN
    RAISE EXCEPTION 'D8K13_SEC05_NULL_MATRIX_MUTATED_TABLES';
  END IF;
END;
$null_matrix$;

DO $valid_and_retry$
DECLARE
  first_claim jsonb;
  second_claim jsonb;
BEGIN
  IF (public.claim_anonymous_write_grant(
    repeat('a',64),repeat('b',64),'analysis-run',
    'synthetic_run_id_123456789012345678','result:create',repeat('c',64)
  )->>'state') IS DISTINCT FROM 'invalid' THEN
    RAISE EXCEPTION 'D8K13_SEC05_UNKNOWN_JTI_MUST_FAIL_CLOSED';
  END IF;

  INSERT INTO public.anonymous_write_grants(
    jti_hash,version,purpose,resource_type,resource_id,operation,
    principal_hash,expected_fingerprint_hash,max_uses,issued_at,expires_at
  ) VALUES(
    repeat('a',64),2,'anonymous-analysis-write','analysis-run',
    'synthetic_run_id_123456789012345678','result:create',
    repeat('b',64),repeat('c',64),1,
    now()-interval '1 minute',now()+interval '1 hour'
  );

  first_claim := public.claim_anonymous_write_grant(
    repeat('a',64),repeat('b',64),'analysis-run',
    'synthetic_run_id_123456789012345678','result:create',repeat('c',64)
  );
  IF first_claim->>'state' IS DISTINCT FROM 'claimed'
    OR first_claim->>'use_id' IS NULL THEN
    RAISE EXCEPTION 'D8K13_SEC05_VALID_CLAIM_REGRESSION';
  END IF;

  second_claim := public.claim_anonymous_write_grant(
    repeat('a',64),repeat('b',64),'analysis-run',
    'synthetic_run_id_123456789012345678','result:create',repeat('c',64)
  );
  IF second_claim->>'state' IS DISTINCT FROM 'in_progress'
     OR second_claim->>'use_id' IS DISTINCT FROM first_claim->>'use_id' THEN
    RAISE EXCEPTION 'D8K13_SEC05_VALID_RETRY_IDEMPOTENCY_REGRESSION';
  END IF;

  IF (SELECT count(*) FROM public.anonymous_write_grant_uses) <> 1
    OR (SELECT used_count FROM public.anonymous_write_grants WHERE jti_hash=repeat('a',64)) <> 1 THEN
    RAISE EXCEPTION 'D8K13_SEC05_VALID_CLAIM_USE_COUNT_REGRESSION';
  END IF;
END;
$valid_and_retry$;

DO $roles$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF has_function_privilege(r,
      'public.claim_anonymous_write_grant(text,text,text,text,text,text)','EXECUTE') THEN
      RAISE EXCEPTION 'D8K13_SEC05_PUBLIC_RPC_EXECUTE_OPEN';
    END IF;
    IF has_table_privilege(r,'public.anonymous_write_grants','SELECT')
      OR has_table_privilege(r,'public.anonymous_write_grants','INSERT')
      OR has_table_privilege(r,'public.anonymous_write_grant_uses','SELECT')
      OR has_table_privilege(r,'public.anonymous_write_grant_uses','INSERT') THEN
      RAISE EXCEPTION 'D8K13_SEC05_PUBLIC_GRANT_TABLE_ACL_OPEN';
    END IF;
  END LOOP;
  IF has_function_privilege('public',
    'public.claim_anonymous_write_grant(text,text,text,text,text,text)','EXECUTE')
    OR NOT has_function_privilege('service_role',
      'public.claim_anonymous_write_grant(text,text,text,text,text,text)','EXECUTE')
    OR (SELECT prosecdef FROM pg_proc WHERE oid=
      'public.claim_anonymous_write_grant(text,text,text,text,text,text)'::regprocedure) THEN
    RAISE EXCEPTION 'D8K13_SEC05_ROLE_OR_SECURITY_INVOKER_REGRESSION';
  END IF;
END;
$roles$;

SELECT 'D8K13_SEC05_HARDENED_NULL_MATRIX_ROLE_AND_RETRY_PASS' AS result;
