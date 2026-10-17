-- D8K13 repeatable SELECT-only hosted history audit. No SQL bodies or product IDs returned.
WITH h AS (
 SELECT version,name,statements,array_to_string(statements,E'\n') AS txt
 FROM supabase_migrations.schema_migrations
), rank_history AS (
 SELECT
   count(*) AS mentions,
   count(*) FILTER(WHERE txt ~* 'revoke[^;]{0,180}on[[:space:]]+table[[:space:]]+public[.]source_rankings') AS revokes,
   count(*) FILTER(WHERE txt ~* 'grant[^;]{0,180}on[[:space:]]+table[[:space:]]+public[.]source_rankings') AS grants,
   count(*) FILTER(WHERE txt ~* 'create[[:space:]]+table[^;]{0,180}public[.]source_rankings') AS creates
 FROM h WHERE txt ILIKE '%source_rankings%'
), per_product AS (
 SELECT p.id,p.category IS NULL AS null_cat,p.created_at,
 NOT EXISTS(SELECT 1 FROM public.product_catalog_taxonomy_assignments a WHERE a.product_id=p.id)
   AS lacks_canonical_assignment,
 count(e.product_id) AS n,
 coalesce(bool_and(e.exact_equivalent),false) AS exact,
 coalesce(bool_and(e.assignment_state='shadow' AND e.taxonomy_authority_mode='shadow_only'),false) AS shadow
 FROM public.products p
 LEFT JOIN public.catalog_taxonomy_product_exact_equivalence_v1 e ON e.product_id=p.id
 GROUP BY p.id,p.category,p.created_at
), product_totals AS (
 SELECT count(*) total,
 count(*) FILTER(WHERE n<>1 OR exact IS NOT TRUE) invalid,
 count(*) FILTER(WHERE (n<>1 OR exact IS NOT TRUE) AND null_cat) invalid_null,
 count(*) FILTER(WHERE (n<>1 OR exact IS NOT TRUE) AND NOT null_cat) invalid_nonnull,
 count(*) FILTER(WHERE (n<>1 OR exact IS NOT TRUE) AND NOT null_cat AND lacks_canonical_assignment)
   invalid_nonnull_missing_assignment,
 count(*) FILTER(WHERE (n<>1 OR exact IS NOT TRUE) AND shadow) shadow_invalid,
 count(*) FILTER(WHERE (n<>1 OR exact IS NOT TRUE) AND created_at < '2026-09-14'::timestamp) invalid_before_cutoff,
 count(*) FILTER(WHERE (n<>1 OR exact IS NOT TRUE) AND created_at >= '2026-09-14'::timestamp) invalid_after_cutoff
 FROM per_product
)
SELECT jsonb_build_object(
 'stage','D8K13_CRAWLER_TAX8_RANKING_HISTORY_READONLY_V1',
 'db_writes',0,'release_authorized',false,
 'applied_history_count',(SELECT count(*) FROM h),
 'crawler',(SELECT jsonb_build_object('statements',cardinality(statements),
 'bytes',octet_length(statements[1]),
 'end_delimiters_without_semicolon',(SELECT count(*) FROM regexp_matches(statements[1],
    'end[[:space:]]+[$][$]','gi')),
 'end_delimiters_with_semicolon',(SELECT count(*) FROM regexp_matches(statements[1],
    'end;[[:space:]]+[$][$]','gi')))
 FROM h WHERE version='20260822130309'),
 'source_rankings_history',(SELECT jsonb_build_object('mentions',mentions,
 'explicit_revoke',revokes,'explicit_grant',grants,'explicit_create',creates) FROM rank_history),
 'source_rankings_current_acl',(SELECT jsonb_build_object(
 'rls',relrowsecurity,'owner',pg_get_userbyid(relowner),
 'roles',relacl::text[],
 'anon_insert',has_table_privilege('anon',oid,'INSERT'),
 'authenticated_insert',has_table_privilege('authenticated',oid,'INSERT'),
 'service_role_insert',has_table_privilege('service_role',oid,'INSERT'))
 FROM pg_class WHERE oid=to_regclass('public.source_rankings')),
 'postgres_public_table_default_anon_grant_exists',(SELECT coalesce(bool_or(
 array_to_string(d.defaclacl::text[],',') LIKE '%anon=%'),false)
 FROM pg_default_acl d JOIN pg_namespace n ON n.oid=d.defaclnamespace
 WHERE d.defaclobjtype='r' AND n.nspname='public' AND pg_get_userbyid(d.defaclrole)='postgres'),
 'taxonomy8_current',(SELECT jsonb_build_object('total',total,'non_exact',invalid,
 'non_exact_null_category',invalid_null,'non_exact_nonnull_category',invalid_nonnull,
 'non_exact_nonnull_missing_canonical_assignment',invalid_nonnull_missing_assignment,
 'non_exact_shadow_only',shadow_invalid,
 'non_exact_created_before_20260914',invalid_before_cutoff,
 'non_exact_created_after_20260914',invalid_after_cutoff)
 FROM product_totals),
 'historical_tax8_preflight_attested',false,
 'source_rankings_acl_origination_attested',false,
 'whole_history_replay_approved',false
) AS readonly_audit;