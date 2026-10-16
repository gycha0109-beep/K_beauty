-- D8K-13 / R16I: READ-ONLY hosted snapshot diagnostic (DESIGN ONLY).
-- No DDL/DML, source bytes, storage objects, private notes, or account IDs.
-- shape_matches_observed_snapshot=true does NOT authorize reconciliation/release.
-- This query intentionally fails if required baseline tables are missing.
WITH evidence_join AS (
 SELECT e.product_id,e.source_key,e.evidence_state,
        v.verdict_id,v.verdict,
        (v.reviewer_id=e.submitted_by) AS self_review
 FROM public.admin_product_correction_evidence_v1 e
 LEFT JOIN public.admin_product_correction_evidence_verdicts_v1 v
   ON v.evidence_id=e.evidence_id
), target AS (
 SELECT * FROM evidence_join
 WHERE product_id='b639c8b4-6a61-440e-b4db-fac7381593ff'::uuid
), shape AS (
 SELECT count(*) AS target_count,
        count(*) FILTER (WHERE source_key='official_single') AS official_count,
        count(*) FILTER (WHERE source_key='hwahae_bundle') AS hwahae_count,
        count(*) FILTER (WHERE verdict_id IS NOT NULL AND verdict='VERIFIED'
          AND self_review IS TRUE AND evidence_state='UNVERIFIED') AS invalid_legacy_count
 FROM target
), gate AS (
 SELECT count(*) AS gate_count,
        count(*) FILTER(WHERE scope='R16I_S_NATURE_PRODUCT_1' AND enabled=false) AS disabled_count
 FROM public.admin_r16i_correction_release_gate_v1
)
SELECT jsonb_build_object(
 'diagnostic','D8K13_READ_ONLY_PREFLIGHT_V1',
 'target_evidence_total',shape.target_count,
 'legacy_verdict_total',(SELECT count(*) FROM public.admin_product_correction_evidence_verdicts_v1),
 'source_counts',jsonb_build_object('official_single',shape.official_count,'hwahae_bundle',shape.hwahae_count),
 'self_reviewed_verified_unverified_count',shape.invalid_legacy_count,
 'proposal_total',(SELECT count(*) FROM public.admin_product_correction_proposals_v1),
 'decision_total',(SELECT count(*) FROM public.admin_product_correction_decisions_v1),
 'application_total',(SELECT count(*) FROM public.admin_r16i_correction_applications_v1),
 'application_event_total',(SELECT count(*) FROM public.admin_r16i_correction_application_events_v1),
 'active_owner_count',(SELECT count(*) FROM public.admin_memberships WHERE role='admin_owner' AND is_active),
 'release_gate_disabled',(gate.gate_count=1 AND gate.disabled_count=1),
 'review_events_v2_absent',to_regclass('public.admin_product_correction_evidence_review_events_v2') IS NULL,
 'review_rpc_v2_absent',to_regprocedure('public.review_r16i_evidence_v2(uuid,text,text,uuid,uuid)') IS NULL,
 'd8d_v2_apps_absent',to_regclass('public.admin_r16i_d8d_v2_applications') IS NULL,
 'shape_matches_observed_snapshot',
  (shape.target_count=2 AND shape.official_count=1 AND shape.hwahae_count=1
    AND shape.invalid_legacy_count=2
    AND (SELECT count(*) FROM public.admin_product_correction_evidence_verdicts_v1)=2
    AND (SELECT count(*) FROM public.admin_product_correction_proposals_v1)=0
    AND (SELECT count(*) FROM public.admin_product_correction_decisions_v1)=0
    AND (SELECT count(*) FROM public.admin_r16i_correction_applications_v1)=0
    AND (SELECT count(*) FROM public.admin_r16i_correction_application_events_v1)=0
    AND gate.gate_count=1 AND gate.disabled_count=1
    AND to_regclass('public.admin_product_correction_evidence_review_events_v2') IS NULL
    AND to_regprocedure('public.review_r16i_evidence_v2(uuid,text,text,uuid,uuid)') IS NULL
    AND to_regclass('public.admin_r16i_d8d_v2_applications') IS NULL)
) AS d8k13_read_only_preflight
FROM shape CROSS JOIN gate;
