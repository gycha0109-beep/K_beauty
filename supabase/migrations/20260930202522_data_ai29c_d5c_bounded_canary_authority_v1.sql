begin;

grant select (brand, name)
  on public.products
  to recommendation_admission_reader_owner;

revoke all privileges on public.product_catalog_taxonomy_assignments
  from recommendation_admission_runtime;
revoke all privileges on public.product_catalog_taxonomy_assignments
  from recommendation_admission_reader_owner;

grant select (
  product_id,
  taxonomy_version,
  entity_kind_term_id,
  domain_term_id,
  recommendation_family_term_id,
  category_term_id,
  assignment_state
) on public.product_catalog_taxonomy_assignments
  to recommendation_admission_reader_owner;

drop policy if exists data_ai29c_d5c_admission_reader_taxonomy_select_v1
  on public.product_catalog_taxonomy_assignments;
create policy data_ai29c_d5c_admission_reader_taxonomy_select_v1
  on public.product_catalog_taxonomy_assignments
  for select
  to recommendation_admission_reader_owner
  using (
    product_id in (
      'a6994fcd-302f-4e63-acbe-91a3f17a5a65'::uuid,
      'b90bf992-07ae-4f49-a3a4-d90ea6d4a858'::uuid,
      '7fc45e7c-38aa-41a1-b1a1-c0e09fcd8c17'::uuid
    )
  );

grant execute on function public.read_sunscreen_recommendation_semantic_bundle_v1(uuid)
  to recommendation_admission_reader_owner;

