begin;

-- PF-5B1 adds only controlled Product Fact write operations.
-- PF-2 tables remain authoritative and unchanged. No Product Fact data is seeded.

create extension if not exists pgcrypto with schema extensions;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'product_fact_registry_versions',
    'product_fact_definition_snapshots',
    'product_fact_subjects',
    'product_evidence_sources',
    'product_evidence_source_subject_bindings',
    'product_evidence_records',
    'product_fact_instances',
    'product_fact_evidence_links',
    'product_fact_confirmations',
    'product_fact_current',
    'product_fact_review_assignments',
    'product_fact_review_events'
  ]
  loop
    if to_regclass('public.' || v_table) is null then
      raise exception 'product_fact_controlled_write_pf2_table_missing:%', v_table;
    end if;
  end loop;

  if to_regprocedure('public.admin_require_product_review_actor(uuid,text)') is null
    or to_regprocedure(
      'public.record_admin_audit_event(uuid,text,text,text,text,jsonb,jsonb,text,text,jsonb)'
    ) is null
  then
    raise exception 'product_fact_controlled_write_admin_foundation_missing';
  end if;
end $$;

create or replace function public.product_fact_controlled_json_exact_keys_v1(
  p_value jsonb,
  p_keys text[]
)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select
    p_value is not null
    and jsonb_typeof(p_value) = 'object'
    and p_value ?& p_keys
    and (select count(*) from jsonb_object_keys(p_value))
      = coalesce(array_length(p_keys, 1), 0);
$$;

create or replace function public.product_fact_controlled_canonical_json_v1(
  p_value jsonb
)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_type text := jsonb_typeof(p_value);
  v_result text;
begin
  if p_value is null then
    return 'null';
  end if;

  if v_type = 'object' then
    select '{' || coalesce(
      string_agg(
        to_jsonb(entry.key)::text || ':' ||
          public.product_fact_controlled_canonical_json_v1(entry.value),
        ',' order by entry.key
      ),
      ''
    ) || '}'
    into v_result
    from jsonb_each(p_value) as entry(key, value);
    return v_result;
  end if;

  if v_type = 'array' then
    select '[' || coalesce(
      string_agg(
        public.product_fact_controlled_canonical_json_v1(item.value),
        ',' order by item.ordinality
      ),
      ''
    ) || ']'
    into v_result
    from jsonb_array_elements(p_value) with ordinality as item(value, ordinality);
    return v_result;
  end if;

  return p_value::text;
end;
$$;

create or replace function public.product_fact_controlled_sha256_json_v1(
  p_value jsonb
)
returns text
language sql
immutable
set search_path = public, extensions, pg_temp
as $$
  select encode(
    extensions.digest(
      convert_to(public.product_fact_controlled_canonical_json_v1(p_value), 'UTF8'),
      'sha256'
    ),
    'hex'
  );
$$;

create or replace function public.product_fact_controlled_authority_rank_v1(
  p_authority text
)
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$
  select case p_authority
    when 'none' then 0
    when 'legacy_unreviewed' then 1
    when 'ingredient_basis' then 2
    when 'review_observation' then 3
    when 'limited_non_product_specific' then 4
    when 'product_specific_primary' then 5
    else -1
  end;
$$;

create or replace function public.product_fact_controlled_latest_registry_v1()
returns text
language sql
stable
set search_path = public, pg_temp
as $$
  select registry.registry_version
  from public.product_fact_registry_versions as registry
  where registry.effective_at is null or registry.effective_at <= now()
  order by
    coalesce(registry.effective_at, registry.created_at) desc,
    registry.created_at desc,
    registry.registry_version desc
  limit 1;
$$;

create or replace function public.product_fact_controlled_binding_is_current_v1(
  p_binding_id uuid
)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce((
    select
      binding.binding_state in ('exact_subject_match', 'equivalent_presentation_match')
      and binding.subject_id is not null
      and not exists (
        select 1
        from public.product_evidence_source_subject_bindings as newer
        where newer.source_id = binding.source_id
          and newer.product_id = binding.product_id
          and (
            newer.reviewed_at,
            newer.created_at,
            newer.binding_id
          ) > (
            binding.reviewed_at,
            binding.created_at,
            binding.binding_id
          )
      )
    from public.product_evidence_source_subject_bindings as binding
    where binding.binding_id = p_binding_id
  ), false);
$$;

create or replace function public.admin_publish_product_fact_registry_v1(
  p_actor_user_id uuid,
  p_request_id text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_actor_role text;
  v_request_id text := btrim(coalesce(p_request_id, ''));
  v_registry_version text;
  v_registry_checksum text;
  v_identity_serializer_version text;
  v_effective_at timestamptz;
  v_definitions jsonb;
  v_definition jsonb;
  v_definition_count integer;
  v_definition_checksum text;
  v_computed_registry_checksum text;
  v_existing public.product_fact_registry_versions%rowtype;
  v_audit_id uuid;
  v_result jsonb;
begin
  v_actor_role := public.admin_require_product_review_actor(
    p_actor_user_id,
    'admin.operations.execute'
  );

  if char_length(v_request_id) not between 8 and 120 then
    raise exception 'product_fact_registry_request_id_invalid' using errcode = '22023';
  end if;

  if not public.product_fact_controlled_json_exact_keys_v1(
    p_payload,
    array[
      'registry_version',
      'registry_checksum',
      'identity_serializer_version',
      'effective_at',
      'definitions'
    ]
  ) then
    raise exception 'product_fact_registry_payload_invalid' using errcode = '22023';
  end if;

  v_registry_version := btrim(coalesce(p_payload ->> 'registry_version', ''));
  v_registry_checksum := lower(btrim(coalesce(p_payload ->> 'registry_checksum', '')));
  v_identity_serializer_version :=
    btrim(coalesce(p_payload ->> 'identity_serializer_version', ''));
  v_definitions := p_payload -> 'definitions';

  if char_length(v_registry_version) not between 1 and 160
    or v_registry_checksum !~ '^[0-9a-f]{64}$'
    or char_length(v_identity_serializer_version) not between 1 and 160
    or jsonb_typeof(v_definitions) <> 'array'
    or jsonb_array_length(v_definitions) not between 1 and 500
  then
    raise exception 'product_fact_registry_payload_invalid' using errcode = '22023';
  end if;

  if p_payload -> 'effective_at' <> 'null'::jsonb then
    begin
      v_effective_at := (p_payload ->> 'effective_at')::timestamptz;
    exception when others then
      raise exception 'product_fact_registry_effective_at_invalid' using errcode = '22023';
    end;
  end if;

  v_definition_count := jsonb_array_length(v_definitions);

  if (
    select count(distinct item.value ->> 'fact_key')
    from jsonb_array_elements(v_definitions) as item(value)
  ) <> v_definition_count then
    raise exception 'product_fact_registry_duplicate_fact_key' using errcode = '23505';
  end if;

  for v_definition in
    select item.value
    from jsonb_array_elements(v_definitions) as item(value)
    order by item.value ->> 'fact_key'
  loop
    if not public.product_fact_controlled_json_exact_keys_v1(
      v_definition,
      array[
        'fact_key',
        'value_type',
        'definition',
        'definition_checksum',
        'deprecated',
        'superseded_by_fact_key'
      ]
    ) then
      raise exception 'product_fact_registry_definition_invalid' using errcode = '22023';
    end if;

    if char_length(btrim(coalesce(v_definition ->> 'fact_key', ''))) not between 1 and 160
      or v_definition ->> 'value_type' not in (
        'boolean', 'enum', 'number', 'number_unit', 'range_unit', 'entity_identifier'
      )
      or jsonb_typeof(v_definition -> 'definition') <> 'object'
      or octet_length((v_definition -> 'definition')::text) > 131072
      or coalesce(v_definition ->> 'definition_checksum', '') !~ '^[0-9a-f]{64}$'
      or jsonb_typeof(v_definition -> 'deprecated') <> 'boolean'
      or (
        v_definition -> 'superseded_by_fact_key' <> 'null'::jsonb
        and char_length(btrim(coalesce(v_definition ->> 'superseded_by_fact_key', '')))
          not between 1 and 160
      )
      or v_definition #>> '{definition,fact_key}' is distinct from v_definition ->> 'fact_key'
      or v_definition #>> '{definition,value_type}' is distinct from v_definition ->> 'value_type'
      or v_definition #>> '{definition,registry_version}' is distinct from v_registry_version
    then
      raise exception 'product_fact_registry_definition_invalid' using errcode = '22023';
    end if;

    v_definition_checksum :=
      public.product_fact_controlled_sha256_json_v1(v_definition -> 'definition');

    if v_definition_checksum <> v_definition ->> 'definition_checksum' then
      raise exception 'product_fact_registry_definition_checksum_mismatch'
        using errcode = '23514';
    end if;
  end loop;

  v_computed_registry_checksum := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object(
      'registry_version', v_registry_version,
      'identity_serializer_version', v_identity_serializer_version,
      'definitions', (
        select jsonb_agg(
          jsonb_build_object(
            'fact_key', item.value ->> 'fact_key',
            'value_type', item.value ->> 'value_type',
            'definition_checksum', item.value ->> 'definition_checksum',
            'deprecated', (item.value ->> 'deprecated')::boolean,
            'superseded_by_fact_key', item.value -> 'superseded_by_fact_key'
          )
          order by item.value ->> 'fact_key'
        )
        from jsonb_array_elements(v_definitions) as item(value)
      )
    )
  );

  if v_computed_registry_checksum <> v_registry_checksum then
    raise exception 'product_fact_registry_checksum_mismatch' using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('bejewely_product_fact_registry:' || v_registry_version, 0)
  );

  select * into v_existing
  from public.product_fact_registry_versions
  where registry_version = v_registry_version;

  if found then
    if v_existing.registry_checksum <> v_registry_checksum
      or v_existing.identity_serializer_version <> v_identity_serializer_version
      or v_existing.effective_at is distinct from v_effective_at
      or (
        select count(*)
        from public.product_fact_definition_snapshots as definition
        where definition.registry_version = v_registry_version
      ) <> v_definition_count
      or exists (
        select 1
        from jsonb_array_elements(v_definitions) as requested(value)
        left join public.product_fact_definition_snapshots as stored
          on stored.registry_version = v_registry_version
         and stored.fact_key = requested.value ->> 'fact_key'
        where stored.fact_key is null
          or stored.value_type is distinct from requested.value ->> 'value_type'
          or stored.definition is distinct from requested.value -> 'definition'
          or stored.definition_checksum is distinct from requested.value ->> 'definition_checksum'
          or stored.deprecated is distinct from (requested.value ->> 'deprecated')::boolean
          or stored.superseded_by_fact_key is distinct from
            nullif(requested.value ->> 'superseded_by_fact_key', '')
      )
    then
      raise exception 'product_fact_registry_version_conflict' using errcode = '23505';
    end if;

    return jsonb_build_object(
      'status', 'published',
      'idempotent', true,
      'registry_version', v_registry_version,
      'registry_checksum', v_registry_checksum,
      'definition_count', v_definition_count
    );
  end if;

  insert into public.product_fact_registry_versions (
    registry_version,
    registry_checksum,
    identity_serializer_version,
    effective_at,
    created_at
  ) values (
    v_registry_version,
    v_registry_checksum,
    v_identity_serializer_version,
    v_effective_at,
    now()
  );

  insert into public.product_fact_definition_snapshots (
    registry_version,
    fact_key,
    value_type,
    definition,
    definition_checksum,
    deprecated,
    superseded_by_fact_key,
    created_at
  )
  select
    v_registry_version,
    item.value ->> 'fact_key',
    item.value ->> 'value_type',
    item.value -> 'definition',
    item.value ->> 'definition_checksum',
    (item.value ->> 'deprecated')::boolean,
    nullif(item.value ->> 'superseded_by_fact_key', ''),
    now()
  from jsonb_array_elements(v_definitions) as item(value);

  v_audit_id := public.record_admin_audit_event(
    p_actor_user_id,
    'admin.operations.execute',
    'admin.product_fact.registry_published',
    'product_fact_registry',
    v_registry_version,
    null,
    jsonb_build_object(
      'registry_checksum', v_registry_checksum,
      'identity_serializer_version', v_identity_serializer_version,
      'definition_count', v_definition_count,
      'effective_at', v_effective_at
    ),
    'publish Product Fact Registry version',
    v_request_id,
    jsonb_build_object(
      'registry_version', v_registry_version,
      'registry_checksum', v_registry_checksum
    )
  );

  v_result := jsonb_build_object(
    'status', 'published',
    'idempotent', false,
    'registry_version', v_registry_version,
    'registry_checksum', v_registry_checksum,
    'definition_count', v_definition_count,
    'audit_id', v_audit_id
  );

  return v_result;
