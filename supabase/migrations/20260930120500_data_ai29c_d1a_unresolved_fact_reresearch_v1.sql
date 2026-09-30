begin;

alter table public.product_fact_research_tasks
  drop constraint if exists product_fact_research_tasks_policy_version_check;

alter table public.product_fact_research_tasks
  add constraint product_fact_research_tasks_policy_version_check
  check (research_policy_version in (
    'product-fact-required-policy-v1',
    'product-fact-required-reresearch-v1',
    'data-ai29c-protection-recovery-v1'
  ));

create table if not exists public.product_fact_unresolved_reresearch_requests (
  request_id text primary key,
  prior_task_id uuid not null references public.product_fact_research_tasks(id) on delete restrict,
  new_task_id uuid not null unique references public.product_fact_research_tasks(id) on delete restrict,
  source_id uuid not null references public.product_evidence_sources(source_id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  payload_digest text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  constraint product_fact_unresolved_reresearch_request_check
    check (char_length(btrim(request_id)) between 8 and 120),
  constraint product_fact_unresolved_reresearch_digest_check
    check (payload_digest ~ '^[0-9a-f]{64}$'),
  constraint product_fact_unresolved_reresearch_result_check
    check (jsonb_typeof(result) = 'object')
);

alter table public.product_fact_unresolved_reresearch_requests enable row level security;
revoke all on table public.product_fact_unresolved_reresearch_requests
  from public, anon, authenticated, service_role;
grant select on table public.product_fact_unresolved_reresearch_requests
  to service_role;

create or replace function public.admin_enqueue_unresolved_product_fact_reresearch_v1(
  p_actor_user_id uuid,
  p_request_id text,
  p_prior_task_id uuid,
  p_source_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role text;
  v_request_id text := btrim(coalesce(p_request_id, ''));
  v_prior public.product_fact_research_tasks%rowtype;
  v_intake public.catalog_trust_intake%rowtype;
  v_subject public.product_fact_subjects%rowtype;
  v_source public.product_evidence_sources%rowtype;
  v_source_binding public.product_evidence_source_subject_bindings%rowtype;
  v_operational_binding public.product_source_bindings%rowtype;
  v_existing public.product_fact_unresolved_reresearch_requests%rowtype;
  v_new_task public.product_fact_research_tasks%rowtype;
  v_payload jsonb;
  v_payload_digest text;
  v_audit_id uuid;
  v_result jsonb;
begin
  v_actor_role := public.admin_require_product_review_actor(
    p_actor_user_id,
    'admin.products.review'
  );

  if char_length(v_request_id) not between 8 and 120
     or p_prior_task_id is null
     or p_source_id is null then
    raise exception 'unresolved_product_fact_reresearch_request_invalid'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'bejewely_unresolved_product_fact_reresearch:' || p_prior_task_id::text,
      0
    )
  );

  select *
    into v_prior
  from public.product_fact_research_tasks t
  where t.id = p_prior_task_id
  for update;

  if not found then
    raise exception 'unresolved_product_fact_reresearch_prior_task_not_found'
      using errcode = 'P0002';
  end if;

  if v_prior.state <> 'BLOCKED'
     or v_prior.blocker_code not in ('EVIDENCE_INSUFFICIENT','SOURCE_BLOCKED')
     or v_prior.subject_id is null
     or v_prior.evidence_candidate_id is not null
     or v_prior.evidence_id is not null then
    raise exception 'unresolved_product_fact_reresearch_prior_task_ineligible'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.product_fact_current c
    join public.product_fact_instances fi
      on fi.fact_instance_id = c.fact_instance_id
    where c.subject_id = v_prior.subject_id
      and fi.registry_version = v_prior.registry_version
      and fi.fact_key = v_prior.fact_key
      and fi.semantic_status = 'supported'
      and (fi.valid_to is null or fi.valid_to > current_date)
  ) then
    raise exception 'unresolved_product_fact_reresearch_current_fact_exists'
      using errcode = '23514';
  end if;

  select *
    into v_intake
  from public.catalog_trust_intake i
  where i.id = v_prior.intake_id
    and i.product_id = v_prior.product_id
    and i.subject_id = v_prior.subject_id
    and i.identity_state = 'EXACT_SUBJECT_FOUND'
  for update;

  if not found then
    raise exception 'unresolved_product_fact_reresearch_intake_stale'
      using errcode = '40001';
  end if;

  select *
    into v_subject
  from public.product_fact_subjects s
  where s.subject_id = v_prior.subject_id
    and s.product_id = v_prior.product_id
    and s.identity_status = 'resolved'
    and s.current_state = 'current'
    and s.variant_key is null
    and (s.valid_to is null or s.valid_to > current_date);

  if not found then
    raise exception 'unresolved_product_fact_reresearch_subject_stale'
      using errcode = '40001';
  end if;

  select *
    into v_source
  from public.product_evidence_sources es
  where es.source_id = p_source_id
    and es.canonical_locator ~ '^https://'
    and es.source_kind in (
      'official_product_page',
      'official_market_sales_page',
      'official_brand_owner_product_page'
    )
    and es.market is not distinct from v_intake.market;

  if not found then
    raise exception 'unresolved_product_fact_reresearch_official_source_required'
      using errcode = '23514';
  end if;

  if coalesce(v_source.source_metadata ->> 'reresearch_reason_code','')
       <> 'NEW_PRIMARY_EVIDENCE_AVAILABLE'
     or nullif(btrim(coalesce(v_source.source_metadata ->> 'direct_claim','')), '') is null
     or coalesce(v_source.source_metadata ->> 'direct_claim_fact_key','')
       <> v_prior.fact_key
     or v_source.created_at <= v_prior.updated_at then
    raise exception 'unresolved_product_fact_reresearch_material_new_evidence_required'
      using errcode = '23514';
  end if;

  select *
    into v_source_binding
  from public.product_evidence_source_subject_bindings b
  where b.source_id = p_source_id
    and b.product_id = v_prior.product_id
    and b.subject_id = v_prior.subject_id
    and b.binding_state = 'exact_subject_match'
    and b.scope_relation = 'equivalent'
  order by b.reviewed_at desc nulls last, b.created_at desc
  limit 1;

  if not found then
    raise exception 'unresolved_product_fact_reresearch_exact_source_binding_required'
      using errcode = '23514';
  end if;

  select *
    into v_operational_binding
  from public.product_source_bindings psb
  where psb.product_id = v_prior.product_id
    and psb.binding_state = 'resolved'
    and psb.source_name ~ '_official$'
    and psb.source_url = v_source.canonical_locator
    and psb.source_url ~ '^https://'
    and psb.market_code is not distinct from v_intake.market
    and psb.product_scope_state = 'product'
  order by psb.updated_at desc, psb.binding_id
  limit 1;

  if not found then
    raise exception 'unresolved_product_fact_reresearch_operational_source_required'
      using errcode = '23514';
  end if;

  v_payload := jsonb_build_object(
    'prior_task_id', p_prior_task_id,
    'source_id', p_source_id,
    'product_id', v_prior.product_id,
    'subject_id', v_prior.subject_id,
    'fact_key', v_prior.fact_key,
    'registry_version', v_prior.registry_version,
    'research_policy_version', 'product-fact-required-reresearch-v1',
    'reason_code', 'NEW_PRIMARY_EVIDENCE_AVAILABLE'
  );
  v_payload_digest := public.product_fact_controlled_sha256_json_v1(v_payload);

  select *
    into v_existing
  from public.product_fact_unresolved_reresearch_requests r
  where r.request_id = v_request_id
     or r.prior_task_id = p_prior_task_id
  order by case when r.request_id = v_request_id then 0 else 1 end
  limit 1;

  if found then
    if v_existing.actor_user_id <> p_actor_user_id
       or v_existing.prior_task_id <> p_prior_task_id
       or v_existing.source_id <> p_source_id
       or v_existing.payload_digest <> v_payload_digest then
      raise exception 'unresolved_product_fact_reresearch_request_conflict'
        using errcode = '23505';
    end if;

    return v_existing.result || jsonb_build_object('idempotent', true);
  end if;

  if exists (
    select 1
    from public.product_fact_research_tasks t
    where t.subject_id = v_prior.subject_id
      and t.fact_key = v_prior.fact_key
      and t.registry_version = v_prior.registry_version
      and t.research_policy_version = 'product-fact-required-reresearch-v1'
  ) then
    raise exception 'unresolved_product_fact_reresearch_task_already_exists'
      using errcode = '23505';
  end if;

  insert into public.product_fact_research_tasks (
    intake_id,
    product_id,
    subject_id,
    fact_key,
    registry_version,
    research_policy_version,
    state,
    priority,
    source_locator,
    blocker_code,
    blocker_detail,
    attempt_count,
    next_retry_at,
    created_at,
    updated_at,
    completed_at
  )
  values (
    v_prior.intake_id,
    v_prior.product_id,
    v_prior.subject_id,
    v_prior.fact_key,
    v_prior.registry_version,
    'product-fact-required-reresearch-v1',
    'RESEARCH_PENDING',
    120,
    v_source.canonical_locator,
    'NEW_PRIMARY_EVIDENCE_AVAILABLE',
    'New governed exact official primary evidence became available after terminal unresolved research task ' || p_prior_task_id::text,
    0,
    now(),
    now(),
    now(),
    null
  )
  returning * into v_new_task;

  update public.catalog_trust_intake
     set trust_state = 'RESEARCH_PENDING',
         completed_at = null,
         last_checked_at = now(),
         updated_at = now()
   where id = v_prior.intake_id;

  v_audit_id := public.record_admin_audit_event(
    p_actor_user_id,
    'admin.products.review',
    'admin.product_fact.unresolved_reresearch_enqueued',
    'product_fact_research_task',
    v_new_task.id::text,
    null,
    jsonb_build_object(
      'state', 'RESEARCH_PENDING',
      'prior_task_id', p_prior_task_id,
      'source_id', p_source_id,
      'source_locator', v_source.canonical_locator,
      'reason_code', 'NEW_PRIMARY_EVIDENCE_AVAILABLE'
    ),
    'enqueue bounded Product Fact re-research after materially new governed official primary evidence',
    v_request_id,
    jsonb_build_object(
      'product_id', v_prior.product_id,
      'subject_id', v_prior.subject_id,
      'fact_key', v_prior.fact_key,
      'registry_version', v_prior.registry_version,
      'prior_research_policy_version', v_prior.research_policy_version,
      'research_policy_version', 'product-fact-required-reresearch-v1',
      'source_binding_id', v_source_binding.binding_id,
      'operational_binding_id', v_operational_binding.binding_id,
      'actor_role', v_actor_role,
      'product_fact_authority_mutated', false,
      'recommendation_authority_mutated', false,
      'automatic_confirmation', false
    )
  );

  v_result := jsonb_build_object(
    'status', 'research_requeued',
    'prior_task_id', p_prior_task_id,
    'research_task_id', v_new_task.id,
    'product_id', v_prior.product_id,
    'subject_id', v_prior.subject_id,
    'fact_key', v_prior.fact_key,
    'registry_version', v_prior.registry_version,
    'research_policy_version', v_new_task.research_policy_version,
    'source_id', p_source_id,
    'source_locator', v_source.canonical_locator,
    'reason_code', 'NEW_PRIMARY_EVIDENCE_AVAILABLE',
    'audit_id', v_audit_id,
    'product_fact_authority_mutated', false,
    'recommendation_authority_mutated', false,
    'automatic_confirmation', false,
    'idempotent', false
  );

  insert into public.product_fact_unresolved_reresearch_requests (
    request_id,
    prior_task_id,
    new_task_id,
    source_id,
    actor_user_id,
    payload_digest,
    result
  )
  values (
    v_request_id,
    p_prior_task_id,
    v_new_task.id,
    p_source_id,
    p_actor_user_id,
    v_payload_digest,
    v_result
  );

  return v_result;
end;
$$;

comment on table public.product_fact_unresolved_reresearch_requests is
  'D1A immutable request ledger for bounded re-research of terminal unresolved Product Facts after materially new governed official primary evidence.';
comment on function public.admin_enqueue_unresolved_product_fact_reresearch_v1(uuid,text,uuid,uuid) is
  'Admin-only D1A enqueue. Preserves the prior blocked task and creates one distinct re-research task only when a newer exact governed official source with a direct fact claim exists and no Current fact exists.';

revoke all on function public.admin_enqueue_unresolved_product_fact_reresearch_v1(uuid,text,uuid,uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_enqueue_unresolved_product_fact_reresearch_v1(uuid,text,uuid,uuid)
  to service_role;

commit;
