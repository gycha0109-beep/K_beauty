\set ON_ERROR_STOP on

create temporary table pf5b1r2_results (
  test_name text primary key,
  status text not null,
  detail jsonb not null default '{}'::jsonb
) on commit preserve rows;

create or replace function pg_temp.assert_true(p_condition boolean, p_code text)
returns void
language plpgsql
as $$
begin
  if coalesce(p_condition, false) is not true then
    raise exception '%', p_code;
  end if;
end;
$$;

create or replace function pg_temp.full_fingerprint()
returns text
language sql
stable
as $$
  select public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object(
      'registry', coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from public.product_fact_registry_versions t), '[]'::jsonb),
      'definitions', coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from public.product_fact_definition_snapshots t), '[]'::jsonb),
      'subjects', coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from public.product_fact_subjects t), '[]'::jsonb),
      'sources', coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from public.product_evidence_sources t), '[]'::jsonb),
      'bindings', coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from public.product_evidence_source_subject_bindings t), '[]'::jsonb),
      'evidence', coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from public.product_evidence_records t), '[]'::jsonb),
      'facts', coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from public.product_fact_instances t), '[]'::jsonb),
      'links', coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from public.product_fact_evidence_links t), '[]'::jsonb),
      'confirmations', coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from public.product_fact_confirmations t), '[]'::jsonb),
      'current', coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from public.product_fact_current t), '[]'::jsonb),
      'assignments', coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from public.product_fact_review_assignments t), '[]'::jsonb),
      'review_events', coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from public.product_fact_review_events t), '[]'::jsonb),
      'audit', coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from public.admin_audit_logs t), '[]'::jsonb)
    )
  );
$$;

create or replace function pg_temp.legacy_fingerprint()
returns text
language sql
stable
as $$
  select public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object(
      'products', coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from public.products t where id in ('00000000-0000-4000-8000-000000000301'::uuid, '00000000-0000-4000-8000-000000000305'::uuid)), '[]'::jsonb),
      'source_rankings', coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from public.source_rankings t), '[]'::jsonb),
      'recommendation_logs', coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from public.recommendation_logs t), '[]'::jsonb)
    )
  );
$$;

create or replace function pg_temp.ingest_evidence(
  p_actor uuid,
  p_request text,
  p_product uuid,
  p_subject uuid,
  p_registry text,
  p_fact text,
  p_prop text,
  p_tag text,
  p_support text,
  p_negative text,
  p_authority text,
  p_source_kind text default 'official_product_page',
  p_supersedes uuid default null,
  p_market text default 'KR'
)
returns jsonb
language plpgsql
as $$
declare
  v_payload jsonb;
begin
  v_payload := jsonb_build_object(
    'source', jsonb_build_object(
      'canonical_locator', 'https://example.test/' || p_tag,
      'publisher', 'PF5B1R2 Test Publisher',
      'source_kind', p_source_kind,
      'source_metadata', '{}'::jsonb,
      'content_digest', public.product_fact_controlled_sha256_json_v1(jsonb_build_object('source', p_tag)),
      'external_snapshot_reference', null,
      'market', p_market,
      'region', null,
      'locale', 'en',
      'published_at', '2026-08-10T00:00:00Z',
      'accessed_at', '2026-08-11T00:00:00Z',
      'observed_at', '2026-08-11T00:00:00Z'
    ),
    'binding', jsonb_build_object(
      'product_id', p_product,
      'subject_id', p_subject,
      'binding_state', 'exact_subject_match',
      'scope_relation', 'equivalent',
      'presentation_metadata', '{}'::jsonb,
      'identity_resolution_version', 'pf5b1r2-binding-v1',
      'reviewed_at', '2026-08-11T00:00:00Z'
    ),
    'evidence', jsonb_build_object(
      'registry_version', p_registry,
      'fact_key', p_fact,
      'proposition_key', p_prop,
      'proposition_serializer_version', 'product-fact-proposition-identity-v2',
      'proposition_value_identity', jsonb_build_object('fixture', p_prop),
      'parent_proposition_key', null,
      'evidence_class', 'product_claim',
      'evidence_authority', p_authority,
      'confidence', 'high',
      'support_direction', p_support,
      'negative_admissibility', p_negative,
      'market', p_market,
      'region', null,
      'locale', 'en',
      'valid_from', null,
      'valid_to', null,
      'qualifier', '{}'::jsonb,
      'canonical_evidence_digest', public.product_fact_controlled_sha256_json_v1(jsonb_build_object('evidence', p_tag, 'prop', p_prop, 'support', p_support, 'negative', p_negative, 'supersedes', p_supersedes)),
      'supersedes_evidence_id', p_supersedes
    )
  );
  return public.admin_ingest_product_fact_evidence_v1(p_actor, p_request, v_payload);
end;
$$;

create or replace function pg_temp.prepare_review(
  p_actor uuid,
  p_request text,
  p_product uuid,
  p_subject uuid,
  p_registry text,
  p_fact text,
  p_prop text,
  p_state text,
  p_assignee uuid default null
)
returns jsonb
language sql
as $$
  select public.admin_prepare_product_fact_review_v1(
    p_actor,
    p_request,
    jsonb_build_object(
      'product_id', p_product,
      'subject_id', p_subject,
      'registry_version', p_registry,
      'fact_key', p_fact,
      'proposition_key', p_prop,
      'operational_state', p_state,
      'assigned_to', p_assignee,
      'review_policy_version', 'pf5b1r2-review-v1',
      'reason_code', 'pf5b1r2_runtime'
    )
  );
$$;

create or replace function pg_temp.fusion_digest(
  p_registry text,
  p_subject uuid,
  p_fact text,
  p_prop text,
  p_policy text,
  p_support uuid[],
  p_oppose uuid[]
)
returns text
language sql
stable
as $$
  select public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object(
      'registry_version', p_registry,
      'subject_id', p_subject,
      'fact_key', p_fact,
      'proposition_key', p_prop,
      'fusion_policy_version', p_policy,
      'evidence', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'evidence_id', evidence.evidence_id,
            'role', case when evidence.evidence_id = any(p_support) then 'supporting' else 'opposing' end,
            'canonical_evidence_digest', evidence.canonical_evidence_digest,
            'evidence_authority', evidence.evidence_authority,
            'confidence', evidence.confidence,
            'support_direction', evidence.support_direction,
            'negative_admissibility', evidence.negative_admissibility
          ) order by evidence.evidence_id
        )
        from public.product_evidence_records evidence
        where evidence.evidence_id = any(p_support || p_oppose)
      ), '[]'::jsonb)
    )
  );
$$;

create or replace function pg_temp.boolean_confirmation_payload(
  p_assignment uuid,
  p_subject uuid,
  p_registry text,
  p_fact text,
  p_prop text,
  p_status text,
  p_value boolean,
  p_authority text,
  p_support uuid[],
  p_oppose uuid[]
)
returns jsonb
language plpgsql
stable
as $$
declare
  v_policy constant text := 'pf5b1r2-fusion-v1';
  v_value_type jsonb := 'null'::jsonb;
  v_value_boolean jsonb := 'null'::jsonb;
