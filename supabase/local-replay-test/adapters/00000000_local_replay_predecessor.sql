-- LOCAL-ONLY REPLAY ADAPTER.
--
-- This file is not a production migration and must never be copied into
-- supabase/migrations. It supplies only the predecessor objects that the
-- tracked migration chain assumes already exist before
-- 20260410_safe_review_and_promotion_layer.sql.
--
-- It is a replay-equivalent contract, not a claim that this is the exact
-- historical DDL that created the hosted database.

begin;

create extension if not exists pgcrypto;

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

create index recommendation_logs_event_name_idx
  on public.recommendation_logs (event_name);

create index recommendation_logs_product_id_idx
  on public.recommendation_logs (product_id);

create index recommendation_logs_timestamp_idx
  on public.recommendation_logs ("timestamp" desc);

create index recommendation_logs_user_id_timestamp_idx
  on public.recommendation_logs (user_id, "timestamp" desc);

alter table public.recommendation_logs enable row level security;
revoke all on table public.recommendation_logs from anon, authenticated;
grant all on table public.recommendation_logs to service_role;

commit;
