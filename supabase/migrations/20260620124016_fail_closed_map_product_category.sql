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
    else null::public.product_category
  end;
$$;

-- Read-only verification checks after applying this migration:
--
-- select
--   input,
--   public.map_product_category(input)::text as mapped_category
-- from (values
--   ('serum'),
--   ('ampoule'),
--   ('essence'),
--   ('treatment'),
--   ('toner_essence'),
--   ('toner_pad'),
--   ('moisturizer'),
--   ('moisturizer_lotion_emulsion'),
--   ('moisturizer_gel'),
--   ('moisturizer_cream'),
--   ('moisturizer_balm'),
--   ('unknown'),
--   ('special'),
--   (null)
-- ) as samples(input);
--
-- select
--   pg_get_functiondef('public.map_product_category(text)'::regprocedure)
--     not like '%else ''toner_essence''%' as removed_toner_fallback,
--   public.map_product_category('unknown') is null as unknown_returns_null,
--   public.map_product_category('special') is null as special_returns_null,
--   public.map_product_category(null) is null as null_returns_null;
