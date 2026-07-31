\set ON_ERROR_STOP on

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
) values
  ('30000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'owner-product-review@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), false, false),
  ('30000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'operator-product-review@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), false, false),
  ('30000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'viewer-product-review@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), false, false),
  ('30000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'premium-product-review@example.test', '{"premium_entitlement":"admin_override","role":"admin","admin":true}'::jsonb, '{}'::jsonb, now(), now(), false, false),
  ('30000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'privacy-product-review@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), false, false);

select public.bootstrap_first_admin_owner('30000000-0000-4000-8000-000000000001'::uuid);

insert into public.admin_memberships (user_id, role, is_active, granted_by)
values
  ('30000000-0000-4000-8000-000000000002', 'admin_operator', true, '30000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000003', 'admin_viewer', true, '30000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000005', 'admin_privacy', true, '30000000-0000-4000-8000-000000000001');

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
  normalized_brand
) values (
  '10000000-0000-4000-8000-000000000001',
  'Existing Serum',
  'Existing Brand',
  'treatment',
  'serum',
  array['combination'],
  array['acne'],
  'gel',
  'natural',
  'low',
  true,
  'existingserum',
  'existingbrand'
);

insert into public.product_candidates (
  id,
  source_name,
  external_type,
  external_id,
  category_path,
  product_name_raw,
  brand_name_raw,
  normalized_name,
  normalized_brand,
  service_category,
  product_form,
  canonical_name,
  canonical_brand,
  review_status,
  matched_product_id,
  promotion_payload
) values
  (
    '20000000-0000-4000-8000-000000000001', 'hwahae', 'goods', 'insert-1', 'skincare/serum',
    'New Calm Serum', 'New Brand', 'newcalmserum', 'newbrand', 'treatment', 'serum',
    'New Calm Serum', 'New Brand', 'needs_review', null,
    '{"product":{"skin_types":["combination","sensitive"],"concerns":["acne","redness"],"texture":"gel","finish":"natural","irritation_risk":"low","sensitivity_safe":true,"price_min":19000,"price_max":25000,"buy_link":null,"image_url":null}}'::jsonb
  ),
  (
    '20000000-0000-4000-8000-000000000002', 'hwahae', 'goods', 'merge-1', 'skincare/serum',
    'Existing Serum', 'Existing Brand', 'existingserum', 'existingbrand', 'treatment', 'serum',
    'Existing Serum', 'Existing Brand', 'needs_review', '10000000-0000-4000-8000-000000000001',
    '{"product":{"skin_types":["combination","sensitive"],"concerns":["acne","redness"],"texture":"gel","finish":"natural","irritation_risk":"low","sensitivity_safe":true,"price_min":19000,"price_max":25000,"buy_link":null,"image_url":null}}'::jsonb
  ),
  (
    '20000000-0000-4000-8000-000000000003', 'hwahae', 'goods', 'missing-form-1', 'skincare/serum',
    'Unknown Treatment', 'Unknown Brand', 'unknowntreatment', 'unknownbrand', 'treatment', null,
    'Unknown Treatment', 'Unknown Brand', 'needs_review', null,
    '{"product":{"skin_types":["combination","sensitive"],"concerns":["acne","redness"],"texture":"gel","finish":"natural","irritation_risk":"low","sensitivity_safe":true}}'::jsonb
  ),
  (
    '20000000-0000-4000-8000-000000000004', 'hwahae', 'goods', 'defer-1', 'skincare/serum',
    'Deferred Serum', 'Deferred Brand', 'deferredserum', 'deferredbrand', 'treatment', 'serum',
    'Deferred Serum', 'Deferred Brand', 'needs_review', null,
    '{"product":{"skin_types":["combination"],"concerns":["redness"],"texture":"gel","finish":"natural","irritation_risk":"low","sensitivity_safe":true}}'::jsonb
  ),
  (
    '20000000-0000-4000-8000-000000000005', 'hwahae', 'goods', 'block-1', 'skincare/serum',
    'Blocked Serum', 'Blocked Brand', 'blockedserum', 'blockedbrand', 'treatment', 'serum',
    'Blocked Serum', 'Blocked Brand', 'needs_review', null,
    '{"product":{"skin_types":["combination"],"concerns":["acne"],"texture":"gel","finish":"natural","irritation_risk":"low","sensitivity_safe":true}}'::jsonb
  ),
  (
    '20000000-0000-4000-8000-000000000006', 'hwahae', 'goods', 'stale-1', 'skincare/serum',
    'Stale Serum', 'Stale Brand', 'staleserum', 'stalebrand', 'treatment', 'serum',
    'Stale Serum', 'Stale Brand', 'needs_review', null,
    '{"product":{"skin_types":["combination"],"concerns":["acne"],"texture":"gel","finish":"natural","irritation_risk":"low","sensitivity_safe":true}}'::jsonb
  ),
  (
    '20000000-0000-4000-8000-000000000007', 'hwahae', 'goods', 'identity-conflict-1', 'skincare/serum',
    'Different Serum', 'Different Brand', 'differentserum', 'differentbrand', 'treatment', 'serum',
    'Different Serum', 'Different Brand', 'needs_review', '10000000-0000-4000-8000-000000000001',
    '{"product":{"skin_types":["combination"],"concerns":["acne"],"texture":"gel","finish":"natural","irritation_risk":"low","sensitivity_safe":true}}'::jsonb
  ),
  (
    '20000000-0000-4000-8000-000000000008', 'hwahae', 'goods', 'rollback-1', 'skincare/serum',
    'Rollback Serum', 'Rollback Brand', 'rollbackserum', 'rollbackbrand', 'treatment', 'serum',
    'Rollback Serum', 'Rollback Brand', 'needs_review', null,
    '{"product":{"skin_types":["combination"],"concerns":["acne"],"texture":"gel","finish":"natural","irritation_risk":"low","sensitivity_safe":true}}'::jsonb
  ),
  (
    '20000000-0000-4000-8000-000000000009', 'hwahae', 'goods', 'missing-payload-1', 'skincare/serum',
    'Missing Payload Serum', 'Missing Payload Brand', 'missingpayloadserum', 'missingpayloadbrand', 'treatment', 'serum',
    'Missing Payload Serum', 'Missing Payload Brand', 'needs_review', null,
    '{"product":{"skin_types":null,"concerns":null,"texture":null,"finish":null,"irritation_risk":null,"sensitivity_safe":null}}'::jsonb
  ),
  (
    '20000000-0000-4000-8000-000000000010', 'hwahae', 'goods', 'stale-candidate-1', 'skincare/serum',
    'Stale Candidate Serum', 'Stale Candidate Brand', 'stalecandidateserum', 'stalecandidatebrand', 'treatment', 'serum',
    'Stale Candidate Serum', 'Stale Candidate Brand', 'needs_review', null,
    '{"product":{"skin_types":["combination"],"concerns":["acne"],"texture":"gel","finish":"natural","irritation_risk":"low","sensitivity_safe":true}}'::jsonb
  ),
  (
    '20000000-0000-4000-8000-000000000011', 'hwahae', 'goods', 'stale-review-1', 'skincare/serum',
    'Stale Review Serum', 'Stale Review Brand', 'stalereviewserum', 'stalereviewbrand', 'treatment', 'serum',
    'Stale Review Serum', 'Stale Review Brand', 'needs_review', null,
    '{"product":{"skin_types":["combination"],"concerns":["acne"],"texture":"gel","finish":"natural","irritation_risk":"low","sensitivity_safe":true}}'::jsonb
  );

