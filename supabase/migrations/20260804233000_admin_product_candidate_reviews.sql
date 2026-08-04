begin;

create table if not exists public.admin_product_review_confirmations (
  request_id text primary key,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  candidate_id uuid not null references public.product_candidates(id) on delete restrict,
  decision text not null,
  preflight_hash text not null,
  result jsonb not null,
  confirmed_at timestamptz not null default now(),
  constraint admin_product_review_confirmations_request_id_check
    check (char_length(btrim(request_id)) between 8 and 200),
  constraint admin_product_review_confirmations_decision_check
    check (decision in ('approve', 'defer', 'block')),
  constraint admin_product_review_confirmations_preflight_hash_check
    check (char_length(preflight_hash) = 32),
  constraint admin_product_review_confirmations_result_object_check
    check (jsonb_typeof(result) = 'object'),
  constraint admin_product_review_confirmations_result_size_check
    check (octet_length(result::text) <= 65536)
);

create index if not exists admin_product_review_confirmations_candidate_idx
  on public.admin_product_review_confirmations (candidate_id, confirmed_at desc);

alter table public.admin_product_review_confirmations enable row level security;
revoke all on table public.admin_product_review_confirmations
  from public, anon, authenticated, service_role;

create or replace function public.admin_require_product_review_actor(
  p_actor_user_id uuid,
  p_required_capability text default 'admin.products.review'
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_role text;
  v_capability text := btrim(coalesce(p_required_capability, ''));
begin
  if p_actor_user_id is null then
    raise exception 'admin_product_review_actor_required' using errcode = '22004';
  end if;

  select membership.role into v_actor_role
  from public.admin_memberships as membership
  where membership.user_id = p_actor_user_id
    and membership.is_active = true
  limit 1;

  if v_actor_role is null then
    raise exception 'admin_product_review_access_required' using errcode = '42501';
  end if;

  if v_capability = '' or not (
    v_capability = any(public.admin_role_capabilities(v_actor_role))
  ) then
    raise exception 'admin_product_review_capability_required' using errcode = '42501';
  end if;

  return v_actor_role;
end;
$$;

create or replace function public.admin_preflight_product_candidate_review(
  p_actor_user_id uuid,
  p_candidate_id uuid,
  p_decision text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_role text;
  v_candidate public.product_candidates%rowtype;
  v_review public.candidate_promotion_reviews%rowtype;
  v_decision text := lower(btrim(coalesce(p_decision, '')));
  v_reason text := btrim(coalesce(p_reason, ''));
  v_product_payload jsonb;
  v_skin_types text[] := '{}'::text[];
  v_concerns text[] := '{}'::text[];
  v_texture text;
  v_finish text;
  v_irritation_risk text;
  v_issues text[] := '{}'::text[];
  v_target_id uuid;
  v_target_product jsonb;
  v_promotion_action text;
  v_products_write_count integer := 0;
  v_candidate_after_status text;
  v_queue_after_status text;
  v_candidate_updated_at text;
  v_review_updated_at text;
  v_evidence_hash text;
  v_before jsonb;
  v_after jsonb;
  v_planned jsonb;
  v_preflight_hash text;
  v_status text;
begin
  v_actor_role := public.admin_require_product_review_actor(
    p_actor_user_id,
    'admin.products.review'
  );

  if p_candidate_id is null then
    raise exception 'admin_product_review_candidate_required' using errcode = '22004';
  end if;

  select * into v_candidate
  from public.product_candidates
  where id = p_candidate_id;

  if not found then
    raise exception 'admin_product_review_candidate_not_found' using errcode = 'P0002';
  end if;

  select * into v_review
  from public.candidate_promotion_reviews
  where candidate_id = p_candidate_id;

  if not found then
    raise exception 'admin_product_review_queue_not_found' using errcode = 'P0002';
  end if;

  if v_decision not in ('approve', 'defer', 'block') then
    v_issues := array_append(v_issues, 'invalid_decision');
  end if;

  if char_length(v_reason) not between 3 and 1000 then
    v_issues := array_append(v_issues, 'reason_required');
  end if;

  if v_review.status not in ('queued', 'reviewing') then
    v_issues := array_append(v_issues, 'review_queue_not_actionable');
  end if;

  if v_candidate.review_status = 'promoted'::public.product_review_status then
    v_issues := array_append(v_issues, 'candidate_already_promoted');
  end if;

  if v_decision = 'approve' then
    if nullif(btrim(coalesce(v_candidate.canonical_name, '')), '') is null then
      v_issues := array_append(v_issues, 'missing_canonical_name');
    end if;

    if nullif(btrim(coalesce(v_candidate.canonical_brand, '')), '') is null then
      v_issues := array_append(v_issues, 'missing_canonical_brand');
    end if;

    if v_candidate.service_category is null then
      v_issues := array_append(v_issues, 'ambiguous_category');
    elsif v_candidate.service_category::text not in (
      'cleanser',
      'toner_essence',
      'toner_pad',
      'treatment',
      'moisturizer',
      'moisturizer_lotion_emulsion',
      'moisturizer_gel',
      'moisturizer_cream',
      'moisturizer_balm',
      'sunscreen'
    ) then
      v_issues := array_append(v_issues, 'invalid_category');
    elsif v_candidate.service_category::text = 'treatment' then
      if v_candidate.product_form is null then
        v_issues := array_append(v_issues, 'missing_product_form');
      elsif v_candidate.product_form::text not in (
        'serum', 'ampoule', 'essence', 'booster', 'peeling_solution'
      ) then
        v_issues := array_append(v_issues, 'invalid_product_form');
      end if;
    elsif v_candidate.product_form is not null then
      v_issues := array_append(v_issues, 'unexpected_product_form');
    end if;

    v_product_payload := coalesce(v_candidate.promotion_payload -> 'product', '{}'::jsonb);

    if jsonb_typeof(v_product_payload) <> 'object' then
      v_issues := array_append(v_issues, 'invalid_promotion_payload');
      v_product_payload := '{}'::jsonb;
    end if;

    if jsonb_typeof(v_product_payload -> 'skin_types') <> 'array' then
      v_issues := array_append(v_issues, 'missing_skin_types');
    else
      select coalesce(array_agg(distinct item order by item), '{}'::text[])
      into v_skin_types
      from jsonb_array_elements_text(v_product_payload -> 'skin_types') as item;

      if coalesce(array_length(v_skin_types, 1), 0) = 0 then
        v_issues := array_append(v_issues, 'missing_skin_types');
      elsif exists (
        select 1 from unnest(v_skin_types) as item
        where item not in ('oily', 'dry', 'combination', 'sensitive')
      ) then
        v_issues := array_append(v_issues, 'invalid_skin_types');
      end if;
    end if;

    if jsonb_typeof(v_product_payload -> 'concerns') <> 'array' then
      v_issues := array_append(v_issues, 'missing_concerns');
    else
      select coalesce(array_agg(distinct item order by item), '{}'::text[])
      into v_concerns
      from jsonb_array_elements_text(v_product_payload -> 'concerns') as item;

      if coalesce(array_length(v_concerns, 1), 0) = 0 then
        v_issues := array_append(v_issues, 'missing_concerns');
      elsif exists (
        select 1 from unnest(v_concerns) as item
        where item not in (
          'oiliness', 'dehydration', 'acne', 'uneven_tone', 'pores', 'redness', 'barrier'
        )
      ) then
        v_issues := array_append(v_issues, 'invalid_concerns');
      end if;
    end if;

    v_texture := nullif(btrim(coalesce(v_product_payload ->> 'texture', '')), '');
    if v_texture is null then
      v_issues := array_append(v_issues, 'missing_texture');
    elsif v_texture not in ('watery', 'gel', 'lotion', 'cream') then
      v_issues := array_append(v_issues, 'invalid_texture');
    end if;

    v_finish := nullif(btrim(coalesce(v_product_payload ->> 'finish', '')), '');
    if v_finish is null then
      v_issues := array_append(v_issues, 'missing_finish');
    elsif v_finish not in ('fresh', 'natural', 'dewy', 'soft_matte') then
      v_issues := array_append(v_issues, 'invalid_finish');
    end if;

    v_irritation_risk := nullif(btrim(coalesce(v_product_payload ->> 'irritation_risk', '')), '');
    if v_irritation_risk is null then
      v_issues := array_append(v_issues, 'missing_irritation_risk');
    elsif v_irritation_risk not in ('low', 'medium', 'high') then
      v_issues := array_append(v_issues, 'invalid_irritation_risk');
    end if;

    if jsonb_typeof(v_product_payload -> 'sensitivity_safe') <> 'boolean' then
      v_issues := array_append(v_issues, 'missing_sensitivity_safe');
    end if;

    if v_candidate.duplicate_of_product_id is not null then
      select id into v_target_id
      from public.products
      where id = v_candidate.duplicate_of_product_id;
    end if;

    if v_target_id is null and v_candidate.matched_product_id is not null then
      select id into v_target_id
      from public.products
      where id = v_candidate.matched_product_id
        and normalized_name = public.normalize_product_key(v_candidate.canonical_name)
        and normalized_brand = public.normalize_brand_key(v_candidate.canonical_brand);
    end if;

    if v_target_id is null
      and nullif(btrim(coalesce(v_candidate.canonical_name, '')), '') is not null
      and nullif(btrim(coalesce(v_candidate.canonical_brand, '')), '') is not null
    then
      select id into v_target_id
      from public.products
      where normalized_name = public.normalize_product_key(v_candidate.canonical_name)
        and normalized_brand = public.normalize_brand_key(v_candidate.canonical_brand)
      limit 1;
    end if;

    if v_target_id is null then
      v_promotion_action := 'inserted';
    else
      v_promotion_action := 'merged';
      select jsonb_build_object(
        'id', product.id,
        'brand', product.brand,
        'name', product.name,
        'category', product.category,
        'product_form', product.product_form
      ) into v_target_product
      from public.products as product
      where product.id = v_target_id;
    end if;

    if coalesce(array_length(v_issues, 1), 0) = 0 then
      v_products_write_count := 1;
    end if;

    v_candidate_after_status := 'promoted';
    v_queue_after_status := 'approved';
  elsif v_decision = 'defer' then
    v_promotion_action := 'none';
    v_candidate_after_status := 'needs_review';
    v_queue_after_status := 'deferred';
  elsif v_decision = 'block' then
    v_promotion_action := 'none';
    v_candidate_after_status := 'rejected';
    v_queue_after_status := 'rejected';
  else
    v_promotion_action := 'none';
    v_candidate_after_status := coalesce(v_candidate.review_status::text, 'unknown');
    v_queue_after_status := v_review.status;
  end if;

  select coalesce(array_agg(distinct issue order by issue), '{}'::text[])
  into v_issues
  from unnest(v_issues) as issue;

  v_candidate_updated_at := to_jsonb(v_candidate.updated_at) #>> '{}';
  v_review_updated_at := to_jsonb(v_review.updated_at) #>> '{}';
  v_evidence_hash := md5(coalesce(v_review.evidence_snapshot, '{}'::jsonb)::text);

  v_before := jsonb_build_object(
    'candidate_review_status', v_candidate.review_status,
    'queue_status', v_review.status,
    'matched_product_id', v_candidate.matched_product_id,
    'duplicate_of_product_id', v_candidate.duplicate_of_product_id,
    'approved_product_id', v_review.approved_product_id
  );

  v_after := jsonb_build_object(
    'candidate_review_status', v_candidate_after_status,
    'queue_status', v_queue_after_status,
    'target_product_id', v_target_id
  );

  v_planned := jsonb_build_object(
    'products_write_count', v_products_write_count,
    'promotion_action', v_promotion_action,
    'target_product_id', v_target_id,
    'target_product', v_target_product
  );

  v_status := case
    when coalesce(array_length(v_issues, 1), 0) = 0 then 'ready'
    else 'blocked'
  end;

  v_preflight_hash := md5(jsonb_build_object(
    'candidate_id', v_candidate.id,
    'candidate_updated_at', v_candidate_updated_at,
    'review_updated_at', v_review_updated_at,
    'evidence_hash', v_evidence_hash,
    'decision', v_decision,
    'reason', v_reason,
    'issues', to_jsonb(v_issues),
    'planned', v_planned,
    'before', v_before,
    'after', v_after
  )::text);

  return jsonb_build_object(
    'status', v_status,
    'actor_role', v_actor_role,
    'candidate_id', v_candidate.id,
    'decision', v_decision,
    'reason', v_reason,
    'candidate_updated_at', v_candidate_updated_at,
    'review_updated_at', v_review_updated_at,
    'evidence_hash', v_evidence_hash,
    'preflight_hash', v_preflight_hash,
    'issues', to_jsonb(v_issues),
    'planned', v_planned,
    'before', v_before,
    'after', v_after
  );
end;
$$;

create or replace function public.admin_confirm_product_candidate_review(
  p_actor_user_id uuid,
  p_candidate_id uuid,
  p_decision text,
  p_reason text,
  p_candidate_updated_at_expected text,
  p_review_updated_at_expected text,
  p_evidence_hash_expected text,
  p_preflight_hash_expected text,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_role text;
  v_decision text := lower(btrim(coalesce(p_decision, '')));
  v_reason text := btrim(coalesce(p_reason, ''));
  v_request_id text := btrim(coalesce(p_request_id, ''));
  v_existing public.admin_product_review_confirmations%rowtype;
  v_candidate public.product_candidates%rowtype;
  v_review public.candidate_promotion_reviews%rowtype;
  v_preflight jsonb;
  v_promotion_result jsonb;
  v_promotion_action text;
  v_product_id uuid;
  v_before jsonb;
  v_after jsonb;
  v_audit_id uuid;
  v_result jsonb;
begin
  v_actor_role := public.admin_require_product_review_actor(
    p_actor_user_id,
    'admin.products.review'
  );

  if char_length(v_request_id) not between 8 and 200 then
    raise exception 'admin_product_review_request_id_invalid' using errcode = '22023';
  end if;

  select * into v_existing
  from public.admin_product_review_confirmations
  where request_id = v_request_id;

  if found then
    if v_existing.actor_user_id <> p_actor_user_id
      or v_existing.candidate_id <> p_candidate_id
      or v_existing.decision <> v_decision
      or v_existing.preflight_hash <> btrim(coalesce(p_preflight_hash_expected, ''))
    then
      raise exception 'admin_product_review_request_id_conflict' using errcode = '23505';
    end if;

    return v_existing.result;
  end if;

  select * into v_candidate
  from public.product_candidates
  where id = p_candidate_id
  for update;

  if not found then
    raise exception 'admin_product_review_candidate_not_found' using errcode = 'P0002';
  end if;

  select * into v_review
  from public.candidate_promotion_reviews
  where candidate_id = p_candidate_id
  for update;

  if not found then
    raise exception 'admin_product_review_queue_not_found' using errcode = 'P0002';
  end if;

  v_preflight := public.admin_preflight_product_candidate_review(
    p_actor_user_id,
    p_candidate_id,
    v_decision,
    v_reason
  );

  if v_preflight ->> 'status' <> 'ready' then
    raise exception 'admin_product_review_preflight_blocked' using errcode = '23514';
  end if;

  if coalesce(v_preflight ->> 'candidate_updated_at', '')
      <> btrim(coalesce(p_candidate_updated_at_expected, ''))
    or coalesce(v_preflight ->> 'review_updated_at', '')
      <> btrim(coalesce(p_review_updated_at_expected, ''))
    or coalesce(v_preflight ->> 'evidence_hash', '')
      <> btrim(coalesce(p_evidence_hash_expected, ''))
    or coalesce(v_preflight ->> 'preflight_hash', '')
      <> btrim(coalesce(p_preflight_hash_expected, ''))
  then
    raise exception 'admin_product_review_stale_preflight' using errcode = '40001';
  end if;

  v_before := jsonb_build_object(
    'candidate_review_status', v_candidate.review_status,
    'queue_status', v_review.status,
    'matched_product_id', v_candidate.matched_product_id,
    'duplicate_of_product_id', v_candidate.duplicate_of_product_id,
    'approved_product_id', v_review.approved_product_id
  );

  if v_decision = 'approve' then
    update public.product_candidates
    set review_status = 'approved'::public.product_review_status,
        reviewed_at = now(),
        reviewed_by = p_actor_user_id::text,
        review_notes = trim(
          both from concat_ws(
            E'\n',
            nullif(review_notes, ''),
            'Admin approved: ' || v_reason
          )
        ),
        updated_at = now()
    where id = p_candidate_id;

    v_promotion_result := public.promote_product_candidate(
      p_candidate_id,
      p_actor_user_id::text
    );
    v_promotion_action := v_promotion_result ->> 'action';

    if v_promotion_action not in ('inserted', 'merged', 'already_promoted') then
      raise exception 'admin_product_review_promotion_failed' using errcode = '23514';
    end if;

    v_product_id := nullif(v_promotion_result ->> 'product_id', '')::uuid;

    update public.candidate_promotion_reviews
    set status = 'approved',
        reviewed_at = now(),
        review_note = v_reason,
        approved_product_id = v_product_id,
        updated_at = now()
    where candidate_id = p_candidate_id;
  elsif v_decision = 'defer' then
    update public.product_candidates
    set review_status = 'needs_review'::public.product_review_status,
        reviewed_at = now(),
        reviewed_by = p_actor_user_id::text,
        review_notes = trim(
          both from concat_ws(
            E'\n',
            nullif(review_notes, ''),
            'Admin deferred: ' || v_reason
          )
        ),
        updated_at = now()
    where id = p_candidate_id;

    update public.candidate_promotion_reviews
    set status = 'deferred',
        reviewed_at = now(),
        review_note = v_reason,
        approved_product_id = null,
        updated_at = now()
    where candidate_id = p_candidate_id;

    v_promotion_action := 'none';
  elsif v_decision = 'block' then
    update public.product_candidates
    set review_status = 'rejected'::public.product_review_status,
        reviewed_at = now(),
        reviewed_by = p_actor_user_id::text,
        review_notes = trim(
          both from concat_ws(
            E'\n',
            nullif(review_notes, ''),
            'Admin blocked: ' || v_reason
          )
        ),
        updated_at = now()
    where id = p_candidate_id;

    update public.candidate_promotion_reviews
    set status = 'rejected',
        reviewed_at = now(),
        review_note = v_reason,
        approved_product_id = null,
        updated_at = now()
    where candidate_id = p_candidate_id;

    v_promotion_action := 'none';
  else
    raise exception 'admin_product_review_invalid_decision' using errcode = '22023';
  end if;

  select * into v_candidate
  from public.product_candidates
  where id = p_candidate_id;

  select * into v_review
  from public.candidate_promotion_reviews
  where candidate_id = p_candidate_id;

  v_after := jsonb_build_object(
    'candidate_review_status', v_candidate.review_status,
    'queue_status', v_review.status,
    'product_id', coalesce(v_product_id, v_review.approved_product_id),
    'promotion_action', v_promotion_action
  );

  v_audit_id := public.record_admin_audit_event(
    p_actor_user_id,
    'admin.products.review',
    'admin.product_candidate.review_confirmed',
    'product_candidate',
    p_candidate_id::text,
    v_before,
    v_after,
    v_reason,
    v_request_id,
    jsonb_build_object(
      'decision', v_decision,
      'preflight_hash', v_preflight ->> 'preflight_hash',
      'promotion_action', v_promotion_action,
      'product_id', coalesce(v_product_id, v_review.approved_product_id),
      'queue_status', v_review.status
    )
  );

  v_result := jsonb_build_object(
    'status', 'confirmed',
    'request_id', v_request_id,
    'candidate_id', p_candidate_id,
    'decision', v_decision,
    'actor_role', v_actor_role,
    'queue_status', v_review.status,
    'candidate_review_status', v_candidate.review_status,
    'promotion_action', v_promotion_action,
    'product_id', coalesce(v_product_id, v_review.approved_product_id),
    'audit_id', v_audit_id
  );

  insert into public.admin_product_review_confirmations (
    request_id,
    actor_user_id,
    candidate_id,
    decision,
    preflight_hash,
    result,
    confirmed_at
  ) values (
    v_request_id,
    p_actor_user_id,
    p_candidate_id,
    v_decision,
    v_preflight ->> 'preflight_hash',
    v_result,
    now()
  );

  return v_result;
end;
$$;

revoke all on function public.admin_require_product_review_actor(uuid, text)
  from public, anon, authenticated;
revoke all on function public.admin_preflight_product_candidate_review(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.admin_confirm_product_candidate_review(
  uuid, uuid, text, text, text, text, text, text, text
) from public, anon, authenticated;

grant execute on function public.admin_require_product_review_actor(uuid, text)
  to service_role;
grant execute on function public.admin_preflight_product_candidate_review(uuid, uuid, text, text)
  to service_role;
grant execute on function public.admin_confirm_product_candidate_review(
  uuid, uuid, text, text, text, text, text, text, text
) to service_role;

comment on table public.admin_product_review_confirmations is
  'Idempotency ledger for confirmed administrator product candidate decisions.';
comment on function public.admin_preflight_product_candidate_review(uuid, uuid, text, text) is
  'Read-only product candidate review preflight with optimistic concurrency fingerprints.';
comment on function public.admin_confirm_product_candidate_review(
  uuid, uuid, text, text, text, text, text, text, text
) is
  'Confirms one product candidate decision, invokes the existing promotion RPC for approve, and records an audit event atomically.';

do $$
begin
  if to_regclass('public.admin_memberships') is null
    or to_regclass('public.admin_audit_logs') is null
  then
    raise exception 'admin_product_review_missing_access_foundation';
  end if;

  if to_regclass('public.product_candidates') is null
    or to_regclass('public.candidate_promotion_reviews') is null
    or to_regclass('public.products') is null
  then
    raise exception 'admin_product_review_missing_product_foundation';
  end if;

  if to_regprocedure('public.promote_product_candidate(uuid,text)') is null then
    raise exception 'admin_product_review_missing_promotion_rpc';
  end if;

  if to_regprocedure(
    'public.record_admin_audit_event(uuid,text,text,text,text,jsonb,jsonb,text,text,jsonb)'
  ) is null then
    raise exception 'admin_product_review_missing_audit_rpc';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.admin_preflight_product_candidate_review(uuid,uuid,text,text)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.admin_confirm_product_candidate_review(uuid,uuid,text,text,text,text,text,text,text)',
    'EXECUTE'
  ) then
    raise exception 'admin_product_review_authenticated_rpc_exposure';
  end if;
end $$;

commit;
