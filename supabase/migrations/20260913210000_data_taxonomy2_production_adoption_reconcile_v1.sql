begin;

-- DATA-TAXONOMY2 Production adoption reconciliation.
--
-- Production received the projection bridge and the two shadow tables through
-- split migrations while the repository-owned monolithic migration was being
-- repaired. This migration adopts that already-present structure and completes
-- only the remaining shadow classification contract. It deliberately does not
-- create or mutate Product, Recommendation, Product Fact, or Offer authority.

do $function$
begin
  if to_regclass('public.catalog_taxonomy_candidate_source_rules') is null then
    raise exception 'DATA_TAXONOMY2_ADOPTION_SOURCE_RULE_TABLE_MISSING';
  end if;

  if to_regclass('public.product_candidate_catalog_taxonomy_classifications') is null then
    raise exception 'DATA_TAXONOMY2_ADOPTION_CLASSIFICATION_TABLE_MISSING';
  end if;

  if (
    select count(*)
    from public.catalog_taxonomy_legacy_projections as projection
    where projection.taxonomy_version = 'catalog-taxonomy-v1'
      and projection.lifecycle_state = 'active'
      and (
        (
          projection.projection_key = 'catalog-taxonomy-v1:legacy:moisturizer:none'
          and projection.legacy_category = 'moisturizer'::public.product_category
          and projection.legacy_product_form is null
          and projection.entity_kind_term_id = 'catalog-taxonomy-v1:entity_kind:cosmetic'
          and projection.domain_term_id = 'catalog-taxonomy-v1:domain:skincare'
          and projection.recommendation_family_term_id = 'catalog-taxonomy-v1:recommendation_family:moisturizer'
          and projection.category_term_id = 'catalog-taxonomy-v1:category:moisturizer'
          and projection.form_term_id is null
        )
        or
        (
          projection.projection_key = 'catalog-taxonomy-v1:legacy:treatment:booster'
          and projection.legacy_category = 'treatment'::public.product_category
          and projection.legacy_product_form = 'booster'::public.product_form
          and projection.entity_kind_term_id = 'catalog-taxonomy-v1:entity_kind:cosmetic'
          and projection.domain_term_id = 'catalog-taxonomy-v1:domain:skincare'
          and projection.recommendation_family_term_id = 'catalog-taxonomy-v1:recommendation_family:treatment'
          and projection.category_term_id = 'catalog-taxonomy-v1:category:treatment'
          and projection.form_term_id = 'catalog-taxonomy-v1:form:booster'
        )
        or
        (
          projection.projection_key = 'catalog-taxonomy-v1:legacy:treatment:peeling_solution'
          and projection.legacy_category = 'treatment'::public.product_category
          and projection.legacy_product_form = 'peeling_solution'::public.product_form
          and projection.entity_kind_term_id = 'catalog-taxonomy-v1:entity_kind:cosmetic'
          and projection.domain_term_id = 'catalog-taxonomy-v1:domain:skincare'
          and projection.recommendation_family_term_id = 'catalog-taxonomy-v1:recommendation_family:treatment'
          and projection.category_term_id = 'catalog-taxonomy-v1:category:treatment'
          and projection.form_term_id = 'catalog-taxonomy-v1:form:peeling_solution'
        )
      )
  ) <> 3 then
    raise exception 'DATA_TAXONOMY2_ADOPTION_PROJECTION_BRIDGE_MISMATCH';
  end if;
end;
$function$;

alter table public.catalog_taxonomy_candidate_source_rules enable row level security;
alter table public.product_candidate_catalog_taxonomy_classifications enable row level security;

revoke all on table public.catalog_taxonomy_candidate_source_rules from public, anon, authenticated, service_role;
revoke all on table public.product_candidate_catalog_taxonomy_classifications from public, anon, authenticated, service_role;
grant select on table public.catalog_taxonomy_candidate_source_rules to service_role;
grant select on table public.product_candidate_catalog_taxonomy_classifications to service_role;

