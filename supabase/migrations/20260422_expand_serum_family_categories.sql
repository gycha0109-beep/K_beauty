begin;

do $$
begin
  if exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'product_category'
  ) then
    alter type public.product_category add value if not exists 'serum_ampoule';
    alter type public.product_category add value if not exists 'serum';
    alter type public.product_category add value if not exists 'ampoule';
    alter type public.product_category add value if not exists 'essence';
  end if;
end
$$;

create or replace function public.map_product_category(value text)
returns public.product_category
language sql
immutable
as $$
  select case public.normalize_basic_text(value)
    when 'cleanser' then 'cleanser'::public.product_category
    when 'cleansing' then 'cleanser'::public.product_category
    when 'toner' then 'toner_essence'::public.product_category
    when 'toner_essence' then 'toner_essence'::public.product_category
    when 'serum' then 'serum'::public.product_category
    when 'ampoule' then 'ampoule'::public.product_category
    when 'essence' then 'essence'::public.product_category
    when 'serum_ampoule' then 'serum_ampoule'::public.product_category
    when 'cream' then 'moisturizer'::public.product_category
    when 'moisturizer' then 'moisturizer'::public.product_category
    when 'lotion' then 'moisturizer'::public.product_category
    when 'sunscreen' then 'sunscreen'::public.product_category
    when 'sun' then 'sunscreen'::public.product_category
    else 'toner_essence'::public.product_category
  end;
$$;

commit;
