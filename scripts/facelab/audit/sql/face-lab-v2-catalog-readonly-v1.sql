-- READ-ONLY FACE LAB catalog probe. Requires externally verified deployment DB identity.
-- Only catalog metadata is selected, never application rows or secrets.
-- Observed schema never proves the original migration SQL was executed.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '3s';
SET LOCAL lock_timeout = '500ms';

WITH
table_targets(table_name) AS (
  VALUES ('saved_reports'), ('analysis_request_rate_windows'), ('analysis_request_idempotency')
),
tables AS (
  SELECT t.table_name,c.oid AS relation_id,c.relrowsecurity AS rls_enabled,
    c.relforcerowsecurity AS rls_forced,c.relkind,
    CASE WHEN c.oid IS NULL THEN NULL ELSE jsonb_build_object(
      'anon',jsonb_build_object(
        'select',has_table_privilege('anon',c.oid,'SELECT'),
        'insert',has_table_privilege('anon',c.oid,'INSERT'),
        'update',has_table_privilege('anon',c.oid,'UPDATE'),
        'delete',has_table_privilege('anon',c.oid,'DELETE')),
      'authenticated',jsonb_build_object(
        'select',has_table_privilege('authenticated',c.oid,'SELECT'),
        'insert',has_table_privilege('authenticated',c.oid,'INSERT'),
        'update',has_table_privilege('authenticated',c.oid,'UPDATE'),
        'delete',has_table_privilege('authenticated',c.oid,'DELETE')),
      'service_role',jsonb_build_object(
        'select',has_table_privilege('service_role',c.oid,'SELECT'),
        'insert',has_table_privilege('service_role',c.oid,'INSERT'),
        'update',has_table_privilege('service_role',c.oid,'UPDATE'),
        'delete',has_table_privilege('service_role',c.oid,'DELETE'))
    ) END AS effective_privileges
  FROM table_targets t
  LEFT JOIN pg_catalog.pg_namespace n ON n.nspname='public'
  LEFT JOIN pg_catalog.pg_class c
    ON c.relnamespace=n.oid AND c.relname=t.table_name
),
column_targets(table_name,column_name) AS (
  VALUES ('saved_reports','face_lab_revision'),
    ('analysis_request_rate_windows','endpoint'),
    ('analysis_request_idempotency','endpoint')
),
columns AS (
  SELECT x.table_name,x.column_name,a.attnum IS NOT NULL AS exists,
    CASE WHEN a.attnum IS NULL THEN NULL
      ELSE pg_catalog.format_type(a.atttypid,a.atttypmod) END AS data_type,
    a.attnotnull AS not_null,
    CASE WHEN d.oid IS NULL THEN NULL
      ELSE pg_catalog.pg_get_expr(d.adbin,d.adrelid) END AS default_expression
  FROM column_targets x LEFT JOIN tables t ON t.table_name=x.table_name
  LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid=t.relation_id
    AND a.attname=x.column_name AND a.attnum>0 AND NOT a.attisdropped
  LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=t.relation_id AND d.adnum=a.attnum
),
constraint_targets(table_name,constraint_name) AS (
  VALUES
    ('saved_reports','saved_reports_face_lab_revision_nonnegative'),
    ('analysis_request_rate_windows','analysis_request_rate_windows_endpoint_check'),
    ('analysis_request_idempotency','analysis_request_idempotency_endpoint_check')
),
constraints AS (
  SELECT x.table_name,x.constraint_name,k.oid IS NOT NULL AS exists,
    k.contype AS constraint_type,
    CASE WHEN k.oid IS NULL THEN NULL
      ELSE pg_catalog.pg_get_constraintdef(k.oid,true) END AS definition,
    k.convalidated AS validated
  FROM constraint_targets x LEFT JOIN tables t ON t.table_name=x.table_name
  LEFT JOIN pg_catalog.pg_constraint k
    ON k.conrelid=t.relation_id AND k.conname=x.constraint_name
),
routine_targets(routine_name,signature) AS (
  VALUES
    ('consume_analysis_rate_limits','public.consume_analysis_rate_limits(jsonb)'),
    ('refund_analysis_rate_limits','public.refund_analysis_rate_limits(jsonb)'),
    ('claim_analysis_idempotency',
     'public.claim_analysis_idempotency(text,text,text,text,text,timestamptz,integer)')
),
routines AS (
  SELECT x.routine_name,x.signature,p.oid IS NOT NULL AS exists,
    p.prosecdef AS security_definer,p.provolatile AS volatility,
    CASE WHEN p.oid IS NULL THEN NULL ELSE
      pg_catalog.encode(pg_catalog.sha256(
        pg_catalog.convert_to(pg_catalog.pg_get_functiondef(p.oid),'UTF8')),'hex')
    END AS definition_sha256,
    CASE WHEN p.oid IS NULL THEN NULL ELSE jsonb_build_object(
      'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'),
      'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE'),
      'service_role_execute',has_function_privilege('service_role',p.oid,'EXECUTE'))
    END AS effective_privileges
  FROM routine_targets x LEFT JOIN pg_catalog.pg_proc p
    ON p.oid=pg_catalog.to_regprocedure(x.signature)
)
SELECT pg_catalog.jsonb_build_object(
  'kind','face_lab_v2_catalog_metadata_readonly_v1',
  'production_project_identity_verified',false,
  'sql_application_verified',false,
  'production_readiness','HOLD',
  'table_metadata',(
    SELECT jsonb_agg(jsonb_build_object(
      'name',table_name,'exists',relation_id IS NOT NULL,'relkind',relkind,
      'rls_enabled',rls_enabled,'rls_forced',rls_forced,
      'effective_privileges',effective_privileges) ORDER BY table_name) FROM tables),
  'column_metadata',(
    SELECT jsonb_agg(jsonb_build_object(
      'table',table_name,'name',column_name,'exists',exists,
      'data_type',data_type,'not_null',not_null,
      'default_expression',default_expression) ORDER BY table_name,column_name)
    FROM columns),
  'constraint_metadata',(
    SELECT jsonb_agg(jsonb_build_object(
      'table',table_name,'name',constraint_name,'exists',exists,
      'constraint_type',constraint_type,'definition',definition,
      'validated',validated) ORDER BY table_name,constraint_name)
    FROM constraints),
  'routine_metadata',(
    SELECT jsonb_agg(jsonb_build_object(
      'name',routine_name,'signature',signature,'exists',exists,
      'security_definer',security_definer,'volatility',volatility,
      'definition_sha256',definition_sha256,
      'effective_privileges',effective_privileges) ORDER BY routine_name)
    FROM routines)
) AS face_lab_metadata_json;
COMMIT;
