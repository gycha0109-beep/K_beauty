begin;

create or replace function public.admin_confirm_product_review_import_v2_batch(
  p_actor_user_id uuid,
  p_request_id text,
  p_payload jsonb,
  p_payload_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_role text;
  v_request_id text := btrim(coalesce(p_request_id, ''));
  v_payload_hash text := lower(btrim(coalesce(p_payload_hash, '')));
  v_export_batch_id uuid;
  v_rows jsonb;
  v_v1_payload jsonb;
  v_v1_payload_hash text;
  v_existing public.admin_product_review_import_v2_confirmations%rowtype;
  v_v1_existing public.admin_product_review_import_confirmations%rowtype;
  v_v1_result jsonb;
  v_row jsonb;
  v_v1_result_row jsonb;
  v_candidate_id uuid;
  v_product_id uuid;
  v_decision text;
  v_profile text;
  v_state text;
  v_confidence text;
  v_evidence_refs jsonb;
  v_evidence_records jsonb;
  v_evidence_digest text;
  v_product_before_profile text;
  v_product_after_profile text;
  v_existing_review_digest text;
  v_metadata_audit_id uuid;
  v_metadata_write_count integer := 0;
  v_results jsonb := '[]'::jsonb;
  v_result jsonb;
  v_expected_keys text[] := array[
    'schema_version',
    'review_contract_version',
    'cleanser_metadata_schema_version',
    'cleanser_metadata_review_policy_version',
    'field_evidence_schema_version',
    'export_batch_id',
    'source_snapshot_version',
    'manifest_sha256',
    'evidence_sha256',
    'candidate_ids_sha256',
    'reviewed_file_sha256',
    'v1_payload',
    'v1_payload_hash',
    'rows'
  ];
begin
  v_actor_role := public.admin_require_product_review_actor(
    p_actor_user_id,
    'admin.products.review'
  );

  if char_length(v_request_id) not between 8 and 120 then
    raise exception 'review_v2_request_id_invalid' using errcode = '22023';
  end if;

  if p_payload is null
    or jsonb_typeof(p_payload) <> 'object'
    or octet_length(p_payload::text) > 6291456
    or public.admin_audit_payload_has_forbidden_content(p_payload)
  then
    raise exception 'review_v2_payload_invalid' using errcode = '22023';
  end if;

  if not p_payload ?& v_expected_keys
    or (select count(*) from jsonb_object_keys(p_payload)) <> array_length(v_expected_keys, 1)
    or exists (
      select 1
      from jsonb_object_keys(p_payload) as key(value)
      where not key.value = any(v_expected_keys)
    )
  then
    raise exception 'review_v2_payload_schema_invalid' using errcode = '22023';
  end if;

  if p_payload ->> 'schema_version' <> 'product-review-import-confirm-v2'
    or p_payload ->> 'review_contract_version' <> 'admin-product-review-v2'
    or p_payload ->> 'cleanser_metadata_schema_version' <> 'cleanser-metadata-v1'
    or p_payload ->> 'cleanser_metadata_review_policy_version' <>
      'cleanser-metadata-review-policy-v1'
    or p_payload ->> 'field_evidence_schema_version' <>
      'product-review-field-evidence-v1'
  then
    raise exception 'review_v2_payload_version_invalid' using errcode = '22023';
  end if;

  begin
    v_export_batch_id := (p_payload ->> 'export_batch_id')::uuid;
  exception when others then
    raise exception 'review_v2_batch_id_invalid' using errcode = '22023';
  end;

  v_rows := p_payload -> 'rows';
  v_v1_payload := p_payload -> 'v1_payload';
  v_v1_payload_hash := lower(btrim(coalesce(p_payload ->> 'v1_payload_hash', '')));

  if v_payload_hash !~ '^[0-9a-f]{64}$'
    or v_v1_payload_hash !~ '^[0-9a-f]{64}$'
    or coalesce(p_payload ->> 'source_snapshot_version', '') !~ '^[0-9a-f]{64}$'
    or coalesce(p_payload ->> 'manifest_sha256', '') !~ '^[0-9a-f]{64}$'
    or coalesce(p_payload ->> 'evidence_sha256', '') !~ '^[0-9a-f]{64}$'
    or coalesce(p_payload ->> 'candidate_ids_sha256', '') !~ '^[0-9a-f]{64}$'
    or coalesce(p_payload ->> 'reviewed_file_sha256', '') !~ '^[0-9a-f]{64}$'
    or jsonb_typeof(v_rows) <> 'array'
    or jsonb_array_length(v_rows) not between 1 and 100
    or jsonb_typeof(v_v1_payload) <> 'object'
  then
    raise exception 'review_v2_payload_hash_or_rows_invalid' using errcode = '22023';
  end if;

  if public.admin_product_review_sha256_json(p_payload) <> v_payload_hash
    or public.admin_product_review_sha256_json(v_v1_payload) <> v_v1_payload_hash
  then
    raise exception 'review_v2_payload_hash_mismatch' using errcode = '22023';
  end if;

  if v_v1_payload ->> 'schema_version' <> 'product-review-import-confirm-v1'
    or v_v1_payload ->> 'export_batch_id' <> v_export_batch_id::text
    or v_v1_payload ->> 'source_snapshot_version' <>
      p_payload ->> 'source_snapshot_version'
    or v_v1_payload ->> 'manifest_sha256' <> p_payload ->> 'manifest_sha256'
    or v_v1_payload ->> 'evidence_sha256' <> p_payload ->> 'evidence_sha256'
    or v_v1_payload ->> 'candidate_ids_sha256' <> p_payload ->> 'candidate_ids_sha256'
    or v_v1_payload ->> 'reviewed_file_sha256' <> p_payload ->> 'reviewed_file_sha256'
    or jsonb_typeof(v_v1_payload -> 'rows') <> 'array'
    or jsonb_array_length(v_v1_payload -> 'rows') <> jsonb_array_length(v_rows)
  then
    raise exception 'review_v2_v1_payload_binding_invalid' using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('bejewely_review_import_v2_request:' || v_request_id, 0)
  );
  perform pg_advisory_xact_lock(
    hashtextextended('bejewely_review_import_batch:' || v_export_batch_id::text, 0)
  );

  select * into v_existing
  from public.admin_product_review_import_v2_confirmations
  where request_id = v_request_id;

  if found then
    if v_existing.actor_user_id <> p_actor_user_id
      or v_existing.export_batch_id <> v_export_batch_id
      or v_existing.payload_hash <> v_payload_hash
    then
      raise exception 'review_v2_request_id_conflict' using errcode = '23505';
    end if;
    return v_existing.result;
  end if;

  select * into v_existing
  from public.admin_product_review_import_v2_confirmations
  where export_batch_id = v_export_batch_id;

  if found then
    raise exception 'review_v2_batch_already_confirmed' using errcode = '23505';
  end if;

  select * into v_v1_existing
  from public.admin_product_review_import_confirmations
  where export_batch_id = v_export_batch_id;

  if found then
    raise exception 'review_v2_v1_batch_already_confirmed' using errcode = '23505';
  end if;

  perform public.admin_validate_product_review_import_v2_rows(v_rows, v_v1_payload);

  v_v1_result := public.admin_confirm_product_review_import_batch(
    p_actor_user_id,
    v_request_id,
    v_v1_payload,
    v_v1_payload_hash
  );

  if coalesce(v_v1_result ->> 'status', '') <> 'confirmed'
    or coalesce((v_v1_result ->> 'total_rows')::integer, 0) <> jsonb_array_length(v_rows)
  then
    raise exception 'review_v2_v1_confirm_failed' using errcode = '23514';
  end if;

  for v_row in
    select item.value
    from jsonb_array_elements(v_rows) as item(value)
    order by item.value ->> 'candidate_id'
  loop
    v_candidate_id := (v_row ->> 'candidate_id')::uuid;
    v_decision := v_row ->> 'decision';

    select item.value into v_v1_result_row
    from jsonb_array_elements(v_v1_result -> 'rows') as item(value)
    where item.value ->> 'candidate_id' = v_candidate_id::text;

    if v_v1_result_row is null then
      raise exception 'review_v2_v1_result_row_missing' using errcode = '23514';
    end if;

    if v_decision = 'approve' then
      v_product_id := nullif(v_v1_result_row ->> 'product_id', '')::uuid;
      if v_product_id is null
        or v_v1_result_row ->> 'promotion_action' not in ('inserted', 'merged')
      then
        raise exception 'review_v2_product_result_invalid' using errcode = '23514';
      end if;

      v_profile := nullif(v_row ->> 'cleansing_profile', '');
      v_state := v_row ->> 'cleansing_profile_review_state';
      v_confidence := v_row ->> 'cleansing_profile_confidence';
      v_evidence_refs := v_row -> 'cleansing_profile_evidence_refs';
      v_evidence_records := v_row -> 'cleansing_profile_evidence_records';
      v_evidence_digest := nullif(v_row ->> 'cleansing_profile_evidence_digest', '');
      v_product_before_profile := case
        when jsonb_typeof(v_row -> 'expected_target_product') = 'object'
          then v_row #>> '{expected_target_product,cleansing_profile}'
        else null
      end;
      v_existing_review_digest := case
        when jsonb_typeof(v_row -> 'expected_existing_metadata_review') = 'object'
          then v_row #>> '{expected_existing_metadata_review,canonical_payload_digest}'
        else null
      end;

      perform public.admin_set_product_cleansing_profile_v2(v_product_id, v_profile);

      insert into public.product_metadata_field_reviews (
        product_id,
        field_name,
        candidate_id,
        review_state,
        field_value,
        confidence,
        evidence_refs,
        evidence_records,
        evidence_digest,
        review_contract_version,
        metadata_schema_version,
        review_policy_version,
        evidence_schema_version,
        export_batch_id,
        request_id,
        canonical_payload_digest,
        reviewed_by,
        reviewed_at,
        updated_at
      ) values (
        v_product_id,
        'cleansing_profile',
        v_candidate_id,
        v_state,
        v_profile,
        v_confidence,
        v_evidence_refs,
        v_evidence_records,
        v_evidence_digest,
        'admin-product-review-v2',
        'cleanser-metadata-v1',
        'cleanser-metadata-review-policy-v1',
        'product-review-field-evidence-v1',
        v_export_batch_id,
        v_request_id,
        v_payload_hash,
        p_actor_user_id,
        now(),
        now()
      )
      on conflict (product_id, field_name) do update
      set candidate_id = excluded.candidate_id,
          review_state = excluded.review_state,
          field_value = excluded.field_value,
          confidence = excluded.confidence,
          evidence_refs = excluded.evidence_refs,
          evidence_records = excluded.evidence_records,
          evidence_digest = excluded.evidence_digest,
          review_contract_version = excluded.review_contract_version,
          metadata_schema_version = excluded.metadata_schema_version,
          review_policy_version = excluded.review_policy_version,
          evidence_schema_version = excluded.evidence_schema_version,
          export_batch_id = excluded.export_batch_id,
          request_id = excluded.request_id,
          canonical_payload_digest = excluded.canonical_payload_digest,
          reviewed_by = excluded.reviewed_by,
          reviewed_at = excluded.reviewed_at,
          updated_at = excluded.updated_at;

      select to_jsonb(product) ->> 'cleansing_profile'
      into v_product_after_profile
      from public.products as product
      where product.id = v_product_id;

      if v_product_after_profile is distinct from v_profile then
        raise exception 'review_v2_product_metadata_write_mismatch' using errcode = '23514';
      end if;

      v_metadata_audit_id := public.record_admin_audit_event(
        p_actor_user_id,
        'admin.products.review',
        'admin.product_metadata_review_v2.confirmed',
        'product',
        v_product_id::text,
        jsonb_build_object(
          'cleansing_profile', v_product_before_profile,
          'existing_metadata_review_digest', v_existing_review_digest
        ),
        jsonb_build_object(
          'cleansing_profile', v_profile,
          'review_state', v_state,
          'confidence', v_confidence,
          'evidence_digest', v_evidence_digest,
          'structured_metadata_review_complete',
            coalesce((v_row ->> 'structured_metadata_review_complete')::boolean, false)
        ),
        'Cleanser metadata review v2 confirmation',
        left(v_request_id, 80) || ':' || v_candidate_id::text || ':metadata',
        jsonb_build_object(
          'request_id', v_request_id,
          'export_batch_id', v_export_batch_id,
          'candidate_id', v_candidate_id,
          'review_contract_version', 'admin-product-review-v2',
          'metadata_schema_version', 'cleanser-metadata-v1',
          'review_policy_version', 'cleanser-metadata-review-policy-v1',
          'evidence_schema_version', 'product-review-field-evidence-v1',
          'canonical_payload_digest', v_payload_hash,
          'evidence_digest', v_evidence_digest,
          'confirm_result', 'confirmed'
        )
      );

      v_metadata_write_count := v_metadata_write_count + 1;
      v_results := v_results || jsonb_build_array(
        v_v1_result_row || jsonb_build_object(
          'metadata_review_state', v_state,
          'cleansing_profile', v_profile,
          'metadata_audit_id', v_metadata_audit_id
        )
      );
    else
      v_results := v_results || jsonb_build_array(
        v_v1_result_row || jsonb_build_object(
          'metadata_review_state', null,
          'cleansing_profile', null,
          'metadata_audit_id', null
        )
      );
    end if;
  end loop;

  if v_metadata_write_count <>
    coalesce((v_v1_result ->> 'approve_create_new')::integer, 0) +
    coalesce((v_v1_result ->> 'approve_merge_existing')::integer, 0)
  then
    raise exception 'review_v2_metadata_write_count_mismatch' using errcode = '23514';
  end if;

  v_result := jsonb_build_object(
    'status', 'confirmed',
    'request_id', v_request_id,
    'export_batch_id', v_export_batch_id,
    'actor_role', v_actor_role,
    'review_contract_version', 'admin-product-review-v2',
    'metadata_schema_version', 'cleanser-metadata-v1',
    'review_policy_version', 'cleanser-metadata-review-policy-v1',
    'total_rows', v_v1_result -> 'total_rows',
    'approve_create_new', v_v1_result -> 'approve_create_new',
    'approve_merge_existing', v_v1_result -> 'approve_merge_existing',
    'defer', v_v1_result -> 'defer',
    'block', v_v1_result -> 'block',
    'metadata_writes', v_metadata_write_count,
    'rows', v_results
  );

  insert into public.admin_product_review_import_v2_confirmations (
    request_id,
    export_batch_id,
    actor_user_id,
    payload_hash,
    reviewed_file_sha256,
    canonical_payload_digest,
    result,
    confirmed_at
  ) values (
    v_request_id,
    v_export_batch_id,
    p_actor_user_id,
    v_payload_hash,
    p_payload ->> 'reviewed_file_sha256',
    v_payload_hash,
    v_result,
    now()
  );

  return v_result;
