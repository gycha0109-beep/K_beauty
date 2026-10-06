begin;

-- DATA-AI29C-D5E-D-R3
-- Controlled Product Fact Subject identity-authority provenance upgrade.
-- This is NOT a Subject identity mutation path: semantic/formulation/applicability
-- identity is frozen and only identity_resolution_version may transition.

do $$
begin
  if to_regclass('public.product_fact_subjects') is null
    or to_regclass('public.product_candidates') is null
    or to_regclass('public.product_fact_current') is null
    or to_regclass('public.product_fact_instances') is null
    or to_regclass('public.product_fact_research_tasks') is null
    or to_regclass('public.product_evidence_source_subject_bindings') is null
    or to_regclass('public.product_evidence_records') is null
    or to_regclass('public.sunscreen_recommendation_semantic_field_reviews') is null
    or to_regclass('public.product_fact_review_events') is null
    or to_regclass('public.admin_audit_logs') is null
    or to_regprocedure('public.admin_require_product_review_actor(uuid,text)') is null
    or to_regprocedure('public.product_fact_controlled_json_exact_keys_v1(jsonb,text[])') is null
    or to_regprocedure('public.product_fact_controlled_sha256_json_v1(jsonb)') is null
    or to_regprocedure('public.record_admin_audit_event(uuid,text,text,text,text,jsonb,jsonb,text,text,jsonb)') is null
  then
    raise exception 'd5e_d_r3_subject_authority_upgrade_prerequisite_missing'
      using errcode = '55000';
  end if;
end;
$$;

