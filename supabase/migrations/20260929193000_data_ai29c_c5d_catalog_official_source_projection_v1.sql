begin;

create or replace function public.admin_project_catalog_trust_official_source_v1(
  p_actor_user_id uuid,
  p_request_id text,
  p_product_id uuid,
  p_subject_id uuid,
  p_source_id uuid,
  p_source_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_actor_role text;
  v_request_id text := btrim(coalesce(p_request_id, ''));
  v_source_name text := lower(btrim(coalesce(p_source_name, '')));
  v_intake public.catalog_trust_intake%rowtype;
  v_subject public.product_fact_subjects%rowtype;
  v_candidate public.product_candidates%rowtype;
  v_source public.product_evidence_sources%rowtype;
  v_evidence_binding public.product_evidence_source_subject_bindings%rowtype;
  v_binding public.product_source_bindings%rowtype;
  v_review public.trust_official_source_binding_reviews%rowtype;
  v_external_type text;
  v_external_id text;
  v_audit_id uuid;
begin
  v_actor_role := public.admin_require_product_review_actor(
    p_actor_user_id,
    'admin.products.review'
  );

  if char_length(v_request_id) not between 8 and 120
     or p_product_id is null
     or p_subject_id is null
     or p_source_id is null
     or v_source_name !~ '^[a-z0-9][a-z0-9_-]{0,54}_official$'
  then
    raise exception 'catalog_trust_official_projection_request_invalid'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'bejewely_catalog_trust_official_projection:' ||
      p_product_id::text || ':' || p_subject_id::text || ':' || p_source_id::text,
      0
    )
  );

  select *
    into v_intake
  from public.catalog_trust_intake i
  where i.product_id = p_product_id
    and i.subject_id = p_subject_id
    and i.source_candidate_id is not null
    and i.catalog_revision like 'candidate:%:catalog-only-product-transactional-adoption-v1'
    and i.identity_state = 'EXACT_SUBJECT_FOUND'
    and i.category = 'sunscreen'
  order by i.updated_at desc, i.created_at desc, i.id desc
  limit 1
  for update;

  if not found then
    raise exception 'catalog_trust_official_projection_exact_intake_not_found'
      using errcode = 'P0002';
  end if;

  select *
    into v_subject
  from public.product_fact_subjects s
  where s.subject_id = p_subject_id
    and s.product_id = p_product_id
    and s.identity_status = 'resolved'
    and s.current_state = 'current'
    and s.variant_key is null
    and s.market_applicability is not distinct from v_intake.market;

  if not found then
    raise exception 'catalog_trust_official_projection_subject_scope_invalid'
      using errcode = '23514';
  end if;

  select *
    into v_candidate
  from public.product_candidates pc
  where pc.id = v_intake.source_candidate_id
    and pc.review_status = 'promoted'
    and pc.identity_resolution_state = 'resolved'
    and pc.matched_product_id = p_product_id;

  if not found
     or coalesce(v_candidate.identity_resolution_evidence #>> '{authority_boundary,product_fact_write_allowed}', 'true') <> 'false'
     or coalesce(v_candidate.promotion_payload #>> '{catalog_only_review,recommendation_admission_allowed}', 'true') <> 'false'
     or coalesce(v_candidate.promotion_payload #>> '{catalog_only_adoption,recommendation_admission_allowed}', 'true') <> 'false'
  then
    raise exception 'catalog_trust_official_projection_candidate_boundary_invalid'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.product_catalog_taxonomy_assignments a
    where a.product_id = p_product_id
      and a.taxonomy_version = 'catalog-taxonomy-v1'
      and a.category_term_id = 'catalog-taxonomy-v1:category:sunscreen'
      and a.assignment_state = 'shadow'
  ) then
    raise exception 'catalog_trust_official_projection_taxonomy_scope_invalid'
      using errcode = '23514';
  end if;

  select es.*, b.*
    into v_source, v_evidence_binding
  from public.product_evidence_sources es
  join public.product_evidence_source_subject_bindings b
    on b.source_id = es.source_id
  where es.source_id = p_source_id
    and es.canonical_locator ~ '^https://'
    and es.source_kind in (
      'official_product_page',
      'official_market_sales_page',
      'official_brand_owner_product_page'
    )
    and es.market is not distinct from v_intake.market
    and b.product_id = p_product_id
    and b.subject_id = p_subject_id
    and b.binding_state = 'exact_subject_match'
    and b.scope_relation = 'equivalent'
  order by b.reviewed_at desc nulls last, b.created_at desc
  limit 1;

  if not found then
    raise exception 'catalog_trust_official_projection_governed_source_required'
      using errcode = '23514';
  end if;

  v_external_type := case
    when v_source.source_kind = 'official_market_sales_page'
      then 'official_market_sales_page'
    else 'brand_official_product_page'
  end;

  v_external_id := 'official-url-sha256:' ||
    encode(
      extensions.digest(convert_to(v_source.canonical_locator, 'UTF8'), 'sha256'),
      'hex'
    );

  select *
    into v_binding
  from public.product_source_bindings psb
  where psb.source_name = v_source_name
    and psb.external_type = v_external_type
    and psb.external_id = v_external_id
    and psb.binding_state = 'resolved';

  if found then
    if v_binding.product_id <> p_product_id
       or v_binding.source_url is distinct from v_source.canonical_locator
       or v_binding.market_code is distinct from v_source.market
       or v_binding.locale is distinct from v_source.locale
       or v_binding.binding_method <> 'trust_official_source_review_v1'
       or v_binding.product_scope_state <> 'product'
    then
      raise exception 'catalog_trust_official_projection_binding_conflict'
        using errcode = '23505';
    end if;
  else
    insert into public.product_source_bindings (
      product_id,
      source_name,
      external_type,
      external_id,
      source_url,
      market_code,
      locale,
      binding_state,
      binding_method,
      product_scope_state,
      first_observed_at,
      last_observed_at,
      created_at,
      updated_at
    ) values (
      p_product_id,
      v_source_name,
      v_external_type,
      v_external_id,
      v_source.canonical_locator,
      v_source.market,
      v_source.locale,
      'resolved',
      'trust_official_source_review_v1',
      'product',
      now(),
      now(),
      now(),
      now()
    )
    returning * into v_binding;
  end if;

  select *
    into v_review
  from public.trust_official_source_binding_reviews r
  where r.binding_id = v_binding.binding_id
    and r.product_id = p_product_id
    and r.subject_id = p_subject_id
    and r.review_version = 'trust-official-source-review-v1';

  if found then
    if v_review.subject_market is distinct from v_intake.market
       or v_review.source_market is distinct from v_source.market
       or v_review.scope_relation <> 'equivalent'
       or v_review.variant_key is distinct from v_subject.variant_key
       or v_review.formulation_revision_key <> v_subject.formulation_revision_key
       or v_review.source_kind <> v_external_type
    then
      raise exception 'catalog_trust_official_projection_review_conflict'
        using errcode = '23505';
    end if;

    return jsonb_build_object(
      'status', 'projected',
      'idempotent', true,
      'actor_role', v_actor_role,
      'product_id', p_product_id,
      'subject_id', p_subject_id,
      'source_id', p_source_id,
      'binding_id', v_binding.binding_id,
      'review_id', v_review.review_id,
      'product_fact_authority_mutated', false,
      'recommendation_authority_mutated', false,
      'production_cutover_authorized', false
    );
  end if;

  insert into public.trust_official_source_binding_reviews (
    binding_id,
    product_id,
    subject_id,
    subject_market,
    source_market,
    scope_relation,
    variant_key,
    formulation_revision_key,
    source_kind,
    actor_user_id,
    request_id,
    review_version
  ) values (
    v_binding.binding_id,
    p_product_id,
    p_subject_id,
    v_intake.market,
    v_source.market,
    'equivalent',
    v_subject.variant_key,
    v_subject.formulation_revision_key,
    v_external_type,
    p_actor_user_id,
    v_request_id,
    'trust-official-source-review-v1'
  )
  returning * into v_review;

  v_audit_id := public.record_admin_audit_event(
    p_actor_user_id,
    'admin.products.review',
    'admin.trust.catalog_official_source_projected',
    'product_source_binding',
    v_binding.binding_id::text,
    null,
    jsonb_build_object(
      'product_id', p_product_id,
      'subject_id', p_subject_id,
      'source_id', p_source_id,
      'source_name', v_source_name,
      'source_kind', v_external_type,
      'source_url', v_source.canonical_locator,
      'market', v_source.market,
      'locale', v_source.locale,
      'scope_relation', 'equivalent'
    ),
    'project governed exact official Product Evidence source into catalog-only TRUST operational source binding',
    v_request_id,
    jsonb_build_object(
      'contract_version', 'data-ai29c-c5d-catalog-official-source-projection-v1',
      'catalog_revision', v_intake.catalog_revision,
      'source_candidate_id', v_intake.source_candidate_id,
      'evidence_binding_id', v_evidence_binding.binding_id,
      'evidence_identity_resolution_version', v_evidence_binding.identity_resolution_version,
      'actor_role', v_actor_role,
      'product_fact_authority_mutated', false,
      'recommendation_authority_mutated', false,
      'production_cutover_authorized', false
    )
  );

  return jsonb_build_object(
    'status', 'projected',
    'idempotent', false,
    'actor_role', v_actor_role,
    'audit_id', v_audit_id,
    'product_id', p_product_id,
    'subject_id', p_subject_id,
    'source_id', p_source_id,
    'binding_id', v_binding.binding_id,
    'review_id', v_review.review_id,
    'product_fact_authority_mutated', false,
    'recommendation_authority_mutated', false,
    'production_cutover_authorized', false
  );
end;
$$;

comment on function public.admin_project_catalog_trust_official_source_v1(uuid,text,uuid,uuid,uuid,text) is
  'Service-role-only DATA-AI29C-C5D projection. Requires an already governed exact/equivalent official Product Evidence Source binding for an exact catalog-only sunscreen TRUST Subject and projects only the operational Product source binding used by research.';

revoke all on function public.admin_project_catalog_trust_official_source_v1(uuid,text,uuid,uuid,uuid,text)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_project_catalog_trust_official_source_v1(uuid,text,uuid,uuid,uuid,text)
  to service_role;

commit;
