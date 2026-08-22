begin;

-- CRAWLER-CANONICAL-ADOPTION-AUTHORITY-REMEDIATION v1
-- Catalog existence is structural authority only. Recommendation truth is governed elsewhere.

alter table public.products alter column skin_types drop not null;
alter table public.products alter column concerns drop not null;
alter table public.products alter column texture drop not null;
alter table public.products alter column finish drop not null;
alter table public.products alter column irritation_risk drop not null;
alter table public.products alter column sensitivity_safe drop not null;

comment on column public.products.skin_types is 'Legacy Recommendation semantic field. NULL = not established for a non-legacy structural adoption.';
comment on column public.products.concerns is 'Legacy Recommendation semantic field. NULL = not established for a non-legacy structural adoption.';
comment on column public.products.texture is 'Legacy Recommendation semantic field. NULL = not established for a non-legacy structural adoption.';
comment on column public.products.finish is 'Legacy Recommendation semantic field. NULL = not established for a non-legacy structural adoption.';
comment on column public.products.irritation_risk is 'Legacy Recommendation semantic field. NULL = not established for a non-legacy structural adoption.';
comment on column public.products.sensitivity_safe is 'Legacy Recommendation semantic field. NULL = not established for a non-legacy structural adoption.';

alter table public.product_candidates
  add column if not exists identity_resolution_state text not null default 'unresolved',
  add column if not exists identity_resolution_version text not null default 'crawler-identity-resolution-v1',
  add column if not exists identity_resolution_evidence jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.product_candidates'::regclass
      and conname = 'product_candidates_identity_resolution_state_check'
  ) then
    alter table public.product_candidates
      add constraint product_candidates_identity_resolution_state_check
      check (identity_resolution_state in (
        'unresolved', 'resolved', 'identity_ambiguous',
        'variant_scope_conflict', 'formulation_scope_conflict',
        'reformulation_candidate'
      ));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.product_candidates'::regclass
      and conname = 'product_candidates_identity_resolution_version_check'
  ) then
    alter table public.product_candidates
      add constraint product_candidates_identity_resolution_version_check
      check (identity_resolution_version = 'crawler-identity-resolution-v1');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.product_candidates'::regclass
      and conname = 'product_candidates_identity_resolution_evidence_object_check'
  ) then
    alter table public.product_candidates
      add constraint product_candidates_identity_resolution_evidence_object_check
      check (
        jsonb_typeof(identity_resolution_evidence) = 'object'
        and octet_length(identity_resolution_evidence::text) <= 32768
      );
  end if;
end;
$$;

comment on column public.product_candidates.identity_resolution_state is 'crawler-identity-resolution-v1; only resolved may structurally promote.';
comment on column public.product_candidates.identity_resolution_evidence is 'Auditable source/raw identity evidence; normalized comparison keys are not authoritative identity.';

create or replace function public.crawler_canonical_structural_adoption_contract_v1()
returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'version', 'crawler-canonical-product-structural-adoption-v1',
    'identity_resolution_version', 'crawler-identity-resolution-v1',
    'structural_product_fields', jsonb_build_array(
      'id', 'name', 'brand', 'category', 'product_form',
      'normalized_name', 'normalized_brand',
      'external_source', 'external_type', 'external_id', 'source_url',
      'created_at', 'updated_at'
    ),
    'recommendation_semantic_denylist', jsonb_build_array(
      'skin_types', 'concerns', 'texture', 'finish',
      'irritation_risk', 'sensitivity_safe'
    ),
    'missing_semantic_representation', 'NULL',
    'promotable_identity_state', 'resolved',
    'non_promotable_identity_states', jsonb_build_array(
      'unresolved', 'identity_ambiguous', 'variant_scope_conflict',
      'formulation_scope_conflict', 'reformulation_candidate'
    )
  );
$$;

revoke all on function public.crawler_canonical_structural_adoption_contract_v1() from public, anon, authenticated;
grant execute on function public.crawler_canonical_structural_adoption_contract_v1() to service_role;

