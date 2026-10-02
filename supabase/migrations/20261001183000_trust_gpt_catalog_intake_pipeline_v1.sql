begin;

create table if not exists public.gpt_catalog_intake_runs (
  request_id text primary key,
  payload_digest text not null,
  state text not null,
  candidate_id uuid references public.product_candidates(id) on delete restrict,
  product_id uuid references public.products(id) on delete restrict,
  intake_id uuid references public.catalog_trust_intake(id) on delete restrict,
  subject_id uuid references public.product_fact_subjects(subject_id) on delete restrict,
  source_binding_id uuid references public.product_source_bindings(binding_id) on delete restrict,
  blocker_code text,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gpt_catalog_intake_runs_request_check
    check (char_length(btrim(request_id)) between 8 and 160),
  constraint gpt_catalog_intake_runs_digest_check
    check (payload_digest ~ '^[0-9a-f]{64}$'),
  constraint gpt_catalog_intake_runs_state_check
    check (state in (
      'BLOCKED_UNSUPPORTED_CATEGORY',
      'BLOCKED_DUPLICATE',
      'BLOCKED_TAXONOMY',
      'CATALOG_PROMOTED',
      'TRUST_RESEARCH_READY',
      'TRUST_ALREADY_COVERED',
      'TRUST_REVIEW_REQUIRED'
    )),
  constraint gpt_catalog_intake_runs_result_check
    check (jsonb_typeof(result) = 'object' and octet_length(result::text) <= 65536)
);

comment on table public.gpt_catalog_intake_runs is
  'Operational idempotency and status ledger for GPT researched catalog intake. It is not Product Fact or Recommendation authority.';

alter table public.gpt_catalog_intake_runs enable row level security;
revoke all on table public.gpt_catalog_intake_runs from public, anon, authenticated, service_role;

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
    'catalog-taxonomy-v1:source:gpt_research:cleanser',
    'catalog-taxonomy-v1','gpt_research','cleanser',
    'catalog-taxonomy-v1:entity_kind:cosmetic',
    'catalog-taxonomy-v1:domain:skincare',
    'catalog-taxonomy-v1:recommendation_family:cleanser',
    'catalog-taxonomy-v1:category:cleanser',
    null,'active',
    '{"authority":"shadow_only","intake":"gpt_research","product_fact_authority":false}'::jsonb
  ),
  (
    'catalog-taxonomy-v1:source:gpt_research:toner_essence',
    'catalog-taxonomy-v1','gpt_research','toner_essence',
    'catalog-taxonomy-v1:entity_kind:cosmetic',
    'catalog-taxonomy-v1:domain:skincare',
    'catalog-taxonomy-v1:recommendation_family:toner',
    'catalog-taxonomy-v1:category:toner',
    null,'active',
    '{"authority":"shadow_only","intake":"gpt_research","product_fact_authority":false}'::jsonb
  ),
  (
    'catalog-taxonomy-v1:source:gpt_research:toner_pad',
    'catalog-taxonomy-v1','gpt_research','toner_pad',
    'catalog-taxonomy-v1:entity_kind:cosmetic',
    'catalog-taxonomy-v1:domain:skincare',
    'catalog-taxonomy-v1:recommendation_family:toner',
    'catalog-taxonomy-v1:category:toner',
    'catalog-taxonomy-v1:form:pad','active',
    '{"authority":"shadow_only","intake":"gpt_research","product_fact_authority":false}'::jsonb
  ),
  (
    'catalog-taxonomy-v1:source:gpt_research:treatment',
    'catalog-taxonomy-v1','gpt_research','treatment',
    'catalog-taxonomy-v1:entity_kind:cosmetic',
    'catalog-taxonomy-v1:domain:skincare',
    'catalog-taxonomy-v1:recommendation_family:treatment',
    'catalog-taxonomy-v1:category:treatment',
    null,'active',
    '{"authority":"shadow_only","intake":"gpt_research","product_fact_authority":false}'::jsonb
  ),
  (
    'catalog-taxonomy-v1:source:gpt_research:moisturizer',
    'catalog-taxonomy-v1','gpt_research','moisturizer',
    'catalog-taxonomy-v1:entity_kind:cosmetic',
    'catalog-taxonomy-v1:domain:skincare',
    'catalog-taxonomy-v1:recommendation_family:moisturizer',
    'catalog-taxonomy-v1:category:moisturizer',
    null,'active',
    '{"authority":"shadow_only","intake":"gpt_research","product_fact_authority":false}'::jsonb
  ),
  (
    'catalog-taxonomy-v1:source:gpt_research:moisturizer_lotion_emulsion',
    'catalog-taxonomy-v1','gpt_research','moisturizer_lotion_emulsion',
    'catalog-taxonomy-v1:entity_kind:cosmetic',
    'catalog-taxonomy-v1:domain:skincare',
    'catalog-taxonomy-v1:recommendation_family:moisturizer',
    'catalog-taxonomy-v1:category:moisturizer',
    'catalog-taxonomy-v1:form:lotion_emulsion','active',
    '{"authority":"shadow_only","intake":"gpt_research","product_fact_authority":false}'::jsonb
  ),
  (
    'catalog-taxonomy-v1:source:gpt_research:moisturizer_gel',
    'catalog-taxonomy-v1','gpt_research','moisturizer_gel',
    'catalog-taxonomy-v1:entity_kind:cosmetic',
    'catalog-taxonomy-v1:domain:skincare',
    'catalog-taxonomy-v1:recommendation_family:moisturizer',
    'catalog-taxonomy-v1:category:moisturizer',
    'catalog-taxonomy-v1:form:gel','active',
    '{"authority":"shadow_only","intake":"gpt_research","product_fact_authority":false}'::jsonb
  ),
  (
    'catalog-taxonomy-v1:source:gpt_research:moisturizer_cream',
    'catalog-taxonomy-v1','gpt_research','moisturizer_cream',
    'catalog-taxonomy-v1:entity_kind:cosmetic',
    'catalog-taxonomy-v1:domain:skincare',
    'catalog-taxonomy-v1:recommendation_family:moisturizer',
    'catalog-taxonomy-v1:category:moisturizer',
    'catalog-taxonomy-v1:form:cream','active',
    '{"authority":"shadow_only","intake":"gpt_research","product_fact_authority":false}'::jsonb
  ),
  (
    'catalog-taxonomy-v1:source:gpt_research:moisturizer_balm',
    'catalog-taxonomy-v1','gpt_research','moisturizer_balm',
    'catalog-taxonomy-v1:entity_kind:cosmetic',
    'catalog-taxonomy-v1:domain:skincare',
    'catalog-taxonomy-v1:recommendation_family:moisturizer',
    'catalog-taxonomy-v1:category:moisturizer',
    'catalog-taxonomy-v1:form:balm','active',
    '{"authority":"shadow_only","intake":"gpt_research","product_fact_authority":false}'::jsonb
  ),
  (
    'catalog-taxonomy-v1:source:gpt_research:sunscreen',
    'catalog-taxonomy-v1','gpt_research','sunscreen',
    'catalog-taxonomy-v1:entity_kind:cosmetic',
    'catalog-taxonomy-v1:domain:skincare',
    'catalog-taxonomy-v1:recommendation_family:sunscreen',
    'catalog-taxonomy-v1:category:sunscreen',
    null,'active',
    '{"authority":"shadow_only","intake":"gpt_research","product_fact_authority":false}'::jsonb
  )
