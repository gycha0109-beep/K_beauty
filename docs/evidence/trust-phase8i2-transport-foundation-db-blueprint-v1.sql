begin;

-- TRUST Phase 8I-2A: current-dependent official-source transport foundation.
-- This slice observes external transport state only. It does not mutate
-- historical Evidence Source identity, Product Fact Current, confirmations,
-- reviewed source bindings, or relocation authority.

create table public.trust_official_source_transport_observations (
  observation_id uuid primary key default gen_random_uuid(),
  request_id text not null,
  probe_group_id text not null,
  source_id uuid not null references public.product_evidence_sources(source_id),
  target_key text not null,
  historical_locator text not null,
  effective_locator text not null,
  relocation_id uuid references public.trust_official_source_relocations(relocation_id),
  replacement_binding_id uuid references public.product_source_bindings(binding_id),
  transport_result text not null,
  http_status integer,
  final_locator text,
  redirect_chain jsonb not null default '[]'::jsonb,
  checked_at timestamptz not null,
  worker_version text not null,
  transport_metadata jsonb not null default '{}'::jsonb,
  payload_digest text not null,
  created_at timestamptz not null default now(),
  unique(request_id,source_id),
  check (char_length(request_id) between 1 and 220),
  check (char_length(probe_group_id) between 1 and 220),
  check (target_key ~ '^official-transport-url-sha256:[0-9a-f]{64}$'),
  check (historical_locator ~ '^https://[^[:space:]#]+$'),
  check (effective_locator ~ '^https://[^[:space:]#]+$'),
  check (final_locator is null or final_locator ~ '^https://[^[:space:]#]+$'),
  check (transport_result in ('HEALTHY','REDIRECTED','MISSING','TRANSIENT','BLOCKED')),
  check (http_status is null or http_status between 100 and 599),
  check (jsonb_typeof(redirect_chain)='array'),
  check (jsonb_typeof(transport_metadata)='object'),
  check (payload_digest ~ '^[0-9a-f]{64}$'),
  check (
    transport_result not in ('HEALTHY','REDIRECTED')
    or (
      http_status between 200 and 299
      and final_locator is not null
    )
  ),
  check (
    transport_result <> 'HEALTHY'
    or jsonb_array_length(redirect_chain)=0
  ),
  check (
    transport_result <> 'REDIRECTED'
    or (
      jsonb_array_length(redirect_chain)>0
      and final_locator is distinct from effective_locator
    )
  ),
  check (
    transport_result <> 'MISSING'
    or http_status in (404,410)
  )
);

alter table public.trust_official_source_transport_observations enable row level security;
revoke all on table public.trust_official_source_transport_observations
  from public, anon, authenticated, service_role;

create index trust_official_source_transport_observations_source_checked_idx
  on public.trust_official_source_transport_observations(source_id,target_key,checked_at desc,created_at desc);

create index trust_official_source_transport_observations_target_checked_idx
  on public.trust_official_source_transport_observations(target_key,checked_at desc,created_at desc);

create table public.trust_official_source_transport_incidents (
  incident_id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.product_evidence_sources(source_id),
  target_key text not null,
  incident_kind text not null,
  first_observation_id uuid not null references public.trust_official_source_transport_observations(observation_id),
  second_observation_id uuid not null references public.trust_official_source_transport_observations(observation_id),
  effective_locator text not null,
  confirmed_final_locator text,
  episode_started_at timestamptz not null,
  confirmed_at timestamptz not null,
  incident_detail jsonb not null default '{}'::jsonb,
  incident_digest text not null unique,
  created_at timestamptz not null default now(),
  unique(first_observation_id,incident_kind),
  check (target_key ~ '^official-transport-url-sha256:[0-9a-f]{64}$'),
  check (incident_kind in ('CONFIRMED_REDIRECT','CONFIRMED_MISSING')),
  check (effective_locator ~ '^https://[^[:space:]#]+$'),
  check (confirmed_final_locator is null or confirmed_final_locator ~ '^https://[^[:space:]#]+$'),
  check (jsonb_typeof(incident_detail)='object'),
  check (incident_digest ~ '^[0-9a-f]{64}$'),
  check (second_observation_id <> first_observation_id),
  check (confirmed_at >= episode_started_at + interval '30 minutes'),
  check (
    (incident_kind='CONFIRMED_REDIRECT' and confirmed_final_locator is not null)
    or (incident_kind='CONFIRMED_MISSING' and confirmed_final_locator is null)
  )
);

