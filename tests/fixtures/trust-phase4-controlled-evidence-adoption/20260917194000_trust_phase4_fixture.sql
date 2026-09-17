-- TRUST Phase 4 isolated-runtime staging fixture.
-- Applied after the canonical Product Fact storage/controlled-write migrations.

create table public.product_source_bindings (
  binding_id uuid primary key,
  product_id uuid not null references public.products(id),
  source_name text not null,
  source_url text,
  market_code text,
  locale text,
  binding_state text not null
);

create table public.catalog_trust_intake (
  id uuid primary key,
  product_id uuid not null references public.products(id),
  market text,
  subject_id uuid references public.product_fact_subjects(subject_id),
  identity_state text not null,
  identity_resolution_version text,
  created_at timestamptz not null default now()
);

create table public.product_fact_research_tasks (
  id uuid primary key,
  intake_id uuid not null references public.catalog_trust_intake(id),
  product_id uuid not null references public.products(id),
  subject_id uuid references public.product_fact_subjects(subject_id),
  registry_version text not null,
  fact_key text not null,
  state text not null,
  source_locator text,
  source_content_digest text,
  source_observation_id uuid,
  evidence_candidate_id uuid,
  created_at timestamptz not null default now()
);

create table public.trust_source_observations (
  observation_id uuid primary key,
  research_task_id uuid not null references public.product_fact_research_tasks(id),
  product_id uuid not null references public.products(id),
  subject_id uuid not null references public.product_fact_subjects(subject_id),
  source_binding_id uuid not null references public.product_source_bindings(binding_id),
  canonical_locator text not null,
  publisher text not null,
  source_kind text not null,
  market text,
  region text,
  locale text,
  observed_claim jsonb not null,
  product_identity_observation jsonb not null,
  observation_version text not null,
  digest_basis text not null,
  source_content_digest text not null,
  observed_at timestamptz not null,
  fetched_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.trust_evidence_candidates (
  candidate_id uuid primary key,
  research_task_id uuid not null references public.product_fact_research_tasks(id),
  observation_id uuid not null references public.trust_source_observations(observation_id),
  product_id uuid not null references public.products(id),
  subject_id uuid not null references public.product_fact_subjects(subject_id),
  registry_version text not null,
  fact_key text not null,
  normalized_value jsonb not null,
  evidence_class text not null,
  evidence_authority text not null,
  confidence text not null,
  support_direction text not null,
  negative_admissibility text not null,
  market text,
  region text,
  locale text,
  qualifier jsonb not null default '{}'::jsonb,
  candidate_state text not null,
  canonical_evidence_digest text not null,
  created_at timestamptz not null default now()
);

alter table public.product_source_bindings enable row level security;
alter table public.catalog_trust_intake enable row level security;
alter table public.product_fact_research_tasks enable row level security;
alter table public.trust_source_observations enable row level security;
alter table public.trust_evidence_candidates enable row level security;

revoke all on table public.product_source_bindings from public, anon, authenticated, service_role;
revoke all on table public.catalog_trust_intake from public, anon, authenticated, service_role;
revoke all on table public.product_fact_research_tasks from public, anon, authenticated, service_role;
revoke all on table public.trust_source_observations from public, anon, authenticated, service_role;
revoke all on table public.trust_evidence_candidates from public, anon, authenticated, service_role;

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, is_sso_user, is_anonymous
) values (
  '92000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'trust-phase4-admin@example.test',
  '{}'::jsonb, '{}'::jsonb, now(), now(), false, false
);

insert into public.admin_memberships (user_id, role, is_active, granted_by)
values ('92000000-0000-4000-8000-000000000001', 'admin_owner', true, null);

do $$
declare
  v_actor constant uuid := '92000000-0000-4000-8000-000000000001';
  v_product constant uuid := '00000000-0000-4000-8000-000000000301';
  v_registry constant text := 'trust-phase4-fixture-registry-v1';
  v_fact constant text := 'phase4_fixture_claim';
  v_definition jsonb;
  v_definition_checksum text;
  v_registry_checksum text;
  v_registry_payload jsonb;
  v_subject_key text;
  v_subject_result jsonb;
  v_subject uuid;
  v_source_digest text;
  v_candidate_digest text;
  v_observation constant uuid := '83000000-0000-4000-8000-000000000001';
  v_candidate constant uuid := '84000000-0000-4000-8000-000000000001';
  v_task constant uuid := '82000000-0000-4000-8000-000000000001';
  v_binding constant uuid := '85000000-0000-4000-8000-000000000001';
  v_intake constant uuid := '81000000-0000-4000-8000-000000000001';
  v_claim jsonb := '{"claim":"fixture explicit product claim"}'::jsonb;
  v_identity jsonb := jsonb_build_object('product_id', v_product, 'market', 'KR');
