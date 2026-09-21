begin;

alter table public.trust_evidence_candidates
  add column if not exists parent_proposition_key text;

alter table public.trust_evidence_candidates
  drop constraint if exists trust_evidence_candidates_parent_proposition_key_check;

alter table public.trust_evidence_candidates
  add constraint trust_evidence_candidates_parent_proposition_key_check
  check (
    parent_proposition_key is null
    or parent_proposition_key ~ '^[0-9a-f]{64}$'
  );

create or replace function public.claim_trust_research_tasks_v1(
  p_limit integer default 5,
  p_lease_seconds integer default 300
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if p_limit is null or p_limit < 1 or p_limit > 25 then
    raise exception 'trust_research_claim_limit_invalid';
  end if;
  if p_lease_seconds is null or p_lease_seconds < 30 or p_lease_seconds > 1800 then
    raise exception 'trust_research_lease_invalid';
  end if;

  update public.product_fact_research_tasks
  set state = 'RESEARCH_PENDING',
      next_retry_at = now(),
      blocker_code = 'WORKER_LEASE_EXPIRED',
      blocker_detail = 'Previous RESEARCHING lease expired before a result was recorded.',
      updated_at = now()
  where state = 'RESEARCHING'
    and last_research_at is not null
    and last_research_at < now() - make_interval(secs => p_lease_seconds);

  with eligible as (
    select rt.id
    from public.product_fact_research_tasks rt
    join public.catalog_trust_intake i on i.id = rt.intake_id
    join public.product_fact_subjects s on s.subject_id = rt.subject_id
    where rt.state = 'RESEARCH_PENDING'
      and rt.subject_id is not null
      and (rt.next_retry_at is null or rt.next_retry_at <= now())
      and i.identity_state = 'EXACT_SUBJECT_FOUND'
      and i.subject_id = rt.subject_id
      and s.product_id = rt.product_id
      and s.identity_status = 'resolved'
      and s.current_state = 'current'
      and s.market_applicability is not distinct from i.market
      and (
        (
          i.catalog_revision like 'legacy-backfill-v1:%'
          and public.trust_phase7c_legacy_subject_scope_ready_v1(rt.id)
          and public.trust_phase7c_has_controlled_official_source_v1(rt.id)
        )
        or
        (
          i.catalog_revision not like 'legacy-backfill-v1:%'
          and s.variant_key is null
        )
      )
    order by rt.priority desc, rt.created_at, rt.id
    for update of rt skip locked
    limit p_limit
  ), claimed as (
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
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'task_id', c.id,
      'product_id', c.product_id,
      'subject_id', c.subject_id,
      'fact_key', c.fact_key,
      'registry_version', c.registry_version,
      'research_policy_version', c.research_policy_version,
      'attempt_count', c.attempt_count,
      'parent_propositions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'proposition_key', pc.proposition_key,
          'fact_instance_id', pfi.fact_instance_id,
          'fact_key', pfi.fact_key,
          'value_entity_identifier', pfi.value_entity_identifier,
          'market', pfi.market,
          'region', pfi.region
        ) order by pfi.value_entity_identifier, pc.proposition_key)
        from public.product_fact_definition_snapshots d
        join public.product_fact_current pc on pc.subject_id = c.subject_id
        join public.product_fact_instances pfi on pfi.fact_instance_id = pc.fact_instance_id
        where d.registry_version = c.registry_version
          and d.fact_key = c.fact_key
          and d.deprecated = false
          and coalesce((d.definition #>> '{relationship_schema,subject_ref_required}')::boolean, false)
          and pfi.registry_version = c.registry_version
          and pfi.fact_key = d.definition #>> '{relationship_schema,subject_ref_fact_key}'
          and pfi.semantic_status = 'supported'
      ), '[]'::jsonb),
      'official_source_seeds', coalesce((
        select jsonb_agg(jsonb_build_object(
          'source_binding_id', psb.binding_id,
          'source_name', psb.source_name,
          'external_type', psb.external_type,
          'binding_method', psb.binding_method,
          'product_scope_state', psb.product_scope_state,
          'canonical_locator', psb.source_url,
          'market', psb.market_code,
          'locale', psb.locale
        ) order by psb.created_at, psb.binding_id)
        from public.product_source_bindings psb
        join public.catalog_trust_intake i2 on i2.id = c.intake_id
        where psb.product_id = c.product_id
          and psb.binding_state = 'resolved'
          and psb.source_name ~ '_official$'
          and psb.source_url ~ '^https://'
          and (
            (
              i2.catalog_revision not like 'legacy-backfill-v1:%'
              and psb.market_code is not distinct from i2.market
            )
            or exists (
              select 1
              from public.trust_official_source_binding_reviews osr
              join public.product_fact_subjects s2 on s2.subject_id = osr.subject_id
              where i2.catalog_revision like 'legacy-backfill-v1:%'
                and osr.binding_id = psb.binding_id
                and osr.product_id = c.product_id
                and osr.subject_id = c.subject_id
                and osr.subject_market is not distinct from i2.market
                and psb.market_code is not distinct from osr.source_market
                and osr.variant_key is not distinct from s2.variant_key
                and osr.formulation_revision_key is not distinct from s2.formulation_revision_key
                and osr.review_version = 'trust-official-source-review-v1'
                and psb.binding_method = 'trust_official_source_review_v1'
                and psb.product_scope_state = 'product'
            )
          )
      ), '[]'::jsonb)
    )
    order by c.priority desc, c.created_at, c.id
  ), '[]'::jsonb)
  into v_result
  from claimed c;

  return v_result;
end;
$$;

