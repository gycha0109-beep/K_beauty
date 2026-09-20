begin;

-- TRUST Phase 6-B: concrete drift detectors feeding the Phase 6-A re-entry
-- event boundary. Detector checkpoints are operational cursor state only.
-- They are not Product Fact authority and never invalidate Current.

create table public.trust_reentry_detector_checkpoints (
  checkpoint_id uuid primary key default gen_random_uuid(),
  detector_key text not null check (
    detector_key in (
      'OFFICIAL_SOURCE_SET',
      'SOURCE_OBSERVATION_DIGEST',
      'IDENTITY_SCOPE',
      'REQUIRED_FACT_POLICY',
      'PRODUCT_FACT_REGISTRY'
    )
  ),
  scope_key text not null,
  product_id uuid not null references public.products(id) on delete restrict,
  intake_id uuid references public.catalog_trust_intake(id) on delete restrict,
  research_task_id uuid references public.product_fact_research_tasks(id) on delete restrict,
  signal_fingerprint text not null check (signal_fingerprint ~ '^[0-9a-f]{64}$'),
  signal_payload jsonb not null check (jsonb_typeof(signal_payload) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (detector_key, scope_key)
);

create index trust_reentry_detector_checkpoints_product_idx
  on public.trust_reentry_detector_checkpoints(product_id, detector_key);
create index trust_reentry_detector_checkpoints_intake_idx
  on public.trust_reentry_detector_checkpoints(intake_id, detector_key)
  where intake_id is not null;
create index trust_reentry_detector_checkpoints_task_idx
  on public.trust_reentry_detector_checkpoints(research_task_id, detector_key)
  where research_task_id is not null;

alter table public.trust_reentry_detector_checkpoints enable row level security;
revoke all on table public.trust_reentry_detector_checkpoints
  from public, anon, authenticated, service_role;

comment on table public.trust_reentry_detector_checkpoints is
  'TRUST Phase 6-B operational drift-detector cursor. Not Product Fact authority or evidence.';

create or replace function public.hash_trust_reentry_signal_v1(p_payload jsonb)
returns text
language sql
immutable
set search_path = public, extensions, pg_temp
as $$
  select encode(
    extensions.digest(
      convert_to(coalesce(p_payload, '{}'::jsonb)::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  );
$$;

revoke all on function public.hash_trust_reentry_signal_v1(jsonb)
  from public, anon, authenticated, service_role;

create or replace function public.observe_trust_reentry_signal_v1(
  p_detector_key text,
  p_scope_key text,
  p_event_type text,
  p_product_id uuid,
  p_intake_id uuid,
  p_research_task_id uuid,
  p_signal_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_detector_key text := upper(btrim(coalesce(p_detector_key,'')));
  v_scope_key text := btrim(coalesce(p_scope_key,''));
  v_event_type text := upper(btrim(coalesce(p_event_type,'')));
  v_payload jsonb := coalesce(p_signal_payload,'{}'::jsonb);
  v_fingerprint text;
  v_event_fingerprint text;
  v_checkpoint public.trust_reentry_detector_checkpoints%rowtype;
  v_request jsonb;
  v_processed jsonb;
begin
  if v_detector_key not in (
    'OFFICIAL_SOURCE_SET',
    'SOURCE_OBSERVATION_DIGEST',
    'IDENTITY_SCOPE',
    'REQUIRED_FACT_POLICY',
    'PRODUCT_FACT_REGISTRY'
  ) then
    raise exception 'trust_reentry_detector_key_invalid' using errcode='22023';
  end if;
  if v_event_type not in (
    'SOURCE_CHANGED','FORMULATION_CHANGED','POLICY_CHANGED','REGISTRY_CHANGED'
  ) then
    raise exception 'trust_reentry_detector_event_type_invalid' using errcode='22023';
  end if;
  if p_product_id is null or v_scope_key = '' or jsonb_typeof(v_payload) <> 'object' then
    raise exception 'trust_reentry_detector_identity_invalid' using errcode='22023';
  end if;
  if not exists(select 1 from public.products where id=p_product_id) then
    raise exception 'trust_reentry_detector_product_not_found' using errcode='P0002';
  end if;
  if p_intake_id is not null and not exists(
    select 1 from public.catalog_trust_intake
    where id=p_intake_id and product_id=p_product_id
  ) then
    raise exception 'trust_reentry_detector_intake_mismatch' using errcode='22023';
  end if;
  if p_research_task_id is not null and not exists(
    select 1 from public.product_fact_research_tasks
    where id=p_research_task_id
      and product_id=p_product_id
      and (p_intake_id is null or intake_id=p_intake_id)
  ) then
    raise exception 'trust_reentry_detector_task_mismatch' using errcode='22023';
  end if;

  v_fingerprint := public.hash_trust_reentry_signal_v1(v_payload);
  perform pg_advisory_xact_lock(
    hashtextextended('bejewely_trust_reentry_detector:' || v_detector_key || ':' || v_scope_key,0)
  );

  select * into v_checkpoint
  from public.trust_reentry_detector_checkpoints
  where detector_key=v_detector_key and scope_key=v_scope_key
  for update;

  if not found then
    insert into public.trust_reentry_detector_checkpoints (
      detector_key,scope_key,product_id,intake_id,research_task_id,
      signal_fingerprint,signal_payload
    ) values (
      v_detector_key,v_scope_key,p_product_id,p_intake_id,p_research_task_id,
      v_fingerprint,v_payload
    );

    return jsonb_build_object(
      'status','baselined',
      'detector_key',v_detector_key,
      'scope_key',v_scope_key,
      'signal_fingerprint',v_fingerprint,
      'event_emitted',false
    );
  end if;

  if v_checkpoint.product_id <> p_product_id
    or v_checkpoint.intake_id is distinct from p_intake_id
    or v_checkpoint.research_task_id is distinct from p_research_task_id
  then
    raise exception 'trust_reentry_detector_scope_collision' using errcode='23505';
  end if;

  if v_checkpoint.signal_fingerprint = v_fingerprint then
    return jsonb_build_object(
      'status','no_change',
      'detector_key',v_detector_key,
      'scope_key',v_scope_key,
      'signal_fingerprint',v_fingerprint,
      'event_emitted',false
    );
  end if;

  v_event_fingerprint := public.hash_trust_reentry_signal_v1(
    jsonb_build_object(
      'contract','trust-reentry-detector-event-v1',
      'detector_key',v_detector_key,
      'scope_key',v_scope_key,
      'event_type',v_event_type,
      'previous_fingerprint',v_checkpoint.signal_fingerprint,
      'current_fingerprint',v_fingerprint
    )
  );

  v_request := public.request_trust_reentry_v1(
    v_event_type,
    p_product_id,
    p_intake_id,
    p_research_task_id,
    v_event_fingerprint,
    null,
    null,
    jsonb_build_object(
      'phase','6-B',
      'detector_key',v_detector_key,
      'scope_key',v_scope_key,
      'previous_fingerprint',v_checkpoint.signal_fingerprint,
      'current_fingerprint',v_fingerprint,
      'previous_signal',v_checkpoint.signal_payload,
      'current_signal',v_payload
    )
  );

  v_processed := public.process_trust_reentry_event_v1((v_request->>'event_id')::uuid);

  if v_processed->>'disposition' <> 'REVIEW_REQUIRED'
    or coalesce((v_processed->>'authority_mutation')::boolean,true)
    or coalesce((v_processed->>'current_invalidated')::boolean,true)
  then
    raise exception 'trust_reentry_detector_event_processing_invalid:%',v_processed
      using errcode='23514';
  end if;

  update public.trust_reentry_detector_checkpoints
  set signal_fingerprint=v_fingerprint,
      signal_payload=v_payload,
      updated_at=now()
  where checkpoint_id=v_checkpoint.checkpoint_id;

  return jsonb_build_object(
    'status','emitted',
    'detector_key',v_detector_key,
    'scope_key',v_scope_key,
    'previous_fingerprint',v_checkpoint.signal_fingerprint,
    'current_fingerprint',v_fingerprint,
    'event_id',v_request->>'event_id',
    'event_type',v_event_type,
    'event_disposition',v_processed->>'disposition',
    'event_emitted',true
  );
end;
$$;

revoke all on function public.observe_trust_reentry_signal_v1(
  text,text,text,uuid,uuid,uuid,jsonb
) from public, anon, authenticated, service_role;

comment on function public.observe_trust_reentry_signal_v1(
  text,text,text,uuid,uuid,uuid,jsonb
) is
  'Private Phase 6-B checkpoint/re-entry bridge. First signal baselines; only drift emits a review-only Phase 6-A event.';

create or replace function public.run_trust_reentry_detectors_v1(
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_intake public.catalog_trust_intake%rowtype;
  v_task public.product_fact_research_tasks%rowtype;
  v_source_payload jsonb;
  v_identity_payload jsonb;
  v_policy_payload jsonb;
  v_registry_payload jsonb;
  v_digest_payload jsonb;
  v_required_facts jsonb;
  v_candidate_payload jsonb;
  v_subject_payload jsonb;
  v_registry public.product_fact_registry_versions%rowtype;
  v_result jsonb;
  v_results jsonb := '[]'::jsonb;
  v_baselined integer := 0;
  v_no_change integer := 0;
  v_emitted integer := 0;
  v_intakes_scanned integer := 0;
  v_tasks_scanned integer := 0;
begin
  if p_limit is null or p_limit < 1 or p_limit > 1000 then
    raise exception 'trust_reentry_detector_limit_invalid' using errcode='22023';
  end if;

  select * into v_registry
  from public.product_fact_registry_versions
  order by effective_at desc nulls last, created_at desc
  limit 1;

  for v_intake in
    select *
    from public.catalog_trust_intake
    order by created_at,id
    limit p_limit
  loop
    v_intakes_scanned := v_intakes_scanned + 1;

    select jsonb_build_object(
      'market',v_intake.market,
      'official_sources',coalesce(jsonb_agg(
        jsonb_build_object(
          'binding_id',b.binding_id,
          'source_name',b.source_name,
          'external_type',b.external_type,
          'external_id',b.external_id,
          'source_url',b.source_url,
          'market_code',b.market_code,
          'locale',b.locale,
          'binding_method',b.binding_method,
          'product_scope_state',b.product_scope_state
        )
        order by b.source_name,b.external_type,b.external_id,b.binding_id
      ) filter (where b.binding_id is not null),'[]'::jsonb)
    )
    into v_source_payload
    from public.product_source_bindings b
    where b.product_id=v_intake.product_id
      and b.binding_state='resolved'
      and b.source_name ~ '_official$'
      and b.source_url ~ '^https://';

    if v_source_payload is null then
      v_source_payload := jsonb_build_object(
        'market',v_intake.market,
        'official_sources','[]'::jsonb
      );
    end if;

    v_result := public.observe_trust_reentry_signal_v1(
      'OFFICIAL_SOURCE_SET',
      'intake:' || v_intake.id::text,
      'SOURCE_CHANGED',
      v_intake.product_id,
      v_intake.id,
      null,
      v_source_payload
    );
    if v_result->>'status'='baselined' then v_baselined:=v_baselined+1;
    elsif v_result->>'status'='no_change' then v_no_change:=v_no_change+1;
    elsif v_result->>'status'='emitted' then
      v_emitted:=v_emitted+1; v_results:=v_results || jsonb_build_array(v_result);
    end if;

    select jsonb_build_object(
      'identity_resolution_state',pc.identity_resolution_state,
      'identity_resolution_version',pc.identity_resolution_version,
      'identity_resolution_evidence',coalesce(pc.identity_resolution_evidence,'{}'::jsonb)
    )
    into v_candidate_payload
    from public.product_candidates pc
    where pc.id=v_intake.source_candidate_id;

    if v_candidate_payload is null then
      v_candidate_payload := 'null'::jsonb;
    end if;

    select coalesce(jsonb_agg(
      jsonb_build_object(
        'subject_id',s.subject_id,
        'variant_key',s.variant_key,
        'formulation_revision_key',s.formulation_revision_key,
        'identity_status',s.identity_status,
        'current_state',s.current_state,
        'market_applicability',s.market_applicability
      )
      order by s.subject_id
    ),'[]'::jsonb)
    into v_subject_payload
    from public.product_fact_subjects s
    where s.product_id=v_intake.product_id;

    v_identity_payload := jsonb_build_object(
      'intake_market',v_intake.market,
      'source_candidate_id',v_intake.source_candidate_id,
      'candidate_identity',v_candidate_payload,
      'subjects',v_subject_payload
    );

    v_result := public.observe_trust_reentry_signal_v1(
      'IDENTITY_SCOPE',
      'intake:' || v_intake.id::text,
      'FORMULATION_CHANGED',
      v_intake.product_id,
      v_intake.id,
      null,
      v_identity_payload
    );
    if v_result->>'status'='baselined' then v_baselined:=v_baselined+1;
    elsif v_result->>'status'='no_change' then v_no_change:=v_no_change+1;
    elsif v_result->>'status'='emitted' then
      v_emitted:=v_emitted+1; v_results:=v_results || jsonb_build_array(v_result);
    end if;

    select coalesce(jsonb_agg(
      jsonb_build_object('fact_key',p.fact_key,'priority',p.priority)
      order by p.priority,p.fact_key
    ),'[]'::jsonb)
    into v_required_facts
    from public.catalog_required_product_facts_v1(v_intake.category) p;

    v_policy_payload := jsonb_build_object(
      'category',v_intake.category,
      'required_fact_policy_version',v_intake.required_fact_policy_version,
      'required_facts',v_required_facts
    );

    v_result := public.observe_trust_reentry_signal_v1(
      'REQUIRED_FACT_POLICY',
      'intake:' || v_intake.id::text,
      'POLICY_CHANGED',
      v_intake.product_id,
      v_intake.id,
      null,
      v_policy_payload
    );
    if v_result->>'status'='baselined' then v_baselined:=v_baselined+1;
    elsif v_result->>'status'='no_change' then v_no_change:=v_no_change+1;
    elsif v_result->>'status'='emitted' then
      v_emitted:=v_emitted+1; v_results:=v_results || jsonb_build_array(v_result);
    end if;

    v_registry_payload := jsonb_build_object(
      'registry_version',v_registry.registry_version,
      'registry_checksum',v_registry.registry_checksum,
      'identity_serializer_version',v_registry.identity_serializer_version,
      'required_definitions',coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'fact_key',d.fact_key,
            'definition_checksum',d.definition_checksum,
            'deprecated',d.deprecated,
            'superseded_by_fact_key',d.superseded_by_fact_key
          )
          order by d.fact_key
        )
        from public.product_fact_definition_snapshots d
        where d.registry_version=v_registry.registry_version
          and d.fact_key in (
            select p.fact_key
            from public.catalog_required_product_facts_v1(v_intake.category) p
          )
      ),'[]'::jsonb)
    );

    v_result := public.observe_trust_reentry_signal_v1(
      'PRODUCT_FACT_REGISTRY',
      'intake:' || v_intake.id::text,
      'REGISTRY_CHANGED',
      v_intake.product_id,
      v_intake.id,
      null,
      v_registry_payload
    );
    if v_result->>'status'='baselined' then v_baselined:=v_baselined+1;
    elsif v_result->>'status'='no_change' then v_no_change:=v_no_change+1;
    elsif v_result->>'status'='emitted' then
      v_emitted:=v_emitted+1; v_results:=v_results || jsonb_build_array(v_result);
    end if;

    for v_task in
      select *
      from public.product_fact_research_tasks
      where intake_id=v_intake.id
      order by created_at,id
    loop
      v_tasks_scanned := v_tasks_scanned + 1;

      select jsonb_build_object(
        'task_id',v_task.id,
        'observations',coalesce(jsonb_agg(
          jsonb_build_object(
            'canonical_locator',o.canonical_locator,
            'observation_version',o.observation_version,
            'source_binding_id',o.source_binding_id,
            'source_content_digest',o.source_content_digest
          )
          order by o.canonical_locator,o.observation_version,o.source_binding_id
        ),'[]'::jsonb)
      )
      into v_digest_payload
      from (
        select distinct on (canonical_locator,observation_version,source_binding_id)
          canonical_locator,observation_version,source_binding_id,source_content_digest,
          created_at,observation_id
        from public.trust_source_observations
        where research_task_id=v_task.id
        order by canonical_locator,observation_version,source_binding_id,created_at desc,observation_id desc
      ) o;

      if jsonb_array_length(coalesce(v_digest_payload->'observations','[]'::jsonb)) > 0 then
        v_result := public.observe_trust_reentry_signal_v1(
          'SOURCE_OBSERVATION_DIGEST',
          'task:' || v_task.id::text,
          'SOURCE_CHANGED',
          v_intake.product_id,
          v_intake.id,
          v_task.id,
          v_digest_payload
        );
        if v_result->>'status'='baselined' then v_baselined:=v_baselined+1;
        elsif v_result->>'status'='no_change' then v_no_change:=v_no_change+1;
        elsif v_result->>'status'='emitted' then
          v_emitted:=v_emitted+1; v_results:=v_results || jsonb_build_array(v_result);
        end if;
      end if;
    end loop;
  end loop;

  return jsonb_build_object(
    'status','completed',
    'phase','6-B',
    'intakes_scanned',v_intakes_scanned,
    'tasks_scanned',v_tasks_scanned,
    'signals_baselined',v_baselined,
    'signals_unchanged',v_no_change,
    'events_emitted',v_emitted,
    'events',v_results
  );
end;
$$;

revoke all on function public.run_trust_reentry_detectors_v1(integer)
  from public, anon, authenticated, service_role;
grant execute on function public.run_trust_reentry_detectors_v1(integer)
  to service_role;

comment on function public.run_trust_reentry_detectors_v1(integer) is
  'TRUST Phase 6-B service-role detector runner. Baselines current signals and emits review-only Phase 6-A events only on later drift.';

commit;
