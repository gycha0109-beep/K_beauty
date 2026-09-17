\set ON_ERROR_STOP on

create temporary table trust_p4_results (
  test_name text primary key,
  status text not null,
  detail jsonb not null default '{}'::jsonb
) on commit preserve rows;

create or replace function pg_temp.assert_true(p_condition boolean, p_code text)
returns void
language plpgsql
as $$
begin
  if coalesce(p_condition, false) is not true then
    raise exception '%', p_code;
  end if;
end;
$$;

-- 1. Zero-write Phase 4 preflight and exact proposition replay.
do $$
declare
  v_actor constant uuid := '92000000-0000-4000-8000-000000000001';
  v_candidate constant uuid := '84000000-0000-4000-8000-000000000001';
  v_preflight jsonb;
  v_subject_key text;
  v_expected_prop text;
  v_evidence_before bigint;
  v_assignment_before bigint;
  v_current_before bigint;
begin
  select count(*) into v_evidence_before from public.product_evidence_records;
  select count(*) into v_assignment_before from public.product_fact_review_assignments;
  select count(*) into v_current_before from public.product_fact_current;
  v_preflight := public.admin_preflight_trust_evidence_adoption_v1(v_actor, v_candidate);
  perform pg_temp.assert_true(v_preflight ->> 'status'='ready','trust_p4_preflight_not_ready');
  perform pg_temp.assert_true((v_preflight ->> 'automatic_confirmation')::boolean=false,'trust_p4_preflight_auto_confirm');
  perform pg_temp.assert_true((select count(*) from public.product_evidence_records)=v_evidence_before,'trust_p4_preflight_evidence_write');
  perform pg_temp.assert_true((select count(*) from public.product_fact_review_assignments)=v_assignment_before,'trust_p4_preflight_assignment_write');
  perform pg_temp.assert_true((select count(*) from public.product_fact_current)=v_current_before,'trust_p4_preflight_current_write');

  select subject_semantic_key into v_subject_key
  from public.product_fact_subjects
  where subject_id=(v_preflight ->> 'subject_id')::uuid;
  v_expected_prop := public.product_fact_controlled_sha256_json_v1(jsonb_build_object(
    'serializer_version','product-fact-proposition-pilot-v1',
    'subject_semantic_key',v_subject_key,
    'registry_version',v_preflight ->> 'registry_version',
    'fact_key',v_preflight ->> 'fact_key',
    'value_identity','true'::jsonb,
    'scope',jsonb_build_object('market','KR'),
    'qualifier','{}'::jsonb,
    'parent_proposition_key',null
  ));
  perform pg_temp.assert_true(v_preflight ->> 'proposition_key'=v_expected_prop,'trust_p4_serializer_replay_mismatch');
  insert into trust_p4_results values ('preflight_zero_write_and_serializer','PASS',jsonb_build_object('proposition_key',v_expected_prop));
end;
$$;

-- 2. non-READY fails closed.
do $$
declare v_message text;
begin
  update public.trust_evidence_candidates set candidate_state='REVIEW_REQUIRED'
  where candidate_id='84000000-0000-4000-8000-000000000001';
  begin
    perform public.admin_preflight_trust_evidence_adoption_v1(
      '92000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000001');
    raise exception 'trust_p4_non_ready_not_rejected';
  exception when others then
    get stacked diagnostics v_message=message_text;
    if v_message='trust_p4_non_ready_not_rejected' then raise; end if;
    perform pg_temp.assert_true(v_message like 'trust_phase4_candidate_not_ready:%','trust_p4_non_ready_wrong_error');
  end;
  update public.trust_evidence_candidates set candidate_state='READY'
  where candidate_id='84000000-0000-4000-8000-000000000001';
  insert into trust_p4_results values ('non_ready_fail_closed','PASS',jsonb_build_object('message',v_message));
end;
$$;

-- 3. Product/Subject lineage mismatch fails closed.
do $$
declare v_message text;
begin
  update public.trust_evidence_candidates set product_id='00000000-0000-4000-8000-000000000305'
  where candidate_id='84000000-0000-4000-8000-000000000001';
  begin
    perform public.admin_preflight_trust_evidence_adoption_v1(
      '92000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000001');
    raise exception 'trust_p4_identity_mismatch_not_rejected';
  exception when others then
    get stacked diagnostics v_message=message_text;
    if v_message='trust_p4_identity_mismatch_not_rejected' then raise; end if;
    perform pg_temp.assert_true(v_message='trust_phase4_research_task_lineage_invalid','trust_p4_identity_mismatch_wrong_error');
  end;
  update public.trust_evidence_candidates set product_id='00000000-0000-4000-8000-000000000301'
  where candidate_id='84000000-0000-4000-8000-000000000001';
  insert into trust_p4_results values ('identity_mismatch_fail_closed','PASS',jsonb_build_object('message',v_message));