create or replace function public.record_trust_research_result_v1(
  p_task_id uuid,
  p_result jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_task public.product_fact_research_tasks%rowtype;
  v_intake public.catalog_trust_intake%rowtype;
  v_subject public.product_fact_subjects%rowtype;
  v_binding public.product_source_bindings%rowtype;
  v_definition jsonb;
  v_outcome text;
  v_blocker text;
  v_detail text;
  v_retry_seconds integer;
  v_source jsonb;
  v_candidate jsonb;
  v_digest_basis text;
  v_page_digest text;
  v_observation_digest text;
  v_observation_id uuid;
  v_candidate_id uuid;
  v_evidence_digest text;
  v_evidence_class text;
  v_support_direction text;
  v_negative_admissibility text;
  v_confidence text;
  v_normalized_value jsonb;
  v_allowed_values jsonb;
  v_expected_type text;
  v_existing_current boolean;
  v_parent_proposition_key text;
  v_parent_fact_key text;
  v_parent_fact public.product_fact_instances%rowtype;
begin
  if p_result is null or jsonb_typeof(p_result) <> 'object' then
    raise exception 'trust_research_result_invalid';
  end if;
  v_outcome := upper(coalesce(p_result ->> 'outcome',''));

  select * into v_task
  from public.product_fact_research_tasks
  where id = p_task_id
  for update;
  if not found then
    raise exception 'trust_research_task_not_found';
  end if;

  if v_task.state = 'EVIDENCE_CANDIDATE'
    and v_outcome = 'EVIDENCE_CANDIDATE'
    and v_task.evidence_candidate_id is not null
    and lower(coalesce(p_result #>> '{source,source_content_digest}','')) = coalesce(v_task.source_content_digest,'') then
    return jsonb_build_object(
      'task_id', p_task_id,
      'outcome', 'EVIDENCE_CANDIDATE',
      'source_observation_id', v_task.source_observation_id,
      'evidence_candidate_id', v_task.evidence_candidate_id,
      'idempotent_replay', true
    );
  end if;

  if v_task.state <> 'RESEARCHING' then
    raise exception 'trust_research_task_not_claimed:%', v_task.state;
  end if;

  select * into v_intake from public.catalog_trust_intake where id = v_task.intake_id;
  select * into v_subject from public.product_fact_subjects where subject_id = v_task.subject_id;

  if v_task.subject_id is null
    or v_intake.identity_state <> 'EXACT_SUBJECT_FOUND'
    or v_intake.subject_id is distinct from v_task.subject_id
    or v_subject.identity_status <> 'resolved'
    or v_subject.current_state <> 'current'
    or v_subject.product_id <> v_task.product_id
    or v_subject.market_applicability is distinct from v_intake.market then
    update public.product_fact_research_tasks
    set state = 'BLOCKED', blocker_code = 'IDENTITY_BLOCKED',
        blocker_detail = 'Phase 3 requires the exact resolved/current Subject selected by Phase 2.',
        last_research_at = now(), updated_at = now()
    where id = p_task_id;
    return jsonb_build_object('task_id',p_task_id,'outcome','IDENTITY_BLOCKED');
  end if;

  if v_intake.catalog_revision like 'legacy-backfill-v1:%' then
    if not public.trust_phase7c_legacy_subject_scope_ready_v1(p_task_id) then
      update public.product_fact_research_tasks
      set state = 'BLOCKED', blocker_code = 'LEGACY_SUBJECT_SCOPE_BLOCKED',
          blocker_detail = 'Phase 7-C legacy task no longer matches its frozen Phase 7-B Subject scope.',
          last_research_at = now(), updated_at = now()
      where id = p_task_id;
      return jsonb_build_object('task_id',p_task_id,'outcome','LEGACY_SUBJECT_SCOPE_BLOCKED');
    end if;
  elsif v_subject.variant_key is not null then
    update public.product_fact_research_tasks
    set state = 'REVIEW_REQUIRED', blocker_code = 'VARIANT_CONFLICT',
        blocker_detail = 'Variant-scoped Subject requires separately governed presentation equivalence.',
        last_research_at = now(), updated_at = now()
    where id = p_task_id;
    return jsonb_build_object('task_id',p_task_id,'outcome','VARIANT_CONFLICT');
  end if;

  select definition into v_definition
  from public.product_fact_definition_snapshots
  where registry_version = v_task.registry_version
    and fact_key = v_task.fact_key
    and deprecated = false;
  if v_definition is null then
    update public.product_fact_research_tasks
    set state = 'BLOCKED', blocker_code = 'REGISTRY_GAP',
        blocker_detail = 'No active Registry definition exists for the task fact.',
        last_research_at = now(), updated_at = now()
    where id = p_task_id;
    return jsonb_build_object('task_id',p_task_id,'outcome','REGISTRY_GAP');
  end if;

  select exists (
    select 1
    from public.product_fact_current c
    where c.subject_id = v_task.subject_id
      and exists (
        select 1 from public.product_fact_instances fi
        where fi.fact_instance_id = c.fact_instance_id
          and fi.registry_version = v_task.registry_version
          and fi.fact_key = v_task.fact_key
      )
  ) into v_existing_current;
  if v_existing_current then
    update public.product_fact_research_tasks
    set state = 'ALREADY_COVERED', blocker_code = null, blocker_detail = null,
        next_retry_at = null, last_research_at = now(), updated_at = now()
    where id = p_task_id;
    return jsonb_build_object('task_id',p_task_id,'outcome','ALREADY_COVERED');
  end if;

  v_detail := nullif(btrim(p_result ->> 'detail'),'');

  if v_outcome = 'TRANSIENT_FAILURE' then
    v_retry_seconds := greatest(60, least(3600, coalesce((p_result ->> 'retry_after_seconds')::integer, 300)));
    update public.product_fact_research_tasks
    set state = 'RESEARCH_PENDING', blocker_code = 'SOURCE_TRANSIENT_FAILURE',
        blocker_detail = coalesce(v_detail,'Transient official-source fetch failure.'),
        next_retry_at = now() + make_interval(secs => v_retry_seconds),
        last_research_at = now(), updated_at = now()
    where id = p_task_id;
    return jsonb_build_object('task_id',p_task_id,'outcome','TRANSIENT_FAILURE','retry_after_seconds',v_retry_seconds);
  end if;

  if v_outcome in ('EVIDENCE_INSUFFICIENT','SOURCE_BLOCKED','OUT_OF_SCOPE') then
    update public.product_fact_research_tasks
    set state = 'BLOCKED', blocker_code = v_outcome,
        blocker_detail = coalesce(v_detail, lower(v_outcome)),
        next_retry_at = null, last_research_at = now(), updated_at = now()
    where id = p_task_id;
    return jsonb_build_object('task_id',p_task_id,'outcome',v_outcome);
  end if;

  if v_outcome in ('REVIEW_REQUIRED','FORMULATION_CONFLICT','MARKET_CONFLICT') then
    v_blocker := case when v_outcome = 'REVIEW_REQUIRED'
      then coalesce(nullif(upper(p_result ->> 'blocker_code'),''),'REVIEW_REQUIRED')
      else v_outcome end;
    update public.product_fact_research_tasks
    set state = 'REVIEW_REQUIRED', blocker_code = v_blocker,
        blocker_detail = coalesce(v_detail, lower(v_blocker)),
        next_retry_at = null, last_research_at = now(), updated_at = now()
    where id = p_task_id;
    return jsonb_build_object('task_id',p_task_id,'outcome',v_outcome,'blocker_code',v_blocker);
  end if;

  if v_outcome <> 'EVIDENCE_CANDIDATE' then
    raise exception 'trust_research_outcome_not_supported:%', v_outcome;
  end if;

  v_source := p_result -> 'source';
  v_candidate := p_result -> 'candidate';
  if jsonb_typeof(v_source) <> 'object' or jsonb_typeof(v_candidate) <> 'object' then
    raise exception 'trust_research_candidate_payload_invalid';
  end if;

  select * into v_binding
  from public.product_source_bindings psb
  where psb.binding_id = nullif(v_source ->> 'source_binding_id','')::uuid
    and psb.product_id = v_task.product_id
    and psb.binding_state = 'resolved'
    and psb.source_name ~ '_official$'
    and psb.source_url ~ '^https://'
    and (
      (
        v_intake.catalog_revision not like 'legacy-backfill-v1:%'
        and psb.market_code is not distinct from v_intake.market
      )
      or exists (
        select 1
        from public.trust_official_source_binding_reviews osr
        where v_intake.catalog_revision like 'legacy-backfill-v1:%'
          and osr.binding_id = psb.binding_id
          and osr.product_id = v_task.product_id
          and osr.subject_id = v_task.subject_id
          and osr.subject_market is not distinct from v_intake.market
          and psb.market_code is not distinct from osr.source_market
          and osr.variant_key is not distinct from v_subject.variant_key
          and osr.formulation_revision_key is not distinct from v_subject.formulation_revision_key
          and osr.source_kind = v_source ->> 'source_kind'
          and osr.review_version = 'trust-official-source-review-v1'
          and psb.binding_method = 'trust_official_source_review_v1'
          and psb.product_scope_state = 'product'
      )
    );
  if not found then
    update public.product_fact_research_tasks
    set state = 'BLOCKED', blocker_code = 'SOURCE_BLOCKED',
        blocker_detail = 'Evidence candidate source is not an exact-market resolved official source binding.',
        last_research_at = now(), updated_at = now()
    where id = p_task_id;
    return jsonb_build_object('task_id',p_task_id,'outcome','SOURCE_BLOCKED');
  end if;

  v_digest_basis := v_source ->> 'digest_basis';
  v_page_digest := lower(coalesce(v_source ->> 'source_content_digest',''));
  if v_digest_basis not in ('live-page-bytes-v1','frozen-first-party-observation-v1-not-live-page-bytes') then
    raise exception 'trust_research_digest_basis_invalid';
  end if;
  if v_page_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'trust_research_source_digest_invalid';
  end if;
  if nullif(btrim(v_source ->> 'source_kind'),'') is null
    or (v_source ->> 'source_kind') not in (
      'brand_official_product_page','brand_official_faq','brand_official_technical_document',
      'manufacturer_official_document','official_market_sales_page'
    ) then
    raise exception 'trust_research_source_kind_invalid';
  end if;
  if jsonb_typeof(v_source -> 'observed_claim') <> 'object'
    or jsonb_typeof(v_source -> 'product_identity_observation') <> 'object'
    or nullif(btrim(v_source ->> 'observation_version'),'') is null then
    raise exception 'trust_research_observation_invalid';
  end if;

  if v_digest_basis = 'frozen-first-party-observation-v1-not-live-page-bytes' then
    v_observation_digest := encode(extensions.digest(convert_to(jsonb_build_object(
      'source_binding_id', v_binding.binding_id,
      'canonical_locator', v_binding.source_url,
      'publisher', v_binding.source_name,
      'source_kind', v_source ->> 'source_kind',
      'market', v_binding.market_code,
      'locale', v_binding.locale,
      'observed_claim', v_source -> 'observed_claim',
      'product_identity_observation', v_source -> 'product_identity_observation',
      'observation_version', v_source ->> 'observation_version'
    )::text,'UTF8'),'sha256'),'hex');
    if v_page_digest <> v_observation_digest then
      raise exception 'trust_research_frozen_observation_digest_mismatch';
    end if;
  end if;

  v_evidence_class := v_candidate ->> 'evidence_class';
  if v_evidence_class is null
    or not (coalesce(v_definition -> 'permitted_evidence_classes','[]'::jsonb) ? v_evidence_class) then
    update public.product_fact_research_tasks
    set state = 'BLOCKED', blocker_code = 'OUT_OF_SCOPE',
        blocker_detail = 'Evidence class is not permitted by the active Registry definition.',
        last_research_at = now(), updated_at = now()
    where id = p_task_id;
    return jsonb_build_object('task_id',p_task_id,'outcome','OUT_OF_SCOPE');
  end if;

  v_normalized_value := v_candidate -> 'normalized_value';
  v_expected_type := v_definition ->> 'value_type';
  v_allowed_values := v_definition -> 'allowed_values';
  if v_normalized_value is null then
    raise exception 'trust_research_normalized_value_missing';
  end if;
  if v_expected_type = 'number' and jsonb_typeof(v_normalized_value) <> 'number' then
    raise exception 'trust_research_normalized_value_type_invalid:number';
  elsif v_expected_type = 'boolean' and jsonb_typeof(v_normalized_value) <> 'boolean' then
    raise exception 'trust_research_normalized_value_type_invalid:boolean';
  elsif v_expected_type in ('enum','entity_identifier') and jsonb_typeof(v_normalized_value) <> 'string' then
    raise exception 'trust_research_normalized_value_type_invalid:%', v_expected_type;
  elsif v_expected_type in ('number_unit','range_unit') and jsonb_typeof(v_normalized_value) <> 'object' then
    raise exception 'trust_research_normalized_value_type_invalid:%', v_expected_type;
  end if;
  if v_expected_type = 'enum'
    and jsonb_typeof(v_allowed_values) = 'array'
    and not (v_allowed_values ? trim(both '"' from v_normalized_value::text)) then
    raise exception 'trust_research_enum_value_invalid';
  end if;

  v_parent_proposition_key := nullif(lower(btrim(coalesce(v_candidate ->> 'parent_proposition_key',''))), '');
  v_parent_fact_key := nullif(btrim(coalesce(v_definition #>> '{relationship_schema,subject_ref_fact_key}','')), '');

  if coalesce((v_definition #>> '{relationship_schema,subject_ref_required}')::boolean, false) then
    if v_parent_proposition_key is null
      or v_parent_proposition_key !~ '^[0-9a-f]{64} coalesce(v_candidate ->> 'support_direction','supports');
  v_negative_admissibility := coalesce(v_candidate ->> 'negative_admissibility','not_applicable');
  if v_support_direction not in ('supports','opposes') then
    raise exception 'trust_research_support_direction_invalid';
  end if;
  if v_support_direction = 'opposes'
    and v_negative_admissibility not in ('explicit_negative','conflict_opposition') then
    raise exception 'trust_research_negative_semantics_invalid';
  end if;
  if v_support_direction = 'supports' and v_negative_admissibility <> 'not_applicable' then
    raise exception 'trust_research_positive_negative_semantics_invalid';
  end if;

  v_confidence := coalesce(v_candidate ->> 'confidence','high');
  if v_confidence not in ('high','medium','low') then
    raise exception 'trust_research_confidence_invalid';
  end if;

  insert into public.trust_source_observations (
    research_task_id, product_id, subject_id, source_binding_id,
    canonical_locator, publisher, source_kind, market, region, locale,
    observed_claim, product_identity_observation, observation_version,
    digest_basis, source_content_digest, observed_at, fetched_at
  ) values (
    v_task.id, v_task.product_id, v_task.subject_id, v_binding.binding_id,
    v_binding.source_url, v_binding.source_name, v_source ->> 'source_kind',
    v_binding.market_code, nullif(v_source ->> 'region',''), v_binding.locale,
    v_source -> 'observed_claim', v_source -> 'product_identity_observation',
    v_source ->> 'observation_version', v_digest_basis, v_page_digest,
    coalesce(nullif(v_source ->> 'observed_at','')::timestamptz, now()),
    nullif(v_source ->> 'fetched_at','')::timestamptz
  )
  on conflict (research_task_id, canonical_locator, observation_version, source_content_digest)
  do nothing
  returning observation_id into v_observation_id;

  if v_observation_id is null then
    select observation_id into v_observation_id
    from public.trust_source_observations
    where research_task_id = v_task.id
      and canonical_locator = v_binding.source_url
      and observation_version = v_source ->> 'observation_version'
      and source_content_digest = v_page_digest;
  end if;

  v_evidence_digest := encode(extensions.digest(convert_to(jsonb_strip_nulls(jsonb_build_object(
    'subject_id', v_task.subject_id,
    'registry_version', v_task.registry_version,
    'fact_key', v_task.fact_key,
    'normalized_value', v_normalized_value,
    'parent_proposition_key', v_parent_proposition_key,
    'evidence_class', v_evidence_class,
    'support_direction', v_support_direction,
    'negative_admissibility', v_negative_admissibility,
    'market', v_intake.market,
    'region', nullif(v_candidate ->> 'region',''),
    'locale', v_binding.locale,
    'qualifier', coalesce(v_candidate -> 'qualifier','{}'::jsonb),
    'source_content_digest', v_page_digest
  ))::text,'UTF8'),'sha256'),'hex');

  insert into public.trust_evidence_candidates (
    research_task_id, observation_id, product_id, subject_id,
    registry_version, fact_key, normalized_value, parent_proposition_key, evidence_class,
    evidence_authority, confidence, support_direction, negative_admissibility,
    market, region, locale, qualifier, candidate_state, canonical_evidence_digest
  ) values (
    v_task.id, v_observation_id, v_task.product_id, v_task.subject_id,
    v_task.registry_version, v_task.fact_key, v_normalized_value, v_parent_proposition_key, v_evidence_class,
    'product_specific_primary', v_confidence, v_support_direction, v_negative_admissibility,
    v_intake.market, nullif(v_candidate ->> 'region',''), v_binding.locale,
    coalesce(v_candidate -> 'qualifier','{}'::jsonb), 'READY', v_evidence_digest
  )
  on conflict (canonical_evidence_digest)
  do nothing
  returning candidate_id into v_candidate_id;

  if v_candidate_id is null then
    select candidate_id into v_candidate_id
    from public.trust_evidence_candidates
    where canonical_evidence_digest = v_evidence_digest;
  end if;

  update public.product_fact_research_tasks
  set state = 'EVIDENCE_CANDIDATE',
      source_locator = v_binding.source_url,
      source_content_digest = v_page_digest,
      source_observation_id = v_observation_id,
      evidence_candidate_id = v_candidate_id,
      blocker_code = null,
      blocker_detail = null,
      next_retry_at = null,
      last_research_at = now(),
      updated_at = now()
  where id = p_task_id;

  return jsonb_build_object(
    'task_id', p_task_id,
    'outcome', 'EVIDENCE_CANDIDATE',
    'source_observation_id', v_observation_id,
    'evidence_candidate_id', v_candidate_id,
    'canonical_evidence_digest', v_evidence_digest
  );
end;
$$;
      or v_parent_fact_key is null then
      raise exception 'trust_research_parent_proposition_required' using errcode = '23514';
    end if;

    select pfi.* into v_parent_fact
    from public.product_fact_current pc
    join public.product_fact_instances pfi on pfi.fact_instance_id = pc.fact_instance_id
    where pc.proposition_key = v_parent_proposition_key
      and pc.subject_id = v_task.subject_id
      and pfi.subject_id = v_task.subject_id
      and pfi.registry_version = v_task.registry_version
      and pfi.fact_key = v_parent_fact_key
      and pfi.semantic_status = 'supported';

    if not found then
      raise exception 'trust_research_parent_proposition_invalid' using errcode = '23514';
    end if;

    if (v_parent_fact.market is not null and v_parent_fact.market is distinct from v_intake.market)
      or (v_parent_fact.region is not null and v_parent_fact.region is distinct from nullif(v_candidate ->> 'region','')) then
      raise exception 'trust_research_parent_scope_mismatch' using errcode = '23514';
    end if;
  elsif v_parent_proposition_key is not null then
    raise exception 'trust_research_parent_proposition_unexpected' using errcode = '23514';
  end if;

  v_support_direction := coalesce(v_candidate ->> 'support_direction','supports');
  v_negative_admissibility := coalesce(v_candidate ->> 'negative_admissibility','not_applicable');
  if v_support_direction not in ('supports','opposes') then
    raise exception 'trust_research_support_direction_invalid';
  end if;
  if v_support_direction = 'opposes'
    and v_negative_admissibility not in ('explicit_negative','conflict_opposition') then
    raise exception 'trust_research_negative_semantics_invalid';
  end if;
  if v_support_direction = 'supports' and v_negative_admissibility <> 'not_applicable' then
    raise exception 'trust_research_positive_negative_semantics_invalid';
  end if;

  v_confidence := coalesce(v_candidate ->> 'confidence','high');
  if v_confidence not in ('high','medium','low') then
    raise exception 'trust_research_confidence_invalid';
  end if;

  insert into public.trust_source_observations (
    research_task_id, product_id, subject_id, source_binding_id,
    canonical_locator, publisher, source_kind, market, region, locale,
    observed_claim, product_identity_observation, observation_version,
    digest_basis, source_content_digest, observed_at, fetched_at
  ) values (
    v_task.id, v_task.product_id, v_task.subject_id, v_binding.binding_id,
    v_binding.source_url, v_binding.source_name, v_source ->> 'source_kind',
    v_binding.market_code, nullif(v_source ->> 'region',''), v_binding.locale,
    v_source -> 'observed_claim', v_source -> 'product_identity_observation',
    v_source ->> 'observation_version', v_digest_basis, v_page_digest,
    coalesce(nullif(v_source ->> 'observed_at','')::timestamptz, now()),
    nullif(v_source ->> 'fetched_at','')::timestamptz
  )
  on conflict (research_task_id, canonical_locator, observation_version, source_content_digest)
  do nothing
  returning observation_id into v_observation_id;

  if v_observation_id is null then
    select observation_id into v_observation_id
    from public.trust_source_observations
    where research_task_id = v_task.id
      and canonical_locator = v_binding.source_url
      and observation_version = v_source ->> 'observation_version'
      and source_content_digest = v_page_digest;
  end if;

  v_evidence_digest := encode(extensions.digest(convert_to(jsonb_build_object(
    'subject_id', v_task.subject_id,
    'registry_version', v_task.registry_version,
    'fact_key', v_task.fact_key,
    'normalized_value', v_normalized_value,
    'evidence_class', v_evidence_class,
    'support_direction', v_support_direction,
    'negative_admissibility', v_negative_admissibility,
    'market', v_intake.market,
    'region', nullif(v_candidate ->> 'region',''),
    'locale', v_binding.locale,
    'qualifier', coalesce(v_candidate -> 'qualifier','{}'::jsonb),
    'source_content_digest', v_page_digest
  )::text,'UTF8'),'sha256'),'hex');

  insert into public.trust_evidence_candidates (
    research_task_id, observation_id, product_id, subject_id,
    registry_version, fact_key, normalized_value, evidence_class,
    evidence_authority, confidence, support_direction, negative_admissibility,
    market, region, locale, qualifier, candidate_state, canonical_evidence_digest
  ) values (
    v_task.id, v_observation_id, v_task.product_id, v_task.subject_id,
    v_task.registry_version, v_task.fact_key, v_normalized_value, v_evidence_class,
    'product_specific_primary', v_confidence, v_support_direction, v_negative_admissibility,
    v_intake.market, nullif(v_candidate ->> 'region',''), v_binding.locale,
    coalesce(v_candidate -> 'qualifier','{}'::jsonb), 'READY', v_evidence_digest
  )
  on conflict (canonical_evidence_digest)
  do nothing
  returning candidate_id into v_candidate_id;

  if v_candidate_id is null then
    select candidate_id into v_candidate_id
    from public.trust_evidence_candidates
    where canonical_evidence_digest = v_evidence_digest;
  end if;

  update public.product_fact_research_tasks
  set state = 'EVIDENCE_CANDIDATE',
      source_locator = v_binding.source_url,
      source_content_digest = v_page_digest,
      source_observation_id = v_observation_id,
      evidence_candidate_id = v_candidate_id,
      blocker_code = null,
      blocker_detail = null,
      next_retry_at = null,
      last_research_at = now(),
      updated_at = now()
  where id = p_task_id;

  return jsonb_build_object(
    'task_id', p_task_id,
    'outcome', 'EVIDENCE_CANDIDATE',
    'source_observation_id', v_observation_id,
    'evidence_candidate_id', v_candidate_id,
    'canonical_evidence_digest', v_evidence_digest
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
$$;

create or replace function public.trust_phase4_build_adoption_plan_v1(
  p_actor_user_id uuid,
  p_candidate_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_candidate public.trust_evidence_candidates%rowtype;
  v_task public.product_fact_research_tasks%rowtype;
  v_intake public.catalog_trust_intake%rowtype;
  v_observation public.trust_source_observations%rowtype;
  v_subject public.product_fact_subjects%rowtype;
  v_catalog_binding public.product_source_bindings%rowtype;
  v_definition public.product_fact_definition_snapshots%rowtype;
  v_existing_evidence public.product_evidence_records%rowtype;
  v_registry_version text;
  v_expected_observation_digest text;
  v_expected_candidate_digest text;
  v_proposition_key text;
  v_scope jsonb;
  v_value_type text;
  v_allowed_values jsonb;
  v_allowed_units jsonb;
  v_cardinality text;
  v_value_boolean boolean;
  v_value_enum text;
  v_value_number numeric;
  v_value_unit text;
  v_value_range_min numeric;
  v_value_range_max numeric;
  v_value_entity_identifier text;
  v_source_payload jsonb;
  v_binding_payload jsonb;
  v_evidence_payload jsonb;
  v_fact_payload_base jsonb;
  v_fusion_policy constant text := 'trust-phase4-single-primary-evidence-v1';
  v_fusion_input_digest text;
  v_open_assignment_count bigint;
  v_legacy boolean := false;
  v_legacy_source_review public.trust_official_source_binding_reviews%rowtype;
  v_binding_scope_relation text := 'equivalent';
  v_subject_ref_required boolean := false;
  v_parent_fact_key text;
  v_parent_proposition_key text;
  v_parent_fact_instance_id uuid;
  v_parent_fact public.product_fact_instances%rowtype;
begin
  perform public.admin_require_product_review_actor(
    p_actor_user_id,
    'admin.products.review'
  );

  if p_candidate_id is null then
    raise exception 'trust_phase4_candidate_id_required' using errcode = '22023';
  end if;

  select * into v_candidate
  from public.trust_evidence_candidates
  where candidate_id = p_candidate_id;

  if not found then
    raise exception 'trust_phase4_candidate_not_found' using errcode = '22023';
  end if;

  if v_candidate.candidate_state <> 'READY' then
    raise exception 'trust_phase4_candidate_not_ready:%', v_candidate.candidate_state
      using errcode = '55000';
  end if;

  select * into v_task
  from public.product_fact_research_tasks
  where id = v_candidate.research_task_id;

  if not found
    or v_task.state <> 'EVIDENCE_CANDIDATE'
    or v_task.evidence_candidate_id is distinct from v_candidate.candidate_id
    or v_task.source_observation_id is distinct from v_candidate.observation_id
    or v_task.product_id is distinct from v_candidate.product_id
    or v_task.subject_id is distinct from v_candidate.subject_id
    or v_task.registry_version is distinct from v_candidate.registry_version
    or v_task.fact_key is distinct from v_candidate.fact_key then
    raise exception 'trust_phase4_research_task_lineage_invalid' using errcode = '55000';
  end if;

  select * into v_intake
  from public.catalog_trust_intake
  where id = v_task.intake_id;

  if not found
    or v_intake.product_id is distinct from v_candidate.product_id
    or v_intake.identity_state <> 'EXACT_SUBJECT_FOUND'
    or v_intake.subject_id is distinct from v_candidate.subject_id
    or nullif(btrim(coalesce(v_intake.identity_resolution_version, '')), '') is null
    or v_intake.market is distinct from v_candidate.market then
    raise exception 'trust_phase4_intake_identity_invalid' using errcode = '55000';
  end if;

  v_legacy := v_intake.catalog_revision like 'legacy-backfill-v1:%';

  if v_legacy
    and not public.trust_phase7c_legacy_subject_scope_ready_v1(v_task.id) then
    raise exception 'trust_phase4_legacy_subject_scope_invalid' using errcode = '55000';
  end if;

  select * into v_observation
  from public.trust_source_observations
  where observation_id = v_candidate.observation_id;

  if not found
    or v_observation.research_task_id is distinct from v_candidate.research_task_id
    or v_observation.product_id is distinct from v_candidate.product_id
    or v_observation.subject_id is distinct from v_candidate.subject_id
    or v_observation.canonical_locator is distinct from v_task.source_locator
    or v_observation.source_content_digest is distinct from v_task.source_content_digest
    or (not v_legacy and v_observation.market is distinct from v_candidate.market)
    or v_observation.region is distinct from v_candidate.region
    or v_observation.locale is distinct from v_candidate.locale then
    raise exception 'trust_phase4_source_observation_lineage_invalid' using errcode = '55000';
  end if;

  if v_observation.canonical_locator !~ '^https://'
    or v_observation.source_content_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'trust_phase4_source_observation_invalid' using errcode = '22023';
  end if;

  if v_observation.digest_basis = 'frozen-first-party-observation-v1-not-live-page-bytes' then
    v_expected_observation_digest := encode(
      extensions.digest(
        convert_to(
          jsonb_build_object(
            'source_binding_id', v_observation.source_binding_id,
            'canonical_locator', v_observation.canonical_locator,
            'publisher', v_observation.publisher,
            'source_kind', v_observation.source_kind,
            'market', v_observation.market,
            'locale', v_observation.locale,
            'observed_claim', v_observation.observed_claim,
            'product_identity_observation', v_observation.product_identity_observation,
            'observation_version', v_observation.observation_version
          )::text,
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    );

    if v_expected_observation_digest <> v_observation.source_content_digest then
      raise exception 'trust_phase4_source_observation_digest_mismatch' using errcode = '55000';
    end if;
  elsif v_observation.digest_basis <> 'live-page-bytes-v1' then
    raise exception 'trust_phase4_source_digest_basis_invalid' using errcode = '22023';
  end if;

  select * into v_catalog_binding
  from public.product_source_bindings
  where binding_id = v_observation.source_binding_id;

  if not found
    or v_catalog_binding.product_id is distinct from v_candidate.product_id
    or v_catalog_binding.binding_state <> 'resolved'
    or v_catalog_binding.source_name !~ '_official$'
    or v_catalog_binding.source_url is distinct from v_observation.canonical_locator
    or v_catalog_binding.source_url !~ '^https://'
    or v_catalog_binding.market_code is distinct from v_observation.market
    or (not v_legacy and v_catalog_binding.market_code is distinct from v_candidate.market)
    or v_catalog_binding.locale is distinct from v_candidate.locale then
    raise exception 'trust_phase4_catalog_source_binding_invalid' using errcode = '55000';
  end if;

  if v_legacy then
    select * into v_legacy_source_review
    from public.trust_official_source_binding_reviews osr
    where osr.binding_id = v_catalog_binding.binding_id
      and osr.product_id = v_candidate.product_id
      and osr.subject_id = v_candidate.subject_id
      and osr.subject_market is not distinct from v_intake.market
      and osr.source_market is not distinct from v_observation.market
      and osr.variant_key is not distinct from (
        select s.variant_key
        from public.product_fact_subjects s
        where s.subject_id = v_candidate.subject_id
      )
      and osr.formulation_revision_key is not distinct from (
        select s.formulation_revision_key
        from public.product_fact_subjects s
        where s.subject_id = v_candidate.subject_id
      )
      and osr.source_kind = v_observation.source_kind
      and osr.scope_relation in ('equivalent','narrower')
      and osr.review_version = 'trust-official-source-review-v1'
    order by osr.created_at desc, osr.review_id desc
    limit 1;

    if not found
      or v_catalog_binding.binding_method <> 'trust_official_source_review_v1'
      or v_catalog_binding.product_scope_state <> 'product' then
      raise exception 'trust_phase4_legacy_controlled_source_invalid' using errcode = '55000';
    end if;

    v_binding_scope_relation := v_legacy_source_review.scope_relation;
  end if;

  select * into v_subject
  from public.product_fact_subjects
  where subject_id = v_candidate.subject_id;

  if not found
    or v_subject.product_id is distinct from v_candidate.product_id
    or v_subject.identity_status <> 'resolved'
    or v_subject.current_state <> 'current'
    or v_subject.market_applicability is distinct from v_candidate.market
    or (not v_legacy and v_subject.variant_key is not null) then
    raise exception 'trust_phase4_subject_identity_invalid' using errcode = '55000';
  end if;

  if v_legacy and (
    v_legacy_source_review.variant_key is distinct from v_subject.variant_key
    or v_legacy_source_review.formulation_revision_key is distinct from v_subject.formulation_revision_key
  ) then
    raise exception 'trust_phase4_legacy_subject_review_mismatch' using errcode = '55000';
  end if;

  v_registry_version := public.product_fact_controlled_latest_registry_v1();
  if v_registry_version is null
    or v_registry_version is distinct from v_candidate.registry_version then
    raise exception 'trust_phase4_registry_not_current' using errcode = '55000';
  end if;

  select * into v_definition
  from public.product_fact_definition_snapshots
  where registry_version = v_candidate.registry_version
    and fact_key = v_candidate.fact_key
    and deprecated = false;

  if not found then
    raise exception 'trust_phase4_registry_definition_missing' using errcode = '55000';
  end if;

  if not coalesce(v_definition.definition -> 'permitted_evidence_classes' ? v_candidate.evidence_class, false) then
    raise exception 'trust_phase4_evidence_class_not_permitted' using errcode = '55000';
  end if;

  if v_candidate.evidence_authority <> 'product_specific_primary'
    or v_candidate.support_direction <> 'supports'
    or v_candidate.negative_admissibility <> 'not_applicable' then
    raise exception 'trust_phase4_candidate_requires_adjudication' using errcode = '55000';
  end if;

  v_subject_ref_required :=
    coalesce((v_definition.definition #>> '{relationship_schema,subject_ref_required}')::boolean, false);
  v_parent_fact_key :=
    nullif(btrim(coalesce(v_definition.definition #>> '{relationship_schema,subject_ref_fact_key}', '')), '');
  v_parent_proposition_key := v_candidate.parent_proposition_key;

  if v_subject_ref_required then
    if v_parent_proposition_key is null
      or v_parent_proposition_key !~ '^[0-9a-f]{64}
    raise exception 'trust_phase4_qualifier_invalid' using errcode = '22023';
  end if;

  v_value_type := v_definition.value_type;
  v_allowed_values := v_definition.definition -> 'allowed_values';
  v_allowed_units := v_definition.definition #> '{unit_schema,allowed_units}';
  v_cardinality := coalesce(v_definition.definition ->> 'cardinality', 'one');

  if v_value_type = 'boolean' then
    if jsonb_typeof(v_candidate.normalized_value) <> 'boolean' then
      raise exception 'trust_phase4_normalized_value_invalid:boolean' using errcode = '22023';
    end if;
    v_value_boolean := (v_candidate.normalized_value #>> '{}')::boolean;
  elsif v_value_type = 'enum' then
    if jsonb_typeof(v_candidate.normalized_value) <> 'string' then
      raise exception 'trust_phase4_normalized_value_invalid:enum' using errcode = '22023';
    end if;
    v_value_enum := v_candidate.normalized_value #>> '{}';
    if jsonb_typeof(v_allowed_values) = 'array' and not (v_allowed_values ? v_value_enum) then
      raise exception 'trust_phase4_enum_value_invalid' using errcode = '22023';
    end if;
  elsif v_value_type = 'number' then
    if jsonb_typeof(v_candidate.normalized_value) <> 'number' then
      raise exception 'trust_phase4_normalized_value_invalid:number' using errcode = '22023';
    end if;
    v_value_number := (v_candidate.normalized_value #>> '{}')::numeric;
  elsif v_value_type = 'entity_identifier' then
    if jsonb_typeof(v_candidate.normalized_value) <> 'string'
      or nullif(btrim(v_candidate.normalized_value #>> '{}'), '') is null then
      raise exception 'trust_phase4_normalized_value_invalid:entity_identifier' using errcode = '22023';
    end if;
    v_value_entity_identifier := v_candidate.normalized_value #>> '{}';
  elsif v_value_type = 'number_unit' then
    if jsonb_typeof(v_candidate.normalized_value) <> 'object'
      or not (v_candidate.normalized_value ?& array['amount','unit'])
      or (select count(*) from jsonb_object_keys(v_candidate.normalized_value)) <> 2
      or jsonb_typeof(v_candidate.normalized_value -> 'amount') <> 'number'
      or jsonb_typeof(v_candidate.normalized_value -> 'unit') <> 'string' then
      raise exception 'trust_phase4_normalized_value_invalid:number_unit' using errcode = '22023';
    end if;
    v_value_number := (v_candidate.normalized_value ->> 'amount')::numeric;
    v_value_unit := v_candidate.normalized_value ->> 'unit';
    if jsonb_typeof(v_allowed_units) = 'array' and not (v_allowed_units ? v_value_unit) then
      raise exception 'trust_phase4_unit_invalid' using errcode = '22023';
    end if;
  elsif v_value_type = 'range_unit' then
    if jsonb_typeof(v_candidate.normalized_value) <> 'object'
      or not (v_candidate.normalized_value ?& array['min','max','unit'])
      or (select count(*) from jsonb_object_keys(v_candidate.normalized_value)) <> 3
      or jsonb_typeof(v_candidate.normalized_value -> 'min') <> 'number'
      or jsonb_typeof(v_candidate.normalized_value -> 'max') <> 'number'
      or jsonb_typeof(v_candidate.normalized_value -> 'unit') <> 'string' then
      raise exception 'trust_phase4_normalized_value_invalid:range_unit' using errcode = '22023';
    end if;
    v_value_range_min := (v_candidate.normalized_value ->> 'min')::numeric;
    v_value_range_max := (v_candidate.normalized_value ->> 'max')::numeric;
    v_value_unit := v_candidate.normalized_value ->> 'unit';
    if v_value_range_min > v_value_range_max then
      raise exception 'trust_phase4_range_invalid' using errcode = '22023';
    end if;
    if jsonb_typeof(v_allowed_units) = 'array' and not (v_allowed_units ? v_value_unit) then
      raise exception 'trust_phase4_unit_invalid' using errcode = '22023';
    end if;
  else
    raise exception 'trust_phase4_value_type_unsupported:%', v_value_type using errcode = '55000';
  end if;

  v_expected_candidate_digest := encode(
    extensions.digest(
      convert_to(
        jsonb_strip_nulls(jsonb_build_object(
          'subject_id', v_candidate.subject_id,
          'registry_version', v_candidate.registry_version,
          'fact_key', v_candidate.fact_key,
          'normalized_value', v_candidate.normalized_value,
          'parent_proposition_key', v_parent_proposition_key,
          'evidence_class', v_candidate.evidence_class,
          'support_direction', v_candidate.support_direction,
          'negative_admissibility', v_candidate.negative_admissibility,
          'market', v_candidate.market,
          'region', v_candidate.region,
          'locale', v_candidate.locale,
          'qualifier', v_candidate.qualifier,
          'source_content_digest', v_observation.source_content_digest
        ))::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  if v_expected_candidate_digest <> v_candidate.canonical_evidence_digest then
    raise exception 'trust_phase4_candidate_digest_mismatch' using errcode = '55000';
  end if;

  v_scope := jsonb_strip_nulls(jsonb_build_object(
    'market', v_candidate.market,
    'variant', v_subject.variant_key
  ));

  v_proposition_key := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object(
      'serializer_version', 'product-fact-proposition-pilot-v1',
      'subject_semantic_key', v_subject.subject_semantic_key,
      'registry_version', v_candidate.registry_version,
      'fact_key', v_candidate.fact_key,
      'value_identity', case when v_subject_ref_required then null else v_candidate.normalized_value end,
      'scope', v_scope,
      'qualifier', v_candidate.qualifier,
      'parent_proposition_key', v_parent_proposition_key
    )
  );

  if exists (
    select 1 from public.product_fact_current c
    where c.proposition_key = v_proposition_key
  ) then
    raise exception 'trust_phase4_candidate_already_current' using errcode = '55000';
  end if;

  if v_cardinality = 'one' and exists (
    select 1
    from public.product_fact_current c
    join public.product_fact_instances fi on fi.fact_instance_id = c.fact_instance_id
    where c.subject_id = v_candidate.subject_id
      and fi.registry_version = v_candidate.registry_version
      and fi.fact_key = v_candidate.fact_key
      and c.proposition_key <> v_proposition_key
  ) then
    raise exception 'trust_phase4_cardinality_collision' using errcode = '55000';
  end if;

  if exists (
    select 1 from public.product_fact_instances fi
    where fi.proposition_key = v_proposition_key
      and (
        fi.subject_id <> v_candidate.subject_id
        or fi.registry_version <> v_candidate.registry_version
        or fi.fact_key <> v_candidate.fact_key
      )
  ) then
    raise exception 'trust_phase4_proposition_collision' using errcode = '55000';
  end if;

  select * into v_existing_evidence
  from public.product_evidence_records
  where canonical_evidence_digest = v_candidate.canonical_evidence_digest;

  if found and (
    v_existing_evidence.subject_id <> v_candidate.subject_id
    or v_existing_evidence.registry_version <> v_candidate.registry_version
    or v_existing_evidence.fact_key <> v_candidate.fact_key
    or v_existing_evidence.proposition_key <> v_proposition_key
    or v_existing_evidence.proposition_serializer_version <> 'product-fact-proposition-pilot-v1'
    or v_existing_evidence.proposition_value_identity is distinct from
      (case when v_subject_ref_required then null else v_candidate.normalized_value end)
    or v_existing_evidence.parent_proposition_key is distinct from v_parent_proposition_key
    or v_existing_evidence.evidence_class <> v_candidate.evidence_class
    or v_existing_evidence.evidence_authority <> v_candidate.evidence_authority
    or v_existing_evidence.confidence <> v_candidate.confidence
    or v_existing_evidence.support_direction <> v_candidate.support_direction
    or v_existing_evidence.negative_admissibility <> v_candidate.negative_admissibility
    or v_existing_evidence.market is distinct from v_candidate.market
    or v_existing_evidence.region is distinct from v_candidate.region
    or v_existing_evidence.locale is distinct from v_candidate.locale
    or v_existing_evidence.qualifier is distinct from v_candidate.qualifier
  ) then
    raise exception 'trust_phase4_governed_evidence_collision' using errcode = '55000';
  end if;

  select count(*) into v_open_assignment_count
  from public.product_fact_review_assignments a
  where a.product_id = v_candidate.product_id
    and a.subject_id = v_candidate.subject_id
    and a.registry_version = v_candidate.registry_version
    and a.fact_key = v_candidate.fact_key
    and a.proposition_key = v_proposition_key
    and a.operational_state not in ('confirmed','superseded');

  if v_open_assignment_count > 1 then
    raise exception 'trust_phase4_duplicate_open_assignments' using errcode = '55000';
  end if;

  v_source_payload := jsonb_build_object(
    'canonical_locator', v_observation.canonical_locator,
    'publisher', v_observation.publisher,
    'source_kind', v_observation.source_kind,
    'source_metadata', jsonb_build_object('digest_basis', v_observation.digest_basis),
    'content_digest', v_observation.source_content_digest,
    'external_snapshot_reference', null,
    'market', v_observation.market,
    'region', v_observation.region,
    'locale', v_observation.locale,
    'published_at', null,
    'accessed_at', coalesce(v_observation.fetched_at, v_observation.observed_at),
    'observed_at', v_observation.observed_at
  );

  v_binding_payload := jsonb_build_object(
    'product_id', v_candidate.product_id,
    'subject_id', v_candidate.subject_id,
    'binding_state', 'exact_subject_match',
    'scope_relation', v_binding_scope_relation,
    'presentation_metadata', jsonb_build_object(
      'catalog_source_binding_id', v_observation.source_binding_id
    ),
    'identity_resolution_version', v_intake.identity_resolution_version,
    'reviewed_at', v_candidate.created_at
  );

  v_evidence_payload := jsonb_build_object(
    'registry_version', v_candidate.registry_version,
    'fact_key', v_candidate.fact_key,
    'proposition_key', v_proposition_key,
    'proposition_serializer_version', 'product-fact-proposition-pilot-v1',
    'proposition_value_identity', case when v_subject_ref_required then null else v_candidate.normalized_value end,
    'parent_proposition_key', v_parent_proposition_key,
    'evidence_class', v_candidate.evidence_class,
    'evidence_authority', v_candidate.evidence_authority,
    'confidence', v_candidate.confidence,
    'support_direction', v_candidate.support_direction,
    'negative_admissibility', v_candidate.negative_admissibility,
    'market', v_candidate.market,
    'region', v_candidate.region,
    'locale', v_candidate.locale,
    'valid_from', null,
    'valid_to', null,
    'qualifier', v_candidate.qualifier,
    'canonical_evidence_digest', v_candidate.canonical_evidence_digest,
    'supersedes_evidence_id', null
  );

  v_fusion_input_digest := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object(
      'fusion_policy_version', v_fusion_policy,
      'proposition_key', v_proposition_key,
      'supporting_evidence_digests', jsonb_build_array(v_candidate.canonical_evidence_digest),
      'opposing_evidence_digests', '[]'::jsonb
    )
  );

  v_fact_payload_base := jsonb_build_object(
    'subject_id', v_candidate.subject_id,
    'registry_version', v_candidate.registry_version,
    'fact_key', v_candidate.fact_key,
    'proposition_key', v_proposition_key,
    'proposition_serializer_version', 'product-fact-proposition-pilot-v1',
    'semantic_status', 'supported',
    'value_type', v_value_type,
    'value_boolean', v_value_boolean,
    'value_enum', v_value_enum,
    'value_number', v_value_number,
    'value_unit', v_value_unit,
    'value_range_min', v_value_range_min,
    'value_range_max', v_value_range_max,
    'value_entity_identifier', v_value_entity_identifier,
    'market', v_candidate.market,
    'region', v_candidate.region,
    'locale', v_candidate.locale,
    'valid_from', null,
    'valid_to', null,
    'qualifier', v_candidate.qualifier,
    'parent_fact_instance_id', v_parent_fact_instance_id,
    'parent_proposition_key', v_parent_proposition_key,
    'authority_ceiling', 'product_specific_primary',
    'fused_confidence', v_candidate.confidence,
    'fusion_policy_version', v_fusion_policy,
    'fusion_input_digest', v_fusion_input_digest
  );

  return jsonb_build_object(
    'candidate_id', v_candidate.candidate_id,
    'product_id', v_candidate.product_id,
    'subject_id', v_candidate.subject_id,
    'registry_version', v_candidate.registry_version,
    'fact_key', v_candidate.fact_key,
    'proposition_key', v_proposition_key,
    'proposition_serializer_version', 'product-fact-proposition-pilot-v1',
    'canonical_evidence_digest', v_candidate.canonical_evidence_digest,
    'source_payload', v_source_payload,
    'binding_payload', v_binding_payload,
    'evidence_payload', v_evidence_payload,
    'fact_payload_base', v_fact_payload_base,
    'open_assignment_count', v_open_assignment_count
  );
end;
$$;
      or v_parent_fact_key is null then
      raise exception 'trust_phase4_parent_proposition_required' using errcode = '55000';
    end if;

    select pfi.* into v_parent_fact
    from public.product_fact_current pc
    join public.product_fact_instances pfi on pfi.fact_instance_id = pc.fact_instance_id
    where pc.proposition_key = v_parent_proposition_key
      and pc.subject_id = v_candidate.subject_id
      and pfi.subject_id = v_candidate.subject_id
      and pfi.registry_version = v_candidate.registry_version
      and pfi.fact_key = v_parent_fact_key
      and pfi.semantic_status = 'supported';

    if not found then
      raise exception 'trust_phase4_parent_proposition_not_current' using errcode = '55000';
    end if;

    if (v_parent_fact.market is not null and v_parent_fact.market is distinct from v_candidate.market)
      or (v_parent_fact.region is not null and v_parent_fact.region is distinct from v_candidate.region) then
      raise exception 'trust_phase4_parent_scope_mismatch' using errcode = '55000';
    end if;

    v_parent_fact_instance_id := v_parent_fact.fact_instance_id;
  elsif v_parent_proposition_key is not null then
    raise exception 'trust_phase4_parent_proposition_unexpected' using errcode = '55000';
  end if;

  if jsonb_typeof(v_candidate.qualifier) <> 'object' then
    raise exception 'trust_phase4_qualifier_invalid' using errcode = '22023';
  end if;

  v_value_type := v_definition.value_type;
  v_allowed_values := v_definition.definition -> 'allowed_values';
  v_allowed_units := v_definition.definition #> '{unit_schema,allowed_units}';
  v_cardinality := coalesce(v_definition.definition ->> 'cardinality', 'one');

  if v_value_type = 'boolean' then
    if jsonb_typeof(v_candidate.normalized_value) <> 'boolean' then
      raise exception 'trust_phase4_normalized_value_invalid:boolean' using errcode = '22023';
    end if;
    v_value_boolean := (v_candidate.normalized_value #>> '{}')::boolean;
  elsif v_value_type = 'enum' then
    if jsonb_typeof(v_candidate.normalized_value) <> 'string' then
      raise exception 'trust_phase4_normalized_value_invalid:enum' using errcode = '22023';
    end if;
    v_value_enum := v_candidate.normalized_value #>> '{}';
    if jsonb_typeof(v_allowed_values) = 'array' and not (v_allowed_values ? v_value_enum) then
      raise exception 'trust_phase4_enum_value_invalid' using errcode = '22023';
    end if;
  elsif v_value_type = 'number' then
    if jsonb_typeof(v_candidate.normalized_value) <> 'number' then
      raise exception 'trust_phase4_normalized_value_invalid:number' using errcode = '22023';
    end if;
    v_value_number := (v_candidate.normalized_value #>> '{}')::numeric;
  elsif v_value_type = 'entity_identifier' then
    if jsonb_typeof(v_candidate.normalized_value) <> 'string'
      or nullif(btrim(v_candidate.normalized_value #>> '{}'), '') is null then
      raise exception 'trust_phase4_normalized_value_invalid:entity_identifier' using errcode = '22023';
    end if;
    v_value_entity_identifier := v_candidate.normalized_value #>> '{}';
  elsif v_value_type = 'number_unit' then
    if jsonb_typeof(v_candidate.normalized_value) <> 'object'
      or not (v_candidate.normalized_value ?& array['amount','unit'])
      or (select count(*) from jsonb_object_keys(v_candidate.normalized_value)) <> 2
      or jsonb_typeof(v_candidate.normalized_value -> 'amount') <> 'number'
      or jsonb_typeof(v_candidate.normalized_value -> 'unit') <> 'string' then
      raise exception 'trust_phase4_normalized_value_invalid:number_unit' using errcode = '22023';
    end if;
    v_value_number := (v_candidate.normalized_value ->> 'amount')::numeric;
    v_value_unit := v_candidate.normalized_value ->> 'unit';
    if jsonb_typeof(v_allowed_units) = 'array' and not (v_allowed_units ? v_value_unit) then
      raise exception 'trust_phase4_unit_invalid' using errcode = '22023';
    end if;
  elsif v_value_type = 'range_unit' then
    if jsonb_typeof(v_candidate.normalized_value) <> 'object'
      or not (v_candidate.normalized_value ?& array['min','max','unit'])
      or (select count(*) from jsonb_object_keys(v_candidate.normalized_value)) <> 3
      or jsonb_typeof(v_candidate.normalized_value -> 'min') <> 'number'
      or jsonb_typeof(v_candidate.normalized_value -> 'max') <> 'number'
      or jsonb_typeof(v_candidate.normalized_value -> 'unit') <> 'string' then
      raise exception 'trust_phase4_normalized_value_invalid:range_unit' using errcode = '22023';
    end if;
    v_value_range_min := (v_candidate.normalized_value ->> 'min')::numeric;
    v_value_range_max := (v_candidate.normalized_value ->> 'max')::numeric;
    v_value_unit := v_candidate.normalized_value ->> 'unit';
    if v_value_range_min > v_value_range_max then
      raise exception 'trust_phase4_range_invalid' using errcode = '22023';
    end if;
    if jsonb_typeof(v_allowed_units) = 'array' and not (v_allowed_units ? v_value_unit) then
      raise exception 'trust_phase4_unit_invalid' using errcode = '22023';
    end if;
  else
    raise exception 'trust_phase4_value_type_unsupported:%', v_value_type using errcode = '55000';
  end if;

  v_expected_candidate_digest := encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'subject_id', v_candidate.subject_id,
          'registry_version', v_candidate.registry_version,
          'fact_key', v_candidate.fact_key,
          'normalized_value', v_candidate.normalized_value,
          'evidence_class', v_candidate.evidence_class,
          'support_direction', v_candidate.support_direction,
          'negative_admissibility', v_candidate.negative_admissibility,
          'market', v_candidate.market,
          'region', v_candidate.region,
          'locale', v_candidate.locale,
          'qualifier', v_candidate.qualifier,
          'source_content_digest', v_observation.source_content_digest
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  if v_expected_candidate_digest <> v_candidate.canonical_evidence_digest then
    raise exception 'trust_phase4_candidate_digest_mismatch' using errcode = '55000';
  end if;

  v_scope := jsonb_strip_nulls(jsonb_build_object(
    'market', v_candidate.market,
    'variant', v_subject.variant_key
  ));

  v_proposition_key := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object(
      'serializer_version', 'product-fact-proposition-pilot-v1',
      'subject_semantic_key', v_subject.subject_semantic_key,
      'registry_version', v_candidate.registry_version,
      'fact_key', v_candidate.fact_key,
      'value_identity', v_candidate.normalized_value,
      'scope', v_scope,
      'qualifier', v_candidate.qualifier,
      'parent_proposition_key', null
    )
  );

  if exists (
    select 1 from public.product_fact_current c
    where c.proposition_key = v_proposition_key
  ) then
    raise exception 'trust_phase4_candidate_already_current' using errcode = '55000';
  end if;

  if v_cardinality = 'one' and exists (
    select 1
    from public.product_fact_current c
    join public.product_fact_instances fi on fi.fact_instance_id = c.fact_instance_id
    where c.subject_id = v_candidate.subject_id
      and fi.registry_version = v_candidate.registry_version
      and fi.fact_key = v_candidate.fact_key
      and c.proposition_key <> v_proposition_key
  ) then
    raise exception 'trust_phase4_cardinality_collision' using errcode = '55000';
  end if;

  if exists (
    select 1 from public.product_fact_instances fi
    where fi.proposition_key = v_proposition_key
      and (
        fi.subject_id <> v_candidate.subject_id
        or fi.registry_version <> v_candidate.registry_version
        or fi.fact_key <> v_candidate.fact_key
      )
  ) then
    raise exception 'trust_phase4_proposition_collision' using errcode = '55000';
  end if;

  select * into v_existing_evidence
  from public.product_evidence_records
  where canonical_evidence_digest = v_candidate.canonical_evidence_digest;

  if found and (
    v_existing_evidence.subject_id <> v_candidate.subject_id
    or v_existing_evidence.registry_version <> v_candidate.registry_version
    or v_existing_evidence.fact_key <> v_candidate.fact_key
    or v_existing_evidence.proposition_key <> v_proposition_key
    or v_existing_evidence.proposition_serializer_version <> 'product-fact-proposition-pilot-v1'
    or v_existing_evidence.proposition_value_identity is distinct from v_candidate.normalized_value
    or v_existing_evidence.parent_proposition_key is not null
    or v_existing_evidence.evidence_class <> v_candidate.evidence_class
    or v_existing_evidence.evidence_authority <> v_candidate.evidence_authority
    or v_existing_evidence.confidence <> v_candidate.confidence
    or v_existing_evidence.support_direction <> v_candidate.support_direction
    or v_existing_evidence.negative_admissibility <> v_candidate.negative_admissibility
    or v_existing_evidence.market is distinct from v_candidate.market
    or v_existing_evidence.region is distinct from v_candidate.region
    or v_existing_evidence.locale is distinct from v_candidate.locale
    or v_existing_evidence.qualifier is distinct from v_candidate.qualifier
  ) then
    raise exception 'trust_phase4_governed_evidence_collision' using errcode = '55000';
  end if;

  select count(*) into v_open_assignment_count
  from public.product_fact_review_assignments a
  where a.product_id = v_candidate.product_id
    and a.subject_id = v_candidate.subject_id
    and a.registry_version = v_candidate.registry_version
    and a.fact_key = v_candidate.fact_key
    and a.proposition_key = v_proposition_key
    and a.operational_state not in ('confirmed','superseded');

  if v_open_assignment_count > 1 then
    raise exception 'trust_phase4_duplicate_open_assignments' using errcode = '55000';
  end if;

  v_source_payload := jsonb_build_object(
    'canonical_locator', v_observation.canonical_locator,
    'publisher', v_observation.publisher,
    'source_kind', v_observation.source_kind,
    'source_metadata', jsonb_build_object('digest_basis', v_observation.digest_basis),
    'content_digest', v_observation.source_content_digest,
    'external_snapshot_reference', null,
    'market', v_observation.market,
    'region', v_observation.region,
    'locale', v_observation.locale,
    'published_at', null,
    'accessed_at', coalesce(v_observation.fetched_at, v_observation.observed_at),
    'observed_at', v_observation.observed_at
  );

  v_binding_payload := jsonb_build_object(
    'product_id', v_candidate.product_id,
    'subject_id', v_candidate.subject_id,
    'binding_state', 'exact_subject_match',
    'scope_relation', v_binding_scope_relation,
    'presentation_metadata', jsonb_build_object(
      'catalog_source_binding_id', v_observation.source_binding_id
    ),
    'identity_resolution_version', v_intake.identity_resolution_version,
    'reviewed_at', v_candidate.created_at
  );

  v_evidence_payload := jsonb_build_object(
    'registry_version', v_candidate.registry_version,
    'fact_key', v_candidate.fact_key,
    'proposition_key', v_proposition_key,
    'proposition_serializer_version', 'product-fact-proposition-pilot-v1',
    'proposition_value_identity', v_candidate.normalized_value,
    'parent_proposition_key', null,
    'evidence_class', v_candidate.evidence_class,
    'evidence_authority', v_candidate.evidence_authority,
    'confidence', v_candidate.confidence,
    'support_direction', v_candidate.support_direction,
    'negative_admissibility', v_candidate.negative_admissibility,
    'market', v_candidate.market,
    'region', v_candidate.region,
    'locale', v_candidate.locale,
    'valid_from', null,
    'valid_to', null,
    'qualifier', v_candidate.qualifier,
    'canonical_evidence_digest', v_candidate.canonical_evidence_digest,
    'supersedes_evidence_id', null
  );

  v_fusion_input_digest := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object(
      'fusion_policy_version', v_fusion_policy,
      'proposition_key', v_proposition_key,
      'supporting_evidence_digests', jsonb_build_array(v_candidate.canonical_evidence_digest),
      'opposing_evidence_digests', '[]'::jsonb
    )
  );

  v_fact_payload_base := jsonb_build_object(
    'subject_id', v_candidate.subject_id,
    'registry_version', v_candidate.registry_version,
    'fact_key', v_candidate.fact_key,
    'proposition_key', v_proposition_key,
    'proposition_serializer_version', 'product-fact-proposition-pilot-v1',
    'semantic_status', 'supported',
    'value_type', v_value_type,
    'value_boolean', v_value_boolean,
    'value_enum', v_value_enum,
    'value_number', v_value_number,
    'value_unit', v_value_unit,
    'value_range_min', v_value_range_min,
    'value_range_max', v_value_range_max,
    'value_entity_identifier', v_value_entity_identifier,
    'market', v_candidate.market,
    'region', v_candidate.region,
    'locale', v_candidate.locale,
    'valid_from', null,
    'valid_to', null,
    'qualifier', v_candidate.qualifier,
    'parent_fact_instance_id', null,
    'parent_proposition_key', null,
    'authority_ceiling', 'product_specific_primary',
    'fused_confidence', v_candidate.confidence,
    'fusion_policy_version', v_fusion_policy,
    'fusion_input_digest', v_fusion_input_digest
  );

  return jsonb_build_object(
    'candidate_id', v_candidate.candidate_id,
    'product_id', v_candidate.product_id,
    'subject_id', v_candidate.subject_id,
    'registry_version', v_candidate.registry_version,
    'fact_key', v_candidate.fact_key,
    'proposition_key', v_proposition_key,
    'proposition_serializer_version', 'product-fact-proposition-pilot-v1',
    'canonical_evidence_digest', v_candidate.canonical_evidence_digest,
    'source_payload', v_source_payload,
    'binding_payload', v_binding_payload,
    'evidence_payload', v_evidence_payload,
    'fact_payload_base', v_fact_payload_base,
    'open_assignment_count', v_open_assignment_count
  );
end;
$$;

revoke all on function public.claim_trust_research_tasks_v1(integer, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_trust_research_tasks_v1(integer, integer)
  to service_role;

revoke all on function public.record_trust_research_result_v1(uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.record_trust_research_result_v1(uuid, jsonb)
  to service_role;

revoke all on function public.process_trust_reentry_event_v1(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.process_trust_reentry_event_v1(uuid)
  to service_role;

revoke all on function public.trust_phase4_build_adoption_plan_v1(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.trust_phase4_build_adoption_plan_v1(uuid, uuid)
  to service_role;

comment on column public.trust_evidence_candidates.parent_proposition_key is
  'Explicit governed parent proposition identity for Registry relationship-bound facts. Null for non-relational candidates.';

comment on function public.claim_trust_research_tasks_v1(integer, integer) is
  'TRUST research claim boundary with governed Current parent proposition options for relationship-bound facts.';

comment on function public.record_trust_research_result_v1(uuid, jsonb) is
  'TRUST research result boundary. Relationship-bound candidates require an explicit governed Current parent proposition; no parent inference.';

comment on function public.process_trust_reentry_event_v1(uuid) is
  'TRUST re-entry processor. PARENT_PROPOSITION_REQUIRED becomes retryable only when a matching governed Current parent exists.';

comment on function public.trust_phase4_build_adoption_plan_v1(uuid, uuid) is
  'TRUST Phase 4 adoption plan with Phase 7-C legacy compatibility and explicit governed parent-proposition support for relational facts. Final confirmation remains separate.';

commit;
