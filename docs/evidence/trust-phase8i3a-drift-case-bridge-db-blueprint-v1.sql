-- TRUST Phase 8I-3A: confirmed transport incident -> governed drift case / Phase 6 re-entry bridge.
-- Transport drift remains operational evidence only. This slice never mutates Product Fact,
-- historical Evidence Source identity, source relocation authority, or Recommendation authority.

alter table public.trust_reentry_events
  drop constraint trust_reentry_events_event_type_check;

alter table public.trust_reentry_events
  add constraint trust_reentry_events_event_type_check
  check (
    event_type in (
      'SOURCE_CHANGED',
      'FORMULATION_CHANGED',
      'POLICY_CHANGED',
      'REGISTRY_CHANGED',
      'SOURCE_TRANSPORT_DRIFT',
      'MANUAL_RETRY'
    )
  );

create table public.trust_official_source_transport_drift_cases (
  case_id uuid primary key default gen_random_uuid(),
  case_key text not null unique
    check (case_key ~ '^[0-9a-f]{64}$'),
  event_id uuid not null unique
    references public.trust_reentry_events(event_id) on delete restrict,
  incident_kind text not null
    check (incident_kind in ('CONFIRMED_REDIRECT','CONFIRMED_MISSING')),
  target_key text not null
    check (target_key ~ '^official-transport-url-sha256:[0-9a-f]{64}$'),
  product_id uuid not null references public.products(id) on delete restrict,
  subject_id uuid not null references public.product_fact_subjects(subject_id) on delete restrict,
  effective_locator text not null
    check (effective_locator ~ '^https://[^[:space:]#]+$'),
  confirmed_final_locator text,
  episode_started_at timestamptz not null,
  episode_anchor_probe_group_id text not null
    check (
      episode_anchor_probe_group_id=btrim(episode_anchor_probe_group_id)
      and char_length(episode_anchor_probe_group_id) between 8 and 220
    ),
  route_hint text not null
    check (route_hint in ('REDIRECT_QUALIFICATION','MISSING_REDISCOVERY')),
  case_payload jsonb not null
    check (jsonb_typeof(case_payload)='object'),
  case_digest text not null
    check (case_digest ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  check (case_key=case_digest),
  check (
    (incident_kind='CONFIRMED_REDIRECT' and confirmed_final_locator ~ '^https://[^[:space:]#]+$')
    or (incident_kind='CONFIRMED_MISSING' and confirmed_final_locator is null)
  )
);

create index trust_transport_drift_cases_subject_created_idx
  on public.trust_official_source_transport_drift_cases(product_id,subject_id,created_at desc);
create index trust_transport_drift_cases_target_created_idx
  on public.trust_official_source_transport_drift_cases(target_key,created_at desc);

create table public.trust_official_source_transport_drift_case_incidents (
  link_id uuid primary key default gen_random_uuid(),
  case_id uuid not null
    references public.trust_official_source_transport_drift_cases(case_id) on delete restrict,
  incident_id uuid not null
    references public.trust_official_source_transport_incidents(incident_id) on delete restrict,
  source_id uuid not null
    references public.product_evidence_sources(source_id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(case_id,incident_id)
);

create index trust_transport_drift_case_incidents_incident_idx
  on public.trust_official_source_transport_drift_case_incidents(incident_id,case_id);
create index trust_transport_drift_case_incidents_source_idx
  on public.trust_official_source_transport_drift_case_incidents(source_id,case_id);

create table public.trust_official_source_transport_drift_evaluations (
  evaluation_id uuid primary key default gen_random_uuid(),
  request_id text not null unique
    check (
      request_id=btrim(request_id)
      and char_length(request_id) between 8 and 220
    ),
  case_id uuid not null
    references public.trust_official_source_transport_drift_cases(case_id) on delete restrict,
  policy_key text not null
    check (
      policy_key=btrim(policy_key)
      and char_length(policy_key) between 3 and 220
    ),
  policy_version text not null
    check (
      policy_version=btrim(policy_version)
      and char_length(policy_version) between 1 and 120
    ),
  evaluation_mode text not null
    check (evaluation_mode in ('REDIRECT_DIRECT','REDISCOVERY')),
  result_kind text not null
    check (result_kind in ('READY_FOR_8I4','HOLD','RETRYABLE','POLICY_REQUIRED')),
  candidate_locator text,
  qualification_digest text,
  input_digest text not null check (input_digest ~ '^[0-9a-f]{64}$'),
  result_digest text not null check (result_digest ~ '^[0-9a-f]{64}$'),
  result_payload jsonb not null check (jsonb_typeof(result_payload)='object'),
  created_at timestamptz not null default now(),
  check (candidate_locator is null or candidate_locator ~ '^https://[^[:space:]#]+$'),
  check (qualification_digest is null or qualification_digest ~ '^[0-9a-f]{64}$'),
  check (
    result_kind <> 'READY_FOR_8I4'
    or (
      candidate_locator is not null
      and qualification_digest is not null
    )
  )
);

create index trust_transport_drift_evaluations_case_created_idx
  on public.trust_official_source_transport_drift_evaluations(case_id,created_at desc,evaluation_id desc);

alter table public.trust_official_source_transport_drift_cases enable row level security;
alter table public.trust_official_source_transport_drift_case_incidents enable row level security;
alter table public.trust_official_source_transport_drift_evaluations enable row level security;

revoke all on table
  public.trust_official_source_transport_drift_cases,
  public.trust_official_source_transport_drift_case_incidents,
  public.trust_official_source_transport_drift_evaluations
from public, anon, authenticated, service_role;

create or replace function public.reject_trust_phase8i3_append_only_mutation_v1()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  raise exception 'trust_phase8i3_append_only' using errcode='55000';
end;
$function$;

revoke all on function public.reject_trust_phase8i3_append_only_mutation_v1()
  from public, anon, authenticated, service_role;

create trigger trust_transport_drift_cases_immutable_v1
before update or delete on public.trust_official_source_transport_drift_cases
for each row execute function public.reject_trust_phase8i3_append_only_mutation_v1();

create trigger trust_transport_drift_case_incidents_immutable_v1
before update or delete on public.trust_official_source_transport_drift_case_incidents
for each row execute function public.reject_trust_phase8i3_append_only_mutation_v1();

create trigger trust_transport_drift_evaluations_immutable_v1
before update or delete on public.trust_official_source_transport_drift_evaluations
for each row execute function public.reject_trust_phase8i3_append_only_mutation_v1();

create or replace function public.trust_phase8i3_case_candidates_v1(p_limit integer default 100)
returns table (
  case_key text,
  incident_kind text,
  target_key text,
  product_id uuid,
  subject_id uuid,
  effective_locator text,
  confirmed_final_locator text,
  episode_started_at timestamptz,
  episode_anchor_probe_group_id text,
  route_hint text,
  incident_ids jsonb,
  source_ids jsonb,
  case_payload jsonb,
  case_digest text
)
language sql
security definer
set search_path = ''
as $function$
  with selected_incidents as (
    select i.*
    from public.trust_official_source_transport_incidents i
    where exists (
      select 1
      from public.product_evidence_records e
      join public.product_fact_current c
        on c.proposition_key=e.proposition_key
       and c.subject_id=e.subject_id
      join public.product_fact_subjects s
        on s.subject_id=e.subject_id
      where e.source_id=i.source_id
        and e.support_direction='supports'
        and not exists (
          select 1
          from public.trust_official_source_transport_drift_case_incidents l
          join public.trust_official_source_transport_drift_cases dc
            on dc.case_id=l.case_id
          where l.incident_id=i.incident_id
            and dc.product_id=s.product_id
            and dc.subject_id=e.subject_id
            and dc.target_key=i.target_key
            and dc.episode_anchor_probe_group_id=
              nullif(btrim(i.incident_detail->>'first_probe_group_id'),'')
        )
    )
    order by i.confirmed_at,i.incident_id
    limit greatest(1,least(coalesce(p_limit,100),1000))
  ),
  expanded as (
    select distinct
      i.incident_id,
      i.source_id,
      i.target_key,
      i.incident_kind,
      i.effective_locator,
      i.confirmed_final_locator,
      i.episode_started_at,
      s.product_id,
      e.subject_id,
      nullif(btrim(i.incident_detail->>'first_probe_group_id'),'') as episode_anchor_probe_group_id
    from selected_incidents i
    join public.product_evidence_records e
      on e.source_id=i.source_id
     and e.support_direction='supports'
    join public.product_fact_current c
      on c.proposition_key=e.proposition_key
     and c.subject_id=e.subject_id
    join public.product_fact_subjects s
      on s.subject_id=e.subject_id
  ),
  eligible as (
    select *
    from expanded
    where episode_anchor_probe_group_id is not null
  ),
  grouped as (
    select
      incident_kind,
      target_key,
      product_id,
      subject_id,
      effective_locator,
      confirmed_final_locator,
      min(episode_started_at) as episode_started_at,
      episode_anchor_probe_group_id,
      case
        when incident_kind='CONFIRMED_REDIRECT'
          then 'REDIRECT_QUALIFICATION'
        else 'MISSING_REDISCOVERY'
      end as route_hint,
      to_jsonb(array_agg(distinct incident_id order by incident_id)) as incident_ids,
      to_jsonb(array_agg(distinct source_id order by source_id)) as source_ids
    from eligible
    group by
      incident_kind,target_key,product_id,subject_id,effective_locator,
      confirmed_final_locator,episode_anchor_probe_group_id
  ),
  payloads as (
    select
      g.*,
      jsonb_build_object(
        'contract','trust-phase8i3-transport-drift-case-v1',
        'incident_kind',g.incident_kind,
        'target_key',g.target_key,
        'product_id',g.product_id,
        'subject_id',g.subject_id,
        'effective_locator',g.effective_locator,
        'confirmed_final_locator',g.confirmed_final_locator,
        'episode_started_at',g.episode_started_at,
        'episode_anchor_probe_group_id',g.episode_anchor_probe_group_id,
        'route_hint',g.route_hint,
        'authority','TRANSPORT_SIGNAL_ONLY_NO_SEMANTIC_OR_RELOCATION_AUTHORITY'
      ) as case_payload
    from grouped g
  ),
  digested as (
    select
      p.*,
      encode(
        extensions.digest(
          convert_to(public.trust_phase8h_canonical_json_text_v1(p.case_payload),'UTF8'),
          'sha256'
        ),
        'hex'
      ) as digest
    from payloads p
  )
  select
    d.digest as case_key,
    d.incident_kind,
    d.target_key,
    d.product_id,
    d.subject_id,
    d.effective_locator,
    d.confirmed_final_locator,
    d.episode_started_at,
    d.episode_anchor_probe_group_id,
    d.route_hint,
    d.incident_ids,
    d.source_ids,
    d.case_payload,
    d.digest as case_digest
  from digested d
  order by d.episode_started_at,d.product_id,d.subject_id,d.digest;
$function$;

revoke all on function public.trust_phase8i3_case_candidates_v1(integer)
  from public, anon, authenticated, service_role;

create or replace function public.build_trust_official_source_transport_drift_cases_v1(
  p_limit integer default 100
)
returns jsonb
language sql
security definer
set search_path = ''
as $function$
  with candidates as (
    select * from public.trust_phase8i3_case_candidates_v1(p_limit)
  )
  select jsonb_build_object(
    'contract','trust-phase8i3-drift-case-builder-v1',
    'candidate_count',(select count(*) from candidates),
    'candidates',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'case_key',case_key,
          'incident_kind',incident_kind,
          'target_key',target_key,
          'product_id',product_id,
          'subject_id',subject_id,
          'effective_locator',effective_locator,
          'confirmed_final_locator',confirmed_final_locator,
          'episode_started_at',episode_started_at,
          'episode_anchor_probe_group_id',episode_anchor_probe_group_id,
          'route_hint',route_hint,
          'incident_ids',incident_ids,
          'source_ids',source_ids,
          'case_payload',case_payload,
          'case_digest',case_digest
        )
        order by episode_started_at,product_id,subject_id,case_key
      )
      from candidates
    ),'[]'::jsonb),
    'authority','READ_ONLY_CASE_CANDIDATES_NO_AUTHORITY_MUTATION'
  );
