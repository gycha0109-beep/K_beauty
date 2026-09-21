\set ON_ERROR_STOP on

create temporary table phase7c_p4_baseline as
select
  (select count(*) from public.product_evidence_records) evidence,
  (select count(*) from public.product_fact_instances) instances,
  (select count(*) from public.product_fact_confirmations) confirmations,
  (select count(*) from public.product_fact_current) current_rows,
  (select count(*) from public.product_fact_review_assignments) assignments;

do $test$
declare
  v_actor constant uuid := '92000000-0000-4000-8000-000000000001';
  v_variant constant uuid := '84000000-0000-4000-8000-000000000001';
  v_null constant uuid := '84000000-0000-4000-8000-000000000002';
  v_plan jsonb;
  v_adopt jsonb;
  v_failed boolean;
  v_definition jsonb;
  v_checksum text;
begin
  -- Variant-scoped legacy candidate is accepted only under the frozen Phase 7-B scope.
  v_plan := public.trust_phase4_build_adoption_plan_v1(v_actor,v_variant);
  if v_plan->>'candidate_id' <> v_variant::text
    or v_plan#>>'{binding_payload,scope_relation}' <> 'equivalent'
    or v_plan#>>'{fact_payload_base,market}' <> 'KR'
  then
    raise exception 'phase7c_p4_variant_plan_invalid:%',v_plan;
  end if;

  -- NULL-market legacy candidate preserves Subject/fact market NULL while the
  -- governed source remains KR and the reviewed binding is narrower.
  v_plan := public.trust_phase4_build_adoption_plan_v1(v_actor,v_null);
  if v_plan->>'candidate_id' <> v_null::text
    or v_plan#>>'{binding_payload,scope_relation}' <> 'narrower'
    or (v_plan#>'{source_payload,market}') is distinct from to_jsonb('KR'::text)
    or (v_plan#>'{evidence_payload,market}') <> 'null'::jsonb
    or (v_plan#>'{fact_payload_base,market}') <> 'null'::jsonb
  then
    raise exception 'phase7c_p4_null_market_plan_invalid:%',v_plan;
  end if;

  -- Non-legacy variant behavior remains rejected.
  update public.catalog_trust_intake
  set catalog_revision='phase4-nonlegacy-fixture'
  where id='81000000-0000-4000-8000-000000000001';
  v_failed := false;
  begin
    perform public.admin_preflight_trust_evidence_adoption_v1(v_actor,v_variant);
  exception when sqlstate '55000' then
    if sqlerrm='trust_phase4_subject_identity_invalid' then
      v_failed := true;
    else
      raise;
    end if;
  end;
  if not v_failed then
    raise exception 'phase7c_p4_nonlegacy_variant_not_rejected';
  end if;
  update public.catalog_trust_intake
  set catalog_revision='legacy-backfill-v1:' || repeat('1',64)
  where id='81000000-0000-4000-8000-000000000001';

  -- A controlled source review must exactly match the observed source market.
  update public.trust_official_source_binding_reviews
  set source_market='US'
  where review_id='86000000-0000-4000-8000-000000000001';
  v_failed := false;
  begin
    perform public.admin_preflight_trust_evidence_adoption_v1(v_actor,v_variant);
  exception when sqlstate '55000' then
    if sqlerrm='trust_phase4_legacy_controlled_source_invalid' then
      v_failed := true;
    else
      raise;
    end if;
  end;
  if not v_failed then
    raise exception 'phase7c_p4_wrong_source_scope_not_rejected';
  end if;
  update public.trust_official_source_binding_reviews
  set source_market='KR'
  where review_id='86000000-0000-4000-8000-000000000001';

  -- Relationship facts remain outside this compatibility change.
  select definition,definition_checksum
  into v_definition,v_checksum
  from public.product_fact_definition_snapshots
  where registry_version='trust-phase4-fixture-registry-v1'
    and fact_key='phase4_fixture_claim';

  update public.product_fact_definition_snapshots
  set definition=jsonb_set(
    definition,
    '{relationship_schema,subject_ref_required}',
    'true'::jsonb,
    true
  )
  where registry_version='trust-phase4-fixture-registry-v1'
    and fact_key='phase4_fixture_claim';

  v_failed := false;
  begin
    perform public.admin_preflight_trust_evidence_adoption_v1(v_actor,v_variant);
  exception when sqlstate '55000' then
    if sqlerrm='trust_phase4_parent_proposition_required' then
      v_failed := true;
    else
      raise;
    end if;
  end;
  if not v_failed then
    raise exception 'phase7c_p4_relationship_guard_weakened';
  end if;

  update public.product_fact_definition_snapshots
  set definition=v_definition,definition_checksum=v_checksum
  where registry_version='trust-phase4-fixture-registry-v1'
    and fact_key='phase4_fixture_claim';

  -- Zero-write preflight did not mutate governed authority.
  if (select count(*) from public.product_evidence_records) <> (select evidence from phase7c_p4_baseline)
    or (select count(*) from public.product_fact_instances) <> (select instances from phase7c_p4_baseline)
    or (select count(*) from public.product_fact_confirmations) <> (select confirmations from phase7c_p4_baseline)
    or (select count(*) from public.product_fact_current) <> (select current_rows from phase7c_p4_baseline)
  then
    raise exception 'phase7c_p4_preflight_mutated_authority';
  end if;

  -- Actual adoption may ingest Evidence and prepare review/preflight, but must
  -- still stop before final Product Fact confirmation.
  v_adopt := public.admin_adopt_trust_evidence_candidate_v1(
    v_actor,'phase7c-p4-adopt-variant',v_variant
  );
  if v_adopt->>'status' <> 'ready_for_explicit_confirmation'
    or coalesce((v_adopt->>'automatic_confirmation')::boolean,true)
  then
    raise exception 'phase7c_p4_variant_adoption_boundary_invalid:%',v_adopt;
  end if;

  v_adopt := public.admin_adopt_trust_evidence_candidate_v1(
    v_actor,'phase7c-p4-adopt-null',v_null
  );
  if v_adopt->>'status' <> 'ready_for_explicit_confirmation'
    or coalesce((v_adopt->>'automatic_confirmation')::boolean,true)
  then
    raise exception 'phase7c_p4_null_adoption_boundary_invalid:%',v_adopt;
  end if;

  if (select count(*) from public.product_evidence_records) <> (select evidence+2 from phase7c_p4_baseline)
    or (select count(*) from public.product_fact_confirmations) <> (select confirmations from phase7c_p4_baseline)
    or (select count(*) from public.product_fact_current) <> (select current_rows from phase7c_p4_baseline)
  then
    raise exception 'phase7c_p4_adoption_crossed_confirmation_boundary';
  end if;

  if not exists (
    select 1
    from public.product_evidence_source_subject_bindings b
    join public.product_evidence_sources s on s.source_id=b.source_id
    where b.subject_id=(select subject_id from public.trust_evidence_candidates where candidate_id=v_null)
      and b.scope_relation='narrower'
      and s.market='KR'
  ) then
    raise exception 'phase7c_p4_narrower_governed_binding_missing';
  end if;
end;
$test$;

select 'TRUST_PHASE7C_PHASE4_LEGACY_COMPAT_RUNTIME_VERIFIED' as verification_result;
