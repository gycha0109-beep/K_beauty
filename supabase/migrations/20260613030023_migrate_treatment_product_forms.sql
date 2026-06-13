update public.products
set product_form = coalesce(product_form, category::text::public.product_form),
    category = 'treatment'::public.product_category,
    updated_at = now()
where category in (
  'serum'::public.product_category,
  'ampoule'::public.product_category,
  'essence'::public.product_category
);

create or replace function public.map_product_category(input text)
returns public.product_category
language sql
immutable
set search_path to 'pg_catalog', 'public'
as $$
  select case public.normalize_basic_text(input)
    when 'cleanser' then 'cleanser'::public.product_category
    when 'cleansing' then 'cleanser'::public.product_category
    when 'toner' then 'toner_essence'::public.product_category
    when 'toner_essence' then 'toner_essence'::public.product_category
    when 'toner_pad' then 'toner_pad'::public.product_category
    when 'serum' then 'treatment'::public.product_category
    when 'ampoule' then 'treatment'::public.product_category
    when 'essence' then 'treatment'::public.product_category
    when 'booster' then 'treatment'::public.product_category
    when 'peeling_solution' then 'treatment'::public.product_category
    when 'serum_ampoule' then 'treatment'::public.product_category
    when 'treatment' then 'treatment'::public.product_category
    when 'cream' then 'moisturizer_cream'::public.product_category
    when 'moisturizer' then 'moisturizer_cream'::public.product_category
    when 'lotion' then 'moisturizer_lotion_emulsion'::public.product_category
    when 'emulsion' then 'moisturizer_lotion_emulsion'::public.product_category
    when 'milk' then 'moisturizer_lotion_emulsion'::public.product_category
    when 'fluid' then 'moisturizer_lotion_emulsion'::public.product_category
    when 'gel' then 'moisturizer_gel'::public.product_category
    when 'balm' then 'moisturizer_balm'::public.product_category
    when 'moisturizer_lotion_emulsion' then 'moisturizer_lotion_emulsion'::public.product_category
    when 'moisturizer_gel' then 'moisturizer_gel'::public.product_category
    when 'moisturizer_cream' then 'moisturizer_cream'::public.product_category
    when 'moisturizer_balm' then 'moisturizer_balm'::public.product_category
    when 'sunscreen' then 'sunscreen'::public.product_category
    when 'sun' then 'sunscreen'::public.product_category
    else 'toner_essence'::public.product_category
  end;
$$;

-- Verification queries to run after applying this migration:
--
-- select category::text, count(*) as product_count
-- from public.products
-- group by category
-- order by category::text;
--
-- select coalesce(product_form::text, 'NULL') as product_form, count(*) as product_count
-- from public.products
-- group by product_form
-- order by product_form;
--
-- select id, brand, name, category::text as category, product_form::text as product_form
-- from public.products
-- where category = 'treatment'::public.product_category
-- order by product_form::text nulls last, brand, name;
--
-- select count(*) as treatment_products_with_null_product_form
-- from public.products
-- where category = 'treatment'::public.product_category
--   and product_form is null;
--
-- select
--   count(*) as migrated_serum_ampoule_essence_count,
--   bool_and(category = 'treatment'::public.product_category) as all_are_treatment,
--   bool_and(product_form in (
--     'serum'::public.product_form,
--     'ampoule'::public.product_form,
--     'essence'::public.product_form
--   )) as all_preserved_product_form
-- from public.products
-- where category = 'treatment'::public.product_category
--   and product_form in (
--     'serum'::public.product_form,
--     'ampoule'::public.product_form,
--     'essence'::public.product_form
--   );
--
-- select category::text, count(*) as remaining_old_category_count
-- from public.products
-- where category in (
--   'serum'::public.product_category,
--   'ampoule'::public.product_category,
--   'essence'::public.product_category
-- )
-- group by category;
--
-- Rollback note:
-- If this migration must be rolled back before removing enum values, restore the
-- old category from product_form first, then restore the previous
-- map_product_category() definition with:
--   language sql
--   immutable
--   set search_path to 'pg_catalog', 'public'
-- so the remote function keeps its existing search_path behavior.
--
-- update public.products
-- set category = product_form::text::public.product_category,
--     product_form = null,
--     updated_at = now()
-- where category = 'treatment'::public.product_category
--   and product_form in (
--     'serum'::public.product_form,
--     'ampoule'::public.product_form,
--     'essence'::public.product_form
--   );
