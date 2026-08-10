begin;

-- Disposable local-Supabase runtime contract for PF-5B1 only.
-- This file is copied into an isolated migration directory by CI and is never
-- part of the production Supabase migration chain.

create or replace function public.pf5_fixture_assert(p_condition boolean, p_message text)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if p_condition is not true then
    raise exception 'pf5_fixture_assert:%', p_message;
  end if;
end;
$$;

insert into auth.users (
  id,
  aud,
  role,
  email,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  is_sso_user,
  is_anonymous
) values (
  '81000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'pf5-owner@example.test',
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now(),
  false,
  false
);

insert into public.admin_memberships (
  user_id,
  role,
  is_active,
  granted_by
) values (
  '81000000-0000-4000-8000-000000000001',
  'admin_owner',
  true,
  null
);

insert into public.products (
  id,
  name,
  brand,
  category,
  product_form,
  skin_types,
  concerns,
  texture,
  finish,
  irritation_risk,
  sensitivity_safe,
  normalized_name,
  normalized_brand,
  created_at,
  updated_at
) values (
  '82000000-0000-4000-8000-000000000001',
  'PF5 Fixture Product',
  'Fixture Brand',
  'cleanser',
  null,
  array['sensitive'],
  array['barrier'],
  'gel',
  'fresh',
  'low',
  true,
  'pf5 fixture product',
  'fixture brand',
  now(),
  now()
);

insert into public.product_fact_subjects (
  subject_id,
  product_id,
  subject_semantic_key,
  subject_identity_serializer_version,
  variant_key,
  formulation_revision_key,
  formulation_label,
  identity_status,
  identity_resolution_version,
  current_state,
  market_applicability,
  region_applicability,
  valid_from,
  valid_to,
  predecessor_subject_id,
  supersession_kind,
  created_at,
  updated_at
) values (
  '83000000-0000-4000-8000-000000000001',
  '82000000-0000-4000-8000-000000000001',
  repeat('8', 64),
  'product-fact-subject-identity-v1',
  null,
  'fixture-formulation-r1',
  'fixture formulation',
  'resolved',
  'fixture-identity-resolution-v1',
  'current',
  null,
  null,
  null,
  null,
  null,
  null,
  now(),
  now()
);

create or replace function public.pf5_fixture_definition(
  p_registry_version text default 'fixture-registry-v1'
)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'fact_key', 'fixture.boolean_fact',
    'value_type', 'boolean',
    'registry_version', p_registry_version,
    'permitted_evidence_classes', jsonb_build_array(
      'product_claim',
      'observation',
      'composition_identity'
    )
  );
$$;

create or replace function public.pf5_fixture_registry_payload(
  p_registry_version text default 'fixture-registry-v1',
  p_identity_serializer_version text default 'product-fact-proposition-identity-v2',
  p_extra_marker text default null
)
returns jsonb
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_definition jsonb;
  v_definition_checksum text;
  v_definition_row jsonb;
  v_registry_checksum text;
begin
  v_definition := public.pf5_fixture_definition(p_registry_version);
  if p_extra_marker is not null then
    v_definition := v_definition || jsonb_build_object('fixture_marker', p_extra_marker);
  end if;

  v_definition_checksum := public.product_fact_controlled_sha256_json_v1(v_definition);
  v_definition_row := jsonb_build_object(
    'fact_key', 'fixture.boolean_fact',
    'value_type', 'boolean',
    'definition', v_definition,
    'definition_checksum', v_definition_checksum,
    'deprecated', false,
    'superseded_by_fact_key', null
  );

  v_registry_checksum := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object(
      'registry_version', p_registry_version,
      'identity_serializer_version', p_identity_serializer_version,
      'definitions', jsonb_build_array(
        jsonb_build_object(
          'fact_key', 'fixture.boolean_fact',
          'value_type', 'boolean',
          'definition_checksum', v_definition_checksum,
          'deprecated', false,
          'superseded_by_fact_key', null
        )
      )
    )
  );

  return jsonb_build_object(
    'registry_version', p_registry_version,
    'registry_checksum', v_registry_checksum,
    'identity_serializer_version', p_identity_serializer_version,
    'effective_at', null,
    'definitions', jsonb_build_array(v_definition_row)
  );
end;
$$;

do $$
declare
  v_first jsonb;
  v_second jsonb;
begin
  v_first := public.admin_publish_product_fact_registry_v1(
    '81000000-0000-4000-8000-000000000001',
    'pf5-registry-publish-v1',
    public.pf5_fixture_registry_payload()
  );
  perform public.pf5_fixture_assert(
    v_first ->> 'status' = 'published' and (v_first ->> 'idempotent')::boolean = false,
    'registry_first_publish'
  );

  v_second := public.admin_publish_product_fact_registry_v1(
    '81000000-0000-4000-8000-000000000001',
    'pf5-registry-publish-v1-repeat',
    public.pf5_fixture_registry_payload()
  );
  perform public.pf5_fixture_assert(
    v_second ->> 'status' = 'published' and (v_second ->> 'idempotent')::boolean = true,
    'registry_idempotent_publish'
  );

  begin
    perform public.admin_publish_product_fact_registry_v1(
      '81000000-0000-4000-8000-000000000001',
      'pf5-registry-publish-conflict',
      public.pf5_fixture_registry_payload('fixture-registry-v1', 'product-fact-proposition-identity-v2', 'different')
    );
    raise exception 'pf5_fixture_expected_failure:registry_conflict';
  exception
    when unique_violation then null;
  end;
end $$;

create or replace function public.pf5_fixture_ingest_support(
  p_label text,
  p_proposition_key text,
  p_authority text default 'product_specific_primary',
  p_evidence_class text default 'product_claim',
  p_source_kind text default 'official_product_page'
)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_source_digest text;
  v_evidence_digest text;
  v_result jsonb;
