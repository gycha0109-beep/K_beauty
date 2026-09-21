begin;

alter table public.product_fact_revalidation_resolutions
  drop constraint product_fact_revalidation_resolutions_kind_check;

alter table public.product_fact_revalidation_resolutions
  add constraint product_fact_revalidation_resolutions_kind_check
  check (resolution_kind in (
    'SAME_SEMANTIC_REAFFIRMATION',
    'SEMANTIC_CHANGE_REPLACEMENT'
  ));

create or replace function public.trust_phase8f_build_replacement_fact_payload_v1(
  p_actor_user_id uuid,
  p_transition_id uuid,
  p_candidate_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_plan jsonb;
  v_candidate public.trust_evidence_candidates%rowtype;
  v_definition public.product_fact_definition_snapshots%rowtype;
  v_value_type text;
  v_allowed_values jsonb;
  v_allowed_units jsonb;
  v_value_boolean boolean;
  v_value_enum text;
  v_value_number numeric;
  v_value_unit text;
  v_value_range_min numeric;
  v_value_range_max numeric;
  v_value_entity_identifier text;
  v_fusion_policy constant text := 'trust-phase8f-revalidation-replacement-v1';
  v_fusion_input_digest text;
  v_fact_payload_base jsonb;
begin
  v_plan := public.trust_phase8e_build_revalidation_plan_v1(
    p_actor_user_id,
    p_transition_id,
    p_candidate_id
  );

  if v_plan ->> 'semantic_relation' <> 'SEMANTIC_CHANGE' then
    raise exception 'product_fact_revalidation_replacement_not_semantic_change'
      using errcode = '55000';
  end if;

  select * into v_candidate
  from public.trust_evidence_candidates
  where candidate_id = p_candidate_id;

  if not found then
    raise exception 'product_fact_revalidation_replacement_candidate_missing'
      using errcode = 'P0002';
  end if;

  select * into v_definition
  from public.product_fact_definition_snapshots
  where registry_version = v_candidate.registry_version
    and fact_key = v_candidate.fact_key
    and deprecated = false;

  if not found then
    raise exception 'product_fact_revalidation_replacement_definition_missing'
      using errcode = '55000';
  end if;

  if coalesce((v_definition.definition #>> '{relationship_schema,subject_ref_required}')::boolean, false) then
    raise exception 'product_fact_revalidation_replacement_parent_proposition_required'
      using errcode = '55000';
  end if;

  v_value_type := v_definition.value_type;
  v_allowed_values := v_definition.definition -> 'allowed_values';
  v_allowed_units := v_definition.definition #> '{unit_schema,allowed_units}';

  if v_value_type = 'boolean' then
    if jsonb_typeof(v_candidate.normalized_value) <> 'boolean' then
      raise exception 'product_fact_revalidation_replacement_value_invalid:boolean'
        using errcode = '22023';
    end if;
    v_value_boolean := (v_candidate.normalized_value #>> '{}')::boolean;
  elsif v_value_type = 'enum' then
    if jsonb_typeof(v_candidate.normalized_value) <> 'string' then
      raise exception 'product_fact_revalidation_replacement_value_invalid:enum'
        using errcode = '22023';
    end if;
    v_value_enum := v_candidate.normalized_value #>> '{}';
    if jsonb_typeof(v_allowed_values) = 'array' and not (v_allowed_values ? v_value_enum) then
      raise exception 'product_fact_revalidation_replacement_enum_invalid'
        using errcode = '22023';
    end if;
  elsif v_value_type = 'number' then
    if jsonb_typeof(v_candidate.normalized_value) <> 'number' then
      raise exception 'product_fact_revalidation_replacement_value_invalid:number'
        using errcode = '22023';
    end if;
    v_value_number := (v_candidate.normalized_value #>> '{}')::numeric;
  elsif v_value_type = 'entity_identifier' then
    if jsonb_typeof(v_candidate.normalized_value) <> 'string'
      or nullif(btrim(v_candidate.normalized_value #>> '{}'), '') is null then
      raise exception 'product_fact_revalidation_replacement_value_invalid:entity_identifier'
        using errcode = '22023';
    end if;
    v_value_entity_identifier := v_candidate.normalized_value #>> '{}';
  elsif v_value_type = 'number_unit' then
    if jsonb_typeof(v_candidate.normalized_value) <> 'object'
      or not (v_candidate.normalized_value ?& array['amount','unit'])
      or (select count(*) from jsonb_object_keys(v_candidate.normalized_value)) <> 2
      or jsonb_typeof(v_candidate.normalized_value -> 'amount') <> 'number'
      or jsonb_typeof(v_candidate.normalized_value -> 'unit') <> 'string' then
      raise exception 'product_fact_revalidation_replacement_value_invalid:number_unit'
        using errcode = '22023';
    end if;
    v_value_number := (v_candidate.normalized_value ->> 'amount')::numeric;
    v_value_unit := v_candidate.normalized_value ->> 'unit';
    if jsonb_typeof(v_allowed_units) = 'array' and not (v_allowed_units ? v_value_unit) then
      raise exception 'product_fact_revalidation_replacement_unit_invalid'
        using errcode = '22023';
    end if;
  elsif v_value_type = 'range_unit' then
    if jsonb_typeof(v_candidate.normalized_value) <> 'object'
      or not (v_candidate.normalized_value ?& array['min','max','unit'])
      or (select count(*) from jsonb_object_keys(v_candidate.normalized_value)) <> 3
      or jsonb_typeof(v_candidate.normalized_value -> 'min') <> 'number'
      or jsonb_typeof(v_candidate.normalized_value -> 'max') <> 'number'
      or jsonb_typeof(v_candidate.normalized_value -> 'unit') <> 'string' then
      raise exception 'product_fact_revalidation_replacement_value_invalid:range_unit'
        using errcode = '22023';
    end if;
    v_value_range_min := (v_candidate.normalized_value ->> 'min')::numeric;
    v_value_range_max := (v_candidate.normalized_value ->> 'max')::numeric;
    v_value_unit := v_candidate.normalized_value ->> 'unit';
    if v_value_range_min > v_value_range_max then
      raise exception 'product_fact_revalidation_replacement_range_invalid'
        using errcode = '22023';
    end if;
    if jsonb_typeof(v_allowed_units) = 'array' and not (v_allowed_units ? v_value_unit) then
      raise exception 'product_fact_revalidation_replacement_unit_invalid'
        using errcode = '22023';
    end if;
  else
    raise exception 'product_fact_revalidation_replacement_value_type_unsupported:%', v_value_type
      using errcode = '55000';
  end if;

  v_fusion_input_digest := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object(
      'fusion_policy_version', v_fusion_policy,
      'proposition_key', v_plan ->> 'candidate_proposition_key',
      'supporting_evidence_digests',
        jsonb_build_array(v_candidate.canonical_evidence_digest),
      'opposing_evidence_digests', '[]'::jsonb
    )
  );

  v_fact_payload_base := jsonb_build_object(
    'subject_id', v_candidate.subject_id,
    'registry_version', v_candidate.registry_version,
    'fact_key', v_candidate.fact_key,
    'proposition_key', v_plan ->> 'candidate_proposition_key',
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

  return v_plan || jsonb_build_object(
    'subject_id', v_candidate.subject_id,
    'fact_payload_base', v_fact_payload_base,
    'fusion_policy_version', v_fusion_policy,
    'fusion_input_digest', v_fusion_input_digest
  );
end;
$$;

create or replace function public.admin_prepare_product_fact_revalidation_replacement_v1(
  p_actor_user_id uuid,
  p_request_id text,
  p_transition_id uuid,
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
  v_evidence_id uuid;
  v_evidence public.product_evidence_records%rowtype;
  v_is_explicit_negative boolean;
  v_fusion_input_digest text;
  v_assignment public.product_fact_review_assignments%rowtype;
  v_assignment_count bigint;
  v_review jsonb;
  v_confirmation_payload jsonb;
  v_confirmation_request_id text;
  v_preflight jsonb;
  v_replacement_prestate_digest text;
begin
  if char_length(v_request_id) not between 8 and 80 then
    raise exception 'product_fact_revalidation_replacement_request_invalid'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('bejewely_product_fact_revalidation_replacement:' || p_transition_id::text, 0)
  );

  v_plan := public.trust_phase8f_build_replacement_fact_payload_v1(
    p_actor_user_id,
    p_transition_id,
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
    raise exception 'product_fact_revalidation_replacement_evidence_not_recorded'
      using errcode = '55000';
  end if;

  v_evidence_id := nullif(v_ingest ->> 'evidence_id', '')::uuid;
  if v_evidence_id is null then
    raise exception 'product_fact_revalidation_replacement_evidence_id_missing'
      using errcode = '55000';
  end if;

  select * into v_evidence
  from public.product_evidence_records
  where evidence_id = v_evidence_id;

  if not found
    or v_evidence.subject_id is distinct from (v_plan ->> 'subject_id')::uuid
    or v_evidence.proposition_key is distinct from v_plan ->> 'candidate_proposition_key'
    or v_evidence.canonical_evidence_digest is distinct from (
      select canonical_evidence_digest
      from public.trust_evidence_candidates
      where candidate_id = p_candidate_id
    ) then
    raise exception 'product_fact_revalidation_replacement_evidence_mismatch'
      using errcode = '55000';
  end if;

  v_is_explicit_negative :=
    v_evidence.support_direction = 'opposes'
    and v_evidence.negative_admissibility = 'explicit_negative';

  if not v_is_explicit_negative
    and not (
      v_evidence.support_direction = 'supports'
      and v_evidence.negative_admissibility = 'not_applicable'
    ) then
    raise exception 'product_fact_revalidation_replacement_evidence_role_invalid'
      using errcode = '55000';
  end if;

  select count(*) into v_assignment_count
  from public.product_fact_review_assignments a
  where a.product_id = (
      select product_id from public.trust_evidence_candidates where candidate_id = p_candidate_id
    )
    and a.subject_id = (v_plan ->> 'subject_id')::uuid
    and a.registry_version = (
      select registry_version from public.trust_evidence_candidates where candidate_id = p_candidate_id
    )
    and a.fact_key = (
      select fact_key from public.trust_evidence_candidates where candidate_id = p_candidate_id
    )
    and a.proposition_key = v_plan ->> 'candidate_proposition_key'
    and a.operational_state not in ('confirmed','superseded');

  if v_assignment_count > 1 then
    raise exception 'product_fact_revalidation_replacement_duplicate_assignments'
      using errcode = '55000';
  end if;

  if v_assignment_count = 1 then
    select * into v_assignment
    from public.product_fact_review_assignments a
    where a.product_id = (
        select product_id from public.trust_evidence_candidates where candidate_id = p_candidate_id
      )
      and a.subject_id = (v_plan ->> 'subject_id')::uuid
      and a.registry_version = (
        select registry_version from public.trust_evidence_candidates where candidate_id = p_candidate_id
      )
      and a.fact_key = (
        select fact_key from public.trust_evidence_candidates where candidate_id = p_candidate_id
      )
      and a.proposition_key = v_plan ->> 'candidate_proposition_key'
      and a.operational_state not in ('confirmed','superseded')
    order by a.created_at desc, a.assignment_id desc
    limit 1
    for update;

    if v_assignment.review_policy_version <> 'trust-phase8f-revalidation-replacement-v1'
      or v_assignment.assigned_to is distinct from p_actor_user_id
      or v_assignment.operational_state not in ('under_review','ready_for_confirm') then
      raise exception 'product_fact_revalidation_replacement_assignment_not_reusable'
        using errcode = '55000';
    end if;
  else
    v_review := public.admin_prepare_product_fact_review_v1(
      p_actor_user_id,
      v_request_id || ':review:under',
      jsonb_build_object(
        'product_id', (
          select product_id from public.trust_evidence_candidates where candidate_id = p_candidate_id
        ),
        'subject_id', v_plan ->> 'subject_id',
        'registry_version', (
          select registry_version from public.trust_evidence_candidates where candidate_id = p_candidate_id
        ),
        'fact_key', (
          select fact_key from public.trust_evidence_candidates where candidate_id = p_candidate_id
        ),
        'proposition_key', v_plan ->> 'candidate_proposition_key',
        'operational_state', 'under_review',
        'assigned_to', p_actor_user_id,
        'review_policy_version', 'trust-phase8f-revalidation-replacement-v1',
        'reason_code', 'revalidation_semantic_change'
      )
    );

    if v_review ->> 'status' <> 'prepared' then
      raise exception 'product_fact_revalidation_replacement_review_prepare_failed'
        using errcode = '55000';
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
        'product_id', v_assignment.product_id,
        'subject_id', v_assignment.subject_id,
        'registry_version', v_assignment.registry_version,
        'fact_key', v_assignment.fact_key,
        'proposition_key', v_assignment.proposition_key,
        'operational_state', 'ready_for_confirm',
        'assigned_to', p_actor_user_id,
        'review_policy_version', v_assignment.review_policy_version,
        'reason_code', 'revalidation_semantic_change_ready'
      )
    );

    if v_review ->> 'status' <> 'prepared'
      or v_review ->> 'operational_state' <> 'ready_for_confirm' then
      raise exception 'product_fact_revalidation_replacement_ready_failed'
        using errcode = '55000';
    end if;

    select * into v_assignment
    from public.product_fact_review_assignments
    where assignment_id = (v_review ->> 'assignment_id')::uuid
    for update;
  end if;

  if v_assignment.operational_state <> 'ready_for_confirm' then
    raise exception 'product_fact_revalidation_replacement_assignment_not_ready'
      using errcode = '55000';
  end if;

  if v_is_explicit_negative and (
    v_plan #>> '{fact_payload_base,value_type}' <> 'boolean'
    or coalesce((v_plan #>> '{fact_payload_base,value_boolean}')::boolean, true) <> false
  ) then
    raise exception 'product_fact_revalidation_replacement_explicit_negative_requires_false_boolean'
      using errcode = '55000';
  end if;

  v_fusion_input_digest := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object(
      'registry_version', v_evidence.registry_version,
      'subject_id', v_evidence.subject_id,
      'fact_key', v_evidence.fact_key,
      'proposition_key', v_evidence.proposition_key,
      'fusion_policy_version', v_plan ->> 'fusion_policy_version',
      'evidence', jsonb_build_array(
        jsonb_build_object(
          'evidence_id', v_evidence.evidence_id,
          'role', case when v_is_explicit_negative then 'opposing' else 'supporting' end,
          'canonical_evidence_digest', v_evidence.canonical_evidence_digest,
          'evidence_authority', v_evidence.evidence_authority,
          'confidence', v_evidence.confidence,
          'support_direction', v_evidence.support_direction,
          'negative_admissibility', v_evidence.negative_admissibility
        )
      )
    )
  );

  v_confirmation_payload := (v_plan -> 'fact_payload_base') || jsonb_build_object(
    'assignment_id', v_assignment.assignment_id,
    'fusion_policy_version', v_plan ->> 'fusion_policy_version',
    'fusion_input_digest', v_fusion_input_digest,
    'supporting_evidence_ids',
      case when v_is_explicit_negative then '[]'::jsonb else jsonb_build_array(v_evidence_id) end,
    'opposing_evidence_ids',
      case when v_is_explicit_negative then jsonb_build_array(v_evidence_id) else '[]'::jsonb end
  );

  v_confirmation_request_id := v_request_id || ':confirm';
  v_preflight := public.admin_preflight_product_fact_confirmation_v1(
    p_actor_user_id,
    v_confirmation_request_id,
    v_confirmation_payload
  );

  if v_preflight ->> 'status' <> 'ready'
    or v_preflight -> 'previous_current' <> 'null'::jsonb then
    raise exception 'product_fact_revalidation_replacement_confirmation_preflight_invalid'
      using errcode = '55000';
  end if;

  v_replacement_prestate_digest := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object(
      'revalidation_prestate_digest', v_plan ->> 'prestate_digest',
      'confirmation_prestate_digest', v_preflight ->> 'prestate_digest',
      'old_proposition_key', v_plan ->> 'current_proposition_key',
      'old_fact_instance_id', v_plan ->> 'current_fact_instance_id',
      'old_confirmation_id', v_plan ->> 'current_confirmation_id',
      'old_assignment_id', v_plan ->> 'assignment_id',
      'new_proposition_key', v_plan ->> 'candidate_proposition_key',
      'new_assignment_id', v_assignment.assignment_id,
      'candidate_id', p_candidate_id,
      'evidence_id', v_evidence_id
    )
  );

  return jsonb_build_object(
    'status', 'ready_for_explicit_replacement_confirmation',
    'transition_id', p_transition_id,
    'candidate_id', p_candidate_id,
    'evidence_id', v_evidence_id,
    'old_assignment_id', v_plan ->> 'assignment_id',
    'old_proposition_key', v_plan ->> 'current_proposition_key',
    'old_fact_instance_id', v_plan ->> 'current_fact_instance_id',
    'old_confirmation_id', v_plan ->> 'current_confirmation_id',
    'new_assignment_id', v_assignment.assignment_id,
    'new_proposition_key', v_plan ->> 'candidate_proposition_key',
    'confirmation_request_id', v_confirmation_request_id,
    'confirmation_payload', v_confirmation_payload,
    'confirmation_payload_digest', v_preflight ->> 'payload_digest',
    'confirmation_prestate_digest', v_preflight ->> 'prestate_digest',
    'replacement_prestate_digest', v_replacement_prestate_digest,
    'automatic_confirmation', false
  );
end;
$;

create or replace function public.admin_confirm_product_fact_revalidation_replacement_v1(
  p_actor_user_id uuid,
  p_request_id text,
  p_transition_id uuid,
  p_candidate_id uuid,
  p_new_assignment_id uuid,
  p_confirmation_payload jsonb,
  p_expected_confirmation_payload_digest text,
  p_expected_confirmation_prestate_digest text,
  p_expected_replacement_prestate_digest text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_actor_role text;
  v_request_id text := btrim(coalesce(p_request_id, ''));
  v_expected_confirmation_payload_digest text :=
    lower(btrim(coalesce(p_expected_confirmation_payload_digest, '')));
  v_expected_confirmation_prestate_digest text :=
    lower(btrim(coalesce(p_expected_confirmation_prestate_digest, '')));
  v_expected_replacement_prestate_digest text :=
    lower(btrim(coalesce(p_expected_replacement_prestate_digest, '')));
  v_existing public.product_fact_revalidation_resolutions%rowtype;
  v_plan jsonb;
  v_new_assignment public.product_fact_review_assignments%rowtype;
  v_preflight jsonb;
  v_replacement_prestate_digest text;
  v_confirmation jsonb;
  v_new_fact_instance_id uuid;
  v_new_confirmation_id uuid;
  v_evidence_id uuid;
  v_evidence public.product_evidence_records%rowtype;
  v_supporting_count integer;
  v_opposing_count integer;
  v_result jsonb;
  v_audit_id uuid;
  v_updated_count integer;
begin
  v_actor_role := public.admin_require_product_review_actor(
    p_actor_user_id,
    'admin.products.review'
  );

  if char_length(v_request_id) not between 8 and 80
    or v_expected_confirmation_payload_digest !~ '^[0-9a-f]{64}$'
    or v_expected_confirmation_prestate_digest !~ '^[0-9a-f]{64}$'
    or v_expected_replacement_prestate_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'product_fact_revalidation_replacement_confirm_request_invalid'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('bejewely_product_fact_revalidation_replacement:' || p_transition_id::text, 0)
  );

  select * into v_existing
  from public.product_fact_revalidation_resolutions
  where request_id = v_request_id
     or transition_id = p_transition_id
  order by case when request_id = v_request_id then 0 else 1 end
  limit 1;

  if found then
    if v_existing.request_id <> v_request_id
      or v_existing.transition_id <> p_transition_id
      or v_existing.candidate_id <> p_candidate_id
      or v_existing.actor_user_id <> p_actor_user_id
      or v_existing.resolution_kind <> 'SEMANTIC_CHANGE_REPLACEMENT'
      or v_existing.payload_digest <> v_expected_confirmation_payload_digest
      or v_existing.prestate_digest <> v_expected_replacement_prestate_digest then
      raise exception 'product_fact_revalidation_replacement_confirm_conflict'
        using errcode = '23505';
    end if;

    return v_existing.result || jsonb_build_object('idempotent', true);
  end if;

  v_plan := public.trust_phase8f_build_replacement_fact_payload_v1(
    p_actor_user_id,
    p_transition_id,
    p_candidate_id
  );

  select * into v_new_assignment
  from public.product_fact_review_assignments
  where assignment_id = p_new_assignment_id
  for update;

  if not found
    or v_new_assignment.operational_state <> 'ready_for_confirm'
    or v_new_assignment.assigned_to is distinct from p_actor_user_id
    or v_new_assignment.review_policy_version <> 'trust-phase8f-revalidation-replacement-v1'
    or v_new_assignment.subject_id is distinct from (v_plan ->> 'subject_id')::uuid
    or v_new_assignment.proposition_key is distinct from v_plan ->> 'candidate_proposition_key' then
    raise exception 'product_fact_revalidation_replacement_new_assignment_stale'
      using errcode = '40001';
  end if;

  if (p_confirmation_payload ->> 'assignment_id')::uuid <> p_new_assignment_id
    or p_confirmation_payload ->> 'proposition_key' <> v_plan ->> 'candidate_proposition_key' then
    raise exception 'product_fact_revalidation_replacement_confirmation_payload_mismatch'
      using errcode = '23514';
  end if;

  v_supporting_count := jsonb_array_length(p_confirmation_payload -> 'supporting_evidence_ids');
  v_opposing_count := jsonb_array_length(p_confirmation_payload -> 'opposing_evidence_ids');

  select value::uuid into v_evidence_id
  from (
    select value
    from jsonb_array_elements_text(p_confirmation_payload -> 'supporting_evidence_ids')
    union all
    select value
    from jsonb_array_elements_text(p_confirmation_payload -> 'opposing_evidence_ids')
  ) as evidence_ids
  limit 1;

  select * into v_evidence
  from public.product_evidence_records
  where evidence_id = v_evidence_id;

  if v_evidence_id is null
    or v_supporting_count + v_opposing_count <> 1
    or not found
    or v_evidence.subject_id is distinct from (v_plan ->> 'subject_id')::uuid
    or v_evidence.proposition_key is distinct from v_plan ->> 'candidate_proposition_key'
    or v_evidence.canonical_evidence_digest is distinct from (
      select canonical_evidence_digest
      from public.trust_evidence_candidates
      where candidate_id = p_candidate_id
    )
    or (
      v_supporting_count = 1
      and (
        v_evidence.support_direction <> 'supports'
        or v_evidence.negative_admissibility <> 'not_applicable'
      )
    )
    or (
      v_opposing_count = 1
      and (
        v_evidence.support_direction <> 'opposes'
        or v_evidence.negative_admissibility <> 'explicit_negative'
        or v_plan #>> '{fact_payload_base,value_type}' <> 'boolean'
        or coalesce((v_plan #>> '{fact_payload_base,value_boolean}')::boolean, true) <> false
      )
    ) then
    raise exception 'product_fact_revalidation_replacement_evidence_mismatch'
      using errcode = '23514';
  end if;

  v_preflight := public.admin_preflight_product_fact_confirmation_v1(
    p_actor_user_id,
    v_request_id || ':confirm',
    p_confirmation_payload
  );

  if v_preflight ->> 'status' <> 'ready'
    or v_preflight ->> 'payload_digest' <> v_expected_confirmation_payload_digest
    or v_preflight ->> 'prestate_digest' <> v_expected_confirmation_prestate_digest
    or v_preflight -> 'previous_current' <> 'null'::jsonb then
    raise exception 'product_fact_revalidation_replacement_confirmation_stale'
      using errcode = '40001';
  end if;

  v_replacement_prestate_digest := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object(
      'revalidation_prestate_digest', v_plan ->> 'prestate_digest',
      'confirmation_prestate_digest', v_preflight ->> 'prestate_digest',
      'old_proposition_key', v_plan ->> 'current_proposition_key',
      'old_fact_instance_id', v_plan ->> 'current_fact_instance_id',
      'old_confirmation_id', v_plan ->> 'current_confirmation_id',
      'old_assignment_id', v_plan ->> 'assignment_id',
      'new_proposition_key', v_plan ->> 'candidate_proposition_key',
      'new_assignment_id', p_new_assignment_id,
      'candidate_id', p_candidate_id,
      'evidence_id', v_evidence_id
    )
  );

  if v_replacement_prestate_digest <> v_expected_replacement_prestate_digest then
    raise exception 'product_fact_revalidation_replacement_prestate_stale'
      using errcode = '40001';
  end if;

  v_confirmation := public.admin_confirm_product_fact_v1(
    p_actor_user_id,
    v_request_id || ':confirm',
    p_confirmation_payload,
    v_expected_confirmation_payload_digest,
    v_expected_confirmation_prestate_digest
  );

  if v_confirmation ->> 'status' <> 'confirmed' then
    raise exception 'product_fact_revalidation_replacement_confirmation_failed'
      using errcode = '55000';
  end if;

  v_new_fact_instance_id := (v_confirmation ->> 'fact_instance_id')::uuid;
  v_new_confirmation_id := (v_confirmation ->> 'confirmation_id')::uuid;

  -- product_fact_instances.supersedes_fact_instance_id is intentionally
  -- proposition-local by storage FK. A changed-semantic replacement has a new
  -- proposition_key, so its cross-proposition lineage is recorded immutably
  -- by the revalidation resolution/event/audit instead of mutating the new Fact.

  delete from public.product_fact_current
  where proposition_key = v_plan ->> 'current_proposition_key'
    and fact_instance_id = (v_plan ->> 'current_fact_instance_id')::uuid
    and confirmation_id = (v_plan ->> 'current_confirmation_id')::uuid;

  get diagnostics v_updated_count = row_count;
  if v_updated_count <> 1 then
    raise exception 'product_fact_revalidation_replacement_old_current_stale'
      using errcode = '40001';
  end if;

  update public.product_fact_review_assignments
  set operational_state = 'superseded',
      updated_at = now()
  where assignment_id = (v_plan ->> 'assignment_id')::uuid
    and operational_state = 're_review_required';

  get diagnostics v_updated_count = row_count;
  if v_updated_count <> 1 then
    raise exception 'product_fact_revalidation_replacement_old_assignment_stale'
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
  )
  values (
    (v_plan ->> 'assignment_id')::uuid,
    (v_plan ->> 'subject_id')::uuid,
    (v_plan ->> 'current_fact_instance_id')::uuid,
    (v_plan ->> 'current_confirmation_id')::uuid,
    p_actor_user_id,
    'revalidation_superseded',
    'semantic_change_confirmed',
    jsonb_build_object(
      'request_id', v_request_id,
      'transition_id', p_transition_id,
      'candidate_id', p_candidate_id,
      'new_assignment_id', p_new_assignment_id,
      'new_proposition_key', v_plan ->> 'candidate_proposition_key',
      'new_fact_instance_id', v_new_fact_instance_id,
      'new_confirmation_id', v_new_confirmation_id,
      'replacement_prestate_digest', v_replacement_prestate_digest
    ),
    now()
  );

  v_result := jsonb_build_object(
    'status', 'replaced',
    'idempotent', false,
    'actor_role', v_actor_role,
    'transition_id', p_transition_id,
    'candidate_id', p_candidate_id,
    'evidence_id', v_evidence_id,
    'resolution_kind', 'SEMANTIC_CHANGE_REPLACEMENT',
    'old_assignment_id', v_plan ->> 'assignment_id',
    'old_proposition_key', v_plan ->> 'current_proposition_key',
    'old_fact_instance_id', v_plan ->> 'current_fact_instance_id',
    'old_confirmation_id', v_plan ->> 'current_confirmation_id',
    'new_assignment_id', p_new_assignment_id,
    'new_proposition_key', v_plan ->> 'candidate_proposition_key',
    'new_fact_instance_id', v_new_fact_instance_id,
    'new_confirmation_id', v_new_confirmation_id,
    'confirmation_payload_digest', v_expected_confirmation_payload_digest,
    'confirmation_prestate_digest', v_expected_confirmation_prestate_digest,
    'replacement_prestate_digest', v_replacement_prestate_digest,
    'cross_proposition_replacement_lineage', true,
    'automatic_confirmation', false
  );

  insert into public.product_fact_revalidation_resolutions (
    request_id,
    transition_id,
    bridge_id,
    assignment_id,
    research_task_id,
    candidate_id,
    evidence_id,
    current_fact_instance_id,
    current_confirmation_id,
    actor_user_id,
    resolution_kind,
    payload_digest,
    prestate_digest,
    result
  ) values (
    v_request_id,
    p_transition_id,
    (v_plan ->> 'bridge_id')::uuid,
    (v_plan ->> 'assignment_id')::uuid,
    (v_plan ->> 'research_task_id')::uuid,
    p_candidate_id,
    v_evidence_id,
    (v_plan ->> 'current_fact_instance_id')::uuid,
    (v_plan ->> 'current_confirmation_id')::uuid,
    p_actor_user_id,
    'SEMANTIC_CHANGE_REPLACEMENT',
    v_expected_confirmation_payload_digest,
    v_replacement_prestate_digest,
    v_result
  );

  v_audit_id := public.record_admin_audit_event(
    p_actor_user_id,
    'admin.products.review',
    'admin.product_fact.revalidation_replaced',
    'product_fact_revalidation_transition',
    p_transition_id::text,
    jsonb_build_object(
      'proposition_key', v_plan ->> 'current_proposition_key',
      'fact_instance_id', v_plan ->> 'current_fact_instance_id',
      'confirmation_id', v_plan ->> 'current_confirmation_id'
    ),
    jsonb_build_object(
      'proposition_key', v_plan ->> 'candidate_proposition_key',
      'fact_instance_id', v_new_fact_instance_id,
      'confirmation_id', v_new_confirmation_id
    ),
    'replace Product Fact after changed-semantic revalidation research',
    v_request_id,
    jsonb_build_object(
      'candidate_id', p_candidate_id,
      'old_assignment_id', v_plan ->> 'assignment_id',
      'new_assignment_id', p_new_assignment_id,
      'replacement_prestate_digest', v_replacement_prestate_digest
    )
  );

  return v_result || jsonb_build_object('audit_id', v_audit_id);
end;
$$;

revoke all on function public.trust_phase8f_build_replacement_fact_payload_v1(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_prepare_product_fact_revalidation_replacement_v1(uuid, text, uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_confirm_product_fact_revalidation_replacement_v1(
  uuid, text, uuid, uuid, uuid, jsonb, text, text, text
) from public, anon, authenticated, service_role;

grant execute on function public.admin_prepare_product_fact_revalidation_replacement_v1(
  uuid, text, uuid, uuid
) to service_role;
grant execute on function public.admin_confirm_product_fact_revalidation_replacement_v1(
  uuid, text, uuid, uuid, uuid, jsonb, text, text, text
) to service_role;

comment on function public.admin_prepare_product_fact_revalidation_replacement_v1(uuid, text, uuid, uuid) is
  'Governed Phase 8F changed-semantic preparation: records Evidence, creates a new-proposition review assignment, and returns confirmation plus replacement prestates without confirming.';
comment on function public.admin_confirm_product_fact_revalidation_replacement_v1(uuid, text, uuid, uuid, uuid, jsonb, text, text, text) is
  'Explicit Admin Phase 8F changed-semantic replacement. Existing controlled confirmation creates the new Fact, then the same transaction links supersession, retires the old Current proposition, and supersedes the old assignment.';

commit;


-- trust_phase8f_explicit_negative_compat_v1
-- Controlled Product Fact confirmation represents a supported boolean false
-- with one opposing explicit-negative Evidence record. Preserve all Phase 8E
-- lineage checks while admitting only that exact negative evidence shape.
create or replace function public.trust_phase8e_build_revalidation_plan_v1(
  p_actor_user_id uuid,
  p_transition_id uuid,
  p_candidate_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_transition public.product_fact_revalidation_transitions%rowtype;
  v_bridge public.product_fact_revalidation_research_bridges%rowtype;
  v_assignment public.product_fact_review_assignments%rowtype;
  v_current public.product_fact_current%rowtype;
  v_current_fact public.product_fact_instances%rowtype;
  v_task public.product_fact_research_tasks%rowtype;
  v_candidate public.trust_evidence_candidates%rowtype;
  v_observation public.trust_source_observations%rowtype;
  v_intake public.catalog_trust_intake%rowtype;
  v_subject public.product_fact_subjects%rowtype;
  v_scope jsonb;
  v_candidate_proposition_key text;
  v_semantic_relation text;
  v_prestate_digest text;
  v_source_payload jsonb;
  v_binding_payload jsonb;
  v_evidence_payload jsonb;
begin
  perform public.admin_require_product_review_actor(
    p_actor_user_id,
    'admin.products.review'
  );

  if p_transition_id is null or p_candidate_id is null then
    raise exception 'product_fact_revalidation_resolution_identity_required'
      using errcode = '22023';
  end if;

  select * into v_transition
  from public.product_fact_revalidation_transitions
  where transition_id = p_transition_id;

  if not found then
    raise exception 'product_fact_revalidation_resolution_transition_not_found'
      using errcode = 'P0002';
  end if;

  select * into v_bridge
  from public.product_fact_revalidation_research_bridges
  where transition_id = p_transition_id
    and disposition = 'RESEARCH_REQUEUED';

  if not found or v_bridge.research_task_id is null then
    raise exception 'product_fact_revalidation_resolution_bridge_missing'
      using errcode = '55000';
  end if;

  select * into v_assignment
  from public.product_fact_review_assignments
  where assignment_id = v_transition.assignment_id;

  if not found
    or v_assignment.assignment_id <> v_bridge.assignment_id
    or v_assignment.operational_state <> 're_review_required'
    or v_assignment.subject_id is null
    or v_assignment.proposition_key is distinct from v_transition.proposition_key then
    raise exception 'product_fact_revalidation_resolution_assignment_stale'
      using errcode = '40001';
  end if;

  select * into v_current
  from public.product_fact_current
  where proposition_key = v_transition.proposition_key;

  if not found
    or v_current.fact_instance_id <> v_transition.fact_instance_id
    or v_current.confirmation_id <> v_transition.confirmation_id
    or v_current.subject_id is distinct from v_assignment.subject_id then
    raise exception 'product_fact_revalidation_resolution_current_stale'
      using errcode = '40001';
  end if;

  select * into v_current_fact
  from public.product_fact_instances
  where fact_instance_id = v_current.fact_instance_id;

  if not found
    or v_current_fact.proposition_key <> v_transition.proposition_key
    or v_current_fact.subject_id is distinct from v_assignment.subject_id
    or v_current_fact.registry_version is distinct from v_assignment.registry_version
    or v_current_fact.fact_key is distinct from v_assignment.fact_key then
    raise exception 'product_fact_revalidation_resolution_fact_stale'
      using errcode = '40001';
  end if;

  select * into v_task
  from public.product_fact_research_tasks
  where id = v_bridge.research_task_id;

  if not found
    or v_task.state <> 'EVIDENCE_CANDIDATE'
    or v_task.evidence_candidate_id is distinct from p_candidate_id
    or v_task.subject_id is distinct from v_assignment.subject_id
    or v_task.registry_version is distinct from v_assignment.registry_version
    or v_task.fact_key is distinct from v_assignment.fact_key then
    raise exception 'product_fact_revalidation_resolution_task_stale'
      using errcode = '40001';
  end if;

  select * into v_candidate
  from public.trust_evidence_candidates
  where candidate_id = p_candidate_id;

  if not found
    or v_candidate.candidate_state <> 'READY'
    or v_candidate.research_task_id <> v_task.id
    or v_candidate.subject_id is distinct from v_assignment.subject_id
    or v_candidate.registry_version is distinct from v_assignment.registry_version
    or v_candidate.fact_key is distinct from v_assignment.fact_key
    or v_candidate.evidence_authority <> 'product_specific_primary'
    or not (
      (
        v_candidate.support_direction = 'supports'
        and v_candidate.negative_admissibility = 'not_applicable'
      )
      or (
        v_candidate.support_direction = 'opposes'
        and v_candidate.negative_admissibility = 'explicit_negative'
        and jsonb_typeof(v_candidate.normalized_value) = 'boolean'
        and (v_candidate.normalized_value #>> '{}')::boolean = false
      )
    ) then
    raise exception 'product_fact_revalidation_resolution_candidate_invalid'
      using errcode = '55000';
  end if;

  select * into v_observation
  from public.trust_source_observations
  where observation_id = v_candidate.observation_id;

  if not found
    or v_observation.research_task_id <> v_task.id
    or v_observation.product_id <> v_candidate.product_id
    or v_observation.subject_id <> v_candidate.subject_id
    or v_observation.source_content_digest is distinct from v_task.source_content_digest
    or v_observation.canonical_locator is distinct from v_task.source_locator then
    raise exception 'product_fact_revalidation_resolution_observation_invalid'
      using errcode = '55000';
  end if;

  select * into v_intake
  from public.catalog_trust_intake
  where id = v_task.intake_id;

  if not found
    or v_intake.identity_state <> 'EXACT_SUBJECT_FOUND'
    or v_intake.product_id <> v_candidate.product_id
    or v_intake.subject_id is distinct from v_candidate.subject_id
    or nullif(btrim(coalesce(v_intake.identity_resolution_version, '')), '') is null
    or v_intake.market is distinct from v_candidate.market then
    raise exception 'product_fact_revalidation_resolution_intake_invalid'
      using errcode = '55000';
  end if;

  select * into v_subject
  from public.product_fact_subjects
  where subject_id = v_candidate.subject_id;

  if not found
    or v_subject.product_id <> v_candidate.product_id
    or v_subject.identity_status <> 'resolved'
    or v_subject.current_state <> 'current'
    or v_subject.market_applicability is distinct from v_candidate.market then
    raise exception 'product_fact_revalidation_resolution_subject_invalid'
      using errcode = '55000';
  end if;

  if public.product_fact_controlled_latest_registry_v1()
      is distinct from v_candidate.registry_version then
    raise exception 'product_fact_revalidation_resolution_registry_stale'
      using errcode = '40001';
  end if;

  v_scope := jsonb_strip_nulls(jsonb_build_object(
    'market', v_candidate.market,
    'variant', v_subject.variant_key
  ));

  v_candidate_proposition_key := public.product_fact_controlled_sha256_json_v1(
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

  v_semantic_relation := case
    when v_candidate_proposition_key = v_transition.proposition_key
      then 'SAME_SEMANTIC'
    else 'SEMANTIC_CHANGE'
  end;

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
    'proposition_key', v_candidate_proposition_key,
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

  v_prestate_digest := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object(
      'transition', jsonb_build_object(
        'transition_id', v_transition.transition_id,
        'assignment_id', v_transition.assignment_id,
        'proposition_key', v_transition.proposition_key,
        'fact_instance_id', v_transition.fact_instance_id,
        'confirmation_id', v_transition.confirmation_id
      ),
      'bridge', jsonb_build_object(
        'bridge_id', v_bridge.bridge_id,
        'research_task_id', v_bridge.research_task_id,
        'disposition', v_bridge.disposition
      ),
      'assignment', jsonb_build_object(
        'assignment_id', v_assignment.assignment_id,
        'operational_state', v_assignment.operational_state,
        'review_policy_version', v_assignment.review_policy_version,
        'updated_at', v_assignment.updated_at
      ),
      'current', jsonb_build_object(
        'proposition_key', v_current.proposition_key,
        'fact_instance_id', v_current.fact_instance_id,
        'confirmation_id', v_current.confirmation_id,
        'updated_at', v_current.updated_at
      ),
      'research', jsonb_build_object(
        'research_task_id', v_task.id,
        'state', v_task.state,
        'candidate_id', v_candidate.candidate_id,
        'canonical_evidence_digest', v_candidate.canonical_evidence_digest,
        'source_content_digest', v_observation.source_content_digest,
        'task_updated_at', v_task.updated_at
      )
    )
  );

  return jsonb_build_object(
    'transition_id', v_transition.transition_id,
    'bridge_id', v_bridge.bridge_id,
    'assignment_id', v_assignment.assignment_id,
    'research_task_id', v_task.id,
    'candidate_id', v_candidate.candidate_id,
    'current_fact_instance_id', v_current.fact_instance_id,
    'current_confirmation_id', v_current.confirmation_id,
    'current_proposition_key', v_transition.proposition_key,
    'candidate_proposition_key', v_candidate_proposition_key,
    'semantic_relation', v_semantic_relation,
    'prestate_digest', v_prestate_digest,
    'source_payload', v_source_payload,
    'binding_payload', v_binding_payload,
    'evidence_payload', v_evidence_payload
  );
end;
$$;
