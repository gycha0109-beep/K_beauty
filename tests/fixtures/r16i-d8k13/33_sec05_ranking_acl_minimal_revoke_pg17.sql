-- SYNTHETIC PG17 ONLY. Never run this fixture on hosted Supabase.
-- Exercise a narrowly scoped least-privilege candidate, not a migration.
BEGIN;
REVOKE REFERENCES,TRIGGER,MAINTAIN ON TABLE public.ranking_snapshots
  FROM anon,authenticated;

DO $within_transaction$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF has_table_privilege(r,'public.ranking_snapshots','REFERENCES')
       OR has_table_privilege(r,'public.ranking_snapshots','TRIGGER')
       OR has_table_privilege(r,'public.ranking_snapshots','MAINTAIN')
       OR NOT has_table_privilege(r,'public.ranking_snapshots','SELECT') THEN
      RAISE EXCEPTION 'D8K13_SYNTHETIC_RANKING_PATCH_WITHIN_XACT_FAILED';
    END IF;
  END LOOP;
END;
$within_transaction$;
ROLLBACK;

DO $after_rollback$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF NOT has_table_privilege(r,'public.ranking_snapshots','REFERENCES')
       OR NOT has_table_privilege(r,'public.ranking_snapshots','TRIGGER')
       OR NOT has_table_privilege(r,'public.ranking_snapshots','MAINTAIN') THEN
      RAISE EXCEPTION 'D8K13_SYNTHETIC_RANKING_REVOKE_ROLLBACK_FAILED';
    END IF;
  END LOOP;
END;
$after_rollback$;

BEGIN;
REVOKE REFERENCES,TRIGGER,MAINTAIN ON TABLE public.ranking_snapshots
  FROM anon,authenticated;
COMMIT;

REVOKE REFERENCES,TRIGGER,MAINTAIN ON TABLE public.ranking_snapshots
  FROM anon,authenticated;

DO $postcheck$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF has_table_privilege(r,'public.ranking_snapshots','REFERENCES')
      OR has_table_privilege(r,'public.ranking_snapshots','TRIGGER')
      OR has_table_privilege(r,'public.ranking_snapshots','MAINTAIN')
      OR has_table_privilege(r,'public.ranking_snapshots','INSERT')
      OR has_table_privilege(r,'public.ranking_snapshots','UPDATE')
      OR has_table_privilege(r,'public.ranking_snapshots','DELETE')
      OR has_table_privilege(r,'public.ranking_snapshots','TRUNCATE')
      OR NOT has_table_privilege(r,'public.ranking_snapshots','SELECT')
      OR has_table_privilege(r,'public.source_rankings','SELECT')
      OR has_table_privilege(r,'public.source_rankings','INSERT') THEN
      RAISE EXCEPTION 'D8K13_SYNTHETIC_RANKING_LEAST_PRIVILEGE_REGRESSION';
    END IF;
  END LOOP;
  IF NOT has_table_privilege('service_role','public.ranking_snapshots','SELECT')
    OR NOT has_table_privilege('service_role','public.ranking_snapshots','INSERT')
    OR NOT has_table_privilege('service_role','public.ranking_snapshots','UPDATE')
    OR NOT has_table_privilege('service_role','public.source_rankings','INSERT')
    OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.ranking_snapshots'::regclass)
    OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.source_rankings'::regclass) THEN
    RAISE EXCEPTION 'D8K13_SYNTHETIC_RANKING_SERVICE_ROLE_OR_RLS_REGRESSION';
  END IF;
END;
$postcheck$;

SELECT 'D8K13_SYNTHETIC_RANKING_ACL_REVOKE_ROLLBACK_IDEMPOTENCE_PASS' AS result;
