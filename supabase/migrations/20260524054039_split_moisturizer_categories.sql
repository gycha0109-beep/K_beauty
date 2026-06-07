do $$
begin
  if exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'product_category'
  ) then
    alter type public.product_category add value if not exists 'moisturizer_lotion_emulsion';
    alter type public.product_category add value if not exists 'moisturizer_gel';
    alter type public.product_category add value if not exists 'moisturizer_cream';
    alter type public.product_category add value if not exists 'moisturizer_balm';
  end if;
end
$$;
