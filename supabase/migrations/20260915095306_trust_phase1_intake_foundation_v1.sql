begin;

-- TRUST Phase 1 / Product Fact Operations intake foundation.
-- Operational queue only: this migration does not mutate Product Fact authority,
-- confirmations, Current pointers, or Recommendation authority.

create table if not exists public.catalog_trust_intake (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  source_candidate_id uuid references public.product_candidates(id) on delete restrict,
  catalog_revision text not null,
  category text not null,
  market text,
  subject_id uuid references public.product_fact_subjects(subject_id) on delete restrict,
  identity_state text not null default 'PENDING',
  trust_state text not null default 'PENDING',
  required_fact_policy_version text not null default 'product-fact-required-policy-v1',
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  last_checked_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint catalog_trust_intake_product_revision_key unique (product_id, catalog_revision),
  constraint catalog_trust_intake_catalog_revision_check check (char_length(btrim(catalog_revision)) between 8 and 240),
  constraint catalog_trust_intake_category_check check (char_length(btrim(category)) between 2 and 80),
  constraint catalog_trust_intake_market_check check (market is null or char_length(btrim(market)) between 2 and 16),
  constraint catalog_trust_intake_identity_state_check check (identity_state in ('PENDING','EXACT_SUBJECT_FOUND','REVIEW_REQUIRED')),
  constraint catalog_trust_intake_trust_state_check check (trust_state in ('PENDING','IDENTITY_RESOLVING','RESEARCH_PENDING','RESEARCHING','PARTIAL','REVIEW_REQUIRED','COMPLETED','BLOCKED')),
  constraint catalog_trust_intake_policy_version_check check (required_fact_policy_version = 'product-fact-required-policy-v1')
);

comment on table public.catalog_trust_intake is
  'Operational TRUST intake queue. Not Product Fact semantic authority.';

create index if not exists catalog_trust_intake_state_created_idx
  on public.catalog_trust_intake(trust_state, created_at);
create index if not exists catalog_trust_intake_product_idx
  on public.catalog_trust_intake(product_id, created_at desc);

alter table public.catalog_trust_intake enable row level security;
revoke all on table public.catalog_trust_intake from public, anon, authenticated, service_role;

