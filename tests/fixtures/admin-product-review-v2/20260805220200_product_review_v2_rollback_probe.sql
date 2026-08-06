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

create or replace function public.test_admin_product_review_v2_assert_stale_product(
  p_actor_user_id uuid,
  p_request_id text,
  p_payload jsonb,
  p_payload_hash text,
  p_product_id uuid,
  p_changed_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_original_updated_at timestamptz;
begin
  select updated_at into strict v_original_updated_at
  from public.products
  where id = p_product_id
  for update;

  update public.products
  set updated_at = p_changed_at
  where id = p_product_id;

  begin
    perform public.admin_confirm_product_review_import_v2_batch(
      p_actor_user_id,
      p_request_id,
      p_payload,
      p_payload_hash
    );
    raise exception 'review_v2_test_stale_product_not_rejected';
  exception
    when serialization_failure then
      if sqlerrm <> 'review_v2_stale_target_product' then
        raise;
      end if;
  end;

  update public.products
  set updated_at = v_original_updated_at
  where id = p_product_id;

  return 'review_v2_stale_target_product';
end;
$$;

create or replace function public.test_admin_product_review_v2_assert_stale_review(
  p_actor_user_id uuid,
  p_request_id text,
  p_payload jsonb,
  p_payload_hash text,
  p_product_id uuid,
  p_changed_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_original_updated_at timestamptz;
begin
  select updated_at into strict v_original_updated_at
  from public.product_metadata_field_reviews
  where product_id = p_product_id
    and field_name = 'cleansing_profile'
  for update;

  update public.product_metadata_field_reviews
  set updated_at = p_changed_at
  where product_id = p_product_id
    and field_name = 'cleansing_profile';

  begin
    perform public.admin_confirm_product_review_import_v2_batch(
      p_actor_user_id,
      p_request_id,
      p_payload,
      p_payload_hash
    );
    raise exception 'review_v2_test_stale_review_not_rejected';
  exception
    when serialization_failure then
      if sqlerrm <> 'review_v2_stale_metadata_review' then
        raise;
      end if;
  end;

  update public.product_metadata_field_reviews
  set updated_at = v_original_updated_at
  where product_id = p_product_id
    and field_name = 'cleansing_profile';

  return 'review_v2_stale_metadata_review';
end;
$$;

revoke all on function public.test_admin_product_review_v2_assert_stale_product(
  uuid, text, jsonb, text, uuid, timestamptz
) from public, anon, authenticated;
grant execute on function public.test_admin_product_review_v2_assert_stale_product(
  uuid, text, jsonb, text, uuid, timestamptz
) to service_role;

revoke all on function public.test_admin_product_review_v2_assert_stale_review(
  uuid, text, jsonb, text, uuid, timestamptz
) from public, anon, authenticated;
grant execute on function public.test_admin_product_review_v2_assert_stale_review(
  uuid, text, jsonb, text, uuid, timestamptz
) to service_role;

commit;
