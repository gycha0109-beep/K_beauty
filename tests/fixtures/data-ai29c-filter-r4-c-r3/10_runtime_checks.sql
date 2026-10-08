-- DATA-AI29C-FILTER-R4-C-R3. Execute on disposable PostgreSQL only.
-- Every write is synthetic and enclosed in a transaction that is rolled back.
\set ON_ERROR_STOP on
BEGIN;
create schema test_r3;
create function test_r3.reviewed_identity() returns jsonb language sql stable as $f$
select jsonb_build_object(
'variant_key',null,'variant_key_reviewed_as_null',true,
'formulation_revision_key','data-ai29c-c5-bushman-waterproof-pro-current',
'formulation_label','BUSHMAN Waterproof Pro Suncream 50g',
'market_applicability','KR','region_applicability',null,'valid_from',null,'valid_to',null);
$f$;
create function test_r3.preflight() returns jsonb language sql volatile as $f$
select public.admin_pf_bushman_identity_auth_v1(
'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
'0b5963bb-67d6-4738-a620-32ec86c1e3d0'::uuid,
'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid,
test_r3.reviewed_identity());
$f$;
create function test_r3.assert_fails(p_sql text,p_expected text) returns void
language plpgsql as $f$
declare v_error text;
begin
  begin
    execute 'select ' || p_sql;
  exception when others then
    get stacked diagnostics v_error=message_text;
    if v_error=p_expected then return;end if;
    raise exception 'R3 wrong rejection: expected %, got %',p_expected,v_error;
  end;
  raise exception 'R3 allowed forbidden action (expected %): %',p_expected,p_sql;
end $f$;
create function test_r3.assert_mutation_fails(p_sql text,p_expected text) returns void
language plpgsql as $f$
declare v_error text;
begin
  begin
    execute p_sql;
    perform test_r3.preflight();
    raise exception 'R3_MISSING_REJECTION';
  exception when others then
    get stacked diagnostics v_error=message_text;
    if v_error is distinct from p_expected then
      raise exception 'R3 mutation failed incorrectly: expected %, got %',p_expected,v_error;
    end if;
  end;
end $f$;

-- R2 actual migration was applied prior to this transaction. ACL/RLS facts are read from pg_catalog.
do $t$ begin
  if not exists(select 1 from pg_class where oid='public.bushman_subject_identity_attestations_v1'::regclass and relrowsecurity and relforcerowsecurity)
  then raise exception 'R3_FORCE_RLS_NOT_SET';end if;
  if has_table_privilege('service_role','public.bushman_subject_identity_attestations_v1','INSERT')
  or has_table_privilege('service_role','public.bushman_subject_identity_attestations_v1','UPDATE')
  or has_table_privilege('service_role','public.product_fact_subjects','UPDATE')
  or has_function_privilege('service_role','public.bushman_identity_auth_plan_v1(uuid,uuid,uuid,jsonb)','EXECUTE')
  or not has_function_privilege('service_role','public.admin_pf_bushman_identity_auth_v1(uuid,uuid,uuid,jsonb)','EXECUTE')
  or not has_function_privilege('service_role','public.admin_confirm_bushman_identity_auth_v1(uuid,text,jsonb,text,text)','EXECUTE')
  or has_function_privilege('service_role','public.admin_confirm_bushman_identity_auth_core_r3_v1(uuid,text,jsonb,text,text)','EXECUTE')
  or has_function_privilege('anon','public.admin_confirm_bushman_identity_auth_v1(uuid,text,jsonb,text,text)','EXECUTE')
  or has_function_privilege('authenticated','public.admin_confirm_bushman_identity_auth_v1(uuid,text,jsonb,text,text)','EXECUTE')
  or has_function_privilege('anon','public.admin_pf_bushman_identity_auth_v1(uuid,uuid,uuid,jsonb)','EXECUTE')
  or has_function_privilege('authenticated','public.admin_pf_bushman_identity_auth_v1(uuid,uuid,uuid,jsonb)','EXECUTE')
  then raise exception 'R3_ACL_MATRIX_VIOLATION';end if;
  if length('admin_confirm_bushman_identity_auth_v1')>63
  then raise exception 'R3_PG_IDENTIFIER_OVERFLOW';end if;
