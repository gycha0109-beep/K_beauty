-- D8K-13 actual D8D v2 -> D8K13 migration-chain verification.
-- Applied to throwaway PG17 after the unmodified D8D v2 migration and
-- ticket+manifest-pinned D8K12/D8K13 integrated migration.
DO $d8k13_v2_chain_assert$
BEGIN
 IF to_regprocedure('public.r16i_d8d_apply_v2(uuid,uuid,uuid,text)') IS NULL OR
    to_regprocedure('public.r16i_d8d_rollback_v2(uuid,uuid,uuid)') IS NULL
 THEN RAISE EXCEPTION 'D8K13_D8DV2_REAL_MIGRATION_NOT_APPLIED'; END IF;
 IF (SELECT count(*) FROM public.admin_r16i_d8d_v2_gate
     WHERE scope='R16I_S_NATURE_PRODUCT_1' AND enabled=false
       AND change_ticket IS NULL)<>1
    OR (SELECT count(*) FROM public.admin_r16i_d8d_v2_gate)<>1
    OR EXISTS(SELECT 1 FROM public.admin_r16i_d8d_v2_owner_authorizations)
    OR EXISTS(SELECT 1 FROM public.admin_r16i_d8d_v2_applications)
    OR EXISTS(SELECT 1 FROM public.admin_r16i_d8d_v2_application_offers)
    OR EXISTS(SELECT 1 FROM public.admin_r16i_d8d_v2_events)
 THEN RAISE EXCEPTION 'D8K13_D8DV2_INERT_LEDGER_NOT_PRESERVED'; END IF;
 IF (SELECT count(*) FROM public.admin_product_correction_legacy_verdict_quarantine_v1)<>2 OR
    (SELECT count(*) FROM public.admin_product_correction_evidence_review_events_v2
      WHERE origin='D8K13_LEGACY_RECONCILIATION' AND verdict='LEGACY_QUARANTINED')<>2 OR
    (SELECT count(*) FROM public.admin_product_correction_evidence_verdicts_v1
      WHERE verdict='VERIFIED')<>0 OR
    (SELECT count(*) FROM public.admin_product_correction_evidence_verdicts_v1
      WHERE verdict='REJECTED')<>2
 THEN RAISE EXCEPTION 'D8K13_D8DV2_LEGACY_EFFECTIVE_APPROVAL_REMAINS'; END IF;
 IF (SELECT count(*) FROM public.products)<>1 OR
    EXISTS(SELECT 1 FROM public.product_offers) OR
    (SELECT count(*) FROM public.admin_product_correction_proposals_v1)<>0 OR
    (SELECT count(*) FROM public.admin_product_correction_decisions_v1)<>0
 THEN RAISE EXCEPTION 'D8K13_D8DV2_PRODUCT_OR_OFFER_WRITE'; END IF;
 IF pg_catalog.has_table_privilege('service_role',
    'public.admin_r16i_d8d_v2_gate','INSERT,UPDATE,DELETE,TRUNCATE') OR
    pg_catalog.has_table_privilege('service_role',
    'public.admin_r16i_d8d_v2_owner_authorizations','INSERT,UPDATE,DELETE,TRUNCATE') OR
    NOT pg_catalog.has_table_privilege('service_role',
    'public.admin_r16i_d8d_v2_gate','SELECT')
 THEN RAISE EXCEPTION 'D8K13_D8DV2_SECURITY_REGRESSION'; END IF;
END
$d8k13_v2_chain_assert$;
\echo D8K13_D8DV2_REAL_ORDER_CHAIN_ACCEPTANCE_PASS