end;
$$;

create or replace function public.admin_ingest_product_fact_evidence_v1(
  p_actor_user_id uuid,
  p_request_id text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_actor_role text;
  v_request_id text := btrim(coalesce(p_request_id, ''));
  v_source jsonb;
  v_binding jsonb;
  v_evidence jsonb;
  v_source_id uuid;
  v_binding_id uuid;
  v_evidence_id uuid;
  v_product_id uuid;
  v_subject_id uuid;
  v_supersedes_evidence_id uuid;
  v_binding_state text;
  v_scope_relation text;
  v_registry_version text;
  v_fact_key text;
  v_proposition_key text;
  v_source_row public.product_evidence_sources%rowtype;
  v_binding_row public.product_evidence_source_subject_bindings%rowtype;
  v_subject public.product_fact_subjects%rowtype;
  v_definition public.product_fact_definition_snapshots%rowtype;
  v_existing_evidence public.product_evidence_records%rowtype;
  v_source_inserted boolean := false;
  v_binding_inserted boolean := false;
  v_evidence_inserted boolean := false;
  v_audit_id uuid;
  v_result jsonb;
begin
  v_actor_role := public.admin_require_product_review_actor(
    p_actor_user_id,
    'admin.products.review'
  );

  if char_length(v_request_id) not between 8 and 120 then
    raise exception 'product_fact_evidence_request_id_invalid' using errcode = '22023';
  end if;

  if not public.product_fact_controlled_json_exact_keys_v1(
    p_payload,
    array['source', 'binding', 'evidence']
  ) then
    raise exception 'product_fact_evidence_payload_invalid' using errcode = '22023';
  end if;

  v_source := p_payload -> 'source';
  v_binding := p_payload -> 'binding';
  v_evidence := p_payload -> 'evidence';

  if not public.product_fact_controlled_json_exact_keys_v1(
    v_source,
    array[
      'canonical_locator',
      'publisher',
      'source_kind',
      'source_metadata',
      'content_digest',
      'external_snapshot_reference',
      'market',
      'region',
      'locale',
      'published_at',
      'accessed_at',
      'observed_at'
    ]
  ) or not public.product_fact_controlled_json_exact_keys_v1(
    v_binding,
    array[
      'product_id',
      'subject_id',
      'binding_state',
      'scope_relation',
      'presentation_metadata',
      'identity_resolution_version',
      'reviewed_at'
    ]
  ) then
    raise exception 'product_fact_evidence_payload_invalid' using errcode = '22023';
  end if;

  if char_length(btrim(coalesce(v_source ->> 'canonical_locator', ''))) not between 1 and 4096
    or char_length(btrim(coalesce(v_source ->> 'publisher', ''))) not between 1 and 512
    or char_length(btrim(coalesce(v_source ->> 'source_kind', ''))) not between 1 and 160
    or jsonb_typeof(v_source -> 'source_metadata') <> 'object'
    or octet_length((v_source -> 'source_metadata')::text) > 32768
    or coalesce(v_source ->> 'content_digest', '') !~ '^[0-9a-f]{64}$'
  then
    raise exception 'product_fact_source_invalid' using errcode = '22023';
  end if;

  begin
    v_product_id := (v_binding ->> 'product_id')::uuid;
    if v_binding -> 'subject_id' <> 'null'::jsonb then
      v_subject_id := (v_binding ->> 'subject_id')::uuid;
    end if;
  exception when others then
    raise exception 'product_fact_binding_identity_invalid' using errcode = '22023';
  end;

  v_binding_state := v_binding ->> 'binding_state';
  v_scope_relation := v_binding ->> 'scope_relation';

  if v_binding_state not in (
      'exact_subject_match',
      'equivalent_presentation_match',
      'product_family_only',
      'variant_ambiguous',
      'formulation_ambiguous',
      'identity_unresolved',
      'disjoint_subject'
    )
    or v_scope_relation not in ('equivalent', 'narrower', 'broader', 'disjoint', 'overlapping')
    or jsonb_typeof(v_binding -> 'presentation_metadata') <> 'object'
    or char_length(btrim(coalesce(v_binding ->> 'identity_resolution_version', '')))
      not between 1 and 160
  then
    raise exception 'product_fact_binding_invalid' using errcode = '22023';
  end if;

  if (
      v_binding_state in (
        'exact_subject_match', 'equivalent_presentation_match', 'disjoint_subject'
      )
      and v_subject_id is null
    ) or (
      v_binding_state in (
        'product_family_only',
        'variant_ambiguous',
        'formulation_ambiguous',
        'identity_unresolved'
      )
      and v_subject_id is not null
    )
  then
    raise exception 'product_fact_binding_target_invalid' using errcode = '23514';
  end if;

  if not exists (
    select 1 from public.products where id = v_product_id
  ) then
    raise exception 'product_fact_binding_product_not_found' using errcode = 'P0002';
  end if;

  if v_subject_id is not null then
    select * into v_subject
    from public.product_fact_subjects
    where subject_id = v_subject_id
      and product_id = v_product_id;

    if not found then
      raise exception 'product_fact_binding_subject_not_found' using errcode = 'P0002';
    end if;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'bejewely_product_fact_source:' ||
      lower(v_source ->> 'content_digest') || ':' ||
      btrim(v_source ->> 'canonical_locator'),
      0
    )
  );

  select * into v_source_row
  from public.product_evidence_sources
  where canonical_locator = btrim(v_source ->> 'canonical_locator')
    and publisher = btrim(v_source ->> 'publisher')
    and source_kind = btrim(v_source ->> 'source_kind')
    and content_digest = lower(v_source ->> 'content_digest');

  if found then
    if v_source_row.source_metadata is distinct from v_source -> 'source_metadata'
      or v_source_row.external_snapshot_reference is distinct from
        nullif(btrim(coalesce(v_source ->> 'external_snapshot_reference', '')), '')
      or v_source_row.market is distinct from
        nullif(btrim(coalesce(v_source ->> 'market', '')), '')
      or v_source_row.region is distinct from
        nullif(btrim(coalesce(v_source ->> 'region', '')), '')
      or v_source_row.locale is distinct from
        nullif(btrim(coalesce(v_source ->> 'locale', '')), '')
      or v_source_row.published_at is distinct from (
        case when v_source -> 'published_at' = 'null'::jsonb
          then null else (v_source ->> 'published_at')::timestamptz end
      )
    then
      raise exception 'product_fact_source_identity_conflict' using errcode = '23505';
    end if;
    v_source_id := v_source_row.source_id;
  else
    insert into public.product_evidence_sources (
      canonical_locator,
      publisher,
      source_kind,
      source_metadata,
      content_digest,
      external_snapshot_reference,
      market,
      region,
      locale,
      published_at,
      accessed_at,
      observed_at,
      created_at
    ) values (
      btrim(v_source ->> 'canonical_locator'),
      btrim(v_source ->> 'publisher'),
      btrim(v_source ->> 'source_kind'),
      v_source -> 'source_metadata',
      lower(v_source ->> 'content_digest'),
      nullif(btrim(coalesce(v_source ->> 'external_snapshot_reference', '')), ''),
      nullif(btrim(coalesce(v_source ->> 'market', '')), ''),
      nullif(btrim(coalesce(v_source ->> 'region', '')), ''),
      nullif(btrim(coalesce(v_source ->> 'locale', '')), ''),
      case when v_source -> 'published_at' = 'null'::jsonb
        then null else (v_source ->> 'published_at')::timestamptz end,
      (v_source ->> 'accessed_at')::timestamptz,
      case when v_source -> 'observed_at' = 'null'::jsonb
        then null else (v_source ->> 'observed_at')::timestamptz end,
      now()
    )
    returning source_id into v_source_id;
    v_source_inserted := true;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'bejewely_product_fact_binding:' ||
      v_source_id::text || ':' || v_product_id::text || ':' ||
      coalesce(v_subject_id::text, 'null') || ':' ||
      v_binding_state || ':' ||
      btrim(v_binding ->> 'identity_resolution_version'),
      0
    )
  );

  select * into v_binding_row
  from public.product_evidence_source_subject_bindings
  where source_id = v_source_id
    and product_id = v_product_id
    and subject_id is not distinct from v_subject_id
    and binding_state = v_binding_state
    and identity_resolution_version = btrim(v_binding ->> 'identity_resolution_version');

  if found then
    if v_binding_row.scope_relation <> v_scope_relation
      or v_binding_row.presentation_metadata is distinct from v_binding -> 'presentation_metadata'
    then
      raise exception 'product_fact_binding_identity_conflict' using errcode = '23505';
    end if;
    v_binding_id := v_binding_row.binding_id;
  else
    insert into public.product_evidence_source_subject_bindings (
      source_id,
      product_id,
      subject_id,
      binding_state,
      scope_relation,
      presentation_metadata,
      identity_resolution_version,
      reviewed_by,
      reviewed_at,
      created_at
    ) values (
      v_source_id,
      v_product_id,
      v_subject_id,
      v_binding_state,
      v_scope_relation,
      v_binding -> 'presentation_metadata',
      btrim(v_binding ->> 'identity_resolution_version'),
      p_actor_user_id,
      (v_binding ->> 'reviewed_at')::timestamptz,
      now()
    )
    returning binding_id into v_binding_id;
    v_binding_inserted := true;
  end if;

  if v_evidence = 'null'::jsonb then
    v_audit_id := public.record_admin_audit_event(
      p_actor_user_id,
      'admin.products.review',
      'admin.product_fact.source_binding_ingested',
      'product_evidence_source_subject_binding',
      v_binding_id::text,
      null,
      jsonb_build_object(
        'source_id', v_source_id,
        'binding_id', v_binding_id,
        'binding_state', v_binding_state,
        'scope_relation', v_scope_relation
      ),
      'ingest Product Fact source identity binding',
      v_request_id,
      jsonb_build_object(
        'source_inserted', v_source_inserted,
        'binding_inserted', v_binding_inserted
      )
    );

    return jsonb_build_object(
      'status', 'binding_recorded',
      'source_id', v_source_id,
      'binding_id', v_binding_id,
      'evidence_id', null,
      'source_inserted', v_source_inserted,
      'binding_inserted', v_binding_inserted,
      'evidence_inserted', false,
      'audit_id', v_audit_id
    );
  end if;

  if not public.product_fact_controlled_json_exact_keys_v1(
    v_evidence,
    array[
      'registry_version',
      'fact_key',
      'proposition_key',
      'proposition_serializer_version',
      'proposition_value_identity',
      'parent_proposition_key',
      'evidence_class',
      'evidence_authority',
      'confidence',
      'support_direction',
      'negative_admissibility',
      'market',
      'region',
      'locale',
      'valid_from',
      'valid_to',
      'qualifier',
      'canonical_evidence_digest',
      'supersedes_evidence_id'
    ]
  ) then
    raise exception 'product_fact_evidence_record_invalid' using errcode = '22023';
  end if;

  if v_subject_id is null
    or v_binding_state not in ('exact_subject_match', 'equivalent_presentation_match')
    or v_scope_relation not in ('equivalent', 'narrower')
    or v_subject.identity_status <> 'resolved'
  then
    raise exception 'product_fact_evidence_resolved_subject_required' using errcode = '23514';
  end if;

  v_registry_version := btrim(coalesce(v_evidence ->> 'registry_version', ''));
  v_fact_key := btrim(coalesce(v_evidence ->> 'fact_key', ''));
  v_proposition_key := lower(btrim(coalesce(v_evidence ->> 'proposition_key', '')));

  select * into v_definition
  from public.product_fact_definition_snapshots
  where registry_version = v_registry_version
    and fact_key = v_fact_key;

  if not found then
    raise exception 'product_fact_evidence_definition_not_found' using errcode = 'P0002';
  end if;

  if v_definition.deprecated then
    raise exception 'product_fact_evidence_definition_deprecated' using errcode = '23514';
  end if;

  if v_proposition_key !~ '^[0-9a-f]{64}$'
    or char_length(btrim(coalesce(v_evidence ->> 'proposition_serializer_version', '')))
      not between 1 and 160
    or v_evidence ->> 'evidence_class' not in (
      'product_claim',
      'measurement',
      'observation',
      'usage_instruction',
      'composition_identity',
      'physical_characteristic',
      'role_declaration',
      'legacy_catalog_observation'
    )
    or v_evidence ->> 'evidence_authority' not in (
      'product_specific_primary',
      'limited_non_product_specific',
      'review_observation',
      'ingredient_basis',
      'legacy_unreviewed',
      'none'
    )
    or v_evidence ->> 'confidence' not in ('high', 'medium', 'low', 'unknown')
    or v_evidence ->> 'support_direction' not in ('supports', 'opposes', 'context_only')
    or v_evidence ->> 'negative_admissibility' not in (
      'not_applicable',
      'explicit_negative',
      'conflict_opposition',
      'ambiguous',
      'context_only'
    )
    or jsonb_typeof(v_evidence -> 'qualifier') <> 'object'
    or coalesce(v_evidence ->> 'canonical_evidence_digest', '') !~ '^[0-9a-f]{64}$'
  then
    raise exception 'product_fact_evidence_record_invalid' using errcode = '22023';
  end if;

  if v_evidence ->> 'support_direction' = 'supports'
      and v_evidence ->> 'negative_admissibility' <> 'not_applicable'
    or v_evidence ->> 'support_direction' = 'opposes'
      and v_evidence ->> 'negative_admissibility'
        not in ('explicit_negative', 'conflict_opposition')
    or v_evidence ->> 'support_direction' = 'context_only'
      and v_evidence ->> 'negative_admissibility' not in ('ambiguous', 'context_only')
  then
    raise exception 'product_fact_negative_evidence_contract_invalid' using errcode = '23514';
  end if;

  if jsonb_typeof(v_definition.definition -> 'permitted_evidence_classes') = 'array'
    and not exists (
      select 1
      from jsonb_array_elements_text(v_definition.definition -> 'permitted_evidence_classes')
        as allowed(value)
      where allowed.value = v_evidence ->> 'evidence_class'
    )
  then
    raise exception 'product_fact_evidence_class_not_permitted' using errcode = '23514';
  end if;

  if lower(v_source ->> 'source_kind') ~ '(ranking|popularity|sales[_ -]?rank|market[_ -]?signal)'
    and (
      v_evidence ->> 'support_direction' <> 'context_only'
      or v_evidence ->> 'evidence_authority' <> 'none'
    )
  then
    raise exception 'product_fact_market_popularity_authority_forbidden'
      using errcode = '23514';
  end if;

  if v_subject.market_applicability is not null
      and nullif(v_evidence ->> 'market', '') is not null
      and v_subject.market_applicability <> v_evidence ->> 'market'
    or v_subject.region_applicability is not null
      and nullif(v_evidence ->> 'region', '') is not null
      and v_subject.region_applicability <> v_evidence ->> 'region'
  then
    raise exception 'product_fact_evidence_scope_incompatible' using errcode = '23514';
  end if;

  if v_evidence -> 'valid_from' <> 'null'::jsonb
    and v_evidence -> 'valid_to' <> 'null'::jsonb
    and (v_evidence ->> 'valid_from')::date >= (v_evidence ->> 'valid_to')::date
  then
    raise exception 'product_fact_evidence_validity_invalid' using errcode = '23514';
  end if;

  if v_subject.valid_from is not null
    and v_evidence -> 'valid_to' <> 'null'::jsonb
    and (v_evidence ->> 'valid_to')::date <= v_subject.valid_from
    or v_subject.valid_to is not null
    and v_evidence -> 'valid_from' <> 'null'::jsonb
    and v_subject.valid_to <= (v_evidence ->> 'valid_from')::date
  then
    raise exception 'product_fact_evidence_scope_disjoint' using errcode = '23514';
  end if;

  if v_evidence -> 'supersedes_evidence_id' <> 'null'::jsonb then
    begin
      v_supersedes_evidence_id := (v_evidence ->> 'supersedes_evidence_id')::uuid;
    exception when others then
      raise exception 'product_fact_evidence_supersedes_invalid' using errcode = '22023';
    end;

    if not exists (
      select 1
      from public.product_evidence_records as prior
      where prior.evidence_id = v_supersedes_evidence_id
        and prior.subject_id = v_subject_id
        and prior.proposition_key = v_proposition_key
    ) then
      raise exception 'product_fact_evidence_supersedes_target_invalid' using errcode = '23514';
    end if;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'bejewely_product_fact_evidence:' ||
      lower(v_evidence ->> 'canonical_evidence_digest') || ':' ||
      v_subject_id::text || ':' || v_proposition_key,
      0
    )
  );

  select * into v_existing_evidence
  from public.product_evidence_records
  where source_id = v_source_id
    and subject_id = v_subject_id
    and registry_version = v_registry_version
    and fact_key = v_fact_key
    and proposition_key = v_proposition_key
    and canonical_evidence_digest = lower(v_evidence ->> 'canonical_evidence_digest')
  order by created_at, evidence_id
  limit 1;

  if found then
    if v_existing_evidence.binding_id <> v_binding_id
      or v_existing_evidence.binding_state <> v_binding_state
      or v_existing_evidence.proposition_serializer_version <>
        btrim(v_evidence ->> 'proposition_serializer_version')
      or v_existing_evidence.proposition_value_identity is distinct from
        v_evidence -> 'proposition_value_identity'
      or v_existing_evidence.parent_proposition_key is distinct from
        nullif(lower(btrim(coalesce(v_evidence ->> 'parent_proposition_key', ''))), '')
      or v_existing_evidence.evidence_class <> v_evidence ->> 'evidence_class'
      or v_existing_evidence.evidence_authority <> v_evidence ->> 'evidence_authority'
      or v_existing_evidence.confidence <> v_evidence ->> 'confidence'
      or v_existing_evidence.support_direction <> v_evidence ->> 'support_direction'
      or v_existing_evidence.negative_admissibility <> v_evidence ->> 'negative_admissibility'
      or v_existing_evidence.qualifier is distinct from v_evidence -> 'qualifier'
      or v_existing_evidence.supersedes_evidence_id is distinct from v_supersedes_evidence_id
    then
      raise exception 'product_fact_evidence_digest_conflict' using errcode = '23505';
    end if;
    v_evidence_id := v_existing_evidence.evidence_id;
  else
    insert into public.product_evidence_records (
      source_id,
      binding_id,
      binding_state,
      subject_id,
      registry_version,
      fact_key,
      proposition_key,
      proposition_serializer_version,
      proposition_value_identity,
      parent_proposition_key,
      evidence_class,
      evidence_authority,
      confidence,
      support_direction,
      negative_admissibility,
      market,
      region,
      locale,
      valid_from,
      valid_to,
      qualifier,
      canonical_evidence_digest,
      supersedes_evidence_id,
      created_at
    ) values (
      v_source_id,
      v_binding_id,
      v_binding_state,
      v_subject_id,
      v_registry_version,
      v_fact_key,
      v_proposition_key,
      btrim(v_evidence ->> 'proposition_serializer_version'),
      case when v_evidence -> 'proposition_value_identity' = 'null'::jsonb
        then null else v_evidence -> 'proposition_value_identity' end,
      nullif(lower(btrim(coalesce(v_evidence ->> 'parent_proposition_key', ''))), ''),
      v_evidence ->> 'evidence_class',
      v_evidence ->> 'evidence_authority',
      v_evidence ->> 'confidence',
      v_evidence ->> 'support_direction',
      v_evidence ->> 'negative_admissibility',
      nullif(btrim(coalesce(v_evidence ->> 'market', '')), ''),
      nullif(btrim(coalesce(v_evidence ->> 'region', '')), ''),
      nullif(btrim(coalesce(v_evidence ->> 'locale', '')), ''),
      case when v_evidence -> 'valid_from' = 'null'::jsonb
        then null else (v_evidence ->> 'valid_from')::date end,
      case when v_evidence -> 'valid_to' = 'null'::jsonb
        then null else (v_evidence ->> 'valid_to')::date end,
      v_evidence -> 'qualifier',
      lower(v_evidence ->> 'canonical_evidence_digest'),
      v_supersedes_evidence_id,
      now()
    )
    returning evidence_id into v_evidence_id;

    v_evidence_inserted := true;

    insert into public.product_fact_review_events (
      subject_id,
      evidence_id,
      actor_user_id,
      event_kind,
      reason_code,
      event_payload,
      created_at
    ) values (
      v_subject_id,
      v_evidence_id,
      p_actor_user_id,
      'evidence_ingested',
      'controlled_ingest',
      jsonb_build_object(
        'request_id', v_request_id,
        'source_id', v_source_id,
        'binding_id', v_binding_id,
        'registry_version', v_registry_version,
        'fact_key', v_fact_key,
        'proposition_key', v_proposition_key,
        'canonical_evidence_digest', lower(v_evidence ->> 'canonical_evidence_digest')
      ),
      now()
    );
  end if;

  v_audit_id := public.record_admin_audit_event(
    p_actor_user_id,
    'admin.products.review',
    'admin.product_fact.evidence_ingested',
    'product_evidence_record',
    v_evidence_id::text,
    null,
    jsonb_build_object(
      'source_id', v_source_id,
      'binding_id', v_binding_id,
      'evidence_id', v_evidence_id,
      'registry_version', v_registry_version,
      'fact_key', v_fact_key,
      'proposition_key', v_proposition_key,
      'support_direction', v_evidence ->> 'support_direction',
      'evidence_authority', v_evidence ->> 'evidence_authority'
    ),
    'ingest Product Fact evidence',
    v_request_id,
    jsonb_build_object(
      'source_inserted', v_source_inserted,
      'binding_inserted', v_binding_inserted,
      'evidence_inserted', v_evidence_inserted
    )
  );

  v_result := jsonb_build_object(
    'status', 'evidence_recorded',
    'source_id', v_source_id,
    'binding_id', v_binding_id,
    'evidence_id', v_evidence_id,
    'source_inserted', v_source_inserted,
    'binding_inserted', v_binding_inserted,
    'evidence_inserted', v_evidence_inserted,
    'audit_id', v_audit_id
  );

  return v_result;
