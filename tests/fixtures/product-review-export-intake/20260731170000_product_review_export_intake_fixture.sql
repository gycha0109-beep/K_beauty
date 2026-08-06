begin;

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
  created_at,
  updated_at
)
values
  (
    '66666666-6666-4666-8666-666666666666',
    'Merge Cream',
    'Merge Brand',
    'moisturizer_cream',
    null,
    array['dry', 'sensitive'],
    array['barrier'],
    'cream',
    'dewy',
    'low',
    true,
    'merge cream',
    'merge brand',
    '2026-07-20T00:00:00.000Z',
    '2026-07-20T00:00:00.000Z'
  ),
  (
    '77777777-7777-4777-8777-777777777777',
    'Duplicate Cream',
    'Blocked Brand',
    'moisturizer_cream',
    null,
    array['dry'],
    array['barrier'],
    'cream',
    'natural',
    'low',
    true,
    'duplicate cream',
    'blocked brand',
    '2026-07-20T00:00:00.000Z',
    '2026-07-20T00:00:00.000Z'
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
  matched_product_id,
  updated_at
) as (
  values
    (
      '11111111-1111-4111-8111-111111111111'::uuid,
      'external-1',
      'https://example.com/products/1',
      'treatment',
      '+Formula Serum',
      '=FormulaBrand',
      'formula serum',
      'formula brand',
      null::uuid,
      '2026-07-20T01:00:00.000Z'::timestamptz
    ),
    (
      '22222222-2222-4222-8222-222222222222'::uuid,
      'external-2',
      'https://example.com/products/2',
      'moisturizer_cream',
      'Merge Cream',
      'Merge Brand',
      'merge cream',
      'merge brand',
      '66666666-6666-4666-8666-666666666666'::uuid,
      '2026-07-21T01:00:00.000Z'::timestamptz
    ),
    (
      '33333333-3333-4333-8333-333333333333'::uuid,
      'external-3',
      'https://example.com/products/3',
      'moisturizer_cream',
      'Evidence Pending Cream',
      'Deferred Brand',
      'evidence pending cream',
      'deferred brand',
      null::uuid,
      '2026-07-22T01:00:00.000Z'::timestamptz
    ),
    (
      '44444444-4444-4444-8444-444444444444'::uuid,
      'external-4',
      'https://example.com/products/4',
      'moisturizer_cream',
      'Duplicate Cream',
      'Blocked Brand',
      'duplicate cream',
      'blocked brand',
      '77777777-7777-4777-8777-777777777777'::uuid,
      '2026-07-23T01:00:00.000Z'::timestamptz
    ),
    (
      '55555555-5555-4555-8555-555555555555'::uuid,
      'external-5',
      'https://example.com/products/5',
      'moisturizer_cream',
      'Stale Cream',
      'Stale Brand',
      'stale cream',
      'stale brand',
      null::uuid,
      '2026-07-24T01:00:00.000Z'::timestamptz
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
  review_status,
  review_flags,
  matched_product_id,
  promotion_version,
  first_seen_at,
  last_seen_at,
  created_at,
  updated_at
)
select
  id,
  'hwahae',
  'product',
  external_id,
  source_url,
  category_path,
  product_name_raw,
  brand_name_raw,
  normalized_name,
  normalized_brand,
  'new',
  array['missing_canonical_name', 'missing_canonical_brand'],
  matched_product_id,
  'v1',
  updated_at,
  updated_at,
  updated_at,
  updated_at
from candidate_fixture;

with review_fixture (
  candidate_id,
  row_number,
  queued_at
) as (
  values
    ('11111111-1111-4111-8111-111111111111'::uuid, 1, '2026-07-20T01:00:00.000Z'::timestamptz),
    ('22222222-2222-4222-8222-222222222222'::uuid, 2, '2026-07-21T01:00:00.000Z'::timestamptz),
    ('33333333-3333-4333-8333-333333333333'::uuid, 3, '2026-07-22T01:00:00.000Z'::timestamptz),
    ('44444444-4444-4444-8444-444444444444'::uuid, 4, '2026-07-23T01:00:00.000Z'::timestamptz),
    ('55555555-5555-4555-8555-555555555555'::uuid, 5, '2026-07-24T01:00:00.000Z'::timestamptz)
)
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
  fixture.candidate_id,
  'queued',
  101 - fixture.row_number,
  'fixture ranking evidence',
  jsonb_build_object(
    'candidate', jsonb_build_object(
      'id', fixture.candidate_id,
      'source_name', 'hwahae',
      'external_type', 'product',
      'external_id', 'external-' || fixture.row_number
    ),
    'concerns', jsonb_build_array(
      jsonb_build_object(
        'concern', 'barrier',
        'observation_count', 2,
        'best_rank', fixture.row_number,
        'latest_rank', fixture.row_number + 1,
        'latest_collected_at', fixture.queued_at,
        'observations', jsonb_build_array(
          jsonb_build_object(
            'rank', fixture.row_number,
            'collected_at', fixture.queued_at,
            'service_category', case when fixture.row_number = 1 then 'treatment' else 'moisturizer_cream' end,
            'source_category_key', case when fixture.row_number = 1 then 'essence_ampoule_serum' else 'cream' end,
            'source_product_form', case when fixture.row_number = 1 then 'serum' else null end
          )
        )
      )
    ),
    'popularity', jsonb_build_object(
      'observation_count', 1,
      'best_rank', fixture.row_number + 4,
      'latest_rank', fixture.row_number + 4,
      'latest_collected_at', fixture.queued_at,
      'observations', jsonb_build_array(
        jsonb_build_object(
          'rank', fixture.row_number + 4,
          'collected_at', fixture.queued_at,
          'service_category', case when fixture.row_number = 1 then 'treatment' else 'moisturizer_cream' end,
          'source_category_key', case when fixture.row_number = 1 then 'essence_ampoule_serum' else 'cream' end,
          'source_product_form', case when fixture.row_number = 1 then 'serum' else null end
        )
      )
    )
  ),
  'fixture-v1',
  fixture.queued_at,
  fixture.queued_at,
  fixture.queued_at,
  fixture.queued_at
from review_fixture fixture;

create or replace view public.candidate_ranking_evidence_summary
with (security_invoker = true)
as
select candidate_id, evidence_snapshot
from public.candidate_promotion_reviews;

revoke all on public.candidate_ranking_evidence_summary from public, anon, authenticated;
grant select on public.candidate_ranking_evidence_summary to service_role;

commit;
