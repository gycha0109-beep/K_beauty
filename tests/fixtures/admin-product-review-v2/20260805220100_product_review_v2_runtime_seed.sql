begin;

insert into auth.users (
  id,
  aud,
  role,
  email,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  is_sso_user,
  is_anonymous
) values (
  '30000000-0000-4000-8000-000000000004',
  'authenticated',
  'authenticated',
  'inactive-review-v2@example.test',
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now(),
  false,
  false
);

insert into public.admin_memberships (
  user_id,
  role,
  is_active,
  granted_by
) values (
  '30000000-0000-4000-8000-000000000004',
  'admin_owner',
  false,
  '30000000-0000-4000-8000-000000000001'
);

insert into public.products (
  id,
  name,
  brand,
  category,
  product_form,
  skin_types,
  concerns,
  texture,
  finish,
  irritation_risk,
  sensitivity_safe,
  normalized_name,
  normalized_brand,
  cleansing_profile,
  created_at,
  updated_at
) values (
  '52000000-0000-4000-8000-000000000001',
  'Existing Cleanser',
  'Merge Brand',
  'cleanser',
  null,
  array['sensitive'],
  array['barrier'],
  'gel',
  'fresh',
  'low',
  true,
  'existing cleanser',
  'merge brand',
  'balanced',
  '2026-08-05T10:00:00.000Z',
  '2026-08-05T10:00:00.000Z'
);

with candidate_fixture (
  id,
  external_id,
  source_url,
  category_path,
  product_name_raw,
  brand_name_raw,
  normalized_name,
  normalized_brand,
  service_category,
  matched_product_id,
  promotion_payload,
  updated_at
) as (
  values
    (
      '51000000-0000-4000-8000-000000000001'::uuid,
      'v2-valid-create',
      'https://example.com/products/v2-valid-create',
      'cleanser',
      'Deep Clean Fixture',
      'Valid Brand',
      'deep clean fixture',
      'valid brand',
      'cleanser'::public.product_category,
      null::uuid,
      jsonb_build_object('product', jsonb_build_object(
        'skin_types', jsonb_build_array('oily'),
        'concerns', jsonb_build_array('pores'),
        'texture', 'gel',
        'finish', 'fresh',
        'irritation_risk', 'medium',
        'sensitivity_safe', false
      )),
      '2026-08-05T10:01:00.000Z'::timestamptz
    ),
    (
      '51000000-0000-4000-8000-000000000002'::uuid,
      'v2-valid-merge',
      'https://example.com/products/v2-valid-merge',
      'cleanser',
      'Existing Cleanser',
      'Merge Brand',
      'existing cleanser',
      'merge brand',
      'cleanser'::public.product_category,
      '52000000-0000-4000-8000-000000000001'::uuid,
      jsonb_build_object('product', jsonb_build_object(
        'skin_types', jsonb_build_array('sensitive'),
        'concerns', jsonb_build_array('barrier'),
        'texture', 'gel',
        'finish', 'fresh',
        'irritation_risk', 'low',
        'sensitivity_safe', true
      )),
      '2026-08-05T10:02:00.000Z'::timestamptz
    ),
    (
      '51000000-0000-4000-8000-000000000003'::uuid,
      'v2-unknown',
      'https://example.com/products/v2-unknown',
      'cleanser',
      'Unknown Cleanser',
      'Unknown Brand',
      'unknown cleanser',
      'unknown brand',
      'cleanser'::public.product_category,
      null::uuid,
      jsonb_build_object('product', jsonb_build_object(
        'skin_types', jsonb_build_array('sensitive'),
        'concerns', jsonb_build_array('barrier'),
        'texture', 'gel',
        'finish', 'natural',
        'irritation_risk', 'low',
        'sensitivity_safe', true
      )),
      '2026-08-05T10:03:00.000Z'::timestamptz
    ),
    (
      '51000000-0000-4000-8000-000000000004'::uuid,
      'v2-conflict',
      'https://example.com/products/v2-conflict',
      'cleanser',
      'Conflict Cleanser',
      'Conflict Brand',
      'conflict cleanser',
      'conflict brand',
      'cleanser'::public.product_category,
      null::uuid,
      jsonb_build_object('product', jsonb_build_object(
        'skin_types', jsonb_build_array('combination'),
        'concerns', jsonb_build_array('oiliness'),
        'texture', 'cream',
        'finish', 'natural',
        'irritation_risk', 'medium',
        'sensitivity_safe', false
      )),
      '2026-08-05T10:04:00.000Z'::timestamptz
    ),
    (
      '51000000-0000-4000-8000-000000000005'::uuid,
      'v2-not-applicable',
      'https://example.com/products/v2-not-applicable',
      'moisturizer_cream',
      'Not Applicable Cream',
      'Neutral Brand',
      'not applicable cream',
      'neutral brand',
      'moisturizer_cream'::public.product_category,
      null::uuid,
      jsonb_build_object('product', jsonb_build_object(
        'skin_types', jsonb_build_array('dry'),
        'concerns', jsonb_build_array('dehydration'),
        'texture', 'cream',
        'finish', 'dewy',
        'irritation_risk', 'low',
        'sensitivity_safe', true
      )),
      '2026-08-05T10:05:00.000Z'::timestamptz
    )
)
insert into public.product_candidates (
  id,
  source_name,
  external_type,
  external_id,
  source_url,
  category_path,
  product_name_raw,
  brand_name_raw,
  normalized_name,
  normalized_brand,
  service_category,
  product_form,
  review_status,
  review_flags,
  matched_product_id,
  duplicate_of_product_id,
  promotion_payload,
  promotion_version,
  first_seen_at,
  last_seen_at,
  created_at,
  updated_at
)
select
  id,
  'fixture',
  'product',
  external_id,
  source_url,
  category_path,
  product_name_raw,
  brand_name_raw,
  normalized_name,
  normalized_brand,
  service_category,
  null,
  'needs_review',
  array[]::text[],
  matched_product_id,
  matched_product_id,
  promotion_payload,
  'fixture-v2',
  updated_at,
  updated_at,
  updated_at,
  updated_at
