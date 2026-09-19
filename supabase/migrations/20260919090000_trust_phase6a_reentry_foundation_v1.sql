begin;

-- TRUST Phase 6-A: authority-neutral re-entry event foundation.
-- Re-entry records revalidation intent. It does not invalidate Product Fact
-- Current, create Subjects, adopt Evidence, confirm Facts, or mutate Recommendation.

create table public.trust_reentry_events (
  event_id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  event_type text not null check (
    event_type in (
      'SOURCE_CHANGED',
      'FORMULATION_CHANGED',
      'POLICY_CHANGED',
      'REGISTRY_CHANGED',
      'MANUAL_RETRY'
    )
  ),
  product_id uuid not null references public.products(id) on delete restrict,
  intake_id uuid references public.catalog_trust_intake(id) on delete restrict,
  research_task_id uuid references public.product_fact_research_tasks(id) on delete restrict,
  trigger_fingerprint text not null,
  actor_user_id uuid,
  request_id text,
  event_payload jsonb not null default '{}'::jsonb,
  disposition text not null default 'PENDING' check (
    disposition in ('PENDING','RESEARCH_REQUEUED','REVIEW_REQUIRED','NOOP','BLOCKED')
  ),
  disposition_detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint trust_reentry_events_event_key_check
    check (event_key ~ '^[0-9a-f]{64}$'),
  constraint trust_reentry_events_trigger_fingerprint_check
    check (trigger_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint trust_reentry_events_payload_check
    check (jsonb_typeof(event_payload) = 'object'),
  constraint trust_reentry_events_disposition_detail_check
    check (jsonb_typeof(disposition_detail) = 'object'),
  constraint trust_reentry_events_manual_actor_check
    check (
      event_type <> 'MANUAL_RETRY'
      or (
        actor_user_id is not null
        and request_id is not null
        and char_length(btrim(request_id)) between 8 and 120
      )
    )
);

create index trust_reentry_events_product_created_idx
  on public.trust_reentry_events(product_id, created_at desc);
create index trust_reentry_events_intake_created_idx
  on public.trust_reentry_events(intake_id, created_at desc)
  where intake_id is not null;
create index trust_reentry_events_task_created_idx
  on public.trust_reentry_events(research_task_id, created_at desc)
  where research_task_id is not null;
create index trust_reentry_events_pending_idx
  on public.trust_reentry_events(created_at, event_id)
  where disposition = 'PENDING';

alter table public.trust_reentry_events enable row level security;
revoke all on table public.trust_reentry_events
  from public, anon, authenticated, service_role;

-- Phase 5 Admin Queue and Phase 6 server preflight use the server-only
-- Supabase service role through the Data API. Production currently has these
-- operational TRUST tables fully revoked from service_role, which makes the
-- merged read-only Admin Queue fail before RLS is evaluated (42501).
-- Restore SELECT only; all operational writes remain RPC-only.
grant select on table
  public.catalog_trust_intake,
  public.product_fact_research_tasks,
  public.trust_source_observations,
  public.trust_evidence_candidates
to service_role;

create or replace function public.request_trust_reentry_v1(
  p_event_type text,
  p_product_id uuid,
  p_intake_id uuid,
  p_research_task_id uuid,
  p_trigger_fingerprint text,
  p_actor_user_id uuid default null,
  p_request_id text default null,
  p_event_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_event_type text := upper(btrim(coalesce(p_event_type,'')));
  v_fingerprint text := lower(btrim(coalesce(p_trigger_fingerprint,'')));
  v_request_id text := nullif(btrim(coalesce(p_request_id,'')),'');
  v_payload jsonb := coalesce(p_event_payload,'{}'::jsonb);
  v_event_key text;
  v_event public.trust_reentry_events%rowtype;
  v_task public.product_fact_research_tasks%rowtype;
  v_intake public.catalog_trust_intake%rowtype;
begin
  if v_event_type not in (
    'SOURCE_CHANGED','FORMULATION_CHANGED','POLICY_CHANGED','REGISTRY_CHANGED','MANUAL_RETRY'
  ) then
    raise exception 'trust_reentry_event_type_invalid' using errcode='22023';
  end if;
  if p_product_id is null or v_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'trust_reentry_identity_invalid' using errcode='22023';
  end if;
  if jsonb_typeof(v_payload) <> 'object' then
    raise exception 'trust_reentry_payload_invalid' using errcode='22023';
  end if;
  if v_event_type = 'MANUAL_RETRY' and (
    p_actor_user_id is null
    or v_request_id is null
    or char_length(v_request_id) not between 8 and 120
  ) then
    raise exception 'trust_reentry_manual_actor_required' using errcode='22023';
  end if;

  if not exists(select 1 from public.products where id=p_product_id) then
    raise exception 'trust_reentry_product_not_found' using errcode='P0002';
  end if;

  if p_intake_id is not null then
    select * into v_intake
    from public.catalog_trust_intake
    where id=p_intake_id;
    if not found or v_intake.product_id <> p_product_id then
      raise exception 'trust_reentry_intake_mismatch' using errcode='22023';
    end if;
  end if;

  if p_research_task_id is not null then
    select * into v_task
    from public.product_fact_research_tasks
    where id=p_research_task_id;
    if not found
      or v_task.product_id <> p_product_id
      or (p_intake_id is not null and v_task.intake_id <> p_intake_id)
    then
      raise exception 'trust_reentry_task_mismatch' using errcode='22023';
    end if;
  end if;

  v_event_key := encode(
    extensions.digest(
      convert_to(
        concat_ws('|',
          'trust-reentry-event-v1',
          v_event_type,
          p_product_id::text,
          coalesce(p_intake_id::text,'-'),
          coalesce(p_research_task_id::text,'-'),
          v_fingerprint
        ),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  perform pg_advisory_xact_lock(hashtextextended('bejewely_trust_reentry:' || v_event_key,0));

  insert into public.trust_reentry_events (
    event_key,event_type,product_id,intake_id,research_task_id,
    trigger_fingerprint,actor_user_id,request_id,event_payload
  ) values (
    v_event_key,v_event_type,p_product_id,p_intake_id,p_research_task_id,
    v_fingerprint,p_actor_user_id,v_request_id,v_payload
  )
  on conflict (event_key) do nothing
  returning * into v_event;

  if v_event.event_id is null then
    select * into v_event
    from public.trust_reentry_events
    where event_key=v_event_key;

    if v_event.event_type <> v_event_type
      or v_event.product_id <> p_product_id
      or v_event.intake_id is distinct from p_intake_id
      or v_event.research_task_id is distinct from p_research_task_id
      or v_event.trigger_fingerprint <> v_fingerprint
      or v_event.actor_user_id is distinct from p_actor_user_id
      or v_event.request_id is distinct from v_request_id
      or v_event.event_payload <> v_payload
    then
      raise exception 'trust_reentry_event_key_collision' using errcode='23505';
    end if;

    return jsonb_build_object(
      'status','queued',
      'idempotent',true,
      'event_id',v_event.event_id,
      'event_key',v_event.event_key,
      'event_type',v_event.event_type,
      'disposition',v_event.disposition
    );
  end if;

  return jsonb_build_object(
    'status','queued',
    'idempotent',false,
    'event_id',v_event.event_id,
    'event_key',v_event.event_key,
    'event_type',v_event.event_type,
    'disposition',v_event.disposition
  );
end;
$$;

create or replace function public.process_trust_reentry_event_v1(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event public.trust_reentry_events%rowtype;
  v_task public.product_fact_research_tasks%rowtype;
  v_intake public.catalog_trust_intake%rowtype;
  v_disposition text;
  v_reason text;
begin
  select * into v_event
  from public.trust_reentry_events
  where event_id=p_event_id
  for update;

  if not found then
    raise exception 'trust_reentry_event_not_found' using errcode='P0002';
  end if;

  if v_event.disposition <> 'PENDING' then
    return jsonb_build_object(
      'status','processed',
      'idempotent',true,
      'event_id',v_event.event_id,
      'event_type',v_event.event_type,
      'disposition',v_event.disposition,
      'detail',v_event.disposition_detail
    );
  end if;

  if v_event.event_type in ('SOURCE_CHANGED','FORMULATION_CHANGED','POLICY_CHANGED','REGISTRY_CHANGED') then
    v_disposition := 'REVIEW_REQUIRED';
    v_reason := case v_event.event_type
      when 'SOURCE_CHANGED' then 'SOURCE_CHANGED_REVIEW_REQUIRED'
      when 'FORMULATION_CHANGED' then 'FORMULATION_CHANGED_REVIEW_REQUIRED'
      when 'POLICY_CHANGED' then 'POLICY_CHANGED_REVALIDATION_REQUIRED'
      else 'REGISTRY_CHANGED_REVALIDATION_REQUIRED'
    end;

    update public.trust_reentry_events
    set disposition=v_disposition,
        disposition_detail=jsonb_build_object(
          'reason_code',v_reason,
          'authority_mutation',false,
          'current_invalidated',false,
          'phase','6-A'
        ),
        processed_at=now()
    where event_id=v_event.event_id;

    return jsonb_build_object(
      'status','processed',
      'idempotent',false,
      'event_id',v_event.event_id,
      'event_type',v_event.event_type,
      'disposition',v_disposition,
      'reason_code',v_reason,
      'authority_mutation',false,
      'current_invalidated',false
    );
  end if;

  -- MANUAL_RETRY is a revalidation request, never a force-reset.
  perform public.process_catalog_trust_product_v1(v_event.product_id);

  if v_event.research_task_id is null then
    v_disposition := 'NOOP';
    v_reason := 'MANUAL_REVALIDATION_PRODUCT_REFRESHED';
  else
    select * into v_task
    from public.product_fact_research_tasks
    where id=v_event.research_task_id
    for update;

    if not found then
      v_disposition := 'BLOCKED';
      v_reason := 'RESEARCH_TASK_NOT_FOUND';
    else
      select * into v_intake
      from public.catalog_trust_intake
      where id=v_task.intake_id;

      if v_task.state in ('EVIDENCE_CANDIDATE','PREFLIGHT_READY','CONFIRMED','ALREADY_COVERED') then
        v_disposition := 'NOOP';
        v_reason := 'GOVERNED_OR_COVERED_STATE_PRESERVED';
      elsif v_intake.identity_state <> 'EXACT_SUBJECT_FOUND' or v_task.subject_id is null then
        v_disposition := case when v_intake.trust_state='BLOCKED' then 'BLOCKED' else 'REVIEW_REQUIRED' end;
        v_reason := coalesce(v_task.blocker_code,v_intake.identity_state,'IDENTITY_REVALIDATION_REQUIRED');
      elsif v_task.state in ('BLOCKED','REVIEW_REQUIRED')
        and v_task.blocker_code in ('SOURCE_BLOCKED','EVIDENCE_INSUFFICIENT')
      then
        update public.product_fact_research_tasks
        set state='RESEARCH_PENDING',
            blocker_code=null,
            blocker_detail=null,
            next_retry_at=now(),
            completed_at=null,
            updated_at=now()
        where id=v_task.id;

        perform public.process_catalog_trust_product_v1(v_event.product_id);
        v_disposition := 'RESEARCH_REQUEUED';
        v_reason := 'MANUAL_RETRY_ELIGIBLE_RESEARCH_BLOCKER';
      else
        v_disposition := 'NOOP';
        v_reason := 'MANUAL_RETRY_NOT_ELIGIBLE_FOR_FORCE_RESET';
      end if;
    end if;
  end if;

  update public.trust_reentry_events
  set disposition=v_disposition,
      disposition_detail=jsonb_build_object(
        'reason_code',v_reason,
        'authority_mutation',false,
        'current_invalidated',false,
        'phase','6-A'
      ),
      processed_at=now()
  where event_id=v_event.event_id;

  return jsonb_build_object(
    'status','processed',
    'idempotent',false,
    'event_id',v_event.event_id,
    'event_type',v_event.event_type,
    'disposition',v_disposition,
    'reason_code',v_reason,
    'authority_mutation',false,
    'current_invalidated',false
  );
end;
$$;

revoke all on function public.request_trust_reentry_v1(text,uuid,uuid,uuid,text,uuid,text,jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.request_trust_reentry_v1(text,uuid,uuid,uuid,text,uuid,text,jsonb)
  to service_role;

revoke all on function public.process_trust_reentry_event_v1(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.process_trust_reentry_event_v1(uuid)
  to service_role;

comment on table public.trust_reentry_events is
  'TRUST Phase 6 append-only operational revalidation intent. Never Product Fact authority.';
comment on function public.request_trust_reentry_v1(text,uuid,uuid,uuid,text,uuid,text,jsonb) is
  'Service-role-only idempotent TRUST re-entry event request boundary.';
comment on function public.process_trust_reentry_event_v1(uuid) is
  'Service-role-only Phase 6-A revalidation processor. Change events are review-only; manual retry requeues only eligible research blockers.';

commit;