begin
  if p_status = 'supported' then
    v_value_type := to_jsonb('boolean'::text);
    v_value_boolean := to_jsonb(p_value);
  end if;
  return jsonb_build_object(
    'assignment_id', p_assignment,
    'subject_id', p_subject,
    'registry_version', p_registry,
    'fact_key', p_fact,
    'proposition_key', p_prop,
    'proposition_serializer_version', 'product-fact-proposition-identity-v2',
    'semantic_status', p_status,
    'value_type', v_value_type,
    'value_boolean', v_value_boolean,
    'value_enum', null,
    'value_number', null,
    'value_unit', null,
    'value_range_min', null,
    'value_range_max', null,
    'value_entity_identifier', null,
    'market', 'KR',
    'region', null,
    'locale', 'en',
    'valid_from', null,
    'valid_to', null,
    'qualifier', '{}'::jsonb,
    'parent_fact_instance_id', null,
    'parent_proposition_key', null,
    'authority_ceiling', p_authority,
    'fused_confidence', 'high',
    'fusion_policy_version', v_policy,
    'fusion_input_digest', pg_temp.fusion_digest(p_registry, p_subject, p_fact, p_prop, v_policy, p_support, p_oppose),
    'supporting_evidence_ids', to_jsonb(p_support),
    'opposing_evidence_ids', to_jsonb(p_oppose)
  );
end;
$$;

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, is_sso_user, is_anonymous
) values (
  '91000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'pf5b1r2-admin@example.test',
  '{}'::jsonb, '{}'::jsonb, now(), now(), false, false
);

insert into public.admin_memberships (user_id, role, is_active, granted_by)
values ('91000000-0000-4000-8000-000000000001', 'admin_owner', true, null);

create temporary table pf5b1r2_context (
  key text primary key,
  value jsonb not null
) on commit preserve rows;

insert into pf5b1r2_context values ('legacy_before', to_jsonb(pg_temp.legacy_fingerprint()));

do $$
declare
  v_actor constant uuid := '91000000-0000-4000-8000-000000000001';
  v_product1 constant uuid := '00000000-0000-4000-8000-000000000301';
  v_product2 constant uuid := '00000000-0000-4000-8000-000000000305';
  v_registry constant text := 'pf5b1r2-registry-v1';
  v_bool_definition jsonb;
  v_enum_definition jsonb;
  v_bool_checksum text;
  v_enum_checksum text;
  v_definitions jsonb;
  v_registry_checksum text;
  v_registry_payload jsonb;
  v_result jsonb;
  v_bad_payload jsonb;
  v_before text;
  v_after text;
  v_state text;
  v_message text;
  v_subject1 uuid;
  v_subject2 uuid;
  v_unresolved uuid;
  v_ambiguous uuid;
  v_provisional uuid;
  v_subject_payload jsonb;
  v_prop_positive text := public.product_fact_controlled_sha256_json_v1(jsonb_build_object('prop', 'positive'));
  v_prop_false text := public.product_fact_controlled_sha256_json_v1(jsonb_build_object('prop', 'false'));
  v_prop_false_missing text := public.product_fact_controlled_sha256_json_v1(jsonb_build_object('prop', 'false-missing'));
  v_prop_non_supported text := public.product_fact_controlled_sha256_json_v1(jsonb_build_object('prop', 'non-supported'));
  v_prop_conflict text := public.product_fact_controlled_sha256_json_v1(jsonb_build_object('prop', 'conflict'));
  v_prop_review_invalid text := public.product_fact_controlled_sha256_json_v1(jsonb_build_object('prop', 'review-invalid'));
  v_prop_review_noncurrent text := public.product_fact_controlled_sha256_json_v1(jsonb_build_object('prop', 'review-noncurrent'));
  v_prop_review_unresolved text := public.product_fact_controlled_sha256_json_v1(jsonb_build_object('prop', 'review-unresolved'));
  v_support uuid;
  v_negative uuid;
  v_conflict_support uuid;
  v_conflict_oppose uuid;
  v_assignment uuid;
  v_assignment_false uuid;
  v_assignment_false_missing uuid;
  v_assignment_non_supported uuid;
  v_assignment_conflict uuid;
  v_payload jsonb;
  v_preflight jsonb;
  v_confirm jsonb;
  v_counts_before jsonb;
  v_counts_after jsonb;
  v_fact_id uuid;
  v_confirmation_id uuid;
  v_review_events_before bigint;
  v_audit_before bigint;
