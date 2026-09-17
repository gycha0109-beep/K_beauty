begin;

-- TRUST Phase 4 / Controlled Evidence Adoption.
-- Converts only a Phase 3 READY operational Evidence candidate into the existing
-- governed Product Fact Evidence -> review -> confirmation-preflight lifecycle.
-- Final Product Fact confirmation is intentionally outside this wrapper.

create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if to_regprocedure('public.admin_require_product_review_actor(uuid,text)') is null
    or to_regprocedure('public.admin_ingest_product_fact_evidence_v1(uuid,text,jsonb)') is null
    or to_regprocedure('public.admin_prepare_product_fact_review_v1(uuid,text,jsonb)') is null
    or to_regprocedure('public.admin_preflight_product_fact_confirmation_v1(uuid,text,jsonb)') is null
    or to_regprocedure('public.product_fact_controlled_latest_registry_v1()') is null
    or to_regprocedure('public.product_fact_controlled_sha256_json_v1(jsonb)') is null then
    raise exception 'trust_phase4_product_fact_authority_missing' using errcode = '55000';
  end if;
end;
$$;

create or replace function public.trust_phase4_build_adoption_plan_v1(
  p_actor_user_id uuid,
  p_candidate_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_candidate public.trust_evidence_candidates%rowtype;
  v_task public.product_fact_research_tasks%rowtype;
  v_intake public.catalog_trust_intake%rowtype;
  v_observation public.trust_source_observations%rowtype;
  v_subject public.product_fact_subjects%rowtype;
  v_catalog_binding public.product_source_bindings%rowtype;
  v_definition public.product_fact_definition_snapshots%rowtype;
  v_existing_evidence public.product_evidence_records%rowtype;
  v_registry_version text;
  v_expected_observation_digest text;
  v_expected_candidate_digest text;
  v_proposition_key text;
  v_scope jsonb;
  v_value_type text;
  v_allowed_values jsonb;
  v_allowed_units jsonb;
  v_cardinality text;
  v_value_boolean boolean;
  v_value_enum text;
  v_value_number numeric;
  v_value_unit text;
  v_value_range_min numeric;
  v_value_range_max numeric;
  v_value_entity_identifier text;
  v_source_payload jsonb;
  v_binding_payload jsonb;
  v_evidence_payload jsonb;
  v_fact_payload_base jsonb;
  v_fusion_policy constant text := 'trust-phase4-single-primary-evidence-v1';
  v_fusion_input_digest text;
  v_open_assignment_count bigint;
begin
  perform public.admin_require_product_review_actor(
    p_actor_user_id,
    'admin.products.review'
  );

  if p_candidate_id is null then
    raise exception 'trust_phase4_candidate_id_required' using errcode = '22023';
  end if;

  select * into v_candidate
  from public.trust_evidence_candidates
  where candidate_id = p_candidate_id;

  if not found then
    raise exception 'trust_phase4_candidate_not_found' using errcode = '22023';
  end if;

  if v_candidate.candidate_state <> 'READY' then
    raise exception 'trust_phase4_candidate_not_ready:%', v_candidate.candidate_state
      using errcode = '55000';
  end if;

  select * into v_task
  from public.product_fact_research_tasks
  where id = v_candidate.research_task_id;

  if not found
    or v_task.state <> 'EVIDENCE_CANDIDATE'
    or v_task.evidence_candidate_id is distinct from v_candidate.candidate_id
    or v_task.source_observation_id is distinct from v_candidate.observation_id
    or v_task.product_id is distinct from v_candidate.product_id
    or v_task.subject_id is distinct from v_candidate.subject_id
    or v_task.registry_version is distinct from v_candidate.registry_version
    or v_task.fact_key is distinct from v_candidate.fact_key then
    raise exception 'trust_phase4_research_task_lineage_invalid' using errcode = '55000';
  end if;

  select * into v_intake
  from public.catalog_trust_intake
  where id = v_task.intake_id;

  if not found
    or v_intake.product_id is distinct from v_candidate.product_id
    or v_intake.identity_state <> 'EXACT_SUBJECT_FOUND'
    or v_intake.subject_id is distinct from v_candidate.subject_id
    or nullif(btrim(coalesce(v_intake.identity_resolution_version, '')), '') is null
    or v_intake.market is distinct from v_candidate.market then
    raise exception 'trust_phase4_intake_identity_invalid' using errcode = '55000';
  end if;

  select * into v_observation
  from public.trust_source_observations
  where observation_id = v_candidate.observation_id;

  if not found
    or v_observation.research_task_id is distinct from v_candidate.research_task_id
    or v_observation.product_id is distinct from v_candidate.product_id
    or v_observation.subject_id is distinct from v_candidate.subject_id
    or v_observation.canonical_locator is distinct from v_task.source_locator
    or v_observation.source_content_digest is distinct from v_task.source_content_digest
    or v_observation.market is distinct from v_candidate.market
    or v_observation.region is distinct from v_candidate.region
    or v_observation.locale is distinct from v_candidate.locale then
    raise exception 'trust_phase4_source_observation_lineage_invalid' using errcode = '55000';
  end if;

  if v_observation.canonical_locator !~ '^https://'
    or v_observation.source_content_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'trust_phase4_source_observation_invalid' using errcode = '22023';
  end if;

  if v_observation.digest_basis = 'frozen-first-party-observation-v1-not-live-page-bytes' then
    v_expected_observation_digest := encode(
      extensions.digest(
        convert_to(
          jsonb_build_object(
            'source_binding_id', v_observation.source_binding_id,
            'canonical_locator', v_observation.canonical_locator,
            'publisher', v_observation.publisher,
            'source_kind', v_observation.source_kind,
            'market', v_observation.market,
            'locale', v_observation.locale,
            'observed_claim', v_observation.observed_claim,
            'product_identity_observation', v_observation.product_identity_observation,
            'observation_version', v_observation.observation_version
          )::text,
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    );

    if v_expected_observation_digest <> v_observation.source_content_digest then
      raise exception 'trust_phase4_source_observation_digest_mismatch' using errcode = '55000';
    end if;
  elsif v_observation.digest_basis <> 'live-page-bytes-v1' then
    raise exception 'trust_phase4_source_digest_basis_invalid' using errcode = '22023';
  end if;

  select * into v_catalog_binding
  from public.product_source_bindings
  where binding_id = v_observation.source_binding_id;

  if not found
    or v_catalog_binding.product_id is distinct from v_candidate.product_id
    or v_catalog_binding.binding_state <> 'resolved'
    or v_catalog_binding.source_name !~ '_official$'
    or v_catalog_binding.source_url is distinct from v_observation.canonical_locator
    or v_catalog_binding.source_url !~ '^https://'
    or v_catalog_binding.market_code is distinct from v_candidate.market
    or v_catalog_binding.locale is distinct from v_candidate.locale then
    raise exception 'trust_phase4_catalog_source_binding_invalid' using errcode = '55000';
  end if;

  select * into v_subject
  from public.product_fact_subjects
  where subject_id = v_candidate.subject_id;

  if not found
    or v_subject.product_id is distinct from v_candidate.product_id
    or v_subject.identity_status <> 'resolved'
    or v_subject.current_state <> 'current'
    or v_subject.market_applicability is distinct from v_candidate.market
    or v_subject.variant_key is not null then
    raise exception 'trust_phase4_subject_identity_invalid' using errcode = '55000';
  end if;

  v_registry_version := public.product_fact_controlled_latest_registry_v1();
  if v_registry_version is null
    or v_registry_version is distinct from v_candidate.registry_version then
    raise exception 'trust_phase4_registry_not_current' using errcode = '55000';
  end if;

  select * into v_definition
  from public.product_fact_definition_snapshots
  where registry_version = v_candidate.registry_version
    and fact_key = v_candidate.fact_key
    and deprecated = false;

  if not found then
    raise exception 'trust_phase4_registry_definition_missing' using errcode = '55000';
  end if;

  if not coalesce(v_definition.definition -> 'permitted_evidence_classes' ? v_candidate.evidence_class, false) then
    raise exception 'trust_phase4_evidence_class_not_permitted' using errcode = '55000';
  end if;

  if v_candidate.evidence_authority <> 'product_specific_primary'
    or v_candidate.support_direction <> 'supports'
    or v_candidate.negative_admissibility <> 'not_applicable' then
    raise exception 'trust_phase4_candidate_requires_adjudication' using errcode = '55000';
  end if;

  if coalesce((v_definition.definition #>> '{relationship_schema,subject_ref_required}')::boolean, false) then
    raise exception 'trust_phase4_parent_proposition_required' using errcode = '55000';
  end if;

  if jsonb_typeof(v_candidate.qualifier) <> 'object' then
    raise exception 'trust_phase4_qualifier_invalid' using errcode = '22023';
  end if;

  v_value_type := v_definition.value_type;
  v_allowed_values := v_definition.definition -> 'allowed_values';
  v_allowed_units := v_definition.definition #> '{unit_schema,allowed_units}';
  v_cardinality := coalesce(v_definition.definition ->> 'cardinality', 'one');

  if v_value_type = 'boolean' then
    if jsonb_typeof(v_candidate.normalized_value) <> 'boolean' then
      raise exception 'trust_phase4_normalized_value_invalid:boolean' using errcode = '22023';
    end if;
    v_value_boolean := (v_candidate.normalized_value #>> '{}')::boolean;
  elsif v_value_type = 'enum' then
    if jsonb_typeof(v_candidate.normalized_value) <> 'string' then
      raise exception 'trust_phase4_normalized_value_invalid:enum' using errcode = '22023';
    end if;
    v_value_enum := v_candidate.normalized_value #>> '{}';
    if jsonb_typeof(v_allowed_values) = 'array' and not (v_allowed_values ? v_value_enum) then
      raise exception 'trust_phase4_enum_value_invalid' using errcode = '22023';
    end if;
  elsif v_value_type = 'number' then
    if jsonb_typeof(v_candidate.normalized_value) <> 'number' then
      raise exception 'trust_phase4_normalized_value_invalid:number' using errcode = '22023';
    end if;
    v_value_number := (v_candidate.normalized_value #>> '{}')::numeric;
  elsif v_value_type = 'entity_identifier' then
    if jsonb_typeof(v_candidate.normalized_value) <> 'string'
      or nullif(btrim(v_candidate.normalized_value #>> '{}'), '') is null then
      raise exception 'trust_phase4_normalized_value_invalid:entity_identifier' using errcode = '22023';
    end if;
    v_value_entity_identifier := v_candidate.normalized_value #>> '{}';
  elsif v_value_type = 'number_unit' then
    if jsonb_typeof(v_candidate.normalized_value) <> 'object'
      or not (v_candidate.normalized_value ?& array['amount','unit'])
      or (select count(*) from jsonb_object_keys(v_candidate.normalized_value)) <> 2
      or jsonb_typeof(v_candidate.normalized_value -> 'amount') <> 'number'
      or jsonb_typeof(v_candidate.normalized_value -> 'unit') <> 'string' then
      raise exception 'trust_phase4_normalized_value_invalid:number_unit' using errcode = '22023';
    end if;
    v_value_number := (v_candidate.normalized_value ->> 'amount')::numeric;
    v_value_unit := v_candidate.normalized_value ->> 'unit';
    if jsonb_typeof(v_allowed_units) = 'array' and not (v_allowed_units ? v_value_unit) then
      raise exception 'trust_phase4_unit_invalid' using errcode = '22023';
    end if;
  elsif v_value_type = 'range_unit' then
    if jsonb_typeof(v_candidate.normalized_value) <> 'object'
      or not (v_candidate.normalized_value ?& array['min','max','unit'])
      or (select count(*) from jsonb_object_keys(v_candidate.normalized_value)) <> 3
      or jsonb_typeof(v_candidate.normalized_value -> 'min') <> 'number'
      or jsonb_typeof(v_candidate.normalized_value -> 'max') <> 'number'
      or jsonb_typeof(v_candidate.normalized_value -> 'unit') <> 'string' then
      raise exception 'trust_phase4_normalized_value_invalid:range_unit' using errcode = '22023';
    end if;
    v_value_range_min := (v_candidate.normalized_value ->> 'min')::numeric;
    v_value_range_max := (v_candidate.normalized_value ->> 'max')::numeric;
    v_value_unit := v_candidate.normalized_value ->> 'unit';
    if v_value_range_min > v_value_range_max then
      raise exception 'trust_phase4_range_invalid' using errcode = '22023';
    end if;
    if jsonb_typeof(v_allowed_units) = 'array' and not (v_allowed_units ? v_value_unit) then
      raise exception 'trust_phase4_unit_invalid' using errcode = '22023';
    end if;
  else
    raise exception 'trust_phase4_value_type_unsupported:%', v_value_type using errcode = '55000';
  end if;

  v_expected_candidate_digest := encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'subject_id', v_candidate.subject_id,
          'registry_version', v_candidate.registry_version,
          'fact_key', v_candidate.fact_key,
          'normalized_value', v_candidate.normalized_value,
          'evidence_class', v_candidate.evidence_class,
          'support_direction', v_candidate.support_direction,
          'negative_admissibility', v_candidate.negative_admissibility,
          'market', v_candidate.market,
          'region', v_candidate.region,
          'locale', v_candidate.locale,
          'qualifier', v_candidate.qualifier,
          'source_content_digest', v_observation.source_content_digest
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  if v_expected_candidate_digest <> v_candidate.canonical_evidence_digest then
    raise exception 'trust_phase4_candidate_digest_mismatch' using errcode = '55000';
  end if;

  v_scope := jsonb_strip_nulls(jsonb_build_object(
    'market', v_candidate.market,
    'variant', v_subject.variant_key
  ));

  v_proposition_key := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object(
      'serializer_version', 'product-fact-proposition-pilot-v1',
      'subject_semantic_key', v_subject.subject_semantic_key,
      'registry_version', v_candidate.registry_version,
      'fact_key', v_candidate.fact_key,
      'value_identity', v_candidate.normalized_value,
      'scope', v_scope,
      'qualifier', v_candidate.qualifier,
      'parent_proposition_key', null
    )
  );

  if exists (
    select 1 from public.product_fact_current c
    where c.proposition_key = v_proposition_key
  ) then
    raise exception 'trust_phase4_candidate_already_current' using errcode = '55000';
  end if;

  if v_cardinality = 'one' and exists (
    select 1
    from public.product_fact_current c
    join public.product_fact_instances fi on fi.fact_instance_id = c.fact_instance_id
    where c.subject_id = v_candidate.subject_id
      and fi.registry_version = v_candidate.registry_version
      and fi.fact_key = v_candidate.fact_key
      and c.proposition_key <> v_proposition_key
  ) then
    raise exception 'trust_phase4_cardinality_collision' using errcode = '55000';
  end if;

  if exists (
    select 1 from public.product_fact_instances fi
    where fi.proposition_key = v_proposition_key
      and (
        fi.subject_id <> v_candidate.subject_id
        or fi.registry_version <> v_candidate.registry_version
        or fi.fact_key <> v_candidate.fact_key
      )
  ) then
    raise exception 'trust_phase4_proposition_collision' using errcode = '55000';
  end if;

  select * into v_existing_evidence
  from public.product_evidence_records
  where canonical_evidence_digest = v_candidate.canonical_evidence_digest;

  if found and (
    v_existing_evidence.subject_id <> v_candidate.subject_id
    or v_existing_evidence.registry_version <> v_candidate.registry_version
    or v_existing_evidence.fact_key <> v_candidate.fact_key
    or v_existing_evidence.proposition_key <> v_proposition_key
    or v_existing_evidence.proposition_serializer_version <> 'product-fact-proposition-pilot-v1'
    or v_existing_evidence.proposition_value_identity is distinct from v_candidate.normalized_value
    or v_existing_evidence.parent_proposition_key is not null
    or v_existing_evidence.evidence_class <> v_candidate.evidence_class
    or v_existing_evidence.evidence_authority <> v_candidate.evidence_authority
    or v_existing_evidence.confidence <> v_candidate.confidence
    or v_existing_evidence.support_direction <> v_candidate.support_direction
    or v_existing_evidence.negative_admissibility <> v_candidate.negative_admissibility
    or v_existing_evidence.market is distinct from v_candidate.market
    or v_existing_evidence.region is distinct from v_candidate.region
    or v_existing_evidence.locale is distinct from v_candidate.locale
    or v_existing_evidence.qualifier is distinct from v_candidate.qualifier
  ) then
    raise exception 'trust_phase4_governed_evidence_collision' using errcode = '55000';
  end if;

  select count(*) into v_open_assignment_count
  from public.product_fact_review_assignments a
  where a.product_id = v_candidate.product_id
    and a.subject_id = v_candidate.subject_id
    and a.registry_version = v_candidate.registry_version
    and a.fact_key = v_candidate.fact_key
    and a.proposition_key = v_proposition_key
    and a.operational_state not in ('confirmed','superseded');

  if v_open_assignment_count > 1 then
    raise exception 'trust_phase4_duplicate_open_assignments' using errcode = '55000';
  end if;

  v_source_payload := jsonb_build_object(
    'canonical_locator', v_observation.canonical_locator,
    'publisher', v_observation.publisher,
    'source_kind', v_observation.source_kind,
    'source_metadata', jsonb_build_object('digest_basis', v_observation.digest_basis),
    'content_digest', v_observation.source_content_digest,
    'external_snapshot_reference', null,
    'market', v_observation.market,
    'region', v_observation.region,
    'locale', v_observation.locale,
    'published_at', null,
    'accessed_at', coalesce(v_observation.fetched_at, v_observation.observed_at),
    'observed_at', v_observation.observed_at
  );

  v_binding_payload := jsonb_build_object(
    'product_id', v_candidate.product_id,
    'subject_id', v_candidate.subject_id,
    'binding_state', 'exact_subject_match',
    'scope_relation', 'equivalent',
    'presentation_metadata', jsonb_build_object(
      'catalog_source_binding_id', v_observation.source_binding_id
    ),
    'identity_resolution_version', v_intake.identity_resolution_version,
    'reviewed_at', v_candidate.created_at
  );

  v_evidence_payload := jsonb_build_object(
    'registry_version', v_candidate.registry_version,
    'fact_key', v_candidate.fact_key,
    'proposition_key', v_proposition_key,
    'proposition_serializer_version', 'product-fact-proposition-pilot-v1',
    'proposition_value_identity', v_candidate.normalized_value,
    'parent_proposition_key', null,
    'evidence_class', v_candidate.evidence_class,
    'evidence_authority', v_candidate.evidence_authority,
    'confidence', v_candidate.confidence,
    'support_direction', v_candidate.support_direction,
    'negative_admissibility', v_candidate.negative_admissibility,
    'market', v_candidate.market,
    'region', v_candidate.region,
    'locale', v_candidate.locale,
    'valid_from', null,
    'valid_to', null,
    'qualifier', v_candidate.qualifier,
    'canonical_evidence_digest', v_candidate.canonical_evidence_digest,
    'supersedes_evidence_id', null
  );

  v_fusion_input_digest := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object(
      'fusion_policy_version', v_fusion_policy,
      'proposition_key', v_proposition_key,
      'supporting_evidence_digests', jsonb_build_array(v_candidate.canonical_evidence_digest),
      'opposing_evidence_digests', '[]'::jsonb
    )
  );

  v_fact_payload_base := jsonb_build_object(
    'subject_id', v_candidate.subject_id,
    'registry_version', v_candidate.registry_version,
    'fact_key', v_candidate.fact_key,
    'proposition_key', v_proposition_key,
    'proposition_serializer_version', 'product-fact-proposition-pilot-v1',
    'semantic_status', 'supported',
    'value_type', v_value_type,
    'value_boolean', v_value_boolean,
    'value_enum', v_value_enum,
    'value_number', v_value_number,
    'value_unit', v_value_unit,
    'value_range_min', v_value_range_min,
    'value_range_max', v_value_range_max,
    'value_entity_identifier', v_value_entity_identifier,
    'market', v_candidate.market,
    'region', v_candidate.region,
    'locale', v_candidate.locale,
    'valid_from', null,
    'valid_to', null,
    'qualifier', v_candidate.qualifier,
    'parent_fact_instance_id', null,
    'parent_proposition_key', null,
    'authority_ceiling', 'product_specific_primary',
    'fused_confidence', v_candidate.confidence,
    'fusion_policy_version', v_fusion_policy,
    'fusion_input_digest', v_fusion_input_digest
  );

  return jsonb_build_object(
    'candidate_id', v_candidate.candidate_id,
    'product_id', v_candidate.product_id,
    'subject_id', v_candidate.subject_id,
    'registry_version', v_candidate.registry_version,
    'fact_key', v_candidate.fact_key,
    'proposition_key', v_proposition_key,
    'proposition_serializer_version', 'product-fact-proposition-pilot-v1',
    'canonical_evidence_digest', v_candidate.canonical_evidence_digest,
    'source_payload', v_source_payload,
    'binding_payload', v_binding_payload,
    'evidence_payload', v_evidence_payload,
    'fact_payload_base', v_fact_payload_base,
    'open_assignment_count', v_open_assignment_count
  );
end;
$$;

create or replace function public.admin_preflight_trust_evidence_adoption_v1(
  p_actor_user_id uuid,
  p_candidate_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_plan jsonb;
begin
  v_plan := public.trust_phase4_build_adoption_plan_v1(
    p_actor_user_id,
    p_candidate_id
  );

  return jsonb_build_object(
    'status', 'ready',
    'candidate_id', p_candidate_id,
    'product_id', v_plan ->> 'product_id',
    'subject_id', v_plan ->> 'subject_id',
    'registry_version', v_plan ->> 'registry_version',
    'fact_key', v_plan ->> 'fact_key',
    'proposition_key', v_plan ->> 'proposition_key',
    'canonical_evidence_digest', v_plan ->> 'canonical_evidence_digest',
    'open_assignment_count', (v_plan ->> 'open_assignment_count')::integer,
    'expected_governed_write_boundary', jsonb_build_array(
      'evidence_ingest',
      'review_prepare',
      'confirmation_preflight'
    ),
    'automatic_confirmation', false
  );
end;
$$;

create or replace function public.admin_adopt_trust_evidence_candidate_v1(
  p_actor_user_id uuid,
  p_request_id text,
  p_candidate_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_request_id text := btrim(coalesce(p_request_id, ''));
  v_plan jsonb;
  v_ingest jsonb;
  v_review jsonb;
  v_preflight jsonb;
  v_confirmation_payload jsonb;
  v_confirmation_request_id text;
  v_evidence_id uuid;
  v_assignment public.product_fact_review_assignments%rowtype;
  v_assignment_count bigint;
  v_reused_assignment boolean := false;
begin
  if char_length(v_request_id) not between 8 and 80 then
    raise exception 'trust_phase4_request_id_invalid' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_candidate_id::text, 0));

  v_plan := public.trust_phase4_build_adoption_plan_v1(
    p_actor_user_id,
    p_candidate_id
  );

  v_ingest := public.admin_ingest_product_fact_evidence_v1(
    p_actor_user_id,
    v_request_id || ':ingest',
    jsonb_build_object(
      'source', v_plan -> 'source_payload',
      'binding', v_plan -> 'binding_payload',
      'evidence', v_plan -> 'evidence_payload'
    )
  );

  if v_ingest ->> 'status' <> 'evidence_recorded' then
    raise exception 'trust_phase4_governed_ingest_not_recorded' using errcode = '55000';
  end if;

  v_evidence_id := nullif(v_ingest ->> 'evidence_id', '')::uuid;
  if v_evidence_id is null then
    raise exception 'trust_phase4_governed_evidence_id_missing' using errcode = '55000';
  end if;

  select count(*) into v_assignment_count
  from public.product_fact_review_assignments a
  where a.product_id = (v_plan ->> 'product_id')::uuid
    and a.subject_id = (v_plan ->> 'subject_id')::uuid
    and a.registry_version = v_plan ->> 'registry_version'
    and a.fact_key = v_plan ->> 'fact_key'
    and a.proposition_key = v_plan ->> 'proposition_key'
    and a.operational_state not in ('confirmed','superseded');

  if v_assignment_count > 1 then
    raise exception 'trust_phase4_duplicate_open_assignments' using errcode = '55000';
  end if;

  if v_assignment_count = 1 then
    select * into v_assignment
    from public.product_fact_review_assignments a
    where a.product_id = (v_plan ->> 'product_id')::uuid
      and a.subject_id = (v_plan ->> 'subject_id')::uuid
      and a.registry_version = v_plan ->> 'registry_version'
      and a.fact_key = v_plan ->> 'fact_key'
      and a.proposition_key = v_plan ->> 'proposition_key'
      and a.operational_state not in ('confirmed','superseded')
    order by a.created_at desc, a.assignment_id desc
    limit 1
    for update;

    if v_assignment.assigned_to is distinct from p_actor_user_id
      or v_assignment.review_policy_version <> 'trust-phase4-controlled-evidence-adoption-v1'
      or v_assignment.operational_state not in ('under_review','ready_for_confirm') then
      raise exception 'trust_phase4_existing_assignment_not_reusable' using errcode = '55000';
    end if;
    v_reused_assignment := true;
  else
    v_review := public.admin_prepare_product_fact_review_v1(
      p_actor_user_id,
      v_request_id || ':review:under',
      jsonb_build_object(
        'product_id', v_plan ->> 'product_id',
        'subject_id', v_plan ->> 'subject_id',
        'registry_version', v_plan ->> 'registry_version',
        'fact_key', v_plan ->> 'fact_key',
        'proposition_key', v_plan ->> 'proposition_key',
        'operational_state', 'under_review',
        'assigned_to', p_actor_user_id,
        'review_policy_version', 'trust-phase4-controlled-evidence-adoption-v1',
        'reason_code', 'trust_phase4_controlled_evidence_adoption'
      )
    );

    if v_review ->> 'status' <> 'prepared' then
      raise exception 'trust_phase4_review_prepare_failed' using errcode = '55000';
    end if;

    select * into v_assignment
    from public.product_fact_review_assignments
    where assignment_id = (v_review ->> 'assignment_id')::uuid
    for update;
  end if;

  if v_assignment.operational_state = 'under_review' then
    v_review := public.admin_prepare_product_fact_review_v1(
      p_actor_user_id,
      v_request_id || ':review:ready',
      jsonb_build_object(
        'product_id', v_plan ->> 'product_id',
        'subject_id', v_plan ->> 'subject_id',
        'registry_version', v_plan ->> 'registry_version',
        'fact_key', v_plan ->> 'fact_key',
        'proposition_key', v_plan ->> 'proposition_key',
        'operational_state', 'ready_for_confirm',
        'assigned_to', p_actor_user_id,
        'review_policy_version', 'trust-phase4-controlled-evidence-adoption-v1',
        'reason_code', 'trust_phase4_controlled_evidence_ready'
      )
    );

    if v_review ->> 'status' <> 'prepared'
      or v_review ->> 'operational_state' <> 'ready_for_confirm' then
      raise exception 'trust_phase4_ready_transition_failed' using errcode = '55000';
    end if;

    select * into v_assignment
    from public.product_fact_review_assignments
    where assignment_id = (v_review ->> 'assignment_id')::uuid
    for update;
  end if;

  if v_assignment.operational_state <> 'ready_for_confirm' then
    raise exception 'trust_phase4_assignment_not_ready' using errcode = '55000';
  end if;

  v_confirmation_payload := (v_plan -> 'fact_payload_base') || jsonb_build_object(
    'assignment_id', v_assignment.assignment_id,
    'supporting_evidence_ids', jsonb_build_array(v_evidence_id),
    'opposing_evidence_ids', '[]'::jsonb
  );

  v_confirmation_request_id := v_request_id || ':confirm';
  v_preflight := public.admin_preflight_product_fact_confirmation_v1(
    p_actor_user_id,
    v_confirmation_request_id,
    v_confirmation_payload
  );

  if v_preflight ->> 'status' <> 'ready' then
    raise exception 'trust_phase4_product_fact_preflight_not_ready' using errcode = '55000';
  end if;

  return jsonb_build_object(
    'status', 'ready_for_explicit_confirmation',
    'candidate_id', p_candidate_id,
    'product_id', v_plan ->> 'product_id',
    'subject_id', v_plan ->> 'subject_id',
    'registry_version', v_plan ->> 'registry_version',
    'fact_key', v_plan ->> 'fact_key',
    'proposition_key', v_plan ->> 'proposition_key',
    'canonical_evidence_digest', v_plan ->> 'canonical_evidence_digest',
    'governed_source_id', v_ingest ->> 'source_id',
    'governed_binding_id', v_ingest ->> 'binding_id',
    'governed_evidence_id', v_evidence_id,
    'assignment_id', v_assignment.assignment_id,
    'assignment_reused', v_reused_assignment,
    'confirmation_request_id', v_confirmation_request_id,
    'confirmation_payload', v_confirmation_payload,
    'product_fact_preflight', v_preflight,
    'automatic_confirmation', false
  );
end;
$$;

comment on function public.admin_preflight_trust_evidence_adoption_v1(uuid, uuid) is
  'TRUST Phase 4 zero-write gate for an exact Phase 3 READY candidate. Requires admin.products.review.';
comment on function public.admin_adopt_trust_evidence_candidate_v1(uuid, text, uuid) is
  'TRUST Phase 4 governed Evidence/review/preflight handoff. Final Product Fact confirmation remains a separate explicit admin action.';

revoke all on function public.trust_phase4_build_adoption_plan_v1(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_preflight_trust_evidence_adoption_v1(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_adopt_trust_evidence_candidate_v1(uuid, text, uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.admin_preflight_trust_evidence_adoption_v1(uuid, uuid)
  to service_role;
grant execute on function public.admin_adopt_trust_evidence_candidate_v1(uuid, text, uuid)
  to service_role;

commit;
