-- D8K-12 actual disposable PostgreSQL 17 acceptance (synthetic evidence).
-- Requires 00_minimal_pg17.sql, then D8K12 migration. No network/production.
DO $assert$
DECLARE
 a jsonb;
 e1 uuid:='00000000-0000-4000-8000-000000000041';
 e2 uuid:='00000000-0000-4000-8000-000000000042';
 owner1 uuid:='00000000-0000-4000-8000-000000000011';
 collector uuid:='00000000-0000-4000-8000-000000000012';
 non_owner uuid:='00000000-0000-4000-8000-000000000013';
 owner2 uuid:='00000000-0000-4000-8000-000000000014';
 first_req uuid:='00000000-0000-4000-8000-000000000061';
 revoke_req uuid:='00000000-0000-4000-8000-000000000062';
BEGIN
 IF NOT pg_catalog.has_table_privilege('service_role',
    'public.admin_product_correction_evidence_verdicts_v1','SELECT')
 OR pg_catalog.has_table_privilege('service_role',
    'public.admin_product_correction_evidence_verdicts_v1',
    'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
 THEN RAISE EXCEPTION 'D8K12_LEGACY_DIRECT_MUTATION_PRIVILEGES_REMAIN'; END IF;

 IF pg_catalog.has_function_privilege('anon',
    'public.review_r16i_evidence_v2(uuid,text,text,uuid,uuid)','EXECUTE')
 OR pg_catalog.has_function_privilege('authenticated',
    'public.review_r16i_evidence_v2(uuid,text,text,uuid,uuid)','EXECUTE')
 OR NOT pg_catalog.has_function_privilege('service_role',
    'public.review_r16i_evidence_v2(uuid,text,text,uuid,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'D8K12_RPC_GRANTS_INVALID'; END IF;

 -- An active OWNER who submitted the exact capture must NOT approve it.
 BEGIN
  PERFORM public.review_r16i_evidence_v2(
    e1,'VERIFIED','I uploaded this myself',collector,
    '00000000-0000-4000-8000-000000000063'::uuid);
  RAISE EXCEPTION 'D8K12_SELF_APPROVAL_WAS_ACCEPTED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'D8K12_REVIEWER_CANNOT_APPROVE_OWN_CAPTURE'
  THEN RAISE; END IF;
 END;

 BEGIN
  PERFORM public.review_r16i_evidence_v2(
   e1,'VERIFIED','Operator may not approve',non_owner,
   '00000000-0000-4000-8000-000000000064'::uuid);
  RAISE EXCEPTION 'D8K12_NON_OWNER_WAS_ACCEPTED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'D8K12_ACTIVE_OWNER_REQUIRED' THEN RAISE; END IF;
 END;

 BEGIN
  PERFORM public.review_r16i_evidence_v2(
   e1,'REVOKED','No approval yet',owner1,
   '00000000-0000-4000-8000-000000000065'::uuid);
  RAISE EXCEPTION 'D8K12_REVOKED_UNREVIEWED_CAPTURE';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'D8K12_NO_VERIFIED_REVIEW_TO_REVOKE' THEN RAISE; END IF;
 END;

 SELECT public.review_r16i_evidence_v2(
  e1,'VERIFIED','Independent first review',owner1,first_req) INTO a;
 IF a->>'verdict'<>'VERIFIED' OR (a->>'priceApproved')::boolean<>false
    OR (a->>'productWrites')::integer<>0
    OR (a->>'replayed')::boolean<>false
 THEN RAISE EXCEPTION 'D8K12_INITIAL_APPROVAL_FAILED'; END IF;
 IF (SELECT count(*) FROM public.admin_product_correction_evidence_verdicts_v1
       WHERE evidence_id=e1 AND verdict='VERIFIED')<>1
 OR (SELECT count(*) FROM public.admin_product_correction_evidence_review_events_v2
       WHERE evidence_id=e1 AND verdict='VERIFIED')<>1
 THEN RAISE EXCEPTION 'D8K12_INITIAL_CURRENT_AND_AUDIT_DIVERGED'; END IF;

 -- Same exact request is repeatable; changing its contents is not.
 SELECT public.review_r16i_evidence_v2(
  e1,'VERIFIED','Independent first review',owner1,first_req) INTO a;
 IF (a->>'replayed')::boolean<>true
 THEN RAISE EXCEPTION 'D8K12_IDEMPOTENT_REPLAY_FAILED'; END IF;
 BEGIN
  PERFORM public.review_r16i_evidence_v2(
    e1,'VERIFIED','Different reason',owner1,first_req);
  RAISE EXCEPTION 'D8K12_MISMATCH_REPLAY_ACCEPTED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'D8K12_REVIEW_REQUEST_REPLAY_CONFLICT' THEN RAISE; END IF;
 END;

 BEGIN
  PERFORM public.review_r16i_evidence_v2(
    e1,'VERIFIED','Second approval must not overwrite',owner1,
    '00000000-0000-4000-8000-000000000066'::uuid);
  RAISE EXCEPTION 'D8K12_DOUBLE_APPROVAL_ACCEPTED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'D8K12_ONLY_REVOCATION_ALLOWED_AFTER_REVIEW' THEN RAISE; END IF;
 END;

 -- Revocation must atomically replace current approval by a denial while
 -- adding a new immutable audit row. Previously reviewed prices stay OFF.
 SELECT public.review_r16i_evidence_v2(
  e1,'REVOKED','Evidence was not a valid offer',owner2,revoke_req) INTO a;
 IF a->>'verdict'<>'REVOKED' OR (a->>'priceApproved')::boolean<>false
 THEN RAISE EXCEPTION 'D8K12_REVOKE_REPLY_INCORRECT'; END IF;
 IF (SELECT count(*) FROM public.admin_product_correction_evidence_verdicts_v1
       WHERE evidence_id=e1 AND verdict='VERIFIED')<>0
 OR (SELECT count(*) FROM public.admin_product_correction_evidence_verdicts_v1
       WHERE evidence_id=e1 AND verdict='REJECTED')<>1
 OR (SELECT count(*) FROM public.admin_product_correction_evidence_review_events_v2
       WHERE evidence_id=e1)<>2
 OR (SELECT verdict FROM public.admin_product_correction_evidence_review_events_v2
       WHERE evidence_id=e1 ORDER BY event_sequence DESC LIMIT 1)<>'REVOKED'
 THEN RAISE EXCEPTION 'D8K12_REVOKE_LEFT_STALE_APPROVAL'; END IF;

 -- A second identical request to revoke remains safe.
 SELECT public.review_r16i_evidence_v2(
  e1,'REVOKED','Evidence was not a valid offer',owner2,revoke_req) INTO a;
 IF (a->>'replayed')::boolean<>true
 THEN RAISE EXCEPTION 'D8K12_REVOKE_REPLAY_FAILED'; END IF;

 -- A prior VERIFIED receipt cannot be replayed to imply current authority.
 BEGIN
  PERFORM public.review_r16i_evidence_v2(
   e1,'VERIFIED','Independent first review',owner1,first_req);
  RAISE EXCEPTION 'D8K12_OLD_VERIFIED_RECEIPT_REPLAYED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'D8K12_SUPERSEDED_REVIEW_CANNOT_REPLAY' THEN RAISE; END IF;
 END;

 BEGIN
  PERFORM public.review_r16i_evidence_v2(
    e1,'VERIFIED','No reapproval of revoked bytes',owner1,
    '00000000-0000-4000-8000-000000000067'::uuid);
  RAISE EXCEPTION 'D8K12_REAPPROVAL_OF_REVOKED_EVIDENCE_ACCEPTED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'D8K12_PREVIOUS_VERDICT_IS_TERMINAL_OR_UNAUDITED'
  THEN RAISE; END IF;
 END;

 -- Existing already-REJECTED evidence is terminal, not revocable.
 PERFORM public.review_r16i_evidence_v2(
   e2,'REJECTED','Not enough reliable source evidence',owner2,
   '00000000-0000-4000-8000-000000000068'::uuid);
 BEGIN
  PERFORM public.review_r16i_evidence_v2(
    e2,'REVOKED','Cannot revoke rejected capture',owner2,
    '00000000-0000-4000-8000-000000000069'::uuid);
  RAISE EXCEPTION 'D8K12_REJECTED_EVIDENCE_REVOKED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'D8K12_PREVIOUS_VERDICT_IS_TERMINAL_OR_UNAUDITED'
  THEN RAISE; END IF;
 END;

 -- Existing R16I D8C and D8D SQL checks for v.verdict=VERIFIED must now
 -- see ZERO authorizations after the revoke, without modifying those RPCs.
 IF (SELECT count(*) FROM public.admin_product_correction_evidence_verdicts_v1
      WHERE evidence_id=e1 AND verdict='VERIFIED')<>0
 THEN RAISE EXCEPTION 'D8K12_OLD_SQL_STALE_APPROVAL_LEAK'; END IF;

 -- Truly append-only audit; even postgres owner cannot mutate row content
 -- without explicitly changing the (protected) migration/trigger.
 BEGIN
  UPDATE public.admin_product_correction_evidence_review_events_v2
  SET reason='tamper' WHERE evidence_id=e1;
  RAISE EXCEPTION 'D8K12_AUDIT_UPDATE_WAS_ACCEPTED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'D8K12_APPEND_ONLY_REVIEW_EVENT' THEN RAISE; END IF;
 END;
 BEGIN
  DELETE FROM public.admin_product_correction_evidence_review_events_v2
  WHERE evidence_id=e1;
  RAISE EXCEPTION 'D8K12_AUDIT_DELETE_WAS_ACCEPTED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'D8K12_APPEND_ONLY_REVIEW_EVENT' THEN RAISE; END IF;
 END;
 IF (SELECT count(*) FROM public.products)<>1
 THEN RAISE EXCEPTION 'D8K12_PRODUCT_UNEXPECTEDLY_MUTATED'; END IF;
END
$assert$;

-- Testing actual role privilege boundaries, not merely calling as postgres.
SET ROLE service_role;
DO $deny$
BEGIN
 BEGIN
  INSERT INTO public.admin_product_correction_evidence_verdicts_v1(
    evidence_id,verdict,reason,reviewer_id,request_id
  ) VALUES(
    '00000000-0000-4000-8000-000000000041',
    'VERIFIED','bypass direct INSERT',
    '00000000-0000-4000-8000-000000000011',
    '00000000-0000-4000-8000-000000000070'
  );
  RAISE EXCEPTION 'D8K12_DIRECT_LEGACY_INSERT_ALLOWED';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 IF (SELECT count(*) FROM public.admin_product_correction_evidence_review_events_v2)<>3
 THEN RAISE EXCEPTION 'D8K12_EVENT_COUNT_DRIFT_AFTER_ROLE_TEST'; END IF;
END
$deny$;
RESET ROLE;

SET ROLE anon;
DO $anon$
BEGIN
 BEGIN
  PERFORM public.review_r16i_evidence_v2(
    '00000000-0000-4000-8000-000000000041',
    'VERIFIED','forged caller',
    '00000000-0000-4000-8000-000000000011',
    gen_random_uuid());
  RAISE EXCEPTION 'D8K12_ANON_RPC_ALLOWED';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END
$anon$;
RESET ROLE;

SET ROLE authenticated;
DO $authenticated$
BEGIN
 BEGIN
  PERFORM public.review_r16i_evidence_v2(
    '00000000-0000-4000-8000-000000000041',
    'VERIFIED','forged caller',
    '00000000-0000-4000-8000-000000000011',
    gen_random_uuid());
  RAISE EXCEPTION 'D8K12_AUTHENTICATED_RPC_ALLOWED';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END
$authenticated$;
RESET ROLE;

\echo D8K12_PG17_SQL_ACCEPTANCE_PASS
