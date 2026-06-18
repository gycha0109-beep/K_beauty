do $$
begin
  if exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'product_category'
  ) then
    alter type public.product_category add value if not exists 'treatment';
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'product_form'
  ) then
    create type public.product_form as enum (
      'serum',
      'ampoule',
      'essence',
      'booster',
      'peeling_solution',
      'unknown'
    );
  else
    alter type public.product_form add value if not exists 'serum';
    alter type public.product_form add value if not exists 'ampoule';
    alter type public.product_form add value if not exists 'essence';
    alter type public.product_form add value if not exists 'booster';
    alter type public.product_form add value if not exists 'peeling_solution';
    alter type public.product_form add value if not exists 'unknown';
  end if;
end
$$;

alter table public.products
  add column if not exists product_form public.product_form;

comment on column public.products.product_form is
  'Treatment sub-form such as serum, ampoule, essence, booster, peeling_solution, or unknown.';