insert into public.catalog_taxonomy_candidate_source_rules (
  rule_key,
  taxonomy_version,
  source_name_key,
  raw_category_key,
  entity_kind_term_id,
  domain_term_id,
  recommendation_family_term_id,
  category_term_id,
  form_term_id,
  lifecycle_state,
  metadata
) values
  (
    'catalog-taxonomy-v1:source:hwahae:cleanser',
    'catalog-taxonomy-v1',
    'hwahae',
    'cleanser',
    'catalog-taxonomy-v1:entity_kind:cosmetic',
    'catalog-taxonomy-v1:domain:skincare',
    'catalog-taxonomy-v1:recommendation_family:cleanser',
    'catalog-taxonomy-v1:category:cleanser',
    null,
    'active',
    '{"observed_in_production":true,"authority":"shadow_only"}'::jsonb
  ),
  (
    'catalog-taxonomy-v1:source:hwahae:sunscreen',
    'catalog-taxonomy-v1',
    'hwahae',
    'sunscreen',
    'catalog-taxonomy-v1:entity_kind:cosmetic',
    'catalog-taxonomy-v1:domain:skincare',
    'catalog-taxonomy-v1:recommendation_family:sunscreen',
    'catalog-taxonomy-v1:category:sunscreen',
    null,
    'active',
    '{"observed_in_production":true,"authority":"shadow_only"}'::jsonb
  ),
  (
    'catalog-taxonomy-v1:source:hwahae:toner_essence',
    'catalog-taxonomy-v1',
    'hwahae',
    'toner_essence',
    'catalog-taxonomy-v1:entity_kind:cosmetic',
    'catalog-taxonomy-v1:domain:skincare',
    'catalog-taxonomy-v1:recommendation_family:toner',
    'catalog-taxonomy-v1:category:toner',
    null,
    'active',
    '{"observed_in_production":true,"authority":"shadow_only","form_semantics":"unresolved_do_not_infer_essence"}'::jsonb
  ),
  (
    'catalog-taxonomy-v1:source:hwahae:treatment',
    'catalog-taxonomy-v1',
    'hwahae',
    'treatment',
    'catalog-taxonomy-v1:entity_kind:cosmetic',
    'catalog-taxonomy-v1:domain:skincare',
    'catalog-taxonomy-v1:recommendation_family:treatment',
    'catalog-taxonomy-v1:category:treatment',
    null,
    'active',
    '{"observed_in_production":true,"authority":"shadow_only","form_semantics":"requires_separate_governed_evidence"}'::jsonb
  )
on conflict (rule_key) do update
set taxonomy_version = excluded.taxonomy_version,
    source_name_key = excluded.source_name_key,
    raw_category_key = excluded.raw_category_key,
    entity_kind_term_id = excluded.entity_kind_term_id,
    domain_term_id = excluded.domain_term_id,
    recommendation_family_term_id = excluded.recommendation_family_term_id,
    category_term_id = excluded.category_term_id,
    form_term_id = excluded.form_term_id,
    lifecycle_state = excluded.lifecycle_state,
    metadata = excluded.metadata;

create or replace function public.catalog_taxonomy_shadow_term_set_state_v1(
  p_taxonomy_version text,
  p_entity_kind_term_id text,
  p_domain_term_id text,
  p_recommendation_family_term_id text,
  p_category_term_id text,
  p_form_term_id text
)
returns text
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $function$
declare
  v_expected integer := 4 + case when p_form_term_id is null then 0 else 1 end;
  v_actual integer;
  v_has_reserved boolean;
  v_has_deprecated boolean;
begin
  if nullif(btrim(coalesce(p_taxonomy_version,'')),'') is null
     or p_entity_kind_term_id is null
     or p_domain_term_id is null
     or p_recommendation_family_term_id is null
     or p_category_term_id is null
  then
    return 'unresolved';
  end if;

  select count(*)::integer,
         coalesce(bool_or(term.lifecycle_state = 'reserved'), false),
         coalesce(bool_or(term.lifecycle_state = 'deprecated'), false)
  into v_actual, v_has_reserved, v_has_deprecated
  from public.catalog_taxonomy_terms as term
  where term.taxonomy_version = p_taxonomy_version
    and term.term_id = any(array_remove(array[
      p_entity_kind_term_id,
      p_domain_term_id,
      p_recommendation_family_term_id,
      p_category_term_id,
      p_form_term_id
    ]::text[], null));

  if v_actual <> v_expected then
    return 'unresolved';
  end if;
  if v_has_deprecated then
    return 'blocked_deprecated';
  end if;
  if v_has_reserved then
    return 'reserved_shadow';
  end if;
  return 'active_shadow';
