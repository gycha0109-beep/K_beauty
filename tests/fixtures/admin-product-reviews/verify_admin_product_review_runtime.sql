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
  ('30000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'premium-product-review@example.test', '{"premium_entitlement":"admin_override","role":"admin","admin":true}'::jsonb, '{}'::jsonb, now(), now(), false, false);

select public.bootstrap_first_admin_owner('30000000-0000-4000-8000-000000000001'::uuid);

insert into public.admin_memberships (user_id, role, is_active, granted_by)
values
  ('30000000-0000-4000-8000-000000000002', 'admin_operator', true, '30000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000003', 'admin_viewer', true, '30000000-0000-4000-8000-000000000001');

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
  ('20000000-0000-4000-8000-000000000006', 'queued', 50, 'stale test', '{"concerns":[{"concern":"acne","latest_rank":6}]}'::jsonb, 'ranking-review-v2');

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
  set evidence_snapshot = '{"concerns":[{"concern":"acne","latest_rank":1}],"changed":true}'::jsonb,
      updated_at = '2030-01-01T00:00:00Z'
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
