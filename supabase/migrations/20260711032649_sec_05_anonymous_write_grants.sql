begin;

create extension if not exists pgcrypto;

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

create table if not exists public.anonymous_write_grant_uses (
  id uuid primary key default gen_random_uuid(),
  grant_id uuid not null references public.anonymous_write_grants(id) on delete cascade,
  request_fingerprint_hash text not null check (request_fingerprint_hash ~ '^[0-9a-f]{64}$'),
  status text not null check (status in ('in_progress', 'completed', 'failed')),
  attempt_count integer not null default 1 check (attempt_count between 1 and 3),
  in_progress_until timestamptz,
  result_reference jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (grant_id, request_fingerprint_hash)
);

create index if not exists anonymous_write_grant_uses_grant_status_idx
  on public.anonymous_write_grant_uses (grant_id, status);

alter table public.recommendation_logs
  add column if not exists anonymous_write_grant_use_id uuid
  references public.anonymous_write_grant_uses(id) on delete set null;

create unique index if not exists recommendation_logs_anonymous_write_grant_use_id_key
  on public.recommendation_logs (anonymous_write_grant_use_id)
  where anonymous_write_grant_use_id is not null;

alter table public.analysis_results
  add column if not exists anonymous_write_grant_use_id uuid
  references public.anonymous_write_grant_uses(id) on delete set null;

create unique index if not exists analysis_results_anonymous_write_grant_use_id_key
  on public.analysis_results (anonymous_write_grant_use_id)
  where anonymous_write_grant_use_id is not null;

alter table public.anonymous_write_grants enable row level security;
alter table public.anonymous_write_grant_uses enable row level security;

revoke all on table public.anonymous_write_grants from public, anon, authenticated;
revoke all on table public.anonymous_write_grant_uses from public, anon, authenticated;
grant select, insert, update, delete on table public.anonymous_write_grants to service_role;
grant select, insert, update, delete on table public.anonymous_write_grant_uses to service_role;

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