begin
  v_definition := jsonb_build_object(
    'fact_key', v_fact,
    'registry_version', v_registry,
    'domain_scope', jsonb_build_array('fixture'),
    'value_type', 'boolean',
    'allowed_values', null,
    'cardinality', 'one',
    'permitted_evidence_classes', jsonb_build_array('product_claim'),
    'relationship_schema', jsonb_build_object('subject_ref_required', false)
  );
  v_definition_checksum := public.product_fact_controlled_sha256_json_v1(v_definition);
  v_registry_checksum := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object(
      'registry_version', v_registry,
      'identity_serializer_version', 'product-fact-subject-identity-v1',
      'definitions', jsonb_build_array(
        jsonb_build_object(
          'fact_key', v_fact,
          'value_type', 'boolean',
          'definition_checksum', v_definition_checksum,
          'deprecated', false,
          'superseded_by_fact_key', null
        )
      )
    )
  );
  v_registry_payload := jsonb_build_object(
    'registry_version', v_registry,
    'registry_checksum', v_registry_checksum,
    'identity_serializer_version', 'product-fact-subject-identity-v1',
    'effective_at', null,
    'definitions', jsonb_build_array(
      jsonb_build_object(
        'fact_key', v_fact,
        'value_type', 'boolean',
        'definition', v_definition,
        'definition_checksum', v_definition_checksum,
        'deprecated', false,
        'superseded_by_fact_key', null
      )
    )
  );

  perform public.admin_publish_product_fact_registry_v1(
    v_actor,
    'trust-p4-registry-0001',
    v_registry_payload
  );

  v_subject_key := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object(
      'product_id', v_product,
      'variant_key', null,
      'formulation_revision_key', 'trust-phase4-fixture-current',
      'market_applicability', 'KR',
      'region_applicability', null,
      'valid_from', null,
      'valid_to', null
    )
  );

  v_subject_result := public.admin_register_product_fact_subject_v1(
    v_actor,
    'trust-p4-subject-0001',
    jsonb_build_object(
      'product_id', v_product,
      'subject_semantic_key', v_subject_key,
      'subject_identity_serializer_version', 'product-fact-subject-identity-v1',
      'variant_key', null,
      'formulation_revision_key', 'trust-phase4-fixture-current',
      'formulation_label', 'TRUST Phase 4 fixture product',
      'identity_status', 'resolved',
      'identity_resolution_version', 'trust-phase4-fixture-identity-v1',
      'current_state', 'current',
      'market_applicability', 'KR',
      'region_applicability', null,
      'valid_from', null,
      'valid_to', null,
      'predecessor_subject_id', null,
      'supersession_kind', null
    )
  );
  v_subject := (v_subject_result ->> 'subject_id')::uuid;

  insert into public.product_source_bindings (
    binding_id, product_id, source_name, source_url, market_code, locale, binding_state
  ) values (
    v_binding, v_product, 'fixture_official',
    'https://official.example.test/trust-phase4-fixture',
    'KR', 'ko-KR', 'resolved'
  );

  insert into public.catalog_trust_intake (
    id, product_id, market, subject_id, identity_state, identity_resolution_version
  ) values (
    v_intake, v_product, 'KR', v_subject,
    'EXACT_SUBJECT_FOUND', 'trust-phase4-fixture-identity-v1'
  );

  insert into public.product_fact_research_tasks (
    id, intake_id, product_id, subject_id, registry_version, fact_key, state,
    source_locator, source_content_digest
  ) values (
    v_task, v_intake, v_product, v_subject, v_registry, v_fact, 'EVIDENCE_CANDIDATE',
    'https://official.example.test/trust-phase4-fixture', null
  );

  v_source_digest := encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'source_binding_id', v_binding,
          'canonical_locator', 'https://official.example.test/trust-phase4-fixture',
          'publisher', 'fixture_official',
          'source_kind', 'brand_official_product_page',
          'market', 'KR',
          'locale', 'ko-KR',
          'observed_claim', v_claim,
          'product_identity_observation', v_identity,
          'observation_version', 'trust-phase4-fixture-observation-v1'
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  update public.product_fact_research_tasks
  set source_content_digest = v_source_digest
  where id = v_task;

  insert into public.trust_source_observations (
    observation_id, research_task_id, product_id, subject_id, source_binding_id,
    canonical_locator, publisher, source_kind, market, region, locale,
    observed_claim, product_identity_observation, observation_version,
    digest_basis, source_content_digest, observed_at, fetched_at
  ) values (
    v_observation, v_task, v_product, v_subject, v_binding,
    'https://official.example.test/trust-phase4-fixture',
    'fixture_official', 'brand_official_product_page', 'KR', null, 'ko-KR',
    v_claim, v_identity, 'trust-phase4-fixture-observation-v1',
    'frozen-first-party-observation-v1-not-live-page-bytes',
    v_source_digest, '2026-09-17T10:00:00Z', '2026-09-17T10:00:00Z'
  );

  v_candidate_digest := encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'subject_id', v_subject,
          'registry_version', v_registry,
          'fact_key', v_fact,
          'normalized_value', 'true'::jsonb,
          'evidence_class', 'product_claim',
          'support_direction', 'supports',
          'negative_admissibility', 'not_applicable',
          'market', 'KR',
          'region', null,
          'locale', 'ko-KR',
          'qualifier', '{}'::jsonb,
          'source_content_digest', v_source_digest
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  insert into public.trust_evidence_candidates (
    candidate_id, research_task_id, observation_id, product_id, subject_id,
    registry_version, fact_key, normalized_value, evidence_class,
    evidence_authority, confidence, support_direction, negative_admissibility,
    market, region, locale, qualifier, candidate_state, canonical_evidence_digest
  ) values (
    v_candidate, v_task, v_observation, v_product, v_subject,
    v_registry, v_fact, 'true'::jsonb, 'product_claim',
    'product_specific_primary', 'high', 'supports', 'not_applicable',
    'KR', null, 'ko-KR', '{}'::jsonb, 'READY', v_candidate_digest
  );

  update public.product_fact_research_tasks
  set source_observation_id = v_observation,
      evidence_candidate_id = v_candidate
  where id = v_task;
end;
$$;
