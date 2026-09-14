begin;

do $data_taxonomy8$
declare
  v_udt_schema text;
  v_udt_name text;
  v_is_nullable text;
  v_invalid_product_count bigint;
begin
  select c.udt_schema, c.udt_name, c.is_nullable
    into v_udt_schema, v_udt_name, v_is_nullable
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'products'
    and c.column_name = 'category';

  if not found then
    raise exception 'DATA-TAXONOMY8: public.products.category is missing';
  end if;

  if v_udt_schema <> 'public' or v_udt_name <> 'product_category' then
    raise exception 'DATA-TAXONOMY8: public.products.category type drifted: %.%', v_udt_schema, v_udt_name;
  end if;

  if v_is_nullable <> 'NO' then
    raise exception 'DATA-TAXONOMY8: expected NOT NULL category baseline before nullable-projection migration';
  end if;

  if to_regclass('public.catalog_taxonomy_product_exact_equivalence_v1') is null then
    raise exception 'DATA-TAXONOMY8: exact-equivalence authority view is unavailable';
  end if;

  select count(*)
    into v_invalid_product_count
  from (
    select p.id
    from public.products p
    left join public.catalog_taxonomy_product_exact_equivalence_v1 e
      on e.product_id = p.id
    group by p.id
    having count(e.product_id) <> 1
       or coalesce(bool_and(e.exact_equivalent), false) is not true
  ) invalid_products;

  if v_invalid_product_count <> 0 then
    raise exception 'DATA-TAXONOMY8: % Product rows lack exactly one exact legacy projection baseline', v_invalid_product_count;
  end if;
end
$data_taxonomy8$;

alter table public.products
  alter column category drop not null;

comment on column public.products.category is
  'Legacy Recommendation category compatibility projection. NULL means no legacy Recommendation category projection; canonical classification is public.product_catalog_taxonomy_assignments. NULL does not grant Recommendation admission.';

commit;
