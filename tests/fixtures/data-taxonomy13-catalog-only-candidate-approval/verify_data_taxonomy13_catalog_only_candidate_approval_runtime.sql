create or replace function public.test_expect_data_taxonomy13_issue(
  p_expected_issue text,
  p_payload jsonb
)
returns void
language plpgsql
set search_path = 'public', 'pg_temp'
as $$
declare
  v_result jsonb;
begin
  v_result := public.admin_preflight_product_candidate_catalog_only_approval_v1(
    '11111111-1111-1111-1111-111111111111'::uuid,
    '6a9627b6-a5da-458f-84f7-3a40f91453be'::uuid,
    p_payload
  );

  if v_result ->> 'status' is distinct from 'blocked' then
    raise exception 'DATA-TAXONOMY13 runtime expected blocked for %, got %', p_expected_issue, v_result;
  end if;
  if not ((v_result -> 'issues') ? p_expected_issue) then
    raise exception 'DATA-TAXONOMY13 runtime missing issue %, got %', p_expected_issue, v_result -> 'issues';
  end if;
end;
$$;

-- Positive preflight + confirm + idempotent exact retry + zero Product/taxonomy assignment writes.
select public.test_seed_data_taxonomy13();

do $$
declare
  v_actor constant uuid := '11111111-1111-1111-1111-111111111111'::uuid;
  v_candidate constant uuid := '6a9627b6-a5da-458f-84f7-3a40f91453be'::uuid;
  v_payload jsonb := public.test_data_taxonomy13_payload();
  v_preflight jsonb;
  v_result jsonb;
  v_retry jsonb;
  v_products_before integer;
  v_products_after integer;
  v_assignments_before integer;
  v_assignments_after integer;
  v_candidate_row public.product_candidates%rowtype;
  v_review_row public.candidate_promotion_reviews%rowtype;