insert into public.candidate_promotion_reviews (
  candidate_id,
  status,
  priority_score,
  selection_reason,
  evidence_snapshot,
  rule_version
) values
  ('20000000-0000-4000-8000-000000000001', 'queued', 100, 'top rank', '{"concerns":[{"concern":"acne","latest_rank":1}]}'::jsonb, 'ranking-review-v2'),
  ('20000000-0000-4000-8000-000000000002', 'queued', 90, 'persistent', '{"concerns":[{"concern":"acne","latest_rank":2}]}'::jsonb, 'ranking-review-v2'),
  ('20000000-0000-4000-8000-000000000003', 'queued', 80, 'needs metadata', '{"concerns":[{"concern":"acne","latest_rank":3}]}'::jsonb, 'ranking-review-v2'),
  ('20000000-0000-4000-8000-000000000004', 'queued', 70, 'needs source', '{"concerns":[{"concern":"redness","latest_rank":4}]}'::jsonb, 'ranking-review-v2'),
  ('20000000-0000-4000-8000-000000000005', 'queued', 60, 'identity risk', '{"concerns":[{"concern":"acne","latest_rank":5}]}'::jsonb, 'ranking-review-v2'),
  ('20000000-0000-4000-8000-000000000006', 'queued', 50, 'stale evidence test', '{"concerns":[{"concern":"acne","latest_rank":6}]}'::jsonb, 'ranking-review-v2'),
  ('20000000-0000-4000-8000-000000000007', 'queued', 40, 'identity conflict test', '{"concerns":[{"concern":"acne","latest_rank":7}]}'::jsonb, 'ranking-review-v2'),
  ('20000000-0000-4000-8000-000000000008', 'queued', 30, 'rollback test', '{"concerns":[{"concern":"acne","latest_rank":8}]}'::jsonb, 'ranking-review-v2'),
  ('20000000-0000-4000-8000-000000000009', 'queued', 20, 'null validation test', '{"concerns":[{"concern":"acne","latest_rank":9}]}'::jsonb, 'ranking-review-v2'),
  ('20000000-0000-4000-8000-000000000010', 'queued', 10, 'stale candidate test', '{"concerns":[{"concern":"acne","latest_rank":10}]}'::jsonb, 'ranking-review-v2'),
  ('20000000-0000-4000-8000-000000000011', 'queued', 5, 'stale review test', '{"concerns":[{"concern":"acne","latest_rank":11}]}'::jsonb, 'ranking-review-v2');