end;
$$;

create or replace function public.admin_prepare_product_fact_review_v1(
  p_actor_user_id uuid,
  p_request_id text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_role text;
  v_request_id text := btrim(coalesce(p_request_id, ''));
  v_product_id uuid;
  v_subject_id uuid;
  v_assigned_to uuid;
  v_registry_version text;
  v_fact_key text;
  v_proposition_key text;
  v_operational_state text;
  v_review_policy_version text;
  v_reason_code text;
  v_subject public.product_fact_subjects%rowtype;
  v_assignment public.product_fact_review_assignments%rowtype;
  v_before_state text;
  v_event_kind text;
  v_audit_id uuid;
  v_result jsonb;
  v_initial boolean := false;
begin
  v_actor_role := public.admin_require_product_review_actor(
    p_actor_user_id,
    'admin.products.review'
  );

  if char_length(v_request_id) not between 8 and 120
    or not public.product_fact_controlled_json_exact_keys_v1(
      p_payload,
      array[
        'product_id',
        'subject_id',
        'registry_version',
        'fact_key',
        'proposition_key',
        'operational_state',
        'assigned_to',
        'review_policy_version',
        'reason_code'
      ]
    )
  then
    raise exception 'product_fact_review_prepare_payload_invalid' using errcode = '22023';
  end if;

  begin
    v_product_id := (p_payload ->> 'product_id')::uuid;
    if p_payload -> 'subject_id' <> 'null'::jsonb then
      v_subject_id := (p_payload ->> 'subject_id')::uuid;
    end if;
    if p_payload -> 'assigned_to' <> 'null'::jsonb then
      v_assigned_to := (p_payload ->> 'assigned_to')::uuid;
    end if;
  exception when others then
    raise exception 'product_fact_review_prepare_identity_invalid' using errcode = '22023';
  end;

  v_registry_version := btrim(coalesce(p_payload ->> 'registry_version', ''));
  v_fact_key := btrim(coalesce(p_payload ->> 'fact_key', ''));
  v_proposition_key := lower(btrim(coalesce(p_payload ->> 'proposition_key', '')));
  v_operational_state := p_payload ->> 'operational_state';
  v_review_policy_version := btrim(coalesce(p_payload ->> 'review_policy_version', ''));
  v_reason_code := btrim(coalesce(p_payload ->> 'reason_code', ''));

  if v_proposition_key !~ '^[0-9a-f]{64}$'
    or char_length(v_review_policy_version) not between 1 and 160
    or char_length(v_reason_code) not between 1 and 160
    or v_operational_state not in (
      'queued',
      'assigned',
      'under_review',
      'identity_blocked',
      'source_blocked',
      'needs_adjudication',
      'ready_for_confirm',
      're_review_required'
    )
  then
    raise exception 'product_fact_review_prepare_payload_invalid' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.products where id = v_product_id
  ) then
    raise exception 'product_fact_review_prepare_product_not_found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.product_fact_definition_snapshots
    where registry_version = v_registry_version
      and fact_key = v_fact_key
      and deprecated = false
  ) then
    raise exception 'product_fact_review_prepare_definition_not_found' using errcode = 'P0002';
  end if;

  if public.product_fact_controlled_latest_registry_v1() is distinct from v_registry_version then
    raise exception 'product_fact_review_prepare_registry_stale' using errcode = '40001';
  end if;

  if v_subject_id is null then
    if v_operational_state <> 'identity_blocked' then
      raise exception 'product_fact_review_prepare_subject_required' using errcode = '23514';
    end if;
  else
    select * into v_subject
    from public.product_fact_subjects
    where subject_id = v_subject_id
      and product_id = v_product_id;

    if not found then
      raise exception 'product_fact_review_prepare_subject_not_found' using errcode = 'P0002';
    end if;

    if v_operational_state = 'ready_for_confirm'
      and (
        v_subject.identity_status <> 'resolved'
        or v_subject.current_state <> 'current'
      )
    then
      raise exception 'product_fact_review_prepare_subject_not_current'
        using errcode = '23514';
    end if;
  end if;

  if v_assigned_to is not null and not exists (
    select 1
    from public.admin_memberships as membership
    where membership.user_id = v_assigned_to
      and membership.is_active = true
      and 'admin.products.review' = any(public.admin_role_capabilities(membership.role))
  ) then
    raise exception 'product_fact_review_prepare_assignee_invalid' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('bejewely_product_fact_review:' || v_proposition_key, 0)
  );

  select * into v_assignment
  from public.product_fact_review_assignments
  where product_id = v_product_id
    and subject_id is not distinct from v_subject_id
    and registry_version = v_registry_version
    and fact_key = v_fact_key
    and proposition_key = v_proposition_key
    and operational_state not in ('confirmed', 'superseded')
  order by created_at desc, assignment_id desc
  limit 1
  for update;

  if not found then
    if v_operational_state = 'ready_for_confirm' then
      raise exception 'product_fact_review_prepare_transition_invalid'
        using errcode = '23514';
    end if;

    insert into public.product_fact_review_assignments (
      product_id,
      subject_id,
      registry_version,
      fact_key,
      proposition_key,
      operational_state,
      assigned_to,
      review_policy_version,
      created_at,
      updated_at
    ) values (
      v_product_id,
      v_subject_id,
      v_registry_version,
      v_fact_key,
      v_proposition_key,
      v_operational_state,
      v_assigned_to,
      v_review_policy_version,
      now(),
      now()
    )
    returning * into v_assignment;

    v_initial := true;
    v_event_kind := 'review_assignment_prepared';
  else
    if v_assignment.review_policy_version <> v_review_policy_version then
      raise exception 'product_fact_review_prepare_policy_conflict' using errcode = '23505';
    end if;

    if v_assignment.operational_state = v_operational_state
      and v_assignment.assigned_to is not distinct from v_assigned_to
    then
      return jsonb_build_object(
        'status', 'prepared',
        'idempotent', true,
        'assignment_id', v_assignment.assignment_id,
        'operational_state', v_assignment.operational_state,
        'subject_id', v_assignment.subject_id,
        'registry_version', v_assignment.registry_version,
        'fact_key', v_assignment.fact_key,
        'proposition_key', v_assignment.proposition_key
      );
    end if;

    v_before_state := v_assignment.operational_state;

    if not (
      (v_before_state = 'queued'
        and v_operational_state in (
          'assigned', 'under_review', 'identity_blocked', 'source_blocked',
          'needs_adjudication'
        ))
      or (v_before_state = 'assigned'
        and v_operational_state in (
          'under_review', 'identity_blocked', 'source_blocked', 'needs_adjudication'
        ))
      or (v_before_state = 'under_review'
        and v_operational_state in (
          'identity_blocked', 'source_blocked', 'needs_adjudication', 'ready_for_confirm'
        ))
      or (v_before_state = 'identity_blocked'
        and v_operational_state in ('under_review', 'identity_blocked'))
      or (v_before_state = 'source_blocked'
        and v_operational_state in ('under_review', 'source_blocked'))
      or (v_before_state = 'needs_adjudication'
        and v_operational_state in ('under_review', 'needs_adjudication', 'ready_for_confirm'))
      or (v_before_state = 're_review_required'
        and v_operational_state in ('under_review', 're_review_required'))
    ) then
      raise exception 'product_fact_review_prepare_transition_invalid'
        using errcode = '23514';
    end if;

    if v_operational_state = 'ready_for_confirm'
      and (
        v_subject_id is null
        or v_subject.identity_status <> 'resolved'
        or v_subject.current_state <> 'current'
      )
    then
      raise exception 'product_fact_review_prepare_subject_not_current'
        using errcode = '23514';
    end if;

    update public.product_fact_review_assignments
    set operational_state = v_operational_state,
        assigned_to = v_assigned_to,
        updated_at = now()
    where assignment_id = v_assignment.assignment_id
    returning * into v_assignment;

    v_event_kind := 'review_assignment_transitioned';
  end if;

  insert into public.product_fact_review_events (
    assignment_id,
    subject_id,
    actor_user_id,
    event_kind,
    reason_code,
    event_payload,
    created_at
  ) values (
    v_assignment.assignment_id,
    v_assignment.subject_id,
    p_actor_user_id,
    v_event_kind,
    v_reason_code,
    jsonb_build_object(
      'request_id', v_request_id,
      'from_state', v_before_state,
      'to_state', v_assignment.operational_state,
      'review_policy_version', v_assignment.review_policy_version,
      'assigned_to', v_assignment.assigned_to
    ),
    now()
  );

  v_audit_id := public.record_admin_audit_event(
    p_actor_user_id,
    'admin.products.review',
    'admin.product_fact.review_prepared',
    'product_fact_review_assignment',
    v_assignment.assignment_id::text,
    case when v_initial then null else jsonb_build_object(
      'operational_state', v_before_state
    ) end,
    jsonb_build_object(
      'operational_state', v_assignment.operational_state,
      'assigned_to', v_assignment.assigned_to,
      'review_policy_version', v_assignment.review_policy_version
    ),
    'prepare Product Fact review assignment',
    v_request_id,
    jsonb_build_object(
      'subject_id', v_assignment.subject_id,
      'registry_version', v_assignment.registry_version,
      'fact_key', v_assignment.fact_key,
      'proposition_key', v_assignment.proposition_key
    )
  );

  v_result := jsonb_build_object(
    'status', 'prepared',
    'idempotent', false,
    'assignment_id', v_assignment.assignment_id,
    'operational_state', v_assignment.operational_state,
    'subject_id', v_assignment.subject_id,
    'registry_version', v_assignment.registry_version,
    'fact_key', v_assignment.fact_key,
    'proposition_key', v_assignment.proposition_key,
    'audit_id', v_audit_id
  );

  return v_result;
