-- TRUST Phase 7-C / Phase 4 legacy adoption compatibility fixture.
-- Extends the canonical Phase 4 fixture with:
-- 1) a Phase 7-B-shaped variant legacy candidate with equivalent source scope
-- 2) a Phase 7-B-shaped NULL-market candidate with narrower controlled source scope

alter table public.product_source_bindings
  add column if not exists binding_method text,
  add column if not exists product_scope_state text;

alter table public.catalog_trust_intake
  add column if not exists catalog_revision text,
  add column if not exists identity_resolution_detail jsonb not null default '{}'::jsonb;

create table public.trust_official_source_binding_reviews (
  review_id uuid primary key default gen_random_uuid(),
  binding_id uuid not null references public.product_source_bindings(binding_id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  subject_id uuid not null references public.product_fact_subjects(subject_id) on delete restrict,
  subject_market text,
  source_market text,
  scope_relation text not null check (scope_relation in ('equivalent','narrower')),
  variant_key text,
  formulation_revision_key text not null,
  source_kind text not null,
  actor_user_id uuid not null,
  request_id text not null,
  review_version text not null,
  created_at timestamptz not null default now(),
  unique(product_id,subject_id,binding_id,review_version)
);

alter table public.trust_official_source_binding_reviews enable row level security;
revoke all on table public.trust_official_source_binding_reviews
  from public, anon, authenticated, service_role;

create or replace function public.trust_phase7c_legacy_subject_scope_ready_v1(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.product_fact_research_tasks rt
    join public.catalog_trust_intake i on i.id=rt.intake_id
    join public.product_fact_subjects s on s.subject_id=rt.subject_id
    where rt.id=p_task_id
      and i.catalog_revision like 'legacy-backfill-v1:%'
      and i.identity_state='EXACT_SUBJECT_FOUND'
      and i.subject_id=rt.subject_id
      and s.product_id=rt.product_id
      and s.identity_status='resolved'
      and s.current_state='current'
      and s.market_applicability is not distinct from i.market
      and i.identity_resolution_detail->>'materializer_version'='trust-phase7b-legacy-materialization-v1'
      and i.identity_resolution_detail->>'projected_identity_state'='EXISTING_GOVERNED_SUBJECT'
      and i.identity_resolution_detail->>'subject_id'=rt.subject_id::text
      and s.variant_key is not distinct from nullif(i.identity_resolution_detail->>'variant_key','')
      and s.formulation_revision_key is not distinct from nullif(i.identity_resolution_detail->>'formulation_revision_key','')
      and coalesce((i.identity_resolution_detail->>'market_inferred')::boolean,true)=false
  );
$$;

revoke all on function public.trust_phase7c_legacy_subject_scope_ready_v1(uuid)
  from public, anon, authenticated, service_role;

do $fixture$
declare
  v_actor constant uuid := '92000000-0000-4000-8000-000000000001';
  v_product constant uuid := '00000000-0000-4000-8000-000000000301';
  v_registry constant text := 'trust-phase4-fixture-registry-v1';
  v_fact constant text := 'phase4_fixture_claim';
  v_variant_subject uuid;
  v_null_subject uuid;
  v_subject_key text;
  v_subject_result jsonb;
  v_source_digest text;
  v_candidate_digest text;
  v_claim jsonb := '{"claim":"fixture controlled narrower source claim"}'::jsonb;
  v_identity jsonb := jsonb_build_object('product_id',v_product,'market','KR','variant','legacy-null-variant');
begin
  -- Convert the canonical Phase 4 candidate into a Phase 7-B legacy variant candidate.
  select subject_id into v_variant_subject
  from public.product_fact_research_tasks
  where id='82000000-0000-4000-8000-000000000001'::uuid;

  v_subject_key := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object(
      'product_id',v_product,
      'variant_key','legacy-variant',
      'formulation_revision_key','trust-phase4-fixture-current',
      'market_applicability','KR',
      'region_applicability',null,
      'valid_from',null,
      'valid_to',null
    )
  );

  update public.product_fact_subjects
  set variant_key='legacy-variant',
      subject_semantic_key=v_subject_key
  where subject_id=v_variant_subject;

  update public.catalog_trust_intake
  set catalog_revision='legacy-backfill-v1:' || repeat('1',64),
      identity_resolution_version='trust-phase7b-legacy-materialization-v1',
      identity_resolution_detail=jsonb_build_object(
        'materializer_version','trust-phase7b-legacy-materialization-v1',
        'projected_identity_state','EXISTING_GOVERNED_SUBJECT',
        'subject_id',v_variant_subject::text,
        'market','KR',
        'variant_key','legacy-variant',
        'formulation_revision_key','trust-phase4-fixture-current',
        'market_inferred',false
      )
  where id='81000000-0000-4000-8000-000000000001'::uuid;

  update public.product_source_bindings
  set binding_method='trust_official_source_review_v1',
      product_scope_state='product'
  where binding_id='85000000-0000-4000-8000-000000000001'::uuid;

  insert into public.trust_official_source_binding_reviews(
    review_id,binding_id,product_id,subject_id,subject_market,source_market,
    scope_relation,variant_key,formulation_revision_key,source_kind,
    actor_user_id,request_id,review_version
  ) values (
    '86000000-0000-4000-8000-000000000001',
    '85000000-0000-4000-8000-000000000001',
    v_product,v_variant_subject,'KR','KR','equivalent','legacy-variant',
    'trust-phase4-fixture-current','brand_official_product_page',
    v_actor,'phase7c-p4-variant-review','trust-official-source-review-v1'
  );

  -- Add a second current exact Subject on the same fixture product with NULL market.
  v_subject_key := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object(
      'product_id',v_product,
      'variant_key','legacy-null-variant',
      'formulation_revision_key','trust-phase7c-null-current',
      'market_applicability',null,
      'region_applicability',null,
      'valid_from',null,
      'valid_to',null
    )
  );

  v_subject_result := public.admin_register_product_fact_subject_v1(
    v_actor,
    'trust-p7c-p4-null-subject',
    jsonb_build_object(
      'product_id',v_product,
      'subject_semantic_key',v_subject_key,
      'subject_identity_serializer_version','product-fact-subject-identity-v1',
      'variant_key','legacy-null-variant',
      'formulation_revision_key','trust-phase7c-null-current',
      'formulation_label','TRUST Phase 7-C NULL market fixture',
      'identity_status','resolved',
      'identity_resolution_version','trust-phase7c-null-fixture-v1',
      'current_state','current',
      'market_applicability',null,
      'region_applicability',null,
      'valid_from',null,
      'valid_to',null,
      'predecessor_subject_id',null,
      'supersession_kind',null
    )
  );
  v_null_subject := (v_subject_result->>'subject_id')::uuid;

  insert into public.product_source_bindings(
    binding_id,product_id,source_name,source_url,market_code,locale,binding_state,
    binding_method,product_scope_state
  ) values (
    '85000000-0000-4000-8000-000000000002',
    v_product,'fixture_global_official',
    'https://official.example.test/trust-phase7c-null-source',
    'KR','ko-KR','resolved','trust_official_source_review_v1','product'
  );

  insert into public.catalog_trust_intake(
    id,product_id,market,subject_id,identity_state,identity_resolution_version,
    catalog_revision,identity_resolution_detail
  ) values (
    '81000000-0000-4000-8000-000000000002',
    v_product,null,v_null_subject,'EXACT_SUBJECT_FOUND',
    'trust-phase7b-legacy-materialization-v1',
    'legacy-backfill-v1:' || repeat('2',64),
    jsonb_build_object(
      'materializer_version','trust-phase7b-legacy-materialization-v1',
      'projected_identity_state','EXISTING_GOVERNED_SUBJECT',
      'subject_id',v_null_subject::text,
      'market',null,
      'variant_key','legacy-null-variant',
      'formulation_revision_key','trust-phase7c-null-current',
      'market_inferred',false
    )
  );

  insert into public.product_fact_research_tasks(
    id,intake_id,product_id,subject_id,registry_version,fact_key,state,
    source_locator,source_content_digest
  ) values (
    '82000000-0000-4000-8000-000000000002',
    '81000000-0000-4000-8000-000000000002',
    v_product,v_null_subject,v_registry,v_fact,'EVIDENCE_CANDIDATE',
    'https://official.example.test/trust-phase7c-null-source',null
  );

  v_source_digest := encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'source_binding_id','85000000-0000-4000-8000-000000000002'::uuid,
          'canonical_locator','https://official.example.test/trust-phase7c-null-source',
          'publisher','fixture_global_official',
          'source_kind','brand_official_product_page',
          'market','KR',
          'locale','ko-KR',
          'observed_claim',v_claim,
          'product_identity_observation',v_identity,
          'observation_version','trust-phase7c-null-observation-v1'
        )::text,'UTF8'
      ),'sha256'
    ),'hex'
  );

  update public.product_fact_research_tasks
  set source_content_digest=v_source_digest
  where id='82000000-0000-4000-8000-000000000002';

  insert into public.trust_source_observations(
    observation_id,research_task_id,product_id,subject_id,source_binding_id,
    canonical_locator,publisher,source_kind,market,region,locale,
    observed_claim,product_identity_observation,observation_version,
    digest_basis,source_content_digest,observed_at,fetched_at
  ) values (
    '83000000-0000-4000-8000-000000000002',
    '82000000-0000-4000-8000-000000000002',
    v_product,v_null_subject,
    '85000000-0000-4000-8000-000000000002',
    'https://official.example.test/trust-phase7c-null-source',
    'fixture_global_official','brand_official_product_page','KR',null,'ko-KR',
    v_claim,v_identity,'trust-phase7c-null-observation-v1',
    'frozen-first-party-observation-v1-not-live-page-bytes',
    v_source_digest,'2026-09-21T00:00:00Z','2026-09-21T00:00:00Z'
  );

  v_candidate_digest := encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'subject_id',v_null_subject,
          'registry_version',v_registry,
          'fact_key',v_fact,
          'normalized_value','true'::jsonb,
          'evidence_class','product_claim',
          'support_direction','supports',
          'negative_admissibility','not_applicable',
          'market',null,
          'region',null,
          'locale','ko-KR',
          'qualifier','{}'::jsonb,
          'source_content_digest',v_source_digest
        )::text,'UTF8'
      ),'sha256'
    ),'hex'
  );

  insert into public.trust_evidence_candidates(
    candidate_id,research_task_id,observation_id,product_id,subject_id,
    registry_version,fact_key,normalized_value,evidence_class,evidence_authority,
    confidence,support_direction,negative_admissibility,market,region,locale,
    qualifier,candidate_state,canonical_evidence_digest
  ) values (
    '84000000-0000-4000-8000-000000000002',
    '82000000-0000-4000-8000-000000000002',
    '83000000-0000-4000-8000-000000000002',
    v_product,v_null_subject,v_registry,v_fact,'true'::jsonb,'product_claim',
    'product_specific_primary','high','supports','not_applicable',
    null,null,'ko-KR','{}'::jsonb,'READY',v_candidate_digest
  );

  update public.product_fact_research_tasks
  set source_observation_id='83000000-0000-4000-8000-000000000002',
      evidence_candidate_id='84000000-0000-4000-8000-000000000002'
  where id='82000000-0000-4000-8000-000000000002';

  insert into public.trust_official_source_binding_reviews(
    review_id,binding_id,product_id,subject_id,subject_market,source_market,
    scope_relation,variant_key,formulation_revision_key,source_kind,
    actor_user_id,request_id,review_version
  ) values (
    '86000000-0000-4000-8000-000000000002',
    '85000000-0000-4000-8000-000000000002',
    v_product,v_null_subject,null,'KR','narrower','legacy-null-variant',
    'trust-phase7c-null-current','brand_official_product_page',
    v_actor,'phase7c-p4-null-review','trust-official-source-review-v1'
  );
end;
$fixture$;
