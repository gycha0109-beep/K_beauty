begin;

do $$
declare
  v_runtime record;
begin
  select rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls, rolinherit
    into v_runtime
  from pg_roles
  where rolname = 'recommendation_admission_runtime';

  if not found then
    raise exception 'G3A_RUNTIME_ROLE_BOOTSTRAP_REQUIRED';
  end if;

  if v_runtime.rolcanlogin is not true
     or v_runtime.rolsuper is true
     or v_runtime.rolcreatedb is true
     or v_runtime.rolcreaterole is true
     or v_runtime.rolreplication is true
     or v_runtime.rolbypassrls is true
     or v_runtime.rolinherit is true then
    raise exception 'G3A_RUNTIME_ROLE_ATTRIBUTES_INVALID';
  end if;

  if exists (
    select 1
    from pg_auth_members m
    join pg_roles r on r.oid = m.member
    where r.rolname = 'recommendation_admission_runtime'
  ) then
    raise exception 'G3A_RUNTIME_ROLE_MEMBERSHIP_FORBIDDEN';
  end if;

  if not exists (
    select 1 from pg_roles where rolname = 'recommendation_admission_reader_owner'
  ) then
    create role recommendation_admission_reader_owner
      nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  else
    alter role recommendation_admission_reader_owner
      nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  end if;
end
$$;

grant usage on schema public to recommendation_admission_runtime;
grant usage on schema public to recommendation_admission_reader_owner;

revoke all privileges on public.products from recommendation_admission_runtime;
revoke all privileges on public.product_fact_subjects from recommendation_admission_runtime;
revoke all privileges on public.product_fact_current from recommendation_admission_runtime;
revoke all privileges on public.product_fact_instances from recommendation_admission_runtime;
revoke all privileges on public.product_fact_registry_versions from recommendation_admission_runtime;
revoke all privileges on public.product_fact_confirmations from recommendation_admission_runtime;
revoke all privileges on public.product_fact_evidence_links from recommendation_admission_runtime;
revoke all privileges on public.product_fact_review_assignments from recommendation_admission_runtime;
revoke all privileges on public.product_fact_review_events from recommendation_admission_runtime;

revoke all privileges on public.products from recommendation_admission_reader_owner;
revoke all privileges on public.product_fact_subjects from recommendation_admission_reader_owner;
revoke all privileges on public.product_fact_current from recommendation_admission_reader_owner;
revoke all privileges on public.product_fact_instances from recommendation_admission_reader_owner;
revoke all privileges on public.product_fact_registry_versions from recommendation_admission_reader_owner;
revoke all privileges on public.product_fact_confirmations from recommendation_admission_reader_owner;

grant select (id, category)
  on public.products
  to recommendation_admission_reader_owner;

grant select (
  subject_id,
  product_id,
  subject_identity_serializer_version,
  identity_status,
  identity_resolution_version,
  current_state,
  valid_from,
  valid_to
) on public.product_fact_subjects
  to recommendation_admission_reader_owner;

grant select (
  proposition_key,
  fact_instance_id,
  subject_id,
  confirmation_id
) on public.product_fact_current
  to recommendation_admission_reader_owner;

grant select (
  fact_instance_id,
  subject_id,
  registry_version,
  fact_key,
  proposition_key,
  proposition_serializer_version,
  semantic_status,
  value_type,
  value_boolean,
  value_enum,
  value_number,
  value_unit,
  value_range_min,
  value_range_max,
  value_entity_identifier,
  parent_proposition_key,
  parent_fact_instance_id,
  authority_ceiling,
  fused_confidence,
  valid_from,
  valid_to
) on public.product_fact_instances
  to recommendation_admission_reader_owner;

grant select (
  registry_version,
  registry_checksum,
  identity_serializer_version
) on public.product_fact_registry_versions
  to recommendation_admission_reader_owner;

grant select (confirmation_id)
  on public.product_fact_confirmations
  to recommendation_admission_reader_owner;