end;
$function$;

revoke all on function public.catalog_taxonomy_shadow_term_set_state_v1(text,text,text,text,text,text)
  from public, anon, authenticated, service_role;

create or replace function public.resolve_catalog_taxonomy_source_category_v1(
  p_source_name text,
  p_category_path text,
  p_taxonomy_version text default 'catalog-taxonomy-v1'
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $function$
declare
  v_source_name_key text := public.normalize_basic_text(p_source_name);
  v_raw_category_key text := public.normalize_basic_text(p_category_path);
  v_rule public.catalog_taxonomy_candidate_source_rules%rowtype;
  v_state text;
begin
  if not exists (
    select 1
    from public.catalog_taxonomy_versions as version
    where version.version = p_taxonomy_version
      and version.lifecycle_state = 'shadow'
      and version.authority_mode = 'shadow_only'
  ) then
    return jsonb_build_object(
      'contract_version','candidate-catalog-taxonomy-classification-v1',
      'taxonomy_version',p_taxonomy_version,
      'classification_state','unresolved',
      'classification_method','unresolved',
      'failure_reason','taxonomy_version_not_shadow',
      'product_write_allowed',false,
      'product_promotion_allowed',false,
      'recommendation_admission_allowed',false
    );
  end if;

  if nullif(v_source_name_key,'') is null or nullif(v_raw_category_key,'') is null then
    return jsonb_build_object(
      'contract_version','candidate-catalog-taxonomy-classification-v1',
      'taxonomy_version',p_taxonomy_version,
      'classification_state','unresolved',
      'classification_method','unresolved',
      'failure_reason','source_category_missing',
      'product_write_allowed',false,
      'product_promotion_allowed',false,
      'recommendation_admission_allowed',false
    );
  end if;

  select rule.* into v_rule
  from public.catalog_taxonomy_candidate_source_rules as rule
  where rule.taxonomy_version = p_taxonomy_version
    and rule.source_name_key = v_source_name_key
    and rule.raw_category_key = v_raw_category_key
    and rule.lifecycle_state = 'active';

  if not found then
    return jsonb_build_object(
      'contract_version','candidate-catalog-taxonomy-classification-v1',
      'taxonomy_version',p_taxonomy_version,
      'classification_state','unresolved',
      'classification_method','unresolved',
      'failure_reason','exact_source_category_rule_missing',
      'product_write_allowed',false,
      'product_promotion_allowed',false,
      'recommendation_admission_allowed',false
    );
  end if;

  v_state := public.catalog_taxonomy_shadow_term_set_state_v1(
    p_taxonomy_version,
    v_rule.entity_kind_term_id,
    v_rule.domain_term_id,
    v_rule.recommendation_family_term_id,
    v_rule.category_term_id,
    v_rule.form_term_id
  );

  if v_state = 'unresolved' then
    return jsonb_build_object(
      'contract_version','candidate-catalog-taxonomy-classification-v1',
      'taxonomy_version',p_taxonomy_version,
      'classification_state','unresolved',
      'classification_method','unresolved',
      'failure_reason','registry_term_contract_invalid',
      'product_write_allowed',false,
      'product_promotion_allowed',false,
      'recommendation_admission_allowed',false
    );
  end if;

  return jsonb_build_object(
    'contract_version','candidate-catalog-taxonomy-classification-v1',
    'taxonomy_version',p_taxonomy_version,
    'classification_state',v_state,
    'classification_method','source_rule_v1',
    'source_rule_key',v_rule.rule_key,
    'entity_kind_term_id',v_rule.entity_kind_term_id,
    'domain_term_id',v_rule.domain_term_id,
    'recommendation_family_term_id',v_rule.recommendation_family_term_id,
    'category_term_id',v_rule.category_term_id,
    'form_term_id',v_rule.form_term_id,
    'failure_reason',null,
    'product_write_allowed',false,
    'product_promotion_allowed',false,
    'recommendation_admission_allowed',false
  );
end;
$function$;

revoke all on function public.resolve_catalog_taxonomy_source_category_v1(text,text,text)
  from public, anon, authenticated;
grant execute on function public.resolve_catalog_taxonomy_source_category_v1(text,text,text)
  to service_role;

create or replace function public.refresh_product_candidate_catalog_taxonomy_classification_v1(
  p_candidate_id uuid,
  p_taxonomy_version text default 'catalog-taxonomy-v1'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_candidate public.product_candidates%rowtype;
  v_projection public.catalog_taxonomy_legacy_projections%rowtype;
  v_resolution jsonb;
  v_state text;
  v_method text;
  v_source_rule_key text;
  v_legacy_projection_key text;
  v_entity_kind_term_id text;
  v_domain_term_id text;
  v_recommendation_family_term_id text;
  v_category_term_id text;
  v_form_term_id text;
  v_failure_reason text;
  v_source_snapshot jsonb;
begin
  if p_candidate_id is null then
    raise exception 'candidate_catalog_taxonomy_candidate_required' using errcode = '22004';
  end if;

  if not exists (
    select 1
    from public.catalog_taxonomy_versions as version
    where version.version = p_taxonomy_version
      and version.lifecycle_state = 'shadow'
      and version.authority_mode = 'shadow_only'
  ) then
    raise exception 'candidate_catalog_taxonomy_version_not_shadow' using errcode = '23514';
  end if;

  select candidate.* into v_candidate
  from public.product_candidates as candidate
  where candidate.id = p_candidate_id;

  if not found then
    raise exception 'candidate_catalog_taxonomy_candidate_not_found' using errcode = 'P0002';
  end if;

  if v_candidate.service_category is not null then
    select projection.* into v_projection
    from public.catalog_taxonomy_legacy_projections as projection
    where projection.taxonomy_version = p_taxonomy_version
      and projection.legacy_category = v_candidate.service_category
      and projection.legacy_product_form is not distinct from v_candidate.product_form
      and projection.lifecycle_state = 'active';

    if found then
      v_state := public.catalog_taxonomy_shadow_term_set_state_v1(
        p_taxonomy_version,
        v_projection.entity_kind_term_id,
        v_projection.domain_term_id,
        v_projection.recommendation_family_term_id,
        v_projection.category_term_id,
        v_projection.form_term_id
      );
      if v_state = 'unresolved' then
        v_method := 'unresolved';
        v_failure_reason := 'legacy_projection_term_contract_invalid';
      else
        v_method := 'manual_legacy_projection_v1';
        v_legacy_projection_key := v_projection.projection_key;
        v_entity_kind_term_id := v_projection.entity_kind_term_id;
        v_domain_term_id := v_projection.domain_term_id;
        v_recommendation_family_term_id := v_projection.recommendation_family_term_id;
        v_category_term_id := v_projection.category_term_id;
        v_form_term_id := v_projection.form_term_id;
      end if;
    else
      v_state := 'unresolved';
      v_method := 'unresolved';
      v_failure_reason := 'exact_legacy_projection_missing';
    end if;
  else
    v_resolution := public.resolve_catalog_taxonomy_source_category_v1(
      v_candidate.source_name,
      v_candidate.category_path,
      p_taxonomy_version
    );
    v_state := v_resolution ->> 'classification_state';
    v_method := v_resolution ->> 'classification_method';
    v_failure_reason := v_resolution ->> 'failure_reason';
    if v_method = 'source_rule_v1' then
      v_source_rule_key := v_resolution ->> 'source_rule_key';
      v_entity_kind_term_id := v_resolution ->> 'entity_kind_term_id';
      v_domain_term_id := v_resolution ->> 'domain_term_id';
      v_recommendation_family_term_id := v_resolution ->> 'recommendation_family_term_id';
      v_category_term_id := v_resolution ->> 'category_term_id';
      v_form_term_id := v_resolution ->> 'form_term_id';
    end if;
  end if;

  if v_state is null or v_method is null then
    v_state := 'unresolved';
    v_method := 'unresolved';
    v_failure_reason := coalesce(v_failure_reason,'classification_contract_invalid');
  end if;

  if v_method = 'unresolved' then
    v_source_rule_key := null;
    v_legacy_projection_key := null;
    v_entity_kind_term_id := null;
    v_domain_term_id := null;
    v_recommendation_family_term_id := null;
    v_category_term_id := null;
    v_form_term_id := null;
  end if;

  v_source_snapshot := jsonb_build_object(
    'contract_version','candidate-catalog-taxonomy-classification-v1',
    'source_name',v_candidate.source_name,
    'category_path',v_candidate.category_path,
    'legacy_service_category',case when v_candidate.service_category is null then null else v_candidate.service_category::text end,
    'legacy_product_form',case when v_candidate.product_form is null then null else v_candidate.product_form::text end,
    'failure_reason',v_failure_reason,
    'authority_boundary',jsonb_build_object(
      'product_write_allowed',false,
      'product_promotion_allowed',false,
      'recommendation_admission_allowed',false,
      'recommendation_runtime_cutover',false
    )
  );

  insert into public.product_candidate_catalog_taxonomy_classifications (
    candidate_id,
    taxonomy_version,
    source_name_snapshot,
    category_path_snapshot,
    legacy_category_snapshot,
    legacy_product_form_snapshot,
    classification_state,
    classification_method,
    source_rule_key,
    legacy_projection_key,
    entity_kind_term_id,
    domain_term_id,
    recommendation_family_term_id,
    category_term_id,
    form_term_id,
    product_write_allowed,
    product_promotion_allowed,
    recommendation_admission_allowed,
    source_snapshot,
    classified_at
  ) values (
    v_candidate.id,
    p_taxonomy_version,
    v_candidate.source_name,
    v_candidate.category_path,
    v_candidate.service_category,
    v_candidate.product_form,
    v_state,
    v_method,
    v_source_rule_key,
    v_legacy_projection_key,
    v_entity_kind_term_id,
    v_domain_term_id,
    v_recommendation_family_term_id,
    v_category_term_id,
    v_form_term_id,
    false,
    false,
    false,
    v_source_snapshot,
    now()
  )
  on conflict (candidate_id, taxonomy_version) do update
  set source_name_snapshot = excluded.source_name_snapshot,
      category_path_snapshot = excluded.category_path_snapshot,
      legacy_category_snapshot = excluded.legacy_category_snapshot,
      legacy_product_form_snapshot = excluded.legacy_product_form_snapshot,
      classification_state = excluded.classification_state,
      classification_method = excluded.classification_method,
      source_rule_key = excluded.source_rule_key,
      legacy_projection_key = excluded.legacy_projection_key,
      entity_kind_term_id = excluded.entity_kind_term_id,
      domain_term_id = excluded.domain_term_id,
      recommendation_family_term_id = excluded.recommendation_family_term_id,
      category_term_id = excluded.category_term_id,
      form_term_id = excluded.form_term_id,
      product_write_allowed = false,
      product_promotion_allowed = false,
      recommendation_admission_allowed = false,
      source_snapshot = excluded.source_snapshot,
      classified_at = excluded.classified_at;

  return jsonb_build_object(
    'contract_version','candidate-catalog-taxonomy-classification-v1',
    'candidate_id',v_candidate.id,
    'taxonomy_version',p_taxonomy_version,
    'classification_state',v_state,
    'classification_method',v_method,
    'source_rule_key',v_source_rule_key,
    'legacy_projection_key',v_legacy_projection_key,
    'entity_kind_term_id',v_entity_kind_term_id,
    'domain_term_id',v_domain_term_id,
    'recommendation_family_term_id',v_recommendation_family_term_id,
    'category_term_id',v_category_term_id,
    'form_term_id',v_form_term_id,
    'failure_reason',v_failure_reason,
    'product_write_allowed',false,
    'product_promotion_allowed',false,
    'recommendation_admission_allowed',false,
    'recommendation_runtime_cutover',false
  );
end;
$function$;

revoke all on function public.refresh_product_candidate_catalog_taxonomy_classification_v1(uuid,text)
  from public, anon, authenticated;
grant execute on function public.refresh_product_candidate_catalog_taxonomy_classification_v1(uuid,text)
  to service_role;

create or replace function public.sync_product_candidate_catalog_taxonomy_classification_v1()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  perform public.refresh_product_candidate_catalog_taxonomy_classification_v1(
    new.id,
    'catalog-taxonomy-v1'
  );
  return new;
end;
$function$;

revoke all on function public.sync_product_candidate_catalog_taxonomy_classification_v1()
  from public, anon, authenticated, service_role;

drop trigger if exists product_candidates_catalog_taxonomy_shadow_sync_v1
  on public.product_candidates;
create trigger product_candidates_catalog_taxonomy_shadow_sync_v1
after insert or update of source_name, category_path, service_category, product_form
on public.product_candidates
for each row
execute function public.sync_product_candidate_catalog_taxonomy_classification_v1();

do $function$
declare
  v_candidate_id uuid;
begin
  for v_candidate_id in
    select candidate.id
    from public.product_candidates as candidate
    order by candidate.id
  loop
    perform public.refresh_product_candidate_catalog_taxonomy_classification_v1(
      v_candidate_id,
      'catalog-taxonomy-v1'
    );
  end loop;
end;
$function$;

do $function$
declare
  v_unknown jsonb;
begin
  if (
    select count(*)
    from public.catalog_taxonomy_candidate_source_rules as rule
    where rule.taxonomy_version = 'catalog-taxonomy-v1'
      and rule.rule_key in (
        'catalog-taxonomy-v1:source:hwahae:cleanser',
        'catalog-taxonomy-v1:source:hwahae:sunscreen',
        'catalog-taxonomy-v1:source:hwahae:toner_essence',
        'catalog-taxonomy-v1:source:hwahae:treatment'
      )
      and rule.lifecycle_state = 'active'
  ) <> 4 then
    raise exception 'DATA_TAXONOMY2_ADOPTION_SOURCE_RULE_SET_INCOMPLETE';
  end if;

  if exists (
    select 1
    from public.product_candidates as candidate
    left join public.product_candidate_catalog_taxonomy_classifications as classification
      on classification.candidate_id = candidate.id
     and classification.taxonomy_version = 'catalog-taxonomy-v1'
    where classification.candidate_id is null
  ) then
    raise exception 'DATA_TAXONOMY2_CANDIDATE_BACKFILL_INCOMPLETE';
  end if;

  if exists (
    select 1
    from public.product_candidate_catalog_taxonomy_classifications as classification
    where classification.taxonomy_version = 'catalog-taxonomy-v1'
      and (
        classification.product_write_allowed
        or classification.product_promotion_allowed
        or classification.recommendation_admission_allowed
      )
  ) then
    raise exception 'DATA_TAXONOMY2_AUTHORITY_LEAK';
  end if;

  if exists (
    select 1
    from public.catalog_taxonomy_candidate_source_rules as rule
    where rule.taxonomy_version = 'catalog-taxonomy-v1'
      and rule.source_name_key = 'hwahae'
      and rule.raw_category_key in ('toner_essence','treatment')
      and rule.form_term_id is not null
  ) then
    raise exception 'DATA_TAXONOMY2_FORM_INFERENCE_FORBIDDEN';
  end if;

  if exists (
    select 1
    from public.product_candidate_catalog_taxonomy_classifications as classification
    join public.catalog_taxonomy_terms as term
      on term.taxonomy_version = classification.taxonomy_version
     and term.term_id = any(array_remove(array[
       classification.entity_kind_term_id,
       classification.domain_term_id,
       classification.recommendation_family_term_id,
       classification.category_term_id,
       classification.form_term_id
     ]::text[], null))
    where classification.taxonomy_version = 'catalog-taxonomy-v1'
      and classification.classification_state = 'active_shadow'
      and term.lifecycle_state <> 'active'
  ) then
    raise exception 'DATA_TAXONOMY2_ACTIVE_CLASSIFICATION_NONACTIVE_TERM';
  end if;

  v_unknown := public.resolve_catalog_taxonomy_source_category_v1(
    'data-taxonomy2-adoption-probe',
    'unknown-category',
    'catalog-taxonomy-v1'
  );

  if v_unknown ->> 'classification_state' <> 'unresolved'
     or v_unknown ->> 'classification_method' <> 'unresolved'
     or v_unknown ->> 'failure_reason' <> 'exact_source_category_rule_missing'
     or coalesce((v_unknown ->> 'product_write_allowed')::boolean, true)
     or coalesce((v_unknown ->> 'product_promotion_allowed')::boolean, true)
     or coalesce((v_unknown ->> 'recommendation_admission_allowed')::boolean, true)
  then
    raise exception 'DATA_TAXONOMY2_UNKNOWN_SOURCE_NOT_FAIL_CLOSED';
  end if;
end;
$function$;

commit;
