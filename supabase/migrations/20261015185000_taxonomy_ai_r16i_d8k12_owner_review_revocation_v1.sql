-- D8K-12: Owner-only, non-self R16I evidence review with append-only revocation.
-- Migration must NOT be applied to hosted DB without a separate release approval.
-- Legacy table remains the current-status row for existing D8C/D8D v1/v2 SQL.
-- Immutable event rows preserve each initial review and any later revocation.
-- The old current row moves VERIFIED -> REJECTED on revocation, thereby
-- immediately invalidating ALL pre-existing SQL checks for v.verdict='VERIFIED'.
--
-- PRECONDITION: existing legacy verdicts must be reconciled separately.
-- We refuse deployment instead of silently treating unchecked old VERIFIED
-- events as independently reviewed or rewriting historic account identities.
BEGIN;

DO $d8k12_preflight$
BEGIN
 IF to_regclass('public.admin_product_correction_evidence_v1') IS NULL
    OR to_regclass('public.admin_product_correction_evidence_verdicts_v1') IS NULL
    OR to_regclass('public.admin_memberships') IS NULL
    OR to_regclass('public.products') IS NULL
 THEN RAISE EXCEPTION 'D8K12_REQUIRED_R16I_SCHEMA_MISSING'; END IF;
 IF EXISTS (SELECT 1 FROM public.admin_product_correction_evidence_verdicts_v1)
 THEN RAISE EXCEPTION 'D8K12_EXISTING_VERDICTS_REQUIRE_EXPLICIT_RECONCILIATION'; END IF;
END
$d8k12_preflight$;

CREATE TABLE public.admin_product_correction_evidence_review_events_v2 (
 event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 event_sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
 evidence_id uuid NOT NULL REFERENCES public.admin_product_correction_evidence_v1(evidence_id) ON DELETE RESTRICT,
 current_verdict_id uuid NOT NULL REFERENCES public.admin_product_correction_evidence_verdicts_v1(verdict_id) ON DELETE RESTRICT,
 verdict text NOT NULL CHECK (verdict IN ('VERIFIED','REJECTED','REVOKED')),
 previous_verdict text CHECK (previous_verdict IS NULL OR previous_verdict='VERIFIED'),
 reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 1 AND 2000),
 reviewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 request_id uuid NOT NULL UNIQUE,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK (
  (verdict IN ('VERIFIED','REJECTED') AND previous_verdict IS NULL)
  OR (verdict='REVOKED' AND previous_verdict='VERIFIED')
 )
);
CREATE INDEX admin_product_correction_review_events_v2_latest_idx
 ON public.admin_product_correction_evidence_review_events_v2(evidence_id,event_sequence DESC);
ALTER TABLE public.admin_product_correction_evidence_review_events_v2 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_product_correction_evidence_review_events_v2
 FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.admin_product_correction_evidence_review_events_v2
 TO service_role;

-- Even privileged application code must not silently rewrite an audit entry.
-- This trigger does not prevent privileged DB owners from DDL changes, which
-- are separately controlled by migration/release review.
CREATE FUNCTION public.reject_r16i_evidence_review_event_mutation_v2()
 RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $d8k12_immutable$
BEGIN
 RAISE EXCEPTION 'D8K12_APPEND_ONLY_REVIEW_EVENT';
END;
$d8k12_immutable$;
CREATE TRIGGER r16i_evidence_review_events_v2_append_only
 BEFORE UPDATE OR DELETE ON public.admin_product_correction_evidence_review_events_v2
 FOR EACH ROW EXECUTE FUNCTION public.reject_r16i_evidence_review_event_mutation_v2();

-- Existing code used direct INSERT on this table. Revoke that privilege:
-- after deploying this migration, review writes MUST go through the narrow
-- owner-checked RPC below. Reads remain available to trusted server code.
-- Existing hosted service_role has ALL table privileges, including TRUNCATE.
-- Remove ALL direct grants, then re-grant read-only access. TRUNCATE bypasses
-- row-level policies and must not remain available as an alternate write path.
REVOKE ALL ON public.admin_product_correction_evidence_verdicts_v1
 FROM service_role;