create or replace function public.product_fact_subject_identity_authority_upgrade_plan_v1(
  p_actor_user_id uuid,
  p_subject_id uuid,
  p_source_candidate_id uuid,
  p_reviewed_identity jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_subject public.product_fact_subjects%rowtype;
  v_candidate public.product_candidates%rowtype;
  v_variant_key text;
  v_variant_key_reviewed_as_null boolean;
  v_formulation_revision_key text;
  v_formulation_label text;
  v_market_applicability text;
  v_region_applicability text;
  v_valid_from date;
  v_valid_to date;
  v_official_locator text;
  v_official_digest text;
  v_secondary_digest text;
  v_recomputed_subject_key text;
  v_reviewed_subject_key text;
  v_applicability_subject_ids jsonb;
  v_current_facts jsonb;
  v_fact_instances jsonb;
  v_research_tasks jsonb;
  v_source_bindings jsonb;
  v_evidence_records jsonb;
  v_semantic_reviews jsonb;
  v_prestate jsonb;
  v_prestate_digest text;
  v_payload jsonb;
  v_payload_digest text;
  v_already_upgraded boolean;
  v_existing_upgrade_audit_count bigint;
begin
  perform public.admin_require_product_review_actor(
    p_actor_user_id,
    'admin.products.review'
  );

  if p_subject_id is null
    or p_source_candidate_id is null
    or jsonb_typeof(p_reviewed_identity) <> 'object'
    or not public.product_fact_controlled_json_exact_keys_v1(
      p_reviewed_identity,
      array[
        'variant_key',
        'variant_key_reviewed_as_null',
        'formulation_revision_key',
        'formulation_label',
        'market_applicability',
        'region_applicability',
        'valid_from',
        'valid_to'
      ]
    )
    or jsonb_typeof(p_reviewed_identity -> 'variant_key_reviewed_as_null') <> 'boolean'
  then
    raise exception 'd5e_d_r3_subject_authority_upgrade_reviewed_identity_invalid'
      using errcode = '22023';
  end if;

  v_variant_key := nullif(btrim(coalesce(p_reviewed_identity ->> 'variant_key', '')), '');
  v_variant_key_reviewed_as_null :=
    (p_reviewed_identity ->> 'variant_key_reviewed_as_null')::boolean;
  v_formulation_revision_key :=
    nullif(btrim(coalesce(p_reviewed_identity ->> 'formulation_revision_key', '')), '');
  v_formulation_label :=
    nullif(btrim(coalesce(p_reviewed_identity ->> 'formulation_label', '')), '');
  v_market_applicability :=
    upper(nullif(btrim(coalesce(p_reviewed_identity ->> 'market_applicability', '')), ''));
  v_region_applicability :=
    nullif(btrim(coalesce(p_reviewed_identity ->> 'region_applicability', '')), '');

  begin
    if p_reviewed_identity -> 'valid_from' <> 'null'::jsonb then
      v_valid_from := (p_reviewed_identity ->> 'valid_from')::date;
    end if;
    if p_reviewed_identity -> 'valid_to' <> 'null'::jsonb then
      v_valid_to := (p_reviewed_identity ->> 'valid_to')::date;
    end if;
  exception when others then
    raise exception 'd5e_d_r3_subject_authority_upgrade_reviewed_identity_invalid'
      using errcode = '22023';
  end;

  if v_formulation_revision_key is null
    or v_market_applicability is null
    or (v_variant_key is null and not v_variant_key_reviewed_as_null)
    or (v_variant_key is not null and v_variant_key_reviewed_as_null)
    or (v_valid_from is not null and v_valid_to is not null and v_valid_from >= v_valid_to)
  then
    raise exception 'd5e_d_r3_subject_authority_upgrade_reviewed_identity_invalid'
      using errcode = '22023';
  end if;

  select *
    into v_subject
  from public.product_fact_subjects
  where subject_id = p_subject_id;

  if not found then
    raise exception 'd5e_d_r3_subject_authority_upgrade_subject_not_found'
      using errcode = 'P0002';
  end if;

  if v_subject.identity_status <> 'resolved'
    or v_subject.current_state <> 'current'
    or v_subject.subject_identity_serializer_version <> 'product-fact-subject-identity-v1'
    or v_subject.identity_resolution_version not in (
      'gpt-catalog-machine-subject-v1',
      'trust-phase5-admin-subject-review-v1'
    )
  then
    raise exception 'd5e_d_r3_subject_authority_upgrade_subject_state_invalid'
      using errcode = '55000';
  end if;

  if v_subject.variant_key is distinct from v_variant_key
    or v_subject.formulation_revision_key is distinct from v_formulation_revision_key
    or v_subject.formulation_label is distinct from v_formulation_label
    or upper(v_subject.market_applicability) is distinct from v_market_applicability
    or v_subject.region_applicability is distinct from v_region_applicability
    or v_subject.valid_from is distinct from v_valid_from
    or v_subject.valid_to is distinct from v_valid_to
  then
    raise exception 'd5e_d_r3_subject_authority_upgrade_identity_invariant_mismatch'
      using errcode = '55000';
  end if;

  v_recomputed_subject_key :=
    public.product_fact_controlled_sha256_json_v1(
      jsonb_build_object(
        'product_id', v_subject.product_id,
        'variant_key', v_subject.variant_key,
        'formulation_revision_key', v_subject.formulation_revision_key,
        'market_applicability', v_subject.market_applicability,
        'region_applicability', v_subject.region_applicability,
        'valid_from', v_subject.valid_from,
        'valid_to', v_subject.valid_to
      )
    );

  v_reviewed_subject_key :=
    public.product_fact_controlled_sha256_json_v1(
      jsonb_build_object(
        'product_id', v_subject.product_id,
        'variant_key', v_variant_key,
        'formulation_revision_key', v_formulation_revision_key,
        'market_applicability', v_market_applicability,
        'region_applicability', v_region_applicability,
        'valid_from', v_valid_from,
        'valid_to', v_valid_to
      )
    );

  if v_recomputed_subject_key <> v_subject.subject_semantic_key
    or v_reviewed_subject_key <> v_subject.subject_semantic_key
  then
    raise exception 'd5e_d_r3_subject_authority_upgrade_semantic_key_mismatch'
      using errcode = '55000';
  end if;

  select *
    into v_candidate
  from public.product_candidates
  where id = p_source_candidate_id;

  if not found
    or v_candidate.matched_product_id is distinct from v_subject.product_id
    or v_candidate.review_status::text <> 'promoted'
    or v_candidate.identity_resolution_state <> 'resolved'
  then
    raise exception 'd5e_d_r3_subject_authority_upgrade_catalog_lineage_invalid'
      using errcode = '55000';
  end if;

  v_official_locator := coalesce(
    nullif(btrim(v_candidate.identity_resolution_evidence #>> '{gpt_research,official_url}'), ''),
    nullif(btrim(v_candidate.source_url), '')
  );
  v_official_digest := coalesce(
    nullif(lower(btrim(v_candidate.identity_resolution_evidence #>> '{gpt_research,official_content_digest}')), ''),
    nullif(lower(btrim(v_candidate.latest_raw_source #>> '{official_fetch,content_digest}')), '')
  );
  v_secondary_digest :=
    nullif(lower(btrim(v_candidate.latest_raw_source #>> '{official_fetch,content_digest}')), '');

  if v_official_locator is null
    or v_official_locator !~ '^https://'
    or v_official_digest is null
    or v_official_digest !~ '^[0-9a-f]{64}$'
    or (
      v_secondary_digest is not null
      and v_secondary_digest <> v_official_digest
    )
    or coalesce(
      v_candidate.identity_resolution_evidence #>> '{authority_boundary,product_fact_write_allowed}',
      ''
    ) <> 'false'
  then
    raise exception 'd5e_d_r3_subject_authority_upgrade_catalog_authority_invalid'
      using errcode = '55000';
  end if;

  select coalesce(
    jsonb_agg(s.subject_id order by s.subject_id),
    '[]'::jsonb
  )
    into v_applicability_subject_ids
  from public.product_fact_subjects s
  where s.product_id = v_subject.product_id
    and s.identity_status = 'resolved'
    and s.current_state = 'current'
    and s.variant_key is not distinct from v_subject.variant_key
    and s.market_applicability is not distinct from v_subject.market_applicability
    and s.region_applicability is not distinct from v_subject.region_applicability;

  if jsonb_array_length(v_applicability_subject_ids) <> 1
    or v_applicability_subject_ids ->> 0 <> v_subject.subject_id::text
  then
    raise exception 'd5e_d_r3_subject_authority_upgrade_competing_current_subject'
      using errcode = '55000';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'proposition_key', c.proposition_key,
        'fact_instance_id', c.fact_instance_id,
        'confirmation_id', c.confirmation_id,
        'updated_at', c.updated_at
      )
      order by c.proposition_key
    ),
    '[]'::jsonb
  )
    into v_current_facts
  from public.product_fact_current c
  where c.subject_id = v_subject.subject_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'fact_instance_id', f.fact_instance_id,
        'registry_version', f.registry_version,
        'fact_key', f.fact_key,
        'proposition_key', f.proposition_key,
        'semantic_status', f.semantic_status,
        'authority_ceiling', f.authority_ceiling,
        'fused_confidence', f.fused_confidence,
        'fusion_input_digest', f.fusion_input_digest,
        'supersedes_fact_instance_id', f.supersedes_fact_instance_id
      )
      order by f.fact_instance_id
    ),
    '[]'::jsonb
  )
    into v_fact_instances
  from public.product_fact_instances f
  where f.subject_id = v_subject.subject_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', t.id,
        'fact_key', t.fact_key,
        'registry_version', t.registry_version,
        'state', t.state,
        'blocker_code', t.blocker_code,
        'source_content_digest', t.source_content_digest,
        'source_observation_id', t.source_observation_id,
        'evidence_candidate_id', t.evidence_candidate_id,
        'updated_at', t.updated_at
      )
      order by t.id
    ),
    '[]'::jsonb
  )
    into v_research_tasks
  from public.product_fact_research_tasks t
  where t.subject_id = v_subject.subject_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'binding_id', b.binding_id,
        'source_id', b.source_id,
        'binding_state', b.binding_state,
        'scope_relation', b.scope_relation,
        'identity_resolution_version', b.identity_resolution_version,
        'reviewed_at', b.reviewed_at
      )
      order by b.binding_id
    ),
    '[]'::jsonb
  )
    into v_source_bindings
  from public.product_evidence_source_subject_bindings b
  where b.subject_id = v_subject.subject_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'evidence_id', e.evidence_id,
        'source_id', e.source_id,
        'binding_id', e.binding_id,
        'fact_key', e.fact_key,
        'proposition_key', e.proposition_key,
        'canonical_evidence_digest', e.canonical_evidence_digest,
        'binding_state', e.binding_state,
        'created_at', e.created_at
      )
      order by e.evidence_id
    ),
    '[]'::jsonb
  )
    into v_evidence_records
  from public.product_evidence_records e
  where e.subject_id = v_subject.subject_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'review_id', r.review_id,
        'field_name', r.field_name,
        'review_state', r.review_state,
        'evidence_digest', r.evidence_digest,
        'payload_digest', r.payload_digest,
        'request_id', r.request_id,
        'reviewed_at', r.reviewed_at
      )
      order by r.review_id
    ),
    '[]'::jsonb
  )
    into v_semantic_reviews
  from public.sunscreen_recommendation_semantic_field_reviews r
  where r.subject_id = v_subject.subject_id
    and r.is_current;

  v_prestate := jsonb_build_object(
    'contract_version', 'data-ai29c-d5e-d-r3-subject-identity-authority-upgrade-v1',
    'subject', jsonb_build_object(
      'subject_id', v_subject.subject_id,
      'product_id', v_subject.product_id,
      'subject_semantic_key', v_subject.subject_semantic_key,
      'subject_identity_serializer_version', v_subject.subject_identity_serializer_version,
      'variant_key', v_subject.variant_key,
      'formulation_revision_key', v_subject.formulation_revision_key,
      'formulation_label', v_subject.formulation_label,
      'identity_status', v_subject.identity_status,
      'identity_resolution_version', v_subject.identity_resolution_version,
      'current_state', v_subject.current_state,
      'market_applicability', v_subject.market_applicability,
      'region_applicability', v_subject.region_applicability,
      'valid_from', v_subject.valid_from,
      'valid_to', v_subject.valid_to,
      'predecessor_subject_id', v_subject.predecessor_subject_id,
      'supersession_kind', v_subject.supersession_kind,
      'updated_at', v_subject.updated_at
    ),
    'catalog_identity_source', jsonb_build_object(
      'source_candidate_id', v_candidate.id,
      'matched_product_id', v_candidate.matched_product_id,
      'review_status', v_candidate.review_status::text,
      'identity_resolution_state', v_candidate.identity_resolution_state,
      'identity_resolution_version', v_candidate.identity_resolution_version,
      'official_source_locator', v_official_locator,
      'official_content_digest', v_official_digest,
      'product_fact_write_allowed',
        v_candidate.identity_resolution_evidence #>> '{authority_boundary,product_fact_write_allowed}'
    ),
    'applicability_subject_ids', v_applicability_subject_ids,
    'product_fact_current', v_current_facts,
    'product_fact_instances', v_fact_instances,
    'research_tasks', v_research_tasks,
    'source_bindings', v_source_bindings,
    'evidence_records', v_evidence_records,
    'semantic_reviews', v_semantic_reviews
  );

  v_prestate_digest :=
    public.product_fact_controlled_sha256_json_v1(v_prestate);

  v_payload := jsonb_build_object(
    'subject_id', v_subject.subject_id,
    'product_id', v_subject.product_id,
    'source_candidate_id', v_candidate.id,
    'reviewed_identity', jsonb_build_object(
      'variant_key', v_variant_key,
      'variant_key_reviewed_as_null', v_variant_key_reviewed_as_null,
      'formulation_revision_key', v_formulation_revision_key,
      'formulation_label', v_formulation_label,
      'market_applicability', v_market_applicability,
      'region_applicability', v_region_applicability,
      'valid_from', v_valid_from,
      'valid_to', v_valid_to
    ),
    'expected_subject_semantic_key', v_subject.subject_semantic_key,
    'from_identity_resolution_version', 'gpt-catalog-machine-subject-v1',
    'to_identity_resolution_version', 'trust-phase5-admin-subject-review-v1',
    'reason_code', 'controlled_identity_authority_upgrade'
  );

  v_payload_digest :=
    public.product_fact_controlled_sha256_json_v1(v_payload);

  v_already_upgraded :=
    v_subject.identity_resolution_version = 'trust-phase5-admin-subject-review-v1';

  if v_already_upgraded then
    select count(*)
      into v_existing_upgrade_audit_count
    from public.admin_audit_logs a
    where a.action = 'admin.product_fact.subject_identity_authority_upgraded'
      and a.target_type = 'product_fact_subject'
      and a.target_id = v_subject.subject_id::text
      and a.after_value ->> 'identity_resolution_version' =
        'trust-phase5-admin-subject-review-v1'
      and a.metadata ->> 'subject_semantic_key' =
        v_subject.subject_semantic_key
      and a.metadata ->> 'source_candidate_id' =
        v_candidate.id::text;

    if v_existing_upgrade_audit_count < 1 then
      raise exception 'd5e_d_r3_subject_authority_upgrade_provenance_missing'
        using errcode = '55000';
    end if;
  end if;

  return jsonb_build_object(
    'status', case
      when v_already_upgraded then 'already_upgraded'
      else 'ready'
    end,
    'subject_id', v_subject.subject_id,
    'product_id', v_subject.product_id,
    'source_candidate_id', v_candidate.id,
    'current_identity_resolution_version', v_subject.identity_resolution_version,
    'target_identity_resolution_version', 'trust-phase5-admin-subject-review-v1',
    'subject_semantic_key', v_subject.subject_semantic_key,
    'official_source_locator', v_official_locator,
    'official_content_digest', v_official_digest,
    'payload', v_payload,
    'payload_digest', v_payload_digest,
    'prestate_digest', v_prestate_digest,
    'dependent_counts', jsonb_build_object(
      'product_fact_current', jsonb_array_length(v_current_facts),
      'product_fact_instances', jsonb_array_length(v_fact_instances),
      'research_tasks', jsonb_array_length(v_research_tasks),
      'source_bindings', jsonb_array_length(v_source_bindings),
      'evidence_records', jsonb_array_length(v_evidence_records),
      'current_semantic_reviews', jsonb_array_length(v_semantic_reviews),
      'exact_current_applicability_subjects', jsonb_array_length(v_applicability_subject_ids)
    ),
    'planned_writes', case
      when v_already_upgraded then jsonb_build_object(
        'product_fact_subjects', 0,
        'product_fact_review_events', 0,
        'admin_audit_logs', 0
      )
      else jsonb_build_object(
        'product_fact_subjects', 1,
        'product_fact_review_events', 1,
        'admin_audit_logs', 1
      )
    end,
    'requires_explicit_confirmation', not v_already_upgraded
  );
