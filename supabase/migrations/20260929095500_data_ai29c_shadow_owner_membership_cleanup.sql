begin;

revoke recommendation_protection_reader_owner
  from postgres
  granted by postgres;

do $$
declare
  v_total integer;
  v_expected integer;
  v_postgres_granted integer;
begin
  select
    count(*),
    count(*) filter (
      where grantor_role.rolname = 'supabase_admin'
        and m.admin_option is true
        and m.inherit_option is false
        and m.set_option is false
    ),
    count(*) filter (
      where grantor_role.rolname = 'postgres'
    )
    into v_total, v_expected, v_postgres_granted
  from pg_auth_members m
  join pg_roles member_role on member_role.oid = m.member
  join pg_roles granted_role on granted_role.oid = m.roleid
  join pg_roles grantor_role on grantor_role.oid = m.grantor
  where member_role.rolname = 'postgres'
    and granted_role.rolname = 'recommendation_protection_reader_owner';

  if v_total <> 1
     or v_expected <> 1
     or v_postgres_granted <> 0 then
    raise exception 'DATA_AI29C_OWNER_MEMBERSHIP_BASELINE_NOT_RESTORED';
  end if;

  if not has_function_privilege(
    'recommendation_admission_runtime',
    'public.read_recommendation_sunscreen_protection_authority_v1(uuid)',
    'EXECUTE'
  ) then
    raise exception 'DATA_AI29C_SHADOW_FALLBACK_RPC_EXECUTE_REQUIRED';
  end if;

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
      'public.product_evidence_records',
      'SELECT'
    ) then
    raise exception 'DATA_AI29C_SHADOW_FALLBACK_RAW_PF_SELECT_FORBIDDEN';
  end if;
end
$$;

commit;
