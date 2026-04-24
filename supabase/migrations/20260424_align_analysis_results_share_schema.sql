begin;

create extension if not exists pgcrypto;

create table if not exists public.analysis_requests (
  id uuid primary key default gen_random_uuid(),
  session_id text,
  user_id uuid,
  feature_type text not null default 'skin',
  image_url text,
  survey_json jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  model_name text,
  model_version text,
  created_at timestamptz not null default now()
);

alter table public.analysis_requests
  add column if not exists session_id text;

alter table public.analysis_requests
  add column if not exists user_id uuid;

alter table public.analysis_requests
  add column if not exists feature_type text;

alter table public.analysis_requests
  alter column feature_type set default 'skin';

alter table public.analysis_requests
  add column if not exists image_url text;

alter table public.analysis_requests
  add column if not exists survey_json jsonb not null default '{}'::jsonb;

alter table public.analysis_requests
  add column if not exists status text not null default 'pending';

alter table public.analysis_requests
  add column if not exists model_name text;

alter table public.analysis_requests
  add column if not exists model_version text;

alter table public.analysis_requests
  add column if not exists created_at timestamptz not null default now();

create table if not exists public.analysis_results (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.analysis_requests(id) on delete cascade,
  feature_type text not null default 'skin',
  headline_label text,
  summary text,
  result_json jsonb not null default '{}'::jsonb,
  confidence_score numeric,
  created_at timestamptz not null default now(),
  user_id uuid,
  image_url text,
  share_id text,
  locale text not null default 'ko',
  skin_type text,
  main_concerns text[] not null default '{}'::text[],
  routine_am text[] not null default '{}'::text[],
  routine_pm text[] not null default '{}'::text[],
  recommended_products jsonb not null default '[]'::jsonb,
  is_public boolean not null default false
);

alter table public.analysis_results
  add column if not exists request_id uuid;

alter table public.analysis_results
  add column if not exists feature_type text;

alter table public.analysis_results
  alter column feature_type set default 'skin';

alter table public.analysis_results
  add column if not exists headline_label text;

alter table public.analysis_results
  add column if not exists summary text;

alter table public.analysis_results
  add column if not exists result_json jsonb not null default '{}'::jsonb;

alter table public.analysis_results
  add column if not exists confidence_score numeric;

alter table public.analysis_results
  add column if not exists created_at timestamptz not null default now();

alter table public.analysis_results
  add column if not exists user_id uuid;

alter table public.analysis_results
  add column if not exists image_url text;

alter table public.analysis_results
  add column if not exists share_id text;

alter table public.analysis_results
  add column if not exists locale text not null default 'ko';

alter table public.analysis_results
  add column if not exists skin_type text;

alter table public.analysis_results
  add column if not exists main_concerns text[] not null default '{}'::text[];

alter table public.analysis_results
  add column if not exists routine_am text[] not null default '{}'::text[];

alter table public.analysis_results
  add column if not exists routine_pm text[] not null default '{}'::text[];

alter table public.analysis_results
  add column if not exists recommended_products jsonb not null default '[]'::jsonb;

alter table public.analysis_results
  add column if not exists is_public boolean not null default false;

update public.analysis_results
set feature_type = 'skin'
where feature_type is null;

alter table public.analysis_results
  alter column feature_type set not null;

create unique index if not exists analysis_results_share_id_key
  on public.analysis_results (share_id)
  where share_id is not null;

create index if not exists analysis_results_public_share_idx
  on public.analysis_results (is_public, share_id);

comment on column public.analysis_results.request_id is
  'Stable request identifier for a single saved analysis result.';

comment on column public.analysis_requests.user_id is
  'Optional Supabase auth user id associated with the saved analysis request.';

comment on column public.analysis_results.feature_type is
  'Feature identifier for analytics and future multi-feature result storage.';

comment on column public.analysis_results.result_json is
  'Full saved payload for audit, replay, and future backfills.';

comment on column public.analysis_results.recommended_products is
  'Stored top-pick and supporting product payload for shared result rendering.';

comment on column public.analysis_results.image_url is
  'Optional stored image URL for shared analysis results.';

commit;
