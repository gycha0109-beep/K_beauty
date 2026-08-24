alter table public.products
  add column if not exists name_en text,
  add column if not exists brand_en text;

comment on column public.products.name_en is
  'English display name. Nullable; canonical product identity remains products.name.';

comment on column public.products.brand_en is
  'English display brand. Nullable; canonical brand identity remains products.brand.';
