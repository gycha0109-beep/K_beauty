create extension if not exists pgcrypto;

create table if not exists public.premium_report_sessions (
  id uuid primary key default gen_random_uuid(),
  session_id text not null unique,
  premium_report jsonb not null,
  locale text not null default 'ko',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.premium_report_sessions enable row level security;

create index if not exists premium_report_sessions_expires_at_idx
  on public.premium_report_sessions (expires_at);

create index if not exists premium_report_sessions_session_id_idx
  on public.premium_report_sessions (session_id);
;
