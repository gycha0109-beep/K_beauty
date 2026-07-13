-- SEC-05 isolated local verification only.
-- This is not a production historical baseline and must never be applied remotely.
-- It contains only the pre-SEC-05 recommendation_logs contract directly altered
-- by the production SEC-05 migration. No production row data is included.

begin;

create extension if not exists pgcrypto;

create table public.recommendation_logs (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  timestamp timestamptz not null default now(),
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

alter table public.recommendation_logs enable row level security;
revoke all on table public.recommendation_logs from public, anon, authenticated;
grant select, insert, update, delete on table public.recommendation_logs to service_role;

commit;
