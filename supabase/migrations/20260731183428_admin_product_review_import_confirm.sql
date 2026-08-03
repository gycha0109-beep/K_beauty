begin;

-- Sequenced after the existing ADMIN-PRODUCT-1 hardening migration.

create extension if not exists pgcrypto with schema extensions;

create table public.admin_product_review_import_confirmations (
  request_id text primary key,
  export_batch_id uuid not null,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  payload_hash text not null,
  source_snapshot_version text not null,
  candidate_ids_sha256 text not null,
  candidate_count integer not null,
  result jsonb not null,
  confirmed_at timestamptz not null default now(),
  constraint admin_product_review_import_request_id_check
    check (char_length(btrim(request_id)) between 8 and 120),
  constraint admin_product_review_import_payload_hash_check
    check (payload_hash ~ '^[0-9a-f]{64}$'),
  constraint admin_product_review_import_source_hash_check
    check (source_snapshot_version ~ '^[0-9a-f]{64}$'),
  constraint admin_product_review_import_candidate_hash_check
    check (candidate_ids_sha256 ~ '^[0-9a-f]{64}$'),
  constraint admin_product_review_import_candidate_count_check
    check (candidate_count between 1 and 100),
  constraint admin_product_review_import_result_object_check
    check (jsonb_typeof(result) = 'object'),
  constraint admin_product_review_import_result_size_check
    check (octet_length(result::text) <= 1048576),
  constraint admin_product_review_import_batch_unique unique (export_batch_id)
);

create index admin_product_review_import_actor_confirmed_idx
  on public.admin_product_review_import_confirmations (
    actor_user_id,
    confirmed_at desc
  );

alter table public.admin_product_review_import_confirmations
  enable row level security;

revoke all on table public.admin_product_review_import_confirmations
  from public, anon, authenticated, service_role;