on conflict (rule_key) do update
set lifecycle_state = excluded.lifecycle_state,
    metadata = excluded.metadata;

create or replace function public.enqueue_catalog_trust_intake_from_promotion_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_market text;
  v_catalog_revision text;
  v_category text;
begin
  if new.review_status = 'promoted'::public.product_review_status
    and old.review_status is distinct from 'promoted'::public.product_review_status
    and new.matched_product_id is not null
  then
    v_market := case
      when lower(coalesce(new.source_name, '')) = 'hwahae' then 'KR'
      when lower(coalesce(new.source_name, '')) = 'gpt_research'
        then nullif(upper(btrim(coalesce(new.identity_resolution_evidence #>> '{gpt_research,market}', ''))), '')
      else null
    end;
    v_catalog_revision := 'candidate:' || new.id::text || ':' || coalesce(new.promotion_version, 'unknown');
    v_category := nullif(btrim(coalesce(new.service_category::text, '')), '');

    if v_category is null
      and new.promotion_version = 'catalog-only-product-transactional-adoption-v1'
    then
      select rule.raw_category_key
        into v_category
      from public.product_candidate_catalog_taxonomy_classifications as classification
      join public.catalog_taxonomy_candidate_source_rules as rule
        on rule.rule_key = classification.source_rule_key
       and rule.taxonomy_version = classification.taxonomy_version
      where classification.candidate_id = new.id
        and classification.taxonomy_version = 'catalog-taxonomy-v1'
        and classification.source_name_snapshot is not distinct from new.source_name
        and classification.category_path_snapshot is not distinct from new.category_path
        and classification.legacy_category_snapshot is null
        and classification.legacy_product_form_snapshot is null
        and classification.classification_state = 'active_shadow'
        and classification.classification_method = 'source_rule_v1'
        and classification.source_rule_key is not null
        and classification.legacy_projection_key is null
        and classification.product_write_allowed is false
        and classification.product_promotion_allowed is false
        and classification.recommendation_admission_allowed is false
        and rule.lifecycle_state = 'active'
        and rule.source_name_key = lower(btrim(new.source_name))
        and rule.raw_category_key = lower(btrim(new.category_path))
        and rule.entity_kind_term_id is not distinct from classification.entity_kind_term_id
        and rule.domain_term_id is not distinct from classification.domain_term_id
        and rule.recommendation_family_term_id is not distinct from classification.recommendation_family_term_id
        and rule.category_term_id is not distinct from classification.category_term_id
        and rule.form_term_id is not distinct from classification.form_term_id
      limit 1;
    end if;

    if v_category is null then
      raise exception 'DATA-TAXONOMY15: promoted candidate % has no governed TRUST intake category', new.id
        using errcode = '23514';
    end if;

    insert into public.catalog_trust_intake (
      product_id, source_candidate_id, catalog_revision, category, market,
      identity_state, trust_state, required_fact_policy_version, created_at, updated_at
    ) values (
      new.matched_product_id, new.id, v_catalog_revision, v_category, v_market,
      'PENDING', 'PENDING', 'product-fact-required-policy-v1', now(), now()
    )
    on conflict (product_id, catalog_revision) do nothing;
  end if;

  return new;
end;
$function$;

revoke all on function public.enqueue_catalog_trust_intake_from_promotion_v1()
  from public, anon, authenticated, service_role;

create or replace function public.process_gpt_catalog_trust_product_pinned_v1(
  p_product_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_registry_version constant text := 'product-fact-registry-cross-category-v1';
  v_result jsonb;
  v_dispatch text;
begin
  if not exists (
    select 1
    from public.product_fact_registry_versions r
    where r.registry_version = v_registry_version
      and (r.effective_at is null or r.effective_at <= now())
  ) then
    raise exception 'gpt_catalog_registry_pin_unavailable:%', v_registry_version
      using errcode = '23514';
  end if;

  if to_regprocedure('public.process_catalog_trust_product_v3(uuid,text)') is not null then
    execute 'select public.process_catalog_trust_product_v3($1,$2)'
      into v_result
      using p_product_id, v_registry_version;
    v_dispatch := 'process_catalog_trust_product_v3';
  elsif to_regprocedure('public.process_catalog_trust_product_v2(uuid,text)') is not null then
    execute 'select public.process_catalog_trust_product_v2($1,$2)'
      into v_result
      using p_product_id, v_registry_version;
    v_dispatch := 'process_catalog_trust_product_v2';
  else
    v_result := public.process_catalog_trust_product_v1(p_product_id);
    v_dispatch := 'process_catalog_trust_product_v1';
  end if;

  return coalesce(v_result, '{}'::jsonb) || jsonb_build_object(
    'gpt_registry_pin', v_registry_version,
    'gpt_trust_dispatch', v_dispatch
  );
end;
$function$;

comment on function public.process_gpt_catalog_trust_product_pinned_v1(uuid) is
  'Internal GPT catalog TRUST processor. Pins Product Fact Registry v1 and dispatches to the newest governed catalog processor available, falling back to historical v1 only in older isolated replay baselines.';

revoke all on function public.process_gpt_catalog_trust_product_pinned_v1(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.ingest_gpt_catalog_product_v1(
  p_request_id text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_request_id text := btrim(coalesce(p_request_id, ''));
  v_payload_digest text;
  v_existing public.gpt_catalog_intake_runs%rowtype;
  v_brand text;
  v_name text;
  v_category text;
  v_market text;
  v_locale text;
  v_official_url text;
  v_final_url text;
  v_external_id text;
  v_content_digest text;
  v_content_type text;
  v_fetched_at timestamptz;
  v_normalized_brand text;
  v_normalized_name text;
  v_providers jsonb;
  v_provider_count integer := 0;
  v_distinct_provider_count integer := 0;
  v_provider_mismatch_count integer := 0;
  v_official_provider_count integer := 0;
  v_candidate_id uuid;
  v_product_id uuid;
  v_intake_id uuid;
  v_subject_id uuid;
  v_binding_id uuid;
  v_classification jsonb;
  v_promotion jsonb;
  v_intake public.catalog_trust_intake%rowtype;
  v_subject_semantic_key text;
  v_formulation_revision_key text;
  v_required_fact_count integer := 0;
  v_research_pending_count integer := 0;
  v_already_covered_count integer := 0;
  v_review_count integer := 0;
  v_result jsonb;
  v_state text;
begin
  if char_length(v_request_id) not between 8 and 160 then
    raise exception 'gpt_catalog_request_id_invalid' using errcode = '22023';
  end if;
  if p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
     or octet_length(p_payload::text) > 65536
     or p_payload ->> 'contract_version' is distinct from 'gpt-catalog-research-v1'
  then
    raise exception 'gpt_catalog_payload_invalid' using errcode = '22023';
  end if;

  v_payload_digest := public.product_fact_controlled_sha256_json_v1(p_payload);
  select * into v_existing
  from public.gpt_catalog_intake_runs
  where request_id = v_request_id;

  if found then
    if v_existing.payload_digest <> v_payload_digest then
      raise exception 'gpt_catalog_request_reuse_conflict' using errcode = '23505';
    end if;
    return v_existing.result || jsonb_build_object('idempotent', true);
  end if;

  v_brand := btrim(coalesce(p_payload ->> 'brand', ''));
  v_name := btrim(coalesce(p_payload ->> 'product_name', ''));
  v_category := lower(btrim(coalesce(p_payload ->> 'category', '')));
  v_market := upper(btrim(coalesce(p_payload ->> 'market', '')));
  v_locale := nullif(btrim(coalesce(p_payload ->> 'locale', '')), '');
  v_official_url := btrim(coalesce(p_payload ->> 'official_url', ''));
  v_external_id := nullif(btrim(coalesce(p_payload ->> 'official_external_id', '')), '');
  v_providers := p_payload #> '{identity_evidence,providers}';
  v_final_url := btrim(coalesce(p_payload #>> '{official_fetch,final_url}', ''));
  v_content_digest := lower(btrim(coalesce(p_payload #>> '{official_fetch,content_digest}', '')));
  v_content_type := btrim(coalesce(p_payload #>> '{official_fetch,content_type}', ''));

  begin
    v_fetched_at := (p_payload #>> '{official_fetch,fetched_at}')::timestamptz;
  exception when others then
    raise exception 'gpt_catalog_fetch_timestamp_invalid' using errcode = '22023';
  end;

  if char_length(v_brand) not between 1 and 200
     or char_length(v_name) not between 2 and 300
     or v_market !~ '^[A-Z0-9_-]{2,16}$'
     or v_official_url !~ '^https://'
     or v_final_url !~ '^https://'
     or v_content_digest !~ '^[0-9a-f]{64}$'
     or char_length(v_content_type) not between 3 and 160
     or v_fetched_at < now() - interval '24 hours'
     or v_fetched_at > now() + interval '5 minutes'
     or (v_locale is not null and char_length(v_locale) > 32)
     or (v_external_id is not null and char_length(v_external_id) > 240)
  then
    raise exception 'gpt_catalog_payload_fields_invalid' using errcode = '22023';
  end if;

  if jsonb_typeof(v_providers) is distinct from 'array'
     or jsonb_array_length(v_providers) < 2
     or jsonb_array_length(v_providers) > 10
  then
    raise exception 'gpt_catalog_identity_evidence_invalid' using errcode = '22023';
  end if;

  v_normalized_brand := public.normalize_brand_key(v_brand);
  v_normalized_name := public.normalize_product_key(v_name);
  if nullif(v_normalized_brand, '') is null or nullif(v_normalized_name, '') is null then
    raise exception 'gpt_catalog_normalized_identity_invalid' using errcode = '22023';
  end if;

  select
    count(*)::integer,
    count(distinct lower(btrim(provider.value ->> 'provider')))::integer,
    count(*) filter (
      where jsonb_typeof(provider.value) <> 'object'
         or nullif(btrim(provider.value ->> 'provider'), '') is null
         or nullif(btrim(provider.value ->> 'locator'), '') is null
         or provider.value ->> 'locator' !~ '^https://'
         or public.normalize_brand_key(provider.value ->> 'canonical_brand') is distinct from v_normalized_brand
         or public.normalize_product_key(provider.value ->> 'canonical_name') is distinct from v_normalized_name
    )::integer,
    count(*) filter (
      where lower(btrim(provider.value ->> 'provider')) like '%official%'
        and (provider.value ->> 'locator' = v_official_url or provider.value ->> 'locator' = v_final_url)
    )::integer
  into
    v_provider_count,
    v_distinct_provider_count,
    v_provider_mismatch_count,
    v_official_provider_count
  from jsonb_array_elements(v_providers) as provider(value);

  if v_provider_count < 2
     or v_distinct_provider_count < 2
     or v_provider_mismatch_count > 0
     or v_official_provider_count < 1
  then
    raise exception 'gpt_catalog_identity_evidence_not_converged' using errcode = '23514';
  end if;

  if v_category <> all(array[
    'cleanser','toner_essence','toner_pad','treatment','moisturizer',
    'moisturizer_lotion_emulsion','moisturizer_gel','moisturizer_cream',
    'moisturizer_balm','sunscreen'
  ]::text[]) then
    v_result := jsonb_build_object(
      'status','blocked',
      'state','BLOCKED_UNSUPPORTED_CATEGORY',
      'blocker_code','UNSUPPORTED_TRUST_CATEGORY',
      'category',v_category,
      'automatic_confirmation',false
    );
    insert into public.gpt_catalog_intake_runs(request_id,payload_digest,state,blocker_code,result)
    values(v_request_id,v_payload_digest,'BLOCKED_UNSUPPORTED_CATEGORY','UNSUPPORTED_TRUST_CATEGORY',v_result);
    return v_result || jsonb_build_object('idempotent', false);
  end if;

  select count(*)::integer into v_required_fact_count
  from public.catalog_required_product_facts_v1(v_category);
  if v_required_fact_count = 0 then
    v_result := jsonb_build_object(
      'status','blocked',
      'state','BLOCKED_UNSUPPORTED_CATEGORY',
      'blocker_code','NO_REQUIRED_FACT_POLICY',
      'category',v_category,
      'automatic_confirmation',false
    );
    insert into public.gpt_catalog_intake_runs(request_id,payload_digest,state,blocker_code,result)
    values(v_request_id,v_payload_digest,'BLOCKED_UNSUPPORTED_CATEGORY','NO_REQUIRED_FACT_POLICY',v_result);
    return v_result || jsonb_build_object('idempotent', false);
  end if;

  if exists (
    select 1 from public.products p
    where p.normalized_brand = v_normalized_brand
      and p.normalized_name = v_normalized_name
  ) then
    select p.id into v_product_id
    from public.products p
    where p.normalized_brand = v_normalized_brand
      and p.normalized_name = v_normalized_name
    order by p.created_at, p.id
    limit 1;

    v_result := jsonb_build_object(
      'status','blocked',
      'state','BLOCKED_DUPLICATE',
      'blocker_code','NORMALIZED_PRODUCT_ALREADY_EXISTS',
      'product_id',v_product_id,
      'automatic_confirmation',false
    );
    insert into public.gpt_catalog_intake_runs(request_id,payload_digest,state,product_id,blocker_code,result)
    values(v_request_id,v_payload_digest,'BLOCKED_DUPLICATE',v_product_id,'NORMALIZED_PRODUCT_ALREADY_EXISTS',v_result);
    return v_result || jsonb_build_object('idempotent', false);
  end if;

  insert into public.product_candidates (
    source_name,
    category_path,
    product_name_raw,
    brand_name_raw,
    normalized_name,
    normalized_brand,
    status,
    canonical_name,
    canonical_brand,
    review_status,
    review_notes,
    reviewed_at,
    reviewed_by,
    promotion_payload,
    match_method,
    match_confidence,
    review_flags,
    promotion_version,
    external_type,
    external_id,
    source_url,
    first_seen_at,
    last_seen_at,
    seen_count,
    latest_raw_source,
    identity_resolution_state,
    identity_resolution_version,
    identity_resolution_evidence
  ) values (
    'gpt_research',
    v_category,
    v_name,
    v_brand,
    v_normalized_name,
    v_normalized_brand,
    'new',
    v_name,
    v_brand,
    'new'::public.product_review_status,
    'Machine-validated GPT research intake; Product Fact authority remains disabled.',
    null,
    null,
    jsonb_build_object(
      'contract_version','gpt-catalog-research-v1',
      'automatic_catalog_promotion',true,
      'recommendation_admission_allowed',false,
      'product_fact_confirmation_allowed',false
    ),
    'gpt_identity_convergence_v1',
    1,
    '{}'::text[],
    'gpt-catalog-research-v1',
    'brand_official_product_page',
    coalesce(v_external_id, 'url:' || public.product_fact_controlled_sha256_json_v1(jsonb_build_object('url',v_final_url))),
    v_final_url,
    v_fetched_at,
    v_fetched_at,
    1,
    jsonb_build_object(
      'contract_version','gpt-catalog-research-v1',
      'official_fetch',p_payload -> 'official_fetch'
    ),
    'resolved',
    'crawler-identity-resolution-v1',
    jsonb_build_object(
      'contract_version','gpt-catalog-identity-evidence-v1',
      'gpt_research',jsonb_build_object(
        'market',v_market,
        'locale',v_locale,
        'official_url',v_final_url,
        'official_content_digest',v_content_digest,
        'providers',v_providers
      ),
      'authority_boundary',jsonb_build_object(
        'product_write_allowed',false,
        'taxonomy_assignment_write_allowed',false,
        'recommendation_admission_allowed',false,
        'recommendation_runtime_cutover',false,
        'product_fact_write_allowed',false,
        'product_fact_confirmation_allowed',false
      )
    )
  )
  returning id into v_candidate_id;

  v_classification := public.refresh_product_candidate_catalog_taxonomy_classification_v1(
    v_candidate_id,
    'catalog-taxonomy-v1'
  );

  if v_classification ->> 'classification_state' <> 'active_shadow'
     or v_classification ->> 'classification_method' <> 'source_rule_v1'
  then
    v_result := jsonb_build_object(
      'status','blocked',
      'state','BLOCKED_TAXONOMY',
      'blocker_code','GPT_CATALOG_TAXONOMY_NOT_ACTIVE',
      'candidate_id',v_candidate_id,
      'classification',v_classification,
      'automatic_confirmation',false
    );
    insert into public.gpt_catalog_intake_runs(
      request_id,payload_digest,state,candidate_id,blocker_code,result
    ) values (
      v_request_id,v_payload_digest,'BLOCKED_TAXONOMY',v_candidate_id,
      'GPT_CATALOG_TAXONOMY_NOT_ACTIVE',v_result
    );
    return v_result || jsonb_build_object('idempotent', false);
  end if;

  update public.product_candidates
  set review_status = 'approved'::public.product_review_status,
      reviewed_at = now(),
      reviewed_by = 'machine:gpt-catalog-intake-v1',
      review_notes = 'GPT research passed crawler-equivalent identity, duplicate, taxonomy, and official transport gates.',
      updated_at = now()
  where id = v_candidate_id;

  v_promotion := public.promote_product_candidate_catalog_only_v1(
    v_candidate_id,
    'machine:gpt-catalog-intake-v1'
  );
  v_product_id := nullif(v_promotion ->> 'product_id','')::uuid;
  if v_product_id is null then
    raise exception 'gpt_catalog_promotion_product_missing' using errcode = '55000';
  end if;

  select binding_id into v_binding_id
  from public.product_source_bindings
  where source_name = 'gpt_official'
    and external_type = 'brand_official_product_page'
    and external_id = coalesce(v_external_id, 'url:' || public.product_fact_controlled_sha256_json_v1(jsonb_build_object('url',v_final_url)))
    and binding_state = 'resolved'
  limit 1;

  if v_binding_id is not null then
    if not exists (
      select 1 from public.product_source_bindings
      where binding_id = v_binding_id and product_id = v_product_id
    ) then
      raise exception 'gpt_catalog_official_binding_collision' using errcode = '23505';
    end if;
  else
    insert into public.product_source_bindings (
      product_id, source_name, external_type, external_id, source_url,
      market_code, locale, binding_state, binding_method, product_scope_state,
      first_observed_at, last_observed_at
    ) values (
      v_product_id,
      'gpt_official',
      'brand_official_product_page',
      coalesce(v_external_id, 'url:' || public.product_fact_controlled_sha256_json_v1(jsonb_build_object('url',v_final_url))),
      v_final_url,
      v_market,
      v_locale,
      'resolved',
      'gpt_verified_official_transport_v1',
      'product',
      v_fetched_at,
      v_fetched_at
    )
    returning binding_id into v_binding_id;
  end if;

  perform public.process_gpt_catalog_trust_product_pinned_v1(v_product_id);

  select * into v_intake
  from public.catalog_trust_intake
  where product_id = v_product_id
    and source_candidate_id = v_candidate_id
  order by created_at desc, id desc
  limit 1
  for update;

  if not found then
    raise exception 'gpt_catalog_trust_intake_missing' using errcode = '55000';
  end if;

  if v_intake.identity_state = 'SUBJECT_CREATION_REQUIRED'
     and v_intake.trust_state = 'REVIEW_REQUIRED'
     and v_intake.subject_id is null
     and v_intake.identity_resolution_detail ->> 'reason_code' = 'no_product_fact_subject_exists'
     and coalesce((v_intake.identity_resolution_detail ->> 'total_subject_count')::integer, 0) = 0
  then
    if exists (
      select 1 from public.product_fact_subjects s
      where s.product_id = v_product_id
    ) then
      raise exception 'gpt_catalog_machine_subject_competing_identity' using errcode = '23514';
    end if;

    v_formulation_revision_key := 'official-snapshot:' || substr(v_content_digest, 1, 32);
    v_subject_semantic_key := public.product_fact_controlled_sha256_json_v1(
      jsonb_build_object(
        'product_id',v_product_id,
        'variant_key',null,
        'formulation_revision_key',v_formulation_revision_key,
        'market_applicability',v_market,
        'region_applicability',null,
        'valid_from',null,
        'valid_to',null
      )
    );

    insert into public.product_fact_subjects (
      product_id,
      subject_semantic_key,
      subject_identity_serializer_version,
      variant_key,
      formulation_revision_key,
      formulation_label,
      identity_status,
      identity_resolution_version,
      current_state,
      market_applicability,
      region_applicability,
      valid_from,
      valid_to,
      predecessor_subject_id,
      supersession_kind
    ) values (
      v_product_id,
      v_subject_semantic_key,
      'product-fact-subject-identity-v1',
      null,
      v_formulation_revision_key,
      'Initial official product snapshot from GPT catalog intake',
      'resolved',
      'gpt-catalog-machine-subject-v1',
      'current',
      v_market,
      null,
      null,
      null,
      null,
      null
    )
    returning subject_id into v_subject_id;

    perform public.process_gpt_catalog_trust_product_pinned_v1(v_product_id);
  else
    v_subject_id := v_intake.subject_id;
  end if;

  select * into v_intake
  from public.catalog_trust_intake
  where id = v_intake.id;

  v_subject_id := coalesce(v_subject_id, v_intake.subject_id);

  select
    count(*) filter (where state = 'RESEARCH_PENDING')::integer,
    count(*) filter (where state = 'ALREADY_COVERED')::integer,
    count(*) filter (where state in ('REVIEW_REQUIRED','BLOCKED'))::integer
  into v_research_pending_count, v_already_covered_count, v_review_count
  from public.product_fact_research_tasks
  where intake_id = v_intake.id;

  if v_intake.identity_state = 'EXACT_SUBJECT_FOUND'
     and v_research_pending_count > 0
     and v_review_count = 0
  then
    v_state := 'TRUST_RESEARCH_READY';
  elsif v_intake.identity_state = 'EXACT_SUBJECT_FOUND'
     and v_research_pending_count = 0
     and v_review_count = 0
     and v_already_covered_count > 0
  then
    v_state := 'TRUST_ALREADY_COVERED';
  else
    v_state := 'TRUST_REVIEW_REQUIRED';
  end if;

  v_result := jsonb_build_object(
    'status',case when v_state = 'TRUST_RESEARCH_READY' then 'ready_for_research' else 'review_required' end,
    'state',v_state,
    'candidate_id',v_candidate_id,
    'product_id',v_product_id,
    'intake_id',v_intake.id,
    'subject_id',v_subject_id,
    'source_binding_id',v_binding_id,
    'category',v_category,
    'market',v_market,
    'task_counts',jsonb_build_object(
      'research_pending',v_research_pending_count,
      'already_covered',v_already_covered_count,
      'review_or_blocked',v_review_count
    ),
    'authority',jsonb_build_object(
      'recommendation_admission',false,
      'product_fact_confirmation',false,
      'automatic_confirmation',false
    )
  );

  insert into public.gpt_catalog_intake_runs (
    request_id,payload_digest,state,candidate_id,product_id,intake_id,subject_id,
    source_binding_id,blocker_code,result
  ) values (
    v_request_id,v_payload_digest,v_state,v_candidate_id,v_product_id,v_intake.id,
    v_subject_id,v_binding_id,
    case when v_state = 'TRUST_REVIEW_REQUIRED' then 'TRUST_REVIEW_REQUIRED' else null end,
    v_result
  );

  return v_result || jsonb_build_object('idempotent', false);
end;
$function$;

comment on function public.ingest_gpt_catalog_product_v1(text,jsonb) is
  'Service-role GPT research intake. Performs strict identity/taxonomy/duplicate gates, catalog-only promotion, official binding, bounded initial Product Fact Subject creation, and TRUST task creation. It never confirms Product Facts or activates Recommendation.';

revoke all on function public.ingest_gpt_catalog_product_v1(text,jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.ingest_gpt_catalog_product_v1(text,jsonb)
  to service_role;

create or replace function public.claim_gpt_catalog_research_tasks_v1(
  p_product_id uuid,
  p_limit integer default 10,
  p_lease_seconds integer default 300
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
begin
  if p_product_id is null then
    raise exception 'gpt_catalog_research_product_required' using errcode = '22004';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 25 then
    raise exception 'gpt_catalog_research_limit_invalid' using errcode = '22023';
  end if;
  if p_lease_seconds is null or p_lease_seconds < 30 or p_lease_seconds > 1800 then
    raise exception 'gpt_catalog_research_lease_invalid' using errcode = '22023';
  end if;

  update public.product_fact_research_tasks
  set state = 'RESEARCH_PENDING',
      next_retry_at = now(),
      blocker_code = 'WORKER_LEASE_EXPIRED',
      blocker_detail = 'Previous product-scoped GPT research lease expired before a result was recorded.',
      updated_at = now()
  where product_id = p_product_id
    and state = 'RESEARCHING'
    and last_research_at is not null
    and last_research_at < now() - make_interval(secs => p_lease_seconds);

  with eligible as (
    select rt.id
    from public.product_fact_research_tasks rt
    join public.catalog_trust_intake i on i.id = rt.intake_id
    join public.product_fact_subjects s on s.subject_id = rt.subject_id
    where rt.product_id = p_product_id
      and rt.state = 'RESEARCH_PENDING'
      and rt.subject_id is not null
      and (rt.next_retry_at is null or rt.next_retry_at <= now())
      and i.identity_state = 'EXACT_SUBJECT_FOUND'
      and i.subject_id = rt.subject_id
      and s.product_id = rt.product_id
      and s.identity_status = 'resolved'
      and s.current_state = 'current'
      and s.market_applicability is not distinct from i.market
      and s.variant_key is null
    order by rt.priority desc, rt.created_at, rt.id
    for update of rt skip locked
    limit p_limit
  ), claimed as (
    update public.product_fact_research_tasks rt
    set state = 'RESEARCHING',
        attempt_count = rt.attempt_count + 1,
        next_retry_at = null,
        blocker_code = null,
        blocker_detail = null,
        last_research_at = now(),
        updated_at = now()
    from eligible e
    where rt.id = e.id
    returning rt.*
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'task_id',c.id,
      'product_id',c.product_id,
      'subject_id',c.subject_id,
      'fact_key',c.fact_key,
      'registry_version',c.registry_version,
      'research_policy_version',c.research_policy_version,
      'attempt_count',c.attempt_count,
      'official_source_seeds',coalesce((
        select jsonb_agg(jsonb_build_object(
          'source_binding_id',psb.binding_id,
          'source_name',psb.source_name,
          'external_type',psb.external_type,
          'binding_method',psb.binding_method,
          'product_scope_state',psb.product_scope_state,
          'canonical_locator',psb.source_url,
          'market',psb.market_code,
          'locale',psb.locale
        ) order by psb.created_at, psb.binding_id)
        from public.product_source_bindings psb
        join public.catalog_trust_intake i2 on i2.id = c.intake_id
        where psb.product_id = c.product_id
          and psb.binding_state = 'resolved'
          and psb.source_name ~ '_official$'
          and psb.source_url ~ '^https://'
          and psb.market_code is not distinct from i2.market
      ),'[]'::jsonb),
      'current_fact_context',null,
      'parent_propositions','[]'::jsonb
    )
    order by c.priority desc, c.created_at, c.id
  ),'[]'::jsonb)
  into v_result
  from claimed c;

  return v_result;
end;
$function$;

comment on function public.claim_gpt_catalog_research_tasks_v1(uuid,integer,integer) is
  'Service-role product-scoped TRUST research claim for GPT catalog intake. It cannot claim another Product and grants no Product Fact confirmation authority.';

revoke all on function public.claim_gpt_catalog_research_tasks_v1(uuid,integer,integer)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_gpt_catalog_research_tasks_v1(uuid,integer,integer)
  to service_role;

create or replace function public.read_gpt_catalog_intake_run_v1(p_request_id text)
returns jsonb
language sql
security definer
stable
set search_path = ''
as $function$
  select coalesce(
    (
      select jsonb_build_object(
        'request_id',r.request_id,
        'state',r.state,
        'candidate_id',r.candidate_id,
        'product_id',r.product_id,
        'intake_id',r.intake_id,
        'subject_id',r.subject_id,
        'source_binding_id',r.source_binding_id,
        'blocker_code',r.blocker_code,
        'result',r.result,
        'created_at',r.created_at,
        'updated_at',r.updated_at
      )
      from public.gpt_catalog_intake_runs r
      where r.request_id = btrim(coalesce(p_request_id,''))
    ),
    jsonb_build_object('request_id',btrim(coalesce(p_request_id,'')),'state','NOT_FOUND')
  );
$function$;

revoke all on function public.read_gpt_catalog_intake_run_v1(text)
  from public, anon, authenticated, service_role;
grant execute on function public.read_gpt_catalog_intake_run_v1(text)
  to service_role;

commit;