end;
$$;

-- 4. Frozen observation tampering fails closed.
do $$
declare v_original jsonb; v_message text;
begin
  select observed_claim into v_original from public.trust_source_observations
  where observation_id='83000000-0000-4000-8000-000000000001';
  update public.trust_source_observations set observed_claim='{"claim":"tampered"}'::jsonb
  where observation_id='83000000-0000-4000-8000-000000000001';
  begin
    perform public.admin_preflight_trust_evidence_adoption_v1(
      '92000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000001');
    raise exception 'trust_p4_observation_tamper_not_rejected';
  exception when others then
    get stacked diagnostics v_message=message_text;
    if v_message='trust_p4_observation_tamper_not_rejected' then raise; end if;
    perform pg_temp.assert_true(v_message='trust_phase4_source_observation_digest_mismatch','trust_p4_observation_tamper_wrong_error');
  end;
  update public.trust_source_observations set observed_claim=v_original
  where observation_id='83000000-0000-4000-8000-000000000001';
  insert into trust_p4_results values ('observation_digest_tamper_fail_closed','PASS',jsonb_build_object('message',v_message));
end;
$$;

-- 5. Candidate digest tampering fails closed.
do $$
declare v_original text; v_message text;
begin
  select canonical_evidence_digest into v_original from public.trust_evidence_candidates
  where candidate_id='84000000-0000-4000-8000-000000000001';
  update public.trust_evidence_candidates set canonical_evidence_digest=repeat('0',64)
  where candidate_id='84000000-0000-4000-8000-000000000001';
  begin
    perform public.admin_preflight_trust_evidence_adoption_v1(
      '92000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000001');
    raise exception 'trust_p4_candidate_tamper_not_rejected';
  exception when others then
    get stacked diagnostics v_message=message_text;
    if v_message='trust_p4_candidate_tamper_not_rejected' then raise; end if;
    perform pg_temp.assert_true(v_message='trust_phase4_candidate_digest_mismatch','trust_p4_candidate_tamper_wrong_error');
  end;
  update public.trust_evidence_candidates set canonical_evidence_digest=v_original
  where candidate_id='84000000-0000-4000-8000-000000000001';
  insert into trust_p4_results values ('candidate_digest_tamper_fail_closed','PASS',jsonb_build_object('message',v_message));
end;
$$;

-- 6. Governed Evidence with the candidate digest but a different proposition
-- is an identity/serializer collision. The adversarial setup is rolled back.
begin;
do $$
declare
  v_subject uuid;
  v_digest text;
  v_source_digest text;
  v_message text;
begin
  select subject_id,canonical_evidence_digest into v_subject,v_digest
  from public.trust_evidence_candidates where candidate_id='84000000-0000-4000-8000-000000000001';
  select source_content_digest into v_source_digest
  from public.trust_source_observations where observation_id='83000000-0000-4000-8000-000000000001';
  perform public.admin_ingest_product_fact_evidence_v1(
    '92000000-0000-4000-8000-000000000001','trust-p4-bad-ingest-0001',
    jsonb_build_object(
      'source',jsonb_build_object(
        'canonical_locator','https://official.example.test/trust-phase4-fixture','publisher','fixture_official',
        'source_kind','brand_official_product_page','source_metadata',jsonb_build_object('digest_basis','frozen-first-party-observation-v1-not-live-page-bytes'),
        'content_digest',v_source_digest,'external_snapshot_reference',null,'market','KR','region',null,'locale','ko-KR',
        'published_at',null,'accessed_at','2026-09-17T10:00:00Z','observed_at','2026-09-17T10:00:00Z'),
      'binding',jsonb_build_object(
        'product_id','00000000-0000-4000-8000-000000000301','subject_id',v_subject,'binding_state','exact_subject_match',
        'scope_relation','equivalent','presentation_metadata',jsonb_build_object('catalog_source_binding_id','85000000-0000-4000-8000-000000000001'),
        'identity_resolution_version','trust-phase4-fixture-identity-v1','reviewed_at','2026-09-17T10:00:00Z'),
      'evidence',jsonb_build_object(
        'registry_version','trust-phase4-fixture-registry-v1','fact_key','phase4_fixture_claim','proposition_key',repeat('b',64),
        'proposition_serializer_version','product-fact-proposition-pilot-v1','proposition_value_identity','true'::jsonb,'parent_proposition_key',null,
        'evidence_class','product_claim','evidence_authority','product_specific_primary','confidence','high','support_direction','supports',
        'negative_admissibility','not_applicable','market','KR','region',null,'locale','ko-KR','valid_from',null,'valid_to',null,
        'qualifier','{}'::jsonb,'canonical_evidence_digest',v_digest,'supersedes_evidence_id',null)
    ));
  begin
    perform public.admin_preflight_trust_evidence_adoption_v1(
      '92000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000001');
    raise exception 'trust_p4_collision_not_rejected';
  exception when others then
    get stacked diagnostics v_message=message_text;
    if v_message='trust_p4_collision_not_rejected' then raise; end if;
    perform pg_temp.assert_true(v_message='trust_phase4_governed_evidence_collision','trust_p4_collision_wrong_error');
  end;
