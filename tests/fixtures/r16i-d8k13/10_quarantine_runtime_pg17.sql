-- D8K-13 actual PostgreSQL 17 synthetic two-row acceptance.
-- Requires D8K12 00_minimal, then D8K13 00_legacy, then INTEGRATED migration
-- with a local-only synthetic release ticket. NEVER run on hosted database.
DO $d8k13_assert$
DECLARE
 outcome jsonb;
BEGIN
 IF (SELECT count(*) FROM public.admin_product_correction_legacy_verdict_quarantine_v1)<>2
  OR (SELECT count(*) FROM public.admin_product_correction_evidence_review_events_v2
    WHERE verdict='LEGACY_QUARANTINED' AND origin='D8K13_LEGACY_RECONCILIATION')<>2
  OR (SELECT count(*) FROM public.admin_product_correction_evidence_verdicts_v1
    WHERE verdict='VERIFIED')<>0
  OR (SELECT count(*) FROM public.admin_product_correction_evidence_verdicts_v1
    WHERE verdict='REJECTED')<>2
 THEN RAISE EXCEPTION 'D8K13_TWO_RECORD_QUARANTINE_NOT_ATOMIC'; END IF;
 IF (SELECT count(*) FROM public.admin_product_correction_legacy_verdict_quarantine_v1 q
  JOIN public.admin_product_correction_evidence_v1 e
    ON e.evidence_id=q.evidence_id
  JOIN public.admin_product_correction_evidence_verdicts_v1 v
    ON v.verdict_id=q.legacy_verdict_id
  JOIN public.admin_product_correction_evidence_review_events_v2 h
    ON h.legacy_snapshot_id=q.legacy_snapshot_id
  WHERE q.original_verdict='VERIFIED'
    AND q.original_evidence_state='UNVERIFIED'
    AND q.original_reviewer_id=e.submitted_by
    AND q.original_submitted_by=e.submitted_by
    AND q.original_reviewer_id=v.reviewer_id
    AND q.original_reason=v.reason
    AND q.original_request_id=v.request_id
    AND q.original_reviewed_at=v.reviewed_at
    AND q.legacy_verdict_id=h.current_verdict_id
    AND h.reviewer_id=q.original_reviewer_id
    AND h.origin='D8K13_LEGACY_RECONCILIATION'
    AND h.verdict='LEGACY_QUARANTINED'
    AND v.verdict='REJECTED')<>2
 THEN RAISE EXCEPTION 'D8K13_ORIGINAL_AUDIT_NOT_PRESERVED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.admin_product_correction_legacy_verdict_quarantine_v1
   WHERE source_key='official_single'
     AND original_reason='Original self review: official single'
     AND original_request_id='00000000-0000-4000-8000-000000000091'::uuid
     AND original_reviewed_at='2026-10-14T12:14:30+09:00'::timestamptz)
 OR NOT EXISTS(SELECT 1 FROM public.admin_product_correction_legacy_verdict_quarantine_v1
   WHERE source_key='hwahae_bundle'
     AND original_reason='Original self review: hwahae bundle'
     AND original_request_id='00000000-0000-4000-8000-000000000092'::uuid
     AND original_reviewed_at='2026-10-14T12:14:50+09:00'::timestamptz)
 THEN RAISE EXCEPTION 'D8K13_ORIGINAL_DECISION_DETAILS_CHANGED'; END IF;
 IF (SELECT count(*) FROM public.admin_product_correction_proposals_v1)<>0 OR
   (SELECT count(*) FROM public.admin_product_correction_decisions_v1)<>0 OR
   (SELECT count(*) FROM public.admin_r16i_correction_applications_v1)<>0 OR
   (SELECT count(*) FROM public.admin_r16i_correction_application_events_v1)<>0 OR
   (SELECT count(*) FROM public.products)<>1 OR
   (SELECT count(*) FROM public.admin_r16i_correction_release_gate_v1 WHERE enabled)<>0
 THEN RAISE EXCEPTION 'D8K13_PRODUCT_OR_RELEASE_WROTE'; END IF;
 IF NOT pg_catalog.has_table_privilege('service_role',
   'public.admin_product_correction_legacy_verdict_quarantine_v1','SELECT')
 OR pg_catalog.has_table_privilege('service_role',
   'public.admin_product_correction_legacy_verdict_quarantine_v1',
   'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
 OR pg_catalog.has_table_privilege('anon',
   'public.admin_product_correction_legacy_verdict_quarantine_v1','SELECT')
 OR pg_catalog.has_table_privilege('authenticated',
   'public.admin_product_correction_evidence_review_events_v2','SELECT')
 THEN RAISE EXCEPTION 'D8K13_PRIVATE_AUDIT_GRANTS_INVALID'; END IF;

 -- Never recast one of the original self-reviewed captures as a new approval.
 BEGIN
  PERFORM public.review_r16i_evidence_v2(
    '00000000-0000-4000-8000-000000000042',
    'VERIFIED','Attempt to reapprove legacy capture',
    '00000000-0000-4000-8000-000000000012',
    gen_random_uuid());
  RAISE EXCEPTION 'D8K13_REAPPROVED_QUARANTINED_BYTES';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'D8K12_PREVIOUS_VERDICT_IS_TERMINAL_OR_UNAUDITED'
  THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM public.review_r16i_evidence_v2(
    '00000000-0000-4000-8000-000000000042',
    'REVOKED','Attempt to revoke quarantined legacy',
    '00000000-0000-4000-8000-000000000012',
    gen_random_uuid());
  RAISE EXCEPTION 'D8K13_REVOKED_QUARANTINED_BYTES';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'D8K12_PREVIOUS_VERDICT_IS_TERMINAL_OR_UNAUDITED'
  THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM public.review_r16i_evidence_v2(
    '00000000-0000-4000-8000-000000000042',
    'LEGACY_QUARANTINED','Untrusted forged action',
    '00000000-0000-4000-8000-000000000012',
    gen_random_uuid());
  RAISE EXCEPTION 'D8K13_USER_SUBMITTED_LEGACY_EVENT';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'D8K12_INVALID_REVIEW_INPUT'
  THEN RAISE; END IF;
 END;
 BEGIN
  UPDATE public.admin_product_correction_legacy_verdict_quarantine_v1
   SET original_reason='tampered';
  RAISE EXCEPTION 'D8K13_AUDIT_UPDATED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'D8K13_IMMUTABLE_LEGACY_AUDIT'
  THEN RAISE; END IF;
 END;
 BEGIN
  DELETE FROM public.admin_product_correction_legacy_verdict_quarantine_v1;
  RAISE EXCEPTION 'D8K13_AUDIT_DELETED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'D8K13_IMMUTABLE_LEGACY_AUDIT'
  THEN RAISE; END IF;
 END;
 -- Fresh evidence from a distinct actual account (synthetic non-owner)
 -- can still be independently reviewed by an active owner.
 INSERT INTO public.admin_product_correction_evidence_v1(
  evidence_id,product_id,evidence_state,submitted_by,source_key
 ) VALUES('00000000-0000-4000-8000-000000000043',
  'b639c8b4-6a61-440e-b4db-fac7381593ff','UNVERIFIED',
  '00000000-0000-4000-8000-000000000013','official_single');
 SELECT public.review_r16i_evidence_v2(
   '00000000-0000-4000-8000-000000000043',
   'VERIFIED','Fresh independently reviewed synthetic evidence',
   '00000000-0000-4000-8000-000000000012',gen_random_uuid())
 INTO outcome;
 IF outcome->>'verdict'<>'VERIFIED' OR
    (SELECT count(*) FROM public.admin_product_correction_evidence_verdicts_v1
     WHERE verdict='VERIFIED')<>1 OR
    (SELECT count(*) FROM public.admin_product_correction_evidence_review_events_v2
     WHERE origin='D8K12_HUMAN_REVIEW' AND verdict='VERIFIED')<>1
 THEN RAISE EXCEPTION 'D8K13_NEW_INDEPENDENT_REVIEW_REGRESSION'; END IF;
END
$d8k13_assert$;
\echo D8K13_PG17_LEGACY_TWO_ROW_QUARANTINE_PASS
