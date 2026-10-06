begin;

-- DATA-AI29C-D5E-D-R3-P1
-- Stable PostgREST RPC alias for the D5E-D-R3 preflight function.
-- The original identifier exceeded PostgreSQL's 63-byte identifier limit
-- and was physically stored as:
-- admin_preflight_product_fact_subject_identity_authority_upgrade

do $$
begin
  if to_regprocedure(
    'public.admin_preflight_product_fact_subject_identity_authority_upgrade(uuid,uuid,uuid,jsonb)'
  ) is null then
    raise exception 'd5e_d_r3_preflight_rpc_alias_prerequisite_missing'
      using errcode = '55000';
  end if;
end;
$$;

create or replace function public.admin_preflight_subject_identity_authority_upgrade_v1(
  p_actor_user_id uuid,
  p_subject_id uuid,
  p_source_candidate_id uuid,
  p_reviewed_identity jsonb
)
returns jsonb
language sql
security definer
set search_path = public, extensions, pg_temp
as $$
  select public.admin_preflight_product_fact_subject_identity_authority_upgrade(
    p_actor_user_id,
    p_subject_id,
    p_source_candidate_id,
    p_reviewed_identity
  );
$$;

comment on function public.admin_preflight_subject_identity_authority_upgrade_v1(
  uuid,uuid,uuid,jsonb
) is
  'Stable PostgREST alias for D5E-D-R3 Product Fact Subject identity-authority preflight.';

revoke all on function public.admin_preflight_subject_identity_authority_upgrade_v1(
  uuid,uuid,uuid,jsonb
) from public, anon, authenticated, service_role;

grant execute on function public.admin_preflight_subject_identity_authority_upgrade_v1(
  uuid,uuid,uuid,jsonb
) to service_role;

do $$
begin
  if has_function_privilege(
      'anon',
      'public.admin_preflight_subject_identity_authority_upgrade_v1(uuid,uuid,uuid,jsonb)',
      'EXECUTE'
    )
    or has_function_privilege(
      'authenticated',
      'public.admin_preflight_subject_identity_authority_upgrade_v1(uuid,uuid,uuid,jsonb)',
      'EXECUTE'
    )
    or not has_function_privilege(
      'service_role',
      'public.admin_preflight_subject_identity_authority_upgrade_v1(uuid,uuid,uuid,jsonb)',
      'EXECUTE'
    )
  then
    raise exception 'd5e_d_r3_preflight_rpc_alias_privilege_invalid';
  end if;
end;
$$;

commit;
