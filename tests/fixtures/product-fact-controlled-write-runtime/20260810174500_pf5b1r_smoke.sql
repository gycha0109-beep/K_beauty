-- PF-5B1R disposable runtime smoke. TEST/LOCAL ONLY.
begin;

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, is_sso_user, is_anonymous
) values (
  '90000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'pf5b1r-admin@example.test',
  '{}'::jsonb, '{}'::jsonb, now(), now(), false, false
);

insert into public.admin_memberships (
  user_id, role, is_active, granted_by
) values (
  '90000000-0000-4000-8000-000000000001',
  'admin_owner', true, null
);

do $$
declare
  v_actor constant uuid := '90000000-0000-4000-8000-000000000001';
  v_product constant uuid := '00000000-0000-4000-8000-000000000301';
  v_registry constant text := 'pf5b1r-smoke-registry-v1';
  v_serializer constant text := 'product-fact-proposition-identity-v2';
  v_bool_definition jsonb;
  v_enum_definition jsonb;
  v_bool_checksum text;
  v_enum_checksum text;
  v_definitions jsonb;
  v_registry_checksum text;
  v_payload jsonb;
  v_result jsonb;
  v_subject_payload jsonb;
  v_subject_result jsonb;
begin
  if not exists (select 1 from public.products where id = v_product) then
    raise exception 'pf5b1r_smoke_product_missing';
  end if;

  v_bool_definition := jsonb_build_object(
    'fact_key', 'pf5b1r_boolean',
    'value_type', 'boolean',
    'registry_version', v_registry,
    'permitted_evidence_classes', jsonb_build_array('product_claim', 'measurement', 'observation')
  );
  v_enum_definition := jsonb_build_object(
    'fact_key', 'pf5b1r_enum',
    'value_type', 'enum',
    'registry_version', v_registry,
    'allowed_values', jsonb_build_array('alpha', 'beta'),
    'permitted_evidence_classes', jsonb_build_array('product_claim', 'measurement', 'observation')
  );
  v_bool_checksum := public.product_fact_controlled_sha256_json_v1(v_bool_definition);
  v_enum_checksum := public.product_fact_controlled_sha256_json_v1(v_enum_definition);
  v_definitions := jsonb_build_array(
    jsonb_build_object(
      'fact_key', 'pf5b1r_boolean',
      'value_type', 'boolean',
      'definition', v_bool_definition,
      'definition_checksum', v_bool_checksum,
      'deprecated', false,
      'superseded_by_fact_key', null
    ),
    jsonb_build_object(
      'fact_key', 'pf5b1r_enum',
      'value_type', 'enum',
      'definition', v_enum_definition,
      'definition_checksum', v_enum_checksum,
      'deprecated', false,
      'superseded_by_fact_key', null
    )
  );
  v_registry_checksum := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object(
      'registry_version', v_registry,
      'identity_serializer_version', v_serializer,
      'definitions', jsonb_build_array(
        jsonb_build_object(
          'fact_key', 'pf5b1r_boolean',
          'value_type', 'boolean',
          'definition_checksum', v_bool_checksum,
          'deprecated', false,
          'superseded_by_fact_key', null
        ),
        jsonb_build_object(
          'fact_key', 'pf5b1r_enum',
          'value_type', 'enum',
          'definition_checksum', v_enum_checksum,
          'deprecated', false,
          'superseded_by_fact_key', null
        )
      )
    )
  );
  v_payload := jsonb_build_object(
    'registry_version', v_registry,
    'registry_checksum', v_registry_checksum,
    'identity_serializer_version', v_serializer,
    'effective_at', null,
    'definitions', v_definitions
  );

  v_result := public.admin_publish_product_fact_registry_v1(
    v_actor, 'pf5b1r-registry-smoke-001', v_payload
  );
  if v_result ->> 'status' <> 'published'
    or (v_result ->> 'definition_count')::int <> 2
  then
    raise exception 'pf5b1r_registry_smoke_failed:%', v_result;
  end if;

  v_subject_payload := jsonb_build_object(
    'product_id', v_product,
    'subject_semantic_key', public.product_fact_controlled_sha256_json_v1(jsonb_build_object('subject', 'pf5b1r-smoke-1')),
    'subject_identity_serializer_version', 'product-fact-subject-identity-v1',
    'variant_key', null,
    'formulation_revision_key', 'pf5b1r-formulation-v1',
    'formulation_label', 'PF5B1R smoke formulation',
    'identity_status', 'resolved',
    'identity_resolution_version', 'pf5b1r-identity-v1',
    'current_state', 'current',
    'market_applicability', 'KR',
    'region_applicability', null,
    'valid_from', null,
    'valid_to', null,
    'predecessor_subject_id', null,
    'supersession_kind', null
  );
  v_subject_result := public.admin_register_product_fact_subject_v1(
    v_actor, 'pf5b1r-subject-smoke-001', v_subject_payload
  );
  if v_subject_result ->> 'status' <> 'registered'
    or v_subject_result ->> 'current_state' <> 'current'
  then
    raise exception 'pf5b1r_subject_smoke_failed:%', v_subject_result;
  end if;
end $$;

commit;
