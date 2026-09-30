begin;

grant recommendation_admission_reader_owner to postgres;
set local role recommendation_admission_reader_owner;

grant update (enabled, activated_by, updated_at)
  on public.sunscreen_spf_runtime_activation_v1
  to postgres;

reset role;
revoke recommendation_admission_reader_owner from postgres;

do $$
begin
  if not has_column_privilege(
    'postgres',
    'public.sunscreen_spf_runtime_activation_v1',
    'enabled',
    'UPDATE'
  ) then
    raise exception 'D5D_R1_POSTGRES_ENABLED_UPDATE_REQUIRED';
  end if;

  if has_column_privilege(
    'recommendation_admission_runtime',
    'public.sunscreen_spf_runtime_activation_v1',
    'enabled',
    'UPDATE'
  ) then
    raise exception 'D5D_R1_RUNTIME_UPDATE_FORBIDDEN';
  end if;
end
$$;

commit;
