-- PostgreSQL 17 isolated execution-ledger test. All writes are rolled back.
begin;
do $acl$ begin
  if has_table_privilege('anon','public.automatic_product_evidence_run_events_v1','SELECT')
    or has_table_privilege('authenticated','public.automatic_product_evidence_run_events_v1','INSERT')
    or has_table_privilege('service_role','public.automatic_product_evidence_run_events_v1','UPDATE')
    or has_table_privilege('service_role','public.automatic_product_evidence_run_events_v1','DELETE')
    or not has_table_privilege('service_role','public.automatic_product_evidence_run_events_v1','SELECT')
    or not has_table_privilege('service_role','public.automatic_product_evidence_run_events_v1','INSERT')
    or not (select relrowsecurity and relforcerowsecurity from pg_class
      where oid='public.automatic_product_evidence_run_events_v1'::regclass)
  then raise exception 'AUTOMATIC_RUN_PG17_PRIVILEGES_FAIL';end if;
end $acl$;

set role service_role;
do $test$
declare
  v_run uuid='4608b3b4-8b51-4464-b46e-380b05c1a3d7';
  v_run2 uuid='0b5963bb-67d6-4738-a620-32ec86c1e3d0';
  v_rows bigint;
begin
  insert into public.automatic_product_evidence_run_events_v1(
    run_id,event_kind,contract_version)
  values(v_run,'started','automatic-evidence-run-health-v1');
  insert into public.automatic_product_evidence_run_events_v1(
    run_id,event_kind,contract_version,checked_count,duplicate_count)
  values(v_run,'success','automatic-evidence-run-health-v1',1,1);
  begin
    insert into public.automatic_product_evidence_run_events_v1(
      run_id,event_kind,contract_version,checked_count,failed_count,error_code)
    values(v_run,'failure','automatic-evidence-run-health-v1',1,1,
      'AUTO_EVIDENCE_EVALUATION_FAILED');
    raise exception 'AUTOMATIC_RUN_SECOND_TERMINAL_ACCEPTED';
  exception when unique_violation then null;
  end;
  begin
    insert into public.automatic_product_evidence_run_events_v1(
      run_id,event_kind,contract_version)
    values(v_run,'started','automatic-evidence-run-health-v1');
    raise exception 'AUTOMATIC_RUN_DUPLICATE_START_ACCEPTED';
  exception when unique_violation then null;
  end;
  insert into public.automatic_product_evidence_run_events_v1(
    run_id,event_kind,contract_version)
  values(v_run2,'started','automatic-evidence-run-health-v1');
  insert into public.automatic_product_evidence_run_events_v1(
    run_id,event_kind,contract_version,checked_count,failed_count,inserted_count,error_code)
  values(v_run2,'failure','automatic-evidence-run-health-v1',1,1,1,
    'AUTO_EVIDENCE_EVALUATION_FAILED');
  begin
    insert into public.automatic_product_evidence_run_events_v1(
      run_id,event_kind,contract_version,checked_count,inserted_count)
    values(gen_random_uuid(),'success','automatic-evidence-run-health-v1',1,0);
    raise exception 'AUTOMATIC_RUN_INVALID_SUCCESS_ACCEPTED';
  exception when check_violation then null;
  end;
  begin
    update public.automatic_product_evidence_run_events_v1
      set event_kind='failure' where run_id=v_run;
    raise exception 'AUTOMATIC_RUN_UPDATE_GRANTED';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.automatic_product_evidence_run_events_v1
      where run_id=v_run;
    raise exception 'AUTOMATIC_RUN_DELETE_GRANTED';
  exception when insufficient_privilege then null;
  end;
  select count(*) into v_rows from public.automatic_product_evidence_run_events_v1;
  if v_rows<>4 then raise exception 'AUTOMATIC_RUN_INSERT_COUNT_FAIL: %',v_rows;end if;
end $test$;
reset role;
rollback;

do $verify$ begin
  if (select count(*) from public.automatic_product_evidence_run_events_v1)<>0
  then raise exception 'AUTOMATIC_RUN_TEST_ROLLBACK_FAILED';end if;
end $verify$;
select 'AUTOMATIC_RUN_PG17_ROLLBACK_PASS';
