create or replace function public.map_product_category(input text)
returns public.product_category
language sql
immutable
as $$
  select case public.normalize_basic_text(input)
    when 'cleanser' then 'cleanser'::public.product_category
    when 'cleansing' then 'cleanser'::public.product_category
    when 'toner' then 'toner_essence'::public.product_category
    when 'toner_essence' then 'toner_essence'::public.product_category
    when 'toner_pad' then 'toner_pad'::public.product_category
    when 'serum' then 'serum'::public.product_category
    when 'ampoule' then 'ampoule'::public.product_category
    when 'essence' then 'essence'::public.product_category
    when 'serum_ampoule' then 'serum'::public.product_category
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

update public.products
set category = 'moisturizer_lotion_emulsion'::public.product_category
where category = 'moisturizer'::public.product_category
  and id in (
    '2ab9955d-9e7f-41fc-9751-9e313d50e492',
    '65a4c320-4815-4488-b031-b0a06b4702ca',
    '2d52e270-0429-4c5f-89dd-5c608b92fe8c',
    '37f18d02-adfd-4c72-b267-8e8facb1c5d1',
    'ef252acf-cfe2-4b2b-a223-80064be88e52'
  );

update public.products
set category = 'moisturizer_cream'::public.product_category
where category = 'moisturizer'::public.product_category
  and id in (
    '4cbd41f3-1357-42c6-a6c7-6df0e90d54a7',
    '03f5a72b-6c9a-4487-a3a9-39d1e6afa7bb',
    '4aa41038-de5b-4125-97b0-a50e7575cc00',
    'd2141a9d-3975-4d93-83f7-a4814c9c6a57'
  );
