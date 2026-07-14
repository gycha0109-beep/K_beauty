-- Test-only disposable local schema for the isolated shadow route harness.
-- It is intentionally outside production migrations and contains synthetic data only.

create extension if not exists pgcrypto;

create schema if not exists shadow_audit;

create table if not exists public.products (
  id text primary key,
  brand text not null,
  name text not null,
  category text not null,
  product_form text,
  image_url text,
  created_at timestamptz not null default now(),
  skin_types text[] not null default '{}',
  concerns text[] not null default '{}',
  texture text,
  finish text,
  price_min numeric,
  price_max numeric,
  sensitivity_safe boolean,
  irritation_risk text,
  uv_filter_type text,
  tone_up boolean,
  white_cast text,
  eye_sting text,
  pilling_risk text,
  review_signals jsonb,
  market_signals jsonb,
  ingredient_signals jsonb
);

alter table public.products enable row level security;
drop policy if exists local_shadow_products_read on public.products;
create policy local_shadow_products_read on public.products for select to anon, authenticated using (true);

create table if not exists public.analysis_request_rate_windows (
  scope text not null,
  subject_hash text not null,
  endpoint text not null,
  window_key text not null,
  window_started_at timestamptz not null,
  window_reset_at timestamptz not null,
  request_limit integer not null,
  request_count integer not null default 0,
  primary key (scope, subject_hash, endpoint, window_key)
);

create table if not exists public.analysis_request_idempotency (
  scope text not null,
  subject_hash text not null,
  endpoint text not null,
  idempotency_key_hash text not null,
  request_fingerprint_hash text not null,
  state text not null default 'in_progress',
  expires_at timestamptz not null,
  retry_after_seconds integer,
  result_reference text,
  primary key (scope, subject_hash, endpoint, idempotency_key_hash)
);