end;
$$;

create or replace function public.admin_preflight_product_fact_subject_identity_authority_upgrade_v1(
  p_actor_user_id uuid,
  p_subject_id uuid,
  p_source_candidate_id uuid,
  p_reviewed_identity jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_plan jsonb;
begin
  v_plan := public.product_fact_subject_identity_authority_upgrade_plan_v1(
    p_actor_user_id,
    p_subject_id,
    p_source_candidate_id,
    p_reviewed_identity
  );

  return jsonb_build_object(
    'status', v_plan ->> 'status',
    'subject_id', v_plan ->> 'subject_id',
    'product_id', v_plan ->> 'product_id',
    'source_candidate_id', v_plan ->> 'source_candidate_id',
    'current_identity_resolution_version',
      v_plan ->> 'current_identity_resolution_version',
    'target_identity_resolution_version',
      v_plan ->> 'target_identity_resolution_version',
    'subject_semantic_key', v_plan ->> 'subject_semantic_key',
    'official_source_locator', v_plan ->> 'official_source_locator',
    'official_content_digest', v_plan ->> 'official_content_digest',
    'payload', v_plan -> 'payload',
    'payload_digest', v_plan ->> 'payload_digest',
    'prestate_digest', v_plan ->> 'prestate_digest',
    'dependent_counts', v_plan -> 'dependent_counts',
    'planned_writes', v_plan -> 'planned_writes',
    'requires_explicit_confirmation',
      (v_plan ->> 'requires_explicit_confirmation')::boolean
  );
end;
$$;

create or replace function public.admin_upgrade_product_fact_subject_identity_authority_v1(
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
  v_request_id text := btrim(coalesce(p_request_id, ''));
  v_payload_digest text := lower(btrim(coalesce(p_expected_payload_digest, '')));
  v_prestate_digest text := lower(btrim(coalesce(p_expected_prestate_digest, '')));
  v_subject_id uuid;
  v_source_candidate_id uuid;
  v_plan jsonb;
  v_existing_audit public.admin_audit_logs%rowtype;
  v_existing_audit_count bigint;
  v_updated_at timestamptz;
  v_audit_id uuid;
begin
  perform public.admin_require_product_review_actor(
    p_actor_user_id,
    'admin.products.review'
  );

  if char_length(v_request_id) not between 8 and 120
    or v_payload_digest !~ '^[0-9a-f]{64}$'
    or v_prestate_digest !~ '^[0-9a-f]{64}$'
    or jsonb_typeof(p_payload) <> 'object'
    or not public.product_fact_controlled_json_exact_keys_v1(
      p_payload,
      array[
        'subject_id',
        'product_id',
        'source_candidate_id',
        'reviewed_identity',
        'expected_subject_semantic_key',
        'from_identity_resolution_version',
        'to_identity_resolution_version',
        'reason_code'
      ]
    )
  then
    raise exception 'd5e_d_r3_subject_authority_upgrade_confirmation_invalid'
      using errcode = '22023';
  end if;

  begin
    v_subject_id := (p_payload ->> 'subject_id')::uuid;
    v_source_candidate_id := (p_payload ->> 'source_candidate_id')::uuid;
  exception when others then
    raise exception 'd5e_d_r3_subject_authority_upgrade_confirmation_invalid'
      using errcode = '22023';
  end;

  if p_payload ->> 'from_identity_resolution_version' <>
      'gpt-catalog-machine-subject-v1'
    or p_payload ->> 'to_identity_resolution_version' <>
      'trust-phase5-admin-subject-review-v1'
    or p_payload ->> 'reason_code' <> 'controlled_identity_authority_upgrade'
  then
    raise exception 'd5e_d_r3_subject_authority_upgrade_transition_invalid'
      using errcode = '55000';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'bejewely_subject_identity_authority_upgrade:' || v_subject_id::text,
      0
    )
  );

  select count(*)
    into v_existing_audit_count
  from public.admin_audit_logs a
  where a.actor_user_id = p_actor_user_id
    and a.request_id = v_request_id
    and a.action = 'admin.product_fact.subject_identity_authority_upgraded';

  if v_existing_audit_count > 1 then
    raise exception 'd5e_d_r3_subject_authority_upgrade_idempotency_collision'
      using errcode = '55000';
  end if;

  if v_existing_audit_count = 1 then
    select *
      into v_existing_audit
    from public.admin_audit_logs a
    where a.actor_user_id = p_actor_user_id
      and a.request_id = v_request_id
      and a.action = 'admin.product_fact.subject_identity_authority_upgraded'
    limit 1;

    if v_existing_audit.target_type <> 'product_fact_subject'
      or v_existing_audit.target_id <> v_subject_id::text
      or v_existing_audit.metadata ->> 'payload_digest' <> v_payload_digest
      or v_existing_audit.metadata ->> 'prestate_digest' <> v_prestate_digest
      or v_existing_audit.metadata ->> 'source_candidate_id' <>
        v_source_candidate_id::text
      or v_existing_audit.after_value ->> 'identity_resolution_version' <>
        'trust-phase5-admin-subject-review-v1'
      or not exists (
        select 1
        from public.product_fact_subjects s
        where s.subject_id = v_subject_id
          and s.identity_resolution_version =
            'trust-phase5-admin-subject-review-v1'
          and s.subject_semantic_key =
            p_payload ->> 'expected_subject_semantic_key'
      )
    then
      raise exception 'd5e_d_r3_subject_authority_upgrade_request_reuse_conflict'
        using errcode = '55000';
    end if;

    return jsonb_build_object(
      'status', 'identity_authority_upgraded',
      'idempotent', true,
      'subject_id', v_subject_id,
      'product_id', p_payload ->> 'product_id',
      'source_candidate_id', v_source_candidate_id,
      'identity_resolution_version',
        'trust-phase5-admin-subject-review-v1',
      'payload_digest', v_payload_digest,
      'prestate_digest', v_prestate_digest,
      'audit_id', v_existing_audit.id
    );
  end if;

  perform 1
  from public.product_fact_subjects s
  where s.subject_id = v_subject_id
  for update;

  if not found then
    raise exception 'd5e_d_r3_subject_authority_upgrade_subject_not_found'
      using errcode = 'P0002';
  end if;

  v_plan := public.product_fact_subject_identity_authority_upgrade_plan_v1(
    p_actor_user_id,
    v_subject_id,
    v_source_candidate_id,
    p_payload -> 'reviewed_identity'
  );

  if v_plan ->> 'status' = 'already_upgraded' then
    return jsonb_build_object(
      'status', 'already_upgraded',
      'idempotent', true,
      'subject_id', v_subject_id,
      'product_id', v_plan ->> 'product_id',
      'source_candidate_id', v_source_candidate_id,
      'identity_resolution_version',
        v_plan ->> 'current_identity_resolution_version',
      'payload_digest', v_plan ->> 'payload_digest',
      'prestate_digest', v_plan ->> 'prestate_digest'
    );
  end if;

  if v_plan ->> 'status' <> 'ready'
    or v_plan -> 'payload' is distinct from p_payload
    or v_plan ->> 'payload_digest' <> v_payload_digest
    or v_plan ->> 'prestate_digest' <> v_prestate_digest
  then
    raise exception 'd5e_d_r3_subject_authority_upgrade_stale_preflight'
      using errcode = '55000';
  end if;

  update public.product_fact_subjects
  set identity_resolution_version = 'trust-phase5-admin-subject-review-v1',
      updated_at = now()
  where subject_id = v_subject_id
    and identity_resolution_version = 'gpt-catalog-machine-subject-v1'
  returning updated_at into v_updated_at;

  if v_updated_at is null then
    raise exception 'd5e_d_r3_subject_authority_upgrade_write_failed'
      using errcode = '55000';
  end if;

  insert into public.product_fact_review_events (
    subject_id,
    actor_user_id,
    event_kind,
    reason_code,
    event_payload,
    created_at
  ) values (
    v_subject_id,
    p_actor_user_id,
    'subject_identity_authority_upgraded',
    'controlled_identity_authority_upgrade',
    jsonb_build_object(
      'request_id', v_request_id,
      'product_id', p_payload ->> 'product_id',
      'source_candidate_id', v_source_candidate_id,
      'subject_semantic_key', p_payload ->> 'expected_subject_semantic_key',
      'previous_identity_resolution_version',
        'gpt-catalog-machine-subject-v1',
      'next_identity_resolution_version',
        'trust-phase5-admin-subject-review-v1',
      'official_source_locator', v_plan ->> 'official_source_locator',
      'official_content_digest', v_plan ->> 'official_content_digest',
      'payload_digest', v_payload_digest,
      'prestate_digest', v_prestate_digest,
      'reviewed_identity', p_payload -> 'reviewed_identity'
    ),
    now()
  );

  v_audit_id := public.record_admin_audit_event(
    p_actor_user_id,
    'admin.products.review',
    'admin.product_fact.subject_identity_authority_upgraded',
    'product_fact_subject',
    v_subject_id::text,
    jsonb_build_object(
      'identity_resolution_version', 'gpt-catalog-machine-subject-v1'
    ),
    jsonb_build_object(
      'identity_resolution_version', 'trust-phase5-admin-subject-review-v1'
    ),
    'upgrade verified Product Fact Subject identity authority provenance',
    v_request_id,
    jsonb_build_object(
      'subject_id', v_subject_id,
      'product_id', p_payload ->> 'product_id',
      'source_candidate_id', v_source_candidate_id,
      'subject_semantic_key', p_payload ->> 'expected_subject_semantic_key',
      'official_source_locator', v_plan ->> 'official_source_locator',
      'official_content_digest', v_plan ->> 'official_content_digest',
      'payload_digest', v_payload_digest,
      'prestate_digest', v_prestate_digest,
      'reviewed_identity', p_payload -> 'reviewed_identity'
    )
  );

  return jsonb_build_object(
    'status', 'identity_authority_upgraded',
    'idempotent', false,
    'subject_id', v_subject_id,
    'product_id', p_payload ->> 'product_id',
    'source_candidate_id', v_source_candidate_id,
    'identity_resolution_version', 'trust-phase5-admin-subject-review-v1',
    'updated_at', v_updated_at,
    'payload_digest', v_payload_digest,
    'prestate_digest', v_prestate_digest,
    'audit_id', v_audit_id
  );