drop policy if exists g3a_admission_reader_products_select_v1 on public.products;
create policy g3a_admission_reader_products_select_v1
  on public.products for select to recommendation_admission_reader_owner using (true);

drop policy if exists g3a_admission_reader_subjects_select_v1 on public.product_fact_subjects;
create policy g3a_admission_reader_subjects_select_v1
  on public.product_fact_subjects for select to recommendation_admission_reader_owner using (true);

drop policy if exists g3a_admission_reader_current_select_v1 on public.product_fact_current;
create policy g3a_admission_reader_current_select_v1
  on public.product_fact_current for select to recommendation_admission_reader_owner using (true);

drop policy if exists g3a_admission_reader_instances_select_v1 on public.product_fact_instances;
create policy g3a_admission_reader_instances_select_v1
  on public.product_fact_instances for select to recommendation_admission_reader_owner using (true);

drop policy if exists g3a_admission_reader_registry_select_v1 on public.product_fact_registry_versions;
create policy g3a_admission_reader_registry_select_v1
  on public.product_fact_registry_versions for select to recommendation_admission_reader_owner using (true);

drop policy if exists g3a_admission_reader_confirmations_select_v1 on public.product_fact_confirmations;
create policy g3a_admission_reader_confirmations_select_v1
  on public.product_fact_confirmations for select to recommendation_admission_reader_owner using (true);