end $t$;
select test_r3.assert_fails(
$$test_r3.preflight()$$,'r4c_r2_attestation_missing_or_invalid');
select test_r3.assert_fails(
$$public.admin_pf_bushman_identity_auth_v1('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,'0b5963bb-67d6-4738-a620-32ec86c1e3d0'::uuid,'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid,test_r3.reviewed_identity())$$,
'admin_product_review_capability_required');
select test_r3.assert_fails(
$$public.admin_pf_bushman_identity_auth_v1('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,'00000000-0000-4000-8000-000000000099'::uuid,'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid,test_r3.reviewed_identity())$$,
'r4c_r2_reviewed_identity_invalid');
-- Other Subject ID should fail closed; the exact error is identity invalid, not an authorization grant.
-- Independently approved sandbox attestation: NEVER reproduce this fixture in Production.
insert into public.admin_audit_logs(id,actor_user_id,actor_role,required_capability,action,target_type,target_id,reason,request_id,metadata)
values('dddddddd-dddd-4ddd-8ddd-dddddddddddd','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
'admin_operator','admin.products.review','admin.product_fact.bushman_subject_identity_attested',
'product_fact_subject','0b5963bb-67d6-4738-a620-32ec86c1e3d0','synthetic isolated identity review fixture',
'r3-synthetic-approval',jsonb_build_object('attestation_id','cccccccc-cccc-4ccc-8ccc-cccccccccccc',
'fresh_observation_digest',repeat('1',64)));
insert into public.bushman_subject_identity_attestations_v1(
attestation_id,product_id,subject_id,official_source_id,official_binding_id,official_review_id,
official_content_digest,fresh_observation_digest,fresh_observed_at,reviewed_identity,unit_reconciliation,
reviewer_user_id,approval_audit_id,approval_status,approved_at
) values(
'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
'4608b3b4-8b51-4464-b46e-380b05c1a3d7',
'0b5963bb-67d6-4738-a620-32ec86c1e3d0',
'94b32b8d-8340-4b91-9e62-646794fd4f41',
'9da03b35-9e00-4c46-8ff0-8f6835382349',
'067e861d-2e61-4ec2-a3f7-660d78be468d',
'3a9fbcb280935133e95a0f7f19bfff20157258b4dc17b8dce4d601e40f6681a9',
repeat('1',64),now()-interval '1 day',test_r3.reviewed_identity(),
jsonb_build_object('finding','same_product_verified',
'subject_label','BUSHMAN Waterproof Pro Suncream 50g','official_unit','50ml',
'review_rationale',repeat('synthetic fixture only; never a real approval; ',2)),
'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
'dddddddd-dddd-4ddd-8ddd-dddddddddddd','approved',now()-interval '1 day');

-- Preflight must be deterministic, read-only and produce exact payload + prestate digests.
do $t$ declare before_a bigint;before_e bigint;result1 jsonb;result2 jsonb;
begin
select count(*) into before_a from public.admin_audit_logs;
select count(*) into before_e from public.product_fact_review_events;
result1:=test_r3.preflight(); result2:=test_r3.preflight();
if result1->>'status' is distinct from 'ready'
or result1 is distinct from result2
or result1->>'payload_digest' is distinct from public.product_fact_controlled_sha256_json_v1(result1->'payload')
or result1->>'prestate_digest' !~ '^[0-9a-f]{64}$'
or (select count(*) from public.admin_audit_logs)<>before_a
or (select count(*) from public.product_fact_review_events)<>before_e
then raise exception 'R3_PREFLIGHT_NOT_READ_ONLY_OR_READY';end if;
end $t$;
select test_r3.assert_mutation_fails(
$$update public.bushman_subject_identity_attestations_v1 set approval_status='pending' where attestation_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc'$$,
'r4c_r2_attestation_missing_or_invalid');
select test_r3.assert_mutation_fails(
$$update public.bushman_subject_identity_attestations_v1 set unit_reconciliation=jsonb_build_object('finding','unresolved','subject_label','BUSHMAN Waterproof Pro Suncream 50g','official_unit','50ml','review_rationale',repeat('still unresolved ',4)) where attestation_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc'$$,
'r4c_r2_attestation_missing_or_invalid');
select test_r3.assert_mutation_fails(
$$update public.product_fact_subjects set subject_semantic_key=repeat('0',64) where subject_id='0b5963bb-67d6-4738-a620-32ec86c1e3d0'$$,
'r4c_r2_subject_lineage_invalid');
select test_r3.assert_mutation_fails(
$$update public.product_fact_subjects set identity_resolution_version='unapproved-lineage' where subject_id='0b5963bb-67d6-4738-a620-32ec86c1e3d0'$$,
'r4c_r2_subject_lineage_invalid');
select test_r3.assert_mutation_fails(
$$update public.product_source_bindings set source_url='https://not-official.example/product' where binding_id='9da03b35-9e00-4c46-8ff0-8f6835382349'$$,
'r4c_r2_product_official_binding_invalid');
select test_r3.assert_mutation_fails(
$$update public.trust_official_source_binding_reviews set scope_relation='related' where review_id='067e861d-2e61-4ec2-a3f7-660d78be468d'$$,
'r4c_r2_review_source_invalid');
select test_r3.assert_mutation_fails(
$$delete from public.product_evidence_source_subject_bindings where source_id='76cc7f5b-d5dc-4d72-bb1c-ab2a899211c1'$$,
'r4c_r2_official_sources_mismatch');
select test_r3.assert_mutation_fails(
$$update public.product_evidence_sources set content_digest=repeat('0',64) where source_id='76cc7f5b-d5dc-4d72-bb1c-ab2a899211c1'$$,
'r4c_r2_official_sources_mismatch');
select test_r3.assert_mutation_fails(
$$update public.product_evidence_sources set canonical_locator='https://spoofed.example/item' where source_id='76cc7f5b-d5dc-4d72-bb1c-ab2a899211c1'$$,
'r4c_r2_official_sources_mismatch');

