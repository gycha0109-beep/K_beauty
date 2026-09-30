begin;

grant update (enabled, activated_by, updated_at)
  on public.sunscreen_spf_runtime_activation_v1
  to postgres;

create table if not exists public.sunscreen_spf_runtime_activation_audit_v1 (
  audit_id uuid primary key default gen_random_uuid(),
  scope text not null,
  previous_enabled boolean not null,
  next_enabled boolean not null,
  reason text not null,
  changed_at timestamptz not null default now(),
  constraint sunscreen_spf_runtime_activation_audit_v1_scope_check
    check (scope = 'authenticated_product_query_beta'),
  constraint sunscreen_spf_runtime_activation_audit_v1_reason_check
    check (char_length(reason) between 3 and 128)
);

alter table public.sunscreen_spf_runtime_activation_audit_v1 enable row level security;

revoke all privileges on public.sunscreen_spf_runtime_activation_audit_v1
  from public, anon, authenticated, service_role,
       recommendation_admission_runtime,
       recommendation_admission_reader_owner;

create or replace function public.admin_set_data_ai29c_d5d_spf_runtime_activation_v1(
  p_enabled boolean,
  p_reason text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
  v_previous boolean;
  v_result jsonb;
begin
  if p_enabled is null then
    raise exception 'D5D_ACTIVATION_ENABLED_REQUIRED';
  end if;

  if char_length(v_reason) < 3 or char_length(v_reason) > 128 then
    raise exception 'D5D_ACTIVATION_REASON_INVALID';
  end if;

  select s.enabled
    into v_previous
  from public.sunscreen_spf_runtime_activation_v1 s
  where s.scope = 'authenticated_product_query_beta'
  for update;

  if v_previous is null then
    raise exception 'D5D_ACTIVATION_ROW_MISSING';
  end if;

  update public.sunscreen_spf_runtime_activation_v1
  set enabled = p_enabled,
      activated_by = v_reason,
      updated_at = now()
  where scope = 'authenticated_product_query_beta';

  insert into public.sunscreen_spf_runtime_activation_audit_v1 (
    scope,
    previous_enabled,
    next_enabled,
    reason
  )
  values (
    'authenticated_product_query_beta',
    v_previous,
    p_enabled,
    v_reason
  );

  select public.read_data_ai29c_d5d_spf_runtime_activation_v1()
    into v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_set_data_ai29c_d5d_spf_runtime_activation_v1(boolean, text)
  from public, anon, authenticated, service_role,
       recommendation_admission_runtime,
       recommendation_admission_reader_owner;
grant execute on function public.admin_set_data_ai29c_d5d_spf_runtime_activation_v1(boolean, text)
  to postgres;

do $$
begin
  if has_table_privilege(
    'recommendation_admission_runtime',
    'public.sunscreen_spf_runtime_activation_audit_v1',
    'SELECT'
  ) then
    raise exception 'D5D_R1_RUNTIME_AUDIT_SELECT_FORBIDDEN';
  end if;

  if has_function_privilege(
    'recommendation_admission_runtime',
    'public.admin_set_data_ai29c_d5d_spf_runtime_activation_v1(boolean, text)',
    'EXECUTE'
  ) then
    raise exception 'D5D_R1_RUNTIME_SETTER_EXECUTE_FORBIDDEN';
  end if;

  if not has_function_privilege(
    'postgres',
    'public.admin_set_data_ai29c_d5d_spf_runtime_activation_v1(boolean, text)',
    'EXECUTE'
  ) then
    raise exception 'D5D_R1_POSTGRES_SETTER_EXECUTE_REQUIRED';
  end if;
end
$$;

commit;