end;
$$;

create or replace function public.product_fact_controlled_build_preflight_v1(
  p_actor_user_id uuid,
  p_request_id text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_actor_role text;
  v_request_id text := btrim(coalesce(p_request_id, ''));
  v_assignment_id uuid;
  v_subject_id uuid;
  v_parent_fact_instance_id uuid;
  v_supporting_ids uuid[] := '{}'::uuid[];
  v_opposing_ids uuid[] := '{}'::uuid[];
  v_all_ids uuid[] := '{}'::uuid[];
  v_assignment public.product_fact_review_assignments%rowtype;
  v_subject public.product_fact_subjects%rowtype;
  v_definition public.product_fact_definition_snapshots%rowtype;
  v_parent_fact public.product_fact_instances%rowtype;
  v_current public.product_fact_current%rowtype;
  v_current_fact public.product_fact_instances%rowtype;
  v_registry_version text;
  v_fact_key text;
  v_proposition_key text;
  v_semantic_status text;
  v_value_type text;
  v_authority_ceiling text;
  v_expected_authority text := 'none';
  v_fused_confidence text;
  v_fusion_policy_version text;
  v_fusion_input_digest text;
  v_proposition_serializer_version text;
  v_max_authority_rank integer := 0;
  v_payload_digest text;
  v_computed_fusion_input_digest text;
  v_registry_state_digest text;
  v_subject_state_digest text;
  v_assignment_state_digest text;
  v_evidence_state_digest text;
  v_binding_state_digest text;
  v_current_state_digest text;
  v_prestate_digest text;
  v_previous_current jsonb;
  v_proposed_value jsonb;
  v_evidence_rows jsonb;
  v_expected_writes jsonb;
  v_result jsonb;
begin
  v_actor_role := public.admin_require_product_review_actor(
    p_actor_user_id,
    'admin.products.review'
  );

  if char_length(v_request_id) not between 8 and 120
    or not public.product_fact_controlled_json_exact_keys_v1(
      p_payload,
      array[
        'assignment_id',
        'subject_id',
        'registry_version',
        'fact_key',
        'proposition_key',
        'proposition_serializer_version',
        'semantic_status',
        'value_type',
        'value_boolean',
        'value_enum',
        'value_number',
        'value_unit',
        'value_range_min',
        'value_range_max',
        'value_entity_identifier',
        'market',
        'region',
        'locale',
        'valid_from',
        'valid_to',
        'qualifier',
        'parent_fact_instance_id',
        'parent_proposition_key',
        'authority_ceiling',
        'fused_confidence',
        'fusion_policy_version',
        'fusion_input_digest',
        'supporting_evidence_ids',
        'opposing_evidence_ids'
      ]
    )
    or octet_length(p_payload::text) > 1048576
  then
    raise exception 'product_fact_confirmation_payload_invalid' using errcode = '22023';
  end if;

  begin
    v_assignment_id := (p_payload ->> 'assignment_id')::uuid;
    v_subject_id := (p_payload ->> 'subject_id')::uuid;
    if p_payload -> 'parent_fact_instance_id' <> 'null'::jsonb then
      v_parent_fact_instance_id := (p_payload ->> 'parent_fact_instance_id')::uuid;
    end if;

    if jsonb_typeof(p_payload -> 'supporting_evidence_ids') <> 'array'
      or jsonb_typeof(p_payload -> 'opposing_evidence_ids') <> 'array'
    then
      raise exception 'invalid_evidence_array';
    end if;

    select coalesce(array_agg(item.value::uuid order by item.value), '{}'::uuid[])
    into v_supporting_ids
    from jsonb_array_elements_text(p_payload -> 'supporting_evidence_ids') as item(value);

    select coalesce(array_agg(item.value::uuid order by item.value), '{}'::uuid[])
    into v_opposing_ids
    from jsonb_array_elements_text(p_payload -> 'opposing_evidence_ids') as item(value);
  exception when others then
    raise exception 'product_fact_confirmation_identity_invalid' using errcode = '22023';
  end;

  if coalesce(array_length(v_supporting_ids, 1), 0) <>
      coalesce((select count(distinct value) from unnest(v_supporting_ids) as value), 0)
    or coalesce(array_length(v_opposing_ids, 1), 0) <>
      coalesce((select count(distinct value) from unnest(v_opposing_ids) as value), 0)
    or exists (
      select 1
      from unnest(v_supporting_ids) as support(value)
      join unnest(v_opposing_ids) as oppose(value) using (value)
    )
  then
    raise exception 'product_fact_confirmation_evidence_set_invalid' using errcode = '23514';
  end if;

  select coalesce(array_agg(value order by value), '{}'::uuid[])
  into v_all_ids
  from (
    select unnest(v_supporting_ids) as value
    union all
    select unnest(v_opposing_ids) as value
  ) as combined;

  v_registry_version := btrim(coalesce(p_payload ->> 'registry_version', ''));
  v_fact_key := btrim(coalesce(p_payload ->> 'fact_key', ''));
  v_proposition_key := lower(btrim(coalesce(p_payload ->> 'proposition_key', '')));
  v_proposition_serializer_version :=
    btrim(coalesce(p_payload ->> 'proposition_serializer_version', ''));
  v_semantic_status := p_payload ->> 'semantic_status';
  v_value_type := nullif(btrim(coalesce(p_payload ->> 'value_type', '')), '');
  v_authority_ceiling := p_payload ->> 'authority_ceiling';
  v_fused_confidence := p_payload ->> 'fused_confidence';
  v_fusion_policy_version := btrim(coalesce(p_payload ->> 'fusion_policy_version', ''));
  v_fusion_input_digest := lower(btrim(coalesce(p_payload ->> 'fusion_input_digest', '')));

  if v_proposition_key !~ '^[0-9a-f]{64}$'
    or char_length(v_proposition_serializer_version) not between 1 and 160
    or v_semantic_status not in (
      'supported',
      'reviewed_not_established',
      'evidence_insufficient',
      'evidence_conflict'
    )
    or v_authority_ceiling not in (
      'product_specific_primary',
      'limited_non_product_specific',
      'review_observation',
      'ingredient_basis',
      'legacy_unreviewed',
      'none'
    )
    or v_fused_confidence not in ('high', 'medium', 'low', 'unknown')
    or char_length(v_fusion_policy_version) not between 1 and 160
    or v_fusion_input_digest !~ '^[0-9a-f]{64}$'
    or jsonb_typeof(p_payload -> 'qualifier') <> 'object'
  then
    raise exception 'product_fact_confirmation_payload_invalid' using errcode = '22023';
  end if;

  select * into v_assignment
  from public.product_fact_review_assignments
  where assignment_id = v_assignment_id;

  if not found then
    raise exception 'product_fact_confirmation_assignment_not_found' using errcode = 'P0002';
  end if;

  if v_assignment.operational_state <> 'ready_for_confirm'
    or v_assignment.subject_id is distinct from v_subject_id
    or v_assignment.registry_version is distinct from v_registry_version
    or v_assignment.fact_key is distinct from v_fact_key
    or v_assignment.proposition_key is distinct from v_proposition_key
  then
    raise exception 'product_fact_confirmation_assignment_stale' using errcode = '40001';
  end if;

  if v_assignment.assigned_to is not null
    and v_assignment.assigned_to <> p_actor_user_id
    and v_actor_role <> 'admin_owner'
  then
    raise exception 'product_fact_confirmation_assignment_actor_mismatch'
      using errcode = '42501';
  end if;

  select * into v_subject
  from public.product_fact_subjects
  where subject_id = v_subject_id;

  if not found then
    raise exception 'product_fact_confirmation_subject_not_found' using errcode = 'P0002';
  end if;

  if v_subject.product_id <> v_assignment.product_id
    or v_subject.identity_status <> 'resolved'
    or v_subject.current_state <> 'current'
  then
    raise exception 'product_fact_confirmation_subject_stale' using errcode = '40001';
  end if;

  if public.product_fact_controlled_latest_registry_v1() is distinct from v_registry_version then
    raise exception 'product_fact_confirmation_registry_stale' using errcode = '40001';
  end if;

  select * into v_definition
  from public.product_fact_definition_snapshots
  where registry_version = v_registry_version
    and fact_key = v_fact_key;

  if not found or v_definition.deprecated then
    raise exception 'product_fact_confirmation_definition_stale' using errcode = '40001';
  end if;

  if v_semantic_status = 'supported' then
    if v_value_type is distinct from v_definition.value_type then
      raise exception 'product_fact_confirmation_value_type_mismatch' using errcode = '23514';
    end if;

    if (
      (v_value_type = 'boolean'
        and jsonb_typeof(p_payload -> 'value_boolean') = 'boolean'
        and p_payload -> 'value_enum' = 'null'::jsonb
        and p_payload -> 'value_number' = 'null'::jsonb
        and p_payload -> 'value_unit' = 'null'::jsonb
        and p_payload -> 'value_range_min' = 'null'::jsonb
        and p_payload -> 'value_range_max' = 'null'::jsonb
        and p_payload -> 'value_entity_identifier' = 'null'::jsonb)
      or
      (v_value_type = 'enum'
        and jsonb_typeof(p_payload -> 'value_enum') = 'string'
        and p_payload -> 'value_boolean' = 'null'::jsonb
        and p_payload -> 'value_number' = 'null'::jsonb
        and p_payload -> 'value_unit' = 'null'::jsonb
        and p_payload -> 'value_range_min' = 'null'::jsonb
        and p_payload -> 'value_range_max' = 'null'::jsonb
        and p_payload -> 'value_entity_identifier' = 'null'::jsonb)
      or
      (v_value_type = 'number'
        and jsonb_typeof(p_payload -> 'value_number') = 'number'
        and p_payload -> 'value_boolean' = 'null'::jsonb
        and p_payload -> 'value_enum' = 'null'::jsonb
        and p_payload -> 'value_unit' = 'null'::jsonb
        and p_payload -> 'value_range_min' = 'null'::jsonb
        and p_payload -> 'value_range_max' = 'null'::jsonb
        and p_payload -> 'value_entity_identifier' = 'null'::jsonb)
      or
      (v_value_type = 'number_unit'
        and jsonb_typeof(p_payload -> 'value_number') = 'number'
        and jsonb_typeof(p_payload -> 'value_unit') = 'string'
        and p_payload -> 'value_boolean' = 'null'::jsonb
        and p_payload -> 'value_enum' = 'null'::jsonb
        and p_payload -> 'value_range_min' = 'null'::jsonb
        and p_payload -> 'value_range_max' = 'null'::jsonb
        and p_payload -> 'value_entity_identifier' = 'null'::jsonb)
      or
      (v_value_type = 'range_unit'
        and jsonb_typeof(p_payload -> 'value_range_min') = 'number'
        and jsonb_typeof(p_payload -> 'value_range_max') = 'number'
        and jsonb_typeof(p_payload -> 'value_unit') = 'string'
        and (p_payload ->> 'value_range_min')::numeric
          <= (p_payload ->> 'value_range_max')::numeric
        and p_payload -> 'value_boolean' = 'null'::jsonb
        and p_payload -> 'value_enum' = 'null'::jsonb
        and p_payload -> 'value_number' = 'null'::jsonb
        and p_payload -> 'value_entity_identifier' = 'null'::jsonb)
      or
      (v_value_type = 'entity_identifier'
        and jsonb_typeof(p_payload -> 'value_entity_identifier') = 'string'
        and char_length(btrim(p_payload ->> 'value_entity_identifier')) between 1 and 512
        and p_payload -> 'value_boolean' = 'null'::jsonb
        and p_payload -> 'value_enum' = 'null'::jsonb
        and p_payload -> 'value_number' = 'null'::jsonb
        and p_payload -> 'value_unit' = 'null'::jsonb
        and p_payload -> 'value_range_min' = 'null'::jsonb
        and p_payload -> 'value_range_max' = 'null'::jsonb)
    ) is not true then
      raise exception 'product_fact_confirmation_typed_value_invalid' using errcode = '23514';
    end if;

    if v_value_type = 'enum'
      and jsonb_typeof(v_definition.definition -> 'allowed_values') = 'array'
      and not exists (
        select 1
        from jsonb_array_elements_text(v_definition.definition -> 'allowed_values') as allowed(value)
        where allowed.value = p_payload ->> 'value_enum'
      )
    then
      raise exception 'product_fact_confirmation_enum_value_invalid' using errcode = '23514';
    end if;

    if v_value_type in ('number_unit', 'range_unit')
      and jsonb_typeof(v_definition.definition #> '{unit_schema,allowed_units}') = 'array'
      and not exists (
        select 1
        from jsonb_array_elements_text(
          v_definition.definition #> '{unit_schema,allowed_units}'
        ) as allowed(value)
        where allowed.value = p_payload ->> 'value_unit'
      )
    then
      raise exception 'product_fact_confirmation_unit_invalid' using errcode = '23514';
    end if;
  else
    if v_value_type is not null
      or p_payload -> 'value_boolean' <> 'null'::jsonb
      or p_payload -> 'value_enum' <> 'null'::jsonb
      or p_payload -> 'value_number' <> 'null'::jsonb
      or p_payload -> 'value_unit' <> 'null'::jsonb
      or p_payload -> 'value_range_min' <> 'null'::jsonb
      or p_payload -> 'value_range_max' <> 'null'::jsonb
      or p_payload -> 'value_entity_identifier' <> 'null'::jsonb
    then
      raise exception 'product_fact_confirmation_non_supported_value_forbidden'
        using errcode = '23514';
    end if;
  end if;

  if p_payload -> 'valid_from' <> 'null'::jsonb
    and p_payload -> 'valid_to' <> 'null'::jsonb
    and (p_payload ->> 'valid_from')::date >= (p_payload ->> 'valid_to')::date
  then
    raise exception 'product_fact_confirmation_validity_invalid' using errcode = '23514';
  end if;

  if v_parent_fact_instance_id is null
      and p_payload -> 'parent_proposition_key' <> 'null'::jsonb
    or v_parent_fact_instance_id is not null
      and p_payload -> 'parent_proposition_key' = 'null'::jsonb
  then
    raise exception 'product_fact_confirmation_parent_pair_invalid' using errcode = '23514';
  end if;

  if v_parent_fact_instance_id is not null then
    select * into v_parent_fact
    from public.product_fact_instances
    where fact_instance_id = v_parent_fact_instance_id
      and proposition_key = lower(p_payload ->> 'parent_proposition_key')
      and subject_id = v_subject_id;

    if not found then
      raise exception 'product_fact_confirmation_parent_subject_mismatch'
        using errcode = '23514';
    end if;
  end if;

  if coalesce(array_length(v_all_ids, 1), 0) > 0 then
    if (
      select count(*)
      from public.product_evidence_records
      where evidence_id = any(v_all_ids)
    ) <> array_length(v_all_ids, 1) then
      raise exception 'product_fact_confirmation_evidence_missing' using errcode = 'P0002';
    end if;

    if exists (
      select 1
      from public.product_evidence_records as evidence
      where evidence.evidence_id = any(v_all_ids)
        and (
          evidence.subject_id <> v_subject_id
          or evidence.registry_version <> v_registry_version
          or evidence.fact_key <> v_fact_key
          or evidence.proposition_key <> v_proposition_key
          or not public.product_fact_controlled_binding_is_current_v1(evidence.binding_id)
          or exists (
            select 1
            from public.product_evidence_records as newer
            where newer.supersedes_evidence_id = evidence.evidence_id
          )
        )
    ) then
      raise exception 'product_fact_confirmation_evidence_stale' using errcode = '40001';
    end if;

    if exists (
      select 1
      from public.product_evidence_records as evidence
      join public.product_evidence_sources as source
        on source.source_id = evidence.source_id
      where evidence.evidence_id = any(v_all_ids)
        and lower(source.source_kind) ~
          '(ranking|popularity|sales[_ -]?rank|market[_ -]?signal)'
    ) then
      raise exception 'product_fact_market_popularity_fact_input_forbidden'
        using errcode = '23514';
    end if;

    if exists (
      select 1
      from public.product_evidence_records
      where evidence_id = any(v_supporting_ids)
        and (
          support_direction <> 'supports'
          or negative_admissibility <> 'not_applicable'
        )
    ) then
      raise exception 'product_fact_confirmation_support_role_invalid'
        using errcode = '23514';
    end if;

    if exists (
      select 1
      from public.product_evidence_records
      where evidence_id = any(v_opposing_ids)
        and (
          support_direction <> 'opposes'
          or negative_admissibility not in ('explicit_negative', 'conflict_opposition')
        )
    ) then
      raise exception 'product_fact_confirmation_opposition_role_invalid'
        using errcode = '23514';
    end if;
  end if;

  if v_semantic_status = 'supported' then
    if v_value_type = 'boolean'
      and (p_payload ->> 'value_boolean')::boolean = false
    then
      if not exists (
        select 1
        from public.product_evidence_records
        where evidence_id = any(v_opposing_ids)
          and negative_admissibility = 'explicit_negative'
      ) then
        raise exception 'product_fact_supported_false_requires_explicit_negative'
          using errcode = '23514';
      end if;
    elsif coalesce(array_length(v_supporting_ids, 1), 0) = 0 then
      raise exception 'product_fact_supported_requires_supporting_evidence'
        using errcode = '23514';
    end if;
  end if;

  if v_semantic_status = 'evidence_conflict'
    and (
      coalesce(array_length(v_supporting_ids, 1), 0) = 0
      or coalesce(array_length(v_opposing_ids, 1), 0) = 0
    )
  then
    raise exception 'product_fact_conflict_requires_support_and_opposition'
      using errcode = '23514';
  end if;

  select coalesce(max(public.product_fact_controlled_authority_rank_v1(evidence.evidence_authority)), 0)
  into v_max_authority_rank
  from public.product_evidence_records as evidence
  where evidence.evidence_id = any(v_all_ids);

  v_expected_authority := case v_max_authority_rank
    when 5 then 'product_specific_primary'
    when 4 then 'limited_non_product_specific'
    when 3 then 'review_observation'
    when 2 then 'ingredient_basis'
    when 1 then 'legacy_unreviewed'
    else 'none'
  end;

  if v_authority_ceiling <> v_expected_authority then
    raise exception 'product_fact_confirmation_authority_ceiling_invalid'
      using errcode = '23514';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'evidence_id', evidence.evidence_id,
        'role', case
          when evidence.evidence_id = any(v_supporting_ids) then 'supporting'
          else 'opposing'
        end,
        'canonical_evidence_digest', evidence.canonical_evidence_digest,
        'evidence_authority', evidence.evidence_authority,
        'confidence', evidence.confidence,
        'support_direction', evidence.support_direction,
        'negative_admissibility', evidence.negative_admissibility
      )
      order by evidence.evidence_id
    ),
    '[]'::jsonb
  )
  into v_evidence_rows
  from public.product_evidence_records as evidence
  where evidence.evidence_id = any(v_all_ids);

  v_computed_fusion_input_digest := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object(
      'registry_version', v_registry_version,
      'subject_id', v_subject_id,
      'fact_key', v_fact_key,
      'proposition_key', v_proposition_key,
      'fusion_policy_version', v_fusion_policy_version,
      'evidence', v_evidence_rows
    )
  );

  if v_computed_fusion_input_digest <> v_fusion_input_digest then
    raise exception 'product_fact_confirmation_fusion_input_stale' using errcode = '40001';
  end if;

  v_payload_digest := public.product_fact_controlled_sha256_json_v1(p_payload);

  v_registry_state_digest := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object(
      'latest_effective_registry', public.product_fact_controlled_latest_registry_v1(),
      'effective_registry_versions', (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'registry_version', registry.registry_version,
            'registry_checksum', registry.registry_checksum,
            'identity_serializer_version', registry.identity_serializer_version,
            'effective_at', registry.effective_at,
            'created_at', registry.created_at
          ) order by registry.registry_version
        ), '[]'::jsonb)
        from public.product_fact_registry_versions as registry
        where registry.effective_at is null or registry.effective_at <= now()
      ),
      'definition_checksum', v_definition.definition_checksum,
      'definition_deprecated', v_definition.deprecated
    )
  );

  v_subject_state_digest := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object(
      'subject_id', v_subject.subject_id,
      'product_id', v_subject.product_id,
      'subject_semantic_key', v_subject.subject_semantic_key,
      'identity_status', v_subject.identity_status,
      'identity_resolution_version', v_subject.identity_resolution_version,
      'current_state', v_subject.current_state,
      'market_applicability', v_subject.market_applicability,
      'region_applicability', v_subject.region_applicability,
      'valid_from', v_subject.valid_from,
      'valid_to', v_subject.valid_to,
      'updated_at', v_subject.updated_at
    )
  );

  v_assignment_state_digest := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object(
      'assignment_id', v_assignment.assignment_id,
      'operational_state', v_assignment.operational_state,
      'assigned_to', v_assignment.assigned_to,
      'review_policy_version', v_assignment.review_policy_version,
      'updated_at', v_assignment.updated_at
    )
  );

  v_evidence_state_digest := public.product_fact_controlled_sha256_json_v1(
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'evidence_id', evidence.evidence_id,
          'source_id', evidence.source_id,
          'binding_id', evidence.binding_id,
          'canonical_evidence_digest', evidence.canonical_evidence_digest,
          'evidence_authority', evidence.evidence_authority,
          'confidence', evidence.confidence,
          'support_direction', evidence.support_direction,
          'negative_admissibility', evidence.negative_admissibility,
          'supersedes_evidence_id', evidence.supersedes_evidence_id,
          'created_at', evidence.created_at
        )
        order by evidence.evidence_id
      )
      from public.product_evidence_records as evidence
      where evidence.subject_id = v_subject_id
        and evidence.registry_version = v_registry_version
        and evidence.fact_key = v_fact_key
        and evidence.proposition_key = v_proposition_key
    ), '[]'::jsonb)
  );

  v_binding_state_digest := public.product_fact_controlled_sha256_json_v1(
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'binding_id', binding.binding_id,
          'source_id', binding.source_id,
          'product_id', binding.product_id,
          'subject_id', binding.subject_id,
          'binding_state', binding.binding_state,
          'scope_relation', binding.scope_relation,
          'identity_resolution_version', binding.identity_resolution_version,
          'reviewed_at', binding.reviewed_at,
          'created_at', binding.created_at
        )
        order by binding.binding_id
      )
      from public.product_evidence_source_subject_bindings as binding
      where binding.source_id in (
        select distinct evidence.source_id
        from public.product_evidence_records as evidence
        where evidence.subject_id = v_subject_id
          and evidence.registry_version = v_registry_version
          and evidence.fact_key = v_fact_key
          and evidence.proposition_key = v_proposition_key
      )
    ), '[]'::jsonb)
  );

  select * into v_current
  from public.product_fact_current
  where proposition_key = v_proposition_key;

  if found then
    select * into strict v_current_fact
    from public.product_fact_instances
    where fact_instance_id = v_current.fact_instance_id;

    v_previous_current := jsonb_build_object(
      'proposition_key', v_current.proposition_key,
      'fact_instance_id', v_current.fact_instance_id,
      'subject_id', v_current.subject_id,
      'confirmation_id', v_current.confirmation_id,
      'updated_at', v_current.updated_at,
      'semantic_status', v_current_fact.semantic_status,
      'value_type', v_current_fact.value_type,
      'authority_ceiling', v_current_fact.authority_ceiling,
      'fused_confidence', v_current_fact.fused_confidence,
      'fusion_policy_version', v_current_fact.fusion_policy_version,
      'fusion_input_digest', v_current_fact.fusion_input_digest
    );
  else
    v_previous_current := null;
  end if;

  v_current_state_digest :=
    public.product_fact_controlled_sha256_json_v1(to_jsonb(v_previous_current));

  v_prestate_digest := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object(
      'registry_state_digest', v_registry_state_digest,
      'subject_state_digest', v_subject_state_digest,
      'assignment_state_digest', v_assignment_state_digest,
      'evidence_state_digest', v_evidence_state_digest,
      'binding_state_digest', v_binding_state_digest,
      'current_state_digest', v_current_state_digest
    )
  );

  v_proposed_value := case
    when v_semantic_status <> 'supported' then null
    else jsonb_build_object(
      'value_type', v_value_type,
      'value_boolean', p_payload -> 'value_boolean',
      'value_enum', p_payload -> 'value_enum',
      'value_number', p_payload -> 'value_number',
      'value_unit', p_payload -> 'value_unit',
      'value_range_min', p_payload -> 'value_range_min',
      'value_range_max', p_payload -> 'value_range_max',
      'value_entity_identifier', p_payload -> 'value_entity_identifier'
    )
  end;

  v_expected_writes := jsonb_build_object(
    'product_fact_instances', 1,
    'product_fact_evidence_links', coalesce(array_length(v_all_ids, 1), 0),
    'product_fact_confirmations', 1,
    'product_fact_current', 1,
    'product_fact_review_assignments_update', 1,
    'product_fact_review_events', 1
  );

  v_result := jsonb_build_object(
    'status', 'ready',
    'actor_role', v_actor_role,
    'request_id', v_request_id,
    'registry_version', v_registry_version,
    'subject_id', v_subject_id,
    'fact_key', v_fact_key,
    'proposition_key', v_proposition_key,
    'supporting_evidence_ids', to_jsonb(v_supporting_ids),
    'opposing_evidence_ids', to_jsonb(v_opposing_ids),
    'proposed_semantic_status', v_semantic_status,
    'proposed_value', v_proposed_value,
    'authority_ceiling', v_authority_ceiling,
    'fused_confidence', v_fused_confidence,
    'fusion_policy_version', v_fusion_policy_version,
    'fusion_input_digest', v_fusion_input_digest,
    'previous_current', v_previous_current,
    'payload_digest', v_payload_digest,
    'prestate_digest', v_prestate_digest,
    'expected_write_set', v_expected_writes
  );

  return v_result;