create table if not exists public.product_fact_research_tasks (
  id uuid primary key default gen_random_uuid(),
  intake_id uuid not null references public.catalog_trust_intake(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  subject_id uuid references public.product_fact_subjects(subject_id) on delete restrict,
  fact_key text not null,
  registry_version text not null,
  research_policy_version text not null,
  state text not null,
  priority smallint not null default 100,
  source_locator text,
  source_content_digest text,
  evidence_id uuid references public.product_evidence_records(evidence_id) on delete restrict,
  blocker_code text,
  blocker_detail text,
  attempt_count integer not null default 0,
  next_retry_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint product_fact_research_tasks_intake_fact_key unique (intake_id, fact_key, registry_version, research_policy_version),
  constraint product_fact_research_tasks_state_check check (state in ('PENDING','IDENTITY_PENDING','RESEARCH_PENDING','RESEARCHING','EVIDENCE_CANDIDATE','PREFLIGHT_READY','REVIEW_REQUIRED','CONFIRMED','ALREADY_COVERED','BLOCKED')),
  constraint product_fact_research_tasks_priority_check check (priority between 0 and 1000),
  constraint product_fact_research_tasks_attempt_count_check check (attempt_count >= 0),
  constraint product_fact_research_tasks_policy_version_check check (research_policy_version = 'product-fact-required-policy-v1')
);

comment on table public.product_fact_research_tasks is
  'Operational Product Fact research task queue. Does not grant Product Fact write authority.';

create unique index if not exists product_fact_research_tasks_subject_fact_key
  on public.product_fact_research_tasks(subject_id, fact_key, registry_version, research_policy_version)
  where subject_id is not null;
create index if not exists product_fact_research_tasks_state_retry_idx
  on public.product_fact_research_tasks(state, next_retry_at, priority, created_at);

alter table public.product_fact_research_tasks enable row level security;
revoke all on table public.product_fact_research_tasks from public, anon, authenticated, service_role;

-- Required Fact Policy is intentionally separate from the Registry. v1 is the
-- conservative intersection of current governed Registry domain support and
-- fact families already adopted as Current in Production by 2026-09-15.
create or replace function public.catalog_required_product_facts_v1(p_category text)
returns table(fact_key text, priority smallint)
language sql
stable
set search_path = public, pg_temp
as $$
  select policy.fact_key, policy.priority
  from (values
    ('cleanser', 'low_ph', 100::smallint),
    ('cleanser', 'deep_cleansing', 110::smallint),
    ('toner_essence', 'product_format', 100::smallint),
    ('toner_essence', 'contains_active', 120::smallint),
    ('toner_pad', 'product_format', 100::smallint),
    ('toner_pad', 'pad_surface_texture', 105::smallint),
    ('toner_pad', 'wipe_off_use', 110::smallint),
    ('toner_pad', 'contains_active', 120::smallint),
    ('treatment', 'contains_active', 100::smallint),
    ('treatment', 'active_concentration', 110::smallint),
    ('treatment', 'recommended_use_frequency', 120::smallint),
    ('moisturizer', 'primary_use_role', 100::smallint),
    ('moisturizer', 'barrier_support_claim', 110::smallint),
    ('moisturizer_lotion_emulsion', 'primary_use_role', 100::smallint),
    ('moisturizer_lotion_emulsion', 'barrier_support_claim', 110::smallint),
    ('moisturizer_gel', 'primary_use_role', 100::smallint),
    ('moisturizer_gel', 'barrier_support_claim', 110::smallint),
    ('moisturizer_cream', 'primary_use_role', 100::smallint),
    ('moisturizer_cream', 'barrier_support_claim', 110::smallint),
    ('moisturizer_balm', 'primary_use_role', 100::smallint),
    ('moisturizer_balm', 'barrier_support_claim', 110::smallint),
    ('sunscreen', 'spf_value', 100::smallint),
    ('sunscreen', 'uva_label', 105::smallint),
    ('sunscreen', 'uv_filter_type', 110::smallint)
  ) as policy(category, fact_key, priority)
  where policy.category = lower(btrim(coalesce(p_category, '')))
  order by policy.priority, policy.fact_key;
$$;

revoke all on function public.catalog_required_product_facts_v1(text)
  from public, anon, authenticated;
grant execute on function public.catalog_required_product_facts_v1(text)
  to service_role;

create or replace function public.enqueue_catalog_trust_intake_from_promotion_v1()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_market text;
  v_catalog_revision text;
begin
  if new.review_status = 'promoted'::public.product_review_status
    and old.review_status is distinct from 'promoted'::public.product_review_status
    and new.matched_product_id is not null
  then
    -- Current crawler promotion source is Hwahae KR. Unknown future sources stay
    -- unscoped rather than being silently promoted to KR Product Fact authority.
    v_market := case when lower(coalesce(new.source_name, '')) = 'hwahae' then 'KR' else null end;
    v_catalog_revision := 'candidate:' || new.id::text || ':' || coalesce(new.promotion_version, 'unknown');

    insert into public.catalog_trust_intake (
      product_id,
      source_candidate_id,
      catalog_revision,
      category,
      market,
      identity_state,
      trust_state,
      required_fact_policy_version,
      created_at,
      updated_at
    ) values (
      new.matched_product_id,
      new.id,
      v_catalog_revision,
      new.service_category::text,
      v_market,
      'PENDING',
      'PENDING',
      'product-fact-required-policy-v1',
      now(),
      now()
    )
    on conflict (product_id, catalog_revision) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function public.enqueue_catalog_trust_intake_from_promotion_v1()
  from public, anon, authenticated, service_role;

drop trigger if exists product_candidate_trust_intake_enqueue_v1 on public.product_candidates;
create trigger product_candidate_trust_intake_enqueue_v1
after update of review_status, matched_product_id, promotion_version on public.product_candidates
for each row
execute function public.enqueue_catalog_trust_intake_from_promotion_v1();

create or replace function public.process_catalog_trust_product_v1(p_product_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_registry_version text;
  v_intake public.catalog_trust_intake%rowtype;
  v_subject_id uuid;
  v_subject_count integer;
  v_policy record;
  v_task_state text;
  v_policy_count integer;
  v_intake_count integer := 0;
  v_tasks_created integer := 0;
  v_tasks_covered integer := 0;
begin
  if p_product_id is null or not exists(select 1 from public.products where id = p_product_id) then
    raise exception 'catalog_trust_product_not_found' using errcode = 'P0002';
  end if;

  select registry_version into v_registry_version
  from public.product_fact_registry_versions
  order by effective_at desc nulls last, created_at desc
  limit 1;

  if v_registry_version is null then
    raise exception 'catalog_trust_registry_unavailable' using errcode = '23514';
  end if;

  for v_intake in
    select *
    from public.catalog_trust_intake
    where product_id = p_product_id
    order by created_at, id
    for update
  loop
    v_intake_count := v_intake_count + 1;
    v_subject_id := null;
    v_subject_count := 0;

    -- Exact market only. NULL/global Subjects are deliberately not auto-applied
    -- to KR (or any other market), preserving the existing TRUST market boundary.
    if v_intake.market is not null then
      select count(*)::integer, min(subject_id)
        into v_subject_count, v_subject_id
      from public.product_fact_subjects
      where product_id = v_intake.product_id
        and identity_status = 'resolved'
        and current_state = 'current'
        and market_applicability = v_intake.market;
    end if;

    if v_subject_count = 1 then
      update public.catalog_trust_intake
      set subject_id = v_subject_id,
          identity_state = 'EXACT_SUBJECT_FOUND',
          started_at = coalesce(started_at, now()),
          last_checked_at = now(),
          updated_at = now()
      where id = v_intake.id;
    elsif v_subject_count > 1 then
      v_subject_id := null;
      update public.catalog_trust_intake
      set subject_id = null,
          identity_state = 'REVIEW_REQUIRED',
          trust_state = 'REVIEW_REQUIRED',
          started_at = coalesce(started_at, now()),
          last_checked_at = now(),
          updated_at = now()
      where id = v_intake.id;
    else
      update public.catalog_trust_intake
      set subject_id = null,
          identity_state = 'PENDING',
          trust_state = 'IDENTITY_RESOLVING',
          started_at = coalesce(started_at, now()),
          last_checked_at = now(),
          updated_at = now()
      where id = v_intake.id;
    end if;

    select count(*)::integer into v_policy_count
    from public.catalog_required_product_facts_v1(v_intake.category);

    if v_policy_count = 0 then
      update public.catalog_trust_intake
      set trust_state = 'BLOCKED',
          last_checked_at = now(),
          updated_at = now()
      where id = v_intake.id;
      continue;
    end if;

    for v_policy in
      select * from public.catalog_required_product_facts_v1(v_intake.category)
    loop
      if not exists (
        select 1
        from public.product_fact_definition_snapshots d
        where d.registry_version = v_registry_version
          and d.fact_key = v_policy.fact_key
          and not d.deprecated
          and (d.definition -> 'domain_scope') ? v_intake.category
      ) then
        raise exception 'catalog_trust_required_fact_registry_mismatch:%:%', v_intake.category, v_policy.fact_key
          using errcode = '23514';
      end if;

      if v_subject_id is not null and exists (
        select 1
        from public.product_fact_current c
        join public.product_fact_instances fi
          on fi.fact_instance_id = c.fact_instance_id
        where c.subject_id = v_subject_id
          and fi.registry_version = v_registry_version
          and fi.fact_key = v_policy.fact_key
      ) then
        v_task_state := 'ALREADY_COVERED';
      elsif v_subject_id is null then
        v_task_state := 'IDENTITY_PENDING';
      else
        v_task_state := 'RESEARCH_PENDING';
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
        attempt_count,
        created_at,
        updated_at,
        completed_at
      ) values (
        v_intake.id,
        v_intake.product_id,
        v_subject_id,
        v_policy.fact_key,
        v_registry_version,
        'product-fact-required-policy-v1',
        v_task_state,
        v_policy.priority,
        0,
        now(),
        now(),
        case when v_task_state = 'ALREADY_COVERED' then now() else null end
      )
      on conflict (intake_id, fact_key, registry_version, research_policy_version)
      do update set
        subject_id = excluded.subject_id,
        state = case
          when public.product_fact_research_tasks.state in ('CONFIRMED','BLOCKED','EVIDENCE_CANDIDATE','PREFLIGHT_READY','REVIEW_REQUIRED')
            then public.product_fact_research_tasks.state
          else excluded.state
        end,
        priority = excluded.priority,
        completed_at = case
          when excluded.state = 'ALREADY_COVERED' then coalesce(public.product_fact_research_tasks.completed_at, now())
          else public.product_fact_research_tasks.completed_at
        end,
        updated_at = now();

      v_tasks_created := v_tasks_created + 1;
      if v_task_state = 'ALREADY_COVERED' then
        v_tasks_covered := v_tasks_covered + 1;
      end if;
    end loop;

    if v_subject_count = 1 then
      if not exists (
        select 1 from public.product_fact_research_tasks t
        where t.intake_id = v_intake.id
          and t.state <> 'ALREADY_COVERED'
      ) then
        update public.catalog_trust_intake
        set trust_state = 'COMPLETED', completed_at = coalesce(completed_at, now()), last_checked_at = now(), updated_at = now()
        where id = v_intake.id;
      else
        update public.catalog_trust_intake
        set trust_state = 'RESEARCH_PENDING', completed_at = null, last_checked_at = now(), updated_at = now()
        where id = v_intake.id;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'status', 'processed',
    'product_id', p_product_id,
    'registry_version', v_registry_version,
    'required_fact_policy_version', 'product-fact-required-policy-v1',
    'intakes_processed', v_intake_count,
    'tasks_touched', v_tasks_created,
    'already_covered', v_tasks_covered
  );