begin
  perform pg_temp.assert_true((select count(*) from public.products where id in (v_product1, v_product2)) = 2, 'pf5b1r2_products_missing');

  v_bool_definition := jsonb_build_object(
    'fact_key', 'pf5b1r2_boolean',
    'value_type', 'boolean',
    'registry_version', v_registry,
    'permitted_evidence_classes', jsonb_build_array('product_claim', 'measurement', 'observation')
  );
  v_enum_definition := jsonb_build_object(
    'fact_key', 'pf5b1r2_enum',
    'value_type', 'enum',
    'registry_version', v_registry,
    'allowed_values', jsonb_build_array('alpha', 'beta'),
    'permitted_evidence_classes', jsonb_build_array('product_claim', 'measurement', 'observation')
  );
  v_bool_checksum := public.product_fact_controlled_sha256_json_v1(v_bool_definition);
  v_enum_checksum := public.product_fact_controlled_sha256_json_v1(v_enum_definition);
  v_definitions := jsonb_build_array(
    jsonb_build_object('fact_key','pf5b1r2_boolean','value_type','boolean','definition',v_bool_definition,'definition_checksum',v_bool_checksum,'deprecated',false,'superseded_by_fact_key',null),
    jsonb_build_object('fact_key','pf5b1r2_enum','value_type','enum','definition',v_enum_definition,'definition_checksum',v_enum_checksum,'deprecated',false,'superseded_by_fact_key',null)
  );
  v_registry_checksum := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object(
      'registry_version', v_registry,
      'identity_serializer_version', 'product-fact-proposition-identity-v2',
      'definitions', jsonb_build_array(
        jsonb_build_object('fact_key','pf5b1r2_boolean','value_type','boolean','definition_checksum',v_bool_checksum,'deprecated',false,'superseded_by_fact_key',null),
        jsonb_build_object('fact_key','pf5b1r2_enum','value_type','enum','definition_checksum',v_enum_checksum,'deprecated',false,'superseded_by_fact_key',null)
      )
    )
  );
  v_registry_payload := jsonb_build_object(
    'registry_version', v_registry,
    'registry_checksum', v_registry_checksum,
    'identity_serializer_version', 'product-fact-proposition-identity-v2',
    'effective_at', null,
    'definitions', v_definitions
  );

  v_result := public.admin_publish_product_fact_registry_v1(v_actor, 'pf5b1r2-registry-0001', v_registry_payload);
  perform pg_temp.assert_true(v_result->>'status'='published' and (v_result->>'idempotent')::boolean=false, 'registry_first_publish_failed');
  perform pg_temp.assert_true((select count(*) from public.product_fact_registry_versions)=1, 'registry_first_count');
  perform pg_temp.assert_true((select count(*) from public.product_fact_definition_snapshots)=2, 'definition_first_count');
  insert into pf5b1r2_results values ('registry_A_first_publish','PASS',jsonb_build_object('registry_rows',1,'definition_rows',2));

  v_before := pg_temp.full_fingerprint();
  v_result := public.admin_publish_product_fact_registry_v1(v_actor, 'pf5b1r2-registry-0002', v_registry_payload);
  v_after := pg_temp.full_fingerprint();
  perform pg_temp.assert_true((v_result->>'idempotent')::boolean, 'registry_idempotent_flag');
  perform pg_temp.assert_true(v_before=v_after, 'registry_idempotent_mutation');
  insert into pf5b1r2_results values ('registry_B_exact_retry','PASS',jsonb_build_object('fingerprint',v_after));

  v_bad_payload := jsonb_set(v_registry_payload, '{definitions,1,definition,allowed_values}', '["alpha","gamma"]'::jsonb);
  v_bad_payload := jsonb_set(v_bad_payload, '{definitions,1,definition_checksum}', to_jsonb(public.product_fact_controlled_sha256_json_v1(v_bad_payload#>'{definitions,1,definition}')));
  v_bad_payload := jsonb_set(v_bad_payload, '{registry_checksum}', to_jsonb(public.product_fact_controlled_sha256_json_v1(jsonb_build_object(
    'registry_version', v_registry,
    'identity_serializer_version', 'product-fact-proposition-identity-v2',
    'definitions', jsonb_build_array(
      jsonb_build_object('fact_key','pf5b1r2_boolean','value_type','boolean','definition_checksum',v_bool_checksum,'deprecated',false,'superseded_by_fact_key',null),
      jsonb_build_object('fact_key','pf5b1r2_enum','value_type','enum','definition_checksum',v_bad_payload#>>'{definitions,1,definition_checksum}','deprecated',false,'superseded_by_fact_key',null)
    )
  ))));
  v_before := pg_temp.full_fingerprint();
  begin
    perform public.admin_publish_product_fact_registry_v1(v_actor, 'pf5b1r2-registry-0003', v_bad_payload);
    raise exception 'registry_conflict_not_rejected';
  exception when others then
    get stacked diagnostics v_state=returned_sqlstate, v_message=message_text;
    if v_message='registry_conflict_not_rejected' then raise; end if;
    perform pg_temp.assert_true(v_state='23505' and v_message='product_fact_registry_version_conflict','registry_conflict_wrong_error');
  end;
  perform pg_temp.assert_true(v_before=pg_temp.full_fingerprint(),'registry_conflict_mutation');
  insert into pf5b1r2_results values ('registry_C_version_conflict','PASS',jsonb_build_object('sqlstate',v_state,'message',v_message));

  v_bad_payload := jsonb_set(v_registry_payload, '{registry_version}', '"pf5b1r2-bad-definition-v1"'::jsonb);
  v_bad_payload := jsonb_set(v_bad_payload, '{definitions,0,definition,registry_version}', '"pf5b1r2-bad-definition-v1"'::jsonb);
  v_bad_payload := jsonb_set(v_bad_payload, '{definitions,1,definition,registry_version}', '"pf5b1r2-bad-definition-v1"'::jsonb);
  v_bad_payload := jsonb_set(v_bad_payload, '{definitions,0,definition_checksum}', to_jsonb(repeat('0',64)));
  v_bad_payload := jsonb_set(v_bad_payload, '{registry_checksum}', to_jsonb(repeat('0',64)));
  v_before := pg_temp.full_fingerprint();
  begin
    perform public.admin_publish_product_fact_registry_v1(v_actor,'pf5b1r2-registry-0004',v_bad_payload);
    raise exception 'registry_definition_checksum_not_rejected';
  exception when others then
    get stacked diagnostics v_state=returned_sqlstate, v_message=message_text;
    if v_message='registry_definition_checksum_not_rejected' then raise; end if;
    perform pg_temp.assert_true(v_state='23514' and v_message='product_fact_registry_definition_checksum_mismatch','registry_definition_checksum_wrong_error');
  end;
  perform pg_temp.assert_true(v_before=pg_temp.full_fingerprint(),'registry_definition_checksum_mutation');
  insert into pf5b1r2_results values ('registry_D_definition_checksum','PASS',jsonb_build_object('sqlstate',v_state,'message',v_message));

  v_subject_payload := jsonb_build_object(
    'product_id',v_product1,
    'subject_semantic_key',public.product_fact_controlled_sha256_json_v1(jsonb_build_object('subject','main')),
    'subject_identity_serializer_version','product-fact-subject-identity-v1',
    'variant_key',null,
    'formulation_revision_key','pf5b1r2-formulation-main',
    'formulation_label','PF5B1R2 main',
    'identity_status','resolved',
    'identity_resolution_version','pf5b1r2-identity-v1',
    'current_state','current',
    'market_applicability','KR',
    'region_applicability',null,
    'valid_from',null,
    'valid_to',null,
    'predecessor_subject_id',null,
    'supersession_kind',null
  );
  v_result := public.admin_register_product_fact_subject_v1(v_actor,'pf5b1r2-subject-0001',v_subject_payload);
  v_subject1 := (v_result->>'subject_id')::uuid;
  perform pg_temp.assert_true((v_result->>'idempotent')::boolean=false,'subject_first_idempotent');
  insert into pf5b1r2_results values ('subject_A_register','PASS',jsonb_build_object('subject_id',v_subject1));

  v_before := pg_temp.full_fingerprint();
  v_result := public.admin_register_product_fact_subject_v1(v_actor,'pf5b1r2-subject-0002',v_subject_payload);
  perform pg_temp.assert_true((v_result->>'idempotent')::boolean and (v_result->>'subject_id')::uuid=v_subject1,'subject_retry_result');
  perform pg_temp.assert_true(v_before=pg_temp.full_fingerprint(),'subject_retry_mutation');
  insert into pf5b1r2_results values ('subject_B_exact_retry','PASS',jsonb_build_object('subject_id',v_subject1));

  v_bad_payload := jsonb_set(v_subject_payload,'{formulation_label}','"PF5B1R2 conflicting label"'::jsonb);
  v_before := pg_temp.full_fingerprint();
  begin
    perform public.admin_register_product_fact_subject_v1(v_actor,'pf5b1r2-subject-0003',v_bad_payload);
    raise exception 'subject_semantic_conflict_not_rejected';
  exception when others then
    get stacked diagnostics v_state=returned_sqlstate, v_message=message_text;
    if v_message='subject_semantic_conflict_not_rejected' then raise; end if;
    perform pg_temp.assert_true(v_state='23505' and v_message='product_fact_subject_semantic_key_conflict','subject_semantic_conflict_wrong_error');
  end;
  perform pg_temp.assert_true(v_before=pg_temp.full_fingerprint(),'subject_semantic_conflict_mutation');
  insert into pf5b1r2_results values ('subject_C_semantic_conflict','PASS',jsonb_build_object('sqlstate',v_state,'message',v_message));

  foreach v_message in array array['ambiguous','unresolved'] loop
    v_bad_payload := jsonb_set(v_subject_payload,'{subject_semantic_key}',to_jsonb(public.product_fact_controlled_sha256_json_v1(jsonb_build_object('subject','bad-current-'||v_message))));
    v_bad_payload := jsonb_set(v_bad_payload,'{identity_status}',to_jsonb(v_message));
    v_before := pg_temp.full_fingerprint();
    begin
      perform public.admin_register_product_fact_subject_v1(v_actor,'pf5b1r2-subject-current-'||v_message,v_bad_payload);
      raise exception 'subject_current_identity_not_rejected';
    exception when others then
      get stacked diagnostics v_state=returned_sqlstate, v_message=message_text;
      if v_message='subject_current_identity_not_rejected' then raise; end if;
      perform pg_temp.assert_true(v_state='23514' and v_message='product_fact_subject_payload_invalid','subject_current_identity_wrong_error');
    end;
    perform pg_temp.assert_true(v_before=pg_temp.full_fingerprint(),'subject_current_identity_mutation');
  end loop;
  insert into pf5b1r2_results values ('subject_D_E_current_ambiguous_unresolved','PASS','{}');

  v_subject_payload := jsonb_build_object(
    'product_id',v_product2,
    'subject_semantic_key',public.product_fact_controlled_sha256_json_v1(jsonb_build_object('subject','product2')),
    'subject_identity_serializer_version','product-fact-subject-identity-v1',
    'variant_key',null,
    'formulation_revision_key','pf5b1r2-formulation-product2',
    'formulation_label','PF5B1R2 product2',
    'identity_status','resolved',
    'identity_resolution_version','pf5b1r2-identity-v1',
    'current_state','current',
    'market_applicability','KR',
    'region_applicability',null,
    'valid_from',null,
    'valid_to',null,
    'predecessor_subject_id',null,
    'supersession_kind',null
  );
  v_result := public.admin_register_product_fact_subject_v1(v_actor,'pf5b1r2-subject-0006',v_subject_payload);
  v_subject2 := (v_result->>'subject_id')::uuid;

  v_bad_payload := jsonb_set(v_subject_payload,'{subject_semantic_key}',to_jsonb(public.product_fact_controlled_sha256_json_v1(jsonb_build_object('subject','wrong-predecessor'))));
  v_bad_payload := jsonb_set(v_bad_payload,'{predecessor_subject_id}',to_jsonb(v_subject1));
  v_bad_payload := jsonb_set(v_bad_payload,'{supersession_kind}','"reformulation"'::jsonb);
  v_before := pg_temp.full_fingerprint();
  begin
    perform public.admin_register_product_fact_subject_v1(v_actor,'pf5b1r2-subject-0007',v_bad_payload);
    raise exception 'subject_cross_product_predecessor_not_rejected';
  exception when others then
    get stacked diagnostics v_state=returned_sqlstate, v_message=message_text;
    if v_message='subject_cross_product_predecessor_not_rejected' then raise; end if;
    perform pg_temp.assert_true(v_state='P0002' and v_message='product_fact_subject_predecessor_not_found','subject_cross_product_predecessor_wrong_error');
  end;
  perform pg_temp.assert_true(v_before=pg_temp.full_fingerprint(),'subject_cross_product_predecessor_mutation');
  insert into pf5b1r2_results values ('subject_F_cross_product_predecessor','PASS',jsonb_build_object('sqlstate',v_state,'message',v_message));

  v_subject_payload := jsonb_build_object(
    'product_id',v_product1,'subject_semantic_key',public.product_fact_controlled_sha256_json_v1(jsonb_build_object('subject','unresolved')),
    'subject_identity_serializer_version','product-fact-subject-identity-v1','variant_key',null,'formulation_revision_key','pf5b1r2-formulation-unresolved','formulation_label','PF5B1R2 unresolved','identity_status','unresolved','identity_resolution_version','pf5b1r2-identity-v1','current_state','provisional','market_applicability','KR','region_applicability',null,'valid_from',null,'valid_to',null,'predecessor_subject_id',null,'supersession_kind',null);
  v_unresolved := (public.admin_register_product_fact_subject_v1(v_actor,'pf5b1r2-subject-0008',v_subject_payload)->>'subject_id')::uuid;
  v_subject_payload := jsonb_set(v_subject_payload,'{subject_semantic_key}',to_jsonb(public.product_fact_controlled_sha256_json_v1(jsonb_build_object('subject','ambiguous'))));
  v_subject_payload := jsonb_set(v_subject_payload,'{formulation_revision_key}','"pf5b1r2-formulation-ambiguous"'::jsonb);
  v_subject_payload := jsonb_set(v_subject_payload,'{formulation_label}','"PF5B1R2 ambiguous"'::jsonb);
  v_subject_payload := jsonb_set(v_subject_payload,'{identity_status}','"ambiguous"'::jsonb);
  v_ambiguous := (public.admin_register_product_fact_subject_v1(v_actor,'pf5b1r2-subject-0009',v_subject_payload)->>'subject_id')::uuid;
  v_subject_payload := jsonb_set(v_subject_payload,'{subject_semantic_key}',to_jsonb(public.product_fact_controlled_sha256_json_v1(jsonb_build_object('subject','provisional-resolved'))));
  v_subject_payload := jsonb_set(v_subject_payload,'{formulation_revision_key}','"pf5b1r2-formulation-provisional"'::jsonb);
  v_subject_payload := jsonb_set(v_subject_payload,'{formulation_label}','"PF5B1R2 provisional resolved"'::jsonb);
  v_subject_payload := jsonb_set(v_subject_payload,'{identity_status}','"resolved"'::jsonb);
  v_provisional := (public.admin_register_product_fact_subject_v1(v_actor,'pf5b1r2-subject-0010',v_subject_payload)->>'subject_id')::uuid;

  v_result := pg_temp.ingest_evidence(v_actor,'pf5b1r2-evidence-0001',v_product1,v_subject1,v_registry,'pf5b1r2_boolean',v_prop_positive,'positive-support','supports','not_applicable','product_specific_primary');
  v_support := (v_result->>'evidence_id')::uuid;
  perform pg_temp.assert_true((v_result->>'source_inserted')::boolean and (v_result->>'binding_inserted')::boolean and (v_result->>'evidence_inserted')::boolean,'evidence_first_insert_flags');
  perform pg_temp.assert_true((select count(*) from public.product_fact_instances)=0 and (select count(*) from public.product_fact_confirmations)=0 and (select count(*) from public.product_fact_current)=0,'evidence_promoted_fact');
  insert into pf5b1r2_results values ('evidence_A_supporting','PASS',jsonb_build_object('evidence_id',v_support));

  v_review_events_before := (select count(*) from public.product_fact_review_events);
  v_result := pg_temp.ingest_evidence(v_actor,'pf5b1r2-evidence-0001',v_product1,v_subject1,v_registry,'pf5b1r2_boolean',v_prop_positive,'positive-support','supports','not_applicable','product_specific_primary');
  perform pg_temp.assert_true(not (v_result->>'source_inserted')::boolean and not (v_result->>'binding_inserted')::boolean and not (v_result->>'evidence_inserted')::boolean,'evidence_retry_flags');
  perform pg_temp.assert_true((select count(*) from public.product_fact_review_events)=v_review_events_before,'evidence_retry_review_event');
  insert into pf5b1r2_results values ('evidence_exact_retry','PASS',jsonb_build_object('evidence_id',v_support));

  foreach v_message in array array['unresolved','ambiguous'] loop
    v_before := pg_temp.full_fingerprint();
    begin
      perform pg_temp.ingest_evidence(v_actor,'pf5b1r2-evidence-'||v_message,v_product1,case when v_message='unresolved' then v_unresolved else v_ambiguous end,v_registry,'pf5b1r2_boolean',public.product_fact_controlled_sha256_json_v1(jsonb_build_object('prop','bad-'||v_message)),'bad-'||v_message,'supports','not_applicable','product_specific_primary');
      raise exception 'evidence_identity_not_rejected';
    exception when others then
      get stacked diagnostics v_state=returned_sqlstate, v_message=message_text;
      if v_message='evidence_identity_not_rejected' then raise; end if;
      perform pg_temp.assert_true(v_state='23514' and v_message='product_fact_evidence_resolved_subject_required','evidence_identity_wrong_error');
    end;
    perform pg_temp.assert_true(v_before=pg_temp.full_fingerprint(),'evidence_identity_mutation');
  end loop;
  insert into pf5b1r2_results values ('evidence_unresolved_ambiguous_reject','PASS','{}');

  v_before := pg_temp.full_fingerprint();
  begin
    perform pg_temp.ingest_evidence(v_actor,'pf5b1r2-evidence-market',v_product1,v_subject1,v_registry,'pf5b1r2_boolean',public.product_fact_controlled_sha256_json_v1(jsonb_build_object('prop','market')),'market-ranking','supports','not_applicable','product_specific_primary','sales_ranking');
    raise exception 'market_authority_not_rejected';
  exception when others then
    get stacked diagnostics v_state=returned_sqlstate, v_message=message_text;
    if v_message='market_authority_not_rejected' then raise; end if;
    perform pg_temp.assert_true(v_state='23514' and v_message='product_fact_market_popularity_authority_forbidden','market_authority_wrong_error');
  end;
  perform pg_temp.assert_true(v_before=pg_temp.full_fingerprint(),'market_authority_mutation');
  insert into pf5b1r2_results values ('evidence_market_popularity_reject','PASS',jsonb_build_object('sqlstate',v_state,'message',v_message));

  v_before := pg_temp.full_fingerprint();
  begin
    perform pg_temp.ingest_evidence(v_actor,'pf5b1r2-evidence-scope',v_product1,v_subject1,v_registry,'pf5b1r2_boolean',public.product_fact_controlled_sha256_json_v1(jsonb_build_object('prop','scope')),'scope-us','supports','not_applicable','product_specific_primary','official_product_page',null,'US');
    raise exception 'scope_mismatch_not_rejected';
  exception when others then
    get stacked diagnostics v_state=returned_sqlstate, v_message=message_text;
    if v_message='scope_mismatch_not_rejected' then raise; end if;
    perform pg_temp.assert_true(v_state='23514' and v_message='product_fact_evidence_scope_incompatible','scope_mismatch_wrong_error');
  end;
  perform pg_temp.assert_true(v_before=pg_temp.full_fingerprint(),'scope_mismatch_mutation');
  insert into pf5b1r2_results values ('evidence_scope_reject','PASS',jsonb_build_object('sqlstate',v_state,'message',v_message));

  v_before := pg_temp.full_fingerprint();
  begin
    perform pg_temp.ingest_evidence(v_actor,'pf5b1r2-evidence-supersede',v_product1,v_subject1,v_registry,'pf5b1r2_boolean',v_prop_false,'bad-supersede','opposes','explicit_negative','product_specific_primary','official_product_page',v_support,'KR');
    raise exception 'supersession_lineage_not_rejected';
  exception when others then
    get stacked diagnostics v_state=returned_sqlstate, v_message=message_text;
    if v_message='supersession_lineage_not_rejected' then raise; end if;
    perform pg_temp.assert_true(v_state='23514' and v_message='product_fact_evidence_supersedes_target_invalid','supersession_lineage_wrong_error');
  end;
  perform pg_temp.assert_true(v_before=pg_temp.full_fingerprint(),'supersession_lineage_mutation');
  insert into pf5b1r2_results values ('evidence_supersession_reject','PASS',jsonb_build_object('sqlstate',v_state,'message',v_message));

  v_result := pg_temp.prepare_review(v_actor,'pf5b1r2-review-0001',v_product1,v_subject1,v_registry,'pf5b1r2_boolean',v_prop_positive,'queued',v_actor);
  v_assignment := (v_result->>'assignment_id')::uuid;
  v_review_events_before := (select count(*) from public.product_fact_review_events where assignment_id=v_assignment);
  v_result := pg_temp.prepare_review(v_actor,'pf5b1r2-review-0001',v_product1,v_subject1,v_registry,'pf5b1r2_boolean',v_prop_positive,'queued',v_actor);
  perform pg_temp.assert_true((v_result->>'idempotent')::boolean,'review_retry_flag');
  perform pg_temp.assert_true((select count(*) from public.product_fact_review_events where assignment_id=v_assignment)=v_review_events_before,'review_retry_event_dup');
  perform pg_temp.prepare_review(v_actor,'pf5b1r2-review-0002',v_product1,v_subject1,v_registry,'pf5b1r2_boolean',v_prop_positive,'under_review',v_actor);
  perform pg_temp.prepare_review(v_actor,'pf5b1r2-review-0003',v_product1,v_subject1,v_registry,'pf5b1r2_boolean',v_prop_positive,'ready_for_confirm',v_actor);
  perform pg_temp.assert_true((select operational_state from public.product_fact_review_assignments where assignment_id=v_assignment)='ready_for_confirm','review_ready_state');
  insert into pf5b1r2_results values ('review_valid_transition_and_retry','PASS',jsonb_build_object('assignment_id',v_assignment));

  perform pg_temp.prepare_review(v_actor,'pf5b1r2-review-invalid-1',v_product1,v_subject1,v_registry,'pf5b1r2_boolean',v_prop_review_invalid,'queued',v_actor);
  v_before := pg_temp.full_fingerprint();
  begin
    perform pg_temp.prepare_review(v_actor,'pf5b1r2-review-invalid-2',v_product1,v_subject1,v_registry,'pf5b1r2_boolean',v_prop_review_invalid,'ready_for_confirm',v_actor);
    raise exception 'review_direct_ready_not_rejected';
  exception when others then
    get stacked diagnostics v_state=returned_sqlstate, v_message=message_text;
    if v_message='review_direct_ready_not_rejected' then raise; end if;
    perform pg_temp.assert_true(v_state='23514' and v_message='product_fact_review_prepare_transition_invalid','review_direct_ready_wrong_error');
  end;
  perform pg_temp.assert_true(v_before=pg_temp.full_fingerprint(),'review_direct_ready_mutation');

  perform pg_temp.prepare_review(v_actor,'pf5b1r2-review-noncurrent-1',v_product1,v_provisional,v_registry,'pf5b1r2_boolean',v_prop_review_noncurrent,'queued',v_actor);
  perform pg_temp.prepare_review(v_actor,'pf5b1r2-review-noncurrent-2',v_product1,v_provisional,v_registry,'pf5b1r2_boolean',v_prop_review_noncurrent,'under_review',v_actor);
  v_before := pg_temp.full_fingerprint();
  begin
    perform pg_temp.prepare_review(v_actor,'pf5b1r2-review-noncurrent-3',v_product1,v_provisional,v_registry,'pf5b1r2_boolean',v_prop_review_noncurrent,'ready_for_confirm',v_actor);
    raise exception 'review_noncurrent_not_rejected';
  exception when others then
    get stacked diagnostics v_state=returned_sqlstate, v_message=message_text;
    if v_message='review_noncurrent_not_rejected' then raise; end if;
    perform pg_temp.assert_true(v_state='23514' and v_message='product_fact_review_prepare_subject_not_current','review_noncurrent_wrong_error');
  end;
  perform pg_temp.assert_true(v_before=pg_temp.full_fingerprint(),'review_noncurrent_mutation');

  perform pg_temp.prepare_review(v_actor,'pf5b1r2-review-unresolved-1',v_product1,v_unresolved,v_registry,'pf5b1r2_boolean',v_prop_review_unresolved,'queued',v_actor);
  perform pg_temp.prepare_review(v_actor,'pf5b1r2-review-unresolved-2',v_product1,v_unresolved,v_registry,'pf5b1r2_boolean',v_prop_review_unresolved,'under_review',v_actor);
  v_before := pg_temp.full_fingerprint();
  begin
    perform pg_temp.prepare_review(v_actor,'pf5b1r2-review-unresolved-3',v_product1,v_unresolved,v_registry,'pf5b1r2_boolean',v_prop_review_unresolved,'ready_for_confirm',v_actor);
    raise exception 'review_unresolved_not_rejected';
  exception when others then
    get stacked diagnostics v_state=returned_sqlstate, v_message=message_text;
    if v_message='review_unresolved_not_rejected' then raise; end if;
    perform pg_temp.assert_true(v_state='23514' and v_message='product_fact_review_prepare_subject_not_current','review_unresolved_wrong_error');
  end;
  perform pg_temp.assert_true(v_before=pg_temp.full_fingerprint(),'review_unresolved_mutation');

  v_before := pg_temp.full_fingerprint();
  begin
    perform pg_temp.prepare_review(v_actor,'pf5b1r2-review-assignee',v_product1,v_subject1,v_registry,'pf5b1r2_boolean',public.product_fact_controlled_sha256_json_v1(jsonb_build_object('prop','bad-assignee')),'queued','99999999-9999-4999-8999-999999999999'::uuid);
    raise exception 'review_invalid_assignee_not_rejected';
  exception when others then
    get stacked diagnostics v_state=returned_sqlstate, v_message=message_text;
    if v_message='review_invalid_assignee_not_rejected' then raise; end if;
    perform pg_temp.assert_true(v_state='42501' and v_message='product_fact_review_prepare_assignee_invalid','review_invalid_assignee_wrong_error');
  end;
  perform pg_temp.assert_true(v_before=pg_temp.full_fingerprint(),'review_invalid_assignee_mutation');
  insert into pf5b1r2_results values ('review_invalid_matrix','PASS','{}');

  v_payload := pg_temp.boolean_confirmation_payload(v_assignment,v_subject1,v_registry,'pf5b1r2_boolean',v_prop_positive,'supported',true,'product_specific_primary',array[v_support],array[]::uuid[]);
  v_counts_before := jsonb_build_object(
    'facts',(select count(*) from public.product_fact_instances),
    'links',(select count(*) from public.product_fact_evidence_links),
    'confirmations',(select count(*) from public.product_fact_confirmations),
    'current',(select count(*) from public.product_fact_current),
    'review_events',(select count(*) from public.product_fact_review_events),
    'assignments',(select count(*) from public.product_fact_review_assignments),
    'audit',(select count(*) from public.admin_audit_logs)
  );
  v_before := pg_temp.full_fingerprint();
  v_preflight := public.admin_preflight_product_fact_confirmation_v1(v_actor,'pf5b1r2-confirm-positive',v_payload);
  v_after := pg_temp.full_fingerprint();
  v_counts_after := jsonb_build_object(
    'facts',(select count(*) from public.product_fact_instances),
    'links',(select count(*) from public.product_fact_evidence_links),
    'confirmations',(select count(*) from public.product_fact_confirmations),
    'current',(select count(*) from public.product_fact_current),
    'review_events',(select count(*) from public.product_fact_review_events),
    'assignments',(select count(*) from public.product_fact_review_assignments),
    'audit',(select count(*) from public.admin_audit_logs)
  );
  perform pg_temp.assert_true(v_before=v_after and v_counts_before=v_counts_after,'dry_run_mutated_state');
  perform pg_temp.assert_true(v_preflight->>'status'='ready' and v_preflight ? 'request_id' and v_preflight ? 'payload_digest' and v_preflight ? 'prestate_digest' and v_preflight ? 'fusion_input_digest' and v_preflight ? 'previous_current' and v_preflight ? 'expected_write_set' and v_preflight ? 'proposed_semantic_status' and v_preflight ? 'proposed_value' and v_preflight ? 'authority_ceiling' and v_preflight ? 'fused_confidence','dry_run_shape');
  insert into pf5b1r2_results values ('dry_run_zero_write','PASS',jsonb_build_object('before',v_counts_before,'after',v_counts_after,'payload_digest',v_preflight->>'payload_digest','prestate_digest',v_preflight->>'prestate_digest'));

  v_review_events_before := (select count(*) from public.product_fact_review_events);
  v_audit_before := (select count(*) from public.admin_audit_logs);
  v_confirm := public.admin_confirm_product_fact_v1(v_actor,'pf5b1r2-confirm-positive',v_payload,v_preflight->>'payload_digest',v_preflight->>'prestate_digest');
  v_fact_id := (v_confirm->>'fact_instance_id')::uuid;
  v_confirmation_id := (v_confirm->>'confirmation_id')::uuid;
  perform pg_temp.assert_true((select count(*) from public.product_fact_instances where fact_instance_id=v_fact_id)=1,'confirm_fact_missing');
  perform pg_temp.assert_true((select count(*) from public.product_fact_evidence_links where fact_instance_id=v_fact_id)=1,'confirm_links_wrong');
  perform pg_temp.assert_true((select count(*) from public.product_fact_confirmations where confirmation_id=v_confirmation_id)=1,'confirm_confirmation_missing');
  perform pg_temp.assert_true((select fact_instance_id from public.product_fact_current where proposition_key=v_prop_positive)=v_fact_id,'confirm_current_fact_wrong');
  perform pg_temp.assert_true((select confirmation_id from public.product_fact_current where proposition_key=v_prop_positive)=v_confirmation_id,'confirm_current_confirmation_wrong');
  perform pg_temp.assert_true((select operational_state from public.product_fact_review_assignments where assignment_id=v_assignment)='confirmed','confirm_assignment_not_confirmed');
  perform pg_temp.assert_true((select count(*) from public.product_fact_review_events where assignment_id=v_assignment and event_kind='fact_confirmed')=1,'confirm_review_event_missing');
  perform pg_temp.assert_true((select count(*) from public.product_fact_review_events)=v_review_events_before+1,'confirm_review_event_count');
  perform pg_temp.assert_true((select count(*) from public.admin_audit_logs)=v_audit_before+1,'confirm_audit_count');
  insert into pf5b1r2_results values ('normal_confirm','PASS',jsonb_build_object('fact_instance_id',v_fact_id,'confirmation_id',v_confirmation_id));

  v_counts_before := jsonb_build_object('facts',(select count(*) from public.product_fact_instances),'links',(select count(*) from public.product_fact_evidence_links),'confirmations',(select count(*) from public.product_fact_confirmations),'current',(select count(*) from public.product_fact_current),'review_events',(select count(*) from public.product_fact_review_events),'audit',(select count(*) from public.admin_audit_logs));
  v_result := public.admin_confirm_product_fact_v1(v_actor,'pf5b1r2-confirm-positive',v_payload,v_preflight->>'payload_digest',v_preflight->>'prestate_digest');
  v_counts_after := jsonb_build_object('facts',(select count(*) from public.product_fact_instances),'links',(select count(*) from public.product_fact_evidence_links),'confirmations',(select count(*) from public.product_fact_confirmations),'current',(select count(*) from public.product_fact_current),'review_events',(select count(*) from public.product_fact_review_events),'audit',(select count(*) from public.admin_audit_logs));
  perform pg_temp.assert_true((v_result->>'idempotent')::boolean and v_counts_before=v_counts_after,'confirm_exact_retry_mutated');
  insert into pf5b1r2_results values ('confirm_exact_retry_idempotency','PASS',jsonb_build_object('counts',v_counts_after));

  v_before := pg_temp.full_fingerprint();
  begin
    v_bad_payload := jsonb_set(v_payload,'{fused_confidence}','"medium"'::jsonb);
    perform public.admin_confirm_product_fact_v1(v_actor,'pf5b1r2-confirm-positive',v_bad_payload,public.product_fact_controlled_sha256_json_v1(v_bad_payload),v_preflight->>'prestate_digest');
    raise exception 'request_payload_conflict_not_rejected';
  exception when others then
    get stacked diagnostics v_state=returned_sqlstate,v_message=message_text;
    if v_message='request_payload_conflict_not_rejected' then raise; end if;
    perform pg_temp.assert_true(v_state='23505' and v_message='product_fact_confirmation_request_conflict','request_payload_conflict_wrong_error');
  end;
  perform pg_temp.assert_true(v_before=pg_temp.full_fingerprint(),'request_payload_conflict_mutation');

  begin
    perform public.admin_confirm_product_fact_v1(v_actor,'pf5b1r2-confirm-positive',v_payload,repeat('0',64),v_preflight->>'prestate_digest');
    raise exception 'request_digest_conflict_not_rejected';
  exception when others then
    get stacked diagnostics v_state=returned_sqlstate,v_message=message_text;
    if v_message='request_digest_conflict_not_rejected' then raise; end if;
    perform pg_temp.assert_true(v_state='23514' and v_message='product_fact_confirmation_payload_digest_mismatch','request_digest_conflict_wrong_error');
  end;
  perform pg_temp.assert_true(v_before=pg_temp.full_fingerprint(),'request_digest_conflict_mutation');

  begin
    perform public.admin_confirm_product_fact_v1(v_actor,'pf5b1r2-confirm-positive',v_payload,v_preflight->>'payload_digest',repeat('1',64));
    raise exception 'request_prestate_conflict_not_rejected';
  exception when others then
    get stacked diagnostics v_state=returned_sqlstate,v_message=message_text;
    if v_message='request_prestate_conflict_not_rejected' then raise; end if;
    perform pg_temp.assert_true(v_state='23505' and v_message='product_fact_confirmation_request_conflict','request_prestate_conflict_wrong_error');
  end;
  perform pg_temp.assert_true(v_before=pg_temp.full_fingerprint(),'request_prestate_conflict_mutation');
  insert into pf5b1r2_results values ('request_conflict_matrix','PASS','{}');

  v_result := pg_temp.ingest_evidence(v_actor,'pf5b1r2-evidence-false',v_product1,v_subject1,v_registry,'pf5b1r2_boolean',v_prop_false,'explicit-negative','opposes','explicit_negative','product_specific_primary');
  v_negative := (v_result->>'evidence_id')::uuid;
  v_assignment_false := (pg_temp.prepare_review(v_actor,'pf5b1r2-review-false-1',v_product1,v_subject1,v_registry,'pf5b1r2_boolean',v_prop_false,'queued',v_actor)->>'assignment_id')::uuid;
  perform pg_temp.prepare_review(v_actor,'pf5b1r2-review-false-2',v_product1,v_subject1,v_registry,'pf5b1r2_boolean',v_prop_false,'under_review',v_actor);
  perform pg_temp.prepare_review(v_actor,'pf5b1r2-review-false-3',v_product1,v_subject1,v_registry,'pf5b1r2_boolean',v_prop_false,'ready_for_confirm',v_actor);
  v_payload := pg_temp.boolean_confirmation_payload(v_assignment_false,v_subject1,v_registry,'pf5b1r2_boolean',v_prop_false,'supported',false,'product_specific_primary',array[]::uuid[],array[v_negative]);
  v_preflight := public.admin_preflight_product_fact_confirmation_v1(v_actor,'pf5b1r2-confirm-false',v_payload);
  v_confirm := public.admin_confirm_product_fact_v1(v_actor,'pf5b1r2-confirm-false',v_payload,v_preflight->>'payload_digest',v_preflight->>'prestate_digest');
  perform pg_temp.assert_true((select semantic_status='supported' and value_type='boolean' and value_boolean=false from public.product_fact_instances where fact_instance_id=(v_confirm->>'fact_instance_id')::uuid),'supported_false_fact_wrong');
  insert into pf5b1r2_results values ('supported_false_A_success','PASS',jsonb_build_object('fact_instance_id',v_confirm->>'fact_instance_id'));

  v_assignment_false_missing := (pg_temp.prepare_review(v_actor,'pf5b1r2-review-false-missing-1',v_product1,v_subject1,v_registry,'pf5b1r2_boolean',v_prop_false_missing,'queued',v_actor)->>'assignment_id')::uuid;
  perform pg_temp.prepare_review(v_actor,'pf5b1r2-review-false-missing-2',v_product1,v_subject1,v_registry,'pf5b1r2_boolean',v_prop_false_missing,'under_review',v_actor);
  perform pg_temp.prepare_review(v_actor,'pf5b1r2-review-false-missing-3',v_product1,v_subject1,v_registry,'pf5b1r2_boolean',v_prop_false_missing,'ready_for_confirm',v_actor);
  v_payload := pg_temp.boolean_confirmation_payload(v_assignment_false_missing,v_subject1,v_registry,'pf5b1r2_boolean',v_prop_false_missing,'supported',false,'none',array[]::uuid[],array[]::uuid[]);
  v_before := pg_temp.full_fingerprint();
  begin
    perform public.admin_preflight_product_fact_confirmation_v1(v_actor,'pf5b1r2-false-missing',v_payload);
    raise exception 'supported_false_without_negative_not_rejected';
  exception when others then
    get stacked diagnostics v_state=returned_sqlstate,v_message=message_text;
    if v_message='supported_false_without_negative_not_rejected' then raise; end if;
    perform pg_temp.assert_true(v_state='23514' and v_message='product_fact_supported_false_requires_explicit_negative','supported_false_without_negative_wrong_error');
  end;
  perform pg_temp.assert_true(v_before=pg_temp.full_fingerprint(),'supported_false_without_negative_mutation');

  v_assignment_non_supported := (pg_temp.prepare_review(v_actor,'pf5b1r2-review-non-supported-1',v_product1,v_subject1,v_registry,'pf5b1r2_boolean',v_prop_non_supported,'queued',v_actor)->>'assignment_id')::uuid;
  perform pg_temp.prepare_review(v_actor,'pf5b1r2-review-non-supported-2',v_product1,v_subject1,v_registry,'pf5b1r2_boolean',v_prop_non_supported,'under_review',v_actor);
  perform pg_temp.prepare_review(v_actor,'pf5b1r2-review-non-supported-3',v_product1,v_subject1,v_registry,'pf5b1r2_boolean',v_prop_non_supported,'ready_for_confirm',v_actor);
  foreach v_message in array array['reviewed_not_established','evidence_insufficient','evidence_conflict'] loop
    v_payload := pg_temp.boolean_confirmation_payload(v_assignment_non_supported,v_subject1,v_registry,'pf5b1r2_boolean',v_prop_non_supported,v_message,false,'none',array[]::uuid[],array[]::uuid[]);
    v_payload := jsonb_set(v_payload,'{value_type}','"boolean"'::jsonb);
    v_payload := jsonb_set(v_payload,'{value_boolean}','false'::jsonb);
    v_before := pg_temp.full_fingerprint();
    begin
      perform public.admin_preflight_product_fact_confirmation_v1(v_actor,'pf5b1r2-non-supported-'||v_message,v_payload);
      raise exception 'non_supported_typed_value_not_rejected';
    exception when others then
      get stacked diagnostics v_state=returned_sqlstate,v_message=message_text;
      if v_message='non_supported_typed_value_not_rejected' then raise; end if;
      perform pg_temp.assert_true(v_state='23514' and v_message='product_fact_confirmation_non_supported_value_forbidden','non_supported_typed_wrong_error');
    end;
    perform pg_temp.assert_true(v_before=pg_temp.full_fingerprint(),'non_supported_typed_mutation');
  end loop;
  perform pg_temp.assert_true(not exists(select 1 from public.product_fact_instances where proposition_key=v_prop_false_missing),'missing_materialized_as_false');
  insert into pf5b1r2_results values ('supported_false_B_E_negative_matrix','PASS','{}');

  v_result := pg_temp.ingest_evidence(v_actor,'pf5b1r2-conflict-support',v_product1,v_subject1,v_registry,'pf5b1r2_boolean',v_prop_conflict,'conflict-support','supports','not_applicable','product_specific_primary');
  v_conflict_support := (v_result->>'evidence_id')::uuid;
  v_result := pg_temp.ingest_evidence(v_actor,'pf5b1r2-conflict-oppose',v_product1,v_subject1,v_registry,'pf5b1r2_boolean',v_prop_conflict,'conflict-oppose','opposes','conflict_opposition','product_specific_primary');
  v_conflict_oppose := (v_result->>'evidence_id')::uuid;
  v_assignment_conflict := (pg_temp.prepare_review(v_actor,'pf5b1r2-review-conflict-1',v_product1,v_subject1,v_registry,'pf5b1r2_boolean',v_prop_conflict,'queued',v_actor)->>'assignment_id')::uuid;
  perform pg_temp.prepare_review(v_actor,'pf5b1r2-review-conflict-2',v_product1,v_subject1,v_registry,'pf5b1r2_boolean',v_prop_conflict,'under_review',v_actor);
  perform pg_temp.prepare_review(v_actor,'pf5b1r2-review-conflict-3',v_product1,v_subject1,v_registry,'pf5b1r2_boolean',v_prop_conflict,'ready_for_confirm',v_actor);
  v_payload := pg_temp.boolean_confirmation_payload(v_assignment_conflict,v_subject1,v_registry,'pf5b1r2_boolean',v_prop_conflict,'evidence_conflict',null,'product_specific_primary',array[v_conflict_support],array[v_conflict_oppose]);
  v_preflight := public.admin_preflight_product_fact_confirmation_v1(v_actor,'pf5b1r2-confirm-conflict',v_payload);
  v_confirm := public.admin_confirm_product_fact_v1(v_actor,'pf5b1r2-confirm-conflict',v_payload,v_preflight->>'payload_digest',v_preflight->>'prestate_digest');
  v_fact_id := (v_confirm->>'fact_instance_id')::uuid;
  perform pg_temp.assert_true((select semantic_status='evidence_conflict' and value_type is null and value_boolean is null and value_enum is null and value_number is null from public.product_fact_instances where fact_instance_id=v_fact_id),'conflict_fact_value_wrong');
  perform pg_temp.assert_true((select fact_instance_id from public.product_fact_current where proposition_key=v_prop_conflict)=v_fact_id,'conflict_current_missing');
  perform pg_temp.assert_true((select count(*) from public.product_fact_evidence_links where fact_instance_id=v_fact_id and link_role='supporting')=1,'conflict_support_link_missing');
  perform pg_temp.assert_true((select count(*) from public.product_fact_evidence_links where fact_instance_id=v_fact_id and link_role='opposing')=1,'conflict_oppose_link_missing');
  insert into pf5b1r2_results values ('evidence_conflict_current','PASS',jsonb_build_object('fact_instance_id',v_fact_id));

  perform pg_temp.assert_true((select value#>>'{}' from pf5b1r2_context where key='legacy_before')=pg_temp.legacy_fingerprint(),'legacy_invariance_failed');
  insert into pf5b1r2_results values ('legacy_runtime_invariance_core','PASS',jsonb_build_object('fingerprint',pg_temp.legacy_fingerprint()));
end;
$$;

select jsonb_pretty(jsonb_build_object(
  'phase','PF5B1R2_CORE',
  'status','PASS',
  'tests',coalesce(jsonb_agg(jsonb_build_object('name',test_name,'status',status,'detail',detail) order by test_name),'[]'::jsonb),
  'product_fact_rows',jsonb_build_object(
    'registry',(select count(*) from public.product_fact_registry_versions),
    'definitions',(select count(*) from public.product_fact_definition_snapshots),
    'subjects',(select count(*) from public.product_fact_subjects),
    'sources',(select count(*) from public.product_evidence_sources),
    'bindings',(select count(*) from public.product_evidence_source_subject_bindings),
    'evidence',(select count(*) from public.product_evidence_records),
    'facts',(select count(*) from public.product_fact_instances),
    'links',(select count(*) from public.product_fact_evidence_links),
    'confirmations',(select count(*) from public.product_fact_confirmations),
    'current',(select count(*) from public.product_fact_current),
    'assignments',(select count(*) from public.product_fact_review_assignments),
    'review_events',(select count(*) from public.product_fact_review_events)
  )
)) from pf5b1r2_results;
