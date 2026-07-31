begin;

create or replace function public.admin_audit_payload_has_forbidden_content(
  p_value jsonb
)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  with recursive payload_nodes(node_key, node_value) as (
    select null::text, p_value
    union all
    select child.node_key, child.node_value
    from payload_nodes as parent
    cross join lateral (
      select entry.key as node_key, entry.value as node_value
      from jsonb_each(
        case
          when jsonb_typeof(parent.node_value) = 'object' then parent.node_value
          else '{}'::jsonb
        end
      ) as entry
      union all
      select null::text, item.value
      from jsonb_array_elements(
        case
          when jsonb_typeof(parent.node_value) = 'array' then parent.node_value
          else '[]'::jsonb
        end
      ) as item(value)
    ) as child
  )
  select exists (
    select 1
    from payload_nodes
    where (
      node_key is not null
      and lower(regexp_replace(node_key, '[^a-z0-9]+', '', 'g')) ~
        '(token|cookie|secret|servicerole|servicekey|authorization|rawimage|originalimage|imagebase64|faceimage|apikey|password)'
    ) or (
      jsonb_typeof(node_value) = 'string'
      and trim(both '"' from node_value::text) ~* (
        '^(bearer[[:space:]]+|data:image/)' ||
        '|^eyj[a-z0-9_-]{10,}\.[a-z0-9_-]{10,}\.[a-z0-9_-]{10,}$' ||
        '|service[_ -]?role|refresh[_ -]?token' ||
        '|(^|[;[:space:]])cookie[=:]|sb-[a-z0-9_-]*auth-token'
      )
    )
  );
$$;

alter function public.record_admin_audit_event(
  uuid, text, text, text, text, jsonb, jsonb, text, text, jsonb
) rename to record_admin_audit_event_unsafe_v1;

revoke all on function public.record_admin_audit_event_unsafe_v1(
  uuid, text, text, text, text, jsonb, jsonb, text, text, jsonb
) from public, anon, authenticated, service_role;

create or replace function public.record_admin_audit_event(
  p_actor_user_id uuid,
  p_required_capability text,
  p_action text,
  p_target_type text,
  p_target_id text,
  p_before_value jsonb,
  p_after_value jsonb,
  p_reason text,
  p_request_id text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.admin_audit_payload_has_forbidden_content(p_before_value)
    or public.admin_audit_payload_has_forbidden_content(p_after_value)
    or public.admin_audit_payload_has_forbidden_content(
      coalesce(p_metadata, '{}'::jsonb)
    )
  then
    raise exception 'admin_audit_sensitive_payload_rejected'
      using errcode = '22023';
  end if;

  return public.record_admin_audit_event_unsafe_v1(
    p_actor_user_id,
    p_required_capability,
    p_action,
    p_target_type,
    p_target_id,
    p_before_value,
    p_after_value,
    p_reason,
    p_request_id,
    p_metadata
  );
end;
$$;

revoke all on function public.admin_audit_payload_has_forbidden_content(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.record_admin_audit_event(
  uuid, text, text, text, text, jsonb, jsonb, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.record_admin_audit_event(
  uuid, text, text, text, text, jsonb, jsonb, text, text, jsonb
) to service_role;

alter function public.admin_preflight_product_candidate_review(
  uuid, uuid, text, text
) rename to admin_preflight_product_candidate_review_unsafe_v2;

revoke all on function public.admin_preflight_product_candidate_review_unsafe_v2(
  uuid, uuid, text, text
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
  v_duplicate_product public.products%rowtype;
  v_matched_product public.products%rowtype;
  v_result jsonb;
  v_issues text[] := '{}'::text[];
  v_planned jsonb;
  v_status text;
  v_preflight_hash text;
  v_normalized_brand text;
  v_normalized_name text;
begin
  v_result := public.admin_preflight_product_candidate_review_unsafe_v2(
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
    from jsonb_array_elements_text(
      coalesce(v_result -> 'issues', '[]'::jsonb)
    ) as item(value)
  ) as unique_issues;

  if lower(btrim(coalesce(p_decision, ''))) = 'approve' then
    v_normalized_brand := public.normalize_brand_key(v_candidate.canonical_brand);
    v_normalized_name := public.normalize_product_key(v_candidate.canonical_name);

    if v_candidate.duplicate_of_product_id is not null then
      select * into v_duplicate_product
      from public.products
      where id = v_candidate.duplicate_of_product_id
      for share;

      if not found then
        v_issues := array_append(
          v_issues,
          'invalid_duplicate_product_reference'
        );
      elsif nullif(v_normalized_brand, '') is not null
        and nullif(v_normalized_name, '') is not null
        and (
          v_duplicate_product.normalized_brand is distinct from v_normalized_brand
          or v_duplicate_product.normalized_name is distinct from v_normalized_name
        )
      then
        v_issues := array_append(v_issues, 'conflicting_product_identity');
      end if;
    end if;

    if v_candidate.matched_product_id is not null then
      select * into v_matched_product
      from public.products
      where id = v_candidate.matched_product_id
      for share;

      if not found then
        v_issues := array_append(
          v_issues,
          'invalid_matched_product_reference'
        );
      elsif nullif(v_normalized_brand, '') is not null
        and nullif(v_normalized_name, '') is not null
        and (
          v_matched_product.normalized_brand is distinct from v_normalized_brand
          or v_matched_product.normalized_name is distinct from v_normalized_name
        )
      then
        v_issues := array_append(v_issues, 'conflicting_product_identity');
      end if;
    end if;

    if v_candidate.duplicate_of_product_id is not null
      and v_candidate.matched_product_id is not null
      and v_candidate.duplicate_of_product_id <> v_candidate.matched_product_id
    then
      v_issues := array_append(v_issues, 'conflicting_product_references');
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
    v_planned := jsonb_set(
      v_planned,
      '{products_write_count}',
      '0'::jsonb,
      true
    );
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

revoke all on function public.admin_preflight_product_candidate_review(
  uuid, uuid, text, text
) from public, anon, authenticated;
grant execute on function public.admin_preflight_product_candidate_review(
  uuid, uuid, text, text
) to service_role;

comment on function public.record_admin_audit_event(
  uuid, text, text, text, text, jsonb, jsonb, text, text, jsonb
) is
  'Records an idempotent admin audit event after rejecting sensitive payload keys and values and re-validating active capability.';
comment on function public.admin_preflight_product_candidate_review(
  uuid, uuid, text, text
) is
  'Read-only product review preflight hardened against missing fields and conflicting existing-product identity references.';

do $$
begin
  if has_function_privilege(
    'service_role',
    'public.record_admin_audit_event_unsafe_v1(uuid,text,text,text,text,jsonb,jsonb,text,text,jsonb)',
    'EXECUTE'
  ) or has_function_privilege(
    'service_role',
    'public.admin_preflight_product_candidate_review_unsafe_v2(uuid,uuid,text,text)',
    'EXECUTE'
  ) then
    raise exception 'admin_security_hardening_unsafe_function_exposed';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.record_admin_audit_event(uuid,text,text,text,text,jsonb,jsonb,text,text,jsonb)',
    'EXECUTE'
  ) or not has_function_privilege(
    'service_role',
    'public.admin_preflight_product_candidate_review(uuid,uuid,text,text)',
    'EXECUTE'
  ) then
    raise exception 'admin_security_hardening_function_missing_grant';
  end if;
end $$;

commit;