do $$
declare
  v_preflight jsonb;
  v_result jsonb;
  v_retry jsonb;
  v_products_initial integer;
  v_products_after_insert integer;
  v_audit_count integer;
begin
  if has_function_privilege(
    'authenticated',
    'public.admin_preflight_product_candidate_review(uuid,uuid,text,text)',
    'EXECUTE'
  ) then
    raise exception 'authenticated_preflight_rpc_exposed';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.admin_confirm_product_candidate_review(uuid,uuid,text,text,text,text,text,text,text)',
    'EXECUTE'
  ) then
    raise exception 'authenticated_confirm_rpc_exposed';
  end if;

  perform set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000004', true);
  if public.get_current_admin_role() is not null then
    raise exception 'premium_override_became_admin';
  end if;

  begin
    perform public.admin_preflight_product_candidate_review(
      '30000000-0000-4000-8000-000000000003',
      '20000000-0000-4000-8000-000000000001',
      'approve',
      'viewer must be denied'
    );
    raise exception 'viewer_preflight_unexpectedly_succeeded';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform public.admin_preflight_product_candidate_review(
      '30000000-0000-4000-8000-000000000005',
      '20000000-0000-4000-8000-000000000001',
      'approve',
      'privacy admin must be denied'
    );
    raise exception 'privacy_preflight_unexpectedly_succeeded';
  exception
    when insufficient_privilege then null;
  end;

  if not (
    'admin.privacy.execute' = any(
      public.admin_role_capabilities('admin_privacy')
    )
  ) or (
    'admin.products.read' = any(
      public.admin_role_capabilities('admin_privacy')
    )
  ) then
    raise exception 'privacy_capability_matrix_invalid';
  end if;

  select count(*) into v_products_initial from public.products;

  v_preflight := public.admin_preflight_product_candidate_review(
    '30000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000003',
    'approve',
    'product form is required'
  );

  if v_preflight ->> 'status' <> 'blocked'
    or not ((v_preflight -> 'issues') ? 'missing_product_form')
    or (v_preflight #>> '{planned,products_write_count}')::integer <> 0
  then
    raise exception 'missing_product_form_preflight_not_blocked: %', v_preflight;
  end if;

  if (select count(*) from public.products) <> v_products_initial then
    raise exception 'blocked_preflight_changed_products';
  end if;

  v_preflight := public.admin_preflight_product_candidate_review(
    '30000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000009',
    'approve',
    'null fields must be rejected'
  );

  if v_preflight ->> 'status' <> 'blocked'
    or not ((v_preflight -> 'issues') ? 'missing_skin_types')
    or not ((v_preflight -> 'issues') ? 'missing_concerns')
    or not ((v_preflight -> 'issues') ? 'missing_texture')
    or not ((v_preflight -> 'issues') ? 'missing_finish')
    or not ((v_preflight -> 'issues') ? 'missing_irritation_risk')
    or not ((v_preflight -> 'issues') ? 'missing_sensitivity_safe')
    or (v_preflight #>> '{planned,products_write_count}')::integer <> 0
  then
    raise exception 'null_required_fields_preflight_not_blocked: %', v_preflight;
  end if;

  v_preflight := public.admin_preflight_product_candidate_review(
    '30000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000007',
    'approve',
    'identity conflict must be rejected'
  );

  if v_preflight ->> 'status' <> 'blocked'
    or not ((v_preflight -> 'issues') ? 'conflicting_product_identity')
    or (v_preflight #>> '{planned,products_write_count}')::integer <> 0
  then
    raise exception 'conflicting_identity_preflight_not_blocked: %', v_preflight;
  end if;

  v_preflight := public.admin_preflight_product_candidate_review(
    '30000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000001',
    'approve',
    'verified official product evidence'
  );

  if v_preflight ->> 'status' <> 'ready'
    or v_preflight #>> '{planned,promotion_action}' <> 'inserted'
    or (v_preflight #>> '{planned,products_write_count}')::integer <> 1
  then
    raise exception 'insert_preflight_invalid: %', v_preflight;
  end if;

  if (select count(*) from public.products) <> v_products_initial then
    raise exception 'insert_preflight_changed_products';
  end if;

  begin
    perform public.admin_confirm_product_candidate_review(
      '30000000-0000-4000-8000-000000000002',
      '20000000-0000-4000-8000-000000000001',
      'approve',
      'verified official product evidence',
      v_preflight ->> 'candidate_updated_at',
      v_preflight ->> 'review_updated_at',
      v_preflight ->> 'evidence_hash',
      '00000000000000000000000000000000',
      'review-insert-wrong-hash'
    );
    raise exception 'wrong_hash_confirm_unexpectedly_succeeded';
  exception
    when serialization_failure then null;
  end;

  v_result := public.admin_confirm_product_candidate_review(
    '30000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000001',
    'approve',
    'verified official product evidence',
    v_preflight ->> 'candidate_updated_at',
    v_preflight ->> 'review_updated_at',
    v_preflight ->> 'evidence_hash',
    v_preflight ->> 'preflight_hash',
    'review-insert-confirm-0001'
  );

  if v_result ->> 'status' <> 'confirmed'
    or v_result ->> 'promotion_action' <> 'inserted'
  then
    raise exception 'insert_confirm_invalid: %', v_result;
  end if;

  select count(*) into v_products_after_insert from public.products;
  if v_products_after_insert <> v_products_initial + 1 then
    raise exception 'insert_confirm_product_count_invalid';
  end if;

  v_retry := public.admin_confirm_product_candidate_review(
    '30000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000001',
    'approve',
    'verified official product evidence',
    v_preflight ->> 'candidate_updated_at',
    v_preflight ->> 'review_updated_at',
    v_preflight ->> 'evidence_hash',
    v_preflight ->> 'preflight_hash',
    'review-insert-confirm-0001'
  );

  if v_retry <> v_result or (select count(*) from public.products) <> v_products_after_insert then
    raise exception 'idempotent_retry_failed';
  end if;

  begin
    perform public.admin_confirm_product_candidate_review(
      '30000000-0000-4000-8000-000000000002',
      '20000000-0000-4000-8000-000000000002',
      'approve',
      'same request id must conflict across tasks',
      v_preflight ->> 'candidate_updated_at',
      v_preflight ->> 'review_updated_at',
      v_preflight ->> 'evidence_hash',
      v_preflight ->> 'preflight_hash',
      'review-insert-confirm-0001'
    );
    raise exception 'request_id_conflict_unexpectedly_succeeded';
  exception
    when unique_violation then null;
  end;

  v_preflight := public.admin_preflight_product_candidate_review(
    '30000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    'approve',
    'confirmed exact existing product'
  );

  if v_preflight #>> '{planned,promotion_action}' <> 'merged' then
    raise exception 'merge_preflight_invalid: %', v_preflight;
  end if;

  v_result := public.admin_confirm_product_candidate_review(
    '30000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    'approve',
    'confirmed exact existing product',
    v_preflight ->> 'candidate_updated_at',
    v_preflight ->> 'review_updated_at',
    v_preflight ->> 'evidence_hash',
    v_preflight ->> 'preflight_hash',
    'review-merge-confirm-0001'
  );

  if v_result ->> 'promotion_action' <> 'merged'
    or (select count(*) from public.products) <> v_products_after_insert
  then
    raise exception 'merge_confirm_failed: %', v_result;
  end if;

  v_preflight := public.admin_preflight_product_candidate_review(
    '30000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000004',
    'defer',
    'official source requires recheck'
  );

  if (v_preflight #>> '{planned,products_write_count}')::integer <> 0 then
    raise exception 'defer_preflight_planned_product_write';
  end if;

  v_result := public.admin_confirm_product_candidate_review(
    '30000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000004',
    'defer',
    'official source requires recheck',
    v_preflight ->> 'candidate_updated_at',
    v_preflight ->> 'review_updated_at',
    v_preflight ->> 'evidence_hash',
    v_preflight ->> 'preflight_hash',
    'review-defer-confirm-0001'
  );

  if v_result ->> 'queue_status' <> 'deferred'
    or (select count(*) from public.products) <> v_products_after_insert
  then
    raise exception 'defer_confirm_failed: %', v_result;
  end if;

  v_preflight := public.admin_preflight_product_candidate_review(
    '30000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000005',
    'block',
    'product identity is invalid'
  );

  v_result := public.admin_confirm_product_candidate_review(
    '30000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000005',
    'block',
    'product identity is invalid',
    v_preflight ->> 'candidate_updated_at',
    v_preflight ->> 'review_updated_at',
    v_preflight ->> 'evidence_hash',
    v_preflight ->> 'preflight_hash',
    'review-block-confirm-0001'
  );

  if v_result ->> 'queue_status' <> 'rejected'
    or (select count(*) from public.products) <> v_products_after_insert
  then
    raise exception 'block_confirm_failed: %', v_result;
  end if;

  v_preflight := public.admin_preflight_product_candidate_review(
    '30000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000006',
    'defer',
    'stale evidence test'
  );

  update public.candidate_promotion_reviews
  set evidence_snapshot = '{"concerns":[{"concern":"acne","latest_rank":1}],"changed":true}'::jsonb
  where candidate_id = '20000000-0000-4000-8000-000000000006';

  begin
    perform public.admin_confirm_product_candidate_review(
      '30000000-0000-4000-8000-000000000002',
      '20000000-0000-4000-8000-000000000006',
      'defer',
      'stale evidence test',
      v_preflight ->> 'candidate_updated_at',
      v_preflight ->> 'review_updated_at',
      v_preflight ->> 'evidence_hash',
      v_preflight ->> 'preflight_hash',
      'review-stale-confirm-0001'
    );
    raise exception 'stale_preflight_unexpectedly_succeeded';
  exception
    when serialization_failure then null;
  end;

  v_preflight := public.admin_preflight_product_candidate_review(
    '30000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000010',
    'defer',
    'stale candidate test'
  );

  update public.product_candidates
  set canonical_name = 'Changed Candidate Name',
      updated_at = '2030-01-02T00:00:00Z'
  where id = '20000000-0000-4000-8000-000000000010';

  begin
    perform public.admin_confirm_product_candidate_review(
      '30000000-0000-4000-8000-000000000002',
      '20000000-0000-4000-8000-000000000010',
      'defer',
      'stale candidate test',
      v_preflight ->> 'candidate_updated_at',
      v_preflight ->> 'review_updated_at',
      v_preflight ->> 'evidence_hash',
      v_preflight ->> 'preflight_hash',
      'review-stale-candidate-0001'
    );
    raise exception 'stale_candidate_unexpectedly_succeeded';
  exception
    when serialization_failure then null;
  end;

  v_preflight := public.admin_preflight_product_candidate_review(
    '30000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000011',
    'defer',
    'stale review test'
  );

  update public.candidate_promotion_reviews
  set updated_at = '2030-01-03T00:00:00Z'
  where candidate_id = '20000000-0000-4000-8000-000000000011';

  begin
    perform public.admin_confirm_product_candidate_review(
      '30000000-0000-4000-8000-000000000002',
      '20000000-0000-4000-8000-000000000011',
      'defer',
      'stale review test',
      v_preflight ->> 'candidate_updated_at',
      v_preflight ->> 'review_updated_at',
      v_preflight ->> 'evidence_hash',
      v_preflight ->> 'preflight_hash',
      'review-stale-review-0001'
    );
    raise exception 'stale_review_unexpectedly_succeeded';
  exception
    when serialization_failure then null;
  end;

  begin
    perform public.record_admin_audit_event(
      '30000000-0000-4000-8000-000000000001',
      'admin.roles.manage',
      'admin.sensitive.payload.test',
      'admin_membership',
      'sensitive-test',
      null,
      '{"access_token":"must-not-be-stored"}'::jsonb,
      'sensitive payload must fail',
      'review-sensitive-audit-0001',
      '{}'::jsonb
    );
    raise exception 'sensitive_audit_payload_unexpectedly_succeeded';
  exception
    when invalid_parameter_value then null;
  end;

  execute $ddl$
    create function public.fail_admin_audit_insert_for_test()
    returns trigger
    language plpgsql
    as $fn$
    begin
      raise exception 'forced_audit_failure';
    end;
    $fn$
  $ddl$;
  execute $ddl$
    create trigger fail_admin_audit_insert_for_test
    before insert on public.admin_audit_logs
    for each row execute function public.fail_admin_audit_insert_for_test()
  $ddl$;

  v_preflight := public.admin_preflight_product_candidate_review(
    '30000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000008',
    'approve',
    'forced rollback test'
  );

  begin
    perform public.admin_confirm_product_candidate_review(
      '30000000-0000-4000-8000-000000000002',
      '20000000-0000-4000-8000-000000000008',
      'approve',
      'forced rollback test',
      v_preflight ->> 'candidate_updated_at',
      v_preflight ->> 'review_updated_at',
      v_preflight ->> 'evidence_hash',
      v_preflight ->> 'preflight_hash',
      'review-rollback-confirm-0001'
    );
    raise exception 'forced_audit_failure_confirm_unexpectedly_succeeded';
  exception
    when raise_exception then
      if sqlerrm <> 'forced_audit_failure' then
        raise;
      end if;
  end;

  execute 'drop trigger fail_admin_audit_insert_for_test on public.admin_audit_logs';
  execute 'drop function public.fail_admin_audit_insert_for_test()';

  if (select count(*) from public.products) <> v_products_after_insert
    or (
      select review_status
      from public.product_candidates
      where id = '20000000-0000-4000-8000-000000000008'
    ) <> 'needs_review'::public.product_review_status
    or exists (
      select 1
      from public.admin_product_review_confirmations
      where request_id = 'review-rollback-confirm-0001'
    )
  then
    raise exception 'transaction_rollback_failed';
  end if;

  select count(*) into v_audit_count
  from public.admin_audit_logs
  where action = 'admin.product_candidate.review_confirmed';

  if v_audit_count <> 4 then
    raise exception 'audit_count_invalid: %', v_audit_count;
  end if;

  if has_table_privilege('service_role', 'public.admin_product_review_confirmations', 'SELECT')
    or has_table_privilege('authenticated', 'public.product_candidates', 'UPDATE')
  then
    raise exception 'direct_table_privilege_exposed';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000001', true);

do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.admin_audit_logs
  where action = 'admin.product_candidate.review_confirmed';

  if v_count <> 4 then
    raise exception 'owner_audit_visibility_invalid: %', v_count;
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000003', true);

do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.admin_audit_logs
  where action = 'admin.product_candidate.review_confirmed';

  if v_count <> 0 then
    raise exception 'viewer_audit_visibility_invalid: %', v_count;
  end if;

  begin
    update public.product_candidates
    set review_status = 'approved'
    where id = '20000000-0000-4000-8000-000000000003';
    raise exception 'viewer_direct_escalation_unexpectedly_succeeded';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;

rollback;

select 'ADMIN_PRODUCT_CANDIDATE_REVIEW_SQL_RUNTIME_VERIFIED' as status;
