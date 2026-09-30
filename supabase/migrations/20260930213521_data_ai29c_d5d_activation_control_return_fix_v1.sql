begin;

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
  v_updated_at timestamptz;
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
  where scope = 'authenticated_product_query_beta'
  returning updated_at into v_updated_at;

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

  return jsonb_build_object(
    'contract_version', 'data-ai29c-d5d-spf-runtime-activation-v1',
    'scope', 'authenticated_product_query_beta',
    'enabled', p_enabled,
    'authorized_phase', 'DATA-AI29C-D5D',
    'updated_at', v_updated_at
  );
end;
$$;

revoke all on function public.admin_set_data_ai29c_d5d_spf_runtime_activation_v1(boolean, text)
  from public, anon, authenticated, service_role,
       recommendation_admission_runtime,
       recommendation_admission_reader_owner;
grant execute on function public.admin_set_data_ai29c_d5d_spf_runtime_activation_v1(boolean, text)
  to postgres;

commit;