create or replace function public.claim_anonymous_write_grant(
  p_jti_hash text,
  p_principal_hash text,
  p_resource_type text,
  p_resource_id text,
  p_operation text,
  p_request_fingerprint_hash text
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_grant public.anonymous_write_grants%rowtype;
  v_use public.anonymous_write_grant_uses%rowtype;
  v_reference jsonb := null;
  v_use_id uuid := null;
  v_now timestamptz := now();
  v_lease_until timestamptz := now() + interval '5 minutes';
begin
  if p_jti_hash !~ '^[0-9a-f]{64}$'
     or p_principal_hash !~ '^[0-9a-f]{64}$'
     or p_resource_type <> 'analysis-run'
     or p_resource_id !~ '^[A-Za-z0-9_-]{24,128}$'
     or p_operation not in ('result:create', 'track:create')
     or p_request_fingerprint_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'anonymous_write_grant_claim_invalid';
  end if;

  select *
  into v_grant
  from public.anonymous_write_grants
  where jti_hash = p_jti_hash
  for update;

  if not found then
    return jsonb_build_object('state', 'invalid');
  end if;

  if v_grant.principal_hash <> p_principal_hash then
    return jsonb_build_object('state', 'principal_mismatch');
  end if;

  if v_grant.resource_type <> p_resource_type or v_grant.resource_id <> p_resource_id then
    return jsonb_build_object('state', 'resource_mismatch');
  end if;

  if v_grant.operation <> p_operation then
    return jsonb_build_object('state', 'operation_mismatch');
  end if;

  if v_grant.version <> 2
     or v_grant.purpose <> 'anonymous-analysis-write'
     or v_grant.resource_type <> 'analysis-run' then
    return jsonb_build_object('state', 'invalid');
  end if;

  if v_grant.expires_at <= v_now then
    return jsonb_build_object('state', 'expired');
  end if;

  if v_grant.operation = 'result:create'
     and v_grant.expected_fingerprint_hash <> p_request_fingerprint_hash then
    return jsonb_build_object('state', 'fingerprint_mismatch');
  end if;

  if v_grant.status = 'completed' then
    select id, result_reference
    into v_use_id, v_reference
    from public.anonymous_write_grant_uses
    where grant_id = v_grant.id
    order by updated_at desc
    limit 1;

    return jsonb_build_object(
      'state', 'completed',
      'use_id', v_use_id,
      'result_reference', coalesce(v_reference, '{}'::jsonb)
    );
  end if;

  if v_grant.status <> 'active' then
    return jsonb_build_object('state', 'inactive');
  end if;

  select *
  into v_use
  from public.anonymous_write_grant_uses
  where grant_id = v_grant.id
    and request_fingerprint_hash = p_request_fingerprint_hash
  for update;

  if found then
    if v_grant.operation = 'result:create' then
      if v_use.status = 'completed' then
        return jsonb_build_object(
          'state', 'completed',
          'use_id', v_use.id,
          'result_reference', coalesce(v_use.result_reference, '{}'::jsonb)
        );
      end if;

      if v_use.status = 'in_progress' then
        return jsonb_build_object('state', 'in_progress', 'use_id', v_use.id, 'lease_until', v_use.in_progress_until);
      end if;

      return jsonb_build_object('state', 'failed', 'use_id', v_use.id);
    end if;

    if v_use.status = 'completed' then
      return jsonb_build_object(
        'state', 'completed',
        'use_id', v_use.id,
        'result_reference', coalesce(v_use.result_reference, '{}'::jsonb)
      );
    end if;

    if v_use.status = 'in_progress' and v_use.in_progress_until > v_now then
      return jsonb_build_object('state', 'in_progress', 'use_id', v_use.id, 'lease_until', v_use.in_progress_until);
    end if;

    if v_use.attempt_count >= 3 then
      return jsonb_build_object('state', 'failed');
    end if;

    update public.anonymous_write_grant_uses
    set status = 'in_progress',
        attempt_count = attempt_count + 1,
        in_progress_until = v_lease_until,
        updated_at = v_now
    where id = v_use.id;

    if v_grant.operation = 'result:create' then
      update public.anonymous_write_grants
      set in_progress_until = v_lease_until,
          updated_at = v_now
      where id = v_grant.id;
    end if;

    return jsonb_build_object('state', 'claimed', 'use_id', v_use.id, 'retry', true, 'lease_until', v_lease_until);
  end if;

  if v_grant.used_count >= v_grant.max_uses then
    return jsonb_build_object('state', 'max_uses');
  end if;

  insert into public.anonymous_write_grant_uses (
    grant_id,
    request_fingerprint_hash,
    status,
    in_progress_until
  ) values (
    v_grant.id,
    p_request_fingerprint_hash,
    'in_progress',
    v_lease_until
  ) returning * into v_use;

  update public.anonymous_write_grants
  set used_count = used_count + 1,
      in_progress_until = case when operation = 'result:create' then v_lease_until else in_progress_until end,
      updated_at = v_now
  where id = v_grant.id;

  return jsonb_build_object('state', 'claimed', 'use_id', v_use.id, 'retry', false, 'lease_until', v_lease_until);
end;
$$;

create or replace function public.complete_anonymous_write_grant(
  p_jti_hash text,
  p_principal_hash text,
  p_resource_type text,
  p_resource_id text,
  p_operation text,
  p_request_fingerprint_hash text,
  p_result_reference jsonb default null
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_grant public.anonymous_write_grants%rowtype;
  v_use public.anonymous_write_grant_uses%rowtype;
begin
  select *
  into v_grant
  from public.anonymous_write_grants
  where jti_hash = p_jti_hash
  for update;

  if not found
     or v_grant.principal_hash <> p_principal_hash
     or v_grant.resource_type <> p_resource_type
     or v_grant.resource_id <> p_resource_id
     or v_grant.operation <> p_operation then
    return jsonb_build_object('updated', false);
  end if;

  select *
  into v_use
  from public.anonymous_write_grant_uses
  where grant_id = v_grant.id
    and request_fingerprint_hash = p_request_fingerprint_hash
  for update;

  if not found then
    return jsonb_build_object('updated', false);
  end if;

  if v_use.status = 'completed' then
    return jsonb_build_object('updated', true, 'already_completed', true);
  end if;

  if v_use.status <> 'in_progress' then
    return jsonb_build_object('updated', false);
  end if;

  update public.anonymous_write_grant_uses
  set status = 'completed',
      in_progress_until = null,
      result_reference = p_result_reference,
      updated_at = now()
  where id = v_use.id;

  update public.anonymous_write_grants
  set status = case when operation = 'result:create' then 'completed' else status end,
      in_progress_until = null,
      updated_at = now()
  where id = v_grant.id;

  return jsonb_build_object('updated', true);
end;
$$;

create or replace function public.fail_anonymous_write_grant(
  p_jti_hash text,
  p_principal_hash text,
  p_resource_type text,
  p_resource_id text,
  p_operation text,
  p_request_fingerprint_hash text
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_grant public.anonymous_write_grants%rowtype;
  v_use public.anonymous_write_grant_uses%rowtype;
begin
  select *
  into v_grant
  from public.anonymous_write_grants
  where jti_hash = p_jti_hash
  for update;

  if not found
     or v_grant.principal_hash <> p_principal_hash
     or v_grant.resource_type <> p_resource_type
     or v_grant.resource_id <> p_resource_id
     or v_grant.operation <> p_operation then
    return jsonb_build_object('updated', false);
  end if;

  select *
  into v_use
  from public.anonymous_write_grant_uses
  where grant_id = v_grant.id
    and request_fingerprint_hash = p_request_fingerprint_hash
  for update;

  if not found then
    return jsonb_build_object('updated', false);
  end if;

  if v_use.status = 'failed' then
    return jsonb_build_object('updated', true, 'already_failed', true);
  end if;

  if v_use.status <> 'in_progress' then
    return jsonb_build_object('updated', false);
  end if;

  update public.anonymous_write_grant_uses
  set status = 'failed',
      in_progress_until = null,
      updated_at = now()
  where id = v_use.id;

  update public.anonymous_write_grants
  set in_progress_until = null,
      updated_at = now()
  where id = v_grant.id;

  return jsonb_build_object('updated', true);
end;
$$;

create or replace function public.cleanup_anonymous_write_grants(
  p_before timestamptz default now()
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_grants_deleted integer := 0;
  v_uses_deleted integer := 0;
begin
  select count(*)
  into v_uses_deleted
  from public.anonymous_write_grant_uses as grant_use
  join public.anonymous_write_grants as grant on grant.id = grant_use.grant_id
  where grant.expires_at < p_before;

  delete from public.anonymous_write_grants
  where expires_at < p_before;
  get diagnostics v_grants_deleted = row_count;

  return jsonb_build_object(
    'grants_deleted', v_grants_deleted,
    'uses_deleted', v_uses_deleted
  );
end;
$$;

revoke all on function public.create_anonymous_write_grants(jsonb) from public;
revoke execute on function public.create_anonymous_write_grants(jsonb) from anon, authenticated;
grant execute on function public.create_anonymous_write_grants(jsonb) to service_role;

revoke all on function public.claim_anonymous_write_grant(text, text, text, text, text, text) from public;
revoke execute on function public.claim_anonymous_write_grant(text, text, text, text, text, text) from anon, authenticated;
grant execute on function public.claim_anonymous_write_grant(text, text, text, text, text, text) to service_role;

revoke all on function public.complete_anonymous_write_grant(text, text, text, text, text, text, jsonb) from public;
revoke execute on function public.complete_anonymous_write_grant(text, text, text, text, text, text, jsonb) from anon, authenticated;
grant execute on function public.complete_anonymous_write_grant(text, text, text, text, text, text, jsonb) to service_role;

revoke all on function public.fail_anonymous_write_grant(text, text, text, text, text, text) from public;
revoke execute on function public.fail_anonymous_write_grant(text, text, text, text, text, text) from anon, authenticated;
grant execute on function public.fail_anonymous_write_grant(text, text, text, text, text, text) to service_role;

revoke all on function public.cleanup_anonymous_write_grants(timestamptz) from public;
revoke execute on function public.cleanup_anonymous_write_grants(timestamptz) from anon, authenticated;
grant execute on function public.cleanup_anonymous_write_grants(timestamptz) to service_role;

commit;
