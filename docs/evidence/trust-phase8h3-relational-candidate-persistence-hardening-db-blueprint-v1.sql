-- TRUST Phase 8H-3 relational candidate persistence hardening.
-- Restores the Phase 7D parent-aware research candidate contract that was
-- accidentally regressed by the later 8H-3 relocation recorder replacement.
-- Preserves confirmed-relocation replacement binding authority and the
-- 20260928040319 SECURITY DEFINER search_path hardening.
-- TRUST Phase 8H-3 follow-up hardening.
-- Preserve the already-applied 20260927131237 relocation research seed migration as historical provenance.
-- This replacement changes only SECURITY DEFINER search_path/ACL posture for record_trust_research_result_v1.
CREATE OR REPLACE FUNCTION public.record_trust_research_result_v1(p_task_id uuid, p_result jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
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
  v_existing_candidate public.trust_evidence_candidates%rowtype;
  v_relational_repair boolean := false;
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
    select * into v_existing_candidate
    from public.trust_evidence_candidates
    where candidate_id = v_task.evidence_candidate_id;

    if not found
      or v_existing_candidate.research_task_id <> v_task.id
      or v_existing_candidate.observation_id is distinct from v_task.source_observation_id then
      raise exception 'trust_research_existing_candidate_pointer_stale'
        using errcode = '40001';
    end if;

    if nullif(lower(btrim(coalesce(p_result #>> '{candidate,parent_proposition_key}',''))), '') is null
      or v_existing_candidate.parent_proposition_key is not null then
      return jsonb_build_object(
        'task_id', p_task_id,
        'outcome', 'EVIDENCE_CANDIDATE',
        'source_observation_id', v_task.source_observation_id,
        'evidence_candidate_id', v_task.evidence_candidate_id,
        'idempotent_replay', true,
        'relational_repair', false
      );
    end if;

    v_relational_repair := true;
  end if;

  if v_task.state <> 'RESEARCHING' and not v_relational_repair then
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

  if v_subject.variant_key is not null then
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
  if v_existing_current and not exists (
    select 1
    from public.product_fact_revalidation_research_bridges rb
    join public.product_fact_revalidation_transitions tr
      on tr.transition_id = rb.transition_id
    join public.product_fact_review_assignments ra
      on ra.assignment_id = rb.assignment_id
    where rb.research_task_id = v_task.id
      and rb.disposition = 'RESEARCH_REQUEUED'
      and tr.assignment_id = ra.assignment_id
      and tr.fact_instance_id = (
        select c.fact_instance_id
        from public.product_fact_current c
        join public.product_fact_instances fi
          on fi.fact_instance_id = c.fact_instance_id
        where c.subject_id = v_task.subject_id
          and fi.registry_version = v_task.registry_version
          and fi.fact_key = v_task.fact_key
        order by c.updated_at desc
        limit 1
      )
      and ra.operational_state = 're_review_required'
  ) then
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

  select b.* into v_binding
  from public.product_source_bindings b
  where b.binding_id = nullif(v_source ->> 'source_binding_id','')::uuid
    and b.product_id = v_task.product_id
    and b.binding_state = 'resolved'
    and b.source_name ~ '_official$'
    and b.source_url ~ '^https://'
    and (
      b.market_code is not distinct from v_intake.market
      or exists (
        select 1
          from public.product_fact_revalidation_research_bridges rb0
          join public.product_fact_revalidation_transitions rt0
            on rt0.transition_id = rb0.transition_id
          join public.trust_official_source_relocations r0
            on r0.relocation_id = rt0.relocation_id
          join public.trust_official_source_binding_reviews rv0
            on rv0.review_id = r0.replacement_review_id
         where rb0.research_task_id = v_task.id
           and rb0.disposition = 'RESEARCH_REQUEUED'
           and rt0.reason_code = 'source_relocated'
           and r0.result = 'confirmed'
           and r0.product_id = v_task.product_id
           and r0.subject_id = v_task.subject_id
           and r0.replacement_binding_id = b.binding_id
           and rv0.binding_id = b.binding_id
           and rv0.product_id = v_task.product_id
           and rv0.subject_id = v_task.subject_id
           and rv0.scope_relation = 'equivalent'
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
      or v_parent_proposition_key !~ '^[0-9a-f]{64}$'
      or v_parent_fact_key is null then
      raise exception 'trust_research_parent_proposition_required'
        using errcode = '23514';
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
      raise exception 'trust_research_parent_proposition_invalid'
        using errcode = '23514';
    end if;

    if (v_parent_fact.market is not null and v_parent_fact.market is distinct from v_intake.market)
      or (v_parent_fact.region is not null and v_parent_fact.region is distinct from nullif(v_candidate ->> 'region','')) then
      raise exception 'trust_research_parent_scope_mismatch'
        using errcode = '23514';
    end if;
  elsif v_parent_proposition_key is not null then
    raise exception 'trust_research_parent_proposition_unexpected'
      using errcode = '23514';
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

  v_evidence_digest := encode(extensions.digest(convert_to((
    jsonb_build_object(
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
    )
    || case
      when v_parent_proposition_key is null then '{}'::jsonb
      else jsonb_build_object('parent_proposition_key', v_parent_proposition_key)
    end
  )::text,'UTF8'),'sha256'),'hex');

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
    'canonical_evidence_digest', v_evidence_digest,
    'relational_repair', v_relational_repair
  );
end;
$function$;

revoke all on function public.record_trust_research_result_v1(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_trust_research_result_v1(uuid, jsonb)
  to service_role;
