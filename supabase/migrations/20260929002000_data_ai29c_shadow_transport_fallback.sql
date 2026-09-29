begin;

do $$
begin
  if not exists (
    select 1 from pg_roles where rolname = 'recommendation_admission_runtime'
  ) then
    raise exception 'DATA_AI29C_ADMISSION_RUNTIME_ROLE_REQUIRED';
  end if;

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'read_recommendation_sunscreen_protection_authority_v1'
  ) then
    raise exception 'DATA_AI29C_PROTECTION_RPC_REQUIRED';
  end if;
end
$$;

grant recommendation_protection_reader_owner to postgres;
set role recommendation_protection_reader_owner;

grant execute on function public.read_recommendation_sunscreen_protection_authority_v1(uuid)
  to recommendation_admission_runtime;

comment on function public.read_recommendation_sunscreen_protection_authority_v1(uuid) is
  'DATA-AI29C bounded sunscreen protection authority transport. recommendation_protection_runtime is the dedicated authority role; recommendation_admission_runtime may execute this RPC only as the DATA-AI29C-B shadow transport fallback and retains zero raw Product Fact/Evidence SELECT.';

reset role;
revoke recommendation_protection_reader_owner from postgres;

do $$
begin
  if has_table_privilege(
      'recommendation_admission_runtime',
      'public.product_fact_subjects',
      'SELECT'
    )
    or has_table_privilege(
      'recommendation_admission_runtime',
      'public.product_fact_current',
      'SELECT'
    )
    or has_table_privilege(
      'recommendation_admission_runtime',
      'public.product_fact_instances',
      'SELECT'
    )
    or has_table_privilege(
      'recommendation_admission_runtime',
      'public.product_fact_registry_versions',
      'SELECT'
    )
    or has_table_privilege(
      'recommendation_admission_runtime',
      'public.product_fact_confirmations',
      'SELECT'
    )
    or has_table_privilege(
      'recommendation_admission_runtime',
      'public.product_evidence_records',
      'SELECT'
    ) then
    raise exception 'DATA_AI29C_SHADOW_FALLBACK_RAW_PF_SELECT_FORBIDDEN';
  end if;

  if not has_function_privilege(
    'recommendation_admission_runtime',
    'public.read_recommendation_sunscreen_protection_authority_v1(uuid)',
    'EXECUTE'
  ) then
    raise exception 'DATA_AI29C_SHADOW_FALLBACK_RPC_EXECUTE_REQUIRED';
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from pg_auth_members m
    join pg_roles member_role on member_role.oid = m.member
    join pg_roles granted_role on granted_role.oid = m.roleid
    where member_role.rolname = 'postgres'
      and granted_role.rolname = 'recommendation_protection_reader_owner'
  ) then
    raise exception 'DATA_AI29C_TRANSIENT_OWNER_MEMBERSHIP_MUST_BE_REVOKED';
  end if;
end
$$;

commit;
