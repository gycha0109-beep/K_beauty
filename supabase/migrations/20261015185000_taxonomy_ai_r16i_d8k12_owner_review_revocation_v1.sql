-- D8K-12 + D8K-13: restricted evidence review and exact legacy quarantine.
-- D8K-13 is CODE-ONLY until separately approved hosted reconciliation.
-- D8K-13 legacy path requires a release ticket and exact 2-row preflight;
-- otherwise the original D8K-12 nonempty-verdict guard remains fail-closed.
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
DECLARE
 legacy_count bigint;
 ticket text:=nullif(btrim(current_setting('app.d8k13_release_ticket',true)),'');
 expected_manifest text:=nullif(btrim(current_setting('app.d8k13_expected_manifest',true)),'');
 observed_manifest text;
 v2_table text;
 expected_columns text[];
 actual_columns text[];
 r16i_id uuid:='b639c8b4-6a61-440e-b4db-fac7381593ff';
BEGIN
 IF to_regclass('public.admin_product_correction_evidence_v1') IS NULL
    OR to_regclass('public.admin_product_correction_evidence_verdicts_v1') IS NULL
    OR to_regclass('public.admin_memberships') IS NULL
    OR to_regclass('public.products') IS NULL
 THEN RAISE EXCEPTION 'D8K12_REQUIRED_R16I_SCHEMA_MISSING'; END IF;
 -- D8D v2 acquires this advisory lock BEFORE locking the proposal and
 -- Product. Acquire it first to avoid a D8K13 Product-vs-v2-proposal cycle.
 -- D8D v1 is serialized by the subsequent Product row lock.
 PERFORM pg_catalog.pg_advisory_xact_lock(195721,16);
 -- Product row before evidence/verdict and downstream ledger table locks.
 PERFORM 1 FROM public.products WHERE id=r16i_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'D8K13_PRODUCT_MISSING'; END IF;
 -- Prevent concurrent evidence/verdict changes between exact-shape verification
 -- and atomic legacy quarantine. Locks survive through the final COMMIT.
 LOCK TABLE public.admin_product_correction_evidence_v1,
  public.admin_product_correction_evidence_verdicts_v1
  IN SHARE ROW EXCLUSIVE MODE;
 SELECT count(*) INTO legacy_count
 FROM public.admin_product_correction_evidence_verdicts_v1;
 IF legacy_count=0 THEN RETURN; END IF;
 -- Critical: do not loosen the D8K12 guard for arbitrary existing verdicts.
 -- The release ticket is an explicit deployment precondition, NOT approval
 -- created by this code or an authorization to run against hosted DB.
 IF ticket IS NULL OR char_length(ticket)<12
 THEN RAISE EXCEPTION 'D8K12_EXISTING_VERDICTS_REQUIRE_EXPLICIT_RECONCILIATION'; END IF;
 IF to_regclass('public.admin_product_correction_proposals_v1') IS NULL
    OR to_regclass('public.admin_product_correction_decisions_v1') IS NULL
    OR to_regclass('public.admin_r16i_correction_applications_v1') IS NULL
    OR to_regclass('public.admin_r16i_correction_application_events_v1') IS NULL
    OR to_regclass('public.admin_r16i_correction_release_gate_v1') IS NULL
    OR to_regclass('public.admin_product_correction_evidence_review_events_v2') IS NOT NULL
    OR to_regclass('public.admin_product_correction_legacy_verdict_quarantine_v1') IS NOT NULL
    OR to_regprocedure('public.review_r16i_evidence_v2(uuid,text,text,uuid,uuid)') IS NOT NULL
 THEN RAISE EXCEPTION 'D8K13_UNEXPECTED_LEGACY_SCHEMA'; END IF;
 LOCK TABLE public.admin_product_correction_proposals_v1,
  public.admin_product_correction_decisions_v1,
  public.admin_r16i_correction_applications_v1,
  public.admin_r16i_correction_application_events_v1,
  public.admin_r16i_correction_release_gate_v1
  IN SHARE ROW EXCLUSIVE MODE;

 -- A normally ordered pending migration chain installs D8D v2 first
 -- (20261014150000). Permit ONLY the complete, exact inert v2 schema;
 -- any partial install, unexpected columns/permissions or activity fails shut.
 IF to_regclass('public.admin_r16i_d8d_v2_gate') IS NOT NULL OR
    to_regclass('public.admin_r16i_d8d_v2_owner_authorizations') IS NOT NULL OR
    to_regclass('public.admin_r16i_d8d_v2_applications') IS NOT NULL OR
    to_regclass('public.admin_r16i_d8d_v2_application_offers') IS NOT NULL OR
    to_regclass('public.admin_r16i_d8d_v2_events') IS NOT NULL OR
    to_regprocedure('public.r16i_d8d_apply_v2(uuid,uuid,uuid,text)') IS NOT NULL OR
    to_regprocedure('public.r16i_d8d_rollback_v2(uuid,uuid,uuid)') IS NOT NULL
 THEN
  IF to_regclass('public.admin_r16i_d8d_v2_gate') IS NULL OR
     to_regclass('public.admin_r16i_d8d_v2_owner_authorizations') IS NULL OR
     to_regclass('public.admin_r16i_d8d_v2_applications') IS NULL OR
     to_regclass('public.admin_r16i_d8d_v2_application_offers') IS NULL OR
     to_regclass('public.admin_r16i_d8d_v2_events') IS NULL OR
     to_regprocedure('public.r16i_d8d_apply_v2(uuid,uuid,uuid,text)') IS NULL OR
     to_regprocedure('public.r16i_d8d_rollback_v2(uuid,uuid,uuid)') IS NULL
  THEN RAISE EXCEPTION 'D8K13_UNEXPECTED_LEGACY_SCHEMA'; END IF;

  -- This serializes against writes to all v2 ledgers/gate while validating.
  LOCK TABLE public.admin_r16i_d8d_v2_gate,
   public.admin_r16i_d8d_v2_owner_authorizations,
   public.admin_r16i_d8d_v2_applications,
   public.admin_r16i_d8d_v2_application_offers,
   public.admin_r16i_d8d_v2_events IN SHARE ROW EXCLUSIVE MODE;

  -- An actual authorization, application, offer or event is NEVER
  -- automatically reconciled. Both v1 and v2 gates must remain disabled.
  IF (SELECT count(*) FROM public.admin_r16i_d8d_v2_gate)<>1 OR
     (SELECT count(*) FROM public.admin_r16i_d8d_v2_gate
       WHERE scope='R16I_S_NATURE_PRODUCT_1' AND enabled=false
         AND change_ticket IS NULL)<>1 OR
     EXISTS(SELECT 1 FROM public.admin_r16i_d8d_v2_owner_authorizations) OR
     EXISTS(SELECT 1 FROM public.admin_r16i_d8d_v2_applications) OR
     EXISTS(SELECT 1 FROM public.admin_r16i_d8d_v2_application_offers) OR
     EXISTS(SELECT 1 FROM public.admin_r16i_d8d_v2_events)
  THEN RAISE EXCEPTION 'D8K13_UNEXPECTED_D8DV2_ACTIVITY'; END IF;

  -- PIN the actual unmodified D8D-v2 function contract:
  -- APPLY is SECURITY INVOKER; ROLLBACK deliberately is SECURITY DEFINER
  -- so it can remove the two offers while retaining the approved audit trail.
  -- ROLLBACK is trusted only when EXECUTE remains service_role-only and
  -- the source RPC's owner membership, bounded subject and ticket checks
  -- remain subject to independent code review. Do NOT change its security
  -- attribute merely to satisfy this migration preflight.
  IF (SELECT p.prosecdef FROM pg_catalog.pg_proc p WHERE p.oid=
       to_regprocedure('public.r16i_d8d_apply_v2(uuid,uuid,uuid,text)')) IS DISTINCT FROM false OR
     (SELECT p.prosecdef FROM pg_catalog.pg_proc p WHERE p.oid=
       to_regprocedure('public.r16i_d8d_rollback_v2(uuid,uuid,uuid)')) IS DISTINCT FROM true OR
     NOT pg_catalog.has_function_privilege('service_role',
       'public.r16i_d8d_apply_v2(uuid,uuid,uuid,text)','EXECUTE') OR
     NOT pg_catalog.has_function_privilege('service_role',
       'public.r16i_d8d_rollback_v2(uuid,uuid,uuid)','EXECUTE') OR
     pg_catalog.has_function_privilege('anon',
       'public.r16i_d8d_apply_v2(uuid,uuid,uuid,text)','EXECUTE') OR
     pg_catalog.has_function_privilege('authenticated',
       'public.r16i_d8d_apply_v2(uuid,uuid,uuid,text)','EXECUTE') OR
     pg_catalog.has_function_privilege('anon',
       'public.r16i_d8d_rollback_v2(uuid,uuid,uuid)','EXECUTE') OR
     pg_catalog.has_function_privilege('authenticated',
       'public.r16i_d8d_rollback_v2(uuid,uuid,uuid)','EXECUTE') OR
     NOT pg_catalog.has_table_privilege('service_role',
       'public.admin_r16i_d8d_v2_gate','SELECT') OR
     pg_catalog.has_table_privilege('service_role',
       'public.admin_r16i_d8d_v2_gate','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR
     pg_catalog.has_table_privilege('service_role',
       'public.admin_r16i_d8d_v2_owner_authorizations',
       'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
  THEN RAISE EXCEPTION 'D8K13_UNEXPECTED_D8DV2_SECURITY'; END IF;

  -- Guard the *entire observed column/type surface*, not just a list
  -- of table names: schema drift is NOT a release-ticket bypass.
  FOR v2_table,expected_columns IN
   SELECT name,cols FROM (VALUES
    ('admin_r16i_d8d_v2_gate',ARRAY[
      'scope:text','enabled:boolean','change_ticket:text',
      'changed_at:timestamp with time zone']::text[]),
    ('admin_r16i_d8d_v2_owner_authorizations',ARRAY[
      'authorization_id:uuid','proposal_id:uuid','product_id:uuid',
      'product_revision:timestamp with time zone','price_policy:text',
      'evidence_fingerprint:text','approved_by:uuid',
      'product_identity_attested:boolean','review_population_attested:boolean',
      'source_binding_attested:boolean','seller_option_scopes_attested:boolean',
      'approved_at:timestamp with time zone','expires_at:timestamp with time zone',
      'revoked_at:timestamp with time zone']::text[]),
    ('admin_r16i_d8d_v2_applications',ARRAY[
      'application_id:uuid','proposal_id:uuid','decision_id:uuid',
      'authorization_id:uuid','product_id:uuid',
      'before_values:jsonb','after_values:jsonb','evidence_fingerprint:text',
      'applied_by:uuid','apply_request_id:uuid',
      'applied_at:timestamp with time zone','rolled_back_at:timestamp with time zone',
      'rolled_back_by:uuid','rollback_request_id:uuid']::text[]),
    ('admin_r16i_d8d_v2_application_offers',ARRAY[
      'application_id:uuid','ordinal:smallint','offer_id:uuid',
      'seller_key:text','evidence_id:uuid','offer_values:jsonb']::text[]),
    ('admin_r16i_d8d_v2_events',ARRAY[
      'event_id:uuid','application_id:uuid','event_type:text',
      'event_by:uuid','request_id:uuid','before_values:jsonb',
      'after_values:jsonb','occurred_at:timestamp with time zone']::text[])
   ) AS expected(name,cols)
  LOOP
   SELECT array_agg(a.attname||':'||
           pg_catalog.format_type(a.atttypid,a.atttypmod)
           ORDER BY a.attname) INTO actual_columns
   FROM pg_catalog.pg_attribute a
   WHERE a.attrelid=to_regclass('public.'||v2_table)
     AND a.attnum>0 AND NOT a.attisdropped;
   IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class c
      WHERE c.oid=to_regclass('public.'||v2_table)
        AND c.relkind='r' AND c.relrowsecurity) OR
      actual_columns IS DISTINCT FROM
      (SELECT array_agg(c ORDER BY c) FROM unnest(expected_columns) AS x(c))
   THEN RAISE EXCEPTION 'D8K13_UNEXPECTED_D8DV2_SCHEMA'; END IF;
   IF pg_catalog.has_table_privilege('anon','public.'||v2_table,'SELECT') OR
      pg_catalog.has_table_privilege('authenticated','public.'||v2_table,'SELECT')
   THEN RAISE EXCEPTION 'D8K13_UNEXPECTED_D8DV2_SECURITY'; END IF;
  END LOOP;
 END IF;

 -- Deployment operator must pin both the evidence and verdict identities.
 -- Do NOT obtain the expected manifest dynamically from the write transaction:
 -- it must be independently approved from an earlier read-only snapshot.
 SELECT string_agg(e.source_key||':'||e.evidence_id::text||':'||
    v.verdict_id::text,';' ORDER BY e.source_key)
 INTO observed_manifest
 FROM public.admin_product_correction_evidence_verdicts_v1 v
 JOIN public.admin_product_correction_evidence_v1 e USING(evidence_id);
 IF expected_manifest IS NULL OR
    observed_manifest IS DISTINCT FROM expected_manifest
 THEN RAISE EXCEPTION 'D8K13_UNEXPECTED_LEGACY_SHAPE'; END IF;
 IF legacy_count<>2 OR
    (SELECT count(*) FROM public.admin_product_correction_evidence_v1)<>2 OR
    (SELECT count(*) FROM public.admin_product_correction_evidence_v1
      WHERE product_id=r16i_id AND evidence_state='UNVERIFIED'
       AND source_key IN ('official_single','hwahae_bundle'))<>2 OR
    (SELECT count(DISTINCT source_key) FROM public.admin_product_correction_evidence_v1)<>2 OR
    (SELECT count(*) FROM public.admin_product_correction_evidence_v1 e
      JOIN public.admin_product_correction_evidence_verdicts_v1 v USING(evidence_id)
      WHERE e.product_id=r16i_id AND e.evidence_state='UNVERIFIED'
       AND v.verdict='VERIFIED' AND v.reviewer_id=e.submitted_by)<>2 OR
    (SELECT count(*) FROM public.admin_product_correction_proposals_v1)<>0 OR
    (SELECT count(*) FROM public.admin_product_correction_decisions_v1)<>0 OR
    (SELECT count(*) FROM public.admin_r16i_correction_applications_v1)<>0 OR
    (SELECT count(*) FROM public.admin_r16i_correction_application_events_v1)<>0 OR
    (SELECT count(*) FROM public.admin_r16i_correction_release_gate_v1
      WHERE scope='R16I_S_NATURE_PRODUCT_1' AND enabled=false)<>1 OR
    (SELECT count(*) FROM public.admin_r16i_correction_release_gate_v1)<>1 OR
    (SELECT count(*) FROM public.admin_memberships
      WHERE role='admin_owner' AND is_active=true)<>1
 THEN RAISE EXCEPTION 'D8K13_UNEXPECTED_LEGACY_SHAPE'; END IF;
END
$d8k12_preflight$;

-- Preserve original self-reviewed decisions *before* invalidating their
-- effective status. No original reviewer, reason, request or timestamp edits.
CREATE TABLE public.admin_product_correction_legacy_verdict_quarantine_v1 (
 legacy_snapshot_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 legacy_verdict_id uuid NOT NULL UNIQUE REFERENCES
  public.admin_product_correction_evidence_verdicts_v1(verdict_id) ON DELETE RESTRICT,
 evidence_id uuid NOT NULL UNIQUE REFERENCES
  public.admin_product_correction_evidence_v1(evidence_id) ON DELETE RESTRICT,
 product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
 source_key text NOT NULL CHECK(source_key IN ('official_single','hwahae_bundle')),
 original_evidence_state text NOT NULL CHECK(original_evidence_state='UNVERIFIED'),
 original_verdict text NOT NULL CHECK(original_verdict='VERIFIED'),
 original_reason text NOT NULL,
 original_reviewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 original_submitted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 original_request_id uuid NOT NULL,
 original_reviewed_at timestamptz NOT NULL,
 classification text NOT NULL DEFAULT 'SELF_REVIEWED_LEGACY_UNTRUSTED'
  CHECK(classification='SELF_REVIEWED_LEGACY_UNTRUSTED'),
 disposition text NOT NULL DEFAULT 'QUARANTINED_NOT_APPROVED'
  CHECK(disposition='QUARANTINED_NOT_APPROVED'),
 release_ticket text NOT NULL CHECK (char_length(btrim(release_ticket))>=12),
 migration_db_role text NOT NULL,
 quarantined_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK (original_reviewer_id=original_submitted_by)
);
ALTER TABLE public.admin_product_correction_legacy_verdict_quarantine_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_product_correction_legacy_verdict_quarantine_v1
 FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.admin_product_correction_legacy_verdict_quarantine_v1
 TO service_role;
CREATE FUNCTION public.reject_r16i_legacy_quarantine_mutation_v1()
 RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $d8k13_immutable$
BEGIN
 RAISE EXCEPTION 'D8K13_IMMUTABLE_LEGACY_AUDIT';
END;
$d8k13_immutable$;
CREATE TRIGGER r16i_legacy_quarantine_append_only
 BEFORE UPDATE OR DELETE ON public.admin_product_correction_legacy_verdict_quarantine_v1
 FOR EACH ROW EXECUTE FUNCTION public.reject_r16i_legacy_quarantine_mutation_v1();

CREATE TABLE public.admin_product_correction_evidence_review_events_v2 (
 event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 event_sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
 evidence_id uuid NOT NULL REFERENCES public.admin_product_correction_evidence_v1(evidence_id) ON DELETE RESTRICT,
 current_verdict_id uuid NOT NULL REFERENCES public.admin_product_correction_evidence_verdicts_v1(verdict_id) ON DELETE RESTRICT,
 verdict text NOT NULL CHECK (verdict IN ('VERIFIED','REJECTED','REVOKED','LEGACY_QUARANTINED')),
 origin text NOT NULL DEFAULT 'D8K12_HUMAN_REVIEW'
  CHECK(origin IN ('D8K12_HUMAN_REVIEW','D8K13_LEGACY_RECONCILIATION')),
 legacy_snapshot_id uuid UNIQUE REFERENCES
  public.admin_product_correction_legacy_verdict_quarantine_v1(legacy_snapshot_id) ON DELETE RESTRICT,
 previous_verdict text CHECK (previous_verdict IS NULL OR previous_verdict='VERIFIED'),
 reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 1 AND 2000),
 reviewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 request_id uuid NOT NULL UNIQUE,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK (
  (origin='D8K12_HUMAN_REVIEW' AND legacy_snapshot_id IS NULL AND
   ((verdict IN ('VERIFIED','REJECTED') AND previous_verdict IS NULL)
     OR (verdict='REVOKED' AND previous_verdict='VERIFIED')))
  OR
  (origin='D8K13_LEGACY_RECONCILIATION' AND legacy_snapshot_id IS NOT NULL AND
   verdict='LEGACY_QUARANTINED' AND previous_verdict IS NULL)
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

-- D8K-13: single-transaction reconciliation of an EXACT observed two-row
-- self-reviewed legacy shape. All writes in this DO block are fully rolled
-- back if ANY later migration DDL/function/grant/assertion fails.
DO $d8k13_bootstrap$
DECLARE
 rec record;
 snap uuid;
 inserted_count integer:=0;
 updated_count integer;
 ticket text:=nullif(btrim(current_setting('app.d8k13_release_ticket',true)),'');
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.admin_product_correction_evidence_verdicts_v1)
 THEN RETURN; END IF;
 -- First preflight already holds Product + source/ledger + downstream locks.
 IF ticket IS NULL OR char_length(ticket)<12
 THEN RAISE EXCEPTION 'D8K12_EXISTING_VERDICTS_REQUIRE_EXPLICIT_RECONCILIATION'; END IF;
 FOR rec IN
  SELECT v.*,e.product_id,e.source_key,e.evidence_state,e.submitted_by
  FROM public.admin_product_correction_evidence_verdicts_v1 v
  JOIN public.admin_product_correction_evidence_v1 e USING(evidence_id)
  ORDER BY v.verdict_id
 LOOP
  INSERT INTO public.admin_product_correction_legacy_verdict_quarantine_v1(
   legacy_verdict_id,evidence_id,product_id,source_key,
   original_evidence_state,original_verdict,original_reason,
   original_reviewer_id,original_submitted_by,original_request_id,
   original_reviewed_at,release_ticket,migration_db_role
  ) VALUES (
   rec.verdict_id,rec.evidence_id,rec.product_id,rec.source_key,
   rec.evidence_state,rec.verdict,rec.reason,
   rec.reviewer_id,rec.submitted_by,rec.request_id,
   rec.reviewed_at,ticket,current_user
  ) RETURNING legacy_snapshot_id INTO snap;
  INSERT INTO public.admin_product_correction_evidence_review_events_v2(
   evidence_id,current_verdict_id,verdict,origin,legacy_snapshot_id,
   previous_verdict,reason,reviewer_id,request_id
  ) VALUES (
   rec.evidence_id,rec.verdict_id,'LEGACY_QUARANTINED',
   'D8K13_LEGACY_RECONCILIATION',snap,NULL,
   'Historic self-reviewed VERIFIED record quarantined; not independently reviewed',
   rec.reviewer_id,gen_random_uuid()
  );
  inserted_count:=inserted_count+1;
 END LOOP;
 IF inserted_count<>2 THEN RAISE EXCEPTION 'D8K13_LEGACY_BOOTSTRAP_COUNT_MISMATCH'; END IF;
 UPDATE public.admin_product_correction_evidence_verdicts_v1 v
 SET verdict='REJECTED'
 FROM public.admin_product_correction_legacy_verdict_quarantine_v1 q
 WHERE v.verdict_id=q.legacy_verdict_id AND
   v.evidence_id=q.evidence_id AND v.verdict='VERIFIED';
 GET DIAGNOSTICS updated_count=ROW_COUNT;
 IF updated_count<>2 OR
  (SELECT count(*) FROM public.admin_product_correction_legacy_verdict_quarantine_v1)<>2 OR
  (SELECT count(*) FROM public.admin_product_correction_evidence_review_events_v2
    WHERE verdict='LEGACY_QUARANTINED'
      AND origin='D8K13_LEGACY_RECONCILIATION')<>2 OR
  (SELECT count(*) FROM public.admin_product_correction_evidence_verdicts_v1
    WHERE verdict='VERIFIED')<>0 OR
  (SELECT count(*) FROM public.admin_product_correction_evidence_verdicts_v1
    WHERE verdict='REJECTED')<>2 OR
  (SELECT count(*) FROM public.admin_r16i_correction_release_gate_v1 WHERE enabled)<>0
 THEN RAISE EXCEPTION 'D8K13_LEGACY_QUARANTINE_POSTCONDITION_FAILED'; END IF;
END;
$d8k13_bootstrap$;

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
