-- Test-only disposable local schema for the isolated shadow route harness.
-- It is intentionally outside production migrations and contains synthetic data only.

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

alter table public.analysis_request_rate_windows enable row level security;
alter table public.analysis_request_idempotency enable row level security;
alter table public.premium_report_sessions enable row level security;

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
      else 'local_shadow_unknown_table'
    end,
    tg_table_schema,
    tg_table_name,
    tg_op,
    md5(coalesce(source_row->>'session_id', source_row->>'idempotency_key_hash', source_row->>'window_key', 'local-shadow'))
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

grant usage on schema public to anon, authenticated, service_role;
grant select on public.products to anon, authenticated, service_role;
grant all on public.analysis_request_rate_windows, public.analysis_request_idempotency, public.premium_report_sessions to service_role;
grant execute on function public.consume_analysis_rate_limits(jsonb) to service_role;
grant execute on function public.claim_analysis_idempotency(text, text, text, text, text, timestamptz, integer) to service_role;
grant execute on function public.complete_analysis_idempotency(text, text, text, text, text, text) to service_role;
grant execute on function public.fail_analysis_idempotency(text, text, text, text, text, integer) to service_role;
revoke all on function shadow_audit.record_mutation() from public;
revoke all on function public.consume_analysis_rate_limits(jsonb) from public;
revoke all on function public.claim_analysis_idempotency(text, text, text, text, text, timestamptz, integer) from public;
revoke all on function public.complete_analysis_idempotency(text, text, text, text, text, text) from public;
revoke all on function public.fail_analysis_idempotency(text, text, text, text, text, integer) from public;
