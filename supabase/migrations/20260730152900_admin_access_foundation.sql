begin;

create table if not exists public.admin_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null,
  is_active boolean not null default true,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_memberships_role_check check (
    role in ('admin_viewer', 'admin_operator', 'admin_privacy', 'admin_owner')
  )
);

create index if not exists admin_memberships_active_role_idx
on public.admin_memberships (is_active, role)
where is_active = true;

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null,
  actor_role text not null,
  action text not null,
  target_type text not null,
  target_id text,
  before_value jsonb,
  after_value jsonb,
  reason text not null,
  request_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint admin_audit_logs_actor_role_check check (
    actor_role in ('admin_viewer', 'admin_operator', 'admin_privacy', 'admin_owner')
  ),
  constraint admin_audit_logs_action_check check (
    char_length(btrim(action)) between 3 and 120
  ),
  constraint admin_audit_logs_target_type_check check (
    char_length(btrim(target_type)) between 2 and 120
  ),
  constraint admin_audit_logs_reason_check check (
    char_length(btrim(reason)) between 3 and 1000
  ),
  constraint admin_audit_logs_request_id_check check (
    char_length(btrim(request_id)) between 8 and 200
  ),
  constraint admin_audit_logs_metadata_object_check check (
    jsonb_typeof(metadata) = 'object'
  )
);

create index if not exists admin_audit_logs_created_at_idx
on public.admin_audit_logs (created_at desc);

create index if not exists admin_audit_logs_actor_created_at_idx
on public.admin_audit_logs (actor_user_id, created_at desc);

create unique index if not exists admin_audit_logs_idempotency_uidx
on public.admin_audit_logs (
  actor_user_id,
  request_id,
  action,
  target_type,
  coalesce(target_id, '')
);

create or replace function public.admin_role_capabilities(p_role text)
returns text[]
language sql
immutable
set search_path = public, pg_temp
as $$
  select case p_role
    when 'admin_viewer' then array[
      'admin.dashboard.read',
      'admin.products.read',
      'admin.analysis.read'
    ]::text[]
    when 'admin_operator' then array[
      'admin.dashboard.read',
      'admin.products.read',
      'admin.products.review',
      'admin.analysis.read',
      'admin.operations.execute'
    ]::text[]
    when 'admin_privacy' then array[
      'admin.dashboard.read',
      'admin.privacy.read',
      'admin.privacy.execute'
    ]::text[]
    when 'admin_owner' then array[
      'admin.dashboard.read',
      'admin.products.read',
      'admin.products.review',
      'admin.analysis.read',
      'admin.operations.execute',
      'admin.privacy.read',
      'admin.privacy.execute',
      'admin.audit.read',
      'admin.roles.manage'
    ]::text[]
    else array[]::text[]
  end;
$$;

create or replace function public.get_current_admin_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select membership.role
  from public.admin_memberships as membership
  where membership.user_id = auth.uid()
    and membership.is_active = true
  limit 1;
$$;

create or replace function public.admin_has_capability(p_capability text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    btrim(p_capability) = any(
      public.admin_role_capabilities(public.get_current_admin_role())
    ),
    false
  );
$$;

create or replace function public.bootstrap_first_admin_owner(p_user_id uuid)
returns public.admin_memberships
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_membership public.admin_memberships;
begin
  if p_user_id is null then
    raise exception 'admin_bootstrap_user_required' using errcode = '22004';
  end if;

  if exists (
    select 1
    from public.admin_memberships
    where is_active = true
  ) then
    raise exception 'admin_owner_already_bootstrapped' using errcode = '23505';
  end if;

  if not exists (
    select 1
    from auth.users
    where id = p_user_id
  ) then
    raise exception 'admin_bootstrap_user_not_found' using errcode = 'P0002';
  end if;

  insert into public.admin_memberships (
    user_id,
    role,
    is_active,
    granted_by,
    granted_at,
    updated_at
  )
  values (
    p_user_id,
    'admin_owner',
    true,
    null,
    now(),
    now()
  )
  returning * into v_membership;

  return v_membership;
end;
$$;

