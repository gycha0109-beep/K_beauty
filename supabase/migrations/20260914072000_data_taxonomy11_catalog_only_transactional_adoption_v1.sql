begin;

create or replace function public.promote_product_candidate_catalog_only_v1(
  p_candidate_id uuid,
  p_actor text
)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
declare
  v_candidate public.product_candidates%rowtype;
  v_classification public.product_candidate_catalog_taxonomy_classifications%rowtype;
  v_rule public.catalog_taxonomy_candidate_source_rules%rowtype;
  v_runtime_resolution jsonb;
  v_product_id uuid;
  v_normalized_name text;
  v_normalized_brand text;
  v_actor text := nullif(btrim(coalesce(p_actor, '')), '');
  v_term_ids text[];
  v_expected_term_count integer;
  v_active_term_count integer;
begin
  if v_actor is null then
    raise exception 'DATA-TAXONOMY11: actor is required';
  end if;

  select candidate.*
    into v_candidate
  from public.product_candidates as candidate
  where candidate.id = p_candidate_id
  for update;

  if not found then
    raise exception 'DATA-TAXONOMY11: candidate % not found', p_candidate_id;
  end if;

  if v_candidate.review_status <> 'approved'::public.product_review_status then
    raise exception 'DATA-TAXONOMY11: candidate % is not approved', p_candidate_id;
  end if;

  if v_candidate.identity_resolution_state is distinct from 'resolved'
     or v_candidate.identity_resolution_version is distinct from 'crawler-identity-resolution-v1' then
    raise exception 'DATA-TAXONOMY11: candidate % identity authority is not resolved', p_candidate_id;
  end if;

  if nullif(btrim(coalesce(v_candidate.canonical_name, '')), '') is null
     or nullif(btrim(coalesce(v_candidate.canonical_brand, '')), '') is null then
    raise exception 'DATA-TAXONOMY11: candidate % canonical identity is incomplete', p_candidate_id;
  end if;

  if v_candidate.service_category is not null or v_candidate.product_form is not null then
    raise exception 'DATA-TAXONOMY11: candidate % carries a legacy Recommendation projection', p_candidate_id;
  end if;

  if v_candidate.matched_product_id is not null or v_candidate.duplicate_of_product_id is not null then
    raise exception 'DATA-TAXONOMY11: candidate % already references a Product', p_candidate_id;
  end if;

  if not exists (
    select 1
    from public.catalog_taxonomy_versions as version
    where version.version = 'catalog-taxonomy-v1'
      and version.lifecycle_state = 'shadow'
      and version.authority_mode = 'shadow_only'
    for share
  ) then
    raise exception 'DATA-TAXONOMY11: catalog-taxonomy-v1 is not shadow/shadow_only';
  end if;

  select classification.*
    into v_classification
  from public.product_candidate_catalog_taxonomy_classifications as classification
  where classification.candidate_id = p_candidate_id
    and classification.taxonomy_version = 'catalog-taxonomy-v1'
  for update;

  if not found then
    raise exception 'DATA-TAXONOMY11: candidate % taxonomy classification is missing', p_candidate_id;
  end if;

  if v_classification.source_name_snapshot is distinct from v_candidate.source_name
     or v_classification.category_path_snapshot is distinct from v_candidate.category_path
     or v_classification.legacy_category_snapshot is not null
     or v_classification.legacy_product_form_snapshot is not null then
    raise exception 'DATA-TAXONOMY11: candidate % taxonomy classification snapshot is stale', p_candidate_id;
  end if;

  if v_classification.classification_state is distinct from 'active_shadow'
     or v_classification.classification_method is distinct from 'source_rule_v1'
     or v_classification.source_rule_key is null
     or v_classification.legacy_projection_key is not null then
    raise exception 'DATA-TAXONOMY11: candidate % is not an active catalog-only source classification', p_candidate_id;
  end if;

  if v_classification.product_write_allowed is distinct from false
     or v_classification.product_promotion_allowed is distinct from false
     or v_classification.recommendation_admission_allowed is distinct from false then
    raise exception 'DATA-TAXONOMY11: candidate % classifier authority boundary drifted', p_candidate_id;
  end if;

  if v_classification.entity_kind_term_id is null
     or v_classification.domain_term_id is null
     or v_classification.recommendation_family_term_id is null
     or v_classification.category_term_id is null then
    raise exception 'DATA-TAXONOMY11: candidate % canonical term set is incomplete', p_candidate_id;
  end if;

  select rule.*
    into v_rule
  from public.catalog_taxonomy_candidate_source_rules as rule
  where rule.rule_key = v_classification.source_rule_key
    and rule.taxonomy_version = 'catalog-taxonomy-v1'
  for share;

  if not found
     or v_rule.lifecycle_state is distinct from 'active'
     or v_rule.entity_kind_term_id is distinct from v_classification.entity_kind_term_id
     or v_rule.domain_term_id is distinct from v_classification.domain_term_id
     or v_rule.recommendation_family_term_id is distinct from v_classification.recommendation_family_term_id
     or v_rule.category_term_id is distinct from v_classification.category_term_id
     or v_rule.form_term_id is distinct from v_classification.form_term_id then
    raise exception 'DATA-TAXONOMY11: candidate % source rule drifted', p_candidate_id;
  end if;

  v_term_ids := array_remove(array[
    v_classification.entity_kind_term_id,
    v_classification.domain_term_id,
    v_classification.recommendation_family_term_id,
    v_classification.category_term_id,
    v_classification.form_term_id
  ], null);
  v_expected_term_count := coalesce(array_length(v_term_ids, 1), 0);

  perform term.term_id
  from public.catalog_taxonomy_terms as term
  where term.taxonomy_version = 'catalog-taxonomy-v1'
    and term.term_id = any(v_term_ids)
  for share;

  select count(*)::integer
    into v_active_term_count
  from public.catalog_taxonomy_terms as term
  where term.taxonomy_version = 'catalog-taxonomy-v1'
    and term.term_id = any(v_term_ids)
    and term.lifecycle_state = 'active';

  if v_active_term_count <> v_expected_term_count then
    raise exception 'DATA-TAXONOMY11: candidate % references non-active taxonomy terms', p_candidate_id;
  end if;

  v_runtime_resolution := public.resolve_catalog_taxonomy_source_category_v1(
    v_candidate.source_name,
    v_candidate.category_path,
    'catalog-taxonomy-v1'
  );

  if v_runtime_resolution ->> 'classification_state' is distinct from 'active_shadow'
     or v_runtime_resolution ->> 'classification_method' is distinct from 'source_rule_v1'
     or v_runtime_resolution ->> 'source_rule_key' is distinct from v_classification.source_rule_key
     or v_runtime_resolution ->> 'entity_kind_term_id' is distinct from v_classification.entity_kind_term_id
     or v_runtime_resolution ->> 'domain_term_id' is distinct from v_classification.domain_term_id
     or v_runtime_resolution ->> 'recommendation_family_term_id' is distinct from v_classification.recommendation_family_term_id
     or v_runtime_resolution ->> 'category_term_id' is distinct from v_classification.category_term_id
     or v_runtime_resolution ->> 'form_term_id' is distinct from v_classification.form_term_id
     or v_runtime_resolution ->> 'product_write_allowed' is distinct from 'false'
     or v_runtime_resolution ->> 'product_promotion_allowed' is distinct from 'false'
     or v_runtime_resolution ->> 'recommendation_admission_allowed' is distinct from 'false' then
    raise exception 'DATA-TAXONOMY11: candidate % runtime taxonomy resolution drifted', p_candidate_id;
  end if;

  v_normalized_name := public.normalize_product_key(v_candidate.canonical_name);
  v_normalized_brand := public.normalize_brand_key(v_candidate.canonical_brand);

  if nullif(v_normalized_name, '') is null or nullif(v_normalized_brand, '') is null then
    raise exception 'DATA-TAXONOMY11: candidate % normalized identity is invalid', p_candidate_id;
  end if;

  if exists (
    select 1
    from public.products as product
    where product.normalized_name = v_normalized_name
      and product.normalized_brand = v_normalized_brand
  ) then
    raise exception 'DATA-TAXONOMY11: candidate % normalized Product identity already exists', p_candidate_id;
  end if;

  if nullif(btrim(coalesce(v_candidate.external_type, '')), '') is not null
     and nullif(btrim(coalesce(v_candidate.external_id, '')), '') is not null
     and exists (
       select 1
       from public.products as product
       where product.external_source = v_candidate.source_name
         and product.external_type = v_candidate.external_type
         and product.external_id = v_candidate.external_id
     ) then
    raise exception 'DATA-TAXONOMY11: candidate % external Product identity already exists', p_candidate_id;
  end if;

  insert into public.products(
    name,
    brand,
    category,
    product_form,
    normalized_name,
    normalized_brand,
    external_source,
    external_type,
    external_id,
    source_url,
    created_at,
    updated_at
  ) values (
    v_candidate.canonical_name,
    v_candidate.canonical_brand,
    null,
    null,
    v_normalized_name,
    v_normalized_brand,
    v_candidate.source_name,
    v_candidate.external_type,
    v_candidate.external_id,
    v_candidate.source_url,
    now(),
    now()
  ) returning id into v_product_id;

  insert into public.product_catalog_taxonomy_assignments(
    product_id,
    taxonomy_version,
    entity_kind_term_id,
    domain_term_id,
    recommendation_family_term_id,
    category_term_id,
    form_term_id,
    legacy_projection_key,
    assignment_state,
    assignment_method,
    source_snapshot,
    assigned_at
  ) values (
    v_product_id,
    'catalog-taxonomy-v1',
    v_classification.entity_kind_term_id,
    v_classification.domain_term_id,
    v_classification.recommendation_family_term_id,
    v_classification.category_term_id,
    v_classification.form_term_id,
    null,
    'shadow',
    'source_classification',
    jsonb_build_object(
      'candidate_id', v_candidate.id,
      'source_name', v_candidate.source_name,
      'category_path', v_candidate.category_path,
      'source_rule_key', v_classification.source_rule_key,
      'classification_method', v_classification.classification_method,
      'classified_at', v_classification.classified_at,
      'adoption_contract', 'catalog-only-product-transactional-adoption-v1'
    ),
    now()
  );

  update public.product_candidates
  set matched_product_id = v_product_id,
      duplicate_of_product_id = null,
      review_status = 'promoted'::public.product_review_status,
      reviewed_at = now(),
      reviewed_by = v_actor,
      promotion_version = 'catalog-only-product-transactional-adoption-v1',
      promotion_payload = (coalesce(promotion_payload, '{}'::jsonb) - 'product') || jsonb_build_object(
        'catalog_only_adoption', jsonb_build_object(
          'contract_version', 'catalog-only-product-transactional-adoption-v1',
          'taxonomy_version', 'catalog-taxonomy-v1',
          'source_rule_key', v_classification.source_rule_key,
          'recommendation_admission_allowed', false,
          'promoted_at', now(),
          'product_id', v_product_id
        )
      ),
      updated_at = now()
  where id = v_candidate.id;

  return jsonb_build_object(
    'candidate_id', v_candidate.id,
    'product_id', v_product_id,
    'action', 'inserted_catalog_only',
    'review_status', 'promoted',
    'category', null,
    'legacy_projection_key', null,
    'recommendation_admission_allowed', false,
    'contract_version', 'catalog-only-product-transactional-adoption-v1'
  );
end;
$function$;

comment on function public.promote_product_candidate_catalog_only_v1(uuid, text) is
  'Disabled DATA-TAXONOMY11 catalog-only Product adoption foundation. Product plus catalog-taxonomy-v1 assignment are created atomically; no Recommendation admission is granted.';

revoke all on function public.promote_product_candidate_catalog_only_v1(uuid, text) from public;
revoke all on function public.promote_product_candidate_catalog_only_v1(uuid, text) from anon;
revoke all on function public.promote_product_candidate_catalog_only_v1(uuid, text) from authenticated;
revoke all on function public.promote_product_candidate_catalog_only_v1(uuid, text) from service_role;

commit;
