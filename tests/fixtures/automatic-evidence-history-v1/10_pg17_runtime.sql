-- Disposable PostgreSQL 17 contract test. Test writes rollback.
begin;
grant select on public.product_fact_subjects to service_role;
create temporary table automatic_history_test_payload as
select jsonb_build_object(
  'contractVersion','automatic-evidence-history-candidate-v1',
  'writeState','NOT_SAVED',
  'actorType','automatic_evidence_system',
  'productId','4608b3b4-8b51-4464-b46e-380b05c1a3d7',
  'subjectId','0b5963bb-67d6-4738-a620-32ec86c1e3d0',
  'evaluatedAt','2026-10-11T06:00:00.000Z',
  'versions',jsonb_build_object(
    'evaluator','automatic-product-evidence-evaluator-v1',
    'adapter','automatic-product-evidence-live-readonly-adapter-v1',
    'historyContract','automatic-evidence-history-candidate-v1'),
  'sourceDigest',repeat('a',64),
  'decisionDigest',repeat('b',64),
  'idempotencyKey',repeat('c',64),
  'sourceEvidenceDigests',jsonb_build_array(repeat('d',64)),
  'fields',(
    select jsonb_object_agg(field_name,
      jsonb_build_object('status',case when field_name in ('category_slot','uv_filter_type')
        then 'verified_fact' else 'insufficient' end,
      'value',case when field_name='category_slot' then 'sunscreen'
        when field_name='uv_filter_type' then 'hybrid' else null end,
      'uncertainty',field_name not in ('category_slot','uv_filter_type'),
      'trend','none','evidenceRefs','[]'::jsonb,'claimsDigest',repeat('1',64),
      'reviewObservationCounts',jsonb_build_object('favorableSignals',0,
        'unfavorableSignals',0,'aggregateTagSources',0)))
    from unnest(array[
      'category_slot','skin_types','concerns','texture','finish','uv_filter_type',
      'sensitivity_safe','irritation_risk','tone_up','white_cast','eye_sting','pilling_risk'
    ]) field_name),
  'evidenceReady',true,'researchNeeds','[]'::jsonb,
  'exceptions','[]'::jsonb,'contextCautions','[]'::jsonb,
  'databaseWrites',0,'adminReviewWrites',0,'recommendationWrites',0
) as candidate;
grant select on automatic_history_test_payload to service_role;

do $acl$ begin
  if has_function_privilege('anon','public.record_automatic_product_evidence_history_v1(jsonb)','EXECUTE')
    or has_function_privilege('authenticated','public.record_automatic_product_evidence_history_v1(jsonb)','EXECUTE')
    or has_table_privilege('authenticated','public.automatic_product_evidence_history_v1','SELECT')
    or has_table_privilege('service_role','public.automatic_product_evidence_history_v1','UPDATE')
    or has_table_privilege('service_role','public.automatic_product_evidence_history_v1','DELETE')
    or not has_table_privilege('service_role','public.automatic_product_evidence_history_v1','INSERT')
  then raise exception 'AUTOMATIC_HISTORY_PG17_PRIVILEGES_FAIL';end if;
end $acl$;

set role service_role;
do $test$
declare
  c jsonb;
  r jsonb;
  source_refresh jsonb;
  assessment_change jsonb;
  mismatch jsonb;
  v_num bigint;
  v_changed text[];
begin
  select candidate into c from automatic_history_test_payload;
  r := public.record_automatic_product_evidence_history_v1(c);
  if r->>'status'<>'inserted' or r->>'eventKind'<>'first_observation'
    then raise exception 'AUTOMATIC_HISTORY_FIRST_INSERT_FAIL: %',r;end if;
  r := public.record_automatic_product_evidence_history_v1(c);
  if r->>'status'<>'duplicate' then
    raise exception 'AUTOMATIC_HISTORY_DUPLICATE_FAIL: %',r;end if;
  select count(*) into v_num from public.automatic_product_evidence_history_v1;
  if v_num<>1 then raise exception 'AUTOMATIC_HISTORY_DUPLICATE_ROW_COUNT_FAIL';end if;

  source_refresh := jsonb_set(
    jsonb_set(c,'{sourceDigest}',to_jsonb(repeat('d',64))),
    '{idempotencyKey}',to_jsonb(repeat('e',64)));
  r := public.record_automatic_product_evidence_history_v1(source_refresh);
  if r->>'status'<>'inserted' or r->>'eventKind'<>'evidence_refresh'
    then raise exception 'AUTOMATIC_HISTORY_EVIDENCE_REFRESH_FAIL: %',r;end if;

  assessment_change := jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(source_refresh,'{fields,category_slot,value}','"other"'::jsonb),
        '{decisionDigest}',to_jsonb(repeat('f',64))),
      '{idempotencyKey}',to_jsonb(repeat('1',64))),
    '{evaluatedAt}','"2026-10-11T06:00:01.000Z"'::jsonb);
  r := public.record_automatic_product_evidence_history_v1(assessment_change);
  if r->>'status'<>'inserted' or r->>'eventKind'<>'assessment_changed'
    or r->'changedFields' <> '["category_slot"]'::jsonb
    then raise exception 'AUTOMATIC_HISTORY_DECISION_DIFF_FAIL: %',r;end if;
  r := public.record_automatic_product_evidence_history_v1(c);
  if r->>'status'<>'duplicate' then
    raise exception 'AUTOMATIC_HISTORY_NONADJACENT_DUPLICATE_FAIL';end if;
  select count(*) into v_num from public.automatic_product_evidence_history_v1;
  if v_num<>3 then raise exception 'AUTOMATIC_HISTORY_APPEND_ONLY_COUNT_FAIL';end if;

  mismatch := jsonb_set(c,'{subjectId}',
    '"8c100558-f7b0-45a4-9c93-eb159eadbf3d"'::jsonb);
  begin
    perform public.record_automatic_product_evidence_history_v1(mismatch);
    raise exception 'AUTOMATIC_HISTORY_UNRESOLVED_SCOPE_ACCEPTED';
  exception when sqlstate '55000' then
    if sqlerrm<>'automatic_history_subject_not_current' then raise;end if;
  end;
  begin
    perform public.record_automatic_product_evidence_history_v1(
      jsonb_set(c,'{databaseWrites}','1'::jsonb));
    raise exception 'AUTOMATIC_HISTORY_UNTRUSTED_WRITES_ACCEPTED';
  exception when sqlstate '22023' then
    if sqlerrm<>'automatic_history_invalid_candidate' then raise;end if;
  end;
  begin
    perform public.record_automatic_product_evidence_history_v1(
      jsonb_set(c,'{idempotencyKey}',to_jsonb(repeat('g',64))));
    raise exception 'AUTOMATIC_HISTORY_INVALID_HASH_ACCEPTED';
  exception when sqlstate '22023' then
    if sqlerrm<>'automatic_history_invalid_identity_or_digest' then raise;end if;
  end;
end $test$;
reset role;
rollback;

do $verify$ begin
  if (select count(*) from public.automatic_product_evidence_history_v1)<>0
    then raise exception 'AUTOMATIC_HISTORY_TEST_ROLLBACK_FAILED';end if;
end $verify$;
select 'AUTOMATIC_EVIDENCE_HISTORY_PG17_ROLLBACK_PASS' as result;