GRANT SELECT ON public.admin_product_correction_evidence_verdicts_v1
 TO service_role;

CREATE FUNCTION public.review_r16i_evidence_v2(
 p_evidence_id uuid,p_verdict text,p_reason text,p_actor_id uuid,p_request_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $d8k12_review$
DECLARE
 e public.admin_product_correction_evidence_v1%ROWTYPE;
 prior public.admin_product_correction_evidence_verdicts_v1%ROWTYPE;
 saved public.admin_product_correction_evidence_verdicts_v1%ROWTYPE;
 previous_event public.admin_product_correction_evidence_review_events_v2%ROWTYPE;
 saved_event public.admin_product_correction_evidence_review_events_v2%ROWTYPE;
 normalized_reason text;
BEGIN
 normalized_reason:=btrim(coalesce(p_reason,''));
 IF p_evidence_id IS NULL OR p_actor_id IS NULL OR p_request_id IS NULL OR
    p_verdict IS NULL OR p_verdict NOT IN ('VERIFIED','REJECTED','REVOKED') OR
    char_length(normalized_reason) NOT BETWEEN 1 AND 2000
 THEN RAISE EXCEPTION 'D8K12_INVALID_REVIEW_INPUT'; END IF;

 -- The server binds p_actor_id to requireAdminCapability()'s authenticated
 -- account. This DB membership recheck blocks inactive/non-owner actors too.
 IF NOT EXISTS(
  SELECT 1 FROM public.admin_memberships
  WHERE user_id=p_actor_id AND role='admin_owner' AND is_active=true
 ) THEN RAISE EXCEPTION 'D8K12_ACTIVE_OWNER_REQUIRED'; END IF;

 -- Lock Product FIRST; both historic D8D apply functions lock Product
 -- BEFORE reading v.verdict. This serializes revocation with correction APPLY
 -- instead of allowing a stale verified read to race a later revoke.
 PERFORM 1 FROM public.products
  WHERE id='b639c8b4-6a61-440e-b4db-fac7381593ff'::uuid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'D8K12_PRODUCT_NOT_FOUND'; END IF;

 SELECT * INTO e FROM public.admin_product_correction_evidence_v1
  WHERE evidence_id=p_evidence_id
    AND product_id='b639c8b4-6a61-440e-b4db-fac7381593ff'::uuid
  FOR UPDATE;
 IF NOT FOUND OR e.evidence_state<>'UNVERIFIED'
 THEN RAISE EXCEPTION 'D8K12_EVIDENCE_SCOPE_OR_STATE_MISMATCH'; END IF;
 IF e.submitted_by=p_actor_id
 THEN RAISE EXCEPTION 'D8K12_REVIEWER_CANNOT_APPROVE_OWN_CAPTURE'; END IF;

 -- A replay of the same request ID is safe only with identical inputs.
 SELECT * INTO previous_event
 FROM public.admin_product_correction_evidence_review_events_v2
 WHERE request_id=p_request_id;
 IF FOUND THEN
  IF previous_event.evidence_id IS DISTINCT FROM p_evidence_id OR
     previous_event.verdict IS DISTINCT FROM p_verdict OR
     previous_event.reason IS DISTINCT FROM normalized_reason OR
     previous_event.reviewer_id IS DISTINCT FROM p_actor_id
  THEN RAISE EXCEPTION 'D8K12_REVIEW_REQUEST_REPLAY_CONFLICT'; END IF;
  IF EXISTS(
    SELECT 1 FROM public.admin_product_correction_evidence_review_events_v2 later
    WHERE later.evidence_id=p_evidence_id
      AND later.event_sequence>previous_event.event_sequence
  ) THEN RAISE EXCEPTION 'D8K12_SUPERSEDED_REVIEW_CANNOT_REPLAY'; END IF;
  RETURN jsonb_build_object(
   'verdictId',previous_event.current_verdict_id,
   'evidenceId',p_evidence_id,'verdict',p_verdict,
   'reviewedAt',previous_event.recorded_at,'productWrites',0,
   'priceApproved',false,'replayed',true
  );
 END IF;

 SELECT * INTO prior FROM public.admin_product_correction_evidence_verdicts_v1
  WHERE evidence_id=p_evidence_id FOR UPDATE;

 IF NOT FOUND THEN
  IF p_verdict='REVOKED'
  THEN RAISE EXCEPTION 'D8K12_NO_VERIFIED_REVIEW_TO_REVOKE'; END IF;
  INSERT INTO public.admin_product_correction_evidence_verdicts_v1(
   evidence_id,verdict,reason,reviewer_id,request_id
  ) VALUES (p_evidence_id,p_verdict,normalized_reason,p_actor_id,p_request_id)
  RETURNING * INTO saved;
  INSERT INTO public.admin_product_correction_evidence_review_events_v2(
   evidence_id,current_verdict_id,verdict,previous_verdict,reason,
   reviewer_id,request_id
  ) VALUES (
   p_evidence_id,saved.verdict_id,p_verdict,NULL,normalized_reason,
   p_actor_id,p_request_id
  ) RETURNING * INTO saved_event;
 ELSE
  SELECT * INTO previous_event
   FROM public.admin_product_correction_evidence_review_events_v2
   WHERE evidence_id=p_evidence_id
   ORDER BY event_sequence DESC LIMIT 1;
  IF NOT FOUND OR prior.verdict IS DISTINCT FROM 'VERIFIED' OR
     previous_event.verdict IS DISTINCT FROM 'VERIFIED' OR
     previous_event.current_verdict_id IS DISTINCT FROM prior.verdict_id
  THEN RAISE EXCEPTION 'D8K12_PREVIOUS_VERDICT_IS_TERMINAL_OR_UNAUDITED'; END IF;
  IF p_verdict<>'REVOKED'
  THEN RAISE EXCEPTION 'D8K12_ONLY_REVOCATION_ALLOWED_AFTER_REVIEW'; END IF;

  -- Append immutable revocation BEFORE changing the existing status row.
  -- Both writes are in the same transaction and roll back together.
  INSERT INTO public.admin_product_correction_evidence_review_events_v2(
   evidence_id,current_verdict_id,verdict,previous_verdict,reason,
   reviewer_id,request_id
  ) VALUES (
   p_evidence_id,prior.verdict_id,'REVOKED','VERIFIED',normalized_reason,
   p_actor_id,p_request_id
  ) RETURNING * INTO saved_event;
  UPDATE public.admin_product_correction_evidence_verdicts_v1 SET
   verdict='REJECTED',reason=normalized_reason,
   reviewer_id=p_actor_id,request_id=p_request_id,
   reviewed_at=saved_event.recorded_at
  WHERE verdict_id=prior.verdict_id AND verdict='VERIFIED'
  RETURNING * INTO saved;
  IF NOT FOUND THEN RAISE EXCEPTION 'D8K12_REVOCATION_STATUS_WRITE_FAILED'; END IF;
 END IF;

 RETURN jsonb_build_object(
  'verdictId',saved.verdict_id,'evidenceId',saved.evidence_id,
  'verdict',p_verdict,'reviewedAt',saved_event.recorded_at,
  'productWrites',0,'priceApproved',false,'replayed',false
 );
END;
$d8k12_review$;

REVOKE ALL ON FUNCTION public.review_r16i_evidence_v2(uuid,text,text,uuid,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.review_r16i_evidence_v2(uuid,text,text,uuid,uuid)
 TO service_role;

COMMIT;
