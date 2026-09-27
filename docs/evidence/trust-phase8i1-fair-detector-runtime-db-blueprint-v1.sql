begin;

-- TRUST Phase 8I-1: fair, persistent intake-fleet traversal for the existing
-- Phase 6-B drift detectors. Detector semantics and Product Fact authority are
-- unchanged; this migration only changes which intake batch is scanned next.

create table public.trust_reentry_detector_runtime_state (
  scanner_key text primary key
    check (scanner_key='PHASE6B_INTAKE_FLEET'),
  cycle_number bigint not null default 0
    check (cycle_number >= 0),
  cursor_created_at timestamptz,
  cursor_intake_id uuid,
  cycle_upper_created_at timestamptz,
  cycle_upper_intake_id uuid,
  active_cycle_started_at timestamptz,
  last_cycle_completed_at timestamptz,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((cursor_created_at is null) = (cursor_intake_id is null)),
  check ((cycle_upper_created_at is null) = (cycle_upper_intake_id is null)),
  check ((cycle_upper_created_at is null) = (active_cycle_started_at is null))
);

alter table public.trust_reentry_detector_runtime_state enable row level security;
revoke all on table public.trust_reentry_detector_runtime_state
  from public, anon, authenticated, service_role;

comment on table public.trust_reentry_detector_runtime_state is
  'TRUST Phase 8I-1 internal scanner cursor/cycle state. Operational scheduling state only; never Product Fact authority.';

insert into public.trust_reentry_detector_runtime_state(scanner_key)
values ('PHASE6B_INTAKE_FLEET');

create index catalog_trust_intake_reentry_scan_idx
  on public.catalog_trust_intake(created_at,id);

