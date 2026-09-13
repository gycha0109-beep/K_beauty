begin;

-- Extend the existing legacy projection bridge only for combinations already
-- accepted by the governed candidate promotion contract but not present in
-- the DATA-TAXONOMY1 current-Product backfill.
insert into public.catalog_taxonomy_legacy_projections (
  projection_key,
  taxonomy_version,
  legacy_category,
  legacy_product_form,
  entity_kind_term_id,
  domain_term_id,
  recommendation_family_term_id,
  category_term_id,
  form_term_id,
  lifecycle_state,
  metadata
) values
  (
    'catalog-taxonomy-v1:legacy:moisturizer:none',
    'catalog-taxonomy-v1',
    'moisturizer'::public.product_category,
    null,
    'catalog-taxonomy-v1:entity_kind:cosmetic',
    'catalog-taxonomy-v1:domain:skincare',
    'catalog-taxonomy-v1:recommendation_family:moisturizer',
    'catalog-taxonomy-v1:category:moisturizer',
    null,
    'active',
    '{"candidate_promotion_contract":"allowed","runtime_authority":"legacy_unchanged"}'::jsonb
  ),
  (
    'catalog-taxonomy-v1:legacy:treatment:booster',
    'catalog-taxonomy-v1',
    'treatment'::public.product_category,
    'booster'::public.product_form,
    'catalog-taxonomy-v1:entity_kind:cosmetic',
    'catalog-taxonomy-v1:domain:skincare',
    'catalog-taxonomy-v1:recommendation_family:treatment',
    'catalog-taxonomy-v1:category:treatment',
    'catalog-taxonomy-v1:form:booster',
    'active',
    '{"candidate_promotion_contract":"allowed","runtime_authority":"legacy_unchanged"}'::jsonb
  ),
  (
    'catalog-taxonomy-v1:legacy:treatment:peeling_solution',
    'catalog-taxonomy-v1',
    'treatment'::public.product_category,
    'peeling_solution'::public.product_form,
    'catalog-taxonomy-v1:entity_kind:cosmetic',
    'catalog-taxonomy-v1:domain:skincare',
    'catalog-taxonomy-v1:recommendation_family:treatment',
    'catalog-taxonomy-v1:category:treatment',
    'catalog-taxonomy-v1:form:peeling_solution',
    'active',
    '{"candidate_promotion_contract":"allowed","runtime_authority":"legacy_unchanged"}'::jsonb
  );

create table public.catalog_taxonomy_candidate_source_rules (
  rule_key text primary key,
  taxonomy_version text not null references public.catalog_taxonomy_versions(version) on delete cascade,
  source_name_key text not null,
  raw_category_key text not null,
  entity_kind_term_id text not null,
  domain_term_id text not null,
  recommendation_family_term_id text not null,
  category_term_id text not null,
  form_term_id text,
  lifecycle_state text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint catalog_taxonomy_candidate_source_rules_key_version_unique
    unique (rule_key, taxonomy_version),
  constraint catalog_taxonomy_candidate_source_rules_input_unique
    unique (taxonomy_version, source_name_key, raw_category_key),
  constraint catalog_taxonomy_candidate_source_rules_source_key_check
    check (
      source_name_key = public.normalize_basic_text(source_name_key)
      and source_name_key <> ''
      and char_length(source_name_key) <= 120
    ),
  constraint catalog_taxonomy_candidate_source_rules_raw_category_check
    check (
      raw_category_key = public.normalize_basic_text(raw_category_key)
      and raw_category_key <> ''
      and char_length(raw_category_key) <= 240
    ),
  constraint catalog_taxonomy_candidate_source_rules_lifecycle_check
    check (lifecycle_state in ('active','deprecated')),
  constraint catalog_taxonomy_candidate_source_rules_metadata_check
    check (jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 16384),
  constraint catalog_taxonomy_candidate_source_rules_entity_kind_fk
    foreign key (entity_kind_term_id, taxonomy_version)
    references public.catalog_taxonomy_terms(term_id, taxonomy_version),
  constraint catalog_taxonomy_candidate_source_rules_domain_fk
    foreign key (domain_term_id, taxonomy_version)
    references public.catalog_taxonomy_terms(term_id, taxonomy_version),
  constraint catalog_taxonomy_candidate_source_rules_family_fk
    foreign key (recommendation_family_term_id, taxonomy_version)
    references public.catalog_taxonomy_terms(term_id, taxonomy_version),
  constraint catalog_taxonomy_candidate_source_rules_category_fk
    foreign key (category_term_id, taxonomy_version)
    references public.catalog_taxonomy_terms(term_id, taxonomy_version),
  constraint catalog_taxonomy_candidate_source_rules_form_fk
    foreign key (form_term_id, taxonomy_version)
    references public.catalog_taxonomy_terms(term_id, taxonomy_version),
  constraint catalog_taxonomy_candidate_source_rules_entity_kind_axis_check
    check (entity_kind_term_id like taxonomy_version || ':entity_kind:%'),
  constraint catalog_taxonomy_candidate_source_rules_domain_axis_check
    check (domain_term_id like taxonomy_version || ':domain:%'),
  constraint catalog_taxonomy_candidate_source_rules_family_axis_check
    check (recommendation_family_term_id like taxonomy_version || ':recommendation_family:%'),
  constraint catalog_taxonomy_candidate_source_rules_category_axis_check
    check (category_term_id like taxonomy_version || ':category:%'),
  constraint catalog_taxonomy_candidate_source_rules_form_axis_check
    check (form_term_id is null or form_term_id like taxonomy_version || ':form:%')
);

