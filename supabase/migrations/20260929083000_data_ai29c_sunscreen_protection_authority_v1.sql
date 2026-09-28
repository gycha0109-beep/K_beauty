begin;

do $$
declare
  v_runtime record;
begin
  if not exists (
    select 1 from pg_roles where rolname = 'recommendation_protection_runtime'
  ) then
    create role recommendation_protection_runtime
      login noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  end if;

  select rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls, rolinherit
    into v_runtime
  from pg_roles
  where rolname = 'recommendation_protection_runtime';

  if v_runtime.rolcanlogin is not true
     or v_runtime.rolsuper is true
     or v_runtime.rolcreatedb is true
     or v_runtime.rolcreaterole is true
     or v_runtime.rolreplication is true
     or v_runtime.rolbypassrls is true
     or v_runtime.rolinherit is true then
    raise exception 'DATA_AI29C_RUNTIME_ROLE_ATTRIBUTES_INVALID';
  end if;

  if exists (
    select 1
    from pg_auth_members m
    join pg_roles r on r.oid = m.member
    where r.rolname = 'recommendation_protection_runtime'
  ) then
    raise exception 'DATA_AI29C_RUNTIME_ROLE_MEMBERSHIP_FORBIDDEN';
  end if;

  if not exists (
    select 1 from pg_roles where rolname = 'recommendation_protection_reader_owner'
  ) then
    create role recommendation_protection_reader_owner
      nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  else
    alter role recommendation_protection_reader_owner
      nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  end if;
end
$$;

grant usage on schema public to recommendation_protection_runtime;
grant usage on schema public to recommendation_protection_reader_owner;

revoke all privileges on public.products from recommendation_protection_runtime;
revoke all privileges on public.product_fact_subjects from recommendation_protection_runtime;
revoke all privileges on public.product_fact_current from recommendation_protection_runtime;
revoke all privileges on public.product_fact_instances from recommendation_protection_runtime;
revoke all privileges on public.product_fact_registry_versions from recommendation_protection_runtime;
revoke all privileges on public.product_fact_confirmations from recommendation_protection_runtime;
revoke all privileges on public.product_fact_evidence_links from recommendation_protection_runtime;
revoke all privileges on public.product_evidence_records from recommendation_protection_runtime;
revoke all privileges on public.product_fact_review_assignments from recommendation_protection_runtime;
revoke all privileges on public.product_fact_review_events from recommendation_protection_runtime;

revoke all privileges on public.products from recommendation_protection_reader_owner;
revoke all privileges on public.product_fact_subjects from recommendation_protection_reader_owner;
revoke all privileges on public.product_fact_current from recommendation_protection_reader_owner;
revoke all privileges on public.product_fact_instances from recommendation_protection_reader_owner;
revoke all privileges on public.product_fact_registry_versions from recommendation_protection_reader_owner;
revoke all privileges on public.product_fact_confirmations from recommendation_protection_reader_owner;

grant select (id, category)
  on public.products
  to recommendation_protection_reader_owner;

grant select (
  subject_id,
  product_id,
  subject_identity_serializer_version,
  identity_status,
  identity_resolution_version,
  current_state,
  market_applicability,
  region_applicability,
  valid_from,
  valid_to
) on public.product_fact_subjects
  to recommendation_protection_reader_owner;

grant select (
  proposition_key,
  fact_instance_id,
  subject_id,
  confirmation_id
) on public.product_fact_current
  to recommendation_protection_reader_owner;

grant select (
  fact_instance_id,
  subject_id,
  registry_version,
  fact_key,
  proposition_key,
  proposition_serializer_version,
  semantic_status,
  value_type,
  value_number,
  value_unit,
  value_enum,
  market,
  region,
  locale,
  qualifier,
  authority_ceiling,
  fused_confidence,
  valid_from,
  valid_to
) on public.product_fact_instances
  to recommendation_protection_reader_owner;

grant select (
  registry_version,
  registry_checksum,
  identity_serializer_version
) on public.product_fact_registry_versions
  to recommendation_protection_reader_owner;

grant select (confirmation_id)
  on public.product_fact_confirmations
  to recommendation_protection_reader_owner;

drop policy if exists data_ai29c_protection_reader_products_select_v1 on public.products;
create policy data_ai29c_protection_reader_products_select_v1
  on public.products for select to recommendation_protection_reader_owner using (true);

drop policy if exists data_ai29c_protection_reader_subjects_select_v1 on public.product_fact_subjects;
create policy data_ai29c_protection_reader_subjects_select_v1
  on public.product_fact_subjects for select to recommendation_protection_reader_owner using (true);

