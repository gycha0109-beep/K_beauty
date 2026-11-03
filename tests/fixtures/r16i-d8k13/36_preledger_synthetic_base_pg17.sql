-- D8K13 deliberately SYNTHETIC / isolated PG17 only.
-- NOT a recovered original migration, schema dump, production ACL, or approved replay starting state.
-- Exact fixture role/database and localhost are enforced by the node test runner.
begin;
create table public.products (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 brand text not null,
 category text not null,
 texture text not null,
 finish text not null,
 skin_types text not null,
 concerns text not null,
 irritation_risk text not null,
 sensitivity_safe boolean not null,
 buy_link text,
 image_url text,
 price_min numeric,
 price_max numeric,
 created_at timestamptz not null default now()
);
create table public.product_candidates (
 id uuid primary key default gen_random_uuid(),
 source_name text not null,
 category_path text,
 product_name_raw text,
 brand_name_raw text,
 normalized_name text,
 normalized_brand text,
 status text not null default 'new',
 created_at timestamptz not null default now()
);
create table public.source_rankings (
 id uuid primary key default gen_random_uuid(),
 source_name text not null,
 category_path text,
 product_name text not null,
 brand_name text not null,
 collected_at timestamptz not null default now(),
 rank_position integer not null
);
insert into public.products(name,brand,category,texture,finish,skin_types,concerns,irritation_risk,sensitivity_safe)
values('Synthetic Fixture Sunscreen','Fixture Brand','sunscreen','lotion','fresh','dry','dehydration','low',true);
insert into public.product_candidates(source_name,category_path,product_name_raw,brand_name_raw,normalized_name,normalized_brand,status)
values('d8k13_synthetic','sunscreen','Synthetic Fixture Sunscreen','Fixture Brand',
 'synthetic fixture sunscreen','fixture brand','new');
insert into public.source_rankings(source_name,category_path,product_name,brand_name,rank_position)
values('d8k13_synthetic','sunscreen','Synthetic Fixture Sunscreen','Fixture Brand',1);
commit;
