-- R16I-D8C: an append-only human evidence verdict -> correction proposal -> owner decision ledger.
-- Explicitly NO product/offer/subject/ranking mutation and NO grant of D8D application authority.
CREATE TABLE public.admin_product_correction_evidence_verdicts_v1 (
 verdict_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 evidence_id uuid NOT NULL UNIQUE REFERENCES public.admin_product_correction_evidence_v1(evidence_id) ON DELETE RESTRICT,
 verdict text NOT NULL CHECK (verdict IN ('VERIFIED','REJECTED')),
 reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 12 AND 2000),
 reviewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 request_id uuid NOT NULL UNIQUE,
 reviewed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.admin_product_correction_proposals_v1 (
 proposal_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
 product_revision timestamptz NOT NULL,
 baseline_sha256 text NOT NULL CHECK (baseline_sha256 ~ '^[0-9a-f]{64}$'),
 strategy text NOT NULL CHECK (strategy = 'A_PRODUCT_ANCHOR_REUSE_AND_OFFER_SEPARATION'),
 field_changes jsonb NOT NULL CHECK (jsonb_typeof(field_changes)='array' AND jsonb_array_length(field_changes) BETWEEN 1 AND 8),
 evidence_ids uuid[] NOT NULL CHECK (cardinality(evidence_ids) BETWEEN 1 AND 12),
 rationale text NOT NULL CHECK (char_length(btrim(rationale)) BETWEEN 12 AND 2000),
 authored_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 request_id uuid NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_product_correction_proposals_product_recent_idx
 ON public.admin_product_correction_proposals_v1(product_id,created_at DESC);
CREATE TABLE public.admin_product_correction_decisions_v1 (
 decision_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 proposal_id uuid NOT NULL UNIQUE REFERENCES public.admin_product_correction_proposals_v1(proposal_id) ON DELETE RESTRICT,
 decision text NOT NULL CHECK (decision IN ('APPROVE_FOR_D8D_REVIEW','HOLD','REJECT')),
 reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 12 AND 2000),
 decided_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 request_id uuid NOT NULL UNIQUE,
 decided_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_product_correction_evidence_verdicts_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_product_correction_proposals_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_product_correction_decisions_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_product_correction_evidence_verdicts_v1,
 public.admin_product_correction_proposals_v1, public.admin_product_correction_decisions_v1
 FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.admin_product_correction_evidence_verdicts_v1,
 public.admin_product_correction_proposals_v1 TO service_role;
GRANT SELECT ON public.admin_product_correction_decisions_v1 TO service_role;

-- Only the authenticated server owner action invokes this RPC using the service client.
-- The DB itself verifies active owner membership, current product revision and evidence review.
-- It cannot mutate catalog tables; even APPROVE_FOR_D8D_REVIEW gives NO actual write authority.
CREATE FUNCTION public.decide_r16i_product_correction_v1(
 p_proposal_id uuid, p_decision text, p_reason text, p_actor_id uuid, p_request_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER
 SET search_path = ''
AS $$
DECLARE
 proposal public.admin_product_correction_proposals_v1%ROWTYPE;
 current_revision timestamptz;
 blocking_count integer;
 saved public.admin_product_correction_decisions_v1%ROWTYPE;
BEGIN
 IF p_proposal_id IS NULL OR p_request_id IS NULL OR p_actor_id IS NULL OR
    p_decision NOT IN ('APPROVE_FOR_D8D_REVIEW','HOLD','REJECT') OR
    char_length(btrim(coalesce(p_reason,''))) NOT BETWEEN 12 AND 2000 THEN
   RAISE EXCEPTION 'R16I_INVALID_DECISION';
 END IF;
 IF NOT EXISTS (
   SELECT 1 FROM public.admin_memberships
   WHERE user_id=p_actor_id AND role='admin_owner' AND is_active=true
 ) THEN RAISE EXCEPTION 'R16I_OWNER_REQUIRED'; END IF;
 SELECT * INTO proposal FROM public.admin_product_correction_proposals_v1
  WHERE proposal_id=p_proposal_id FOR UPDATE;
 IF NOT FOUND OR proposal.product_id <> 'b639c8b4-6a61-440e-b4db-fac7381593ff'::uuid
 THEN RAISE EXCEPTION 'R16I_PROPOSAL_MISSING'; END IF;
 IF EXISTS (SELECT 1 FROM public.admin_product_correction_decisions_v1
             WHERE proposal_id=p_proposal_id)
 THEN RAISE EXCEPTION 'R16I_PROPOSAL_ALREADY_DECIDED'; END IF;
 IF p_decision='APPROVE_FOR_D8D_REVIEW' THEN
   SELECT updated_at INTO current_revision FROM public.products
    WHERE id=proposal.product_id FOR UPDATE;
   IF NOT FOUND OR current_revision IS DISTINCT FROM proposal.product_revision
   THEN RAISE EXCEPTION 'R16I_PRODUCT_REVISION_DRIFT'; END IF;
   -- All evidence identifiers must remain attached to this exact product,
   -- with a VERIFIED human verdict (never just an upload).
   SELECT count(*) INTO blocking_count
   FROM unnest(proposal.evidence_ids) AS eid
   LEFT JOIN public.admin_product_correction_evidence_v1 e
     ON e.evidence_id=eid AND e.product_id=proposal.product_id
   LEFT JOIN public.admin_product_correction_evidence_verdicts_v1 v
     ON v.evidence_id=e.evidence_id AND v.verdict='VERIFIED'
   WHERE e.evidence_id IS NULL OR v.verdict_id IS NULL;
   IF blocking_count>0 THEN RAISE EXCEPTION 'R16I_UNVERIFIED_EVIDENCE'; END IF;
   IF (SELECT count(DISTINCT e.source_key)
       FROM public.admin_product_correction_evidence_v1 e
       JOIN public.admin_product_correction_evidence_verdicts_v1 v
         ON v.evidence_id=e.evidence_id AND v.verdict='VERIFIED'
       WHERE e.product_id=proposal.product_id
         AND e.evidence_id=ANY(proposal.evidence_ids)) <> 2
   THEN RAISE EXCEPTION 'R16I_TWO_SOURCE_EVIDENCE_REQUIRED'; END IF;
   IF (SELECT count(DISTINCT evidence_id) FROM unnest(proposal.evidence_ids) AS x(evidence_id))
      <> cardinality(proposal.evidence_ids)
   THEN RAISE EXCEPTION 'R16I_DUPLICATE_EVIDENCE'; END IF;
   IF EXISTS (SELECT 1 FROM public.product_offers WHERE product_id=proposal.product_id) OR
      EXISTS (SELECT 1 FROM public.product_fact_subjects WHERE product_id=proposal.product_id)
   THEN RAISE EXCEPTION 'R16I_SCOPE_COLLISION'; END IF;
 END IF;
 INSERT INTO public.admin_product_correction_decisions_v1
  (proposal_id,decision,reason,decided_by,request_id)
 VALUES(p_proposal_id,p_decision,btrim(p_reason),p_actor_id,p_request_id)
 RETURNING * INTO saved;
 RETURN jsonb_build_object(
  'decisionId',saved.decision_id,'proposalId',saved.proposal_id,
  'decision',saved.decision,'decidedAt',saved.decided_at,
  'productionWriteAuthorized',false,'productWrites',0,
  'offerWrites',0,'subjectWrites',0,'rankingWrites',0
 );
END;
$$;
REVOKE ALL ON FUNCTION public.decide_r16i_product_correction_v1(uuid,text,text,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decide_r16i_product_correction_v1(uuid,text,text,uuid,uuid) TO service_role;