create or replace function public.record_admin_audit_event(
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
declare
  v_actor_user_id uuid := auth.uid();
  v_actor_role text;
  v_audit_id uuid;
begin
  v_actor_role := public.get_current_admin_role();

  if v_actor_user_id is null or v_actor_role is null then
    raise exception 'admin_access_required' using errcode = '42501';
  end if;

  if char_length(btrim(coalesce(p_action, ''))) not between 3 and 120 then
    raise exception 'admin_audit_action_invalid' using errcode = '22023';
  end if;

  if char_length(btrim(coalesce(p_target_type, ''))) not between 2 and 120 then
    raise exception 'admin_audit_target_type_invalid' using errcode = '22023';
  end if;

  if char_length(btrim(coalesce(p_reason, ''))) not between 3 and 1000 then
    raise exception 'admin_audit_reason_required' using errcode = '22023';
  end if;

  if char_length(btrim(coalesce(p_request_id, ''))) not between 8 and 200 then
    raise exception 'admin_audit_request_id_invalid' using errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) <> 'object' then
    raise exception 'admin_audit_metadata_invalid' using errcode = '22023';
  end if;

  if octet_length(coalesce(p_metadata, '{}'::jsonb)::text) > 8192 then
    raise exception 'admin_audit_metadata_too_large' using errcode = '22023';
  end if;

  insert into public.admin_audit_logs (
    actor_user_id,
    actor_role,
    action,
    target_type,
    target_id,
    before_value,
    after_value,
    reason,
    request_id,
    metadata
  )
  values (
    v_actor_user_id,
    v_actor_role,
    btrim(p_action),
    btrim(p_target_type),
    nullif(btrim(coalesce(p_target_id, '')), ''),
    p_before_value,
    p_after_value,
    btrim(p_reason),
    btrim(p_request_id),
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (
    actor_user_id,
    request_id,
    action,
    target_type,
    coalesce(target_id, '')
  )
  do nothing
  returning id into v_audit_id;

  if v_audit_id is null then
    select id into v_audit_id
    from public.admin_audit_logs
    where actor_user_id = v_actor_user_id
      and request_id = btrim(p_request_id)
      and action = btrim(p_action)
      and target_type = btrim(p_target_type)
      and coalesce(target_id, '') = coalesce(nullif(btrim(coalesce(p_target_id, '')), ''), '');
  end if;

  return v_audit_id;
end;
$$;

alter table public.admin_memberships enable row level security;
alter table public.admin_audit_logs enable row level security;

revoke all on table public.admin_memberships from public, anon, authenticated;
revoke all on table public.admin_audit_logs from public, anon, authenticated;

grant select on table public.admin_memberships to authenticated;
grant select on table public.admin_audit_logs to authenticated;
grant select, insert, update, delete on table public.admin_memberships to service_role;
grant select, insert, update, delete on table public.admin_audit_logs to service_role;

drop policy if exists "Admins can read own active membership" on public.admin_memberships;
create policy "Admins can read own active membership"
on public.admin_memberships
for select
to authenticated
using (
  user_id = auth.uid()
  and is_active = true
);

drop policy if exists "Owners can read admin audit logs" on public.admin_audit_logs;
create policy "Owners can read admin audit logs"
on public.admin_audit_logs
for select
to authenticated
using (
  public.admin_has_capability('admin.audit.read')
);

revoke all on function public.admin_role_capabilities(text) from public, anon, authenticated;
revoke all on function public.get_current_admin_role() from public, anon, authenticated;
revoke all on function public.admin_has_capability(text) from public, anon, authenticated;
revoke all on function public.bootstrap_first_admin_owner(uuid) from public, anon, authenticated;
revoke all on function public.record_admin_audit_event(text, text, text, jsonb, jsonb, text, text, jsonb) from public, anon, authenticated;

grant execute on function public.get_current_admin_role() to authenticated;
grant execute on function public.admin_has_capability(text) to authenticated;
grant execute on function public.record_admin_audit_event(text, text, text, jsonb, jsonb, text, text, jsonb) to authenticated;
grant execute on function public.admin_role_capabilities(text) to service_role;
grant execute on function public.get_current_admin_role() to service_role;
grant execute on function public.admin_has_capability(text) to service_role;
grant execute on function public.bootstrap_first_admin_owner(uuid) to service_role;
grant execute on function public.record_admin_audit_event(text, text, text, jsonb, jsonb, text, text, jsonb) to service_role;

comment on table public.admin_memberships is
  'Authoritative Bejewely administrator membership and role registry.';
comment on table public.admin_audit_logs is
  'Append-only audit events emitted by authenticated active administrators.';
comment on function public.bootstrap_first_admin_owner(uuid) is
  'Service-role-only one-time bootstrap for the first active admin_owner.';
comment on function public.record_admin_audit_event(text, text, text, jsonb, jsonb, text, text, jsonb) is
  'Records an idempotent audit event after re-validating the active administrator role.';

commit;
