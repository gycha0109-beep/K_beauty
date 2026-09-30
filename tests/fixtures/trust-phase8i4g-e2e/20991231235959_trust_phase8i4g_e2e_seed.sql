-- TEST / LOCAL E2E ONLY. NOT A PRODUCTION MIGRATION.
-- Deterministic isolated first-real-canary seed. It establishes only governed
-- Product Fact / Evidence / reviewed-source prestate. Transport incidents,
-- drift cases, READY_FOR_8I4, grouped relocation, replay and closure are
-- produced by the real runtime paths during the test.

begin;

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, is_sso_user, is_anonymous
) values (
  '92000000-0000-4000-8000-000000004001',
  'authenticated', 'authenticated', 'trust-phase8i4g-e2e@example.test',
  '{}'::jsonb, '{}'::jsonb, now(), now(), false, false
) on conflict (id) do nothing;

insert into public.admin_memberships(user_id,role,is_active,granted_by)
values (
  '92000000-0000-4000-8000-000000004001',
  'admin_owner', true, null
) on conflict (user_id) do update
set role='admin_owner',is_active=true,updated_at=now();

insert into public.products(
  id,name,brand,category,image_url,
  skin_types,concerns,texture,finish,irritation_risk,sensitivity_safe
)
values (
  '94000000-0000-4000-8000-000000004001',
  'Isolated E2E Sunscreen',
  'E2E Official',
  'sunscreen',
  null,
  'normal,sensitive',
  'uv_protection',
  'cream',
  'natural',
  'low',
  true
);

insert into public.product_fact_registry_versions(
  registry_version,registry_checksum,identity_serializer_version,effective_at
) values (
  'trust-phase8i4g-e2e-registry-v1',
  repeat('a',64),
  'trust-phase8i4g-e2e-subject-v1',
  '2026-09-01T00:00:00Z'
);

insert into public.product_fact_definition_snapshots(
  registry_version,fact_key,value_type,definition,definition_checksum,
  deprecated,superseded_by_fact_key
) values (
  'trust-phase8i4g-e2e-registry-v1',
  'e2e_official_claim',
  'boolean',
  '{"registry_version":"trust-phase8i4g-e2e-registry-v1","fact_key":"e2e_official_claim","value_type":"boolean"}'::jsonb,
  repeat('b',64),
  false,
  null
);

insert into public.product_fact_subjects(
  subject_id,product_id,subject_semantic_key,subject_identity_serializer_version,
  variant_key,formulation_revision_key,formulation_label,
  identity_status,identity_resolution_version,current_state,
  market_applicability,region_applicability
) values (
  '95000000-0000-4000-8000-000000004001',
  '94000000-0000-4000-8000-000000004001',
  repeat('c',64),
  'trust-phase8i4g-e2e-subject-v1',
  null,
  'e2e-formula-v1',
  'E2E Formula v1',
  'resolved',
  'trust-phase8i4g-e2e-resolution-v1',
  'current',
  null,
  null
);

insert into public.product_evidence_sources(
  source_id,canonical_locator,publisher,source_kind,source_metadata,
  content_digest,external_snapshot_reference,market,region,locale,
  accessed_at,observed_at
) values
(
  '96000000-0000-4000-8000-000000004001',
  'https://official.example.test/products/e2e-sunscreen',
  'E2E Official',
  'official_product_page',
  '{"fixture":"phase8i4g-isolated-e2e","ordinal":1}'::jsonb,
  repeat('d',64),null,null,null,'en',
  '2026-09-30T00:00:00Z','2026-09-30T00:00:00Z'
),
(
  '96000000-0000-4000-8000-000000004002',
  'https://official.example.test/products/e2e-sunscreen',
  'E2E Official',
  'official_product_page',
  '{"fixture":"phase8i4g-isolated-e2e","ordinal":2}'::jsonb,
  repeat('e',64),null,null,null,'en',
  '2026-09-30T00:00:00Z','2026-09-30T00:00:00Z'
),
(
  '96000000-0000-4000-8000-000000004003',
  'https://official.example.test/products/e2e-sunscreen',
  'E2E Official',
  'official_product_page',
  '{"fixture":"phase8i4g-isolated-e2e","ordinal":3}'::jsonb,
  repeat('f',64),null,null,null,'en',
  '2026-09-30T00:00:00Z','2026-09-30T00:00:00Z'
);

