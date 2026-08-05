begin;

create or replace function public.test_admin_product_review_v2_rollback_probe()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.request_id = 'rollback-v2-test' then
    raise exception 'review_v2_test_partial_failure' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger test_admin_product_review_v2_rollback_probe
  after insert on public.product_metadata_field_reviews
  for each row execute function public.test_admin_product_review_v2_rollback_probe();

create or replace function public.test_admin_product_review_v2_set_review_updated_at(
  p_product_id uuid,
  p_updated_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.product_metadata_field_reviews
  set updated_at = p_updated_at
  where product_id = p_product_id
    and field_name = 'cleansing_profile';
  if not found then
    raise exception 'review_v2_test_review_not_found';
  end if;
end;
$$;

revoke all on function public.test_admin_product_review_v2_set_review_updated_at(uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.test_admin_product_review_v2_set_review_updated_at(uuid, timestamptz)
  to service_role;

commit;
