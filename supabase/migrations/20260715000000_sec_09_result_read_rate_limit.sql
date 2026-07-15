begin;

alter table public.analysis_request_rate_windows
  drop constraint if exists analysis_request_rate_windows_endpoint_check;

alter table public.analysis_request_rate_windows
  add constraint analysis_request_rate_windows_endpoint_check
  check (endpoint in ('analyze', 'face-reading', 'result-read'));

create or replace function public.consume_analysis_rate_limits(
  p_limits jsonb
)
returns jsonb
language plpgsql
security invoker
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
       or v_item.endpoint not in ('analyze', 'face-reading', 'result-read')
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

alter table public.analysis_request_rate_windows enable row level security;

revoke all on table public.analysis_request_rate_windows from public, anon, authenticated;
grant select, insert, update, delete on table public.analysis_request_rate_windows to service_role;

revoke all on function public.consume_analysis_rate_limits(jsonb) from public, anon, authenticated;
grant execute on function public.consume_analysis_rate_limits(jsonb) to service_role;

commit;