create or replace function public.run_trust_reentry_detectors_v2(
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = ''
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
  v_state public.trust_reentry_detector_runtime_state%rowtype;
  v_cycle_started boolean := false;
  v_cycle_completed boolean := false;
  v_cursor_before jsonb := null;
  v_cursor_after jsonb := null;
  v_last_created_at timestamptz;
  v_last_intake_id uuid;
  v_remaining_in_cycle bigint := 0;
  v_scanned_intake_ids jsonb := '[]'::jsonb;
begin
  if p_limit is null or p_limit < 1 or p_limit > 1000 then
    raise exception 'trust_reentry_detector_limit_invalid' using errcode='22023';
  end if;

  insert into public.trust_reentry_detector_runtime_state(scanner_key)
  values ('PHASE6B_INTAKE_FLEET')
  on conflict (scanner_key) do nothing;

  select * into v_state
  from public.trust_reentry_detector_runtime_state
  where scanner_key='PHASE6B_INTAKE_FLEET'
  for update;

  if v_state.cycle_upper_created_at is null then
    select created_at,id
    into v_state.cycle_upper_created_at,v_state.cycle_upper_intake_id
    from public.catalog_trust_intake
    order by created_at desc,id desc
    limit 1;

    if v_state.cycle_upper_created_at is null then
      update public.trust_reentry_detector_runtime_state
      set last_run_at=now(),
          updated_at=now()
      where scanner_key='PHASE6B_INTAKE_FLEET';

      return jsonb_build_object(
        'status','completed',
        'phase','8I-1',
        'runtime','reentry-detector-v2',
        'cycle_number',v_state.cycle_number,
        'cycle_started',false,
        'cycle_completed',true,
        'batch_limit',p_limit,
        'cursor_before',null,
        'cursor_after',null,
        'cycle_upper_bound',null,
        'intakes_scanned',0,
        'tasks_scanned',0,
        'signals_baselined',0,
        'signals_unchanged',0,
        'events_emitted',0,
        'remaining_in_cycle',0,
        'scanned_intake_ids','[]'::jsonb,
        'events','[]'::jsonb
      );
    end if;

    update public.trust_reentry_detector_runtime_state
    set cycle_number=cycle_number+1,
        cursor_created_at=null,
        cursor_intake_id=null,
        cycle_upper_created_at=v_state.cycle_upper_created_at,
        cycle_upper_intake_id=v_state.cycle_upper_intake_id,
        active_cycle_started_at=now(),
        last_run_at=now(),
        updated_at=now()
    where scanner_key='PHASE6B_INTAKE_FLEET'
    returning * into v_state;

    v_cycle_started := true;
  else
    update public.trust_reentry_detector_runtime_state
    set last_run_at=now(),
        updated_at=now()
    where scanner_key='PHASE6B_INTAKE_FLEET'
    returning * into v_state;
  end if;

  if v_state.cursor_created_at is not null then
    v_cursor_before := jsonb_build_object(
      'created_at',v_state.cursor_created_at,
      'intake_id',v_state.cursor_intake_id
    );
  end if;

  select * into v_registry
  from public.product_fact_registry_versions
  order by effective_at desc nulls last, created_at desc
  limit 1;

  for v_intake in
    select *
    from public.catalog_trust_intake
    where (
      v_state.cursor_created_at is null
      or (created_at,id) > (v_state.cursor_created_at,v_state.cursor_intake_id)
    )
      and (created_at,id) <= (
        v_state.cycle_upper_created_at,
        v_state.cycle_upper_intake_id
      )
    order by created_at,id
    limit p_limit
  loop
    v_intakes_scanned := v_intakes_scanned + 1;
    v_last_created_at := v_intake.created_at;
    v_last_intake_id := v_intake.id;
    v_scanned_intake_ids := v_scanned_intake_ids || to_jsonb(v_intake.id::text);

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

  if v_intakes_scanned > 0 then
    select count(*)
    into v_remaining_in_cycle
    from public.catalog_trust_intake
    where (created_at,id) > (v_last_created_at,v_last_intake_id)
      and (created_at,id) <= (
        v_state.cycle_upper_created_at,
        v_state.cycle_upper_intake_id
      );
  else
    select count(*)
    into v_remaining_in_cycle
    from public.catalog_trust_intake
    where (
      v_state.cursor_created_at is null
      or (created_at,id) > (v_state.cursor_created_at,v_state.cursor_intake_id)
    )
      and (created_at,id) <= (
        v_state.cycle_upper_created_at,
        v_state.cycle_upper_intake_id
      );
  end if;

  if v_remaining_in_cycle = 0 then
    v_cycle_completed := true;
    update public.trust_reentry_detector_runtime_state
    set cursor_created_at=null,
        cursor_intake_id=null,
        cycle_upper_created_at=null,
        cycle_upper_intake_id=null,
        active_cycle_started_at=null,
        last_cycle_completed_at=now(),
        last_run_at=now(),
        updated_at=now()
    where scanner_key='PHASE6B_INTAKE_FLEET';
    v_cursor_after := null;
  elsif v_intakes_scanned > 0 then
    update public.trust_reentry_detector_runtime_state
    set cursor_created_at=v_last_created_at,
        cursor_intake_id=v_last_intake_id,
        last_run_at=now(),
        updated_at=now()
    where scanner_key='PHASE6B_INTAKE_FLEET';
    v_cursor_after := jsonb_build_object(
      'created_at',v_last_created_at,
      'intake_id',v_last_intake_id
    );
  else
    v_cursor_after := v_cursor_before;
  end if;

  return jsonb_build_object(
    'status','completed',
    'phase','8I-1',
    'runtime','reentry-detector-v2',
    'cycle_number',v_state.cycle_number,
    'cycle_started',v_cycle_started,
    'cycle_completed',v_cycle_completed,
    'batch_limit',p_limit,
    'cursor_before',v_cursor_before,
    'cursor_after',v_cursor_after,
    'cycle_upper_bound',jsonb_build_object(
      'created_at',v_state.cycle_upper_created_at,
      'intake_id',v_state.cycle_upper_intake_id
    ),
    'intakes_scanned',v_intakes_scanned,
    'tasks_scanned',v_tasks_scanned,
    'signals_baselined',v_baselined,
    'signals_unchanged',v_no_change,
    'events_emitted',v_emitted,
    'remaining_in_cycle',v_remaining_in_cycle,
    'scanned_intake_ids',v_scanned_intake_ids,
    'events',v_results
  );
end;
$$;


revoke all on function public.run_trust_reentry_detectors_v2(integer)
  from public, anon, authenticated, service_role;
grant execute on function public.run_trust_reentry_detectors_v2(integer)
  to service_role;

comment on function public.run_trust_reentry_detectors_v2(integer) is
  'TRUST Phase 8I-1 service-role fair detector runner. Persistent keyset cursor plus cycle upper bound; detector semantics remain Phase 6-B review-only.';

commit;