alter table public.trust_official_source_transport_incidents enable row level security;
revoke all on table public.trust_official_source_transport_incidents
  from public, anon, authenticated, service_role;

create index trust_official_source_transport_incidents_source_idx
  on public.trust_official_source_transport_incidents(source_id,target_key,confirmed_at desc);

create or replace function public.trust_official_source_transport_targets_v1()
returns table (
  source_id uuid,
  current_dependency_count bigint,
  product_ids jsonb,
  subject_ids jsonb,
  publisher text,
  source_kind text,
  market text,
  locale text,
  historical_locator text,
  effective_locator text,
  target_key text,
  relocation_id uuid,
  replacement_binding_id uuid,
  verification_profile_id uuid,
  comparability_state text,
  target_status text
)
language sql
security definer
set search_path = ''
as $$
  with dependencies as (
    select
      e.source_id,
      count(distinct c.proposition_key)::bigint as current_dependency_count,
      to_jsonb(array_agg(distinct s.product_id order by s.product_id)) as product_ids,
      to_jsonb(array_agg(distinct e.subject_id order by e.subject_id)) as subject_ids
    from public.product_fact_current c
    join public.product_evidence_records e
      on e.proposition_key=c.proposition_key
     and e.subject_id=c.subject_id
     and e.support_direction='supports'
    join public.product_fact_subjects s
      on s.subject_id=e.subject_id
    group by e.source_id
  ),
  fleet as (
    select
      src.source_id,
      d.current_dependency_count,
      d.product_ids,
      d.subject_ids,
      src.publisher,
      src.source_kind,
      src.market,
      src.locale,
      src.canonical_locator as historical_locator,
      rel.relocation_id,
      rel.replacement_binding_id,
      rel.replacement_locator,
      rb.binding_id as live_replacement_binding_id,
      rb.source_url as live_replacement_url,
      rb.binding_state as live_replacement_state,
      rb.product_id as live_replacement_product_id,
      rel.product_id as relocation_product_id,
      prof.profile_id as verification_profile_id,
      prof.comparability_state
    from dependencies d
    join public.product_evidence_sources src
      on src.source_id=d.source_id
    left join lateral (
      select
        r.relocation_id,
        r.replacement_binding_id,
        r.replacement_locator,
        r.product_id,
        r.created_at
      from public.trust_official_source_relocations r
      where r.historical_source_id=src.source_id
        and r.result='confirmed'
      order by r.created_at desc,r.relocation_id desc
      limit 1
    ) rel on true
    left join public.product_source_bindings rb
      on rb.binding_id=rel.replacement_binding_id
    left join lateral (
      select p.profile_id,p.comparability_state,p.created_at
      from public.product_evidence_source_verification_profiles p
      where p.source_id=src.source_id
      order by p.created_at desc,p.profile_id desc
      limit 1
    ) prof on true
    where src.source_kind in (
      'official_product_page',
      'brand_official_product_page',
      'brand_official_technical_document',
      'manufacturer_official_document',
      'official_market_sales_page'
    )
  ),
  resolved as (
    select
      f.*,
      case
        when f.relocation_id is null then f.historical_locator
        else f.replacement_locator
      end as effective_locator,
      case
        when f.relocation_id is null then 'READY'
        when f.live_replacement_binding_id is not null
          and f.live_replacement_state='resolved'
          and f.live_replacement_url is not distinct from f.replacement_locator
          and f.live_replacement_product_id is not distinct from f.relocation_product_id
          then 'READY'
        else 'DB_INVARIANT_BLOCKED'
      end as target_status
    from fleet f
  )
  select
    r.source_id,
    r.current_dependency_count,
    r.product_ids,
    r.subject_ids,
    r.publisher,
    r.source_kind,
    r.market,
    r.locale,
    r.historical_locator,
    r.effective_locator,
    'official-transport-url-sha256:' ||
      encode(
        extensions.digest(convert_to(r.effective_locator,'UTF8'),'sha256'),
        'hex'
      ) as target_key,
    r.relocation_id,
    r.replacement_binding_id,
    r.verification_profile_id,
    r.comparability_state,
    r.target_status
  from resolved r
  order by r.source_id;
$$;

revoke all on function public.trust_official_source_transport_targets_v1()
  from public, anon, authenticated, service_role;

