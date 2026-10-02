begin;

-- V2.1-8G1 / identity-authority-preserving catalog trust orchestration.
-- This wrapper keeps the 8G0 explicit Registry pin and preserves the controlled
-- official-source identity authority across resolve_catalog_trust_subject_v1(),
-- which otherwise replaces identity_resolution_detail.

do $$
begin
  if to_regprocedure('public.process_catalog_trust_product_v2(uuid,text)') is null
    or to_regclass('public.catalog_trust_intake') is null
  then
    raise exception 'v21_8g1_identity_authority_preservation_prerequisite_missing';
  end if;
end $$;

create or replace function public.process_catalog_trust_product_v3(
  p_product_id uuid,
  p_registry_version text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
  v_row record;
  v_preserved integer := 0;
begin
  create temporary table if not exists pg_temp.v21_8g1_identity_authority_snapshot (
    intake_id uuid primary key,
    authority jsonb not null
  ) on commit drop;

  truncate table pg_temp.v21_8g1_identity_authority_snapshot;

  insert into pg_temp.v21_8g1_identity_authority_snapshot(intake_id, authority)
  select
    i.id,
    jsonb_build_object(
      'authority_kind', i.identity_resolution_detail ->> 'authority_kind',
      'official_source_locator', i.identity_resolution_detail ->> 'official_source_locator',
      'source_content_digest', i.identity_resolution_detail ->> 'source_content_digest',
      'resolution_reason', i.identity_resolution_detail ->> 'resolution_reason',
      'market', i.identity_resolution_detail ->> 'market',
      'authority_resolution_version', i.identity_resolution_version
    )
  from public.catalog_trust_intake i
  where i.product_id = p_product_id
    and i.identity_resolution_detail ->> 'authority_kind' = 'admin_identity_authority'
    and coalesce(i.identity_resolution_detail ->> 'official_source_locator','') <> ''
    and coalesce(i.identity_resolution_detail ->> 'source_content_digest','') ~ '^[0-9a-f]{64}$';

  v_result := public.process_catalog_trust_product_v2(
    p_product_id,
    p_registry_version
  );

  for v_row in
    select * from pg_temp.v21_8g1_identity_authority_snapshot
  loop
    update public.catalog_trust_intake
    set identity_resolution_detail =
          coalesce(identity_resolution_detail,'{}'::jsonb)
          || jsonb_build_object('identity_authority', v_row.authority),
        updated_at = now()
    where id = v_row.intake_id;

    if found then
      v_preserved := v_preserved + 1;
    end if;
  end loop;

  return v_result || jsonb_build_object(
    'orchestrator_version','v21-8g1-identity-authority-preserving-v1',
    'identity_authority_preserved',v_preserved
  );
end;
$$;

revoke all on function public.process_catalog_trust_product_v3(uuid,text)
  from public, anon, authenticated, service_role;
grant execute on function public.process_catalog_trust_product_v3(uuid,text)
  to service_role;

comment on function public.process_catalog_trust_product_v3(uuid,text) is
  'V2.1-8G1 service-role wrapper around explicit-registry process_catalog_trust_product_v2. Preserves governed official-source intake identity authority after Subject reconciliation.';

do $$
declare
  v_def text;
begin
  if has_function_privilege(
      'anon',
      'public.process_catalog_trust_product_v3(uuid,text)',
      'EXECUTE'
    )
    or has_function_privilege(
      'authenticated',
      'public.process_catalog_trust_product_v3(uuid,text)',
      'EXECUTE'
    )
    or not has_function_privilege(
      'service_role',
      'public.process_catalog_trust_product_v3(uuid,text)',
      'EXECUTE'
    )
  then
    raise exception 'v21_8g1_process_v3_privilege_invalid';
  end if;

  select pg_get_functiondef(
    'public.process_catalog_trust_product_v3(uuid,text)'::regprocedure
  ) into v_def;

  if position('process_catalog_trust_product_v2' in v_def) = 0
    or position('identity_authority' in v_def) = 0
    or position('official_source_locator' in v_def) = 0
    or position('source_content_digest' in v_def) = 0
  then
    raise exception 'v21_8g1_process_v3_contract_invalid';
  end if;
end $$;

commit;
