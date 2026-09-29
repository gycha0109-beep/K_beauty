begin;

-- DATA-AI29C-C bounded variant-scoped recovery bridge.
--
-- IMPORTANT:
-- * Do not replace or relax the shared TRUST Phase 3 claim/record functions.
-- * This bridge is scoped only to data-ai29c-protection-recovery-v1 /
--   water_resistance_duration operational research tasks.
-- * It never writes Product Fact authority or Recommendation authority.

create or replace function public.data_ai29c_recovery_variant_source_authorized_v1(
  p_product_id uuid,
  p_subject_id uuid,
  p_canonical_locator text,
  p_market text
)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.product_evidence_source_subject_bindings b
    join public.product_evidence_sources es
      on es.source_id = b.source_id
    where b.product_id = p_product_id
      and b.subject_id = p_subject_id
      and b.binding_state = 'exact_subject_match'
      and b.scope_relation = 'equivalent'
      and es.canonical_locator = p_canonical_locator
      and (
        p_market is null
        or es.market is not distinct from p_market
      )
  );
$$;

comment on function public.data_ai29c_recovery_variant_source_authorized_v1(uuid, uuid, text, text) is
  'Internal DATA-AI29C-C source gate. Reuses only an existing governed exact-subject/equivalent Product Evidence source binding.';

revoke all on function public.data_ai29c_recovery_variant_source_authorized_v1(uuid, uuid, text, text)
  from public, anon, authenticated, service_role;


create or replace function public.claim_data_ai29c_protection_recovery_tasks_v1(
  p_limit integer default 25,
  p_lease_seconds integer default 1800
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if p_limit is null or p_limit < 1 or p_limit > 25 then
    raise exception 'data_ai29c_c_claim_limit_invalid';
  end if;
  if p_lease_seconds is null or p_lease_seconds < 30 or p_lease_seconds > 1800 then
    raise exception 'data_ai29c_c_claim_lease_invalid';
  end if;

  update public.product_fact_research_tasks
  set state = 'RESEARCH_PENDING',
      next_retry_at = now(),
      blocker_code = 'WORKER_LEASE_EXPIRED',
      blocker_detail = 'Previous DATA-AI29C-C recovery lease expired before a result was recorded.',
      updated_at = now()
  where research_policy_version = 'data-ai29c-protection-recovery-v1'
    and fact_key = 'water_resistance_duration'
    and state = 'RESEARCHING'
    and last_research_at is not null
    and last_research_at < now() - make_interval(secs => p_lease_seconds);

  with eligible as (
    select rt.id
    from public.product_fact_research_tasks rt
    join public.catalog_trust_intake i
      on i.id = rt.intake_id
    join public.product_fact_subjects s
      on s.subject_id = rt.subject_id
    where rt.research_policy_version = 'data-ai29c-protection-recovery-v1'
      and rt.fact_key = 'water_resistance_duration'
      and rt.state = 'RESEARCH_PENDING'
      and rt.subject_id is not null
      and (rt.next_retry_at is null or rt.next_retry_at <= now())
      and i.identity_state = 'EXACT_SUBJECT_FOUND'
      and i.subject_id = rt.subject_id
      and s.product_id = rt.product_id
      and s.identity_status = 'resolved'
      and s.current_state = 'current'
      and (s.valid_to is null or s.valid_to > current_date)
      and s.market_applicability is not distinct from i.market
      and exists (
        select 1
        from public.product_source_bindings psb
        where psb.product_id = rt.product_id
          and psb.binding_state = 'resolved'
          and psb.source_name ~ '_official$'
          and psb.source_url ~ '^https://'
          and psb.market_code is not distinct from i.market
          and public.data_ai29c_recovery_variant_source_authorized_v1(
            rt.product_id,
            rt.subject_id,
            psb.source_url,
            i.market
          )
      )
    order by rt.priority desc, rt.created_at, rt.id
    for update of rt skip locked
    limit p_limit
  ),
  claimed as (
    update public.product_fact_research_tasks rt
    set state = 'RESEARCHING',
        attempt_count = rt.attempt_count + 1,
        next_retry_at = null,
        blocker_code = null,
        blocker_detail = null,
        last_research_at = now(),
        updated_at = now()
    from eligible e
    where rt.id = e.id
    returning rt.*
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'task_id', c.id,
        'product_id', c.product_id,
        'subject_id', c.subject_id,
        'fact_key', c.fact_key,
        'registry_version', c.registry_version,
        'research_policy_version', c.research_policy_version,
        'attempt_count', c.attempt_count,
        'official_source_seeds', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'source_binding_id', psb.binding_id,
              'source_name', psb.source_name,
              'external_type', psb.external_type,
              'binding_method', psb.binding_method,
              'product_scope_state', psb.product_scope_state,
              'canonical_locator', psb.source_url,
              'market', psb.market_code,
              'locale', psb.locale
            )
            order by psb.created_at, psb.binding_id
          )
          from public.product_source_bindings psb
          join public.catalog_trust_intake i2
            on i2.id = c.intake_id
          where psb.product_id = c.product_id
            and psb.binding_state = 'resolved'
            and psb.source_name ~ '_official$'
            and psb.source_url ~ '^https://'
            and psb.market_code is not distinct from i2.market
            and public.data_ai29c_recovery_variant_source_authorized_v1(
              c.product_id,
              c.subject_id,
              psb.source_url,
              i2.market
            )
        ), '[]'::jsonb)
      )
      order by c.priority desc, c.created_at, c.id
    ),
    '[]'::jsonb
  )
  into v_result
  from claimed c;

  return v_result;