create table if not exists public.premium_report_sessions (
  session_id text primary key,
  premium_report jsonb not null,
  locale text not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.anonymous_write_grants (
  id uuid primary key default gen_random_uuid(),
  jti_hash text not null unique check (jti_hash ~ '^[0-9a-f]{64}$'),
  version smallint not null check (version = 2),
  purpose text not null check (purpose = 'anonymous-analysis-write'),
  resource_type text not null check (resource_type = 'analysis-run'),
  resource_id text not null check (resource_id ~ '^[A-Za-z0-9_-]{24,128}$'),
  operation text not null check (operation in ('result:create', 'track:create')),
  principal_hash text not null check (principal_hash ~ '^[0-9a-f]{64}$'),
  expected_fingerprint_hash text check (expected_fingerprint_hash is null or expected_fingerprint_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'active' check (status in ('active', 'completed', 'revoked')),
  max_uses integer not null check (max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0 and used_count <= max_uses),
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  in_progress_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (resource_id, operation),
  constraint anonymous_write_grants_expiry_order check (expires_at > issued_at),
  constraint anonymous_write_grants_operation_contract check (
    (operation = 'result:create' and max_uses = 1 and expected_fingerprint_hash is not null)
    or (operation = 'track:create' and max_uses between 1 and 24 and expected_fingerprint_hash is null)
  )
);

create index if not exists anonymous_write_grants_expires_at_idx
  on public.anonymous_write_grants (expires_at);

alter table public.analysis_request_rate_windows enable row level security;
alter table public.analysis_request_idempotency enable row level security;
alter table public.premium_report_sessions enable row level security;
alter table public.anonymous_write_grants enable row level security;

create table if not exists shadow_audit.mutation_events (
  event_id bigint generated always as identity primary key,
  surface_id text not null,
  schema_name text not null,
  table_name text not null,
  operation text not null,
  normalized_row_identity text not null,
  event_count integer not null default 1
);

create or replace function shadow_audit.record_mutation()
returns trigger
language plpgsql
security definer
set search_path = shadow_audit, public
as $$
declare
  source_row jsonb := coalesce(to_jsonb(new), to_jsonb(old));
begin
  insert into shadow_audit.mutation_events (
    surface_id, schema_name, table_name, operation, normalized_row_identity
  ) values (
    case tg_table_name
      when 'analysis_request_rate_windows' then 'analysis_guard_rate_limit_rpc'
      when 'analysis_request_idempotency' then 'analysis_guard_idempotency_rpc'
      when 'premium_report_sessions' then 'premium_report_session_table'
      when 'anonymous_write_grants' then 'anonymous_write_grant_table'
      else 'local_shadow_unknown_table'
    end,
    tg_table_schema,
    tg_table_name,
    tg_op,
    md5(coalesce(source_row->>'session_id', source_row->>'idempotency_key_hash', source_row->>'window_key', source_row->>'jti_hash', 'local-shadow'))
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists local_shadow_rate_window_audit on public.analysis_request_rate_windows;
create trigger local_shadow_rate_window_audit after insert or update or delete on public.analysis_request_rate_windows
for each row execute function shadow_audit.record_mutation();
drop trigger if exists local_shadow_idempotency_audit on public.analysis_request_idempotency;
create trigger local_shadow_idempotency_audit after insert or update or delete on public.analysis_request_idempotency
for each row execute function shadow_audit.record_mutation();
drop trigger if exists local_shadow_premium_session_audit on public.premium_report_sessions;
create trigger local_shadow_premium_session_audit after insert or update or delete on public.premium_report_sessions
for each row execute function shadow_audit.record_mutation();
drop trigger if exists local_shadow_anonymous_write_grant_audit on public.anonymous_write_grants;
create trigger local_shadow_anonymous_write_grant_audit after insert or update or delete on public.anonymous_write_grants
for each row execute function shadow_audit.record_mutation();

create or replace function public.consume_analysis_rate_limits(p_limits jsonb)
returns jsonb language plpgsql as $$
declare item jsonb;
begin
  for item in select value from jsonb_array_elements(coalesce(p_limits, '[]'::jsonb)) loop
    insert into public.analysis_request_rate_windows (
      scope, subject_hash, endpoint, window_key, window_started_at, window_reset_at, request_limit, request_count
    ) values (
      item->>'scope', item->>'subject_hash', item->>'endpoint', item->>'window_key',
      (item->>'window_started_at')::timestamptz, (item->>'window_reset_at')::timestamptz,
      (item->>'request_limit')::integer, 1
    ) on conflict (scope, subject_hash, endpoint, window_key)
    do update set request_count = public.analysis_request_rate_windows.request_count + 1;
  end loop;
  return jsonb_build_object('allowed', true);
end;
$$;

create or replace function public.claim_analysis_idempotency(
  p_scope text, p_subject_hash text, p_endpoint text, p_idempotency_key_hash text,
  p_request_fingerprint_hash text, p_expires_at timestamptz, p_in_progress_timeout_seconds integer
) returns jsonb language plpgsql as $$
begin
  insert into public.analysis_request_idempotency (
    scope, subject_hash, endpoint, idempotency_key_hash, request_fingerprint_hash, expires_at
  ) values (p_scope, p_subject_hash, p_endpoint, p_idempotency_key_hash, p_request_fingerprint_hash, p_expires_at)
  on conflict do nothing;
  return jsonb_build_object('state', 'claimed');
end;
$$;

create or replace function public.complete_analysis_idempotency(
  p_scope text, p_subject_hash text, p_endpoint text, p_idempotency_key_hash text,
  p_request_fingerprint_hash text, p_result_reference text
) returns jsonb language plpgsql as $$
begin
  update public.analysis_request_idempotency set state = 'completed', result_reference = p_result_reference
  where scope = p_scope and subject_hash = p_subject_hash and endpoint = p_endpoint and idempotency_key_hash = p_idempotency_key_hash;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.fail_analysis_idempotency(
  p_scope text, p_subject_hash text, p_endpoint text, p_idempotency_key_hash text,
  p_request_fingerprint_hash text, p_retry_after_seconds integer
) returns jsonb language plpgsql as $$
begin
  update public.analysis_request_idempotency set state = 'failed', retry_after_seconds = p_retry_after_seconds
  where scope = p_scope and subject_hash = p_subject_hash and endpoint = p_endpoint and idempotency_key_hash = p_idempotency_key_hash;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.create_anonymous_write_grants(
  p_grants jsonb
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_item record;
  v_resource_id text := null;
  v_principal_hash text := null;
  v_issued_at timestamptz := null;
  v_expires_at timestamptz := null;
  v_operations text[] := array[]::text[];
  v_created integer := 0;
begin
  if p_grants is null or jsonb_typeof(p_grants) <> 'array' or jsonb_array_length(p_grants) <> 2 then
    raise exception using errcode = '22023', message = 'anonymous_write_grants_invalid';
  end if;

  for v_item in
    select *
    from jsonb_to_recordset(p_grants) as grant_row(
      jti_hash text,
      version integer,
      purpose text,
      resource_type text,
      resource_id text,
      operation text,
      principal_hash text,
      expected_fingerprint_hash text,
      max_uses integer,
      issued_at timestamptz,
      expires_at timestamptz
    )
  loop
    if coalesce(v_item.jti_hash, '') !~ '^[0-9a-f]{64}$'
       or v_item.version is null or v_item.version <> 2
       or v_item.purpose is distinct from 'anonymous-analysis-write'
       or v_item.resource_type is distinct from 'analysis-run'
       or coalesce(v_item.resource_id, '') !~ '^[A-Za-z0-9_-]{24,128}$'
       or v_item.operation is null or v_item.operation not in ('result:create', 'track:create')
       or coalesce(v_item.principal_hash, '') !~ '^[0-9a-f]{64}$'
       or v_item.issued_at is null
       or v_item.expires_at is null
       or v_item.expires_at <= v_item.issued_at
       or v_item.expires_at > v_item.issued_at + interval '1 day'
       or (v_item.operation = 'result:create' and (v_item.max_uses is null or v_item.max_uses <> 1 or v_item.expected_fingerprint_hash is null or v_item.expected_fingerprint_hash !~ '^[0-9a-f]{64}$'))
       or (v_item.operation = 'track:create' and (v_item.max_uses is null or v_item.max_uses not between 1 and 24 or v_item.expected_fingerprint_hash is not null)) then
      raise exception using errcode = '22023', message = 'anonymous_write_grant_invalid';
    end if;

    if v_resource_id is null then
      v_resource_id := v_item.resource_id;
      v_principal_hash := v_item.principal_hash;
      v_issued_at := v_item.issued_at;
      v_expires_at := v_item.expires_at;
    elsif v_resource_id <> v_item.resource_id
       or v_principal_hash <> v_item.principal_hash
       or v_issued_at <> v_item.issued_at
       or v_expires_at <> v_item.expires_at then
      raise exception using errcode = '22023', message = 'anonymous_write_grant_pair_mismatch';
    end if;

    if v_item.operation = any(v_operations) then
      raise exception using errcode = '22023', message = 'anonymous_write_grant_duplicate_operation';
    end if;

    v_operations := array_append(v_operations, v_item.operation);
  end loop;

  if cardinality(v_operations) <> 2
     or not ('result:create' = any(v_operations))
     or not ('track:create' = any(v_operations)) then
    raise exception using errcode = '22023', message = 'anonymous_write_grant_operations_invalid';
  end if;

  for v_item in
    select *
    from jsonb_to_recordset(p_grants) as grant_row(
      jti_hash text,
      version integer,
      purpose text,
      resource_type text,
      resource_id text,
      operation text,
      principal_hash text,
      expected_fingerprint_hash text,
      max_uses integer,
      issued_at timestamptz,
      expires_at timestamptz
    )
  loop
    insert into public.anonymous_write_grants (
      jti_hash,
      version,
      purpose,
      resource_type,
      resource_id,
      operation,
      principal_hash,
      expected_fingerprint_hash,
      max_uses,
      issued_at,
      expires_at
    ) values (
      v_item.jti_hash,
      v_item.version,
      v_item.purpose,
      v_item.resource_type,
      v_item.resource_id,
      v_item.operation,
      v_item.principal_hash,
      v_item.expected_fingerprint_hash,
      v_item.max_uses,
      v_item.issued_at,
      v_item.expires_at
    );

    v_created := v_created + 1;
  end loop;

  return jsonb_build_object('created', v_created);
end;
$$;

grant usage on schema public to anon, authenticated, service_role;
grant select on public.products to anon, authenticated, service_role;
grant all on public.analysis_request_rate_windows, public.analysis_request_idempotency, public.premium_report_sessions to service_role;
revoke all on table public.anonymous_write_grants from public, anon, authenticated;
grant select, insert, update, delete on table public.anonymous_write_grants to service_role;
grant execute on function public.consume_analysis_rate_limits(jsonb) to service_role;
grant execute on function public.claim_analysis_idempotency(text, text, text, text, text, timestamptz, integer) to service_role;
grant execute on function public.complete_analysis_idempotency(text, text, text, text, text, text) to service_role;
grant execute on function public.fail_analysis_idempotency(text, text, text, text, text, integer) to service_role;
revoke all on function public.create_anonymous_write_grants(jsonb) from public;
revoke execute on function public.create_anonymous_write_grants(jsonb) from anon, authenticated;
grant execute on function public.create_anonymous_write_grants(jsonb) to service_role;
revoke all on function shadow_audit.record_mutation() from public;
revoke all on function public.consume_analysis_rate_limits(jsonb) from public;
revoke all on function public.claim_analysis_idempotency(text, text, text, text, text, timestamptz, integer) from public;
revoke all on function public.complete_analysis_idempotency(text, text, text, text, text, text) from public;
revoke all on function public.fail_analysis_idempotency(text, text, text, text, text, integer) from public;
