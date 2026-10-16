-- D8K-13 historical-migration drift read-only preflight, v1.
-- Hosted Supabase: SELECT ONLY. Never paste or export SQL bodies, secrets,
-- private IDs, stored statements, function source, or product rows.
-- This report is a provenance/ACL observation, NOT deployment approval.
WITH history AS (
 SELECT version,name,cardinality(statements) AS statement_count,
        octet_length(statements[1]) AS first_statement_bytes
 FROM supabase_migrations.schema_migrations
 WHERE version IN (
   '20260914153348',
   '20260929181051',
   '20260621030000',
   '20260711032649'
 )
), category AS (
 SELECT is_nullable,udt_name,
        col_description('public.products'::regclass,ordinal_position::integer) AS comment_text
 FROM information_schema.columns
 WHERE table_schema='public' AND table_name='products'
   AND column_name='category'
), ranking AS (
 SELECT c.relname,c.relrowsecurity AS rls_on,
        pg_catalog.has_table_privilege('anon',c.oid,'INSERT') OR
        pg_catalog.has_table_privilege('anon',c.oid,'UPDATE') OR
        pg_catalog.has_table_privilege('anon',c.oid,'DELETE') AS anon_write,
        pg_catalog.has_table_privilege('authenticated',c.oid,'INSERT') OR
        pg_catalog.has_table_privilege('authenticated',c.oid,'UPDATE') OR
        pg_catalog.has_table_privilege('authenticated',c.oid,'DELETE') AS authenticated_write,
        pg_catalog.has_table_privilege('service_role',c.oid,'INSERT') AS service_role_insert
 FROM pg_catalog.pg_class c
 WHERE c.oid IN (to_regclass('public.ranking_snapshots'),
                 to_regclass('public.source_rankings'))
), functions AS (
 SELECT p.proname,p.oid,p.prosecdef,
        pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE') AS service_role_execute,
        pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
        pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
        pg_catalog.pg_get_functiondef(p.oid) ~* 'p_jti_hash[[:space:]]+is[[:space:]]+null'
           AS explicit_jti_null_guard,
        pg_catalog.pg_get_functiondef(p.oid) ~* 'p_resource_id[[:space:]]+is[[:space:]]+null'
           AS explicit_resource_null_guard
 FROM pg_catalog.pg_proc p
 WHERE p.oid IN (
   to_regprocedure('public.claim_anonymous_write_grant(text,text,text,text,text,text)'),
   to_regprocedure('public.admin_correct_product_fact_subject_presentation_variant_v1(uuid,text,uuid,text,text)')
 )
)
SELECT jsonb_build_object(
 'stage','D8K13_HISTORICAL_DRIFT_READONLY_PREFLIGHT',
 'status','READ_ONLY_HOLD',
 'checked_at',now(),
 'hosted_db_writes',0,
 'scoped_migration_count',(SELECT count(*) FROM history),
 'history_observation',(SELECT coalesce(jsonb_agg(jsonb_build_object(
    'version',version,'name',name,'statement_count',statement_count,
    'first_statement_bytes',first_statement_bytes) ORDER BY version),
    '[]'::jsonb) FROM history),
 'taxonomy8',jsonb_build_object(
    'category_nullable',(SELECT is_nullable='YES' FROM category),
    'category_type_is_expected',(SELECT udt_name='product_category' FROM category),
    'category_comment_mentions_projection',(SELECT comment_text ILIKE '%compatibility projection%' FROM category),
    'exact_equivalence_view_present',to_regclass('public.catalog_taxonomy_product_exact_equivalence_v1') IS NOT NULL,
    'canonical_taxonomy_table_present',to_regclass('public.product_catalog_taxonomy_assignments') IS NOT NULL,
    'historical_scope_is_single_64_byte_statement',(SELECT statement_count=1 AND first_statement_bytes=64 FROM history WHERE version='20260914153348'),
    'historical_git_preflight_execution_attested',false
 ),
 'ranking', (SELECT coalesce(jsonb_agg(jsonb_build_object(
    'table',relname,'rls',rls_on,'anon_write',anon_write,
    'authenticated_write',authenticated_write,
    'service_role_insert',service_role_insert) ORDER BY relname),'[]'::jsonb)
    FROM ranking),
 'c5b', (SELECT jsonb_build_object(
    'present',true,'security_definer',prosecdef,
    'service_role_execute',service_role_execute,'anon_execute',anon_execute,
    'authenticated_execute',authenticated_execute,
    'historical_pre_and_post_guard_executed_attested',false)
    FROM functions WHERE proname='admin_correct_product_fact_subject_presentation_variant_v1'),
 'anonymous_write_grant', (SELECT jsonb_build_object(
    'present',true,'security_definer',prosecdef,
    'explicit_jti_null_guard',explicit_jti_null_guard,
    'explicit_resource_null_guard',explicit_resource_null_guard,
    'exploitable_behavior_proven',false)
    FROM functions WHERE proname='claim_anonymous_write_grant'),
 'ready_to_apply_migration',false
) AS readonly_preflight;
