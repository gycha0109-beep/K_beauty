-- TRUST Phase 8I-4A grouped relocation DB blueprint v1
-- BLUEPRINT ONLY. This file is not a deployable migration and must not be applied to Production.
-- A deployable migration must be generated through the repository's normal Supabase migration workflow.

-- Existing invariant intentionally preserved:
-- public.trust_official_source_relocations(old_binding_id) UNIQUE

create table public.trust_official_source_relocation_groups (
  group_id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.trust_official_source_transport_drift_cases(case_id) on delete restrict,
  evaluation_id uuid not null references public.trust_official_source_transport_drift_evaluations(evaluation_id) on delete restrict,
  qualified_historical_source_id uuid not null references public.product_evidence_sources(source_id) on delete restrict,
  relocation_id uuid not null references public.trust_official_source_relocations(relocation_id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  subject_id uuid not null references public.product_fact_subjects(subject_id) on delete restrict,
  old_binding_id uuid not null references public.product_source_bindings(binding_id) on delete restrict,
  replacement_binding_id uuid not null references public.product_source_bindings(binding_id) on delete restrict,
  qualification_digest text not null,
  group_prestate_digest text not null,
  group_plan_digest text not null,
  authority text not null,
  result text not null,
  created_at timestamptz not null default now(),
  constraint trust_official_source_relocation_groups_case_key unique (case_id),
  constraint trust_official_source_relocation_groups_evaluation_key unique (evaluation_id),
  constraint trust_official_source_relocation_groups_relocation_key unique (relocation_id),
  constraint trust_official_source_relocation_groups_plan_key unique (group_plan_digest),
  constraint trust_official_source_relocation_groups_qualification_digest_check
    check (qualification_digest ~ '^[0-9a-f]{64}$'),
  constraint trust_official_source_relocation_groups_prestate_digest_check
    check (group_prestate_digest ~ '^[0-9a-f]{64}$'),
  constraint trust_official_source_relocation_groups_plan_digest_check
    check (group_plan_digest ~ '^[0-9a-f]{64}$'),
  constraint trust_official_source_relocation_groups_authority_check
    check (authority = 'EXPLICIT_ADMIN_GROUPED_RELOCATION_CONFIRMATION'),
  constraint trust_official_source_relocation_groups_result_check
    check (result = 'confirmed')
);

create table public.trust_official_source_relocation_group_sources (
  group_id uuid not null references public.trust_official_source_relocation_groups(group_id) on delete restrict,
  source_id uuid not null references public.product_evidence_sources(source_id) on delete restrict,
  source_subject_binding_id uuid not null references public.product_evidence_source_subject_bindings(binding_id) on delete restrict,
  canonical_locator text not null,
  created_at timestamptz not null default now(),
  primary key (group_id, source_id),
  constraint trust_official_source_relocation_group_sources_locator_check
    check (canonical_locator ~ '^https://[^[:space:]#]+$')
);

create table public.trust_official_source_relocation_group_incidents (
  group_id uuid not null references public.trust_official_source_relocation_groups(group_id) on delete restrict,
  incident_id uuid not null references public.trust_official_source_transport_incidents(incident_id) on delete restrict,
  source_id uuid not null references public.product_evidence_sources(source_id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (group_id, incident_id)
);

-- Required indexes for lineage traversal.
create index trust_official_source_relocation_group_sources_source_idx
  on public.trust_official_source_relocation_group_sources(source_id, group_id);

create index trust_official_source_relocation_group_incidents_source_idx
  on public.trust_official_source_relocation_group_incidents(source_id, group_id);

-- All three tables are append-only.
-- A deployable migration must attach BEFORE UPDATE OR DELETE rejection triggers.

alter table public.trust_official_source_relocation_groups enable row level security;
alter table public.trust_official_source_relocation_group_sources enable row level security;
alter table public.trust_official_source_relocation_group_incidents enable row level security;

revoke all on table public.trust_official_source_relocation_groups
  from public, anon, authenticated, service_role;
revoke all on table public.trust_official_source_relocation_group_sources
  from public, anon, authenticated, service_role;
revoke all on table public.trust_official_source_relocation_group_incidents
  from public, anon, authenticated, service_role;

grant select on table public.trust_official_source_relocation_groups to service_role;
grant select on table public.trust_official_source_relocation_group_sources to service_role;
grant select on table public.trust_official_source_relocation_group_incidents to service_role;

-- Future read-only Admin preflight:
--
-- public.admin_preflight_trust_official_source_grouped_relocation_v1(
--   p_actor_user_id uuid,
--   p_case_id uuid,
--   p_evaluation_id uuid
-- ) returns jsonb
--
-- Required reconstruction:
--   1. require admin.products.review
--   2. read case and latest evaluation
--   3. require result_kind=READY_FOR_8I4 and require p_evaluation_id to be the latest evaluation for the case
--   4. read qualified_historical_source_id and qualified_exact from the immutable evaluation result_payload
--   5. require qualified_exact disposition/authority/mutation-policy/product/subject/candidate/digest/locator to match the evaluation and case
--   6. require that anchor to match the exact qualification that produced qualification_digest
--   7. reconstruct historical source set from case<->incident lineage
--   8. require at least two distinct source IDs
--   9. require every source exact Product/Subject binding
--  10. derive exactly one resolved reviewed old binding/review shared by the source set
--  11. require old binding source_url == every historical source canonical_locator
--  12. re-read governed Subject
--  13. derive candidate replacement from the READY_FOR_8I4 evaluation
--  14. compute canonical grouped prestate/plan digests
--  15. return READY_FOR_ADMIN_GROUPED_RELOCATION_CONFIRMATION or HOLD
--
-- The preflight performs no INSERT, UPDATE, DELETE, relocation confirmation,
-- Product Fact mutation, Current mutation, Confirmation mutation, Evidence Source
-- mutation, recommendation mutation, or semantic SAME/CHANGED resolution.

-- Future explicit Admin confirmation:
--
-- public.admin_confirm_trust_official_source_grouped_relocation_v1(...)
--
-- Must execute one transaction:
--   advisory lock
--   -> exact grouped prestate revalidation
--   -> require qualified_historical_source_id as the singular Phase 8H relocation anchor
--   -> require nested trust-phase8h-governed-relocation-confirmation-request-v1
--      to match case/evaluation/anchor/old-binding/replacement/qualification identity
--   -> call existing public.admin_confirm_trust_official_source_relocation_v1(...)
--      inside the same transaction
--   -> use returned relocation_id/replacement_binding_id/replacement_review_id
--   -> append one group header
--   -> append complete source membership
--   -> append complete incident membership
--   -> append grouped admin audit
--
-- Do not duplicate the Phase 8H replacement-binding/review creation or old-binding
-- retirement algorithm in Phase 8I-4. The existing Phase 8H RPC remains the sole
-- binding-mutation primitive.
--
-- Any failure after the nested Phase 8H call rolls back the whole transaction,
-- including the nested relocation and old-binding retirement.