end;
$$;

revoke all on function public.process_catalog_trust_product_v1(uuid)
  from public, anon, authenticated;
grant execute on function public.process_catalog_trust_product_v1(uuid)
  to service_role;

create or replace function public.read_catalog_trust_product_status_v1(p_product_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'product_id', p_product_id,
    'intakes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id,
        'catalog_revision', i.catalog_revision,
        'category', i.category,
        'market', i.market,
        'subject_id', i.subject_id,
        'identity_state', i.identity_state,
        'trust_state', i.trust_state,
        'required_fact_policy_version', i.required_fact_policy_version,
        'created_at', i.created_at,
        'last_checked_at', i.last_checked_at,
        'tasks', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', t.id,
            'fact_key', t.fact_key,
            'registry_version', t.registry_version,
            'state', t.state,
            'priority', t.priority,
            'subject_id', t.subject_id,
            'blocker_code', t.blocker_code,
            'attempt_count', t.attempt_count,
            'completed_at', t.completed_at
          ) order by t.priority, t.fact_key)
          from public.product_fact_research_tasks t
          where t.intake_id = i.id
        ), '[]'::jsonb)
      ) order by i.created_at, i.id)
      from public.catalog_trust_intake i
      where i.product_id = p_product_id
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.read_catalog_trust_product_status_v1(uuid)
  from public, anon, authenticated;
grant execute on function public.read_catalog_trust_product_status_v1(uuid)
  to service_role;

commit;