$function$;

revoke all on function public.build_trust_official_source_transport_drift_cases_v1(integer)
  from public, anon, authenticated, service_role;
grant execute on function public.build_trust_official_source_transport_drift_cases_v1(integer)
  to service_role;

create or replace function public.enqueue_trust_official_source_transport_drift_cases_v1(
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_limit integer := greatest(1,least(coalesce(p_limit,100),1000));
  v_candidate record;
  v_case public.trust_official_source_transport_drift_cases%rowtype;
  v_case_id uuid;
  v_event jsonb;
  v_event_id uuid;
  v_processed jsonb;
  v_incident_id uuid;
  v_source_id uuid;
  v_new_case_count integer := 0;
  v_existing_case_count integer := 0;
  v_new_link_count integer := 0;
  v_new_reentry_event_count integer := 0;
  v_candidate_count integer := 0;
  v_blocked_count integer := 0;
begin
  select count(*) into v_blocked_count
  from (
    select i.incident_id
    from public.trust_official_source_transport_incidents i
    where
      nullif(btrim(i.incident_detail->>'first_probe_group_id'),'') is null
      or not exists (
        select 1
        from public.product_evidence_records e
        join public.product_fact_current c
          on c.proposition_key=e.proposition_key
         and c.subject_id=e.subject_id
        where e.source_id=i.source_id
          and e.support_direction='supports'
      )
    order by i.confirmed_at,i.incident_id
    limit v_limit
  ) blocked;

  for v_candidate in
    select * from public.trust_phase8i3_case_candidates_v1(v_limit)
  loop
    v_candidate_count := v_candidate_count + 1;

    perform pg_advisory_xact_lock(
      hashtextextended(
        'bejewely_trust_transport_drift_case:' || v_candidate.case_key,
        0
      )
    );

    select * into v_case
    from public.trust_official_source_transport_drift_cases c
    where c.case_key=v_candidate.case_key;

    if not found then
      v_case_id := gen_random_uuid();

      v_event := public.request_trust_reentry_v1(
        'SOURCE_TRANSPORT_DRIFT',
        v_candidate.product_id,
        null,
        null,
        v_candidate.case_digest,
        null,
        null,
        jsonb_build_object(
          'contract','trust-phase8i3-source-transport-drift-reentry-v1',
          'case_id',v_case_id,
          'case_key',v_candidate.case_key,
          'incident_kind',v_candidate.incident_kind,
          'target_key',v_candidate.target_key,
          'product_id',v_candidate.product_id,
          'subject_id',v_candidate.subject_id,
          'effective_locator',v_candidate.effective_locator,
          'confirmed_final_locator',v_candidate.confirmed_final_locator,
          'episode_anchor_probe_group_id',v_candidate.episode_anchor_probe_group_id,
          'route_hint',v_candidate.route_hint,
          'authority','TRANSPORT_SIGNAL_ONLY'
        )
      );

      v_event_id := (v_event->>'event_id')::uuid;

      insert into public.trust_official_source_transport_drift_cases(
        case_id,case_key,event_id,incident_kind,target_key,
        product_id,subject_id,effective_locator,confirmed_final_locator,
        episode_started_at,episode_anchor_probe_group_id,route_hint,
        case_payload,case_digest
      ) values (
        v_case_id,v_candidate.case_key,v_event_id,v_candidate.incident_kind,
        v_candidate.target_key,v_candidate.product_id,v_candidate.subject_id,
        v_candidate.effective_locator,v_candidate.confirmed_final_locator,
        v_candidate.episode_started_at,v_candidate.episode_anchor_probe_group_id,
        v_candidate.route_hint,v_candidate.case_payload,v_candidate.case_digest
      )
      returning * into v_case;

      v_processed := public.process_trust_reentry_event_v1(v_event_id);
      if v_processed->>'disposition' <> 'REVIEW_REQUIRED'
        or v_processed->>'reason_code' <> 'SOURCE_TRANSPORT_DRIFT_REVIEW_REQUIRED'
        or coalesce((v_processed->>'authority_mutation')::boolean,true)
        or coalesce((v_processed->>'current_invalidated')::boolean,true)
      then
        raise exception 'trust_transport_drift_reentry_processing_invalid'
          using errcode='55000';
      end if;

      v_new_case_count := v_new_case_count + 1;
      if coalesce((v_event->>'idempotent')::boolean,false)=false then
        v_new_reentry_event_count := v_new_reentry_event_count + 1;
      end if;
    else
      if v_case.incident_kind is distinct from v_candidate.incident_kind
        or v_case.target_key is distinct from v_candidate.target_key
        or v_case.product_id is distinct from v_candidate.product_id
        or v_case.subject_id is distinct from v_candidate.subject_id
        or v_case.effective_locator is distinct from v_candidate.effective_locator
        or v_case.confirmed_final_locator is distinct from v_candidate.confirmed_final_locator
        or v_case.episode_started_at is distinct from v_candidate.episode_started_at
        or v_case.episode_anchor_probe_group_id is distinct from v_candidate.episode_anchor_probe_group_id
        or v_case.route_hint is distinct from v_candidate.route_hint
        or v_case.case_payload is distinct from v_candidate.case_payload
        or v_case.case_digest is distinct from v_candidate.case_digest
      then
        raise exception 'trust_transport_drift_case_key_collision'
          using errcode='23505';
      end if;
      v_existing_case_count := v_existing_case_count + 1;
    end if;

    for v_incident_id in
      select value::uuid
      from jsonb_array_elements_text(v_candidate.incident_ids)
    loop
      select i.source_id into v_source_id
      from public.trust_official_source_transport_incidents i
      where i.incident_id=v_incident_id;

      if v_source_id is null then
        raise exception 'trust_transport_drift_incident_not_found'
          using errcode='P0002';
      end if;

      insert into public.trust_official_source_transport_drift_case_incidents(
        case_id,incident_id,source_id
      ) values (
        v_case.case_id,v_incident_id,v_source_id
      )
      on conflict (case_id,incident_id) do nothing;

      if found then
        v_new_link_count := v_new_link_count + 1;
      end if;
    end loop;
  end loop;

  return jsonb_build_object(
    'contract','trust-phase8i3-drift-case-enqueue-result-v1',
    'candidate_count',v_candidate_count,
    'new_case_count',v_new_case_count,
    'existing_case_count',v_existing_case_count,
    'new_link_count',v_new_link_count,
    'new_reentry_event_count',v_new_reentry_event_count,
    'blocked_count',v_blocked_count,
    'authority_mutation',false,
    'current_invalidated',false
  );
end;
$function$;

revoke all on function public.enqueue_trust_official_source_transport_drift_cases_v1(integer)
  from public, anon, authenticated, service_role;
grant execute on function public.enqueue_trust_official_source_transport_drift_cases_v1(integer)
  to service_role;

create or replace function public.get_trust_official_source_transport_drift_case_v1(
  p_case_id uuid
)
returns jsonb
language sql
security definer
set search_path = ''
as $function$
  select jsonb_build_object(
    'contract','trust-phase8i3-drift-case-v1',
    'case_id',c.case_id,
    'case_key',c.case_key,
    'event_id',c.event_id,
    'event_type',e.event_type,
    'event_disposition',e.disposition,
    'incident_kind',c.incident_kind,
    'target_key',c.target_key,
    'product_id',c.product_id,
    'subject_id',c.subject_id,
    'effective_locator',c.effective_locator,
    'confirmed_final_locator',c.confirmed_final_locator,
    'episode_started_at',c.episode_started_at,
    'episode_anchor_probe_group_id',c.episode_anchor_probe_group_id,
    'route_hint',c.route_hint,
    'case_payload',c.case_payload,
    'case_digest',c.case_digest,
    'incident_ids',coalesce((
      select to_jsonb(array_agg(l.incident_id order by l.incident_id))
      from public.trust_official_source_transport_drift_case_incidents l
      where l.case_id=c.case_id
    ),'[]'::jsonb),
    'source_ids',coalesce((
      select to_jsonb(array_agg(distinct l.source_id order by l.source_id))
      from public.trust_official_source_transport_drift_case_incidents l
      where l.case_id=c.case_id
    ),'[]'::jsonb),
    'latest_evaluation',(
      select jsonb_build_object(
        'evaluation_id',v.evaluation_id,
        'request_id',v.request_id,
        'policy_key',v.policy_key,
        'policy_version',v.policy_version,
        'evaluation_mode',v.evaluation_mode,
        'result_kind',v.result_kind,
        'candidate_locator',v.candidate_locator,
        'qualification_digest',v.qualification_digest,
        'input_digest',v.input_digest,
        'result_digest',v.result_digest,
        'result_payload',v.result_payload,
        'created_at',v.created_at
      )
      from public.trust_official_source_transport_drift_evaluations v
      where v.case_id=c.case_id
      order by v.created_at desc,v.evaluation_id desc
      limit 1
    ),
    'authority','TRANSPORT_DRIFT_CASE_NO_RELOCATION_OR_SEMANTIC_AUTHORITY'
  )
  from public.trust_official_source_transport_drift_cases c
  join public.trust_reentry_events e on e.event_id=c.event_id
  where c.case_id=p_case_id;
$function$;

revoke all on function public.get_trust_official_source_transport_drift_case_v1(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_trust_official_source_transport_drift_case_v1(uuid)
  to service_role;

create or replace function public.get_trust_official_source_transport_drift_cases_v1(
  p_limit integer default 100
)
returns jsonb
language sql
security definer
set search_path = ''
as $function$
  with cases as (
    select c.case_id
    from public.trust_official_source_transport_drift_cases c
    order by c.created_at,c.case_id
    limit greatest(1,least(coalesce(p_limit,100),1000))
  )
  select jsonb_build_object(
    'contract','trust-phase8i3-drift-case-list-v1',
    'case_count',(select count(*) from cases),
    'cases',coalesce((
      select jsonb_agg(
        public.get_trust_official_source_transport_drift_case_v1(x.case_id)
        order by x.case_id
      )
      from cases x
    ),'[]'::jsonb),
    'authority','READ_ONLY_OPERATIONAL_CASE_VIEW'
  );
$function$;

revoke all on function public.get_trust_official_source_transport_drift_cases_v1(integer)
  from public, anon, authenticated, service_role;
grant execute on function public.get_trust_official_source_transport_drift_cases_v1(integer)
  to service_role;

create or replace function public.record_trust_official_source_transport_drift_evaluation_v1(
  p_request_id text,
  p_case_id uuid,
  p_policy_key text,
  p_policy_version text,
  p_evaluation_mode text,
  p_result_kind text,
  p_candidate_locator text,
  p_qualification_digest text,
  p_input_digest text,
  p_result_digest text,
  p_result_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_request_id text := btrim(coalesce(p_request_id,''));
  v_policy_key text := btrim(coalesce(p_policy_key,''));
  v_policy_version text := btrim(coalesce(p_policy_version,''));
  v_mode text := upper(btrim(coalesce(p_evaluation_mode,'')));
  v_result_kind text := upper(btrim(coalesce(p_result_kind,'')));
  v_candidate_locator text := nullif(btrim(coalesce(p_candidate_locator,'')),'');
  v_qualification_digest text := nullif(lower(btrim(coalesce(p_qualification_digest,''))),'');
  v_input_digest text := lower(btrim(coalesce(p_input_digest,'')));
  v_result_digest text := lower(btrim(coalesce(p_result_digest,'')));
  v_payload jsonb := coalesce(p_result_payload,'{}'::jsonb);
  v_existing public.trust_official_source_transport_drift_evaluations%rowtype;
  v_evaluation public.trust_official_source_transport_drift_evaluations%rowtype;
begin
  if char_length(v_request_id) not between 8 and 220
    or p_case_id is null
    or char_length(v_policy_key) not between 3 and 220
    or char_length(v_policy_version) not between 1 and 120
    or v_mode not in ('REDIRECT_DIRECT','REDISCOVERY')
    or v_result_kind not in ('READY_FOR_8I4','HOLD','RETRYABLE','POLICY_REQUIRED')
    or v_input_digest !~ '^[0-9a-f]{64}$'
    or v_result_digest !~ '^[0-9a-f]{64}$'
    or jsonb_typeof(v_payload)<>'object'
    or (v_candidate_locator is not null and v_candidate_locator !~ '^https://[^[:space:]#]+$')
    or (v_qualification_digest is not null and v_qualification_digest !~ '^[0-9a-f]{64}$')
    or (
      v_result_kind='READY_FOR_8I4'
      and (v_candidate_locator is null or v_qualification_digest is null)
    )
  then
    raise exception 'trust_transport_drift_evaluation_payload_invalid'
      using errcode='22023';
  end if;

  if not exists (
    select 1
    from public.trust_official_source_transport_drift_cases c
    where c.case_id=p_case_id
  ) then
    raise exception 'trust_transport_drift_case_not_found'
      using errcode='P0002';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('bejewely_trust_transport_drift_evaluation:' || v_request_id,0)
  );

  select * into v_existing
  from public.trust_official_source_transport_drift_evaluations e
  where e.request_id=v_request_id;

  if found then
    if v_existing.case_id is distinct from p_case_id
      or v_existing.policy_key is distinct from v_policy_key
      or v_existing.policy_version is distinct from v_policy_version
      or v_existing.evaluation_mode is distinct from v_mode
      or v_existing.result_kind is distinct from v_result_kind
      or v_existing.candidate_locator is distinct from v_candidate_locator
      or v_existing.qualification_digest is distinct from v_qualification_digest
      or v_existing.input_digest is distinct from v_input_digest
      or v_existing.result_digest is distinct from v_result_digest
      or v_existing.result_payload is distinct from v_payload
    then
      raise exception 'trust_transport_drift_evaluation_idempotency_conflict'
        using errcode='23505';
    end if;

    return jsonb_build_object(
      'status','recorded',
      'idempotent',true,
      'evaluation_id',v_existing.evaluation_id,
      'case_id',v_existing.case_id,
      'result_kind',v_existing.result_kind,
      'authority_mutation',false
    );
  end if;

  insert into public.trust_official_source_transport_drift_evaluations(
    request_id,case_id,policy_key,policy_version,evaluation_mode,result_kind,
    candidate_locator,qualification_digest,input_digest,result_digest,result_payload
  ) values (
    v_request_id,p_case_id,v_policy_key,v_policy_version,v_mode,v_result_kind,
    v_candidate_locator,v_qualification_digest,v_input_digest,v_result_digest,v_payload
  )
  returning * into v_evaluation;

  return jsonb_build_object(
    'status','recorded',
    'idempotent',false,
    'evaluation_id',v_evaluation.evaluation_id,
    'case_id',v_evaluation.case_id,
    'result_kind',v_evaluation.result_kind,
    'authority_mutation',false
  );
end;
$function$;

revoke all on function public.record_trust_official_source_transport_drift_evaluation_v1(
  text,uuid,text,text,text,text,text,text,text,text,jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.record_trust_official_source_transport_drift_evaluation_v1(
  text,uuid,text,text,text,text,text,text,text,text,jsonb
) to service_role;

CREATE OR REPLACE FUNCTION public.request_trust_reentry_v1(p_event_type text, p_product_id uuid, p_intake_id uuid, p_research_task_id uuid, p_trigger_fingerprint text, p_actor_user_id uuid DEFAULT NULL::uuid, p_request_id text DEFAULT NULL::text, p_event_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    'SOURCE_CHANGED','FORMULATION_CHANGED','POLICY_CHANGED','REGISTRY_CHANGED','SOURCE_TRANSPORT_DRIFT','MANUAL_RETRY'
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
$function$;

CREATE OR REPLACE FUNCTION public.process_trust_reentry_event_v1(p_event_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  if v_event.event_type in ('SOURCE_CHANGED','FORMULATION_CHANGED','POLICY_CHANGED','REGISTRY_CHANGED','SOURCE_TRANSPORT_DRIFT') then
    v_disposition := 'REVIEW_REQUIRED';
    v_reason := case v_event.event_type
      when 'SOURCE_CHANGED' then 'SOURCE_CHANGED_REVIEW_REQUIRED'
      when 'FORMULATION_CHANGED' then 'FORMULATION_CHANGED_REVIEW_REQUIRED'
      when 'POLICY_CHANGED' then 'POLICY_CHANGED_REVALIDATION_REQUIRED'
      when 'REGISTRY_CHANGED' then 'REGISTRY_CHANGED_REVALIDATION_REQUIRED'
      else 'SOURCE_TRANSPORT_DRIFT_REVIEW_REQUIRED'
    end;

    update public.trust_reentry_events
    set disposition=v_disposition,
        disposition_detail=jsonb_build_object(
          'reason_code',v_reason,
          'authority_mutation',false,
          'current_invalidated',false,
          'phase',case when v_event.event_type='SOURCE_TRANSPORT_DRIFT' then '8I-3' else '6-A' end,
          'transport_signal_only',v_event.event_type='SOURCE_TRANSPORT_DRIFT'
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
  -- Phase 7-B legacy materializations preserve their frozen exact Subject scope
  -- and must never be routed back through the generic Phase 2 resolver.
  if v_event.research_task_id is not null then
    select * into v_task
    from public.product_fact_research_tasks
    where id=v_event.research_task_id
    for update;

    if found then
      select * into v_intake
      from public.catalog_trust_intake
      where id=v_task.intake_id;
    end if;
  elsif v_event.intake_id is not null then
    select * into v_intake
    from public.catalog_trust_intake
    where id=v_event.intake_id;
  else
    -- Product-level legacy retries are also snapshot-preserving. Prefer the
    -- materialized legacy intake over generic re-resolution when one exists.
    select * into v_intake
    from public.catalog_trust_intake
    where product_id=v_event.product_id
      and catalog_revision like 'legacy-backfill-v1:%'
    order by created_at desc,id desc
    limit 1;
  end if;

  if v_intake.id is not null
    and v_intake.catalog_revision like 'legacy-backfill-v1:%'
  then
    if v_event.research_task_id is null then
      v_disposition := 'NOOP';
      v_reason := 'LEGACY_IDENTITY_SNAPSHOT_PRESERVED';
    elsif v_task.id is null then
      v_disposition := 'BLOCKED';
      v_reason := 'RESEARCH_TASK_NOT_FOUND';
    elsif v_task.state in ('EVIDENCE_CANDIDATE','PREFLIGHT_READY','CONFIRMED','ALREADY_COVERED') then
      v_disposition := 'NOOP';
      v_reason := 'GOVERNED_OR_COVERED_STATE_PRESERVED';
    elsif v_intake.identity_state <> 'EXACT_SUBJECT_FOUND' or v_task.subject_id is null then
      v_disposition := case when v_intake.trust_state='BLOCKED' then 'BLOCKED' else 'REVIEW_REQUIRED' end;
      v_reason := coalesce(v_task.blocker_code,v_intake.identity_state,'IDENTITY_REVALIDATION_REQUIRED');
    elsif v_task.state in ('BLOCKED','REVIEW_REQUIRED')
      and (
        v_task.blocker_code in ('SOURCE_BLOCKED','EVIDENCE_INSUFFICIENT')
        or (v_task.blocker_code = 'PARENT_PROPOSITION_REQUIRED' and exists (
              select 1
              from public.product_fact_definition_snapshots d
              join public.product_fact_current pc on pc.subject_id = v_task.subject_id
              join public.product_fact_instances pfi on pfi.fact_instance_id = pc.fact_instance_id
              where d.registry_version = v_task.registry_version
                and d.fact_key = v_task.fact_key
                and d.deprecated = false
                and coalesce((d.definition #>> '{relationship_schema,subject_ref_required}')::boolean, false)
                and pfi.subject_id = v_task.subject_id
                and pfi.registry_version = v_task.registry_version
                and pfi.fact_key = d.definition #>> '{relationship_schema,subject_ref_fact_key}'
                and pfi.semantic_status = 'supported'
            ))
      )
    then
      if not public.trust_phase7c_legacy_subject_scope_ready_v1(v_task.id) then
        v_disposition := 'REVIEW_REQUIRED';
        v_reason := 'LEGACY_SUBJECT_SCOPE_BLOCKED';
      elsif not public.trust_phase7c_has_controlled_official_source_v1(v_task.id) then
        v_disposition := 'REVIEW_REQUIRED';
        v_reason := 'OFFICIAL_SOURCE_REQUIRED';
      else
        update public.product_fact_research_tasks
        set state='RESEARCH_PENDING',
            blocker_code=null,
            blocker_detail=null,
            next_retry_at=now(),
            completed_at=null,
            updated_at=now()
        where id=v_task.id;

        v_disposition := 'RESEARCH_REQUEUED';
        v_reason := 'LEGACY_MANUAL_RETRY_READY';
      end if;
    else
      v_disposition := 'NOOP';
      v_reason := 'MANUAL_RETRY_NOT_ELIGIBLE_FOR_FORCE_RESET';
    end if;
  else
    perform public.process_catalog_trust_product_v1(v_event.product_id);

    if v_event.research_task_id is null then
      v_disposition := 'NOOP';
      v_reason := 'MANUAL_REVALIDATION_PRODUCT_REFRESHED';
    else
      if v_task.id is null then
        select * into v_task
        from public.product_fact_research_tasks
        where id=v_event.research_task_id
        for update;
      end if;

      if v_task.id is null then
        v_disposition := 'BLOCKED';
        v_reason := 'RESEARCH_TASK_NOT_FOUND';
      else
        if v_intake.id is null then
          select * into v_intake
          from public.catalog_trust_intake
          where id=v_task.intake_id;
        end if;

        if v_task.state in ('EVIDENCE_CANDIDATE','PREFLIGHT_READY','CONFIRMED','ALREADY_COVERED') then
          v_disposition := 'NOOP';
          v_reason := 'GOVERNED_OR_COVERED_STATE_PRESERVED';
        elsif v_intake.identity_state <> 'EXACT_SUBJECT_FOUND' or v_task.subject_id is null then
          v_disposition := case when v_intake.trust_state='BLOCKED' then 'BLOCKED' else 'REVIEW_REQUIRED' end;
          v_reason := coalesce(v_task.blocker_code,v_intake.identity_state,'IDENTITY_REVALIDATION_REQUIRED');
        elsif v_task.state in ('BLOCKED','REVIEW_REQUIRED')
          and (
            v_task.blocker_code in ('SOURCE_BLOCKED','EVIDENCE_INSUFFICIENT')
            or (v_task.blocker_code = 'PARENT_PROPOSITION_REQUIRED' and exists (
              select 1
              from public.product_fact_definition_snapshots d
              join public.product_fact_current pc on pc.subject_id = v_task.subject_id
              join public.product_fact_instances pfi on pfi.fact_instance_id = pc.fact_instance_id
              where d.registry_version = v_task.registry_version
                and d.fact_key = v_task.fact_key
                and d.deprecated = false
                and coalesce((d.definition #>> '{relationship_schema,subject_ref_required}')::boolean, false)
                and pfi.subject_id = v_task.subject_id
                and pfi.registry_version = v_task.registry_version
                and pfi.fact_key = d.definition #>> '{relationship_schema,subject_ref_fact_key}'
                and pfi.semantic_status = 'supported'
            ))
          )
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
          v_reason := case
            when v_task.blocker_code = 'PARENT_PROPOSITION_REQUIRED'
              then 'MANUAL_RETRY_ELIGIBLE_RELATIONAL_PARENT'
            else 'MANUAL_RETRY_ELIGIBLE_RESEARCH_BLOCKER'
          end;
        else
          v_disposition := 'NOOP';
          v_reason := 'MANUAL_RETRY_NOT_ELIGIBLE_FOR_FORCE_RESET';
        end if;
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
$function$;


revoke all on function public.request_trust_reentry_v1(text,uuid,uuid,uuid,text,uuid,text,jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.request_trust_reentry_v1(text,uuid,uuid,uuid,text,uuid,text,jsonb)
  to service_role;

revoke all on function public.process_trust_reentry_event_v1(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.process_trust_reentry_event_v1(uuid)
  to service_role;

comment on table public.trust_official_source_transport_drift_cases is
  'TRUST Phase 8I-3 immutable operational transport-drift cases deduplicated across Evidence Source identities; no Product Fact or relocation authority.';
comment on table public.trust_official_source_transport_drift_case_incidents is
  'TRUST Phase 8I-3 append-only lineage from governed transport-drift cases to Phase 8I-2 confirmed incidents.';
comment on table public.trust_official_source_transport_drift_evaluations is
  'TRUST Phase 8I-3 append-only evaluation ledger. READY_FOR_8I4 is candidate readiness only, never relocation authority.';
comment on function public.enqueue_trust_official_source_transport_drift_cases_v1(integer) is
  'Service-role-only idempotent Phase 8I-3 bridge from confirmed transport incidents to deduplicated cases and SOURCE_TRANSPORT_DRIFT re-entry events.';
comment on function public.record_trust_official_source_transport_drift_evaluation_v1(
  text,uuid,text,text,text,text,text,text,text,text,jsonb
) is
  'Service-role-only append boundary for Phase 8I-3 qualification/rediscovery evaluation results; never mutates Product Fact or relocation authority.';
