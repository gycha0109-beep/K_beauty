-- D8K13 CURRENT metadata only: repeatable SELECT. No historical bootstrap inference.
-- No table data, identifiers, migration SQL bodies, secrets or DML returned.
WITH targets AS (
 SELECT c.oid,c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner) owner_name
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname IN ('source_rankings','product_candidates')
), columns AS (
 SELECT t.oid, count(*) col_count,
 count(*) FILTER (WHERE a.attnotnull) not_null_count,
 count(*) FILTER (WHERE a.atthasdef) default_count
 FROM targets t JOIN pg_attribute a ON a.attrelid=t.oid
 WHERE a.attnum>0 AND NOT a.attisdropped GROUP BY t.oid
), constraints AS (
 SELECT t.oid,count(*) count_total,
 count(*) FILTER(WHERE k.contype='p') count_pk,
 count(*) FILTER(WHERE k.contype='f') count_fk,
 count(*) FILTER(WHERE k.contype='c') count_check
 FROM targets t LEFT JOIN pg_constraint k ON k.conrelid=t.oid GROUP BY t.oid
), policies AS (
 SELECT t.oid,count(p.oid) policies
 FROM targets t LEFT JOIN pg_policy p ON p.polrelid=t.oid GROUP BY t.oid
), extensions AS (
 SELECT t.oid,count(d.objid)>0 extension_owned
 FROM targets t LEFT JOIN pg_depend d ON d.objid=t.oid
 AND d.classid='pg_class'::regclass
 AND d.refclassid='pg_extension'::regclass AND d.deptype='e'
 GROUP BY t.oid
)
SELECT jsonb_build_object(
 'stage','D8K13_PRELEDGER_CURRENT_SCHEMA_PROFILE_V1',
 'current_tables',(SELECT coalesce(jsonb_agg(jsonb_build_object(
 'table',t.relname,'owner',t.owner_name,'kind',t.relkind,
 'columns',c.col_count,'not_null',c.not_null_count,'with_default',c.default_count,
 'constraints',k.count_total,'pk',k.count_pk,'fk',k.count_fk,'check',k.count_check,
 'rls',t.relrowsecurity,'force_rls',t.relforcerowsecurity,
 'policies',p.policies,'extension_owned',e.extension_owned,
 'anon_select',has_table_privilege('anon',t.oid,'SELECT'),
 'anon_insert',has_table_privilege('anon',t.oid,'INSERT'),
 'auth_select',has_table_privilege('authenticated',t.oid,'SELECT'),
 'auth_insert',has_table_privilege('authenticated',t.oid,'INSERT'),
 'service_insert',has_table_privilege('service_role',t.oid,'INSERT')) ORDER BY t.relname),'[]'::jsonb)
 FROM targets t JOIN columns c USING(oid) JOIN constraints k USING(oid)
 JOIN policies p USING(oid) JOIN extensions e USING(oid)),
 'proves_original_create_or_grant_history',false,
 'reconstructs_baseline',false,'database_writes',0,'release_authorized',false
) AS readonly_profile;
