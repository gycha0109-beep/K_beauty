-- TEST / LOCAL REPLAY ONLY.
-- NOT A PRODUCTION MIGRATION.
--
-- Governed replay-equivalent predecessor contract for
-- product-fact-local-replay-baseline-v1. This file does not claim to be the
-- historical Production or Hosted DDL. It creates exactly the four public
-- relations that the tracked migration chain assumes already exist.

begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text,
  brand text,
  category text,
  price_min integer,
  price_max integer,
  buy_link text,
  image_url text,
  created_at timestamptz default now(),
  skin_types text,
  concerns text,
  texture text,
  finish text,
  irritation_risk text,
  sensitivity_safe boolean
);

create table public.product_candidates (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  category_path text,
  product_name_raw text not null,
  brand_name_raw text,
  normalized_name text,
  normalized_brand text,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_candidates_status_check
    check (status in ('new', 'matched', 'ignored'))
);

create table public.source_rankings (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  category_path text not null,
  rank_position integer not null,
  product_name text not null,
  brand_name text,
  rating numeric(3, 2),
  review_count integer,
  thumbnail_url text,
  source_url text,
  collected_at timestamptz not null default now()
);

create table public.recommendation_logs (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  "timestamp" timestamptz not null default now(),
  product_id text,
  is_top_pick boolean not null default false,
  question_id text,
  answer text,
  session_id text,
  feature_name text,
  result_type text,
  meta_json jsonb default '{}'::jsonb,
  user_id uuid references auth.users(id) on delete set null
);

alter table public.products enable row level security;
alter table public.product_candidates enable row level security;
alter table public.source_rankings enable row level security;
alter table public.recommendation_logs enable row level security;

revoke all on table public.products from public, anon, authenticated;
revoke all on table public.product_candidates from public, anon, authenticated;
revoke all on table public.source_rankings from public, anon, authenticated;
revoke all on table public.recommendation_logs from public, anon, authenticated;

grant all on table public.products to service_role;
grant all on table public.product_candidates to service_role;
grant all on table public.source_rankings to service_role;
grant all on table public.recommendation_logs to service_role;

commit;
