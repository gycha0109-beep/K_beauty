begin;
-- DATA-AI29C-FILTER-R4-C-R3: additive replay payload integrity guard.
-- Applies only after R4-C-R2; does not create an attestation writer or authorize Production.
do $pre$ begin
  if to_regprocedure('public.admin_confirm_bushman_identity_auth_v1(uuid,text,jsonb,text,text)') is null
    or to_regprocedure('public.admin_confirm_bushman_identity_auth_core_r3_v1(uuid,text,jsonb,text,text)') is not null
    or to_regprocedure('public.product_fact_controlled_sha256_json_v1(jsonb)') is null
  then raise exception 'r4c_r3_replay_guard_prerequisite_invalid' using errcode='55000';end if;
end $pre$;

alter function public.admin_confirm_bushman_identity_auth_v1(uuid,text,jsonb,text,text)
rename to admin_confirm_bushman_identity_auth_core_r3_v1;
revoke all on function public.admin_confirm_bushman_identity_auth_core_r3_v1(uuid,text,jsonb,text,text)
from public,anon,authenticated,service_role;

create function public.admin_confirm_bushman_identity_auth_v1(
p_actor_user_id uuid,p_request_id text,p_payload jsonb,
p_expected_payload_digest text,p_expected_prestate_digest text
) returns jsonb language plpgsql security definer
set search_path=public,extensions,pg_temp as $guard$
begin
  -- Verify the same actor capability as the original confirmation before parsing data.
  perform public.admin_require_product_review_actor(p_actor_user_id,'admin.products.review');
  if jsonb_typeof(p_payload)='object'
    and lower(btrim(coalesce(p_expected_payload_digest,''))) ~ '^[0-9a-f]{64}$'
    and public.product_fact_controlled_sha256_json_v1(p_payload)
        is distinct from lower(btrim(p_expected_payload_digest))
  then
    raise exception 'r4c_r2_request_reuse_conflict' using errcode='55000';
  end if;
  return public.admin_confirm_bushman_identity_auth_core_r3_v1(
    p_actor_user_id,p_request_id,p_payload,p_expected_payload_digest,p_expected_prestate_digest);
end $guard$;

revoke all on function public.admin_confirm_bushman_identity_auth_v1(uuid,text,jsonb,text,text)
from public,anon,authenticated,service_role;
grant execute on function public.admin_confirm_bushman_identity_auth_v1(uuid,text,jsonb,text,text)
to service_role;

do $acl$ begin
  if has_function_privilege('anon','public.admin_confirm_bushman_identity_auth_v1(uuid,text,jsonb,text,text)','EXECUTE')
    or has_function_privilege('authenticated','public.admin_confirm_bushman_identity_auth_v1(uuid,text,jsonb,text,text)','EXECUTE')
    or has_function_privilege('service_role','public.admin_confirm_bushman_identity_auth_core_r3_v1(uuid,text,jsonb,text,text)','EXECUTE')
    or not has_function_privilege('service_role','public.admin_confirm_bushman_identity_auth_v1(uuid,text,jsonb,text,text)','EXECUTE')
  then raise exception 'r4c_r3_replay_guard_acl_invalid' using errcode='55000';end if;
end $acl$;
commit;