end;
$$;

comment on function public.claim_data_ai29c_protection_recovery_tasks_v1(integer, integer) is
  'DATA-AI29C-C service-role claim boundary. Claims only water-resistance recovery tasks backed by an existing governed exact-subject/equivalent official source URL.';


create or replace function public.record_data_ai29c_protection_recovery_no_evidence_v1(
  p_task_id uuid,
  p_outcome text,
  p_detail text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task public.product_fact_research_tasks%rowtype;
  v_intake public.catalog_trust_intake%rowtype;
  v_subject public.product_fact_subjects%rowtype;
  v_outcome text;
begin
  v_outcome := upper(coalesce(btrim(p_outcome), ''));

  if v_outcome not in ('EVIDENCE_INSUFFICIENT', 'SOURCE_BLOCKED') then
    raise exception 'data_ai29c_c_no_evidence_outcome_invalid:%', v_outcome;
  end if;

  select *
  into v_task
  from public.product_fact_research_tasks
  where id = p_task_id
  for update;

  if not found then
    raise exception 'data_ai29c_c_recovery_task_not_found';
  end if;

  if v_task.research_policy_version <> 'data-ai29c-protection-recovery-v1'
    or v_task.fact_key <> 'water_resistance_duration' then
    raise exception 'data_ai29c_c_recovery_task_scope_invalid';
  end if;

  if v_task.state <> 'RESEARCHING' then
    raise exception 'data_ai29c_c_recovery_task_not_claimed:%', v_task.state;
  end if;

  select *
  into v_intake
  from public.catalog_trust_intake
  where id = v_task.intake_id;

  select *
  into v_subject
  from public.product_fact_subjects
  where subject_id = v_task.subject_id;

  if v_task.subject_id is null
    or v_intake.identity_state <> 'EXACT_SUBJECT_FOUND'
    or v_intake.subject_id is distinct from v_task.subject_id
    or v_subject.identity_status <> 'resolved'
    or v_subject.current_state <> 'current'
    or v_subject.product_id <> v_task.product_id
    or v_subject.market_applicability is distinct from v_intake.market then
    raise exception 'data_ai29c_c_recovery_identity_changed';
  end if;

  if not exists (
    select 1
    from public.product_source_bindings psb
    where psb.product_id = v_task.product_id
      and psb.binding_state = 'resolved'
      and psb.source_name ~ '_official$'
      and psb.source_url ~ '^https://'
      and psb.market_code is not distinct from v_intake.market
      and public.data_ai29c_recovery_variant_source_authorized_v1(
        v_task.product_id,
        v_task.subject_id,
        psb.source_url,
        v_intake.market
      )
  ) then
    raise exception 'data_ai29c_c_recovery_governed_source_missing';
  end if;

  update public.product_fact_research_tasks
  set state = 'BLOCKED',
      blocker_code = v_outcome,
      blocker_detail = coalesce(
        nullif(btrim(p_detail), ''),
        case
          when v_outcome = 'EVIDENCE_INSUFFICIENT'
            then 'Reviewed governed official source; no explicit numeric water-resistance duration with time unit was established.'
          else 'No usable governed official source remained for this recovery task.'
        end
      ),
      next_retry_at = null,
      last_research_at = now(),
      updated_at = now()
  where id = p_task_id;

  return jsonb_build_object(
    'task_id', p_task_id,
    'outcome', v_outcome,
    'productFactAuthorityMutated', false,
    'recommendationAuthorityMutated', false,
    'productionCutoverAuthorized', false
  );
end;
$$;

comment on function public.record_data_ai29c_protection_recovery_no_evidence_v1(uuid, text, text) is
  'DATA-AI29C-C operational no-evidence recorder. It cannot create Evidence, Fact, Current, Confirmation, or Recommendation state.';


create or replace function public.reconcile_data_ai29c_protection_recovery_unclaimable_v1()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source_blocked integer := 0;
  v_binding_review integer := 0;
begin
  with candidates as (
    select
      rt.id,
      exists (
        select 1
        from public.product_source_bindings psb
        join public.catalog_trust_intake i2
          on i2.id = rt.intake_id
        where psb.product_id = rt.product_id
          and psb.binding_state = 'resolved'
          and psb.source_name ~ '_official$'
          and psb.source_url ~ '^https://'
          and psb.market_code is not distinct from i2.market
      ) as has_catalog_official_source,
      exists (
        select 1
        from public.product_source_bindings psb
        join public.catalog_trust_intake i2
          on i2.id = rt.intake_id
        where psb.product_id = rt.product_id
          and psb.binding_state = 'resolved'
          and psb.source_name ~ '_official$'
          and psb.source_url ~ '^https://'
          and psb.market_code is not distinct from i2.market
          and public.data_ai29c_recovery_variant_source_authorized_v1(
            rt.product_id,
            rt.subject_id,
            psb.source_url,
            i2.market
          )
      ) as has_governed_exact_source
    from public.product_fact_research_tasks rt
    join public.catalog_trust_intake i
      on i.id = rt.intake_id
    join public.product_fact_subjects s
      on s.subject_id = rt.subject_id
    where rt.research_policy_version = 'data-ai29c-protection-recovery-v1'
      and rt.fact_key = 'water_resistance_duration'
      and rt.state = 'RESEARCH_PENDING'
      and i.identity_state = 'EXACT_SUBJECT_FOUND'
      and i.subject_id = rt.subject_id
      and s.product_id = rt.product_id
      and s.identity_status = 'resolved'
      and s.current_state = 'current'
      and s.market_applicability is not distinct from i.market
  ),
  blocked as (
    update public.product_fact_research_tasks rt
    set state = 'BLOCKED',
        blocker_code = 'SOURCE_BLOCKED',
        blocker_detail = 'No resolved exact-market official HTTPS source binding is available for DATA-AI29C-C water-resistance duration research.',
        next_retry_at = null,
        last_research_at = now(),
        updated_at = now()
    from candidates c
    where rt.id = c.id
      and not c.has_catalog_official_source
    returning rt.id
  )
  select count(*)::integer
  into v_source_blocked
  from blocked;

  with candidates as (
    select
      rt.id,
      exists (
        select 1
        from public.product_source_bindings psb
        join public.catalog_trust_intake i2
          on i2.id = rt.intake_id
        where psb.product_id = rt.product_id
          and psb.binding_state = 'resolved'
          and psb.source_name ~ '_official$'
          and psb.source_url ~ '^https://'
          and psb.market_code is not distinct from i2.market
      ) as has_catalog_official_source,
      exists (
        select 1
        from public.product_source_bindings psb
        join public.catalog_trust_intake i2
          on i2.id = rt.intake_id
        where psb.product_id = rt.product_id
          and psb.binding_state = 'resolved'
          and psb.source_name ~ '_official$'
          and psb.source_url ~ '^https://'
          and psb.market_code is not distinct from i2.market
          and public.data_ai29c_recovery_variant_source_authorized_v1(
            rt.product_id,
            rt.subject_id,
            psb.source_url,
            i2.market
          )
      ) as has_governed_exact_source
    from public.product_fact_research_tasks rt
    join public.catalog_trust_intake i
      on i.id = rt.intake_id
    join public.product_fact_subjects s
      on s.subject_id = rt.subject_id
    where rt.research_policy_version = 'data-ai29c-protection-recovery-v1'
      and rt.fact_key = 'water_resistance_duration'
      and rt.state = 'RESEARCH_PENDING'
      and i.identity_state = 'EXACT_SUBJECT_FOUND'
      and i.subject_id = rt.subject_id
      and s.product_id = rt.product_id
      and s.identity_status = 'resolved'
      and s.current_state = 'current'
      and s.market_applicability is not distinct from i.market
  ),
  review_required as (
    update public.product_fact_research_tasks rt
    set state = 'REVIEW_REQUIRED',
        blocker_code = 'GOVERNED_SOURCE_BINDING_REQUIRED',
        blocker_detail = 'An official catalog source exists, but the same URL is not yet governed as exact_subject_match + equivalent for this Subject.',
        next_retry_at = null,
        last_research_at = now(),
        updated_at = now()
    from candidates c
    where rt.id = c.id
      and c.has_catalog_official_source
      and not c.has_governed_exact_source
    returning rt.id
  )
  select count(*)::integer
  into v_binding_review
  from review_required;

  return jsonb_build_object(
    'contractVersion', 'data-ai29c-c-protection-recovery-v1',
    'sourceBlockedCount', v_source_blocked,
    'governedSourceBindingReviewCount', v_binding_review,
    'productFactAuthorityMutated', false,
    'recommendationAuthorityMutated', false,
    'productionCutoverAuthorized', false
  );
end;
$$;

comment on function public.reconcile_data_ai29c_protection_recovery_unclaimable_v1() is
  'DATA-AI29C-C operational reconciliation for pending water-resistance tasks that cannot pass the governed source gate.';


revoke all on function public.claim_data_ai29c_protection_recovery_tasks_v1(integer, integer)
  from public, anon, authenticated;
revoke all on function public.record_data_ai29c_protection_recovery_no_evidence_v1(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.reconcile_data_ai29c_protection_recovery_unclaimable_v1()
  from public, anon, authenticated;

grant execute on function public.claim_data_ai29c_protection_recovery_tasks_v1(integer, integer)
  to service_role;
grant execute on function public.record_data_ai29c_protection_recovery_no_evidence_v1(uuid, text, text)
  to service_role;
grant execute on function public.reconcile_data_ai29c_protection_recovery_unclaimable_v1()
  to service_role;

commit;