begin
  v_source_digest := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object('source', p_label)
  );
  v_evidence_digest := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object('evidence', p_label, 'direction', 'supports')
  );

  v_result := public.admin_ingest_product_fact_evidence_v1(
    '81000000-0000-4000-8000-000000000001',
    'pf5-ingest-support-' || p_label,
    jsonb_build_object(
      'source', jsonb_build_object(
        'canonical_locator', 'https://example.test/pf5/' || p_label,
        'publisher', 'PF5 Fixture Publisher',
        'source_kind', p_source_kind,
        'source_metadata', jsonb_build_object('fixture', true),
        'content_digest', v_source_digest,
        'external_snapshot_reference', null,
        'market', null,
        'region', null,
        'locale', 'en',
        'published_at', null,
        'accessed_at', clock_timestamp(),
        'observed_at', clock_timestamp()
      ),
      'binding', jsonb_build_object(
        'product_id', '82000000-0000-4000-8000-000000000001',
        'subject_id', '83000000-0000-4000-8000-000000000001',
        'binding_state', 'exact_subject_match',
        'scope_relation', 'equivalent',
        'presentation_metadata', jsonb_build_object('fixture', true),
        'identity_resolution_version', 'fixture-binding-v1-' || p_label,
        'reviewed_at', clock_timestamp()
      ),
      'evidence', jsonb_build_object(
        'registry_version', 'fixture-registry-v1',
        'fact_key', 'fixture.boolean_fact',
        'proposition_key', p_proposition_key,
        'proposition_serializer_version', 'product-fact-proposition-identity-v2',
        'proposition_value_identity', null,
        'parent_proposition_key', null,
        'evidence_class', p_evidence_class,
        'evidence_authority', p_authority,
        'confidence', 'high',
        'support_direction', 'supports',
        'negative_admissibility', 'not_applicable',
        'market', null,
        'region', null,
        'locale', 'en',
        'valid_from', null,
        'valid_to', null,
        'qualifier', jsonb_build_object(),
        'canonical_evidence_digest', v_evidence_digest,
        'supersedes_evidence_id', null
      )
    )
  );
  return v_result;
end;
$$;

create or replace function public.pf5_fixture_ingest_opposition(
  p_label text,
  p_proposition_key text,
  p_supersedes_evidence_id uuid default null
)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_source_digest text;
  v_evidence_digest text;
begin
  v_source_digest := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object('source', p_label, 'direction', 'opposes')
  );
  v_evidence_digest := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object('evidence', p_label, 'direction', 'opposes')
  );

  return public.admin_ingest_product_fact_evidence_v1(
    '81000000-0000-4000-8000-000000000001',
    'pf5-ingest-oppose-' || p_label,
    jsonb_build_object(
      'source', jsonb_build_object(
        'canonical_locator', 'https://example.test/pf5/opposition/' || p_label,
        'publisher', 'PF5 Fixture Publisher',
        'source_kind', 'review_observation',
        'source_metadata', jsonb_build_object('fixture', true),
        'content_digest', v_source_digest,
        'external_snapshot_reference', null,
        'market', null,
        'region', null,
        'locale', 'en',
        'published_at', null,
        'accessed_at', clock_timestamp(),
        'observed_at', clock_timestamp()
      ),
      'binding', jsonb_build_object(
        'product_id', '82000000-0000-4000-8000-000000000001',
        'subject_id', '83000000-0000-4000-8000-000000000001',
        'binding_state', 'exact_subject_match',
        'scope_relation', 'equivalent',
        'presentation_metadata', jsonb_build_object('fixture', true),
        'identity_resolution_version', 'fixture-opposition-binding-v1-' || p_label,
        'reviewed_at', clock_timestamp()
      ),
      'evidence', jsonb_build_object(
        'registry_version', 'fixture-registry-v1',
        'fact_key', 'fixture.boolean_fact',
        'proposition_key', p_proposition_key,
        'proposition_serializer_version', 'product-fact-proposition-identity-v2',
        'proposition_value_identity', null,
        'parent_proposition_key', null,
        'evidence_class', 'observation',
        'evidence_authority', 'review_observation',
        'confidence', 'medium',
        'support_direction', 'opposes',
        'negative_admissibility', 'explicit_negative',
        'market', null,
        'region', null,
        'locale', 'en',
        'valid_from', null,
        'valid_to', null,
        'qualifier', jsonb_build_object(),
        'canonical_evidence_digest', v_evidence_digest,
        'supersedes_evidence_id', p_supersedes_evidence_id
      )
    )
  );
end;
$$;

create or replace function public.pf5_fixture_fusion_digest(
  p_proposition_key text,
  p_fusion_policy_version text,
  p_supporting_ids uuid[],
  p_opposing_ids uuid[]
)
returns text
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_all_ids uuid[];
  v_evidence_rows jsonb;
begin
  select coalesce(array_agg(value order by value), '{}'::uuid[])
  into v_all_ids
  from (
    select unnest(coalesce(p_supporting_ids, '{}'::uuid[])) as value
    union all
    select unnest(coalesce(p_opposing_ids, '{}'::uuid[])) as value
  ) as combined;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'evidence_id', evidence.evidence_id,
        'role', case
          when evidence.evidence_id = any(coalesce(p_supporting_ids, '{}'::uuid[]))
            then 'supporting'
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

  return public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object(
      'registry_version', 'fixture-registry-v1',
      'subject_id', '83000000-0000-4000-8000-000000000001',
      'fact_key', 'fixture.boolean_fact',
      'proposition_key', p_proposition_key,
      'fusion_policy_version', p_fusion_policy_version,
      'evidence', v_evidence_rows
    )
  );
end;
$$;