create or replace function public.read_recommendation_admission_authority_v1(
  p_product_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_product_count integer;
  v_subject_count integer;
  v_registry_count integer;
  v_registry_row_count integer;
  v_contains_active_count integer;
  v_registry_version text;
  v_product jsonb;
  v_subject jsonb;
  v_registry jsonb;
  v_facts jsonb;
begin
  if p_product_id is null then
    return jsonb_build_object(
      'read_contract_version', 'recommendation-admission-authority-read-v1',
      'status', 'NO_AUTHORITY',
      'reason', 'PRODUCT_ID_REQUIRED'
    );
  end if;

  select count(p.id)::integer
    into v_product_count
  from public.products p
  where p.id = p_product_id;

  if v_product_count <> 1 then
    return jsonb_build_object(
      'read_contract_version', 'recommendation-admission-authority-read-v1',
      'status', 'NO_AUTHORITY',
      'reason', 'CANONICAL_PRODUCT_NOT_FOUND'
    );
  end if;

  select jsonb_build_object(
      'product_id', p.id,
      'category', p.category::text
    )
    into v_product
  from public.products p
  where p.id = p_product_id;

  select count(s.subject_id)::integer
    into v_subject_count
  from public.product_fact_subjects s
  where s.product_id = p_product_id
    and s.current_state = 'current';

  if v_subject_count <> 1 then
    return jsonb_build_object(
      'read_contract_version', 'recommendation-admission-authority-read-v1',
      'status', 'NO_AUTHORITY',
      'reason', case when v_subject_count = 0 then 'CURRENT_SUBJECT_MISSING' else 'CURRENT_SUBJECT_AMBIGUOUS' end
    );
  end if;

  select jsonb_build_object(
      'subject_id', s.subject_id,
      'product_id', s.product_id,
      'subject_identity_serializer_version', s.subject_identity_serializer_version,
      'identity_status', s.identity_status,
      'identity_resolution_version', s.identity_resolution_version,
      'current_state', s.current_state,
      'valid_from', s.valid_from,
      'valid_to', s.valid_to
    )
    into v_subject
  from public.product_fact_subjects s
  where s.product_id = p_product_id
    and s.current_state = 'current';

  if coalesce(v_subject ->> 'identity_status', '') <> 'resolved'
     or ((v_subject ->> 'valid_from') is not null and (v_subject ->> 'valid_from')::date > current_date)
     or ((v_subject ->> 'valid_to') is not null and (v_subject ->> 'valid_to')::date <= current_date) then
    return jsonb_build_object(
      'read_contract_version', 'recommendation-admission-authority-read-v1',
      'status', 'NO_AUTHORITY',
      'reason', 'CURRENT_SUBJECT_NOT_USABLE'
    );
  end if;

  select count(c.proposition_key)::integer
    into v_contains_active_count
  from public.product_fact_current c
  join public.product_fact_instances i
    on i.fact_instance_id = c.fact_instance_id
   and i.proposition_key = c.proposition_key
   and i.subject_id = c.subject_id
  join public.product_fact_confirmations cf
    on cf.confirmation_id = c.confirmation_id
  where c.subject_id = (v_subject ->> 'subject_id')::uuid
    and i.fact_key = 'contains_active';

  if v_contains_active_count = 0 then
    return jsonb_build_object(
      'read_contract_version', 'recommendation-admission-authority-read-v1',
      'status', 'NO_AUTHORITY',
      'reason', 'REQUIRED_CURRENT_FACT_MISSING:contains_active'
    );
  end if;

  if exists (
    select 1
    from public.product_fact_current c
    join public.product_fact_instances i
      on i.fact_instance_id = c.fact_instance_id
     and i.proposition_key = c.proposition_key
     and i.subject_id = c.subject_id
    join public.product_fact_confirmations cf
      on cf.confirmation_id = c.confirmation_id
    where c.subject_id = (v_subject ->> 'subject_id')::uuid
      and i.fact_key in (
        'contains_active',
        'active_concentration',
        'recommended_use_frequency',
        'product_format',
        'wipe_off_use',
        'pad_surface_texture'
      )
      and (
        (i.valid_from is not null and i.valid_from > current_date)
        or (i.valid_to is not null and i.valid_to <= current_date)
      )
  ) then
    return jsonb_build_object(
      'read_contract_version', 'recommendation-admission-authority-read-v1',
      'status', 'NO_AUTHORITY',
      'reason', 'CURRENT_FACT_STALE_OR_NOT_YET_VALID'
    );
  end if;

  select count(distinct i.registry_version)::integer,
         min(i.registry_version)
    into v_registry_count, v_registry_version
  from public.product_fact_current c
  join public.product_fact_instances i
    on i.fact_instance_id = c.fact_instance_id
   and i.proposition_key = c.proposition_key
   and i.subject_id = c.subject_id
  join public.product_fact_confirmations cf
    on cf.confirmation_id = c.confirmation_id
  where c.subject_id = (v_subject ->> 'subject_id')::uuid
    and i.fact_key in (
      'contains_active',
      'active_concentration',
      'recommended_use_frequency',
      'product_format',
      'wipe_off_use',
      'pad_surface_texture'
    );

  if v_registry_count <> 1 then
    return jsonb_build_object(
      'read_contract_version', 'recommendation-admission-authority-read-v1',
      'status', 'NO_AUTHORITY',
      'reason', 'CURRENT_FACT_REGISTRY_AMBIGUOUS'
    );
  end if;

  select count(rv.registry_version)::integer
    into v_registry_row_count
  from public.product_fact_registry_versions rv
  where rv.registry_version = v_registry_version;

  if v_registry_row_count <> 1 then
    return jsonb_build_object(
      'read_contract_version', 'recommendation-admission-authority-read-v1',
      'status', 'NO_AUTHORITY',
      'reason', 'REGISTRY_LINEAGE_UNRESOLVED'
    );
  end if;

  select jsonb_build_object(
      'registry_version', rv.registry_version,
      'registry_checksum', rv.registry_checksum,
      'identity_serializer_version', rv.identity_serializer_version
    )
    into v_registry
  from public.product_fact_registry_versions rv
  where rv.registry_version = v_registry_version;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'proposition_key', i.proposition_key,
        'fact_instance_id', i.fact_instance_id,
        'subject_id', i.subject_id,
        'confirmation_id', c.confirmation_id,
        'fact_key', i.fact_key,
        'registry_version', i.registry_version,
        'proposition_serializer_version', i.proposition_serializer_version,
        'semantic_status', i.semantic_status,
        'value_type', i.value_type,
        'value_boolean', i.value_boolean,
        'value_enum', i.value_enum,
        'value_number', i.value_number,
        'value_unit', i.value_unit,
        'value_range_min', i.value_range_min,
        'value_range_max', i.value_range_max,
        'value_entity_identifier', i.value_entity_identifier,
        'parent_proposition_key', i.parent_proposition_key,
        'parent_fact_instance_id', i.parent_fact_instance_id,
        'authority_ceiling', i.authority_ceiling,
        'fused_confidence', i.fused_confidence,
        'valid_from', i.valid_from,
        'valid_to', i.valid_to
      )
      order by i.fact_key, i.proposition_key, i.fact_instance_id
    ),
    '[]'::jsonb
  )
    into v_facts
  from public.product_fact_current c
  join public.product_fact_instances i
    on i.fact_instance_id = c.fact_instance_id
   and i.proposition_key = c.proposition_key
   and i.subject_id = c.subject_id
  join public.product_fact_confirmations cf
    on cf.confirmation_id = c.confirmation_id
  where c.subject_id = (v_subject ->> 'subject_id')::uuid
    and i.fact_key in (
      'contains_active',
      'active_concentration',
      'recommended_use_frequency',
      'product_format',
      'wipe_off_use',
      'pad_surface_texture'
    );

  return jsonb_build_object(
    'read_contract_version', 'recommendation-admission-authority-read-v1',
    'status', 'AUTHORITY_RESOLVED',
    'product', v_product,
    'subject', v_subject,
    'registry', v_registry,
    'current_facts', v_facts
  );