insert into public.product_evidence_source_subject_bindings(
  binding_id,source_id,product_id,subject_id,binding_state,scope_relation,
  presentation_metadata,identity_resolution_version,reviewed_by,reviewed_at
) values
(
  '97000000-0000-4000-8000-000000004001',
  '96000000-0000-4000-8000-000000004001',
  '94000000-0000-4000-8000-000000004001',
  '95000000-0000-4000-8000-000000004001',
  'exact_subject_match','equivalent',
  '{"fixture":"phase8i4g-isolated-e2e"}'::jsonb,
  'trust-phase8i4g-e2e-resolution-v1',
  '92000000-0000-4000-8000-000000004001',
  '2026-09-30T00:00:00Z'
),
(
  '97000000-0000-4000-8000-000000004002',
  '96000000-0000-4000-8000-000000004002',
  '94000000-0000-4000-8000-000000004001',
  '95000000-0000-4000-8000-000000004001',
  'exact_subject_match','equivalent',
  '{"fixture":"phase8i4g-isolated-e2e"}'::jsonb,
  'trust-phase8i4g-e2e-resolution-v1',
  '92000000-0000-4000-8000-000000004001',
  '2026-09-30T00:00:00Z'
),
(
  '97000000-0000-4000-8000-000000004003',
  '96000000-0000-4000-8000-000000004003',
  '94000000-0000-4000-8000-000000004001',
  '95000000-0000-4000-8000-000000004001',
  'exact_subject_match','equivalent',
  '{"fixture":"phase8i4g-isolated-e2e"}'::jsonb,
  'trust-phase8i4g-e2e-resolution-v1',
  '92000000-0000-4000-8000-000000004001',
  '2026-09-30T00:00:00Z'
);

insert into public.product_evidence_records(
  evidence_id,source_id,binding_id,binding_state,subject_id,
  registry_version,fact_key,proposition_key,proposition_serializer_version,
  proposition_value_identity,parent_proposition_key,
  evidence_class,evidence_authority,confidence,support_direction,
  negative_admissibility,market,region,locale,qualifier,
  canonical_evidence_digest,supersedes_evidence_id
) values
(
  '98000000-0000-4000-8000-000000004001',
  '96000000-0000-4000-8000-000000004001',
  '97000000-0000-4000-8000-000000004001',
  'exact_subject_match',
  '95000000-0000-4000-8000-000000004001',
  'trust-phase8i4g-e2e-registry-v1','e2e_official_claim',repeat('1',64),
  'trust-phase8i4g-e2e-proposition-v1','{"value":true}'::jsonb,null,
  'product_claim','product_specific_primary','high','supports',
  'not_applicable',null,null,'en','{}'::jsonb,repeat('6',64),null
),
(
  '98000000-0000-4000-8000-000000004002',
  '96000000-0000-4000-8000-000000004002',
  '97000000-0000-4000-8000-000000004002',
  'exact_subject_match',
  '95000000-0000-4000-8000-000000004001',
  'trust-phase8i4g-e2e-registry-v1','e2e_official_claim',repeat('1',64),
  'trust-phase8i4g-e2e-proposition-v1','{"value":true}'::jsonb,null,
  'product_claim','product_specific_primary','high','supports',
  'not_applicable',null,null,'en','{}'::jsonb,repeat('7',64),null
),
(
  '98000000-0000-4000-8000-000000004003',
  '96000000-0000-4000-8000-000000004003',
  '97000000-0000-4000-8000-000000004003',
  'exact_subject_match',
  '95000000-0000-4000-8000-000000004001',
  'trust-phase8i4g-e2e-registry-v1','e2e_official_claim',repeat('1',64),
  'trust-phase8i4g-e2e-proposition-v1','{"value":true}'::jsonb,null,
  'product_claim','product_specific_primary','high','supports',
  'not_applicable',null,null,'en','{}'::jsonb,repeat('8',64),null
);