create or replace function public.pf5_fixture_payload(
  p_assignment_id uuid,
  p_proposition_key text,
  p_fusion_policy_version text,
  p_supporting_ids uuid[],
  p_opposing_ids uuid[],
  p_semantic_status text default 'supported',
  p_boolean_value boolean default true,
  p_authority_ceiling text default 'product_specific_primary'
)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'assignment_id', p_assignment_id,
    'subject_id', '83000000-0000-4000-8000-000000000001',
    'registry_version', 'fixture-registry-v1',
    'fact_key', 'fixture.boolean_fact',
    'proposition_key', p_proposition_key,
    'proposition_serializer_version', 'product-fact-proposition-identity-v2',
    'semantic_status', p_semantic_status,
    'value_type', case when p_semantic_status = 'supported' then 'boolean' else null end,
    'value_boolean', case when p_semantic_status = 'supported' then to_jsonb(p_boolean_value) else 'null'::jsonb end,
    'value_enum', null,
    'value_number', null,
    'value_unit', null,
    'value_range_min', null,
    'value_range_max', null,
    'value_entity_identifier', null,
    'market', null,
    'region', null,
    'locale', 'en',
    'valid_from', null,
    'valid_to', null,
    'qualifier', jsonb_build_object(),
    'parent_fact_instance_id', null,
    'parent_proposition_key', null,
    'authority_ceiling', p_authority_ceiling,
    'fused_confidence', 'high',
    'fusion_policy_version', p_fusion_policy_version,
    'fusion_input_digest', public.pf5_fixture_fusion_digest(
      p_proposition_key,
      p_fusion_policy_version,
      p_supporting_ids,
      p_opposing_ids
    ),
    'supporting_evidence_ids', to_jsonb(coalesce(p_supporting_ids, '{}'::uuid[])),
    'opposing_evidence_ids', to_jsonb(coalesce(p_opposing_ids, '{}'::uuid[]))
  );
$$;

create or replace function public.pf5_fixture_prepare_scenario(
  p_label text,
  p_fusion_policy_version text default 'fixture-fusion-v1',
  p_authority text default 'product_specific_primary',
  p_evidence_class text default 'product_claim'
)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_proposition_key text;
  v_evidence_result jsonb;
  v_evidence_id uuid;
  v_assignment_result jsonb;
  v_assignment_id uuid;
  v_payload jsonb;
  v_preflight jsonb;
begin
  v_proposition_key := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object('pf5_fixture_scenario', p_label)
  );

  v_evidence_result := public.pf5_fixture_ingest_support(
    p_label,
    v_proposition_key,
    p_authority,
    p_evidence_class
  );
  v_evidence_id := (v_evidence_result ->> 'evidence_id')::uuid;

  v_assignment_result := public.admin_prepare_product_fact_review_v1(
    '81000000-0000-4000-8000-000000000001',
    'pf5-review-under-' || p_label,
    jsonb_build_object(
      'product_id', '82000000-0000-4000-8000-000000000001',
      'subject_id', '83000000-0000-4000-8000-000000000001',
      'registry_version', 'fixture-registry-v1',
      'fact_key', 'fixture.boolean_fact',
      'proposition_key', v_proposition_key,
      'operational_state', 'under_review',
      'assigned_to', '81000000-0000-4000-8000-000000000001',
      'review_policy_version', 'fixture-review-v1',
      'reason_code', 'fixture_prepare'
    )
  );
  v_assignment_id := (v_assignment_result ->> 'assignment_id')::uuid;

  perform public.admin_prepare_product_fact_review_v1(
    '81000000-0000-4000-8000-000000000001',
    'pf5-review-ready-' || p_label,
    jsonb_build_object(
      'product_id', '82000000-0000-4000-8000-000000000001',
      'subject_id', '83000000-0000-4000-8000-000000000001',
      'registry_version', 'fixture-registry-v1',
      'fact_key', 'fixture.boolean_fact',
      'proposition_key', v_proposition_key,
      'operational_state', 'ready_for_confirm',
      'assigned_to', '81000000-0000-4000-8000-000000000001',
      'review_policy_version', 'fixture-review-v1',
      'reason_code', 'fixture_ready'
    )
  );

  v_payload := public.pf5_fixture_payload(
    v_assignment_id,
    v_proposition_key,
    p_fusion_policy_version,
    array[v_evidence_id],
    '{}'::uuid[],
    'supported',
    true,
    p_authority
  );

  v_preflight := public.admin_preflight_product_fact_confirmation_v1(
    '81000000-0000-4000-8000-000000000001',
    'pf5-confirm-' || p_label,
    v_payload
  );

  return jsonb_build_object(
    'label', p_label,
    'proposition_key', v_proposition_key,
    'source_id', v_evidence_result -> 'source_id',
    'binding_id', v_evidence_result -> 'binding_id',
    'evidence_id', v_evidence_id,
    'assignment_id', v_assignment_id,
    'payload', v_payload,
    'preflight', v_preflight
  );
end;
$$;

-- Security postconditions hold in an actual PostgreSQL catalog.
do $$
declare
  v_table text;
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
  ] loop
    perform public.pf5_fixture_assert(
      not has_table_privilege('anon', format('public.%I', v_table), 'INSERT,UPDATE,DELETE,TRUNCATE')
      and not has_table_privilege('authenticated', format('public.%I', v_table), 'INSERT,UPDATE,DELETE,TRUNCATE')
      and not has_table_privilege('service_role', format('public.%I', v_table), 'INSERT,UPDATE,DELETE,TRUNCATE'),
      'direct_write_privilege:' || v_table
    );
  end loop;

  foreach v_rpc in array array[
    'public.admin_publish_product_fact_registry_v1(uuid,text,jsonb)',
    'public.admin_ingest_product_fact_evidence_v1(uuid,text,jsonb)',
    'public.admin_prepare_product_fact_review_v1(uuid,text,jsonb)',
    'public.admin_preflight_product_fact_confirmation_v1(uuid,text,jsonb)',
    'public.admin_confirm_product_fact_v1(uuid,text,jsonb,text,text)'
  ] loop
    perform public.pf5_fixture_assert(
      has_function_privilege('service_role', v_rpc, 'EXECUTE')
      and not has_function_privilege('anon', v_rpc, 'EXECUTE')
      and not has_function_privilege('authenticated', v_rpc, 'EXECUTE'),
      'rpc_privilege:' || v_rpc
    );
  end loop;
