begin;

create or replace function public.enforce_product_source_binding_projection_v1()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
declare
  v_source_name text := nullif(btrim(coalesce(new.external_source, '')), '');
  v_external_type text := nullif(btrim(coalesce(new.external_type, '')), '');
  v_external_id text := nullif(btrim(coalesce(new.external_id, '')), '');
  v_source_url text := nullif(btrim(coalesce(new.source_url, '')), '');
  v_existing_product_id uuid;
  v_old_complete boolean := false;
  v_identity_changed boolean := false;
begin
  if v_source_name is null or v_external_type is null or v_external_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    v_old_complete :=
      nullif(btrim(coalesce(old.external_source, '')), '') is not null
      and nullif(btrim(coalesce(old.external_type, '')), '') is not null
      and nullif(btrim(coalesce(old.external_id, '')), '') is not null;

    v_identity_changed :=
      btrim(coalesce(old.external_source, '')) is distinct from v_source_name
      or btrim(coalesce(old.external_type, '')) is distinct from v_external_type
      or btrim(coalesce(old.external_id, '')) is distinct from v_external_id;
  end if;

  select binding.product_id
    into v_existing_product_id
  from public.product_source_bindings as binding
  where binding.source_name = v_source_name
    and binding.external_type = v_external_type
    and binding.external_id = v_external_id
    and binding.binding_state = 'resolved'
  limit 1;

  if v_existing_product_id is not null and v_existing_product_id <> new.id then
    raise exception 'product_source_binding_projection_collision'
      using errcode = '23505';
  end if;

  if tg_op = 'UPDATE'
     and v_old_complete
     and v_identity_changed
     and v_existing_product_id is null
  then
    raise exception 'product_source_binding_identity_change_requires_governed_binding'
      using errcode = '23514';
  end if;

  if v_existing_product_id is null then
    insert into public.product_source_bindings(
      product_id,
      source_name,
      external_type,
      external_id,
      source_url,
      binding_state,
      binding_method,
      product_scope_state,
      first_observed_at,
      last_observed_at
    ) values (
      new.id,
      v_source_name,
      v_external_type,
      v_external_id,
      v_source_url,
      'resolved',
      'legacy_product_projection_sync_v1',
      'product_subject_unresolved',
      now(),
      now()
    );
  end if;

  return new;
end;
$function$;

revoke all on function public.enforce_product_source_binding_projection_v1()
  from public, anon, authenticated, service_role;

drop trigger if exists product_source_binding_projection_guard_v1 on public.products;

create trigger product_source_binding_projection_guard_v1
after insert or update of external_source, external_type, external_id, source_url
on public.products
for each row
execute function public.enforce_product_source_binding_projection_v1();

do $block$
begin
  if exists (
    select 1
    from public.products as product
    join public.product_source_bindings as binding
      on binding.source_name = btrim(product.external_source)
     and binding.external_type = btrim(product.external_type)
     and binding.external_id = btrim(product.external_id)
     and binding.binding_state = 'resolved'
    where nullif(btrim(coalesce(product.external_source, '')), '') is not null
      and nullif(btrim(coalesce(product.external_type, '')), '') is not null
      and nullif(btrim(coalesce(product.external_id, '')), '') is not null
      and binding.product_id <> product.id
  ) then
    raise exception 'product_source_binding_projection_backfill_collision'
      using errcode = '23505';
  end if;
end;
$block$;

insert into public.product_source_bindings(
  product_id,
  source_name,
  external_type,
  external_id,
  source_url,
  binding_state,
  binding_method,
  product_scope_state,
  first_observed_at,
  last_observed_at
)
select
  product.id,
  btrim(product.external_source),
  btrim(product.external_type),
  btrim(product.external_id),
  nullif(btrim(coalesce(product.source_url, '')), ''),
  'resolved',
  'legacy_product_projection_backfill_v1',
  'product_subject_unresolved',
  now(),
  now()
from public.products as product
where nullif(btrim(coalesce(product.external_source, '')), '') is not null
  and nullif(btrim(coalesce(product.external_type, '')), '') is not null
  and nullif(btrim(coalesce(product.external_id, '')), '') is not null
  and not exists (
    select 1
    from public.product_source_bindings as binding
    where binding.product_id = product.id
      and binding.source_name = btrim(product.external_source)
      and binding.external_type = btrim(product.external_type)
      and binding.external_id = btrim(product.external_id)
      and binding.binding_state = 'resolved'
  );

comment on function public.enforce_product_source_binding_projection_v1() is
  'Keeps legacy products external identity projection and product_source_bindings structurally consistent. New/incomplete-to-complete identities receive a binding atomically; complete identity replacement requires a pre-existing governed binding.';

comment on trigger product_source_binding_projection_guard_v1 on public.products is
  'Fail-closed structural guard for products external_source/external_type/external_id projection continuity. Does not establish Product Fact, Recommendation, formulation, or variant authority.';

commit;