end;
$$;

create or replace function public.admin_preflight_product_fact_confirmation_v1(
  p_actor_user_id uuid,
  p_request_id text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  return public.product_fact_controlled_build_preflight_v1(
    p_actor_user_id,
    p_request_id,
    p_payload
  );
end;
$$;

create or replace function public.admin_confirm_product_fact_v1(
  p_actor_user_id uuid,
  p_request_id text,
  p_payload jsonb,
  p_expected_payload_digest text,
  p_expected_prestate_digest text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_actor_role text;
  v_request_id text := btrim(coalesce(p_request_id, ''));
  v_namespace constant text := 'product_fact_confirmation_v1';
  v_expected_payload_digest text :=
    lower(btrim(coalesce(p_expected_payload_digest, '')));
  v_expected_prestate_digest text :=
    lower(btrim(coalesce(p_expected_prestate_digest, '')));
  v_actual_payload_digest text;
  v_existing public.product_fact_confirmations%rowtype;
  v_preflight jsonb;
  v_assignment_id uuid;
  v_subject_id uuid;
  v_fact_instance_id uuid := gen_random_uuid();
  v_confirmation_id uuid := gen_random_uuid();
  v_previous_fact_instance_id uuid;
  v_parent_fact_instance_id uuid;
  v_supporting_ids uuid[] := '{}'::uuid[];
  v_opposing_ids uuid[] := '{}'::uuid[];
  v_result jsonb;
  v_result_digest text;
  v_audit_id uuid;
  v_updated_count integer;
begin
  v_actor_role := public.admin_require_product_review_actor(
    p_actor_user_id,
    'admin.products.review'
  );

  if char_length(v_request_id) not between 8 and 120
    or v_expected_payload_digest !~ '^[0-9a-f]{64}$'
    or v_expected_prestate_digest !~ '^[0-9a-f]{64}$'
  then
    raise exception 'product_fact_confirmation_request_invalid' using errcode = '22023';
  end if;

  v_actual_payload_digest :=
    public.product_fact_controlled_sha256_json_v1(p_payload);

  if v_actual_payload_digest <> v_expected_payload_digest then
    raise exception 'product_fact_confirmation_payload_digest_mismatch'
      using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'bejewely_product_fact_confirmation_request:' || v_request_id,
      0
    )
  );

  select * into v_existing
  from public.product_fact_confirmations
  where namespace = v_namespace
    and request_id = v_request_id;

  if found then
    if v_existing.actor_user_id <> p_actor_user_id
      or v_existing.payload_digest <> v_expected_payload_digest
      or v_existing.prestate_digest <> v_expected_prestate_digest
    then
      raise exception 'product_fact_confirmation_request_conflict'
        using errcode = '23505';
    end if;

    return v_existing.result || jsonb_build_object('idempotent', true);
  end if;

  if not public.product_fact_controlled_json_exact_keys_v1(
    p_payload,
    array[
      'assignment_id',
      'subject_id',
      'registry_version',
      'fact_key',
      'proposition_key',
      'proposition_serializer_version',
      'semantic_status',
      'value_type',
      'value_boolean',
      'value_enum',
      'value_number',
      'value_unit',
      'value_range_min',
      'value_range_max',
      'value_entity_identifier',
      'market',
      'region',
      'locale',
      'valid_from',
      'valid_to',
      'qualifier',
      'parent_fact_instance_id',
      'parent_proposition_key',
      'authority_ceiling',
      'fused_confidence',
      'fusion_policy_version',
      'fusion_input_digest',
      'supporting_evidence_ids',
      'opposing_evidence_ids'
    ]
  ) then
    raise exception 'product_fact_confirmation_payload_invalid' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'bejewely_product_fact_proposition:' ||
      lower(btrim(p_payload ->> 'proposition_key')),
      0
    )
  );

  v_preflight := public.product_fact_controlled_build_preflight_v1(
    p_actor_user_id,
    v_request_id,
    p_payload
  );

  if v_preflight ->> 'status' <> 'ready'
    or v_preflight ->> 'payload_digest' <> v_expected_payload_digest
    or v_preflight ->> 'prestate_digest' <> v_expected_prestate_digest
  then
    raise exception 'product_fact_confirmation_stale_preflight' using errcode = '40001';
  end if;

  v_assignment_id := (p_payload ->> 'assignment_id')::uuid;
  v_subject_id := (p_payload ->> 'subject_id')::uuid;

  if p_payload -> 'parent_fact_instance_id' <> 'null'::jsonb then
    v_parent_fact_instance_id := (p_payload ->> 'parent_fact_instance_id')::uuid;
  end if;

  select coalesce(array_agg(item.value::uuid order by item.value), '{}'::uuid[])
  into v_supporting_ids
  from jsonb_array_elements_text(p_payload -> 'supporting_evidence_ids') as item(value);

  select coalesce(array_agg(item.value::uuid order by item.value), '{}'::uuid[])
  into v_opposing_ids
  from jsonb_array_elements_text(p_payload -> 'opposing_evidence_ids') as item(value);

  v_previous_fact_instance_id :=
    nullif(v_preflight #>> '{previous_current,fact_instance_id}', '')::uuid;

  insert into public.product_fact_instances (
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
    market,
    region,
    locale,
    valid_from,
    valid_to,
    qualifier,
    parent_proposition_key,
    parent_fact_instance_id,
    authority_ceiling,
    fused_confidence,
    fusion_policy_version,
    fusion_input_digest,
    supersedes_fact_instance_id,
    adjudicated_at,
    created_at
  ) values (
    v_fact_instance_id,
    v_subject_id,
    p_payload ->> 'registry_version',
    p_payload ->> 'fact_key',
    lower(p_payload ->> 'proposition_key'),
    p_payload ->> 'proposition_serializer_version',
    p_payload ->> 'semantic_status',
    nullif(p_payload ->> 'value_type', ''),
    case when p_payload -> 'value_boolean' = 'null'::jsonb
      then null else (p_payload ->> 'value_boolean')::boolean end,
    nullif(p_payload ->> 'value_enum', ''),
    case when p_payload -> 'value_number' = 'null'::jsonb
      then null else (p_payload ->> 'value_number')::numeric end,
    nullif(p_payload ->> 'value_unit', ''),
    case when p_payload -> 'value_range_min' = 'null'::jsonb
      then null else (p_payload ->> 'value_range_min')::numeric end,
    case when p_payload -> 'value_range_max' = 'null'::jsonb
      then null else (p_payload ->> 'value_range_max')::numeric end,
    nullif(p_payload ->> 'value_entity_identifier', ''),
    nullif(p_payload ->> 'market', ''),
    nullif(p_payload ->> 'region', ''),
    nullif(p_payload ->> 'locale', ''),
    case when p_payload -> 'valid_from' = 'null'::jsonb
      then null else (p_payload ->> 'valid_from')::date end,
    case when p_payload -> 'valid_to' = 'null'::jsonb
      then null else (p_payload ->> 'valid_to')::date end,
    p_payload -> 'qualifier',
    nullif(lower(p_payload ->> 'parent_proposition_key'), ''),
    v_parent_fact_instance_id,
    p_payload ->> 'authority_ceiling',
    p_payload ->> 'fused_confidence',
    p_payload ->> 'fusion_policy_version',
    lower(p_payload ->> 'fusion_input_digest'),
    v_previous_fact_instance_id,
    case when p_payload ->> 'semantic_status' = 'evidence_conflict'
      then now() else null end,
    now()
  );

  insert into public.product_fact_evidence_links (
    fact_instance_id,
    evidence_id,
    subject_id,
    proposition_key,
    link_role,
    created_at
  )
  select
    v_fact_instance_id,
    evidence_id,
    v_subject_id,
    lower(p_payload ->> 'proposition_key'),
    'supporting',
    now()
  from unnest(v_supporting_ids) as evidence_id;

  insert into public.product_fact_evidence_links (
    fact_instance_id,
    evidence_id,
    subject_id,
    proposition_key,
    link_role,
    created_at
  )
  select
    v_fact_instance_id,
    evidence_id,
    v_subject_id,
    lower(p_payload ->> 'proposition_key'),
    'opposing',
    now()
  from unnest(v_opposing_ids) as evidence_id;

  v_result := jsonb_build_object(
    'status', 'confirmed',
    'idempotent', false,
    'request_id', v_request_id,
    'namespace', v_namespace,
    'confirmation_id', v_confirmation_id,
    'fact_instance_id', v_fact_instance_id,
    'subject_id', v_subject_id,
    'registry_version', p_payload ->> 'registry_version',
    'fact_key', p_payload ->> 'fact_key',
    'proposition_key', lower(p_payload ->> 'proposition_key'),
    'semantic_status', p_payload ->> 'semantic_status',
    'authority_ceiling', p_payload ->> 'authority_ceiling',
    'fused_confidence', p_payload ->> 'fused_confidence',
    'fusion_policy_version', p_payload ->> 'fusion_policy_version',
    'fusion_input_digest', lower(p_payload ->> 'fusion_input_digest'),
    'payload_digest', v_expected_payload_digest,
    'prestate_digest', v_expected_prestate_digest,
    'previous_fact_instance_id', v_previous_fact_instance_id
  );

  v_result_digest := public.product_fact_controlled_sha256_json_v1(v_result);

  insert into public.product_fact_confirmations (
    confirmation_id,
    request_id,
    namespace,
    actor_user_id,
    payload_digest,
    prestate_digest,
    result_digest,
    result,
    created_at
  ) values (
    v_confirmation_id,
    v_request_id,
    v_namespace,
    p_actor_user_id,
    v_expected_payload_digest,
    v_expected_prestate_digest,
    v_result_digest,
    v_result,
    now()
  );

  insert into public.product_fact_current (
    proposition_key,
    fact_instance_id,
    subject_id,
    confirmation_id,
    updated_at
  ) values (
    lower(p_payload ->> 'proposition_key'),
    v_fact_instance_id,
    v_subject_id,
    v_confirmation_id,
    now()
  )
  on conflict (proposition_key)
  do update set
    fact_instance_id = excluded.fact_instance_id,
    subject_id = excluded.subject_id,
    confirmation_id = excluded.confirmation_id,
    updated_at = excluded.updated_at;

  update public.product_fact_review_assignments
  set operational_state = 'confirmed',
      updated_at = now()
  where assignment_id = v_assignment_id
    and operational_state = 'ready_for_confirm';

  get diagnostics v_updated_count = row_count;
  if v_updated_count <> 1 then
    raise exception 'product_fact_confirmation_assignment_transition_failed'
      using errcode = '40001';
  end if;

  insert into public.product_fact_review_events (
    assignment_id,
    subject_id,
    fact_instance_id,
    confirmation_id,
    actor_user_id,
    event_kind,
    reason_code,
    event_payload,
    created_at
  ) values (
    v_assignment_id,
    v_subject_id,
    v_fact_instance_id,
    v_confirmation_id,
    p_actor_user_id,
    'fact_confirmed',
    'controlled_confirmation',
    jsonb_build_object(
      'request_id', v_request_id,
      'payload_digest', v_expected_payload_digest,
      'prestate_digest', v_expected_prestate_digest,
      'result_digest', v_result_digest,
      'previous_fact_instance_id', v_previous_fact_instance_id
    ),
    now()
  );

  v_audit_id := public.record_admin_audit_event(
    p_actor_user_id,
    'admin.products.review',
    'admin.product_fact.confirmed',
    'product_fact_proposition',
    lower(p_payload ->> 'proposition_key'),
    v_preflight -> 'previous_current',
    jsonb_build_object(
      'fact_instance_id', v_fact_instance_id,
      'confirmation_id', v_confirmation_id,
      'semantic_status', p_payload ->> 'semantic_status',
      'authority_ceiling', p_payload ->> 'authority_ceiling',
      'fused_confidence', p_payload ->> 'fused_confidence'
    ),
    'confirm Product Fact current knowledge state',
    v_request_id,
    jsonb_build_object(
      'payload_digest', v_expected_payload_digest,
      'prestate_digest', v_expected_prestate_digest,
      'result_digest', v_result_digest
    )
  );

  return v_result || jsonb_build_object('audit_id', v_audit_id);
end;
$$;

revoke all on function public.product_fact_controlled_json_exact_keys_v1(jsonb, text[])
  from public, anon, authenticated, service_role;
revoke all on function public.product_fact_controlled_canonical_json_v1(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.product_fact_controlled_sha256_json_v1(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.product_fact_controlled_authority_rank_v1(text)
  from public, anon, authenticated, service_role;
revoke all on function public.product_fact_controlled_latest_registry_v1()
  from public, anon, authenticated, service_role;
revoke all on function public.product_fact_controlled_binding_is_current_v1(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.product_fact_controlled_build_preflight_v1(uuid, text, jsonb)
  from public, anon, authenticated, service_role;

revoke all on function public.admin_publish_product_fact_registry_v1(uuid, text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_ingest_product_fact_evidence_v1(uuid, text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_prepare_product_fact_review_v1(uuid, text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_preflight_product_fact_confirmation_v1(uuid, text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_confirm_product_fact_v1(uuid, text, jsonb, text, text)
  from public, anon, authenticated, service_role;

grant execute on function public.admin_publish_product_fact_registry_v1(uuid, text, jsonb)
  to service_role;
grant execute on function public.admin_ingest_product_fact_evidence_v1(uuid, text, jsonb)
  to service_role;
grant execute on function public.admin_prepare_product_fact_review_v1(uuid, text, jsonb)
  to service_role;
grant execute on function public.admin_preflight_product_fact_confirmation_v1(uuid, text, jsonb)
  to service_role;
grant execute on function public.admin_confirm_product_fact_v1(uuid, text, jsonb, text, text)
  to service_role;

comment on function public.admin_publish_product_fact_registry_v1(uuid, text, jsonb) is
  'Service-role-only controlled Product Fact Registry publish boundary; validates immutable version and definition digests.';
comment on function public.admin_ingest_product_fact_evidence_v1(uuid, text, jsonb) is
  'Service-role-only Product Fact source, subject-binding, and Evidence ingest boundary; never creates Fact instances or Current.';
comment on function public.admin_prepare_product_fact_review_v1(uuid, text, jsonb) is
  'Service-role-only Product Fact review assignment preparation and bounded state-transition boundary.';
comment on function public.admin_preflight_product_fact_confirmation_v1(uuid, text, jsonb) is
  'Read-only Product Fact confirmation preflight; computes payload, fusion-input, and stale-sensitive prestate digests without Product Fact business writes.';
comment on function public.admin_confirm_product_fact_v1(uuid, text, jsonb, text, text) is
  'Service-role-only atomic Product Fact confirmation. Revalidates prestate then writes immutable Fact, evidence links, confirmation, Current pointer, assignment transition, and review event in one transaction.';

do $$
declare
  v_table text;
  v_role text;
  v_rpc text;
begin
  foreach v_table in array array[
    'product_fact_registry_versions',
    'product_fact_definition_snapshots',
    'product_fact_subjects',
    'product_evidence_sources',
    'product_evidence_source_subject_bindings',
    'product_evidence_records',
    'product_fact_instances',
    'product_fact_evidence_links',
    'product_fact_confirmations',
    'product_fact_current',
    'product_fact_review_assignments',
    'product_fact_review_events'
  ]
  loop
    if not (
      select cls.relrowsecurity
      from pg_class as cls
      join pg_namespace as ns on ns.oid = cls.relnamespace
      where ns.nspname = 'public'
        and cls.relname = v_table
    ) then
      raise exception 'product_fact_controlled_write_rls_disabled:%', v_table;
    end if;

    if exists (
      select 1
      from information_schema.role_table_grants as grant_row
      where grant_row.table_schema = 'public'
        and grant_row.table_name = v_table
        and grant_row.grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
        and grant_row.privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
    ) then
      raise exception 'product_fact_controlled_write_direct_table_write_exposed:%', v_table;
    end if;
  end loop;

  foreach v_rpc in array array[
    'public.admin_publish_product_fact_registry_v1(uuid,text,jsonb)',
    'public.admin_ingest_product_fact_evidence_v1(uuid,text,jsonb)',
    'public.admin_prepare_product_fact_review_v1(uuid,text,jsonb)',
    'public.admin_preflight_product_fact_confirmation_v1(uuid,text,jsonb)',
    'public.admin_confirm_product_fact_v1(uuid,text,jsonb,text,text)'
  ]
  loop
    if has_function_privilege('anon', v_rpc, 'EXECUTE')
      or has_function_privilege('authenticated', v_rpc, 'EXECUTE')
      or not has_function_privilege('service_role', v_rpc, 'EXECUTE')
    then
      raise exception 'product_fact_controlled_write_rpc_privilege_invalid:%', v_rpc;
    end if;
  end loop;

  if has_function_privilege(
      'service_role',
      'public.product_fact_controlled_build_preflight_v1(uuid,text,jsonb)',
      'EXECUTE'
    )
    or has_function_privilege(
      'service_role',
      'public.product_fact_controlled_sha256_json_v1(jsonb)',
      'EXECUTE'
    )
  then
    raise exception 'product_fact_controlled_write_internal_helper_exposed';
  end if;
end $$;

commit;