end;
$$;

revoke all on function public.admin_confirm_product_review_import_v2_batch(
  uuid, text, jsonb, text
) from public, anon, authenticated;
grant execute on function public.admin_confirm_product_review_import_v2_batch(
  uuid, text, jsonb, text
) to service_role;

comment on function public.admin_confirm_product_review_import_v2_batch(
  uuid, text, jsonb, text
) is
  'Atomically delegates v1 product create/merge and persists cleanser metadata review state, evidence, server actor audit, and v2 idempotency.';

do $$
begin
  if has_function_privilege(
    'anon',
    'public.admin_confirm_product_review_import_v2_batch(uuid,text,jsonb,text)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.admin_confirm_product_review_import_v2_batch(uuid,text,jsonb,text)',
    'EXECUTE'
  ) then
    raise exception 'review_v2_confirm_rpc_exposed_to_browser_role';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.admin_confirm_product_review_import_v2_batch(uuid,text,jsonb,text)',
    'EXECUTE'
  ) then
    raise exception 'review_v2_confirm_rpc_missing_service_role_grant';
  end if;

  if has_table_privilege(
    'service_role',
    'public.product_metadata_field_reviews',
    'INSERT'
  ) or has_table_privilege(
    'authenticated',
    'public.product_metadata_field_reviews',
    'SELECT'
  ) or has_table_privilege(
    'anon',
    'public.product_metadata_field_reviews',
    'SELECT'
  ) then
    raise exception 'review_v2_storage_privilege_boundary_invalid';
  end if;
end $$;

commit;