comment on table public.catalog_taxonomy_candidate_source_rules is
  'Exact raw-source category rules for shadow candidate taxonomy classification. Rules do not grant Product promotion or Recommendation authority.';

create table public.product_candidate_catalog_taxonomy_classifications (
  candidate_id uuid not null references public.product_candidates(id) on delete cascade,
  taxonomy_version text not null references public.catalog_taxonomy_versions(version) on delete cascade,
  source_name_snapshot text not null,
  category_path_snapshot text,
  legacy_category_snapshot public.product_category,
  legacy_product_form_snapshot public.product_form,
  classification_state text not null,
  classification_method text not null,
  source_rule_key text,
  legacy_projection_key text,
  entity_kind_term_id text,
  domain_term_id text,
  recommendation_family_term_id text,
  category_term_id text,
  form_term_id text,
  product_write_allowed boolean not null default false,
  product_promotion_allowed boolean not null default false,
  recommendation_admission_allowed boolean not null default false,
  source_snapshot jsonb not null,
  classified_at timestamptz not null default now(),
  primary key (candidate_id, taxonomy_version),
  constraint product_candidate_catalog_taxonomy_classifications_source_rule_fk
    foreign key (source_rule_key, taxonomy_version)
    references public.catalog_taxonomy_candidate_source_rules(rule_key, taxonomy_version),
  constraint product_candidate_catalog_taxonomy_classifications_projection_fk
    foreign key (legacy_projection_key, taxonomy_version)
    references public.catalog_taxonomy_legacy_projections(projection_key, taxonomy_version),
  constraint pctc_entity_kind_fk
    foreign key (entity_kind_term_id, taxonomy_version)
    references public.catalog_taxonomy_terms(term_id, taxonomy_version),
  constraint product_candidate_catalog_taxonomy_classifications_domain_fk
    foreign key (domain_term_id, taxonomy_version)
    references public.catalog_taxonomy_terms(term_id, taxonomy_version),
  constraint product_candidate_catalog_taxonomy_classifications_family_fk
    foreign key (recommendation_family_term_id, taxonomy_version)
    references public.catalog_taxonomy_terms(term_id, taxonomy_version),
  constraint product_candidate_catalog_taxonomy_classifications_category_fk
    foreign key (category_term_id, taxonomy_version)
    references public.catalog_taxonomy_terms(term_id, taxonomy_version),
  constraint product_candidate_catalog_taxonomy_classifications_form_fk
    foreign key (form_term_id, taxonomy_version)
    references public.catalog_taxonomy_terms(term_id, taxonomy_version),
  constraint product_candidate_catalog_taxonomy_classifications_state_check
    check (classification_state in ('active_shadow','reserved_shadow','blocked_deprecated','unresolved')),
  constraint product_candidate_catalog_taxonomy_classifications_method_check
    check (classification_method in ('source_rule_v1','manual_legacy_projection_v1','unresolved')),
  constraint product_candidate_catalog_taxonomy_classifications_authority_check
    check (
      product_write_allowed = false
      and product_promotion_allowed = false
      and recommendation_admission_allowed = false
    ),
  constraint product_candidate_catalog_taxonomy_classifications_snapshot_check
    check (jsonb_typeof(source_snapshot) = 'object' and octet_length(source_snapshot::text) <= 16384),
  constraint product_candidate_catalog_taxonomy_classifications_resolution_check
    check (
      (
        classification_state = 'unresolved'
        and classification_method = 'unresolved'
        and source_rule_key is null
        and legacy_projection_key is null
        and entity_kind_term_id is null
        and domain_term_id is null
        and recommendation_family_term_id is null
        and category_term_id is null
        and form_term_id is null
      )
      or
      (
        classification_state in ('active_shadow','reserved_shadow','blocked_deprecated')
        and classification_method in ('source_rule_v1','manual_legacy_projection_v1')
        and entity_kind_term_id is not null
        and domain_term_id is not null
        and recommendation_family_term_id is not null
        and category_term_id is not null
      )
    ),
  constraint product_candidate_catalog_taxonomy_classifications_method_source_check
    check (
      (classification_method = 'source_rule_v1' and source_rule_key is not null and legacy_projection_key is null)
      or (classification_method = 'manual_legacy_projection_v1' and legacy_projection_key is not null and source_rule_key is null)
      or (classification_method = 'unresolved' and source_rule_key is null and legacy_projection_key is null)
    ),
  constraint pctc_entity_kind_axis_check
    check (entity_kind_term_id is null or entity_kind_term_id like taxonomy_version || ':entity_kind:%'),
  constraint product_candidate_catalog_taxonomy_classifications_domain_axis_check
    check (domain_term_id is null or domain_term_id like taxonomy_version || ':domain:%'),
  constraint product_candidate_catalog_taxonomy_classifications_family_axis_check
    check (recommendation_family_term_id is null or recommendation_family_term_id like taxonomy_version || ':family:%'),
  constraint product_candidate_catalog_taxonomy_classifications_category_axis_check
    check (category_term_id is null or category_term_id like taxonomy_version || ':category:%'),
  constraint product_candidate_catalog_taxonomy_classifications_form_axis_check
    check (form_term_id is null or form_term_id like taxonomy_version || ':form:%')
);

comment on table public.product_candidate_catalog_taxonomy_classifications is
  'Shadow-only candidate taxonomy classification. It never authorizes Product writes, Product promotion, or Recommendation admission.';

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
  );

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

-- Backfill every existing candidate. Unknown/new raw categories remain present as
-- explicit `unresolved` shadow rows rather than being coerced to a nearby term.
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

-- Migration-local guardrails. These validate only shadow classification and
-- deliberately do not make classification authoritative for promotion/runtime.
do $function$
begin
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
end;
$function$;

commit;