create or replace function public.read_data_ai29c_d5c_sunscreen_canary_authority_v1(
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
  v_taxonomy_count integer;
  v_fact_count integer;
  v_duplicate_fact_key_count integer;
  v_registry_count integer;
  v_registry_row_count integer;
  v_registry_version text;
  v_product jsonb;
  v_subject jsonb;
  v_taxonomy jsonb;
  v_registry jsonb;
  v_facts jsonb;
  v_semantic_bundle jsonb;
begin
  if p_product_id is null then
    return jsonb_build_object(
      'read_contract_version', 'data-ai29c-d5c-sunscreen-canary-authority-read-v1',
      'status', 'NO_AUTHORITY',
      'reason', 'PRODUCT_ID_REQUIRED'
    );
  end if;

  if p_product_id not in (
    'a6994fcd-302f-4e63-acbe-91a3f17a5a65'::uuid,
    'b90bf992-07ae-4f49-a3a4-d90ea6d4a858'::uuid,
    '7fc45e7c-38aa-41a1-b1a1-c0e09fcd8c17'::uuid
  ) then
    return jsonb_build_object(
      'read_contract_version', 'data-ai29c-d5c-sunscreen-canary-authority-read-v1',
      'status', 'NO_AUTHORITY',
      'reason', 'PRODUCT_NOT_D5C_CANARY_TARGET'
    );
  end if;

  select count(p.id)::integer
    into v_product_count
  from public.products p
  where p.id = p_product_id;

  if v_product_count <> 1 then
    return jsonb_build_object(
      'read_contract_version', 'data-ai29c-d5c-sunscreen-canary-authority-read-v1',
      'status', 'NO_AUTHORITY',
      'reason', 'CANONICAL_PRODUCT_NOT_FOUND'
    );
  end if;

  select jsonb_build_object(
      'id', p.id,
      'brand', p.brand,
      'name', p.name,
      'category', p.category::text
    )
    into v_product
  from public.products p
  where p.id = p_product_id;

  select count(*)::integer
    into v_taxonomy_count
  from public.product_catalog_taxonomy_assignments a
  where a.product_id = p_product_id
    and a.taxonomy_version = 'catalog-taxonomy-v1'
    and a.entity_kind_term_id = 'catalog-taxonomy-v1:entity_kind:cosmetic'
    and a.domain_term_id = 'catalog-taxonomy-v1:domain:skincare'
    and a.recommendation_family_term_id =
      'catalog-taxonomy-v1:recommendation_family:sunscreen'
    and a.category_term_id = 'catalog-taxonomy-v1:category:sunscreen'
    and a.assignment_state = 'shadow';

  if v_taxonomy_count <> 1 then
    return jsonb_build_object(
      'read_contract_version', 'data-ai29c-d5c-sunscreen-canary-authority-read-v1',
      'status', 'NO_AUTHORITY',
      'reason', case
        when v_taxonomy_count = 0 then 'CANONICAL_SUNSCREEN_TAXONOMY_MISSING'
        else 'CANONICAL_SUNSCREEN_TAXONOMY_AMBIGUOUS'
      end
    );
  end if;

  select jsonb_build_object(
      'product_id', a.product_id,
      'taxonomy_version', a.taxonomy_version,
      'entity_kind_term_id', a.entity_kind_term_id,
      'domain_term_id', a.domain_term_id,
      'recommendation_family_term_id', a.recommendation_family_term_id,
      'category_term_id', a.category_term_id,
      'assignment_state', a.assignment_state
    )
    into v_taxonomy
  from public.product_catalog_taxonomy_assignments a
  where a.product_id = p_product_id
    and a.taxonomy_version = 'catalog-taxonomy-v1'
    and a.entity_kind_term_id = 'catalog-taxonomy-v1:entity_kind:cosmetic'
    and a.domain_term_id = 'catalog-taxonomy-v1:domain:skincare'
    and a.recommendation_family_term_id =
      'catalog-taxonomy-v1:recommendation_family:sunscreen'
    and a.category_term_id = 'catalog-taxonomy-v1:category:sunscreen'
    and a.assignment_state = 'shadow';

  select count(s.subject_id)::integer
    into v_subject_count
  from public.product_fact_subjects s
  where s.product_id = p_product_id
    and s.current_state = 'current';

  if v_subject_count <> 1 then
    return jsonb_build_object(
      'read_contract_version', 'data-ai29c-d5c-sunscreen-canary-authority-read-v1',
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
      'valid_from', s.valid_from,
      'valid_to', s.valid_to
    )
    into v_subject
  from public.product_fact_subjects s
  where s.product_id = p_product_id
    and s.current_state = 'current';

  if coalesce(v_subject ->> 'identity_status', '') <> 'resolved'
     or ((v_subject ->> 'valid_from') is not null
       and (v_subject ->> 'valid_from')::date > current_date)
     or ((v_subject ->> 'valid_to') is not null
       and (v_subject ->> 'valid_to')::date <= current_date) then
    return jsonb_build_object(
      'read_contract_version', 'data-ai29c-d5c-sunscreen-canary-authority-read-v1',
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
    and i.fact_key in ('spf_value', 'uva_label', 'uv_filter_type');

  if v_fact_count <> 3 then
    return jsonb_build_object(
      'read_contract_version', 'data-ai29c-d5c-sunscreen-canary-authority-read-v1',
      'status', 'NO_AUTHORITY',
      'reason', 'REQUIRED_CANARY_FACT_SET_INCOMPLETE'
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
      and i.fact_key in ('spf_value', 'uva_label', 'uv_filter_type')
    group by i.fact_key
    having count(*) > 1
  ) duplicate_keys;

  if v_duplicate_fact_key_count > 0 then
    return jsonb_build_object(
      'read_contract_version', 'data-ai29c-d5c-sunscreen-canary-authority-read-v1',
      'status', 'NO_AUTHORITY',
      'reason', 'REQUIRED_CANARY_FACT_KEY_AMBIGUOUS'
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
      and i.fact_key in ('spf_value', 'uva_label', 'uv_filter_type')
      and (
        (i.valid_from is not null and i.valid_from > current_date)
        or (i.valid_to is not null and i.valid_to <= current_date)
      )
  ) then
    return jsonb_build_object(
      'read_contract_version', 'data-ai29c-d5c-sunscreen-canary-authority-read-v1',
      'status', 'NO_AUTHORITY',
      'reason', 'REQUIRED_CANARY_FACT_STALE_OR_NOT_YET_VALID'
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
    and i.fact_key in ('spf_value', 'uva_label', 'uv_filter_type');

  if v_registry_count <> 1 then
    return jsonb_build_object(
      'read_contract_version', 'data-ai29c-d5c-sunscreen-canary-authority-read-v1',
      'status', 'NO_AUTHORITY',
      'reason', 'CANARY_FACT_REGISTRY_AMBIGUOUS'
    );
  end if;

  select count(rv.registry_version)::integer
    into v_registry_row_count
  from public.product_fact_registry_versions rv
  where rv.registry_version = v_registry_version;

  if v_registry_row_count <> 1 then
    return jsonb_build_object(
      'read_contract_version', 'data-ai29c-d5c-sunscreen-canary-authority-read-v1',
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
        'value_enum', i.value_enum,
        'value_number', i.value_number,
        'value_unit', i.value_unit,
        'authority_ceiling', i.authority_ceiling,
        'fused_confidence', i.fused_confidence,
        'valid_from', i.valid_from,
        'valid_to', i.valid_to
      )
      order by i.fact_key
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
    and i.fact_key in ('spf_value', 'uva_label', 'uv_filter_type');

  v_semantic_bundle :=
    public.read_sunscreen_recommendation_semantic_bundle_v1(p_product_id);

  return jsonb_build_object(
    'read_contract_version', 'data-ai29c-d5c-sunscreen-canary-authority-read-v1',
    'status', 'AUTHORITY_RESOLVED',
    'product', v_product,
    'taxonomy', v_taxonomy,
    'subject', v_subject,
    'registry', v_registry,
    'current_facts', v_facts,
    'semantic_bundle', v_semantic_bundle
  );
end;
$$;

revoke all on function public.read_data_ai29c_d5c_sunscreen_canary_authority_v1(uuid)
  from public, anon, authenticated, service_role, recommendation_admission_runtime;
grant execute on function public.read_data_ai29c_d5c_sunscreen_canary_authority_v1(uuid)
  to recommendation_admission_runtime;

grant create on schema public to recommendation_admission_reader_owner;
grant recommendation_admission_reader_owner to postgres;
alter function public.read_data_ai29c_d5c_sunscreen_canary_authority_v1(uuid)
  owner to recommendation_admission_reader_owner;
revoke recommendation_admission_reader_owner from postgres;
revoke create on schema public from recommendation_admission_reader_owner;

do $$
begin
  if has_schema_privilege(
    'recommendation_admission_reader_owner',
    'public',
    'CREATE'
  ) then
    raise exception 'D5C_OWNER_SCHEMA_CREATE_FORBIDDEN';
  end if;

  if has_table_privilege(
    'recommendation_admission_runtime',
    'public.product_catalog_taxonomy_assignments',
    'SELECT'
  ) then
    raise exception 'D5C_RUNTIME_RAW_TAXONOMY_SELECT_FORBIDDEN';
  end if;

  if has_table_privilege(
    'recommendation_admission_runtime',
    'public.sunscreen_recommendation_semantic_field_reviews',
    'SELECT'
  ) then
    raise exception 'D5C_RUNTIME_RAW_SEMANTIC_SELECT_FORBIDDEN';
  end if;

  if has_function_privilege(
    'recommendation_admission_runtime',
    'public.read_sunscreen_recommendation_semantic_bundle_v1(uuid)',
    'EXECUTE'
  ) then
    raise exception 'D5C_RUNTIME_DIRECT_SEMANTIC_RPC_FORBIDDEN';
  end if;

  if not has_function_privilege(
    'recommendation_admission_runtime',
    'public.read_data_ai29c_d5c_sunscreen_canary_authority_v1(uuid)',
    'EXECUTE'
  ) then
    raise exception 'D5C_RUNTIME_CANARY_RPC_EXECUTE_REQUIRED';
  end if;
end
$$;

commit;