begin
  select count(*) into v_products_before from public.products;
  select count(*) into v_assignments_before from public.product_catalog_taxonomy_assignments;

  v_preflight := public.admin_preflight_product_candidate_catalog_only_approval_v1(
    v_actor, v_candidate, v_payload
  );

  if v_preflight ->> 'status' is distinct from 'ready' then
    raise exception 'DATA-TAXONOMY13 positive preflight not ready: %', v_preflight;
  end if;
  if (v_preflight #>> '{planned,products_write_count}')::integer <> 0
     or (v_preflight #>> '{planned,taxonomy_assignment_write_count}')::integer <> 0
     or (v_preflight #>> '{planned,recommendation_semantic_write_count}')::integer <> 0 then
    raise exception 'DATA-TAXONOMY13 positive preflight planned forbidden writes: %', v_preflight -> 'planned';
  end if;

  v_result := public.admin_confirm_product_candidate_catalog_only_approval_v1(
    v_actor,
    v_candidate,
    v_payload,
    v_preflight ->> 'candidate_updated_at',
    v_preflight ->> 'review_updated_at',
    v_preflight ->> 'classification_classified_at',
    v_preflight ->> 'evidence_hash',
    v_preflight ->> 'preflight_hash',
    'dt13-positive-request-0001'
  );

  if v_result ->> 'status' is distinct from 'confirmed'
     or v_result ->> 'candidate_review_status' is distinct from 'approved'
     or v_result ->> 'identity_resolution_state' is distinct from 'resolved'
     or v_result ->> 'queue_status' is distinct from 'approved'
     or v_result ->> 'promotion_action' is distinct from 'none'
     or (v_result ->> 'products_written')::integer <> 0
     or (v_result ->> 'taxonomy_assignments_written')::integer <> 0
     or (v_result ->> 'recommendation_semantic_writes')::integer <> 0
     or (v_result ->> 'product_facts_written')::integer <> 0
     or (v_result ->> 'offers_written')::integer <> 0 then
    raise exception 'DATA-TAXONOMY13 positive confirm invalid result: %', v_result;
  end if;

  select * into v_candidate_row from public.product_candidates where id = v_candidate;
  select * into v_review_row from public.candidate_promotion_reviews where candidate_id = v_candidate;

  if v_candidate_row.review_status <> 'approved'::public.product_review_status
     or v_candidate_row.identity_resolution_state is distinct from 'resolved'
     or v_candidate_row.identity_resolution_version is distinct from 'crawler-identity-resolution-v1'
     or v_candidate_row.canonical_brand is distinct from '파티온'
     or v_candidate_row.canonical_name is distinct from '노스카나인 트러블 세럼'
     or v_candidate_row.service_category is not null
     or v_candidate_row.product_form is not null
     or v_candidate_row.matched_product_id is not null
     or v_candidate_row.duplicate_of_product_id is not null then
    raise exception 'DATA-TAXONOMY13 candidate poststate invalid';
  end if;

  if v_review_row.status is distinct from 'approved' or v_review_row.approved_product_id is not null then
    raise exception 'DATA-TAXONOMY13 review queue poststate invalid';
  end if;

  select count(*) into v_products_after from public.products;
  select count(*) into v_assignments_after from public.product_catalog_taxonomy_assignments;
  if v_products_after <> v_products_before or v_assignments_after <> v_assignments_before then
    raise exception 'DATA-TAXONOMY13 forbidden business writes detected';
  end if;

  if (select count(*) from public.admin_catalog_only_candidate_approval_confirmations) <> 1 then
    raise exception 'DATA-TAXONOMY13 confirmation ledger count invalid';
  end if;
  if (select count(*) from public.admin_audit_events where action = 'admin.product_candidate.catalog_only_approval_confirmed') <> 1 then
    raise exception 'DATA-TAXONOMY13 audit event count invalid';
  end if;

  v_retry := public.admin_confirm_product_candidate_catalog_only_approval_v1(
    v_actor,
    v_candidate,
    v_payload,
    v_preflight ->> 'candidate_updated_at',
    v_preflight ->> 'review_updated_at',
    v_preflight ->> 'classification_classified_at',
    v_preflight ->> 'evidence_hash',
    v_preflight ->> 'preflight_hash',
    'dt13-positive-request-0001'
  );
  if v_retry is distinct from v_result then
    raise exception 'DATA-TAXONOMY13 exact retry was not idempotent';
  end if;
  if (select count(*) from public.admin_catalog_only_candidate_approval_confirmations) <> 1
     or (select count(*) from public.admin_audit_events where action = 'admin.product_candidate.catalog_only_approval_confirmed') <> 1 then
    raise exception 'DATA-TAXONOMY13 exact retry created duplicate writes';
  end if;

  begin
    perform public.admin_confirm_product_candidate_catalog_only_approval_v1(
      v_actor,
      v_candidate,
      jsonb_set(v_payload, '{reason}', '"Conflicting request payload must fail closed."'::jsonb),
      v_preflight ->> 'candidate_updated_at',
      v_preflight ->> 'review_updated_at',
      v_preflight ->> 'classification_classified_at',
      v_preflight ->> 'evidence_hash',
      v_preflight ->> 'preflight_hash',
      'dt13-positive-request-0001'
    );
    raise exception 'DATA-TAXONOMY13 request-id conflict unexpectedly succeeded';
  exception
    when unique_violation then
      if sqlerrm not like '%catalog_only_candidate_approval_request_id_conflict%' then
        raise;
      end if;
  end;
end;
$$;

-- Invalid identity evidence: fewer than two providers / no independent provider.
select public.test_seed_data_taxonomy13();
select public.test_expect_data_taxonomy13_issue(
  'identity_evidence_provider_count_insufficient',
  jsonb_set(
    public.test_data_taxonomy13_payload(),
    '{identity_evidence,providers}',
    jsonb_build_array(
      jsonb_build_object(
        'provider', 'hwahae',
        'locator', 'https://www.hwahae.co.kr/goods/60898',
        'canonical_brand', '파티온',
        'canonical_name', '노스카나인 트러블 세럼'
      )
    )
  )
);

-- Legacy projection contamination.
select public.test_seed_data_taxonomy13();
update public.product_candidates
set service_category = 'treatment'
where id = '6a9627b6-a5da-458f-84f7-3a40f91453be'::uuid;
select public.test_expect_data_taxonomy13_issue('legacy_projection_fields_present', public.test_data_taxonomy13_payload());

-- Stale classification snapshot.
select public.test_seed_data_taxonomy13();
update public.product_candidate_catalog_taxonomy_classifications
set source_name_snapshot = 'stale-source'
where candidate_id = '6a9627b6-a5da-458f-84f7-3a40f91453be'::uuid;
select public.test_expect_data_taxonomy13_issue('taxonomy_classification_snapshot_stale', public.test_data_taxonomy13_payload());

-- Non-source-rule classification.
select public.test_seed_data_taxonomy13();
update public.product_candidate_catalog_taxonomy_classifications
set classification_method = 'manual_v1'
where candidate_id = '6a9627b6-a5da-458f-84f7-3a40f91453be'::uuid;
select public.test_expect_data_taxonomy13_issue('taxonomy_classification_not_catalog_only_source_rule', public.test_data_taxonomy13_payload());

-- Source-rule drift.
select public.test_seed_data_taxonomy13();
update public.catalog_taxonomy_candidate_source_rules
set category_term_id = 'category:drift'
where rule_key = 'catalog-taxonomy-v1:source:hwahae:treatment';
select public.test_expect_data_taxonomy13_issue('taxonomy_source_rule_drifted', public.test_data_taxonomy13_payload());

-- Inactive canonical term.
select public.test_seed_data_taxonomy13();
update public.catalog_taxonomy_terms
set lifecycle_state = 'inactive'
where taxonomy_version = 'catalog-taxonomy-v1' and term_id = 'category:treatment';
select public.test_expect_data_taxonomy13_issue('taxonomy_term_set_not_active', public.test_data_taxonomy13_payload());

-- Runtime resolver drift independent of stored source-rule/classification state.
select public.test_seed_data_taxonomy13();
update public.test_data_taxonomy13_runtime_flags set runtime_drift = true where singleton = true;
select public.test_expect_data_taxonomy13_issue('taxonomy_runtime_resolution_drifted', public.test_data_taxonomy13_payload());

-- Normalized Product identity collision.
select public.test_seed_data_taxonomy13();
insert into public.products(normalized_brand, normalized_name, external_source, external_type, external_id)
values (
  public.normalize_brand_key('파티온'),
  public.normalize_product_key('노스카나인 트러블 세럼'),
  'other', 'products', 'other-1'
);
select public.test_expect_data_taxonomy13_issue('normalized_product_identity_collision', public.test_data_taxonomy13_payload());

-- Exact external Product collision.
select public.test_seed_data_taxonomy13();
insert into public.products(normalized_brand, normalized_name, external_source, external_type, external_id)
values ('different-brand', 'different-product', 'hwahae', 'products', '1996087');
select public.test_expect_data_taxonomy13_issue('exact_external_product_identity_collision', public.test_data_taxonomy13_payload());

-- Peer candidate normalized identity collision.
select public.test_seed_data_taxonomy13();
insert into public.product_candidates(
  id, source_name, category_path, external_type, external_id,
  brand_name_raw, product_name_raw, identity_resolution_state,
  identity_resolution_version, review_status, updated_at
) values (
  '22222222-2222-2222-2222-222222222222'::uuid,
  'other-source', 'treatment', 'products', 'peer-identity',
  '파티온', '노스카나인 트러블 세럼', 'unresolved',
  'crawler-identity-resolution-v1', 'new', now()
);
select public.test_expect_data_taxonomy13_issue('candidate_identity_peer_collision', public.test_data_taxonomy13_payload());

-- Peer candidate exact external collision.
select public.test_seed_data_taxonomy13();
insert into public.product_candidates(
  id, source_name, category_path, external_type, external_id,
  brand_name_raw, product_name_raw, identity_resolution_state,
  identity_resolution_version, review_status, updated_at
) values (
  '33333333-3333-3333-3333-333333333333'::uuid,
  'hwahae', 'treatment', 'products', '1996087',
  '다른브랜드', '다른제품', 'unresolved',
  'crawler-identity-resolution-v1', 'new', now()
);
select public.test_expect_data_taxonomy13_issue('candidate_external_peer_collision', public.test_data_taxonomy13_payload());

-- Stale-preflight protection with exact SQLSTATE.
select public.test_seed_data_taxonomy13();

do $$
declare
  v_actor constant uuid := '11111111-1111-1111-1111-111111111111'::uuid;
  v_candidate constant uuid := '6a9627b6-a5da-458f-84f7-3a40f91453be'::uuid;
  v_payload jsonb := public.test_data_taxonomy13_payload();
  v_preflight jsonb;
begin
  v_preflight := public.admin_preflight_product_candidate_catalog_only_approval_v1(v_actor, v_candidate, v_payload);
  if v_preflight ->> 'status' is distinct from 'ready' then
    raise exception 'DATA-TAXONOMY13 stale test preflight not ready';
  end if;

  update public.product_candidates
  set updated_at = updated_at + interval '1 second'
  where id = v_candidate;

  begin
    perform public.admin_confirm_product_candidate_catalog_only_approval_v1(
      v_actor,
      v_candidate,
      v_payload,
      v_preflight ->> 'candidate_updated_at',
      v_preflight ->> 'review_updated_at',
      v_preflight ->> 'classification_classified_at',
      v_preflight ->> 'evidence_hash',
      v_preflight ->> 'preflight_hash',
      'dt13-stale-request-0001'
    );
    raise exception 'DATA-TAXONOMY13 stale preflight unexpectedly succeeded';
  exception
    when serialization_failure then
      if sqlerrm not like '%catalog_only_candidate_approval_stale_preflight%' then
        raise;
      end if;
  end;
end;
$$;

-- Actor capability fail-closed.
select public.test_seed_data_taxonomy13();

do $$
begin
  begin
    perform public.admin_preflight_product_candidate_catalog_only_approval_v1(
      '99999999-9999-9999-9999-999999999999'::uuid,
      '6a9627b6-a5da-458f-84f7-3a40f91453be'::uuid,
      public.test_data_taxonomy13_payload()
    );
    raise exception 'DATA-TAXONOMY13 unauthorized actor unexpectedly succeeded';
  exception
    when insufficient_privilege then
      if sqlerrm not like '%admin_actor_forbidden%' then
        raise;
      end if;
  end;
end;
$$;

select jsonb_build_object(
  'status', 'PASS',
  'suite', 'DATA-TAXONOMY13 catalog-only candidate approval runtime',
  'positive_confirm', true,
  'exact_retry_idempotent', true,
  'request_id_conflict_fail_closed', true,
  'invalid_identity_evidence_fail_closed', true,
  'legacy_projection_fail_closed', true,
  'stale_classification_fail_closed', true,
  'non_source_rule_fail_closed', true,
  'source_rule_drift_fail_closed', true,
  'inactive_term_fail_closed', true,
  'runtime_resolver_drift_fail_closed', true,
  'normalized_product_collision_fail_closed', true,
  'external_product_collision_fail_closed', true,
  'peer_candidate_collision_fail_closed', true,
  'stale_preflight_fail_closed', true,
  'actor_capability_fail_closed', true,
  'production_application', false
) as data_taxonomy13_runtime_result;