insert into public.product_fact_instances(
  fact_instance_id,subject_id,registry_version,fact_key,proposition_key,
  proposition_serializer_version,semantic_status,value_type,value_boolean,
  market,region,locale,qualifier,authority_ceiling,fused_confidence,
  fusion_policy_version,fusion_input_digest,adjudicated_at
) values (
  '99000000-0000-4000-8000-000000004001',
  '95000000-0000-4000-8000-000000004001',
  'trust-phase8i4g-e2e-registry-v1','e2e_official_claim',repeat('1',64),
  'trust-phase8i4g-e2e-proposition-v1','supported','boolean',true,
  null,null,'en','{}'::jsonb,'product_specific_primary','high',
  'trust-phase8i4g-e2e-fusion-v1',repeat('9',64),'2026-09-30T00:00:00Z'
);

insert into public.product_fact_evidence_links(
  fact_instance_id,evidence_id,subject_id,proposition_key,link_role
) values
('99000000-0000-4000-8000-000000004001','98000000-0000-4000-8000-000000004001','95000000-0000-4000-8000-000000004001',repeat('1',64),'supporting'),
('99000000-0000-4000-8000-000000004001','98000000-0000-4000-8000-000000004002','95000000-0000-4000-8000-000000004001',repeat('1',64),'supporting'),
('99000000-0000-4000-8000-000000004001','98000000-0000-4000-8000-000000004003','95000000-0000-4000-8000-000000004001',repeat('1',64),'supporting');

insert into public.product_fact_confirmations(
  confirmation_id,request_id,namespace,actor_user_id,
  payload_digest,prestate_digest,result_digest,result
) values (
  '9a000000-0000-4000-8000-000000004001',
  'phase8i4g-e2e-confirmation-0001',
  'trust-phase8i4g-e2e',
  '92000000-0000-4000-8000-000000004001',
  repeat('a',64),repeat('b',64),repeat('c',64),
  '{"fixture":"phase8i4g-isolated-e2e","status":"confirmed"}'::jsonb
);

insert into public.product_fact_current(
  proposition_key,fact_instance_id,subject_id,confirmation_id,updated_at
) values (
  repeat('1',64),
  '99000000-0000-4000-8000-000000004001',
  '95000000-0000-4000-8000-000000004001',
  '9a000000-0000-4000-8000-000000004001',
  '2026-09-30T00:00:00Z'
);

insert into public.product_source_bindings(
  binding_id,product_id,source_name,external_type,external_id,source_url,
  market_code,locale,binding_state,binding_method,product_scope_state,
  first_observed_at,last_observed_at,created_at,updated_at
) values (
  '9b000000-0000-4000-8000-000000004001',
  '94000000-0000-4000-8000-000000004001',
  'e2e_official',
  'brand_official_product_page',
  'official-url-sha256:' ||
    encode(extensions.digest(convert_to('https://official.example.test/products/e2e-sunscreen','UTF8'),'sha256'),'hex'),
  'https://official.example.test/products/e2e-sunscreen',
  null,'en','resolved','trust_official_source_review_v1','product',
  '2026-09-30T00:00:00Z','2026-09-30T00:00:00Z',
  '2026-09-30T00:00:00Z','2026-09-30T00:00:00Z'
);

insert into public.trust_official_source_binding_reviews(
  review_id,binding_id,product_id,subject_id,subject_market,source_market,
  scope_relation,variant_key,formulation_revision_key,source_kind,
  actor_user_id,request_id,review_version,created_at
) values (
  '9c000000-0000-4000-8000-000000004001',
  '9b000000-0000-4000-8000-000000004001',
  '94000000-0000-4000-8000-000000004001',
  '95000000-0000-4000-8000-000000004001',
  null,null,'equivalent',null,'e2e-formula-v1',
  'brand_official_product_page',
  '92000000-0000-4000-8000-000000004001',
  'phase8i4g-e2e-review-0001',
  'trust-official-source-review-v1',
  '2026-09-30T00:00:00Z'
);

commit;
