begin;

alter function public.admin_preflight_product_candidate_review(uuid, uuid, text, text)
  rename to admin_preflight_product_candidate_review_unsafe_v1;

alter function public.admin_confirm_product_candidate_review(
  uuid, uuid, text, text, text, text, text, text, text
) rename to admin_confirm_product_candidate_review_unsafe_v1;

revoke all on function public.admin_preflight_product_candidate_review_unsafe_v1(
  uuid, uuid, text, text
) from public, anon, authenticated, service_role;

revoke all on function public.admin_confirm_product_candidate_review_unsafe_v1(
  uuid, uuid, text, text, text, text, text, text, text
) from public, anon, authenticated, service_role;

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
  v_candidate public.product_candidates%rowtype;
  v_result jsonb;
  v_product_payload jsonb;
  v_issues text[] := '{}'::text[];
  v_planned jsonb;
  v_status text;
  v_preflight_hash text;
begin
  v_result := public.admin_preflight_product_candidate_review_unsafe_v1(
    p_actor_user_id,
    p_candidate_id,
    p_decision,
    p_reason
  );

  select * into v_candidate
  from public.product_candidates
  where id = p_candidate_id;

  select coalesce(array_agg(value order by value), '{}'::text[])
  into v_issues
  from (
    select distinct value
    from jsonb_array_elements_text(coalesce(v_result -> 'issues', '[]'::jsonb)) as item(value)
  ) as unique_issues;

  if lower(btrim(coalesce(p_decision, ''))) = 'approve' then
    if nullif(btrim(coalesce(v_candidate.external_type, '')), '') is null
      or nullif(btrim(coalesce(v_candidate.external_id, '')), '') is null
    then
      v_issues := array_append(v_issues, 'missing_external_identity');
    end if;

    v_product_payload := coalesce(v_candidate.promotion_payload -> 'product', '{}'::jsonb);

    if jsonb_typeof(v_product_payload -> 'skin_types') is distinct from 'array' then
      v_issues := array_append(v_issues, 'missing_skin_types');
    end if;

    if jsonb_typeof(v_product_payload -> 'concerns') is distinct from 'array' then
      v_issues := array_append(v_issues, 'missing_concerns');
    end if;

    if jsonb_typeof(v_product_payload -> 'sensitivity_safe') is distinct from 'boolean' then
      v_issues := array_append(v_issues, 'missing_sensitivity_safe');
    end if;
  end if;

  select coalesce(array_agg(distinct issue order by issue), '{}'::text[])
  into v_issues
  from unnest(v_issues) as issue;

  v_status := case
    when coalesce(array_length(v_issues, 1), 0) = 0 then 'ready'
    else 'blocked'
  end;

  v_planned := coalesce(v_result -> 'planned', '{}'::jsonb);
  if v_status = 'blocked' then
    v_planned := jsonb_set(v_planned, '{products_write_count}', '0'::jsonb, true);
  end if;

  v_preflight_hash := md5(jsonb_build_object(
    'candidate_id', v_result -> 'candidate_id',
    'candidate_updated_at', v_result -> 'candidate_updated_at',
    'review_updated_at', v_result -> 'review_updated_at',
    'evidence_hash', v_result -> 'evidence_hash',
    'decision', v_result -> 'decision',
    'reason', v_result -> 'reason',
    'issues', to_jsonb(v_issues),
    'planned', v_planned,
    'before', v_result -> 'before',
    'after', v_result -> 'after'
  )::text);

  return jsonb_build_object(
    'status', v_status,
    'actor_role', v_result -> 'actor_role',
    'candidate_id', v_result -> 'candidate_id',
    'decision', v_result -> 'decision',
    'reason', v_result -> 'reason',
    'candidate_updated_at', v_result -> 'candidate_updated_at',
    'review_updated_at', v_result -> 'review_updated_at',
    'evidence_hash', v_result -> 'evidence_hash',
    'preflight_hash', v_preflight_hash,
    'issues', to_jsonb(v_issues),
    'planned', v_planned,
    'before', v_result -> 'before',
    'after', v_result -> 'after'
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
  v_decision text := lower(btrim(coalesce(p_decision, '')));
  v_request_id text := btrim(coalesce(p_request_id, ''));
  v_existing public.admin_product_review_confirmations%rowtype;
  v_preflight jsonb;
begin
  perform public.admin_require_product_review_actor(
    p_actor_user_id,
    'admin.products.review'
  );

  if char_length(v_request_id) not between 8 and 200 then
    raise exception 'admin_product_review_request_id_invalid' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('bejewely_admin_product_review:' || v_request_id, 0)
  );

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

  v_preflight := public.admin_preflight_product_candidate_review(
    p_actor_user_id,
    p_candidate_id,
    v_decision,
    p_reason
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

  return public.admin_confirm_product_candidate_review_unsafe_v1(
    p_actor_user_id,
    p_candidate_id,
    v_decision,
    p_reason,
    p_candidate_updated_at_expected,
    p_review_updated_at_expected,
    p_evidence_hash_expected,
    p_preflight_hash_expected,
    v_request_id
  );
end;
$$;

revoke all on function public.admin_preflight_product_candidate_review(
  uuid, uuid, text, text
) from public, anon, authenticated;

revoke all on function public.admin_confirm_product_candidate_review(
  uuid, uuid, text, text, text, text, text, text, text
) from public, anon, authenticated;

grant execute on function public.admin_preflight_product_candidate_review(
  uuid, uuid, text, text
) to service_role;

grant execute on function public.admin_confirm_product_candidate_review(
  uuid, uuid, text, text, text, text, text, text, text
) to service_role;

comment on function public.admin_preflight_product_candidate_review(
  uuid, uuid, text, text
) is
  'Hardened read-only preflight that rejects missing JSON fields and missing external identity.';

comment on function public.admin_confirm_product_candidate_review(
  uuid, uuid, text, text, text, text, text, text, text
) is
  'Hardened confirm wrapper with request-level serialization, optimistic concurrency, atomic promotion, and audit.';

do $$
begin
  if has_function_privilege(
    'service_role',
    'public.admin_preflight_product_candidate_review_unsafe_v1(uuid,uuid,text,text)',
    'EXECUTE'
  ) or has_function_privilege(
    'service_role',
    'public.admin_confirm_product_candidate_review_unsafe_v1(uuid,uuid,text,text,text,text,text,text,text)',
    'EXECUTE'
  ) then
    raise exception 'admin_product_review_unsafe_function_exposed';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.admin_preflight_product_candidate_review(uuid,uuid,text,text)',
    'EXECUTE'
  ) or not has_function_privilege(
    'service_role',
    'public.admin_confirm_product_candidate_review(uuid,uuid,text,text,text,text,text,text,text)',
    'EXECUTE'
  ) then
    raise exception 'admin_product_review_hardened_function_missing_grant';
  end if;
end $$;

commit;
