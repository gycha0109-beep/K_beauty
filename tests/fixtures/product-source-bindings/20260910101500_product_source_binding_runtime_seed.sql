create table public.products (
  id uuid primary key,
  brand text,
  name text,
  external_source text,
  external_type text,
  external_id text,
  source_url text
);

grant select on public.products to service_role;

insert into public.products(id, brand, name, external_source, external_type, external_id, source_url)
values
  (
    '92000000-0000-4000-8000-000000000001',
    'ROUND LAB',
    'Birch Juice Moisturizing Sun Cream',
    'hwahae',
    'products',
    '1001',
    'https://www.hwahae.co.kr/products/1001'
  ),
  (
    '92000000-0000-4000-8000-000000000002',
    'Beauty of Joseon',
    'Relief Sun',
    null,
    null,
    null,
    null
  ),
  (
    '92000000-0000-4000-8000-000000000003',
    'RUUVE',
    'Ceramide Lotion',
    'ruuve_official',
    'official_product',
    '4140',
    'https://example.com/ruuve/4140'
  );