from candidate_fixture;

insert into public.candidate_promotion_reviews (
  candidate_id,
  status,
  priority_score,
  selection_reason,
  evidence_snapshot,
  rule_version,
  first_queued_at,
  last_queued_at,
  created_at,
  updated_at
)
select
  candidate.id,
  'queued',
  100 - row_number() over (order by candidate.id),
  'v2 runtime fixture',
  jsonb_build_object(
    'candidate', jsonb_build_object(
      'id', candidate.id,
      'source_name', candidate.source_name,
      'external_type', candidate.external_type,
      'external_id', candidate.external_id
    ),
    'concerns', jsonb_build_array(),
    'popularity', jsonb_build_object()
  ),
  'ranking-review-v2',
  candidate.updated_at,
  candidate.updated_at,
  candidate.updated_at,
  candidate.updated_at
from public.product_candidates as candidate
where candidate.id::text like '51000000-0000-4000-8000-%';

create or replace view public.candidate_ranking_evidence_summary
with (security_invoker = true)
as
select candidate_id, evidence_snapshot
from public.candidate_promotion_reviews;

revoke all on public.candidate_ranking_evidence_summary
  from public, anon, authenticated;
grant select on public.candidate_ranking_evidence_summary to service_role;

insert into public.product_metadata_field_reviews (
  product_id,
  field_name,
  candidate_id,
  review_state,
  field_value,
  confidence,
  evidence_refs,
  evidence_records,
  evidence_digest,
  review_contract_version,
  metadata_schema_version,
  review_policy_version,
  evidence_schema_version,
  export_batch_id,
  request_id,
  canonical_payload_digest,
  reviewed_by,
  reviewed_at,
  updated_at
) values (
  '52000000-0000-4000-8000-000000000001',
  'cleansing_profile',
  '51000000-0000-4000-8000-000000000002',
  'reviewed_valid',
  'balanced',
  'medium',
  '["54000000-0000-4000-8000-000000000001"]'::jsonb,
  '[{"evidence_id":"54000000-0000-4000-8000-000000000001","candidate_id":"51000000-0000-4000-8000-000000000002","field":"cleansing_profile","supported_value":"balanced","evidence_type":"official_product_page","source_reference":"https://example.com/evidence/legacy-reviewed","schema_version":"product-review-field-evidence-v1","evidence_digest":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}]'::jsonb,
  'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
  'admin-product-review-v2',
  'cleanser-metadata-v1',
  'cleanser-metadata-review-policy-v1',
  'product-review-field-evidence-v1',
  '55000000-0000-4000-8000-000000000001',
  'seed-review-v2',
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  '30000000-0000-4000-8000-000000000001',
  '2026-08-05T10:06:00.000Z',
  '2026-08-05T10:06:00.000Z'
);

commit;