end;
$$;
rollback;
insert into trust_p4_results values ('serializer_identity_collision_fail_closed','PASS','{}'::jsonb);

-- 7. Wrapper reaches governed confirmation preflight but does not create Current.
create temporary table trust_p4_adoption as
select public.admin_adopt_trust_evidence_candidate_v1(
  '92000000-0000-4000-8000-000000000001','trust-p4-adopt-0001','84000000-0000-4000-8000-000000000001'
) as result;

do $$
declare v_result jsonb := (select result from trust_p4_adoption);
begin
  perform pg_temp.assert_true(v_result ->> 'status'='ready_for_explicit_confirmation','trust_p4_adopt_status');
  perform pg_temp.assert_true((v_result ->> 'automatic_confirmation')::boolean=false,'trust_p4_adopt_auto_confirm');
  perform pg_temp.assert_true(v_result #>> '{product_fact_preflight,status}'='ready','trust_p4_pf_preflight_status');
  perform pg_temp.assert_true(v_result #>> '{product_fact_preflight,fusion_input_digest}'=v_result #>> '{confirmation_payload,fusion_input_digest}','trust_p4_fusion_digest_mismatch');
  perform pg_temp.assert_true((select count(*) from public.product_fact_current)=0,'trust_p4_wrapper_changed_current');
  perform pg_temp.assert_true((select count(*) from public.product_fact_confirmations)=0,'trust_p4_wrapper_created_confirmation');
  insert into trust_p4_results values ('governed_handoff_without_confirm','PASS',jsonb_build_object('evidence_id',v_result->>'governed_evidence_id','assignment_id',v_result->>'assignment_id'));
end;
$$;

-- 8. Exact replay reuses governed Evidence and open assignment.
do $$
declare
  v_first jsonb := (select result from trust_p4_adoption);
  v_second jsonb;
  v_evidence_before bigint := (select count(*) from public.product_evidence_records);
  v_assignment_before bigint := (select count(*) from public.product_fact_review_assignments);
begin
  v_second := public.admin_adopt_trust_evidence_candidate_v1(
    '92000000-0000-4000-8000-000000000001','trust-p4-adopt-0002','84000000-0000-4000-8000-000000000001');
  perform pg_temp.assert_true(v_second ->> 'governed_evidence_id'=v_first ->> 'governed_evidence_id','trust_p4_replay_evidence_changed');
  perform pg_temp.assert_true(v_second ->> 'assignment_id'=v_first ->> 'assignment_id','trust_p4_replay_assignment_changed');
  perform pg_temp.assert_true((v_second ->> 'assignment_reused')::boolean,'trust_p4_replay_assignment_not_reused');
  perform pg_temp.assert_true((select count(*) from public.product_evidence_records)=v_evidence_before,'trust_p4_replay_duplicate_evidence');
  perform pg_temp.assert_true((select count(*) from public.product_fact_review_assignments)=v_assignment_before,'trust_p4_replay_duplicate_assignment');
  perform pg_temp.assert_true((select count(*) from public.product_fact_current)=0,'trust_p4_replay_changed_current');
  insert into trust_p4_results values ('replay_idempotent_before_confirm','PASS',jsonb_build_object('evidence_rows',v_evidence_before,'assignment_rows',v_assignment_before));
end;
$$;

-- 9. Existing confirmation authority is invoked explicitly outside the wrapper.
do $$
declare
  v_result jsonb := (select result from trust_p4_adoption);
  v_confirm jsonb;
begin
  v_confirm := public.admin_confirm_product_fact_v1(
    '92000000-0000-4000-8000-000000000001',
    v_result ->> 'confirmation_request_id',
    v_result -> 'confirmation_payload',
    v_result #>> '{product_fact_preflight,payload_digest}',
    v_result #>> '{product_fact_preflight,prestate_digest}'
  );
  perform pg_temp.assert_true(v_confirm ->> 'status'='confirmed','trust_p4_explicit_confirm_failed');
  perform pg_temp.assert_true((select count(*) from public.product_fact_current)=1,'trust_p4_explicit_confirm_current_count');
  perform pg_temp.assert_true((select count(*) from public.product_fact_confirmations)=1,'trust_p4_explicit_confirm_confirmation_count');
  insert into trust_p4_results values ('explicit_existing_confirm_authority','PASS',jsonb_build_object('confirmation_id',v_confirm->>'confirmation_id'));
end;
$$;

-- 10. A candidate whose proposition is already Current is not consumed again.
do $$
declare v_message text;
begin
  begin
    perform public.admin_preflight_trust_evidence_adoption_v1(
      '92000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000001');
    raise exception 'trust_p4_already_current_not_rejected';
  exception when others then
    get stacked diagnostics v_message=message_text;
    if v_message='trust_p4_already_current_not_rejected' then raise; end if;
    perform pg_temp.assert_true(v_message='trust_phase4_candidate_already_current','trust_p4_already_current_wrong_error');
  end;
  insert into trust_p4_results values ('already_current_fail_closed','PASS',jsonb_build_object('message',v_message));
end;
$$;

-- 11. Runtime ACL/RLS boundary.
do $$
declare v_rel_count bigint;
begin
  perform pg_temp.assert_true(has_function_privilege('service_role','public.admin_preflight_trust_evidence_adoption_v1(uuid,uuid)','EXECUTE'),'trust_p4_service_preflight_acl');
  perform pg_temp.assert_true(has_function_privilege('service_role','public.admin_adopt_trust_evidence_candidate_v1(uuid,text,uuid)','EXECUTE'),'trust_p4_service_adopt_acl');
  perform pg_temp.assert_true(not has_function_privilege('service_role','public.trust_phase4_build_adoption_plan_v1(uuid,uuid)','EXECUTE'),'trust_p4_internal_service_acl');
  perform pg_temp.assert_true(not has_function_privilege('anon','public.admin_preflight_trust_evidence_adoption_v1(uuid,uuid)','EXECUTE'),'trust_p4_anon_preflight_acl');
  perform pg_temp.assert_true(not has_function_privilege('authenticated','public.admin_adopt_trust_evidence_candidate_v1(uuid,text,uuid)','EXECUTE'),'trust_p4_auth_adopt_acl');
  select count(*) into v_rel_count
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public'
    and c.relname in ('catalog_trust_intake','product_fact_research_tasks','trust_source_observations','trust_evidence_candidates')
    and c.relrowsecurity;
  perform pg_temp.assert_true(v_rel_count=4,'trust_p4_staging_rls');
  perform pg_temp.assert_true(not has_table_privilege('service_role','public.trust_evidence_candidates','INSERT'),'trust_p4_candidate_direct_write_acl');
  perform pg_temp.assert_true(not has_table_privilege('service_role','public.product_evidence_records','INSERT'),'trust_p4_governed_direct_write_acl');
  insert into trust_p4_results values ('runtime_security','PASS',jsonb_build_object('staging_rls',v_rel_count));
end;
$$;

select pg_temp.assert_true((select count(*) from trust_p4_results where status='PASS')=11,'trust_p4_required_result_count');

select 'TRUST_PHASE4_RUNTIME_JSON=' || jsonb_build_object(
  'status','PASS',
  'phase','TRUST_PHASE4_CONTROLLED_EVIDENCE_ADOPTION_RUNTIME',
  'tests',(select jsonb_agg(jsonb_build_object('name',test_name,'status',status,'detail',detail) order by test_name) from trust_p4_results),
  'governed_evidence_count',(select count(*) from public.product_evidence_records),
  'assignment_count',(select count(*) from public.product_fact_review_assignments),
  'confirmation_count',(select count(*) from public.product_fact_confirmations),
  'current_count',(select count(*) from public.product_fact_current),
  'automatic_confirmation',false
)::text;