end $$;

-- Evidence ingest must not fabricate Fact or Current state.
do $$
declare
  v_prop text := repeat('1', 64);
  v_result jsonb;
begin
  v_result := public.pf5_fixture_ingest_support('evidence-only', v_prop);
  perform public.pf5_fixture_assert(v_result ->> 'evidence_id' is not null, 'evidence_only_created');
  perform public.pf5_fixture_assert((select count(*) from public.product_fact_instances) = 0, 'evidence_no_fact');
  perform public.pf5_fixture_assert((select count(*) from public.product_fact_current) = 0, 'evidence_no_current');
  perform public.pf5_fixture_assert((select count(*) from public.product_fact_confirmations) = 0, 'evidence_no_confirmation');
end $$;

-- Market-popularity sources cannot be promoted into efficacy/safety Fact support.
do $$
begin
  begin
    perform public.pf5_fixture_ingest_support(
      'market-popularity-rejected',
      repeat('2', 64),
      'product_specific_primary',
      'observation',
      'market_popularity_ranking'
    );
    raise exception 'pf5_fixture_expected_failure:market_popularity';
  exception
    when check_violation then null;
  end;
end $$;

-- Dry-run write-zero, atomic confirm, Current confirmation link, and idempotency.
do $$
declare
  v_scenario jsonb;
  v_payload jsonb;
  v_preflight jsonb;
  v_result jsonb;
  v_replay jsonb;
  v_fact_before bigint;
  v_link_before bigint;
  v_confirmation_before bigint;
  v_current_before bigint;
  v_assignment_before bigint;
  v_event_before bigint;
  v_fact_after_preflight bigint;
  v_link_after_preflight bigint;
  v_confirmation_after_preflight bigint;
  v_current_after_preflight bigint;
  v_assignment_after_preflight bigint;
  v_event_after_preflight bigint;
  v_fact_after_confirm bigint;
  v_link_after_confirm bigint;
  v_confirmation_after_confirm bigint;
  v_current_after_confirm bigint;
  v_event_after_confirm bigint;
  v_fact_after_replay bigint;
  v_link_after_replay bigint;
  v_confirmation_after_replay bigint;
  v_current_after_replay bigint;
  v_event_after_replay bigint;
begin
  v_scenario := public.pf5_fixture_prepare_scenario('happy-path');
  v_payload := v_scenario -> 'payload';

  select count(*) into v_fact_before from public.product_fact_instances;
  select count(*) into v_link_before from public.product_fact_evidence_links;
  select count(*) into v_confirmation_before from public.product_fact_confirmations;
  select count(*) into v_current_before from public.product_fact_current;
  select count(*) into v_assignment_before from public.product_fact_review_assignments;
  select count(*) into v_event_before from public.product_fact_review_events;

  v_preflight := public.admin_preflight_product_fact_confirmation_v1(
    '81000000-0000-4000-8000-000000000001',
    'pf5-confirm-happy-path',
    v_payload
  );

  select count(*) into v_fact_after_preflight from public.product_fact_instances;
  select count(*) into v_link_after_preflight from public.product_fact_evidence_links;
  select count(*) into v_confirmation_after_preflight from public.product_fact_confirmations;
  select count(*) into v_current_after_preflight from public.product_fact_current;
  select count(*) into v_assignment_after_preflight from public.product_fact_review_assignments;
  select count(*) into v_event_after_preflight from public.product_fact_review_events;

  perform public.pf5_fixture_assert(v_preflight ->> 'status' = 'ready', 'dry_run_ready');
  perform public.pf5_fixture_assert(v_fact_after_preflight = v_fact_before, 'dry_run_fact_zero');
  perform public.pf5_fixture_assert(v_link_after_preflight = v_link_before, 'dry_run_link_zero');
  perform public.pf5_fixture_assert(v_confirmation_after_preflight = v_confirmation_before, 'dry_run_confirmation_zero');
  perform public.pf5_fixture_assert(v_current_after_preflight = v_current_before, 'dry_run_current_zero');
  perform public.pf5_fixture_assert(v_assignment_after_preflight = v_assignment_before, 'dry_run_assignment_zero');
  perform public.pf5_fixture_assert(v_event_after_preflight = v_event_before, 'dry_run_event_zero');

  v_result := public.admin_confirm_product_fact_v1(
    '81000000-0000-4000-8000-000000000001',
    'pf5-confirm-happy-path',
    v_payload,
    v_preflight ->> 'payload_digest',
    v_preflight ->> 'prestate_digest'
  );

  select count(*) into v_fact_after_confirm from public.product_fact_instances;
  select count(*) into v_link_after_confirm from public.product_fact_evidence_links;
  select count(*) into v_confirmation_after_confirm from public.product_fact_confirmations;
  select count(*) into v_current_after_confirm from public.product_fact_current;
  select count(*) into v_event_after_confirm from public.product_fact_review_events;

  perform public.pf5_fixture_assert(v_result ->> 'status' = 'confirmed', 'confirm_status');
  perform public.pf5_fixture_assert((v_result ->> 'idempotent')::boolean = false, 'confirm_not_replay');
  perform public.pf5_fixture_assert(v_fact_after_confirm = v_fact_before + 1, 'confirm_fact_once');
  perform public.pf5_fixture_assert(v_link_after_confirm = v_link_before + 1, 'confirm_link_once');
  perform public.pf5_fixture_assert(v_confirmation_after_confirm = v_confirmation_before + 1, 'confirm_confirmation_once');
  perform public.pf5_fixture_assert(v_current_after_confirm = v_current_before + 1, 'confirm_current_once');
  perform public.pf5_fixture_assert(v_event_after_confirm = v_event_before + 1, 'confirm_event_once');
  perform public.pf5_fixture_assert(
    exists (
      select 1
      from public.product_fact_current as current_fact
      where current_fact.proposition_key = v_scenario ->> 'proposition_key'
        and current_fact.fact_instance_id = (v_result ->> 'fact_instance_id')::uuid
        and current_fact.confirmation_id = (v_result ->> 'confirmation_id')::uuid
    ),
    'current_confirmation_guard'
  );
  perform public.pf5_fixture_assert(
    (select operational_state from public.product_fact_review_assignments
     where assignment_id = (v_scenario ->> 'assignment_id')::uuid) = 'confirmed',
    'assignment_confirmed'
  );

  v_replay := public.admin_confirm_product_fact_v1(
    '81000000-0000-4000-8000-000000000001',
    'pf5-confirm-happy-path',
    v_payload,
    v_preflight ->> 'payload_digest',
    v_preflight ->> 'prestate_digest'
  );

  select count(*) into v_fact_after_replay from public.product_fact_instances;
  select count(*) into v_link_after_replay from public.product_fact_evidence_links;
  select count(*) into v_confirmation_after_replay from public.product_fact_confirmations;
  select count(*) into v_current_after_replay from public.product_fact_current;
  select count(*) into v_event_after_replay from public.product_fact_review_events;

  perform public.pf5_fixture_assert((v_replay ->> 'idempotent')::boolean = true, 'idempotent_replay_flag');
  perform public.pf5_fixture_assert(v_replay ->> 'fact_instance_id' = v_result ->> 'fact_instance_id', 'idempotent_same_fact');
  perform public.pf5_fixture_assert(v_fact_after_replay = v_fact_after_confirm, 'idempotent_fact_no_duplicate');
  perform public.pf5_fixture_assert(v_link_after_replay = v_link_after_confirm, 'idempotent_link_no_duplicate');
  perform public.pf5_fixture_assert(v_confirmation_after_replay = v_confirmation_after_confirm, 'idempotent_confirmation_no_duplicate');
  perform public.pf5_fixture_assert(v_current_after_replay = v_current_after_confirm, 'idempotent_current_no_duplicate');
  perform public.pf5_fixture_assert(v_event_after_replay = v_event_after_confirm, 'idempotent_event_no_duplicate');

  begin
    perform public.admin_confirm_product_fact_v1(
      '81000000-0000-4000-8000-000000000001',
      'pf5-confirm-happy-path',
      jsonb_set(v_payload, '{fused_confidence}', '"medium"'::jsonb),
      public.product_fact_controlled_sha256_json_v1(
        jsonb_set(v_payload, '{fused_confidence}', '"medium"'::jsonb)
      ),
      v_preflight ->> 'prestate_digest'
    );
    raise exception 'pf5_fixture_expected_failure:idempotent_payload_conflict';
  exception
    when unique_violation then null;
  end;

  begin
    perform public.admin_confirm_product_fact_v1(
      '81000000-0000-4000-8000-000000000001',
      'pf5-confirm-happy-path',
      v_payload,
      v_preflight ->> 'payload_digest',
      repeat('f', 64)
    );
    raise exception 'pf5_fixture_expected_failure:idempotent_prestate_conflict';
  exception
    when unique_violation then null;
  end;
