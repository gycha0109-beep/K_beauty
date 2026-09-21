-- TRUST Phase 7-D relational fact compatibility fixture extension.
-- Adds only the operational columns/relations needed to compile the current
-- Phase 7-C research/re-entry functions inside the isolated Phase 4 runtime.

alter table public.product_source_bindings
  add column if not exists external_type text;

alter table public.catalog_trust_intake
  add column if not exists trust_state text not null default 'RESEARCH_PENDING';

alter table public.product_fact_research_tasks
  add column if not exists priority integer not null default 0,
  add column if not exists research_policy_version text not null default 'trust-phase3-research-v1',
  add column if not exists attempt_count integer not null default 0,
  add column if not exists next_retry_at timestamptz,
  add column if not exists blocker_code text,
  add column if not exists blocker_detail text,
  add column if not exists last_research_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.trust_reentry_events (
  event_id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  event_type text not null,
  product_id uuid not null references public.products(id) on delete restrict,
  intake_id uuid references public.catalog_trust_intake(id) on delete restrict,
  research_task_id uuid references public.product_fact_research_tasks(id) on delete restrict,
  trigger_fingerprint text not null,
  actor_user_id uuid,
  request_id text,
  event_payload jsonb not null default '{}'::jsonb,
  disposition text not null default 'PENDING',
  disposition_detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.trust_reentry_events enable row level security;
revoke all on table public.trust_reentry_events
  from public, anon, authenticated, service_role;

create or replace function public.trust_phase7c_has_controlled_official_source_v1(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.product_fact_research_tasks rt
    join public.catalog_trust_intake i on i.id=rt.intake_id
    join public.product_source_bindings psb on psb.product_id=rt.product_id
    join public.trust_official_source_binding_reviews osr
      on osr.binding_id=psb.binding_id
     and osr.product_id=rt.product_id
     and osr.subject_id=rt.subject_id
    where rt.id=p_task_id
      and i.catalog_revision like 'legacy-backfill-v1:%'
      and psb.binding_state='resolved'
      and psb.binding_method='trust_official_source_review_v1'
      and psb.product_scope_state='product'
      and psb.source_name ~ '_official$'
      and psb.source_url ~ '^https://'
      and osr.review_version='trust-official-source-review-v1'
  );
$$;

revoke all on function public.trust_phase7c_has_controlled_official_source_v1(uuid)
  from public, anon, authenticated, service_role;