-- Unauthorized service_role update is tested under the actual SQL role.
set local role service_role;
do $t$
declare blocked boolean:=false;
begin
  begin
    update public.product_fact_subjects set identity_resolution_version='bypass'
    where subject_id='0b5963bb-67d6-4738-a620-32ec86c1e3d0';
  exception when insufficient_privilege then blocked:=true;
  end;
  if not blocked then raise exception 'R3_SERVICE_ROLE_DIRECT_SUBJECT_UPDATE_ALLOWED';end if;
end $t$;
reset role;

-- Stale confirmation must fail without writing anything.
do $t$ declare p jsonb;
begin
  p:=test_r3.preflight();
  begin
    update public.product_fact_subjects set updated_at=now()+interval '1 day'
    where subject_id='0b5963bb-67d6-4738-a620-32ec86c1e3d0';
    perform public.admin_confirm_bushman_identity_auth_v1(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','r3-stale-prestate-00001',
    p->'payload',p->>'payload_digest',p->>'prestate_digest');
    raise exception 'R3_STALE_WAS_ACCEPTED';
  exception when sqlstate '55000' then
    if sqlerrm<>'r4c_r2_stale_preflight' then raise;end if;
  end;
end $t$;

-- Positive synthetic confirmation, exact three-table business write set, idempotency.
do $t$ declare p jsonb;r jsonb;replay jsonb;
before_facts text;after_facts text;
before_source text;after_source text;
before_subject jsonb;after_subject jsonb;
n_event bigint;n_audit bigint;
begin
  p:=test_r3.preflight();
  select public.product_fact_controlled_sha256_json_v1(coalesce(jsonb_agg(to_jsonb(x) order by x.proposition_key),'[]'::jsonb))
  into before_facts from public.product_fact_current x;
  select public.product_fact_controlled_sha256_json_v1(coalesce(jsonb_agg(to_jsonb(x) order by x.source_id),'[]'::jsonb))
  into before_source from public.product_evidence_sources x;
  select to_jsonb(s) into before_subject from public.product_fact_subjects s
  where subject_id='0b5963bb-67d6-4738-a620-32ec86c1e3d0';
  select count(*) into n_event from public.product_fact_review_events;
  select count(*) into n_audit from public.admin_audit_logs;
  r:=public.admin_confirm_bushman_identity_auth_v1('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'r3-success-request-00001',p->'payload',p->>'payload_digest',p->>'prestate_digest');
  if r->>'status' is distinct from 'identity_authority_upgraded'
  or r->>'idempotent' is distinct from 'false'
  or (select count(*) from public.product_fact_review_events)<>n_event+1
  or (select count(*) from public.admin_audit_logs)<>n_audit+1
  then raise exception 'R3_CONFIRMATION_WRITESET_INVALID';end if;
  select to_jsonb(s) into after_subject from public.product_fact_subjects s
  where subject_id='0b5963bb-67d6-4738-a620-32ec86c1e3d0';
  if after_subject- 'updated_at' - 'identity_resolution_version'
     is distinct from before_subject- 'updated_at' - 'identity_resolution_version'
  or after_subject->>'identity_resolution_version' is distinct from 'trust-phase5-admin-subject-review-v1'
  then raise exception 'R3_SUBJECT_UNAUTHORIZED_FIELD_MUTATED';end if;
  select public.product_fact_controlled_sha256_json_v1(coalesce(jsonb_agg(to_jsonb(x) order by x.proposition_key),'[]'::jsonb))
  into after_facts from public.product_fact_current x;
  select public.product_fact_controlled_sha256_json_v1(coalesce(jsonb_agg(to_jsonb(x) order by x.source_id),'[]'::jsonb))
  into after_source from public.product_evidence_sources x;
  if before_facts is distinct from after_facts or before_source is distinct from after_source
  then raise exception 'R3_FACT_OR_SOURCE_MUTATION';end if;
  replay:=public.admin_confirm_bushman_identity_auth_v1('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'r3-success-request-00001',p->'payload',p->>'payload_digest',p->>'prestate_digest');
  if replay->>'idempotent' is distinct from 'true'
  or (select count(*) from public.admin_audit_logs)<>n_audit+1
  or (select count(*) from public.product_fact_review_events)<>n_event+1
  then raise exception 'R3_IDEMPOTENCY_FAILED';end if;

  -- The original R2 code is required to reject a DIFFERENT payload even on a replay.
  perform test_r3.assert_fails(
    format('public.admin_confirm_bushman_identity_auth_v1(%L::uuid,%L,%L::jsonb,%L,%L)',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','r3-success-request-00001',
      (p->'payload' || '{"reviewed_identity":{}}'::jsonb)::text,p->>'payload_digest',p->>'prestate_digest'),
    'r4c_r2_request_reuse_conflict');
end $t$;
ROLLBACK;
\echo R3_ISOLATED_RUNTIME_TRANSACTION_ROLLED_BACK
