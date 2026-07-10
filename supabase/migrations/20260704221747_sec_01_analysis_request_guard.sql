begin;

create table if not exists public.analysis_request_rate_windows (
  scope text not null check (scope in ('user', 'anonymous', 'ip')),
  subject_hash text not null check (subject_hash ~ '^[0-9a-f]{64}$'),
  endpoint text not null check (endpoint in ('analyze', 'face-reading')),
  window_key text not null check (btrim(window_key) <> ''),
  window_started_at timestamptz not null,
  window_reset_at timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (scope, subject_hash, endpoint, window_key),
  constraint analysis_request_rate_windows_window_order
    check (window_reset_at > window_started_at and expires_at >= window_reset_at)
);

create index if not exists analysis_request_rate_windows_expires_at_idx
  on public.analysis_request_rate_windows (expires_at);

create table if not exists public.analysis_request_idempotency (
  scope text not null check (scope in ('user', 'anonymous')),
  subject_hash text not null check (subject_hash ~ '^[0-9a-f]{64}$'),
  endpoint text not null check (endpoint in ('analyze', 'face-reading')),
  idempotency_key_hash text not null check (idempotency_key_hash ~ '^[0-9a-f]{64}$'),
  request_fingerprint_hash text not null check (request_fingerprint_hash ~ '^[0-9a-f]{64}$'),
  status text not null check (status in ('in_progress', 'completed', 'failed')),
  result_reference jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (scope, subject_hash, endpoint, idempotency_key_hash)
);

create index if not exists analysis_request_idempotency_expires_at_idx
  on public.analysis_request_idempotency (expires_at);

alter table public.analysis_request_rate_windows enable row level security;
alter table public.analysis_request_idempotency enable row level security;

revoke all on table public.analysis_request_rate_windows from anon, authenticated;
revoke all on table public.analysis_request_idempotency from anon, authenticated;
grant select, insert, update, delete on table public.analysis_request_rate_windows to service_role;
grant select, insert, update, delete on table public.analysis_request_idempotency to service_role;

create or replace function public.consume_analysis_rate_limits(
  p_limits jsonb
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_item record;
  v_window public.analysis_request_rate_windows%rowtype;
  v_allowed boolean := true;
  v_retry_after_seconds integer := 0;
  v_reset_at timestamptz := null;
  v_remaining integer := null;
  v_seen_keys text[] := array[]::text[];
  v_key text;
begin
  if p_limits is null or jsonb_typeof(p_limits) <> 'array' or jsonb_array_length(p_limits) = 0 then
    raise exception using errcode = '22023', message = 'analysis_rate_limits_invalid';
  end if;

  if jsonb_array_length(p_limits) > 8 then
    raise exception using errcode = '22023', message = 'analysis_rate_limits_too_many';
  end if;

  for v_item in
    select *
    from jsonb_to_recordset(p_limits) as item(
      scope text,
      subject_hash text,
      endpoint text,
      window_key text,
      window_started_at timestamptz,
      window_reset_at timestamptz,
      request_limit integer
    )
    order by scope, subject_hash, endpoint, window_key
  loop
    if v_item.scope not in ('user', 'anonymous', 'ip')
       or v_item.endpoint not in ('analyze', 'face-reading')
       or v_item.subject_hash !~ '^[0-9a-f]{64}$'
       or nullif(btrim(coalesce(v_item.window_key, '')), '') is null
       or v_item.window_started_at is null
       or v_item.window_reset_at is null
       or v_item.window_reset_at <= v_item.window_started_at
       or v_item.request_limit is null
       or v_item.request_limit <= 0 then
      raise exception using errcode = '22023', message = 'analysis_rate_limit_item_invalid';
    end if;

    v_key := v_item.scope || ':' || v_item.subject_hash || ':' || v_item.endpoint || ':' || v_item.window_key;

    if v_key = any(v_seen_keys) then
      raise exception using errcode = '22023', message = 'analysis_rate_limit_duplicate_item';
    end if;

    v_seen_keys := array_append(v_seen_keys, v_key);

    insert into public.analysis_request_rate_windows (
      scope,
      subject_hash,
      endpoint,
      window_key,
      window_started_at,
      window_reset_at,
      request_count,
      expires_at
    )
    values (
      v_item.scope,
      v_item.subject_hash,
      v_item.endpoint,
      v_item.window_key,
      v_item.window_started_at,
      v_item.window_reset_at,
      0,
      v_item.window_reset_at + interval '1 day'
    )
    on conflict (scope, subject_hash, endpoint, window_key) do nothing;
  end loop;

  for v_item in
    select *
    from jsonb_to_recordset(p_limits) as item(
      scope text,
      subject_hash text,
      endpoint text,
      window_key text,
      window_started_at timestamptz,
      window_reset_at timestamptz,
      request_limit integer
    )
    order by scope, subject_hash, endpoint, window_key
  loop
    select *
    into v_window
    from public.analysis_request_rate_windows
    where scope = v_item.scope
      and subject_hash = v_item.subject_hash
      and endpoint = v_item.endpoint
      and window_key = v_item.window_key
    for update;

    if not found then
      raise exception using errcode = 'P0002', message = 'analysis_rate_limit_window_missing';
    end if;

    if v_window.request_count >= v_item.request_limit then
      v_allowed := false;
      if v_reset_at is null or v_window.window_reset_at < v_reset_at then
        v_reset_at := v_window.window_reset_at;
        v_retry_after_seconds := greatest(1, ceil(extract(epoch from (v_window.window_reset_at - now())))::integer);
      end if;
    else
      v_remaining := least(
        coalesce(v_remaining, v_item.request_limit - v_window.request_count - 1),
        greatest(v_item.request_limit - v_window.request_count - 1, 0)
      );
    end if;
  end loop;

  if not v_allowed then
    return jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'reset_at', v_reset_at,
      'retry_after_seconds', v_retry_after_seconds
    );
  end if;

  for v_item in
    select *
    from jsonb_to_recordset(p_limits) as item(
      scope text,
      subject_hash text,
      endpoint text,
      window_key text,
      window_started_at timestamptz,
      window_reset_at timestamptz,
      request_limit integer
    )
    order by scope, subject_hash, endpoint, window_key
  loop
    update public.analysis_request_rate_windows
    set request_count = request_count + 1,
        updated_at = now(),
        window_started_at = v_item.window_started_at,
        window_reset_at = v_item.window_reset_at,
        expires_at = v_item.window_reset_at + interval '1 day'
    where scope = v_item.scope
      and subject_hash = v_item.subject_hash
      and endpoint = v_item.endpoint
      and window_key = v_item.window_key;
  end loop;

  return jsonb_build_object(
    'allowed', true,
    'remaining', greatest(coalesce(v_remaining, 0), 0),
    'reset_at', null,
    'retry_after_seconds', 0
  );