create or replace function public.admin_product_review_canonical_json(
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
          public.admin_product_review_canonical_json(entry.value),
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
        public.admin_product_review_canonical_json(item.value),
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

create or replace function public.admin_product_review_sha256_json(
  p_value jsonb
)
returns text
language sql
immutable
set search_path = public, extensions, pg_temp
as $$
  select encode(
    extensions.digest(
      convert_to(public.admin_product_review_canonical_json(p_value), 'UTF8'),
      'sha256'
    ),
    'hex'
  );
$$;

create or replace function public.admin_get_product_review_import_confirmation(
  p_actor_user_id uuid,
  p_request_id text,
  p_export_batch_id uuid,
  p_payload_hash text
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_request_id text := btrim(coalesce(p_request_id, ''));
  v_payload_hash text := lower(btrim(coalesce(p_payload_hash, '')));
  v_existing public.admin_product_review_import_confirmations%rowtype;
begin
  perform public.admin_require_product_review_actor(
    p_actor_user_id,
    'admin.products.review'
  );

  if char_length(v_request_id) not between 8 and 120
    or v_payload_hash !~ '^[0-9a-f]{64}$'
    or p_export_batch_id is null
  then
    raise exception 'review_import_request_id_invalid' using errcode = '22023';
  end if;

  select * into v_existing
  from public.admin_product_review_import_confirmations
  where request_id = v_request_id;

  if not found then
    return null;
  end if;

  if v_existing.actor_user_id <> p_actor_user_id
    or v_existing.export_batch_id <> p_export_batch_id
    or v_existing.payload_hash <> v_payload_hash
  then
    raise exception 'review_import_request_id_conflict' using errcode = '23505';
  end if;

  return v_existing.result;
end;
$$;

create or replace function public.admin_confirm_product_review_import_batch(
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
  v_source_snapshot_version text;
  v_candidate_ids_sha256 text;
  v_rows jsonb;
  v_row jsonb;
  v_row_count integer;
  v_existing public.admin_product_review_import_confirmations%rowtype;
  v_candidate public.product_candidates%rowtype;
  v_review public.candidate_promotion_reviews%rowtype;
  v_product public.products%rowtype;
  v_candidate_id uuid;
  v_decision text;
  v_reason text;
  v_existing_product_id uuid;
  v_before jsonb;
  v_after jsonb;
  v_promotion_result jsonb;
  v_promotion_action text;
  v_product_id uuid;
  v_audit_id uuid;
  v_results jsonb := '[]'::jsonb;
  v_create_count integer := 0;
  v_merge_count integer := 0;
  v_defer_count integer := 0;
  v_block_count integer := 0;
  v_result jsonb;
begin
  v_actor_role := public.admin_require_product_review_actor(
    p_actor_user_id,
    'admin.products.review'
  );

  if char_length(v_request_id) not between 8 and 120 then
    raise exception 'review_import_request_id_invalid' using errcode = '22023';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'review_import_payload_invalid' using errcode = '22023';
  end if;

  if octet_length(p_payload::text) > 4194304 then
    raise exception 'review_import_payload_too_large' using errcode = '22023';
  end if;

  if public.admin_audit_payload_has_forbidden_content(p_payload) then
    raise exception 'review_import_sensitive_payload_rejected' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_payload) as key(value)
    where key.value not in (
      'schema_version',
      'export_batch_id',
      'source_snapshot_version',
      'manifest_sha256',
      'evidence_sha256',
      'candidate_ids_sha256',
      'reviewed_file_sha256',
      'rows'
    )
  ) or not (
    p_payload ?& array[
      'schema_version',
      'export_batch_id',
      'source_snapshot_version',
      'manifest_sha256',
      'evidence_sha256',
      'candidate_ids_sha256',
      'reviewed_file_sha256',
      'rows'
    ]
  ) then
    raise exception 'review_import_payload_schema_invalid' using errcode = '22023';
  end if;

  if p_payload ->> 'schema_version' <> 'product-review-import-confirm-v1' then
    raise exception 'review_import_payload_schema_invalid' using errcode = '22023';
  end if;

  begin
    v_export_batch_id := (p_payload ->> 'export_batch_id')::uuid;
  exception when others then
    raise exception 'review_import_batch_id_invalid' using errcode = '22023';
  end;

  v_source_snapshot_version := lower(
    btrim(coalesce(p_payload ->> 'source_snapshot_version', ''))
  );
  v_candidate_ids_sha256 := lower(
    btrim(coalesce(p_payload ->> 'candidate_ids_sha256', ''))
  );
  v_rows := p_payload -> 'rows';

  if v_payload_hash !~ '^[0-9a-f]{64}$'
    or v_source_snapshot_version !~ '^[0-9a-f]{64}$'
    or v_candidate_ids_sha256 !~ '^[0-9a-f]{64}$'
    or coalesce(p_payload ->> 'manifest_sha256', '') !~ '^[0-9a-f]{64}$'
    or coalesce(p_payload ->> 'evidence_sha256', '') !~ '^[0-9a-f]{64}$'
    or coalesce(p_payload ->> 'reviewed_file_sha256', '') !~ '^[0-9a-f]{64}$'
  then
    raise exception 'review_import_hash_invalid' using errcode = '22023';
  end if;

  if public.admin_product_review_sha256_json(p_payload) <> v_payload_hash then
    raise exception 'review_import_payload_hash_mismatch' using errcode = '22023';
  end if;

  if jsonb_typeof(v_rows) <> 'array' then
    raise exception 'review_import_rows_invalid' using errcode = '22023';
  end if;

  v_row_count := jsonb_array_length(v_rows);
  if v_row_count not between 1 and 100 then
    raise exception 'review_import_row_count_invalid' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_rows) as item(value)
    where jsonb_typeof(item.value) <> 'object'
  ) then
    raise exception 'review_import_row_schema_invalid' using errcode = '22023';
  end if;

  if (
    select count(distinct item.value ->> 'candidate_id')
    from jsonb_array_elements(v_rows) as item(value)
  ) <> v_row_count then
    raise exception 'review_import_duplicate_candidate_id' using errcode = '23505';
  end if;

  if encode(
    extensions.digest(
      convert_to(
        (
          select string_agg(item.value ->> 'candidate_id', E'\n'
            order by item.value ->> 'candidate_id') || E'\n'
          from jsonb_array_elements(v_rows) as item(value)
        ),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  ) <> v_candidate_ids_sha256 then
    raise exception 'review_import_candidate_ids_hash_mismatch' using errcode = '22023';
  end if;

  if public.admin_product_review_sha256_json((
    select jsonb_agg(
      jsonb_build_object(
        'candidate_id', item.value ->> 'candidate_id',
        'candidate_updated_at', item.value ->> 'candidate_updated_at_expected',
        'review_queue_updated_at', item.value ->> 'review_queue_updated_at_expected',
        'evidence_version', item.value ->> 'evidence_version_expected'
      ) order by item.value ->> 'candidate_id'
    )
    from jsonb_array_elements(v_rows) as item(value)
  )) <> v_source_snapshot_version then
    raise exception 'review_import_source_snapshot_hash_mismatch' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('bejewely_review_import_request:' || v_request_id, 0)
  );
  perform pg_advisory_xact_lock(
    hashtextextended('bejewely_review_import_batch:' || v_export_batch_id::text, 0)
  );

  select * into v_existing
  from public.admin_product_review_import_confirmations
  where request_id = v_request_id;

  if found then
    if v_existing.actor_user_id <> p_actor_user_id
      or v_existing.export_batch_id <> v_export_batch_id
      or v_existing.payload_hash <> v_payload_hash
    then
      raise exception 'review_import_request_id_conflict' using errcode = '23505';
    end if;
    return v_existing.result;
  end if;

  select * into v_existing
  from public.admin_product_review_import_confirmations
  where export_batch_id = v_export_batch_id;

  if found then
    raise exception 'review_import_batch_already_confirmed' using errcode = '23505';
  end if;

  perform candidate.id
  from public.product_candidates as candidate
  join (
    select (item.value ->> 'candidate_id')::uuid as candidate_id
    from jsonb_array_elements(v_rows) as item(value)
  ) as requested on requested.candidate_id = candidate.id
  order by candidate.id
  for update of candidate;

  perform review.candidate_id
  from public.candidate_promotion_reviews as review
  join (
    select (item.value ->> 'candidate_id')::uuid as candidate_id
    from jsonb_array_elements(v_rows) as item(value)
  ) as requested on requested.candidate_id = review.candidate_id
  order by review.candidate_id
  for update of review;

  if (
    select count(*)
    from public.product_candidates as candidate
    where candidate.id in (
      select (item.value ->> 'candidate_id')::uuid
      from jsonb_array_elements(v_rows) as item(value)
    )
  ) <> v_row_count then
    raise exception 'review_import_candidate_not_found' using errcode = 'P0002';
  end if;

  if (
    select count(*)
    from public.candidate_promotion_reviews as review
    where review.candidate_id in (
      select (item.value ->> 'candidate_id')::uuid
      from jsonb_array_elements(v_rows) as item(value)
    )
  ) <> v_row_count then
    raise exception 'review_import_review_queue_not_found' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_rows) as item(value)
    where item.value ->> 'decision' = 'approve'
      and nullif(item.value ->> 'existing_product_match_id', '') is null
    group by
      item.value ->> 'normalized_brand',
      item.value ->> 'normalized_name'
    having count(*) > 1
  ) then
    raise exception 'review_import_duplicate_product_create' using errcode = '23505';
  end if;

  for v_row in
    select item.value
    from jsonb_array_elements(v_rows) as item(value)
    order by item.value ->> 'candidate_id'
  loop
    begin
      v_candidate_id := (v_row ->> 'candidate_id')::uuid;
    exception when others then
      raise exception 'review_import_candidate_id_invalid' using errcode = '22023';
    end;

    v_decision := lower(btrim(coalesce(v_row ->> 'decision', '')));
    v_reason := btrim(coalesce(v_row ->> 'reason', ''));

    if v_decision not in ('approve', 'defer', 'block')
      or char_length(v_reason) not between 3 and 1000
    then
      raise exception 'review_import_decision_invalid' using errcode = '22023';
    end if;

    select * into strict v_candidate
    from public.product_candidates
    where id = v_candidate_id;

    select * into strict v_review
    from public.candidate_promotion_reviews
    where candidate_id = v_candidate_id;

    if v_candidate.updated_at is distinct from
        (v_row ->> 'candidate_updated_at_expected')::timestamptz
      or v_candidate.source_name is distinct from v_row #>> '{expected_candidate,source_name}'
      or v_candidate.external_type is distinct from nullif(v_row #>> '{expected_candidate,external_type}', '')
      or v_candidate.external_id is distinct from nullif(v_row #>> '{expected_candidate,external_id}', '')
      or v_candidate.source_url is distinct from nullif(v_row #>> '{expected_candidate,source_url}', '')
      or v_candidate.category_path is distinct from nullif(v_row #>> '{expected_candidate,category_path}', '')
      or v_candidate.brand_name_raw is distinct from v_row #>> '{expected_candidate,brand_name_raw}'
      or v_candidate.product_name_raw is distinct from v_row #>> '{expected_candidate,product_name_raw}'
      or v_candidate.normalized_brand is distinct from v_row #>> '{expected_candidate,normalized_brand}'
      or v_candidate.normalized_name is distinct from v_row #>> '{expected_candidate,normalized_name}'
      or v_candidate.review_status::text is distinct from v_row #>> '{expected_candidate,review_status}'
      or coalesce(v_candidate.review_flags, '{}'::text[]) is distinct from
        coalesce(array(
          select jsonb_array_elements_text(v_row #> '{expected_candidate,review_flags}')
        ), '{}'::text[])
      or v_candidate.matched_product_id is distinct from
        nullif(v_row #>> '{expected_candidate,matched_product_id}', '')::uuid
      or v_candidate.duplicate_of_product_id is distinct from
        nullif(v_row #>> '{expected_candidate,duplicate_of_product_id}', '')::uuid
      or v_candidate.promotion_version is distinct from
        nullif(v_row #>> '{expected_candidate,promotion_version}', '')
      or public.admin_product_review_sha256_json(
        coalesce(v_candidate.promotion_payload, 'null'::jsonb)
      ) is distinct from v_row #>> '{expected_candidate,promotion_payload_sha256}'
    then
      raise exception 'review_import_stale_candidate' using errcode = '23514';
    end if;

    if v_review.updated_at is distinct from
        (v_row ->> 'review_queue_updated_at_expected')::timestamptz
      or v_review.status is distinct from v_row #>> '{expected_review,status}'
      or v_review.rule_version is distinct from v_row #>> '{expected_review,rule_version}'
      or public.admin_product_review_sha256_json(jsonb_build_object(
        'evidence_snapshot', coalesce(v_review.evidence_snapshot, 'null'::jsonb),
        'rule_version', v_review.rule_version
      )) is distinct from v_row ->> 'evidence_version_expected'
    then
      raise exception 'review_import_stale_review_queue' using errcode = '23514';
    end if;

    if v_candidate.review_status::text in ('approved', 'promoted', 'rejected')
      or v_review.status in ('approved', 'rejected')
    then
      raise exception 'review_import_row_already_processed' using errcode = '23514';
    end if;

    v_existing_product_id := nullif(
      v_row ->> 'existing_product_match_id',
      ''
    )::uuid;

    if v_existing_product_id is not null then
      select * into v_product
      from public.products
      where id = v_existing_product_id
      for share;

      if not found then
        raise exception 'review_import_existing_product_not_found' using errcode = 'P0002';
      end if;

      if v_decision = 'approve' and (
        v_product.normalized_brand is distinct from v_row ->> 'normalized_brand'
        or v_product.normalized_name is distinct from v_row ->> 'normalized_name'
      ) then
        raise exception 'review_import_existing_product_identity_conflict' using errcode = '23514';
      end if;
    elsif v_decision = 'approve' and exists (
      select 1
      from public.products as product
      where product.normalized_brand = v_row ->> 'normalized_brand'
        and product.normalized_name = v_row ->> 'normalized_name'
    ) then
      raise exception 'review_import_existing_product_match_required' using errcode = '23514';
    end if;

    if v_decision = 'approve' then
      if public.normalize_brand_key(v_row ->> 'canonical_brand')
          is distinct from v_row ->> 'normalized_brand'
        or public.normalize_product_key(v_row ->> 'canonical_name')
          is distinct from v_row ->> 'normalized_name'
      then
        raise exception 'review_import_normalization_contract_mismatch'
          using errcode = '23514';
      end if;

      if nullif(btrim(coalesce(v_row ->> 'canonical_brand', '')), '') is null
        or nullif(btrim(coalesce(v_row ->> 'canonical_name', '')), '') is null
        or v_row ->> 'canonical_category' not in (
          'cleanser', 'toner_essence', 'toner_pad', 'treatment',
          'moisturizer', 'moisturizer_lotion_emulsion',
          'moisturizer_gel', 'moisturizer_cream', 'moisturizer_balm',
          'sunscreen'
        )
        or jsonb_typeof(v_row -> 'skin_types') <> 'array'
        or jsonb_array_length(v_row -> 'skin_types') = 0
        or exists (
          select 1
          from jsonb_array_elements_text(v_row -> 'skin_types') as item(value)
          where item.value not in ('oily', 'dry', 'combination', 'sensitive')
        )
        or (
          select count(distinct item.value)
          from jsonb_array_elements_text(v_row -> 'skin_types') as item(value)
        ) <> jsonb_array_length(v_row -> 'skin_types')
        or jsonb_typeof(v_row -> 'concerns') <> 'array'
        or jsonb_array_length(v_row -> 'concerns') = 0
        or exists (
          select 1
          from jsonb_array_elements_text(v_row -> 'concerns') as item(value)
          where item.value not in (
            'oiliness', 'dehydration', 'acne', 'uneven_tone',
            'pores', 'redness', 'barrier'
          )
        )
        or (
          select count(distinct item.value)
          from jsonb_array_elements_text(v_row -> 'concerns') as item(value)
        ) <> jsonb_array_length(v_row -> 'concerns')
        or v_row ->> 'texture' not in ('watery', 'gel', 'lotion', 'cream')
        or v_row ->> 'finish' not in ('fresh', 'natural', 'dewy', 'soft_matte')
        or v_row ->> 'irritation_risk' not in ('low', 'medium', 'high')
        or jsonb_typeof(v_row -> 'sensitivity_safe') <> 'boolean'
        or v_row ->> 'review_confidence' not in ('low', 'medium', 'high')
        or coalesce(v_row ->> 'reviewed_at', '') !~
          '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$'
        or jsonb_typeof(v_row -> 'review_source_urls') <> 'array'
        or jsonb_array_length(v_row -> 'review_source_urls') = 0
        or exists (
          select 1
          from jsonb_array_elements_text(v_row -> 'review_source_urls') as item(value)
          where item.value !~ '^https://'
        )
        or v_row ->> 'official_product_page_status' <> 'verified'
        or v_row ->> 'ingredient_list_status' <> 'verified'
        or v_row ->> 'duplicate_check_status' not in ('checked_no_match', 'checked_match')
        or (
          (v_row ->> 'duplicate_check_status') = 'checked_match'
          and v_existing_product_id is null
        )
        or (
          (v_row ->> 'duplicate_check_status') = 'checked_no_match'
          and v_existing_product_id is not null
        )
        or jsonb_typeof(v_row -> 'field_evidence') <> 'object'
        or jsonb_typeof(v_row -> 'field_confidence') <> 'object'
        or exists (
          select 1
          from (
            values
              ('canonical_brand'),
              ('canonical_name'),
              ('canonical_category'),
              ('skin_types'),
              ('concerns'),
              ('texture'),
              ('finish'),
              ('irritation_risk'),
              ('sensitivity_safe')
          ) as required(field_name)
          where nullif(
              v_row #>> array['field_evidence', required.field_name, 'source_url'],
              ''
            ) is null
            or not exists (
              select 1
              from jsonb_array_elements_text(
                v_row -> 'review_source_urls'
              ) as source(value)
              where source.value =
                v_row #>> array[
                  'field_evidence',
                  required.field_name,
                  'source_url'
                ]
            )
            or v_row #>> array['field_confidence', required.field_name]
              not in ('low', 'medium', 'high')
        )
        or (
          (v_row ->> 'canonical_category') = 'treatment'
          and (
            nullif(v_row #>> '{field_evidence,product_form,source_url}', '')
              is null
            or not exists (
              select 1
              from jsonb_array_elements_text(
                v_row -> 'review_source_urls'
              ) as source(value)
              where source.value =
                v_row #>> '{field_evidence,product_form,source_url}'
            )
            or v_row #>> '{field_confidence,product_form}'
              not in ('low', 'medium', 'high')
          )
        )
        or jsonb_typeof(v_row -> 'contradictions') <> 'array'
        or exists (
          select 1
          from jsonb_array_elements(v_row -> 'contradictions') as item(value)
          where jsonb_typeof(item.value) <> 'object'
            or coalesce(item.value ->> 'status', 'unresolved')
              not in ('resolved', 'dismissed')
        )
      then
        raise exception 'review_import_approve_payload_invalid' using errcode = '23514';
      end if;

      if (v_row ->> 'canonical_category') = 'treatment' then
        if v_row ->> 'product_form' not in (
          'serum', 'ampoule', 'essence', 'booster', 'peeling_solution'
        ) then
          raise exception 'review_import_product_form_invalid' using errcode = '23514';
        end if;
      elsif nullif(v_row ->> 'product_form', '') is not null then
        raise exception 'review_import_product_form_invalid' using errcode = '23514';
      end if;

      update public.product_candidates
      set canonical_brand = v_row ->> 'canonical_brand',
          canonical_name = v_row ->> 'canonical_name',
          normalized_brand = v_row ->> 'normalized_brand',
          normalized_name = v_row ->> 'normalized_name',
          service_category = (v_row ->> 'canonical_category')::public.product_category,
          product_form = nullif(v_row ->> 'product_form', '')::public.product_form,
          matched_product_id = v_existing_product_id,
          duplicate_of_product_id = v_existing_product_id,
          promotion_payload = coalesce(promotion_payload, '{}'::jsonb) ||
            jsonb_build_object(
              'product', jsonb_build_object(
                'skin_types', v_row -> 'skin_types',
                'concerns', v_row -> 'concerns',
                'texture', v_row ->> 'texture',
                'finish', v_row ->> 'finish',
                'irritation_risk', v_row ->> 'irritation_risk',
                'sensitivity_safe', v_row -> 'sensitivity_safe'
              ),
              'review_import', jsonb_build_object(
                'schema_version', 'product-review-import-confirm-v1',
                'export_batch_id', v_export_batch_id,
                'reviewed_at', v_row ->> 'reviewed_at',
                'review_confidence', v_row ->> 'review_confidence',
                'review_source_urls', v_row -> 'review_source_urls',
                'official_product_page_status', v_row ->> 'official_product_page_status',
                'ingredient_list_status', v_row ->> 'ingredient_list_status',
                'duplicate_check_status', v_row ->> 'duplicate_check_status',
                'field_evidence', v_row -> 'field_evidence',
                'field_confidence', v_row -> 'field_confidence',
                'contradictions', v_row -> 'contradictions'
              )
            ),
          review_status = 'approved'::public.product_review_status,
          reviewed_at = now(),
          reviewed_by = p_actor_user_id::text,
          review_notes = trim(both from concat_ws(
            E'\n', nullif(review_notes, ''), 'Reviewed import approved: ' || v_reason
          )),
          updated_at = now()
      where id = v_candidate_id;

      v_promotion_result := public.promote_product_candidate(
        v_candidate_id,
        p_actor_user_id::text
      );
      v_promotion_action := v_promotion_result ->> 'action';

      if v_promotion_action not in ('inserted', 'merged') then
        raise exception 'review_import_promotion_failed' using errcode = '23514';
      end if;

      v_product_id := nullif(v_promotion_result ->> 'product_id', '')::uuid;

      update public.candidate_promotion_reviews
      set status = 'approved',
          reviewed_at = now(),
          review_note = v_reason,
          approved_product_id = v_product_id,
          updated_at = now()
      where candidate_id = v_candidate_id;

      if v_promotion_action = 'inserted' then
        v_create_count := v_create_count + 1;
      else
        v_merge_count := v_merge_count + 1;
      end if;
    elsif v_decision = 'defer' then
      if v_reason not in (
        'missing_official_source', 'missing_ingredient_evidence',
        'identity_unresolved', 'category_unresolved',
        'contradiction_unresolved', 'needs_manual_research'
      ) then
        raise exception 'review_import_defer_reason_invalid' using errcode = '23514';
      end if;

      update public.product_candidates
      set review_status = 'needs_review'::public.product_review_status,
          reviewed_at = now(),
          reviewed_by = p_actor_user_id::text,
          review_notes = trim(both from concat_ws(
            E'\n', nullif(review_notes, ''), 'Reviewed import deferred: ' || v_reason
          )),
          updated_at = now()
      where id = v_candidate_id;

      update public.candidate_promotion_reviews
      set status = 'deferred',
          reviewed_at = now(),
          review_note = v_reason,
          approved_product_id = null,
          updated_at = now()
      where candidate_id = v_candidate_id;

      v_promotion_action := 'none';
      v_product_id := null;
      v_defer_count := v_defer_count + 1;
    else
      if v_reason not in (
        'duplicate_product', 'invalid_identity', 'out_of_scope',
        'unsafe_source', 'source_removed'
      ) then
        raise exception 'review_import_block_reason_invalid' using errcode = '23514';
      end if;

      if v_reason = 'duplicate_product' and v_existing_product_id is null then
        raise exception 'review_import_duplicate_evidence_required' using errcode = '23514';
      end if;

      update public.product_candidates
      set review_status = 'rejected'::public.product_review_status,
          duplicate_of_product_id = case
            when v_reason = 'duplicate_product' then v_existing_product_id
            else duplicate_of_product_id
          end,
          reviewed_at = now(),
          reviewed_by = p_actor_user_id::text,
          review_notes = trim(both from concat_ws(
            E'\n', nullif(review_notes, ''), 'Reviewed import blocked: ' || v_reason
          )),
          updated_at = now()
      where id = v_candidate_id;

      update public.candidate_promotion_reviews
      set status = 'rejected',
          reviewed_at = now(),
          review_note = v_reason,
          approved_product_id = null,
          updated_at = now()
      where candidate_id = v_candidate_id;

      v_promotion_action := 'none';
      v_product_id := null;
      v_block_count := v_block_count + 1;
    end if;

    select * into strict v_candidate
    from public.product_candidates
    where id = v_candidate_id;

    select * into strict v_review
    from public.candidate_promotion_reviews
    where candidate_id = v_candidate_id;

    v_before := jsonb_build_object(
      'candidate_review_status', v_row #>> '{expected_candidate,review_status}',
      'queue_status', v_row #>> '{expected_review,status}',
      'matched_product_id', v_row #>> '{expected_candidate,matched_product_id}',
      'duplicate_of_product_id', v_row #>> '{expected_candidate,duplicate_of_product_id}'
    );
    v_after := jsonb_build_object(
      'candidate_review_status', v_candidate.review_status,
      'queue_status', v_review.status,
      'product_id', v_product_id,
      'promotion_action', v_promotion_action
    );

    v_audit_id := public.record_admin_audit_event(
      p_actor_user_id,
      'admin.products.review',
      'admin.product_review_import.confirmed',
      'product_candidate',
      v_candidate_id::text,
      v_before,
      v_after,
      v_reason,
      left(v_request_id, 120) || ':' || v_candidate_id::text,
      jsonb_build_object(
        'export_batch_id', v_export_batch_id,
        'decision', v_decision,
        'promotion_action', v_promotion_action,
        'product_id', v_product_id,
        'row_number', (v_row ->> 'row_number')::integer
      )
    );

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'candidate_id', v_candidate_id,
      'decision', v_decision,
      'candidate_review_status', v_candidate.review_status,
      'queue_status', v_review.status,
      'promotion_action', v_promotion_action,
      'product_id', v_product_id,
      'audit_id', v_audit_id
    ));
  end loop;

  v_result := jsonb_build_object(
    'status', 'confirmed',
    'request_id', v_request_id,
    'export_batch_id', v_export_batch_id,
    'actor_role', v_actor_role,
    'total_rows', v_row_count,
    'approve_create_new', v_create_count,
    'approve_merge_existing', v_merge_count,
    'defer', v_defer_count,
    'block', v_block_count,
    'rows', v_results
  );

  insert into public.admin_product_review_import_confirmations (
    request_id,
    export_batch_id,
    actor_user_id,
    payload_hash,
    source_snapshot_version,
    candidate_ids_sha256,
    candidate_count,
    result,
    confirmed_at
  ) values (
    v_request_id,
    v_export_batch_id,
    p_actor_user_id,
    v_payload_hash,
    v_source_snapshot_version,
    v_candidate_ids_sha256,
    v_row_count,
    v_result,
    now()
  );

  return v_result;
end;
$$;

revoke all on function public.admin_product_review_canonical_json(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_product_review_sha256_json(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_get_product_review_import_confirmation(
  uuid, text, uuid, text
) from public, anon, authenticated;
grant execute on function public.admin_get_product_review_import_confirmation(
  uuid, text, uuid, text
) to service_role;
revoke all on function public.admin_confirm_product_review_import_batch(
  uuid, text, jsonb, text
) from public, anon, authenticated;
grant execute on function public.admin_confirm_product_review_import_batch(
  uuid, text, jsonb, text
) to service_role;

comment on table public.admin_product_review_import_confirmations is
  'Service-role-only idempotency ledger for atomic reviewed import batch confirmations.';
comment on function public.admin_get_product_review_import_confirmation(
  uuid, text, uuid, text
) is
  'Returns an exact prior reviewed import confirmation so CLI retries remain idempotent after source rows become final.';
comment on function public.admin_confirm_product_review_import_batch(
  uuid, text, jsonb, text
) is
  'Revalidates and confirms one reviewed import batch atomically, reusing promote_product_candidate for approvals.';

do $$
begin
  if has_function_privilege(
    'anon',
    'public.admin_confirm_product_review_import_batch(uuid,text,jsonb,text)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.admin_confirm_product_review_import_batch(uuid,text,jsonb,text)',
    'EXECUTE'
  ) then
    raise exception 'review_import_confirm_rpc_exposed_to_browser_role';
  end if;

  if has_function_privilege(
    'anon',
    'public.admin_get_product_review_import_confirmation(uuid,text,uuid,text)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.admin_get_product_review_import_confirmation(uuid,text,uuid,text)',
    'EXECUTE'
  ) then
    raise exception 'review_import_confirmation_lookup_rpc_exposed_to_browser_role';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.admin_confirm_product_review_import_batch(uuid,text,jsonb,text)',
    'EXECUTE'
  ) then
    raise exception 'review_import_confirm_rpc_missing_service_role_grant';
  end if;

  if has_table_privilege(
    'service_role',
    'public.admin_product_review_import_confirmations',
    'INSERT'
  ) then
    raise exception 'review_import_confirmation_ledger_direct_write_exposed';
  end if;
end $$;

commit;
