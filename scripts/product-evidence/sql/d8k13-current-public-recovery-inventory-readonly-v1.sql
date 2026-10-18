-- D8K13 current-state recovery inventory, production READ-ONLY metadata.
-- Contains no row data, object bodies, user identifiers or credentials.
-- public only: auth/storage/other managed schemas and role/cluster objects excluded.
WITH public_namespace AS (
  SELECT oid FROM pg_namespace WHERE nspname='public'
), relations AS (
  SELECT cls.oid, cls.relkind, cls.relrowsecurity, cls.relforcerowsecurity
  FROM pg_class cls JOIN public_namespace n ON cls.relnamespace=n.oid
  WHERE cls.relkind IN ('r','p','v','m','f')
)
SELECT jsonb_build_object(
  'scope','CURRENT_PUBLIC_SCHEMA_METADATA_ONLY',
  'postgres_major',current_setting('server_version_num')::integer/10000,
  'tables',(SELECT count(*) FROM relations WHERE relkind IN ('r','p')),
  'views',(SELECT count(*) FROM relations WHERE relkind='v'),
  'matviews',(SELECT count(*) FROM relations WHERE relkind='m'),
  'rls_enabled',(SELECT count(*) FROM relations WHERE relrowsecurity),
  'rls_forced',(SELECT count(*) FROM relations WHERE relforcerowsecurity),
  'columns',(SELECT count(*) FROM pg_attribute a JOIN relations r ON a.attrelid=r.oid
    WHERE a.attnum>0 AND NOT a.attisdropped),
  'pk',(SELECT count(*) FROM pg_constraint c JOIN public_namespace n ON c.connamespace=n.oid
    WHERE c.contype='p'),
  'fk',(SELECT count(*) FROM pg_constraint c JOIN public_namespace n ON c.connamespace=n.oid
    WHERE c.contype='f'),
  'routines',(SELECT count(*) FROM pg_proc p JOIN public_namespace n ON p.pronamespace=n.oid),
  'security_definer',(SELECT count(*) FROM pg_proc p JOIN public_namespace n ON p.pronamespace=n.oid
    WHERE p.prosecdef),
  'policies',(SELECT count(*) FROM pg_policy p JOIN relations r ON r.oid=p.polrelid),
  'triggers',(SELECT count(*) FROM pg_trigger t JOIN relations r ON r.oid=t.tgrelid
    WHERE NOT t.tgisinternal),
  'enums',(SELECT count(*) FROM pg_type t JOIN public_namespace n ON t.typnamespace=n.oid
    WHERE t.typtype='e'),
  'no_data_exported',true,
  'complete_restore_tested',false,
  'production_writes',0
) AS inventory;
