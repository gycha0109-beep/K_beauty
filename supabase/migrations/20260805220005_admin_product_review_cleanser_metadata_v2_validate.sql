begin;

create or replace function public.admin_validate_product_review_import_v2_rows(
  p_rows jsonb,
  p_v1_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row jsonb;
  v_v1_row jsonb;
  v_candidate_id uuid;
  v_decision text;
  v_category text;
  v_state text;
  v_profile text;
  v_confidence text;
  v_refs jsonb;
  v_records jsonb;
  v_evidence_digest text;
  v_complete boolean;
  v_expected_product jsonb;
  v_expected_review jsonb;
  v_product public.products%rowtype;
  v_review_before public.product_metadata_field_reviews%rowtype;
  v_extra_keys text[] := array[
    'review_contract_version',
    'cleansing_profile',
    'cleansing_profile_review_state',
    'cleansing_profile_confidence',
    'cleansing_profile_evidence_refs',
    'cleansing_profile_evidence_records',
    'cleansing_profile_evidence_digest',
    'cleansing_profile_schema_version',
    'cleansing_profile_review_policy_version',
    'cleansing_profile_evidence_schema_version',
    'structured_metadata_review_complete',
    'expected_target_product',
    'expected_existing_metadata_review'
  ];
begin
  for v_row in
    select item.value
    from jsonb_array_elements(p_rows) as item(value)
    order by item.value ->> 'candidate_id'
  loop
    begin
      v_candidate_id := (v_row ->> 'candidate_id')::uuid;
    exception when others then
      raise exception 'review_v2_candidate_id_invalid' using errcode = '22023';
    end;

    select item.value into v_v1_row
    from jsonb_array_elements(p_v1_payload -> 'rows') as item(value)
    where item.value ->> 'candidate_id' = v_candidate_id::text;

    if v_v1_row is null
      or (v_row - v_extra_keys) is distinct from v_v1_row
      or not v_row ?& v_extra_keys
      or exists (
        select 1 from jsonb_object_keys(v_row) as key(value)
        where not (v_v1_row ? key.value) and not (key.value = any(v_extra_keys))
      )
    then
      raise exception 'review_v2_row_schema_invalid' using errcode = '22023';
    end if;

    v_decision := v_row ->> 'decision';
    v_category := v_row ->> 'canonical_category';
    v_state := v_row ->> 'cleansing_profile_review_state';
    v_profile := nullif(v_row ->> 'cleansing_profile', '');
    v_confidence := v_row ->> 'cleansing_profile_confidence';
    v_refs := v_row -> 'cleansing_profile_evidence_refs';
    v_records := v_row -> 'cleansing_profile_evidence_records';
    v_evidence_digest := nullif(v_row ->> 'cleansing_profile_evidence_digest', '');
    v_complete := coalesce((v_row ->> 'structured_metadata_review_complete')::boolean, false);
    v_expected_product := v_row -> 'expected_target_product';
    v_expected_review := v_row -> 'expected_existing_metadata_review';

    if v_row ->> 'review_contract_version' <> 'admin-product-review-v2'
      or v_row ->> 'cleansing_profile_schema_version' <> 'cleanser-metadata-v1'
      or v_row ->> 'cleansing_profile_review_policy_version' <>
        'cleanser-metadata-review-policy-v1'
      or v_row ->> 'cleansing_profile_evidence_schema_version' <>
        'product-review-field-evidence-v1'
      or jsonb_typeof(v_refs) <> 'array'
      or jsonb_typeof(v_records) <> 'array'
    then
      raise exception 'review_v2_row_version_invalid' using errcode = '22023';
    end if;

    if (
      select count(distinct record.value ->> 'evidence_id')
      from jsonb_array_elements(v_records) as record(value)
    ) <> jsonb_array_length(v_records)
      or exists (
        select 1
        from jsonb_array_elements(v_records) as record(value)
        where jsonb_typeof(record.value) <> 'object'
          or not record.value ?& array[
            'evidence_id', 'candidate_id', 'field', 'supported_value',
            'evidence_type', 'source_reference', 'schema_version', 'evidence_digest'
          ]
          or (
            select count(*) from jsonb_object_keys(record.value)
          ) <> 8
          or coalesce(record.value ->> 'candidate_id', '') <> v_candidate_id::text
          or record.value ->> 'field' <> 'cleansing_profile'
          or record.value ->> 'schema_version' <> 'product-review-field-evidence-v1'
          or record.value ->> 'evidence_type' not in (
            'official_product_page', 'manufacturer_documentation',
            'ingredient_list', 'review_corpus', 'manual_conflict_record'
          )
          or record.value ->> 'source_reference' !~ '^https://'
          or record.value ->> 'source_reference' ~ '[[:cntrl:]]'
          or record.value ->> 'source_reference' ~ '^https://[^/]*@'
          or lower(record.value ->> 'source_reference') ~ '^https://(localhost|[^/]+\.localhost)([:/]|$)'
          or lower(record.value ->> 'source_reference') ~ '^https://(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2[0-9]|3[01])\.)'
          or lower(record.value ->> 'source_reference') ~ '^https://[^/]*xn--'
          or lower(record.value ->> 'source_reference') ~ '^https://[^/]+\.([:/]|$)'
          or not exists (
            select 1
            from jsonb_array_elements_text(v_v1_row -> 'review_source_urls') as source(value)
            where source.value = record.value ->> 'source_reference'
          )
          or (
            record.value -> 'supported_value' <> 'null'::jsonb
            and record.value ->> 'supported_value' not in ('low_ph', 'balanced', 'deep_clean')
          )
          or coalesce(record.value ->> 'evidence_digest', '') !~ '^[0-9a-f]{64}$'
          or public.admin_product_review_sha256_json(
            record.value - 'evidence_digest'
          ) <> record.value ->> 'evidence_digest'
      )
      or (
        select count(distinct reference.value)
        from jsonb_array_elements_text(v_refs) as reference(value)
      ) <> jsonb_array_length(v_refs)
      or exists (
        select 1
        from jsonb_array_elements_text(v_refs) as reference(value)
        where reference.value !~
          '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          or not exists (
            select 1 from jsonb_array_elements(v_records) as record(value)
            where record.value ->> 'evidence_id' = reference.value
          )
      )
      or jsonb_array_length(v_refs) <> jsonb_array_length(v_records)
    then
      raise exception 'review_v2_evidence_binding_invalid' using errcode = '23514';
    end if;

    if jsonb_array_length(v_records) = 0 then
      if v_evidence_digest is not null then
        raise exception 'review_v2_evidence_digest_invalid' using errcode = '23514';
      end if;
    elsif v_evidence_digest !~ '^[0-9a-f]{64}$'
      or public.admin_product_review_sha256_json((
        select jsonb_agg(record.value order by record.value ->> 'evidence_id')
        from jsonb_array_elements(v_records) as record(value)
      )) <> v_evidence_digest
    then
      raise exception 'review_v2_evidence_digest_invalid' using errcode = '23514';
    end if;

    if v_decision <> 'approve' then
      if v_state is not null or v_profile is not null or v_confidence is not null
        or jsonb_array_length(v_refs) <> 0 or jsonb_array_length(v_records) <> 0
        or v_evidence_digest is not null or v_complete
      then
        raise exception 'review_v2_metadata_not_allowed_for_non_approve'
          using errcode = '23514';
      end if;
      continue;
    end if;

    if v_category = 'cleanser' then
      if v_state = 'reviewed_valid' then
        if v_profile not in ('low_ph', 'balanced', 'deep_clean')
          or v_confidence not in ('high', 'medium', 'low')
          or jsonb_array_length(v_records) = 0
          or exists (
            select 1 from jsonb_array_elements(v_records) as record(value)
            where record.value ->> 'supported_value' is distinct from v_profile
          )
          or not v_complete
        then
          raise exception 'review_v2_reviewed_valid_invalid' using errcode = '23514';
        end if;
      elsif v_state = 'reviewed_unknown' then
        if v_profile is not null or v_confidence <> 'unknown'
          or jsonb_array_length(v_records) = 0
          or exists (
            select 1 from jsonb_array_elements(v_records) as record(value)
            where record.value -> 'supported_value' <> 'null'::jsonb
          )
          or v_complete
        then
          raise exception 'review_v2_reviewed_unknown_invalid' using errcode = '23514';
        end if;
      elsif v_state = 'reviewed_conflict' then
        if v_profile is not null or v_confidence <> 'unknown'
          or jsonb_array_length(v_records) < 2
          or (
            select count(distinct record.value ->> 'supported_value')
            from jsonb_array_elements(v_records) as record(value)
            where record.value -> 'supported_value' <> 'null'::jsonb
          ) < 2
          or v_complete
        then
          raise exception 'review_v2_reviewed_conflict_invalid' using errcode = '23514';
        end if;
      else
        raise exception 'review_v2_cleanser_review_state_invalid' using errcode = '23514';
      end if;
    else
      if v_state <> 'not_applicable' or v_profile is not null
        or v_confidence <> 'unknown'
        or jsonb_array_length(v_refs) <> 0 or jsonb_array_length(v_records) <> 0
        or v_evidence_digest is not null or v_complete
      then
        raise exception 'review_v2_non_cleanser_metadata_invalid' using errcode = '23514';
      end if;
    end if;

    if nullif(v_v1_row ->> 'existing_product_match_id', '') is null then
      if v_expected_product <> 'null'::jsonb or v_expected_review <> 'null'::jsonb then
        raise exception 'review_v2_new_product_prestate_invalid' using errcode = '23514';
      end if;
    else
      select * into v_product
      from public.products
      where id = (v_v1_row ->> 'existing_product_match_id')::uuid
      for update;

      if not found
        or v_expected_product is null
        or v_expected_product = 'null'::jsonb
        or v_expected_product ->> 'id' <> v_product.id::text
        or v_expected_product ->> 'category' <> v_product.category::text
        or v_expected_product ->> 'updated_at' <>
          (to_jsonb(v_product.updated_at) #>> '{}')
        or v_expected_product ->> 'cleansing_profile' is distinct from
          to_jsonb(v_product) ->> 'cleansing_profile'
      then
        raise exception 'review_v2_stale_target_product' using errcode = '40001';
      end if;

      select * into v_review_before
      from public.product_metadata_field_reviews
      where product_id = v_product.id and field_name = 'cleansing_profile'
      for update;

      if found then
        if v_expected_review is null or v_expected_review = 'null'::jsonb
          or v_expected_review ->> 'product_id' <> v_review_before.product_id::text
          or v_expected_review ->> 'candidate_id' is distinct from
            v_review_before.candidate_id::text
          or v_expected_review ->> 'canonical_payload_digest' <>
            v_review_before.canonical_payload_digest
          or v_expected_review ->> 'updated_at' <>
            (to_jsonb(v_review_before.updated_at) #>> '{}')
        then
          raise exception 'review_v2_stale_metadata_review' using errcode = '40001';
        end if;
      elsif v_expected_review <> 'null'::jsonb then
        raise exception 'review_v2_stale_metadata_review' using errcode = '40001';
      end if;
    end if;
  end loop;

  return;
end;
$$;

revoke all on function public.admin_validate_product_review_import_v2_rows(jsonb, jsonb)
  from public, anon, authenticated, service_role;

commit;