end;
$$;

comment on function public.read_recommendation_admission_authority_v1(uuid) is
  'V2.1-ADMISSION-G3A protected, product-scoped Product Fact authority transport. Minimal current lineage only; no admission decision, evidence body, reviewer/admin data, or writes.';

revoke all on function public.read_recommendation_admission_authority_v1(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.read_recommendation_admission_authority_v1(uuid)
  to recommendation_admission_runtime;

-- Managed Supabase postgres is not superuser. Temporarily grant SET-role capability
-- only inside this transaction so function ownership can be transferred to the
-- narrow NOLOGIN role; the explicit grant is revoked before commit.
grant create on schema public to recommendation_admission_reader_owner;
grant recommendation_admission_reader_owner to postgres;
alter function public.read_recommendation_admission_authority_v1(uuid)
  owner to recommendation_admission_reader_owner;
revoke recommendation_admission_reader_owner from postgres;
revoke create on schema public from recommendation_admission_reader_owner;

do $$
begin
  if has_schema_privilege('recommendation_admission_reader_owner', 'public', 'CREATE') then
    raise exception 'G3A_OWNER_SCHEMA_CREATE_FORBIDDEN';
  end if;
  if has_table_privilege('recommendation_admission_runtime', 'public.product_fact_subjects', 'SELECT')
     or has_table_privilege('recommendation_admission_runtime', 'public.product_fact_current', 'SELECT')
     or has_table_privilege('recommendation_admission_runtime', 'public.product_fact_instances', 'SELECT')
     or has_table_privilege('recommendation_admission_runtime', 'public.product_fact_registry_versions', 'SELECT')
     or has_table_privilege('recommendation_admission_runtime', 'public.product_fact_confirmations', 'SELECT') then
    raise exception 'G3A_RUNTIME_RAW_PF_SELECT_FORBIDDEN';
  end if;
  if not has_function_privilege(
    'recommendation_admission_runtime',
    'public.read_recommendation_admission_authority_v1(uuid)',
    'EXECUTE'
  ) then
    raise exception 'G3A_RUNTIME_RPC_EXECUTE_REQUIRED';
  end if;
end
$$;

commit;