create or replace function public.get_trust_official_source_transport_targets_v1()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  with targets as (
    select * from public.trust_official_source_transport_targets_v1()
  )
  select jsonb_build_object(
    'contract','trust-official-source-transport-targets-v1',
    'source_count',(select count(*) from targets),
    'ready_source_count',(select count(*) from targets where target_status='READY'),
    'blocked_source_count',(select count(*) from targets where target_status<>'READY'),
    'unique_ready_target_count',(
      select count(distinct target_key)
      from targets
      where target_status='READY'
    ),
    'targets',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'source_id',source_id,
          'current_dependency_count',current_dependency_count,
          'product_ids',product_ids,
          'subject_ids',subject_ids,
          'publisher',publisher,
          'source_kind',source_kind,
          'market',market,
          'locale',locale,
          'historical_locator',historical_locator,
          'effective_locator',effective_locator,
          'target_key',target_key,
          'relocation_id',relocation_id,
          'replacement_binding_id',replacement_binding_id,
          'verification_profile_id',verification_profile_id,
          'comparability_state',comparability_state,
          'target_status',target_status
        )
        order by source_id
      )
      from targets
    ),'[]'::jsonb)
  );
$$;

revoke all on function public.get_trust_official_source_transport_targets_v1()
  from public, anon, authenticated, service_role;
grant execute on function public.get_trust_official_source_transport_targets_v1()
  to service_role;

