begin;

create table public.admin_catalog_only_candidate_approval_confirmations (
  request_id text primary key,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  candidate_id uuid not null references public.product_candidates(id) on delete restrict,
  payload_hash text not null check (char_length(payload_hash) = 64),
  preflight_hash text not null check (char_length(preflight_hash) = 64),
  result jsonb not null check (jsonb_typeof(result) = 'object' and octet_length(result::text) <= 65536),
  confirmed_at timestamptz not null default now(),
  constraint admin_catalog_only_candidate_approval_request_id_check
    check (char_length(btrim(request_id)) between 8 and 200)
);

alter table public.admin_catalog_only_candidate_approval_confirmations enable row level security;
revoke all on table public.admin_catalog_only_candidate_approval_confirmations from public;
revoke all on table public.admin_catalog_only_candidate_approval_confirmations from anon;
revoke all on table public.admin_catalog_only_candidate_approval_confirmations from authenticated;
revoke all on table public.admin_catalog_only_candidate_approval_confirmations from service_role;

create or replace function public.admin_preflight_product_candidate_catalog_only_approval_v1(
  p_actor_user_id uuid,
  p_candidate_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
declare
  v_actor_role text;
  v_candidate public.product_candidates%rowtype;
  v_review public.candidate_promotion_reviews%rowtype;
  v_classification public.product_candidate_catalog_taxonomy_classifications%rowtype;
  v_rule public.catalog_taxonomy_candidate_source_rules%rowtype;
  v_runtime jsonb;
  v_issues text[] := '{}'::text[];
  v_reason text;
  v_canonical_brand text;
  v_canonical_name text;
  v_normalized_brand text;
  v_normalized_name text;
  v_identity_evidence jsonb;
  v_provider_count integer := 0;
  v_distinct_provider_count integer := 0;
  v_source_provider_count integer := 0;
  v_independent_provider_count integer := 0;
  v_provider_identity_mismatch_count integer := 0;
  v_term_ids text[];
  v_expected_term_count integer := 0;
  v_active_term_count integer := 0;
  v_product_identity_collision_count integer := 0;
  v_product_external_collision_count integer := 0;
  v_candidate_identity_peer_count integer := 0;
  v_candidate_external_peer_count integer := 0;
  v_evidence_hash text;
  v_payload_hash text;
  v_preflight_basis jsonb;
  v_preflight_hash text;
  v_status text;
begin
  v_actor_role := public.admin_require_product_review_actor(
    p_actor_user_id,
    'admin.products.review'
  );

  if p_candidate_id is null then
    raise exception 'catalog_only_candidate_approval_candidate_required' using errcode = '22004';
  end if;

  if p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
     or octet_length(p_payload::text) > 65536
     or p_payload ->> 'contract_version' is distinct from 'catalog-only-candidate-approval-v1'
     or not p_payload ?& array[
       'contract_version',
       'canonical_brand',
       'canonical_name',
       'identity_resolution_version',
       'identity_evidence',
       'reason'
     ]
     or exists (
       select 1
       from jsonb_object_keys(p_payload) as key(value)
       where key.value not in (
         'contract_version',
         'canonical_brand',
         'canonical_name',
         'identity_resolution_version',
         'identity_evidence',
         'reason'
       )
     ) then
    raise exception 'catalog_only_candidate_approval_payload_invalid' using errcode = '22023';
  end if;

  v_reason := btrim(coalesce(p_payload ->> 'reason', ''));
  v_canonical_brand := btrim(coalesce(p_payload ->> 'canonical_brand', ''));
  v_canonical_name := btrim(coalesce(p_payload ->> 'canonical_name', ''));
  v_identity_evidence := p_payload -> 'identity_evidence';

  if char_length(v_reason) not between 12 and 1000 then
    v_issues := array_append(v_issues, 'reason_invalid');
  end if;
  if nullif(v_canonical_brand, '') is null then
    v_issues := array_append(v_issues, 'canonical_brand_missing');
  end if;
  if nullif(v_canonical_name, '') is null then
    v_issues := array_append(v_issues, 'canonical_name_missing');
  end if;
  if p_payload ->> 'identity_resolution_version' is distinct from 'crawler-identity-resolution-v1' then
    v_issues := array_append(v_issues, 'identity_resolution_version_invalid');
  end if;

  if v_identity_evidence is null
     or jsonb_typeof(v_identity_evidence) <> 'object'
     or octet_length(v_identity_evidence::text) > 32768
     or v_identity_evidence ->> 'contract_version' is distinct from 'catalog-only-candidate-identity-evidence-v1'
     or jsonb_typeof(v_identity_evidence -> 'providers') is distinct from 'array'
     or jsonb_typeof(v_identity_evidence -> 'convergence_dimensions') is distinct from 'array'
     or jsonb_typeof(v_identity_evidence -> 'authority_boundary') is distinct from 'object'
     or v_identity_evidence #>> '{authority_boundary,product_write_allowed}' is distinct from 'false'
     or v_identity_evidence #>> '{authority_boundary,taxonomy_assignment_write_allowed}' is distinct from 'false'
     or v_identity_evidence #>> '{authority_boundary,recommendation_admission_allowed}' is distinct from 'false'
     or v_identity_evidence #>> '{authority_boundary,recommendation_runtime_cutover}' is distinct from 'false'
     or v_identity_evidence #>> '{authority_boundary,product_fact_write_allowed}' is distinct from 'false'
     or v_identity_evidence #>> '{authority_boundary,offer_write_allowed}' is distinct from 'false' then
    v_issues := array_append(v_issues, 'identity_evidence_contract_invalid');
  end if;

  select candidate.* into v_candidate
  from public.product_candidates as candidate
  where candidate.id = p_candidate_id;
  if not found then
    raise exception 'catalog_only_candidate_approval_candidate_not_found' using errcode = 'P0002';
  end if;

  select review.* into v_review
  from public.candidate_promotion_reviews as review
  where review.candidate_id = p_candidate_id;
  if not found then
    raise exception 'catalog_only_candidate_approval_review_queue_not_found' using errcode = 'P0002';
  end if;

  select classification.* into v_classification
  from public.product_candidate_catalog_taxonomy_classifications as classification
  where classification.candidate_id = p_candidate_id
    and classification.taxonomy_version = 'catalog-taxonomy-v1';
  if not found then
    raise exception 'catalog_only_candidate_approval_classification_not_found' using errcode = 'P0002';
  end if;

  if v_candidate.review_status <> 'new'::public.product_review_status then
    v_issues := array_append(v_issues, 'candidate_review_status_not_new');
  end if;
  if v_candidate.identity_resolution_state is distinct from 'unresolved' then
    v_issues := array_append(v_issues, 'candidate_identity_state_not_unresolved');
  end if;
  if v_candidate.identity_resolution_version is distinct from 'crawler-identity-resolution-v1' then
    v_issues := array_append(v_issues, 'candidate_identity_version_drifted');
  end if;
  if v_candidate.canonical_brand is not null or v_candidate.canonical_name is not null then
    v_issues := array_append(v_issues, 'candidate_canonical_identity_already_present');
  end if;
  if v_candidate.service_category is not null or v_candidate.product_form is not null then
    v_issues := array_append(v_issues, 'legacy_projection_fields_present');
  end if;
  if v_candidate.matched_product_id is not null or v_candidate.duplicate_of_product_id is not null then
    v_issues := array_append(v_issues, 'candidate_product_reference_present');
  end if;
  if v_review.status not in ('queued', 'reviewing', 'deferred') then
    v_issues := array_append(v_issues, 'review_queue_not_actionable');
  end if;
  if v_review.approved_product_id is not null then
    v_issues := array_append(v_issues, 'review_queue_product_reference_present');
  end if;

  if not exists (
    select 1
    from public.catalog_taxonomy_versions as version
    where version.version = 'catalog-taxonomy-v1'
      and version.lifecycle_state = 'shadow'
      and version.authority_mode = 'shadow_only'
  ) then
    v_issues := array_append(v_issues, 'taxonomy_version_not_shadow_only');
  end if;

  if v_classification.source_name_snapshot is distinct from v_candidate.source_name
     or v_classification.category_path_snapshot is distinct from v_candidate.category_path
     or v_classification.legacy_category_snapshot is not null
     or v_classification.legacy_product_form_snapshot is not null then
    v_issues := array_append(v_issues, 'taxonomy_classification_snapshot_stale');
  end if;
  if v_classification.classification_state is distinct from 'active_shadow'
     or v_classification.classification_method is distinct from 'source_rule_v1'
     or v_classification.source_rule_key is null
     or v_classification.legacy_projection_key is not null then
    v_issues := array_append(v_issues, 'taxonomy_classification_not_catalog_only_source_rule');
  end if;
  if v_classification.product_write_allowed is distinct from false
     or v_classification.product_promotion_allowed is distinct from false
     or v_classification.recommendation_admission_allowed is distinct from false then
    v_issues := array_append(v_issues, 'taxonomy_classifier_authority_drifted');
  end if;
  if v_classification.entity_kind_term_id is null
     or v_classification.domain_term_id is null
     or v_classification.recommendation_family_term_id is null
     or v_classification.category_term_id is null then
    v_issues := array_append(v_issues, 'taxonomy_term_set_incomplete');
  end if;

  if v_classification.source_rule_key is not null then
    select rule.* into v_rule
    from public.catalog_taxonomy_candidate_source_rules as rule
    where rule.rule_key = v_classification.source_rule_key
      and rule.taxonomy_version = 'catalog-taxonomy-v1';

    if not found
       or v_rule.lifecycle_state is distinct from 'active'
       or v_rule.source_name_key is distinct from lower(btrim(v_candidate.source_name))
       or v_rule.raw_category_key is distinct from btrim(v_candidate.category_path)
       or v_rule.entity_kind_term_id is distinct from v_classification.entity_kind_term_id
       or v_rule.domain_term_id is distinct from v_classification.domain_term_id
       or v_rule.recommendation_family_term_id is distinct from v_classification.recommendation_family_term_id
       or v_rule.category_term_id is distinct from v_classification.category_term_id
       or v_rule.form_term_id is distinct from v_classification.form_term_id then
      v_issues := array_append(v_issues, 'taxonomy_source_rule_drifted');
    end if;
  end if;

  v_term_ids := array_remove(array[
    v_classification.entity_kind_term_id,
    v_classification.domain_term_id,
    v_classification.recommendation_family_term_id,
    v_classification.category_term_id,
    v_classification.form_term_id
  ], null);
  v_expected_term_count := coalesce(array_length(v_term_ids, 1), 0);

  select count(*)::integer into v_active_term_count
  from public.catalog_taxonomy_terms as term
  where term.taxonomy_version = 'catalog-taxonomy-v1'
    and term.term_id = any(v_term_ids)
    and term.lifecycle_state = 'active';

  if v_active_term_count <> v_expected_term_count then
    v_issues := array_append(v_issues, 'taxonomy_term_set_not_active');
  end if;

  v_runtime := public.resolve_catalog_taxonomy_source_category_v1(
    v_candidate.source_name,
    v_candidate.category_path,
    'catalog-taxonomy-v1'
  );

  if v_runtime ->> 'classification_state' is distinct from 'active_shadow'
     or v_runtime ->> 'classification_method' is distinct from 'source_rule_v1'
     or v_runtime ->> 'source_rule_key' is distinct from v_classification.source_rule_key
     or v_runtime ->> 'entity_kind_term_id' is distinct from v_classification.entity_kind_term_id
     or v_runtime ->> 'domain_term_id' is distinct from v_classification.domain_term_id
     or v_runtime ->> 'recommendation_family_term_id' is distinct from v_classification.recommendation_family_term_id
     or v_runtime ->> 'category_term_id' is distinct from v_classification.category_term_id
     or v_runtime ->> 'form_term_id' is distinct from v_classification.form_term_id
     or v_runtime ->> 'product_write_allowed' is distinct from 'false'
     or v_runtime ->> 'product_promotion_allowed' is distinct from 'false'
     or v_runtime ->> 'recommendation_admission_allowed' is distinct from 'false' then
    v_issues := array_append(v_issues, 'taxonomy_runtime_resolution_drifted');
  end if;

  v_normalized_brand := public.normalize_brand_key(v_canonical_brand);
  v_normalized_name := public.normalize_product_key(v_canonical_name);
  if nullif(v_normalized_brand, '') is null or nullif(v_normalized_name, '') is null then
    v_issues := array_append(v_issues, 'canonical_identity_normalization_invalid');
  end if;

  if jsonb_typeof(v_identity_evidence -> 'providers') = 'array' then
    select count(*)::integer,
           count(distinct nullif(btrim(provider.value ->> 'provider'), ''))::integer,
           count(*) filter (where lower(btrim(provider.value ->> 'provider')) = lower(btrim(v_candidate.source_name)))::integer,
           count(*) filter (where lower(btrim(provider.value ->> 'provider')) <> lower(btrim(v_candidate.source_name)))::integer,
           count(*) filter (
             where jsonb_typeof(provider.value) <> 'object'
                or nullif(btrim(provider.value ->> 'provider'), '') is null
                or nullif(btrim(provider.value ->> 'locator'), '') is null
                or nullif(btrim(provider.value ->> 'canonical_brand'), '') is null
                or nullif(btrim(provider.value ->> 'canonical_name'), '') is null
                or public.normalize_brand_key(provider.value ->> 'canonical_brand') is distinct from v_normalized_brand
                or public.normalize_product_key(provider.value ->> 'canonical_name') is distinct from v_normalized_name
           )::integer
      into v_provider_count,
           v_distinct_provider_count,
           v_source_provider_count,
           v_independent_provider_count,
           v_provider_identity_mismatch_count
    from jsonb_array_elements(v_identity_evidence -> 'providers') as provider(value);

    if v_provider_count < 2 or v_distinct_provider_count < 2 then
      v_issues := array_append(v_issues, 'identity_evidence_provider_count_insufficient');
    end if;
    if v_source_provider_count < 1 or v_independent_provider_count < 1 then
      v_issues := array_append(v_issues, 'identity_evidence_independent_convergence_missing');
    end if;
    if v_provider_identity_mismatch_count > 0 then
      v_issues := array_append(v_issues, 'identity_evidence_provider_identity_mismatch');
    end if;
  end if;

  if jsonb_typeof(v_identity_evidence -> 'convergence_dimensions') = 'array'
     and jsonb_array_length(v_identity_evidence -> 'convergence_dimensions') < 3 then
    v_issues := array_append(v_issues, 'identity_evidence_convergence_dimensions_insufficient');
  end if;

  if nullif(v_normalized_brand, '') is not null and nullif(v_normalized_name, '') is not null then
    select count(*)::integer into v_product_identity_collision_count
    from public.products as product
    where product.normalized_brand = v_normalized_brand
      and product.normalized_name = v_normalized_name;

    select count(*)::integer into v_candidate_identity_peer_count
    from public.product_candidates as peer
    where peer.id <> p_candidate_id
      and peer.review_status <> 'rejected'::public.product_review_status
      and public.normalize_brand_key(coalesce(peer.canonical_brand, peer.brand_name_raw, '')) = v_normalized_brand
      and public.normalize_product_key(coalesce(peer.canonical_name, peer.product_name_raw, '')) = v_normalized_name;
  end if;

  if nullif(btrim(coalesce(v_candidate.external_type, '')), '') is not null
     and nullif(btrim(coalesce(v_candidate.external_id, '')), '') is not null then
    select count(*)::integer into v_product_external_collision_count
    from public.products as product
    where product.external_source = v_candidate.source_name
      and product.external_type = v_candidate.external_type
      and product.external_id = v_candidate.external_id;

    select count(*)::integer into v_candidate_external_peer_count
    from public.product_candidates as peer
    where peer.id <> p_candidate_id
      and peer.source_name = v_candidate.source_name
      and peer.external_type = v_candidate.external_type
      and peer.external_id = v_candidate.external_id
      and peer.review_status <> 'rejected'::public.product_review_status;
  end if;

  if v_product_identity_collision_count > 0 then
    v_issues := array_append(v_issues, 'normalized_product_identity_collision');
  end if;
  if v_product_external_collision_count > 0 then
    v_issues := array_append(v_issues, 'exact_external_product_identity_collision');
  end if;
  if v_candidate_identity_peer_count > 0 then
    v_issues := array_append(v_issues, 'candidate_identity_peer_collision');
  end if;
  if v_candidate_external_peer_count > 0 then
    v_issues := array_append(v_issues, 'candidate_external_peer_collision');
  end if;

  select coalesce(array_agg(distinct issue order by issue), '{}'::text[])
    into v_issues
  from unnest(v_issues) as issue;

  v_status := case when coalesce(array_length(v_issues, 1), 0) = 0 then 'ready' else 'blocked' end;
  v_evidence_hash := public.admin_product_review_sha256_json(coalesce(v_identity_evidence, '{}'::jsonb));
  v_payload_hash := public.admin_product_review_sha256_json(p_payload);
  v_preflight_basis := jsonb_build_object(
    'contract_version', 'catalog-only-candidate-approval-preflight-v1',
    'candidate_id', v_candidate.id,
    'candidate_updated_at', v_candidate.updated_at::text,
    'review_updated_at', v_review.updated_at::text,
    'classification_classified_at', v_classification.classified_at::text,
    'proposed_canonical_brand', v_canonical_brand,
    'proposed_canonical_name', v_canonical_name,
    'proposed_normalized_brand', v_normalized_brand,
    'proposed_normalized_name', v_normalized_name,
    'identity_evidence_hash', v_evidence_hash,
    'payload_hash', v_payload_hash,
    'source_rule_key', v_classification.source_rule_key,
    'runtime_resolution', v_runtime,
    'issues', to_jsonb(v_issues)
  );
  v_preflight_hash := public.admin_product_review_sha256_json(v_preflight_basis);

  return jsonb_build_object(
    'status', v_status,
    'actor_role', v_actor_role,
    'candidate_id', v_candidate.id,
    'candidate_updated_at', v_candidate.updated_at::text,
    'review_updated_at', v_review.updated_at::text,
    'classification_classified_at', v_classification.classified_at::text,
    'evidence_hash', v_evidence_hash,
    'payload_hash', v_payload_hash,
    'preflight_hash', v_preflight_hash,
    'issues', to_jsonb(v_issues),
    'proposed', jsonb_build_object(
      'canonical_brand', v_canonical_brand,
      'canonical_name', v_canonical_name,
      'normalized_brand', v_normalized_brand,
      'normalized_name', v_normalized_name,
      'identity_resolution_state', 'resolved',
      'identity_resolution_version', 'crawler-identity-resolution-v1',
      'review_status', 'approved'
    ),
    'taxonomy', jsonb_build_object(
      'taxonomy_version', 'catalog-taxonomy-v1',
      'source_rule_key', v_classification.source_rule_key,
      'classification_state', v_classification.classification_state,
      'classification_method', v_classification.classification_method,
      'active_term_count', v_active_term_count,
      'expected_term_count', v_expected_term_count
    ),
    'collisions', jsonb_build_object(
      'normalized_product_identity', v_product_identity_collision_count,
      'external_product_identity', v_product_external_collision_count,
      'candidate_identity_peer', v_candidate_identity_peer_count,
      'candidate_external_peer', v_candidate_external_peer_count
    ),
    'planned', jsonb_build_object(
      'candidate_write_count', case when v_status = 'ready' then 1 else 0 end,
      'review_queue_write_count', case when v_status = 'ready' then 1 else 0 end,
      'audit_write_count', case when v_status = 'ready' then 1 else 0 end,
      'confirmation_write_count', case when v_status = 'ready' then 1 else 0 end,
      'products_write_count', 0,
      'taxonomy_assignment_write_count', 0,
      'recommendation_semantic_write_count', 0,
      'product_fact_write_count', 0,
      'offer_write_count', 0
    )
  );
end;
$function$;

create or replace function public.admin_confirm_product_candidate_catalog_only_approval_v1(
  p_actor_user_id uuid,
  p_candidate_id uuid,
  p_payload jsonb,
  p_candidate_updated_at_expected text,
  p_review_updated_at_expected text,
  p_classified_at_expected text,
  p_evidence_hash_expected text,
  p_preflight_hash_expected text,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
declare
  v_actor_role text;
  v_request_id text := btrim(coalesce(p_request_id, ''));
  v_payload_hash text;
  v_existing public.admin_catalog_only_candidate_approval_confirmations%rowtype;
  v_candidate public.product_candidates%rowtype;
  v_review public.candidate_promotion_reviews%rowtype;
  v_classification public.product_candidate_catalog_taxonomy_classifications%rowtype;
  v_preflight jsonb;
  v_reason text;
  v_canonical_brand text;
  v_canonical_name text;
  v_normalized_brand text;
  v_normalized_name text;
  v_identity_evidence jsonb;
  v_before jsonb;
  v_after jsonb;
  v_audit_id uuid;
  v_result jsonb;
begin
  v_actor_role := public.admin_require_product_review_actor(
    p_actor_user_id,
    'admin.products.review'
  );

  if char_length(v_request_id) not between 8 and 200 then
    raise exception 'catalog_only_candidate_approval_request_id_invalid' using errcode = '22023';
  end if;

  v_payload_hash := public.admin_product_review_sha256_json(p_payload);

  perform pg_advisory_xact_lock(
    hashtextextended('bejewely_catalog_only_candidate_approval:' || v_request_id, 0)
  );

  select confirmation.* into v_existing
  from public.admin_catalog_only_candidate_approval_confirmations as confirmation
  where confirmation.request_id = v_request_id;

  if found then
    if v_existing.actor_user_id <> p_actor_user_id
       or v_existing.candidate_id <> p_candidate_id
       or v_existing.payload_hash <> v_payload_hash
       or v_existing.preflight_hash <> btrim(coalesce(p_preflight_hash_expected, '')) then
      raise exception 'catalog_only_candidate_approval_request_id_conflict' using errcode = '23505';
    end if;
    return v_existing.result;
  end if;

  select candidate.* into v_candidate
  from public.product_candidates as candidate
  where candidate.id = p_candidate_id
  for update;
  if not found then
    raise exception 'catalog_only_candidate_approval_candidate_not_found' using errcode = 'P0002';
  end if;

  select review.* into v_review
  from public.candidate_promotion_reviews as review
  where review.candidate_id = p_candidate_id
  for update;
  if not found then
    raise exception 'catalog_only_candidate_approval_review_queue_not_found' using errcode = 'P0002';
  end if;

  select classification.* into v_classification
  from public.product_candidate_catalog_taxonomy_classifications as classification
  where classification.candidate_id = p_candidate_id
    and classification.taxonomy_version = 'catalog-taxonomy-v1'
  for update;
  if not found then
    raise exception 'catalog_only_candidate_approval_classification_not_found' using errcode = 'P0002';
  end if;

  v_preflight := public.admin_preflight_product_candidate_catalog_only_approval_v1(
    p_actor_user_id,
    p_candidate_id,
    p_payload
  );

  if v_preflight ->> 'status' <> 'ready' then
    raise exception 'catalog_only_candidate_approval_preflight_blocked' using errcode = '23514';
  end if;

  if coalesce(v_preflight ->> 'candidate_updated_at', '') <> btrim(coalesce(p_candidate_updated_at_expected, ''))
     or coalesce(v_preflight ->> 'review_updated_at', '') <> btrim(coalesce(p_review_updated_at_expected, ''))
     or coalesce(v_preflight ->> 'classification_classified_at', '') <> btrim(coalesce(p_classified_at_expected, ''))
     or coalesce(v_preflight ->> 'evidence_hash', '') <> btrim(coalesce(p_evidence_hash_expected, ''))
     or coalesce(v_preflight ->> 'preflight_hash', '') <> btrim(coalesce(p_preflight_hash_expected, '')) then
    raise exception 'catalog_only_candidate_approval_stale_preflight' using errcode = '40001';
  end if;

  v_reason := btrim(p_payload ->> 'reason');
  v_canonical_brand := btrim(p_payload ->> 'canonical_brand');
  v_canonical_name := btrim(p_payload ->> 'canonical_name');
  v_normalized_brand := v_preflight #>> '{proposed,normalized_brand}';
  v_normalized_name := v_preflight #>> '{proposed,normalized_name}';
  v_identity_evidence := p_payload -> 'identity_evidence';

  v_before := jsonb_build_object(
    'candidate_review_status', v_candidate.review_status,
    'identity_resolution_state', v_candidate.identity_resolution_state,
    'canonical_brand', v_candidate.canonical_brand,
    'canonical_name', v_candidate.canonical_name,
    'service_category', v_candidate.service_category,
    'product_form', v_candidate.product_form,
    'matched_product_id', v_candidate.matched_product_id,
    'duplicate_of_product_id', v_candidate.duplicate_of_product_id,
    'queue_status', v_review.status,
    'approved_product_id', v_review.approved_product_id
  );

  update public.product_candidates
  set canonical_brand = v_canonical_brand,
      canonical_name = v_canonical_name,
      normalized_brand = v_normalized_brand,
      normalized_name = v_normalized_name,
      identity_resolution_state = 'resolved',
      identity_resolution_version = 'crawler-identity-resolution-v1',
      identity_resolution_evidence = v_identity_evidence || jsonb_build_object(
        'approval_contract', 'catalog-only-candidate-approval-v1',
        'reason_code', v_reason,
        'source_name', source_name,
        'source_url', source_url,
        'external_type', external_type,
        'external_id', external_id,
        'reviewed_at', now()
      ),
      review_status = 'approved'::public.product_review_status,
      reviewed_at = now(),
      reviewed_by = p_actor_user_id::text,
      review_notes = trim(
        both from concat_ws(
          E'\n',
          nullif(review_notes, ''),
          'Catalog-only approval: ' || v_reason
        )
      ),
      promotion_payload = (coalesce(promotion_payload, '{}'::jsonb) - 'product') || jsonb_build_object(
        'catalog_only_review', jsonb_build_object(
          'contract_version', 'catalog-only-candidate-approval-v1',
          'taxonomy_version', 'catalog-taxonomy-v1',
          'source_rule_key', v_classification.source_rule_key,
          'recommendation_admission_allowed', false,
          'product_write_allowed', false,
          'approved_at', now(),
          'approved_by', p_actor_user_id
        )
      ),
      updated_at = now()
  where id = p_candidate_id;

  update public.candidate_promotion_reviews
  set status = 'approved',
      reviewed_at = now(),
      review_note = v_reason,
      approved_product_id = null,
      updated_at = now()
  where candidate_id = p_candidate_id;

  select candidate.* into v_candidate
  from public.product_candidates as candidate
  where candidate.id = p_candidate_id;

  select review.* into v_review
  from public.candidate_promotion_reviews as review
  where review.candidate_id = p_candidate_id;

  v_after := jsonb_build_object(
    'candidate_review_status', v_candidate.review_status,
    'identity_resolution_state', v_candidate.identity_resolution_state,
    'canonical_brand', v_candidate.canonical_brand,
    'canonical_name', v_candidate.canonical_name,
    'service_category', v_candidate.service_category,
    'product_form', v_candidate.product_form,
    'matched_product_id', v_candidate.matched_product_id,
    'duplicate_of_product_id', v_candidate.duplicate_of_product_id,
    'queue_status', v_review.status,
    'approved_product_id', v_review.approved_product_id
  );

  v_audit_id := public.record_admin_audit_event(
    p_actor_user_id,
    'admin.products.review',
    'admin.product_candidate.catalog_only_approval_confirmed',
    'product_candidate',
    p_candidate_id::text,
    v_before,
    v_after,
    v_reason,
    v_request_id,
    jsonb_build_object(
      'contract_version', 'catalog-only-candidate-approval-v1',
      'preflight_hash', v_preflight ->> 'preflight_hash',
      'evidence_hash', v_preflight ->> 'evidence_hash',
      'source_rule_key', v_classification.source_rule_key,
      'products_written', 0,
      'taxonomy_assignments_written', 0,
      'recommendation_semantic_writes', 0
    )
  );

  v_result := jsonb_build_object(
    'status', 'confirmed',
    'request_id', v_request_id,
    'candidate_id', p_candidate_id,
    'actor_role', v_actor_role,
    'candidate_review_status', v_candidate.review_status,
    'identity_resolution_state', v_candidate.identity_resolution_state,
    'queue_status', v_review.status,
    'product_id', null,
    'promotion_action', 'none',
    'products_written', 0,
    'taxonomy_assignments_written', 0,
    'recommendation_semantic_writes', 0,
    'product_facts_written', 0,
    'offers_written', 0,
    'audit_id', v_audit_id,
    'contract_version', 'catalog-only-candidate-approval-v1'
  );

  insert into public.admin_catalog_only_candidate_approval_confirmations (
    request_id,
    actor_user_id,
    candidate_id,
    payload_hash,
    preflight_hash,
    result,
    confirmed_at
  ) values (
    v_request_id,
    p_actor_user_id,
    p_candidate_id,
    v_payload_hash,
    v_preflight ->> 'preflight_hash',
    v_result,
    now()
  );

  return v_result;
end;
$function$;

comment on function public.admin_preflight_product_candidate_catalog_only_approval_v1(uuid, uuid, jsonb) is
  'DATA-TAXONOMY13 fail-closed preflight for Product-write-free catalog-only candidate identity and approval.';
comment on function public.admin_confirm_product_candidate_catalog_only_approval_v1(uuid, uuid, jsonb, text, text, text, text, text, text) is
  'DATA-TAXONOMY13 controlled confirmation that resolves reviewed candidate identity and marks the candidate approved without Product or Recommendation writes.';

revoke all on function public.admin_preflight_product_candidate_catalog_only_approval_v1(uuid, uuid, jsonb) from public;
revoke all on function public.admin_preflight_product_candidate_catalog_only_approval_v1(uuid, uuid, jsonb) from anon;
revoke all on function public.admin_preflight_product_candidate_catalog_only_approval_v1(uuid, uuid, jsonb) from authenticated;
revoke all on function public.admin_preflight_product_candidate_catalog_only_approval_v1(uuid, uuid, jsonb) from service_role;
grant execute on function public.admin_preflight_product_candidate_catalog_only_approval_v1(uuid, uuid, jsonb) to service_role;

revoke all on function public.admin_confirm_product_candidate_catalog_only_approval_v1(uuid, uuid, jsonb, text, text, text, text, text, text) from public;
revoke all on function public.admin_confirm_product_candidate_catalog_only_approval_v1(uuid, uuid, jsonb, text, text, text, text, text, text) from anon;
revoke all on function public.admin_confirm_product_candidate_catalog_only_approval_v1(uuid, uuid, jsonb, text, text, text, text, text, text) from authenticated;
revoke all on function public.admin_confirm_product_candidate_catalog_only_approval_v1(uuid, uuid, jsonb, text, text, text, text, text, text) from service_role;
grant execute on function public.admin_confirm_product_candidate_catalog_only_approval_v1(uuid, uuid, jsonb, text, text, text, text, text, text) to service_role;

commit;