drop policy if exists data_ai29c_protection_reader_current_select_v1 on public.product_fact_current;
create policy data_ai29c_protection_reader_current_select_v1
  on public.product_fact_current for select to recommendation_protection_reader_owner using (true);

drop policy if exists data_ai29c_protection_reader_instances_select_v1 on public.product_fact_instances;
create policy data_ai29c_protection_reader_instances_select_v1
  on public.product_fact_instances for select to recommendation_protection_reader_owner using (true);

drop policy if exists data_ai29c_protection_reader_registry_select_v1 on public.product_fact_registry_versions;
create policy data_ai29c_protection_reader_registry_select_v1
  on public.product_fact_registry_versions for select to recommendation_protection_reader_owner using (true);

drop policy if exists data_ai29c_protection_reader_confirmations_select_v1 on public.product_fact_confirmations;
create policy data_ai29c_protection_reader_confirmations_select_v1
  on public.product_fact_confirmations for select to recommendation_protection_reader_owner using (true);

create or replace function public.read_recommendation_sunscreen_protection_authority_v1(
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
  v_fact_count integer;
  v_duplicate_fact_key_count integer;
  v_registry_count integer;
  v_registry_row_count integer;
  v_registry_version text;
  v_product jsonb;
  v_subject jsonb;
  v_registry jsonb;
  v_facts jsonb;
begin
  if p_product_id is null then
    return jsonb_build_object(
      'read_contract_version', 'recommendation-sunscreen-protection-authority-read-v1',
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
      'read_contract_version', 'recommendation-sunscreen-protection-authority-read-v1',
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

  if coalesce(v_product ->> 'category', '') <> 'sunscreen' then
    return jsonb_build_object(
      'read_contract_version', 'recommendation-sunscreen-protection-authority-read-v1',
      'status', 'NO_AUTHORITY',
      'reason', 'PRODUCT_NOT_SUNSCREEN'
    );
  end if;

  select count(s.subject_id)::integer
    into v_subject_count
  from public.product_fact_subjects s
  where s.product_id = p_product_id
    and s.current_state = 'current';

  if v_subject_count <> 1 then
    return jsonb_build_object(
      'read_contract_version', 'recommendation-sunscreen-protection-authority-read-v1',
      'status', 'NO_AUTHORITY',
      'reason', case
        when v_subject_count = 0 then 'CURRENT_SUBJECT_MISSING'
        else 'CURRENT_SUBJECT_AMBIGUOUS'
      end
    );
  end if;

  select jsonb_build_object(
      'subject_id', s.subject_id,
      'product_id', s.product_id,
      'subject_identity_serializer_version', s.subject_identity_serializer_version,
      'identity_status', s.identity_status,
      'identity_resolution_version', s.identity_resolution_version,
      'current_state', s.current_state,
      'market_applicability', s.market_applicability,
      'region_applicability', s.region_applicability,
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
      'read_contract_version', 'recommendation-sunscreen-protection-authority-read-v1',
      'status', 'NO_AUTHORITY',
      'reason', 'CURRENT_SUBJECT_NOT_USABLE'
    );
  end if;

  select count(*)::integer
    into v_fact_count
  from public.product_fact_current c
  join public.product_fact_instances i
    on i.fact_instance_id = c.fact_instance_id
   and i.proposition_key = c.proposition_key
   and i.subject_id = c.subject_id
  join public.product_fact_confirmations cf
    on cf.confirmation_id = c.confirmation_id
  where c.subject_id = (v_subject ->> 'subject_id')::uuid
    and i.fact_key in (
      'spf_value',
      'uva_label',
      'water_resistance_duration'
    );

  if v_fact_count = 0 then
    return jsonb_build_object(
      'read_contract_version', 'recommendation-sunscreen-protection-authority-read-v1',
      'status', 'NO_AUTHORITY',
      'reason', 'CURRENT_PROTECTION_FACT_MISSING'
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
        'spf_value',
        'uva_label',
        'water_resistance_duration'
      )
      and (
        (i.valid_from is not null and i.valid_from > current_date)
        or (i.valid_to is not null and i.valid_to <= current_date)
      )
  ) then
    return jsonb_build_object(
      'read_contract_version', 'recommendation-sunscreen-protection-authority-read-v1',
      'status', 'NO_AUTHORITY',
      'reason', 'CURRENT_PROTECTION_FACT_STALE_OR_NOT_YET_VALID'
    );
  end if;

  select count(*)::integer
    into v_duplicate_fact_key_count
  from (
    select i.fact_key
    from public.product_fact_current c
    join public.product_fact_instances i
      on i.fact_instance_id = c.fact_instance_id
     and i.proposition_key = c.proposition_key
     and i.subject_id = c.subject_id
    join public.product_fact_confirmations cf
      on cf.confirmation_id = c.confirmation_id
    where c.subject_id = (v_subject ->> 'subject_id')::uuid
      and i.fact_key in (
        'spf_value',
        'uva_label',
        'water_resistance_duration'
      )
    group by i.fact_key
    having count(*) > 1
  ) duplicate_keys;

  if v_duplicate_fact_key_count > 0 then
    return jsonb_build_object(
      'read_contract_version', 'recommendation-sunscreen-protection-authority-read-v1',
      'status', 'NO_AUTHORITY',
      'reason', 'CURRENT_PROTECTION_FACT_KEY_AMBIGUOUS'
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
      'spf_value',
      'uva_label',
      'water_resistance_duration'
    );

  if v_registry_count <> 1 then
    return jsonb_build_object(
      'read_contract_version', 'recommendation-sunscreen-protection-authority-read-v1',
      'status', 'NO_AUTHORITY',
      'reason', 'CURRENT_PROTECTION_FACT_REGISTRY_AMBIGUOUS'
    );
  end if;

  select count(rv.registry_version)::integer
    into v_registry_row_count
  from public.product_fact_registry_versions rv
  where rv.registry_version = v_registry_version;

  if v_registry_row_count <> 1 then
    return jsonb_build_object(
      'read_contract_version', 'recommendation-sunscreen-protection-authority-read-v1',
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
        'value_number', i.value_number,
        'value_unit', i.value_unit,
        'value_enum', i.value_enum,
        'market', i.market,
        'region', i.region,
        'locale', i.locale,
        'qualifier', i.qualifier,
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
      'spf_value',
      'uva_label',
      'water_resistance_duration'
    );

  return jsonb_build_object(
    'read_contract_version', 'recommendation-sunscreen-protection-authority-read-v1',
    'status', 'AUTHORITY_RESOLVED',
    'product', v_product,
    'subject', v_subject,
    'registry', v_registry,
    'current_facts', v_facts
  );
end;
$$;

comment on function public.read_recommendation_sunscreen_protection_authority_v1(uuid) is
  'DATA-AI29C-A protected Product Fact transport for sunscreen SPF, UVA, and water-resistance authority only. No recommendation score, evidence body, admin/reviewer data, or writes.';

revoke all on function public.read_recommendation_sunscreen_protection_authority_v1(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.read_recommendation_sunscreen_protection_authority_v1(uuid)
  to recommendation_protection_runtime;

grant create on schema public to recommendation_protection_reader_owner;
grant recommendation_protection_reader_owner to postgres;
alter function public.read_recommendation_sunscreen_protection_authority_v1(uuid)
  owner to recommendation_protection_reader_owner;
revoke recommendation_protection_reader_owner from postgres;
revoke create on schema public from recommendation_protection_reader_owner;

do $$
begin
  if has_schema_privilege(
    'recommendation_protection_reader_owner',
    'public',
    'CREATE'
  ) then
    raise exception 'DATA_AI29C_OWNER_SCHEMA_CREATE_FORBIDDEN';
  end if;

  if has_table_privilege(
      'recommendation_protection_runtime',
      'public.product_fact_subjects',
      'SELECT'
    )
    or has_table_privilege(
      'recommendation_protection_runtime',
      'public.product_fact_current',
      'SELECT'
    )
    or has_table_privilege(
      'recommendation_protection_runtime',
      'public.product_fact_instances',
      'SELECT'
    )
    or has_table_privilege(
      'recommendation_protection_runtime',
      'public.product_fact_registry_versions',
      'SELECT'
    )
    or has_table_privilege(
      'recommendation_protection_runtime',
      'public.product_fact_confirmations',
      'SELECT'
    )
    or has_table_privilege(
      'recommendation_protection_runtime',
      'public.product_evidence_records',
      'SELECT'
    ) then
    raise exception 'DATA_AI29C_RUNTIME_RAW_PF_SELECT_FORBIDDEN';
  end if;

  if not has_function_privilege(
    'recommendation_protection_runtime',
    'public.read_recommendation_sunscreen_protection_authority_v1(uuid)',
    'EXECUTE'
  ) then
    raise exception 'DATA_AI29C_RUNTIME_RPC_EXECUTE_REQUIRED';
  end if;
end
$$;

commit;