create or replace function public.admin_set_product_candidate_identity_resolution_v1(
  p_actor_user_id uuid,
  p_candidate_id uuid,
  p_state text,
  p_evidence jsonb,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_role text;
  v_candidate public.product_candidates%rowtype;
  v_state text := lower(btrim(coalesce(p_state, '')));
  v_reason text := btrim(coalesce(p_reason, ''));
  v_evidence jsonb;
  v_audit_id uuid;
begin
  v_actor_role := public.admin_require_product_review_actor(p_actor_user_id, 'admin.products.review');

  if p_candidate_id is null
    or v_state not in (
      'unresolved', 'resolved', 'identity_ambiguous',
      'variant_scope_conflict', 'formulation_scope_conflict',
      'reformulation_candidate'
    )
    or char_length(v_reason) not between 3 and 1000
    or p_evidence is null
    or jsonb_typeof(p_evidence) <> 'object'
    or octet_length(p_evidence::text) > 16384
  then
    raise exception 'crawler_identity_resolution_payload_invalid' using errcode = '22023';
  end if;

  select * into v_candidate
  from public.product_candidates
  where id = p_candidate_id
  for update;

  if not found then
    raise exception 'crawler_identity_resolution_candidate_not_found' using errcode = 'P0002';
  end if;
  if v_candidate.review_status = 'promoted'::public.product_review_status then
    raise exception 'crawler_identity_resolution_promoted_candidate_immutable' using errcode = '23514';
  end if;

  v_evidence := p_evidence || jsonb_strip_nulls(jsonb_build_object(
    'reason_code', v_reason,
    'source_name', v_candidate.source_name,
    'source_url', v_candidate.source_url,
    'external_type', v_candidate.external_type,
    'external_id', v_candidate.external_id,
    'raw_brand', v_candidate.brand_name_raw,
    'raw_name', v_candidate.product_name_raw,
    'comparison_normalized_brand', v_candidate.normalized_brand,
    'comparison_normalized_name', v_candidate.normalized_name,
    'reviewed_at', now()
  ));

  update public.product_candidates
  set identity_resolution_state = v_state,
      identity_resolution_version = 'crawler-identity-resolution-v1',
      identity_resolution_evidence = v_evidence,
      review_flags = case
        when v_state = 'resolved'
          then array_remove(coalesce(review_flags, '{}'::text[]), 'identity_unresolved')
        else public.merge_text_flags(coalesce(review_flags, '{}'::text[]), array[v_state])
      end,
      reviewed_by = p_actor_user_id::text,
      reviewed_at = now(),
      updated_at = now()
  where id = p_candidate_id;

  v_audit_id := public.record_admin_audit_event(
    p_actor_user_id,
    'admin.products.review',
    'admin.product_candidate.identity_resolution_recorded',
    'product_candidate',
    p_candidate_id::text,
    jsonb_build_object(
      'identity_resolution_state', v_candidate.identity_resolution_state,
      'identity_resolution_version', v_candidate.identity_resolution_version
    ),
    jsonb_build_object(
      'identity_resolution_state', v_state,
      'identity_resolution_version', 'crawler-identity-resolution-v1'
    ),
    v_reason,
    'crawler-identity-resolution:' || p_candidate_id::text || ':' || md5(clock_timestamp()::text),
    jsonb_build_object('evidence', v_evidence)
  );

  return jsonb_build_object(
    'status', 'recorded',
    'candidate_id', p_candidate_id,
    'identity_resolution_state', v_state,
    'identity_resolution_version', 'crawler-identity-resolution-v1',
    'actor_role', v_actor_role,
    'audit_id', v_audit_id
  );
end;
$$;

revoke all on function public.admin_set_product_candidate_identity_resolution_v1(uuid, uuid, text, jsonb, text)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_set_product_candidate_identity_resolution_v1(uuid, uuid, text, jsonb, text)
  to service_role;

create or replace function public.promote_product_candidate_structural_v1(
  p_candidate_id uuid,
  p_actor text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_candidate public.product_candidates%rowtype;
  v_target public.products%rowtype;
  v_target_id uuid;
  v_action text;
  v_normalized_name text;
  v_normalized_brand text;
  v_actor text := nullif(btrim(coalesce(p_actor, '')), '');
  v_flags text[] := '{}'::text[];
  v_match_count integer := 0;
  v_exact_source_match_count integer := 0;
begin
  select * into v_candidate
  from public.product_candidates
  where id = p_candidate_id
  for update;

  if not found then
    raise exception 'Candidate % not found', p_candidate_id;
  end if;

  if v_candidate.review_status = 'promoted'::public.product_review_status then
    return jsonb_build_object(
      'candidate_id', v_candidate.id,
      'product_id', v_candidate.matched_product_id,
      'action', 'already_promoted',
      'review_status', v_candidate.review_status::text,
      'contract_version', 'crawler-canonical-product-structural-adoption-v1'
    );
  end if;

  if v_candidate.review_status <> 'approved'::public.product_review_status then
    raise exception 'Candidate % must be approved before promotion. Current status: %',
      p_candidate_id, v_candidate.review_status::text;
  end if;

  if v_candidate.identity_resolution_state is distinct from 'resolved'
    or v_candidate.identity_resolution_version is distinct from 'crawler-identity-resolution-v1'
  then
    v_flags := array_append(v_flags, coalesce(v_candidate.identity_resolution_state, 'unresolved'));
  end if;
  if nullif(btrim(coalesce(v_candidate.canonical_name, '')), '') is null then
    v_flags := array_append(v_flags, 'missing_canonical_name');
  end if;
  if nullif(btrim(coalesce(v_candidate.canonical_brand, '')), '') is null then
    v_flags := array_append(v_flags, 'missing_canonical_brand');
  end if;
  if v_candidate.service_category is null then
    v_flags := array_append(v_flags, 'ambiguous_category');
  elsif v_candidate.service_category in (
    'serum'::public.product_category,
    'ampoule'::public.product_category,
    'essence'::public.product_category
  ) then
    v_flags := array_append(v_flags, 'legacy_service_category');
  elsif v_candidate.service_category = 'treatment'::public.product_category then
    if v_candidate.product_form is null then
      v_flags := array_append(v_flags, 'missing_product_form');
    elsif v_candidate.product_form not in (
      'serum'::public.product_form,
      'ampoule'::public.product_form,
      'essence'::public.product_form,
      'booster'::public.product_form,
      'peeling_solution'::public.product_form
    ) then
      v_flags := array_append(v_flags, 'invalid_product_form');
    end if;
  elsif v_candidate.product_form is not null then
    v_flags := array_append(v_flags, 'unexpected_product_form');
  end if;

  if coalesce(array_length(v_flags, 1), 0) > 0 then
    update public.product_candidates
    set review_status = 'needs_review'::public.product_review_status,
        review_flags = public.merge_text_flags(coalesce(review_flags, '{}'::text[]), v_flags),
        review_notes = trim(both from concat_ws(
          E'\n', nullif(review_notes, ''),
          'Structural promotion blocked: ' || array_to_string(v_flags, ', ')
        )),
        reviewed_by = coalesce(v_actor, reviewed_by),
        reviewed_at = now(),
        updated_at = now()
    where id = v_candidate.id;

    return jsonb_build_object(
      'candidate_id', v_candidate.id,
      'action', 'blocked',
      'review_status', 'needs_review',
      'missing_flags', to_jsonb(v_flags),
      'contract_version', 'crawler-canonical-product-structural-adoption-v1'
    );
  end if;

  v_normalized_name := public.normalize_product_key(v_candidate.canonical_name);
  v_normalized_brand := public.normalize_brand_key(v_candidate.canonical_brand);
  if nullif(v_normalized_name, '') is null or nullif(v_normalized_brand, '') is null then
    raise exception 'crawler_structural_promotion_normalization_invalid' using errcode = '23514';
  end if;

  if v_candidate.duplicate_of_product_id is not null
    and v_candidate.matched_product_id is not null
    and v_candidate.duplicate_of_product_id <> v_candidate.matched_product_id
  then
    v_flags := array['identity_ambiguous'];
  else
    v_target_id := coalesce(v_candidate.duplicate_of_product_id, v_candidate.matched_product_id);
  end if;

  if v_target_id is not null then
    select * into v_target from public.products where id = v_target_id for update;
    if not found
      or v_target.normalized_name is distinct from v_normalized_name
      or v_target.normalized_brand is distinct from v_normalized_brand
    then
      v_flags := public.merge_text_flags(v_flags, array['identity_ambiguous']);
      v_target_id := null;
    end if;
  end if;

  if coalesce(array_length(v_flags, 1), 0) = 0
    and v_target_id is null
    and nullif(v_candidate.source_name, '') is not null
    and nullif(v_candidate.external_type, '') is not null
    and nullif(v_candidate.external_id, '') is not null
  then
    select count(*)::integer into v_exact_source_match_count
    from public.products
    where external_source = v_candidate.source_name
      and external_type = v_candidate.external_type
      and external_id = v_candidate.external_id;

    if v_exact_source_match_count > 1 then
      v_flags := public.merge_text_flags(v_flags, array['identity_ambiguous']);
    elsif v_exact_source_match_count = 1 then
      select * into v_target
      from public.products
      where external_source = v_candidate.source_name
        and external_type = v_candidate.external_type
        and external_id = v_candidate.external_id
      order by id
      limit 1
      for update;
      v_target_id := v_target.id;
      if v_target.normalized_name is distinct from v_normalized_name
        or v_target.normalized_brand is distinct from v_normalized_brand
      then
        v_flags := public.merge_text_flags(v_flags, array['identity_ambiguous']);
        v_target_id := null;
      end if;
    end if;
  end if;

  if coalesce(array_length(v_flags, 1), 0) = 0 and v_target_id is null then
    select count(*)::integer into v_match_count
    from public.products
    where normalized_name = v_normalized_name
      and normalized_brand = v_normalized_brand;
    if v_match_count > 0 then
      v_flags := public.merge_text_flags(v_flags, array['identity_ambiguous']);
    end if;
  end if;

  if coalesce(array_length(v_flags, 1), 0) > 0 then
    update public.product_candidates
    set identity_resolution_state = 'identity_ambiguous',
        identity_resolution_version = 'crawler-identity-resolution-v1',
        identity_resolution_evidence = coalesce(identity_resolution_evidence, '{}'::jsonb) ||
          jsonb_build_object(
            'promotion_blocker', 'identity_collision_or_reference_conflict',
            'normalized_brand', v_normalized_brand,
            'normalized_name', v_normalized_name,
            'observed_at', now()
          ),
        review_status = 'needs_review'::public.product_review_status,
        review_flags = public.merge_text_flags(coalesce(review_flags, '{}'::text[]), v_flags),
        review_notes = trim(both from concat_ws(
          E'\n', nullif(review_notes, ''),
          'Structural promotion blocked: identity resolution required'
        )),
        reviewed_by = coalesce(v_actor, reviewed_by),
        reviewed_at = now(),
        updated_at = now()
    where id = v_candidate.id;

    return jsonb_build_object(
      'candidate_id', v_candidate.id,
      'action', 'blocked',
      'review_status', 'needs_review',
      'missing_flags', to_jsonb(v_flags),
      'identity_resolution_state', 'identity_ambiguous',
      'contract_version', 'crawler-canonical-product-structural-adoption-v1'
    );
  end if;

  if v_target_id is null then
    insert into public.products (
      name, brand, category, product_form,
      normalized_name, normalized_brand,
      external_source, external_type, external_id, source_url,
      created_at, updated_at
    ) values (
      v_candidate.canonical_name, v_candidate.canonical_brand,
      v_candidate.service_category, v_candidate.product_form,
      v_normalized_name, v_normalized_brand,
      v_candidate.source_name, v_candidate.external_type,
      v_candidate.external_id, v_candidate.source_url,
      now(), now()
    ) returning id into v_target_id;
    v_action := 'inserted';
  else
    update public.products
    set external_source = coalesce(public.products.external_source, v_candidate.source_name),
        external_type = coalesce(public.products.external_type, v_candidate.external_type),
        external_id = coalesce(public.products.external_id, v_candidate.external_id),
        source_url = coalesce(public.products.source_url, v_candidate.source_url),
        updated_at = now()
    where id = v_target_id;
    v_action := 'merged';
  end if;

  update public.product_candidates
  set matched_product_id = v_target_id,
      duplicate_of_product_id = case when v_action = 'merged' then v_target_id else null end,
      review_status = 'promoted'::public.product_review_status,
      reviewed_at = now(),
      reviewed_by = coalesce(v_actor, reviewed_by),
      promotion_version = 'crawler-canonical-product-structural-adoption-v1',
      promotion_payload = (coalesce(promotion_payload, '{}'::jsonb) - 'product') ||
        jsonb_build_object(
          'structural_adoption', jsonb_build_object(
            'contract_version', 'crawler-canonical-product-structural-adoption-v1',
            'identity_resolution_version', 'crawler-identity-resolution-v1',
            'promoted_at', now(),
            'promotion_action', v_action,
            'product_id', v_target_id
          )
        ),
      updated_at = now()
  where id = v_candidate.id;

  return jsonb_build_object(
    'candidate_id', v_candidate.id,
    'product_id', v_target_id,
    'action', v_action,
    'review_status', 'promoted',
    'contract_version', 'crawler-canonical-product-structural-adoption-v1'
  );
end;
$$;

revoke all on function public.promote_product_candidate_structural_v1(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.promote_product_candidate_structural_v1(uuid, text)
  to service_role;

-- Historical entry point remains for compatibility but delegates to the structural-only writer.
create or replace function public.promote_product_candidate(
  p_candidate_id uuid,
  p_actor text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return public.promote_product_candidate_structural_v1(p_candidate_id, p_actor);
end;
$$;

revoke all on function public.promote_product_candidate(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.promote_product_candidate(uuid, text)
  to service_role;

create table if not exists public.crawler_canonical_adoption_requests (
  request_id text primary key,
  candidate_id uuid not null references public.product_candidates(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  payload_hash text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  constraint crawler_canonical_adoption_request_id_check check (char_length(btrim(request_id)) between 8 and 120),
  constraint crawler_canonical_adoption_payload_hash_check check (payload_hash ~ '^[0-9a-f]{64}$'),
  constraint crawler_canonical_adoption_result_object_check check (jsonb_typeof(result) = 'object')
);
alter table public.crawler_canonical_adoption_requests enable row level security;
revoke all on table public.crawler_canonical_adoption_requests from public, anon, authenticated, service_role;

create or replace function public.admin_confirm_product_candidate_structural_adoption_v1(
  p_actor_user_id uuid,
  p_request_id text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_role text;
  v_request_id text := btrim(coalesce(p_request_id, ''));
  v_payload_hash text;
  v_existing public.crawler_canonical_adoption_requests%rowtype;
  v_candidate public.product_candidates%rowtype;
  v_review public.candidate_promotion_reviews%rowtype;
  v_candidate_id uuid;
  v_existing_product_id uuid;
  v_reason text;
  v_identity_evidence jsonb;
  v_normalized_brand text;
  v_normalized_name text;
  v_promotion_result jsonb;
  v_product_id uuid;
  v_audit_id uuid;
  v_result jsonb;
begin
  v_actor_role := public.admin_require_product_review_actor(p_actor_user_id, 'admin.products.review');

  if char_length(v_request_id) not between 8 and 120
    or p_payload is null
    or jsonb_typeof(p_payload) <> 'object'
    or octet_length(p_payload::text) > 65536
    or exists (
      select 1 from jsonb_object_keys(p_payload) as key(value)
      where key.value not in (
        'contract_version', 'candidate_id', 'canonical_brand', 'canonical_name',
        'canonical_category', 'product_form', 'existing_product_match_id',
        'identity_resolution_state', 'identity_resolution_version',
        'identity_resolution_evidence', 'reason'
      )
    )
    or not p_payload ?& array[
      'contract_version', 'candidate_id', 'canonical_brand', 'canonical_name',
      'canonical_category', 'product_form', 'existing_product_match_id',
      'identity_resolution_state', 'identity_resolution_version',
      'identity_resolution_evidence', 'reason'
    ]
    or p_payload ->> 'contract_version' <> 'crawler-canonical-product-structural-adoption-v1'
  then
    raise exception 'crawler_structural_adoption_payload_invalid' using errcode = '22023';
  end if;

  begin
    v_candidate_id := (p_payload ->> 'candidate_id')::uuid;
    if p_payload -> 'existing_product_match_id' <> 'null'::jsonb then
      v_existing_product_id := (p_payload ->> 'existing_product_match_id')::uuid;
    end if;
  exception when others then
    raise exception 'crawler_structural_adoption_identity_invalid' using errcode = '22023';
  end;

  v_reason := btrim(coalesce(p_payload ->> 'reason', ''));
  v_identity_evidence := p_payload -> 'identity_resolution_evidence';
  v_payload_hash := public.admin_product_review_sha256_json(p_payload);

  if char_length(v_reason) not between 3 and 1000
    or p_payload ->> 'identity_resolution_state' <> 'resolved'
    or p_payload ->> 'identity_resolution_version' <> 'crawler-identity-resolution-v1'
    or jsonb_typeof(v_identity_evidence) <> 'object'
    or octet_length(v_identity_evidence::text) > 16384
  then
    raise exception 'crawler_structural_adoption_identity_unresolved' using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('crawler-structural-adoption:' || v_request_id, 0));
  select * into v_existing
  from public.crawler_canonical_adoption_requests
  where request_id = v_request_id;
  if found then
    if v_existing.actor_user_id <> p_actor_user_id
      or v_existing.candidate_id <> v_candidate_id
      or v_existing.payload_hash <> v_payload_hash
    then
      raise exception 'crawler_structural_adoption_request_conflict' using errcode = '23505';
    end if;
    return v_existing.result || jsonb_build_object('idempotent', true);
  end if;

  select * into v_candidate
  from public.product_candidates
  where id = v_candidate_id
  for update;
  if not found then
    raise exception 'crawler_structural_adoption_candidate_not_found' using errcode = 'P0002';
  end if;

  select * into v_review
  from public.candidate_promotion_reviews
  where candidate_id = v_candidate_id
  for update;
  if not found or v_review.status not in ('queued', 'reviewing', 'deferred') then
    raise exception 'crawler_structural_adoption_review_not_actionable' using errcode = '23514';
  end if;

  if nullif(btrim(coalesce(p_payload ->> 'canonical_brand', '')), '') is null
    or nullif(btrim(coalesce(p_payload ->> 'canonical_name', '')), '') is null
    or p_payload ->> 'canonical_category' not in (
      'cleanser', 'toner_essence', 'toner_pad', 'treatment',
      'moisturizer', 'moisturizer_lotion_emulsion', 'moisturizer_gel',
      'moisturizer_cream', 'moisturizer_balm', 'sunscreen'
    )
  then
    raise exception 'crawler_structural_adoption_structural_fields_invalid' using errcode = '23514';
  end if;

  if p_payload ->> 'canonical_category' = 'treatment' then
    if p_payload ->> 'product_form' not in ('serum', 'ampoule', 'essence', 'booster', 'peeling_solution') then
      raise exception 'crawler_structural_adoption_product_form_invalid' using errcode = '23514';
    end if;
  elsif nullif(p_payload ->> 'product_form', '') is not null then
    raise exception 'crawler_structural_adoption_product_form_invalid' using errcode = '23514';
  end if;

  v_normalized_brand := public.normalize_brand_key(p_payload ->> 'canonical_brand');
  v_normalized_name := public.normalize_product_key(p_payload ->> 'canonical_name');
  if nullif(v_normalized_brand, '') is null or nullif(v_normalized_name, '') is null then
    raise exception 'crawler_structural_adoption_normalization_invalid' using errcode = '23514';
  end if;

  if v_existing_product_id is not null and not exists (
    select 1 from public.products
    where id = v_existing_product_id
      and normalized_brand = v_normalized_brand
      and normalized_name = v_normalized_name
  ) then
    raise exception 'crawler_structural_adoption_existing_product_conflict' using errcode = '23514';
  end if;

  update public.product_candidates
  set canonical_brand = p_payload ->> 'canonical_brand',
      canonical_name = p_payload ->> 'canonical_name',
      normalized_brand = v_normalized_brand,
      normalized_name = v_normalized_name,
      service_category = (p_payload ->> 'canonical_category')::public.product_category,
      product_form = nullif(p_payload ->> 'product_form', '')::public.product_form,
      matched_product_id = v_existing_product_id,
      duplicate_of_product_id = v_existing_product_id,
      identity_resolution_state = 'resolved',
      identity_resolution_version = 'crawler-identity-resolution-v1',
      identity_resolution_evidence = v_identity_evidence || jsonb_strip_nulls(jsonb_build_object(
        'reason_code', v_reason,
        'source_name', source_name,
        'source_url', source_url,
        'external_type', external_type,
        'external_id', external_id,
        'raw_brand', brand_name_raw,
        'raw_name', product_name_raw,
        'comparison_normalized_brand', v_normalized_brand,
        'comparison_normalized_name', v_normalized_name,
        'reviewed_at', now()
      )),
      promotion_payload = (coalesce(promotion_payload, '{}'::jsonb) - 'product') ||
        jsonb_build_object('structural_review', jsonb_build_object(
          'contract_version', 'crawler-canonical-product-structural-adoption-v1',
          'reviewed_at', now(),
          'reviewed_by', p_actor_user_id,
          'reason_code', v_reason
        )),
      review_status = 'approved'::public.product_review_status,
      reviewed_by = p_actor_user_id::text,
      reviewed_at = now(),
      review_notes = trim(both from concat_ws(E'\n', nullif(review_notes, ''), 'Structural adoption approved: ' || v_reason)),
      updated_at = now()
  where id = v_candidate_id;

  v_promotion_result := public.promote_product_candidate_structural_v1(v_candidate_id, p_actor_user_id::text);

  if v_promotion_result ->> 'action' not in ('inserted', 'merged') then
    update public.candidate_promotion_reviews
    set status = 'deferred',
        reviewed_at = now(),
        review_note = 'identity resolution blocked during structural promotion',
        approved_product_id = null,
        updated_at = now()
    where candidate_id = v_candidate_id;

    v_result := jsonb_build_object(
      'status', 'blocked', 'idempotent', false,
      'request_id', v_request_id, 'candidate_id', v_candidate_id,
      'actor_role', v_actor_role, 'promotion', v_promotion_result
    );
  else
    v_product_id := nullif(v_promotion_result ->> 'product_id', '')::uuid;
    update public.candidate_promotion_reviews
    set status = 'approved', reviewed_at = now(), review_note = v_reason,
        approved_product_id = v_product_id, updated_at = now()
    where candidate_id = v_candidate_id;

    v_audit_id := public.record_admin_audit_event(
      p_actor_user_id,
      'admin.products.review',
      'admin.product_candidate.structural_adoption_confirmed',
      'product_candidate',
      v_candidate_id::text,
      jsonb_build_object(
        'candidate_review_status', v_candidate.review_status,
        'queue_status', v_review.status,
        'identity_resolution_state', v_candidate.identity_resolution_state
      ),
      jsonb_build_object(
        'candidate_review_status', 'promoted',
        'queue_status', 'approved',
        'identity_resolution_state', 'resolved',
        'product_id', v_product_id,
        'promotion_action', v_promotion_result ->> 'action'
      ),
      v_reason,
      v_request_id,
      jsonb_build_object(
        'contract_version', 'crawler-canonical-product-structural-adoption-v1',
        'identity_resolution_version', 'crawler-identity-resolution-v1'
      )
    );

    v_result := jsonb_build_object(
      'status', 'confirmed', 'idempotent', false,
      'request_id', v_request_id, 'candidate_id', v_candidate_id,
      'actor_role', v_actor_role, 'product_id', v_product_id,
      'promotion_action', v_promotion_result ->> 'action',
      'audit_id', v_audit_id,
      'contract_version', 'crawler-canonical-product-structural-adoption-v1'
    );
  end if;

  insert into public.crawler_canonical_adoption_requests(
    request_id, candidate_id, actor_user_id, payload_hash, result, created_at
  ) values (
    v_request_id, v_candidate_id, p_actor_user_id, v_payload_hash, v_result, now()
  );
  return v_result;
end;
$$;

revoke all on function public.admin_confirm_product_candidate_structural_adoption_v1(uuid, text, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_confirm_product_candidate_structural_adoption_v1(uuid, text, jsonb)
  to service_role;

-- Exposed admin preflight is structural-only. Historical unsafe helpers remain read-only artifacts.
create or replace function public.admin_preflight_product_candidate_review(
  p_actor_user_id uuid,
  p_candidate_id uuid,
  p_decision text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_role text;
  v_candidate public.product_candidates%rowtype;
  v_review public.candidate_promotion_reviews%rowtype;
  v_decision text := lower(btrim(coalesce(p_decision, '')));
  v_reason text := btrim(coalesce(p_reason, ''));
  v_issues text[] := '{}'::text[];
  v_normalized_brand text;
  v_normalized_name text;
  v_target_id uuid;
  v_match_count integer := 0;
  v_status text;
begin
  v_actor_role := public.admin_require_product_review_actor(p_actor_user_id, 'admin.products.review');

  select * into v_candidate from public.product_candidates where id = p_candidate_id;
  if not found then raise exception 'admin_product_review_candidate_not_found' using errcode = 'P0002'; end if;
  select * into v_review from public.candidate_promotion_reviews where candidate_id = p_candidate_id;
  if not found then raise exception 'admin_product_review_queue_not_found' using errcode = 'P0002'; end if;

  if v_decision not in ('approve', 'defer', 'block') then v_issues := array_append(v_issues, 'invalid_decision'); end if;
  if char_length(v_reason) not between 3 and 1000 then v_issues := array_append(v_issues, 'reason_required'); end if;
  if v_review.status not in ('queued', 'reviewing', 'deferred') then v_issues := array_append(v_issues, 'review_queue_not_actionable'); end if;

  if v_decision = 'approve' then
    if v_candidate.identity_resolution_state is distinct from 'resolved'
      or v_candidate.identity_resolution_version is distinct from 'crawler-identity-resolution-v1'
    then v_issues := array_append(v_issues, 'identity_unresolved'); end if;
    if nullif(btrim(coalesce(v_candidate.canonical_brand, '')), '') is null then v_issues := array_append(v_issues, 'missing_canonical_brand'); end if;
    if nullif(btrim(coalesce(v_candidate.canonical_name, '')), '') is null then v_issues := array_append(v_issues, 'missing_canonical_name'); end if;
    if v_candidate.service_category is null then
      v_issues := array_append(v_issues, 'ambiguous_category');
    elsif v_candidate.service_category = 'treatment'::public.product_category and v_candidate.product_form is null then
      v_issues := array_append(v_issues, 'missing_product_form');
    elsif v_candidate.service_category <> 'treatment'::public.product_category and v_candidate.product_form is not null then
      v_issues := array_append(v_issues, 'unexpected_product_form');
    end if;

    if nullif(v_candidate.canonical_brand, '') is not null and nullif(v_candidate.canonical_name, '') is not null then
      v_normalized_brand := public.normalize_brand_key(v_candidate.canonical_brand);
      v_normalized_name := public.normalize_product_key(v_candidate.canonical_name);
    end if;

    if v_candidate.duplicate_of_product_id is not null
      and v_candidate.matched_product_id is not null
      and v_candidate.duplicate_of_product_id <> v_candidate.matched_product_id
    then
      v_issues := array_append(v_issues, 'conflicting_product_references');
    else
      v_target_id := coalesce(v_candidate.duplicate_of_product_id, v_candidate.matched_product_id);
    end if;

    if v_target_id is not null and not exists (
      select 1 from public.products
      where id = v_target_id
        and normalized_brand = v_normalized_brand
        and normalized_name = v_normalized_name
    ) then
      v_issues := array_append(v_issues, 'conflicting_product_identity');
    elsif v_target_id is null and v_normalized_brand is not null and v_normalized_name is not null then
      select count(*)::integer into v_match_count
      from public.products
      where normalized_brand = v_normalized_brand and normalized_name = v_normalized_name;
      if v_match_count > 0 then v_issues := array_append(v_issues, 'identity_ambiguous_match_requires_resolution'); end if;
    end if;
  end if;

  select coalesce(array_agg(distinct issue order by issue), '{}'::text[]) into v_issues from unnest(v_issues) as issue;
  v_status := case when coalesce(array_length(v_issues, 1), 0) = 0 then 'ready' else 'blocked' end;

  return jsonb_build_object(
    'status', v_status,
    'actor_role', v_actor_role,
    'candidate_id', v_candidate.id,
    'decision', v_decision,
    'reason', v_reason,
    'candidate_updated_at', v_candidate.updated_at,
    'review_updated_at', v_review.updated_at,
    'issues', to_jsonb(v_issues),
    'planned', jsonb_build_object(
      'products_write_count', case when v_status = 'ready' and v_decision = 'approve' then 1 else 0 end,
      'promotion_contract', 'crawler-canonical-product-structural-adoption-v1',
      'target_product_id', v_target_id,
      'recommendation_semantic_write_count', 0
    ),
    'before', jsonb_build_object(
      'candidate_review_status', v_candidate.review_status,
      'queue_status', v_review.status,
      'identity_resolution_state', v_candidate.identity_resolution_state
    ),
    'after', jsonb_build_object(
      'candidate_review_status', case when v_decision = 'approve' then 'promoted' else v_candidate.review_status::text end,
      'queue_status', case when v_decision = 'approve' then 'approved' else v_review.status end,
      'identity_resolution_state', v_candidate.identity_resolution_state
    )
  );
end;
$$;

revoke all on function public.admin_preflight_product_candidate_review(uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_preflight_product_candidate_review(uuid, uuid, text, text)
  to service_role;

commit;
