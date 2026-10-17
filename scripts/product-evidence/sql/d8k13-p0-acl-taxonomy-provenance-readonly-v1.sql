-- D8K13 metadata-only P0 historical ACL / Taxonomy8 follow-up.
-- SELECT-only; intentionally returns NO product UUID/name, raw migration SQL, actor, credential, or source locator.
WITH history AS (
 SELECT version,name,array_to_string(statements,E'\n') AS body
 FROM supabase_migrations.schema_migrations
), h_flags AS (
 SELECT
  version,
  body ILIKE '%source_rankings%' AS source_mentioned,
  body ILIKE '%product_candidates%' AS candidate_mentioned,
  body ~* 'create[[:space:]]+table[[:space:]]+(if[[:space:]]+not[[:space:]]+exists[[:space:]]+)?(public[.])?source_rankings[[:space:]]*[(]' AS source_created_explicitly,
  body ~* 'create[[:space:]]+table[[:space:]]+(if[[:space:]]+not[[:space:]]+exists[[:space:]]+)?(public[.])?product_candidates[[:space:]]*[(]' AS candidate_created_explicitly,
  body ~* '(grant|revoke)[^;]{0,200}[[:space:]]on[[:space:]]+table[[:space:]]+(public[.])?source_rankings([[:space:];,]|$)' AS source_acl_explicit,
  body ~* '(grant|revoke)[^;]{0,200}[[:space:]]on[[:space:]]+table[[:space:]]+(public[.])?product_candidates([[:space:];,]|$)' AS candidate_acl_explicit,
  body ~* 'alter[[:space:]]+table[[:space:]]+public[.]product_candidates' AS alters_candidate,
  body ~* 'create[[:space:]]+or[[:space:]]+replace[[:space:]]+view[[:space:]]+public[.]product_candidate_evidence_summary'
    AND body ~* 'join[[:space:]]+public[.]source_rankings' AS view_joins_source
 FROM history
), access AS (
 SELECT c.relname, c.relrowsecurity,
  has_table_privilege('anon',c.oid,'SELECT') AS anon_select,
  has_table_privilege('anon',c.oid,'INSERT') AS anon_insert,
  has_table_privilege('authenticated',c.oid,'SELECT') AS auth_select,
  has_table_privilege('authenticated',c.oid,'INSERT') AS auth_insert,
  has_table_privilege('service_role',c.oid,'INSERT') AS service_insert
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname IN ('source_rankings','product_candidates')
), taxonomy_exception AS (
 SELECT
  p.category::text AS legacy_category,p.product_form::text AS product_form,p.created_at::date AS created_date,
  c.review_status::text AS candidate_review_status,c.identity_resolution_state,
  c.promotion_version,
  c.promotion_payload #>> '{structural_adoption,promotion_action}' AS promotion_action,
  c.promotion_payload #>> '{structural_adoption,contract_version}' AS promotion_contract,
  x.classification_state::text AS candidate_classification_state,
  x.classification_method::text AS candidate_classification_method,
  x.legacy_projection_key IS NOT NULL AS candidate_projection_key_present,
  x.category_term_id IS NOT NULL AS candidate_category_term_present,
  (SELECT count(*) FROM public.product_catalog_taxonomy_assignments a WHERE a.product_id=p.id) AS assignment_count
 FROM public.products p
 JOIN public.catalog_taxonomy_product_exact_equivalence_v1 v ON v.product_id=p.id
 LEFT JOIN public.product_candidates c ON c.matched_product_id=p.id
 LEFT JOIN public.product_candidate_catalog_taxonomy_classifications x
   ON x.candidate_id=c.id AND x.taxonomy_version='catalog-taxonomy-v1'
 WHERE p.category IS NOT NULL AND v.exact_equivalent IS NOT TRUE
), promotion_functions AS (
 SELECT p.proname,
   p.prosrc ILIKE '%product_catalog_taxonomy_assignments%' AS references_assignment,
   p.prosrc ILIKE '%insert into public.product_catalog_taxonomy_assignments%' AS inserts_assignment
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public'
 AND p.proname IN ('promote_product_candidate_structural_v1','promote_product_candidate_catalog_only_v1')
), taxonomy_triggers AS (
 SELECT c.relname,p.proname
 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 JOIN pg_namespace n ON n.oid=c.relnamespace
 JOIN pg_proc p ON p.oid=t.tgfoid
 WHERE n.nspname='public' AND NOT t.tgisinternal AND t.tgenabled IN ('O','A')
 AND c.relname IN ('products','product_candidates')
)
SELECT jsonb_build_object(
 'stage','D8K13_P0_ACL_TAXONOMY_PROVENANCE_FOLLOWUP_V1',
 'db_writes',0,'release_authorized',false,
 'history_count',(SELECT count(*) FROM history),
 'earliest_applied_version',(SELECT min(version) FROM history),
 'earliest_candidate_alter',(SELECT coalesce(bool_or(alters_candidate),false) FROM h_flags WHERE version=(SELECT min(version) FROM history)),
 'earliest_source_join',(SELECT coalesce(bool_or(view_joins_source),false) FROM h_flags WHERE version=(SELECT min(version) FROM history)),
 'source_mentions',(SELECT count(*) FROM h_flags WHERE source_mentioned),
 'candidate_mentions',(SELECT count(*) FROM h_flags WHERE candidate_mentioned),
 'source_create_matches',(SELECT count(*) FROM h_flags WHERE source_created_explicitly),
 'candidate_create_matches',(SELECT count(*) FROM h_flags WHERE candidate_created_explicitly),
 'source_acl_matches',(SELECT count(*) FROM h_flags WHERE source_acl_explicit),
 'candidate_acl_matches',(SELECT count(*) FROM h_flags WHERE candidate_acl_explicit),
 'current_access',(SELECT coalesce(jsonb_agg(to_jsonb(access) ORDER BY relname),'[]'::jsonb) FROM access),
 'taxonomy_exception_count',(SELECT count(*) FROM taxonomy_exception),
 'taxonomy_exception',(SELECT coalesce(jsonb_agg(to_jsonb(taxonomy_exception)),'[]'::jsonb) FROM taxonomy_exception),
 'promotion_function_assignment_flags',(SELECT coalesce(jsonb_agg(to_jsonb(promotion_functions)),'[]'::jsonb) FROM promotion_functions),
 'product_trigger_taxonomy_assignment_insert_count',(SELECT count(*) FROM taxonomy_triggers
  WHERE relname='products' AND proname ILIKE '%taxonomy%'),
 'candidate_shadow_sync_trigger_count',(SELECT count(*) FROM taxonomy_triggers
  WHERE relname='product_candidates' AND proname='sync_product_candidate_catalog_taxonomy_classification_v1'),
 'provenance_boundary','EXACT_CREATE_AND_ACL_NOT_ESTABLISHED_BY_SAVED_LEDGER__REGEX_NOT_SQL_PARSER',
 'taxonomy_policy_authorized',false,
 'whole_history_replay_attested',false
) AS readonly_audit;
