create table public.products (
  id uuid primary key,
  brand text,
  name text,
  price_min numeric,
  price_max numeric,
  buy_link text,
  source_url text
);

grant select on public.products to service_role;

insert into public.products(id, brand, name, price_min, price_max, buy_link, source_url)
values
  (
    '93000000-0000-4000-8000-000000000001',
    'ROUND LAB',
    'Birch Juice Moisturizing Sun Cream',
    18000,
    22000,
    'https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000001',
    null
  ),
  (
    '93000000-0000-4000-8000-000000000002',
    'Beauty of Joseon',
    'Relief Sun',
    15000,
    19000,
    'https://www.hwahae.co.kr/goods/2002',
    'https://www.hwahae.co.kr/goods/2002'
  );