end;
$$;

create or replace function public.claim_analysis_idempotency(
  p_scope text,
  p_subject_hash text,
  p_endpoint text,
  p_idempotency_key_hash text,
  p_request_fingerprint_hash text,
  p_expires_at timestamptz,
  p_in_progress_timeout_seconds integer default 600
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_row public.analysis_request_idempotency%rowtype;
begin
  if p_scope not in ('user', 'anonymous')
     or p_endpoint not in ('analyze', 'face-reading')
     or p_subject_hash !~ '^[0-9a-f]{64}$'
     or p_idempotency_key_hash !~ '^[0-9a-f]{64}$'
     or p_request_fingerprint_hash !~ '^[0-9a-f]{64}$'
     or p_expires_at is null
     or p_expires_at <= now()
     or p_in_progress_timeout_seconds is null
     or p_in_progress_timeout_seconds <= 0 then
    raise exception using errcode = '22023', message = 'analysis_idempotency_claim_invalid';
  end if;

  insert into public.analysis_request_idempotency (
    scope,
    subject_hash,
    endpoint,
    idempotency_key_hash,
    request_fingerprint_hash,
    status,
    expires_at
  )
  values (
    p_scope,
    p_subject_hash,
    p_endpoint,
    p_idempotency_key_hash,
    p_request_fingerprint_hash,
    'in_progress',
    p_expires_at
  )
  on conflict (scope, subject_hash, endpoint, idempotency_key_hash) do nothing;

  if found then
    return jsonb_build_object('state', 'claimed');
  end if;

  select *
  into v_row
  from public.analysis_request_idempotency
  where scope = p_scope
    and subject_hash = p_subject_hash
    and endpoint = p_endpoint
    and idempotency_key_hash = p_idempotency_key_hash
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'analysis_idempotency_missing';
  end if;

  if v_row.request_fingerprint_hash <> p_request_fingerprint_hash then
    return jsonb_build_object('state', 'conflict');
  end if;

  if v_row.expires_at <= now() then
    update public.analysis_request_idempotency
    set status = 'in_progress',
        request_fingerprint_hash = p_request_fingerprint_hash,
        result_reference = null,
        updated_at = now(),
        expires_at = p_expires_at
    where scope = p_scope
      and subject_hash = p_subject_hash
      and endpoint = p_endpoint
      and idempotency_key_hash = p_idempotency_key_hash;

    return jsonb_build_object('state', 'claimed');
  end if;

  if v_row.status = 'completed' then
    return jsonb_build_object(
      'state', 'completed',
      'result_reference', coalesce(v_row.result_reference, '{}'::jsonb)
    );
  end if;

  if v_row.status = 'failed' then
    return jsonb_build_object('state', 'failed');
  end if;

  if v_row.updated_at < now() - make_interval(secs => p_in_progress_timeout_seconds) then
    update public.analysis_request_idempotency
    set status = 'in_progress',
        updated_at = now(),
        expires_at = p_expires_at
    where scope = p_scope
      and subject_hash = p_subject_hash
      and endpoint = p_endpoint
      and idempotency_key_hash = p_idempotency_key_hash;

    return jsonb_build_object('state', 'claimed');
  end if;

  return jsonb_build_object('state', 'in_progress');
end;
$$;

create or replace function public.complete_analysis_idempotency(
  p_scope text,
  p_subject_hash text,
  p_endpoint text,
  p_idempotency_key_hash text,
  p_request_fingerprint_hash text,
  p_result_reference jsonb default null
)
returns jsonb
language plpgsql
set search_path = public
as $$
begin
  update public.analysis_request_idempotency
  set status = 'completed',
      result_reference = p_result_reference,
      updated_at = now()
  where scope = p_scope
    and subject_hash = p_subject_hash
    and endpoint = p_endpoint
    and idempotency_key_hash = p_idempotency_key_hash
    and request_fingerprint_hash = p_request_fingerprint_hash
    and status = 'in_progress';

  if not found then
    return jsonb_build_object('updated', false);
  end if;

  return jsonb_build_object('updated', true);
end;
$$;

create or replace function public.fail_analysis_idempotency(
  p_scope text,
  p_subject_hash text,
  p_endpoint text,
  p_idempotency_key_hash text,
  p_request_fingerprint_hash text,
  p_retry_after_seconds integer default 600
)
returns jsonb
language plpgsql
set search_path = public
as $$
begin
  update public.analysis_request_idempotency
  set status = 'failed',
      result_reference = null,
      updated_at = now(),
      expires_at = now() + make_interval(secs => greatest(coalesce(p_retry_after_seconds, 600), 60))
  where scope = p_scope
    and subject_hash = p_subject_hash
    and endpoint = p_endpoint
    and idempotency_key_hash = p_idempotency_key_hash
    and request_fingerprint_hash = p_request_fingerprint_hash
    and status = 'in_progress';

  if not found then
    return jsonb_build_object('updated', false);
  end if;

  return jsonb_build_object('updated', true);
end;
$$;

create or replace function public.cleanup_analysis_request_guard(
  p_before timestamptz default now()
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_rate_deleted integer := 0;
  v_idempotency_deleted integer := 0;
begin
  delete from public.analysis_request_rate_windows
  where expires_at < p_before;
  get diagnostics v_rate_deleted = row_count;

  delete from public.analysis_request_idempotency
  where expires_at < p_before;
  get diagnostics v_idempotency_deleted = row_count;

  return jsonb_build_object(
    'rate_windows_deleted', v_rate_deleted,
    'idempotency_deleted', v_idempotency_deleted
  );
end;
$$;

revoke all on function public.consume_analysis_rate_limits(jsonb) from public;
revoke execute on function public.consume_analysis_rate_limits(jsonb) from anon;
revoke execute on function public.consume_analysis_rate_limits(jsonb) from authenticated;
grant execute on function public.consume_analysis_rate_limits(jsonb) to service_role;

revoke all on function public.claim_analysis_idempotency(text, text, text, text, text, timestamptz, integer) from public;
revoke execute on function public.claim_analysis_idempotency(text, text, text, text, text, timestamptz, integer) from anon;
revoke execute on function public.claim_analysis_idempotency(text, text, text, text, text, timestamptz, integer) from authenticated;
grant execute on function public.claim_analysis_idempotency(text, text, text, text, text, timestamptz, integer) to service_role;

revoke all on function public.complete_analysis_idempotency(text, text, text, text, text, jsonb) from public;
revoke execute on function public.complete_analysis_idempotency(text, text, text, text, text, jsonb) from anon;
revoke execute on function public.complete_analysis_idempotency(text, text, text, text, text, jsonb) from authenticated;
grant execute on function public.complete_analysis_idempotency(text, text, text, text, text, jsonb) to service_role;

revoke all on function public.fail_analysis_idempotency(text, text, text, text, text, integer) from public;
revoke execute on function public.fail_analysis_idempotency(text, text, text, text, text, integer) from anon;
revoke execute on function public.fail_analysis_idempotency(text, text, text, text, text, integer) from authenticated;
grant execute on function public.fail_analysis_idempotency(text, text, text, text, text, integer) to service_role;

revoke all on function public.cleanup_analysis_request_guard(timestamptz) from public;
revoke execute on function public.cleanup_analysis_request_guard(timestamptz) from anon;
revoke execute on function public.cleanup_analysis_request_guard(timestamptz) from authenticated;
grant execute on function public.cleanup_analysis_request_guard(timestamptz) to service_role;

commit;
