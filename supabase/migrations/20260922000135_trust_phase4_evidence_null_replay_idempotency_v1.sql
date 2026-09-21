-- TRUST Phase 4 replay hardening: normalize JSON null proposition identity to SQL NULL.
-- This preserves exact Evidence replay idempotency for relational/number_unit facts.

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
        nullif(v_evidence -> 'proposition_value_identity', 'null'::jsonb)
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


comment on function public.admin_ingest_product_fact_evidence_v1(uuid, text, jsonb) is
  'Service-role-only Product Fact source, subject-binding, and Evidence ingest boundary; exact replay normalizes JSON null proposition identity to SQL NULL.';