end $$;

-- Non-supported states cannot carry Boolean false, and supported(false) requires
-- explicit admissible negative evidence rather than absence.
do $$
declare
  v_scenario jsonb;
  v_payload jsonb;
  v_preflight jsonb;
  v_prop text;
  v_opp jsonb;
  v_opp_id uuid;
  v_assignment jsonb;
  v_assignment_id uuid;
  v_false_payload jsonb;
begin
  v_scenario := public.pf5_fixture_prepare_scenario('missing-not-false');
  v_payload := jsonb_set(v_scenario -> 'payload', '{semantic_status}', '"reviewed_not_established"'::jsonb);
  v_payload := jsonb_set(v_payload, '{value_type}', 'null'::jsonb);
  v_payload := jsonb_set(v_payload, '{value_boolean}', 'false'::jsonb);
  begin
    perform public.admin_preflight_product_fact_confirmation_v1(
      '81000000-0000-4000-8000-000000000001',
      'pf5-confirm-missing-not-false',
      v_payload
    );
    raise exception 'pf5_fixture_expected_failure:missing_not_false';
  exception
    when check_violation then null;
  end;

  v_payload := jsonb_set(v_scenario -> 'payload', '{value_boolean}', 'false'::jsonb);
  begin
    perform public.admin_preflight_product_fact_confirmation_v1(
      '81000000-0000-4000-8000-000000000001',
      'pf5-confirm-false-without-explicit-negative',
      v_payload
    );
    raise exception 'pf5_fixture_expected_failure:false_without_negative';
  exception
    when check_violation then null;
  end;

  v_prop := public.product_fact_controlled_sha256_json_v1(jsonb_build_object('pf5_fixture_scenario', 'supported-false'));
  v_opp := public.pf5_fixture_ingest_opposition('supported-false', v_prop);
  v_opp_id := (v_opp ->> 'evidence_id')::uuid;
  v_assignment := public.admin_prepare_product_fact_review_v1(
    '81000000-0000-4000-8000-000000000001',
    'pf5-review-under-supported-false',
    jsonb_build_object(
      'product_id', '82000000-0000-4000-8000-000000000001',
      'subject_id', '83000000-0000-4000-8000-000000000001',
      'registry_version', 'fixture-registry-v1',
      'fact_key', 'fixture.boolean_fact',
      'proposition_key', v_prop,
      'operational_state', 'under_review',
      'assigned_to', '81000000-0000-4000-8000-000000000001',
      'review_policy_version', 'fixture-review-v1',
      'reason_code', 'fixture_prepare'
    )
  );
  v_assignment_id := (v_assignment ->> 'assignment_id')::uuid;
  perform public.admin_prepare_product_fact_review_v1(
    '81000000-0000-4000-8000-000000000001',
    'pf5-review-ready-supported-false',
    jsonb_build_object(
      'product_id', '82000000-0000-4000-8000-000000000001',
      'subject_id', '83000000-0000-4000-8000-000000000001',
      'registry_version', 'fixture-registry-v1',
      'fact_key', 'fixture.boolean_fact',
      'proposition_key', v_prop,
      'operational_state', 'ready_for_confirm',
      'assigned_to', '81000000-0000-4000-8000-000000000001',
      'review_policy_version', 'fixture-review-v1',
      'reason_code', 'fixture_ready'
    )
  );
  v_false_payload := public.pf5_fixture_payload(
    v_assignment_id,
    v_prop,
    'fixture-fusion-false-v1',
    '{}'::uuid[],
    array[v_opp_id],
    'supported',
    false,
    'review_observation'
  );
  v_preflight := public.admin_preflight_product_fact_confirmation_v1(
    '81000000-0000-4000-8000-000000000001',
    'pf5-confirm-supported-false',
    v_false_payload
  );
  perform public.pf5_fixture_assert(v_preflight ->> 'status' = 'ready', 'supported_false_explicit_negative_ready');
  perform public.pf5_fixture_assert(v_preflight #>> '{proposed_value,value_boolean}' = 'false', 'supported_false_preserved');
end $$;

-- Ingredient-basis evidence cannot be promoted above its authority ceiling.
do $$
declare
  v_scenario jsonb;
  v_payload jsonb;
begin
  v_scenario := public.pf5_fixture_prepare_scenario(
    'ingredient-ceiling',
    'fixture-fusion-ingredient-v1',
    'ingredient_basis',
    'composition_identity'
  );
  v_payload := jsonb_set(v_scenario -> 'payload', '{authority_ceiling}', '"product_specific_primary"'::jsonb);
  begin
    perform public.admin_preflight_product_fact_confirmation_v1(
      '81000000-0000-4000-8000-000000000001',
      'pf5-confirm-ingredient-ceiling',
      v_payload
    );
    raise exception 'pf5_fixture_expected_failure:ingredient_ceiling';
  exception
    when check_violation then null;
  end;
end $$;

-- Stale Current rejection.
do $$
declare
  v_scenario jsonb;
  v_payload jsonb;
  v_preflight jsonb;
  v_fact_id uuid := '84000000-0000-4000-8000-000000000001';
  v_confirmation_id uuid := '85000000-0000-4000-8000-000000000001';
  v_prop text;
begin
  v_scenario := public.pf5_fixture_prepare_scenario('stale-current');
  v_payload := v_scenario -> 'payload';
  v_preflight := v_scenario -> 'preflight';
  v_prop := v_scenario ->> 'proposition_key';

  insert into public.product_fact_instances (
    fact_instance_id, subject_id, registry_version, fact_key, proposition_key,
    proposition_serializer_version, semantic_status, value_type, value_boolean,
    qualifier, authority_ceiling, fused_confidence, fusion_policy_version,
    fusion_input_digest, created_at
  ) values (
    v_fact_id, '83000000-0000-4000-8000-000000000001', 'fixture-registry-v1',
    'fixture.boolean_fact', v_prop, 'product-fact-proposition-identity-v2',
    'supported', 'boolean', true, '{}'::jsonb, 'product_specific_primary', 'high',
    'fixture-concurrent-current-v1', repeat('4', 64), now()
  );
  insert into public.product_fact_confirmations (
    confirmation_id, request_id, namespace, actor_user_id,
    payload_digest, prestate_digest, result_digest, result, created_at
  ) values (
    v_confirmation_id, 'pf5-concurrent-current', 'fixture_concurrent',
    '81000000-0000-4000-8000-000000000001', repeat('5',64), repeat('6',64),
    repeat('7',64), jsonb_build_object('fixture', true), now()
  );
  insert into public.product_fact_current (
    proposition_key, fact_instance_id, subject_id, confirmation_id, updated_at
  ) values (
    v_prop, v_fact_id, '83000000-0000-4000-8000-000000000001', v_confirmation_id, clock_timestamp()
  );

  begin
    perform public.admin_confirm_product_fact_v1(
      '81000000-0000-4000-8000-000000000001',
      'pf5-confirm-stale-current',
      v_payload,
      v_preflight ->> 'payload_digest',
      v_preflight ->> 'prestate_digest'
    );
    raise exception 'pf5_fixture_expected_failure:stale_current';
  exception
    when serialization_failure then null;
  end;
end $$;

-- Stale Evidence rejection via a superseding EvidenceRecord.
do $$
declare
  v_scenario jsonb;
  v_payload jsonb;
  v_preflight jsonb;
  v_old_evidence uuid;
begin
  v_scenario := public.pf5_fixture_prepare_scenario('stale-evidence');
  v_payload := v_scenario -> 'payload';
  v_preflight := v_scenario -> 'preflight';
  v_old_evidence := (v_scenario ->> 'evidence_id')::uuid;

  perform public.pf5_fixture_ingest_opposition(
    'stale-evidence-superseder',
    v_scenario ->> 'proposition_key',
    v_old_evidence
  );

  begin
    perform public.admin_confirm_product_fact_v1(
      '81000000-0000-4000-8000-000000000001',
      'pf5-confirm-stale-evidence',
      v_payload,
      v_preflight ->> 'payload_digest',
      v_preflight ->> 'prestate_digest'
    );
    raise exception 'pf5_fixture_expected_failure:stale_evidence';
  exception
    when serialization_failure then null;
  end;
end $$;

-- Stale source-to-subject binding rejection.
do $$
declare
  v_scenario jsonb;
  v_payload jsonb;
  v_preflight jsonb;
  v_source_id uuid;
begin
  v_scenario := public.pf5_fixture_prepare_scenario('stale-binding');
  v_payload := v_scenario -> 'payload';
  v_preflight := v_scenario -> 'preflight';
  v_source_id := (v_scenario ->> 'source_id')::uuid;

  insert into public.product_evidence_source_subject_bindings (
    source_id, product_id, subject_id, binding_state, scope_relation,
    presentation_metadata, identity_resolution_version, reviewed_by,
    reviewed_at, created_at
  ) values (
    v_source_id,
    '82000000-0000-4000-8000-000000000001',
    '83000000-0000-4000-8000-000000000001',
    'equivalent_presentation_match',
    'equivalent',
    jsonb_build_object('fixture', 'newer_binding'),
    'fixture-newer-binding-v2',
    '81000000-0000-4000-8000-000000000001',
    clock_timestamp() + interval '1 minute',
    clock_timestamp() + interval '1 minute'
  );

  begin
    perform public.admin_confirm_product_fact_v1(
      '81000000-0000-4000-8000-000000000001',
      'pf5-confirm-stale-binding',
      v_payload,
      v_preflight ->> 'payload_digest',
      v_preflight ->> 'prestate_digest'
    );
    raise exception 'pf5_fixture_expected_failure:stale_binding';
  exception
    when serialization_failure then null;
  end;
end $$;

-- Stale assignment rejection.
do $$
declare
  v_scenario jsonb;
  v_payload jsonb;
  v_preflight jsonb;
  v_assignment_id uuid;
begin
  v_scenario := public.pf5_fixture_prepare_scenario('stale-assignment');
  v_payload := v_scenario -> 'payload';
  v_preflight := v_scenario -> 'preflight';
  v_assignment_id := (v_scenario ->> 'assignment_id')::uuid;

  update public.product_fact_review_assignments
  set operational_state = 'under_review', updated_at = clock_timestamp()
  where assignment_id = v_assignment_id;

  begin
    perform public.admin_confirm_product_fact_v1(
      '81000000-0000-4000-8000-000000000001',
      'pf5-confirm-stale-assignment',
      v_payload,
      v_preflight ->> 'payload_digest',
      v_preflight ->> 'prestate_digest'
    );
    raise exception 'pf5_fixture_expected_failure:stale_assignment';
  exception
    when serialization_failure then null;
  end;
end $$;

-- Stale subject rejection, followed by explicit fixture restoration.
do $$
declare
  v_scenario jsonb;
  v_payload jsonb;
  v_preflight jsonb;
begin
  v_scenario := public.pf5_fixture_prepare_scenario('stale-subject');
  v_payload := v_scenario -> 'payload';
  v_preflight := v_scenario -> 'preflight';

  update public.product_fact_subjects
  set current_state = 'historical', updated_at = clock_timestamp()
  where subject_id = '83000000-0000-4000-8000-000000000001';

  begin
    perform public.admin_confirm_product_fact_v1(
      '81000000-0000-4000-8000-000000000001',
      'pf5-confirm-stale-subject',
      v_payload,
      v_preflight ->> 'payload_digest',
      v_preflight ->> 'prestate_digest'
    );
    raise exception 'pf5_fixture_expected_failure:stale_subject';
  exception
    when serialization_failure then null;
  end;

  update public.product_fact_subjects
  set current_state = 'current', updated_at = clock_timestamp()
  where subject_id = '83000000-0000-4000-8000-000000000001';
end $$;

-- Test-only injected failure triggers prove late-stage statement rollback without
-- adding any production failpoint to the controlled write RPC.
create or replace function public.pf5_fixture_failpoint()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_policy text;
begin
  if tg_table_name = 'product_fact_instances' then
    v_policy := new.fusion_policy_version;
  elsif tg_table_name = 'product_fact_evidence_links' then
    select fusion_policy_version into v_policy
    from public.product_fact_instances
    where fact_instance_id = new.fact_instance_id;
  elsif tg_table_name = 'product_fact_confirmations' then
    v_policy := new.result ->> 'fusion_policy_version';
  elsif tg_table_name = 'product_fact_current' then
    select fusion_policy_version into v_policy
    from public.product_fact_instances
    where fact_instance_id = new.fact_instance_id;
  elsif tg_table_name = 'product_fact_review_assignments' then
    if new.operational_state = 'confirmed' and old.operational_state = 'ready_for_confirm' then
      select fact.fusion_policy_version into v_policy
      from public.product_fact_current as current_fact
      join public.product_fact_instances as fact
        on fact.fact_instance_id = current_fact.fact_instance_id
      where current_fact.proposition_key = new.proposition_key;
    end if;
  elsif tg_table_name = 'product_fact_review_events' then
    if new.event_kind = 'fact_confirmed' and new.fact_instance_id is not null then
      select fusion_policy_version into v_policy
      from public.product_fact_instances
      where fact_instance_id = new.fact_instance_id;
    end if;
  end if;

  if (tg_table_name = 'product_fact_instances' and v_policy = 'fixture-fail-fact')
    or (tg_table_name = 'product_fact_evidence_links' and v_policy = 'fixture-fail-link')
    or (tg_table_name = 'product_fact_confirmations' and v_policy = 'fixture-fail-confirmation')
    or (tg_table_name = 'product_fact_current' and v_policy = 'fixture-fail-current')
    or (tg_table_name = 'product_fact_review_assignments' and v_policy = 'fixture-fail-after-current')
    or (tg_table_name = 'product_fact_review_events' and v_policy = 'fixture-fail-review-event')
  then
    raise exception 'pf5_fixture_failpoint:%', v_policy;
  end if;

  return new;
end;
$$;

create trigger pf5_fixture_fail_fact
before insert on public.product_fact_instances
for each row execute function public.pf5_fixture_failpoint();

create trigger pf5_fixture_fail_link
before insert on public.product_fact_evidence_links
for each row execute function public.pf5_fixture_failpoint();

create trigger pf5_fixture_fail_confirmation
before insert on public.product_fact_confirmations
for each row execute function public.pf5_fixture_failpoint();

create trigger pf5_fixture_fail_current
before insert or update on public.product_fact_current
for each row execute function public.pf5_fixture_failpoint();

create trigger pf5_fixture_fail_after_current
before update on public.product_fact_review_assignments
for each row execute function public.pf5_fixture_failpoint();

create trigger pf5_fixture_fail_review_event
before insert on public.product_fact_review_events
for each row execute function public.pf5_fixture_failpoint();

create or replace function public.pf5_fixture_expect_atomic_rollback(
  p_label text,
  p_policy text
)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_scenario jsonb;
  v_payload jsonb;
  v_preflight jsonb;
  v_prop text;
  v_assignment_id uuid;
  v_request_id text;
  v_error_seen boolean := false;
begin
  v_scenario := public.pf5_fixture_prepare_scenario(p_label, p_policy);
  v_payload := v_scenario -> 'payload';
  v_preflight := v_scenario -> 'preflight';
  v_prop := v_scenario ->> 'proposition_key';
  v_assignment_id := (v_scenario ->> 'assignment_id')::uuid;
  v_request_id := 'pf5-confirm-' || p_label;

  begin
    perform public.admin_confirm_product_fact_v1(
      '81000000-0000-4000-8000-000000000001',
      v_request_id,
      v_payload,
      v_preflight ->> 'payload_digest',
      v_preflight ->> 'prestate_digest'
    );
  exception when others then
    if sqlerrm like 'pf5_fixture_failpoint:%' then
      v_error_seen := true;
    else
      raise;
    end if;
  end;

  perform public.pf5_fixture_assert(v_error_seen, 'rollback_failpoint_seen:' || p_policy);
  perform public.pf5_fixture_assert(
    not exists (select 1 from public.product_fact_instances where proposition_key = v_prop),
    'rollback_fact_residue:' || p_policy
  );
  perform public.pf5_fixture_assert(
    not exists (select 1 from public.product_fact_evidence_links where proposition_key = v_prop),
    'rollback_link_residue:' || p_policy
  );
  perform public.pf5_fixture_assert(
    not exists (
      select 1 from public.product_fact_confirmations
      where namespace = 'product_fact_confirmation_v1' and request_id = v_request_id
    ),
    'rollback_confirmation_residue:' || p_policy
  );
  perform public.pf5_fixture_assert(
    not exists (select 1 from public.product_fact_current where proposition_key = v_prop),
    'rollback_current_drift:' || p_policy
  );
  perform public.pf5_fixture_assert(
    (select operational_state from public.product_fact_review_assignments where assignment_id = v_assignment_id)
      = 'ready_for_confirm',
    'rollback_assignment_transition:' || p_policy
  );
  perform public.pf5_fixture_assert(
    not exists (
      select 1 from public.product_fact_review_events
      where assignment_id = v_assignment_id and event_kind = 'fact_confirmed'
    ),
    'rollback_review_event_residue:' || p_policy
  );
end;
$$;

select public.pf5_fixture_expect_atomic_rollback('rollback-fact', 'fixture-fail-fact');
select public.pf5_fixture_expect_atomic_rollback('rollback-link', 'fixture-fail-link');
select public.pf5_fixture_expect_atomic_rollback('rollback-confirmation', 'fixture-fail-confirmation');
select public.pf5_fixture_expect_atomic_rollback('rollback-current', 'fixture-fail-current');
select public.pf5_fixture_expect_atomic_rollback('rollback-after-current', 'fixture-fail-after-current');
select public.pf5_fixture_expect_atomic_rollback('rollback-review-event', 'fixture-fail-review-event');

drop trigger pf5_fixture_fail_fact on public.product_fact_instances;
drop trigger pf5_fixture_fail_link on public.product_fact_evidence_links;
drop trigger pf5_fixture_fail_confirmation on public.product_fact_confirmations;
drop trigger pf5_fixture_fail_current on public.product_fact_current;
drop trigger pf5_fixture_fail_after_current on public.product_fact_review_assignments;
drop trigger pf5_fixture_fail_review_event on public.product_fact_review_events;

-- Registry authority change after dry-run must force a new dry-run.
do $$
declare
  v_scenario jsonb;
  v_payload jsonb;
  v_preflight jsonb;
begin
  v_scenario := public.pf5_fixture_prepare_scenario('stale-registry');
  v_payload := v_scenario -> 'payload';
  v_preflight := v_scenario -> 'preflight';

  perform public.admin_publish_product_fact_registry_v1(
    '81000000-0000-4000-8000-000000000001',
    'pf5-registry-publish-v2',
    public.pf5_fixture_registry_payload('fixture-registry-v2')
  );

  begin
    perform public.admin_confirm_product_fact_v1(
      '81000000-0000-4000-8000-000000000001',
      'pf5-confirm-stale-registry',
      v_payload,
      v_preflight ->> 'payload_digest',
      v_preflight ->> 'prestate_digest'
    );
    raise exception 'pf5_fixture_expected_failure:stale_registry';
  exception
    when serialization_failure then null;
  end;
end $$;

-- Final append-only and security sanity checks.
do $$
begin
  perform public.pf5_fixture_assert(
    not has_table_privilege('anon', 'public.product_fact_review_events', 'UPDATE,DELETE')
    and not has_table_privilege('authenticated', 'public.product_fact_review_events', 'UPDATE,DELETE')
    and not has_table_privilege('service_role', 'public.product_fact_review_events', 'UPDATE,DELETE'),
    'review_event_append_only_grants'
  );
  perform public.pf5_fixture_assert(
    not has_function_privilege(
      'service_role',
      'public.product_fact_controlled_build_preflight_v1(uuid,text,jsonb)',
      'EXECUTE'
    ),
    'internal_preflight_not_exposed'
  );
end $$;

commit;