create or replace function public.record_trust_official_source_transport_observation_v1(
  p_request_id text,
  p_probe_group_id text,
  p_source_id uuid,
  p_target_key text,
  p_transport_result text,
  p_http_status integer,
  p_final_locator text,
  p_redirect_chain jsonb,
  p_checked_at timestamptz,
  p_worker_version text,
  p_transport_metadata jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_id text := btrim(coalesce(p_request_id,''));
  v_probe_group_id text := btrim(coalesce(p_probe_group_id,''));
  v_target record;
  v_existing public.trust_official_source_transport_observations%rowtype;
  v_observation public.trust_official_source_transport_observations%rowtype;
  v_latest_checked_at timestamptz;
  v_result text := upper(btrim(coalesce(p_transport_result,'')));
  v_final_locator text := nullif(btrim(coalesce(p_final_locator,'')),'');
  v_redirect_chain jsonb := coalesce(p_redirect_chain,'[]'::jsonb);
  v_metadata jsonb := coalesce(p_transport_metadata,'{}'::jsonb);
  v_worker_version text := btrim(coalesce(p_worker_version,''));
  v_payload jsonb;
  v_payload_digest text;
  v_break_at timestamptz;
  v_episode_start public.trust_official_source_transport_observations%rowtype;
  v_incident_kind text;
  v_incident public.trust_official_source_transport_incidents%rowtype;
  v_incident_payload jsonb;
  v_incident_digest text;
  v_existing_incident public.trust_official_source_transport_incidents%rowtype;
begin
  if v_request_id='' or char_length(v_request_id)>220
    or v_probe_group_id='' or char_length(v_probe_group_id)>220
    or p_source_id is null
    or p_target_key !~ '^official-transport-url-sha256:[0-9a-f]{64}$'
    or v_result not in ('HEALTHY','REDIRECTED','MISSING','TRANSIENT','BLOCKED')
    or p_checked_at is null
    or v_worker_version='' or char_length(v_worker_version)>120
    or jsonb_typeof(v_redirect_chain) <> 'array'
    or jsonb_typeof(v_metadata) <> 'object'
  then
    raise exception 'trust_transport_observation_payload_invalid' using errcode='22023';
  end if;

  if p_http_status is not null and (p_http_status < 100 or p_http_status > 599) then
    raise exception 'trust_transport_http_status_invalid' using errcode='22023';
  end if;

  if v_final_locator is not null and v_final_locator !~ '^https://[^[:space:]#]+$' then
    raise exception 'trust_transport_final_locator_invalid' using errcode='22023';
  end if;

  if v_result in ('HEALTHY','REDIRECTED')
    and (
      p_http_status is null
      or p_http_status < 200
      or p_http_status > 299
      or v_final_locator is null
    )
  then
    raise exception 'trust_transport_success_shape_invalid' using errcode='23514';
  end if;

  if v_result='HEALTHY' and jsonb_array_length(v_redirect_chain)<>0 then
    raise exception 'trust_transport_healthy_redirect_chain_invalid' using errcode='23514';
  end if;

  if v_result='REDIRECTED'
    and (
      jsonb_array_length(v_redirect_chain)=0
      or v_final_locator is null
    )
  then
    raise exception 'trust_transport_redirect_shape_invalid' using errcode='23514';
  end if;

  if v_result='MISSING' and p_http_status not in (404,410) then
    raise exception 'trust_transport_missing_status_invalid' using errcode='23514';
  end if;

  select * into v_existing
  from public.trust_official_source_transport_observations o
  where o.request_id=v_request_id
    and o.source_id=p_source_id;

  if found then
    if v_existing.probe_group_id is distinct from v_probe_group_id
      or v_existing.target_key is distinct from p_target_key
      or v_existing.transport_result is distinct from v_result
      or v_existing.http_status is distinct from p_http_status
      or v_existing.final_locator is distinct from v_final_locator
      or v_existing.redirect_chain is distinct from v_redirect_chain
      or v_existing.checked_at is distinct from p_checked_at
      or v_existing.worker_version is distinct from v_worker_version
      or v_existing.transport_metadata is distinct from v_metadata
    then
      raise exception 'trust_transport_observation_idempotency_conflict' using errcode='23505';
    end if;

    select * into v_existing_incident
    from public.trust_official_source_transport_incidents i
    where i.second_observation_id=v_existing.observation_id
    order by i.created_at desc
    limit 1;

    return jsonb_build_object(
      'status','recorded',
      'idempotent',true,
      'observation_id',v_existing.observation_id,
      'incident_created',false,
      'incident_id',v_existing_incident.incident_id,
      'transport_result',v_existing.transport_result
    );
  end if;

  select * into v_target
  from public.trust_official_source_transport_targets_v1() t
  where t.source_id=p_source_id;

  if not found then
    raise exception 'trust_transport_source_not_in_current_fleet' using errcode='23514';
  end if;

  if v_target.target_status <> 'READY' then
    raise exception 'trust_transport_target_db_invariant_blocked' using errcode='23514';
  end if;

  if v_target.target_key is distinct from p_target_key then
    raise exception 'trust_transport_target_stale' using errcode='40001';
  end if;

  if v_result='REDIRECTED' and v_final_locator is not distinct from v_target.effective_locator then
    raise exception 'trust_transport_redirect_final_locator_not_changed' using errcode='23514';
  end if;

  select max(o.checked_at) into v_latest_checked_at
  from public.trust_official_source_transport_observations o
  where o.source_id=p_source_id
    and o.target_key=p_target_key;

  if v_latest_checked_at is not null and p_checked_at < v_latest_checked_at then
    raise exception 'trust_transport_observation_out_of_order' using errcode='40001';
  end if;

  v_payload := jsonb_build_object(
    'contract','trust-official-source-transport-observation-v1',
    'request_id',v_request_id,
    'probe_group_id',v_probe_group_id,
    'source_id',p_source_id,
    'target_key',p_target_key,
    'historical_locator',v_target.historical_locator,
    'effective_locator',v_target.effective_locator,
    'relocation_id',v_target.relocation_id,
    'replacement_binding_id',v_target.replacement_binding_id,
    'transport_result',v_result,
    'http_status',p_http_status,
    'final_locator',v_final_locator,
    'redirect_chain',v_redirect_chain,
    'checked_at',p_checked_at,
    'worker_version',v_worker_version,
    'transport_metadata',v_metadata
  );

  v_payload_digest := encode(
    extensions.digest(
      convert_to(public.trust_phase8h_canonical_json_text_v1(v_payload),'UTF8'),
      'sha256'
    ),
    'hex'
  );

  insert into public.trust_official_source_transport_observations(
    request_id,probe_group_id,source_id,target_key,
    historical_locator,effective_locator,relocation_id,replacement_binding_id,
    transport_result,http_status,final_locator,redirect_chain,
    checked_at,worker_version,transport_metadata,payload_digest
  ) values (
    v_request_id,v_probe_group_id,p_source_id,p_target_key,
    v_target.historical_locator,v_target.effective_locator,
    v_target.relocation_id,v_target.replacement_binding_id,
    v_result,p_http_status,v_final_locator,v_redirect_chain,
    p_checked_at,v_worker_version,v_metadata,v_payload_digest
  )
  returning * into v_observation;

  if v_result in ('REDIRECTED','MISSING') then
    v_incident_kind := case
      when v_result='REDIRECTED' then 'CONFIRMED_REDIRECT'
      else 'CONFIRMED_MISSING'
    end;

    select max(o.checked_at) into v_break_at
    from public.trust_official_source_transport_observations o
    where o.source_id=p_source_id
      and o.target_key=p_target_key
      and o.observation_id<>v_observation.observation_id
      and o.checked_at<=p_checked_at
      and (
        (v_result='REDIRECTED' and not (
          o.transport_result='REDIRECTED'
          and o.final_locator is not distinct from v_final_locator
        ))
        or
        (v_result='MISSING' and o.transport_result<>'MISSING')
      );

    select * into v_episode_start
    from public.trust_official_source_transport_observations o
    where o.source_id=p_source_id
      and o.target_key=p_target_key
      and o.checked_at<=p_checked_at
      and (v_break_at is null or o.checked_at>v_break_at)
      and (
        (v_result='REDIRECTED'
          and o.transport_result='REDIRECTED'
          and o.final_locator is not distinct from v_final_locator)
        or
        (v_result='MISSING' and o.transport_result='MISSING')
      )
    order by o.checked_at,o.created_at,o.observation_id
    limit 1;

    if found
      and v_episode_start.observation_id<>v_observation.observation_id
      and v_episode_start.probe_group_id<>v_probe_group_id
      and p_checked_at >= v_episode_start.checked_at + interval '30 minutes'
      and not exists (
        select 1
        from public.trust_official_source_transport_incidents i
        where i.first_observation_id=v_episode_start.observation_id
          and i.incident_kind=v_incident_kind
      )
    then
      v_incident_payload := jsonb_build_object(
        'contract','trust-official-source-transport-incident-v1',
        'source_id',p_source_id,
        'target_key',p_target_key,
        'incident_kind',v_incident_kind,
        'first_observation_id',v_episode_start.observation_id,
        'second_observation_id',v_observation.observation_id,
        'effective_locator',v_target.effective_locator,
        'confirmed_final_locator',case when v_result='REDIRECTED' then v_final_locator else null end,
        'episode_started_at',v_episode_start.checked_at,
        'confirmed_at',p_checked_at
      );

      v_incident_digest := encode(
        extensions.digest(
          convert_to(public.trust_phase8h_canonical_json_text_v1(v_incident_payload),'UTF8'),
          'sha256'
        ),
        'hex'
      );

      insert into public.trust_official_source_transport_incidents(
        source_id,target_key,incident_kind,
        first_observation_id,second_observation_id,
        effective_locator,confirmed_final_locator,
        episode_started_at,confirmed_at,
        incident_detail,incident_digest
      ) values (
        p_source_id,p_target_key,v_incident_kind,
        v_episode_start.observation_id,v_observation.observation_id,
        v_target.effective_locator,
        case when v_result='REDIRECTED' then v_final_locator else null end,
        v_episode_start.checked_at,p_checked_at,
        jsonb_build_object(
          'authority','TRANSPORT_SIGNAL_ONLY_NO_PRODUCT_FACT_MUTATION',
          'minimum_independent_interval_minutes',30,
          'first_probe_group_id',v_episode_start.probe_group_id,
          'second_probe_group_id',v_probe_group_id
        ),
        v_incident_digest
      )
      returning * into v_incident;
    end if;
  end if;

  return jsonb_build_object(
    'status','recorded',
    'idempotent',false,
    'observation_id',v_observation.observation_id,
    'incident_created',v_incident.incident_id is not null,
    'incident_id',v_incident.incident_id,
    'transport_result',v_observation.transport_result
  );
end;
$$;

revoke all on function public.record_trust_official_source_transport_observation_v1(
  text,text,uuid,text,text,integer,text,jsonb,timestamptz,text,jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.record_trust_official_source_transport_observation_v1(
  text,text,uuid,text,text,integer,text,jsonb,timestamptz,text,jsonb
) to service_role;

comment on table public.trust_official_source_transport_observations is
  'TRUST Phase 8I-2 append-only transport observations for Current-dependent official Evidence Sources. Transport state is not Product Fact authority.';

comment on table public.trust_official_source_transport_incidents is
  'TRUST Phase 8I-2 append-only confirmed transport drift incidents. Incidents require independent repeated REDIRECTED or MISSING observations and do not confirm relocation.';

comment on function public.get_trust_official_source_transport_targets_v1() is
  'TRUST Phase 8I-2 read-only service-role resolver for Current-dependent official Evidence Source transport targets.';

comment on function public.record_trust_official_source_transport_observation_v1(
  text,text,uuid,text,text,integer,text,jsonb,timestamptz,text,jsonb
) is
  'TRUST Phase 8I-2 service-role recorder. Appends transport observations and may append one confirmed incident per anomaly episode after 30 minutes; never mutates Product Fact or relocation authority.';

commit;
