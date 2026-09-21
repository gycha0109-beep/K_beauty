alter table public.catalog_trust_intake
  add column trust_state text not null default 'COMPLETED',
  add column completed_at timestamptz,
  add column last_checked_at timestamptz,
  add column updated_at timestamptz not null default now();

alter table public.product_fact_research_tasks
  add column research_policy_version text not null default 'product-fact-required-policy-v1',
  add column priority smallint not null default 100,
  add column evidence_id uuid,
  add column blocker_code text,
  add column blocker_detail text,
  add column attempt_count integer not null default 0,
  add column next_retry_at timestamptz,
  add column updated_at timestamptz not null default now(),
  add column completed_at timestamptz,
  add column last_research_at timestamptz;

create unique index trust_phase8d_fixture_observation_identity
  on public.trust_source_observations(
    research_task_id, canonical_locator, observation_version, source_content_digest
  );

create unique index trust_phase8d_fixture_candidate_digest
  on public.trust_evidence_candidates(canonical_evidence_digest);
