\set ON_ERROR_STOP on

do $$
declare
  v_task public.product_fact_research_tasks%rowtype;
  v_old_candidate public.trust_evidence_candidates%rowtype;
  v_old_observation public.trust_source_observations%rowtype;
  v_new_observation constant uuid := '83000000-0000-4000-8000-000000000002';
  v_new_candidate constant uuid := '84000000-0000-4000-8000-000000000002';
  v_claim jsonb := '{"claim":"fixture explicit changed product claim","value":false}'::jsonb;
  v_identity jsonb;
  v_source_digest text;
  v_candidate_digest text;
begin
  select rt.* into v_task
  from public.product_fact_revalidation_research_bridges rb
  join public.product_fact_revalidation_transitions tr
    on tr.transition_id = rb.transition_id
  join public.product_fact_research_tasks rt
    on rt.id = rb.research_task_id
  where tr.request_id = 'phase8c-revalidate-0001'
    and rb.disposition = 'RESEARCH_REQUEUED'
  limit 1;

  if not found or v_task.evidence_candidate_id is null then
    raise exception 'phase8f_changed_candidate_task_missing';
  end if;

  select * into v_old_candidate
  from public.trust_evidence_candidates
  where candidate_id = v_task.evidence_candidate_id;

  select * into v_old_observation
  from public.trust_source_observations
  where observation_id = v_task.source_observation_id;

  if not found or v_old_candidate.candidate_id is null then
    raise exception 'phase8f_changed_candidate_lineage_missing';
  end if;

  v_identity := v_old_observation.product_identity_observation;

  v_source_digest := encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'source_binding_id', v_old_observation.source_binding_id,
          'canonical_locator', v_old_observation.canonical_locator,
          'publisher', v_old_observation.publisher,
          'source_kind', v_old_observation.source_kind,
          'market', v_old_observation.market,
          'locale', v_old_observation.locale,
          'observed_claim', v_claim,
          'product_identity_observation', v_identity,
          'observation_version', 'trust-phase8f-changed-observation-v1'
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  insert into public.trust_source_observations (
    observation_id,
    research_task_id,
    product_id,
    subject_id,
    source_binding_id,
    canonical_locator,
    publisher,
    source_kind,
    market,
    region,
    locale,
    observed_claim,
    product_identity_observation,
    observation_version,
    digest_basis,
    source_content_digest,
    observed_at,
    fetched_at
  ) values (
    v_new_observation,
    v_task.id,
    v_task.product_id,
    v_task.subject_id,
    v_old_observation.source_binding_id,
    v_old_observation.canonical_locator,
    v_old_observation.publisher,
    v_old_observation.source_kind,
    v_old_observation.market,
    v_old_observation.region,
    v_old_observation.locale,
    v_claim,
    v_identity,
    'trust-phase8f-changed-observation-v1',
    'frozen-first-party-observation-v1-not-live-page-bytes',
    v_source_digest,
    '2026-09-22T03:00:00+09',
    '2026-09-22T03:00:00+09'
  );

  v_candidate_digest := encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'subject_id', v_task.subject_id,
          'registry_version', v_task.registry_version,
          'fact_key', v_task.fact_key,
          'normalized_value', 'false'::jsonb,
          'evidence_class', v_old_candidate.evidence_class,
          'support_direction', 'opposes',
          'negative_admissibility', 'explicit_negative',
          'market', v_old_candidate.market,
          'region', v_old_candidate.region,
          'locale', v_old_candidate.locale,
          'qualifier', v_old_candidate.qualifier,
          'source_content_digest', v_source_digest
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  insert into public.trust_evidence_candidates (
    candidate_id,
    research_task_id,
    observation_id,
    product_id,
    subject_id,
    registry_version,
    fact_key,
    normalized_value,
    evidence_class,
    evidence_authority,
    confidence,
    support_direction,
    negative_admissibility,
    market,
    region,
    locale,
    qualifier,
    candidate_state,
    canonical_evidence_digest
  ) values (
    v_new_candidate,
    v_task.id,
    v_new_observation,
    v_task.product_id,
    v_task.subject_id,
    v_task.registry_version,
    v_task.fact_key,
    'false'::jsonb,
    v_old_candidate.evidence_class,
    v_old_candidate.evidence_authority,
    v_old_candidate.confidence,
    'opposes',
    'explicit_negative',
    v_old_candidate.market,
    v_old_candidate.region,
    v_old_candidate.locale,
    v_old_candidate.qualifier,
    'READY',
    v_candidate_digest
  );

  update public.product_fact_research_tasks
  set state = 'EVIDENCE_CANDIDATE',
      source_content_digest = v_source_digest,
      source_observation_id = v_new_observation,
      evidence_candidate_id = v_new_candidate,
      updated_at = now()
  where id = v_task.id;
end;
$$;

select 'TRUST_PHASE8F_CHANGED_CANDIDATE_PREPARED';
