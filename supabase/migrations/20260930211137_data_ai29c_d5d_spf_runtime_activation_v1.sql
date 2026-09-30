begin;

create table if not exists public.sunscreen_spf_runtime_activation_v1 (
  scope text primary key,
  enabled boolean not null,
  authorized_phase text not null,
  activated_by text not null,
  updated_at timestamptz not null default now(),
  constraint sunscreen_spf_runtime_activation_v1_scope_check
    check (scope = 'authenticated_product_query_beta'),
  constraint sunscreen_spf_runtime_activation_v1_phase_check
    check (authorized_phase = 'DATA-AI29C-D5D')
);

alter table public.sunscreen_spf_runtime_activation_v1 enable row level security;

revoke all privileges on public.sunscreen_spf_runtime_activation_v1
  from public, anon, authenticated, service_role, recommendation_admission_runtime;
revoke all privileges on public.sunscreen_spf_runtime_activation_v1
  from recommendation_admission_reader_owner;

grant select (
  scope,
  enabled,
  authorized_phase,
  updated_at
) on public.sunscreen_spf_runtime_activation_v1
  to recommendation_admission_reader_owner;

drop policy if exists data_ai29c_d5d_spf_activation_reader_v1
  on public.sunscreen_spf_runtime_activation_v1;
create policy data_ai29c_d5d_spf_activation_reader_v1
  on public.sunscreen_spf_runtime_activation_v1
  for select
  to recommendation_admission_reader_owner
  using (scope = 'authenticated_product_query_beta');

insert into public.sunscreen_spf_runtime_activation_v1 (
  scope,
  enabled,
  authorized_phase,
  activated_by,
  updated_at
)
values (
  'authenticated_product_query_beta',
  true,
  'DATA-AI29C-D5D',
  'explicit_user_approval',
  now()
)
on conflict (scope) do update
set enabled = excluded.enabled,
    authorized_phase = excluded.authorized_phase,
    activated_by = excluded.activated_by,
    updated_at = excluded.updated_at;

create or replace function public.read_data_ai29c_d5d_spf_runtime_activation_v1()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select jsonb_build_object(
        'contract_version', 'data-ai29c-d5d-spf-runtime-activation-v1',
        'scope', s.scope,
        'enabled', s.enabled,
        'authorized_phase', s.authorized_phase,
        'updated_at', s.updated_at
      )
      from public.sunscreen_spf_runtime_activation_v1 s
      where s.scope = 'authenticated_product_query_beta'
      limit 1
    ),
    jsonb_build_object(
      'contract_version', 'data-ai29c-d5d-spf-runtime-activation-v1',
      'scope', 'authenticated_product_query_beta',
      'enabled', false,
      'authorized_phase', 'DATA-AI29C-D5D',
      'updated_at', null
    )
  );
$$;

revoke all on function public.read_data_ai29c_d5d_spf_runtime_activation_v1()
  from public, anon, authenticated, service_role, recommendation_admission_runtime;
grant execute on function public.read_data_ai29c_d5d_spf_runtime_activation_v1()
  to recommendation_admission_runtime;

grant create on schema public to recommendation_admission_reader_owner;
grant recommendation_admission_reader_owner to postgres;
alter table public.sunscreen_spf_runtime_activation_v1
  owner to recommendation_admission_reader_owner;
alter function public.read_data_ai29c_d5d_spf_runtime_activation_v1()
  owner to recommendation_admission_reader_owner;
revoke recommendation_admission_reader_owner from postgres;
revoke create on schema public from recommendation_admission_reader_owner;

do $$
begin
  if has_schema_privilege(
    'recommendation_admission_reader_owner',
    'public',
    'CREATE'
  ) then
    raise exception 'D5D_OWNER_SCHEMA_CREATE_FORBIDDEN';
  end if;

  if has_table_privilege(
    'recommendation_admission_runtime',
    'public.sunscreen_spf_runtime_activation_v1',
    'SELECT'
  ) then
    raise exception 'D5D_RUNTIME_RAW_ACTIVATION_TABLE_SELECT_FORBIDDEN';
  end if;

  if not has_function_privilege(
    'recommendation_admission_runtime',
    'public.read_data_ai29c_d5d_spf_runtime_activation_v1()',
    'EXECUTE'
  ) then
    raise exception 'D5D_RUNTIME_ACTIVATION_RPC_EXECUTE_REQUIRED';
  end if;
end
$$;

commit;