end;
$$;

comment on function public.product_fact_subject_identity_authority_upgrade_plan_v1(uuid,uuid,uuid,jsonb) is
  'Internal D5E-D-R3 zero-write plan builder for a bounded Product Fact Subject identity-authority provenance upgrade.';
comment on function public.admin_preflight_product_fact_subject_identity_authority_upgrade_v1(uuid,uuid,uuid,jsonb) is
  'D5E-D-R3 read-only preflight. Revalidates immutable Subject identity, catalog authority provenance, dependent lineage and stale-sensitive digests.';
comment on function public.admin_upgrade_product_fact_subject_identity_authority_v1(uuid,text,jsonb,text,text) is
  'D5E-D-R3 explicit admin confirmation. Only identity_resolution_version may transition; Product Fact/Evidence/Semantic/Recommendation rows are immutable.';

revoke all on function public.product_fact_subject_identity_authority_upgrade_plan_v1(uuid,uuid,uuid,jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_preflight_product_fact_subject_identity_authority_upgrade_v1(uuid,uuid,uuid,jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_upgrade_product_fact_subject_identity_authority_v1(uuid,text,jsonb,text,text)
  from public, anon, authenticated, service_role;

grant execute on function public.admin_preflight_product_fact_subject_identity_authority_upgrade_v1(uuid,uuid,uuid,jsonb)
  to service_role;
grant execute on function public.admin_upgrade_product_fact_subject_identity_authority_v1(uuid,text,jsonb,text,text)
  to service_role;

do $$
begin
  if has_function_privilege(
      'anon',
      'public.admin_preflight_product_fact_subject_identity_authority_upgrade_v1(uuid,uuid,uuid,jsonb)',
      'EXECUTE'
    )
    or has_function_privilege(
      'authenticated',
      'public.admin_preflight_product_fact_subject_identity_authority_upgrade_v1(uuid,uuid,uuid,jsonb)',
      'EXECUTE'
    )
    or has_function_privilege(
      'anon',
      'public.admin_upgrade_product_fact_subject_identity_authority_v1(uuid,text,jsonb,text,text)',
      'EXECUTE'
    )
    or has_function_privilege(
      'authenticated',
      'public.admin_upgrade_product_fact_subject_identity_authority_v1(uuid,text,jsonb,text,text)',
      'EXECUTE'
    )
    or not has_function_privilege(
      'service_role',
      'public.admin_preflight_product_fact_subject_identity_authority_upgrade_v1(uuid,uuid,uuid,jsonb)',
      'EXECUTE'
    )
    or not has_function_privilege(
      'service_role',
      'public.admin_upgrade_product_fact_subject_identity_authority_v1(uuid,text,jsonb,text,text)',
      'EXECUTE'
    )
    or has_function_privilege(
      'service_role',
      'public.product_fact_subject_identity_authority_upgrade_plan_v1(uuid,uuid,uuid,jsonb)',
      'EXECUTE'
    )
  then
    raise exception 'd5e_d_r3_subject_authority_upgrade_rpc_privilege_invalid';
  end if;

  if has_table_privilege(
    'service_role',
    'public.product_fact_subjects',
    'UPDATE'
  ) then
    raise exception 'd5e_d_r3_subject_authority_upgrade_direct_subject_update_exposed';
  end if;
end;
$$;

commit;
