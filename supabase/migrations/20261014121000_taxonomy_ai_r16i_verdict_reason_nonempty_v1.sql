-- R16I-D8C evidence owner verdict reason: allow any nonblank text (1..2000).
-- Only the evidence verdict reason CHECK changes; OWNER auth, RLS, audit,
-- proposal and decision minimum lengths, Product/Offer writes remain unchanged.
-- Rollback (if required): change the new CHECK back to BETWEEN 12 AND 2000,
-- after separately confirming existing short reasons, if any, are reconciled.

DO $r16i$
BEGIN
  IF to_regclass('public.admin_product_correction_evidence_verdicts_v1') IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM pg_constraint c
       WHERE c.conrelid = 'public.admin_product_correction_evidence_verdicts_v1'::regclass
         AND c.conname = 'admin_product_correction_evidence_verdicts_v1_reason_check'
         AND pg_get_constraintdef(c.oid) LIKE '%char_length(btrim(reason)) >= 12%'
         AND pg_get_constraintdef(c.oid) LIKE '%char_length(btrim(reason)) <= 2000%'
     ) THEN
    RAISE EXCEPTION 'R16I_VERDICT_REASON_EXPECTED_12_CHAR_CONSTRAINT_MISSING';
  END IF;
END
$r16i$;

ALTER TABLE public.admin_product_correction_evidence_verdicts_v1
  DROP CONSTRAINT admin_product_correction_evidence_verdicts_v1_reason_check;
ALTER TABLE public.admin_product_correction_evidence_verdicts_v1
  ADD CONSTRAINT admin_product_correction_evidence_verdicts_v1_reason_check
  CHECK (char_length(btrim(reason)) BETWEEN 1 AND 2000);
