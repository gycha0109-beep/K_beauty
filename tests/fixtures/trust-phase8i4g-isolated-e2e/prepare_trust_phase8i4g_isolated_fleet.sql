\set ON_ERROR_STOP on

-- Expand the already-governed Phase 4 Current proposition into three immutable
-- historical Evidence Sources sharing one reviewed official locator. This runs
-- only after the canonical Phase 4 runtime has explicitly confirmed Current.

do $$
declare
  v_source public.product_evidence_sources%rowtype;
  v_binding public.product_evidence_source_subject_bindings%rowtype;
  v_evidence public.product_evidence_records%rowtype;
begin
  select s.* into strict v_source
  from public.product_evidence_sources s
  join public.product_evidence_records e on e.source_id=s.source_id
  join public.product_fact_current c
    on c.proposition_key=e.proposition_key
   and c.subject_id=e.subject_id
  where e.support_direction='supports'
  order by s.created_at,s.source_id
  limit 1;

  select b.* into strict v_binding
  from public.product_evidence_source_subject_bindings b
  where b.source_id=v_source.source_id
    and b.binding_state='exact_subject_match'
    and b.scope_relation='equivalent'
  order by b.reviewed_at,b.binding_id
  limit 1;

  select e.* into strict v_evidence
  from public.product_evidence_records e
  join public.product_fact_current c
    on c.proposition_key=e.proposition_key
   and c.subject_id=e.subject_id
  where e.source_id=v_source.source_id
    and e.support_direction='supports'
  order by e.created_at,e.evidence_id
  limit 1;

  insert into public.product_evidence_sources(
    source_id,canonical_locator,publisher,source_kind,source_metadata,
    content_digest,external_snapshot_reference,market,region,locale,
    published_at,accessed_at,observed_at
  ) values
  (
    '93000000-0000-4000-8000-000000000002',
    v_source.canonical_locator,
    v_source.publisher,
    v_source.source_kind,
    coalesce(v_source.source_metadata,'{}'::jsonb) || '{"fixture_clone":2}'::jsonb,
    repeat('2',64),
    null,
    v_source.market,v_source.region,v_source.locale,
    v_source.published_at,v_source.accessed_at,v_source.observed_at
  ),
  (
    '93000000-0000-4000-8000-000000000003',
    v_source.canonical_locator,
    v_source.publisher,
    v_source.source_kind,
    coalesce(v_source.source_metadata,'{}'::jsonb) || '{"fixture_clone":3}'::jsonb,
    repeat('3',64),
    null,
    v_source.market,v_source.region,v_source.locale,
    v_source.published_at,v_source.accessed_at,v_source.observed_at
  );

  insert into public.product_evidence_source_subject_bindings(
    binding_id,source_id,product_id,subject_id,binding_state,scope_relation,
    presentation_metadata,identity_resolution_version,reviewed_by,reviewed_at
  ) values
  (
    '94000000-0000-4000-8000-000000000002',
    '93000000-0000-4000-8000-000000000002',
    v_binding.product_id,v_binding.subject_id,
    'exact_subject_match','equivalent',
    '{"fixture_clone":2}'::jsonb,
    v_binding.identity_resolution_version,
    '92000000-0000-4000-8000-000000000001',
    v_binding.reviewed_at + interval '1 second'
  ),
  (
    '94000000-0000-4000-8000-000000000003',
    '93000000-0000-4000-8000-000000000003',
    v_binding.product_id,v_binding.subject_id,
    'exact_subject_match','equivalent',
    '{"fixture_clone":3}'::jsonb,
    v_binding.identity_resolution_version,
    '92000000-0000-4000-8000-000000000001',
    v_binding.reviewed_at + interval '2 seconds'
  );

  insert into public.product_evidence_records(
    evidence_id,source_id,binding_id,binding_state,subject_id,
    registry_version,fact_key,proposition_key,proposition_serializer_version,
    proposition_value_identity,parent_proposition_key,evidence_class,
    evidence_authority,confidence,support_direction,negative_admissibility,
    market,region,locale,valid_from,valid_to,qualifier,
    canonical_evidence_digest,supersedes_evidence_id
  ) values
  (
    '95000000-0000-4000-8000-000000000002',
    '93000000-0000-4000-8000-000000000002',
    '94000000-0000-4000-8000-000000000002',
    'exact_subject_match',
    v_evidence.subject_id,
    v_evidence.registry_version,v_evidence.fact_key,v_evidence.proposition_key,
    v_evidence.proposition_serializer_version,v_evidence.proposition_value_identity,
    v_evidence.parent_proposition_key,v_evidence.evidence_class,
    v_evidence.evidence_authority,v_evidence.confidence,
    v_evidence.support_direction,v_evidence.negative_admissibility,
    v_evidence.market,v_evidence.region,v_evidence.locale,
    v_evidence.valid_from,v_evidence.valid_to,
    coalesce(v_evidence.qualifier,'{}'::jsonb) || '{"fixture_clone":2}'::jsonb,
    repeat('4',64),null
  ),
  (
    '95000000-0000-4000-8000-000000000003',
    '93000000-0000-4000-8000-000000000003',
    '94000000-0000-4000-8000-000000000003',
    'exact_subject_match',
    v_evidence.subject_id,
    v_evidence.registry_version,v_evidence.fact_key,v_evidence.proposition_key,
    v_evidence.proposition_serializer_version,v_evidence.proposition_value_identity,
    v_evidence.parent_proposition_key,v_evidence.evidence_class,
    v_evidence.evidence_authority,v_evidence.confidence,
    v_evidence.support_direction,v_evidence.negative_admissibility,
    v_evidence.market,v_evidence.region,v_evidence.locale,
    v_evidence.valid_from,v_evidence.valid_to,
    coalesce(v_evidence.qualifier,'{}'::jsonb) || '{"fixture_clone":3}'::jsonb,
    repeat('5',64),null
  );
end;
$$;

do $$
declare
  v_count integer;
  v_locator_count integer;
begin
  select count(*) into v_count
  from public.trust_official_source_transport_targets_v1()
  where target_status='READY';

  select count(distinct effective_locator) into v_locator_count
  from public.trust_official_source_transport_targets_v1()
  where target_status='READY';

  if v_count<>3 or v_locator_count<>1 then
    raise exception 'trust_phase8i4g_isolated_transport_fleet_invalid:%:%',
      v_count,v_locator_count;
  end if;
end;
$$;

select 'TRUST_PHASE8I4G_ISOLATED_FLEET_READY';
