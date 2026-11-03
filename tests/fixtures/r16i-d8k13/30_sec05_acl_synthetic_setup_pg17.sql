-- SYNTHETIC POSTGRES17 FIXTURE ONLY. No hosted identifiers, no real grants.
DO $setup$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END;
$setup$;

CREATE TABLE public.ranking_snapshots(id bigint PRIMARY KEY);
CREATE TABLE public.source_rankings(id bigint PRIMARY KEY);
ALTER TABLE public.ranking_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_rankings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ranking_snapshots,public.source_rankings
  FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE public.ranking_snapshots
  TO anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE public.ranking_snapshots TO service_role;
GRANT SELECT,INSERT ON TABLE public.source_rankings TO service_role;

DO $assert_baseline$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF NOT has_table_privilege(r,'public.ranking_snapshots','SELECT')
      OR NOT has_table_privilege(r,'public.ranking_snapshots','REFERENCES')
      OR NOT has_table_privilege(r,'public.ranking_snapshots','TRIGGER')
      OR NOT has_table_privilege(r,'public.ranking_snapshots','MAINTAIN')
      OR has_table_privilege(r,'public.ranking_snapshots','INSERT')
      OR has_table_privilege(r,'public.ranking_snapshots','UPDATE')
      OR has_table_privilege(r,'public.ranking_snapshots','DELETE')
      OR has_table_privilege(r,'public.ranking_snapshots','TRUNCATE')
      OR has_table_privilege(r,'public.source_rankings','INSERT') THEN
      RAISE EXCEPTION 'D8K13_SYNTHETIC_RANKING_ACL_BASELINE_MISMATCH';
    END IF;
  END LOOP;
  IF NOT has_table_privilege('service_role','public.ranking_snapshots','INSERT')
    OR NOT has_table_privilege('service_role','public.source_rankings','INSERT') THEN
    RAISE EXCEPTION 'D8K13_SYNTHETIC_SERVICE_ROLE_BASELINE_MISMATCH';
  END IF;
END;
$assert_baseline$;

SELECT 'D8K13_SYNTHETIC_ACL_BASELINE_PASS' AS result;
